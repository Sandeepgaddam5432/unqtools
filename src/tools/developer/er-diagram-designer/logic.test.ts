import { describe, it, expect, beforeEach } from "vitest";
import {
  DIALECTS,
  DIALECT_LABELS,
  COLUMN_TYPES,
  ON_ACTIONS,
  PRESETS,
  createColumn,
  createEntity,
  createRelationship,
  createEmptyModel,
  addEntity,
  removeEntity,
  renameEntity,
  addColumn,
  updateColumn,
  removeColumn,
  addRelationship,
  removeRelationship,
  isReservedWord,
  quoteIdentifier,
  renderColumnType,
  generateDdl,
  topologicalSort,
  validateModel,
  generateDbml,
  parseDbml,
  diffModels,
  generateMigration,
  serializeModel,
  deserializeModel,
  importFromSchemaModel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  countColumns,
  summarizeModel,
  renderAsciiPreview,
  type Dialect,
  type DesignerModel,
  type DesignerColumn,
  type ColumnType,
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

// ---------- helper to build a small model ----------
function buildSimpleModel(): DesignerModel {
  let m = createEmptyModel();
  m = addEntity(m, "users");
  const usersIdCol = m.entities[0].columns[0].id;
  m = addColumn(m, "users", { name: "email", type: "varchar", length: 255, nullable: false, unique: true });
  m = addEntity(m, "posts");
  const authorCol = m.entities[1].columns.find((c) => c.name === "id")!.id;
  m = addColumn(m, "posts", { name: "title", type: "varchar", length: 200, nullable: false });
  m = addColumn(m, "posts", { name: "author_id", type: "integer", nullable: false });
  const authorIdCol = m.entities[1].columns.find((c) => c.name === "author_id")!.id;
  m = addRelationship(m, {
    fromTableId: m.entities[1].id,
    fromColumnIds: [authorIdCol],
    toTableId: m.entities[0].id,
    toColumnIds: [usersIdCol],
    onDelete: "CASCADE",
  });
  void authorCol;
  return m;
}

describe("er-diagram-designer constants", () => {
  it("exposes 4 dialects", () => {
    expect(DIALECTS).toHaveLength(4);
    expect(DIALECTS).toContain("postgres");
    expect(DIALECTS).toContain("sqlserver");
  });
  it("exposes dialect labels", () => {
    expect(DIALECT_LABELS.postgres).toBe("PostgreSQL");
  });
  it("exposes 5 ON actions", () => {
    expect(ON_ACTIONS).toHaveLength(5);
    expect(ON_ACTIONS).toContain("CASCADE");
  });
  it("exposes column types", () => {
    expect(COLUMN_TYPES.length).toBeGreaterThan(15);
    expect(COLUMN_TYPES).toContain("varchar");
    expect(COLUMN_TYPES).toContain("uuid");
  });
  it("has 3 presets", () => {
    expect(PRESETS).toHaveLength(3);
    for (const p of PRESETS) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.build).toBe("function");
    }
  });
});

describe("er-diagram-designer factories", () => {
  it("createColumn has defaults", () => {
    const c = createColumn();
    expect(c.name).toBe("new_column");
    expect(c.type).toBe("varchar");
    expect(c.nullable).toBe(true);
    expect(c.id).toMatch(/^col_/);
  });
  it("createEntity seeds an id PK column", () => {
    const e = createEntity("users");
    expect(e.name).toBe("users");
    expect(e.columns).toHaveLength(1);
    expect(e.columns[0].name).toBe("id");
    expect(e.columns[0].primaryKey).toBe(true);
  });
  it("createRelationship has NO ACTION defaults", () => {
    const r = createRelationship({ fromTableId: "a", fromColumnIds: ["a1"], toTableId: "b", toColumnIds: ["b1"] });
    expect(r.onDelete).toBe("NO ACTION");
    expect(r.onUpdate).toBe("NO ACTION");
  });
  it("createEmptyModel has empty arrays", () => {
    const m = createEmptyModel();
    expect(m.entities).toEqual([]);
    expect(m.relationships).toEqual([]);
  });
});

