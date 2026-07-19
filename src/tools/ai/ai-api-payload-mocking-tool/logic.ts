/**
 * AI API Payload Mocking Tool — pure logic.
 *
 * Generate realistic mock API responses from OpenAPI spec, JSON sample, or
 * described endpoint. Pure functions only — no DOM, no network. The optional
 * LLM call (BYO API key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type FakerType =
  | "string" | "int" | "float" | "bool" | "uuid" | "date" | "datetime"
  | "timestamp" | "email" | "phone" | "name" | "firstName" | "lastName"
  | "username" | "url" | "slug" | "ip" | "ipv6" | "color" | "userAgent"
  | "address" | "city" | "state" | "zip" | "country" | "currency"
  | "card" | "lorem" | "sentence" | "paragraph" | "array" | "object"
  | "enum" | "id";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface SchemaField {
  name: string;
  type: FakerType;
  enumValues?: string[];
  min?: number;
  max?: number;
  arrayLength?: number;
  optional?: boolean;
  description?: string;
  children?: SchemaField[];
}

export interface MockRoute {
  method: HttpMethod;
  path: string;
  description?: string;
  status: number;
  latencyMs: number;
  scenario: Scenario;
  fields: SchemaField[];
  isArray: boolean;
}

export type Scenario =
  | "default" | "empty" | "error" | "large" | "paginated" | "single";

export interface MockConfig {
  name: string;
  basePath: string;
  routes: MockRoute[];
  createdAt: number;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
}

export interface InspectorEntry {
  ts: number;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  matchedRoute?: string;
}

// ---------- Constants & Presets ----------

export const HISTORY_KEY = "unqtools:ai-api-mocking:history";
export const HISTORY_MAX = 20;

export const STATUS_PRESETS: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export const SCENARIO_LABELS: Record<Scenario, string> = {
  default: "Default (single)",
  empty: "Empty result",
  error: "Error response",
  large: "Large list (1k)",
  paginated: "Paginated",
  single: "Single resource",
};

export const ENDPOINT_PRESETS: { label: string; description: string }[] = [
  { label: "Users CRUD", description: "User list endpoint with id, name, email, role, createdAt. GET returns array." },
  { label: "Product Catalog", description: "Product endpoint with id, name, price, stock, category, sku." },
  { label: "Order Detail", description: "Order endpoint with id, customer, total, items[], status, shippedAt." },
  { label: "Blog Post", description: "Post endpoint with id, title, author, body, tags[], publishedAt." },
  { label: "Auth Token", description: "Token endpoint with accessToken, refreshToken, expiresAt, tokenType." },
  { label: "Search Results", description: "Search endpoint with query, total, page, results[], facets." },
];

// Faker data pools
const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Aisha", "Wei", "Fatima", "Yuki", "Diego", "Priya", "Omar", "Sofia",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Patel", "Nguyen", "Kim", "Singh", "Okafor", "Chen", "Yamamoto", "Ivanov",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Seattle",
  "Denver", "Boston", "Portland", "Nashville", "Atlanta", "Miami",
  "London", "Manchester", "Berlin", "Munich", "Paris", "Lyon",
  "Tokyo", "Osaka", "Singapore", "Sydney", "Toronto", "Vancouver",
];

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Sweden", "Japan", "Singapore",
  "India", "Brazil", "Mexico", "Argentina", "South Africa", "UAE",
];

const STREETS = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Elm St", "Pine Rd",
  "Washington Blvd", "Lincoln Way", "Park Ave", "Lake Dr", "Hill Rd",
  "Sunset Blvd", "River Rd", "Church St", "High St", "Station Rd",
];

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
  "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea",
  "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
];

// ---------- Seeded RNG (mulberry32) ----------

export interface RngState { state: number; }

export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function intIn(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ---------- Faker generators ----------

export function fakeFirstName(rng: () => number): string {
  return pick(rng, FIRST_NAMES);
}

export function fakeLastName(rng: () => number): string {
  return pick(rng, LAST_NAMES);
}

export function fakeName(rng: () => number): string {
  return `${fakeFirstName(rng)} ${fakeLastName(rng)}`;
}

export function fakeUsername(rng: () => number): string {
  return (fakeFirstName(rng).toLowerCase() + fakeLastName(rng).toLowerCase().slice(0, 3) + intIn(rng, 10, 99));
}

export function fakeEmail(rng: () => number): string {
  const domains = ["example.com", "test.org", "mock.io", "sample.dev", "demo.net"];
  return `${fakeUsername(rng)}@${pick(rng, domains)}`;
}

export function fakePhone(rng: () => number, fmt: "us" | "uk" | "intl" = "us"): string {
  if (fmt === "uk") {
    return `+44 7${intIn(rng, 100, 999)} ${intIn(rng, 100000, 999999)}`;
  }
  if (fmt === "intl") {
    return `+${intIn(rng, 1, 99)} ${intIn(rng, 100, 999)} ${intIn(rng, 1000000, 9999999)}`;
  }
  return `+1 (${intIn(rng, 200, 989)}) ${intIn(rng, 200, 989)}-${intIn(rng, 1000, 9999)}`;
}

export function fakeUuid(rng: () => number): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) out += "-";
    if (i === 12) { out += "4"; continue; }
    if (i === 16) { out += hex[8 + Math.floor(rng() * 4)]; continue; }
    out += hex[Math.floor(rng() * 16)];
  }
  return out;
}

export function fakeDate(rng: () => number, fromYear = 2000, toYear = 2024): string {
  const year = intIn(rng, fromYear, toYear);
  const month = intIn(rng, 1, 12);
  const day = intIn(rng, 1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fakeDatetime(rng: () => number): string {
  const d = fakeDate(rng);
  const h = String(intIn(rng, 0, 23)).padStart(2, "0");
  const m = String(intIn(rng, 0, 59)).padStart(2, "0");
  const s = String(intIn(rng, 0, 59)).padStart(2, "0");
  return `${d}T${h}:${m}:${s}Z`;
}

export function fakeTimestamp(rng: () => number): number {
  // 2001-01-01 to ~2030
  return intIn(rng, 978307200, 1893456000);
}

export function fakeUrl(rng: () => number): string {
  const tlds = ["com", "org", "io", "dev", "net", "app"];
  const slug = pick(rng, LOREM_WORDS);
  return `https://${slug}.${pick(rng, tlds)}/${pick(rng, LOREM_WORDS)}/${pick(rng, LOREM_WORDS)}`;
}

export function fakeSlug(rng: () => number): string {
  return `${pick(rng, LOREM_WORDS)}-${pick(rng, LOREM_WORDS)}-${intIn(rng, 100, 9999)}`;
}

export function fakeIp(rng: () => number): string {
  return `${intIn(rng, 1, 254)}.${intIn(rng, 0, 255)}.${intIn(rng, 0, 255)}.${intIn(rng, 1, 254)}`;
}

export function fakeIpv6(rng: () => number): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    parts.push(intIn(rng, 0, 65535).toString(16));
  }
  return parts.join(":");
}

export function fakeColor(rng: () => number): string {
  return "#" + intIn(rng, 0, 0xffffff).toString(16).padStart(6, "0");
}

export function fakeUserAgent(rng: () => number): string {
  return pick(rng, USER_AGENTS);
}

export function fakeAddress(rng: () => number): string {
  return `${intIn(rng, 100, 9999)} ${pick(rng, STREETS)}`;
}

export function fakeCity(rng: () => number): string { return pick(rng, CITIES); }
export function fakeState(rng: () => number): string { return pick(rng, STATES); }
export function fakeZip(rng: () => number): string { return String(intIn(rng, 10000, 99999)); }
export function fakeCountry(rng: () => number): string { return pick(rng, COUNTRIES); }

export function fakeCurrency(rng: () => number, min = 1, max = 9999): string {
  return (Math.round(rng() * (max - min) * 100) / 100 + min).toFixed(2);
}

export function fakeCard(rng: () => number): string {
  // Luhn-valid test card (start with 4242 4242 — Stripe test card format)
  const prefix = "424242424242"; // 12 digits
  const middle3 = String(intIn(rng, 0, 999)).padStart(3, "0"); // 3 digits
  const partial = prefix + middle3; // 15 digits; check digit will be at position 0 (rightmost)
  // The rightmost digit of `partial` will be at position 1 in the final 16-digit card.
  // In Luhn, position 1 (second from right) is doubled, position 2 not, etc.
  // So when iterating partial right-to-left, we start with alt = true (doubled).
  let sum = 0;
  let alt = true;
  for (let i = partial.length - 1; i >= 0; i--) {
    let n = parseInt(partial[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  const check = (10 - (sum % 10)) % 10;
  const full = partial + String(check);
  return full.match(/.{4}/g)!.join(" ");
}

export function fakeSentence(rng: () => number, wordCount = 8): string {
  const n = Math.max(1, wordCount);
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(pick(rng, LOREM_WORDS));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function fakeParagraph(rng: () => number, sentenceCount = 4): string {
  const out: string[] = [];
  for (let i = 0; i < sentenceCount; i++) out.push(fakeSentence(rng, intIn(rng, 5, 12)));
  return out.join(" ");
}

export function fakeLorem(rng: () => number, count = 30): string {
  const words: string[] = [];
  for (let i = 0; i < count; i++) words.push(pick(rng, LOREM_WORDS));
  return words.join(" ");
}

// ---------- Faker dispatcher ----------

export function generateValue(
  rng: () => number,
  field: SchemaField,
): unknown {
  switch (field.type) {
    case "string": return fakeSentence(rng, intIn(rng, 3, 6));
    case "int": return intIn(rng, field.min ?? 0, field.max ?? 999999);
    case "float": {
      const min = field.min ?? 0;
      const max = field.max ?? 1000;
      return Math.round(rng() * (max - min) * 100) / 100 + min;
    }
    case "bool": return rng() < 0.5;
    case "uuid": return fakeUuid(rng);
    case "date": return fakeDate(rng);
    case "datetime": return fakeDatetime(rng);
    case "timestamp": return fakeTimestamp(rng);
    case "email": return fakeEmail(rng);
    case "phone": return fakePhone(rng);
    case "name": return fakeName(rng);
    case "firstName": return fakeFirstName(rng);
    case "lastName": return fakeLastName(rng);
    case "username": return fakeUsername(rng);
    case "url": return fakeUrl(rng);
    case "slug": return fakeSlug(rng);
    case "ip": return fakeIp(rng);
    case "ipv6": return fakeIpv6(rng);
    case "color": return fakeColor(rng);
    case "userAgent": return fakeUserAgent(rng);
    case "address": return fakeAddress(rng);
    case "city": return fakeCity(rng);
    case "state": return fakeState(rng);
    case "zip": return fakeZip(rng);
    case "country": return fakeCountry(rng);
    case "currency": return fakeCurrency(rng, field.min ?? 1, field.max ?? 9999);
    case "card": return fakeCard(rng);
    case "sentence": return fakeSentence(rng);
    case "paragraph": return fakeParagraph(rng);
    case "lorem": return fakeLorem(rng, field.max ?? 30);
    case "enum": {
      const vals = field.enumValues ?? ["A", "B", "C"];
      return pick(rng, vals);
    }
    case "id": return intIn(rng, 1, 999999);
    case "object": {
      const out: Record<string, unknown> = {};
      for (const child of field.children ?? []) {
        if (child.optional && rng() < 0.3) continue;
        out[child.name] = generateValue(rng, child);
      }
      return out;
    }
    case "array": {
      const len = field.arrayLength ?? intIn(rng, 1, 5);
      const out: unknown[] = [];
      const child: SchemaField = field.children?.[0] ?? { name: "item", type: "string" };
      for (let i = 0; i < len; i++) out.push(generateValue(rng, child));
      return out;
    }
    default: return null;
  }
}

// ---------- OpenAPI / JSON sample parsing ----------

export interface ParsedSchema {
  name: string;
  fields: SchemaField[];
  isArray: boolean;
  description?: string;
}

const NAME_HINTS: Array<{ re: RegExp; type: FakerType }> = [
  { re: /uuid|guid/i, type: "uuid" },
  { re: /^id$|_id$/i, type: "id" },
  { re: /email/i, type: "email" },
  { re: /^name$|fullname|displayname/i, type: "name" },
  { re: /firstname|givenname|fname/i, type: "firstName" },
  { re: /lastname|surname|lname/i, type: "lastName" },
  { re: /username|login|handle/i, type: "username" },
  { re: /phone|mobile|tel/i, type: "phone" },
  { re: /url|website|link|href/i, type: "url" },
  { re: /slug/i, type: "slug" },
  { re: /ip_?address/i, type: "ip" },
  { re: /color|colour/i, type: "color" },
  { re: /user_?agent|ua/i, type: "userAgent" },
  { re: /address|street/i, type: "address" },
  { re: /city|town/i, type: "city" },
  { re: /state|province|region/i, type: "state" },
  { re: /zip|postal/i, type: "zip" },
  { re: /country/i, type: "country" },
  { re: /price|amount|total|cost|balance|salary/i, type: "currency" },
  { re: /card|creditcard|ccnumber/i, type: "card" },
  { re: /created_?at|updated_?at|shipped_?at|deleted_?at/i, type: "datetime" },
  { re: /date|day|birthday/i, type: "date" },
  { re: /time|timestamp|ts$/i, type: "timestamp" },
  { re: /avatar|image|photo/i, type: "url" },
  { re: /description|body|content|text|bio/i, type: "paragraph" },
  { re: /title|heading/i, type: "sentence" },
];

/** Infer a faker type from a property name. */
export function inferTypeFromName(name: string): FakerType {
  for (const hint of NAME_HINTS) {
    if (hint.re.test(name)) return hint.type;
  }
  return "string";
}

