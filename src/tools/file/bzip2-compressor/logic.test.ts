import { describe, it, expect, beforeEach } from "vitest";
import {
  BZIP2_MAGIC_B, BZIP2_MAGIC_Z, BZIP2_BLOCK_MAGIC, BZIP2_END_MAGIC,
  buildBzip2Header, buildBzip2EndMarker, buildBzip2BlockMagic,
  validateBlockSize, getBlockBufferSize,
  rle1Encode, rle1Decode, crc32Bzip2,
  writeU32BE, readU32BE,
  isBzip2Magic, getBlockSizeFromHeader,
  compressBzip2,
  buildTarHeader, buildTarArchive, type TarEntry,
  computeStat, aggregateStats,
  formatBytes, formatPercent, hexPreview,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  compressBatch, createZipBlob,
  type Bzip2BlockSize,
} from "./logic";

// ===== validateBlockSize =====

describe("bzip2-compressor validateBlockSize", () => {
  it("accepts 1", () => { expect(validateBlockSize(1)).toBe(1); });
  it("accepts 9", () => { expect(validateBlockSize(9)).toBe(9); });
  it("rejects 0", () => { expect(() => validateBlockSize(0)).toThrow(); });
  it("rejects 10", () => { expect(() => validateBlockSize(10)).toThrow(); });
  it("rejects non-integer", () => { expect(() => validateBlockSize(5.5)).toThrow(); });
});

// ===== getBlockBufferSize =====

describe("bzip2-compressor getBlockBufferSize", () => {
  it("returns 100KB for size 1", () => {
    expect(getBlockBufferSize(1)).toBe(100 * 1024);
  });
  it("returns 900KB for size 9", () => {
    expect(getBlockBufferSize(9)).toBe(900 * 1024);
  });
  it("scales linearly", () => {
    expect(getBlockBufferSize(5)).toBe(5 * 100 * 1024);
  });
});

// ===== buildBzip2Header =====

describe("bzip2-compressor buildBzip2Header", () => {
  it("writes BZ magic bytes", () => {
    const h = buildBzip2Header();
    expect(h[0]).toBe(BZIP2_MAGIC_B);
    expect(h[1]).toBe(BZIP2_MAGIC_Z);
  });
  it("writes block size digit '9' by default", () => {
    const h = buildBzip2Header();
    expect(h[2]).toBe(0x39); // '9'
  });
  it("writes block size digit '1'", () => {
    const h = buildBzip2Header({ blockSize: 1 });
    expect(h[2]).toBe(0x31); // '1'
  });
  it("writes 'h' Huffman marker", () => {
    const h = buildBzip2Header();
    expect(h[3]).toBe(0x68); // 'h'
  });
  it("header is 4 bytes", () => {
    expect(buildBzip2Header().length).toBe(4);
  });
  it("rejects invalid block size", () => {
    expect(() => buildBzip2Header({ blockSize: 0 as unknown as Bzip2BlockSize })).toThrow();
  });
});

// ===== buildBzip2EndMarker / buildBzip2BlockMagic =====

describe("bzip2-compressor end markers", () => {
  it("end marker is 6 bytes", () => {
    expect(buildBzip2EndMarker().length).toBe(6);
  });
  it("end marker has correct magic", () => {
    const m = buildBzip2EndMarker();
    expect(Array.from(m)).toEqual(BZIP2_END_MAGIC);
  });
  it("block magic is 6 bytes", () => {
    expect(buildBzip2BlockMagic().length).toBe(6);
  });
  it("block magic has correct bytes", () => {
    const m = buildBzip2BlockMagic();
    expect(Array.from(m)).toEqual(BZIP2_BLOCK_MAGIC);
  });
});

// ===== RLE1 encode/decode =====

describe("bzip2-compressor rle1Encode/rle1Decode", () => {
  it("encodes a run of 4 bytes", () => {
    const input = new Uint8Array([1, 1, 1, 1]);
    const encoded = rle1Encode(input);
    // Should be: 1 1 1 1 0 (4 bytes + count of 0 additional)
    expect(Array.from(encoded)).toEqual([1, 1, 1, 1, 0]);
  });
  it("encodes a run of 5 bytes", () => {
    const input = new Uint8Array([2, 2, 2, 2, 2]);
    const encoded = rle1Encode(input);
    expect(Array.from(encoded)).toEqual([2, 2, 2, 2, 1]);
  });
  it("does not encode runs of 3 bytes", () => {
    const input = new Uint8Array([3, 3, 3]);
    const encoded = rle1Encode(input);
    expect(Array.from(encoded)).toEqual([3, 3, 3]);
  });
  it("roundtrips text data", () => {
    const input = new TextEncoder().encode("hello world aaa bbb cccc ddddd");
    const encoded = rle1Encode(input);
    const decoded = rle1Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });
  it("roundtrips data with no runs", () => {
    const input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const decoded = rle1Decode(rle1Encode(input));
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });
  it("roundtrips data with many runs", () => {
    const input = new Uint8Array([
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      1, 2, 3,
      9, 9, 9, 9, 9, 9, 9, 9,
    ]);
    const decoded = rle1Decode(rle1Encode(input));
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });
  it("caps run length at 255", () => {
    const input = new Uint8Array(300).fill(7);
    const encoded = rle1Encode(input);
    // First 4+255 = 259 bytes are encoded as 4 bytes + count 255 (5 bytes total)
    // Remaining 41 bytes are encoded as 4 bytes + count 37 (5 bytes)
    expect(encoded.length).toBeLessThan(input.length);
    expect(rle1Decode(encoded).length).toBe(input.length);
  });
});

