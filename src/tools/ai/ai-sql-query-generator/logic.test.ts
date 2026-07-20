import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_DIALECTS,
  DESTRUCTIVE_KEYWORDS,
  DIALECT_LABELS,
  HISTORY_KEY,
  HISTORY_MAX,
  IDENT_QUOTE,
  SAMPLE_QUESTIONS,
  SAMPLE_SCHEMA,
  normalizeType,
  parseCreateTable,
  parseColumnList,
  parseSchema,
  normalizeQuestion,
  detectIntent,
  findTables,
  findColumns,
  quoteIdent,
  extractLiterals,
  buildWhereClause,
  buildSelectQuery,
  isDestructive,
  validateSql,
  parameterize,
  convertDialect,
  explainSql,
  generateSql,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type Dialect,
  type HistoryEntry,
  type ParsedSchema,
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

// ---- shared sample schema for tests ----

function sampleSchema(): ParsedSchema {
  return parseSchema(SAMPLE_SCHEMA);
}

describe("sql-gen constants", () => {
  it("has 3 dialects", () => {
    expect(ALL_DIALECTS).toEqual(["sqlite", "postgres", "mysql"]);
  });
  it("has dialect labels", () => {
    expect(DIALECT_LABELS.sqlite).toBe("SQLite");
    expect(DIALECT_LABELS.postgres).toBe("PostgreSQL");
    expect(DIALECT_LABELS.mysql).toBe("MySQL");
  });
  it("has destructive keywords list", () => {
    expect(DESTRUCTIVE_KEYWORDS).toContain("INSERT");
    expect(DESTRUCTIVE_KEYWORDS).toContain("DROP");
    expect(DESTRUCTIVE_KEYWORDS).toContain("DELETE");
  });
  it("has identifier quotes per dialect", () => {
    expect(IDENT_QUOTE.sqlite).toBe('"');
    expect(IDENT_QUOTE.postgres).toBe('"');
    expect(IDENT_QUOTE.mysql).toBe("`");
  });
  it("has sample schema and questions", () => {
    expect(SAMPLE_SCHEMA).toContain("CREATE TABLE users");
    expect(SAMPLE_QUESTIONS.length).toBeGreaterThanOrEqual(3);
  });
  it("has 20 history max", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("uses stable history key", () => {
    expect(HISTORY_KEY).toContain("ai-sql-query-generator");
  });
});

describe("sql-gen normalizeType", () => {
  it("maps INTEGER and INT", () => {
    expect(normalizeType("INTEGER")).toBe("INTEGER");
    expect(normalizeType("INT")).toBe("INTEGER");
    expect(normalizeType("BIGINT")).toBe("BIGINT");
  });
  it("maps text types", () => {
    expect(normalizeType("TEXT")).toBe("TEXT");
    expect(normalizeType("VARCHAR(255)")).toBe("VARCHAR");
    expect(normalizeType("CHAR(2)")).toBe("TEXT");
  });
  it("maps decimal/numeric", () => {
    expect(normalizeType("DECIMAL(10,2)")).toBe("DECIMAL");
    expect(normalizeType("NUMERIC")).toBe("DECIMAL");
  });
  it("maps date/time", () => {
    expect(normalizeType("DATE")).toBe("DATE");
    expect(normalizeType("DATETIME")).toBe("DATETIME");
    expect(normalizeType("TIMESTAMP")).toBe("TIMESTAMP");
  });
  it("returns UNKNOWN for unrecognized", () => {
    expect(normalizeType("FOO")).toBe("UNKNOWN");
  });
});

describe("sql-gen parseCreateTable", () => {
  it("parses a simple CREATE TABLE", () => {
    const t = parseCreateTable("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    expect(t).not.toBeNull();
    expect(t!.name).toBe("users");
    expect(t!.columns).toHaveLength(2);
    expect(t!.columns[0].name).toBe("id");
    expect(t!.columns[0].primaryKey).toBe(true);
    expect(t!.columns[1].name).toBe("name");
    expect(t!.columns[1].nullable).toBe(false);
  });
  it("parses with IF NOT EXISTS", () => {
    const t = parseCreateTable("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, total DECIMAL(10,2))");
    expect(t!.name).toBe("orders");
  });
  it("skips table-level constraints", () => {
    const t = parseCreateTable("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, CONSTRAINT pk PRIMARY KEY (id))");
    expect(t!.columns).toHaveLength(2);
  });
  it("returns null for non-DDL", () => {
    expect(parseCreateTable("SELECT * FROM users")).toBeNull();
  });
  it("handles quoted table names", () => {
    const t = parseCreateTable('CREATE TABLE "my table" (id INTEGER PRIMARY KEY)');
    expect(t!.name).toBe("my table");
  });
});

describe("sql-gen parseColumnList", () => {
  it("parses table.column pairs", () => {
    const tables = parseColumnList("users.id, users.name, orders.total");
    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[1].name).toBe("orders");
  });
  it("handles newlines as separators", () => {
    const tables = parseColumnList("users.id\nusers.name");
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toHaveLength(2);
  });
  it("returns empty for non-matching input", () => {
    expect(parseColumnList("hello world")).toEqual([]);
  });
});

describe("sql-gen parseSchema", () => {
  it("parses multi-table DDL", () => {
    const s = parseSchema(SAMPLE_SCHEMA);
    expect(s.tables.length).toBeGreaterThanOrEqual(3);
    expect(s.tableNames).toContain("users");
    expect(s.tableNames).toContain("orders");
    expect(s.tableNames).toContain("products");
    expect(s.columnNames).toContain("name");
    expect(s.errors).toHaveLength(0);
  });
  it("falls back to column list", () => {
    const s = parseSchema("users.id, users.email, orders.total");
    expect(s.tables).toHaveLength(2);
  });
  it("records errors for malformed DDL", () => {
    const s = parseSchema("CREATE TABLE 123 INVALID ()");
    expect(s.errors.length).toBeGreaterThan(0);
  });
  it("records errors when no schema detected", () => {
    const s = parseSchema("just some random text with no schema");
    expect(s.errors.length).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    const s = parseSchema("");
    expect(s.tables).toEqual([]);
    expect(s.errors).toEqual([]);
  });
  it("detects column types correctly", () => {
    const s = parseSchema(SAMPLE_SCHEMA);
    const users = s.tables.find((t) => t.name === "users")!;
    const emailCol = users.columns.find((c) => c.name === "email");
    expect(emailCol?.type).toBe("TEXT");
    const orders = s.tables.find((t) => t.name === "orders")!;
    const totalCol = orders.columns.find((c) => c.name === "total");
    expect(totalCol?.type).toBe("DECIMAL");
  });
});

describe("sql-gen normalizeQuestion", () => {
  it("collapses whitespace", () => {
    expect(normalizeQuestion("How   many\nusers?")).toBe("How many users?");
  });
  it("handles empty", () => {
    expect(normalizeQuestion("")).toBe("");
  });
});

describe("sql-gen detectIntent", () => {
  it("detects count intent", () => {
    const i = detectIntent("Count the number of users");
    expect(i.count).toBe(true);
    expect(i.aggregate).toContain("COUNT");
  });
  it("detects average intent", () => {
    const i = detectIntent("What is the average order total");
    expect(i.aggregate).toContain("AVG");
  });
  it("detects sum intent", () => {
    const i = detectIntent("Sum of all order totals");
    expect(i.aggregate).toContain("SUM");
  });
  it("detects join intent", () => {
    const i = detectIntent("List users and their orders");
    expect(i.join).toBe(true);
    expect(i.joinType).toBe("INNER");
  });
  it("detects LEFT JOIN intent", () => {
    const i = detectIntent("Show all users and their orders with left join");
    expect(i.joinType).toBe("LEFT");
  });
  it("detects groupBy intent", () => {
    const i = detectIntent("Count users grouped by country");
    expect(i.groupBy).toBe(true);
  });
  it("detects orderBy DESC intent", () => {
    const i = detectIntent("List orders sorted by placed_at descending");
    expect(i.orderBy).toBe(true);
    expect(i.orderDirection).toBe("DESC");
  });
  it("detects orderBy ASC intent", () => {
    const i = detectIntent("List users alphabetically");
    expect(i.orderBy).toBe(true);
    expect(i.orderDirection).toBe("ASC");
  });
  it("detects limit (top N)", () => {
    const i = detectIntent("Show the top 10 users");
    expect(i.limit).toBe(10);
  });
  it("detects filter intent", () => {
    const i = detectIntent("Find users with status active");
    expect(i.filter).toBe(true);
  });
  it("detects distinct intent", () => {
    const i = detectIntent("Show unique countries");
    expect(i.distinct).toBe(true);
  });
});

describe("sql-gen findTables", () => {
  it("finds tables by name", () => {
    const s = sampleSchema();
    const t = findTables("List all users and their orders", s);
    const names = t.map((x) => x.table.name);
    expect(names).toContain("users");
    expect(names).toContain("orders");
  });
  it("matches plural/singular", () => {
    const s = sampleSchema();
    const t = findTables("Find a user by email", s);
    expect(t.some((x) => x.table.name === "users")).toBe(true);
  });
  it("matches snake_case as space-separated", () => {
    const s = parseSchema("CREATE TABLE order_items (id INTEGER PRIMARY KEY);");
    const t = findTables("List all order items", s);
    expect(t).toHaveLength(1);
  });
});

describe("sql-gen findColumns", () => {
  it("finds columns by name", () => {
    const s = sampleSchema();
    const c = findColumns("Show name and email for users", s);
    const names = c.map((x) => x.column.name);
    expect(names).toContain("name");
    expect(names).toContain("email");
  });
});

describe("sql-gen quoteIdent", () => {
  it("quotes MySQL identifiers with backticks", () => {
    expect(quoteIdent("order", "mysql")).toBe("`order`");
  });
  it("does not quote simple lowercase identifiers in SQLite", () => {
    expect(quoteIdent("users", "sqlite")).toBe("users");
  });
  it("quotes reserved-word identifiers in SQLite", () => {
    expect(quoteIdent("Order", "sqlite")).toBe('"Order"');
  });
});

describe("sql-gen extractLiterals", () => {
  it("extracts quoted strings", () => {
    const l = extractLiterals("List orders with status 'pending'");
    expect(l.some((x) => x.value === "pending" && x.kind === "string")).toBe(true);
  });
  it("extracts numbers after comparison operators", () => {
    const l = extractLiterals("Find products with price less than 50");
    expect(l.some((x) => x.value === "50" && x.kind === "number")).toBe(true);
  });
  it("extracts category literals", () => {
    const l = extractLiterals("Find products in the electronics category");
    expect(l.some((x) => x.value === "electronics")).toBe(true);
  });
});

describe("sql-gen buildWhereClause", () => {
  it("builds equality for string literals", () => {
    const s = sampleSchema();
    const cols = findColumns("orders with status 'pending'", s);
    const w = buildWhereClause("orders with status 'pending'", cols, "sqlite");
    expect(w).toContain("status = 'pending'");
  });
  it("builds numeric comparison", () => {
    const s = sampleSchema();
    const cols = findColumns("products with price less than 50", s);
    const w = buildWhereClause("products with price less than 50", cols, "sqlite");
    expect(w).toContain("price < 50");
  });
  it("returns null when no columns", () => {
    expect(buildWhereClause("hello", [], "sqlite")).toBeNull();
  });
});

describe("sql-gen buildSelectQuery", () => {
  it("builds a basic SELECT", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("List all users", s, "sqlite");
    expect(r.sql).toContain("SELECT");
    expect(r.sql).toContain("FROM users");
  });
  it("builds COUNT query", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("Count the number of users", s, "sqlite");
    expect(r.sql).toContain("COUNT(*)");
  });
  it("builds GROUP BY query", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("Count users grouped by country", s, "sqlite");
    expect(r.sql).toContain("GROUP BY");
    expect(r.sql).toContain("COUNT(*)");
  });
  it("builds JOIN query", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("List users and their orders", s, "sqlite");
    expect(r.sql).toContain("INNER JOIN orders");
  });
  it("builds ORDER BY DESC query", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("List orders ordered by placed_at descending", s, "sqlite");
    expect(r.sql).toContain("ORDER BY");
    expect(r.sql).toContain("DESC");
  });
  it("builds LIMIT query", () => {
    const s = sampleSchema();
    const r = buildSelectQuery("Show the top 10 users", s, "sqlite");
    expect(r.sql).toContain("LIMIT 10");
  });
  it("returns placeholder when no tables", () => {
    const s: ParsedSchema = { tables: [], tableNames: [], columnNames: [], errors: [] };
    const r = buildSelectQuery("List users", s, "sqlite");
    expect(r.sql).toContain("no tables");
  });
});

