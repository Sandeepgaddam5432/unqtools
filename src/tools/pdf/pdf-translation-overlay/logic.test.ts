import { describe, it, expect, beforeEach } from "vitest";
import {
  OVERLAY_POSITIONS,
  POSITION_LABELS,
  FONT_FAMILIES,
  FONT_LABELS,
  FONT_WIDTH_FACTORS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_COLOR,
  DEFAULT_POSITION,
  normalizePageRangeSpec,
  resolveAllRange,
  expandPageRange,
  parseTranslations,
  validateEntries,
  calculateOverlayPosition,
  parseHexColor,
  rgbToHex,
  normalizeFontFamily,
  validateFontSize,
  estimateTextWidth,
  estimateTextHeight,
  computeBackgroundRect,
  rectsOverlap,
  detectCollisions,
  detectTextDirection,
  detectLanguage,
  isRtlLanguage,
  reverseForRtl,
  applyRtlHandling,
  computeOverlays,
  computeStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TranslationEntry,
  type OverlayOptions,
  type OverlayPosition,
  type FontFamily,
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

describe("pdf-translation-overlay constants", () => {
  it("exposes 4 position presets", () => {
    expect(OVERLAY_POSITIONS).toHaveLength(4);
    expect(OVERLAY_POSITIONS).toContain("above-original");
    expect(OVERLAY_POSITIONS).toContain("below-original");
    expect(OVERLAY_POSITIONS).toContain("beside-original");
    expect(OVERLAY_POSITIONS).toContain("replace-original");
  });
  it("has labels for every position", () => {
    for (const p of OVERLAY_POSITIONS) {
      expect(POSITION_LABELS[p]).toBeTruthy();
    }
  });
  it("exposes 3 font families", () => {
    expect(FONT_FAMILIES).toHaveLength(3);
    expect(FONT_FAMILIES).toContain("Helvetica");
    expect(FONT_FAMILIES).toContain("Times-Roman");
    expect(FONT_FAMILIES).toContain("Courier");
  });
  it("has labels for every font family", () => {
    for (const f of FONT_FAMILIES) {
      expect(FONT_LABELS[f]).toBeTruthy();
    }
  });
  it("font width factors are sane", () => {
    expect(FONT_WIDTH_FACTORS.Helvetica).toBeGreaterThan(0);
    expect(FONT_WIDTH_FACTORS.Courier).toBeGreaterThan(FONT_WIDTH_FACTORS["Times-Roman"]);
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_FONT_SIZE).toBe(10);
    expect(DEFAULT_FONT_FAMILY).toBe("Helvetica");
    expect(DEFAULT_TEXT_COLOR).toBe("#FF0000");
    expect(DEFAULT_POSITION).toBe("below-original");
    expect(MIN_FONT_SIZE).toBeLessThan(MAX_FONT_SIZE);
  });
});

describe("pdf-translation-overlay normalizePageRangeSpec", () => {
  it("returns 'all' for empty / 'all' / '*'", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("ALL")).toBe("all");
    expect(normalizePageRangeSpec("*")).toBe("all");
  });
  it("strips whitespace", () => {
    expect(normalizePageRangeSpec("  1 - 3 , 5 ")).toBe("1-3,5");
  });
});

describe("pdf-translation-overlay resolveAllRange", () => {
  it("resolves 'all' to 1-pageCount", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("ALL", 1)).toBe("1-1");
  });
  it("returns the spec as-is when not 'all'", () => {
    expect(resolveAllRange("1-3, 5", 10)).toBe("1-3,5");
  });
  it("returns '1' when pageCount is 0", () => {
    expect(resolveAllRange("all", 0)).toBe("1");
  });
});

