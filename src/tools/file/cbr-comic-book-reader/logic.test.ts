import { describe, it, expect, beforeEach } from "vitest";
import {
  RAR4_SIGNATURE, RAR5_SIGNATURE,
  isRar4Signature, isRar5Signature, detectRarVersion, isRarFile,
  decodeVint,
  parseRar4, parseRar5, parseRar,
  detectImageMime, naturalCompare, getPageEntries,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type RarEntry,
} from "./logic";

// ===== Signature detection =====

describe("cbr-comic-book-reader signature detection", () => {
  it("isRar4Signature returns true for RAR4 magic", () => {
    expect(isRar4Signature(new Uint8Array(RAR4_SIGNATURE))).toBe(true);
  });
  it("isRar4Signature returns false for RAR5 magic", () => {
    expect(isRar4Signature(new Uint8Array(RAR5_SIGNATURE))).toBe(false);
  });
  it("isRar4Signature returns false for too-short input", () => {
    expect(isRar4Signature(new Uint8Array([0x52, 0x61, 0x72]))).toBe(false);
  });
  it("isRar5Signature returns true for RAR5 magic", () => {
    expect(isRar5Signature(new Uint8Array(RAR5_SIGNATURE))).toBe(true);
  });
  it("isRar5Signature returns false for RAR4 magic", () => {
    expect(isRar5Signature(new Uint8Array(RAR4_SIGNATURE))).toBe(false);
  });
  it("isRar5Signature returns false for too-short input", () => {
    expect(isRar5Signature(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01]))).toBe(false);
  });
  it("detectRarVersion returns 'rar4' for RAR4 magic", () => {
    expect(detectRarVersion(new Uint8Array(RAR4_SIGNATURE))).toBe("rar4");
  });
  it("detectRarVersion returns 'rar5' for RAR5 magic", () => {
    expect(detectRarVersion(new Uint8Array(RAR5_SIGNATURE))).toBe("rar5");
  });
  it("detectRarVersion returns null for non-RAR", () => {
    expect(detectRarVersion(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });
  it("isRarFile returns true for RAR4", () => {
    expect(isRarFile(new Uint8Array(RAR4_SIGNATURE))).toBe(true);
  });
  it("isRarFile returns true for RAR5", () => {
    expect(isRarFile(new Uint8Array(RAR5_SIGNATURE))).toBe(true);
  });
  it("isRarFile returns false for ZIP", () => {
    expect(isRarFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
});

// ===== vint decoding (RAR5) =====

describe("cbr-comic-book-reader decodeVint", () => {
  it("decodes a single-byte value (no continuation)", () => {
    const bytes = new Uint8Array([0x05]);
    expect(decodeVint(bytes, 0)).toEqual({ value: 5, bytesConsumed: 1 });
  });
  it("decodes a two-byte value with continuation", () => {
    // 0x85 = continuation + low 7 bits 0x05; 0x01 = no continuation + low 7 bits 0x01
    // value = (0x01 << 7) | 0x05 = 0x85 = 133
    const bytes = new Uint8Array([0x85, 0x01]);
    expect(decodeVint(bytes, 0)).toEqual({ value: 133, bytesConsumed: 2 });
  });
  it("decodes a zero value", () => {
    expect(decodeVint(new Uint8Array([0x00]), 0)).toEqual({ value: 0, bytesConsumed: 1 });
  });
  it("decodes a max single-byte value (0x7f)", () => {
    expect(decodeVint(new Uint8Array([0x7f]), 0)).toEqual({ value: 0x7f, bytesConsumed: 1 });
  });
  it("decodes a multi-byte value", () => {
    // 0xff, 0xff, 0x03 — 0x03 << 14 | 0x7f << 7 | 0x7f = 65535
    const bytes = new Uint8Array([0xff, 0xff, 0x03]);
    const result = decodeVint(bytes, 0);
    expect(result.value).toBe(0x7f | (0x7f << 7) | (0x03 << 14));
    expect(result.bytesConsumed).toBe(3);
  });
  it("handles offset correctly", () => {
    const bytes = new Uint8Array([0xaa, 0xbb, 0x42]);
    expect(decodeVint(bytes, 2)).toEqual({ value: 0x42, bytesConsumed: 1 });
  });
});

// ===== RAR4 parsing =====

describe("cbr-comic-book-reader parseRar4", () => {
  function makeRar4MainHeader(): Uint8Array {
    // Minimal RAR4: signature (7) + main archive header
    const bytes = new Uint8Array(7 + 13);
    bytes.set(RAR4_SIGNATURE, 0);
    // Main archive header
    bytes[7] = 0x00; bytes[8] = 0x00; // CRC
    bytes[9] = 0x73; // type = MainArchiveHeader
    bytes[10] = 0x00; bytes[11] = 0x00; // flags
    bytes[12] = 0x0d; bytes[13] = 0x00; // size = 13
    bytes[14] = 0x00; bytes[15] = 0x00; // AvPos
    bytes[16] = 0x00; bytes[17] = 0x00; // main flags
    return bytes;
  }

  it("returns isValid=true for RAR4 archive", () => {
    const result = parseRar4(makeRar4MainHeader());
    expect(result.isValid).toBe(true);
    expect(result.version).toBe("rar4");
  });
  it("returns empty entries for minimal archive", () => {
    const result = parseRar4(makeRar4MainHeader());
    expect(result.entries.length).toBe(0);
    expect(result.fileCount).toBe(0);
  });
  it("returns isValid=false for non-RAR input", () => {
    const result = parseRar(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/missing 'Rar!' signature/i);
  });
});

// ===== RAR5 parsing =====

describe("cbr-comic-book-reader parseRar5", () => {
  function makeRar5MainHeader(): Uint8Array {
    // Minimal RAR5: signature (8) + main archive header
    const bytes = new Uint8Array(8 + 4 + 1 + 1 + 1 + 1);
    bytes.set(RAR5_SIGNATURE, 0);
    // CRC (4 bytes)
    bytes[8] = 0x00; bytes[9] = 0x00; bytes[10] = 0x00; bytes[11] = 0x00;
    // headerSize vint = 3
    bytes[12] = 0x03;
    // headerType vint = 1 (MainArchive)
    bytes[13] = 0x01;
    // headerFlags vint = 0
    bytes[14] = 0x00;
    // archiveFlags vint = 0
    bytes[15] = 0x00;
    return bytes;
  }
  it("returns isValid=true for RAR5 archive", () => {
    const result = parseRar5(makeRar5MainHeader());
    expect(result.isValid).toBe(true);
    expect(result.version).toBe("rar5");
  });
  it("returns empty entries for minimal archive", () => {
    const result = parseRar5(makeRar5MainHeader());
    expect(result.entries.length).toBe(0);
  });
});

// ===== parseRar (top-level) =====

describe("cbr-comic-book-reader parseRar", () => {
  it("returns error for non-RAR input", () => {
    const result = parseRar(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
  it("returns rar4 for RAR4 input", () => {
    const bytes = new Uint8Array(RAR4_SIGNATURE);
    const result = parseRar(bytes);
    expect(result.version).toBe("rar4");
    expect(result.isValid).toBe(true);
  });
  it("returns rar5 for RAR5 input", () => {
    const bytes = new Uint8Array(RAR5_SIGNATURE);
    const result = parseRar(bytes);
    expect(result.version).toBe("rar5");
    expect(result.isValid).toBe(true);
  });
});

// ===== Image detection =====

describe("cbr-comic-book-reader detectImageMime", () => {
  it("detects JPEG", () => {
    expect(detectImageMime("page1.jpg")).toBe("image/jpeg");
    expect(detectImageMime("page1.JPEG")).toBe("image/jpeg");
  });
  it("detects PNG", () => {
    expect(detectImageMime("page.png")).toBe("image/png");
  });
  it("detects GIF", () => {
    expect(detectImageMime("anim.gif")).toBe("image/gif");
  });
  it("detects WebP", () => {
    expect(detectImageMime("page.webp")).toBe("image/webp");
  });
  it("detects BMP", () => {
    expect(detectImageMime("page.bmp")).toBe("image/bmp");
  });
  it("detects AVIF", () => {
    expect(detectImageMime("page.avif")).toBe("image/avif");
  });
  it("returns null for non-image", () => {
    expect(detectImageMime("index.xml")).toBeNull();
    expect(detectImageMime("cover.txt")).toBeNull();
  });
});

// ===== naturalCompare =====

describe("cbr-comic-book-reader naturalCompare", () => {
  it("sorts page2 before page10", () => {
    expect(naturalCompare("page2.jpg", "page10.jpg")).toBeLessThan(0);
  });
  it("sorts page10 after page2", () => {
    expect(naturalCompare("page10.jpg", "page2.jpg")).toBeGreaterThan(0);
  });
  it("returns 0 for equal strings", () => {
    expect(naturalCompare("page1.jpg", "page1.jpg")).toBe(0);
  });
  it("handles non-numeric prefixes", () => {
    expect(naturalCompare("abc.jpg", "abd.jpg")).toBeLessThan(0);
  });
});

// ===== getPageEntries =====

describe("cbr-comic-book-reader getPageEntries", () => {
  it("returns only image entries", () => {
    const entries: RarEntry[] = [
      { name: "page1.jpg", uncompressedSize: 1000, compressedSize: 900, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 0 },
      { name: "page2.jpg", uncompressedSize: 2000, compressedSize: 1800, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 100 },
      { name: "index.xml", uncompressedSize: 100, compressedSize: 100, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 200 },
      { name: "subdir/", uncompressedSize: 0, compressedSize: 0, isDirectory: true, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 300 },
    ];
    const pages = getPageEntries(entries);
    expect(pages.length).toBe(2);
    expect(pages[0]!.name).toBe("page1.jpg");
    expect(pages[1]!.name).toBe("page2.jpg");
  });
  it("sorts naturally", () => {
    const entries: RarEntry[] = [
      { name: "page10.jpg", uncompressedSize: 1000, compressedSize: 900, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 0 },
      { name: "page2.jpg", uncompressedSize: 2000, compressedSize: 1800, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 100 },
      { name: "page1.jpg", uncompressedSize: 500, compressedSize: 400, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 200 },
    ];
    const pages = getPageEntries(entries);
    expect(pages[0]!.name).toBe("page1.jpg");
    expect(pages[1]!.name).toBe("page2.jpg");
    expect(pages[2]!.name).toBe("page10.jpg");
  });
  it("returns empty for no images", () => {
    const entries: RarEntry[] = [
      { name: "index.xml", uncompressedSize: 100, compressedSize: 100, isDirectory: false, isEncrypted: false, crc32: null, compressionMethod: null, fileDate: null, headerOffset: 0 },
    ];
    expect(getPageEntries(entries).length).toBe(0);
  });
});

// ===== formatBytes =====

describe("cbr-comic-book-reader formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

// ===== History (localStorage) =====

describe("cbr-comic-book-reader history", () => {
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

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "comic.cbr", fileSize: 5000000, version: "rar4",
      pageCount: 24, fileCount: 25, openedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `c${i}.cbr`, fileSize: 1000, version: "rar4",
        pageCount: 1, fileCount: 1, openedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.cbr", fileSize: 1000, version: "rar4",
      pageCount: 1, fileCount: 1, openedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("cbr-comic-book-reader share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/cbr-comic-book-reader",
    };
  });

  it("builds share URL", () => {
    const url = buildShareUrl();
    expect(url).toContain("https://example.com");
  });
  it("parses '#inspect' as true", () => {
    expect(parseShareUrl("#inspect")).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
