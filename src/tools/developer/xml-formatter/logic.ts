/**
 * XML Formatter — pure logic. No DOM access.
 *
 * Public API:
 *   - formatXml(input, indent): FormatResult   — pretty-print
 *   - minifyXml(input): FormatResult           — collapse whitespace
 *   - validateXml(input): FormatResult         — well-formedness + error location
 */

export type FormatResult =
  | { ok: true; output: string; stats: { lines: number; bytes: number; chars: number } }
  | { ok: false; error: string; line?: number; column?: number };

function statsOf(s: string) {
  return {
    lines: s.split("\n").length,
    bytes: new TextEncoder().encode(s).length,
    chars: s.length,
  };
}

/** Validate well-formedness with a lightweight scanner (no DOMParser in node tests). */
export function validateXml(input: string): FormatResult {
  if (!input || !input.trim()) {
    return { ok: false, error: "XML is empty." };
  }
  const trimmed = input.trim();
  // Check for a single root element.
  const rootMatches = trimmed.match(/<([A-Za-z_][\w:.-]*)(?:\s[^>]*)?(?:\/>|>|$)/);
  if (!rootMatches) {
    return { ok: false, error: "No root element found." };
  }
  // Use a real parser if available (browser). In node tests, use a scanner.
  try {
    // @ts-ignore - DOMParser may not exist in node
    if (typeof DOMParser !== "undefined") {
      // @ts-ignore
      const doc = new DOMParser().parseFromString(trimmed, "text/xml");
      const err = doc.querySelector("parsererror");
      if (err) {
        const msg = (err.textContent ?? "XML parse error").trim();
        return { ok: false, error: msg.slice(0, 200) };
      }
      return { ok: true, output: trimmed, stats: statsOf(trimmed) };
    }
  } catch {
    // fall through to scanner
  }
  // Lightweight scanner fallback: check tag balance.
  const stack: string[] = [];
  const tagRe = /<\/?([A-Za-z_][\w:.-]*)((?:\s[^<>]*?)?)(\/?)>/g;
  let m: RegExpExecArray | null;
  let line = 1;
  let col = 1;
  while ((m = tagRe.exec(trimmed)) !== null) {
    const before = trimmed.slice(0, m.index);
    line = before.split("\n").length;
    col = m.index - before.lastIndexOf("\n");
    const name = m[1];
    const selfClose = m[3] === "/";
    if (m[0].startsWith("</")) {
      const open = stack.pop();
      if (open !== name) {
        return {
          ok: false,
          error: `Mismatched closing tag </${name}> (expected </${open ?? "?"}>)`,
          line,
          column: col,
        };
      }
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  if (stack.length > 0) {
    return { ok: false, error: `Unclosed tag <${stack[stack.length - 1]}>`, line, column: col };
  }
  return { ok: true, output: trimmed, stats: statsOf(trimmed) };
}

/** Tokenize into elements/text/comments so we can re-indent safely. */
function tokenize(input: string): string[] {
  const re =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[^>]*>|[^<]+/g;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(input)) !== null) {
    if (m[0].length) tokens.push(m[0]);
    last = re.lastIndex;
    // Safety: if no progress, break to avoid an infinite loop.
    if (re.lastIndex === 0) break;
  }
  return tokens;
}

function isOpeningTag(t: string): boolean {
  return /^<[^/?][^>]*[^/]>$/.test(t) || (/^<[A-Za-z_][^>]*>$/.test(t) && !/\/>$/.test(t));
}
function isClosingTag(t: string): boolean {
  return /^<\//.test(t);
}
function isSelfClosing(t: string): boolean {
  return /\/>$/.test(t) && !/^<\//.test(t);
}
function isCommentOrPI(t: string): boolean {
  return /^<!--/.test(t) || /^<\?/.test(t);
}
function isCData(t: string): boolean {
  return /^<!\[CDATA\[/.test(t);
}

/** Pretty-print XML with the given indent (spaces per level). */
export function formatXml(input: string, indentSize = 2): FormatResult {
  const v = validateXml(input);
  if (!v.ok) return v;
  const indent = " ".repeat(indentSize);
  const tokens = tokenize(input);
  let depth = 0;
  let out = "";
  for (const t of tokens) {
    const text = t.trim();
    if (!text) continue;
    if (isClosingTag(text)) {
      depth = Math.max(0, depth - 1);
      out += indent.repeat(depth) + text + "\n";
    } else if (isSelfClosing(text)) {
      out += indent.repeat(depth) + text + "\n";
    } else if (isCommentOrPI(text) || isCData(text)) {
      out += indent.repeat(depth) + text + "\n";
    } else if (isOpeningTag(text)) {
      out += indent.repeat(depth) + text + "\n";
      depth++;
    } else {
      // text content — inline
      out += indent.repeat(depth) + text + "\n";
    }
  }
  const result = out.replace(/\n+$/g, "");
  return { ok: true, output: result, stats: statsOf(result) };
}

/** Collapse to compact (no inter-tag whitespace). */
export function minifyXml(input: string): FormatResult {
  const v = validateXml(input);
  if (!v.ok) return v;
  const compact = input
    .replace(/<!--[\s\S]*?-->/g, (m) => m)
    .replace(/>\s+</g, "><")
    .replace(/\s+>/g, ">")
    .replace(/<\s+/g, "<")
    .trim();
  return { ok: true, output: compact, stats: statsOf(compact) };
}
