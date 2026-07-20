/**
 * SQL EXPLAIN Plan Visualizer — Tool Manifest.
 * Tool #271 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-explain-plan-visualizer",
  name: "SQL EXPLAIN Plan Visualizer",
  description:
    "Parse and visualize SQL EXPLAIN / EXPLAIN ANALYZE output (PostgreSQL text + JSON, MySQL JSON, SQL Server XML) as an interactive tree. Per-node scan type, cost, rows (estimate vs actual), timing, loops, buffers. Detects bottlenecks and row-misestimates with plain-English advice. 100% client-side; plans never leave the browser.",
  category: "developer",
  keywords: [
    "explain plan", "explain analyze", "sql explain visualizer",
    "postgres explain", "mysql explain", "query plan",
    "slow query", "query optimizer", "execution plan",
    "sql tuning", "plan tree", "pev2 alternative",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "SQL EXPLAIN Plan Visualizer — PostgreSQL, MySQL, SQL Server | UnQTools",
    faq: [
      {
        q: "Which EXPLAIN formats does this visualizer support?",
        a: "Four formats: PostgreSQL TEXT (the indented 'Seq Scan' style), PostgreSQL JSON (FORMAT JSON), MySQL JSON (EXPLAIN FORMAT=JSON), and SQL Server XML (SET SHOWPLAN_XML ON). The tool auto-detects the format from the paste; you can also force a dialect manually.",
      },
      {
        q: "How does bottleneck and misestimate detection work?",
        a: "After parsing, the tool walks the plan tree and flags: (1) nodes whose actual rows differ from the planner estimate by >10x — a misestimate, often a sign of stale statistics; (2) sequential scans on large tables that would benefit from an index; (3) nested-loop joins with many loops; (4) sort/hash nodes spilling to disk; (5) nodes consuming a high share of total time. Each finding comes with a plain-English explanation and a suggested fix.",
      },
      {
        q: "Does the visualizer need ANALYZE timing, or does it work on EXPLAIN-only plans too?",
        a: "Both. EXPLAIN-only plans (no ANALYZE) give estimates only — the tool still renders the tree, shows scan types and estimated costs/rows, and flags obvious issues like seq scans. With EXPLAIN ANALYZE, you also get actual rows, actual time, loops, and buffer stats, which unlock misestimate detection and the time heatmap.",
      },
      {
        q: "Are my plans uploaded to a server?",
        a: "Never. Parsing, tree building, and advice generation all run in your browser. Plans often contain schema details and row counts you may not want to share — this tool is private by design. History (last 20 plans) is stored in localStorage on this device only, and the shareable URL encodes only options in the fragment.",
      },
      {
        q: "What extra features does this tool have versus PEV2 / depesz / Datadog?",
        a: "(1) Multi-DBMS parsing (PostgreSQL text+JSON, MySQL JSON, SQL Server XML) in one tool. (2) Auto-detect format. (3) Tree + indented-text view toggle. (4) Per-node % of total time heatmap. (5) Misestimate badges (est vs actual). (6) Bottleneck finder with plain-English advice. (7) Buffer/IO breakdown when available. (8) Two-plan compare (before/after). (9) Sample plans + 'how to collect EXPLAIN' guide. (10) Copy plan as Markdown / JSON. (11) localStorage history (max 20). (12) 100% offline, no upload.",
      },
    ],
  },
  status: "done",
};
