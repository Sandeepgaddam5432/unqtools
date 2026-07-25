/**
 * Image to Base64 Encoder — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  detectMime,
  mimeToExtension,
  parseDataUrl,
  buildBase64Result,
  binaryStringToBytes,
  chunkedBase64,
  toUrlSafe,
  formatOutput,
  formatSize,
  overhead,
  sizeWarning,
  resizeTarget,
  OUTPUT_PRESETS,
  batchEncode,
  fnv1aHash,
} from "./logic";

describe("detectMime", () => {
  it("detects PNG", () => expect(detectMime("foo.png")).toBe("image/png"));
  it("detects JPG", () => {
    expect(detectMime("foo.jpg")).toBe("image/jpeg");
    expect(detectMime("foo.JPEG")).toBe("image/jpeg");
  });
  it("detects WebP", () => expect(detectMime("foo.webp")).toBe("image/webp"));
  it("detects SVG", () => expect(detectMime("foo.svg")).toBe("image/svg+xml"));
  it("detects GIF / BMP / AVIF / ICO", () => {
    expect(detectMime("foo.gif")).toBe("image/gif");
    expect(detectMime("foo.bmp")).toBe("image/bmp");
    expect(detectMime("foo.avif")).toBe("image/avif");
    expect(detectMime("foo.ico")).toBe("image/x-icon");
  });
  it("returns null for unknown", () => expect(detectMime("foo.txt")).toBeNull());
});

describe("mimeToExtension", () => {
  it("maps known types", () => {
    expect(mimeToExtension("image/png")).toBe("png");
    expect(mimeToExtension("image/jpeg")).toBe("jpg");
    expect(mimeToExtension("image/svg+xml")).toBe("svg");
  });
  it("falls back to bin for unknown", () => {
    expect(mimeToExtension("application/octet-stream")).toBe("bin");
  });
});

describe("parseDataUrl", () => {
  it("parses a base64 data URL", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(r).toMatchObject({ mime: "image/png", raw: "iVBORw0KGgo=" });
  });
  it("parses a non-base64 data URL", () => {
    const r = parseDataUrl("data:text/plain,hello");
    expect(r).toMatchObject({ mime: "text/plain", raw: "hello" });
  });
  it("computes approximate decoded size", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=") as { sizeBytes: number };
    expect(r.sizeBytes).toBeGreaterThan(0);
  });
  it("errors on invalid input", () => {
    expect(parseDataUrl("not a url")).toHaveProperty("error");
  });
});

describe("buildBase64Result", () => {
  it("builds a data URL from raw base64", () => {
    const r = buildBase64Result("iVBORw0KGgo=", "image/png");
    expect(r.dataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(r.raw).toBe("iVBORw0KGgo=");
    expect(r.mime).toBe("image/png");
  });
  it("computes decoded size", () => {
    const r = buildBase64Result("AAAA", "image/png");
    expect(r.sizeBytes).toBe(3);
  });
  it("computes encoded bytes", () => {
    const r = buildBase64Result("AAAA", "image/png");
    expect(r.encodedBytes).toBe(4);
  });
  it("estimates gzip size", () => {
    const r = buildBase64Result("AAAA", "image/png");
    expect(r.gzipBytes).toBeGreaterThan(0);
    expect(r.gzipBytes).toBeLessThan(r.sizeBytes);
  });
});

describe("binaryStringToBytes", () => {
  it("converts ASCII string to bytes", () => {
    const bytes = binaryStringToBytes("ABC");
    expect(Array.from(bytes)).toEqual([65, 66, 67]);
  });
  it("handles empty string", () => {
    expect(binaryStringToBytes("").length).toBe(0);
  });
});

describe("chunkedBase64", () => {
  it("encodes a small array", () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    expect(chunkedBase64(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
  });
  it("encodes a large array without stack overflow", () => {
    const bytes = new Uint8Array(0x10000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
    const result = chunkedBase64(bytes);
    expect(result.length).toBeGreaterThan(0);
    // Result should be valid base64
    expect(result.length % 4).toBe(0);
  });
});

describe("toUrlSafe", () => {
  it("converts + and / and strips padding", () => {
    expect(toUrlSafe("a+b/c==")).toBe("a-b_c");
  });
  it("leaves URL-safe chars unchanged", () => {
    expect(toUrlSafe("abc123")).toBe("abc123");
  });
});

describe("formatOutput", () => {
  const r = buildBase64Result("AAAA", "image/png");
  it("data-uri returns the data URL", () => {
    expect(formatOutput(r, "data-uri")).toBe(r.dataUrl);
  });
  it("raw returns just the base64", () => {
    expect(formatOutput(r, "raw")).toBe("AAAA");
  });
  it("img returns HTML img tag", () => {
    expect(formatOutput(r, "img", "logo")).toContain("<img");
    expect(formatOutput(r, "img", "logo")).toContain('alt="logo"');
  });
  it("css returns CSS background rule", () => {
    expect(formatOutput(r, "css", "hero")).toContain("background-image");
  });
  it("json returns valid JSON", () => {
    const json = formatOutput(r, "json", "pic");
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.mime).toBe("image/png");
  });
  it("markdown returns image syntax", () => {
    expect(formatOutput(r, "markdown", "alt")).toMatch(/^!\[alt\]/);
  });
  it("svg returns SVG markup", () => {
    expect(formatOutput(r, "svg")).toContain("<svg");
  });
  it("favicon returns link tag", () => {
    expect(formatOutput(r, "favicon")).toContain("<link");
    expect(formatOutput(r, "favicon")).toContain('rel="icon"');
  });
});

describe("formatSize", () => {
  it("formats zero", () => expect(formatSize(0)).toBe("0 B"));
  it("formats bytes", () => expect(formatSize(512)).toBe("512 B"));
  it("formats KB", () => expect(formatSize(2048)).toBe("2.0 KB"));
  it("formats MB", () => expect(formatSize(1024 * 1024)).toBe("1.0 MB"));
});

describe("overhead", () => {
  it("returns ~33% for base64", () => {
    // 4 base64 chars encode 3 bytes
    expect(overhead(4, 3)).toBeCloseTo(33, 0);
  });
  it("returns 0 when decoded is 0", () => {
    expect(overhead(10, 0)).toBe(0);
  });
});

describe("sizeWarning", () => {
  it("returns null for small URIs", () => {
    expect(sizeWarning(1024)).toBeNull();
  });
  it("warns above 32 KB", () => {
    expect(sizeWarning(33 * 1024)).toContain("32 KB");
  });
  it("warns strongly above 4 MB", () => {
    expect(sizeWarning(5 * 1024 * 1024)).toContain("4 MB");
  });
});

describe("resizeTarget", () => {
  it("returns original when no max", () => {
    expect(resizeTarget(100, 50)).toEqual({ width: 100, height: 50 });
  });
  it("scales down to maxW preserving aspect", () => {
    expect(resizeTarget(1000, 500, 500)).toEqual({ width: 500, height: 250 });
  });
  it("scales down to maxH preserving aspect", () => {
    expect(resizeTarget(1000, 500, undefined, 200)).toEqual({ width: 400, height: 200 });
  });
});

describe("OUTPUT_PRESETS", () => {
  it("has 8 presets", () => {
    expect(OUTPUT_PRESETS.length).toBe(8);
  });
  it("includes data-uri, img, css, json, markdown, svg, favicon, raw", () => {
    const ids = OUTPUT_PRESETS.map((p) => p.id);
    expect(ids).toContain("data-uri");
    expect(ids).toContain("raw");
    expect(ids).toContain("img");
    expect(ids).toContain("css");
    expect(ids).toContain("json");
    expect(ids).toContain("markdown");
    expect(ids).toContain("svg");
    expect(ids).toContain("favicon");
  });
});

describe("batchEncode", () => {
  it("returns metadata for each file", () => {
    const r = batchEncode([{ name: "a.png", size: 5000 }]);
    expect(r[0]!.mime).toBe("image/png");
    expect(r[0]!.sizeBytes).toBe(5000);
  });
  it("returns null mime for unknown", () => {
    const r = batchEncode([{ name: "x.txt", size: 100 }]);
    expect(r[0]!.mime).toBeNull();
  });
  it("returns warning for large files", () => {
    const r = batchEncode([{ name: "big.png", size: 5 * 1024 * 1024 }]);
    expect(r[0]!.warning).toContain("4 MB");
  });
});

describe("fnv1aHash", () => {
  it("returns an 8-char hex string", () => {
    const h = fnv1aHash(new Uint8Array([0, 1, 2, 3]));
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
  it("is deterministic for same input", () => {
    const bytes = new Uint8Array([10, 20, 30]);
    expect(fnv1aHash(bytes)).toBe(fnv1aHash(bytes));
  });
  it("differs for different inputs", () => {
    expect(fnv1aHash(new Uint8Array([1]))).not.toBe(fnv1aHash(new Uint8Array([2])));
  });
});
