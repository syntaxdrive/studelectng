import { cookies } from "next/headers";
import CryptoJS from "crypto-js";

export type UserRole =
  | "SUPER_ADMIN"
  | "ELCOM_ADMIN";

export interface AuthSession {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionId?: string;
  institutionSlug?: string;
  orgId?: string;
  electionId?: string;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = "studelect_admin_session";
const SESSION_SECRET =
  process.env.BALLOT_SIGNING_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "studelect-dev-local-session-key");

/**
 * Encrypt and sign session object into a secure string
 */
export function encryptSession(session: AuthSession): string {
  const jsonStr = JSON.stringify(session);
  return CryptoJS.AES.encrypt(jsonStr, SESSION_SECRET).toString();
}

/**
 * Decrypt and verify session string
 */
export function decryptSession(token: string): AuthSession | null {
  try {
    const bytes = CryptoJS.AES.decrypt(token, SESSION_SECRET);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;

    const session: AuthSession = JSON.parse(decryptedStr);
    if (Date.now() > session.expiresAt) {
      return null;
    }
    return session;
  } catch (error) {
    return null;
  }
}

/**
 * Store session in HTTP-only secure cookie
 */
export async function setAdminSessionCookie(session: AuthSession) {
  const token = encryptSession(session);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Retrieve current admin session
 */
export async function getAdminSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  return decryptSession(token);
}

/**
 * Clear session on logout
 */
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
