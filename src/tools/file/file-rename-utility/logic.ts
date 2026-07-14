/**
 * File Rename Utility — pure logic for batch file renaming with pattern rules.
 *
 * Pure functions only — no I/O, no React.
 */

export type CaseConversion = "none" | "upper" | "lower" | "title" | "kebab" | "camel" | "snake";
export type FindMode = "plain" | "regex";
export type SortKey = "name" | "size" | "date" | "none";

export interface RenameOptions {
  /** Find string (plain) or pattern (regex). */
  find: string;
  /** Replacement string (supports $1, $2 for regex capture groups). */
  replace: string;
  /** Whether find is plain text or regex. */
  findMode: FindMode;
  /** Sequential numbering start. */
  numberStart: number;
  /** Sequential numbering padding width. */
  numberPad: number;
  /** Case conversion to apply to the filename stem. */
  caseConversion: CaseConversion;
  /** Prefix to add. */
  prefix: string;
  /** Suffix to add (before extension). */
  suffix: string;
  /** Remove extension (default false). */
  removeExtension: boolean;
  /** Change extension to this value (e.g. 'txt'). Empty = keep. */
  changeExtension: string;
  /** Characters to remove (literal string of chars). */
  removeChars: string;
  /** If true, keep only alphanumeric + dash + underscore. */
  keepAlphanumericOnly: boolean;
  /** Truncate filename stem to this max length (0 = no truncation). */
  maxLength: number;
  /** Naming pattern with placeholders: {name}, {n}, {base}. */
  pattern: string;
  /** Sort key before numbering. */
  sortKey: SortKey;
  /** Sort direction. */
  sortDir: "asc" | "desc";
}

export const DEFAULT_OPTIONS: RenameOptions = {
  find: "",
  replace: "",
  findMode: "plain",
  numberStart: 1,
  numberPad: 3,
  caseConversion: "none",
  prefix: "",
  suffix: "",
  removeExtension: false,
  changeExtension: "",
  removeChars: "",
  keepAlphanumericOnly: false,
  maxLength: 0,
  pattern: "{name}",
  sortKey: "name",
  sortDir: "asc",
};

export interface FileEntry {
  /** Stable id. */
  id: string;
  /** Original filename. */
  name: string;
  /** File size (bytes). */
  size: number;
  /** Last modified (ms). */
  lastModified: number;
  /** Reference to underlying File (for ZIP download). */
  file: File;
}

export interface RenamePlan {
  /** Original filename. */
  original: string;
  /** New filename. */
  renamed: string;
  /** Whether the name actually changed. */
  changed: boolean;
  /** Reason if skipped (e.g. collision). */
  warning?: string;
}

export interface RenameStats {
  total: number;
  changed: number;
  unchanged: number;
  warnings: number;
}

/** Split filename into stem + extension. Handles multi-dot (last dot wins). */
export function splitFilename(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf(".");
  if (i <= 0) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i + 1) };
}

/** Apply case conversion to a string. */
export function applyCase(text: string, mode: CaseConversion): string {
  if (mode === "none") return text;
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  if (mode === "title") return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (mode === "kebab") return text.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
  if (mode === "camel") {
    const parts = text.split(/[\s\-_]+/);
    return parts.map((p, i) => i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
  }
  if (mode === "snake") return text.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s\-]+/g, "_").toLowerCase();
  return text;
}

/** Remove specific characters from a string. */
export function removeCharacters(text: string, chars: string): string {
  if (!chars) return text;
  const set = new Set(chars);
  return Array.from(text).filter((c) => !set.has(c)).join("");
}

/** Keep only alphanumeric + dash + underscore. */
export function keepAlphanumeric(text: string): string {
  return text.replace(/[^a-zA-Z0-9\-_]/g, "");
}

/** Truncate to max length (preserving the stem — extension is kept separate). */
export function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0 || text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

/** Apply find/replace (plain or regex). */
export function applyFindReplace(text: string, find: string, replace: string, mode: FindMode): string {
  if (!find) return text;
  if (mode === "regex") {
    try {
      const re = new RegExp(find, "g");
      return text.replace(re, replace);
    } catch {
      return text;
    }
  }
  return text.split(find).join(replace);
}

/** Pad a number to a given width. */
export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Sort files by key + direction. Returns new array. */
export function sortFiles<T extends { name: string; size: number; lastModified: number }>(files: T[], key: SortKey, dir: "asc" | "desc"): T[] {
  const sorted = [...files];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "size") cmp = a.size - b.size;
    else if (key === "date") cmp = a.lastModified - b.lastModified;
    else return 0;
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/**
 * Compute the new filename for a single file given options + index.
 */
