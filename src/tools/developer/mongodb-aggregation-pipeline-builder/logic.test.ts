import { describe, it, expect, beforeEach } from "vitest";
import {
  STAGE_TYPES,
  DRIVER_TARGETS,
  ACCUMULATORS,
  EXPRESSIONS,
  STAGE_DEFAULTS,
  SAMPLE_DOCS,
  createStage,
  createDefaultState,
  safeJsonParse,
  safeStringify,
  validateStage,
  validatePipeline,
  stageToObject,
  pipelineToArray,
  generatePipelineJson,
  generateMongosh,
  generateDriverCode,
  getField,
  matchFilter,
  evalExpr,
  execStage,
  runPipeline,
  extractFields,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Stage,
  type PipelineState,
  type DriverTarget,
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

// ---------- Constants ----------

describe("mongodb-aggregation-pipeline-builder constants", () => {
  it("exposes 11 stage types", () => {
    expect(STAGE_TYPES.length).toBe(11);
    const values = STAGE_TYPES.map((s) => s.value);
    expect(values).toEqual(expect.arrayContaining(["$match", "$group", "$sort", "$project", "$lookup", "$unwind", "$limit"]));
  });
  it("exposes 6 driver targets", () => {
    expect(DRIVER_TARGETS.length).toBe(6);
    expect(DRIVER_TARGETS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["mongosh", "node", "python", "java", "csharp", "php"]),
    );
  });
  it("exposes accumulators", () => {
    expect(ACCUMULATORS).toContain("$sum");
    expect(ACCUMULATORS).toContain("$avg");
    expect(ACCUMULATORS).toContain("$push");
  });
  it("exposes expressions", () => {
    expect(EXPRESSIONS).toContain("$cond");
    expect(EXPRESSIONS).toContain("$concat");
    expect(EXPRESSIONS).toContain("$dateToString");
  });
  it("ships default specs for all 11 stages", () => {
    for (const stageType of STAGE_TYPES) {
      expect(STAGE_DEFAULTS[stageType.value]).toBeDefined();
      expect(STAGE_DEFAULTS[stageType.value].length).toBeGreaterThan(0);
    }
  });
  it("ships a non-empty SAMPLE_DOCS JSON array", () => {
    expect(SAMPLE_DOCS.trim().startsWith("[")).toBe(true);
    const arr = JSON.parse(SAMPLE_DOCS);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------- Factory helpers ----------

describe("mongodb-aggregation-pipeline-builder factories", () => {
  it("createStage returns enabled stage with default spec", () => {
    const s = createStage("$match");
    expect(s.type).toBe("$match");
    expect(s.enabled).toBe(true);
    expect(typeof s.id).toBe("string");
    expect(s.spec).toContain('"status"');
  });
  it("createDefaultState returns state with one $match stage", () => {
    const s = createDefaultState();
    expect(s.collection).toBe("myCollection");
    expect(s.stages).toHaveLength(1);
    expect(s.stages[0].type).toBe("$match");
  });
});

// ---------- JSON helpers ----------

describe("mongodb-aggregation-pipeline-builder JSON helpers", () => {
  it("safeJsonParse parses valid", () => {
    expect(safeJsonParse('{"a":1}').ok).toBe(true);
  });
  it("safeJsonParse rejects invalid", () => {
    expect(safeJsonParse("{bad").ok).toBe(false);
  });
  it("safeStringify serializes", () => {
    expect(safeStringify({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
  it("safeStringify handles circular gracefully", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    // Should not throw — returns a string
    expect(typeof safeStringify(obj)).toBe("string");
  });
});

// ---------- Stage validation ----------

describe("mongodb-aggregation-pipeline-builder validateStage", () => {
  it("validates $match with object spec", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: '{"a":1}' };
    expect(validateStage(s).ok).toBe(true);
  });
  it("rejects $match with non-object spec", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: "5" };
    expect(validateStage(s).ok).toBe(false);
  });
  it("validates $limit with positive integer", () => {
    const s: Stage = { id: "1", type: "$limit", enabled: true, spec: "10" };
    expect(validateStage(s).ok).toBe(true);
  });
  it("rejects $limit with negative number", () => {
    const s: Stage = { id: "1", type: "$limit", enabled: true, spec: "-5" };
    expect(validateStage(s).ok).toBe(false);
  });
  it("rejects $limit with non-integer", () => {
    const s: Stage = { id: "1", type: "$limit", enabled: true, spec: "5.5" };
    expect(validateStage(s).ok).toBe(false);
  });
  it("validates $count with string spec", () => {
    const s: Stage = { id: "1", type: "$count", enabled: true, spec: '"total"' };
    expect(validateStage(s).ok).toBe(true);
  });
  it("rejects $count with non-string spec", () => {
    const s: Stage = { id: "1", type: "$count", enabled: true, spec: "5" };
    expect(validateStage(s).ok).toBe(false);
  });
  it("validates $unwind with string path", () => {
    const s: Stage = { id: "1", type: "$unwind", enabled: true, spec: '"$tags"' };
    expect(validateStage(s).ok).toBe(true);
  });
  it("validates $unwind with object spec", () => {
    const s: Stage = { id: "1", type: "$unwind", enabled: true, spec: '{"path":"$tags"}' };
    expect(validateStage(s).ok).toBe(true);
  });
  it("rejects invalid JSON spec", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: "{bad" };
    expect(validateStage(s).ok).toBe(false);
  });
});

describe("mongodb-aggregation-pipeline-builder validatePipeline", () => {
  it("validates clean pipeline", () => {
    const s = createDefaultState();
    expect(validatePipeline(s).ok).toBe(true);
  });
  it("reports error with stageId", () => {
    const s = createDefaultState();
    s.stages[0].spec = "{bad";
    const r = validatePipeline(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.stageId).toBe(s.stages[0].id);
  });
  it("skips disabled stages", () => {
    const s = createDefaultState();
    s.stages[0].spec = "{bad";
    s.stages[0].enabled = false;
    expect(validatePipeline(s).ok).toBe(true);
  });
});

// ---------- Stage to object / pipeline to array ----------

describe("mongodb-aggregation-pipeline-builder stageToObject & pipelineToArray", () => {
  it("wraps spec in stage type key", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: '{"a":1}' };
    const r = stageToObject(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.obj).toEqual({ $match: { a: 1 } });
  });
  it("pipelineToArray returns array of stage objects", () => {
    const s = createDefaultState();
    s.stages.push(createStage("$limit"));
    s.stages[1].spec = "5";
    const r = pipelineToArray(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pipeline).toHaveLength(2);
      expect(r.pipeline[0]).toHaveProperty("$match");
      expect(r.pipeline[1]).toEqual({ $limit: 5 });
    }
  });
  it("pipelineToArray skips disabled stages", () => {
    const s = createDefaultState();
    s.stages[0].enabled = false;
    const r = pipelineToArray(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pipeline).toEqual([]);
  });
});

