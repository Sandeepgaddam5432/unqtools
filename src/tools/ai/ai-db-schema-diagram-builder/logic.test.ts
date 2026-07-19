import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  TYPE_PRESETS,
  TYPE_MAP,
  MERMAID_TYPE,
  normalizeEntityName,
  normalizeColumnName,
  pluralize,
  singularize,
  mapType,
  parseSqlDdl,
  splitTopLevel,
  parseColumnList,
  parseNaturalLanguage,
  parseColumnSpec,
  inferRelationships,
  generateMermaid,
  renderMermaidRelationship,
  generateDbml,
  renderCsv,
  renderText,
  mermaidLiveUrl,
  validateSchema,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Schema,
  type Entity,
  type Column,
  type Relationship,
  type DbType,
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

// Suppress unused-import lint
export type _Unused = DbType | Entity | Column | Relationship;

describe("ai-db-schema constants", () => {
  it("exposes history key + max 20", () => {
    expect(HISTORY_KEY).toContain("ai-db-schema-diagram-builder");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 20+ type presets", () => {
    expect(TYPE_PRESETS.length).toBeGreaterThanOrEqual(20);
    expect(TYPE_PRESETS).toContain("int");
    expect(TYPE_PRESETS).toContain("uuid");
    expect(TYPE_PRESETS).toContain("jsonb");
  });
  it("maps common SQL types", () => {
    expect(TYPE_MAP["integer"]).toBe("int");
    expect(TYPE_MAP["varchar"]).toBe("varchar");
    expect(TYPE_MAP["character varying"]).toBe("varchar");
    expect(TYPE_MAP["timestamp with time zone"]).toBe("timestamptz");
    expect(TYPE_MAP["bytea"]).toBe("blob");
  });
  it("maps every DbType to a Mermaid label", () => {
    for (const t of TYPE_PRESETS) {
      expect(MERMAID_TYPE[t]).toBeTruthy();
    }
  });
});

describe("ai-db-schema normalize helpers", () => {
  it("normalizes entity names", () => {
    expect(normalizeEntityName("`users`")).toBe("users");
    expect(normalizeEntityName('"public"."Users"')).toBe("publicUsers");
    expect(normalizeEntityName(" order items ")).toBe("order_items");
  });
  it("normalizes column names", () => {
    expect(normalizeColumnName("[User ID]")).toBe("User_ID");
  });
  it("pluralizes and singularizes", () => {
    expect(pluralize("user")).toBe("users");
    expect(pluralize("category")).toBe("categories");
    expect(pluralize("box")).toBe("boxes");
    expect(singularize("users")).toBe("user");
    expect(singularize("categories")).toBe("category");
    expect(singularize("boxes")).toBe("box");
  });
  it("maps types ignoring length", () => {
    expect(mapType("VARCHAR(255)")).toBe("varchar");
    expect(mapType("DECIMAL(10,2)")).toBe("decimal");
    expect(mapType("UNKNOWN_TYPE")).toBe("unknown");
  });
});

describe("ai-db-schema splitTopLevel + parseColumnList", () => {
  it("splits on top-level commas only", () => {
    expect(splitTopLevel("a, b(1,2), c", ",")).toEqual(["a", " b(1,2)", " c"]);
  });
  it("respects quoted strings", () => {
    expect(splitTopLevel("'a,b', c", ",")).toEqual(["'a,b'", " c"]);
  });
  it("parses paren column lists", () => {
    expect(parseColumnList("(id, name, email)")).toEqual(["id", "name", "email"]);
    expect(parseColumnList("id, name")).toEqual(["id", "name"]);
    expect(parseColumnList("")).toEqual([]);
  });
});

