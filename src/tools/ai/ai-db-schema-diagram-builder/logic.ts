/**
 * AI DB Schema Diagram Builder — pure logic.
 *
 * Parse plain-English or SQL DDL schema descriptions into an in-memory
 * Schema (entities, columns, keys, relationships), then render:
 *   - Mermaid.js erDiagram code (with crow's-foot 1:1 / 1:N / N:M)
 *   - dbdiagram.io DBML code
 *   - CSV of all columns
 *   - mermaid.live deep-link for instant SVG/PNG export
 *
 * Also: validate the schema, infer relationships from <table>_id naming,
 * local history (max 20), and shareable URL.
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: the NL and SQL parsers are best-effort and deterministic.
 * Complex constraints (composite FKs, partial indexes, triggers) are
 * represented best-effort with a note. Verify the generated diagram
 * against your real schema before relying on it.
 */

// ---------- Types ----------

export type DbType =
  | "int"
  | "bigint"
  | "smallint"
  | "serial"
  | "bigserial"
  | "decimal"
  | "float"
  | "double"
  | "varchar"
  | "char"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "timestamp"
  | "timestamptz"
  | "time"
  | "uuid"
  | "json"
  | "jsonb"
  | "blob"
  | "enum"
  | "array"
  | "unknown";

export type ColumnKey = "PK" | "FK" | "UK" | null;

export interface Column {
  name: string;
  type: DbType;
  rawType?: string;
  nullable: boolean;
  defaultValue?: string;
  keys: ColumnKey[];
  /** For FK columns: the target entity + column. */
  references?: { entity: string; column: string };
  note?: string;
}

export interface Entity {
  name: string;
  columns: Column[];
  note?: string;
}

export type RelationshipType = "1:1" | "1:N" | "N:M";

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  /** Junction table name for N:M. */
  via?: string;
  fromField?: string;
  toField?: string;
  label?: string;
}

export interface Schema {
  title?: string;
  entities: Entity[];
  relationships: Relationship[];
  notes?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  title?: string;
  entityCount: number;
  relCount: number;
  source: "nl" | "sql" | "manual";
  mermaid: string;
}

