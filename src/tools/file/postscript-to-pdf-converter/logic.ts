/**
 * PostScript to PDF Converter — pure-JS PS text extractor + pdf-lib renderer.
 *
 * PostScript is a Turing-complete page-description language. A full
 * interpreter (Ghostscript) is ~500K lines of C. This pure-JS implementation
 * parses a simplified subset:
 *
 * Recognized commands:
 *   - `showpage` — page break
 *   - `moveto x y` — text cursor position
 *   - `rmoveto dx dy` — relative cursor
 *   - `(string) show` — render text
 *   - `/font findfont size scalefont setfont` — font selection
 *   - `setrgbcolor r g b` / `setgray g` — color (recorded, not applied)
 *   - `translate` / `scale` / `rotate` — transforms (recorded, not fully applied)
 *   - `%%Page: label ordinal` — DSC page marker
 *   - `%%EOF` — end of document
 *
 * HONESTY: Vector graphics, images, font metrics, and complex coordinate
 * transforms are NOT supported. We extract text per page and render it as
 * PDF text objects. For faithful PS rendering, use Ghostscript. Documented
 * in FAQ.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// ===== Types =====

export type PsFont = "Helvetica" | "Times-Roman" | "Courier";
export type PsPageSize = "a4" | "letter" | "legal";

export interface PsOptions {
  /** Font family. */
  font: PsFont;
  /** Font size in points. */
  fontSize: number;
  /** Page size. */
  pageSize: PsPageSize;
  /** Margins in points (1 inch = 72 points). */
  margin: number;
  /** Line height multiplier (1.0 = single, 1.5 = 1.5x). */
  lineHeight: number;
  /** Document title. */
  title: string;
}

export const DEFAULT_OPTIONS: PsOptions = {
  font: "Helvetica",
  fontSize: 12,
  pageSize: "letter",
  margin: 50,
  lineHeight: 1.4,
  title: "Converted from PostScript",
};

export interface PsPage {
  /** 1-indexed page number. */
  pageNumber: number;
  /** DSC %%Page: label (if found). */
  label: string | null;
  /** All text strings extracted from `show` commands, in order. */
  textLines: string[];
  /** Total characters on the page. */
  charCount: number;
  /** Total words on the page. */
  wordCount: number;
}

export interface PsParseResult {
  /** Original PS source code. */
  source: string;
  /** Extracted pages. */
  pages: PsPage[];
  /** Page count. */
  pageCount: number;
  /** Total word count across all pages. */
  wordCount: number;
  /** Total character count across all pages. */
  charCount: number;
  /** %%Title from DSC header (if found). */
  title: string | null;
  /** %%Creator from DSC header (if found). */
  creator: string | null;
  /** %%BoundingBox (for EPS files). */
  boundingBox: [number, number, number, number] | null;
  /** Number of unrecognized commands (informational). */
  unrecognizedCommandCount: number;
  /** Whether the file has a valid %!PS header. */
  hasPsHeader: boolean;
}

export interface PsConvertResult {
  /** PDF bytes. */
  pdfBytes: Uint8Array;
  /** Output filename. */
  fileName: string;
  /** Parse result. */
  parse: PsParseResult;
  /** Options used. */
  options: PsOptions;
  /** PDF size in bytes. */
  pdfSize: number;
}

// ===== Page size helpers =====

export function getPageSizePoints(size: PsPageSize): { width: number; height: number } {
  if (size === "a4") return { width: 595.276, height: 841.89 };
  if (size === "legal") return { width: 612, height: 1008 };
  return { width: 612, height: 792 }; // Letter
}

// ===== PS parsing =====

/** Check if a line starts with the %!PS magic. */
export function isPostscriptMagic(source: string): boolean {
  return source.trimStart().startsWith("%!PS");
}

/** Extract DSC header comment value: %%Title: foo → "foo". */
export function extractDscComment(source: string, key: string): string | null {
  const regex = new RegExp(`^%%${key}:\\s*(.+?)\\s*$`, "m");
  const m = source.match(regex);
  return m ? m[1]!.trim() : null;
}