/** Infer a SchemaField from a JSON value. */
export function inferFieldFromValue(name: string, value: unknown): SchemaField {
  if (Array.isArray(value)) {
    const first = value[0];
    const child = first !== undefined
      ? inferFieldFromValue("item", first)
      : { name: "item", type: "string" as FakerType };
    return {
      name,
      type: "array",
      arrayLength: value.length || 3,
      children: [child],
    };
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      name,
      type: "object",
      children: entries.map(([k, v]) => inferFieldFromValue(k, v)),
    };
  }
  if (typeof value === "number") {
    return { name, type: Number.isInteger(value) ? "int" : "float" };
  }
  if (typeof value === "boolean") return { name, type: "bool" };
  if (typeof value === "string") {
    if (value === "") return { name, type: inferTypeFromName(name) };
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { name, type: "datetime" };
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { name, type: "date" };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      return { name, type: "uuid" };
    }
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { name, type: "email" };
    if (/^https?:\/\//.test(value)) return { name, type: "url" };
    if (/^#[0-9a-f]{6}$/i.test(value)) return { name, type: "color" };
    return { name, type: inferTypeFromName(name) };
  }
  return { name, type: "string" };
}

/** Parse a JSON sample string into a ParsedSchema. */
export function parseJsonSample(
  sample: string,
  name = "Resource",
): { ok: true; schema: ParsedSchema } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(sample);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const isArray = Array.isArray(value);
  const target = isArray ? (value as unknown[])[0] ?? {} : value;
  if (target === null || typeof target !== "object") {
    return { ok: false, error: "Top-level JSON must be an object or array of objects." };
  }
  const entries = Object.entries(target as Record<string, unknown>);
  const fields: SchemaField[] = entries.map(([k, v]) => inferFieldFromValue(k, v));
  return { ok: true, schema: { name, fields, isArray, description: `Parsed from JSON sample` } };
}

