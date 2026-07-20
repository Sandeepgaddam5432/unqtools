/**
 * Sample JSON / Mock API Response Generator — pure logic.
 *
 * Turns a JSON Schema (or an example JSON we infer a schema from) into
 * realistic mock API responses honoring:
 *   - type: string / number / integer / boolean / array / object / null
 *   - format: email, uuid, date, date-time, time, uri, ipv4, ipv6, phone,
 *             color, password, semver, slug, locale, currency, hex
 *   - enum / const
 *   - minimum / maximum / exclusiveMinimum / exclusiveMaximum
 *   - minLength / maxLength / minItems / maxItems
 *   - items / properties / required
 *   - x-faker override (maps to a named generator)
 *
 * Plus:
 *   - REST / paginated / JSON:API / GraphQL / OData envelope presets
 *   - HTTP status-line + per-status headers
 *   - Error templates (12 status codes)
 *   - Webhook templates (Stripe / GitHub / Slack / Shopify / Twilio / Typeform)
 *   - Example → schema inference
 *   - MSW handler snippet generation
 *
 * Pure functions only — no DOM, no network, no external deps.
 */

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 + helpers
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  bool(): boolean;
  hex(len: number): string;
  string(len: number, charset: string): string;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  const bool = (): boolean => r() < 0.5;
  const hex = (len: number): string => {
    const c = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < len; i++) out += c[Math.floor(r() * 16)];
    return out;
  };
  const string = (len: number, charset: string): string => {
    let out = "";
    for (let i = 0; i < len; i++) out += charset[Math.floor(r() * charset.length)];
    return out;
  };
  return { next: r, int, pick, bool, hex, string };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EndpointType = "rest" | "paginated" | "json-api" | "graphql" | "error" | "webhook";
export type Envelope = "none" | "pagination" | "json-api" | "graphql" | "odata";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type StatusCode = 200 | 201 | 204 | 301 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface JsonSchema {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
  format?: string;
  enum?: Json[];
  const?: Json;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  example?: Json;
  /** Override — maps to a named generator like "name.first" / "internet.email". */
  "x-faker"?: string;
  /** Optional ref (we treat as inline; circular refs return null). */
  $ref?: string;
}

export interface MockOptions {
  schema: JsonSchema;
  endpoint: EndpointType;
  envelope: Envelope;
  count: number;
  seed: string;
  status: StatusCode;
  method: HttpMethod;
  url: string;
  webhook: string;
  pretty: boolean;
}

export type Result<T> = { ok: true; output: T } | { ok: false; error: string };

export interface HttpResponse {
  statusLine: string;
  status: StatusCode;
  headers: Record<string, string>;
  body: Json;
  bodyText: string;
}

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const ENDPOINT_TYPES: ReadonlyArray<{ value: EndpointType; label: string }> = [
  { value: "rest", label: "REST (single / array)" },
  { value: "paginated", label: "REST + Pagination" },
  { value: "json-api", label: "JSON:API" },
  { value: "graphql", label: "GraphQL" },
  { value: "error", label: "Error response" },
  { value: "webhook", label: "Webhook payload" },
];

export const ENVELOPE_PRESETS: ReadonlyArray<{ value: Envelope; label: string }> = [
  { value: "none", label: "None (raw)" },
  { value: "pagination", label: "REST pagination" },
  { value: "json-api", label: "JSON:API" },
  { value: "graphql", label: "GraphQL shape" },
  { value: "odata", label: "OData" },
];

export const HTTP_METHODS: ReadonlyArray<{ value: HttpMethod; label: string }> = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

export const STATUS_CODES: ReadonlyArray<{ value: StatusCode; label: string }> = [
  { value: 200, label: "200 OK" },
  { value: 201, label: "201 Created" },
  { value: 204, label: "204 No Content" },
  { value: 301, label: "301 Moved Permanently" },
  { value: 400, label: "400 Bad Request" },
  { value: 401, label: "401 Unauthorized" },
  { value: 403, label: "403 Forbidden" },
  { value: 404, label: "404 Not Found" },
  { value: 409, label: "409 Conflict" },
  { value: 422, label: "422 Unprocessable Entity" },
  { value: 429, label: "429 Too Many Requests" },
  { value: 500, label: "500 Internal Server Error" },
  { value: 502, label: "502 Bad Gateway" },
  { value: 503, label: "503 Service Unavailable" },
];

export const STATUS_TEXT: Record<StatusCode, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
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
};

