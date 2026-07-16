import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  chapterToText,
  chaptersToPageTexts,
  countWords,
  generateEpub,
  convertMobiToEpub,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MobiToEpubOptions,
} from "./logic";

// ===== MOBI test fixture helpers =====

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

interface BuildMobiOptions {
  name?: string;
  creator?: string;
  text?: string;
  compression?: number;
  encoding?: number;
  encryption?: number;
  exthAuthor?: string;
  exthLanguage?: string;
}

function buildMobiBytes(opts: BuildMobiOptions = {}): Uint8Array {
  const name = opts.name ?? "Test Book";
  const creator = opts.creator ?? "MOBI";
  const text =
    opts.text ??
    "<h1>Chapter 1</h1><p>Hello world.</p><h1>Chapter 2</h1><p>Second chapter.</p>";
  const compression = opts.compression ?? 0;
  const encoding = opts.encoding ?? 1252;
  const encryption = opts.encryption ?? 0;

  const textBytes =
    encoding === 65001
      ? new TextEncoder().encode(text)
      : new Uint8Array(Array.from(text).map((c) => c.charCodeAt(0) & 0xff));
  const textLength = textBytes.length;

  const record0Parts: number[] = [];
  // PalmDOC header (16 bytes)
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
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: Object.keys(store).length,
  } as Storage;
});

// ===== chapterToText (smoke — uses MobiChapter fixture) =====

describe("mobi-to-epub-converter chapterToText", () => {
  it("returns the chapter's text field", () => {
    const ch = { index: 0, title: "Ch1", html: "<h1>Ch1</h1>", text: "Plain text" };
    expect(chapterToText(ch)).toBe("Plain text");
  });
});

// ===== chaptersToPageTexts =====

describe("mobi-to-epub-converter chaptersToPageTexts", () => {
  it("returns one text per chapter", () => {
    const chapters = [
      { index: 0, title: "Ch1", html: "<h1>Ch1</h1>", text: "First" },
      { index: 1, title: "Ch2", html: "<h1>Ch2</h1>", text: "Second" },
    ];
    const texts = chaptersToPageTexts(chapters);
    expect(texts.length).toBe(2);
    expect(texts[0]).toContain("Ch1");
    expect(texts[0]).toContain("First");
  });
});

// ===== countWords =====

describe("mobi-to-epub-converter countWords", () => {
  it("counts words in a simple string", () => {
    expect(countWords("Hello world")).toBe(2);
  });
  it("counts 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
  it("counts words with newlines", () => {
    expect(countWords("Hello\nworld\nfoo")).toBe(3);
  });
});

// ===== generateEpub =====

describe("mobi-to-epub-converter generateEpub", () => {
  it("generates a non-empty EPUB blob from texts", () => {
    const texts = ["# Chapter 1\nHello world.", "# Chapter 2\nSecond chapter."];
    const { blob, chapters, bookId } = generateEpub(texts, {
      title: "Test",
      author: "Author",
      language: "en",
      fontSize: 16,
      customCss: "",
    });
    expect(blob.size).toBeGreaterThan(100);
    expect(chapters.length).toBeGreaterThan(0);
    expect(bookId).toMatch(/^urn:uuid:/);
  });
});

// ===== convertMobiToEpub =====

describe("mobi-to-epub-converter convertMobiToEpub", () => {
  it("converts a valid MOBI to EPUB", async () => {
    const mobiBytes = buildMobiBytes({
      name: "Test Book",
      text: "<h1>Chapter 1</h1><p>Hello world.</p><h1>Chapter 2</h1><p>Second chapter.</p>",
    });
    const result = await convertMobiToEpub(mobiBytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("out.epub");
      expect(result.output.chapterCount).toBeGreaterThan(0);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.epubBytes).toBeGreaterThan(100);
      expect(result.output.isEncrypted).toBe(false);
      expect(result.output.unsupportedCompression).toBe(false);
    }
  });
  it("uses MOBI metadata when options are default", async () => {
    const mobiBytes = buildMobiBytes({
      name: "Embedded Title",
      exthAuthor: "Embedded Author",
      exthLanguage: "fr",
    });
    const result = await convertMobiToEpub(mobiBytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Embedded Title");
      expect(result.output.metadata.author).toBe("Embedded Author");
      expect(result.output.metadata.language).toBe("fr");
    }
  });
  it("overrides metadata when custom options are set", async () => {
    const mobiBytes = buildMobiBytes({ name: "Original" });
    const opts: MobiToEpubOptions = {
      ...DEFAULT_OPTIONS,
      title: "Custom Title",
      author: "Custom Author",
    };
    const result = await convertMobiToEpub(mobiBytes, opts, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on non-MOBI input", async () => {
    const result = await convertMobiToEpub(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Not a valid MOBI/);
  });
  it("fails on DRM-protected MOBI", async () => {
    const mobiBytes = buildMobiBytes({ encryption: 1 });
    const result = await convertMobiToEpub(mobiBytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/DRM/);
  });
  it("includes preview text from first chapter", async () => {
    const mobiBytes = buildMobiBytes({
      text: "<h1>Chapter 1</h1><p>Hello world.</p>",
    });
    const result = await convertMobiToEpub(mobiBytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.previewText).toContain("Hello world");
    }
  });
  it("supports UTF-8 encoding", async () => {
    const mobiBytes = buildMobiBytes({ encoding: 65001 });
    const result = await convertMobiToEpub(mobiBytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.encoding).toBe("UTF-8");
    }
  });
  it("supports CP1252 encoding", async () => {
    const mobiBytes = buildMobiBytes({ encoding: 1252 });
    const result = await convertMobiToEpub(mobiBytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.encoding).toBe("CP1252");
    }
  });
});

// ===== formatBytes =====

describe("mobi-to-epub-converter formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats 500 as '500 B'", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
});

// ===== History =====

describe("mobi-to-epub-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.mobi",
      mobiBytes: 1000,
      epubBytes: 2000,
      chapterCount: 5,
      wordCount: 200,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.mobi");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.mobi`,
        mobiBytes: i,
        epubBytes: i * 2,
        chapterCount: 1,
        wordCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.mobi",
      mobiBytes: 1,
      epubBytes: 2,
      chapterCount: 1,
      wordCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("mobi-to-epub-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/mobi-to-epub-converter" },
    };
    const opts: MobiToEpubOptions = {
      ...DEFAULT_OPTIONS,
      title: "My Book",
      author: "Auth",
      fontSize: 18,
      language: "fr",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("mode=heading");
    expect(url).toContain("title=My+Book");
    expect(url).toContain("author=Auth");
    expect(url).toContain("fs=18");
    expect(url).toContain("lang=fr");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#mode=heading&title=Test&author=Auth&fs=20&lang=fr";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.chapterMode).toBe("heading");
    expect(opts!.title).toBe("Test");
    expect(opts!.author).toBe("Auth");
    expect(opts!.fontSize).toBe(20);
    expect(opts!.language).toBe("fr");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#fs=999");
    expect(opts!.fontSize).toBe(36);
  });
});

// ===== DEFAULT_OPTIONS =====

describe("mobi-to-epub-converter DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.chapterMode).toBe("heading");
    expect(DEFAULT_OPTIONS.fontSize).toBe(16);
    expect(DEFAULT_OPTIONS.language).toBe("en");
  });
});
