/**
 * SQL EXPLAIN Plan Visualizer — pure logic.
 *
 * Parses EXPLAIN / EXPLAIN ANALYZE output from PostgreSQL (text + JSON),
 * MySQL (JSON), and SQL Server (XML), builds a normalized plan tree, then
 * detects bottlenecks and row-misestimates with plain-English advice.
 *
 * 100% client-side — no DOM, no network. Safe to unit-test.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PlanFormat =
  | "postgres-text"
  | "postgres-json"
  | "mysql-json"
  | "sqlserver-xml"
  | "unknown";

export interface PlanNode {
  /** Stable id (depth-index). */
  id: string;
  /** Node type as reported by the planner (e.g. "Seq Scan"). */
  nodeType: string;
  /** Schema-qualified relation name when applicable. */
  relationName?: string;
  /** Table alias. */
  alias?: string;
  // ---- estimates ----
  startupCost?: number;
  totalCost?: number;
  estimatedRows?: number;
  estimatedWidth?: number;
  // ---- actuals (EXPLAIN ANALYZE only) ----
  actualRows?: number;
  actualStartupTime?: number;
  actualTotalTime?: number;
  actualLoops?: number;
  // ---- buffers ----
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  sharedDirtiedBlocks?: number;
  sharedWrittenBlocks?: number;
  tempReadBlocks?: number;
  tempWrittenBlocks?: number;
  // ---- misc raw properties ----
  filter?: string;
  indexCond?: string;
  hashCond?: string;
  mergeCond?: string;
  joinType?: string;
  sortKey?: string[];
  extraInfo: Record<string, string>;
  // ---- tree ----
  children: PlanNode[];
  depth: number;
  // ---- computed ----
  totalTimePctOfRoot?: number;
  misestimateRatio?: number;
  /** Absolute time spent in this node (sum of subtree time, ms). */
  subtreeTime?: number;
}

export interface ParsedPlan {
  format: PlanFormat;
  root: PlanNode | null;
  executionTime?: number;
  planningTime?: number;
  warnings: string[];
  /** Flattened list of nodes in pre-order. */
  flat: PlanNode[];
  hasActuals: boolean;
}

export type ParseResult =
  | { ok: true; plan: ParsedPlan }
  | { ok: false; error: string };

export type Severity = "info" | "warning" | "critical";

export interface Finding {
  severity: Severity;
  nodeId: string;
  nodeType: string;
  relationName?: string;
  message: string;
  advice: string;
  /** Metric value used for sorting (e.g. pct of total time, or ratio). */
  metric: number;
}