describe("er-diagram-designer mutations", () => {
  it("addEntity appends with seeded PK", () => {
    const m = addEntity(createEmptyModel(), "users");
    expect(m.entities).toHaveLength(1);
    expect(m.entities[0].columns[0].primaryKey).toBe(true);
  });
  it("addEntity ignores empty name", () => {
    const m = addEntity(createEmptyModel(), "");
    expect(m.entities).toHaveLength(0);
  });
  it("removeEntity also removes referencing relationships", () => {
    const m = buildSimpleModel();
    const usersId = m.entities[0].id;
    const m2 = removeEntity(m, usersId);
    expect(m2.entities).toHaveLength(1);
    expect(m2.relationships).toHaveLength(0);
  });
  it("renameEntity updates the name", () => {
    const m = addEntity(createEmptyModel(), "users");
    const m2 = renameEntity(m, m.entities[0].id, "accounts");
    expect(m2.entities[0].name).toBe("accounts");
  });
  it("addColumn appends", () => {
    const m = addEntity(createEmptyModel(), "users");
    const m2 = addColumn(m, m.entities[0].id, { name: "email", type: "varchar", length: 255 });
    expect(m2.entities[0].columns).toHaveLength(2);
  });
  it("updateColumn merges patch", () => {
    const m = addEntity(createEmptyModel(), "users");
    const colId = m.entities[0].columns[0].id;
    const m2 = updateColumn(m, m.entities[0].id, colId, { name: "user_id", nullable: false });
    expect(m2.entities[0].columns[0].name).toBe("user_id");
    expect(m2.entities[0].columns[0].nullable).toBe(false);
  });
  it("removeColumn also removes referencing relationships", () => {
    const m = buildSimpleModel();
    const authorIdCol = m.entities[1].columns.find((c) => c.name === "author_id")!.id;
    const m2 = removeColumn(m, m.entities[1].id, authorIdCol);
    expect(m2.entities[1].columns.find((c) => c.name === "author_id")).toBeUndefined();
    expect(m2.relationships).toHaveLength(0);
  });
  it("addRelationship requires both tables and columns", () => {
    const m = createEmptyModel();
    const m1 = addRelationship(m, { fromTableId: "", fromColumnIds: [], toTableId: "", toColumnIds: [] });
    expect(m1.relationships).toHaveLength(0);
  });
  it("removeRelationship removes by id", () => {
    const m = buildSimpleModel();
    const relId = m.relationships[0].id;
    const m2 = removeRelationship(m, relId);
    expect(m2.relationships).toHaveLength(0);
  });
});

describe("er-diagram-designer reserved words & quoting", () => {
  it("detects ANSI reserved word 'select'", () => {
    expect(isReservedWord("select", "postgres")).toBe(true);
    expect(isReservedWord("select", "mysql")).toBe(true);
  });
  it("detects MySQL-specific 'auto_increment'", () => {
    expect(isReservedWord("auto_increment", "mysql")).toBe(true);
  });
  it("detects Postgres-specific 'serial'", () => {
    expect(isReservedWord("serial", "postgres")).toBe(true);
  });
  it("detects SQL Server-specific 'identity'", () => {
    expect(isReservedWord("identity", "sqlserver")).toBe(true);
  });
  it("non-reserved word passes through unquoted", () => {
    expect(quoteIdentifier("email", "postgres")).toBe("email");
  });
  it("quotes reserved words per dialect", () => {
    expect(quoteIdentifier("select", "postgres")).toBe('"select"');
    expect(quoteIdentifier("select", "mysql")).toBe("`select`");
    expect(quoteIdentifier("select", "sqlserver")).toBe("[select]");
  });
  it("quotes identifiers with spaces", () => {
    expect(quoteIdentifier("my col", "postgres")).toBe('"my col"');
  });
  it("escapes embedded quotes", () => {
    expect(quoteIdentifier('say "hi"', "postgres")).toBe('"say ""hi"""');
    expect(quoteIdentifier("say `hi`", "mysql")).toBe("`say ``hi```");
    expect(quoteIdentifier("say ]hi[", "sqlserver")).toBe("[say ]]hi[]");
  });
});

