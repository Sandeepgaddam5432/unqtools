import { describe, it, expect, beforeEach } from "vitest";
import {
  DIALECTS,
  PRESETS,
  stripComments,
  splitStatements,
  normalizeIdentifier,
  splitQualified,
  matchType,
  splitColumnList,
  findMatchingParen,
  parseColumnDefinition,
  parseCreateTable,
  parseAlterTable,
  parseCreateIndex,
  detectDialect,
  parseDdl,
  inferRelationships,
  inferRelationshipsFromNaming,
  topologicalSort,
  generateMermaidErd,
  generateAsciiErd,
  generateDbml,
  autoLayout,
  serializeSchema,
  deserializeSchema,
  validateModel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  countFks,
  summarizeModel,
  type SchemaModel,
  type Dialect,
  type Column,
  type Table,
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

describe("sql-ddl-to-er-diagram-generator constants", () => {
  it("exposes 5 dialects", () => {
    expect(DIALECTS).toHaveLength(5);
    expect(DIALECTS).toContain("postgres");
    expect(DIALECTS).toContain("sqlserver");
  });
  it("has 3 presets", () => {
    expect(PRESETS).toHaveLength(3);
    for (const p of PRESETS) {
      expect(p.ddl.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
});

describe("sql-ddl-to-er-diagram-generator stripComments", () => {
  it("strips double-dash line comments", () => {
    expect(stripComments("SELECT 1 -- comment\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("strips hash comments", () => {
    expect(stripComments("SELECT 1 # comment\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("strips block comments (non-nested)", () => {
    expect(stripComments("SELECT /* hi */ 1")).toBe("SELECT   1");
  });
  it("strips nested block comments (postgres)", () => {
    expect(stripComments("SELECT /* outer /* inner */ still */ 1")).toBe("SELECT   1");
  });
  it("preserves string literals with embedded --", () => {
    expect(stripComments("INSERT INTO t VALUES ('a--b')")).toBe("INSERT INTO t VALUES ('a--b')");
  });
  it("preserves quoted identifiers with embedded /*", () => {
    expect(stripComments('SELECT "a/*b" FROM t')).toBe('SELECT "a/*b" FROM t');
  });
  it("preserves bracket identifiers", () => {
    expect(stripComments("SELECT [a--b] FROM t")).toBe("SELECT [a--b] FROM t");
  });
});

describe("sql-ddl-to-er-diagram-generator splitStatements", () => {
  it("splits on top-level semicolons", () => {
    expect(splitStatements("a; b; c;")).toEqual(["a", "b", "c"]);
  });
  it("preserves semicolons in string literals", () => {
    expect(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      "SELECT 1",
    ]);
  });
  it("preserves semicolons in quoted identifiers", () => {
    expect(splitStatements('SELECT "a;b"; SELECT 2')).toEqual(['SELECT "a;b"', "SELECT 2"]);
  });
  it("handles statement without trailing semicolon", () => {
    expect(splitStatements("SELECT 1")).toEqual(["SELECT 1"]);
  });
});

describe("sql-ddl-to-er-diagram-generator identifier helpers", () => {
  it("normalizeIdentifier strips backticks", () => {
    expect(normalizeIdentifier("`my-col`")).toBe("my-col");
  });
  it("normalizeIdentifier strips double-quotes and unescapes doubled quotes", () => {
    expect(normalizeIdentifier('"say ""hi"""')).toBe('say "hi"');
  });
  it("normalizeIdentifier strips brackets", () => {
    expect(normalizeIdentifier("[my col]")).toBe("my col");
  });
  it("splitQualified splits schema.table", () => {
    expect(splitQualified("public.users")).toEqual({ schema: "public", name: "users" });
  });
  it("splitQualified handles unqualified", () => {
    expect(splitQualified("users")).toEqual({ name: "users" });
  });
});

describe("sql-ddl-to-er-diagram-generator matchType", () => {
  it("matches single-word types", () => {
    const r = matchType("INTEGER NOT NULL");
    expect(r).not.toBeNull();
    expect(r!.type).toBe("INTEGER");
    expect(r!.rest).toBe("NOT NULL");
  });
  it("matches types with precision", () => {
    const r = matchType("VARCHAR(255) NOT NULL");
    expect(r).not.toBeNull();
    expect(r!.type).toBe("VARCHAR(255)");
  });
  it("matches multi-word types (CHARACTER VARYING)", () => {
    const r = matchType("CHARACTER VARYING(100) NOT NULL");
    expect(r).not.toBeNull();
    expect(r!.type).toBe("CHARACTER VARYING");
  });
  it("matches multi-word types (DOUBLE PRECISION)", () => {
    const r = matchType("DOUBLE PRECISION NOT NULL");
    expect(r).not.toBeNull();
    expect(r!.type).toBe("DOUBLE PRECISION");
  });
});

describe("sql-ddl-to-er-diagram-generator splitColumnList & findMatchingParen", () => {
  it("splits top-level commas", () => {
    expect(splitColumnList("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("respects parens", () => {
    expect(splitColumnList("a DECIMAL(10,2), b INT")).toEqual(["a DECIMAL(10,2)", "b INT"]);
  });
  it("findMatchingParen finds closing", () => {
    expect(findMatchingParen("(a (b) c)", 0)).toBe(8);
  });
});

describe("sql-ddl-to-er-diagram-generator parseColumnDefinition", () => {
  it("parses a basic column", () => {
    const c = parseColumnDefinition("name VARCHAR(100) NOT NULL");
    expect(c.name).toBe("name");
    expect(c.type).toBe("VARCHAR(100)");
    expect(c.nullable).toBe(false);
  });
  it("parses PK + auto-increment", () => {
    const c = parseColumnDefinition("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(c.primaryKey).toBe(true);
    expect(c.autoIncrement).toBe(true);
    expect(c.nullable).toBe(false);
  });
  it("parses inline REFERENCES with explicit column", () => {
    const c = parseColumnDefinition("author_id INTEGER NOT NULL REFERENCES users(id)");
    expect(c.references).toEqual({ table: "users", column: "id" });
    expect(c.nullable).toBe(false);
  });
  it("parses inline REFERENCES without column (defaults to id)", () => {
    const c = parseColumnDefinition("user_id INTEGER REFERENCES users");
    expect(c.references).toEqual({ table: "users", column: "id" });
  });
  it("parses inline UNIQUE", () => {
    const c = parseColumnDefinition("email VARCHAR(255) UNIQUE");
    expect(c.unique).toBe(true);
    expect(c.inlineUnique).toBe(true);
  });
  it("parses DEFAULT", () => {
    const c = parseColumnDefinition("active BOOLEAN DEFAULT TRUE");
    expect(c.defaultValue).toBe("TRUE");
    expect(c.nullable).toBe(true);
  });
  it("parses DEFAULT string with embedded comma", () => {
    const c = parseColumnDefinition("config TEXT DEFAULT 'a,b,c'");
    expect(c.defaultValue).toBe("'a,b,c'");
  });
});

describe("sql-ddl-to-er-diagram-generator parseCreateTable", () => {
  it("parses a simple CREATE TABLE", () => {
    const t = parseCreateTable("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL)");
    expect(t).not.toBeNull();
    expect(t!.name).toBe("users");
    expect(t!.columns).toHaveLength(2);
    expect(t!.columns[0].primaryKey).toBe(true);
  });
  it("parses IF NOT EXISTS", () => {
    const t = parseCreateTable("CREATE TABLE IF NOT EXISTS foo (id INTEGER PRIMARY KEY)");
    expect(t!.name).toBe("foo");
  });
  it("parses schema-qualified table name", () => {
    const t = parseCreateTable("CREATE TABLE public.users (id INTEGER PRIMARY KEY)");
    expect(t!.schema).toBe("public");
    expect(t!.name).toBe("users");
  });
  it("parses quoted table name with backticks", () => {
    const t = parseCreateTable("CREATE TABLE `my-table` (id INTEGER PRIMARY KEY)");
    expect(t!.name).toBe("my-table");
  });
  it("parses table-level FOREIGN KEY", () => {
    const t = parseCreateTable(
      "CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER, FOREIGN KEY (author_id) REFERENCES users(id))",
    );
    expect(t!.foreignKeys).toHaveLength(1);
    expect(t!.foreignKeys[0].fromColumns).toEqual(["author_id"]);
    expect(t!.foreignKeys[0].toTable).toBe("users");
    expect(t!.foreignKeys[0].toColumns).toEqual(["id"]);
  });
  it("parses composite PRIMARY KEY", () => {
    const t = parseCreateTable(
      "CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, PRIMARY KEY (student_id, course_id))",
    );
    expect(t!.primaryKeys).toEqual(["student_id", "course_id"]);
    expect(t!.columns[0].primaryKey).toBe(true);
    expect(t!.columns[1].primaryKey).toBe(true);
  });
  it("parses composite FOREIGN KEY", () => {
    const t = parseCreateTable(
      "CREATE TABLE order_items (order_id INTEGER, product_id INTEGER, FOREIGN KEY (order_id, product_id) REFERENCES orders(id, sku))",
    );
    expect(t!.foreignKeys[0].fromColumns).toEqual(["order_id", "product_id"]);
    expect(t!.foreignKeys[0].toColumns).toEqual(["id", "sku"]);
  });
  it("parses self-referencing FK", () => {
    const t = parseCreateTable(
      "CREATE TABLE categories (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES categories(id))",
    );
    expect(t!.foreignKeys[0].toTable).toBe("categories");
    expect(t!.foreignKeys[0].fromColumns).toEqual(["parent_id"]);
  });
  it("parses named constraint", () => {
    const t = parseCreateTable(
      "CREATE TABLE x (a INTEGER, CONSTRAINT fk_x_a FOREIGN KEY (a) REFERENCES y(id))",
    );
    expect(t!.foreignKeys[0].name).toBe("fk_x_a");
  });
  it("parses table-level UNIQUE constraint", () => {
    const t = parseCreateTable(
      "CREATE TABLE x (a INTEGER, b INTEGER, CONSTRAINT uq_x UNIQUE (a, b))",
    );
    expect(t!.uniqueConstraints).toHaveLength(1);
    expect(t!.uniqueConstraints[0].name).toBe("uq_x");
    expect(t!.uniqueConstraints[0].columns).toEqual(["a", "b"]);
  });
  it("parses CHECK constraint (flagged but not interpreted)", () => {
    const t = parseCreateTable(
      "CREATE TABLE courses (credits INTEGER, CHECK (credits > 0 AND credits <= 10))",
    );
    expect(t!.checks).toHaveLength(1);
    expect(t!.checks[0].expr).toContain("credits");
  });
  it("returns null for non-CREATE-TABLE statement", () => {
    expect(parseCreateTable("SELECT * FROM users")).toBeNull();
  });
});

describe("sql-ddl-to-er-diagram-generator parseAlterTable", () => {
  it("parses ALTER TABLE ADD FOREIGN KEY", () => {
    const r = parseAlterTable("ALTER TABLE enrollments ADD FOREIGN KEY (student_id) REFERENCES students(id)");
    expect(r).not.toBeNull();
    expect(r!.table).toBe("enrollments");
    expect(r!.fks).toHaveLength(1);
    expect(r!.fks[0].toTable).toBe("students");
  });
  it("parses ALTER TABLE with named CONSTRAINT", () => {
    const r = parseAlterTable(
      "ALTER TABLE posts ADD CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id)",
    );
    expect(r!.fks[0].fromColumns).toEqual(["author_id"]);
  });
  it("returns null for non-ALTER statement", () => {
    expect(parseAlterTable("SELECT 1")).toBeNull();
  });
});

describe("sql-ddl-to-er-diagram-generator parseCreateIndex", () => {
  it("parses CREATE INDEX", () => {
    const r = parseCreateIndex("CREATE INDEX idx_posts_author ON posts(author_id)");
    expect(r).not.toBeNull();
    expect(r!.table).toBe("posts");
    expect(r!.index.columns).toEqual(["author_id"]);
    expect(r!.index.unique).toBe(false);
  });
  it("parses CREATE UNIQUE INDEX", () => {
    const r = parseCreateIndex("CREATE UNIQUE INDEX uniq_users_email ON users(email)");
    expect(r!.index.unique).toBe(true);
  });
});

describe("sql-ddl-to-er-diagram-generator detectDialect", () => {
  it("detects MySQL from backticks", () => {
    expect(detectDialect("CREATE TABLE `users` (id INT)")).toBe("mysql");
  });
  it("detects MySQL from ENGINE=InnoDB", () => {
    expect(detectDialect("CREATE TABLE users (id INT) ENGINE=InnoDB")).toBe("mysql");
  });
  it("detects PostgreSQL from SERIAL", () => {
    expect(detectDialect("CREATE TABLE users (id SERIAL PRIMARY KEY)")).toBe("postgres");
  });
  it("detects SQL Server from brackets", () => {
    expect(detectDialect("CREATE TABLE [users] (id INT)")).toBe("sqlserver");
  });
  it("detects SQLite from AUTOINCREMENT", () => {
    expect(detectDialect("CREATE TABLE x (id INTEGER PRIMARY KEY AUTOINCREMENT)")).toBe("sqlite");
  });
  it("defaults to ANSI", () => {
    expect(detectDialect("CREATE TABLE x (id INTEGER PRIMARY KEY)")).toBe("ansi");
  });
});

describe("sql-ddl-to-er-diagram-generator parseDdl (integration)", () => {
  it("parses a multi-table DDL with FKs", () => {
    const ddl = `
      CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE);
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        author_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL
      );
      CREATE INDEX idx_posts_author ON posts(author_id);
    `;
    const result = parseDdl(ddl);
    expect(result.statementCount).toBe(3);
    expect(result.model.tables).toHaveLength(2);
    const posts = result.model.tables.find((t) => t.name === "posts");
    expect(posts!.foreignKeys).toHaveLength(1);
    expect(posts!.indexes).toHaveLength(1);
  });
  it("applies ALTER TABLE FK to an existing table", () => {
    const ddl = `
      CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, PRIMARY KEY (student_id, course_id));
      ALTER TABLE enrollments ADD FOREIGN KEY (student_id) REFERENCES students(id);
    `;
    const result = parseDdl(ddl);
    const enr = result.model.tables.find((t) => t.name === "enrollments");
    expect(enr!.foreignKeys).toHaveLength(1);
  });
  it("warns when ALTER TABLE targets unknown table", () => {
    const result = parseDdl("ALTER TABLE ghost ADD FOREIGN KEY (a) REFERENCES b(id)");
    expect(result.issues.some((i) => i.severity === "warning" && i.message.includes("ghost"))).toBe(true);
  });
  it("warns on orphan FK targets", () => {
    const result = parseDdl("CREATE TABLE x (a INTEGER REFERENCES ghost(id))");
    expect(result.issues.some((i) => i.severity === "warning" && i.message.includes("ghost"))).toBe(true);
  });
  it("flags missing primary key as info", () => {
    const result = parseDdl("CREATE TABLE x (a INTEGER, b VARCHAR(10))");
    expect(result.issues.some((i) => i.severity === "info" && /no primary key/i.test(i.message))).toBe(true);
  });
  it("de-duplicates inline + table-level FK on same column", () => {
    const ddl = `CREATE TABLE x (
      a INTEGER REFERENCES y(id),
      FOREIGN KEY (a) REFERENCES y(id)
    )`;
    const result = parseDdl(ddl);
    const x = result.model.tables.find((t) => t.name === "x");
    expect(x!.foreignKeys).toHaveLength(1);
  });
  it("supports inferFromNaming option", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100));
      CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
    `;
    const result = parseDdl(ddl, { inferFromNaming: true });
    const posts = result.model.tables.find((t) => t.name === "posts");
    expect(posts!.foreignKeys.some((fk) => fk.toTable === "users")).toBe(true);
  });
  it("parses preset #1 (blog) without errors", () => {
    const result = parseDdl(PRESETS[0].ddl);
    expect(result.model.tables).toHaveLength(3);
    expect(result.model.tables.map((t) => t.name).sort()).toEqual(["comments", "posts", "users"]);
    // comments has self-ref FK (parent_id)
    const comments = result.model.tables.find((t) => t.name === "comments");
    expect(comments!.foreignKeys.some((fk) => fk.toTable === "comments")).toBe(true);
  });
  it("parses preset #2 (e-commerce) — composite PK + FK", () => {
    const result = parseDdl(PRESETS[1].ddl);
    const items = result.model.tables.find((t) => t.name === "order_items");
    expect(items!.primaryKeys).toEqual(["order_id", "product_id"]);
    expect(items!.foreignKeys.length).toBeGreaterThanOrEqual(2);
  });
  it("parses preset #3 (m2m) — CHECK constraint flagged", () => {
    const result = parseDdl(PRESETS[2].ddl);
    const courses = result.model.tables.find((t) => t.name === "courses");
    expect(courses!.checks).toHaveLength(1);
  });
});

describe("sql-ddl-to-er-diagram-generator inferRelationships", () => {
  it("builds Relationship[] from explicit FKs", () => {
    const ddl = "CREATE TABLE x (a INTEGER REFERENCES y(id))";
    const result = parseDdl(ddl);
    const rels = inferRelationships(result.model);
    expect(rels).toHaveLength(1);
    expect(rels[0].fromTable).toBe("x");
    expect(rels[0].toTable).toBe("y");
    expect(rels[0].source).toBe("explicit");
  });
  it("marks nullable FK as zero-or-more from side", () => {
    const ddl = "CREATE TABLE x (a INTEGER REFERENCES y(id))";
    const result = parseDdl(ddl);
    const rels = inferRelationships(result.model);
    expect(rels[0].fromCardinality).toBe("zero-or-more");
  });
  it("marks non-null UNIQUE FK as one from side", () => {
    const ddl = "CREATE TABLE x (a INTEGER NOT NULL UNIQUE REFERENCES y(id))";
    const result = parseDdl(ddl);
    const rels = inferRelationships(result.model);
    expect(rels[0].fromCardinality).toBe("one");
  });
});

describe("sql-ddl-to-er-diagram-generator inferRelationshipsFromNaming", () => {
  it("infers user_id → users.id", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100));
      CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
    `;
    const result = parseDdl(ddl);
    const inferred = inferRelationshipsFromNaming(result.model);
    expect(inferred).toHaveLength(1);
    expect(inferred[0].toTable).toBe("users");
    expect(inferred[0].source).toBe("inferred");
  });
  it("does not infer when explicit FK exists", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    const inferred = inferRelationshipsFromNaming(result.model);
    expect(inferred).toHaveLength(0);
  });
  it("infers category_id → categories (pluralized)", () => {
    const ddl = `
      CREATE TABLE categories (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, category_id INTEGER);
    `;
    const result = parseDdl(ddl);
    const inferred = inferRelationshipsFromNaming(result.model);
    expect(inferred).toHaveLength(1);
    expect(inferred[0].toTable).toBe("categories");
  });
});

describe("sql-ddl-to-er-diagram-generator topologicalSort", () => {
  it("orders by FK dependencies", () => {
    const ddl = `
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
      CREATE TABLE users (id INTEGER PRIMARY KEY);
    `;
    const result = parseDdl(ddl);
    const topo = topologicalSort(result.model);
    expect(topo.order.indexOf("users")).toBeLessThan(topo.order.indexOf("posts"));
  });
  it("detects circular FK chains", () => {
    const ddl = `
      CREATE TABLE a (id INTEGER PRIMARY KEY, b_id INTEGER REFERENCES b(id));
      CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id));
    `;
    const result = parseDdl(ddl);
    const topo = topologicalSort(result.model);
    expect(topo.cycles.length).toBeGreaterThanOrEqual(1);
  });
  it("includes all tables", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY)";
    const result = parseDdl(ddl);
    const topo = topologicalSort(result.model);
    expect(topo.order).toEqual(["x"]);
  });
});

describe("sql-ddl-to-er-diagram-generator generateMermaidErd", () => {
  it("generates erDiagram header", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50))";
    const result = parseDdl(ddl);
    const mermaid = generateMermaidErd(result.model);
    expect(mermaid.startsWith("erDiagram")).toBe(true);
    expect(mermaid).toContain("x {");
  });
  it("emits PK badge for primary keys", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY)";
    const result = parseDdl(ddl);
    const mermaid = generateMermaidErd(result.model);
    expect(mermaid).toContain("PK");
  });
  it("emits FK relationship lines", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    const mermaid = generateMermaidErd(result.model);
    expect(mermaid).toContain("posts");
    expect(mermaid).toContain("users");
    expect(mermaid).toMatch(/}\o--\|\|/); // zero-or-more → one
  });
  it("sanitizes table names with special chars", () => {
    const ddl = "CREATE TABLE `my-table` (id INTEGER PRIMARY KEY)";
    const result = parseDdl(ddl);
    const mermaid = generateMermaidErd(result.model);
    expect(mermaid).toContain("my_table");
  });
  it("honors showTypes=false", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50))";
    const result = parseDdl(ddl);
    const mermaid = generateMermaidErd(result.model, { showTypes: false });
    expect(mermaid).toContain("string");
  });
});

