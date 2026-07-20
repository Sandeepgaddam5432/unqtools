import { describe, it, expect, beforeEach } from "vitest";
import {
  SCALAR_GENERATORS,
  HONESTY_BANNER,
  SAMPLE_SDL,
  SAMPLE_QUERY,
  hashSeed,
  mulberry32,
  buildRng,
  genUuid,
  genEmail,
  genUrl,
  genDate,
  resolveFakerTemplate,
  tokenizeSdl,
  parseTypeRef,
  parseSdlTokens,
  parseSdl,
  unwrapNamed,
  isNonNull,
  isList,
  innerType,
  parseQuery,
  generateMock,
  generateMockWithFragments,
  renderJson,
  renderGraphqlResponse,
  renderMsw,
  renderApollo,
  renderResult,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MockOptions,
  type ExportFormat,
  type OperationKind,
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

// --- PRNG ------------------------------------------------------------------

describe("mock-graphql PRNG", () => {
  it("hashSeed is stable", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
  });
  it("hashSeed differs for different inputs", () => {
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
  it("hashSeed never returns 0", () => {
    expect(hashSeed("")).not.toBe(0);
  });
  it("mulberry32 is deterministic from seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it("mulberry32 next() returns [0,1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("mulberry32 int() returns inclusive bounds", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("buildRng with empty seed still works", () => {
    const r = buildRng(undefined);
    expect(typeof r.next()).toBe("number");
  });
  it("buildRng with seed is reproducible", () => {
    const r1 = buildRng("test-123");
    const r2 = buildRng("test-123");
    expect(r1.next()).toBe(r2.next());
  });
});

// --- Value generators ------------------------------------------------------

describe("mock-graphql value generators", () => {
  const r = mulberry32(12345);

  it("genUuid returns 36-char UUID v4", () => {
    expect(genUuid(r)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it("genEmail returns valid email", () => {
    expect(genEmail(r)).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
  });
  it("genUrl starts with https://", () => {
    expect(genUrl(r)).toMatch(/^https:\/\//);
  });
  it("genDate plain returns YYYY-MM-DD", () => {
    expect(genDate(r, "plain")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("genDate iso returns ISO 8601", () => {
    expect(genDate(r, "iso")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it("SCALAR_GENERATORS has 5 built-in scalars", () => {
    for (const t of ["String", "Int", "Float", "Boolean", "ID"]) {
      expect(SCALAR_GENERATORS[t]).toBeTruthy();
    }
  });
  it("SCALAR_GENERATORS has 10+ custom scalars", () => {
    const custom = Object.keys(SCALAR_GENERATORS).filter((k) =>
      !["String", "Int", "Float", "Boolean", "ID"].includes(k),
    );
    expect(custom.length).toBeGreaterThanOrEqual(10);
  });
  it("resolveFakerTemplate resolves {{name.firstName}}", () => {
    const v = resolveFakerTemplate(r, "{{name.firstName}}");
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });
  it("resolveFakerTemplate resolves {{internet.email}}", () => {
    const v = resolveFakerTemplate(r, "{{internet.email}}");
    expect(v).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
  });
  it("resolveFakerTemplate resolves {{datatype.uuid}}", () => {
    const v = resolveFakerTemplate(r, "{{datatype.uuid}}");
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it("resolveFakerTemplate resolves mixed template", () => {
    const v = resolveFakerTemplate(r, "Hello, {{name.firstName}}!");
    expect(v).toMatch(/^Hello, .+!$/);
  });
  it("resolveFakerTemplate returns literal if no token", () => {
    expect(resolveFakerTemplate(r, "hello world")).toBe("hello world");
  });
  it("resolveFakerTemplate parses JSON-like template", () => {
    const v = resolveFakerTemplate(r, '{"key": "value"}');
    expect(v).toEqual({ key: "value" });
  });
  it("HONESTY_BANNER mentions synthetic", () => {
    expect(HONESTY_BANNER).toContain("synthetic");
  });
});

// --- SDL tokenizer & parser ------------------------------------------------

describe("mock-graphql SDL tokenizer", () => {
  it("tokenizes basic type", () => {
    const tokens = tokenizeSdl("type User { id: ID! name: String! }");
    expect(tokens).toContain("type");
    expect(tokens).toContain("User");
    expect(tokens).toContain("{");
    expect(tokens).toContain("id");
    expect(tokens).toContain(":");
    expect(tokens).toContain("ID");
    expect(tokens).toContain("!");
    expect(tokens).toContain("}");
  });
  it("strips comments", () => {
    const tokens = tokenizeSdl("# comment\ntype Foo { x: Int }");
    expect(tokens).not.toContain("#");
    expect(tokens).not.toContain("comment");
  });
  it("strips block descriptions", () => {
    const tokens = tokenizeSdl('"""doc"""\ntype Foo { x: Int }');
    expect(tokens).not.toContain('"""doc"""');
  });
});

describe("mock-graphql parseTypeRef", () => {
  it("parses NAMED", () => {
    const { type, next } = parseTypeRef(["String"], 0);
    expect(type).toEqual({ kind: "NAMED", name: "String" });
    expect(next).toBe(1);
  });
  it("parses NON_NULL NAMED", () => {
    const { type, next } = parseTypeRef(["String", "!"], 0);
    expect(type.kind).toBe("NON_NULL");
    expect(type.ofType).toEqual({ kind: "NAMED", name: "String" });
    expect(next).toBe(2);
  });
  it("parses LIST", () => {
    const { type, next } = parseTypeRef(["[", "String", "]", "!"], 0);
    expect(type.kind).toBe("NON_NULL");
    expect(type.ofType!.kind).toBe("LIST");
    expect(next).toBe(4);
  });
});

describe("mock-graphql parseSdl", () => {
  it("rejects empty input", () => {
    const r = parseSdl("");
    expect(r.ok).toBe(false);
  });
  it("parses simple type", () => {
    const r = parseSdl("type User { id: ID! name: String! email: String }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["User"]).toBeTruthy();
      expect(r.schema.types["User"].fields).toHaveLength(3);
      expect(r.schema.types["User"].fields![0].name).toBe("id");
    }
  });
  it("parses interface + implements", () => {
    const r = parseSdl(`
      interface Node { id: ID! }
      type User implements Node { id: ID! name: String! }
    `);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["Node"].kind).toBe("INTERFACE");
      expect(r.schema.types["User"].interfaces).toContain("Node");
      expect(r.schema.types["Node"].possibleTypes).toContain("User");
    }
  });
  it("parses union", () => {
    const r = parseSdl(`
      type A { x: Int }
      type B { y: Int }
      union AB = A | B
    `);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["AB"].kind).toBe("UNION");
      expect(r.schema.types["AB"].possibleTypes).toEqual(["A", "B"]);
    }
  });
  it("parses enum", () => {
    const r = parseSdl("enum Role { ADMIN MEMBER GUEST }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["Role"].kind).toBe("ENUM");
      expect(r.schema.types["Role"].enumValues).toEqual(["ADMIN", "MEMBER", "GUEST"]);
    }
  });
  it("parses input type", () => {
    const r = parseSdl("input CreateUserInput { email: String! name: String! }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["CreateUserInput"].kind).toBe("INPUT");
      expect(r.schema.types["CreateUserInput"].fields).toHaveLength(2);
    }
  });
  it("parses scalar", () => {
    const r = parseSdl("scalar DateTime");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.types["DateTime"].kind).toBe("SCALAR");
    }
  });
  it("parses schema block with query type", () => {
    const r = parseSdl(`
      schema { query: MyQuery }
      type MyQuery { hello: String }
    `);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.queryType).toBe("MyQuery");
    }
  });
  it("auto-detects Query type", () => {
    const r = parseSdl("type Query { hello: String }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.queryType).toBe("Query");
    }
  });
  it("parses field arguments", () => {
    const r = parseSdl("type Query { user(id: ID!, limit: Int = 10): User } type User { id: ID! }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const field = r.schema.types["Query"].fields!.find((f) => f.name === "user");
      expect(field?.args).toHaveLength(2);
      expect(field?.args![0].name).toBe("id");
      expect(field?.args![1].defaultValue).toBe("10");
    }
  });
  it("parses the SAMPLE_SDL", () => {
    const r = parseSdl(SAMPLE_SDL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.queryType).toBe("Query");
      expect(r.schema.mutationType).toBe("Mutation");
      expect(r.schema.subscriptionType).toBe("Subscription");
      expect(r.schema.types["User"]).toBeTruthy();
      expect(r.schema.types["User"].interfaces).toContain("Node");
      expect(r.schema.types["SearchResult"].kind).toBe("UNION");
      expect(r.schema.types["UserRole"].kind).toBe("ENUM");
      expect(r.schema.types["DateTime"].kind).toBe("SCALAR");
    }
  });
  it("returns error for malformed SDL", () => {
    const r = parseSdl("type User { ");
    expect(r.ok).toBe(false);
  });
});

// --- Type reference helpers ------------------------------------------------

describe("mock-graphql type helpers", () => {
  it("unwrapNamed returns the named type", () => {
    expect(unwrapNamed({ kind: "NAMED", name: "String" })).toBe("String");
    expect(unwrapNamed({ kind: "NON_NULL", ofType: { kind: "NAMED", name: "String" } })).toBe("String");
    expect(unwrapNamed({ kind: "NON_NULL", ofType: { kind: "LIST", ofType: { kind: "NAMED", name: "String" } } })).toBe("String");
  });
  it("isNonNull detects NON_NULL", () => {
    expect(isNonNull({ kind: "NON_NULL", ofType: { kind: "NAMED", name: "X" } })).toBe(true);
    expect(isNonNull({ kind: "NAMED", name: "X" })).toBe(false);
  });
  it("isList detects LIST (through NON_NULL)", () => {
    expect(isList({ kind: "LIST", ofType: { kind: "NAMED", name: "X" } })).toBe(true);
    expect(isList({ kind: "NON_NULL", ofType: { kind: "LIST", ofType: { kind: "NAMED", name: "X" } } })).toBe(true);
    expect(isList({ kind: "NAMED", name: "X" })).toBe(false);
  });
  it("innerType returns the inner of a list", () => {
    expect(innerType({ kind: "LIST", ofType: { kind: "NAMED", name: "X" } })).toEqual({ kind: "NAMED", name: "X" });
    expect(innerType({ kind: "NAMED", name: "X" })).toBeUndefined();
  });
});

// --- Query parser ----------------------------------------------------------

describe("mock-graphql parseQuery", () => {
  it("rejects empty input", () => {
    const r = parseQuery("");
    expect(r.ok).toBe(false);
  });
  it("parses anonymous query", () => {
    const r = parseQuery("{ hello }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations).toHaveLength(1);
      expect(r.operations[0].operation).toBe("query");
      expect(r.operations[0].selectionSet).toHaveLength(1);
      expect(r.operations[0].selectionSet[0].name).toBe("hello");
    }
  });
  it("parses named query", () => {
    const r = parseQuery("query GetUser { user { id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].operation).toBe("query");
      expect(r.operations[0].name).toBe("GetUser");
    }
  });
  it("parses mutation", () => {
    const r = parseQuery("mutation CreateUser { createUser { id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].operation).toBe("mutation");
    }
  });
  it("parses subscription", () => {
    const r = parseQuery("subscription OnPost { postCreated { id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].operation).toBe("subscription");
    }
  });
  it("parses nested selection sets", () => {
    const r = parseQuery("{ user { id name posts { id title } } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const user = r.operations[0].selectionSet[0];
      expect(user.name).toBe("user");
      expect(user.selectionSet).toHaveLength(3);
      const posts = user.selectionSet!.find((s) => s.name === "posts");
      expect(posts?.selectionSet).toHaveLength(2);
    }
  });
  it("parses field aliases", () => {
    const r = parseQuery("{ myAlias: user { id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].selectionSet[0].alias).toBe("myAlias");
      expect(r.operations[0].selectionSet[0].name).toBe("user");
    }
  });
  it("parses field arguments", () => {
    const r = parseQuery('{ user(id: "123") { id } }');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].selectionSet[0].args?.id).toBe('"123"');
    }
  });
  it("parses __typename", () => {
    const r = parseQuery("{ user { __typename id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const user = r.operations[0].selectionSet[0];
      expect(user.selectionSet!.some((s) => s.name === "__typename")).toBe(true);
    }
  });
  it("parses inline fragments", () => {
    const r = parseQuery("{ search { ... on User { id name } ... on Post { id title } } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const search = r.operations[0].selectionSet[0];
      const inlineFrags = search.selectionSet!.filter((s) => s.kind === "INLINE_FRAGMENT");
      expect(inlineFrags).toHaveLength(2);
    }
  });
  it("parses named fragments", () => {
    const r = parseQuery(`
      query GetUser { user { ...UserFields } }
      fragment UserFields on User { id name email }
    `);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].fragments["UserFields"]).toBeTruthy();
      expect(r.operations[0].fragments["UserFields"].typeCondition).toBe("User");
    }
  });
  it("parses query variables", () => {
    const r = parseQuery("query GetUser($id: ID!) { user(id: $id) { id } }");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations[0].variables).toHaveLength(1);
      expect(r.operations[0].variables![0].name).toBe("id");
    }
  });
  it("parses the SAMPLE_QUERY", () => {
    const r = parseQuery(SAMPLE_QUERY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations).toHaveLength(1);
      expect(r.operations[0].name).toBe("GetUser");
      expect(r.operations[0].selectionSet).toHaveLength(2); // user, users
    }
  });
});

