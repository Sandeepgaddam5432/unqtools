/**
 * Text Phonetic Generator — text to NATO / International / FAA phonetic alphabet.
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

/** Get the phonetic word for a single character. */
export function phoneticFor(ch: string, scheme: PhoneticScheme = "nato"): string {
  if (!ch) return "";
  const upper = ch.toUpperCase();
  const table = scheme === "faa" ? FAA : scheme === "international" ? INTERNATIONAL : NATO;
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

export function validateScheme(s: string): { ok: true; scheme: PhoneticScheme } | { error: string } {
  if (["nato", "international", "faa"].includes(s)) return { ok: true, scheme: s as PhoneticScheme };
  return { error: "Unknown scheme" };
}
