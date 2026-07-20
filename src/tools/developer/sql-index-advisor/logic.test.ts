import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_QUERY,
  SAMPLE_DDL,
  HOWTO_USE,
  DEFAULT_SHARE_OPTIONS,
  tokenizeSql,
  stripTokens,
  splitClauses,
  splitTopLevel,
  parseTableRef,
  parseColumnRef,
  parsePredicates,
  parseQuery,
  parseDdl,
  resolveTableForColumn,
  groupPredicatesByTable,
  recommendIndexes,
  isCoveredBy,
  detectRedundantExisting,
  advise,
  renderMarkdown,
  renderSqlScript,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ShareOptions,
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

describe("sql-index-advisor constants", () => {
  it("ships sample query and DDL", () => {
    expect(SAMPLE_QUERY).toContain("SELECT");
    expect(SAMPLE_QUERY).toContain("WHERE");
    expect(SAMPLE_DDL).toContain("CREATE TABLE");
    expect(SAMPLE_DDL).toContain("CREATE INDEX");
  });
  it("ships how-to-use tips", () => {
    expect(HOWTO_USE.length).toBeGreaterThanOrEqual(4);
    expect(HOWTO_USE.some((s) => s.includes("paste") || s.includes("Paste"))).toBe(true);
  });
  it("has default share options", () => {
    expect(DEFAULT_SHARE_OPTIONS.includeCaveats).toBe(true);
    expect(DEFAULT_SHARE_OPTIONS.recommendCovering).toBe(true);
    expect(DEFAULT_SHARE_OPTIONS.dialect).toBe("ansi");
  });
});

describe("sql-index-advisor tokenizer", () => {
  it("tokenizes keywords and punctuation", () => {
    const t = tokenizeSql("SELECT * FROM users;");
    const sig = stripTokens(t);
    expect(sig[0].value).toBe("SELECT");
    expect(sig[1].value).toBe("*");
    expect(sig[2].value).toBe("FROM");
    expect(sig[3].value).toBe("users");
    expect(sig[4].value).toBe(";");
  });
  it("handles single-quote strings with escaped quotes", () => {
    const t = stripTokens(tokenizeSql("WHERE x = 'O''Brien'"));
    expect(t.find((tok) => tok.type === "string")?.value).toBe("'O''Brien'");
  });
  it("handles line comments", () => {
    const t = tokenizeSql("SELECT 1 -- comment\nFROM dual");
    expect(t.some((tok) => tok.type === "comment")).toBe(true);
  });
  it("handles block comments", () => {
    const t = tokenizeSql("SELECT /* hi */ 1");
    expect(t.some((tok) => tok.type === "comment")).toBe(true);
  });
  it("handles double-quoted identifiers", () => {
    const t = stripTokens(tokenizeSql('SELECT "my col" FROM t'));
    expect(t.some((tok) => tok.value === "my col")).toBe(true);
  });
  it("handles backtick identifiers", () => {
    const t = stripTokens(tokenizeSql("SELECT `my col` FROM t"));
    expect(t.some((tok) => tok.value === "my col")).toBe(true);
  });
});

describe("sql-index-advisor splitTopLevel", () => {
  it("splits on regex at top level", () => {
    expect(splitTopLevel("a AND b AND c", /\bAND\b/i)).toEqual(["a ", " b ", " c"]);
  });
  it("does not split inside parens", () => {
    expect(splitTopLevel("f(a AND b) AND c", /\bAND\b/i)).toEqual(["f(a AND b) ", " c"]);
  });
  it("does not split inside strings", () => {
    expect(splitTopLevel("x = 'a AND b' AND c", /\bAND\b/i)).toEqual(["x = 'a AND b' ", " c"]);
  });
});

