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


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Strip emoji from text.
 */
export function stripEmoji(text: string): string {
  // Unicode emoji ranges (simplified — covers most common emoji)
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "");
}

/**
 * Strip control characters (except newline and tab).
 */
export function stripControlChars(text: string, keepWhitespace: boolean = true): string {
  if (keepWhitespace) {
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  }
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

/**
 * Strip zero-width characters (used for invisible text injection).
 */
export function stripZeroWidth(text: string): string {
  return text.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");
}

/**
 * Strip all non-printable characters.
 */
export function stripNonPrintable(text: string): string {
  return text.replace(/[^\x20-\x7E\n\r\t]/g, "");
}

/**
 * Strip URLs from text.
 */
export function stripUrls(text: string): string {
  return text.replace(/https?:\/\/(?:[-\w.]|(?:%[\da-fA-F]{2}))+/g, "");
}

/**
 * Strip email addresses from text.
 */
export function stripEmails(text: string): string {
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "");
}

/**
 * Strip phone numbers (basic).
 */
export function stripPhoneNumbers(text: string): string {
  return text.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "");
}

/**
 * Strip all HTML tags (alias for stripHtml, more explicit name).
 */
export function stripTags(text: string): string {
  return stripHtml(text);
}

/**
 * Comprehensive strip with multiple options.
 */
export function stripAdvanced(
  text: string,
  options: {
    html?: boolean;
    markdown?: boolean;
    whitespace?: boolean;
    punctuation?: boolean;
    numbers?: boolean;
    nonAscii?: boolean;
    emoji?: boolean;
    controlChars?: boolean;
    zeroWidth?: boolean;
    urls?: boolean;
    emails?: boolean;
    phones?: boolean;
  } = {},
): string {
  let result = text;
  if (options.html) result = stripHtml(result);
  if (options.markdown) result = stripMarkdown(result);
  if (options.whitespace) result = stripWhitespace(result);
  if (options.punctuation) result = stripPunctuation(result);
  if (options.numbers) result = stripNumbers(result);
  if (options.nonAscii) result = stripNonAscii(result);
  if (options.emoji) result = stripEmoji(result);
  if (options.controlChars) result = stripControlChars(result);
  if (options.zeroWidth) result = stripZeroWidth(result);
  if (options.urls) result = stripUrls(result);
  if (options.emails) result = stripEmails(result);
  if (options.phones) result = stripPhoneNumbers(result);
  return result;
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateStripInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) {
    reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." });
    return reports;
  }
  if (/</.test(text) && />/.test(text)) {
    reports.push({ level: "warn", code: "HTML_DETECTED", message: "Text contains angle brackets — may contain HTML." });
  }
  if (/[\u{1F600}-\u{1F64F}]/u.test(text)) {
    reports.push({ level: "info" as "pass", code: "EMOJI_DETECTED", message: "Text contains emoji characters." });
  }
  if (/[\u200B-\u200F\uFEFF]/.test(text)) {
    reports.push({ level: "warn", code: "ZERO_WIDTH", message: "Text contains zero-width characters (possible invisible text injection)." });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + text.charCodeAt(0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "text-stripper",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "WHATWG-HTML-Parser", citation: "WHATWG HTML Standard", summary: "HTML parsing and sanitization rules." },
  { id: "Unicode-Emoji", citation: "Unicode Emoji 15.0", summary: "Emoji character ranges and properties." },
  { id: "OWASP-XSS", citation: "OWASP XSS Prevention Cheat Sheet", summary: "Cross-site scripting prevention — input sanitization." },
];
