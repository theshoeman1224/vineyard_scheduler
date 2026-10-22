import type { rooms } from "@/db/schema";

// Pure mapping from a room upsert payload to the columns to write. Kept
// free of database imports so it can be unit-tested.
//
// Hotspot fields are three-state: a number sets the hotspot, `null`
// clears it, and `undefined` (field omitted) leaves it untouched. The
// room edit form sends only name/beds/order, so treating omitted fields
// as null would wipe the room's hotspot on every edit.

export type RoomUpsertInput = {
  id?: number;
  name: string;
  beds: number;
  displayOrder: number;
  hotspotX?: number | null;
  hotspotY?: number | null;
  hotspotW?: number | null;
  hotspotH?: number | null;
};

type RoomColumns = Omit<typeof rooms.$inferInsert, "id">;

const HOTSPOT_KEYS = ["hotspotX", "hotspotY", "hotspotW", "hotspotH"] as const;

export function roomWriteValues(input: RoomUpsertInput): RoomColumns {
  const values: RoomColumns = {
    name: input.name,
    beds: input.beds,
    displayOrder: input.displayOrder,
  };
  for (const key of HOTSPOT_KEYS) {
    if (input[key] !== undefined) values[key] = input[key];
  }
  return values;
}
