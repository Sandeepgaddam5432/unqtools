/**
 * Text File Joiner — pure logic for text joining, stats, dedup, sort.
 *
 * Pure functions operating on plain strings. No DOM, no I/O.
 */

export type SeparatorMode = "newline" | "double" | "custom";

export interface JoinOptions {
  separator: SeparatorMode;
  customSeparator: string;
  addFilenameHeaders: boolean;
  headerPrefix?: string;
  headerSuffix?: string;
  addLineNumbers: boolean;
  numberFormat?: "%d" | "%03d" | "%05d";
  removeEmptyLines: boolean;
  trimWhitespace: boolean;
  sortLines: boolean;
  sortDirection: "asc" | "desc";
  dedupLines: boolean;
}

export interface FileStats {
  filename: string;
  size: number;
  lines: number;
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

export interface JoinedResult {
  text: string;
  totalLines: number;
  totalWords: number;
  totalCharacters: number;
  fileCount: number;
}

/** Compute stats for a single text file. */
export function computeStats(filename: string, size: number, content: string): FileStats {
  const trimmed = content.trim();
  const lines = trimmed === "" ? 0 : trimmed.split(/\r?\n/).length;
  const words = (trimmed.match(/\S+/g) ?? []).length;
  const characters = content.length;
  const charactersNoSpaces = content.replace(/\s/g, "").length;
  return { filename, size, lines, words, characters, charactersNoSpaces };
}

/** Format a line number with the given format. */
export function formatLineNumber(n: number, format: string): string {
  if (format === "%03d") return String(n).padStart(3, "0");
  if (format === "%05d") return String(n).padStart(5, "0");
  return String(n);
}

/** Get the actual separator string from options. */
export function getSeparator(options: JoinOptions): string {
  if (options.separator === "newline") return "\n";
  if (options.separator === "double") return "\n\n";
  return options.customSeparator ?? "";
}

/** Apply per-line transformations: trim, remove empty, sort, dedup, line numbers. */
export function transformText(text: string, options: JoinOptions): string {
  let lines = text.split(/\r?\n/);
  if (options.trimWhitespace) lines = lines.map((l) => l.trim());
  if (options.removeEmptyLines) lines = lines.filter((l) => l !== "");
  if (options.dedupLines) {
    const seen = new Set<string>();
    lines = lines.filter((l) => { if (seen.has(l)) return false; seen.add(l); return true; });
  }
  if (options.sortLines) {
    lines = [...lines].sort((a, b) => options.sortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a));
  }
  if (options.addLineNumbers) {
    const fmt = options.numberFormat ?? "%d";
    lines = lines.map((l, i) => `${formatLineNumber(i + 1, fmt)}\t${l}`);
  }
  return lines.join("\n");
}

/** Merge multiple files into one string. */
export function joinFiles(
  files: Array<{ name: string; content: string }>,
  options: JoinOptions,
): JoinedResult {
  const sep = getSeparator(options);
  const parts: string[] = [];
  let totalLines = 0;
  let totalWords = 0;
  let totalCharacters = 0;

  for (const file of files) {
    let body = file.content;
    // Normalize CRLF → LF for consistent processing
    body = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    body = transformText(body, options);
    const prefix = options.addFilenameHeaders
      ? `${options.headerPrefix ?? ""}${file.name}${options.headerSuffix ?? "\n"}`
      : "";
    parts.push(prefix + body);
    const stats = computeStats(file.name, 0, file.content);
    totalLines += stats.lines;
    totalWords += stats.words;
    totalCharacters += file.content.length;
  }

  const text = parts.join(sep);
  return {
    text,
    totalLines,
    totalWords,
    totalCharacters: text.length,
    fileCount: files.length,
  };
}

/** Preview the first N lines of a merged result. */
export function previewLines(text: string, limit: number = 200): string {
  const lines = text.split("\n");
  if (lines.length <= limit) return text;
  return lines.slice(0, limit).join("\n") + `\n\n... (${lines.length - limit} more lines truncated)`;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Detect a file's likely type from extension. */
export function detectTextType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    txt: "Plain Text",
    log: "Log File",
    md: "Markdown",
    markdown: "Markdown",
    csv: "CSV Data",
    tsv: "TSV Data",
    json: "JSON Data",
    xml: "XML Document",
    html: "HTML Document",
    htm: "HTML Document",
    css: "CSS Stylesheet",
    js: "JavaScript",
    ts: "TypeScript",
    py: "Python",
    sh: "Shell Script",
    yaml: "YAML",
    yml: "YAML",
    ini: "INI Config",
    conf: "Config File",
  };
  return map[ext] ?? "Text File";
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-text-joiner-history";
const MAX_HISTORY = 10;

export interface TextJoinHistoryEntry {
  fileNames: string[];
  separator: SeparatorMode;
  addHeaders: boolean;
  lineNumbers: boolean;
  mergedAt: string;
  totalCharacters: number;
}

export function loadHistory(): TextJoinHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: TextJoinHistoryEntry): TextJoinHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Default options. */
export const DEFAULT_OPTIONS: JoinOptions = {
  separator: "double",
  customSeparator: "\n---\n",
  addFilenameHeaders: true,
  headerPrefix: "",
  headerSuffix: "\n",
  addLineNumbers: false,
  numberFormat: "%d",
  removeEmptyLines: false,
  trimWhitespace: false,
  sortLines: false,
  sortDirection: "asc",
  dedupLines: false,
};
