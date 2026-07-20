import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  ENDPOINT_TYPES,
  ENVELOPE_PRESETS,
  HTTP_METHODS,
  STATUS_CODES,
  WEBHOOK_TEMPLATES,
  ERROR_TEMPLATES,
  STATUS_TEXT,
  DEFAULT_OPTIONS,
  SAMPLE_SCHEMAS,
  MAX_COUNT,
  mulberry32,
  hashSeed,
  createRng,
  genUuid,
  genEmail,
  genDate,
  genDateTime,
  genTime,
  genUri,
  genIpv4,
  genIpv6,
  genPhone,
  genColor,
  genPassword,
  genSemver,
  genSlug,
  genNameFull,
  genLorem,
  genCommerceSku,
  generateByFormat,
  generateByFaker,
  generateMock,
  inferSchemaFromExample,
  validateSchema,
  validateOptions,
  wrapEnvelope,
  generateErrorBody,
  generateWebhook,
  generateHeaders,
  generateStatusLine,
  buildResponseBody,
  generateResponse,
  exportHttp,
  generateMswSnippet,
  byteLength,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  serializeSchema,
  parseSchema,
  type MockOptions,
  type JsonSchema,
  type Json,
  type EndpointType,
  type Envelope,
  type StatusCode,
  type HttpResponse,
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

describe("mock-api constants", () => {
  it("exposes 6 endpoint types", () => {
    expect(ENDPOINT_TYPES).toHaveLength(6);
    expect(ENDPOINT_TYPES.map((e) => e.value)).toEqual(
      expect.arrayContaining(["rest", "paginated", "json-api", "graphql", "error", "webhook"]),
    );
  });
  it("exposes 5 envelope presets", () => {
    expect(ENVELOPE_PRESETS).toHaveLength(5);
  });
  it("exposes 5 HTTP methods", () => {
    expect(HTTP_METHODS).toHaveLength(5);
    expect(HTTP_METHODS.map((m) => m.value)).toContain("GET");
    expect(HTTP_METHODS.map((m) => m.value)).toContain("DELETE");
  });
  it("exposes 12+ status codes with text", () => {
    expect(STATUS_CODES.length).toBeGreaterThanOrEqual(12);
    expect(STATUS_TEXT[200]).toBe("OK");
    expect(STATUS_TEXT[429]).toBe("Too Many Requests");
    expect(STATUS_TEXT[503]).toBe("Service Unavailable");
  });
  it("exposes 6 webhook templates", () => {
    expect(WEBHOOK_TEMPLATES).toHaveLength(6);
    expect(WEBHOOK_TEMPLATES.map((w) => w.value)).toContain("stripe.invoice.paid");
    expect(WEBHOOK_TEMPLATES.map((w) => w.value)).toContain("github.push");
  });
  it("DEFAULT_OPTIONS has expected defaults", () => {
    expect(DEFAULT_OPTIONS.endpoint).toBe("rest");
    expect(DEFAULT_OPTIONS.envelope).toBe("none");
    expect(DEFAULT_OPTIONS.count).toBe(5);
    expect(DEFAULT_OPTIONS.status).toBe(200);
    expect(DEFAULT_OPTIONS.method).toBe("GET");
    expect(DEFAULT_OPTIONS.pretty).toBe(true);
  });
  it("ships 5+ sample schemas", () => {
    expect(SAMPLE_SCHEMAS.length).toBeGreaterThanOrEqual(5);
    expect(SAMPLE_SCHEMAS.map((s) => s.id)).toContain("user");
    expect(SAMPLE_SCHEMAS.map((s) => s.id)).toContain("order");
  });
  it("ERROR_TEMPLATES has entry for every status code", () => {
    for (const s of STATUS_CODES) {
      expect(ERROR_TEMPLATES[s.value]).toBeDefined();
      expect(ERROR_TEMPLATES[s.value].error.length).toBeGreaterThan(0);
    }
  });
  it("MAX_COUNT is at least 10000", () => {
    expect(MAX_COUNT).toBeGreaterThanOrEqual(10000);
  });
});

describe("mock-api PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("hashSeed is deterministic and 32-bit unsigned", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed("hello")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("hello")).toBeLessThan(2 ** 32);
  });
  it("createRng helpers work", () => {
    const r = createRng("abc");
    expect(r.int(1, 10)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 10)).toBeLessThanOrEqual(10);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(typeof r.bool()).toBe("boolean");
    expect(r.hex(4)).toHaveLength(4);
    expect(r.string(5, "ab")).toHaveLength(5);
  });
});

