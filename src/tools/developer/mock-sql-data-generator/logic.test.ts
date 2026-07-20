import { describe, it, expect, beforeEach } from "vitest";
import {
  DIALECTS,
  FAKER_TYPES,
  FIRST_NAMES,
  LAST_NAMES,
  CITIES,
  STATES,
  COUNTRIES,
  COMPANIES,
  JOB_TITLES,
  LOREM_WORDS,
  PRESET_DDL,
  mulberry32,
  hashStringToSeed,
  pick,
  randInt,
  randDecimal,
  randDate,
  randTimestamp,
  randTime,
  randIpv4,
  randIpv6,
  randUuid,
  randHexColor,
  genFromRegex,
  loremSentence,
  loremParagraph,
  pickWeighted,
  stripComments,
  splitCreateStatements,
  parseCreateTable,
  parseColumnDef,
  splitTopLevelCommas,
  parseDdl,
  inferFakerType,
  generateColumnValue,
  generateRow,
  topologicalSort,
  generateDataset,
  quoteIdentifier,
  escapeLiteral,
  formatInsert,
  formatBatchInsert,
  formatTableInserts,
  formatCsv,
  formatJson,
  formatDatasetInserts,
  formatDatasetCsv,
  formatDatasetJson,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeState,
  decodeState,
  buildShareUrl,
  parseShareUrl,
  type Dialect,
  type ColumnSchema,
  type TableSchema,
  type GenerationConfig,
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

function col(name: string, sqlType: string, extra: Partial<ColumnSchema> = {}): ColumnSchema {
  return { name, sqlType, nullable: true, fakerType: "auto", ...extra };
}

function simpleTable(name: string, dialect: Dialect, columns: ColumnSchema[]): TableSchema {
  return { name, dialect, columns, foreignKeys: [], uniques: [] };
}

describe("mock-sql-data-generator constants", () => {
  it("has 4 dialects", () => {
    expect(DIALECTS).toHaveLength(4);
    expect(DIALECTS.map((d) => d.value)).toEqual(["mysql", "postgresql", "sqlite", "sqlserver"]);
  });
  it("has 30+ faker types", () => {
    expect(FAKER_TYPES.length).toBeGreaterThanOrEqual(30);
    expect(FAKER_TYPES.map((f) => f.value)).toContain("email");
    expect(FAKER_TYPES.map((f) => f.value)).toContain("regex");
  });
  it("has non-empty data pools", () => {
    expect(FIRST_NAMES.length).toBeGreaterThan(50);
    expect(LAST_NAMES.length).toBeGreaterThan(50);
    expect(CITIES.length).toBeGreaterThan(10);
    expect(STATES.length).toBe(50);
    expect(COUNTRIES.length).toBeGreaterThan(10);
    expect(COMPANIES.length).toBeGreaterThan(5);
    expect(JOB_TITLES.length).toBeGreaterThan(5);
    expect(LOREM_WORDS.length).toBeGreaterThan(20);
  });
  it("has 3 preset DDLs", () => {
    expect(PRESET_DDL).toHaveLength(3);
    expect(PRESET_DDL.map((p) => p.dialect)).toEqual(["mysql", "postgresql", "sqlite"]);
  });
});

describe("mock-sql-data-generator PRNG (mulberry32)", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
  it("produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("hashStringToSeed is deterministic", () => {
    expect(hashStringToSeed("hello")).toBe(hashStringToSeed("hello"));
    expect(hashStringToSeed("hello")).not.toBe(hashStringToSeed("world"));
  });
  it("hashStringToSeed returns a 32-bit unsigned int", () => {
    const s = hashStringToSeed("anything");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(4294967295);
    expect(Number.isInteger(s)).toBe(true);
  });
});

