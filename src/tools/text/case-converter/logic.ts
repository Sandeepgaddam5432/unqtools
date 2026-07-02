/**
 * Text Case Converter — pure logic.
 */

export type CaseType =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "dot"
  | "alternating";

const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "for",
  "nor",
  "as",
  "at",
  "by",
  "in",
  "of",
  "on",
  "to",
  "up",
  "per",
  "via",
  "de",
  "du",
  "le",
  "la",
  "les",
]);

/** Split any string into "words" — splitting on whitespace, hyphens, underscores, and camelCase boundaries. */
function splitWords(input: string): string[] {
  // First, normalize: insert space at camelCase boundaries
  const normalized = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  // Split on any non-alphanumeric (except apostrophes inside words)
  return normalized
    .split(/[^a-zA-Z0-9']+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function toUpperCase(input: string): string {
  return input.toUpperCase();
}

export function toLowerCase(input: string): string {
  return input.toLowerCase();
}

export function toTitleCase(input: string): string {
  if (!input) return "";
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Always capitalize first and last word
      if (i === 0 || i === words.length - 1) {
        return capitalizeFirst(lower);
      }
      if (SMALL_WORDS.has(lower)) return lower;
      return capitalizeFirst(lower);
    })
    .join(" ");
}

export function toSentenceCase(input: string): string {
  if (!input) return "";
  // Lowercase everything, then capitalize the first letter of each sentence
  const lower = input.toLowerCase();
  return lower.replace(/(^\s*\w)|([.!?]\s+\w)/g, (match) => match.toUpperCase());
}

export function toCamelCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return "";
  return words
    .map((word, i) => (i === 0 ? word.toLowerCase() : capitalizeFirst(word.toLowerCase())))
    .join("");
}

export function toPascalCase(input: string): string {
  const words = splitWords(input);
  return words.map((word) => capitalizeFirst(word.toLowerCase())).join("");
}

export function toSnakeCase(input: string): string {
  return splitWords(input)
    .map((w) => w.toLowerCase())
    .join("_");
}

export function toKebabCase(input: string): string {
  return splitWords(input)
    .map((w) => w.toLowerCase())
    .join("-");
}

export function toConstantCase(input: string): string {
  return splitWords(input)
    .map((w) => w.toUpperCase())
    .join("_");
}

export function toDotCase(input: string): string {
  return splitWords(input)
    .map((w) => w.toLowerCase())
    .join(".");
}

export function toAlternatingCase(input: string): string {
  let i = 0;
  let result = "";
  for (const ch of input) {
    if (/[a-zA-Z]/.test(ch)) {
      result += i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
      i++;
    } else {
      result += ch;
    }
  }
  return result;
}

function capitalizeFirst(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Dispatch — convert input to the given case type. */
export function convertCase(input: string, type: CaseType): string {
  switch (type) {
    case "upper":
      return toUpperCase(input);
    case "lower":
      return toLowerCase(input);
    case "title":
      return toTitleCase(input);
    case "sentence":
      return toSentenceCase(input);
    case "camel":
      return toCamelCase(input);
    case "pascal":
      return toPascalCase(input);
    case "snake":
      return toSnakeCase(input);
    case "kebab":
      return toKebabCase(input);
    case "constant":
      return toConstantCase(input);
    case "dot":
      return toDotCase(input);
    case "alternating":
      return toAlternatingCase(input);
  }
}

export const CASE_OPTIONS: { value: CaseType; label: string; example: string }[] = [
  { value: "upper", label: "UPPERCASE", example: "HELLO WORLD" },
  { value: "lower", label: "lowercase", example: "hello world" },
  { value: "title", label: "Title Case", example: "Hello World" },
  { value: "sentence", label: "Sentence case", example: "Hello world" },
  { value: "camel", label: "camelCase", example: "helloWorld" },
  { value: "pascal", label: "PascalCase", example: "HelloWorld" },
  { value: "snake", label: "snake_case", example: "hello_world" },
  { value: "kebab", label: "kebab-case", example: "hello-world" },
  { value: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD" },
  { value: "dot", label: "dot.case", example: "hello.world" },
  { value: "alternating", label: "aLtErNaTiNg", example: "hElLo wOrLd" },
];