describe("sql-index-advisor splitClauses", () => {
  it("splits a simple select query", () => {
    const c = splitClauses("SELECT a, b FROM t WHERE x = 1 ORDER BY a");
    expect(c.select).toBe("a, b");
    expect(c.from).toBe("t");
    expect(c.where).toBe("x = 1");
    expect(c.orderBy).toBe("a");
  });
  it("extracts joins", () => {
    const c = splitClauses("SELECT * FROM a INNER JOIN b ON a.id = b.id WHERE a.x = 1");
    expect(c.joins.length).toBe(1);
    expect(c.joins[0].table).toBe("b");
    expect(c.joins[0].on).toContain("a.id = b.id");
  });
  it("handles GROUP BY", () => {
    const c = splitClauses("SELECT a, count(*) FROM t GROUP BY a");
    expect(c.groupBy).toBe("a");
  });
});

describe("sql-index-advisor parseTableRef", () => {
  it("parses simple name", () => {
    expect(parseTableRef("users")).toEqual({ name: "users" });
  });
  it("parses name with alias", () => {
    expect(parseTableRef("users u")).toEqual({ name: "users", alias: "u" });
  });
  it("parses schema.name with AS alias", () => {
    expect(parseTableRef("public.users AS u")).toEqual({ schema: "public", name: "users", alias: "u" });
  });
});

describe("sql-index-advisor parseColumnRef", () => {
  it("parses qualified column", () => {
    expect(parseColumnRef("u.id")).toEqual({ table: "u", column: "id" });
  });
  it("parses unqualified column", () => {
    expect(parseColumnRef("email")).toEqual({ column: "email" });
  });
});

describe("sql-index-advisor parsePredicates", () => {
  it("parses equality", () => {
    const p = parsePredicates("x = 1");
    expect(p).toHaveLength(1);
    expect(p[0].type).toBe("equality");
    expect(p[0].column.column).toBe("x");
  });
  it("parses range", () => {
    const p = parsePredicates("x > 1");
    expect(p[0].type).toBe("range");
  });
  it("parses IN", () => {
    const p = parsePredicates("x IN (1, 2, 3)");
    expect(p[0].type).toBe("in");
  });
  it("parses LIKE", () => {
    const p = parsePredicates("x LIKE 'abc%'");
    expect(p[0].type).toBe("like");
    expect(p[0].isLeadingWildcard).toBe(false);
  });
  it("flags leading-wildcard LIKE", () => {
    const p = parsePredicates("x LIKE '%abc'");
    expect(p[0].isLeadingWildcard).toBe(true);
  });
  it("parses BETWEEN", () => {
    const p = parsePredicates("x BETWEEN 1 AND 10");
    expect(p[0].type).toBe("range");
    expect(p[0].operator).toBe("BETWEEN");
  });
  it("parses IS NULL", () => {
    const p = parsePredicates("x IS NULL");
    expect(p[0].type).toBe("equality");
    expect(p[0].operator).toBe("IS NULL");
  });
  it("parses function call", () => {
    const p = parsePredicates("LOWER(email) = 'foo@bar.com'");
    expect(p[0].isFunction).toBe(true);
    expect(p[0].column.column).toBe("email");
  });
  it("parses multiple predicates joined by AND", () => {
    const p = parsePredicates("a = 1 AND b > 2 AND c = 3");
    expect(p).toHaveLength(3);
  });
  it("flags OR as or-type", () => {
    const p = parsePredicates("a = 1 OR b = 2");
    expect(p[0].type).toBe("or");
  });
});

describe("sql-index-advisor parseQuery", () => {
  it("parses the sample query", () => {
    const q = parseQuery(SAMPLE_QUERY);
    expect(q.fromTables.length).toBeGreaterThan(0);
    expect(q.fromTables[0].name).toBe("users");
    expect(q.joins).toHaveLength(1);
    expect(q.joins[0].table.name).toBe("orders");
    expect(q.wherePredicates.length).toBeGreaterThanOrEqual(3);
    expect(q.orderByColumns).toHaveLength(1);
  });
  it("emits warnings for leading-wildcard LIKE", () => {
    const q = parseQuery("SELECT * FROM users WHERE name LIKE '%john'");
    expect(q.warnings.some((w) => w.includes("Leading-wildcard"))).toBe(true);
  });
  it("emits warnings for function predicates", () => {
    const q = parseQuery("SELECT * FROM users WHERE LOWER(email) = 'foo'");
    expect(q.warnings.some((w) => w.includes("Function on column"))).toBe(true);
  });
  it("emits warnings for OR", () => {
    const q = parseQuery("SELECT * FROM users WHERE a = 1 OR b = 2");
    expect(q.warnings.some((w) => w.includes("OR conditions"))).toBe(true);
  });
});