// ---------- Pipeline JSON / mongosh / driver code generation ----------

describe("mongodb-aggregation-pipeline-builder generatePipelineJson", () => {
  it("emits JSON array of stage objects", () => {
    const s = createDefaultState();
    const r = generatePipelineJson(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const arr = JSON.parse(r.output);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr[0]).toHaveProperty("$match");
    }
  });
  it("emits empty array for empty pipeline", () => {
    const s = createDefaultState();
    s.stages = [];
    const r = generatePipelineJson(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.output)).toEqual([]);
  });
});

describe("mongodb-aggregation-pipeline-builder generateMongosh", () => {
  it("emits db.coll.aggregate(pipeline)", () => {
    const s = createDefaultState();
    const r = generateMongosh(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("db.myCollection.aggregate(");
      expect(r.output).toContain("$match");
    }
  });
});

describe("mongodb-aggregation-pipeline-builder generateDriverCode", () => {
  const targets: DriverTarget[] = ["mongosh", "node", "python", "java", "csharp", "php"];
  for (const t of targets) {
    it(`generates ${t} driver code`, () => {
      const s = createDefaultState();
      const r = generateDriverCode(s, t);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.output.length).toBeGreaterThan(20);
    });
  }
  it("node code includes MongoClient and aggregate", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "node");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("MongoClient");
      expect(r.output).toContain(".aggregate(");
    }
  });
  it("python code uses PyMongo aggregate", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "python");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("from pymongo import");
      expect(r.output).toContain("collection.aggregate(");
    }
  });
  it("java code imports Document.parse", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "java");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("com.mongodb.client");
      expect(r.output).toContain("Document.parse");
    }
  });
  it("csharp code uses MongoDB.Driver", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "csharp");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("MongoDB.Driver");
      expect(r.output).toContain("BsonDocument.Parse");
    }
  });
  it("php code starts with <?php", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "php");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.startsWith("<?php")).toBe(true);
  });
  it("rejects invalid pipeline", () => {
    const s = createDefaultState();
    s.stages[0].spec = "{bad";
    expect(generateDriverCode(s, "node").ok).toBe(false);
  });
});

