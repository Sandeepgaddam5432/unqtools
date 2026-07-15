/**
 * PDF to EPUB Converter — pure-JS EPUB generator.
 *
 * Pipeline:
 *   1. Extract text from PDF using pdf-to-text-converter's extractor.
 *   2. Split text into chapters (page / heading / single).
 *   3. Generate EPUB structure:
 *        - mimetype (STORE method, must be first)
 *        - META-INF/container.xml
 *        - OEBPS/content.opf (metadata + manifest + spine)
 *        - OEBPS/toc.ncx (EPUB 2 NCX)
 *        - OEBPS/nav.xhtml (EPUB 3 NAV)
 *        - OEBPS/style.css
 *        - OEBPS/chapter1.xhtml, chapter2.xhtml, ...
 *   4. Package everything into a ZIP (reuse createZipBlob).
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import {
  createZipBlob,
  type ZipFile,
  xmlEscape,
  xmlAttrEscape,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type ChapterMode = "page" | "heading" | "single";

export interface EpubOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** How to split chapters. */
  chapterMode: ChapterMode;
  /** Custom book title. */
  title: string;
  /** Custom book author. */
  author: string;
  /** Base font size in pixels for the EPUB stylesheet. */
  fontSize: number;
  /** Custom CSS appended to the stylesheet. */
  customCss: string;
  /** Book language (e.g. "en", "fr"). */
  language: string;
}

export const DEFAULT_OPTIONS: EpubOptions = {
  pageRange: "",
  chapterMode: "page",
  title: "Converted from PDF",
  author: "UnQTools",
  fontSize: 16,
  customCss: "",
  language: "en",
};

export interface Chapter {
  /** 1-indexed chapter number. */
  number: number;
  /** Chapter title (extracted from first heading or "Chapter N"). */
  title: string;
  /** XHTML body content (without <body> wrapper). */
  bodyHtml: string;
  /** Word count. */
  wordCount: number;
  /** Character count. */
  charCount: number;
}

export interface EpubResult {
  blob: Blob;
  fileName: string;
  chapterCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  epubBytes: number;
  chapters: Chapter[];
}

// ===== Chapter splitting =====

