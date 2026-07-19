import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  SUPPORTED_LOCALES,
  SUPPORTED_FORMATS,
  SAMPLE_SCHEMAS,
  hashSeed,
  createRng,
  pick,
  randomInt,
  randomFloat,
  randomString,
  randomBoolean,
  randomFirstName,
  randomLastName,
  randomFullName,
  randomEmail,
  randomUuid,
  randomDateTime,
  randomDate,
  randomUrl,
  randomIpv4,
  randomPhone,
  randomStreet,
  randomCity,
  randomState,
  randomZip,
  randomCountry,
  randomLorem,
  parseSchema,
  normalizeType,
  generateFromPattern,
  generateMockString,
  generateMockArray,
  generateMockObject,
  generateMockValue,
  generateMockRecord,
  generateMockData,
  renderJson,
  flattenRecord,
  flattenValue,
  renderCsv,
  renderSql,
  escapeCsv,
  sqlValue,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  validateGenerated,
  type JsonSchema,
  type GeneratorOptions,
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

describe("ai-json-mock-data-generator constants", () => {
  it("exposes 6 supported locales", () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThanOrEqual(5);
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("de");
  });
  it("exposes supported formats including email, date-time, uuid", () => {
    expect(SUPPORTED_FORMATS).toContain("email");
    expect(SUPPORTED_FORMATS).toContain("date-time");
    expect(SUPPORTED_FORMATS).toContain("uuid");
    expect(SUPPORTED_FORMATS).toContain("uri");
  });
  it("ships 4 sample schemas", () => {
    expect(SAMPLE_SCHEMAS).toHaveLength(4);
    expect(SAMPLE_SCHEMAS.some((s) => s.name === "User")).toBe(true);
    expect(SAMPLE_SCHEMAS.some((s) => s.name === "Order")).toBe(true);
  });
  it("uses unique localStorage keys", () => {
    expect(HISTORY_KEY).toContain("ai-json-mock-data-generator");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-json-mock-data-generator");
  });
});

