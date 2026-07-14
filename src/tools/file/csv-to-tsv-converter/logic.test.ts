import { describe, it, expect, beforeEach } from "vitest";
import {
  parseCsvRows, parseCsv, escapeField, toDelimited,
  detectDelimiter, detectEncoding, stripBom,
  removeEmptyRows, previewRows, byteSize,
  convertCsvToTsv, formatBytes, stripExtension, deriveOutputFilename,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ConvertOptions, type ParsedCsv,
} from "./logic";

describe("csv2tsv parseCsvRows", () => {
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
  it("handles custom delimiter (semicolon)", () => {
    const rows = parseCsvRows("a;b;c\n1;2;3", ";");
    expect(rows[0]).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace when option set", () => {
    const rows = parseCsvRows(" a , b ", ",", true);
    expect(rows[0]).toEqual(["a", "b"]);
  });
});

describe("csv2tsv parseCsv", () => {
  it("parses with headers + data rows", () => {
    const csv = parseCsv("name,age\nAlice,30\nBob,25", { inputDelimiter: ",", trimWhitespace: false });
    expect(csv.headers).toEqual(["name", "age"]);
    expect(csv.rows).toEqual([["Alice", "30"], ["Bob", "25"]]);
  });
});

describe("csv2tsv escapeField + toDelimited", () => {
  it("escapes fields containing delimiter", () => {
    expect(escapeField("a\tb", "\t")).toBe('"a\tb"');
  });
  it("escapes fields containing quotes", () => {
    expect(escapeField('say "hi"', "\t")).toBe('"say ""hi"""');
  });
  it("does not escape simple fields", () => {
    expect(escapeField("hello", "\t")).toBe("hello");
  });
  it("round-trips CSV → TSV → CSV", () => {
    const headers = ["name", "note"];
    const rows = [["Alice", "hello, world"], ["Bob", 'say "hi"']];
    const tsv = toDelimited(headers, rows, "\t");
    // TSV should preserve quotes properly even though delimiter is tab
    const reParsed = parseCsvRows(tsv, "\t");
    expect(reParsed[0]).toEqual(headers);
    expect(reParsed[1]).toEqual(rows[0]);
    expect(reParsed[2]).toEqual(rows[1]);
  });
});

describe("csv2tsv detectDelimiter + detectEncoding + stripBom", () => {
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });
  it("detects semicolon", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
  });
  it("detects pipe", () => {
    expect(detectDelimiter("a|b|c")).toBe("|");
  });
  it("defaults to comma", () => {
    expect(detectDelimiter("singleword")).toBe(",");
  });
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).hasBom).toBe(true);
  });
  it("detects UTF-16LE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x41])).encoding).toBe("UTF-16LE");
  });
  it("detects UTF-16BE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xfe, 0xff, 0x41])).encoding).toBe("UTF-16BE");
  });
  it("strips UTF-8 BOM", () => {
    expect(stripBom("\uFEFFhello")).toBe("hello");
  });
  it("leaves non-BOM string unchanged", () => {
    expect(stripBom("hello")).toBe("hello");
  });
});

describe("csv2tsv removeEmptyRows", () => {
  it("removes rows where all cells empty", () => {
    expect(removeEmptyRows([["a", "1"], ["", ""]])).toHaveLength(1);
  });
  it("keeps rows with at least one non-empty cell", () => {
    expect(removeEmptyRows([["", "x"]])).toHaveLength(1);
  });
});

describe("csv2tsv previewRows", () => {
  it("returns first N rows as objects", () => {
    const rows = [["1", "Alice"], ["2", "Bob"]];
    const preview = previewRows(["id", "name"], rows, 1);
    expect(preview).toEqual([{ id: "1", name: "Alice" }]);
  });
});

describe("csv2tsv byteSize", () => {
  it("computes UTF-8 byte size", () => {
    expect(byteSize("abc")).toBe(3);
    expect(byteSize("")).toBe(0);
    expect(byteSize("é")).toBe(2);
  });
});