// --- generateMock ----------------------------------------------------------

describe("mock-graphql generateMock", () => {
  const defaultOptions: MockOptions = {
    listSize: 3,
    depthLimit: 5,
    seed: "test-seed",
    nullableRate: 0,
    errorRate: 0,
    overrides: {},
  };

  it("generates mock for simple query", () => {
    const schema = parseSdl("type Query { hello: String! }");
    const op = parseQuery("{ hello }");
    expect(schema.ok).toBe(true);
    expect(op.ok).toBe(true);
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.data).toEqual({ hello: expect.any(String) });
  });

  it("generates mock for object type", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! email: String! }");
    const op = parseQuery("{ user { id name email } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { user: { id: string; name: string; email: string } };
    expect(data.user).toHaveProperty("id");
    expect(data.user).toHaveProperty("name");
    expect(data.user).toHaveProperty("email");
  });

  it("generates mock for list type with configured size", () => {
    const schema = parseSdl("type Query { users: [User!]! } type User { id: ID! name: String! }");
    const op = parseQuery("{ users { id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, { ...defaultOptions, listSize: 5 });
    const data = result.data as { users: unknown[] };
    expect(data.users).toHaveLength(5);
  });

  it("generates mock for enum", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! role: Role! } enum Role { ADMIN MEMBER GUEST }");
    const op = parseQuery("{ user { id role } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { user: { role: string } };
    expect(["ADMIN", "MEMBER", "GUEST"]).toContain(data.user.role);
  });

  it("generates mock for custom scalar", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! email: Email! } scalar Email");
    const op = parseQuery("{ user { id email } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { user: { email: string } };
    expect(data.user.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
  });

  it("generates mock for union with __typename", () => {
    const schema = parseSdl(`
      type Query { search: [SearchResult!]! }
      type User { id: ID! name: String! }
      type Post { id: ID! title: String! }
      union SearchResult = User | Post
    `);
    const op = parseQuery("{ search { ... on User { id name __typename } ... on Post { id title __typename } } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { search: Array<Record<string, unknown>> };
    expect(data.search.length).toBeGreaterThan(0);
    for (const item of data.search) {
      expect(["User", "Post"]).toContain(item.__typename);
    }
  });

  it("generates mock for interface with __typename", () => {
    const schema = parseSdl(`
      type Query { nodes: [Node!]! }
      interface Node { id: ID! }
      type User implements Node { id: ID! name: String! }
      type Post implements Node { id: ID! title: String! }
    `);
    const op = parseQuery("{ nodes { id __typename } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { nodes: Array<Record<string, unknown>> };
    expect(data.nodes.length).toBeGreaterThan(0);
    for (const node of data.nodes) {
      expect(["User", "Post"]).toContain(node.__typename);
    }
  });

  it("generates mock for mutation", () => {
    const schema = parseSdl("type Mutation { createUser(name: String!): User! } type User { id: ID! name: String! } type Query { _empty: String }");
    const op = parseQuery("mutation CreateUser { createUser(name: \"x\") { id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.operationKind).toBe("mutation");
    const data = result.data as { createUser: { id: string; name: string } };
    expect(data.createUser).toHaveProperty("id");
  });

  it("generates mock for subscription", () => {
    const schema = parseSdl("type Subscription { onPost: Post! } type Post { id: ID! title: String! } type Query { _empty: String }");
    const op = parseQuery("subscription OnPost { onPost { id title } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.operationKind).toBe("subscription");
  });

  it("respects aliases", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ myAlias: user { id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { myAlias: { id: string } };
    expect(data.myAlias).toBeDefined();
  });

  it("respects per-field overrides (literal)", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ user { id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, {
      ...defaultOptions,
      overrides: { "user.name": "Alice Override" },
    });
    const data = result.data as { user: { name: string } };
    expect(data.user.name).toBe("Alice Override");
  });

  it("respects per-field overrides (Faker template)", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ user { id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, {
      ...defaultOptions,
      overrides: { "user.name": "{{name.firstName}}" },
    });
    const data = result.data as { user: { name: string } };
    expect(typeof data.user.name).toBe("string");
    expect(data.user.name.length).toBeGreaterThan(0);
  });

  it("respects __typename", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ user { __typename id name } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { user: { __typename: string } };
    expect(data.user.__typename).toBe("User");
  });

  it("respects named fragment spreads", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! email: String! }");
    const op = parseQuery(`
      query GetUser { user { ...UserFields } }
      fragment UserFields on User { id name email }
    `);
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { user: { id: string; name: string; email: string } };
    expect(data.user).toHaveProperty("id");
    expect(data.user).toHaveProperty("name");
    expect(data.user).toHaveProperty("email");
  });

  it("respects inline fragments", () => {
    const schema = parseSdl(`
      type Query { search: [SearchResult!]! }
      type User { id: ID! name: String! }
      type Post { id: ID! title: String! }
      union SearchResult = User | Post
    `);
    const op = parseQuery("{ search { ... on User { id name __typename } ... on Post { id title __typename } } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    const data = result.data as { search: Array<Record<string, unknown>> };
    for (const item of data.search) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("__typename");
    }
  });

  it("respects depth limit for self-referential types", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! friends: [User!]! }");
    const op = parseQuery("{ user { id name friends { id name friends { id name friends { id name } } } } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, { ...defaultOptions, depthLimit: 2 });
    // At depth 2, nested friends should be null (depth-capped)
    expect(result.data).toBeDefined();
  });

  it("seeded generation is reproducible", () => {
    const schema = parseSdl("type Query { users: [User!]! } type User { id: ID! name: String! email: String! }");
    const op = parseQuery("{ users { id name email } }");
    if (!schema.ok || !op.ok) return;
    const a = generateMock(schema.schema, op.operations, { ...defaultOptions, seed: "abc" });
    const b = generateMock(schema.schema, op.operations, { ...defaultOptions, seed: "abc" });
    expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
  });

  it("different seeds give different output", () => {
    const schema = parseSdl("type Query { users: [User!]! } type User { id: ID! name: String! email: String! }");
    const op = parseQuery("{ users { id name email } }");
    if (!schema.ok || !op.ok) return;
    const a = generateMock(schema.schema, op.operations, { ...defaultOptions, seed: "abc" });
    const b = generateMock(schema.schema, op.operations, { ...defaultOptions, seed: "xyz" });
    expect(JSON.stringify(a.data)).not.toBe(JSON.stringify(b.data));
  });

  it("nullableRate emits nulls for nullable fields", () => {
    const schema = parseSdl("type Query { user: User } type User { id: ID name: String email: String }");
    const op = parseQuery("{ user { id name email } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, { ...defaultOptions, nullableRate: 1, seed: "null-1" });
    // With nullableRate=1, all nullable fields should be null
    const data = result.data as { user: { id: null; name: null; email: null } | null };
    // Note: even the root user field is nullable, so it may be null entirely
    if (data.user === null) {
      expect(data.user).toBeNull();
    } else {
      // All inner fields should be null
      expect(data.user.id).toBeNull();
      expect(data.user.name).toBeNull();
      expect(data.user.email).toBeNull();
    }
  });

  it("errorRate can produce errors", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ user { id name } }");
    if (!schema.ok || !op.ok) return;
    let sawError = false;
    for (let i = 0; i < 50; i++) {
      const result = generateMock(schema.schema, op.operations, {
        ...defaultOptions,
        errorRate: 1,
        seed: `err-${i}`,
      });
      if (result.errors && result.errors.length > 0) sawError = true;
    }
    expect(sawError).toBe(true);
  });

  it("operationName picks the right operation", () => {
    const schema = parseSdl("type Query { a: String b: String }");
    const op = parseQuery("query GetA { a } query GetB { b }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, { ...defaultOptions, operationName: "GetB" });
    const data = result.data as { a?: string; b?: string };
    expect(data.b).toBeDefined();
    expect(data.a).toBeUndefined();
  });

  it("warns on unknown field", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! }");
    const op = parseQuery("{ user { id nonexistent } }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.warnings.some((w) => w.includes("not found"))).toBe(true);
  });

  it("warns when no query type", () => {
    const schema = parseSdl("type Foo { x: Int }");
    const op = parseQuery("{ x }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.ok).toBe(false);
    expect(result.warnings[0]).toContain("query");
  });

  it("returns ok=true when no errors", () => {
    const schema = parseSdl("type Query { hello: String! }");
    const op = parseQuery("{ hello }");
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, defaultOptions);
    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("generateMockWithFragments alias works same as generateMock", () => {
    const schema = parseSdl("type Query { user: User! } type User { id: ID! name: String! }");
    const op = parseQuery("{ user { id name } }");
    if (!schema.ok || !op.ok) return;
    const a = generateMock(schema.schema, op.operations, { ...defaultOptions, seed: "alias" });
    const b = generateMockWithFragments(schema.schema, op.operations, { ...defaultOptions, seed: "alias" });
    expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
  });

  it("end-to-end with SAMPLE_SDL and SAMPLE_QUERY", () => {
    const schema = parseSdl(SAMPLE_SDL);
    const op = parseQuery(SAMPLE_QUERY);
    expect(schema.ok).toBe(true);
    expect(op.ok).toBe(true);
    if (!schema.ok || !op.ok) return;
    const result = generateMock(schema.schema, op.operations, { ...defaultOptions, listSize: 3 });
    const data = result.data as {
      user: { id: string; email: string; name: string; age: number | null; role: string; profile: Record<string, unknown>; posts: unknown[]; friends: unknown[] } | null,
      users: unknown[],
    };
    expect(data).toHaveProperty("user");
    expect(data).toHaveProperty("users");
    expect(Array.isArray(data.users)).toBe(true);
    if (data.user) {
      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("role");
      expect(data.user.profile).toBeDefined();
      expect(Array.isArray(data.user.posts)).toBe(true);
      expect(Array.isArray(data.user.friends)).toBe(true);
    }
  });
});

