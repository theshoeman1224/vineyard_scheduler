import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, resetRateLimits } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("a", 3, 1000, 0)).toEqual({ ok: true });
    }
  });

  it("blocks the request over the limit with a retry-after", () => {
    resetRateLimits();
    expect(checkRateLimit("b", 1, 1000, 0)).toEqual({ ok: true });
    expect(checkRateLimit("b", 1, 1000, 100)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
  });

  it("starts a fresh window after the previous expires", () => {
    resetRateLimits();
    expect(checkRateLimit("c", 1, 1000, 0)).toEqual({ ok: true });
    expect(checkRateLimit("c", 1, 1000, 500)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
    expect(checkRateLimit("c", 1, 1000, 1000)).toEqual({ ok: true });
  });

  it("keys buckets independently", () => {
    resetRateLimits();
    expect(checkRateLimit("d1", 1, 1000, 0)).toEqual({ ok: true });
    expect(checkRateLimit("d2", 1, 1000, 0)).toEqual({ ok: true });
  });
});

describe("clientIp", () => {
  it("prefers CF-Connecting-IP", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.7",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("198.51.100.7");
  });

  it("falls back to the first X-Forwarded-For hop", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("returns unknown when no IP headers exist", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