export interface PlanStats {
  totalNodes: number;
  maxDepth: number;
  scanTypes: Record<string, number>;
  hasMisestimates: boolean;
  worstMisestimate?: { nodeId: string; ratio: number };
  totalTime?: number;
  executionTime?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SAMPLE_POSTGRES_TEXT = `Seq Scan on public.orders  (cost=0.00..35.50 rows=1550 width=68) (actual time=0.012..1.234 rows=5000 loops=1)
  Filter: (status = 'paid'::text)
  Rows Removed by Filter: 250
  ->  Hash Join  (cost=20.00..45.00 rows=100 width=100) (actual time=0.020..0.500 rows=100 loops=1)
        Hash Cond: (o.user_id = u.id)
        ->  Seq Scan on public.orders o  (cost=0.00..20.00 rows=1000 width=50) (actual time=0.005..0.200 rows=1000 loops=1)
        ->  Hash  (cost=10.00..10.00 rows=100 width=20) (actual time=0.005..0.005 rows=100 loops=1)
              ->  Index Scan using users_pkey on public.users u  (cost=0.15..10.00 rows=100 width=20) (actual time=0.002..0.003 rows=100 loops=1)
                    Index Cond: (id < 100)`;

export const SAMPLE_POSTGRES_JSON = JSON.stringify([
  {
    Plan: {
      "Node Type": "Seq Scan",
      "Relation Name": "orders",
      Schema: "public",
      Alias: "o",
      "Startup Cost": 0.0,
      "Total Cost": 35.5,
      "Plan Rows": 1550,
      "Plan Width": 68,
      "Actual Startup Time": 0.012,
      "Actual Total Time": 1.234,
      "Actual Rows": 5000,
      "Actual Loops": 1,
      Filter: "(status = 'paid'::text)",
      "Rows Removed by Filter": 250,
      Plans: [
        {
          "Node Type": "Hash Join",
          "Startup Cost": 20.0,
          "Total Cost": 45.0,
          "Plan Rows": 100,
          "Plan Width": 100,
          "Actual Startup Time": 0.02,
          "Actual Total Time": 0.5,
          "Actual Rows": 100,
          "Actual Loops": 1,
          "Hash Cond": "o.user_id = u.id",
          Plans: [
            {
              "Node Type": "Seq Scan",
              "Relation Name": "orders",
              Alias: "o",
              "Startup Cost": 0.0,
              "Total Cost": 20.0,
              "Plan Rows": 1000,
              "Plan Width": 50,
              "Actual Startup Time": 0.005,
              "Actual Total Time": 0.2,
              "Actual Rows": 1000,
              "Actual Loops": 1,
            },
            {
              "Node Type": "Hash",
              "Startup Cost": 10.0,
              "Total Cost": 10.0,
              "Plan Rows": 100,
              "Plan Width": 20,
              "Actual Startup Time": 0.005,
              "Actual Total Time": 0.005,
              "Actual Rows": 100,
              "Actual Loops": 1,
              Plans: [
                {
                  "Node Type": "Index Scan",
                  "Relation Name": "users",
                  Alias: "u",
                  "Startup Cost": 0.15,
                  "Total Cost": 10.0,
                  "Plan Rows": 100,
                  "Plan Width": 20,
                  "Actual Startup Time": 0.002,
                  "Actual Total Time": 0.003,
                  "Actual Rows": 100,
                  "Actual Loops": 1,
                  "Index Cond": "(id < 100)",
                },
              ],
            },
          ],
        },
      ],
    },
    "Execution Time": 1.5,
    "Planning Time": 0.2,
  },
], null, 2);

export const SAMPLE_MYSQL_JSON = JSON.stringify({
  query_block: {
    select_id: 1,
    cost_info: { query_cost: "10.00" },
    table: {
      table_name: "orders",
      access_type: "ALL",
      rows_examined_per_scan: 5400,
      rows_produced_per_join: 5400,
      filtered: "100.00",
      cost_info: {
        read_cost: "1.00",
        eval_cost: "0.50",
        prefix_cost: "1.50",
        data_read_per_join: "10K",
      },
      used_columns: ["id", "user_id", "status"],
    },
  },
}, null, 2);

export const SAMPLE_SQLSERVER_XML = `<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.5">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple>
          <QueryPlan>
            <RelOp NodeId="0" PhysicalOp="Clustered Index Scan" LogicalOp="Scan" EstimateRows="1550" EstimateIO="0.5" EstimateCPU="0.001" AvgRowSize="68" EstimatedTotalSubtreeCost="35.5">
              <Object Database="[db]" Schema="[dbo]" Table="[orders]" />
              <Predicate>
                <ScalarOperator><ScalarString>[status]=N'paid'</ScalarString></ScalarOperator>
              </Predicate>
            </RelOp>
          </QueryPlan>
        </StmtSimple>
      </Statements>
    </Batch>
  </BatchSequence>
</ShowPlanXML>`;

export const HOWTO_COLLECT = [
  "PostgreSQL (text): EXPLAIN (ANALYZE, BUFFERS, VERBOSE) SELECT ...;",
  "PostgreSQL (JSON): EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT ...;",
  "MySQL: EXPLAIN FORMAT=JSON SELECT ...; (or EXPLAIN ANALYZE SELECT ... on MySQL 8+)",
  "SQL Server: SET SHOWPLAN_XML ON; GO; <query>; (returns XML plan)",
  "Tip: Always run ANALYZE (Postgres) or UPDATE STATISTICS (SQL Server) first to avoid stale stats.",
];

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/** Auto-detect the plan format from raw input. */
export function detectFormat(input: string): PlanFormat {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";
  // SQL Server XML
  if (/^<\?xml|<ShowPlanXML/i.test(trimmed)) return "sqlserver-xml";
  // JSON variants
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data) && data[0] && typeof data[0] === "object" && "Plan" in data[0]) {
        return "postgres-json";
      }
      if (typeof data === "object" && data !== null && ("query_block" in data || "data" in data)) {
        return "mysql-json";
      }
      // Could still be postgres-json without array wrapper
      if (typeof data === "object" && data !== null && "Plan" in data) {
        return "postgres-json";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }
  // Postgres text — indented "Seq Scan", "Index Scan", "Hash Join" markers
  if (/(Seq Scan|Index Scan|Index Only Scan|Hash Join|Merge Join|Nested Loop|Bitmap|Sort|Aggregate|Hash|Gather|Limit|Append|Subquery Scan|Result|Materialize|Unique|WindowAgg|CTE Scan)/i.test(trimmed)) {
    return "postgres-text";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// PostgreSQL text parser
// ---------------------------------------------------------------------------

const PG_NODE_REGEX = /^(\s*(?:->|->>|=>)?\s*)?([A-Z][^()]+?)\s+on\s+(?:(\w+)\.)?(\w+)(?:\s+(\w+))?\s+\(cost=([0-9.]+)\.\.([0-9.]+)\s+rows=(\d+)\s+width=(\d+)\)(?:\s+\(actual time=([0-9.]+)\.\.([0-9.]+)\s+rows=(\d+)\s+loops=(\d+)\))?/;
const PG_NODE_REGEX_NO_ON = /^(\s*(?:->|->>|=>)?\s*)?([A-Z][^()]+?)\s+\(cost=([0-9.]+)\.\.([0-9.]+)\s+rows=(\d+)\s+width=(\d+)\)(?:\s+\(actual time=([0-9.]+)\.\.([0-9.]+)\s+rows=(\d+)\s+loops=(\d+)\))?/;

function indentLevel(line: string): number {
  // Count leading spaces; "->" indentation = 2 spaces per level in pg text.
  const m = /^(\s*)/.exec(line);
  if (!m) return 0;
  return Math.floor((m[1] || "").length / 2);
}

function parseParensInt(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseParensFloat(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pgTextParseNode(line: string, depth: number, idCounter: { n: number }): PlanNode | null {
  const onMatch = PG_NODE_REGEX.exec(line);
  let nodeType: string;
  let relationName: string | undefined;
  let alias: string | undefined;
  let startupCost: number | undefined;
  let totalCost: number | undefined;
  let estimatedRows: number | undefined;
  let estimatedWidth: number | undefined;
  let actualStartupTime: number | undefined;
  let actualTotalTime: number | undefined;
  let actualRows: number | undefined;
  let actualLoops: number | undefined;
  if (onMatch) {
    nodeType = onMatch[2].trim();
    const schema = onMatch[3];
    const table = onMatch[4];
    relationName = schema ? `${schema}.${table}` : table;
    alias = onMatch[5];
    startupCost = parseParensFloat(onMatch[6]);
    totalCost = parseParensFloat(onMatch[7]);
    estimatedRows = parseParensInt(onMatch[8]);
    estimatedWidth = parseParensInt(onMatch[9]);
    actualStartupTime = parseParensFloat(onMatch[10]);
    actualTotalTime = parseParensFloat(onMatch[11]);
    actualRows = parseParensInt(onMatch[12]);
    actualLoops = parseParensInt(onMatch[13]);
  } else {
    const noOnMatch = PG_NODE_REGEX_NO_ON.exec(line);
    if (!noOnMatch) return null;
    nodeType = noOnMatch[2].trim();
    startupCost = parseParensFloat(noOnMatch[3]);
    totalCost = parseParensFloat(noOnMatch[4]);
    estimatedRows = parseParensInt(noOnMatch[5]);
    estimatedWidth = parseParensInt(noOnMatch[6]);
    actualStartupTime = parseParensFloat(noOnMatch[7]);
    actualTotalTime = parseParensFloat(noOnMatch[8]);
    actualRows = parseParensInt(noOnMatch[9]);
    actualLoops = parseParensInt(noOnMatch[10]);
  }
  // Strip an optional "using <indexname>" suffix from the node type to keep it clean.
  const usingMatch = /^(.+?)\s+using\s+\S+$/i.exec(nodeType);
  if (usingMatch) nodeType = usingMatch[1].trim();
  return {
    id: `n${idCounter.n++}`,
    nodeType,
    relationName,
    alias,
    startupCost,
    totalCost,
    estimatedRows,
    estimatedWidth,
    actualStartupTime,
    actualTotalTime,
    actualRows,
    actualLoops,
    extraInfo: {},
    children: [],
    depth,
  };
}

function classifyPgDetailLine(line: string, node: PlanNode): void {
  const trimmed = line.trim();
  // "Filter: ..." / "Index Cond: ..." / "Hash Cond: ..." / "Sort Key: ..."
  const detailMatch = /^([A-Z][A-Za-z ]+):\s+(.*)$/.exec(trimmed);
  if (detailMatch) {
    const label = detailMatch[1].trim();
    const value = detailMatch[2].trim();
    switch (label) {
      case "Filter":
        node.filter = value;
        break;
      case "Index Cond":
        node.indexCond = value;
        break;
      case "Hash Cond":
        node.hashCond = value;
        break;
      case "Merge Cond":
        node.mergeCond = value;
        break;
      case "Sort Key":
        node.sortKey = value.split(",").map((s) => s.trim());
        break;
      case "Join Type":
        node.joinType = value;
        break;
      default:
        node.extraInfo[label] = value;
    }
  }
}

/** Parse PostgreSQL TEXT-format EXPLAIN output. */
export function parsePostgresText(input: string): ParseResult {
  const lines = input.split(/\r?\n/);
  const idCounter = { n: 0 };
  const stack: PlanNode[] = [];
  let root: PlanNode | null = null;
  const warnings: string[] = [];
  let executionTime: number | undefined;
  let planningTime: number | undefined;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    // Footer lines: "Execution Time: 1.234 ms" / "Planning Time: 0.2 ms"
    const execMatch = /^Execution Time:\s+([0-9.]+)\s*ms/i.exec(raw.trim());
    if (execMatch) {
      executionTime = Number(execMatch[1]);
      continue;
    }
    const planMatch = /^Planning Time:\s+([0-9.]+)\s*ms/i.exec(raw.trim());
    if (planMatch) {
      planningTime = Number(planMatch[1]);
      continue;
    }
    // Node lines: contain "cost="
    if (/cost=/.test(raw)) {
      const depth = indentLevel(raw);
      const node = pgTextParseNode(raw, depth, idCounter);
      if (!node) {
        warnings.push(`Could not parse line: ${raw.slice(0, 80)}`);
        continue;
      }
      if (stack.length === 0) {
        root = node;
        stack.push(node);
      } else {
        // Pop until we find a parent with depth less than ours.
        while (stack.length > 0 && (stack[stack.length - 1].depth >= depth)) {
          stack.pop();
        }
        if (stack.length === 0) {
          // Sibling of root — shouldn't happen but be defensive.
          warnings.push("Multiple root nodes detected; only first kept.");
          break;
        }
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
      continue;
    }
    // Detail lines attach to the current top-of-stack node.
    if (stack.length > 0) {
      classifyPgDetailLine(raw, stack[stack.length - 1]);
    }
  }
  if (!root) {
    return { ok: false, error: "No plan nodes found. Expected PostgreSQL TEXT format with 'cost=…' markers." };
  }
  const flat = flatten(root);
  const hasActuals = flat.some((n) => n.actualRows !== undefined);
  return { ok: true, plan: { format: "postgres-text", root, executionTime, planningTime, warnings, flat, hasActuals } };
}

// ---------------------------------------------------------------------------
// PostgreSQL JSON parser
// ---------------------------------------------------------------------------

interface PgJsonNode {
  [k: string]: unknown;
  Plans?: PgJsonNode[];
}

function buildNodeFromPgJson(j: PgJsonNode, depth: number, idCounter: { n: number }): PlanNode {
  const get = (k: string): unknown => j[k];
  const num = (k: string): number | undefined => {
    const v = get(k);
    return typeof v === "number" ? v : typeof v === "string" ? Number(v) : undefined;
  };
  const str = (k: string): string | undefined => {
    const v = get(k);
    return typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
  };
  const schema = str("Schema");
  let relationName = str("Relation Name") ?? str("Table Name");
  if (schema && relationName) relationName = `${schema}.${relationName}`;
  const node: PlanNode = {
    id: `n${idCounter.n++}`,
    nodeType: String(get("Node Type") ?? "Unknown"),
    relationName,
    alias: str("Alias"),
    startupCost: num("Startup Cost"),
    totalCost: num("Total Cost"),
    estimatedRows: num("Plan Rows"),
    estimatedWidth: num("Plan Width"),
    actualStartupTime: num("Actual Startup Time"),
    actualTotalTime: num("Actual Total Time"),
    actualRows: num("Actual Rows"),
    actualLoops: num("Actual Loops"),
    sharedHitBlocks: num("Shared Hit Blocks"),
    sharedReadBlocks: num("Shared Read Blocks"),
    sharedDirtiedBlocks: num("Shared Dirtied Blocks"),
    sharedWrittenBlocks: num("Shared Written Blocks"),
    tempReadBlocks: num("Temp Read Blocks"),
    tempWrittenBlocks: num("Temp Written Blocks"),
    filter: str("Filter"),
    indexCond: str("Index Cond"),
    hashCond: str("Hash Cond"),
    mergeCond: str("Merge Cond"),
    joinType: str("Join Type"),
    sortKey: Array.isArray(get("Sort Key")) ? (get("Sort Key") as string[]).map(String) : undefined,
    extraInfo: {},
    children: [],
    depth,
  };
  // Stash unknown keys into extraInfo
  for (const [k, v] of Object.entries(j)) {
    if ([
      "Node Type", "Relation Name", "Table Name", "Alias", "Schema",
      "Startup Cost", "Total Cost", "Plan Rows", "Plan Width",
      "Actual Startup Time", "Actual Total Time", "Actual Rows", "Actual Loops",
      "Shared Hit Blocks", "Shared Read Blocks", "Shared Dirtied Blocks", "Shared Written Blocks",
      "Temp Read Blocks", "Temp Written Blocks",
      "Filter", "Index Cond", "Hash Cond", "Merge Cond", "Join Type", "Sort Key",
      "Plans", "Parent Relationship", "Subplan Name",
    ].includes(k)) continue;
    if (v !== null && typeof v !== "object") node.extraInfo[k] = String(v);
  }
  const plans = j.Plans;
  if (Array.isArray(plans)) {
    node.children = plans.map((p) => buildNodeFromPgJson(p, depth + 1, idCounter));
  }
  return node;
}

/** Parse PostgreSQL JSON-format EXPLAIN output. */
export function parsePostgresJson(input: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  // Accept either a top-level array or a single object with "Plan".
  let planObj: PgJsonNode | undefined;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null && "Plan" in data[0]) {
    planObj = (data[0] as { Plan: PgJsonNode }).Plan;
  } else if (typeof data === "object" && data !== null && "Plan" in data) {
    planObj = (data as { Plan: PgJsonNode }).Plan;
  } else if (typeof data === "object" && data !== null && "Node Type" in data) {
    planObj = data as PgJsonNode;
  }
  if (!planObj) {
    return { ok: false, error: "JSON did not contain a 'Plan' field." };
  }
  const idCounter = { n: 0 };
  const root = buildNodeFromPgJson(planObj, 0, idCounter);
  const flat = flatten(root);
  const hasActuals = flat.some((n) => n.actualRows !== undefined);
  const warnings: string[] = [];
  let executionTime: number | undefined;
  let planningTime: number | undefined;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const top = data[0] as Record<string, unknown>;
    if (typeof top["Execution Time"] === "number") executionTime = top["Execution Time"];
    if (typeof top["Planning Time"] === "number") planningTime = top["Planning Time"];
  } else if (typeof data === "object" && data !== null) {
    const top = data as Record<string, unknown>;
    if (typeof top["Execution Time"] === "number") executionTime = top["Execution Time"];
    if (typeof top["Planning Time"] === "number") planningTime = top["Planning Time"];
  }
  return { ok: true, plan: { format: "postgres-json", root, executionTime, planningTime, warnings, flat, hasActuals } };
}

// ---------------------------------------------------------------------------
// MySQL JSON parser
// ---------------------------------------------------------------------------

interface MysqlBlock {
  [k: string]: unknown;
}

function buildNodeFromMysql(obj: MysqlBlock, depth: number, idCounter: { n: number }): PlanNode {
  const costInfo = (obj.cost_info ?? ({} as Record<string, unknown>)) as Record<string, unknown>;
  const num = (v: unknown): number | undefined => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };
  // Subqueries / nested tables
  const children: PlanNode[] = [];
  if (Array.isArray(obj.nested_loop)) {
    for (const nl of obj.nested_loop) {
      if (typeof nl === "object" && nl !== null) {
        children.push(buildNodeFromMysql(nl as MysqlBlock, depth + 1, idCounter));
      }
    }
  }
  if (obj.table && typeof obj.table === "object") {
    children.push(buildNodeFromMysql(obj.table as MysqlBlock, depth + 1, idCounter));
  }
  if (obj.query_block && typeof obj.query_block === "object") {
    children.push(buildNodeFromMysql(obj.query_block as MysqlBlock, depth + 1, idCounter));
  }
  if (Array.isArray(obj.ordering_operation)) {
    for (const op of obj.ordering_operation) {
      if (typeof op === "object" && op !== null) {
        children.push(buildNodeFromMysql(op as MysqlBlock, depth + 1, idCounter));
      }
    }
  }
  if (obj.grouping_operation && typeof obj.grouping_operation === "object") {
    children.push(buildNodeFromMysql(obj.grouping_operation as MysqlBlock, depth + 1, idCounter));
  }

  const isTable = "table_name" in obj;
  const isQueryBlock = "select_id" in obj;
  const nodeType = isTable
    ? accessTypeToNodeType(String(obj.access_type ?? "ALL"))
    : isQueryBlock
      ? "Query Block"
      : "Unknown";
  return {
    id: `n${idCounter.n++}`,
    nodeType,
    relationName: typeof obj.table_name === "string" ? obj.table_name : undefined,
    alias: typeof obj.as === "string" ? obj.as : undefined,
    estimatedRows: num(obj.rows_examined_per_scan) ?? num(obj.rows_produced_per_join),
    totalCost: num(costInfo.query_cost) ?? num(costInfo.prefix_cost),
    actualRows: num(obj.rows_examined_per_scan),
    actualLoops: 1,
    filter: typeof obj.used_columns === "object" ? undefined : (typeof obj.attached_condition === "string" ? obj.attached_condition : undefined),
    extraInfo: Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !["table_name", "access_type", "rows_examined_per_scan", "rows_produced_per_join", "cost_info", "as", "attached_condition", "nested_loop", "table", "query_block", "ordering_operation", "grouping_operation"].includes(k))
        .map(([k, v]) => [k, String(v)]),
    ),
    children,
    depth,
  };
}

