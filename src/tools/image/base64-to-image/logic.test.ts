/**
 * Base64 to Image Decoder — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  parseDataUrl,
  extensionForMime,
  isLikelyBase64,
  suggestFilename,
  repairPadding,
  fromUrlSafe,
  extractFromWrapper,
  sniffMime,
  decodeInput,
  formatSize,
  base64ToBytes,
  validateBase64,
  preservesAlpha,
  conversionFormats,
} from "./logic";

describe("parseDataUrl", () => {
  it("parses a valid base64 data URL", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(r).toMatchObject({ mime: "image/png", base64: "iVBORw0KGgo=", extension: "png" });
  });
  it("computes sizeBytes", () => {
    const r = parseDataUrl("data:image/png;base64,AAAA") as { sizeBytes: number };
    expect(r.sizeBytes).toBe(3);
  });
  it("suggests extension from mime", () => {
    const r = parseDataUrl("data:image/jpeg;base64,AAAA") as { extension: string };
    expect(r.extension).toBe("jpg");
  });
  it("errors on empty input", () => {
    expect(parseDataUrl("")).toHaveProperty("error");
  });
  it("errors on non-data URL", () => {
    expect(parseDataUrl("https://example.com/foo.png")).toHaveProperty("error");
  });
  it("errors on empty payload", () => {
    expect(parseDataUrl("data:image/png;base64,")).toHaveProperty("error");
  });
});

describe("extensionForMime", () => {
  it("maps known types", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/svg+xml")).toBe("svg");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/gif")).toBe("gif");
    expect(extensionForMime("image/avif")).toBe("avif");
  });
  it("falls back to bin", () => {
    expect(extensionForMime("application/octet-stream")).toBe("bin");
  });
});

describe("isLikelyBase64", () => {
  it("accepts valid base64", () => {
    expect(isLikelyBase64("iVBORw0KGgo=")).toBe(true);
  });
  it("rejects non-base64 strings", () => {
    expect(isLikelyBase64("hello world!")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isLikelyBase64("")).toBe(false);
  });
});

describe("suggestFilename", () => {
  it("builds a safe filename", () => {
    expect(suggestFilename("photo", "png")).toBe("photo.png");
  });
  it("strips unsafe characters", () => {
    expect(suggestFilename("my photo!!", "jpg")).toBe("myphoto.jpg");
  });
  it("defaults when base is empty", () => {
    expect(suggestFilename("", "png")).toBe("image.png");
  });
});

describe("repairPadding", () => {
  it("returns unchanged when padding is correct", () => {
    const r = repairPadding("AAAA");
    expect(r.base64).toBe("AAAA");
    expect(r.repaired).toBe(false);
  });
  it("adds padding for length mod 4 = 2", () => {
    const r = repairPadding("AA");
    expect(r.base64).toBe("AA==");
    expect(r.repaired).toBe(true);
  });
  it("adds padding for length mod 4 = 3", () => {
    const r = repairPadding("AAA");
    expect(r.base64).toBe("AAA=");
    expect(r.repaired).toBe(true);
  });
});

describe("fromUrlSafe", () => {
  it("converts - to +", () => {
    expect(fromUrlSafe("a-b_c")).toBe("a+b/c");
  });
  it("leaves standard chars unchanged", () => {
    expect(fromUrlSafe("abc123+/")).toBe("abc123+/");
  });
});

describe("extractFromWrapper", () => {
  it("extracts from HTML img src", () => {
    const r = extractFromWrapper('<img src="data:image/png;base64,AAAA" alt="x">');
    expect(r).not.toBeNull();
    expect(r!.source).toBe("html");
    expect(r!.payload).toContain("data:image/png");
  });
  it("extracts from CSS url()", () => {
    const r = extractFromWrapper('background: url("data:image/png;base64,AAAA")');
    expect(r).not.toBeNull();
    expect(r!.source).toBe("css");
  });
  it("extracts from JSON {data: ...}", () => {
    const r = extractFromWrapper('{"data": "data:image/png;base64,AAAA"}');
    expect(r).not.toBeNull();
    expect(r!.source).toBe("json");
  });
  it("extracts from markdown ![](...)", () => {
    const r = extractFromWrapper("![alt](data:image/png;base64,AAAA)");
    expect(r).not.toBeNull();
    expect(r!.source).toBe("markdown");
  });
  it("returns null for plain text", () => {
    expect(extractFromWrapper("just some text")).toBeNull();
  });
});

describe("sniffMime", () => {
  it("detects PNG", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffMime(bytes)).toBe("image/png");
  });
  it("detects JPEG", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffMime(bytes)).toBe("image/jpeg");
  });
  it("detects GIF", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(sniffMime(bytes)).toBe("image/gif");
  });
  it("detects BMP", () => {
    const bytes = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
    expect(sniffMime(bytes)).toBe("image/bmp");
  });
  it("detects WebP", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffMime(bytes)).toBe("image/webp");
  });
  it("returns null for unknown", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(sniffMime(bytes)).toBeNull();
  });
  it("returns null for too-short input", () => {
    expect(sniffMime(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("decodeInput", () => {
  it("decodes a data URI", () => {
    const r = decodeInput("data:image/png;base64,iVBORw0KGgo=");
    expect(r).toMatchObject({ source: "data-uri", mime: "image/png" });
  });
  it("decodes raw base64 with padding repair", () => {
    const r = decodeInput("AAA") as { source: string; repaired: boolean };
    expect(r.source).toBe("raw");
    expect(r.repaired).toBe(true);
  });
  it("extracts from HTML wrapper", () => {
    const r = decodeInput('<img src="data:image/png;base64,AAAA">') as { source: string };
    expect(r.source).toBe("html");
  });
  it("extracts from CSS wrapper", () => {
    const r = decodeInput('url(data:image/png;base64,AAAA)') as { source: string };
    expect(r.source).toBe("css");
  });
  it("converts URL-safe base64", () => {
    const r = decodeInput("AA-_") as { source: string };
    expect(r.source).toBe("raw");
  });
  it("errors on garbage", () => {
    expect(decodeInput("not base64 or anything!!")).toHaveProperty("error");
  });
  it("errors on empty", () => {
    expect(decodeInput("")).toHaveProperty("error");
  });
});

describe("formatSize", () => {
  it("formats zero", () => expect(formatSize(0)).toBe("0 B"));
  it("formats bytes", () => expect(formatSize(512)).toBe("512 B"));
  it("formats KB", () => expect(formatSize(2048)).toBe("2.0 KB"));
  it("formats MB", () => expect(formatSize(1024 * 1024)).toBe("1.0 MB"));
});

describe("base64ToBytes", () => {
  it("decodes base64 to bytes", () => {
    // "ABC" → bytes [65, 66, 67] → base64 "QUJD"
    const bytes = base64ToBytes("QUJD");
    expect(Array.from(bytes)).toEqual([65, 66, 67]);
  });
  it("handles empty input", () => {
    expect(base64ToBytes("").length).toBe(0);
  });
});

describe("validateBase64", () => {
  it("validates a clean base64 string", () => {
    expect(validateBase64("AAAA")).toEqual({ ok: true });
  });
  it("rejects invalid base64", () => {
    expect(validateBase64("!!!!")).toHaveProperty("error");
  });
});

describe("preservesAlpha", () => {
  it("returns true for PNG/WebP, false for JPEG", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("conversionFormats", () => {
  it("returns 3 formats", () => {
    expect(conversionFormats().length).toBe(3);
  });
  it("includes PNG, JPEG, WebP", () => {
    const ids = conversionFormats().map((f) => f.id);
    expect(ids).toContain("image/png");
    expect(ids).toContain("image/jpeg");
    expect(ids).toContain("image/webp");
  });
});
