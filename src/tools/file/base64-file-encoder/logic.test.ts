import { describe, it, expect, beforeEach } from "vitest";
import {
  bytesToBase64, base64ToBytes, toUrlSafe, fromUrlSafe, wrapLines, unwrapLines,
  detectMimeType, detectFromMagicBytes, extFromMime, buildDataUrl, encodeBytes,
  formatBytes, encodeFile, encodeFiles, isLargeFile,
  loadHistory, saveToHistory, clearHistory,
  DEFAULT_OPTIONS, type EncodeOptions,
} from "./logic";

const opts = (overrides: Partial<EncodeOptions> = {}): EncodeOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe("b64enc bytesToBase64", () => {
  it("encodes empty bytes", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });
  it("encodes 'Hello'", () => {
    expect(bytesToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe("SGVsbG8=");
  });
  it("encodes 'Hello, World!'", () => {
    expect(bytesToBase64(new TextEncoder().encode("Hello, World!"))).toBe("SGVsbG8sIFdvcmxkIQ==");
  });
  it("encodes binary bytes", () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 3, 255]))).toBe("AAECA/8=");
  });
});

describe("b64enc base64ToBytes", () => {
  it("decodes empty string", () => {
    expect(base64ToBytes("").length).toBe(0);
  });
  it("decodes 'SGVsbG8='", () => {
    expect(Array.from(base64ToBytes("SGVsbG8="))).toEqual([72, 101, 108, 108, 111]);
  });
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255, 0, 128]);
    const round = base64ToBytes(bytesToBase64(original));
    expect(Array.from(round)).toEqual(Array.from(original));
  });
});

describe("b64enc toUrlSafe", () => {
  it("replaces + with -", () => {
    expect(toUrlSafe("a+b")).toBe("a-b");
  });
  it("replaces / with _", () => {
    expect(toUrlSafe("a/b")).toBe("a_b");
  });
  it("strips padding =", () => {
    expect(toUrlSafe("abc=")).toBe("abc");
    expect(toUrlSafe("ab==")).toBe("ab");
  });
  it("round-trips via fromUrlSafe", () => {
    const original = bytesToBase64(new Uint8Array([255, 255, 255, 255, 255]));
    const urlSafe = toUrlSafe(original);
    const restored = fromUrlSafe(urlSafe);
    expect(restored).toBe(original);
  });
});

describe("b64enc fromUrlSafe", () => {
  it("replaces - with + (with re-padding)", () => {
    expect(fromUrlSafe("a-b")).toBe("a+b=");
  });
  it("replaces _ with / (with re-padding)", () => {
    expect(fromUrlSafe("a_b")).toBe("a/b=");
  });
  it("re-pads to multiple of 4", () => {
    expect(fromUrlSafe("ab")).toBe("ab==");
    expect(fromUrlSafe("abc")).toBe("abc=");
  });
  it("does not pad a 4-char string", () => {
    expect(fromUrlSafe("abcd")).toBe("abcd");
  });
});

describe("b64enc wrapLines", () => {
  it("wraps at 76 chars by default", () => {
    const text = "A".repeat(80);
    const wrapped = wrapLines(text, 76);
    expect(wrapped.split("\n")).toEqual(["A".repeat(76), "A".repeat(4)]);
  });
  it("returns short strings on one line", () => {
    expect(wrapLines("short", 76)).toBe("short");
  });
  it("handles zero width", () => {
    expect(wrapLines("abc", 0)).toBe("abc");
  });
});

describe("b64enc unwrapLines", () => {
  it("removes all whitespace", () => {
    expect(unwrapLines("ab c\nde\nf")).toBe("abcdef");
  });
});

