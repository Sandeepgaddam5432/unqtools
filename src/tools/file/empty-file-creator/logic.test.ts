import { describe, it, expect, beforeEach } from "vitest";
import {
  toBytes, parseSizeString, formatBytes, fillBytes, generateBytes,
  renderTemplate, ensureExtension, generateFile, generateBatch,
  bytesToHex, formatHexPreview, buildShareUrl, parseShareUrl,
  fileInfoToJson, toBlob,
  loadHistory, saveToHistory, clearHistory,
  SIZE_PRESETS, UNIT_MULTIPLIERS,
  DEFAULT_OPTIONS, type CreateOptions, type FillPattern,
} from "./logic";

const opts = (overrides: Partial<CreateOptions> = {}): CreateOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe("efc toBytes", () => {
  it("converts bytes", () => { expect(toBytes(100, "B")).toBe(100); });
  it("converts KB", () => { expect(toBytes(1, "KB")).toBe(1024); });
  it("converts MB", () => { expect(toBytes(1, "MB")).toBe(1024 * 1024); });
  it("converts GB", () => { expect(toBytes(1, "GB")).toBe(1024 * 1024 * 1024); });
  it("floors fractional sizes", () => { expect(toBytes(1.5, "B")).toBe(1); });
});

describe("efc UNIT_MULTIPLIERS", () => {
  it("has all 4 units", () => {
    expect(UNIT_MULTIPLIERS.B).toBe(1);
    expect(UNIT_MULTIPLIERS.KB).toBe(1024);
    expect(UNIT_MULTIPLIERS.MB).toBe(1024 * 1024);
    expect(UNIT_MULTIPLIERS.GB).toBe(1024 * 1024 * 1024);
  });
});

describe("efc parseSizeString", () => {
  it("parses bare number", () => {
    expect(parseSizeString("100")).toBe(100);
  });
  it("parses with unit", () => {
    expect(parseSizeString("1 KB")).toBe(1024);
  });
  it("parses without space", () => {
    expect(parseSizeString("1MB")).toBe(1024 * 1024);
  });
  it("parses fractional", () => {
    expect(parseSizeString("1.5 KB")).toBe(1536);
  });
  it("returns null for invalid", () => {
    expect(parseSizeString("abc")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(parseSizeString("")).toBeNull();
  });
});

describe("efc formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("efc fillBytes", () => {
  it("fills with zeros", () => {
    const b = new Uint8Array(5);
    fillBytes(b, "zeros");
    expect(Array.from(b)).toEqual([0, 0, 0, 0, 0]);
  });
  it("fills with 0xFF", () => {
    const b = new Uint8Array(5);
    fillBytes(b, "0xff");
    expect(Array.from(b)).toEqual([255, 255, 255, 255, 255]);
  });
  it("fills with sequential", () => {
    const b = new Uint8Array(5);
    fillBytes(b, "sequential");
    expect(Array.from(b)).toEqual([0, 1, 2, 3, 4]);
  });
  it("fills with random (non-zero most likely)", () => {
    const b = new Uint8Array(1000);
    fillBytes(b, "random");
    const allZero = b.every((x) => x === 0);
    expect(allZero).toBe(false);
  });
  it("sequential wraps at 256", () => {
    const b = new Uint8Array(258);
    fillBytes(b, "sequential");
    expect(b[256]).toBe(0);
    expect(b[257]).toBe(1);
  });
});

describe("efc generateBytes", () => {
  it("generates bytes of given size", () => {
    const b = generateBytes(10, "zeros");
    expect(b.length).toBe(10);
  });
  it("applies pattern", () => {
    const b = generateBytes(10, "0xff");
    expect(b[0]).toBe(255);
  });
});

describe("efc renderTemplate", () => {
  it("replaces {n} with padded index", () => {
    expect(renderTemplate("file-{n}", 1, 3)).toBe("file-001");
  });
  it("supports multiple {n}", () => {
    expect(renderTemplate("{n}-{n}", 5, 2)).toBe("05-05");
  });
  it("respects padWidth 0", () => {
    expect(renderTemplate("file-{n}", 42, 0)).toBe("file-42");
  });
});

