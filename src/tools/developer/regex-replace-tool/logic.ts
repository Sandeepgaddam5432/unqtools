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
