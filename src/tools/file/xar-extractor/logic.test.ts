import { describe, it, expect, beforeEach } from "vitest";
import {
  XAR_MAGIC, XAR_HEADER_SIZE,
  isXarMagic, isXarFile,
  parseHeader, getCksumName,
  decompressZlib, decompressEntryData,
  walkToc, parseXar,
  computeStats, searchEntries, filterByType, buildFileTree,
  detectMimeFromName, createZipBlob,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type XarEntry, type XarTypeFilter,
} from "./logic";

// ===== Helpers =====

/** Compress bytes with zlib (RFC 1950) using CompressionStream. */
async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!CS) throw new Error("CompressionStream not available");
  const blob = new Blob([data as BlobPart]);
  const stream = blob.stream().pipeThrough(new CS("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Build a minimal XAR file with a header + zlib TOC + optional heap data. */
async function makeXarFile(
  tocXml: string,
  heap: Uint8Array = new Uint8Array(0),
  options: { version?: number; cksumAlg?: number } = {},
): Promise<Uint8Array> {
  const version = options.version ?? 1;
  const cksumAlg = options.cksumAlg ?? 0;
  const tocUncompressed = new TextEncoder().encode(tocXml);
  const tocCompressed = await zlibCompress(tocUncompressed);
  const total = XAR_HEADER_SIZE + tocCompressed.length + heap.length;
  const out = new Uint8Array(total);
  // magic
  out.set(XAR_MAGIC, 0);
  const dv = new DataView(out.buffer);
  dv.setUint16(4, XAR_HEADER_SIZE, true);  // header_size
  dv.setUint16(6, version, true);          // version
  // toc_clen (8 bytes LE)
  dv.setUint32(8, tocCompressed.length & 0xffffffff, true);
  dv.setUint32(12, Math.floor(tocCompressed.length / 0x100000000), true);
  // toc_ulen (8 bytes LE)
  dv.setUint32(16, tocUncompressed.length & 0xffffffff, true);
  dv.setUint32(20, Math.floor(tocUncompressed.length / 0x100000000), true);
  // cksum_alg
  dv.setUint32(24, cksumAlg, true);
  out.set(tocCompressed, XAR_HEADER_SIZE);
  out.set(heap, XAR_HEADER_SIZE + tocCompressed.length);
  return out;
}

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null, setItem: () => {}, removeItem: () => {},
    clear: () => {}, key: () => null, length: 0,
  } as Storage;
});

// ===== isXarMagic / isXarFile =====

