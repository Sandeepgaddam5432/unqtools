/** Unicode Explorer — pure logic. */

export interface CharInfo {
  char: string;
  codePoint: number;
  hex: string;
  utf8: string;
  utf16: string;
  utf32: string;
  name: string;
  block: string;
  category: string;
}

export interface ExploreResult {
  chars: CharInfo[];
  total: number;
  warnings: string[];
}

// A small block lookup — covers common ranges
const BLOCKS: [number, number, string][] = [
  [0x0000, 0x007f, "Basic Latin"],
  [0x0080, 0x00ff, "Latin-1 Supplement"],
  [0x0100, 0x017f, "Latin Extended-A"],
  [0x0180, 0x024f, "Latin Extended-B"],
  [0x2500, 0x257f, "Box Drawing"],
  [0x2600, 0x26ff, "Miscellaneous Symbols"],
  [0x2700, 0x27bf, "Dingbats"],
  [0x1f600, 0x1f64f, "Emoticons"],
  [0x1f300, 0x1f5ff, "Miscellaneous Symbols and Pictographs"],
  [0x1f680, 0x1f6ff, "Transport and Map Symbols"],
];

function blockFor(cp: number): string {
  for (const [start, end, name] of BLOCKS) {
    if (cp >= start && cp <= end) return name;
  }
  return "Unknown";
}

function codePointToUtf8(cp: number): string {
  const bytes: number[] = [];
  if (cp < 0x80) bytes.push(cp);
  else if (cp < 0x800) {
    bytes.push(0xc0 | (cp >> 6));
    bytes.push(0x80 | (cp & 0x3f));
  } else if (cp < 0x10000) {
    bytes.push(0xe0 | (cp >> 12));
    bytes.push(0x80 | ((cp >> 6) & 0x3f));
    bytes.push(0x80 | (cp & 0x3f));
  } else {
    bytes.push(0xf0 | (cp >> 18));
    bytes.push(0x80 | ((cp >> 12) & 0x3f));
    bytes.push(0x80 | ((cp >> 6) & 0x3f));
    bytes.push(0x80 | (cp & 0x3f));
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function categoryFor(cp: number): string {
  if (cp >= 0x30 && cp <= 0x39) return "Nd (Decimal Digit)";
  if (cp >= 0x41 && cp <= 0x5a) return "Lu (Uppercase Letter)";
  if (cp >= 0x61 && cp <= 0x7a) return "Ll (Lowercase Letter)";
  if (cp >= 0x20 && cp <= 0x2f) return "Po (Punctuation)";
  if (cp >= 0x1f600 && cp <= 0x1f64f) return "So (Emoji)";
  if (cp === 0x20) return "Zs (Space)";
  return "Other";
}

function nameFor(cp: number): string {
  if (cp === 0x20) return "SPACE";
  if (cp === 0x09) return "CHARACTER TABULATION";
  if (cp === 0x0a) return "LINE FEED";
  if (cp >= 0x41 && cp <= 0x5a) return `LATIN CAPITAL LETTER ${String.fromCodePoint(cp)}`;
  if (cp >= 0x61 && cp <= 0x7a) return `LATIN SMALL LETTER ${String.fromCodePoint(cp).toUpperCase()}`;
  if (cp >= 0x30 && cp <= 0x39) return `DIGIT ${String.fromCodePoint(cp)}`;
  if (cp >= 0x1f600 && cp <= 0x1f64f) return `EMOTICON ${String.fromCodePoint(cp)}`;
  return `CODE POINT U+${cp.toString(16).toUpperCase()}`;
}

export function process(input: string): ExploreResult {
  const warnings: string[] = [];
  const chars: CharInfo[] = [];
  if (!input) {
    warnings.push("Input is empty.");
    return { chars, total: 0, warnings };
  }
  let i = 0;
  while (i < input.length) {
    const cp = input.codePointAt(i)!;
    const char = String.fromCodePoint(cp);
    chars.push({
      char,
      codePoint: cp,
      hex: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      utf8: codePointToUtf8(cp),
      utf16: cp > 0xffff
        ? `${((cp - 0x10000) >> 10) + 0xd800},${((cp - 0x10000) & 0x3ff) + 0xdc00}`
        : cp.toString(16).toUpperCase().padStart(4, "0"),
      utf32: cp.toString(16).padStart(8, "0").toUpperCase(),
      name: nameFor(cp),
      block: blockFor(cp),
      category: categoryFor(cp),
    });
    i += char.length;
    if (chars.length > 1000) {
      warnings.push("Truncated at 1000 characters.");
      break;
    }
  }
  return { chars, total: chars.length, warnings };
}

export function toCsv(r: ExploreResult): string {
  const lines = ["Char,CodePoint,Hex,UTF8,UTF16,UTF32,Name,Block,Category"];
  for (const c of r.chars) {
    lines.push([c.char, c.codePoint, c.hex, c.utf8, c.utf16, c.utf32, `"${c.name}"`, `"${c.block}"`, `"${c.category}"`].join(","));
  }
  return lines.join("\n");
}
