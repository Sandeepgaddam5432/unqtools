import { describe, it, expect, beforeEach } from "vitest";
import {
  DB_TYPES,
  FORMATS,
  DEFAULT_PORTS,
  getDbTypeMeta,
  percentEncode,
  percentDecode,
  detectDbType,
  detectFormat,
  parseUri,
  parseKeyValue,
  parseJdbc,
  parseConnectionString,
  buildUri,
  buildKeyValue,
  buildJdbc,
  buildConnectionString,
  validateConnectionString,
  maskPasswordParts,
  maskPasswordString,
  convertFormat,
  getDriverHints,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  emptyParts,
  type DbType,
  type Format,
  type ConnParts,
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

describe("connection-string constants", () => {
  it("has 6 db types", () => {
    expect(DB_TYPES).toHaveLength(6);
    expect(DB_TYPES.map((d) => d.value)).toEqual([
      "postgresql", "mysql", "mongodb", "redis", "sqlserver", "sqlite",
    ]);
  });
  it("has 3 formats", () => {
    expect(FORMATS).toHaveLength(3);
  });
  it("has correct default ports", () => {
    expect(DEFAULT_PORTS.postgresql).toBe(5432);
    expect(DEFAULT_PORTS.mysql).toBe(3306);
    expect(DEFAULT_PORTS.mongodb).toBe(27017);
    expect(DEFAULT_PORTS.redis).toBe(6379);
    expect(DEFAULT_PORTS.sqlserver).toBe(1433);
    expect(DEFAULT_PORTS.sqlite).toBeNull();
  });
  it("getDbTypeMeta returns metadata", () => {
    const meta = getDbTypeMeta("postgresql");
    expect(meta.label).toBe("PostgreSQL");
    expect(meta.defaultPort).toBe(5432);
    expect(meta.supportsJdbc).toBe(true);
  });
});

describe("connection-string percentEncode / percentDecode", () => {
  it("encodes special characters", () => {
    expect(percentEncode("p@ss:word/")).toBe("p%40ss%3Aword%2F");
  });
  it("encodes percent literal", () => {
    expect(percentEncode("50%")).toBe("50%25");
  });
  it("does not encode unreserved chars", () => {
    expect(percentEncode("abc-_.~123")).toBe("abc-_.~123");
  });
  it("encodes space as %20", () => {
    expect(percentEncode("a b")).toBe("a%20b");
  });
  it("round-trips arbitrary text", () => {
    const orig = "p@ss/w:rd?with#special%";
    const encoded = percentEncode(orig);
    expect(percentDecode(encoded)).toBe(orig);
  });
  it("round-trips unicode", () => {
    const orig = "user";
    expect(percentDecode(percentEncode(orig))).toBe(orig);
  });
  it("decodes without percent returns as-is", () => {
    expect(percentDecode("hello")).toBe("hello");
  });
});

describe("connection-string detectDbType", () => {
  it("detects postgres", () => {
    expect(detectDbType("postgres://u@h:5432/db")).toBe("postgresql");
    expect(detectDbType("postgresql://u@h/db")).toBe("postgresql");
  });
  it("detects mysql", () => {
    expect(detectDbType("mysql://u@h/db")).toBe("mysql");
  });
  it("detects mongodb and mongodb+srv", () => {
    expect(detectDbType("mongodb://u@h:27017/db")).toBe("mongodb");
    expect(detectDbType("mongodb+srv://u@cluster.example/db")).toBe("mongodb");
  });
  it("detects redis and rediss", () => {
    expect(detectDbType("redis://h:6379/0")).toBe("redis");
    expect(detectDbType("rediss://h:6379/0")).toBe("redis");
  });
  it("detects sqlserver URI", () => {
    expect(detectDbType("sqlserver://u@h:1433/db")).toBe("sqlserver");
  });
  it("detects sqlserver key/value", () => {
    expect(detectDbType("Server=localhost;Database=db;User Id=u;Password=p")).toBe("sqlserver");
  });
  it("detects sqlite file: URI", () => {
    expect(detectDbType("file:/data/db.sqlite")).toBe("sqlite");
  });
  it("detects jdbc postgres", () => {
    expect(detectDbType("jdbc:postgresql://h:5432/db")).toBe("postgresql");
  });
  it("detects jdbc mysql", () => {
    expect(detectDbType("jdbc:mysql://h:3306/db")).toBe("mysql");
  });
  it("detects jdbc sqlserver", () => {
    expect(detectDbType("jdbc:sqlserver://h:1433;databaseName=db")).toBe("sqlserver");
  });
  it("detects jdbc sqlite", () => {
    expect(detectDbType("jdbc:sqlite:/data/db.sqlite")).toBe("sqlite");
  });
  it("returns null for unknown", () => {
    expect(detectDbType("not a connection string")).toBeNull();
  });
});

describe("connection-string detectFormat", () => {
  it("detects URI", () => {
    expect(detectFormat("postgres://u@h/db")).toBe("uri");
  });
  it("detects JDBC", () => {
    expect(detectFormat("jdbc:postgresql://h/db")).toBe("jdbc");
  });
  it("detects key/value", () => {
    expect(detectFormat("Server=h;Database=db")).toBe("keyvalue");
  });
  it("returns null for empty", () => {
    expect(detectFormat("")).toBeNull();
  });
});

describe("connection-string parseUri", () => {
  it("parses postgres URI", () => {
    const p = parseUri("postgres://user:pass@host:5432/mydb?sslmode=require", "postgresql");
    expect(p.user).toBe("user");
    expect(p.password).toBe("pass");
    expect(p.hosts).toEqual([{ host: "host", port: 5432 }]);
    expect(p.database).toBe("mydb");
    expect(p.params.sslmode).toBe("require");
    expect(p.ssl).toBe(true);
  });
  it("parses mongo URI with multiple hosts", () => {
    const p = parseUri("mongodb://user:pass@h1:27017,h2:27018,h3:27019/db?replicaSet=rs0", "mongodb");
    expect(p.hosts).toHaveLength(3);
    expect(p.hosts[0].host).toBe("h1");
    expect(p.hosts[0].port).toBe(27017);
    expect(p.hosts[2].port).toBe(27019);
    expect(p.params.replicaSet).toBe("rs0");
  });
  it("parses mongodb+srv URI without ports", () => {
    const p = parseUri("mongodb+srv://user:pass@cluster.example.com/db", "mongodb");
    expect(p.hosts[0].host).toBe("cluster.example.com");
    expect(p.hosts[0].port).toBeUndefined();
  });
  it("parses redis URI with numeric database", () => {
    const p = parseUri("redis://h:6379/3", "redis");
    expect(p.database).toBe("3");
  });
  it("decodes percent-encoded password", () => {
    const p = parseUri("postgres://user:p%40ss%3Aword@host/db", "postgresql");
    expect(p.password).toBe("p@ss:word");
  });
  it("parses rediss URI and sets ssl", () => {
    const p = parseUri("rediss://h:6379/0", "redis");
    expect(p.ssl).toBe(true);
  });
  it("parses sqlite file URI absolute path", () => {
    const p = parseUri("file:/data/db.sqlite", "sqlite");
    expect(p.database).toBe("/data/db.sqlite");
  });
  it("parses sqlite file URI triple slash", () => {
    const p = parseUri("file:///data/db.sqlite?mode=ro", "sqlite");
    expect(p.database).toBe("/data/db.sqlite");
    expect(p.params.mode).toBe("ro");
  });
  it("throws on missing scheme", () => {
    expect(() => parseUri("not-a-uri", "postgresql")).toThrow(/scheme/);
  });
  it("throws on invalid port", () => {
    expect(() => parseUri("postgres://h:notaport/db", "postgresql")).toThrow(/port/i);
  });
});

describe("connection-string parseKeyValue", () => {
  it("parses postgres key/value", () => {
    const p = parseKeyValue("host=localhost port=5432 dbname=mydb user=u password=p sslmode=require", "postgresql");
    expect(p.hosts[0].host).toBe("localhost");
    expect(p.hosts[0].port).toBe(5432);
    expect(p.database).toBe("mydb");
    expect(p.user).toBe("u");
    expect(p.password).toBe("p");
    expect(p.ssl).toBe(true);
  });
  it("parses sqlserver key/value with semicolons", () => {
    const p = parseKeyValue("Server=localhost,1433;Database=mydb;User Id=u;Password=p;Encrypt=true", "sqlserver");
    expect(p.hosts[0].host).toBe("localhost");
    expect(p.hosts[0].port).toBe(1433);
    expect(p.database).toBe("mydb");
    expect(p.user).toBe("u");
    expect(p.password).toBe("p");
    expect(p.ssl).toBe(true);
  });
  it("parses sqlite key/value", () => {
    const p = parseKeyValue("Data Source=/data/db.sqlite;Version=3;", "sqlite");
    expect(p.database).toBe("/data/db.sqlite");
  });
  it("parses multi-host postgres key/value", () => {
    const p = parseKeyValue("host=h1,h2 port=5432,5433 dbname=db", "postgresql");
    expect(p.hosts).toHaveLength(2);
    expect(p.hosts[0].port).toBe(5432);
    expect(p.hosts[1].port).toBe(5433);
  });
});

describe("connection-string parseJdbc", () => {
  it("parses jdbc postgres", () => {
    const p = parseJdbc("jdbc:postgresql://host:5432/db?user=u&password=p&sslmode=require", "postgresql");
    expect(p.hosts[0].host).toBe("host");
    expect(p.database).toBe("db");
    expect(p.user).toBe("u");
    expect(p.password).toBe("p");
  });
  it("parses jdbc sqlserver", () => {
    const p = parseJdbc("jdbc:sqlserver://host:1433;databaseName=mydb;user=u;password=p", "sqlserver");
    expect(p.hosts[0].host).toBe("host");
    expect(p.hosts[0].port).toBe(1433);
    expect(p.database).toBe("mydb");
    expect(p.user).toBe("u");
    expect(p.password).toBe("p");
  });
  it("parses jdbc sqlite", () => {
    const p = parseJdbc("jdbc:sqlite:/data/db.sqlite", "sqlite");
    expect(p.database).toBe("/data/db.sqlite");
  });
});

describe("connection-string parseConnectionString (auto-detect)", () => {
  it("parses postgres URI", () => {
    const r = parseConnectionString("postgres://u:p@h:5432/db");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dbType).toBe("postgresql");
      expect(r.format).toBe("uri");
      expect(r.parts.user).toBe("u");
    }
  });
  it("parses sqlserver key/value", () => {
    const r = parseConnectionString("Server=h;Database=db;User Id=u;Password=p");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dbType).toBe("sqlserver");
      expect(r.format).toBe("keyvalue");
      expect(r.parts.database).toBe("db");
    }
  });
  it("returns error for empty", () => {
    const r = parseConnectionString("");
    expect(r.ok).toBe(false);
  });
  it("returns error for unrecognised input", () => {
    const r = parseConnectionString("hello world");
    expect(r.ok).toBe(false);
  });
});