describe("xar-extractor isXarMagic", () => {
  it("returns true for XAR magic", () => {
    expect(isXarMagic(new Uint8Array(XAR_MAGIC))).toBe(true);
  });
  it("returns false for ZIP magic", () => {
    expect(isXarMagic(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isXarMagic(new Uint8Array([0x78, 0x61]))).toBe(false);
  });
});

describe("xar-extractor isXarFile", () => {
  it("returns true for XAR magic", () => {
    expect(isXarFile(new Uint8Array(XAR_MAGIC))).toBe(true);
  });
  it("returns false for non-XAR", () => {
    expect(isXarFile(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });
});

// ===== parseHeader =====

describe("xar-extractor parseHeader", () => {
  it("parses a valid XAR header", async () => {
    const bytes = await makeXarFile("<toc/>");
    const header = parseHeader(bytes);
    expect(header.isValid).toBe(true);
    expect(header.magic).toEqual(XAR_MAGIC);
    expect(header.headerSize).toBe(XAR_HEADER_SIZE);
    expect(header.version).toBe(1);
    expect(header.cksumAlg).toBe(0);
    expect(header.cksumName).toBe("None");
  });
  it("parses toc_compressed_length", async () => {
    const bytes = await makeXarFile("<toc><file id='1'><name>a</name></file></toc>");
    const header = parseHeader(bytes);
    expect(header.tocCompressedLength).toBeGreaterThan(0);
    expect(header.tocUncompressedLength).toBeGreaterThan(0);
  });
  it("parses version 2", async () => {
    const bytes = await makeXarFile("<toc/>", new Uint8Array(0), { version: 2 });
    expect(parseHeader(bytes).version).toBe(2);
  });
  it("parses cksum_alg 1 (SHA-1)", async () => {
    const bytes = await makeXarFile("<toc/>", new Uint8Array(0), { cksumAlg: 1 });
    expect(parseHeader(bytes).cksumAlg).toBe(1);
    expect(parseHeader(bytes).cksumName).toBe("SHA-1");
  });
  it("returns isValid=false for too-short input", () => {
    const header = parseHeader(new Uint8Array(10));
    expect(header.isValid).toBe(false);
  });
  it("returns isValid=false for non-XAR input", () => {
    const bytes = new Uint8Array(XAR_HEADER_SIZE);
    bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
    const header = parseHeader(bytes);
    expect(header.isValid).toBe(false);
  });
});

// ===== getCksumName =====

describe("xar-extractor getCksumName", () => {
  it("returns names for known algorithms", () => {
    expect(getCksumName(0)).toBe("None");
    expect(getCksumName(1)).toBe("SHA-1");
    expect(getCksumName(2)).toBe("MD5");
    expect(getCksumName(3)).toBe("SHA-256");
    expect(getCksumName(4)).toBe("SHA-512");
  });
  it("returns fallback for unknown algorithm", () => {
    expect(getCksumName(99)).toBe("Algorithm 99");
  });
});

// ===== decompressZlib =====

describe("xar-extractor decompressZlib", () => {
  it("round-trips through zlib", async () => {
    const original = new TextEncoder().encode("Hello XAR world!");
    const compressed = await zlibCompress(original);
    const decompressed = await decompressZlib(compressed);
    expect(decompressed).toEqual(original);
  });
  it("handles larger XML", async () => {
    const xml = `<toc>${Array.from({ length: 50 }, (_, i) => `<file id="${i}"><name>file${i}</name></file>`).join("")}</toc>`;
    const original = new TextEncoder().encode(xml);
    const compressed = await zlibCompress(original);
    const decompressed = await decompressZlib(compressed);
    expect(decompressed).toEqual(original);
  });
});

// ===== walkToc =====

describe("xar-extractor walkToc", () => {
  it("walks a flat TOC", () => {
    const xml = `<toc>
      <file id="1"><name>file1.txt</name><type>file</type><data><size>10</size><length>10</length><offset>0</offset><encoding style="application/octet-stream"/></data></file>
      <file id="2"><name>file2.txt</name><type>file</type><data><size>20</size><length>8</length><offset>10</offset><encoding style="application/x-gzip"/></data></file>
    </toc>`;
    const entries = walkToc(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe("file1.txt");
    expect(entries[0].type).toBe("file");
    expect(entries[0].size).toBe(10);
    expect(entries[0].encoding).toBe("stored");
    expect(entries[0].isExtractable).toBe(true);
    expect(entries[1].encoding).toBe("zlib");
    expect(entries[1].isExtractable).toBe(true);
  });
  it("walks a nested TOC with directories", () => {
    const xml = `<toc>
      <file id="1"><name>dir1</name><type>directory</type>
        <file id="2"><name>inside.txt</name><type>file</type><data><size>5</size><length>5</length><offset>0</offset><encoding style="application/octet-stream"/></data></file>
      </file>
    </toc>`;
    const entries = walkToc(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("directory");
    expect(entries[0].path).toBe("dir1");
    expect(entries[1].path).toBe("dir1/inside.txt");
    expect(entries[1].level).toBe(1);
  });
  it("handles symlinks", () => {
    const xml = `<toc><file id="1"><name>link</name><type>symlink</type><data><size>0</size><length>0</length><offset>0</offset><encoding style="application/octet-stream"/></data></file></toc>`;
    const entries = walkToc(xml);
    expect(entries[0].type).toBe("symlink");
  });
  it("marks unsupported encodings as not extractable", () => {
    const xml = `<toc><file id="1"><name>x</name><type>file</type><data><size>5</size><length>5</length><offset>0</offset><encoding style="application/x-bzip2"/></data></file></toc>`;
    const entries = walkToc(xml);
    expect(entries[0].encoding).toBe("bzip2");
    expect(entries[0].isExtractable).toBe(false);
  });
  it("returns empty for invalid XML", () => {
    expect(walkToc("not xml")).toEqual([]);
  });
});

// ===== parseXar =====

describe("xar-extractor parseXar", () => {
  it("parses a minimal XAR archive", async () => {
    const tocXml = `<toc>
      <file id="1"><name>hello.txt</name><type>file</type>
        <data><size>5</size><length>5</length><offset>0</offset><encoding style="application/octet-stream"/></data>
      </file>
    </toc>`;
    const heap = new TextEncoder().encode("hello");
    const bytes = await makeXarFile(tocXml, heap);
    const info = await parseXar(bytes);
    expect(info.isValid).toBe(true);
    expect(info.header).not.toBeNull();
    expect(info.fileCount).toBe(1);
    expect(info.entries).toHaveLength(1);
    expect(info.entries[0].name).toBe("hello.txt");
    expect(info.tocXml).toContain("hello.txt");
  });
  it("returns error for non-XAR input", async () => {
    const info = await parseXar(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
    expect(info.isValid).toBe(false);
    expect(info.error).toContain("Not a valid XAR");
  });
  it("parses multiple files with sizes", async () => {
    const tocXml = `<toc>
      <file id="1"><name>a.txt</name><type>file</type><data><size>3</size><length>3</length><offset>0</offset><encoding style="application/octet-stream"/></data></file>
      <file id="2"><name>b.txt</name><type>file</type><data><size>5</size><length>5</length><offset>3</offset><encoding style="application/octet-stream"/></data></file>
    </toc>`;
    const heap = new TextEncoder().encode("AAABBBBB");
    const bytes = await makeXarFile(tocXml, heap);
    const info = await parseXar(bytes);
    expect(info.fileCount).toBe(2);
    expect(info.totalUncompressedSize).toBe(8);
    expect(info.totalCompressedSize).toBe(8);
  });
  it("includes directory and symlink counts", async () => {
    const tocXml = `<toc>
      <file id="1"><name>dir</name><type>directory</type></file>
      <file id="2"><name>link</name><type>symlink</type><data><size>0</size><length>0</length><offset>0</offset><encoding style="application/octet-stream"/></data></file>
    </toc>`;
    const bytes = await makeXarFile(tocXml);
    const info = await parseXar(bytes);
    expect(info.directoryCount).toBe(1);
    expect(info.symlinkCount).toBe(1);
  });
  it("extracts stored file data correctly", async () => {
    const tocXml = `<toc>
      <file id="1"><name>data.bin</name><type>file</type>
        <data><size>4</size><length>4</length><offset>0</offset><encoding style="application/octet-stream"/></data>
      </file>
    </toc>`;
    const heap = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const bytes = await makeXarFile(tocXml, heap);
    const info = await parseXar(bytes);
    const entry = info.entries[0]!;
    const extracted = await decompressEntryData(bytes, entry);
    expect(extracted).toEqual(heap);
  });
  it("extracts zlib-compressed file data correctly", async () => {
    const originalData = new TextEncoder().encode("This is a long file that should compress nicely with zlib.");
    const compressed = await zlibCompress(originalData);
    const tocXml = `<toc>
      <file id="1"><name>compressed.txt</name><type>file</type>
        <data><size>${originalData.length}</size><length>${compressed.length}</length><offset>0</offset><encoding style="application/x-gzip"/></data>
      </file>
    </toc>`;
    const bytes = await makeXarFile(tocXml, compressed);
    const info = await parseXar(bytes);
    const entry = info.entries[0]!;
    const extracted = await decompressEntryData(bytes, entry);
    expect(extracted).toEqual(originalData);
  });
  it("surfaces error for unsupported encoding on extract", async () => {
    const tocXml = `<toc>
      <file id="1"><name>x</name><type>file</type>
        <data><size>5</size><length>5</length><offset>0</offset><encoding style="application/x-bzip2"/></data>
      </file>
    </toc>`;
    const bytes = await makeXarFile(tocXml, new Uint8Array([1, 2, 3, 4, 5]));
    const info = await parseXar(bytes);
    const entry = info.entries[0]!;
    await expect(decompressEntryData(bytes, entry)).rejects.toThrow();
  });
});

// ===== computeStats =====

describe("xar-extractor computeStats", () => {
  it("computes stats for mixed entries", () => {
    const entries: XarEntry[] = [
      { path: "a.txt", name: "a.txt", type: "file", id: 1, size: 100, length: 50, offset: 0, encoding: "zlib", encodingAttr: "gzip", isExtractable: true, level: 0 },
      { path: "b.txt", name: "b.txt", type: "file", id: 2, size: 200, length: 200, offset: 50, encoding: "stored", encodingAttr: "octet-stream", isExtractable: true, level: 0 },
      { path: "c.txt", name: "c.txt", type: "file", id: 3, size: 50, length: 50, offset: 250, encoding: "bzip2", encodingAttr: "bzip2", isExtractable: false, level: 0 },
      { path: "dir", name: "dir", type: "directory", id: 4, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
    ];
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(4);
    expect(stats.fileCount).toBe(3);
    expect(stats.directoryCount).toBe(1);
    expect(stats.totalUncompressed).toBe(350);
    expect(stats.totalCompressed).toBe(300);
    expect(stats.extractableCount).toBe(2);
    expect(stats.unsupportedCount).toBe(1);
    expect(stats.largestFileName).toBe("b.txt");
    expect(stats.largestFileSize).toBe(200);
  });
  it("handles empty entries list", () => {
    const stats = computeStats([]);
    expect(stats.entryCount).toBe(0);
    expect(stats.totalUncompressed).toBe(0);
    expect(stats.ratio).toBe(0);
  });
});

// ===== searchEntries / filterByType =====

describe("xar-extractor searchEntries", () => {
  const entries: XarEntry[] = [
    { path: "docs/readme.txt", name: "readme.txt", type: "file", id: 1, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
    { path: "src/main.js", name: "main.js", type: "file", id: 2, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
  ];
  it("returns all entries for empty query", () => {
    expect(searchEntries(entries, "")).toHaveLength(2);
  });
  it("filters by name substring", () => {
    expect(searchEntries(entries, "readme")).toHaveLength(1);
    expect(searchEntries(entries, "main")).toHaveLength(1);
  });
  it("is case-insensitive", () => {
    expect(searchEntries(entries, "README")).toHaveLength(1);
  });
});

describe("xar-extractor filterByType", () => {
  const entries: XarEntry[] = [
    { path: "a", name: "a", type: "file", id: 1, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
    { path: "d", name: "d", type: "directory", id: 2, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
    { path: "s", name: "s", type: "symlink", id: 3, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
  ];
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all" as XarTypeFilter)).toHaveLength(3);
  });
  it("filters files only", () => {
    expect(filterByType(entries, "file")).toHaveLength(1);
  });
  it("filters directories only", () => {
    expect(filterByType(entries, "directory")).toHaveLength(1);
  });
  it("filters symlinks only", () => {
    expect(filterByType(entries, "symlink")).toHaveLength(1);
  });
});

// ===== buildFileTree =====

describe("xar-extractor buildFileTree", () => {
  it("builds a tree from paths", () => {
    const entries: XarEntry[] = [
      { path: "a/b.txt", name: "b.txt", type: "file", id: 1, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
      { path: "a/c/d.txt", name: "d.txt", type: "file", id: 2, size: 0, length: 0, offset: 0, encoding: "stored", encodingAttr: "", isExtractable: false, level: 0 },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].name).toBe("a");
    expect(tree.children[0].isDirectory).toBe(true);
    expect(tree.children[0].children).toHaveLength(2);
  });
});

// ===== detectMimeFromName =====

describe("xar-extractor detectMimeFromName", () => {
  it("detects common MIME types", () => {
    expect(detectMimeFromName("a.txt")).toBe("text/plain");
    expect(detectMimeFromName("a.json")).toBe("application/json");
    expect(detectMimeFromName("a.xml")).toBe("application/xml");
    expect(detectMimeFromName("a.png")).toBe("image/png");
    expect(detectMimeFromName("a.plist")).toBe("application/x-plist");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("a.xyz")).toBe("application/octet-stream");
  });
});

// ===== createZipBlob =====

describe("xar-extractor createZipBlob", () => {
  it("creates a valid ZIP blob", async () => {
    const blob = createZipBlob([
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "b.txt", data: new TextEncoder().encode("world") },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });
});

// ===== formatBytes / formatRatio =====

describe("xar-extractor utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("formats ratio", () => {
    expect(formatRatio(2.5)).toBe("2.50×");
    expect(formatRatio(1)).toBe("1.00×");
  });
});

// ===== History (localStorage) =====

describe("xar-extractor history", () => {
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
    saveToHistory({ fileName: "a.xar", archiveSize: 1000, fileCount: 5, version: 1, inspectedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.xar");
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({ fileName: `a${i}.xar`, archiveSize: 100, fileCount: 1, version: 1, inspectedAt: "2026-01-01" });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({ fileName: "a.xar", archiveSize: 100, fileCount: 1, version: 1, inspectedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("xar-extractor share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = globalThis as unknown;
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/xar-extractor",
    };
  });
  it("builds share URL", () => {
    const url = buildShareUrl({ filter: "file", search: "abc" });
    expect(url).toContain("filter=file");
    expect(url).toContain("q=abc");
  });
  it("omits empty params", () => {
    const url = buildShareUrl({ filter: "all", search: "" });
    expect(url).not.toContain("filter");
    expect(url).not.toContain("q=");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#filter=directory&q=test");
    expect(parsed?.filter).toBe("directory");
    expect(parsed?.search).toBe("test");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("falls back to all for invalid filter", () => {
    const parsed = parseShareUrl("#filter=invalid");
    expect(parsed?.filter).toBe("all");
  });
});
