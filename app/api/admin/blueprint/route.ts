import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getBlueprintRow, saveBlueprint } from "@/lib/data";
import { sniffImageMime } from "@/lib/images";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    return NextResponse.json(
      { error: "File must be PNG, JPEG, or WebP" },
      { status: 400 },
    );
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 3MB)" }, { status: 400 });
  }
  await saveBlueprint(mimeType, bytes.toString("base64"));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const row = await getBlueprintRow();
  return NextResponse.json({
    hasBlueprint: !!row,
    mimeType: row?.mimeType ?? null,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
