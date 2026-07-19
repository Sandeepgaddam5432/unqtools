/**
 * AI JSON Mock Data Generator — pure logic.
 *
 * Generate realistic mock data from a JSON Schema. Faker-style generators
 * (names, emails, UUIDs, dates, addresses, phone, URLs, lorem ipsum,
 * numbers, booleans, enums). Constraint-aware (min/max, minLength/maxLength,
 * enum, format, pattern). Seeded PRNG (mulberry32) for reproducibility.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 *
 * Honesty: data is synthetic and must not be mistaken for real records.
 * Faker values are realistic but random. Everything runs locally.
 */

// ---------- Types ----------

export interface JsonSchema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  items?: JsonSchema | JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  $schema?: string;
  $id?: string;
  $ref?: string;
  description?: string;
  title?: string;
  default?: unknown;
  examples?: unknown[];
  [key: string]: unknown;
}

export interface GeneratorOptions {
  /** Seed string for reproducible output. Empty = random. */
  seed?: string;
  /** Locale hint (limited: en, en-GB, en-US, de, fr, es). Default en. */
  locale?: string;
  /** Min array length when schema doesn't specify minItems. Default 1. */
  defaultMinItems?: number;
  /** Max array length when schema doesn't specify maxItems. Default 5. */
  defaultMaxItems?: number;
}

export interface GenerateResult {
  records: unknown[];
  warnings: string[];
  /** Per-path notes about fallbacks used (e.g., unknown format). */
  notes: Array<{ path: string; note: string }>;
}

export interface HistoryEntry {
  ts: number;
  rowCount: number;
  seed: string;
  rootType: string;
  fieldCount: number;
}

export interface ShareState {
  schema: string;
  rowCount: number;
  options: GeneratorOptions;
}

