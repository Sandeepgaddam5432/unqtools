import { describe, it, expect, beforeEach } from "vitest";
import {
  QUERY_OPERATORS,
  VALUE_TYPES,
  LOGIC_OPS,
  OPERATIONS,
  DRIVER_TARGETS,
  VALUELESS_OPS,
  ARRAY_OPS,
  SUBDOC_OPS,
  NUMERIC_OPS,
  SAMPLE_DOCS,
  createEmptyCondition,
  createEmptyGroup,
  createDefaultState,
  parseValue,
  parseArrayValue,
  splitTopLevel,
  conditionToMql,
  groupToMql,
  stateToFilter,
  stateToOptions,
  generateMqlJson,
  generateMqlShell,
  generateDriverCode,
  validateField,
  safeJsonParse,
  validateJsonDoc,
  matchValue,
  getField,
  matchCondition,
  matchFilter,
  runFilter,
  extractFields,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Condition,
  type Group,
  type QueryState,
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

describe("mongodb-query-builder constants", () => {
  it("exposes >= 14 query operators", () => {
    expect(QUERY_OPERATORS.length).toBeGreaterThanOrEqual(14);
    expect(QUERY_OPERATORS.map((o) => o.value)).toContain("$eq");
    expect(QUERY_OPERATORS.map((o) => o.value)).toContain("$regex");
  });
  it("exposes 6 value types", () => {
    expect(VALUE_TYPES.map((v) => v.value)).toEqual(
      expect.arrayContaining(["string", "number", "boolean", "null", "objectId", "date"]),
    );
  });
  it("exposes AND/OR/NOR logic ops", () => {
    expect(LOGIC_OPS.map((l) => l.value)).toEqual(["and", "or", "nor"]);
  });
  it("exposes 8 operations", () => {
    expect(OPERATIONS.length).toBe(8);
    expect(OPERATIONS.map((o) => o.value)).toContain("find");
    expect(OPERATIONS.map((o) => o.value)).toContain("insertOne");
  });
  it("exposes 6 driver targets", () => {
    expect(DRIVER_TARGETS.length).toBe(6);
    expect(DRIVER_TARGETS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["mongosh", "node", "python", "java", "csharp", "php"]),
    );
  });
  it("classifies valueless / array / subdoc / numeric ops", () => {
    expect(VALUELESS_OPS).toContain("$exists");
    expect(ARRAY_OPS).toEqual(expect.arrayContaining(["$in", "$nin"]));
    expect(SUBDOC_OPS).toContain("$not");
    expect(NUMERIC_OPS).toContain("$size");
  });
  it("ships a non-empty SAMPLE_DOCS JSON array", () => {
    expect(SAMPLE_DOCS.trim().startsWith("[")).toBe(true);
    const arr = JSON.parse(SAMPLE_DOCS);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------- Factory helpers ----------

describe("mongodb-query-builder factories", () => {
  it("createEmptyCondition returns $eq string condition with id", () => {
    const c = createEmptyCondition();
    expect(c.op).toBe("$eq");
    expect(c.valueType).toBe("string");
    expect(typeof c.id).toBe("string");
    expect(c.id.length).toBeGreaterThan(0);
  });
  it("createEmptyGroup returns AND group with one condition", () => {
    const g = createEmptyGroup("or");
    expect(g.logic).toBe("or");
    expect(g.conditions).toHaveLength(1);
    expect(g.groups).toEqual([]);
  });
  it("createDefaultState returns a usable find() state", () => {
    const s = createDefaultState();
    expect(s.operation).toBe("find");
    expect(s.collection).toBe("myCollection");
    expect(s.root.logic).toBe("and");
    expect(s.limit).toBeNull();
  });
});

// ---------- Value parsing ----------

describe("mongodb-query-builder parseValue", () => {
  it("parses strings", () => {
    const p = parseValue("hello", "string");
    expect(p.ok).toBe(true);
    expect(p.value).toBe("hello");
    expect(p.shell).toBe('"hello"');
  });
  it("parses numbers", () => {
    const p = parseValue("42.5", "number");
    expect(p.ok).toBe(true);
    expect(p.value).toBe(42.5);
  });
  it("rejects non-numbers", () => {
    expect(parseValue("abc", "number").ok).toBe(false);
  });
  it("parses booleans (true/false/1/0/yes/no)", () => {
    expect(parseValue("true", "boolean").value).toBe(true);
    expect(parseValue("FALSE", "boolean").value).toBe(false);
    expect(parseValue("1", "boolean").value).toBe(true);
    expect(parseValue("no", "boolean").value).toBe(false);
  });
  it("parses null", () => {
    expect(parseValue("anything", "null").value).toBeNull();
  });
  it("parses valid 24-hex ObjectId", () => {
    const p = parseValue("507f1f77bcf86cd799439011", "objectId");
    expect(p.ok).toBe(true);
    expect(p.extended).toEqual({ $oid: "507f1f77bcf86cd799439011" });
    expect(p.shell).toContain('ObjectId("507f1f77bcf86cd799439011")');
  });
  it("rejects invalid ObjectId", () => {
    expect(parseValue("abc", "objectId").ok).toBe(false);
  });
  it("parses ISO date", () => {
    const p = parseValue("2024-01-15T10:30:00Z", "date");
    expect(p.ok).toBe(true);
    expect((p.extended as { $date: string }).$date).toContain("2024-01-15");
    expect(p.shell).toContain("ISODate(");
  });
  it("rejects invalid date", () => {
    expect(parseValue("not-a-date", "date").ok).toBe(false);
  });
});

// ---------- Array value parsing ----------

describe("mongodb-query-builder parseArrayValue", () => {
  it("parses JSON array", () => {
    const a = parseArrayValue('["a","b","c"]', "string");
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.values).toEqual(["a", "b", "c"]);
  });
  it("parses comma-separated values", () => {
    const a = parseArrayValue("1, 2, 3", "number");
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.values).toEqual([1, 2, 3]);
  });
  it("handles empty input", () => {
    const a = parseArrayValue("", "string");
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.values).toEqual([]);
  });
  it("rejects invalid JSON", () => {
    expect(parseArrayValue("[1,2", "number").ok).toBe(false);
  });
});

// ---------- splitTopLevel ----------

describe("mongodb-query-builder splitTopLevel", () => {
  it("splits simple commas", () => {
    expect(splitTopLevel("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("respects nested brackets", () => {
    expect(splitTopLevel("a,[b,c],d")).toEqual(["a", "[b,c]", "d"]);
  });
  it("respects quotes", () => {
    expect(splitTopLevel('"a,b",c')).toEqual(['"a,b"', "c"]);
  });
});

// ---------- Condition -> MQL ----------

describe("mongodb-query-builder conditionToMql", () => {
  it("generates $eq", () => {
    const c: Condition = { id: "1", field: "name", op: "$eq", value: "Alice", valueType: "string" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ name: { $eq: "Alice" } });
  });
  it("generates $gt with number", () => {
    const c: Condition = { id: "1", field: "age", op: "$gt", value: "30", valueType: "number" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ age: { $gt: 30 } });
  });
  it("generates $in with array", () => {
    const c: Condition = { id: "1", field: "tags", op: "$in", value: '["admin","vip"]', valueType: "string" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ tags: { $in: ["admin", "vip"] } });
  });
  it("generates $regex", () => {
    const c: Condition = { id: "1", field: "name", op: "$regex", value: "^A", valueType: "string" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ name: { $regex: "^A" } });
  });
  it("generates $exists true", () => {
    const c: Condition = { id: "1", field: "active", op: "$exists", value: "true", valueType: "boolean" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ active: { $exists: true } });
  });
  it("generates $size", () => {
    const c: Condition = { id: "1", field: "tags", op: "$size", value: "2", valueType: "number" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ tags: { $size: 2 } });
  });
  it("generates $not with subdoc", () => {
    const c: Condition = { id: "1", field: "age", op: "$not", value: '{"$gt":30}', valueType: "number" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ age: { $not: { $gt: 30 } } });
  });
  it("generates $mod", () => {
    const c: Condition = { id: "1", field: "age", op: "$mod", value: "2, 0", valueType: "number" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ age: { $mod: [2, 0] } });
  });
  it("generates $type", () => {
    const c: Condition = { id: "1", field: "name", op: "$type", value: "string", valueType: "string" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ name: { $type: "string" } });
  });
  it("uses extended JSON for objectId", () => {
    const c: Condition = { id: "1", field: "_id", op: "$eq", value: "507f1f77bcf86cd799439011", valueType: "objectId" };
    const r = conditionToMql(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ _id: { $eq: { $oid: "507f1f77bcf86cd799439011" } } });
  });
  it("rejects empty field", () => {
    const c: Condition = { id: "1", field: "", op: "$eq", value: "x", valueType: "string" };
    expect(conditionToMql(c).ok).toBe(false);
  });
  it("rejects invalid field name (starts with $)", () => {
    const c: Condition = { id: "1", field: "$bad", op: "$eq", value: "x", valueType: "string" };
    expect(conditionToMql(c).ok).toBe(false);
  });
});

