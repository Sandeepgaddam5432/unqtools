/**
 * AI JS Object to JSON Schema Converter — pure logic.
 *
 * Infer a JSON Schema from a JS object / JSON sample (or multiple samples).
 * Recursive type inference for string, number, integer, boolean, null, array,
 * object. Format detection (email, date-time, date, uri, uuid). Enum inference
 * for small string sets. Multi-sample merging with anyOf for mixed types.
 * Required-field handling, constraint inference, JSON validation.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 *
 * Honesty: inferred schemas reflect only the samples you provide — review
 * constraints before using the schema for validation. Empty arrays are flagged
 * because their item schema cannot be inferred from zero elements.
 */

// ---------- Types ----------

export type JsonType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "array"
  | "object";

export type JsonSchemaDraft = "draft-07" | "draft-2020-12";

/** A JSON Schema node. Kept loose because schema keywords vary by draft. */
export interface JsonSchema {
  type?: JsonType | JsonType[];
  format?: string;
  enum?: unknown[];
  items?: JsonSchema | JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  description?: string;
  title?: string;
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
  default?: unknown;
  examples?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}

export interface InferenceOptions {
  /** Detect email/date/uri/uuid formats on string fields. Default true. */
  detectFormats?: boolean;
  /** Infer enums when a string field has 2–20 distinct values. Default true. */
  inferEnums?: boolean;
  /** Mark a field as required only if it appears in every sample. Default true. */
  inferRequired?: boolean;
  /** Infer minLength/maxLength/minimum/maximum constraints. Default true. */
  inferConstraints?: boolean;
  /** Output draft. Default 'draft-07'. */
  draft?: JsonSchemaDraft;
}

export interface InferenceResult {
  schema: JsonSchema;
  /** Warnings (e.g., empty arrays, mixed types). */
  warnings: string[];
  /** Notes about inferred formats/enums per path. */
  notes: Array<{ path: string; note: string }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export interface HistoryEntry {
  ts: number;
  draft: JsonSchemaDraft;
  rootType: string;
  fieldCount: number;
  sampleCount: number;
}

export interface ShareState {
  samples: string;
  options: InferenceOptions;
}

export interface LlmResult {
  descriptions: Array<{ path: string; description: string }>;
  title?: string;
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-js-object-to-json-schema-converter:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-js-object-to-json-schema-converter:llm-key";

export const DRAFT_LABELS: Record<JsonSchemaDraft, string> = {
  "draft-07": "Draft 7",
  "draft-2020-12": "Draft 2020-12",
};

export const DRAFT_SCHEMA_URIS: Record<JsonSchemaDraft, string> = {
  "draft-07": "http://json-schema.org/draft-07/schema#",
  "draft-2020-12": "https://json-schema.org/draft/2020-12/schema",
};

/** Sample objects shipped as one-click presets in the UI. */
export const SAMPLE_OBJECTS: Array<{ name: string; value: unknown }> = [
  {
    name: "User",
    value: {
      id: 42,
      name: "Alice Lee",
      email: "alice@example.com",
      active: true,
      role: "admin",
      createdAt: "2024-01-15T10:30:00Z",
    },
  },
  {
    name: "Product",
    value: {
      sku: "ABC-123",
      title: "Wireless Mouse",
      price: 29.99,
      tags: ["electronics", "accessory"],
      stock: 120,
      inStock: true,
      manufacturer: { name: "Acme", country: "US" },
    },
  },
  {
    name: "Order",
    value: {
      orderId: "ord_abc123",
      customerId: 7,
      items: [
        { productId: 1, qty: 2, price: 9.99 },
        { productId: 5, qty: 1, price: 19.0 },
      ],
      total: 38.98,
      currency: "USD",
      placedAt: "2024-02-01",
      shipped: false,
    },
  },
  {
    name: "Blog post",
    value: {
      slug: "hello-world",
      title: "Hello World",
      body: "Welcome to my blog.",
      author: { name: "Bob", email: "bob@example.com" },
      tags: ["intro", "news"],
      publishedAt: "2024-03-01T08:00:00Z",
      wordCount: 4,
    },
  },
];

// ---------- Type detection ----------

/** Detect the JSON type of a value. Numbers with zero fractional part are 'integer'. */
export function inferType(value: unknown): JsonType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "string") return "string";
  if (t === "boolean") return "boolean";
  if (t === "number") {
    return Number.isInteger(value as number) ? "integer" : "number";
  }
  if (t === "object") return "object";
  // undefined, function, symbol → treat as null.
  return "null";
}