export interface LlmResult {
  schema: JsonSchema;
  notes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-json-mock-data-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-json-mock-data-generator:llm-key";

export const SUPPORTED_LOCALES: string[] = ["en", "en-US", "en-GB", "de", "fr", "es"];

export const SUPPORTED_FORMATS: string[] = [
  "email", "date-time", "date", "uuid", "uri", "ipv4", "phone",
];

/** Sample schemas shipped as one-click presets in the UI. */
export const SAMPLE_SCHEMAS: Array<{ name: string; schema: JsonSchema }> = [
  {
    name: "User",
    schema: {
      type: "object",
      required: ["id", "name", "email", "role", "active", "createdAt"],
      properties: {
        id: { type: "integer", minimum: 1, maximum: 100000 },
        name: { type: "string" },
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["admin", "user", "guest"] },
        active: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
  {
    name: "Product",
    schema: {
      type: "object",
      required: ["sku", "title", "price", "tags"],
      properties: {
        sku: { type: "string", pattern: "^[A-Z]{3}-[0-9]{3}$" },
        title: { type: "string", minLength: 5, maxLength: 40 },
        price: { type: "number", minimum: 0, maximum: 999.99 },
        tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
        inStock: { type: "boolean" },
        manufacturer: {
          type: "object",
          properties: {
            name: { type: "string" },
            country: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "Order",
    schema: {
      type: "object",
      required: ["orderId", "customerId", "items", "total", "currency"],
      properties: {
        orderId: { type: "string", format: "uuid" },
        customerId: { type: "integer", minimum: 1, maximum: 50000 },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            required: ["productId", "qty", "price"],
            properties: {
              productId: { type: "integer", minimum: 1, maximum: 9999 },
              qty: { type: "integer", minimum: 1, maximum: 10 },
              price: { type: "number", minimum: 0.5, maximum: 999.99 },
            },
          },
        },
        total: { type: "number", minimum: 1, maximum: 10000 },
        currency: { type: "string", enum: ["USD", "EUR", "GBP", "JPY"] },
        placedAt: { type: "string", format: "date" },
        shipped: { type: "boolean" },
      },
    },
  },
  {
    name: "Address book",
    schema: {
      type: "object",
      required: ["name", "email", "phone", "address"],
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        phone: { type: "string", format: "phone" },
        website: { type: "string", format: "uri" },
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zip: { type: "string" },
            country: { type: "string" },
          },
        },
        notes: { type: "string" },
      },
    },
  },
];

// ---------- PRNG (mulberry32) ----------

/** Hash a string into a 32-bit unsigned integer (xfnv1a). */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Create a mulberry32 PRNG function from a 32-bit seed. */
export function createRng(seed: string): () => number {
  const seedNum = hashSeed(seed || Math.random().toString(36));
  let a = seedNum;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Faker-style generators ----------

const FIRST_NAMES = [
  "Alice", "Bob", "Carol", "David", "Eve", "Frank", "Grace", "Henry",
  "Iris", "Jack", "Kara", "Leo", "Mia", "Noah", "Olivia", "Paul",
  "Quinn", "Ruth", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xavier",
  "Yara", "Zane", "Aria", "Ben", "Chloe", "Dylan",
];

const LAST_NAMES = [
  "Anderson", "Brown", "Chen", "Davis", "Evans", "Foster", "Garcia",
  "Harris", "Ito", "Johnson", "Khan", "Lee", "Martinez", "Nguyen",
  "O'Brien", "Patel", "Quinn", "Rivera", "Smith", "Tanaka", "Ueda",
  "Vargas", "Wilson", "Xu", "Yamamoto", "Zhang",
];

const CITIES = [
  "Springfield", "Riverdale", "Lakeside", "Fairview", "Greenville",
  "Madison", "Clinton", "Georgetown", "Salem", "Arlington",
  "Oakwood", "Fairfield", "Maplewood", "Bristol", "Franklin",
];

const STATES = [
  "CA", "NY", "TX", "FL", "WA", "MA", "OR", "CO", "IL", "PA",
  "GA", "NC", "VA", "OH", "MI", "AZ", "MN", "NV", "MD", "TN",
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Australia", "Japan",
];

const STREETS = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd",
  "Elm St", "Washington Ave", "Park Blvd", "Lake Dr", "Hill Rd",
];

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
  "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
  "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam",
  "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip",
];

const DOMAIN_WORDS = ["acme", "globex", "initech", "umbrella", "stark", "wayne", "wonka", "hooli"];

/** Pick a random element from an array using the provided RNG. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  return arr[Math.floor(rng() * arr.length)];
}

/** Random integer in [min, max] inclusive. */
export function randomInt(rng: () => number, min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return lo;
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

/** Random float in [min, max) with optional decimal precision. */
export function randomFloat(rng: () => number, min: number, max: number, decimals = 2): number {
  const v = rng() * (max - min) + min;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

/** Random string of given length from [A-Za-z0-9]. */
export function randomString(rng: () => number, length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

/** Random boolean. */
export function randomBoolean(rng: () => number): boolean {
  return rng() < 0.5;
}

/** Random first name. */
export function randomFirstName(rng: () => number): string {
  return pick(rng, FIRST_NAMES);
}

/** Random last name. */
export function randomLastName(rng: () => number): string {
  return pick(rng, LAST_NAMES);
}

/** Random full name. */
export function randomFullName(rng: () => number): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

/** Random email. */
export function randomEmail(rng: () => number): string {
  const first = pick(rng, FIRST_NAMES).toLowerCase();
  const last = pick(rng, LAST_NAMES).toLowerCase();
  const num = randomInt(rng, 1, 999);
  const domain = pick(rng, DOMAIN_WORDS);
  return `${first}.${last}${num}@${domain}.com`;
}

/** Random UUID v4. */
export function randomUuid(rng: () => number): string {
  const hex = "0123456789abcdef";
  const out: string[] = [];
  for (let i = 0; i < 32; i++) {
    if (i === 12) out.push("4");
    else if (i === 16) out.push(hex[(rng() * 4 | 0) + 8]);
    else out.push(hex[Math.floor(rng() * 16)]);
  }
  return `${out.slice(0, 8).join("")}-${out.slice(8, 12).join("")}-${out.slice(12, 16).join("")}-${out.slice(16, 20).join("")}-${out.slice(20, 32).join("")}`;
}

/** Fixed end date so seeded output is reproducible. */
const DATE_END = new Date("2025-12-31T23:59:59Z").getTime();
const DATE_START = new Date("2000-01-01T00:00:00Z").getTime();

/** Random ISO date-time between 2000-01-01 and 2025-12-31. */
export function randomDateTime(rng: () => number): string {
  const t = DATE_START + rng() * (DATE_END - DATE_START);
  return new Date(t).toISOString();
}

/** Random ISO date (YYYY-MM-DD) between 2000-01-01 and 2025-12-31. */
export function randomDate(rng: () => number): string {
  const t = DATE_START + rng() * (DATE_END - DATE_START);
  return new Date(t).toISOString().slice(0, 10);
}

/** Random URL (https). */
export function randomUrl(rng: () => number): string {
  const slug = pick(rng, DOMAIN_WORDS);
  const path = pick(rng, ["home", "about", "products", "blog", "contact", "search", "api"]);
  return `https://${slug}.com/${path}`;
}

/** Random IPv4 address. */
export function randomIpv4(rng: () => number): string {
  return `${randomInt(rng, 1, 255)}.${randomInt(rng, 0, 255)}.${randomInt(rng, 0, 255)}.${randomInt(rng, 1, 254)}`;
}

/** Random US-style phone number (e.g., +1 (555) 123-4567). */
export function randomPhone(rng: () => number): string {
  const a = randomInt(rng, 200, 999);
  const b = randomInt(rng, 200, 999);
  const c = randomInt(rng, 1000, 9999);
  return `+1 (${a}) ${b}-${c}`;
}

/** Random street address. */
export function randomStreet(rng: () => number): string {
  return `${randomInt(rng, 1, 9999)} ${pick(rng, STREETS)}`;
}

/** Random city name. */
export function randomCity(rng: () => number): string {
  return pick(rng, CITIES);
}

/** Random US state code. */
export function randomState(rng: () => number): string {
  return pick(rng, STATES);
}

/** Random US ZIP code. */
export function randomZip(rng: () => number): string {
  return String(randomInt(rng, 10000, 99999));
}

/** Random country name. */
export function randomCountry(rng: () => number): string {
  return pick(rng, COUNTRIES);
}

/** Random lorem ipsum sentence (5–12 words). */
export function randomLorem(rng: () => number): string {
  const n = randomInt(rng, 5, 12);
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(pick(rng, LOREM_WORDS));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

// ---------- Schema parsing ----------

/**
 * Parse a JSON Schema from input text. Accepts a JSON string. Returns ok with
 * the parsed schema, or an error.
 */
export function parseSchema(text: string): { ok: true; schema: JsonSchema } | { ok: false; error: string } {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "Schema input is empty." };
  try {
    const v = JSON.parse(trimmed);
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return { ok: false, error: "Schema must be a JSON object." };
    }
    return { ok: true, schema: v as JsonSchema };
  } catch (e) {
    return { ok: false, error: `Could not parse schema as JSON. ${(e as Error).message}` };
  }
}

// ---------- Schema-driven generation ----------

/**
 * Generate a single mock value for the given schema. Returns the value and
 * pushes warnings/notes to the accumulator.
 */
export function generateMockValue(
  schema: JsonSchema,
  rng: () => number,
  options: GeneratorOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): unknown {
  if (!schema || typeof schema !== "object") {
    return null;
  }
  // const takes precedence.
  if (schema.const !== undefined) return schema.const;
  // enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return pick(rng, schema.enum);
  }
  // anyOf — pick the first branch and generate.
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateMockValue(schema.anyOf[0], rng, options, acc, path);
  }
  // oneOf — same handling as anyOf for generation purposes.
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateMockValue(schema.oneOf[0], rng, options, acc, path);
  }
  // default value if present
  const type = normalizeType(schema.type);
  if (type === null) {
    // Unknown type — fall back to schema.default or null.
    if (schema.default !== undefined) return schema.default;
    acc.warnings.push(`Schema at '${path}' has no type. Generated null.`);
    return null;
  }
  if (type === "null") return null;
  if (type === "boolean") return randomBoolean(rng);
  if (type === "integer") {
    const min = typeof schema.minimum === "number" ? Math.ceil(schema.minimum) : 0;
    const max = typeof schema.maximum === "number" ? Math.floor(schema.maximum) : 999999;
    return randomInt(rng, min, max);
  }
  if (type === "number") {
    const min = typeof schema.minimum === "number" ? schema.minimum : 0;
    const max = typeof schema.maximum === "number" ? schema.maximum : 1000;
    return randomFloat(rng, min, max, 2);
  }
  if (type === "string") {
    return generateMockString(schema, rng, acc, path);
  }
  if (type === "array") {
    return generateMockArray(schema, rng, options, acc, path);
  }
  if (type === "object") {
    return generateMockObject(schema, rng, options, acc, path);
  }
  return null;
}