/**
 * Parse a (very small subset of) OpenAPI 3 spec into ParsedSchemas.
 * Supports paths.<path>.<method>.responses.<status>.content.<mime>.schema
 * where schema has $ref to components.schemas.<Name> or inline properties.
 */
export function parseOpenApiSpec(
  specText: string,
): { ok: true; schemas: ParsedSchema[]; routes: MockRoute[] } | { ok: false; error: string } {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specText);
  } catch (e) {
    return { ok: false, error: `Invalid OpenAPI JSON: ${(e as Error).message}` };
  }
  const components = (spec.components as Record<string, unknown>) ?? {};
  const schemasMap = (components.schemas as Record<string, unknown>) ?? {};
  const schemas: ParsedSchema[] = [];

  // Parse component schemas
  for (const [name, raw] of Object.entries(schemasMap)) {
    const node = raw as Record<string, unknown>;
    const props = (node.properties as Record<string, unknown>) ?? {};
    const requiredList = (node.required as string[]) ?? [];
    const fields: SchemaField[] = Object.entries(props).map(([k, v]) => {
      const f = openApiPropToField(k, v as Record<string, unknown>, schemasMap);
      if (!requiredList.includes(k)) f.optional = true;
      return f;
    });
    schemas.push({ name, fields, isArray: false, description: node.description as string });
  }

  // Parse paths → routes
  const paths = (spec.paths as Record<string, unknown>) ?? {};
  const routes: MockRoute[] = [];
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  for (const [path, raw] of Object.entries(paths)) {
    const pathNode = raw as Record<string, unknown>;
    for (const m of methods) {
      const op = pathNode[m.toLowerCase()] as Record<string, unknown> | undefined;
      if (!op) continue;
      const schema = extractResponseSchema(op, schemasMap);
      routes.push({
        method: m,
        path,
        description: op.summary as string | undefined,
        status: 200,
        latencyMs: 50,
        scenario: "default",
        fields: schema.fields,
        isArray: schema.isArray,
      });
    }
  }

  return { ok: true, schemas, routes };
}

