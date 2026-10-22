import { describe, expect, it } from "vitest";
import { decisionPage } from "@/app/lib/decisionPage";
import { COLOR_AMBER, COLOR_GREEN, COLOR_RED } from "@/app/lib/tokenPage";

describe("decisionPage", () => {
  it("reports a fully applied approval in green", () => {
    const p = decisionPage("approve", [{ roomName: "Loft", ok: true }], true);
    expect(p.title).toBe("Request approved");
    expect(p.headingColor).toBe(COLOR_GREEN);
    expect(p.body).toContain("1 room approved");
    expect(p.body).toContain("has been notified");
  });

  it("reports a full denial in red", () => {
    const p = decisionPage("deny", [{ roomName: "A", ok: true }, { roomName: "B", ok: true }], true);
    expect(p.title).toBe("Request denied");
    expect(p.headingColor).toBe(COLOR_RED);
    expect(p.body).toContain("2 rooms denied");
  });

  it("reports a partial decision in amber with each failure's reason", () => {
    const p = decisionPage(
      "approve",
      [
        { roomName: "Loft", ok: true },
        { roomName: "Den", ok: false, error: "No beds left in Den on 2026-12-01" },
      ],
      true,
    );
    expect(p.title).toBe("Partly approved");
    expect(p.headingColor).toBe(COLOR_AMBER);
    expect(p.body).toContain("No beds left in Den on 2026-12-01");
  });

  it("says nothing was sent when the click changed nothing", () => {
    const p = decisionPage("approve", [{ roomName: "Loft", ok: false, error: "Already denied" }], false);
    expect(p.title).toBe("Could not apply decision");
    expect(p.body).toContain("no email was sent");
  });

  it("escapes room names and errors", () => {
    const p = decisionPage("deny", [{ roomName: "<b>x</b>", ok: false, error: "<i>" }], false);
    expect(p.body).not.toContain("<b>x</b>");
    expect(p.body).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(p.body).toContain("&lt;i&gt;");
  });
});
