import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyTable,
  normalizeTable,
  setCell,
  setHeader,
  setAlignment,
  addRow,
  removeRow,
  moveRow,
  addColumn,
  removeColumn,
  moveColumn,
  toggleHeaderRow,
  transposeTable,
  sortRows,
  dedupeRows,
  boldRow,
  escapeCell,
  separatorFor,
  renderMarkdown,
  renderHtml,
  renderCsv,
  renderTsv,
  renderJson,
  renderJira,
  csvQuote,
  parseCsvLine,
  parseCsv,
  parseMarkdownTable,
  importFromCsv,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TableModel,
  type Alignment,
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
  (globalThis as Record<string, unknown>).window = undefined;
});

function t2(): TableModel {
  return {
    headers: ["Name", "Age"],
    rows: [["Ada", "36"], ["Linus", "54"]],
    aligns: ["left", "right"],
    headerRow: true,
  };
}

describe("markdown-table-generator createEmptyTable", () => {
  it("creates a default 2x2 table", () => {
    const t = createEmptyTable();
    expect(t.headers).toEqual(["Column 1", "Column 2"]);
    expect(t.rows).toHaveLength(2);
    expect(t.aligns).toEqual(["left", "left"]);
    expect(t.headerRow).toBe(true);
  });
  it("creates a custom-sized table", () => {
    const t = createEmptyTable(3, 4);
    expect(t.headers).toHaveLength(4);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0]).toHaveLength(4);
  });
  it("clamps negative sizes", () => {
    const t = createEmptyTable(-1, -1);
    expect(t.headers).toHaveLength(1);
    expect(t.rows).toHaveLength(0);
  });
});

describe("markdown-table-generator normalizeTable", () => {
  it("pads short rows to header length", () => {
    const t = normalizeTable({
      headers: ["a", "b", "c"],
      rows: [["x"]],
      aligns: ["left"],
      headerRow: true,
    });
    expect(t.rows[0]).toEqual(["x", "", ""]);
    expect(t.aligns).toEqual(["left", "left", "left"]);
  });
  it("truncates over-long rows", () => {
    const t = normalizeTable({
      headers: ["a"],
      rows: [["x", "y", "z"]],
      aligns: ["left"],
      headerRow: true,
    });
    expect(t.rows[0]).toEqual(["x"]);
  });
});

describe("markdown-table-generator setCell / setHeader / setAlignment", () => {
  it("sets a body cell", () => {
    const t = setCell(t2(), 0, 1, "37");
    expect(t.rows[0][1]).toBe("37");
  });
  it("ignores out-of-bounds cell", () => {
    expect(setCell(t2(), 99, 0, "x")).toEqual(t2());
  });
  it("sets a header cell", () => {
    const t = setHeader(t2(), 0, "Full Name");
    expect(t.headers[0]).toBe("Full Name");
  });
  it("sets alignment", () => {
    const t = setAlignment(t2(), 0, "center");
    expect(t.aligns[0]).toBe("center");
  });
});

describe("markdown-table-generator row ops", () => {
  it("adds a row at end by default", () => {
    const t = addRow(t2());
    expect(t.rows).toHaveLength(3);
    expect(t.rows[2]).toEqual(["", ""]);
  });
  it("inserts a row at index", () => {
    const t = addRow(t2(), 0);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0]).toEqual(["", ""]);
    expect(t.rows[1]).toEqual(["Ada", "36"]);
  });
  it("removes a row", () => {
    const t = removeRow(t2(), 0);
    expect(t.rows).toEqual([["Linus", "54"]]);
  });
  it("ignores remove out-of-bounds", () => {
    expect(removeRow(t2(), 99)).toEqual(t2());
  });
  it("moves a row down", () => {
    const t = moveRow(t2(), 0, 1);
    expect(t.rows[0]).toEqual(["Linus", "54"]);
    expect(t.rows[1]).toEqual(["Ada", "36"]);
  });
  it("refuses to move row out of bounds", () => {
    expect(moveRow(t2(), 0, -1)).toEqual(t2());
    expect(moveRow(t2(), 1, 1)).toEqual(t2());
  });
});

