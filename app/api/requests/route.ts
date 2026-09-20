import { NextResponse } from "next/server";
import { createRequestSchema } from "@/lib/validation";
import { createRequest, getRequestsAll, getRooms } from "@/lib/data";
import { sortUniqueDates } from "@/lib/dates";
import { adminNewRequestEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import { adminEmail, appUrl, signingSecret } from "@/lib/env";
import { signDecideToken } from "@/lib/tokens";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/admin";
import { toPublicRequest } from "@/app/lib/requestTypes";

export async function GET() {
  const all = await getRequestsAll();
  // Requester emails are PII — only signed-in admins receive them; the
  // public table needs only name, room, status, and dates.
  const includeEmail = await isAdmin();
  return NextResponse.json({
    requests: all.map((r) => toPublicRequest(r, includeEmail)),
  });
}

// 5 submissions per 15 minutes per client IP — enough for a household
// coordinating rooms, tight enough to blunt spam and Resend email abuse.
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
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

  const input = parsed.data;
  const rooms = await getRooms();
  const requested = rooms.filter((r) => input.roomIds.includes(r.id));
  if (requested.length !== input.roomIds.length) {
    return NextResponse.json({ error: "One or more rooms not found" }, { status: 400 });
  }

  const dates = sortUniqueDates(input.dates);

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

  // Notify the admin — never fail the request because of email problems.
  const msg = adminNewRequestEmail(
    {
      name: input.name,
      email: input.email,
      rooms: requested.map((r) => r.name),
      dates,
      note: input.note,
    },
    `${appUrl()}/api/decide/${signDecideToken(created.groupId, "approve", signingSecret())}`,
    `${appUrl()}/api/decide/${signDecideToken(created.groupId, "deny", signingSecret())}`,
  );
  const emailRes = await trySendEmail(adminEmail(), msg);
  const emailQueued = emailRes.ok;

  return NextResponse.json({
    ok: true,
    id: created.ids[0],
    roomCount: created.ids.length,
    cancelUrl: `${appUrl()}/api/cancel/${created.cancelToken}`,
    emailQueued,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