/** Normalize a schema's 'type' to a single type string, or null if unknown. */
export function normalizeType(t: string | string[] | undefined): string | null {
  if (t === undefined) return null;
  if (Array.isArray(t)) {
    // Pick the first non-null type.
    const nonNull = t.filter((x) => x !== "null");
    if (nonNull.length > 0) return nonNull[0];
    return "null";
  }
  return t;
}

/** Generate a mock string based on format and constraints. */
export function generateMockString(
  schema: JsonSchema,
  rng: () => number,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): string {
  const fmt = schema.format;
  // If a pattern is provided, try to generate a string matching it.
  if (schema.pattern) {
    const s = generateFromPattern(schema.pattern, rng);
    if (s !== null) {
      // Respect minLength/maxLength if present.
      let out = s;
      if (schema.minLength !== undefined && out.length < schema.minLength) {
        out = out + randomString(rng, schema.minLength - out.length);
      }
      if (schema.maxLength !== undefined && out.length > schema.maxLength) {
        out = out.slice(0, schema.maxLength);
      }
      return out;
    }
    acc.notes.push({ path, note: `pattern '${schema.pattern}' unsupported — fell back to random string.` });
  }
  if (fmt === "email") return randomEmail(rng);
  if (fmt === "date-time") return randomDateTime(rng);
  if (fmt === "date") return randomDate(rng);
  if (fmt === "uuid") return randomUuid(rng);
  if (fmt === "uri") return randomUrl(rng);
  if (fmt === "ipv4") return randomIpv4(rng);
  if (fmt === "phone") return randomPhone(rng);
  if (fmt && !SUPPORTED_FORMATS.includes(fmt)) {
    acc.notes.push({ path, note: `unknown format '${fmt}' — fell back to random word.` });
  }
  // No format — generate a random word or lorem.
  const min = schema.minLength ?? 1;
  const max = schema.maxLength ?? 20;
  const len = randomInt(rng, Math.min(min, max), Math.max(min, max));
  // 50% chance: short identifier-style word; 50%: lorem words joined.
  if (rng() < 0.5 && len <= 12) {
    return randomString(rng, len).toLowerCase();
  }
  // Build lorem string up to max chars.
  let s = "";
  while (s.length < min) {
    const word = pick(rng, LOREM_WORDS);
    s = s ? `${s} ${word}` : word;
  }
  if (s.length > max) s = s.slice(0, max);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Generate a mock array based on items schema and item count constraints. */
export function generateMockArray(
  schema: JsonSchema,
  rng: () => number,
  options: GeneratorOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): unknown[] {
  const minItems = schema.minItems ?? options.defaultMinItems ?? 1;
  const maxItems = schema.maxItems ?? options.defaultMaxItems ?? 5;
  const count = randomInt(rng, Math.min(minItems, maxItems), Math.max(minItems, maxItems));
  if (!schema.items) {
    // Unknown item schema — generate primitives.
    return Array.from({ length: count }, () => randomString(rng, 5));
  }
  if (Array.isArray(schema.items)) {
    // Tuple validation — generate exactly schema.items.length items.
    return schema.items.map((it, i) =>
      generateMockValue(it, rng, options, acc, `${path}[${i}]`),
    );
  }
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateMockValue(schema.items, rng, options, acc, `${path}[${i}]`));
  }
  return items;
}

