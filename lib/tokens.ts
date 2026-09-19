import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// HMAC-signed, tamper-proof tokens for email approve/deny links.
// Format: base64url(payload json) + "." + base64url(hmac-sha256(secret, payload))

export type DecideAction = "approve" | "deny";

// A decision token targets a whole submission group (all rooms requested
// together), not a single request row.
export type DecidePayload = {
  g: string; // group id
  a: DecideAction;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signPayload(payload: object, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(hmac(secret, body));
  return `${body}.${sig}`;
}

export function verifyPayload<T>(
  token: string,
  secret: string,
): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = hmac(secret, body);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function signDecideToken(
  groupId: string,
  action: DecideAction,
  secret: string,
): string {
  return signPayload({ g: groupId, a: action } satisfies DecidePayload, secret);
}

export function verifyDecideToken(
  token: string,
  secret: string,
): DecidePayload | null {
  const payload = verifyPayload<DecidePayload>(token, secret);
  if (!payload) return null;
  if (
    typeof payload.g !== "string" ||
    payload.g.length === 0 ||
    (payload.a !== "approve" && payload.a !== "deny")
  ) {
    return null;
  }
  return payload;
}

// Opaque unguessable token for self-cancel links.
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomUUID(): string {
  return randomBytes(16).toString("hex");
}

// --- Admin session cookie -------------------------------------------------
// value = <expiryMs>.<hmac(secret, "admin:<expiryMs>")

export function createAdminSession(
  secret: string,
  ttlMs: number = 7 * 24 * 3600 * 1000,
  now: number = Date.now(),
): string {
  const exp = now + ttlMs;
  return `${exp}.${b64url(hmac(secret, `admin:${exp}`))}`;
}

export function verifyAdminSession(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = b64url(hmac(secret, `admin:${exp}`));
  let given: Buffer;
  let expectedBuf: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
    expectedBuf = Buffer.from(expected, "base64url");
  } catch {
    return false;
  }
  if (given.length !== expectedBuf.length) return false;
  return timingSafeEqual(given, expectedBuf);
}

// Constant-time password check (compares HMACs so length is not leaked).
export function checkAdminPassword(
  provided: string,
  expected: string,
  secret: string,
): boolean {
  const a = hmac(secret, `pw:${provided}`);
  const b = hmac(secret, `pw:${expected}`);
  return timingSafeEqual(a, b);
}
