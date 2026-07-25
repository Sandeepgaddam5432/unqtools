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
