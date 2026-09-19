import { NextResponse } from "next/server";
import { getAvailabilityRange, getRooms } from "@/lib/data";
import { addDaysStr, isValidDateStr, todayStr } from "@/lib/dates";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? todayStr();
  const end = url.searchParams.get("end") ?? addDaysStr(todayStr(), 120);

  if (!isValidDateStr(start) || !isValidDateStr(end)) {
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
