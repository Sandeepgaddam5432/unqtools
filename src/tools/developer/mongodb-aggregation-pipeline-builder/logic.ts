/**
 * MongoDB Aggregation Pipeline Builder — pure logic.
 *
 * Visual stage-by-stage builder for MongoDB aggregation pipelines.
 * Supports $match / $project / $group / $sort / $limit / $skip / $unwind /
 * $lookup / $addFields / $count / $facet with per-stage live preview,
 * accumulators ($sum, $avg, $push, $first, $last, $max, $min), expressions
 * ($cond, $switch, $concat, $toUpper, $toLower, $add, $multiply, $subtract,
 * $divide, $dateToString, $ifNull, $literal), driver-code export (mongosh,
 * Node, Python, Java, C#, PHP), shareable URL, and history.
 *
 * 100% client-side. No DOM, no network. Pure functions only.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StageType =
  | "$match"
  | "$project"
  | "$group"
  | "$sort"
  | "$limit"
  | "$skip"
  | "$unwind"
  | "$lookup"
  | "$addFields"
  | "$count"
  | "$facet";

export type DriverTarget =
  | "mongosh"
  | "node"
  | "python"
  | "java"
  | "csharp"
  | "php";

export interface Stage {
  id: string;
  type: StageType;
  enabled: boolean;
  /** Raw JSON spec for the stage. E.g. for $match: the filter doc. */
  spec: string;
}

export interface PipelineState {
  collection: string;
  stages: Stage[];
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const STAGE_TYPES: ReadonlyArray<{ value: StageType; label: string; hint: string }> = [
  { value: "$match", label: "$match", hint: "Filter documents (MQL)" },
  { value: "$project", label: "$project", hint: "Reshape / select fields" },
  { value: "$group", label: "$group", hint: "Group + accumulate" },
  { value: "$sort", label: "$sort", hint: "Sort by fields" },
  { value: "$limit", label: "$limit", hint: "Cap result count" },
  { value: "$skip", label: "$skip", hint: "Skip first N" },
  { value: "$unwind", label: "$unwind", hint: "Explode array field" },
  { value: "$lookup", label: "$lookup", hint: "Join another collection" },
  { value: "$addFields", label: "$addFields", hint: "Add computed fields" },
  { value: "$count", label: "$count", hint: "Count → single field" },
  { value: "$facet", label: "$facet", hint: "Parallel sub-pipelines" },
];

export const DRIVER_TARGETS: ReadonlyArray<{ value: DriverTarget; label: string }> = [
  { value: "mongosh", label: "mongosh (shell)" },
  { value: "node", label: "Node.js (driver)" },
  { value: "python", label: "Python (PyMongo)" },
  { value: "java", label: "Java (driver)" },
  { value: "csharp", label: "C# (.NET driver)" },
  { value: "php", label: "PHP (driver)" },
];

export const ACCUMULATORS = [
  "$sum", "$avg", "$push", "$first", "$last", "$max", "$min", "$count",
] as const;

export const EXPRESSIONS = [
  "$cond", "$switch", "$concat", "$toUpper", "$toLower", "$add",
  "$subtract", "$multiply", "$divide", "$dateToString", "$ifNull",
  "$literal", "$eq", "$ne", "$gt", "$lt", "$gte", "$lte", "$and", "$or",
] as const;

/** Default spec templates per stage type. */
export const STAGE_DEFAULTS: Record<StageType, string> = {
  $match: '{\n  "status": "active"\n}',
  $project: '{\n  "name": 1,\n  "age": 1,\n  "_id": 0\n}',
  $group: '{\n  "_id": "$category",\n  "count": { "$sum": 1 },\n  "total": { "$sum": "$amount" }\n}',
  $sort: '{\n  "createdAt": -1\n}',
  $limit: "10",
  $skip: "5",
  $unwind: '"$tags"',
  $lookup: '{\n  "from": "orders",\n  "localField": "_id",\n  "foreignField": "userId",\n  "as": "orders"\n}',
  $addFields: '{\n  "fullName": { "$concat": ["$first", " ", "$last"] }\n}',
  $count: '"total"',
  $facet: '{\n  "byCategory": [\n    { "$group": { "_id": "$category", "count": { "$sum": 1 } } }\n  ]\n}',
};

let _idCounter = 0;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createStage(type: StageType): Stage {
  return {
    id: nextId("s"),
    type,
    enabled: true,
    spec: STAGE_DEFAULTS[type],
  };
}

export function createDefaultState(): PipelineState {
  return {
    collection: "myCollection",
    stages: [createStage("$match")],
  };
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
  }
}

