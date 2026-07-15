import { describe, it, expect, beforeEach } from "vitest";
import {
  parseZipEntries, decompressEntry, decodeUtf8,
  joinPath, normalizePathStr, splitAnchor, dirname,
  parseAttributes, extractTag, extractAllTags, stripXmlTags,
  parseOpf, parseContainerXml, parseNcx, parseNav,
  parseEpub, searchBook, readingProgress, extractBody, sanitizeChapterHtml,
  loadBookmarks, saveBookmark, getBookmark, clearBookmarks,
  loadHistory, saveToHistory, clearHistory,
  formatBytes, buildShareUrl, parseShareUrl,
} from "./logic";

// ===== Helpers =====

/** Build a minimal STORE-method ZIP for testing. */
function buildStoreZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const fileEntries = files.map((f) => ({
    name: f.name,
    data: enc.encode(f.content),
  }));

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
    lv.setUint16(8, 0, true); // STORE
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
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

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

/** Build a minimal valid EPUB 2 for testing. */
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
    <dc:publisher>Test Publisher</dc:publisher>
    <dc:description>A test ebook.</dc:description>
    <dc:rights>Public domain</dc:rights>
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
<body><h1>Chapter 1 — The Beginning</h1><p>It was the best of times.</p></body>
</html>`;

  const ch2 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body><h1>Chapter 2 — The End</h1><p>It was the worst of times.</p></body>
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

// ===== Path helpers =====

describe("epub joinPath", () => {
  it("joins base + relative", () => {
    expect(joinPath("OEBPS/content.opf", "chapter1.xhtml")).toBe("OEBPS/chapter1.xhtml");
  });
  it("handles ..", () => {
    expect(joinPath("OEBPS/sub/opf.opf", "../chapter1.xhtml")).toBe("OEBPS/chapter1.xhtml");
  });
  it("handles absolute path", () => {
    expect(joinPath("OEBPS/content.opf", "/chapter1.xhtml")).toBe("chapter1.xhtml");
  });
  it("handles empty base", () => {
    expect(joinPath("", "chapter1.xhtml")).toBe("chapter1.xhtml");
  });
});

describe("epub normalizePathStr", () => {
  it("collapses double slashes", () => {
    expect(normalizePathStr("a//b///c")).toBe("a/b/c");
  });
  it("strips leading slash", () => {
    expect(normalizePathStr("/a/b")).toBe("a/b");
  });
});

describe("epub splitAnchor", () => {
  it("splits path and anchor", () => {
    expect(splitAnchor("chapter1.xhtml#sec1")).toEqual({ path: "chapter1.xhtml", anchor: "sec1" });
  });
  it("returns path only when no anchor", () => {
    expect(splitAnchor("chapter1.xhtml")).toEqual({ path: "chapter1.xhtml" });
  });
});

describe("epub dirname", () => {
  it("returns directory portion", () => {
    expect(dirname("OEBPS/chapter1.xhtml")).toBe("OEBPS");
  });
  it("returns empty for bare filename", () => {
    expect(dirname("chapter1.xhtml")).toBe("");
  });
});

// ===== XML helpers =====

describe("epub parseAttributes", () => {
  it("parses attributes", () => {
    expect(parseAttributes('<item id="ch1" href="ch1.xhtml" media-type="text/html"/>')).toEqual({
      id: "ch1", href: "ch1.xhtml", "media-type": "text/html",
    });
  });
  it("returns empty for no attributes", () => {
    expect(parseAttributes("<item/>")).toEqual({});
  });
});

describe("epub extractTag", () => {
  it("extracts tag content", () => {
    expect(extractTag("<a><b>hello</b></a>", "b")).toBe("hello");
  });
  it("returns empty for missing tag", () => {
    expect(extractTag("<a>foo</a>", "b")).toBe("");
  });
  it("handles tags with attributes", () => {
    expect(extractTag('<p class="x">text</p>', "p")).toBe("text");
  });
});

describe("epub extractAllTags", () => {
  it("extracts all occurrences", () => {
    expect(extractAllTags("<ul><li>a</li><li>b</li></ul>", "li")).toEqual(["a", "b"]);
  });
});

describe("epub stripXmlTags", () => {
  it("strips tags and decodes entities", () => {
    expect(stripXmlTags('<p>Hello &amp; <b>world</b></p>')).toBe("Hello & world");
  });
  it("collapses whitespace", () => {
    expect(stripXmlTags("<p>  hello\n  world  </p>")).toBe("hello world");
  });
});

// ===== OPF parsing =====

describe("epub parseOpf", () => {
  const opfXml = `<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>My Book</dc:title>
    <dc:creator>John Doe</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bid">id-001</dc:identifier>
    <dc:publisher>Pub</dc:publisher>
    <dc:description>Desc</dc:description>
    <dc:rights>CC</dc:rights>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2" linear="no"/>
  </spine>
