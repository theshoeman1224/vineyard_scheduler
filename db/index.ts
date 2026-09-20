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
// request (keyed on the request's ExecutionContext) and close it via
// waitUntil right after the response. In plain Node (dev/tests) a single
// module-level pool is safe and kept as-is.

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
      nodePool = new Pool({ connectionString: url, max: 5 });
    }
    return drizzle(nodePool, { schema });
  }

  if (cfCache && cfCache.ctx === cf.ctx) {
    return drizzle(cfCache.pool, { schema });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  const cache = { ctx: cf.ctx, pool };
  cfCache = cache;
  // Give in-flight queries a moment, then close every connection so the
  // next request starts with a fresh, known-good pool.
  cf.ctx.waitUntil(
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await pool.end().catch(() => {});
      if (cfCache?.ctx === cache.ctx) {
        cfCache = null;
      }
    })(),
  );

  return drizzle(cache.pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