describe("markdown-table-generator column ops", () => {
  it("adds a column at end", () => {
    const t = addColumn(t2());
    expect(t.headers).toHaveLength(3);
    expect(t.aligns).toHaveLength(3);
    expect(t.rows[0]).toHaveLength(3);
    expect(t.rows[0][2]).toBe("");
  });
  it("removes a column", () => {
    const t = removeColumn(t2(), 0);
    expect(t.headers).toEqual(["Age"]);
    expect(t.rows[0]).toEqual(["36"]);
  });
  it("refuses to remove the last column", () => {
    const t = removeColumn({ headers: ["only"], rows: [["x"]], aligns: ["left"], headerRow: true }, 0);
    expect(t.headers).toEqual(["only"]);
  });
  it("moves a column right", () => {
    const t = moveColumn(t2(), 0, 1);
    expect(t.headers).toEqual(["Age", "Name"]);
  });
});

describe("markdown-table-generator toggleHeaderRow", () => {
  it("flips the flag", () => {
    const t = toggleHeaderRow(t2());
    expect(t.headerRow).toBe(false);
  });
});

describe("markdown-table-generator transposeTable", () => {
  it("swaps rows and columns", () => {
    const t = transposeTable(t2());
    // Original: 2 cols, 2 rows. New: 2 cols, 2 rows (header becomes first column).
    expect(t.headers).toHaveLength(2);
    expect(t.rows).toHaveLength(2);
    // First cell of new first row should be old header "Name"
    expect(t.rows[0][0]).toBe("Name");
    expect(t.rows[1][0]).toBe("Age");
  });
});

describe("markdown-table-generator sortRows", () => {
  it("sorts ascending by column", () => {
    const t = sortRows(t2(), 0, "asc");
    expect(t.rows[0][0]).toBe("Ada");
    expect(t.rows[1][0]).toBe("Linus");
  });
  it("sorts descending by column", () => {
    const t = sortRows(t2(), 0, "desc");
    expect(t.rows[0][0]).toBe("Linus");
    expect(t.rows[1][0]).toBe("Ada");
  });
  it("ignores out-of-bounds column", () => {
    expect(sortRows(t2(), 99, "asc")).toEqual(t2());
  });
});

describe("markdown-table-generator dedupeRows", () => {
  it("removes duplicate rows", () => {
    const t = dedupeRows({
      headers: ["a"], rows: [["x"], ["x"], ["y"]], aligns: ["left"], headerRow: true,
    });
    expect(t.rows).toEqual([["x"], ["y"]]);
  });
  it("keeps all unique rows", () => {
    expect(dedupeRows(t2()).rows).toHaveLength(2);
  });
});

describe("markdown-table-generator boldRow", () => {
  it("bolds the first row", () => {
    const t = boldRow(t2(), "first");
    expect(t.rows[0][0]).toBe("**Ada**");
    expect(t.rows[1][0]).toBe("Linus");
  });
  it("bolds the last row", () => {
    const t = boldRow(t2(), "last");
    expect(t.rows[1][0]).toBe("**Linus**");
    expect(t.rows[0][0]).toBe("Ada");
  });
  it("bolds empty cells is a no-op for that cell", () => {
    const t = boldRow({ headers: ["a"], rows: [[""]], aligns: ["left"], headerRow: true }, "first");
    expect(t.rows[0][0]).toBe("");
  });
});

describe("markdown-table-generator escapeCell", () => {
  it("escapes pipes", () => {
    expect(escapeCell("a|b")).toBe("a\\|b");
  });
  it("preserves already-escaped pipes", () => {
    expect(escapeCell("a\\|b")).toBe("a\\|b");
  });
  it("converts newlines to <br>", () => {
    expect(escapeCell("a\nb")).toBe("a<br>b");
  });
  it("handles CRLF", () => {
    expect(escapeCell("a\r\nb")).toBe("a<br>b");
  });
  it("handles nullish input", () => {
    expect(escapeCell(undefined as unknown as string)).toBe("");
  });
});

