/**
 * MongoDB Query Builder — pure logic.
 *
 * Visual MQL filter builder for MongoDB. Supports the common operators
 * ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex, $exists, $type,
 * $size, $elemMatch, $not, $mod), AND/OR/NOR grouping with nesting,
 * projection, sort, limit, skip, plus operation modes (find / findOne /
 * insertOne / updateMany / updateOne / replaceOne / deleteMany /
 * deleteOne). Generates clean MQL JSON, mongosh, and driver code for
 * Node / Python / Java / C# / PHP. Also runs an in-browser MQL filter
 * engine on pasted sample documents.
 *
 * 100% client-side. No DOM, no network. Pure functions only.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueryOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$in"
  | "$nin"
  | "$regex"
  | "$exists"
  | "$type"
  | "$size"
  | "$mod"
  | "$not";

export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "objectId"
  | "date";

export type LogicOp = "and" | "or" | "nor";

export type Operation =
  | "find"
  | "findOne"
  | "insertOne"
  | "updateMany"
  | "updateOne"
  | "replaceOne"
  | "deleteMany"
  | "deleteOne";

export type DriverTarget =
  | "mongosh"
  | "node"
  | "python"
  | "java"
  | "csharp"
  | "php";

export interface Condition {
  id: string;
  field: string;
  op: QueryOperator;
  value: string;
  valueType: ValueType;
}

export interface Group {
  id: string;
  logic: LogicOp;
  conditions: Condition[];
  groups: Group[];
}

export interface ProjectionField {
  field: string;
  include: boolean;
}

export interface SortField {
  field: string;
  dir: 1 | -1;
}

export interface QueryState {
  collection: string;
  operation: Operation;
  root: Group;
  projection: ProjectionField[];
  sort: SortField[];
  limit: number | null;
  skip: number | null;
  updateDoc: string;
  insertDoc: string;
  replaceDoc: string;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const QUERY_OPERATORS: ReadonlyArray<{ value: QueryOperator; label: string }> = [
  { value: "$eq", label: "$eq — equals" },
  { value: "$ne", label: "$ne — not equals" },
  { value: "$gt", label: "$gt — greater than" },
  { value: "$gte", label: "$gte — greater than or equal" },
  { value: "$lt", label: "$lt — less than" },
  { value: "$lte", label: "$lte — less than or equal" },
  { value: "$in", label: "$in — in array" },
  { value: "$nin", label: "$nin — not in array" },
  { value: "$regex", label: "$regex — regex match" },
  { value: "$exists", label: "$exists — field exists" },
  { value: "$type", label: "$type — BSON type" },
  { value: "$size", label: "$size — array length" },
  { value: "$mod", label: "$mod — modulo" },
  { value: "$not", label: "$not — negation" },
];

export const VALUE_TYPES: ReadonlyArray<{ value: ValueType; label: string }> = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "null", label: "Null" },
  { value: "objectId", label: "ObjectId" },
  { value: "date", label: "ISODate" },
];

export const LOGIC_OPS: ReadonlyArray<{ value: LogicOp; label: string }> = [
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
  { value: "nor", label: "NOR" },
];

export const OPERATIONS: ReadonlyArray<{ value: Operation; label: string }> = [
  { value: "find", label: "find() — query" },
  { value: "findOne", label: "findOne() — single doc" },
  { value: "insertOne", label: "insertOne() — insert doc" },
  { value: "updateMany", label: "updateMany() — update multi" },
  { value: "updateOne", label: "updateOne() — update one" },
  { value: "replaceOne", label: "replaceOne() — replace doc" },
  { value: "deleteMany", label: "deleteMany() — delete multi" },
  { value: "deleteOne", label: "deleteOne() — delete one" },
];

export const DRIVER_TARGETS: ReadonlyArray<{ value: DriverTarget; label: string }> = [
  { value: "mongosh", label: "mongosh (shell)" },
  { value: "node", label: "Node.js (driver)" },
  { value: "python", label: "Python (PyMongo)" },
  { value: "java", label: "Java (driver)" },
  { value: "csharp", label: "C# (.NET driver)" },
  { value: "php", label: "PHP (driver)" },
];

/** Operators that ignore the value field in the UI. */
export const VALUELESS_OPS: ReadonlyArray<QueryOperator> = ["$exists"];

/** Operators that take an array literal. */
export const ARRAY_OPS: ReadonlyArray<QueryOperator> = ["$in", "$nin"];

/** Operators that take a sub-document of operators (e.g. {$gt: 5}). */
export const SUBDOC_OPS: ReadonlyArray<QueryOperator> = ["$not"];

/** Operators that take a number for $size / $mod. */
export const NUMERIC_OPS: ReadonlyArray<QueryOperator> = ["$size"];

let _idCounter = 0;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createEmptyCondition(): Condition {
  return {
    id: nextId("c"),
    field: "",
    op: "$eq",
    value: "",
    valueType: "string",
  };
}

export function createEmptyGroup(logic: LogicOp = "and"): Group {
  return {
    id: nextId("g"),
    logic,
    conditions: [createEmptyCondition()],
    groups: [],
  };
}