/** Detect a common string format. Returns null if no format detected. */
export function inferFormat(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  // UUID v1–v5
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return "uuid";
  }
  // Email (simple but practical)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
  // Date-time (ISO 8601 with time)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(value)) {
    return "date-time";
  }
  // Date only
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  // URI (http/https)
  if (/^https?:\/\/[^\s]+$/i.test(value)) return "uri";
  return null;
}

/**
 * Infer an enum from a list of values. Returns the enum array if the values
 * are a small set (2–20) of strings/numbers, all distinct, and shorter than
 * 40 chars. Returns null otherwise.
 */
export function inferEnum(values: unknown[]): unknown[] | null {
  if (values.length < 2) return null;
  const distinct = new Set<unknown>();
  for (const v of values) {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") return null;
    if (typeof v === "string" && v.length > 40) return null;
    distinct.add(v);
  }
  const size = distinct.size;
  if (size < 2 || size > 20) return null;
  if (size > values.length * 0.9) return null; // too varied → not a real enum
  return Array.from(distinct);
}

/** Compute minimum/maximum constraints for a list of numbers. */
export function inferNumberConstraints(values: number[]): Pick<JsonSchema, "minimum" | "maximum"> {
  const out: Pick<JsonSchema, "minimum" | "maximum"> = {};
  if (values.length === 0) return out;
  out.minimum = Math.min(...values);
  out.maximum = Math.max(...values);
  return out;
}

/** Compute minLength/maxLength constraints for a list of strings. */
export function inferStringConstraints(values: string[]): Pick<JsonSchema, "minLength" | "maxLength"> {
  const out: Pick<JsonSchema, "minLength" | "maxLength"> = {};
  if (values.length === 0) return out;
  let min = Infinity;
  let max = 0;
  for (const s of values) {
    if (s.length < min) min = s.length;
    if (s.length > max) max = s.length;
  }
  out.minLength = min;
  out.maxLength = max;
  return out;
}

// ---------- Single-sample inference ----------

/**
 * Infer a JsonSchema for a single value. Collects warnings and notes along the
 * way via the accumulator argument.
 */
export function inferSchemaForValue(
  value: unknown,
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): JsonSchema {
  const t = inferType(value);
  if (t === "null") return { type: "null" };
  if (t === "boolean") return { type: "boolean" };
  if (t === "integer") return { type: "integer" };
  if (t === "number") return { type: "number" };
  if (t === "string") {
    const schema: JsonSchema = { type: "string" };
    if (options.detectFormats !== false) {
      const fmt = inferFormat(value);
      if (fmt) {
        schema.format = fmt;
        acc.notes.push({ path, note: `detected format '${fmt}'` });
      }
    }
    if (options.inferConstraints !== false) {
      const c = inferStringConstraints([value as string]);
      if (c.minLength !== undefined) schema.minLength = c.minLength;
      if (c.maxLength !== undefined) schema.maxLength = c.maxLength;
    }
    return schema;
  }
  if (t === "array") {
    const arr = value as unknown[];
    if (arr.length === 0) {
      acc.warnings.push(`Array at '${path}' is empty — item schema cannot be inferred. Falling back to items: {}.`);
      return { type: "array", items: {} };
    }
    // Merge item schemas across all elements.
    const itemSchemas = arr.map((item, i) =>
      inferSchemaForValue(item, options, acc, `${path}[${i}]`),
    );
    const merged = mergeSchemas(itemSchemas, options, acc, path);
    return { type: "array", items: merged };
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    const keys = Object.keys(obj);
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      properties[k] = inferSchemaForValue(obj[k], options, acc, childPath);
      required.push(k);
    }
    const schema: JsonSchema = { type: "object", properties };
    if (options.inferRequired !== false) schema.required = required;
    schema.additionalProperties = false;
    return schema;
  }
  return {};
}

// ---------- Schema merging (multi-sample) ----------

