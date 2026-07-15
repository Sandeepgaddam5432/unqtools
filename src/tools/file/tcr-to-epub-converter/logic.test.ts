import { describe, it, expect, beforeEach } from "vitest";
import {
  TCR_MAGIC, TCR_HEADER_SIZE, TCR_DICT_ENTRY_COUNT,
  isTcrFile, parseDictionary, buildIdentityDictionary, decompressStream,
  parseTcr, computeStats, generateEpub, convertTcrToEpub,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
} from "./logic";

// ===== Helpers =====

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

/**
 * Build a TCR file with a custom dictionary and compressed text.
 * The dictionary is built from the unique bytes in the text (identity for
 * simple cases). Each entry is length-prefixed.
 */
function buildTcrBytes(opts: {
  text?: string;
  dictionary?: ReturnType<typeof buildIdentityDictionary>;
  badMagic?: boolean;
  truncate?: number;
}): Uint8Array {
  const text = opts.text ?? "Hello, World!";
  const dictionary = opts.dictionary ?? buildIdentityDictionary();
  const textBytes = new TextEncoder().encode(text);

  // Compress: each text byte indexes into the dictionary. With identity
  // dictionary, the compressed stream is just the text bytes.
  const compressed: number[] = [];
  for (const b of textBytes) {
    // Find the dictionary entry whose bytes match
    let foundIdx = -1;
    for (let i = 0; i < dictionary.entries.length; i++) {
      const entry = dictionary.entries[i]!;
      if (entry.length === 1 && entry[0] === b) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) {
      throw new Error(`Byte ${b} not found in dictionary.`);
    }
    compressed.push(foundIdx);
  }

  // Header (8 bytes) + dictionary (256 entries, each 1-byte length + data) + compressed stream
  const header: number[] = [];
  if (opts.badMagic) {
    header.push(...writeString("XXX\0\0\0\0\0"));
  } else {
    header.push(...writeString("PCF\0\0\0\0\0"));
  }
  for (const entry of dictionary.entries) {
    header.push(entry.length);
    for (const b of entry) header.push(b);
  }
  header.push(...compressed);

  const total = header.length;
  const truncate = opts.truncate ?? total;
  return new Uint8Array(header.slice(0, Math.min(total, truncate)));
}

/** Build a TCR dictionary where two text bytes map to one dictionary entry (2-byte entries). */
function buildDoubleByteDictionary(): { dictionary: ReturnType<typeof buildIdentityDictionary>; pair: [number, number] } {
  const dict = buildIdentityDictionary();
  // Replace entry 0 with a 2-byte entry: [0x48, 0x65] = "He"
  dict.entries[0] = new Uint8Array([0x48, 0x65]);
  return { dictionary: dict, pair: [0x48, 0x65] };
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

// ===== isTcrFile =====

describe("tcr-to-epub-converter isTcrFile", () => {
  it("returns true for a valid TCR magic", () => {
    const bytes = buildTcrBytes({ text: "Hello" });
    expect(isTcrFile(bytes)).toBe(true);
  });
  it("returns false for a corrupted magic", () => {
    const bytes = buildTcrBytes({ text: "Hello", badMagic: true });
    expect(isTcrFile(bytes)).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isTcrFile(new Uint8Array(5))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isTcrFile(new Uint8Array(0))).toBe(false);
  });
});

// ===== buildIdentityDictionary =====

describe("tcr-to-epub-converter buildIdentityDictionary", () => {
  it("builds a 256-entry dictionary where each entry is 1 byte", () => {
    const dict = buildIdentityDictionary();
    expect(dict.entries.length).toBe(TCR_DICT_ENTRY_COUNT);
    expect(dict.entries[0]!.length).toBe(1);
    expect(dict.entries[0]![0]).toBe(0);
    expect(dict.entries[255]![0]).toBe(255);
  });
});

// ===== parseDictionary =====

describe("tcr-to-epub-converter parseDictionary", () => {
  it("parses an identity dictionary correctly", () => {
    const bytes = buildTcrBytes({ text: "Hello" });
    const { dictionary, streamOffset } = parseDictionary(bytes, TCR_HEADER_SIZE);
    expect(dictionary.entries.length).toBe(256);
    expect(dictionary.entries[0]!.length).toBe(1);
    expect(dictionary.entries[0]![0]).toBe(0);
    expect(dictionary.entries[255]![0]).toBe(255);
    // Stream offset should be 8 (header) + 256 (lengths) + 256 (1-byte entries) = 520
    expect(streamOffset).toBe(8 + 256 + 256);
  });
  it("parses a dictionary with 2-byte entries", () => {
    const { dictionary: dict } = buildDoubleByteDictionary();
    const bytes = buildTcrBytes({ text: "He", dictionary: dict });
    const { dictionary, streamOffset } = parseDictionary(bytes, TCR_HEADER_SIZE);
    expect(dictionary.entries[0]!.length).toBe(2);
    expect(dictionary.entries[0]![0]).toBe(0x48);
    expect(dictionary.entries[0]![1]).toBe(0x65);
    // streamOffset: 8 + 256 (lengths) + 255 (1-byte entries) + 2 (1 two-byte entry) = 521
    expect(streamOffset).toBe(8 + 256 + 255 + 2);
  });
  it("throws on truncated dictionary", () => {
    const bytes = buildTcrBytes({ text: "Hello" });
    const truncated = bytes.subarray(0, 100);
    expect(() => parseDictionary(truncated, TCR_HEADER_SIZE)).toThrow(/truncated/);
  });
});

// ===== decompressStream =====

