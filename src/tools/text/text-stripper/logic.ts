/**
 * Text Stripper — pure stripping logic. No DOM access.
 */

export type StripMode =
  | "html"
  | "markdown"
  | "whitespace"
  | "punctuation"
  | "numbers"
  | "non-ascii"
  | "extra-spaces"
  | "line-breaks";

export interface StripOptions {
  mode: StripMode;
  /** For whitespace mode: also collapse multiple spaces into one. */
  collapseSpaces: boolean;
}

/** Strip HTML/XML tags. */
export function stripHtml(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Strip Markdown syntax (headers, bold, italics, links, lists, code, images). */
export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/\|/g, " ");
}

/** Strip all whitespace. */
export function stripWhitespace(input: string, collapseSpaces: boolean): string {
  if (collapseSpaces) {
    return input.replace(/\s+/g, " ").trim();
  }
  return input.replace(/\s+/g, "");
}

/** Strip punctuation (keep alphanumerics, whitespace, and apostrophes in contractions). */
export function stripPunctuation(input: string): string {
  return input.replace(/[^\w\s']/g, "").replace(/'(?!\w)/g, "").replace(/(?<!\w)'/g, "");
}

/** Strip numeric digits. */
export function stripNumbers(input: string): string {
  return input.replace(/[0-9]/g, "");
}

/** Strip non-ASCII characters. */
export function stripNonAscii(input: string): string {
  return input.replace(/[^\x00-\x7F]/g, "");
}

/** Collapse multiple spaces into one (preserves line breaks). */
export function collapseExtraSpaces(input: string): string {
  return input
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip line breaks (replace with space). */
export function stripLineBreaks(input: string): string {
  return input.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/** Apply a strip mode to text. */
export function stripText(input: string, opts: StripOptions): string {
  switch (opts.mode) {
    case "html": return stripHtml(input);
    case "markdown": return stripMarkdown(input);
    case "whitespace": return stripWhitespace(input, opts.collapseSpaces);
    case "punctuation": return stripPunctuation(input);
    case "numbers": return stripNumbers(input);
    case "non-ascii": return stripNonAscii(input);
    case "extra-spaces": return collapseExtraSpaces(input);
    case "line-breaks": return stripLineBreaks(input);
    default: return input;
  }
}

export function availableModes(): StripMode[] {
  return ["html", "markdown", "whitespace", "punctuation", "numbers", "non-ascii", "extra-spaces", "line-breaks"];
}