describe("sql-gen isDestructive", () => {
  it("flags INSERT", () => {
    expect(isDestructive("INSERT INTO users VALUES (1)")).toBe(true);
  });
  it("flags DROP", () => {
    expect(isDestructive("DROP TABLE users")).toBe(true);
  });
  it("does not flag SELECT", () => {
    expect(isDestructive("SELECT * FROM users")).toBe(false);
  });
  it("does not flag 'insert' inside string literal", () => {
    expect(isDestructive("SELECT 'INSERT INTO' FROM users")).toBe(false);
  });
});

describe("sql-gen validateSql", () => {
  it("validates a clean SELECT", () => {
    const v = validateSql("SELECT * FROM users;");
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("flags missing FROM (warning)", () => {
    const v = validateSql("SELECT 1");
    expect(v.warnings.some((w) => /FROM/i.test(w))).toBe(true);
  });
  it("flags unbalanced parens", () => {
    const v = validateSql("SELECT COUNT(* FROM users;");
    expect(v.ok).toBe(false);
  });
  it("flags destructive keywords", () => {
    const v = validateSql("DELETE FROM users;");
    expect(v.ok).toBe(false);
  });
  it("warns on missing semicolon", () => {
    const v = validateSql("SELECT * FROM users");
    expect(v.warnings.some((w) => /semicolon/i.test(w))).toBe(true);
  });
  it("flags empty SQL", () => {
    const v = validateSql("");
    expect(v.ok).toBe(false);
  });
  it("flags non-SELECT query", () => {
    const v = validateSql("WITH cte AS (SELECT 1) SELECT * FROM cte;");
    // WITH doesn't start with SELECT — should error
    expect(v.errors.some((e) => /SELECT/i.test(e))).toBe(true);
  });
});

describe("sql-gen parameterize", () => {
  it("parameterizes postgres with $1, $2", () => {
    const r = parameterize("SELECT * FROM users WHERE status = 'active' AND id > 5", "postgres");
    expect(r.sql).toContain("$1");
    expect(r.sql).toContain("$2");
    expect(r.parameters).toContain("active");
    expect(r.parameters).toContain("5");
  });
  it("parameterizes sqlite/mysql with ?", () => {
    const r = parameterize("SELECT * FROM users WHERE status = 'active'", "sqlite");
    expect(r.sql).toContain("?");
    expect(r.parameters).toEqual(["active"]);
  });
  it("handles no literals", () => {
    const r = parameterize("SELECT * FROM users", "postgres");
    expect(r.sql).toBe("SELECT * FROM users");
    expect(r.parameters).toEqual([]);
  });
});

describe("sql-gen convertDialect", () => {
  it("converts MySQL backticks to Postgres double-quotes", () => {
    const sql = "SELECT `name` FROM `users`";
    const out = convertDialect(sql, "mysql", "postgres");
    expect(out).toBe('SELECT "name" FROM "users"');
  });
  it("is a no-op when dialects match", () => {
    const sql = "SELECT * FROM users";
    expect(convertDialect(sql, "sqlite", "sqlite")).toBe(sql);
  });
});

describe("sql-gen explainSql", () => {
  it("produces a non-empty explanation", () => {
    const s = sampleSchema();
    const r = generateSql("Count the number of users grouped by country", s, "sqlite");
    expect(r.explanation.length).toBeGreaterThan(0);
    expect(r.explanation).toContain("Count");
  });
  it("mentions JOIN in explanation", () => {
    const s = sampleSchema();
    const r = generateSql("List users and their orders", s, "sqlite");
    expect(r.explanation.toLowerCase()).toContain("join");
  });
});

describe("sql-gen generateSql (full pipeline)", () => {
  it("produces a valid result with all fields", () => {
    const s = sampleSchema();
    const r = generateSql("List all users", s, "sqlite");
    expect(r.sql).toContain("SELECT");
    expect(r.dialect).toBe("sqlite");
    expect(r.validation).toBeDefined();
    expect(r.explanation).toBeTruthy();
    expect(r.generatedAt).toBeGreaterThan(0);
  });
  it("provides EXPLAIN hint per dialect", () => {
    const s = sampleSchema();
    const sqliteHint = generateSql("SELECT * FROM users", s, "sqlite").explainHint;
    const pgHint = generateSql("SELECT * FROM users", s, "postgres").explainHint;
    const mysqlHint = generateSql("SELECT * FROM users", s, "mysql").explainHint;
    expect(sqliteHint).toContain("EXPLAIN QUERY PLAN");
    expect(pgHint).toContain("EXPLAIN ANALYZE");
    expect(mysqlHint).toContain("EXPLAIN");
  });
  it("rejects destructive questions safely", () => {
    const s = sampleSchema();
    // The generator never emits destructive SQL, but isDestructive should be false.
    const r = generateSql("Delete all users", s, "sqlite");
    expect(r.destructive).toBe(false);
    expect(r.sql).toMatch(/^SELECT/i);
  });
});

describe("sql-gen renderText & renderMarkdown", () => {
  it("renderText contains question, SQL, and explanation", () => {
    const s = sampleSchema();
    const r = generateSql("List all users", s, "sqlite");
    const t = renderText(r);
    expect(t).toContain("Question:");
    expect(t).toContain("SQL:");
    expect(t).toContain("Explanation:");
  });
  it("renderMarkdown uses code fences", () => {
    const s = sampleSchema();
    const r = generateSql("List all users", s, "sqlite");
    const md = renderMarkdown(r);
    expect(md).toContain("```sql");
    expect(md).toContain("**Explanation:**");
  });
});

describe("sql-gen history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    const e: HistoryEntry = { ts: 1, question: "List users", dialect: "sqlite", sql: "SELECT * FROM users;", tableCount: 1 };
    saveHistory(e);
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, question: `q${i}`, dialect: "sqlite", sql: "SELECT 1;", tableCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, question: "q", dialect: "sqlite", sql: "SELECT 1;", tableCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-gen shareable URL", () => {
  it("builds share URL with schema, question, dialect", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("CREATE TABLE users (id INT);", "List users", "postgres");
    expect(url).toContain("schema=");
    expect(url).toContain("q=List+users");
    expect(url).toContain("dialect=postgres");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("CREATE TABLE users (id INT);", "List users", "mysql");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p.schema).toContain("CREATE TABLE users");
    expect(p.question).toBe("List users");
    expect(p.dialect).toBe("mysql");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ schema: "", question: "", dialect: "sqlite" });
  });
  it("defaults dialect to sqlite when invalid", () => {
    expect(parseShareUrl("q=hello&dialect=oracle").dialect).toBe("sqlite");
  });
});

describe("sql-gen LLM helpers", () => {
  it("buildLlmPrompt contains schema and JSON instruction", () => {
    const s = sampleSchema();
    const p = buildLlmPrompt("List users", s, "postgres");
    expect(p).toContain("PostgreSQL");
    expect(p).toContain("CREATE TABLE users");
    expect(p).toContain("JSON");
    expect(p).toContain("List users");
  });
  it("parseLlmResult parses valid JSON", () => {
    const r = parseLlmResult('{"sql":"SELECT 1;","explanation":"ok"}');
    expect(r).not.toBeNull();
    expect(r!.sql).toBe("SELECT 1;");
    expect(r!.explanation).toBe("ok");
  });
  it("parseLlmResult returns null for invalid", () => {
    expect(parseLlmResult("not json")).toBeNull();
  });
  it("parseLlmResult returns null when no sql", () => {
    expect(parseLlmResult('{"sql":"","explanation":"x"}')).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = Dialect;
