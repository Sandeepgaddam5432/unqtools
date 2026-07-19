import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  DRAFT_LABELS,
  DRAFT_SCHEMA_URIS,
  SAMPLE_OBJECTS,
  inferType,
  inferFormat,
  inferEnum,
  inferNumberConstraints,
  inferStringConstraints,
  inferSchemaForValue,
  mergeTwo,
  mergeSchemas,
  mergeObjects,
  mergeArrays,
  inferSchema,
  serializeSchema,
  escapeRegex,
  validateAgainstSchema,
  renderMarkdown,
  parseInput,
  parseMultipleInputs,
  jsLiteralToJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type InferenceOptions,
  type JsonSchema,
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

describe("ai-js-object-to-json-schema constants", () => {
  it("exposes two drafts with labels", () => {
    expect(Object.keys(DRAFT_LABELS)).toHaveLength(2);
    expect(DRAFT_LABELS["draft-07"]).toBe("Draft 7");
    expect(DRAFT_LABELS["draft-2020-12"]).toBe("Draft 2020-12");
  });
  it("exposes $schema URIs for both drafts", () => {
    expect(DRAFT_SCHEMA_URIS["draft-07"]).toContain("draft-07");
    expect(DRAFT_SCHEMA_URIS["draft-2020-12"]).toContain("2020-12");
  });
  it("ships 4 sample presets", () => {
    expect(SAMPLE_OBJECTS).toHaveLength(4);
    expect(SAMPLE_OBJECTS.some((s) => s.name === "User")).toBe(true);
  });
  it("uses unique localStorage keys", () => {
    expect(HISTORY_KEY).toContain("ai-js-object-to-json-schema-converter");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-js-object-to-json-schema-converter");
  });
});

describe("ai-js-object-to-json-schema inferType", () => {
  it("returns 'null' for null", () => {
    expect(inferType(null)).toBe("null");
  });
  it("returns 'string' for strings", () => {
    expect(inferType("hello")).toBe("string");
  });
  it("returns 'integer' for whole numbers", () => {
    expect(inferType(42)).toBe("integer");
  });
  it("returns 'number' for decimals", () => {
    expect(inferType(3.14)).toBe("number");
  });
  it("returns 'boolean' for booleans", () => {
    expect(inferType(true)).toBe("boolean");
  });
  it("returns 'array' for arrays", () => {
    expect(inferType([1, 2, 3])).toBe("array");
  });
  it("returns 'object' for plain objects", () => {
    expect(inferType({ a: 1 })).toBe("object");
  });
});

describe("ai-js-object-to-json-schema inferFormat", () => {
  it("detects email", () => {
    expect(inferFormat("alice@example.com")).toBe("email");
  });
  it("detects date-time", () => {
    expect(inferFormat("2024-01-15T10:30:00Z")).toBe("date-time");
  });
  it("detects date", () => {
    expect(inferFormat("2024-01-15")).toBe("date");
  });
  it("detects uuid", () => {
    expect(inferFormat("550e8400-e29b-41d4-a716-446655440000")).toBe("uuid");
  });
  it("detects uri", () => {
    expect(inferFormat("https://example.com/page")).toBe("uri");
  });
  it("returns null for plain strings", () => {
    expect(inferFormat("hello world")).toBeNull();
  });
  it("returns null for non-strings", () => {
    expect(inferFormat(42)).toBeNull();
    expect(inferFormat(null)).toBeNull();
  });
});

