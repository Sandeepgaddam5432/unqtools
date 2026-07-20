/**
 * In-Browser SQL Playground — pure logic.
 *
 * A small in-memory SQL engine that executes CREATE TABLE, INSERT, and SELECT
 * (with WHERE, JOIN, GROUP BY, ORDER BY, LIMIT) entirely in JavaScript — no
 * external database, no network. Built for teaching and ad-hoc analysis.
 *
 * Pure functions only — no DOM, no network. The engine state is held in a
 * `Database` object that callers own and thread through `execute()`.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColumnType = "INTEGER" | "TEXT" | "REAL" | "BLOB" | "NUMERIC";

export type CellValue = number | string | boolean | null;

export interface Column {
  name: string;
  type: ColumnType;
  nullable: boolean;
  primaryKey?: boolean;
}

export interface Row {
  [colName: string]: CellValue;
}

export interface Table {
  name: string;
  columns: Column[];
  rows: Row[];
}

export interface QueryResult {
  columns: string[];
  rows: Row[];
  /** For INSERT/CREATE: row count affected; for SELECT: rows returned. */
  affectedRows: number;
  message: string;
  executionTimeMs: number;
}

export interface ExecuteError {
  error: string;
  executionTimeMs: number;
}

export class Database {
  tables = new Map<string, Table>();
  /** Optional user-defined scalar functions (name → fn). */
  functions = new Map<string, (...args: CellValue[]) => CellValue>();
}

// ---------------------------------------------------------------------------
// Statement splitting
// ---------------------------------------------------------------------------

/** Split SQL text into individual statements (semicolons outside quotes). */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inStr = false;
  let strQuote = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      current += ch;
      if (ch === strQuote && sql[i + 1] === strQuote) { current += sql[i + 1]; i++; continue; }
      if (ch === strQuote) inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inStr = true; strQuote = ch; current += ch; continue;
    }
    if (ch === ";") {
      const s = current.trim();
      if (s) out.push(s);
      current = "";
      continue;
    }
    current += ch;
  }
  const s = current.trim();
  if (s) out.push(s);
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

export type Token = {
  type: "ident" | "keyword" | "string" | "number" | "operator" | "punct" | "star";
  value: string;
  upper: string;
};

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "CREATE", "TABLE",
  "UPDATE", "DELETE", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "ON",
  "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "AS", "AND", "OR",
  "NOT", "NULL", "IS", "IN", "LIKE", "BETWEEN", "ASC", "DESC", "DISTINCT",
  "PRIMARY", "KEY", "UNIQUE", "DEFAULT", "INTEGER", "TEXT", "REAL", "BLOB",
  "NUMERIC", "INT", "VARCHAR", "CHAR", "BOOLEAN", "DROP", "COUNT", "SUM",
  "AVG", "MIN", "MAX", "TRUE", "FALSE", "IF", "EXISTS",
]);

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = sql;
  while (i < s.length) {
    const ch = s[i];
    // whitespace
    if (/\s/.test(ch)) { i++; continue; }
    // line comment --
    if (ch === "-" && s[i + 1] === "-") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    // block comment /* */
    if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // string literal
    if (ch === "'") {
      let str = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { str += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        str += s[i]; i++;
      }
      tokens.push({ type: "string", value: str, upper: str });
      continue;
    }
    // double-quoted identifier
    if (ch === '"') {
      let str = "";
      i++;
      while (i < s.length && s[i] !== '"') { str += s[i]; i++; }
      i++;
      tokens.push({ type: "ident", value: str, upper: str.toUpperCase() });
      continue;
    }
    // backtick identifier
    if (ch === "`") {
      let str = "";
      i++;
      while (i < s.length && s[i] !== "`") { str += s[i]; i++; }
      i++;
      tokens.push({ type: "ident", value: str, upper: str.toUpperCase() });
      continue;
    }
    // number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let num = "";
      while (i < s.length && /[0-9.eE+\-]/.test(s[i])) {
        // allow + - only after e/E
        if ((s[i] === "+" || s[i] === "-") && !/[eE]/.test(s[i - 1] || "")) break;
        num += s[i]; i++;
      }
      tokens.push({ type: "number", value: num, upper: num });
      continue;
    }
    // identifier / keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) { id += s[i]; i++; }
      const upper = id.toUpperCase();
      if (KEYWORDS.has(upper)) {
        tokens.push({ type: "keyword", value: id, upper });
      } else {
        tokens.push({ type: "ident", value: id, upper });
      }
      continue;
    }
    // multi-char operators
    const two = s.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "!=" || two === "<>") {
      tokens.push({ type: "operator", value: two === "<>" ? "!=" : two, upper: two });
      i += 2; continue;
    }
    // single-char operators / punct
    if ("=<>+-".includes(ch)) {
      tokens.push({ type: "operator", value: ch, upper: ch });
      i++; continue;
    }
    if (ch === "*") {
      tokens.push({ type: "star", value: ch, upper: ch });
      i++; continue;
    }
    if ("(),.;".includes(ch)) {
      tokens.push({ type: "punct", value: ch, upper: ch });
      i++; continue;
    }
    // unknown char — skip
    i++;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

export type Expr =
  | { kind: "column"; table?: string; name: string }
  | { kind: "literal"; value: CellValue }
  | { kind: "binop"; op: string; left: Expr; right: Expr }
  | { kind: "unop"; op: string; operand: Expr }
  | { kind: "func"; name: string; args: Expr[]; star?: boolean }
  | { kind: "in"; target: Expr; values: Expr[]; negate: boolean }
  | { kind: "between"; target: Expr; low: Expr; high: Expr; negate: boolean }
  | { kind: "like"; target: Expr; pattern: Expr; negate: boolean }
  | { kind: "isnull"; target: Expr; negate: boolean };

export interface SelectItem {
  expr: Expr;
  alias?: string;
  starTable?: string;
}

export interface OrderByItem {
  expr: Expr;
  direction: "ASC" | "DESC";
}

export interface JoinClause {
  type: "INNER" | "LEFT" | "RIGHT";
  table: string;
  alias?: string;
  on: Expr;
}

export interface SelectStmt {
  kind: "select";
  distinct: boolean;
  items: SelectItem[];
  from: string;
  fromAlias?: string;
  joins: JoinClause[];
  where?: Expr;
  groupBy?: Expr[];
  having?: Expr;
  orderBy?: OrderByItem[];
  limit?: number;
  offset?: number;
}

export interface CreateTableStmt {
  kind: "create-table";
  table: string;
  columns: { name: string; type: ColumnType; nullable: boolean; primaryKey?: boolean }[];
  ifNotExists: boolean;
}

