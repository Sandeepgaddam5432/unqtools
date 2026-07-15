import { describe, it, expect, beforeEach } from "vitest";
import { compressBzip2 } from "../bzip2-compressor/logic";
import {
  BZIP2_BLOCK_MAGIC, BZIP2_END_MAGIC,
} from "../bzip2-compressor/logic";
import {
  parseBzip2Header, isBzip2Magic, findBlockMagic, findEndMagic,
  readU32BE, parseBlockHeader, rle1Decode, decompressBzip2,
  guessOutputFilename,
  parseTarEntries, extractTarEntry, isTarArchive,
  detectMime, looksLikeText,
  computeStat, aggregateStats,
  formatBytes, formatPercent, hexPreview,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  decompressBatch, createZipBlob,
} from "./logic";

// Build a valid BZIP2 file from text data using our compressor (roundtrip)
function makeBzip2(text: string): Uint8Array {
  return compressBzip2(new TextEncoder().encode(text), { blockSize: 9 });
}

// ===== parseBzip2Header =====

describe("bzip2-decompressor parseBzip2Header", () => {
  it("parses a valid header", () => {
    const bytes = makeBzip2("hello");
    const h = parseBzip2Header(bytes);
    expect(h.isValid).toBe(true);
    expect(h.blockSize).toBe(9);
    expect(h.huffmanMarker).toBe(0x68);
  });
  it("rejects too-small input", () => {
    const h = parseBzip2Header(new Uint8Array(2));
    expect(h.isValid).toBe(false);
    expect(h.error).toMatch(/too small/i);
  });
  it("rejects non-BZ magic", () => {
    const h = parseBzip2Header(new Uint8Array([0x00, 0x00, 0x39, 0x68]));
    expect(h.isValid).toBe(false);
    expect(h.error).toMatch(/missing 'BZ' magic/i);
  });
  it("rejects invalid block size digit", () => {
    const h = parseBzip2Header(new Uint8Array([0x42, 0x5a, 0x40, 0x68]));
    expect(h.isValid).toBe(false);
    expect(h.error).toMatch(/block size digit/i);
  });
  it("rejects invalid Huffman marker", () => {
    const h = parseBzip2Header(new Uint8Array([0x42, 0x5a, 0x39, 0x00]));
    expect(h.isValid).toBe(false);
    expect(h.error).toMatch(/Huffman marker/i);
  });
  it("sets bodyOffset to 4 for valid header", () => {
    const h = parseBzip2Header(makeBzip2("x"));
    expect(h.bodyOffset).toBe(4);
  });
});

// ===== isBzip2Magic =====