describe("ai-js-object-to-json-schema inferEnum", () => {
  it("infers enum for small string set", () => {
    const e = inferEnum(["admin", "user", "admin", "guest"]);
    expect(e).not.toBeNull();
    expect(e).toContain("admin");
    expect(e).toContain("user");
    expect(e).toContain("guest");
  });
  it("returns null for single value", () => {
    expect(inferEnum(["only"])).toBeNull();
  });
  it("returns null when all values are unique (too varied)", () => {
    const vals = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    expect(inferEnum(vals)).toBeNull();
  });
  it("returns null for mixed types", () => {
    expect(inferEnum(["a", 1, true])).toBeNull();
  });
  it("returns null for strings longer than 40 chars", () => {
    const long = "x".repeat(50);
    expect(inferEnum([long, "y"])).toBeNull();
  });
  it("returns null for empty list", () => {
    expect(inferEnum([])).toBeNull();
  });
});

describe("ai-js-object-to-json-schema constraint inference", () => {
  it("inferNumberConstraints computes min/max", () => {
    const c = inferNumberConstraints([5, 10, 3, 8]);
    expect(c.minimum).toBe(3);
    expect(c.maximum).toBe(10);
  });
  it("inferNumberConstraints returns empty for empty list", () => {
    expect(inferNumberConstraints([])).toEqual({});
  });
  it("inferStringConstraints computes min/maxLength", () => {
    const c = inferStringConstraints(["hi", "hello", "x"]);
    expect(c.minLength).toBe(1);
    expect(c.maxLength).toBe(5);
  });
});

describe("ai-js-object-to-json-schema inferSchemaForValue", () => {
  const opts: InferenceOptions = { draft: "draft-07" };
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });

  it("infers scalar schemas", () => {
    expect(inferSchemaForValue("hi", opts, acc(), "$")).toEqual({ type: "string", minLength: 2, maxLength: 2 });
    expect(inferSchemaForValue(42, opts, acc(), "$")).toEqual({ type: "integer" });
    expect(inferSchemaForValue(true, opts, acc(), "$")).toEqual({ type: "boolean" });
    expect(inferSchemaForValue(null, opts, acc(), "$")).toEqual({ type: "null" });
  });
  it("infers string with format", () => {
    const r = inferSchemaForValue("alice@example.com", opts, acc(), "$");
    expect(r.type).toBe("string");
    expect(r.format).toBe("email");
  });
  it("infers nested object", () => {
    const r = inferSchemaForValue({ a: 1, b: "x", c: { d: true } }, opts, acc(), "$");
    expect(r.type).toBe("object");
    expect(r.properties).toBeDefined();
    expect(r.properties!.a.type).toBe("integer");
    expect(r.properties!.b.type).toBe("string");
    expect(r.properties!.c.type).toBe("object");
    expect(r.properties!.c.properties!.d.type).toBe("boolean");
    expect(r.required).toEqual(["a", "b", "c"]);
    expect(r.additionalProperties).toBe(false);
  });
  it("infers array of scalars", () => {
    const r = inferSchemaForValue([1, 2, 3], opts, acc(), "$");
    expect(r.type).toBe("array");
    expect(r.items).toEqual({ type: "integer" });
  });
  it("flags empty arrays", () => {
    const a = acc();
    const r = inferSchemaForValue([], opts, a, "$");
    expect(r.type).toBe("array");
    expect(r.items).toEqual({});
    expect(a.warnings.length).toBeGreaterThan(0);
    expect(a.warnings[0]).toContain("empty");
  });
  it("infers array of objects by merging", () => {
    const r = inferSchemaForValue(
      [{ a: 1 }, { a: 2, b: "x" }],
      opts,
      acc(),
      "$",
    );
    expect(r.type).toBe("array");
    const items = r.items as JsonSchema;
    expect(items.type).toBe("object");
    expect(items.properties!.a.type).toBe("integer");
    expect(items.properties!.b.type).toBe("string");
  });
});

