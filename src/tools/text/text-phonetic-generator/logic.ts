/**
 * Text Phonetic Generator — text to NATO / International / FAA phonetic alphabet.
 *
 * Includes letters A-Z, digits 0-9, and common punctuation. Provides both
 * compact (space-separated words) and detailed (one char per line) output,
 * along with a pronunciation guide and a per-character breakdown.
 */

export type PhoneticScheme = "nato" | "international" | "faa";

export const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf",
  H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November",
  O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform",
  V: "Victor", W: "Whiskey", X: "X-ray", Y: "Yankee", Z: "Zulu",
  "0": "Zero", "1": "One", "2": "Two", "3": "Three", "4": "Four", "5": "Five",
  "6": "Six", "7": "Seven", "8": "Eight", "9": "Niner",
};

export const INTERNATIONAL: Record<string, string> = { ...NATO };

export const FAA: Record<string, string> = {
  ...NATO,
  "9": "Niner",
  A: "Alpha", // FAA sometimes uses Alpha
};

/** Pronunciation hints for letters with non-obvious pronunciation. */
export const PRONUNCIATION: Record<string, string> = {
  Alfa: "AL-fah",
  Bravo: "BRAH-voh",
  Charlie: "CHAR-lee",
  Delta: "DELL-tah",
  Echo: "ECK-oh",
  Foxtrot: "FOKS-trot",
  Golf: "GOLF",
  Hotel: "hoh-TEL",
  India: "IN-dee-ah",
  Juliett: "JEW-lee-ett",
  Kilo: "KEE-loh",
  Lima: "LEE-mah",
  Mike: "MIKE",
  November: "no-VEM-ber",
  Oscar: "OSS-cah",
  Papa: "pah-PAH",
  Quebec: "keh-BECK",
  Romeo: "ROW-me-oh",
  Sierra: "see-AIR-rah",
  Tango: "TANG-go",
  Uniform: "YOU-nee-form",
  Victor: "VIK-tah",
  Whiskey: "WISS-key",
  "X-ray": "ECKS-ray",
  Yankee: "YANG-key",
  Zulu: "ZOO-loo",
  Zero: "ZEE-roh",
  One: "WUN",
  Two: "TOO",
  Three: "TREE",
  Four: "FOW-er",
  Five: "FIFE",
  Six: "SIX",
  Seven: "SEV-en",
  Eight: "AIT",
  Niner: "NIN-er",
};

export interface PhoneticStats {
  chars: number;
  letters: number;
  digits: number;
  spaces: number;
  otherChars: number;
  scheme: PhoneticScheme;
  durationMs: number;
}

export interface PhoneticBreakdownEntry {
  char: string;
  word: string;
  pronunciation: string | null;
  count: number;
}

/** Get the table for a scheme. */
export function getTable(scheme: PhoneticScheme = "nato"): Record<string, string> {
  return scheme === "faa" ? FAA : scheme === "international" ? INTERNATIONAL : NATO;
}

/** Get the phonetic word for a single character. */
export function phoneticFor(ch: string, scheme: PhoneticScheme = "nato"): string {
  if (!ch) return "";
  const upper = ch.toUpperCase();
  const table = getTable(scheme);
  if (table[upper]) return table[upper]!;
  if (upper === " ") return "(space)";
  if (upper === "\n") return "(newline)";
  if (upper === "\t") return "(tab)";
  return upper;
}

/** Convert full text to phonetic representation, one word per character. */
export function toPhonetic(text: string, scheme: PhoneticScheme = "nato"): string {
  if (!text) return "";
  return Array.from(text).map((ch) => phoneticFor(ch, scheme)).join(" ");
}

/** Convert text to phonetic, grouping words by line, one line per character with its code. */
export function toPhoneticDetailed(text: string, scheme: PhoneticScheme = "nato"): string {
  if (!text) return "";
  return Array.from(text).map((ch) => `${ch === " " ? "·" : ch} → ${phoneticFor(ch, scheme)}`).join("\n");
}

/** Convert to phonetic with pronunciation guide included. */
export function toPhoneticWithPronunciation(text: string, scheme: PhoneticScheme = "nato"): string {
  if (!text) return "";
  return Array.from(text).map((ch) => {
    const word = phoneticFor(ch, scheme);
    const pron = PRONUNCIATION[word];
    return pron ? `${word} (${pron})` : word;
  }).join(" ");
}

/** Batch: process each line. */
export function toPhoneticBatch(inputs: string[], scheme: PhoneticScheme = "nato"): string[] {
  return inputs.map((s) => toPhonetic(s, scheme));
}

export function validateScheme(s: string): { ok: true; scheme: PhoneticScheme } | { error: string } {
  if (["nato", "international", "faa"].includes(s)) return { ok: true, scheme: s as PhoneticScheme };
  return { error: "Unknown scheme" };
}

/** Compute statistics about a phonetic conversion. */
export function computeStats(input: string, scheme: PhoneticScheme = "nato"): PhoneticStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let letters = 0, digits = 0, spaces = 0, otherChars = 0;
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letters++;
    else if (code >= 48 && code <= 57) digits++;
    else if (code === 32) spaces++;
    else otherChars++;
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    letters,
    digits,
    spaces,
    otherChars,
    scheme,
    durationMs: Math.max(0, end - start),
  };
}

/** Per-character breakdown of input → phonetic word. */
export function perCharBreakdown(input: string, scheme: PhoneticScheme = "nato"): PhoneticBreakdownEntry[] {
  if (!input) return [];
  const map = new Map<string, PhoneticBreakdownEntry>();
  for (const ch of input) {
    const word = phoneticFor(ch, scheme);
    const key = ch;
    if (!map.has(key)) {
      map.set(key, {
        char: ch,
        word,
        pronunciation: PRONUNCIATION[word] ?? null,
        count: 0,
      });
    }
    map.get(key)!.count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** List the available phonetic words for display. */
export function listAlphabet(scheme: PhoneticScheme = "nato"): { char: string; word: string; pronunciation: string | null }[] {
  const table = getTable(scheme);
  const keys = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"];
  return keys.map((k) => ({
    char: k,
    word: table[k]!,
    pronunciation: PRONUNCIATION[table[k]!] ?? null,
  }));
}

/** Serialize a per-character breakdown to CSV. */
export function breakdownToCsv(breakdown: PhoneticBreakdownEntry[]): string {
  const lines = ["Char,Word,Pronunciation,Count"];
  for (const e of breakdown) {
    const c = e.char === " " ? "(space)" : e.char === "\n" ? "(newline)" : e.char === "\t" ? "(tab)" : e.char;
    lines.push(`"${c}","${e.word}","${e.pronunciation ?? ""}",${e.count}`);
  }
  return lines.join("\n");
}
