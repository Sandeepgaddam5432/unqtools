import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  DELIMITER_OPTIONS,
  INSERT_MODES,
  DEFAULT_OPTIONS,
  TYPE_LABELS,
  SAMPLE_CSV,
  parseCsv,
  detectDelimiter,
  isIntegerLike,
  isDecimalLike,
  isBooleanLike,
  isDateLike,
  inferColumnType,
  inferColumnTypes,
  isNullValue,
  escapeString,
  quoteIdentifier,
  formatValue,
  ddlType,
  generateCreateTable,
  columnList,
  valuesTuple,
  generateInserts,
  convertCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ConvertOptions,
  type SqlDialect,
  type InsertMode,
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

// ---- constants -----------------------------------------------------------

describe("csv-to-sql constants", () => {
  it("exposes 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["ansi", "mysql", "postgresql", "sqlite", "sqlserver"]),
    );
  });
  it("exposes 5 delimiter options", () => {
    expect(DELIMITER_OPTIONS).toHaveLength(5);
  });
  it("exposes 3 insert modes", () => {
    expect(INSERT_MODES).toHaveLength(3);
  });
  it("DEFAULT_OPTIONS has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.dialect).toBe("ansi");
    expect(DEFAULT_OPTIONS.tableName).toBe("my_table");
    expect(DEFAULT_OPTIONS.hasHeader).toBe(true);
    expect(DEFAULT_OPTIONS.mode).toBe("batched");
    expect(DEFAULT_OPTIONS.batchSize).toBe(100);
    expect(DEFAULT_OPTIONS.emptyAsNull).toBe(true);
    expect(DEFAULT_OPTIONS.includeCreateTable).toBe(true);
  });
  it("TYPE_LABELS covers every type", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(5);
    expect(TYPE_LABELS.integer).toBe("INTEGER");
  });
  it("SAMPLE_CSV is non-empty", () => {
    expect(SAMPLE_CSV.length).toBeGreaterThan(50);
    expect(SAMPLE_CSV.split("\n").length).toBeGreaterThan(3);
  });
});

// ---- CSV parser (RFC 4180) -----------------------------------------------

describe("csv-to-sql parseCsv", () => {
  it("parses a simple comma-separated row", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });
  it("parses multiple rows", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('"a,b",c')).toEqual([["a,b", "c"]]);
  });
  it("handles doubled quotes inside quoted fields", () => {
    expect(parseCsv('"she said ""hi""",x')).toEqual([['she said "hi"', "x"]]);
  });
  it("handles embedded newlines inside quoted fields", () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([["line1\nline2", "x"]]);
  });
  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("handles lone CR line endings", () => {
    expect(parseCsv("a,b\rc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("strips a leading BOM", () => {
    expect(parseCsv("\uFEFFa,b")).toEqual([["a", "b"]]);
  });
  it("respects custom delimiter", () => {
    expect(parseCsv("a;b;c", ";")).toEqual([["a", "b", "c"]]);
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

// ---- delimiter detection -------------------------------------------------

describe("csv-to-sql detectDelimiter", () => {
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c\nd,e,f")).toBe(",");
  });
  it("detects semicolon", () => {
    expect(detectDelimiter("a;b;c\nd;e;f")).toBe(";");
  });
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc\nd\te\tf")).toBe("\t");
  });
  it("detects pipe", () => {
    expect(detectDelimiter("a|b|c\nd|e|f")).toBe("|");
  });
  it("does not count commas inside quoted fields", () => {
    expect(detectDelimiter('"a,b",c;d,e;f')).toBe(",");
  });
});

// ---- type inference ------------------------------------------------------

