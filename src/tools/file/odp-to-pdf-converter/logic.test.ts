import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  isOdpArchive, readZipEntry, extractSlides, parseMeta, computeStats,
  convertOdpToPdf, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type OdpSlide, type ConvertOptions, type PageSize,
} from "./logic";

// ===== Helpers =====

function makeMinimalOdp(contentXml: string, metaXml?: string): Uint8Array {
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

// ===== isOdpArchive =====

describe("odp-to-pdf-converter isOdpArchive", () => {
  it("returns true for ZIP magic", () => {
    expect(isOdpArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });
  it("returns false for non-ZIP magic", () => {
    expect(isOdpArchive(new Uint8Array([0x4d, 0x53, 0x43, 0x46]))).toBe(false);
  });
});

// ===== readZipEntry =====

describe("odp-to-pdf-converter readZipEntry", () => {
  it("reads an entry from a STORE zip", async () => {
    const zip = makeMinimalOdp("<root>hello</root>");
    const data = await readZipEntry(zip, "content.xml");
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("<root>hello</root>");
  });
  it("returns null for missing entry", async () => {
    const zip = makeMinimalOdp("<root>hello</root>");
    const data = await readZipEntry(zip, "missing.xml");
    expect(data).toBeNull();
  });
});

// ===== extractSlides =====

describe("odp-to-pdf-converter extractSlides", () => {
  it("extracts a single slide with title and body", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="slide1">
<draw:text-box>
<text:p>Slide Title</text:p>
<text:list>
<text:list-item><text:p>First bullet</text:p></text:list-item>
<text:list-item><text:p>Second bullet</text:p></text:list-item>
</text:list>
</draw:text-box>
</draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const slides = extractSlides(xml);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.title).toBe("Slide Title");
    expect(slides[0]!.body).toHaveLength(2);
    expect(slides[0]!.body[0]).toBe("First bullet");
  });

  it("extracts multiple slides", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="slide1"><draw:text-box><text:p>Title 1</text:p></draw:text-box></draw:page>
<draw:page draw:name="slide2"><draw:text-box><text:p>Title 2</text:p></draw:text-box></draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const slides = extractSlides(xml);
    expect(slides).toHaveLength(2);
    expect(slides[0]!.name).toBe("slide1");
    expect(slides[1]!.name).toBe("slide2");
  });

  it("handles slides with no text content", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw">
<office:body><office:presentation>
<draw:page draw:name="empty"><draw:text-box></draw:text-box></draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const slides = extractSlides(xml);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.title).toBe("");
    expect(slides[0]!.body).toEqual([]);
  });

  it("captures fullText of a slide", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="slide1">
<draw:text-box>
<text:p>Hello</text:p>
<text:p>World</text:p>
</draw:text-box>
</draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const slides = extractSlides(xml);
    expect(slides[0]!.fullText).toContain("Hello");
    expect(slides[0]!.fullText).toContain("World");
  });

  it("returns empty list when office:body missing", () => {
    expect(extractSlides("<root/>")).toEqual([]);
  });

  it("returns empty list when office:presentation missing", () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office">
<office:body></office:body>
</office:document-content>`;
    expect(extractSlides(xml)).toEqual([]);
  });
});

// ===== parseMeta =====

describe("odp-to-pdf-converter parseMeta", () => {
  it("extracts metadata fields", () => {
    const xml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc" xmlns:meta="urn:meta">
<office:meta>
<dc:title>My Deck</dc:title>
<dc:creator>Presenter</dc:creator>
<meta:generator>LibreOffice/7.4</meta:generator>
<meta:creation-date>2024-01-01T00:00:00</meta:creation-date>
</office:meta>
</office:document-meta>`;
    const m = parseMeta(xml);
    expect(m.title).toBe("My Deck");
    expect(m.author).toBe("Presenter");
    expect(m.generator).toContain("LibreOffice");
    expect(m.creationDate).toContain("2024");
  });
});

// ===== computeStats =====

describe("odp-to-pdf-converter computeStats", () => {
  it("computes counts", () => {
    const slides: OdpSlide[] = [
      { name: "s1", title: "Title 1", body: ["A", "B"], fullText: "Title 1\nA\nB" },
      { name: "s2", title: "", body: ["C"], fullText: "C" },
    ];
    const stats = computeStats(slides, 2, 1000);
    expect(stats.slideCount).toBe(2);
    expect(stats.titleCount).toBe(1);
    expect(stats.bodyItemCount).toBe(3);
    expect(stats.wordCount).toBeGreaterThan(0);
  });
});

