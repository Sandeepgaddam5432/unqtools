import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  isOdtArchive, readZipEntry, extractBlocks, parseMeta, computeStats,
  convertOdtToPdf, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type TextBlock, type ConvertOptions,
} from "./logic";

// ===== Helpers =====

function makeMinimalOdt(contentXml: string, metaXml?: string): Uint8Array {
  // Build a tiny ZIP with content.xml (and optional meta.xml), all STORE (no compression).
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
  // CRC32
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
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, c, true);
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
    cv.setUint32(16, c, true);
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

// ===== isOdtArchive =====

describe("odt-to-pdf-converter isOdtArchive", () => {
  it("returns true for ZIP magic", () => {
    expect(isOdtArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });
  it("returns false for non-ZIP magic", () => {
    expect(isOdtArchive(new Uint8Array([0x4d, 0x53, 0x43, 0x46]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isOdtArchive(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});

// ===== readZipEntry =====

describe("odt-to-pdf-converter readZipEntry", () => {
  it("reads an entry from a STORE zip", async () => {
    const zip = makeMinimalOdt("<root>hello</root>");
    const data = await readZipEntry(zip, "content.xml");
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("<root>hello</root>");
  });
  it("returns null for missing entry", async () => {
    const zip = makeMinimalOdt("<root>hello</root>");
    const data = await readZipEntry(zip, "missing.xml");
    expect(data).toBeNull();
  });
});

// ===== extractBlocks =====

describe("odt-to-pdf-converter extractBlocks", () => {
  it("extracts paragraphs", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:p>Hello, world!</text:p>
<text:p>Second paragraph.</text:p>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("paragraph");
    expect(blocks[0]!.text).toBe("Hello, world!");
    expect(blocks[1]!.text).toBe("Second paragraph.");
  });

  it("extracts headings with outline level", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:h text:outline-level="1">Title</text:h>
<text:h text:outline-level="2">Subtitle</text:h>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("heading");
    expect(blocks[0]!.level).toBe(1);
    expect(blocks[0]!.bold).toBe(true);
    expect(blocks[1]!.level).toBe(2);
  });

  it("extracts list items", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:list>
<text:list-item><text:p>Apple</text:p></text:list-item>
<text:list-item><text:p>Banana</text:p></text:list-item>
</text:list>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("list-item");
    expect(blocks[0]!.text).toBe("Apple");
    expect(blocks[0]!.indent).toBe(0);
  });

  it("skips empty paragraphs", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:p>   </text:p>
<text:p>Real content</text:p>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.text).toBe("Real content");
  });

  it("extracts hyperlinks", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text" xmlns:xlink="urn:xlink">
<office:body><office:text>
<text:p>Visit <text:a xlink:href="https://example.com">our site</text:a> today.</text:p>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.text).toContain("Visit");
    expect(blocks[0]!.text).toContain("our site");
    expect(blocks[0]!.links).toHaveLength(1);
    expect(blocks[0]!.links[0]!.url).toBe("https://example.com");
  });

  it("handles nested lists with indentation", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:list>
<text:list-item>
  <text:p>Parent</text:p>
  <text:list>
    <text:list-item><text:p>Child</text:p></text:list-item>
  </text:list>
</text:list-item>
</text:list>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.text).toBe("Parent");
    expect(blocks[0]!.indent).toBe(0);
    expect(blocks[1]!.text).toBe("Child");
    expect(blocks[1]!.indent).toBe(1);
  });

  it("extracts tables as joined paragraphs", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text" xmlns:table="urn:table">
<office:body><office:text>
<table:table>
<table:table-row>
<table:table-cell><text:p>A</text:p></table:table-cell>
<table:table-cell><text:p>B</text:p></table:table-cell>
</table:table-row>
</table:table>
</office:text></office:body>
</office:document-content>`;
    const blocks = extractBlocks(xml);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.text).toBe("A | B");
  });

  it("returns empty list when office:body missing", () => {
    expect(extractBlocks("<root/>")).toEqual([]);
  });
});

// ===== parseMeta =====

describe("odt-to-pdf-converter parseMeta", () => {
  it("extracts metadata fields", () => {
    const xml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc" xmlns:meta="urn:meta">
<office:meta>
<dc:title>My Document</dc:title>
<dc:creator>John Doe</dc:creator>
<dc:subject>Testing</dc:subject>
<meta:keyword>test, sample</meta:keyword>
<dc:description>A test document</dc:description>
<meta:generator>LibreOffice/7.4</meta:generator>
<meta:creation-date>2024-01-01T00:00:00</meta:creation-date>
</office:meta>
</office:document-meta>`;
    const m = parseMeta(xml);
    expect(m.title).toBe("My Document");
    expect(m.author).toBe("John Doe");
    expect(m.subject).toBe("Testing");
    expect(m.keywords).toBe("test, sample");
    expect(m.description).toBe("A test document");
    expect(m.generator).toContain("LibreOffice");
    expect(m.creationDate).toContain("2024");
    expect(m.metaFound).toBe(true);
  });
  it("returns empty metadata when office:meta missing", () => {
    const m = parseMeta("<root/>");
    expect(m.title).toBe("");
    expect(m.metaFound).toBe(true);
  });
});