describe("ai-db-schema SQL DDL parser", () => {
  it("parses a basic CREATE TABLE", () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.entities).toHaveLength(1);
    expect(schema.entities[0].name).toBe("users");
    expect(schema.entities[0].columns).toHaveLength(4);
    const id = schema.entities[0].columns[0];
    expect(id.name).toBe("id");
    expect(id.type).toBe("serial");
    expect(id.keys).toContain("PK");
    expect(id.nullable).toBe(false);
    const email = schema.entities[0].columns[1];
    expect(email.type).toBe("varchar");
    expect(email.keys).toContain("UK");
    expect(email.nullable).toBe(false);
  });

  it("parses inline REFERENCES", () => {
    const sql = `
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL
      );
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.entities).toHaveLength(1);
    expect(schema.relationships).toHaveLength(1);
    const r = schema.relationships[0];
    expect(r.from).toBe("posts");
    expect(r.to).toBe("users");
    expect(r.fromField).toBe("user_id");
    expect(r.toField).toBe("id");
    expect(r.type).toBe("1:N");
    const fkCol = schema.entities[0].columns.find((c) => c.name === "user_id");
    expect(fkCol?.keys).toContain("FK");
    expect(fkCol?.references).toEqual({ entity: "users", column: "id" });
  });

  it("parses table-level FOREIGN KEY constraint", () => {
    const sql = `
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        body TEXT,
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.relationships).toHaveLength(1);
    expect(schema.relationships[0].to).toBe("posts");
    expect(schema.relationships[0].fromField).toBe("post_id");
    const fkCol = schema.entities[0].columns.find((c) => c.name === "post_id");
    expect(fkCol?.keys).toContain("FK");
  });

  it("parses composite PRIMARY KEY and UNIQUE constraints", () => {
    const sql = `
      CREATE TABLE user_tags (
        user_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, tag_id),
        UNIQUE (tag_id, user_id)
      );
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.entities).toHaveLength(1);
    const cols = schema.entities[0].columns;
    expect(cols[0].keys).toContain("PK");
    expect(cols[1].keys).toContain("PK");
    expect(cols[0].keys).toContain("UK");
    expect(cols[1].keys).toContain("UK");
  });

  it("parses multiple tables", () => {
    const sql = `
      CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
      CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id));
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.entities).toHaveLength(2);
    expect(schema.relationships).toHaveLength(1);
  });

  it("handles empty input", () => {
    const schema = parseSqlDdl("");
    expect(schema.entities).toEqual([]);
    expect(schema.relationships).toEqual([]);
  });

  it("strips SQL comments", () => {
    const sql = `
      -- This is a comment
      CREATE TABLE users (
        id SERIAL PRIMARY KEY, -- inline comment
        name TEXT /* block comment */
      );
    `;
    const schema = parseSqlDdl(sql);
    expect(schema.entities).toHaveLength(1);
    expect(schema.entities[0].columns).toHaveLength(2);
  });
});

describe("ai-db-schema NL parser", () => {
  it("parses 'Table X has columns'", () => {
    const nl = "Table users has columns: id (pk, int), email (varchar, unique), name (text)";
    const schema = parseNaturalLanguage(nl);
    expect(schema.entities).toHaveLength(1);
    expect(schema.entities[0].name).toBe("users");
    expect(schema.entities[0].columns).toHaveLength(3);
    expect(schema.entities[0].columns[0].keys).toContain("PK");
    expect(schema.entities[0].columns[0].type).toBe("int");
    expect(schema.entities[0].columns[1].keys).toContain("UK");
  });

  it("parses 'X: a, b, c' shorthand", () => {
    const nl = "users: id (pk), email, name";
    const schema = parseNaturalLanguage(nl);
    expect(schema.entities).toHaveLength(1);
    expect(schema.entities[0].columns).toHaveLength(3);
    expect(schema.entities[0].columns[0].keys).toContain("PK");
  });

  it("parses 'has many' relationships", () => {
    const nl = "users has many posts";
    const schema = parseNaturalLanguage(nl);
    expect(schema.entities).toHaveLength(2);
    expect(schema.relationships).toHaveLength(1);
    expect(schema.relationships[0]).toMatchObject({
      from: "users",
      to: "posts",
      type: "1:N",
    });
  });

  it("parses 'belongs to' relationships (reversed)", () => {
    const nl = "posts belongs to users";
    const schema = parseNaturalLanguage(nl);
    expect(schema.relationships).toHaveLength(1);
    expect(schema.relationships[0]).toMatchObject({
      from: "users",
      to: "posts",
      type: "1:N",
    });
  });

  it("parses 'has one' relationships", () => {
    const nl = "users has one profile";
    const schema = parseNaturalLanguage(nl);
    expect(schema.relationships[0]).toMatchObject({
      from: "users",
      to: "profile",
      type: "1:1",
    });
  });

  it("parses 'many-to-many via'", () => {
    const nl = "users many-to-many tags via user_tags";
    const schema = parseNaturalLanguage(nl);
    expect(schema.relationships[0]).toMatchObject({
      from: "users",
      to: "tags",
      type: "N:M",
      via: "user_tags",
    });
    expect(schema.entities.find((e) => e.name === "user_tags")).toBeTruthy();
  });

  it("deduplicates columns on re-parse", () => {
    const nl = "users: id (pk)\nusers: id (pk), email";
    const schema = parseNaturalLanguage(nl);
    expect(schema.entities[0].columns).toHaveLength(2);
  });
});