describe("pdf-translation-overlay expandPageRange", () => {
  it("expands 'all' to every page index", () => {
    expect(expandPageRange("all", 4)).toEqual([0, 1, 2, 3]);
  });
  it("supports single numbers", () => {
    expect(expandPageRange("2", 5)).toEqual([1]);
  });
  it("supports ranges", () => {
    expect(expandPageRange("2-4", 5)).toEqual([1, 2, 3]);
  });
  it("supports comma-separated", () => {
    expect(expandPageRange("1,3,5", 5)).toEqual([0, 2, 4]);
  });
  it("supports open-ended range", () => {
    expect(expandPageRange("3-", 5)).toEqual([2, 3, 4]);
  });
  it("supports range from start", () => {
    expect(expandPageRange("-2", 5)).toEqual([0, 1]);
  });
  it("returns null for invalid spec", () => {
    expect(expandPageRange("abc", 5)).toBeNull();
    expect(expandPageRange("6", 5)).toBeNull();
    expect(expandPageRange("3-1", 5)).toBeNull();
  });
});

describe("pdf-translation-overlay parseTranslations", () => {
  it("parses a single pipe-separated entry", () => {
    const out = parseTranslations("1|72|700|Hello|12", 5);
    expect(out).toHaveLength(1);
    expect(out[0].page).toBe(1);
    expect(out[0].pageIndex).toBe(0);
    expect(out[0].x).toBe(72);
    expect(out[0].y).toBe(700);
    expect(out[0].text).toBe("Hello");
    expect(out[0].fontSize).toBe(12);
  });
  it("parses a comma-separated entry", () => {
    const out = parseTranslations("1,72,700,Hello,12", 5);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Hello");
  });
  it("supports 4-field entries (no font_size)", () => {
    const out = parseTranslations("2|100|200|World", 5);
    expect(out).toHaveLength(1);
    expect(out[0].fontSize).toBe(0);
  });
  it("supports multi-line entries", () => {
    const input = "1|72|700|Hello|12\n2|72|700|World|10\n# comment\n\n3|72|700|Foo";
    const out = parseTranslations(input, 5);
    expect(out).toHaveLength(3);
    expect(out[0].text).toBe("Hello");
    expect(out[1].text).toBe("World");
    expect(out[2].text).toBe("Foo");
  });
  it("handles quoted text with commas", () => {
    const out = parseTranslations('1|72|700|"Hello, World"|12', 5);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Hello, World");
  });
  it("skips lines with missing fields", () => {
    const out = parseTranslations("1|72|700", 5);
    expect(out).toHaveLength(0);
  });
  it("skips lines with non-numeric page", () => {
    const out = parseTranslations("abc|72|700|Hello", 5);
    expect(out).toHaveLength(0);
  });
  it("skips lines with empty text", () => {
    const out = parseTranslations("1|72|700|   |12", 5);
    expect(out).toHaveLength(0);
  });
  it("clamps pageIndex into range", () => {
    const out = parseTranslations("100|72|700|Hello", 5);
    expect(out).toHaveLength(1);
    expect(out[0].pageIndex).toBe(4); // clamped to last page
  });
});

describe("pdf-translation-overlay validateEntries", () => {
  it("returns null for valid entries", () => {
    const entries = parseTranslations("1|72|700|Hello", 5);
    expect(validateEntries(entries, 5)).toBeNull();
  });
  it("returns error for empty entries", () => {
    expect(validateEntries([], 5)).toMatch(/at least one/);
  });
  it("returns error for out-of-range page", () => {
    // pageIndex is 0-based; craft an entry with pageIndex out of range
    const entries: TranslationEntry[] = [{
      page: 10, pageIndex: 9, x: 72, y: 700, text: "Hi", fontSize: 12, pageToken: "10",
    }];
    const err = validateEntries(entries, 5);
    expect(err).toMatch(/out of range/);
  });
});