// ===== computeStats =====

describe("odt-to-pdf-converter computeStats", () => {
  it("computes counts", () => {
    const blocks: TextBlock[] = [
      { type: "heading", text: "Title", level: 1, isOrdered: false, indent: 0, bold: true, monospace: false, links: [] },
      { type: "paragraph", text: "Para one", level: 0, isOrdered: false, indent: 0, bold: false, monospace: false, links: [] },
      { type: "paragraph", text: "Para two", level: 0, isOrdered: false, indent: 0, bold: false, monospace: false, links: [] },
      { type: "list-item", text: "Item", level: 0, isOrdered: false, indent: 0, bold: false, monospace: false, links: [] },
    ];
    const stats = computeStats(blocks, 3, 1000);
    expect(stats.blockCount).toBe(4);
    expect(stats.headingCount).toBe(1);
    expect(stats.paragraphCount).toBe(2);
    expect(stats.listItemCount).toBe(1);
    expect(stats.wordCount).toBe(6); // Title, Para, one, Para, two, Item
    expect(stats.pageCount).toBe(3);
    expect(stats.pdfBytes).toBe(1000);
  });
});

// ===== convertOdtToPdf =====

describe("odt-to-pdf-converter convertOdtToPdf", () => {
  it("converts a minimal ODT to PDF", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:h text:outline-level="1">Hello</text:h>
<text:p>This is a test paragraph.</text:p>
</office:text></office:body>
</office:document-content>`;
    const odt = makeMinimalOdt(xml);
    const result = await convertOdtToPdf(odt, { ...DEFAULT_OPTIONS });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.bytes.length).toBeGreaterThan(0);
      expect(result.output.stats.blockCount).toBe(2);
      expect(result.output.stats.pageCount).toBeGreaterThan(0);
    }
  });

  it("returns error for non-ODT input", async () => {
    const result = await convertOdtToPdf(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Not an ODT");
  });

  it("returns error when content.xml is missing", async () => {
    const emptyZip = makeMinimalOdt("placeholder", undefined);
    // Replace content.xml with a non-content entry
    const zip = buildStoreZip([{ name: "other.xml", data: new TextEncoder().encode("test") }]);
    void emptyZip;
    const result = await convertOdtToPdf(zip, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("content.xml");
  });

  it("returns error for empty content", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text></office:text></office:body>
</office:document-content>`;
    const odt = makeMinimalOdt(xml);
    const result = await convertOdtToPdf(odt, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No text content");
  });

  it("applies custom font size and page size", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:p>Test paragraph with custom font size and page size.</text:p>
</office:text></office:body>
</office:document-content>`;
    const odt = makeMinimalOdt(xml);
    const result = await convertOdtToPdf(odt, { fontSize: 18, pageSize: "letter", margin: 60, title: "Custom" });
    expect(result.ok).toBe(true);
  });

  it("extracts metadata from meta.xml", async () => {
    const contentXml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:text="urn:text">
<office:body><office:text>
<text:p>Body text</text:p>
</office:text></office:body>
</office:document-content>`;
    const metaXml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc">
<office:meta>
<dc:title>My Title</dc:title>
<dc:creator>Author</dc:creator>
</office:meta>
</office:document-meta>`;
    const odt = makeMinimalOdt(contentXml, metaXml);
    const result = await convertOdtToPdf(odt, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("My Title");
      expect(result.output.metadata.author).toBe("Author");
    }
  });
});

// ===== Utilities =====

describe("odt-to-pdf-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("odt-to-pdf-converter history", () => {
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
      fileName: "test.odt", odtBytes: 1000, pdfBytes: 2000,
      blockCount: 5, pageCount: 2, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.odt");
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
      fileName: "test.odt", odtBytes: 1000, pdfBytes: 2000,
      blockCount: 5, pageCount: 2, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("odt-to-pdf-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/odt-to-pdf-converter" } };
    const url = buildShareUrl({ fontSize: 14, pageSize: "letter", margin: 60, title: "Hi" });
    expect(url).toContain("fs=14");
    expect(url).toContain("page=letter");
    expect(url).toContain("margin=60");
    expect(url).toContain("title=Hi");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#fs=18&page=legal&margin=80&title=Test");
    expect(parsed).toEqual({ fontSize: 18, pageSize: "legal", margin: 80, title: "Test" });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("clamps out-of-range font size", () => {
    const parsed = parseShareUrl("#fs=99&page=a4");
    expect(parsed?.fontSize).toBe(24);
  });
  it("falls back to a4 for invalid page size", () => {
    const parsed = parseShareUrl("#fs=12&page=invalid");
    expect(parsed?.pageSize).toBe("a4");
  });
});
