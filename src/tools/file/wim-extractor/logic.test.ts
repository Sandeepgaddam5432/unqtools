import { describe, it, expect, beforeEach } from "vitest";
import {
  WIM_SIGNATURE, WIM_HEADER_SIZE, WIM_FLAG_XPRESS, WIM_FLAG_LZX,
  isWimFile, parseHeader, parseResourceTable, parseFileEntries,
  extractFileData, listImages, computeStats, buildFileTree,
  searchEntries, filterByType, detectMimeFromName,
  previewFile, looksLikeText, buildZipFromWim,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  extractWim,
  type WimFileEntry,
} from "./logic";

// ===== Helpers =====

function writeU32LE(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

function writeU64LE(value: number): number[] {
  // For values that fit in Number.MAX_SAFE_INTEGER
  const low = value & 0xffffffff;
  const high = Math.floor(value / 0x100000000) & 0xffffffff;
  return [...writeU32LE(low), ...writeU32LE(high)];
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

function writeUtf16LE(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  return bytes;
}

/** Build a WIM header (152 bytes) matching the parser's expected layout. */
function buildWimHeader(opts: {
  version?: number;
  flags?: number;
  chunkSize?: number;
  imageCount?: number;
  badSignature?: boolean;
}): number[] {
  const header: number[] = [];
  if (opts.badSignature) {
    header.push(...writeString("XXXXX\0\0\0"));
  } else {
    header.push(...writeString("MSWIM\0\0\0"));
  }
  header.push(...writeU32LE(opts.version ?? 0x0001000d)); // offset 8
  header.push(...writeU32LE(opts.flags ?? 0));           // offset 12
  header.push(...writeU32LE(opts.chunkSize ?? 32768));   // offset 16 (4 bytes only)
  // GUID (16 bytes) at offset 20
  for (let i = 0; i < 16; i++) header.push(i);
  header.push(...writeU32LE(1));                          // offset 36: partIndex
  header.push(...writeU32LE(1));                          // offset 40: totalParts
  header.push(...writeU32LE(opts.imageCount ?? 1));       // offset 44: imageCount
  // Pad the rest of the 152-byte header with zeros
  while (header.length < WIM_HEADER_SIZE) header.push(0);
  return header;
}

/** Build a single file entry in our synthetic format. */
function buildFileEntry(name: string, data: Uint8Array, attributes: number = 0x80): number[] {
  const nameBytes = writeUtf16LE(name);
  const nameLength = name.length; // in UTF-16 code units
  const entrySize = 4 + 4 + 8 + 4 + nameBytes.length + data.length;
  const entry: number[] = [];
  entry.push(...writeU32LE(entrySize));
  entry.push(...writeU32LE(attributes));
  entry.push(...writeU64LE(data.length));
  entry.push(...writeU32LE(nameLength));
  entry.push(...nameBytes);
  entry.push(...Array.from(data));
  return entry;
}

function buildWimBytes(opts: {
  flags?: number;
  imageCount?: number;
  files?: Array<{ name: string; data: Uint8Array; attributes?: number }>;
  badSignature?: boolean;
  truncate?: number;
}): Uint8Array {
  const header = buildWimHeader({
    flags: opts.flags ?? 0,
    imageCount: opts.imageCount ?? 1,
    badSignature: opts.badSignature,
  });
  const parts: number[] = [...header];
  for (const file of opts.files ?? []) {
    parts.push(...buildFileEntry(file.name, file.data, file.attributes ?? 0x80));
  }
  const total = parts.length;
  const truncate = opts.truncate ?? total;
  return new Uint8Array(parts.slice(0, Math.min(total, truncate)));
}

// ===== localStorage mock =====
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => k in store ? store[k]! : null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: Object.keys(store).length,
  } as Storage;
});

// ===== isWimFile =====

