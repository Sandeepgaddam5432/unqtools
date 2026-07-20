import { describe, it, expect, beforeEach } from "vitest";
import {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  DEFAULT_PARSE,
  DEFAULT_EXPORT,
  detectInputFormat,
  parseGrid,
  parseWhitespaceGrid,
  parseMarkdownTable,
  parseInsertStatements,
  parseInput,
  inferColumnType,
  coerceValue,
  transformColumns,
  toCsv,
  toTsv,
  toJson,
  toNdjson,
  toMarkdown,
  toHtml,
  convert,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type InputFormat,
  type OutputFormat,
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

describe("sql-result-exporter constants", () => {
  it("exposes 7 input formats", () => {
    expect(INPUT_FORMATS).toHaveLength(7);
    expect(INPUT_FORMATS).toContain("auto");
    expect(INPUT_FORMATS).toContain("insert");
    expect(INPUT_FORMATS).toContain("markdown");
  });
  it("exposes 6 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(6);
    expect(OUTPUT_FORMATS).toContain("csv");
    expect(OUTPUT_FORMATS).toContain("json");
    expect(OUTPUT_FORMATS).toContain("ndjson");
    expect(OUTPUT_FORMATS).toContain("html");
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_PARSE.format).toBe("auto");
    expect(DEFAULT_PARSE.hasHeader).toBe(true);
    expect(DEFAULT_PARSE.nullToken).toBe("NULL");
    expect(DEFAULT_EXPORT.format).toBe("csv");
    expect(DEFAULT_EXPORT.delimiter).toBe(",");
    expect(DEFAULT_EXPORT.quoting).toBe("auto");
  });
});

describe("sql-result-exporter detectInputFormat", () => {
  it("detects INSERT statements", () => {
    expect(detectInputFormat("INSERT INTO users (id, name) VALUES (1, 'a');")).toBe("insert");
  });
  it("detects Markdown tables", () => {
    const md = "| id | name |\n| --- | --- |\n| 1 | a |";
    expect(detectInputFormat(md)).toBe("markdown");
  });
  it("detects tab-separated grids", () => {
    expect(detectInputFormat("id\tname\n1\ta\n2\tb")).toBe("grid-tab");
  });
  it("detects pipe-separated grids", () => {
    expect(detectInputFormat("| id | name |\n| 1 | a |\n| 2 | b |")).toBe("grid-pipe");
  });
  it("defaults to grid-tab on empty input", () => {
    expect(detectInputFormat("")).toBe("grid-tab");
  });
});

