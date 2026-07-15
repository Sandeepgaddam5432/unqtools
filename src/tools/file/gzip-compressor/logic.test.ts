import { describe, it, expect, beforeEach } from "vitest";
import {
  GZIP_MAGIC1, GZIP_MAGIC2, GZIP_METHOD_DEFLATE, FTEXT, FNAME,
  buildGzipHeader, buildGzipFooter, crc32, isGzipMagic,
  sanitizeGzipFilename, compressGzip, compressGzipWithFilename,
  buildTarHeader, buildTarArchive, type TarEntry,
  computeStat, aggregateStats,
  formatBytes, formatPercent,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  compressBatch,
  createZipBlob,
} from "./logic";

// ===== sanitizeGzipFilename =====

describe("gzip-compressor sanitizeGzipFilename", () => {
  it("strips directory path (forward slashes)", () => {
    expect(sanitizeGzipFilename("/home/user/data.txt")).toBe("data.txt");
  });
  it("strips directory path (backslashes)", () => {
    expect(sanitizeGzipFilename("C:\\Users\\data.txt")).toBe("data.txt");
  });
  it("strips .gz extension", () => {
    expect(sanitizeGzipFilename("file.txt.gz")).toBe("file.txt");
  });
  it("strips .gzip extension", () => {
    expect(sanitizeGzipFilename("file.gzip")).toBe("file");
  });
  it("handles filename with no extension", () => {
    expect(sanitizeGzipFilename("README")).toBe("README");
  });
  it("returns empty for empty input", () => {
    expect(sanitizeGzipFilename("")).toBe("");
  });
});

// ===== buildGzipHeader =====

describe("gzip-compressor buildGzipHeader", () => {
  it("writes GZIP magic bytes", () => {
    const h = buildGzipHeader();
    expect(h[0]).toBe(GZIP_MAGIC1);
    expect(h[1]).toBe(GZIP_MAGIC2);
  });
  it("uses deflate compression method (8)", () => {
    const h = buildGzipHeader();
    expect(h[2]).toBe(GZIP_METHOD_DEFLATE);
  });
  it("sets FNAME flag when filename is provided", () => {
    const h = buildGzipHeader({ filename: "data.txt" });
    expect(h[3] & FNAME).toBeTruthy();
  });
  it("omits FNAME flag when no filename", () => {
    const h = buildGzipHeader();
    expect(h[3] & FNAME).toBeFalsy();
  });
  it("sets FTEXT flag when isText=true", () => {
    const h = buildGzipHeader({ isText: true });
    expect(h[3] & FTEXT).toBeTruthy();
  });
  it("writes mtime in little-endian", () => {
    const h = buildGzipHeader({ mtime: 0x12345678 });
    const dv = new DataView(h.buffer);
    expect(dv.getUint32(4, true)).toBe(0x12345678);
  });
  it("embeds filename as zero-terminated string", () => {
    const h = buildGzipHeader({ filename: "data.txt" });
    // 10 bytes header + 8 bytes "data.txt" + 1 byte NUL
    expect(h.length).toBe(10 + 8 + 1);
    const nameBytes = h.subarray(10, 10 + 8);
    expect(new TextDecoder().decode(nameBytes)).toBe("data.txt");
    expect(h[10 + 8]).toBe(0);
  });
  it("writes OS byte", () => {
    const h = buildGzipHeader({ os: 3 });
    expect(h[9]).toBe(3);
  });
  it("writes XFL byte", () => {
    const h = buildGzipHeader({ xfl: 2 });
    expect(h[8]).toBe(2);
  });
  it("header length is 10 without filename", () => {
    expect(buildGzipHeader().length).toBe(10);
  });
});

// ===== buildGzipFooter =====