export function createDefaultState(): QueryState {
  return {
    collection: "myCollection",
    operation: "find",
    root: createEmptyGroup("and"),
    projection: [],
    sort: [],
    limit: null,
    skip: null,
    updateDoc: '{\n  "$set": { "field": "value" }\n}',
    insertDoc: '{\n  "name": "Alice",\n  "age": 30\n}',
    replaceDoc: '{\n  "name": "Alice",\n  "age": 30\n}',
  };
}

// ---------------------------------------------------------------------------
// Value parsing — converts the raw text input to a JS-native value that
// matches the BSON representation we use in the generated JSON.
// ---------------------------------------------------------------------------

export interface ParsedValue {
  ok: boolean;
  value: unknown;
  /** Extended-JSON form for output to drivers (e.g. {$oid: ...}, {$date: ...}). */
  extended: unknown;
  /** mongosh literal form (e.g. ObjectId("..."), ISODate("...")). */
  shell: string;
  error?: string;
}

export function parseValue(raw: string, type: ValueType): ParsedValue {
  const trimmed = (raw ?? "").trim();
  switch (type) {
    case "string":
      return { ok: true, value: trimmed, extended: trimmed, shell: JSON.stringify(trimmed) };
    case "number": {
      if (!trimmed) return { ok: false, value: null, extended: null, shell: "", error: "Number is empty." };
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return { ok: false, value: null, extended: null, shell: "", error: `"${trimmed}" is not a finite number.` };
      return { ok: true, value: n, extended: n, shell: String(n) };
    }
    case "boolean": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") {
        return { ok: true, value: true, extended: true, shell: "true" };
      }
      if (lower === "false" || lower === "0" || lower === "no" || trimmed === "") {
        return { ok: true, value: false, extended: false, shell: "false" };
      }
      return { ok: false, value: null, extended: null, shell: "", error: `"${trimmed}" is not a boolean.` };
    }
    case "null":
      return { ok: true, value: null, extended: null, shell: "null" };
    case "objectId": {
      if (!/^[0-9a-fA-F]{24}$/.test(trimmed)) {
        return { ok: false, value: null, extended: null, shell: "", error: "ObjectId must be 24 hex characters." };
      }
      return {
        ok: true,
        value: trimmed,
        extended: { $oid: trimmed },
        shell: `ObjectId("${trimmed}")`,
      };
    }
    case "date": {
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) {
        return { ok: false, value: null, extended: null, shell: "", error: `"${trimmed}" is not a valid date.` };
      }
      const iso = d.toISOString();
      return {
        ok: true,
        value: iso,
        extended: { $date: iso },
        shell: `ISODate("${iso}")`,
      };
    }
    default:
      return { ok: false, value: null, extended: null, shell: "", error: "Unknown value type." };
  }
}

/** Parse an array literal like "1, 2, 3" or `["a","b"]`. */
export function parseArrayValue(raw: string, type: ValueType): { ok: true; values: unknown[]; extended: unknown[]; shell: string } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, values: [], extended: [], shell: "[]" };
  // Try JSON first
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr)) return { ok: false, error: "Not an array." };
      const values: unknown[] = [];
      const extended: unknown[] = [];
      for (const item of arr) {
        if (typeof item === "string") {
          const p = parseValue(item, "string");
          values.push(p.value); extended.push(p.extended);
        } else if (typeof item === "number" || typeof item === "boolean" || item === null) {
          values.push(item); extended.push(item);
        } else {
          values.push(item); extended.push(item);
        }
      }
      return { ok: true, values, extended, shell: JSON.stringify(arr) };
    } catch {
      return { ok: false, error: "Invalid JSON array." };
    }
  }
  // Comma-separated
  const parts = splitTopLevel(trimmed);
  const values: unknown[] = [];
  const extended: unknown[] = [];
  for (const part of parts) {
    const p = parseValue(part, type);
    if (!p.ok) return { ok: false, error: p.error ?? "Parse error." };
    values.push(p.value);
    extended.push(p.extended);
  }
  return { ok: true, values, extended, shell: `[${extended.map((e) => JSON.stringify(e)).join(", ")}]` };
}

/** Split a string on top-level commas (respecting brackets/quotes). */
export function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && input[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; cur += ch; continue; }
    if (ch === "[" || ch === "{" || ch === "(") { depth++; cur += ch; continue; }
    if (ch === "]" || ch === "}" || ch === ")") { depth--; cur += ch; continue; }
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------------------
// MQL generation (Extended JSON form)
// ---------------------------------------------------------------------------

