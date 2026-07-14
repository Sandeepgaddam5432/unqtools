import { describe, it, expect, beforeEach } from "vitest";
import {
  parseCsv, parseCsvRows, toCsv, escapeField,
  splitByRowCount, splitByFileCount, splitByFileSize, splitByColumnValue,
  dedupRows, selectColumns, removeEmptyRows,
  generateFilename, sanitizeFilename, stripExtension, previewRows,
  byteSize, detectDelimiter, detectEncoding, stripBom,
  estimateSplitCount, splitCsv, formatBytes,
  createZipBlob,
  loadHistory, saveToHistory, clearHistory,
  type ParsedCsv, type SplitOptions,
} from "./logic";

describe("csv-splitter parseCsvRows", () => {
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
  it("handles embedded newlines", () => {
    const rows = parseCsvRows('"line1\nline2",b', ",");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("line1\nline2");
  });
  it("handles CRLF", () => {
    const rows = parseCsvRows("a,b\r\n1,2", ",");
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("csv-splitter parseCsv", () => {
  it("parses with header", () => {
    const csv = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(csv.headers).toEqual(["name", "age"]);
    expect(csv.rows).toEqual([["Alice", "30"]]);
  });
  it("parses without header", () => {
    const csv = parseCsv("a,b\nc,d", { delimiter: ",", hasHeader: false });
    expect(csv.headers).toEqual([]);
  });
});

describe("csv-splitter escapeField + toCsv", () => {
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

describe("csv-splitter splitByRowCount", () => {
  it("splits into chunks of N rows", () => {
    const rows = [["1"], ["2"], ["3"], ["4"], ["5"]];
    const chunks = splitByRowCount(rows, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[2]).toHaveLength(1);
  });
  it("throws on rowsPerFile < 1", () => {
    expect(() => splitByRowCount([["1"]], 0)).toThrow();
  });
  it("returns single empty chunk for empty input", () => {
    const chunks = splitByRowCount([], 10);
    expect(chunks).toEqual([[]]);
  });
  it("handles rowsPerFile greater than total", () => {
    const rows = [["1"], ["2"]];
    const chunks = splitByRowCount(rows, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(2);
  });
});

describe("csv-splitter splitByFileCount", () => {
  it("distributes rows across N files", () => {
    const rows = [["1"], ["2"], ["3"], ["4"], ["5"]];
    const chunks = splitByFileCount(rows, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(3);
    expect(chunks[1]).toHaveLength(2);
  });
  it("throws on fileCount < 1", () => {
    expect(() => splitByFileCount([["1"]], 0)).toThrow();
  });
});

describe("csv-splitter splitByFileSize", () => {
  it("splits when target size exceeded", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"], ["3", "4"], ["5", "6"]];
    // small target to force split
    const chunks = splitByFileSize(headers, rows, 10, ",", true);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("single chunk when all fits", () => {
    const headers = ["a"];
    const rows = [["1"]];
    const chunks = splitByFileSize(headers, rows, 1024, ",", true);
    expect(chunks).toHaveLength(1);
  });
  it("throws on bytesPerFile < 1", () => {
    expect(() => splitByFileSize([], [], 0, ",", true)).toThrow();
  });
});

describe("csv-splitter splitByColumnValue", () => {
  it("groups rows by column value", () => {
    const headers = ["cat", "v"];
    const rows = [["A", "1"], ["B", "2"], ["A", "3"]];
    const groups = splitByColumnValue(headers, rows, "cat");
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.value === "A");
    expect(a!.rows).toHaveLength(2);
  });
  it("throws on missing column", () => {
    expect(() => splitByColumnValue(["a"], [["1"]], "b")).toThrow();
  });
  it("preserves first-seen order", () => {
    const rows = [["B"], ["A"], ["B"], ["A"]];
    const groups = splitByColumnValue(["c"], rows, "c");
    expect(groups.map((g) => g.value)).toEqual(["B", "A"]);
  });
});

describe("csv-splitter dedupRows", () => {
  it("removes duplicate full rows", () => {
    const rows = [["a", "1"], ["a", "1"], ["b", "2"]];
    const result = dedupRows(rows);
    expect(result.rows).toHaveLength(2);
    expect(result.removed).toBe(1);
  });
  it("does not remove different rows", () => {
    const rows = [["a"], ["b"]];
    expect(dedupRows(rows).removed).toBe(0);
  });
});

describe("csv-splitter selectColumns", () => {
  it("keeps only selected columns", () => {
    const headers = ["a", "b", "c"];
    const rows = [["1", "2", "3"]];
    const result = selectColumns(headers, rows, ["a", "c"]);
    expect(result.headers).toEqual(["a", "c"]);
    expect(result.rows[0]).toEqual(["1", "3"]);
  });
  it("returns unchanged when columns empty", () => {
    const headers = ["a"];
    const rows = [["1"]];
    const result = selectColumns(headers, rows, []);
    expect(result.headers).toEqual(headers);
  });
});

describe("csv-splitter removeEmptyRows", () => {
  it("removes rows where all cells are empty", () => {
    const rows = [["a", "1"], ["", ""], ["b", "2"]];
    expect(removeEmptyRows(rows)).toHaveLength(2);
  });
  it("keeps rows with at least one non-empty cell", () => {
    const rows = [["", "x"]];
    expect(removeEmptyRows(rows)).toHaveLength(1);
  });
});

describe("csv-splitter generateFilename", () => {
  it("substitutes placeholders", () => {
    const name = generateFilename("{base}_part{index}_of_{total}.csv", 0, 5, "sales");
    expect(name).toBe("sales_part1_of_5.csv");
  });
  it("zero-pads index based on total digit count", () => {
    const name = generateFilename("p{index}.csv", 2, 12, "x");
    expect(name).toBe("p03.csv");
  });
  it("includes group value when provided", () => {
    const name = generateFilename("{base}_{group}.csv", 0, 1, "data", "Electronics");
    expect(name).toContain("Electronics");
  });
  it("sanitizes group value", () => {
    const name = generateFilename("{base}_{group}.csv", 0, 1, "data", "a/b\\c");
    expect(name).toContain("a_b_c");
  });
});

describe("csv-splitter sanitizeFilename + stripExtension", () => {
  it("sanitizes special chars", () => {
    expect(sanitizeFilename("a/b\\c?d")).toBe("a_b_c_d");
  });
  it("strips extension", () => {
    expect(stripExtension("file.csv")).toBe("file");
    expect(stripExtension("file")).toBe("file");
    expect(stripExtension("a.b.c")).toBe("a.b");
  });
});

describe("csv-splitter previewRows", () => {
  it("returns first N rows as objects", () => {
    const rows = [["1", "Alice"], ["2", "Bob"], ["3", "Carol"]];
    const preview = previewRows(["id", "name"], rows, 2);
    expect(preview).toHaveLength(2);
    expect(preview[0]).toEqual({ id: "1", name: "Alice" });
  });
});

describe("csv-splitter byteSize", () => {
  it("computes UTF-8 byte size", () => {
    expect(byteSize("abc")).toBe(3);
    expect(byteSize("")).toBe(0);
    expect(byteSize("é")).toBe(2); // 2-byte UTF-8
  });
});

describe("csv-splitter detectDelimiter + detectEncoding + stripBom", () => {
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });
  it("defaults to comma when no delimiter found", () => {
    expect(detectDelimiter("singleword")).toBe(",");
  });
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).hasBom).toBe(true);
  });
  it("detects UTF-16LE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x41])).encoding).toBe("UTF-16LE");
  });
  it("strips UTF-8 BOM", () => {
    expect(stripBom("\uFEFFhello")).toBe("hello");
  });
});

describe("csv-splitter splitCsv dispatcher", () => {
  const parsed: ParsedCsv = {
    headers: ["id", "name"],
    rows: [["1", "Alice"], ["2", "Bob"], ["3", "Carol"], ["4", "Dave"], ["5", "Eve"]],
    rawLineCount: 6,
  };

  it("splits by rowCount", () => {
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 2, preserveHeader: true, delimiter: "," };
    const { results, stats } = splitCsv(parsed, opts, "data", "{base}_{index}.csv");
    expect(results).toHaveLength(3);
    expect(stats.splitCount).toBe(3);
    expect(stats.totalRows).toBe(5);
    expect(results[0].rowCount).toBe(2);
    expect(results[0].content).toContain("id,name");
  });

  it("splits by fileCount", () => {
    const opts: SplitOptions = { mode: "fileCount", fileCount: 2, preserveHeader: true, delimiter: "," };
    const { results } = splitCsv(parsed, opts, "data", "{base}_{index}.csv");
    expect(results).toHaveLength(2);
  });

  it("splits by columnValue", () => {
    const parsed2: ParsedCsv = {
      headers: ["cat", "v"],
      rows: [["A", "1"], ["B", "2"], ["A", "3"]],
      rawLineCount: 4,
    };
    const opts: SplitOptions = { mode: "columnValue", groupColumn: "cat", preserveHeader: true, delimiter: "," };
    const { results } = splitCsv(parsed2, opts, "data", "{base}_{group}.csv");
    expect(results).toHaveLength(2);
    expect(results[0].filename).toContain("A");
  });

  it("applies column selection", () => {
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 100, preserveHeader: true, delimiter: "," };
    const { results } = splitCsv(parsed, opts, "data", "{base}.csv", ["name"]);
    expect(results[0].headers).toEqual(["name"]);
    expect(results[0].content).not.toContain("id");
  });

  it("applies dedup", () => {
    const dup: ParsedCsv = {
      headers: ["v"],
      rows: [["1"], ["1"], ["2"]],
      rawLineCount: 4,
    };
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 100, preserveHeader: true, delimiter: "," };
    const { stats } = splitCsv(dup, opts, "data", "{base}.csv", [], true);
    expect(stats.dedupedCount).toBe(1);
    expect(stats.totalRows).toBe(2);
  });

  it("applies removeEmptyRows", () => {
    const withEmpty: ParsedCsv = {
      headers: ["v"],
      rows: [["1"], [""], ["2"]],
      rawLineCount: 4,
    };
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 100, preserveHeader: true, delimiter: "," };
    const { stats } = splitCsv(withEmpty, opts, "data", "{base}.csv", [], false, true);
    expect(stats.totalRows).toBe(2);
  });

  it("omits header when preserveHeader is false", () => {
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 100, preserveHeader: false, delimiter: "," };
    const { results } = splitCsv(parsed, opts, "data", "{base}.csv");
    expect(results[0].headers).toEqual([]);
    expect(results[0].content).not.toContain("id,name");
  });

  it("throws on unknown mode", () => {
    const opts = { mode: "unknown" as any, preserveHeader: true, delimiter: "," };
    expect(() => splitCsv(parsed, opts, "data", "{base}.csv")).toThrow();
  });
});