/** Merge two JsonSchema nodes, producing anyOf when types differ. */
export function mergeTwo(
  a: JsonSchema,
  b: JsonSchema,
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): JsonSchema {
  // Normalize type to an array for comparison.
  const typesA = typeList(a.type);
  const typesB = typeList(b.type);
  const union = Array.from(new Set([...typesA, ...typesB]));
  if (union.length === 0) return {};

  // If both are the same single type, merge in type-specific ways.
  if (union.length === 1) {
    const t = union[0];
    if (t === "object") {
      return mergeObjects(a, b, options, acc, path);
    }
    if (t === "array") {
      return mergeArrays(a, b, options, acc, path);
    }
    // scalar type — merge format/enum/constraints
    const merged: JsonSchema = { type: t };
    // Pick a format if both agree; otherwise drop it.
    if (a.format && b.format && a.format === b.format) merged.format = a.format;
    // Merge enums.
    const enumVals = new Set<unknown>();
    if (a.enum) for (const v of a.enum) enumVals.add(v);
    if (b.enum) for (const v of b.enum) enumVals.add(v);
    if (enumVals.size > 0) {
      const e = Array.from(enumVals);
      if (options.inferEnums !== false && e.length >= 2 && e.length <= 20) {
        merged.enum = e;
      }
    }
    // Merge number constraints.
    if (t === "number" || t === "integer") {
      const nums: number[] = [];
      if (a.minimum !== undefined) nums.push(a.minimum);
      if (b.minimum !== undefined) nums.push(b.minimum);
      if (a.maximum !== undefined) nums.push(a.maximum);
      if (b.maximum !== undefined) nums.push(b.maximum);
      if (nums.length > 0) {
        const c = inferNumberConstraints(nums);
        if (c.minimum !== undefined) merged.minimum = c.minimum;
        if (c.maximum !== undefined) merged.maximum = c.maximum;
      }
    }
    // Merge string constraints.
    if (t === "string") {
      const lens: number[] = [];
      if (a.minLength !== undefined) lens.push(a.minLength);
      if (b.minLength !== undefined) lens.push(b.minLength);
      if (a.maxLength !== undefined) lens.push(a.maxLength);
      if (b.maxLength !== undefined) lens.push(b.maxLength);
      if (lens.length > 0) {
        const c = inferStringConstraints(
          lens.map((n) => "x".repeat(n)),
        );
        if (c.minLength !== undefined) merged.minLength = c.minLength;
        if (c.maxLength !== undefined) merged.maxLength = c.maxLength;
      }
    }
    return merged;
  }

  // Mixed types — produce anyOf. Special case: null + one other type → nullable.
  const nonNull = union.filter((t) => t !== "null");
  if (union.includes("null") && nonNull.length === 1) {
    const merged = mergeTwo(
      a.type === "null" ? {} : stripNull(a),
      b.type === "null" ? {} : stripNull(b),
      options,
      acc,
      path,
    );
    if (options.draft === "draft-2020-12") {
      // Draft 2020-12 supports type arrays.
      merged.type = [nonNull[0] as JsonType, "null"];
    } else {
      merged.anyOf = [{ type: nonNull[0] as JsonType }, { type: "null" }];
      delete merged.type;
    }
    acc.notes.push({ path, note: `nullable ${nonNull[0]}` });
    return merged;
  }

  acc.warnings.push(`Mixed types at '${path}': ${union.join(" | ")}. Emitted anyOf.`);
  const branches = union.map((t) => {
    const src = typesA.includes(t) ? a : b;
    return { ...src, type: t };
  });
  return { anyOf: branches };
}

/** Merge multiple schemas via fold. */
export function mergeSchemas(
  schemas: JsonSchema[],
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): JsonSchema {
  if (schemas.length === 0) return {};
  return schemas.reduce((acc2, s) => mergeTwo(acc2, s, options, acc, path), schemas[0]);
}

/** Merge two object schemas: union properties, intersect required. */
export function mergeObjects(
  a: JsonSchema,
  b: JsonSchema,
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): JsonSchema {
  const propsA = a.properties ?? {};
  const propsB = b.properties ?? {};
  const allKeys = Array.from(new Set([...Object.keys(propsA), ...Object.keys(propsB)]));
  const mergedProps: Record<string, JsonSchema> = {};
  for (const k of allKeys) {
    const childPath = path ? `${path}.${k}` : k;
    if (propsA[k] && propsB[k]) {
      mergedProps[k] = mergeTwo(propsA[k], propsB[k], options, acc, childPath);
    } else {
      mergedProps[k] = (propsA[k] ?? propsB[k])!;
    }
  }
  const reqA = a.required ?? [];
  const reqB = b.required ?? [];
  // Intersect required only when both sides have it (single-sample object has
  // required = all keys; multi-sample missing key → optional).
  const reqSet = new Set(reqA.filter((k) => reqB.includes(k)));
  const out: JsonSchema = { type: "object", properties: mergedProps };
  if (options.inferRequired !== false) {
    out.required = Array.from(reqSet);
  }
  out.additionalProperties = a.additionalProperties ?? b.additionalProperties ?? false;
  return out;
}

