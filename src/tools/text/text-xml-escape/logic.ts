/**
 * XML Escape / Unescape — pure conversion logic. No DOM access.
 */
export interface XmlEscapeResult {
  output: string;
  inputLength: number;
  outputLength: number;
  replacements: number;
}

/** XML special character escapes. */
export const XML_ESCAPES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Inverse map for unescaping. */
export const XML_UNESCAPES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
};

const XML_ESCAPE_REGEX = /[<>&"']/g;
const XML_UNESCAPE_REGEX = /&(?:lt|gt|amp|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g;

/** Escape XML special characters. */
export function xmlEscape(input: string, opts: { escapeQuotes: boolean }): XmlEscapeResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, replacements: 0 };
  let count = 0;
  let output: string;
  if (opts.escapeQuotes) {
    output = input.replace(XML_ESCAPE_REGEX, (ch) => {
      count++;
      return XML_ESCAPES[ch]!;
    });
  } else {
    output = input.replace(/[<>&]/g, (ch) => {
      count++;
      return XML_ESCAPES[ch]!;
    });
  }
  return { output, inputLength: input.length, outputLength: output.length, replacements: count };
}

/** Unescape XML entities (named + numeric). */
export function xmlUnescape(input: string): XmlEscapeResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, replacements: 0 };
  let count = 0;
  const output = input.replace(XML_UNESCAPE_REGEX, (ent) => {
    if (XML_UNESCAPES[ent]) { count++; return XML_UNESCAPES[ent]!; }
    // Numeric entity
    const body = ent.slice(1, -1);
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const cp = parseInt(body.slice(2), 16);
      if (!Number.isNaN(cp) && cp >= 0 && cp <= 0x10ffff) {
        try { count++; return String.fromCodePoint(cp); } catch { return ent; }
      }
    } else if (body.startsWith("#")) {
      const cp = parseInt(body.slice(1), 10);
      if (!Number.isNaN(cp) && cp >= 0 && cp <= 0x10ffff) {
        try { count++; return String.fromCodePoint(cp); } catch { return ent; }
      }
    }
    return ent;
  });
  return { output, inputLength: input.length, outputLength: output.length, replacements: count };
}

/** Escape a single character (useful for testing). */
export function escapeChar(ch: string): string {
  return XML_ESCAPES[ch] ?? ch;
}

export function validateInput(input: string): { ok: true } | { error: string } {
  if (typeof input !== "string") return { error: "Input must be a string" };
  return { ok: true };
}