// ===== crc32Bzip2 =====

describe("bzip2-compressor crc32Bzip2", () => {
  it("returns the initial CRC value for empty input", () => {
    expect(crc32Bzip2(new Uint8Array(0))).toBe(0xffffffff);
  });
  it("returns a 32-bit unsigned value", () => {
    const crc = crc32Bzip2(new TextEncoder().encode("hello"));
    expect(crc).toBeGreaterThanOrEqual(0);
    expect(crc).toBeLessThanOrEqual(0xffffffff);
  });
  it("computes deterministic CRC", () => {
    const data = new TextEncoder().encode("test input");
    expect(crc32Bzip2(data)).toBe(crc32Bzip2(data));
  });
  it("differs for different inputs", () => {
    expect(crc32Bzip2(new TextEncoder().encode("hello"))).not.toBe(crc32Bzip2(new TextEncoder().encode("world")));
  });
});

// ===== writeU32BE / readU32BE =====

describe("bzip2-compressor writeU32BE/readU32BE", () => {
  it("writes big-endian", () => {
    const bytes = writeU32BE(0x12345678);
    expect(Array.from(bytes)).toEqual([0x12, 0x34, 0x56, 0x78]);
  });
  it("roundtrips via readU32BE", () => {
    const bytes = writeU32BE(0xdeadbeef);
    expect(readU32BE(bytes, 0)).toBe(0xdeadbeef);
  });
});

// ===== isBzip2Magic / getBlockSizeFromHeader =====

describe("bzip2-compressor isBzip2Magic", () => {
  it("returns true for BZ prefix", () => {
    expect(isBzip2Magic(new Uint8Array([0x42, 0x5a, 0x39, 0x68]))).toBe(true);
  });
  it("returns false for GZ prefix", () => {
    expect(isBzip2Magic(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isBzip2Magic(new Uint8Array([0x42, 0x5a]))).toBe(false);
  });
});

describe("bzip2-compressor getBlockSizeFromHeader", () => {
  it("extracts size 9", () => {
    const h = buildBzip2Header({ blockSize: 9 });
    expect(getBlockSizeFromHeader(h)).toBe(9);
  });
  it("extracts size 1", () => {
    const h = buildBzip2Header({ blockSize: 1 });
    expect(getBlockSizeFromHeader(h)).toBe(1);
  });
  it("returns null for invalid magic", () => {
    expect(getBlockSizeFromHeader(new Uint8Array([0x00, 0x00, 0x39, 0x68]))).toBe(null);
  });
});

// ===== compressBzip2 =====

describe("bzip2-compressor compressBzip2", () => {
  it("produces output starting with BZ magic", () => {
    const data = new TextEncoder().encode("hello world");
    const out = compressBzip2(data);
    expect(out[0]).toBe(BZIP2_MAGIC_B);
    expect(out[1]).toBe(BZIP2_MAGIC_Z);
  });
  it("includes block size digit", () => {
    const data = new TextEncoder().encode("test");
    const out = compressBzip2(data, { blockSize: 5 });
    expect(out[2]).toBe(0x35); // '5'
  });
  it("includes 'h' marker after block size", () => {
    const out = compressBzip2(new TextEncoder().encode("x"));
    expect(out[3]).toBe(0x68);
  });
  it("includes block magic after header", () => {
    const out = compressBzip2(new TextEncoder().encode("test"));
    // bytes 4-9 should be the block magic
    expect(Array.from(out.subarray(4, 10))).toEqual(BZIP2_BLOCK_MAGIC);
  });
  it("includes end-of-stream marker", () => {
    const out = compressBzip2(new TextEncoder().encode("test"));
    const end = out.subarray(out.length - 10, out.length - 4);
    expect(Array.from(end)).toEqual(BZIP2_END_MAGIC);
  });
  it("is non-empty for empty input", () => {
    const out = compressBzip2(new Uint8Array(0));
    expect(out.length).toBeGreaterThan(10);
  });
});

// ===== TAR building =====

describe("bzip2-compressor buildTarHeader", () => {
  it("produces 512-byte block", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(10) });
    expect(h.length).toBe(512);
  });
  it("writes ustar magic at offset 257", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(0) });
    const magic = new TextDecoder().decode(h.subarray(257, 263));
    expect(magic.startsWith("ustar")).toBe(true);
  });
});