// ---------- Group -> MQL ----------

describe("mongodb-query-builder groupToMql", () => {
  it("returns empty for group with no conditions", () => {
    const g: Group = { id: "g1", logic: "and", conditions: [], groups: [] };
    expect(groupToMql(g)).toEqual({ ok: true, mql: {} });
  });
  it("returns single condition unwrapped", () => {
    const g: Group = {
      id: "g1", logic: "and",
      conditions: [{ id: "c1", field: "name", op: "$eq", value: "Alice", valueType: "string" }],
      groups: [],
    };
    const r = groupToMql(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ name: { $eq: "Alice" } });
  });
  it("wraps multiple conditions in $and", () => {
    const g: Group = {
      id: "g1", logic: "and",
      conditions: [
        { id: "c1", field: "a", op: "$eq", value: "1", valueType: "string" },
        { id: "c2", field: "b", op: "$eq", value: "2", valueType: "string" },
      ],
      groups: [],
    };
    const r = groupToMql(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ $and: [{ a: { $eq: "1" } }, { b: { $eq: "2" } }] });
  });
  it("wraps in $or when logic is or", () => {
    const g: Group = {
      id: "g1", logic: "or",
      conditions: [
        { id: "c1", field: "a", op: "$eq", value: "1", valueType: "string" },
        { id: "c2", field: "b", op: "$eq", value: "2", valueType: "string" },
      ],
      groups: [],
    };
    const r = groupToMql(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({ $or: [{ a: { $eq: "1" } }, { b: { $eq: "2" } }] });
  });
  it("nests sub-groups", () => {
    const g: Group = {
      id: "g1", logic: "and",
      conditions: [{ id: "c1", field: "a", op: "$eq", value: "1", valueType: "string" }],
      groups: [{
        id: "g2", logic: "or",
        conditions: [
          { id: "c2", field: "b", op: "$eq", value: "2", valueType: "string" },
          { id: "c3", field: "c", op: "$eq", value: "3", valueType: "string" },
        ],
        groups: [],
      }],
    };
    const r = groupToMql(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mql).toEqual({
      $and: [
        { a: { $eq: "1" } },
        { $or: [{ b: { $eq: "2" } }, { c: { $eq: "3" } }] },
      ],
    });
  });
});