describe("ai-js-object-to-json-schema mergeTwo", () => {
  const opts: InferenceOptions = { draft: "draft-07" };
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });

  it("merges two string schemas", () => {
    const r = mergeTwo(
      { type: "string", minLength: 2, maxLength: 5 },
      { type: "string", minLength: 3, maxLength: 7 },
      opts,
      acc(),
      "$",
    );
    expect(r.type).toBe("string");
    expect(r.minLength).toBe(2);
    expect(r.maxLength).toBe(7);
  });
  it("emits anyOf for mixed types", () => {
    const a = acc();
    const r = mergeTwo({ type: "string" }, { type: "integer" }, opts, a, "$");
    expect(r.anyOf).toBeDefined();
    expect(r.anyOf!.length).toBe(2);
    expect(a.warnings.length).toBeGreaterThan(0);
  });
  it("produces nullable for null + string in draft-07", () => {
    const a = acc();
    const r = mergeTwo({ type: "string" }, { type: "null" }, opts, a, "$");
    expect(r.anyOf).toBeDefined();
    expect(r.anyOf!.some((s) => s.type === "null")).toBe(true);
    expect(r.anyOf!.some((s) => s.type === "string")).toBe(true);
  });
  it("produces type array for null + string in draft-2020-12", () => {
    const a = acc();
    const opts2020: InferenceOptions = { draft: "draft-2020-12" };
    const r = mergeTwo({ type: "string" }, { type: "null" }, opts2020, a, "$");
    expect(Array.isArray(r.type)).toBe(true);
    expect(r.type).toContain("string");
    expect(r.type).toContain("null");
  });
});

describe("ai-js-object-to-json-schema mergeObjects & mergeArrays", () => {
  const opts: InferenceOptions = { draft: "draft-07" };
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });

  it("merges objects with union props and intersected required", () => {
    const r = mergeObjects(
      { type: "object", properties: { a: { type: "integer" }, b: { type: "string" } }, required: ["a", "b"] },
      { type: "object", properties: { a: { type: "integer" }, c: { type: "boolean" } }, required: ["a", "c"] },
      opts,
      acc(),
      "$",
    );
    expect(Object.keys(r.properties!).sort()).toEqual(["a", "b", "c"]);
    expect(r.required).toEqual(["a"]); // only 'a' appears in both required lists
  });
  it("merges arrays by merging item schemas", () => {
    const r = mergeArrays(
      { type: "array", items: { type: "integer" } },
      { type: "array", items: { type: "integer" } },
      opts,
      acc(),
      "$",
    );
    expect(r.type).toBe("array");
    expect(r.items).toEqual({ type: "integer" });
  });
});

describe("ai-js-object-to-json-schema inferSchema (full pipeline)", () => {
  it("infers schema from a single User sample", () => {
    const r = inferSchema([
      {
        id: 42,
        name: "Alice",
        email: "alice@example.com",
        active: true,
        role: "admin",
        createdAt: "2024-01-15T10:30:00Z",
      },
    ]);
    expect(r.schema.$schema).toContain("draft-07");
    expect(r.schema.type).toBe("object");
    expect(r.schema.properties!.id.type).toBe("integer");
    expect(r.schema.properties!.email.format).toBe("email");
    expect(r.schema.properties!.createdAt.format).toBe("date-time");
    expect(r.schema.properties!.name.type).toBe("string");
    expect(r.schema.required).toContain("id");
    expect(r.schema.required).toContain("email");
  });
  it("merges multiple samples", () => {
    const r = inferSchema([
      { id: 1, name: "A", active: true },
      { id: 2, name: "B", active: false, role: "user" },
    ]);
    expect(Object.keys(r.schema.properties!).sort()).toEqual(["active", "id", "name", "role"]);
    // 'role' only appears in one sample → not required.
    expect(r.schema.required).toContain("id");
    expect(r.schema.required).toContain("name");
    expect(r.schema.required).toContain("active");
    expect(r.schema.required).not.toContain("role");
  });
  it("respects draft-2020-12 option", () => {
    const r = inferSchema([{ a: 1 }], { draft: "draft-2020-12" });
    expect(r.schema.$schema).toContain("2020-12");
  });
  it("disables format detection when requested", () => {
    const r = inferSchema(
      [{ email: "alice@example.com" }],
      { detectFormats: false },
    );
    expect(r.schema.properties!.email.format).toBeUndefined();
  });
  it("disables required when requested", () => {
    const r = inferSchema([{ a: 1 }], { inferRequired: false });
    expect(r.schema.required).toBeUndefined();
  });
  it("flags empty arrays", () => {
    const r = inferSchema([{ tags: [] }]);
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true);
    expect(r.schema.properties!.tags.type).toBe("array");
  });
  it("returns empty schema for no samples", () => {
    const r = inferSchema([]);
    expect(r.schema).toEqual({});
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-js-object-to-json-schema serializeSchema", () => {
  it("serializes to indented JSON", () => {
    const s = serializeSchema({ type: "string" }, 2);
    expect(s).toBe('{\n  "type": "string"\n}');
  });
  it("uses given indent", () => {
    const s = serializeSchema({ type: "string" }, 0);
    expect(s).toBe('{"type":"string"}');
  });
});

describe("ai-js-object-to-json-schema escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("[braces]")).toBe("\\[braces\\]");
  });
});

