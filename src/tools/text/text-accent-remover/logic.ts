/**
 * Text Accent Remover — strip diacritics via NFD normalize + removing combining marks.
 *
 * Uses Unicode NFD normalization to decompose accented characters into their
 * base + combining mark form, then strips the combining marks (U+0300-U+036F).
 * Also supports per-character breakdowns for inspection and a "keep common"
 * mode that preserves frequently-used diacritics.
 */

export type StripMode = "all" | "keep-common";

export interface AccentRemovalOptions {
  /** Strip all marks vs keep commonly-used ones (ñ, ü in German, etc.). */
  mode?: StripMode;
  /** When true, also normalize whitespace. Default false. */
  normalizeWhitespace?: boolean;
}

export interface AccentRemovalStats {
  chars: number;
  accentsRemoved: number;
  charsAffected: number;
  mode: StripMode;
  durationMs: number;
}

export interface AccentBreakdownEntry {
  /** Original character (or character + combining mark pair). */
  original: string;
  /** Base character after stripping. */
  base: string;
  /** Combining marks removed. */
  marks: string[];
  count: number;
}

/** Unicode range for combining diacritical marks (U+0300..U+036F). */
export const COMBINING_RANGE = /[\u0300-\u036f]/g;

/** Combining marks considered "common" and preserved in keep-common mode. */
export const COMMON_MARKS = new Set([
  "\u0303", // tilde (ñ, ã)
  "\u0308", // diaeresis (ü, ë)
]);

/** Common accented characters and their base letters (for breakdown display). */
const COMMON_ACCENTED: Record<string, string> = {
  "á": "a", "à": "a", "â": "a", "ä": "a", "ã": "a", "å": "a", "æ": "ae",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "í": "i", "ì": "i", "î": "i", "ï": "i",
  "ó": "o", "ò": "o", "ô": "o", "ö": "o", "õ": "o", "ø": "o",
  "ú": "u", "ù": "u", "û": "u", "ü": "u",
  "ý": "y", "ÿ": "y",
  "ñ": "n",
  "ç": "c",
  "š": "s", "ž": "z",
  "Á": "A", "À": "A", "Â": "A", "Ä": "A", "Ã": "A", "Å": "A", "Æ": "AE",
  "É": "E", "È": "E", "Ê": "E", "Ë": "E",
  "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
  "Ó": "O", "Ò": "O", "Ô": "O", "Ö": "O", "Õ": "O", "Ø": "O",
  "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
  "Ý": "Y", "Ÿ": "Y",
  "Ñ": "N",
  "Ç": "C",
  "Š": "S", "Ž": "Z",
};

/** Remove diacritics from a string by NFD-normalizing and stripping combining marks. */
export function removeAccents(input: string, opts: AccentRemovalOptions = {}): string {
  if (!input) return "";
  const mode = opts.mode ?? "all";
  let normalized = input.normalize("NFD");
  if (mode === "keep-common") {
    // Strip everything except common marks
    normalized = normalized.replace(/[\u0300-\u036f]/g, (m) => (COMMON_MARKS.has(m) ? m : ""));
  } else {
    normalized = normalized.replace(COMBINING_RANGE, "");
  }
  if (opts.normalizeWhitespace) {
    normalized = normalized.replace(/\s+/g, " ").trim();
  }
  // Re-compose to NFC so precomposed characters (e.g. ñ) are restored when possible.
  return normalized.normalize("NFC");
}

/** Batch: process each line, returning the cleaned array. */
export function removeAccentsBatch(inputs: string[], opts: AccentRemovalOptions = {}): string[] {
  return inputs.map((s) => removeAccents(s, opts));
}

/** Detect whether the string contains any combining diacritical marks. */
export function hasAccents(input: string): boolean {
  if (!input) return false;
  return /[\u0300-\u036f]/.test(input.normalize("NFD"));
}

/** Count the number of combining marks that would be removed. */
export function countAccentsRemoved(input: string, opts: AccentRemovalOptions = {}): number {
  if (!input) return 0;
  const normalized = input.normalize("NFD");
  const mode = opts.mode ?? "all";
  let count = 0;
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      if (mode === "all" || !COMMON_MARKS.has(ch)) count++;
    }
  }
  return count;
}

/** Remove accents but preserve case of the original letters. */
export function removeAccentsPreserveCase(input: string, opts: AccentRemovalOptions = {}): string {
  return removeAccents(input, opts);
}

/** Compute statistics about an accent-removal operation. */
export function computeStats(input: string, opts: AccentRemovalOptions = {}): AccentRemovalStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const removed = countAccentsRemoved(input, opts);
  let charsAffected = 0;
  const seen = new Set<string>();
  for (const ch of input.normalize("NFD")) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      if (!seen.has(ch)) {
        charsAffected++;
        seen.add(ch);
      }
    }
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    accentsRemoved: removed,
    charsAffected,
    mode: opts.mode ?? "all",
    durationMs: Math.max(0, end - start),
  };
}

/** Per-character breakdown: for each accented input char, show its base + marks. */
export function perCharBreakdown(input: string): AccentBreakdownEntry[] {
  if (!input) return [];
  const entries: AccentBreakdownEntry[] = [];
  const map = new Map<string, AccentBreakdownEntry>();
  for (const ch of input) {
    const decomposed = ch.normalize("NFD");
    const base = decomposed[0]!;
    const marks = decomposed.length > 1 ? Array.from(decomposed.slice(1)) : [];
    if (marks.length === 0 && !COMMON_ACCENTED[ch]) continue;
    const key = ch;
    if (!map.has(key)) {
      const entry: AccentBreakdownEntry = {
        original: ch,
        base: COMMON_ACCENTED[ch] ?? base,
        marks,
        count: 0,
      };
      map.set(key, entry);
      entries.push(entry);
    }
    map.get(key)!.count++;
  }
  return entries.sort((a, b) => b.count - a.count);
}

/** List all distinct accented characters present in the input. */
export function listAccentedChars(input: string): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  for (const ch of input) {
    if (COMMON_ACCENTED[ch]) seen.add(ch);
  }
  return [...seen];
}

/** Serialize a per-character breakdown to CSV. */
export function breakdownToCsv(breakdown: AccentBreakdownEntry[]): string {
  const lines = ["Original,Base,Marks,Count"];
  for (const e of breakdown) {
    const marks = e.marks.length ? e.marks.map((m) => `U+${m.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" ") : "";
    lines.push(`"${e.original}","${e.base}","${marks}",${e.count}`);
  }
  return lines.join("\n");
}