function openApiPropToField(
  name: string,
  prop: Record<string, unknown>,
  schemasMap: Record<string, unknown>,
): SchemaField {
  const type = prop.type as string | undefined;
  const format = prop.format as string | undefined;
  const enumVals = prop.enum as string[] | undefined;
  if (enumVals && enumVals.length > 0) {
    return { name, type: "enum", enumValues: enumVals };
  }
  if (prop.$ref) {
    const refName = (prop.$ref as string).split("/").pop() ?? "";
    const refSchema = schemasMap[refName] as Record<string, unknown> | undefined;
    if (refSchema) {
      const props = (refSchema.properties as Record<string, unknown>) ?? {};
      return {
        name,
        type: "object",
        children: Object.entries(props).map(([k, v]) =>
          openApiPropToField(k, v as Record<string, unknown>, schemasMap)),
      };
    }
    return { name, type: "object", children: [] };
  }
  if (type === "array") {
    const items = (prop.items as Record<string, unknown>) ?? {};
    const child = openApiPropToField("item", items, schemasMap);
    return { name, type: "array", arrayLength: 3, children: [child] };
  }
  if (type === "object") {
    const props = (prop.properties as Record<string, unknown>) ?? {};
    return {
      name,
      type: "object",
      children: Object.entries(props).map(([k, v]) =>
        openApiPropToField(k, v as Record<string, unknown>, schemasMap)),
    };
  }
  if (type === "integer") return { name, type: "int" };
  if (type === "number") return { name, type: "float" };
  if (type === "boolean") return { name, type: "bool" };
  if (type === "string") {
    if (format === "uuid") return { name, type: "uuid" };
    if (format === "date") return { name, type: "date" };
    if (format === "date-time") return { name, type: "datetime" };
    if (format === "email") return { name, type: "email" };
    if (format === "uri") return { name, type: "url" };
    if (format === "ipv4") return { name, type: "ip" };
    if (format === "ipv6") return { name, type: "ipv6" };
    if (format === "password") return { name, type: "string" };
    return { name, type: inferTypeFromName(name) };
  }
  return { name, type: "string" };
}

