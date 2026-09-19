import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { deleteRoom } from "@/lib/data";

// DELETE /api/admin/rooms/[id] — same path-param shape as
// /api/admin/requests/[id], so both admin DELETEs work alike.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const roomId = Number((await ctx.params).id);
  if (!Number.isInteger(roomId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const result = await deleteRoom(roomId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
