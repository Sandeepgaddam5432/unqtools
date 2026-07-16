import { describe, it, expect, beforeEach } from "vitest";
import {
  Z_MAGIC, Z_DEFAULT_MAX_BITS, Z_BLOCK_MODE_FLAG,
  isZMagic, parseHeader, buildHeader,
  compressLzw, decompressLzw, compressZ, decompressZ,
  computeStats, hexPreview, detectMode,
  batchCompress, batchDecompress,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS, type ZOptions,
} from "./logic";

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null, setItem: () => {}, removeItem: () => {},
    clear: () => {}, key: () => null, length: 0,
  } as Storage;
});

// ===== isZMagic =====

describe("z-compressor isZMagic", () => {
  it("returns true for .Z magic", () => {
    expect(isZMagic(new Uint8Array([0x1f, 0x9d, 0x90]))).toBe(true);
  });
  it("returns false for non-.Z magic", () => {
    expect(isZMagic(new Uint8Array([0x1f, 0x8b]))).toBe(false);  // gzip
  });
  it("returns false for too-short input", () => {
    expect(isZMagic(new Uint8Array([0x1f]))).toBe(false);
  });
});

// ===== parseHeader =====

describe("z-compressor parseHeader", () => {
  it("parses a 16-bit block-mode header", () => {
    const bytes = new Uint8Array([0x1f, 0x9d, 0x90]);
    const h = parseHeader(bytes);
    expect(h.isValid).toBe(true);
    expect(h.maxBits).toBe(16);
    expect(h.blockMode).toBe(true);
  });
  it("parses a 13-bit non-block-mode header", () => {
    const bytes = new Uint8Array([0x1f, 0x9d, 0x0d]);
    const h = parseHeader(bytes);
    expect(h.maxBits).toBe(13);
    expect(h.blockMode).toBe(false);
    expect(h.isValid).toBe(true);
  });
  it("returns isValid=false for invalid maxBits", () => {
    const h = parseHeader(new Uint8Array([0x1f, 0x9d, 0x07]));  // 7 bits
    expect(h.isValid).toBe(false);
  });
  it("returns isValid=false for too-short input", () => {
    const h = parseHeader(new Uint8Array([0x1f, 0x9d]));
    expect(h.isValid).toBe(false);
  });
});

// ===== buildHeader =====

describe("z-compressor buildHeader", () => {
  it("builds the default header (16-bit block mode)", () => {
    const h = buildHeader(DEFAULT_OPTIONS);
    expect(h).toEqual(new Uint8Array([0x1f, 0x9d, 0x90]));
  });
  it("builds non-block-mode header", () => {
    const h = buildHeader({ maxBits: 16, blockMode: false });
    expect(h[2]).toBe(0x10);
  });
  it("clamps max bits to 9-16 range", () => {
    const h = buildHeader({ maxBits: 99, blockMode: false });
    expect(h[2] & 0x1f).toBe(16);
    const h2 = buildHeader({ maxBits: 5, blockMode: false });
    expect(h2[2] & 0x1f).toBe(9);
  });
});

// ===== LZW round-trip =====

