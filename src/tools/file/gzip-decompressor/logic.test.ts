import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GZIP_MAGIC1, GZIP_MAGIC2, FNAME, FEXTRA, FCOMMENT, FHCRC,
  isGzipMagic, parseGzipHeader, decompressGzip, guessOutputFilename,
  parseTarEntries, extractTarEntry, isTarArchive,
  detectMime, looksLikeText, previewBytes,
  computeStat, formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  decompressOne, decompressBatch,
  createZipBlob,
} from "./logic";
import {
  buildGzipHeader, compressGzip, compressGzipWithFilename, buildTarArchive, type TarEntry,
} from "../gzip-compressor/logic";

// DecompressionStream-backed tests that intentionally feed invalid input can
// leave the underlying zlib Gunzip worker emitting an async error after the
// test completes. Swallow these specific Z_DATA_ERROR rejections so they don't
// crash the test runner.
const unhandledHandlers: Array<(...args: unknown[]) => void> = [];
beforeEach(() => {
  const handler = (err: unknown) => {
    const e = err as { code?: string };
    if (e && typeof e === "object" && e.code === "Z_DATA_ERROR") return;
    // Re-throw other unhandled errors so they aren't silently swallowed.
    throw err;
  };
  unhandledHandlers.push(handler);
  process.on("unhandledRejection", handler as (...args: unknown[]) => void);
  process.on("uncaughtException", handler as (...args: unknown[]) => void);
});
afterEach(() => {
  for (const h of unhandledHandlers.splice(0)) {
    process.off("unhandledRejection", h as (...args: unknown[]) => void);
    process.off("uncaughtException", h as (...args: unknown[]) => void);
  }
});

// ===== isGzipMagic =====

describe("gzip-decompressor isGzipMagic", () => {
  it("returns true for 1f 8b", () => {
    expect(isGzipMagic(new Uint8Array([0x1f, 0x8b]))).toBe(true);
  });
  it("returns false for ZIP magic", () => {
    expect(isGzipMagic(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isGzipMagic(new Uint8Array([0x1f]))).toBe(false);
  });
});

// ===== parseGzipHeader =====

describe("gzip-decompressor parseGzipHeader", () => {
  it("parses a minimal 10-byte header", () => {
    const h = buildGzipHeader();
    const parsed = parseGzipHeader(h);
    expect(parsed.isValid).toBe(true);
    expect(parsed.id1).toBe(GZIP_MAGIC1);
    expect(parsed.id2).toBe(GZIP_MAGIC2);
    expect(parsed.compressionMethod).toBe(8);
    expect(parsed.bodyOffset).toBe(10);
    expect(parsed.filename).toBeNull();
  });
  it("parses FNAME flag and extracts filename", () => {
    const h = buildGzipHeader({ filename: "data.txt" });
    const parsed = parseGzipHeader(h);
    expect(parsed.isValid).toBe(true);
    expect(parsed.flags & FNAME).toBeTruthy();
    expect(parsed.filename).toBe("data.txt");
    expect(parsed.bodyOffset).toBe(10 + 8 + 1);
  });
  it("parses mtime field", () => {
    const h = buildGzipHeader({ mtime: 0x12345678 });
    const parsed = parseGzipHeader(h);
    expect(parsed.mtime).toBe(0x12345678);
  });
  it("parses OS field", () => {
    const h = buildGzipHeader({ os: 7 });
    const parsed = parseGzipHeader(h);
    expect(parsed.os).toBe(7);
  });
  it("returns error for too-short input", () => {
    const parsed = parseGzipHeader(new Uint8Array(5));
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toBeTruthy();
  });
  it("returns error for invalid magic", () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]);
    const parsed = parseGzipHeader(bad);
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("magic");
  });
  it("parses FEXTRA field when present", () => {
    // Build a header manually with FEXTRA flag
    const extra = new Uint8Array([0xab, 0xcd]);
    const h = new Uint8Array(10 + 2 + 2 + extra.length);
    h[0] = GZIP_MAGIC1; h[1] = GZIP_MAGIC2; h[2] = 8; h[3] = FEXTRA;
    const dv = new DataView(h.buffer);
    dv.setUint32(4, 0, true); // mtime
    h[8] = 0; h[9] = 3; // xfl, os
    dv.setUint16(10, extra.length, true); // XLEN
    h.set(extra, 12);
    const parsed = parseGzipHeader(h);
    expect(parsed.isValid).toBe(true);
    expect(parsed.extra).not.toBeNull();
    expect(parsed.extra!.length).toBe(2);
    expect(parsed.extra![0]).toBe(0xab);
    expect(parsed.extra![1]).toBe(0xcd);
    expect(parsed.bodyOffset).toBe(10 + 2 + 2);
  });
  it("parses FNAME + FCOMMENT together", () => {
    // Manually build header with FNAME + FCOMMENT
    const name = new TextEncoder().encode("file.txt");
    const comment = new TextEncoder().encode("a comment");
    const h = new Uint8Array(10 + name.length + 1 + comment.length + 1);
    h[0] = GZIP_MAGIC1; h[1] = GZIP_MAGIC2; h[2] = 8; h[3] = FNAME | FCOMMENT;
    const dv = new DataView(h.buffer);
    dv.setUint32(4, 0, true); h[8] = 0; h[9] = 3;
    h.set(name, 10); h[10 + name.length] = 0;
    h.set(comment, 10 + name.length + 1); h[10 + name.length + 1 + comment.length] = 0;
    const parsed = parseGzipHeader(h);
    expect(parsed.isValid).toBe(true);
    expect(parsed.filename).toBe("file.txt");
    expect(parsed.comment).toBe("a comment");
  });
  it("parses FHCRC field (skips 2 bytes)", () => {
    const h = new Uint8Array(10 + 2);
    h[0] = GZIP_MAGIC1; h[1] = GZIP_MAGIC2; h[2] = 8; h[3] = FHCRC;
    const dv = new DataView(h.buffer);
    dv.setUint32(4, 0, true); h[8] = 0; h[9] = 3;
    h[10] = 0x12; h[11] = 0x34;
    const parsed = parseGzipHeader(h);
    expect(parsed.isValid).toBe(true);
    expect(parsed.bodyOffset).toBe(12);
  });
});

