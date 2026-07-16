import { describe, it, expect, beforeEach } from "vitest";
import { parseZipEntries } from "../epub-reader/logic";
import {
  EMPTY_METADATA,
  DEFAULT_OPTIONS,
  parseMetadataJson,
  isPagesFile,
  findEntry,
  isPdfBytes,
  extractTextFromIwa,
  countWords,
  getPageDimensions,
  renderTextPdf,
  countPdfPages,
  convertPagesToPdf,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PagesConvertOptions,
} from "./logic";

// ===== ZIP helpers =====

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

// A minimal PDF header for testing isPdfBytes
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

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

// ===== isPagesFile =====

describe("pages-to-pdf-converter isPagesFile", () => {
  it("returns true for a ZIP file (PK signature)", () => {
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode("{}") }]);
    expect(isPagesFile(bytes)).toBe(true);
  });
  it("returns false for a non-ZIP file", () => {
    expect(isPagesFile(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isPagesFile(new Uint8Array(0))).toBe(false);
  });
  it("returns false for a file smaller than 4 bytes", () => {
    expect(isPagesFile(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});

// ===== parseMetadataJson =====

describe("pages-to-pdf-converter parseMetadataJson", () => {
  it("parses a complete metadata.json", () => {
    const json = JSON.stringify({
      title: "My Document",
      author: "Jane Doe",
      Generator_Version: "12.0",
      date: "2026-01-01",
    });
    const meta = parseMetadataJson(json);
    expect(meta.title).toBe("My Document");
    expect(meta.author).toBe("Jane Doe");
    expect(meta.generatorVersion).toBe("12.0");
    expect(meta.creationDate).toBe("2026-01-01");
  });
  it("uses defaults for empty metadata", () => {
    const meta = parseMetadataJson("{}");
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
  });
  it("returns empty metadata for invalid JSON", () => {
    const meta = parseMetadataJson("not json");
    expect(meta.title).toBe("");
  });
  it("returns empty metadata for non-object JSON", () => {
    expect(parseMetadataJson("null").title).toBe("");
    expect(parseMetadataJson("[]").title).toBe("");
  });
});

// ===== findEntry =====

describe("pages-to-pdf-converter findEntry", () => {
  it("finds an entry by exact name", () => {
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode("{}") },
      { name: "Document.iwa", data: new Uint8Array([1, 2, 3]) },
    ]);
    const entries = parseZipEntries(bytes);
    expect(findEntry(entries, "metadata.json")?.name).toBe("metadata.json");
  });
  it("finds an entry by case-insensitive substring", () => {
    const bytes = buildZip([{ name: "Document.iwa", data: new Uint8Array([1]) }]);
    const entries = parseZipEntries(bytes);
    expect(findEntry(entries, "document.iwa")).toBeDefined();
  });
  it("returns undefined for a missing entry", () => {
    const bytes = buildZip([{ name: "a.txt", data: new Uint8Array([1]) }]);
    const entries = parseZipEntries(bytes);
    expect(findEntry(entries, "missing")).toBeUndefined();
  });
});

// ===== isPdfBytes =====