describe("z-compressor LZW round-trip", () => {
  const testCases: Array<{ name: string; data: Uint8Array; opts?: ZOptions }> = [
    { name: "short text", data: new TextEncoder().encode("Hello, World!") },
    { name: "empty string", data: new TextEncoder().encode("") },
    { name: "single byte", data: new Uint8Array([65]) },
    { name: "repeated bytes", data: new Uint8Array(Array.from({ length: 1000 }, () => 65)) },
    { name: "alphabet repeated", data: new TextEncoder().encode("abcdefghijklmnopqrstuvwxyz".repeat(40)) },
    { name: "binary data", data: new Uint8Array(Array.from({ length: 500 }, (_, i) => i & 0xff)) },
    { name: "long text with patterns", data: new TextEncoder().encode("the quick brown fox jumps over the lazy dog. ".repeat(50)) },
    { name: "single unique byte repeated 100x", data: new Uint8Array(Array.from({ length: 100 }, () => 0x42)) },
    { name: "all 256 byte values", data: new Uint8Array(Array.from({ length: 256 }, (_, i) => i)) },
    { name: "10-bit max bits", data: new TextEncoder().encode("Hello World! Hello World! Hello World!"), opts: { maxBits: 10, blockMode: true } },
  ];

  for (const tc of testCases) {
    it(`round-trips ${tc.name}`, () => {
      const opts = tc.opts ?? DEFAULT_OPTIONS;
      const compressed = compressLzw(tc.data, opts);
      // Build full .Z file and decompress
      const header = buildHeader(opts);
      const fullFile = new Uint8Array(header.length + compressed.length);
      fullFile.set(header, 0);
      fullFile.set(compressed, header.length);
      const h = parseHeader(fullFile);
      const decompressed = decompressLzw(fullFile, h);
      expect(decompressed).toEqual(tc.data);
    });
  }

  it("compresses repeated data to less than input", () => {
    const data = new Uint8Array(Array.from({ length: 1000 }, () => 65));
    const compressed = compressLzw(data, DEFAULT_OPTIONS);
    expect(compressed.length).toBeLessThan(data.length);
  });

  it("handles large input (>4KB)", () => {
    const data = new TextEncoder().encode("test pattern ".repeat(500));
    const compressed = compressLzw(data, DEFAULT_OPTIONS);
    const header = buildHeader(DEFAULT_OPTIONS);
    const fullFile = new Uint8Array(header.length + compressed.length);
    fullFile.set(header, 0);
    fullFile.set(compressed, header.length);
    const decompressed = decompressLzw(fullFile, parseHeader(fullFile));
    expect(decompressed).toEqual(data);
  });

  it("handles block-mode CLEAR when dictionary fills up", () => {
    // Generate enough unique sequences to fill the 16-bit dictionary.
    const data = new Uint8Array(200000);
    for (let i = 0; i < data.length; i++) {
      data[i] = (i * 7 + 13) & 0xff;  // pseudo-random distribution
    }
    const compressed = compressLzw(data, DEFAULT_OPTIONS);
    const header = buildHeader(DEFAULT_OPTIONS);
    const fullFile = new Uint8Array(header.length + compressed.length);
    fullFile.set(header, 0);
    fullFile.set(compressed, header.length);
    const decompressed = decompressLzw(fullFile, parseHeader(fullFile));
    expect(decompressed).toEqual(data);
  });
});

// ===== compressZ / decompressZ =====

describe("z-compressor compressZ / decompressZ", () => {
  it("round-trips via top-level functions", () => {
    const data = new TextEncoder().encode("This is a test of the .Z compressor. It should round-trip.");
    const result = compressZ(data, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isZMagic(result.output)).toBe(true);
      const dec = decompressZ(result.output);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.output).toEqual(data);
    }
  });
  it("returns error for empty input", () => {
    const result = compressZ(new Uint8Array(0), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
  });
  it("returns error for non-.Z input on decompress", () => {
    const result = decompressZ(new Uint8Array([0x1f, 0x8b, 0x08]));
    expect(result.ok).toBe(false);
  });
  it("returns error for truncated .Z file", () => {
    const result = decompressZ(new Uint8Array([0x1f, 0x9d, 0x90]));
    expect(result.ok).toBe(false);
  });
  it("preserves custom options in header", () => {
    const data = new TextEncoder().encode("options test");
    const opts: ZOptions = { maxBits: 12, blockMode: false };
    const result = compressZ(data, opts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const h = parseHeader(result.output);
      expect(h.maxBits).toBe(12);
      expect(h.blockMode).toBe(false);
    }
  });
});

// ===== computeStats =====

describe("z-compressor computeStats", () => {
  it("computes compression stats", () => {
    const stats = computeStats(1000, 600, "compress");
    expect(stats.ratio).toBeCloseTo(0.6);
    expect(stats.saved).toBe(400);
    expect(stats.savedPercent).toBe(40);
  });
  it("computes decompression stats", () => {
    const stats = computeStats(600, 1000, "decompress");
    expect(stats.ratio).toBeCloseTo(0.6);
    expect(stats.saved).toBe(400);
  });
  it("handles zero input", () => {
    const stats = computeStats(0, 100, "compress");
    expect(stats.ratio).toBe(0);
    expect(stats.saved).toBe(-100);
  });
});

// ===== hexPreview =====

