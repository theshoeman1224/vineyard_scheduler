import {
  getCloudflareContext,
  type CloudflareContext,
} from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Ctx = CloudflareContext["ctx"];

// The Workers runtime reaps outbound sockets when a request finishes, and pg
// can't detect a dead socket — queries awaiting one hang until the runtime
// cancels the request. So on Cloudflare we scope one fresh pool to each
// request (keyed on the request's ExecutionContext). The previous request's
// pool is retired when the next request opens its own — at that point the
// old request has finished, so its connections are idle and closing them
// cannot race in-flight queries. (A fixed close timer cannot: any request
// whose DB work outlives the timer gets its queries killed mid-flight.)
// In plain Node (dev/tests) a single module-level pool is safe and kept
// as-is.

// Guards so a reaped socket fails fast instead of hanging the worker until
// the runtime cancels the request.
const CONNECT_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 10_000;

let nodePool: Pool | null = null;

let cfCache: { ctx: Ctx; pool: Pool } | null = null;

export function getDb() {
  let cf: CloudflareContext | undefined;
  try {
    cf = getCloudflareContext();
  } catch {
    // Not running in a worker (next dev / vitest): use the long-lived pool.
  }

  if (!cf) {
    if (!nodePool) {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error("DATABASE_URL is not set");
      }
      nodePool = new Pool({
        connectionString: url,
        max: 5,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      });
    }
    return drizzle(nodePool, { schema });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (cfCache && cfCache.ctx === cf.ctx) {
    return drizzle(cfCache.pool, { schema });
  }

  const previous = cfCache;
  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  cfCache = { ctx: cf.ctx, pool };
  if (previous) {
    // Retire the previous request's pool with a small grace window in case
    // two requests overlap on this isolate. Its sockets are dead (reaped
    // when its request finished); ending it just frees the pool objects.
    cf.ctx.waitUntil(
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        await previous.pool.end().catch(() => {});
      })(),
    );
  }

  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