function extractResponseSchema(
  op: Record<string, unknown>,
  schemasMap: Record<string, unknown>,
): ParsedSchema {
  const responses = (op.responses as Record<string, unknown>) ?? {};
  const ok = responses["200"] as Record<string, unknown> | undefined
    ?? responses["201"] as Record<string, unknown> | undefined
    ?? responses["default"] as Record<string, unknown> | undefined;
  if (!ok) return { name: "Resource", fields: [], isArray: false };
  const content = (ok.content as Record<string, unknown>) ?? {};
  const appJson = content["application/json"] as Record<string, unknown> | undefined;
  if (!appJson) return { name: "Resource", fields: [], isArray: false };
  const schema = (appJson.schema as Record<string, unknown>) ?? {};
  let isArray = false;
  let target = schema;
  if (schema.type === "array") {
    isArray = true;
    target = (schema.items as Record<string, unknown>) ?? {};
  }
  if (target.$ref) {
    const refName = (target.$ref as string).split("/").pop() ?? "";
    const refSchema = schemasMap[refName] as Record<string, unknown> | undefined;
    if (refSchema) {
      const props = (refSchema.properties as Record<string, unknown>) ?? {};
      const requiredList = (refSchema.required as string[]) ?? [];
      const fields = Object.entries(props).map(([k, v]) => {
        const f = openApiPropToField(k, v as Record<string, unknown>, schemasMap);
        if (!requiredList.includes(k)) f.optional = true;
        return f;
      });
      return { name: refName, fields, isArray };
    }
  }
  if (target.properties) {
    const props = target.properties as Record<string, unknown>;
    const fields = Object.entries(props).map(([k, v]) =>
      openApiPropToField(k, v as Record<string, unknown>, schemasMap));
    return { name: "Resource", fields, isArray };
  }
  return { name: "Resource", fields: [], isArray };
}

