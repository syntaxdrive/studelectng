"use server";

import { authenticateAdmin } from "@/lib/auth/admin-session";
import { setAdminSessionCookie, clearAdminSessionCookie, getAdminSession, AuthSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginAction(input: LoginInput) {
  try {
    const cleanEmail = (input.email || "").trim().toLowerCase();
    const limit = checkRateLimit(`login:${cleanEmail}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return {
        success: false,
        message: `Too many failed login attempts for this account. Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s) before trying again.`,
      };
    }

    const authResult = await authenticateAdmin(input.email, input.password);

    if (!authResult.success || !authResult.user) {
      return {
        success: false,
        message: authResult.message || "Invalid email or password.",
      };
    }

    const user = authResult.user;
    const session: AuthSession = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      institutionId: user.institutionId,
      institutionSlug: user.institutionSlug || "unilag",
      orgId: user.orgId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Set secure HTTP-only cookie
    await setAdminSessionCookie(session);

    return {
      success: true,
      role: user.role,
      institutionSlug: user.institutionSlug || "unilag",
      message: "Authenticated successfully.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Authentication error occurred.",
    };
  }
}

export async function logoutAction() {
  await clearAdminSessionCookie();
  // Navigation is handled client-side by LogoutButton for instant UX.
  // This action only clears the server-side session cookie.
}

export async function getCurrentUserSession(): Promise<AuthSession | null> {
  return await getAdminSession();
}
