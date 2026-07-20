import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  SAMPLE_JSON_1,
  SAMPLE_JSON_2,
  safeParseJson,
  toPascalCase,
  toCamelCase,
  toValidIdentifier,
  quoteKey,
  needsQuoting,
  buildInterfaceName,
  inferPrimitive,
  isObject,
  renderTypeNode,
  renderInterface,
  splitNullable,
  buildJsDoc,
  generateInterfaces,
  generateTypeGuard,
  generateValidators,
  renderTs,
  renderTsMarkdown,
  renderTsJson,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmSuggestion,
  type GeneratorConfig,
  type TypeNode,
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

const cfg = (overrides: Partial<GeneratorConfig> = {}): GeneratorConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe("ts-gen constants", () => {
  it("DEFAULT_CONFIG has sensible defaults", () => {
    expect(DEFAULT_CONFIG.rootName).toBe("Root");
    expect(DEFAULT_CONFIG.declKind).toBe("interface");
    expect(DEFAULT_CONFIG.optionalStyle).toBe("question");
    expect(DEFAULT_CONFIG.arrayStyle).toBe("bracket");
    expect(DEFAULT_CONFIG.detectEnums).toBe(true);
    expect(DEFAULT_CONFIG.generateValidators).toBe(false);
    expect(DEFAULT_CONFIG.generateJsDoc).toBe(false);
  });
  it("SAMPLE_JSON_1 parses to a valid object", () => {
    const p = safeParseJson(SAMPLE_JSON_1);
    expect(p.ok).toBe(true);
  });
  it("SAMPLE_JSON_2 parses to a valid array", () => {
    const p = safeParseJson(SAMPLE_JSON_2);
    expect(p.ok).toBe(true);
  });
});

describe("ts-gen safeParseJson", () => {
  it("parses valid JSON", () => {
    const p = safeParseJson('{"a":1}');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.value).toEqual({ a: 1 });
  });
  it("returns error on invalid JSON", () => {
    const p = safeParseJson("{not json}");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error.length).toBeGreaterThan(0);
  });
  it("returns error on empty input", () => {
    const p = safeParseJson("   ");
    expect(p.ok).toBe(false);
  });
});

describe("ts-gen name helpers", () => {
  it("toPascalCase converts snake/kebab/space", () => {
    expect(toPascalCase("hello world")).toBe("HelloWorld");
    expect(toPascalCase("hello-world")).toBe("HelloWorld");
    expect(toPascalCase("hello_world")).toBe("Hello_world"); // underscore preserved as identifier
    expect(toPascalCase("")).toBe("Root");
  });
  it("toCamelCase lowercases first letter", () => {
    expect(toCamelCase("hello world")).toBe("helloWorld");
  });
  it("toValidIdentifier handles numeric prefix + keywords", () => {
    expect(toValidIdentifier("123abc")).toMatch(/^Key123abc$/);
    expect(toValidIdentifier("class")).toBe("class_");
    expect(toValidIdentifier("foo bar")).toBe("foo_bar");
  });
  it("needsQuoting + quoteKey", () => {
    expect(needsQuoting("validName")).toBe(false);
    expect(needsQuoting("with space")).toBe(true);
    expect(needsQuoting("123start")).toBe(true);
    expect(quoteKey("validName")).toBe("validName");
    expect(quoteKey("with space")).toBe('"with space"');
    expect(quoteKey('quote"inside')).toBe('"quote\\"inside"');
  });
  it("buildInterfaceName uses singularized last key", () => {
    expect(buildInterfaceName("Root", [])).toBe("Root");
    expect(buildInterfaceName("User", ["items"])).toBe("UserItem");
    expect(buildInterfaceName("User", ["categories"])).toBe("UserCategory");
  });
});

describe("ts-gen inferPrimitive + isObject", () => {
  it("detects JS primitives", () => {
    expect(inferPrimitive("s")).toBe("string");
    expect(inferPrimitive(42)).toBe("number");
    expect(inferPrimitive(true)).toBe("boolean");
    expect(inferPrimitive(null)).toBe("null");
    expect(inferPrimitive(undefined)).toBe("undefined");
    expect(inferPrimitive(BigInt(10))).toBe("bigint");
    expect(inferPrimitive({})).toBeNull();
  });
  it("isObject narrows to records", () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject("x")).toBe(false);
  });
});