describe("csv-to-sql type inference", () => {
  it("isIntegerLike matches plain integers", () => {
    expect(isIntegerLike("42")).toBe(true);
    expect(isIntegerLike("-7")).toBe(true);
    expect(isIntegerLike("0")).toBe(true);
  });
  it("isIntegerLike rejects leading zeros", () => {
    expect(isIntegerLike("007")).toBe(false);
    expect(isIntegerLike("-007")).toBe(false);
  });
  it("isIntegerLike rejects decimals and text", () => {
    expect(isIntegerLike("1.5")).toBe(false);
    expect(isIntegerLike("abc")).toBe(false);
  });
  it("isDecimalLike matches decimals", () => {
    expect(isDecimalLike("1.5")).toBe(true);
    expect(isDecimalLike("-0.5")).toBe(true);
  });
  it("isBooleanLike matches true/false (case-insensitive)", () => {
    expect(isBooleanLike("true")).toBe(true);
    expect(isBooleanLike("FALSE")).toBe(true);
    expect(isBooleanLike("yes")).toBe(false);
  });
  it("isDateLike matches YYYY-MM-DD and ISO datetimes", () => {
    expect(isDateLike("2024-01-15")).toBe(true);
    expect(isDateLike("2024-01-15T10:30:00")).toBe(true);
    expect(isDateLike("01/15/2024")).toBe(false);
  });
  it("inferColumnType detects integer", () => {
    expect(inferColumnType(["1", "2", "3"])).toBe("integer");
  });
  it("inferColumnType detects decimal when mixed with int", () => {
    expect(inferColumnType(["1", "2.5", "3"])).toBe("decimal");
  });
  it("inferColumnType detects boolean", () => {
    expect(inferColumnType(["true", "false", "true"])).toBe("boolean");
  });
  it("inferColumnType detects date", () => {
    expect(inferColumnType(["2024-01-01", "2024-02-02"])).toBe("date");
  });
  it("inferColumnType falls back to text", () => {
    expect(inferColumnType(["hello", "world"])).toBe("text");
  });
  it("inferColumnType skips NULL values", () => {
    expect(inferColumnType(["1", "NULL", "3", ""])).toBe("integer");
  });
  it("inferColumnTypes infers per-column types", () => {
    const rows = [
      ["id", "name", "active"],
      ["1", "Alice", "true"],
      ["2", "Bob", "false"],
    ];
    const types = inferColumnTypes(rows, true, "NULL", true);
    expect(types).toEqual(["integer", "text", "boolean"]);
  });
});

// ---- NULL handling -------------------------------------------------------

describe("csv-to-sql null handling", () => {
  it("isNullValue treats empty string as NULL when emptyAsNull", () => {
    expect(isNullValue("", "NULL", true)).toBe(true);
    expect(isNullValue("", "NULL", false)).toBe(false);
  });
  it("isNullValue treats nullToken case-insensitively", () => {
    expect(isNullValue("null", "NULL", true)).toBe(true);
    expect(isNullValue("\\N", "\\N", true)).toBe(true);
    expect(isNullValue("hello", "NULL", true)).toBe(false);
  });
});

// ---- escaping ------------------------------------------------------------

describe("csv-to-sql escapeString", () => {
  it("ANSI: doubles single quotes", () => {
    expect(escapeString("o'Brien", "ansi")).toBe("'o''Brien'");
  });
  it("MySQL: backslash-escapes single quotes and backslashes", () => {
    expect(escapeString("o'Brien", "mysql")).toBe("'o\\'Brien'");
    expect(escapeString("a\\b", "mysql")).toBe("'a\\\\b'");
  });
  it("PostgreSQL: doubles single quotes", () => {
    expect(escapeString("o'Brien", "postgresql")).toBe("'o''Brien'");
  });
  it("SQLite: doubles single quotes", () => {
    expect(escapeString("o'Brien", "sqlite")).toBe("'o''Brien'");
  });
  it("SQL Server: doubles single quotes", () => {
    expect(escapeString("o'Brien", "sqlserver")).toBe("'o''Brien'");
  });
});

// ---- identifier quoting --------------------------------------------------

describe("csv-to-sql quoteIdentifier", () => {
  it("returns name unchanged when quote is false", () => {
    expect(quoteIdentifier("users", "ansi", false)).toBe("users");
  });
  it("MySQL uses backticks", () => {
    expect(quoteIdentifier("order", "mysql", true)).toBe("`order`");
  });
  it("PostgreSQL uses double quotes", () => {
    expect(quoteIdentifier("order", "postgresql", true)).toBe('"order"');
  });
  it("SQLite uses double quotes", () => {
    expect(quoteIdentifier("order", "sqlite", true)).toBe('"order"');
  });
  it("SQL Server uses brackets", () => {
    expect(quoteIdentifier("order", "sqlserver", true)).toBe("[order]");
  });
  it("Escapes embedded quote chars", () => {
    expect(quoteIdentifier('a"b', "postgresql", true)).toBe('"a""b"');
    expect(quoteIdentifier("a]b", "sqlserver", true)).toBe("[a]]b]");
  });
});

