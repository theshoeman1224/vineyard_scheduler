import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail, trySendEmail } from "@/lib/mailer";
import type { EmailMessage } from "@/lib/emails";

// Resend client stub: success by default, and a `boom` failure mode that
// the trySendEmail contract must survive.
const h = vi.hoisted(() => ({
  sendImpl: async (): Promise<{
    data: unknown;
    error: { message: string } | null;
  }> => ({ data: {}, error: null }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.sendImpl };
  },
}));

const msg: EmailMessage = { subject: "Hi", html: "<p>hi</p>", text: "hi" };

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  h.sendImpl = async () => ({ data: {}, error: null });
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("sendEmail", () => {
  it("returns not-okay without an API key, without throwing", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await sendEmail("a@b.co", msg);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("RESEND_API_KEY not set");
  });

  it("returns ok on a successful send", async () => {
    const res = await sendEmail("a@b.co", msg);
    expect(res.ok).toBe(true);
  });

  it("surfaces the provider error message", async () => {
    h.sendImpl = async () => ({ data: null, error: { message: "invalid from" } });
    const res = await sendEmail("a@b.co", msg);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid from");
  });
});

describe("trySendEmail", () => {
  it("never throws even when the mail client itself blows up", async () => {
    h.sendImpl = async () => {
      throw new Error("boom");
    };
    const res = await trySendEmail("a@b.co", msg);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("boom");
  });

  it("passes successful sends through", async () => {
    const res = await trySendEmail("a@b.co", msg);
    expect(res.ok).toBe(true);
  });
});
