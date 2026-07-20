import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_POSTGRES_TEXT,
  SAMPLE_POSTGRES_JSON,
  SAMPLE_MYSQL_JSON,
  SAMPLE_SQLSERVER_XML,
  HOWTO_COLLECT,
  detectFormat,
  parsePostgresText,
  parsePostgresJson,
  parseMysqlJson,
  parseSqlServerXml,
  parsePlan,
  flatten,
  findNode,
  computeMisestimates,
  computeTimePercentages,
  findBottlenecks,
  generateAdvice,
  computeStats,
  renderTreeText,
  renderMarkdown,
  renderCsv,
  renderJson,
  comparePlans,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  DEFAULT_SHARE_OPTIONS,
  type PlanFormat,
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

describe("sql-explain constants", () => {
  it("ships 4 sample plans", () => {
    expect(SAMPLE_POSTGRES_TEXT).toContain("Seq Scan");
    expect(SAMPLE_POSTGRES_JSON).toContain('"Node Type": "Seq Scan"');
    expect(SAMPLE_MYSQL_JSON).toContain("query_block");
    expect(SAMPLE_SQLSERVER_XML).toContain("ShowPlanXML");
  });
  it("ships how-to-collect tips", () => {
    expect(HOWTO_COLLECT.length).toBeGreaterThanOrEqual(4);
    expect(HOWTO_COLLECT.some((s) => s.includes("PostgreSQL"))).toBe(true);
    expect(HOWTO_COLLECT.some((s) => s.includes("MySQL"))).toBe(true);
    expect(HOWTO_COLLECT.some((s) => s.includes("SQL Server"))).toBe(true);
  });
  it("has default share options", () => {
    expect(DEFAULT_SHARE_OPTIONS.showAdvice).toBe(true);
    expect(DEFAULT_SHARE_OPTIONS.view).toBe("tree");
  });
});

describe("sql-explain detectFormat", () => {
  it("detects postgres-text", () => {
    expect(detectFormat(SAMPLE_POSTGRES_TEXT)).toBe("postgres-text");
  });
  it("detects postgres-json", () => {
    expect(detectFormat(SAMPLE_POSTGRES_JSON)).toBe("postgres-json");
  });
  it("detects mysql-json", () => {
    expect(detectFormat(SAMPLE_MYSQL_JSON)).toBe("mysql-json");
  });
  it("detects sqlserver-xml", () => {
    expect(detectFormat(SAMPLE_SQLSERVER_XML)).toBe("sqlserver-xml");
  });
  it("returns unknown for empty input", () => {
    expect(detectFormat("")).toBe("unknown");
  });
  it("returns unknown for garbage", () => {
    expect(detectFormat("hello world this is not a plan")).toBe("unknown");
  });
});

