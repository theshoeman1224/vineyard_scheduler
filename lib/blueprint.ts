// Pure caching rules for the blueprint image (served by /api/blueprint).
//
// The image is up to ~4MB of base64 in Postgres, so it should not be read
// and decoded on every page view. Pages link to a versioned URL
// (?v=<version>, derived from the row's updated_at), which the browser may
// cache forever: a new upload changes the version and therefore the URL,
// which is also what makes the admin editor show the new image at once.
// Unversioned or stale-version requests get revalidation via ETag, which
// is answered from the updated_at column alone, without the image data.

export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
export const REVALIDATE_CACHE = "no-cache";

export function blueprintVersion(updatedAt: Date): string {
  return updatedAt.getTime().toString(36);
}

export function blueprintSrc(version: string): string {
  return `/api/blueprint?v=${encodeURIComponent(version)}`;
}

export function blueprintEtag(version: string): string {
  return `"bp-${version}"`;
}

// If-None-Match may list several tags, use weak (W/) tags, or be "*".
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(",")
    .map((t) => t.trim().replace(/^W\//, ""))
    .some((t) => t === "*" || t === etag);
}

// Only a URL naming the current version may be cached as immutable;
// caching current bytes under an old version's URL would pin them there.
export function blueprintCacheControl(requested: string | null, current: string): string {
  return requested === current ? IMMUTABLE_CACHE : REVALIDATE_CACHE;
}
