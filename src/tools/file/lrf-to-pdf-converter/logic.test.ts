import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  isHeading,
  splitIntoChapters,
  countWords,
  renderChaptersToPdf,
  convertLrfToPdf,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LrfConvertOptions,
} from "./logic";
import {
  LRF_SIGNATURE,
  LRF_HEADER_MIN_SIZE,
  LRF_TYPE_TEXT,
  LRF_TYPE_META,
} from "../lrf-to-epub-converter/logic";

// ===== LRF byte helpers =====

function writeU32LE(value: number): number[] {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function writeString(s: string, length: number): number[] {
  const bytes = new Array(length).fill(0);
  for (let i = 0; i < s.length && i < length; i++) {
    bytes[i] = s.charCodeAt(i);
  }
  return bytes;
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
  const objMeta: Array<{ offset: number; size: number; type: number; data: Uint8Array }> = [];
  for (const obj of objects) {
    objMeta.push({
      offset: dataStart,
      size: obj.data.length,
      type: obj.type,
      data: obj.data,
    });
    dataStart += obj.data.length;
  }
  const header: number[] = [];
  if (opts.badSignature) {
    header.push(...writeString("XXX", 8));
  } else {
    header.push(...writeString(LRF_SIGNATURE, 8)); // LRF + 5 zeros (writeString pads)
  }
  header.push(...writeU32LE(version));
  header.push(...writeU32LE(objectCount));
  header.push(...writeU32LE(0)); // metadata offset (we don't use this for tests)
  for (const m of objMeta) {
    header.push(...writeU32LE(m.type));
    header.push(...writeU32LE(m.offset));
    header.push(...writeU32LE(m.size));
    header.push(...writeU32LE(0)); // id
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

// ===== isHeading =====

describe("lrf-to-pdf-converter isHeading", () => {
  it("detects markdown headings", () => {
    expect(isHeading("# Chapter 1")).toBe(true);
    expect(isHeading("## Section 2")).toBe(true);
  });
  it("detects 'Chapter N' headings", () => {
    expect(isHeading("Chapter 1")).toBe(true);
    expect(isHeading("Chapter 12")).toBe(true);
  });
  it("detects 'Part N' headings", () => {
    expect(isHeading("Part 1")).toBe(true);
  });
  it("detects ALL-CAPS headings (5+ chars)", () => {
    expect(isHeading("INTRODUCTION")).toBe(true);
    expect(isHeading("THE END")).toBe(true);
  });
  it("returns false for body text", () => {
    expect(isHeading("Hello world")).toBe(false);
    expect(isHeading("a")).toBe(false);
  });
  it("returns false for empty lines", () => {
    expect(isHeading("")).toBe(false);
    expect(isHeading("   ")).toBe(false);
  });
  it("returns false for too-long headings", () => {
    expect(isHeading("A".repeat(101))).toBe(false);
  });
});

// ===== splitIntoChapters =====

describe("lrf-to-pdf-converter splitIntoChapters", () => {
  it("splits text by markdown headings", () => {
    const text = "# Chapter 1\nHello world.\n# Chapter 2\nGoodbye world.";
    const chapters = splitIntoChapters(text);
    expect(chapters.length).toBe(2);
    expect(chapters[0]!.title).toBe("Chapter 1");
    expect(chapters[1]!.title).toBe("Chapter 2");
  });
  it("splits by 'Chapter N' headings", () => {
    const text = "Chapter 1\nBody text.\nChapter 2\nMore text.";
    const chapters = splitIntoChapters(text);
    expect(chapters.length).toBe(2);
  });
  it("returns single chapter when no headings", () => {
    const text = "Just some body text without any headings.";
    const chapters = splitIntoChapters(text);
    expect(chapters.length).toBe(1);
    expect(chapters[0]!.title).toBe("Full Text");
  });
  it("creates 'Introduction' chapter for leading text", () => {
    const text = "Some intro text.\n# Chapter 1\nBody.";
    const chapters = splitIntoChapters(text);
    expect(chapters.length).toBe(2);
    expect(chapters[0]!.title).toBe("Introduction");
    expect(chapters[1]!.title).toBe("Chapter 1");
  });
  it("handles empty input", () => {
    const chapters = splitIntoChapters("");
    expect(chapters.length).toBe(1);
  });
});

// ===== countWords =====

describe("lrf-to-pdf-converter countWords", () => {
  it("counts words", () => {
    expect(countWords("Hello world")).toBe(2);
  });
  it("counts 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("counts words with newlines", () => {
    expect(countWords("Hello\nworld\nfoo")).toBe(3);
  });
});

// ===== renderChaptersToPdf =====

describe("lrf-to-pdf-converter renderChaptersToPdf", () => {
  it("renders chapters to a non-empty PDF", async () => {
    const chapters = [
      { title: "Chapter 1", body: "Hello world." },
      { title: "Chapter 2", body: "Goodbye world." },
    ];
    const { bytes, pageCount } = await renderChaptersToPdf(chapters, DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(100);
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });
  it("handles empty chapters array", async () => {
    const { bytes, pageCount } = await renderChaptersToPdf([], DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(0);
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });
  it("handles a long chapter that spans multiple pages", async () => {
    const longText = "word ".repeat(500);
    const chapters = [{ title: "Long Chapter", body: longText }];
    const { bytes } = await renderChaptersToPdf(chapters, DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

// ===== convertLrfToPdf =====

describe("lrf-to-pdf-converter convertLrfToPdf", () => {
  it("converts a valid LRF file to PDF", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("My LRF Book", "Test Author") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("# Chapter 1\nHello world.") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("# Chapter 2\nSecond chapter text.") },
      ],
    });
    const result = await convertLrfToPdf(bytes, DEFAULT_OPTIONS, "my-book.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("my-book.pdf");
      expect(result.output.stats.objectCount).toBe(3);
      expect(result.output.stats.chapterCount).toBeGreaterThan(0);
      expect(result.output.stats.wordCount).toBeGreaterThan(0);
      expect(result.output.stats.pageCount).toBeGreaterThanOrEqual(1);
    }
  });
  it("uses LRF metadata when options are default", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("Embedded Title", "Embedded Author") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Some text content here.") },
      ],
    });
    const result = await convertLrfToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
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
    const opts: LrfConvertOptions = { ...DEFAULT_OPTIONS, title: "Custom Title", author: "Custom Author" };
    const result = await convertLrfToPdf(bytes, opts, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on bad signature", async () => {
    const bytes = buildLrfBytes({ badSignature: true });
    const result = await convertLrfToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/signature/i);
  });
  it("fails when no text objects are present", async () => {
    const bytes = buildLrfBytes({
      objects: [{ type: LRF_TYPE_META, data: makeMetadata("T", "A") }],
    });
    const result = await convertLrfToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No text objects/);
  });
  it("includes preview text from first chapter", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_META, data: makeMetadata("T", "A") },
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("# Chapter 1\nHello preview text.") },
      ],
    });
    const result = await convertLrfToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.previewText).toContain("preview text");
    }
  });
  it("supports custom page size and orientation", async () => {
    const bytes = buildLrfBytes({
      objects: [
        { type: LRF_TYPE_TEXT, data: new TextEncoder().encode("Hello world.") },
      ],
    });
    const opts: LrfConvertOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: "a4",
      orientation: "landscape",
    };
    const result = await convertLrfToPdf(bytes, opts, "out.pdf");
    expect(result.ok).toBe(true);
  });
});

