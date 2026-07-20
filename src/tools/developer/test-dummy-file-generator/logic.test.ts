import { describe, it, expect, beforeEach } from "vitest";
import {
  FILE_TYPES,
  CONTENT_MODES,
  UNITS,
  SIZE_PRESETS,
  MAX_SIZE_GB,
  MAX_BULK,
  HISTORY_MAX,
  PNG_MIN_SIZE,
  PDF_MIN_SIZE,
  ZIP_MIN_OVERHEAD,
  fnv1a,
  mulberry32,
  crc32,
  adler32,
  encodeUtf8,
  concatBytes,
  toHex,
  formatBytes,
  parsePattern,
  computeTargetBytes,
  validateOptions,
  generateFile,
  generateBulk,
  generatePng,
  generateZip,
  generatePdf,
  resolveFilename,
  mimeType,
  fileExtension,
  defaultFilename,
  detectMagic,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GenerateOptions,
  type FileType,
  type ContentMode,
  type Unit,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

const baseOpts: GenerateOptions = {
  size: 1,
  unit: "KB",
  type: "txt",
  contentMode: "lorem",
  filename: "",
  bulkCount: 1,
};

// ──────────────────────────────────────────────────────────────────────────
// Constants & catalog
// ──────────────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("exposes 9 file types", () => {
    expect(FILE_TYPES).toHaveLength(9);
    expect(FILE_TYPES.map((f) => f.value)).toEqual(
      expect.arrayContaining(["txt", "csv", "json", "xml", "html", "png", "binary", "zip", "pdf"]),
    );
  });
  it("exposes 4 content modes", () => {
    expect(CONTENT_MODES).toHaveLength(4);
  });
  it("exposes 4 units with correct factors", () => {
    expect(UNITS).toHaveLength(4);
    expect(UNITS.find((u) => u.value === "B")!.factor).toBe(1);
    expect(UNITS.find((u) => u.value === "KB")!.factor).toBe(1024);
    expect(UNITS.find((u) => u.value === "MB")!.factor).toBe(1024 * 1024);
    expect(UNITS.find((u) => u.value === "GB")!.factor).toBe(1024 * 1024 * 1024);
  });
  it("exposes 8 size presets", () => {
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("enforces a 2GB max", () => {
    expect(MAX_SIZE_GB).toBe(2);
  });
  it("enforces a 100 max for bulk", () => {
    expect(MAX_BULK).toBe(100);
  });
  it("enforces a 20-entry history cap", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PRNG & hash helpers
// ──────────────────────────────────────────────────────────────────────────

describe("PRNG & hash helpers", () => {
  it("fnv1a is deterministic (string)", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
  });
  it("fnv1a accepts Uint8Array", () => {
    expect(fnv1a(new Uint8Array([1, 2, 3]))).toBe(fnv1a(new Uint8Array([1, 2, 3])));
  });
  it("mulberry32 is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("crc32 matches known vector", () => {
    // CRC32 of "123456789" = 0xCBF43926
    expect(crc32(encodeUtf8("123456789"))).toBe(0xCBF43926);
  });
  it("crc32 of empty is 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("adler32 matches known vector", () => {
    // Adler32 of "Wikipedia" = 0x11E60398
    expect(adler32(encodeUtf8("Wikipedia"))).toBe(0x11E60398);
  });
  it("encodeUtf8 produces correct bytes for ASCII", () => {
    expect(Array.from(encodeUtf8("ABC"))).toEqual([0x41, 0x42, 0x43]);
  });
  it("encodeUtf8 handles multibyte", () => {
    // "€" is U+20AC → 0xE2 0x82 0xAC
    expect(Array.from(encodeUtf8("€"))).toEqual([0xE2, 0x82, 0xAC]);
  });
  it("concatBytes joins arrays", () => {
    const out = concatBytes(new Uint8Array([1, 2]), new Uint8Array([3, 4, 5]));
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });
  it("toHex formats bytes", () => {
    expect(toHex(new Uint8Array([0x89, 0x50]), 2)).toBe("89 50");
  });
  it("formatBytes formats various sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// parsePattern
// ──────────────────────────────────────────────────────────────────────────

describe("parsePattern", () => {
  it("parses hex bytes with 0x prefix", () => {
    expect(Array.from(parsePattern("0xAA,0xBB,0xCC"))).toEqual([0xAA, 0xBB, 0xCC]);
  });
  it("parses hex bytes without 0x prefix", () => {
    expect(Array.from(parsePattern("AA BB CC"))).toEqual([0xAA, 0xBB, 0xCC]);
  });
  it("treats unknown text as literal string", () => {
    expect(Array.from(parsePattern("hello"))).toEqual([0x68, 0x65, 0x6C, 0x6C, 0x6F]);
  });
  it("returns a space for empty input", () => {
    expect(Array.from(parsePattern(""))).toEqual([0x20]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sizing & validation
// ──────────────────────────────────────────────────────────────────────────

describe("computeTargetBytes", () => {
  it("converts B", () => {
    expect(computeTargetBytes(100, "B")).toBe(100);
  });
  it("converts KB", () => {
    expect(computeTargetBytes(1, "KB")).toBe(1024);
    expect(computeTargetBytes(10, "KB")).toBe(10240);
  });
  it("converts MB", () => {
    expect(computeTargetBytes(1, "MB")).toBe(1024 * 1024);
  });
  it("converts GB", () => {
    expect(computeTargetBytes(1, "GB")).toBe(1024 * 1024 * 1024);
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions({ ...baseOpts });
    expect(r.ok).toBe(true);
  });
  it("rejects size ≤ 0", () => {
    expect(validateOptions({ ...baseOpts, size: 0 }).ok).toBe(false);
    expect(validateOptions({ ...baseOpts, size: -1 }).ok).toBe(false);
  });
  it("rejects NaN size", () => {
    expect(validateOptions({ ...baseOpts, size: NaN }).ok).toBe(false);
  });
  it("rejects size > MAX_SIZE_GB GB", () => {
    expect(validateOptions({ ...baseOpts, size: MAX_SIZE_GB + 1, unit: "GB" }).ok).toBe(false);
  });
  it("rejects bulkCount < 1", () => {
    expect(validateOptions({ ...baseOpts, bulkCount: 0 }).ok).toBe(false);
  });
  it("rejects bulkCount > MAX_BULK", () => {
    expect(validateOptions({ ...baseOpts, bulkCount: MAX_BULK + 1 }).ok).toBe(false);
  });
  it("rejects PNG smaller than PNG_MIN_SIZE", () => {
    expect(validateOptions({ ...baseOpts, type: "png", size: PNG_MIN_SIZE - 1, unit: "B" }).ok).toBe(false);
  });
  it("accepts PNG at PNG_MIN_SIZE", () => {
    expect(validateOptions({ ...baseOpts, type: "png", size: PNG_MIN_SIZE, unit: "B" }).ok).toBe(true);
  });
  it("rejects PDF smaller than PDF_MIN_SIZE", () => {
    expect(validateOptions({ ...baseOpts, type: "pdf", size: PDF_MIN_SIZE - 1, unit: "B" }).ok).toBe(false);
  });
  it("rejects ZIP smaller than overhead+4", () => {
    expect(validateOptions({ ...baseOpts, type: "zip", size: ZIP_MIN_OVERHEAD, unit: "B" }).ok).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// File generation — exact size
// ──────────────────────────────────────────────────────────────────────────

describe("generateFile — exact size for each type", () => {
  const sizes: { size: number; unit: Unit }[] = [
    { size: 1, unit: "KB" },        // 1024 bytes
    { size: 1500, unit: "B" },      // 1500 bytes
    { size: 10, unit: "KB" },       // 10240 bytes
  ];
  const types: FileType[] = ["txt", "csv", "json", "xml", "html", "binary"];

  for (const sz of sizes) {
    for (const type of types) {
      it(`generates exact-size ${type} at ${sz.size}${sz.unit}`, () => {
        const file = generateFile({ ...baseOpts, type, size: sz.size, unit: sz.unit, contentMode: "lorem" });
        expect(file.size).toBe(computeTargetBytes(sz.size, sz.unit));
        expect(file.bytes.length).toBe(computeTargetBytes(sz.size, sz.unit));
        expect(file.checksum.length).toBe(8);
      });
    }
  }

  it("generates exact-size PNG at 1KB", () => {
    const file = generateFile({ ...baseOpts, type: "png", size: 1, unit: "KB" });
    expect(file.size).toBe(1024);
    expect(file.bytes.length).toBe(1024);
    expect(detectMagic(file.bytes)).toBe("PNG");
  });

  it("generates exact-size ZIP at 1KB", () => {
    const file = generateFile({ ...baseOpts, type: "zip", size: 1, unit: "KB" });
    expect(file.size).toBe(1024);
    expect(file.bytes.length).toBe(1024);
    expect(detectMagic(file.bytes)).toBe("ZIP");
  });

  it("generates exact-size PDF at 1KB", () => {
    const file = generateFile({ ...baseOpts, type: "pdf", size: 1, unit: "KB" });
    expect(file.size).toBe(1024);
    expect(file.bytes.length).toBe(1024);
    expect(detectMagic(file.bytes)).toBe("PDF");
  });

  it("generates exact-size PNG at minimum size", () => {
    const file = generateFile({ ...baseOpts, type: "png", size: PNG_MIN_SIZE, unit: "B" });
    expect(file.size).toBe(PNG_MIN_SIZE);
  });

  it("generates exact-size PDF at minimum size", () => {
    const file = generateFile({ ...baseOpts, type: "pdf", size: PDF_MIN_SIZE, unit: "B" });
    expect(file.size).toBe(PDF_MIN_SIZE);
  });

  it("generates exact-size ZIP at minimum overhead", () => {
    const minSize = ZIP_MIN_OVERHEAD + 10;
    const file = generateFile({ ...baseOpts, type: "zip", size: minSize, unit: "B" });
    expect(file.size).toBe(minSize);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Content modes
// ──────────────────────────────────────────────────────────────────────────

describe("content modes", () => {
  it("zeros mode fills with 0x00 for binary", () => {
    const file = generateFile({ ...baseOpts, type: "binary", size: 100, unit: "B", contentMode: "zeros" });
    expect(file.size).toBe(100);
    for (let i = 0; i < 100; i++) expect(file.bytes[i]).toBe(0x00);
  });

  it("zeros mode fills with ASCII '0' for txt", () => {
    const file = generateFile({ ...baseOpts, type: "txt", size: 50, unit: "B", contentMode: "zeros" });
    for (let i = 0; i < 50; i++) expect(file.bytes[i]).toBe(0x30);
  });

  it("pattern mode repeats a byte pattern (binary)", () => {
    const file = generateFile({ ...baseOpts, type: "binary", size: 10, unit: "B", contentMode: "pattern", pattern: "0xAA,0xBB" });
    expect(Array.from(file.bytes)).toEqual([0xAA, 0xBB, 0xAA, 0xBB, 0xAA, 0xBB, 0xAA, 0xBB, 0xAA, 0xBB]);
  });

  it("random mode is reproducible with the same seed", () => {
    const a = generateFile({ ...baseOpts, type: "binary", size: 100, unit: "B", contentMode: "random", seed: "abc" });
    const b = generateFile({ ...baseOpts, type: "binary", size: 100, unit: "B", contentMode: "random", seed: "abc" });
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
  });

  it("lorem mode generates ASCII text", () => {
    const file = generateFile({ ...baseOpts, type: "txt", size: 200, unit: "B", contentMode: "lorem", seed: "x" });
    // All bytes should be printable ASCII or whitespace
    for (let i = 0; i < file.bytes.length; i++) {
      expect(file.bytes[i]).toBeGreaterThanOrEqual(0x09);
      expect(file.bytes[i]).toBeLessThanOrEqual(0x7E);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PNG generator (structural)
// ──────────────────────────────────────────────────────────────────────────

describe("generatePng", () => {
  it("produces valid PNG signature + IHDR + IDAT + IEND", () => {
    const bytes = generatePng(500, { ...baseOpts, type: "png", imageColor: "#FF0000" });
    // PNG signature
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4E);
    expect(bytes[3]).toBe(0x47);
    // IHDR chunk type at offset 12-16
    expect(String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])).toBe("IHDR");
    // IEND appears near the end (last 8 bytes are IEND chunk: len=0 + type + CRC)
    const tail = bytes.subarray(bytes.length - 12);
    expect(String.fromCharCode(tail[4], tail[5], tail[6], tail[7])).toBe("IEND");
  });

  it("honors exact byte size for non-trivial sizes", () => {
    for (const size of [100, 256, 1024, 4096, 12345]) {
      const bytes = generatePng(size, { ...baseOpts, type: "png" });
      expect(bytes.length).toBe(size);
    }
  });

  it("supports a solid color image", () => {
    const bytes = generatePng(200, { ...baseOpts, type: "png", imageColor: "#FF0000", imageWidth: 4, imageHeight: 4 });
    expect(bytes.length).toBe(200);
    expect(detectMagic(bytes)).toBe("PNG");
  });

  it("throws on too-small target", () => {
    expect(() => generatePng(PNG_MIN_SIZE - 1, { ...baseOpts, type: "png" })).toThrow(/at least/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ZIP generator (structural)
// ──────────────────────────────────────────────────────────────────────────

describe("generateZip", () => {
  it("produces valid ZIP local header signature", () => {
    const bytes = generateZip(500, { ...baseOpts, type: "zip" }, mulberry32(1));
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
  it("produces valid ZIP EOCD signature at the end", () => {
    const bytes = generateZip(500, { ...baseOpts, type: "zip" }, mulberry32(1));
    const tail = bytes.subarray(bytes.length - 22);
    expect(tail[0]).toBe(0x50);
    expect(tail[1]).toBe(0x4B);
    expect(tail[2]).toBe(0x05);
    expect(tail[3]).toBe(0x06);
  });
  it("honors exact byte size", () => {
    const bytes = generateZip(2048, { ...baseOpts, type: "zip" }, mulberry32(1));
    expect(bytes.length).toBe(2048);
  });
  it("throws on too-small target", () => {
    expect(() => generateZip(ZIP_MIN_OVERHEAD, { ...baseOpts, type: "zip" }, mulberry32(1))).toThrow(/at least/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PDF generator (structural)
// ──────────────────────────────────────────────────────────────────────────

describe("generatePdf", () => {
  it("starts with %PDF-1.4 and ends with %%EOF", () => {
    const bytes = generatePdf(500, { ...baseOpts, type: "pdf" });
    const head = bytes.slice(0, 9);
    expect(Array.from(head)).toEqual(Array.from(encodeUtf8("%PDF-1.4\n")));
    const tailStr = new TextDecoder().decode(bytes.subarray(bytes.length - 5));
    expect(tailStr).toBe("%%EOF");
  });
  it("honors exact byte size", () => {
    for (const size of [100, 200, 1024, 4096]) {
      const bytes = generatePdf(size, { ...baseOpts, type: "pdf" });
      expect(bytes.length).toBe(size);
    }
  });
  it("throws on too-small target", () => {
    expect(() => generatePdf(PDF_MIN_SIZE - 1, { ...baseOpts, type: "pdf" })).toThrow(/at least/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// detectMagic
// ──────────────────────────────────────────────────────────────────────────

describe("detectMagic", () => {
  it("detects PNG magic", () => {
    const bytes = generatePng(500, { ...baseOpts, type: "png" });
    expect(detectMagic(bytes)).toBe("PNG");
  });
  it("detects ZIP magic", () => {
    const bytes = generateZip(500, { ...baseOpts, type: "zip" }, mulberry32(1));
    expect(detectMagic(bytes)).toBe("ZIP");
  });
  it("detects PDF magic", () => {
    const bytes = generatePdf(500, { ...baseOpts, type: "pdf" });
    expect(detectMagic(bytes)).toBe("PDF");
  });
  it("detects XML magic", () => {
    const bytes = encodeUtf8('<?xml version="1.0"?>');
    expect(detectMagic(bytes)).toBe("XML");
  });
  it("detects HTML magic", () => {
    const bytes = encodeUtf8("<!DOCTYPE html>");
    expect(detectMagic(bytes)).toBe("HTML");
  });
  it("detects JSON magic", () => {
    const bytes = encodeUtf8('{"a":1}');
    expect(detectMagic(bytes)).toBe("JSON");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Bulk generation
// ──────────────────────────────────────────────────────────────────────────

describe("generateBulk", () => {
  it("generates the requested number of files", () => {
    const files = generateBulk({ ...baseOpts, bulkCount: 5, filename: "test-{n}.txt", size: 100, unit: "B" });
    expect(files).toHaveLength(5);
    expect(files[0].name).toBe("test-1.txt");
    expect(files[4].name).toBe("test-5.txt");
  });
  it("each file is the exact requested size", () => {
    const files = generateBulk({ ...baseOpts, bulkCount: 3, size: 256, unit: "B" });
    for (const f of files) expect(f.size).toBe(256);
  });
  it("is reproducible with same seed per index", () => {
    const a = generateBulk({ ...baseOpts, bulkCount: 3, seed: "abc", size: 200, unit: "B", contentMode: "random", type: "binary" });
    const b = generateBulk({ ...baseOpts, bulkCount: 3, seed: "abc", size: 200, unit: "B", contentMode: "random", type: "binary" });
    for (let i = 0; i < 3; i++) {
      expect(Array.from(a[i].bytes)).toEqual(Array.from(b[i].bytes));
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Filename helpers
// ──────────────────────────────────────────────────────────────────────────

describe("filename helpers", () => {
  it("resolveFilename replaces {n}", () => {
    expect(resolveFilename("file-{n}.txt", "txt", 3)).toBe("file-3.txt");
  });
  it("resolveFilename adds extension if missing", () => {
    expect(resolveFilename("foo", "png", 1)).toBe("foo.png");
  });
  it("resolveFilename uses default name when template is empty", () => {
    expect(resolveFilename("", "json", 1)).toBe("dummy.json");
  });
  it("mimeType, fileExtension, defaultFilename work for all types", () => {
    for (const t of FILE_TYPES) {
      expect(mimeType(t.value).length).toBeGreaterThan(0);
      expect(fileExtension(t.value).length).toBeGreaterThan(0);
      expect(defaultFilename(t.value)).toContain(".");
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// History
// ──────────────────────────────────────────────────────────────────────────

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "txt", bytes: 1024, bulkCount: 1, contentMode: "lorem", filename: "x.txt" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "txt", bytes: i, bulkCount: 1, contentMode: "lorem", filename: `f${i}.txt` });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "txt", bytes: 1, bulkCount: 1, contentMode: "lorem", filename: "x.txt" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Shareable URL
// ──────────────────────────────────────────────────────────────────────────

describe("shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...baseOpts, size: 10, unit: "KB", type: "png", contentMode: "random", imageColor: "#FF0000", seed: "abc" });
    expect(url).toContain("size=10");
    expect(url).toContain("unit=KB");
    expect(url).toContain("type=png");
    expect(url).toContain("mode=random");
    expect(url).toContain("seed=abc");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...baseOpts, size: 5, unit: "MB", type: "zip", contentMode: "pattern", pattern: "0xAA,0xBB", bulkCount: 3, seed: "xyz" });
    const p = parseShareUrl(url);
    expect(p.size).toBe(5);
    expect(p.unit).toBe("MB");
    expect(p.type).toBe("zip");
    expect(p.contentMode).toBe("pattern");
    expect(p.bulkCount).toBe(3);
    expect(p.seed).toBe("xyz");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.size).toBe(1);
    expect(p.type).toBe("txt");
    expect(p.unit).toBe("B");
  });
  it("filters invalid types", () => {
    const p = parseShareUrl("type=invalid");
    expect(p.type).toBe("txt");
  });
  it("clamps bulk count", () => {
    const p = parseShareUrl("bulk=999");
    expect(p.bulkCount).toBe(MAX_BULK);
  });
});

// Suppress unused-import lint
export type _Unused = FileType | ContentMode | Unit;
