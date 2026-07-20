/**
 * AI TypeScript Interface Generator — pure logic.
 *
 * Converts JSON (single object, array, or multi-sample set) into
 * TypeScript interfaces / types with nested extraction, optional
 * & nullable handling, union types, enum (string-literal-union)
 * detection, multi-sample merging, runtime validators, and JSDoc
 * from keys. Pure-JS engine — no DOM, no network. The optional
 * LLM call (BYO API key) lives in ui.tsx because it touches the
 * network.
 *
 * Pure functions only.
 */

// ---------- Types ----------

export type DeclKind = "interface" | "type";

export type OptionalStyle = "question" | "undefined";

export type ArrayStyle = "bracket" | "generic";

export interface GeneratorConfig {
  rootName: string;
  exportDecls: boolean;
  declKind: DeclKind;
  readonly: boolean;
  optionalStyle: OptionalStyle;
  arrayStyle: ArrayStyle;
  detectEnums: boolean;
  generateValidators: boolean;
  generateJsDoc: boolean;
  maxEnumMembers: number;
}

export type PrimitiveKind = "string" | "number" | "boolean" | "null" | "bigint" | "undefined" | "unknown";

/** Inferred type node — a discriminated union describing what we found. */
export type TypeNode =
  | { kind: "primitive"; ts: PrimitiveKind }
  | { kind: "string-literal"; values: string[] }   // enum-like
  | { kind: "number-literal"; values: number[] }
  | { kind: "union"; members: TypeNode[] }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; ref: string };                // ref to an InterfaceDecl name

export interface PropertyDecl {
  rawName: string;
  name: string;            // sanitized, possibly quoted
  type: TypeNode;
  optional: boolean;
  nullable: boolean;
  jsDoc?: string;
}

export interface InterfaceDecl {
  name: string;
  properties: PropertyDecl[];
  jsDoc?: string;
}

export interface EnumDecl {
  name: string;
  literalType: "string" | "number";
  values: (string | number)[];
}

export interface GeneratorResult {
  interfaces: InterfaceDecl[];
  enums: EnumDecl[];
  rootAlias: { name: string; type: TypeNode } | null;
  validators: string;        // generated .ts source for type guards
  warnings: string[];
  config: GeneratorConfig;
  stats: GeneratorStats;
  generatedAt: number;
}

export interface GeneratorStats {
  interfaceCount: number;
  enumCount: number;
  propertyCount: number;
  optionalCount: number;
  unionCount: number;
  arrayCount: number;
  validatorCount: number;
}

export interface HistoryEntry {
  ts: number;
  rootName: string;
  interfaceCount: number;
  sampleCount: number;
  preview: string;        // first ~80 chars of input JSON
}

export interface ShareState {
  json: string;
  rootName: string;
  config: Partial<GeneratorConfig>;
}

export interface LlmRequestBody {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_tokens: number;
}

// ---------- Defaults ----------

export const DEFAULT_CONFIG: GeneratorConfig = {
  rootName: "Root",
  exportDecls: true,
  declKind: "interface",
  readonly: false,
  optionalStyle: "question",
  arrayStyle: "bracket",
  detectEnums: true,
  generateValidators: false,
  generateJsDoc: false,
  maxEnumMembers: 10,
};

export const SAMPLE_DESTINATIONS = "samples"; // marker for share URL

export const SAMPLE_JSON_1 = `{
  "id": 42,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "isActive": true,
  "roles": ["admin", "editor"],
  "address": {
    "street": "1 Main St",
    "city": "London",
    "postalCode": "SW1A 1AA"
  },
  "lastLogin": null
}`;

export const SAMPLE_JSON_2 = `[
  { "id": 1, "label": "Open", "color": "#f00" },
  { "id": 2, "label": "Closed", "color": "#0f0" }
]`;

// ---------- JSON parsing ----------