describe("ai-js-object-to-json-schema validateAgainstSchema", () => {
  it("validates a correct value", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { id: { type: "integer" }, name: { type: "string" } },
      required: ["id", "name"],
    };
    const v = validateAgainstSchema({ id: 1, name: "A" }, schema);
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });
  it("reports missing required field", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
    };
    const v = validateAgainstSchema({}, schema);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.message.includes("Missing required"))).toBe(true);
  });
  it("reports wrong type", () => {
    const schema: JsonSchema = { type: "string" };
    const v = validateAgainstSchema(42, schema);
    expect(v.valid).toBe(false);
    expect(v.errors[0].message).toContain("Expected type string");
  });
  it("accepts integer where number is expected", () => {
    const v = validateAgainstSchema(42, { type: "number" });
    expect(v.valid).toBe(true);
  });
  it("reports enum violation", () => {
    const v = validateAgainstSchema("c", { type: "string", enum: ["a", "b"] });
    expect(v.valid).toBe(false);
    expect(v.errors[0].message).toContain("enum");
  });
  it("reports minLength violation", () => {
    const v = validateAgainstSchema("hi", { type: "string", minLength: 5 });
    expect(v.valid).toBe(false);
    expect(v.errors[0].message).toContain("minLength");
  });
  it("validates anyOf branches", () => {
    const v = validateAgainstSchema(
      "hello",
      { anyOf: [{ type: "integer" }, { type: "string" }] },
    );
    expect(v.valid).toBe(true);
  });
  it("reports additionalProperties when false", () => {
    const v = validateAgainstSchema(
      { a: 1, b: 2 },
      {
        type: "object",
        properties: { a: { type: "integer" } },
        required: ["a"],
        additionalProperties: false,
      },
    );
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.message.includes("Additional property 'b'"))).toBe(true);
  });
});

describe("ai-js-object-to-json-schema renderMarkdown", () => {
  it("renders a header and schema block", () => {
    const md = renderMarkdown(
      { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
      { sampleCount: 2, warnings: [] },
    );
    expect(md).toContain("# Inferred JSON Schema");
    expect(md).toContain("```json");
    expect(md).toContain('"$schema"');
    expect(md).toContain("## Field reference");
    expect(md).toContain("| `id`");
  });
  it("includes warnings section when warnings present", () => {
    const md = renderMarkdown(
      { type: "object" },
      { sampleCount: 1, warnings: ["bad thing"] },
    );
    expect(md).toContain("## Warnings");
    expect(md).toContain("- bad thing");
  });
});

describe("ai-js-object-to-json-schema parseInput", () => {
  it("parses strict JSON", () => {
    const r = parseInput('{"a":1,"b":"x"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1, b: "x" });
  });
  it("parses JS object literal with single quotes", () => {
    const r = parseInput("{a: 1, b: 'hello',}");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1, b: "hello" });
  });
  it("parses JS object with unquoted keys", () => {
    const r = parseInput("{name: 'Alice', age: 30}");
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as { name: string }).name).toBe("Alice");
  });
  it("returns error for empty input", () => {
    const r = parseInput("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("empty");
  });
  it("returns error for invalid input", () => {
    const r = parseInput("{not valid");
    expect(r.ok).toBe(false);
  });
});