describe("ts-gen renderTypeNode", () => {
  it("renders primitives", () => {
    expect(renderTypeNode({ kind: "primitive", ts: "string" }, cfg())).toBe("string");
    expect(renderTypeNode({ kind: "primitive", ts: "number" }, cfg())).toBe("number");
    expect(renderTypeNode({ kind: "primitive", ts: "null" }, cfg())).toBe("null");
    expect(renderTypeNode({ kind: "primitive", ts: "unknown" }, cfg())).toBe("unknown");
  });
  it("renders string-literal unions", () => {
    expect(renderTypeNode({ kind: "string-literal", values: ["a", "b"] }, cfg())).toBe('"a" | "b"');
  });
  it("renders arrays with bracket and generic styles", () => {
    const arr: TypeNode = { kind: "array", element: { kind: "primitive", ts: "number" } };
    expect(renderTypeNode(arr, cfg({ arrayStyle: "bracket" }))).toBe("number[]");
    expect(renderTypeNode(arr, cfg({ arrayStyle: "generic" }))).toBe("Array<number>");
  });
  it("wraps union elements in parens for bracket arrays", () => {
    const arr: TypeNode = {
      kind: "array",
      element: { kind: "union", members: [
        { kind: "primitive", ts: "string" },
        { kind: "primitive", ts: "number" },
      ] },
    };
    expect(renderTypeNode(arr, cfg({ arrayStyle: "bracket" }))).toBe("(string | number)[]");
  });
  it("renders object refs by name", () => {
    expect(renderTypeNode({ kind: "object", ref: "User" }, cfg())).toBe("User");
  });
});

describe("ts-gen splitNullable", () => {
  it("separates null from a union", () => {
    const out = splitNullable({
      kind: "union",
      members: [
        { kind: "primitive", ts: "string" },
        { kind: "primitive", ts: "null" },
      ],
    });
    expect(out.nullable).toBe(true);
    expect(out.inner).toEqual({ kind: "primitive", ts: "string" });
  });
  it("returns input when not nullable", () => {
    const node: TypeNode = { kind: "primitive", ts: "number" };
    expect(splitNullable(node)).toEqual({ nullable: false, inner: node });
  });
});

describe("ts-gen renderInterface", () => {
  it("renders interface kind with export", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "id", name: "id", type: { kind: "primitive" as const, ts: "number" as const }, optional: false, nullable: false },
        { rawName: "name", name: "name", type: { kind: "primitive" as const, ts: "string" as const }, optional: false, nullable: false },
      ],
    };
    const src = renderInterface(decl, cfg());
    expect(src).toContain("export interface User {");
    expect(src).toContain("  id: number;");
    expect(src).toContain("  name: string;");
  });
  it("renders type kind", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "id", name: "id", type: { kind: "primitive" as const, ts: "number" as const }, optional: false, nullable: false },
      ],
    };
    const src = renderInterface(decl, cfg({ declKind: "type" }));
    expect(src).toContain("export type User = {");
  });
  it("applies readonly prefix when configured", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "id", name: "id", type: { kind: "primitive" as const, ts: "number" as const }, optional: false, nullable: false },
      ],
    };
    const src = renderInterface(decl, cfg({ readonly: true }));
    expect(src).toContain("readonly id: number;");
  });
  it("applies question mark for optional in question style", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "id", name: "id", type: { kind: "primitive" as const, ts: "number" as const }, optional: false, nullable: false },
        { rawName: "age", name: "age", type: { kind: "primitive" as const, ts: "number" as const }, optional: true, nullable: false },
      ],
    };
    const src = renderInterface(decl, cfg({ optionalStyle: "question" }));
    expect(src).toContain("age?: number;");
  });
  it("applies | undefined for optional in undefined style", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "age", name: "age", type: { kind: "primitive" as const, ts: "number" as const }, optional: true, nullable: false },
      ],
    };
    const src = renderInterface(decl, cfg({ optionalStyle: "undefined" }));
    expect(src).toContain("age: number | undefined;");
  });
});