describe("sql-ddl-to-er-diagram-generator generateAsciiErd", () => {
  it("renders a table box", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50) NOT NULL)";
    const result = parseDdl(ddl);
    const ascii = generateAsciiErd(result.model);
    expect(ascii).toContain("x");
    expect(ascii).toContain("PK");
    expect(ascii).toContain("───");
  });
  it("lists relationships", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    const ascii = generateAsciiErd(result.model);
    expect(ascii).toContain("--- Relationships ---");
    expect(ascii).toContain("posts");
    expect(ascii).toContain("users");
  });
  it("shows no-foreign-keys message", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY)";
    const result = parseDdl(ddl);
    const ascii = generateAsciiErd(result.model);
    expect(ascii).toContain("no foreign keys");
  });
});

describe("sql-ddl-to-er-diagram-generator generateDbml", () => {
  it("generates Table blocks", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50) NOT NULL)";
    const result = parseDdl(ddl);
    const dbml = generateDbml(result.model);
    expect(dbml).toContain("Table x {");
    expect(dbml).toContain("[pk, not null]");
  });
  it("generates Ref lines for FKs", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    const dbml = generateDbml(result.model);
    expect(dbml).toContain("Ref:");
    expect(dbml).toContain("posts.author_id > users.id");
  });
  it("includes indexes block", () => {
    const ddl = `
      CREATE TABLE x (id INTEGER PRIMARY KEY);
      CREATE INDEX idx_x_id ON x(id);
    `;
    const result = parseDdl(ddl);
    const dbml = generateDbml(result.model);
    expect(dbml).toContain("indexes {");
  });
});

