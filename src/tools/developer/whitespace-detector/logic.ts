/**
 * Whitespace/Invisible Char Detector — pure logic.
 */
export interface WhitespaceIssue { char: string; name: string; code: number; position: number; line: number; column: number; }
const INVISIBLE_CHARS: Record<number, { name: string; char: string }> = {
  0: { name: "Null", char: "\0" }, 9: { name: "Tab", char: "\t" }, 11: { name: "Vertical Tab", char: "\v" },
  12: { name: "Form Feed", char: "\f" }, 13: { name: "Carriage Return", char: "\r" },
  160: { name: "Non-breaking Space", char: "\u00A0" }, 8203: { name: "Zero-width Space", char: "\u200B" },
  8204: { name: "Zero-width Non-joiner", char: "\u200C" }, 8205: { name: "Zero-width Joiner", char: "\u200D" },
  8239: { name: "Narrow No-break Space", char: "\u202F" }, 8287: { name: "Medium Mathematical Space", char: "\u205F" },
  12288: { name: "Ideographic Space", char: "\u3000" }, 65279: { name: "BOM (Zero-width No-break Space)", char: "\uFEFF" },
  8232: { name: "Line Separator", char: "\u2028" }, 8233: { name: "Paragraph Separator", char: "\u2029" },
};
export function detect(text: string): WhitespaceIssue[] {
  const issues: WhitespaceIssue[] = [];
  let line = 1, col = 1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const info = INVISIBLE_CHARS[code];
    if (info) issues.push({ char: info.char, name: info.name, code, position: i, line, column: col });
    if (text[i] === "\n") { line++; col = 1; } else { col++; }
  }
  return issues;
}
export function cleanWhitespace(text: string, options: { normalizeSpaces: boolean; removeZeroWidth: boolean; removeBom: boolean; normalizeLineEndings: boolean }): string {
  let result = text;
  if (options.removeBom) result = result.replace(/^\uFEFF/, "");
  if (options.removeZeroWidth) result = result.replace(/[\u200B\u200C\u200D]/g, "");
  if (options.normalizeSpaces) { result = result.replace(/[\u00A0\u202F\u205F\u3000]/g, " "); result = result.replace(/[ \t]+/g, " "); }
  if (options.normalizeLineEndings) result = result.replace(/\r\n|\r/g, "\n");
  return result;
}
export function getInvisibleChars(): { name: string; char: string; code: number }[] {
  return Object.entries(INVISIBLE_CHARS).map(([code, info]) => ({ name: info.name, char: info.char, code: parseInt(code) }));
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = detect(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