describe("ts-gen generateInterfaces — simple object", () => {
  it("produces one interface with primitive fields", () => {
    const r = generateInterfaces([{ id: 1, name: "Ada", active: true }], cfg({ rootName: "User" }));
    expect(r.interfaces.length).toBe(1);
    expect(r.interfaces[0].name).toBe("User");
    const src = renderTs(r);
    expect(src).toContain("interface User {");
    expect(src).toContain("id: number;");
    expect(src).toContain("name: string;");
    expect(src).toContain("active: boolean;");
    expect(r.stats.propertyCount).toBe(3);
  });
  it("null field becomes nullable", () => {
    const r = generateInterfaces([{ id: 1, lastLogin: null }], cfg({ rootName: "User" }));
    const src = renderTs(r);
    expect(src).toMatch(/lastLogin\?: unknown;/);
  });
});

describe("ts-gen generateInterfaces — nested objects", () => {
  it("emits a second interface for nested object", () => {
    const r = generateInterfaces([{
      id: 1,
      address: { street: "1 Main", city: "London" },
    }], cfg({ rootName: "User" }));
    expect(r.interfaces.length).toBe(2);
    const names = r.interfaces.map((i) => i.name);
    expect(names).toContain("User");
    expect(names).toContain("UserAddress");
    const src = renderTs(r);
    expect(src).toContain("address: UserAddress;");
  });
});

describe("ts-gen generateInterfaces — arrays", () => {
  it("array of primitives → primitive[] element", () => {
    const r = generateInterfaces([{ tags: ["a", "b", "c"] }], cfg({ rootName: "Post" }));
    const src = renderTs(r);
    expect(src).toContain("tags:");
    // Strings in an array of primitives are auto-promoted to a literal union
    // when detectEnums is on (default). The element type is either string or a literal union.
    expect(src).toMatch(/tags: .*\[\];/);
  });
  it("array of objects → ref[] element + child interface", () => {
    const r = generateInterfaces([{
      items: [{ id: 1, name: "x" }, { id: 2, name: "y" }],
    }], cfg({ rootName: "Order" }));
    expect(r.interfaces.length).toBeGreaterThanOrEqual(2);
    const names = r.interfaces.map((i) => i.name);
    expect(names).toContain("Order");
    expect(names).toContain("OrderItem");
    const src = renderTs(r);
    expect(src).toContain("items: OrderItem[];");
  });
  it("empty array → unknown[] + warning", () => {
    const r = generateInterfaces([{ items: [] }], cfg({ rootName: "Order" }));
    const src = renderTs(r);
    expect(src).toContain("items: unknown[];");
    expect(r.warnings.length).toBe(0); // empty inner array doesn't add warning at top level
  });
});

describe("ts-gen generateInterfaces — array root", () => {
  it("array root → produces interface from merged elements", () => {
    const r = generateInterfaces([
      [{ id: 1, label: "Open" }],
      [{ id: 2, label: "Closed" }],
    ], cfg({ rootName: "Status" }));
    expect(r.interfaces.length).toBeGreaterThanOrEqual(1);
    const src = renderTs(r);
    expect(src).toContain("interface StatusItem {");
  });
  it("array root of strings → enum-like string-literal union", () => {
    const r = generateInterfaces([
      ["open", "closed", "pending"],
    ], cfg({ rootName: "Status" }));
    const src = renderTs(r);
    expect(src).toContain(`"open" | "closed" | "pending"`);
    expect(src).toContain("export type Status = ");
  });
});

describe("ts-gen generateInterfaces — multi-sample merging", () => {
  it("marks missing keys as optional", () => {
    const r = generateInterfaces([
      { id: 1, name: "A", nickname: "x" },
      { id: 2, name: "B" },
    ], cfg({ rootName: "User" }));
    const user = r.interfaces.find((i) => i.name === "User");
    expect(user).toBeDefined();
    const nick = user!.properties.find((p) => p.rawName === "nickname");
    expect(nick).toBeDefined();
    expect(nick!.optional).toBe(true);
    const id = user!.properties.find((p) => p.rawName === "id");
    expect(id!.optional).toBe(false);
  });
  it("merges different types into a union", () => {
    const r = generateInterfaces([
      { value: 1 },
      { value: "two" },
    ], cfg({ rootName: "Item" }));
    const item = r.interfaces.find((i) => i.name === "Item");
    const value = item!.properties.find((p) => p.rawName === "value");
    expect(value!.type.kind).toBe("union");
    const src = renderTs(r);
    expect(src).toContain("value: number | string;");
  });
});