/** Merge two array schemas by merging their item schemas. */
export function mergeArrays(
  a: JsonSchema,
  b: JsonSchema,
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): JsonSchema {
  const itemsA = a.items;
  const itemsB = b.items;
  let items: JsonSchema = {};
  if (itemsA && itemsB) {
    items = mergeTwo(
      Array.isArray(itemsA) ? mergeSchemas(itemsA, options, acc, path) : itemsA,
      Array.isArray(itemsB) ? mergeSchemas(itemsB, options, acc, path) : itemsB,
      options,
      acc,
      path,
    );
  } else {
    items = (itemsA ?? itemsB ?? {}) as JsonSchema;
  }
  return { type: "array", items };
}

// ---------- Helpers ----------

function typeList(t: JsonType | JsonType[] | undefined): JsonType[] {
  if (t === undefined) return [];
  return Array.isArray(t) ? t : [t];
}

function stripNull(s: JsonSchema): JsonSchema {
  const { type, ...rest } = s;
  if (type === undefined) return rest;
  const arr = typeList(type).filter((t) => t !== "null");
  if (arr.length === 1) rest.type = arr[0];
  else if (arr.length > 1) rest.type = arr;
  return rest;
}

// ---------- Public entry: infer from samples ----------

/**
 * Infer a JSON Schema from one or more samples. Returns the root schema,
 * plus warnings and notes.
 */
export function inferSchema(samples: unknown[], options: InferenceOptions = {}): InferenceResult {
  const opts: InferenceOptions = {
    detectFormats: options.detectFormats !== false,
    inferEnums: options.inferEnums !== false,
    inferRequired: options.inferRequired !== false,
    inferConstraints: options.inferConstraints !== false,
    draft: options.draft ?? "draft-07",
  };
  const acc = { warnings: [] as string[], notes: [] as Array<{ path: string; note: string }> };
  if (samples.length === 0) {
    return { schema: {}, warnings: ["No samples provided."], notes: [] };
  }
  const schemas = samples.map((s, i) => inferSchemaForValue(s, opts, acc, `$root[${i}]`));
  let root = schemas[0];
  if (schemas.length > 1) {
    root = mergeSchemas(schemas, opts, acc, "$root");
  }
  // Wrap with $schema header.
  const wrapped: JsonSchema = {
    $schema: DRAFT_SCHEMA_URIS[opts.draft ?? "draft-07"],
    ...root,
  };
  // Enum inference across scalar leaves is handled inside mergeTwo, but for a
  // single-sample root object we also try to infer enums from array item
  // strings — handled inside the array branch already. Re-run enum inference
  // at the leaves of a single-sample object as a post-pass for short string
  // arrays where each string is distinct.
  if (samples.length === 1) {
    postInferEnums(wrapped, opts, acc, "");
  }
  return { schema: wrapped, warnings: acc.warnings, notes: acc.notes };
}

/**
 * Post-pass: for arrays of strings, if the item schema is just { type: string }
 * and we have the original values, infer an enum. This runs only on the root
 * single-sample case to enrich string arrays.
 */
function postInferEnums(
  schema: JsonSchema,
  options: InferenceOptions,
  acc: { warnings: string[]; notes: Array<{ path: string; note: string }> },
  path: string,
): void {
  if (!schema || typeof schema !== "object") return;
  if (schema.properties) {
    for (const k of Object.keys(schema.properties)) {
      postInferEnums(schema.properties[k], options, acc, path ? `${path}.${k}` : k);
    }
  }
  // No-op: enum inference for single-sample string arrays is intentionally
  // conservative (we don't have enough samples to be confident).
}

// ---------- Serialization ----------

/** Serialize a schema to a pretty JSON string. */
export function serializeSchema(schema: JsonSchema, indent = 2): string {
  return JSON.stringify(schema, null, indent);
}

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Validation (lightweight, schema-shape only) ----------

