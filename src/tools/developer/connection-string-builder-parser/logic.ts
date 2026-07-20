/**
 * Connection String Builder & Parser — pure logic.
 *
 * Build and parse database connection strings for PostgreSQL, MySQL,
 * MongoDB, Redis, SQL Server, and SQLite. Convert between URI, key/value,
 * and JDBC formats with correct percent-encoding. 100% client-side;
 * secrets never leave the browser.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DbType =
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "redis"
  | "sqlserver"
  | "sqlite";

export type Format = "uri" | "keyvalue" | "jdbc";

export interface Host {
  host: string;
  port?: number;
}

export interface ConnParts {
  user?: string;
  password?: string;
  hosts: Host[];
  database?: string;
  params: Record<string, string>;
  ssl?: boolean;
}

export interface ParseSuccess {
  ok: true;
  parts: ConnParts;
  dbType: DbType;
  format: Format;
  warnings: string[];
}

export type ParseResult = ParseSuccess | { ok: false; error: string };

export interface BuildOptions {
  /** Mask the password in the output (replaces with '***'). */
  maskPassword?: boolean;
  /** Include default port when building URI form. */
  includeDefaultPort?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export interface DbTypeMeta {
  value: DbType;
  label: string;
  schemes: string[];
  defaultPort: number | null;
  supportsUri: boolean;
  supportsKeyValue: boolean;
  supportsJdbc: boolean;
  jdbcScheme: string;
  paramHints: { name: string; description: string }[];
}

export const DB_TYPES: DbTypeMeta[] = [
  {
    value: "postgresql",
    label: "PostgreSQL",
    schemes: ["postgres", "postgresql"],
    defaultPort: 5432,
    supportsUri: true,
    supportsKeyValue: true,
    supportsJdbc: true,
    jdbcScheme: "jdbc:postgresql",
    paramHints: [
      { name: "sslmode", description: "disable | allow | prefer | require | verify-ca | verify-full" },
      { name: "connect_timeout", description: "Seconds to wait before timing out (default 10)." },
      { name: "application_name", description: "Server-side application identifier." },
      { name: "schema", description: "Set the search_path after connect." },
    ],
  },
  {
    value: "mysql",
    label: "MySQL / MariaDB",
    schemes: ["mysql", "mariadb"],
    defaultPort: 3306,
    supportsUri: true,
    supportsKeyValue: true,
    supportsJdbc: true,
    jdbcScheme: "jdbc:mysql",
    paramHints: [
      { name: "ssl-mode", description: "DISABLED | PREFERRED | REQUIRED | VERIFY_CA | VERIFY_IDENTITY" },
      { name: "charset", description: "Connection charset (e.g. utf8mb4)." },
      { name: "useSSL", description: "true/false to enable TLS." },
    ],
  },
  {
    value: "mongodb",
    label: "MongoDB",
    schemes: ["mongodb", "mongodb+srv"],
    defaultPort: 27017,
    supportsUri: true,
    supportsKeyValue: false,
    supportsJdbc: false,
    jdbcScheme: "",
    paramHints: [
      { name: "replicaSet", description: "Replica set name for routing." },
      { name: "authSource", description: "Database that holds the user credentials." },
      { name: "ssl", description: "true/false — enable TLS." },
      { name: "retryWrites", description: "Retry write operations on network errors." },
    ],
  },
  {
    value: "redis",
    label: "Redis",
    schemes: ["redis", "rediss"],
    defaultPort: 6379,
    supportsUri: true,
    supportsKeyValue: false,
    supportsJdbc: false,
    jdbcScheme: "",
    paramHints: [
      { name: "ssl", description: "true/false — use TLS (or use rediss:// scheme)." },
      { name: "db", description: "Database index (default 0)." },
      { name: "protocol", description: "RESP2 | RESP3 protocol version." },
    ],
  },
  {
    value: "sqlserver",
    label: "SQL Server",
    schemes: ["sqlserver"],
    defaultPort: 1433,
    supportsUri: true,
    supportsKeyValue: true,
    supportsJdbc: true,
    jdbcScheme: "jdbc:sqlserver",
    paramHints: [
      { name: "encrypt", description: "true/false — TLS for the connection." },
      { name: "trustServerCertificate", description: "true/false — skip cert validation." },
      { name: "database", description: "Initial database (or databaseName for JDBC)." },
      { name: "applicationName", description: "Application name logged by SQL Server." },
    ],
  },
  {
    value: "sqlite",
    label: "SQLite",
    schemes: ["file"],
    defaultPort: null,
    supportsUri: true,
    supportsKeyValue: true,
    supportsJdbc: true,
    jdbcScheme: "jdbc:sqlite",
    paramHints: [
      { name: "mode", description: "ro | rw | rwc | memory — file open mode." },
      { name: "cache", description: "shared | private — cache mode." },
    ],
  },
];

