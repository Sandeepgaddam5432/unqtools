/**
 * Text Case Advancer — pure case conversion logic. No DOM access.
 */

export type CaseMode =
  | "camelCase"
  | "snake_case"
  | "kebab-case"
  | "PascalCase"
  | "CONSTANT_CASE"
  | "Title Case"
  | "Sentence case"
  | "lowercase"
  | "UPPERCASE";

export interface CaseOptions {
  mode: CaseMode;
  /** Preserve original line breaks. */
  preserveLines: boolean;
}

/** Split a string into word tokens (handles camelCase, snake_case, kebab-case, spaces, punctuation). */
export function tokenize(input: string): string[] {
  if (!input) return [];
  // Insert a space at case boundaries: camelCase → camel Case
  const withBoundaries = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  // Split on non-alphanumeric (keep apostrophes within words)
  return withBoundaries
    .split(/[^a-zA-Z0-9']+/)
    .filter((t) => t.length > 0);
}

/** Convert tokens to camelCase. */
export function toCamelCase(tokens: string[]): string {
  return tokens
    .map((t, i) => {
      const lower = t.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/** Convert tokens to PascalCase. */
export function toPascalCase(tokens: string[]): string {
  return tokens
    .map((t) => {
      const lower = t.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/** Convert tokens to snake_case. */
export function toSnakeCase(tokens: string[]): string {
  return tokens.map((t) => t.toLowerCase()).join("_");
}

/** Convert tokens to kebab-case. */
export function toKebabCase(tokens: string[]): string {
  return tokens.map((t) => t.toLowerCase()).join("-");
}

/** Convert tokens to CONSTANT_CASE. */
export function toConstantCase(tokens: string[]): string {
  return tokens.map((t) => t.toUpperCase()).join("_");
}

/** Convert tokens to Title Case. */
export function toTitleCase(tokens: string[]): string {
  return tokens
    .map((t) => {
      const lower = t.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Convert tokens to sentence case. */
export function toSentenceCase(tokens: string[]): string {
  return tokens
    .map((t, i) => {
      const lower = t.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(" ");
}

/** Apply a case transformation to text. */
export function convertCase(input: string, opts: CaseOptions): string {
  if (!input) return "";
  const transform = (line: string): string => {
    const tokens = tokenize(line);
    switch (opts.mode) {
      case "camelCase": return toCamelCase(tokens);
      case "snake_case": return toSnakeCase(tokens);
      case "kebab-case": return toKebabCase(tokens);
      case "PascalCase": return toPascalCase(tokens);
      case "CONSTANT_CASE": return toConstantCase(tokens);
      case "Title Case": return toTitleCase(tokens);
      case "Sentence case": return toSentenceCase(tokens);
      case "lowercase": return line.toLowerCase();
      case "UPPERCASE": return line.toUpperCase();
      default: return line;
    }
  };
  if (opts.preserveLines) {
    return input.split("\n").map(transform).join("\n");
  }
  return transform(input.replace(/\n/g, " "));
}

/** Get all available case modes. */
export function availableModes(): CaseMode[] {
  return [
    "camelCase",
    "snake_case",
    "kebab-case",
    "PascalCase",
    "CONSTANT_CASE",
    "Title Case",
    "Sentence case",
    "lowercase",
    "UPPERCASE",
  ];
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function cycleCase(text: string, currentCase: string): { output: string; nextCase: string } {
  const cases = ["lower", "upper", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"];
  const idx = cases.indexOf(currentCase);
  const nextIdx = (idx + 1) % cases.length;
  const nextCase = cases[nextIdx]!;
  const output = convertCase(text, nextCase);
  return { output, nextCase };
}

export function detectCase(text: string): string {
  if (!text) return "unknown";
  if (/^[a-z]+$/.test(text)) return "lower";
  if (/^[A-Z]+$/.test(text)) return "upper";
  if (/^[A-Z][a-z]*(?:[A-Z][a-z]*)*$/.test(text)) return "pascal";
  if (/^[a-z]+(?:[A-Z][a-z]*)*$/.test(text)) return "camel";
  if (/^[a-z]+(?:_[a-z]+)*$/.test(text)) return "snake";
  if (/^[A-Z]+(?:_[A-Z]+)*$/.test(text)) return "constant";
  if (/^[a-z]+(?:-[a-z]+)*$/.test(text)) return "kebab";
  if (/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(text)) return "title";
  if (/^[A-Z][a-z]+(?:\s[a-z]+)*$/.test(text)) return "sentence";
  return "mixed";
}

export function toScreamingKebab(text: string): string {
  return text.split(/[\s_-]+/).filter(Boolean).join("-").toUpperCase();
}

export function toTrainCase(text: string): string {
  return text.split(/[\s_-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-");
}

export function toPathCase(text: string): string {
  return text.split(/[\s_-]+/).filter(Boolean).join("/").toLowerCase();
}

export function toInverseCase(text: string): string {
  return text.split("").map((c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join("");
}

export function toSpongeCase(text: string, seed?: number): string {
  let rng = seed ?? Date.now();
  const next = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  return text.split("").map((c) => /[a-zA-Z]/.test(c) ? (next() > 0.5 ? c.toUpperCase() : c.toLowerCase()) : c).join("");
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateCaseInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const detected = detectCase(text);
  reports.push({ level: "pass", code: "DETECTED", message: `Detected case style: ${detected}.` });
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-case-advancer", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "ECMA-262-String", citation: "ECMA-262 §22.1", summary: "String prototype methods." },
  { id: "Linguistics-Case", citation: "Unicode Standard §5.6", summary: "Case mapping and case folding." },
];