describe("mock-api format generators", () => {
  const r = createRng("fmt");
  it("genUuid matches UUID v4 shape", () => {
    const u = genUuid(r);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("genEmail is a valid email", () => {
    const e = genEmail(r);
    expect(e).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
  it("genDate is YYYY-MM-DD", () => {
    expect(genDate(r)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("genDateTime is ISO 8601 UTC", () => {
    expect(genDateTime(r)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
  it("genTime is HH:MM:SSZ", () => {
    expect(genTime(r)).toMatch(/^\d{2}:\d{2}:\d{2}Z$/);
  });
  it("genUri starts with https://", () => {
    expect(genUri(r).startsWith("https://")).toBe(true);
  });
  it("genIpv4 has 4 octets", () => {
    expect(genIpv4(r).split(".")).toHaveLength(4);
  });
  it("genIpv6 has 8 groups", () => {
    expect(genIpv6(r).split(":")).toHaveLength(8);
  });
  it("genPhone starts with +1", () => {
    expect(genPhone(r).startsWith("+1")).toBe(true);
  });
  it("genColor is a 6-digit hex", () => {
    expect(genColor(r)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("genPassword is 16 chars", () => {
    expect(genPassword(r)).toHaveLength(16);
  });
  it("genSemver is X.Y.Z", () => {
    expect(genSemver(r)).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("genSlug is lowercase with dashes", () => {
    expect(genSlug(r)).toMatch(/^[a-z0-9-]+$/);
  });
  it("genNameFull has first + last", () => {
    expect(genNameFull(r).split(" ")).toHaveLength(2);
  });
  it("genLorem returns non-empty sentence", () => {
    const s = genLorem(r, 6, 16);
    expect(s.length).toBeGreaterThan(5);
    expect(s.endsWith(".")).toBe(true);
  });
  it("genCommerceSku has expected shape", () => {
    expect(genCommerceSku(r)).toMatch(/^[A-Z]{3}-\d{4}$/);
  });
  it("generateByFormat dispatches known formats", () => {
    expect(generateByFormat(r, "email")).toMatch(/@/);
    expect(generateByFormat(r, "uuid")).toMatch(/-/);
    expect(generateByFormat(r, "color")).toMatch(/^#/);
  });
  it("generateByFaker dispatches named generators", () => {
    const n = generateByFaker(r, "name.full");
    expect(typeof n).toBe("string");
    expect((n as string).split(" ")).toHaveLength(2);
    const u = generateByFaker(r, "datatype.uuid");
    expect(u).toMatch(/^[0-9a-f-]+$/);
    const b = generateByFaker(r, "datatype.boolean");
    expect(typeof b).toBe("boolean");
  });
});

describe("mock-api generateMock schema faker", () => {
  const r = createRng("mock");
  it("generates a string honoring minLength/maxLength", () => {
    const s = generateMock(r, { type: "string", minLength: 5, maxLength: 5 });
    expect(s).toHaveLength(5);
  });
  it("generates an integer honoring minimum/maximum", () => {
    const n = generateMock(r, { type: "integer", minimum: 10, maximum: 10 });
    expect(n).toBe(10);
  });
  it("generates a number within [minimum, maximum]", () => {
    const n = generateMock(r, { type: "number", minimum: 0, maximum: 1 });
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
  });
  it("picks from enum", () => {
    const v = generateMock(r, { type: "string", enum: ["a", "b", "c"] });
    expect(["a", "b", "c"]).toContain(v);
  });
  it("returns const verbatim", () => {
    expect(generateMock(r, { type: "string", const: "fixed" })).toBe("fixed");
  });
  it("returns example verbatim when present", () => {
    expect(generateMock(r, { type: "string", example: "demo" })).toBe("demo");
  });
  it("generates an array of items honoring minItems/maxItems", () => {
    const arr = generateMock(r, { type: "array", minItems: 3, maxItems: 3, items: { type: "integer" } });
    expect(Array.isArray(arr)).toBe(true);
    expect((arr as Json[]).length).toBe(3);
  });
  it("generates an object with required + optional fields", () => {
    const o = generateMock(r, {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        optional: { type: "string" },
      },
    }) as Record<string, unknown>;
    expect(o.id).toBeDefined();
  });
  it("x-faker override wins", () => {
    const v = generateMock(r, { type: "string", "x-faker": "name.first" });
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });
  it("format=email generates an email-shaped string", () => {
    const v = generateMock(r, { type: "string", format: "email" });
    expect(v).toMatch(/@/);
  });
  it("circular refs return null (guard)", () => {
    // Same path twice → second is null
    const seen = new Set<string>(["#/x"]);
    const v = generateMock(r, { type: "string" }, seen, "#/x");
    expect(v).toBeNull();
  });
});

describe("mock-api inferSchemaFromExample", () => {
  it("infers string schema", () => {
    const s = inferSchemaFromExample("hello");
    expect(s.type).toBe("string");
  });
  it("infers email format from email string", () => {
    const s = inferSchemaFromExample("user@example.com");
    expect(s.format).toBe("email");
  });
  it("infers uuid format", () => {
    const s = inferSchemaFromExample("550e8400-e29b-41d4-a716-446655440000");
    expect(s.format).toBe("uuid");
  });
  it("infers date-time format", () => {
    const s = inferSchemaFromExample("2024-06-15T10:30:00Z");
    expect(s.format).toBe("date-time");
  });
  it("infers integer type", () => {
    expect(inferSchemaFromExample(42).type).toBe("integer");
  });
  it("infers number type for non-integer", () => {
    expect(inferSchemaFromExample(3.14).type).toBe("number");
  });
  it("infers array with items schema from non-empty array", () => {
    const s = inferSchemaFromExample([1, 2, 3]);
    expect(s.type).toBe("array");
    expect(s.items?.type).toBe("integer");
  });
  it("infers object with required properties", () => {
    const s = inferSchemaFromExample({ id: 1, name: "x" });
    expect(s.type).toBe("object");
    expect(s.required).toEqual(["id", "name"]);
    expect(s.properties?.id?.type).toBe("integer");
  });
});

describe("mock-api validateSchema", () => {
  it("accepts a valid schema", () => {
    const r = validateSchema({ type: "string", minLength: 1 });
    expect(r.ok).toBe(true);
  });
  it("rejects unknown type", () => {
    const r = validateSchema({ type: "bogus" as unknown as "string" });
    expect(r.ok).toBe(false);
  });
  it("rejects minimum > maximum", () => {
    const r = validateSchema({ type: "integer", minimum: 10, maximum: 5 });
    expect(r.ok).toBe(false);
  });
  it("rejects array without items", () => {
    const r = validateSchema({ type: "array" });
    expect(r.ok).toBe(false);
  });
});

describe("mock-api wrapEnvelope", () => {
  const baseOpts: MockOptions = { ...DEFAULT_OPTIONS, count: 3, seed: "env" };
  const items: Json[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it("none returns array as-is when count > 1", () => {
    const out = wrapEnvelope(items, "none", baseOpts);
    expect(out).toEqual(items);
  });
  it("none returns single item when count === 1", () => {
    const out = wrapEnvelope([items[0]!], "none", { ...baseOpts, count: 1 });
    expect(out).toEqual(items[0]);
  });
  it("pagination wraps in { data, page, limit, total, pages }", () => {
    const out = wrapEnvelope(items, "pagination", { ...baseOpts, endpoint: "paginated" }) as Record<string, unknown>;
    expect(out.data).toEqual(items);
    expect(out.page).toBeDefined();
    expect(out.limit).toBe(3);
    expect(out.total).toBeDefined();
    expect(out.pages).toBeDefined();
  });
  it("json-api wraps each item as { type, id, attributes }", () => {
    const out = wrapEnvelope(items, "json-api", baseOpts) as Record<string, unknown>;
    const data = out.data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]!.type).toBeDefined();
    expect(data[0]!.id).toBe(1);
    expect(data[0]!.attributes).toBeDefined();
  });
  it("graphql wraps in { data: { field: items }, errors }", () => {
    const out = wrapEnvelope(items, "graphql", baseOpts) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    expect(out.errors).toBeNull();
    expect(Array.isArray(data.users)).toBe(true);
  });
  it("odata wraps in { value, '@odata.context' }", () => {
    const out = wrapEnvelope(items, "odata", baseOpts) as Record<string, unknown>;
    expect(out.value).toEqual(items);
    expect(out["@odata.context"]).toBeDefined();
  });
});

describe("mock-api generateErrorBody", () => {
  it("returns 404 error body with shape", () => {
    const body = generateErrorBody(404, { ...DEFAULT_OPTIONS, seed: "err" }) as Record<string, unknown>;
    expect(body.status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(typeof body.message).toBe("string");
    expect(body.requestId).toMatch(/^[0-9a-f-]+$/);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("includes details for 422", () => {
    const body = generateErrorBody(422, { ...DEFAULT_OPTIONS, seed: "err" }) as Record<string, unknown>;
    expect(body.details).toBeDefined();
  });
  it("includes retryAfter for 429", () => {
    const body = generateErrorBody(429, { ...DEFAULT_OPTIONS, seed: "err" }) as Record<string, unknown>;
    const details = body.details as Record<string, unknown>;
    expect(details.retryAfter).toBe(60);
  });
});

describe("mock-api generateWebhook", () => {
  const templates = WEBHOOK_TEMPLATES.map((t) => t.value);
  for (const name of templates) {
    it(`generates a payload for ${name}`, () => {
      const p = generateWebhook(name, { ...DEFAULT_OPTIONS, seed: "wh" }) as Record<string, unknown>;
      expect(p).toBeDefined();
      expect(typeof p).toBe("object");
    });
  }
  it("stripe.invoice.paid has event type 'invoice.paid'", () => {
    const p = generateWebhook("stripe.invoice.paid", { ...DEFAULT_OPTIONS, seed: "wh" }) as Record<string, unknown>;
    expect(p.type).toBe("invoice.paid");
    expect(p.object).toBe("event");
  });
  it("github.push has ref starting with refs/heads", () => {
    const p = generateWebhook("github.push", { ...DEFAULT_OPTIONS, seed: "wh" }) as Record<string, unknown>;
    expect(String(p.ref).startsWith("refs/heads/")).toBe(true);
    expect(Array.isArray(p.commits)).toBe(true);
  });
  it("unknown webhook returns error object", () => {
    const p = generateWebhook("unknown.event", { ...DEFAULT_OPTIONS, seed: "wh" }) as Record<string, unknown>;
    expect(p.error).toContain("Unknown webhook");
  });
});

describe("mock-api headers + status line", () => {
  it("generateStatusLine produces HTTP/1.1 line", () => {
    expect(generateStatusLine(200)).toBe("HTTP/1.1 200 OK");
    expect(generateStatusLine(404)).toBe("HTTP/1.1 404 Not Found");
  });
  it("generateHeaders includes Content-Type and X-Request-Id for 200", () => {
    const h = generateHeaders(200, { ok: true }, { ...DEFAULT_OPTIONS, seed: "h" });
    expect(h["Content-Type"]).toContain("application/json");
    expect(h["X-Request-Id"]).toMatch(/^[0-9a-f-]+$/);
    expect(h["Content-Length"]).toMatch(/^\d+$/);
  });
  it("201 adds Location header", () => {
    const h = generateHeaders(201, { ok: true }, { ...DEFAULT_OPTIONS, seed: "h" });
    expect(h["Location"]).toBeDefined();
  });
  it("429 adds Retry-After + rate limit headers", () => {
    const h = generateHeaders(429, { ok: false }, { ...DEFAULT_OPTIONS, seed: "h" });
    expect(h["Retry-After"]).toBe("60");
    expect(h["X-RateLimit-Limit"]).toBe("100");
    expect(h["X-RateLimit-Remaining"]).toBe("0");
  });
  it("204 strips Content-Type", () => {
    const h = generateHeaders(204, null, { ...DEFAULT_OPTIONS, seed: "h" });
    expect(h["Content-Type"]).toBeUndefined();
  });
  it("byteLength handles ASCII and non-ASCII", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("héllo")).toBeGreaterThan(4); // é is 2 bytes in UTF-8
    expect(byteLength("世界")).toBe(6); // 3 bytes per CJK char
  });
});

describe("mock-api validateOptions + buildResponseBody + generateResponse", () => {
  it("rejects count < 1", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, count: 0 }).ok).toBe(false);
  });
  it("rejects count > MAX_COUNT", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, count: MAX_COUNT + 1 }).ok).toBe(false);
  });
  it("rejects bad URL", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, url: "ftp://nope" }).ok).toBe(false);
  });
  it("buildResponseBody for REST returns N items", () => {
    const r = buildResponseBody({ ...DEFAULT_OPTIONS, count: 4, seed: "x", endpoint: "rest" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.isArray(r.output)).toBe(true);
  });
  it("buildResponseBody for paginated wraps in pagination envelope", () => {
    const r = buildResponseBody({ ...DEFAULT_OPTIONS, count: 3, seed: "x", endpoint: "paginated" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const o = r.output as Record<string, unknown>;
      expect(o.data).toBeDefined();
      expect(o.total).toBeDefined();
    }
  });
  it("buildResponseBody for error returns error body", () => {
    const r = buildResponseBody({ ...DEFAULT_OPTIONS, endpoint: "error", status: 404, seed: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const o = r.output as Record<string, unknown>;
      expect(o.status).toBe(404);
      expect(o.error).toBe("not_found");
    }
  });
  it("buildResponseBody for webhook returns webhook payload", () => {
    const r = buildResponseBody({ ...DEFAULT_OPTIONS, endpoint: "webhook", webhook: "stripe.invoice.paid", seed: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const o = r.output as Record<string, unknown>;
      expect(o.type).toBe("invoice.paid");
    }
  });
  it("generateResponse returns full HTTP response", () => {
    const r = generateResponse({ ...DEFAULT_OPTIONS, count: 2, seed: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const resp: HttpResponse = r.output;
      expect(resp.statusLine).toBe("HTTP/1.1 200 OK");
      expect(resp.headers["Content-Type"]).toContain("application/json");
      expect(resp.bodyText).toContain("[");
      expect(() => JSON.parse(resp.bodyText)).not.toThrow();
    }
  });
  it("generateResponse is deterministic for same seed", () => {
    const a = generateResponse({ ...DEFAULT_OPTIONS, count: 2, seed: "fixed" });
    const b = generateResponse({ ...DEFAULT_OPTIONS, count: 2, seed: "fixed" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.output.bodyText).toBe(b.output.bodyText);
    }
  });
});

describe("mock-api exportHttp + MSW snippet", () => {
  let resp: HttpResponse;
  beforeAll(() => {
    const r = generateResponse({ ...DEFAULT_OPTIONS, count: 2, seed: "exp" });
    if (r.ok) resp = r.output;
  });

  it("exportHttp starts with status line and includes headers + body", () => {
    const http = exportHttp(resp!);
    expect(http.startsWith("HTTP/1.1 200 OK")).toBe(true);
    expect(http).toContain("Content-Type: application/json");
    expect(http).toContain("X-Request-Id:");
    // body comes after a blank line
    expect(http).toContain("\n\n[");
  });
  it("generateMswSnippet produces MSW v2 handler", () => {
    const opts: MockOptions = { ...DEFAULT_OPTIONS, count: 2, seed: "exp" };
    const snippet = generateMswSnippet(opts, resp!);
    expect(snippet).toContain('http.get("');
    expect(snippet).toContain("HttpResponse.json");
    expect(snippet).toContain("status: 200");
  });
});

describe("mock-api history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory stores entries and caps at HISTORY_MAX=20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now(),
        endpoint: "rest",
        envelope: "none",
        status: 200,
        count: 5,
        seed: `s${i}`,
        url: "https://api.example.com/v1/users",
        bytes: 1000 + i,
        preview: "preview",
      });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0]!.seed).toBe("s24");
  });
  it("clearHistory wipes storage", () => {
    saveHistory({
      ts: 1, endpoint: "rest", envelope: "none", status: 200, count: 1, seed: "x",
      url: "https://api.example.com", bytes: 1, preview: "p",
    });
    expect(loadHistory().length).toBe(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mock-api share URL", () => {
  it("buildShareUrl round-trips through parseShareUrl", () => {
    const opts: MockOptions = {
      ...DEFAULT_OPTIONS,
      endpoint: "paginated",
      envelope: "json-api",
      count: 25,
      status: 422,
      method: "POST",
      url: "https://api.test.io/v2/items",
      seed: "round-trip",
      webhook: "github.push",
      pretty: false,
      schema: SAMPLE_SCHEMAS[1]!.schema,
    };
    const url = buildShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed.endpoint).toBe("paginated");
    expect(parsed.envelope).toBe("json-api");
    expect(parsed.count).toBe(25);
    expect(parsed.status).toBe(422);
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://api.test.io/v2/items");
    expect(parsed.seed).toBe("round-trip");
    expect(parsed.webhook).toBe("github.push");
    expect(parsed.pretty).toBe(false);
    expect(parsed.schema).toEqual(SAMPLE_SCHEMAS[1]!.schema);
  });
  it("parseShareUrl ignores unknown values gracefully", () => {
    const parsed = parseShareUrl("#e=bogus&ev=zzz&c=abc&s=999");
    expect(parsed.endpoint).toBe("rest");
    expect(parsed.envelope).toBe("none");
    expect(parsed.count).toBe(DEFAULT_OPTIONS.count);
    expect(parsed.status).toBe(200);
  });
  it("parseShareUrl returns defaults on empty input", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_OPTIONS);
  });
});

describe("mock-api schema serialization", () => {
  it("serializeSchema + parseSchema round-trip", () => {
    const schema: JsonSchema = { type: "object", properties: { id: { type: "integer" } }, required: ["id"] };
    const text = serializeSchema(schema);
    const parsed = parseSchema(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.output).toEqual(schema);
    }
  });
  it("parseSchema rejects invalid JSON", () => {
    const r = parseSchema("{not json");
    expect(r.ok).toBe(false);
  });
  it("parseSchema rejects non-object root", () => {
    const r = parseSchema("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});
