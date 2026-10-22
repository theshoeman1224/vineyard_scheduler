import { describe, expect, it } from "vitest";
import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from "@/lib/data/errors";

describe("pgErrorCode", () => {
  it("reads the SQLSTATE from a bare driver error", () => {
    expect(pgErrorCode({ code: PG_UNIQUE_VIOLATION })).toBe("23505");
  });

  it("unwraps Drizzle's DrizzleQueryError (driver error as cause)", () => {
    const driver = Object.assign(new Error("duplicate key"), { code: PG_UNIQUE_VIOLATION });
    const wrapped = new Error("Failed query: insert into rooms ...", { cause: driver });
    expect(pgErrorCode(wrapped)).toBe("23505");
  });

  it("finds codes nested more than one level deep", () => {
    const e = { cause: { cause: { code: PG_FOREIGN_KEY_VIOLATION } } };
    expect(pgErrorCode(e)).toBe("23503");
  });

  it("ignores non-SQLSTATE codes and non-errors", () => {
    expect(pgErrorCode({ code: "ECONNREFUSED" })).toBeUndefined();
    expect(pgErrorCode(new Error("plain"))).toBeUndefined();
    expect(pgErrorCode("boom")).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
  });
});
