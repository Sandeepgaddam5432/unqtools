/**
 * Bold Text Generator — pure logic.
 * Maps text to Unicode Mathematical Alphanumeric Symbols bold variants.
 * Supports: serif bold, sans bold, bold italic, bold script, bold fraktur.
 * Includes decode (bold → normal).
 */

export type BoldStyle =
  | "serif-bold"
  | "sans-bold"
  | "bold-italic"
  | "bold-script"
  | "bold-fraktur"
  | "bold-double-struck";

export const STYLE_OPTIONS: { value: BoldStyle; label: string; a11y: string }[] = [
  { value: "serif-bold", label: "Serif Bold", a11y: "Reads as math symbols (𝐀)" },
  { value: "sans-bold", label: "Sans Bold", a11y: "Reads as math symbols (𝗔)" },
  { value: "bold-italic", label: "Bold Italic", a11y: "Reads as math symbols (𝑨)" },
  { value: "bold-script", label: "Bold Script", a11y: "Reads as math symbols (𝓐)" },
  { value: "bold-fraktur", label: "Bold Fraktur", a11y: "Reads as math symbols (𝕬)" },
  { value: "bold-double-struck", label: "Double-struck", a11y: "Reads as math symbols (𝔸)" },
];

// Unicode Mathematical Alphanumeric Symbols base code points
// Bold (serif): upper U+1D400, lower U+1D41A
// Bold Italic: upper U+1D468, lower U+1D482
// Bold Script: upper U+1D4D0, lower U+1D4EA
// Bold Fraktur: upper U+1D56C, lower U+1D586
// Bold Double-struck: upper U+1D538, lower U+1D552 (with gaps for C,H,N,P,Q,R,Z)
// Sans Bold: upper U+1D5D4, lower U+1D5EE, digits U+1D7EC

const BOLD_DIGITS_BASE = 0x1d7ec; // Sans bold digits

const DOUBLE_STRUCK_GAPS_UPPER: Record<string, string> = {
  C: "ℂ",
  H: "ℍ",
  N: "ℕ",
  P: "ℙ",
  Q: "ℚ",
  R: "ℝ",
  Z: "ℤ",
};

function codePointFromBase(char: string, baseUpper: number, baseLower: number): string | null {
  const code = char.charCodeAt(0);
  if (code >= 0x41 && code <= 0x5a) {
    // A-Z
    return String.fromCodePoint(baseUpper + (code - 0x41));
  }
  if (code >= 0x61 && code <= 0x7a) {
    // a-z
    return String.fromCodePoint(baseLower + (code - 0x61));
  }
  return null;
}

function mapSansBoldDigit(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code >= 0x30 && code <= 0x39) {
    return String.fromCodePoint(BOLD_DIGITS_BASE + (code - 0x30));
  }
  return null;
}

export function toBold(text: string, style: BoldStyle): string {
  if (!text) return "";
  return Array.from(text)
    .map((char) => {
      switch (style) {
        case "serif-bold": {
          const mapped = codePointFromBase(char, 0x1d400, 0x1d41a);
          return mapped ?? char;
        }
        case "sans-bold": {
          const mapped = codePointFromBase(char, 0x1d5d4, 0x1d5ee);
          if (mapped) return mapped;
          const digit = mapSansBoldDigit(char);
          return digit ?? char;
        }
        case "bold-italic": {
          const mapped = codePointFromBase(char, 0x1d468, 0x1d482);
          return mapped ?? char;
        }
        case "bold-script": {
          const mapped = codePointFromBase(char, 0x1d4d0, 0x1d4ea);
          return mapped ?? char;
        }
        case "bold-fraktur": {
          const mapped = codePointFromBase(char, 0x1d56c, 0x1d586);
          return mapped ?? char;
        }
        case "bold-double-struck": {
          // Double-struck has gaps for C, H, N, P, Q, R, Z (from Letterlike Symbols)
          if (DOUBLE_STRUCK_GAPS_UPPER[char]) return DOUBLE_STRUCK_GAPS_UPPER[char]!;
          const mapped = codePointFromBase(char, 0x1d538, 0x1d552);
          return mapped ?? char;
        }
        default:
          return char;
      }
    })
    .join("");
}

// Build reverse maps for decode
const reverseMaps: Map<string, string>[] = [];
function buildReverseMap(style: BoldStyle): Map<string, string> {
  const map = new Map<string, string>();
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < 26; i++) {
    const u = upper[i]!;
    const l = lower[i]!;
    const bu = toBold(u, style);
    const bl = toBold(l, style);
    if (bu !== u) map.set(bu, u);
    if (bl !== l) map.set(bl, l);
  }
  // Digits for sans-bold
  if (style === "sans-bold") {
    for (let d = 0; d <= 9; d++) {
      const digit = String(d);
      const bd = toBold(digit, style);
      if (bd !== digit) map.set(bd, digit);
    }
  }
  return map;
}

export function decodeBold(text: string): string {
  if (!text) return "";
  // Try all styles
  if (reverseMaps.length === 0) {
    for (const s of STYLE_OPTIONS) {
      reverseMaps.push(buildReverseMap(s.value));
    }
  }
  return Array.from(text)
    .map((char) => {
      for (const map of reverseMaps) {
        if (map.has(char)) return map.get(char);
      }
      return char;
    })
    .join("");
}

export function getStyleA11y(style: BoldStyle): string {
  return STYLE_OPTIONS.find((s) => s.value === style)?.a11y ?? "";
}
