import { describe, it, expect, beforeEach } from "vitest";
import {
  BARCODE_TYPES,
  BARCODE_TYPE_LABELS,
  BARCODE_POSITIONS,
  POSITION_LABELS,
  MIN_BAR_WIDTH,
  MAX_BAR_WIDTH,
  DEFAULT_BAR_WIDTH,
  DEFAULT_BAR_HEIGHT,
  DEFAULT_MARGIN,
  MAX_BATCH,
  parseBarcodeData,
  expandPageToken,
  normalizeType,
  validateBarcode,
  validateCode128,
  validateEan13,
  validateUpc,
  validateCode39,
  validateItf,
  calculateEan13Checksum,
  calculateUpcChecksum,
  encodeCode128,
  encodeEan13,
  encodeUpc,
  encodeCode39,
  encodeItf,
  encodeBarcode,
  barsToRectangles,
  calculateBarcodeWidth,
  calculateBarcodePosition,
  calculateTextPosition,
  parseHexColor,
  rgbToHex,
  computeStats,
  renderTextReport,
  renderCsv,
  suggestBarcodeType,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BarcodeEntry,
  type BarcodeType,
  type BarcodePosition,
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

describe("barcode-stamper constants", () => {
  it("exposes 5 barcode types", () => {
    expect(BARCODE_TYPES).toHaveLength(5);
    expect(BARCODE_TYPES).toContain("CODE128");
    expect(BARCODE_TYPES).toContain("ITF");
  });
  it("exposes 6 positions", () => {
    expect(BARCODE_POSITIONS).toHaveLength(6);
    expect(BARCODE_POSITIONS).not.toContain("center");
  });
  it("has labels for every type", () => {
    for (const t of BARCODE_TYPES) expect(BARCODE_TYPE_LABELS[t]).toBeTruthy();
  });
  it("has labels for every position", () => {
    for (const p of BARCODE_POSITIONS) expect(POSITION_LABELS[p]).toBeTruthy();
  });
  it("max batch is reasonable", () => {
    expect(MAX_BATCH).toBeGreaterThanOrEqual(100);
  });
});

describe("barcode-stamper normalizeType", () => {
  it("accepts canonical types", () => {
    expect(normalizeType("CODE128")).toBe("CODE128");
    expect(normalizeType("EAN13")).toBe("EAN13");
    expect(normalizeType("UPC")).toBe("UPC");
    expect(normalizeType("CODE39")).toBe("CODE39");
    expect(normalizeType("ITF")).toBe("ITF");
  });
  it("accepts case variations and dashes", () => {
    expect(normalizeType("code128")).toBe("CODE128");
    expect(normalizeType("ean-13")).toBe("EAN13");
    expect(normalizeType("upc-a")).toBe("UPC");
    expect(normalizeType("code_39")).toBe("CODE39");
  });
  it("accepts aliases", () => {
    expect(normalizeType("C128")).toBe("CODE128");
    expect(normalizeType("EAN")).toBe("EAN13");
    expect(normalizeType("UPCA")).toBe("UPC");
    expect(normalizeType("C39")).toBe("CODE39");
    expect(normalizeType("I25")).toBe("ITF");
    expect(normalizeType("INTERLEAVED25")).toBe("ITF");
  });
  it("returns null for unknown types", () => {
    expect(normalizeType("QR")).toBeNull();
    expect(normalizeType("")).toBeNull();
    expect(normalizeType("XYZ")).toBeNull();
  });
});

describe("barcode-stamper expandPageToken", () => {
  it("expands all", () => {
    expect(expandPageToken("all", 4)).toEqual([0, 1, 2, 3]);
  });
  it("supports single numbers", () => {
    expect(expandPageToken("2", 5)).toEqual([1]);
  });
  it("supports ranges", () => {
    expect(expandPageToken("2-3", 5)).toEqual([1, 2]);
  });
  it("supports open-ended range", () => {
    expect(expandPageToken("3-", 5)).toEqual([2, 3, 4]);
  });
  it("supports comma-separated", () => {
    expect(expandPageToken("1,3", 5)).toEqual([0, 2]);
  });
  it("returns empty for out-of-range", () => {
    expect(expandPageToken("99", 5)).toEqual([]);
  });
  it("returns empty for invalid", () => {
    expect(expandPageToken("abc", 5)).toEqual([]);
  });
});

describe("barcode-stamper parseBarcodeData", () => {
  it("parses pipe-separated entries", () => {
    const entries = parseBarcodeData("1|CODE128|hello\n2|EAN13|123456789012", 3);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("CODE128");
    expect(entries[0].data).toBe("hello");
    expect(entries[0].pageIndices).toEqual([0]);
    expect(entries[1].type).toBe("EAN13");
  });
  it("parses comma-separated entries", () => {
    const entries = parseBarcodeData("1,CODE39,ABC123", 3);
    expect(entries[0].type).toBe("CODE39");
    expect(entries[0].data).toBe("ABC123");
  });
  it("supports 'all' page token", () => {
    const entries = parseBarcodeData("all|CODE128|X", 3);
    expect(entries[0].pageIndices).toEqual([0, 1, 2]);
    expect(entries[0].pageToken).toBe("all");
  });
  it("supports ranges", () => {
    const entries = parseBarcodeData("2-3|CODE128|X", 5);
    expect(entries[0].pageIndices).toEqual([1, 2]);
  });
  it("skips blank and comment lines", () => {
    const entries = parseBarcodeData("\n# comment\n1|CODE128|X\n", 3);
    expect(entries).toHaveLength(1);
  });
  it("treats no-separator line as CODE128 on all pages", () => {
    const entries = parseBarcodeData("plain data here", 2);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("CODE128");
    expect(entries[0].data).toBe("plain data here");
    expect(entries[0].pageIndices).toEqual([0, 1]);
  });
  it("drops entries with invalid type", () => {
    const entries = parseBarcodeData("1|UNKNOWN|data", 3);
    expect(entries).toHaveLength(0);
  });
  it("drops entries with invalid page token", () => {
    const entries = parseBarcodeData("99|CODE128|X\n1|CODE128|Y", 3);
    expect(entries).toHaveLength(1);
    expect(entries[0].data).toBe("Y");
  });
  it("returns empty for empty input", () => {
    expect(parseBarcodeData("", 3)).toEqual([]);
  });
});

describe("barcode-stamper validators", () => {
  it("validateCode128 accepts printable ASCII", () => {
    expect(validateCode128("Hello!").ok).toBe(true);
    expect(validateCode128("A-Z 0-9 ~").ok).toBe(true);
  });
  it("validateCode128 rejects non-ASCII", () => {
    expect(validateCode128("héllo").ok).toBe(false);
    expect(validateCode128("日本").ok).toBe(false);
  });
  it("validateCode128 rejects empty", () => {
    expect(validateCode128("").ok).toBe(false);
  });
  it("validateEan13 accepts 12 or 13 digits", () => {
    expect(validateEan13("123456789012").ok).toBe(true);
    expect(validateEan13("1234567890123").ok).toBe(true);
  });
  it("validateEan13 rejects non-digits", () => {
    expect(validateEan13("12345678901A").ok).toBe(false);
  });
  it("validateEan13 rejects wrong length", () => {
    expect(validateEan13("123").ok).toBe(false);
  });
  it("validateUpc accepts 11 or 12 digits", () => {
    expect(validateUpc("12345678901").ok).toBe(true);
    expect(validateUpc("123456789012").ok).toBe(true);
  });
  it("validateUpc rejects non-digits", () => {
    expect(validateUpc("1234567890X").ok).toBe(false);
  });
  it("validateCode39 accepts charset", () => {
    expect(validateCode39("ABC123").ok).toBe(true);
    expect(validateCode39("A-B.C").ok).toBe(true);
    expect(validateCode39("$100 + TAX").ok).toBe(true);
  });
  it("validateCode39 rejects lowercase + non-charset", () => {
    expect(validateCode39("abc").ok).toBe(false);
    expect(validateCode39("@home").ok).toBe(false);
  });
  it("validateItf accepts even digit count", () => {
    expect(validateItf("1234").ok).toBe(true);
    expect(validateItf("123456").ok).toBe(true);
  });
  it("validateItf rejects odd digit count", () => {
    expect(validateItf("123").ok).toBe(false);
  });
  it("validateItf rejects non-digits", () => {
    expect(validateItf("12A4").ok).toBe(false);
  });
  it("validateBarcode dispatches to per-type validator", () => {
    expect(validateBarcode("CODE128", "ok").ok).toBe(true);
    expect(validateBarcode("EAN13", "123").ok).toBe(false);
    expect(validateBarcode("UPC", "123456789012").ok).toBe(true);
    expect(validateBarcode("CODE39", "ABC").ok).toBe(true);
    expect(validateBarcode("ITF", "12").ok).toBe(true);
  });
});

describe("barcode-stamper checksums", () => {
  it("calculateEan13Checksum returns valid digit for 12 digits", () => {
    expect(calculateEan13Checksum("123456789012")).toBeGreaterThanOrEqual(0);
    expect(calculateEan13Checksum("123456789012")).toBeLessThan(10);
  });
  it("calculateEan13Checksum is deterministic", () => {
    const a = calculateEan13Checksum("123456789012");
    const b = calculateEan13Checksum("123456789012");
    expect(a).toBe(b);
  });
  it("calculateEan13Checksum returns -1 for invalid input", () => {
    expect(calculateEan13Checksum("123")).toBe(-1);
    expect(calculateEan13Checksum("12345678901A")).toBe(-1);
  });
  it("known EAN-13 checksum: 4006381333931 → 1", () => {
    // 400638133393 → check digit 1 → 4006381333931
    expect(calculateEan13Checksum("400638133393")).toBe(1);
  });
  it("calculateUpcChecksum returns valid digit for 11 digits", () => {
    expect(calculateUpcChecksum("12345678901")).toBeGreaterThanOrEqual(0);
    expect(calculateUpcChecksum("12345678901")).toBeLessThan(10);
  });
  it("calculateUpcChecksum returns -1 for invalid input", () => {
    expect(calculateUpcChecksum("123")).toBe(-1);
  });
});

describe("barcode-stamper encoders", () => {
  it("encodeCode128 produces bars starting with start pattern", () => {
    const bars = encodeCode128("A");
    expect(bars.length).toBeGreaterThan(0);
    expect(bars[0].isBar).toBe(true);
  });
  it("encodeCode128 produces deterministic output", () => {
    const a = encodeCode128("ABC");
    const b = encodeCode128("ABC");
    expect(a).toEqual(b);
  });
  it("encodeEan13 produces bars with start guard", () => {
    const bars = encodeEan13("123456789012");
    expect(bars.length).toBeGreaterThan(0);
    expect(bars[0].isBar).toBe(true);
  });
  it("encodeEan13 includes start, center, and end guards", () => {
    const bars = encodeEan13("123456789012");
    // Start guard = 3 modules (bar-space-bar) → first 3 entries alternate
    expect(bars[0].width).toBe(1);
    expect(bars[0].isBar).toBe(true);
    expect(bars[1].width).toBe(1);
    expect(bars[1].isBar).toBe(false);
    expect(bars[2].width).toBe(1);
    expect(bars[2].isBar).toBe(true);
  });
  it("encodeUpc produces same pattern as EAN-13 with leading 0", () => {
    const upc = encodeUpc("12345678901");
    const ean = encodeEan13("012345678901");
    expect(upc).toEqual(ean);
  });
  it("encodeCode39 wraps data with start/stop *", () => {
    const bars = encodeCode39("ABC");
    // Each char produces 9 elements + 1 gap between (except after last)
    // Pattern: * + gap + A + gap + B + gap + C + gap + * (no gap after last)
    // Total elements = 9*5 + 4 = 49
    expect(bars.length).toBe(49);
  });
  it("encodeCode39 is uppercase-insensitive", () => {
    const a = encodeCode39("abc");
    const b = encodeCode39("ABC");
    expect(a).toEqual(b);
  });
  it("encodeItf requires even digit count", () => {
    // "12" → start (4) + 1 pair (10) + end (3) = 17
    const bars = encodeItf("12");
    expect(bars.length).toBe(17);
  });
  it("encodeItf interleaves bar/space for digit pairs", () => {
    const bars = encodeItf("12");
    // After start guard (4 narrow modules), the first pair should produce
    // 10 elements alternating bar/space starting with bar.
    expect(bars[4].isBar).toBe(true);
    expect(bars[5].isBar).toBe(false);
  });
  it("encodeBarcode dispatches to per-type encoder", () => {
    expect(encodeBarcode("CODE128", "X").length).toBeGreaterThan(0);
    expect(encodeBarcode("EAN13", "123456789012").length).toBeGreaterThan(0);
    expect(encodeBarcode("UPC", "12345678901").length).toBeGreaterThan(0);
    expect(encodeBarcode("CODE39", "ABC").length).toBeGreaterThan(0);
    expect(encodeBarcode("ITF", "1234").length).toBeGreaterThan(0);
  });
  it("encoded EAN-13 entry has 13-digit checksum", () => {
    const entries = parseBarcodeData("1|EAN13|123456789012", 3);
    expect(entries[0].valid).toBe(true);
    expect(entries[0].encodedData).toHaveLength(13);
    // Last digit should be the checksum
    const expected = calculateEan13Checksum("123456789012");
    expect(entries[0].encodedData.endsWith(String(expected))).toBe(true);
  });
});

describe("barcode-stamper barsToRectangles + width", () => {
  it("produces a rectangle for each dark bar", () => {
    const bars = [
      { width: 2, isBar: true },
      { width: 1, isBar: false },
      { width: 3, isBar: true },
    ];
    const rects = barsToRectangles(bars, 100, 50, 1, 30);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 100, y: 50, width: 2, height: 30 });
    expect(rects[1]).toEqual({ x: 103, y: 50, width: 3, height: 30 });
  });
  it("skips spaces", () => {
    const bars = [
      { width: 1, isBar: false },
      { width: 2, isBar: true },
    ];
    const rects = barsToRectangles(bars, 0, 0, 1, 10);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBe(1); // after the 1-unit space
  });
  it("calculateBarcodeWidth sums widths × moduleSize", () => {
    const bars = [
      { width: 2, isBar: true },
      { width: 1, isBar: false },
      { width: 3, isBar: true },
    ];
    expect(calculateBarcodeWidth(bars, 1)).toBe(6);
    expect(calculateBarcodeWidth(bars, 2)).toBe(12);
  });
});

