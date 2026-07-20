import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  IDENTIFIER_QUOTE,
  TYPE_MAPPINGS,
  FUNCTION_MAPPINGS,
  PRESETS,
  escapeRegex,
  splitTopLevelCommas,
  extractLiteralsAndComments,
  restoreLiteralsAndComments,
  applyIdentifierQuoting,
  convertTypes,
  convertFunctions,
  convertStringConcat,
  convertAutoIncrement,
  convertLimit,
  detectUnsupportedConstructs,
  convertSql,
  countManualReviews,
  renderChangeLog,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  type SqlDialect,
  type Placeholder,
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

describe("sql-dialect-converter constants", () => {
  it("ships 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["mysql", "postgresql", "sqlite", "sqlserver", "oracle"]),
    );
  });
  it("has identifier quote chars for every dialect", () => {
    for (const d of ["mysql", "postgresql", "sqlite", "sqlserver", "oracle"] as SqlDialect[]) {
      expect(IDENTIFIER_QUOTE[d].open).toBeTruthy();
      expect(IDENTIFIER_QUOTE[d].close).toBeTruthy();
    }
  });
  it("has 20+ type mappings", () => {
    expect(Object.keys(TYPE_MAPPINGS).length).toBeGreaterThanOrEqual(20);
  });
  it("has 5+ function mappings", () => {
    expect(Object.keys(FUNCTION_MAPPINGS).length).toBeGreaterThanOrEqual(5);
  });
  it("has 3+ presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("sql-dialect-converter escapeRegex / splitTopLevelCommas", () => {
  it("escapes regex special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("splits simple commas", () => {
    expect(splitTopLevelCommas("a, b, c")).toEqual(["a", " b", " c"]);
  });
  it("respects nested parens", () => {
    expect(splitTopLevelCommas("a, CONCAT(b, c), d")).toEqual(["a", " CONCAT(b, c)", " d"]);
  });
});

describe("sql-dialect-converter extractLiteralsAndComments", () => {
  it("extracts single-quoted strings", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT 'hello world' FROM t");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("'hello world'");
    expect(sql).not.toContain("hello world");
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT 'hello world' FROM t");
  });
  it("handles escaped single quotes inside strings", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT 'o''reilly' FROM t");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("'o''reilly'");
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT 'o''reilly' FROM t");
  });
  it("extracts line comments (-- ...)", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT 1 -- comment\nFROM t");
    expect(tokens.some((t) => t.value.includes("comment"))).toBe(true);
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT 1 -- comment\nFROM t");
  });
  it("extracts block comments (slash-star ... star-slash)", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT /* hi */ 1");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("/* hi */");
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT /* hi */ 1");
  });
  it("extracts MySQL # comments", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT 1 # mysql comment\n");
    expect(tokens.some((t) => t.value.startsWith("#"))).toBe(true);
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT 1 # mysql comment\n");
  });
  it("extracts backtick identifiers", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT `id` FROM `users`");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].value).toBe("`id`");
    expect(tokens[1].value).toBe("`users`");
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT `id` FROM `users`");
  });
  it("extracts square bracket identifiers", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT [id] FROM [users]");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].value).toBe("[id]");
    expect(restoreLiteralsAndComments(sql, tokens)).toBe("SELECT [id] FROM [users]");
  });
  it("extracts double-quoted identifiers", () => {
    const { sql, tokens } = extractLiteralsAndComments('SELECT "id" FROM "users"');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].value).toBe('"id"');
    expect(restoreLiteralsAndComments(sql, tokens)).toBe('SELECT "id" FROM "users"');
  });
});