export function conditionToMql(cond: Condition): { ok: true; mql: Record<string, unknown> } | { ok: false; error: string } {
  if (!cond.field.trim()) {
    return { ok: false, error: "Field is required." };
  }
  if (!validateField(cond.field).ok) {
    return { ok: false, error: `Invalid field name: "${cond.field}".` };
  }
  // $exists is special — value is a boolean
  if (cond.op === "$exists") {
    const p = parseValue(cond.value || "true", "boolean");
    if (!p.ok) return { ok: false, error: p.error ?? "Invalid $exists value." };
    return { ok: true, mql: { [cond.field]: { $exists: p.value } } };
  }
  // $size — integer
  if (cond.op === "$size") {
    const p = parseValue(cond.value, "number");
    if (!p.ok) return { ok: false, error: p.error ?? "Invalid $size value." };
    return { ok: true, mql: { [cond.field]: { $size: p.value } } };
  }
  // $mod — [divisor, remainder]
  if (cond.op === "$mod") {
    const arr = parseArrayValue(cond.value, "number");
    if (!arr.ok) return { ok: false, error: arr.error };
    if (arr.values.length !== 2) return { ok: false, error: "$mod needs [divisor, remainder]." };
    return { ok: true, mql: { [cond.field]: { $mod: arr.values } } };
  }
  // $in / $nin — array
  if (ARRAY_OPS.includes(cond.op)) {
    const arr = parseArrayValue(cond.value, cond.valueType);
    if (!arr.ok) return { ok: false, error: arr.error };
    return { ok: true, mql: { [cond.field]: { [cond.op]: arr.extended } } };
  }
  // $not — sub-document of operators (we accept JSON like {"$gt": 5})
  if (cond.op === "$not") {
    try {
      const sub = JSON.parse(cond.value || "{}");
      if (typeof sub !== "object" || sub === null || Array.isArray(sub)) {
        return { ok: false, error: "$not value must be a JSON object." };
      }
      return { ok: true, mql: { [cond.field]: { $not: sub } } };
    } catch {
      return { ok: false, error: "$not value must be valid JSON." };
    }
  }
  // $regex — string
  if (cond.op === "$regex") {
    return { ok: true, mql: { [cond.field]: { $regex: cond.value } } };
  }
  // $type — string or number
  if (cond.op === "$type") {
    const p = parseValue(cond.value, cond.valueType);
    if (!p.ok) return { ok: false, error: p.error ?? "Invalid $type value." };
    return { ok: true, mql: { [cond.field]: { $type: p.extended } } };
  }
  // Default: comparison operators
  const p = parseValue(cond.value, cond.valueType);
  if (!p.ok) return { ok: false, error: p.error ?? "Invalid value." };
  return { ok: true, mql: { [cond.field]: { [cond.op]: p.extended } } };
}

export function groupToMql(group: Group): { ok: true; mql: Record<string, unknown> } | { ok: false; error: string } {
  const subFilters: Record<string, unknown>[] = [];
  for (const cond of group.conditions) {
    if (!cond.field.trim()) continue; // skip empty conditions
    const c = conditionToMql(cond);
    if (!c.ok) return c;
    subFilters.push(c.mql);
  }
  for (const sub of group.groups) {
    const g = groupToMql(sub);
    if (!g.ok) return g;
    subFilters.push(g.mql);
  }
  if (subFilters.length === 0) {
    return { ok: true, mql: {} };
  }
  if (subFilters.length === 1) {
    return { ok: true, mql: subFilters[0] };
  }
  const key = `$${group.logic}`;
  return { ok: true, mql: { [key]: subFilters } };
}

/** Convert the whole state to a filter document (Extended JSON). */
export function stateToFilter(state: QueryState): { ok: true; filter: Record<string, unknown> } | { ok: false; error: string } {
  const r = groupToMql(state.root);
  if (!r.ok) return r;
  return { ok: true, filter: r.mql };
}

/** Convert projection/sort/limit/skip to a mongosh options object. */
export function stateToOptions(state: QueryState): {
  projection: Record<string, 0 | 1> | null;
  sort: Record<string, 1 | -1> | null;
  limit: number | null;
  skip: number | null;
} {
  let projection: Record<string, 0 | 1> | null = null;
  if (state.projection.length > 0) {
    projection = {};
    for (const p of state.projection) {
      if (p.field.trim()) projection[p.field] = p.include ? 1 : 0;
    }
    if (Object.keys(projection).length === 0) projection = null;
  }
  let sort: Record<string, 1 | -1> | null = null;
  if (state.sort.length > 0) {
    sort = {};
    for (const s of state.sort) {
      if (s.field.trim()) sort[s.field] = s.dir;
    }
    if (Object.keys(sort).length === 0) sort = null;
  }
  return { projection, sort, limit: state.limit, skip: state.skip };
}

// ---------------------------------------------------------------------------
// Pretty JSON helpers — never throws; emits safe JSON.
// ---------------------------------------------------------------------------

export function safeStringify(obj: unknown, indent = 2): string {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
}

// ---------------------------------------------------------------------------
// Full MQL / shell / driver-code generation
// ---------------------------------------------------------------------------

export function generateMqlJson(state: QueryState): { ok: true; output: string } | { ok: false; error: string } {
  const f = stateToFilter(state);
  if (!f.ok) return f;
  const opts = stateToOptions(state);
  const out: Record<string, unknown> = { filter: f.filter };
  if (opts.projection) out.projection = opts.projection;
  if (opts.sort) out.sort = opts.sort;
  if (opts.limit != null) out.limit = opts.limit;
  if (opts.skip != null) out.skip = opts.skip;
  return { ok: true, output: safeStringify(out) };
}

