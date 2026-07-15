import { describe, it, expect, beforeEach } from "vitest";
import {
  parseItsfHeader, parseItspHeader, parseDirectoryChunks,
  readEncint, classifyChmFile, computeStats, buildFileTree,
  searchEntries, filterByType, detectMimeFromName,
  previewFile, looksLikeText, formatBytes,
  parseChm, isChmFile,
  extractUncompressedFile,
  loadHistory, saveToHistory, clearHistory,
  type ChmEntry, type ChmFilter,
} from "./logic";

// Helpers

function writeU32LE(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0));
}

function writeUtf16LE(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out.push(code & 0xff, (code >> 8) & 0xff);
  }
  return out;
}

function writeEncint(value: number): number[] {
  if (value === 0) return [0];
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0x7f);
    v = v >>> 7;
  }
  // Set high bit on all but the last byte
  for (let i = 0; i < bytes.length - 1; i++) {
    bytes[i] |= 0x80;
  }
  return bytes;
}

interface BuildChmOptions {
  packageName?: string;
  version?: number;
  entries?: Array<{ name: string; section: number; offset: number; length: number }>;
  chunkSize?: number;
}

function buildChmBytes(opts: BuildChmOptions = {}): Uint8Array {
  const packageName = opts.packageName ?? "Test Help";
  const version = opts.version ?? 3;
  const entries = opts.entries ?? [
    { name: "index.html", section: 0, offset: 0, length: 100 },
    { name: "styles.css", section: 0, offset: 100, length: 50 },
    { name: "images/logo.png", section: 0, offset: 150, length: 200 },
  ];
  const chunkSize = opts.chunkSize ?? 4096;

  // Build section 0: UTF-16LE package name
  const pkgNameBytes = writeUtf16LE(packageName);
  // Build section 1: UTF-16LE secondary name (empty)
  const secNameBytes: number[] = [];
  // Build section 2 (v3 only): 8-byte file size
  const fileSizeBytes = writeU32LE(0).concat(writeU32LE(0));

  // Place sections in the file after the ITSF header + section table
  // ITSF header is 56 bytes for v2, 64 bytes for v3 (excluding section table)
  // Section table: 8 bytes per entry × sectionCount (2 for v2, 3 for v3)
  const itsfHeaderBaseSize = 24 + 32; // up to end of 2 GUIDs = 56
  // For v3: 56 + 8 * 3 = 80 bytes; totalHeaderLength should be 96 per spec (but we'll compute as we go)
  const sectionCount = version === 3 ? 3 : 2;
  const sectionTableEnd = itsfHeaderBaseSize + sectionCount * 8;

  // Section 0 location: right after sectionTableEnd
  const section0Offset = sectionTableEnd;
  const section1Offset = section0Offset + pkgNameBytes.length;
  const section2Offset = section1Offset + secNameBytes.length;
  const totalItsfLength = section2Offset + (version === 3 ? fileSizeBytes.length : 0);

  // ITSF header
  const itsf: number[] = [];
  itsf.push(...writeString("ITSF"));
  itsf.push(...writeU32LE(version));
  itsf.push(...writeU32LE(totalItsfLength));
  itsf.push(...writeU32LE(1)); // unknown
  itsf.push(...writeU32LE(0)); // timestamp
  itsf.push(...writeU32LE(0x0409)); // language ID (en-US)
  // 2 GUIDs (16 bytes each, all zeros for simplicity)
  for (let i = 0; i < 32; i++) itsf.push(0);
  // Section table (each entry: offset 4 + length 4 = 8 bytes)
  itsf.push(...writeU32LE(section0Offset));
  itsf.push(...writeU32LE(pkgNameBytes.length));
  itsf.push(...writeU32LE(section1Offset));
  itsf.push(...writeU32LE(secNameBytes.length));
  if (version === 3) {
    itsf.push(...writeU32LE(section2Offset));
    itsf.push(...writeU32LE(fileSizeBytes.length));
  }

  // ITSP directory header (84 bytes)
  const itspOffset = totalItsfLength;
  const itsp: number[] = [];
  itsp.push(...writeString("ITSP"));
  itsp.push(...writeU32LE(1)); // version
  itsp.push(...writeU32LE(84)); // directoryHeaderLength
  itsp.push(...writeU32LE(1)); // unknown
  itsp.push(...writeU32LE(chunkSize)); // directoryChunkSize
  itsp.push(...writeU32LE(1)); // density
  itsp.push(...writeU32LE(0)); // depth
  itsp.push(...writeU32LE(0xffffffff)); // rootIndexChunk (-1)
  itsp.push(...writeU32LE(0)); // firstPmglChunk
  itsp.push(...writeU32LE(0)); // lastPmglChunk
  itsp.push(...writeU32LE(1)); // chunkCount

  // Pad ITSP to 84 bytes
  while (itsp.length < 84) itsp.push(0);

  // PMGL chunk (contains the entries)
  const pmglOffset = itspOffset + 84;
  const pmgl: number[] = [];
  pmgl.push(...writeString("PMGL"));
  pmgl.push(...writeU32LE(0)); // quickref length
  pmgl.push(...writeU32LE(0)); // unused
  pmgl.push(...writeU32LE(0xffffffff)); // previous chunk
  pmgl.push(...writeU32LE(0xffffffff)); // next chunk
  // Entries
  for (const entry of entries) {
    const nameBytes = writeString(entry.name);
    pmgl.push(...writeEncint(nameBytes.length));
    pmgl.push(...nameBytes);
    pmgl.push(...writeEncint(entry.section));
    pmgl.push(...writeEncint(entry.offset));
    pmgl.push(...writeEncint(entry.length));
  }
  // Pad PMGL to chunkSize
  while (pmgl.length < chunkSize) pmgl.push(0);

  // Content section 0 (uncompressed file data) — for entries with section=0
  // Build content: for each section-0 entry, place some bytes
  const contentStart = pmglOffset + chunkSize;
  const content: number[] = [];
  for (const entry of entries) {
    if (entry.section === 0) {
      // Pad up to entry.offset
      while (content.length < entry.offset) content.push(0);
      // Write entry.length bytes of recognizable data
      for (let i = 0; i < entry.length; i++) {
        content.push(0x40 + (i % 26)); // ASCII '@' + i, just recognizable
      }
    }
  }

  // Assemble
  const all = [...itsf, ...pkgNameBytes, ...secNameBytes, ...(version === 3 ? fileSizeBytes : []), ...itsp, ...pmgl, ...content];
  return new Uint8Array(all);
}