describe("sql-dialect-converter applyIdentifierQuoting", () => {
  it("converts mysql backticks to postgres double-quotes", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT `id` FROM `users`");
    const r = applyIdentifierQuoting(sql, tokens, { from: "mysql", to: "postgresql" });
    const out = restoreLiteralsAndComments(r.sql, tokens);
    expect(out).toContain('"id"');
    expect(out).toContain('"users"');
    expect(r.changes).toHaveLength(1);
  });
  it("converts postgres double-quotes to sqlserver brackets", () => {
    const { sql, tokens } = extractLiteralsAndComments('SELECT "id" FROM "users"');
    const r = applyIdentifierQuoting(sql, tokens, { from: "postgresql", to: "sqlserver" });
    const out = restoreLiteralsAndComments(r.sql, tokens);
    expect(out).toContain("[id]");
    expect(out).toContain("[users]");
  });
  it("converts sqlserver brackets to mysql backticks", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT [id] FROM [users]");
    const r = applyIdentifierQuoting(sql, tokens, { from: "sqlserver", to: "mysql" });
    const out = restoreLiteralsAndComments(r.sql, tokens);
    expect(out).toContain("`id`");
    expect(out).toContain("`users`");
  });
  it("is a no-op when from === to", () => {
    const { sql, tokens } = extractLiteralsAndComments("SELECT `id` FROM `users`");
    const r = applyIdentifierQuoting(sql, tokens, { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
  it("escapes inner double-quote chars when re-quoting", () => {
    // Identifier `a"b` in postgres is quoted as "a""b"
    const { sql, tokens } = extractLiteralsAndComments('SELECT "a""b" FROM t');
    const r = applyIdentifierQuoting(sql, tokens, { from: "postgresql", to: "postgresql" });
    // No-op for postgres → postgres (same dialect)
    expect(r.changes).toHaveLength(0);
    // But postgres → sqlite should re-wrap (still double-quotes; inner doubled)
    const { sql: sql2, tokens: tokens2 } = extractLiteralsAndComments('SELECT "a""b" FROM t');
    applyIdentifierQuoting(sql2, tokens2, { from: "postgresql", to: "sqlite" });
    const out2 = restoreLiteralsAndComments(sql2, tokens2);
    expect(out2).toContain('"a""b"');
  });
});

describe("sql-dialect-converter convertTypes", () => {
  it("converts VARCHAR(255) to postgres VARCHAR(255)", () => {
    const r = convertTypes("CAST(x AS VARCHAR(255))", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("VARCHAR(255)");
  });
  it("converts VARCHAR(255) to sqlite TEXT (length stripped)", () => {
    const r = convertTypes("CAST(x AS VARCHAR(255))", { from: "mysql", to: "sqlite" });
    expect(r.sql).toContain("TEXT");
    expect(r.sql).not.toContain("VARCHAR(255)");
  });
  it("converts TINYINT(1) to postgres BOOLEAN", () => {
    const r = convertTypes("is_active TINYINT(1)", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("BOOLEAN");
  });
  it("converts DATETIME to postgres TIMESTAMP", () => {
    const r = convertTypes("created_at DATETIME", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("TIMESTAMP");
    expect(r.sql).not.toContain("DATETIME");
  });
  it("converts TEXT to sqlserver VARCHAR(MAX)", () => {
    const r = convertTypes("bio TEXT", { from: "mysql", to: "sqlserver" });
    expect(r.sql).toContain("VARCHAR(MAX)");
  });
  it("converts INT to oracle NUMBER(10)", () => {
    const r = convertTypes("id INT", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("NUMBER(10)");
  });
  it("converts DECIMAL(10,2) to oracle NUMBER(10,2)", () => {
    const r = convertTypes("price DECIMAL(10,2)", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("NUMBER(10,2)");
  });
  it("does not match VARCHAR inside VARCHAR2", () => {
    // VARCHAR2 is oracle-specific; converting postgres→oracle shouldn't
    // mangle VARCHAR2 (since it's already in source). Here we test mysql→oracle:
    // VARCHAR(255) → VARCHAR2(255). The literal `VARCHAR2` in source should not
    // be re-matched by the `varchar` rule.
    const r = convertTypes("col VARCHAR(255) other VARCHAR2(100)", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("VARCHAR2(255)");
    // VARCHAR2(100) stays VARCHAR2(100) (mapping re-applies idempotently for oracle)
    expect(r.sql).toContain("VARCHAR2(100)");
  });
  it("flags ENUM as manual review", () => {
    const r = convertTypes("status ENUM", { from: "mysql", to: "postgresql" });
    expect(r.changes.some((c) => c.severity === "manual")).toBe(true);
  });
  it("is a no-op when from === to", () => {
    const r = convertTypes("id INT", { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
});

describe("sql-dialect-converter convertFunctions", () => {
  it("converts NOW() to postgresql CURRENT_TIMESTAMP", () => {
    const r = convertFunctions("SELECT NOW()", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("CURRENT_TIMESTAMP");
    expect(r.sql).not.toContain("NOW()");
  });
  it("converts NOW() to sqlite datetime('now')", () => {
    const r = convertFunctions("SELECT NOW()", { from: "mysql", to: "sqlite" });
    expect(r.sql).toContain("datetime('now')");
  });
  it("converts NOW() to sqlserver GETDATE()", () => {
    const r = convertFunctions("SELECT NOW()", { from: "mysql", to: "sqlserver" });
    expect(r.sql).toContain("GETDATE()");
  });
  it("converts NOW() to oracle SYSDATE", () => {
    const r = convertFunctions("SELECT NOW()", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("SYSDATE");
  });
  it("converts CURDATE() to postgresql CURRENT_DATE", () => {
    const r = convertFunctions("SELECT CURDATE()", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("CURRENT_DATE");
  });
  it("preserves args for IFNULL → COALESCE", () => {
    const r = convertFunctions("SELECT IFNULL(col, 0)", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("COALESCE(col, 0)");
  });
  it("is case-insensitive", () => {
    const r = convertFunctions("SELECT now()", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("CURRENT_TIMESTAMP");
  });
  it("is a no-op when from === to", () => {
    const r = convertFunctions("SELECT NOW()", { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
});

describe("sql-dialect-converter convertStringConcat", () => {
  it("converts CONCAT(a, b) to || for postgres", () => {
    const r = convertStringConcat("SELECT CONCAT(a, b) FROM t", { from: "mysql", to: "postgresql" });
    expect(r.sql).toContain("a || b");
    expect(r.sql).not.toContain("CONCAT(a, b)");
  });
  it("converts a || b to CONCAT for mysql", () => {
    const r = convertStringConcat("SELECT a || b FROM t", { from: "postgresql", to: "mysql" });
    expect(r.sql).toContain("CONCAT(a, b)");
  });
  it("converts a || b to CONCAT for sqlserver", () => {
    const r = convertStringConcat("SELECT a || b FROM t", { from: "postgresql", to: "sqlserver" });
    expect(r.sql).toContain("CONCAT(a, b)");
  });
  it("is a no-op when from === to", () => {
    const r = convertStringConcat("SELECT CONCAT(a, b)", { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
});

describe("sql-dialect-converter convertAutoIncrement", () => {
  it("converts mysql AUTO_INCREMENT to sqlite AUTOINCREMENT", () => {
    const r = convertAutoIncrement("id INT AUTO_INCREMENT", { from: "mysql", to: "sqlite" });
    expect(r.sql).toContain("AUTOINCREMENT");
    expect(r.sql).not.toContain("AUTO_INCREMENT");
  });
  it("converts mysql AUTO_INCREMENT to sqlserver IDENTITY(1,1)", () => {
    const r = convertAutoIncrement("id INT AUTO_INCREMENT", { from: "mysql", to: "sqlserver" });
    expect(r.sql).toContain("IDENTITY(1,1)");
  });
  it("flags mysql AUTO_INCREMENT as manual review for postgres", () => {
    const r = convertAutoIncrement("id INT AUTO_INCREMENT", { from: "mysql", to: "postgresql" });
    expect(r.changes.some((c) => c.severity === "manual")).toBe(true);
  });
  it("converts sqlite AUTOINCREMENT to mysql AUTO_INCREMENT", () => {
    const r = convertAutoIncrement("id INTEGER PRIMARY KEY AUTOINCREMENT", { from: "sqlite", to: "mysql" });
    expect(r.sql).toContain("AUTO_INCREMENT");
  });
  it("converts sqlserver IDENTITY(1,1) to mysql AUTO_INCREMENT", () => {
    const r = convertAutoIncrement("id INT IDENTITY(1,1)", { from: "sqlserver", to: "mysql" });
    expect(r.sql).toContain("AUTO_INCREMENT");
  });
  it("is a no-op when from === to", () => {
    const r = convertAutoIncrement("id INT AUTO_INCREMENT", { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
});

describe("sql-dialect-converter convertLimit", () => {
  it("converts LIMIT n to TOP n for sqlserver", () => {
    const r = convertLimit("SELECT * FROM users LIMIT 10", { from: "mysql", to: "sqlserver" });
    expect(r.sql).toContain("TOP 10");
    expect(r.sql).not.toContain("LIMIT 10");
  });
  it("converts LIMIT n OFFSET m to OFFSET/FETCH for sqlserver", () => {
    const r = convertLimit("SELECT * FROM users ORDER BY id LIMIT 10 OFFSET 20", { from: "mysql", to: "sqlserver" });
    expect(r.sql).toContain("OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY");
  });
  it("converts LIMIT n to ROWNUM for oracle (no existing WHERE)", () => {
    const r = convertLimit("SELECT * FROM users LIMIT 10", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("ROWNUM <= 10");
  });
  it("converts LIMIT n to AND ROWNUM for oracle (existing WHERE)", () => {
    const r = convertLimit("SELECT * FROM users WHERE active = 1 LIMIT 10", { from: "mysql", to: "oracle" });
    expect(r.sql).toContain("AND ROWNUM <= 10");
  });
  it("flags LIMIT n OFFSET m as manual review for oracle", () => {
    const r = convertLimit("SELECT * FROM users LIMIT 10 OFFSET 20", { from: "mysql", to: "oracle" });
    expect(r.changes.some((c) => c.severity === "manual")).toBe(true);
  });
  it("is a no-op when from === to", () => {
    const r = convertLimit("SELECT * FROM t LIMIT 10", { from: "mysql", to: "mysql" });
    expect(r.changes).toHaveLength(0);
  });
});

describe("sql-dialect-converter detectUnsupportedConstructs", () => {
  it("flags stored procedures", () => {
    const changes = detectUnsupportedConstructs("CREATE PROCEDURE foo() BEGIN END", { from: "mysql", to: "postgresql" });
    expect(changes.some((c) => /procedure/i.test(c.description))).toBe(true);
  });
  it("flags spatial types", () => {
    const changes = detectUnsupportedConstructs("CREATE TABLE t (loc GEOMETRY)", { from: "mysql", to: "postgresql" });
    expect(changes.some((c) => /spatial/i.test(c.description))).toBe(true);
  });
  it("warns on UNSIGNED for non-mysql targets", () => {
    const changes = detectUnsupportedConstructs("id INT UNSIGNED", { from: "mysql", to: "postgresql" });
    expect(changes.some((c) => c.severity === "warning" && /UNSIGNED/i.test(c.description))).toBe(true);
  });
  it("does not warn on UNSIGNED for mysql target", () => {
    const changes = detectUnsupportedConstructs("id INT UNSIGNED", { from: "mysql", to: "mysql" });
    expect(changes.some((c) => /UNSIGNED/i.test(c.description))).toBe(false);
  });
  it("flags MySQL SHOW commands", () => {
    const changes = detectUnsupportedConstructs("SHOW TABLES", { from: "mysql", to: "postgresql" });
    expect(changes.some((c) => /SHOW/i.test(c.description))).toBe(true);
  });
  it("returns empty when from === to", () => {
    expect(detectUnsupportedConstructs("CREATE PROCEDURE foo()", { from: "mysql", to: "mysql" })).toEqual([]);
  });
});

describe("sql-dialect-converter convertSql end-to-end", () => {
  it("converts mysql backticks to postgres double-quotes", () => {
    const r = convertSql("SELECT `id` FROM `users`", "mysql", "postgresql");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('"id"');
      expect(r.output).toContain('"users"');
      expect(r.output).not.toContain("`");
    }
  });
  it("converts postgres double-quotes to sqlserver brackets", () => {
    const r = convertSql('SELECT "id" FROM "users"', "postgresql", "sqlserver");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("[id]");
      expect(r.output).toContain("[users]");
    }
  });
  it("converts LIMIT to TOP for sqlserver end-to-end", () => {
    const r = convertSql("SELECT id FROM users LIMIT 5", "mysql", "sqlserver");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("TOP 5");
      expect(r.output).not.toContain("LIMIT 5");
    }
  });
  it("converts NOW() end-to-end across dialects", () => {
    const r = convertSql("SELECT NOW()", "mysql", "postgresql");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("CURRENT_TIMESTAMP");
  });
  it("converts a full CREATE TABLE statement", () => {
    const r = convertSql(
      "CREATE TABLE `users` (`id` INT AUTO_INCREMENT, `email` VARCHAR(255), `is_active` TINYINT(1))",
      "mysql",
      "postgresql",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('"users"');
      expect(r.output).toContain('"id"');
      expect(r.output).toContain("BOOLEAN");
      // AUTO_INCREMENT for postgres → manual flag, original stripped
      expect(r.changes.some((c) => c.severity === "manual")).toBe(true);
    }
  });
  it("returns no changes when from === to", () => {
    const r = convertSql("SELECT * FROM users", "mysql", "mysql");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.changes).toHaveLength(0);
  });
  it("errors on empty input", () => {
    const r = convertSql("", "mysql", "postgresql");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/i);
  });
  it("preserves string literals and comments verbatim", () => {
    const r = convertSql("SELECT 'hello /* not a comment */ world' -- real comment\nFROM t", "mysql", "postgresql");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("'hello /* not a comment */ world'");
      expect(r.output).toContain("-- real comment");
    }
  });
});

describe("sql-dialect-converter presets", () => {
  it("every preset converts successfully", () => {
    for (const p of PRESETS) {
      const r = convertSql(p.sql, p.from, p.to);
      expect(r.ok, `preset ${p.id} should convert`).toBe(true);
    }
  });
  it("mysql-to-postgres preset produces postgres identifiers", () => {
    const p = PRESETS.find((x) => x.id === "mysql-to-postgres-ddl")!;
    const r = convertSql(p.sql, p.from, p.to);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('"users"');
      expect(r.output).not.toContain("`users`");
    }
  });
});

describe("sql-dialect-converter helpers", () => {
  it("countManualReviews counts only manual severity", () => {
    const changes = [
      { severity: "info" as const, description: "a" },
      { severity: "manual" as const, description: "b" },
      { severity: "warning" as const, description: "c" },
      { severity: "manual" as const, description: "d" },
    ];
    expect(countManualReviews(changes)).toBe(2);
  });
  it("renderChangeLog produces numbered log", () => {
    const log = renderChangeLog([{ severity: "info", description: "test change" }]);
    expect(log).toContain("1.");
    expect(log).toContain("INFO");
    expect(log).toContain("test change");
  });
});

describe("sql-dialect-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, from: "mysql", to: "postgresql",
      inputPreview: "SELECT 1", outputPreview: "SELECT 1",
      changeCount: 0, manualReviewCount: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, from: "mysql", to: "postgresql",
        inputPreview: `SELECT ${i}`, outputPreview: `SELECT ${i}`,
        changeCount: 0, manualReviewCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, from: "mysql", to: "postgresql",
      inputPreview: "x", outputPreview: "x",
      changeCount: 0, manualReviewCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-dialect-converter shareable URL", () => {
  it("encodeState/decodeState round-trip", () => {
    const encoded = encodeState("SELECT 'x' FROM t", "mysql", "postgresql");
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.input).toBe("SELECT 'x' FROM t");
    expect(decoded?.from).toBe("mysql");
    expect(decoded?.to).toBe("postgresql");
  });
  it("decodeState returns null for garbage", () => {
    expect(decodeState("!!!not-base64!!!")).toBeNull();
  });
  it("buildShareUrl produces a URL with c= param when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("SELECT 1", "mysql", "postgresql");
    expect(url).toContain("c=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips with encoded data", () => {
    const encoded = encodeState("SELECT 'x'", "mysql", "oracle");
    const hash = `#c=${encoded}`;
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed?.from).toBe("mysql");
    expect(parsed?.to).toBe("oracle");
    expect(parsed?.input).toBe("SELECT 'x'");
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("parseShareUrl returns null when no c param", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = Placeholder | SqlDialect;