describe("connection-string buildUri", () => {
  it("builds a postgres URI", () => {
    const parts: ConnParts = {
      user: "u", password: "p",
      hosts: [{ host: "h", port: 5432 }],
      database: "db", params: {}, ssl: false,
    };
    expect(buildUri(parts, "postgresql")).toBe("postgres://u:p@h:5432/db");
  });
  it("builds with SSL as rediss for redis", () => {
    const parts: ConnParts = {
      hosts: [{ host: "h", port: 6379 }], database: "0",
      params: {}, ssl: true,
    };
    expect(buildUri(parts, "redis")).toBe("rediss://h:6379/0");
  });
  it("masks password when requested", () => {
    const parts: ConnParts = {
      user: "u", password: "secret",
      hosts: [{ host: "h" }], params: {},
    };
    expect(buildUri(parts, "postgresql", { maskPassword: true })).toBe("postgres://u:***@h");
  });
  it("encodes special characters in password", () => {
    const parts: ConnParts = {
      user: "u", password: "p@ss:word",
      hosts: [{ host: "h" }], params: {},
    };
    const out = buildUri(parts, "postgresql");
    expect(out).toContain("p%40ss%3Aword");
  });
  it("emits multiple hosts for mongodb", () => {
    const parts: ConnParts = {
      hosts: [{ host: "h1", port: 27017 }, { host: "h2", port: 27018 }],
      params: { replicaSet: "rs0" },
    };
    expect(buildUri(parts, "mongodb")).toBe("mongodb://h1:27017,h2:27018?replicaSet=rs0");
  });
  it("includes default port when requested", () => {
    const parts: ConnParts = {
      hosts: [{ host: "h" }], params: {},
    };
    expect(buildUri(parts, "postgresql", { includeDefaultPort: true })).toBe("postgres://h:5432");
  });
});