describe("ai-db-schema parseColumnSpec", () => {
  it("parses 'id (pk, int)'", () => {
    const c = parseColumnSpec("id (pk, int)");
    expect(c?.name).toBe("id");
    expect(c?.keys).toContain("PK");
    expect(c?.type).toBe("int");
    expect(c?.nullable).toBe(false);
  });
  it("parses 'email varchar unique'", () => {
    const c = parseColumnSpec("email varchar unique");
    expect(c?.name).toBe("email");
    expect(c?.type).toBe("varchar");
    expect(c?.keys).toContain("UK");
  });
  it("returns null for empty spec", () => {
    expect(parseColumnSpec("")).toBeNull();
  });
});

describe("ai-db-schema inferRelationships", () => {
  it("infers 1:N from <table>_id naming", () => {
    const entities: Entity[] = [
      { name: "users", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
      { name: "posts", columns: [
        { name: "id", type: "int", nullable: false, keys: ["PK"] },
        { name: "user_id", type: "int", nullable: true, keys: [] },
      ] },
    ];
    const rels = inferRelationships(entities);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      from: "users",
      to: "posts",
      type: "1:N",
      fromField: "id",
      toField: "user_id",
    });
  });

  it("detects N:M junction table with two *_id columns", () => {
    const entities: Entity[] = [
      { name: "users", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
      { name: "tags", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
      { name: "user_tags", columns: [
        { name: "user_id", type: "int", nullable: false, keys: [] },
        { name: "tag_id", type: "int", nullable: false, keys: [] },
      ] },
    ];
    const rels = inferRelationships(entities);
    expect(rels.length).toBeGreaterThanOrEqual(1);
    const nm = rels.find((r) => r.type === "N:M");
    expect(nm).toBeTruthy();
    expect(nm?.via).toBe("user_tags");
  });
});

describe("ai-db-schema generateMermaid", () => {
  it("generates a valid erDiagram with entity blocks", () => {
    const schema: Schema = {
      entities: [
        { name: "users", columns: [
          { name: "id", type: "int", nullable: false, keys: ["PK"] },
          { name: "email", type: "varchar", nullable: false, keys: ["UK"] },
        ] },
      ],
      relationships: [],
    };
    const mmd = generateMermaid(schema);
    expect(mmd).toContain("erDiagram");
    expect(mmd).toContain("users {");
    expect(mmd).toContain("INT id PK");
    expect(mmd).toContain("VARCHAR email UK");
    expect(mmd).toContain("}");
  });

  it("renders crow's-foot relationships for 1:N", () => {
    const r: Relationship = { id: "x", from: "users", to: "posts", type: "1:N" };
    expect(renderMermaidRelationship(r)).toContain("||--}o");
  });
  it("renders crow's-foot relationships for 1:1", () => {
    const r: Relationship = { id: "x", from: "users", to: "profile", type: "1:1" };
    expect(renderMermaidRelationship(r)).toContain("||--||");
  });
  it("renders crow's-foot relationships for N:M", () => {
    const r: Relationship = { id: "x", from: "users", to: "tags", type: "N:M", via: "user_tags" };
    const line = renderMermaidRelationship(r);
    expect(line).toContain("}o--}o");
    expect(line).toContain("via user_tags");
  });

  it("includes a title front-matter when set", () => {
    const schema: Schema = {
      title: "Blog Schema",
      entities: [],
      relationships: [],
    };
    expect(generateMermaid(schema)).toContain("---\ntitle: Blog Schema\n---");
  });
});

describe("ai-db-schema generateDbml", () => {
  it("generates DBML with Table + Ref", () => {
    const schema: Schema = {
      entities: [
        { name: "users", columns: [
          { name: "id", type: "serial", rawType: "SERIAL", nullable: false, keys: ["PK"] },
          { name: "email", type: "varchar", rawType: "VARCHAR(255)", nullable: false, keys: ["UK"] },
        ] },
        { name: "posts", columns: [
          { name: "id", type: "serial", rawType: "SERIAL", nullable: false, keys: ["PK"] },
          { name: "user_id", type: "int", rawType: "INTEGER", nullable: true, keys: ["FK"] },
        ] },
      ],
      relationships: [
        { id: "x", from: "users", to: "posts", type: "1:N", fromField: "id", toField: "user_id" },
      ],
    };
    const dbml = generateDbml(schema);
    expect(dbml).toContain("Table users {");
    expect(dbml).toContain("SERIAL id [pk]");
    expect(dbml).toContain("VARCHAR(255) email [unique]");
    expect(dbml).toContain("Ref: posts.user_id > users.id");
  });

  it("renders N:M with junction refs", () => {
    const schema: Schema = {
      entities: [],
      relationships: [
        { id: "x", from: "users", to: "tags", type: "N:M", via: "user_tags" },
      ],
    };
    const dbml = generateDbml(schema);
    expect(dbml).toContain("Ref: user_tags.user_id > users.id");
    expect(dbml).toContain("Ref: user_tags.tag_id > tags.id");
  });
});

describe("ai-db-schema renderCsv + renderText", () => {
  const schema: Schema = {
    entities: [
      { name: "users", columns: [
        { name: "id", type: "int", nullable: false, keys: ["PK"] },
        { name: "email", type: "varchar", nullable: false, keys: ["UK"] },
      ] },
    ],
    relationships: [],
  };
  it("renderCsv has header and rows", () => {
    const csv = renderCsv(schema);
    expect(csv).toContain("entity,column,type,nullable,keys");
    expect(csv).toContain("users,id,INT,false,PK");
    expect(csv).toContain("users,email,VARCHAR,false,UK");
  });
  it("renderText lists columns and relationships", () => {
    const text = renderText({ ...schema, relationships: [
      { id: "x", from: "users", to: "posts", type: "1:N" },
    ] });
    expect(text).toContain("Table users:");
    expect(text).toContain("Relationships:");
    expect(text).toContain("users 1:N posts");
  });
});

describe("ai-db-schema mermaidLiveUrl", () => {
  it("builds a mermaid.live edit URL with base64 payload", () => {
    const url = mermaidLiveUrl("erDiagram\n  users { INT id PK }");
    expect(url).toContain("https://mermaid.live/edit#base64:");
    // base64 payload should be non-empty
    expect(url.split("base64:")[1].length).toBeGreaterThan(20);
  });
});

describe("ai-db-schema validateSchema", () => {
  it("flags empty schema", () => {
    const v = validateSchema({ entities: [], relationships: [] });
    expect(v.valid).toBe(false);
    expect(v.errors).toContain("Schema has no entities.");
  });
  it("warns when an entity has no PK", () => {
    const v = validateSchema({
      entities: [{ name: "users", columns: [{ name: "email", type: "varchar", nullable: true, keys: [] }] }],
      relationships: [],
    });
    expect(v.valid).toBe(true);
    expect(v.warnings.some((w) => w.includes("no primary key"))).toBe(true);
  });
  it("flags duplicate entity names", () => {
    const v = validateSchema({
      entities: [
        { name: "users", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
        { name: "users", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
      ],
      relationships: [],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("Duplicate entity"))).toBe(true);
  });
  it("flags relationship to missing entity", () => {
    const v = validateSchema({
      entities: [
        { name: "users", columns: [{ name: "id", type: "int", nullable: false, keys: ["PK"] }] },
      ],
      relationships: [
        { id: "x", from: "users", to: "ghosts", type: "1:N" },
      ],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("missing entity"))).toBe(true);
  });
});

describe("ai-db-schema history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "x", entityCount: 2, relCount: 1, source: "nl", mermaid: "erDiagram" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, entityCount: 1, relCount: 0, source: "nl", mermaid: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, entityCount: 1, relCount: 0, source: "nl", mermaid: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-db-schema shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ source: "sql", input: "CREATE TABLE users(id int);" });
    expect(url).toContain("src=sql");
    expect(url).toContain("s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("src=sql&s=CREATE%20TABLE%20users(id%20int)%3B");
    expect(s.source).toBe("sql");
    expect(s.input).toContain("CREATE TABLE users");
  });
  it("defaults source to nl when missing", () => {
    const s = parseShareUrl("s=hello");
    expect(s.source).toBe("nl");
  });
  it("handles empty hash", () => {
    const s = parseShareUrl("");
    expect(s).toEqual({ source: "nl", input: "" });
  });
});

describe("ai-db-schema LLM prompt + render", () => {
  it("builds an LLM prompt containing the NL input", () => {
    const prompt = buildLlmPrompt("users has many posts");
    expect(prompt).toContain("database architect");
    expect(prompt).toContain("users has many posts");
  });
  it("strips markdown fences from LLM output", () => {
    const out = renderLlmResult("```sql\nCREATE TABLE users (id int);\n```");
    expect(out.sql).toContain("CREATE TABLE users");
    expect(out.sql).not.toContain("```");
  });
});
