import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// The row drizzle's migrator writes to drizzle.__drizzle_migrations for
// the first (baseline) migration. Mirrors drizzle-orm's readMigrationFiles
// exactly — sha256 of the SQL file's text, created_at = the journal's
// "when" — because the migrator decides what to run by comparing the
// latest created_at, so any mismatch would re-run the baseline.
export function baselineRecord(folder = path.join(process.cwd(), "drizzle")): {
  tag: string;
  hash: string;
  createdAt: number;
} {
  const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const first = journal.entries[0];
  if (!first) throw new Error("drizzle/meta/_journal.json has no migrations");
  const query = fs.readFileSync(path.join(folder, `${first.tag}.sql`)).toString();
  return {
    tag: first.tag,
    hash: crypto.createHash("sha256").update(query).digest("hex"),
    createdAt: first.when,
  };
}