describe("bzip2-compressor buildTarArchive", () => {
  it("length is multiple of 512", () => {
    const tar = buildTarArchive([{ name: "f.txt", data: new TextEncoder().encode("x") }]);
    expect(tar.length % 512).toBe(0);
  });
  it("includes end-of-archive (1024 zero bytes)", () => {
    const tar = buildTarArchive([{ name: "f.txt", data: new TextEncoder().encode("x") }]);
    const tail = tar.subarray(tar.length - 1024);
    let allZero = true;
    for (const b of tail) { if (b !== 0) { allZero = false; break; } }
    expect(allZero).toBe(true);
  });
});

// ===== computeStat / aggregateStats =====

describe("bzip2-compressor computeStat", () => {
  it("computes saved bytes", () => {
    const s = computeStat("file.txt", 1000, 300);
    expect(s.savedBytes).toBe(700);
  });
  it("computes ratio", () => {
    const s = computeStat("file.txt", 1000, 300);
    expect(s.ratio).toBeCloseTo(0.7, 5);
  });
  it("clamps savedBytes to 0 when output larger", () => {
    const s = computeStat("file.txt", 100, 200);
    expect(s.savedBytes).toBe(0);
  });
});

describe("bzip2-compressor aggregateStats", () => {
  it("sums sizes across files", () => {
    const stats = [computeStat("a.txt", 1000, 500), computeStat("b.txt", 2000, 800)];
    const agg = aggregateStats(stats);
    expect(agg.fileCount).toBe(2);
    expect(agg.totalOriginal).toBe(3000);
    expect(agg.totalCompressed).toBe(1300);
  });
});

// ===== formatBytes / formatPercent =====

describe("bzip2-compressor formatBytes/formatPercent", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats percent", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
  });
});

// ===== hexPreview =====

describe("bzip2-compressor hexPreview", () => {
  it("formats empty input", () => {
    expect(hexPreview(new Uint8Array(0))).toBe("");
  });
  it("formats non-empty input", () => {
    const out = hexPreview(new Uint8Array([0x42, 0x5a, 0x39, 0x68]));
    expect(out).toContain("42");
    expect(out).toContain("BZ9h");
  });
  it("respects maxBytes limit", () => {
    const out = hexPreview(new Uint8Array(100).fill(0x41), 16);
    const lines = out.split("\n");
    expect(lines.length).toBe(1);
  });
});

// ===== History (localStorage) =====

describe("bzip2-compressor history", () => {
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
      fileCount: 3, totalOriginal: 1000, totalCompressed: 300, totalSaved: 700,
      ratio: 0.7, blockSize: 9, mode: "single", outputFileName: "out.zip",
      compressedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, totalOriginal: 100, totalCompressed: 50, totalSaved: 50,
        ratio: 0.5, blockSize: 9, mode: "single", outputFileName: `f${i}.bz2`,
        compressedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, totalOriginal: 100, totalCompressed: 50, totalSaved: 50,
      ratio: 0.5, blockSize: 9, mode: "single", outputFileName: "x.bz2",
      compressedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("bzip2-compressor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/bzip2-compressor",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ blockSize: 5, mode: "tar-bz2", outputFileName: "archive.tar.bz2" });
    expect(url).toContain("bs=5");
    expect(url).toContain("mode=tar-bz2");
    expect(url).toContain("out=archive.tar.bz2");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ blockSize: 3, mode: "single", outputFileName: "out.bz2" });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.blockSize).toBe(3);
    expect(parsed?.mode).toBe("single");
    expect(parsed?.outputFileName).toBe("out.bz2");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("defaults to block size 9 for invalid value", () => {
    expect(parseShareUrl("#bs=99&mode=single")?.blockSize).toBe(9);
  });
});

// ===== compressBatch =====

describe("bzip2-compressor compressBatch", () => {
  it("compresses single file (mode=single)", async () => {
    const result = compressBatch(
      [{ fileName: "data.txt", data: new TextEncoder().encode("hello world".repeat(20)) }],
      "single", "out.bz2", 9,
    );
    expect(result.stats.fileCount).toBe(1);
    expect(result.blob.type).toBe("application/x-bzip2");
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(BZIP2_MAGIC_B);
  });
  it("throws on empty input", () => {
    expect(() => compressBatch([], "single", "out")).toThrow();
  });
  it("creates .tar.bz2 archive (mode=tar-bz2)", async () => {
    const result = compressBatch(
      [
        { fileName: "a.txt", data: new TextEncoder().encode("hello") },
        { fileName: "b.txt", data: new TextEncoder().encode("world") },
      ],
      "tar-bz2", "archive.tar.bz2", 9,
    );
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(BZIP2_MAGIC_B);
    expect(buf[1]).toBe(BZIP2_MAGIC_Z);
    expect(result.outputFileName).toBe("archive.tar.bz2");
  });
  it("provides hex preview", () => {
    const result = compressBatch(
      [{ fileName: "data.txt", data: new TextEncoder().encode("test") }],
      "single", "out.bz2", 9,
    );
    expect(result.preview).toContain("42");
  });
});

// ===== createZipBlob =====

describe("bzip2-compressor createZipBlob", () => {
  it("creates ZIP signature", async () => {
    const blob = createZipBlob([{ name: "a.bz2", data: new Uint8Array([1, 2, 3]) }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
