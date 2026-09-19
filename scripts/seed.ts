// Seed script: creates a starter set of rooms (idempotent by name).
// Usage: DATABASE_URL=postgres://... npm run seed
import { getDb } from "@/db";
import { rooms } from "@/db/schema";

const DEFAULT_ROOMS = [
  { name: "Bunk Room", beds: 4, displayOrder: 0 },
  { name: "Master Bedroom", beds: 2, displayOrder: 1 },
  { name: "Loft", beds: 2, displayOrder: 2 },
  { name: "Guest Room", beds: 1, displayOrder: 3 },
];

async function main() {
  const db = getDb();
  const existing = await db.select({ name: rooms.name }).from(rooms);
  const names = new Set(existing.map((r) => r.name));
  const toInsert = DEFAULT_ROOMS.filter((r) => !names.has(r.name));
  if (toInsert.length === 0) {
    console.log("Rooms already seeded — nothing to do.");
    return;
  }
  await db.insert(rooms).values(toInsert);
  console.log(`Seeded ${toInsert.length} room(s): ${toInsert.map((r) => r.name).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