</package>`;

  it("parses metadata", () => {
    const opf = parseOpf(opfXml, "OEBPS/content.opf");
    expect(opf.metadata.title).toBe("My Book");
    expect(opf.metadata.author).toBe("John Doe");
    expect(opf.metadata.language).toBe("en");
    expect(opf.metadata.identifier).toBe("id-001");
    expect(opf.metadata.publisher).toBe("Pub");
    expect(opf.metadata.description).toBe("Desc");
    expect(opf.metadata.rights).toBe("CC");
  });
  it("parses manifest items", () => {
    const opf = parseOpf(opfXml, "OEBPS/content.opf");
    expect(opf.manifest.size).toBe(3);
    expect(opf.manifest.get("ch1")?.href).toBe("chapter1.xhtml");
    expect(opf.manifest.get("ch1")?.mediaType).toBe("application/xhtml+xml");
  });
  it("parses spine", () => {
    const opf = parseOpf(opfXml, "OEBPS/content.opf");
    expect(opf.spine).toHaveLength(2);
    expect(opf.spine[0].idref).toBe("ch1");
    expect(opf.spine[0].linear).toBe(true);
    expect(opf.spine[1].linear).toBe(false);
  });
});

// ===== Container.xml parsing =====

describe("epub parseContainerXml", () => {
  it("extracts OPF path", () => {
    const xml = `<?xml version="1.0"?>
<container version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    expect(parseContainerXml(xml)).toBe("OEBPS/content.opf");
  });
  it("returns null when no rootfile", () => {
    expect(parseContainerXml("<container></container>")).toBeNull();
  });
});

// ===== NCX parsing =====

describe("epub parseNcx", () => {
  it("extracts TOC entries", () => {
    const ncx = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint><navLabel><text>Chapter 1</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint><navLabel><text>Chapter 2</text></navLabel><content src="chapter2.xhtml#sec1"/></navPoint>
  </navMap>
</ncx>`;
    const toc = parseNcx(ncx, "OEBPS/content.opf");
    expect(toc).toHaveLength(2);
    expect(toc[0].title).toBe("Chapter 1");
    expect(toc[0].absolutePath).toBe("OEBPS/chapter1.xhtml");
    expect(toc[1].anchor).toBe("sec1");
    expect(toc[1].absolutePath).toBe("OEBPS/chapter2.xhtml");
  });
});

// ===== NAV parsing =====

describe("epub parseNav", () => {
  it("extracts TOC entries", () => {
    const nav = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body>
<nav epub:type="toc">
<ol>
<li><a href="chapter1.xhtml">Chapter 1</a></li>
<li><a href="chapter2.xhtml">Chapter 2</a></li>
</ol>
</nav>
</body>
</html>`;
    const toc = parseNav(nav, "OEBPS/content.opf");
    expect(toc).toHaveLength(2);
    expect(toc[0].title).toBe("Chapter 1");
    expect(toc[0].absolutePath).toBe("OEBPS/chapter1.xhtml");
  });
});

// ===== Top-level EPUB parsing =====

describe("epub parseEpub", () => {
  it("parses a minimal EPUB 2", async () => {
    const bytes = buildMinimalEpub();
    const book = await parseEpub(bytes, "test.epub", bytes.length);
    expect(book.metadata.title).toBe("Test Book");
    expect(book.metadata.author).toBe("Jane Author");
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0].title).toBe("Chapter 1");
    expect(book.chapters[0].absolutePath).toBe("OEBPS/chapter1.xhtml");
    expect(book.toc).toHaveLength(2);
    expect(book.toc[0].title).toBe("Chapter 1");
  });
  it("throws on missing container.xml", async () => {
    const bad = buildStoreZip([{ name: "file.txt", content: "not epub" }]);
    await expect(parseEpub(bad, "bad.epub", bad.length)).rejects.toThrow();
  });
});

// ===== ZIP parsing =====

