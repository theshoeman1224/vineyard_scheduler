import { NextResponse } from "next/server";
import { createRequestSchema } from "@/lib/validation";
import { createRequest, getRequestsAll, getRequestsCurrent, getRooms } from "@/lib/data";
import { earliestBookableDate, sortUniqueDates } from "@/lib/dates";
import { adminNewRequestEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import { adminEmail, adminEmailIsConfigured, appUrl, signingSecret } from "@/lib/env";
import { signDecideToken } from "@/lib/tokens";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/admin";
import { toPublicRequest } from "@/app/lib/requestTypes";

// Admins get the full history with private fields (email, note) for the
// admin table; everyone else gets only current pending/confirmed requests
// with name, room, status, and dates.
export async function GET() {
  const admin = await isAdmin();
  const rows = admin
    ? await getRequestsAll()
    : await getRequestsCurrent(earliestBookableDate());
  return NextResponse.json({
    requests: rows.map((r) => toPublicRequest(r, admin)),
  });
}

// 20 valid submissions per 15 minutes per client IP. The whole household
// (~12 people) often shares one router and so one public IP; 20 leaves
// room for everyone while still capping spam and Resend email abuse.
const SUBMIT_LIMIT = 20;
const SUBMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => i.message)
      .join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Counted only after validation: a rejected submission writes nothing
  // and sends no email, so typos must not use up the household's budget.
  const limit = checkRateLimit(
    `submit:${clientIp(req.headers)}`,
    SUBMIT_LIMIT,
    SUBMIT_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests from this address — try again later" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const input = parsed.data;
  const rooms = await getRooms();
  const requested = rooms.filter((r) => input.roomIds.includes(r.id));
  if (requested.length !== input.roomIds.length) {
    return NextResponse.json({ error: "One or more rooms not found" }, { status: 400 });
  }

  const dates = sortUniqueDates(input.dates);

  // Read required config before writing: once the request is saved,
  // nothing below may fail the response (a retry would duplicate it).
  const secret = signingSecret();
  const baseUrl = appUrl();

  let created: { groupId: string; ids: number[]; cancelToken: string };
  try {
    created = await createRequest({
      name: input.name,
      email: input.email,
      roomIds: input.roomIds,
      dates,
      note: input.note,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save request" },
      { status: 500 },
    );
  }

  // Notify the admin — never fail the request because of email problems,
  // including an unset ADMIN_EMAIL (adminEmail() would throw).
  let emailQueued = false;
  if (adminEmailIsConfigured()) {
    const msg = adminNewRequestEmail(
      {
        name: input.name,
        email: input.email,
        rooms: requested.map((r) => r.name),
        dates,
        note: input.note,
      },
      `${baseUrl}/api/decide/${signDecideToken(created.groupId, "approve", secret)}`,
      `${baseUrl}/api/decide/${signDecideToken(created.groupId, "deny", secret)}`,
    );
    emailQueued = (await trySendEmail(adminEmail(), msg)).ok;
  }

  return NextResponse.json({
    ok: true,
    id: created.ids[0],
    roomCount: created.ids.length,
    cancelUrl: `${baseUrl}/api/cancel/${created.cancelToken}`,
    emailQueued,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
