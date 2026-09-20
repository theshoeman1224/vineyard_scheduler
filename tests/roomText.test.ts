import { describe, expect, it } from "vitest";
import { availabilityDotClass, detailsHint } from "@/app/lib/roomText";

describe("detailsHint", () => {
  it("points to both steps when nothing is picked", () => {
    expect(detailsHint(false, false)).toBe(
      "Pick dates on the calendar, then choose one or more rooms above.",
    );
  });

  it("points to rooms when only dates are picked", () => {
    expect(detailsHint(true, false)).toBe(
      "No room selected yet — click one or more rooms above (large parties can combine rooms).",
    );
  });

  it("points to dates when only rooms are picked", () => {
    expect(detailsHint(false, true)).toBe(
      "Pick dates on the calendar to complete the request.",
    );
  });

  it("is empty once steps 1 and 2 are done", () => {
    expect(detailsHint(true, true)).toBe("");
  });
});

describe("availabilityDotClass", () => {
  it("matches the calendar legend", () => {
    expect(availabilityDotClass("free")).toBe("bg-green-500");
    expect(availabilityDotClass("limited")).toBe("dot-limited");
    expect(availabilityDotClass("limited-requested")).toBe(
      "dot-limited-amber",
    );
    expect(availabilityDotClass("requested")).toBe("bg-amber-400");
    expect(availabilityDotClass("partial")).toBe("bg-amber-400");
    expect(availabilityDotClass("full")).toBe("bg-red-600");
  });

  it("returns no class for idle, where the caller keeps an invisible slot", () => {
    expect(availabilityDotClass("idle")).toBe("");
  });
});
