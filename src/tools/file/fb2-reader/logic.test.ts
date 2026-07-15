import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseFb2, isFb2Xml, parseMetadata, parseAuthor, extractChapters,
  elementToHtml, extractImages, resolveImages, searchBook, readingProgress,
  formatBytes, loadHistory, saveToHistory, clearHistory,
  loadBookmarks, saveBookmark, getBookmark, clearBookmarks,
  buildShareUrl, parseShareUrl,
  type Fb2Book,
} from "./logic";

// Helpers

function wrapFb2(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
${inner}
</FictionBook>`;
}

function buildSimpleBook(): string {
  return wrapFb2(`<description>
  <title-info>
    <genre>prose_classic</genre>
    <author>
      <first-name>Leo</first-name>
      <last-name>Tolstoy</last-name>
    </author>
    <book-title>War and Peace</book-title>
    <annotation>An epic novel.</annotation>
    <lang>en</lang>
  </title-info>
</description>
<body>
  <section id="ch1">
    <title>Chapter 1</title>
    <p>It was the year 1805.</p>
    <p>The Russian nobility gathered in St. Petersburg.</p>
  </section>
  <section id="ch2">
    <title>Chapter 2</title>
    <p>Pierre Bezukhov inherited a fortune.</p>
  </section>
</body>`);
}

function buildNestedBook(): string {
  return wrapFb2(`<description>
  <title-info>
    <genre>sci_fi</genre>
    <author><first-name>Isaac</first-name><last-name>Asimov</last-name></author>
    <book-title>Foundation</book-title>
    <lang>en</lang>
  </title-info>
</description>
<body>
  <section id="part1">
    <title>Part One</title>
    <section id="ch1">
      <title>Chapter 1</title>
      <p>Hari Seldon psychohistory.</p>
    </section>
    <section id="ch2">
      <title>Chapter 2</title>
      <p>The Encyclopedia Galactica.</p>
    </section>
  </section>
</body>`);
}

function buildBookWithImage(): string {
  return wrapFb2(`<description>
  <title-info>
    <author><first-name>Test</first-name><last-name>Author</last-name></author>
    <book-title>Image Test</book-title>
    <lang>en</lang>
  </title-info>
</description>
<body>
  <section>
    <title>Image Section</title>
    <p>Here is an image:</p>
    <image l:href="#cover.png"/>
  </section>
</body>
<binary id="cover.png" content-type="image/png">iVBORw0KGgo==</binary>`);
}

// ===== isFb2Xml =====

describe("fb2-reader isFb2Xml", () => {
  it("returns true for FictionBook root", () => {
    expect(isFb2Xml('<?xml version="1.0"?>\n<FictionBook xmlns="...">')).toBe(true);
  });
  it("returns true with leading whitespace", () => {
    expect(isFb2Xml('  \n<FictionBook>')).toBe(true);
  });
  it("returns false for non-FB2 XML", () => {
    expect(isFb2Xml('<?xml version="1.0"?>\n<html>')).toBe(false);
  });
  it("returns false for empty", () => {
    expect(isFb2Xml("")).toBe(false);
  });
});

// ===== parseAuthor =====

describe("fb2-reader parseAuthor", () => {
  it("parses first + last name", () => {
    const xml = `<author><first-name>Leo</first-name><last-name>Tolstoy</last-name></author>`;
    const doc = { documentElement: null, querySelector: () => null, querySelectorAll: () => [] } as never;
    void doc;
    // Use parseFb2 to extract author
    const bookXml = wrapFb2(`<description><title-info><author><first-name>Leo</first-name><last-name>Tolstoy</last-name></author><book-title>Test</book-title></title-info></description><body><section><title><p>S</p></title><p>text</p></section></body>`);
    const book = parseFb2(bookXml, "test.fb2", 100);
    expect(book.metadata.authors[0]!.firstName).toBe("Leo");
    expect(book.metadata.authors[0]!.lastName).toBe("Tolstoy");
    expect(book.metadata.authors[0]!.fullName).toBe("Leo Tolstoy");
  });
  it("handles nickname only", () => {
    const bookXml = wrapFb2(`<description><title-info><author><nickname>Twain</nickname></author><book-title>Test</book-title></title-info></description><body><section><title><p>S</p></title><p>text</p></section></body>`);
    const book = parseFb2(bookXml, "test.fb2", 100);
    expect(book.metadata.authors[0]!.fullName).toBe("Twain");
  });
});

// ===== parseMetadata =====

describe("fb2-reader parseMetadata", () => {
  it("extracts title, author, genre, lang", () => {
    const book = parseFb2(buildSimpleBook(), "warandpeace.fb2", 1024);
    expect(book.metadata.title).toBe("War and Peace");
    expect(book.metadata.authors[0]!.lastName).toBe("Tolstoy");
    expect(book.metadata.genres).toContain("prose_classic");
    expect(book.metadata.lang).toBe("en");
    expect(book.metadata.annotation).toContain("epic novel");
  });

  it("handles missing description gracefully", () => {
    const xml = wrapFb2(`<body><section><title><p>S</p></title><p>text</p></section></body>`);
    const book = parseFb2(xml, "test.fb2", 100);
    expect(book.metadata.title).toBe("(untitled)");
    expect(book.metadata.authors).toEqual([]);
  });

  it("extracts multiple authors", () => {
    const xml = wrapFb2(`<description><title-info>
      <author><first-name>A</first-name><last-name>B</last-name></author>
      <author><first-name>C</first-name><last-name>D</last-name></author>
      <book-title>Multi</book-title>
    </title-info></description><body><section><title><p>S</p></title><p>text</p></section></body>`);
    const book = parseFb2(xml, "test.fb2", 100);
    expect(book.metadata.authors.length).toBe(2);
  });

  it("extracts multiple genres", () => {
    const xml = wrapFb2(`<description><title-info>
      <genre>prose</genre>
      <genre>adventure</genre>
      <book-title>Multi Genre</book-title>
    </title-info></description><body><section><title><p>S</p></title><p>text</p></section></body>`);
    const book = parseFb2(xml, "test.fb2", 100);
    expect(book.metadata.genres.length).toBe(2);
  });
});

// ===== extractChapters =====

describe("fb2-reader extractChapters", () => {
  it("extracts top-level sections", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    expect(book.chapters.length).toBe(2);
    expect(book.chapters[0]!.title).toBe("Chapter 1");
    expect(book.chapters[1]!.title).toBe("Chapter 2");
  });
  it("extracts nested sections recursively", () => {
    const book = parseFb2(buildNestedBook(), "test.fb2", 100);
    expect(book.chapters.length).toBe(3); // Part One + ch1 + ch2
    expect(book.chapters[0]!.title).toBe("Part One");
    expect(book.chapters[1]!.title).toBe("Chapter 1");
    expect(book.chapters[2]!.title).toBe("Chapter 2");
  });
  it("chapter HTML contains paragraphs", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("<p>It was the year 1805.</p>");
  });
  it("chapter text contains content for search", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    expect(book.chapters[0]!.text).toContain("1805");
    expect(book.chapters[1]!.text).toContain("Pierre");
  });
  it("handles body with no sections (renders whole body)", () => {
    const xml = wrapFb2(`<body><p>Just a paragraph.</p></body>`);
    const book = parseFb2(xml, "test.fb2", 100);
    expect(book.chapters.length).toBe(1);
    expect(book.chapters[0]!.html).toContain("Just a paragraph.");
  });
});

// ===== elementToHtml =====

describe("fb2-reader elementToHtml", () => {
  it("converts <p> to <p>", () => {
    const xml = `<p>hello</p>`;
    // Use parseFb2 to parse the XML and find the element
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title>${xml}</section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("<p>hello</p>");
  });
  it("converts <strong> to <strong>", () => {
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title><p><strong>bold</strong> text</p></section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("<strong>bold</strong>");
  });
  it("converts <emphasis> to <em>", () => {
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title><p><emphasis>italic</emphasis></p></section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("<em>italic</em>");
  });
  it("converts <empty-line/> to a div", () => {
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title><p>before</p><empty-line/><p>after</p></section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("fb2-empty-line");
  });
  it("converts <a> to <a>", () => {
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title><p><a l:href="#note1">link</a></p></section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain('<a href="#note1">link</a>');
  });
});

// ===== Images =====

describe("fb2-reader images", () => {
  it("extracts binary images", () => {
    const book = parseFb2(buildBookWithImage(), "test.fb2", 100);
    expect(Object.keys(book.images)).toContain("cover.png");
    expect(book.images["cover.png"]).toContain("data:image/png;base64,");
  });
  it("resolves image references in chapter HTML", () => {
    const book = parseFb2(buildBookWithImage(), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain('src="data:image/png;base64,iVBORw0KGgo==');
  });
  it("handles missing image references gracefully", () => {
    const book = parseFb2(wrapFb2(`<body><section><title><p>T</p></title><image l:href="#missing"/></section></body>`), "test.fb2", 100);
    expect(book.chapters[0]!.html).toContain("missing image");
  });
});

// ===== searchBook =====

describe("fb2-reader searchBook", () => {
  it("finds matches across chapters", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    const results = searchBook(book, "Pierre");
    expect(results.length).toBe(1);
    expect(results[0]!.chapterTitle).toBe("Chapter 2");
  });
  it("returns empty for empty query", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    expect(searchBook(book, "")).toEqual([]);
  });
  it("search is case-insensitive", () => {
    const book = parseFb2(buildSimpleBook(), "test.fb2", 100);
    expect(searchBook(book, "PIERRE").length).toBe(1);
  });
});

// ===== readingProgress =====

describe("fb2-reader readingProgress", () => {
  it("returns 0 for empty book", () => {
    expect(readingProgress(0, 0)).toBe(0);
  });
  it("returns percentage", () => {
    expect(readingProgress(0, 4)).toBe(25);
    expect(readingProgress(1, 4)).toBe(50);
    expect(readingProgress(3, 4)).toBe(100);
  });
});

// ===== Empty file / errors =====

describe("fb2-reader error handling", () => {
  it("throws on empty XML", () => {
    expect(() => parseFb2("", "test.fb2", 0)).toThrow(/empty or could not be parsed/);
  });
  it("throws when body is missing", () => {
    const xml = wrapFb2(`<description><title-info><book-title>NoBody</book-title></title-info></description>`);
    expect(() => parseFb2(xml, "test.fb2", 100)).toThrow(/no <body>/);
  });
});

// ===== Utilities =====

describe("fb2-reader formatBytes", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== Bookmarks =====

describe("fb2-reader bookmarks", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
    clearBookmarks();
  });

  it("starts empty", () => {
    expect(loadBookmarks()).toEqual([]);
  });
  it("saves and retrieves bookmark", () => {
    saveBookmark({
      fileName: "test.fb2",
      title: "Test Book",
      author: "Test Author",
      chapterIndex: 3,
      totalChapters: 10,
      savedAt: new Date().toISOString(),
    });
    const bm = getBookmark("test.fb2");
    expect(bm).not.toBeNull();
    expect(bm!.chapterIndex).toBe(3);
  });
  it("replaces existing bookmark for same file", () => {
    saveBookmark({ fileName: "test.fb2", title: "T", author: "A", chapterIndex: 1, totalChapters: 5, savedAt: "" });
    saveBookmark({ fileName: "test.fb2", title: "T", author: "A", chapterIndex: 3, totalChapters: 5, savedAt: "" });
    const bms = loadBookmarks();
    expect(bms.length).toBe(1);
    expect(bms[0]!.chapterIndex).toBe(3);
  });
  it("clears bookmarks", () => {
    saveBookmark({ fileName: "x.fb2", title: "", author: "", chapterIndex: 0, totalChapters: 0, savedAt: "" });
    clearBookmarks();
    expect(loadBookmarks()).toEqual([]);
  });
});

// ===== History =====

describe("fb2-reader history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
    clearHistory();
  });

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.fb2",
      title: "Test Book",
      author: "Test Author",
      chapterCount: 10,
      fileSize: 1024,
      openedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.title).toBe("Test Book");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `book-${i}.fb2`, title: `Book ${i}`, author: "A",
        chapterCount: 1, fileSize: 10, openedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.fb2", title: "", author: "", chapterCount: 0,
      fileSize: 0, openedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("fb2-reader share URL", () => {
  const origWindow = (globalThis as any).window;
  beforeEach(() => {
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/fb2-reader" } };
  });
  afterEach(() => {
    (globalThis as any).window = origWindow;
  });

  it("builds URL with reader settings", () => {
    const url = buildShareUrl({ fontSize: "lg", theme: "dark" });
    expect(url).toContain("size=lg");
    expect(url).toContain("theme=dark");
  });
  it("parses URL back", () => {
    const opts = parseShareUrl("#size=md&theme=light");
    expect(opts).not.toBeNull();
    expect(opts!.fontSize).toBe("md");
    expect(opts!.theme).toBe("light");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("not-a-hash")).toBeNull();
  });
});
