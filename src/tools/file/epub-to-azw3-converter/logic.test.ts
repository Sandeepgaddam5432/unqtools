import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  chapterToText,
  chaptersToPageTexts,
  countWords,
  convertEpubToAzw3,
  escapeHtml,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EpubToAzw3Options,
} from "./logic";
import { parseEpub } from "../epub-reader/logic";

// ===== ZIP helpers =====

function crc32simple(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoreZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const fileEntries = files.map((f) => ({ name: f.name, data: enc.encode(f.content) }));
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of fileEntries) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32simple(f.data);
    const size = f.data.length;
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
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
    ch.set(nameBytes, 46);
    parts.push(lh, f.data);
    central.push(ch);
    offset += lh.length + f.data.length;
  }
  const centralSize = central.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, fileEntries.length, true);
  ev.setUint16(10, fileEntries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  const all = [...parts, ...central, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function buildMinimalEpub(): Uint8Array {
  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  const opf = `<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Jane Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">test-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;
  const ch1 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Chapter 1</h1><p>It was the best of times.</p></body>
</html>`;
  const ch2 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body><h1>Chapter 2</h1><p>It was the worst of times.</p></body>
</html>`;
  const ncx = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint><navLabel><text>Chapter 1</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint><navLabel><text>Chapter 2</text></navLabel><content src="chapter2.xhtml"/></navPoint>
  </navMap>
</ncx>`;
  return buildStoreZip([
    { name: "META-INF/container.xml", content: container },
    { name: "OEBPS/content.opf", content: opf },
    { name: "OEBPS/chapter1.xhtml", content: ch1 },
    { name: "OEBPS/chapter2.xhtml", content: ch2 },
    { name: "OEBPS/toc.ncx", content: ncx },
  ]);
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

// ===== chapterToText =====

describe("epub-to-azw3-converter chapterToText", () => {
  it("extracts plain text from a chapter", async () => {
    const book = await parseEpub(buildMinimalEpub(), "test.epub", 0);
    const text = chapterToText(book.chapters[0]!);
    expect(text).toContain("Chapter 1");
    expect(text).toContain("best of times");
  });
  it("strips HTML tags", async () => {
    const book = await parseEpub(buildMinimalEpub(), "test.epub", 0);
    const text = chapterToText(book.chapters[0]!);
    expect(text).not.toContain("<h1>");
    expect(text).not.toContain("<p>");
  });
});

// ===== chaptersToPageTexts =====

describe("epub-to-azw3-converter chaptersToPageTexts", () => {
  it("returns one text per chapter", async () => {
    const book = await parseEpub(buildMinimalEpub(), "test.epub", 0);
    const texts = chaptersToPageTexts(book.chapters);
    expect(texts.length).toBe(2);
  });
  it("includes chapter title as first line", async () => {
    const book = await parseEpub(buildMinimalEpub(), "test.epub", 0);
    const texts = chaptersToPageTexts(book.chapters);
    expect(texts[0]!.split("\n")[0]).toContain("Chapter 1");
  });
});

// ===== countWords =====

describe("epub-to-azw3-converter countWords", () => {
  it("counts words", () => {
    expect(countWords("Hello world")).toBe(2);
  });
  it("counts 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
});

// ===== convertEpubToAzw3 =====

describe("epub-to-azw3-converter convertEpubToAzw3", () => {
  it("converts a valid EPUB to AZW3", async () => {
    const epubBytes = buildMinimalEpub();
    const result = await convertEpubToAzw3(epubBytes, DEFAULT_OPTIONS, "out.azw3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(100);
      expect(result.output.fileName).toBe("out.azw3");
      expect(result.output.chapterCount).toBe(2);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.recordCount).toBeGreaterThan(0);
      expect(result.output.azw3Bytes).toBeGreaterThan(100);
    }
  });
  it("uses EPUB metadata when options are default", async () => {
    const epubBytes = buildMinimalEpub();
    const result = await convertEpubToAzw3(epubBytes, DEFAULT_OPTIONS, "out.azw3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Test Book");
      expect(result.output.metadata.author).toBe("Jane Author");
    }
  });
  it("overrides metadata when custom options are set", async () => {
    const epubBytes = buildMinimalEpub();
    const opts: EpubToAzw3Options = {
      ...DEFAULT_OPTIONS,
      title: "Custom Title",
      author: "Custom Author",
    };
    const result = await convertEpubToAzw3(epubBytes, opts, "out.azw3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.metadata.title).toBe("Custom Title");
      expect(result.output.metadata.author).toBe("Custom Author");
    }
  });
  it("fails on non-EPUB input", async () => {
    const result = await convertEpubToAzw3(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/parse EPUB/);
  });
  it("includes preview text from first chapter", async () => {
    const epubBytes = buildMinimalEpub();
    const result = await convertEpubToAzw3(epubBytes, DEFAULT_OPTIONS, "out.azw3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.previewText).toContain("Chapter 1");
    }
  });
  it("supports UTF-8 encoding", async () => {
    const epubBytes = buildMinimalEpub();
    const opts: EpubToAzw3Options = { ...DEFAULT_OPTIONS, encoding: "utf-8" };
    const result = await convertEpubToAzw3(epubBytes, opts, "out.azw3");
    expect(result.ok).toBe(true);
  });
  it("supports CP1252 encoding", async () => {
    const epubBytes = buildMinimalEpub();
    const opts: EpubToAzw3Options = { ...DEFAULT_OPTIONS, encoding: "cp1252" };
    const result = await convertEpubToAzw3(epubBytes, opts, "out.azw3");
    expect(result.ok).toBe(true);
  });
  it("supports custom cover subtitle", async () => {
    const epubBytes = buildMinimalEpub();
    const opts: EpubToAzw3Options = {
      ...DEFAULT_OPTIONS,
      coverSubtitle: "Custom subtitle text",
    };
    const result = await convertEpubToAzw3(epubBytes, opts, "out.azw3");
    expect(result.ok).toBe(true);
  });
});

// ===== escapeHtml =====

describe("epub-to-azw3-converter escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
  it("escapes angle brackets", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });
});