describe("pdf-translation-overlay calculateOverlayPosition", () => {
  it("above-original moves overlay up", () => {
    const r = calculateOverlayPosition("above-original", 100, 200, 10, 12);
    expect(r.x).toBe(100);
    expect(r.y).toBeGreaterThan(200);
  });
  it("below-original moves overlay down", () => {
    const r = calculateOverlayPosition("below-original", 100, 200, 10, 12);
    expect(r.x).toBe(100);
    expect(r.y).toBeLessThan(200);
  });
  it("beside-original moves overlay right", () => {
    const r = calculateOverlayPosition("beside-original", 100, 200, 10, 12);
    expect(r.x).toBeGreaterThan(100);
    expect(r.y).toBe(200);
  });
  it("replace-original keeps position", () => {
    const r = calculateOverlayPosition("replace-original", 100, 200, 10, 12);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
  });
});

describe("pdf-translation-overlay parseHexColor", () => {
  it("parses 6-digit hex", () => {
    const c = parseHexColor("#FF0000");
    expect(c).toEqual({ r: 1, g: 0, b: 0 });
  });
  it("parses 3-digit hex", () => {
    const c = parseHexColor("#0f0");
    expect(c).toEqual({ r: 0, g: 1, b: 0 });
  });
  it("parses without # prefix", () => {
    const c = parseHexColor("00ff00");
    expect(c).toEqual({ r: 0, g: 1, b: 0 });
  });
  it("returns null for invalid", () => {
    expect(parseHexColor("#xyz")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });
});

describe("pdf-translation-overlay rgbToHex", () => {
  it("round-trips parseHexColor", () => {
    const hex = "#a1b2c3";
    const c = parseHexColor(hex)!;
    expect(rgbToHex(c)).toBe(hex);
  });
});

describe("pdf-translation-overlay normalizeFontFamily", () => {
  it("normalizes various names", () => {
    expect(normalizeFontFamily("Helvetica")).toBe("Helvetica");
    expect(normalizeFontFamily("helvetica")).toBe("Helvetica");
    expect(normalizeFontFamily("Times")).toBe("Times-Roman");
    expect(normalizeFontFamily("times roman")).toBe("Times-Roman");
    expect(normalizeFontFamily("serif")).toBe("Times-Roman");
    expect(normalizeFontFamily("Courier")).toBe("Courier");
    expect(normalizeFontFamily("monospace")).toBe("Courier");
    expect(normalizeFontFamily("unknown")).toBe("Helvetica");
  });
});

describe("pdf-translation-overlay validateFontSize", () => {
  it("accepts in-range sizes", () => {
    expect(validateFontSize(10).ok).toBe(true);
    expect(validateFontSize(10).value).toBe(10);
  });
  it("rejects non-numbers", () => {
    expect(validateFontSize(NaN).ok).toBe(false);
  });
  it("rejects too-small sizes", () => {
    const r = validateFontSize(1);
    expect(r.ok).toBe(false);
    expect(r.value).toBe(MIN_FONT_SIZE);
  });
  it("rejects too-large sizes", () => {
    const r = validateFontSize(200);
    expect(r.ok).toBe(false);
    expect(r.value).toBe(MAX_FONT_SIZE);
  });
});

describe("pdf-translation-overlay estimateTextWidth", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTextWidth("", 10)).toBe(0);
  });
  it("scales with font size", () => {
    const w1 = estimateTextWidth("Hello", 10);
    const w2 = estimateTextWidth("Hello", 20);
    expect(w2).toBeGreaterThan(w1);
    expect(w2 / w1).toBeCloseTo(2, 5);
  });
  it("varies by font family", () => {
    const wH = estimateTextWidth("Hello", 10, "Helvetica");
    const wC = estimateTextWidth("Hello", 10, "Courier");
    expect(wC).not.toEqual(wH);
  });
});

describe("pdf-translation-overlay estimateTextHeight", () => {
  it("is ~1.2× font size", () => {
    expect(estimateTextHeight(10)).toBeCloseTo(12, 5);
    expect(estimateTextHeight(20)).toBeCloseTo(24, 5);
  });
});