// ---------- Plain-English endpoint describer ----------

const DESC_KEYWORDS: Array<{ re: RegExp; type: FakerType }> = [
  { re: /email/i, type: "email" },
  { re: /phone|mobile/i, type: "phone" },
  { re: /uuid/i, type: "uuid" },
  { re: /url|link/i, type: "url" },
  { re: /name/i, type: "name" },
  { re: /address/i, type: "address" },
  { re: /city/i, type: "city" },
  { re: /country/i, type: "country" },
  { re: /price|amount|total|cost/i, type: "currency" },
  { re: /date/i, type: "date" },
  { re: /timestamp|created|updated/i, type: "datetime" },
  { re: /count|stock|quantity|age/i, type: "int" },
  { re: /id\b/i, type: "id" },
];

/** Parse a plain-English endpoint description into fields. */
export function parseDescription(desc: string): SchemaField[] {
  if (!desc || !desc.trim()) return [];
  // Split on commas, "with", "and", "."
  const tokens = desc
    .split(/[,.\n]|\bwith\b|\band\b|\breturning?\b/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const fields: SchemaField[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const matchedTypes = new Set<FakerType>();
    for (const k of DESC_KEYWORDS) {
      if (k.re.test(tok)) matchedTypes.add(k.type);
    }
    if (matchedTypes.size === 0) continue;
    const type = [...matchedTypes][0];
    // Derive a name from the token: longest word
    const words = tok.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const name = (words[0] ?? "field").toLowerCase();
    if (!seen.has(name)) {
      fields.push({ name, type });
      seen.add(name);
    }
  }
  return fields;
}

// ---------- CRUD route generator ----------

export function buildCrudRoutes(resourceName: string, fields: SchemaField[]): MockRoute[] {
  const base = "/" + pluralize(resourceName.toLowerCase());
  const listFields = [{ name: "id", type: "id" as FakerType }, ...fields];
  const singleFields = [{ name: "id", type: "id" as FakerType }, ...fields];
  return [
    {
      method: "GET", path: base, status: 200, latencyMs: 50,
      scenario: "default", fields: listFields, isArray: true,
      description: `List ${resourceName.toLowerCase()}s`,
    },
    {
      method: "GET", path: `${base}/{id}`, status: 200, latencyMs: 30,
      scenario: "single", fields: singleFields, isArray: false,
      description: `Get a single ${resourceName.toLowerCase()}`,
    },
    {
      method: "POST", path: base, status: 201, latencyMs: 100,
      scenario: "single", fields: singleFields, isArray: false,
      description: `Create a ${resourceName.toLowerCase()}`,
    },
    {
      method: "PUT", path: `${base}/{id}`, status: 200, latencyMs: 80,
      scenario: "single", fields: singleFields, isArray: false,
      description: `Update a ${resourceName.toLowerCase()}`,
    },
    {
      method: "DELETE", path: `${base}/{id}`, status: 204, latencyMs: 60,
      scenario: "empty", fields: [], isArray: false,
      description: `Delete a ${resourceName.toLowerCase()}`,
    },
  ];
}

function pluralize(s: string): string {
  if (s.endsWith("s") || s.endsWith("x") || s.endsWith("z")) return s + "es";
  if (s.endsWith("y") && !/[aeiou]y$/.test(s)) return s.slice(0, -1) + "ies";
  return s + "s";
}

// ---------- Mock response generator ----------

export function generateMockResponse(
  route: MockRoute,
  seed: number,
): MockResponse {
  const rng = createRng(seed);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Mock-Scenario": route.scenario,
    "X-Mock-Latency": String(route.latencyMs),
  };
  if (route.scenario === "error") {
    return {
      status: route.status >= 400 ? route.status : 500,
      headers,
      body: {
        error: "MockError",
        message: "Simulated error response",
        code: "MOCK_ERROR",
        timestamp: new Date().toISOString(),
      },
      latencyMs: route.latencyMs,
    };
  }
  if (route.scenario === "empty") {
    return {
      status: route.status,
      headers,
      body: route.isArray ? [] : {},
      latencyMs: route.latencyMs,
    };
  }
  if (route.scenario === "large") {
    const out: unknown[] = [];
    for (let i = 0; i < 1000; i++) {
      const item: Record<string, unknown> = {};
      for (const f of route.fields) {
        item[f.name] = generateValue(rng, f);
      }
      out.push(item);
    }
    return { status: route.status, headers, body: out, latencyMs: route.latencyMs };
  }
  if (route.scenario === "paginated") {
    const page = 1;
    const pageSize = 20;
    const total = 137;
    const out: unknown[] = [];
    for (let i = 0; i < pageSize; i++) {
      const item: Record<string, unknown> = {};
      for (const f of route.fields) {
        item[f.name] = generateValue(rng, f);
      }
      out.push(item);
    }
    return {
      status: route.status,
      headers,
      body: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        data: out,
      },
      latencyMs: route.latencyMs,
    };
  }
  // default / single
  if (route.isArray) {
    const out: unknown[] = [];
    const len = 5;
    for (let i = 0; i < len; i++) {
      const item: Record<string, unknown> = {};
      for (const f of route.fields) {
        item[f.name] = generateValue(rng, f);
      }
      out.push(item);
    }
    return { status: route.status, headers, body: out, latencyMs: route.latencyMs };
  }
  const item: Record<string, unknown> = {};
  for (const f of route.fields) {
    item[f.name] = generateValue(rng, f);
  }
  return { status: route.status, headers, body: item, latencyMs: route.latencyMs };
}