export function safeStringify(obj: unknown, indent = 2): string {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
}

// ---------------------------------------------------------------------------
// Stage validation per type
// ---------------------------------------------------------------------------

export function validateStage(stage: Stage): { ok: true } | { ok: false; error: string } {
  const p = safeJsonParse(stage.spec);
  if (!p.ok) return p;
  switch (stage.type) {
    case "$match":
    case "$project":
    case "$group":
    case "$sort":
    case "$lookup":
    case "$addFields":
    case "$facet":
      if (typeof p.value !== "object" || p.value === null || Array.isArray(p.value)) {
        return { ok: false, error: `${stage.type} spec must be a JSON object.` };
      }
      return { ok: true };
    case "$limit":
    case "$skip": {
      const n = Number(p.value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return { ok: false, error: `${stage.type} must be a non-negative integer.` };
      }
      return { ok: true };
    }
    case "$count":
      if (typeof p.value !== "string" || !p.value.trim()) {
        return { ok: false, error: "$count must be a string field name." };
      }
      return { ok: true };
    case "$unwind":
      if (typeof p.value === "string") return { ok: true };
      if (typeof p.value === "object" && p.value !== null && !Array.isArray(p.value) && "path" in p.value) {
        return { ok: true };
      }
      return { ok: false, error: "$unwind must be a path string or { path: ... } object." };
    default:
      return { ok: false, error: "Unknown stage type." };
  }
}

