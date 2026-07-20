import { describe, it, expect, beforeEach } from "vitest";
import {
  DIALECTS,
  TYPE_LIST,
  RESERVED_WORDS,
  PRESET_MODELS,
  ON_ACTION_LABELS,
  dialectInfo,
  normalizeIdentifier,
  needsQuoting,
  quoteIdentifier,
  formatType,
  formatDefault,
  formatColumn,
  formatPrimaryKey,
  formatForeignKey,
  formatUnique,
  formatCheck,
  formatIndex,
  formatTableOptions,
  buildCreateTable,
  buildDropTable,
  buildSeedInserts,
  generateSeedValue,
  buildDdl,
  parseCsv,
  inferType,
  detectMaxLength,
  inferFromCsv,
  inferFromJson,
  validateModel,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  newId,
  type TableModel,
  type ColumnDef,
  type Dialect,
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

function emptyModel(name: string, dialect: Dialect, columns: ColumnDef[] = []): TableModel {
  return {
    name, dialect, columns,
    primaryKey: [],
    foreignKeys: [],
    uniques: [],
    checks: [],
    indexes: [],
    options: { ifNotExists: false },
  };
}

describe("create-table-generator constants", () => {
  it("has 4 dialects", () => {
    expect(DIALECTS).toHaveLength(4);
    expect(DIALECTS.map((d) => d.value)).toEqual(["mysql", "postgresql", "sqlite", "sqlserver"]);
  });
  it("has a type list per dialect", () => {
    for (const d of ["mysql", "postgresql", "sqlite", "sqlserver"] as Dialect[]) {
      expect(TYPE_LIST[d].length).toBeGreaterThan(5);
    }
  });
  it("has a non-empty reserved-words set", () => {
    expect(RESERVED_WORDS.size).toBeGreaterThan(50);
    expect(RESERVED_WORDS.has("select")).toBe(true);
    expect(RESERVED_WORDS.has("table")).toBe(true);
    expect(RESERVED_WORDS.has("order")).toBe(true);
  });
  it("exposes ON_ACTION labels for all 5 actions", () => {
    expect(Object.keys(ON_ACTION_LABELS)).toHaveLength(5);
    expect(ON_ACTION_LABELS["cascade"]).toBe("CASCADE");
    expect(ON_ACTION_LABELS["no action"]).toBe("NO ACTION");
  });
  it("dialectInfo returns the matching info", () => {
    expect(dialectInfo("mysql").quoteOpen).toBe("`");
    expect(dialectInfo("postgresql").quoteOpen).toBe('"');
    expect(dialectInfo("sqlserver").quoteOpen).toBe("[");
    expect(dialectInfo("sqlite").maxIdentifierLength).toBe(1024);
  });
});

describe("create-table-generator identifier handling", () => {
  it("normalizeIdentifier trims surrounding whitespace", () => {
    expect(normalizeIdentifier("  hello  ")).toBe("hello");
  });
  it("needsQuoting flags reserved words", () => {
    expect(needsQuoting("select", "mysql")).toBe(true);
    expect(needsQuoting("order", "postgresql")).toBe(true);
  });
  it("needsQuoting flags digit-leading identifiers", () => {
    expect(needsQuoting("1col", "mysql")).toBe(true);
  });
  it("needsQuoting flags identifiers with special characters", () => {
    expect(needsQuoting("first-name", "mysql")).toBe(true);
    expect(needsQuoting("with space", "mysql")).toBe(true);
  });
  it("does not quote plain identifiers", () => {
    expect(needsQuoting("email", "mysql")).toBe(false);
    expect(needsQuoting("user_id", "postgresql")).toBe(false);
  });
  it("quoteIdentifier uses backticks for MySQL", () => {
    expect(quoteIdentifier("select", "mysql")).toBe("`select`");
    expect(quoteIdentifier("email", "mysql")).toBe("`email`");
  });
  it("quoteIdentifier uses double-quotes for PostgreSQL", () => {
    expect(quoteIdentifier("order", "postgresql")).toBe('"order"');
  });
  it("quoteIdentifier uses square brackets for SQL Server", () => {
    expect(quoteIdentifier("user", "sqlserver")).toBe("[user]");
  });
  it("quoteIdentifier escapes inner quote chars", () => {
    expect(quoteIdentifier("a`b", "mysql")).toBe("`a``b`");
    expect(quoteIdentifier('a"b', "postgresql")).toBe('"a""b"');
  });
  it("returns empty string for empty input", () => {
    expect(quoteIdentifier("", "mysql")).toBe("");
  });
});

describe("create-table-generator formatType", () => {
  it("renders VARCHAR with length", () => {
    const col: ColumnDef = { id: "c", name: "name", type: "varchar", length: 100, nullable: true };
    expect(formatType(col, "mysql")).toBe("VARCHAR(100)");
  });
  it("defaults VARCHAR to 255 when no length", () => {
    const col: ColumnDef = { id: "c", name: "name", type: "varchar", nullable: true };
    expect(formatType(col, "mysql")).toBe("VARCHAR(255)");
  });
  it("renders DECIMAL with precision and scale", () => {
    const col: ColumnDef = { id: "c", name: "price", type: "decimal", length: 10, scale: 2, nullable: true };
    expect(formatType(col, "mysql")).toBe("DECIMAL(10, 2)");
  });
  it("renders DECIMAL with precision only", () => {
    const col: ColumnDef = { id: "c", name: "price", type: "decimal", length: 10, nullable: true };
    expect(formatType(col, "mysql")).toBe("DECIMAL(10)");
  });
  it("renders ENUM with quoted values for MySQL", () => {
    const col: ColumnDef = { id: "c", name: "role", type: "enum", nullable: true, enumValues: ["admin", "editor"] };
    expect(formatType(col, "mysql")).toBe("ENUM('admin', 'editor')");
  });
  it("renders ENUM as VARCHAR + (max length) on PostgreSQL", () => {
    const col: ColumnDef = { id: "c", name: "role", type: "enum", nullable: true, enumValues: ["admin", "editor"] };
    expect(formatType(col, "postgresql")).toBe("VARCHAR(6)");
  });
  it("renders ENUM as NVARCHAR on SQL Server", () => {
    const col: ColumnDef = { id: "c", name: "role", type: "enum", nullable: true, enumValues: ["a", "bb"] };
    expect(formatType(col, "sqlserver")).toBe("NVARCHAR(2)");
  });
  it("escapes single quotes inside ENUM values", () => {
    const col: ColumnDef = { id: "c", name: "role", type: "enum", nullable: true, enumValues: ["it's", "ok"] };
    expect(formatType(col, "mysql")).toBe("ENUM('it''s', 'ok')");
  });
  it("renders TIMESTAMP with precision", () => {
    const col: ColumnDef = { id: "c", name: "ts", type: "timestamp", length: 3, nullable: true };
    expect(formatType(col, "mysql")).toBe("TIMESTAMP(3)");
  });
  it("renders plain INT", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "int", nullable: true };
    expect(formatType(col, "mysql")).toBe("INT");
  });
  it("renders PostgreSQL UUID/JSONB pass-through", () => {
    expect(formatType({ id: "c", name: "u", type: "uuid", nullable: true }, "postgresql")).toBe("UUID");
    expect(formatType({ id: "c", name: "j", type: "jsonb", nullable: true }, "postgresql")).toBe("JSONB");
  });
  it("appends UNSIGNED for MySQL when flag set", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "int", nullable: true, unsigned: true };
    expect(formatType(col, "mysql")).toBe("INT UNSIGNED");
    // Ignored on other dialects
    expect(formatType(col, "postgresql")).toBe("INT");
  });
});

