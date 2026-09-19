import { NextResponse } from "next/server";
import { getAvailabilityRange, getRooms } from "@/lib/data";
import { addDaysStr, todayStr } from "@/lib/dates";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? todayStr();
  const end = url.searchParams.get("end") ?? addDaysStr(todayStr(), 120);

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  if (!dateOk) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const [availability, rooms] = await Promise.all([
    getAvailabilityRange(start, end),
    getRooms(),
  ]);

  return NextResponse.json(
    { start, end, rooms, availability },
    { headers: { "cache-control": "no-store" } },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
