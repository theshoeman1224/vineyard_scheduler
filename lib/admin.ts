import { cookies } from "next/headers";
import {
  checkAdminPassword,
  createAdminSession,
  verifyAdminSession,
} from "./tokens";
import { adminPassword, signingSecret } from "./env";

export const ADMIN_COOKIE = "admin_session";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value, signingSecret());
}

export function loginAdmin(): { cookieValue: string } {
  return {
    cookieValue: createAdminSession(signingSecret()),
  };
}

export function checkPassword(provided: string): boolean {
  return checkAdminPassword(provided, adminPassword(), signingSecret());
}