describe("create-table-generator formatDefault", () => {
  it("quotes string defaults", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "varchar", nullable: true, defaultValue: "hello" };
    expect(formatDefault(col)).toBe("'hello'");
  });
  it("does not quote numeric defaults", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "int", nullable: true, defaultValue: "42" };
    expect(formatDefault(col)).toBe("42");
  });
  it("renders boolean defaults as TRUE/FALSE", () => {
    const col1: ColumnDef = { id: "c", name: "b", type: "boolean", nullable: true, defaultValue: "true" };
    expect(formatDefault(col1)).toBe("TRUE");
    const col2: ColumnDef = { id: "c", name: "b", type: "boolean", nullable: true, defaultValue: "false" };
    expect(formatDefault(col2)).toBe("FALSE");
  });
  it("passes through expressions unquoted", () => {
    const col: ColumnDef = { id: "c", name: "ts", type: "timestamp", nullable: true, defaultValue: "CURRENT_TIMESTAMP", defaultIsExpression: true };
    expect(formatDefault(col)).toBe("CURRENT_TIMESTAMP");
  });
  it("escapes single quotes in string defaults", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "varchar", nullable: true, defaultValue: "it's" };
    expect(formatDefault(col)).toBe("'it''s'");
  });
  it("returns empty string for no default", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "int", nullable: true };
    expect(formatDefault(col)).toBe("");
  });
  it("treats NULL literal specially", () => {
    const col: ColumnDef = { id: "c", name: "n", type: "varchar", nullable: true, defaultValue: "NULL" };
    expect(formatDefault(col)).toBe("NULL");
  });
});

