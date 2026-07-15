import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  toBytes, parseSizeString, formatBytes, formatDuration,
  fillBytes, generateBytes, renderTemplate, ensureExtension,
  generateFile, generateBatch, bytesToHex, formatHexPreview,
  fileInfoToJson, toBlob,
  buildShareUrl, parseShareUrl,
  loadHistory, saveToHistory, clearHistory,
  SIZE_PRESETS, UNIT_MULTIPLIERS,
  DEFAULT_OPTIONS, type CreateOptions, type FillPattern,
} from "./logic";

const opts = (o: Partial<CreateOptions> = {}): CreateOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe("lfg toBytes", () => {
  it("converts bytes", () => { expect(toBytes(100, "B")).toBe(100); });
  it("converts KB", () => { expect(toBytes(1, "KB")).toBe(1024); });
  it("converts MB", () => { expect(toBytes(1, "MB")).toBe(1024 * 1024); });
  it("converts GB", () => { expect(toBytes(1, "GB")).toBe(1024 * 1024 * 1024); });
  it("floors fractional sizes", () => { expect(toBytes(1.5, "B")).toBe(1); });
});

describe("lfg UNIT_MULTIPLIERS", () => {
  it("has all 4 units", () => {
    expect(UNIT_MULTIPLIERS.B).toBe(1);
    expect(UNIT_MULTIPLIERS.KB).toBe(1024);
    expect(UNIT_MULTIPLIERS.MB).toBe(1024 * 1024);
    expect(UNIT_MULTIPLIERS.GB).toBe(1024 * 1024 * 1024);
  });
});

describe("lfg parseSizeString", () => {
  it("parses bare number", () => { expect(parseSizeString("100")).toBe(100); });
  it("parses with unit", () => { expect(parseSizeString("1 KB")).toBe(1024); });
  it("parses without space", () => { expect(parseSizeString("1MB")).toBe(1024 * 1024); });
  it("parses fractional", () => { expect(parseSizeString("1.5 KB")).toBe(1536); });
  it("returns null for invalid", () => { expect(parseSizeString("abc")).toBeNull(); });
  it("returns null for empty", () => { expect(parseSizeString("")).toBeNull(); });
});

describe("lfg formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("lfg formatDuration", () => {
  it("formats ms", () => { expect(formatDuration(500)).toBe("500 ms"); });
  it("formats seconds", () => { expect(formatDuration(2500)).toBe("2.50 s"); });
  it("formats minutes", () => { expect(formatDuration(65000)).toBe("1m 5s"); });
});

describe("lfg fillBytes", () => {
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
  it("sequential wraps at 256", () => {
    const b = new Uint8Array(258);
    fillBytes(b, "sequential");
    expect(b[256]).toBe(0);
    expect(b[257]).toBe(1);
  });
  it("fills with text (repeating)", () => {
    const b = new Uint8Array(10);
    fillBytes(b, "text", "AB");
    expect(Array.from(b)).toEqual([65, 66, 65, 66, 65, 66, 65, 66, 65, 66]);
  });
  it("text uses fallback 'x' if empty", () => {
    const b = new Uint8Array(3);
    fillBytes(b, "text", "");
    expect(b[0]).toBe(120); // 'x'
  });
  it("fills with random (non-zero most likely)", () => {
    const b = new Uint8Array(1000);
    fillBytes(b, "random");
    const allZero = b.every((x) => x === 0);
    expect(allZero).toBe(false);
  });
});

describe("lfg generateBytes", () => {
  it("generates bytes of given size", () => {
    const b = generateBytes(10, "zeros");
    expect(b.length).toBe(10);
  });
  it("applies pattern", () => {
    const b = generateBytes(10, "0xff");
    expect(b[0]).toBe(255);
  });
  it("calls onProgress", () => {
    const calls: number[] = [];
    generateBytes(10, "zeros", "", (p) => calls.push(p));
    expect(calls).toContain(100);
  });
  it("calls onProgress in chunks for random", () => {
    const calls: number[] = [];
    generateBytes(2 * 1024 * 1024, "random", "", (p) => calls.push(p));
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[calls.length - 1]).toBe(100);
  });
});

describe("lfg renderTemplate", () => {
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

describe("lfg ensureExtension", () => {
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

describe("lfg generateFile", () => {
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
  it("records generation duration", () => {
    const f = generateFile(opts({ size: 10, unit: "B", pattern: "zeros" }), 1);
    expect(f.durationMs).toBeGreaterThanOrEqual(0);
  });
  it("text pattern repeats correctly", () => {
    const f = generateFile(opts({ size: 9, unit: "B", pattern: "text", text: "ABC" }), 1);
    expect(Array.from(f.bytes)).toEqual([65, 66, 67, 65, 66, 67, 65, 66, 67]);
  });
});

describe("lfg generateBatch", () => {
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
  it("reports per-file progress", () => {
    const seen: number[] = [];
    generateBatch(opts({ size: 10, unit: "B" }), 2, (_p, i, t) => {
      seen.push(i);
      expect(t).toBe(2);
    });
    expect(seen).toContain(0);
    expect(seen).toContain(1);
  });
});

describe("lfg bytesToHex + formatHexPreview", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("formats into rows", () => {
    const hex = "0001020304050607";
    const formatted = formatHexPreview(hex, 4);
    expect(formatted.split("\n")).toEqual(["00 01 02 03", "04 05 06 07"]);
  });
});

describe("lfg SIZE_PRESETS", () => {
  it("includes common sizes (1KB / 100KB / 1MB / 10MB / 100MB / 1GB)", () => {
    const labels = SIZE_PRESETS.map((p) => p.label);
    expect(labels).toContain("1 KB");
    expect(labels).toContain("100 KB");
    expect(labels).toContain("1 MB");
    expect(labels).toContain("10 MB");
    expect(labels).toContain("100 MB");
    expect(labels).toContain("1 GB");
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("lfg fileInfoToJson", () => {
  it("serializes files to JSON", () => {
    const files = generateBatch(opts({ size: 10, unit: "B" }), 2);
    const json = fileInfoToJson(files);
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(2);
    expect(parsed.totalSize).toBe(20);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("lfg toBlob", () => {
  it("creates a Blob with correct size", () => {
    const f = generateFile(opts({ size: 100, unit: "B", pattern: "zeros" }), 1);
    const blob = toBlob(f);
    expect(blob.size).toBe(100);
  });
});

describe("lfg share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { location: { origin: string } } }).window = {
      location: { origin: "https://x.io" },
    };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  it("builds a shareable URL", () => {
    const url = buildShareUrl(opts({ size: 5, unit: "MB", pattern: "text", text: "hello" }), 3);
    expect(url).toContain("#size=5");
    expect(url).toContain("unit=MB");
    expect(url).toContain("pattern=text");
    expect(url).toContain("text=hello");
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

describe("lfg history", () => {
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
    saveToHistory({ count: 3, totalSize: 3072, pattern: "zeros", extension: "bin", durationMs: 12, createdAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ count: 3, totalSize: 3072, pattern: "zeros", extension: "bin", durationMs: 12, createdAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