describe("epub parseZipEntries", () => {
  it("parses entries", () => {
    const zip = buildStoreZip([{ name: "a.txt", content: "hello" }]);
    const entries = parseZipEntries(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("a.txt");
    expect(entries[0].compressionMethod).toBe(0);
  });
  it("returns empty for non-ZIP", () => {
    expect(parseZipEntries(new Uint8Array([0, 1, 2, 3]))).toEqual([]);
  });
});

describe("epub decompressEntry (STORE)", () => {
  it("returns STORE data as-is", async () => {
    const zip = buildStoreZip([{ name: "a.txt", content: "hello world" }]);
    const entries = parseZipEntries(zip);
    const out = await decompressEntry(entries[0]);
    expect(decodeUtf8(out)).toBe("hello world");
  });
});

// ===== Search =====

describe("epub searchBook", () => {
  it("finds matches across chapters", async () => {
    const bytes = buildMinimalEpub();
    const book = await parseEpub(bytes, "test.epub", bytes.length);
    const results = searchBook(book, "best");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chapterIndex).toBe(0);
    expect(results[0].snippet.toLowerCase()).toContain("best");
  });
  it("returns empty for no matches", async () => {
    const bytes = buildMinimalEpub();
    const book = await parseEpub(bytes, "test.epub", bytes.length);
    expect(searchBook(book, "nonexistentword12345")).toEqual([]);
  });
  it("returns empty for empty query", async () => {
    const bytes = buildMinimalEpub();
    const book = await parseEpub(bytes, "test.epub", bytes.length);
    expect(searchBook(book, "")).toEqual([]);
  });
});

// ===== Reading progress =====

describe("epub readingProgress", () => {
  it("computes progress percentage", () => {
    expect(readingProgress(0, 10)).toBe(10);
    expect(readingProgress(9, 10)).toBe(100);
  });
  it("returns 0 for no chapters", () => {
    expect(readingProgress(0, 0)).toBe(0);
  });
});

// ===== HTML helpers =====

describe("epub extractBody", () => {
  it("extracts body content", () => {
    expect(extractBody("<html><head><title>x</title></head><body><p>hi</p></body></html>")).toBe("<p>hi</p>");
  });
  it("returns input when no body", () => {
    expect(extractBody("<p>hi</p>")).toBe("<p>hi</p>");
  });
});

describe("epub sanitizeChapterHtml", () => {
  it("removes scripts", () => {
    const html = '<p>hi</p><script>alert(1)</script><p>bye</p>';
    expect(sanitizeChapterHtml(html)).toBe('<p>hi</p><p>bye</p>');
  });
  it("removes styles", () => {
    const html = '<style>body{color:red}</style><p>hi</p>';
    expect(sanitizeChapterHtml(html)).toBe('<p>hi</p>');
  });
  it("removes event handlers", () => {
    expect(sanitizeChapterHtml('<p onclick="x()">hi</p>')).toBe('<p>hi</p>');
  });
  it("removes javascript: URLs", () => {
    expect(sanitizeChapterHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="alert(1)">x</a>');
  });
});

// ===== Bookmarks =====

describe("epub bookmarks (localStorage)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("saves and loads bookmarks", () => {
    saveBookmark({ fileName: "book.epub", title: "Test", chapterIndex: 2, totalChapters: 10, savedAt: new Date().toISOString() });
    expect(loadBookmarks()).toHaveLength(1);
  });
  it("replaces bookmark for same file", () => {
    saveBookmark({ fileName: "book.epub", title: "T1", chapterIndex: 1, totalChapters: 10, savedAt: "2026-01-01" });
    saveBookmark({ fileName: "book.epub", title: "T2", chapterIndex: 5, totalChapters: 10, savedAt: "2026-01-02" });
    const marks = loadBookmarks();
    expect(marks).toHaveLength(1);
    expect(marks[0].chapterIndex).toBe(5);
  });
  it("gets bookmark by filename", () => {
    saveBookmark({ fileName: "book.epub", title: "T", chapterIndex: 3, totalChapters: 10, savedAt: "2026-01-01" });
    expect(getBookmark("book.epub")?.chapterIndex).toBe(3);
  });
  it("returns null for unknown file", () => {
    expect(getBookmark("unknown.epub")).toBeNull();
  });
  it("clears bookmarks", () => {
    saveBookmark({ fileName: "b.epub", title: "T", chapterIndex: 0, totalChapters: 5, savedAt: "2026-01-01" });
    clearBookmarks();
    expect(loadBookmarks()).toEqual([]);
  });
});

// ===== History =====

describe("epub history (localStorage)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("saves and loads entries", () => {
    saveToHistory({ fileName: "book.epub", title: "T", author: "A", chapterCount: 5, fileSize: 1000, openedAt: new Date().toISOString() });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears history", () => {
    saveToHistory({ fileName: "b.epub", title: "T", author: "A", chapterCount: 5, fileSize: 1000, openedAt: new Date().toISOString() });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== formatBytes + share URL =====

describe("epub formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("epub share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/epub-reader",
    };
  });

  it("builds share URL", () => {
    const url = buildShareUrl("lg", "serif", "dark");
    expect(url).toContain("size=lg");
    expect(url).toContain("font=serif");
    expect(url).toContain("theme=dark");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("xl", "mono", "light");
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.fontSize).toBe("xl");
    expect(parsed?.fontFamily).toBe("mono");
    expect(parsed?.theme).toBe("light");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});