export const FORMATS: ReadonlyArray<{ value: Format; label: string }> = [
  { value: "uri", label: "URI (scheme://user:pass@host:port/db)" },
  { value: "keyvalue", label: "Key/Value (key=value;key=value)" },
  { value: "jdbc", label: "JDBC (jdbc:scheme://…)" },
];

export const DEFAULT_PORTS: Record<DbType, number | null> = DB_TYPES.reduce(
  (acc, d) => ({ ...acc, [d.value]: d.defaultPort }),
  {} as Record<DbType, number | null>,
);

export function getDbTypeMeta(dbType: DbType): DbTypeMeta {
  return DB_TYPES.find((d) => d.value === dbType) ?? DB_TYPES[0];
}

// ---------------------------------------------------------------------------
// Percent-encoding (RFC 3986)
// ---------------------------------------------------------------------------

const RESERVED = /[^A-Za-z0-9\-._~]/;

export function percentEncode(value: string): string {
  if (value == null) return "";
  const s = String(value);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (RESERVED.test(ch)) {
      const bytes = new TextEncoder().encode(ch);
      for (const b of bytes) {
        out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
      }
    } else {
      out += ch;
    }
  }
  return out;
}

export function percentDecode(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (!s.includes("%")) return s;
  const bytes: number[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "%" && i + 2 < s.length + 1 && /[0-9A-Fa-f]{2}/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      // Encode character as UTF-8 bytes
      const charBytes = new TextEncoder().encode(ch);
      for (const b of charBytes) bytes.push(b);
      i++;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export function detectDbType(input: string): DbType | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;

  // JDBC prefixes
  if (s.startsWith("jdbc:postgresql")) return "postgresql";
  if (s.startsWith("jdbc:mysql")) return "mysql";
  if (s.startsWith("jdbc:sqlserver")) return "sqlserver";
  if (s.startsWith("jdbc:sqlite")) return "sqlite";

  // Scheme prefixes
  for (const d of DB_TYPES) {
    for (const scheme of d.schemes) {
      if (s.startsWith(scheme + "://") || s.startsWith(scheme + ":")) {
        return d.value;
      }
    }
  }

  // Key/value sniffing
  if (/^server\s*=/i.test(s) || /^data source\s*=/i.test(s)) {
    if (/encrypt\s*=/i.test(s) || /database\s*=/i.test(s) || /trusted_connection/i.test(s)) {
      return "sqlserver";
    }
    return "sqlserver";
  }
  if (/^[\s\S]*host\s*=.*port\s*=[\s\S]*$/i.test(s) && /dbname\s*=/i.test(s)) return "postgresql";
  if (/^host\s*=/i.test(s) && /dbname\s*=/i.test(s)) return "postgresql";

  return null;
}

export function detectFormat(input: string): Format | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("jdbc:")) return "jdbc";
  if (/^[a-z+]+:\/\//.test(s)) return "uri";
  if (s.startsWith("file:")) return "uri";
  // Key/value detection
  if (/^[a-z_]+\s*=/i.test(s) && s.includes("=") && (s.includes(";") || s.split("=").length > 2)) {
    return "keyvalue";
  }
  return null;
}

// ---------------------------------------------------------------------------
// URI parser
// ---------------------------------------------------------------------------

