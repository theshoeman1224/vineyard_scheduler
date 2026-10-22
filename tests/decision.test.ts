import { describe, expect, it } from "vitest";
import { planRowDecision, shouldNotifyRequester } from "@/lib/data/decision";

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