/** Generate a mock object based on its properties. All defined properties
 * are populated — this is mock data, where the goal is a fully-populated
 * record. Required-field semantics still apply for validation. */
export function generateMockObject(
  schema: JsonSchema,
  rng: () => number,
  options: GeneratorOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): Record<string, unknown> {
  const props = schema.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    out[k] = generateMockValue(props[k], rng, options, acc, path ? `${path}.${k}` : k);
  }
  return out;
}

/**
 * Best-effort generator from a regex-like pattern. Supports the most common
 * JSON Schema pattern constructs: character classes [A-Z], \d, \w, ., *,
 * +, {n}, {n,m}, and alternation. Returns null if the pattern is too complex.
 */
export function generateFromPattern(pattern: string, rng: () => number): string | null {
  try {
    return genFromRegex(pattern, rng);
  } catch {
    return null;
  }
}

/** Tiny regex-to-string generator. */
function genFromRegex(pattern: string, rng: () => number): string | null {
  let out = "";
  let i = 0;
  const quantifier = (ch: string, min: number, max: number): string => {
    const n = max === Infinity ? min + Math.floor(rng() * 3) : randomInt(rng, min, max);
    return ch.repeat(Math.max(0, n));
  };
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "^" || c === "$") { i++; continue; }
    if (c === "\\") {
      const next = pattern[i + 1];
      i += 2;
      let ch = "";
      if (next === "d") ch = String(randomInt(rng, 0, 9));
      else if (next === "w") ch = randomString(rng, 1);
      else if (next === "s") ch = " ";
      else ch = next ?? "";
      // Check for following quantifier.
      const q = readQuantifier(pattern, i);
      if (q) {
        out += quantifier(ch, q.min, q.max);
        i = q.end;
      } else {
        out += ch;
      }
      continue;
    }
    if (c === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) return null;
      const klass = pattern.slice(i + 1, end);
      i = end + 1;
      const chars = expandClass(klass);
      const q = readQuantifier(pattern, i);
      if (q) {
        const n = q.max === Infinity ? q.min + Math.floor(rng() * 3) : randomInt(rng, q.min, q.max);
        let s = "";
        for (let j = 0; j < n; j++) s += chars[Math.floor(rng() * chars.length)];
        out += s;
        i = q.end;
      } else {
        out += chars[Math.floor(rng() * chars.length)];
      }
      continue;
    }
    if (c === ".") {
      i++;
      const q = readQuantifier(pattern, i);
      if (q) {
        out += quantifier(randomString(rng, 1), q.min, q.max);
        i = q.end;
      } else {
        out += randomString(rng, 1);
      }
      continue;
    }
    if (c === "(") {
      // Skip group, treat content literally — best-effort.
      const end = pattern.indexOf(")", i);
      if (end === -1) return null;
      i = end + 1;
      continue;
    }
    // Literal character
    i++;
    const q = readQuantifier(pattern, i);
    if (q) {
      out += quantifier(c, q.min, q.max);
      i = q.end;
    } else {
      out += c;
    }
  }
  return out;
}

