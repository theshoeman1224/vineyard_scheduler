import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  checkAdminPassword,
  createAdminSession,
  verifyAdminSession,
  SESSION_TTL_MS,
} from "./tokens";
import { adminPassword, signingSecret } from "./env";

export const ADMIN_COOKIE = "admin_session";

// Cookie attributes shared by login and logout so the session cookie
// behaves identically wherever it is written. `maxAgeSeconds` defaults to
// the session TTL; logout passes 0 to clear immediately.
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  } as const;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value, signingSecret());
}

// Route-handler guard for admin API endpoints. Returns the 401 response
// the handler should send back, or null when the request may proceed.
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function loginAdmin(): { cookieValue: string } {
  return {
    cookieValue: createAdminSession(signingSecret()),
  };
}

export function checkPassword(provided: string): boolean {
  return checkAdminPassword(provided, adminPassword(), signingSecret());
}