describe("pdf-translation-overlay computeBackgroundRect", () => {
  it("returns a rect with padding", () => {
    const rect = computeBackgroundRect(100, 200, "Hello", 12, "Helvetica");
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeLessThan(100); // padding on the left
    expect(rect!.width).toBeGreaterThan(0);
    expect(rect!.height).toBeGreaterThan(0);
  });
  it("returns null for empty text", () => {
    expect(computeBackgroundRect(100, 200, "", 12, "Helvetica")).toBeNull();
  });
});

describe("pdf-translation-overlay rectsOverlap & detectCollisions", () => {
  it("detects overlapping rects", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });
  it("returns false for disjoint rects", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 100, y: 100, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
  it("detects collisions among a list", () => {
    const rects = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 },
    ];
    const c = detectCollisions(rects);
    expect(c).toHaveLength(1);
    expect(c[0]).toEqual([0, 1]);
  });
});

describe("pdf-translation-overlay detectTextDirection", () => {
  it("detects LTR for English", () => {
    expect(detectTextDirection("Hello world")).toBe("ltr");
  });
  it("detects RTL for Arabic", () => {
    expect(detectTextDirection("مرحبا بالعالم")).toBe("rtl");
  });
  it("detects RTL for Hebrew", () => {
    expect(detectTextDirection("שלום עולם")).toBe("rtl");
  });
  it("returns ltr for empty string", () => {
    expect(detectTextDirection("")).toBe("ltr");
  });
});

describe("pdf-translation-overlay detectLanguage", () => {
  it("detects Arabic", () => {
    expect(detectLanguage("مرحبا")).toBe("ar");
  });
  it("detects Hebrew", () => {
    expect(detectLanguage("שלום")).toBe("he");
  });
  it("detects Russian", () => {
    expect(detectLanguage("Привет мир")).toBe("ru");
  });
  it("detects Chinese", () => {
    expect(detectLanguage("你好世界")).toBe("zh");
  });
  it("detects Japanese (hiragana/katakana)", () => {
    expect(detectLanguage("こんにちは")).toBe("ja");
  });
  it("detects Korean (hangul)", () => {
    expect(detectLanguage("안녕하세요")).toBe("ko");
  });
  it("detects English via common words", () => {
    expect(detectLanguage("the quick brown fox jumps over the lazy dog")).toBe("en");
  });
  it("detects Spanish via common words", () => {
    expect(detectLanguage("el perro es grande y la casa es bonita")).toBe("es");
  });
  it("detects French via common words", () => {
    expect(detectLanguage("le chat est sur la table avec un livre")).toBe("fr");
  });
  it("detects German via common words", () => {
    expect(detectLanguage("der hund ist groß und das haus ist schön")).toBe("de");
  });
  it("returns unknown for empty", () => {
    expect(detectLanguage("")).toBe("unknown");
  });
});

describe("pdf-translation-overlay isRtlLanguage & reverseForRtl", () => {
  it("flags ar + he as RTL", () => {
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("he")).toBe(true);
  });
  it("flags en + fr as LTR", () => {
    expect(isRtlLanguage("en")).toBe(false);
    expect(isRtlLanguage("fr")).toBe(false);
  });
  it("reverses a string", () => {
    expect(reverseForRtl("abc")).toBe("cba");
    expect(reverseForRtl("")).toBe("");
  });
});

describe("pdf-translation-overlay applyRtlHandling", () => {
  it("leaves LTR text unchanged", () => {
    const r = applyRtlHandling("Hello", 100, 12, "Helvetica");
    expect(r.text).toBe("Hello");
    expect(r.x).toBe(100);
    expect(r.direction).toBe("ltr");
  });
  it("reverses RTL text and shifts x left", () => {
    const r = applyRtlHandling("مرحبا", 100, 12, "Helvetica");
    expect(r.direction).toBe("rtl");
    expect(r.text).toBe("ابحرم"); // reversed
    expect(r.x).toBeLessThan(100);
  });
});