describe("create-table-generator formatColumn", () => {
  it("emits NOT NULL + type + default", () => {
    const col: ColumnDef = { id: "c", name: "email", type: "varchar", length: 255, nullable: false, defaultValue: "x@y" };
    expect(formatColumn(col, "mysql", [])).toBe("`email` VARCHAR(255) NOT NULL DEFAULT 'x@y'");
  });
  it("emits AUTO_INCREMENT for MySQL", () => {
    const col: ColumnDef = { id: "c", name: "id", type: "bigint", nullable: false, autoIncrement: true };
    expect(formatColumn(col, "mysql", [])).toBe("`id` BIGINT NOT NULL AUTO_INCREMENT");
  });
  it("emits GENERATED AS IDENTITY for PostgreSQL", () => {
    const col: ColumnDef = { id: "c", name: "id", type: "integer", nullable: false, autoIncrement: true };
    expect(formatColumn(col, "postgresql", [])).toContain("GENERATED BY DEFAULT AS IDENTITY");
  });
  it("emits IDENTITY(1,1) for SQL Server", () => {
    const col: ColumnDef = { id: "c", name: "id", type: "int", nullable: false, autoIncrement: true };
    expect(formatColumn(col, "sqlserver", [])).toContain("IDENTITY(1,1)");
  });
  it("appends inline CHECK for ENUM emulation on PostgreSQL", () => {
    const col: ColumnDef = { id: "c", name: "role", type: "enum", nullable: false, enumValues: ["a", "b"] };
    const checks: { id: string; expression: string; name?: string }[] = [];
    const out = formatColumn(col, "postgresql", checks);
    expect(out).toContain('CHECK ("role" IN (\'a\', \'b\'))');
    expect(checks).toHaveLength(1);
    expect(checks[0].expression).toContain('"role" IN');
  });
  it("appends COMMENT for MySQL inline", () => {
    const col: ColumnDef = { id: "c", name: "email", type: "varchar", length: 255, nullable: true, comment: "User email" };
    expect(formatColumn(col, "mysql", [])).toContain("COMMENT 'User email'");
  });
  it("does not append COMMENT inline for PostgreSQL", () => {
    const col: ColumnDef = { id: "c", name: "email", type: "varchar", length: 255, nullable: true, comment: "User email" };
    expect(formatColumn(col, "postgresql", [])).not.toContain("COMMENT");
  });
  it("quotes reserved-word column names", () => {
    const col: ColumnDef = { id: "c", name: "order", type: "int", nullable: true };
    expect(formatColumn(col, "mysql", [])).toContain("`order`");
  });
});

describe("create-table-generator formatPrimaryKey", () => {
  it("formats single-column PK", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false },
    ]);
    m.primaryKey = ["c1"];
    expect(formatPrimaryKey(m)).toBe("PRIMARY KEY (`id`)");
  });
  it("formats composite PK", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "a", type: "int", nullable: false },
      { id: "c2", name: "b", type: "int", nullable: false },
    ]);
    m.primaryKey = ["c1", "c2"];
    expect(formatPrimaryKey(m)).toBe("PRIMARY KEY (`a`, `b`)");
  });
  it("appends AUTOINCREMENT for SQLite single INTEGER PK", () => {
    const m = emptyModel("t", "sqlite", [
      { id: "c1", name: "id", type: "integer", nullable: false, autoIncrement: true },
    ]);
    m.primaryKey = ["c1"];
    expect(formatPrimaryKey(m)).toBe("PRIMARY KEY (\"id\") AUTOINCREMENT");
  });
  it("returns empty string for empty PK", () => {
    expect(formatPrimaryKey(emptyModel("t", "mysql"))).toBe("");
  });
});

