import { describe, it, expect, beforeEach } from "vitest";
import {
  Database,
  splitStatements,
  tokenize,
  parseSql,
  execute,
  executeStmt,
  validateSql,
  listTables,
  describeTable,
  exportDatabase,
  importDatabase,
  resultToCsv,
  resultToJson,
  resultToMarkdown,
  formatCell,
  compareValues,
  likeToRegex,
  exprToName,
  coerceToType,
  SAMPLE_DATASETS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

/** Helper: build a fresh DB and execute the setup SQL. */
function setupDb(): Database {
  const db = new Database();
  execute(db, `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, active BOOLEAN);
INSERT INTO users (id, name, age, active) VALUES
  (1, 'Alice', 30, TRUE),
  (2, 'Bob', 25, TRUE),
  (3, 'Carol', 35, FALSE),
  (4, 'Dave', 28, TRUE);`);
  return db;
}

describe("sql-playground constants", () => {
  it("exposes sample datasets", () => {
    expect(SAMPLE_DATASETS.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_DATASETS[0].sql).toContain("CREATE TABLE");
  });
});

describe("sql-playground splitStatements", () => {
  it("splits on semicolons outside quotes", () => {
    const out = splitStatements("SELECT 1; SELECT 2;");
    expect(out).toEqual(["SELECT 1", "SELECT 2"]);
  });
  it("does not split inside string literals", () => {
    const out = splitStatements("INSERT INTO t (a) VALUES ('a;b');");
    expect(out).toEqual(["INSERT INTO t (a) VALUES ('a;b')"]);
  });
  it("handles doubled-quote escapes inside strings", () => {
    const out = splitStatements("INSERT INTO t (a) VALUES ('O''Brien');");
    expect(out).toEqual(["INSERT INTO t (a) VALUES ('O''Brien')"]);
  });
  it("returns empty array for empty input", () => {
    expect(splitStatements("")).toEqual([]);
  });
});

describe("sql-playground tokenize", () => {
  it("tokenizes keywords, idents, numbers, strings", () => {
    const toks = tokenize("SELECT name, 42 FROM users WHERE x = 'hi'");
    expect(toks.map((t) => t.value)).toEqual(["SELECT", "name", ",", "42", "FROM", "users", "WHERE", "x", "=", "hi"]);
  });
  it("classifies keywords vs idents", () => {
    const toks = tokenize("SELECT name FROM users");
    expect(toks[0].type).toBe("keyword");
    expect(toks[0].upper).toBe("SELECT");
    expect(toks[1].type).toBe("ident");
    expect(toks[1].upper).toBe("NAME");
  });
  it("handles line comments", () => {
    const toks = tokenize("SELECT 1 -- comment\nFROM t");
    expect(toks.some((t) => t.value === "comment")).toBe(false);
  });
  it("handles block comments", () => {
    const toks = tokenize("SELECT /* hi */ 1");
    expect(toks.map((t) => t.value)).toEqual(["SELECT", "1"]);
  });
  it("tokenizes multi-char operators", () => {
    const toks = tokenize("a <= b AND c >= d AND e <> f");
    expect(toks.find((t) => t.value === "<=")).toBeDefined();
    expect(toks.find((t) => t.value === ">=")).toBeDefined();
    expect(toks.find((t) => t.value === "!=")).toBeDefined();
  });
});

describe("sql-playground parseSql", () => {
  it("parses a SELECT statement", () => {
    const stmts = parseSql("SELECT id, name FROM users WHERE id = 1");
    expect(stmts).toHaveLength(1);
    expect(stmts[0].kind).toBe("select");
  });
  it("parses a CREATE TABLE statement", () => {
    const stmts = parseSql("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    expect(stmts[0].kind).toBe("create-table");
    if (stmts[0].kind === "create-table") {
      expect(stmts[0].columns).toHaveLength(2);
      expect(stmts[0].columns[0].primaryKey).toBe(true);
      expect(stmts[0].columns[1].nullable).toBe(false);
    }
  });
  it("parses an INSERT statement with multiple rows", () => {
    const stmts = parseSql("INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y')");
    expect(stmts[0].kind).toBe("insert");
    if (stmts[0].kind === "insert") {
      expect(stmts[0].rows).toHaveLength(2);
      expect(stmts[0].columns).toEqual(["a", "b"]);
    }
  });
  it("parses a JOIN", () => {
    const stmts = parseSql("SELECT * FROM a JOIN b ON a.id = b.aid");
    if (stmts[0].kind === "select") {
      expect(stmts[0].joins).toHaveLength(1);
      expect(stmts[0].joins[0].table).toBe("b");
    }
  });
  it("parses GROUP BY + ORDER BY + LIMIT", () => {
    const stmts = parseSql("SELECT region, COUNT(*) FROM sales GROUP BY region ORDER BY COUNT(*) DESC LIMIT 5");
    if (stmts[0].kind === "select") {
      expect(stmts[0].groupBy).toBeDefined();
      expect(stmts[0].orderBy).toBeDefined();
      expect(stmts[0].limit).toBe(5);
    }
  });
});

describe("sql-playground CREATE TABLE + INSERT", () => {
  it("creates a table and inserts a row", () => {
    const db = new Database();
    const r1 = execute(db, "CREATE TABLE t (id INTEGER, name TEXT)");
    expect(r1.message).toContain("created");
    expect(listTables(db)).toHaveLength(1);
    const r2 = execute(db, "INSERT INTO t (id, name) VALUES (1, 'Alice')");
    expect(r2.affectedRows).toBe(1);
    const desc = describeTable(db, "t");
    expect(desc?.rowCount).toBe(1);
  });
  it("rejects duplicate CREATE TABLE without IF NOT EXISTS", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (id INTEGER)");
    expect(() => execute(db, "CREATE TABLE t (id INTEGER)")).toThrow();
  });
  it("honors IF NOT EXISTS", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (id INTEGER)");
    expect(() => execute(db, "CREATE TABLE IF NOT EXISTS t (id INTEGER)")).not.toThrow();
  });
  it("rejects INSERT into missing table", () => {
    const db = new Database();
    expect(() => execute(db, "INSERT INTO nope (a) VALUES (1)")).toThrow();
  });
  it("rejects INSERT with mismatched column count", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (a INTEGER, b INTEGER)");
    expect(() => execute(db, "INSERT INTO t (a, b) VALUES (1)")).toThrow();
  });
});

