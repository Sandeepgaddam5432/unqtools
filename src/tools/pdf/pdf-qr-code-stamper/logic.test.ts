import { describe, it, expect, beforeEach } from "vitest";
import {
  QR_POSITIONS,
  POSITION_LABELS,
  ERROR_CORRECTION_LEVELS,
  ECL_DETAILS,
  QR_CAPACITY,
  MIN_QR_SIZE,
  MAX_QR_SIZE,
  DEFAULT_QR_SIZE,
  DEFAULT_MARGIN,
  DEFAULT_ECL,
  parseQrData,
  expandPageToken,
  detectKind,
  isLikelyUrl,
  isStrictUrl,
  validateQrEntries,
  calculateQrPosition,
  calculateLabelPosition,
  validateQrSize,
  validateMargin,
  calculateEffectiveMargin,
  parseHexColor,
  rgbToHex,
  calculateQrVersion,
  getQrCapacity,
  checkDataCapacity,
  qrModulesFor,
  generateQrMatrix,
  matrixToRectangles,
  formatLabelText,
  computeStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QrEntry,
  type QrPosition,
  type ErrorCorrectionLevel,
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

describe("qr-stamper constants", () => {
  it("exposes 7 positions", () => {
    expect(QR_POSITIONS).toHaveLength(7);
    expect(QR_POSITIONS).toContain("top-left");
    expect(QR_POSITIONS).toContain("center");
  });
  it("exposes 4 error-correction levels", () => {
    expect(ERROR_CORRECTION_LEVELS).toEqual(["L", "M", "Q", "H"]);
  });
  it("has labels for every position", () => {
    for (const p of QR_POSITIONS) {
      expect(POSITION_LABELS[p]).toBeTruthy();
    }
  });
  it("ECL details include percent + recovery", () => {
    expect(ECL_DETAILS.L.percent).toBe(7);
    expect(ECL_DETAILS.H.percent).toBe(30);
    expect(ECL_DETAILS.M.recovery).toContain("15%");
  });
  it("capacity table has 10 versions per ECL", () => {
    expect(QR_CAPACITY.L).toHaveLength(10);
    expect(QR_CAPACITY.H).toHaveLength(10);
  });
});

describe("qr-stamper expandPageToken", () => {
  it("expands 'all' to every page", () => {
    expect(expandPageToken("all", 5)).toEqual([0, 1, 2, 3, 4]);
  });
  it("supports single numbers", () => {
    expect(expandPageToken("3", 5)).toEqual([2]);
  });
  it("supports ranges", () => {
    expect(expandPageToken("2-4", 5)).toEqual([1, 2, 3]);
  });
  it("supports comma-separated", () => {
    expect(expandPageToken("1,3,5", 5)).toEqual([0, 2, 4]);
  });
  it("supports open-ended range", () => {
    expect(expandPageToken("3-", 5)).toEqual([2, 3, 4]);
  });
  it("supports range from start", () => {
    expect(expandPageToken("-2", 5)).toEqual([0, 1]);
  });
  it("returns empty for out-of-range page", () => {
    expect(expandPageToken("99", 5)).toEqual([]);
  });
  it("returns empty for invalid range start > end", () => {
    expect(expandPageToken("5-2", 5)).toEqual([]);
  });
  it("returns empty for invalid token", () => {
    expect(expandPageToken("abc", 5)).toEqual([]);
  });
  it("returns empty for empty token", () => {
    expect(expandPageToken("", 5)).toEqual([]);
  });
});

describe("qr-stamper parseQrData", () => {
  it("parses pipe-separated entries", () => {
    const entries = parseQrData("1|https://a.com\n2|DOC-001", 3);
    expect(entries).toHaveLength(2);
    expect(entries[0].pageIndices).toEqual([0]);
    expect(entries[0].data).toBe("https://a.com");
    expect(entries[1].pageIndices).toEqual([1]);
  });
  it("parses comma-separated entries", () => {
    const entries = parseQrData("1,https://a.com", 3);
    expect(entries[0].data).toBe("https://a.com");
  });
  it("supports 'all' page token", () => {
    const entries = parseQrData("all|https://a.com", 4);
    expect(entries[0].pageIndices).toEqual([0, 1, 2, 3]);
    expect(entries[0].pageToken).toBe("all");
  });
  it("supports ranges", () => {
    const entries = parseQrData("2-3|X", 5);
    expect(entries[0].pageIndices).toEqual([1, 2]);
  });
  it("skips blank lines", () => {
    const entries = parseQrData("\n1|X\n\n2|Y\n", 3);
    expect(entries).toHaveLength(2);
  });
  it("skips comment lines starting with #", () => {
    const entries = parseQrData("# comment\n1|X", 3);
    expect(entries).toHaveLength(1);
  });
  it("treats lines without separator as 'all' data", () => {
    const entries = parseQrData("plain-data", 2);
    expect(entries).toHaveLength(1);
    expect(entries[0].pageToken).toBe("all");
    expect(entries[0].pageIndices).toEqual([0, 1]);
    expect(entries[0].data).toBe("plain-data");
  });
  it("drops entries with invalid page token", () => {
    const entries = parseQrData("99|X\n1|Y", 3);
    expect(entries).toHaveLength(1);
    expect(entries[0].data).toBe("Y");
  });
  it("drops entries with empty data", () => {
    const entries = parseQrData("1|\n2|Y", 3);
    expect(entries).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseQrData("", 3)).toEqual([]);
  });
  it("detects url kind for URLs", () => {
    const entries = parseQrData("1|https://a.com", 3);
    expect(entries[0].kind).toBe("url");
  });
  it("detects text kind for non-URLs", () => {
    const entries = parseQrData("1|hello world", 3);
    expect(entries[0].kind).toBe("text");
  });
});