describe("wim-extractor isWimFile", () => {
  it("returns true for a valid MSWIM signature", () => {
    const bytes = buildWimBytes({});
    expect(isWimFile(bytes)).toBe(true);
  });
  it("returns false for a corrupted signature", () => {
    const bytes = buildWimBytes({ badSignature: true });
    expect(isWimFile(bytes)).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isWimFile(new Uint8Array(5))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isWimFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== parseHeader =====

describe("wim-extractor parseHeader", () => {
  it("parses signature, version, flags", () => {
    const bytes = buildWimBytes({ flags: 0 });
    const header = parseHeader(bytes);
    expect(header.signature).toBe(WIM_SIGNATURE);
    expect(header.version).toBe(0x0001000d);
    expect(header.flags).toBe(0);
    expect(header.imageCount).toBe(1);
  });
  it("detects XPRESS compression", () => {
    const bytes = buildWimBytes({ flags: WIM_FLAG_XPRESS });
    const header = parseHeader(bytes);
    expect(header.isXpressCompressed).toBe(true);
    expect(header.isUncompressed).toBe(false);
  });
  it("detects LZX compression", () => {
    const bytes = buildWimBytes({ flags: WIM_FLAG_LZX });
    const header = parseHeader(bytes);
    expect(header.isLzxCompressed).toBe(true);
    expect(header.isUncompressed).toBe(false);
  });
  it("throws on too-small input", () => {
    expect(() => parseHeader(new Uint8Array(50))).toThrow(/too small/);
  });
  it("throws on bad signature", () => {
    const bytes = buildWimBytes({ badSignature: true });
    expect(() => parseHeader(bytes)).toThrow(/Not a valid WIM file/);
  });
});

// ===== parseResourceTable =====

describe("wim-extractor parseResourceTable", () => {
  it("parses resources with offset, size, originalSize", () => {
    // Each resource entry is 24 bytes: offset(8) + size(8) + originalSize(8)
    const bytes = new Uint8Array(48);
    const dv = new DataView(bytes.buffer);
    // Resource 1: offset=1000, size=500, originalSize=600 (all as 64-bit LE)
    dv.setUint32(0, 1000, true); dv.setUint32(4, 0, true);   // offset
    dv.setUint32(8, 500, true);  dv.setUint32(12, 0, true);  // size
    dv.setUint32(16, 600, true); dv.setUint32(20, 0, true);  // originalSize
    // Resource 2: offset=2000, size=700, originalSize=800
    dv.setUint32(24, 2000, true); dv.setUint32(28, 0, true);
    dv.setUint32(32, 700, true);  dv.setUint32(36, 0, true);
    dv.setUint32(40, 800, true);  dv.setUint32(44, 0, true);
    const resources = parseResourceTable(bytes, 0, 2);
    expect(resources.length).toBe(2);
    expect(resources[0]!.offset).toBe(1000);
    expect(resources[0]!.size).toBe(500);
    expect(resources[0]!.originalSize).toBe(600);
    expect(resources[1]!.offset).toBe(2000);
  });
  it("returns empty array for zero count", () => {
    expect(parseResourceTable(new Uint8Array(0), 0, 0)).toEqual([]);
  });
});

// ===== parseFileEntries =====

describe("wim-extractor parseFileEntries", () => {
  it("parses a single file entry", () => {
    const text = "Hello, WIM!";
    const bytes = buildWimBytes({
      files: [{ name: "hello.txt", data: new TextEncoder().encode(text) }],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("hello.txt");
    expect(entries[0]!.fileSize).toBe(text.length);
    expect(entries[0]!.type).toBe("regular");
    expect(entries[0]!.isRegularFile).toBe(true);
  });
  it("parses multiple file entries", () => {
    const bytes = buildWimBytes({
      files: [
        { name: "a.txt", data: new TextEncoder().encode("aaa") },
        { name: "b.txt", data: new TextEncoder().encode("bbbb") },
        { name: "c.txt", data: new TextEncoder().encode("c") },
      ],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    expect(entries.length).toBe(3);
    expect(entries[0]!.name).toBe("a.txt");
    expect(entries[1]!.name).toBe("b.txt");
    expect(entries[2]!.name).toBe("c.txt");
  });
  it("handles directory entries (FILE_ATTRIBUTE_DIRECTORY)", () => {
    const bytes = buildWimBytes({
      files: [{ name: "mydir", data: new Uint8Array(0), attributes: 0x10 }],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    expect(entries.length).toBe(1);
    expect(entries[0]!.type).toBe("directory");
    expect(entries[0]!.isDirectory).toBe(true);
  });
  it("handles Unicode (UTF-16) filenames", () => {
    const bytes = buildWimBytes({
      files: [{ name: "héllo.txt", data: new TextEncoder().encode("x") }],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    expect(entries[0]!.name).toBe("héllo.txt");
  });
  it("stops on zero entry size (end of list)", () => {
    const bytes = new Uint8Array(WIM_HEADER_SIZE + 100);
    // File entry with zero size — parser should stop
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    expect(entries.length).toBe(0);
  });
});

// ===== extractFileData =====

describe("wim-extractor extractFileData", () => {
  it("extracts the correct bytes for a file", () => {
    const text = "Hello, WIM!";
    const bytes = buildWimBytes({
      files: [{ name: "hello.txt", data: new TextEncoder().encode(text) }],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    const data = extractFileData(bytes, entries[0]!);
    expect(new TextDecoder().decode(data)).toBe(text);
  });
});

// ===== listImages =====

describe("wim-extractor listImages", () => {
  it("lists images with file count and total size", () => {
    const header = { signature: "MSWIM", version: 1, flags: 0, chunkSize: 32768, guid: "abc", partIndex: 1, totalParts: 1, imageCount: 1, isXpressCompressed: false, isLzxCompressed: false, isUncompressed: true };
    const entries: WimFileEntry[] = [
      { name: "a.txt", path: "a.txt", fileSize: 10, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 10 },
      { name: "b.txt", path: "b.txt", fileSize: 20, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 20 },
    ];
    const images = listImages(header, [], entries);
    expect(images.length).toBe(1);
    expect(images[0]!.fileCount).toBe(2);
    expect(images[0]!.totalSize).toBe(30);
  });
});

// ===== computeStats =====

describe("wim-extractor computeStats", () => {
  it("computes file/dir counts and total size", () => {
    const entries: WimFileEntry[] = [
      { name: "a.txt", path: "a.txt", fileSize: 10, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 10 },
      { name: "b.txt", path: "b.txt", fileSize: 25, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 25 },
      { name: "mydir", path: "mydir", fileSize: 0, attributes: 0x10, imageIndex: 1, type: "directory", isRegularFile: false, isDirectory: true, dataOffset: 0, dataLength: 0 },
    ];
    const stats = computeStats(entries, 1000, false);
    expect(stats.fileCount).toBe(2);
    expect(stats.directoryCount).toBe(1);
    expect(stats.totalExtractedSize).toBe(35);
    expect(stats.largestFileSize).toBe(25);
    expect(stats.largestFileName).toBe("b.txt");
  });
});

// ===== buildFileTree =====

describe("wim-extractor buildFileTree", () => {
  it("builds a tree from backslash paths", () => {
    const entries: WimFileEntry[] = [
      { name: "Windows\\System32\\foo.dll", path: "Windows\\System32\\foo.dll", fileSize: 0, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 0 },
      { name: "Windows\\bar.txt", path: "Windows\\bar.txt", fileSize: 0, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 0 },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(1); // Windows
    const win = tree.children[0]!;
    expect(win.children.length).toBe(2); // System32, bar.txt
  });
});

// ===== searchEntries / filterByType =====

describe("wim-extractor searchEntries", () => {
  it("filters by query", () => {
    const entries: WimFileEntry[] = [
      { name: "foo.txt", path: "foo.txt", fileSize: 0, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 0 },
      { name: "bar.txt", path: "bar.txt", fileSize: 0, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 0 },
    ];
    expect(searchEntries(entries, "foo").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(2);
  });
});

describe("wim-extractor filterByType", () => {
  it("filters by regular", () => {
    const entries: WimFileEntry[] = [
      { name: "a", path: "a", fileSize: 0, attributes: 0x80, imageIndex: 1, type: "regular", isRegularFile: true, isDirectory: false, dataOffset: 0, dataLength: 0 },
      { name: "b", path: "b", fileSize: 0, attributes: 0x10, imageIndex: 1, type: "directory", isRegularFile: false, isDirectory: true, dataOffset: 0, dataLength: 0 },
    ];
    expect(filterByType(entries, "all").length).toBe(2);
    expect(filterByType(entries, "regular").length).toBe(1);
    expect(filterByType(entries, "directory").length).toBe(1);
  });
});

// ===== detectMimeFromName =====

describe("wim-extractor detectMimeFromName", () => {
  it("detects Windows-specific types", () => {
    expect(detectMimeFromName("foo.dll")).toBe("application/x-msdownload");
    expect(detectMimeFromName("foo.exe")).toBe("application/x-msdownload");
    expect(detectMimeFromName("foo.bat")).toBe("text/x-msdos-batch");
    expect(detectMimeFromName("foo.ps1")).toBe("text/x-powershell");
  });
  it("detects common types", () => {
    expect(detectMimeFromName("foo.txt")).toBe("text/plain");
    expect(detectMimeFromName("foo.json")).toBe("application/json");
    expect(detectMimeFromName("foo.png")).toBe("image/png");
  });
});

// ===== previewFile / looksLikeText =====

describe("wim-extractor previewFile", () => {
  it("returns text preview for text files", () => {
    const data = new TextEncoder().encode("Hello, WIM!");
    const preview = previewFile(data);
    expect(preview.isText).toBe(true);
    expect(preview.text).toBe("Hello, WIM!");
  });
  it("returns hex preview for binary files", () => {
    const data = new Uint8Array([0, 1, 2, 3, 0xff, 0xfe]);
    const preview = previewFile(data);
    expect(preview.isText).toBe(false);
    expect(preview.hex).toContain("00 01 02 03");
  });
});

describe("wim-extractor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("Hello, World!"))).toBe(true);
  });
  it("returns false for binary", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 3, 0xff]))).toBe(false);
  });
});

// ===== buildZipFromWim =====

describe("wim-extractor buildZipFromWim", () => {
  it("builds a ZIP from WIM entries", () => {
    const bytes = buildWimBytes({
      files: [
        { name: "a.txt", data: new TextEncoder().encode("aaa") },
        { name: "b.txt", data: new TextEncoder().encode("bbb") },
      ],
    });
    const entries = parseFileEntries(bytes, WIM_HEADER_SIZE);
    const blob = buildZipFromWim(bytes, entries);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ===== formatBytes =====

describe("wim-extractor formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== extractWim (top-level) =====

describe("wim-extractor extractWim", () => {
  it("extracts a valid WIM file", () => {
    const bytes = buildWimBytes({
      files: [
        { name: "Windows\\System32\\foo.dll", data: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]) },
        { name: "Windows\\bar.txt", data: new TextEncoder().encode("Hello") },
      ],
    });
    const result = extractWim(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.header.signature).toBe("MSWIM");
      expect(result.output.entries.length).toBe(2);
      expect(result.output.stats.fileCount).toBe(2);
    }
  });
  it("fails on bad signature", () => {
    const bytes = buildWimBytes({ badSignature: true });
    const result = extractWim(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/signature/i);
  });
  it("fails on empty input", () => {
    const result = extractWim(new Uint8Array(0));
    expect(result.ok).toBe(false);
  });
});

// ===== History =====

describe("wim-extractor history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.wim", wimSize: 100,
      imageCount: 1, fileCount: 5, totalExtractedSize: 500,
      extractedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.wim");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.wim`, wimSize: i,
        imageCount: 1, fileCount: 1, totalExtractedSize: 1,
        extractedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.wim", wimSize: 1,
      imageCount: 1, fileCount: 1, totalExtractedSize: 1,
      extractedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("wim-extractor shareUrl", () => {
  it("builds a URL with filter, search, imageIndex", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/wim-extractor" },
    };
    const url = buildShareUrl({ filter: "regular", search: "foo", imageIndex: 1 });
    expect(url).toContain("filter=regular");
    expect(url).toContain("q=foo");
    expect(url).toContain("img=1");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const opts = parseShareUrl("#filter=regular&q=foo&img=2");
    expect(opts).not.toBeNull();
    expect(opts!.filter).toBe("regular");
    expect(opts!.search).toBe("foo");
    expect(opts!.imageIndex).toBe(2);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns all filter when filter is invalid", () => {
    const opts = parseShareUrl("#filter=invalid");
    expect(opts!.filter).toBe("all");
  });
});