describe("er-diagram-designer renderColumnType", () => {
  it("renders varchar with length", () => {
    const c = createColumn({ name: "email", type: "varchar", length: 255 });
    expect(renderColumnType(c, "postgres")).toBe("VARCHAR(255)");
  });
  it("renders decimal with precision and scale", () => {
    const c = createColumn({ name: "price", type: "decimal", length: 10, scale: 2 });
    expect(renderColumnType(c, "postgres")).toBe("DECIMAL(10, 2)");
  });
  it("renders decimal with precision only when scale is 0", () => {
    const c = createColumn({ name: "price", type: "decimal", length: 10, scale: 0 });
    expect(renderColumnType(c, "postgres")).toBe("DECIMAL(10)");
  });
  it("serial → SERIAL on postgres", () => {
    const c = createColumn({ name: "id", type: "serial" });
    expect(renderColumnType(c, "postgres")).toBe("SERIAL");
  });
  it("serial → INTEGER on mysql", () => {
    const c = createColumn({ name: "id", type: "serial" });
    expect(renderColumnType(c, "mysql")).toBe("INTEGER");
  });
  it("boolean → TINYINT(1) on mysql, BIT on sqlserver, BOOLEAN on postgres", () => {
    const c = createColumn({ name: "active", type: "boolean" });
    expect(renderColumnType(c, "mysql")).toBe("TINYINT(1)");
    expect(renderColumnType(c, "sqlserver")).toBe("BIT");
    expect(renderColumnType(c, "postgres")).toBe("BOOLEAN");
  });
  it("uuid → UNIQUEIDENTIFIER on sqlserver", () => {
    const c = createColumn({ name: "id", type: "uuid" });
    expect(renderColumnType(c, "sqlserver")).toBe("UNIQUEIDENTIFIER");
  });
  it("enum → ENUM(...) on mysql", () => {
    const c = createColumn({ name: "color", type: "enum", enumValues: ["red", "green", "blue"] });
    expect(renderColumnType(c, "mysql")).toBe("ENUM('red', 'green', 'blue')");
  });
  it("enum escapes single quotes in values", () => {
    const c = createColumn({ name: "label", type: "enum", enumValues: ["it's", "ok"] });
    expect(renderColumnType(c, "mysql")).toBe("ENUM('it''s', 'ok')");
  });
  it("text → NVARCHAR(MAX) on sqlserver", () => {
    const c = createColumn({ name: "body", type: "text" });
    expect(renderColumnType(c, "sqlserver")).toBe("NVARCHAR(MAX)");
  });
});

