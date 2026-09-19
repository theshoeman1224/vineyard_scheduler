// Pure availability computation.
// A confirmed request occupies ONE bed of its room for each of its dates.
// Pending requests do not occupy beds but are surfaced for visibility.

export type RoomInfo = {
  id: number;
  name: string;
  beds: number;
  displayOrder: number;
  hotspotX?: number | null;
  hotspotY?: number | null;
  hotspotW?: number | null;
  hotspotH?: number | null;
};

export type BookingInfo = {
  roomId: number;
  status: "pending" | "confirmed";
  dates: string[];
};

export type RoomDayStatus = {
  beds: number;
  confirmed: number;
  pending: number;
  free: number;
};

// keyed: date -> roomId -> RoomDayStatus
export type AvailabilityMap = Record<string, Record<number, RoomDayStatus>>;

export function computeAvailability(
  rooms: RoomInfo[],
  bookings: BookingInfo[],
  dates: string[],
): AvailabilityMap {
  const avail: AvailabilityMap = {};
  for (const date of dates) {
    const perRoom: Record<number, RoomDayStatus> = {};
    for (const room of rooms) {
      perRoom[room.id] = {
        beds: room.beds,
        confirmed: 0,
        pending: 0,
        free: room.beds,
      };
    }
    avail[date] = perRoom;
  }

  for (const b of bookings) {
    for (const date of b.dates) {
      const perRoom = avail[date];
      if (!perRoom) continue;
      const slot = perRoom[b.roomId];
      if (!slot) continue;
      if (b.status === "confirmed") {
        slot.confirmed += 1;
        slot.free = Math.max(0, slot.beds - slot.confirmed);
      } else {
        slot.pending += 1;
      }
    }
  }

  return avail;
}

// How many of the requested dates have at least one free bed.
export function countBookableDates(
  avail: AvailabilityMap,
  roomId: number,
  dates: string[],
): number {
  return dates.filter((date) => {
    const slot = avail[date]?.[roomId];
    return !!slot && slot.free > 0;
  }).length;
}

export type DayStatus = "booked" | "full" | "requested";

// Calendar-day status for a SET of rooms (the user's selection).
// - With selected rooms, only those rooms' bookings count — a pending
//   request for the Lounge must not mark a day for someone looking at the
//   Guest Room.
// - With an empty selection this is an all-rooms overview.
// Priority on the calendar: "full" (every selected room is booked out) >
// "booked" (any selected room has a confirmed booking) > "requested" (only
// pending requests exist).
export function dayStatuses(
  availability: AvailabilityMap,
  rooms: RoomInfo[],
  roomIds: number[],
): Map<string, DayStatus> {
  const selected =
    roomIds.length === 0
      ? rooms
      : rooms.filter((r) => roomIds.includes(r.id));
  const map = new Map<string, DayStatus>();

  for (const [date, perRoom] of Object.entries(availability)) {
    let confirmed = 0;
    let pending = 0;
    let free = 0;
    let hasSlots = false;
    for (const room of selected) {
      const slot = perRoom?.[room.id];
      if (!slot) continue;
      hasSlots = true;
      confirmed += slot.confirmed;
      pending += slot.pending;
      free += slot.free;
    }
    if (!hasSlots) continue;
    if (free === 0) map.set(date, "full");
    else if (confirmed > 0) map.set(date, "booked");
    else if (pending > 0) map.set(date, "requested");
  }

  return map;
}