export interface InsertStmt {
  kind: "insert";
  table: string;
  columns?: string[];
  rows: Expr[][];
}

export interface DropTableStmt {
  kind: "drop-table";
  table: string;
  ifExists: boolean;
}

export type Statement = SelectStmt | CreateTableStmt | InsertStmt | DropTableStmt;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }
  private expectKeyword(kw: string): Token {
    const t = this.peek();
    if (!t || t.type !== "keyword" || t.upper !== kw) {
      throw new Error(`Expected keyword ${kw}, got '${t?.value ?? "EOF"}'`);
    }
    return this.next()!;
  }
  private matchKeyword(kw: string): boolean {
    const t = this.peek();
    return !!t && t.type === "keyword" && t.upper === kw;
  }
  private consumeKeyword(kw: string): boolean {
    if (this.matchKeyword(kw)) { this.pos++; return true; }
    return false;
  }
  private matchPunct(p: string): boolean {
    const t = this.peek();
    return !!t && t.type === "punct" && t.value === p;
  }
  private consumePunct(p: string): boolean {
    if (this.matchPunct(p)) { this.pos++; return true; }
    return false;
  }

  parseStatements(): Statement[] {
    const out: Statement[] = [];
    while (this.pos < this.tokens.length) {
      out.push(this.parseStatement());
      // optional semicolon between statements
      this.consumePunct(";");
    }
    return out;
  }

  parseStatement(): Statement {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of input");
    if (t.type === "keyword") {
      if (t.upper === "SELECT") return this.parseSelect();
      if (t.upper === "CREATE") return this.parseCreateTable();
      if (t.upper === "INSERT") return this.parseInsert();
      if (t.upper === "DROP") return this.parseDropTable();
    }
    throw new Error(`Unsupported statement starting with '${t.value}'`);
  }

  private parseSelect(): SelectStmt {
    this.expectKeyword("SELECT");
    const distinct = this.consumeKeyword("DISTINCT");
    const items = this.parseSelectItems();
    let from = "";
    let fromAlias: string | undefined;
    const joins: JoinClause[] = [];
    if (this.consumeKeyword("FROM")) {
      from = this.parseIdent();
      fromAlias = this.parseOptionalAlias();
      while (this.matchKeyword("INNER") || this.matchKeyword("LEFT") || this.matchKeyword("RIGHT") || this.matchKeyword("JOIN")) {
        joins.push(this.parseJoin());
      }
    }
    let where: Expr | undefined;
    if (this.consumeKeyword("WHERE")) where = this.parseExpr();
    let groupBy: Expr[] | undefined;
    if (this.consumeKeyword("GROUP")) {
      this.expectKeyword("BY");
      groupBy = [this.parseExpr()];
      while (this.consumePunct(",")) groupBy.push(this.parseExpr());
    }
    let having: Expr | undefined;
    if (this.consumeKeyword("HAVING")) having = this.parseExpr();
    let orderBy: OrderByItem[] | undefined;
    if (this.consumeKeyword("ORDER")) {
      this.expectKeyword("BY");
      orderBy = [this.parseOrderByItem()];
      while (this.consumePunct(",")) orderBy.push(this.parseOrderByItem());
    }
    let limit: number | undefined;
    let offset: number | undefined;
    if (this.consumeKeyword("LIMIT")) {
      limit = this.parseNumberLiteral();
      if (this.consumeKeyword("OFFSET")) offset = this.parseNumberLiteral();
    } else if (this.consumeKeyword("OFFSET")) {
      offset = this.parseNumberLiteral();
    }
    return { kind: "select", distinct, items, from, fromAlias, joins, where, groupBy, having, orderBy, limit, offset };
  }

  private parseSelectItems(): SelectItem[] {
    const items: SelectItem[] = [];
    items.push(this.parseSelectItem());
    while (this.consumePunct(",")) items.push(this.parseSelectItem());
    return items;
  }

  private parseSelectItem(): SelectItem {
    // star or table.* — but only at top level of an item
    if (this.peek()?.type === "star") {
      this.next();
      return { expr: { kind: "literal", value: null }, starTable: "" };
    }
    // table.* — peek ahead
    const t = this.peek();
    if (t && t.type === "ident" && this.peek(1)?.type === "punct" && this.peek(1)?.value === "." && this.peek(2)?.type === "star") {
      this.next(); this.next(); this.next();
      return { expr: { kind: "literal", value: null }, starTable: t.value };
    }
    const expr = this.parseExpr();
    let alias: string | undefined;
    if (this.consumeKeyword("AS")) {
      alias = this.parseIdent();
    } else if (this.peek()?.type === "ident") {
      alias = this.next()!.value;
    }
    return { expr, alias };
  }

  private parseJoin(): JoinClause {
    let type: JoinClause["type"] = "INNER";
    if (this.consumeKeyword("INNER")) {
      this.expectKeyword("JOIN");
    } else if (this.consumeKeyword("LEFT")) {
      this.consumeKeyword("OUTER");
      this.expectKeyword("JOIN");
      type = "LEFT";
    } else if (this.consumeKeyword("RIGHT")) {
      this.consumeKeyword("OUTER");
      this.expectKeyword("JOIN");
      type = "RIGHT";
    } else {
      this.expectKeyword("JOIN");
    }
    const table = this.parseIdent();
    const alias = this.parseOptionalAlias();
    this.expectKeyword("ON");
    const on = this.parseExpr();
    return { type, table, alias, on };
  }

  private parseOrderByItem(): OrderByItem {
    const expr = this.parseExpr();
    let direction: "ASC" | "DESC" = "ASC";
    if (this.consumeKeyword("ASC")) direction = "ASC";
    else if (this.consumeKeyword("DESC")) direction = "DESC";
    return { expr, direction };
  }

  private parseCreateTable(): CreateTableStmt {
    this.expectKeyword("CREATE");
    this.expectKeyword("TABLE");
    let ifNotExists = false;
    if (this.consumeKeyword("IF")) {
      this.expectKeyword("NOT");
      this.expectKeyword("EXISTS");
      ifNotExists = true;
    }
    const table = this.parseIdent();
    if (!this.consumePunct("(")) throw new Error("Expected '(' after CREATE TABLE name");
    const cols: CreateTableStmt["columns"] = [];
    do {
      const name = this.parseIdent();
      const typeTok = this.next();
      if (!typeTok) throw new Error("Expected column type");
      const type = normalizeColumnType(typeTok.value);
      // skip optional column-constraint keywords until comma or close-paren
      let nullable = true;
      let primaryKey = false;
      // optional (n) for VARCHAR(n) — skip
      if (this.matchPunct("(")) {
        this.next();
        while (!this.matchPunct(")") && this.pos < this.tokens.length) this.next();
        this.consumePunct(")");
      }
      // constraints loop
      while (true) {
        if (this.consumeKeyword("PRIMARY")) { this.expectKeyword("KEY"); primaryKey = true; nullable = false; continue; }
        if (this.consumeKeyword("NOT")) { this.expectKeyword("NULL"); nullable = false; continue; }
        if (this.consumeKeyword("NULL")) { nullable = true; continue; }
        if (this.consumeKeyword("UNIQUE")) { continue; }
        if (this.consumeKeyword("DEFAULT")) { this.parseExpr(); continue; }
        break;
      }
      cols.push({ name, type, nullable, primaryKey });
    } while (this.consumePunct(","));
    if (!this.consumePunct(")")) throw new Error("Expected ')' after column list");
    return { kind: "create-table", table, columns: cols, ifNotExists };
  }

  private parseInsert(): InsertStmt {
    this.expectKeyword("INSERT");
    this.expectKeyword("INTO");
    const table = this.parseIdent();
    let columns: string[] | undefined;
    if (this.consumePunct("(")) {
      columns = [this.parseIdent()];
      while (this.consumePunct(",")) columns.push(this.parseIdent());
      if (!this.consumePunct(")")) throw new Error("Expected ')' after column list");
    }
    this.expectKeyword("VALUES");
    const rows: Expr[][] = [];
    do {
      if (!this.consumePunct("(")) throw new Error("Expected '(' in VALUES");
      const row: Expr[] = [this.parseExpr()];
      while (this.consumePunct(",")) row.push(this.parseExpr());
      if (!this.consumePunct(")")) throw new Error("Expected ')' after value list");
      rows.push(row);
    } while (this.consumePunct(","));
    return { kind: "insert", table, columns, rows };
  }

  private parseDropTable(): DropTableStmt {
    this.expectKeyword("DROP");
    this.expectKeyword("TABLE");
    let ifExists = false;
    if (this.consumeKeyword("IF")) {
      this.expectKeyword("EXISTS");
      ifExists = true;
    }
    const table = this.parseIdent();
    return { kind: "drop-table", table, ifExists };
  }

  // Expression parser — precedence: OR < AND < NOT < comparison < +/- < */ < unary
  private parseExpr(): Expr { return this.parseOr(); }
  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.consumeKeyword("OR")) left = { kind: "binop", op: "OR", left, right: this.parseAnd() };
    return left;
  }
  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.consumeKeyword("AND")) left = { kind: "binop", op: "AND", left, right: this.parseNot() };
    return left;
  }
  private parseNot(): Expr {
    if (this.consumeKeyword("NOT")) return { kind: "unop", op: "NOT", operand: this.parseNot() };
    return this.parseComparison();
  }
  private parseComparison(): Expr {
    const left = this.parseAdditive();
    // IS NULL / IS NOT NULL
    if (this.consumeKeyword("IS")) {
      const negate = this.consumeKeyword("NOT");
      this.expectKeyword("NULL");
      return { kind: "isnull", target: left, negate };
    }
    // NOT IN, NOT LIKE, NOT BETWEEN
    let negate = false;
    if (this.matchKeyword("NOT")) {
      const next = this.peek(1);
      if (next && (next.upper === "IN" || next.upper === "LIKE" || next.upper === "BETWEEN")) {
        this.next(); // consume NOT
        negate = true;
      }
    }
    if (this.consumeKeyword("IN")) {
      if (!this.consumePunct("(")) throw new Error("Expected '(' after IN");
      const values: Expr[] = [this.parseExpr()];
      while (this.consumePunct(",")) values.push(this.parseExpr());
      if (!this.consumePunct(")")) throw new Error("Expected ')' after IN list");
      return { kind: "in", target: left, values, negate };
    }
    if (this.consumeKeyword("LIKE")) {
      const pattern = this.parseAdditive();
      return { kind: "like", target: left, pattern, negate };
    }
    if (this.consumeKeyword("BETWEEN")) {
      const low = this.parseAdditive();
      this.expectKeyword("AND");
      const high = this.parseAdditive();
      return { kind: "between", target: left, low, high, negate };
    }
    // standard comparison operators
    const t = this.peek();
    if (t && t.type === "operator" && ["=", "!=", "<", ">", "<=", ">="].includes(t.value)) {
      this.next();
      const right = this.parseAdditive();
      return { kind: "binop", op: t.value, left, right };
    }
    return left;
  }
  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (true) {
      const t = this.peek();
      if (t && t.type === "operator" && (t.value === "+" || t.value === "-")) {
        // Don't confuse with signed number — we're past the operand
        if (t.value === "-" && this.peek(1)?.type === "number") {
          // could be subtraction or signed number — treat as subtraction
        }
        this.next();
        const right = this.parseMultiplicative();
        left = { kind: "binop", op: t.value, left, right };
      } else break;
    }
    return left;
  }
  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && ((t.type === "operator" && (t.value === "/" )) || t.type === "star")) {
        // '*' is the tricky token — could be multiply or projection star.
        // Inside an expression context, treat as multiply.
        this.next();
        const right = this.parseUnary();
        left = { kind: "binop", op: t.type === "star" ? "*" : t.value, left, right };
      } else break;
    }
    return left;
  }
  private parseUnary(): Expr {
    const t = this.peek();
    if (t && t.type === "operator" && (t.value === "-" || t.value === "+")) {
      this.next();
      return { kind: "unop", op: t.value, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }
  private parsePrimary(): Expr {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");
    // parentheses
    if (t.type === "punct" && t.value === "(") {
      this.next();
      const e = this.parseExpr();
      if (!this.consumePunct(")")) throw new Error("Expected ')'");
      return e;
    }
    // literal: number, string, NULL, TRUE, FALSE
    if (t.type === "number") {
      this.next();
      const n = Number(t.value);
      return { kind: "literal", value: Number.isFinite(n) ? n : null };
    }
    if (t.type === "string") {
      this.next();
      return { kind: "literal", value: t.value };
    }
    if (t.type === "keyword") {
      if (t.upper === "NULL") { this.next(); return { kind: "literal", value: null }; }
      if (t.upper === "TRUE") { this.next(); return { kind: "literal", value: true }; }
      if (t.upper === "FALSE") { this.next(); return { kind: "literal", value: false }; }
      // function call: COUNT, SUM, AVG, MIN, MAX
      if (["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(t.upper)) {
        const name = t.upper;
        this.next();
        if (!this.consumePunct("(")) throw new Error(`Expected '(' after ${name}`);
        let star = false;
        const args: Expr[] = [];
        if (this.peek()?.type === "star") {
          this.next();
          star = true;
        } else if (this.consumeKeyword("DISTINCT")) {
          args.push(this.parseExpr());
        } else {
          args.push(this.parseExpr());
        }
        if (!this.consumePunct(")")) throw new Error(`Expected ')' after ${name}(…)`);
        return { kind: "func", name, args, star };
      }
    }
    // column reference: ident or ident.ident or ident(args) function call
    if (t.type === "ident") {
      this.next();
      if (this.matchPunct(".")) {
        this.next();
        const colTok = this.next();
        if (!colTok) throw new Error("Expected column name after '.'");
        return { kind: "column", table: t.value, name: colTok.value };
      }
      if (this.matchPunct("(")) {
        // function call: ident(args)
        this.next();
        const args: Expr[] = [];
        if (!this.matchPunct(")")) {
          args.push(this.parseExpr());
          while (this.consumePunct(",")) args.push(this.parseExpr());
        }
        if (!this.consumePunct(")")) throw new Error("Expected ')' after function args");
        return { kind: "func", name: t.value.toUpperCase(), args };
      }
      return { kind: "column", name: t.value };
    }
    throw new Error(`Unexpected token '${t.value}' in expression`);
  }

  private parseIdent(): string {
    const t = this.next();
    if (!t || (t.type !== "ident" && t.type !== "keyword")) {
      throw new Error(`Expected identifier, got '${t?.value ?? "EOF"}'`);
    }
    return t.value;
  }
  private parseOptionalAlias(): string | undefined {
    if (this.consumeKeyword("AS")) return this.parseIdent();
    const t = this.peek();
    if (t && t.type === "ident") {
      // Be careful: a following keyword like WHERE, GROUP, ORDER, etc. means no alias
      this.next();
      return t.value;
    }
    return undefined;
  }
  private parseNumberLiteral(): number {
    const t = this.next();
    if (!t || t.type !== "number") throw new Error("Expected number");
    return Number(t.value);
  }
}

/** Parse a single SQL statement (no trailing semicolon required). */
export function parseSql(sql: string): Statement[] {
  const tokens = tokenize(sql);
  const parser = new Parser(tokens);
  return parser.parseStatements();
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/** Execute one or more SQL statements against the database. Returns the last result. */
export function execute(db: Database, sql: string): QueryResult {
  const start = Date.now();
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    return { columns: [], rows: [], affectedRows: 0, message: "No statements", executionTimeMs: 0 };
  }
  let last: QueryResult = { columns: [], rows: [], affectedRows: 0, message: "", executionTimeMs: 0 };
  for (const stmtText of statements) {
    const stmtStart = Date.now();
    let stmts: Statement[];
    try {
      stmts = parseSql(stmtText);
    } catch (e) {
      throw new Error(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
    for (const stmt of stmts) {
      try {
        const r = executeStmt(db, stmt);
        last = { ...r, executionTimeMs: Date.now() - stmtStart };
      } catch (e) {
        throw new Error(`${e instanceof Error ? e.message : String(e)} (in: ${stmtText.slice(0, 60)}${stmtText.length > 60 ? "…" : ""})`);
      }
    }
  }
  return { ...last, executionTimeMs: Date.now() - start };
}

/** Execute a single parsed statement. */
export function executeStmt(db: Database, stmt: Statement): QueryResult {
  switch (stmt.kind) {
    case "create-table": return execCreateTable(db, stmt);
    case "insert": return execInsert(db, stmt);
    case "select": return execSelect(db, stmt);
    case "drop-table": return execDropTable(db, stmt);
  }
}

function execCreateTable(db: Database, stmt: CreateTableStmt): QueryResult {
  if (db.tables.has(stmt.table)) {
    if (stmt.ifNotExists) return { columns: [], rows: [], affectedRows: 0, message: `Table '${stmt.table}' already exists`, executionTimeMs: 0 };
    throw new Error(`Table '${stmt.table}' already exists`);
  }
  const table: Table = {
    name: stmt.table,
    columns: stmt.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, primaryKey: c.primaryKey })),
    rows: [],
  };
  db.tables.set(stmt.table, table);
  return { columns: [], rows: [], affectedRows: 0, message: `Table '${stmt.table}' created`, executionTimeMs: 0 };
}

function execDropTable(db: Database, stmt: DropTableStmt): QueryResult {
  if (!db.tables.has(stmt.table)) {
    if (stmt.ifExists) return { columns: [], rows: [], affectedRows: 0, message: `Table '${stmt.table}' does not exist`, executionTimeMs: 0 };
    throw new Error(`Table '${stmt.table}' does not exist`);
  }
  db.tables.delete(stmt.table);
  return { columns: [], rows: [], affectedRows: 0, message: `Table '${stmt.table}' dropped`, executionTimeMs: 0 };
}

function execInsert(db: Database, stmt: InsertStmt): QueryResult {
  const table = db.tables.get(stmt.table);
  if (!table) throw new Error(`Table '${stmt.table}' does not exist`);
  const colNames = stmt.columns ?? table.columns.map((c) => c.name);
  // validate columns
  for (const cn of colNames) {
    if (!table.columns.some((c) => c.name.toLowerCase() === cn.toLowerCase())) {
      throw new Error(`Column '${cn}' does not exist in table '${stmt.table}'`);
    }
  }
  for (const rowExpr of stmt.rows) {
    if (rowExpr.length !== colNames.length) {
      throw new Error(`INSERT column count (${colNames.length}) does not match value count (${rowExpr.length})`);
    }
    const row: Row = {};
    // initialize all columns to NULL
    for (const c of table.columns) row[c.name] = null;
    for (let i = 0; i < colNames.length; i++) {
      const val = evaluateExpr(rowExpr[i], {}, db);
      const col = table.columns.find((c) => c.name.toLowerCase() === colNames[i].toLowerCase())!;
      row[col.name] = coerceToType(val, col.type);
    }
    table.rows.push(row);
  }
  return { columns: [], rows: [], affectedRows: stmt.rows.length, message: `${stmt.rows.length} row(s) inserted into '${stmt.table}'`, executionTimeMs: 0 };
}

/** Coerce a value to the column type. */
export function coerceToType(val: CellValue, type: ColumnType): CellValue {
  if (val === null || val === undefined) return null;
  switch (type) {
    case "INTEGER": {
      if (typeof val === "number") return Math.trunc(val);
      if (typeof val === "string") {
        const n = Number(val);
        return Number.isFinite(n) ? Math.trunc(n) : val;
      }
      if (typeof val === "boolean") return val ? 1 : 0;
      return val;
    }
    case "REAL":
    case "NUMERIC": {
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const n = Number(val);
        return Number.isFinite(n) ? n : val;
      }
      return val;
    }
    case "TEXT": {
      if (typeof val === "string") return val;
      if (typeof val === "number" || typeof val === "boolean") return String(val);
      return val;
    }
    case "BLOB":
    default:
      return val;
  }
}

