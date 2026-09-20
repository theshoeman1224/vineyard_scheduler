// Sniffs an image's magic bytes. `file.type` is client-declared and can
// claim anything, so upload handlers must decide the stored MIME type from
// the bytes themselves.
export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.subarray(0, 8).equals(png)) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