const HEADING_REGEX = /^(#{1,6}\s+.+|chapter\s+\d+|[A-Z][A-Z\s]{4,})$/i;

/** Detect lines that look like headings. */
export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 100) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true; // Markdown
  if (/^chapter\s+\d+/i.test(trimmed)) return true; // "Chapter 1"
  if (/^part\s+\d+/i.test(trimmed)) return true; // "Part 1"
  // ALL CAPS headings (5+ chars, no lowercase)
  if (trimmed.length >= 5 && /^[A-Z0-9\s\-:,.!?']+$/.test(trimmed) && /[A-Z]/.test(trimmed) && !/^[0-9\s]+$/.test(trimmed)) return true;
  return false;
}

/** Escape text for XHTML content. */
export function escapeXhtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convert plain text into XHTML paragraphs (one <p> per non-empty line). */
export function textToXhtmlParagraphs(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map((l) => `      <p>${escapeXhtml(l)}</p>`)
    .join("\n");
}

/** Count words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

/**
 * Split text into chapters.
 *   - "page" mode: each PDF page becomes one chapter.
 *   - "heading" mode: a new chapter starts at each heading-like line.
 *   - "single" mode: all text becomes one chapter.
 */
export function splitIntoChapters(
  pageTexts: string[],
  mode: ChapterMode,
): Chapter[] {
  const chapters: Chapter[] = [];
  if (mode === "single") {
    const allText = pageTexts.join("\n\n");
    const body = textToXhtmlParagraphs(allText);
    chapters.push({
      number: 1,
      title: "Full Text",
      bodyHtml: body,
      wordCount: countWords(allText),
      charCount: allText.length,
    });
    return chapters;
  }
  if (mode === "page") {
    for (let i = 0; i < pageTexts.length; i++) {
      const text = pageTexts[i] ?? "";
      if (text.trim() === "") continue;
      // Try to extract title from first non-empty line
      const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? `Page ${i + 1}`;
      const title = firstLine.length <= 80 ? firstLine : `Page ${i + 1}`;
      const body = textToXhtmlParagraphs(text);
      chapters.push({
        number: chapters.length + 1,
        title,
        bodyHtml: body,
        wordCount: countWords(text),
        charCount: text.length,
      });
    }
    return chapters;
  }
  // heading mode — walk across all pages, accumulate paragraphs, split on heading
  let currentTitle = "Introduction";
  let currentParas: string[] = [];
  const flush = () => {
    if (currentParas.length === 0) return;
    const text = currentParas.join("\n");
    chapters.push({
      number: chapters.length + 1,
      title: currentTitle,
      bodyHtml: currentParas.map((p) => `      <p>${escapeXhtml(p)}</p>`).join("\n"),
      wordCount: countWords(text),
      charCount: text.length,
    });
    currentParas = [];
  };
  for (const pageText of pageTexts) {
    for (const line of pageText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      if (isHeading(trimmed)) {
        flush();
        currentTitle = trimmed.replace(/^#{1,6}\s+/, "");
      } else {
        currentParas.push(trimmed);
      }
    }
  }
  flush();
  return chapters;
}

// ===== EPUB XML generation =====

const EPUB_NS = "http://www.idpf.org/2007/opf";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const NCX_NS = "http://www.daisy.org/z3986/2005/ncx/";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** Generate the EPUB mimetype file content (must be uncompressed). */
export function generateMimetype(): string {
  return "application/epub+zip";
}

/** Generate META-INF/container.xml. */
export function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/** Generate OEBPS/content.opf — the manifest, spine, and metadata. */
export function generateContentOpf(opts: EpubOptions, chapters: Chapter[], bookId: string): string {
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const metaItems: string[] = [
    `    <dc:identifier id="bookid">${xmlEscape(bookId)}</dc:identifier>`,
    `    <dc:title>${xmlEscape(opts.title)}</dc:title>`,
    `    <dc:creator>${xmlEscape(opts.author)}</dc:creator>`,
    `    <dc:language>${xmlEscape(opts.language)}</dc:language>`,
    `    <meta property="dcterms:modified">${modified}</meta>`,
  ];
  // Manifest items
  const manifestItems: string[] = [
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="css" href="style.css" media-type="text/css"/>`,
  ];
  for (const ch of chapters) {
    manifestItems.push(`    <item id="chap${ch.number}" href="chapter${ch.number}.xhtml" media-type="application/xhtml+xml"/>`);
  }
  // Spine
  const spineItems: string[] = [
    `    <itemref idref="nav" linear="no"/>`,
  ];
  for (const ch of chapters) {
    spineItems.push(`    <itemref idref="chap${ch.number}"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="${EPUB_NS}" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="${DC_NS}">
${metaItems.join("\n")}
  </metadata>
  <manifest>
${manifestItems.join("\n")}
  </manifest>
  <spine toc="ncx">
${spineItems.join("\n")}
  </spine>
</package>`;
}

/** Generate OEBPS/toc.ncx — the EPUB 2 NCX table of contents. */
export function generateNcx(opts: EpubOptions, chapters: Chapter[], bookId: string): string {
  const navPoints = chapters.map((ch, i) => {
    const playOrder = i + 1;
    return `    <navPoint id="navpoint-${ch.number}" playOrder="${playOrder}">
      <navLabel><text>${xmlEscape(ch.title)}</text></navLabel>
      <content src="chapter${ch.number}.xhtml"/>
    </navPoint>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="${NCX_NS}" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${xmlAttrEscape(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${xmlEscape(opts.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

/** Generate OEBPS/nav.xhtml — the EPUB 3 NAV table of contents. */
export function generateNav(opts: EpubOptions, chapters: Chapter[]): string {
  const lis = chapters.map((ch) => `      <li><a href="chapter${ch.number}.xhtml">${xmlEscape(ch.title)}</a></li>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}">
  <head>
    <meta charset="utf-8"/>
    <title>Table of Contents</title>
    <link rel="stylesheet" href="style.css"/>
  </head>
  <body>
    <nav epub:type="toc">
      <h1>Table of Contents</h1>
      <ol>
${lis}
      </ol>
    </nav>
  </body>
</html>`;
}

/** Generate a chapter XHTML file. */
export function generateChapterXhtml(ch: Chapter, opts: EpubOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="${XHTML_NS}">
  <head>
    <meta charset="utf-8"/>
    <title>${xmlEscape(ch.title)}</title>
    <link rel="stylesheet" href="style.css"/>
  </head>
  <body>
    <h1>${xmlEscape(ch.title)}</h1>
${ch.bodyHtml}
  </body>
</html>`;
}

/** Generate the EPUB stylesheet with base font size + custom CSS. */
export function generateStylesheet(opts: EpubOptions): string {
  const fs = Math.max(10, Math.min(36, opts.fontSize));
  return `body { font-family: serif; line-height: 1.5; margin: 1em; font-size: ${fs}px; }
h1 { font-size: ${fs + 6}px; font-weight: bold; margin: 1em 0 0.5em; }
p { margin: 0 0 0.5em; text-indent: 1.5em; }
p:first-of-type { text-indent: 0; }
${opts.customCss}`;
}

// ===== Top-level conversion =====

export async function convertPdfToEpub(
  pdfBytes: Uint8Array,
  opts: EpubOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<EpubResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const pageTexts = textResult.output.pages.map((p) => p.text);
  const chapters = splitIntoChapters(pageTexts, opts.chapterMode);
  if (chapters.length === 0) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const bookId = `urn:uuid:${generateUuid()}`;
  // Generate all parts
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  // Mimetype MUST be first and uncompressed (STORE)
  files.push({ name: "mimetype", data: enc.encode(generateMimetype()) });
  files.push({ name: "META-INF/container.xml", data: enc.encode(generateContainerXml()) });
  files.push({ name: "OEBPS/content.opf", data: enc.encode(generateContentOpf(opts, chapters, bookId)) });
  files.push({ name: "OEBPS/toc.ncx", data: enc.encode(generateNcx(opts, chapters, bookId)) });
  files.push({ name: "OEBPS/nav.xhtml", data: enc.encode(generateNav(opts, chapters)) });
  files.push({ name: "OEBPS/style.css", data: enc.encode(generateStylesheet(opts)) });
  for (const ch of chapters) {
    files.push({ name: `OEBPS/chapter${ch.number}.xhtml`, data: enc.encode(generateChapterXhtml(ch, opts)) });
  }
  const blob = createZipBlob(files);
  const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);
  const charCount = chapters.reduce((s, c) => s + c.charCount, 0);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      chapterCount: chapters.length,
      wordCount,
      charCount,
      pageCount: textResult.output.pageCount,
      epubBytes: blob.size,
      chapters,
    },
  };
}

/** Minimal UUID generator (no crypto dependency for tests). */
export function generateUuid(): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += chars[8 + Math.floor(Math.random() * 4)];
    else out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  epubBytes: number;
  chapterCount: number;
  wordCount: number;
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

export function buildShareUrl(opts: EpubOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<EpubOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("pages")) return null;
  const mode = (params.get("mode") ?? "page") as ChapterMode;
  const validModes: ChapterMode[] = ["page", "heading", "single"];
  const fs = parseInt(params.get("fs") ?? "16", 10);
  return {
    pageRange: params.get("pages") ?? "",
    chapterMode: validModes.includes(mode) ? mode : "page",
    title: params.get("title") ?? "",
    author: params.get("author") ?? "",
    fontSize: isNaN(fs) ? 16 : Math.max(10, Math.min(36, fs)),
    language: params.get("lang") ?? "en",
  };
}
