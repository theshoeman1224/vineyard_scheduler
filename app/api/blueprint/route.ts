import { getBlueprintRow, getBlueprintVersion } from "@/lib/data";
import {
  blueprintCacheControl,
  blueprintEtag,
  blueprintVersion,
  etagMatches,
} from "@/lib/blueprint";

// Serves the blueprint image with the caching rules in lib/blueprint.ts.
// A revalidation that still matches is answered with 304 from the
// version alone, without reading the image data.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("v");
  const version = await getBlueprintVersion();
  if (!version) {
    return new Response("No blueprint uploaded yet", { status: 404 });
  }

  const etag = blueprintEtag(version);
  const cacheHeaders = {
    etag,
    "cache-control": blueprintCacheControl(requested, version),
  };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  const row = await getBlueprintRow();
  if (!row) {
    return new Response("No blueprint uploaded yet", { status: 404 });
  }
  // An upload between the two reads: describe the bytes actually sent.
  const sentVersion = blueprintVersion(row.updatedAt);
  const bytes = Buffer.from(row.dataBase64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": row.mimeType,
      etag: blueprintEtag(sentVersion),
      "cache-control": blueprintCacheControl(requested, sentVersion),
      // The stored type was sniffed at upload, but never let the browser
      // reinterpret the bytes either.
      "x-content-type-options": "nosniff",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
