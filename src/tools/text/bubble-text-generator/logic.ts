/**
 * Bubble Text Generator — pure logic.
 * Maps text to Unicode Enclosed Alphanumerics (circled, negative circled, squared).
 */
export type BubbleStyle = "circled" | "circled-negative" | "squared" | "squared-negative";

export const STYLE_OPTIONS: { value: BubbleStyle; label: string; a11y: string }[] = [
  { value: "circled", label: "Circled", a11y: "Reads as circled letters (ⓐ)" },
  { value: "circled-negative", label: "Negative Circled", a11y: "Reads as filled circles (🅐)" },
  { value: "squared", label: "Squared", a11y: "Reads as squared letters (🄰)" },
  { value: "squared-negative", label: "Negative Squared", a11y: "Reads as filled squares (🅰)" },
];

// Circled: upper U+24B6, lower U+24D0
const CIRCLED_U_BASE = 0x24b6;
const CIRCLED_L_BASE = 0x24d0;
// Negative circled: upper uses U+1F150 (Enclosed Alphanumeric Supplement), lower U+24D0 is circled
// Actually negative circled uppercase: 🅐 = U+1F150, lowercase falls back to circled (no negative lowercase in Unicode)
const NEG_CIRCLED_U_BASE = 0x1f150;
// Squared: upper U+1F130
const SQUARED_U_BASE = 0x1f130;
// Negative squared: upper U+1F170
const NEG_SQUARED_U_BASE = 0x1f170;

const CIRCLED_DIGITS: Record<string, string> = {
  "0": "⓪",
  "1": "①",
  "2": "②",
  "3": "③",
  "4": "④",
  "5": "⑤",
  "6": "⑥",
  "7": "⑦",
  "8": "⑧",
  "9": "⑨",
};

export function toBubble(text: string, style: BubbleStyle): string {
  if (!text) return "";
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      const isUpper = code >= 0x41 && code <= 0x5a;
      const isLower = code >= 0x61 && code <= 0x7a;
      const idx = isUpper ? code - 0x41 : isLower ? code - 0x61 : -1;

      switch (style) {
        case "circled":
          if (isUpper) return String.fromCodePoint(CIRCLED_U_BASE + idx);
          if (isLower) return String.fromCodePoint(CIRCLED_L_BASE + idx);
          return CIRCLED_DIGITS[char] ?? char;
        case "circled-negative":
          if (isUpper) return String.fromCodePoint(NEG_CIRCLED_U_BASE + idx);
          if (isLower) {
            // No negative circled lowercase — fall back to circled lowercase
            return String.fromCodePoint(CIRCLED_L_BASE + idx);
          }
          return char;
        case "squared":
          if (isUpper) return String.fromCodePoint(SQUARED_U_BASE + idx);
          // No lowercase squared — fall back to original
          return char;
        case "squared-negative":
          if (isUpper) return String.fromCodePoint(NEG_SQUARED_U_BASE + idx);
          return char;
        default:
          return char;
      }
    })
    .join("");
}

const reverseMap = new Map<string, string>();
function buildReverseMap() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < 26; i++) {
    reverseMap.set(String.fromCodePoint(CIRCLED_U_BASE + i), upper[i]!);
    reverseMap.set(String.fromCodePoint(CIRCLED_L_BASE + i), lower[i]!);
    reverseMap.set(String.fromCodePoint(NEG_CIRCLED_U_BASE + i), upper[i]!);
    reverseMap.set(String.fromCodePoint(SQUARED_U_BASE + i), upper[i]!);
    reverseMap.set(String.fromCodePoint(NEG_SQUARED_U_BASE + i), upper[i]!);
  }
  for (const [d, c] of Object.entries(CIRCLED_DIGITS)) {
    reverseMap.set(c, d);
  }
}
buildReverseMap();

export function decodeBubble(text: string): string {
  if (!text) return "";
  return Array.from(text)
    .map((char) => reverseMap.get(char) ?? char)
    .join("");
}

export function getStyleA11y(style: BubbleStyle): string {
  return STYLE_OPTIONS.find((s) => s.value === style)?.a11y ?? "";
}