// ---------- In-browser aggregation engine: getField ----------

describe("mongodb-aggregation-pipeline-builder getField", () => {
  const doc = { name: "Alice", address: { city: "NYC" }, tags: [{ label: "vip" }] };
  it("resolves top-level field", () => {
    expect(getField(doc, "name")).toBe("Alice");
  });
  it("resolves $-prefixed path", () => {
    expect(getField(doc, "$name")).toBe("Alice");
  });
  it("resolves nested field", () => {
    expect(getField(doc, "address.city")).toBe("NYC");
  });
  it("resolves array-of-objects", () => {
    expect(getField(doc, "tags.label")).toBe("vip");
  });
  it("returns undefined for missing", () => {
    expect(getField(doc, "missing")).toBeUndefined();
  });
});

// ---------- matchFilter (used by $match) ----------

describe("mongodb-aggregation-pipeline-builder matchFilter", () => {
  const docs = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ];
  it("matches equality", () => {
    expect(docs.filter((d) => matchFilter(d, { name: "Alice" }))).toHaveLength(1);
  });
  it("matches $gt", () => {
    expect(docs.filter((d) => matchFilter(d, { age: { $gt: 26 } }))).toHaveLength(1);
  });
  it("matches $or", () => {
    expect(docs.filter((d) => matchFilter(d, { $or: [{ name: "Alice" }, { age: 25 }] }))).toHaveLength(2);
  });
});

// ---------- evalExpr ----------

describe("mongodb-aggregation-pipeline-builder evalExpr", () => {
  const doc = { name: "Alice", first: "Alice", last: "Smith", age: 30, tags: ["a", "b"] };
  it("resolves field path", () => {
    expect(evalExpr("$name", doc)).toBe("Alice");
  });
  it("returns literals", () => {
    expect(evalExpr(42, doc)).toBe(42);
    expect(evalExpr("hello", doc)).toBe("hello");
    expect(evalExpr(true, doc)).toBe(true);
  });
  it("evaluates $concat", () => {
    expect(evalExpr({ $concat: ["$first", " ", "$last"] }, doc)).toBe("Alice Smith");
  });
  it("evaluates $toUpper", () => {
    expect(evalExpr({ $toUpper: "$name" }, doc)).toBe("ALICE");
  });
  it("evaluates $toLower", () => {
    expect(evalExpr({ $toLower: "$name" }, doc)).toBe("alice");
  });
  it("evaluates $add", () => {
    expect(evalExpr({ $add: ["$age", 5] }, doc)).toBe(35);
  });
  it("evaluates $subtract", () => {
    expect(evalExpr({ $subtract: ["$age", 5] }, doc)).toBe(25);
  });
  it("evaluates $multiply", () => {
    expect(evalExpr({ $multiply: ["$age", 2] }, doc)).toBe(60);
  });
  it("evaluates $divide", () => {
    expect(evalExpr({ $divide: ["$age", 2] }, doc)).toBe(15);
  });
  it("evaluates $divide by zero as null", () => {
    expect(evalExpr({ $divide: ["$age", 0] }, doc)).toBeNull();
  });
  it("evaluates $cond array form (truthy)", () => {
    expect(evalExpr({ $cond: ["$age", "old", "young"] }, doc)).toBe("old");
  });
  it("evaluates $cond array form (falsy)", () => {
    expect(evalExpr({ $cond: [0, "old", "young"] }, doc)).toBe("young");
  });
  it("evaluates $cond object form", () => {
    expect(evalExpr({ $cond: { if: { $gt: ["$age", 25] }, then: "old", else: "young" } }, doc)).toBe("old");
  });
  it("evaluates $literal", () => {
    expect(evalExpr({ $literal: "$not_a_field" }, doc)).toBe("$not_a_field");
  });
  it("evaluates $ifNull with non-null", () => {
    expect(evalExpr({ $ifNull: ["$name", "default"] }, doc)).toBe("Alice");
  });
  it("evaluates $ifNull with null", () => {
    expect(evalExpr({ $ifNull: ["$missing", "default"] }, doc)).toBe("default");
  });
  it("evaluates $and / $or", () => {
    expect(evalExpr({ $and: [true, "$age"] }, doc)).toBe(true);
    expect(evalExpr({ $or: [false, "$age"] }, doc)).toBe(true);
  });
  it("evaluates nested expression document", () => {
    const expr = { full: { $concat: ["$first", " ", "$last"] } };
    const r = evalExpr(expr, doc) as { full: string };
    expect(r.full).toBe("Alice Smith");
  });
});