export function renameOne(filename: string, options: RenameOptions, index: number): string {
  const { stem, ext } = splitFilename(filename);
  let newStem = stem;

  // Apply pattern if specified (replaces stem entirely with pattern output)
  if (options.pattern && options.pattern !== "{name}") {
    const numberStr = padNumber(options.numberStart + index, options.numberPad);
    newStem = options.pattern
      .replace(/\{name\}/g, stem)
      .replace(/\{base\}/g, stem)
      .replace(/\{n\}/g, numberStr);
  }

  // Find/replace
  newStem = applyFindReplace(newStem, options.find, options.replace, options.findMode);

  // Remove specific characters
  if (options.removeChars) {
    newStem = removeCharacters(newStem, options.removeChars);
  }

  // Keep only alphanumeric
  if (options.keepAlphanumericOnly) {
    newStem = keepAlphanumeric(newStem);
  }

  // Case conversion
  newStem = applyCase(newStem, options.caseConversion);

  // Prefix + suffix
  newStem = `${options.prefix}${newStem}${options.suffix}`;

  // Truncate (after all other transformations, before extension)
  newStem = truncate(newStem, options.maxLength);

  // Extension handling
  if (options.removeExtension) {
    return newStem;
  }
  if (options.changeExtension) {
    return `${newStem}.${options.changeExtension.replace(/^\./, "")}`;
  }
  return ext ? `${newStem}.${ext}` : newStem;
}

/**
 * Build a rename plan for all files. Detects collisions and unchanged names.
 */
export function buildRenamePlan(files: FileEntry[], options: RenameOptions): { plan: RenamePlan[]; stats: RenameStats } {
  const sorted = sortFiles(files, options.sortKey, options.sortDir);
  const plan: RenamePlan[] = [];
  const renamedSet = new Set<string>();
  let changed = 0;
  let unchanged = 0;
  let warnings = 0;

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const renamed = renameOne(f.name, options, i);
    const isChanged = renamed !== f.name;
    let warning: string | undefined;

    if (renamedSet.has(renamed)) {
      warning = "Name collision — would overwrite another file";
      warnings++;
    }
    if (renamed === "") {
      warning = "Empty filename after rules";
      warnings++;
    }
    if (isChanged) changed++;
    else unchanged++;

    renamedSet.add(renamed);
    plan.push({ original: f.name, renamed, changed: isChanged, warning });
  }

  return {
    plan,
    stats: { total: plan.length, changed, unchanged, warnings },
  };
}

/** Build a JSON export of the rename plan. */
export function planToJson(plan: RenamePlan[], stats: RenameStats): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    stats,
    plan: plan.map((p) => ({ original: p.original, renamed: p.renamed, changed: p.changed, warning: p.warning })),
  }, null, 2);
}

/** Build a CSV export of the rename plan. */
export function planToCsv(plan: RenamePlan[]): string {
  const header = "original,renamed,changed,warning";
  const lines = plan.map((p) => {
    const o = p.original.replace(/"/g, '""');
    const r = p.renamed.replace(/"/g, '""');
    const w = (p.warning ?? "").replace(/"/g, '""');
    return `"${o}","${r}",${p.changed ? "yes" : "no"},"${w}"`;
  });
  return [header, ...lines].join("\n");
}

/** Build an undo plan: map renamed → original. */
export function buildUndoPlan(plan: RenamePlan[]): RenamePlan[] {
  return plan
    .filter((p) => p.changed)
    .map((p) => ({ original: p.renamed, renamed: p.original, changed: true }));
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-file-rename-history";
const MAX_HISTORY = 10;

export interface RenameHistoryEntry {
  fileCount: number;
  changed: number;
  options: RenameOptions;
  renamedAt: string;
}

export function loadHistory(): RenameHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: RenameHistoryEntry): RenameHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL with rename settings (not file list). */
export function buildShareUrl(options: RenameOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("find", options.find);
  params.set("replace", options.replace);
  params.set("mode", options.findMode);
  params.set("case", options.caseConversion);
  params.set("prefix", options.prefix);
  params.set("suffix", options.suffix);
  params.set("pattern", options.pattern);
  params.set("pad", String(options.numberPad));
  params.set("start", String(options.numberStart));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