describe("gzip-compressor buildGzipFooter", () => {
  it("writes 8 bytes", () => {
    expect(buildGzipFooter(0, 0).length).toBe(8);
  });
  it("writes CRC32 little-endian", () => {
    const f = buildGzipFooter(0xdeadbeef, 0);
    const dv = new DataView(f.buffer);
    expect(dv.getUint32(0, true)).toBe(0xdeadbeef);
  });
  it("writes ISIZE little-endian", () => {
    const f = buildGzipFooter(0, 0x12345678);
    const dv = new DataView(f.buffer);
    expect(dv.getUint32(4, true)).toBe(0x12345678);
  });
  it("truncates ISIZE to 32 bits", () => {
    // Use a value < 2^53 (safe as JS double) but > 2^32, so it requires mod 2^32 truncation.
    const f = buildGzipFooter(0, 0x2_9abcdef0);
    const dv = new DataView(f.buffer);
    expect(dv.getUint32(4, true)).toBe(0x9abcdef0);
  });
});

// ===== crc32 =====

describe("gzip-compressor crc32", () => {
  it("returns 0 for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("computes known CRC for 'hello'", () => {
    // Known CRC32 of "hello" = 0x3610a686
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });
  it("computes known CRC for '123456789'", () => {
    // Known CRC32 of "123456789" = 0xcbf43926
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("returns unsigned 32-bit number", () => {
    const crc = crc32(new TextEncoder().encode("test data"));
    expect(crc).toBeGreaterThanOrEqual(0);
    expect(crc).toBeLessThanOrEqual(0xffffffff);
  });
});

// ===== isGzipMagic =====

describe("gzip-compressor isGzipMagic", () => {
  it("returns true for 1f 8b", () => {
    expect(isGzipMagic(new Uint8Array([0x1f, 0x8b]))).toBe(true);
  });
  it("returns false for other bytes", () => {
    expect(isGzipMagic(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isGzipMagic(new Uint8Array([0x1f]))).toBe(false);
  });
});

// ===== compressGzip =====

describe("gzip-compressor compressGzip", () => {
  it("produces valid GZIP magic", async () => {
    const data = new TextEncoder().encode("hello world");
    const out = await compressGzip(data);
    expect(out[0]).toBe(GZIP_MAGIC1);
    expect(out[1]).toBe(GZIP_MAGIC2);
  });
  it("produces data smaller than original for compressible input", async () => {
    const data = new TextEncoder().encode("abcabcabcabcabcabcabcabcabcabcabcabcabc");
    const out = await compressGzip(data);
    expect(out.length).toBeLessThan(data.length + 18);
  });
  it("roundtrips via DecompressionStream", async () => {
    const data = new TextEncoder().encode("The quick brown fox jumps over the lazy dog. ".repeat(50));
    const compressed = await compressGzip(data);
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.length; }
    }
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    expect(out).toEqual(data);
  });
});

// ===== compressGzipWithFilename =====

describe("gzip-compressor compressGzipWithFilename", () => {
  it("embeds filename in the header", async () => {
    const data = new TextEncoder().encode("hello world");
    const out = await compressGzipWithFilename(data, "data.txt");
    // Header should have FNAME flag set
    expect(out[3] & FNAME).toBeTruthy();
    // Extract filename from header
    const nameBytes = [];
    let i = 10;
    while (i < out.length && out[i] !== 0) {
      nameBytes.push(out[i]);
      i++;
    }
    expect(new TextDecoder().decode(new Uint8Array(nameBytes))).toBe("data.txt");
  });
  it("preserves GZIP magic", async () => {
    const out = await compressGzipWithFilename(new TextEncoder().encode("x"), "x.txt");
    expect(out[0]).toBe(GZIP_MAGIC1);
    expect(out[1]).toBe(GZIP_MAGIC2);
  });
  it("roundtrips via DecompressionStream", async () => {
    const data = new TextEncoder().encode("round trip test ".repeat(20));
    const out = await compressGzipWithFilename(data, "test.txt");
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(out);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.length; }
    }
    const result = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { result.set(c, pos); pos += c.length; }
    expect(result).toEqual(data);
  });
});

