/**
 * SQL Index Advisor — Tool Manifest.
 * Tool #272 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-index-advisor",
  name: "SQL Index Advisor",
  description:
    "Paste a SQL query and (optionally) your table DDL; get column-ordered index recommendations with CREATE INDEX statements. Parses WHERE, JOIN, ORDER BY, and GROUP BY clauses; applies equality-before-range column ordering; detects redundant/overlapping existing indexes; warns about write-amplification, low-selectivity columns, and leading-wildcard LIKE. 100% client-side — no DB required.",
  category: "developer",
  keywords: [
    "sql index advisor", "index recommendation", "create index",
    "sql index", "composite index", "covering index", "partial index",
    "query optimization", "sql tuning", "index design", "which index to create",
  ],
  icon: "list-tree",
  requiresNetwork: false,
  seo: {
    title: "SQL Index Advisor — Paste Query + DDL, Get CREATE INDEX | UnQTools",
    faq: [
      {
        q: "How does the index advisor decide which columns to recommend?",
        a: "We parse the query's WHERE, JOIN ON, ORDER BY, and GROUP BY clauses. Equality predicates (=, IN) on indexed columns become leading columns; range predicates (<, >, BETWEEN, LIKE prefix) become trailing columns; ORDER BY / GROUP BY columns become trailing keys. We then group per-table and emit composite CREATE INDEX statements in the correct column order. The result is the same heuristic a senior DBA would apply.",
      },
      {
        q: "Why equality columns before range columns?",
        a: "A B-tree index can be used for both equality and range lookups, but only if equality columns come first. With idx(a, b) and `WHERE a = 1 AND b > 5`, the index first narrows to a=1 then scans b>5. With idx(b, a) the same query can only use the index for the b>5 range, then must re-check a=1 on every row. Equality-first ordering maximizes index selectivity.",
      },
      {
        q: "Does the advisor consider my existing indexes?",
        a: "Yes — paste your DDL (CREATE TABLE + CREATE INDEX statements) alongside the query. We parse existing indexes and flag recommendations that are redundant (already covered) or overlapping (a longer existing index already serves the query). We also identify covering-index opportunities (INCLUDE columns) when the SELECT list is small enough to fit.",
      },
      {
        q: "What edge cases does the advisor handle?",
        a: "Leading-wildcard LIKE (`%foo`) cannot use a B-tree index — we flag it and suggest a trigram/GIN index (Postgres) or full-text. Functions on columns (`LOWER(name) = 'foo'`) need an expression index — we suggest one. OR clauses and low-selectivity columns (booleans, gender) trigger a caveat that an index may not help. We never recommend without explaining the trade-off.",
      },
      {
        q: "Are my queries or schema uploaded to a server?",
        a: "Never. Parsing, index design, and CREATE INDEX generation all run in your browser. History (last 20 analyses) is stored in localStorage on this device only. The shareable URL encodes only options in the fragment. There's an honest banner: 'Heuristic advice — validate with EXPLAIN on real data (use the EXPLAIN Plan Visualizer, #271).'",
      },
    ],
  },
  status: "done",
};
