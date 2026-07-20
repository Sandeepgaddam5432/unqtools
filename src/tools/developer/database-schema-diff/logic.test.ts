import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  DEFAULT_OPTIONS,
  OBJECT_TYPE_LABELS,
  SAMPLE_SOURCE_DDL,
  SAMPLE_TARGET_DDL,
  unquoteIdentifier,
  normalizeName,
  splitStatements,
  tokenizeDdl,
  splitBodyTokens,
  parseCreateTable,
  parseCreateIndex,
  parseSchema,
  findTable,
  findColumn,
  getPrimaryKey,
  getForeignKeys,
  isBaseType,
  isTypeNarrowing,
  extractBaseType,
  extractLength,
  diffSchemas,
  computeDiffStats,
  topologicalSort,
  quoteIdentifier,
  formatColumnDef,
  generateMigration,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiffOptions,
  type SqlDialect,
  type DiffDirection,
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

// ---- constants -----------------------------------------------------------

describe("schema-diff constants", () => {
  it("exposes 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["ansi", "mysql", "postgresql", "sqlite", "sqlserver"]),
    );
  });
  it("DEFAULT_OPTIONS has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.dialect).toBe("ansi");
    expect(DEFAULT_OPTIONS.direction).toBe("forward");
    expect(DEFAULT_OPTIONS.ignoreCase).toBe(true);
    expect(DEFAULT_OPTIONS.includeDrops).toBe(true);
    expect(DEFAULT_OPTIONS.includeDataLossWarnings).toBe(true);
  });
  it("OBJECT_TYPE_LABELS covers every type", () => {
    expect(Object.keys(OBJECT_TYPE_LABELS)).toHaveLength(7);
    expect(OBJECT_TYPE_LABELS.foreignKey).toBe("Foreign Key");
  });
  it("SAMPLE_SOURCE_DDL and SAMPLE_TARGET_DDL are non-empty", () => {
    expect(SAMPLE_SOURCE_DDL.length).toBeGreaterThan(50);
    expect(SAMPLE_TARGET_DDL.length).toBeGreaterThan(50);
  });
});

// ---- identifier normalization -------------------------------------------

describe("schema-diff identifier helpers", () => {
  it("unquoteIdentifier strips double quotes", () => {
    expect(unquoteIdentifier('"users"')).toBe("users");
  });
  it("unquoteIdentifier strips backticks", () => {
    expect(unquoteIdentifier("`users`")).toBe("users");
  });
  it("unquoteIdentifier strips brackets", () => {
    expect(unquoteIdentifier("[users]")).toBe("users");
  });
  it("unquoteIdentifier passes through unquoted names", () => {
    expect(unquoteIdentifier("users")).toBe("users");
  });
  it("normalizeName respects ignoreCase", () => {
    const opts: DiffOptions = { ...DEFAULT_OPTIONS, ignoreCase: true };
    expect(normalizeName("Users", opts)).toBe("users");
    const opts2: DiffOptions = { ...DEFAULT_OPTIONS, ignoreCase: false };
    expect(normalizeName("Users", opts2)).toBe("Users");
  });
});

// ---- statement splitter --------------------------------------------------

describe("schema-diff splitStatements", () => {
  it("splits on semicolons outside strings", () => {
    const out = splitStatements("CREATE TABLE a (x INT); CREATE TABLE b (y INT);");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("CREATE TABLE a");
    expect(out[1]).toContain("CREATE TABLE b");
  });
  it("ignores semicolons inside strings", () => {
    const out = splitStatements("CREATE TABLE a (x INT DEFAULT 'a;b');");
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("'a;b'");
  });
  it("ignores semicolons inside line comments", () => {
    const out = splitStatements("-- comment with ; semicolon\nCREATE TABLE a (x INT);");
    expect(out).toHaveLength(1);
  });
  it("ignores semicolons inside block comments", () => {
    const out = splitStatements("/* a ; b */\nCREATE TABLE a (x INT);");
    expect(out).toHaveLength(1);
  });
  it("handles empty input", () => {
    expect(splitStatements("")).toEqual([]);
  });
});

// ---- tokenizer -----------------------------------------------------------