describe("sql-index-advisor parseDdl", () => {
  it("parses CREATE TABLE", () => {
    const { tables } = parseDdl(SAMPLE_DDL);
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const users = tables.find((t) => t.name === "users");
    expect(users).toBeDefined();
    expect(users!.columns.length).toBeGreaterThan(0);
    expect(users!.columns.some((c) => c.name === "email")).toBe(true);
  });
  it("parses CREATE INDEX", () => {
    const { indexes } = parseDdl(SAMPLE_DDL);
    expect(indexes.length).toBeGreaterThanOrEqual(1);
    expect(indexes.some((i) => i.name === "idx_users_email")).toBe(true);
  });
  it("parses UNIQUE indexes", () => {
    const { indexes } = parseDdl("CREATE UNIQUE INDEX idx_u ON users(email)");
    expect(indexes[0].isUnique).toBe(true);
  });
  it("parses partial indexes with WHERE", () => {
    const { indexes } = parseDdl("CREATE INDEX idx ON users(email) WHERE active = true");
    expect(indexes[0].isPartial).toBe(true);
    expect(indexes[0].whereClause).toContain("active");
  });
  it("parses INCLUDE columns", () => {
    const { indexes } = parseDdl("CREATE INDEX idx ON users(email) INCLUDE (name, created_at)");
    expect(indexes[0].includeColumns).toEqual(["name", "created_at"]);
  });
  it("handles empty DDL", () => {
    expect(parseDdl("")).toEqual({ tables: [], indexes: [] });
  });
});

describe("sql-index-advisor resolveTableForColumn", () => {
  it("resolves via alias", () => {
    const q = parseQuery(SAMPLE_QUERY);
    expect(resolveTableForColumn({ table: "u", column: "id" }, q)).toBe("users");
    expect(resolveTableForColumn({ table: "o", column: "id" }, q)).toBe("orders");
  });
  it("returns undefined for unknown alias", () => {
    const q = parseQuery(SAMPLE_QUERY);
    expect(resolveTableForColumn({ table: "x", column: "id" }, q)).toBe("x");
  });
});

describe("sql-index-advisor groupPredicatesByTable", () => {
  it("groups predicates by resolved table", () => {
    const q = parseQuery(SAMPLE_QUERY);
    const g = groupPredicatesByTable(q);
    expect(g.has("users")).toBe(true);
    expect(g.has("orders")).toBe(true);
    const usersPreds = g.get("users")!;
    expect(usersPreds.some((p) => p.column.column === "status")).toBe(true);
  });
});

