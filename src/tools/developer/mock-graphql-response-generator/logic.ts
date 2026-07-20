/**
 * Mock GraphQL Response Generator — pure logic.
 *
 * Parses a GraphQL SDL schema (type / interface / union / enum / input /
 * scalar / custom scalar) and a query (query / mutation / subscription with
 * selection sets, fragments, aliases, __typename) and produces a realistic
 * mock JSON response shaped exactly to the query selection set. Type-aware
 * scalar Faker mapping, list sizing, recursion depth cap, per-field overrides,
 * nullable/error injection, MSW + Apollo snippet export.
 *
 * Pure functions only — no DOM, no network, no external deps. The PRNG is a
 * deterministic mulberry32 seeded from a user-provided string so the same
 * seed always produces the same response.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TypeKind = "OBJECT" | "INTERFACE" | "UNION" | "ENUM" | "INPUT" | "SCALAR";

export interface TypeRef {
  kind: "NAMED" | "LIST" | "NON_NULL";
  name?: string;
  ofType?: TypeRef;
}

export interface ArgDef {
  name: string;
  type: TypeRef;
  defaultValue?: string;
}

export interface FieldDef {
  name: string;
  type: TypeRef;
  args?: ArgDef[];
  description?: string;
}

export interface SdlType {
  kind: TypeKind;
  name: string;
  description?: string;
  fields?: FieldDef[];
  enumValues?: string[];
  possibleTypes?: string[];
  interfaces?: string[];
}

export interface SdlSchema {
  types: Record<string, SdlType>;
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
}

export type OperationKind = "query" | "mutation" | "subscription";

export interface Selection {
  kind: "FIELD" | "INLINE_FRAGMENT" | "FRAGMENT_SPREAD";
  alias?: string;
  name?: string;
  args?: Record<string, string>;
  selectionSet?: Selection[];
  typeCondition?: string;
  fragmentName?: string;
}

export interface FragmentDef {
  name: string;
  typeCondition: string;
  selectionSet: Selection[];
}

export interface Operation {
  operation: OperationKind;
  name?: string;
  selectionSet: Selection[];
  fragments: Record<string, FragmentDef>;
  variables?: Array<{ name: string; type: TypeRef; defaultValue?: string }>;
  raw: string;
}

export interface MockOptions {
  listSize: number;
  depthLimit: number;
  seed: string;
  nullableRate: number; // 0-1, fraction of nullable fields to null
  errorRate: number; // 0-1, chance of inserting a top-level error
  overrides: Record<string, string>; // field-path → literal or Faker template
  operationName?: string; // which operation to mock (auto-detect if omitted)
}

export interface MockResult {
  ok: boolean;
  data?: unknown;
  errors?: Array<{ message: string; path?: string[] }>;
  warnings: string[];
  operationKind: OperationKind;
  operationName?: string;
}

export type ExportFormat = "json" | "graphql-response" | "msw" | "apollo";

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (deterministic, seedable)
// ---------------------------------------------------------------------------

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  bool(prob?: number): boolean;
}

export function hashSeed(s: string): number {
  const str = s || "default-seed";
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  if (h === 0) h = 0xdeadbeef;
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function int(min: number, max: number): number {
    if (max < min) { const t = min; min = max; max = t; }
    return Math.floor(next() * (max - min + 1)) + min;
  }
  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick from empty array");
    return arr[int(0, arr.length - 1)];
  }
  function bool(prob = 0.5): boolean { return next() < prob; }
  return { next, int, pick, bool };
}

export function buildRng(seed?: string): Rng {
  if (seed && seed.trim().length > 0) return mulberry32(hashSeed(seed));
  return mulberry32((Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
}

// ---------------------------------------------------------------------------
// Word banks for mock data
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph",
  "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy",
  "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Seattle",
];

const COMPANIES = [
  "Acme Corp", "Globex Inc", "Initech", "Umbrella Corp", "Stark Industries",
  "Wayne Enterprises", "Cyberdyne Systems", "Tyrell Corp", "Hooli", "Pied Piper",
];

const WORDS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi",
  "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
];

const SUBJECTS = ["system", "process", "service", "module", "component", "feature", "request", "operation"];
const VERBS = ["completed", "started", "failed", "succeeded", "skipped", "queued", "processed", "registered"];

// ---------------------------------------------------------------------------
// Faker-style value generators (named per scalar)
// ---------------------------------------------------------------------------

export type FakerFn = (rng: Rng) => unknown;

export const SCALAR_GENERATORS: Record<string, FakerFn> = {
  String: (rng) => rng.pick(WORDS) + " " + rng.pick(WORDS),
  Int: (rng) => rng.int(0, 1000000),
  Float: (rng) => Math.round(rng.next() * 1000000 * 100) / 100,
  Boolean: (rng) => rng.bool(0.5),
  ID: (rng) => genUuid(rng),
  // Custom scalars (common conventions)
  Date: (rng) => genDate(rng, "plain"),
  DateTime: (rng) => genDate(rng, "iso"),
  Email: (rng) => genEmail(rng),
  email: (rng) => genEmail(rng),
  URL: (rng) => genUrl(rng),
  url: (rng) => genUrl(rng),
  Uri: (rng) => genUrl(rng),
  UUID: (rng) => genUuid(rng),
  Uuid: (rng) => genUuid(rng),
  GUID: (rng) => genUuid(rng),
  JSON: (rng) => ({ key: rng.pick(WORDS), value: rng.int(0, 100) }),
  Json: (rng) => ({ key: rng.pick(WORDS), value: rng.int(0, 100) }),
  BigInt: (rng) => String(rng.int(0, 1e9)),
  Decimal: (rng) => (rng.next() * 10000).toFixed(2),
  Long: (rng) => String(rng.int(0, 1e9)),
  Short: (rng) => rng.int(0, 32767),
  Byte: (rng) => rng.int(0, 255),
  Char: (rng) => String.fromCharCode(rng.int(97, 122)),
  Time: (rng) => `${String(rng.int(0, 23)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}`,
  Phone: (rng) => `+1${rng.int(200, 989)}${rng.int(200, 989)}${rng.int(1000, 9999)}`,
  PostalCode: (rng) => String(rng.int(10000, 99999)),
  Color: (rng) => "#" + rng.int(0, 0xffffff).toString(16).padStart(6, "0"),
  IPv4: (rng) => `${rng.int(1, 223)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
  IPv6: (rng) => Array.from({ length: 8 }, () => rng.int(0, 0xffff).toString(16)).join(":"),
};

export function genUuid(rng: Rng): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += "-";
    if (i === 12) s += "4";
    else if (i === 16) s += hex[rng.int(0, 3)];
    else s += hex[rng.int(0, 15)];
  }
  return s;
}

export function genEmail(rng: Rng): string {
  const first = rng.pick(FIRST_NAMES).toLowerCase();
  const last = rng.pick(LAST_NAMES).toLowerCase();
  const variant = rng.int(0, 3);
  const local = variant === 0 ? `${first}.${last}` :
                variant === 1 ? `${first}${rng.int(1, 99)}` :
                variant === 2 ? `${first[0]}${last}` :
                `${first}_${last}`;
  return `${local}@example.com`;
}

export function genUrl(rng: Rng): string {
  const paths = ["", "/about", "/api/v1", "/users", "/posts", "/search"];
  return `https://example.com${rng.pick(paths)}`;
}

export function genDate(rng: Rng, mode: "plain" | "iso"): string {
  const now = Date.now();
  const day = 86400000;
  const ts = now - rng.int(0, 3650) * day;
  const d = new Date(ts);
  if (mode === "iso") return d.toISOString();
  return d.toISOString().slice(0, 10);
}

/** Faker-style template resolver — e.g. "Hello {{name.firstName}}!" */
export function resolveFakerTemplate(rng: Rng, template: string): unknown {
  // Provide a small subset of faker-compatible tokens
  const replacements: Record<string, () => unknown> = {
    "name.firstName": () => rng.pick(FIRST_NAMES),
    "name.lastName": () => rng.pick(LAST_NAMES),
    "name.fullName": () => `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    "name.findName": () => `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    "internet.email": () => genEmail(rng),
    "internet.url": () => genUrl(rng),
    "internet.userName": () => rng.pick(FIRST_NAMES).toLowerCase() + rng.int(1, 99),
    "datatype.uuid": () => genUuid(rng),
    "datatype.boolean": () => rng.bool(0.5),
    "datatype.number": () => rng.int(0, 1000),
    "datatype.float": () => rng.next() * 1000,
    "datatype.string": () => rng.pick(WORDS),
    "random.uuid": () => genUuid(rng),
    "random.word": () => rng.pick(WORDS),
    "random.number": () => rng.int(0, 1000),
    "address.city": () => rng.pick(CITIES),
    "address.zipCode": () => String(rng.int(10000, 99999)),
    "company.companyName": () => rng.pick(COMPANIES),
    "company.bs": () => `${rng.pick(VERBS)} ${rng.pick(SUBJECTS)}`,
    "date.recent": () => genDate(rng, "iso"),
    "date.past": () => genDate(rng, "iso"),
    "lorem.word": () => rng.pick(WORDS),
    "lorem.words": () => Array.from({ length: rng.int(2, 5) }, () => rng.pick(WORDS)).join(" "),
    "lorem.sentence": () => {
      const n = rng.int(4, 10);
      return Array.from({ length: n }, () => rng.pick(WORDS)).join(" ") + ".";
    },
  };
  let result = template;
  let touched = false;
  result = result.replace(/\{\{([^}]+)\}\}/g, (_m, key: string) => {
    const k = key.trim();
    if (replacements[k]) {
      touched = true;
      return String(replacements[k]());
    }
    return _m;
  });
  // If template is exactly one token like "{{internet.email}}", return the raw value
  if (touched && /^\{\{[^}]+\}\}$/.test(template.trim())) {
    const k = template.trim().slice(2, -2).trim();
    if (replacements[k]) return replacements[k]();
  }
  // Try to parse as JSON if it looks like JSON
  if (result.startsWith("{") || result.startsWith("[")) {
    try { return JSON.parse(result); } catch { /* fall through */ }
  }
  return result;
}