describe("schema-diff tokenizeDdl", () => {
  it("tokenizes a simple CREATE TABLE", () => {
    const toks = tokenizeDdl("CREATE TABLE users (id INT NOT NULL)");
    const words = toks.map((t) => t.value);
    expect(words).toContain("CREATE");
    expect(words).toContain("users");
    expect(words).toContain("INT");
    expect(words).toContain("NOT");
    expect(words).toContain("NULL");
  });
  it("skips whitespace and line comments", () => {
    const toks = tokenizeDdl("-- a comment\nCREATE TABLE a (x INT) -- trailing");
    expect(toks.some((t) => t.value === "a")).toBe(true);
    expect(toks.some((t) => t.value === "--")).toBe(false);
  });
  it("treats quoted strings as a single token", () => {
    const toks = tokenizeDdl("CREATE TABLE a (x INT DEFAULT 'hello world')");
    const str = toks.find((t) => t.type === "string");
    expect(str?.value).toBe("'hello world'");
  });
  it("captures numbers", () => {
    const toks = tokenizeDdl("VARCHAR (255)");
    const num = toks.find((t) => t.type === "number");
    expect(num?.value).toBe("255");
  });
});

// ---- body splitter -------------------------------------------------------

describe("schema-diff splitBodyTokens", () => {
  it("splits on top-level commas only", () => {
    const toks = tokenizeDdl("a INT, b VARCHAR (255), c DECIMAL (10, 2), PRIMARY KEY (a, b)");
    const segs = splitBodyTokens(toks);
    expect(segs).toHaveLength(4);
    expect(segs[0].map((t) => t.value)).toEqual(["a", "INT"]);
    expect(segs[2].map((t) => t.value)).toEqual(["c", "DECIMAL", "(", "10", ",", "2", ")"]);
  });
});

// ---- CREATE TABLE parser -------------------------------------------------