describe("pdf-translation-overlay computeOverlays", () => {
  const opts: OverlayOptions = {
    position: "below-original",
    fontSize: 10,
    textColor: "#FF0000",
    backgroundColor: "",
    fontFamily: "Helvetica",
    pageRange: "all",
  };
  it("filters entries by eligible page set", () => {
    const entries: TranslationEntry[] = [
      { page: 1, pageIndex: 0, x: 72, y: 700, text: "Hello", fontSize: 0, pageToken: "1" },
      { page: 2, pageIndex: 1, x: 72, y: 700, text: "World", fontSize: 0, pageToken: "2" },
    ];
    const overlays = computeOverlays(entries, new Set([0]), opts);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].entry.text).toBe("Hello");
  });
  it("uses entry font size when > 0", () => {
    const entries: TranslationEntry[] = [
      { page: 1, pageIndex: 0, x: 72, y: 700, text: "Hello", fontSize: 24, pageToken: "1" },
    ];
    const overlays = computeOverlays(entries, new Set([0]), opts);
    expect(overlays[0].height).toBeCloseTo(24 * 1.2, 5);
  });
  it("computes direction + language", () => {
    const entries: TranslationEntry[] = [
      { page: 1, pageIndex: 0, x: 72, y: 700, text: "مرحبا", fontSize: 0, pageToken: "1" },
    ];
    const overlays = computeOverlays(entries, new Set([0]), opts);
    expect(overlays[0].direction).toBe("rtl");
    expect(overlays[0].language).toBe("ar");
  });
});

describe("pdf-translation-overlay computeStats", () => {
  it("aggregates stats correctly", () => {
    const entries: TranslationEntry[] = [
      { page: 1, pageIndex: 0, x: 72, y: 700, text: "Hello", fontSize: 0, pageToken: "1" },
      { page: 2, pageIndex: 1, x: 72, y: 700, text: "مرحبا", fontSize: 0, pageToken: "2" },
      { page: 3, pageIndex: 2, x: 72, y: 700, text: "Skipped", fontSize: 0, pageToken: "3" },
    ];
    const opts: OverlayOptions = {
      position: "below-original",
      fontSize: 10,
      textColor: "#FF0000",
      backgroundColor: "",
      fontFamily: "Helvetica",
      pageRange: "all",
    };
    const overlays = computeOverlays(entries, new Set([0, 1]), opts);
    const stats = computeStats(entries, overlays, opts, [[0, 1]]);
    expect(stats.totalEntries).toBe(3);
    expect(stats.appliedOverlays).toBe(2);
    expect(stats.skippedOutOfRange).toBe(1);
    expect(stats.rtlCount).toBe(1);
    expect(stats.ltrCount).toBe(1);
    expect(stats.byLanguage.ar).toBe(1);
    expect(stats.byLanguage.unknown).toBe(1);
    expect(stats.byPosition["below-original"]).toBe(2);
    expect(stats.collisionsDetected).toBe(1);
  });
});

describe("pdf-translation-overlay renderers", () => {
  const entries: TranslationEntry[] = [
    { page: 1, pageIndex: 0, x: 72, y: 700, text: "Hello", fontSize: 0, pageToken: "1" },
  ];
  const opts: OverlayOptions = {
    position: "below-original",
    fontSize: 10,
    textColor: "#FF0000",
    backgroundColor: "",
    fontFamily: "Helvetica",
    pageRange: "all",
  };
  it("renderTextReport produces a multi-line report", () => {
    const overlays = computeOverlays(entries, new Set([0]), opts);
    const stats = computeStats(entries, overlays, opts, []);
    const report = renderTextReport(entries, overlays, stats, opts);
    expect(report).toContain("PDF Translation Overlay Report");
    expect(report).toContain("below-original");
    expect(report).toContain("Helvetica");
    expect(report).toContain("Overlays:");
  });
  it("renderCsv produces CSV with header row", () => {
    const overlays = computeOverlays(entries, new Set([0]), opts);
    const csv = renderCsv(entries, overlays);
    expect(csv.split(/\r?\n/)[0]).toBe("page,x_orig,y_orig,x_overlay,y_overlay,direction,language,text");
    expect(csv).toContain("Hello");
  });
  it("renderCsv escapes commas in text", () => {
    const e: TranslationEntry[] = [
      { page: 1, pageIndex: 0, x: 72, y: 700, text: "Hello, World", fontSize: 0, pageToken: "1" },
    ];
    const overlays = computeOverlays(e, new Set([0]), opts);
    const csv = renderCsv(e, overlays);
    expect(csv).toContain('"Hello, World"');
  });
});

