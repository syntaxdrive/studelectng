import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import CryptoJS from "crypto-js";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limiter";

const SESSION_COOKIE_NAME = "studelect_admin_session";
const SESSION_SECRET = process.env.BALLOT_SIGNING_SECRET || "studelect-nigeria-super-secure-session-key-2026";

function decryptSessionToken(token: string) {
  try {
    const bytes = CryptoJS.AES.decrypt(token, SESSION_SECRET);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;

    const session = JSON.parse(decryptedStr);
    if (Date.now() > session.expiresAt) return null;
    return session;
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // 0. Rate Limiting on Admin Login Endpoint (Anti-Brute Force: 15 req/min per IP)
  if (pathname === "/admin/login") {
    const loginLimit = checkRateLimit(`login-ip:${ip}`, 15, 60 * 1000);
    if (!loginLimit.allowed) {
      return new NextResponse(
        "Too many login attempts from this network. Please wait a minute before retrying.",
        {
          status: 429,
          headers: {
            "Retry-After": String(loginLimit.retryAfterSeconds),
            "Content-Type": "text/plain",
          },
        }
      );
    }
  }

  // 0b. General API Rate Limiting (60 req/min per IP)
  if (pathname.startsWith("/api/")) {
    const apiLimit = checkRateLimit(`api-ip:${ip}`, 60, 60 * 1000);
    if (!apiLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Too many requests.", retryAfter: apiLimit.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(apiLimit.retryAfterSeconds),
          },
        }
      );
    }
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? decryptSessionToken(cookie) : null;

  // 1. Guard Super Admin Routes (/super-admin and subroutes)
  if (pathname.startsWith("/super-admin")) {
    if (!session || session.role !== "SUPER_ADMIN") {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Guard Institution ELCOM Admin Routes (/[institution]/admin and subroutes)
  const isInstitutionAdminRoute =
    pathname.includes("/admin") &&
    !pathname.startsWith("/admin/login") &&
    !pathname.startsWith("/super-admin");

  if (isInstitutionAdminRoute) {
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/login",
    "/super-admin/:path*",
    "/:institution/admin/:path*",
    "/api/:path*",
  ],
};
