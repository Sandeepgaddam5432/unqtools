import { describe, it, expect, beforeEach } from "vitest";
import {
  SIGNATURES,
  HISTORY_MAX,
  CATEGORY_LABELS,
  hexStringToBytes,
  bytesToHexString,
  byteToHex,
  byteToAscii,
  ruleHex,
  renderHexDump,
  renderHexDumpText,
  isHighlighted,
  isPlainText,
  matchesRule,
  detectAll,
  detectPrimary,
  detectZipSubtype,
  extractExtension,
  extensionMatches,
  detect,
  searchSignatures,
  groupByCategory,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderReport,
  type FileCategory,
  type SignatureRule,
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

const u8 = (arr: number[]) => new Uint8Array(arr);

describe("binary-signature database constants", () => {
  it("has at least 100 signatures", () => {
    expect(SIGNATURES.length).toBeGreaterThanOrEqual(100);
  });
  it("covers all major categories", () => {
    const cats = new Set(SIGNATURES.map((s) => s.category));
    for (const c of ["image", "archive", "executable", "document", "audio", "video", "font", "database"] as FileCategory[]) {
      expect(cats.has(c)).toBe(true);
    }
  });
  it("includes all blueprint-mentioned formats", () => {
    const ids = SIGNATURES.map((s) => s.id);
    expect(ids).toContain("png");
    expect(ids).toContain("jpg");
    expect(ids).toContain("gif87a");
    expect(ids).toContain("pdf");
    expect(ids).toContain("zip");
    expect(ids).toContain("elf");
    expect(ids).toContain("pe-mz");
    expect(ids).toContain("macho-32-le");
  });
  it("each rule has required fields", () => {
    for (const r of SIGNATURES) {
      expect(typeof r.id).toBe("string");
      expect(r.id.length).toBeGreaterThan(0);
      expect(typeof r.name).toBe("string");
      expect(r.exts.length).toBeGreaterThan(0);
      expect(typeof r.mime).toBe("string");
      expect(Array.isArray(r.bytes)).toBe(true);
      expect(r.bytes.length).toBeGreaterThan(0);
      expect(typeof r.offset).toBe("number");
      expect(typeof r.description).toBe("string");
    }
  });
  it("exposes category labels for every category", () => {
    const cats = new Set(SIGNATURES.map((s) => s.category));
    for (const c of cats) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
  it("exposes history max of 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("binary-signature hex helpers", () => {
  it("hexStringToBytes parses hex", () => {
    expect(hexStringToBytes("89504E47")).toEqual(u8([0x89, 0x50, 0x4e, 0x47]));
  });
  it("hexStringToBytes handles spaces and 0x prefix", () => {
    expect(hexStringToBytes("0x89 50 4E 47")).toEqual(u8([0x89, 0x50, 0x4e, 0x47]));
  });
  it("hexStringToBytes rejects odd length", () => {
    expect(() => hexStringToBytes("FFF")).toThrow();
  });
  it("hexStringToBytes rejects non-hex", () => {
    expect(() => hexStringToBytes("ZZ")).toThrow();
  });
  it("bytesToHexString converts bytes to hex", () => {
    expect(bytesToHexString(u8([0xff, 0xd8]))).toBe("FFD8");
  });
  it("bytesToHexString supports lowercase and separator", () => {
    expect(bytesToHexString(u8([0xff, 0xd8]), false, " ")).toBe("ff d8");
  });
  it("byteToHex returns 2-digit hex", () => {
    expect(byteToHex(0)).toBe("00");
    expect(byteToHex(255)).toBe("FF");
    expect(byteToHex(15, false)).toBe("0f");
  });
  it("byteToAscii returns printable char or dot", () => {
    expect(byteToAscii(65)).toBe("A");
    expect(byteToAscii(0)).toBe(".");
    expect(byteToAscii(127)).toBe(".");
    expect(byteToAscii(126)).toBe("~");
  });
  it("ruleHex computes hex string for a rule", () => {
    const r: SignatureRule = {
      id: "test", name: "Test", exts: ["t"], mime: "application/test",
      category: "other", offset: 0, bytes: [0xff, 0xd8],
      description: "test",
    };
    expect(ruleHex(r)).toBe("FF D8");
  });
});

describe("binary-signature hex dump", () => {
  it("renders hex dump lines", () => {
    const dump = renderHexDump(u8([0x41, 0x42, 0x43, 0x44]), { bytesPerLine: 2 });
    expect(dump).toHaveLength(2);
    expect(dump[0].offset).toBe(0);
    expect(dump[0].hex).toContain("41");
    expect(dump[0].ascii).toBe("AB");
  });
  it("renders hex dump text", () => {
    const text = renderHexDumpText(u8([0x41, 0x42, 0x43]));
    expect(text).toContain("41");
    expect(text).toContain("AB");
  });
  it("isHighlighted detects highlight ranges", () => {
    expect(isHighlighted(4, [{ start: 4, length: 3 }])).toBe(true);
    expect(isHighlighted(5, [{ start: 4, length: 3 }])).toBe(true);
    expect(isHighlighted(6, [{ start: 4, length: 3 }])).toBe(true);
    expect(isHighlighted(7, [{ start: 4, length: 3 }])).toBe(false);
    expect(isHighlighted(8, [{ start: 4, length: 3 }])).toBe(false);
    expect(isHighlighted(0, undefined)).toBe(false);
  });
  it("truncates to maxBytes", () => {
    const big = new Uint8Array(2000);
    const dump = renderHexDump(big, { maxBytes: 100, bytesPerLine: 16 });
    expect(dump.length).toBeLessThanOrEqual(7); // 100/16 ≈ 6.25 → 7
  });
});

describe("binary-signature plain-text detection", () => {
  it("detects ASCII text", () => {
    expect(isPlainText(u8(Array.from("Hello, world! This is a text file.".split("").map((c) => c.charCodeAt(0)))))).toBe(true);
  });
  it("rejects binary data", () => {
    expect(isPlainText(u8([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]))).toBe(false);
  });
  it("empty returns false", () => {
    expect(isPlainText(u8([]))).toBe(false);
  });
});

describe("binary-signature matchesRule", () => {
  it("matches PNG signature", () => {
    const png = SIGNATURES.find((r) => r.id === "png")!;
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(matchesRule(bytes, png)).toBe(true);
  });
  it("rejects wrong bytes", () => {
    const png = SIGNATURES.find((r) => r.id === "png")!;
    expect(matchesRule(u8([0xff, 0xd8, 0xff]), png)).toBe(false);
  });
  it("respects offset (ISO9660 at 0x8001)", () => {
    const iso = SIGNATURES.find((r) => r.id === "iso9660")!;
    // Construct bytes with "CD001" at offset 0x8001
    const buf = new Uint8Array(0x8006);
    buf[0x8001] = 0x43; // C
    buf[0x8002] = 0x44; // D
    buf[0x8003] = 0x30; // 0
    buf[0x8004] = 0x30; // 0
    buf[0x8005] = 0x31; // 1
    expect(matchesRule(buf, iso)).toBe(true);
  });
  it("matches trailer-based signature (WebP)", () => {
    const webp = SIGNATURES.find((r) => r.id === "webp")!;
    const bytes = u8([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(matchesRule(bytes, webp)).toBe(true);
  });
  it("rejects trailer mismatch (AVI but not WebP trailer)", () => {
    const webp = SIGNATURES.find((r) => r.id === "webp")!;
    const bytes = u8([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]);
    expect(matchesRule(bytes, webp)).toBe(false);
  });
});

describe("binary-signature detectAll", () => {
  it("detects a PNG file", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const matches = detectAll(bytes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].rule.id).toBe("png");
  });
  it("detects a JPEG file", () => {
    const bytes = u8([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const matches = detectAll(bytes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].rule.id).toBe("jpg");
  });
  it("detects an ELF executable", () => {
    const bytes = u8([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const matches = detectAll(bytes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].rule.id).toBe("elf");
  });
  it("detects a PDF document", () => {
    const bytes = u8(Array.from("%PDF-1.5\n%¥±ë\n".split("").map((c) => c.charCodeAt(0) & 0xff)));
    const matches = detectAll(bytes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].rule.id).toBe("pdf");
  });
  it("returns empty for unknown bytes", () => {
    const bytes = u8([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const matches = detectAll(bytes);
    expect(matches).toHaveLength(0);
  });
  it("detectPrimary returns first match", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const p = detectPrimary(bytes);
    expect(p).not.toBeNull();
    expect(p!.rule.id).toBe("png");
  });
  it("detectPrimary returns null for unknown", () => {
    expect(detectPrimary(u8([0x01, 0x02, 0x03]))).toBeNull();
  });
  it("assigns higher confidence to longer patterns", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const matches = detectAll(bytes);
    expect(matches[0].confidence).toBe("high");
  });
});

describe("binary-signature ZIP disambiguation", () => {
  it("detects a generic ZIP without markers", () => {
    // PK\x03\x04 + minimal local-file header (no recognized marker names)
    const bytes = u8([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00]);
    const info = detectZipSubtype(bytes);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe("zip");
  });
  it("detects a DOCX by marker", () => {
    // Build a fake ZIP central directory entry containing "word/document.xml"
    const marker = "word/document.xml";
    const bytes = u8([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
      ...Array.from(marker).map((c) => c.charCodeAt(0)),
    ]);
    const info = detectZipSubtype(bytes);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe("docx");
  });
  it("detects an EPUB by marker", () => {
    const marker = "META-INF/container.xml";
    const bytes = u8([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
      ...Array.from(marker).map((c) => c.charCodeAt(0)),
    ]);
    const info = detectZipSubtype(bytes);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe("epub");
  });
  it("returns null for non-ZIP bytes", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47]);
    expect(detectZipSubtype(bytes)).toBeNull();
  });
  it("detects APK", () => {
    const marker = "AndroidManifest.xml";
    const bytes = u8([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
      ...Array.from(marker).map((c) => c.charCodeAt(0)),
    ]);
    const info = detectZipSubtype(bytes);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe("apk");
  });
});

describe("binary-signature extension spoof", () => {
  it("extracts extension from filename", () => {
    expect(extractExtension("photo.png")).toBe("png");
    expect(extractExtension("/tmp/photo.JPG")).toBe("jpg");
    expect(extractExtension("noext")).toBe("");
    expect(extractExtension("trailing.")).toBe("");
    expect(extractExtension("a/b.c.d")).toBe("d");
  });
  it("extensionMatches true for matching ext", () => {
    const png = SIGNATURES.find((r) => r.id === "png")!;
    expect(extensionMatches("png", png)).toBe(true);
    expect(extensionMatches("jpg", png)).toBe(false);
    expect(extensionMatches("", png)).toBe(false);
  });
  it("detect() reports MATCH when ext matches signature", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detect(bytes, "photo.png");
    expect(result.verdict).toBe("match");
    expect(result.extensionSpoofed).toBe(false);
    expect(result.primary!.rule.id).toBe("png");
  });
  it("detect() reports SPOOF when PNG bytes have .jpg extension (blueprint AC1)", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detect(bytes, "actually-a-png.jpg");
    expect(result.verdict).toBe("spoof");
    expect(result.extensionSpoofed).toBe(true);
    expect(result.primary!.rule.id).toBe("png");
  });
  it("detect() reports UNKNOWN when no signature and text", () => {
    const text = "Hello, world! This is just a plain text file.";
    const bytes = u8(Array.from(text).map((c) => c.charCodeAt(0)));
    const result = detect(bytes, "notes.txt");
    expect(result.verdict).toBe("unknown");
    expect(result.primary).toBeNull();
    expect(result.isPlainText).toBe(true);
  });
  it("detect() works without filename", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detect(bytes);
    expect(result.verdict).toBe("match");
  });
});