describe("markdown-table-generator separatorFor", () => {
  it("returns left/right/center separators", () => {
    expect(separatorFor("left")).toBe(":---");
    expect(separatorFor("right")).toBe("---:");
    expect(separatorFor("center")).toBe(":---:");
  });
});

describe("markdown-table-generator renderMarkdown", () => {
  it("renders a basic table", () => {
    const md = renderMarkdown(t2());
    expect(md).toContain("| Name  | Age  |");
    expect(md).toContain("| :---  | ---: |");
    expect(md).toContain("| Ada   | 36   |");
    expect(md).toContain("| Linus | 54   |");
  });
  it("supports compact (unpadded) output", () => {
    const md = renderMarkdown(t2(), { padded: false });
    // Compact means no padding added beyond the cell content
    expect(md).toContain("| Ada | 36 |");
  });
  it("escapes pipes in cells", () => {
    const t: TableModel = {
      headers: ["x"], rows: [["a|b"]], aligns: ["left"], headerRow: true,
    };
    expect(renderMarkdown(t)).toContain("a\\|b");
  });
  it("emits a separator row even when headerRow is false", () => {
    const t = { ...t2(), headerRow: false };
    const md = renderMarkdown(t);
    expect(md).toContain(":---");
    expect(md).toContain("---:");
  });
});

describe("markdown-table-generator renderHtml", () => {
  it("renders table with alignment styles", () => {
    const html = renderHtml(t2());
    expect(html).toContain("<table>");
    expect(html).toContain("text-align:left");
    expect(html).toContain("text-align:right");
    expect(html).toContain('<th style="text-align:left">Name</th>');
    expect(html).toContain('<td style="text-align:right">36</td>');
  });
  it("escapes HTML metacharacters", () => {
    const t: TableModel = {
      headers: ["x"], rows: [["<b>hi</b>"]], aligns: ["left"], headerRow: true,
    };
    expect(renderHtml(t)).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });
});

describe("markdown-table-generator renderCsv / renderTsv", () => {
  it("renders CSV with header", () => {
    const csv = renderCsv(t2());
    expect(csv).toContain("Name,Age");
    expect(csv).toContain("Ada,36");
  });
  it("quotes cells with commas", () => {
    const t: TableModel = {
      headers: ["x"], rows: [["a,b"]], aligns: ["left"], headerRow: true,
    };
    expect(renderCsv(t)).toContain('"a,b"');
  });
  it("renders TSV", () => {
    const tsv = renderTsv(t2());
    expect(tsv).toContain("Name\tAge");
    expect(tsv).toContain("Ada\t36");
  });
});

describe("markdown-table-generator renderJson", () => {
  it("renders array of objects keyed by header", () => {
    const json = renderJson(t2());
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].Name).toBe("Ada");
    expect(parsed[0].Age).toBe("36");
    expect(parsed[1].Name).toBe("Linus");
  });
});

describe("markdown-table-generator renderJira", () => {
  it("renders Jira wiki markup", () => {
    const jira = renderJira(t2());
    expect(jira).toContain("||Name||Age||");
    expect(jira).toContain("|Ada|36|");
    expect(jira).toContain("|Linus|54|");
  });
});