describe("schema-diff parseCreateTable", () => {
  it("parses table name and columns", () => {
    const t = parseCreateTable("CREATE TABLE users (id INT NOT NULL, email VARCHAR(255))");
    expect(t?.name).toBe("users");
    expect(t?.columns).toHaveLength(2);
    expect(t?.columns[0].name).toBe("id");
    expect(t?.columns[0].type).toBe("INT");
    expect(t?.columns[0].nullable).toBe(false);
    expect(t?.columns[1].type).toBe("VARCHAR(255)");
    expect(t?.columns[1].baseType).toBe("VARCHAR");
  });
  it("parses inline PRIMARY KEY and UNIQUE flags", () => {
    const t = parseCreateTable("CREATE TABLE t (id INT PRIMARY KEY, email VARCHAR(50) UNIQUE)");
    expect(t?.columns[0].inlinePrimaryKey).toBe(true);
    expect(t?.columns[1].inlineUnique).toBe(true);
  });
  it("parses inline REFERENCES as inlineReferences", () => {
    const t = parseCreateTable("CREATE TABLE posts (user_id INT REFERENCES users (id))");
    expect(t?.columns[0].inlineReferences).toBe("users(id)");
  });
  it("parses named PRIMARY KEY constraint", () => {
    const t = parseCreateTable("CREATE TABLE t (id INT, CONSTRAINT pk_t PRIMARY KEY (id))");
    const pk = t?.constraints.find((c) => c.kind === "primaryKey");
    expect(pk?.name).toBe("pk_t");
    expect(pk?.columns).toEqual(["id"]);
  });
  it("parses FOREIGN KEY with REFERENCES and ON DELETE", () => {
    const t = parseCreateTable(
      "CREATE TABLE posts (id INT, user_id INT, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE)",
    );
    const fk = t?.constraints.find((c) => c.kind === "foreignKey");
    expect(fk?.columns).toEqual(["user_id"]);
    expect(fk?.referencesTable).toBe("users");
    expect(fk?.referencesColumns).toEqual(["id"]);
  });
  it("parses CHECK constraint", () => {
    const t = parseCreateTable("CREATE TABLE t (age INT, CONSTRAINT chk_age CHECK (age >= 0))");
    const chk = t?.constraints.find((c) => c.kind === "check");
    expect(chk?.name).toBe("chk_age");
    expect(chk?.checkExpr).toContain("age");
  });
  it("parses AUTO_INCREMENT and DEFAULT", () => {
    const t = parseCreateTable(
      "CREATE TABLE t (id INT NOT NULL AUTO_INCREMENT, created TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );
    expect(t?.columns[0].autoIncrement).toBe(true);
    expect(t?.columns[1].default).toBe("CURRENT_TIMESTAMP");
  });
  it("parses IF NOT EXISTS prefix", () => {
    const t = parseCreateTable("CREATE TABLE IF NOT EXISTS t (id INT)");
    expect(t?.name).toBe("t");
  });
  it("parses schema-qualified table name", () => {
    const t = parseCreateTable("CREATE TABLE public.users (id INT)");
    expect(t?.name).toBe("users");
  });
  it("parses UNSIGNED type modifier", () => {
    const t = parseCreateTable("CREATE TABLE t (id INT UNSIGNED NOT NULL)");
    expect(t?.columns[0].type).toBe("INT UNSIGNED");
  });
  it("returns null for non-CREATE-TABLE input", () => {
    expect(parseCreateTable("SELECT 1")).toBeNull();
  });
});

// ---- CREATE INDEX parser -------------------------------------------------

describe("schema-diff parseCreateIndex", () => {
  it("parses a basic CREATE INDEX", () => {
    const idx = parseCreateIndex("CREATE INDEX idx_posts_user ON posts (user_id)");
    expect(idx?.name).toBe("idx_posts_user");
    expect(idx?.table).toBe("posts");
    expect(idx?.columns).toEqual(["user_id"]);
    expect(idx?.unique).toBe(false);
  });
  it("parses CREATE UNIQUE INDEX", () => {
    const idx = parseCreateIndex("CREATE UNIQUE INDEX idx_email ON users (email)");
    expect(idx?.unique).toBe(true);
  });
  it("parses multi-column index", () => {
    const idx = parseCreateIndex("CREATE INDEX idx_multi ON t (a, b, c)");
    expect(idx?.columns).toEqual(["a", "b", "c"]);
  });
  it("parses IF NOT EXISTS prefix", () => {
    const idx = parseCreateIndex("CREATE INDEX IF NOT EXISTS idx_x ON t (x)");
    expect(idx?.name).toBe("idx_x");
  });
});

// ---- schema parser -------------------------------------------------------

describe("schema-diff parseSchema", () => {
  it("parses multiple CREATE TABLE statements", () => {
    const r = parseSchema(SAMPLE_SOURCE_DDL);
    expect(r.schema.tables).toHaveLength(2);
    const names = r.schema.tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["users", "posts"]));
  });
  it("attaches standalone indexes to their tables", () => {
    const r = parseSchema(SAMPLE_SOURCE_DDL);
    const posts = r.schema.tables.find((t) => t.name === "posts");
    expect(posts?.indexes.length).toBeGreaterThanOrEqual(2);
  });
  it("returns errors for empty input", () => {
    const r = parseSchema("");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("ignores non-CREATE statements gracefully", () => {
    const r = parseSchema("SELECT 1; INSERT INTO t VALUES (1);");
    expect(r.schema.tables).toHaveLength(0);
  });
});

// ---- lookups -------------------------------------------------------------

describe("schema-diff lookups", () => {
  const r = parseSchema(SAMPLE_SOURCE_DDL);
  const opts = DEFAULT_OPTIONS;

  it("findTable finds by name", () => {
    expect(findTable(r.schema, "users", opts)?.name).toBe("users");
    expect(findTable(r.schema, "missing", opts)).toBeUndefined();
  });
  it("findColumn finds by name", () => {
    const t = findTable(r.schema, "users", opts)!;
    expect(findColumn(t, "email", opts)?.name).toBe("email");
  });
  it("getPrimaryKey returns the named PK columns", () => {
    const t = findTable(r.schema, "users", opts)!;
    expect(getPrimaryKey(t, opts)).toEqual(["id"]);
  });
  it("getForeignKeys returns FK list", () => {
    const t = findTable(r.schema, "posts", opts)!;
    expect(getForeignKeys(t)).toHaveLength(1);
    expect(getForeignKeys(t)[0].referencesTable).toBe("users");
  });
});

// ---- type narrowing ------------------------------------------------------

describe("schema-diff type narrowing", () => {
  it("isBaseType recognizes common types", () => {
    expect(isBaseType("VARCHAR")).toBe(true);
    expect(isBaseType("INT")).toBe(true);
    expect(isBaseType("FOOBAR")).toBe(false);
  });
  it("extractBaseType strips parens", () => {
    expect(extractBaseType("VARCHAR(255)")).toBe("VARCHAR");
    expect(extractBaseType("DECIMAL(10,2)")).toBe("DECIMAL");
  });
  it("extractLength returns the first parenthesized number", () => {
    expect(extractLength("VARCHAR(255)")).toBe(255);
    expect(extractLength("DECIMAL(10,2)")).toBe(10);
    expect(extractLength("INT")).toBeNull();
  });
  it("detects narrowing when length shrinks", () => {
    expect(isTypeNarrowing("VARCHAR(255)", "VARCHAR(50)")).toBe(true);
  });
  it("does not flag widening", () => {
    expect(isTypeNarrowing("VARCHAR(50)", "VARCHAR(255)")).toBe(false);
  });
  it("detects narrowing for integer family", () => {
    expect(isTypeNarrowing("BIGINT", "INT")).toBe(true);
    expect(isTypeNarrowing("INT", "BIGINT")).toBe(false);
  });
});

// ---- diff ----------------------------------------------------------------

describe("schema-diff diffSchemas", () => {
  const opts = DEFAULT_OPTIONS;

  it("detects added tables", () => {
    const src = parseSchema("CREATE TABLE a (x INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (x INT); CREATE TABLE b (y INT);").schema;
    const diff = diffSchemas(src, tgt, opts);
    expect(diff.changes.some((c) => c.kind === "added" && c.objectType === "table" && c.table === "b")).toBe(true);
  });
  it("detects removed tables (with dataLoss when includeDrops)", () => {
    const src = parseSchema("CREATE TABLE a (x INT); CREATE TABLE b (y INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (x INT);").schema;
    const diff = diffSchemas(src, tgt, opts);
    const drop = diff.changes.find((c) => c.kind === "removed" && c.objectType === "table" && c.table === "b");
    expect(drop).toBeTruthy();
    expect(drop?.dataLoss).toBe(true);
  });
  it("detects added columns", () => {
    const src = parseSchema("CREATE TABLE a (x INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (x INT, y VARCHAR(50));").schema;
    const diff = diffSchemas(src, tgt, opts);
    expect(diff.changes.some((c) => c.kind === "added" && c.objectType === "column" && c.object === "y")).toBe(true);
  });
  it("detects removed columns (dataLoss)", () => {
    const src = parseSchema("CREATE TABLE a (x INT, y INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (x INT);").schema;
    const diff = diffSchemas(src, tgt, opts);
    const drop = diff.changes.find((c) => c.kind === "removed" && c.objectType === "column" && c.object === "y");
    expect(drop?.dataLoss).toBe(true);
  });
  it("detects column type change", () => {
    const src = parseSchema("CREATE TABLE a (x VARCHAR(50));").schema;
    const tgt = parseSchema("CREATE TABLE a (x VARCHAR(255));").schema;
    const diff = diffSchemas(src, tgt, opts);
    const mod = diff.changes.find((c) => c.kind === "modified" && c.objectType === "column" && c.object === "x");
    expect(mod).toBeTruthy();
    expect(mod?.from).toBe("VARCHAR(50)");
    expect(mod?.to).toBe("VARCHAR(255)");
    expect(mod?.dataLoss).toBe(false);
  });
  it("flags data loss on type narrowing", () => {
    const src = parseSchema("CREATE TABLE a (x VARCHAR(255));").schema;
    const tgt = parseSchema("CREATE TABLE a (x VARCHAR(50));").schema;
    const diff = diffSchemas(src, tgt, opts);
    const mod = diff.changes.find((c) => c.kind === "modified" && c.objectType === "column" && c.object === "x");
    expect(mod?.dataLoss).toBe(true);
  });
  it("detects added FK constraint", () => {
    const src = parseSchema("CREATE TABLE a (id INT); CREATE TABLE b (a_id INT);").schema;
    const tgt = parseSchema(
      "CREATE TABLE a (id INT); CREATE TABLE b (a_id INT, FOREIGN KEY (a_id) REFERENCES a (id));",
    ).schema;
    const diff = diffSchemas(src, tgt, opts);
    expect(diff.changes.some((c) => c.kind === "added" && c.objectType === "foreignKey")).toBe(true);
  });
  it("detects added index", () => {
    const src = parseSchema("CREATE TABLE a (id INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT); CREATE INDEX idx_a ON a (id);").schema;
    const diff = diffSchemas(src, tgt, opts);
    expect(diff.changes.some((c) => c.kind === "added" && c.objectType === "index")).toBe(true);
  });
  it("computeDiffStats counts events", () => {
    const src = parseSchema(SAMPLE_SOURCE_DDL).schema;
    const tgt = parseSchema(SAMPLE_TARGET_DDL).schema;
    const diff = diffSchemas(src, tgt, opts);
    expect(diff.stats.total).toBe(diff.changes.length);
    expect(diff.stats.total).toBeGreaterThan(0);
    // Target adds tables: tags, post_tags
    expect(diff.stats.tablesAdded).toBeGreaterThanOrEqual(2);
    // Target adds columns: username, updated_at (users) + slug, views (posts)
    expect(diff.stats.columnsAdded).toBeGreaterThanOrEqual(4);
    // Target adds indexes: idx_posts_slug
    expect(diff.stats.indexesAdded).toBeGreaterThanOrEqual(1);
    // email widens 255 -> 320 (no data loss)
    expect(diff.stats.dataLossOps).toBe(0);
  });
});

// ---- topological sort ----------------------------------------------------

describe("schema-diff topologicalSort", () => {
  it("places referenced table before referencing table", () => {
    const r = parseSchema(SAMPLE_TARGET_DDL);
    const sorted = topologicalSort(r.schema.tables, DEFAULT_OPTIONS);
    const usersIdx = sorted.findIndex((t) => t.name === "users");
    const postsIdx = sorted.findIndex((t) => t.name === "posts");
    const tagsIdx = sorted.findIndex((t) => t.name === "tags");
    const postTagsIdx = sorted.findIndex((t) => t.name === "post_tags");
    expect(usersIdx).toBeLessThan(postsIdx);
    expect(postsIdx).toBeLessThan(postTagsIdx);
    expect(tagsIdx).toBeLessThan(postTagsIdx);
  });
  it("handles cycles without infinite loop", () => {
    // a -> b -> a (circular)
    const r = parseSchema(
      "CREATE TABLE a (id INT, b_id INT, FOREIGN KEY (b_id) REFERENCES b (id));" +
      "CREATE TABLE b (id INT, a_id INT, FOREIGN KEY (a_id) REFERENCES a (id));",
    );
    const sorted = topologicalSort(r.schema.tables, DEFAULT_OPTIONS);
    expect(sorted).toHaveLength(2);
  });
});

// ---- migration generator -------------------------------------------------

describe("schema-diff generateMigration", () => {
  it("emits CREATE TABLE for added tables", () => {
    const src = parseSchema("").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT NOT NULL);").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.sql).toContain("CREATE TABLE");
      expect(m.sql).toContain("id INT");
    }
  });
  it("emits ALTER TABLE ADD COLUMN for added columns", () => {
    const src = parseSchema("CREATE TABLE a (id INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT, name VARCHAR(50) NOT NULL);").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) expect(m.sql).toContain("ALTER TABLE a ADD COLUMN");
  });
  it("emits DROP TABLE for removed tables with data-loss comment", () => {
    const src = parseSchema("CREATE TABLE a (id INT);").schema;
    const tgt = parseSchema("").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) {
      expect(m.sql).toContain("DROP TABLE");
      expect(m.sql).toContain("DATA LOSS");
    }
  });
  it("emits DROP COLUMN when includeDrops is true", () => {
    const src = parseSchema("CREATE TABLE a (id INT, name VARCHAR(50));").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT);").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) expect(m.sql).toContain("DROP COLUMN");
  });
  it("omits DROP COLUMN when includeDrops is false", () => {
    const opts: DiffOptions = { ...DEFAULT_OPTIONS, includeDrops: false };
    const src = parseSchema("CREATE TABLE a (id INT, name VARCHAR(50));").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT);").schema;
    const m = generateMigration(src, tgt, opts);
    if (m.ok) expect(m.sql).not.toContain("DROP COLUMN");
  });
  it("includes data-loss warning comment on type narrowing", () => {
    const src = parseSchema("CREATE TABLE a (x VARCHAR(255));").schema;
    const tgt = parseSchema("CREATE TABLE a (x VARCHAR(50));").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) expect(m.sql).toContain("DATA LOSS");
  });
  it("emits CREATE INDEX for added indexes", () => {
    const src = parseSchema("CREATE TABLE a (id INT);").schema;
    const tgt = parseSchema("CREATE TABLE a (id INT); CREATE INDEX idx_a ON a (id);").schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) expect(m.sql).toContain("CREATE INDEX");
  });
  it("produces consistent output for sample DDL", () => {
    const src = parseSchema(SAMPLE_SOURCE_DDL).schema;
    const tgt = parseSchema(SAMPLE_TARGET_DDL).schema;
    const m = generateMigration(src, tgt, DEFAULT_OPTIONS);
    if (m.ok) {
      expect(m.sql).toContain("CREATE TABLE tags");
      expect(m.sql).toContain("CREATE TABLE post_tags");
      expect(m.statementCount).toBeGreaterThan(0);
    }
  });
});