// ---------- State -> filter / options ----------

describe("mongodb-query-builder stateToFilter & stateToOptions", () => {
  it("returns empty filter for default state", () => {
    const s = createDefaultState();
    const r = stateToFilter(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.filter).toEqual({});
  });
  it("returns projection/sort/limit/skip", () => {
    const s = createDefaultState();
    s.projection = [{ field: "name", include: true }, { field: "password", include: false }];
    s.sort = [{ field: "createdAt", dir: -1 }];
    s.limit = 10;
    s.skip = 5;
    const opts = stateToOptions(s);
    expect(opts.projection).toEqual({ name: 1, password: 0 });
    expect(opts.sort).toEqual({ createdAt: -1 });
    expect(opts.limit).toBe(10);
    expect(opts.skip).toBe(5);
  });
  it("returns null projection/sort when empty", () => {
    const s = createDefaultState();
    const opts = stateToOptions(s);
    expect(opts.projection).toBeNull();
    expect(opts.sort).toBeNull();
  });
});

// ---------- MQL JSON / shell / driver generation ----------

describe("mongodb-query-builder generateMqlJson", () => {
  it("emits filter object as JSON", () => {
    const s = createDefaultState();
    s.root.conditions[0].field = "name";
    s.root.conditions[0].value = "Alice";
    const r = generateMqlJson(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parsed = JSON.parse(r.output);
      expect(parsed.filter).toEqual({ name: { $eq: "Alice" } });
    }
  });
  it("emits projection and limit when set", () => {
    const s = createDefaultState();
    s.projection = [{ field: "name", include: true }];
    s.limit = 5;
    const r = generateMqlJson(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parsed = JSON.parse(r.output);
      expect(parsed.projection).toEqual({ name: 1 });
      expect(parsed.limit).toBe(5);
    }
  });
});