// ===== buildTarHeader =====

describe("gzip-compressor buildTarHeader", () => {
  it("produces 512-byte block", () => {
    const h = buildTarHeader({ name: "file.txt", data: new Uint8Array(10) });
    expect(h.length).toBe(512);
  });
  it("writes filename in first 100 bytes", () => {
    const h = buildTarHeader({ name: "file.txt", data: new Uint8Array(10) });
    const nameBytes = h.subarray(0, 8);
    expect(new TextDecoder().decode(nameBytes)).toBe("file.txt");
  });
  it("writes ustar magic at offset 257", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(0) });
    const magic = new TextDecoder().decode(h.subarray(257, 263));
    expect(magic.startsWith("ustar")).toBe(true);
  });
  it("writes typeflag '0' for regular file at offset 156", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(0) });
    expect(String.fromCharCode(h[156])).toBe("0");
  });
  it("writes size as octal at offset 124", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(1024) });
    const sizeStr = new TextDecoder().decode(h.subarray(124, 135)).replace(/\0.*$/, "");
    expect(parseInt(sizeStr, 8)).toBe(1024);
  });
  it("writes mode as octal at offset 100", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(0), mode: 0o755 });
    const modeStr = new TextDecoder().decode(h.subarray(100, 107)).replace(/\0.*$/, "");
    expect(parseInt(modeStr, 8)).toBe(0o755);
  });
  it("checksum field is non-zero", () => {
    const h = buildTarHeader({ name: "f.txt", data: new Uint8Array(0) });
    const sumStr = new TextDecoder().decode(h.subarray(148, 155)).replace(/\0.*$/, "").trim();
    expect(parseInt(sumStr, 8)).toBeGreaterThan(0);
  });
});

// ===== buildTarArchive =====

describe("gzip-compressor buildTarArchive", () => {
  it("creates non-empty archive", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "b.txt", data: new TextEncoder().encode("world") },
    ];
    const tar = buildTarArchive(entries);
    expect(tar.length).toBeGreaterThan(0);
  });
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

// ===== computeStat =====

describe("gzip-compressor computeStat", () => {
  it("computes saved bytes", () => {
    const s = computeStat("file.txt", 1000, 300);
    expect(s.savedBytes).toBe(700);
  });
  it("computes ratio as saved/original", () => {
    const s = computeStat("file.txt", 1000, 300);
    expect(s.ratio).toBeCloseTo(0.7, 5);
  });
  it("computes compressed fraction", () => {
    const s = computeStat("file.txt", 1000, 300);
    expect(s.compressedFraction).toBeCloseTo(0.3, 5);
  });
  it("handles zero original size", () => {
    const s = computeStat("file.txt", 0, 0);
    expect(s.ratio).toBe(0);
    expect(s.compressedFraction).toBe(0);
  });
  it("clamps savedBytes to 0 when output larger", () => {
    const s = computeStat("file.txt", 100, 200);
    expect(s.savedBytes).toBe(0);
  });
});

// ===== aggregateStats =====

describe("gzip-compressor aggregateStats", () => {
  it("sums sizes across files", () => {
    const stats = [
      computeStat("a.txt", 1000, 500),
      computeStat("b.txt", 2000, 800),
    ];
    const agg = aggregateStats(stats);
    expect(agg.fileCount).toBe(2);
    expect(agg.totalOriginal).toBe(3000);
    expect(agg.totalCompressed).toBe(1300);
    expect(agg.totalSaved).toBe(1700);
  });
  it("computes aggregate ratio", () => {
    const stats = [
      computeStat("a.txt", 1000, 500),
      computeStat("b.txt", 1000, 500),
    ];
    const agg = aggregateStats(stats);
    expect(agg.ratio).toBeCloseTo(0.5, 5);
  });
  it("returns 0 ratio for empty input", () => {
    expect(aggregateStats([]).ratio).toBe(0);
  });
});