describe("pdf-translation-overlay history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({
      ts: 1000, fileName: "f.pdf", pageCount: 5,
      overlayCount: 3, position: "below-original", fontFamily: "Helvetica",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].fileName).toBe("f.pdf");
    expect(h[0].overlayCount).toBe(3);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f${i}.pdf`, pageCount: 1,
        overlayCount: i, position: "below-original", fontFamily: "Helvetica",
      });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    // most-recent first
    expect(h[0].overlayCount).toBe(24);
  });
  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 1,
      overlayCount: 1, position: "below-original", fontFamily: "Helvetica",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-translation-overlay share URL", () => {
  const opts: OverlayOptions = {
    position: "above-original",
    fontSize: 14,
    textColor: "#00FF00",
    backgroundColor: "#FFFF00",
    fontFamily: "Courier",
    pageRange: "1-3",
  };
  it("buildShareUrl encodes options", () => {
    const url = buildShareUrl(opts, "1|72|700|Hi");
    expect(url).toContain("pos=above-original");
    expect(url).toContain("fs=14");
    expect(url).toContain("font=Courier");
    expect(url).toContain("color=%2300FF00"); // # encoded as %23
    expect(url).toContain("bg=%23FFFF00");
    expect(url).toContain("range=1-3");
    expect(url).toContain("tx=1");
  });
  it("parseShareUrl round-trips options", () => {
    const url = buildShareUrl(opts, "1|72|700|Hi");
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed.position).toBe("above-original");
    expect(parsed.fontSize).toBe(14);
    expect(parsed.fontFamily).toBe("Courier");
    expect(parsed.textColor).toBe("#00FF00");
    expect(parsed.backgroundColor).toBe("#FFFF00");
    expect(parsed.pageRange).toBe("1-3");
    expect(parsed.translations).toBe("1|72|700|Hi");
  });
  it("parseShareUrl ignores unknown values", () => {
    const parsed = parseShareUrl("#pos=unknown&fs=abc&font=Wingdings");
    expect(parsed.position).toBeUndefined();
    expect(parsed.fontFamily).toBeUndefined();
  });
  it("parseShareUrl returns {} for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

describe("pdf-translation-overlay validateOptions", () => {
  const base: OverlayOptions = {
    position: "below-original",
    fontSize: 10,
    textColor: "#FF0000",
    backgroundColor: "",
    fontFamily: "Helvetica",
    pageRange: "all",
  };
  it("passes for valid options", () => {
    const r = validateOptions(base, 5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.position).toBe("below-original");
    }
  });
  it("fails for unknown position", () => {
    const r = validateOptions({ ...base, position: "unknown" as OverlayPosition }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for unknown font family", () => {
    const r = validateOptions({ ...base, fontFamily: "Wingdings" as FontFamily }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for invalid font size", () => {
    const r = validateOptions({ ...base, fontSize: 0 }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for invalid text color", () => {
    const r = validateOptions({ ...base, textColor: "not-a-color" }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for invalid background color", () => {
    const r = validateOptions({ ...base, backgroundColor: "xyz" }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for invalid page range", () => {
    const r = validateOptions({ ...base, pageRange: "abc" }, 5);
    expect(r.ok).toBe(false);
  });
});
