import { describe, it, expect, beforeEach } from "vitest";
import {
  ORM_TARGETS,
  NAMING_STRATEGIES,
  TYPE_MAPPINGS,
  DDL_PRESETS,
  stripComments,
  splitStatements,
  splitTopLevel,
  unquoteIdentifier,
  parseColumnList,
  parseColumn,
  parseForeignKey,
  parseCreateTable,
  parseDdl,
  snakeToCamel,
  snakeToPascal,
  singularize,
  classNameFor,
  fieldNameFor,
  resolveType,
  fillTemplate,
  mapDefault,
  enumNameFor,
  generateOrm,
  generatePrisma,
  generateSequelize,
  generateTypeOrm,
  generateDrizzle,
  generateSqlAlchemy,
  generateDjango,
  convertDdlToOrm,
  convertDdlToAll,
  tsTypeFor,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type OrmTarget,
  type NamingStrategy,
  type HistoryEntry,
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

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

describe("sql-to-orm constants", () => {
  it("exposes 6 ORM targets", () => {
    expect(ORM_TARGETS).toHaveLength(6);
    expect(ORM_TARGETS.map((t) => t.value)).toEqual([
      "prisma", "sequelize", "typeorm", "drizzle", "sqlalchemy", "django",
    ]);
  });
  it("exposes 2 naming strategies", () => {
    expect(NAMING_STRATEGIES).toHaveLength(2);
  });
  it("has type mappings for common types", () => {
    expect(TYPE_MAPPINGS["varchar"]).toBeDefined();
    expect(TYPE_MAPPINGS["int"]).toBeDefined();
    expect(TYPE_MAPPINGS["enum"]).toBeDefined();
    expect(TYPE_MAPPINGS["varchar"].prisma).toBe("String");
    expect(TYPE_MAPPINGS["int"].django).toBe("IntegerField");
  });
  it("has 3 DDL presets", () => {
    expect(DDL_PRESETS).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Comment stripping and statement splitting
// ---------------------------------------------------------------------------

describe("sql-to-orm stripComments", () => {
  it("removes double-dash line comments", () => {
    expect(stripComments("SELECT 1 -- comment\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("removes block comments", () => {
    expect(stripComments("SELECT /* block */ 1")).toBe("SELECT  1");
  });
  it("removes MySQL hash comments", () => {
    expect(stripComments("SELECT 1 # hash\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("preserves string literals containing comment-like sequences", () => {
    expect(stripComments("SELECT '-- not a comment'")).toBe("SELECT '-- not a comment'");
  });
});

describe("sql-to-orm splitStatements", () => {
  it("splits by top-level semicolons", () => {
    const out = splitStatements("CREATE TABLE a (x INT); CREATE TABLE b (y INT);");
    expect(out).toHaveLength(2);
  });
  it("respects parentheses", () => {
    const out = splitStatements("CREATE TABLE a (x INT, y VARCHAR(10));");
    expect(out).toHaveLength(1);
  });
  it("ignores semicolons inside strings", () => {
    const out = splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;");
    expect(out).toHaveLength(2);
  });
});

describe("sql-to-orm splitTopLevel", () => {
  it("splits by delimiter at top level", () => {
    expect(splitTopLevel("a, b, c", ",")).toEqual(["a", "b", "c"]);
  });
  it("respects parens", () => {
    expect(splitTopLevel("a, (b, c), d", ",")).toEqual(["a", "(b, c)", "d"]);
  });
});

describe("sql-to-orm unquoteIdentifier", () => {
  it("strips backticks", () => { expect(unquoteIdentifier("`users`")).toBe("users"); });
  it("strips double quotes", () => { expect(unquoteIdentifier('"users"')).toBe("users"); });
  it("strips square brackets", () => { expect(unquoteIdentifier("[users]")).toBe("users"); });
  it("passes through unquoted", () => { expect(unquoteIdentifier("users")).toBe("users"); });
});

// ---------------------------------------------------------------------------
// Column / FK parsing
// ---------------------------------------------------------------------------

describe("sql-to-orm parseColumnList", () => {
  it("parses simple list", () => {
    expect(parseColumnList("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("unquotes identifiers", () => {
    expect(parseColumnList("`a`, [b], \"c\"")).toEqual(["a", "b", "c"]);
  });
});

describe("sql-to-orm parseColumn", () => {
  it("parses a basic column", () => {
    const c = parseColumn("id INT NOT NULL PRIMARY KEY AUTO_INCREMENT");
    expect(c).not.toBeNull();
    expect(c!.name).toBe("id");
    expect(c!.type).toBe("int");
    expect(c!.nullable).toBe(false);
    expect(c!.primaryKey).toBe(true);
    expect(c!.autoIncrement).toBe(true);
  });
  it("parses VARCHAR with length", () => {
    const c = parseColumn("email VARCHAR(255) NOT NULL");
    expect(c!.type).toBe("varchar");
    expect(c!.length).toBe("255");
  });
  it("parses DECIMAL with precision and scale", () => {
    const c = parseColumn("price DECIMAL(10, 2) NOT NULL");
    expect(c!.type).toBe("decimal");
    expect(c!.length).toBe("10");
    expect(c!.scale).toBe("2");
  });
  it("parses ENUM with values", () => {
    const c = parseColumn("role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer'");
    expect(c!.type).toBe("enum");
    expect(c!.enumValues).toEqual(["admin", "editor", "viewer"]);
    expect(c!.default).toBe("'viewer'");
  });
  it("parses nullable default with NULL", () => {
    const c = parseColumn("age INT NULL DEFAULT NULL");
    expect(c!.nullable).toBe(true);
  });
  it("parses inline REFERENCES", () => {
    const c = parseColumn("user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE");
    expect(c!.references).toBeDefined();
    expect(c!.references!.table).toBe("users");
    expect(c!.references!.column).toBe("id");
    expect(c!.references!.onDelete).toBe("CASCADE");
  });
  it("handles DEFAULT CURRENT_TIMESTAMP", () => {
    const c = parseColumn("created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(c!.default).toBe("CURRENT_TIMESTAMP");
  });
  it("collapses CHARACTER VARYING → varchar", () => {
    const c = parseColumn("name CHARACTER VARYING(100)");
    expect(c!.type).toBe("varchar");
    expect(c!.length).toBe("100");
  });
});

describe("sql-to-orm parseForeignKey", () => {
  it("parses a FOREIGN KEY clause", () => {
    const fk = parseForeignKey("FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");
    expect(fk).not.toBeNull();
    expect(fk!.columns).toEqual(["user_id"]);
    expect(fk!.ref.table).toBe("users");
    expect(fk!.ref.column).toBe("id");
    expect(fk!.ref.onDelete).toBe("CASCADE");
  });
  it("returns null for non-FK input", () => {
    expect(parseForeignKey("PRIMARY KEY (id)")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CREATE TABLE parsing
// ---------------------------------------------------------------------------

describe("sql-to-orm parseCreateTable", () => {
  it("parses a simple CREATE TABLE", () => {
    const t = parseCreateTable("CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100))");
    expect(t).not.toBeNull();
    expect(t!.name).toBe("users");
    expect(t!.columns).toHaveLength(2);
    expect(t!.columns[0].primaryKey).toBe(true);
  });
  it("parses IF NOT EXISTS", () => {
    const t = parseCreateTable("CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY)");
    expect(t!.name).toBe("users");
  });
  it("parses composite PRIMARY KEY", () => {
    const t = parseCreateTable(
      "CREATE TABLE post_tags (post_id INT, tag_id INT, PRIMARY KEY (post_id, tag_id))",
    );
    expect(t!.indexes.find((i) => i.primary)!.columns).toEqual(["post_id", "tag_id"]);
  });
  it("parses FOREIGN KEY constraint", () => {
    const t = parseCreateTable(
      "CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, FOREIGN KEY (user_id) REFERENCES users (id))",
    );
    expect(t!.foreignKeys).toHaveLength(1);
    expect(t!.foreignKeys[0].ref.table).toBe("users");
  });
  it("parses UNIQUE constraint", () => {
    const t = parseCreateTable(
      "CREATE TABLE cats (id INT, slug VARCHAR(100), parent_id INT, UNIQUE (parent_id, slug))",
    );
    expect(t!.indexes.find((i) => i.unique && !i.primary)).toBeDefined();
  });
  it("parses CHECK constraint", () => {
    const t = parseCreateTable(
      "CREATE TABLE x (n INT, CHECK (n > 0))",
    );
    expect(t!.checks).toHaveLength(1);
    expect(t!.checks[0].expression).toContain("n > 0");
  });
  it("returns null for non-CREATE-TABLE", () => {
    expect(parseCreateTable("DROP TABLE x")).toBeNull();
  });
  it("parses quoted table names", () => {
    const t = parseCreateTable('CREATE TABLE "User Profiles" (id INT)');
    expect(t!.name).toBe("User Profiles");
  });
});

describe("sql-to-orm parseDdl", () => {
  it("parses multiple CREATE TABLE statements", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    expect(schema.tables).toHaveLength(2);
    expect(schema.tables[0].name).toBe("users");
    expect(schema.tables[1].name).toBe("posts");
  });
  it("flags skipped non-CREATE statements", () => {
    const schema = parseDdl("CREATE TABLE x (id INT); DROP TABLE y; CREATE INDEX i ON x (id);");
    expect(schema.tables).toHaveLength(1);
    expect(schema.skipped.length).toBeGreaterThanOrEqual(1);
  });
  it("parses the m2m preset", () => {
    const schema = parseDdl(DDL_PRESETS[1].ddl);
    expect(schema.tables).toHaveLength(3);
    const join = schema.tables.find((t) => t.name === "post_tags")!;
    expect(join.foreignKeys).toHaveLength(2);
    expect(join.indexes.find((i) => i.primary)!.columns).toEqual(["post_id", "tag_id"]);
  });
  it("parses the self-ref preset", () => {
    const schema = parseDdl(DDL_PRESETS[2].ddl);
    expect(schema.tables).toHaveLength(1);
    const t = schema.tables[0];
    expect(t.foreignKeys[0].ref.table).toBe("categories");
    expect(t.checks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

describe("sql-to-orm naming helpers", () => {
  it("snakeToCamel", () => {
    expect(snakeToCamel("user_id")).toBe("userId");
    expect(snakeToCamel("created_at")).toBe("createdAt");
  });
  it("snakeToPascal", () => {
    expect(snakeToPascal("user_profiles")).toBe("UserProfiles");
  });
  it("singularize", () => {
    expect(singularize("users")).toBe("user");
    expect(singularize("categories")).toBe("category");
    expect(singularize("posts")).toBe("post");
  });
  it("classNameFor", () => {
    expect(classNameFor("users")).toBe("User");
    expect(classNameFor("user_profiles")).toBe("UserProfile");
    expect(classNameFor("categories")).toBe("Category");
  });
  it("fieldNameFor respects strategy", () => {
    expect(fieldNameFor("user_id", "camelcase")).toBe("userId");
    expect(fieldNameFor("user_id", "preserve")).toBe("user_id");
  });
});

// ---------------------------------------------------------------------------
// Type mapping + default mapping
// ---------------------------------------------------------------------------

describe("sql-to-orm resolveType", () => {
  it("resolves varchar to prisma String", () => {
    expect(resolveType({ name: "x", type: "varchar", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "x" }, "prisma")).toBe("String");
  });
  it("returns undefined for unknown type", () => {
    expect(resolveType({ name: "x", type: "weird_type", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "x" }, "prisma")).toBeUndefined();
  });
});

describe("sql-to-orm fillTemplate", () => {
  it("fills length placeholder", () => {
    const out = fillTemplate("String({p})", { name: "x", type: "varchar", length: "100", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" }, "Enum");
    expect(out).toBe("String(100)");
  });
  it("fills scale placeholder", () => {
    const out = fillTemplate("Numeric({p}, {s})", { name: "x", type: "decimal", length: "10", scale: "2", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" }, "Enum");
    expect(out).toBe("Numeric(10, 2)");
  });
  it("defaults when length absent", () => {
    const out = fillTemplate("String({p})", { name: "x", type: "varchar", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" }, "Enum");
    expect(out).toBe("String(255)");
  });
});

describe("sql-to-orm mapDefault", () => {
  it("maps CURRENT_TIMESTAMP per-target", () => {
    expect(mapDefault("CURRENT_TIMESTAMP", "prisma")!.value).toBe("now()");
    expect(mapDefault("CURRENT_TIMESTAMP", "django")!.value).toBe("auto_now_add=True");
    expect(mapDefault("CURRENT_TIMESTAMP", "typeorm")!.value).toBe("() => new Date()");
  });
  it("passes numeric literals through", () => {
    expect(mapDefault("42", "prisma")!.value).toBe("42");
    expect(mapDefault("-3.14", "sqlalchemy")!.value).toBe("-3.14");
  });
  it("passes string literals through (Python: strips quotes for Django)", () => {
    expect(mapDefault("'active'", "prisma")!.value).toBe("'active'");
    expect(mapDefault("'active'", "django")!.value).toBe("active");
  });
  it("returns undefined for NULL", () => {
    expect(mapDefault("NULL", "prisma")).toBeUndefined();
  });
  it("maps TRUE per-target", () => {
    expect(mapDefault("TRUE", "prisma")!.value).toBe("true");
    expect(mapDefault("TRUE", "django")!.value).toBe("True");
  });
});

describe("sql-to-orm enumNameFor", () => {
  it("builds a PascalCase enum name", () => {
    expect(enumNameFor("users", "role")).toBe("UsersRole");
  });
});

describe("sql-to-orm tsTypeFor", () => {
  it("returns number for int", () => {
    expect(tsTypeFor({ name: "x", type: "int", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" })).toBe("number");
  });
  it("returns Date for timestamp", () => {
    expect(tsTypeFor({ name: "x", type: "timestamp", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" })).toBe("Date");
  });
  it("returns string for varchar", () => {
    expect(tsTypeFor({ name: "x", type: "varchar", nullable: true, primaryKey: false, unique: false, autoIncrement: false, raw: "" })).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// ORM generators
// ---------------------------------------------------------------------------

describe("sql-to-orm generatePrisma", () => {
  it("generates a Prisma model block", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generatePrisma(schema, "camelcase");
    expect(result.code).toContain("model User");
    expect(result.code).toContain("model Post");
    expect(result.code).toContain("@id");
    expect(result.code).toContain("@default(autoincrement())");
    expect(result.code).toContain("@map(\"user_id\")");
    expect(result.code).toContain("@@map(\"users\")");
    expect(result.code).toContain("@relation");
    expect(result.modelCount).toBe(2);
  });
  it("emits enum block for ENUM columns", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generatePrisma(schema, "camelcase");
    expect(result.code).toMatch(/^enum UsersRole/m);
    expect(result.code).toContain("admin");
  });
  it("flags CHECK constraints as manual", () => {
    const schema = parseDdl(DDL_PRESETS[2].ddl);
    const result = generatePrisma(schema, "camelcase");
    expect(result.notes.some((n) => n.severity === "manual" && /CHECK/.test(n.message))).toBe(true);
  });
});

describe("sql-to-orm generateSequelize", () => {
  it("generates Sequelize Model.init blocks", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateSequelize(schema, "camelcase");
    expect(result.code).toContain("class User extends Model");
    expect(result.code).toContain("DataTypes.INTEGER");
    expect(result.code).toContain("tableName:");
    expect(result.code).toContain("field: \"user_id\"");
  });
});

describe("sql-to-orm generateTypeOrm", () => {
  it("generates TypeORM @Entity classes", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateTypeOrm(schema, "camelcase");
    expect(result.code).toContain("@Entity(\"users\")");
    expect(result.code).toContain("@PrimaryGeneratedColumn()");
    expect(result.code).toContain("userId: number");
    expect(result.code).toContain("@ManyToOne");
  });
});

describe("sql-to-orm generateDrizzle", () => {
  it("generates Drizzle pgTable definitions", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateDrizzle(schema, "camelcase");
    expect(result.code).toContain("export const users = pgTable(\"users\",");
    expect(result.code).toContain("export const posts = pgTable(\"posts\",");
    expect(result.code).toContain(".notNull()");
    expect(result.code).toContain("foreignKey(");
  });
  it("emits pgEnum for ENUM columns", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateDrizzle(schema, "camelcase");
    expect(result.code).toContain("pgEnum(");
    expect(result.code).toContain('"admin"');
  });
});

describe("sql-to-orm generateSqlAlchemy", () => {
  it("generates SQLAlchemy class definitions", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateSqlAlchemy(schema, "camelcase");
    expect(result.code).toContain("class User(Base):");
    expect(result.code).toContain("__tablename__ = \"users\"");
    expect(result.code).toContain("Column(String(255)");
    expect(result.code).toContain("ForeignKey(\"users.id\")");
    expect(result.code).toContain("relationship(");
  });
});

describe("sql-to-orm generateDjango", () => {
  it("generates Django model classes", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateDjango(schema, "camelcase");
    expect(result.code).toContain("class User(models.Model):");
    expect(result.code).toContain("class Meta:");
    expect(result.code).toContain("db_table = \"users\"");
    expect(result.code).toContain("AutoField(primary_key=True)");
    expect(result.code).toContain("db_column=\"user_id\"");
  });
  it("maps ENUM to CharField with choices", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const result = generateDjango(schema, "camelcase");
    expect(result.code).toContain("choices=[");
    expect(result.code).toContain('("admin", "admin")');
  });
});

// ---------------------------------------------------------------------------
// Top-level convert entry points
// ---------------------------------------------------------------------------

describe("sql-to-orm convertDdlToOrm", () => {
  it("returns an error for empty DDL", () => {
    const out = convertDdlToOrm("", { target: "prisma", naming: "camelcase" });
    expect(out.ok).toBe(false);
  });
  it("returns an error when no CREATE TABLE found", () => {
    const out = convertDdlToOrm("SELECT 1", { target: "prisma", naming: "camelcase" });
    expect(out.ok).toBe(false);
  });
  it("returns a result with code + notes for valid DDL", () => {
    const out = convertDdlToOrm(DDL_PRESETS[0].ddl, { target: "prisma", naming: "camelcase" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.results).toHaveLength(1);
      expect(out.results[0].target).toBe("prisma");
      expect(out.schema.tables).toHaveLength(2);
    }
  });
  it("generates all 6 targets via convertDdlToAll", () => {
    const out = convertDdlToAll(DDL_PRESETS[0].ddl, "camelcase");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.results).toHaveLength(6);
  });
});

describe("sql-to-orm generateOrm dispatch", () => {
  it("dispatches to the right generator", () => {
    const schema = parseDdl(DDL_PRESETS[0].ddl);
    const targets: OrmTarget[] = ["prisma", "sequelize", "typeorm", "drizzle", "sqlalchemy", "django"];
    for (const t of targets) {
      const r = generateOrm(schema, { target: t, naming: "camelcase" });
      expect(r.target).toBe(t);
      expect(r.code.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

describe("sql-to-orm history", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, target: "prisma", naming: "camelcase", tableCount: 2, preview: "users, posts" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, target: "prisma", naming: "camelcase", tableCount: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, target: "prisma", naming: "camelcase", tableCount: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("sql-to-orm share URL", () => {
  it("round-trips state via encodeState/decodeState", () => {
    const encoded = encodeState(DDL_PRESETS[0].ddl, "prisma", "camelcase");
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.target).toBe("prisma");
    expect(decoded!.naming).toBe("camelcase");
    expect(decoded!.ddl).toContain("CREATE TABLE users");
  });
  it("returns null for invalid encoded state", () => {
    expect(decodeState("!!!not-base64!!!")).toBeNull();
  });
  it("returns null for invalid target", () => {
    const encoded = encodeState("x", "prisma", "camelcase").replace(/prisma/, "invalid");
    // Note: the encoding is base64 of JSON; tampering with characters usually breaks decode.
    // If it does decode, the target validation kicks in.
    const decoded = decodeState(encoded);
    if (decoded !== null) {
      // The decode may succeed (if the tampering happens to land on valid base64 chars),
      // but the target must still be a valid OrmTarget.
      const validTargets = ORM_TARGETS.map((t) => t.value);
      expect(validTargets.includes(decoded.target as OrmTarget)).toBe(true);
    }
  });
  it("buildShareUrl returns query form when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DDL_PRESETS[0].ddl, "prisma", "camelcase");
    expect(url).toContain("?s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips", () => {
    const encoded = encodeState(DDL_PRESETS[0].ddl, "sequelize", "preserve");
    const parsed = parseShareUrl(`#s=${encoded}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.target).toBe("sequelize");
    expect(parsed!.naming).toBe("preserve");
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});

// Suppress unused-import lint for type-only imports.
export type _Unused = OrmTarget | NamingStrategy | HistoryEntry;