describe("bzip2-decompressor isBzip2Magic", () => {
  it("returns true for BZ prefix", () => {
    expect(isBzip2Magic(new Uint8Array([0x42, 0x5a, 0x39, 0x68]))).toBe(true);
  });
  it("returns false for non-BZ", () => {
    expect(isBzip2Magic(new Uint8Array([0x1f, 0x8b]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isBzip2Magic(new Uint8Array([0x42]))).toBe(false);
  });
});

// ===== findBlockMagic / findEndMagic =====

describe("bzip2-decompressor findBlockMagic", () => {
  it("finds block magic in a valid file", () => {
    const bytes = makeBzip2("test");
    const offset = findBlockMagic(bytes, 4);
    expect(offset).toBe(4);
  });
  it("returns -1 when not found", () => {
    expect(findBlockMagic(new Uint8Array(100), 0)).toBe(-1);
  });
});

describe("bzip2-decompressor findEndMagic", () => {
  it("finds end magic in a valid file", () => {
    const bytes = makeBzip2("test");
    const offset = findEndMagic(bytes, 10);
    expect(offset).toBeGreaterThan(0);
  });
  it("returns -1 when not found", () => {
    expect(findEndMagic(new Uint8Array(100), 0)).toBe(-1);
  });
});

// ===== readU32BE =====

describe("bzip2-decompressor readU32BE", () => {
  it("reads big-endian", () => {
    const bytes = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    expect(readU32BE(bytes, 0)).toBe(0x12345678);
  });
  it("returns unsigned", () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    expect(readU32BE(bytes, 0)).toBe(0xffffffff);
  });
});

// ===== parseBlockHeader =====

describe("bzip2-decompressor parseBlockHeader", () => {
  it("parses a valid block header", () => {
    const bytes = makeBzip2("test");
    const block = parseBlockHeader(bytes, 4);
    expect(block).not.toBeNull();
    expect(block!.blockOffset).toBe(4);
    expect(block!.bodyOffset).toBe(4 + 6 + 4 + 4);
  });
  it("returns null for truncated header", () => {
    const bytes = new Uint8Array(10);
    expect(parseBlockHeader(bytes, 0)).toBeNull();
  });
  it("extracts CRC as big-endian u32", () => {
    const bytes = makeBzip2("test");
    const block = parseBlockHeader(bytes, 4);
    expect(block!.crc).toBeGreaterThanOrEqual(0);
    expect(block!.crc).toBeLessThanOrEqual(0xffffffff);
  });
  it("extracts randomised flag (always false for our compressor)", () => {
    const bytes = makeBzip2("test");
    const block = parseBlockHeader(bytes, 4);
    expect(block!.randomised).toBe(false);
  });
});

// ===== rle1Decode =====

describe("bzip2-decompressor rle1Decode", () => {
  it("decodes a 4-byte run", () => {
    const input = new Uint8Array([1, 1, 1, 1, 0]);
    const decoded = rle1Decode(input);
    expect(Array.from(decoded)).toEqual([1, 1, 1, 1]);
  });
  it("decodes a 5-byte run", () => {
    const input = new Uint8Array([2, 2, 2, 2, 1]);
    const decoded = rle1Decode(input);
    expect(Array.from(decoded)).toEqual([2, 2, 2, 2, 2]);
  });
  it("passes through non-run bytes", () => {
    const input = new Uint8Array([1, 2, 3]);
    const decoded = rle1Decode(input);
    expect(Array.from(decoded)).toEqual([1, 2, 3]);
  });
});

// ===== decompressBzip2 =====

describe("bzip2-decompressor decompressBzip2", () => {
  it("roundtrips a small text file", () => {
    const text = "hello world";
    const compressed = makeBzip2(text);
    const decompressed = decompressBzip2(compressed);
    expect(new TextDecoder().decode(decompressed)).toBe(text);
  });
  it("roundtrips a larger text file", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(100);
    const compressed = makeBzip2(text);
    const decompressed = decompressBzip2(compressed);
    expect(new TextDecoder().decode(decompressed)).toBe(text);
  });
  it("roundtrips binary data", () => {
    const data = new Uint8Array(1024);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const compressed = compressBzip2(data, { blockSize: 9 });
    const decompressed = decompressBzip2(compressed);
    expect(Array.from(decompressed)).toEqual(Array.from(data));
  });
  it("throws on invalid magic", () => {
    expect(() => decompressBzip2(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toThrow();
  });
  it("throws when block magic is missing", () => {
    // Valid header but no block magic
    const bytes = new Uint8Array([0x42, 0x5a, 0x39, 0x68, 0x00, 0x00, 0x00, 0x00]);
    expect(() => decompressBzip2(bytes)).toThrow(/block magic/i);
  });
});

// ===== guessOutputFilename =====

describe("bzip2-decompressor guessOutputFilename", () => {
  it("strips .bz2 extension", () => {
    expect(guessOutputFilename("data.txt.bz2")).toBe("data.txt");
  });
  it("returns default for non-bz2 input", () => {
    expect(guessOutputFilename("file.gz")).toBe("decompressed.bin");
  });
  it("is case-insensitive", () => {
    expect(guessOutputFilename("DATA.BZ2")).toBe("DATA");
  });
});

// ===== TAR parsing =====

describe("bzip2-decompressor isTarArchive", () => {
  it("returns true for TAR magic at offset 257", () => {
    const bytes = new Uint8Array(512);
    bytes.set(new TextEncoder().encode("ustar"), 257);
    expect(isTarArchive(bytes)).toBe(true);
  });
  it("returns false for non-TAR", () => {
    expect(isTarArchive(new Uint8Array(512))).toBe(false);
  });
});

// ===== detectMime =====

describe("bzip2-decompressor detectMime", () => {
  it("detects PNG", () => {
    const m = detectMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
    expect(m.mime).toBe("image/png");
  });
  it("detects PDF", () => {
    const m = detectMime(new TextEncoder().encode("%PDF-1.5"));
    expect(m.mime).toBe("application/pdf");
  });
  it("detects ZIP", () => {
    const m = detectMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(m.mime).toBe("application/zip");
  });
  it("detects plain text", () => {
    const m = detectMime(new TextEncoder().encode("hello world this is plain text"));
    expect(m.isText).toBe(true);
    expect(m.mime).toBe("text/plain");
  });
  it("returns octet-stream for binary", () => {
    const m = detectMime(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]));
    expect(m.mime).toBe("application/octet-stream");
  });
  it("returns empty for empty input", () => {
    const m = detectMime(new Uint8Array(0));
    expect(m.description).toBe("Empty");
  });
});

