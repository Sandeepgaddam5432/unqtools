/**
 * Big Text Generator — pure logic.
 * Converts text to Unicode fullwidth and block-letter styles.
 * All mappings are real Unicode characters — copy-paste safe.
 */

export type BigTextStyle =
  | "fullwidth"
  | "sans-bold"
  | "sans-bold-italic"
  | "monospace"
  | "circled"
  | "squared";

export const STYLE_OPTIONS: { value: BigTextStyle; label: string; a11y: string }[] = [
  { value: "fullwidth", label: "Fullwidth", a11y: "Reads as individual characters" },
  { value: "sans-bold", label: "Bold Sans", a11y: "Reads as math symbols" },
  { value: "sans-bold-italic", label: "Bold Italic Sans", a11y: "Reads as math symbols" },
  { value: "monospace", label: "Monospace", a11y: "Reads normally" },
  { value: "circled", label: "Circled", a11y: "Reads as circled letters" },
  { value: "squared", label: "Squared", a11y: "Reads as squared letters" },
];

// Fullwidth: U+FF01–FF5E maps from U+0021–007E (ASCII printable)
function toFullwidth(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x21 && code <= 0x7e) {
    return String.fromCharCode(code + 0xfee0);
  }
  if (char === " ") return "\u3000"; // Fullwidth space
  return char;
}

// Mathematical Alphanumeric Symbols (Bold Sans)
const SANS_BOLD_UPPER: Record<string, string> = {
  A: "𝗔",
  B: "𝗕",
  C: "𝗖",
  D: "𝗗",
  E: "𝗘",
  F: "𝗙",
  G: "𝗚",
  H: "𝗛",
  I: "𝗜",
  J: "𝗝",
  K: "𝗞",
  L: "𝗟",
  M: "𝗠",
  N: "𝗡",
  O: "𝗢",
  P: "𝗣",
  Q: "𝗤",
  R: "𝗥",
  S: "𝗦",
  T: "𝗧",
  U: "𝗨",
  V: "𝗩",
  W: "𝗪",
  X: "𝗫",
  Y: "𝗬",
  Z: "𝗭",
};
const SANS_BOLD_LOWER: Record<string, string> = {
  a: "𝗮",
  b: "𝗯",
  c: "𝗰",
  d: "𝗱",
  e: "𝗲",
  f: "𝗳",
  g: "𝗴",
  h: "𝗵",
  i: "𝗶",
  j: "𝗷",
  k: "𝗸",
  l: "𝗹",
  m: "𝗺",
  n: "𝗻",
  o: "𝗼",
  p: "𝗽",
  q: "𝗾",
  r: "𝗿",
  s: "𝘀",
  t: "𝘁",
  u: "𝘂",
  v: "𝘃",
  w: "𝘄",
  x: "𝘅",
  y: "𝘆",
  z: "𝘇",
};
const SANS_BOLD_DIGITS: Record<string, string> = {
  "0": "𝟬",
  "1": "𝟭",
  "2": "𝟮",
  "3": "𝟯",
  "4": "𝟰",
  "5": "𝟱",
  "6": "𝟲",
  "7": "𝟳",
  "8": "𝟴",
  "9": "𝟵",
};

// Bold Italic Sans
const SANS_BOLD_ITALIC_UPPER: Record<string, string> = {
  A: "𝙰",
  B: "𝙱",
  C: "𝙲",
  D: "𝙳",
  E: "𝙴",
  F: "𝙵",
  G: "𝙶",
  H: "𝙷",
  I: "𝙸",
  J: "𝙹",
  K: "𝙺",
  L: "𝙻",
  M: "𝙼",
  N: "𝙽",
  O: "𝙾",
  P: "𝙿",
  Q: "𝚀",
  R: "𝚁",
  S: "𝚂",
  T: "𝚃",
  U: "𝚄",
  V: "𝚅",
  W: "𝚆",
  X: "𝚇",
  Y: "𝚈",
  Z: "𝚉",
};
const SANS_BOLD_ITALIC_LOWER: Record<string, string> = {
  a: "𝙖",
  b: "𝙗",
  c: "𝙘",
  d: "𝙙",
  e: "𝙚",
  f: "𝙛",
  g: "𝙜",
  h: "𝙝",
  i: "𝙞",
  j: "𝙟",
  k: "𝙠",
  l: "𝙡",
  m: "𝙢",
  n: "𝙣",
  o: "𝙤",
  p: "𝙥",
  q: "𝙦",
  r: "𝙧",
  s: "𝙨",
  t: "𝙩",
  u: "𝙪",
  v: "𝙫",
  w: "𝙬",
  x: "𝙭",
  y: "𝙮",
  z: "𝙯",
};