// ===== formatBytes =====

describe("lrf-to-pdf-converter formatBytes", () => {
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

describe("lrf-to-pdf-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.lrf",
      lrfBytes: 100,
      pdfBytes: 200,
      objectCount: 3,
      chapterCount: 2,
      wordCount: 50,
      pageCount: 2,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.lrf");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.lrf`,
        lrfBytes: i,
        pdfBytes: i * 2,
        objectCount: 1,
        chapterCount: 1,
        wordCount: 1,
        pageCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.lrf",
      lrfBytes: 1,
      pdfBytes: 2,
      objectCount: 1,
      chapterCount: 1,
      wordCount: 1,
      pageCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("lrf-to-pdf-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/lrf-to-pdf-converter" },
    };
    const opts: LrfConvertOptions = {
      ...DEFAULT_OPTIONS,
      title: "My Book",
      author: "Auth",
      fontSize: 18,
      margin: 40,
      pageSize: "a4",
      orientation: "landscape",
      language: "fr",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("size=a4");
    expect(url).toContain("orient=landscape");
    expect(url).toContain("fs=18");
    expect(url).toContain("margin=40");
    expect(url).toContain("t=My+Book");
    expect(url).toContain("a=Auth");
    expect(url).toContain("lang=fr");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#size=a4&orient=landscape&fs=18&margin=40&t=Test&a=Auth&lang=fr";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.pageSize).toBe("a4");
    expect(opts!.orientation).toBe("landscape");
    expect(opts!.fontSize).toBe(18);
    expect(opts!.margin).toBe(40);
    expect(opts!.title).toBe("Test");
    expect(opts!.author).toBe("Auth");
    expect(opts!.language).toBe("fr");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#fs=999");
    expect(opts!.fontSize).toBe(24);
  });
});

// ===== DEFAULT_OPTIONS =====

describe("lrf-to-pdf-converter DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.pageSize).toBe("letter");
    expect(DEFAULT_OPTIONS.orientation).toBe("portrait");
    expect(DEFAULT_OPTIONS.fontSize).toBe(12);
    expect(DEFAULT_OPTIONS.margin).toBe(50);
  });
});
