/**
 * JSON to XML Converter — pure logic for JSON→XML conversion, XML validation,
 * and reverse XML→JSON conversion. No DOM; uses pure JS string parsing.
 */

export interface ConvertOptions {
  rootName: string;
  attributePrefix: string; // default "@"
  arrayItemName: string; // default "item"
  cdataThreshold: number; // wrap text in CDATA if length > this (0 = never)
  prettyPrint: boolean;
  indent: number; // spaces per indent level
  namespace: string; // optional, e.g. "https://example.com/ns"
  namespacePrefix: string; // optional, e.g. "ns"
  includeTypeInfo: boolean; // annotate primitives with xsi:type
  depthLimit: number; // default 100
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  rootName: "root",
  attributePrefix: "@",
  arrayItemName: "item",
  cdataThreshold: 0,
  prettyPrint: true,
  indent: 2,
  namespace: "",
  namespacePrefix: "",
  includeTypeInfo: false,
  depthLimit: 100,
};

/** Validate a JSON string. Returns { ok, error }. */
export function validateJson(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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

/** Validate XML tag name (must start with letter or _, can contain letters/digits/-/_/.). */
export function isValidXmlName(name: string): boolean {
  if (!name) return false;
  return /^[A-Za-z_][A-Za-z0-9_\-.]*$/.test(name);
}

/** Sanitize a string into a valid XML element name. */
export function sanitizeXmlName(name: string): string {
  if (isValidXmlName(name)) return name;
  // Replace invalid start char with underscore
  let first = name.charAt(0);
  if (!/^[A-Za-z_]$/.test(first)) first = "_";
  // Replace invalid chars with underscore
  const rest = name.slice(1).replace(/[^A-Za-z0-9_\-.]/g, "_");
  return first + rest;
}

/** Wrap text in CDATA if it contains special chars or exceeds threshold. */
export function maybeCdata(text: string, threshold: number): string {
  if (threshold > 0 && text.length > threshold) {
    return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  }
  if (/[<>&]/.test(text)) {
    // Use CDATA for readability when special chars are present
    return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  }
  return escapeXmlText(text);
}

/** Build the root element's opening tag with optional namespace. */
export function buildRootOpen(options: ConvertOptions): string {
  const name = sanitizeXmlName(options.rootName);
  if (options.namespace && options.namespacePrefix) {
    return `<${name} xmlns:${options.namespacePrefix}="${escapeXmlAttribute(options.namespace)}">`;
  }
  if (options.namespace) {
    return `<${name} xmlns="${escapeXmlAttribute(options.namespace)}">`;
  }
  return `<${name}>`;
}

/** Get XSI type hint for a primitive value. */
export function getXsiType(value: unknown): string | null {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "double";
  return null;
}

/** Core recursive converter: convert a JS value to XML string. */
export function valueToXml(
  value: unknown,
  name: string,
  options: ConvertOptions,
  depth: number,
): string {
  if (depth > options.depthLimit) {
    throw new Error(`Depth limit exceeded (${options.depthLimit}). Increase depthLimit or simplify input.`);
  }
  const tagName = sanitizeXmlName(name);
  const indent = options.prettyPrint ? " ".repeat(options.indent * depth) : "";
  const nl = options.prettyPrint ? "\n" : "";

  if (value === null || value === undefined) {
    return `${indent}<${tagName} xsi:nil="true" />`;
  }

  if (Array.isArray(value)) {
    // Render each item as a child element with arrayItemName
    return value
      .map((item) => valueToXml(item, options.arrayItemName, options, depth))
      .join(nl);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const attrs: string[] = [];
    const children: string[] = [];
    let textContent: string | null = null;
    let textType: string | null = null;

    for (const key of Object.keys(obj)) {
      if (key.startsWith(options.attributePrefix)) {
        const attrName = sanitizeXmlName(key.slice(options.attributePrefix.length));
        const attrVal = typeof obj[key] === "object" ? JSON.stringify(obj[key]) : String(obj[key]);
        attrs.push(`${attrName}="${escapeXmlAttribute(attrVal)}"`);
      } else if (key === "#text") {
        textContent = String(obj[key]);
        textType = getXsiType(obj[key]);
      } else {
        children.push(valueToXml(obj[key], key, options, depth + 1));
      }
    }

    const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    const typeAttr = options.includeTypeInfo && textType ? ` xsi:type="${textType}"` : "";

    if (children.length === 0 && textContent === null) {
      return `${indent}<${tagName}${attrStr}${typeAttr} />`;
    }
    if (children.length === 0 && textContent !== null) {
      const text = maybeCdata(textContent, options.cdataThreshold);
      return `${indent}<${tagName}${attrStr}${typeAttr}>${text}</${tagName}>`;
    }
    const inner = children.join(nl);
    const textPart = textContent !== null ? maybeCdata(textContent, options.cdataThreshold) : "";
    const open = `${indent}<${tagName}${attrStr}${typeAttr}>`;
    const close = `${indent}</${tagName}>`;
    return `${open}${nl}${inner}${textPart ? nl + indent + " ".repeat(options.indent) + textPart : ""}${nl}${close}`;
  }

  // Primitive (string, number, boolean)
  const text = String(value);
  const typeAttr = options.includeTypeInfo ? ` xsi:type="${getXsiType(value)}"` : "";
  const escaped = maybeCdata(text, options.cdataThreshold);
  return `${indent}<${tagName}${typeAttr}>${escaped}</${tagName}>`;
}

/** Convert JSON input string to XML. */
export function jsonToXml(jsonInput: string, options: ConvertOptions): { ok: true; xml: string } | { ok: false; error: string } {
  const parsed = validateJson(jsonInput);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const inner = valueToXml(parsed.value, options.rootName, options, 0);
    const xml = options.prettyPrint
      ? `<?xml version="1.0" encoding="UTF-8"?>\n${inner}\n`
      : `<?xml version="1.0" encoding="UTF-8"?>${inner}`;
    return { ok: true, xml };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Validate XML well-formedness (basic — checks tag balance + escaping). */
export function validateXml(xml: string): { ok: boolean; error?: string } {
  if (!xml.trim()) return { ok: false, error: "Empty XML." };
  // Strip XML declaration + comments + CDATA (treat as text)
  const stripped = xml
    .replace(/<\?[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "TEXT");
  const stack: string[] = [];
  const tagRegex = /<\/?([A-Za-z_][A-Za-z0-9_\-.]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let match;
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
  // Check for unescaped & or < in text
  const textOnly = stripped.replace(/<\/?[A-Za-z_][^>]*>/g, "");
  if (/(?<!&\w+;)&(?!#?\w+;)/.test(textOnly)) {
    return { ok: false, error: "Unescaped & found in text content." };
  }
  return { ok: true };
}

// ===== XML → JSON (reverse) =====

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/** Parse a simple XML string into a tree (no external dependencies). */
export function parseXml(xml: string): { ok: true; root: XmlNode } | { ok: false; error: string } {
  const validation = validateXml(xml);
  if (!validation.ok) return { ok: false, error: validation.error! };
  // Strip declaration + comments
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
  // Skip whitespace
  while (pos < input.length && /\s/.test(input[pos])) pos++;
  if (input[pos] !== "<") throw new Error(`Expected '<' at position ${pos}.`);
  pos++;
  // Read tag name
  let name = "";
  while (pos < input.length && /[A-Za-z0-9_\-.]/.test(input[pos])) {
    name += input[pos++];
  }
  if (!name) throw new Error(`Invalid tag name at position ${pos}.`);
  // Read attributes
  const attributes: Record<string, string> = {};
  while (pos < input.length && input[pos] !== ">" && input[pos] !== "/") {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (input[pos] === ">" || input[pos] === "/") break;
    let attrName = "";
    while (pos < input.length && /[A-Za-z0-9_\-.:]/.test(input[pos])) {
      attrName += input[pos++];
    }
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (input[pos] !== "=") throw new Error(`Expected '=' after attribute '${attrName}' at position ${pos}.`);
    pos++;
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    const quote = input[pos];
    if (quote !== '"' && quote !== "'") throw new Error(`Expected quote at position ${pos}.`);
    pos++;
    let attrVal = "";
    while (pos < input.length && input[pos] !== quote) {
      attrVal += input[pos++];
    }
    pos++; // skip closing quote
    attributes[attrName] = unescapeXml(attrVal);
  }
  // Check for self-closing
  if (input[pos] === "/") {
    pos++;
    if (input[pos] !== ">") throw new Error(`Expected '>' after '/' at position ${pos}.`);
    pos++;
    return { root: { name, attributes, children: [], text: "" }, pos };
  }
  if (input[pos] !== ">") throw new Error(`Expected '>' at position ${pos}.`);
  pos++;
  // Read children + text
  const node: XmlNode = { name, attributes, children: [], text: "" };
  let textBuffer = "";
  while (pos < input.length) {
    if (input[pos] === "<") {
      // CDATA
      if (input.slice(pos, pos + 9) === "<![CDATA[") {
        const end = input.indexOf("]]>", pos);
        if (end < 0) throw new Error("Unterminated CDATA.");
        textBuffer += input.slice(pos + 9, end);
        pos = end + 3;
        continue;
      }
      // Closing tag?
      if (input[pos + 1] === "/") {
        pos += 2;
        let closeName = "";
        while (pos < input.length && /[A-Za-z0-9_\-.]/.test(input[pos])) closeName += input[pos++];
        while (pos < input.length && input[pos] !== ">") pos++;
        pos++;
        if (closeName !== name) throw new Error(`Mismatched closing tag: expected </${name}>, got </${closeName}>.`);
        node.text = textBuffer.trim();
        return { root: node, pos };
      }
      // Flush text as text node
      if (textBuffer.trim()) {
        node.text = textBuffer.trim();
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

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Convert an XML tree back to a JSON value (reverse of jsonToXml). */
export function xmlNodeToJson(node: XmlNode, options: ConvertOptions): unknown {
  const obj: Record<string, unknown> = {};
  // Attributes → @-prefixed keys
  for (const [k, v] of Object.entries(node.attributes)) {
    if (k === "xsi:nil") continue;
    if (k.startsWith("xmlns")) continue;
    if (k === "xsi:type") continue;
    obj[options.attributePrefix + k] = v;
  }
  // Group children by name (arrays for repeated)
  const grouped: Record<string, XmlNode[]> = {};
  for (const child of node.children) {
    if (!grouped[child.name]) grouped[child.name] = [];
    grouped[child.name].push(child);
  }
  for (const [childName, children] of Object.entries(grouped)) {
    const values = children.map((c) => xmlNodeToJson(c, options));
    obj[childName] = values.length === 1 ? values[0] : values;
  }
  // Text content
  if (node.text) {
    if (Object.keys(obj).length === 0) return node.text;
    obj["#text"] = node.text;
  }
  // Empty element with no children/attrs/text → empty string
  if (Object.keys(obj).length === 0) return "";
  return obj;
}

/** Convert XML string to JSON string. */
export function xmlToJson(xml: string, options: ConvertOptions): { ok: true; json: string } | { ok: false; error: string } {
  const parsed = parseXml(xml);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const json = xmlNodeToJson(parsed.root, options);
    return { ok: true, json: JSON.stringify(json, null, options.prettyPrint ? 2 : 0) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-json-xml-history";
const MAX_HISTORY = 10;

export interface ConversionHistoryEntry {
  direction: "json2xml" | "xml2json";
  rootName: string;
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
    root: options.rootName,
    attr: options.attributePrefix,
    item: options.arrayItemName,
    pretty: String(options.prettyPrint),
    indent: String(options.indent),
  });
  if (options.namespace) params.set("ns", options.namespace);
  if (options.namespacePrefix) params.set("nsp", options.namespacePrefix);
  if (options.includeTypeInfo) params.set("type", "1");
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
