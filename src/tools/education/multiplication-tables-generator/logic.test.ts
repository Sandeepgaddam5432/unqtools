import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_INPUT,
  SIZE_PRESETS,
  COLOR_SCHEME_LABELS,
  MODE_LABELS,
  clamp,
  validateInput,
  sanitizeInput,
  buildSingleTable,
  buildRangeTables,
  buildCompleteGrid,
  generateTables,
  computeSummary,
  cellColor,
  maxProductWidth,
  renderText,
  renderHtml,
  renderCsv,
  renderMarkdown,
  escapeHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TableInput,
  type Mode,
  type ColorScheme,
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

describe("multiplication-tables constants", () => {
  it("has 4 size presets", () => {
    expect(SIZE_PRESETS).toEqual([10, 12, 15, 20]);
  });
  it("has 4 color scheme labels", () => {
    expect(Object.keys(COLOR_SCHEME_LABELS)).toHaveLength(4);
    expect(COLOR_SCHEME_LABELS["rainbow"]).toBe("Rainbow");
    expect(COLOR_SCHEME_LABELS["blue-scale"]).toBe("Blue scale");
  });
  it("has 3 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(3);
    expect(MODE_LABELS["single-table"]).toContain("Single table");
    expect(MODE_LABELS["complete-grid"]).toContain("Complete grid");
  });
  it("default input is single-table mode, size 10", () => {
    expect(DEFAULT_INPUT.mode).toBe("single-table");
    expect(DEFAULT_INPUT.tableSize).toBe(10);
    expect(DEFAULT_INPUT.highlightMultiples).toBe(true);
    expect(DEFAULT_INPUT.colorScheme).toBe("rainbow");
  });
});

