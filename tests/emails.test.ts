import { describe, expect, it } from "vitest";
import {
  adminNewRequestEmail,
  decisionEmail,
  groupDecisionEmail,
  requestCancelledByUserEmail,
  requestEditedEmail,
} from "@/lib/emails";

const req = {
  requestId: 12,
  name: "Josh",
  email: "josh@example.com",
  rooms: ["Bunk Room", "Loft"],
  dates: ["2026-07-01", "2026-07-03"],
  note: "arriving late",
};

describe("adminNewRequestEmail", () => {
  const msg = adminNewRequestEmail(
    req,
    "https://example.com/token/decide/APPROVE",
    "https://example.com/token/decide/DENY",
  );

  it("has a descriptive subject", () => {
    expect(msg.subject).toContain("Josh");
    expect(msg.subject).toContain("2 rooms");
  });

  it("includes request details", () => {
    expect(msg.html).toContain("Josh");
    expect(msg.html).toContain("Bunk Room");
    expect(msg.html).toContain("Loft");
    expect(msg.html).toContain("Jul 1, 2026");
    expect(msg.html).toContain("arriving late");
    expect(msg.text).toContain("2026-07-01");
  });

  it("includes both action links", () => {
    expect(msg.html).toContain("https://example.com/token/decide/APPROVE");
    expect(msg.html).toContain("https://example.com/token/decide/DENY");
    expect(msg.text).toContain("Approve all: https://example.com/token/decide/APPROVE");
    expect(msg.text).toContain("Deny all: https://example.com/token/decide/DENY");
  });

  it("escapes user input", () => {
    const evil = adminNewRequestEmail(
      { ...req, name: '<script>alert("x")</script>' },
      "https://a",
      "https://b",
    );
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });
});

describe("decisionEmail", () => {
  it("says approved when confirmed", () => {
    const msg = decisionEmail(req, "confirmed");
    expect(msg.subject).toContain("approved");
    expect(msg.html).toContain("approved");
  });

  it("says denied when denied", () => {
    const msg = decisionEmail(req, "denied");
    expect(msg.subject).toContain("denied");
  });
});

describe("requestEditedEmail", () => {
  it("mentions the new status", () => {
    const msg = requestEditedEmail(req, "confirmed");
    expect(msg.html).toContain("confirmed");
    expect(msg.subject).toContain("updated");
  });
});

describe("requestCancelledByUserEmail", () => {
  it("tells the admin who withdrew", () => {
    const msg = requestCancelledByUserEmail(req);
    expect(msg.subject).toContain("Josh");
    expect(msg.html).toContain("withdrew");
    expect(msg.html).toContain("Bunk Room");
    expect(msg.html).toContain("Loft");
  });
});

describe("groupDecisionEmail", () => {
  it("summarizes approved rooms and capacity failures", () => {
    const msg = groupDecisionEmail(req, [
      { roomName: "Bunk Room", ok: true },
      { roomName: "Loft", ok: false, error: "No beds left in Loft on Jul 1" },
    ]);
    expect(msg.subject).toContain("1 of 2");
    expect(msg.html).toContain("Bunk Room");
    expect(msg.html).toContain("No beds left in Loft on Jul 1");
    expect(msg.text).toContain("Approved: Bunk Room");
  });

  it("handles all-approved", () => {
    const msg = groupDecisionEmail(req, [
      { roomName: "Bunk Room", ok: true },
      { roomName: "Loft", ok: true },
    ]);
    expect(msg.subject).toContain("2 of 2");
    expect(msg.html).toContain("Loft");
  });
});
