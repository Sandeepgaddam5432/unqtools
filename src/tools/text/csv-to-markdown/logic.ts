/** CSV to Markdown Table — pure logic. RFC-4180-aware CSV parser + GFM table generator. */

export interface CsvToMarkdownOptions {
  hasHeader: boolean;
  alignments: ("left" | "center" | "right" | "none")[];
  output: "gfm" | "html" | "jira";
}

export const DEFAULT_OPTIONS: CsvToMarkdownOptions = {
  hasHeader: true,
  alignments: [],
  output: "gfm",
};

/** Parse RFC-4180 CSV into rows of cells. Handles quoted fields, escaped quotes, CRLF. */
export function parseCSV(text: string, delimiter: string = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
      continue;
    }
    if (char === "\n" || char === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

function escapePipe(cell: string): string {
  return cell.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function toMarkdown(csv: string, opts: CsvToMarkdownOptions): string {
  const rows = parseCSV(csv);
  if (rows.length === 0) return "";
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const maxCols = Math.max(...rows.map((r) => r.length));
  const aligns = Array.from({ length: maxCols }, (_, i) => o.alignments[i] ?? "none");

  if (o.output === "html") return toHTML(rows, opts);
  if (o.output === "jira") return toJira(rows, opts);

  // GFM
  const header = rows[0]!;
  const body = o.hasHeader ? rows.slice(1) : rows;
  const headerRow = header
    .map((_, i) => rows[0]![i] ?? "")
    .map(escapePipe)
    .join(" | ");
  const alignRow = aligns
    .map((a) => {
      if (a === "left") return ":---";
      if (a === "center") return ":---:";
      if (a === "right") return "---:";
      return "---";
    })
    .join(" | ");
  const bodyRows = body.map((r) =>
    Array.from({ length: maxCols }, (_, i) => escapePipe(r[i] ?? "")).join(" | "),
  );
  return [`| ${headerRow} |`, `| ${alignRow} |`, ...bodyRows.map((r) => `| ${r} |`)].join("\n");
}

function toHTML(rows: string[][], opts: CsvToMarkdownOptions): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const header = rows[0]!;
  const body = opts.hasHeader ? rows.slice(1) : rows;
  const th = header.map((c) => `  <th>${esc(c)}</th>`).join("\n");
  const trs = body
    .map((r) => `  <tr>\n${r.map((c) => `    <td>${esc(c)}</td>`).join("\n")}\n  </tr>`)
    .join("\n");
  return `<table>\n<thead>\n<tr>\n${th}\n</tr>\n</thead>\n<tbody>\n${trs}\n</tbody>\n</table>`;
}

function toJira(rows: string[][], opts: CsvToMarkdownOptions): string {
  const header = rows[0]!;
  const body = opts.hasHeader ? rows.slice(1) : rows;
  const maxCols = Math.max(...rows.map((r) => r.length));
  const headerRow = header.map((_, i) => rows[0]![i] ?? "").join(" || ");
  const bodyRows = body.map((r) =>
    Array.from({ length: maxCols }, (_, i) => r[i] ?? "").join(" | "),
  );
  return [`|| ${headerRow} ||`, ...bodyRows.map((r) => `| ${r} |`)].join("\n");
}