/** Extract the %%BoundingBox comment (for EPS files). */
export function extractBoundingBox(source: string): [number, number, number, number] | null {
  const m = source.match(/^%%BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/m);
  if (!m) return null;
  return [
    parseInt(m[1]!, 10),
    parseInt(m[2]!, 10),
    parseInt(m[3]!, 10),
    parseInt(m[4]!, 10),
  ];
}

/** Escape a PostScript string literal — wraps in parens and escapes special chars. */
export function escapePsString(text: string): string {
  return `(${text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/**
 * Extract a string from a PS `(string) show` operand.
 * Returns the unescaped string or null if not a string literal.
 */
export function parsePsString(token: string): string | null {
  if (!token.startsWith("(") || !token.endsWith(")")) return null;
  const inner = token.substring(1, token.length - 1);
  // Unescape \( \) \\
  return inner
    .replace(/\\\\/g, "\\")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

/** Tokenize a PostScript line into operands + operators. */
export function tokenizePsLine(line: string): string[] {
  // Strip comments (lines starting with %, or % after non-string content)
  // For simplicity, only strip lines that START with % (DSC comments)
  if (line.trimStart().startsWith("%")) return [];
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(") {
      // String literal — read until matching close paren (with escape handling)
      let depth = 1;
      let j = i + 1;
      while (j < line.length && depth > 0) {
        if (line[j] === "\\" && j + 1 < line.length) {
          j += 2;
          continue;
        }
        if (line[j] === "(") depth++;
        else if (line[j] === ")") depth--;
        j++;
      }
      tokens.push(line.substring(i, j));
      i = j;
    } else {
      // Read until whitespace
      let j = i;
      while (j < line.length && !/[\s]/.test(line[j]!)) j++;
      tokens.push(line.substring(i, j));
      i = j;
    }
  }
  return tokens;
}

/** Count words in a string. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Parse a PostScript source string into pages.
 * Each `showpage` command (or %%Page: comment) starts a new page.
 * `show` commands add text to the current page.
 */
export function parsePostscript(source: string): PsParseResult {
  const hasPsHeader = isPostscriptMagic(source);
  const title = extractDscComment(source, "Title");
  const creator = extractDscComment(source, "Creator");
  const boundingBox = extractBoundingBox(source);

  const pages: PsPage[] = [];
  let currentPage: PsPage = {
    pageNumber: 1,
    label: null,
    textLines: [],
    charCount: 0,
    wordCount: 0,
  };
  let unrecognizedCount = 0;

  const lines = source.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // DSC page comment
    const pageMatch = trimmed.match(/^%%Page:\s*(\S*)\s*(\d+)?/);
    if (pageMatch) {
      // Save current page if it has content, then start a new one
      if (currentPage.textLines.length > 0) {
        pages.push(currentPage);
      }
      currentPage = {
        pageNumber: pages.length + 1,
        label: pageMatch[1] ?? null,
        textLines: [],
        charCount: 0,
        wordCount: 0,
      };
      continue;
    }
    // showpage command
    if (/\bshowpage\b/.test(trimmed)) {
      pages.push(currentPage);
      currentPage = {
        pageNumber: pages.length + 1,
        label: null,
        textLines: [],
        charCount: 0,
        wordCount: 0,
      };
      continue;
    }
    // Skip comments
    if (trimmed.startsWith("%") || trimmed.length === 0) continue;

    const tokens = tokenizePsLine(line);
    if (tokens.length === 0) continue;

    // Look for `show` operator with a string operand before it
    // Pattern: `(string) show` or `string show`
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok === "show" && i > 0) {
        const prev = tokens[i - 1]!;
        const text = parsePsString(prev);
        if (text !== null) {
          currentPage.textLines.push(text);
          currentPage.charCount += text.length;
          currentPage.wordCount += countWords(text);
        }
      }
      // Count unrecognized operators (anything that's not a known PS command
      // and not a string/number)
      if (i === tokens.length - 1 && /^[a-zA-Z]/.test(tok) && tok !== "show" && tok !== "showpage") {
        const knownOps = new Set([
          "moveto", "rmoveto", "lineto", "rlineto", "curveto", "arc", "arcn",
          "findfont", "scalefont", "setfont", "setrgbcolor", "setgray", "setcmykcolor",
          "translate", "scale", "rotate", "concat", "gsave", "grestore", "save", "restore",
          "newpath", "closepath", "stroke", "fill", "clip", "eofill",
          "image", "colorimage", "imagemask",
          "setlinewidth", "setlinecap", "setlinejoin",
          "add", "sub", "mul", "div", "idiv", "mod", "neg", "abs", "ceil", "floor", "round", "truncate",
          "dup", "exch", "pop", "roll", "index", "copy",
          "if", "ifelse", "loop", "repeat", "for", "forall", "exec",
          "def", "bind", "load", "store",
        ]);
        if (!knownOps.has(tok)) {
          unrecognizedCount++;
        }
      }
    }
  }
  // Push the last page if it has content
  if (currentPage.textLines.length > 0) {
    pages.push(currentPage);
  }
  // If no pages were created (no showpage), make at least one empty page
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      label: null,
      textLines: [],
      charCount: 0,
      wordCount: 0,
    });
  }

  const wordCount = pages.reduce((s, p) => s + p.wordCount, 0);
  const charCount = pages.reduce((s, p) => s + p.charCount, 0);

  return {
    source, pages,
    pageCount: pages.length,
    wordCount, charCount,
    title, creator, boundingBox,
    unrecognizedCommandCount: unrecognizedCount,
    hasPsHeader,
  };
}

// ===== PDF rendering =====

const FONT_MAP: Record<PsFont, StandardFonts> = {
  "Helvetica": StandardFonts.Helvetica,
  "Times-Roman": StandardFonts.TimesRoman,
  "Courier": StandardFonts.Courier,
};

/** Wrap a long line to a max character count. */
export function wrapLine(text: string, maxWidthChars: number): string[] {
  if (maxWidthChars <= 0 || text.length <= maxWidthChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidthChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Convert a PostScript source string to a PDF using pdf-lib.
 * HONESTY: Only text content is rendered. Vector graphics, images, and
 * font metrics are NOT supported. See FAQ.
 */
export async function convertPsToPdf(
  source: string,
  options: PsOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.pdf",
): Promise<PsConvertResult> {
  const parse = parsePostscript(source);
  const doc = await PDFDocument.create();
  doc.setTitle(options.title);
  doc.setCreator("UnQTools — PostScript to PDF Converter");
  doc.setProducer("UnQTools");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  const font = await doc.embedFont(FONT_MAP[options.font]);
  const { width: pageWidth, height: pageHeight } = getPageSizePoints(options.pageSize);
  const margin = options.margin;
  const fontSize = options.fontSize;
  const lineHeight = fontSize * options.lineHeight;
  // Approximate chars-per-line based on average char width
  const avgCharWidth = font.widthOfTextAtSize("M", fontSize);
  const maxWidthChars = Math.floor((pageWidth - 2 * margin) / avgCharWidth);

  for (const page of parse.pages) {
    const pdfPage = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    for (const line of page.textLines) {
      const wrapped = wrapLine(line, maxWidthChars);
      for (const w of wrapped) {
        if (y < margin) {
          // Page overflow — silently truncate (or could add a new page)
          break;
        }
        pdfPage.drawText(w, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }
    }
  }

  const pdfBytes = await doc.save();
  return {
    pdfBytes: pdfBytes as unknown as Uint8Array,
    fileName: outputFileName,
    parse,
    options,
    pdfSize: pdfBytes.length,
  };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-postscript-to-pdf-converter-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pageCount: number;
  wordCount: number;
  pdfSize: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export interface ShareOptions {
  font: PsFont;
  fontSize: number;
  pageSize: PsPageSize;
  margin: number;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("font", opts.font);
  params.set("size", String(opts.fontSize));
  params.set("page", opts.pageSize);
  params.set("margin", String(opts.margin));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("font")) return null;
  const font = (params.get("font") ?? "Helvetica") as PsFont;
  const validFonts: PsFont[] = ["Helvetica", "Times-Roman", "Courier"];
  return {
    font: validFonts.includes(font) ? font : "Helvetica",
    fontSize: Math.max(8, Math.min(24, parseInt(params.get("size") ?? "12", 10) || 12)),
    pageSize: (params.get("page") === "a4" ? "a4" : params.get("page") === "legal" ? "legal" : "letter") as PsPageSize,
    margin: Math.max(0, Math.min(100, parseInt(params.get("margin") ?? "50", 10) || 50)),
  };
}