// ---------------------------------------------------------------------------
// SDL tokenizer + parser (regex-based, deliberately simple)
// ---------------------------------------------------------------------------

export interface ParseError {
  ok: false;
  errors: string[];
}

export interface ParseOk {
  ok: true;
  schema: SdlSchema;
  warnings: string[];
}

export type ParseResult = ParseError | ParseOk;

/** Tokenize SDL into braces, identifiers, strings, numbers, and punctuation. */
export function tokenizeSdl(input: string): string[] {
  // Strip block comments
  const noComments = input.replace(/"""[\s\S]*?"""/g, "").replace(/#[^\n]*/g, "");
  // Match tokens: identifiers (incl. @directive), strings, numbers (incl. negative/decimal),
  // braces, brackets, !, =, |, :, ,, (), etc.
  const re = /"[^"]*"|'(?:[^'\\]|\\.)*'|@[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*|-?\d+(?:\.\d+)?|[{}()\[\]!:|,=]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments)) !== null) {
    out.push(m[0]);
  }
  return out;
}

/** Parse a type reference (possibly wrapped in [ ] ! modifiers). */
export function parseTypeRef(tokens: string[], pos: number): { type: TypeRef; next: number } {
  // Skip whitespace-equivalent tokens (tokenizer already excludes whitespace)
  let i = pos;
  if (tokens[i] === "[") {
    const inner = parseTypeRef(tokens, i + 1);
    i = inner.next;
    if (tokens[i] !== "]") throw new Error(`Expected ] at token ${i}, got ${tokens[i] ?? "<end>"}`);
    i++;
    let type: TypeRef = { kind: "LIST", ofType: inner.type };
    if (tokens[i] === "!") { type = { kind: "NON_NULL", ofType: type }; i++; }
    return { type, next: i };
  }
  // NAMED
  const name = tokens[i];
  if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Expected type name at token ${i}, got ${name ?? "<end>"}`);
  }
  i++;
  let type: TypeRef = { kind: "NAMED", name };
  if (tokens[i] === "!") { type = { kind: "NON_NULL", ofType: type }; i++; }
  return { type, next: i };
}

/** Parse SDL tokens into a schema. */
export function parseSdlTokens(tokens: string[]): ParseResult {
  const types: Record<string, SdlType> = {};
  const warnings: string[] = [];
  let queryType: string | undefined;
  let mutationType: string | undefined;
  let subscriptionType: string | undefined;

  let i = 0;
  function skipDirectives(): void {
    while (i < tokens.length && tokens[i].startsWith("@")) i++;
  }
  while (i < tokens.length) {
    const kw = tokens[i];
    if (kw === "schema") {
      i++;
      if (tokens[i] !== "{") throw new Error("schema block missing {");
      i++;
      while (tokens[i] !== "}") {
        const op = tokens[i]; // query / mutation / subscription
        const colon = tokens[i + 1];
        const tname = tokens[i + 2];
        if (colon !== ":") throw new Error(`schema: expected : after ${op}`);
        if (op === "query") queryType = tname;
        else if (op === "mutation") mutationType = tname;
        else if (op === "subscription") subscriptionType = tname;
        i += 3;
      }
      i++; // skip }
      continue;
    }
    if (kw === "type" || kw === "interface" || kw === "input") {
      const kind: TypeKind = kw === "type" ? "OBJECT" : kw === "interface" ? "INTERFACE" : "INPUT";
      i++;
      const name = tokens[i];
      if (!name) throw new Error(`Expected type name after ${kw}`);
      i++;
      const interfaces: string[] = [];
      // implements & ... (object types)
      if (tokens[i] === "implements") {
        i++;
        while (tokens[i] && tokens[i] !== "{") {
          if (tokens[i] === "&") { i++; continue; }
          if (tokens[i] === ",") { i++; continue; }
          interfaces.push(tokens[i]);
          i++;
        }
      }
      skipDirectives();
      if (tokens[i] !== "{") throw new Error(`Expected { after type ${name}, got ${tokens[i] ?? "<end>"}`);
      i++;
      const fields: FieldDef[] = [];
      while (tokens[i] !== "}") {
        if (!tokens[i]) throw new Error(`Unexpected end of tokens inside type ${name}`);
        // Skip standalone directives (e.g. @deprecated)
        if (tokens[i].startsWith("@")) { i++; skipDirectives(); continue; }
        const fname = tokens[i];
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fname)) {
          throw new Error(`Invalid field name "${fname}" in type ${name}`);
        }
        i++;
        // Optional args: ( name: Type, ... )
        const args: ArgDef[] = [];
        if (tokens[i] === "(") {
          i++;
          while (tokens[i] !== ")") {
            const aname = tokens[i];
            if (tokens[i + 1] !== ":") throw new Error(`Expected : after arg ${aname}`);
            const argType = parseTypeRef(tokens, i + 2);
            i = argType.next;
            let defaultValue: string | undefined;
            if (tokens[i] === "=") {
              i++;
              defaultValue = tokens[i];
              i++;
            }
            args.push({ name: aname, type: argType.type, defaultValue });
            if (tokens[i] === ",") i++;
            skipDirectives();
          }
          i++; // skip )
        }
        if (tokens[i] !== ":") throw new Error(`Expected : after field ${fname} in ${name}, got ${tokens[i] ?? "<end>"}`);
        i++;
        const ftype = parseTypeRef(tokens, i);
        i = ftype.next;
        skipDirectives();
        // Optional default value: = value
        let fieldDefault: string | undefined;
        if (tokens[i] === "=") {
          i++;
          fieldDefault = tokens[i];
          i++;
          skipDirectives();
        }
        const fieldDef: FieldDef = { name: fname, type: ftype.type, args };
        if (fieldDefault !== undefined) {
          (fieldDef as FieldDef & { defaultValue?: string }).defaultValue = fieldDefault;
        }
        fields.push(fieldDef);
        if (tokens[i] === ",") i++;
      }
      i++; // skip }
      types[name] = { kind, name, fields, interfaces };
      continue;
    }
    if (kw === "union") {
      i++;
      const name = tokens[i];
      i++;
      skipDirectives();
      if (tokens[i] !== "=") throw new Error(`Expected = after union ${name}`);
      i++;
      const possible: string[] = [];
      while (i < tokens.length && tokens[i] !== "type" && tokens[i] !== "union" && tokens[i] !== "enum" && tokens[i] !== "input" && tokens[i] !== "interface" && tokens[i] !== "scalar" && tokens[i] !== "schema") {
        if (tokens[i] === "|") { i++; continue; }
        possible.push(tokens[i]);
        i++;
      }
      types[name] = { kind: "UNION", name, possibleTypes: possible };
      continue;
    }
    if (kw === "enum") {
      i++;
      const name = tokens[i];
      i++;
      skipDirectives();
      if (tokens[i] !== "{") throw new Error(`Expected { after enum ${name}`);
      i++;
      const values: string[] = [];
      while (tokens[i] !== "}") {
        if (tokens[i].startsWith("@")) { i++; skipDirectives(); continue; }
        values.push(tokens[i]);
        i++;
        skipDirectives();
      }
      i++; // skip }
      types[name] = { kind: "ENUM", name, enumValues: values };
      continue;
    }
    if (kw === "scalar") {
      i++;
      const name = tokens[i];
      i++;
      skipDirectives();
      types[name] = { kind: "SCALAR", name };
      continue;
    }
    if (kw === "extend") {
      // skip "extend type X { ... }" — merge into existing type if present
      i++;
      continue;
    }
    // Unknown keyword — skip to next brace block to recover
    warnings.push(`Unknown SDL token "${kw}" at position ${i}; skipping.`);
    i++;
  }
  // Resolve interfaces' possibleTypes from object types that implement them
  for (const tname of Object.keys(types)) {
    const t = types[tname];
    if (t.kind === "INTERFACE") {
      const impls: string[] = [];
      for (const oname of Object.keys(types)) {
        const ot = types[oname];
        if (ot.kind === "OBJECT" && ot.interfaces && ot.interfaces.includes(tname)) {
          impls.push(oname);
        }
      }
      t.possibleTypes = impls;
    }
  }
  if (!queryType) {
    // Auto-detect Query type
    if (types["Query"]) queryType = "Query";
  }
  if (!mutationType && types["Mutation"]) mutationType = "Mutation";
  if (!subscriptionType && types["Subscription"]) subscriptionType = "Subscription";
  return { ok: true, schema: { types, queryType, mutationType, subscriptionType }, warnings };
}

export function parseSdl(input: string): ParseResult {
  if (!input || !input.trim()) {
    return { ok: false, errors: ["SDL input is empty."] };
  }
  try {
    const tokens = tokenizeSdl(input);
    if (tokens.length === 0) {
      return { ok: false, errors: ["SDL input contains no tokens."] };
    }
    return parseSdlTokens(tokens);
  } catch (e) {
    return { ok: false, errors: [`SDL parse error: ${(e as Error).message}`] };
  }
}

// ---------------------------------------------------------------------------
// Type reference helpers
// ---------------------------------------------------------------------------

export function unwrapNamed(type: TypeRef): string {
  let t: TypeRef = type;
  while (t.kind !== "NAMED" && t.ofType) t = t.ofType;
  return t.name ?? "";
}

export function isNonNull(type: TypeRef): boolean {
  return type.kind === "NON_NULL";
}

export function isList(type: TypeRef): boolean {
  let t: TypeRef = type;
  while (t.kind === "NON_NULL" && t.ofType) t = t.ofType;
  return t.kind === "LIST";
}

export function innerType(type: TypeRef): TypeRef | undefined {
  let t: TypeRef = type;
  while (t.kind === "NON_NULL" && t.ofType) t = t.ofType;
  if (t.kind === "LIST" && t.ofType) return t.ofType;
  return undefined;
}

// ---------------------------------------------------------------------------
// Query parser
// ---------------------------------------------------------------------------

export interface QueryParseError {
  ok: false;
  errors: string[];
}

export interface QueryParseOk {
  ok: true;
  operations: Operation[];
  warnings: string[];
}

export type QueryParseResult = QueryParseError | QueryParseOk;

function tokenizeQuery(input: string): string[] {
  // Strip comments
  const noComments = input.replace(/#[^\n]*/g, "");
  // `...` must come before single `.` so the spread operator is one token
  const re = /"[^"]*"|'(?:[^'\\]|\\.)*'|\$[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*|-?\d+(?:\.\d+)?|\.\.\.|[{}()\[\]!:|,=.@]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments)) !== null) {
    out.push(m[0]);
  }
  return out;
}

export function parseQuery(input: string): QueryParseResult {
  if (!input || !input.trim()) {
    return { ok: false, errors: ["Query input is empty."] };
  }
  try {
    const tokens = tokenizeQuery(input);
    const operations: Operation[] = [];
    const allFragments: Record<string, FragmentDef> = {};
    const warnings: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok === "query" || tok === "mutation" || tok === "subscription") {
        const op: OperationKind = tok as OperationKind;
        i++;
        let name: string | undefined;
        if (tokens[i] && /^[A-Za-z_]/.test(tokens[i]) && tokens[i] !== "{" && tokens[i] !== "(") {
          name = tokens[i];
          i++;
        }
        const variables: Array<{ name: string; type: TypeRef; defaultValue?: string }> = [];
        if (tokens[i] === "(") {
          i++;
          while (tokens[i] !== ")") {
            // Variable token: $name (captured as one token by the tokenizer)
            const vtok = tokens[i];
            if (vtok && vtok.startsWith("$")) {
              const vname = vtok.slice(1);
              i++;
              if (tokens[i] !== ":") throw new Error(`Expected : after $${vname}`);
              i++;
              const vtype = parseTypeRef(tokens, i);
              i = vtype.next;
              let defaultValue: string | undefined;
              if (tokens[i] === "=") {
                i++;
                defaultValue = tokens[i];
                i++;
              }
              variables.push({ name: vname, type: vtype.type, defaultValue });
            } else if (vtok === ",") {
              i++;
            } else {
              // Skip unknown tokens to avoid infinite loop
              i++;
            }
          }
          i++; // skip )
        }
        if (tokens[i] !== "{") throw new Error(`Expected { for ${op} ${name ?? ""}, got ${tokens[i] ?? "<end>"}`);
        const sel = parseSelectionSet(tokens, i);
        i = sel.next;
        operations.push({
          operation: op,
          name,
          selectionSet: sel.selections,
          fragments: {},
          variables,
          raw: input,
        });
      } else if (tok === "{") {
        // Anonymous query
        const sel = parseSelectionSet(tokens, i);
        i = sel.next;
        operations.push({
          operation: "query",
          selectionSet: sel.selections,
          fragments: {},
          raw: input,
        });
      } else if (tok === "fragment") {
        i++;
        const fname = tokens[i];
        i++;
        if (tokens[i] !== "on") throw new Error(`Expected "on" after fragment ${fname}`);
        i++;
        const typeCond = tokens[i];
        i++;
        if (tokens[i] !== "{") throw new Error(`Expected { for fragment ${fname}`);
        const sel = parseSelectionSet(tokens, i);
        i = sel.next;
        allFragments[fname] = { name: fname, typeCondition: typeCond, selectionSet: sel.selections };
      } else {
        warnings.push(`Unknown query token "${tok}" at position ${i}; skipping.`);
        i++;
      }
    }
    // Attach all named fragments to each operation
    for (const op of operations) {
      op.fragments = { ...allFragments };
    }
    return { ok: true, operations, warnings };
  } catch (e) {
    return { ok: false, errors: [`Query parse error: ${(e as Error).message}`] };
  }
}

function parseSelectionSet(tokens: string[], pos: number): { selections: Selection[]; next: number } {
  let i = pos;
  if (tokens[i] !== "{") throw new Error(`Expected { at token ${i}`);
  i++;
  const selections: Selection[] = [];
  while (tokens[i] !== "}") {
    if (!tokens[i]) throw new Error("Unexpected end of tokens in selection set");
    const sel = parseSelection(tokens, i);
    i = sel.next;
    selections.push(sel.selection);
  }
  i++; // skip }
  return { selections, next: i };
}

function parseSelection(tokens: string[], pos: number): { selection: Selection; next: number } {
  let i = pos;
  // Inline fragment: ... on Type { ... } or ... FragmentName
  if (tokens[i] === "...") {
    i++;
    if (tokens[i] === "on") {
      i++;
      const typeCond = tokens[i];
      i++;
      // Optional directives skipped
      while (tokens[i] && tokens[i].startsWith("@")) i++;
      if (tokens[i] !== "{") throw new Error(`Expected { after ... on ${typeCond}`);
      const sel = parseSelectionSet(tokens, i);
      i = sel.next;
      return {
        selection: { kind: "INLINE_FRAGMENT", typeCondition: typeCond, selectionSet: sel.selections },
        next: i,
      };
    }
    // Fragment spread
    const fname = tokens[i];
    i++;
    while (tokens[i] && tokens[i].startsWith("@")) i++;
    return {
      selection: { kind: "FRAGMENT_SPREAD", fragmentName: fname },
      next: i,
    };
  }
  // Field: alias: name | name
  let alias: string | undefined;
  let name: string | undefined;
  const first = tokens[i];
  i++;
  if (tokens[i] === ":") {
    alias = first;
    i++;
    name = tokens[i];
    i++;
  } else {
    name = first;
  }
  // Args: ( name: value, ... )
  const args: Record<string, string> = {};
  if (tokens[i] === "(") {
    i++;
    while (tokens[i] !== ")") {
      if (!tokens[i]) throw new Error("Unexpected end of tokens in argument list");
      const aname = tokens[i];
      i++;
      if (tokens[i] !== ":") throw new Error(`Expected : after arg ${aname}`);
      i++;
      const value = tokens[i];
      i++;
      args[aname] = value;
      if (tokens[i] === ",") i++;
    }
    i++; // skip )
  }
  // Skip directives
  while (tokens[i] && tokens[i].startsWith("@")) i++;
  // Optional selection set
  let selectionSet: Selection[] | undefined;
  if (tokens[i] === "{") {
    const sel = parseSelectionSet(tokens, i);
    i = sel.next;
    selectionSet = sel.selections;
  }
  return {
    selection: { kind: "FIELD", alias, name, args, selectionSet },
    next: i,
  };
}

// ---------------------------------------------------------------------------
// Mock value generation
// ---------------------------------------------------------------------------

export interface MockContext {
  schema: SdlSchema;
  rng: Rng;
  options: MockOptions;
  path: string[];
  depth: number;
  seenStack: string[]; // for cycle detection
  fragments: Record<string, FragmentDef>;
}

export function generateMock(schema: SdlSchema, operations: Operation[], options: MockOptions): MockResult {
  const warnings: string[] = [];
  if (operations.length === 0) {
    return { ok: false, warnings: ["No operations found in query."], operationKind: "query" };
  }
  let op = operations[0];
  if (options.operationName) {
    const found = operations.find((o) => o.name === options.operationName);
    if (!found) {
      return {
        ok: false,
        warnings: [`Operation "${options.operationName}" not found. Available: ${operations.map((o) => o.name ?? "<anonymous>").join(", ")}`],
        operationKind: "query",
      };
    }
    op = found;
  }
  const rootTypeName =
    op.operation === "query" ? schema.queryType :
    op.operation === "mutation" ? schema.mutationType :
    schema.subscriptionType;
  if (!rootTypeName) {
    return {
      ok: false,
      warnings: [`No ${op.operation} type found in schema.`],
      operationKind: op.operation,
      operationName: op.name,
    };
  }
  const rootType = schema.types[rootTypeName];
  if (!rootType) {
    return {
      ok: false,
      warnings: [`Root type "${rootTypeName}" not defined in schema.`],
      operationKind: op.operation,
      operationName: op.name,
    };
  }
  const ctx: MockContext = {
    schema,
    rng: buildRng(options.seed),
    options,
    path: [],
    depth: 0,
    seenStack: [],
    fragments: op.fragments ?? {},
  };
  const data: Record<string, unknown> = {};
  const merged = mergeFragments(ctx, op.selectionSet, rootType.name, warnings);
  for (const sel of merged) {
    const result = mockSelection(ctx, rootType, sel);
    if (result.value !== undefined) {
      const key = sel.alias ?? sel.name ?? "";
      if (key) data[key] = result.value;
    }
    warnings.push(...result.warnings);
  }
  // Error injection
  const errors: Array<{ message: string; path?: string[] }> = [];
  if (options.errorRate > 0 && ctx.rng.bool(options.errorRate)) {
    errors.push({
      message: `Mock injected error for ${op.operation} ${op.name ?? ""}`.trim(),
      path: [Object.keys(data)[0] ?? "root"],
    });
    // With errors, sometimes null out the data
    if (ctx.rng.bool(0.5)) {
      return { ok: false, data: null, errors, warnings, operationKind: op.operation, operationName: op.name };
    }
  }
  return { ok: errors.length === 0, data, errors: errors.length > 0 ? errors : undefined, warnings, operationKind: op.operation, operationName: op.name };
}

/** Alias for backward compatibility — same as generateMock. */
export const generateMockWithFragments = generateMock;

interface MockFieldResult {
  value: unknown;
  warnings: string[];
}

function mockSelection(ctx: MockContext, parentType: SdlType, sel: Selection): MockFieldResult {
  const warnings: string[] = [];
  if (sel.kind === "FRAGMENT_SPREAD") {
    return { value: undefined, warnings: ["FRAGMENT_SPREAD should be resolved by mergeFragments"] };
  }
  if (sel.kind === "INLINE_FRAGMENT") {
    return { value: undefined, warnings: ["INLINE_FRAGMENT should be resolved by mergeFragments"] };
  }
  // FIELD
  const fieldName = sel.name ?? "";
  const key = sel.alias ?? fieldName;
  if (fieldName === "__typename") {
    return { value: parentType.name, warnings };
  }
  const field = parentType.fields?.find((f) => f.name === fieldName);
  if (!field) {
    warnings.push(`Field "${fieldName}" not found on type "${parentType.name}".`);
    return { value: null, warnings };
  }
  // Check overrides
  const overrideKey = [...ctx.path, key].join(".");
  if (ctx.options.overrides[overrideKey] !== undefined) {
    const ov = ctx.options.overrides[overrideKey];
    const val = resolveFakerTemplate(ctx.rng, ov);
    return { value: val, warnings };
  }
  const childPath = [...ctx.path, key];
  // Nullable check
  if (!isNonNull(field.type) && ctx.options.nullableRate > 0 && ctx.rng.bool(ctx.options.nullableRate)) {
    return { value: null, warnings };
  }
  const value = mockTypeRef(ctx, field.type, sel.selectionSet ?? [], childPath, warnings);
  return { value, warnings };
}

function mockTypeRef(ctx: MockContext, typeRef: TypeRef, selectionSet: Selection[], path: string[], warnings: string[]): unknown {
  if (typeRef.kind === "NON_NULL") {
    return mockTypeRef(ctx, typeRef.ofType!, selectionSet, path, warnings);
  }
  if (typeRef.kind === "LIST") {
    // Generate N items
    const size = ctx.options.listSize;
    const out: unknown[] = [];
    for (let i = 0; i < size; i++) {
      out.push(mockTypeRef(ctx, typeRef.ofType!, selectionSet, path, warnings));
    }
    return out;
  }
  // NAMED
  const typeName = typeRef.name!;
  const sdlType = ctx.schema.types[typeName];
  // Built-in scalars
  if (typeName === "String" || typeName === "Int" || typeName === "Float" ||
      typeName === "Boolean" || typeName === "ID") {
    const gen = SCALAR_GENERATORS[typeName];
    return gen ? gen(ctx.rng) : null;
  }
  // Custom scalar
  if (!sdlType) {
    // Unknown type — try to map to a Faker generator by name
    if (SCALAR_GENERATORS[typeName]) return SCALAR_GENERATORS[typeName](ctx.rng);
    warnings.push(`Unknown type "${typeName}" — emitting null.`);
    return null;
  }
  if (sdlType.kind === "SCALAR") {
    if (SCALAR_GENERATORS[typeName]) return SCALAR_GENERATORS[typeName](ctx.rng);
    return ctx.rng.pick(WORDS);
  }
  if (sdlType.kind === "ENUM") {
    if (!sdlType.enumValues || sdlType.enumValues.length === 0) return null;
    return ctx.rng.pick(sdlType.enumValues);
  }
  if (sdlType.kind === "UNION" || sdlType.kind === "INTERFACE") {
    const possible = sdlType.possibleTypes ?? [];
    if (possible.length === 0) {
      warnings.push(`No possible types for ${sdlType.kind} "${typeName}".`);
      return null;
    }
    // Cycle detection: if this type is already on the seenStack, return null
    if (ctx.seenStack.includes(typeName) || ctx.depth >= ctx.options.depthLimit) {
      return null;
    }
    const pickedName = ctx.rng.pick(possible);
    const pickedType = ctx.schema.types[pickedName];
    if (!pickedType) {
      warnings.push(`Possible type "${pickedName}" not defined in schema.`);
      return null;
    }
    const childCtx: MockContext = {
      ...ctx,
      path,
      depth: ctx.depth + 1,
      seenStack: [...ctx.seenStack, typeName],
    };
    return mockObject(childCtx, pickedType, selectionSet, warnings);
  }
  // OBJECT or INPUT
  // Cycle detection for self-referential types like User.friends: [User!]!
  if (ctx.seenStack.includes(typeName) || ctx.depth >= ctx.options.depthLimit) {
    return null;
  }
  const childCtx: MockContext = {
    ...ctx,
    path,
    depth: ctx.depth + 1,
    seenStack: [...ctx.seenStack, typeName],
  };
  return mockObject(childCtx, sdlType, selectionSet, warnings);
}

function mockObject(ctx: MockContext, type: SdlType, selectionSet: Selection[], warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const merged = mergeFragments(ctx, selectionSet, type.name, warnings);
  for (const sel of merged) {
    if (sel.kind === "FIELD") {
      if (sel.name === "__typename") {
        out[sel.alias ?? "__typename"] = type.name;
        continue;
      }
      const field = type.fields?.find((f) => f.name === sel.name);
      if (!field) {
        warnings.push(`Field "${sel.name}" not found on type "${type.name}".`);
        out[sel.alias ?? sel.name ?? ""] = null;
        continue;
      }
      const key = sel.alias ?? sel.name ?? "";
      const childPath = [...ctx.path, key];
      // Check overrides first
      if (ctx.options.overrides[childPath.join(".")] !== undefined) {
        const ov = ctx.options.overrides[childPath.join(".")];
        out[key] = resolveFakerTemplate(ctx.rng, ov);
        continue;
      }
      // Nullable check
      if (!isNonNull(field.type) && ctx.options.nullableRate > 0 && ctx.rng.bool(ctx.options.nullableRate)) {
        out[key] = null;
        continue;
      }
      const value = mockTypeRef(ctx, field.type, sel.selectionSet ?? [], childPath, warnings);
      out[key] = value;
    } else if (sel.kind === "INLINE_FRAGMENT") {
      // Apply only if type matches (or no condition)
      if (!sel.typeCondition || sel.typeCondition === type.name || isTypeOf(ctx.schema, type.name, sel.typeCondition)) {
        const sub = mergeFragments(ctx, sel.selectionSet ?? [], type.name, warnings);
        for (const subSel of sub) {
          if (subSel.kind === "FIELD") {
            const key = subSel.alias ?? subSel.name ?? "";
            // __typename is a meta-field that always resolves to the runtime type name
            if (subSel.name === "__typename") {
              out[key] = type.name;
              continue;
            }
            const field = type.fields?.find((f) => f.name === subSel.name);
            if (field) {
              const childPath = [...ctx.path, key];
              if (ctx.options.overrides[childPath.join(".")] !== undefined) {
                out[key] = resolveFakerTemplate(ctx.rng, ctx.options.overrides[childPath.join(".")]);
                continue;
              }
              if (!isNonNull(field.type) && ctx.options.nullableRate > 0 && ctx.rng.bool(ctx.options.nullableRate)) {
                out[key] = null;
                continue;
              }
              out[key] = mockTypeRef(ctx, field.type, subSel.selectionSet ?? [], childPath, warnings);
            } else {
              warnings.push(`Field "${subSel.name}" not found on type "${type.name}" (inline fragment).`);
              out[key] = null;
            }
          }
        }
      }
    }
  }
  return out;
}

function mergeFragments(ctx: MockContext, selectionSet: Selection[], typeName: string, warnings: string[]): Selection[] {
  const out: Selection[] = [];
  for (const sel of selectionSet) {
    if (sel.kind === "FRAGMENT_SPREAD") {
      const frag = ctx.fragments[sel.fragmentName!];
      if (frag) {
        if (frag.typeCondition === typeName || isTypeOf(ctx.schema, typeName, frag.typeCondition)) {
          out.push(...mergeFragments(ctx, frag.selectionSet, typeName, warnings));
        }
      } else {
        warnings.push(`Fragment "${sel.fragmentName}" not found.`);
      }
    } else {
      out.push(sel);
    }
  }
  return out;
}

function isTypeOf(schema: SdlSchema, typeName: string, condition: string): boolean {
  if (typeName === condition) return true;
  const t = schema.types[typeName];
  if (!t) return false;
  if (t.interfaces && t.interfaces.includes(condition)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render the mock result as a JSON response. */
export function renderJson(result: MockResult): string {
  return JSON.stringify(result.data ?? null, null, 2);
}

/** Render the mock result as a GraphQL response envelope ({ data, errors }). */
export function renderGraphqlResponse(result: MockResult): string {
  const env: { data: unknown; errors?: unknown } = { data: result.data ?? null };
  if (result.errors && result.errors.length > 0) env.errors = result.errors;
  return JSON.stringify(env, null, 2);
}

/** Render the mock result as an MSW (Mock Service Worker) handler snippet. */
export function renderMsw(result: MockResult): string {
  const opName = result.operationName ?? "MyOperation";
  const opKind = result.operationKind;
  const response = renderGraphqlResponse(result);
  // MSW v2 GraphQL handler syntax
  return `import { graphql, HttpResponse } from "msw";

export const handlers = [
  graphql.${opKind}("${opName}", () => {
    return HttpResponse.json(${response});
  }),
];`;
}

/** Render the mock result as an Apollo mock resolver snippet. */
export function renderApollo(result: MockResult): string {
  const opName = result.operationName ?? "MyOperation";
  const opKind = result.operationKind;
  // For Apollo, we produce a MockList-style resolver
  const data = JSON.stringify(result.data ?? null, null, 2);
  return `import { MockedProvider } from "@apollo/client/testing";
import { ${opKind === "query" ? "GET_" : opKind === "mutation" ? "MUTATE_" : "SUBSCRIBE_"}${opName.toUpperCase()} } from "./operations";

export const ${opName}Mock = {
  request: {
    query: ${opKind === "query" ? "GET_" : opKind === "mutation" ? "MUTATE_" : "SUBSCRIBE_"}${opName.toUpperCase()},
  },
  result: {
    data: ${data},
  },
};

// Usage:
// <MockedProvider mocks={[${opName}Mock]} addTypename={false}>
//   <ComponentUnderTest />
// </MockedProvider>`;
}

export function renderResult(result: MockResult, format: ExportFormat): string {
  switch (format) {
    case "json": return renderJson(result);
    case "graphql-response": return renderGraphqlResponse(result);
    case "msw": return renderMsw(result);
    case "apollo": return renderApollo(result);
  }
}

// ---------------------------------------------------------------------------
// Sample schema & query (for "load example" button)
// ---------------------------------------------------------------------------

export const SAMPLE_SDL = `type Query {
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  post(id: ID!): Post
  posts(limit: Int = 10): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

type Subscription {
  onPostCreated: Post!
}

type User implements Node {
  id: ID!
  email: String!
  name: String!
  age: Int
  role: UserRole!
  profile: Profile
  posts: [Post!]!
  friends: [User!]!
}

interface Node {
  id: ID!
}

type Profile {
  bio: String
  avatarUrl: URL
  website: URL
  location: String
  joinedAt: DateTime
}

type Post implements Node {
  id: ID!
  title: String!
  body: String!
  author: User!
  tags: [String!]!
  publishedAt: DateTime
  viewCount: Int!
  metadata: JSON
}

union SearchResult = User | Post

enum UserRole {
  ADMIN
  MEMBER
  GUEST
}

input CreateUserInput {
  email: String!
  name: String!
  role: UserRole = MEMBER
}

input UpdateUserInput {
  email: String
  name: String
}

scalar DateTime
scalar URL
scalar JSON
`;

export const SAMPLE_QUERY = `query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    name
    age
    role
    profile {
      bio
      avatarUrl
      website
      joinedAt
    }
    posts(limit: 3) {
      id
      title
      publishedAt
      viewCount
      tags
    }
    friends {
      id
      name
      email
    }
  }
  users(limit: 5) {
    id
    name
    email
  }
}`;

// ---------------------------------------------------------------------------
// History (localStorage) — metadata only
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mock-graphql-response-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  operationKind: OperationKind;
  operationName?: string;
  listSize: number;
  seed: string;
  schemaSize: number;
  querySize: number;
  format: ExportFormat;
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
// Shareable URL — encodes options in the fragment
// ---------------------------------------------------------------------------

export interface ShareOptions {
  listSize: number;
  depthLimit: number;
  seed: string;
  nullableRate: number;
  errorRate: number;
  format: ExportFormat;
}

export function buildShareUrl(opts: ShareOptions): string {
  const params = new URLSearchParams();
  params.set("list", String(opts.listSize));
  params.set("depth", String(opts.depthLimit));
  params.set("seed", opts.seed);
  params.set("null", String(opts.nullableRate));
  params.set("err", String(opts.errorRate));
  params.set("fmt", opts.format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return defaultShareOptions();
  const params = new URLSearchParams(clean);
  return {
    listSize: parseInt(params.get("list") ?? "3", 10) || 3,
    depthLimit: parseInt(params.get("depth") ?? "3", 10) || 3,
    seed: params.get("seed") ?? "",
    nullableRate: parseFloat(params.get("null") ?? "0") || 0,
    errorRate: parseFloat(params.get("err") ?? "0") || 0,
    format: (params.get("fmt") as ExportFormat) ?? "graphql-response",
  };
}

function defaultShareOptions(): ShareOptions {
  return {
    listSize: 3,
    depthLimit: 3,
    seed: "",
    nullableRate: 0,
    errorRate: 0,
    format: "graphql-response",
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface GenerationStats {
  operationKind: OperationKind;
  operationName?: string;
  warningsCount: number;
  dataBytes: number;
  hasErrors: boolean;
  listSize: number;
  depthLimit: number;
}

export function computeStats(result: MockResult, opts: MockOptions): GenerationStats {
  return {
    operationKind: result.operationKind,
    operationName: result.operationName,
    warningsCount: result.warnings.length,
    dataBytes: JSON.stringify(result.data ?? null).length,
    hasErrors: !!(result.errors && result.errors.length > 0),
    listSize: opts.listSize,
    depthLimit: opts.depthLimit,
  };
}

// ---------------------------------------------------------------------------
// Honesty / privacy banner
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated mock data is synthetic and reproducible from the seed. Names, emails, " +
  "URLs, and other values are randomly assembled from word banks and do not " +
  "correspond to real entities. The recursion depth is capped to prevent infinite " +
  "loops on self-referential types — fields beyond the depth limit emit null.";