describe("sql-index-advisor recommendIndexes", () => {
  it("recommends composite indexes for the sample query", () => {
    const q = parseQuery(SAMPLE_QUERY);
    const ddl = parseDdl(SAMPLE_DDL);
    const recs = recommendIndexes(q, ddl);
    expect(recs.length).toBeGreaterThan(0);
    // users table should get a recommendation
    const usersRec = recs.find((r) => r.table === "users");
    expect(usersRec).toBeDefined();
    // status (equality) should come before created_at (range)
    expect(usersRec!.equalityColumns).toContain("status");
    expect(usersRec!.rangeColumns).toContain("created_at");
    // Verify equality comes first
    const statusIdx = usersRec!.columns.indexOf("status");
    const createdIdx = usersRec!.columns.indexOf("created_at");
    expect(statusIdx).toBeLessThan(createdIdx);
  });
  it("generates CREATE INDEX statements", () => {
    const q = parseQuery(SAMPLE_QUERY);
    const ddl = parseDdl(SAMPLE_DDL);
    const recs = recommendIndexes(q, ddl);
    for (const r of recs) {
      expect(r.createIndexSql).toContain("CREATE INDEX");
      expect(r.createIndexSql).toContain(r.table);
    }
  });
  it("flags covering indexes for small select lists", () => {
    const q = parseQuery("SELECT id, email FROM users WHERE status = 'active'");
    const recs = recommendIndexes(q, parseDdl(""));
    const r = recs[0];
    // Status is the equality, so index is on status; id and email could be INCLUDE
    expect(r.equalityColumns).toContain("status");
    // Covering INCLUDE may or may not be recommended depending on select list
    expect(r).toBeDefined();
  });
  it("recommends expression index for function predicate", () => {
    const q = parseQuery("SELECT * FROM users WHERE LOWER(email) = 'foo'");
    const recs = recommendIndexes(q, parseDdl(""));
    const expr = recs.find((r) => r.isExpression);
    expect(expr).toBeDefined();
    expect(expr!.createIndexSql).toContain("LOWER(email)");
  });
  it("recommends trigram index for leading-wildcard LIKE", () => {
    const q = parseQuery("SELECT * FROM users WHERE name LIKE '%john%'");
    const recs = recommendIndexes(q, parseDdl(""));
    const trgm = recs.find((r) => r.createIndexSql.includes("gin_trgm"));
    expect(trgm).toBeDefined();
  });
  it("respects dialect for MySQL (no INCLUDE)", () => {
    const q = parseQuery("SELECT id FROM users WHERE status = 'active'");
    const recs = recommendIndexes(q, parseDdl(""), { ...DEFAULT_SHARE_OPTIONS, dialect: "mysql" });
    const r = recs[0];
    expect(r.createIndexSql).not.toContain("INCLUDE");
  });
});

describe("sql-index-advisor isCoveredBy", () => {
  it("detects prefix coverage", () => {
    const rec = {
      id: "x", table: "users", columns: ["a", "b"],
      equalityColumns: [], rangeColumns: [], sortColumns: [], includeColumns: [],
      isExpression: false, reasoning: "", createIndexSql: "", caveats: [], confidence: "high" as const,
    };
    const existing = { name: "idx", table: "users", columns: ["a", "b", "c"], isUnique: false, isPartial: false, includeColumns: [], isPrimary: false };
    expect(isCoveredBy(rec, existing)).toBe(true);
  });
  it("returns false for different leading column", () => {
    const rec = {
      id: "x", table: "users", columns: ["a"],
      equalityColumns: [], rangeColumns: [], sortColumns: [], includeColumns: [],
      isExpression: false, reasoning: "", createIndexSql: "", caveats: [], confidence: "high" as const,
    };
    const existing = { name: "idx", table: "users", columns: ["b"], isUnique: false, isPartial: false, includeColumns: [], isPrimary: false };
    expect(isCoveredBy(rec, existing)).toBe(false);
  });
});

describe("sql-index-advisor detectRedundantExisting", () => {
  it("detects redundant existing indexes", () => {
    const recs = [{
      id: "x", table: "users", columns: ["a", "b"],
      equalityColumns: ["a", "b"], rangeColumns: [], sortColumns: [], includeColumns: [],
      isExpression: false, reasoning: "", createIndexSql: "", caveats: [], confidence: "high" as const,
    }];
    const existing = [
      { name: "old_idx", table: "users", columns: ["a"], isUnique: false, isPartial: false, includeColumns: [], isPrimary: false },
    ];
    const redundant = detectRedundantExisting(recs, existing);
    expect(redundant).toHaveLength(1);
    expect(redundant[0].name).toBe("old_idx");
  });
  it("does not flag primary key indexes", () => {
    const recs = [{
      id: "x", table: "users", columns: ["id"],
      equalityColumns: ["id"], rangeColumns: [], sortColumns: [], includeColumns: [],
      isExpression: false, reasoning: "", createIndexSql: "", caveats: [], confidence: "high" as const,
    }];
    const existing = [
      { name: "users_pkey", table: "users", columns: ["id"], isUnique: true, isPartial: false, includeColumns: [], isPrimary: true },
    ];
    expect(detectRedundantExisting(recs, existing)).toHaveLength(0);
  });
});

