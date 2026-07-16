import { describe, it, expect, beforeEach } from "vitest";
import { parseZipEntries } from "../epub-reader/logic";
import {
  EMPTY_METADATA,
  DEFAULT_OPTIONS,
  parseMetadataJson,
  isNumbersFile,
  findEntry,
  countSheetIwaFiles,
  getPageSize,
  renderPlaceholderPdf,
  convertNumbersToPdf,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NumbersPageSize,
  type NumbersConvertOptions,
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

// ===== isNumbersFile =====

describe("numbers-to-pdf-converter isNumbersFile", () => {
  it("returns true for a ZIP file (PK signature)", () => {
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode("{}") }]);
    expect(isNumbersFile(bytes)).toBe(true);
  });
  it("returns false for a non-ZIP file", () => {
    expect(isNumbersFile(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isNumbersFile(new Uint8Array(0))).toBe(false);
  });
  it("returns false for a file smaller than 4 bytes", () => {
    expect(isNumbersFile(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});

// ===== parseMetadataJson =====

describe("numbers-to-pdf-converter parseMetadataJson", () => {
  it("parses a complete metadata.json", () => {
    const json = JSON.stringify({
      title: "My Spreadsheet",
      author: "Jane Doe",
      "sheet-count": 4,
      Generator_Version: "12.0",
      date: "2026-01-01",
    });
    const meta = parseMetadataJson(json);
    expect(meta.title).toBe("My Spreadsheet");
    expect(meta.author).toBe("Jane Doe");
    expect(meta.sheetCount).toBe(4);
    expect(meta.generatorVersion).toBe("12.0");
    expect(meta.creationDate).toBe("2026-01-01");
  });
  it("uses defaults for empty metadata", () => {
    const meta = parseMetadataJson("{}");
    expect(meta.title).toBe("");
    expect(meta.sheetCount).toBe(0);
    expect(meta.width).toBe(792);
    expect(meta.height).toBe(612);
  });
  it("returns empty metadata for invalid JSON", () => {
    const meta = parseMetadataJson("not json");
    expect(meta.title).toBe("");
    expect(meta.sheetCount).toBe(0);
  });
  it("accepts sheetCount as a string number", () => {
    const json = JSON.stringify({ "sheet-count": "5" });
    expect(parseMetadataJson(json).sheetCount).toBe(5);
  });
  it("accepts sheetCount as a number", () => {
    const json = JSON.stringify({ sheetCount: 7 });
    expect(parseMetadataJson(json).sheetCount).toBe(7);
  });
  it("returns empty metadata for non-object JSON", () => {
    expect(parseMetadataJson("null").title).toBe("");
    expect(parseMetadataJson("[]").title).toBe("");
  });
  it("parses size when provided", () => {
    const json = JSON.stringify({ size: { width: 1000, height: 600 } });
    const meta = parseMetadataJson(json);
    expect(meta.width).toBe(1000);
    expect(meta.height).toBe(600);
  });
});

// ===== findEntry =====

describe("numbers-to-pdf-converter findEntry", () => {
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

// ===== countSheetIwaFiles =====

describe("numbers-to-pdf-converter countSheetIwaFiles", () => {
  it("counts sheet-*.iwa files", () => {
    const bytes = buildZip([
      { name: "Tables/sheet-1.iwa", data: new Uint8Array([1]) },
      { name: "Tables/sheet-2.iwa", data: new Uint8Array([2]) },
      { name: "Tables/other.iwa", data: new Uint8Array([3]) },
    ]);
    const entries = parseZipEntries(bytes);
    expect(countSheetIwaFiles(entries)).toBe(2);
  });
  it("counts Tables/ folder .iwa files with 'sheet' in name", () => {
    const bytes = buildZip([
      { name: "Tables/sheet-table1.iwa", data: new Uint8Array([1]) },
      { name: "Tables/sheet-table2.iwa", data: new Uint8Array([2]) },
    ]);
    const entries = parseZipEntries(bytes);
    expect(countSheetIwaFiles(entries)).toBe(2);
  });
  it("returns 0 when no sheet .iwa files exist", () => {
    const bytes = buildZip([{ name: "foo.txt", data: new Uint8Array([1]) }]);
    const entries = parseZipEntries(bytes);
    expect(countSheetIwaFiles(entries)).toBe(0);
  });
});

// ===== getPageSize =====

describe("numbers-to-pdf-converter getPageSize", () => {
  it("returns 792x612 for letter-landscape", () => {
    expect(getPageSize("letter-landscape")).toEqual({ width: 792, height: 612 });
  });
  it("returns 842x595 for a4-landscape", () => {
    expect(getPageSize("a4-landscape")).toEqual({ width: 842, height: 595 });
  });
  it("returns 595x842 for a4-portrait", () => {
    expect(getPageSize("a4-portrait")).toEqual({ width: 595, height: 842 });
  });
});

// ===== renderPlaceholderPdf =====

describe("numbers-to-pdf-converter renderPlaceholderPdf", () => {
  it("renders a PDF with title page + N sheet pages", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", sheetCount: 3 };
    const bytes = await renderPlaceholderPdf(meta, DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(100);
  });
  it("renders without title page when includeTitlePage is false", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", sheetCount: 2 };
    const bytes = await renderPlaceholderPdf(meta, {
      ...DEFAULT_OPTIONS,
      includeTitlePage: false,
    });
    expect(bytes.length).toBeGreaterThan(100);
  });
  it("renders with custom placeholder rows/cols", async () => {
    const meta = { ...EMPTY_METADATA, title: "Test", sheetCount: 1 };
    const bytes = await renderPlaceholderPdf(meta, {
      ...DEFAULT_OPTIONS,
      placeholderRows: 10,
      placeholderCols: 5,
    });
    expect(bytes.length).toBeGreaterThan(100);
  });
});

// ===== convertNumbersToPdf =====

describe("numbers-to-pdf-converter convertNumbersToPdf", () => {
  it("converts a valid Numbers ZIP to PDF", async () => {
    const metadata = JSON.stringify({
      title: "My Spreadsheet",
      "sheet-count": 3,
    });
    const bytes = buildZip([
      { name: "metadata.json", data: new TextEncoder().encode(metadata) },
      { name: "preview.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
      { name: "Tables/sheet-1.iwa", data: new Uint8Array([1]) },
    ]);
    const result = await convertNumbersToPdf(bytes, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.metadata.title).toBe("My Spreadsheet");
      expect(result.output.sheetCount).toBe(3);
      expect(result.output.previewImage).not.toBeNull();
    }
  });
  it("falls back to .iwa count when metadata is missing", async () => {
    const bytes = buildZip([
      { name: "Tables/sheet-1.iwa", data: new Uint8Array([1]) },
      { name: "Tables/sheet-2.iwa", data: new Uint8Array([2]) },
      { name: "Tables/sheet-3.iwa", data: new Uint8Array([3]) },
      { name: "Tables/sheet-4.iwa", data: new Uint8Array([4]) },
    ]);
    const result = await convertNumbersToPdf(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.sheetCount).toBe(4);
    }
  });
  it("fails on non-ZIP input", async () => {
    const result = await convertNumbersToPdf(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ZIP signature/);
  });
  it("fails when sheet count cannot be determined", async () => {
    const bytes = buildZip([{ name: "foo.txt", data: new Uint8Array([1]) }]);
    const result = await convertNumbersToPdf(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/sheet count/);
  });
  it("returns previewImage as null when preview.jpg is missing", async () => {
    const metadata = JSON.stringify({ title: "T", "sheet-count": 1 });
    const bytes = buildZip([{ name: "metadata.json", data: new TextEncoder().encode(metadata) }]);
    const result = await convertNumbersToPdf(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.previewImage).toBeNull();
    }
  });
});

// ===== formatBytes =====

describe("numbers-to-pdf-converter formatBytes", () => {
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

describe("numbers-to-pdf-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.numbers",
      fileSize: 1000,
      sheetCount: 5,
      title: "My Sheets",
      pdfBytes: 2000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.numbers");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.numbers`,
        fileSize: i,
        sheetCount: 1,
        title: `T${i}`,
        pdfBytes: i,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.numbers",
      fileSize: 1,
      sheetCount: 1,
      title: "x",
      pdfBytes: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("numbers-to-pdf-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/numbers-to-pdf-converter" },
    };
    const opts: NumbersConvertOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: "a4-portrait",
      includeSheetNumbers: false,
      includeTitlePage: true,
      placeholderRows: 15,
      placeholderCols: 6,
      title: "My Sheets",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("size=a4-portrait");
    expect(url).toContain("numbers=false");
    expect(url).toContain("title=true");
    expect(url).toContain("rows=15");
    expect(url).toContain("cols=6");
    expect(url).toContain("t=My+Sheets");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#size=a4-portrait&numbers=false&title=true&rows=15&cols=6&t=Custom";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.pageSize).toBe("a4-portrait");
    expect(opts!.includeSheetNumbers).toBe(false);
    expect(opts!.includeTitlePage).toBe(true);
    expect(opts!.placeholderRows).toBe(15);
    expect(opts!.placeholderCols).toBe(6);
    expect(opts!.title).toBe("Custom");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("defaults to letter-landscape for unknown size", () => {
    const opts = parseShareUrl("#size=invalid");
    expect(opts!.pageSize).toBe("letter-landscape");
  });
  it("clamps placeholderRows and cols to valid range", () => {
    const opts = parseShareUrl("#rows=999&cols=999");
    expect(opts!.placeholderRows).toBe(50);
    expect(opts!.placeholderCols).toBe(20);
  });
});

// ===== DEFAULT_OPTIONS / EMPTY_METADATA =====

describe("numbers-to-pdf-converter defaults", () => {
  it("DEFAULT_OPTIONS has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.pageSize).toBe("letter-landscape");
    expect(DEFAULT_OPTIONS.includeSheetNumbers).toBe(true);
    expect(DEFAULT_OPTIONS.includeTitlePage).toBe(true);
    expect(DEFAULT_OPTIONS.placeholderRows).toBe(20);
    expect(DEFAULT_OPTIONS.placeholderCols).toBe(8);
  });
  it("EMPTY_METADATA has empty strings and zero counts", () => {
    expect(EMPTY_METADATA.title).toBe("");
    expect(EMPTY_METADATA.sheetCount).toBe(0);
  });
});