export function validatePipeline(state: PipelineState): { ok: true } | { ok: false; error: string; stageId?: string } {
  for (const stage of state.stages) {
    if (!stage.enabled) continue;
    const v = validateStage(stage);
    if (!v.ok) return { ok: false, error: v.error, stageId: stage.id };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pipeline JSON / driver code generation
// ---------------------------------------------------------------------------

export function stageToObject(stage: Stage): { ok: true; obj: Record<string, unknown> } | { ok: false; error: string } {
  const v = validateStage(stage);
  if (!v.ok) return v;
  const p = safeJsonParse(stage.spec);
  if (!p.ok) return p;
  return { ok: true, obj: { [stage.type]: p.value } };
}

export function pipelineToArray(state: PipelineState): { ok: true; pipeline: Record<string, unknown>[] } | { ok: false; error: string; stageId?: string } {
  const out: Record<string, unknown>[] = [];
  for (const stage of state.stages) {
    if (!stage.enabled) continue;
    const s = stageToObject(stage);
    if (!s.ok) return { ok: false, error: s.error, stageId: stage.id };
    out.push(s.obj);
  }
  return { ok: true, pipeline: out };
}

export function generatePipelineJson(state: PipelineState): { ok: true; output: string } | { ok: false; error: string } {
  const p = pipelineToArray(state);
  if (!p.ok) return p;
  return { ok: true, output: safeStringify(p.pipeline) };
}

export function generateMongosh(state: PipelineState): { ok: true; output: string } | { ok: false; error: string } {
  const p = pipelineToArray(state);
  if (!p.ok) return p;
  const coll = state.collection || "myCollection";
  return { ok: true, output: `db.${coll}.aggregate(${safeStringify(p.pipeline)})` };
}

export function generateDriverCode(state: PipelineState, target: DriverTarget): { ok: true; output: string } | { ok: false; error: string } {
  const p = pipelineToArray(state);
  if (!p.ok) return p;
  const coll = state.collection || "myCollection";
  const pipelineStr = safeStringify(p.pipeline);

  switch (target) {
    case "mongosh":
      return { ok: true, output: `db.${coll}.aggregate(${pipelineStr})` };
    case "node": {
      const lines: string[] = [
        `// Node.js MongoDB driver`,
        `const { MongoClient } = require("mongodb");`,
        ``,
        `async function run() {`,
        `  const client = new MongoClient(process.env.MONGO_URL || "mongodb://localhost:27017");`,
        `  await client.connect();`,
        `  const db = client.db("myDatabase");`,
        `  const collection = db.collection(${JSON.stringify(coll)});`,
        `  const pipeline = JSON.parse(${JSON.stringify(pipelineStr)});`,
        `  const docs = await collection.aggregate(pipeline).toArray();`,
        `  console.log(docs);`,
        `  await client.close();`,
        `}`,
        `run().catch(console.error);`,
      ];
      return { ok: true, output: lines.join("\n") };
    }
    case "python": {
      const lines: string[] = [
        `# Python (PyMongo)`,
        `from pymongo import MongoClient`,
        ``,
        `client = MongoClient("mongodb://localhost:27017")`,
        `db = client["myDatabase"]`,
        `collection = db[${JSON.stringify(coll)}]`,
        ``,
        `pipeline = ${pythonize(p.pipeline)}`,
        ``,
        `for doc in collection.aggregate(pipeline):`,
        `    print(doc)`,
      ];
      return { ok: true, output: lines.join("\n") };
    }
    case "java": {
      const lines: string[] = [
        `// Java MongoDB driver`,
        `import com.mongodb.client.*;`,
        `import org.bson.Document;`,
        `import java.util.Arrays;`,
        ``,
        `public class Main {`,
        `  public static void main(String[] args) {`,
        `    try (MongoClient client = MongoClients.create("mongodb://localhost:27017")) {`,
        `      MongoDatabase db = client.getDatabase("myDatabase");`,
        `      MongoCollection<Document> collection = db.getCollection(${JSON.stringify(coll)});`,
        `      List<Document> pipeline = Arrays.asList(Document.parse(${JSON.stringify(safeStringify(p.pipeline[0]))})/* ... */);`,
        `      for (Document doc : collection.aggregate(pipeline)) {`,
        `        System.out.println(doc.toJson());`,
        `      }`,
        `    }`,
        `  }`,
        `}`,
      ];
      // Build a more faithful list of Document.parse calls
      const parseCalls = p.pipeline.map((s) => `Document.parse(${JSON.stringify(safeStringify(s))})`).join(", ");
      const faithful = [
        `// Java MongoDB driver`,
        `import com.mongodb.client.*;`,
        `import org.bson.Document;`,
        `import java.util.Arrays;`,
        `import java.util.List;`,
        ``,
        `public class Main {`,
        `  public static void main(String[] args) {`,
        `    try (MongoClient client = MongoClients.create("mongodb://localhost:27017")) {`,
        `      MongoDatabase db = client.getDatabase("myDatabase");`,
        `      MongoCollection<Document> collection = db.getCollection(${JSON.stringify(coll)});`,
        `      List<Document> pipeline = Arrays.asList(${parseCalls});`,
        `      for (Document doc : collection.aggregate(pipeline)) {`,
        `        System.out.println(doc.toJson());`,
        `      }`,
        `    }`,
        `  }`,
        `}`,
      ];
      void lines;
      return { ok: true, output: faithful.join("\n") };
    }
    case "csharp": {
      const parseCalls = p.pipeline.map((s) => `BsonDocument.Parse(${JSON.stringify(safeStringify(s))})`).join(", ");
      const lines: string[] = [
        `// C# .NET MongoDB driver`,
        `using MongoDB.Driver;`,
        `using MongoDB.Bson;`,
        `using System.Collections.Generic;`,
        ``,
        `var client = new MongoClient("mongodb://localhost:27017");`,
        `var db = client.GetDatabase("myDatabase");`,
        `var collection = db.GetCollection<BsonDocument>(${JSON.stringify(coll)});`,
        ``,
        `var pipeline = new BsonDocument[] { ${parseCalls} };`,
        `var docs = await collection.Aggregate<BsonDocument>(pipeline).ToListAsync();`,
        `foreach (var doc in docs) Console.WriteLine(doc.ToJson());`,
      ];
      return { ok: true, output: lines.join("\n") };
    }
    case "php": {
      const lines: string[] = [
        `<?php`,
        `// PHP MongoDB driver`,
        `require 'vendor/autoload.php';`,
        ``,
        `$client = new MongoDB\\Client("mongodb://localhost:27017");`,
        `$collection = $client->myDatabase->${/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(coll) ? coll : `{JSON.stringify(coll)}`};`,
        ``,
        `$pipeline = ${phpize(p.pipeline)};`,
        ``,
        `foreach ($collection->aggregate($pipeline) as $doc) {`,
        `    var_dump($doc);`,
        `}`,
      ];
      return { ok: true, output: lines.join("\n") };
    }
    default:
      return { ok: false, error: "Unknown driver target." };
  }
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
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(phpize).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `[${entries.map(([k, v]) => `${JSON.stringify(k)} => ${phpize(v)}`).join(", ")}]`;
  }
  return "null";
}

// ---------------------------------------------------------------------------
// In-browser aggregation engine — runs each stage on sample documents.
// Supports all stage types and a subset of expressions/accumulators.
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

/** Resolve a dot-notation path against a document (handles arrays). */
export function getField(doc: unknown, path: string): unknown {
  if (doc == null) return undefined;
  if (!path.startsWith("$")) return getFieldByParts(doc, path.split("."));
  // Strip leading $
  return getFieldByParts(doc, path.slice(1).split("."));
}

function getFieldByParts(doc: unknown, parts: string[]): unknown {
  if (doc == null) return undefined;
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
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

/** Match a value against an operator (subset used by $match). */
function matchValue(docVal: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case "$eq": return deepEqual(docVal, expected);
    case "$ne": return !deepEqual(docVal, expected);
    case "$gt": return typeof docVal === typeof expected && (docVal as never) > (expected as never);
    case "$gte": return typeof docVal === typeof expected && (docVal as never) >= (expected as never);
    case "$lt": return typeof docVal === typeof expected && (docVal as never) < (expected as never);
    case "$lte": return typeof docVal === typeof expected && (docVal as never) <= (expected as never);
    case "$in": return Array.isArray(expected) && expected.some((e) => deepEqual(docVal, e));
    case "$nin": return Array.isArray(expected) && !expected.some((e) => deepEqual(docVal, e));
    case "$exists": return (docVal !== undefined) === Boolean(expected);
    case "$regex":
      if (typeof docVal !== "string" || typeof expected !== "string") return false;
      try { return new RegExp(expected).test(docVal); } catch { return false; }
    case "$size": return Array.isArray(docVal) && docVal.length === Number(expected);
    default: return false;
  }
}

/** Match a document against a MQL filter (supports $and/$or/$nor). */
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
    } else {
      const docVal = getField(doc, key);
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        const keys = Object.keys(val);
        const allOps = keys.every((k) => k.startsWith("$"));
        if (allOps) {
          for (const [op, v] of Object.entries(val)) {
            if (!matchValue(docVal, op, v)) return false;
          }
        } else if (!deepEqual(docVal, val)) {
          return false;
        }
      } else if (!deepEqual(docVal, val)) {
        return false;
      }
    }
  }
  return true;
}

