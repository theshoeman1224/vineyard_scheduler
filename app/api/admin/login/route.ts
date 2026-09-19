import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, loginAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const { cookieValue } = loginAdmin();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}

export const runtime = "nodejs";