describe("sql-ddl-to-er-diagram-generator autoLayout", () => {
  it("assigns positions to every table", () => {
    const ddl = `
      CREATE TABLE a (id INTEGER PRIMARY KEY);
      CREATE TABLE b (id INTEGER PRIMARY KEY);
      CREATE TABLE c (id INTEGER PRIMARY KEY);
    `;
    const result = parseDdl(ddl);
    const laid = autoLayout(result.model);
    expect(Object.keys(laid.positions)).toHaveLength(3);
    expect(laid.positions.a.x).toBeGreaterThanOrEqual(0);
    expect(laid.positions.a.y).toBeGreaterThanOrEqual(0);
  });
  it("respects gridCols option", () => {
    const ddl = `
      CREATE TABLE a (id INTEGER PRIMARY KEY);
      CREATE TABLE b (id INTEGER PRIMARY KEY);
      CREATE TABLE c (id INTEGER PRIMARY KEY);
      CREATE TABLE d (id INTEGER PRIMARY KEY);
    `;
    const result = parseDdl(ddl);
    const laid = autoLayout(result.model, { gridCols: 4 });
    // All four should be in row 0 (same y)
    const ys = ["a", "b", "c", "d"].map((n) => laid.positions[n].y);
    expect(new Set(ys).size).toBe(1);
  });
});