describe("tcr-to-epub-converter decompressStream", () => {
  it("decompresses identity-encoded text", () => {
    const text = "Hello, World!";
    const dict = buildIdentityDictionary();
    const compressed = new Uint8Array(Array.from(new TextEncoder().encode(text)));
    const decompressed = decompressStream(compressed, dict);
    expect(new TextDecoder().decode(decompressed)).toBe(text);
  });
  it("decompresses using a 2-byte dictionary entry", () => {
    const { dictionary, pair } = buildDoubleByteDictionary();
    // Build a compressed stream that uses entry 0 (which decodes to "He")
    const compressed = new Uint8Array([0, 0, 0]); // 3x "He" = "HeHeHe"
    const decompressed = decompressStream(compressed, dictionary);
    const result = new TextDecoder().decode(decompressed);
    expect(result).toBe("HeHeHe");
    void pair;
  });
  it("throws on invalid byte (no dictionary entry)", () => {
    const dict = buildIdentityDictionary();
    // Remove an entry
    dict.entries[100] = undefined as unknown as Uint8Array;
    expect(() => decompressStream(new Uint8Array([100]), dict)).toThrow(/Invalid byte/);
  });
});

// ===== parseTcr =====

describe("tcr-to-epub-converter parseTcr", () => {
  it("parses a valid TCR file", () => {
    const text = "# Chapter 1\nHello, World!";
    const bytes = buildTcrBytes({ text });
    const book = parseTcr(bytes);
    expect(book.text).toBe(text);
    expect(book.decompressedBytes.length).toBeGreaterThan(0);
    expect(book.compressedBytes.length).toBeGreaterThan(0);
  });
  it("throws on bad magic", () => {
    const bytes = buildTcrBytes({ text: "Hi", badMagic: true });
    expect(() => parseTcr(bytes)).toThrow(/Not a valid TCR file/);
  });
  it("decodes UTF-8 text correctly", () => {
    const text = "Héllo, 世界";
    const bytes = buildTcrBytes({ text });
    const book = parseTcr(bytes);
    expect(book.text).toBe(text);
  });
});

// ===== computeStats =====

describe("tcr-to-epub-converter computeStats", () => {
  it("computes compression ratio and chapter stats", () => {
    const chapters = [
      { number: 1, title: "Ch 1", bodyHtml: "<p>a</p>", wordCount: 5, charCount: 10 },
      { number: 2, title: "Ch 2", bodyHtml: "<p>b</p>", wordCount: 3, charCount: 6 },
    ];
    const stats = computeStats(50, 100, chapters, 2048);
    expect(stats.compressedBytes).toBe(50);
    expect(stats.decompressedBytes).toBe(100);
    expect(stats.compressionRatio).toBe(0.5);
    expect(stats.chapterCount).toBe(2);
    expect(stats.wordCount).toBe(8);
    expect(stats.charCount).toBe(16);
    expect(stats.epubBytes).toBe(2048);
  });
  it("returns 0 ratio for empty decompressed bytes", () => {
    const stats = computeStats(50, 0, [], 0);
    expect(stats.compressionRatio).toBe(0);
  });
});

// ===== generateEpub =====

describe("tcr-to-epub-converter generateEpub", () => {
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

// ===== convertTcrToEpub =====

describe("tcr-to-epub-converter convertTcrToEpub", () => {
  it("converts a valid TCR file to EPUB", async () => {
    const text = "# Chapter 1\nHello, World!\n# Chapter 2\nGoodbye.";
    const bytes = buildTcrBytes({ text });
    const result = await convertTcrToEpub(bytes, DEFAULT_OPTIONS, "my-book.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("my-book.epub");
      expect(result.output.stats.chapterCount).toBeGreaterThan(0);
      expect(result.output.stats.wordCount).toBeGreaterThan(0);
      expect(result.output.stats.compressionRatio).toBeGreaterThan(0);
      expect(result.output.stats.compressionRatio).toBeLessThanOrEqual(1);
    }
  });
  it("uses custom title and author from options", async () => {
    const bytes = buildTcrBytes({ text: "Some text content." });
    const opts = { ...DEFAULT_OPTIONS, title: "Custom Title", author: "Custom Author" };
    const result = await convertTcrToEpub(bytes, opts, "out.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on bad magic", async () => {
    const bytes = buildTcrBytes({ text: "Hi", badMagic: true });
    const result = await convertTcrToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/magic/i);
  });
  it("fails on empty text content", async () => {
    const bytes = buildTcrBytes({ text: "" });
    const result = await convertTcrToEpub(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No text/);
  });
});

// ===== formatBytes / formatRatio =====

describe("tcr-to-epub-converter formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("tcr-to-epub-converter formatRatio", () => {
  it("formats 0.5 as 50.0%", () => {
    expect(formatRatio(0.5)).toBe("50.0%");
  });
  it("formats 1.0 as 100.0%", () => {
    expect(formatRatio(1.0)).toBe("100.0%");
  });
});

// ===== History =====

describe("tcr-to-epub-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.tcr", tcrBytes: 100, epubBytes: 200,
      chapterCount: 2, wordCount: 50, compressionRatio: 0.5,
      convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.tcr");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.tcr`, tcrBytes: i, epubBytes: i * 2,
        chapterCount: 1, wordCount: 1, compressionRatio: 0.5,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.tcr", tcrBytes: 1, epubBytes: 2,
      chapterCount: 1, wordCount: 1, compressionRatio: 0.5,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("tcr-to-epub-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/tcr-to-epub-converter" },
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