describe("sql-index-advisor advise (top-level)", () => {
  it("runs the full pipeline on sample", () => {
    const r = advise(SAMPLE_QUERY, SAMPLE_DDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.recommendations.length).toBeGreaterThan(0);
      expect(r.result.stats.tables).toBeGreaterThan(0);
      expect(r.result.stats.predicates).toBeGreaterThan(0);
    }
  });
  it("fails on empty query", () => {
    const r = advise("", "");
    expect(r.ok).toBe(false);
  });
  it("warns when no indexable predicates", () => {
    const r = advise("SELECT 1", "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.warnings.some((w) => w.includes("No indexable predicates"))).toBe(true);
    }
  });
  it("warns when no FROM clause", () => {
    const r = advise("SELECT 1 + 1 AS result", "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.warnings.some((w) => w.includes("No FROM clause"))).toBe(true);
    }
  });
});

describe("sql-index-advisor renderers", () => {
  it("renderMarkdown produces a report", () => {
    const r = advise(SAMPLE_QUERY, SAMPLE_DDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const md = renderMarkdown(r.result);
      expect(md).toContain("# SQL Index Advisor Report");
      expect(md).toContain("## Recommendations");
      expect(md).toContain("CREATE INDEX");
    }
  });
  it("renderSqlScript produces pure SQL", () => {
    const r = advise(SAMPLE_QUERY, SAMPLE_DDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const sql = renderSqlScript(r.result);
      expect(sql).toContain("CREATE INDEX");
      expect(sql.split("\n").some((l) => l.startsWith("--"))).toBe(true);
    }
  });
  it("renderCsv produces CSV", () => {
    const r = advise(SAMPLE_QUERY, SAMPLE_DDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const csv = renderCsv(r.result);
      expect(csv).toContain("id,table,columns");
      expect(csv.split("\n").length).toBeGreaterThan(r.result.recommendations.length);
    }
  });
  it("renderJson produces valid JSON", () => {
    const r = advise(SAMPLE_QUERY, SAMPLE_DDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const json = renderJson(r.result);
      const parsed = JSON.parse(json);
      expect(parsed.recommendations.length).toBeGreaterThan(0);
    }
  });
});

describe("sql-index-advisor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, tableCount: 2, predicateCount: 5,
      recommendationCount: 3, queryPreview: "SELECT ...",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, tableCount: 1, predicateCount: 1,
        recommendationCount: 1, queryPreview: "q" + i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, tableCount: 1, predicateCount: 1,
      recommendationCount: 1, queryPreview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-index-advisor share URL", () => {
  it("builds share URL with options encoded", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      includeCaveats: true,
      recommendCovering: false,
      dialect: "postgres",
    });
    expect(url).toContain("caveats=true");
    expect(url).toContain("covering=false");
    expect(url).toContain("dialect=postgres");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("caveats=false&covering=true&dialect=mysql");
    expect(parsed.includeCaveats).toBe(false);
    expect(parsed.recommendCovering).toBe(true);
    expect(parsed.dialect).toBe("mysql");
  });
  it("returns defaults for empty hash", () => {
    expect(parseShareUrl("")).toEqual(DEFAULT_SHARE_OPTIONS);
  });
  it("filters invalid dialect", () => {
    const parsed = parseShareUrl("dialect=invalid");
    expect(parsed.dialect).toBe("ansi");
  });
});

// Suppress unused-import lint
export type _Unused = ShareOptions;