export interface ShareState {
  source: "nl" | "sql";
  input: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-db-schema-diagram-builder:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-db-schema-diagram-builder:llm-key";

export const TYPE_PRESETS: DbType[] = [
  "int", "bigint", "smallint", "serial", "bigserial",
  "decimal", "float", "double",
  "varchar", "char", "text",
  "boolean",
  "date", "datetime", "timestamp", "timestamptz", "time",
  "uuid", "json", "jsonb", "blob", "enum", "array",
];

/** Map raw SQL type strings to our DbType enum. */
export const TYPE_MAP: Record<string, DbType> = {
  "int": "int",
  "integer": "int",
  "int4": "int",
  "int2": "smallint",
  "smallint": "smallint",
  "tinyint": "smallint",
  "int8": "bigint",
  "bigint": "bigint",
  "serial": "serial",
  "serial4": "serial",
  "bigserial": "bigserial",
  "serial8": "bigserial",
  "decimal": "decimal",
  "numeric": "decimal",
  "real": "float",
  "float": "float",
  "float4": "float",
  "float8": "double",
  "double": "double",
  "double precision": "double",
  "varchar": "varchar",
  "character varying": "varchar",
  "char": "char",
  "character": "char",
  "text": "text",
  "string": "text",
  "bool": "boolean",
  "boolean": "boolean",
  "date": "date",
  "datetime": "datetime",
  "timestamp": "timestamp",
  "timestamptz": "timestamptz",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "time": "time",
  "uuid": "uuid",
  "json": "json",
  "jsonb": "jsonb",
  "blob": "blob",
  "bytea": "blob",
  "varbinary": "blob",
  "enum": "enum",
  "array": "array",
};

/** Default Mermaid type for each DbType. */
export const MERMAID_TYPE: Record<DbType, string> = {
  int: "INT",
  bigint: "BIGINT",
  smallint: "SMALLINT",
  serial: "SERIAL",
  bigserial: "BIGSERIAL",
  decimal: "DECIMAL",
  float: "FLOAT",
  double: "DOUBLE",
  varchar: "VARCHAR",
  char: "CHAR",
  text: "TEXT",
  boolean: "BOOLEAN",
  date: "DATE",
  datetime: "DATETIME",
  timestamp: "TIMESTAMP",
  timestamptz: "TIMESTAMPTZ",
  time: "TIME",
  uuid: "UUID",
  json: "JSON",
  jsonb: "JSONB",
  blob: "BLOB",
  enum: "ENUM",
  array: "ARRAY",
  unknown: "UNKNOWN",
};

// ---------- Normalization helpers ----------

/** Normalize an entity name (snake_case or PascalCase identifier). */
export function normalizeEntityName(name: string): string {
  return (name || "")
    .trim()
    .replace(/[`"\[\]]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
}

/** Normalize a column name. */
export function normalizeColumnName(name: string): string {
  return normalizeEntityName(name);
}

/** Pluralize a noun (very simple English rule). */
export function pluralize(word: string): string {
  const w = word.toLowerCase();
  if (!w) return word;
  if (/(s|x|z|ch|sh)$/.test(w)) return word + "es";
  if (/[^aeiou]y$/.test(w)) return word.slice(0, -1) + "ies";
  return word + "s";
}

/** Singularize a noun (very simple English rule). */
export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (!w) return word;
  if (w.endsWith("ies") && w.length > 3) return word.slice(0, -3) + "y";
  if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("zes")) return word.slice(0, -2);
  if (w.endsWith("ches") || w.endsWith("shes")) return word.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Map a raw SQL type string to a DbType. */
export function mapType(raw: string): DbType {
  if (!raw) return "unknown";
  const cleaned = raw.toLowerCase().replace(/\(\s*\d+\s*(,\s*\d+\s*)?\)/g, "").trim();
  return TYPE_MAP[cleaned] ?? "unknown";
}

// ---------- SQL DDL parser ----------

/**
 * Parse SQL DDL (one or more CREATE TABLE statements) into a Schema.
 * Tolerant of Postgres/MySQL/SQLite dialect differences.
 */
export function parseSqlDdl(sql: string): Schema {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const relIds = new Set<string>();
  if (!sql) return { entities, relationships };

  // Strip comments.
  const cleaned = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Match CREATE TABLE blocks.
  const tableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"\[]?([a-zA-Z0-9_.\-]+)[`"\]]?\s*\(([\s\S]*?)\)\s*(?:;|(?=create\s+table)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(cleaned)) !== null) {
    const tableRaw = m[1];
    const body = m[2];
    const name = normalizeEntityName(tableRaw.split(".").pop() || tableRaw);
    if (!name) continue;
    const columns: Column[] = [];
    const tableFks: Relationship[] = [];
    const pkCols = new Set<string>();
    const ukCols = new Set<string>();

    // Split body on top-level commas (commas not inside parens).
    const parts = splitTopLevel(body, ",");
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (!part) continue;
      const lower = part.toLowerCase();

      // Constraint-only lines.
      if (lower.startsWith("primary key")) {
        const cols = parseColumnList(part.replace(/^primary\s+key\s*/i, ""));
        cols.forEach((c) => pkCols.add(c));
        continue;
      }
      if (lower.startsWith("unique")) {
        const cols = parseColumnList(part.replace(/^unique\s*/i, "").replace(/^key\s*/i, ""));
        cols.forEach((c) => ukCols.add(c));
        continue;
      }
      if (lower.startsWith("foreign key")) {
        const fkMatch = part.match(/foreign\s+key\s*\(([^)]+)\)\s+references\s+[`"\[]?([a-zA-Z0-9_.\-]+)[`"\]]?\s*(?:\(([^)]+)\))?/i);
        if (fkMatch) {
          const fromCol = normalizeColumnName(fkMatch[1].split(",")[0].trim());
          const toTable = normalizeEntityName(fkMatch[2].split(".").pop() || fkMatch[2]);
          const toCol = fkMatch[3] ? normalizeColumnName(fkMatch[3].split(",")[0].trim()) : "id";
          tableFks.push({
            id: "",
            from: name,
            to: toTable,
            type: "1:N",
            fromField: fromCol,
            toField: toCol,
          });
          // Mark the column as FK.
          const col = columns.find((c) => c.name === fromCol);
          if (col && !col.keys.includes("FK")) col.keys.push("FK");
        }
        continue;
      }
      if (lower.startsWith("constraint") || lower.startsWith("check") || lower.startsWith("index") || lower.startsWith("key")) {
        // Skip non-column constraints we don't model deeply.
        continue;
      }

      // Column definition: <name> <type> [modifiers...]
      const colMatch = part.match(/^([`"\[]?[a-zA-Z_][a-zA-Z0-9_]*[`"\]]?)\s+([a-zA-Z][a-zA-Z0-9_ (.)]*?)(\s+(.*))?$/);
      if (!colMatch) continue;
      const colName = normalizeColumnName(colMatch[1]);
      if (!colName) continue;
      const rawType = colMatch[2].trim();
      const type = mapType(rawType);
      const rest = (colMatch[4] || "").trim();
      const lowerRest = rest.toLowerCase();

      const keys: ColumnKey[] = [];
      let nullable = true;
      let defaultValue: string | undefined;
      let references: { entity: string; column: string } | undefined;
      let note: string | undefined;

      if (/\bprimary\s+key\b/i.test(rest)) {
        keys.push("PK");
        nullable = false;
        pkCols.add(colName);
      }
      if (/\bunique\b/i.test(rest)) {
        keys.push("UK");
        ukCols.add(colName);
      }
      if (/\bnot\s+null\b/i.test(rest)) nullable = false;
      const defMatch = rest.match(/\bdefault\s+([^,]+)/i);
      if (defMatch) defaultValue = defMatch[1].trim();
      const refMatch = rest.match(/\breferences\s+[`"\[]?([a-zA-Z0-9_.\-]+)[`"\]]?\s*(?:\(([^)]+)\))?/i);
      if (refMatch) {
        keys.push("FK");
        const toTable = normalizeEntityName(refMatch[1].split(".").pop() || refMatch[1]);
        const toCol = refMatch[2] ? normalizeColumnName(refMatch[2].split(",")[0].trim()) : "id";
        references = { entity: toTable, column: toCol };
        tableFks.push({
          id: "",
          from: name,
          to: toTable,
          type: "1:N",
          fromField: colName,
          toField: toCol,
        });
      }
      const checkMatch = rest.match(/\bcheck\s*\(([^)]+)\)/i);
      if (checkMatch) note = `CHECK(${checkMatch[1].trim()})`;

      columns.push({
        name: colName,
        type,
        rawType,
        nullable,
        defaultValue,
        keys,
        references,
        note,
      });
    }

    // Apply table-level PK / UK to columns.
    for (const col of columns) {
      if (pkCols.has(col.name) && !col.keys.includes("PK")) {
        col.keys.push("PK");
        col.nullable = false;
      }
      if (ukCols.has(col.name) && !col.keys.includes("UK")) col.keys.push("UK");
    }

    entities.push({ name, columns });
    tableFks.forEach((r) => {
      const id = relKey(r);
      if (!relIds.has(id)) {
        relIds.add(id);
        r.id = id;
        relationships.push(r);
      }
    });
  }

  return { entities, relationships };
}

/** Split a string on a separator, but not inside parentheses or quotes. */
export function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let current = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      current += ch;
      if (ch === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; current += ch; continue; }
    if (ch === "(") { depth++; current += ch; continue; }
    if (ch === ")") { depth--; current += ch; continue; }
    if (ch === sep && depth === 0) { out.push(current); current = ""; continue; }
    current += ch;
  }
  out.push(current);
  return out;
}

/** Parse a parenthesized column list like "(a, b, c)" or "a, b, c" into normalized names. */
export function parseColumnList(s: string): string[] {
  const cleaned = s.replace(/^\s*\(/, "").replace(/\)\s*$/, "").trim();
  if (!cleaned) return [];
  return splitTopLevel(cleaned, ",").map((c) => normalizeColumnName(c)).filter(Boolean);
}

// ---------- NL parser ----------

/**
 * Parse a plain-English schema description into a Schema.
 *
 * Recognized forms (one per line, semicolon-separated, or blank-line-separated):
 *   - "Table users has columns: id (pk), email (unique), name"
 *   - "users has many posts"
 *   - "posts belongs to users"
 *   - "users has one profile"
 *   - "users many-to-many tags via user_tags"
 *   - "users: id (pk, int), email (varchar, unique), name (text)"
 */
export function parseNaturalLanguage(nl: string): Schema {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const relIds = new Set<string>();
  if (!nl) return { entities, relationships };

  // Split on blank lines or semicolons.
  const lines = nl
    .replace(/\r/g, "")
    .split(/\n\s*\n|;/)
    .flatMap((b) => b.split("\n"))
    .map((l) => l.trim())
    .filter(Boolean);

  const ensureEntity = (name: string): Entity => {
    const n = normalizeEntityName(name);
    let e = entities.find((x) => x.name === n);
    if (!e) {
      e = { name: n, columns: [] };
      entities.push(e);
    }
    return e;
  };

  for (const line of lines) {
    const lower = line.toLowerCase();

    // "Table X has columns: ..."  OR  "X: a (pk), b, c"
    const colMatch = line.match(/^(?:table\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::|has\s+columns?\s*:?)\s*(.+)$/i);
    if (colMatch && !lower.includes(" has many ") && !lower.includes(" has one ") && !lower.includes(" belongs to ") && !lower.includes(" many-to-many ")) {
      const e = ensureEntity(colMatch[1]);
      const colsRaw = splitTopLevel(colMatch[2], ",");
      for (const c of colsRaw) {
        const parsed = parseColumnSpec(c.trim());
        if (parsed) {
          // Don't duplicate if column already exists.
          if (!e.columns.find((x) => x.name === parsed.name)) e.columns.push(parsed);
        }
      }
      continue;
    }

    // "X has many Y"  -> X 1:N Y
    const hasMany = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+has\s+many\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (hasMany) {
      const from = normalizeEntityName(hasMany[1]);
      const to = normalizeEntityName(hasMany[2]);
      ensureEntity(from);
      ensureEntity(to);
      addRel(relationships, relIds, { id: "", from, to, type: "1:N" });
      continue;
    }

    // "X has one Y"  -> X 1:1 Y
    const hasOne = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+has\s+one\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (hasOne) {
      const from = normalizeEntityName(hasOne[1]);
      const to = normalizeEntityName(hasOne[2]);
      ensureEntity(from);
      ensureEntity(to);
      addRel(relationships, relIds, { id: "", from, to, type: "1:1" });
      continue;
    }

    // "X belongs to Y"  -> Y 1:N X
    const belongsTo = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+belongs\s+to\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (belongsTo) {
      const from = normalizeEntityName(belongsTo[1]);
      const to = normalizeEntityName(belongsTo[2]);
      ensureEntity(from);
      ensureEntity(to);
      addRel(relationships, relIds, { id: "", from: to, to: from, type: "1:N" });
      continue;
    }

    // "X many-to-many Y via Z"  -> N:M
    const m2m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+many[-\s]to[-\s]many\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+via\s+([a-zA-Z_][a-zA-Z0-9_]*))?$/i);
    if (m2m) {
      const a = normalizeEntityName(m2m[1]);
      const b = normalizeEntityName(m2m[2]);
      const via = m2m[3] ? normalizeEntityName(m2m[3]) : undefined;
      ensureEntity(a);
      ensureEntity(b);
      if (via) ensureEntity(via);
      addRel(relationships, relIds, { id: "", from: a, to: b, type: "N:M", via });
      continue;
    }
  }

  return { entities, relationships };
}

/** Parse a single column spec like "id (pk, int, unique)" or "email varchar unique". */
export function parseColumnSpec(spec: string): Column | null {
  if (!spec) return null;
  const tokens = spec.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  let name = "";
  let type: DbType = "unknown";
  let rawType: string | undefined;
  const keys: ColumnKey[] = [];
  let nullable = true;
  let defaultValue: string | undefined;

  // Pull parenthetical annotations.
  const parenMatch = spec.match(/\(([^)]*)\)/);
  const annotations = parenMatch ? parenMatch[1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];

  // First token = column name.
  name = normalizeColumnName(tokens[0]);
  if (!name) return null;

  // If type appears as second bare token (no parens), use it.
  if (tokens.length > 1 && !parenMatch) {
    rawType = tokens[1];
    type = mapType(rawType);
  }

  // If parenthetical has a type-like token, prefer it.
  for (const a of annotations) {
    const t = mapType(a);
    if (t !== "unknown") {
      rawType = a;
      type = t;
    }
    if (a === "pk" || a === "primary key") keys.push("PK");
    if (a === "fk" || a === "foreign key") keys.push("FK");
    if (a === "unique" || a === "uk") keys.push("UK");
    if (a === "not null" || a === "notnull" || a === "required") nullable = false;
    if (a.startsWith("default ")) defaultValue = a.slice(8);
  }

  // Standalone keywords outside parens.
  const lower = spec.toLowerCase();
  if (/\bprimary\s+key\b/.test(lower) || /\bpk\b/.test(lower)) {
    if (!keys.includes("PK")) keys.push("PK");
    nullable = false;
  }
  if (/\bunique\b/.test(lower) && !keys.includes("UK")) keys.push("UK");
  if (/\bnot\s+null\b/.test(lower)) nullable = false;

  return { name, type, rawType, nullable, defaultValue, keys };
}

// ---------- Relationship helpers ----------

function relKey(r: Relationship): string {
  if (r.type === "N:M") return `nm:${r.from}:${r.to}:${r.via ?? ""}`;
  return `${r.from}:${r.to}:${r.fromField ?? ""}:${r.toField ?? ""}`;
}

function addRel(rels: Relationship[], ids: Set<string>, r: Relationship): void {
  const id = relKey(r);
  if (ids.has(id)) return;
  ids.add(id);
  r.id = id;
  rels.push(r);
}

/**
 * Infer relationships from <table>_id naming conventions.
 * - posts.user_id → users.id (1:N)
 * - Tables with exactly two *_id columns → N:M junction (via this table)
 */
export function inferRelationships(entities: Entity[]): Relationship[] {
  const out: Relationship[] = [];
  const relIds = new Set<string>();
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));

  // Lookup that matches singular, plural, and exact forms.
  const findEntity = (name: string): Entity | undefined => {
    const n = name.toLowerCase();
    return byName.get(n) ?? byName.get(pluralize(n)) ?? byName.get(singularize(n));
  };

  for (const e of entities) {
    const fkCols = e.columns.filter((c) => c.name.endsWith("_id") || c.keys.includes("FK"));
    if (fkCols.length === 2 && e.columns.length <= 4) {
      // Candidate junction table.
      const a = fkCols[0];
      const b = fkCols[1];
      const aTarget = singularize(a.name.replace(/_id$/, ""));
      const bTarget = singularize(b.name.replace(/_id$/, ""));
      const aEntity = findEntity(aTarget);
      const bEntity = findEntity(bTarget);
      if (aEntity && bEntity) {
        addRel(out, relIds, {
          id: "",
          from: aEntity.name,
          to: bEntity.name,
          type: "N:M",
          via: e.name,
        });
        continue;
      }
    }
    for (const c of fkCols) {
      const target = c.references?.entity ?? singularize(c.name.replace(/_id$/, ""));
      if (!target || target.toLowerCase() === e.name.toLowerCase()) continue;
      const tEntity = findEntity(target);
      if (!tEntity) continue;
      addRel(out, relIds, {
        id: "",
        from: tEntity.name,
        to: e.name,
        type: "1:N",
        fromField: c.references?.column ?? "id",
        toField: c.name,
      });
    }
  }
  return out;
}

