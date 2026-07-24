/**
 * Text Repeater — pure logic.
 */

export type NumberingMode = "none" | "numeric" | "zero-padded" | "alpha-lower" | "alpha-upper" | "roman";

export interface RepeatOptions {
  count: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  numberingMode?: NumberingMode;
  numberingStart?: number;
  numberingStep?: number;
  /** Pattern using {n} for number, {i} for index (0-based), {text} for original. */
  pattern?: string;
  /** Reverse each iteration's text. */
  reverseEach?: boolean;
  /** Mirror output (append reversed). */
  mirror?: boolean;
  /** Truncate output to maxChars. */
  maxChars?: number;
  /** Shuffle each iteration. */
  shuffle?: boolean;
}

export interface RepeatResult {
  output: string;
  actualCount: number;
  truncated: boolean;
  warnings: string[];
}

const ROMAN: number[] = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
const ROMAN_SYM: string[] = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];

function toRoman(num: number): string {
  let result = "";
  let n = num;
  for (let i = 0; i < ROMAN.length; i++) {
    while (n >= ROMAN[i]!) {
      result += ROMAN_SYM[i];
      n -= ROMAN[i]!;
    }
  }
  return result;
}

function toAlpha(num: number, upper: boolean): string {
  // 1 → a, 2 → b, 26 → z, 27 → aa, 28 → ab
  let result = "";
  let n = num;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode((upper ? 65 : 97) + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function getNumberLabel(mode: NumberingMode, n: number): string {
  switch (mode) {
    case "numeric": return String(n);
    case "zero-padded": return String(n).padStart(3, "0");
    case "alpha-lower": return toAlpha(n, false);
    case "alpha-upper": return toAlpha(n, true);
    case "roman": return toRoman(n);
    case "none":
    default: return "";
  }
}

function shuffleString(s: string): string {
  const arr = s.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.join("");
}

export function repeatText(text: string, options: RepeatOptions): RepeatResult | { error: string } {
  if (!text) return { output: "", actualCount: 0, truncated: false, warnings: ["Input is empty."] };
  const count = Math.floor(options.count);
  if (count <= 0) return { error: "Count must be a positive integer." };
  if (count > 1_000_000) return { error: "Count is too large (max 1,000,000)." };

  const numberingMode = options.numberingMode ?? "none";
  const numberingStart = options.numberingStart ?? 1;
  const numberingStep = options.numberingStep ?? 1;
  const separator = options.separator ?? "\n";
  const pattern = options.pattern;
  const maxChars = options.maxChars;

  const warnings: string[] = [];
  const parts: string[] = [];

  for (let i = 0; i < count; i++) {
    const num = numberingStart + i * numberingStep;
    const label = getNumberLabel(numberingMode, num);
    let piece = text;
    if (options.reverseEach) piece = Array.from(piece).reverse().join("");
    if (options.shuffle) piece = shuffleString(piece);

    if (pattern) {
      piece = pattern.replace(/\{n\}/g, label).replace(/\{i\}/g, String(i)).replace(/\{text\}/g, piece);
    } else if (label) {
      piece = `${label}. ${piece}`;
    }
    if (options.prefix) piece = options.prefix + piece;
    if (options.suffix) piece = piece + options.suffix;
    parts.push(piece);

    // Check maxChars
    if (maxChars && parts.join(separator).length > maxChars) {
      warnings.push(`Output truncated at ${i + 1} iterations to respect maxChars=${maxChars}.`);
      return { output: parts.join(separator).slice(0, maxChars), actualCount: i + 1, truncated: true, warnings };
    }
  }

  let output = parts.join(separator);

  if (options.mirror) {
    const reversed = Array.from(output).reverse().join("");
    output = output + separator + reversed;
  }

  if (output.length > 1_000_000) {
    output = output.slice(0, 1_000_000);
    warnings.push("Output truncated to 1,000,000 chars for browser safety.");
  }

  return {
    output,
    actualCount: count,
    truncated: warnings.length > 0,
    warnings,
  };
}

/** Generate Lorem Ipsum-style filler (random words from a fixed pool). */
export function generateLoremIpsum(sentences: number, startWithLorem: boolean = true): string {
  const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
  const out: string[] = [];
  for (let s = 0; s < sentences; s++) {
    const len = 8 + Math.floor(Math.random() * 12);
    const sentenceWords: string[] = [];
    for (let i = 0; i < len; i++) {
      sentenceWords.push(words[Math.floor(Math.random() * words.length)]!);
    }
    let sentence = sentenceWords.join(" ");
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
    if (s === 0 && startWithLorem) {
      sentence = "Lorem ipsum dolor sit amet, " + sentence.toLowerCase();
    }
    out.push(sentence);
  }
  return out.join(" ");
}

/** Generate a barcode-like pattern from text (e.g. | ||| | || ||| |). */
export function generateBarcodePattern(text: string): string {
  return Array.from(text).map((ch) => {
    const code = ch.charCodeAt(0);
    const bars = [];
    for (let i = 0; i < 4; i++) {
      const bit = (code >> i) & 1;
      bars.push(bit ? "||" : "|");
    }
    return bars.join(" ");
  }).join("  ");
}