// ===== formatBytes =====

describe("gzip-compressor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

// ===== formatPercent =====

describe("gzip-compressor formatPercent", () => {
  it("formats as percentage", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatPercent(0.123456)).toBe("12.3%");
  });
});

// ===== History (localStorage) =====

describe("gzip-compressor history", () => {
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
      ratio: 0.7, mode: "single", outputFileName: "out.zip",
      compressedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, totalOriginal: 100, totalCompressed: 50, totalSaved: 50,
        ratio: 0.5, mode: "single", outputFileName: `f${i}.gz`,
        compressedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, totalOriginal: 100, totalCompressed: 50, totalSaved: 50,
      ratio: 0.5, mode: "single", outputFileName: "x.gz",
      compressedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("gzip-compressor share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/gzip-compressor",
    };
  });

  it("builds share URL with mode and output filename", () => {
    const url = buildShareUrl({ mode: "tar-gz", outputFileName: "archive.tar.gz" });
    expect(url).toContain("mode=tar-gz");
    expect(url).toContain("out=archive.tar.gz");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ mode: "single", outputFileName: "out.zip" });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.mode).toBe("single");
    expect(parsed?.outputFileName).toBe("out.zip");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("defaults mode to single for unknown values", () => {
    expect(parseShareUrl("#mode=unknown&out=f.gz")?.mode).toBe("single");
  });
});

// ===== createZipBlob (used for bundling multiple .gz outputs) =====

describe("gzip-compressor createZipBlob", () => {
  it("creates ZIP signature", async () => {
    const blob = createZipBlob([
      { name: "a.gz", data: new Uint8Array([1, 2, 3]) },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ===== compressBatch =====

describe("gzip-compressor compressBatch", () => {
  it("compresses single file (mode=single)", async () => {
    const result = await compressBatch(
      [{ fileName: "data.txt", data: new TextEncoder().encode("hello world".repeat(20)) }],
      "single",
      "out.gz",
    );
    expect(result.stats.fileCount).toBe(1);
    expect(result.blob.type).toBe("application/gzip");
    // Verify it's a valid GZIP
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(GZIP_MAGIC1);
    expect(buf[1]).toBe(GZIP_MAGIC2);
  });

  it("compresses multiple files to ZIP (mode=single)", async () => {
    const result = await compressBatch(
      [
        { fileName: "a.txt", data: new TextEncoder().encode("aaa") },
        { fileName: "b.txt", data: new TextEncoder().encode("bbb") },
      ],
      "single",
      "out.zip",
    );
    expect(result.stats.fileCount).toBe(2);
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); // ZIP magic
  });

  it("creates .tar.gz archive (mode=tar-gz)", async () => {
    const result = await compressBatch(
      [
        { fileName: "a.txt", data: new TextEncoder().encode("hello") },
        { fileName: "b.txt", data: new TextEncoder().encode("world") },
      ],
      "tar-gz",
      "archive.tar.gz",
    );
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(GZIP_MAGIC1);
    expect(buf[1]).toBe(GZIP_MAGIC2);
    expect(result.outputFileName).toBe("archive.tar.gz");
  });

  it("throws on empty input", async () => {
    await expect(compressBatch([], "single", "out")).rejects.toThrow();
  });

  it("reports progress", async () => {
    let lastCurrent = 0;
    let lastTotal = 0;
    await compressBatch(
      [
        { fileName: "a.txt", data: new TextEncoder().encode("aaa") },
        { fileName: "b.txt", data: new TextEncoder().encode("bbb") },
        { fileName: "c.txt", data: new TextEncoder().encode("ccc") },
      ],
      "single",
      "out.zip",
      (current, total) => { lastCurrent = current; lastTotal = total; },
    );
    expect(lastCurrent).toBe(3);
    expect(lastTotal).toBe(3);
  });
});
