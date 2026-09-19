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

// Dot color for a room across the selected dates, matching the calendar
// legend: green = free, amber = requested or partially bookable, gray =
// no free beds, or nothing selected yet.
export function availabilityDotClass(status: RoomDateStatus): string {
  if (status === "free") return "bg-green-500";
  if (status === "requested" || status === "partial") return "bg-amber-400";
  return "bg-neutral-300 dark:bg-neutral-600";
}

// Hotspot background on the blueprint for the same states.
export function hotspotClass(status: RoomDateStatus): string {
  if (status === "free") return "bg-green-500/50";
  if (status === "requested" || status === "partial") return "bg-amber-400/50";
  if (status === "full") return "bg-neutral-400/50";
  return "bg-neutral-800/40"; // idle
}
