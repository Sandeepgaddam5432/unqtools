/**
 * Regex Replace — pure logic.
 */
export interface ReplaceOptions { flags: string; replacement: string; useFunction: boolean; }
export function regexReplace(text: string, pattern: string, options: ReplaceOptions): { output: string; matchCount: number; error?: string } {
  try {
    const regex = new RegExp(pattern, options.flags);
    if (options.useFunction) {
      let count = 0;
      const output = text.replace(regex, (...args) => { count++; return options.replacement.replace(/\$(\d+)/g, (_, n) => args[parseInt(n)] || ""); });
      return { output, matchCount: count };
    }
    const matches = text.match(new RegExp(pattern, options.flags.includes("g") ? options.flags : options.flags + "g"));
    const output = text.replace(regex, options.replacement);
    return { output, matchCount: matches ? matches.length : 0 };
  } catch (e) { return { output: text, matchCount: 0, error: e instanceof Error ? e.message : "Invalid regex" }; }
}
export function escapeRegex(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export function validateRegex(pattern: string, flags: string): { valid: boolean; error?: string } {
  try { new RegExp(pattern, flags); return { valid: true }; } catch (e) { return { valid: false, error: e instanceof Error ? e.message : "Invalid" }; }
}
export function getCommonPatterns(): { name: string; pattern: string; description: string }[] {
  return [
    { name: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", description: "Match email addresses" },
    { name: "URL", pattern: "https?://[\\w.-]+(?:\\.[\\w.-]+)+[\\w._~:/?#@!$&'()*+,;=-]*", description: "Match URLs" },
    { name: "Phone", pattern: "\\+?\\d{1,4}?[-.\\s]?\\(?\\d{1,3}?\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}", description: "Match phone numbers" },
    { name: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", description: "Match IPv4 addresses" },
    { name: "Date (YYYY-MM-DD)", pattern: "\\d{4}-\\d{2}-\\d{2}", description: "Match ISO dates" },
  ];
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
    const result = validateRegex(input);
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