describe("sql-explain parsePostgresText", () => {
  it("parses the sample plan", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.format).toBe("postgres-text");
      expect(r.plan.root).not.toBeNull();
      expect(r.plan.root!.nodeType).toBe("Seq Scan");
      expect(r.plan.root!.relationName).toBe("public.orders");
      expect(r.plan.flat.length).toBeGreaterThan(1);
    }
  });
  it("captures filter on a node", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const filterNode = r.plan.flat.find((n) => n.filter);
      expect(filterNode).toBeDefined();
      expect(filterNode!.filter).toContain("status");
    }
  });
  it("captures index cond", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const idxNode = r.plan.flat.find((n) => n.indexCond);
      expect(idxNode).toBeDefined();
      expect(idxNode!.indexCond).toContain("id < 100");
    }
  });
  it("captures hash cond", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const hj = r.plan.flat.find((n) => n.nodeType === "Hash Join");
      expect(hj).toBeDefined();
      expect(hj!.hashCond).toContain("user_id");
    }
  });
  it("detects actuals from ANALYZE", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.hasActuals).toBe(true);
      expect(r.plan.root!.actualRows).toBe(5000);
    }
  });
  it("builds a nested tree", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Root has at least one child (Hash Join)
      expect(r.plan.root!.children.length).toBeGreaterThan(0);
      const hj = r.plan.root!.children[0];
      expect(hj.nodeType).toBe("Hash Join");
      // Hash Join has children
      expect(hj.children.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("fails on empty input", () => {
    const r = parsePostgresText("");
    expect(r.ok).toBe(false);
  });
  it("parses EXPLAIN-only plan (no actuals)", () => {
    const input = `Index Scan using users_pkey on public.users  (cost=0.15..8.17 rows=1 width=10)
  Index Cond: (id = 1)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.hasActuals).toBe(false);
      expect(r.plan.root!.nodeType).toBe("Index Scan");
      expect(r.plan.root!.estimatedRows).toBe(1);
    }
  });
});

describe("sql-explain parsePostgresJson", () => {
  it("parses nested json plan", () => {
    const r = parsePostgresJson(SAMPLE_POSTGRES_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.root!.nodeType).toBe("Seq Scan");
      expect(r.plan.root!.actualRows).toBe(5000);
      expect(r.plan.executionTime).toBe(1.5);
      expect(r.plan.planningTime).toBe(0.2);
      expect(r.plan.flat.length).toBeGreaterThan(3);
    }
  });
  it("handles single-object json (no array)", () => {
    const obj = JSON.parse(SAMPLE_POSTGRES_JSON)[0];
    const r = parsePostgresJson(JSON.stringify(obj));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.root).not.toBeNull();
  });
  it("fails on invalid json", () => {
    const r = parsePostgresJson("{not valid json");
    expect(r.ok).toBe(false);
  });
  it("fails on json without Plan field", () => {
    const r = parsePostgresJson('{"foo": 1}');
    expect(r.ok).toBe(false);
  });
  it("stashes unknown properties into extraInfo", () => {
    const input = JSON.stringify([{
      Plan: {
        "Node Type": "Seq Scan",
        "Relation Name": "t",
        "Startup Cost": 0,
        "Total Cost": 1,
        "Plan Rows": 1,
        "Plan Width": 1,
        "Weird Custom Property": "abc",
      },
    }]);
    const r = parsePostgresJson(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.root!.extraInfo["Weird Custom Property"]).toBe("abc");
    }
  });
});

describe("sql-explain parseMysqlJson", () => {
  it("parses mysql json plan", () => {
    const r = parseMysqlJson(SAMPLE_MYSQL_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.format).toBe("mysql-json");
      expect(r.plan.root).not.toBeNull();
      // We descend into query_block then table; flat should include at least one node.
      expect(r.plan.flat.length).toBeGreaterThan(0);
      const table = r.plan.flat.find((n) => n.relationName === "orders");
      expect(table).toBeDefined();
      expect(table!.estimatedRows).toBeGreaterThan(0);
    }
  });
  it("fails on invalid json", () => {
    const r = parseMysqlJson("not json");
    expect(r.ok).toBe(false);
  });
});

describe("sql-explain parseSqlServerXml", () => {
  it("parses sqlserver xml plan", () => {
    const r = parseSqlServerXml(SAMPLE_SQLSERVER_XML);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.format).toBe("sqlserver-xml");
      expect(r.plan.root).not.toBeNull();
      expect(r.plan.root!.nodeType).toContain("Clustered Index Scan");
      expect(r.plan.root!.relationName).toContain("orders");
      expect(r.plan.root!.estimatedRows).toBe(1550);
    }
  });
  it("fails on non-xml input", () => {
    const r = parseSqlServerXml("Seq Scan on users");
    expect(r.ok).toBe(false);
  });
});

describe("sql-explain parsePlan (auto-detect)", () => {
  it("auto-detects postgres-text", () => {
    const r = parsePlan(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.format).toBe("postgres-text");
  });
  it("auto-detects postgres-json", () => {
    const r = parsePlan(SAMPLE_POSTGRES_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.format).toBe("postgres-json");
  });
  it("auto-detects mysql-json", () => {
    const r = parsePlan(SAMPLE_MYSQL_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.format).toBe("mysql-json");
  });
  it("auto-detects sqlserver-xml", () => {
    const r = parsePlan(SAMPLE_SQLSERVER_XML);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.format).toBe("sqlserver-xml");
  });
  it("forces a format when override is given", () => {
    // Pass postgres-text sample but force mysql-json parsing — should fail (not JSON).
    const r = parsePlan(SAMPLE_POSTGRES_TEXT, "mysql-json");
    expect(r.ok).toBe(false);
  });
  it("fails on truly unrecognizable input", () => {
    const r = parsePlan("this is not a plan");
    expect(r.ok).toBe(false);
  });
});

describe("sql-explain tree utilities", () => {
  it("flatten returns pre-order list", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const flat = flatten(r.plan.root!);
      // First is root, last is a leaf
      expect(flat[0]).toBe(r.plan.root);
      expect(flat.length).toBe(r.plan.flat.length);
    }
  });
  it("findNode locates by id", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const first = r.plan.flat[0];
      const found = findNode(r.plan.root!, first.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(first.id);
    }
  });
});

describe("sql-explain misestimate + time computation", () => {
  it("computes misestimate ratios", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      const root = r.plan.root!;
      // root: est 1550, actual 5000 → ratio ~3.2
      expect(root.misestimateRatio).toBeCloseTo(5000 / 1550, 1);
    }
  });
  it("computes time percentages of root", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeTimePercentages(r.plan);
      expect(r.plan.root!.totalTimePctOfRoot).toBeCloseTo(100, 1);
    }
  });
});

describe("sql-explain findBottlenecks", () => {
  it("flags sequential scans on large tables", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const findings = findBottlenecks(r.plan);
      const seqScan = findings.find((f) => /Sequential scan/i.test(f.message));
      expect(seqScan).toBeDefined();
    }
  });
  it("flags large row misestimates", () => {
    // Build a plan where actual >> estimated.
    const input = `Seq Scan on public.orders  (cost=0.00..35.50 rows=10 width=68) (actual time=0.012..1.234 rows=100000 loops=1)
  Filter: (status = 'paid'::text)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const findings = findBottlenecks(r.plan);
      const mis = findings.find((f) => /Row estimate/i.test(f.message));
      expect(mis).toBeDefined();
      expect(mis!.severity).toBe("critical");
    }
  });
  it("flags high-time-share nodes", () => {
    // Root Hash Join time is 100ms; child Seq Scan takes 95ms (95% of root).
    const input = `Hash Join  (cost=0.00..35.50 rows=2000 width=68) (actual time=0.012..100.000 rows=2000 loops=1)
  ->  Seq Scan on public.orders  (cost=0.00..20.00 rows=1000 width=50) (actual time=0.005..95.000 rows=1000 loops=1)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const findings = findBottlenecks(r.plan);
      const t = findings.find((f) => /consumes.*% of total execution time/i.test(f.message));
      expect(t).toBeDefined();
    }
  });
  it("returns empty for an empty plan", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const emptyPlan = { ...r.plan, root: null, flat: [] };
      expect(findBottlenecks(emptyPlan)).toEqual([]);
    }
  });
});

describe("sql-explain generateAdvice", () => {
  it("gives advice on plans with findings", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const advice = generateAdvice(r.plan);
      expect(advice.length).toBeGreaterThan(0);
    }
  });
  it("reports healthy plan when no findings", () => {
    const input = `Index Scan using users_pkey on public.users  (cost=0.15..8.17 rows=1 width=10) (actual time=0.002..0.003 rows=1 loops=1)\n  Index Cond: (id = 1)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const advice = generateAdvice(r.plan);
      expect(advice[0]).toContain("No major bottlenecks");
    }
  });
  it("warns when plan lacks actuals", () => {
    const input = `Index Scan using users_pkey on public.users  (cost=0.15..8.17 rows=1 width=10)
  Index Cond: (id = 1)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const advice = generateAdvice(r.plan);
      expect(advice.some((s) => s.includes("EXPLAIN-only"))).toBe(true);
    }
  });
});

describe("sql-explain computeStats", () => {
  it("computes plan stats", () => {
    // Construct a plan with a clear 10x+ misestimate so hasMisestimates is true.
    const input = `Seq Scan on public.orders  (cost=0.00..35.50 rows=10 width=68) (actual time=0.012..1.234 rows=10000 loops=1)`;
    const r = parsePostgresText(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      const stats = computeStats(r.plan);
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.maxDepth).toBe(0);
      expect(stats.scanTypes["Seq Scan"]).toBe(1);
      expect(stats.hasMisestimates).toBe(true);
      expect(stats.worstMisestimate).toBeDefined();
    }
  });
});

describe("sql-explain renderers", () => {
  it("renderTreeText produces indented output", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const text = renderTreeText(r.plan);
      expect(text).toContain("Seq Scan on public.orders");
      expect(text).toContain("Filter:");
      expect(text.split("\n").length).toBeGreaterThan(3);
    }
  });
  it("renderTreeText includes execution time footer when present", () => {
    const r = parsePostgresJson(SAMPLE_POSTGRES_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const text = renderTreeText(r.plan);
      expect(text).toContain("Execution Time: 1.5 ms");
    }
  });
  it("renderMarkdown produces a markdown report", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
      const md = renderMarkdown(r.plan);
      expect(md).toContain("# EXPLAIN Plan Report");
      expect(md).toContain("## Findings");
    }
  });
  it("renderCsv produces a CSV", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const csv = renderCsv(r.plan);
      expect(csv).toContain("id,depth,node_type");
      expect(csv.split("\n").length).toBeGreaterThan(r.plan.flat.length);
    }
  });
  it("renderJson produces valid JSON", () => {
    const r = parsePostgresText(SAMPLE_POSTGRES_TEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const json = renderJson(r.plan);
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe("postgres-text");
      expect(parsed.root.nodeType).toBe("Seq Scan");
    }
  });
});

describe("sql-explain comparePlans", () => {
  it("compares two plans and reports deltas", () => {
    const beforeR = parsePostgresJson(SAMPLE_POSTGRES_JSON);
    const afterR = parsePostgresJson(
      JSON.stringify([{
        Plan: {
          "Node Type": "Index Scan",
          "Relation Name": "orders",
          "Startup Cost": 0.15,
          "Total Cost": 5.0,
          "Plan Rows": 100,
          "Plan Width": 68,
          "Actual Startup Time": 0.002,
          "Actual Total Time": 0.5,
          "Actual Rows": 100,
          "Actual Loops": 1,
          "Index Cond": "(status = 'paid')",
        },
        "Execution Time": 0.8,
        "Planning Time": 0.1,
      }]),
    );
    expect(beforeR.ok).toBe(true);
    expect(afterR.ok).toBe(true);
    if (beforeR.ok && afterR.ok) {
      const diff = comparePlans(beforeR.plan, afterR.plan);
      expect(diff.executionTimeBefore).toBe(1.5);
      expect(diff.executionTimeAfter).toBe(0.8);
      expect(diff.executionTimePctChange).toBeLessThan(0);
      expect(diff.notes.length).toBeGreaterThan(0);
    }
  });
});

describe("sql-explain history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, format: "postgres-text", totalNodes: 4, executionTime: 1.5,
      findings: 2, preview: "Seq Scan...",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, format: "postgres-text", totalNodes: 1, findings: 0, preview: "p" + i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, format: "postgres-text", totalNodes: 1, findings: 0, preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-explain share URL", () => {
  it("builds share URL with options encoded", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      format: "postgres-text",
      showAdvice: true,
      showBuffers: false,
      view: "tree",
    });
    expect(url).toContain("fmt=postgres-text");
    expect(url).toContain("advice=true");
    expect(url).toContain("view=tree");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("fmt=postgres-json&advice=false&buffers=true&view=text");
    expect(parsed.format).toBe("postgres-json");
    expect(parsed.showAdvice).toBe(false);
    expect(parsed.showBuffers).toBe(true);
    expect(parsed.view).toBe("text");
  });
  it("returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_SHARE_OPTIONS);
  });
  it("filters out invalid format", () => {
    const parsed = parseShareUrl("fmt=invalid&advice=true&view=tree");
    expect(parsed.format).toBe("unknown");
  });
});

// Suppress unused-import lint
export type _Unused = PlanFormat | ShareOptions;
