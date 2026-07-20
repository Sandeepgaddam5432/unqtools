/**
 * Mock SQL Data Generator — pure logic.
 *
 * Generates realistic fake test data from a SQL schema (pasted CREATE TABLE
 * DDL or hand-defined fields) and emits INSERT statements, CSV, or JSON.
 * Supports FK-aware relational generation, deterministic seed, locale-aware
 * realistic data, weighted enums, regex patterns, blank %, unique constraints,
 * batched INSERTs, and multi-dialect output.
 *
 * Pure functions only — no DOM, no network, no external deps. The PRNG is a
 * deterministic mulberry32 seeded from a user-provided number/string so the
 * same seed always produces the same dataset.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Dialect = "mysql" | "postgresql" | "sqlite" | "sqlserver";

export type FakerType =
  | "auto"          // Infer faker type from SQL type
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "username"
  | "phone"
  | "street"
  | "city"
  | "state"
  | "country"
  | "zip"
  | "company"
  | "job_title"
  | "sentence"
  | "paragraph"
  | "url"
  | "ipv4"
  | "ipv6"
  | "uuid"
  | "date_past"
  | "date_future"
  | "date_recent"
  | "timestamp"
  | "time"
  | "boolean"
  | "int"
  | "bigint"
  | "decimal"
  | "money"
  | "age"
  | "hex_color"
  | "enum"
  | "regex"
  | "constant"
  | "null";

export interface ColumnSchema {
  name: string;
  /** SQL type (lowercase, no args). */
  sqlType: string;
  nullable: boolean;
  defaultValue?: string;
  defaultIsExpression?: boolean;
  autoIncrement?: boolean;
  /** Faker type override (defaults to "auto" — inferred from sqlType). */
  fakerType: FakerType;
  /** Min for int/decimal. */
  min?: number;
  /** Max for int/decimal. */
  max?: number;
  /** Decimal scale (digits after point). */
  scale?: number;
  /** Blank percent 0-100 — even for NOT NULL columns, treated as "emit default or skip". */
  blankPercent?: number;
  /** Enforce uniqueness (collision-safe retry). */
  unique?: boolean;
  /** ENUM values (weighted: [["a", 3], ["b", 1]] → 75% a, 25% b). */
  enumValues?: Array<string | [string, number]>;
  /** Regex pattern (only when fakerType === "regex"). */
  pattern?: string;
  /** Constant value (only when fakerType === "constant"). */
  constantValue?: string;
}

export interface ForeignKeyRef {
  /** Local column names (parallel to refColumns). */
  columns: string[];
  refTable: string;
  refColumns: string[];
}

export interface UniqueConstraint {
  name?: string;
  columns: string[];
}

export interface TableSchema {
  name: string;
  dialect: Dialect;
  columns: ColumnSchema[];
  foreignKeys: ForeignKeyRef[];
  uniques: UniqueConstraint[];
}

export interface GenerationConfig {
  rowCount: number;
  seed: number;
  /** Batch size for INSERTs (1 = one row per INSERT; >1 = multi-row INSERT). */
  batchSize: number;
  /** Locale hint (currently en only). */
  locale: "en";
}

export type GeneratedRow = Record<string, string | null>;

export interface GeneratedTable {
  name: string;
  columns: string[];
  rows: GeneratedRow[];
}

export type GeneratedDataset = Record<string, GeneratedTable>;

export interface GenerationResult {
  ok: true;
  dataset: GeneratedDataset;
  order: string[];      // Insert order (topological)
  warnings: string[];
}

export interface GenerationError {
  ok: false;
  error: string;
}

export type GenerationOutcome = GenerationResult | GenerationError;

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const DIALECTS: ReadonlyArray<{ value: Dialect; label: string }> = [
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server (T-SQL)" },
];

export const FAKER_TYPES: ReadonlyArray<{ value: FakerType; label: string; description: string }> = [
  { value: "auto", label: "Auto (infer from SQL type)", description: "Pick a sensible faker type from the SQL column type." },
  { value: "first_name", label: "First name", description: "e.g. Alice" },
  { value: "last_name", label: "Last name", description: "e.g. Smith" },
  { value: "full_name", label: "Full name", description: "e.g. Alice Smith" },
  { value: "email", label: "Email", description: "e.g. alice.smith@example.com" },
  { value: "username", label: "Username", description: "e.g. alice.smith42" },
  { value: "phone", label: "Phone", description: "e.g. +1-555-123-4567" },
  { value: "street", label: "Street address", description: "e.g. 123 Main St" },
  { value: "city", label: "City", description: "e.g. Springfield" },
  { value: "state", label: "State/Province", description: "e.g. IL" },
  { value: "country", label: "Country", description: "e.g. United States" },
  { value: "zip", label: "ZIP/Postal code", description: "e.g. 62704" },
  { value: "company", label: "Company name", description: "e.g. Acme Inc" },
  { value: "job_title", label: "Job title", description: "e.g. Software Engineer" },
  { value: "sentence", label: "Sentence", description: "Lorem-ipsum short sentence" },
  { value: "paragraph", label: "Paragraph", description: "Lorem-ipsum paragraph" },
  { value: "url", label: "URL", description: "e.g. https://example.com/page" },
  { value: "ipv4", label: "IPv4 address", description: "e.g. 192.168.1.1" },
  { value: "ipv6", label: "IPv6 address", description: "e.g. 2001:db8::1" },
  { value: "uuid", label: "UUID v4", description: "e.g. 550e8400-e29b-41d4-a716-446655440000" },
  { value: "date_past", label: "Past date", description: "ISO date in the past 30 years" },
  { value: "date_future", label: "Future date", description: "ISO date in the next 5 years" },
  { value: "date_recent", label: "Recent date", description: "ISO date in the last 90 days" },
  { value: "timestamp", label: "Timestamp", description: "ISO timestamp (datetime)" },
  { value: "time", label: "Time", description: "HH:MM:SS" },
  { value: "boolean", label: "Boolean", description: "true/false (or 0/1)" },
  { value: "int", label: "Integer", description: "Random int between min/max (default 1-1000)" },
  { value: "bigint", label: "Big integer", description: "Random bigint between min/max" },
  { value: "decimal", label: "Decimal", description: "Random decimal with scale" },
  { value: "money", label: "Money", description: "Currency value e.g. 1234.56" },
  { value: "age", label: "Age", description: "Integer 18-99" },
  { value: "hex_color", label: "Hex color", description: "e.g. #1a2b3c" },
  { value: "enum", label: "ENUM (weighted)", description: "Pick from enumValues with optional weights" },
  { value: "regex", label: "Regex pattern", description: "String matching the `pattern` regex" },
  { value: "constant", label: "Constant", description: "Always emit `constantValue`" },
  { value: "null", label: "Always NULL", description: "Emit NULL (only for nullable columns)" },
];