describe("sql-ddl-to-er-diagram-generator serialize/deserialize", () => {
  it("round-trips a SchemaModel", () => {
    const ddl = "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50) NOT NULL)";
    const result = parseDdl(ddl);
    const json = serializeSchema(result.model);
    const back = deserializeSchema(json);
    expect(back).not.toBeNull();
    expect(back!.tables).toHaveLength(1);
    expect(back!.tables[0].name).toBe("x");
  });
  it("returns null for invalid JSON", () => {
    expect(deserializeSchema("not json")).toBeNull();
  });
  it("returns null for non-schema shape", () => {
    expect(deserializeSchema('{"foo":"bar"}')).toBeNull();
  });
});

describe("sql-ddl-to-er-diagram-generator validateModel", () => {
  it("flags duplicate table names", () => {
    const model: SchemaModel = {
      tables: [
        { name: "x", columns: [{ name: "id", type: "INT", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null }], primaryKeys: ["id"], foreignKeys: [], indexes: [], uniqueConstraints: [], checks: [] },
        { name: "x", columns: [], primaryKeys: [], foreignKeys: [], indexes: [], uniqueConstraints: [], checks: [] },
      ],
    };
    const issues = validateModel(model);
    expect(issues.some((i) => i.severity === "error" && /Duplicate table/i.test(i.message))).toBe(true);
  });
  it("flags duplicate column names", () => {
    const model: SchemaModel = {
      tables: [{
        name: "x",
        columns: [
          { name: "id", type: "INT", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null },
          { name: "id", type: "INT", nullable: true, primaryKey: false, unique: false, autoIncrement: false, defaultValue: null },
        ],
        primaryKeys: ["id"], foreignKeys: [], indexes: [], uniqueConstraints: [], checks: [],
      }],
    };
    const issues = validateModel(model);
    expect(issues.some((i) => i.severity === "error" && /Duplicate column/i.test(i.message))).toBe(true);
  });
  it("flags FK on missing column", () => {
    const model: SchemaModel = {
      tables: [{
        name: "x",
        columns: [{ name: "id", type: "INT", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null }],
        primaryKeys: ["id"],
        foreignKeys: [{ id: "fk1", fromTable: "x", fromColumns: ["ghost"], toTable: "y", toColumns: ["id"] }],
        indexes: [], uniqueConstraints: [], checks: [],
      }],
    };
    const issues = validateModel(model);
    expect(issues.some((i) => i.severity === "error" && /missing column/i.test(i.message))).toBe(true);
  });
  it("suggests case-insensitive table name match for FK", () => {
    const model: SchemaModel = {
      tables: [
        { name: "Users", columns: [{ name: "id", type: "INT", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null }], primaryKeys: ["id"], foreignKeys: [], indexes: [], uniqueConstraints: [], checks: [] },
        { name: "posts", columns: [{ name: "id", type: "INT", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null }], primaryKeys: ["id"],
          foreignKeys: [{ id: "fk", fromTable: "posts", fromColumns: ["id"], toTable: "users", toColumns: ["id"] }],
          indexes: [], uniqueConstraints: [], checks: [] },
      ],
    };
    const issues = validateModel(model);
    expect(issues.some((i) => /did you mean/i.test(i.message))).toBe(true);
  });
});