describe("mongodb-query-builder generateMqlShell", () => {
  it("emits db.coll.find(filter) for find", () => {
    const s = createDefaultState();
    s.root.conditions[0].field = "name";
    s.root.conditions[0].value = "Alice";
    const r = generateMqlShell(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("db.myCollection.find(");
  });
  it("appends sort/limit/skip", () => {
    const s = createDefaultState();
    s.sort = [{ field: "age", dir: 1 }];
    s.limit = 10;
    s.skip = 5;
    const r = generateMqlShell(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain(".sort(");
      expect(r.output).toContain(".limit(10)");
      expect(r.output).toContain(".skip(5)");
    }
  });
  it("emits insertOne for insertOne operation", () => {
    const s = createDefaultState();
    s.operation = "insertOne";
    const r = generateMqlShell(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("db.myCollection.insertOne(");
  });
  it("emits updateMany for updateMany operation", () => {
    const s = createDefaultState();
    s.operation = "updateMany";
    const r = generateMqlShell(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("db.myCollection.updateMany(");
  });
  it("emits deleteOne for deleteOne operation", () => {
    const s = createDefaultState();
    s.operation = "deleteOne";
    const r = generateMqlShell(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("db.myCollection.deleteOne(");
  });
  it("rejects invalid update doc", () => {
    const s = createDefaultState();
    s.operation = "updateMany";
    s.updateDoc = "{not valid";
    const r = generateMqlShell(s);
    expect(r.ok).toBe(false);
  });
});

describe("mongodb-query-builder generateDriverCode", () => {
  const targets: DriverTarget[] = ["mongosh", "node", "python", "java", "csharp", "php"];
  for (const t of targets) {
    it(`generates ${t} driver code for find`, () => {
      const s = createDefaultState();
      s.root.conditions[0].field = "name";
      s.root.conditions[0].value = "Alice";
      const r = generateDriverCode(s, t);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.output.length).toBeGreaterThan(10);
    });
  }
  it("node code includes MongoClient require", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "node");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("MongoClient");
  });
  it("python code uses PyMongo find", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "python");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("from pymongo import");
      expect(r.output).toContain("collection.find(");
    }
  });
  it("java code imports com.mongodb", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "java");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("com.mongodb.client");
  });
  it("csharp code uses MongoDB.Driver", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "csharp");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("MongoDB.Driver");
  });
  it("php code opens with <?php", () => {
    const s = createDefaultState();
    const r = generateDriverCode(s, "php");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.startsWith("<?php")).toBe(true);
  });
  it("generates insertOne driver code", () => {
    const s = createDefaultState();
    s.operation = "insertOne";
    const r = generateDriverCode(s, "python");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("insert_one(");
  });
});