export function generateMqlShell(state: QueryState): { ok: true; output: string } | { ok: false; error: string } {
  const f = stateToFilter(state);
  if (!f.ok) return f;
  const opts = stateToOptions(state);
  const coll = state.collection || "myCollection";
  const filterStr = safeStringify(f.filter);
  switch (state.operation) {
    case "find":
    case "findOne": {
      const projStr = opts.projection ? `, ${safeStringify(opts.projection)}` : "";
      let line = `db.${coll}.${state.operation}(${filterStr}${projStr})`;
      if (opts.sort) line += `.sort(${safeStringify(opts.sort)})`;
      if (opts.limit != null) line += `.limit(${opts.limit})`;
      if (opts.skip != null) line += `.skip(${opts.skip})`;
      return { ok: true, output: line };
    }
    case "insertOne": {
      const doc = safeJsonParse(state.insertDoc);
      if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
      return { ok: true, output: `db.${coll}.insertOne(${safeStringify(doc.value)})` };
    }
    case "updateMany":
    case "updateOne": {
      const upd = safeJsonParse(state.updateDoc);
      if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
      return { ok: true, output: `db.${coll}.${state.operation}(${filterStr}, ${safeStringify(upd.value)})` };
    }
    case "replaceOne": {
      const rep = safeJsonParse(state.replaceDoc);
      if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
      return { ok: true, output: `db.${coll}.replaceOne(${filterStr}, ${safeStringify(rep.value)})` };
    }
    case "deleteMany":
    case "deleteOne":
      return { ok: true, output: `db.${coll}.${state.operation}(${filterStr})` };
    default:
      return { ok: false, error: "Unknown operation." };
  }
}

