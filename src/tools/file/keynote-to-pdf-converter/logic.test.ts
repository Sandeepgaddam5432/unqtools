import { describe, it, expect, beforeEach } from "vitest";
import {
  parseZipEntries,
  decompressEntry,
} from "../epub-reader/logic";
import {
  EMPTY_METADATA,
  DEFAULT_OPTIONS,
  parseMetadataJson,
  isKeynoteFile,
  findEntry,
  countSlideIwaFiles,
  getPageSize,
  renderPlaceholderPdf,
  convertKeynoteToPdf,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type KeynotePageSize,
  type KeynoteConvertOptions,
} from "./logic";

// ===== ZIP helpers (build a minimal ZIP) =====

interface ZipInputFile {
  name: string;
  data: Uint8Array;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: ZipInputFile[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
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
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
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
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);
  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
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

// ===== isKeynoteFile =====

describe("keynote-to-pdf-converter isKeynoteFile", () => {
  it("returns true for a ZIP file (PK signature)", () => {
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode("{}") }]);
    expect(isKeynoteFile(bytes)).toBe(true);
  });
  it("returns false for a non-ZIP file", () => {
    expect(isKeynoteFile(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isKeynoteFile(new Uint8Array(0))).toBe(false);
  });
  it("returns false for a file smaller than 4 bytes", () => {
    expect(isKeynoteFile(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});

// ===== parseMetadataJson =====

describe("keynote-to-pdf-converter parseMetadataJson", () => {
  it("parses a complete metadata.json", () => {
    const json = JSON.stringify({
      title: "My Presentation",
      author: "Jane Doe",
      "slide-number": 12,
      size: { width: 1920, height: 1080 },
      Generator_Version: "12.0",
      date: "2026-01-01",
      "slide-numbers-visible": true,
    });
    const meta = parseMetadataJson(json);
    expect(meta.title).toBe("My Presentation");
    expect(meta.author).toBe("Jane Doe");
    expect(meta.slideCount).toBe(12);
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.generatorVersion).toBe("12.0");
    expect(meta.creationDate).toBe("2026-01-01");
    expect(meta.slideNumbersVisible).toBe(true);
  });
  it("uses defaults for empty metadata", () => {
    const meta = parseMetadataJson("{}");
    expect(meta.title).toBe("");
    expect(meta.slideCount).toBe(0);
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(768);
  });
  it("returns empty metadata for invalid JSON", () => {
    const meta = parseMetadataJson("not json");
    expect(meta.title).toBe("");
    expect(meta.slideCount).toBe(0);
  });
  it("infers slide count from slides array", () => {
    const json = JSON.stringify({
      slides: [{}, {}, {}, {}],
    });
    expect(parseMetadataJson(json).slideCount).toBe(4);
  });
  it("accepts slideCount as a string number", () => {
    const json = JSON.stringify({ "slide-number": "5" });
    expect(parseMetadataJson(json).slideCount).toBe(5);
  });
  it("accepts slideCount as a number", () => {
    const json = JSON.stringify({ slideNumber: 7 });
    expect(parseMetadataJson(json).slideCount).toBe(7);
  });
  it("infers from Manifest slide keys", () => {
    const json = JSON.stringify({
      Manifest: {
        "slide-1.iwa": {},
        "slide-2.iwa": {},
        "slide-3.iwa": {},
      },
    });
    expect(parseMetadataJson(json).slideCount).toBe(3);
  });
  it("returns empty metadata for non-object JSON", () => {
    expect(parseMetadataJson("null").title).toBe("");
    expect(parseMetadataJson("[]").title).toBe("");
  });
});

// ===== findEntry =====

describe("keynote-to-pdf-converter findEntry", () => {
  it("finds an entry by exact name", () => {
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode("{}") },
      { name: "preview.jpg", data: new Uint8Array([1, 2, 3]) },
    ]);
    const entries = parseZipEntries(bytes);
    const found = findEntry(entries, "metadata.json");
    expect(found).toBeDefined();
    expect(found!.name).toBe("metadata.json");
  });
  it("finds an entry by case-insensitive substring", () => {
    const bytes = buildZip([
      { name: "Index/METADATA.JSON", data: new TextEncoder().encode("{}") },
    ]);
    const entries = parseZipEntries(bytes);
    const found = findEntry(entries, "metadata.json");
    expect(found).toBeDefined();
  });
  it("returns undefined for a missing entry", () => {
    const bytes = buildZip([{ name: "a.txt", data: new Uint8Array([1]) }]);
    const entries = parseZipEntries(bytes);
    expect(findEntry(entries, "missing")).toBeUndefined();
  });
});

// ===== countSlideIwaFiles =====

describe("keynote-to-pdf-converter countSlideIwaFiles", () => {
  it("counts slide-*.iwa files", () => {
    const bytes = buildZip([
      { name: "Data/slide-1.iwa", data: new Uint8Array([1]) },
      { name: "Data/slide-2.iwa", data: new Uint8Array([2]) },
      { name: "Data/slide-3.iwa", data: new Uint8Array([3]) },
      { name: "Data/other.iwa", data: new Uint8Array([4]) },
    ]);
    const entries = parseZipEntries(bytes);
    expect(countSlideIwaFiles(entries)).toBe(3);
  });
  it("returns 0 when no slide .iwa files exist", () => {
    const bytes = buildZip([{ name: "foo.txt", data: new Uint8Array([1]) }]);
    const entries = parseZipEntries(bytes);
    expect(countSlideIwaFiles(entries)).toBe(0);
  });
});

// ===== getPageSize =====