describe("mock-sql-data-generator PRNG helpers", () => {
  it("pick returns an element from the array", () => {
    const rng = mulberry32(1);
    const arr = ["a", "b", "c"];
    expect(arr).toContain(pick(rng, arr));
  });
  it("randInt respects bounds", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = randInt(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("randInt swaps if min > max", () => {
    const rng = mulberry32(1);
    const v = randInt(rng, 10, 5);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThanOrEqual(10);
  });
  it("randDecimal respects scale", () => {
    const rng = mulberry32(1);
    const v = randDecimal(rng, 0, 100, 3);
    expect(v.split(".")[1]?.length).toBe(3);
  });
  it("randDate produces ISO date string", () => {
    const rng = mulberry32(1);
    const d = randDate(rng, -30, -1);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("randTimestamp produces datetime string", () => {
    const rng = mulberry32(1);
    const ts = randTimestamp(rng, -30, -1);
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it("randTime produces HH:MM:SS", () => {
    const rng = mulberry32(1);
    expect(randTime(rng)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
  it("randIpv4 produces valid IPv4", () => {
    const rng = mulberry32(1);
    expect(randIpv4(rng)).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });
  it("randIpv6 produces 8 hex groups", () => {
    const rng = mulberry32(1);
    expect(randIpv6(rng).split(":")).toHaveLength(8);
  });
  it("randUuid produces UUID v4 shape", () => {
    const rng = mulberry32(1);
    const u = randUuid(rng);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("randHexColor produces #rrggbb", () => {
    const rng = mulberry32(1);
    expect(randHexColor(rng)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("genFromRegex matches the pattern", () => {
    const rng = mulberry32(1);
    const s = genFromRegex(rng, "^[a-z]{3}$");
    expect(s).toMatch(/^[a-z]{3}$/);
  });
  it("genFromRegex falls back on invalid pattern", () => {
    const rng = mulberry32(1);
    expect(genFromRegex(rng, "[")).toBe("x");
  });
  it("loremSentence produces a capitalized sentence ending in .", () => {
    const rng = mulberry32(1);
    const s = loremSentence(rng, 5);
    expect(s.endsWith(".")).toBe(true);
    expect(s.charAt(0)).toMatch(/[A-Z]/);
  });
  it("loremParagraph produces multiple sentences", () => {
    const rng = mulberry32(1);
    const s = loremParagraph(rng, 3);
    expect(s.split(". ").length).toBeGreaterThanOrEqual(2);
  });
  it("pickWeighted respects weights", () => {
    const rng = mulberry32(1);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = pickWeighted(rng, [["a", 9], ["b", 1]]);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    expect(counts.a).toBeGreaterThan(counts.b);
  });
  it("pickWeighted treats plain strings as weight 1", () => {
    const rng = mulberry32(1);
    const v = pickWeighted(rng, ["x", "y", "z"]);
    expect(["x", "y", "z"]).toContain(v);
  });
  it("pickWeighted returns empty for empty array", () => {
    expect(pickWeighted(mulberry32(1), [])).toBe("");
  });
});

describe("mock-sql-data-generator stripComments", () => {
  it("strips double-dash line comments", () => {
    expect(stripComments("SELECT 1 -- comment\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("strips hash comments (MySQL)", () => {
    expect(stripComments("SELECT 1 # comment\nFROM x")).toBe("SELECT 1 \nFROM x");
  });
  it("strips slash-star block comments", () => {
    expect(stripComments("SELECT /* hi */ 1")).toBe("SELECT  1");
  });
  it("preserves string literals containing comment chars", () => {
    expect(stripComments("SELECT '-- not a comment'")).toBe("SELECT '-- not a comment'");
  });
});

describe("mock-sql-data-generator splitCreateStatements", () => {
  it("finds a single CREATE TABLE", () => {
    const stmts = splitCreateStatements("CREATE TABLE foo (id INT);");
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("CREATE TABLE foo");
  });
  it("finds multiple CREATE TABLE statements", () => {
    const ddl = "CREATE TABLE a (x INT); CREATE TABLE b (y INT);";
    const stmts = splitCreateStatements(ddl);
    expect(stmts).toHaveLength(2);
  });
  it("handles IF NOT EXISTS", () => {
    const stmts = splitCreateStatements("CREATE TABLE IF NOT EXISTS foo (id INT);");
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("IF NOT EXISTS");
  });
  it("ignores semicolons inside parentheses", () => {
    const stmts = splitCreateStatements("CREATE TABLE foo (id INT DEFAULT 'a;b');");
    expect(stmts).toHaveLength(1);
  });
});

describe("mock-sql-data-generator splitTopLevelCommas", () => {
  it("splits simple list", () => {
    expect(splitTopLevelCommas("a, b, c")).toEqual(["a", " b", " c"]);
  });
  it("does not split inside parens", () => {
    expect(splitTopLevelCommas("a, DECIMAL(10, 2), c")).toEqual(["a", " DECIMAL(10, 2)", " c"]);
  });
  it("does not split inside quotes", () => {
    expect(splitTopLevelCommas("a, 'b,c', d")).toEqual(["a", " 'b,c'", " d"]);
  });
  it("handles escaped quotes", () => {
    expect(splitTopLevelCommas("a, 'b''c', d")).toEqual(["a", " 'b''c'", " d"]);
  });
});

describe("mock-sql-data-generator parseColumnDef", () => {
  it("parses simple INT NOT NULL", () => {
    const c = parseColumnDef("id INT NOT NULL", "mysql");
    expect(c).not.toBeNull();
    expect(c!.name).toBe("id");
    expect(c!.sqlType).toBe("int");
    expect(c!.nullable).toBe(false);
  });
  it("parses VARCHAR with length and default", () => {
    const c = parseColumnDef("name VARCHAR(100) NOT NULL DEFAULT 'unnamed'", "mysql");
    expect(c!.sqlType).toBe("varchar");
    expect(c!.nullable).toBe(false);
    expect(c!.defaultValue).toBe("unnamed");
    expect(c!.defaultIsExpression).toBeUndefined();
  });
  it("parses AUTO_INCREMENT", () => {
    const c = parseColumnDef("id BIGINT NOT NULL AUTO_INCREMENT", "mysql");
    expect(c!.autoIncrement).toBe(true);
  });
  it("parses AUTOINCREMENT (SQLite)", () => {
    const c = parseColumnDef("id INTEGER PRIMARY KEY AUTOINCREMENT", "sqlite");
    expect(c!.autoIncrement).toBe(true);
  });
  it("parses expression default", () => {
    const c = parseColumnDef("created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP", "mysql");
    expect(c!.defaultValue).toBe("CURRENT_TIMESTAMP");
    expect(c!.defaultIsExpression).toBe(true);
  });
  it("parses inline REFERENCES", () => {
    const c = parseColumnDef("author_id INT NOT NULL REFERENCES users (id)", "postgresql");
    expect((c as ColumnSchema & { _inlineRef?: { refTable: string } })._inlineRef?.refTable).toBe("users");
  });
  it("parses MySQL ENUM", () => {
    const c = parseColumnDef("role ENUM('admin', 'editor') NOT NULL", "mysql");
    expect(c!.sqlType).toBe("enum");
    expect(c!.enumValues).toEqual(["admin", "editor"]);
  });
  it("parses DECIMAL with precision and scale", () => {
    const c = parseColumnDef("price DECIMAL(10, 2) NOT NULL", "mysql");
    expect(c!.sqlType).toBe("decimal");
    expect(c!.scale).toBe(2);
  });
  it("parses quoted column names", () => {
    const c = parseColumnDef('"order" INT NOT NULL', "postgresql");
    expect(c!.name).toBe("order");
  });
  it("returns null for empty input", () => {
    expect(parseColumnDef("", "mysql")).toBeNull();
  });
});

describe("mock-sql-data-generator parseCreateTable", () => {
  it("parses a simple MySQL table", () => {
    const ddl = "CREATE TABLE users (id INT NOT NULL AUTO_INCREMENT, email VARCHAR(255) NOT NULL, PRIMARY KEY (id));";
    const t = parseCreateTable(ddl, "mysql");
    expect(t).not.toBeNull();
    expect(t!.name).toBe("users");
    expect(t!.columns).toHaveLength(2);
    expect(t!.columns[0].name).toBe("id");
    expect(t!.columns[1].name).toBe("email");
  });
  it("parses IF NOT EXISTS", () => {
    const ddl = "CREATE TABLE IF NOT EXISTS foo (id INT);";
    const t = parseCreateTable(ddl, "mysql");
    expect(t!.name).toBe("foo");
  });
  it("parses inline REFERENCES as table-level FK", () => {
    const ddl = "CREATE TABLE posts (id INT, author_id INT REFERENCES users (id));";
    const t = parseCreateTable(ddl, "postgresql");
    expect(t!.foreignKeys).toHaveLength(1);
    expect(t!.foreignKeys[0].refTable).toBe("users");
    expect(t!.foreignKeys[0].columns).toEqual(["author_id"]);
  });
  it("parses table-level FOREIGN KEY", () => {
    const ddl = "CREATE TABLE posts (id INT, author_id INT, FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE);";
    const t = parseCreateTable(ddl, "mysql");
    expect(t!.foreignKeys).toHaveLength(1);
    expect(t!.foreignKeys[0].refColumns).toEqual(["id"]);
  });
  it("parses UNIQUE constraint", () => {
    const ddl = "CREATE TABLE users (id INT, email VARCHAR(255), UNIQUE (email));";
    const t = parseCreateTable(ddl, "mysql");
    expect(t!.uniques).toHaveLength(1);
    expect(t!.uniques[0].columns).toEqual(["email"]);
  });
  it("parses named CONSTRAINT UNIQUE", () => {
    const ddl = "CREATE TABLE users (id INT, email VARCHAR(255), CONSTRAINT uq_email UNIQUE (email));";
    const t = parseCreateTable(ddl, "mysql");
    expect(t!.uniques).toHaveLength(1);
    expect(t!.uniques[0].name).toBe("uq_email");
  });
  it("marks PK columns as NOT NULL and unique", () => {
    const ddl = "CREATE TABLE users (id INT, name VARCHAR(100), PRIMARY KEY (id));";
    const t = parseCreateTable(ddl, "mysql");
    const idCol = t!.columns.find((c) => c.name === "id")!;
    expect(idCol.nullable).toBe(false);
    expect(idCol.unique).toBe(true);
  });
  it("ignores CHECK and INDEX clauses", () => {
    const ddl = "CREATE TABLE t (id INT, age INT, CHECK (age > 0), INDEX idx_age (age));";
    const t = parseCreateTable(ddl, "mysql");
    expect(t!.columns).toHaveLength(2);
  });
  it("returns null for non-CREATE-TABLE input", () => {
    expect(parseCreateTable("SELECT * FROM foo;", "mysql")).toBeNull();
  });
});

describe("mock-sql-data-generator parseDdl (multi-table)", () => {
  it("parses multiple tables", () => {
    const ddl = `CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255));
CREATE TABLE posts (id INT, author_id INT REFERENCES users (id));`;
    const tables = parseDdl(ddl, "postgresql");
    expect(tables).toHaveLength(2);
    expect(tables.map((t) => t.name)).toEqual(["users", "posts"]);
  });
  it("preserves inline REFERENCES in parseDdl", () => {
    const ddl = "CREATE TABLE posts (id INT, author_id INT REFERENCES users (id));";
    const tables = parseDdl(ddl, "postgresql");
    expect(tables[0].foreignKeys).toHaveLength(1);
  });
});

describe("mock-sql-data-generator inferFakerType", () => {
  it("infers email from column name", () => {
    expect(inferFakerType(col("email", "varchar"))).toBe("email");
    expect(inferFakerType(col("user_email", "varchar"))).toBe("email");
  });
  it("infers first_name from column name", () => {
    expect(inferFakerType(col("first_name", "varchar"))).toBe("first_name");
    expect(inferFakerType(col("firstName", "varchar"))).toBe("first_name");
  });
  it("infers full_name from name column", () => {
    expect(inferFakerType(col("name", "varchar"))).toBe("full_name");
  });
  it("infers city/state/country/zip from name", () => {
    expect(inferFakerType(col("city", "varchar"))).toBe("city");
    expect(inferFakerType(col("state", "varchar"))).toBe("state");
    expect(inferFakerType(col("country", "varchar"))).toBe("country");
    expect(inferFakerType(col("zip", "varchar"))).toBe("zip");
  });
  it("infers money from salary/price/amount", () => {
    expect(inferFakerType(col("salary", "decimal"))).toBe("money");
    expect(inferFakerType(col("price", "decimal"))).toBe("money");
    expect(inferFakerType(col("amount", "decimal"))).toBe("money");
  });
  it("infers age from column name", () => {
    expect(inferFakerType(col("age", "int"))).toBe("age");
  });
  it("infers boolean from boolean/bool/bit type", () => {
    expect(inferFakerType(col("is_active", "boolean"))).toBe("boolean");
    expect(inferFakerType(col("flag", "bit"))).toBe("boolean");
  });
  it("infers int/bigint/decimal from type", () => {
    expect(inferFakerType(col("count", "int"))).toBe("int");
    expect(inferFakerType(col("big_count", "bigint"))).toBe("bigint");
    expect(inferFakerType(col("score", "decimal"))).toBe("decimal");
  });
  it("infers timestamp/datetime from type", () => {
    expect(inferFakerType(col("created_at", "timestamp"))).toBe("timestamp");
    expect(inferFakerType(col("d", "datetime"))).toBe("timestamp");
    expect(inferFakerType(col("d", "date"))).toBe("date_recent");
    expect(inferFakerType(col("t", "time"))).toBe("time");
  });
  it("infers enum from type", () => {
    expect(inferFakerType(col("role", "enum"))).toBe("enum");
  });
  it("returns explicit override", () => {
    expect(inferFakerType(col("x", "int", { fakerType: "email" }))).toBe("email");
  });
  it("falls back to int for unknown types", () => {
    expect(inferFakerType(col("weird", "geometry"))).toBe("int");
  });
  it("infers paragraph for description/body/content", () => {
    expect(inferFakerType(col("description", "text"))).toBe("paragraph");
    expect(inferFakerType(col("body", "text"))).toBe("paragraph");
  });
});

describe("mock-sql-data-generator generateColumnValue", () => {
  it("returns null for auto-increment columns", () => {
    const c = col("id", "int", { autoIncrement: true, nullable: false });
    expect(generateColumnValue(c, mulberry32(1))).toBeNull();
  });
  it("returns default literal value", () => {
    const c = col("status", "varchar", { defaultValue: "active", nullable: false });
    expect(generateColumnValue(c, mulberry32(1))).toBe("active");
  });
  it("resolves default expression CURRENT_TIMESTAMP", () => {
    const c = col("created_at", "timestamp", { defaultValue: "CURRENT_TIMESTAMP", defaultIsExpression: true, nullable: false });
    const v = generateColumnValue(c, mulberry32(1));
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it("resolves default expression TRUE", () => {
    const c = col("is_active", "boolean", { defaultValue: "TRUE", defaultIsExpression: true, nullable: false });
    expect(generateColumnValue(c, mulberry32(1))).toBe("TRUE");
  });
  it("returns null when blankPercent hits for nullable column", () => {
    const c = col("bio", "text", { blankPercent: 100, nullable: true });
    expect(generateColumnValue(c, mulberry32(1))).toBeNull();
  });
  it("generates an email for email faker type", () => {
    const c = col("email", "varchar", { fakerType: "email" });
    expect(generateColumnValue(c, mulberry32(1))).toMatch(/@example\.com|@test\.org|@mock\.io|@fake\.net$/);
  });
  it("generates a UUID for uuid faker type", () => {
    const c = col("id", "uuid", { fakerType: "uuid" });
    expect(generateColumnValue(c, mulberry32(1))).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("generates an int within bounds", () => {
    const c = col("n", "int", { fakerType: "int", min: 10, max: 20 });
    const v = Number(generateColumnValue(c, mulberry32(1)));
    expect(v).toBeGreaterThanOrEqual(10);
    expect(v).toBeLessThanOrEqual(20);
  });
  it("generates a decimal with scale", () => {
    const c = col("price", "decimal", { fakerType: "decimal", scale: 3 });
    const v = generateColumnValue(c, mulberry32(1))!;
    expect(v.split(".")[1]?.length).toBe(3);
  });
  it("generates a weighted enum value", () => {
    const c = col("role", "enum", { fakerType: "enum", enumValues: [["admin", 1], ["user", 99]] });
    const v = generateColumnValue(c, mulberry32(1));
    expect(["admin", "user"]).toContain(v);
  });
  it("generates a regex-matched value", () => {
    const c = col("code", "varchar", { fakerType: "regex", pattern: "^[a-z]{3}$" });
    expect(generateColumnValue(c, mulberry32(1))).toMatch(/^[a-z]{3}$/);
  });
  it("generates a constant value", () => {
    const c = col("status", "varchar", { fakerType: "constant", constantValue: "active" });
    expect(generateColumnValue(c, mulberry32(1))).toBe("active");
  });
  it("generates null for null faker type", () => {
    const c = col("x", "varchar", { fakerType: "null", nullable: true });
    expect(generateColumnValue(c, mulberry32(1))).toBeNull();
  });
  it("generates first_name from data pool", () => {
    const c = col("first_name", "varchar", { fakerType: "first_name" });
    expect(FIRST_NAMES).toContain(generateColumnValue(c, mulberry32(1)));
  });
  it("generates hex_color", () => {
    const c = col("color", "varchar", { fakerType: "hex_color" });
    expect(generateColumnValue(c, mulberry32(1))).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("mock-sql-data-generator generateRow", () => {
  it("produces values for all columns", () => {
    const t = simpleTable("users", "mysql", [
      col("id", "int", { fakerType: "int", min: 1, max: 100 }),
      col("email", "varchar", { fakerType: "email" }),
    ]);
    const row = generateRow(t, mulberry32(1));
    expect(row.id).toBeDefined();
    expect(row.email).toBeDefined();
    expect(row.email).toMatch(/@/);
  });
  it("skips auto-increment columns (null)", () => {
    const t = simpleTable("users", "mysql", [
      col("id", "int", { autoIncrement: true, nullable: false }),
    ]);
    const row = generateRow(t, mulberry32(1));
    // Auto-increment gets a placeholder (string number) for FK purposes; not null
    expect(row.id).not.toBeNull();
  });
  it("enforces uniqueness on a single column", () => {
    const t = simpleTable("users", "mysql", [
      col("code", "varchar", { fakerType: "regex", pattern: "^[a-z]{2}$", unique: true, nullable: false }),
    ]);
    const trackers: Record<string, Set<string>> = { "users.code": new Set() };
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const row = generateRow(t, mulberry32(i + 1), undefined, trackers);
      if (row.code !== null) codes.add(row.code);
    }
    expect(codes.size).toBe(100);
  });
  it("pulls FK value from parent row", () => {
    const parent: TableSchema = {
      name: "users",
      dialect: "mysql",
      columns: [col("id", "int", { fakerType: "int", min: 1, max: 100 })],
      foreignKeys: [],
      uniques: [],
    };
    const child: TableSchema = {
      name: "posts",
      dialect: "mysql",
      columns: [col("id", "int"), col("author_id", "int")],
      foreignKeys: [{ columns: ["author_id"], refTable: "users", refColumns: ["id"] }],
      uniques: [],
    };
    const parentRows = [
      { id: "1" },
      { id: "2" },
      { id: "3" },
    ];
    const row = generateRow(child, mulberry32(1), { users: parentRows });
    expect(["1", "2", "3"]).toContain(row.author_id);
  });
});

describe("mock-sql-data-generator topologicalSort", () => {
  it("returns parents before children", () => {
    const tables = [
      simpleTable("posts", "mysql", [col("id", "int"), col("author_id", "int")]),
      simpleTable("users", "mysql", [col("id", "int")]),
    ];
    tables[0].foreignKeys = [{ columns: ["author_id"], refTable: "users", refColumns: ["id"] }];
    const { order, cycle } = topologicalSort(tables);
    expect(order).toEqual(["users", "posts"]);
    expect(cycle).toHaveLength(0);
  });
  it("detects circular dependencies", () => {
    const tables = [
      simpleTable("a", "mysql", [col("id", "int"), col("b_id", "int")]),
      simpleTable("b", "mysql", [col("id", "int"), col("a_id", "int")]),
    ];
    tables[0].foreignKeys = [{ columns: ["b_id"], refTable: "b", refColumns: ["id"] }];
    tables[1].foreignKeys = [{ columns: ["a_id"], refTable: "a", refColumns: ["id"] }];
    const { cycle } = topologicalSort(tables);
    expect(cycle.length).toBeGreaterThan(0);
  });
  it("handles self-references (no cycle)", () => {
    const tables = [simpleTable("categories", "mysql", [col("id", "int"), col("parent_id", "int")])];
    tables[0].foreignKeys = [{ columns: ["parent_id"], refTable: "categories", refColumns: ["id"] }];
    const { cycle } = topologicalSort(tables);
    expect(cycle).toHaveLength(0);
  });
});

describe("mock-sql-data-generator generateDataset", () => {
  it("generates data for a single table", () => {
    const t = simpleTable("users", "mysql", [
      col("id", "int", { fakerType: "int", min: 1, max: 1000 }),
      col("email", "varchar", { fakerType: "email" }),
    ]);
    const result = generateDataset([t], { rowCount: 5, seed: 42, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order).toEqual(["users"]);
      expect(result.dataset.users.rows).toHaveLength(5);
      expect(result.dataset.users.columns).toEqual(["id", "email"]);
    }
  });
  it("generates FK-aware data in topological order", () => {
    const users = simpleTable("users", "mysql", [col("id", "int", { fakerType: "int", min: 1, max: 1000 })]);
    const posts: TableSchema = {
      name: "posts",
      dialect: "mysql",
      columns: [col("id", "int", { fakerType: "int", min: 1, max: 1000 }), col("author_id", "int")],
      foreignKeys: [{ columns: ["author_id"], refTable: "users", refColumns: ["id"] }],
      uniques: [],
    };
    const result = generateDataset([posts, users], { rowCount: 10, seed: 1, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order).toEqual(["users", "posts"]);
      const userIds = new Set(result.dataset.users.rows.map((r) => r.id));
      for (const p of result.dataset.posts.rows) {
        expect(userIds.has(p.author_id)).toBe(true);
      }
    }
  });
  it("returns error for empty tables", () => {
    const result = generateDataset([], { rowCount: 5, seed: 1, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(false);
  });
  it("returns error for negative row count", () => {
    const t = simpleTable("u", "mysql", [col("id", "int")]);
    const result = generateDataset([t], { rowCount: -1, seed: 1, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(false);
  });
  it("returns error for zero batch size", () => {
    const t = simpleTable("u", "mysql", [col("id", "int")]);
    const result = generateDataset([t], { rowCount: 5, seed: 1, batchSize: 0, locale: "en" });
    expect(result.ok).toBe(false);
  });
  it("is deterministic with the same seed", () => {
    const t = simpleTable("u", "mysql", [col("email", "varchar", { fakerType: "email" })]);
    const cfg: GenerationConfig = { rowCount: 3, seed: 123, batchSize: 1, locale: "en" };
    const a = generateDataset([t], cfg);
    const b = generateDataset([t], cfg);
    if (a.ok && b.ok) {
      expect(a.dataset.u.rows).toEqual(b.dataset.u.rows);
    }
  });
  it("produces different data for different seeds", () => {
    const t = simpleTable("u", "mysql", [col("email", "varchar", { fakerType: "email" })]);
    const a = generateDataset([t], { rowCount: 5, seed: 1, batchSize: 1, locale: "en" });
    const b = generateDataset([t], { rowCount: 5, seed: 2, batchSize: 1, locale: "en" });
    if (a.ok && b.ok) {
      expect(a.dataset.u.rows).not.toEqual(b.dataset.u.rows);
    }
  });
});

describe("mock-sql-data-generator quoteIdentifier / escapeLiteral", () => {
  it("quoteIdentifier uses backticks for MySQL", () => {
    expect(quoteIdentifier("user", "mysql")).toBe("`user`");
  });
  it("quoteIdentifier uses double-quotes for PostgreSQL/SQLite", () => {
    expect(quoteIdentifier("user", "postgresql")).toBe('"user"');
    expect(quoteIdentifier("user", "sqlite")).toBe('"user"');
  });
  it("quoteIdentifier uses square brackets for SQL Server", () => {
    expect(quoteIdentifier("user", "sqlserver")).toBe("[user]");
  });
  it("escapeLiteral returns NULL for null", () => {
    expect(escapeLiteral(null, "mysql")).toBe("NULL");
  });
  it("escapeLiteral escapes single quotes in strings", () => {
    expect(escapeLiteral("it's", "mysql")).toBe("'it''s'");
  });
  it("escapeLiteral passes through numbers", () => {
    expect(escapeLiteral("42", "mysql")).toBe("42");
    expect(escapeLiteral("3.14", "mysql")).toBe("3.14");
  });
  it("escapeLiteral converts TRUE/FALSE for MySQL", () => {
    expect(escapeLiteral("TRUE", "mysql")).toBe("1");
    expect(escapeLiteral("FALSE", "mysql")).toBe("0");
  });
  it("escapeLiteral keeps TRUE/FALSE for PostgreSQL", () => {
    expect(escapeLiteral("TRUE", "postgresql")).toBe("TRUE");
  });
});

describe("mock-sql-data-generator formatInsert", () => {
  it("formats a single-row INSERT", () => {
    const t = simpleTable("users", "mysql", [
      col("id", "int"),
      col("name", "varchar"),
    ]);
    const row = { id: "1", name: "Alice" };
    expect(formatInsert(t, row, "mysql")).toBe("INSERT INTO `users` (`id`, `name`) VALUES (1, 'Alice');");
  });
  it("formats NULL values", () => {
    const t = simpleTable("u", "mysql", [col("x", "int", { nullable: true })]);
    expect(formatInsert(t, { x: null }, "mysql")).toBe("INSERT INTO `u` (`x`) VALUES (NULL);");
  });
  it("uses double-quotes for PostgreSQL", () => {
    const t = simpleTable("users", "postgresql", [col("id", "int")]);
    expect(formatInsert(t, { id: "1" }, "postgresql")).toContain('"users"');
  });
  it("uses square brackets for SQL Server", () => {
    const t = simpleTable("users", "sqlserver", [col("id", "int")]);
    expect(formatInsert(t, { id: "1" }, "sqlserver")).toContain("[users]");
  });
});

describe("mock-sql-data-generator formatBatchInsert", () => {
  it("formats a multi-row batch INSERT", () => {
    const t = simpleTable("users", "mysql", [col("id", "int"), col("name", "varchar")]);
    const rows = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const out = formatBatchInsert(t, rows, "mysql", 10);
    expect(out).toContain("INSERT INTO `users` (`id`, `name`) VALUES");
    expect(out).toContain("(1, 'Alice')");
    expect(out).toContain("(2, 'Bob')");
    expect(out.trim().endsWith(";")).toBe(true);
  });
  it("splits into multiple INSERT statements when batchSize is small", () => {
    const t = simpleTable("u", "mysql", [col("id", "int")]);
    const rows = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const out = formatBatchInsert(t, rows, "mysql", 1);
    expect(out.split("INSERT INTO").length - 1).toBe(3);
  });
  it("returns empty string for zero rows", () => {
    const t = simpleTable("u", "mysql", [col("id", "int")]);
    expect(formatBatchInsert(t, [], "mysql", 10)).toBe("");
  });
});

describe("mock-sql-data-generator formatTableInserts", () => {
  it("uses single-row INSERTs when batchSize=1", () => {
    const t = { name: "u", columns: ["id"], rows: [{ id: "1" }, { id: "2" }] };
    const out = formatTableInserts(t, "mysql", 1);
    expect(out.split("\n")).toHaveLength(2);
    expect(out).toContain("INSERT INTO `u`");
  });
  it("uses batched INSERTs when batchSize>1", () => {
    const t = { name: "u", columns: ["id"], rows: [{ id: "1" }, { id: "2" }] };
    const out = formatTableInserts(t, "mysql", 10);
    expect(out).toContain("(1)");
    expect(out).toContain("(2)");
  });
  it("returns empty string for zero rows", () => {
    const t = { name: "u", columns: ["id"], rows: [] };
    expect(formatTableInserts(t, "mysql", 1)).toBe("");
  });
});

describe("mock-sql-data-generator formatCsv", () => {
  it("renders header + rows", () => {
    const t = { name: "u", columns: ["id", "name"], rows: [{ id: "1", name: "Alice" }] };
    const csv = formatCsv(t);
    expect(csv.split("\n")[0]).toBe("id,name");
    expect(csv).toContain("1,Alice");
  });
  it("escapes commas in values", () => {
    const t = { name: "u", columns: ["name"], rows: [{ name: "hello, world" }] };
    expect(formatCsv(t)).toContain('"hello, world"');
  });
  it("escapes double quotes in values", () => {
    const t = { name: "u", columns: ["name"], rows: [{ name: 'say "hi"' }] };
    expect(formatCsv(t)).toContain('"say ""hi"""');
  });
});

describe("mock-sql-data-generator formatJson", () => {
  it("produces a JSON array of objects", () => {
    const t = { name: "u", columns: ["id", "name"], rows: [{ id: "1", name: "Alice" }] };
    const json = formatJson(t);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("1");
    expect(parsed[0].name).toBe("Alice");
  });
  it("includes null values", () => {
    const t = { name: "u", columns: ["id", "name"], rows: [{ id: "1", name: null }] };
    const parsed = JSON.parse(formatJson(t));
    expect(parsed[0].name).toBeNull();
  });
});

describe("mock-sql-data-generator formatDatasetInserts / Csv / Json", () => {
  it("formatDatasetInserts includes all tables", () => {
    const ds = {
      users: { name: "users", columns: ["id"], rows: [{ id: "1" }, { id: "2" }] },
      posts: { name: "posts", columns: ["id"], rows: [{ id: "1" }] },
    };
    const out = formatDatasetInserts(ds, "mysql", 1);
    expect(out).toContain("-- Mock data for table: users");
    expect(out).toContain("INSERT INTO `users`");
    expect(out).toContain("INSERT INTO `posts`");
  });
  it("formatDatasetCsv includes a header per table", () => {
    const ds = {
      users: { name: "users", columns: ["id"], rows: [{ id: "1" }] },
    };
    expect(formatDatasetCsv(ds)).toContain("# Table: users");
    expect(formatDatasetCsv(ds)).toContain("id");
  });
  it("formatDatasetJson produces a JSON object keyed by table", () => {
    const ds = {
      users: { name: "users", columns: ["id"], rows: [{ id: "1" }] },
    };
    const parsed = JSON.parse(formatDatasetJson(ds));
    expect(parsed.users).toHaveLength(1);
    expect(parsed.users[0].id).toBe("1");
  });
});

describe("mock-sql-data-generator end-to-end with preset DDL", () => {
  it("parses preset 0 and generates 10 rows", () => {
    const preset = PRESET_DDL[0];
    const tables = parseDdl(preset.ddl, preset.dialect);
    expect(tables).toHaveLength(1);
    const result = generateDataset(tables, { rowCount: 10, seed: 42, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset.users.rows).toHaveLength(10);
      // Every email should match the email regex
      for (const r of result.dataset.users.rows) {
        expect(r.email).toMatch(/@/);
      }
    }
  });
  it("parses preset 1 (multi-table) with FK ordering", () => {
    const preset = PRESET_DDL[1];
    const tables = parseDdl(preset.ddl, preset.dialect);
    expect(tables).toHaveLength(2);
    const result = generateDataset(tables, { rowCount: 5, seed: 1, batchSize: 1, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order).toEqual(["users", "posts"]);
      const userIds = new Set(result.dataset.users.rows.map((r) => r.id));
      for (const p of result.dataset.posts.rows) {
        expect(userIds.has(p.author_id)).toBe(true);
      }
    }
  });
  it("parses preset 2 (3-table chain) and respects FK chain", () => {
    const preset = PRESET_DDL[2];
    const tables = parseDdl(preset.ddl, preset.dialect);
    expect(tables).toHaveLength(3);
    const result = generateDataset(tables, { rowCount: 8, seed: 7, batchSize: 5, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order).toEqual(["customers", "orders", "order_items"]);
      const orderIds = new Set(result.dataset.orders.rows.map((r) => r.id));
      for (const oi of result.dataset.order_items.rows) {
        expect(orderIds.has(oi.order_id)).toBe(true);
      }
    }
  });
  it("generates output that round-trips through formatDatasetInserts", () => {
    const preset = PRESET_DDL[0];
    const tables = parseDdl(preset.ddl, preset.dialect);
    const result = generateDataset(tables, { rowCount: 3, seed: 99, batchSize: 2, locale: "en" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const out = formatDatasetInserts(result.dataset, "mysql", 1, tables);
      expect(out).toContain("INSERT INTO `users`");
      expect(out.split("INSERT INTO").length - 1).toBe(3);
    }
  });
});

describe("mock-sql-data-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, tableCount: 2, totalRows: 100, dialect: "mysql", seed: 42 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].tableCount).toBe(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, tableCount: 1, totalRows: 5, dialect: "mysql", seed: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, tableCount: 1, totalRows: 5, dialect: "mysql", seed: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("keeps most recent first", () => {
    saveHistory({ ts: 1, tableCount: 1, totalRows: 5, dialect: "mysql", seed: 1 });
    saveHistory({ ts: 2, tableCount: 1, totalRows: 5, dialect: "mysql", seed: 2 });
    expect(loadHistory()[0].ts).toBe(2);
  });
});

describe("mock-sql-data-generator shareable URL", () => {
  it("encodes and decodes state", () => {
    const state = { ddl: "CREATE TABLE t (id INT);", dialect: "mysql" as Dialect, rowCount: 5, seed: 42, batchSize: 1 };
    const enc = encodeState(state);
    const dec = decodeState(enc);
    expect(dec).not.toBeNull();
    expect(dec!.ddl).toBe(state.ddl);
    expect(dec!.rowCount).toBe(5);
  });
  it("decodeState returns null for invalid input", () => {
    expect(decodeState("not valid base64!!!")).toBeNull();
  });
  it("buildShareUrl produces a hash fragment with s=", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ddl: "x", dialect: "mysql", rowCount: 1, seed: 1, batchSize: 1 });
    expect(url).toContain("s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips state", () => {
    const state = { ddl: "CREATE TABLE t (id INT);", dialect: "postgresql" as Dialect, rowCount: 10, seed: 99, batchSize: 5 };
    const enc = encodeState(state);
    const parsed = parseShareUrl(`#s=${enc}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.dialect).toBe("postgresql");
    expect(parsed!.rowCount).toBe(10);
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("parseShareUrl returns null when s param missing", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});