describe("qr-stamper URL validators", () => {
  it("isLikelyUrl accepts http/https/mailto/tel/ftp", () => {
    expect(isLikelyUrl("https://example.com")).toBe(true);
    expect(isLikelyUrl("mailto:foo@bar.com")).toBe(true);
    expect(isLikelyUrl("tel:+1234567890")).toBe(true);
    expect(isLikelyUrl("ftp://example.com")).toBe(true);
  });
  it("isLikelyUrl rejects plain text", () => {
    expect(isLikelyUrl("hello world")).toBe(false);
    expect(isLikelyUrl("DOC-001")).toBe(false);
  });
  it("isStrictUrl accepts well-formed URLs", () => {
    expect(isStrictUrl("https://example.com/path?q=1")).toBe(true);
    expect(isStrictUrl("http://localhost:3000/")).toBe(true);
  });
  it("isStrictUrl rejects malformed URLs", () => {
    expect(isStrictUrl("not a url")).toBe(false);
    expect(isStrictUrl("ftp://")).toBe(false);
  });
  it("detectKind matches isLikelyUrl", () => {
    expect(detectKind("https://x.com")).toBe("url");
    expect(detectKind("plain text")).toBe("text");
  });
});

describe("qr-stamper validateQrEntries", () => {
  it("returns null for valid entries", () => {
    const entries = parseQrData("1|X\n2|Y", 3);
    expect(validateQrEntries(entries, 3)).toBeNull();
  });
  it("returns error for empty list", () => {
    expect(validateQrEntries([], 3)).toContain("at least one");
  });
  it("returns error for entry with empty data", () => {
    const entries: QrEntry[] = [{ pageToken: "1", pageIndices: [0], data: "", kind: "text" }];
    expect(validateQrEntries(entries, 3)).toContain("empty");
  });
  it("returns error for entry with empty pageIndices", () => {
    const entries: QrEntry[] = [{ pageToken: "99", pageIndices: [], data: "X", kind: "text" }];
    expect(validateQrEntries(entries, 3)).toContain("does not match");
  });
});

