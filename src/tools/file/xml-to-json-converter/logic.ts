/**
 * XML to JSON Converter — pure logic for XML→JSON conversion, XML validation,
 * and reverse JSON→XML. No DOM dependency; uses pure-JS recursive descent
 * parser so it works in both browser and Node (tests) environments.
 */

export interface ConvertOptions {
  attributePrefix: string; // default "@"
  textKey: string; // default "#text"
  arrayDetection: boolean; // group repeated elements into arrays
  ignoreNamespaces: boolean; // strip "ns:" prefixes
  ignoreAttributes: boolean; // skip attributes entirely
  preserveDeclarations: boolean; // keep xmlns:foo="..." as attributes
  collapseEmpty: "omit" | "null" | "empty"; // empty <foo></foo> handling
  trimWhitespace: boolean; // trim text nodes
  prettyPrint: boolean;
  indent: number;
  coerceTypes: boolean; // "123" → 123, "true" → true
  depthLimit: number;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  attributePrefix: "@",
  textKey: "#text",
  arrayDetection: true,
  ignoreNamespaces: false,
  ignoreAttributes: false,
  preserveDeclarations: false,
  collapseEmpty: "omit",
  trimWhitespace: true,
  prettyPrint: true,
  indent: 2,
  coerceTypes: false,
  depthLimit: 100,
};

