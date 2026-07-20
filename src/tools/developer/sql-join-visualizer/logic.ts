/**
 * SQL Join Visualizer — pure logic.
 *
 * Parse SQL JOIN clauses, run joins against editable sample tables
 * entirely in-browser (no DB / no sql.js), and produce row-accurate
 * visualizations (ASCII + HTML diagrams) showing table relationships,
 * join types, and join conditions. 100% client-side — no DOM, no network.
 *
 * Design principles:
 *  - Pure functions only. Deterministic: same tables + condition + type
 *    → same result + same visualization.
 *  - NULL join keys never match (per ANSI SQL), not even to other NULLs.
 *  - Row multiplication is preserved: a left row with N matching right
 *    rows produces N result rows (the 'Venn hides this' problem).
 *  - Every result row carries a trace showing which left row + which
 *    right row it came from (or NULL on either side), so the visualizer
 *    can render an honest, row-level matching diagram.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type JoinType =
  | "inner"
  | "left"
  | "right"
  | "full"
  | "cross"
  | "left-anti"
  | "left-semi"
  | "self";

export type JoinOperator = "=" | "<>" | "<" | "<=" | ">" | ">=";

export interface SampleRow {
  /** Column-name → value. Missing keys are treated as NULL. */
  [column: string]: unknown;
}

export interface SampleTable {
  name: string;
  columns: string[];
  rows: SampleRow[];
}

export interface JoinCondition {
  /** Left table name (or alias for self-join). */
  leftTable: string;
  leftColumn: string;
  operator: JoinOperator;
  /** Right table name (or alias for self-join). */
  rightTable: string;
  rightColumn: string;
}

export interface JoinConfig {
  type: JoinType;
  leftTable: string;
  rightTable: string;
  /** For self-join: alias for the left occurrence and right occurrence. */
  leftAlias?: string;
  rightAlias?: string;
  conditions: JoinCondition[];
  /** Optional columns to project; if empty, all columns are emitted. */
  select?: string[];
}

export interface ResultCell {
  value: unknown;
  /** Source table for this cell (or null if NULL-filled). */
  source: string | null;
}

export interface ResultRow {
  /** Map of "table.column" → ResultCell. */
  cells: Record<string, ResultCell>;
  /** Index of the contributing left row, or -1 if NULL-filled. */
  leftRowIdx: number;
  /** Index of the contributing right row, or -1 if NULL-filled. */
  rightRowIdx: number;
  /** Did this row match the ON condition? (false for NULL-fills) */
  matched: boolean;
}

export interface JoinResult {
  rows: ResultRow[];
  /** All "table.column" keys in the output, in order. */
  columns: string[];
  /** Diagnostic counters. */
  stats: {
    leftInput: number;
    rightInput: number;
    matched: number;
    leftUnmatched: number;
    rightUnmatched: number;
    output: number;
  };
  /** Step-by-step matching trace for the animation. */
  steps: MatchStep[];
}

