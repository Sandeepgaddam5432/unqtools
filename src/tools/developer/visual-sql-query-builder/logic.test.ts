import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  JOIN_TYPES,
  WHERE_OPERATORS,
  AGGREGATES,
  SORT_DIRECTIONS,
  RESERVED_WORDS,
  PRESETS,
  SAMPLE_SCHEMA_JSON,
  createEmptyModel,
  createDefaultModel,
  createId,
  resetIdCounter,
  normalizeIdentifier,
  needsQuoting,
  quoteIdentifier,
  qualifyColumn,
  isNumericLiteral,
  escapeStringLiteral,
  renderScalar,
  renderList,
  renderBetween,
  buildPredicate,
  joinPredicates,
  buildColumnExpr,
  buildTableRef,
  buildJoinClause,
  inferGroupBy,
  validateModel,
  buildSql,
  parseSchemaJson,
  modelFromSchema,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  type QueryModel,
  type SqlDialect,
} from "./logic";

beforeEach(() => {
  // localStorage mock
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
  resetIdCounter();
});

describe("visual-sql-query-builder constants", () => {
  it("ships 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["ansi", "mysql", "postgresql", "sqlite", "sqlserver"]),
    );
  });
  it("ships 4 join types", () => {
    expect(JOIN_TYPES).toHaveLength(4);
  });
  it("ships WHERE operators with correct needsValue flags", () => {
    expect(WHERE_OPERATORS.length).toBeGreaterThanOrEqual(10);
    const isNull = WHERE_OPERATORS.find((o) => o.value === "IS NULL");
    expect(isNull?.needsValue).toBe(false);
    const eq = WHERE_OPERATORS.find((o) => o.value === "=");
    expect(eq?.needsValue).toBe(true);
  });
  it("ships 5 aggregates", () => {
    expect(AGGREGATES).toEqual(["COUNT", "SUM", "AVG", "MIN", "MAX"]);
  });
  it("ships 2 sort directions", () => {
    expect(SORT_DIRECTIONS).toHaveLength(2);
  });
  it("has a non-empty reserved-words set including select/from/where", () => {
    expect(RESERVED_WORDS.size).toBeGreaterThan(20);
    expect(RESERVED_WORDS.has("select")).toBe(true);
    expect(RESERVED_WORDS.has("from")).toBe(true);
    expect(RESERVED_WORDS.has("where")).toBe(true);
  });
});

describe("visual-sql-query-builder model factories", () => {
  it("createEmptyModel returns all-empty model", () => {
    const m = createEmptyModel();
    expect(m.distinct).toBe(false);
    expect(m.tables).toEqual([]);
    expect(m.columns).toEqual([]);
    expect(m.joins).toEqual([]);
    expect(m.where).toEqual([]);
    expect(m.groupBy).toEqual([]);
    expect(m.having).toEqual([]);
    expect(m.orderBy).toEqual([]);
    expect(m.limit).toBeNull();
    expect(m.offset).toBeNull();
  });
  it("createDefaultModel returns a valid single-table model", () => {
    const m = createDefaultModel();
    expect(m.tables).toHaveLength(1);
    expect(m.columns.length).toBeGreaterThanOrEqual(2);
    expect(m.where.length).toBeGreaterThanOrEqual(1);
    expect(m.orderBy.length).toBeGreaterThanOrEqual(1);
    expect(m.limit).toBe(50);
  });
  it("createId produces unique ids", () => {
    const a = createId("x");
    const b = createId("x");
    expect(a).not.toBe(b);
  });
});

describe("visual-sql-query-builder normalizeIdentifier", () => {
  it("trims whitespace", () => {
    expect(normalizeIdentifier("  users  ")).toBe("users");
  });
  it("returns empty string for null/undefined input", () => {
    expect(normalizeIdentifier(null as unknown as string)).toBe("");
  });
});