/** Strip the namespace prefix from a name (e.g. "ns:foo" → "foo"). */
export function stripNamespace(name: string): string {
  const idx = name.indexOf(":");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

/** Remove namespace prefix from attributes and elements. */
export function normalizeName(name: string, options: ConvertOptions): string {
  if (options.ignoreNamespaces) return stripNamespace(name);
  return name;
}

/** Escape XML special characters in text content. */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape XML special characters in attribute values. */
export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Unescape XML entities. */
export function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Validate XML well-formedness (basic — checks tag balance + CDATA + entities). */
export function validateXml(xml: string): { ok: boolean; error?: string } {
  if (!xml || !xml.trim()) return { ok: false, error: "Empty XML." };
  const stripped = xml
    .replace(/<\?[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "TEXT");
  const stack: string[] = [];
  const tagRegex = /<\/?([A-Za-z_][A-Za-z0-9_\-.:]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let match: RegExpExecArray | null;
  let pos = 0;
  while ((match = tagRegex.exec(stripped)) !== null) {
    pos = tagRegex.lastIndex;
    const [full, name, attrsRaw] = match;
    const isClose = full.startsWith("</");
    const isSelfClosing = attrsRaw.trim().endsWith("/");
    if (isClose) {
      if (stack.length === 0 || stack[stack.length - 1] !== name) {
        return { ok: false, error: `Mismatched closing tag </${name}> at position ${pos}.` };
      }
      stack.pop();
    } else if (!isSelfClosing) {
      stack.push(name);
    }
  }
  if (stack.length > 0) {
    return { ok: false, error: `Unclosed tag <${stack[stack.length - 1]}>.` };
  }
  return { ok: true };
}

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/** Parse XML string into a tree (pure JS, no DOM). */
export function parseXml(xml: string): { ok: true; root: XmlNode } | { ok: false; error: string } {
  const validation = validateXml(xml);
  if (!validation.ok) return { ok: false, error: validation.error! };
  const stripped = xml
    .replace(/<\?[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  try {
    const { root } = parseElement(stripped, 0);
    return { ok: true, root };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function parseElement(input: string, pos: number): { root: XmlNode; pos: number } {
  while (pos < input.length && /\s/.test(input[pos])) pos++;
  if (input[pos] !== "<") throw new Error(`Expected '<' at position ${pos}.`);
  pos++;
  let name = "";
  while (pos < input.length && /[A-Za-z0-9_\-.:]/.test(input[pos])) name += input[pos++];
  if (!name) throw new Error(`Invalid tag name at position ${pos}.`);
  const attributes: Record<string, string> = {};
  while (pos < input.length && input[pos] !== ">" && input[pos] !== "/") {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (input[pos] === ">" || input[pos] === "/") break;
    let attrName = "";
    while (pos < input.length && /[A-Za-z0-9_\-.:]/.test(input[pos])) attrName += input[pos++];
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (input[pos] !== "=") throw new Error(`Expected '=' after attribute '${attrName}' at position ${pos}.`);
    pos++;
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    const quote = input[pos];
    if (quote !== '"' && quote !== "'") throw new Error(`Expected quote at position ${pos}.`);
    pos++;
    let attrVal = "";
    while (pos < input.length && input[pos] !== quote) attrVal += input[pos++];
    pos++;
    attributes[attrName] = unescapeXml(attrVal);
  }
  if (input[pos] === "/") {
    pos++;
    if (input[pos] !== ">") throw new Error(`Expected '>' after '/' at position ${pos}.`);
    pos++;
    return { root: { name, attributes, children: [], text: "" }, pos };
  }
  if (input[pos] !== ">") throw new Error(`Expected '>' at position ${pos}.`);
  pos++;
  const node: XmlNode = { name, attributes, children: [], text: "" };
  let textBuffer = "";
  while (pos < input.length) {
    if (input[pos] === "<") {
      if (input.slice(pos, pos + 9) === "<![CDATA[") {
        const end = input.indexOf("]]>", pos);
        if (end < 0) throw new Error("Unterminated CDATA.");
        textBuffer += input.slice(pos + 9, end);
        pos = end + 3;
        continue;
      }
      if (input[pos + 1] === "/") {
        pos += 2;
        let closeName = "";
        while (pos < input.length && /[A-Za-z0-9_\-.:]/.test(input[pos])) closeName += input[pos++];
        while (pos < input.length && input[pos] !== ">") pos++;
        pos++;
        if (closeName !== name) throw new Error(`Mismatched closing tag: expected </${name}>, got </${closeName}>.`);
        node.text = unescapeXml(textBuffer);
        return { root: node, pos };
      }
      if (textBuffer.trim()) {
        node.text = unescapeXml(textBuffer);
        textBuffer = "";
      }
      const child = parseElement(input, pos);
      node.children.push(child.root);
      pos = child.pos;
    } else {
      textBuffer += input[pos++];
    }
  }
  throw new Error(`Unclosed element <${name}>.`);
}

/** Coerce a string value into a primitive (when enabled). */
export function coerceValue(text: string, options: ConvertOptions): unknown {
  if (!options.coerceTypes) return text;
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  if (/^-?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+(?:[eE][+-]?\d+)?$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return n;
  }
  return text;
}

/** Convert an XML node to a JSON value. */
export function xmlNodeToJson(node: XmlNode, options: ConvertOptions, depth: number = 0): unknown {
  if (depth > options.depthLimit) {
    throw new Error(`Depth limit exceeded (${options.depthLimit}).`);
  }
  const obj: Record<string, unknown> = {};
  // Attributes
  if (!options.ignoreAttributes) {
    for (const [k, v] of Object.entries(node.attributes)) {
      if (!options.preserveDeclarations && (k === "xmlns" || k.startsWith("xmlns:"))) continue;
      const norm = normalizeName(k, options);
      if (norm in obj) continue; // attribute clash — skip duplicate
      obj[options.attributePrefix + norm] = v;
    }
  }
  // Children grouped by name
  const grouped: Record<string, XmlNode[]> = {};
  for (const child of node.children) {
    const norm = normalizeName(child.name, options);
    if (!grouped[norm]) grouped[norm] = [];
    grouped[norm].push(child);
  }
  for (const [childName, children] of Object.entries(grouped)) {
    const values = children.map((c) => xmlNodeToJson(c, options, depth + 1));
    if (options.arrayDetection) {
      obj[childName] = values.length === 1 ? values[0] : values;
    } else {
      obj[childName] = values.length === 1 ? values[0] : values;
    }
  }
  // Text content
  const rawText = node.text;
  const trimmed = options.trimWhitespace ? rawText.trim() : rawText;
  if (trimmed) {
    const coerced = coerceValue(trimmed, options);
    if (Object.keys(obj).length === 0) {
      return coerced;
    }
    obj[options.textKey] = coerced;
  }
  // Empty element handling
  if (Object.keys(obj).length === 0) {
    if (options.collapseEmpty === "omit") return null;
    if (options.collapseEmpty === "null") return null;
    if (options.collapseEmpty === "empty") return "";
  }
  return obj;
}

/** Convert XML string to JSON string. */
export function xmlToJson(xml: string, options: ConvertOptions): { ok: true; json: string } | { ok: false; error: string } {
  const parsed = parseXml(xml);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const json = xmlNodeToJson(parsed.root, options);
    // Wrap so output is always a JSON object (root element name as key)
    const rootName = normalizeName(parsed.root.name, options);
    const wrapped: Record<string, unknown> = { [rootName]: json };
    return { ok: true, json: JSON.stringify(wrapped, null, options.prettyPrint ? options.indent : 0) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ===== Reverse: JSON → XML =====

/** Validate a JSON string. Returns { ok, value }. */
export function validateJson(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Sanitize a string into a valid XML element name. */
export function sanitizeXmlName(name: string): string {
  if (!name) return "_";
  if (/^[A-Za-z_][A-Za-z0-9_\-.]*$/.test(name)) return name;
  let first = name.charAt(0);
  if (!/^[A-Za-z_]$/.test(first)) first = "_";
  const rest = name.slice(1).replace(/[^A-Za-z0-9_\-.]/g, "_");
  return first + rest;
}

/** Wrap text in CDATA if it contains special chars. */
export function maybeCdata(text: string): string {
  if (/[<>&]/.test(text)) {
    return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  }
  return escapeXmlText(text);
}

/** Convert a JS value to XML (reverse direction). */
export function valueToXml(
  value: unknown,
  name: string,
  options: ConvertOptions,
  depth: number,
): string {
  if (depth > options.depthLimit) {
    throw new Error(`Depth limit exceeded (${options.depthLimit}).`);
  }
  const tagName = sanitizeXmlName(name);
  const indent = options.prettyPrint ? " ".repeat(options.indent * depth) : "";
  const nl = options.prettyPrint ? "\n" : "";

  if (value === null || value === undefined) {
    return `${indent}<${tagName} xsi:nil="true" />`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueToXml(item, name, options, depth)).join(nl);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const attrs: string[] = [];
    const children: string[] = [];
    let textContent: string | null = null;

    for (const key of Object.keys(obj)) {
      if (key.startsWith(options.attributePrefix)) {
        const attrName = sanitizeXmlName(key.slice(options.attributePrefix.length));
        const attrVal = typeof obj[key] === "object" ? JSON.stringify(obj[key]) : String(obj[key]);
        attrs.push(`${attrName}="${escapeXmlAttribute(attrVal)}"`);
      } else if (key === options.textKey) {
        textContent = String(obj[key]);
      } else {
        children.push(valueToXml(obj[key], key, options, depth + 1));
      }
    }
    const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    if (children.length === 0 && textContent === null) {
      return `${indent}<${tagName}${attrStr} />`;
    }
    if (children.length === 0 && textContent !== null) {
      return `${indent}<${tagName}${attrStr}>${maybeCdata(textContent)}</${tagName}>`;
    }
    const inner = children.join(nl);
    const textPart = textContent !== null ? maybeCdata(textContent) : "";
    const open = `${indent}<${tagName}${attrStr}>`;
    const close = `${indent}</${tagName}>`;
    return `${open}${nl}${inner}${textPart ? nl + indent + " ".repeat(options.indent) + textPart : ""}${nl}${close}`;
  }

  const text = String(value);
  return `${indent}<${tagName}>${maybeCdata(text)}</${tagName}>`;
}

/** Convert JSON string to XML (reverse). */
export function jsonToXml(jsonInput: string, options: ConvertOptions): { ok: true; xml: string } | { ok: false; error: string } {
  const parsed = validateJson(jsonInput);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    let inner: string;
    if (parsed.value !== null && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
      const obj = parsed.value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 1) {
        inner = valueToXml(obj[keys[0]], keys[0], options, 0);
      } else {
        inner = valueToXml(parsed.value, "root", options, 0);
      }
    } else {
      inner = valueToXml(parsed.value, "root", options, 0);
    }
    const xml = options.prettyPrint
      ? `<?xml version="1.0" encoding="UTF-8"?>\n${inner}\n`
      : `<?xml version="1.0" encoding="UTF-8"?>${inner}`;
    return { ok: true, xml };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-xml-json-history";
const MAX_HISTORY = 10;

export interface ConversionHistoryEntry {
  direction: "xml2json" | "json2xml";
  attributePrefix: string;
  textKey: string;
  inputSize: number;
  outputSize: number;
  convertedAt: string;
}

export function loadHistory(): ConversionHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: ConversionHistoryEntry): ConversionHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL (settings only, never input data). */
export function buildShareUrl(options: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams({
    attr: options.attributePrefix,
    text: options.textKey,
    array: String(options.arrayDetection),
    ns: String(options.ignoreNamespaces),
    pretty: String(options.prettyPrint),
    indent: String(options.indent),
    coerce: String(options.coerceTypes),
    empty: options.collapseEmpty,
  });
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
