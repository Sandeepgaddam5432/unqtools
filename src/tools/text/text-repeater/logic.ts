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


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export type RepeatJoin = "none" | "space" | "newline" | "comma" | "tab" | "custom";

export function repeatWithJoin(text: string, count: number, join: RepeatJoin = "newline", customSeparator: string = ""): string {
  if (count <= 0) return "";
  const separator = join === "none" ? "" : join === "space" ? " " : join === "newline" ? "\n" : join === "comma" ? ", " : join === "tab" ? "\t" : customSeparator;
  return Array.from({ length: count }, () => text).join(separator);
}

export function repeatWithNumber(text: string, count: number, options: { start?: number; padLength?: number; position?: "prefix" | "suffix" } = {}): string {
  const { start = 1, padLength = 0, position = "suffix" } = options;
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const num = String(start + i).padStart(padLength, "0");
    lines.push(position === "prefix" ? `${num}${text}` : `${text}${num}`);
  }
  return lines.join("\n");
}

export function repeatWithPattern(pattern: string, count: number, options: { start?: number; padLength?: number } = {}): string {
  const { start = 1, padLength = 0 } = options;
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const num = String(start + i).padStart(padLength, "0");
    lines.push(pattern.replace(/\{n\}/g, num).replace(/\{i\}/g, String(i + 1)));
  }
  return lines.join("\n");
}

export function repeatPyramid(text: string, maxHeight: number): string {
  const lines: string[] = [];
  for (let i = 1; i <= maxHeight; i++) {
    lines.push(Array.from({ length: i }, () => text).join(" "));
  }
  for (let i = maxHeight - 1; i >= 1; i--) {
    lines.push(Array.from({ length: i }, () => text).join(" "));
  }
  return lines.join("\n");
}

export function repeatTriangle(text: string, height: number, inverted: boolean = false): string {
  const lines: string[] = [];
  for (let i = 1; i <= height; i++) {
    lines.push(Array.from({ length: i }, () => text).join(" "));
  }
  if (inverted) lines.reverse();
  return lines.join("\n");
}

export function estimateRepeatSize(text: string, count: number, separator: string = "\n"): { bytes: number; characters: number; lines: number } {
  const sepLen = separator.length;
  const textLen = text.length;
  const totalChars = textLen * count + sepLen * Math.max(0, count - 1);
  const totalBytes = new TextEncoder().encode(text + separator).length * count;
  return { bytes: totalBytes, characters: totalChars, lines: separator === "\n" ? count : 1 };
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateRepeatInput(text: string, count: number): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  if (count <= 0) { reports.push({ level: "fail", code: "INVALID_COUNT", message: "Count must be positive." }); return reports; }
  const size = estimateRepeatSize(text, count);
  if (size.bytes > 10 * 1024 * 1024) {
    reports.push({ level: "warn", code: "LARGE_OUTPUT", message: `Output will be ~${Math.round(size.bytes / 1024 / 1024)} MB.` });
  } else {
    reports.push({ level: "pass", code: "VALID", message: `Will produce ${size.characters} characters.` });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string, count: number): Receipt {
  const s = text.length + ":" + count;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-repeater", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "ECMA-262-String-Repeat", citation: "ECMA-262 §22.1.3.15", summary: "String.prototype.repeat specification." },
];