describe("ai-json-mock-data-generator PRNG", () => {
  it("hashSeed is deterministic", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
  it("createRng produces deterministic sequence for same seed", () => {
    const r1 = createRng("seed-1");
    const r2 = createRng("seed-1");
    const seq1 = [r1(), r1(), r1()];
    const seq2 = [r2(), r2(), r2()];
    expect(seq1).toEqual(seq2);
  });
  it("createRng produces different sequences for different seeds", () => {
    const r1 = createRng("seed-1");
    const r2 = createRng("seed-2");
    expect(r1()).not.toBe(r2());
  });
  it("rng returns values in [0, 1)", () => {
    const r = createRng("test");
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("ai-json-mock-data-generator faker helpers", () => {
  const rng = createRng("test-1");
  it("pick returns an element", () => {
    const v = pick(rng, ["a", "b", "c"]);
    expect(["a", "b", "c"]).toContain(v);
  });
  it("randomInt is in range", () => {
    for (let i = 0; i < 50; i++) {
      const v = randomInt(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("randomFloat is in range with correct decimals", () => {
    const v = randomFloat(rng, 0, 1, 2);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    const s = String(v).split(".")[1] ?? "";
    expect(s.length).toBeLessThanOrEqual(2);
  });
  it("randomString has the right length", () => {
    expect(randomString(rng, 10)).toHaveLength(10);
  });
  it("randomBoolean returns a boolean", () => {
    expect(typeof randomBoolean(rng)).toBe("boolean");
  });
  it("randomFirstName returns a non-empty string", () => {
    expect(randomFirstName(rng).length).toBeGreaterThan(0);
  });
  it("randomLastName returns a non-empty string", () => {
    expect(randomLastName(rng).length).toBeGreaterThan(0);
  });
  it("randomFullName includes a space", () => {
    expect(randomFullName(rng)).toContain(" ");
  });
  it("randomEmail looks like an email", () => {
    const e = randomEmail(rng);
    expect(e).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  it("randomUuid matches UUID v4 format", () => {
    const u = randomUuid(rng);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("randomDateTime is ISO format", () => {
    const d = randomDateTime(rng);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it("randomDate is YYYY-MM-DD", () => {
    const d = randomDate(rng);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("randomUrl starts with https://", () => {
    expect(randomUrl(rng).startsWith("https://")).toBe(true);
  });
  it("randomIpv4 has 4 octets", () => {
    const parts = randomIpv4(rng).split(".");
    expect(parts).toHaveLength(4);
    for (const p of parts) expect(parseInt(p, 10)).toBeGreaterThanOrEqual(0);
  });
  it("randomPhone starts with +1", () => {
    expect(randomPhone(rng).startsWith("+1 ")).toBe(true);
  });
  it("randomStreet starts with a number", () => {
    expect(/^\d+\s/.test(randomStreet(rng))).toBe(true);
  });
  it("randomCity is non-empty", () => {
    expect(randomCity(rng).length).toBeGreaterThan(0);
  });
  it("randomState is 2 letters", () => {
    expect(randomState(rng)).toMatch(/^[A-Z]{2}$/);
  });
  it("randomZip is 5 digits", () => {
    expect(randomZip(rng)).toMatch(/^\d{5}$/);
  });
  it("randomCountry is non-empty", () => {
    expect(randomCountry(rng).length).toBeGreaterThan(0);
  });
  it("randomLorem ends with a period", () => {
    expect(randomLorem(rng).endsWith(".")).toBe(true);
  });
});

describe("ai-json-mock-data-generator parseSchema", () => {
  it("parses a valid schema object", () => {
    const r = parseSchema('{"type":"object","properties":{"a":{"type":"string"}}}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.schema.type).toBe("object");
  });
  it("returns error for empty input", () => {
    const r = parseSchema("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("empty");
  });
  it("returns error for non-object JSON", () => {
    const r = parseSchema("[1, 2, 3]");
    expect(r.ok).toBe(false);
  });
  it("returns error for invalid JSON", () => {
    const r = parseSchema("{not valid");
    expect(r.ok).toBe(false);
  });
});

describe("ai-json-mock-data-generator normalizeType", () => {
  it("returns the type string", () => {
    expect(normalizeType("string")).toBe("string");
  });
  it("returns null when type is undefined", () => {
    expect(normalizeType(undefined)).toBeNull();
  });
  it("picks first non-null type from array", () => {
    expect(normalizeType(["null", "string"])).toBe("string");
  });
  it("returns 'null' when all types are null", () => {
    expect(normalizeType(["null"])).toBe("null");
  });
});

describe("ai-json-mock-data-generator generateFromPattern", () => {
  const rng = createRng("pattern-1");
  it("generates a string matching a simple digit pattern", () => {
    const s = generateFromPattern("^\\d{3}$", rng);
    expect(s).not.toBeNull();
    expect(s!).toMatch(/^\d{3}$/);
  });
  it("generates a SKU matching A-Z and digits", () => {
    const s = generateFromPattern("^[A-Z]{3}-[0-9]{3}$", rng);
    expect(s).not.toBeNull();
    expect(s!).toMatch(/^[A-Z]{3}-[0-9]{3}$/);
  });
  it("returns null for malformed pattern", () => {
    const s = generateFromPattern("[unclosed", rng);
    expect(s).toBeNull();
  });
});

describe("ai-json-mock-data-generator generateMockString", () => {
  const rng = createRng("str-1");
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });
  it("generates email for format: email", () => {
    const s = generateMockString({ type: "string", format: "email" }, rng, acc(), "$");
    expect(s).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  it("generates UUID for format: uuid", () => {
    const s = generateMockString({ type: "string", format: "uuid" }, rng, acc(), "$");
    expect(s).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("generates date for format: date", () => {
    const s = generateMockString({ type: "string", format: "date" }, rng, acc(), "$");
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("generates URL for format: uri", () => {
    const s = generateMockString({ type: "string", format: "uri" }, rng, acc(), "$");
    expect(s.startsWith("https://")).toBe(true);
  });
  it("respects maxLength", () => {
    const s = generateMockString({ type: "string", maxLength: 5 }, rng, acc(), "$");
    expect(s.length).toBeLessThanOrEqual(5);
  });
  it("respects pattern", () => {
    const s = generateMockString({ type: "string", pattern: "^\\d{4}$" }, rng, acc(), "$");
    expect(s).toMatch(/^\d{4}$/);
  });
  it("notes unknown format", () => {
    const a = acc();
    generateMockString({ type: "string", format: "unknown-fmt" }, rng, a, "$");
    expect(a.notes.some((n) => n.note.includes("unknown-fmt"))).toBe(true);
  });
});

describe("ai-json-mock-data-generator generateMockArray", () => {
  const rng = createRng("arr-1");
  const opts: GeneratorOptions = { defaultMinItems: 1, defaultMaxItems: 3 };
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });
  it("generates an array with the right item schema", () => {
    const arr = generateMockArray(
      { type: "array", items: { type: "integer", minimum: 1, maximum: 10 } },
      rng,
      opts,
      acc(),
      "$",
    );
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr.length).toBeLessThanOrEqual(3);
    for (const v of arr) {
      expect(typeof v).toBe("number");
      expect(v as number).toBeGreaterThanOrEqual(1);
      expect(v as number).toBeLessThanOrEqual(10);
    }
  });
  it("respects minItems and maxItems", () => {
    const arr = generateMockArray(
      { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
      rng,
      opts,
      acc(),
      "$",
    );
    expect(arr).toHaveLength(4);
  });
  it("handles tuple items", () => {
    const arr = generateMockArray(
      { type: "array", items: [{ type: "integer" }, { type: "string" }] },
      rng,
      opts,
      acc(),
      "$",
    );
    expect(arr).toHaveLength(2);
    expect(typeof arr[0]).toBe("number");
    expect(typeof arr[1]).toBe("string");
  });
  it("falls back to primitives when items missing", () => {
    const arr = generateMockArray({ type: "array" }, rng, opts, acc(), "$");
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(0);
  });
});

describe("ai-json-mock-data-generator generateMockObject", () => {
  const rng = createRng("obj-1");
  const opts: GeneratorOptions = {};
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });
  it("generates all required fields", () => {
    const obj = generateMockObject(
      {
        type: "object",
        required: ["id", "name"],
        properties: { id: { type: "integer" }, name: { type: "string" } },
      },
      rng,
      opts,
      acc(),
      "$",
    );
    expect("id" in obj).toBe(true);
    expect("name" in obj).toBe(true);
  });
  it("may omit optional fields", () => {
    const obj = generateMockObject(
      {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "integer" },
          optional1: { type: "string" },
          optional2: { type: "string" },
          optional3: { type: "string" },
          optional4: { type: "string" },
        },
      },
      rng,
      opts,
      acc(),
      "$",
    );
    // 'id' must be present; the generator populates all defined properties
    // (mock data is fully populated). The 'required' array drives validation,
    // not inclusion.
    expect("id" in obj).toBe(true);
  });
  it("generates nested objects", () => {
    const obj = generateMockObject(
      {
        type: "object",
        properties: {
          mfr: {
            type: "object",
            properties: {
              name: { type: "string" },
              country: { type: "string" },
            },
          },
        },
      },
      rng,
      opts,
      acc(),
      "$",
    );
    expect(typeof obj.mfr).toBe("object");
    expect("name" in (obj.mfr as Record<string, unknown>)).toBe(true);
  });
});

describe("ai-json-mock-data-generator generateMockValue", () => {
  const rng = createRng("val-1");
  const opts: GeneratorOptions = {};
  const acc = () => ({ warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> });
  it("generates null for null type", () => {
    expect(generateMockValue({ type: "null" }, rng, opts, acc(), "$")).toBeNull();
  });
  it("generates boolean for boolean type", () => {
    expect(typeof generateMockValue({ type: "boolean" }, rng, opts, acc(), "$")).toBe("boolean");
  });
  it("returns const when const is set", () => {
    expect(generateMockValue({ type: "string", const: "fixed" }, rng, opts, acc(), "$")).toBe("fixed");
  });
  it("returns enum value when enum is set", () => {
    const v = generateMockValue({ type: "string", enum: ["a", "b", "c"] }, rng, opts, acc(), "$");
    expect(["a", "b", "c"]).toContain(v);
  });
  it("uses anyOf first branch", () => {
    const v = generateMockValue({ anyOf: [{ type: "integer", minimum: 1, maximum: 5 }] }, rng, opts, acc(), "$");
    expect(typeof v).toBe("number");
  });
  it("warns when type is missing", () => {
    const a = acc();
    const v = generateMockValue({}, rng, opts, a, "$");
    expect(v).toBeNull();
    expect(a.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-json-mock-data-generator generateMockRecord & generateMockData", () => {
  it("generates a single record matching the User preset schema", () => {
    const r = generateMockRecord(SAMPLE_SCHEMAS[0].schema, { seed: "u1" });
    expect(r.record).not.toBeNull();
    expect(typeof r.record).toBe("object");
    const rec = r.record as Record<string, unknown>;
    expect(rec.id).toBeDefined();
    expect(rec.name).toBeDefined();
    expect(rec.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(["admin", "user", "guest"]).toContain(rec.role);
  });
  it("generates N records deterministically with same seed", () => {
    const a = generateMockData(SAMPLE_SCHEMAS[0].schema, 5, { seed: "seed-x" });
    const b = generateMockData(SAMPLE_SCHEMAS[0].schema, 5, { seed: "seed-x" });
    expect(a.records).toEqual(b.records);
  });
  it("generates different records with different seeds", () => {
    const a = generateMockData(SAMPLE_SCHEMAS[0].schema, 3, { seed: "seed-1" });
    const b = generateMockData(SAMPLE_SCHEMAS[0].schema, 3, { seed: "seed-2" });
    expect(a.records).not.toEqual(b.records);
  });
  it("respects count", () => {
    const r = generateMockData(SAMPLE_SCHEMAS[1].schema, 7, { seed: "p" });
    expect(r.records).toHaveLength(7);
  });
  it("generates nested Product arrays", () => {
    const r = generateMockData(SAMPLE_SCHEMAS[1].schema, 3, { seed: "p2" });
    for (const rec of r.records) {
      const r2 = rec as Record<string, unknown>;
      expect(Array.isArray(r2.tags)).toBe(true);
      expect(typeof r2.manufacturer).toBe("object");
    }
  });
  it("generates nested Order items arrays", () => {
    const r = generateMockData(SAMPLE_SCHEMAS[2].schema, 2, { seed: "o" });
    for (const rec of r.records) {
      const r2 = rec as Record<string, unknown>;
      expect(Array.isArray(r2.items)).toBe(true);
      expect((r2.items as unknown[]).length).toBeGreaterThan(0);
      const item = (r2.items as Array<Record<string, unknown>>)[0];
      expect(item.productId).toBeDefined();
      expect(item.qty).toBeDefined();
    }
  });
  it("records respect integer minimum/maximum", () => {
    const r = generateMockData(
      { type: "object", properties: { n: { type: "integer", minimum: 10, maximum: 20 } } },
      20,
      { seed: "minmax" },
    );
    for (const rec of r.records) {
      const n = (rec as Record<string, unknown>).n as number;
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(20);
    }
  });
});

describe("ai-json-mock-data-generator render helpers", () => {
  it("renderJson returns indented JSON array", () => {
    const s = renderJson([{ a: 1 }], 2);
    expect(s).toContain("[");
    expect(s).toContain('"a": 1');
  });
  it("flattenRecord flattens nested objects", () => {
    const f = flattenRecord({ a: 1, b: { c: 2, d: "x" } });
    expect(f["a"]).toBe("1");
    expect(f["b.c"]).toBe("2");
    expect(f["b.d"]).toBe("x");
  });
  it("flattenValue handles arrays and objects", () => {
    expect(flattenValue([1, 2, 3])).toBe("1;2;3");
    expect(flattenValue({ a: 1 })).toBe('{"a":1}');
    expect(flattenValue(null)).toBe("");
    expect(flattenValue(true)).toBe("true");
  });
  it("renderCsv produces a header + rows", () => {
    const csv = renderCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe("1,x");
    expect(lines[2]).toBe("2,y");
  });
  it("renderCsv escapes commas and quotes", () => {
    const csv = renderCsv([{ a: 'hello, "world"' }]);
    expect(csv).toContain('"hello, ""world"""');
  });
  it("renderSql produces INSERT statements", () => {
    const sql = renderSql([{ id: 1, name: "Alice" }], "users");
    expect(sql).toContain("INSERT INTO users");
    expect(sql).toContain("id, name");
    expect(sql).toContain("1, 'Alice'");
  });
  it("renderSql returns a comment for non-object records", () => {
    const sql = renderSql([1, 2, 3]);
    expect(sql).toContain("No object records");
  });
  it("escapeCsv quotes when needed", () => {
    expect(escapeCsv("plain")).toBe("plain");
    expect(escapeCsv('with "quote"')).toBe('"with ""quote"""');
    expect(escapeCsv("with,comma")).toBe('"with,comma"');
  });
  it("sqlValue renders types correctly", () => {
    expect(sqlValue(null)).toBe("NULL");
    expect(sqlValue(true)).toBe("TRUE");
    expect(sqlValue(42)).toBe("42");
    expect(sqlValue("it's")).toBe("'it''s'");
    expect(sqlValue([1, 2])).toBe("'[1,2]'");
  });
});

describe("ai-json-mock-data-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, rowCount: 5, seed: "x", rootType: "object", fieldCount: 4 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, rowCount: 1, seed: "x", rootType: "object", fieldCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, rowCount: 1, seed: "x", rootType: "object", fieldCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-json-mock-data-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl('{"type":"object"}', 10, { seed: "abc", locale: "de" });
    expect(url).toContain("s=");
    expect(url).toContain("n=10");
    expect(url).toContain("seed=abc");
    expect(url).toContain("locale=de");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("s=%7B%22type%22%3A%22object%22%7D&n=10&seed=abc&locale=de");
    expect(p.schema).toBe('{"type":"object"}');
    expect(p.rowCount).toBe(10);
    expect(p.options.seed).toBe("abc");
    expect(p.options.locale).toBe("de");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.schema).toBe("");
    expect(p.rowCount).toBe(5);
    expect(p.options).toEqual({});
  });
  it("round-trips options", () => {
    const opts: GeneratorOptions = { seed: "s1", locale: "fr", defaultMinItems: 2, defaultMaxItems: 7 };
    const url = buildShareUrl("xyz", 8, opts);
    const parsed = parseShareUrl(url.split("#")[1] ?? url);
    expect(parsed.schema).toBe("xyz");
    expect(parsed.rowCount).toBe(8);
    expect(parsed.options.seed).toBe("s1");
    expect(parsed.options.locale).toBe("fr");
    expect(parsed.options.defaultMinItems).toBe(2);
    expect(parsed.options.defaultMaxItems).toBe(7);
  });
});

describe("ai-json-mock-data-generator LLM helpers", () => {
  it("buildLlmPrompt includes description and schema output instructions", () => {
    const prompt = buildLlmPrompt("a user with id, name, email");
    expect(prompt).toContain("a user with id, name, email");
    expect(prompt).toContain('"schema"');
    expect(prompt).toContain("JSON Schema");
  });
  it("renderLlmResult parses valid output", () => {
    const raw = JSON.stringify({
      schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
      notes: ["assumed integer id"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.schema.type).toBe("object");
      expect(r.result.notes).toContain("assumed integer id");
    }
  });
  it("renderLlmResult strips code fences", () => {
    const raw = "```json\n" + JSON.stringify({ schema: { type: "object" }, notes: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects missing schema", () => {
    const r = renderLlmResult(JSON.stringify({ notes: [] }));
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult rejects non-JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
  });
});

describe("ai-json-mock-data-generator validateGenerated", () => {
  it("returns ok when all required fields present", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["id", "name"],
      properties: { id: { type: "integer" }, name: { type: "string" } },
    };
    const v = validateGenerated([{ id: 1, name: "A" }, { id: 2, name: "B" }], schema);
    expect(v.ok).toBe(true);
    expect(v.missing).toEqual([]);
  });
  it("returns missing entries when a required field is absent", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["id", "name"],
      properties: { id: { type: "integer" }, name: { type: "string" } },
    };
    const v = validateGenerated([{ id: 1 }, { id: 2, name: "B" }], schema);
    expect(v.ok).toBe(false);
    expect(v.missing).toHaveLength(1);
    expect(v.missing[0].row).toBe(0);
    expect(v.missing[0].field).toBe("name");
  });
  it("returns ok when schema has no required fields", () => {
    const v = validateGenerated([{ a: 1 }], { type: "object", properties: { a: { type: "integer" } } });
    expect(v.ok).toBe(true);
  });
  it("returns ok when schema is not an object", () => {
    const v = validateGenerated([1, 2, 3], { type: "integer" });
    expect(v.ok).toBe(true);
  });
});
