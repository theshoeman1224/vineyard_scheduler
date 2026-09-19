// Shared room text used by room pickers, tables, selects, and blueprint
// titles. Keeps the "1 bed" / "2 beds" pluralization in one place.

// "1 bed" / "2 beds".
export function bedsLabel(beds: number): string {
  return `${beds} bed${beds === 1 ? "" : "s"}`;
}

// "Loft (2 beds)" — the canonical label for selects, chips, and titles.
export function roomLabel(room: { name: string; beds: number }): string {
  return `${room.name} (${bedsLabel(room.beds)})`;
}