describe("er-diagram-designer generateDdl", () => {
  it("generates CREATE TABLE for a simple entity", () => {
    const m = buildSimpleModel();
    const ddl = generateDdl(m, "postgres");
    expect(ddl).toContain("CREATE TABLE");
    expect(ddl).toContain("users");
    expect(ddl).toContain("posts");
    expect(ddl).toContain("PRIMARY KEY");
  });
  it("orders tables topologically (users before posts)", () => {
    const m = buildSimpleModel();
    const ddl = generateDdl(m, "postgres");
    expect(ddl.indexOf("CREATE TABLE users")).toBeLessThan(ddl.indexOf("CREATE TABLE posts"));
  });
  it("emits FK constraints", () => {
    const m = buildSimpleModel();
    const ddl = generateDdl(m, "postgres");
    expect(ddl).toContain("FOREIGN KEY");
    expect(ddl).toContain("REFERENCES");
    expect(ddl).toContain("ON DELETE CASCADE");
  });
  it("uses backticks for mysql on reserved-word entity name", () => {
    let m = createEmptyModel();
    m = addEntity(m, "select"); // reserved word in MySQL
    const ddl = generateDdl(m, "mysql");
    expect(ddl).toContain("`select`");
  });
  it("uses brackets for sqlserver on reserved-word entity name", () => {
    let m = createEmptyModel();
    m = addEntity(m, "select"); // reserved word in SQL Server
    const ddl = generateDdl(m, "sqlserver");
    expect(ddl).toContain("[select]");
  });
  it("emits UNIQUE constraint for unique columns", () => {
    const m = buildSimpleModel();
    const ddl = generateDdl(m, "postgres");
    expect(ddl).toContain("UNIQUE");
    expect(ddl).toContain("email");
  });
  it("emits Postgres enum types before tables", () => {
    let m = createEmptyModel();
    m = addEntity(m, "products");
    m = removeColumn(m, "products", m.entities[0].columns[0].id);
    m = addColumn(m, "products", { name: "id", type: "integer", primaryKey: true, nullable: false, autoIncrement: true });
    m = addColumn(m, "products", { name: "color", type: "enum", enumValues: ["red", "blue"], nullable: false });
    const ddl = generateDdl(m, "postgres");
    expect(ddl.indexOf("CREATE TYPE")).toBeLessThan(ddl.indexOf("CREATE TABLE"));
    expect(ddl).toContain("AS ENUM");
  });
  it("emits composite PRIMARY KEY", () => {
    let m = createEmptyModel();
    m = addEntity(m, "order_items");
    m = removeColumn(m, "order_items", m.entities[0].columns[0].id);
    m = addColumn(m, "order_items", { name: "order_id", type: "integer", primaryKey: true, nullable: false });
    m = addColumn(m, "order_items", { name: "product_id", type: "integer", primaryKey: true, nullable: false });
    const ddl = generateDdl(m, "postgres");
    expect(ddl).toContain("PRIMARY KEY (order_id, product_id)");
  });
  it("emits NOT NULL and DEFAULT", () => {
    let m = createEmptyModel();
    m = addEntity(m, "x");
    m = addColumn(m, "x", { name: "active", type: "boolean", nullable: false, defaultValue: "TRUE" });
    const ddl = generateDdl(m, "postgres");
    expect(ddl).toContain("NOT NULL");
    expect(ddl).toContain("DEFAULT TRUE");
  });
});

describe("er-diagram-designer topologicalSort", () => {
  it("orders by FK dependencies", () => {
    const m = buildSimpleModel();
    const topo = topologicalSort(m);
    expect(topo.order.indexOf(m.entities[0].id)).toBeLessThan(topo.order.indexOf(m.entities[1].id));
  });
  it("detects circular FK chains", () => {
    let m = createEmptyModel();
    m = addEntity(m, "a");
    m = addEntity(m, "b");
    m = addRelationship(m, {
      fromTableId: m.entities[0].id,
      fromColumnIds: [m.entities[0].columns[0].id],
      toTableId: m.entities[1].id,
      toColumnIds: [m.entities[1].columns[0].id],
    });
    m = addRelationship(m, {
      fromTableId: m.entities[1].id,
      fromColumnIds: [m.entities[1].columns[0].id],
      toTableId: m.entities[0].id,
      toColumnIds: [m.entities[0].columns[0].id],
    });
    const topo = topologicalSort(m);
    expect(topo.cycles.length).toBeGreaterThanOrEqual(1);
  });
  it("includes all entities", () => {
    const m = buildSimpleModel();
    const topo = topologicalSort(m);
    expect(topo.order).toHaveLength(2);
  });
});

