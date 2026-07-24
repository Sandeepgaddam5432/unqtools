/** Text Column Formatter — pure logic. */

export type Alignment = "left" | "right" | "center";

export interface ColumnOptions {
  columns: number;
  width: number;
  separator: string;
  alignment: Alignment;
  fillChar?: string;
}

export interface ColumnResult {
  output: string;
  rowsOutput: number;
  warnings: string[];
}

function pad(str: string, width: number, alignment: Alignment, fillChar: string): string {
  if (str.length >= width) return str.slice(0, width);
  const padLen = width - str.length;
  if (alignment === "left") return str + fillChar.repeat(padLen);
  if (alignment === "right") return fillChar.repeat(padLen) + str;
  const left = Math.floor(padLen / 2);
  const right = padLen - left;
  return fillChar.repeat(left) + str + fillChar.repeat(right);
}

export function process(input: string, options: ColumnOptions): ColumnResult | { error: string } {
  const warnings: string[] = [];
  if (options.columns < 1) return { error: "Columns must be at least 1" };
  if (options.width < 1) return { error: "Width must be at least 1" };
  if (!options.separator) return { error: "Separator is required" };
  const fillChar = (options.fillChar ?? " ").charAt(0) ?? " ";
  const items = (input.match(/\S+/g) ?? []);
  if (items.length === 0) {
    warnings.push("No items to format.");
    return { output: "", rowsOutput: 0, warnings };
  }
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += options.columns) {
    const row = items.slice(i, i + options.columns)
      .map((item) => pad(item, options.width, options.alignment, fillChar));
    rows.push(row.join(options.separator));
  }
  return { output: rows.join("\n"), rowsOutput: rows.length, warnings };
}

export function toCsv(input: string, options: ColumnOptions): string {
  const items = input.match(/\S+/g) ?? [];
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += options.columns) {
    lines.push(items.slice(i, i + options.columns).join(","));
  }
  return lines.join("\n");
}
