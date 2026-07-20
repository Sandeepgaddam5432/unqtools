import { describe, it, expect, beforeEach } from "vitest";
import {
  JOIN_TYPES,
  JOIN_OPERATORS,
  PRESET_TABLES,
  formatValue,
  sqlEqual,
  sqlCompare,
  quoteIdent,
  runJoin,
  parseSqlJoin,
  splitTopLevelAnd,
  unquoteIdent,
  buildSql,
  renderAsciiDiagram,
  renderHtmlDiagram,
  joinTypeLabel,
  joinTypeDescription,
  educationalNote,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  type JoinType,
  type SampleTable,
  type JoinConfig,
  type HistoryEntry,
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

// ---------------------------------------------------------------------------
// Constants / presets
// ---------------------------------------------------------------------------

describe("sql-join-visualizer constants", () => {
  it("exposes 8 join types", () => {
    expect(JOIN_TYPES).toHaveLength(8);
    expect(JOIN_TYPES.map((t) => t.value)).toContain("inner");
    expect(JOIN_TYPES.map((t) => t.value)).toContain("self");
    expect(JOIN_TYPES.map((t) => t.value)).toContain("left-anti");
  });
  it("exposes 6 join operators", () => {
    expect(JOIN_OPERATORS).toHaveLength(6);
  });
  it("has 3 presets", () => {
    expect(PRESET_TABLES).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Value formatting and SQL semantics
// ---------------------------------------------------------------------------

describe("sql-join-visualizer formatValue", () => {
  it("formats NULL", () => { expect(formatValue(null)).toBe("NULL"); });
  it("formats undefined as NULL", () => { expect(formatValue(undefined)).toBe("NULL"); });
  it("formats string", () => { expect(formatValue("hi")).toBe("hi"); });
  it("formats number", () => { expect(formatValue(42)).toBe("42"); });
  it("formats boolean", () => { expect(formatValue(true)).toBe("true"); });
});

describe("sql-join-visualizer sqlEqual", () => {
  it("returns true for equal values", () => { expect(sqlEqual(5, 5)).toBe(true); });
  it("returns false for unequal values", () => { expect(sqlEqual(5, 6)).toBe(false); });
  it("returns null when either side is NULL", () => {
    expect(sqlEqual(null, 5)).toBeNull();
    expect(sqlEqual(5, null)).toBeNull();
    expect(sqlEqual(null, null)).toBeNull();
  });
});

describe("sql-join-visualizer sqlCompare", () => {
  it("handles equals", () => {
    expect(sqlCompare(5, 5, "=")).toBe(true);
    expect(sqlCompare(5, 6, "=")).toBe(false);
  });
  it("handles not-equals", () => {
    expect(sqlCompare(5, 6, "<>")).toBe(true);
    expect(sqlCompare(5, 5, "<>")).toBe(false);
  });
  it("handles less-than", () => {
    expect(sqlCompare(3, 5, "<")).toBe(true);
    expect(sqlCompare(5, 3, "<")).toBe(false);
  });
  it("handles greater-than-or-equal", () => {
    expect(sqlCompare(5, 5, ">=")).toBe(true);
    expect(sqlCompare(3, 5, ">=")).toBe(false);
  });
  it("returns false when either side is NULL", () => {
    expect(sqlCompare(null, 5, "=")).toBe(false);
    expect(sqlCompare(5, null, "<")).toBe(false);
  });
});

describe("sql-join-visualizer quoteIdent", () => {
  it("wraps in double-quotes", () => {
    expect(quoteIdent("users")).toBe('"users"');
  });
  it("escapes inner double-quotes", () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});

// ---------------------------------------------------------------------------
// Live join execution
// ---------------------------------------------------------------------------

const users: SampleTable = {
  name: "users",
  columns: ["id", "name"],
  rows: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Carol" },
  ],
};

const orders: SampleTable = {
  name: "orders",
  columns: ["id", "user_id", "total"],
  rows: [
    { id: 101, user_id: 1, total: 30 },
    { id: 102, user_id: 1, total: 50 },
    { id: 103, user_id: 2, total: 10 },
    { id: 104, user_id: 4, total: 99 },
  ],
};

const baseConfig: JoinConfig = {
  type: "inner",
  leftTable: "users",
  rightTable: "orders",
  conditions: [
    { leftTable: "users", leftColumn: "id", operator: "=", rightTable: "orders", rightColumn: "user_id" },
  ],
};

describe("sql-join-visualizer runJoin", () => {
  it("INNER JOIN returns only matching rows", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "inner" });
    // Alice(1) matches orders 101, 102 → 2 rows
    // Bob(2) matches order 103 → 1 row
    // Carol(3) has no match → 0 rows
    // Order 104 (user_id=4) has no user → 0 rows (INNER)
    expect(r.rows).toHaveLength(3);
    expect(r.stats.matched).toBe(3);
    expect(r.stats.leftUnmatched).toBe(1); // Carol
    expect(r.stats.rightUnmatched).toBe(1); // order 104
  });

  it("LEFT JOIN emits unmatched left rows NULL-filled", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "left" });
    // 3 matched + 1 unmatched left (Carol) = 4
    expect(r.rows).toHaveLength(4);
    const carolRow = r.rows.find((row) => row.leftRowIdx === 2 && row.rightRowIdx === -1);
    expect(carolRow).toBeDefined();
    expect(carolRow!.cells["orders.id"].value).toBeNull();
    expect(carolRow!.cells["orders.user_id"].value).toBeNull();
  });

  it("RIGHT JOIN emits unmatched right rows NULL-filled on left", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "right" });
    // 3 matched + 1 unmatched right (order 104) = 4
    expect(r.rows).toHaveLength(4);
    const order104Row = r.rows.find((row) => row.rightRowIdx === 3 && row.leftRowIdx === -1);
    expect(order104Row).toBeDefined();
    expect(order104Row!.cells["users.id"].value).toBeNull();
    expect(order104Row!.cells["users.name"].value).toBeNull();
  });

  it("FULL JOIN emits unmatched left + unmatched right", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "full" });
    // 3 matched + 1 unmatched left (Carol) + 1 unmatched right (order 104) = 5
    expect(r.rows).toHaveLength(5);
  });

  it("CROSS JOIN produces cartesian product", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "cross", conditions: [] });
    expect(r.rows).toHaveLength(12); // 3 users × 4 orders
  });

  it("LEFT ANTI returns left rows with no match", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "left-anti" });
    expect(r.rows).toHaveLength(1); // Carol only
    expect(r.rows[0].leftRowIdx).toBe(2);
    expect(r.rows[0].cells["users.name"].value).toBe("Carol");
    // Anti-join drops right columns
    expect(r.columns).toEqual(["users.id", "users.name"]);
  });

  it("LEFT SEMI returns left rows with at least one match", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "left-semi" });
    expect(r.rows).toHaveLength(2); // Alice, Bob
    expect(r.columns).toEqual(["users.id", "users.name"]);
  });

  it("duplicate keys multiply rows", () => {
    // Alice has 2 matching orders, so the result for INNER should have 2 rows for Alice.
    const r = runJoin(users, orders, { ...baseConfig, type: "inner" });
    const aliceRows = r.rows.filter((row) => row.leftRowIdx === 0);
    expect(aliceRows).toHaveLength(2);
  });

  it("NULL join keys never match (even to other NULLs)", () => {
    const left: SampleTable = {
      name: "a",
      columns: ["k", "v"],
      rows: [
        { k: 1, v: "x" },
        { k: null, v: "y" },
      ],
    };
    const right: SampleTable = {
      name: "b",
      columns: ["k", "w"],
      rows: [
        { k: 1, w: "match" },
        { k: null, w: "nullkey" },
      ],
    };
    const r = runJoin(left, right, {
      type: "inner",
      leftTable: "a",
      rightTable: "b",
      conditions: [{ leftTable: "a", leftColumn: "k", operator: "=", rightTable: "b", rightColumn: "k" }],
    });
    // Only k=1 matches. NULL=NULL does NOT match in SQL.
    expect(r.rows).toHaveLength(1);
    expect(r.stats.matched).toBe(1);
  });

  it("composite-key join (AND conditions)", () => {
    const left: SampleTable = {
      name: "a",
      columns: ["x", "y"],
      rows: [{ x: 1, y: 2 }, { x: 1, y: 3 }],
    };
    const right: SampleTable = {
      name: "b",
      columns: ["x", "y", "z"],
      rows: [{ x: 1, y: 2, z: "both" }],
    };
    const r = runJoin(left, right, {
      type: "inner",
      leftTable: "a",
      rightTable: "b",
      conditions: [
        { leftTable: "a", leftColumn: "x", operator: "=", rightTable: "b", rightColumn: "x" },
        { leftTable: "a", leftColumn: "y", operator: "=", rightTable: "b", rightColumn: "y" },
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].cells["b.z"].value).toBe("both");
  });

  it("non-equi join (less-than)", () => {
    const left: SampleTable = {
      name: "a",
      columns: ["x"],
      rows: [{ x: 1 }, { x: 5 }],
    };
    const right: SampleTable = {
      name: "b",
      columns: ["y"],
      rows: [{ y: 10 }, { y: 3 }],
    };
    const r = runJoin(left, right, {
      type: "inner",
      leftTable: "a",
      rightTable: "b",
      conditions: [{ leftTable: "a", leftColumn: "x", operator: "<", rightTable: "b", rightColumn: "y" }],
    });
    // x=1 < y=10 ✓, x=1 < y=3 ✓, x=5 < y=10 ✓, x=5 < y=3 ✗ → 3 matches
    expect(r.rows).toHaveLength(3);
  });

  it("SELF JOIN with aliases", () => {
    const employees: SampleTable = {
      name: "employees",
      columns: ["id", "name", "manager_id"],
      rows: [
        { id: 1, name: "CEO", manager_id: null },
        { id: 2, name: "VP", manager_id: 1 },
      ],
    };
    const r = runJoin(employees, employees, {
      type: "self",
      leftTable: "employees",
      rightTable: "employees",
      leftAlias: "e",
      rightAlias: "m",
      conditions: [
        { leftTable: "e", leftColumn: "manager_id", operator: "=", rightTable: "m", rightColumn: "id" },
      ],
    });
    // VP.manager_id=1 matches CEO.id=1 → 1 match
    // CEO.manager_id=NULL does not match anything
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].cells["m.name"].value).toBe("CEO");
  });

  it("records a step-by-step trace", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "inner" });
    // 3 left × 4 right = 12 candidate pairs
    expect(r.steps).toHaveLength(12);
    expect(r.steps.filter((s) => s.matched)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// SQL parsing
// ---------------------------------------------------------------------------

describe("sql-join-visualizer parseSqlJoin", () => {
  it("parses a simple INNER JOIN", () => {
    const sql = "SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id";
    const p = parseSqlJoin(sql);
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.type).toBe("inner");
      expect(p.config.leftTable).toBe("users");
      expect(p.config.rightTable).toBe("orders");
      expect(p.config.conditions).toHaveLength(1);
      expect(p.config.conditions[0].leftColumn).toBe("id");
      expect(p.config.conditions[0].operator).toBe("=");
      expect(p.config.conditions[0].rightColumn).toBe("user_id");
    }
  });

  it("parses LEFT JOIN", () => {
    const p = parseSqlJoin("SELECT * FROM a LEFT JOIN b ON a.x = b.y");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) expect(p.config.type).toBe("left");
  });

  it("parses RIGHT OUTER JOIN", () => {
    const p = parseSqlJoin("SELECT * FROM a RIGHT OUTER JOIN b ON a.x = b.y");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) expect(p.config.type).toBe("right");
  });

  it("parses FULL OUTER JOIN", () => {
    const p = parseSqlJoin("SELECT * FROM a FULL OUTER JOIN b ON a.x = b.y");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) expect(p.config.type).toBe("full");
  });

  it("parses CROSS JOIN", () => {
    const p = parseSqlJoin("SELECT * FROM a CROSS JOIN b");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.type).toBe("cross");
      expect(p.config.conditions).toHaveLength(0);
    }
  });

  it("parses table aliases", () => {
    const p = parseSqlJoin("SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.leftAlias).toBe("u");
      expect(p.config.rightAlias).toBe("o");
    }
  });

  it("detects self-join via aliases", () => {
    const p = parseSqlJoin("SELECT * FROM employees e INNER JOIN employees m ON e.manager_id = m.id");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.type).toBe("self");
      expect(p.config.leftAlias).toBe("e");
      expect(p.config.rightAlias).toBe("m");
    }
  });

  it("parses composite ON (AND conditions)", () => {
    const p = parseSqlJoin("SELECT * FROM a INNER JOIN b ON a.x = b.x AND a.y = b.y");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.conditions).toHaveLength(2);
    }
  });

  it("parses non-equi ON (<)", () => {
    const p = parseSqlJoin("SELECT * FROM a INNER JOIN b ON a.x < b.y");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.conditions[0].operator).toBe("<");
    }
  });

  it("returns error when no JOIN found", () => {
    const p = parseSqlJoin("SELECT * FROM users");
    expect(p.ok).toBe(false);
  });

  it("returns error when no FROM found", () => {
    const p = parseSqlJoin("SELECT 1");
    expect(p.ok).toBe(false);
  });

  it("returns error when not a SELECT", () => {
    const p = parseSqlJoin("DELETE FROM users");
    expect(p.ok).toBe(false);
  });

  it("strips comments before parsing", () => {
    const sql = "-- get users\nSELECT * FROM users u\nINNER JOIN orders o -- join\nON u.id = o.user_id";
    const p = parseSqlJoin(sql);
    expect(p.ok).toBe(true);
  });

  it("unquotes backtick identifiers", () => {
    const p = parseSqlJoin("SELECT * FROM `users` INNER JOIN `orders` ON `users`.id = `orders`.user_id");
    expect(p.ok).toBe(true);
    if (p.ok && p.config) {
      expect(p.config.leftTable).toBe("users");
      expect(p.config.rightTable).toBe("orders");
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers: splitTopLevelAnd, unquoteIdent
// ---------------------------------------------------------------------------

describe("sql-join-visualizer splitTopLevelAnd", () => {
  it("splits by top-level AND", () => {
    expect(splitTopLevelAnd("a = b AND c = d")).toEqual(["a = b", "c = d"]);
  });
  it("respects parentheses", () => {
    expect(splitTopLevelAnd("(a = b AND c = d) AND e = f")).toEqual(["(a = b AND c = d)", "e = f"]);
  });
  it("returns single for no AND", () => {
    expect(splitTopLevelAnd("a = b")).toEqual(["a = b"]);
  });
});

describe("sql-join-visualizer unquoteIdent", () => {
  it("strips backticks", () => { expect(unquoteIdent("`x`")).toBe("x"); });
  it("strips double-quotes", () => { expect(unquoteIdent('"x"')).toBe("x"); });
  it("strips square brackets", () => { expect(unquoteIdent("[x]")).toBe("x"); });
  it("passes through unquoted", () => { expect(unquoteIdent("x")).toBe("x"); });
});

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

describe("sql-join-visualizer buildSql", () => {
  it("builds INNER JOIN SQL", () => {
    const sql = buildSql(baseConfig);
    expect(sql).toContain("SELECT *");
    expect(sql).toContain("FROM \"users\"");
    expect(sql).toContain("INNER JOIN \"orders\"");
    expect(sql).toContain("ON \"users\".\"id\" = \"orders\".\"user_id\"");
  });
  it("builds CROSS JOIN without ON", () => {
    const sql = buildSql({ ...baseConfig, type: "cross", conditions: [] });
    expect(sql).toContain("CROSS JOIN");
    expect(sql).not.toContain("ON");
  });
  it("builds LEFT JOIN with ANSI quoting", () => {
    const sql = buildSql({ ...baseConfig, type: "left" });
    expect(sql).toContain("LEFT JOIN");
  });
  it("emits MySQL backticks when dialect=mysql", () => {
    const sql = buildSql(baseConfig, "mysql");
    expect(sql).toContain("`users`");
    expect(sql).toContain("`orders`");
  });
  it("emits Postgres double-quotes when dialect=postgres", () => {
    const sql = buildSql(baseConfig, "postgres");
    expect(sql).toContain('"users"');
  });
  it("uses aliases when present", () => {
    const sql = buildSql({
      type: "self",
      leftTable: "employees",
      rightTable: "employees",
      leftAlias: "e",
      rightAlias: "m",
      conditions: [{ leftTable: "e", leftColumn: "manager_id", operator: "=", rightTable: "m", rightColumn: "id" }],
    });
    expect(sql).toContain('"employees" AS "e"');
    expect(sql).toContain('"employees" AS "m"');
  });
});

// ---------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------

describe("sql-join-visualizer renderAsciiDiagram", () => {
  it("renders an ASCII diagram with table names and conditions", () => {
    const r = runJoin(users, orders, baseConfig);
    const ascii = renderAsciiDiagram(users, orders, baseConfig, r);
    expect(ascii).toContain("users");
    expect(ascii).toContain("orders");
    expect(ascii).toContain("users.id");
    expect(ascii).toContain("orders.user_id");
    expect(ascii).toContain("Output");
  });
  it("shows CROSS JOIN note when no conditions", () => {
    const r = runJoin(users, orders, { ...baseConfig, type: "cross", conditions: [] });
    const ascii = renderAsciiDiagram(users, orders, { ...baseConfig, type: "cross", conditions: [] }, r);
    expect(ascii).toContain("CROSS JOIN");
  });
});

describe("sql-join-visualizer renderHtmlDiagram", () => {
  it("renders an HTML diagram with table headers", () => {
    const r = runJoin(users, orders, baseConfig);
    const html = renderHtmlDiagram(users, orders, baseConfig, r);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>id</th>");
    expect(html).toContain("Alice");
    expect(html).toContain("ON:");
  });
  it("escapes HTML special chars", () => {
    const t: SampleTable = {
      name: "t",
      columns: ["x"],
      rows: [{ x: "<script>" }],
    };
    const r = runJoin(t, t, {
      type: "inner",
      leftTable: "t",
      rightTable: "t",
      conditions: [{ leftTable: "t", leftColumn: "x", operator: "=", rightTable: "t", rightColumn: "x" }],
    });
    const html = renderHtmlDiagram(t, t, {
      type: "inner",
      leftTable: "t",
      rightTable: "t",
      conditions: [{ leftTable: "t", leftColumn: "x", operator: "=", rightTable: "t", rightColumn: "x" }],
    }, r);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

// ---------------------------------------------------------------------------
// Educational note
// ---------------------------------------------------------------------------

describe("sql-join-visualizer educationalNote", () => {
  it("returns a non-empty string for each join type", () => {
    const types: JoinType[] = ["inner", "left", "right", "full", "cross", "left-anti", "left-semi", "self"];
    for (const t of types) {
      const note = educationalNote(t);
      expect(note.length).toBeGreaterThan(20);
    }
  });
  it("mentions row multiplication for INNER", () => {
    expect(educationalNote("inner").toLowerCase()).toContain("multiplication");
  });
  it("mentions NULL for LEFT", () => {
    expect(educationalNote("left").toLowerCase()).toContain("null");
  });
});

describe("sql-join-visualizer joinTypeLabel/Description", () => {
  it("returns label", () => {
    expect(joinTypeLabel("inner")).toBe("INNER JOIN");
    expect(joinTypeLabel("left-anti")).toBe("LEFT ANTI JOIN");
  });
  it("returns description", () => {
    expect(joinTypeDescription("inner").length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("sql-join-visualizer history", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "inner", leftTable: "a", rightTable: "b", leftRows: 3, rightRows: 4, outputRows: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "inner", leftTable: "a", rightTable: "b", leftRows: 1, rightRows: 1, outputRows: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "inner", leftTable: "a", rightTable: "b", leftRows: 1, rightRows: 1, outputRows: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("sql-join-visualizer share URL", () => {
  it("round-trips state via encodeState/decodeState", () => {
    const state = {
      type: "left" as JoinType,
      left: users,
      right: orders,
      config: baseConfig,
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("left");
    expect(decoded!.left.name).toBe("users");
    expect(decoded!.config.leftTable).toBe("users");
  });
  it("returns null for invalid encoded state", () => {
    expect(decodeState("!!!not-base64!!!")).toBeNull();
  });
  it("returns null for invalid type", () => {
    // Encode a state with an invalid type by tampering with JSON before encoding.
    const json = JSON.stringify({ type: "invalid", left: users, right: orders, config: baseConfig });
    const b64 = typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf8").toString("base64");
    expect(decodeState(b64)).toBeNull();
  });
  it("buildShareUrl returns query form when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ type: "inner", left: users, right: orders, config: baseConfig });
    expect(url).toContain("?s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips", () => {
    const state = { type: "inner" as JoinType, left: users, right: orders, config: baseConfig };
    const encoded = encodeState(state);
    const parsed = parseShareUrl(`#s=${encoded}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe("inner");
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

describe("sql-join-visualizer presets", () => {
  it("preset 0 (users-orders) LEFT JOIN produces 4 output rows", () => {
    const p = PRESET_TABLES[0];
    const r = runJoin(p.tables[0], p.tables[1], p.config);
    // 3 users: Alice (2 orders), Bob (1 order), Carol (0) → 3 + 1 = 4
    expect(r.rows).toHaveLength(4);
  });
  it("preset 1 (self-join employees) produces manager links", () => {
    const p = PRESET_TABLES[1];
    const r = runJoin(p.tables[0], p.tables[0], p.config);
    // 4 employees have a manager_id → 4 matches
    expect(r.rows).toHaveLength(4);
  });
  it("preset 2 (cross) produces 2×3=6 rows", () => {
    const p = PRESET_TABLES[2];
    const r = runJoin(p.tables[0], p.tables[1], p.config);
    expect(r.rows).toHaveLength(6);
  });
});

// Suppress unused-import lint for type-only imports.
export type _Unused = JoinType | SampleTable | JoinConfig | HistoryEntry;
