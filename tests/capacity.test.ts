import { describe, expect, it } from "vitest";
import { firstFullDate, firstOverbookedNight } from "@/lib/data/capacity";

describe("firstFullDate", () => {
  it("returns null when no date has reached capacity", () => {
    const conflicts = new Map([["2026-01-01", 1]]);
    expect(firstFullDate(["2026-01-01"], conflicts, 2)).toBeNull();
  });

  it("returns the first date at full capacity (used == beds is full)", () => {
    const conflicts = new Map([
      ["2026-01-01", 1],
      ["2026-01-02", 2],
    ]);
    expect(firstFullDate(["2026-01-01", "2026-01-02"], conflicts, 2)).toBe("2026-01-02");
  });

  it("returns the first full date in request order, not map order", () => {
    const conflicts = new Map([
      ["2026-01-03", 2],
      ["2026-01-01", 0],
    ]);
    expect(firstFullDate(["2026-01-01", "2026-01-03"], conflicts, 2)).toBe("2026-01-03");
  });

  it("treats a room with zero beds as full on any requested date", () => {
    expect(firstFullDate(["2026-01-01"], new Map(), 0)).toBe("2026-01-01");
  });

  it("returns null for an empty date list", () => {
    expect(firstFullDate([], new Map([["2026-01-01", 5]]), 1)).toBeNull();
  });
});

describe("firstOverbookedNight", () => {
  const counts = new Map([
    ["2026-12-03", 3],
    ["2026-12-01", 3],
    ["2026-12-02", 1],
  ]);

  it("returns the earliest night with more bookings than beds", () => {
    expect(firstOverbookedNight(counts, 2)).toEqual({ date: "2026-12-01", count: 3 });
  });

  it("allows exactly as many bookings as beds", () => {
    expect(firstOverbookedNight(counts, 3)).toBeNull();
    expect(firstOverbookedNight(new Map(), 0)).toBeNull();
  });
});
