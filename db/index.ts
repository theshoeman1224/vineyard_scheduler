import {
  getCloudflareContext,
  type CloudflareContext,
} from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { shouldRetirePool } from "./poolRetirement";

type Ctx = CloudflareContext["ctx"];

// The Workers runtime reaps outbound sockets when a request finishes, and pg
// can't detect a dead socket — queries awaiting one hang until the runtime
// cancels the request. So on Cloudflare each request gets its own pool
// (keyed on its ExecutionContext) and never reuses another request's.
//
// One isolate serves overlapping requests, so a pool is not closed when a
// newer request arrives (its request may still be mid-query). Instead,
// whenever a new pool is created, older pools are retired once
// shouldRetirePool says they are idle (see db/poolRetirement.ts). Closing
// them only frees the pool objects; their sockets are already gone.
//
// In plain Node (dev/tests) a single module-level pool is safe and kept.

// Guards so a reaped socket fails fast instead of hanging the worker until
// the runtime cancels the request.
const CONNECT_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 10_000;
// pool.end() waits for checked-out clients; a stuck one never returns.
const POOL_END_WAIT_MS = 5_000;

let nodePool: Pool | null = null;

type PoolEntry = { pool: Pool; lastUsedAt: number };
const cfPools = new Map<Ctx, PoolEntry>();

function newPool(url: string): Pool {
  return new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
}

function retireIdlePools(ctx: Ctx, now: number) {
  for (const [key, entry] of cfPools) {
    const busy = entry.pool.totalCount > entry.pool.idleCount || entry.pool.waitingCount > 0;
    if (!shouldRetirePool({ lastUsedAt: entry.lastUsedAt, busy }, now)) continue;
    cfPools.delete(key);
    ctx.waitUntil(
      Promise.race([
        entry.pool.end().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, POOL_END_WAIT_MS)),
      ]),
    );
  }
}

export function getDb() {
  let cf: CloudflareContext | undefined;
  try {
    cf = getCloudflareContext();
  } catch {
    // Not running in a worker (next dev / vitest): use the long-lived pool.
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!cf) {
    nodePool ??= newPool(url);
    return drizzle(nodePool, { schema });
  }

  const now = Date.now();
  let entry = cfPools.get(cf.ctx);
  if (!entry) {
    retireIdlePools(cf.ctx, now);
    entry = { pool: newPool(url), lastUsedAt: now };
    cfPools.set(cf.ctx, entry);
  }
  entry.lastUsedAt = now;
  return drizzle(entry.pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
