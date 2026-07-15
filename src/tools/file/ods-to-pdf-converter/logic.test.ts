import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  isOdsArchive, readZipEntry, extractSheets, parseMeta, computeStats,
  convertOdsToPdf, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type OdsSheet, type ConvertOptions,
} from "./logic";

// ===== Helpers =====

function makeMinimalOds(contentXml: string, metaXml?: string): Uint8Array {
  const files: Array<{ name: string; data: Uint8Array }> = [
    { name: "content.xml", data: new TextEncoder().encode(contentXml) },
  ];
  if (metaXml) files.push({ name: "meta.xml", data: new TextEncoder().encode(metaXml) });
  return buildStoreZip(files);
}

function buildStoreZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  const crc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const b of data) {
      crc ^= b;
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc32(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
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
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
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
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
});

// ===== isOdsArchive =====

describe("ods-to-pdf-converter isOdsArchive", () => {
  it("returns true for ZIP magic", () => {
    expect(isOdsArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });
  it("returns false for non-ZIP magic", () => {
    expect(isOdsArchive(new Uint8Array([0x4d, 0x53, 0x43, 0x46]))).toBe(false);
  });
});

// ===== readZipEntry =====

describe("ods-to-pdf-converter readZipEntry", () => {
  it("reads an entry from a STORE zip", async () => {
    const zip = makeMinimalOds("<root>hello</root>");
    const data = await readZipEntry(zip, "content.xml");
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("<root>hello</root>");
  });
  it("returns null for missing entry", async () => {
    const zip = makeMinimalOds("<root>hello</root>");
    const data = await readZipEntry(zip, "missing.xml");
    expect(data).toBeNull();
  });
});

// ===== extractSheets =====

describe("ods-to-pdf-converter extractSheets", () => {
  it("extracts a single sheet with cells", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell><text:p>A</text:p></table:table-cell>
<table:table-cell><text:p>B</text:p></table:table-cell>
</table:table-row>
<table:table-row>
<table:table-cell><text:p>1</text:p></table:table-cell>
<table:table-cell><text:p>2</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const sheets = extractSheets(xml);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe("Sheet1");
    expect(sheets[0]!.rows).toHaveLength(2);
    expect(sheets[0]!.rows[0]!.cells).toHaveLength(2);
    expect(sheets[0]!.rows[0]!.cells[0]!.value).toBe("A");
    expect(sheets[0]!.columnCount).toBe(2);
  });

  it("extracts multiple sheets", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row><table:table-cell><text:p>A</text:p></table:table-cell></table:table-row>
</table:table>
<table:table table:name="Sheet2">
<table:table-row><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const sheets = extractSheets(xml);
    expect(sheets).toHaveLength(2);
    expect(sheets[0]!.name).toBe("Sheet1");
    expect(sheets[1]!.name).toBe("Sheet2");
  });

  it("handles number-columns-repeated attribute", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell table:number-columns-repeated="3"><text:p>X</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const sheets = extractSheets(xml);
    expect(sheets[0]!.rows[0]!.cells).toHaveLength(3);
    expect(sheets[0]!.rows[0]!.cells[0]!.value).toBe("X");
    expect(sheets[0]!.rows[0]!.cells[2]!.value).toBe("X");
  });

  it("detects numeric cells", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell>
<table:table-cell><text:p>hello</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const sheets = extractSheets(xml);
    expect(sheets[0]!.rows[0]!.cells[0]!.value).toBe("42");
    expect(sheets[0]!.rows[0]!.cells[0]!.isNumber).toBe(true);
    expect(sheets[0]!.rows[0]!.cells[1]!.isNumber).toBe(false);
  });

  it("strips trailing empty cells", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell><text:p>A</text:p></table:table-cell>
<table:table-cell><text:p></text:p></table:table-cell>
<table:table-cell><text:p></text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const sheets = extractSheets(xml);
    expect(sheets[0]!.rows[0]!.cells).toHaveLength(1);
  });

  it("returns empty list when office:body missing", () => {
    expect(extractSheets("<root/>")).toEqual([]);
  });

  it("returns empty list when office:spreadsheet missing", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office">
<office:body></office:body>
</office:document-content>`;
    expect(extractSheets(xml)).toEqual([]);
  });
});

// ===== parseMeta =====

describe("ods-to-pdf-converter parseMeta", () => {
  it("extracts metadata fields", () => {
    const xml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc" xmlns:meta="urn:meta">
<office:meta>
<dc:title>My Sheet</dc:title>
<dc:creator>Author</dc:creator>
<meta:generator>LibreOffice/7.4</meta:generator>
<meta:creation-date>2024-01-01T00:00:00</meta:creation-date>
</office:meta>
</office:document-meta>`;
    const m = parseMeta(xml);
    expect(m.title).toBe("My Sheet");
    expect(m.author).toBe("Author");
    expect(m.generator).toContain("LibreOffice");
    expect(m.creationDate).toContain("2024");
  });
});

// ===== computeStats =====

