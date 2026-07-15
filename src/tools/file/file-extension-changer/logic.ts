/**
 * File Extension Changer — pure logic for extension manipulation, validation,
 * and rename plan generation.
 *
 * Pure functions only — no React, no I/O.
 */

export type Mode = "add" | "remove" | "replace";
export type FindMode = "plain" | "regex";
export type CaseMode = "none" | "upper" | "lower";

export interface ExtensionOptions {
  mode: Mode;
  /** For mode=add: the extension to add (without dot, e.g. 'txt'). */
  addExtension: string;
  /** For mode=replace: the extension to find (without dot). */
  findExtension: string;
  /** For mode=replace: the replacement extension (without dot). */
  replaceExtension: string;
  /** Plain or regex find for replace mode. */
  findMode: FindMode;
  /** Case conversion applied to the resulting extension. */
  caseMode: CaseMode;
  /** If true, preserve the original stem; if false, allow regex to match across. */
  preserveStem: boolean;
  /** If true, only change files whose current extension matches the find. */
  onlyIfMatches: boolean;
}

export const DEFAULT_OPTIONS: ExtensionOptions = {
  mode: "add",
  addExtension: "txt",
  findExtension: "",
  replaceExtension: "",
  findMode: "plain",
  caseMode: "none",
  preserveStem: true,
  onlyIfMatches: false,
};

export const EXTENSION_PRESETS: Array<{ label: string; value: string }> = [
  { label: ".txt", value: "txt" },
  { label: ".csv", value: "csv" },
  { label: ".json", value: "json" },
  { label: ".xml", value: "xml" },
  { label: ".html", value: "html" },
  { label: ".md", value: "md" },
  { label: ".log", value: "log" },
  { label: ".tsv", value: "tsv" },
  { label: ".yaml", value: "yaml" },
  { label: ".bin", value: "bin" },
];

export interface FileEntry {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  file: File;
}

export interface RenamePlan {
  original: string;
  renamed: string;
  changed: boolean;
  warning?: string;
  /** Original extension (without dot, '' if none). */
  originalExt: string;
  /** New extension (without dot, '' if none). */
  newExt: string;
}

export interface RenameStats {
  total: number;
  changed: number;
  unchanged: number;
  warnings: number;
}

/** Split filename into stem + extension (last dot wins; leading-dot files have no ext). */
export function splitFilename(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf(".");
  if (i <= 0) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i + 1) };
}

/** Apply case conversion to a string. */
export function applyCase(text: string, mode: CaseMode): string {
  if (mode === "none") return text;
  if (mode === "upper") return text.toUpperCase();
  return text.toLowerCase();
}

/** Validate an extension: must be alphanumeric + dash/underscore, 1-16 chars. */
export function validateExtension(ext: string): { ok: boolean; error?: string } {
  if (!ext) return { ok: false, error: "Extension is empty" };
  if (ext.length > 16) return { ok: false, error: "Extension too long (>16 chars)" };
  if (!/^[a-zA-Z0-9\-_]+$/.test(ext)) return { ok: false, error: "Extension must be alphanumeric, dash, or underscore" };
  return { ok: true };
}