function accessTypeToNodeType(access: string): string {
  const a = access.toUpperCase();
  switch (a) {
    case "ALL": return "Seq Scan";
    case "INDEX": return "Index Scan";
    case "RANGE": return "Index Scan";
    case "REF": return "Index Scan";
    case "EQ_REF": return "Index Scan";
    case "CONST": return "Index Scan";
    case "SYSTEM": return "Index Scan";
    default: return `Scan (${access})`;
  }
}

/** Parse MySQL EXPLAIN FORMAT=JSON output. */
export function parseMysqlJson(input: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  // Accept { "query_block": {...} } or wrap if MySQL wrapped in "data"
  const rootObj = (data && typeof data === "object" && "data" in (data as Record<string, unknown>))
    ? (data as Record<string, unknown>).data as MysqlBlock
    : (data as MysqlBlock);
  if (!rootObj || typeof rootObj !== "object") {
    return { ok: false, error: "MySQL JSON did not contain a query_block." };
  }
  const idCounter = { n: 0 };
  const root = buildNodeFromMysql(rootObj, 0, idCounter);
  const flat = flatten(root);
  const hasActuals = flat.some((n) => n.actualRows !== undefined);
  return { ok: true, plan: { format: "mysql-json", root, warnings: [], flat, hasActuals } };
}