// ===== decompressGzip =====

describe("gzip-decompressor decompressGzip", () => {
  it("roundtrips compress → decompress", async () => {
    const data = new TextEncoder().encode("hello world ".repeat(100));
    const compressed = await compressGzip(data);
    const out = await decompressGzip(compressed);
    expect(out).toEqual(data);
  });
  it("throws on invalid GZIP", async () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(decompressGzip(bad)).rejects.toThrow();
  });
  it("decompresses file with embedded filename", async () => {
    const data = new TextEncoder().encode("test data here");
    const compressed = await compressGzipWithFilename(data, "test.txt");
    const out = await decompressGzip(compressed);
    expect(out).toEqual(data);
  });
});

// ===== guessOutputFilename =====

describe("gzip-decompressor guessOutputFilename", () => {
  it("uses filename from header when present", () => {
    const header = parseGzipHeader(buildGzipHeader({ filename: "data.txt" }));
    expect(guessOutputFilename(header, "input.gz")).toBe("data.txt");
  });
  it("strips .gz extension from input name", () => {
    const header = parseGzipHeader(buildGzipHeader());
    expect(guessOutputFilename(header, "data.txt.gz")).toBe("data.txt");
  });
  it("strips .gzip extension", () => {
    const header = parseGzipHeader(buildGzipHeader());
    expect(guessOutputFilename(header, "archive.gzip")).toBe("archive");
  });
  it("falls back to decompressed.bin for non-gz input with no header filename", () => {
    const header = parseGzipHeader(buildGzipHeader());
    expect(guessOutputFilename(header, "weird-name")).toBe("decompressed.bin");
  });
  it("falls back when input filename is empty", () => {
    const header = parseGzipHeader(buildGzipHeader());
    expect(guessOutputFilename(header, "")).toBe("decompressed.bin");
  });
});

// ===== TAR parsing =====