describe("pages-to-pdf-converter isPdfBytes", () => {
  it("returns true for bytes starting with %PDF-", () => {
    expect(isPdfBytes(PDF_HEADER)).toBe(true);
  });
  it("returns false for non-PDF bytes", () => {
    expect(isPdfBytes(new Uint8Array([1, 2, 3, 4, 5]))).toBe(false);
  });
  it("returns false for short input", () => {
    expect(isPdfBytes(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});

// ===== extractTextFromIwa =====

describe("pages-to-pdf-converter extractTextFromIwa", () => {
  it("extracts text segments from bytes", () => {
    const text = "Hello world";
    const bytes = new TextEncoder().encode(text);
    expect(extractTextFromIwa(bytes)).toContain("Hello world");
  });
  it("extracts multiple text segments separated by binary", () => {
    const enc = new TextEncoder();
    const bytes = new Uint8Array([...enc.encode("First part"), 0, 0, 1, ...enc.encode("Second part"), 0, 0, ...enc.encode("Third part")]);
    const result = extractTextFromIwa(bytes);
    expect(result).toContain("First part");
    expect(result).toContain("Second part");
    expect(result).toContain("Third part");
  });
  it("returns empty string for all-binary input", () => {
    expect(extractTextFromIwa(new Uint8Array([0, 1, 2, 3, 0, 1, 2, 3]))).toBe("");
  });
  it("ignores short text segments (under 4 chars)", () => {
    const enc = new TextEncoder();
    const bytes = new Uint8Array([...enc.encode("Hi"), 0, ...enc.encode("Hello world")]);
    const result = extractTextFromIwa(bytes);
    expect(result).toContain("Hello world");
    expect(result).not.toContain("Hi\n");
  });
  it("handles UTF-8 multibyte characters", () => {
    const bytes = new TextEncoder().encode("Héllo wörld");
    expect(extractTextFromIwa(bytes)).toContain("Héllo wörld");
  });
});

// ===== countWords =====

describe("pages-to-pdf-converter countWords", () => {
  it("counts words in a simple string", () => {
    expect(countWords("Hello world")).toBe(2);
  });
  it("counts 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
  it("counts 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });
  it("counts words with mixed whitespace", () => {
    expect(countWords("Hello\nworld\tfoo")).toBe(3);
  });
});

// ===== getPageDimensions =====

describe("pages-to-pdf-converter getPageDimensions", () => {
  it("returns Letter portrait dimensions", () => {
    const { width, height } = getPageDimensions("letter", "portrait");
    expect(width).toBe(612);
    expect(height).toBe(792);
  });
  it("returns Letter landscape dimensions", () => {
    const { width, height } = getPageDimensions("letter", "landscape");
    expect(width).toBe(792);
    expect(height).toBe(612);
  });
  it("returns A4 portrait dimensions", () => {
    const { width, height } = getPageDimensions("a4", "portrait");
    expect(width).toBeLessThan(height);
  });
  it("returns A4 landscape dimensions", () => {
    const { width, height } = getPageDimensions("a4", "landscape");
    expect(width).toBeGreaterThan(height);
  });
});

// ===== renderTextPdf =====

describe("pages-to-pdf-converter renderTextPdf", () => {
  it("renders a PDF from text", async () => {
    const bytes = await renderTextPdf("Hello world\nThis is a test.", DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(100);
  });
  it("handles empty text", async () => {
    const bytes = await renderTextPdf("", DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(0);
  });
  it("handles long text", async () => {
    const longText = "word ".repeat(500);
    const bytes = await renderTextPdf(longText, DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

// ===== countPdfPages =====

describe("pages-to-pdf-converter countPdfPages", () => {
  it("counts pages in a rendered PDF", async () => {
    const bytes = await renderTextPdf("Hello world", DEFAULT_OPTIONS);
    const count = await countPdfPages(bytes);
    expect(count).toBeGreaterThanOrEqual(1);
  });
  it("returns 1 for invalid PDF bytes", async () => {
    const count = await countPdfPages(new Uint8Array([0, 1, 2, 3]));
    expect(count).toBe(1);
  });
});

// ===== convertPagesToPdf =====

describe("pages-to-pdf-converter convertPagesToPdf", () => {
  it("uses embedded preview.pdf when present", async () => {
    // Build a fake "PDF" with %PDF- header
    const fakePdf = new Uint8Array([...PDF_HEADER, 0x0a, ...new TextEncoder().encode("%body%")]);
    const metadata = JSON.stringify({ title: "My Pages Doc", date: "2026-01-01" });
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode(metadata) },
      { name: "preview.pdf", data: fakePdf },
      { name: "preview.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
    ]);
    const result = await convertPagesToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.usedEmbeddedPdf).toBe(true);
      expect(result.output.metadata.title).toBe("My Pages Doc");
      expect(result.output.previewImage).not.toBeNull();
    }
  });
  it("falls back to text extraction when no preview.pdf", async () => {
    const text = "This is the body text of the Pages document.";
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode('{"title":"T"}') },
      { name: "Document.iwa", data: new TextEncoder().encode(text) },
    ]);
    const result = await convertPagesToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.usedEmbeddedPdf).toBe(false);
      expect(result.output.extractedText).toContain("body text");
      expect(result.output.wordCount).toBeGreaterThan(0);
    }
  });
  it("fails on non-ZIP input", async () => {
    const result = await convertPagesToPdf(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ZIP signature/);
  });
  it("fails when no Document.iwa and no preview.pdf", async () => {
    const bytes = buildZip([{ name: "foo.txt", data: new Uint8Array([1]) }]);
    const result = await convertPagesToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Document\.iwa.*preview\.pdf/);
  });
  it("fails when Document.iwa has no extractable text", async () => {
    const bytes = buildZip([
      { name: "Document.iwa", data: new Uint8Array([0, 1, 2, 3, 0, 1, 2, 3]) },
    ]);
    const result = await convertPagesToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Could not extract/);
  });
});

// ===== formatBytes =====

describe("pages-to-pdf-converter formatBytes", () => {
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

describe("pages-to-pdf-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.pages",
      fileSize: 1000,
      pageCount: 5,
      wordCount: 200,
      title: "My Doc",
      usedEmbeddedPdf: false,
      pdfBytes: 2000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.pages");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.pages`,
        fileSize: i,
        pageCount: 1,
        wordCount: 1,
        title: `T${i}`,
        usedEmbeddedPdf: false,
        pdfBytes: i,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.pages",
      fileSize: 1,
      pageCount: 1,
      wordCount: 1,
      title: "x",
      usedEmbeddedPdf: false,
      pdfBytes: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pages-to-pdf-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/pages-to-pdf-converter" },
    };
    const opts: PagesConvertOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: "a4",
      orientation: "landscape",
      fontSize: 14,
      margin: 40,
      title: "My Doc",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("size=a4");
    expect(url).toContain("orient=landscape");
    expect(url).toContain("fs=14");
    expect(url).toContain("margin=40");
    expect(url).toContain("t=My+Doc");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#size=a4&orient=landscape&fs=14&margin=40&t=Custom";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.pageSize).toBe("a4");
    expect(opts!.orientation).toBe("landscape");
    expect(opts!.fontSize).toBe(14);
    expect(opts!.margin).toBe(40);
    expect(opts!.title).toBe("Custom");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#fs=999");
    expect(opts!.fontSize).toBe(24);
  });
  it("defaults to letter/portrait for unknown values", () => {
    const opts = parseShareUrl("#size=invalid&orient=invalid");
    expect(opts!.pageSize).toBe("letter");
    expect(opts!.orientation).toBe("portrait");
  });
});

// ===== DEFAULT_OPTIONS / EMPTY_METADATA =====

describe("pages-to-pdf-converter defaults", () => {
  it("DEFAULT_OPTIONS has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.pageSize).toBe("letter");
    expect(DEFAULT_OPTIONS.orientation).toBe("portrait");
    expect(DEFAULT_OPTIONS.fontSize).toBe(12);
    expect(DEFAULT_OPTIONS.margin).toBe(50);
  });
  it("EMPTY_METADATA has empty strings", () => {
    expect(EMPTY_METADATA.title).toBe("");
    expect(EMPTY_METADATA.author).toBe("");
  });
});