describe("multiplication-tables clamp", () => {
  it("clamps within range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });
  it("clamps below min", () => {
    expect(clamp(-5, 1, 10)).toBe(1);
  });
  it("clamps above max", () => {
    expect(clamp(99, 1, 10)).toBe(10);
  });
  it("returns min for NaN", () => {
    expect(clamp(NaN, 1, 10)).toBe(1);
  });
});

describe("multiplication-tables validateInput", () => {
  it("accepts valid single-table", () => {
    const r = validateInput({ ...DEFAULT_INPUT });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("rejects start > end", () => {
    const r = validateInput({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 10, endNumber: 5 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Start number must be"))).toBe(true);
  });
  it("rejects non-integer", () => {
    const r = validateInput({ ...DEFAULT_INPUT, startNumber: 1.5 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("integer"))).toBe(true);
  });
  it("rejects oversized complete-grid", () => {
    const r = validateInput({ ...DEFAULT_INPUT, mode: "complete-grid", startNumber: 1, endNumber: 50 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("≤ 25"))).toBe(true);
  });
  it("rejects tableSize > 25", () => {
    const r = validateInput({ ...DEFAULT_INPUT, tableSize: 99 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("≤ 25"))).toBe(true);
  });
  it("rejects tableSize < 1", () => {
    const r = validateInput({ ...DEFAULT_INPUT, tableSize: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("multiplication-tables sanitizeInput", () => {
  it("swaps start/end when start > end", () => {
    const r = sanitizeInput({ mode: "range-table", startNumber: 12, endNumber: 3, tableSize: 5 });
    expect(r.startNumber).toBe(3);
    expect(r.endNumber).toBe(12);
  });
  it("defaults unknown mode to single-table", () => {
    const r = sanitizeInput({ mode: "bogus" as unknown as Mode, startNumber: 1, endNumber: 5, tableSize: 5 });
    expect(r.mode).toBe("single-table");
  });
  it("caps complete-grid span to 25", () => {
    const r = sanitizeInput({ mode: "complete-grid", startNumber: 1, endNumber: 50, tableSize: 10 });
    expect(r.endNumber - r.startNumber + 1).toBe(25);
  });
  it("defaults unknown colorScheme to rainbow", () => {
    const r = sanitizeInput({ mode: "single-table", startNumber: 1, endNumber: 5, tableSize: 5, colorScheme: "nope" as unknown as ColorScheme });
    expect(r.colorScheme).toBe("rainbow");
  });
  it("clamps tableSize", () => {
    const r = sanitizeInput({ mode: "single-table", startNumber: 1, endNumber: 5, tableSize: 99 });
    expect(r.tableSize).toBe(25);
  });
  it("rounds non-integer start", () => {
    const r = sanitizeInput({ mode: "single-table", startNumber: 3.7, endNumber: 10, tableSize: 5 });
    expect(r.startNumber).toBe(4);
  });
  it("handles NaN start with default", () => {
    const r = sanitizeInput({ mode: "single-table", startNumber: NaN, endNumber: 10, tableSize: 5 });
    expect(r.startNumber).toBe(1);
  });
});

describe("multiplication-tables buildSingleTable", () => {
  it("builds 7×1 to 7×10", () => {
    const t = buildSingleTable(7, 10, true);
    expect(t.base).toBe(7);
    expect(t.cells).toHaveLength(10);
    expect(t.cells[0]).toEqual({ i: 7, j: 1, product: 7, isHighlight: true });
    expect(t.cells[9].product).toBe(70);
  });
  it("highlights all multiples of base", () => {
    const t = buildSingleTable(7, 10, true);
    expect(t.cells.every((c) => c.isHighlight)).toBe(true);
  });
  it("does not highlight when highlightMultiples=false", () => {
    const t = buildSingleTable(7, 10, false);
    expect(t.cells.every((c) => !c.isHighlight)).toBe(true);
  });
  it("handles base 0", () => {
    const t = buildSingleTable(0, 5, true);
    expect(t.cells.every((c) => c.product === 0)).toBe(true);
    expect(t.cells.every((c) => !c.isHighlight)).toBe(true);
  });
  it("handles negative base", () => {
    const t = buildSingleTable(-3, 5, true);
    expect(t.cells[0].product).toBe(-3);
    expect(t.cells[4].product).toBe(-15);
  });
});

describe("multiplication-tables buildRangeTables", () => {
  it("builds one table per base", () => {
    const tables = buildRangeTables({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 1, endNumber: 3, tableSize: 5 });
    expect(tables).toHaveLength(3);
    expect(tables[0].base).toBe(1);
    expect(tables[2].base).toBe(3);
  });
  it("respects tableSize", () => {
    const tables = buildRangeTables({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 5, endNumber: 5, tableSize: 12 });
    expect(tables[0].cells).toHaveLength(12);
  });
});

describe("multiplication-tables buildCompleteGrid", () => {
  it("builds NxN grid", () => {
    const t = buildCompleteGrid({ ...DEFAULT_INPUT, mode: "complete-grid", startNumber: 1, endNumber: 5, tableSize: 5 });
    expect(t.cells).toHaveLength(25);
    expect(t.cells[0]).toEqual({ i: 1, j: 1, product: 1, isHighlight: true });
    // Last cell: 5×5 = 25
    const last = t.cells[t.cells.length - 1];
    expect(last.product).toBe(25);
  });
  it("highlights first row/column when enabled", () => {
    const t = buildCompleteGrid({ ...DEFAULT_INPUT, mode: "complete-grid", startNumber: 1, endNumber: 3, tableSize: 3 });
    // cell at i=2, j=3 should not be highlight; cell at i=1 should be.
    const c23 = t.cells.find((c) => c.i === 2 && c.j === 3);
    const c13 = t.cells.find((c) => c.i === 1 && c.j === 3);
    expect(c23?.isHighlight).toBe(false);
    expect(c13?.isHighlight).toBe(true);
  });
  it("does not highlight when disabled", () => {
    const t = buildCompleteGrid({ ...DEFAULT_INPUT, mode: "complete-grid", startNumber: 1, endNumber: 3, tableSize: 3, highlightMultiples: false });
    expect(t.cells.every((c) => !c.isHighlight)).toBe(true);
  });
});

describe("multiplication-tables generateTables", () => {
  it("generates single table", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 9, tableSize: 10 });
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].base).toBe(9);
    expect(r.summary.totalCells).toBe(10);
  });
  it("generates range tables", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 1, endNumber: 5, tableSize: 10 });
    expect(r.tables).toHaveLength(5);
    expect(r.summary.totalCells).toBe(50);
  });
  it("generates complete grid", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "complete-grid", startNumber: 1, endNumber: 4, tableSize: 4 });
    expect(r.tables).toHaveLength(1);
    expect(r.summary.totalCells).toBe(16);
  });
});

describe("multiplication-tables computeSummary", () => {
  it("computes summary stats", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 2, endNumber: 5, tableSize: 10 });
    expect(r.summary.totalTables).toBe(4);
    expect(r.summary.rangeMin).toBe(2);
    expect(r.summary.rangeMax).toBe(5);
    expect(r.summary.maxProduct).toBe(50);
    expect(r.summary.minProduct).toBe(2);
  });
  it("returns zeros for empty input", () => {
    const s = computeSummary([]);
    expect(s.totalCells).toBe(0);
    expect(s.totalTables).toBe(0);
  });
  it("computes min/max products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 10 });
    expect(r.summary.minProduct).toBe(7);
    expect(r.summary.maxProduct).toBe(70);
  });
});

