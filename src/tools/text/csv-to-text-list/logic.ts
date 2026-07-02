/** CSV to Text List — pure logic. Convert CSV to a flat text list with column selection, dedupe, wrapping. */
import { parseCSV } from "../csv-to-markdown/logic";

export interface CsvToListOptions {
  column: number; // 0-indexed; -1 = all columns flattened
  delimiter: string; // output join delimiter
  quote: string; // wrap each item
  prefix: string;
  suffix: string;
  dedupe: boolean;
  caseSensitive: boolean;
  trim: boolean;
  skipEmpty: boolean;
}

export const DEFAULT_OPTIONS: CsvToListOptions = {
  column: 0,
  delimiter: "\n",
  quote: "",
  prefix: "",
  suffix: "",
  dedupe: false,
  caseSensitive: true,
  trim: false,
  skipEmpty: false,
};

export function csvToList(csv: string, opts: CsvToListOptions): string {
  if (!csv.trim()) return "";
  const rows = parseCSV(csv);
  if (rows.length === 0) return "";
  const o = { ...DEFAULT_OPTIONS, ...opts };

  let items: string[];
  if (o.column < 0) {
    // Flatten all columns
    items = rows.flat();
  } else {
    items = rows.map((r) => r[o.column] ?? "");
  }

  if (o.trim) items = items.map((s) => s.trim());
  if (o.skipEmpty) items = items.filter((s) => s !== "");
  if (o.dedupe) {
    const seen = new Set<string>();
    items = items.filter((s) => {
      const key = o.caseSensitive ? s : s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const wrapped = items.map((s) => `${o.prefix}${o.quote}${s}${o.quote}${o.suffix}`);
  return wrapped.join(o.delimiter);
}

export function getColumnCount(csv: string): number {
  const rows = parseCSV(csv);
  return rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0;
}