describe("visual-sql-query-builder needsQuoting", () => {
  it("returns true for reserved words", () => {
    expect(needsQuoting("select")).toBe(true);
    expect(needsQuoting("WHERE")).toBe(true);
    expect(needsQuoting("From")).toBe(true);
  });
  it("returns false for safe identifiers", () => {
    expect(needsQuoting("users")).toBe(false);
    expect(needsQuoting("user_id")).toBe(false);
    expect(needsQuoting("$id")).toBe(false);
  });
  it("returns true for identifiers with spaces or starting with a digit", () => {
    expect(needsQuoting("first name")).toBe(true);
    expect(needsQuoting("1st_place")).toBe(true);
  });
  it("returns false for empty identifier", () => {
    expect(needsQuoting("")).toBe(false);
  });
});

describe("visual-sql-query-builder quoteIdentifier", () => {
  it("does not quote safe identifiers", () => {
    expect(quoteIdentifier("users", "mysql")).toBe("users");
    expect(quoteIdentifier("users", "postgresql")).toBe("users");
  });
  it("quotes with backticks for mysql", () => {
    expect(quoteIdentifier("first name", "mysql")).toBe("`first name`");
  });
  it("quotes with double-quotes for postgres / ansi / sqlite", () => {
    expect(quoteIdentifier("first name", "postgresql")).toBe('"first name"');
    expect(quoteIdentifier("first name", "ansi")).toBe('"first name"');
    expect(quoteIdentifier("first name", "sqlite")).toBe('"first name"');
  });
  it("quotes with square brackets for sqlserver", () => {
    expect(quoteIdentifier("first name", "sqlserver")).toBe("[first name]");
  });
  it("escapes internal quote characters", () => {
    expect(quoteIdentifier('a"b', "postgresql")).toBe('"a""b"');
    expect(quoteIdentifier("a`b", "mysql")).toBe("`a``b`");
    expect(quoteIdentifier("a]b", "sqlserver")).toBe("[a]]b]");
  });
  it("returns empty string for empty input", () => {
    expect(quoteIdentifier("", "ansi")).toBe("");
  });
});

describe("visual-sql-query-builder qualifyColumn", () => {
  it("returns * unchanged", () => {
    expect(qualifyColumn("*", "ansi")).toBe("*");
  });
  it("quotes each segment independently", () => {
    expect(qualifyColumn("u.id", "ansi")).toBe("u.id");
    expect(qualifyColumn("u.first name", "mysql")).toBe("u.`first name`");
  });
  it("returns empty string for empty input", () => {
    expect(qualifyColumn("", "ansi")).toBe("");
  });
});

describe("visual-sql-query-builder value rendering", () => {
  it("isNumericLiteral detects numbers", () => {
    expect(isNumericLiteral("42")).toBe(true);
    expect(isNumericLiteral("-3.14")).toBe(true);
    expect(isNumericLiteral("abc")).toBe(false);
    expect(isNumericLiteral("")).toBe(false);
  });
  it("escapeStringLiteral doubles single quotes", () => {
    expect(escapeStringLiteral("o'reilly")).toBe("'o''reilly'");
  });
  it("renderScalar quotes strings but not numbers", () => {
    expect(renderScalar("42")).toBe("42");
    expect(renderScalar("john")).toBe("'john'");
  });
  it("renderList parses comma-separated values", () => {
    expect(renderList("a, b, 42")).toBe("'a', 'b', 42");
  });
  it("renderBetween renders two values joined by AND", () => {
    expect(renderBetween("10, 100")).toBe("10 AND 100");
  });
});