describe("sql-playground SELECT basics", () => {
  it("selects all columns with *", () => {
    const db = setupDb();
    const r = execute(db, "SELECT * FROM users");
    expect(r.columns).toEqual(["id", "name", "age", "active"]);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0].name).toBe("Alice");
  });
  it("projects selected columns", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name, age FROM users");
    expect(r.columns).toEqual(["name", "age"]);
  });
  it("aliases columns with AS", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name AS full_name FROM users");
    expect(r.columns).toEqual(["full_name"]);
  });
  it("supports SELECT without FROM (constants)", () => {
    const db = new Database();
    const r = execute(db, "SELECT 1 + 2 AS sum");
    expect(r.rows[0].sum).toBe(3);
  });
  it("supports DISTINCT", () => {
    const db = setupDb();
    const r = execute(db, "SELECT DISTINCT active FROM users");
    const seen = r.rows.map((row) => row.active).sort();
    expect(seen).toEqual([false, true]);
  });
});

describe("sql-playground WHERE", () => {
  it("filters with WHERE and AND", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE active = TRUE AND age >= 28");
    const names = r.rows.map((row) => row.name).sort();
    expect(names).toEqual(["Alice", "Dave"]);
  });
  it("filters with OR", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE age < 26 OR age > 34");
    expect(r.rows.map((row) => row.name).sort()).toEqual(["Bob", "Carol"]);
  });
  it("supports LIKE with % wildcard", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE name LIKE 'A%'");
    expect(r.rows.map((row) => row.name)).toEqual(["Alice"]);
  });
  it("supports LIKE with _ wildcard", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE name LIKE 'B_b'");
    expect(r.rows.map((row) => row.name)).toEqual(["Bob"]);
  });
  it("supports BETWEEN", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE age BETWEEN 26 AND 32");
    expect(r.rows.map((row) => row.name).sort()).toEqual(["Alice", "Dave"]);
  });
  it("supports IN", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE name IN ('Alice', 'Carol')");
    expect(r.rows.map((row) => row.name).sort()).toEqual(["Alice", "Carol"]);
  });
  it("supports NOT IN", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users WHERE name NOT IN ('Alice', 'Carol')");
    expect(r.rows.map((row) => row.name).sort()).toEqual(["Bob", "Dave"]);
  });
  it("supports IS NULL / IS NOT NULL", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (id INTEGER, note TEXT)");
    execute(db, "INSERT INTO t (id, note) VALUES (1, 'hi'), (2, NULL), (3, 'yo')");
    const r = execute(db, "SELECT id FROM t WHERE note IS NULL");
    expect(r.rows.map((row) => row.id)).toEqual([2]);
    const r2 = execute(db, "SELECT id FROM t WHERE note IS NOT NULL");
    expect(r2.rows.map((row) => row.id).sort()).toEqual([1, 3]);
  });
});

