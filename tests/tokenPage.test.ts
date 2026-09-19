import { describe, expect, it } from "vitest";
import { roomSummaryList, tokenPage } from "@/app/lib/tokenPage";

async function text(res: Response): Promise<string> {
  return await res.text();
}

describe("tokenPage", () => {
  it("returns an HTML response with title, body, and colored heading", async () => {
    const res = tokenPage("All good", "<p>done</p>", "#16a34a");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await text(res);
    expect(html).toContain("<title>All good</title>");
    expect(html).toContain('<h1 style="color:#16a34a">All good</h1>');
    expect(html).toContain("<p>done</p>");
    expect(html).toContain("Back to scheduler");
  });

  it("omits the color style when no heading color is given", async () => {
    const html = await text(tokenPage("Confirm", "<p>body</p>"));
    expect(html).toContain("<h1>Confirm</h1>");
    expect(html).not.toContain('<h1 style=');
  });

  it("shares one stylesheet across pages", async () => {
    const a = await text(tokenPage("A", ""));
    const b = await text(tokenPage("B", ""));
    const styleA = a.slice(a.indexOf("<style>"), a.indexOf("</style>"));
    const styleB = b.slice(b.indexOf("<style>"), b.indexOf("</style>"));
    expect(styleA).toBe(styleB);
  });
});

describe("roomSummaryList", () => {
  it("formats each room with its status and human-readable dates", () => {
    const html = roomSummaryList([
      { roomName: "Loft", status: "confirmed", dates: ["2026-01-01", "2026-01-02"] },
      { roomName: "Bunk", status: "pending", dates: ["2026-02-01"] },
    ]);
    expect(html).toContain("<strong>Loft</strong> (confirmed)");
    expect(html).toContain("Thu, Jan 1, 2026");
    expect(html).toContain("Fri, Jan 2, 2026");
    expect(html).toContain("<strong>Bunk</strong> (pending)");
    expect(html).toContain("Sun, Feb 1, 2026");
    expect(html).toContain("<br/><br/><strong>Bunk</strong>");
  });

  it("renders nothing for an empty group", () => {
    expect(roomSummaryList([])).toBe("");
  });
});