// ---------- Mermaid erDiagram generator ----------

/** Generate Mermaid erDiagram code from a Schema. */
export function generateMermaid(schema: Schema): string {
  const lines: string[] = ["erDiagram"];
  for (const e of schema.entities) {
    lines.push(`  ${e.name} {`);
    for (const c of e.columns) {
      const type = MERMAID_TYPE[c.type] || "UNKNOWN";
      const keys: string[] = [];
      if (c.keys.includes("PK")) keys.push("PK");
      if (c.keys.includes("FK")) keys.push("FK");
      if (c.keys.includes("UK")) keys.push("UK");
      const keyStr = keys.length > 0 ? ` ${keys.join(",")}` : "";
      lines.push(`    ${type} ${c.name}${keyStr}`);
    }
    lines.push(`  }`);
  }
  for (const r of schema.relationships) {
    lines.push(renderMermaidRelationship(r));
  }
  let out = lines.join("\n");
  if (schema.title) out = `---\ntitle: ${sanitizeMermaidNote(schema.title)}\n---\n${out}`;
  return out;
}

/** Render one Mermaid relationship line with crow's-foot cardinality. */
export function renderMermaidRelationship(r: Relationship): string {
  // Mermaid erDiagram syntax: A ||--o{ B : "label"
  // Cardinality markers:
  //   |o = zero or one
  //   || = exactly one
  //   }o = zero or more
  //   }| = one or more
  let leftMarker: string;
  let rightMarker: string;
  if (r.type === "1:1") {
    leftMarker = "||";
    rightMarker = "||";
  } else if (r.type === "1:N") {
    leftMarker = "||";
    rightMarker = "}o";
  } else {
    // N:M
    leftMarker = "}o";
    rightMarker = "}o";
  }
  const label = r.label || r.via
    ? `${r.label ? r.label + " " : ""}${r.via ? "(via " + r.via + ")" : ""}`.trim()
    : "has";
  return `  ${r.from} ${leftMarker}--${rightMarker} ${r.to} : "${sanitizeMermaidNote(label)}"`;
}