export function generateDriverCode(state: QueryState, target: DriverTarget): { ok: true; output: string } | { ok: false; error: string } {
  const f = stateToFilter(state);
  if (!f.ok) return f;
  const shell = generateMqlShell(state);
  if (!shell.ok) return shell;
  const coll = state.collection || "myCollection";
  const filterStr = safeStringify(f.filter);
  const opts = stateToOptions(state);

  switch (target) {
    case "mongosh":
      return { ok: true, output: shell.output };
    case "node": {
      const lines: string[] = [
        `// Node.js MongoDB driver`,
        `const { MongoClient, ObjectId } = require("mongodb");`,
        ``,
        `async function run() {`,
        `  const client = new MongoClient(process.env.MONGO_URL || "mongodb://localhost:27017");`,
        `  await client.connect();`,
        `  const db = client.db("myDatabase");`,
        `  const collection = db.collection(${JSON.stringify(coll)});`,
      ];
      const filterExpr = `JSON.parse(${JSON.stringify(filterStr)})`;
      if (state.operation === "find" || state.operation === "findOne") {
        let chain = `collection.${state.operation}(${filterExpr}`;
        if (opts.projection) chain += `, { projection: ${safeStringify(opts.projection)} }`;
        chain += `)`;
        if (state.operation === "find") {
          if (opts.sort) chain += `.sort(${safeStringify(opts.sort)})`;
          if (opts.limit != null) chain += `.limit(${opts.limit})`;
          if (opts.skip != null) chain += `.skip(${opts.skip})`;
          lines.push(`  const docs = await ${chain}.toArray();`);
          lines.push(`  console.log(docs);`);
        } else {
          lines.push(`  const doc = await ${chain};`);
          lines.push(`  console.log(doc);`);
        }
      } else if (state.operation === "insertOne") {
        const doc = safeJsonParse(state.insertDoc);
        if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
        lines.push(`  const result = await collection.insertOne(${safeStringify(doc.value)});`);
        lines.push(`  console.log(result.insertedId);`);
      } else if (state.operation === "updateMany" || state.operation === "updateOne") {
        const upd = safeJsonParse(state.updateDoc);
        if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
        lines.push(`  const result = await collection.${state.operation}(${filterExpr}, ${safeStringify(upd.value)});`);
        lines.push(`  console.log(result.modifiedCount);`);
      } else if (state.operation === "replaceOne") {
        const rep = safeJsonParse(state.replaceDoc);
        if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
        lines.push(`  const result = await collection.replaceOne(${filterExpr}, ${safeStringify(rep.value)});`);
        lines.push(`  console.log(result.modifiedCount);`);
      } else {
        lines.push(`  const result = await collection.${state.operation}(${filterExpr});`);
        lines.push(`  console.log(result.deletedCount);`);
      }
      lines.push(`  await client.close();`);
      lines.push(`}`);
      lines.push(`run().catch(console.error);`);
      return { ok: true, output: lines.join("\n") };
    }
    case "python": {
      const lines: string[] = [
        `# Python (PyMongo)`,
        `from pymongo import MongoClient, ASCENDING, DESCENDING`,
        ``,
        `client = MongoClient("mongodb://localhost:27017")`,
        `db = client["myDatabase"]`,
        `collection = db[${JSON.stringify(coll)}]`,
        ``,
      ];
      const filterPy = pythonize(f.filter);
      if (state.operation === "find") {
        let chain = `collection.find(${filterPy}`;
        if (opts.projection) chain += `, ${pythonize(opts.projection)}`;
        chain += `)`;
        if (opts.sort) {
          const sortPy = state.sort.filter(s => s.field.trim()).map(s => `(${JSON.stringify(s.field)}, ${s.dir > 0 ? "ASCENDING" : "DESCENDING"})`).join(", ");
          chain += `.sort([${sortPy}])`;
        }
        if (opts.limit != null) chain += `.limit(${opts.limit})`;
        if (opts.skip != null) chain += `.skip(${opts.skip})`;
        lines.push(`for doc in ${chain}:`);
        lines.push(`    print(doc)`);
      } else if (state.operation === "findOne") {
        let chain = `collection.find_one(${filterPy}`;
        if (opts.projection) chain += `, ${pythonize(opts.projection)}`;
        chain += `)`;
        lines.push(`doc = ${chain}`);
        lines.push(`print(doc)`);
      } else if (state.operation === "insertOne") {
        const doc = safeJsonParse(state.insertDoc);
        if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
        lines.push(`result = collection.insert_one(${pythonize(doc.value)})`);
        lines.push(`print(result.inserted_id)`);
      } else if (state.operation === "updateMany" || state.operation === "updateOne") {
        const upd = safeJsonParse(state.updateDoc);
        if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
        const method = state.operation === "updateMany" ? "update_many" : "update_one";
        lines.push(`result = collection.${method}(${filterPy}, ${pythonize(upd.value)})`);
        lines.push(`print(result.modified_count)`);
      } else if (state.operation === "replaceOne") {
        const rep = safeJsonParse(state.replaceDoc);
        if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
        lines.push(`result = collection.replace_one(${filterPy}, ${pythonize(rep.value)})`);
        lines.push(`print(result.modified_count)`);
      } else {
        const method = state.operation === "deleteMany" ? "delete_many" : "delete_one";
        lines.push(`result = collection.${method}(${filterPy})`);
        lines.push(`print(result.deleted_count)`);
      }
      return { ok: true, output: lines.join("\n") };
    }
    case "java": {
      const lines: string[] = [
        `// Java MongoDB driver`,
        `import com.mongodb.client.*;`,
        `import com.mongodb.client.model.*;`,
        `import org.bson.Document;`,
        `import static com.mongodb.client.model.Filters.*;`,
        ``,
        `public class Main {`,
        `  public static void main(String[] args) {`,
        `    try (MongoClient client = MongoClients.create("mongodb://localhost:27017")) {`,
        `      MongoDatabase db = client.getDatabase("myDatabase");`,
        `      MongoCollection<Document> collection = db.getCollection(${JSON.stringify(coll)});`,
      ];
      const filterDoc = `Document.parse(${JSON.stringify(filterStr)})`;
      if (state.operation === "find") {
        lines.push(`      FindIterable<Document> it = collection.find(${filterDoc});`);
        if (opts.sort) lines.push(`      it.sort(Document.parse(${JSON.stringify(safeStringify(opts.sort))}));`);
        if (opts.limit != null) lines.push(`      it.limit(${opts.limit});`);
        if (opts.skip != null) lines.push(`      it.skip(${opts.skip});`);
        lines.push(`      for (Document doc : it) { System.out.println(doc.toJson()); }`);
      } else if (state.operation === "findOne") {
        lines.push(`      Document doc = collection.find(${filterDoc}).first();`);
        lines.push(`      System.out.println(doc == null ? "null" : doc.toJson());`);
      } else if (state.operation === "insertOne") {
        const doc = safeJsonParse(state.insertDoc);
        if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
        lines.push(`      collection.insertOne(Document.parse(${JSON.stringify(safeStringify(doc.value))}));`);
      } else if (state.operation === "updateMany" || state.operation === "updateOne") {
        const upd = safeJsonParse(state.updateDoc);
        if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
        lines.push(`      collection.${state.operation}(${filterDoc}, Document.parse(${JSON.stringify(safeStringify(upd.value))}));`);
      } else if (state.operation === "replaceOne") {
        const rep = safeJsonParse(state.replaceDoc);
        if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
        lines.push(`      collection.replaceOne(${filterDoc}, Document.parse(${JSON.stringify(safeStringify(rep.value))}));`);
      } else {
        lines.push(`      collection.${state.operation}(${filterDoc});`);
      }
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push(`}`);
      return { ok: true, output: lines.join("\n") };
    }
    case "csharp": {
      const lines: string[] = [
        `// C# .NET MongoDB driver`,
        `using MongoDB.Driver;`,
        `using MongoDB.Bson;`,
        ``,
        `var client = new MongoClient("mongodb://localhost:27017");`,
        `var db = client.GetDatabase("myDatabase");`,
        `var collection = db.GetCollection<BsonDocument>(${JSON.stringify(coll)});`,
        ``,
      ];
      const filterBson = `BsonDocument.Parse(${JSON.stringify(filterStr)})`;
      if (state.operation === "find") {
        lines.push(`var filter = ${filterBson};`);
        let chain = `collection.Find(filter)`;
        if (opts.sort) chain += `.Sort(BsonDocument.Parse(${JSON.stringify(safeStringify(opts.sort))}))`;
        if (opts.limit != null) chain += `.Limit(${opts.limit})`;
        if (opts.skip != null) chain += `.Skip(${opts.skip})`;
        lines.push(`var docs = ${chain}.ToList();`);
        lines.push(`foreach (var doc in docs) Console.WriteLine(doc.ToJson());`);
      } else if (state.operation === "findOne") {
        lines.push(`var doc = collection.Find(${filterBson}).FirstOrDefault();`);
        lines.push(`Console.WriteLine(doc?.ToJson() ?? "null");`);
      } else if (state.operation === "insertOne") {
        const doc = safeJsonParse(state.insertDoc);
        if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
        lines.push(`await collection.InsertOneAsync(BsonDocument.Parse(${JSON.stringify(safeStringify(doc.value))}));`);
      } else if (state.operation === "updateMany" || state.operation === "updateOne") {
        const upd = safeJsonParse(state.updateDoc);
        if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
        const method = state.operation === "updateMany" ? "UpdateManyAsync" : "UpdateOneAsync";
        lines.push(`await collection.${method}(${filterBson}, BsonDocument.Parse(${JSON.stringify(safeStringify(upd.value))}));`);
      } else if (state.operation === "replaceOne") {
        const rep = safeJsonParse(state.replaceDoc);
        if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
        lines.push(`await collection.ReplaceOneAsync(${filterBson}, BsonDocument.Parse(${JSON.stringify(safeStringify(rep.value))}));`);
      } else {
        const method = state.operation === "deleteMany" ? "DeleteManyAsync" : "DeleteOneAsync";
        lines.push(`await collection.${method}(${filterBson});`);
      }
      return { ok: true, output: lines.join("\n") };
    }
    case "php": {
      const lines: string[] = [
        `<?php`,
        `// PHP MongoDB driver`,
        `require 'vendor/autoload.php';`,
        ``,
        `$client = new MongoDB\\Client("mongodb://localhost:27017");`,
        `$collection = $client->myDatabase->${phpSafeColl(coll)};`,
        ``,
      ];
      const filterPhp = phpize(f.filter);
      if (state.operation === "find") {
        let chain = `$collection->find(${filterPhp}`;
        if (opts.projection) chain += `, ['projection' => ${phpize(opts.projection)}]`;
        chain += `)`;
        if (opts.sort) chain += `->sort(${phpize(opts.sort)})`;
        if (opts.limit != null) chain += `->limit(${opts.limit})`;
        if (opts.skip != null) chain += `->skip(${opts.skip})`;
        lines.push(`foreach (${chain} as $doc) {`);
        lines.push(`    var_dump($doc);`);
        lines.push(`}`);
      } else if (state.operation === "findOne") {
        lines.push(`$doc = $collection->findOne(${filterPhp});`);
        lines.push(`var_dump($doc);`);
      } else if (state.operation === "insertOne") {
        const doc = safeJsonParse(state.insertDoc);
        if (!doc.ok) return { ok: false, error: `Insert doc: ${doc.error}` };
        lines.push(`$result = $collection->insertOne(${phpize(doc.value)});`);
        lines.push(`echo $result->getInsertedId();`);
      } else if (state.operation === "updateMany" || state.operation === "updateOne") {
        const upd = safeJsonParse(state.updateDoc);
        if (!upd.ok) return { ok: false, error: `Update doc: ${upd.error}` };
        const method = state.operation === "updateMany" ? "updateMany" : "updateOne";
        lines.push(`$result = $collection->${method}(${filterPhp}, ${phpize(upd.value)});`);
        lines.push(`echo $result->getModifiedCount();`);
      } else if (state.operation === "replaceOne") {
        const rep = safeJsonParse(state.replaceDoc);
        if (!rep.ok) return { ok: false, error: `Replace doc: ${rep.error}` };
        lines.push(`$result = $collection->replaceOne(${filterPhp}, ${phpize(rep.value)});`);
        lines.push(`echo $result->getModifiedCount();`);
      } else {
        const method = state.operation === "deleteMany" ? "deleteMany" : "deleteOne";
        lines.push(`$result = $collection->${method}(${filterPhp});`);
        lines.push(`echo $result->getDeletedCount();`);
      }
      return { ok: true, output: lines.join("\n") };
    }
    default:
      return { ok: false, error: "Unknown driver target." };
  }
}