describe("sql-playground ORDER BY + LIMIT", () => {
  it("sorts ASC", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users ORDER BY age ASC");
    expect(r.rows.map((row) => row.name)).toEqual(["Bob", "Dave", "Alice", "Carol"]);
  });
  it("sorts DESC", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users ORDER BY age DESC");
    expect(r.rows[0].name).toBe("Carol");
  });
  it("applies LIMIT", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users ORDER BY id LIMIT 2");
    expect(r.rows).toHaveLength(2);
  });
  it("applies OFFSET", () => {
    const db = setupDb();
    const r = execute(db, "SELECT name FROM users ORDER BY id LIMIT 2 OFFSET 1");
    expect(r.rows.map((row) => row.name)).toEqual(["Bob", "Carol"]);
  });
});

describe("sql-playground JOIN", () => {
  function setupJoin(): Database {
    const db = new Database();
    execute(db, `CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO departments (id, name) VALUES (1, 'Eng'), (2, 'Sales');
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER);
INSERT INTO employees (id, name, dept_id) VALUES
  (1, 'Alice', 1), (2, 'Bob', 1), (3, 'Carol', 2), (4, 'Dan', NULL);`);
    return db;
  }
  it("INNER JOIN matches rows", () => {
    const db = setupJoin();
    const r = execute(db, "SELECT e.name, d.name AS dept FROM employees e INNER JOIN departments d ON e.dept_id = d.id");
    expect(r.rows).toHaveLength(3);
    expect(r.rows.map((row) => row.name)).toEqual(["Alice", "Bob", "Carol"]);
  });
  it("LEFT JOIN keeps unmatched left rows", () => {
    const db = setupJoin();
    const r = execute(db, "SELECT e.name, d.name AS dept FROM employees e LEFT JOIN departments d ON e.dept_id = d.id");
    expect(r.rows).toHaveLength(4);
    const dan = r.rows.find((row) => row.name === "Dan");
    expect(dan?.dept).toBeNull();
  });
});

describe("sql-playground GROUP BY + aggregates", () => {
  function setupSales(): Database {
    const db = new Database();
    execute(db, `CREATE TABLE sales (id INTEGER, region TEXT, amount REAL);
INSERT INTO sales (id, region, amount) VALUES
  (1, 'North', 100), (2, 'North', 200),
  (3, 'South', 50),  (4, 'South', 75);`);
    return db;
  }
  it("COUNT(*) per group", () => {
    const db = setupSales();
    const r = execute(db, "SELECT region, COUNT(*) AS n FROM sales GROUP BY region ORDER BY region");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].n).toBe(2);
  });
  it("SUM per group", () => {
    const db = setupSales();
    const r = execute(db, "SELECT region, SUM(amount) AS total FROM sales GROUP BY region ORDER BY region");
    expect(r.rows[0].total).toBe(300);
    expect(r.rows[1].total).toBe(125);
  });
  it("AVG per group", () => {
    const db = setupSales();
    const r = execute(db, "SELECT region, AVG(amount) AS avg_amount FROM sales GROUP BY region ORDER BY region");
    expect(r.rows[0].avg_amount).toBe(150);
  });
  it("MIN/MAX per group", () => {
    const db = setupSales();
    const r = execute(db, "SELECT region, MIN(amount) AS lo, MAX(amount) AS hi FROM sales GROUP BY region ORDER BY region");
    expect(r.rows[0].lo).toBe(100);
    expect(r.rows[0].hi).toBe(200);
  });
  it("aggregate without GROUP BY (single group)", () => {
    const db = setupSales();
    const r = execute(db, "SELECT COUNT(*) AS n, SUM(amount) AS total FROM sales");
    expect(r.rows[0].n).toBe(4);
    expect(r.rows[0].total).toBe(425);
  });
  it("HAVING filters groups", () => {
    const db = setupSales();
    const r = execute(db, "SELECT region, SUM(amount) AS total FROM sales GROUP BY region HAVING SUM(amount) > 200 ORDER BY region");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].region).toBe("North");
  });
});