export function safeParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text || !text.trim()) return { ok: false, error: "Empty input" };
  try {
    const v = JSON.parse(text);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

// ---------- Name sanitization ----------

const RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for",
  "function", "if", "import", "in", "instanceof", "new", "null", "return", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with",
  "as", "async", "await", "yield", "let", "static", "number", "string", "boolean",
  "any", "unknown", "never", "object", "symbol", "bigint",
]);

export function toPascalCase(s: string): string {
  const parts = (s || "").replace(/[^a-zA-Z0-9$_]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Root";
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function toCamelCase(s: string): string {
  const pc = toPascalCase(s);
  return pc.charAt(0).toLowerCase() + pc.slice(1);
}

export function toValidIdentifier(s: string, fallback = "Key"): string {
  let t = (s || "").trim();
  if (/^\d/.test(t)) t = fallback + t;
  t = t.replace(/[^a-zA-Z0-9_$]/g, "_");
  if (!t) t = fallback;
  if (RESERVED.has(t.toLowerCase())) t = t + "_";
  return t;
}

export function needsQuoting(rawName: string): boolean {
  if (!rawName) return true;
  if (/^\d/.test(rawName)) return true;
  if (/[^a-zA-Z0-9_$]/.test(rawName)) return true;
  if (RESERVED.has(rawName.toLowerCase())) return true;
  return false;
}

export function quoteKey(rawName: string): string {
  return needsQuoting(rawName) ? `"${rawName.replace(/"/g, '\\"')}"` : rawName;
}

export function buildInterfaceName(root: string, keyPath: string[]): string {
  if (keyPath.length === 0) return toPascalCase(root);
  const last = keyPath[keyPath.length - 1];
  // Pluralize → singular for array element types
  const sing = singularize(last);
  return toPascalCase(`${root} ${sing}`);
}

function singularize(w: string): string {
  if (!w) return w;
  if (/ies$/i.test(w)) return w.slice(0, -3) + "y";
  if (/s$/i.test(w) && !/ss$/i.test(w)) return w.slice(0, -1);
  return w;
}

// ---------- Inference (single value) ----------

export function inferPrimitive(value: unknown): PrimitiveKind | null {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  if (t === "bigint") return "bigint";
  return null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------- Multi-sample type merging ----------

interface MergeContext {
  root: string;
  keyPath: string[];
  config: GeneratorConfig;
  interfaces: InterfaceDecl[];
  enums: EnumDecl[];
  warnings: string[];
  usedNames: Set<string>;
}

function uniqueName(ctx: MergeContext, base: string): string {
  let name = base;
  let n = 2;
  while (ctx.usedNames.has(name)) {
    name = `${base}${n}`;
    n++;
  }
  ctx.usedNames.add(name);
  return name;
}

/** Merge an array of TypeNodes (from multiple samples) into a single TypeNode. */
function mergeTypeNodes(nodes: TypeNode[]): TypeNode {
  const nonNull = nodes.filter((n) => !(n.kind === "primitive" && n.ts === "null"));
  const hasNull = nonNull.length < nodes.length;
  if (nonNull.length === 0) {
    return { kind: "primitive", ts: "null" };
  }
  // All same primitive
  const primitives = nonNull.filter((n) => n.kind === "primitive") as Array<{ kind: "primitive"; ts: PrimitiveKind }>;
  if (primitives.length === nonNull.length) {
    const types = new Set(primitives.map((p) => p.ts));
    if (types.size === 1) {
      const only = primitives[0].ts;
      if (only === "null") return { kind: "primitive", ts: "null" };
      return hasNull
        ? { kind: "union", members: [{ kind: "primitive", ts: only }, { kind: "primitive", ts: "null" }] }
        : { kind: "primitive", ts: only };
    }
    // Multiple primitive types → union
    const members = Array.from(types).map((ts) => ({ kind: "primitive" as const, ts })) as TypeNode[];
    if (hasNull) members.push({ kind: "primitive", ts: "null" });
    return { kind: "union", members };
  }
  // String literals across samples → merge values
  const literals = nonNull.filter((n) => n.kind === "string-literal" || n.kind === "number-literal");
  if (literals.length === nonNull.length) {
    if (literals.every((l) => l.kind === "string-literal")) {
      const values = new Set<string>();
      for (const l of literals) if (l.kind === "string-literal") for (const v of l.values) values.add(v);
      return { kind: "string-literal", values: Array.from(values) };
    }
    if (literals.every((l) => l.kind === "number-literal")) {
      const values = new Set<number>();
      for (const l of literals) if (l.kind === "number-literal") for (const v of l.values) values.add(v);
      return { kind: "number-literal", values: Array.from(values) };
    }
  }
  // Arrays → merge element types
  const arrays = nonNull.filter((n) => n.kind === "array") as Array<{ kind: "array"; element: TypeNode }>;
  if (arrays.length === nonNull.length) {
    const elements = arrays.map((a) => a.element);
    const mergedElement = mergeTypeNodes(elements);
    return hasNull
      ? { kind: "union", members: [{ kind: "array", element: mergedElement }, { kind: "primitive", ts: "null" }] }
      : { kind: "array", element: mergedElement };
  }
  // Objects → merge ref but the refs may differ; produce union of refs
  const objects = nonNull.filter((n) => n.kind === "object") as Array<{ kind: "object"; ref: string }>;
  if (objects.length === nonNull.length) {
    const refs = new Set(objects.map((o) => o.ref));
    if (refs.size === 1) {
      return hasNull
        ? { kind: "union", members: [{ kind: "object", ref: objects[0].ref }, { kind: "primitive", ts: "null" }] }
        : { kind: "object", ref: objects[0].ref };
    }
    const members: TypeNode[] = Array.from(refs).map((ref) => ({ kind: "object", ref }));
    if (hasNull) members.push({ kind: "primitive", ts: "null" });
    return { kind: "union", members };
  }
  // Mixed kinds → union
  const members = nonNull.slice();
  if (hasNull) members.push({ kind: "primitive", ts: "null" });
  return { kind: "union", members };
}

// ---------- Main inference: object → interface ----------

function inferObjectIntoInterface(
  obj: Record<string, unknown>,
  ctx: MergeContext,
  name: string,
): InterfaceDecl {
  const props: PropertyDecl[] = [];
  for (const rawKey of Object.keys(obj)) {
    const value = obj[rawKey];
    const childPath = [...ctx.keyPath, rawKey];
    const type = inferValue(value, { ...ctx, keyPath: childPath });
    const optional = false; // determined later by multi-sample merge
    const nullable = isNullable(type);
    props.push({
      rawName: rawKey,
      name: quoteKey(rawKey),
      type,
      optional,
      nullable,
    });
  }
  return { name, properties: props };
}

function isNullable(node: TypeNode): boolean {
  if (node.kind === "primitive" && node.ts === "null") return true;
  if (node.kind === "union") return node.members.some((m) => m.kind === "primitive" && m.ts === "null");
  return false;
}

function inferValue(value: unknown, ctx: MergeContext): TypeNode {
  const prim = inferPrimitive(value);
  if (prim === "null") return { kind: "primitive", ts: "null" };
  if (prim) return { kind: "primitive", ts: prim };
  if (Array.isArray(value)) {
    return inferArray(value, ctx);
  }
  if (isObject(value)) {
    const name = uniqueName(ctx, buildInterfaceName(ctx.root, ctx.keyPath));
    const decl = inferObjectIntoInterface(value, { ...ctx }, name);
    ctx.interfaces.push(decl);
    return { kind: "object", ref: name };
  }
  return { kind: "primitive", ts: "string" }; // fallback (functions, symbols)
}

function inferArray(arr: unknown[], ctx: MergeContext): TypeNode {
  if (arr.length === 0) {
    return { kind: "array", element: { kind: "primitive", ts: "unknown" } };
  }
  // Special case: array of primitives → detect enum (string-literal)
  if (ctx.config.detectEnums && arr.every((v) => typeof v === "string" || typeof v === "number")) {
    const distinct = new Set<string | number>();
    for (const v of arr) distinct.add(v as string | number);
    if (distinct.size > 0 && distinct.size <= ctx.config.maxEnumMembers) {
      if (arr.every((v) => typeof v === "string")) {
        return { kind: "array", element: { kind: "string-literal", values: Array.from(distinct) as string[] } };
      }
      if (arr.every((v) => typeof v === "number")) {
        return { kind: "array", element: { kind: "number-literal", values: Array.from(distinct) as number[] } };
      }
    }
  }
  // All objects → merge into ONE interface (named after the singularized key path)
  if (arr.every(isObject)) {
    const name = uniqueName(ctx, buildInterfaceName(ctx.root, ctx.keyPath.length > 0 ? ctx.keyPath : ["item"]));
    const decl = mergeObjects(arr as Record<string, unknown>[], ctx, name);
    ctx.interfaces.push(decl);
    return { kind: "array", element: { kind: "object", ref: name } };
  }
  // Mixed elements → infer each and merge
  const childCtx = { ...ctx };
  const nodes = arr.map((v) => inferValue(v, childCtx));
  const merged = mergeTypeNodes(nodes);
  return { kind: "array", element: merged };
}

// ---------- Multi-sample merge of objects ----------

interface MergedProperty {
  rawName: string;
  name: string;
  types: TypeNode[];   // one per sample (in sample order)
  presentCount: number;
  sampleCount: number;
}

function mergeObjects(
  objs: Record<string, unknown>[],
  ctx: MergeContext,
  name: string,
): InterfaceDecl {
  const allKeys = new Set<string>();
  for (const o of objs) for (const k of Object.keys(o)) allKeys.add(k);
  const merged: MergedProperty[] = [];
  for (const key of allKeys) {
    const types: TypeNode[] = [];
    let present = 0;
    for (const o of objs) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        present++;
        const childPath = [...ctx.keyPath, key];
        const t = inferValue(o[key], { ...ctx, keyPath: childPath });
        types.push(t);
      }
    }
    merged.push({
      rawName: key,
      name: quoteKey(key),
      types,
      presentCount: present,
      sampleCount: objs.length,
    });
  }
  // Build property decls
  const props: PropertyDecl[] = merged.map((mp) => {
    const mergedType = mergeTypeNodes(mp.types);
    const optional = mp.presentCount < mp.sampleCount;
    const nullable = isNullable(mergedType);
    return {
      rawName: mp.rawName,
      name: mp.name,
      type: mergedType,
      optional,
      nullable,
    };
  });
  return { name, properties: props };
}

// ---------- Enum detection across samples for a single property ----------

function tryEnumInference(
  rawName: string,
  values: unknown[],
  config: GeneratorConfig,
): TypeNode | null {
  if (!config.detectEnums) return null;
  if (values.length === 0) return null;
  const allString = values.every((v) => typeof v === "string");
  const allNumber = values.every((v) => typeof v === "number");
  if (!allString && !allNumber) return null;
  const distinct = new Set<string | number>();
  for (const v of values) distinct.add(v as string | number);
  if (distinct.size < 2 || distinct.size > config.maxEnumMembers) return null;
  if (allString) return { kind: "string-literal", values: Array.from(distinct) as string[] };
  return { kind: "number-literal", values: Array.from(distinct) as number[] };
}

// After inference, walk properties and try to upgrade primitive types
// to string-literal when the original samples contained distinct values.
// (This is done at the multi-sample merge level via post-process.)

// ---------- Render TypeNode → TS string ----------

export function renderTypeNode(node: TypeNode, config: GeneratorConfig): string {
  switch (node.kind) {
    case "primitive":
      if (node.ts === "null") return "null";
      if (node.ts === "undefined") return "undefined";
      if (node.ts === "bigint") return "bigint";
      if (node.ts === "unknown") return "unknown";
      return node.ts;
    case "string-literal":
      return node.values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(" | ");
    case "number-literal":
      return node.values.map((v) => String(v)).join(" | ");
    case "union": {
      const parts = node.members.map((m) => renderTypeNode(m, config));
      // Dedupe
      const unique = Array.from(new Set(parts));
      if (unique.length === 1) return unique[0];
      // Wrap object members in parens for clarity
      return unique.join(" | ");
    }
    case "array": {
      const inner = renderTypeNode(node.element, config);
      if (node.element.kind === "union") {
        return config.arrayStyle === "generic" ? `Array<${inner}>` : `(${inner})[]`;
      }
      return config.arrayStyle === "generic" ? `Array<${inner}>` : `${inner}[]`;
    }
    case "object":
      return node.ref;
  }
}

// ---------- Render interface decl → TS source ----------

export function renderInterface(decl: InterfaceDecl, config: GeneratorConfig): string {
  const lines: string[] = [];
  const exportKw = config.exportDecls ? "export " : "";
  const indent = "  ";
  if (config.declKind === "interface") {
    lines.push(`${exportKw}interface ${decl.name} {`);
  } else {
    lines.push(`${exportKw}type ${decl.name} = {`);
  }
  for (const p of decl.properties) {
    const { nullable: typeNullable, inner } = splitNullable(p.type);
    const effectiveNullable = typeNullable || p.nullable;
    let typeStr = renderTypeNode(inner, config);
    if (config.optionalStyle === "undefined" && (p.optional || effectiveNullable)) {
      typeStr = `${typeStr} | undefined`;
    }
    const optMark = (p.optional || effectiveNullable) && config.optionalStyle === "question" ? "?" : "";
    const ro = config.readonly ? "readonly " : "";
    if (config.generateJsDoc) {
      const doc = buildJsDoc(p);
      if (doc) lines.push(`${indent}/** ${doc} */`);
    }
    lines.push(`${indent}${ro}${p.name}${optMark}: ${typeStr};`);
  }
  if (config.declKind === "interface") {
    lines.push("}");
  } else {
    lines.push("};");
  }
  return lines.join("\n");
}

/** Split a TypeNode into (nullable, inner) so renderInterface can format cleanly. */
export function splitNullable(node: TypeNode): { nullable: boolean; inner: TypeNode } {
  if (node.kind === "primitive" && node.ts === "null") {
    return { nullable: true, inner: { kind: "primitive", ts: "unknown" } };
  }
  if (node.kind === "union") {
    const others = node.members.filter((m) => !(m.kind === "primitive" && m.ts === "null"));
    if (others.length === node.members.length) return { nullable: false, inner: node };
    if (others.length === 0) return { nullable: true, inner: { kind: "primitive", ts: "unknown" } };
    if (others.length === 1) return { nullable: true, inner: others[0] };
    return { nullable: true, inner: { kind: "union", members: others } };
  }
  return { nullable: false, inner: node };
}

export function buildJsDoc(prop: PropertyDecl): string {
  const parts: string[] = [];
  parts.push(`@${prop.rawName}`);
  if (prop.optional) parts.push("(optional)");
  if (prop.nullable) parts.push("(nullable)");
  if (prop.type.kind === "array") parts.push("array");
  if (prop.type.kind === "object") parts.push(`→ ${prop.type.ref}`);
  if (prop.type.kind === "string-literal") parts.push(`enum: ${prop.type.values.join("|")}`);
  return parts.join(" ");
}

// ---------- Type guards (validators) ----------

export function generateTypeGuard(decl: InterfaceDecl, config: GeneratorConfig): string {
  const fnName = `is${decl.name}`;
  const lines: string[] = [];
  const exportKw = config.exportDecls ? "export " : "";
  lines.push(`${exportKw}function ${fnName}(v: unknown): v is ${decl.name} {`);
  lines.push(`  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;`);
  lines.push(`  const o = v as Record<string, unknown>;`);
  for (const p of decl.properties) {
    const check = generatePropertyCheck(p, "o");
    if (!p.optional) {
      lines.push(`  if (!${check}) return false;`);
    } else {
      lines.push(`  if (o[${JSON.stringify(p.rawName)}] !== undefined && !${check}) return false;`);
    }
  }
  lines.push(`  return true;`);
  lines.push(`}`);
  return lines.join("\n");
}

function generatePropertyCheck(prop: PropertyDecl, objVar: string): string {
  const access = `${objVar}[${JSON.stringify(prop.rawName)}]`;
  return generateNodeCheck(prop.type, access);
}

function generateNodeCheck(node: TypeNode, expr: string): string {
  switch (node.kind) {
    case "primitive":
      if (node.ts === "null") return `(${expr} === null)`;
      if (node.ts === "undefined") return `(${expr} === undefined)`;
      if (node.ts === "bigint") return `(typeof ${expr} === "bigint")`;
      if (node.ts === "unknown") return "true";
      return `(typeof ${expr} === "${node.ts}")`;
    case "string-literal":
      return `(${node.values.map((v) => `${expr} === ${JSON.stringify(v)}`).join(" || ")})`;
    case "number-literal":
      return `(${node.values.map((v) => `${expr} === ${v}`).join(" || ")})`;
    case "union": {
      const checks = node.members
        .filter((m) => !(m.kind === "primitive" && m.ts === "null"))
        .map((m) => generateNodeCheck(m, expr));
      if (checks.length === 0) return "true";
      // Allow null → make the check optional (treat null as pass)
      const hasNull = node.members.some((m) => m.kind === "primitive" && m.ts === "null");
      const body = checks.join(" || ");
      return hasNull ? `(${expr} === null || ${body})` : `(${body})`;
    }
    case "array": {
      const inner = generateNodeCheck(node.element, "el");
      return `(Array.isArray(${expr}) && ${expr}.every((el) => ${inner}))`;
    }
    case "object":
      return `is${node.ref}(${expr})`;
  }
}

export function generateValidators(result: GeneratorResult): string {
  if (!result.config.generateValidators) return "";
  const guards = result.interfaces.map((d) => generateTypeGuard(d, result.config));
  return guards.join("\n\n");
}

// ---------- Top-level generate ----------

export function generateInterfaces(
  samples: unknown[],
  config: GeneratorConfig,
): GeneratorResult {
  const ctx: MergeContext = {
    root: config.rootName || "Root",
    keyPath: [],
    config,
    interfaces: [],
    enums: [],
    warnings: [],
    usedNames: new Set<string>(),
  };
  const warnings: string[] = [];
  if (samples.length === 0) {
    warnings.push("No samples provided.");
    return emptyResult(config, warnings);
  }

  // Determine root type
  // - If all samples are objects → one root interface (merged)
  // - If all samples are arrays → root is an array; merge elements across arrays
  // - If mixed → produce a union
  const allObjects = samples.every(isObject);
  const allArrays = samples.every((s) => Array.isArray(s));
  const rootName = uniqueName(ctx, toPascalCase(config.rootName || "Root"));

  let rootType: TypeNode;
  if (allObjects) {
    const root = mergeObjects(samples, ctx, rootName);
    ctx.interfaces.unshift(root); // root first
    rootType = { kind: "object", ref: rootName };
  } else if (allArrays) {
    // Merge all array elements across samples
    const allElements: unknown[] = [];
    for (const arr of samples) {
      for (const el of arr as unknown[]) allElements.push(el);
    }
    if (allElements.length === 0) {
      rootType = { kind: "array", element: { kind: "primitive", ts: "unknown" } };
      warnings.push("All sample arrays were empty — emitted unknown[].");
    } else if (config.detectEnums && allElements.every((v) => typeof v === "string")) {
      const distinct = new Set(allElements as string[]);
      if (distinct.size >= 2 && distinct.size <= config.maxEnumMembers) {
        rootType = { kind: "array", element: { kind: "string-literal", values: Array.from(distinct) } };
      } else {
        rootType = { kind: "array", element: { kind: "primitive", ts: "string" } };
      }
    } else if (allElements.every(isObject)) {
      // Merge all object elements into ONE interface
      const name = uniqueName(ctx, buildInterfaceName(ctx.root, ["item"]));
      const decl = mergeObjects(allElements as Record<string, unknown>[], ctx, name);
      ctx.interfaces.push(decl);
      rootType = { kind: "array", element: { kind: "object", ref: name } };
    } else {
      const childCtx = { ...ctx };
      const elementTypes = allElements.map((v) => inferValue(v, childCtx));
      const merged = mergeTypeNodes(elementTypes);
      rootType = { kind: "array", element: merged };
    }
  } else {
    // Mixed top-level → union of inferred types
    const childCtx = { ...ctx };
    const types = samples.map((v) => inferValue(v, childCtx));
    rootType = mergeTypeNodes(types);
    warnings.push("Mixed top-level types — emitted a union. Consider splitting samples by shape.");
  }

  // Build a root alias when the root isn't directly an interface.
  let rootAlias: { name: string; type: TypeNode } | null = null;
  if (allObjects) {
    // Root interface already in interfaces[0]; no separate alias needed.
  } else {
    rootAlias = { name: rootName, type: rootType };
  }

  const interfaces = ctx.interfaces;
  const enums = ctx.enums;
  const validatorsSource = generateValidators({
    interfaces,
    enums,
    rootAlias,
    validators: "",
    warnings,
    config,
    stats: emptyStats(),
    generatedAt: Date.now(),
  });

  const stats = computeStats({ interfaces, enums, validatorsSource, config });

  return {
    interfaces,
    enums,
    rootAlias,
    validators: validatorsSource,
    warnings: [...warnings, ...ctx.warnings],
    config,
    stats,
    generatedAt: Date.now(),
  };
}

function emptyResult(config: GeneratorConfig, warnings: string[]): GeneratorResult {
  return {
    interfaces: [],
    enums: [],
    rootAlias: null,
    validators: "",
    warnings,
    config,
    stats: emptyStats(),
    generatedAt: Date.now(),
  };
}

function emptyStats(): GeneratorStats {
  return {
    interfaceCount: 0, enumCount: 0, propertyCount: 0,
    optionalCount: 0, unionCount: 0, arrayCount: 0, validatorCount: 0,
  };
}

export function computeStats(partial: {
  interfaces: InterfaceDecl[];
  enums: EnumDecl[];
  validatorsSource: string;
  config: GeneratorConfig;
}): GeneratorStats {
  let propertyCount = 0;
  let optionalCount = 0;
  let unionCount = 0;
  let arrayCount = 0;
  for (const i of partial.interfaces) {
    propertyCount += i.properties.length;
    for (const p of i.properties) {
      // Count a property as optional if it's marked optional OR nullable
      // (both render with the `?` modifier in question style).
      if (p.optional || p.nullable) optionalCount++;
      if (p.type.kind === "union") unionCount++;
      if (p.type.kind === "array") arrayCount++;
    }
  }
  const validatorCount = partial.config.generateValidators
    ? (partial.validatorsSource.match(/^export function is\w+\(/gm) || []).length
    : 0;
  return {
    interfaceCount: partial.interfaces.length,
    enumCount: partial.enums.length,
    propertyCount,
    optionalCount,
    unionCount,
    arrayCount,
    validatorCount,
  };
}

// ---------- Render full .ts source ----------

export function renderTs(result: GeneratorResult): string {
  const lines: string[] = [];
  lines.push(`/* Generated by UnQTools — AI TypeScript Interface Generator.`);
  lines.push(`   Types reflect only the sample(s) you pasted. Add more samples for accurate optionals. */`);
  lines.push("");
  if (result.warnings.length > 0) {
    lines.push("/* Warnings:");
    for (const w of result.warnings) lines.push(` * - ${w}`);
    lines.push(" */");
    lines.push("");
  }
  if (result.rootAlias) {
    const exportKw = result.config.exportDecls ? "export " : "";
    const typeStr = renderTypeNode(result.rootAlias.type, result.config);
    lines.push(`${exportKw}type ${result.rootAlias.name} = ${typeStr};`);
    lines.push("");
  }
  for (const decl of result.interfaces) {
    lines.push(renderInterface(decl, result.config));
    lines.push("");
  }
  if (result.config.generateValidators && result.validators) {
    lines.push("// ---------- Runtime type guards ----------");
    lines.push("");
    lines.push(result.validators);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderTsMarkdown(result: GeneratorResult): string {
  const lines: string[] = [];
  lines.push("# Generated TypeScript");
  lines.push("");
  lines.push(`> ${result.stats.interfaceCount} interfaces · ${result.stats.propertyCount} properties · ${result.stats.optionalCount} optional · ${result.stats.unionCount} unions · ${result.stats.arrayCount} arrays`);
  lines.push("");
  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Source");
  lines.push("");
  lines.push("```ts");
  lines.push(renderTs(result));
  lines.push("```");
  return lines.join("\n");
}

export function renderTsJson(result: GeneratorResult): string {
  return JSON.stringify({
    interfaces: result.interfaces,
    enums: result.enums,
    warnings: result.warnings,
    stats: result.stats,
    config: result.config,
    generatedAt: result.generatedAt,
  }, null, 2);
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ts-interface-generator:history";
const HISTORY_MAX = 20;

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

// ---------- Share URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.json) params.set("json", state.json);
  if (state.rootName) params.set("root", state.rootName);
  const c = state.config;
  if (c.declKind) params.set("kind", c.declKind);
  if (c.readonly) params.set("ro", "1");
  if (c.optionalStyle) params.set("opt", c.optionalStyle);
  if (c.arrayStyle) params.set("arr", c.arrayStyle);
  if (c.detectEnums === false) params.set("enum", "0");
  if (c.generateValidators) params.set("guards", "1");
  if (c.generateJsDoc) params.set("jsdoc", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultState: ShareState = {
    json: "",
    rootName: "Root",
    config: {},
  };
  if (!clean) return defaultState;
  const params = new URLSearchParams(clean);
  const config: Partial<GeneratorConfig> = {};
  const kind = params.get("kind");
  if (kind === "interface" || kind === "type") config.declKind = kind;
  if (params.get("ro") === "1") config.readonly = true;
  const opt = params.get("opt");
  if (opt === "question" || opt === "undefined") config.optionalStyle = opt;
  const arr = params.get("arr");
  if (arr === "bracket" || arr === "generic") config.arrayStyle = arr;
  if (params.get("enum") === "0") config.detectEnums = false;
  if (params.get("guards") === "1") config.generateValidators = true;
  if (params.get("jsdoc") === "1") config.generateJsDoc = true;
  return {
    json: params.get("json") ?? "",
    rootName: params.get("root") ?? "Root",
    config,
  };
}

// ---------- LLM (BYO key) ----------

export function buildLlmRequestBody(
  json: string,
  config: GeneratorConfig,
  model = "gpt-4o-mini",
): LlmRequestBody {
  const system =
    `You are a TypeScript expert. Improve the user's JSON-to-TypeScript output by suggesting better ` +
    `interface names, JSDoc comments from key names, and a brief note about anything unusual (mixed types, ` +
    `empty arrays, optional fields). Keep output to a single fenced ts code block. Current root name: ` +
    `${config.rootName}. Decl kind: ${config.declKind}.`;
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: json.slice(0, 4000) },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  };
}

export function extractLlmSuggestion(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as Record<string, unknown>;
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const content = choices[0]?.message?.content;
  if (typeof content !== "string") return "";
  // Extract fenced code block if present
  const m = /```(?:ts|typescript)?\s*([\s\S]*?)```/.exec(content);
  return (m ? m[1] : content).trim();
}