describe("markdown-table-generator CSV parsing", () => {
  it("csvQuote wraps cells with special chars", () => {
    expect(csvQuote("plain")).toBe("plain");
    expect(csvQuote('a"b')).toBe('"a""b"');
    expect(csvQuote("a,b")).toBe('"a,b"');
  });
  it("parseCsvLine splits simple", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("parseCsvLine handles quoted commas", () => {
    expect(parseCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("parseCsvLine handles doubled quotes", () => {
    expect(parseCsvLine('"a""b"')).toEqual(['a"b']);
  });
  it("parseCsv auto-detects tab delimiter", () => {
    const rows = parseCsv("a\tb\nc\td");
    expect(rows).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("parseCsv handles embedded newlines in quoted fields", () => {
    const rows = parseCsv('"line1\nline2",b');
    expect(rows[0][0]).toBe("line1\nline2");
    expect(rows[0][1]).toBe("b");
  });
  it("parseCsv strips trailing empty row", () => {
    const rows = parseCsv("a,b\n");
    expect(rows).toEqual([["a", "b"]]);
  });
  it("importFromCsv uses first row as headers", () => {
    const t = importFromCsv("Name,Age\nAda,36\nLinus,54");
    expect(t.headers).toEqual(["Name", "Age"]);
    expect(t.rows).toEqual([["Ada", "36"], ["Linus", "54"]]);
  });
});

describe("markdown-table-generator parseMarkdownTable", () => {
  it("parses a basic markdown table", () => {
    const md = "| Name | Age |\n| :--- | ---: |\n| Ada | 36 |";
    const t = parseMarkdownTable(md);
    expect(t).not.toBeNull();
    expect(t!.headers).toEqual(["Name", "Age"]);
    expect(t!.aligns).toEqual(["left", "right"]);
    expect(t!.rows).toEqual([["Ada", "36"]]);
  });
  it("round-trips through renderMarkdown", () => {
    const original = t2();
    const md = renderMarkdown(original);
    const round = parseMarkdownTable(md);
    expect(round).not.toBeNull();
    expect(round!.headers).toEqual(["Name", "Age"]);
    expect(round!.rows).toEqual([["Ada", "36"], ["Linus", "54"]]);
    expect(round!.aligns).toEqual(["left", "right"]);
  });
  it("returns null for non-table input", () => {
    expect(parseMarkdownTable("# Heading")).toBeNull();
    expect(parseMarkdownTable("only one line")).toBeNull();
  });
  it("unescapes pipes in cells", () => {
    const md = "| a | b |\n| - | - |\n| c\\|d | e |";
    const t = parseMarkdownTable(md);
    expect(t!.rows[0][0]).toBe("c|d");
  });
});

describe("markdown-table-generator computeStats", () => {
  it("counts rows, cols, cells", () => {
    const s = computeStats(t2());
    expect(s.rows).toBe(2);
    expect(s.cols).toBe(2);
    expect(s.cells).toBe(4);
    expect(s.emptyCells).toBe(0);
  });
  it("counts empty cells", () => {
    const s = computeStats(createEmptyTable(2, 2));
    expect(s.emptyCells).toBe(4);
  });
});

describe("markdown-table-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, rows: 2, cols: 3, preview: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, rows: i, cols: i, preview: `p${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, rows: 1, cols: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("markdown-table-generator shareable URL", () => {
  it("encodes the table in the hash", () => {
    const r = buildShareUrl(t2());
    expect(r.tooLarge).toBe(false);
    expect(r.url).toContain("#mdtbl=");
  });
  it("parses the table back from the hash", () => {
    const r = buildShareUrl(t2());
    const hash = r.url.startsWith("#") ? r.url : r.url.slice(r.url.indexOf("#"));
    const p = parseShareUrl(hash);
    expect(p.table).not.toBeNull();
    expect(p.table!.headers).toEqual(["Name", "Age"]);
    expect(p.table!.rows).toEqual([["Ada", "36"], ["Linus", "54"]]);
  });
  it("returns null for an empty or non-mdtbl hash", () => {
    expect(parseShareUrl("").table).toBeNull();
    expect(parseShareUrl("#foo=bar").table).toBeNull();
  });
  it("flags too-large tables", () => {
    const big: TableModel = {
      headers: Array.from({ length: 50 }, (_, i) => `col${i}`),
      rows: Array.from({ length: 200 }, (_, r) =>
        Array.from({ length: 50 }, (_, c) => `cell-${r}-${c}-padding-padding`)),
      aligns: Array.from({ length: 50 }, () => "left" as Alignment),
      headerRow: true,
    };
    const r = buildShareUrl(big);
    expect(r.tooLarge).toBe(true);
    expect(r.url).toBe("");
  });
});
