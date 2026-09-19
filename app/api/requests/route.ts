import { NextResponse } from "next/server";
import { createRequestSchema } from "@/lib/validation";
import { createRequest, getRequestsAll, getRooms } from "@/lib/data";
import { sortUniqueDates } from "@/lib/dates";
import { adminNewRequestEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import { adminEmail, appUrl, signingSecret } from "@/lib/env";
import { signDecideToken } from "@/lib/tokens";

export async function GET() {
  const all = await getRequestsAll();
  const publicRows = all.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    roomId: r.roomId,
    roomName: r.roomName,
    status: r.status,
    note: r.note,
    dates: r.dates,
    createdAt: r.createdAt,
  }));
  return NextResponse.json({ requests: publicRows });
}

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
