/**
 * Ebook/XPS/PDF Converter — shared pure logic.
 * Used by: azw3-to-pdf-converter, djvu-to-pdf-converter, epub-to-pdf-converter,
 * mobi-to-pdf-converter, pdf-to-xps-converter, xps-to-pdf-converter.
 *
 * Note: True AZW3/DjVu/MOBI/XPS parsing requires heavy WASM libraries.
 * This module provides:
 *  - HTML/text extraction (for EPUB, which is just zipped HTML)
 *  - PDF generation from text (using pdf-lib in ui.tsx)
 *  - XPS-flavored XML output (a simplified XPS-like document)
 *  - PDF→XPS conversion (limited: generates XPS-like XML wrapper around PDF reference)
 *  - XPS→PDF conversion (limited: extracts text from XPS XML and builds new PDF)
 */

export type ConverterType = "azw3-to-pdf" | "djvu-to-pdf" | "epub-to-pdf" | "mobi-to-pdf" | "pdf-to-xps" | "xps-to-pdf";

export interface ConvertOptions {
  pageSize?: "a4" | "letter" | "legal";
  margin?: number; // points
  fontSize?: number; // points
  fontFamily?: "helvetica" | "times-roman" | "courier";
  includePageNumbers?: boolean;
  includeTitlePage?: boolean;
  title?: string;
  author?: string;
  /** Custom CSS (ignored for non-HTML sources). */
  customCss?: string;
}

export interface ConvertResult {
  success: boolean;
  inputSize: number;
  outputSize: number;
  warnings: string[];
  log: string[];
  pageCount: number;
}

/** Extract plain text from an EPUB (zip with HTML files inside). */
export async function extractTextFromEpub(file: File): Promise<{ text: string; title: string; author: string; chapters: { title: string; text: string }[] }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let title = file.name;
  let author = "Unknown";
  // Try to read OPF metadata
  const opfFile = Object.values(zip.files).find((f) => f.name.endsWith(".opf"));
  if (opfFile) {
    const opfText = await opfFile.async("text");
    const titleMatch = /<dc:title[^>]*>([^<]+)<\/dc:title>/.exec(opfText);
    if (titleMatch) title = titleMatch[1]!.trim();
    const authorMatch = /<dc:creator[^>]*>([^<]+)<\/dc:creator>/.exec(opfText);
    if (authorMatch) author = authorMatch[1]!.trim();
  }
  // Read all HTML files in spine order (simplified: alphabetical)
  const htmlFiles = Object.values(zip.files).filter((f) => f.name.endsWith(".html") || f.name.endsWith(".xhtml") || f.name.endsWith(".htm")).sort((a, b) => a.name.localeCompare(b.name));
  const chapters: { title: string; text: string }[] = [];
  for (const f of htmlFiles) {
    const html = await f.async("text");
    const text = htmlToText(html);
    chapters.push({ title: f.name.split("/").pop() ?? f.name, text });
  }
  return { text: chapters.map((c) => c.text).join("\n\n"), title, author, chapters };
}

/** Strip HTML tags and convert to plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract text from MOBI (very simplified — reads PDB header). */
export async function extractTextFromMobi(file: File): Promise<{ text: string; title: string; author: string }> {
  // MOBI binary format is complex; do a best-effort extraction of ASCII text
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Find the PalmDOC header (offset 78 has MOBI marker)
  // For simplicity, extract all printable ASCII sequences
  let text = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if ((b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x0D || b === 0x09) {
      text += String.fromCharCode(b);
    } else if (text.length > 0 && text[text.length - 1] !== "\n") {
      text += "\n";
    }
  }
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, title: file.name, author: "Unknown" };
}

/** Extract text from AZW3 (KF8 — same family as MOBI). */
export async function extractTextFromAzw3(file: File): Promise<{ text: string; title: string; author: string }> {
  // AZW3 is also binary; same simplified extraction
  return extractTextFromMobi(file);
}