/** Strip leading dot from an extension if present. */
export function normalizeExtension(ext: string): string {
  return ext.replace(/^\.+/, "").trim();
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

/**
 * Compute the new filename for a single file given the options.
 */
export function renameOne(filename: string, options: ExtensionOptions): { renamed: string; originalExt: string; newExt: string } {
  const { stem, ext } = splitFilename(filename);
  let newExt = ext;
  let newStem = stem;

  if (options.mode === "add") {
    // Only add if no extension currently
    if (ext === "") {
      newExt = normalizeExtension(options.addExtension);
    } else if (!options.preserveStem) {
      // Allow regex across whole filename
      newStem = applyFindReplace(stem, options.findExtension, options.replaceExtension, options.findMode);
      newExt = ext;
    }
  } else if (options.mode === "remove") {
    newExt = "";
  } else if (options.mode === "replace") {
    if (options.findMode === "regex") {
      // For regex, apply to the whole extension
      if (ext !== "" || !options.onlyIfMatches) {
        newExt = applyFindReplace(ext, options.findExtension, options.replaceExtension, options.findMode);
        // If regex matched the whole ext away (newExt empty), use replaceExtension
        if (newExt === "" && options.replaceExtension) {
          newExt = normalizeExtension(options.replaceExtension);
        }
      }
    } else {
      // Plain: if findExtension is empty, replace any ext; otherwise match exactly
      const findExt = normalizeExtension(options.findExtension);
      if (findExt === "") {
        // Replace whatever ext is currently there
        newExt = normalizeExtension(options.replaceExtension);
      } else if (ext === findExt || ext.toLowerCase() === findExt.toLowerCase()) {
        newExt = normalizeExtension(options.replaceExtension);
      } else if (options.onlyIfMatches) {
        // Don't change — keep original ext
        newExt = ext;
      }
    }
  }

  // Apply case conversion
  newExt = applyCase(newExt, options.caseMode);

  const renamed = newExt ? `${newStem}.${newExt}` : newStem;
  return { renamed, originalExt: ext, newExt };
}

/**
 * Build a rename plan for all files. Detects collisions and unchanged names.
 */
export function buildRenamePlan(files: FileEntry[], options: ExtensionOptions): { plan: RenamePlan[]; stats: RenameStats } {
  const plan: RenamePlan[] = [];
  const renamedSet = new Set<string>();
  let changed = 0;
  let unchanged = 0;
  let warnings = 0;

  for (const f of files) {
    const { renamed, originalExt, newExt } = renameOne(f.name, options);
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
    if (renamed === "." || /^[.]+$/.test(renamed)) {
      warning = "Filename is only dots";
      warnings++;
    }
    if (isChanged) changed++;
    else unchanged++;

    renamedSet.add(renamed);
    plan.push({ original: f.name, renamed, changed: isChanged, warning, originalExt, newExt });
  }

  return {
    plan,
    stats: { total: plan.length, changed, unchanged, warnings },
  };
}

/** Build a JSON export of the rename plan. */
export function planToJson(plan: RenamePlan[], stats: RenameStats, options: ExtensionOptions): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    options,
    stats,
    plan: plan.map((p) => ({
      original: p.original,
      renamed: p.renamed,
      originalExt: p.originalExt,
      newExt: p.newExt,
      changed: p.changed,
      warning: p.warning,
    })),
  }, null, 2);
}

/** Build a CSV export of the rename plan. */
export function planToCsv(plan: RenamePlan[]): string {
  const header = "original,renamed,original_ext,new_ext,changed,warning";
  const lines = plan.map((p) => {
    const o = p.original.replace(/"/g, '""');
    const r = p.renamed.replace(/"/g, '""');
    const w = (p.warning ?? "").replace(/"/g, '""');
    return `"${o}","${r}","${p.originalExt}","${p.newExt}",${p.changed ? "yes" : "no"},"${w}"`;
  });
  return [header, ...lines].join("\n");
}

/** Build an undo plan: map renamed → original. */
export function buildUndoPlan(plan: RenamePlan[]): RenamePlan[] {
  return plan
    .filter((p) => p.changed)
    .map((p) => ({
      original: p.renamed,
      renamed: p.original,
      changed: true,
      originalExt: p.newExt,
      newExt: p.originalExt,
    }));
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-file-extension-changer-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  changed: number;
  mode: Mode;
  options: ExtensionOptions;
  renamedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
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
export function buildShareUrl(options: ExtensionOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", options.mode);
  params.set("add", options.addExtension);
  params.set("find", options.findExtension);
  params.set("replace", options.replaceExtension);
  params.set("fmode", options.findMode);
  params.set("case", options.caseMode);
  params.set("stem", String(options.preserveStem));
  params.set("match", String(options.onlyIfMatches));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into options. */
export function parseShareUrl(hash: string): Partial<ExtensionOptions> | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const options: Partial<ExtensionOptions> = {};
  if (params.has("mode")) options.mode = params.get("mode") as Mode;
  if (params.has("add")) options.addExtension = params.get("add")!;
  if (params.has("find")) options.findExtension = params.get("find")!;
  if (params.has("replace")) options.replaceExtension = params.get("replace")!;
  if (params.has("fmode")) options.findMode = params.get("fmode") as FindMode;
  if (params.has("case")) options.caseMode = params.get("case") as CaseMode;
  if (params.has("stem")) options.preserveStem = params.get("stem") === "true";
  if (params.has("match")) options.onlyIfMatches = params.get("match") === "true";
  return options;
}