function phpSafeColl(name: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return name;
  return `selectCollection('myDatabase', ${JSON.stringify(name)})`.replace("selectCollection", "$client->selectCollection");
}

// ---------------------------------------------------------------------------
// Tiny code-gen helpers (Python / PHP literal emitters)
// ---------------------------------------------------------------------------

function pythonize(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonize).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${pythonize(v)}`).join(", ")}}`;
  }
  return "None";
}

function phpize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(phpize).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `[${entries.map(([k, v]) => `${JSON.stringify(k)} => ${phpize(v)}`).join(", ")}]`;
  }
  return "null";
}

// ---------------------------------------------------------------------------
// Field validation & JSON doc validation
// ---------------------------------------------------------------------------

export function validateField(name: string): { ok: true } | { ok: false; error: string } {
  if (!name || !name.trim()) return { ok: false, error: "Field name is empty." };
  if (name.startsWith("$")) return { ok: false, error: 'Field names cannot start with "$".' };
  // Allow dot-notation; each segment must be a valid identifier or numeric index
  const parts = name.split(".");
  for (const p of parts) {
    if (!p) return { ok: false, error: "Empty path segment." };
    if (/[\s"$]/.test(p)) return { ok: false, error: `Field segment "${p}" contains invalid characters.` };
  }
  return { ok: true };
}

export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
  }
}