function sanitizeMermaidNote(s: string): string {
  // Mermaid notes can't contain unescaped quotes or newlines.
  return s.replace(/[\n\r]/g, " ").replace(/"/g, "'").trim();
}

// ---------- DBML generator ----------

/** Generate DBML code (dbdiagram.io) from a Schema. */
export function generateDbml(schema: Schema): string {
  const lines: string[] = [];
  if (schema.title) lines.push(`// ${schema.title}`);
  for (const e of schema.entities) {
    lines.push(`Table ${e.name} {`);
    for (const c of e.columns) {
      const type = (c.rawType || MERMAID_TYPE[c.type] || "unknown").toUpperCase();
      const parts: string[] = [type, c.name];
      if (c.keys.includes("PK")) parts.push("[pk]");
      else if (c.keys.includes("UK")) parts.push("[unique]");
      if (!c.nullable && !c.keys.includes("PK")) parts.push("[not null]");
      lines.push(`  ${parts.join(" ")}`);
    }
    if (e.note) lines.push(`  Note: '${e.note.replace(/'/g, "\\'")}'`);
    lines.push(`}`);
    lines.push("");
  }
  for (const r of schema.relationships) {
    if (r.type === "N:M") {
      // Many-to-many: emit a Ref using the via junction if present.
      if (r.via) {
        lines.push(`Ref: ${r.via}.${singularize(r.from).toLowerCase()}_id > ${r.from}.id`);
        lines.push(`Ref: ${r.via}.${singularize(r.to).toLowerCase()}_id > ${r.to}.id`);
      } else {
        lines.push(`Ref: ${r.from}.id <> ${r.to}.id`);
      }
    } else if (r.fromField && r.toField) {
      // r.from is the parent (one side), r.to is the child (many side).
      // DBML `>` points from the many side to the one side.
      const rel = r.type === "1:1" ? "-" : ">";
      lines.push(`Ref: ${r.to}.${r.toField} ${rel} ${r.from}.${r.fromField}`);
    } else {
      const rel = r.type === "1:1" ? "-" : ">";
      lines.push(`Ref: ${r.to}.id ${rel} ${r.from}.id`);
    }
  }
  return lines.join("\n");
}

// ---------- Text / CSV / share ----------

/** Render a CSV of all columns: entity,column,type,nullable,keys. */
export function renderCsv(schema: Schema): string {
  const rows = ["entity,column,type,nullable,keys"];
  for (const e of schema.entities) {
    for (const c of e.columns) {
      rows.push([
        escapeCsv(e.name),
        escapeCsv(c.name),
        c.rawType || MERMAID_TYPE[c.type],
        c.nullable ? "true" : "false",
        (c.keys.filter(Boolean) as string[]).join("|"),
      ].join(","));
    }
  }
  return rows.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a plain-text summary of the schema. */
export function renderText(schema: Schema): string {
  const lines: string[] = [];
  if (schema.title) lines.push(`# ${schema.title}`, "");
  for (const e of schema.entities) {
    lines.push(`Table ${e.name}:`);
    for (const c of e.columns) {
      const k = c.keys.length > 0 ? ` [${c.keys.join(",")}]` : "";
      const nn = c.nullable ? "" : " NOT NULL";
      lines.push(`  - ${c.name} ${c.rawType || MERMAID_TYPE[c.type]}${k}${nn}`);
    }
    lines.push("");
  }
  if (schema.relationships.length > 0) {
    lines.push("Relationships:");
    for (const r of schema.relationships) {
      const via = r.via ? ` (via ${r.via})` : "";
      lines.push(`  - ${r.from} ${r.type} ${r.to}${via}`);
    }
  }
  return lines.join("\n");
}

/** Build a mermaid.live deep-link that opens with the given code preloaded. */
export function mermaidLiveUrl(code: string): string {
  // mermaid.live accepts a base64-encoded JSON {code, mermaid: {...}, autoSync: true, ...}.
  const payload = JSON.stringify({
    code,
    mermaid: { theme: "default" },
    autoSync: true,
    updateDiagram: true,
  });
  // Use encodeURIComponent -> base64 (browser-safe).
  const b64 = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(payload)))
    : Buffer.from(payload, "utf8").toString("base64");
  return `https://mermaid.live/edit#base64:${b64}`;
}