describe("er-diagram-designer validateModel", () => {
  it("flags empty entity name", () => {
    const m = createEmptyModel();
    // Bypass the addEntity empty-name guard to test the validator directly
    const brokenModel: DesignerModel = {
      ...m,
      entities: [{ id: "x", name: "", columns: [] }],
    };
    const issues = validateModel(brokenModel);
    expect(issues.some((i) => i.severity === "error" && /empty name/i.test(i.message))).toBe(true);
  });
  it("flags duplicate entity name (case-insensitive)", () => {
    let m = createEmptyModel();
    m = addEntity(m, "users");
    m = addEntity(m, "Users");
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "error" && /Duplicate entity/i.test(i.message))).toBe(true);
  });
  it("flags duplicate column name", () => {
    let m = createEmptyModel();
    m = addEntity(m, "users");
    m = addColumn(m, "users", { name: "id", type: "integer" });
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "error" && /Duplicate column/i.test(i.message))).toBe(true);
  });
  it("flags autoIncrement on non-integer type", () => {
    let m = createEmptyModel();
    m = addEntity(m, "x");
    const colId = m.entities[0].columns[0].id;
    m = updateColumn(m, "x", colId, { type: "varchar", autoIncrement: true });
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "warning" && /auto-increment/i.test(i.message))).toBe(true);
  });
  it("flags enum without values", () => {
    let m = createEmptyModel();
    m = addEntity(m, "x");
    const colId = m.entities[0].columns[0].id;
    m = updateColumn(m, "x", colId, { type: "enum", primaryKey: false });
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "warning" && /enum but has no values/i.test(i.message))).toBe(true);
  });
  it("flags relationship with missing target entity", () => {
    let m = createEmptyModel();
    m = addEntity(m, "x");
    const xId = m.entities[0].id;
    const colId = m.entities[0].columns[0].id;
    // Manually inject a broken relationship
    const rel = createRelationship({
      fromTableId: xId, fromColumnIds: [colId],
      toTableId: "ghost", toColumnIds: ["ghost-col"],
    });
    m = { ...m, relationships: [...m.relationships, rel] };
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "error" && /missing target/i.test(i.message))).toBe(true);
  });
  it("flags missing primary key as info", () => {
    let m = createEmptyModel();
    m = addEntity(m, "x");
    const colId = m.entities[0].columns[0].id;
    m = updateColumn(m, "x", colId, { primaryKey: false });
    const issues = validateModel(m);
    expect(issues.some((i) => i.severity === "info" && /no primary key/i.test(i.message))).toBe(true);
  });
});

describe("er-diagram-designer generateDbml", () => {
  it("generates Table blocks", () => {
    const m = buildSimpleModel();
    const dbml = generateDbml(m);
    expect(dbml).toContain("Table users");
    expect(dbml).toContain("Table posts");
  });
  it("emits Ref lines", () => {
    const m = buildSimpleModel();
    const dbml = generateDbml(m);
    expect(dbml).toContain("Ref:");
    expect(dbml).toContain("posts.author_id > users.id");
  });
  it("emits [pk, not null] tags", () => {
    const m = buildSimpleModel();
    const dbml = generateDbml(m);
    expect(dbml).toContain("[pk");
    expect(dbml).toContain("not null");
  });
});

describe("er-diagram-designer parseDbml (round-trip)", () => {
  it("parses a simple DBML string", () => {
    const dbml = `
Table users {
  id integer [pk, not null]
  email varchar [not null, unique]
}

Table posts {
  id integer [pk]
  author_id integer [not null]
}

Ref: posts.author_id > users.id
`;
    const model = parseDbml(dbml);
    expect(model.entities).toHaveLength(2);
    expect(model.entities[0].name).toBe("users");
    expect(model.entities[0].columns).toHaveLength(2);
    expect(model.entities[0].columns[0].primaryKey).toBe(true);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0].fromTableId).toBe(model.entities[1].id);
  });
  it("round-trips generateDbml → parseDbml", () => {
    const m = buildSimpleModel();
    const dbml = generateDbml(m);
    const parsed = parseDbml(dbml);
    expect(parsed.entities).toHaveLength(2);
    expect(parsed.entities.map((e) => e.name).sort()).toEqual(["posts", "users"]);
  });
});

