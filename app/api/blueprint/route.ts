import { getBlueprintRow } from "@/lib/data";

export async function GET() {
  const row = await getBlueprintRow();
  if (!row) {
    return new Response("No blueprint uploaded yet", { status: 404 });
  }
  const bytes = Buffer.from(row.dataBase64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": row.mimeType,
      "cache-control": "no-store",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