describe("gzip-decompressor parseTarEntries", () => {
  it("parses a single regular file", () => {
    const entries: TarEntry[] = [
      { name: "file.txt", data: new TextEncoder().encode("hello") },
    ];
    const tar = buildTarArchive(entries);
    const parsed = parseTarEntries(tar);
    expect(parsed.length).toBe(1);
    expect(parsed[0]!.name).toBe("file.txt");
    expect(parsed[0]!.size).toBe(5);
    expect(parsed[0]!.typeflag).toBe("0");
    expect(parsed[0]!.isRegularFile).toBe(true);
  });
  it("parses multiple files", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbb") },
      { name: "c.txt", data: new TextEncoder().encode("ccccc") },
    ];
    const tar = buildTarArchive(entries);
    const parsed = parseTarEntries(tar);
    expect(parsed.length).toBe(3);
    expect(parsed.map((e) => e.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
    expect(parsed.map((e) => e.size)).toEqual([3, 4, 5]);
  });
  it("stops at end-of-archive marker", () => {
    const entries: TarEntry[] = [
      { name: "f.txt", data: new TextEncoder().encode("x") },
    ];
    const tar = buildTarArchive(entries);
    const parsed = parseTarEntries(tar);
    // Should only return the one entry, not get confused by trailing zero blocks
    expect(parsed.length).toBe(1);
  });
  it("parses empty archive (just two zero blocks)", () => {
    const tar = new Uint8Array(1024);
    expect(parseTarEntries(tar)).toEqual([]);
  });
  it("reads mode and mtime fields", () => {
    const entries: TarEntry[] = [
      { name: "f.txt", data: new Uint8Array(0), mode: 0o755, mtime: 1234567890 },
    ];
    const tar = buildTarArchive(entries);
    const parsed = parseTarEntries(tar);
    expect(parsed[0]!.mode).toBe(0o755);
    expect(parsed[0]!.mtime).toBe(1234567890);
  });
  it("detects directory typeflag", () => {
    // Manually craft a directory entry
    const header = new Uint8Array(512);
    const enc = new TextEncoder();
    const writeStr = (offset: number, text: string, maxLen: number) => {
      const bytes = enc.encode(text);
      const len = Math.min(bytes.length, maxLen);
      header.set(bytes.subarray(0, len), offset);
    };
    writeStr(0, "mydir/", 100);
    writeStr(100, "0000755\0", 8);
    writeStr(108, "0000000\0", 8);
    writeStr(116, "0000000\0", 8);
    writeStr(124, "00000000000\0", 12);
    writeStr(136, "00000000000\0", 12);
    for (let i = 148; i < 156; i++) header[i] = 0x20;
    writeStr(156, "5", 1); // directory typeflag
    writeStr(257, "ustar", 6);
    writeStr(263, "00", 2);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    writeStr(148, sum.toString(8).padStart(6, "0") + "\0 ", 8);
    const tar = new Uint8Array(1024 + 512);
    tar.set(header, 0);
    const parsed = parseTarEntries(tar);
    expect(parsed.length).toBe(1);
    expect(parsed[0]!.typeflag).toBe("5");
    expect(parsed[0]!.isRegularFile).toBe(false);
    expect(parsed[0]!.typeDescription).toBe("Directory");
  });
});

// ===== extractTarEntry =====

describe("gzip-decompressor extractTarEntry", () => {
  it("extracts file data", () => {
    const data = new TextEncoder().encode("hello world");
    const tar = buildTarArchive([{ name: "file.txt", data }]);
    const entries = parseTarEntries(tar);
    const extracted = extractTarEntry(tar, entries[0]!);
    expect(extracted).toEqual(data);
  });
  it("extracts empty file", () => {
    const tar = buildTarArchive([{ name: "empty.txt", data: new Uint8Array(0) }]);
    const entries = parseTarEntries(tar);
    const extracted = extractTarEntry(tar, entries[0]!);
    expect(extracted.length).toBe(0);
  });
});

// ===== isTarArchive =====

describe("gzip-decompressor isTarArchive", () => {
  it("returns true for TAR archive", () => {
    const tar = buildTarArchive([{ name: "f.txt", data: new TextEncoder().encode("x") }]);
    expect(isTarArchive(tar)).toBe(true);
  });
  it("returns false for non-TAR bytes", () => {
    expect(isTarArchive(new TextEncoder().encode("hello world"))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isTarArchive(new Uint8Array(10))).toBe(false);
  });
});

// ===== detectMime =====