// Curated data pools (en locale)
export const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
  "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine", "Frank", "Debra",
  "Alexander", "Rachel", "Raymond", "Catherine", "Patrick", "Carolyn", "Jack", "Janet",
  "Dennis", "Ruth", "Jerry", "Maria", "Tyler", "Heather", "Aaron", "Diane",
];

export const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
  "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
];

export const CITIES = [
  "Springfield", "Riverdale", "Franklin", "Clinton", "Madison", "Georgetown",
  "Salem", "Arlington", "Fairview", "Greenville", "Bristol", "Manchester",
  "Oakwood", "Centerville", "Lakewood", "Fairfield", "Riverside", "Kingston",
  "Burlington", "Ashland", "York", "Westwood", "Bayside", "Hillcrest",
];

export const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV",
  "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
  "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Sweden", "Norway", "Denmark", "Japan", "Brazil",
  "Mexico", "India", "Singapore",
];

export const COMPANIES = [
  "Acme Inc", "Globex Corp", "Initech", "Umbrella Ltd", "Stark Industries", "Wayne Enterprises",
  "Soylent Co", "Hooli", "Pied Piper", "Vandelay Industries", "Wonka Factory",
  "Cyberdyne Systems", "Aperture Science", "Tyrell Corp", "Massive Dynamic", "Oscorp",
];

export const JOB_TITLES = [
  "Software Engineer", "Product Manager", "Designer", "Data Analyst", "DevOps Engineer",
  "Marketing Lead", "Sales Rep", "Customer Success", "QA Engineer", "Engineering Manager",
  "CFO", "CTO", "CEO", "HR Specialist", "Recruiter", "Accountant", "Consultant",
];

export const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
];

// ---------------------------------------------------------------------------
// PRNG (mulberry32) — deterministic, seedable
// ---------------------------------------------------------------------------

/** Create a mulberry32 PRNG function from a numeric seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit integer seed (FNV-1a). */
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick a random element from an array. */
export function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: () => number, min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Random decimal in [min, max] with `scale` digits after point. */
export function randDecimal(rng: () => number, min: number, max: number, scale = 2): string {
  if (min > max) [min, max] = [max, min];
  const v = rng() * (max - min) + min;
  return v.toFixed(scale);
}

/** Random date in ISO format between minDays and maxDays from now. */
export function randDate(rng: () => number, minDays: number, maxDays: number): string {
  const now = Date.now();
  const offsetMs = randInt(rng, minDays, maxDays) * 24 * 60 * 60 * 1000;
  const d = new Date(now + offsetMs);
  return d.toISOString().slice(0, 10);
}

/** Random timestamp in ISO format. */
export function randTimestamp(rng: () => number, minDays: number, maxDays: number): string {
  const now = Date.now();
  const offsetMs = randInt(rng, minDays, maxDays) * 24 * 60 * 60 * 1000;
  const subSec = Math.floor(rng() * 86400000);
  const d = new Date(now + offsetMs + subSec);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Random HH:MM:SS time. */
export function randTime(rng: () => number): string {
  const h = randInt(rng, 0, 23);
  const m = randInt(rng, 0, 59);
  const s = randInt(rng, 0, 59);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Random IPv4. */
export function randIpv4(rng: () => number): string {
  return `${randInt(rng, 1, 254)}.${randInt(rng, 0, 255)}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}`;
}

/** Random IPv6 (shortened form). */
export function randIpv6(rng: () => number): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    parts.push(randInt(rng, 0, 65535).toString(16).padStart(4, "0"));
  }
  return parts.join(":");
}

/** Random UUID v4. */
export function randUuid(rng: () => number): string {
  // Use rng to drive each nibble so it's deterministic.
  const hex = "0123456789abcdef";
  const out: string[] = [];
  for (let i = 0; i < 32; i++) {
    if (i === 12) out.push("4");
    else if (i === 16) out.push(hex[8 + Math.floor(rng() * 4)]);
    else out.push(hex[Math.floor(rng() * 16)]);
  }
  return `${out.slice(0, 8).join("")}-${out.slice(8, 12).join("")}-${out.slice(12, 16).join("")}-${out.slice(16, 20).join("")}-${out.slice(20, 32).join("")}`;
}

/** Random hex color (#rrggbb). */
export function randHexColor(rng: () => number): string {
  const h = "0123456789abcdef";
  let out = "#";
  for (let i = 0; i < 6; i++) out += h[Math.floor(rng() * 16)];
  return out;
}

/** Expand a character class like "a-z0-9_" into an array of literal chars. */
export function expandCharClass(cls: string): string[] {
  const out: string[] = [];
  let i = 0;
  let negate = false;
  if (cls[0] === "^") { negate = true; i++; }
  while (i < cls.length) {
    if (cls[i + 1] === "-" && cls[i + 2]) {
      const start = cls.charCodeAt(i);
      const end = cls.charCodeAt(i + 2);
      for (let c = start; c <= end; c++) out.push(String.fromCharCode(c));
      i += 3;
    } else if (cls[i] === "\\") {
      // Escape inside class: \d, \w, \s
      const next = cls[i + 1];
      if (next === "d") for (let c = 48; c <= 57; c++) out.push(String.fromCharCode(c));
      else if (next === "w") for (let c = 48; c <= 57; c++) out.push(String.fromCharCode(c));
      else if (next === "s") out.push(" ");
      else out.push(next ?? "");
      i += 2;
    } else {
      out.push(cls[i]);
      i++;
    }
  }
  if (negate) {
    const all: string[] = [];
    for (let c = 32; c <= 126; c++) {
      const ch = String.fromCharCode(c);
      if (!out.includes(ch)) all.push(ch);
    }
    return all;
  }
  return out;
}