function readQuantifier(pattern: string, i: number): { min: number; max: number; end: number } | null {
  if (i >= pattern.length) return null;
  const c = pattern[i];
  if (c === "*") return { min: 0, max: Infinity, end: i + 1 };
  if (c === "+") return { min: 1, max: Infinity, end: i + 1 };
  if (c === "?") return { min: 0, max: 1, end: i + 1 };
  if (c === "{") {
    const end = pattern.indexOf("}", i);
    if (end === -1) return null;
    const body = pattern.slice(i + 1, end);
    const parts = body.split(",");
    if (parts.length === 1) {
      const n = parseInt(parts[0], 10);
      if (isNaN(n)) return null;
      return { min: n, max: n, end: end + 1 };
    }
    const min = parseInt(parts[0] || "0", 10);
    const max = parts[1] === "" ? Infinity : parseInt(parts[1], 10);
    if (isNaN(min)) return null;
    return { min, max, end: end + 1 };
  }
  return null;
}

function expandClass(klass: string): string {
  // Handle simple ranges like A-Z, 0-9.
  if (klass === "A-Z") {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return chars;
  }
  if (klass === "a-z") {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    return chars;
  }
  if (klass === "0-9") return "0123456789";
  // Handle A-Za-z
  if (klass === "A-Za-z") return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  if (klass === "0-9A-F" || klass === "A-F0-9") return "0123456789ABCDEF";
  // Strip leading ^
  let k = klass;
  if (k.startsWith("^")) k = k.slice(1);
  // If it's a range inside (e.g., A-Z), expand.
  const range = k.match(/^(\w)-(\w)$/);
  if (range) {
    const start = range[1].charCodeAt(0);
    const end = range[2].charCodeAt(0);
    let s = "";
    for (let code = start; code <= end; code++) s += String.fromCharCode(code);
    return s;
  }
  return k;
}

