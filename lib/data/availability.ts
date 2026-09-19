import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { requestDates, requests, type RequestStatus } from "@/db/schema";
import {
  computeAvailability,
  type AvailabilityMap,
  type RoomInfo,
} from "@/lib/availability";
import { dateRange } from "@/lib/dates";
import { getRooms } from "./rooms";

// Returns bookings (pending/confirmed) that touch any of the given dates.
async function getBookingsForDates(dates: string[]) {
  const db = getDb();
  if (dates.length === 0) return [];
  const rows = await db
    .select({
      requestId: requests.id,
      roomId: requests.roomId,
      status: requests.status,
      date: requestDates.date,
    })
    .from(requestDates)
    .innerJoin(requests, eq(requests.id, requestDates.requestId))
    .where(
      and(
        inArray(requestDates.date, dates),
        inArray(requests.status, ["pending", "confirmed"]),
      ),
    );

  const grouped = new Map<number, { roomId: number; status: RequestStatus; dates: string[] }>();
  for (const row of rows) {
    let b = grouped.get(row.requestId);
    if (!b) {
      b = { roomId: row.roomId, status: row.status, dates: [] };
      grouped.set(row.requestId, b);
    }
    b.dates.push(row.date);
  }
  return [...grouped.values()];
}

// Adapts booking rows to the BookingInfo shape computeAvailability wants.
export function availabilityFromBookings(
  roomList: RoomInfo[],
  bookings: { roomId: number; status: RequestStatus; dates: string[] }[],
  dates: string[],
): AvailabilityMap {
  return computeAvailability(
    roomList,
    bookings.map((b) => ({
      roomId: b.roomId,
      status: b.status === "confirmed" ? ("confirmed" as const) : ("pending" as const),
      dates: b.dates,
    })),
    dates,
  );
}

export async function getAvailabilityRange(
  start: string,
  end: string,
): Promise<AvailabilityMap> {
  const roomList = await getRooms();
  const dates = dateRange(start, end);
  if (dates.length === 0) return {};
  const bookings = await getBookingsForDates(dates);
  return availabilityFromBookings(roomList, bookings, dates);
}
