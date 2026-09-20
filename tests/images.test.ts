import { describe, expect, it } from "vitest";
import { sniffImageMime } from "@/lib/images";

const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

describe("sniffImageMime", () => {
  it("detects PNG by magic bytes", () => {
    expect(sniffImageMime(PNG_MAGIC)).toBe("image/png");
  });

  it("detects JPEG by magic bytes", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(8),
    ]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
  });

  it("detects WebP by RIFF/WEBP magic bytes", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
    ]);
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  it("rejects content that claims a different type", () => {
    const html = Buffer.concat([
      Buffer.from("<!DOCTYPE html><html>"),
      Buffer.alloc(8),
    ]);
    expect(sniffImageMime(html)).toBeNull();
  });

  it("rejects short or empty buffers", () => {
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(4))).toBeNull();
  });
});