// ---------- execStage (per-stage engine) ----------

describe("mongodb-aggregation-pipeline-builder execStage", () => {
  const docs = [
    { _id: 1, name: "Alice", category: "vip", amount: 100, tags: ["a", "b"] },
    { _id: 2, name: "Bob", category: "user", amount: 50, tags: ["c"] },
    { _id: 3, name: "Carol", category: "vip", amount: 200, tags: [] },
  ];

  it("executes $match", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: '{"category":"vip"}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });
  it("executes $project (inclusion)", () => {
    const s: Stage = { id: "1", type: "$project", enabled: true, spec: '{"name":1,"_id":0}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output[0]).toEqual({ name: "Alice" });
    }
  });
  it("executes $project with expression", () => {
    const s: Stage = { id: "1", type: "$project", enabled: true, spec: '{"upperName":{"$toUpper":"$name"},"_id":0}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output[0]).toEqual({ upperName: "ALICE" });
    }
  });
  it("executes $group with $sum", () => {
    const s: Stage = { id: "1", type: "$group", enabled: true, spec: '{"_id":"$category","total":{"$sum":"$amount"},"count":{"$sum":1}}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const vip = r.output.find((d) => (d as { _id: string })._id === "vip") as { total: number; count: number };
      expect(vip.total).toBe(300);
      expect(vip.count).toBe(2);
    }
  });
  it("executes $group with $avg", () => {
    const s: Stage = { id: "1", type: "$group", enabled: true, spec: '{"_id":"$category","avgAmount":{"$avg":"$amount"}}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const vip = r.output.find((d) => (d as { _id: string })._id === "vip") as { avgAmount: number };
      expect(vip.avgAmount).toBe(150); // (100 + 200) / 2
    }
  });
  it("executes $group with $push", () => {
    const s: Stage = { id: "1", type: "$group", enabled: true, spec: '{"_id":"$category","names":{"$push":"$name"}}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const vip = r.output.find((d) => (d as { _id: string })._id === "vip") as { names: string[] };
      expect(vip.names).toEqual(["Alice", "Carol"]);
    }
  });
  it("executes $group with $max / $min", () => {
    const s: Stage = { id: "1", type: "$group", enabled: true, spec: '{"_id":"$category","max":{"$max":"$amount"},"min":{"$min":"$amount"}}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const vip = r.output.find((d) => (d as { _id: string })._id === "vip") as { max: number; min: number };
      expect(vip.max).toBe(200);
      expect(vip.min).toBe(100);
    }
  });
  it("executes $sort ascending", () => {
    const s: Stage = { id: "1", type: "$sort", enabled: true, spec: '{"amount":1}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.output[0] as { amount: number }).amount).toBe(50);
      expect((r.output[2] as { amount: number }).amount).toBe(200);
    }
  });
  it("executes $sort descending", () => {
    const s: Stage = { id: "1", type: "$sort", enabled: true, spec: '{"amount":-1}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.output[0] as { amount: number }).amount).toBe(200);
    }
  });
  it("executes $limit", () => {
    const s: Stage = { id: "1", type: "$limit", enabled: true, spec: "2" };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });
  it("executes $skip", () => {
    const s: Stage = { id: "1", type: "$skip", enabled: true, spec: "1" };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });
  it("executes $unwind with string path", () => {
    const s: Stage = { id: "1", type: "$unwind", enabled: true, spec: '"$tags"' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(3); // Alice(2) + Bob(1) + Carol(0)
  });
  it("executes $unwind with preserveNullAndEmptyArrays", () => {
    const s: Stage = { id: "1", type: "$unwind", enabled: true, spec: '{"path":"$tags","preserveNullAndEmptyArrays":true}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(4); // Alice(2) + Bob(1) + Carol(1)
  });
  it("executes $addFields with expression", () => {
    const s: Stage = { id: "1", type: "$addFields", enabled: true, spec: '{"upperName":{"$toUpper":"$name"}}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.output[0] as { upperName: string }).upperName).toBe("ALICE");
    }
  });
  it("executes $count", () => {
    const s: Stage = { id: "1", type: "$count", enabled: true, spec: '"total"' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toEqual([{ total: 3 }]);
  });
  it("executes $lookup", () => {
    const s: Stage = { id: "1", type: "$lookup", enabled: true, spec: '{"from":"orders","localField":"_id","foreignField":"_id","as":"self"}' };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const first = r.output[0] as { self: unknown[] };
      expect(first.self).toHaveLength(1); // self-match
    }
  });
  it("executes $facet", () => {
    const s: Stage = {
      id: "1", type: "$facet", enabled: true,
      spec: '{"counts":[{"$count":"total"}],"byCat":[{"$group":{"_id":"$category","n":{"$sum":1}}}]}',
    };
    const r = execStage(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = r.output[0] as { counts: unknown[]; byCat: unknown[] };
      expect(out.counts).toEqual([{ total: 3 }]);
      expect(out.byCat).toHaveLength(2);
    }
  });
  it("rejects invalid stage", () => {
    const s: Stage = { id: "1", type: "$match", enabled: true, spec: "{bad" };
    expect(execStage(docs, s).ok).toBe(false);
  });
});

// ---------- runPipeline (full pipeline execution) ----------

describe("mongodb-aggregation-pipeline-builder runPipeline", () => {
  it("runs each stage and returns per-stage results", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    s.stages[0].spec = '{"category":"vip"}';
    s.stages.push(createStage("$sort"));
    s.stages[1].spec = '{"amount":-1}';
    s.stages.push(createStage("$limit"));
    s.stages[2].spec = "1";
    const r = runPipeline(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stages).toHaveLength(3);
      expect(r.stages[0].count).toBe(3); // 3 vip
      expect(r.stages[1].count).toBe(3); // sort keeps count
      expect(r.stages[2].count).toBe(1); // limit 1
      expect((r.final[0] as { name: string }).name).toBe("Carol"); // 200 > 150 > 100
    }
  });
  it("skips disabled stages in execution but keeps count", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    // Use a $match that keeps all docs (none have status, so use an existing field).
    s.stages[0].spec = '{"category":{"$exists":true}}';
    s.stages.push(createStage("$limit"));
    s.stages[1].spec = "1";
    s.stages[1].enabled = false;
    const r = runPipeline(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stages).toHaveLength(2);
      expect(r.stages[1].count).toBe(docs.length); // limit was skipped, all docs pass through
    }
  });
  it("reports error with stageId", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    s.stages[0].spec = "{bad";
    const r = runPipeline(docs, s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.stageId).toBe(s.stages[0].id);
  });
});

