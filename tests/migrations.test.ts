import path from "node:path";
import { describe, expect, it } from "vitest";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { baselineRecord } from "@/scripts/migrations";

// Reads the committed migration files (no database). If drizzle ever
// changes how it hashes migrations, db:baseline must change with it, or
// db:migrate would try to re-create tables on baselined databases.
describe("baselineRecord", () => {
  it("matches what drizzle's migrator records for the first migration", () => {
    const folder = path.join(__dirname, "..", "drizzle");
    const [first] = readMigrationFiles({ migrationsFolder: folder });
    const record = baselineRecord(folder);
    expect(record.tag).toBe("0000_baseline");
    expect(record.hash).toBe(first.hash);
    expect(record.createdAt).toBe(first.folderMillis);
  });
});