describe("sql-playground scalar functions", () => {
  it("UPPER / LOWER", () => {
    const db = setupDb();
    const r = execute(db, "SELECT UPPER(name) AS u, LOWER(name) AS l FROM users WHERE id = 1");
    expect(r.rows[0].u).toBe("ALICE");
    expect(r.rows[0].l).toBe("alice");
  });
  it("LENGTH", () => {
    const db = setupDb();
    const r = execute(db, "SELECT LENGTH(name) AS n FROM users WHERE id = 1");
    expect(r.rows[0].n).toBe(5);
  });
  it("COALESCE", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (a INTEGER, b INTEGER)");
    execute(db, "INSERT INTO t (a, b) VALUES (NULL, 7), (3, NULL)");
    const r = execute(db, "SELECT COALESCE(a, b) AS v FROM t ORDER BY v");
    expect(r.rows.map((row) => row.v)).toEqual([3, 7]);
  });
  it("ABS / ROUND", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (x REAL)");
    execute(db, "INSERT INTO t (x) VALUES (-3.7), (2.45)");
    const r = execute(db, "SELECT ABS(x) AS a, ROUND(x, 1) AS r FROM t ORDER BY r");
    // ABS(-3.7) = 3.7, ABS(2.45) = 2.45
    // ROUND(-3.7, 1) = -3.7, ROUND(2.45, 1) = 2.5
    expect(r.rows.map((row) => row.r)).toEqual([-3.7, 2.5]);
    expect(r.rows.map((row) => row.a)).toEqual([3.7, 2.45]);
  });
});

describe("sql-playground NULL handling", () => {
  it("NULL propagates through arithmetic", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (a INTEGER, b INTEGER)");
    execute(db, "INSERT INTO t (a, b) VALUES (NULL, 5)");
    const r = execute(db, "SELECT a + b AS sum FROM t");
    expect(r.rows[0].sum).toBeNull();
  });
  it("NULL compares as unequal", () => {
    const db = new Database();
    execute(db, "CREATE TABLE t (a INTEGER)");
    execute(db, "INSERT INTO t (a) VALUES (NULL), (1)");
    const r = execute(db, "SELECT a FROM t WHERE a = NULL");
    expect(r.rows).toHaveLength(0);
  });
});

describe("sql-playground result formatting", () => {
  const db = setupDb();
  const r = execute(db, "SELECT id, name FROM users ORDER BY id LIMIT 2");

  it("formats CSV with header", () => {
    const csv = resultToCsv(r);
    expect(csv.split("\n")[0]).toBe("id,name");
    expect(csv).toContain("1,Alice");
  });
  it("formats JSON (array of objects)", () => {
    const json = resultToJson(r, true);
    const arr = JSON.parse(json);
    expect(arr).toHaveLength(2);
    expect(arr[0].name).toBe("Alice");
  });
  it("formats Markdown table", () => {
    const md = resultToMarkdown(r);
    expect(md.split("\n")[0]).toBe("| id | name |");
    expect(md.split("\n")[1]).toBe("| --- | --- |");
  });
  it("formats NULL cell as 'NULL'", () => {
    expect(formatCell(null)).toBe("NULL");
    expect(formatCell(true)).toBe("true");
    expect(formatCell(42)).toBe("42");
  });
});

describe("sql-playground validateSql", () => {
  it("returns null for valid SQL", () => {
    expect(validateSql("SELECT * FROM users")).toBeNull();
  });
  it("returns an error message for invalid SQL", () => {
    expect(validateSql("SELECT FROM")).not.toBeNull();
  });
});

