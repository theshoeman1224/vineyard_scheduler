import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requests, rooms, type Room } from "@/db/schema";
import type { RoomInfo } from "@/lib/availability";

// Maps a rooms table row to the RoomInfo shape used across the app.
export function toRoomInfo(r: Room): RoomInfo {
  return {
    id: r.id,
    name: r.name,
    beds: r.beds,
    displayOrder: r.displayOrder,
    hotspotX: r.hotspotX,
    hotspotY: r.hotspotY,
    hotspotW: r.hotspotW,
    hotspotH: r.hotspotH,
  };
}

export async function getRooms(): Promise<RoomInfo[]> {
  const db = getDb();
  const rows = await db.select().from(rooms).orderBy(asc(rooms.displayOrder), asc(rooms.id));
  return rows.map(toRoomInfo);
}

export async function upsertRoom(input: {
  id?: number;
  name: string;
  beds: number;
  displayOrder: number;
  hotspotX?: number | null;
  hotspotY?: number | null;
  hotspotW?: number | null;
  hotspotH?: number | null;
}): Promise<void> {
  const db = getDb();
  const values = {
    name: input.name,
    beds: input.beds,
    displayOrder: input.displayOrder,
    hotspotX: input.hotspotX ?? null,
    hotspotY: input.hotspotY ?? null,
    hotspotW: input.hotspotW ?? null,
    hotspotH: input.hotspotH ?? null,
  };
  if (input.id) {
    await db.update(rooms).set(values).where(eq(rooms.id, input.id));
  } else {
    await db.insert(rooms).values(values);
  }
}

// Deleting a room with any request history would orphan those rows, so
// the caller gets a 409 with this message instead.
export async function deleteRoom(roomId: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const used = await db
    .select({ id: requests.id })
    .from(requests)
    .where(eq(requests.roomId, roomId))
    .limit(1);
  if (used[0]) {
    return { ok: false, error: "Room has requests — remove or reassign them first." };
  }
  await db.delete(rooms).where(eq(rooms.id, roomId));
  return { ok: true };
}