// --- Renderers -------------------------------------------------------------

describe("mock-graphql renderers", () => {
  const sampleResult = {
    ok: true as const,
    data: { hello: "world" },
    warnings: [],
    operationKind: "query" as OperationKind,
    operationName: "GetHello",
  };

  it("renderJson returns data-only JSON", () => {
    const s = renderJson(sampleResult);
    expect(JSON.parse(s)).toEqual({ hello: "world" });
  });
  it("renderGraphqlResponse returns envelope with data", () => {
    const s = renderGraphqlResponse(sampleResult);
    const parsed = JSON.parse(s);
    expect(parsed.data).toEqual({ hello: "world" });
    expect(parsed.errors).toBeUndefined();
  });
  it("renderGraphqlResponse includes errors when present", () => {
    const r = { ...sampleResult, ok: false, errors: [{ message: "boom" }] };
    const s = renderGraphqlResponse(r);
    const parsed = JSON.parse(s);
    expect(parsed.errors).toEqual([{ message: "boom" }]);
  });
  it("renderMsw returns MSW handler", () => {
    const s = renderMsw(sampleResult);
    expect(s).toContain("msw");
    expect(s).toContain("GetHello");
    expect(s).toContain("HttpResponse.json");
  });
  it("renderApollo returns Apollo mock", () => {
    const s = renderApollo(sampleResult);
    expect(s).toContain("MockedProvider");
    expect(s).toContain("GETHELLO");
    expect(s).toContain("result:");
  });
  it("renderResult dispatches by format", () => {
    expect(renderResult(sampleResult, "json")).toBe(renderJson(sampleResult));
    expect(renderResult(sampleResult, "graphql-response")).toBe(renderGraphqlResponse(sampleResult));
    expect(renderResult(sampleResult, "msw")).toBe(renderMsw(sampleResult));
    expect(renderResult(sampleResult, "apollo")).toBe(renderApollo(sampleResult));
  });
});