describe("z-compressor hexPreview", () => {
  it("formats bytes as hex dump", () => {
    const bytes = new Uint8Array([0x1f, 0x9d, 0x90, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const hex = hexPreview(bytes);
    expect(hex).toContain("1f 9d 90");
    expect(hex).toContain("Hello");
  });
  it("truncates long input", () => {
    const bytes = new Uint8Array(500);
    const hex = hexPreview(bytes, 32);
    expect(hex).toContain("more bytes)");
  });
});

// ===== detectMode =====

describe("z-compressor detectMode", () => {
  it("detects decompress from magic bytes", () => {
    expect(detectMode("file.txt", new Uint8Array([0x1f, 0x9d, 0x90, 0x00]))).toBe("decompress");
  });
  it("detects decompress from .Z extension", () => {
    expect(detectMode("file.Z", new Uint8Array([0x00, 0x01, 0x02]))).toBe("decompress");
  });
  it("detects decompress from .taz extension", () => {
    expect(detectMode("file.taz", new Uint8Array([0x00, 0x01, 0x02]))).toBe("decompress");
  });
  it("defaults to compress for plain files", () => {
    expect(detectMode("file.txt", new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe("compress");
  });
});

// ===== Batch operations =====

describe("z-compressor batch operations", () => {
  it("batchCompress compresses multiple files", () => {
    const files = [
      { name: "a.txt", data: new TextEncoder().encode("aaaaaaaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbbbbbb") },
    ];
    const results = batchCompress(files, DEFAULT_OPTIONS);
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[0].outputName).toBe("a.txt.Z");
    expect(results[1].outputName).toBe("b.txt.Z");
  });
  it("batchDecompress decompresses multiple files", () => {
    const files = [
      { name: "a.txt", data: new TextEncoder().encode("aaaaaaaa") },
    ];
    const compressed = batchCompress(files, DEFAULT_OPTIONS);
    const toDecompress = compressed.map((r) => ({ name: r.outputName, data: r.output! }));
    const results = batchDecompress(toDecompress);
    expect(results[0].ok).toBe(true);
    expect(results[0].outputName).toBe("a.txt");
    expect(results[0].output).toEqual(new TextEncoder().encode("aaaaaaaa"));
  });
  it("batchDecompress strips .taz and produces .tar", () => {
    const data = new TextEncoder().encode("hello world");
    const compressed = compressZ(data, DEFAULT_OPTIONS);
    if (!compressed.ok) throw new Error("compress failed");
    const results = batchDecompress([{ name: "archive.taz", data: compressed.output }]);
    expect(results[0].outputName).toBe("archive.tar");
  });
  it("returns error for empty file in batchCompress", () => {
    const results = batchCompress([{ name: "empty.txt", data: new Uint8Array(0) }], DEFAULT_OPTIONS);
    expect(results[0].ok).toBe(false);
  });
});

// ===== formatBytes =====

describe("z-compressor formatBytes", () => {
  it("formats byte counts", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(100)).toBe("100 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

// ===== History (localStorage) =====

describe("z-compressor history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });
  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "a.txt", mode: "compress",
      inputSize: 1000, outputSize: 500, savedPercent: 50,
      processedAt: "2026-01-01",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.txt");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveToHistory({
        fileName: `a${i}.txt`, mode: "compress",
        inputSize: 100, outputSize: 50, savedPercent: 50,
        processedAt: "2026-01-01",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveToHistory({ fileName: "x", mode: "compress", inputSize: 1, outputSize: 1, savedPercent: 0, processedAt: "now" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("z-compressor share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = globalThis as unknown;
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/z-compressor",
    };
  });
  it("builds share URL with options", () => {
    const url = buildShareUrl({ maxBits: 14, blockMode: false });
    expect(url).toContain("bits=14");
    expect(url).toContain("block=0");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ maxBits: 12, blockMode: true });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.maxBits).toBe(12);
    expect(parsed?.blockMode).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("clamps out-of-range bits", () => {
    const parsed = parseShareUrl("#bits=99&block=1");
    expect(parsed?.maxBits).toBe(16);
  });
  it("defaults to 16 bits for invalid bits", () => {
    const parsed = parseShareUrl("#bits=abc&block=1");
    expect(parsed?.maxBits).toBe(16);
  });
});