describe("connection-string buildKeyValue", () => {
  it("builds postgres key/value", () => {
    const parts: ConnParts = {
      user: "u", password: "p",
      hosts: [{ host: "h", port: 5432 }],
      database: "db", params: {}, ssl: true,
    };
    const out = buildKeyValue(parts, "postgresql");
    expect(out).toContain("host=h");
    expect(out).toContain("port=5432");
    expect(out).toContain("dbname=db");
    expect(out).toContain("user=u");
    expect(out).toContain("password=p");
    expect(out).toContain("sslmode=require");
  });
  it("builds sqlserver key/value with semicolons", () => {
    const parts: ConnParts = {
      user: "u", password: "p",
      hosts: [{ host: "h", port: 1433 }],
      database: "db", params: {}, ssl: true,
    };
    const out = buildKeyValue(parts, "sqlserver");
    expect(out).toContain("Server=h,1433");
    expect(out).toContain("Database=db");
    expect(out).toContain("User Id=u");
    expect(out).toContain("Password=p");
    expect(out).toContain("Encrypt=true");
  });
  it("builds sqlite key/value", () => {
    const parts: ConnParts = {
      database: "/data/db.sqlite", hosts: [], params: {},
    };
    const out = buildKeyValue(parts, "sqlite");
    expect(out).toContain("Data Source=/data/db.sqlite");
    expect(out).toContain("Version=3");
  });
});