// ===== convertOdpToPdf =====

describe("odp-to-pdf-converter convertOdpToPdf", () => {
  it("converts a minimal ODP to PDF", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="slide1">
<draw:text-box>
<text:p>My Title</text:p>
<text:list>
<text:list-item><text:p>Bullet 1</text:p></text:list-item>
<text:list-item><text:p>Bullet 2</text:p></text:list-item>
</text:list>
</draw:text-box>
</draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const odp = makeMinimalOdp(xml);
    const result = await convertOdpToPdf(odp, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.bytes.length).toBeGreaterThan(0);
      expect(result.output.stats.slideCount).toBe(1);
      expect(result.output.stats.pageCount).toBe(1);
    }
  });

  it("returns error for non-ODP input", async () => {
    const result = await convertOdpToPdf(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Not an ODP");
  });

  it("returns error when content.xml missing", async () => {
    const zip = buildStoreZip([{ name: "other.xml", data: new TextEncoder().encode("test") }]);
    const result = await convertOdpToPdf(zip, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("content.xml");
  });

  it("returns error for empty presentation", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw">
<office:body><office:presentation></office:presentation></office:body>
</office:document-content>`;
    const odp = makeMinimalOdp(xml);
    const result = await convertOdpToPdf(odp, DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No slides");
  });

  it("respects page size option", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="s1"><draw:text-box><text:p>Title</text:p></draw:text-box></draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const odp = makeMinimalOdp(xml);
    const result = await convertOdpToPdf(odp, { ...DEFAULT_OPTIONS, pageSize: "4:3" });
    expect(result.ok).toBe(true);
  });

  it("uses dark background when requested", async () => {
    const xml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="s1"><draw:text-box><text:p>Title</text:p></draw:text-box></draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const odp = makeMinimalOdp(xml);
    const result = await convertOdpToPdf(odp, { ...DEFAULT_OPTIONS, background: "dark" });
    expect(result.ok).toBe(true);
  });

  it("extracts metadata from meta.xml", async () => {
    const contentXml = `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:office" xmlns:draw="urn:draw" xmlns:text="urn:text">
<office:body><office:presentation>
<draw:page draw:name="s1"><draw:text-box><text:p>Title</text:p></draw:text-box></draw:page>
</office:presentation></office:body>
</office:document-content>`;
    const metaXml = `<?xml version="1.0"?>
<office:document-meta xmlns:office="urn:office" xmlns:dc="urn:dc">
<office:meta><dc:title>My Deck</dc:title><dc:creator>Alice</dc:creator></office:meta>
</office:document-meta>`;
    const odp = makeMinimalOdp(contentXml, metaXml);
    const result = await convertOdpToPdf(odp, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("My Deck");
      expect(result.output.metadata.author).toBe("Alice");
    }
  });
});

// ===== Utilities =====

describe("odp-to-pdf-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("odp-to-pdf-converter history", () => {
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
      fileName: "test.odp", odpBytes: 1000, pdfBytes: 2000,
      slideCount: 5, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.odp");
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
      fileName: "test.odp", odpBytes: 1000, pdfBytes: 2000,
      slideCount: 5, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("odp-to-pdf-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/odp-to-pdf-converter" } };
    const url = buildShareUrl({ pageSize: "16:9", fontSize: 14, titleFontSize: 24, margin: 40, background: "white" });
    expect(url).toContain("page=16%3A9");
    expect(url).toContain("fs=14");
    expect(url).toContain("tfs=24");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#page=4%3A3&fs=12&tfs=20&margin=50&bg=dark");
    expect(parsed).toEqual({
      pageSize: "4:3", fontSize: 12, titleFontSize: 20, margin: 50, background: "dark",
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("falls back to 16:9 for invalid page size", () => {
    const parsed = parseShareUrl("#page=invalid");
    expect(parsed?.pageSize).toBe("16:9");
  });
  it("falls back to white for invalid background", () => {
    const parsed = parseShareUrl("#page=16:9&bg=invalid");
    expect(parsed?.background).toBe("white");
  });
});