describe("qr-stamper calculateQrPosition", () => {
  const W = 595, H = 842, S = 100, M = 10;
  it("top-left: margin from top-left corner", () => {
    const p = calculateQrPosition("top-left", W, H, S, M);
    expect(p.x).toBe(M);
    expect(p.y).toBe(H - S - M);
  });
  it("top-right: aligned to right edge", () => {
    const p = calculateQrPosition("top-right", W, H, S, M);
    expect(p.x).toBe(W - S - M);
    expect(p.y).toBe(H - S - M);
  });
  it("bottom-center: horizontally centered", () => {
    const p = calculateQrPosition("bottom-center", W, H, S, M);
    expect(p.x).toBe((W - S) / 2);
    expect(p.y).toBe(M);
  });
  it("center: dead center of page", () => {
    const p = calculateQrPosition("center", W, H, S, M);
    expect(p.x).toBe((W - S) / 2);
    expect(p.y).toBe((H - S) / 2);
  });
  it("clamps margin if it would push QR off the page", () => {
    const p = calculateQrPosition("top-left", 200, 200, 100, 1000);
    // margin gets clamped so QR still fits
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + 100).toBeLessThanOrEqual(200);
    expect(p.y + 100).toBeLessThanOrEqual(200);
  });
});

describe("qr-stamper calculateLabelPosition", () => {
  it("centers label below QR", () => {
    const p = calculateLabelPosition(100, 700, 50, 80, 8, 842);
    expect(p.labelX).toBe(100 + (50 - 80) / 2); // 85
    expect(p.labelY).toBeLessThan(700); // below QR
  });
  it("clamps label to non-negative y", () => {
    const p = calculateLabelPosition(100, 5, 50, 80, 8, 842);
    expect(p.labelY).toBeGreaterThanOrEqual(0);
  });
});

describe("qr-stamper validateQrSize", () => {
  it("accepts valid size", () => {
    expect(validateQrSize(100).ok).toBe(true);
    expect(validateQrSize(100).value).toBe(100);
  });
  it("rejects size below minimum", () => {
    const r = validateQrSize(10);
    expect(r.ok).toBe(false);
    expect(r.value).toBe(MIN_QR_SIZE);
  });
  it("rejects size above maximum", () => {
    const r = validateQrSize(1000);
    expect(r.ok).toBe(false);
    expect(r.value).toBe(MAX_QR_SIZE);
  });
  it("rejects NaN", () => {
    const r = validateQrSize(NaN);
    expect(r.ok).toBe(false);
    expect(r.value).toBe(DEFAULT_QR_SIZE);
  });
});

describe("qr-stamper validateMargin & calculateEffectiveMargin", () => {
  it("validates margin within bounds", () => {
    expect(validateMargin(10).ok).toBe(true);
    expect(validateMargin(-5).ok).toBe(false);
    expect(validateMargin(500).ok).toBe(false);
  });
  it("calculateEffectiveMargin clamps to half-page-minus-QR", () => {
    const m = calculateEffectiveMargin(1000, 100, 200, 200);
    expect(m).toBe(50); // (200 - 100) / 2 = 50
  });
});