describe("er-diagram-designer diffModels & generateMigration", () => {
  it("detects added table", () => {
    const old = createEmptyModel();
    const newM = addEntity(old, "x");
    const ops = diffModels(old, newM, "postgres");
    expect(ops.some((o) => o.type === "create_table")).toBe(true);
  });
  it("detects dropped table", () => {
    const old = addEntity(createEmptyModel(), "x");
    const newM = createEmptyModel();
    const ops = diffModels(old, newM, "postgres");
    expect(ops.some((o) => o.type === "drop_table")).toBe(true);
  });
  it("detects renamed table", () => {
    const old = addEntity(createEmptyModel(), "old_name");
    const newM = renameEntity(old, old.entities[0].id, "new_name");
    const ops = diffModels(old, newM, "postgres");
    expect(ops.some((o) => o.type === "rename_table")).toBe(true);
  });
  it("detects added column", () => {
    const old = addEntity(createEmptyModel(), "x");
    const newM = addColumn(old, old.entities[0].id, { name: "email", type: "varchar", length: 255 });
    const ops = diffModels(old, newM, "postgres");
    expect(ops.some((o) => o.type === "add_column")).toBe(true);
  });
  it("detects dropped column", () => {
    const old = addEntity(createEmptyModel(), "x");
    const newM = removeColumn(old, old.entities[0].id, old.entities[0].columns[0].id);
    const ops = diffModels(old, newM, "postgres");
    expect(ops.some((o) => o.type === "drop_column")).toBe(true);
  });
  it("detects added FK", () => {
    const old = buildSimpleModel();
    const newM = removeRelationship(old, old.relationships[0].id);
    // newM has no FK, old has 1 → diff old→newM should drop the FK
    const ops1 = diffModels(old, newM, "postgres");
    expect(ops1.some((o) => o.type === "drop_fk")).toBe(true);
    // diff newM→old should add the FK
    const ops2 = diffModels(newM, old, "postgres");
    expect(ops2.some((o) => o.type === "add_fk")).toBe(true);
  });
  it("generateMigration wraps ops in BEGIN/COMMIT", () => {
    const old = createEmptyModel();
    const newM = addEntity(old, "x");
    const migration = generateMigration(old, newM, "postgres");
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
    expect(migration).toContain("CREATE TABLE");
  });
  it("generateMigration returns 'no changes' for identical models", () => {
    const m = buildSimpleModel();
    const migration = generateMigration(m, m, "postgres");
    expect(migration).toContain("No schema changes");
  });
  it("migration uses dialect-specific syntax", () => {
    const old = addEntity(createEmptyModel(), "x");
    const newM = renameEntity(old, old.entities[0].id, "y");
    const pgMigration = generateMigration(old, newM, "postgres");
    expect(pgMigration).toContain("RENAME TO");
    const mssqlMigration = generateMigration(old, newM, "sqlserver");
    expect(mssqlMigration).toContain("sp_rename");
  });
});

describe("er-diagram-designer serialize/deserialize", () => {
  it("round-trips a DesignerModel", () => {
    const m = buildSimpleModel();
    const json = serializeModel(m);
    const back = deserializeModel(json);
    expect(back).not.toBeNull();
    expect(back!.entities).toHaveLength(2);
    expect(back!.relationships).toHaveLength(1);
  });
  it("returns null for invalid JSON", () => {
    expect(deserializeModel("not json")).toBeNull();
  });
  it("returns null for non-model shape", () => {
    expect(deserializeModel('{"foo":"bar"}')).toBeNull();
  });
});

describe("er-diagram-designer importFromSchemaModel", () => {
  it("imports a schema JSON from #267", () => {
    const schemaJson = JSON.stringify({
      tables: [
        {
          name: "users",
          columns: [
            { name: "id", type: "INTEGER", nullable: false, primaryKey: true, unique: false, autoIncrement: true, defaultValue: null },
            { name: "email", type: "VARCHAR(255)", nullable: false, primaryKey: false, unique: true, autoIncrement: false, defaultValue: null },
          ],
          foreignKeys: [],
        },
        {
          name: "posts",
          columns: [
            { name: "id", type: "INTEGER", nullable: false, primaryKey: true, unique: false, autoIncrement: true, defaultValue: null },
            { name: "author_id", type: "INTEGER", nullable: false, primaryKey: false, unique: false, autoIncrement: false, defaultValue: null },
          ],
          foreignKeys: [
            { fromColumns: ["author_id"], toTable: "users", toColumns: ["id"] },
          ],
        },
      ],
    });
    const model = importFromSchemaModel(schemaJson);
    expect(model).not.toBeNull();
    expect(model!.entities).toHaveLength(2);
    expect(model!.relationships).toHaveLength(1);
  });
  it("maps VARCHAR(255) to varchar type", () => {
    const schemaJson = JSON.stringify({
      tables: [{
        name: "x",
        columns: [{ name: "c", type: "VARCHAR(255)", nullable: true, primaryKey: false, unique: false, autoIncrement: false, defaultValue: null }],
        foreignKeys: [],
      }],
    });
    const model = importFromSchemaModel(schemaJson);
    expect(model!.entities[0].columns[0].type).toBe("varchar");
  });
  it("maps SERIAL to serial type", () => {
    const schemaJson = JSON.stringify({
      tables: [{
        name: "x",
        columns: [{ name: "id", type: "SERIAL", nullable: false, primaryKey: true, unique: false, autoIncrement: false, defaultValue: null }],
        foreignKeys: [],
      }],
    });
    const model = importFromSchemaModel(schemaJson);
    expect(model!.entities[0].columns[0].type).toBe("serial");
  });
  it("returns null for invalid JSON", () => {
    expect(importFromSchemaModel("not json")).toBeNull();
  });
});

