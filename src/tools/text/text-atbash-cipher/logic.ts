/**
 * Atbash Cipher — pure logic.
 *
 * Mirrors the alphabet: A↔Z, B↔Y, ..., M↔N. Equivalent to (25 - char).
 * Atbash is its own inverse — applying it twice restores the original.
 * Supports both the standard Latin alphabet and a user-supplied custom alphabet.
 */

export interface AtbashOptions {
  /** Optional custom alphabet (must contain each letter exactly once; case-insensitive). */
  alphabet?: string;
  /** When true (default), preserve non-alphabet characters verbatim. */
  preserveNonAlpha?: boolean;
  /** When true (default), preserve case of the original letters. */
  preserveCase?: boolean;
}

export interface AtbashStats {
  chars: number;
  lettersMirrored: number;
  preserved: number;
  durationMs: number;
}

export interface AtbashHistoryEntry {
  ts: number;
  input: string;
  output: string;
}

export const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Validate a custom alphabet. Must contain 26 unique A-Z letters (case-insensitive). */
export function validateAlphabet(alphabet: string | undefined): { ok: true; alphabet: string } | { error: string } {
  if (!alphabet) return { ok: true, alphabet: DEFAULT_ALPHABET };
  const upper = alphabet.toUpperCase().replace(/\s+/g, "");
  if (upper.length !== 26) return { error: "Alphabet must be exactly 26 letters." };
  const seen = new Set<string>();
  for (const ch of upper) {
    if (ch < "A" || ch > "Z") return { error: `Alphabet contains non-letter: ${ch}` };
    if (seen.has(ch)) return { error: `Alphabet contains duplicate: ${ch}` };
    seen.add(ch);
  }
  return { ok: true, alphabet: upper };
}

/** Mirror a single character using Atbash. */
export function atbashChar(char: string, opts: AtbashOptions = {}): string {
  const v = validateAlphabet(opts.alphabet);
  if ("error" in v) return char;
  const alphabet = v.alphabet;
  const code = char.charCodeAt(0);
  const isUpper = code >= 65 && code <= 90;
  const isLower = code >= 97 && code <= 122;
  if (!isUpper && !isLower) {
    return opts.preserveNonAlpha === false ? "" : char;
  }
  const upper = isUpper ? char : char.toUpperCase();
  const idx = alphabet.indexOf(upper);
  if (idx < 0) return opts.preserveNonAlpha === false ? "" : char;
  const mirrored = alphabet[25 - idx]!;
  if (opts.preserveCase === false) return mirrored;
  return isLower ? mirrored.toLowerCase() : mirrored;
}

/** Apply Atbash to a string. Atbash is its own inverse. */
export function atbash(text: string, opts: AtbashOptions = {}): string {
  if (!text) return "";
  return Array.from(text).map((c) => atbashChar(c, opts)).join("");
}

/** Convenience aliases — same operation either way. */
export function encrypt(text: string, opts: AtbashOptions = {}): string {
  return atbash(text, opts);
}

export function decrypt(text: string, opts: AtbashOptions = {}): string {
  return atbash(text, opts);
}

/** Build the atbash mapping table for display. */
export function atbashTable(alphabet: string = DEFAULT_ALPHABET): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (let i = 0; i < alphabet.length; i++) {
    const from = alphabet[i]!;
    const to = alphabet[alphabet.length - 1 - i]!;
    out.push({ from, to });
  }
  return out;
}

/** Run Atbash over multiple inputs (batch mode). */
export function atbashBatch(inputs: string[], opts: AtbashOptions = {}): string[] {
  return inputs.map((s) => atbash(s, opts));
}

/** Compute statistics about an Atbash operation. */
export function computeStats(input: string, opts: AtbashOptions = {}): AtbashStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let lettersMirrored = 0;
  let preserved = 0;
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      lettersMirrored++;
    } else {
      preserved++;
    }
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    lettersMirrored,
    preserved,
    durationMs: Math.max(0, end - start),
  };
}

/** Detect whether a string contains any letters that would be mirrored. */
export function hasMirrors(input: string): boolean {
  return /[A-Za-z]/.test(input);
}

/** Serialize history entries to CSV. */
export function historyToCsv(history: AtbashHistoryEntry[]): string {
  const lines = ["Timestamp,Input,Output"];
  for (const h of history) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    lines.push(`${new Date(h.ts).toISOString()},${esc(h.input)},${esc(h.output)}`);
  }
  return lines.join("\n");
}

/** Format a single history entry for display. */
export function formatHistoryEntry(entry: AtbashHistoryEntry): string {
  const out = entry.output.slice(0, 60);
  return `${new Date(entry.ts).toLocaleString()} → ${out}${entry.output.length > 60 ? "…" : ""}`;
}
