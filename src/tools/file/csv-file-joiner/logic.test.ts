import { describe, it, expect, beforeEach } from "vitest";
import {
  parseCsv, parseCsvRows, toCsv, escapeField, unionHeaders,
  appendMerge, innerJoin, outerJoin, mergeCsvs,
  dedupRows, sortByColumn, filterRows, reorderColumns,
  previewRows, detectDelimiter, detectEncoding, stripBom,
  loadHistory, saveToHistory, clearHistory, formatBytes,
  type ParsedCsv, type MergeOptions,
} from "./logic";

describe("csv-joiner parseCsvRows", () => {
  it("parses simple CSV", () => {
    const rows = parseCsvRows("a,b,c\n1,2,3", ",");
    expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("handles quoted fields with delimiter inside", () => {
    const rows = parseCsvRows('"hello, world",b', ",");
    expect(rows[0]).toEqual(["hello, world", "b"]);
  });
  it("handles escaped quotes", () => {
    const rows = parseCsvRows('"say ""hi""",b', ",");
    expect(rows[0]).toEqual(['say "hi"', "b"]);
  });
  it("handles embedded newlines in quoted fields", () => {
    const rows = parseCsvRows('"line1\nline2",b', ",");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("line1\nline2");
  });
  it("handles CRLF line endings", () => {
    const rows = parseCsvRows("a,b\r\n1,2\r\n", ",");
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("handles tab delimiter", () => {
    const rows = parseCsvRows("a\tb\tc\n1\t2\t3", "\t");
    expect(rows[0]).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace when option set", () => {
    const rows = parseCsvRows(" a , b ", ",", true);
    expect(rows[0]).toEqual(["a", "b"]);
  });
});

describe("csv-joiner parseCsv", () => {
  it("parses with header", () => {
    const csv = parseCsv("name,age\nAlice,30\nBob,25", { delimiter: ",", hasHeader: true });
    expect(csv.headers).toEqual(["name", "age"]);
    expect(csv.rows).toEqual([["Alice", "30"], ["Bob", "25"]]);
  });
  it("parses without header", () => {
    const csv = parseCsv("a,b\nc,d", { delimiter: ",", hasHeader: false });
    expect(csv.headers).toEqual([]);
    expect(csv.rows).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("csv-joiner escapeField + toCsv", () => {
  it("escapes fields containing delimiter", () => {
    expect(escapeField("a,b", ",")).toBe('"a,b"');
  });
  it("escapes fields containing quotes", () => {
    expect(escapeField('say "hi"', ",")).toBe('"say ""hi"""');
  });
  it("does not escape simple fields", () => {
    expect(escapeField("hello", ",")).toBe("hello");
  });
  it("round-trips CSV", () => {
    const headers = ["name", "note"];
    const rows = [["Alice", "hello, world"], ["Bob", 'say "hi"']];
    const csv = toCsv(headers, rows);
    const parsed = parseCsv(csv, { delimiter: ",", hasHeader: true });
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual(rows);
  });
});

describe("csv-joiner unionHeaders", () => {
  it("unions headers preserving first-seen order", () => {
    const f1: ParsedCsv = { headers: ["a", "b"], rows: [], rawLineCount: 1 };
    const f2: ParsedCsv = { headers: ["b", "c"], rows: [], rawLineCount: 1 };
    expect(unionHeaders([f1, f2])).toEqual(["a", "b", "c"]);
  });
});

describe("csv-joiner appendMerge", () => {
  it("stacks rows under union header", () => {
    const f1: ParsedCsv = { headers: ["a", "b"], rows: [["1", "2"]], rawLineCount: 2 };
    const f2: ParsedCsv = { headers: ["b", "c"], rows: [["3", "4"]], rawLineCount: 2 };
    const result = appendMerge([f1, f2], { mode: "append", skipDuplicateHeaders: true });
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([["1", "2", ""], ["", "3", "4"]]);
  });
  it("aligns columns when order differs", () => {
    const f1: ParsedCsv = { headers: ["x", "y"], rows: [["1", "2"]], rawLineCount: 2 };
    const f2: ParsedCsv = { headers: ["y", "x"], rows: [["4", "3"]], rawLineCount: 2 };
    const result = appendMerge([f1, f2], { mode: "append", skipDuplicateHeaders: true });
    expect(result.headers).toEqual(["x", "y"]);
    expect(result.rows[1]).toEqual(["3", "4"]);
  });
});

describe("csv-joiner innerJoin", () => {
  it("keeps only matching keys", () => {
    const f1: ParsedCsv = { headers: ["id", "name"], rows: [["1", "Alice"], ["2", "Bob"]], rawLineCount: 3 };
    const f2: ParsedCsv = { headers: ["id", "age"], rows: [["1", "30"], ["3", "40"]], rawLineCount: 3 };
    const result = innerJoin([f1, f2], "id");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(["1", "Alice", "30"]);
  });
});

describe("csv-joiner outerJoin", () => {
  it("keeps all keys", () => {
    const f1: ParsedCsv = { headers: ["id", "name"], rows: [["1", "Alice"], ["2", "Bob"]], rawLineCount: 3 };
    const f2: ParsedCsv = { headers: ["id", "age"], rows: [["1", "30"], ["3", "40"]], rawLineCount: 3 };
    const result = outerJoin([f1, f2], "id");
    expect(result.rows).toHaveLength(3);
  });
  it("fills missing cells with empty string", () => {
    const f1: ParsedCsv = { headers: ["id", "name"], rows: [["2", "Bob"]], rawLineCount: 2 };
    const f2: ParsedCsv = { headers: ["id", "age"], rows: [["1", "30"]], rawLineCount: 2 };
    const result = outerJoin([f1, f2], "id");
    const bobRow = result.rows.find((r) => r[0] === "2");
    expect(bobRow).toBeDefined();
    expect(bobRow![2]).toBe("");
  });
});

describe("csv-joiner mergeCsvs", () => {
  it("throws on empty files", () => {
    const result = mergeCsvs([], { mode: "append", skipDuplicateHeaders: true });
    expect(result.headers).toEqual([]);
  });
  it("returns stats with file count", () => {
    const f1: ParsedCsv = { headers: ["a"], rows: [["1"], ["2"]], rawLineCount: 3 };
    const result = mergeCsvs([f1], { mode: "append", skipDuplicateHeaders: true });
    expect(result.stats.fileCount).toBe(1);
    expect(result.stats.rowCountPerFile).toEqual([2]);
    expect(result.stats.totalRows).toBe(2);
    expect(result.stats.mergedColumns).toBe(1);
  });
});

describe("csv-joiner dedupRows", () => {
  it("dedupes by full row", () => {
    const rows = [["a", "1"], ["a", "1"], ["b", "2"]];
    const result = dedupRows(["x", "y"], rows);
    expect(result.rows).toHaveLength(2);
    expect(result.removed).toBe(1);
  });
  it("dedupes by key column", () => {
    const rows = [["1", "a"], ["1", "b"], ["2", "c"]];
    const result = dedupRows(["id", "v"], rows, "id");
    expect(result.rows).toHaveLength(2);
  });
});

describe("csv-joiner sortByColumn", () => {
  it("sorts ascending string", () => {
    const rows = [["banana"], ["apple"], ["cherry"]];
    const sorted = sortByColumn(["name"], rows, "name", "asc");
    expect(sorted[0][0]).toBe("apple");
    expect(sorted[2][0]).toBe("cherry");
  });
  it("sorts descending string", () => {
    const rows = [["banana"], ["apple"], ["cherry"]];
    const sorted = sortByColumn(["name"], rows, "name", "desc");
    expect(sorted[0][0]).toBe("cherry");
  });
  it("sorts numerically", () => {
    const rows = [["10"], ["2"], ["1"]];
    const sorted = sortByColumn(["n"], rows, "n", "asc", true);
    expect(sorted.map((r) => r[0])).toEqual(["1", "2", "10"]);
  });
  it("throws on missing column", () => {
    expect(() => sortByColumn(["a"], [["1"]], "b")).toThrow();
  });
});

describe("csv-joiner filterRows", () => {
  it("filters by substring (case-insensitive)", () => {
    const rows = [["Alice"], ["Bob"], ["alice2"]];
    const filtered = filterRows(["name"], rows, "name", "ali");
    expect(filtered).toHaveLength(2);
  });
  it("filters exact match", () => {
    const rows = [["Alice"], ["Alice2"], ["Bob"]];
    const filtered = filterRows(["name"], rows, "name", "Alice", true);
    expect(filtered).toHaveLength(1);
  });
  it("returns all when query empty", () => {
    const rows = [["a"], ["b"]];
    expect(filterRows(["x"], rows, "x", "")).toHaveLength(2);
  });
});

describe("csv-joiner reorderColumns", () => {
  it("reorders columns", () => {
    const rows = [["1", "2", "3"]];
    const result = reorderColumns(["a", "b", "c"], rows, ["c", "a"]);
    expect(result.headers).toEqual(["c", "a"]);
    expect(result.rows[0]).toEqual(["3", "1"]);
  });
});

describe("csv-joiner previewRows", () => {
  it("returns first N rows as objects", () => {
    const rows = [["1", "Alice"], ["2", "Bob"], ["3", "Carol"]];
    const preview = previewRows(["id", "name"], rows, 2);
    expect(preview).toHaveLength(2);
    expect(preview[0]).toEqual({ id: "1", name: "Alice" });
  });
});

describe("csv-joiner detectDelimiter", () => {
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });
  it("defaults to comma when no delimiter found", () => {
    expect(detectDelimiter("singleword")).toBe(",");
  });
});

describe("csv-joiner detectEncoding + stripBom", () => {
  it("detects UTF-8 BOM", () => {
    const r = detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]));
    expect(r.encoding).toBe("UTF-8");
    expect(r.hasBom).toBe(true);
  });
  it("detects UTF-16LE BOM", () => {
    const r = detectEncoding(new Uint8Array([0xff, 0xfe, 0x41]));
    expect(r.encoding).toBe("UTF-16LE");
  });
  it("defaults to UTF-8 without BOM", () => {
    const r = detectEncoding(new Uint8Array([0x41, 0x42]));
    expect(r.encoding).toBe("UTF-8");
    expect(r.hasBom).toBe(false);
  });
  it("strips UTF-8 BOM from string", () => {
    const str = "\uFEFFhello";
    expect(stripBom(str)).toBe("hello");
  });
  it("leaves non-BOM string unchanged", () => {
    expect(stripBom("hello")).toBe("hello");
  });
});

describe("csv-joiner history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileNames: ["a.csv", "b.csv"], mode: "append", delimiter: ",", mergedAt: "2026-01-01", totalRows: 10 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileNames: ["a.csv"], mode: "append", delimiter: ",", mergedAt: "2026-01-01", totalRows: 5 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("csv-joiner formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});