describe("ts-gen generateInterfaces — mixed top-level", () => {
  it("warns when samples mix object + array", () => {
    const r = generateInterfaces([
      { id: 1 },
      [1, 2, 3],
    ], cfg({ rootName: "Root" }));
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => /Mixed top-level/.test(w))).toBe(true);
  });
});

describe("ts-gen generateInterfaces — no samples", () => {
  it("returns empty result with warning", () => {
    const r = generateInterfaces([], cfg());
    expect(r.interfaces).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("ts-gen type guards", () => {
  it("generateTypeGuard emits is<Name> function", () => {
    const decl = {
      name: "User",
      properties: [
        { rawName: "id", name: "id", type: { kind: "primitive" as const, ts: "number" as const }, optional: false, nullable: false },
        { rawName: "name", name: "name", type: { kind: "primitive" as const, ts: "string" as const }, optional: false, nullable: false },
      ],
    };
    const g = generateTypeGuard(decl, cfg());
    expect(g).toContain("export function isUser(v: unknown): v is User {");
    expect(g).toContain('typeof o["id"] === "number"');
    expect(g).toContain('typeof o["name"] === "string"');
  });
  it("generateValidators emits guards when enabled", () => {
    const r = generateInterfaces([{ id: 1, name: "x" }], cfg({ rootName: "User", generateValidators: true }));
    expect(r.validators).toContain("function isUser");
    expect(r.stats.validatorCount).toBeGreaterThanOrEqual(1);
  });
  it("generateValidators empty when disabled", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ generateValidators: false }));
    expect(r.validators).toBe("");
    expect(r.stats.validatorCount).toBe(0);
  });
});

describe("ts-gen renderTs", () => {
  it("includes header comment + interfaces", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User" }));
    const src = renderTs(r);
    expect(src).toContain("Generated by UnQTools");
    expect(src).toContain("interface User {");
  });
  it("includes validators when enabled", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User", generateValidators: true }));
    const src = renderTs(r);
    expect(src).toContain("Runtime type guards");
    expect(src).toContain("function isUser");
  });
});

describe("ts-gen renderTsMarkdown + renderTsJson", () => {
  it("renderTsMarkdown wraps source in fenced code block", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User" }));
    const md = renderTsMarkdown(r);
    expect(md).toContain("# Generated TypeScript");
    expect(md).toContain("```ts");
  });
  it("renderTsJson is valid JSON with stats", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User" }));
    const j = renderTsJson(r);
    const parsed = JSON.parse(j);
    expect(parsed.interfaces).toBeInstanceOf(Array);
    expect(parsed.stats.interfaceCount).toBe(1);
  });
});

describe("ts-gen computeStats", () => {
  it("counts interfaces, properties, optionals, unions, arrays", () => {
    const r = generateInterfaces([
      { id: 1, name: "A", tags: ["x", "y"], extra: null },
    ], cfg({ rootName: "User" }));
    expect(r.stats.interfaceCount).toBe(1);
    expect(r.stats.propertyCount).toBe(4);
    expect(r.stats.optionalCount).toBeGreaterThanOrEqual(1);
    expect(r.stats.arrayCount).toBe(1);
  });
});

describe("ts-gen config toggles", () => {
  it("declKind=type changes emitted keyword", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User", declKind: "type" }));
    expect(renderTs(r)).toContain("export type User = {");
  });
  it("exportDecls=false omits export keyword", () => {
    const r = generateInterfaces([{ id: 1 }], cfg({ rootName: "User", exportDecls: false }));
    expect(renderTs(r)).not.toContain("export interface");
    expect(renderTs(r)).toContain("interface User {");
  });
  it("generateJsDoc=true emits JSDoc comments", () => {
    const r = generateInterfaces([{ id: 1, name: "x" }], cfg({ rootName: "User", generateJsDoc: true }));
    expect(renderTs(r)).toContain("/**");
  });
  it("arrayStyle=generic emits Array<T>", () => {
    const r = generateInterfaces([{ tags: ["a", "b"] }], cfg({ rootName: "Post", arrayStyle: "generic" }));
    expect(renderTs(r)).toContain("Array<");
  });
  it("detectEnums=false disables string-literal inference for array roots", () => {
    const r = generateInterfaces([["a", "b"]], cfg({ rootName: "Status", detectEnums: false }));
    // Without enum detection, an array of strings becomes string[]
    const src = renderTs(r);
    expect(src).toContain("Status");
    expect(src).not.toContain('"a" | "b"');
  });
});

