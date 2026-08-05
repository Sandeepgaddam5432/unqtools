import { describe, it, expect, beforeEach } from "vitest";
import {
  LRF_SIGNATURE, LRF_HEADER_MIN_SIZE,
  LRF_TYPE_META, LRF_TYPE_BOOK, LRF_TYPE_PAGE, LRF_TYPE_TEXT, LRF_TYPE_IMAGE,
  isLrfFile, parseLrfHeader, parseObjectTable, extractObjectData,
  parseMetadata, decodeObjectText, extractAllText, computeStats,
  generateEpub, convertLrfToEpub, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
  type LrfObject,
} from "./logic";

// ===== Helpers =====

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

interface BuildLrfOptions {
  version?: number;
  objects?: Array<{ type: number; data: Uint8Array }>;
  badSignature?: boolean;
  truncate?: number;
}

function buildLrfBytes(opts: BuildLrfOptions = {}): Uint8Array {
  const version = opts.version ?? 800;
  const objects = opts.objects ?? [];
  const objectCount = objects.length;
  const headerSize = LRF_HEADER_MIN_SIZE + objectCount * 16;

  let dataStart = headerSize;
  const objMeta: Array<{ type: number; offset: number; size: number; id: number; data: Uint8Array }> = [];
  for (let i = 0; i < objects.length; i++) {
    objMeta.push({
      type: objects[i]!.type,
      offset: dataStart,
      size: objects[i]!.data.length,
      id: i + 1,
      data: objects[i]!.data,
    });
    dataStart += objects[i]!.data.length;
  }

  const header: number[] = [];
  if (opts.badSignature) {
    header.push(...writeString("XXX\0\0\0\0\0"));
  } else {
    header.push(...writeString("LRF\0\0\0\0\0"));
  }
  header.push(...writeU32LE(version));
  header.push(...writeU32LE(objectCount));
  header.push(...writeU32LE(0)); // metadataOffset (unused in our parser)
  for (const m of objMeta) {
    header.push(...writeU32LE(m.type));
    header.push(...writeU32LE(m.offset));
    header.push(...writeU32LE(m.size));
    header.push(...writeU32LE(m.id));
  }

  const total = header.length + objMeta.reduce((s, m) => s + m.data.length, 0);
  const truncate = opts.truncate ?? total;
  const out = new Uint8Array(Math.min(total, truncate));
  out.set(new Uint8Array(header), 0);
  let pos = header.length;
  for (const m of objMeta) {
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

// ===== isLrfFile =====

describe("lrf-to-epub-converter isLrfFile", () => {
  it("returns true for a valid LRF signature", () => {
    const bytes = buildLrfBytes({ objects: [] });
    expect(isLrfFile(bytes)).toBe(true);
  });
  it("returns false for a corrupted signature", () => {
    const bytes = buildLrfBytes({ objects: [], badSignature: true });
    expect(isLrfFile(bytes)).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isLrfFile(new Uint8Array(10))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isLrfFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== parseLrfHeader =====

describe("lrf-to-epub-converter parseLrfHeader", () => {
  it("parses signature, version, object count", () => {
    const bytes = buildLrfBytes({ version: 800, objects: [] });
    const h = parseLrfHeader(bytes);
    expect(h.signature).toBe(LRF_SIGNATURE);
    expect(h.version).toBe(800);
    expect(h.objectCount).toBe(0);
  });
  it("throws on too-small input", () => {
    expect(() => parseLrfHeader(new Uint8Array(5))).toThrow(/too small/);
  });
  it("throws on bad signature", () => {
    const bytes = buildLrfBytes({ badSignature: true });
    expect(() => parseLrfHeader(bytes)).toThrow(/Not a valid LRF file/);
  });
  it("parses higher version numbers", () => {
    const bytes = buildLrfBytes({ version: 1000 });
    expect(parseLrfHeader(bytes).version).toBe(1000);
  });
});

// ===== parseObjectTable =====

describe("lrf-to-epub-converter parseObjectTable", () => {
  it("parses an empty object table", () => {
    const bytes = buildLrfBytes({ objects: [] });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    expect(objs.length).toBe(0);
  });
  it("parses multiple objects with correct offsets, sizes, and types", () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Text A") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Text B") },
        { type: LRF_TYPE_IMAGE, data: new Uint8Array([1, 2, 3, 4]) },
      ],
    });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    expect(objs.length).toBe(4);
    expect(objs[0]!.type).toBe("META");
    expect(objs[1]!.type).toBe("TEXT");
    expect(objs[2]!.type).toBe("TEXT");
    expect(objs[3]!.type).toBe("IMAGE");
    expect(objs[0]!.size).toBe(makeMetadata("T", "A").length);
    expect(objs[1]!.offset).toBe(objs[0]!.offset + objs[0]!.size);
    expect(objs[1]!.id).toBe(2);
  });
  it("reports unknown types as UNKNOWN", () => {
    const bytes = buildLrfBytes({
      objects: [{ type: 99, data: new Uint8Array([1]) }],
    });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    expect(objs[0]!.type).toBe("UNKNOWN");
    expect(objs[0]!.typeCode).toBe(99);
  });
});

// ===== extractObjectData =====

describe("lrf-to-epub-converter extractObjectData", () => {
  it("extracts the correct bytes for an object", () => {
    const text = "Hello, World!";
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode(text) },
      ],
    });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    const data = extractObjectData(bytes, objs[1]!);
    expect(new TextDecoder().decode(data)).toBe(text);
  });
});

// ===== parseMetadata =====