describe("barcode-stamper calculateBarcodePosition", () => {
  const W = 595, H = 842, BW = 200, BH = 60, M = 10;
  it("top-left: margin from top-left", () => {
    const p = calculateBarcodePosition("top-left", W, H, BW, BH, M);
    expect(p.x).toBe(M);
    expect(p.y).toBe(H - BH - M);
  });
  it("bottom-right: aligned to bottom-right", () => {
    const p = calculateBarcodePosition("bottom-right", W, H, BW, BH, M);
    expect(p.x).toBe(W - BW - M);
    expect(p.y).toBe(M);
  });
  it("top-center: horizontally centered", () => {
    const p = calculateBarcodePosition("top-center", W, H, BW, BH, M);
    expect(p.x).toBe((W - BW) / 2);
    expect(p.y).toBe(H - BH - M);
  });
  it("clamps margin if barcode wider than page", () => {
    const p = calculateBarcodePosition("top-left", 100, 100, 200, 60, 1000);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });
});

describe("barcode-stamper calculateTextPosition", () => {
  it("centers text below barcode", () => {
    const p = calculateTextPosition(100, 700, 200, 60, 80, 8, 842);
    expect(p.labelX).toBe(100 + (200 - 80) / 2); // 160
    expect(p.labelY).toBeLessThan(700);
  });
  it("clamps label to non-negative y", () => {
    const p = calculateTextPosition(100, 5, 200, 60, 80, 8, 842);
    expect(p.labelY).toBeGreaterThanOrEqual(0);
  });
});