interface EvalContext {
  row?: Row;
  /** Alias → table map for qualified column lookups. */
  aliases?: Record<string, string>;
  /** Group rows (for aggregate evaluation). */
  groupRows?: Row[];
}

function execSelect(db: Database, stmt: SelectStmt): QueryResult {
  if (!stmt.from) {
    // SELECT without FROM — evaluate items as constant expressions
    const outRow: Row = {};
    const cols: string[] = [];
    for (const item of stmt.items) {
      const name = item.alias ?? exprToName(item.expr);
      cols.push(name);
      outRow[name] = evaluateExpr(item.expr, {}, db);
    }
    return { columns: cols, rows: [outRow], affectedRows: 1, message: "1 row", executionTimeMs: 0 };
  }
  const baseTable = db.tables.get(stmt.from);
  if (!baseTable) throw new Error(`Table '${stmt.from}' does not exist`);
  const baseAlias = stmt.fromAlias ?? stmt.from;

  // Build working row set: array of { alias → row }
  type JoinedRow = Record<string, Row>; // alias → row
  let working: JoinedRow[] = baseTable.rows.map((r) => ({ [baseAlias]: r }));

  // Apply joins
  for (const join of stmt.joins) {
    const jTable = db.tables.get(join.table);
    if (!jTable) throw new Error(`Table '${join.table}' does not exist`);
    const jAlias = join.alias ?? join.table;
    const next: JoinedRow[] = [];
    const unmatchedRight: JoinedRow[] = [];
    for (const w of working) {
      let matched = false;
      for (const r of jTable.rows) {
        const candidate: JoinedRow = { ...w, [jAlias]: r };
        if (truthy(evaluateExpr(join.on, { row: flattenRow(candidate), aliases: Object.fromEntries(Object.keys(candidate).map((a) => [a, a])) }, db))) {
          next.push(candidate);
          matched = true;
        }
      }
      if (!matched && join.type === "LEFT") {
        next.push({ ...w, [jAlias]: nullRow(jTable) });
      }
      if (join.type === "RIGHT") {
        // RIGHT JOIN: keep unmatched right rows; we approximate below
      }
    }
    if (join.type === "RIGHT") {
      // For RIGHT JOIN: also include right rows that didn't match any left
      for (const r of jTable.rows) {
        let matched = false;
        for (const w of working) {
          const candidate: JoinedRow = { ...w, [jAlias]: r };
          if (truthy(evaluateExpr(join.on, { row: flattenRow(candidate), aliases: Object.fromEntries(Object.keys(candidate).map((a) => [a, a])) }, db))) {
            matched = true; break;
          }
        }
        if (!matched) unmatchedRight.push({ [baseAlias]: nullRow(baseTable), [jAlias]: r });
      }
      next.push(...unmatchedRight);
    }
    working = next;
  }

  // Flatten joined rows to a single row for evaluation (qualified by alias.col)
  const aliases: Record<string, string> = {};
  for (const a of Object.keys(working[0] ?? { [baseAlias]: {} })) aliases[a] = a;
  let flatRows: Row[] = working.map((w) => flattenRow(w));

  // Apply WHERE
  if (stmt.where) {
    flatRows = flatRows.filter((r) => truthy(evaluateExpr(stmt.where!, { row: r, aliases }, db)));
  }

  // GROUP BY (or implicit grouping if any aggregate is present)
  const hasAggregate = stmt.items.some((it) => containsAggregate(it.expr));
  if (stmt.groupBy || hasAggregate) {
    return execGroupedSelect(db, stmt, flatRows, aliases);
  }

  // DISTINCT
  let outRows: Row[] = flatRows;

  // Projection — compute specs and output column names from a single source.
  const projCols = computeProjection(db, stmt);
  // Build pairs (source, projected) so ORDER BY can reference either.
  const projectedPairs: { source: Row; projected: Row }[] = outRows.map((r) => {
    const out: Row = {};
    for (const pc of projCols) {
      out[pc.alias] = evaluateExpr(pc.expr, { row: r, aliases }, db);
    }
    return { source: r, projected: out };
  });

  // ORDER BY — evaluated against a combined row (source + projected) so it
  // can reference either source columns or output aliases.
  let finalPairs = projectedPairs;
  if (stmt.orderBy) {
    finalPairs = applyOrderByPairs(projectedPairs, stmt.orderBy, aliases, db);
  }

  let finalRows = finalPairs.map((p) => p.projected);
  if (stmt.distinct) {
    finalRows = dedupRows(finalRows);
  }

  // OFFSET / LIMIT
  if (stmt.offset) finalRows = finalRows.slice(stmt.offset);
  if (stmt.limit !== undefined) finalRows = finalRows.slice(0, stmt.limit);

  const colNames = projCols.map((pc) => pc.alias);
  return { columns: colNames, rows: finalRows, affectedRows: finalRows.length, message: `${finalRows.length} row(s)`, executionTimeMs: 0 };
}

