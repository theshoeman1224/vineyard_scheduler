import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkPassword,
  loginAdmin,
  sessionCookieOptions,
} from "@/lib/admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// 10 password attempts per 5 minutes per client IP.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const limit = checkRateLimit(
    `login:${clientIp(req.headers)}`,
    LOGIN_LIMIT,
    LOGIN_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts — try again later" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const { cookieValue } = loginAdmin();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, cookieValue, sessionCookieOptions());
  return res;
}

export const runtime = "nodejs";