/** Extract text from DjVu (very simplified — binary format). */
export async function extractTextFromDjvu(file: File): Promise<{ text: string; title: string; author: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Look for "TXTz" chunk which contains text
  let text = "";
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x54 && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x54 && bytes[i + 3] === 0x7A) {
      // Found TXTz chunk — extract following bytes
      const start = i + 4;
      const end = Math.min(start + 10000, bytes.length);
      for (let j = start; j < end; j++) {
        const b = bytes[j]!;
        if ((b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x0D) {
          text += String.fromCharCode(b);
        } else if (text.length > 0 && text[text.length - 1] !== "\n") {
          text += "\n";
        }
      }
      break;
    }
  }
  if (!text) {
    // Fallback: extract all ASCII
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]!;
      if ((b >= 0x20 && b < 0x7F) || b === 0x0A) text += String.fromCharCode(b);
      else if (text.length > 0 && text[text.length - 1] !== "\n") text += "\n";
    }
    text = text.replace(/\n{3,}/g, "\n\n").trim();
  }
  return { text, title: file.name, author: "Unknown" };
}

/** Generate XPS-like XML document from text content. */
export function generateXpsXml(text: string, title: string, author: string): string {
  // XPS is a ZIP containing XML files. This generates the core FixedDocument sequence.
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const pageXml = lines.map((line) => `<Glyphs UnicodeString="${line}" FontUri="/Resources/Fonts/arial.ttf" FontRenderingEmSize="12" OriginX="50" OriginY="50" />`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<FixedDocument xmlns="http://schemas.microsoft.com/xps/2005/06">
  <Pages>
    <FixedPage Width="595" Height="842" xmlns="http://schemas.microsoft.com/xps/2005/06">
      <Canvas>
        ${pageXml}
      </Canvas>
    </FixedPage>
  </Pages>
  <DocumentProperties>
    <Title>${title}</Title>
    <Author>${author}</Author>
  </DocumentProperties>
</FixedDocument>`;
}

/** Generate a paginated PDF from text content (called from ui.tsx). */
export function paginateText(text: string, options: ConvertOptions): string[] {
  const pageSize = options.pageSize ?? "a4";
  const margin = options.margin ?? 50;
  const fontSize = options.fontSize ?? 12;
  const dims = pageSize === "a4" ? { w: 595, h: 842 } : pageSize === "letter" ? { w: 612, h: 792 } : { w: 612, h: 1008 };
  const usableWidth = dims.w - 2 * margin;
  const usableHeight = dims.h - 2 * margin;
  const charsPerLine = Math.floor(usableWidth / (fontSize * 0.55));
  const linesPerPage = Math.floor(usableHeight / (fontSize * 1.4));

  const paragraphs = text.split("\n");
  const pageTexts: string[] = [];
  let currentPage: string[] = [];
  let currentLineCount = 0;

  for (const para of paragraphs) {
    // Word-wrap paragraph
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > charsPerLine) {
        currentPage.push(line.trim());
        currentLineCount++;
        if (currentLineCount >= linesPerPage) {
          pageTexts.push(currentPage.join("\n"));
          currentPage = [];
          currentLineCount = 0;
        }
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) {
      currentPage.push(line);
      currentLineCount++;
      if (currentLineCount >= linesPerPage) {
        pageTexts.push(currentPage.join("\n"));
        currentPage = [];
        currentLineCount = 0;
      }
    }
    currentPage.push("");
    currentLineCount++;
  }
  if (currentPage.length > 0) pageTexts.push(currentPage.join("\n"));
  return pageTexts;
}

/** Format conversion log. */
export function formatLog(entries: string[]): string {
  return entries.map((e, i) => `[${new Date().toISOString().slice(11, 19)}] ${i + 1}. ${e}`).join("\n");
}

/** Convert result summary. */
export function summarizeResult(result: ConvertResult): string {
  return [
    `Conversion Summary`,
    `==================`,
    `Success: ${result.success ? "YES" : "NO"}`,
    `Input size: ${result.inputSize} bytes`,
    `Output size: ${result.outputSize} bytes`,
    `Size delta: ${result.outputSize - result.inputSize > 0 ? "+" : ""}${result.outputSize - result.inputSize} bytes`,
    `Pages: ${result.pageCount}`,
    ``,
    `Log:`,
    ...result.log.map((l) => `  - ${l}`),
    ``,
    ...(result.warnings.length > 0 ? [`Warnings:`, ...result.warnings.map((w) => `  - ${w}`)] : []),
  ].join("\n");
}
