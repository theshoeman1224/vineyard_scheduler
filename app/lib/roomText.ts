// Shared room text used by room pickers, tables, selects, and blueprint
// titles. Keeps the "1 bed" / "2 beds" pluralization in one place.

import type { RoomDateStatus } from "@/lib/availability";

// "1 bed" / "2 beds".
export function bedsLabel(beds: number): string {
  return `${beds} bed${beds === 1 ? "" : "s"}`;
}

// "Loft (2 beds)" — the canonical label for selects, chips, and titles.
export function roomLabel(room: { name: string; beds: number }): string {
  return `${room.name} (${bedsLabel(room.beds)})`;
}

// Hint above the room picker, shared by the list and the blueprint so
// the wording of the selection guidance cannot drift apart.
export function roomsSelectedHint(
  selectedCount: number,
  kind: "list" | "map",
): string {
  if (selectedCount > 1) {
    return `${selectedCount} rooms selected — the calendar shows these rooms combined.`;
  }
  if (selectedCount === 1) {
    return "1 room selected — click more rooms to combine them for large parties.";
  }
  return kind === "map"
    ? "Click rooms on the floorplan to select — combine several for large parties."
    : "Click rooms to select — combine several for large parties.";
}

// Guidance under "3. Your details" while the request form is locked. The
// form stays mounted so picking dates doesn't shift layout; this tells
// the guest exactly which step is still missing.
export function detailsHint(
  hasDates: boolean,
  hasRooms: boolean,
): string {
  if (!hasDates && !hasRooms) {
    return "Pick dates on the calendar, then choose one or more rooms above.";
  }
  if (!hasRooms) {
    return "No room selected yet — click one or more rooms above (large parties can combine rooms).";
  }
  if (!hasDates) {
    return "Pick dates on the calendar to complete the request.";
  }
  return "";
}

// Dot color for a room across the selected dates, matching the calendar
// legend: green = free, red ring = limited (booked but beds remain),
// amber = requested or partially bookable, solid red = full. "idle" (no
// dates selected) returns "" — the caller renders the dot slot as an
// invisible placeholder so room names never shift when dots appear.
export function availabilityDotClass(status: RoomDateStatus): string {
  if (status === "free") return "bg-green-500";
  if (status === "limited") return "dot-limited";
  if (status === "limited-requested") return "dot-limited-amber";
  if (status === "requested" || status === "partial") return "bg-amber-400";
  if (status === "full") return "bg-red-600";
  return ""; // idle
}

// Hotspot background on the blueprint, in the calendar's hues at
// blueprint translucency: "full" is a strong red (the calendar's only
// unbookable day) instead of muted gray, and "limited-requested" keeps
// its red-ring-plus-amber composite via .hotspot-limited-requested
// rather than collapsing into the same red as plain "limited".
export function hotspotClass(status: RoomDateStatus): string {
  if (status === "free") return "bg-green-500/50";
  if (status === "limited") return "bg-red-500/30";
  if (status === "limited-requested") return "hotspot-limited-requested";
  if (status === "requested" || status === "partial") return "bg-amber-400/50";
  if (status === "full") return "bg-red-600/50";
  return "bg-neutral-800/40"; // idle
}
