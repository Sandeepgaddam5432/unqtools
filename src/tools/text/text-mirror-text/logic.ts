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

/** Map a single character to its upside-down equivalent. */
export function mirrorChar(ch: string): string {
  return UPSIDE_DOWN[ch] ?? ch;
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

export type MirrorMode = "horizontal" | "vertical" | "both";