// ---- formatValue ---------------------------------------------------------

describe("csv-to-sql formatValue", () => {
  const opts = { ...DEFAULT_OPTIONS };
  it("returns NULL for null-like values", () => {
    expect(formatValue("", "text", "ansi", opts)).toBe("NULL");
    expect(formatValue("NULL", "text", "ansi", opts)).toBe("NULL");
  });
  it("emits integer unquoted", () => {
    expect(formatValue("42", "integer", "ansi", opts)).toBe("42");
    expect(formatValue("-7", "integer", "ansi", opts)).toBe("-7");
  });
  it("emits decimal unquoted", () => {
    expect(formatValue("1.5", "decimal", "ansi", opts)).toBe("1.5");
  });
  it("emits boolean TRUE/FALSE for ANSI dialects", () => {
    expect(formatValue("true", "boolean", "ansi", opts)).toBe("TRUE");
    expect(formatValue("false", "boolean", "postgresql", opts)).toBe("FALSE");
  });
  it("emits boolean 0/1 for SQL Server", () => {
    expect(formatValue("true", "boolean", "sqlserver", opts)).toBe("1");
    expect(formatValue("false", "boolean", "sqlserver", opts)).toBe("0");
  });
  it("emits date as quoted string", () => {
    expect(formatValue("2024-01-15", "date", "ansi", opts)).toBe("'2024-01-15'");
  });
  it("emits text as escaped string", () => {
    expect(formatValue("hello", "text", "ansi", opts)).toBe("'hello'");
    expect(formatValue("o'Brien", "text", "ansi", opts)).toBe("'o''Brien'");
  });
});

// ---- ddlType -------------------------------------------------------------

describe("csv-to-sql ddlType", () => {
  it("maps integer to BIGINT", () => {
    expect(ddlType("integer", "ansi")).toBe("BIGINT");
  });
  it("maps decimal to DECIMAL(18,6)", () => {
    expect(ddlType("decimal", "ansi")).toBe("DECIMAL(18,6)");
  });
  it("maps boolean to BOOLEAN for ANSI / BIT for T-SQL", () => {
    expect(ddlType("boolean", "ansi")).toBe("BOOLEAN");
    expect(ddlType("boolean", "sqlserver")).toBe("BIT");
  });
  it("maps date to TEXT (we can't infer TIME precision)", () => {
    expect(ddlType("date", "ansi")).toBe("TEXT");
  });
});

// ---- generateCreateTable / columnList / valuesTuple ---------------------

describe("csv-to-sql generateCreateTable", () => {
  it("emits CREATE TABLE with typed columns", () => {
    const sql = generateCreateTable(
      "users",
      ["id", "name", "active"],
      ["integer", "text", "boolean"],
      "ansi",
      { ...DEFAULT_OPTIONS, quoteIdentifiers: false },
    );
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("id BIGINT");
    expect(sql).toContain("name TEXT");
    expect(sql).toContain("active BOOLEAN");
  });
  it("quotes identifiers when enabled", () => {
    const sql = generateCreateTable(
      "users",
      ["order"],
      ["text"],
      "postgresql",
      { ...DEFAULT_OPTIONS, quoteIdentifiers: true },
    );
    expect(sql).toContain('"users"');
    expect(sql).toContain('"order"');
  });
});

describe("csv-to-sql columnList & valuesTuple", () => {
  it("columnList quotes per opts", () => {
    const opts = { ...DEFAULT_OPTIONS, quoteIdentifiers: true };
    expect(columnList(["a", "b"], "mysql", opts)).toBe("(`a`, `b`)");
    expect(columnList(["a", "b"], "ansi", opts)).toBe('("a", "b")');
    expect(columnList(["a", "b"], "ansi", { ...opts, quoteIdentifiers: false })).toBe("(a, b)");
  });
  it("valuesTuple formats per type", () => {
    const opts = { ...DEFAULT_OPTIONS };
    const t = valuesTuple(["1", "Alice", "true"], ["integer", "text", "boolean"], "ansi", opts);
    expect(t).toBe("(1, 'Alice', TRUE)");
  });
  it("valuesTuple emits NULL for null values", () => {
    const opts = { ...DEFAULT_OPTIONS };
    const t = valuesTuple(["1", ""], ["integer", "text"], "ansi", opts);
    expect(t).toBe("(1, NULL)");
  });
});