describe("visual-sql-query-builder buildPredicate", () => {
  it("renders IS NULL", () => {
    expect(buildPredicate({ id: "p", column: "u.id", operator: "IS NULL", value: "", conjunction: "AND" }, "ansi"))
      .toBe("u.id IS NULL");
  });
  it("renders IN list", () => {
    const sql = buildPredicate({ id: "p", column: "u.id", operator: "IN", value: "1, 2, 3", conjunction: "AND" }, "ansi");
    expect(sql).toBe("u.id IN (1, 2, 3)");
  });
  it("renders BETWEEN", () => {
    const sql = buildPredicate({ id: "p", column: "u.age", operator: "BETWEEN", value: "18, 65", conjunction: "AND" }, "ansi");
    expect(sql).toBe("u.age BETWEEN 18 AND 65");
  });
  it("renders LIKE as string literal", () => {
    const sql = buildPredicate({ id: "p", column: "u.name", operator: "LIKE", value: "%john%", conjunction: "AND" }, "ansi");
    expect(sql).toBe("u.name LIKE '%john%'");
  });
  it("renders equality with numeric value unquoted", () => {
    const sql = buildPredicate({ id: "p", column: "u.id", operator: "=", value: "42", conjunction: "AND" }, "ansi");
    expect(sql).toBe("u.id = 42");
  });
  it("renders equality with string value quoted", () => {
    const sql = buildPredicate({ id: "p", column: "u.name", operator: "=", value: "alice", conjunction: "AND" }, "ansi");
    expect(sql).toBe("u.name = 'alice'");
  });
});

describe("visual-sql-query-builder joinPredicates", () => {
  it("joins predicates with their conjunction", () => {
    const ps = [
      { id: "a", column: "x", operator: "=" as const, value: "1", conjunction: "AND" as const },
      { id: "b", column: "y", operator: "=" as const, value: "2", conjunction: "OR" as const },
    ];
    const out = joinPredicates(ps, "ansi");
    expect(out).toContain("x = 1");
    expect(out).toContain("OR y = 2");
  });
  it("returns empty string for empty list", () => {
    expect(joinPredicates([], "ansi")).toBe("");
  });
});

describe("visual-sql-query-builder buildColumnExpr", () => {
  it("renders plain column with alias", () => {
    expect(buildColumnExpr({ id: "c", name: "u.id", alias: "user_id" }, "ansi"))
      .toBe("u.id AS user_id");
  });
  it("renders COUNT(*) with alias", () => {
    expect(buildColumnExpr({ id: "c", aggregate: "COUNT", name: "*", alias: "n" }, "ansi"))
      .toBe("COUNT(*) AS n");
  });
  it("renders SUM(u.total) without alias", () => {
    expect(buildColumnExpr({ id: "c", aggregate: "SUM", name: "u.total" }, "ansi"))
      .toBe("SUM(u.total)");
  });
});

describe("visual-sql-query-builder buildTableRef", () => {
  it("renders table with alias", () => {
    expect(buildTableRef({ id: "t", name: "users", alias: "u" }, "ansi"))
      .toBe("users AS u");
  });
  it("renders table without alias", () => {
    expect(buildTableRef({ id: "t", name: "users" }, "ansi")).toBe("users");
  });
});

describe("visual-sql-query-builder buildJoinClause", () => {
  it("renders INNER JOIN", () => {
    const j = {
      id: "j", type: "INNER" as const, table: "orders", alias: "o",
      leftTableId: "t1", leftColumn: "u.id", rightColumn: "o.user_id",
    };
    expect(buildJoinClause(j, "ansi")).toBe("INNER JOIN orders AS o ON u.id = o.user_id");
  });
  it("renders LEFT JOIN", () => {
    const j = {
      id: "j", type: "LEFT" as const, table: "orders", alias: "o",
      leftTableId: "t1", leftColumn: "u.id", rightColumn: "o.user_id",
    };
    expect(buildJoinClause(j, "ansi")).toBe("LEFT JOIN orders AS o ON u.id = o.user_id");
  });
  it("renders FULL OUTER JOIN", () => {
    const j = {
      id: "j", type: "FULL" as const, table: "orders",
      leftTableId: "t1", leftColumn: "u.id", rightColumn: "o.user_id",
    };
    expect(buildJoinClause(j, "ansi")).toBe("FULL OUTER JOIN orders ON u.id = o.user_id");
  });
});

