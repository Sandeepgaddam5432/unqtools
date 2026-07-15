import { describe, it, expect, beforeEach } from "vitest";
import {
  parseZipEntries, detectImageMime, naturalCompare,
  extractPages, buildInfo,
  buildNavigationState, nextPage, prevPage, readingProgress, pagesForMode,
  createZipFromPages,
  loadBookmarks, saveBookmark, getBookmark, removeBookmark, clearBookmarks,
  loadHistory, saveToHistory, clearHistory,
  formatBytes, buildShareUrl, parseShareUrl, revokePages,
  type ReadingMode, type FitMode,
} from "./logic";

// ===== Helpers =====

/** Build a minimal STORE-method ZIP with one text entry. */
function buildStoreZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const enc = new TextEncoder();
  let offset = 0;

  for (const f of files) {
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
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
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

// ===== detectImageMime =====

describe("cbz detectImageMime", () => {
  it("detects JPEG", () => {
    expect(detectImageMime("page1.jpg")).toBe("image/jpeg");
    expect(detectImageMime("page1.JPEG")).toBe("image/jpeg");
  });
  it("detects PNG", () => {
    expect(detectImageMime("p.png")).toBe("image/png");
  });
  it("detects WebP", () => {
    expect(detectImageMime("p.webp")).toBe("image/webp");
  });
  it("detects GIF", () => {
    expect(detectImageMime("p.gif")).toBe("image/gif");
  });
  it("detects BMP", () => {
    expect(detectImageMime("p.bmp")).toBe("image/bmp");
  });
  it("returns null for non-image", () => {
    expect(detectImageMime("readme.txt")).toBeNull();
    expect(detectImageMime("meta.json")).toBeNull();
  });
});

// ===== naturalCompare =====

describe("cbz naturalCompare", () => {
  it("sorts numeric strings naturally", () => {
    const names = ["page10.jpg", "page2.jpg", "page1.jpg"];
    expect(names.sort(naturalCompare)).toEqual(["page1.jpg", "page2.jpg", "page10.jpg"]);
  });
  it("handles mixed numeric and alphabetic", () => {
    const names = ["page1b.jpg", "page10.jpg", "page1a.jpg", "page2.jpg"];
    expect(names.sort(naturalCompare)).toEqual(["page1a.jpg", "page1b.jpg", "page2.jpg", "page10.jpg"]);
  });
  it("sorts alphabetic", () => {
    const names = ["c.jpg", "a.jpg", "b.jpg"];
    expect(names.sort(naturalCompare)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });
});

// ===== parseZipEntries =====

describe("cbz parseZipEntries", () => {
  it("parses a single-file ZIP", () => {
    const zip = buildStoreZip([{ name: "page1.jpg", data: new TextEncoder().encode("hello") }]);
    const entries = parseZipEntries(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("page1.jpg");
    expect(entries[0].compressionMethod).toBe(0);
    expect(entries[0].compressedSize).toBe(5);
    expect(entries[0].uncompressedSize).toBe(5);
  });
  it("parses multiple files", () => {
    const zip = buildStoreZip([
      { name: "page1.jpg", data: new TextEncoder().encode("a") },
      { name: "page2.jpg", data: new TextEncoder().encode("bb") },
    ]);
    const entries = parseZipEntries(zip);
    expect(entries).toHaveLength(2);
    expect(entries[1].name).toBe("page2.jpg");
    expect(entries[1].compressedSize).toBe(2);
  });
  it("returns empty for non-ZIP data", () => {
    expect(parseZipEntries(new Uint8Array([0, 1, 2, 3, 4, 5]))).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(parseZipEntries(new Uint8Array([]))).toEqual([]);
  });
});

// ===== extractPages =====

describe("cbz extractPages", () => {
  it("extracts image pages sorted naturally", () => {
    const zip = buildStoreZip([
      { name: "page10.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
      { name: "page2.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
      { name: "page1.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
    ]);
    const pages = extractPages(zip);
    expect(pages).toHaveLength(3);
    expect(pages[0].name).toBe("page1.jpg");
    expect(pages[1].name).toBe("page2.jpg");
    expect(pages[2].name).toBe("page10.jpg");
    revokePages(pages);
  });
  it("filters out non-image files", () => {
    const zip = buildStoreZip([
      { name: "page1.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
      { name: "readme.txt", data: new TextEncoder().encode("hello") },
      { name: "meta.json", data: new TextEncoder().encode("{}") },
    ]);
    const pages = extractPages(zip);
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("page1.jpg");
    revokePages(pages);
  });
  it("detects MIME types correctly", () => {
    const zip = buildStoreZip([
      { name: "a.jpg", data: new Uint8Array([0xff]) },
      { name: "b.png", data: new Uint8Array([0x89]) },
      { name: "c.gif", data: new Uint8Array([0x47]) },
    ]);
    const pages = extractPages(zip);
    expect(pages[0].mime).toBe("image/jpeg");
    expect(pages[1].mime).toBe("image/png");
    expect(pages[2].mime).toBe("image/gif");
    revokePages(pages);
  });
  it("returns empty for ZIP with no images", () => {
    const zip = buildStoreZip([{ name: "readme.txt", data: new TextEncoder().encode("hi") }]);
    expect(extractPages(zip)).toEqual([]);
  });
});

// ===== buildInfo =====

describe("cbz buildInfo", () => {
  it("computes info from pages", () => {
    const zip = buildStoreZip([
      { name: "a.jpg", data: new Uint8Array([1, 2, 3]) },
      { name: "b.png", data: new Uint8Array([1, 2, 3, 4, 5]) },
    ]);
    const pages = extractPages(zip);
    const info = buildInfo("comic.cbz", zip.length, pages);
    expect(info.fileName).toBe("comic.cbz");
    expect(info.pageCount).toBe(2);
    expect(info.imageTypes["jpeg"]).toBe(1);
    expect(info.imageTypes["png"]).toBe(1);
    expect(info.totalImageBytes).toBe(8);
    revokePages(pages);
  });
});

// ===== Navigation =====

describe("cbz navigation buildNavigationState", () => {
  it("clamps current page", () => {
    const state = buildNavigationState(5, 3);
    expect(state.currentPage).toBe(2);
  });
  it("computes canGoPrev / canGoNext", () => {
    const state = buildNavigationState(2, 5);
    expect(state.canGoPrev).toBe(true);
    expect(state.canGoNext).toBe(true);
  });
  it("returns false at boundaries", () => {
    const first = buildNavigationState(0, 5);
    expect(first.canGoPrev).toBe(false);
    const last = buildNavigationState(4, 5);
    expect(last.canGoNext).toBe(false);
  });
});

describe("cbz nextPage / prevPage", () => {
  it("single mode increments by 1", () => {
    expect(nextPage(3, 10, "single")).toBe(4);
  });
  it("single mode clamps at last page", () => {
    expect(nextPage(9, 10, "single")).toBe(9);
  });
  it("double mode increments by 2", () => {
    expect(nextPage(2, 10, "double")).toBe(4);
  });
  it("prevPage single decrements by 1", () => {
    expect(prevPage(3, 10, "single")).toBe(2);
  });
  it("prevPage double decrements by 2", () => {
    expect(prevPage(5, 10, "double")).toBe(3);
  });
  it("prevPage clamps at 0", () => {
    expect(prevPage(1, 10, "single")).toBe(0);
    expect(prevPage(0, 10, "single")).toBe(0);
  });
});

describe("cbz readingProgress", () => {
  it("computes progress percentage", () => {
    expect(readingProgress(0, 10)).toBe(10);
    expect(readingProgress(9, 10)).toBe(100);
  });
  it("returns 0 for empty book", () => {
    expect(readingProgress(0, 0)).toBe(0);
  });
});

describe("cbz pagesForMode", () => {
  it("single mode returns one page", () => {
    expect(pagesForMode(3, 10, "single")).toEqual([3]);
  });
  it("double mode returns two pages", () => {
    expect(pagesForMode(2, 10, "double")).toEqual([2, 3]);
  });
  it("double mode returns one page at end", () => {
    expect(pagesForMode(9, 10, "double")).toEqual([9]);
  });
  it("scroll mode returns all pages", () => {
    expect(pagesForMode(0, 3, "scroll")).toEqual([0, 1, 2]);
  });
});

// ===== createZipFromPages =====

describe("cbz createZipFromPages", () => {
  it("creates a valid ZIP from pages", async () => {
    const zip = buildStoreZip([
      { name: "a.jpg", data: new Uint8Array([0xff, 0xd8]) },
    ]);
    const pages = extractPages(zip);
    const newZip = await createZipFromPages(pages);
    const buf = new Uint8Array(await newZip.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
    revokePages(pages);
  });
});

// ===== Bookmarks =====

describe("cbz bookmarks (localStorage)", () => {
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

  it("returns empty when no bookmarks", () => {
    expect(loadBookmarks()).toEqual([]);
  });
  it("saves a bookmark", () => {
    saveBookmark({ fileName: "comic.cbz", page: 5, totalPages: 20, savedAt: new Date().toISOString() });
    const marks = loadBookmarks();
    expect(marks).toHaveLength(1);
    expect(marks[0].page).toBe(5);
  });
  it("replaces existing bookmark for same file", () => {
    saveBookmark({ fileName: "comic.cbz", page: 5, totalPages: 20, savedAt: "2026-01-01" });
    saveBookmark({ fileName: "comic.cbz", page: 10, totalPages: 20, savedAt: "2026-01-02" });
    const marks = loadBookmarks();
    expect(marks).toHaveLength(1);
    expect(marks[0].page).toBe(10);
  });
  it("gets bookmark by filename", () => {
    saveBookmark({ fileName: "comic.cbz", page: 5, totalPages: 20, savedAt: "2026-01-01" });
    const mark = getBookmark("comic.cbz");
    expect(mark).not.toBeNull();
    expect(mark?.page).toBe(5);
  });
  it("returns null for unknown file", () => {
    expect(getBookmark("unknown.cbz")).toBeNull();
  });
  it("removes a bookmark", () => {
    saveBookmark({ fileName: "comic.cbz", page: 5, totalPages: 20, savedAt: "2026-01-01" });
    removeBookmark("comic.cbz");
    expect(loadBookmarks()).toEqual([]);
  });
  it("clears all bookmarks", () => {
    saveBookmark({ fileName: "a.cbz", page: 1, totalPages: 10, savedAt: "2026-01-01" });
    clearBookmarks();
    expect(loadBookmarks()).toEqual([]);
  });
});

// ===== History =====

describe("cbz history (localStorage)", () => {
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
    saveToHistory({ fileName: "comic.cbz", fileSize: 1000, pageCount: 20, openedAt: new Date().toISOString() });
    expect(loadHistory()).toHaveLength(1);
  });
  it("replaces existing entry for same file", () => {
    saveToHistory({ fileName: "comic.cbz", fileSize: 1000, pageCount: 20, openedAt: "2026-01-01" });
    saveToHistory({ fileName: "comic.cbz", fileSize: 1100, pageCount: 22, openedAt: "2026-01-02" });
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].pageCount).toBe(22);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({ fileName: `c${i}.cbz`, fileSize: 100, pageCount: 10, openedAt: new Date().toISOString() });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({ fileName: "x.cbz", fileSize: 100, pageCount: 10, openedAt: new Date().toISOString() });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== formatBytes + share URL =====

describe("cbz formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("cbz share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/cbz-comic-book-reader",
    };
  });

  it("builds share URL with mode + fit", () => {
    const url = buildShareUrl("double" as ReadingMode, "width" as FitMode);
    expect(url).toContain("mode=double");
    expect(url).toContain("fit=width");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("scroll", "height");
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.mode).toBe("scroll");
    expect(parsed?.fit).toBe("height");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});