/** Evaluate an aggregation expression against a document. */
export function evalExpr(expr: unknown, doc: unknown): unknown {
  if (expr == null) return null;
  // Field path reference: "$field.subfield"
  if (typeof expr === "string" && expr.startsWith("$")) {
    return getField(doc, expr);
  }
  // Literal (could be string without $, number, boolean, array)
  if (typeof expr !== "object" || expr === null) return expr;
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, doc));
  // Object — could be operator expression or literal document.
  const entries = Object.entries(expr as Record<string, unknown>);
  const opEntries = entries.filter(([k]) => k.startsWith("$"));
  if (opEntries.length === 0) {
    // Literal document — evaluate each field
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = evalExpr(v, doc);
    return out;
  }
  if (opEntries.length === 1 && entries.length === 1) {
    const [op, arg] = opEntries[0];
    return evalOperator(op, arg, doc);
  }
  // Mixed — treat as literal document
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = evalExpr(v, doc);
  return out;
}

function evalOperator(op: string, arg: unknown, doc: unknown): unknown {
  switch (op) {
    case "$literal": return arg;
    case "$concat":
      if (!Array.isArray(arg)) return "";
      return arg.map((a) => evalExpr(a, doc)).map((v) => (v == null ? "" : String(v))).join("");
    case "$toUpper":
      return String(evalExpr(arg, doc) ?? "").toUpperCase();
    case "$toLower":
      return String(evalExpr(arg, doc) ?? "").toLowerCase();
    case "$add":
      if (!Array.isArray(arg)) return 0;
      return arg.reduce((sum, a) => sum + Number(evalExpr(a, doc) ?? 0), 0);
    case "$subtract":
      if (!Array.isArray(arg) || arg.length !== 2) return 0;
      return Number(evalExpr(arg[0], doc) ?? 0) - Number(evalExpr(arg[1], doc) ?? 0);
    case "$multiply":
      if (!Array.isArray(arg)) return 0;
      return arg.reduce((prod, a) => prod * Number(evalExpr(a, doc) ?? 0), 1);
    case "$divide":
      if (!Array.isArray(arg) || arg.length !== 2) return 0;
      const divisor = Number(evalExpr(arg[1], doc) ?? 0);
      if (divisor === 0) return null;
      return Number(evalExpr(arg[0], doc) ?? 0) / divisor;
    case "$cond": {
      if (Array.isArray(arg) && arg.length === 3) {
        const cond = evalExpr(arg[0], doc);
        return cond ? evalExpr(arg[1], doc) : evalExpr(arg[2], doc);
      }
      if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
        const a = arg as Record<string, unknown>;
        const cond = evalExpr(a.if, doc);
        return cond ? evalExpr(a.then, doc) : evalExpr(a.else, doc);
      }
      return null;
    }
    case "$switch": {
      if (typeof arg !== "object" || arg === null || Array.isArray(arg)) return null;
      const a = arg as { branches?: Array<{ case: unknown; then: unknown }>; default?: unknown };
      for (const branch of a.branches ?? []) {
        const cond = evalExpr(branch.case, doc);
        if (cond) return evalExpr(branch.then, doc);
      }
      return a.default != null ? evalExpr(a.default, doc) : null;
    }
    case "$ifNull": {
      if (!Array.isArray(arg)) return null;
      for (const a of arg) {
        const v = evalExpr(a, doc);
        if (v != null) return v;
      }
      return null;
    }
    case "$dateToString": {
      if (typeof arg !== "object" || arg === null || Array.isArray(arg)) return null;
      const a = arg as { format?: string; date?: unknown };
      const d = evalExpr(a.date, doc);
      if (d == null) return null;
      // Very simplified date formatting — use ISO string by default
      const date = typeof d === "string" || typeof d === "number" ? new Date(d) : new Date(String(d));
      if (isNaN(date.getTime())) return null;
      if (a.format === "%Y-%m-%d") return date.toISOString().slice(0, 10);
      if (a.format === "%Y") return String(date.getUTCFullYear());
      return date.toISOString();
    }
    case "$eq": return deepEqual(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc), evalExpr(Array.isArray(arg) ? arg[1] : null, doc));
    case "$ne": return !deepEqual(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc), evalExpr(Array.isArray(arg) ? arg[1] : null, doc));
    case "$gt": return Number(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc) ?? 0) > Number(evalExpr(Array.isArray(arg) ? arg[1] : null, doc) ?? 0);
    case "$lt": return Number(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc) ?? 0) < Number(evalExpr(Array.isArray(arg) ? arg[1] : null, doc) ?? 0);
    case "$gte": return Number(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc) ?? 0) >= Number(evalExpr(Array.isArray(arg) ? arg[1] : null, doc) ?? 0);
    case "$lte": return Number(evalExpr(Array.isArray(arg) ? arg[0] : arg, doc) ?? 0) <= Number(evalExpr(Array.isArray(arg) ? arg[1] : null, doc) ?? 0);
    case "$and":
      if (!Array.isArray(arg)) return true;
      return arg.every((a) => evalExpr(a, doc));
    case "$or":
      if (!Array.isArray(arg)) return false;
      return arg.some((a) => evalExpr(a, doc));
    default:
      return null;
  }
}