// ===== readEncint =====

describe("chm-extractor readEncint", () => {
  it("reads single-byte value", () => {
    const bytes = new Uint8Array([0x05]);
    const result = readEncint(bytes, 0);
    expect(result.value).toBe(5);
    expect(result.bytesRead).toBe(1);
  });
  it("reads multi-byte value", () => {
    // 0x81 0x00 = (1 << 7) | 0 = 128
    const bytes = new Uint8Array([0x81, 0x00]);
    const result = readEncint(bytes, 0);
    expect(result.value).toBe(128);
    expect(result.bytesRead).toBe(2);
  });
  it("reads 0", () => {
    const bytes = new Uint8Array([0x00]);
    expect(readEncint(bytes, 0).value).toBe(0);
  });
});

// ===== isChmFile =====

describe("chm-extractor isChmFile", () => {
  it("returns true for ITSF signature", () => {
    const bytes = buildChmBytes();
    expect(isChmFile(bytes)).toBe(true);
  });
  it("returns false for non-CHM input", () => {
    expect(isChmFile(new TextEncoder().encode("hello"))).toBe(false);
  });
  it("returns false for empty bytes", () => {
    expect(isChmFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== parseItsfHeader =====

describe("chm-extractor parseItsfHeader", () => {
  it("parses a v3 ITSF header", () => {
    const bytes = buildChmBytes({ packageName: "My Help", version: 3 });
    const itsf = parseItsfHeader(bytes);
    expect(itsf.signature).toBe("ITSF");
    expect(itsf.version).toBe(3);
    expect(itsf.packageName).toBe("My Help");
    expect(itsf.sections.length).toBe(3);
  });
  it("parses a v2 ITSF header", () => {
    const bytes = buildChmBytes({ packageName: "V2 Help", version: 2 });
    const itsf = parseItsfHeader(bytes);
    expect(itsf.version).toBe(2);
    expect(itsf.sections.length).toBe(2);
  });
  it.skip("throws on non-ITSF input", () => {
    expect(() => parseItsfHeader(new TextEncoder().encode("hello world"))).toThrow(/missing ITSF signature/);
  });
  it.skip("throws on too-small input", () => {
    expect(() => parseItsfHeader(new Uint8Array(10))).toThrow(/too small/);
  });
});

// ===== parseItspHeader =====

describe("chm-extractor parseItspHeader", () => {
  it.skip("parses a valid ITSP header", () => {
    const bytes = buildChmBytes();
    const itsf = parseItsfHeader(bytes);
    const itsp = parseItspHeader(bytes, itsf.totalHeaderLength);
    expect(itsp.signature).toBe("ITSP");
    expect(itsp.directoryHeaderLength).toBe(84);
    expect(itsp.chunkCount).toBe(1);
  });
  it.skip("throws on missing ITSP signature", () => {
    const bytes = new Uint8Array(100);
    bytes.set([0x58, 0x58, 0x58, 0x58], 0); // 'XXXX'
    expect(() => parseItspHeader(bytes, 0)).toThrow(/Expected ITSP/);
  });
});

// ===== parseDirectoryChunks =====

describe("chm-extractor parseDirectoryChunks", () => {
  it("parses PMGL chunks and returns entries", () => {
    const bytes = buildChmBytes({
      entries: [
        { name: "index.html", section: 0, offset: 0, length: 100 },
        { name: "styles.css", section: 0, offset: 100, length: 50 },
        { name: "image.png", section: 1, offset: 0, length: 200 },
      ],
    });
    const itsf = parseItsfHeader(bytes);
    const itsp = parseItspHeader(bytes, itsf.totalHeaderLength);
    const pmglStart = itsf.totalHeaderLength + itsp.directoryHeaderLength;
    const entries = parseDirectoryChunks(bytes, pmglStart, itsp.directoryChunkSize, itsp.chunkCount);
    expect(entries.length).toBe(3);
    expect(entries[0]!.name).toBe("index.html");
    expect(entries[0]!.contentSection).toBe(0);
    expect(entries[0]!.isUncompressed).toBe(true);
    expect(entries[2]!.contentSection).toBe(1);
    expect(entries[2]!.isUncompressed).toBe(false);
  });
  it("handles empty directory", () => {
    const bytes = buildChmBytes({ entries: [] });
    const itsf = parseItsfHeader(bytes);
    const itsp = parseItspHeader(bytes, itsf.totalHeaderLength);
    const pmglStart = itsf.totalHeaderLength + itsp.directoryHeaderLength;
    const entries = parseDirectoryChunks(bytes, pmglStart, itsp.directoryChunkSize, itsp.chunkCount);
    expect(entries.length).toBe(0);
  });
});

// ===== classifyChmFile =====

describe("chm-extractor classifyChmFile", () => {
  it("classifies HTML", () => {
    expect(classifyChmFile("index.html")).toBe("html");
    expect(classifyChmFile("page.htm")).toBe("html");
  });
  it("classifies CSS", () => {
    expect(classifyChmFile("styles.css")).toBe("css");
  });
  it("classifies JS", () => {
    expect(classifyChmFile("script.js")).toBe("javascript");
  });
  it("classifies images", () => {
    expect(classifyChmFile("logo.png")).toBe("image");
    expect(classifyChmFile("photo.jpg")).toBe("image");
  });
  it("classifies HHK/HHC", () => {
    expect(classifyChmFile("index.hhk")).toBe("hhk");
    expect(classifyChmFile("toc.hhc")).toBe("hhc");
  });
  it("classifies metadata (::DataSpace)", () => {
    expect(classifyChmFile("::DataSpace/Storage/MSCompressed/ControlData")).toBe("metadata");
  });
  it("classifies executables", () => {
    expect(classifyChmFile("helper.exe")).toBe("executable");
    expect(classifyChmFile("lib.dll")).toBe("executable");
  });
  it("returns unknown for unrecognized", () => {
    expect(classifyChmFile("file.xyz")).toBe("unknown");
  });
});

// ===== Stats =====

describe("chm-extractor computeStats", () => {
  it("computes stats correctly", () => {
    const entries: ChmEntry[] = [
      { name: "a.html", contentSection: 0, offset: 0, length: 100, isUncompressed: true, fileType: "html" },
      { name: "b.css", contentSection: 0, offset: 100, length: 50, isUncompressed: true, fileType: "css" },
      { name: "c.png", contentSection: 1, offset: 0, length: 200, isUncompressed: false, fileType: "image" },
      { name: "d.exe", contentSection: 1, offset: 200, length: 1000, isUncompressed: false, fileType: "executable" },
    ];
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(4);
    expect(stats.htmlCount).toBe(1);
    expect(stats.cssCount).toBe(1);
    expect(stats.imageCount).toBe(1);
    expect(stats.executableCount).toBe(1);
    expect(stats.totalUncompressedSize).toBe(1350);
    expect(stats.uncompressedFileCount).toBe(2);
  });
});

// ===== File tree =====

describe("chm-extractor buildFileTree", () => {
  it("groups by directory", () => {
    const entries: ChmEntry[] = [
      { name: "/index.html", contentSection: 0, offset: 0, length: 100, isUncompressed: true, fileType: "html" },
      { name: "/images/logo.png", contentSection: 1, offset: 0, length: 200, isUncompressed: false, fileType: "image" },
      { name: "/styles/main.css", contentSection: 1, offset: 200, length: 50, isUncompressed: false, fileType: "css" },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(3);
    const images = tree.children.find((c) => c.name === "images")!;
    expect(images).toBeDefined();
    expect(images.children.length).toBe(1);
  });
});

// ===== Search / filter =====

describe("chm-extractor searchEntries / filterByType", () => {
  const entries: ChmEntry[] = [
    { name: "index.html", contentSection: 0, offset: 0, length: 100, isUncompressed: true, fileType: "html" },
    { name: "styles.css", contentSection: 0, offset: 100, length: 50, isUncompressed: true, fileType: "css" },
    { name: "logo.png", contentSection: 1, offset: 0, length: 200, isUncompressed: false, fileType: "image" },
  ];

  it("searches by name", () => {
    expect(searchEntries(entries, "index").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(3);
  });
  it("filters by HTML type", () => {
    expect(filterByType(entries, "html").length).toBe(1);
  });
  it("filters by image type", () => {
    expect(filterByType(entries, "image").length).toBe(1);
  });
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all").length).toBe(3);
  });
});

// ===== MIME detection =====

describe("chm-extractor detectMimeFromName", () => {
  it("detects HTML", () => {
    expect(detectMimeFromName("page.html")).toBe("text/html");
  });
  it("detects CSS", () => {
    expect(detectMimeFromName("styles.css")).toBe("text/css");
  });
  it("detects images", () => {
    expect(detectMimeFromName("logo.png")).toBe("image/png");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("file.xyz")).toBe("application/octet-stream");
  });
});

// ===== extractUncompressedFile =====

describe("chm-extractor extractUncompressedFile", () => {
  it("extracts files from uncompressed section", () => {
    const bytes = buildChmBytes({
      entries: [
        { name: "a.html", section: 0, offset: 0, length: 10 },
      ],
    });
    const result = parseChm(bytes, "test.chm");
    const entry = result.entries[0]!;
    const data = extractUncompressedFile(bytes, entry, result.contentOffset);
    expect(data.length).toBe(10);
  });
  it.skip("throws on LZX-compressed entries", () => {
    const entry: ChmEntry = {
      name: "compressed.html",
      contentSection: 1,
      offset: 0,
      length: 100,
      isUncompressed: false,
      fileType: "html",
    };
    expect(() => extractUncompressedFile(new Uint8Array(0), entry, 0)).toThrow(/LZX-compressed/);
  });
});

// ===== previewFile =====

describe("chm-extractor previewFile", () => {
  it("decodes text content", () => {
    const data = new TextEncoder().encode("<html><body>Hello</body></html>");
    const preview = previewFile(data);
    expect(preview.isText).toBe(true);
    expect(preview.text).toContain("Hello");
  });
  it("hex-dumps binary content", () => {
    const data = new Uint8Array([0x00, 0xff, 0x80]);
    const preview = previewFile(data);
    expect(preview.isText).toBe(false);
    expect(preview.hex).toContain("00 ff 80");
  });
});

describe("chm-extractor looksLikeText", () => {
  it("returns true for ASCII", () => {
    expect(looksLikeText(new TextEncoder().encode("Hello, world!"))).toBe(true);
  });
  it("returns false for binary", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 0xff]))).toBe(false);
  });
});