describe("visual-sql-query-builder inferGroupBy", () => {
  it("returns explicit GROUP BY when present", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      columns: [{ id: "c1", aggregate: "COUNT", name: "*" }],
      groupBy: [{ id: "g1", column: "u.region" }],
    };
    expect(inferGroupBy(m)).toEqual([{ id: "g1", column: "u.region" }]);
  });
  it("infers GROUP BY from non-aggregated columns", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      columns: [
        { id: "c1", name: "u.region" },
        { id: "c2", aggregate: "COUNT", name: "*" },
      ],
    };
    const inferred = inferGroupBy(m);
    expect(inferred).toHaveLength(1);
    expect(inferred[0].column).toBe("u.region");
  });
  it("returns empty when no aggregates", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      columns: [{ id: "c1", name: "u.region" }],
    };
    expect(inferGroupBy(m)).toEqual([]);
  });
});

describe("visual-sql-query-builder validateModel", () => {
  it("errors when no tables", () => {
    const issues = validateModel({ ...createEmptyModel() });
    expect(issues.some((i) => i.severity === "error" && /table/i.test(i.message))).toBe(true);
  });
  it("errors when no columns", () => {
    const issues = validateModel({ ...createEmptyModel(), tables: [{ id: "t1", name: "u" }] });
    expect(issues.some((i) => i.severity === "error" && /column/i.test(i.message))).toBe(true);
  });
  it("warns when HAVING is used without any aggregate", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "u" }],
      columns: [{ id: "c1", name: "id" }],
      having: [{ id: "h1", column: "x", operator: ">", value: "1", conjunction: "AND" }],
    };
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "warning" && /HAVING/i.test(i.message))).toBe(true);
  });
  it("errors on negative LIMIT", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "u" }],
      columns: [{ id: "c1", name: "id" }],
      limit: -5,
    };
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "error" && /LIMIT/i.test(i.message))).toBe(true);
  });
});

describe("visual-sql-query-builder buildSql", () => {
  it("builds a simple SELECT", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [
        { id: "c1", name: "u.id" },
        { id: "c2", name: "u.email" },
      ],
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sql).toContain("SELECT u.id, u.email");
      expect(r.sql).toContain("FROM users AS u");
    }
  });
  it("builds with WHERE and ORDER BY and LIMIT", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [{ id: "c1", name: "u.id" }],
      where: [{ id: "w1", column: "u.id", operator: ">", value: "100", conjunction: "AND" }],
      orderBy: [{ id: "o1", column: "u.id", direction: "DESC" }],
      limit: 10,
      offset: 0,
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sql).toContain("WHERE u.id > 100");
      expect(r.sql).toContain("ORDER BY u.id DESC");
      expect(r.sql).toContain("LIMIT 10");
      expect(r.sql).toContain("OFFSET 0");
    }
  });
  it("builds with DISTINCT", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users" }],
      columns: [{ id: "c1", name: "users.country" }],
      distinct: true,
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toContain("SELECT DISTINCT users.country");
  });
  it("builds with JOIN", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [{ id: "c1", name: "u.name" }],
      joins: [{
        id: "j1", type: "INNER", table: "orders", alias: "o",
        leftTableId: "t1", leftColumn: "u.id", rightColumn: "o.user_id",
      }],
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toContain("INNER JOIN orders AS o ON u.id = o.user_id");
  });
  it("builds with explicit GROUP BY", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [
        { id: "c1", name: "u.country" },
        { id: "c2", aggregate: "COUNT", name: "*", alias: "n" },
      ],
      groupBy: [{ id: "g1", column: "u.country" }],
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toContain("GROUP BY u.country");
  });
  it("auto-infers GROUP BY when aggregate present and none explicit", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [
        { id: "c1", name: "u.country" },
        { id: "c2", aggregate: "COUNT", name: "*", alias: "n" },
      ],
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toContain("GROUP BY u.country");
  });
  it("builds with HAVING", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [
        { id: "c1", name: "u.country" },
        { id: "c2", aggregate: "COUNT", name: "*", alias: "n" },
      ],
      groupBy: [{ id: "g1", column: "u.country" }],
      having: [{ id: "h1", column: "n", operator: ">", value: "5", conjunction: "AND" }],
    };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toContain("HAVING n > 5");
  });
  it("respects MySQL dialect quoting", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "users", alias: "u" }],
      columns: [{ id: "c1", name: "u.select" }], // "select" is reserved → must quote
      where: [{ id: "w1", column: "u.select", operator: "=", value: "1", conjunction: "AND" }],
    };
    const r = buildSql(m, "mysql");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sql).toContain("`select`");
    }
  });
  it("respects SQL Server bracket quoting", () => {
    const m: QueryModel = {
      ...createEmptyModel(),
      tables: [{ id: "t1", name: "order" }], // reserved
      columns: [{ id: "c1", name: "order.id" }],
    };
    const r = buildSql(m, "sqlserver");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sql).toContain("FROM [order]");
      expect(r.sql).toContain("[order].id");
    }
  });
  it("returns error when no tables", () => {
    const m: QueryModel = { ...createEmptyModel() };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/table/i);
  });
  it("returns error when no columns", () => {
    const m: QueryModel = { ...createEmptyModel(), tables: [{ id: "t1", name: "u" }] };
    const r = buildSql(m, "ansi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/column/i);
  });
});