export interface MatchStep {
  leftRowIdx: number;
  rightRowIdx: number;
  /** Whether the condition evaluated true for this pair. */
  matched: boolean;
  /** Human-readable reason (e.g. "NULL key — no match", "5 = 5"). */
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const JOIN_TYPES: ReadonlyArray<{ value: JoinType; label: string; description: string }> = [
  { value: "inner", label: "INNER JOIN", description: "Only rows where the ON condition matches both sides." },
  { value: "left", label: "LEFT [OUTER] JOIN", description: "All left rows + matching right rows (NULL-filled if no match)." },
  { value: "right", label: "RIGHT [OUTER] JOIN", description: "All right rows + matching left rows (NULL-filled if no match)." },
  { value: "full", label: "FULL [OUTER] JOIN", description: "All rows from both sides, NULL-filled where unmatched." },
  { value: "cross", label: "CROSS JOIN", description: "Cartesian product: every left row × every right row. No ON clause." },
  { value: "left-anti", label: "LEFT ANTI JOIN", description: "Left rows with NO match on the right (right columns dropped)." },
  { value: "left-semi", label: "LEFT SEMI JOIN", description: "Left rows with AT LEAST ONE match (right columns dropped)." },
  { value: "self", label: "SELF JOIN", description: "A table joined to itself using two aliases." },
];

export const JOIN_OPERATORS: ReadonlyArray<{ value: JoinOperator; label: string }> = [
  { value: "=", label: "=" },
  { value: "<>", label: "<>" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
];

// ---------------------------------------------------------------------------
// Preset sample tables
// ---------------------------------------------------------------------------

export const PRESET_TABLES: ReadonlyArray<{ id: string; label: string; tables: SampleTable[]; config: JoinConfig }> = [
  {
    id: "users-orders",
    label: "Users × Orders (one-to-many)",
    tables: [
      {
        name: "users",
        columns: ["id", "name"],
        rows: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Carol" },
        ],
      },
      {
        name: "orders",
        columns: ["id", "user_id", "total"],
        rows: [
          { id: 101, user_id: 1, total: 30 },
          { id: 102, user_id: 1, total: 50 },
          { id: 103, user_id: 2, total: 10 },
          { id: 104, user_id: 4, total: 99 },
        ],
      },
    ],
    config: {
      type: "left",
      leftTable: "users",
      rightTable: "orders",
      conditions: [
        { leftTable: "users", leftColumn: "id", operator: "=", rightTable: "orders", rightColumn: "user_id" },
      ],
    },
  },
  {
    id: "dept-emp-self",
    label: "Employees self-join (manager)",
    tables: [
      {
        name: "employees",
        columns: ["id", "name", "manager_id"],
        rows: [
          { id: 1, name: "CEO", manager_id: null },
          { id: 2, name: "VP Sales", manager_id: 1 },
          { id: 3, name: "VP Eng", manager_id: 1 },
          { id: 4, name: "Sales Rep", manager_id: 2 },
          { id: 5, name: "Engineer", manager_id: 3 },
        ],
      },
    ],
    config: {
      type: "self",
      leftTable: "employees",
      rightTable: "employees",
      leftAlias: "e",
      rightAlias: "m",
      conditions: [
        { leftTable: "e", leftColumn: "manager_id", operator: "=", rightTable: "m", rightColumn: "id" },
      ],
    },
  },
  {
    id: "tags-m2m",
    label: "Posts × Tags (many-to-many)",
    tables: [
      {
        name: "posts",
        columns: ["id", "title"],
        rows: [
          { id: 1, title: "Hello" },
          { id: 2, title: "World" },
        ],
      },
      {
        name: "tags",
        columns: ["id", "name"],
        rows: [
          { id: 10, name: "intro" },
          { id: 11, name: "tech" },
          { id: 12, name: "news" },
        ],
      },
    ],
    config: {
      type: "cross",
      leftTable: "posts",
      rightTable: "tags",
      conditions: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a value for display. NULL → "NULL". */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Compare two values under SQL semantics: NULLs never equal anything. */
export function sqlEqual(a: unknown, b: unknown): boolean | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return a === b;
}

/** Apply a comparison operator under SQL semantics. NULL → no match. */
export function sqlCompare(a: unknown, b: unknown, op: JoinOperator): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  switch (op) {
    case "=": return a === b;
    case "<>": return a !== b;
    case "<": return (a as number) < (b as number);
    case "<=": return (a as number) <= (b as number);
    case ">": return (a as number) > (b as number);
    case ">=": return (a as number) >= (b as number);
  }
}

/** Quote an identifier for SQL output (double-quotes). */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ---------------------------------------------------------------------------
// Live join execution (no DB needed)
// ---------------------------------------------------------------------------

/**
 * Execute a join locally against sample tables.
 * Returns the result rows + a step-by-step matching trace.
 */
export function runJoin(
  left: SampleTable,
  right: SampleTable,
  config: JoinConfig,
): JoinResult {
  // For self-join, the right table is the same as the left, but we use
  // aliases to disambiguate columns in the output.
  const leftName = config.leftAlias ?? config.leftTable;
  const rightName = config.rightAlias ?? config.rightTable;

  const leftCols = left.columns.map((c) => `${leftName}.${c}`);
  const rightCols = right.columns.map((c) => `${rightName}.${c}`);

  // For LEFT ANTI / SEMI, the output is left-only.
  const isLeftOnly = config.type === "left-anti" || config.type === "left-semi";
  const outputCols = isLeftOnly ? leftCols : [...leftCols, ...rightCols];

  const rows: ResultRow[] = [];
  const steps: MatchStep[] = [];
  let matched = 0;
  let leftUnmatched = 0;
  let rightUnmatched = 0;

  // Helper: emit a row pairing.
  const emit = (
    leftRowIdx: number,
    rightRowIdx: number,
    isMatched: boolean,
  ): void => {
    const leftRow = leftRowIdx >= 0 ? left.rows[leftRowIdx] : null;
    const rightRow = rightRowIdx >= 0 ? right.rows[rightRowIdx] : null;
    const cells: Record<string, ResultCell> = {};
    for (const c of left.columns) {
      const key = `${leftName}.${c}`;
      cells[key] = {
        value: leftRow ? leftRow[c] : null,
        source: leftRow ? leftName : null,
      };
    }
    if (!isLeftOnly) {
      for (const c of right.columns) {
        const key = `${rightName}.${c}`;
        cells[key] = {
          value: rightRow ? rightRow[c] : null,
          source: rightRow ? rightName : null,
        };
      }
    }
    rows.push({ cells, leftRowIdx, rightRowIdx, matched: isMatched });
  };

  // Helper: evaluate conditions for a left+right pair.
  const evaluateConditions = (
    leftRow: SampleRow | null,
    rightRow: SampleRow | null,
  ): { ok: boolean; reasons: string[] } => {
    if (config.conditions.length === 0) {
      return { ok: true, reasons: ["no condition (CROSS-style)"] };
    }
    const reasons: string[] = [];
    let ok = true;
    for (const cond of config.conditions) {
      // For self-join, leftRow is for the left alias and rightRow is for
      // the right alias. cond.leftTable could be either alias.
      const leftValue = leftRow ? leftRow[cond.leftColumn] : null;
      const rightValue = rightRow ? rightRow[cond.rightColumn] : null;
      const match = sqlCompare(leftValue, rightValue, cond.operator);
      reasons.push(
        `${formatValue(leftValue)} ${cond.operator} ${formatValue(rightValue)} → ${match ? "true" : "false"}`,
      );
      if (!match) ok = false;
    }
    return { ok, reasons };
  };

  // CROSS JOIN: emit every combination unconditionally.
  if (config.type === "cross") {
    for (let li = 0; li < left.rows.length; li++) {
      for (let ri = 0; ri < right.rows.length; ri++) {
        emit(li, ri, true);
        matched++;
        steps.push({
          leftRowIdx: li,
          rightRowIdx: ri,
          matched: true,
          reason: "CROSS: every combination emitted",
        });
      }
    }
    return {
      rows,
      columns: outputCols,
      stats: {
        leftInput: left.rows.length,
        rightInput: right.rows.length,
        matched,
        leftUnmatched: 0,
        rightUnmatched: 0,
        output: rows.length,
      },
      steps,
    };
  }

  // For each left row, find matching right rows.
  const matchedRightRows = new Set<number>();
  for (let li = 0; li < left.rows.length; li++) {
    const leftRow = left.rows[li];
    let foundAny = false;
    for (let ri = 0; ri < right.rows.length; ri++) {
      const rightRow = right.rows[ri];
      const evalRes = evaluateConditions(leftRow, rightRow);
      const isMatch = evalRes.ok;
      steps.push({
        leftRowIdx: li,
        rightRowIdx: ri,
        matched: isMatch,
        reason: evalRes.reasons.join(" AND "),
      });
      if (isMatch) {
        foundAny = true;
        matchedRightRows.add(ri);
        matched++;
        if (config.type !== "left-anti" && config.type !== "left-semi") {
          emit(li, ri, true);
        }
      }
    }
    if (!foundAny) {
      leftUnmatched++;
      // LEFT, FULL, ANTI: emit left row (with NULLs for right in non-anti).
      if (config.type === "left" || config.type === "full" || config.type === "left-anti") {
        // For all three: emit the left row. For LEFT/FULL the right side is
        // NULL-filled; for ANTI the right columns are dropped (handled by the
        // isLeftOnly flag in emit()).
        emit(li, -1, false);
      }
    } else {
      // LEFT SEMI: emit the left row once (we already emitted above for non-semi).
      if (config.type === "left-semi") {
        emit(li, -1, true);
      }
    }
  }

  // For RIGHT / FULL: also emit unmatched right rows.
  // For other join types, we still compute rightUnmatched as an informational
  // count of right rows that never matched anything.
  const totalRightUnmatched = right.rows.length - matchedRightRows.size;
  if (config.type === "right" || config.type === "full") {
    // For RIGHT join, we need to redo the matching from the right side
    // because the order of output rows matters (right-first for RIGHT).
    // But to keep it simple and consistent with how the trace was built
    // (left-outer iteration), we'll emit unmatched right rows at the end.
    // This matches PostgreSQL's typical output ordering.
    for (let ri = 0; ri < right.rows.length; ri++) {
      if (!matchedRightRows.has(ri)) {
        rightUnmatched++;
        // For RIGHT JOIN: emit right row with NULL left.
        // For FULL JOIN: emit right row with NULL left.
        emit(-1, ri, false);
      }
    }
  } else {
    rightUnmatched = totalRightUnmatched;
  }

  // For RIGHT join: we want the matched rows in a different order — right-first.
  // But to keep the trace consistent, we'll reorder the rows array: unmatched
  // right rows come first, then matched rows in iteration order. This is a
  // simplification; real SQL doesn't guarantee any order without ORDER BY.
  if (config.type === "right") {
    const matchedRows = rows.filter((r) => r.matched);
    const unmatchedRightRows = rows.filter((r) => !r.matched && r.rightRowIdx >= 0);
    const unmatchedLeftRows = rows.filter((r) => !r.matched && r.leftRowIdx >= 0);
    // For RIGHT JOIN: prefer unmatched right rows first, then matched, then (no unmatched left in RIGHT).
    rows.length = 0;
    rows.push(...unmatchedRightRows, ...matchedRows);
    void unmatchedLeftRows;
  }

  return {
    rows,
    columns: outputCols,
    stats: {
      leftInput: left.rows.length,
      rightInput: right.rows.length,
      matched,
      leftUnmatched,
      rightUnmatched,
      output: rows.length,
    },
    steps,
  };
}

// ---------------------------------------------------------------------------
// SQL JOIN clause parsing (for users who paste their own SQL)
// ---------------------------------------------------------------------------

export interface ParsedSqlJoin {
  ok: boolean;
  error?: string;
  config?: JoinConfig;
}

/**
 * Parse a SQL SELECT statement's FROM + JOIN clauses into a JoinConfig.
 * Supports a single left table and one or more JOIN clauses (only the
 * first join is consumed — the visualizer is two-table oriented).
 */
export function parseSqlJoin(sql: string): ParsedSqlJoin {
  if (!sql || !sql.trim()) return { ok: false, error: "No SQL provided." };
  // Strip comments and normalise whitespace.
  const cleaned = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const upper = cleaned.toUpperCase();

  // Must start with SELECT.
  if (!upper.startsWith("SELECT")) {
    return { ok: false, error: "Expected statement to start with SELECT." };
  }

  // Find FROM keyword.
  const fromIdx = upper.indexOf(" FROM ");
  if (fromIdx === -1) {
    return { ok: false, error: "Expected FROM clause." };
  }

  // Find the first JOIN keyword (or end).
  const joinRe = /\b(INNER\s+JOIN|LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|FULL\s+(?:OUTER\s+)?JOIN|CROSS\s+JOIN|JOIN)\b/i;
  const joinMatch = cleaned.slice(fromIdx).match(joinRe);
  if (!joinMatch) {
    return { ok: false, error: "No JOIN clause found." };
  }
  const joinStart = fromIdx + joinMatch.index!;

  // Extract left table: text between FROM and the JOIN keyword.
  const leftPart = cleaned.slice(fromIdx + 6, joinStart).trim();
  const leftTableRe = /^([\w"`\[\]]+)(?:\s+(?:AS\s+)?([\w"`\[\]]+))?/i;
  const lm = leftPart.match(leftTableRe);
  if (!lm) return { ok: false, error: `Could not parse left table: "${leftPart}".` };
  const leftTable = unquoteIdent(lm[1]);
  const leftAlias = lm[2] ? unquoteIdent(lm[2]) : undefined;

  // Map the join keyword to JoinType.
  const joinKwUpper = joinMatch[1].toUpperCase().replace(/\s+/g, " ");
  let type: JoinType;
  if (joinKwUpper === "INNER JOIN" || joinKwUpper === "JOIN") type = "inner";
  else if (joinKwUpper.startsWith("LEFT")) type = "left";
  else if (joinKwUpper.startsWith("RIGHT")) type = "right";
  else if (joinKwUpper.startsWith("FULL")) type = "full";
  else if (joinKwUpper.startsWith("CROSS")) type = "cross";
  else type = "inner";

  // Extract right table: text after the JOIN keyword.
  const afterJoin = cleaned.slice(joinStart + joinMatch[0].length).trim();
  const rightTableRe = /^([\w"`\[\]]+)(?:\s+(?:AS\s+)?([\w"`\[\]]+))?/i;
  const rm = afterJoin.match(rightTableRe);
  if (!rm) return { ok: false, error: `Could not parse right table after JOIN.` };
  const rightTable = unquoteIdent(rm[1]);
  const rightAlias = rm[2] ? unquoteIdent(rm[2]) : undefined;

  // Detect self-join (same table joined to itself with aliases).
  if (leftTable === rightTable && leftAlias && rightAlias) {
    type = "self";
  }

  // Extract ON conditions (if not CROSS JOIN).
  const conditions: JoinCondition[] = [];
  if (type !== "cross") {
    const onIdx = upper.indexOf(" ON ", fromIdx);
    if (onIdx !== -1 && onIdx > joinStart) {
      // Everything between ON and the next top-level clause (WHERE, GROUP BY, ORDER BY, LIMIT, end).
      const onStart = onIdx + 4;
      const afterOn = cleaned.slice(onStart);
      const endMatch = afterOn.match(/\b(WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|UNION|;|$)\b/i);
      const onEnd = endMatch && endMatch.index !== undefined ? endMatch.index : afterOn.length;
      const onText = afterOn.slice(0, onEnd).trim();

      // Split by AND (top-level — we don't respect parens for simplicity).
      const condParts = splitTopLevelAnd(onText);
      for (const cp of condParts) {
        const condMatch = cp.match(
          /([\w"`\[\]]+)\.([\w"`\[\]]+)\s*(=|<>|<=|>=|<|>)\s*([\w"`\[\]]+)\.([\w"`\[\]]+)/,
        );
        if (condMatch) {
          conditions.push({
            leftTable: unquoteIdent(condMatch[1]),
            leftColumn: unquoteIdent(condMatch[2]),
            operator: condMatch[3] as JoinOperator,
            rightTable: unquoteIdent(condMatch[4]),
            rightColumn: unquoteIdent(condMatch[5]),
          });
        }
      }
    }
  }

  return {
    ok: true,
    config: {
      type,
      leftTable,
      rightTable,
      leftAlias,
      rightAlias,
      conditions,
    },
  };
}

/** Split a string by top-level AND (case-insensitive), respecting parentheses. */
export function splitTopLevelAnd(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  let i = 0;
  const upper = input.toUpperCase();
  while (i < input.length) {
    if (input[i] === "(") depth++;
    if (input[i] === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && upper.startsWith(" AND ", i)) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = "";
      i += 5;
      continue;
    }
    current += input[i];
    i++;
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

/** Strip surrounding identifier quotes. */
export function unquoteIdent(s: string): string {
  const t = s.trim();
  if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  return t;
}

// ---------------------------------------------------------------------------
// SQL generation (build a SQL string from a JoinConfig)
// ---------------------------------------------------------------------------

export function buildSql(config: JoinConfig, dialect: "ansi" | "mysql" | "postgres" = "ansi"): string {
  // ANSI SQL uses double-quotes for identifiers (the SQL standard).
  const q = dialect === "mysql" ? (s: string) => `\`${s}\`` : (s: string) => `"${s}"`;
  const joinKw = (() => {
    switch (config.type) {
      case "inner": return "INNER JOIN";
      case "left": return "LEFT JOIN";
      case "right": return "RIGHT JOIN";
      case "full": return "FULL OUTER JOIN";
      case "cross": return "CROSS JOIN";
      case "left-anti": return "LEFT JOIN"; // emulated
      case "left-semi": return "INNER JOIN"; // emulated
      case "self": return "INNER JOIN";
    }
  })();

  const leftRef = config.leftAlias
    ? `${q(config.leftTable)} AS ${q(config.leftAlias)}`
    : q(config.leftTable);
  const rightRef = config.rightAlias
    ? `${q(config.rightTable)} AS ${q(config.rightAlias)}`
    : q(config.rightTable);

  let on = "";
  if (config.type !== "cross" && config.conditions.length > 0) {
    on = " ON " + config.conditions
      .map((c) => `${q(c.leftTable)}.${q(c.leftColumn)} ${c.operator} ${q(c.rightTable)}.${q(c.rightColumn)}`)
      .join(" AND ");
  }

  let select = "SELECT *";
  if (config.type === "left-anti") {
    select = `SELECT ${q(config.leftAlias ?? config.leftTable)}.*`;
  } else if (config.type === "left-semi") {
    select = `SELECT DISTINCT ${q(config.leftAlias ?? config.leftTable)}.*`;
  } else if (config.select && config.select.length > 0) {
    select = "SELECT " + config.select.map((s) => q(s)).join(", ");
  }

  const note = config.type === "left-anti" || config.type === "left-semi"
    ? `-- ${config.type.toUpperCase()} is emulated via ${joinKw}; the visualizer shows the ${config.type} semantics.\n`
    : "";

  return `${note}${select} FROM ${leftRef} ${joinKw} ${rightRef}${on};`;
}

// ---------------------------------------------------------------------------
// ASCII diagram
// ---------------------------------------------------------------------------

/** Render an ASCII diagram showing the two tables and the join between them. */
export function renderAsciiDiagram(
  left: SampleTable,
  right: SampleTable,
  config: JoinConfig,
  result: JoinResult,
): string {
  const leftName = config.leftAlias ?? config.leftTable;
  const rightName = config.rightAlias ?? config.rightTable;
  const lines: string[] = [];

  // Box-drawing for the two tables, side by side.
  const lw = Math.max(leftName.length + 4, ...left.columns.map((c) => c.length + 4), 8);
  const rw = Math.max(rightName.length + 4, ...right.columns.map((c) => c.length + 4), 8);

  const horizontal = (w: number) => "─".repeat(w);
  const topLeft = (w: number) => `┌${horizontal(w)}┐`;
  const botLeft = (w: number) => `└${horizontal(w)}┘`;
  const midLeft = (w: number) => `├${horizontal(w)}┤`;
  const row = (w: number, text: string) => `│${text.padEnd(w)}│`;

  lines.push(`${topLeft(lw)}        ${topLeft(rw)}`);
  lines.push(`${row(lw, " " + leftName)}   ───► ${row(rw, " " + rightName)}`);
  lines.push(`${midLeft(lw)}  ${joinTypeLabel(config.type).padEnd(4)}  ${midLeft(rw)}`);
  const maxRows = Math.max(left.columns.length, right.columns.length);
  for (let i = 0; i < maxRows; i++) {
    const lc = left.columns[i] ? " " + left.columns[i] : "";
    const rc = right.columns[i] ? " " + right.columns[i] : "";
    lines.push(`${row(lw, lc)}        ${row(rw, rc)}`);
  }
  lines.push(`${botLeft(lw)}        ${botLeft(rw)}`);
  lines.push("");

  // Conditions
  if (config.conditions.length > 0) {
    lines.push("ON:");
    for (const c of config.conditions) {
      lines.push(`  ${c.leftTable}.${c.leftColumn} ${c.operator} ${c.rightTable}.${c.rightColumn}`);
    }
  } else if (config.type === "cross") {
    lines.push("ON: (none — CROSS JOIN, cartesian product)");
  } else {
    lines.push("ON: (no condition)");
  }
  lines.push("");

  // Stats
  const s = result.stats;
  lines.push("Result:");
  lines.push(`  Left input : ${s.leftInput} rows`);
  lines.push(`  Right input: ${s.rightInput} rows`);
  lines.push(`  Matched    : ${s.matched}`);
  lines.push(`  Left only  : ${s.leftUnmatched} (NULL-filled on right in LEFT/FULL)`);
  lines.push(`  Right only : ${s.rightUnmatched} (NULL-filled on left in RIGHT/FULL)`);
  lines.push(`  Output     : ${s.output} rows`);
  if (s.leftInput > 0 && s.rightInput > 0) {
    const mul = (s.output / s.leftInput).toFixed(2);
    lines.push(`  Multiplier : ${mul}× left rows (avg)`);
  }

  return lines.join("\n");
}

/** Render an HTML representation of the diagram (escaped, ready for dangerouslySetInnerHTML). */
export function renderHtmlDiagram(
  left: SampleTable,
  right: SampleTable,
  config: JoinConfig,
  result: JoinResult,
): string {
  const leftName = config.leftAlias ?? config.leftTable;
  const rightName = config.rightAlias ?? config.rightTable;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const leftCols = left.columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const rightCols = right.columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const leftRowsHtml = left.rows.map((r) => {
    const tds = left.columns.map((c) => `<td>${esc(formatValue(r[c]))}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  const rightRowsHtml = right.rows.map((r) => {
    const tds = right.columns.map((c) => `<td>${esc(formatValue(r[c]))}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  const condHtml = config.conditions.length > 0
    ? config.conditions.map((c) => `<code>${esc(c.leftTable)}.${esc(c.leftColumn)} ${c.operator} ${esc(c.rightTable)}.${esc(c.rightColumn)}</code>`).join(" AND ")
    : config.type === "cross"
      ? "<em>(none — CROSS JOIN)</em>"
      : "<em>(no condition)</em>";

  const s = result.stats;
  return `<div class="sjv-diagram">
  <div class="sjv-tables">
    <div class="sjv-table">
      <h4>${esc(leftName)} <span class="sjv-count">${left.rows.length} rows</span></h4>
      <table><thead><tr>${leftCols}</tr></thead><tbody>${leftRowsHtml}</tbody></table>
    </div>
    <div class="sjv-arrow">${esc(joinTypeLabel(config.type))} ──►</div>
    <div class="sjv-table">
      <h4>${esc(rightName)} <span class="sjv-count">${right.rows.length} rows</span></h4>
      <table><thead><tr>${rightCols}</tr></thead><tbody>${rightRowsHtml}</tbody></table>
    </div>
  </div>
  <div class="sjv-on">ON: ${condHtml}</div>
  <div class="sjv-stats">
    <span>matched: <strong>${s.matched}</strong></span>
    <span>left-only: <strong>${s.leftUnmatched}</strong></span>
    <span>right-only: <strong>${s.rightUnmatched}</strong></span>
    <span>output: <strong>${s.output}</strong> rows</span>
  </div>
</div>`;
}

/** Get a human-readable label for a join type. */
export function joinTypeLabel(type: JoinType): string {
  const entry = JOIN_TYPES.find((t) => t.value === type);
  return entry ? entry.label : type;
}

/** Get the description for a join type. */
export function joinTypeDescription(type: JoinType): string {
  const entry = JOIN_TYPES.find((t) => t.value === type);
  return entry ? entry.description : "";
}

// ---------------------------------------------------------------------------
// Venn-vs-rows educational note
// ---------------------------------------------------------------------------

export function educationalNote(type: JoinType): string {
  switch (type) {
    case "inner":
      return "INNER JOIN returns only rows where the ON condition matches on both sides. If a left row matches N right rows, it appears N times in the result. Venn diagrams hide this row multiplication.";
    case "left":
      return "LEFT JOIN returns every left row at least once. If a left row has no right match, the right columns are NULL-filled. If it has N matches, it appears N times (with the right columns populated).";
    case "right":
      return "RIGHT JOIN is the mirror of LEFT JOIN: every right row at least once, NULL-filled on the left if no match. Equivalent to swapping the tables and using LEFT JOIN.";
    case "full":
      return "FULL OUTER JOIN returns every row from both sides. Matched pairs are emitted once; unmatched rows are NULL-filled on the missing side.";
    case "cross":
      return "CROSS JOIN produces the cartesian product: every left row × every right row. If left has M rows and right has N rows, the result has M×N rows. No ON clause is used.";
    case "left-anti":
      return "LEFT ANTI JOIN returns left rows that have NO match on the right. Right columns are dropped (not NULL-filled). Useful for 'find rows in A that are not in B'.";
    case "left-semi":
      return "LEFT SEMI JOIN returns left rows that have AT LEAST ONE match on the right. Right columns are dropped. Equivalent to EXISTS subquery: SELECT * FROM a WHERE EXISTS (SELECT 1 FROM b WHERE b.k = a.k).";
    case "self":
      return "SELF JOIN joins a table to itself using two aliases. Common use: hierarchical data (employees.manager_id → employees.id). The two alias 'copies' are treated as separate inputs.";
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-join-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: JoinType;
  leftTable: string;
  rightTable: string;
  leftRows: number;
  rightRows: number;
  outputRows: number;
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
// Shareable URL
// ---------------------------------------------------------------------------

interface ShareState {
  type: JoinType;
  left: SampleTable;
  right: SampleTable;
  config: JoinConfig;
}

export function encodeState(state: ShareState): string {
  const json = JSON.stringify(state);
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(encoded: string): ShareState | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json) as ShareState;
    if (!obj || typeof obj !== "object") return null;
    if (!obj.type || !obj.left || !obj.right || !obj.config) return null;
    const validTypes = JOIN_TYPES.map((t) => t.value);
    if (!validTypes.includes(obj.type)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ShareState): string {
  const encoded = encodeState(state);
  if (typeof window === "undefined") return `?s=${encoded}`;
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const s = params.get("s");
  if (!s) return null;
  return decodeState(s);
}
