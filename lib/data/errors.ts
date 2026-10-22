// Result and error helpers shared by the data layer's write functions.
// Pure (no database imports) so they can be unit-tested.

// Outcome of a write that can fail for a reason the caller should report.
// `status` is the HTTP status the route returns, so routes never have to
// guess (a missing row is 404, a broken rule or conflict is 409, a bad
// reference in the input is 400).
export type WriteResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string };

export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";

// The Postgres SQLSTATE of a failed query, if any. Drizzle wraps driver
// errors (DrizzleQueryError, with the pg error as `cause`), so this walks
// the cause chain instead of trusting the top-level error.
export function pgErrorCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let depth = 0; depth < 5 && cur && typeof cur === "object"; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}
