import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requests, rooms, type Room } from "@/db/schema";
import type { RoomInfo } from "@/lib/availability";
import { earliestBookableDate } from "@/lib/dates";
import { roomWriteValues, type RoomUpsertInput } from "./roomValues";
import { confirmedCountsFrom, firstOverbookedNight } from "./capacity";
import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
  type WriteResult,
} from "./errors";

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

// Creates or updates a room. Omitted hotspot fields are left as they are
// (see roomWriteValues). Expected failures come back as a WriteResult:
// a duplicate name (unique constraint) is a 409, an unknown id a 404.
//
// An update locks the room row before counting its confirmed bookings —
// the same lock approvals take — so a bed reduction and a concurrent
// approval serialize. Lowering beds below the confirmed bookings on any
// upcoming night is refused (409) rather than leaving the room overbooked.
export async function upsertRoom(input: RoomUpsertInput): Promise<WriteResult> {
  const db = getDb();
  const values = roomWriteValues(input);
  try {
    if (!input.id) {
      await db.insert(rooms).values(values);
      return { ok: true };
    }
    const id = input.id;
    return await db.transaction(async (tx): Promise<WriteResult> => {
      const current = await tx
        .select({ beds: rooms.beds })
        .from(rooms)
        .where(eq(rooms.id, id))
        .for("update");
      if (!current[0]) return { ok: false, status: 404, error: "Room not found" };

      if (input.beds < current[0].beds) {
        const counts = await confirmedCountsFrom(tx, id, earliestBookableDate());
        const over = firstOverbookedNight(counts, input.beds);
        if (over) {
          return {
            ok: false,
            status: 409,
            error: `${over.date} has ${over.count} confirmed bookings in this room, so it needs at least ${over.count} beds. Move or deny some bookings first.`,
          };
        }
      }
      await tx.update(rooms).set(values).where(eq(rooms.id, id));
      return { ok: true };
    });
  } catch (e) {
    if (pgErrorCode(e) === PG_UNIQUE_VIOLATION) {
      return { ok: false, status: 409, error: `A room named “${input.name}” already exists.` };
    }
    throw e;
  }
}

const ROOM_IN_USE = "Room has requests — remove or reassign them first.";

// Deleting a room with any request history would orphan those rows, so
// the caller gets a 409 instead. The pre-check gives the friendly message
// in the common case; the foreign key catches a request created between
// the check and the delete, and maps to the same 409.
export async function deleteRoom(roomId: number): Promise<WriteResult> {
  const db = getDb();
  const used = await db
    .select({ id: requests.id })
    .from(requests)
    .where(eq(requests.roomId, roomId))
    .limit(1);
  if (used[0]) {
    return { ok: false, status: 409, error: ROOM_IN_USE };
  }
  try {
    const deleted = await db
      .delete(rooms)
      .where(eq(rooms.id, roomId))
      .returning({ id: rooms.id });
    if (deleted.length === 0) {
      return { ok: false, status: 404, error: "Room not found" };
    }
  } catch (e) {
    if (pgErrorCode(e) === PG_FOREIGN_KEY_VIOLATION) {
      return { ok: false, status: 409, error: ROOM_IN_USE };
    }
    throw e;
  }
  return { ok: true };
}