describe("qr-stamper color parser", () => {
  it("parses #RRGGBB", () => {
    expect(parseHexColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHexColor("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
  });
  it("parses #RGB shorthand", () => {
    expect(parseHexColor("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor("#f00")).toEqual({ r: 1, g: 0, b: 0 });
  });
  it("parses without # prefix", () => {
    expect(parseHexColor("ff8800")).toEqual({ r: 1, g: 136/255, b: 0 });
  });
  it("returns null for invalid input", () => {
    expect(parseHexColor("not-a-color")).toBeNull();
    expect(parseHexColor("#1234")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });
  it("round-trips rgbToHex → parseHexColor", () => {
    const hex = rgbToHex({ r: 0.5, g: 0.25, b: 0.75 });
    const back = parseHexColor(hex);
    expect(back).not.toBeNull();
    expect(back!.r).toBeCloseTo(0.5, 1);
    expect(back!.g).toBeCloseTo(0.25, 1);
    expect(back!.b).toBeCloseTo(0.75, 1);
  });
});

describe("qr-stamper QR version + capacity", () => {
  it("version 1 fits 17 bytes at L", () => {
    expect(calculateQrVersion(17, "L")).toBe(1);
  });
  it("version 2 needed for 20 bytes at M", () => {
    expect(calculateQrVersion(20, "M")).toBe(2);
  });
  it("caps at version 10 for very long data", () => {
    expect(calculateQrVersion(1000, "L")).toBe(10);
  });
  it("H has lower capacity than L at same version", () => {
    expect(getQrCapacity(1, "H")).toBeLessThan(getQrCapacity(1, "L"));
  });
  it("checkDataCapacity reports fits true/false", () => {
    expect(checkDataCapacity(10, 1, "L").fits).toBe(true);
    expect(checkDataCapacity(100, 1, "L").fits).toBe(false);
    expect(checkDataCapacity(10, 1, "L").capacity).toBe(17);
  });
  it("qrModulesFor returns 17 + 4*v", () => {
    expect(qrModulesFor(1)).toBe(21);
    expect(qrModulesFor(2)).toBe(25);
    expect(qrModulesFor(10)).toBe(57);
  });
});

describe("qr-stamper generateQrMatrix", () => {
  it("returns square matrix of expected size for version 1", () => {
    const r = generateQrMatrix("hi", "L");
    expect(r.size).toBe(21);
    expect(r.version).toBe(1);
    expect(r.matrix).toHaveLength(21);
    expect(r.matrix[0]).toHaveLength(21);
  });
  it("places finder pattern at top-left (7x7)", () => {
    const r = generateQrMatrix("hi", "L");
    // top-left finder pattern: corners + center 3x3 should be dark
    expect(r.matrix[0][0]).toBe(true);
    expect(r.matrix[0][6]).toBe(true);
    expect(r.matrix[6][0]).toBe(true);
    expect(r.matrix[3][3]).toBe(true);
    // inner separator area inside finder (corner of inner ring)
    expect(r.matrix[1][1]).toBe(false); // inside the outer ring but outside center
  });
  it("places finder pattern at top-right", () => {
    const r = generateQrMatrix("hi", "L");
    expect(r.matrix[0][r.size - 1]).toBe(true);
    expect(r.matrix[6][r.size - 7]).toBe(true);
  });
  it("places finder pattern at bottom-left", () => {
    const r = generateQrMatrix("hi", "L");
    expect(r.matrix[r.size - 1][0]).toBe(true);
    expect(r.matrix[r.size - 7][6]).toBe(true);
  });
  it("timing pattern row 6 alternates after col 7", () => {
    const r = generateQrMatrix("hi", "L");
    expect(r.matrix[6][8]).toBe(true);  // col 8: even
    expect(r.matrix[6][9]).toBe(false); // col 9: odd
  });
  it("is deterministic — same input → same matrix", () => {
    const a = generateQrMatrix("https://example.com", "M");
    const b = generateQrMatrix("https://example.com", "M");
    expect(a.matrix).toEqual(b.matrix);
  });
  it("different inputs usually produce different matrices", () => {
    const a = generateQrMatrix("https://a.com", "M");
    const b = generateQrMatrix("https://b.com", "M");
    // At least one bit in the data area differs
    let differ = false;
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        if (a.matrix[y][x] !== b.matrix[y][x]) { differ = true; break; }
      }
      if (differ) break;
    }
    expect(differ).toBe(true);
  });
  it("places alignment pattern for version >= 2", () => {
    const r = generateQrMatrix("x".repeat(40), "M"); // needs version 2+
    expect(r.version).toBeGreaterThanOrEqual(2);
    // Alignment pattern center: bottom-right area
    const ax = r.size - 7;
    const ay = r.size - 7;
    expect(r.matrix[ay][ax]).toBe(true); // center dark
  });
});

describe("qr-stamper matrixToRectangles", () => {
  it("produces a rectangle for each dark module", () => {
    const matrix = [
      [true, false],
      [false, true],
    ];
    const rects = matrixToRectangles(matrix, 100, 200, 10);
    expect(rects).toHaveLength(2);
    // First dark at (row 0, col 0) → top in matrix → highest y
    expect(rects[0]).toEqual({ x: 100, y: 210, width: 10, height: 10 });
    // Second dark at (row 1, col 1) → bottom in matrix → lower y
    expect(rects[1]).toEqual({ x: 110, y: 200, width: 10, height: 10 });
  });
  it("returns empty for all-light matrix", () => {
    const matrix = [[false, false], [false, false]];
    expect(matrixToRectangles(matrix, 0, 0, 5)).toEqual([]);
  });
});

describe("qr-stamper formatLabelText", () => {
  it("returns short strings unchanged", () => {
    expect(formatLabelText("hi")).toBe("hi");
  });
  it("truncates long strings with ellipsis", () => {
    const s = "x".repeat(50);
    const out = formatLabelText(s, 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("qr-stamper computeStats", () => {
  it("computes total stamps, byPage, url/text counts", () => {
    const entries = parseQrData("1|https://a.com\nall|plain", 3);
    const stats = computeStats(entries);
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalStamps).toBe(1 + 3); // entry 1 + all (3)
    expect(stats.urlCount).toBe(1);
    expect(stats.textCount).toBe(1);
    expect(stats.byPage[0]).toBe(2); // entry 1 hits page 0, "all" also hits page 0
    expect(stats.byPage[1]).toBe(1);
    expect(stats.byPage[2]).toBe(1);
    expect(stats.totalBytes).toBeGreaterThan(0);
  });
  it("handles empty entries", () => {
    expect(computeStats([]).totalStamps).toBe(0);
  });
});

describe("qr-stamper renderTextReport", () => {
  it("includes summary line + per-entry listing", () => {
    const entries = parseQrData("1|X\n2|Y", 3);
    const stats = computeStats(entries);
    const text = renderTextReport(entries, stats);
    expect(text).toContain("QR Code Stamp Report");
    expect(text).toContain("Total stamps: 2");
    expect(text).toContain("pages 1");
    expect(text).toContain("pages 2");
  });
});

describe("qr-stamper renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toContain("page,kind,data,bytes");
  });
  it("renders entry rows", () => {
    const entries = parseQrData("1|hello,world", 3);
    const csv = renderCsv(entries);
    expect(csv).toContain("1,text");
    // The data contains a comma so should be CSV-escaped
    expect(csv).toContain('"hello,world"');
  });
});

describe("qr-stamper history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entries = parseQrData("1|X", 3);
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

describe("qr-stamper shareable URL", () => {
  it("builds URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1|X", "top-right", 120, "H", "#000000", "#FFFFFF", true, 20);
    expect(url).toContain("data=1");
    expect(url).toContain("pos=top-right");
    expect(url).toContain("size=120");
    expect(url).toContain("ecl=H");
    expect(url).toContain("color=%23000000"); // # encoded
    expect(url).toContain("label=1");
    expect(url).toContain("margin=20");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits margin param when equal to default", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1|X", "top-right", 100, "M", "#000000", "#FFFFFF", false, DEFAULT_MARGIN);
    expect(url).not.toContain("margin=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1|X", "bottom-left", 150, "Q", "#ff0000", "", true, 30);
    (globalThis as Record<string, unknown>).window = origWindow;
    const parsed = parseShareUrl(url);
    expect(parsed.qrData).toBe("1|X");
    expect(parsed.position).toBe("bottom-left");
    expect(parsed.size).toBe(150);
    expect(parsed.ecl).toBe("Q");
    expect(parsed.color).toBe("#ff0000");
    expect(parsed.includeLabel).toBe(true);
    expect(parsed.margin).toBe(30);
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.qrData).toBe("");
    expect(p.position).toBe("top-right");
    expect(p.size).toBe(DEFAULT_QR_SIZE);
    expect(p.ecl).toBe(DEFAULT_ECL);
    expect(p.includeLabel).toBe(false);
  });
  it("filters invalid position to default", () => {
    const p = parseShareUrl("pos=invalid-pos");
    expect(p.position).toBe("top-right");
  });
  it("filters invalid ECL to default", () => {
    const p = parseShareUrl("ecl=Z");
    expect(p.ecl).toBe(DEFAULT_ECL);
  });
});

// Suppress unused-import lint
export type _Unused = QrPosition | ErrorCorrectionLevel;
