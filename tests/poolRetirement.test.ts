import { describe, expect, it } from "vitest";
import {
  POOL_IDLE_RETIRE_MS,
  POOL_STUCK_RETIRE_MS,
  shouldRetirePool,
} from "@/db/poolRetirement";

describe("shouldRetirePool", () => {
  const now = 1_000_000_000;

  it("keeps a recently used pool, even when idle", () => {
    expect(shouldRetirePool({ lastUsedAt: now - 1_000, busy: false }, now)).toBe(false);
  });

  it("retires an idle pool after the idle window", () => {
    expect(shouldRetirePool({ lastUsedAt: now - POOL_IDLE_RETIRE_MS, busy: false }, now)).toBe(true);
  });

  it("never retires a busy pool inside the stuck window (its request may be mid-query)", () => {
    expect(shouldRetirePool({ lastUsedAt: now - POOL_IDLE_RETIRE_MS * 2, busy: true }, now)).toBe(false);
  });

  it("retires a busy pool untouched for the stuck window (reaped socket)", () => {
    expect(shouldRetirePool({ lastUsedAt: now - POOL_STUCK_RETIRE_MS, busy: true }, now)).toBe(true);
  });
});