describe("csv-splitter estimateSplitCount", () => {
  it("estimates rowCount split count", () => {
    const parsed: ParsedCsv = { headers: ["a"], rows: [["1"], ["2"], ["3"]], rawLineCount: 4 };
    const opts: SplitOptions = { mode: "rowCount", rowsPerFile: 2, preserveHeader: true, delimiter: "," };
    expect(estimateSplitCount(parsed, opts)).toBe(2);
  });
  it("estimates fileCount split count", () => {
    const parsed: ParsedCsv = { headers: ["a"], rows: [["1"]], rawLineCount: 2 };
    const opts: SplitOptions = { mode: "fileCount", fileCount: 4, preserveHeader: true, delimiter: "," };
    expect(estimateSplitCount(parsed, opts)).toBe(4);
  });
  it("estimates columnValue split count (unique values)", () => {
    const parsed: ParsedCsv = { headers: ["c"], rows: [["A"], ["B"], ["A"]], rawLineCount: 4 };
    const opts: SplitOptions = { mode: "columnValue", groupColumn: "c", preserveHeader: true, delimiter: "," };
    expect(estimateSplitCount(parsed, opts)).toBe(2);
  });
});

describe("csv-splitter formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("csv-splitter createZipBlob", () => {
  it("produces a valid ZIP blob", () => {
    const blob = createZipBlob([
      { name: "a.csv", content: "x,y\n1,2" },
      { name: "b.csv", content: "x,y\n3,4" },
    ]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    // ZIP magic: PK\x03\x04
    expect(blob.type).toBe("application/zip");
  });
  it("empty file list still produces valid ZIP", () => {
    const blob = createZipBlob([]);
    expect(blob.size).toBeGreaterThanOrEqual(22); // EOCD only
  });
});

describe("csv-splitter history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileName: "data.csv", mode: "rowCount", delimiter: ",", splitCount: 3, totalRows: 100, splitAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileName: "data.csv", mode: "rowCount", delimiter: ",", splitCount: 3, totalRows: 100, splitAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