/**
 * Validate a value against an inferred schema. This is a lightweight validator
 * — it checks types, required fields, enum membership, and basic constraints.
 * It is NOT a full JSON Schema validator (no $ref resolution, no complex
 * composition). Use it as a sanity check on inferred schemas.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = "$",
): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  validateNode(value, schema, path, errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (!schema || typeof schema !== "object") return;
  // anyOf
  if (schema.anyOf) {
    const matched = schema.anyOf.some((s) => {
      const sub = validateAgainstSchema(value, s, path);
      return sub.valid;
    });
    if (!matched) {
      errors.push({ path, message: "Value does not match any anyOf branch." });
    }
    return;
  }
  // type
  if (schema.type) {
    const types = typeList(schema.type);
    const actual = inferType(value);
    // Allow integer where number is expected.
    const ok = types.some((t) => t === actual || (t === "number" && actual === "integer"));
    if (!ok) {
      errors.push({ path, message: `Expected type ${types.join("|")}, got ${actual}.` });
      return;
    }
  }
  // enum
  if (schema.enum !== undefined) {
    if (!schema.enum.some((v) => deepEqual(v, value))) {
      errors.push({ path, message: `Value not in enum [${schema.enum.map(String).join(", ")}].` });
    }
  }
  // const
  if (schema.const !== undefined) {
    if (!deepEqual(schema.const, value)) {
      errors.push({ path, message: "Value does not equal const." });
    }
  }
  // string constraints
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `String shorter than minLength ${schema.minLength}.` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `String longer than maxLength ${schema.maxLength}.` });
    }
    if (schema.pattern) {
      try {
        const re = new RegExp(schema.pattern);
        if (!re.test(value)) {
          errors.push({ path, message: `String does not match pattern ${schema.pattern}.` });
        }
      } catch {
        // invalid pattern — skip
      }
    }
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push({ path, message: "String is not a valid email." });
    }
    if (schema.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      errors.push({ path, message: "String is not a valid UUID." });
    }
  }
  // number constraints
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `Number below minimum ${schema.minimum}.` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `Number above maximum ${schema.maximum}.` });
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `Number not greater than exclusiveMinimum ${schema.exclusiveMinimum}.` });
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({ path, message: `Number not less than exclusiveMaximum ${schema.exclusiveMaximum}.` });
    }
  }
  // array constraints
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `Array shorter than minItems ${schema.minItems}.` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `Array longer than maxItems ${schema.maxItems}.` });
    }
    if (schema.items && !Array.isArray(schema.items)) {
      for (let i = 0; i < value.length; i++) {
        validateNode(value[i], schema.items as JsonSchema, `${path}[${i}]`, errors);
      }
    }
  }
  // object constraints
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (schema.required) {
      for (const r of schema.required) {
        if (!(r in obj)) {
          errors.push({ path, message: `Missing required property '${r}'.` });
        }
      }
    }
    if (schema.properties) {
      for (const k of Object.keys(schema.properties)) {
        if (k in obj) {
          validateNode(obj[k], schema.properties[k], `${path}.${k}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const k of Object.keys(obj)) {
        if (!allowed.has(k)) {
          errors.push({ path, message: `Additional property '${k}' not allowed.` });
        }
      }
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    return ka.length === kb.length && ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// ---------- Markdown documentation ----------

/** Render a schema as a Markdown documentation page. */
export function renderMarkdown(
  schema: JsonSchema,
  meta: { sampleCount: number; warnings: string[] },
): string {
  const lines: string[] = [];
  lines.push("# Inferred JSON Schema");
  lines.push("");
  lines.push(`- **Draft:** ${schema.$schema ?? "(unspecified)"}`);
  lines.push(`- **Samples merged:** ${meta.sampleCount}`);
  lines.push(`- **Root type:** ${schema.type ? (Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type) : "any"}`);
  lines.push("");
  lines.push("## Schema");
  lines.push("");
  lines.push("```json");
  lines.push(serializeSchema(schema, 2));
  lines.push("```");
  if (meta.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const w of meta.warnings) lines.push(`- ${w}`);
  }
  if (schema.type === "object" && schema.properties) {
    lines.push("");
    lines.push("## Field reference");
    lines.push("");
    lines.push("| Field | Type | Format | Required | Description |");
    lines.push("| --- | --- | --- | --- | --- |");
    const req = new Set(schema.required ?? []);
    for (const k of Object.keys(schema.properties)) {
      const p = schema.properties[k];
      const t = p.type ? (Array.isArray(p.type) ? p.type.join("\\|") : p.type) : "any";
      const f = (p.format as string) ?? "";
      const r = req.has(k) ? "✓" : "";
      const d = (p.description as string) ?? "";
      lines.push(`| \`${k}\` | ${t} | ${f} | ${r} | ${d} |`);
    }
  }
  return lines.join("\n");
}

