import { describe, it, expect, beforeEach } from "vitest";
import {
  isPrcFile, parsePrcHeader, parsePrc,
  computeStats, generateEpub, convertPrcToEpub, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
  parsePalmDbHeader, parseRecordInfoTable, extractRecords,
  parsePalmDocHeader, decompressTextRecord, decodeText, extractText,
} from "./logic";

// ===== Helpers =====

function writeU16BE(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function writeU32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function writeString(s: string, length: number): number[] {
  const bytes = new Array(length).fill(0);
  for (let i = 0; i < s.length && i < length; i++) {
    bytes[i] = s.charCodeAt(i);
  }
  return bytes;
}

interface BuildPrcOptions {
  name?: string;
  creator?: string;
  text?: string;
  compression?: number;       // 0=none, 1=PalmDOC
  encoding?: number;          // 1252 or 65001
  encryption?: number;
  exthAuthor?: string;
  exthLanguage?: string;
}

function buildPrcBytes(opts: BuildPrcOptions = {}): Uint8Array {
  const name = opts.name ?? "Test PRC Book";
  const creator = opts.creator ?? "TEXt";
  const text = opts.text ?? "<h1>Chapter 1</h1><p>Hello world.</p><h1>Chapter 2</h1><p>Second chapter.</p>";
  const compression = opts.compression ?? 0;
  const encoding = opts.encoding ?? 1252;
  const encryption = opts.encryption ?? 0;

  const textBytes = encoding === 65001
    ? new TextEncoder().encode(text)
    : new Uint8Array(Array.from(text).map((c) => c.charCodeAt(0) & 0xff));
  const textLength = textBytes.length;

  // Build record 0: PalmDOC header + MOBI header + EXTH header
  const record0Parts: number[] = [];
  record0Parts.push(...writeU16BE(compression));
  record0Parts.push(...writeU16BE(0));
  record0Parts.push(...writeU32BE(textLength));
  record0Parts.push(...writeU16BE(1));
  record0Parts.push(...writeU16BE(4096));
  record0Parts.push(...writeU16BE(encryption));
  record0Parts.push(...writeU16BE(0));

  // MOBI header
  const mobiHeaderParts: number[] = [];
  mobiHeaderParts.push(...writeString("MOBI", 4));
  mobiHeaderParts.push(...writeU32BE(116));
  mobiHeaderParts.push(...writeU32BE(2));
  mobiHeaderParts.push(...writeU32BE(encoding));
  mobiHeaderParts.push(...writeU32BE(1));
  mobiHeaderParts.push(...writeU32BE(1));
  const mobiHeaderLength = 4 + 4 + 124;
  while (mobiHeaderParts.length < mobiHeaderLength) mobiHeaderParts.push(0);

  // EXTH header
  const exthRecords: number[] = [];
  const exthTypes: Array<[number, string]> = [];
  if (opts.exthAuthor) exthTypes.push([100, opts.exthAuthor]);
  if (opts.exthLanguage) exthTypes.push([3, opts.exthLanguage]);
  for (const [type, value] of exthTypes) {
    const valueBytes = Array.from(new TextEncoder().encode(value));
    exthRecords.push(...writeU32BE(type));
    exthRecords.push(...writeU32BE(8 + valueBytes.length));
    exthRecords.push(...valueBytes);
  }
  const exthHeaderParts: number[] = [];
  exthHeaderParts.push(...writeString("EXTH", 4));
  exthHeaderParts.push(...writeU32BE(12 + exthRecords.length));
  exthHeaderParts.push(...writeU32BE(exthTypes.length));
  exthHeaderParts.push(...exthRecords);

  record0Parts.push(...mobiHeaderParts);
  record0Parts.push(...exthHeaderParts);
  const record0 = new Uint8Array(record0Parts);

  const record1 = textBytes;

  // PalmDB header (78 bytes) + record info table
  const headerSize = 78;
  const recordInfoTableSize = 2 * 8;
  const record0Offset = headerSize + recordInfoTableSize + 2;
  const record1Offset = record0Offset + record0.length;

  const header: number[] = [];
  header.push(...writeString(name.slice(0, 32), 32));
  header.push(...writeU16BE(0));
  header.push(...writeU16BE(0));
  for (let i = 0; i < 16; i++) header.push(0);
  header.push(...writeU32BE(0));
  header.push(...writeU32BE(0));
  header.push(...writeString("BOOK", 4));
  header.push(...writeString(creator, 4));
  header.push(...writeU32BE(0));
  header.push(...writeU32BE(0));
  header.push(...writeU16BE(2));
  header.push(...writeU32BE(record0Offset));
  header.push(...writeU16BE(0));
  header.push(...writeU16BE(0));
  header.push(...writeU32BE(record1Offset));
  header.push(...writeU16BE(0));
  header.push(...writeU16BE(1));
  header.push(...writeU16BE(0));

  const total = header.length + record0.length + record1.length;
  const out = new Uint8Array(total);
  out.set(new Uint8Array(header), 0);
  out.set(record0, header.length);
  out.set(record1, header.length + record0.length);
  return out;
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

// ===== isPrcFile =====

describe("prc-to-epub-converter isPrcFile", () => {
  it("returns true for a PRC file with creator TEXt", () => {
    expect(isPrcFile(buildPrcBytes({ creator: "TEXt" }))).toBe(true);
  });
  it("returns true for a PRC file with creator MOBI", () => {
    expect(isPrcFile(buildPrcBytes({ creator: "MOBI" }))).toBe(true);
  });
  it("returns false for wrong creator", () => {
    expect(isPrcFile(buildPrcBytes({ creator: "PDFR" }))).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isPrcFile(new Uint8Array(10))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isPrcFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== parsePrcHeader =====

describe("prc-to-epub-converter parsePrcHeader", () => {
  it("parses PalmDB header with name + creator", () => {
    const bytes = buildPrcBytes({ name: "My PRC", creator: "TEXt" });
    const h = parsePrcHeader(bytes);
    expect(h.name).toBe("My PRC");
    expect(h.creator).toBe("TEXt");
    expect(h.type).toBe("BOOK");
    expect(h.recordCount).toBe(2);
  });
  it("throws on too-small input", () => {
    expect(() => parsePrcHeader(new Uint8Array(10))).toThrow(/too small/);
  });
});

// ===== parsePalmDbHeader / parsePalmDocHeader (re-exported) =====

describe("prc-to-epub-converter parsePalmDbHeader", () => {
  it("parses name, type, creator", () => {
    const bytes = buildPrcBytes({ name: "ABC", creator: "MOBI" });
    const h = parsePalmDbHeader(bytes);
    expect(h.name).toBe("ABC");
    expect(h.type).toBe("BOOK");
    expect(h.creator).toBe("MOBI");
  });
});

describe("prc-to-epub-converter parsePalmDocHeader", () => {
  it("parses compression + textLength + recordCount", () => {
    const bytes = buildPrcBytes({ text: "hello world", compression: 0 });
    const h = parsePalmDbHeader(bytes);
    const recordInfos = parseRecordInfoTable(bytes, h.recordCount, 78);
    const records = extractRecords(bytes, recordInfos);
    const palmDoc = parsePalmDocHeader(records[0]!.data);
    expect(palmDoc.compression).toBe(0);
    expect(palmDoc.textLength).toBe(11);
    expect(palmDoc.textRecordCount).toBe(1);
    expect(palmDoc.encryptionType).toBe(0);
  });
});

// ===== decompressTextRecord / decodeText =====

describe("prc-to-epub-converter decompressTextRecord", () => {
  it("returns uncompressed data as-is for method 0", () => {
    const data = new TextEncoder().encode("hello");
    const result = decompressTextRecord(data, 0);
    expect(new TextDecoder().decode(result)).toBe("hello");
  });
  it("throws on HuffCDic (method 2)", () => {
    expect(() => decompressTextRecord(new Uint8Array([1, 2, 3]), 2)).toThrow(/HuffCDic/);
  });
});

describe("prc-to-epub-converter decodeText", () => {
  it("decodes UTF-8 (encoding 65001)", () => {
    const text = "Héllo, 世界";
    const data = new TextEncoder().encode(text);
    expect(decodeText(data, 65001)).toBe(text);
  });
  it("decodes CP1252 (encoding 1252)", () => {
    const data = new Uint8Array([0x48, 0xe9, 0x6c, 0x6c, 0x6f]); // Héllo in CP1252
    expect(decodeText(data, 1252)).toBe("Héllo");
  });
});

// ===== extractText =====

describe("prc-to-epub-converter extractText", () => {
  it("extracts text from text records", () => {
    const text = "Hello, PRC world!";
    const bytes = buildPrcBytes({ text, compression: 0 });
    const h = parsePalmDbHeader(bytes);
    const recordInfos = parseRecordInfoTable(bytes, h.recordCount, 78);
    const records = extractRecords(bytes, recordInfos);
    const palmDoc = parsePalmDocHeader(records[0]!.data);
    const mobiHeader = { textEncoding: 1252, isMobi: true, identifier: "MOBI", headerLength: 116, mobiType: 2, uniqueId: 1, fileVersion: 1, firstImageRecord: 0, firstHuffTableRecord: 0 };
    const extracted = extractText(records, palmDoc, mobiHeader);
    expect(extracted).toBe(text);
  });
});

// ===== parsePrc =====

describe("prc-to-epub-converter parsePrc", () => {
  it("parses a valid PRC file", () => {
    const bytes = buildPrcBytes({
      name: "My PRC Book",
      creator: "TEXt",
      text: "<h1>Chapter 1</h1><p>Hello.</p>",
      exthAuthor: "Test Author",
      exthLanguage: "en",
    });
    const book = parsePrc(bytes);
    expect(book.metadata.title).toBe("My PRC Book");
    expect(book.metadata.author).toBe("Test Author");
    expect(book.metadata.language).toBe("en");
    expect(book.metadata.encoding).toBe("CP1252");
    expect(book.metadata.compression).toBe("None");
    expect(book.rawText).toContain("Hello");
    expect(book.isEncrypted).toBe(false);
    expect(book.unsupportedCompression).toBe(false);
    expect(book.mobiChapters.length).toBeGreaterThan(0);
  });
  it("detects encryption", () => {
    const bytes = buildPrcBytes({ encryption: 1 });
    const book = parsePrc(bytes);
    expect(book.isEncrypted).toBe(true);
    expect(book.rawText).toBe("");
  });
  it("detects unsupported compression", () => {
    const bytes = buildPrcBytes({ compression: 2 });
    const book = parsePrc(bytes);
    expect(book.unsupportedCompression).toBe(true);
    expect(book.rawText).toBe("");
  });
  it("throws on invalid creator and type", () => {
    // Manually corrupt: change both type (offset 60) and creator (offset 64)
    const bytes = buildPrcBytes({ creator: "TEXt" });
    bytes[60] = "X".charCodeAt(0);
    bytes[61] = "X".charCodeAt(0);
    bytes[62] = "X".charCodeAt(0);
    bytes[63] = "X".charCodeAt(0);
    bytes[64] = "P".charCodeAt(0);
    bytes[65] = "D".charCodeAt(0);
    bytes[66] = "F".charCodeAt(0);
    bytes[67] = "R".charCodeAt(0);
    expect(() => parsePrc(bytes)).toThrow(/Not a valid PRC file/);
  });
});

// ===== computeStats =====

describe("prc-to-epub-converter computeStats", () => {
  it("computes record count + chapter word counts", () => {
    const palmDoc = { compression: 0, textLength: 100, textRecordCount: 5, recordSize: 4096, encryptionType: 0 };
    const chapters = [
      { number: 1, title: "Ch 1", bodyHtml: "<p>a</p>", wordCount: 5, charCount: 10 },
      { number: 2, title: "Ch 2", bodyHtml: "<p>b</p>", wordCount: 3, charCount: 6 },
    ];
    const stats = computeStats(palmDoc, chapters, 1024);
    expect(stats.recordCount).toBe(5);
    expect(stats.textRecordCount).toBe(5);
    expect(stats.chapterCount).toBe(2);
    expect(stats.wordCount).toBe(8);
    expect(stats.charCount).toBe(16);
    expect(stats.epubBytes).toBe(1024);
  });
});

// ===== generateEpub =====

describe("prc-to-epub-converter generateEpub", () => {
  it("produces a non-empty EPUB Blob from text", () => {
    const text = "# Chapter 1\nHello world.\n# Chapter 2\nGoodbye world.";
    const { blob, chapters, bookId } = generateEpub(text, {
      title: "Test", author: "Author", language: "en", fontSize: 16, customCss: "",
    });
    expect(blob.size).toBeGreaterThan(100);
    expect(chapters.length).toBeGreaterThan(0);
    expect(bookId).toMatch(/^urn:uuid:/);
  });
});

// ===== convertPrcToEpub =====

describe("prc-to-epub-converter convertPrcToEpub", () => {
  it("converts a valid PRC file to EPUB", async () => {
    const bytes = buildPrcBytes({
      name: "My PRC Book",
      creator: "TEXt",
      text: "<h1>Chapter 1</h1><p>Hello world.</p><h1>Chapter 2</h1><p>Second chapter.</p>",
      exthAuthor: "Test Author",
    });
    const result = await convertPrcToEpub(bytes, DEFAULT_OPTIONS, "my-book.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("my-book.epub");
      expect(result.output.stats.chapterCount).toBeGreaterThan(0);
      expect(result.output.stats.wordCount).toBeGreaterThan(0);
      expect(result.output.metadata.title).toBe("My PRC Book");
    }
  });
  it("uses PRC metadata when options are default", async () => {
    const bytes = buildPrcBytes({
      name: "Embedded Title",
      exthAuthor: "Embedded Author",
      text: "Some content.",
    });
    const result = await convertPrcToEpub(bytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Embedded Title");
      expect(result.output.metadata.author).toBe("Embedded Author");
    }
  });
  it("overrides metadata when custom options are set", async () => {
    const bytes = buildPrcBytes({
      name: "Embedded",
      exthAuthor: "Embedded",
      text: "Some content.",
    });
    const opts = { ...DEFAULT_OPTIONS, title: "Custom Title", author: "Custom Author" };
    const result = await convertPrcToEpub(bytes, opts, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on bad signature", async () => {
    const bytes = new Uint8Array(50);
    const result = await convertPrcToEpub(bytes);
    expect(result.ok).toBe(false);
  });
  it("fails on encrypted PRC", async () => {
    const bytes = buildPrcBytes({ encryption: 1 });
    const result = await convertPrcToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/DRM-protected/);
  });
  it("fails on HuffCDic compression", async () => {
    const bytes = buildPrcBytes({ compression: 2 });
    const result = await convertPrcToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HuffCDic/);
  });
});

// ===== formatBytes =====

describe("prc-to-epub-converter formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("prc-to-epub-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.prc", prcBytes: 100, epubBytes: 200,
      recordCount: 5, chapterCount: 2, wordCount: 50,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    saveToHistory(entry);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.prc");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.prc`, prcBytes: i, epubBytes: i * 2,
        recordCount: 1, chapterCount: 1, wordCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.prc", prcBytes: 1, epubBytes: 2,
      recordCount: 1, chapterCount: 1, wordCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("prc-to-epub-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/prc-to-epub-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, title: "My Book", fontSize: 18 });
    expect(url).toContain("#mode=heading");
    expect(url).toContain("title=My+Book");
    expect(url).toContain("fs=18");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#mode=heading&title=Test&author=Auth&fs=20&lang=fr";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.chapterMode).toBe("heading");
    expect(opts!.title).toBe("Test");
    expect(opts!.fontSize).toBe(20);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#mode=heading&fs=999");
    expect(opts!.fontSize).toBe(36);
  });
});
