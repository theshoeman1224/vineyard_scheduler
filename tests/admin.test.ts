import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminSession, SESSION_TTL_MS } from "@/lib/tokens";
import { requireAdmin, sessionCookieOptions, checkPassword } from "@/lib/admin";

// Test-only cookie jar standing in for next/headers cookies().
const h = vi.hoisted(() => {
  const jar: Record<string, string> = {};
  return {
    jar,
    store: {
      get: (name: string) =>
        name in jar ? { name, value: jar[name] } : undefined,
    },
  };
});
vi.mock("next/headers", () => ({ cookies: async () => h.store }));

const SECRET = "test-secret";

beforeEach(() => {
  process.env.SIGNING_SECRET = SECRET;
  process.env.ADMIN_PASSWORD = "letmein";
  h.jar["admin_session"] = createAdminSession(SECRET);
});

afterEach(() => {
  delete process.env.SIGNING_SECRET;
  delete process.env.ADMIN_PASSWORD;
  delete h.jar["admin_session"];
});

describe("requireAdmin", () => {
  it("returns null when the session cookie is valid", async () => {
    expect(await requireAdmin()).toBeNull();
  });

  it("returns a 401 response without a session", async () => {
    delete h.jar["admin_session"];
    const res = await requireAdmin();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns a 401 response for a tampered cookie", async () => {
    h.jar["admin_session"] = `${Date.now() + 100000}.forgedsig`;
    const res = await requireAdmin();
    expect(res!.status).toBe(401);
  });
});

describe("sessionCookieOptions", () => {
  it("defaults maxAge to the session TTL in seconds", () => {
    const opts = sessionCookieOptions();
    expect(opts.maxAge).toBe(SESSION_TTL_MS / 1000);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("supports an explicit maxAge for logout (0 clears the cookie)", () => {
    expect(sessionCookieOptions(0).maxAge).toBe(0);
  });

  it("marks the cookie secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions().secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions().secure).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("checkPassword", () => {
  it("accepts the configured admin password", () => {
    expect(checkPassword("letmein")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(checkPassword("wrong")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });
});