describe("er-diagram-designer presets", () => {
  it("preset #1 (Blog) has 2 entities and 1 FK", () => {
    const m = PRESETS[0].build();
    expect(m.entities).toHaveLength(2);
    expect(m.relationships).toHaveLength(1);
    expect(m.entities.map((e) => e.name).sort()).toEqual(["posts", "users"]);
  });
  it("preset #2 (E-commerce) has 4 entities with composite PK", () => {
    const m = PRESETS[1].build();
    expect(m.entities).toHaveLength(4);
    const orderItems = m.entities.find((e) => e.name === "order_items");
    expect(orderItems!.columns.filter((c) => c.primaryKey)).toHaveLength(2);
  });
  it("preset #3 (Empty) has 0 entities", () => {
    const m = PRESETS[2].build();
    expect(m.entities).toHaveLength(0);
  });
  it("preset #1 generates valid DDL for all 4 dialects", () => {
    const m = PRESETS[0].build();
    for (const d of DIALECTS) {
      const ddl = generateDdl(m, d);
      expect(ddl).toContain("CREATE TABLE");
      expect(ddl.length).toBeGreaterThan(0);
    }
  });
});

describe("er-diagram-designer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, entityCount: 2, columnCount: 5, fkCount: 1, dialect: "postgres", preview: "users, posts" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, entityCount: 1, columnCount: 1, fkCount: 0, dialect: "mysql", preview: `t${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, entityCount: 1, columnCount: 1, fkCount: 0, dialect: "sqlite", preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("er-diagram-designer share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const m = buildSimpleModel();
    const url = buildShareUrl(m, "postgres");
    expect(url).toContain("s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips model through the share URL", () => {
    const m = buildSimpleModel();
    const url = buildShareUrl(m, "mysql");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#s=${url.split("s=")[1]}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.model).not.toBeNull();
    expect(parsed.model!.entities).toHaveLength(2);
    expect(parsed.dialect).toBe("mysql");
  });
  it("handles empty hash", () => {
    const r = parseShareUrl("");
    expect(r.model).toBeNull();
  });
  it("handles malformed payload", () => {
    const r = parseShareUrl("s=!!!not-base64!!!");
    expect(r.model).toBeNull();
  });
});

describe("er-diagram-designer stats & preview", () => {
  it("countColumns sums across entities", () => {
    const m = buildSimpleModel();
    expect(countColumns(m)).toBe(5); // 2 + 3
  });
  it("summarizeModel returns counts", () => {
    const m = buildSimpleModel();
    const s = summarizeModel(m);
    expect(s.entities).toBe(2);
    expect(s.columns).toBe(5);
    expect(s.relationships).toBe(1);
  });
  it("renderAsciiPreview includes entity names", () => {
    const m = buildSimpleModel();
    const preview = renderAsciiPreview(m);
    expect(preview).toContain("users");
    expect(preview).toContain("posts");
    expect(preview).toContain("PK");
  });
});

// Suppress unused-import lint
export type _Unused = Dialect | DesignerColumn | ColumnType;