/** Generate a string matching a regex pattern (best-effort). Handles common cases. */
export function genFromRegex(rng: () => number, pattern: string): string {
  try {
    // Sanity check the pattern compiles.
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch {
    return "x";
  }
  // Strip leading ^ and trailing $.
  let p = pattern;
  if (p.startsWith("^")) p = p.slice(1);
  if (p.endsWith("$")) p = p.slice(0, -1);
  let out = "";
  let i = 0;
  let lastGen: (() => string) | null = null;
  let lastLiteral = "";
  while (i < p.length) {
    const ch = p[i];
    if (ch === "[") {
      const end = p.indexOf("]", i);
      if (end === -1) { out += "x"; break; }
      const cls = p.slice(i + 1, end);
      const chars = expandCharClass(cls);
      if (chars.length > 0) {
        const gen = () => pick(rng, chars);
        const picked = gen();
        out += picked;
        lastGen = gen;
        lastLiteral = picked;
      }
      i = end + 1;
    } else if (ch === "{") {
      const end = p.indexOf("}", i);
      if (end === -1) { out += "x"; break; }
      const q = p.slice(i + 1, end);
      const m = q.match(/^(\d+)(?:,(\d*))?$/);
      if (m) {
        const min = parseInt(m[1], 10);
        const max = (m[2] !== undefined && m[2] !== "") ? parseInt(m[2], 10) : min;
        // Already added one occurrence; produce min-1..max-1 more, re-rolling the generator if available.
        const extra = (min - 1) + (max > min ? randInt(rng, 0, max - min) : 0);
        for (let k = 0; k < extra; k++) {
          if (lastGen) {
            const g = lastGen();
            out += g;
            lastLiteral = g;
          } else if (lastLiteral) {
            out += lastLiteral;
          }
        }
      }
      i = end + 1;
    } else if (ch === "\\") {
      const next = p[i + 1];
      let gen: (() => string) | null = null;
      if (next === "d") gen = () => String(randInt(rng, 0, 9));
      else if (next === "w") gen = () => pick(rng, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split(""));
      else if (next === "s") gen = () => " ";
      if (gen) {
        const g = gen();
        out += g;
        lastGen = gen;
        lastLiteral = g;
      } else {
        out += next ?? "";
        lastGen = () => next ?? "";
        lastLiteral = next ?? "";
      }
      i += 2;
    } else if (ch === ".") {
      const gen = () => pick(rng, "abcdefghijklmnopqrstuvwxyz".split(""));
      const g = gen();
      out += g;
      lastGen = gen;
      lastLiteral = g;
      i++;
    } else if (ch === "+") {
      // Repeat last token 0-3 more times, re-rolling if possible
      if (lastGen) {
        const n = randInt(rng, 0, 3);
        for (let k = 0; k < n; k++) { const g = lastGen(); out += g; lastLiteral = g; }
      } else if (lastLiteral) {
        out += lastLiteral.repeat(randInt(rng, 0, 3));
      }
      i++;
    } else if (ch === "*") {
      // Repeat last token 0-2 more times
      if (lastGen) {
        const n = randInt(rng, 0, 2);
        for (let k = 0; k < n; k++) { const g = lastGen(); out += g; lastLiteral = g; }
      } else if (lastLiteral) {
        out += lastLiteral.repeat(randInt(rng, 0, 2));
      }
      i++;
    } else if (ch === "?") {
      // Optional — skip
      i++;
    } else if (ch === "(" || ch === ")" || ch === "|" || ch === "^" || ch === "$") {
      // Grouping/alternation/anchors — ignore for this simple generator
      i++;
    } else {
      out += ch;
      lastGen = () => ch;
      lastLiteral = ch;
      i++;
    }
  }
  // Final verification — if it doesn't match, brute-force a few random strings.
  try {
    const re = new RegExp(pattern);
    if (re.test(out)) return out;
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let attempt = 0; attempt < 50; attempt++) {
      const len = randInt(rng, 1, 16);
      let s = "";
      for (let j = 0; j < len; j++) s += alphabet[Math.floor(rng() * alphabet.length)];
      if (re.test(s)) return s;
    }
  } catch {
    // ignore
  }
  return out;
}

/** Build a sentence of n lorem-ipsum words. */
export function loremSentence(rng: () => number, n: number): string {
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(pick(rng, LOREM_WORDS));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/** Build a paragraph of n sentences. */
export function loremParagraph(rng: () => number, sentences: number): string {
  const parts: string[] = [];
  for (let i = 0; i < sentences; i++) parts.push(loremSentence(rng, randInt(rng, 4, 12)));
  return parts.join(" ");
}

/** Generate a weighted ENUM value. */
export function pickWeighted(rng: () => number, values: Array<string | [string, number]>): string {
  if (values.length === 0) return "";
  // Normalize to [value, weight]
  const pairs: Array<[string, number]> = values.map((v) =>
    Array.isArray(v) ? [v[0], v[1]] : [v, 1],
  );
  const total = pairs.reduce((sum, p) => sum + p[1], 0);
  let r = rng() * total;
  for (const [val, w] of pairs) {
    r -= w;
    if (r <= 0) return val;
  }
  return pairs[pairs.length - 1][0];
}

// ---------------------------------------------------------------------------
// DDL parser
// ---------------------------------------------------------------------------

/** Strip SQL comments: double-dash line, hash (MySQL), and slash-star block. */
export function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      // skip to end of line
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (sql[i] === "#") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (two === "/*") {
      i += 2;
      while (i < sql.length && sql.slice(i, i + 2) !== "*/") i++;
      i += 2;
      continue;
    }
    if (sql[i] === "'") {
      // string literal — copy through
      out += sql[i++];
      while (i < sql.length && sql[i] !== "'") out += sql[i++];
      if (i < sql.length) out += sql[i++];
      continue;
    }
    out += sql[i++];
  }
  return out;
}