// Monospace: U+1D670+ for upper, U+1D68A+ for lower
const MONO_UPPER: Record<string, string> = {
  A: "𝙰",
  B: "𝙱",
  C: "𝙲",
  D: "𝙳",
  E: "𝙴",
  F: "𝙵",
  G: "𝙶",
  H: "𝙷",
  I: "𝙸",
  J: "𝙹",
  K: "𝙺",
  L: "𝙻",
  M: "𝙼",
  N: "𝙽",
  O: "𝙾",
  P: "𝙿",
  Q: "𝚀",
  R: "𝚁",
  S: "𝚂",
  T: "𝚃",
  U: "𝚄",
  V: "𝚅",
  W: "𝚆",
  X: "𝚇",
  Y: "𝚈",
  Z: "𝚉",
};
const MONO_LOWER: Record<string, string> = {
  a: "𝚊",
  b: "𝚋",
  c: "𝚌",
  d: "𝚍",
  e: "𝚎",
  f: "𝚏",
  g: "𝚐",
  h: "𝚑",
  i: "𝚒",
  j: "𝚓",
  k: "𝚔",
  l: "𝚕",
  m: "𝚖",
  n: "𝚗",
  o: "𝚘",
  p: "𝚙",
  q: "𝚚",
  r: "𝚛",
  s: "𝚜",
  t: "𝚝",
  u: "𝚞",
  v: "𝚟",
  w: "𝚠",
  x: "𝚡",
  y: "𝚢",
  z: "𝚣",
};
const MONO_DIGITS: Record<string, string> = {
  "0": "𝟶",
  "1": "𝟷",
  "2": "𝟸",
  "3": "𝟹",
  "4": "𝟺",
  "5": "𝟻",
  "6": "𝟼",
  "7": "𝟽",
  "8": "𝟾",
  "9": "𝟿",
};

// Circled: U+24B6+ for upper, U+24D0+ for lower
const CIRCLED_UPPER: Record<string, string> = {
  A: "Ⓐ",
  B: "Ⓑ",
  C: "Ⓒ",
  D: "Ⓓ",
  E: "Ⓔ",
  F: "Ⓕ",
  G: "Ⓖ",
  H: "Ⓗ",
  I: "Ⓘ",
  J: "Ⓙ",
  K: "Ⓚ",
  L: "Ⓛ",
  M: "Ⓜ",
  N: "Ⓝ",
  O: "Ⓞ",
  P: "Ⓟ",
  Q: "Ⓠ",
  R: "Ⓡ",
  S: "Ⓢ",
  T: "Ⓣ",
  U: "Ⓤ",
  V: "Ⓥ",
  W: "Ⓦ",
  X: "Ⓧ",
  Y: "Ⓨ",
  Z: "Ⓩ",
};
const CIRCLED_LOWER: Record<string, string> = {
  a: "ⓐ",
  b: "ⓑ",
  c: "ⓒ",
  d: "ⓓ",
  e: "ⓔ",
  f: "ⓕ",
  g: "ⓖ",
  h: "ⓗ",
  i: "ⓘ",
  j: "ⓙ",
  k: "ⓚ",
  l: "ⓛ",
  m: "ⓜ",
  n: "ⓝ",
  o: "ⓞ",
  p: "ⓟ",
  q: "ⓠ",
  r: "ⓡ",
  s: "ⓢ",
  t: "ⓣ",
  u: "ⓤ",
  v: "ⓥ",
  w: "ⓦ",
  x: "ⓧ",
  y: "ⓨ",
  z: "ⓩ",
};
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

// Squared: U+1F130+ for upper, U+1F170+ for upper (negative)
const SQUARED_UPPER: Record<string, string> = {
  A: "🄰",
  B: "🄱",
  C: "🄲",
  D: "🄳",
  E: "🄴",
  F: "🄵",
  G: "🄶",
  H: "🄷",
  I: "🄸",
  J: "🄹",
  K: "🄺",
  L: "🄻",
  M: "🄼",
  N: "🄽",
  O: "🄾",
  P: "🄿",
  Q: "🅀",
  R: "🅁",
  S: "🅂",
  T: "🅃",
  U: "🅄",
  V: "🅅",
  W: "🅆",
  X: "🅇",
  Y: "🅈",
  Z: "🅉",
};

function mapChar(char: string, style: BigTextStyle): string {
  switch (style) {
    case "fullwidth":
      return toFullwidth(char);
    case "sans-bold":
      if (SANS_BOLD_UPPER[char]) return SANS_BOLD_UPPER[char]!;
      if (SANS_BOLD_LOWER[char]) return SANS_BOLD_LOWER[char]!;
      if (SANS_BOLD_DIGITS[char]) return SANS_BOLD_DIGITS[char]!;
      return char;
    case "sans-bold-italic":
      if (SANS_BOLD_ITALIC_UPPER[char]) return SANS_BOLD_ITALIC_UPPER[char]!;
      if (SANS_BOLD_ITALIC_LOWER[char]) return SANS_BOLD_ITALIC_LOWER[char]!;
      return char;
    case "monospace":
      if (MONO_UPPER[char]) return MONO_UPPER[char]!;
      if (MONO_LOWER[char]) return MONO_LOWER[char]!;
      if (MONO_DIGITS[char]) return MONO_DIGITS[char]!;
      return char;
    case "circled":
      if (CIRCLED_UPPER[char]) return CIRCLED_UPPER[char]!;
      if (CIRCLED_LOWER[char]) return CIRCLED_LOWER[char]!;
      if (CIRCLED_DIGITS[char]) return CIRCLED_DIGITS[char]!;
      return char;
    case "squared":
      if (SQUARED_UPPER[char]) return SQUARED_UPPER[char]!;
      return char;
    default:
      return char;
  }
}

export function toBigText(text: string, style: BigTextStyle): string {
  if (!text) return "";
  // Use Array.from for code-point-safe iteration (handles surrogate pairs)
  return Array.from(text)
    .map((char) => mapChar(char, style))
    .join("");
}

export function getStyleA11y(style: BigTextStyle): string {
  const found = STYLE_OPTIONS.find((s) => s.value === style);
  return found?.a11y ?? "";
}
