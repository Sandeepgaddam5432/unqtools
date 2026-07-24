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
