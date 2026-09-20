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

// Folds bookings into the map: confirmed bookings consume a bed and
// shrink `free`; pending bookings only bump the pending counter.
// Bookings for dates or rooms outside the map are ignored.
function applyBookings(
  avail: AvailabilityMap,
  bookings: BookingInfo[],
): void {
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
}

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

  applyBookings(avail, bookings);

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

export type RoomDateStatus =
  | "free"
  | "limited"
  | "limited-requested"
  | "requested"
  | "partial"
  | "full"
  | "idle";

// Marker state for ONE room across the selected dates, using the same
// priority as the calendar (full > limited-requested > limited >
// requested):
// - "full": some selected date has no free bed in this room
// - "limited": every selected date still has a free bed, and a confirmed
//   booking touches this room (partially taken)
// - "limited-requested": same as limited, but a pending request also
//   touches this room
// - "requested": every selected date still has a free bed, and a pending
//   request (with no confirmed booking yet) touches this room
// - "partial": some but not all selected dates are bookable
// - "free": every selected date has a free bed and nothing touches it
// - "idle": no dates selected, so there is nothing to mark
export function roomDateStatus(
  avail: AvailabilityMap,
  roomId: number,
  dates: string[],
): RoomDateStatus {
  if (dates.length === 0) return "idle";
  let bookable = 0;
  let confirmed = false;
  let pending = false;
  for (const date of dates) {
    const slot = avail[date]?.[roomId];
    if (!slot) continue;
    if (slot.free > 0) bookable += 1;
    if (slot.confirmed > 0) confirmed = true;
    if (slot.pending > 0) pending = true;
  }
  if (bookable === 0) return "full";
  if (bookable < dates.length) return "partial";
  if (confirmed && pending) return "limited-requested";
  if (confirmed) return "limited";
  if (pending) return "requested";
  return "free";
}

export type DayStatus =
  | "limited"
  | "limited-requested"
  | "full"
  | "requested";

// Calendar-day status for a SET of rooms (the user's selection).
// - With selected rooms, only those rooms' bookings count — a pending
//   request for the Lounge must not mark a day for someone looking at the
//   Guest Room.
// - With an empty selection this is an all-rooms overview.
// Priority on the calendar: "full" (every selected room is booked out) >
// "limited" (a confirmed booking exists but free beds remain) >
// "requested" (only pending requests exist). "limited-requested" is the
// limited case with a pending request on top.
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
    else if (confirmed > 0 && pending > 0) map.set(date, "limited-requested");
    else if (confirmed > 0) map.set(date, "limited");
    else if (pending > 0) map.set(date, "requested");
  }

  return map;
}
