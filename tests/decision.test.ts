import { describe, expect, it } from "vitest";
import {
  planGroupDecision,
  planRowDecision,
  shouldNotifyRequester,
  type GroupRow,
} from "@/lib/data/decision";

describe("planRowDecision", () => {
  it("approves or denies pending rows", () => {
    expect(planRowDecision("pending", "approve")).toEqual({ kind: "approve" });
    expect(planRowDecision("pending", "deny")).toEqual({ kind: "deny" });
  });

  it("leaves rows already in the requested state unchanged", () => {
    expect(planRowDecision("confirmed", "approve")).toEqual({ kind: "unchanged" });
    expect(planRowDecision("denied", "deny")).toEqual({ kind: "unchanged" });
  });

  it("reports a conflict instead of flipping an already-decided row", () => {
    const approveDenied = planRowDecision("denied", "approve");
    expect(approveDenied.kind).toBe("conflict");
    if (approveDenied.kind === "conflict") {
      expect(approveDenied.error).toContain("Already denied");
    }
    const denyConfirmed = planRowDecision("confirmed", "deny");
    expect(denyConfirmed.kind).toBe("conflict");
    if (denyConfirmed.kind === "conflict") {
      expect(denyConfirmed.error).toContain("Already confirmed");
    }
  });
});

describe("shouldNotifyRequester", () => {
  it("is true when any row changed", () => {
    expect(shouldNotifyRequester([{ changed: false }, { changed: true }])).toBe(true);
  });

  it("is false when the click changed nothing (e.g. a re-clicked link)", () => {
    expect(shouldNotifyRequester([{ changed: false }, { changed: false }])).toBe(false);
    expect(shouldNotifyRequester([])).toBe(false);
  });
});

describe("planGroupDecision", () => {
  const row = (over: Partial<GroupRow>): GroupRow => ({
    id: 1,
    roomId: 10,
    roomName: "Loft",
    status: "pending",
    beds: 2,
    dates: ["2026-12-01"],
    ...over,
  });
  const none = new Map<number, Map<string, number>>();

  it("approves pending rows that fit", () => {
    const res = planGroupDecision([row({ id: 1 }), row({ id: 2, roomId: 11, roomName: "Den" })], "approve", none);
    expect(res.map((r) => [r.status, r.changed])).toEqual([
      ["confirmed", true],
      ["confirmed", true],
    ]);
  });

  it("keeps a row pending when other groups already fill a night", () => {
    const others = new Map([[10, new Map([["2026-12-01", 2]])]]);
    const [r] = planGroupDecision([row({})], "approve", others);
    expect(r).toMatchObject({ ok: false, changed: false, status: "pending" });
    expect(r.error).toBe("No beds left in Loft on 2026-12-01");
  });

  it("counts rows approved earlier in the same plan (same room twice)", () => {
    const res = planGroupDecision(
      [row({ id: 1, beds: 1 }), row({ id: 2, beds: 1 })],
      "approve",
      none,
    );
    expect(res.map((r) => r.status)).toEqual(["confirmed", "pending"]);
  });

  it("counts the group's already-confirmed rows against later rows", () => {
    const res = planGroupDecision(
      [row({ id: 1, beds: 1, status: "confirmed" }), row({ id: 2, beds: 1 })],
      "approve",
      none,
    );
    expect(res[0]).toMatchObject({ ok: true, changed: false });
    expect(res[1]).toMatchObject({ ok: false, status: "pending" });
  });

  it("denies pending rows and reports already-decided ones as conflicts", () => {
    const res = planGroupDecision(
      [row({ id: 1 }), row({ id: 2, status: "confirmed" }), row({ id: 3, status: "denied" })],
      "deny",
      none,
    );
    expect(res.map((r) => [r.status, r.ok, r.changed])).toEqual([
      ["denied", true, true],
      ["confirmed", false, false],
      ["denied", true, false],
    ]);
  });

  it("does not mutate the caller's counts", () => {
    const others = new Map([[10, new Map([["2026-12-01", 1]])]]);
    planGroupDecision([row({})], "approve", others);
    expect(others.get(10)?.get("2026-12-01")).toBe(1);
  });
});