describe("b64enc detectFromMagicBytes", () => {
  it("detects PNG", () => {
    expect(detectFromMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });
  it("detects JPEG", () => {
    expect(detectFromMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });
  it("detects PDF", () => {
    expect(detectFromMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe("application/pdf");
  });
  it("returns null for unknown bytes", () => {
    expect(detectFromMagicBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });
});

describe("b64enc detectMimeType", () => {
  it("uses magic bytes first", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(detectMimeType("file.txt", bytes)).toBe("image/png");
  });
  it("falls back to extension", () => {
    expect(detectMimeType("file.json", new Uint8Array([0]))).toBe("application/json");
  });
  it("falls back to octet-stream", () => {
    expect(detectMimeType("file.unknownext", new Uint8Array([0]))).toBe("application/octet-stream");
  });
});

describe("b64enc extFromMime", () => {
  it("returns png for image/png", () => {
    expect(extFromMime("image/png")).toBe("png");
  });
  it("returns json for application/json", () => {
    expect(extFromMime("application/json")).toBe("json");
  });
  it("returns bin for unknown mime", () => {
    expect(extFromMime("application/x-nonexistent")).toBe("bin");
  });
});

describe("b64enc buildDataUrl", () => {
  it("builds a data URL with mime + base64", () => {
    const url = buildDataUrl(new Uint8Array([72, 105]), "text/plain");
    expect(url).toBe("data:text/plain;base64,SGk=");
  });
});

describe("b64enc encodeBytes", () => {
  const bytes = new TextEncoder().encode("Hello, World!");
  it("raw mode", () => {
    expect(encodeBytes(bytes, "text/plain", opts({ mode: "raw" }))).toBe("SGVsbG8sIFdvcmxkIQ==");
  });
  it("dataUrl mode", () => {
    expect(encodeBytes(bytes, "text/plain", opts({ mode: "dataUrl" }))).toBe("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==");
  });
  it("urlSafe mode (no +, /, =)", () => {
    const out = encodeBytes(new Uint8Array([255, 255, 255, 255, 255]), "application/octet-stream", opts({ mode: "urlSafe" }));
    expect(out).not.toContain("+");
    expect(out).not.toContain("/");
    expect(out).not.toContain("=");
  });
  it("wrapped mode", () => {
    const long = new Uint8Array(200);
    const out = encodeBytes(long, "application/octet-stream", opts({ mode: "wrapped", wrapWidth: 16 }));
    expect(out.split("\n")[0].length).toBe(16);
  });
});

describe("b64enc formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("b64enc encodeFile", () => {
  it("encodes a small text file", async () => {
    const file = new File([new TextEncoder().encode("Hello")], "hello.txt", { type: "text/plain" });
    const r = await encodeFile(file, opts({ mode: "raw" }));
    expect(r.base64).toBe("SGVsbG8=");
    expect(r.size).toBe(5);
    expect(r.mime).toBe("text/plain");
    expect(r.preview).toBe("SGVsbG8=");
  });
  it("computes overhead", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "test.bin", { type: "application/octet-stream" });
    const r = await encodeFile(file, opts({ mode: "raw" }));
    expect(r.overhead).toBeGreaterThan(0);
  });
});

describe("b64enc encodeFiles (batch)", () => {
  it("encodes multiple files", async () => {
    const files = [
      new File([new TextEncoder().encode("a")], "a.txt", { type: "text/plain" }),
      new File([new TextEncoder().encode("bb")], "b.txt", { type: "text/plain" }),
    ];
    const results = await encodeFiles(files, opts({ mode: "raw" }));
    expect(results).toHaveLength(2);
    expect(results[0].base64).toBe("YQ==");
    expect(results[1].base64).toBe("YmI=");
  });
  it("reports progress", async () => {
    const files = [
      new File([new TextEncoder().encode("a")], "a.txt", { type: "text/plain" }),
      new File([new TextEncoder().encode("bb")], "b.txt", { type: "text/plain" }),
    ];
    let lastPct = -1;
    await encodeFiles(files, opts({ mode: "raw" }), (_i, pct) => { lastPct = pct; });
    expect(lastPct).toBe(100);
  });
});

describe("b64enc isLargeFile", () => {
  it("returns false for small file", () => {
    expect(isLargeFile(1024)).toBe(false);
  });
  it("returns true for >2MB file", () => {
    expect(isLargeFile(3 * 1024 * 1024)).toBe(true);
  });
  it("respects custom threshold", () => {
    expect(isLargeFile(500, 100)).toBe(true);
  });
});

describe("b64enc history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    } as Storage;
  });
  it("saves and loads", () => {
    saveToHistory({ filename: "a.txt", size: 5, mime: "text/plain", mode: "raw", outputSize: 8, encodedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "a.txt", size: 5, mime: "text/plain", mode: "raw", outputSize: 8, encodedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