describe("ods-to-pdf-converter computeStats", () => {
  it("computes counts", () => {
    const sheets: OdsSheet[] = [
      { name: "S1", rows: [{ cells: [{ value: "A", isNumber: false }, { value: "B", isNumber: false }] }], columnCount: 2 },
      { name: "S2", rows: [{ cells: [{ value: "1", isNumber: true }] }], columnCount: 1 },
    ];
    const stats = computeStats(sheets, 2, 1000);
    expect(stats.sheetCount).toBe(2);
    expect(stats.rowCount).toBe(2);
    expect(stats.cellCount).toBe(3);
    expect(stats.maxColumnCount).toBe(2);
    expect(stats.pageCount).toBe(2);
  });
});

// ===== convertOdsToPdf =====

describe("ods-to-pdf-converter convertOdsToPdf", () => {
  it("converts a minimal ODS to PDF", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell><text:p>Name</text:p></table:table-cell>
<table:table-cell><text:p>Age</text:p></table:table-cell>
</table:table-row>
<table:table-row>
<table:table-cell><text:p>Alice</text:p></table:table-cell>
<table:table-cell office:value-type="float" office:value="30"><text:p>30</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const ods = makeMinimalOds(xml);
    const result = await convertOdsToPdf(ods, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.bytes.length).toBeGreaterThan(0);
      expect(result.output.stats.sheetCount).toBe(1);
      expect(result.output.stats.rowCount).toBe(2);
      expect(result.output.stats.cellCount).toBe(4);
    }
  });

  it("returns error for non-ODT input", async () => {
    const result = await convertOdsToPdf(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Not an ODS");
  });

  it("returns error when content.xml missing", async () => {
    const zip = buildStoreZip([{ name: "other.xml", data: new TextEncoder().encode("test") }]);
    const result = await convertOdsToPdf(zip, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("content.xml");
  });

  it("returns error for empty spreadsheet", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office">
<office:body><office:spreadsheet></office:spreadsheet></office:body>
</office:document-content>`;
    const ods = makeMinimalOds(xml);
    const result = await convertOdsToPdf(ods, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No sheets");
  });

  it("respects sheetIndex option", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row><table:table-cell><text:p>A</text:p></table:table-cell></table:table-row>
</table:table>
<table:table table:name="Sheet2">
<table:table-row><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const ods = makeMinimalOds(xml);
    const result = await convertOdsToPdf(ods, { ...DEFAULT_OPTIONS, sheetIndex: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should only render sheet 2 (1 page)
      expect(result.output.stats.sheetCount).toBe(1);
    }
  });

  it("uses landscape orientation", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row>
<table:table-cell><text:p>Col1</text:p></table:table-cell>
<table:table-cell><text:p>Col2</text:p></table:table-cell>
<table:table-cell><text:p>Col3</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const ods = makeMinimalOds(xml);
    const result = await convertOdsToPdf(ods, { ...DEFAULT_OPTIONS, orientation: "landscape" });
    expect(result.ok).toBe(true);
  });

  it("extracts metadata from meta.xml", async () => {
    const contentXml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text">
<office:body><office:spreadsheet>
<table:table table:name="S1">
<table:table-row><table:table-cell><text:p>X</text:p></table:table-cell></table:table-row>
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`;
    const metaXml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc">
<office:meta><dc:title>My Sheet</dc:title><dc:creator>Bob</dc:creator></office:meta>
</office:document-meta>`;
    const ods = makeMinimalOds(contentXml, metaXml);
    const result = await convertOdsToPdf(ods, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("My Sheet");
      expect(result.output.metadata.author).toBe("Bob");
    }
  });
});

// ===== Utilities =====

describe("ods-to-pdf-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("ods-to-pdf-converter history", () => {
  it("returns empty list when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.ods", odsBytes: 1000, pdfBytes: 2000,
      sheetCount: 2, rowCount: 10, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.ods");
  });
  it("clears history", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.ods", odsBytes: 1000, pdfBytes: 2000,
      sheetCount: 2, rowCount: 10, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("ods-to-pdf-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/ods-to-pdf-converter" } };
    const url = buildShareUrl({ sheetIndex: 0, orientation: "landscape", margin: 50, fontSize: 10, boldHeader: true, maxRowsPerSheet: 200 });
    expect(url).toContain("sheet=0");
    expect(url).toContain("orient=landscape");
    expect(url).toContain("margin=50");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#sheet=1&orient=landscape&margin=60&fs=12&bold=true");
    expect(parsed).toEqual({
      sheetIndex: 1, orientation: "landscape", margin: 60, fontSize: 12,
      boldHeader: true, maxRowsPerSheet: 200,
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("falls back to portrait for invalid orientation", () => {
    const parsed = parseShareUrl("#orient=invalid");
    expect(parsed?.orientation).toBe("portrait");
  });
  it("clamps out-of-range font size", () => {
    const parsed = parseShareUrl("#sheet=0&fs=99");
    expect(parsed?.fontSize).toBe(14);
  });
});