describe("multiplication-tables cellColor", () => {
  it("returns rgb for mono", () => {
    expect(cellColor(50, 7, "mono")).toMatch(/^rgb\(/);
  });
  it("returns rgb for blue-scale", () => {
    expect(cellColor(50, 7, "blue-scale")).toMatch(/^rgb\(/);
  });
  it("returns rgb for green-scale", () => {
    expect(cellColor(50, 7, "green-scale")).toMatch(/^rgb\(/);
  });
  it("returns hsl for rainbow", () => {
    expect(cellColor(50, 7, "rainbow")).toMatch(/^hsl\(/);
  });
  it("handles zero product", () => {
    expect(cellColor(0, 0, "mono")).toMatch(/^rgb\(/);
  });
  it("handles negative product", () => {
    expect(cellColor(-15, -3, "rainbow")).toMatch(/^hsl\(/);
  });
});

describe("multiplication-tables maxProductWidth", () => {
  it("returns 1 for single-digit products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 1, tableSize: 5 });
    expect(maxProductWidth(r.tables)).toBe(1);
  });
  it("returns 2 for two-digit products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 9, tableSize: 10 });
    expect(maxProductWidth(r.tables)).toBe(2); // max is 90
  });
  it("returns 3 for three-digit products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 20, tableSize: 10 });
    expect(maxProductWidth(r.tables)).toBe(3); // max is 200
  });
  it("handles negative products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: -3, tableSize: 10 });
    // -30 has 3 chars (including sign)
    expect(maxProductWidth(r.tables)).toBe(3);
  });
});

describe("multiplication-tables renderText", () => {
  it("renders header row", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const text = renderText(r.tables);
    expect(text).toContain("× Table of 7");
    expect(text).toContain("×");
  });
  it("renders all products", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const text = renderText(r.tables);
    expect(text).toContain("7");
    expect(text).toContain("35");
  });
  it("renders empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renders multiple tables in range mode", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 2, endNumber: 3, tableSize: 5 });
    const text = renderText(r.tables);
    expect(text).toContain("× Table of 2");
    expect(text).toContain("× Table of 3");
  });
});

describe("multiplication-tables escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });
  it("escapes quotes", () => {
    expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;");
  });
});

describe("multiplication-tables renderHtml", () => {
  it("renders valid HTML doc", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const html = renderHtml(r.tables, "rainbow");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<table>");
  });
  it("includes page-break CSS", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const html = renderHtml(r.tables, "rainbow");
    expect(html).toContain("page-break");
  });
  it("applies color scheme", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const html = renderHtml(r.tables, "blue-scale");
    expect(html).toMatch(/background:rgb\(/);
  });
  it("renders empty for empty input", () => {
    expect(renderHtml([], "rainbow")).toBe("");
  });
});

describe("multiplication-tables renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("base,multiplier,product");
  });
  it("renders rows", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 3 });
    const csv = renderCsv(r.tables);
    expect(csv).toContain("7,1,7");
    expect(csv).toContain("7,3,21");
  });
});

describe("multiplication-tables renderMarkdown", () => {
  it("renders markdown table", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const md = renderMarkdown(r.tables);
    expect(md).toContain("## × Table of 7");
    expect(md).toContain("|");
    expect(md).toContain("---");
  });
  it("bolds highlighted cells", () => {
    const r = generateTables({ ...DEFAULT_INPUT, mode: "single-table", startNumber: 7, tableSize: 5 });
    const md = renderMarkdown(r.tables);
    expect(md).toContain("**7**");
  });
  it("renders empty for empty input", () => {
    expect(renderMarkdown([])).toBe("");
  });
});

describe("multiplication-tables history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      mode: "single-table",
      startNumber: 7,
      endNumber: 7,
      tableSize: 10,
      totalCells: 10,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "single-table",
        startNumber: i,
        endNumber: i,
        tableSize: 10,
        totalCells: 10,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      mode: "single-table",
      startNumber: 1,
      endNumber: 1,
      tableSize: 10,
      totalCells: 10,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("multiplication-tables shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_INPUT, mode: "range-table", startNumber: 1, endNumber: 12 });
    expect(url).toContain("mode=range-table");
    expect(url).toContain("start=1");
    expect(url).toContain("end=12");
    expect(url).toContain("scheme=rainbow");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input: TableInput = {
      mode: "complete-grid",
      startNumber: 1,
      endNumber: 12,
      tableSize: 12,
      highlightMultiples: false,
      colorScheme: "blue-scale",
    };
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.mode).toBe("complete-grid");
    expect(parsed.startNumber).toBe(1);
    expect(parsed.endNumber).toBe(12);
    expect(parsed.highlightMultiples).toBe(false);
    expect(parsed.colorScheme).toBe("blue-scale");
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.mode).toBe("single-table");
    expect(parsed.startNumber).toBe(1);
    expect(parsed.tableSize).toBe(10);
  });
  it("filters unknown mode to default", () => {
    const parsed = parseShareUrl("mode=bogus&start=5");
    expect(parsed.mode).toBe("single-table");
    expect(parsed.startNumber).toBe(5);
  });
});

// Suppress unused-import lint
export type _Unused = Mode | ColorScheme | TableInput;
