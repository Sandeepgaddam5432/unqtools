/**
 * Text Mirror Generator — pure logic. No DOM access.
 *
 * Horizontal mirror = reverse the character sequence (right-to-left).
 * Vertical mirror = map each character to its upside-down Unicode
 * equivalent and reverse the line order.
 */

/** Map of normal → upside-down Unicode characters (vertical mirror). */
const UPSIDE_DOWN: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ",
  j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ",
  s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "B", C: "Ɔ", D: "D", E: "Ǝ", F: "Ⅎ", G: "⅁", H: "H", I: "I",
  J: "ɾ", K: "ʞ", L: "˥", M: "W", N: "N", O: "O", P: "Ԁ", Q: "Ò", R: "ɹ",
  S: "S", T: "┴", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ",
  "8": "8", "9": "6", "0": "0",
  ".": "˙", ",": "'", "'": ",", "\"": ",,", "?": "¿", "!": "¡",
  "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{",
  "<": ">", ">": "<", "&": "⅋", "_": "‾",
};

export type MirrorMode = "horizontal" | "vertical" | "both";

export interface MirrorStats {
  chars: number;
  lines: number;
  charsMirrored: number;
  mode: MirrorMode;
  durationMs: number;
}

/** Map a single character to its upside-down equivalent. */
export function mirrorChar(ch: string): string {
  return UPSIDE_DOWN[ch] ?? ch;
}

/** Build the character map for display. */
export function characterMap(): { from: string; to: string }[] {
  return Object.entries(UPSIDE_DOWN).map(([from, to]) => ({ from, to }));
}

/** Horizontal mirror — reverse character sequence. */
export function mirrorHorizontal(text: string): string {
  if (!text) return "";
  return Array.from(text).reverse().join("");
}

/** Vertical mirror — upside-down unicode + reverse line order. */
export function mirrorVertical(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  return lines
    .slice()
    .reverse()
    .map((line) => Array.from(line).map(mirrorChar).reverse().join(""))
    .join("\n");
}

/** Both mirrors applied — horizontal then vertical. */
export function mirrorBoth(text: string): string {
  return mirrorVertical(mirrorHorizontal(text));
}

/** Dispatch by mode. */
export function applyMirror(text: string, mode: MirrorMode): string {
  if (mode === "horizontal") return mirrorHorizontal(text);
  if (mode === "vertical") return mirrorVertical(text);
  return mirrorBoth(text);
}

/** Batch: process each line independently. */
export function applyMirrorBatch(inputs: string[], mode: MirrorMode): string[] {
  return inputs.map((s) => applyMirror(s, mode));
}

/** Compute statistics about a mirror operation. */
export function computeStats(input: string, mode: MirrorMode): MirrorStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const lines = input ? input.split("\n").length : 0;
  let charsMirrored = 0;
  if (mode === "vertical" || mode === "both") {
    for (const ch of input) {
      if (UPSIDE_DOWN[ch]) charsMirrored++;
    }
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    lines,
    charsMirrored,
    mode,
    durationMs: Math.max(0, end - start),
  };
}

/** List characters in the input that have upside-down equivalents. */
export function listMirrorableChars(input: string): string[] {
  const seen = new Set<string>();
  for (const ch of input) {
    if (UPSIDE_DOWN[ch]) seen.add(ch);
  }
  return [...seen];
}

/** Per-character breakdown of input → mirrored output. */
export function perCharBreakdown(input: string): { char: string; mirrored: string }[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: { char: string; mirrored: string }[] = [];
  for (const ch of input) {
    if (UPSIDE_DOWN[ch] && !seen.has(ch)) {
      seen.add(ch);
      out.push({ char: ch, mirrored: UPSIDE_DOWN[ch]! });
    }
  }
  return out;
}

/** Serialize a per-character breakdown to CSV. */
export function breakdownToCsv(breakdown: { char: string; mirrored: string }[]): string {
  const lines = ["Char,Mirrored"];
  for (const e of breakdown) {
    lines.push(`"${e.char}","${e.mirrored}"`);
  }
  return lines.join("\n");
}

/** Generate a sample text for quick demos. */
export function sampleText(): string {
  return "hello world\nmirror me";
}