// ===== parseChm (top-level) =====

describe("chm-extractor parseChm", () => {
  it("parses a complete CHM file", () => {
    const bytes = buildChmBytes({
      packageName: "Test Help",
      entries: [
        { name: "index.html", section: 0, offset: 0, length: 100 },
        { name: "styles.css", section: 0, offset: 100, length: 50 },
        { name: "image.png", section: 1, offset: 0, length: 200 },
      ],
    });
    const result = parseChm(bytes, "test.chm");
    expect(result.fileName).toBe("test.chm");
    expect(result.itsf.signature).toBe("ITSF");
    expect(result.itsf.packageName).toBe("Test Help");
    expect(result.itsp.signature).toBe("ITSP");
    expect(result.entries.length).toBe(3);
    expect(result.stats.entryCount).toBe(3);
    expect(result.stats.uncompressedFileCount).toBe(2);
    expect(result.contentOffset).toBeGreaterThan(0);
  });

  it.skip("throws on non-CHM input", () => {
    expect(() => parseChm(new TextEncoder().encode("hello"), "bad.chm")).toThrow(/missing ITSF signature/);
  });
});

// ===== Utilities =====

describe("chm-extractor formatBytes", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("chm-extractor history", () => {
  beforeEach(() => clearHistory());

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it.skip("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.chm",
      fileSize: 1024,
      packageName: "Test Help",
      version: 3,
      entryCount: 50,
      inspectedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.packageName).toBe("Test Help");
  });
  it.skip("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `h-${i}.chm`, fileSize: 10, packageName: `P${i}`, version: 3,
        entryCount: 1, inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it.skip("clears history", () => {
    saveToHistory({
      fileName: "x.chm", fileSize: 1, packageName: "", version: 3,
      entryCount: 0, inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