/** Validate that a JSON string is an object (not array / primitive). */
export function validateJsonDoc(raw: string): { ok: true } | { ok: false; error: string } {
  const p = safeJsonParse(raw);
  if (!p.ok) return p;
  if (typeof p.value !== "object" || p.value === null || Array.isArray(p.value)) {
    return { ok: false, error: "Document must be a JSON object." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// In-browser MQL filter engine — runs the generated filter against pasted
// sample documents. Supports the operators defined in QUERY_OPERATORS plus
// dot-notation field access.
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Resolve a dot-notation path against a document. */
export function getField(doc: unknown, path: string): unknown {
  if (doc == null) return undefined;
  const parts = path.split(".");
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      // For arrays, MongoDB matches if ANY element has the field.
      // For our purposes, return the first non-undefined value or an array
      // of resolved values when the path continues.
      const resolved = cur
        .map((item) => (item != null && typeof item === "object" ? (item as Record<string, unknown>)[p] : undefined))
        .filter((v) => v !== undefined);
      cur = resolved.length > 0 ? resolved[0] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Match a single value against an operator (not a sub-document). */
export function matchValue(docVal: unknown, op: QueryOperator, expected: unknown): boolean {
  switch (op) {
    case "$eq":
      return deepEqual(docVal, expected);
    case "$ne":
      return !deepEqual(docVal, expected);
    case "$gt":
      return typeof docVal === typeof expected && (docVal as never) > (expected as never);
    case "$gte":
      return typeof docVal === typeof expected && (docVal as never) >= (expected as never);
    case "$lt":
      return typeof docVal === typeof expected && (docVal as never) < (expected as never);
    case "$lte":
      return typeof docVal === typeof expected && (docVal as never) <= (expected as never);
    case "$in":
      if (!Array.isArray(expected)) return false;
      return expected.some((e) => deepEqual(docVal, e));
    case "$nin":
      if (!Array.isArray(expected)) return false;
      return !expected.some((e) => deepEqual(docVal, e));
    case "$exists":
      return (docVal !== undefined) === Boolean(expected);
    case "$regex":
      if (typeof docVal !== "string" || typeof expected !== "string") return false;
      try {
        return new RegExp(expected).test(docVal);
      } catch {
        return false;
      }
    case "$type":
      if (typeof expected === "string") {
        switch (expected) {
          case "string": return typeof docVal === "string";
          case "number": return typeof docVal === "number";
          case "bool": case "boolean": return typeof docVal === "boolean";
          case "null": return docVal === null;
          case "array": return Array.isArray(docVal);
          case "object": return typeof docVal === "object" && docVal !== null && !Array.isArray(docVal);
          default: return false;
        }
      }
      return false;
    case "$size":
      return Array.isArray(docVal) && docVal.length === Number(expected);
    case "$mod": {
      if (!Array.isArray(expected) || expected.length !== 2) return false;
      const divisor = Number(expected[0]);
      const remainder = Number(expected[1]);
      if (!Number.isFinite(divisor) || divisor === 0) return false;
      return typeof docVal === "number" && docVal % divisor === remainder;
    }
    case "$not":
      // expected is a sub-document of operators — apply each to docVal.
      if (typeof expected !== "object" || expected === null || Array.isArray(expected)) return false;
      for (const [k, v] of Object.entries(expected)) {
        if (k.startsWith("$")) {
          if (matchValue(docVal, k as QueryOperator, v)) return true; // $not inverts below
        }
      }
      return false; // $not means: NONE of the sub-conditions match
    default:
      return false;
  }
}

/** Match a document against a single condition's MQL output. */
export function matchCondition(doc: unknown, mql: Record<string, unknown>): boolean {
  for (const [field, spec] of Object.entries(mql)) {
    const docVal = getField(doc, field);
    if (typeof spec === "object" && spec !== null && !Array.isArray(spec)) {
      // Object spec — could be operator doc or exact-match object.
      const keys = Object.keys(spec);
      const allOps = keys.every((k) => k.startsWith("$"));
      if (allOps) {
        for (const [op, val] of Object.entries(spec)) {
          if (!matchValue(docVal, op as QueryOperator, val)) return false;
        }
      } else {
        // Exact object match (deep equality on sub-documents / arrays)
        if (!deepEqual(docVal, spec)) return false;
      }
    } else {
      // Direct equality
      if (!deepEqual(docVal, spec)) return false;
    }
  }
  return true;
}

/** Match a document against a filter (with $and/$or/$nor). */
export function matchFilter(doc: unknown, filter: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$and") {
      if (!Array.isArray(val)) return false;
      if (!val.every((sub) => typeof sub === "object" && sub !== null && matchFilter(doc, sub as Record<string, unknown>))) return false;
    } else if (key === "$or") {
      if (!Array.isArray(val)) return false;
      if (!val.some((sub) => typeof sub === "object" && sub !== null && matchFilter(doc, sub as Record<string, unknown>))) return false;
    } else if (key === "$nor") {
      if (!Array.isArray(val)) return false;
      if (val.some((sub) => typeof sub === "object" && sub !== null && matchFilter(doc, sub as Record<string, unknown>))) return false;
    } else if (key === "$not") {
      if (typeof val !== "object" || val === null) return false;
      if (matchCondition(doc, val as Record<string, unknown>)) return false;
    } else {
      // Field-level condition
      const sub: Record<string, unknown> = { [key]: val };
      if (!matchCondition(doc, sub)) return false;
    }
  }
  return true;
}

/** Run the engine: filter sample docs through the state's filter. */
export function runFilter(docs: unknown[], state: QueryState): { ok: true; matched: unknown[]; errors: string[] } | { ok: false; error: string } {
  const f = stateToFilter(state);
  if (!f.ok) return f;
  const matched: unknown[] = [];
  const errors: string[] = [];
  for (let i = 0; i < docs.length; i++) {
    try {
      if (matchFilter(docs[i], f.filter)) matched.push(docs[i]);
    } catch (e) {
      errors.push(`Doc #${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: true, matched, errors };
}

// ---------------------------------------------------------------------------
// Field extraction from sample documents (drives autocomplete)
// ---------------------------------------------------------------------------

export function extractFields(docs: unknown[], prefix = "", depth = 0): string[] {
  if (depth > 4) return [];
  const set = new Set<string>();
  for (const doc of docs) {
    if (doc == null || typeof doc !== "object" || Array.isArray(doc)) continue;
    for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      set.add(path);
      if (v != null && typeof v === "object" && !Array.isArray(v) && depth < 3) {
        for (const sub of extractFields([v], path, depth + 1)) set.add(sub);
      }
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && depth < 3) {
        for (const sub of extractFields(v, path, depth + 1)) set.add(sub);
      }
    }
  }
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mongodb-query-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  collection: string;
  operation: Operation;
  filterPreview: string;
  matched: number;
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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(state: QueryState): string {
  const params = new URLSearchParams();
  params.set("coll", state.collection);
  params.set("op", state.operation);
  try {
    params.set("f", JSON.stringify(state.root));
    params.set("p", JSON.stringify(state.projection));
    params.set("s", JSON.stringify(state.sort));
    if (state.limit != null) params.set("l", String(state.limit));
    if (state.skip != null) params.set("sk", String(state.skip));
  } catch {
    // ignore
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<QueryState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<QueryState> = {};
  const coll = params.get("coll");
  if (coll) out.collection = coll;
  const op = params.get("op");
  if (op && (OPERATIONS.map((o) => o.value) as string[]).includes(op)) out.operation = op as Operation;
  const f = params.get("f");
  if (f) {
    try {
      const parsed = JSON.parse(f);
      if (parsed && typeof parsed === "object" && "logic" in parsed) out.root = parsed as Group;
    } catch {
      // ignore
    }
  }
  const p = params.get("p");
  if (p) {
    try {
      const parsed = JSON.parse(p);
      if (Array.isArray(parsed)) out.projection = parsed;
    } catch {
      // ignore
    }
  }
  const s = params.get("s");
  if (s) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) out.sort = parsed;
    } catch {
      // ignore
    }
  }
  const l = params.get("l");
  if (l != null) {
    const ln = Number(l);
    if (Number.isFinite(ln) && ln >= 0) out.limit = ln;
  }
  const sk = params.get("sk");
  if (sk != null) {
    const sn = Number(sk);
    if (Number.isFinite(sn) && sn >= 0) out.skip = sn;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sample documents for the "Load sample" button
// ---------------------------------------------------------------------------

export const SAMPLE_DOCS = `[
  { "_id": "1", "name": "Alice", "age": 30, "active": true, "tags": ["admin", "vip"], "address": { "city": "NYC", "zip": "10001" }, "createdAt": "2024-01-15T10:30:00Z" },
  { "_id": "2", "name": "Bob", "age": 25, "active": false, "tags": ["user"], "address": { "city": "LA", "zip": "90001" }, "createdAt": "2024-02-20T08:00:00Z" },
  { "_id": "3", "name": "Carol", "age": 35, "active": true, "tags": ["admin", "user"], "address": { "city": "NYC", "zip": "10002" }, "createdAt": "2024-03-10T14:45:00Z" },
  { "_id": "4", "name": "Dave", "age": 28, "active": true, "tags": [], "address": { "city": "SF", "zip": "94101" }, "createdAt": "2024-04-05T09:15:00Z" }
]`;