// ---------- Validation ----------

/** Validate a schema for structural issues. */
export function validateSchema(schema: Schema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (schema.entities.length === 0) {
    errors.push("Schema has no entities.");
  }

  const names = new Set<string>();
  for (const e of schema.entities) {
    if (!e.name) errors.push(`Entity with empty name.`);
    if (names.has(e.name)) errors.push(`Duplicate entity name: ${e.name}`);
    names.add(e.name);
    if (e.columns.length === 0) warnings.push(`Entity "${e.name}" has no columns.`);
    const colNames = new Set<string>();
    let hasPk = false;
    for (const c of e.columns) {
      if (!c.name) errors.push(`Entity "${e.name}" has a column with empty name.`);
      if (colNames.has(c.name)) errors.push(`Duplicate column in "${e.name}": ${c.name}`);
      colNames.add(c.name);
      if (c.keys.includes("PK")) hasPk = true;
    }
    if (e.columns.length > 0 && !hasPk) {
      warnings.push(`Entity "${e.name}" has no primary key column.`);
    }
  }

  for (const r of schema.relationships) {
    if (!names.has(r.from)) errors.push(`Relationship references missing entity: ${r.from}`);
    if (!names.has(r.to)) errors.push(`Relationship references missing entity: ${r.to}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("src", state.source);
  if (state.input) params.set("s", state.input);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { source: "nl", input: "" };
  const params = new URLSearchParams(clean);
  const src = params.get("src");
  const source = src === "sql" ? "sql" : "nl";
  const input = params.get("s") ?? "";
  return { source, input };
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(nl: string): string {
  return [
    "You are a database architect. Convert the user's plain-English schema description",
    "into a clean SQL DDL (Postgres dialect) with PRIMARY KEY, FOREIGN KEY ... REFERENCES,",
    "and UNIQUE constraints. Output ONLY the SQL DDL — no prose, no markdown fences.",
    "",
    "User description:",
    nl,
  ].join("\n");
}

export interface LlmEnhancement {
  sql: string;
  suggestions: string[];
}

export function renderLlmResult(raw: string): LlmEnhancement {
  // Strip markdown fences if present.
  const sql = raw.replace(/^```(?:sql)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return { sql, suggestions: [] };
}

// ---------- Utility ----------