describe("create-table-generator formatForeignKey", () => {
  it("formats FK with ON DELETE CASCADE", () => {
    const m = emptyModel("posts", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false },
      { id: "c2", name: "author_id", type: "bigint", nullable: false },
    ]);
    const fk = { id: "f1", columns: ["c2"], refTable: "users", refColumns: ["id"], onDelete: "cascade" as const };
    expect(formatForeignKey(fk, m)).toBe("FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE");
  });
  it("formats composite FK", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "a", type: "int", nullable: false },
      { id: "c2", name: "b", type: "int", nullable: false },
    ]);
    const fk = { id: "f1", columns: ["c1", "c2"], refTable: "parent", refColumns: ["x", "y"] };
    expect(formatForeignKey(fk, m)).toBe("FOREIGN KEY (`a`, `b`) REFERENCES `parent` (`x`, `y`)");
  });
  it("returns empty when columns missing", () => {
    const m = emptyModel("t", "mysql");
    const fk = { id: "f1", columns: ["missing"], refTable: "p", refColumns: ["x"] };
    expect(formatForeignKey(fk, m)).toBe("");
  });
  it("quotes reserved-word ref table names", () => {
    const m = emptyModel("t", "mysql", [{ id: "c1", name: "x", type: "int", nullable: false }]);
    const fk = { id: "f1", columns: ["c1"], refTable: "order", refColumns: ["id"] };
    expect(formatForeignKey(fk, m)).toContain("REFERENCES `order`");
  });
});

describe("create-table-generator formatUnique / formatCheck / formatIndex", () => {
  it("formats single UNIQUE", () => {
    const m = emptyModel("users", "mysql", [{ id: "c1", name: "email", type: "varchar", nullable: false }]);
    expect(formatUnique({ id: "u1", columns: ["c1"] }, m)).toBe("UNIQUE (`email`)");
  });
  it("formats named composite UNIQUE", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "a", type: "int", nullable: false },
      { id: "c2", name: "b", type: "int", nullable: false },
    ]);
    expect(formatUnique({ id: "u1", columns: ["c1", "c2"], name: "uq_ab" }, m)).toBe("CONSTRAINT `uq_ab` UNIQUE (`a`, `b`)");
  });
  it("formats named CHECK", () => {
    const m = emptyModel("t", "postgresql");
    expect(formatCheck({ id: "ck1", expression: "x > 0", name: "chk_pos" }, m)).toBe('CONSTRAINT "chk_pos" CHECK (x > 0)');
  });
  it("formats unnamed CHECK", () => {
    const m = emptyModel("t", "mysql");
    expect(formatCheck({ id: "ck1", expression: "x > 0" }, m)).toBe("CHECK (x > 0)");
  });
  it("formats MySQL INDEX with BTREE", () => {
    const m = emptyModel("t", "mysql", [{ id: "c1", name: "a", type: "int", nullable: false }]);
    const idx = { id: "i1", columns: ["c1"] };
    expect(formatIndex(idx, m)).toBe("INDEX `idx_t_c1` (`a`) USING BTREE");
  });
  it("formats MySQL HASH index", () => {
    const m = emptyModel("t", "mysql", [{ id: "c1", name: "a", type: "int", nullable: false }]);
    const idx = { id: "i1", columns: ["c1"], method: "hash" as const };
    expect(formatIndex(idx, m)).toContain("USING HASH");
  });
  it("returns null for SQLite (inline INDEX unsupported)", () => {
    const m = emptyModel("t", "sqlite", [{ id: "c1", name: "a", type: "int", nullable: false }]);
    expect(formatIndex({ id: "i1", columns: ["c1"] }, m)).toBeNull();
  });
  it("returns null for PostgreSQL (emitted as separate statement)", () => {
    const m = emptyModel("t", "postgresql", [{ id: "c1", name: "a", type: "int", nullable: false }]);
    expect(formatIndex({ id: "i1", columns: ["c1"] }, m)).toBeNull();
  });
});

describe("create-table-generator formatTableOptions", () => {
  it("formats MySQL ENGINE + CHARSET + COLLATE + comment", () => {
    const opts = { ifNotExists: true, engine: "InnoDB", charset: "utf8mb4", collate: "utf8mb4_unicode_ci", comment: "users" };
    const out = formatTableOptions(opts, "mysql");
    expect(out).toContain("ENGINE = InnoDB");
    expect(out).toContain("DEFAULT CHARSET = utf8mb4");
    expect(out).toContain("COLLATE = utf8mb4_unicode_ci");
    expect(out).toContain("COMMENT = 'users'");
  });
  it("formats SQLite WITHOUT ROWID", () => {
    const out = formatTableOptions({ ifNotExists: true, withoutRowid: true }, "sqlite");
    expect(out).toBe("WITHOUT ROWID");
  });
  it("returns empty for PostgreSQL with no options", () => {
    expect(formatTableOptions({ ifNotExists: true }, "postgresql")).toBe("");
  });
  it("ignores MySQL options on PostgreSQL", () => {
    const out = formatTableOptions({ ifNotExists: true, engine: "InnoDB" }, "postgresql");
    expect(out).toBe("");
  });
});