describe("barcode-stamper color parser", () => {
  it("parses #RRGGBB", () => {
    expect(parseHexColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
  });
  it("parses #RGB shorthand", () => {
    expect(parseHexColor("#f00")).toEqual({ r: 1, g: 0, b: 0 });
  });
  it("returns null for invalid", () => {
    expect(parseHexColor("xyz")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });
  it("round-trips through rgbToHex", () => {
    const hex = rgbToHex({ r: 0.5, g: 0.25, b: 0.75 });
    const back = parseHexColor(hex);
    expect(back).not.toBeNull();
    expect(back!.r).toBeCloseTo(0.5, 1);
  });
});

describe("barcode-stamper computeStats", () => {
  it("computes per-type + per-page counts", () => {
    const entries = parseBarcodeData("1|CODE128|X\nall|EAN13|123456789012", 3);
    const stats = computeStats(entries);
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalStamps).toBe(1 + 3);
    expect(stats.byType.CODE128).toBe(1);
    expect(stats.byType.EAN13).toBe(1);
    expect(stats.byPage[0]).toBe(2); // entry 1 + all on page 0
    expect(stats.validCount).toBe(2);
    expect(stats.invalidCount).toBe(0);
  });
  it("counts invalid entries", () => {
    const entries = parseBarcodeData("1|EAN13|abc", 3);
    const stats = computeStats(entries);
    expect(stats.invalidCount).toBe(1);
    expect(stats.validCount).toBe(0);
  });
  it("handles empty entries", () => {
    expect(computeStats([]).totalEntries).toBe(0);
  });
});

describe("barcode-stamper renderTextReport + renderCsv", () => {
  it("text report includes summary + per-entry", () => {
    const entries = parseBarcodeData("1|CODE128|X\n2|EAN13|123456789012", 3);
    const stats = computeStats(entries);
    const text = renderTextReport(entries, stats);
    expect(text).toContain("Barcode Stamp Report");
    expect(text).toContain("CODE128");
    expect(text).toContain("EAN13");
  });
  it("CSV has header + rows", () => {
    const entries = parseBarcodeData("1|CODE128|hello,world", 3);
    const csv = renderCsv(entries);
    expect(csv).toContain("page,type,data,encoded,valid,error");
    expect(csv).toContain("1,CODE128");
    // Data with comma should be CSV-escaped
    expect(csv).toContain('"hello,world"');
  });
});

describe("barcode-stamper suggestBarcodeType", () => {
  it("suggests UPC for 12 digits", () => {
    expect(suggestBarcodeType("123456789012")).toBe("UPC");
  });
  it("suggests EAN-13 for 13 digits", () => {
    expect(suggestBarcodeType("1234567890123")).toBe("EAN13");
  });
  it("suggests ITF for even digit count ≥ 4", () => {
    expect(suggestBarcodeType("1234")).toBe("ITF");
    expect(suggestBarcodeType("123456")).toBe("ITF");
  });
  it("suggests Code39 for alphanumeric in charset", () => {
    expect(suggestBarcodeType("ABC-123")).toBe("CODE39");
  });
  it("falls back to CODE128 for special chars", () => {
    expect(suggestBarcodeType("hello@world")).toBe("CODE128");
    expect(suggestBarcodeType("héllo")).toBe("CODE128");
  });
  it("defaults to CODE128 for empty", () => {
    expect(suggestBarcodeType("")).toBe("CODE128");
  });
});

describe("barcode-stamper history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entries = parseBarcodeData("1|CODE128|X", 3);
    const stats = computeStats(entries);
    saveHistory({ ts: 1, entries, stats });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].stats.totalStamps).toBe(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, entries: [], stats: computeStats([]) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, entries: [], stats: computeStats([]) });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("barcode-stamper shareable URL", () => {
  it("builds URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1|CODE128|X", "top-right", 220, 70, true, "#000000", "#FFFFFF", 20);
    expect(url).toContain("data=1");
    expect(url).toContain("pos=top-right");
    expect(url).toContain("w=220");
    expect(url).toContain("h=70");
    expect(url).toContain("text=1");
    expect(url).toContain("color=%23000000");
    expect(url).toContain("margin=20");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits margin param when equal to default", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("X", "bottom-center", DEFAULT_BAR_WIDTH, DEFAULT_BAR_HEIGHT, false, "#000000", "#FFFFFF", DEFAULT_MARGIN);
    expect(url).not.toContain("margin=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1|CODE128|X", "bottom-left", 250, 80, true, "#ff0000", "#ffffff", 30);
    (globalThis as Record<string, unknown>).window = origWindow;
    const parsed = parseShareUrl(url);
    expect(parsed.data).toBe("1|CODE128|X");
    expect(parsed.position).toBe("bottom-left");
    expect(parsed.width).toBe(250);
    expect(parsed.height).toBe(80);
    expect(parsed.includeText).toBe(true);
    expect(parsed.color).toBe("#ff0000");
    expect(parsed.margin).toBe(30);
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.data).toBe("");
    expect(p.position).toBe("bottom-center");
    expect(p.width).toBe(DEFAULT_BAR_WIDTH);
    expect(p.height).toBe(DEFAULT_BAR_HEIGHT);
    expect(p.includeText).toBe(true);
  });
  it("filters invalid position to default", () => {
    const p = parseShareUrl("pos=invalid");
    expect(p.position).toBe("bottom-center");
  });
  it("clamps out-of-range width to bounds", () => {
    const p = parseShareUrl("w=99999");
    expect(p.width).toBe(MAX_BAR_WIDTH);
    const p2 = parseShareUrl("w=1");
    expect(p2.width).toBe(MIN_BAR_WIDTH);
  });
});

// Suppress unused-import lint
export type _Unused = BarcodeEntry | BarcodeType | BarcodePosition;