// ---- generateInserts -----------------------------------------------------

describe("csv-to-sql generateInserts", () => {
  const headers = ["id", "name"];
  const types = ["integer", "text"] as const;
  const rows = [
    ["1", "Alice"],
    ["2", "Bob"],
    ["3", "Carol"],
  ];

  it("single mode: one INSERT per row", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "single" });
    expect(r.insertCount).toBe(3);
    expect(r.sql.match(/INSERT INTO/g)?.length).toBe(3);
    expect(r.sql).toContain("(1, 'Alice')");
  });
  it("batched mode: collapses rows into one INSERT when batchSize is large", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "batched", batchSize: 100 });
    expect(r.insertCount).toBe(1);
    expect(r.sql.match(/INSERT INTO/g)?.length).toBe(1);
    expect(r.sql).toContain("(1, 'Alice')");
    expect(r.sql).toContain("(3, 'Carol')");
  });
  it("batched mode: splits into multiple INSERTs when batchSize is small", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "batched", batchSize: 2 });
    expect(r.insertCount).toBe(2);
    expect(r.sql.match(/INSERT INTO/g)?.length).toBe(2);
  });
  it("upsert mode: MySQL emits ON DUPLICATE KEY UPDATE", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "upsert", dialect: "mysql", conflictColumn: "id" });
    expect(r.sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(r.sql).toContain("name=VALUES(name)");
  });
  it("upsert mode: PostgreSQL emits ON CONFLICT", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "upsert", dialect: "postgresql", conflictColumn: "id" });
    expect(r.sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(r.sql).toContain("name=EXCLUDED.name");
  });
  it("upsert mode: SQLite emits ON CONFLICT", () => {
    const r = generateInserts(rows, headers, [...types], { ...DEFAULT_OPTIONS, mode: "upsert", dialect: "sqlite", conflictColumn: "id" });
    expect(r.sql).toContain("ON CONFLICT (id) DO UPDATE SET");
  });
  it("upsert mode: SQL Server emits MERGE INTO", () => {
    const r = generateInserts([["1", "Alice"]], headers, [...types], { ...DEFAULT_OPTIONS, mode: "upsert", dialect: "sqlserver", conflictColumn: "id" });
    expect(r.sql).toContain("MERGE INTO");
    expect(r.sql).toContain("WHEN MATCHED THEN UPDATE");
    expect(r.sql).toContain("WHEN NOT MATCHED THEN INSERT");
  });
  it("counts NULLs", () => {
    const r = generateInserts([["1", ""], ["2", "Bob"]], headers, [...types], { ...DEFAULT_OPTIONS, mode: "single" });
    expect(r.nullCount).toBe(1);
  });
});

// ---- convertCsv (end-to-end) --------------------------------------------