describe("gzip-decompressor detectMime", () => {
  it("detects PNG", () => {
    const m = detectMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(m.mime).toBe("image/png");
    expect(m.isText).toBe(false);
  });
  it("detects JPEG", () => {
    const m = detectMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
    expect(m.mime).toBe("image/jpeg");
  });
  it("detects PDF", () => {
    const m = detectMime(new TextEncoder().encode("%PDF-1.4 hello"));
    expect(m.mime).toBe("application/pdf");
  });
  it("detects ZIP", () => {
    const m = detectMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]));
    expect(m.mime).toBe("application/zip");
  });
  it("detects GZIP", () => {
    const m = detectMime(new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0]));
    expect(m.mime).toBe("application/gzip");
  });
  it("detects ELF binary", () => {
    const m = detectMime(new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]));
    expect(m.mime).toBe("application/x-elf");
  });
  it("detects UTF-8 BOM text", () => {
    const m = detectMime(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]));
    expect(m.isText).toBe(true);
    expect(m.description).toContain("UTF-8");
  });
  it("detects UTF-16LE BOM text", () => {
    const m = detectMime(new Uint8Array([0xff, 0xfe, 0x68, 0x00]));
    expect(m.isText).toBe(true);
  });
  it("detects plain text via heuristic", () => {
    const m = detectMime(new TextEncoder().encode("Hello, world! This is a text file."));
    expect(m.isText).toBe(true);
    expect(m.mime).toBe("text/plain");
  });
  it("detects binary for unknown bytes", () => {
    const m = detectMime(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]));
    expect(m.isText).toBe(false);
    expect(m.mime).toBe("application/octet-stream");
  });
  it("returns empty for empty input", () => {
    const m = detectMime(new Uint8Array(0));
    expect(m.description).toBe("Empty");
  });
});

// ===== looksLikeText =====

describe("gzip-decompressor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("hello world\n"))).toBe(true);
  });
  it("returns false for binary data", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBe(false);
  });
});

// ===== previewBytes =====

describe("gzip-decompressor previewBytes", () => {
  it("produces hex and ASCII", () => {
    const p = previewBytes(new TextEncoder().encode("AB"));
    // Bytes are space-separated in hex view.
    expect(p.hex).toBe("41 42");
    expect(p.ascii).toBe("AB");
    expect(p.previewSize).toBe(2);
    expect(p.truncated).toBe(false);
  });
  it("truncates at maxBytes", () => {
    const data = new TextEncoder().encode("a".repeat(500));
    const p = previewBytes(data, 256);
    expect(p.previewSize).toBe(256);
    expect(p.totalSize).toBe(500);
    expect(p.truncated).toBe(true);
  });
  it("replaces non-printable with dots", () => {
    const p = previewBytes(new Uint8Array([0x00, 0x41]));
    expect(p.ascii).toBe(".A");
  });
});

// ===== computeStat =====

describe("gzip-decompressor computeStat", () => {
  it("computes expansion ratio", () => {
    const s = computeStat("in.gz", "out.txt", 100, 500, "text/plain", "Plain text", true, false, 0);
    expect(s.expansionRatio).toBe(5);
  });
  it("computes compressed fraction", () => {
    const s = computeStat("in.gz", "out.txt", 100, 500, "text/plain", "Plain text", true, false, 0);
    expect(s.compressedFraction).toBe(0.2);
  });
  it("handles zero compressed size", () => {
    const s = computeStat("in.gz", "out.txt", 0, 100, "text/plain", "Plain text", true, false, 0);
    expect(s.expansionRatio).toBe(0);
  });
});

// ===== formatBytes / formatRatio =====

describe("gzip-decompressor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("gzip-decompressor formatRatio", () => {
  it("formats ratio", () => {
    expect(formatRatio(3.5)).toBe("3.50×");
  });
});

// ===== History (localStorage) =====

describe("gzip-decompressor history", () => {
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
      fileCount: 2, totalCompressed: 100, totalDecompressed: 500,
      tarExtracted: true, decompressedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, totalCompressed: 100, totalDecompressed: 500,
        tarExtracted: false, decompressedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, totalCompressed: 100, totalDecompressed: 500,
      tarExtracted: false, decompressedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("gzip-decompressor share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/gzip-decompressor",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ autoExtractTar: true, customOutputName: "out.txt" });
    expect(url).toContain("tar=true");
    expect(url).toContain("out=out.txt");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ autoExtractTar: false, customOutputName: "x.bin" });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.autoExtractTar).toBe(false);
    expect(parsed?.customOutputName).toBe("x.bin");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});