describe("efc ensureExtension", () => {
  it("appends extension when missing", () => {
    expect(ensureExtension("file", "bin")).toBe("file.bin");
  });
  it("does not double-append", () => {
    expect(ensureExtension("file.bin", "bin")).toBe("file.bin");
  });
  it("handles dot-prefixed extension", () => {
    expect(ensureExtension("file", ".txt")).toBe("file.txt");
  });
  it("returns unchanged when extension empty", () => {
    expect(ensureExtension("file", "")).toBe("file");
  });
});

describe("efc generateFile", () => {
  it("generates a single file with correct size", () => {
    const f = generateFile(opts({ size: 100, unit: "B", pattern: "zeros" }), 1);
    expect(f.size).toBe(100);
    expect(f.bytes.length).toBe(100);
  });
  it("renders template filename", () => {
    const f = generateFile(opts({ filenameTemplate: "test-{n}", extension: "dat" }), 5);
    expect(f.filename).toBe("test-005.dat");
  });
  it("includes preview hex of first 64 bytes", () => {
    const f = generateFile(opts({ size: 100, unit: "B", pattern: "0xff" }), 1);
    expect(f.previewHex).toHaveLength(128); // 64 bytes * 2 chars
    expect(f.previewHex.slice(0, 2)).toBe("ff");
  });
  it("handles pattern 0xff", () => {
    const f = generateFile(opts({ size: 10, unit: "B", pattern: "0xff" }), 1);
    expect(f.bytes[0]).toBe(255);
  });
});

describe("efc generateBatch", () => {
  it("generates multiple files", () => {
    const files = generateBatch(opts({ size: 10, unit: "B", startIndex: 1 }), 3);
    expect(files).toHaveLength(3);
    expect(files[0].filename).toContain("001");
    expect(files[1].filename).toContain("002");
    expect(files[2].filename).toContain("003");
  });
  it("respects startIndex", () => {
    const files = generateBatch(opts({ size: 10, unit: "B", startIndex: 10 }), 2);
    expect(files[0].filename).toContain("010");
    expect(files[1].filename).toContain("011");
  });
});

describe("efc bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
});

describe("efc formatHexPreview", () => {
  it("formats into rows", () => {
    const hex = "0001020304050607";
    const formatted = formatHexPreview(hex, 4);
    expect(formatted.split("\n")).toEqual(["00 01 02 03", "04 05 06 07"]);
  });
});

describe("efc SIZE_PRESETS", () => {
  it("includes common sizes", () => {
    expect(SIZE_PRESETS.some((p) => p.label === "1 KB")).toBe(true);
    expect(SIZE_PRESETS.some((p) => p.label === "1 MB")).toBe(true);
    expect(SIZE_PRESETS.some((p) => p.label === "1 GB")).toBe(true);
  });
});

describe("efc buildShareUrl + parseShareUrl", () => {
  it("builds a shareable URL", () => {
    const url = buildShareUrl(opts({ size: 5, unit: "MB", pattern: "0xff" }), 3);
    expect(url).toContain("#size=5");
    expect(url).toContain("unit=MB");
    expect(url).toContain("pattern=0xff");
    expect(url).toContain("count=3");
  });
  it("parses back", () => {
    const url = buildShareUrl(opts({ size: 5, unit: "MB", pattern: "0xff", extension: "dat" }), 3);
    const hash = url.slice(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.options.size).toBe(5);
      expect(parsed.options.unit).toBe("MB");
      expect(parsed.options.pattern).toBe("0xff");
      expect(parsed.options.extension).toBe("dat");
      expect(parsed.count).toBe(3);
    }
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});

describe("efc fileInfoToJson", () => {
  it("serializes files to JSON", () => {
    const files = generateBatch(opts({ size: 10, unit: "B" }), 2);
    const json = fileInfoToJson(files);
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(2);
    expect(parsed.totalSize).toBe(20);
    expect(parsed.files).toHaveLength(2);
  });
});

describe("efc toBlob", () => {
  it("creates a Blob with correct size", () => {
    const f = generateFile(opts({ size: 100, unit: "B", pattern: "zeros" }), 1);
    const blob = toBlob(f);
    expect(blob.size).toBe(100);
  });
});

describe("efc history", () => {
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
    saveToHistory({ count: 3, totalSize: 3072, pattern: "zeros", extension: "bin", createdAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ count: 3, totalSize: 3072, pattern: "zeros", extension: "bin", createdAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
