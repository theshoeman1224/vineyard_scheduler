import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  deleteRequestAsAdmin,
  getRequestById,
  updateRequestAsAdmin,
  type RequestWithDetails,
} from "@/lib/data";
import { requestEditSchema } from "@/lib/validation";
import { sortUniqueDates } from "@/lib/dates";
import { decisionEmail, requestEditedEmail, type EmailMessage } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

// Parses the [id] path param, returning the 400 response for a malformed
// id, or the numeric id on success.
function parseRequestId(id: string): { id: number } | { error: NextResponse } {
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) {
    return {
      error: NextResponse.json({ error: "Bad id" }, { status: 400 }),
    };
  }
  return { id: requestId };
}

// Notification email after an admin edit: a status change to confirmed or
// denied sends the decision email; everything else (including an edit
// that keeps the request pending) sends the generic edited email.
function editNotificationEmail(
  before: RequestWithDetails,
  after: RequestWithDetails,
): EmailMessage {
  const info = {
    requestId: after.id,
    name: after.name,
    email: after.email,
    rooms: [after.roomName],
    dates: after.dates,
    note: after.note,
  };
  const statusChanged = before.status !== after.status;
  if (statusChanged && after.status !== "pending") {
    return decisionEmail(info, after.status);
  }
  return requestEditedEmail(info, after.status);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsedId = parseRequestId((await ctx.params).id);
  if ("error" in parsedId) return parsedId.error;
  const requestId = parsedId.id;

  const before = await getRequestById(requestId);
  if (!before) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestEditSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const edit = parsed.data;
  const dates = sortUniqueDates(edit.dates);

  let result;
  try {
    result = await updateRequestAsAdmin(requestId, {
      name: edit.name,
      email: edit.email,
      roomId: edit.roomId,
      status: edit.status,
      dates,
      note: edit.note,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // Notify the requester if they provided an email. The DB update already
  // succeeded, so a mailer failure must not fail this response.
  const after = await getRequestById(requestId);
  const toEmail = after?.email ?? before.email;
  if (after && toEmail) {
    await trySendEmail(toEmail, editNotificationEmail(before, after));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsedId = parseRequestId((await ctx.params).id);
  if ("error" in parsedId) return parsedId.error;
  await deleteRequestAsAdmin(parsedId.id);
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