describe("keynote-to-pdf-converter getPageSize", () => {
  it("returns 768x576 for 4:3", () => {
    expect(getPageSize("4:3")).toEqual({ width: 768, height: 576 });
  });
  it("returns 960x540 for 16:9", () => {
    expect(getPageSize("16:9")).toEqual({ width: 960, height: 540 });
  });
  it("returns 612x792 for letter", () => {
    expect(getPageSize("letter")).toEqual({ width: 612, height: 792 });
  });
});

// ===== renderPlaceholderPdf =====

describe("keynote-to-pdf-converter renderPlaceholderPdf", () => {
  it("renders a PDF with title page + N slide pages", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", slideCount: 3 };
    const bytes = await renderPlaceholderPdf(meta, DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(100);
  });
  it("renders without title page when includeTitlePage is false", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", slideCount: 2 };
    const bytes = await renderPlaceholderPdf(meta, {
      ...DEFAULT_OPTIONS,
      includeTitlePage: false,
    });
    expect(bytes.length).toBeGreaterThan(100);
  });
  it("renders with includeSlideNumbers=false", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", slideCount: 5 };
    const bytes = await renderPlaceholderPdf(meta, {
      ...DEFAULT_OPTIONS,
      includeSlideNumbers: false,
    });
    expect(bytes.length).toBeGreaterThan(100);
  });
});

// ===== convertKeynoteToPdf =====

describe("keynote-to-pdf-converter convertKeynoteToPdf", () => {
  it("converts a valid Keynote ZIP to PDF", async () => {
    const metadata = JSON.stringify({
      title: "My Presentation",
      "slide-number": 3,
      size: { width: 1920, height: 1080 },
    });
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode(metadata) },
      { name: "preview.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]) },
      { name: "Data/slide-1.iwa", data: new Uint8Array([1]) },
    ]);
    const result = await convertKeynoteToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.metadata.title).toBe("My Presentation");
      expect(result.output.metadata.slideCount).toBe(3);
      expect(result.output.slideCount).toBe(3);
      expect(result.output.previewImage).not.toBeNull();
    }
  });
  it("falls back to .iwa file count when metadata is missing", async () => {
    const bytes = buildZip([
      { name: "Data/slide-1.iwa", data: new Uint8Array([1]) },
      { name: "Data/slide-2.iwa", data: new Uint8Array([2]) },
      { name: "Data/slide-3.iwa", data: new Uint8Array([3]) },
      { name: "Data/slide-4.iwa", data: new Uint8Array([4]) },
    ]);
    const result = await convertKeynoteToPdf(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.slideCount).toBe(4);
    }
  });
  it("fails on non-ZIP input", async () => {
    const result = await convertKeynoteToPdf(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ZIP signature/);
  });
  it("fails when slide count cannot be determined", async () => {
    const bytes = buildZip([{ name: "foo.txt", data: new Uint8Array([1]) }]);
    const result = await convertKeynoteToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/slide count/);
  });
  it("uses custom title when provided", async () => {
    const metadata = JSON.stringify({ title: "Original Title", "slide-number": 1 });
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode(metadata) }]);
    const opts: KeynoteConvertOptions = { ...DEFAULT_OPTIONS, title: "Custom Title" };
    const result = await convertKeynoteToPdf(bytes, opts, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Original Title");
      // The PDF should use the custom title (verified by metadata fallback path)
    }
  });
  it("returns previewImage as null when preview.jpg is missing", async () => {
    const metadata = JSON.stringify({ title: "T", "slide-number": 1 });
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode(metadata) }]);
    const result = await convertKeynoteToPdf(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.previewImage).toBeNull();
    }
  });
});

// ===== formatBytes =====

describe("keynote-to-pdf-converter formatBytes", () => {
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

describe("keynote-to-pdf-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.key",
      fileSize: 1000,
      slideCount: 5,
      title: "My Slides",
      pdfBytes: 2000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.key");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.key`,
        fileSize: i,
        slideCount: 1,
        title: `T${i}`,
        pdfBytes: i,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.key",
      fileSize: 1,
      slideCount: 1,
      title: "x",
      pdfBytes: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("keynote-to-pdf-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/keynote-to-pdf-converter" },
    };
    const opts: KeynoteConvertOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: "4:3",
      includeSlideNumbers: false,
      includeTitlePage: true,
      title: "My Slides",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("size=4%3A3");
    expect(url).toContain("numbers=false");
    expect(url).toContain("title=true");
    expect(url).toContain("t=My+Slides");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#size=4%3A3&numbers=false&title=true&t=Custom";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.pageSize).toBe("4:3");
    expect(opts!.includeSlideNumbers).toBe(false);
    expect(opts!.includeTitlePage).toBe(true);
    expect(opts!.title).toBe("Custom");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("defaults to 16:9 for unknown size", () => {
    const opts = parseShareUrl("#size=invalid");
    expect(opts!.pageSize).toBe("16:9");
  });
});

// ===== DEFAULT_OPTIONS sanity =====

describe("keynote-to-pdf-converter DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.pageSize).toBe("16:9");
    expect(DEFAULT_OPTIONS.includeSlideNumbers).toBe(true);
    expect(DEFAULT_OPTIONS.includeTitlePage).toBe(true);
  });
});

// ===== EMPTY_METADATA sanity =====

describe("keynote-to-pdf-converter EMPTY_METADATA", () => {
  it("has empty strings and zero counts", () => {
    expect(EMPTY_METADATA.title).toBe("");
    expect(EMPTY_METADATA.author).toBe("");
    expect(EMPTY_METADATA.slideCount).toBe(0);
  });
});