// ---------- Validation ----------

describe("mongodb-query-builder validateField", () => {
  it("accepts simple field names", () => {
    expect(validateField("name").ok).toBe(true);
    expect(validateField("address.city").ok).toBe(true);
    expect(validateField("tags.0").ok).toBe(true);
  });
  it("rejects fields starting with $", () => {
    expect(validateField("$where").ok).toBe(false);
  });
  it("rejects fields with whitespace", () => {
    expect(validateField("bad name").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateField("").ok).toBe(false);
    expect(validateField("   ").ok).toBe(false);
  });
});

describe("mongodb-query-builder safeJsonParse & validateJsonDoc", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}').ok).toBe(true);
  });
  it("rejects invalid JSON", () => {
    expect(safeJsonParse("{bad").ok).toBe(false);
  });
  it("accepts object JSON for doc", () => {
    expect(validateJsonDoc('{"a":1}').ok).toBe(true);
  });
  it("rejects array JSON for doc", () => {
    expect(validateJsonDoc("[1,2]").ok).toBe(false);
  });
  it("rejects primitive JSON for doc", () => {
    expect(validateJsonDoc('"x"').ok).toBe(false);
  });
});

// ---------- In-browser MQL engine ----------

describe("mongodb-query-builder matchValue", () => {
  it("$eq", () => {
    expect(matchValue("Alice", "$eq", "Alice")).toBe(true);
    expect(matchValue("Alice", "$eq", "Bob")).toBe(false);
  });
  it("$ne", () => {
    expect(matchValue(30, "$ne", 25)).toBe(true);
  });
  it("$gt / $lt", () => {
    expect(matchValue(30, "$gt", 25)).toBe(true);
    expect(matchValue(20, "$gt", 25)).toBe(false);
    expect(matchValue(20, "$lt", 25)).toBe(true);
  });
  it("$in / $nin", () => {
    expect(matchValue("admin", "$in", ["admin", "vip"])).toBe(true);
    expect(matchValue("user", "$in", ["admin", "vip"])).toBe(false);
    expect(matchValue("user", "$nin", ["admin", "vip"])).toBe(true);
  });
  it("$exists", () => {
    expect(matchValue("x", "$exists", true)).toBe(true);
    expect(matchValue(undefined, "$exists", false)).toBe(true);
  });
  it("$regex", () => {
    expect(matchValue("Alice", "$regex", "^A")).toBe(true);
    expect(matchValue("Bob", "$regex", "^A")).toBe(false);
  });
  it("$size", () => {
    expect(matchValue([1, 2], "$size", 2)).toBe(true);
    expect(matchValue([1], "$size", 2)).toBe(false);
  });
  it("$mod", () => {
    expect(matchValue(4, "$mod", [2, 0])).toBe(true);
    expect(matchValue(5, "$mod", [2, 0])).toBe(false);
  });
  it("$type", () => {
    expect(matchValue("x", "$type", "string")).toBe(true);
    expect(matchValue(5, "$type", "number")).toBe(true);
    expect(matchValue([1], "$type", "array")).toBe(true);
  });
});

describe("mongodb-query-builder getField", () => {
  const doc = { name: "Alice", address: { city: "NYC" }, tags: [{ label: "vip" }] };
  it("resolves top-level", () => {
    expect(getField(doc, "name")).toBe("Alice");
  });
  it("resolves nested", () => {
    expect(getField(doc, "address.city")).toBe("NYC");
  });
  it("resolves array-of-objects", () => {
    expect(getField(doc, "tags.label")).toBe("vip");
  });
  it("returns undefined for missing", () => {
    expect(getField(doc, "missing")).toBeUndefined();
  });
});

