// In-memory fixed-window rate limiter for cheap per-IP throttling of the
// public write endpoints (login, request submission). One process-level
// bucket map; on Cloudflare Workers the state lives per isolate, so limits
// are approximate under load — this is a first line of defense, not a
// replacement for edge-level throttling (Cloudflare WAF rules).

type Bucket = { count: number; resetAt: number };

// Cap the map so a spoofed-IP flood cannot grow it without bound; expired
// buckets are swept whenever the cap is hit.
const MAX_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size >= MAX_KEYS) sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// Test helper — between windows state must not leak across cases.
export function resetRateLimits(): void {
  buckets.clear();
}

// Best-effort client IP. Cloudflare sets CF-Connecting-IP; plain Node dev
// falls back to the first X-Forwarded-For hop. A spoofable header only
// fragments the buckets (per-spoofed-IP limits), it cannot bypass them all.
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