describe("connection-string buildJdbc", () => {
  it("builds jdbc postgres", () => {
    const parts: ConnParts = {
      user: "u", password: "p",
      hosts: [{ host: "h", port: 5432 }],
      database: "db", params: {}, ssl: true,
    };
    const out = buildJdbc(parts, "postgresql");
    expect(out).toBe("jdbc:postgresql://h:5432/db?password=p&sslmode=require&user=u");
  });
  it("builds jdbc sqlserver", () => {
    const parts: ConnParts = {
      user: "u", password: "p",
      hosts: [{ host: "h", port: 1433 }],
      database: "db", params: {}, ssl: true,
    };
    const out = buildJdbc(parts, "sqlserver");
    expect(out).toContain("jdbc:sqlserver://h:1433");
    expect(out).toContain("databaseName=db");
    expect(out).toContain("user=u");
    expect(out).toContain("encrypt=true");
  });
  it("builds jdbc sqlite", () => {
    const parts: ConnParts = {
      database: "/data/db.sqlite", hosts: [], params: {},
    };
    expect(buildJdbc(parts, "sqlite")).toBe("jdbc:sqlite:/data/db.sqlite");
  });
  it("throws for mongodb (no jdbc)", () => {
    expect(() => buildJdbc({ hosts: [{ host: "h" }], params: {} }, "mongodb")).toThrow();
  });
});

describe("connection-string round-trip parse → build", () => {
  it("round-trips postgres URI", () => {
    const orig = "postgres://user:pass@host:5432/mydb?sslmode=require";
    const r = parseConnectionString(orig);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const rebuilt = buildUri(r.parts, "postgresql");
      expect(rebuilt).toBe(orig);
    }
  });
  it("round-trips with special-char password", () => {
    const orig = "postgres://user:p%40ss%3Aword@host:5432/db";
    const r = parseConnectionString(orig);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts.password).toBe("p@ss:word");
      const rebuilt = buildUri(r.parts, "postgresql");
      expect(rebuilt).toBe(orig);
    }
  });
});

describe("connection-string validateConnectionString", () => {
  it("valid for valid URI", () => {
    const v = validateConnectionString("postgres://u:p@h:5432/db");
    expect(v.ok).toBe(true);
  });
  it("invalid for empty", () => {
    const v = validateConnectionString("");
    expect(v.ok).toBe(false);
  });
  it("invalid for undetectable", () => {
    const v = validateConnectionString("just some text");
    expect(v.ok).toBe(false);
  });
  it("invalid for out-of-range port", () => {
    const v = validateConnectionString("postgres://h:99999/db");
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("range"))).toBe(true);
  });
  it("warns when password present", () => {
    const v = validateConnectionString("postgres://u:p@h:5432/db");
    expect(v.warnings.some((w) => w.includes("Password"))).toBe(true);
  });
});

describe("connection-string maskPassword", () => {
  it("maskPasswordParts replaces password with ***", () => {
    const p: ConnParts = { user: "u", password: "secret", hosts: [], params: {} };
    const masked = maskPasswordParts(p);
    expect(masked.password).toBe("***");
  });
  it("maskPasswordParts no-ops when no password", () => {
    const p: ConnParts = { hosts: [], params: {} };
    expect(maskPasswordParts(p).password).toBeUndefined();
  });
  it("maskPasswordString replaces password in URL", () => {
    const masked = maskPasswordString("postgres://u:secret@h/db");
    expect(masked).toBe("postgres://u:***@h/db");
  });
});