describe("binary-signature search", () => {
  it("searches by extension substring", () => {
    const results = searchSignatures({ query: "png" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === "png")).toBe(true);
  });
  it("searches by MIME substring", () => {
    const results = searchSignatures({ query: "application/pdf" });
    expect(results.some((r) => r.id === "pdf")).toBe(true);
  });
  it("searches by name substring", () => {
    const results = searchSignatures({ query: "ELF" });
    expect(results.some((r) => r.id === "elf")).toBe(true);
  });
  it("searches by hex bytes", () => {
    const results = searchSignatures({ query: "89504E47" });
    expect(results.some((r) => r.id === "png")).toBe(true);
  });
  it("filters by category", () => {
    const results = searchSignatures({ category: "font" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === "font")).toBe(true);
  });
  it("respects limit", () => {
    const results = searchSignatures({ limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });
  it("returns all when no filter", () => {
    const results = searchSignatures();
    expect(results.length).toBe(SIGNATURES.length);
  });
});

describe("binary-signature groupByCategory", () => {
  it("groups all rules", () => {
    const groups = groupByCategory(SIGNATURES);
    const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(SIGNATURES.length);
  });
  it("every key is a valid category", () => {
    const groups = groupByCategory(SIGNATURES);
    for (const key of Object.keys(groups) as FileCategory[]) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
    }
  });
});

describe("binary-signature history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "test.png", fileSize: 100,
      detectedName: "PNG image", verdict: "match", hexPreview: "89504E47",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].fileName).toBe("test.png");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `test-${i}.bin`, fileSize: i,
        detectedName: "Test", verdict: "unknown", hexPreview: "00",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x", fileSize: 1,
      detectedName: "X", verdict: "match", hexPreview: "00",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("binary-signature shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(u8([0x89, 0x50, 0x4e, 0x47]));
    expect(url).toContain("hex=89504E47");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("marks truncated for large input", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const big = new Uint8Array(2048);
    const url = buildShareUrl(big);
    expect(url).toContain("truncated=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("hex=89504E47");
    expect(p.bytes).toEqual(u8([0x89, 0x50, 0x4e, 0x47]));
    expect(p.truncated).toBe(false);
  });
  it("parses truncated URL", () => {
    const p = parseShareUrl("truncated=1&size=2048");
    expect(p.bytes.length).toBe(0);
    expect(p.truncated).toBe(true);
    expect(p.originalSize).toBe(2048);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ bytes: new Uint8Array(0), truncated: false, originalSize: 0 });
  });
});

describe("binary-signature report", () => {
  it("renders match report", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detect(bytes, "test.png");
    const report = renderReport(bytes, "test.png", result);
    expect(report).toContain("MATCH");
    expect(report).toContain("PNG image");
    expect(report).toContain("89 50 4E 47");
  });
  it("renders spoof report with warning", () => {
    const bytes = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detect(bytes, "actually-png.jpg");
    const report = renderReport(bytes, "actually-png.jpg", result);
    expect(report).toContain("SPOOF");
    expect(report).toContain("WARNING");
  });
  it("renders unknown report", () => {
    const bytes = u8([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const result = detect(bytes, "unknown.bin");
    const report = renderReport(bytes, "unknown.bin", result);
    expect(report).toContain("UNKNOWN");
  });
});

// Suppress unused-import lint
export type _Unused = FileCategory | SignatureRule;