describe("create-table-generator buildCreateTable", () => {
  it("builds a minimal MySQL table", () => {
    const m = emptyModel("users", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false, autoIncrement: true },
      { id: "c2", name: "email", type: "varchar", length: 255, nullable: false },
    ]);
    m.primaryKey = ["c1"];
    m.options = { ifNotExists: true, engine: "InnoDB", charset: "utf8mb4" };
    const out = buildCreateTable(m);
    expect(out).toContain("CREATE TABLE IF NOT EXISTS `users` (");
    expect(out).toContain("`id` INT NOT NULL AUTO_INCREMENT");
    expect(out).toContain("`email` VARCHAR(255) NOT NULL");
    expect(out).toContain("PRIMARY KEY (`id`)");
    expect(out).toContain("ENGINE = InnoDB");
    expect(out).toContain("DEFAULT CHARSET = utf8mb4");
    expect(out.trim().endsWith(";")).toBe(true);
  });
  it("builds a PostgreSQL table with COMMENT ON statements", () => {
    const m = emptyModel("users", "postgresql", [
      { id: "c1", name: "id", type: "integer", nullable: false, autoIncrement: true, comment: "User ID" },
    ]);
    m.primaryKey = ["c1"];
    m.options = { ifNotExists: false, comment: "All users" };
    const out = buildCreateTable(m);
    expect(out).toContain("CREATE TABLE \"users\" (");
    expect(out).toContain("GENERATED BY DEFAULT AS IDENTITY");
    expect(out).toContain('COMMENT ON TABLE "users" IS \'All users\'');
    expect(out).toContain('COMMENT ON COLUMN "users"."id" IS \'User ID\'');
  });
  it("builds SQLite table with separate CREATE INDEX", () => {
    const m = emptyModel("posts", "sqlite", [
      { id: "c1", name: "id", type: "integer", nullable: false },
      { id: "c2", name: "title", type: "text", nullable: false },
    ]);
    m.primaryKey = ["c1"];
    m.indexes = [{ id: "i1", columns: ["c2"], name: "idx_title" }];
    m.options = { ifNotExists: true, withoutRowid: false };
    const out = buildCreateTable(m);
    expect(out).toContain('CREATE TABLE IF NOT EXISTS "posts" (');
    expect(out).toContain('CREATE INDEX "idx_title" ON "posts" ("title")');
  });
  it("builds SQLite WITHOUT ROWID table", () => {
    const m = emptyModel("post_tags", "sqlite", [
      { id: "c1", name: "post_id", type: "integer", nullable: false },
      { id: "c2", name: "tag_id", type: "integer", nullable: false },
    ]);
    m.primaryKey = ["c1", "c2"];
    m.options = { ifNotExists: true, withoutRowid: true };
    const out = buildCreateTable(m);
    expect(out).toContain(") WITHOUT ROWID;");
  });
  it("builds SQL Server with IDENTITY(1,1)", () => {
    const m = emptyModel("users", "sqlserver", [
      { id: "c1", name: "id", type: "int", nullable: false, autoIncrement: true },
      { id: "c2", name: "name", type: "varchar", length: 100, nullable: false },
    ]);
    m.primaryKey = ["c1"];
    m.options = { ifNotExists: false };
    const out = buildCreateTable(m);
    expect(out).toContain("CREATE TABLE [users] (");
    expect(out).toContain("[id] INT NOT NULL IDENTITY(1,1)");
    expect(out).toContain("PRIMARY KEY ([id])");
  });
  it("includes composite PK with comma separator", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "a", type: "int", nullable: false },
      { id: "c2", name: "b", type: "int", nullable: false },
    ]);
    m.primaryKey = ["c1", "c2"];
    const out = buildCreateTable(m);
    expect(out).toContain("PRIMARY KEY (`a`, `b`)");
  });
  it("includes FK with ON DELETE SET NULL", () => {
    const m = emptyModel("posts", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false, autoIncrement: true },
      { id: "c2", name: "author_id", type: "bigint", nullable: true },
    ]);
    m.primaryKey = ["c1"];
    m.foreignKeys = [{ id: "f1", columns: ["c2"], refTable: "users", refColumns: ["id"], onDelete: "set null" }];
    const out = buildCreateTable(m);
    expect(out).toContain("FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL");
  });
  it("includes named UNIQUE constraint", () => {
    const m = emptyModel("users", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false },
      { id: "c2", name: "email", type: "varchar", length: 255, nullable: false },
    ]);
    m.primaryKey = ["c1"];
    m.uniques = [{ id: "u1", columns: ["c2"], name: "uq_email" }];
    const out = buildCreateTable(m);
    expect(out).toContain("CONSTRAINT `uq_email` UNIQUE (`email`)");
  });
  it("includes CHECK constraint", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "age", type: "int", nullable: false },
    ]);
    m.checks = [{ id: "ck1", expression: "age >= 0" }];
    const out = buildCreateTable(m);
    expect(out).toContain("CHECK (age >= 0)");
  });
});

