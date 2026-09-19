import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getRooms, upsertRoom } from "@/lib/data";
import { roomUpsertSchema } from "@/lib/validation";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ rooms: await getRooms() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = roomUpsertSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }
  await upsertRoom(parsed.data);
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
