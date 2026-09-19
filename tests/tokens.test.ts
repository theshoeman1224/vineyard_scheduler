import { describe, expect, it } from "vitest";
import {
  checkAdminPassword,
  createAdminSession,
  randomToken,
  signDecideToken,
  verifyAdminSession,
  verifyDecideToken,
  verifyPayload,
  signPayload,
} from "@/lib/tokens";

const SECRET = "test-secret-abc123";

describe("payload signing", () => {
  it("roundtrips", () => {
    const token = signPayload({ hello: "world", n: 42 }, SECRET);
    expect(verifyPayload<{ hello: string; n: number }>(token, SECRET)).toEqual({
      hello: "world",
      n: 42,
    });
  });

  it("rejects a tampered body", () => {
    const token = signPayload({ r: 1, a: "approve" }, SECRET);
    const sig = token.split(".")[1];
    const evil = Buffer.from(
      JSON.stringify({ r: 2, a: "approve" }),
    ).toString("base64url");
    expect(verifyPayload(`${evil}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signPayload({ r: 1, a: "approve" }, SECRET);
    const [body] = token.split(".");
    const fakeSig = Buffer.from("nope").toString("base64url");
    expect(verifyPayload(`${body}.${fakeSig}`, SECRET)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signPayload({ r: 1, a: "approve" }, "other-secret");
    expect(verifyPayload(token, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyPayload("garbage", SECRET)).toBeNull();
    expect(verifyPayload("", SECRET)).toBeNull();
    expect(verifyPayload("a.b.c", SECRET)).toBeNull();
  });
});

describe("decide tokens", () => {
  it("roundtrips approve and deny", () => {
    const t = signDecideToken("group-abc", "approve", SECRET);
    expect(verifyDecideToken(t, SECRET)).toEqual({ g: "group-abc", a: "approve" });
    const d = signDecideToken("group-abc", "deny", SECRET);
    expect(verifyDecideToken(d, SECRET)).toEqual({ g: "group-abc", a: "deny" });
  });

  it("rejects payloads with wrong shape", () => {
    const bad = signPayload({ g: 7, a: "approve" }, SECRET);
    expect(verifyDecideToken(bad, SECRET)).toBeNull();
    const badAction = signPayload({ g: "group-abc", a: "destroy" }, SECRET);
    expect(verifyDecideToken(badAction, SECRET)).toBeNull();
  });
});

describe("randomToken", () => {
  it("is url-safe and unique", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("admin session", () => {
  it("validates a fresh session", () => {
    const s = createAdminSession(SECRET, 1000, 1000);
    expect(verifyAdminSession(s, SECRET, 1500)).toBe(true);
  });

  it("rejects expired sessions", () => {
    const s = createAdminSession(SECRET, 1000, 1000);
    expect(verifyAdminSession(s, SECRET, 2001)).toBe(false);
  });

  it("rejects tampered values", () => {
    const s = createAdminSession(SECRET, 1000, 1000);
    const [exp] = s.split(".");
    expect(verifyAdminSession(`${exp}.aaaa`, SECRET, 1500)).toBe(false);
    expect(verifyAdminSession(`${Number(exp) + 100000}.${s.split(".")[1]}`, SECRET, 1500)).toBe(false);
  });

  it("rejects undefined or garbage", () => {
    expect(verifyAdminSession(undefined, SECRET)).toBe(false);
    expect(verifyAdminSession("garbage", SECRET)).toBe(false);
  });
});

describe("checkAdminPassword", () => {
  it("accepts the right password", () => {
    expect(checkAdminPassword("hunter2", "hunter2", SECRET)).toBe(true);
  });

  it("rejects the wrong password", () => {
    expect(checkAdminPassword("wrong", "hunter2", SECRET)).toBe(false);
  });
});