// ===== createZipBlob =====

describe("gzip-decompressor createZipBlob", () => {
  it("creates ZIP signature", async () => {
    const blob = createZipBlob([
      { name: "a.txt", data: new Uint8Array([1, 2, 3]) },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ===== decompressOne =====

describe("gzip-decompressor decompressOne", () => {
  it("decompresses a GZIP file and extracts filename", async () => {
    const data = new TextEncoder().encode("hello world".repeat(20));
    const compressed = await compressGzipWithFilename(data, "hello.txt");
    const out = await decompressOne({ fileName: "hello.txt.gz", data: compressed }, false);
    expect(out.outputFileName).toBe("hello.txt");
    expect(out.data).toEqual(data);
    expect(out.stat.compressedSize).toBe(compressed.length);
    expect(out.stat.decompressedSize).toBe(data.length);
    expect(out.stat.expansionRatio).toBeGreaterThan(1);
  });
  it("auto-extracts TAR archive from .tar.gz", async () => {
    const tarEntries: TarEntry[] = [
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbb") },
    ];
    const tar = buildTarArchive(tarEntries);
    const compressed = await compressGzip(tar);
    const out = await decompressOne({ fileName: "archive.tar.gz", data: compressed }, true);
    expect(out.stat.isTar).toBe(true);
    expect(out.tarEntries).toBeDefined();
    expect(out.tarEntries!.length).toBe(2);
    expect(out.tarEntries!.map((e) => e.name)).toEqual(["a.txt", "b.txt"]);
  });
  it("throws on non-GZIP input", async () => {
    await expect(decompressOne({ fileName: "x.txt", data: new Uint8Array([0x50, 0x4b]) }, false)).rejects.toThrow();
  });
  it("uses custom output filename when provided", async () => {
    const data = new TextEncoder().encode("hello");
    const compressed = await compressGzip(data);
    const out = await decompressOne({ fileName: "in.gz", data: compressed }, false, "custom-name.txt");
    expect(out.outputFileName).toBe("custom-name.txt");
  });
});

// ===== decompressBatch =====

describe("gzip-decompressor decompressBatch", () => {
  it("decompresses multiple .gz files", async () => {
    const inputs = await Promise.all([
      compressGzipWithFilename(new TextEncoder().encode("aaa"), "a.txt"),
      compressGzipWithFilename(new TextEncoder().encode("bbb"), "b.txt"),
    ]);
    const result = await decompressBatch(
      inputs.map((data, i) => ({ fileName: `f${i}.gz`, data })),
      false,
    );
    expect(result.outputs.length).toBe(2);
    expect(result.outputs[0]!.outputFileName).toBe("a.txt");
    expect(result.outputs[1]!.outputFileName).toBe("b.txt");
    // 2+ outputs → ZIP bundle
    expect(result.blob).not.toBeNull();
  });
  it("returns single blob for one file", async () => {
    const data = await compressGzip(new TextEncoder().encode("hello"));
    const result = await decompressBatch([{ fileName: "f.gz", data }], false);
    expect(result.blob).not.toBeNull();
    expect(result.outputs.length).toBe(1);
  });
  it("reports progress", async () => {
    let lastCurrent = 0;
    let lastTotal = 0;
    const inputs = await Promise.all([
      compressGzip(new TextEncoder().encode("aaa")),
      compressGzip(new TextEncoder().encode("bbb")),
      compressGzip(new TextEncoder().encode("ccc")),
    ]);
    await decompressBatch(
      inputs.map((data, i) => ({ fileName: `f${i}.gz`, data })),
      false,
      (current, total) => { lastCurrent = current; lastTotal = total; },
    );
    expect(lastCurrent).toBe(3);
    expect(lastTotal).toBe(3);
  });
  it("handles errors gracefully", async () => {
    const good = await compressGzip(new TextEncoder().encode("hello"));
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const result = await decompressBatch([
      { fileName: "good.gz", data: good },
      { fileName: "bad.gz", data: bad },
    ], false);
    expect(result.outputs.length).toBe(2);
    expect(result.outputs[0]!.stat.error).toBeUndefined();
    expect(result.outputs[1]!.stat.error).toBeTruthy();
  });
});