describe("visual-sql-query-builder presets", () => {
  it("has at least 3 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
  });
  it("every preset builds successfully", () => {
    for (const p of PRESETS) {
      const r = buildSql(p.model, "ansi");
      expect(r.ok, `preset ${p.id} should build`).toBe(true);
    }
  });
});

describe("visual-sql-query-builder schema import", () => {
  it("parses valid schema JSON", () => {
    const s = parseSchemaJson(SAMPLE_SCHEMA_JSON);
    expect(s.tables).toHaveLength(3);
    expect(s.tables[0].name).toBe("users");
    expect(s.tables[0].columns).toContain("id");
  });
  it("throws on malformed JSON", () => {
    expect(() => parseSchemaJson("not json")).toThrow();
  });
  it("throws when tables array missing", () => {
    expect(() => parseSchemaJson('{"foo": 1}')).toThrow();
  });
  it("modelFromSchema builds a starter model", () => {
    const s = parseSchemaJson(SAMPLE_SCHEMA_JSON);
    const m = modelFromSchema(s);
    expect(m.tables).toHaveLength(1);
    expect(m.columns.length).toBe(s.tables[0].columns.length);
  });
});

describe("visual-sql-query-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dialect: "ansi", sqlPreview: "SELECT 1",
      tables: ["users"], columnCount: 1, joinCount: 0, whereCount: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dialect: "ansi", sqlPreview: `SELECT ${i}`,
        tables: ["t"], columnCount: 1, joinCount: 0, whereCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dialect: "ansi", sqlPreview: "SELECT 1",
      tables: ["t"], columnCount: 1, joinCount: 0, whereCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("visual-sql-query-builder shareable URL", () => {
  it("encodeState/decodeState round-trip", () => {
    const m = createDefaultModel();
    const dialect: SqlDialect = "mysql";
    const encoded = encodeState(m, dialect);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.dialect).toBe(dialect);
    expect(decoded?.model.tables).toEqual(m.tables);
  });
  it("decodeState returns null for garbage", () => {
    expect(decodeState("!!!not-base64!!!")).toBeNull();
  });
  it("buildShareUrl produces a URL with q= param when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(createDefaultModel(), "ansi");
    expect(url).toContain("q=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips with buildShareUrl-encoded data", () => {
    const m = createDefaultModel();
    const dialect: SqlDialect = "postgresql";
    const encoded = encodeState(m, dialect);
    const hash = `#q=${encoded}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.model).not.toBeNull();
    expect(parsed.dialect).toBe(dialect);
  });
  it("parseShareUrl returns nulls for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.model).toBeNull();
    expect(p.dialect).toBeNull();
  });
  it("parseShareUrl returns nulls when no q param", () => {
    const p = parseShareUrl("foo=bar");
    expect(p.model).toBeNull();
  });
});
