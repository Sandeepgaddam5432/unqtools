/** Text Column Formatter — pure logic. */

export type Alignment = "left" | "right" | "center";

export interface ColumnOptions {
  columns: number;
  width: number;
  separator: string;
  alignment: Alignment;
  fillChar?: string;
  /** Optional header row rendered above the data. */
  header?: string[];
  /** When true, draw a border around the table. */
  border?: boolean;
  /** When true, treat input as CSV (parse quoted fields). */
  csvInput?: boolean;
  /** Custom delimiter for CSV input. Default ",". */
  csvDelimiter?: string;
}

export interface ColumnResult {
  output: string;
  rowsOutput: number;
  columnsUsed: number;
  warnings: string[];
  stats: ColumnStats;
}

export interface ColumnStats {
  totalItems: number;
  rows: number;
  truncated: number;
  padded: number;
  durationMs: number;
}

function pad(str: string, width: number, alignment: Alignment, fillChar: string): { padded: string; truncated: boolean; paddedAdded: number } {
  if (str.length >= width) {
    return { padded: str.slice(0, width), truncated: str.length > width, paddedAdded: 0 };
  }
  const padLen = width - str.length;
  if (alignment === "left") return { padded: str + fillChar.repeat(padLen), truncated: false, paddedAdded: padLen };
  if (alignment === "right") return { padded: fillChar.repeat(padLen) + str, truncated: false, paddedAdded: padLen };
  const left = Math.floor(padLen / 2);
  const right = padLen - left;
  return { padded: fillChar.repeat(left) + str + fillChar.repeat(right), truncated: false, paddedAdded: padLen };
}

/** Parse a CSV line supporting quoted fields with embedded delimiters and newlines. */
export function parseCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Tokenize input into items, optionally using CSV parsing per line. */
export function tokenize(input: string, opts: Pick<ColumnOptions, "csvInput" | "csvDelimiter"> = {}): string[] {
  if (opts.csvInput) {
    const delim = opts.csvDelimiter ?? ",";
    const items: string[] = [];
    for (const line of input.split(/\r?\n/)) {
      if (line.trim() === "") continue;
      for (const f of parseCsvLine(line, delim)) items.push(f);
    }
    return items;
  }
  return input.match(/\S+/g) ?? [];
}

export function process(input: string, options: ColumnOptions): ColumnResult | { error: string } {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const warnings: string[] = [];
  if (options.columns < 1) return { error: "Columns must be at least 1" };
  if (options.width < 1) return { error: "Width must be at least 1" };
  if (!options.separator && !options.border) return { error: "Separator is required (or enable border)" };
  const fillChar = (options.fillChar ?? " ").charAt(0) ?? " ";
  const items = tokenize(input, options);
  if (items.length === 0) {
    warnings.push("No items to format.");
    return { output: "", rowsOutput: 0, columnsUsed: options.columns, warnings, stats: { totalItems: 0, rows: 0, truncated: 0, padded: 0, durationMs: 0 } };
  }

  let truncated = 0;
  let padded = 0;
  const rows: string[] = [];

  const formatRow = (cells: string[]): string => {
    const formatted = cells.map((item) => {
      const r = pad(item, options.width, options.alignment, fillChar);
      if (r.truncated) truncated++;
      if (r.paddedAdded > 0) padded++;
      return r.padded;
    });
    if (options.border) {
      return "│ " + formatted.join(" │ ") + " │";
    }
    return formatted.join(options.separator);
  };

  if (options.header && options.header.length > 0) {
    rows.push(formatRow(options.header));
    const sep = options.border
      ? "├" + Array(options.header.length).fill("─".repeat(options.width + 2)).join("┼") + "┤"
      : options.separator ? Array(options.header.length).fill(options.fillChar ?? " ").join(options.separator) : "";
    if (sep) rows.push(sep);
  }

  for (let i = 0; i < items.length; i += options.columns) {
    const slice = items.slice(i, i + options.columns);
    rows.push(formatRow(slice));
  }

  if (options.border) {
    const top = "┌" + Array(options.columns).fill("─".repeat(options.width + 2)).join("┬") + "┐";
    const bot = "└" + Array(options.columns).fill("─".repeat(options.width + 2)).join("┴") + "┘";
    rows.unshift(top);
    rows.push(bot);
  }

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    output: rows.join("\n"),
    rowsOutput: Math.ceil(items.length / options.columns),
    columnsUsed: options.columns,
    warnings,
    stats: {
      totalItems: items.length,
      rows: Math.ceil(items.length / options.columns),
      truncated,
      padded,
      durationMs: Math.max(0, end - start),
    },
  };
}

/** Convert input items to CSV format (no padding). */
export function toCsv(input: string, options: ColumnOptions): string {
  const items = tokenize(input, options);
  const lines: string[] = [];
  if (options.header && options.header.length > 0) {
    lines.push(options.header.map(escapeCsv).join(","));
  }
  for (let i = 0; i < items.length; i += options.columns) {
    lines.push(items.slice(i, i + options.columns).map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Convert input items to a Markdown table. */
export function toMarkdown(input: string, options: ColumnOptions): string {
  const items = tokenize(input, options);
  const cols = options.columns;
  const header = options.header && options.header.length > 0 ? options.header : Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const lines: string[] = [];
  lines.push("| " + header.map((h) => pad(h, options.width, options.alignment, " ").padded).join(" | ") + " |");
  lines.push("| " + Array(cols).fill("-".repeat(options.width)).join(" | ") + " |");
  for (let i = 0; i < items.length; i += cols) {
    const slice = items.slice(i, i + cols);
    while (slice.length < cols) slice.push("");
    lines.push("| " + slice.map((s) => pad(s, options.width, options.alignment, " ").padded).join(" | ") + " |");
  }
  return lines.join("\n");
}

/** Validate column options. */
export function validateOptions(opts: ColumnOptions): { ok: true } | { error: string } {
  if (opts.columns < 1) return { error: "Columns must be at least 1" };
  if (opts.columns > 20) return { error: "Maximum 20 columns supported" };
  if (opts.width < 1) return { error: "Width must be at least 1" };
  if (opts.width > 200) return { error: "Width must be at most 200" };
  if (!opts.separator && !opts.border) return { error: "Separator is required (or enable border)" };
  return { ok: true };
}