describe("sql-playground import / export", () => {
  it("exports then imports a database", () => {
    const db = setupDb();
    const json = exportDatabase(db);
    const db2 = importDatabase(json);
    expect(listTables(db2)).toEqual(listTables(db));
    const r = execute(db2, "SELECT COUNT(*) AS n FROM users");
    expect(r.rows[0].n).toBe(4);
  });
});

describe("sql-playground helpers", () => {
  it("compareValues orders NULLs first", () => {
    expect(compareValues(null, 5)).toBe(-1);
    expect(compareValues(5, null)).toBe(1);
    expect(compareValues(null, null)).toBe(0);
  });
  it("compareValues orders numerics", () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(3, 2)).toBeGreaterThan(0);
  });
  it("likeToRegex matches % wildcard", () => {
    expect(likeToRegex("A%").test("Alice")).toBe(true);
    expect(likeToRegex("A%").test("Bob")).toBe(false);
  });
  it("likeToRegex matches _ wildcard", () => {
    expect(likeToRegex("B_b").test("Bob")).toBe(true);
    expect(likeToRegex("B_b").test("Bab")).toBe(true);
    expect(likeToRegex("B_b").test("Bobbit")).toBe(false);
  });
  it("exprToName names columns and funcs", () => {
    expect(exprToName({ kind: "column", name: "id" })).toBe("id");
    expect(exprToName({ kind: "column", table: "u", name: "id" })).toBe("u.id");
    expect(exprToName({ kind: "func", name: "COUNT", args: [], star: true })).toBe("COUNT(*)");
  });
  it("coerceToType casts to INTEGER", () => {
    expect(coerceToType("42", "INTEGER")).toBe(42);
    expect(coerceToType(3.7, "INTEGER")).toBe(3);
    expect(coerceToType(null, "INTEGER")).toBeNull();
  });
  it("coerceToType casts to TEXT", () => {
    expect(coerceToType(42, "TEXT")).toBe("42");
    expect(coerceToType(true, "TEXT")).toBe("true");
  });
});

describe("sql-playground DROP TABLE", () => {
  it("drops an existing table", () => {
    const db = setupDb();
    execute(db, "DROP TABLE users");
    expect(listTables(db)).toHaveLength(0);
  });
  it("rejects DROP on missing table without IF EXISTS", () => {
    const db = new Database();
    expect(() => execute(db, "DROP TABLE nope")).toThrow();
  });
  it("honors IF EXISTS", () => {
    const db = new Database();
    expect(() => execute(db, "DROP TABLE IF EXISTS nope")).not.toThrow();
  });
});

describe("sql-playground executeStmt (direct)", () => {
  it("returns a result for a SELECT", () => {
    const db = setupDb();
    const stmts = parseSql("SELECT name FROM users ORDER BY id LIMIT 1");
    const r = executeStmt(db, stmts[0]);
    expect(r.rows[0].name).toBe("Alice");
  });
});

describe("sql-playground history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, sql: "SELECT 1", rowCount: 1, executionTimeMs: 1, success: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, sql: `SELECT ${i}`, rowCount: 1, executionTimeMs: 1, success: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, sql: "SELECT 1", rowCount: 1, executionTimeMs: 1, success: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("records failures with error message", () => {
    saveHistory({ ts: 1, sql: "SELECT FROM", rowCount: 0, executionTimeMs: 0, success: false, error: "Parse error" });
    expect(loadHistory()[0].error).toBe("Parse error");
  });
});

describe("sql-playground shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("SELECT * FROM users");
    // URLSearchParams encodes spaces as + and may or may not encode '*' — be lenient.
    expect(url).toContain("sql=SELECT");
    expect(url).toContain("FROM+users");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { sql } = parseShareUrl("sql=SELECT+1");
    expect(sql).toBe("SELECT 1");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ sql: "" });
  });
});

describe("sql-playground sample datasets", () => {
  it("each sample dataset executes without error", () => {
    for (const ds of SAMPLE_DATASETS) {
      const db = new Database();
      expect(() => execute(db, ds.sql)).not.toThrow();
    }
  });
  it("employees & departments sample returns rows", () => {
    const db = new Database();
    execute(db, SAMPLE_DATASETS[0].sql);
    expect(db.tables.size).toBeGreaterThanOrEqual(2);
  });
});