/** Run a single accumulator against a group of documents. */
function evalAccumulator(acc: unknown, docs: unknown[]): unknown {
  if (typeof acc !== "object" || acc === null || Array.isArray(acc)) return null;
  const entries = Object.entries(acc);
  const accEntry = entries.find(([k]) => k.startsWith("$"));
  if (!accEntry) return null;
  const [op, arg] = accEntry;
  switch (op) {
    case "$sum":
      if (arg === 1) return docs.length;
      return docs.reduce<number>((sum, d) => sum + Number(evalExpr(arg, d) ?? 0), 0);
    case "$avg": {
      const vals = docs.map((d) => Number(evalExpr(arg, d))).filter((v) => Number.isFinite(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    case "$push":
      return docs.map((d) => evalExpr(arg, d));
    case "$first":
      return docs.length > 0 ? evalExpr(arg, docs[0]) : null;
    case "$last":
      return docs.length > 0 ? evalExpr(arg, docs[docs.length - 1]) : null;
    case "$max": {
      const vals = docs.map((d) => evalExpr(arg, d)).filter((v) => v != null);
      return vals.length ? vals.reduce((m, v) => ((v as never) > (m as never) ? v : m), vals[0]) : null;
    }
    case "$min": {
      const vals = docs.map((d) => evalExpr(arg, d)).filter((v) => v != null);
      return vals.length ? vals.reduce((m, v) => ((v as never) < (m as never) ? v : m), vals[0]) : null;
    }
    case "$count":
      return docs.length;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Stage executors
// ---------------------------------------------------------------------------

export function execStage(docs: unknown[], stage: Stage): { ok: true; output: unknown[] } | { ok: false; error: string } {
  const v = validateStage(stage);
  if (!v.ok) return v;
  const p = safeJsonParse(stage.spec);
  if (!p.ok) return p;
  const spec = p.value;

  switch (stage.type) {
    case "$match": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$match requires a filter object." };
      }
      const filtered = docs.filter((d) => matchFilter(d, spec as Record<string, unknown>));
      return { ok: true, output: filtered };
    }
    case "$project": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$project requires a spec object." };
      }
      const specObj = spec as Record<string, unknown>;
      const entries = Object.entries(specObj);
      // An expression (object/array/non-0,1 value) is treated as an inclusion.
      const isInclusion = (v: unknown): boolean =>
        v === 1 || v === true || (typeof v === "object" && v !== null);
      const hasInclusions = entries.some(([, v]) => isInclusion(v));
      const hasExclusions = entries.some(([, v]) => v === 0 || v === false);
      const out = docs.map((d) => {
        const result: Record<string, unknown> = {};
        if (hasInclusions) {
          for (const [k, v] of entries) {
            if (isInclusion(v)) {
              if (v === 1 || v === true) {
                result[k] = getField(d, k);
              } else {
                result[k] = evalExpr(v, d);
              }
            }
            // explicit 0/False — skip (handled below for _id)
          }
          // _id is included by default unless explicitly excluded
          if (specObj["_id"] !== 0 && specObj["_id"] !== false) {
            result["_id"] = getField(d, "_id");
          }
        } else if (hasExclusions) {
          // Copy all fields, then exclude listed
          if (d != null && typeof d === "object" && !Array.isArray(d)) {
            for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
              if (!(k in specObj) || specObj[k] !== 0) result[k] = v;
            }
          }
        } else {
          // Empty spec — return doc as-is
          if (d != null && typeof d === "object" && !Array.isArray(d)) {
            Object.assign(result, d);
          }
        }
        return result;
      });
      return { ok: true, output: out };
    }
    case "$group": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$group requires a spec object." };
      }
      const specObj = spec as Record<string, unknown>;
      if (!("_id" in specObj)) return { ok: false, error: "$group requires _id." };
      const idExpr = specObj["_id"];
      const groups = new Map<string, unknown[]>();
      for (const d of docs) {
        const id = evalExpr(idExpr, d);
        const key = safeStringify(id);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(d);
      }
      const out: unknown[] = [];
      for (const [key, groupDocs] of groups) {
        const result: Record<string, unknown> = { _id: JSON.parse(key) };
        for (const [field, accSpec] of Object.entries(specObj)) {
          if (field === "_id") continue;
          result[field] = evalAccumulator(accSpec, groupDocs);
        }
        out.push(result);
      }
      return { ok: true, output: out };
    }
    case "$sort": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$sort requires a spec object." };
      }
      const specObj = spec as Record<string, unknown>;
      const sortEntries = Object.entries(specObj).filter(([k]) => !k.startsWith("$"));
      const sorted = [...docs].sort((a, b) => {
        for (const [field, dir] of sortEntries) {
          const av = getField(a, field);
          const bv = getField(b, field);
          const direction = Number(dir) >= 0 ? 1 : -1;
          if (av == null && bv == null) continue;
          if (av == null) return -1 * direction;
          if (bv == null) return 1 * direction;
          if (av < bv) return -1 * direction;
          if (av > bv) return 1 * direction;
        }
        return 0;
      });
      return { ok: true, output: sorted };
    }
    case "$limit": {
      const n = Number(spec);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: "$limit must be a non-negative number." };
      return { ok: true, output: docs.slice(0, Math.floor(n)) };
    }
    case "$skip": {
      const n = Number(spec);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: "$skip must be a non-negative number." };
      return { ok: true, output: docs.slice(Math.floor(n)) };
    }
    case "$unwind": {
      const out: unknown[] = [];
      let path: string;
      let preserveNullAndEmptyArrays = false;
      if (typeof spec === "string") {
        path = spec;
      } else if (typeof spec === "object" && spec !== null && !Array.isArray(spec) && "path" in spec) {
        const s = spec as { path: string; preserveNullAndEmptyArrays?: boolean };
        path = s.path;
        preserveNullAndEmptyArrays = !!s.preserveNullAndEmptyArrays;
      } else {
        return { ok: false, error: "$unwind requires a path string or { path: ... }." };
      }
      const cleanPath = path.startsWith("$") ? path.slice(1) : path;
      for (const d of docs) {
        const arr = getField(d, cleanPath);
        if (Array.isArray(arr) && arr.length > 0) {
          for (const item of arr) {
            const clone = structuredShallowCopy(d);
            setField(clone, cleanPath, item);
            out.push(clone);
          }
        } else if (preserveNullAndEmptyArrays) {
          const clone = structuredShallowCopy(d);
          setField(clone, cleanPath, undefined);
          out.push(clone);
        }
      }
      return { ok: true, output: out };
    }
    case "$lookup": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$lookup requires a spec object." };
      }
      const s = spec as { from?: string; localField?: string; foreignField?: string; as?: string };
      // Without a separate collection, we use the same `docs` as the foreign collection.
      const fromDocs = docs;
      const out = docs.map((d) => {
        const localVal = getField(d, s.localField ?? "");
        const matched = fromDocs.filter((fd) => deepEqual(getField(fd, s.foreignField ?? ""), localVal));
        const clone = structuredShallowCopy(d);
        setField(clone, s.as ?? "result", matched);
        return clone;
      });
      return { ok: true, output: out };
    }
    case "$addFields": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$addFields requires a spec object." };
      }
      const specObj = spec as Record<string, unknown>;
      const out = docs.map((d) => {
        const clone = structuredShallowCopy(d);
        for (const [k, v] of Object.entries(specObj)) {
          setField(clone, k, evalExpr(v, d));
        }
        return clone;
      });
      return { ok: true, output: out };
    }
    case "$count": {
      if (typeof spec !== "string" || !spec.trim()) {
        return { ok: false, error: "$count requires a string field name." };
      }
      return { ok: true, output: [{ [spec]: docs.length }] };
    }
    case "$facet": {
      if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
        return { ok: false, error: "$facet requires a spec object." };
      }
      const specObj = spec as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [field, subPipeline] of Object.entries(specObj)) {
        if (!Array.isArray(subPipeline)) {
          result[field] = [];
          continue;
        }
        // Execute sub-pipeline on the same docs
        let subDocs = [...docs];
        for (const subStage of subPipeline) {
          if (typeof subStage !== "object" || subStage === null) continue;
          for (const [type, subSpec] of Object.entries(subStage as Record<string, unknown>)) {
            const fakeStage: Stage = {
              id: nextId("sub"),
              type: type as StageType,
              enabled: true,
              spec: safeStringify(subSpec),
            };
            const r = execStage(subDocs, fakeStage);
            if (!r.ok) {
              result[field] = [];
              subDocs = [];
              break;
            }
            subDocs = r.output;
          }
        }
        result[field] = subDocs;
      }
      return { ok: true, output: [result] };
    }
    default:
      return { ok: false, error: `Unknown stage type: ${stage.type}` };
  }
}