describe("ts-gen buildJsDoc", () => {
  it("includes rawName + flags", () => {
    const doc = buildJsDoc({
      rawName: "user_id", name: "user_id", optional: true, nullable: false,
      type: { kind: "primitive", ts: "number" },
    });
    expect(doc).toContain("@user_id");
    expect(doc).toContain("(optional)");
  });
});

describe("ts-gen history", () => {
  it("loadHistory empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory persists and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now() + i,
        rootName: `Root${i}`,
        interfaceCount: 1,
        sampleCount: 1,
        preview: `{ "i": ${i} }`,
      });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].rootName).toBe("Root24");
  });
  it("clearHistory empties storage", () => {
    saveHistory({ ts: 1, rootName: "X", interfaceCount: 1, sampleCount: 1, preview: "{}" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ts-gen share url", () => {
  it("buildShareUrl + parseShareUrl round-trip", () => {
    const state = {
      json: '{"id":1}',
      rootName: "User",
      config: {
        declKind: "type" as const,
        readonly: true,
        optionalStyle: "undefined" as const,
        arrayStyle: "generic" as const,
        generateValidators: true,
        generateJsDoc: true,
      },
    };
    const url = buildShareUrl(state);
    expect(url).toContain("json=");
    expect(url).toContain("root=User");
    expect(url).toContain("kind=type");
    expect(url).toContain("ro=1");
    expect(url).toContain("opt=undefined");
    expect(url).toContain("arr=generic");
    expect(url).toContain("guards=1");
    expect(url).toContain("jsdoc=1");
    const parsed = parseShareUrl(url);
    expect(parsed.json).toBe('{"id":1}');
    expect(parsed.rootName).toBe("User");
    expect(parsed.config.declKind).toBe("type");
    expect(parsed.config.readonly).toBe(true);
    expect(parsed.config.optionalStyle).toBe("undefined");
    expect(parsed.config.arrayStyle).toBe("generic");
    expect(parsed.config.generateValidators).toBe(true);
    expect(parsed.config.generateJsDoc).toBe(true);
  });
  it("parseShareUrl empty returns defaults", () => {
    const p = parseShareUrl("");
    expect(p.json).toBe("");
    expect(p.rootName).toBe("Root");
    expect(p.config).toEqual({});
  });
});

describe("ts-gen llm body", () => {
  it("buildLlmRequestBody includes root name + decl kind", () => {
    const body = buildLlmRequestBody('{"id":1}', cfg({ rootName: "User", declKind: "type" }));
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0].content).toContain("User");
    expect(body.messages[0].content).toContain("type");
  });
  it("extractLlmSuggestion extracts fenced ts block", () => {
    const out = extractLlmSuggestion({
      choices: [{ message: { content: "Here:\n```ts\ninterface X {}\n```\nDone" } }],
    });
    expect(out).toContain("interface X");
    expect(out).not.toContain("Here:");
  });
  it("extractLlmSuggestion handles bad input", () => {
    expect(extractLlmSuggestion(null)).toBe("");
    expect(extractLlmSuggestion({})).toBe("");
    expect(extractLlmSuggestion({ choices: [] })).toBe("");
  });
});

describe("ts-gen end-to-end sample", () => {
  it("SAMPLE_JSON_1 produces a User interface + nested Address", () => {
    const p = safeParseJson(SAMPLE_JSON_1);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const r = generateInterfaces([p.value], cfg({ rootName: "User" }));
    const src = renderTs(r);
    expect(src).toContain("interface User {");
    expect(src).toContain("interface UserAddress {");
    expect(src).toContain("id: number;");
    expect(src).toContain("name: string;");
    expect(src).toContain("roles:");
    expect(src).toContain("address: UserAddress;");
  });
  it("SAMPLE_JSON_2 produces StatusItem interface", () => {
    const p = safeParseJson(SAMPLE_JSON_2);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const r = generateInterfaces([p.value], cfg({ rootName: "Status" }));
    const src = renderTs(r);
    expect(src).toContain("interface StatusItem {");
    expect(src).toContain("id: number;");
    expect(src).toContain("label: string;");
  });
});