describe("create-table-generator buildDropTable", () => {
  it("emits DROP TABLE IF EXISTS for MySQL", () => {
    const m = emptyModel("users", "mysql");
    expect(buildDropTable(m)).toBe("DROP TABLE IF EXISTS `users`;");
  });
  it("emits DROP TABLE IF EXISTS for PostgreSQL", () => {
    const m = emptyModel("users", "postgresql");
    expect(buildDropTable(m)).toBe('DROP TABLE IF EXISTS "users";');
  });
  it("emits DROP TABLE IF EXISTS for SQL Server", () => {
    const m = emptyModel("users", "sqlserver");
    expect(buildDropTable(m)).toBe("DROP TABLE IF EXISTS [users];");
  });
});

describe("create-table-generator buildSeedInserts", () => {
  it("generates N INSERT statements", () => {
    const m = emptyModel("users", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false },
      { id: "c2", name: "name", type: "varchar", nullable: false },
    ]);
    const out = buildSeedInserts(m, 3);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toContain("INSERT INTO `users` (`id`, `name`) VALUES (1, 'seed_1');");
    expect(out).toContain("INSERT INTO `users` (`id`, `name`) VALUES (3, 'seed_3');");
  });
  it("respects explicit default values", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "n", type: "int", nullable: false, defaultValue: "99" },
    ]);
    expect(buildSeedInserts(m, 1)).toContain("VALUES (99)");
  });
  it("emits NULL for nullable columns without default", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "n", type: "int", nullable: true },
    ]);
    expect(buildSeedInserts(m, 1)).toContain("VALUES (NULL)");
  });
  it("emits enum values cycling through", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "r", type: "enum", nullable: false, enumValues: ["a", "b"] },
    ]);
    const out = buildSeedInserts(m, 4);
    expect(out).toContain("VALUES ('a');");
    expect(out).toContain("VALUES ('b');");
  });
  it("returns empty string for zero columns or zero count", () => {
    expect(buildSeedInserts(emptyModel("t", "mysql"), 3)).toBe("");
    expect(buildSeedInserts(emptyModel("t", "mysql", [{ id: "c", name: "x", type: "int", nullable: false }]), 0)).toBe("");
  });
  it("generateSeedValue produces date strings for DATE type", () => {
    const col: ColumnDef = { id: "c", name: "d", type: "date", nullable: false };
    expect(generateSeedValue(col, 0, "mysql")).toMatch(/^'\d{4}-\d{2}-\d{2}'$/);
  });
});

describe("create-table-generator buildDdl (combined)", () => {
  it("combines DROP + CREATE + seeds", () => {
    const m = PRESET_MODELS[0].model;
    const out = buildDdl(m, 2);
    expect(out.full).toContain("DROP TABLE IF EXISTS `users`;");
    expect(out.full).toContain("CREATE TABLE IF NOT EXISTS `users` (");
    expect(out.full).toContain("INSERT INTO `users`");
    expect(out.dropTable).toContain("DROP TABLE");
    expect(out.seedInserts).toContain("INSERT INTO");
  });
  it("exposes createTable separately", () => {
    const m = PRESET_MODELS[1].model;
    const out = buildDdl(m, 0);
    expect(out.createTable).toContain("CREATE TABLE");
    expect(out.seedInserts).toBe("");
  });
});