describe("lrf-to-epub-converter parseMetadata", () => {
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
  it("returns empty strings for empty input", () => {
    const meta = parseMetadata(new Uint8Array(0));
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
  });
});

// ===== decodeObjectText =====

describe("lrf-to-epub-converter decodeObjectText", () => {
  it("decodes UTF-8 text", () => {
    const text = "Héllo, 世界";
    const data = new TextEncoder().encode(text);
    expect(decodeObjectText(data)).toBe(text);
  });
  it("decodes empty bytes as empty string", () => {
    expect(decodeObjectText(new Uint8Array(0))).toBe("");
  });
});

// ===== extractAllText =====

describe("lrf-to-epub-converter extractAllText", () => {
  it("extracts text from all TEXT objects in order", () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Chapter 1 text") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Chapter 2 text") },
        { type: LRF_TYPE_IMAGE, data: new Uint8Array([1, 2, 3]) },
      ],
    });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    const texts = extractAllText(bytes, objs);
    expect(texts.length).toBe(2);
    expect(texts[0]).toBe("Chapter 1 text");
    expect(texts[1]).toBe("Chapter 2 text");
  });
  it("skips non-TEXT objects", () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_PAGE, data: new Uint8Array([0]) },
        { type: LRF_TYPE_IMAGE, data: new Uint8Array([1, 2]) },
      ],
    });
    const h = parseLrfHeader(bytes);
    const objs = parseObjectTable(bytes, h.objectCount, 20);
    expect(extractAllText(bytes, objs).length).toBe(0);
  });
});

// ===== computeStats =====

describe("lrf-to-epub-converter computeStats", () => {
  it("computes object counts and chapter word counts", () => {
    const objects: LrfObject[] = [
      { index: 0, type: "META", typeCode: LRF_TYPE_META, offset: 0, size: 10, id: 1 },
      { index: 1, type: "TEXT", typeCode: LRF_TYPE_TEXT, offset: 10, size: 5, id: 2 },
      { index: 2, type: "IMAGE", typeCode: LRF_TYPE_IMAGE, offset: 15, size: 5, id: 3 },
      { index: 3, type: "PAGE", typeCode: LRF_TYPE_PAGE, offset: 20, size: 5, id: 4 },
    ];
    const chapters = [
      { number: 1, title: "Ch 1", bodyHtml: "<p>a</p>", wordCount: 5, charCount: 10 },
      { number: 2, title: "Ch 2", bodyHtml: "<p>b</p>", wordCount: 3, charCount: 6 },
    ];
    const stats = computeStats(objects, chapters, 2048);
    expect(stats.objectCount).toBe(4);
    expect(stats.textObjectCount).toBe(1);
    expect(stats.imageObjectCount).toBe(1);
    expect(stats.pageObjectCount).toBe(1);
    expect(stats.chapterCount).toBe(2);
    expect(stats.wordCount).toBe(8);
    expect(stats.charCount).toBe(16);
    expect(stats.epubBytes).toBe(2048);
  });
});

// ===== generateEpub =====

describe("lrf-to-epub-converter generateEpub", () => {
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

// ===== convertLrfToEpub =====

describe("lrf-to-epub-converter convertLrfToEpub", () => {
  it("converts a valid LRF file to EPUB", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("My LRF Book", "Test Author") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("# Chapter 1\nHello world.") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("# Chapter 2\nSecond chapter text.") },
      ],
    });
    const result = await convertLrfToEpub(bytes, DEFAULT_OPTIONS, "my-book.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("my-book.epub");
      expect(result.output.stats.objectCount).toBe(3);
      expect(result.output.stats.textObjectCount).toBe(2);
      expect(result.output.stats.chapterCount).toBeGreaterThan(0);
      expect(result.output.stats.wordCount).toBeGreaterThan(0);
    }
  });
  it("uses LRF metadata when options are default", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("Embedded Title", "Embedded Author") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Some text content here.") },
      ],
    });
    const result = await convertLrfToEpub(bytes, DEFAULT_OPTIONS, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Embedded Title");
      expect(result.output.metadata.author).toBe("Embedded Author");
    }
  });
  it("overrides metadata when custom options are set", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("Embedded", "Embedded") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Some text content here.") },
      ],
    });
    const opts = { ...DEFAULT_OPTIONS, title: "Custom Title", author: "Custom Author" };
    const result = await convertLrfToEpub(bytes, opts, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on bad signature", async () => {
    const bytes = buildLrfBytes({ badSignature: true });
    const result = await convertLrfToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/signature/i);
  });
  it("fails when no TEXT objects are present", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_IMAGE, data: new Uint8Array([1, 2, 3]) },
      ],
    });
    const result = await convertLrfToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No text/);
  });
  it("fails when object table is empty", async () => {
    const bytes = buildLrfBytes({ objects: [] });
    const result = await convertLrfToEpub(bytes);
    expect(result.ok).toBe(false);
  });
});

// ===== formatBytes =====

describe("lrf-to-epub-converter formatBytes", () => {
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

describe("lrf-to-epub-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.lrf", lrfBytes: 100, epubBytes: 200,
      objectCount: 3, chapterCount: 2, wordCount: 50,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.lrf");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.lrf`, lrfBytes: i, epubBytes: i * 2,
        objectCount: 1, chapterCount: 1, wordCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.lrf", lrfBytes: 1, epubBytes: 2,
      objectCount: 1, chapterCount: 1, wordCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("lrf-to-epub-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/lrf-to-epub-converter" },
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