/** Shallow structured copy (top-level + 1-level deep for objects/arrays). */
function structuredShallowCopy(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { value: value as unknown };
  }
  return { ...(value as Record<string, unknown>) };
}

function setField(doc: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  if (value === undefined) {
    delete cur[parts[parts.length - 1]];
  } else {
    cur[parts[parts.length - 1]] = value;
  }
}

// ---------------------------------------------------------------------------
// Run the full pipeline — returns each stage's intermediate output.
// ---------------------------------------------------------------------------

export interface StageResult {
  stageId: string;
  ok: boolean;
  output?: unknown[];
  error?: string;
  count: number;
}

export function runPipeline(docs: unknown[], state: PipelineState): {
  ok: true;
  final: unknown[];
  stages: StageResult[];
} | { ok: false; error: string; stageId?: string } {
  const stages: StageResult[] = [];
  let cur = [...docs];
  for (const stage of state.stages) {
    if (!stage.enabled) {
      stages.push({ stageId: stage.id, ok: true, output: cur, count: cur.length });
      continue;
    }
    const r = execStage(cur, stage);
    if (!r.ok) return { ok: false, error: r.error, stageId: stage.id };
    cur = r.output;
    stages.push({ stageId: stage.id, ok: true, output: cur, count: cur.length });
  }
  return { ok: true, final: cur, stages };
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
    }
  }
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mongodb-aggregation-pipeline-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  collection: string;
  stageCount: number;
  stageTypes: string[];
  finalCount: number;
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

