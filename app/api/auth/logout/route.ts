import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "studelect_admin_session";

export async function GET(request: Request) {
  return handleLogout(request);
}

export async function POST(request: Request) {
  return handleLogout(request);
}

async function handleLogout(request: Request) {
  const url = new URL(request.url);
  const redirectTarget = url.searchParams.get("redirect") || "/admin/login";

  // 1. Delete session cookie via next/headers
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (_) {}

  // 2. Build redirect response
  const redirectUrl = new URL(redirectTarget, request.url);
  const response = NextResponse.redirect(redirectUrl);

  // 3. Explicitly set Set-Cookie header on response with maxAge=0 for 100% browser compatibility
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // 4. Instruct browser to clear sensitive authentication storage
  response.headers.set("Cache-Control", "no-store, max-age=0");

  return response;
}