function execGroupedSelect(db: Database, stmt: SelectStmt, rows: Row[], aliases: Record<string, string>): QueryResult {
  // Group by the groupBy exprs (or single group if only aggregates)
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    let key: string;
    if (stmt.groupBy && stmt.groupBy.length > 0) {
      const parts = stmt.groupBy.map((g) => JSON.stringify(evaluateExpr(g, { row: r, aliases }, db)));
      key = parts.join("|");
    } else {
      key = "__all__";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  // For each group, evaluate select items
  const projCols = computeProjection(db, stmt);
  const colNames = projCols.map((pc) => pc.alias);
  const outRows: Row[] = [];
  const outGroupRows: Row[][] = [];
  for (const [, groupRows] of groups) {
    const first = groupRows[0] ?? {};
    const out: Row = {};
    for (let i = 0; i < projCols.length; i++) {
      const pc = projCols[i];
      out[pc.alias] = evaluateExpr(pc.expr, { row: first, aliases, groupRows }, db);
    }
    outRows.push(out);
    outGroupRows.push(groupRows);
  }
  // HAVING — evaluated with groupRows context so aggregates work.
  if (stmt.having) {
    const filteredRows: Row[] = [];
    for (let i = 0; i < outRows.length; i++) {
      const ctx: EvalContext = { row: outRows[i], aliases, groupRows: outGroupRows[i] };
      if (truthy(evaluateExpr(stmt.having, ctx, db))) filteredRows.push(outRows[i]);
    }
    outRows.splice(0, outRows.length, ...filteredRows);
  }
  // ORDER BY — supports both alias references (projected row) and aggregate
  // expressions (evaluated against the group's source rows).
  let finalRows = outRows;
  if (stmt.orderBy) {
    const indexed = outRows.map((row, i) => ({ row, groupRows: outGroupRows[i] }));
    indexed.sort((a, b) => {
      for (const item of stmt.orderBy!) {
        const ctxA: EvalContext = { row: a.row, aliases, groupRows: a.groupRows };
        const ctxB: EvalContext = { row: b.row, aliases, groupRows: b.groupRows };
        const av = evaluateExpr(item.expr, ctxA, db);
        const bv = evaluateExpr(item.expr, ctxB, db);
        const c = compareValues(av, bv);
        if (c !== 0) return item.direction === "DESC" ? -c : c;
      }
      return 0;
    });
    finalRows = indexed.map((x) => x.row);
  }
  // LIMIT / OFFSET
  if (stmt.offset) finalRows = finalRows.slice(stmt.offset);
  if (stmt.limit !== undefined) finalRows = finalRows.slice(0, stmt.limit);
  return { columns: colNames, rows: finalRows, affectedRows: finalRows.length, message: `${finalRows.length} row(s)`, executionTimeMs: 0 };
}

/** Projection spec — what to evaluate for each output column. */
interface ProjectionSpec {
  expr: Expr;
  alias: string;
}

/** Compute the projection specs (and output column names) from a SELECT. */
function computeProjection(db: Database, stmt: SelectStmt): ProjectionSpec[] {
  const out: ProjectionSpec[] = [];
  // Build alias → Table map for star expansion.
  const allTables: { alias: string; table: Table | undefined }[] = [];
  if (stmt.from) allTables.push({ alias: stmt.fromAlias ?? stmt.from, table: db.tables.get(stmt.from) });
  for (const j of stmt.joins) allTables.push({ alias: j.alias ?? j.table, table: db.tables.get(j.table) });

  for (const item of stmt.items) {
    if (item.starTable !== undefined) {
      const targets = item.starTable === ""
        ? allTables
        : allTables.filter((t) => t.alias.toLowerCase() === item.starTable!.toLowerCase());
      for (const t of targets) {
        if (!t.table) continue;
        for (const col of t.table.columns) {
          out.push({ expr: { kind: "column", table: t.alias, name: col.name }, alias: col.name });
        }
      }
      continue;
    }
    // For a plain column reference without alias, the output name is the
    // column name (without the table qualifier) — matches SQL convention.
    const alias = item.alias ?? (item.expr.kind === "column" ? item.expr.name : exprToName(item.expr));
    out.push({ expr: item.expr, alias });
  }
  return out;
}

/** Determine if an expression contains an aggregate function. */
function containsAggregate(e: Expr): boolean {
  switch (e.kind) {
    case "func":
      if (["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(e.name)) return true;
      return e.args.some(containsAggregate);
    case "binop": return containsAggregate(e.left) || containsAggregate(e.right);
    case "unop": return containsAggregate(e.operand);
    case "in": return containsAggregate(e.target) || e.values.some(containsAggregate);
    case "between": return containsAggregate(e.target) || containsAggregate(e.low) || containsAggregate(e.high);
    case "like": return containsAggregate(e.target) || containsAggregate(e.pattern);
    case "isnull": return containsAggregate(e.target);
    default: return false;
  }
}

/** Apply ORDER BY to (source, projected) pairs — supports both source and alias references. */
function applyOrderByPairs(
  pairs: { source: Row; projected: Row }[],
  orderBy: OrderByItem[],
  aliases: Record<string, string>,
  db: Database,
): { source: Row; projected: Row }[] {
  const cmp = (a: { source: Row; projected: Row }, b: { source: Row; projected: Row }): number => {
    for (const item of orderBy) {
      const rowA: Row = { ...a.source, ...a.projected };
      const rowB: Row = { ...b.source, ...b.projected };
      const av = evaluateExpr(item.expr, { row: rowA, aliases }, db);
      const bv = evaluateExpr(item.expr, { row: rowB, aliases }, db);
      const c = compareValues(av, bv);
      if (c !== 0) return item.direction === "DESC" ? -c : c;
    }
    return 0;
  };
  return [...pairs].sort(cmp);
}

/** SQL-aware comparison: NULLs sort first; numbers numerically; else string compare. */
export function compareValues(a: CellValue, b: CellValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** Deduplicate rows by JSON-stringifying them. */
function dedupRows(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (!seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}

/** Flatten a JoinedRow (alias → Row) to a single Row keyed by "alias.col" and "col". */
function flattenRow(joined: Record<string, Row>): Row {
  const out: Row = {};
  for (const [alias, row] of Object.entries(joined)) {
    for (const [k, v] of Object.entries(row)) {
      out[`${alias}.${k}`] = v;
      // also unqualified — last one wins
      if (!(k in out) || out[k] === null) out[k] = v;
    }
  }
  return out;
}

function nullRow(table: Table): Row {
  const r: Row = {};
  for (const c of table.columns) r[c.name] = null;
  return r;
}

/** Derive a column name from an expression (for projection when no alias). */
export function exprToName(e: Expr): string {
  switch (e.kind) {
    case "column": return e.table ? `${e.table}.${e.name}` : e.name;
    case "literal": return String(e.value);
    case "func": {
      if (e.star) return `${e.name}(*)`;
      const args = e.args.map(exprToName).join(", ");
      return `${e.name}(${args})`;
    }
    case "binop": return `${exprToName(e.left)} ${e.op} ${exprToName(e.right)}`;
    case "unop": return `${e.op}${exprToName(e.operand)}`;
    case "in": return `${exprToName(e.target)} IN`;
    case "between": return `${exprToName(e.target)} BETWEEN`;
    case "like": return `${exprToName(e.target)} LIKE`;
    case "isnull": return `${exprToName(e.target)} IS NULL`;
  }
}

/** Evaluate an expression to a runtime value. */
export function evaluateExpr(e: Expr, ctx: EvalContext, db: Database): CellValue {
  switch (e.kind) {
    case "literal": return e.value;
    case "column": {
      const row = ctx.row ?? {};
      if (e.table) {
        const key = `${e.table}.${e.name}`;
        if (key in row) return row[key];
        // case-insensitive search
        for (const k of Object.keys(row)) {
          if (k.toLowerCase() === key.toLowerCase()) return row[k];
        }
        throw new Error(`Column '${key}' not found`);
      }
      if (e.name in row) return row[e.name];
      // case-insensitive
      for (const k of Object.keys(row)) {
        if (k.toLowerCase() === e.name.toLowerCase()) return row[k];
        // also match the unqualified part of "alias.col"
        if (k.includes(".") && k.split(".").pop()!.toLowerCase() === e.name.toLowerCase()) return row[k];
      }
      throw new Error(`Column '${e.name}' not found`);
    }
    case "binop": return evaluateBinop(e, ctx, db);
    case "unop": {
      const v = evaluateExpr(e.operand, ctx, db);
      if (e.op === "NOT") return !truthy(v) ? true : false;
      if (e.op === "-") return typeof v === "number" ? -v : null;
      if (e.op === "+") return v;
      return null;
    }
    case "func": return evaluateFunc(e, ctx, db);
    case "in": {
      const t = evaluateExpr(e.target, ctx, db);
      for (const v of e.values) {
        if (compareValues(t, evaluateExpr(v, ctx, db)) === 0) {
          return e.negate ? false : true;
        }
      }
      return e.negate ? true : false;
    }
    case "between": {
      const t = evaluateExpr(e.target, ctx, db);
      const lo = evaluateExpr(e.low, ctx, db);
      const hi = evaluateExpr(e.high, ctx, db);
      const inRange = compareValues(t, lo) >= 0 && compareValues(t, hi) <= 0;
      return e.negate ? !inRange : inRange;
    }
    case "like": {
      const t = evaluateExpr(e.target, ctx, db);
      const p = evaluateExpr(e.pattern, ctx, db);
      if (typeof t !== "string" || typeof p !== "string") return e.negate ? true : false;
      const re = likeToRegex(p);
      const match = re.test(t);
      return e.negate ? !match : match;
    }
    case "isnull": {
      const t = evaluateExpr(e.target, ctx, db);
      const isNull = t === null || t === undefined;
      return e.negate ? !isNull : isNull;
    }
  }
}

function evaluateBinop(e: Extract<Expr, { kind: "binop" }>, ctx: EvalContext, db: Database): CellValue {
  const l = evaluateExpr(e.left, ctx, db);
  const r = evaluateExpr(e.right, ctx, db);
  switch (e.op) {
    case "AND": return truthy(l) && truthy(r);
    case "OR": return truthy(l) || truthy(r);
    case "=":
    case "!=":
    case "<":
    case ">":
    case "<=":
    case ">=": {
      // SQL three-valued logic: any NULL operand → unknown (falsy).
      if (l === null || l === undefined || r === null || r === undefined) return null;
      const c = compareValues(l, r);
      switch (e.op) {
        case "=": return c === 0;
        case "!=": return c !== 0;
        case "<": return c < 0;
        case ">": return c > 0;
        case "<=": return c <= 0;
        case ">=": return c >= 0;
      }
      return null;
    }
    case "+": {
      if (typeof l === "number" && typeof r === "number") return l + r;
      if (l === null || r === null) return null;
      return String(l) + String(r);
    }
    case "-": {
      if (typeof l === "number" && typeof r === "number") return l - r;
      return null;
    }
    case "*": {
      if (typeof l === "number" && typeof r === "number") return l * r;
      return null;
    }
    case "/": {
      if (typeof l === "number" && typeof r === "number") return r === 0 ? null : l / r;
      return null;
    }
    default: throw new Error(`Unknown operator '${e.op}'`);
  }
}

function evaluateFunc(e: Extract<Expr, { kind: "func" }>, ctx: EvalContext, db: Database): CellValue {
  const name = e.name.toUpperCase();
  // Aggregates
  if (["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(name)) {
    const groupRows = ctx.groupRows ?? [];
    if (name === "COUNT") {
      if (e.star) return groupRows.length;
      const vals = groupRows.map((r) => evaluateExpr(e.args[0], { row: r, aliases: ctx.aliases }, db));
      return vals.filter((v) => v !== null && v !== undefined).length;
    }
    const vals = groupRows
      .map((r) => evaluateExpr(e.args[0], { row: r, aliases: ctx.aliases }, db))
      .filter((v) => v !== null && v !== undefined) as number[];
    if (vals.length === 0) return null;
    if (name === "SUM") return vals.reduce((a, b) => a + b, 0);
    if (name === "AVG") return vals.reduce((a, b) => a + b, 0) / vals.length;
    if (name === "MIN") return vals.reduce((a, b) => compareValues(a, b) < 0 ? a : b);
    if (name === "MAX") return vals.reduce((a, b) => compareValues(a, b) > 0 ? a : b);
  }
  // Scalar functions
  const args = e.args.map((a) => evaluateExpr(a, ctx, db));
  switch (name) {
    case "UPPER": return typeof args[0] === "string" ? args[0].toUpperCase() : args[0] ?? null;
    case "LOWER": return typeof args[0] === "string" ? args[0].toLowerCase() : args[0] ?? null;
    case "LENGTH": return typeof args[0] === "string" ? args[0].length : (args[0] === null ? null : String(args[0]).length);
    case "ABS": return typeof args[0] === "number" ? Math.abs(args[0]) : null;
    case "ROUND": {
      const n = typeof args[0] === "number" ? args[0] : null;
      const d = typeof args[1] === "number" ? args[1] : 0;
      return n === null ? null : Math.round(n * 10 ** d) / 10 ** d;
    }
    case "COALESCE": return args.find((v) => v !== null && v !== undefined) ?? null;
    case "TRIM": return typeof args[0] === "string" ? args[0].trim() : args[0] ?? null;
    case "CONCAT": return args.map((a) => (a === null ? "" : String(a))).join("");
    default:
      if (db.functions.has(name)) {
        return db.functions.get(name)!(...args);
      }
      throw new Error(`Unknown function '${name}'`);
  }
}

/** Convert a SQL LIKE pattern to a RegExp. */
export function likeToRegex(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else if (/[.*+?^${}()|[\]\\]/.test(ch)) re += "\\" + ch;
    else re += ch;
  }
  re += "$";
  return new RegExp(re, "i");
}

/** Truthiness for WHERE/HAVING evaluation. */
function truthy(v: CellValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v.toLowerCase() !== "false" && v !== "0";
  return true;
}

// ---------------------------------------------------------------------------
// Type normalization
// ---------------------------------------------------------------------------

function normalizeColumnType(s: string): ColumnType {
  const u = s.toUpperCase();
  if (u.startsWith("INT")) return "INTEGER";
  if (u.startsWith("REAL") || u.startsWith("FLOAT") || u.startsWith("DOUBLE") || u.startsWith("DECIMAL")) return "REAL";
  if (u.startsWith("TEXT") || u.startsWith("VARCHAR") || u.startsWith("CHAR") || u.startsWith("STRING")) return "TEXT";
  if (u.startsWith("BLOB")) return "BLOB";
  if (u.startsWith("BOOL")) return "NUMERIC";
  if (u.startsWith("NUM")) return "NUMERIC";
  return "TEXT";
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

/** Render a QueryResult as a CSV string (header + rows). */
export function resultToCsv(r: QueryResult): string {
  const lines = [r.columns.map(quote).join(",")];
  for (const row of r.rows) {
    lines.push(r.columns.map((c) => quote(formatCell(row[c]))).join(","));
  }
  return lines.join("\n");
}

/** Render a QueryResult as JSON (array of objects). */
export function resultToJson(r: QueryResult, pretty = false): string {
  const arr = r.rows.map((row) => {
    const o: Record<string, CellValue> = {};
    for (const c of r.columns) o[c] = row[c] ?? null;
    return o;
  });
  return pretty ? JSON.stringify(arr, null, 2) : JSON.stringify(arr);
}

/** Render a QueryResult as a Markdown table. */
export function resultToMarkdown(r: QueryResult): string {
  if (r.columns.length === 0) return "";
  const lines = [
    `| ${r.columns.join(" | ")} |`,
    `| ${r.columns.map(() => "---").join(" | ")} |`,
  ];
  for (const row of r.rows) {
    lines.push(`| ${r.columns.map((c) => formatCell(row[c]).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`);
  }
  return lines.join("\n");
}

/** Format a cell for display. */
export function formatCell(v: CellValue): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function quote(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Validation / introspection
// ---------------------------------------------------------------------------

/** Validate SQL by attempting to parse (without executing). Returns error or null. */
export function validateSql(sql: string): string | null {
  try {
    const stmts = splitStatements(sql);
    for (const s of stmts) parseSql(s);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** List all tables in the database. */
export function listTables(db: Database): { name: string; columnCount: number; rowCount: number }[] {
  return Array.from(db.tables.values()).map((t) => ({
    name: t.name,
    columnCount: t.columns.length,
    rowCount: t.rows.length,
  }));
}

/** Get the schema for a table. */
export function describeTable(db: Database, name: string): { columns: Column[]; rowCount: number } | null {
  const t = db.tables.get(name);
  if (!t) return null;
  return { columns: t.columns, rowCount: t.rows.length };
}

/** Serialize the entire database (schema + data) to a JSON string. */
export function exportDatabase(db: Database): string {
  const obj = {
    tables: Array.from(db.tables.values()).map((t) => ({
      name: t.name,
      columns: t.columns,
      rows: t.rows,
    })),
  };
  return JSON.stringify(obj, null, 2);
}

/** Restore a database from a serialized JSON string. */
export function importDatabase(json: string): Database {
  const db = new Database();
  const obj = JSON.parse(json) as { tables: Array<{ name: string; columns: Column[]; rows: Row[] }> };
  for (const t of obj.tables) {
    db.tables.set(t.name, { name: t.name, columns: t.columns, rows: t.rows });
  }
  return db;
}

// ---------------------------------------------------------------------------
// Sample datasets
// ---------------------------------------------------------------------------

export const SAMPLE_DATASETS: { name: string; description: string; sql: string }[] = [
  {
    name: "Employees & Departments",
    description: "Two related tables — employees and departments — perfect for JOIN demos.",
    sql: `CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO departments (id, name) VALUES (1, 'Engineering'), (2, 'Sales'), (3, 'HR');
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO employees (id, name, dept_id, salary) VALUES
  (1, 'Alice', 1, 95000.00),
  (2, 'Bob', 1, 87000.00),
  (3, 'Carol', 2, 72000.00),
  (4, 'Dan', 2, 68000.00),
  (5, 'Eve', 3, 60000.00),
  (6, 'Frank', NULL, 58000.00);
SELECT e.name AS employee, d.name AS department, e.salary
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
ORDER BY e.salary DESC;`,
  },
  {
    name: "Sales by Region (GROUP BY)",
    description: "A sales table with regions and amounts — perfect for GROUP BY aggregates.",
    sql: `CREATE TABLE sales (id INTEGER PRIMARY KEY, region TEXT, amount REAL, month TEXT);
INSERT INTO sales (id, region, amount, month) VALUES
  (1, 'North', 1200.00, '2024-01'),
  (2, 'North', 1500.00, '2024-02'),
  (3, 'South', 900.00, '2024-01'),
  (4, 'South', 1100.00, '2024-02'),
  (5, 'East',  2000.00, '2024-01'),
  (6, 'East',  1800.00, '2024-02'),
  (7, 'West',  NULL,     '2024-01'),
  (8, 'West',  700.00,  '2024-02');
SELECT region, COUNT(*) AS deals, SUM(amount) AS total, AVG(amount) AS avg_amount
FROM sales
GROUP BY region
HAVING SUM(amount) > 1000
ORDER BY total DESC;`,
  },
  {
    name: "WHERE & ORDER BY playground",
    description: "A simple users table for exploring WHERE / LIKE / BETWEEN / ORDER BY.",
    sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, active BOOLEAN, email TEXT);
INSERT INTO users (id, name, age, active, email) VALUES
  (1, 'Alice', 30, TRUE, 'alice@example.com'),
  (2, 'Bob', 25, TRUE, 'bob@example.com'),
  (3, 'Carol', 35, FALSE, 'carol@example.com'),
  (4, 'Dave', 28, TRUE, 'dave@example.com'),
  (5, 'Eve', 42, TRUE, 'eve@elsewhere.org');
SELECT name, age, email FROM users
WHERE active = TRUE AND age BETWEEN 25 AND 40
ORDER BY age DESC
LIMIT 3;`,
  },
];

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:in-browser-sql-playground:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  sql: string;
  rowCount: number;
  executionTimeMs: number;
  success: boolean;
  error?: string;
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

export function buildShareUrl(sql: string): string {
  const params = new URLSearchParams();
  if (sql) params.set("sql", sql);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { sql: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { sql: "" };
  const params = new URLSearchParams(clean);
  return { sql: params.get("sql") ?? "" };
}