// ===== formatBytes =====

describe("epub-to-azw3-converter formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("epub-to-azw3-converter history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.epub",
      epubBytes: 1000,
      azw3Bytes: 2000,
      chapterCount: 5,
      wordCount: 200,
      recordCount: 7,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.epub");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.epub`,
        epubBytes: i,
        azw3Bytes: i * 2,
        chapterCount: 1,
        wordCount: 1,
        recordCount: 1,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.epub",
      epubBytes: 1,
      azw3Bytes: 2,
      chapterCount: 1,
      wordCount: 1,
      recordCount: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("epub-to-azw3-converter shareUrl", () => {
  it("builds a URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/epub-to-azw3-converter" },
    };
    const opts: EpubToAzw3Options = {
      ...DEFAULT_OPTIONS,
      title: "My Book",
      author: "Auth",
      encoding: "cp1252",
      chapterMode: "heading",
      language: "fr",
      coverSubtitle: "Custom subtitle",
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("mode=heading");
    expect(url).toContain("enc=cp1252");
    expect(url).toContain("title=My+Book");
    expect(url).toContain("author=Auth");
    expect(url).toContain("lang=fr");
    expect(url).toContain("subtitle=Custom+subtitle");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#mode=heading&enc=cp1252&title=Test&author=Auth&lang=fr&subtitle=Sub";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.chapterMode).toBe("heading");
    expect(opts!.encoding).toBe("cp1252");
    expect(opts!.title).toBe("Test");
    expect(opts!.author).toBe("Auth");
    expect(opts!.language).toBe("fr");
    expect(opts!.coverSubtitle).toBe("Sub");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("defaults to utf-8 for unknown encoding", () => {
    const opts = parseShareUrl("#enc=invalid");
    expect(opts!.encoding).toBe("utf-8");
  });
});

// ===== DEFAULT_OPTIONS =====

describe("epub-to-azw3-converter DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.encoding).toBe("utf-8");
    expect(DEFAULT_OPTIONS.chapterMode).toBe("page");
    expect(DEFAULT_OPTIONS.language).toBe("en");
    expect(DEFAULT_OPTIONS.coverSubtitle).toContain("UnQTools");
  });
});
