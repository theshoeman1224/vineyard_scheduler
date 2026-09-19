import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprint } from "@/db/schema";

// The blueprint is a singleton row (id = 1) holding the uploaded
// floorplan image as base64.
export async function getBlueprintRow() {
  const db = getDb();
  const rows = await db.select().from(blueprint).where(eq(blueprint.id, 1));
  return rows[0] ?? null;
}

export async function saveBlueprint(mimeType: string, dataBase64: string) {
  const db = getDb();
  await db
    .insert(blueprint)
    .values({ id: 1, mimeType, dataBase64 })
    .onConflictDoUpdate({
      target: blueprint.id,
      set: { mimeType, dataBase64, updatedAt: new Date() },
    });
}
