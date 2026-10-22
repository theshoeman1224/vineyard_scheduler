import { NextResponse } from "next/server";
import { getAvailabilityRange, getRooms } from "@/lib/data";
import { availabilityRangeError, availabilityWindow } from "@/lib/availability";

// Public availability for a date range. Defaults to the same window the
// home page loads, and rejects ranges longer than that window.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const defaults = availabilityWindow();
  const start = url.searchParams.get("start") ?? defaults.start;
  const end = url.searchParams.get("end") ?? defaults.end;

  const error = availabilityRangeError(start, end);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
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