// ---------- Input parsing ----------

/**
 * Parse input text. Accepts JSON or a JS object literal (single-quoted
 * strings, trailing commas, unquoted keys). Returns ok with the parsed
 * value, or an error.
 */
export function parseInput(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "Input is empty." };
  // Try strict JSON first.
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    // fall through
  }
  // Try a relaxed JS object/array literal: convert single quotes to double,
  // quote unquoted keys, strip trailing commas.
  try {
    const relaxed = jsLiteralToJson(trimmed);
    return { ok: true, value: JSON.parse(relaxed) };
  } catch (e) {
    return {
      ok: false,
      error: `Could not parse input as JSON or JS object literal. ${(e as Error).message}`,
    };
  }
}

/** Parse multiple samples separated by blank lines, '---', or ';;'. */
export function parseMultipleInputs(text: string): { ok: true; values: unknown[] } | { ok: false; error: string } {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: true, values: [] };
  const parts = trimmed
    .split(/\n\s*---\s*\n|\n\s*;;\s*\n|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const values: unknown[] = [];
  for (const p of parts) {
    const r = parseInput(p);
    if (!r.ok) return { ok: false, error: `In sample ${values.length + 1}: ${r.error}` };
    values.push(r.value);
  }
  return { ok: true, values };
}

/** Convert a relaxed JS object/array literal to strict JSON. Best-effort. */
export function jsLiteralToJson(src: string): string {
  let s = src;
  // Strip single-line and block comments.
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // Quote unquoted keys: { foo: 1 } → { "foo": 1 }
  s = s.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
  // Convert single-quoted strings to double-quoted.
  s = s.replace(/'((?:[^'\\]|\\.)*)'/g, (_m, inner: string) => `"${inner.replace(/"/g, '\\"')}"`);
  // Strip trailing commas.
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
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

export function buildShareUrl(samples: string, options: InferenceOptions): string {
  const params = new URLSearchParams();
  if (samples) params.set("s", samples);
  if (options.detectFormats === false) params.set("fmt", "0");
  if (options.inferEnums === false) params.set("enum", "0");
  if (options.inferRequired === false) params.set("req", "0");
  if (options.inferConstraints === false) params.set("cstr", "0");
  if (options.draft === "draft-2020-12") params.set("draft", "2020");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { samples: "", options: {} };
  const params = new URLSearchParams(clean);
  const samples = params.get("s") ?? "";
  const options: InferenceOptions = {};
  if (params.get("fmt") === "0") options.detectFormats = false;
  if (params.get("enum") === "0") options.inferEnums = false;
  if (params.get("req") === "0") options.inferRequired = false;
  if (params.get("cstr") === "0") options.inferConstraints = false;
  if (params.get("draft") === "2020") options.draft = "draft-2020-12";
  return { samples, options };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(
  schema: JsonSchema,
  sampleCount: number,
): string {
  return [
    "You are an expert at documenting JSON Schemas. For the schema below, suggest concise human-readable descriptions for each field, plus an overall title for the root object.",
    "",
    `Number of samples merged: ${sampleCount}.`,
    "",
    "Schema:",
    "```json",
    serializeSchema(schema, 2),
    "```",
    "",
    "Output a JSON object with:",
    '- "title": string (short title for the root object, e.g. "User" or "Order")',
    '- "descriptions": array of { "path": string (dotted path from root, e.g. "manufacturer.name"), "description": string (1 sentence, <=120 chars) }',
    '- "suggestions": array of strings (any improvements to the inferred schema — e.g., "field x looks like an enum but only one sample was provided")',
    "",
    "Do not invent fields that are not in the schema. Be honest if a field's meaning is ambiguous.",
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
  const title = typeof o.title === "string" ? o.title : undefined;
  const descriptions = Array.isArray(o.descriptions)
    ? (o.descriptions as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            path: typeof r.path === "string" ? r.path : "",
            description: typeof r.description === "string" ? r.description : "",
          };
        })
        .filter((x) => x.path && x.description)
    : [];
  const suggestions = Array.isArray(o.suggestions)
    ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { title, descriptions, suggestions } };
}