describe("mongodb-query-builder matchCondition", () => {
  it("matches equality", () => {
    expect(matchCondition({ name: "Alice" }, { name: "Alice" })).toBe(true);
    expect(matchCondition({ name: "Bob" }, { name: "Alice" })).toBe(false);
  });
  it("matches operator docs", () => {
    expect(matchCondition({ age: 30 }, { age: { $gt: 25 } })).toBe(true);
    expect(matchCondition({ age: 20 }, { age: { $gt: 25 } })).toBe(false);
  });
});

describe("mongodb-query-builder matchFilter", () => {
  const docs = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
    { name: "Carol", age: 35 },
  ];
  it("matches $and", () => {
    const filter = { $and: [{ name: "Alice" }, { age: { $gt: 25 } }] };
    expect(docs.filter((d) => matchFilter(d, filter))).toHaveLength(1);
  });
  it("matches $or", () => {
    const filter = { $or: [{ name: "Alice" }, { name: "Bob" }] };
    expect(docs.filter((d) => matchFilter(d, filter))).toHaveLength(2);
  });
  it("matches $nor", () => {
    const filter = { $nor: [{ name: "Alice" }] };
    expect(docs.filter((d) => matchFilter(d, filter))).toHaveLength(2);
  });
  it("matches field-level", () => {
    const filter = { age: { $gte: 30 } };
    expect(docs.filter((d) => matchFilter(d, filter))).toHaveLength(2);
  });
});

describe("mongodb-query-builder runFilter", () => {
  it("runs filter against sample docs", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    s.root.conditions[0].field = "active";
    s.root.conditions[0].op = "$eq";
    s.root.conditions[0].value = "true";
    s.root.conditions[0].valueType = "boolean";
    const r = runFilter(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matched.length).toBe(3); // Alice, Carol, Dave
  });
  it("returns empty matched for no conditions", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    const r = runFilter(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matched.length).toBe(docs.length);
  });
  it("supports nested field access", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const s = createDefaultState();
    s.root.conditions[0].field = "address.city";
    s.root.conditions[0].op = "$eq";
    s.root.conditions[0].value = "NYC";
    s.root.conditions[0].valueType = "string";
    const r = runFilter(docs, s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matched.length).toBe(2); // Alice, Carol
  });
});

describe("mongodb-query-builder extractFields", () => {
  it("extracts top-level + nested fields", () => {
    const docs = JSON.parse(SAMPLE_DOCS);
    const fields = extractFields(docs);
    expect(fields).toContain("name");
    expect(fields).toContain("age");
    expect(fields).toContain("address.city");
    expect(fields).toContain("address.zip");
  });
  it("handles empty input", () => {
    expect(extractFields([])).toEqual([]);
  });
});

// ---------- History ----------

describe("mongodb-query-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, collection: "users", operation: "find", filterPreview: "{}", matched: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, collection: "x", operation: "find", filterPreview: "{}", matched: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, collection: "x", operation: "find", filterPreview: "{}", matched: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("mongodb-query-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const s = createDefaultState();
    s.collection = "users";
    const url = buildShareUrl(s);
    expect(url).toContain("coll=users");
    expect(url).toContain("op=find");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips collection + operation", () => {
    const s = createDefaultState();
    s.collection = "orders";
    s.operation = "updateMany";
    const url = buildShareUrl(s);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.collection).toBe("orders");
    expect(parsed.operation).toBe("updateMany");
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown operations", () => {
    const parsed = parseShareUrl("coll=x&op=invalidOp");
    expect(parsed.operation).toBeUndefined();
  });
  it("round-trips limit and skip", () => {
    const s = createDefaultState();
    s.limit = 25;
    s.skip = 5;
    const url = buildShareUrl(s);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.limit).toBe(25);
    expect(parsed.skip).toBe(5);
  });
});

// Type usage guard (suppress unused-import lint)
export type _Unused = QueryState;