describe("csv2tsv convertCsvToTsv", () => {
  const opts: ConvertOptions = {
    inputDelimiter: ",",
    outputDelimiter: "\t",
    trimWhitespace: false,
    removeEmptyRows: false,
    skipHeader: false,
  };

  it("converts simple CSV to TSV", () => {
    const input = "name,age\nAlice,30\nBob,25";
    const result = convertCsvToTsv(input, opts);
    expect(result.output).toBe("name\tage\nAlice\t30\nBob\t25");
    expect(result.stats.rowCount).toBe(2);
    expect(result.stats.columnCount).toBe(2);
  });

  it("preserves quoted fields with delimiter", () => {
    const input = 'name,note\nAlice,"hello, world"';
    const result = convertCsvToTsv(input, opts);
    // In TSV, "hello, world" no longer needs quoting (no tab inside).
    expect(result.output).toBe("name\tnote\nAlice\thello, world");
  });

  it("re-quotes fields containing tab in output", () => {
    const input = 'name,note\nAlice,"has\ttab"';
    const result = convertCsvToTsv(input, opts);
    expect(result.output).toContain('"has\ttab"');
  });

  it("trims whitespace when option set", () => {
    const input = "name,age\n Alice , 30 ";
    const result = convertCsvToTsv(input, { ...opts, trimWhitespace: true });
    expect(result.output).toBe("name\tage\nAlice\t30");
  });

  it("removes empty rows when option set", () => {
    const input = "name,age\nAlice,30\n,\nBob,25";
    const result = convertCsvToTsv(input, { ...opts, removeEmptyRows: true });
    expect(result.stats.rowCount).toBe(2);
  });

  it("skips header when option set", () => {
    const input = "name,age\nAlice,30";
    const result = convertCsvToTsv(input, { ...opts, skipHeader: true });
    expect(result.output).toBe("Alice\t30");
  });

  it("supports custom output delimiter", () => {
    const input = "name,age\nAlice,30";
    const result = convertCsvToTsv(input, { ...opts, outputDelimiter: ";" });
    expect(result.output).toBe("name;age\nAlice;30");
  });

  it("computes stats correctly", () => {
    const input = "a,b\n1,2\n3,4";
    const result = convertCsvToTsv(input, opts);
    expect(result.stats.rowCount).toBe(2);
    expect(result.stats.columnCount).toBe(2);
    expect(result.stats.inputBytes).toBe(input.length);
    expect(result.stats.outputBytes).toBe(result.output.length);
  });
});

describe("csv2tsv formatBytes + stripExtension + deriveOutputFilename", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("strips extension", () => {
    expect(stripExtension("file.csv")).toBe("file");
    expect(stripExtension("file")).toBe("file");
  });
  it("derives output filename", () => {
    expect(deriveOutputFilename("data.csv", "tsv")).toBe("data.tsv");
    expect(deriveOutputFilename("data", "tsv")).toBe("data.tsv");
  });
});

describe("csv2tsv history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileName: "a.csv", inputDelimiter: ",", outputDelimiter: "\t", rowCount: 10, convertedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileName: "a.csv", inputDelimiter: ",", outputDelimiter: "\t", rowCount: 10, convertedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("csv2tsv buildShareUrl", () => {
  it("builds share URL with params", () => {
    (globalThis as any).window = { location: { origin: "https://x.io", pathname: "/tools/csv-to-tsv" } };
    const url = buildShareUrl({
      inputDelimiter: ",", outputDelimiter: "\t",
      trimWhitespace: true, removeEmptyRows: false, skipHeader: false,
    });
    expect(url).toContain("#in=");
    expect(url).toContain("out=%5Ct"); // \t encoded
    expect(url).toContain("trim=true");
    delete (globalThis as any).window;
  });
});
