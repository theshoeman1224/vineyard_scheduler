import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprint } from "@/db/schema";
import { blueprintVersion } from "@/lib/blueprint";

// The blueprint is a singleton row (id = 1) holding the uploaded
// floorplan image as base64. Its version (see lib/blueprint.ts) comes from
// updated_at, so it can be read without loading the image data.

export async function getBlueprintRow() {
  const db = getDb();
  const rows = await db.select().from(blueprint).where(eq(blueprint.id, 1));
  return rows[0] ?? null;
}

export async function getBlueprintVersion(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ updatedAt: blueprint.updatedAt })
    .from(blueprint)
    .where(eq(blueprint.id, 1));
  return rows[0] ? blueprintVersion(rows[0].updatedAt) : null;
}

// Returns the new version so the uploader can show the new image at once.
export async function saveBlueprint(mimeType: string, dataBase64: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(blueprint)
    .values({ id: 1, mimeType, dataBase64 })
    .onConflictDoUpdate({
      target: blueprint.id,
      set: { mimeType, dataBase64, updatedAt: new Date() },
    })
    .returning({ updatedAt: blueprint.updatedAt });
  return blueprintVersion(row.updatedAt);
}
