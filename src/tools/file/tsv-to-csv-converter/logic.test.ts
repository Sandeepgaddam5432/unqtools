import { describe, it, expect, beforeEach } from "vitest";
import {
  parseRows, parseTsv, escapeField, toDelimited,
  detectDelimiter, detectEncoding, stripBom,
  removeEmptyRows, previewRows, byteSize,
  convertTsvToCsv, formatBytes, stripExtension, deriveOutputFilename,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ConvertOptions,
} from "./logic";

describe("tsv2csv parseRows", () => {
  it("parses simple TSV", () => {
    const rows = parseRows("a\tb\tc\n1\t2\t3", "\t");
    expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("handles quoted fields with delimiter inside", () => {
    const rows = parseRows('"hello\tworld"\tb', "\t");
    expect(rows[0]).toEqual(["hello\tworld", "b"]);
  });
  it("handles escaped quotes", () => {
    const rows = parseRows('"say ""hi"""\tb', "\t");
    expect(rows[0]).toEqual(['say "hi"', "b"]);
  });
  it("handles embedded newlines in quoted fields", () => {
    const rows = parseRows('"line1\nline2"\tb', "\t");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("line1\nline2");
  });
  it("handles CRLF line endings", () => {
    const rows = parseRows("a\tb\r\n1\t2", "\t");
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("handles custom delimiter (comma)", () => {
    const rows = parseRows("a,b,c\n1,2,3", ",");
    expect(rows[0]).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace when option set", () => {
    const rows = parseRows(" a \t b ", "\t", true);
    expect(rows[0]).toEqual(["a", "b"]);
  });
});

describe("tsv2csv parseTsv", () => {
  it("parses with headers + data rows", () => {
    const tsv = parseTsv("name\tage\nAlice\t30\nBob\t25", { inputDelimiter: "\t", trimWhitespace: false });
    expect(tsv.headers).toEqual(["name", "age"]);
    expect(tsv.rows).toEqual([["Alice", "30"], ["Bob", "25"]]);
  });
});

describe("tsv2csv escapeField + toDelimited (RFC 4180)", () => {
  it("escapes fields containing comma", () => {
    expect(escapeField("a,b", ",")).toBe('"a,b"');
  });
  it("escapes fields containing quotes", () => {
    expect(escapeField('say "hi"', ",")).toBe('"say ""hi"""');
  });
  it("escapes fields containing newline", () => {
    expect(escapeField("line1\nline2", ",")).toBe('"line1\nline2"');
  });
  it("does not escape simple fields", () => {
    expect(escapeField("hello", ",")).toBe("hello");
  });
  it("round-trips TSV → CSV → CSV", () => {
    const headers = ["name", "note"];
    const rows = [["Alice", "has, comma"], ["Bob", 'has "quote"']];
    const csv = toDelimited(headers, rows, ",");
    // Re-parse as CSV (comma delimiter)
    const reParsed = parseRows(csv, ",");
    expect(reParsed[0]).toEqual(headers);
    expect(reParsed[1]).toEqual(rows[0]);
    expect(reParsed[2]).toEqual(rows[1]);
  });
  it("TSV field with comma in CSV output gets quoted (RFC 4180)", () => {
    const headers = ["name"];
    const rows = [["has,comma"]];
    const csv = toDelimited(headers, rows, ",");
    expect(csv).toContain('"has,comma"');
  });
});

describe("tsv2csv detectDelimiter", () => {
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
  it("detects semicolon", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
  });
  it("detects pipe", () => {
    expect(detectDelimiter("a|b|c")).toBe("|");
  });
  it("defaults to tab when no delimiter found", () => {
    expect(detectDelimiter("singleword")).toBe("\t");
  });
});

describe("tsv2csv detectEncoding + stripBom", () => {
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

describe("tsv2csv removeEmptyRows", () => {
  it("removes rows where all cells empty", () => {
    expect(removeEmptyRows([["a", "1"], ["", ""]])).toHaveLength(1);
  });
});

describe("tsv2csv previewRows + byteSize", () => {
  it("returns first N rows as objects", () => {
    const rows = [["1", "Alice"], ["2", "Bob"]];
    const preview = previewRows(["id", "name"], rows, 1);
    expect(preview).toEqual([{ id: "1", name: "Alice" }]);
  });
  it("computes UTF-8 byte size", () => {
    expect(byteSize("abc")).toBe(3);
    expect(byteSize("é")).toBe(2);
  });
});

describe("tsv2csv convertTsvToCsv", () => {
  const opts: ConvertOptions = {
    inputDelimiter: "\t",
    outputDelimiter: ",",
    trimWhitespace: false,
    removeEmptyRows: false,
    skipHeader: false,
  };

  it("converts simple TSV to CSV", () => {
    const input = "name\tage\nAlice\t30\nBob\t25";
    const result = convertTsvToCsv(input, opts);
    expect(result.output).toBe("name,age\nAlice,30\nBob,25");
    expect(result.stats.rowCount).toBe(2);
    expect(result.stats.columnCount).toBe(2);
  });

  it("quotes fields containing comma", () => {
    const input = "name\tnote\nAlice\thello, world";
    const result = convertTsvToCsv(input, opts);
    expect(result.output).toContain('"hello, world"');
  });

  it("quotes fields containing quotes (input uses escaped quotes)", () => {
    const input = 'name\tnote\nAlice\t"say ""hi"""';
    const result = convertTsvToCsv(input, opts);
    expect(result.output).toContain('"say ""hi"""');
  });

  it("quotes fields containing newline (input is quoted with embedded newline)", () => {
    const input = 'name\tnote\nAlice\t"line1\nline2"';
    const result = convertTsvToCsv(input, opts);
    // The embedded newline should be inside quotes in the CSV output
    expect(result.output).toContain('"line1\nline2"');
  });

  it("trims whitespace when option set", () => {
    const input = "name\tage\n Alice \t 30 ";
    const result = convertTsvToCsv(input, { ...opts, trimWhitespace: true });
    expect(result.output).toBe("name,age\nAlice,30");
  });

  it("removes empty rows when option set", () => {
    const input = "name\tage\nAlice\t30\n\t\nBob\t25";
    const result = convertTsvToCsv(input, { ...opts, removeEmptyRows: true });
    expect(result.stats.rowCount).toBe(2);
  });

  it("skips header when option set", () => {
    const input = "name\tage\nAlice\t30";
    const result = convertTsvToCsv(input, { ...opts, skipHeader: true });
    expect(result.output).toBe("Alice,30");
  });

  it("supports custom output delimiter", () => {
    const input = "name\tage\nAlice\t30";
    const result = convertTsvToCsv(input, { ...opts, outputDelimiter: ";" });
    expect(result.output).toBe("name;age\nAlice;30");
  });

  it("computes stats correctly", () => {
    const input = "a\tb\n1\t2\n3\t4";
    const result = convertTsvToCsv(input, opts);
    expect(result.stats.rowCount).toBe(2);
    expect(result.stats.columnCount).toBe(2);
    expect(result.stats.inputBytes).toBe(input.length);
    expect(result.stats.outputBytes).toBe(result.output.length);
  });
});

describe("tsv2csv formatBytes + stripExtension + deriveOutputFilename", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("strips extension", () => {
    expect(stripExtension("file.tsv")).toBe("file");
    expect(stripExtension("file")).toBe("file");
  });
  it("derives output filename", () => {
    expect(deriveOutputFilename("data.tsv", "csv")).toBe("data.csv");
    expect(deriveOutputFilename("data", "csv")).toBe("data.csv");
  });
});

describe("tsv2csv history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileName: "a.tsv", inputDelimiter: "\t", outputDelimiter: ",", rowCount: 10, convertedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileName: "a.tsv", inputDelimiter: "\t", outputDelimiter: ",", rowCount: 10, convertedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tsv2csv buildShareUrl", () => {
  it("builds share URL with params", () => {
    (globalThis as any).window = { location: { origin: "https://x.io", pathname: "/tools/tsv-to-csv" } };
    const url = buildShareUrl({
      inputDelimiter: "\t", outputDelimiter: ",",
      trimWhitespace: true, removeEmptyRows: false, skipHeader: false,
    });
    expect(url).toContain("#in=%5Ct"); // \t encoded
    expect(url).toContain("out=%2C"); // , encoded
    expect(url).toContain("trim=true");
    delete (globalThis as any).window;
  });
});