// ---------------------------------------------------------------------------
// SQL Server XML parser (lightweight — uses regex; no DOM dependency)
// ---------------------------------------------------------------------------

interface XmlRelOp {
  nodeId: string;
  physicalOp: string;
  logicalOp: string;
  estimateRows: number | undefined;
  estimateIO: number | undefined;
  estimateCPU: number | undefined;
  avgRowSize: number | undefined;
  estimatedTotalSubtreeCost: number | undefined;
  objectDb?: string;
  objectSchema?: string;
  objectTable?: string;
  predicate?: string;
  children: XmlRelOp[];
}

const RELOP_RE = /<RelOp\b([^>]*)>([\s\S]*?)<\/RelOp>/g;
const RELOP_ATTR_RE = /(\w+)="([^"]*)"/g;
const OBJECT_RE = /<Object\b([^/]*)\/>/;
const SCALAR_RE = /<ScalarString>([\s\S]*?)<\/ScalarString>/;

function parseAttrs(attrStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  RELOP_ATTR_RE.lastIndex = 0;
  while ((m = RELOP_ATTR_RE.exec(attrStr)) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Extract top-level (non-nested) RelOp elements from inner XML. */
function splitRelOps(inner: string): { opening: string; body: string }[] {
  const out: { opening: string; body: string }[] = [];
  let i = 0;
  while (i < inner.length) {
    const start = inner.indexOf("<RelOp", i);
    if (start < 0) break;
    // Find the end of the opening tag.
    const tagEnd = inner.indexOf(">", start);
    if (tagEnd < 0) break;
    const opening = inner.slice(start, tagEnd + 1);
    // Self-closing?
    if (opening.endsWith("/>")) {
      out.push({ opening, body: "" });
      i = tagEnd + 1;
      continue;
    }
    // Match closing </RelOp> accounting for nesting.
    let depth = 1;
    let j = tagEnd + 1;
    while (j < inner.length && depth > 0) {
      const nextOpen = inner.indexOf("<RelOp", j);
      const nextClose = inner.indexOf("</RelOp>", j);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        j = inner.indexOf(">", nextOpen) + 1;
      } else {
        depth--;
        j = nextClose + "</RelOp>".length;
      }
    }
    const body = inner.slice(tagEnd + 1, j - "</RelOp>".length);
    out.push({ opening, body });
    i = j;
  }
  return out;
}

function parseRelOp(opening: string, body: string): XmlRelOp {
  const attrs = parseAttrs(opening.slice("<RelOp".length));
  const num = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const objMatch = OBJECT_RE.exec(body);
  let objectDb: string | undefined;
  let objectSchema: string | undefined;
  let objectTable: string | undefined;
  if (objMatch) {
    const objAttrs = parseAttrs(objMatch[1]);
    objectDb = objAttrs.Database?.replace(/^\[|\]$/g, "");
    objectSchema = objAttrs.Schema?.replace(/^\[|\]$/g, "");
    objectTable = objAttrs.Table?.replace(/^\[|\]$/g, "");
  }
  const scalarMatch = SCALAR_RE.exec(body);
  const predicate = scalarMatch ? scalarMatch[1].trim() : undefined;
  const childRelOps = splitRelOps(body);
  const children = childRelOps.map((c) => parseRelOp(c.opening, c.body));
  return {
    nodeId: attrs.NodeId ?? "0",
    physicalOp: attrs.PhysicalOp ?? "Unknown",
    logicalOp: attrs.LogicalOp ?? "Unknown",
    estimateRows: num(attrs.EstimateRows),
    estimateIO: num(attrs.EstimateIO),
    estimateCPU: num(attrs.EstimateCPU),
    avgRowSize: num(attrs.AvgRowSize),
    estimatedTotalSubtreeCost: num(attrs.EstimatedTotalSubtreeCost),
    objectDb,
    objectSchema,
    objectTable,
    predicate,
    children,
  };
}

function xmlRelOpToNode(op: XmlRelOp, depth: number, idCounter: { n: number }): PlanNode {
  const relationName = [op.objectSchema, op.objectTable].filter(Boolean).join(".") || undefined;
  return {
    id: `n${idCounter.n++}`,
    nodeType: `${op.physicalOp} (${op.logicalOp})`,
    relationName,
    estimatedRows: op.estimateRows,
    estimatedWidth: op.avgRowSize,
    totalCost: op.estimatedTotalSubtreeCost,
    startupCost: op.estimateCPU,
    filter: op.predicate,
    extraInfo: {},
    children: op.children.map((c) => xmlRelOpToNode(c, depth + 1, idCounter)),
    depth,
  };
}

/** Parse SQL Server SHOWPLAN_XML output. */
export function parseSqlServerXml(input: string): ParseResult {
  if (!/<ShowPlanXML/i.test(input) && !/<RelOp/i.test(input)) {
    return { ok: false, error: "Input does not look like SQL Server SHOWPLAN_XML." };
  }
  // Strip namespace declarations to simplify regex.
  const stripped = input.replace(/\sxmlns[^=]*="[^"]*"/g, "");
  // Find top-level RelOps (children of <QueryPlan>).
  const queryPlanMatch = /<QueryPlan[^>]*>([\s\S]*?)<\/QueryPlan>/.exec(stripped);
  let searchIn: string;
  if (queryPlanMatch) {
    searchIn = queryPlanMatch[1];
  } else {
    // Fall back: scan whole input for top-level RelOp tags.
    searchIn = stripped;
  }
  const relops = splitRelOps(searchIn);
  if (relops.length === 0) {
    return { ok: false, error: "No <RelOp> elements found in SQL Server XML." };
  }
  const idCounter = { n: 0 };
  const root = xmlRelOpToNode(parseRelOp(relops[0].opening, relops[0].body), 0, idCounter);
  const flat = flatten(root);
  const hasActuals = flat.some((n) => n.actualRows !== undefined);
  return { ok: true, plan: { format: "sqlserver-xml", root, warnings: [], flat, hasActuals } };
}

// ---------------------------------------------------------------------------
// Top-level parse entry — auto-detect
// ---------------------------------------------------------------------------

/** Parse EXPLAIN output, auto-detecting format unless forced. */
export function parsePlan(input: string, forceFormat?: PlanFormat): ParseResult {
  const fmt = forceFormat && forceFormat !== "unknown" ? forceFormat : detectFormat(input);
  switch (fmt) {
    case "postgres-text": return parsePostgresText(input);
    case "postgres-json": return parsePostgresJson(input);
    case "mysql-json": return parseMysqlJson(input);
    case "sqlserver-xml": return parseSqlServerXml(input);
    default:
      return { ok: false, error: "Could not auto-detect plan format. Try forcing a format or paste a valid EXPLAIN output." };
  }
}

// ---------------------------------------------------------------------------
// Tree utilities
// ---------------------------------------------------------------------------

/** Flatten the tree in pre-order. */
export function flatten(root: PlanNode): PlanNode[] {
  const out: PlanNode[] = [];
  const visit = (n: PlanNode) => {
    out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

/** Find a node by id. */
export function findNode(root: PlanNode, id: string): PlanNode | undefined {
  return flatten(root).find((n) => n.id === id);
}

/** Annotate each node with misestimate ratio (actualRows / estimatedRows). */
export function computeMisestimates(plan: ParsedPlan): ParsedPlan {
  if (!plan.root) return plan;
  const visit = (n: PlanNode) => {
    if (n.actualRows !== undefined && n.estimatedRows !== undefined && n.estimatedRows > 0) {
      n.misestimateRatio = n.actualRows / n.estimatedRows;
    }
    for (const c of n.children) visit(c);
  };
  visit(plan.root);
  return plan;
}

/** Annotate each node with totalTimePctOfRoot (relative to root's actualTotalTime). */
export function computeTimePercentages(plan: ParsedPlan): ParsedPlan {
  if (!plan.root || plan.root.actualTotalTime === undefined) return plan;
  const rootTime = plan.root.actualTotalTime;
  const visit = (n: PlanNode) => {
    if (n.actualTotalTime !== undefined) {
      n.totalTimePctOfRoot = (n.actualTotalTime / rootTime) * 100;
    }
    for (const c of n.children) visit(c);
  };
  visit(plan.root);
  return plan;
}

// ---------------------------------------------------------------------------
// Bottleneck + advice generation
// ---------------------------------------------------------------------------

const SEQ_SCAN_TYPES = new Set(["Seq Scan", "Table Scan", "Clustered Index Scan", "Clustered Index Scan (Scan)"]);
const MISESTIMATE_THRESHOLD = 10; // 10x off = misestimate
const HIGH_TIME_PCT = 30; // >30% of total time = bottleneck

/** Detects bottlenecks, misestimates, and bad scan choices; returns ranked findings. */
export function findBottlenecks(plan: ParsedPlan): Finding[] {
  const out: Finding[] = [];
  if (!plan.root) return out;
  for (const n of plan.flat) {
    // 1. Misestimate (rows far off the planner estimate)
    if (n.misestimateRatio !== undefined) {
      const ratio = n.misestimateRatio;
      const absRatio = Math.max(ratio, 1 / Math.max(ratio, 0.0001));
      if (absRatio >= MISESTIMATE_THRESHOLD) {
        out.push({
          severity: ratio > 1 ? "critical" : "warning",
          nodeId: n.id,
          nodeType: n.nodeType,
          relationName: n.relationName,
          message: `Row estimate was ${formatRatio(ratio)} off: estimated ${n.estimatedRows}, actual ${n.actualRows}.`,
          advice: ratio > 1
            ? "The planner under-estimated rows, which often leads to a bad join strategy. Run ANALYZE on the relevant table(s) to refresh statistics, or check for correlated predicates the planner can't model."
            : "The planner over-estimated rows, possibly wasting memory on a hash/sort. Run ANALYZE and consider removing redundant filters.",
          metric: absRatio,
        });
      }
    }
    // 2. Sequential scan on what looks like a big table (>1000 est rows)
    if (SEQ_SCAN_TYPES.has(n.nodeType) && n.estimatedRows !== undefined && n.estimatedRows > 1000) {
      out.push({
        severity: "warning",
        nodeId: n.id,
        nodeType: n.nodeType,
        relationName: n.relationName,
        message: `Sequential scan on ${n.relationName ?? "table"} with ~${n.estimatedRows.toLocaleString()} estimated rows.`,
        advice: `Consider an index on ${n.relationName ?? "this table"} covering the filter${n.filter ? ` (${n.filter})` : ""}. If the predicate is selective, a B-tree index will avoid the full scan. Use the SQL Index Advisor tool (#272) for a CREATE INDEX suggestion.`,
        metric: n.estimatedRows,
      });
    }
    // 3. High time share — only meaningful for non-root nodes; root is 100% by definition.
    if (n.depth > 0 && n.totalTimePctOfRoot !== undefined && n.totalTimePctOfRoot >= HIGH_TIME_PCT) {
      out.push({
        severity: "critical",
        nodeId: n.id,
        nodeType: n.nodeType,
        relationName: n.relationName,
        message: `${n.nodeType} consumes ${n.totalTimePctOfRoot.toFixed(1)}% of total execution time.`,
        advice: "This node is the dominant cost. Inspect its children — if a child is doing the real work, fix that first. Otherwise, consider rewriting the predicate or pre-aggregating data.",
        metric: n.totalTimePctOfRoot,
      });
    }
    // 4. Nested loop with many loops
    if (/Nested Loop/i.test(n.nodeType) && n.actualLoops !== undefined && n.actualLoops > 1000) {
      out.push({
        severity: "warning",
        nodeId: n.id,
        nodeType: n.nodeType,
        relationName: n.relationName,
        message: `Nested loop executed ${n.actualLoops.toLocaleString()} times — possible O(n*m) blowup.`,
        advice: "A nested loop is fine for small inputs but blows up at scale. Consider a hash join (Postgres may switch automatically with better statistics) or materialize the inner side.",
        metric: n.actualLoops,
      });
    }
    // 5. Sort spilling to disk
    if (/Sort/i.test(n.nodeType) && n.extraInfo["Sort Method"]) {
      const method = n.extraInfo["Sort Method"];
      if (/external/i.test(method)) {
        out.push({
          severity: "warning",
          nodeId: n.id,
          nodeType: n.nodeType,
          relationName: n.relationName,
          message: `Sort spilled to disk: ${method}.`,
          advice: "Increase work_mem (Postgres) or sort_buffer_size (MySQL) so the sort fits in memory, or add an index on the sort key to avoid sorting entirely.",
          metric: 1,
        });
      }
    }
    // 6. Hash Join building a huge hash table
    if (/Hash Join/i.test(n.nodeType) && n.extraInfo["Buckets"]) {
      out.push({
        severity: "info",
        nodeId: n.id,
        nodeType: n.nodeType,
        relationName: n.relationName,
        message: `Hash join bucket count: ${n.extraInfo["Buckets"]}.`,
        advice: "Postgres auto-sizes hash buckets. If this node is slow, check whether the inner side is larger than expected — often a misestimate upstream.",
        metric: 0.5,
      });
    }
  }
  // Rank: critical first, then by metric desc.
  out.sort((a, b) => {
    if (a.severity !== b.severity) {
      const ord: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
      return ord[a.severity] - ord[b.severity];
    }
    return b.metric - a.metric;
  });
  return out;
}

function formatRatio(r: number): string {
  if (r >= 1) return `${r.toFixed(1)}x`;
  return `${(1 / r).toFixed(1)}x`;
}

/** Plain-English summary of the whole plan (top 3 findings). */
export function generateAdvice(plan: ParsedPlan): string[] {
  const out: string[] = [];
  if (!plan.root) return out;
  const findings = findBottlenecks(plan);
  if (findings.length === 0) {
    out.push("No major bottlenecks detected. The plan looks healthy.");
    if (!plan.hasActuals) {
      out.push("Note: this is an EXPLAIN-only plan (no ANALYZE). Run EXPLAIN ANALYZE to enable row-misestimate detection and per-node timing.");
    }
    return out;
  }
  const top = findings.slice(0, 3);
  for (const f of top) {
    out.push(`[${f.severity.toUpperCase()}] ${f.nodeType}${f.relationName ? ` on ${f.relationName}` : ""}: ${f.message} → ${f.advice}`);
  }
  if (findings.length > top.length) {
    out.push(`…and ${findings.length - top.length} more finding(s). See the findings panel for the full list.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plan stats
// ---------------------------------------------------------------------------

/** Compute aggregate stats for a parsed plan. */
export function computeStats(plan: ParsedPlan): PlanStats {
  const scanTypes: Record<string, number> = {};
  let maxDepth = 0;
  let hasMisestimates = false;
  let worstMisestimate: { nodeId: string; ratio: number } | undefined;
  for (const n of plan.flat) {
    scanTypes[n.nodeType] = (scanTypes[n.nodeType] ?? 0) + 1;
    if (n.depth > maxDepth) maxDepth = n.depth;
    if (n.misestimateRatio !== undefined) {
      const absRatio = Math.max(n.misestimateRatio, 1 / Math.max(n.misestimateRatio, 0.0001));
      if (absRatio >= MISESTIMATE_THRESHOLD) hasMisestimates = true;
      if (!worstMisestimate || absRatio > worstMisestimate.ratio) {
        worstMisestimate = { nodeId: n.id, ratio: absRatio };
      }
    }
  }
  return {
    totalNodes: plan.flat.length,
    maxDepth,
    scanTypes,
    hasMisestimates,
    worstMisestimate,
    totalTime: plan.root?.actualTotalTime,
    executionTime: plan.executionTime,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render the plan as indented text (mirrors the PG TEXT format). */
export function renderTreeText(plan: ParsedPlan): string {
  if (!plan.root) return "";
  const lines: string[] = [];
  const visit = (n: PlanNode) => {
    const indent = "  ".repeat(n.depth);
    let line = indent;
    if (n.depth > 0) line += "-> ";
    line += n.nodeType;
    if (n.relationName) line += ` on ${n.relationName}`;
    if (n.alias && n.alias !== n.relationName) line += ` ${n.alias}`;
    const bits: string[] = [];
    if (n.startupCost !== undefined && n.totalCost !== undefined) {
      bits.push(`cost=${n.startupCost.toFixed(2)}..${n.totalCost.toFixed(2)}`);
    }
    if (n.estimatedRows !== undefined) bits.push(`rows=${n.estimatedRows}`);
    if (n.estimatedWidth !== undefined) bits.push(`width=${n.estimatedWidth}`);
    if (bits.length > 0) line += `  (${bits.join(" ")})`;
    const actualBits: string[] = [];
    if (n.actualStartupTime !== undefined && n.actualTotalTime !== undefined) {
      actualBits.push(`time=${n.actualStartupTime.toFixed(3)}..${n.actualTotalTime.toFixed(3)}`);
    }
    if (n.actualRows !== undefined) actualBits.push(`rows=${n.actualRows}`);
    if (n.actualLoops !== undefined) actualBits.push(`loops=${n.actualLoops}`);
    if (actualBits.length > 0) line += `  (actual ${actualBits.join(" ")})`;
    if (n.totalTimePctOfRoot !== undefined) line += `  [${n.totalTimePctOfRoot.toFixed(1)}%]`;
    if (n.misestimateRatio !== undefined && (n.misestimateRatio >= MISESTIMATE_THRESHOLD || n.misestimateRatio <= 1 / MISESTIMATE_THRESHOLD)) {
      line += `  ⚠ misestimate ${formatRatio(n.misestimateRatio)}`;
    }
    lines.push(line);
    if (n.filter) lines.push(`${indent}  Filter: ${n.filter}`);
    if (n.indexCond) lines.push(`${indent}  Index Cond: ${n.indexCond}`);
    if (n.hashCond) lines.push(`${indent}  Hash Cond: ${n.hashCond}`);
    if (n.sortKey) lines.push(`${indent}  Sort Key: ${n.sortKey.join(", ")}`);
    for (const [k, v] of Object.entries(n.extraInfo)) {
      lines.push(`${indent}  ${k}: ${v}`);
    }
    for (const c of n.children) visit(c);
  };
  visit(plan.root);
  if (plan.executionTime !== undefined) lines.push(`Execution Time: ${plan.executionTime} ms`);
  if (plan.planningTime !== undefined) lines.push(`Planning Time: ${plan.planningTime} ms`);
  return lines.join("\n");
}

/** Render findings as a Markdown report. */
export function renderMarkdown(plan: ParsedPlan): string {
  if (!plan.root) return "";
  const findings = findBottlenecks(plan);
  const stats = computeStats(plan);
  const lines: string[] = [];
  lines.push(`# EXPLAIN Plan Report`);
  lines.push("");
  lines.push(`- **Format:** ${plan.format}`);
  lines.push(`- **Total nodes:** ${stats.totalNodes}`);
  lines.push(`- **Max depth:** ${stats.maxDepth}`);
  if (plan.executionTime !== undefined) lines.push(`- **Execution time:** ${plan.executionTime} ms`);
  if (plan.hasActuals) lines.push(`- **Has actuals (ANALYZE):** yes`);
  else lines.push(`- **Has actuals (ANALYZE):** no (EXPLAIN-only)`);
  lines.push("");
  if (findings.length > 0) {
    lines.push(`## Findings (${findings.length})`);
    for (const f of findings) {
      lines.push("");
      lines.push(`### ${f.severity.toUpperCase()} — ${f.nodeType}${f.relationName ? ` on \`${f.relationName}\`` : ""}`);
      lines.push(`- ${f.message}`);
      lines.push(`- **Advice:** ${f.advice}`);
    }
  } else {
    lines.push(`## Findings`);
    lines.push(`No major bottlenecks detected.`);
  }
  lines.push("");
  lines.push(`## Scan types`);
  for (const [t, c] of Object.entries(stats.scanTypes)) {
    lines.push(`- \`${t}\`: ${c}`);
  }
  return lines.join("\n");
}

/** Render the plan tree as a JSON string (debug / round-trip). */
export function renderJson(plan: ParsedPlan): string {
  return JSON.stringify({
    format: plan.format,
    executionTime: plan.executionTime,
    planningTime: plan.planningTime,
    hasActuals: plan.hasActuals,
    warnings: plan.warnings,
    root: plan.root,
  }, null, 2);
}

/** Render the flat node list as CSV (one row per node). */
export function renderCsv(plan: ParsedPlan): string {
  const header = "id,depth,node_type,relation_name,estimated_rows,actual_rows,misestimate_ratio,total_cost,actual_total_time,pct_of_root,filter";
  const rows = plan.flat.map((n) => {
    const cells = [
      n.id,
      String(n.depth),
      csvEscape(n.nodeType),
      csvEscape(n.relationName ?? ""),
      n.estimatedRows ?? "",
      n.actualRows ?? "",
      n.misestimateRatio !== undefined ? n.misestimateRatio.toFixed(2) : "",
      n.totalCost !== undefined ? n.totalCost.toFixed(2) : "",
      n.actualTotalTime !== undefined ? n.actualTotalTime.toFixed(3) : "",
      n.totalTimePctOfRoot !== undefined ? n.totalTimePctOfRoot.toFixed(1) : "",
      csvEscape(n.filter ?? ""),
    ];
    return cells.join(",");
  });
  return [header, ...rows].join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Plan comparison (before / after)
// ---------------------------------------------------------------------------

export interface PlanDiff {
  executionTimeBefore?: number;
  executionTimeAfter?: number;
  executionTimeDelta?: number;
  executionTimePctChange?: number;
  nodesBefore: number;
  nodesAfter: number;
  findingsBefore: number;
  findingsAfter: number;
  findingsDelta: number;
  worstMisestimateBefore?: number;
  worstMisestimateAfter?: number;
  notes: string[];
}

/** Compare two plans and summarize the deltas. */
export function comparePlans(before: ParsedPlan, after: ParsedPlan): PlanDiff {
  const findingsBefore = findBottlenecks(before).length;
  const findingsAfter = findBottlenecks(after).length;
  const statsBefore = computeStats(before);
  const statsAfter = computeStats(after);
  const notes: string[] = [];
  if (before.executionTime !== undefined && after.executionTime !== undefined) {
    const delta = after.executionTime - before.executionTime;
    const pct = (delta / before.executionTime) * 100;
    notes.push(`Execution time ${delta >= 0 ? "increased" : "decreased"} by ${Math.abs(pct).toFixed(1)}%.`);
  } else {
    notes.push("One or both plans lack execution times — timing comparison unavailable.");
  }
  if (findingsAfter < findingsBefore) {
    notes.push(`Findings dropped from ${findingsBefore} to ${findingsAfter} — improvement.`);
  } else if (findingsAfter > findingsBefore) {
    notes.push(`Findings rose from ${findingsBefore} to ${findingsAfter} — regression.`);
  } else {
    notes.push("Finding count unchanged.");
  }
  return {
    executionTimeBefore: before.executionTime,
    executionTimeAfter: after.executionTime,
    executionTimeDelta:
      before.executionTime !== undefined && after.executionTime !== undefined
        ? after.executionTime - before.executionTime
        : undefined,
    executionTimePctChange:
      before.executionTime !== undefined && after.executionTime !== undefined && before.executionTime !== 0
        ? ((after.executionTime - before.executionTime) / before.executionTime) * 100
        : undefined,
    nodesBefore: statsBefore.totalNodes,
    nodesAfter: statsAfter.totalNodes,
    findingsBefore,
    findingsAfter,
    findingsDelta: findingsAfter - findingsBefore,
    worstMisestimateBefore: statsBefore.worstMisestimate?.ratio,
    worstMisestimateAfter: statsAfter.worstMisestimate?.ratio,
    notes,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-explain-plan-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  format: PlanFormat;
  totalNodes: number;
  executionTime?: number;
  findings: number;
  preview: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (encodes options only — never the plan)
// ---------------------------------------------------------------------------

export interface ShareOptions {
  format: PlanFormat;
  showAdvice: boolean;
  showBuffers: boolean;
  view: "tree" | "text";
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  format: "unknown",
  showAdvice: true,
  showBuffers: false,
  view: "tree",
};

export function buildShareUrl(opts: ShareOptions): string {
  const params = new URLSearchParams();
  params.set("fmt", opts.format);
  params.set("advice", String(opts.showAdvice));
  params.set("buffers", String(opts.showBuffers));
  params.set("view", opts.view);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_SHARE_OPTIONS };
  const params = new URLSearchParams(clean);
  const fmt = (params.get("fmt") ?? "unknown") as PlanFormat;
  const validFmts: PlanFormat[] = ["postgres-text", "postgres-json", "mysql-json", "sqlserver-xml", "unknown"];
  return {
    format: validFmts.includes(fmt) ? fmt : "unknown",
    showAdvice: params.get("advice") !== "false",
    showBuffers: params.get("buffers") === "true",
    view: params.get("view") === "text" ? "text" : "tree",
  };
}
