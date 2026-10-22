// When a per-request Postgres pool on Workers may be closed. Pure (no pg
// or Cloudflare imports) so the rule can be unit-tested; db/index.ts
// applies it.
//
// One isolate serves overlapping requests, so a pool cannot be closed just
// because a newer request arrived — its own request may still be running
// queries. A pool is retired only once it has no checked-out clients and
// has not been handed out for POOL_IDLE_RETIRE_MS. A pool that still shows
// a busy client after POOL_STUCK_RETIRE_MS without use is treated as stuck
// on a socket the runtime reaped (pg cannot detect that), and is retired
// too, so it cannot leak for the isolate's lifetime.

export const POOL_IDLE_RETIRE_MS = 30_000;
export const POOL_STUCK_RETIRE_MS = 5 * 60_000;

export type PoolUsage = {
  lastUsedAt: number; // ms timestamp of the last getDb() that returned it
  busy: boolean; // any client checked out or waiting
};

export function shouldRetirePool(usage: PoolUsage, now: number): boolean {
  const idleFor = now - usage.lastUsedAt;
  if (usage.busy) return idleFor >= POOL_STUCK_RETIRE_MS;
  return idleFor >= POOL_IDLE_RETIRE_MS;
}