describe("sql-ddl-to-er-diagram-generator stats utilities", () => {
  it("countFks sums across tables", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
      CREATE TABLE comments (id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id), author_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    expect(countFks(result.model)).toBe(3);
  });
  it("summarizeModel returns all counts", () => {
    const ddl = `
      CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100));
      CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES users(id));
    `;
    const result = parseDdl(ddl);
    const s = summarizeModel(result.model);
    expect(s).toEqual({ tables: 2, columns: 4, fks: 1, indexes: 0, checks: 0 });
  });
});

describe("sql-ddl-to-er-diagram-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, tableCount: 3, fkCount: 2, dialect: "postgres", preview: "users, posts" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, tableCount: 1, fkCount: 0, dialect: "ansi", preview: `t${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, tableCount: 1, fkCount: 0, dialect: "ansi", preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sql-ddl-to-er-diagram-generator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("CREATE TABLE x (id INT PRIMARY KEY)", { inferFromNaming: true });
    expect(url).toContain("s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips DDL through the share URL", () => {
    const ddl = "CREATE TABLE foo (id INTEGER PRIMARY KEY)";
    const url = buildShareUrl(ddl, { inferFromNaming: true });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#s=${url.split("s=")[1]}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.ddl).toBe(ddl);
    expect(parsed.inferFromNaming).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ ddl: "", inferFromNaming: false });
  });
  it("handles malformed payload", () => {
    expect(parseShareUrl("s=!!!not-base64!!!")).toEqual({ ddl: "", inferFromNaming: false });
  });
});

// Suppress unused-import lint
export type _Unused = Dialect | Column | Table;
