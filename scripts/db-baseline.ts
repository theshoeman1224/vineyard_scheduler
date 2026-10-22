// One-time step for a database created with the old `drizzle-kit push`
// workflow, before migrations were committed. Its tables already match
// drizzle/0000_baseline.sql, so this records that migration as applied;
// `npm run db:migrate` then runs only the migrations after it.
//
// Usage: DATABASE_URL=postgres://... npm run db:baseline && npm run db:migrate
//
// Refuses to run on an empty database (use db:migrate directly) and does
// nothing when migrations are already tracked, so it is safe to re-run.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { baselineRecord } from "./migrations";

async function main() {
  const db = getDb();
  const record = baselineRecord();

  const tracked = await db.execute(
    sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present`,
  );
  if ((tracked.rows[0] as { present: boolean }).present) {
    const rows = await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
    if ((rows.rows[0] as { n: number }).n > 0) {
      console.log("Migrations are already tracked — nothing to do.");
      return;
    }
  }

  const hasTables = await db.execute(
    sql`SELECT to_regclass('public.rooms') IS NOT NULL AS present`,
  );
  if (!(hasTables.rows[0] as { present: boolean }).present) {
    throw new Error("No app tables found. For a new database run `npm run db:migrate` instead.");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`);
    await tx.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${record.hash}, ${record.createdAt})`,
    );
  });
  console.log(`Recorded ${record.tag} as applied. Now run: npm run db:migrate`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
