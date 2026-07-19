import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  STATUS_PRESETS,
  SCENARIO_LABELS,
  ENDPOINT_PRESETS,
  createRng,
  hashStringToSeed,
  fakeFirstName,
  fakeLastName,
  fakeName,
  fakeUsername,
  fakeEmail,
  fakePhone,
  fakeUuid,
  fakeDate,
  fakeDatetime,
  fakeTimestamp,
  fakeUrl,
  fakeSlug,
  fakeIp,
  fakeIpv6,
  fakeColor,
  fakeUserAgent,
  fakeAddress,
  fakeCity,
  fakeState,
  fakeZip,
  fakeCountry,
  fakeCurrency,
  fakeCard,
  fakeSentence,
  fakeParagraph,
  fakeLorem,
  generateValue,
  inferTypeFromName,
  inferFieldFromValue,
  parseJsonSample,
  parseOpenApiSpec,
  parseDescription,
  buildCrudRoutes,
  generateMockResponse,
  renderJsonPretty,
  renderJsonCompact,
  renderCurl,
  renderFetchHandler,
  renderMockoonConfig,
  loadInspector,
  addInspectorEntry,
  clearInspector,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  computeStats,
  type SchemaField,
  type MockRoute,
  type HttpMethod,
  type Scenario,
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

