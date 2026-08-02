/** Text Indentation Fixer — pure logic. */

export type IndentStyle = "tabs" | "spaces";
export type NormalizeMode = "none" | "depth";

export interface IndentOptions {
  toStyle: IndentStyle;
  tabWidth?: number; // spaces per tab — used when converting
  normalizeDepth?: NormalizeMode;
  perLineIndent?: number; // for depth normalization, indent units per level
}

export interface IndentResult {
  output: string;
  linesProcessed: number;
  tabsConverted: number;
  spacesConverted: number;
  mixedIndentLines: number;
  warnings: string[];
}

export function detectIndent(input: string): { style: "tabs" | "spaces" | "mixed"; tabWidth: number } {
  const lines = input.split("\n");
  let tabCount = 0;
  let spaceCount = 0;
  const spaceIndentSizes: Record<number, number> = {};
  for (const line of lines) {
    const lead = line.match(/^[ \t]+/)?.[0] ?? "";
    if (!lead) continue;
    if (lead.includes("\t")) tabCount++;
    if (lead.includes(" ")) spaceCount++;
    if (/^[ ]+/.test(lead)) {
      const len = lead.length;
      spaceIndentSizes[len] = (spaceIndentSizes[len] ?? 0) + 1;
    }
  }
  // Find most common gcd-ish tab width
  const sizes = Object.keys(spaceIndentSizes).map(Number).sort((a, b) => spaceIndentSizes[b]! - spaceIndentSizes[a]!);
  const tabWidth = sizes[0] && sizes[0] >= 2 ? Math.min(sizes[0], 8) : 4;
  let style: "tabs" | "spaces" | "mixed" = "spaces";
  if (tabCount > 0 && spaceCount === 0) style = "tabs";
  else if (tabCount > 0 && spaceCount > 0) style = "mixed";
  return { style, tabWidth };
}

export function process(input: string, options: IndentOptions): IndentResult | { error: string } {
  const warnings: string[] = [];
  const tabWidth = options.tabWidth ?? 4;
  if (tabWidth < 1) return { error: "Tab width must be at least 1" };
  let tabsConverted = 0;
  let spacesConverted = 0;
  let mixedIndentLines = 0;
  const lines = input.split("\n");
  const outLines: string[] = [];

  for (const line of lines) {
    const lead = line.match(/^[ \t]+/)?.[0] ?? "";
    if (!lead) { outLines.push(line); continue; }
    if (lead.includes(" ") && lead.includes("\t")) mixedIndentLines++;
    // Expand tabs to spaces first
    let expanded = "";
    let col = 0;
    for (const ch of lead) {
      if (ch === "\t") {
        const spaces = tabWidth - (col % tabWidth);
        expanded += " ".repeat(spaces);
        col += spaces;
        tabsConverted++;
      } else {
        expanded += ch;
        col++;
      }
    }
    let indentUnits: number;
    if (options.normalizeDepth === "depth") {
      // Count "levels" by rounding to nearest tabWidth multiple
      indentUnits = Math.round(expanded.length / tabWidth);
    } else {
      indentUnits = expanded.length / tabWidth;
    }
    let newLead: string;
    if (options.toStyle === "tabs") {
      const fullTabs = Math.floor(indentUnits);
      const extraSpaces = Math.round((indentUnits - fullTabs) * tabWidth);
      newLead = "\t".repeat(fullTabs) + " ".repeat(extraSpaces);
      if (expanded.length > 0) spacesConverted++;
    } else {
      newLead = " ".repeat(Math.round(indentUnits * tabWidth));
    }
    outLines.push(newLead + line.slice(lead.length));
  }

  if (mixedIndentLines > 0) warnings.push(`${mixedIndentLines} line(s) had mixed tabs and spaces.`);
  return {
    output: outLines.join("\n"),
    linesProcessed: lines.length,
    tabsConverted,
    spacesConverted,
    mixedIndentLines,
    warnings,
  };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function normalizeIndentation(
  text: string,
  targetStyle: "tabs" | "spaces" | "2spaces" | "4spaces" = "4spaces",
): { output: string; tabCount: number; spaceCount: number; converted: number } {
  const lines = text.split("\n");
  let tabCount = 0;
  let spaceCount = 0;
  let converted = 0;
  const targetStr = targetStyle === "tabs" ? "\t" : targetStyle === "2spaces" ? "  " : targetStyle === "4spaces" ? "    " : " ";
  const result = lines.map((line) => {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[0] : "";
    if (indent.includes("\t")) tabCount++;
    if (indent.includes(" ")) spaceCount++;
    const newIndent = indent.replace(/\t/g, targetStr);
    if (newIndent !== indent) converted++;
    return newIndent + line.slice(indent.length);
  });
  return { output: result.join("\n"), tabCount, spaceCount, converted };
}

export function detectDominantStyle(text: string): { style: string; confidence: number; tabLines: number; spaceLines: number } {
  const lines = text.split("\n");
  let tabLines = 0;
  let spaceLines = 0;
  for (const line of lines) {
    if (/^\t/.test(line)) tabLines++;
    else if (/^ +/.test(line)) spaceLines++;
  }
  const total = tabLines + spaceLines;
  if (total === 0) return { style: "none", confidence: 1, tabLines: 0, spaceLines: 0 };
  const style = tabLines > spaceLines ? "tabs" : "spaces";
  const confidence = Math.max(tabLines, spaceLines) / total;
  return { style, confidence, tabLines, spaceLines };
}

export function stripIndentation(text: string): string {
  return text.split("\n").map((l) => l.replace(/^\s+/, "")).join("\n");
}

export function reindent(text: string, targetIndent: string = "  "): string {
  const lines = text.split("\n");
  const indentedLines = lines.filter((l) => l.trim().length > 0);
  if (indentedLines.length === 0) return text;
  const minIndent = Math.min(...indentedLines.map((l) => l.match(/^ */)?.[0].length ?? 0));
  return lines.map((line) => {
    if (line.trim().length === 0) return "";
    const currentIndent = line.match(/^ */)?.[0].length ?? 0;
    const stripped = line.slice(Math.min(currentIndent, minIndent));
    return targetIndent + stripped;
  }).join("\n");
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateIndentation(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const { style, confidence, tabLines, spaceLines } = detectDominantStyle(text);
  if (tabLines > 0 && spaceLines > 0) {
    reports.push({ level: "warn", code: "MIXED_INDENT", message: `Mixed indentation: ${tabLines} tab lines, ${spaceLines} space lines.` });
  } else {
    reports.push({ level: "pass", code: "CONSISTENT", message: `Consistent ${style} indentation.` });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-indentation-fixer", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "EditorConfig", citation: "EditorConfig.org", summary: "Standard for consistent coding styles." },
  { id: "Prettier", citation: "Prettier Code Formatter", summary: "Opinionated code formatter." },
];
