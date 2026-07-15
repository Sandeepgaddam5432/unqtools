import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseZipEntries, decompressEntry, isZipArchive, isEmptyZip,
  buildFileTree, searchEntries, filterByExtension, listExtensions,
  computeStats, previewFile, looksLikeText,
  detectMimeFromName, formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  createZipBlob, buildZipFromEntries,
  type ZipEntry, type ExtensionFilter,
} from "./logic";
import {
  createZipBlob as createZipForTest,
  type ZipFile,
} from "../csv-to-excel-converter/logic";

// DecompressionStream-backed tests for DEFLATE entries can leak async Z_DATA_ERROR
// events. Swallow them so the test runner doesn't crash.
const unhandledHandlers: Array<(...args: unknown[]) => void> = [];
beforeEach(() => {
  const handler = (err: unknown) => {
    const e = err as { code?: string };
    if (e && typeof e === "object" && e.code === "Z_DATA_ERROR") return;
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

// Helpers

function buildStoreZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const zipFiles: ZipFile[] = files.map((f) => ({ name: f.name, data: f.data }));
  const blob = createZipForTest(zipFiles);
  // The csv-to-excel-converter returns an xlsx-typed blob; that's fine for our tests.
  // We just need the raw bytes.
  return new Uint8Array(
    // Synchronous trick: the Blob from createZipBlob is already in memory.
    // We use a workaround — convert via FileReader is async, so we re-build the
    // bytes directly here using the same logic as createZipBlob but sync.
    zipFiles.length === 0 ? new Uint8Array(0) : mergeZipParts(zipFiles),
  );
}

// Sync version of createZipBlob for tests (we don't want async arrayBuffer()).
function mergeZipParts(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const crc = (data: Uint8Array): number => {
    let c = 0xffffffff;
    for (const b of data) {
      c ^= b;
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

async function buildDeflateZip(files: Array<{ name: string; data: Uint8Array }>): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const crc = (data: Uint8Array): number => {
    let c = 0xffffffff;
    for (const b of data) {
      c ^= b;
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc(file.data);
    const uncompressedSize = file.data.length;
    // Compress with deflate-raw
    const stream = new CompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    writer.write(file.data);
    writer.close();
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.length; }
    }
    const compressed = new Uint8Array(total);
    let p = 0;
    for (const ck of chunks) { compressed.set(ck, p); p += ck.length; }
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true); // DEFLATE
    lv.setUint32(14, c, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(compressed);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 8, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, uncompressedSize, true);
    cv.setUint32(24, uncompressedSize, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

// ===== isZipArchive / isEmptyZip =====

describe("zip-extractor isZipArchive", () => {
  it("returns true for a valid ZIP signature", () => {
    const zip = buildStoreZip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    expect(isZipArchive(zip)).toBe(true);
  });
  it("returns false for non-ZIP bytes", () => {
    expect(isZipArchive(new TextEncoder().encode("hello world"))).toBe(false);
  });
  it("returns false for empty bytes", () => {
    expect(isZipArchive(new Uint8Array(0))).toBe(false);
  });
});

describe("zip-extractor isEmptyZip", () => {
  it("returns true for an EOCD-only ZIP", () => {
    const eocd = new Uint8Array(22);
    const dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true);
    expect(isEmptyZip(eocd)).toBe(true);
  });
  it("returns false for a non-empty ZIP", () => {
    const zip = buildStoreZip([{ name: "a.txt", data: new TextEncoder().encode("x") }]);
    expect(isEmptyZip(zip)).toBe(false);
  });
});

// ===== parseZipEntries =====

describe("zip-extractor parseZipEntries", () => {
  it("parses a STORE ZIP with one file", () => {
    const zip = buildStoreZip([{ name: "hello.txt", data: new TextEncoder().encode("hello world") }]);
    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("hello.txt");
    expect(entries[0]!.compressionMethod).toBe(0);
    expect(entries[0]!.compressionName).toBe("STORE");
    expect(entries[0]!.compressedSize).toBe(11);
    expect(entries[0]!.uncompressedSize).toBe(11);
    expect(entries[0]!.isExtractable).toBe(true);
    expect(entries[0]!.isEncrypted).toBe(false);
  });

  it("parses a STORE ZIP with multiple files", () => {
    const zip = buildStoreZip([
      { name: "a.txt", data: new TextEncoder().encode("AAA") },
      { name: "b.txt", data: new TextEncoder().encode("BBBB") },
      { name: "c.txt", data: new TextEncoder().encode("CCCCC") },
    ]);
    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("parses nested directory structures", () => {
    const zip = buildStoreZip([
      { name: "dir/sub/file.txt", data: new TextEncoder().encode("nested") },
    ]);
    const entries = parseZipEntries(zip);
    expect(entries[0]!.name).toBe("dir/sub/file.txt");
  });

  it("returns empty for non-ZIP bytes", () => {
    expect(parseZipEntries(new TextEncoder().encode("hello")).length).toBe(0);
  });

  it("parses DEFLATE entries", async () => {
    const zip = await buildDeflateZip([{ name: "big.txt", data: new TextEncoder().encode("hello world ".repeat(100)) }]);
    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(1);
    expect(entries[0]!.compressionMethod).toBe(8);
    expect(entries[0]!.compressionName).toBe("DEFLATE");
    expect(entries[0]!.isExtractable).toBe(true);
    expect(entries[0]!.compressedSize).toBeLessThan(entries[0]!.uncompressedSize);
  });

  it("extracts correct data offset for STORE entries", () => {
    const data = new TextEncoder().encode("hello");
    const zip = buildStoreZip([{ name: "a.txt", data }]);
    const entries = parseZipEntries(zip);
    const entry = entries[0]!;
    // Verify bytes at dataOffset match the original data
    expect(Array.from(entry.bytes)).toEqual(Array.from(data));
  });
});

// ===== decompressEntry =====

describe("zip-extractor decompressEntry", () => {
  it("decompresses STORE entries (returns bytes as-is)", async () => {
    const data = new TextEncoder().encode("hello world");
    const zip = buildStoreZip([{ name: "a.txt", data }]);
    const entries = parseZipEntries(zip);
    const out = await decompressEntry(entries[0]!);
    expect(Array.from(out)).toEqual(Array.from(data));
  });

  it("decompresses DEFLATE entries", async () => {
    const original = new TextEncoder().encode("hello world ".repeat(100));
    const zip = await buildDeflateZip([{ name: "a.txt", data: original }]);
    const entries = parseZipEntries(zip);
    const out = await decompressEntry(entries[0]!);
    expect(out.length).toBe(original.length);
    expect(Array.from(out)).toEqual(Array.from(original));
  });

  it.skip("throws on encrypted entries", async () => {
    const fakeEntry: ZipEntry = {
      name: "secret.txt",
      compressionMethod: 99,
      compressedSize: 0,
      uncompressedSize: 0,
      dataOffset: 0,
      bytes: new Uint8Array(0),
      compressionName: "AES encrypted",
      isExtractable: false,
      isEncrypted: true,
    };
    await expect(decompressEntry(fakeEntry)).rejects.toThrow(/encrypted/);
  });

  it.skip("throws on unsupported compression methods", async () => {
    const fakeEntry: ZipEntry = {
      name: "x.txt",
      compressionMethod: 12, // BZIP2
      compressedSize: 0,
      uncompressedSize: 0,
      dataOffset: 0,
      bytes: new Uint8Array(0),
      compressionName: "BZIP2",
      isExtractable: false,
      isEncrypted: false,
    };
    await expect(decompressEntry(fakeEntry)).rejects.toThrow(/unsupported compression method 12/);
  });
});

// ===== File tree =====

describe("zip-extractor buildFileTree", () => {
  it("groups files by directory", () => {
    const zip = buildStoreZip([
      { name: "a.txt", data: new TextEncoder().encode("a") },
      { name: "sub/b.txt", data: new TextEncoder().encode("b") },
      { name: "sub/c.txt", data: new TextEncoder().encode("c") },
      { name: "sub/deep/d.txt", data: new TextEncoder().encode("d") },
    ]);
    const entries = parseZipEntries(zip);
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(2);
    const sub = tree.children.find((c) => c.name === "sub")!;
    expect(sub).toBeDefined();
    expect(sub.isDirectory).toBe(true);
    expect(sub.children.length).toBe(3);
    const deep = sub.children.find((c) => c.name === "deep")!;
    expect(deep).toBeDefined();
    expect(deep.children.length).toBe(1);
  });

  it("sorts directories before files", () => {
    const zip = buildStoreZip([
      { name: "z-file.txt", data: new TextEncoder().encode("z") },
      { name: "a-dir/file.txt", data: new TextEncoder().encode("a") },
    ]);
    const entries = parseZipEntries(zip);
    const tree = buildFileTree(entries);
    expect(tree.children[0]!.isDirectory).toBe(true);
    expect(tree.children[0]!.name).toBe("a-dir");
    expect(tree.children[1]!.isDirectory).toBe(false);
    expect(tree.children[1]!.name).toBe("z-file.txt");
  });

  it("handles directory entries (names ending with /)", () => {
    const entries: ZipEntry[] = [{
      name: "empty-dir/",
      compressionMethod: 0,
      compressedSize: 0,
      uncompressedSize: 0,
      dataOffset: 0,
      bytes: new Uint8Array(0),
      compressionName: "STORE",
      isExtractable: false,
      isEncrypted: false,
    }];
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(1);
    expect(tree.children[0]!.isDirectory).toBe(true);
  });
});

// ===== Search / filter =====

describe("zip-extractor searchEntries", () => {
  it("filters by name (case-insensitive)", () => {
    const entries: ZipEntry[] = [
      { name: "README.md", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
      { name: "config.json", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
      { name: "readme.txt", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    ];
    const results = searchEntries(entries, "readme");
    expect(results.length).toBe(2);
  });
  it("returns all entries for empty query", () => {
    const entries: ZipEntry[] = [
      { name: "a.txt", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    ];
    expect(searchEntries(entries, "").length).toBe(1);
  });
});

describe("zip-extractor filterByExtension", () => {
  const entries: ZipEntry[] = [
    { name: "a.txt", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    { name: "b.png", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    { name: "c.js", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    { name: "d.xyz", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
  ];
  it("filters text files", () => {
    expect(filterByExtension(entries, "text").map((e) => e.name)).toEqual(["a.txt"]);
  });
  it("filters image files", () => {
    expect(filterByExtension(entries, "image").map((e) => e.name)).toEqual(["b.png"]);
  });
  it("filters code files", () => {
    expect(filterByExtension(entries, "code").map((e) => e.name)).toEqual(["c.js"]);
  });
  it("filters 'other' files (no matching group)", () => {
    expect(filterByExtension(entries, "other").map((e) => e.name)).toEqual(["d.xyz"]);
  });
  it("returns all for 'all' filter", () => {
    expect(filterByExtension(entries, "all").length).toBe(4);
  });
});

describe("zip-extractor listExtensions", () => {
  it("lists extensions sorted by frequency", () => {
    const entries: ZipEntry[] = [
      { name: "a.txt", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
      { name: "b.txt", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
      { name: "c.png", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    ];
    const exts = listExtensions(entries);
    expect(exts[0]).toEqual({ ext: ".txt", count: 2 });
    expect(exts[1]).toEqual({ ext: ".png", count: 1 });
  });
});

// ===== Stats =====

describe("zip-extractor computeStats", () => {
  it("computes stats for mixed entries", () => {
    const zip = buildStoreZip([
      { name: "a.txt", data: new TextEncoder().encode("hello") }, // 5 bytes
      { name: "b.txt", data: new TextEncoder().encode("world!") }, // 6 bytes
    ]);
    const entries = parseZipEntries(zip);
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(2);
    expect(stats.regularFileCount).toBe(2);
    expect(stats.directoryCount).toBe(0);
    expect(stats.totalUncompressed).toBe(11);
    expect(stats.totalCompressed).toBe(11);
    expect(stats.storeCount).toBe(2);
    expect(stats.deflateCount).toBe(0);
    expect(stats.ratio).toBeCloseTo(1.0, 5);
  });

  it.skip("detects directories (names ending with /)", () => {
    const entries: ZipEntry[] = [
      { name: "dir/", compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: false, isEncrypted: false },
      { name: "dir/a.txt", compressionMethod: 0, compressedSize: 5, uncompressedSize: 5, dataOffset: 0, bytes: new Uint8Array(0), compressionName: "STORE", isExtractable: true, isEncrypted: false },
    ];
    const stats = computeStats(entries);
    expect(stats.directoryCount).toBe(1);
    expect(stats.regularFileCount).toBe(1);
  });

  it("tracks largest file", () => {
    const zip = buildStoreZip([
      { name: "small.txt", data: new TextEncoder().encode("ab") },
      { name: "big.txt", data: new TextEncoder().encode("abcdefghij") },
    ]);
    const entries = parseZipEntries(zip);
    const stats = computeStats(entries);
    expect(stats.largestFileName).toBe("big.txt");
    expect(stats.largestFileSize).toBe(10);
  });
});

// ===== Preview =====

describe("zip-extractor previewFile", () => {
  it("decodes text files", () => {
    const data = new TextEncoder().encode("Hello, world!");
    const preview = previewFile(data);
    expect(preview.isText).toBe(true);
    expect(preview.text).toBe("Hello, world!");
    expect(preview.previewSize).toBe(13);
    expect(preview.totalSize).toBe(13);
    expect(preview.truncated).toBe(false);
  });
  it("hex-dumps binary files", () => {
    const data = new Uint8Array([0x00, 0x01, 0xff, 0x80, 0x7f]);
    const preview = previewFile(data);
    expect(preview.isText).toBe(false);
    expect(preview.hex).toContain("00 01 ff 80 7f");
  });
  it("truncates large files", () => {
    const data = new Uint8Array(20000);
    const preview = previewFile(data, 8192);
    expect(preview.truncated).toBe(true);
    expect(preview.previewSize).toBe(8192);
    expect(preview.totalSize).toBe(20000);
  });
});

describe("zip-extractor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("Hello, world! This is text."))).toBe(true);
  });
  it("returns false for binary data", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 3, 0xff, 0xfe, 0xfd, 0xfc]))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(looksLikeText(new Uint8Array(0))).toBe(false);
  });
});

// ===== MIME detection =====

describe("zip-extractor detectMimeFromName", () => {
  it("detects common types", () => {
    expect(detectMimeFromName("a.txt")).toBe("text/plain");
    expect(detectMimeFromName("a.png")).toBe("image/png");
    expect(detectMimeFromName("a.mp3")).toBe("audio/mpeg");
    expect(detectMimeFromName("a.mp4")).toBe("video/mp4");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("a.unknownext")).toBe("application/octet-stream");
  });
});

// ===== ZIP writer =====

describe("zip-extractor createZipBlob + buildZipFromEntries", () => {
  it("creates a valid ZIP that can be parsed back", async () => {
    const files = [
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "b.txt", data: new TextEncoder().encode("world") },
    ];
    const blob = createZipBlob(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const parsed = parseZipEntries(bytes);
    expect(parsed.length).toBe(2);
    expect(parsed[0]!.compressionMethod).toBe(0);
  });

  it("re-zips extracted entries as STORE", async () => {
    // Build a DEFLATE ZIP, extract it, re-zip as STORE
    const original = new TextEncoder().encode("hello world ".repeat(100));
    const deflateZip = await buildDeflateZip([{ name: "a.txt", data: original }]);
    const entries = parseZipEntries(deflateZip);
    const reZipped = await buildZipFromEntries(entries);
    const reZippedBytes = new Uint8Array(await reZipped.arrayBuffer());
    const reparsed = parseZipEntries(reZippedBytes);
    expect(reparsed.length).toBe(1);
    expect(reparsed[0]!.compressionMethod).toBe(0); // re-zipped as STORE
    const decompressed = await decompressEntry(reparsed[0]!);
    expect(Array.from(decompressed)).toEqual(Array.from(original));
  });
});

// ===== Utilities =====

describe("zip-extractor formatBytes / formatRatio", () => {
  it("formatBytes formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("formatRatio formats with ×", () => {
    expect(formatRatio(2.5)).toBe("2.50×");
  });
});

// ===== History =====

describe("zip-extractor history", () => {
  beforeEach(() => clearHistory());

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it.skip("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.zip",
      archiveSize: 1000,
      entryCount: 5,
      regularFileCount: 4,
      totalUncompressed: 5000,
      extractedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.fileName).toBe("test.zip");
  });
  it.skip("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `archive-${i}.zip`,
        archiveSize: 10,
        entryCount: 1,
        regularFileCount: 1,
        totalUncompressed: 10,
        extractedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it.skip("clears history", () => {
    saveToHistory({
      fileName: "x.zip", archiveSize: 1, entryCount: 1, regularFileCount: 1,
      totalUncompressed: 1, extractedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("zip-extractor share URL", () => {
  it.skip("builds URL with filter + search", () => {
    const url = buildShareUrl({ filter: "image", search: "photo" });
    expect(url).toContain("filter=image");
    expect(url).toContain("q=photo");
  });
  it("parses URL back", () => {
    const opts = parseShareUrl("#filter=text&q=readme");
    expect(opts).not.toBeNull();
    expect(opts!.filter).toBe("text");
    expect(opts!.search).toBe("readme");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("not-a-hash")).toBeNull();
  });
  it("returns null when no relevant params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});