// ===== looksLikeText =====

describe("bzip2-decompressor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("hello world"))).toBe(true);
  });
  it("returns false for binary data", () => {
    expect(looksLikeText(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))).toBe(false);
  });
});

// ===== computeStat / aggregateStats =====

describe("bzip2-decompressor computeStat", () => {
  it("computes expansion ratio", () => {
    const s = computeStat("file.bz2", 100, 500, 9, false);
    expect(s.expansionRatio).toBe(5);
  });
  it("preserves block size", () => {
    const s = computeStat("file.bz2", 100, 500, 5, false);
    expect(s.blockSize).toBe(5);
  });
  it("marks tar.bz2", () => {
    const s = computeStat("archive.tar.bz2", 100, 500, 9, true);
    expect(s.isTarBz2).toBe(true);
  });
  it("handles zero compressed size", () => {
    const s = computeStat("file.bz2", 0, 0, null, false);
    expect(s.expansionRatio).toBe(0);
  });
});

describe("bzip2-decompressor aggregateStats", () => {
  it("sums sizes", () => {
    const stats = [
      computeStat("a.bz2", 100, 500, 9, false),
      computeStat("b.bz2", 200, 1000, 9, false),
    ];
    const agg = aggregateStats(stats);
    expect(agg.fileCount).toBe(2);
    expect(agg.totalCompressed).toBe(300);
    expect(agg.totalDecompressed).toBe(1500);
  });
});

// ===== formatBytes / formatPercent / hexPreview =====

describe("bzip2-decompressor formatBytes/formatPercent/hexPreview", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats percent", () => {
    expect(formatPercent(2.5)).toBe("250.0%");
  });
  it("formats hex preview", () => {
    const out = hexPreview(new Uint8Array([0x42, 0x5a, 0x39, 0x68]));
    expect(out).toContain("42");
  });
});

// ===== History (localStorage) =====

describe("bzip2-decompressor history", () => {
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
      fileCount: 2, totalCompressed: 200, totalDecompressed: 1500,
      tarBz2Count: 0, decompressedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, totalCompressed: 100, totalDecompressed: 500,
        tarBz2Count: 0, decompressedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, totalCompressed: 100, totalDecompressed: 500,
      tarBz2Count: 0, decompressedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("bzip2-decompressor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/bzip2-decompressor",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ outputFileName: "data.txt", autoExtractTar: true });
    expect(url).toContain("out=data.txt");
    expect(url).toContain("tar=1");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ outputFileName: "out.bin", autoExtractTar: false });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.outputFileName).toBe("out.bin");
    expect(parsed?.autoExtractTar).toBe(false);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});

// ===== decompressBatch =====

describe("bzip2-decompressor decompressBatch", () => {
  it("decompresses a single file", () => {
    const text = "hello world";
    const result = decompressBatch([
      { fileName: "data.txt.bz2", data: makeBzip2(text) },
    ]);
    expect(result.stats.fileCount).toBe(1);
    expect(result.outputFileName).toBe("data.txt");
  });
  it("throws on empty input", () => {
    expect(() => decompressBatch([])).toThrow();
  });
  it("handles multiple files (returns ZIP)", async () => {
    const result = decompressBatch([
      { fileName: "a.txt.bz2", data: makeBzip2("aaa") },
      { fileName: "b.txt.bz2", data: makeBzip2("bbb") },
    ]);
    expect(result.stats.fileCount).toBe(2);
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); // ZIP magic
  });
  it("reports errors for invalid files", () => {
    const result = decompressBatch([
      { fileName: "bad.bz2", data: new Uint8Array([0x00, 0x00, 0x00, 0x00]) },
    ]);
    expect(result.stats.perFile[0]!.error).toBeDefined();
  });
});

// ===== createZipBlob =====

describe("bzip2-decompressor createZipBlob", () => {
  it("creates ZIP signature", async () => {
    const blob = createZipBlob([{ name: "a.txt", data: new Uint8Array([1, 2, 3]) }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
  });
});