describe("ai-js-object-to-json-schema parseMultipleInputs & jsLiteralToJson", () => {
  it("splits on blank lines", () => {
    const r = parseMultipleInputs('{"a":1}\n\n{"a":2}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toHaveLength(2);
  });
  it("splits on --- separator", () => {
    const r = parseMultipleInputs('{"a":1}\n---\n{"a":2}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toHaveLength(2);
  });
  it("handles a single sample", () => {
    const r = parseMultipleInputs('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toHaveLength(1);
  });
  it("returns empty list for empty input", () => {
    const r = parseMultipleInputs("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toEqual([]);
  });
  it("jsLiteralToJson strips trailing commas and quotes keys", () => {
    expect(JSON.parse(jsLiteralToJson("{a: 1, b: 'x',}"))).toEqual({ a: 1, b: "x" });
  });
  it("jsLiteralToJson strips line comments", () => {
    expect(JSON.parse(jsLiteralToJson("{a: 1 // comment\n}"))).toEqual({ a: 1 });
  });
});

describe("ai-js-object-to-json-schema history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, draft: "draft-07", rootType: "object", fieldCount: 5, sampleCount: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, draft: "draft-07", rootType: "object", fieldCount: 1, sampleCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, draft: "draft-07", rootType: "object", fieldCount: 1, sampleCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-js-object-to-json-schema shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl('{"a":1}', { draft: "draft-2020-12", detectFormats: false });
    expect(url).toContain("s=");
    expect(url).toContain("draft=2020");
    expect(url).toContain("fmt=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("s=%7B%22a%22%3A1%7D&draft=2020&fmt=0");
    expect(p.samples).toBe('{"a":1}');
    expect(p.options.draft).toBe("draft-2020-12");
    expect(p.options.detectFormats).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ samples: "", options: {} });
  });
  it("round-trips options", () => {
    const opts: InferenceOptions = {
      detectFormats: false,
      inferEnums: false,
      inferRequired: false,
      inferConstraints: false,
      draft: "draft-2020-12",
    };
    const url = buildShareUrl("xyz", opts);
    const parsed = parseShareUrl(url.split("#")[1] ?? url);
    expect(parsed.options).toEqual(opts);
    expect(parsed.samples).toBe("xyz");
  });
});

describe("ai-js-object-to-json-schema LLM helpers", () => {
  it("buildLlmPrompt includes schema and sample count", () => {
    const prompt = buildLlmPrompt({ type: "object", properties: { id: { type: "integer" } } }, 3);
    expect(prompt).toContain("Number of samples merged: 3");
    expect(prompt).toContain("```json");
    expect(prompt).toContain('"type": "object"');
  });
  it("renderLlmResult parses valid output", () => {
    const raw = JSON.stringify({
      title: "User",
      descriptions: [{ path: "id", description: "Unique identifier" }],
      suggestions: ["Add a pattern for email"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.title).toBe("User");
      expect(r.result.descriptions).toHaveLength(1);
      expect(r.result.suggestions).toHaveLength(1);
    }
  });
  it("renderLlmResult strips code fences", () => {
    const raw = "```json\n" + JSON.stringify({ title: "X", descriptions: [], suggestions: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects non-JSON", () => {
    const r = renderLlmResult("not json at all");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult rejects non-object JSON", () => {
    const r = renderLlmResult("[1, 2, 3]");
    expect(r.ok).toBe(false);
  });
});