describe("create-table-generator CSV inference", () => {
  it("parseCsv handles quoted commas", () => {
    const rows = parseCsv('a,b\n"hello, world",1\nx,2');
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe("hello, world");
    expect(rows[1][1]).toBe("1");
  });
  it("parseCsv handles escaped quotes", () => {
    const rows = parseCsv('"a""b",c');
    expect(rows[0][0]).toBe('a"b');
    expect(rows[0][1]).toBe("c");
  });
  it("inferType detects integer", () => {
    expect(inferType(["100000", "200000", "300000"])).toBe("int");
    expect(inferType(["1", "200000"])).toBe("int");
  });
  it("inferType detects bigint for very large ints", () => {
    expect(inferType(["1", "9999999999"])).toBe("bigint");
  });
  it("inferType detects boolean", () => {
    expect(inferType(["true", "false", "1", "0"])).toBe("boolean");
  });
  it("inferType detects decimal", () => {
    expect(inferType(["1.5", "2.0", "3.14"])).toBe("decimal");
  });
  it("inferType detects date", () => {
    expect(inferType(["2024-01-01", "2024-02-02"])).toBe("date");
  });
  it("inferType detects timestamp", () => {
    expect(inferType(["2024-01-01 10:30:00", "2024-02-02 11:00:00"])).toBe("timestamp");
  });
  it("inferType detects JSON", () => {
    expect(inferType(['{"a":1}', '{"b":2}'])).toBe("json");
  });
  it("inferType falls back to varchar", () => {
    expect(inferType(["hello", "world"])).toBe("varchar");
  });
  it("inferType returns varchar for empty values", () => {
    expect(inferType([])).toBe("varchar");
    expect(inferType(["", ""])).toBe("varchar");
  });
  it("detectMaxLength picks the next bucket up", () => {
    expect(detectMaxLength(["a", "bb", "ccc"])).toBe(50);
    expect(detectMaxLength(["x".repeat(200)])).toBe(255);
  });
  it("inferFromCsv produces ColumnDef array", () => {
    const csv = "id,name,active\n100000,alice,true\n200000,bob,false";
    const cols = inferFromCsv(csv, "mysql");
    expect(cols).toHaveLength(3);
    expect(cols[0].name).toBe("id");
    expect(cols[0].type).toBe("int");
    expect(cols[1].name).toBe("name");
    expect(cols[1].type).toBe("varchar");
    expect(cols[2].name).toBe("active");
    expect(cols[2].type).toBe("boolean");
    expect(cols[1].length).toBeGreaterThan(0);
  });
  it("inferFromCsv returns empty for empty input", () => {
    expect(inferFromCsv("", "mysql")).toEqual([]);
  });
  it("inferFromJson produces ColumnDef array from JSON array", () => {
    const json = JSON.stringify([
      { id: 100000, name: "alice", score: 1.5 },
      { id: 200000, name: "bob", score: 2.5 },
    ]);
    const cols = inferFromJson(json, "postgresql");
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.name)).toEqual(["id", "name", "score"]);
    expect(cols[0].type).toBe("int");
    expect(cols[1].type).toBe("varchar");
    expect(cols[2].type).toBe("decimal");
  });
  it("inferFromJson returns empty for invalid JSON", () => {
    expect(inferFromJson("not json", "mysql")).toEqual([]);
  });
  it("inferFromJson returns empty for non-array", () => {
    expect(inferFromJson('{"a":1}', "mysql")).toEqual([]);
  });
  it("inferFromJson handles missing keys across objects", () => {
    const json = JSON.stringify([
      { a: 1, b: 2 },
      { a: 3, c: 4 },
    ]);
    const cols = inferFromJson(json, "mysql");
    expect(cols.map((c) => c.name)).toEqual(["a", "b", "c"]);
  });
});

describe("create-table-generator validateModel", () => {
  it("flags empty table name", () => {
    const issues = validateModel(emptyModel("", "mysql", [{ id: "c1", name: "x", type: "int", nullable: false }]));
    expect(issues.some((i) => i.message.includes("Table name"))).toBe(true);
  });
  it("flags empty columns", () => {
    const issues = validateModel(emptyModel("t", "mysql"));
    expect(issues.some((i) => i.message.includes("At least one column"))).toBe(true);
  });
  it("flags duplicate column names", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "email", type: "varchar", nullable: true },
      { id: "c2", name: "email", type: "varchar", nullable: true },
    ]);
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("Duplicate column"))).toBe(true);
  });
  it("flags auto-increment on non-integer type", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "id", type: "varchar", nullable: false, autoIncrement: true },
    ]);
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("auto-increment requires"))).toBe(true);
  });
  it("flags ENUM without values", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "r", type: "enum", nullable: true, enumValues: [] },
    ]);
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("ENUM requires"))).toBe(true);
  });
  it("flags nullable PK column", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: true },
    ]);
    m.primaryKey = ["c1"];
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("must be NOT NULL"))).toBe(true);
  });
  it("flags FK with mismatched column counts", () => {
    const m = emptyModel("t", "mysql", [
      { id: "c1", name: "id", type: "int", nullable: false },
    ]);
    m.foreignKeys = [{ id: "f1", columns: ["c1"], refTable: "p", refColumns: ["x", "y"] }];
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("mismatch"))).toBe(true);
  });
  it("flags CHECK with empty expression", () => {
    const m = emptyModel("t", "mysql", [{ id: "c1", name: "x", type: "int", nullable: true }]);
    m.checks = [{ id: "ck1", expression: "" }];
    const issues = validateModel(m);
    expect(issues.some((i) => i.message.includes("CHECK") && i.message.includes("required"))).toBe(true);
  });
  it("warns about WITHOUT ROWID on non-SQLite", () => {
    const m = emptyModel("t", "mysql", [{ id: "c1", name: "x", type: "int", nullable: false }]);
    m.options = { ifNotExists: false, withoutRowid: true };
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("WITHOUT ROWID"))).toBe(true);
  });
  it("warns about ENGINE on non-MySQL", () => {
    const m = emptyModel("t", "postgresql", [{ id: "c1", name: "x", type: "int", nullable: false }]);
    m.options = { ifNotExists: false, engine: "InnoDB" };
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("ENGINE"))).toBe(true);
  });
  it("passes a valid preset model", () => {
    const issues = validateModel(PRESET_MODELS[0].model);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});