// ---- quote identifier & formatColumnDef ---------------------------------

describe("schema-diff quoteIdentifier and formatColumnDef", () => {
  it("quotes identifiers with reserved chars", () => {
    expect(quoteIdentifier("first-name", "mysql")).toBe("`first-name`");
    expect(quoteIdentifier("first-name", "postgresql")).toBe('"first-name"');
    expect(quoteIdentifier("first-name", "sqlserver")).toBe("[first-name]");
  });
  it("passes through simple identifiers", () => {
    expect(quoteIdentifier("users", "ansi")).toBe("users");
    expect(quoteIdentifier("users", "sqlserver")).toBe("users");
  });
  it("formatColumnDef includes type, nullability, default", () => {
    const col = {
      name: "email", type: "VARCHAR(255)", baseType: "VARCHAR",
      nullable: false, default: "'none'", autoIncrement: false,
      inlinePrimaryKey: false, inlineUnique: false, inlineReferences: null,
    };
    const out = formatColumnDef(col as never, "ansi");
    expect(out).toContain("email VARCHAR(255)");
    expect(out).toContain("NOT NULL");
    expect(out).toContain("DEFAULT 'none'");
  });
});

// ---- history & share URL -------------------------------------------------

describe("schema-diff history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dialect: "mysql", direction: "forward",
      sourcePreview: "x", targetPreview: "y",
      totalChanges: 5, dataLossOps: 0, statementCount: 5,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dialect: "ansi", direction: "forward",
        sourcePreview: "s", targetPreview: "t",
        totalChanges: 1, dataLossOps: 0, statementCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dialect: "ansi", direction: "forward",
      sourcePreview: "s", targetPreview: "t",
      totalChanges: 1, dataLossOps: 0, statementCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("schema-diff shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, dialect: "mysql", direction: "reverse" });
    expect(url).toContain("d=mysql");
    expect(url).toContain("dir=reverse");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=postgresql&dir=reverse&ico=1&icase=0");
    expect(p.dialect).toBe("postgresql");
    expect(p.direction).toBe("reverse");
    expect(p.ignoreColumnOrder).toBe(true);
    expect(p.ignoreCase).toBe(false);
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p).toEqual(DEFAULT_OPTIONS);
  });
});

// ---- unused-type export suppression --------------------------------------

export type _Unused = SqlDialect | DiffDirection;