export const WEBHOOK_TEMPLATES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "stripe.invoice.paid", label: "Stripe — invoice.paid" },
  { value: "github.push", label: "GitHub — push" },
  { value: "slack.event_callback", label: "Slack — event_callback" },
  { value: "shopify.order_created", label: "Shopify — orders/create" },
  { value: "twilio.message_received", label: "Twilio — incoming SMS" },
  { value: "typeform.form_response", label: "Typeform — form_response" },
];

export const DEFAULT_OPTIONS: MockOptions = {
  schema: {
    type: "object",
    required: ["id", "email", "name", "role", "createdAt"],
    properties: {
      id: { type: "integer", minimum: 1, maximum: 100000 },
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 3, maxLength: 40 },
      role: { type: "string", enum: ["admin", "member", "guest"] },
      active: { type: "boolean" },
      balance: { type: "number", minimum: 0, maximum: 10000 },
      createdAt: { type: "string", format: "date-time" },
      tags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
    },
  },
  endpoint: "rest",
  envelope: "none",
  count: 5,
  seed: "",
  status: 200,
  method: "GET",
  url: "https://api.example.com/v1/users",
  webhook: "stripe.invoice.paid",
  pretty: true,
};

export const MAX_COUNT = 10_000;

export const SAMPLE_SCHEMAS: ReadonlyArray<{ id: string; label: string; schema: JsonSchema }> = [
  {
    id: "user",
    label: "User",
    schema: DEFAULT_OPTIONS.schema,
  },
  {
    id: "product",
    label: "Product",
    schema: {
      type: "object",
      required: ["id", "name", "price", "currency", "inStock"],
      properties: {
        id: { type: "string", format: "uuid" },
        sku: { type: "string", "x-faker": "commerce.sku" },
        name: { type: "string", minLength: 4, maxLength: 60 },
        price: { type: "number", minimum: 0, maximum: 9999 },
        currency: { type: "string", enum: ["USD", "EUR", "GBP", "JPY"] },
        inStock: { type: "boolean" },
        tags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 8 },
        image: { type: "string", format: "uri" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
  {
    id: "order",
    label: "Order",
    schema: {
      type: "object",
      required: ["id", "customerId", "status", "total", "items"],
      properties: {
        id: { type: "string", format: "uuid" },
        customerId: { type: "integer", minimum: 1, maximum: 999999 },
        status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"] },
        total: { type: "number", minimum: 0, maximum: 100000 },
        currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            required: ["productId", "qty", "price"],
            properties: {
              productId: { type: "string", format: "uuid" },
              qty: { type: "integer", minimum: 1, maximum: 100 },
              price: { type: "number", minimum: 0, maximum: 5000 },
            },
          },
        },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
  {
    id: "blog-post",
    label: "Blog Post",
    schema: {
      type: "object",
      required: ["id", "title", "slug", "author", "publishedAt"],
      properties: {
        id: { type: "integer", minimum: 1, maximum: 100000 },
        title: { type: "string", minLength: 8, maxLength: 120 },
        slug: { type: "string", format: "slug" },
        author: { type: "string", "x-faker": "name.full" },
        excerpt: { type: "string", minLength: 20, maxLength: 240 },
        publishedAt: { type: "string", format: "date-time" },
        tags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
      },
    },
  },
  {
    id: "todo",
    label: "Todo",
    schema: {
      type: "object",
      required: ["id", "title", "completed"],
      properties: {
        id: { type: "integer", minimum: 1, maximum: 10000 },
        title: { type: "string", minLength: 3, maxLength: 80 },
        completed: { type: "boolean" },
        userId: { type: "integer", minimum: 1, maximum: 1000 },
      },
    },
  },
  {
    id: "comment",
    label: "Comment",
    schema: {
      type: "object",
      required: ["id", "postId", "name", "email", "body"],
      properties: {
        id: { type: "integer", minimum: 1, maximum: 100000 },
        postId: { type: "integer", minimum: 1, maximum: 10000 },
        name: { type: "string", "x-faker": "name.full" },
        email: { type: "string", format: "email" },
        body: { type: "string", minLength: 20, maxLength: 500 },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Small data dictionaries (for format generators)
// ---------------------------------------------------------------------------

const FIRST_NAMES: readonly string[] = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
];
const LAST_NAMES: readonly string[] = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
];
const DOMAINS: readonly string[] = ["example.com", "test.org", "mail.io", "demo.net", "fake.dev"];
const CURRENCIES: readonly string[] = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
const LOCALES: readonly string[] = ["en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ja-JP", "zh-CN"];
const TAG_WORDS: readonly string[] = [
  "alpha", "beta", "stable", "v2", "draft", "final", "wip", "approved",
  "review", "blocking", "minor", "major", "release", "internal",
];

// ---------------------------------------------------------------------------
// Format generators
// ---------------------------------------------------------------------------

export function genUuid(rng: Rng): string {
  return `${rng.hex(8)}-${rng.hex(4)}-4${rng.hex(3)}-${(8 + rng.int(0, 3)).toString(16)}${rng.hex(3)}-${rng.hex(12)}`;
}

export function genEmail(rng: Rng): string {
  const f = rng.pick(FIRST_NAMES).toLowerCase();
  const l = rng.pick(LAST_NAMES).toLowerCase();
  const d = rng.pick(DOMAINS);
  const n = rng.int(0, 999);
  return `${f}.${l}${n}@${d}`;
}

export function genDate(rng: Rng): string {
  const y = rng.int(2000, 2025);
  const m = rng.int(1, 12);
  const d = rng.int(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function genDateTime(rng: Rng): string {
  const h = rng.int(0, 23);
  const mi = rng.int(0, 59);
  const s = rng.int(0, 59);
  return `${genDate(rng)}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}Z`;
}

export function genTime(rng: Rng): string {
  return `${String(rng.int(0, 23)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}Z`;
}

export function genUri(rng: Rng): string {
  const slugs = ["users", "posts", "orders", "products", "items", "comments", "tags"];
  return `https://api.example.com/v1/${rng.pick(slugs)}/${rng.int(1, 9999)}`;
}

export function genIpv4(rng: Rng): string {
  return `${rng.int(1, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}`;
}

export function genIpv6(rng: Rng): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) parts.push(rng.hex(4));
  return parts.join(":");
}

export function genPhone(rng: Rng): string {
  return `+1 (${rng.int(200, 999)}) ${rng.int(200, 999)}-${String(rng.int(0, 9999)).padStart(4, "0")}`;
}

export function genColor(rng: Rng): string {
  return `#${rng.hex(6)}`;
}

export function genPassword(rng: Rng): string {
  return rng.string(16, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*");
}

export function genSemver(rng: Rng): string {
  return `${rng.int(0, 5)}.${rng.int(0, 20)}.${rng.int(0, 30)}`;
}

export function genSlug(rng: Rng): string {
  const a = rng.pick(["hello", "world", "fake", "mock", "test", "demo", "sample", "data"]);
  const b = rng.pick(["post", "user", "item", "order", "tag", "note", "task"]);
  const n = rng.int(1, 9999);
  return `${a}-${b}-${n}`;
}

export function genLocale(rng: Rng): string {
  return rng.pick(LOCALES);
}

export function genCurrency(rng: Rng): string {
  return rng.pick(CURRENCIES);
}

export function genHex(rng: Rng, len: number): string {
  return rng.hex(len);
}

export function genNameFull(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

export function genLorem(rng: Rng, min: number, max: number): string {
  const words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
    "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et"];
  const len = rng.int(min, Math.max(min, Math.min(max, 100)));
  const out: string[] = [];
  for (let i = 0; i < len; i++) out.push(rng.pick(words));
  let s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function genCommerceSku(rng: Rng): string {
  return `${rng.string(3, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}-${rng.int(1000, 9999)}`;
}

/** Dispatch a `format` string to the right generator. Unknown formats
 *  fall back to a default string. */
export function generateByFormat(rng: Rng, format: string): string {
  switch (format) {
    case "email": return genEmail(rng);
    case "uuid": return genUuid(rng);
    case "date": return genDate(rng);
    case "date-time": return genDateTime(rng);
    case "time": return genTime(rng);
    case "uri":
    case "url": return genUri(rng);
    case "ipv4": return genIpv4(rng);
    case "ipv6": return genIpv6(rng);
    case "phone": return genPhone(rng);
    case "color": return genColor(rng);
    case "password": return genPassword(rng);
    case "semver": return genSemver(rng);
    case "slug": return genSlug(rng);
    case "locale": return genLocale(rng);
    case "currency": return genCurrency(rng);
    case "hex": return genHex(rng, 8);
    default: return rng.pick(FIRST_NAMES);
  }
}

/** Dispatch an `x-faker` string to a named generator. */
export function generateByFaker(rng: Rng, faker: string): Json {
  switch (faker) {
    case "name.first": return rng.pick(FIRST_NAMES);
    case "name.last": return rng.pick(LAST_NAMES);
    case "name.full": return genNameFull(rng);
    case "internet.email": return genEmail(rng);
    case "internet.url": return genUri(rng);
    case "internet.password": return genPassword(rng);
    case "datatype.uuid": return genUuid(rng);
    case "datatype.boolean": return rng.bool();
    case "datatype.number": return rng.int(0, 1000);
    case "address.city": return rng.pick(["Springfield", "Riverdale", "Gotham", "Metropolis", "Star City"]);
    case "commerce.sku": return genCommerceSku(rng);
    case "commerce.price": return Number((rng.next() * 1000).toFixed(2));
    case "system.semver": return genSemver(rng);
    case "lorem.sentence": return genLorem(rng, 6, 16);
    case "lorem.paragraph": return genLorem(rng, 30, 80);
    default: return rng.pick(FIRST_NAMES);
  }
}

// ---------------------------------------------------------------------------
// Schema faker — the core recursive generator
// ---------------------------------------------------------------------------

/** Recursively generate a value matching the given schema. */
export function generateMock(
  rng: Rng,
  schema: JsonSchema,
  seen: Set<string> = new Set(),
  path: string = "#",
): Json {
  // Circular-ref guard
  if (seen.has(path)) return null;
  seen.add(path);

  // x-faker override wins
  if (schema["x-faker"]) {
    return generateByFaker(rng, schema["x-faker"]);
  }
  // const wins
  if (schema.const !== undefined) return schema.const;
  // enum wins
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return rng.pick(schema.enum);
  }
  // example wins (if present)
  if (schema.example !== undefined) return schema.example;

  const t = schema.type;
  switch (t) {
    case "string": {
      if (schema.format) return generateByFormat(rng, schema.format);
      const min = schema.minLength ?? 0;
      const max = schema.maxLength ?? Math.max(min + 8, 20);
      const len = rng.int(Math.min(min, max), Math.max(min, max));
      return rng.string(Math.max(1, len), "abcdefghijklmnopqrstuvwxyz ");
    }
    case "integer": {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? 1000;
      const lo = schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : min;
      const hi = schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - 1 : max;
      return rng.int(Math.min(lo, hi), Math.max(lo, hi));
    }
    case "number": {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? 1000;
      const lo = schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum : min;
      const hi = schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum : max;
      const v = lo + rng.next() * (hi - lo);
      return Number(v.toFixed(2));
    }
    case "boolean":
      return rng.bool();
    case "null":
      return null;
    case "array": {
      const minItems = schema.minItems ?? 1;
      const maxItems = schema.maxItems ?? Math.max(minItems + 2, 5);
      const n = rng.int(Math.min(minItems, maxItems), Math.max(minItems, maxItems));
      const itemSchema = schema.items ?? { type: "string" };
      const out: Json[] = [];
      for (let i = 0; i < n; i++) {
        out.push(generateMock(rng, itemSchema, seen, `${path}/${i}`));
      }
      return out;
    }
    case "object":
    default: {
      const props = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const out: Record<string, Json> = {};
      for (const [k, v] of Object.entries(props)) {
        // Always include required fields; include optional ~70% of the time.
        if (!required.has(k) && rng.next() < 0.3) continue;
        out[k] = generateMock(rng, v, seen, `${path}/${k}`);
      }
      return out;
    }
  }
}

// ---------------------------------------------------------------------------
// Example → schema inference
// ---------------------------------------------------------------------------

function inferType(v: Json): JsonSchema["type"] {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "string") return "string";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  if (typeof v === "boolean") return "boolean";
  return "object";
}

function inferFormat(v: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return "date";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return "date-time";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "uuid";
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "email";
  if (/^https?:\/\//.test(v)) return "uri";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return "ipv4";
  if (/^#[0-9a-f]{6}$/i.test(v)) return "color";
  if (/^\+?\d[\d\s\-()]{6,}$/.test(v)) return "phone";
  return undefined;
}

/** Infer a JSON Schema from an example JSON value. */
export function inferSchemaFromExample(value: Json): JsonSchema {
  const t = inferType(value);
  switch (t) {
    case "string": {
      return { type: "string", format: inferFormat(value as string), example: value };
    }
    case "integer":
    case "number":
    case "boolean":
    case "null":
      return { type: t, example: value };
    case "array": {
      const arr = value as Json[];
      if (arr.length === 0) return { type: "array", items: { type: "string" } };
      // If all items share the same inferred schema, use it; else fallback to first.
      const firstItemSchema = inferSchemaFromExample(arr[0] as Json);
      return { type: "array", items: firstItemSchema, minItems: 1, maxItems: arr.length };
    }
    case "object":
    default: {
      const obj = value as { [k: string]: Json };
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        properties[k] = inferSchemaFromExample(v);
        required.push(k);
      }
      return { type: "object", properties, required };
    }
  }
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

export function validateSchema(schema: JsonSchema): Result<void> {
  if (!schema || typeof schema !== "object") {
    return { ok: false, error: "Schema must be an object." };
  }
  if (schema.type && ![
    "string", "number", "integer", "boolean", "array", "object", "null",
  ].includes(schema.type)) {
    return { ok: false, error: `Unknown type: ${schema.type}` };
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) {
    return { ok: false, error: "minimum must be ≤ maximum." };
  }
  if (schema.minLength !== undefined && schema.maxLength !== undefined && schema.minLength > schema.maxLength) {
    return { ok: false, error: "minLength must be ≤ maxLength." };
  }
  if (schema.minItems !== undefined && schema.maxItems !== undefined && schema.minItems > schema.maxItems) {
    return { ok: false, error: "minItems must be ≤ maxItems." };
  }
  if (schema.type === "array" && !schema.items) {
    return { ok: false, error: "Array schema requires 'items'." };
  }
  return { ok: true, output: undefined };
}

// ---------------------------------------------------------------------------
// Envelope wrappers
// ---------------------------------------------------------------------------

/** Wrap an array of mock items in the chosen envelope. Single-object endpoints
 *  bypass envelopes (envelope="none" path) and return the first item directly. */
export function wrapEnvelope(items: Json[], envelope: Envelope, opts: MockOptions): Json {
  const rng = createRng(opts.seed || `env-${opts.count}`);
  switch (envelope) {
    case "none":
      return opts.count === 1 ? items[0] ?? null : items;
    case "pagination": {
      const page = opts.endpoint === "paginated" ? rng.int(1, 10) : 1;
      const limit = opts.count;
      const total = rng.int(limit, limit * 20);
      const pages = Math.ceil(total / Math.max(limit, 1));
      return {
        data: items,
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      };
    }
    case "json-api": {
      const resource: string = (opts.url.split("/").pop() || "resource");
      const data: Json[] = items.map((it): Json => {
        if (it && typeof it === "object" && !Array.isArray(it)) {
          const o = it as Record<string, Json>;
          const { id, type, ...attributes } = o;
          return {
            id: id ?? rng.int(1, 999999),
            type: type ?? resource,
            attributes,
          } as Json;
        }
        return { id: rng.int(1, 999999), type: resource, attributes: it } as Json;
      });
      return { data, meta: { total: items.length, count: items.length } } as Json;
    }
    case "graphql": {
      // Pick the resource name from the URL.
      const field = opts.url.split("/").pop() ?? "data";
      return {
        data: { [field]: opts.count === 1 ? items[0] ?? null : items },
        errors: null,
        extensions: { queryType: field },
      };
    }
    case "odata": {
      return {
        "@odata.context": `${opts.url}/$metadata#${opts.url.split("/").pop()}`,
        value: items,
        "@odata.nextLink": `${opts.url}?$skip=${opts.count}`,
      };
    }
    default:
      return items;
  }
}

// ---------------------------------------------------------------------------
// Error templates
// ---------------------------------------------------------------------------

export interface ErrorTemplate {
  status: StatusCode;
  error: string;
  message: string;
  details?: Json;
}

export const ERROR_TEMPLATES: Record<StatusCode, ErrorTemplate> = {
  200: { status: 200, error: "ok", message: "Request succeeded." },
  201: { status: 201, error: "created", message: "Resource created successfully." },
  204: { status: 204, error: "no_content", message: "No content." },
  301: { status: 301, error: "moved_permanently", message: "The resource has moved permanently." },
  400: {
    status: 400, error: "bad_request", message: "The request was malformed.",
    details: { fields: [{ field: "email", issue: "must be a valid email address" }] },
  },
  401: { status: 401, error: "unauthorized", message: "Authentication credentials are missing or invalid." },
  403: { status: 403, error: "forbidden", message: "You do not have permission to access this resource." },
  404: { status: 404, error: "not_found", message: "The requested resource was not found." },
  409: { status: 409, error: "conflict", message: "The request conflicts with the current state of the resource." },
  422: {
    status: 422, error: "unprocessable_entity", message: "Validation failed for one or more fields.",
    details: {
      fields: [
        { field: "username", issue: "is already taken" },
        { field: "email", issue: "must be a valid email address" },
      ],
    },
  },
  429: {
    status: 429, error: "too_many_requests", message: "Rate limit exceeded.",
    details: { retryAfter: 60, limit: 100, remaining: 0 },
  },
  500: { status: 500, error: "internal_server_error", message: "An unexpected error occurred on the server." },
  502: { status: 502, error: "bad_gateway", message: "Bad gateway: upstream server returned an invalid response." },
  503: { status: 503, error: "service_unavailable", message: "The service is temporarily unavailable for maintenance." },
};

/** Generate an error-response body for the given status code. */
export function generateErrorBody(status: StatusCode, opts: MockOptions): Json {
  const tpl = ERROR_TEMPLATES[status] ?? ERROR_TEMPLATES[500];
  const rng = createRng(opts.seed || `err-${status}`);
  return {
    status: tpl.status,
    error: tpl.error,
    message: tpl.message,
    details: tpl.details ?? null,
    requestId: genUuid(rng),
    timestamp: genDateTime(rng),
  };
}

// ---------------------------------------------------------------------------
// Webhook templates
// ---------------------------------------------------------------------------

/** Generate a webhook payload for the named template. */
export function generateWebhook(name: string, opts: MockOptions): Json {
  const rng = createRng(opts.seed || `wh-${name}`);
  switch (name) {
    case "stripe.invoice.paid": {
      return {
        id: `evt_${rng.string(24, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`,
        object: "event",
        api_version: "2024-06-20",
        created: Math.floor(Date.now() / 1000) - rng.int(0, 86400),
        type: "invoice.paid",
        data: {
          object: {
            id: `in_${rng.string(24, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`,
            object: "invoice",
            amount_paid: rng.int(100, 100000),
            currency: rng.pick(["usd", "eur", "gbp"]),
            customer: `cus_${rng.string(14, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`,
            status: "paid",
            paid: true,
            created: Math.floor(Date.now() / 1000) - rng.int(0, 86400),
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: genUuid(rng), idempotency_key: null },
      };
    }
    case "github.push": {
      const repo = rng.pick(["acme/api", "acme/web", "acme/docs", "acme/mobile"]);
      const ref = `refs/heads/${rng.pick(["main", "develop", "release/v2"])}`;
      const commits: Json[] = [];
      for (let i = 0; i < rng.int(1, 3); i++) {
        commits.push({
          id: genUuid(rng),
          message: rng.pick(["fix: typo in README", "feat: add user endpoint", "chore: bump deps", "docs: update API"]),
          timestamp: genDateTime(rng),
          author: { name: genNameFull(rng), email: genEmail(rng), username: rng.pick(["octocat", "dev"]).toString().toLowerCase() },
        });
      }
      return {
        ref,
        before: genUuid(rng),
        after: genUuid(rng),
        repository: {
          id: rng.int(100000, 999999),
          name: repo.split("/")[1]!,
          full_name: repo,
          private: rng.bool(),
          html_url: `https://github.com/${repo}`,
        },
        pusher: { name: genNameFull(rng), email: genEmail(rng) },
        sender: { login: rng.pick(["octocat", "devops", "bot-ci"]), id: rng.int(1, 9999) },
        commits,
        head_commit: commits[commits.length - 1] ?? null,
      };
    }
    case "slack.event_callback": {
      return {
        token: rng.string(24, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
        team_id: `T${rng.string(9, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`,
        api_app_id: `A${rng.string(9, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`,
        event: {
          type: "message",
          channel: `C${rng.string(9, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`,
          user: `U${rng.string(9, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`,
          text: rng.pick(["Hello world!", "Anyone seen the docs?", ":tada:", "Standup in 5"]),
          ts: `${Math.floor(Date.now() / 1000)}.${rng.int(100000, 999999)}`,
        },
        type: "event_callback",
        event_id: genUuid(rng),
        event_time: Math.floor(Date.now() / 1000),
        authed_users: [`U${rng.string(9, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`],
      };
    }
    case "shopify.order_created": {
      return {
        id: rng.int(1000000000000, 9999999999999),
        email: genEmail(rng),
        closed_at: null,
        created_at: genDateTime(rng),
        updated_at: genDateTime(rng),
        number: rng.int(1000, 9999),
        note: null,
        total_price: `${(rng.next() * 1000).toFixed(2)}`,
        subtotal_price: `${(rng.next() * 800).toFixed(2)}`,
        total_weight: rng.int(0, 5000),
        currency: rng.pick(["USD", "EUR", "GBP"]),
        financial_status: rng.pick(["pending", "paid", "refunded", "partially_paid"]),
        fulfillment_status: null,
        customer: {
          id: rng.int(1000000000000, 9999999999999),
          email: genEmail(rng),
          first_name: rng.pick(FIRST_NAMES),
          last_name: rng.pick(LAST_NAMES),
          orders_count: rng.int(1, 50),
        },
        line_items: [
          {
            id: rng.int(100000, 999999),
            title: rng.pick(["Widget", "Gadget", "Sprocket", "Gizmo"]),
            quantity: rng.int(1, 5),
            price: `${(rng.next() * 100).toFixed(2)}`,
          },
        ],
      };
    }
    case "twilio.message_received": {
      return {
        MessageSid: `SM${rng.string(32, "abcdef0123456789")}`,
        AccountSid: `AC${rng.string(32, "abcdef0123456789")}`,
        From: genPhone(rng),
        To: genPhone(rng),
        Body: rng.pick(["Hello!", "STOP", "Yes please", "Reply YES to confirm"]),
        FromCity: rng.pick(["Springfield", "Riverdale", "Gotham"]),
        FromState: rng.pick(["CA", "NY", "TX"]),
        FromCountry: "US",
        ApiVersion: "2010-04-01",
      };
    }
    case "typeform.form_response": {
      return {
        event_id: genUuid(rng),
        event_type: "form_response",
        form_response: {
          form_id: genUuid(rng),
          token: rng.string(20, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
          submitted_at: genDateTime(rng),
          hidden: {},
          answers: [
            { field: { id: "field1", type: "short_text", ref: "name" }, type: "text", text: genNameFull(rng) },
            { field: { id: "field2", type: "email", ref: "email" }, type: "email", email: genEmail(rng) },
          ],
        },
      };
    }
    default:
      return { error: `Unknown webhook template: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Headers + status line
// ---------------------------------------------------------------------------

/** Compute byte length of a UTF-8 string without depending on Node `Buffer`. */
export function byteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  // Fallback: approximate by counting non-ASCII chars as 2 bytes.
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}

/** Generate HTTP headers appropriate for the status code and body. */
export function generateHeaders(status: StatusCode, body: Json, opts: MockOptions): Record<string, string> {
  const rng = createRng(opts.seed || `hdr-${status}`);
  const bodyText = opts.pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(byteLength(bodyText)),
    "X-Request-Id": genUuid(rng),
    "X-Response-Time": `${rng.int(5, 500)}ms`,
    Date: new Date().toUTCString(),
    Server: "unqtools-mock/1.0",
  };

  // Status-specific headers
  if (status === 201) {
    headers["Location"] = `${opts.url}/${rng.int(1, 9999)}`;
  } else if (status === 301) {
    headers["Location"] = `${opts.url}/v2`;
  } else if (status === 204) {
    delete headers["Content-Type"];
    delete headers["Content-Length"];
  } else if (status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="api"';
  } else if (status === 403) {
    headers["X-Forbidden-Reason"] = "insufficient_scope";
  } else if (status === 429) {
    headers["Retry-After"] = "60";
    headers["X-RateLimit-Limit"] = "100";
    headers["X-RateLimit-Remaining"] = "0";
    headers["X-RateLimit-Reset"] = String(Math.floor(Date.now() / 1000) + 60);
  } else if (status === 503) {
    headers["Retry-After"] = "300";
  }

  // REST envelope pagination headers
  if (opts.envelope === "pagination" && status < 400) {
    headers["X-Page"] = String(rng.int(1, 10));
    headers["X-Per-Page"] = String(opts.count);
    headers["X-Total"] = String(rng.int(opts.count, opts.count * 20));
  }
  return headers;
}

/** Generate the HTTP status line: `HTTP/1.1 200 OK`. */
export function generateStatusLine(status: StatusCode): string {
  return `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Unknown"}`;
}

// ---------------------------------------------------------------------------
// Response assembly
// ---------------------------------------------------------------------------

/** Validate the full options before response generation. */
export function validateOptions(opts: MockOptions): Result<void> {
  if (opts.count < 1) return { ok: false, error: "Count must be at least 1." };
  if (opts.count > MAX_COUNT) return { ok: false, error: `Count exceeds max (${MAX_COUNT.toLocaleString()}).` };
  const sv = validateSchema(opts.schema);
  if (!sv.ok) return sv;
  if (!opts.url || !/^https?:\/\//.test(opts.url)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }
  return { ok: true, output: undefined };
}

/** Build the response body for the chosen endpoint type. */
export function buildResponseBody(opts: MockOptions): Result<Json> {
  const rng = createRng(opts.seed || `mock-${opts.count}`);
  switch (opts.endpoint) {
    case "error": {
      return { ok: true, output: generateErrorBody(opts.status, opts) };
    }
    case "webhook": {
      return { ok: true, output: generateWebhook(opts.webhook, opts) };
    }
    case "rest":
    case "paginated":
    case "json-api":
    case "graphql":
    default: {
      const items: Json[] = [];
      for (let i = 0; i < opts.count; i++) {
        items.push(generateMock(rng, opts.schema, new Set(), `#/${i}`));
      }
      const envelope = opts.endpoint === "paginated" ? "pagination"
        : opts.endpoint === "json-api" ? "json-api"
        : opts.endpoint === "graphql" ? "graphql"
        : opts.envelope;
      return { ok: true, output: wrapEnvelope(items, envelope, opts) };
    }
  }
}

/** Generate the full HTTP response: status line, headers, body. */
export function generateResponse(opts: MockOptions): Result<HttpResponse> {
  const v = validateOptions(opts);
  if (!v.ok) return v;
  const body = buildResponseBody(opts);
  if (!body.ok) return body;
  const headers = generateHeaders(opts.status, body.output, opts);
  const statusLine = generateStatusLine(opts.status);
  const bodyText = opts.pretty ? JSON.stringify(body.output, null, 2) : JSON.stringify(body.output);
  return { ok: true, output: { statusLine, status: opts.status, headers, body: body.output, bodyText } };
}

/** Render the response as raw HTTP (status line + headers + blank line + body). */
export function exportHttp(resp: HttpResponse): string {
  const headerLines = Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`);
  return [resp.statusLine, ...headerLines, "", resp.bodyText].join("\n");
}

// ---------------------------------------------------------------------------
// MSW (Mock Service Worker) snippet
// ---------------------------------------------------------------------------

/** Generate an MSW v2 handler snippet for the given response. */
export function generateMswSnippet(opts: MockOptions, resp: HttpResponse): string {
  const bodyLiteral = JSON.stringify(resp.body, null, 2);
  const headersLiteral = JSON.stringify(resp.headers, null, 2);
  return `import { http, HttpResponse } from "msw";

export const handler = http.${opts.method.toLowerCase()}("${opts.url}", () => {
  return HttpResponse.json(
    ${bodyLiteral},
    {
      status: ${resp.status},
      headers: ${headersLiteral},
    },
  );
});`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mock-api-response:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  endpoint: EndpointType;
  envelope: Envelope;
  status: StatusCode;
  count: number;
  seed: string;
  url: string;
  bytes: number;
  preview: string;
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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: MockOptions): string {
  const params = new URLSearchParams();
  params.set("e", opts.endpoint);
  params.set("ev", opts.envelope);
  params.set("c", String(opts.count));
  params.set("s", String(opts.status));
  params.set("m", opts.method);
  params.set("u", opts.url);
  if (opts.seed) params.set("sd", opts.seed);
  if (opts.webhook) params.set("w", opts.webhook);
  if (!opts.pretty) params.set("p", "0");
  // Schema is encoded as base64 JSON (compressed-ish via URI component).
  params.set("sc", encodeURIComponent(JSON.stringify(opts.schema)));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): MockOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: MockOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);

  const e = params.get("e");
  if (e && (ENDPOINT_TYPES.map((x) => x.value) as EndpointType[]).includes(e as EndpointType)) {
    base.endpoint = e as EndpointType;
  }
  const ev = params.get("ev");
  if (ev && (ENVELOPE_PRESETS.map((x) => x.value) as Envelope[]).includes(ev as Envelope)) {
    base.envelope = ev as Envelope;
  }
  const c = Number(params.get("c"));
  if (Number.isFinite(c) && c >= 1 && c <= MAX_COUNT) base.count = Math.floor(c);
  const s = Number(params.get("s"));
  if (Number.isFinite(s) && (STATUS_CODES.map((x) => x.value) as StatusCode[]).includes(s as StatusCode)) {
    base.status = s as StatusCode;
  }
  const m = params.get("m");
  if (m && (HTTP_METHODS.map((x) => x.value) as HttpMethod[]).includes(m as HttpMethod)) {
    base.method = m as HttpMethod;
  }
  const u = params.get("u");
  if (u && /^https?:\/\//.test(u)) base.url = u;
  const sd = params.get("sd");
  if (sd) base.seed = sd.slice(0, 200);
  const w = params.get("w");
  if (w) base.webhook = w;
  if (params.get("p") === "0") base.pretty = false;
  const sc = params.get("sc");
  if (sc) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sc)) as JsonSchema;
      if (parsed && typeof parsed === "object") base.schema = parsed;
    } catch {
      // ignore — keep default schema
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// Serialization helpers (for UI text editing)
// ---------------------------------------------------------------------------

/** Serialize a schema to pretty JSON text. */
export function serializeSchema(schema: JsonSchema): string {
  return JSON.stringify(schema, null, 2);
}

/** Parse schema JSON text; returns Result<JsonSchema>. */
export function parseSchema(text: string): Result<JsonSchema> {
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "Schema must be a JSON object." };
    }
    return { ok: true, output: v as JsonSchema };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}