// ---------- Public entry: generate N records ----------

/**
 * Generate N mock records from a schema. If the root schema is an object,
 * returns N objects. If the root is an array, treats each row as a single
 * array (rare). If the root is a scalar, returns N scalars.
 */
export function generateMockData(
  schema: JsonSchema,
  count: number,
  options: GeneratorOptions = {},
): GenerateResult {
  const opts: GeneratorOptions = {
    seed: options.seed ?? "",
    locale: options.locale ?? "en",
    defaultMinItems: options.defaultMinItems ?? 1,
    defaultMaxItems: options.defaultMaxItems ?? 5,
  };
  const acc = { warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> };
  const rng = createRng(opts.seed || Math.random().toString(36) + Date.now());
  const records: unknown[] = [];
  for (let i = 0; i < count; i++) {
    records.push(generateMockValue(schema, rng, opts, acc, `$row[${i}]`));
  }
  return { records, warnings: acc.warnings, notes: acc.notes };
}

/** Generate a single record (convenience wrapper). */
export function generateMockRecord(
  schema: JsonSchema,
  options: GeneratorOptions = {},
): { record: unknown; warnings: string[]; notes: Array<{ path: string; note: string }> } {
  const r = generateMockData(schema, 1, options);
  return { record: r.records[0], warnings: r.warnings, notes: r.notes };
}

// ---------- Render ----------

/** Render records as a pretty JSON string. */
export function renderJson(records: unknown[], indent = 2): string {
  return JSON.stringify(records, null, indent);
}

/** Flatten a record into key/value pairs using dotted paths (for CSV). */
export function flattenRecord(record: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (record === null || record === undefined) {
    if (prefix) out[prefix] = "";
    return out;
  }
  if (Array.isArray(record)) {
    // Join arrays with ';'
    const parts = record.map((v) => flattenValue(v));
    out[prefix || "value"] = parts.join(";");
    return out;
  }
  if (typeof record === "object") {
    const obj = record as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      const child = obj[k];
      if (child !== null && typeof child === "object" && !Array.isArray(child)) {
        Object.assign(out, flattenRecord(child, key));
      } else {
        out[key] = flattenValue(child);
      }
    }
    return out;
  }
  out[prefix || "value"] = flattenValue(record);
  return out;
}

/** Flatten a scalar/array value to a CSV-cell string. */
export function flattenValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(flattenValue).join(";");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Render records as CSV. Flattens nested objects with dotted keys. */
export function renderCsv(records: unknown[]): string {
  if (records.length === 0) return "";
  const flatRows = records.map((r) => flattenRecord(r));
  // Collect all keys across rows.
  const keySet = new Set<string>();
  for (const r of flatRows) for (const k of Object.keys(r)) keySet.add(k);
  const keys = Array.from(keySet).sort();
  const lines: string[] = [keys.map(escapeCsv).join(",")];
  for (const r of flatRows) {
    lines.push(keys.map((k) => escapeCsv(r[k] ?? "")).join(","));
  }
  return lines.join("\n");
}