describe("create-table-generator presets", () => {
  it("has 3 presets", () => {
    expect(PRESET_MODELS).toHaveLength(3);
  });
  it("preset 0 is MySQL users with ENUM", () => {
    expect(PRESET_MODELS[0].model.dialect).toBe("mysql");
    expect(PRESET_MODELS[0].model.name).toBe("users");
    expect(PRESET_MODELS[0].model.columns.some((c) => c.type === "enum")).toBe(true);
  });
  it("preset 1 is PostgreSQL posts with FK", () => {
    expect(PRESET_MODELS[1].model.dialect).toBe("postgresql");
    expect(PRESET_MODELS[1].model.foreignKeys.length).toBeGreaterThan(0);
  });
  it("preset 2 is SQLite composite PK WITHOUT ROWID", () => {
    expect(PRESET_MODELS[2].model.dialect).toBe("sqlite");
    expect(PRESET_MODELS[2].model.primaryKey.length).toBe(2);
    expect(PRESET_MODELS[2].model.options.withoutRowid).toBe(true);
  });
  it("each preset produces valid DDL", () => {
    for (const p of PRESET_MODELS) {
      const ddl = buildCreateTable(p.model);
      expect(ddl).toContain("CREATE TABLE");
      expect(ddl.length).toBeGreaterThan(50);
    }
  });
});

describe("create-table-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, tableName: "users", dialect: "mysql", columnCount: 3, fkCount: 0, indexCount: 0 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].tableName).toBe("users");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, tableName: `t${i}`, dialect: "mysql", columnCount: 1, fkCount: 0, indexCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, tableName: "x", dialect: "mysql", columnCount: 1, fkCount: 0, indexCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("keeps most recent first", () => {
    saveHistory({ ts: 1, tableName: "old", dialect: "mysql", columnCount: 1, fkCount: 0, indexCount: 0 });
    saveHistory({ ts: 2, tableName: "new", dialect: "mysql", columnCount: 1, fkCount: 0, indexCount: 0 });
    expect(loadHistory()[0].tableName).toBe("new");
  });
});

describe("create-table-generator shareable URL", () => {
  it("encodes and decodes a model", () => {
    const m = PRESET_MODELS[0].model;
    const enc = encodeState(m);
    const dec = decodeState(enc);
    expect(dec).not.toBeNull();
    expect(dec!.name).toBe(m.name);
    expect(dec!.columns.length).toBe(m.columns.length);
  });
  it("decodeState returns null for invalid input", () => {
    expect(decodeState("not-valid-base64!!!")).toBeNull();
  });
  it("decodeState returns null for non-object", () => {
    // Encode a JSON string that's not a TableModel
    expect(decodeState(encodeState(JSON.stringify("foo") as unknown as TableModel))).toBeNull();
  });
  it("buildShareUrl produces a hash fragment", () => {
    const m = PRESET_MODELS[0].model;
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(m);
    expect(url).toContain("m=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips a model", () => {
    const m = PRESET_MODELS[0].model;
    const enc = encodeState(m);
    const parsed = parseShareUrl(`#m=${enc}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe(m.name);
    expect(parsed!.dialect).toBe(m.dialect);
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("parseShareUrl returns null when m param missing", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});

describe("create-table-generator newId", () => {
  it("produces unique ids with the prefix", () => {
    const a = newId("col");
    const b = newId("col");
    expect(a.startsWith("col_")).toBe(true);
    expect(b.startsWith("col_")).toBe(true);
    expect(a).not.toBe(b);
  });
});

// Suppress unused-import lint
export type _Unused = Dialect;