export function parseUri(input: string, dbType: DbType): ConnParts {
  const s = (input ?? "").trim();
  if (!s) throw new Error("Empty input");

  if (dbType === "sqlite") {
    return parseSqliteUri(s);
  }

  // Match scheme://
  const schemeMatch = s.match(/^([a-z+]+):\/\/(.*)$/i);
  if (!schemeMatch) {
    throw new Error(`Invalid URI: missing scheme:// for ${dbType}`);
  }

  const scheme = schemeMatch[1].toLowerCase();
  const meta = getDbTypeMeta(dbType);
  if (!meta.schemes.includes(scheme)) {
    throw new Error(`Scheme '${scheme}' is not valid for ${meta.label}`);
  }

  let rest = schemeMatch[2];

  // Userinfo (user[:password]@)
  let user: string | undefined;
  let password: string | undefined;
  const atIdx = rest.lastIndexOf("@");
  if (atIdx >= 0) {
    const userinfo = rest.slice(0, atIdx);
    rest = rest.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(":");
    if (colonIdx >= 0) {
      user = percentDecode(userinfo.slice(0, colonIdx));
      password = percentDecode(userinfo.slice(colonIdx + 1));
    } else {
      user = percentDecode(userinfo);
    }
  }

  // Path + query
  let pathPart = rest;
  let query = "";
  const qIdx = rest.indexOf("?");
  if (qIdx >= 0) {
    pathPart = rest.slice(0, qIdx);
    query = rest.slice(qIdx + 1);
  }

  // SQL Server may use semicolons for params instead of ?
  if (dbType === "sqlserver") {
    const semiIdx = pathPart.indexOf(";");
    if (semiIdx >= 0) {
      query = pathPart.slice(semiIdx + 1);
      pathPart = pathPart.slice(0, semiIdx);
    }
  }

  // Split hosts from database
  let hostsStr = pathPart;
  let database: string | undefined;
  const slashIdx = pathPart.indexOf("/");
  if (slashIdx >= 0) {
    hostsStr = pathPart.slice(0, slashIdx);
    const dbPart = pathPart.slice(slashIdx + 1);
    database = dbPart ? percentDecode(dbPart) : undefined;
  }

  // MongoDB+SRV does not allow ports
  const isSrv = scheme === "mongodb+srv";
  const hosts: Host[] = hostsStr
    .split(",")
    .filter(Boolean)
    .map((h) => {
      if (isSrv) {
        return { host: percentDecode(h), port: undefined as number | undefined };
      }
      const [hostPart, portPart] = h.split(":");
      const port: number | undefined = portPart ? parseInt(portPart, 10) : undefined;
      if (portPart && (port === undefined || isNaN(port) || port < 1 || port > 65535)) {
        throw new Error(`Port '${portPart}' is out of range (1-65535) in host '${h}'`);
      }
      return { host: percentDecode(hostPart ?? ""), port };
    });

  // Params
  const params: Record<string, string> = {};
  if (query) {
    const sep = dbType === "sqlserver" ? ";" : "&";
    for (const pair of query.split(sep)) {
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      const k = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
      const v = eqIdx >= 0 ? pair.slice(eqIdx + 1) : "";
      if (k) params[percentDecode(k)] = v ? percentDecode(v) : "";
    }
  }

  // SSL detection
  const ssl =
    params.ssl === "true" ||
    params.ssl === "1" ||
    params.tls === "true" ||
    params.sslmode === "require" ||
    params.sslmode === "verify-ca" ||
    params.sslmode === "verify-full" ||
    params["ssl-mode"] === "REQUIRED" ||
    params["ssl-mode"] === "VERIFY_CA" ||
    params["ssl-mode"] === "VERIFY_IDENTITY" ||
    params.encrypt === "true" ||
    params.encrypt === "yes" ||
    scheme === "rediss";

  return {
    user,
    password,
    hosts,
    database,
    params,
    ssl,
  };
}

function parseSqliteUri(input: string): ConnParts {
  // file:filename
  // file:///absolute/path
  // file:/absolute/path
  // file:relative/path?param=value
  let s = input.trim();
  if (!s.startsWith("file:")) throw new Error("SQLite URI must start with 'file:'");

  let rest = s.slice("file:".length);

  // Query string
  let query = "";
  const qIdx = rest.indexOf("?");
  if (qIdx >= 0) {
    query = rest.slice(qIdx + 1);
    rest = rest.slice(0, qIdx);
  }

  // Normalize leading slashes (file:///path or file:/path or file:path)
  let dbPath = rest;
  if (dbPath.startsWith("///")) {
    dbPath = "/" + dbPath.slice(3);
  } else if (dbPath.startsWith("//")) {
    dbPath = dbPath.slice(2);
  } else if (dbPath.startsWith("/")) {
    dbPath = dbPath; // absolute
  } else {
    // relative path
  }

  // Params
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split("&")) {
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      const k = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
      const v = eqIdx >= 0 ? pair.slice(eqIdx + 1) : "";
      if (k) params[percentDecode(k)] = v ? percentDecode(v) : "";
    }
  }

  return {
    hosts: [],
    database: percentDecode(dbPath),
    params,
  };
}

// ---------------------------------------------------------------------------
// Key/value parser
// ---------------------------------------------------------------------------

