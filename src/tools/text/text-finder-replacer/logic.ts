/** Text Finder & Replacer — pure logic. */

export interface FindOptions {
  find: string;
  replace: string;
  useRegex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  multiline?: boolean;
}

export interface FindResult {
  output: string;
  matches: number;
  matchLines: number[];
  warnings: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function process(input: string, options: FindOptions): FindResult | { error: string } {
  if (!options.find) return { error: "Find pattern is empty" };
  const warnings: string[] = [];
  let pattern: string;
  try {
    pattern = options.useRegex ? options.find : escapeRegex(options.find);
  } catch (e) {
    return { error: `Invalid pattern: ${(e as Error).message}` };
  }
  if (options.wholeWord) pattern = `\\b${pattern}\\b`;
  let flags = "g";
  if (!options.caseSensitive) flags += "i";
  if (options.multiline) flags += "m";

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    return { error: `Invalid regex: ${(e as Error).message}` };
  }

  const matchLines = new Set<number>();
  let matches = 0;
  try {
    const replaced = input.replace(regex, (match, ...args) => {
      matches++;
      // args layout: [...captureGroups, offset, fullString]
      const offset: number = typeof args[args.length - 2] === "number"
        ? (args[args.length - 2] as number)
        : 0;
      const before = input.slice(0, offset);
      const line = before.split("\n").length;
      matchLines.add(line);
      return options.replace.replace(/\$0/g, match).replace(/\$(\d+)/g, (_, n) => args[Number(n) - 1] ?? "");
    });
    if (matches === 0) warnings.push("No matches found.");
    return { output: replaced, matches, matchLines: [...matchLines].sort((a, b) => a - b), warnings };
  } catch (e) {
    return { error: `Replace failed: ${(e as Error).message}` };
  }
}

export interface BatchRow {
  input: string;
  result: FindResult | { error: string };
}

export function batchProcess(inputs: string[], options: FindOptions): BatchRow[] {
  return inputs.map((input) => ({ input, result: process(input, options) }));
}

export function batchToCsv(rows: BatchRow[]): string {
  const lines = ["Input,Output,Matches"];
  for (const row of rows) {
    const out = "error" in row.result ? "" : row.result.output;
    const matches = "error" in row.result ? 0 : row.result.matches;
    const ein = `"${row.input.replace(/"/g, '""')}"`;
    const eout = `"${out.replace(/"/g, '""')}"`;
    lines.push(`${ein},${eout},${matches}`);
  }
  return lines.join("\n");
}