/** Render records as INSERT SQL statements. */
export function renderSql(records: unknown[], tableName = "mock_data"): string {
  if (records.length === 0) return "";
  // Only objects can be rendered as SQL rows.
  const objectRecords = records.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r));
  if (objectRecords.length === 0) {
    return `-- No object records to render as SQL.\n`;
  }
  // Collect columns (top-level keys only — nested objects are JSON-stringified).
  const colSet = new Set<string>();
  for (const r of objectRecords) {
    for (const k of Object.keys(r as Record<string, unknown>)) colSet.add(k);
  }
  const cols = Array.from(colSet).sort();
  const lines: string[] = [];
  lines.push(`-- ${objectRecords.length} row(s) for table ${tableName}`);
  for (const r of objectRecords) {
    const vals = cols.map((c) => {
      const v = (r as Record<string, unknown>)[c];
      return sqlValue(v);
    });
    lines.push(`INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
  }
  return lines.join("\n");
}

/** Escape a string for a CSV cell. */
export function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a value as a SQL literal. */
export function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  // arrays and objects → JSON string
  return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(schema: string, rowCount: number, options: GeneratorOptions): string {
  const params = new URLSearchParams();
  if (schema) params.set("s", schema);
  if (rowCount > 0) params.set("n", String(rowCount));
  if (options.seed) params.set("seed", options.seed);
  if (options.locale && options.locale !== "en") params.set("locale", options.locale);
  if (options.defaultMinItems !== undefined) params.set("min", String(options.defaultMinItems));
  if (options.defaultMaxItems !== undefined) params.set("max", String(options.defaultMaxItems));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { schema: "", rowCount: 5, options: {} };
  const params = new URLSearchParams(clean);
  const schema = params.get("s") ?? "";
  const n = parseInt(params.get("n") ?? "5", 10);
  const rowCount = isNaN(n) ? 5 : n;
  const options: GeneratorOptions = {};
  if (params.get("seed")) options.seed = params.get("seed")!;
  if (params.get("locale")) options.locale = params.get("locale")!;
  if (params.get("min")) options.defaultMinItems = parseInt(params.get("min")!, 10);
  if (params.get("max")) options.defaultMaxItems = parseInt(params.get("max")!, 10);
  return { schema, rowCount, options };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(description: string): string {
  return [
    "You are an expert at designing JSON Schemas. From the natural-language description below, infer a JSON Schema (Draft 7) that captures the described fields, types, and constraints.",
    "",
    "Description:",
    description,
    "",
    "Output a JSON object with:",
    '- "schema": a JSON Schema object (Draft 7) with type, properties, required, and any constraints you can infer',
    '- "notes": array of strings (any assumptions you made, e.g., "assumed email format for the contact field")',
    "",
    "Use sensible formats (email, date-time, uuid, uri) where appropriate. If the description mentions a fixed set of values, use an enum. Do not invent fields not described.",
  ].join("\n");
}

export function renderLlmResult(rawText: string): { ok: true; result: LlmResult } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const schema = typeof o.schema === "object" && o.schema !== null && !Array.isArray(o.schema)
    ? (o.schema as JsonSchema)
    : null;
  if (!schema) {
    return { ok: false, error: "LLM output did not contain a 'schema' object." };
  }
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { schema, notes } };
}

/** Validate that a generated record set matches a schema's required fields. */
export function validateGenerated(records: unknown[], schema: JsonSchema): { ok: boolean; missing: Array<{ row: number; field: string }> } {
  const missing: Array<{ row: number; field: string }> = [];
  if (schema.type !== "object") return { ok: true, missing };
  const required = schema.required ?? [];
  if (required.length === 0) return { ok: true, missing };
  records.forEach((r, i) => {
    if (r !== null && typeof r === "object" && !Array.isArray(r)) {
      for (const f of required) {
        if (!(f in (r as Record<string, unknown>))) {
          missing.push({ row: i, field: f });
        }
      }
    }
  });
  return { ok: missing.length === 0, missing };
}