// ---------- Renderers ----------

export function renderJsonPretty(body: unknown): string {
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

export function renderJsonCompact(body: unknown): string {
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

export function renderCurl(route: MockRoute, baseUrl: string): string {
  const url = `${baseUrl}${route.path}`;
  return [
    `curl -X ${route.method} '${url}' \\`,
    `  -H 'Accept: application/json' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -w '\\n%{http_code} (%{time_total}s)\\n'`,
  ].join("\n");
}

export function renderFetchHandler(config: MockConfig): string {
  const lines: string[] = [
    "// In-browser mock fetch handler. Drop this into your app's service worker",
    "// or wrap window.fetch during development.",
    "const MOCK_ROUTES = " + JSON.stringify(config.routes, null, 2) + ";",
    "",
    "function createRng(seed) {",
    "  let s = seed >>> 0;",
    "  return function() {",
    "    s = (s + 0x6D2B79F5) >>> 0;",
    "    let t = s;",
    "    t = Math.imul(t ^ (t >>> 15), t | 1);",
    "    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);",
    "    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;",
    "  };",
    "}",
    "",
    "export async function mockFetch(req) {",
    "  const url = new URL(req.url);",
    "  for (const route of MOCK_ROUTES) {",
    "    const re = new RegExp('^' + route.path.replace(/\\{[^}]+\\}/g, '[^/]+') + '$');",
    "    if (route.method === req.method && re.test(url.pathname)) {",
    "      await new Promise(r => setTimeout(r, route.latencyMs));",
    "      const seed = Math.floor(Math.random() * 0xffffffff);",
    "      // Generate body using the same faker logic as the UI",
    "      return new Response(JSON.stringify({ mock: true, route: route.path }), {",
    "        status: route.status,",
    "        headers: { 'Content-Type': 'application/json' },",
    "      });",
    "    }",
    "  }",
    "  return fetch(req);",
    "}",
  ];
  return lines.join("\n");
}

export function renderMockoonConfig(config: MockConfig): string {
  const env = {
    name: config.name,
    defaultRoute: "",
    prefix: "",
    latency: 0,
    port: 3000,
    routes: config.routes.map((r) => ({
      uuid: "",
      method: r.method,
      endpoint: r.path,
      description: r.description ?? "",
      enabled: true,
      responses: [
        {
          uuid: "",
          body: JSON.stringify(generateMockResponse(r, hashStringToSeed(r.path)).body),
          latency: r.latencyMs,
          statusCode: r.status,
          label: r.scenario,
          headers: {},
          filePath: "",
          sendFileAsBody: false,
          rules: [],
          rulesOperator: "OR",
          disableTemplating: false,
          fallbackTo404: false,
          default: true,
        },
      ],
    })),
  };
  return JSON.stringify([{ ...env, proxyMode: false, proxyHost: "", cors: true, headers: [] }], null, 2);
}

// ---------- Inspector ----------

const INSPECTOR_KEY = "unqtools:ai-api-mocking:inspector";
const INSPECTOR_MAX = 50;

export function loadInspector(): InspectorEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSPECTOR_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as InspectorEntry[];
    return Array.isArray(arr) ? arr.slice(0, INSPECTOR_MAX) : [];
  } catch {
    return [];
  }
}