describe("csv-to-sql convertCsv", () => {
  it("returns error for empty input", () => {
    const r = convertCsv("", DEFAULT_OPTIONS);
    expect(r.ok).toBe(false);
  });
  it("returns error for null input", () => {
    const r = convertCsv(null as unknown as string, DEFAULT_OPTIONS);
    expect(r.ok).toBe(false);
  });
  it("parses sample CSV and infers types", () => {
    const r = convertCsv(SAMPLE_CSV, { ...DEFAULT_OPTIONS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headers).toEqual(["id", "name", "email", "age", "is_active", "created_at", "balance"]);
    expect(r.types).toEqual(["integer", "text", "text", "integer", "boolean", "date", "decimal"]);
    expect(r.stats.rowCount).toBe(5);
    expect(r.stats.columnCount).toBe(7);
  });
  it("includes CREATE TABLE when enabled", () => {
    const r = convertCsv(SAMPLE_CSV, { ...DEFAULT_OPTIONS, includeCreateTable: true });
    if (!r.ok) return;
    expect(r.sql).toContain("CREATE TABLE my_table");
  });
  it("omits CREATE TABLE when disabled", () => {
    const r = convertCsv(SAMPLE_CSV, { ...DEFAULT_OPTIONS, includeCreateTable: false });
    if (!r.ok) return;
    expect(r.sql).not.toContain("CREATE TABLE");
  });
  it("respects custom table name", () => {
    const r = convertCsv(SAMPLE_CSV, { ...DEFAULT_OPTIONS, tableName: "customers" });
    if (!r.ok) return;
    expect(r.sql).toContain("INSERT INTO customers");
  });
  it("handles CSV without header row", () => {
    const r = convertCsv("1,Alice\n2,Bob", { ...DEFAULT_OPTIONS, hasHeader: false });
    if (!r.ok) return;
    expect(r.headers).toEqual(["col1", "col2"]);
    expect(r.stats.rowCount).toBe(2);
  });
  it("handles embedded quotes and commas", () => {
    const csv = 'id,name\n1,"Eve ""Eva"" Martinez"\n2,"a,b"';
    const r = convertCsv(csv, { ...DEFAULT_OPTIONS });
    if (!r.ok) return;
    expect(r.stats.rowCount).toBe(2);
    // Doubled-quoted "Eva" inside a quoted field becomes a single literal "
    expect(r.sql).toContain('Eve "Eva" Martinez');
    expect(r.sql).toContain("'a,b'");
  });
  it("auto-detects semicolon delimiter", () => {
    const csv = "id;name\n1;Alice\n2;Bob";
    const r = convertCsv(csv, { ...DEFAULT_OPTIONS });
    if (!r.ok) return;
    expect(r.headers).toEqual(["id", "name"]);
    expect(r.stats.rowCount).toBe(2);
  });
  it("respects custom nullToken", () => {
    const csv = "id,name\n1,\\N\n2,Bob";
    const r = convertCsv(csv, { ...DEFAULT_OPTIONS, nullToken: "\\N" });
    if (!r.ok) return;
    expect(r.sql).toContain("(1, NULL)");
  });
  it("emptyAsNull=false keeps empty strings quoted", () => {
    const csv = "id,name\n1,\n2,Bob";
    const r = convertCsv(csv, { ...DEFAULT_OPTIONS, emptyAsNull: false });
    if (!r.ok) return;
    expect(r.sql).toContain("(1, '')");
  });
  it("quotes identifiers when enabled", () => {
    const r = convertCsv(SAMPLE_CSV, { ...DEFAULT_OPTIONS, quoteIdentifiers: true, dialect: "mysql" });
    if (!r.ok) return;
    expect(r.sql).toContain("`my_table`");
    expect(r.sql).toContain("`id`");
  });
});

// ---- history -------------------------------------------------------------

describe("csv-to-sql history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dialect: "mysql", mode: "batched", tableName: "t",
      rowCount: 5, columnCount: 3, insertCount: 1, nullCount: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dialect: "ansi", mode: "single", tableName: "t",
        rowCount: 1, columnCount: 1, insertCount: 1, nullCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dialect: "ansi", mode: "single", tableName: "t",
      rowCount: 1, columnCount: 1, insertCount: 1, nullCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- shareable URL -------------------------------------------------------

describe("csv-to-sql shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, dialect: "mysql", tableName: "users", mode: "upsert" });
    expect(url).toContain("d=mysql");
    expect(url).toContain("t=users");
    expect(url).toContain("m=upsert");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=postgresql&t=products&h=0&bs=50&m=upsert&null=%5CN&en=0&ct=0&qi=1&cc=id");
    expect(p.dialect).toBe("postgresql");
    expect(p.tableName).toBe("products");
    expect(p.hasHeader).toBe(false);
    expect(p.batchSize).toBe(50);
    expect(p.mode).toBe("upsert");
    expect(p.nullToken).toBe("\\N");
    expect(p.emptyAsNull).toBe(false);
    expect(p.includeCreateTable).toBe(false);
    expect(p.quoteIdentifiers).toBe(true);
    expect(p.conflictColumn).toBe("id");
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p).toEqual(DEFAULT_OPTIONS);
  });
});

// ---- unused-type export suppression --------------------------------------

export type _Unused = SqlDialect | InsertMode | ConvertOptions;