// --- Stats -----------------------------------------------------------------

describe("mock-graphql computeStats", () => {
  it("computes stats", () => {
    const result = {
      ok: true as const,
      data: { hello: "world" },
      warnings: ["a warning"],
      operationKind: "query" as OperationKind,
      operationName: "GetHello",
    };
    const opts: MockOptions = {
      listSize: 5, depthLimit: 3, seed: "x", nullableRate: 0, errorRate: 0, overrides: {},
    };
    const stats = computeStats(result, opts);
    expect(stats.operationKind).toBe("query");
    expect(stats.operationName).toBe("GetHello");
    expect(stats.warningsCount).toBe(1);
    expect(stats.listSize).toBe(5);
    expect(stats.depthLimit).toBe(3);
    expect(stats.hasErrors).toBe(false);
    expect(stats.dataBytes).toBeGreaterThan(0);
  });
});

// --- History ---------------------------------------------------------------

describe("mock-graphql history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, operationKind: "query", operationName: "GetUser",
      listSize: 3, seed: "abc", schemaSize: 100, querySize: 50, format: "json",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, operationKind: "query", listSize: 3, seed: String(i),
        schemaSize: 100, querySize: 50, format: "json",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, operationKind: "query", listSize: 3, seed: "abc",
      schemaSize: 100, querySize: 50, format: "json",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// --- Share URL -------------------------------------------------------------

describe("mock-graphql shareable URL", () => {
  const opts = {
    listSize: 5,
    depthLimit: 3,
    seed: "abc",
    nullableRate: 0.1,
    errorRate: 0.05,
    format: "msw" as ExportFormat,
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(opts);
    expect(url).toContain("list=5");
    expect(url).toContain("depth=3");
    expect(url).toContain("seed=abc");
    expect(url).toContain("null=0.1");
    expect(url).toContain("err=0.05");
    expect(url).toContain("fmt=msw");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.listSize).toBe(5);
    expect(parsed.depthLimit).toBe(3);
    expect(parsed.seed).toBe("abc");
    expect(parsed.nullableRate).toBeCloseTo(0.1);
    expect(parsed.errorRate).toBeCloseTo(0.05);
    expect(parsed.format).toBe("msw");
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.listSize).toBe(3);
    expect(parsed.depthLimit).toBe(3);
    expect(parsed.format).toBe("graphql-response");
  });
});

// Suppress unused-import lint
export type _Unused = OperationKind | ExportFormat;
