import { describe, it, expect, beforeEach } from "vitest";
import {
  LIT_SIGNATURE, LIT_HEADER_MIN_SIZE,
  isLitFile, parseLitHeader, parseSectionTable, extractSectionData,
  parseMetadata, decodeSectionText, extractAllText, computeStats,
  generateEpub, convertLitToEpub, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
  type LitSection, type LitConvertOptions,
} from "./logic";

// ===== Helpers =====

function writeU16LE(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function writeU32LE(value: number): number[] {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

interface BuildLitOptions {
  version?: number;
  sections?: Array<{ data: Uint8Array; flags?: number }>;
  /** Optional: corrupt the signature. */
  badSignature?: boolean;
  /** Optional: truncate the file. */
  truncate?: number;
}

function buildLitBytes(opts: BuildLitOptions = {}): Uint8Array {
  const version = opts.version ?? 1;
  const sections = opts.sections ?? [];
  const sectionCount = sections.length;
  const headerSize = LIT_HEADER_MIN_SIZE + sectionCount * 12;

  // Compute section offsets (each section's data follows the header + table)
  let dataStart = headerSize;
  const sectionMeta: Array<{ offset: number; size: number; flags: number; data: Uint8Array }> = [];
  for (const sec of sections) {
    sectionMeta.push({
      offset: dataStart,
      size: sec.data.length,
      flags: sec.flags ?? 0,
      data: sec.data,
    });
    dataStart += sec.data.length;
  }

  const header: number[] = [];
  if (opts.badSignature) {
    header.push(...writeString("XXXXXXXX"));
  } else {
    header.push(...writeString(LIT_SIGNATURE));
  }
  header.push(...writeU32LE(version));
  header.push(...writeU32LE(headerSize));
  header.push(...writeU32LE(sectionCount));
  for (const m of sectionMeta) {
    header.push(...writeU32LE(m.offset));
    header.push(...writeU32LE(m.size));
    header.push(...writeU32LE(m.flags));
  }

  const total = header.length + sectionMeta.reduce((s, m) => s + m.data.length, 0);
  const truncate = opts.truncate ?? total;
  const out = new Uint8Array(Math.min(total, truncate));
  out.set(new Uint8Array(header), 0);
  let pos = header.length;
  for (const m of sectionMeta) {
    if (pos >= out.length) break;
    const sliceLen = Math.min(m.data.length, out.length - pos);
    out.set(m.data.subarray(0, sliceLen), pos);
    pos += m.data.length;
  }
  return out;
}

function makeMetadata(title: string, author: string, language = "en"): Uint8Array {
  return new TextEncoder().encode(
    `<metadata><title>${title}</title><author>${author}</author><language>${language}</language></metadata>`,
  );
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

// ===== isLitFile =====

describe("lit-to-epub-converter isLitFile", () => {
  it("returns true for a valid LIT signature", () => {
    const bytes = buildLitBytes({ sections: [] });
    expect(isLitFile(bytes)).toBe(true);
  });
  it("returns false for a corrupted signature", () => {
    const bytes = buildLitBytes({ sections: [], badSignature: true });
    expect(isLitFile(bytes)).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isLitFile(new Uint8Array(10))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isLitFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== parseLitHeader =====

describe("lit-to-epub-converter parseLitHeader", () => {
  it("parses signature, version, section count", () => {
    const bytes = buildLitBytes({ version: 1, sections: [] });
    const h = parseLitHeader(bytes);
    expect(h.signature).toBe(LIT_SIGNATURE);
    expect(h.version).toBe(1);
    expect(h.sectionCount).toBe(0);
  });
  it("throws on too-small input", () => {
    expect(() => parseLitHeader(new Uint8Array(5))).toThrow(/too small/);
  });
  it("throws on bad signature", () => {
    const bytes = buildLitBytes({ badSignature: true });
    expect(() => parseLitHeader(bytes)).toThrow(/Not a valid LIT file/);
  });
  it("parses non-zero version", () => {
    const bytes = buildLitBytes({ version: 2 });
    expect(parseLitHeader(bytes).version).toBe(2);
  });
});

// ===== parseSectionTable =====

describe("lit-to-epub-converter parseSectionTable", () => {
  it("parses an empty section table", () => {
    const bytes = buildLitBytes({ sections: [] });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    expect(secs.length).toBe(0);
  });
  it("parses multiple sections with correct offsets and sizes", () => {
    const bytes = buildLitBytes({
      sections: [
        { data: new TextEncoder().encode("AAA") },
        { data: new TextEncoder().encode("BBBBBB") },
        { data: new TextEncoder().encode("CC") },
      ],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    expect(secs.length).toBe(3);
    expect(secs[0]!.size).toBe(3);
    expect(secs[1]!.size).toBe(6);
    expect(secs[2]!.size).toBe(2);
    expect(secs[1]!.offset).toBe(secs[0]!.offset + secs[0]!.size);
  });
  it("reads flags correctly", () => {
    const bytes = buildLitBytes({
      sections: [
        { data: new TextEncoder().encode("a"), flags: 0 },
        { data: new TextEncoder().encode("b"), flags: 1 },
      ],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    expect(secs[0]!.flags).toBe(0);
    expect(secs[1]!.flags).toBe(1);
    expect(secs[1]!.isCompressed).toBe(true);
  });
});

// ===== extractSectionData =====

describe("lit-to-epub-converter extractSectionData", () => {
  it("extracts the correct bytes for a section", () => {
    const text = "Hello, World!";
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("T", "A") },
        { data: new TextEncoder().encode(text) },
      ],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    const data = extractSectionData(bytes, secs[1]!);
    expect(new TextDecoder().decode(data)).toBe(text);
  });
});

// ===== parseMetadata =====

describe("lit-to-epub-converter parseMetadata", () => {
  it("extracts title and author", () => {
    const meta = parseMetadata(makeMetadata("My Book", "Jane Doe"));
    expect(meta.title).toBe("My Book");
    expect(meta.author).toBe("Jane Doe");
  });
  it("extracts language", () => {
    const meta = parseMetadata(makeMetadata("T", "A", "fr"));
    expect(meta.language).toBe("fr");
  });
  it("returns empty strings for missing fields", () => {
    const meta = parseMetadata(new TextEncoder().encode("<metadata></metadata>"));
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
    expect(meta.language).toBe("");
  });
  it("returns defaults for empty input", () => {
    const meta = parseMetadata(new Uint8Array(0));
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
  });
});

// ===== decodeSectionText =====

describe("lit-to-epub-converter decodeSectionText", () => {
  it("decodes UTF-8 text", () => {
    const text = "Héllo, 世界";
    const data = new TextEncoder().encode(text);
    expect(decodeSectionText(data)).toBe(text);
  });
  it("decodes empty bytes as empty string", () => {
    expect(decodeSectionText(new Uint8Array(0))).toBe("");
  });
});

// ===== extractAllText =====

describe("lit-to-epub-converter extractAllText", () => {
  it("extracts text from all non-metadata, non-compressed sections", () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("T", "A") },
        { data: new TextEncoder().encode("Chapter 1 text") },
        { data: new TextEncoder().encode("Chapter 2 text") },
      ],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    const texts = extractAllText(bytes, secs);
    expect(texts.length).toBe(2);
    expect(texts[0]).toBe("Chapter 1 text");
    expect(texts[1]).toBe("Chapter 2 text");
  });
  it("skips compressed sections", () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("T", "A") },
        { data: new TextEncoder().encode("Good"), flags: 0 },
        { data: new TextEncoder().encode("Compressed"), flags: 1 },
      ],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    const texts = extractAllText(bytes, secs);
    expect(texts.length).toBe(1);
    expect(texts[0]).toBe("Good");
  });
  it("returns empty array for metadata-only files", () => {
    const bytes = buildLitBytes({
      sections: [{ data: makeMetadata("T", "A") }],
    });
    const h = parseLitHeader(bytes);
    const secs = parseSectionTable(bytes, h.sectionCount, 20);
    expect(extractAllText(bytes, secs).length).toBe(0);
  });
});

// ===== computeStats =====

describe("lit-to-epub-converter computeStats", () => {
  it("computes section counts and chapter word counts", () => {
    const sections: LitSection[] = [
      { index: 0, offset: 0, size: 10, flags: 0, isCompressed: false },
      { index: 1, offset: 10, size: 5, flags: 0, isCompressed: false },
      { index: 2, offset: 15, size: 5, flags: 1, isCompressed: true },
    ];
    const chapters = [
      { number: 1, title: "Ch 1", bodyHtml: "<p>a</p>", wordCount: 5, charCount: 10 },
      { number: 2, title: "Ch 2", bodyHtml: "<p>b</p>", wordCount: 3, charCount: 6 },
    ];
    const stats = computeStats(sections, chapters, 1024);
    expect(stats.sectionCount).toBe(3);
    expect(stats.textSectionCount).toBe(1);
    expect(stats.compressedSectionCount).toBe(1);
    expect(stats.chapterCount).toBe(2);
    expect(stats.wordCount).toBe(8);
    expect(stats.charCount).toBe(16);
    expect(stats.epubBytes).toBe(1024);
  });
});

// ===== generateEpub =====

describe("lit-to-epub-converter generateEpub", () => {
  it("produces a non-empty EPUB Blob from text", () => {
    const texts = ["# Chapter 1\nHello world.", "# Chapter 2\nGoodbye world."];
    const { blob, chapters, bookId } = generateEpub(texts, {
      title: "Test", author: "Author", language: "en", fontSize: 16, customCss: "",
    });
    expect(blob.size).toBeGreaterThan(100);
    expect(chapters.length).toBeGreaterThan(0);
    expect(bookId).toMatch(/^urn:uuid:/);
  });
});

// ===== convertLitToEpub =====

describe("lit-to-epub-converter convertLitToEpub", () => {
  it("converts a valid LIT file to EPUB", async () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("My LIT Book", "Test Author") },
        { data: new TextEncoder().encode("# Chapter 1\nHello world.") },
        { data: new TextEncoder().encode("# Chapter 2\nSecond chapter text.") },
      ],
    });
    const result = await convertLitToEpub(bytes, DEFAULT_OPTIONS, "my-book.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("my-book.epub");
      expect(result.output.stats.sectionCount).toBe(3);
      expect(result.output.stats.chapterCount).toBeGreaterThan(0);
      expect(result.output.stats.wordCount).toBeGreaterThan(0);
    }
  });
  it("uses LIT metadata when options are default", async () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("Embedded Title", "Embedded Author") },
        { data: new TextEncoder().encode("Some text content here.") },
      ],
    });
    const result = await convertLitToEpub(bytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Embedded Title");
      expect(result.output.metadata.author).toBe("Embedded Author");
    }
  });
  it("overrides metadata when custom options are set", async () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("Embedded", "Embedded") },
        { data: new TextEncoder().encode("Some text content here.") },
      ],
    });
    const opts: LitConvertOptions = { ...DEFAULT_OPTIONS, title: "Custom Title", author: "Custom Author" };
    const result = await convertLitToEpub(bytes, opts, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on bad signature", async () => {
    const bytes = buildLitBytes({ badSignature: true });
    const result = await convertLitToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/signature/i);
  });
  it("fails when no text sections are present", async () => {
    const bytes = buildLitBytes({
      sections: [{ data: makeMetadata("T", "A") }],
    });
    const result = await convertLitToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No text/);
  });
  it("fails when all sections are compressed", async () => {
    const bytes = buildLitBytes({
      sections: [
        { data: makeMetadata("T", "A") },
        { data: new TextEncoder().encode("Compressed"), flags: 1 },
      ],
    });
    const result = await convertLitToEpub(bytes);
    expect(result.ok).toBe(false);
  });
});

// ===== formatBytes =====

describe("lit-to-epub-converter formatBytes", () => {
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

describe("lit-to-epub-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.lit", litBytes: 100, epubBytes: 200,
      sectionCount: 3, chapterCount: 2, wordCount: 50,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.lit");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.lit`, litBytes: i, epubBytes: i * 2,
        sectionCount: 1, chapterCount: 1, wordCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.lit", litBytes: 1, epubBytes: 2,
      sectionCount: 1, chapterCount: 1, wordCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("lit-to-epub-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/lit-to-epub-converter" },
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
    expect(opts!.author).toBe("Auth");
    expect(opts!.fontSize).toBe(20);
    expect(opts!.language).toBe("fr");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#mode=heading&fs=999");
    expect(opts!.fontSize).toBe(36);
  });
});
