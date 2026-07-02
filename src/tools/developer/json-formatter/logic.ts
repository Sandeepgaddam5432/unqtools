/**
 * JSON Formatter — pure logic. No DOM access; safe to unit-test and to run
 * inside a Web Worker.
 *
 * Public API:
 *   - formatJson(input, opts): FormatResult  — pretty-print with indent + optional sort
 *   - minifyJson(input): FormatResult        — compact (no whitespace)
 *   - validateJson(input): FormatResult      — parse-only check, returns canonical output
 *   - sortDeep(value): unknown               — recursively sort object keys
 *
 * Error messages include line + column when we can extract them from the
 * native SyntaxError, so the UI can show the user exactly where the JSON broke.
 */

export interface FormatOptions {
  indent: number;
  sortKeys: boolean;
}

export type FormatResult =
  | { ok: true; output: string }
  | { ok: false; error: string; line?: number; column?: number };

/** Threshold above which we route through the Web Worker to keep UI responsive. */
export const WORKER_THRESHOLD_BYTES = 100 * 1024; // 100 KB

/**
 * Recursively sort all object keys in a parsed JSON value.
 * Arrays preserve element order (only objects are sorted).
 */
export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortDeep(obj[k]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Extract a 1-based { line, column } from a V8 JSON.parse SyntaxError message.
 *
 * V8 emits TWO different formats depending on version + error type:
 *   1. "Expected property name or '}' in JSON at position 1 (line 1 column 2)"
 *      → position + line/column both embedded.
 *   2. "Unexpected token 'b', \"...\" is not valid JSON"
 *      → no position; the offending token char is quoted. We find the first
 *        occurrence of that char that V8 would also reject.
 *
 * Returns an empty object if neither pattern matches.
 */
function extractPosition(message: string, input: string): { line?: number; column?: number } {
  // Format 1: explicit "(line L column C)" already in the message.
  const lcMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lcMatch) {
    return { line: Number(lcMatch[1]), column: Number(lcMatch[2]) };
  }

  // Format 1 fallback: "at position N" — compute line/column over the input.
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    if (Number.isFinite(pos) && pos >= 0 && pos <= input.length) {
      let line = 1;
      let column = 1;
      for (let i = 0; i < pos && i < input.length; i++) {
        if (input[i] === "\n") {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
      return { line, column };
    }
  }

  // Format 2: "Unexpected token 'X', ..." — locate the first occurrence of X
  // that isn't valid in a JSON value context. This is a heuristic; we look for
  // the first char that isn't whitespace, brace, bracket, quote, comma, or colon.
  const tokenMatch = message.match(/Unexpected token '(.+?)'/i);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const validJsonChars = new Set([" ", "\t", "\n", "\r", "{", "}", "[", "]", '"', ",", ":"]);
    for (let i = 0; i < input.length; i++) {
      if (!validJsonChars.has(input[i]!) && input.slice(i, i + token.length) === token) {
        let line = 1;
        let column = 1;
        for (let j = 0; j < i; j++) {
          if (input[j] === "\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
        }
        return { line, column };
      }
    }
  }

  return {};
}

/** Pretty-print JSON. Returns a friendly error result on failure. */
export function formatJson(input: string, opts: FormatOptions): FormatResult {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    const parsed = JSON.parse(input);
    const value = opts.sortKeys ? sortDeep(parsed) : parsed;
    return { ok: true, output: JSON.stringify(value, null, opts.indent) };
  } catch (e) {
    const msg = (e as Error).message ?? "Invalid JSON";
    const pos = extractPosition(msg, input);
    return {
      ok: false,
      error: msg.replace(/\s+in JSON at position\s+\d+/i, ""),
      ...pos,
    };
  }
}

/** Strip all optional whitespace — produce the most compact valid JSON. */
export function minifyJson(input: string): FormatResult {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    const parsed = JSON.parse(input);
    return { ok: true, output: JSON.stringify(parsed) };
  } catch (e) {
    const msg = (e as Error).message ?? "Invalid JSON";
    const pos = extractPosition(msg, input);
    return {
      ok: false,
      error: msg.replace(/\s+in JSON at position\s+\d+/i, ""),
      ...pos,
    };
  }
}

/** Parse-only validation. Returns the canonical minified form on success. */
export function validateJson(input: string): FormatResult {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    const parsed = JSON.parse(input);
    return { ok: true, output: JSON.stringify(parsed) };
  } catch (e) {
    const msg = (e as Error).message ?? "Invalid JSON";
    const pos = extractPosition(msg, input);
    return {
      ok: false,
      error: msg.replace(/\s+in JSON at position\s+\d+/i, ""),
      ...pos,
    };
  }
}