/** Split DDL into individual CREATE TABLE statements. */
export function splitCreateStatements(sql: string): string[] {
  const stripped = stripComments(sql);
  const stmts: string[] = [];
  // Find each "CREATE TABLE" occurrence; assume semicolon-terminated.
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    const start = match.index;
    // Find next semicolon at top level (not inside parens).
    let depth = 0;
    let end = start;
    for (let i = start; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === ";" && depth === 0) { end = i + 1; break; }
    }
    if (end === start) end = stripped.length;
    stmts.push(stripped.slice(start, end).trim());
  }
  return stmts;
}

/** Parse a single CREATE TABLE statement into a TableSchema. */
export function parseCreateTable(ddl: string, dialect: Dialect): TableSchema | null {
  const stripped = stripComments(ddl).trim();
  if (!stripped) return null;
  // Match: CREATE TABLE [IF NOT EXISTS] <name> ( ... ) [tail];
  const headerRe = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w"\`\[\].-]+)\s*\(([\s\S]*)\)\s*[^;]*;?$/i;
  const m = headerRe.exec(stripped);
  if (!m) return null;
  let name = m[1];
  // Strip quotes/brackets/backticks from name
  name = name.replace(/^["`\[]|["`\]]$/g, "");
  const body = m[2];
  // Split body into items at top-level commas.
  const items = splitTopLevelCommas(body);
  const columns: ColumnSchema[] = [];
  const foreignKeys: ForeignKeyRef[] = [];
  const uniques: UniqueConstraint[] = [];
  const pkCols: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const upper = item.toUpperCase();
    if (upper.startsWith("PRIMARY KEY")) {
      const colsMatch = item.match(/\(([^)]+)\)/);
      if (colsMatch) {
        for (const c of colsMatch[1].split(",")) {
          pkCols.push(c.trim().replace(/^["`\[]|["`\]]$/g, ""));
        }
      }
      continue;
    }
    if (upper.startsWith("FOREIGN KEY")) {
      const localMatch = item.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
      const refMatch = item.match(/REFERENCES\s+([\w"\`\[\].-]+)\s*\(([^)]+)\)/i);
      if (localMatch && refMatch) {
        const localCols = localMatch[1].split(",").map((c) => c.trim().replace(/^["`\[]|["`\]]$/g, ""));
        const refTable = refMatch[1].replace(/^["`\[]|["`\]]$/g, "");
        const refCols = refMatch[2].split(",").map((c) => c.trim().replace(/^["`\[]|["`\]]$/g, ""));
        foreignKeys.push({ columns: localCols, refTable, refColumns: refCols });
      }
      continue;
    }
    if (upper.startsWith("UNIQUE")) {
      const colsMatch = item.match(/\(([^)]+)\)/);
      const nameMatch = item.match(/CONSTRAINT\s+([\w"\`\[\].-]+)/i);
      if (colsMatch) {
        uniques.push({
          name: nameMatch ? nameMatch[1].replace(/^["`\[]|["`\]]$/g, "") : undefined,
          columns: colsMatch[1].split(",").map((c) => c.trim().replace(/^["`\[]|["`\]]$/g, "")),
        });
      }
      continue;
    }
    if (upper.startsWith("CONSTRAINT")) {
      // Skip CONSTRAINT ... CHECK / UNIQUE / FK — already handled or unsupported
      const colsMatch = item.match(/\(([^)]+)\)/);
      const nameMatch = item.match(/CONSTRAINT\s+([\w"\`\[\].-]+)/i);
      if (upper.includes("UNIQUE") && colsMatch) {
        uniques.push({
          name: nameMatch ? nameMatch[1].replace(/^["`\[]|["`\]]$/g, "") : undefined,
          columns: colsMatch[1].split(",").map((c) => c.trim().replace(/^["`\[]|["`\]]$/g, "")),
        });
      }
      continue;
    }
    if (upper.startsWith("CHECK") || upper.startsWith("INDEX") || upper.startsWith("KEY") || upper.startsWith("UNIQUE KEY")) {
      continue;
    }
    // Otherwise: column definition
    const col = parseColumnDef(item, dialect);
    if (col) columns.push(col);
  }
  // Mark PK columns as NOT NULL and unique
  for (const c of columns) {
    if (pkCols.includes(c.name)) {
      c.nullable = false;
      c.unique = true;
    }
  }
  // Promote inline REFERENCES to table-level FKs.
  const inlineFks: ForeignKeyRef[] = [];
  for (const c of columns) {
    const inlineRef = (c as ColumnSchema & { _inlineRef?: { refTable: string; refColumn: string } })._inlineRef;
    if (inlineRef) {
      inlineFks.push({
        columns: [c.name],
        refTable: inlineRef.refTable,
        refColumns: [inlineRef.refColumn],
      });
      delete (c as ColumnSchema & { _inlineRef?: unknown })._inlineRef;
    }
  }
  return { name, dialect, columns, foreignKeys: [...foreignKeys, ...inlineFks], uniques };
}

/** Parse a single column definition line. */
export function parseColumnDef(line: string, dialect: Dialect): ColumnSchema | null {
  // Match: `name` TYPE[(len[,scale])] [UNSIGNED] [NOT NULL | NULL] [DEFAULT ...] [AUTO_INCREMENT | AUTOINCREMENT | IDENTITY(...)] [PRIMARY KEY] [COMMENT '...'] [REFERENCES ...]
  const re = /^([\w"\`\[\].-]+)\s+([\w]+(?:\s+(?:VARYING|PRECISION))?)(\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?\s*(.*)$/i;
  const m = re.exec(line);
  if (!m) return null;
  const name = m[1].replace(/^["`\[]|["`\]]$/g, "");
  const rawType = m[2].replace(/\s+/g, " ").trim().toLowerCase();
  const length = m[4] ? Number(m[4]) : undefined;
  const scale = m[5] ? Number(m[5]) : undefined;
  const rest = (m[6] || "").trim();
  const col: ColumnSchema = {
    name,
    sqlType: rawType,
    nullable: true,
    fakerType: "auto",
  };
  if (length !== undefined) col.scale = undefined; // length lives on sqlType
  if (scale !== undefined) col.scale = scale;
  void dialect;
  // Parse modifiers
  const upper = rest.toUpperCase();
  if (/\bNOT\s+NULL\b/.test(upper)) col.nullable = false;
  if (/\bNULL\b/.test(upper) && !/\bNOT\s+NULL\b/.test(upper)) col.nullable = true;
  // Default
  const defMatch = rest.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s,]+)/i);
  if (defMatch) {
    let v = defMatch[1];
    if (v.startsWith("'") && v.endsWith("'")) {
      v = v.slice(1, -1).replace(/''/g, "'");
    } else {
      col.defaultIsExpression = true;
    }
    col.defaultValue = v;
  }
  // Auto-increment
  if (/\bAUTO_INCREMENT\b|\bAUTOINCREMENT\b|\bIDENTITY\b/.test(upper)) {
    col.autoIncrement = true;
  }
  // Inline REFERENCES
  const refMatch = rest.match(/REFERENCES\s+([\w"\`\[\].-]+)\s*\(([^)]+)\)/i);
  if (refMatch) {
    // Track via the column-level (we'll fold into table-level FK after parsing).
    // For now, stash on the column for the caller to collect.
    (col as ColumnSchema & { _inlineRef?: { refTable: string; refColumn: string } })._inlineRef = {
      refTable: refMatch[1].replace(/^["`\[]|["`\]]$/g, ""),
      refColumn: refMatch[2].split(",")[0].trim().replace(/^["`\[]|["`\]]$/g, ""),
    };
  }
  // ENUM values: MySQL `ENUM('a','b')` — note this is parsed as the type with the args.
  const enumMatch = line.match(/ENUM\s*\(([^)]+)\)/i);
  if (enumMatch) {
    col.sqlType = "enum";
    col.enumValues = enumMatch[1].split(",").map((v) => v.trim().replace(/^'|'$/g, "").replace(/''/g, "'"));
  }
  return col;
}

/** Split a string at top-level commas (depth-aware). */
export function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (s[i + 1] === "'") { cur += "'"; i++; }
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === "(") { depth++; cur += ch; continue; }
    if (ch === ")") { depth--; cur += ch; continue; }
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Parse multiple CREATE TABLE statements into TableSchemas. */
export function parseDdl(ddl: string, dialect: Dialect): TableSchema[] {
  const stmts = splitCreateStatements(ddl);
  const out: TableSchema[] = [];
  for (const s of stmts) {
    const t = parseCreateTable(s, dialect);
    if (t) {
      // Promote inline REFERENCES to table-level FKs.
      const inlineFks: ForeignKeyRef[] = [];
      for (const col of t.columns) {
        const inlineRef = (col as ColumnSchema & { _inlineRef?: { refTable: string; refColumn: string } })._inlineRef;
        if (inlineRef) {
          inlineFks.push({
            columns: [col.name],
            refTable: inlineRef.refTable,
            refColumns: [inlineRef.refColumn],
          });
          delete (col as ColumnSchema & { _inlineRef?: unknown })._inlineRef;
        }
      }
      t.foreignKeys = [...t.foreignKeys, ...inlineFks];
      out.push(t);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auto faker type inference
// ---------------------------------------------------------------------------

export function inferFakerType(col: ColumnSchema): FakerType {
  if (col.fakerType !== "auto") return col.fakerType;
  const t = col.sqlType.toLowerCase();
  // Name heuristics
  const n = col.name.toLowerCase();
  if (n === "email" || n === "e_mail" || n.includes("email")) return "email";
  if (n === "first_name" || n === "firstname" || n === "fname" || n === "given_name") return "first_name";
  if (n === "last_name" || n === "lastname" || n === "lname" || n === "surname" || n === "family_name") return "last_name";
  if (n === "full_name" || n === "fullname" || n === "name") return "full_name";
  if (n === "username" || n === "user_name" || n === "login" || n === "handle") return "username";
  if (n === "phone" || n.includes("phone") || n === "mobile" || n === "telephone") return "phone";
  if (n === "street" || n.includes("street") || n.includes("address")) return "street";
  if (n === "city" || n.includes("city")) return "city";
  if (n === "state" || n === "province" || n === "region") return "state";
  if (n === "country" || n.includes("country")) return "country";
  if (n === "zip" || n === "zip_code" || n === "postcode" || n === "postal_code") return "zip";
  if (n === "company" || n.includes("company") || n.includes("organization")) return "company";
  if (n === "job_title" || n === "jobtitle" || n === "title" || n === "position") return "job_title";
  if (n === "url" || n === "website" || n === "homepage" || n.includes("url")) return "url";
  if (n === "ip" || n === "ip_address" || n === "ipaddress" || n === "ipv4") return "ipv4";
  if (n === "ipv6") return "ipv6";
  if (n === "uuid" || n === "guid" || n === "id" && t === "uuid") return "uuid";
  if (n === "color" || n === "hex_color" || n === "colour") return "hex_color";
  if (n === "age") return "age";
  if (n === "salary" || n === "price" || n === "amount" || n === "balance" || n === "cost") return "money";
  if (n === "description" || n === "comment" || n === "body" || n === "content" || n === "bio") return "paragraph";
  if (n === "title" || n === "subject" || n === "headline") return "sentence";
  // Type heuristics
  if (t === "enum") return "enum";
  if (t === "boolean" || t === "bool" || t === "bit") return "boolean";
  if (t === "tinyint" || t === "smallint" || t === "mediumint" || t === "int" || t === "integer") return "int";
  if (t === "bigint") return "bigint";
  if (t === "decimal" || t === "numeric" || t === "float" || t === "double" || t === "real" || t === "money") return "decimal";
  if (t === "date") return "date_recent";
  if (t === "datetime" || t === "timestamp") return "timestamp";
  if (t === "time") return "time";
  if (t === "uuid") return "uuid";
  if (t === "json" || t === "jsonb") return "constant";
  if (t === "blob" || t === "binary" || t === "varbinary" || t === "bytea") return "constant";
  if (t === "char" || t === "varchar" || t === "text" || t === "mediumtext" || t === "longtext") return "sentence";
  return "int";
}

// ---------------------------------------------------------------------------
// Value generation
// ---------------------------------------------------------------------------

/** Generate a single column value (string form, ready for SQL/CSV). Returns null for NULL. */
export function generateColumnValue(
  col: ColumnSchema,
  rng: () => number,
  parentRow?: GeneratedRow,
): string | null {
  // Auto-increment: skipped (DB provides)
  if (col.autoIncrement) return null;
  // Explicit default
  if (col.defaultValue !== undefined && col.defaultValue !== "") {
    if (col.defaultIsExpression) {
      // Treat common expressions
      const v = col.defaultValue.toUpperCase();
      if (v === "CURRENT_TIMESTAMP" || v === "NOW()") return randTimestamp(rng, 0, 0);
      if (v === "CURRENT_DATE") return randDate(rng, 0, 0);
      if (v === "TRUE") return "TRUE";
      if (v === "FALSE") return "FALSE";
      // Pass through other expressions as the literal
      return col.defaultValue;
    }
    // Blank % check for default
    if (col.blankPercent && rng() * 100 < col.blankPercent) return null;
    return col.defaultValue;
  }
  // Blank % (only for nullable columns or enums)
  if (col.blankPercent && rng() * 100 < col.blankPercent) {
    if (col.nullable) return null;
    // For NOT NULL: fall through to generate a real value
  }
  // NULL for nullable columns: 5% chance if no blankPercent set
  if (col.nullable && !col.blankPercent && rng() < 0.05) return null;
  // FK column: pull from parent row
  if (parentRow) {
    const parentVal = parentRow[col.name];
    if (parentVal !== undefined) return parentVal;
  }
  const ft = inferFakerType(col);
  switch (ft) {
    case "first_name": return pick(rng, FIRST_NAMES);
    case "last_name": return pick(rng, LAST_NAMES);
    case "full_name": return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    case "email": {
      const fn = pick(rng, FIRST_NAMES).toLowerCase();
      const ln = pick(rng, LAST_NAMES).toLowerCase();
      const n = randInt(rng, 1, 9999);
      const domains = ["example.com", "test.org", "mock.io", "fake.net"];
      return `${fn}.${ln}${n}@${pick(rng, domains)}`;
    }
    case "username": {
      const fn = pick(rng, FIRST_NAMES).toLowerCase();
      const ln = pick(rng, LAST_NAMES).toLowerCase();
      return `${fn}.${ln}${randInt(rng, 1, 999)}`;
    }
    case "phone": {
      const a = randInt(rng, 200, 999);
      const b = randInt(rng, 200, 999);
      const c = randInt(rng, 1000, 9999);
      return `+1-${a}-${b}-${c}`;
    }
    case "street": return `${randInt(rng, 1, 9999)} ${pick(rng, ["Main", "Oak", "Pine", "Maple", "Cedar", "Elm", "Park", "Lake", "Hill", "River"])} St`;
    case "city": return pick(rng, CITIES);
    case "state": return pick(rng, STATES);
    case "country": return pick(rng, COUNTRIES);
    case "zip": return String(randInt(rng, 10000, 99999));
    case "company": return pick(rng, COMPANIES);
    case "job_title": return pick(rng, JOB_TITLES);
    case "sentence": return loremSentence(rng, randInt(rng, 4, 10));
    case "paragraph": return loremParagraph(rng, randInt(rng, 2, 5));
    case "url": {
      const tlds = ["com", "org", "io", "net", "dev"];
      return `https://${pick(rng, COMPANIES).toLowerCase().replace(/[^a-z]/g, "")}.${pick(rng, tlds)}/${pick(rng, LOREM_WORDS)}`;
    }
    case "ipv4": return randIpv4(rng);
    case "ipv6": return randIpv6(rng);
    case "uuid": return randUuid(rng);
    case "date_past": return randDate(rng, -365 * 30, -1);
    case "date_future": return randDate(rng, 1, 365 * 5);
    case "date_recent": return randDate(rng, -90, 0);
    case "timestamp": return randTimestamp(rng, -365 * 5, 0);
    case "time": return randTime(rng);
    case "boolean": return rng() < 0.5 ? "TRUE" : "FALSE";
    case "int": return String(randInt(rng, col.min ?? 1, col.max ?? 1000));
    case "bigint": return String(randInt(rng, col.min ?? 1, col.max ?? 2147483647));
    case "decimal": return randDecimal(rng, col.min ?? 0, col.max ?? 10000, col.scale ?? 2);
    case "money": return randDecimal(rng, col.min ?? 0, col.max ?? 100000, 2);
    case "age": return String(randInt(rng, 18, 99));
    case "hex_color": return randHexColor(rng);
    case "enum": return pickWeighted(rng, col.enumValues ?? []);
    case "regex": return col.pattern ? genFromRegex(rng, col.pattern) : "x";
    case "constant": return col.constantValue ?? "";
    case "null": return null;
    default: return "";
  }
}

/** Generate a single row for a table, optionally drawing FK values from parent tables. */
export function generateRow(
  table: TableSchema,
  rng: () => number,
  parentRowsByTable?: Record<string, GeneratedRow[]>,
  uniqueTrackers?: Record<string, Set<string>>,
): GeneratedRow {
  const row: GeneratedRow = {};
  let autoInc = 0;
  // Build a map of FK column → parent table column values
  for (const col of table.columns) {
    if (col.autoIncrement) {
      autoInc++;
      // Will be assigned by DB; emit NULL (the DB provides) but we still need a unique value for FK references
      row[col.name] = String(uniqueTrackers ? uniqueTrackers[`${table.name}.${col.name}`]?.size ?? 0 + 1 : 0);
      continue;
    }
    // Find a FK that references this column
    const fk = table.foreignKeys.find((f) => f.columns.includes(col.name));
    let parentRow: GeneratedRow | undefined;
    if (fk && parentRowsByTable && parentRowsByTable[fk.refTable]) {
      const parentRows = parentRowsByTable[fk.refTable];
      if (parentRows.length > 0) {
        // Pick a random parent row and use its refColumn value
        const parentR = parentRows[randInt(rng, 0, parentRows.length - 1)];
        const refColIdx = fk.columns.indexOf(col.name);
        const refCol = fk.refColumns[refColIdx];
        if (refCol && parentR[refCol] !== undefined) {
          row[col.name] = parentR[refCol];
          continue;
        }
      }
    }
    // Unique enforcement: retry up to 100 times
    let value: string | null = null;
    const uniqueKey = `${table.name}.${col.name}`;
    const tracker = col.unique && uniqueTrackers ? uniqueTrackers[uniqueKey] : undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      value = generateColumnValue(col, rng);
      if (value === null) break;
      if (!tracker) break;
      if (!tracker.has(value)) {
        tracker.add(value);
        break;
      }
      value = null; // collision, retry
    }
    row[col.name] = value;
  }
  // Composite unique enforcement (best-effort: check signature)
  for (const u of table.uniques) {
    if (u.columns.length <= 1) continue;
    const sigKey = `${table.name}.uq.${u.name ?? u.columns.join("_")}`;
    const tracker = uniqueTrackers?.[sigKey];
    if (!tracker) continue;
    let sig = u.columns.map((c) => row[c] ?? "").join("\u0001");
    let attempts = 0;
    while (tracker.has(sig) && attempts < 50) {
      // Regenerate just the unique columns
      for (const c of u.columns) {
        const colSchema = table.columns.find((cs) => cs.name === c);
        if (colSchema && !colSchema.autoIncrement) {
          row[c] = generateColumnValue(colSchema, rng);
        }
      }
      sig = u.columns.map((c) => row[c] ?? "").join("\u0001");
      attempts++;
    }
    tracker.add(sig);
  }
  void autoInc;
  return row;
}

/** Topologically sort tables so parents come before children. */
export function topologicalSort(tables: TableSchema[]): { order: string[]; cycle: string[] } {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycle: string[] = [];
  const order: string[] = [];
  const byName = new Map(tables.map((t) => [t.name, t]));
  function visit(name: string, path: string[]) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      for (const p of path) if (!cycle.includes(p)) cycle.push(p);
      return;
    }
    visiting.add(name);
    path.push(name);
    const t = byName.get(name);
    if (t) {
      for (const fk of t.foreignKeys) {
        if (byName.has(fk.refTable) && fk.refTable !== name) {
          visit(fk.refTable, path);
        }
      }
    }
    visiting.delete(name);
    path.pop();
    visited.add(name);
    order.push(name);
  }
  for (const t of tables) visit(t.name, []);
  return { order, cycle };
}

/** Generate a dataset for multiple tables (FK-aware, topological order). */
export function generateDataset(
  tables: TableSchema[],
  config: GenerationConfig,
): GenerationOutcome {
  if (tables.length === 0) return { ok: false, error: "No tables to generate data for." };
  if (config.rowCount < 0) return { ok: false, error: "Row count must be ≥ 0." };
  if (config.batchSize < 1) return { ok: false, error: "Batch size must be ≥ 1." };
  const { order, cycle } = topologicalSort(tables);
  const warnings: string[] = [];
  if (cycle.length > 0) {
    warnings.push(`Circular FK dependency detected among: ${cycle.join(", ")}. Order may be suboptimal; child FK values may be NULL.`);
  }
  const rng = mulberry32(config.seed >>> 0);
  const byName = new Map(tables.map((t) => [t.name, t]));
  const dataset: GeneratedDataset = {};
  const parentRowsByTable: Record<string, GeneratedRow[]> = {};
  const uniqueTrackers: Record<string, Set<string>> = {};
  for (const tableName of order) {
    const t = byName.get(tableName);
    if (!t) continue;
    const rows: GeneratedRow[] = [];
    for (let i = 0; i < config.rowCount; i++) {
      rows.push(generateRow(t, rng, parentRowsByTable, uniqueTrackers));
    }
    dataset[tableName] = { name: tableName, columns: t.columns.map((c) => c.name), rows };
    parentRowsByTable[tableName] = rows;
  }
  return { ok: true, dataset, order, warnings };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/** Quote an identifier per dialect. */
export function quoteIdentifier(name: string, dialect: Dialect): string {
  if (!name) return "";
  switch (dialect) {
    case "mysql": return "`" + name.replace(/`/g, "``") + "`";
    case "postgresql":
    case "sqlite": return '"' + name.replace(/"/g, '""') + '"';
    case "sqlserver": return "[" + name.replace(/]/g, "]]") + "]";
  }
}

/** Escape a string literal value per dialect. */
export function escapeLiteral(value: string | null, dialect: Dialect): string {
  if (value === null) return "NULL";
  // Booleans / numbers pass through
  if (value === "TRUE" || value === "FALSE") {
    if (dialect === "sqlite" || dialect === "postgresql") return value;
    if (dialect === "mysql") return value === "TRUE" ? "1" : "0";
    if (dialect === "sqlserver") return value === "TRUE" ? "1" : "0";
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  // Hex literal (for blob)
  if (/^x'[0-9a-fA-F]+'$/i.test(value)) return value;
  // String — escape single quotes
  return "'" + value.replace(/'/g, "''") + "'";
}

/** Format a single-row INSERT statement. */
export function formatInsert(table: TableSchema, row: GeneratedRow, dialect: Dialect): string {
  const cols = table.columns.filter((c) => row[c.name] !== null || !c.autoIncrement);
  const colNames = cols.map((c) => quoteIdentifier(c.name, dialect)).join(", ");
  const values = cols.map((c) => escapeLiteral(row[c.name] ?? null, dialect)).join(", ");
  return `INSERT INTO ${quoteIdentifier(table.name, dialect)} (${colNames}) VALUES (${values});`;
}

/** Format a batched (multi-row) INSERT statement. */
export function formatBatchInsert(table: TableSchema, rows: GeneratedRow[], dialect: Dialect, batchSize: number): string {
  if (rows.length === 0) return "";
  const cols = table.columns.filter((c) => !c.autoIncrement);
  const colNames = cols.map((c) => quoteIdentifier(c.name, dialect)).join(", ");
  const lines: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valueLists = batch.map((row) => {
      const vals = cols.map((c) => escapeLiteral(row[c.name] ?? null, dialect)).join(", ");
      return `  (${vals})`;
    });
    lines.push(`INSERT INTO ${quoteIdentifier(table.name, dialect)} (${colNames}) VALUES\n${valueLists.join(",\n")};`);
  }
  return lines.join("\n");
}

/** Format all rows of a table as INSERT statements (batched if config.batchSize > 1). */
export function formatTableInserts(table: GeneratedTable, dialect: Dialect, batchSize: number, schema?: TableSchema): string {
  if (table.rows.length === 0) return "";
  // Reconstruct a minimal TableSchema if not provided
  const ts: TableSchema = schema ?? {
    name: table.name,
    dialect,
    columns: table.columns.map((name) => ({ name, sqlType: "varchar", nullable: true, fakerType: "auto" })),
    foreignKeys: [],
    uniques: [],
  };
  if (batchSize <= 1) {
    return table.rows.map((row) => formatInsert(ts, row, dialect)).join("\n");
  }
  return formatBatchInsert(ts, table.rows, dialect, batchSize);
}

/** Format a table as CSV (header + rows). */
export function formatCsv(table: GeneratedTable): string {
  const lines: string[] = [table.columns.join(",")];
  for (const row of table.rows) {
    const cells = table.columns.map((c) => escapeCsvCell(row[c] ?? ""));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Format a table as a JSON array of objects. */
export function formatJson(table: GeneratedTable): string {
  const arr = table.rows.map((row) => {
    const obj: Record<string, string | null> = {};
    for (const c of table.columns) obj[c] = row[c] ?? null;
    return obj;
  });
  return JSON.stringify(arr, null, 2);
}

/** Format an entire dataset as INSERT statements (all tables). */
export function formatDatasetInserts(dataset: GeneratedDataset, dialect: Dialect, batchSize: number, schemas?: TableSchema[]): string {
  const parts: string[] = [];
  const schemaByName = new Map((schemas ?? []).map((s) => [s.name, s]));
  for (const tableName of Object.keys(dataset)) {
    const t = dataset[tableName];
    const schema = schemaByName.get(tableName);
    parts.push(`-- Mock data for table: ${tableName} (${t.rows.length} rows)`);
    parts.push(formatTableInserts(t, dialect, batchSize, schema));
    parts.push("");
  }
  return parts.join("\n").trimEnd() + "\n";
}

/** Format an entire dataset as CSV (one block per table). */
export function formatDatasetCsv(dataset: GeneratedDataset): string {
  const parts: string[] = [];
  for (const tableName of Object.keys(dataset)) {
    const t = dataset[tableName];
    parts.push(`# Table: ${tableName}`);
    parts.push(formatCsv(t));
    parts.push("");
  }
  return parts.join("\n").trimEnd() + "\n";
}

/** Format an entire dataset as a JSON object mapping table names to row arrays. */
export function formatDatasetJson(dataset: GeneratedDataset): string {
  const obj: Record<string, Array<Record<string, string | null>>> = {};
  for (const tableName of Object.keys(dataset)) {
    const t = dataset[tableName];
    obj[tableName] = t.rows.map((row) => {
      const r: Record<string, string | null> = {};
      for (const c of t.columns) r[c] = row[c] ?? null;
      return r;
    });
  }
  return JSON.stringify(obj, null, 2);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESET_DDL: ReadonlyArray<{ label: string; dialect: Dialect; ddl: string }> = [
  {
    label: "Users (MySQL, simple)",
    dialect: "mysql",
    ddl: `CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  age TINYINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (email)
);`,
  },
  {
    label: "Posts + FK (PostgreSQL)",
    dialect: "postgresql",
    ddl: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
);`,
  },
  {
    label: "Orders + Items + FK chain (SQLite)",
    dialect: "sqlite",
    ddl: `CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  country TEXT
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);`,
  },
];

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mock-sql-data-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  tableCount: number;
  totalRows: number;
  dialect: Dialect;
  seed: number;
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
// Shareable URL (base64-encoded JSON in the URL fragment)
// ---------------------------------------------------------------------------

function encodeBase64(s: string): string {
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(s)
    : Uint8Array.from(s, (c) => c.charCodeAt(0));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(s: string): string {
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return typeof TextDecoder !== "undefined"
    ? new TextDecoder().decode(bytes)
    : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

export interface ShareableState {
  ddl: string;
  dialect: Dialect;
  rowCount: number;
  seed: number;
  batchSize: number;
}

export function encodeState(state: ShareableState): string {
  return encodeBase64(JSON.stringify(state));
}

export function decodeState(s: string): ShareableState | null {
  try {
    const json = decodeBase64(s);
    const obj = JSON.parse(json) as ShareableState;
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.ddl !== "string") return null;
    return obj;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ShareableState): string {
  const frag = `s=${encodeState(state)}`;
  if (typeof window === "undefined") return `?${frag}`;
  return `${window.location.origin}${window.location.pathname}#${frag}`;
}

export function parseShareUrl(hash: string): ShareableState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const s = params.get("s");
  if (!s) return null;
  return decodeState(s);
}