export function parseKeyValue(input: string, dbType: DbType): ConnParts {
  const s = (input ?? "").trim();
  if (!s) throw new Error("Empty input");

  const parts: ConnParts = { hosts: [], params: {} };

  // Split by ; (SQL Server/SQLite) or space (PostgreSQL libpq-style)
  const sep = s.includes(";") ? ";" : /\s+/;
  const tokens: string[] = typeof sep === "string" ? s.split(sep) : s.split(sep);

  for (const token of tokens) {
    if (!token) continue;
    const eqIdx = token.indexOf("=");
    if (eqIdx < 0) continue;
    const k = token.slice(0, eqIdx).trim().toLowerCase();
    const v = token.slice(eqIdx + 1).trim();

    switch (k) {
      case "host":
      case "server":
      case "data source":
      case "datasource": {
        if (dbType === "sqlite") {
          // For SQLite the Data Source is the file path, not a host.
          parts.database = percentDecode(v);
          break;
        }
        // SQL Server syntax: Server=h,1433 or Server=tcp:h,1433 — host,port.
        if (dbType === "sqlserver") {
          const trimmed = v.replace(/^tcp:/i, "").trim();
          const pieces = trimmed.split(",");
          if (pieces.length === 2 && /^\d+$/.test(pieces[1].trim())) {
            parts.hosts.push({
              host: percentDecode(pieces[0].trim()),
              port: parseInt(pieces[1].trim(), 10),
            });
          } else {
            for (const h of pieces) {
              parts.hosts.push({ host: percentDecode(h.trim()) });
            }
          }
          break;
        }
        // Postgres / MySQL — comma-separated multi-host.
        for (const h of v.split(",")) {
          parts.hosts.push({ host: percentDecode(h.trim()) });
        }
        break;
      }
      case "port": {
        // Port applies to the most recent host(s), or to all hosts if multiple
        const ports = v.split(",").map((p) => parseInt(p.trim(), 10));
        if (parts.hosts.length === 0) {
          // No hosts yet — store as param
          parts.params[k] = v;
        } else if (parts.hosts.length === 1) {
          parts.hosts[0].port = ports[0];
        } else if (ports.length === parts.hosts.length) {
          for (let i = 0; i < parts.hosts.length; i++) {
            parts.hosts[i].port = ports[i];
          }
        } else {
          // Apply same port to all
          for (const h of parts.hosts) h.port = ports[0];
        }
        break;
      }
      case "user":
      case "user id":
      case "username":
      case "uid":
        parts.user = percentDecode(v);
        break;
      case "password":
      case "pwd":
        parts.password = percentDecode(v);
        break;
      case "database":
      case "dbname":
      case "initial catalog":
      case "database name":
        parts.database = percentDecode(v);
        break;
      case "encrypt":
        parts.params["encrypt"] = v;
        if (v === "true" || v === "yes") parts.ssl = true;
        break;
      case "sslmode":
        parts.params["sslmode"] = v;
        if (v === "require" || v === "verify-ca" || v === "verify-full") parts.ssl = true;
        break;
      case "ssl":
      case "tls":
        parts.params[k] = v;
        if (v === "true" || v === "1") parts.ssl = true;
        break;
      default:
        parts.params[k] = v;
        break;
    }
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Main parse entry point
// ---------------------------------------------------------------------------

export function parseConnectionString(input: string, dbType?: DbType): ParseResult {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "Empty connection string" };

  const detectedType = dbType ?? detectDbType(s);
  if (!detectedType) {
    return { ok: false, error: "Could not detect database type. Prefix with one of: postgres://, mysql://, mongodb://, redis://, sqlserver://, file: or use 'Server=…' key/value form." };
  }

  const detectedFormat = detectFormat(s);
  if (!detectedFormat) {
    return { ok: false, error: `Could not detect format for ${detectedType}. Expected URI (scheme://), key/value (key=value;…), or JDBC (jdbc:…).` };
  }

  try {
    let parts: ConnParts;
    if (detectedFormat === "uri") {
      parts = parseUri(s, detectedType);
    } else if (detectedFormat === "jdbc") {
      parts = parseJdbc(s, detectedType);
    } else {
      parts = parseKeyValue(s, detectedType);
    }

    const warnings: string[] = [];
    if (parts.hosts.length === 0 && detectedType !== "sqlite") {
      warnings.push("No host specified — connection may fail.");
    }
    if (parts.password) {
      warnings.push("Password included — handle with care.");
    }
    if (detectedType === "redis" && parts.database && !/^\d+$/.test(parts.database)) {
      warnings.push("Redis database should be a number; got non-numeric value.");
    }

    return { ok: true, parts, dbType: detectedType, format: detectedFormat, warnings };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Parse failed" };
  }
}

export function parseJdbc(input: string, dbType: DbType): ConnParts {
  const s = (input ?? "").trim();
  const meta = getDbTypeMeta(dbType);
  if (!s.startsWith(meta.jdbcScheme)) {
    throw new Error(`Expected JDBC scheme '${meta.jdbcScheme}:' for ${meta.label}`);
  }
  // Strip 'jdbc:postgresql' / 'jdbc:mysql' / 'jdbc:sqlserver' / 'jdbc:sqlite'
  const rest = s.slice(meta.jdbcScheme.length);
  if (dbType === "sqlite") {
    // jdbc:sqlite:/path or jdbc:sqlite:path
    return { hosts: [], database: percentDecode(rest.replace(/^:?\/*/, "/")), params: {} };
  }
  if (dbType === "sqlserver") {
    // jdbc:sqlserver://host:port;databaseName=db;user=u;password=p
    // Strip '://' if present
    let inner = rest;
    if (inner.startsWith("://")) inner = inner.slice(3);
    // Split host part and params by ';'
    const semiIdx = inner.indexOf(";");
    let hostPart = inner;
    let paramPart = "";
    if (semiIdx >= 0) {
      hostPart = inner.slice(0, semiIdx);
      paramPart = inner.slice(semiIdx + 1);
    }
    const hosts: Host[] = [];
    if (hostPart) {
      const [h, p] = hostPart.split(":");
      hosts.push({ host: percentDecode(h), port: p ? parseInt(p, 10) : undefined });
    }
    // Parse params — note SQL Server uses 'databaseName' for db
    const parts: ConnParts = { hosts, params: {} };
    if (paramPart) {
      for (const pair of paramPart.split(";")) {
        if (!pair) continue;
        const eq = pair.indexOf("=");
        if (eq < 0) continue;
        const k = pair.slice(0, eq).toLowerCase();
        const v = pair.slice(eq + 1);
        if (k === "user") parts.user = percentDecode(v);
        else if (k === "password") parts.password = percentDecode(v);
        else if (k === "databasename") parts.database = percentDecode(v);
        else if (k === "encrypt") {
          parts.params["encrypt"] = v;
          if (v === "true" || v === "yes") parts.ssl = true;
        }
        else parts.params[k] = v;
      }
    }
    return parts;
  }

  // For postgres and mysql: jdbc:postgresql://host:port/db?user=u&password=p
  // Reuse parseUri by stripping 'jdbc:' prefix, then lift user/password from params.
  const parsed = parseUri(s.replace(/^jdbc:/i, ""), dbType);
  if (parsed.params.user) {
    parsed.user = parsed.params.user;
    delete parsed.params.user;
  }
  if (parsed.params.password) {
    parsed.password = parsed.params.password;
    delete parsed.params.password;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Builder — URI
// ---------------------------------------------------------------------------

export function buildUri(parts: ConnParts, dbType: DbType, opts: BuildOptions = {}): string {
  const meta = getDbTypeMeta(dbType);
  if (dbType === "sqlite") {
    return buildSqliteUri(parts, opts);
  }

  const scheme = parts.ssl && dbType === "redis" ? "rediss" : meta.schemes[0];
  let out = `${scheme}://`;

  if (parts.user) {
    out += percentEncode(parts.user);
    if (parts.password) {
      out += ":" + (opts.maskPassword ? "***" : percentEncode(parts.password));
    }
    out += "@";
  }

  const isSrv = scheme === "mongodb+srv";
  const hostsStr = parts.hosts
    .map((h) => {
      const host = percentEncode(h.host);
      if (isSrv || h.port == null) {
        if (opts.includeDefaultPort && meta.defaultPort != null && !isSrv) {
          return `${host}:${meta.defaultPort}`;
        }
        return host;
      }
      return `${host}:${h.port}`;
    })
    .join(",");

  out += hostsStr;

  if (parts.database) {
    out += "/" + percentEncode(parts.database);
  }

  // Params
  const params = { ...parts.params };
  // For redis, the database is also commonly set via path (we already did).
  // For postgres, sslmode goes in params if ssl is true.
  if (parts.ssl && dbType === "postgresql" && !params.sslmode) {
    params.sslmode = "require";
  }
  if (parts.ssl && dbType === "mysql" && !params["ssl-mode"] && !params.useSSL) {
    params["ssl-mode"] = "REQUIRED";
  }

  const paramKeys = Object.keys(params).sort();
  if (paramKeys.length > 0) {
    const sep = dbType === "sqlserver" ? ";" : "&";
    const query = paramKeys
      .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
      .join(sep);
    out += (dbType === "sqlserver" ? ";" : "?") + query;
  }

  return out;
}

function buildSqliteUri(parts: ConnParts, opts: BuildOptions = {}): string {
  let out = "file:";
  if (parts.database) {
    out += percentEncode(parts.database);
  }
  const paramKeys = Object.keys(parts.params).sort();
  if (paramKeys.length > 0) {
    out += "?" + paramKeys.map((k) => `${percentEncode(k)}=${percentEncode(parts.params[k])}`).join("&");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder — key/value
// ---------------------------------------------------------------------------

export function buildKeyValue(parts: ConnParts, dbType: DbType, opts: BuildOptions = {}): string {
  if (dbType === "sqlite") {
    const items: string[] = [`Data Source=${parts.database ?? ""}`];
    for (const k of Object.keys(parts.params).sort()) {
      items.push(`${k}=${parts.params[k]}`);
    }
    if (parts.params.Version == null) items.splice(1, 0, "Version=3");
    return items.join(";");
  }

  const items: string[] = [];

  if (parts.hosts.length > 0) {
    if (dbType === "sqlserver") {
      // Server=host,port or Server=host1,port1;host2,port2
      if (parts.hosts.length === 1) {
        const h = parts.hosts[0];
        const port = h.port ?? meta_defaultPort(dbType);
        items.push(`Server=${h.host}${port ? `,${port}` : ""}`);
      } else {
        const servers = parts.hosts
          .map((h) => {
            const port = h.port ?? meta_defaultPort(dbType);
            return `${h.host}${port ? `,${port}` : ""}`;
          })
          .join(";");
        items.push(`Server=${servers}`);
      }
    } else {
      // postgres / mysql — host=h1,h2 port=p1,p2 (or single port)
      const hosts = parts.hosts.map((h) => h.host).join(",");
      items.push(`host=${hosts}`);
      if (parts.hosts.some((h) => h.port != null)) {
        const ports = parts.hosts.map((h) => (h.port ?? meta_defaultPort(dbType) ?? "").toString());
        items.push(`port=${ports.join(",")}`);
      } else if (meta_defaultPort(dbType) != null) {
        items.push(`port=${meta_defaultPort(dbType)}`);
      }
    }
  }

  if (parts.user) items.push(`${dbType === "sqlserver" ? "User Id" : "user"}=${parts.user}`);
  if (parts.password) {
    items.push(`${dbType === "sqlserver" ? "Password" : "password"}=${opts.maskPassword ? "***" : parts.password}`);
  }
  if (parts.database) {
    if (dbType === "sqlserver") items.push(`Database=${parts.database}`);
    else if (dbType === "postgresql") items.push(`dbname=${parts.database}`);
    else if (dbType === "mysql") items.push(`database=${parts.database}`);
  }

  // Params
  for (const k of Object.keys(parts.params).sort()) {
    items.push(`${k}=${parts.params[k]}`);
  }

  if (parts.ssl && !parts.params.sslmode && !parts.params.encrypt && !parts.params.ssl) {
    if (dbType === "postgresql") items.push("sslmode=require");
    else if (dbType === "sqlserver") items.push("Encrypt=true");
    else items.push("ssl=true");
  }

  return items.join(dbType === "sqlserver" ? ";" : " ");
}

function meta_defaultPort(dbType: DbType): number | null {
  return getDbTypeMeta(dbType).defaultPort;
}

// ---------------------------------------------------------------------------
// Builder — JDBC
// ---------------------------------------------------------------------------

export function buildJdbc(parts: ConnParts, dbType: DbType, opts: BuildOptions = {}): string {
  const meta = getDbTypeMeta(dbType);
  if (!meta.supportsJdbc) {
    throw new Error(`${meta.label} does not support a JDBC connection string.`);
  }

  if (dbType === "sqlite") {
    let path = parts.database ?? "";
    if (!path.startsWith("/")) path = "/" + path;
    return `${meta.jdbcScheme}:${path}`;
  }

  if (dbType === "sqlserver") {
    // jdbc:sqlserver://host:port;databaseName=db;user=u;password=p;encrypt=true
    let out = `${meta.jdbcScheme}://`;
    if (parts.hosts.length > 0) {
      const h = parts.hosts[0];
      const port = h.port ?? meta.defaultPort;
      out += h.host;
      if (port) out += `:${port}`;
    }
    const items: string[] = [];
    if (parts.database) items.push(`databaseName=${parts.database}`);
    if (parts.user) items.push(`user=${parts.user}`);
    if (parts.password) items.push(`password=${opts.maskPassword ? "***" : parts.password}`);
    for (const k of Object.keys(parts.params).sort()) {
      items.push(`${k}=${parts.params[k]}`);
    }
    if (parts.ssl && !parts.params.encrypt) items.push("encrypt=true");
    if (items.length > 0) out += ";" + items.join(";");
    return out;
  }

  // postgres & mysql: jdbc:scheme://host:port/db?user=u&password=p&sslmode=require
  let out = `${meta.jdbcScheme}://`;
  if (parts.hosts.length > 0) {
    const h = parts.hosts[0];
    const port = h.port ?? meta.defaultPort;
    out += h.host;
    if (port) out += `:${port}`;
  }
  if (parts.database) out += "/" + parts.database;

  const params: Record<string, string> = { ...parts.params };
  if (parts.user) params.user = parts.user;
  if (parts.password) params.password = opts.maskPassword ? "***" : parts.password;
  if (parts.ssl && dbType === "postgresql" && !params.sslmode) params.sslmode = "require";
  if (parts.ssl && dbType === "mysql" && !params.useSSL) params.useSSL = "true";

  const keys = Object.keys(params).sort();
  if (keys.length > 0) {
    out += "?" + keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&");
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main build entry
// ---------------------------------------------------------------------------

export function buildConnectionString(
  parts: ConnParts,
  dbType: DbType,
  format: Format,
  opts: BuildOptions = {},
): string {
  if (format === "uri") return buildUri(parts, dbType, opts);
  if (format === "keyvalue") {
    const meta = getDbTypeMeta(dbType);
    if (!meta.supportsKeyValue) {
      throw new Error(`${meta.label} does not support key/value form. Use URI instead.`);
    }
    return buildKeyValue(parts, dbType, opts);
  }
  // jdbc
  return buildJdbc(parts, dbType, opts);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateConnectionString(input: string, dbType?: DbType): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const s = (input ?? "").trim();
  if (!s) {
    errors.push("Connection string is empty.");
    return { ok: false, errors, warnings };
  }

  const detectedType = dbType ?? detectDbType(s);
  if (!detectedType) {
    errors.push("Could not detect database type from the connection string.");
    return { ok: false, errors, warnings };
  }

  const parsed = parseConnectionString(s, detectedType);
  if (!parsed.ok) {
    errors.push(parsed.error);
    return { ok: false, errors, warnings };
  }

  if (parsed.parts.hosts.length === 0 && detectedType !== "sqlite") {
    errors.push("No host specified.");
  }
  for (const h of parsed.parts.hosts) {
    if (!h.host) errors.push("Empty host found.");
    if (h.port != null && (h.port < 1 || h.port > 65535)) {
      errors.push(`Port ${h.port} is out of range (1-65535).`);
    }
  }

  if (parsed.parts.password) {
    warnings.push("Password is included in the connection string — store it securely (env var / secret manager).");
  }
  if (detectedType === "redis" && parsed.parts.database && !/^\d+$/.test(parsed.parts.database)) {
    warnings.push(`Redis 'database' should be numeric; got '${parsed.parts.database}'.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Password masking
// ---------------------------------------------------------------------------

export function maskPasswordParts(parts: ConnParts): ConnParts {
  if (!parts.password) return parts;
  return { ...parts, password: "***" };
}

export function maskPasswordString(input: string): string {
  // Match user:pass@ pattern and replace pass with ***
  return input.replace(/(:\/\/[^:\/@]*):([^@\/]+)@/g, "$1:***@");
}

// ---------------------------------------------------------------------------
// Format conversion
// ---------------------------------------------------------------------------

export type ConvertResult =
  | {
      ok: true;
      output: string;
      dbType: DbType;
      fromFormat: Format;
      toFormat: Format;
      warnings: string[];
    }
  | { ok: false; error: string };

export function convertFormat(
  input: string,
  toFormat: Format,
  toDbType?: DbType,
): ConvertResult {
  const parsed = parseConnectionString(input, toDbType);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const output = buildConnectionString(parsed.parts, parsed.dbType, toFormat);
    return {
      ok: true,
      output,
      dbType: parsed.dbType,
      fromFormat: parsed.format,
      toFormat,
      warnings: parsed.warnings,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Driver hints
// ---------------------------------------------------------------------------

export interface DriverHint {
  framework: string;
  language: string;
  snippet: (parts: ConnParts, dbType: DbType) => string;
}

export function getDriverHints(dbType: DbType): DriverHint[] {
  switch (dbType) {
    case "postgresql":
      return [
        {
          framework: "Prisma",
          language: "TypeScript",
          snippet: (p) => `datasource db {\n  provider = "postgresql"\n  url      = "${buildUri(p, "postgresql")}"\n}`,
        },
        {
          framework: "SQLAlchemy",
          language: "Python",
          snippet: (p) => `from sqlalchemy import create_engine\nengine = create_engine("${buildUri(p, "postgresql")}")`,
        },
        {
          framework: "Spring Boot",
          language: "Java (application.properties)",
          snippet: (p) => `spring.datasource.url=${buildJdbc(p, "postgresql")}\nspring.datasource.username=${p.user ?? ""}\nspring.datasource.password=${p.password ?? ""}`,
        },
      ];
    case "mysql":
      return [
        {
          framework: "Prisma",
          language: "TypeScript",
          snippet: (p) => `datasource db {\n  provider = "mysql"\n  url      = "${buildUri(p, "mysql")}"\n}`,
        },
        {
          framework: "SQLAlchemy",
          language: "Python",
          snippet: (p) => `from sqlalchemy import create_engine\nengine = create_engine("${buildUri(p, "mysql")}")`,
        },
        {
          framework: "Spring Boot",
          language: "Java (application.properties)",
          snippet: (p) => `spring.datasource.url=${buildJdbc(p, "mysql")}\nspring.datasource.username=${p.user ?? ""}\nspring.datasource.password=${p.password ?? ""}`,
        },
      ];
    case "mongodb":
      return [
        {
          framework: "Node.js Driver",
          language: "JavaScript",
          snippet: (p) => `const { MongoClient } = require("mongodb");\nconst client = new MongoClient("${buildUri(p, "mongodb")}");\nawait client.connect();`,
        },
        {
          framework: "PyMongo",
          language: "Python",
          snippet: (p) => `from pymongo import MongoClient\nclient = MongoClient("${buildUri(p, "mongodb")}")`,
        },
        {
          framework: "Spring Data",
          language: "Java (application.properties)",
          snippet: (p) => `spring.data.mongodb.uri=${buildUri(p, "mongodb")}`,
        },
      ];
    case "redis":
      return [
        {
          framework: "node-redis",
          language: "JavaScript",
          snippet: (p) => `import { createClient } from "redis";\nconst client = createClient({ url: "${buildUri(p, "redis")}" });\nawait client.connect();`,
        },
        {
          framework: "redis-py",
          language: "Python",
          snippet: (p) => `import redis\nr = redis.from_url("${buildUri(p, "redis")}")`,
        },
        {
          framework: "Jedis",
          language: "Java",
          snippet: (p) => `import redis.clients.jedis.Jedis;\ntry (Jedis j = new Jedis("${buildUri(p, "redis")}")) {\n  j.ping();\n}`,
        },
      ];
    case "sqlserver":
      return [
        {
          framework: ".NET SqlConnection",
          language: "C#",
          snippet: (p) => `using Microsoft.Data.SqlClient;\nvar cs = "${buildKeyValue(p, "sqlserver")}";\nusing var conn = new SqlConnection(cs);`,
        },
        {
          framework: "SQLAlchemy (pyodbc)",
          language: "Python",
          snippet: (p) => `from sqlalchemy import create_engine\nengine = create_engine("mssql+pyodbc:///?odbc_connect=${encodeURIComponent(buildKeyValue(p, "sqlserver"))}")`,
        },
        {
          framework: "Spring Boot",
          language: "Java (application.properties)",
          snippet: (p) => `spring.datasource.url=${buildJdbc(p, "sqlserver")}\nspring.datasource.username=${p.user ?? ""}\nspring.datasource.password=${p.password ?? ""}`,
        },
      ];
    case "sqlite":
      return [
        {
          framework: "Node sqlite3",
          language: "JavaScript",
          snippet: (p) => `import sqlite3 from "sqlite3";\nconst db = new sqlite3.Database("${p.database ?? ""}");`,
        },
        {
          framework: "Python sqlite3",
          language: "Python",
          snippet: (p) => `import sqlite3\nconn = sqlite3.connect("${p.database ?? ""}")`,
        },
        {
          framework: "Spring Boot",
          language: "Java (application.properties)",
          snippet: (p) => `spring.datasource.url=${buildJdbc(p, "sqlite")}\nspring.datasource.driver-class-name=org.sqlite.JDBC`,
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:connection-string-builder-parser:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dbType: DbType;
  format: Format;
  inputPreview: string;
  outputPreview: string;
  masked: boolean;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL — password always masked
// ---------------------------------------------------------------------------

export function buildShareUrl(parts: ConnParts, dbType: DbType, format: Format): string {
  const params = new URLSearchParams();
  params.set("db", dbType);
  params.set("fmt", format);
  // Build with masked password so share never leaks the secret.
  const safe = buildConnectionString(parts, dbType, format, { maskPassword: true });
  params.set("cs", safe);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShare {
  cs: string;
  dbType: DbType | null;
  format: Format | null;
}

export function parseShareUrl(hash: string): ParsedShare {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { cs: "", dbType: null, format: null };
  const params = new URLSearchParams(clean);
  const cs = params.get("cs") ?? "";
  const dbType = (params.get("db") as DbType | null) ?? null;
  const format = (params.get("fmt") as Format | null) ?? null;
  return { cs, dbType, format };
}

// ---------------------------------------------------------------------------
// Empty ConnParts helper
// ---------------------------------------------------------------------------

export function emptyParts(): ConnParts {
  return { hosts: [{ host: "" }], params: {} };
}