export function addInspectorEntry(entry: InspectorEntry): InspectorEntry[] {
  const next = [entry, ...loadInspector()].slice(0, INSPECTOR_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(INSPECTOR_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  return next;
}

export function clearInspector(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(INSPECTOR_KEY); } catch { /* ignore */ }
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  source: "openapi" | "json-sample" | "description";
  name: string;
  routeCount: number;
  fieldCount: number;
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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  source: "openapi" | "json-sample" | "description";
  input: string;
  name: string;
  scenario: Scenario;
  status: number;
  latencyMs: number;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("src", state.source);
  if (state.input) params.set("in", state.input);
  if (state.name) params.set("name", state.name);
  params.set("scen", state.scenario);
  params.set("status", String(state.status));
  params.set("lat", String(state.latencyMs));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const src = params.get("src");
  if (src === "openapi" || src === "json-sample" || src === "description") out.source = src;
  const input = params.get("in");
  if (input) out.input = input;
  const name = params.get("name");
  if (name) out.name = name;
  const scen = params.get("scen") as Scenario | null;
  if (scen && scen in SCENARIO_LABELS) out.scenario = scen;
  const status = params.get("status");
  if (status && /^\d+$/.test(status)) out.status = parseInt(status, 10);
  const lat = params.get("lat");
  if (lat && /^\d+$/.test(lat)) out.latencyMs = parseInt(lat, 10);
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  source: ShareState["source"],
  input: string,
  hint?: string,
): string {
  const role = "You are an API mocking expert. Generate realistic mock data following the schema.";
  const task = `Source: ${source}\nInput:\n${input}\n${hint ? `Hint: ${hint}\n` : ""}`;
  const instructions = [
    "Produce a JSON array of 5 sample records.",
    "Use realistic values (names, emails, dates, prices) — not 'string' or 'example'.",
    "Honor field types inferred from names (e.g., email looks like a real email).",
    "Vary values across records. Output ONLY the JSON array — no markdown, no explanation.",
  ].join(" ");
  return `${role}\n\n${task}\n\n${instructions}`;
}

export function renderLlmResult(rawText: string): { ok: true; body: unknown } | { ok: false; error: string } {
  // Strip markdown code fences if present
  let s = rawText.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return { ok: true, body: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: `LLM returned invalid JSON: ${(e as Error).message}` };
  }
}

// ---------- Stats ----------

export interface MockStats {
  routeCount: number;
  fieldCount: number;
  byMethod: Record<HttpMethod, number>;
  byScenario: Record<Scenario, number>;
  totalFields: number;
}

export function computeStats(routes: MockRoute[]): MockStats {
  const byMethod: Record<HttpMethod, number> = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
  const byScenario: Record<Scenario, number> = {
    default: 0, empty: 0, error: 0, large: 0, paginated: 0, single: 0,
  };
  let totalFields = 0;
  for (const r of routes) {
    byMethod[r.method] += 1;
    byScenario[r.scenario] += 1;
    totalFields += r.fields.length;
  }
  return {
    routeCount: routes.length,
    fieldCount: routes.length > 0 ? Math.round(totalFields / routes.length) : 0,
    byMethod,
    byScenario,
    totalFields,
  };
}