describe("sql-result-exporter parseGrid", () => {
  it("parses tab-separated grid with header", () => {
    const text = "id\tname\tactive\n1\tAlice\ttrue\n2\tBob\tfalse";
    const r = parseGrid(text, "\t");
    expect(r.columns.map((c) => c.name)).toEqual(["id", "name", "active"]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual(["1", "Alice", "true"]);
  });
  it("parses pipe-separated grid", () => {
    const text = "| id | name |\n| 1 | Alice |\n| 2 | Bob |";
    const r = parseGrid(text, "|");
    expect(r.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(r.rows[0]).toEqual(["1", "Alice"]);
  });
  it("parses comma-separated grid with quotes", () => {
    // RFC 4180 uses doubled quotes inside a quoted field to escape them.
    const text = 'id,name,note\n1,"Alice, Jr.",hello\n2,Bob,"say ""hi"""';
    const r = parseGrid(text, ",");
    expect(r.rows[0]).toEqual(["1", "Alice, Jr.", "hello"]);
    expect(r.rows[1][2]).toBe('say "hi"');
  });
  it("warns on mismatched column count", () => {
    const text = "a\tb\n1\t2\t3";
    const r = parseGrid(text, "\t");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("auto-generates headers when hasHeader=false", () => {
    const r = parseGrid("1\ta\n2\tb", "\t", { ...DEFAULT_PARSE, hasHeader: false });
    expect(r.columns[0].name).toBe("col_1");
    expect(r.columns[1].name).toBe("col_2");
    expect(r.rows).toHaveLength(2);
  });
});

describe("sql-result-exporter parseWhitespaceGrid", () => {
  it("parses whitespace-aligned columns", () => {
    const text = "id  name       active\n1   Alice      true\n2   Bob        false";
    const r = parseWhitespaceGrid(text);
    expect(r.columns.map((c) => c.name)).toEqual(["id", "name", "active"]);
    expect(r.rows[0]).toEqual(["1", "Alice", "true"]);
  });
});

describe("sql-result-exporter parseMarkdownTable", () => {
  it("parses a standard markdown table", () => {
    const md = "| id | name |\n| --- | --- |\n| 1 | Alice |\n| 2 | Bob |";
    const r = parseMarkdownTable(md);
    expect(r.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual(["1", "Alice"]);
  });
  it("returns warning on invalid markdown", () => {
    const r = parseMarkdownTable("not a table");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("sql-result-exporter parseInsertStatements", () => {
  it("parses single-row INSERT", () => {
    const sql = "INSERT INTO users (id, name, active) VALUES (1, 'Alice', true);";
    const r = parseInsertStatements(sql);
    expect(r.columns.map((c) => c.name)).toEqual(["id", "name", "active"]);
    expect(r.rows[0]).toEqual(["1", "'Alice'", "true"]);
  });
  it("parses multi-row INSERT", () => {
    const sql = "INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Carol');";
    const r = parseInsertStatements(sql);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[1]).toEqual(["2", "'Bob'"]);
  });
  it("parses multiple INSERT statements", () => {
    const sql = "INSERT INTO users (id, name) VALUES (1, 'Alice');\nINSERT INTO users (id, name) VALUES (2, 'Bob');";
    const r = parseInsertStatements(sql);
    expect(r.rows).toHaveLength(2);
  });
  it("handles escaped quotes in strings", () => {
    const sql = "INSERT INTO t (a) VALUES ('O''Brien');";
    const r = parseInsertStatements(sql);
    expect(r.rows[0][0]).toBe("'O''Brien'");
  });
  it("returns warning when no INSERTs found", () => {
    const r = parseInsertStatements("SELECT * FROM users");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.rows).toHaveLength(0);
  });
});

describe("sql-result-exporter parseInput (dispatcher)", () => {
  it("auto-detects and parses INSERT", () => {
    const sql = "INSERT INTO t (id, n) VALUES (1, 'a'), (2, 'b');";
    const r = parseInput(sql, DEFAULT_PARSE);
    expect(r.format).toBe("insert");
    expect(r.rows).toHaveLength(2);
  });
  it("auto-detects and parses markdown", () => {
    const md = "| id | n |\n| --- | --- |\n| 1 | a |";
    const r = parseInput(md, DEFAULT_PARSE);
    expect(r.format).toBe("markdown");
    expect(r.rows).toHaveLength(1);
  });
  it("auto-detects and parses tab-grid", () => {
    const r = parseInput("id\tn\n1\ta", DEFAULT_PARSE);
    expect(r.format).toBe("grid-tab");
  });
  it("infers types after parse", () => {
    const sql = "INSERT INTO t (id, price, active, name) VALUES (1, 9.99, true, 'a'), (2, 10.00, false, 'b');";
    const r = parseInput(sql, DEFAULT_PARSE);
    const types = r.columns.map((c) => c.type);
    expect(types).toEqual(["integer", "decimal", "boolean", "text"]);
  });
});

describe("sql-result-exporter inferColumnType", () => {
  it("infers integer", () => {
    expect(inferColumnType(["1", "2", "3"])).toBe("integer");
  });
  it("infers decimal", () => {
    expect(inferColumnType(["1.5", "2.25", "3"])).toBe("decimal");
  });
  it("infers boolean", () => {
    expect(inferColumnType(["true", "false", "true"])).toBe("boolean");
  });
  it("infers date", () => {
    expect(inferColumnType(["2024-01-15", "2024-02-20", "2024-03-30"])).toBe("date");
  });
  it("infers text for mixed", () => {
    expect(inferColumnType(["abc", "123", "true"])).toBe("text");
  });
  it("skips NULLs during inference", () => {
    expect(inferColumnType(["1", "NULL", "3"])).toBe("integer");
  });
  it("returns text for empty/all-NULL", () => {
    expect(inferColumnType(["", "NULL"])).toBe("text");
  });
});

describe("sql-result-exporter coerceValue", () => {
  it("coerces integer", () => {
    expect(coerceValue("42", "integer", DEFAULT_PARSE)).toBe(42);
  });
  it("preserves BigInt-safe as string", () => {
    const big = "9007199254740993"; // 2^53 + 1
    expect(coerceValue(big, "integer", DEFAULT_PARSE)).toBe(big);
  });
  it("coerces boolean", () => {
    expect(coerceValue("true", "boolean", DEFAULT_PARSE)).toBe(true);
    expect(coerceValue("false", "boolean", DEFAULT_PARSE)).toBe(false);
  });
  it("returns null for NULL token", () => {
    expect(coerceValue("NULL", "integer", DEFAULT_PARSE)).toBeNull();
  });
  it("returns null for empty when emptyAsNull=true", () => {
    expect(coerceValue("", "text", DEFAULT_PARSE)).toBeNull();
  });
  it("returns empty string when emptyAsNull=false", () => {
    expect(coerceValue("", "text", { ...DEFAULT_PARSE, emptyAsNull: false })).toBe("");
  });
  it("coerces decimal", () => {
    expect(coerceValue("3.14", "decimal", DEFAULT_PARSE)).toBeCloseTo(3.14);
  });
});

describe("sql-result-exporter transformColumns", () => {
  const sample = parseInput("INSERT INTO t (id, name, age) VALUES (1, 'a', 30), (2, 'b', 40);", DEFAULT_PARSE);

  it("selects columns", () => {
    const out = transformColumns(sample, { ...DEFAULT_EXPORT, columnSelect: ["name", "id"] });
    expect(out.columns.map((c) => c.name)).toEqual(["name", "id"]);
    expect(out.rows[0]).toEqual(["'a'", "1"]);
  });
  it("renames columns", () => {
    const out = transformColumns(sample, {
      ...DEFAULT_EXPORT,
      columnLabels: { id: "ID", name: "Full Name" },
    });
    expect(out.columns[0].label).toBe("ID");
    expect(out.columns[1].label).toBe("Full Name");
  });
  it("reorders columns", () => {
    const out = transformColumns(sample, { ...DEFAULT_EXPORT, columnOrder: ["age", "id", "name"] });
    expect(out.columns.map((c) => c.name)).toEqual(["age", "id", "name"]);
  });
});

describe("sql-result-exporter toCsv", () => {
  const sample = parseInput("INSERT INTO t (id, name) VALUES (1, 'a, b'), (2, 'c');", DEFAULT_PARSE);

  it("renders header + rows", () => {
    const csv = toCsv(sample, DEFAULT_EXPORT);
    expect(csv.split("\n")[0]).toBe("id,name");
    // The cell value is `'a, b'` (with single-quotes from the SQL literal) —
    // RFC 4180 quotes it because it contains a comma.
    expect(csv).toContain("'a, b'");
  });
  it("omits header when includeHeader=false", () => {
    const csv = toCsv(sample, { ...DEFAULT_EXPORT, includeHeader: false });
    expect(csv.split("\n")[0]).not.toBe("id,name");
  });
  it("respects delimiter override", () => {
    const csv = toCsv(sample, { ...DEFAULT_EXPORT, delimiter: ";" });
    expect(csv.split("\n")[0]).toBe("id;name");
  });
  it("always-quote mode wraps every field", () => {
    const csv = toCsv(sample, { ...DEFAULT_EXPORT, quoting: "always" });
    expect(csv.split("\n")[0]).toBe('"id","name"');
  });
  it("never quote mode does not escape commas", () => {
    const csv = toCsv(sample, { ...DEFAULT_EXPORT, quoting: "never" });
    expect(csv).toContain("a, b");
    expect(csv).not.toContain('"a, b"');
  });
});

describe("sql-result-exporter toTsv", () => {
  const sample = parseInput("INSERT INTO t (id, name) VALUES (1, 'a'), (2, NULL);", DEFAULT_PARSE);

  it("renders TSV with tab separator", () => {
    const tsv = toTsv(sample, DEFAULT_EXPORT);
    expect(tsv.split("\n")[0]).toBe("id\tname");
    expect(tsv.split("\n")[1]).toBe("1\t'a'");
  });
  it("uses configured NULL token", () => {
    const tsv = toTsv(sample, { ...DEFAULT_EXPORT, tsvNullToken: "\\N" });
    expect(tsv).toContain("\\N");
  });
});

describe("sql-result-exporter toJson", () => {
  const sample = parseInput(
    "INSERT INTO t (id, price, active, name) VALUES (1, 9.99, true, 'Alice'), (2, 10.00, false, 'Bob');",
    DEFAULT_PARSE,
  );

  it("renders typed JSON", () => {
    const json = toJson(sample, DEFAULT_EXPORT, DEFAULT_PARSE);
    const arr = JSON.parse(json);
    expect(arr).toHaveLength(2);
    expect(arr[0].id).toBe(1);
    expect(arr[0].price).toBeCloseTo(9.99);
    expect(arr[0].active).toBe(true);
    expect(arr[0].name).toBe("'Alice'");
  });
  it("preserves NULL as null in JSON", () => {
    const sql = "INSERT INTO t (id, name) VALUES (1, NULL);";
    const r = parseInput(sql, DEFAULT_PARSE);
    const json = toJson(r, DEFAULT_EXPORT, DEFAULT_PARSE);
    const arr = JSON.parse(json);
    expect(arr[0].name).toBeNull();
  });
  it("compact mode produces single-line array", () => {
    const json = toJson(sample, { ...DEFAULT_EXPORT, prettyJson: false }, DEFAULT_PARSE);
    expect(json).not.toContain("\n");
  });
});

describe("sql-result-exporter toNdjson", () => {
  it("renders one JSON object per line", () => {
    const sample = parseInput(
      "INSERT INTO t (id, name) VALUES (1, 'a'), (2, 'b');",
      DEFAULT_PARSE,
    );
    const out = toNdjson(sample, DEFAULT_PARSE);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe(1);
  });
});

describe("sql-result-exporter toMarkdown", () => {
  it("renders a markdown table", () => {
    const sample = parseInput(
      "INSERT INTO t (id, name) VALUES (1, 'a');",
      DEFAULT_PARSE,
    );
    const md = toMarkdown(sample);
    expect(md.split("\n")[0]).toBe("| id | name |");
    expect(md.split("\n")[1]).toBe("| --- | --- |");
    expect(md.split("\n")[2]).toBe("| 1 | 'a' |");
  });
  it("escapes pipes in cell values", () => {
    const sample = parseInput(
      "INSERT INTO t (note) VALUES ('a|b');",
      DEFAULT_PARSE,
    );
    expect(toMarkdown(sample)).toContain("a\\|b");
  });
});

describe("sql-result-exporter toHtml", () => {
  it("renders valid HTML table", () => {
    const sample = parseInput(
      "INSERT INTO t (id, name) VALUES (1, 'a');",
      DEFAULT_PARSE,
    );
    const html = toHtml(sample);
    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<th>id</th>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain("</table>");
  });
  it("escapes HTML entities", () => {
    const sample = parseInput(
      "INSERT INTO t (note) VALUES ('<script>');",
      DEFAULT_PARSE,
    );
    expect(toHtml(sample)).toContain("&lt;script&gt;");
  });
});

describe("sql-result-exporter convert (pipeline)", () => {
  it("runs the full pipeline to JSON", () => {
    const sql = "INSERT INTO t (id, name) VALUES (1, 'a'), (2, 'b');";
    const r = convert(sql, DEFAULT_PARSE, { ...DEFAULT_EXPORT, format: "json" });
    expect(r.stats.rowCount).toBe(2);
    expect(r.stats.columnCount).toBe(2);
    expect(r.stats.outputBytes).toBeGreaterThan(0);
    expect(JSON.parse(r.output)).toHaveLength(2);
  });
  it("counts NULLs in stats", () => {
    const sql = "INSERT INTO t (id, name) VALUES (1, NULL), (2, 'b');";
    const r = convert(sql, DEFAULT_PARSE, { ...DEFAULT_EXPORT, format: "csv" });
    expect(r.stats.nullCount).toBe(1);
  });
  it("reports per-column types in stats", () => {
    const sql = "INSERT INTO t (id, name) VALUES (1, 'a');";
    const r = convert(sql, DEFAULT_PARSE, { ...DEFAULT_EXPORT, format: "csv" });
    expect(r.stats.typesByColumn.id).toBe("integer");
    expect(r.stats.typesByColumn.name).toBe("text");
  });
});

describe("sql-result-exporter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, inputFormat: "insert", outputFormat: "csv", rowCount: 2, columnCount: 3, outputBytes: 100 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, inputFormat: "insert", outputFormat: "csv", rowCount: 1, columnCount: 1, outputBytes: 10 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, inputFormat: "insert", outputFormat: "csv", rowCount: 1, columnCount: 1, outputBytes: 10 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-result-exporter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(
      { ...DEFAULT_PARSE, format: "insert" },
      { ...DEFAULT_EXPORT, format: "json", delimiter: ";" },
    );
    expect(url).toContain("inFmt=insert");
    expect(url).toContain("outFmt=json");
    expect(url).toContain("delim=%3B");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { parseOpts, exportOpts } = parseShareUrl("inFmt=insert&outFmt=json&delim=%3B&quote=always&pretty=0&hdr=0");
    expect(parseOpts.format).toBe("insert");
    expect(parseOpts.hasHeader).toBe(false);
    expect(exportOpts.format).toBe("json");
    expect(exportOpts.delimiter).toBe(";");
    expect(exportOpts.quoting).toBe("always");
    expect(exportOpts.prettyJson).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ parseOpts: {}, exportOpts: {} });
  });
  it("filters unknown formats", () => {
    const { parseOpts, exportOpts } = parseShareUrl("inFmt=bogus&outFmt=bogus");
    expect(parseOpts.format).toBeUndefined();
    expect(exportOpts.format).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = InputFormat | OutputFormat;