export function buildShareUrl(state: PipelineState): string {
  const params = new URLSearchParams();
  params.set("coll", state.collection);
  try {
    params.set("stages", JSON.stringify(state.stages));
  } catch {
    // ignore
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PipelineState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<PipelineState> = {};
  const coll = params.get("coll");
  if (coll) out.collection = coll;
  const stages = params.get("stages");
  if (stages) {
    try {
      const parsed = JSON.parse(stages);
      if (Array.isArray(parsed)) {
        // Validate each stage shape
        const valid = parsed.filter(
          (s: unknown): s is Stage =>
            typeof s === "object" && s !== null && "id" in s && "type" in s && "enabled" in s && "spec" in s,
        );
        out.stages = valid;
      }
    } catch {
      // ignore
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sample documents for the "Load sample" button
// ---------------------------------------------------------------------------

export const SAMPLE_DOCS = `[
  { "_id": 1, "name": "Alice", "category": "vip", "amount": 100, "tags": ["admin", "active"], "createdAt": "2024-01-15T10:30:00Z" },
  { "_id": 2, "name": "Bob", "category": "user", "amount": 50, "tags": ["active"], "createdAt": "2024-02-20T08:00:00Z" },
  { "_id": 3, "name": "Carol", "category": "vip", "amount": 200, "tags": ["admin"], "createdAt": "2024-03-10T14:45:00Z" },
  { "_id": 4, "name": "Dave", "category": "user", "amount": 75, "tags": [], "createdAt": "2024-04-05T09:15:00Z" },
  { "_id": 5, "name": "Eve", "category": "vip", "amount": 150, "tags": ["active"], "createdAt": "2024-05-12T11:20:00Z" }
]`;