// ---------- extractFields ----------

describe("mongodb-aggregation-pipeline-builder extractFields", () => {
  it("extracts top-level + nested fields", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const fields = extractFields(docs);
    expect(fields).toContain("name");
    expect(fields).toContain("category");
    expect(fields).toContain("amount");
  });
  it("handles empty input", () => {
    expect(extractFields([])).toEqual([]);
  });
});

// ---------- History ----------

describe("mongodb-aggregation-pipeline-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, collection: "users", stageCount: 3, stageTypes: ["$match", "$group"], finalCount: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, collection: "x", stageCount: 1, stageTypes: ["$match"], finalCount: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, collection: "x", stageCount: 1, stageTypes: ["$match"], finalCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("mongodb-aggregation-pipeline-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const s = createDefaultState();
    s.collection = "orders";
    const url = buildShareUrl(s);
    expect(url).toContain("coll=orders");
    expect(url).toContain("stages=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips collection + stages", () => {
    const s = createDefaultState();
    s.collection = "orders";
    s.stages.push(createStage("$group"));
    const url = buildShareUrl(s);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.collection).toBe("orders");
    expect(parsed.stages).toBeDefined();
    expect(parsed.stages?.length).toBe(2);
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid stage shapes", () => {
    // Hand-craft an invalid stages array
    const parsed = parseShareUrl("coll=x&stages=" + encodeURIComponent(JSON.stringify([{ id: "1", type: "$match" }])));
    expect(parsed.stages).toEqual([]);
  });
});

// Type usage guard (suppress unused-import lint)
export type _Unused = PipelineState;
