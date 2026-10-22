import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_CACHE,
  REVALIDATE_CACHE,
  blueprintCacheControl,
  blueprintEtag,
  blueprintSrc,
  blueprintVersion,
  etagMatches,
} from "@/lib/blueprint";

describe("blueprint versioning", () => {
  it("derives a stable version from updated_at that changes on upload", () => {
    const a = blueprintVersion(new Date("2026-10-21T10:00:00.000Z"));
    expect(blueprintVersion(new Date("2026-10-21T10:00:00.000Z"))).toBe(a);
    expect(blueprintVersion(new Date("2026-10-21T10:00:00.001Z"))).not.toBe(a);
    expect(blueprintSrc(a)).toBe(`/api/blueprint?v=${a}`);
  });

  it("caches only the current version's URL as immutable", () => {
    expect(blueprintCacheControl("abc", "abc")).toBe(IMMUTABLE_CACHE);
    expect(blueprintCacheControl("old", "abc")).toBe(REVALIDATE_CACHE);
    expect(blueprintCacheControl(null, "abc")).toBe(REVALIDATE_CACHE);
  });
});

describe("etagMatches", () => {
  const etag = blueprintEtag("abc");

  it("matches exact, weak, listed, and wildcard tags", () => {
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(`W/${etag}`, etag)).toBe(true);
    expect(etagMatches(`"x", ${etag}`, etag)).toBe(true);
    expect(etagMatches("*", etag)).toBe(true);
  });

  it("does not match missing or different tags", () => {
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches(blueprintEtag("old"), etag)).toBe(false);
  });
});