describe("connection-string convertFormat", () => {
  it("converts postgres URI to JDBC", () => {
    const r = convertFormat("postgres://u:p@h:5432/db", "jdbc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("jdbc:postgresql://h:5432/db");
      expect(r.output).toContain("user=u");
      expect(r.output).toContain("password=p");
    }
  });
  it("converts postgres URI to key/value", () => {
    const r = convertFormat("postgres://u:p@h:5432/db", "keyvalue");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("host=h");
      expect(r.output).toContain("port=5432");
      expect(r.output).toContain("dbname=db");
    }
  });
  it("converts sqlserver key/value to URI", () => {
    const r = convertFormat("Server=h,1433;Database=db;User Id=u;Password=p", "uri");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("sqlserver://");
      expect(r.output).toContain("u:p@h:1433");
    }
  });
  it("fails for invalid input", () => {
    const r = convertFormat("not a connection string", "uri");
    expect(r.ok).toBe(false);
  });
});

describe("connection-string getDriverHints", () => {
  it("returns hints for each db type", () => {
    const types: DbType[] = ["postgresql", "mysql", "mongodb", "redis", "sqlserver", "sqlite"];
    for (const t of types) {
      const hints = getDriverHints(t);
      expect(hints.length).toBeGreaterThanOrEqual(3);
      expect(hints.every((h) => h.framework && h.language)).toBe(true);
    }
  });
  it("postgres hint includes a Prisma snippet", () => {
    const hints = getDriverHints("postgresql");
    const prisma = hints.find((h) => h.framework === "Prisma");
    expect(prisma).toBeDefined();
    const snippet = prisma!.snippet({ user: "u", password: "p", hosts: [{ host: "h", port: 5432 }], database: "db", params: {} }, "postgresql");
    expect(snippet).toContain('provider = "postgresql"');
    expect(snippet).toContain("postgres://u:p@h:5432/db");
  });
});

describe("connection-string history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dbType: "postgresql", format: "uri",
      inputPreview: "postgres://…", outputPreview: "jdbc:postgresql://…", masked: true,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dbType: "redis", format: "uri",
        inputPreview: "redis://…", outputPreview: "redis://…", masked: true,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dbType: "mysql", format: "uri",
      inputPreview: "mysql://…", outputPreview: "mysql://…", masked: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("connection-string shareable URL", () => {
  it("builds share URL with masked password when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const parts: ConnParts = {
      user: "u", password: "secret",
      hosts: [{ host: "h", port: 5432 }],
      database: "db", params: {},
    };
    const url = buildShareUrl(parts, "postgresql", "uri");
    expect(url).toContain("db=postgresql");
    expect(url).toContain("fmt=uri");
    // Password must be masked
    expect(url).not.toContain("secret");
    expect(url).toContain("***");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips parse", () => {
    const parts: ConnParts = {
      user: "u", password: "secret",
      hosts: [{ host: "h", port: 5432 }],
      database: "db", params: {},
    };
    const url = buildShareUrl(parts, "postgresql", "uri");
    // Extract the hash portion
    const hashIdx = url.indexOf("#");
    const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : url;
    const p = parseShareUrl(hash);
    expect(p.dbType).toBe("postgresql");
    expect(p.format).toBe("uri");
    expect(p.cs).toContain("***");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ cs: "", dbType: null, format: null });
  });
});

describe("connection-string buildConnectionString dispatch", () => {
  it("dispatches to buildUri for uri format", () => {
    const parts: ConnParts = { user: "u", hosts: [{ host: "h", port: 5432 }], database: "db", params: {} };
    expect(buildConnectionString(parts, "postgresql", "uri")).toBe("postgres://u@h:5432/db");
  });
  it("dispatches to buildJdbc for jdbc format", () => {
    const parts: ConnParts = { user: "u", hosts: [{ host: "h", port: 5432 }], database: "db", params: {} };
    expect(buildConnectionString(parts, "postgresql", "jdbc")).toContain("jdbc:postgresql://");
  });
  it("dispatches to buildKeyValue for keyvalue format", () => {
    const parts: ConnParts = { user: "u", hosts: [{ host: "h", port: 5432 }], database: "db", params: {} };
    expect(buildConnectionString(parts, "postgresql", "keyvalue")).toContain("host=h");
  });
});

describe("connection-string emptyParts helper", () => {
  it("returns a parts object with one empty host", () => {
    const p = emptyParts();
    expect(p.hosts).toEqual([{ host: "" }]);
    expect(p.params).toEqual({});
  });
});

// Suppress unused-import lint
export type _Unused = Format | DbType;