describe("ai-api-mocking constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-api-mocking:history");
  });
  it("has status presets including common codes", () => {
    expect(STATUS_PRESETS[200]).toBe("OK");
    expect(STATUS_PRESETS[404]).toBe("Not Found");
    expect(STATUS_PRESETS[500]).toBe("Internal Server Error");
  });
  it("has 6 scenario labels", () => {
    expect(Object.keys(SCENARIO_LABELS)).toHaveLength(6);
  });
  it("has endpoint presets", () => {
    expect(ENDPOINT_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("ai-api-mocking RNG", () => {
  it("createRng is deterministic with same seed", () => {
    const r1 = createRng(12345);
    const r2 = createRng(12345);
    const a1 = [r1(), r1(), r1()];
    const a2 = [r2(), r2(), r2()];
    expect(a1).toEqual(a2);
  });
  it("createRng produces values in [0,1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("hashStringToSeed returns stable integer", () => {
    expect(hashStringToSeed("hello")).toBe(hashStringToSeed("hello"));
    expect(typeof hashStringToSeed("hello")).toBe("number");
  });
  it("different strings hash differently (usually)", () => {
    expect(hashStringToSeed("a")).not.toBe(hashStringToSeed("b"));
  });
});

describe("ai-api-mocking faker generators", () => {
  const rng = createRng(42);
  it("fakeFirstName returns a non-empty string", () => {
    expect(fakeFirstName(rng).length).toBeGreaterThan(0);
  });
  it("fakeLastName returns a non-empty string", () => {
    expect(fakeLastName(rng).length).toBeGreaterThan(0);
  });
  it("fakeName contains a space", () => {
    expect(fakeName(rng)).toMatch(/\S+\s+\S+/);
  });
  it("fakeUsername is lowercase + digits", () => {
    expect(fakeUsername(rng)).toMatch(/^[a-z]+\d+$/);
  });
  it("fakeEmail matches email regex", () => {
    expect(fakeEmail(rng)).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
  it("fakePhone us format starts with +1", () => {
    expect(fakePhone(rng, "us")).toMatch(/^\+1 \(\d{3}\) \d{3}-\d{4}$/);
  });
  it("fakePhone uk format starts with +44", () => {
    expect(fakePhone(rng, "uk")).toMatch(/^\+44/);
  });
  it("fakePhone intl format starts with +", () => {
    expect(fakePhone(rng, "intl")).toMatch(/^\+\d+/);
  });
  it("fakeUuid matches UUID v4 regex", () => {
    const u = fakeUuid(rng);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("fakeDate matches YYYY-MM-DD", () => {
    expect(fakeDate(rng)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("fakeDatetime ends with Z", () => {
    expect(fakeDatetime(rng)).toMatch(/Z$/);
  });
  it("fakeTimestamp is a positive integer", () => {
    const t = fakeTimestamp(rng);
    expect(Number.isInteger(t)).toBe(true);
    expect(t).toBeGreaterThan(0);
  });
  it("fakeUrl starts with https://", () => {
    expect(fakeUrl(rng)).toMatch(/^https:\/\//);
  });
  it("fakeSlug contains hyphens", () => {
    expect(fakeSlug(rng)).toMatch(/-/);
  });
  it("fakeIp matches IPv4 regex", () => {
    expect(fakeIp(rng)).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
  });
  it("fakeIpv6 contains colons", () => {
    expect(fakeIpv6(rng)).toMatch(/:/);
  });
  it("fakeColor matches hex color", () => {
    expect(fakeColor(rng)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("fakeUserAgent returns non-empty string", () => {
    expect(fakeUserAgent(rng).length).toBeGreaterThan(20);
  });
  it("fakeAddress starts with a number", () => {
    expect(fakeAddress(rng)).toMatch(/^\d+\s/);
  });
  it("fakeCity returns non-empty", () => {
    expect(fakeCity(rng).length).toBeGreaterThan(0);
  });
  it("fakeState is a 2-letter code", () => {
    expect(fakeState(rng)).toMatch(/^[A-Z]{2}$/);
  });
  it("fakeZip is 5 digits", () => {
    expect(fakeZip(rng)).toMatch(/^\d{5}$/);
  });
  it("fakeCountry returns non-empty", () => {
    expect(fakeCountry(rng).length).toBeGreaterThan(0);
  });
  it("fakeCurrency is a decimal with 2 places", () => {
    expect(fakeCurrency(rng)).toMatch(/^\d+\.\d{2}$/);
  });
  it("fakeCard passes Luhn check", () => {
    const card = fakeCard(rng).replace(/\s/g, "");
    expect(card).toMatch(/^\d{16}$/);
    let sum = 0;
    let alt = false;
    for (let i = card.length - 1; i >= 0; i--) {
      let n = parseInt(card[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    expect(sum % 10).toBe(0);
  });
  it("fakeSentence ends with period", () => {
    expect(fakeSentence(rng)).toMatch(/\.$/);
  });
  it("fakeParagraph contains multiple sentences", () => {
    expect(fakeParagraph(rng, 3).split(". ").length).toBeGreaterThanOrEqual(3);
  });
  it("fakeLorem returns multiple words", () => {
    expect(fakeLorem(rng, 10).split(" ").length).toBe(10);
  });
});

describe("ai-api-mocking generateValue", () => {
  const rng = createRng(7);
  it("generates an int within range", () => {
    const v = generateValue(rng, { name: "x", type: "int", min: 1, max: 10 }) as number;
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10);
  });
  it("generates a float", () => {
    const v = generateValue(rng, { name: "x", type: "float", min: 0, max: 1 }) as number;
    expect(typeof v).toBe("number");
  });
  it("generates a boolean", () => {
    const v = generateValue(rng, { name: "x", type: "bool" });
    expect(typeof v).toBe("boolean");
  });
  it("generates an enum value from the list", () => {
    const v = generateValue(rng, { name: "x", type: "enum", enumValues: ["a", "b", "c"] }) as string;
    expect(["a", "b", "c"]).toContain(v);
  });
  it("generates an array of given length", () => {
    const v = generateValue(rng, {
      name: "x", type: "array", arrayLength: 4,
      children: [{ name: "item", type: "int", min: 1, max: 100 }],
    }) as number[];
    expect(v).toHaveLength(4);
    expect(typeof v[0]).toBe("number");
  });
  it("generates an object with children", () => {
    const v = generateValue(rng, {
      name: "x", type: "object",
      children: [
        { name: "id", type: "id" },
        { name: "email", type: "email" },
      ],
    }) as Record<string, unknown>;
    expect(v).toHaveProperty("id");
    expect(v).toHaveProperty("email");
  });
  it("object with optional field may omit it", () => {
    // Run multiple times to maximize the chance the optional is omitted
    let omittedAtLeastOnce = false;
    for (let i = 0; i < 50; i++) {
      const v = generateValue(createRng(i), {
        name: "x", type: "object",
        children: [{ name: "opt", type: "string", optional: true }],
      }) as Record<string, unknown>;
      if (!("opt" in v)) omittedAtLeastOnce = true;
    }
    expect(omittedAtLeastOnce).toBe(true);
  });
});

describe("ai-api-mocking inferTypeFromName", () => {
  it("infers email from 'email'", () => {
    expect(inferTypeFromName("email")).toBe("email");
  });
  it("infers uuid from 'uuid'", () => {
    expect(inferTypeFromName("uuid")).toBe("uuid");
  });
  it("infers name from 'name'", () => {
    expect(inferTypeFromName("name")).toBe("name");
  });
  it("falls back to string", () => {
    expect(inferTypeFromName("xyz_random")).toBe("string");
  });
  it("infers id from 'id'", () => {
    expect(inferTypeFromName("id")).toBe("id");
  });
  it("infers id from 'user_id'", () => {
    expect(inferTypeFromName("user_id")).toBe("id");
  });
});

describe("ai-api-mocking inferFieldFromValue", () => {
  it("infers int from a number", () => {
    expect(inferFieldFromValue("age", 42).type).toBe("int");
  });
  it("infers float from a decimal", () => {
    expect(inferFieldFromValue("price", 9.99).type).toBe("float");
  });
  it("infers bool from a boolean", () => {
    expect(inferFieldFromValue("active", true).type).toBe("bool");
  });
  it("infers email from a string email", () => {
    expect(inferFieldFromValue("contact", "a@b.com").type).toBe("email");
  });
  it("infers uuid from a uuid string", () => {
    expect(inferFieldFromValue("guid", "12345678-1234-4234-8234-123456789012").type).toBe("uuid");
  });
  it("infers date from YYYY-MM-DD", () => {
    expect(inferFieldFromValue("d", "2024-01-15").type).toBe("date");
  });
  it("infers datetime from ISO", () => {
    expect(inferFieldFromValue("d", "2024-01-15T10:30:00Z").type).toBe("datetime");
  });
  it("infers url from http(s)", () => {
    expect(inferFieldFromValue("link", "https://example.com").type).toBe("url");
  });
  it("infers color from #rrggbb", () => {
    expect(inferFieldFromValue("c", "#aabbcc").type).toBe("color");
  });
  it("infers array with child", () => {
    const f = inferFieldFromValue("tags", ["a", "b", "c"]);
    expect(f.type).toBe("array");
    expect(f.arrayLength).toBe(3);
    expect(f.children?.[0].type).toBe("string");
  });
  it("infers object with children", () => {
    const f = inferFieldFromValue("addr", { city: "NYC", zip: "10001" });
    expect(f.type).toBe("object");
    expect(f.children).toHaveLength(2);
  });
});

describe("ai-api-mocking parseJsonSample", () => {
  it("parses a flat object sample", () => {
    const r = parseJsonSample('{"id":1,"email":"a@b.com","name":"John"}', "User");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.name).toBe("User");
      expect(r.schema.isArray).toBe(false);
      expect(r.schema.fields).toHaveLength(3);
      expect(r.schema.fields.map((f) => f.type)).toContain("email");
    }
  });
  it("parses an array sample", () => {
    const r = parseJsonSample('[{"id":1,"name":"a"},{"id":2,"name":"b"}]', "Item");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.schema.isArray).toBe(true);
  });
  it("fails on invalid JSON", () => {
    const r = parseJsonSample("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/);
  });
  it("fails on non-object top-level", () => {
    const r = parseJsonSample('"just a string"');
    expect(r.ok).toBe(false);
  });
});

describe("ai-api-mocking parseOpenApiSpec", () => {
  it("parses a minimal OpenAPI 3 spec", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      paths: {
        "/users": {
          get: {
            summary: "List users",
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: "object",
            required: ["id", "email"],
            properties: {
              id: { type: "integer" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
            },
          },
        },
      },
    });
    const r = parseOpenApiSpec(spec);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schemas).toHaveLength(1);
      expect(r.schemas[0].name).toBe("User");
      expect(r.schemas[0].fields.map((f) => f.type)).toEqual(["int", "email", "name"]);
      expect(r.routes).toHaveLength(1);
      expect(r.routes[0].method).toBe("GET");
      expect(r.routes[0].path).toBe("/users");
      expect(r.routes[0].isArray).toBe(true);
    }
  });
  it("fails on invalid JSON", () => {
    const r = parseOpenApiSpec("not json");
    expect(r.ok).toBe(false);
  });
  it("handles spec without components", () => {
    const r = parseOpenApiSpec(JSON.stringify({ openapi: "3.0.0", paths: {} }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schemas).toEqual([]);
      expect(r.routes).toEqual([]);
    }
  });
});

describe("ai-api-mocking parseDescription", () => {
  it("parses a description with multiple fields", () => {
    const fields = parseDescription("User list with id, email, name, phone, and createdAt");
    expect(fields.length).toBeGreaterThanOrEqual(4);
    const names = fields.map((f) => f.name);
    expect(names).toContain("email");
    expect(names).toContain("phone");
    expect(names).toContain("name");
  });
  it("returns empty for empty description", () => {
    expect(parseDescription("")).toEqual([]);
  });
  it("infers currency from price/amount/total tokens", () => {
    const f = parseDescription("price and total");
    expect(f.some((x) => x.type === "currency")).toBe(true);
  });
});

describe("ai-api-mocking buildCrudRoutes", () => {
  it("builds 5 CRUD routes for a resource", () => {
    const routes = buildCrudRoutes("User", [
      { name: "email", type: "email" },
      { name: "name", type: "name" },
    ]);
    expect(routes).toHaveLength(5);
    expect(routes.map((r) => r.method)).toEqual(["GET", "GET", "POST", "PUT", "DELETE"]);
    expect(routes[0].path).toBe("/users");
    expect(routes[1].path).toBe("/users/{id}");
    expect(routes[0].isArray).toBe(true);
    expect(routes[1].isArray).toBe(false);
    expect(routes[4].scenario).toBe("empty");
  });
  it("DELETE route has empty body", () => {
    const routes = buildCrudRoutes("Post", []);
    expect(routes[4].fields).toEqual([]);
    expect(routes[4].status).toBe(204);
  });
  it("pluralizes names ending in y", () => {
    const routes = buildCrudRoutes("Category", []);
    expect(routes[0].path).toBe("/categories");
  });
});

describe("ai-api-mocking generateMockResponse scenarios", () => {
  const route: MockRoute = {
    method: "GET", path: "/users", status: 200, latencyMs: 10,
    scenario: "default", isArray: true,
    fields: [
      { name: "id", type: "id" },
      { name: "email", type: "email" },
    ],
  };
  it("default scenario returns 5-item array", () => {
    const r = generateMockResponse({ ...route, scenario: "default" }, 1);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect((r.body as unknown[]).length).toBe(5);
  });
  it("single scenario returns an object", () => {
    const r = generateMockResponse({ ...route, scenario: "single", isArray: false }, 1);
    expect(typeof r.body).toBe("object");
    expect(Array.isArray(r.body)).toBe(false);
  });
  it("empty scenario returns empty array", () => {
    const r = generateMockResponse({ ...route, scenario: "empty" }, 1);
    expect(r.body).toEqual([]);
  });
  it("error scenario returns error object with 500", () => {
    const r = generateMockResponse({ ...route, scenario: "error" }, 1);
    expect(r.status).toBe(500);
    expect((r.body as Record<string, unknown>).error).toBe("MockError");
  });
  it("large scenario returns 1000 items", () => {
    const r = generateMockResponse({ ...route, scenario: "large" }, 1);
    expect((r.body as unknown[]).length).toBe(1000);
  });
  it("paginated scenario returns page metadata", () => {
    const r = generateMockResponse({ ...route, scenario: "paginated" }, 1);
    const body = r.body as Record<string, unknown>;
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("data");
    expect((body.data as unknown[]).length).toBe(20);
  });
  it("error scenario with status 400 returns 400", () => {
    const r = generateMockResponse({ ...route, scenario: "error", status: 400 }, 1);
    expect(r.status).toBe(400);
  });
  it("response includes X-Mock-Scenario header", () => {
    const r = generateMockResponse(route, 1);
    expect(r.headers["X-Mock-Scenario"]).toBe("default");
  });
  it("response is deterministic with same seed", () => {
    const r1 = generateMockResponse(route, 999);
    const r2 = generateMockResponse(route, 999);
    expect(r1.body).toEqual(r2.body);
  });
  it("different seeds produce different bodies", () => {
    const r1 = generateMockResponse(route, 1);
    const r2 = generateMockResponse(route, 2);
    expect(r1.body).not.toEqual(r2.body);
  });
});

describe("ai-api-mocking renderers", () => {
  it("renderJsonPretty returns indented JSON", () => {
    const s = renderJsonPretty({ a: 1, b: [2, 3] });
    expect(s).toContain('  "a"');
    expect(s).toContain("\n");
  });
  it("renderJsonCompact returns single-line JSON", () => {
    const s = renderJsonCompact({ a: 1, b: [2, 3] });
    expect(s).not.toContain("\n");
  });
  it("renderCurl contains method and URL", () => {
    const curl = renderCurl({
      method: "GET", path: "/users", status: 200, latencyMs: 0,
      scenario: "default", isArray: true, fields: [],
    }, "https://api.example.com");
    expect(curl).toContain("curl -X GET");
    expect(curl).toContain("https://api.example.com/users");
  });
  it("renderFetchHandler contains MOCK_ROUTES", () => {
    const handler = renderFetchHandler({
      name: "Test", basePath: "/", createdAt: 0, routes: [],
    });
    expect(handler).toContain("MOCK_ROUTES");
    expect(handler).toContain("export async function mockFetch");
  });
  it("renderMockoonConfig returns valid JSON array", () => {
    const cfg = renderMockoonConfig({
      name: "Test", basePath: "/", createdAt: 0,
      routes: [{
        method: "GET", path: "/users", status: 200, latencyMs: 0,
        scenario: "default", isArray: true, fields: [{ name: "id", type: "id" }],
      }],
    });
    const parsed = JSON.parse(cfg);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("Test");
    expect(parsed[0].routes).toHaveLength(1);
  });
});

describe("ai-api-mocking inspector", () => {
  it("loads empty initially", () => {
    expect(loadInspector()).toEqual([]);
  });
  it("adds and loads", () => {
    addInspectorEntry({
      ts: Date.now(), method: "GET", path: "/users",
      status: 200, latencyMs: 5,
    });
    expect(loadInspector()).toHaveLength(1);
  });
  it("caps at 50", () => {
    for (let i = 0; i < 60; i++) {
      addInspectorEntry({
        ts: i, method: "GET", path: `/u${i}`, status: 200, latencyMs: 1,
      });
    }
    expect(loadInspector()).toHaveLength(50);
  });
  it("clears", () => {
    addInspectorEntry({
      ts: 1, method: "GET", path: "/x", status: 200, latencyMs: 1,
    });
    clearInspector();
    expect(loadInspector()).toEqual([]);
  });
});

describe("ai-api-mocking history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, source: "json-sample", name: "User",
      routeCount: 5, fieldCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, source: "json-sample", name: "X",
        routeCount: 1, fieldCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, source: "json-sample", name: "X",
      routeCount: 1, fieldCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-api-mocking shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      source: "json-sample", input: '{"id":1}',
      name: "User", scenario: "default", status: 200, latencyMs: 50,
    });
    expect(url).toContain("src=json-sample");
    expect(url).toContain("scen=default");
    expect(url).toContain("status=200");
    expect(url).toContain("lat=50");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("src=json-sample&in=%7B%22id%22%3A1%7D&name=User&scen=large&status=200&lat=100");
    expect(p.source).toBe("json-sample");
    expect(p.input).toBe('{"id":1}');
    expect(p.name).toBe("User");
    expect(p.scenario).toBe("large");
    expect(p.status).toBe(200);
    expect(p.latencyMs).toBe(100);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown scenario", () => {
    const p = parseShareUrl("scen=unknown-scen");
    expect(p.scenario).toBeUndefined();
  });
  it("filters invalid status", () => {
    const p = parseShareUrl("status=not-a-number");
    expect(p.status).toBeUndefined();
  });
});

describe("ai-api-mocking LLM helpers", () => {
  it("buildLlmPrompt includes source and instructions", () => {
    const p = buildLlmPrompt("json-sample", '{"id":1}', "more realistic emails");
    expect(p).toContain("json-sample");
    expect(p).toContain('{"id":1}');
    expect(p).toContain("more realistic emails");
    expect(p).toContain("JSON array of 5");
  });
  it("renderLlmResult parses valid JSON wrapped in markdown", () => {
    const r = renderLlmResult("```json\n[{\"id\":1}]\n```");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual([{ id: 1 }]);
  });
  it("renderLlmResult parses plain JSON", () => {
    const r = renderLlmResult('[{"id":1}]');
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult fails on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
  });
});

describe("ai-api-mocking computeStats", () => {
  it("computes stats for a set of routes", () => {
    const routes: MockRoute[] = [
      { method: "GET", path: "/a", status: 200, latencyMs: 0, scenario: "default", isArray: true, fields: [{ name: "id", type: "id" }, { name: "email", type: "email" }] },
      { method: "POST", path: "/a", status: 201, latencyMs: 0, scenario: "single", isArray: false, fields: [{ name: "id", type: "id" }] },
      { method: "DELETE", path: "/a/{id}", status: 204, latencyMs: 0, scenario: "empty", isArray: false, fields: [] },
    ];
    const s = computeStats(routes);
    expect(s.routeCount).toBe(3);
    expect(s.byMethod.GET).toBe(1);
    expect(s.byMethod.POST).toBe(1);
    expect(s.byMethod.DELETE).toBe(1);
    expect(s.byScenario.default).toBe(1);
    expect(s.byScenario.single).toBe(1);
    expect(s.byScenario.empty).toBe(1);
    expect(s.totalFields).toBe(3);
    expect(s.fieldCount).toBe(1); // 3 fields / 3 routes
  });
  it("returns zero stats for empty routes", () => {
    const s = computeStats([]);
    expect(s.routeCount).toBe(0);
    expect(s.totalFields).toBe(0);
  });
});

// Suppress unused-import lint
export type _Unused = SchemaField | HttpMethod | Scenario;
