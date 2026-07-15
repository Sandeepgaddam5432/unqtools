/**
 * PDF to Word Converter — extracts PDF text and generates a minimal DOCX.
 *
 * DOCX is a ZIP containing Office Open XML files:
 *   - [Content_Types].xml
 *   - _rels/.rels
 *   - word/document.xml
 *   - word/_rels/document.xml.rels
 *   - word/styles.xml
 *
 * We reuse the PDF text extraction from pdf-to-text-converter and the ZIP
 * writer from csv-to-excel-converter.
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

export type WordFont = "Calibri" | "Times New Roman" | "Courier New" | "Arial";

export interface WordOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Font family. */
  fontFamily: WordFont;
  /** Font size in half-points (so 24 = 12pt). */
  fontSize: number;
  /** Page margins in twips (1 inch = 1440 twips). */
  margin: number;
  /** Document title (goes into dc:title core property). */
  title: string;
  /** Document author (goes into dc:creator core property). */
  author: string;
}

export const DEFAULT_OPTIONS: WordOptions = {
  pageRange: "",
  fontFamily: "Calibri",
  fontSize: 22, // 11pt
  margin: 1440, // 1 inch
  title: "Converted from PDF",
  author: "UnQTools",
};

export interface WordResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  docxBytes: number;
}

// ===== DOCX XML generators =====

/** Generate word/document.xml from a list of paragraphs (one per text line). */
export function generateDocumentXml(
  paragraphs: string[],
  opts: WordOptions,
  pageBreaks: boolean,
): string {
  const fs = Math.max(16, Math.min(72, opts.fontSize));
  const margin = Math.max(720, Math.min(4320, opts.margin));
  const sectionProps = `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="${Math.floor(margin / 2)}" w:footer="${Math.floor(margin / 2)}" w:gutter="0"/></w:sectPr>`;
  const parts: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i] ?? "";
    const escaped = xmlEscape(text);
    const pPr = `<w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="${xmlAttrEscape(opts.fontFamily)}" w:hAnsi="${xmlAttrEscape(opts.fontFamily)}"/><w:sz w:val="${fs}"/></w:rPr></w:pPr>`;
    const rPr = `<w:rPr><w:rFonts w:ascii="${xmlAttrEscape(opts.fontFamily)}" w:hAnsi="${xmlAttrEscape(opts.fontFamily)}"/><w:sz w:val="${fs}"/></w:rPr>`;
    if (text === "") {
      parts.push(`<w:p>${pPr}</w:p>`);
    } else {
      parts.push(`<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`);
    }
    // Insert a page break after every Nth paragraph if requested
    if (pageBreaks && i < paragraphs.length - 1 && (i + 1) % 40 === 0) {
      // No-op — Word handles page breaks automatically based on content length.
    }
  }
  const body = parts.join("") + sectionProps;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`;
}

export function generateStylesXml(opts: WordOptions): string {
  const fs = Math.max(16, Math.min(72, opts.fontSize));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="${xmlAttrEscape(opts.fontFamily)}" w:hAnsi="${xmlAttrEscape(opts.fontFamily)}" w:cs="${xmlAttrEscape(opts.fontFamily)}"/><w:sz w:val="${fs}"/><w:szCs w:val="${fs}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;
}

export function generateContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

export function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

export function generateDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

export function generateCoreXml(opts: WordOptions, createdAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEscape(opts.title)}</dc:title>
<dc:creator>${xmlEscape(opts.author)}</dc:creator>
<cp:lastModifiedBy>${xmlEscape(opts.author)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`;
}

export function generateAppXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>UnQTools PDF to Word</Application>
<AppVersion>1.0</AppVersion>
</Properties>`;
}

// ===== Top-level conversion =====

export async function convertPdfToWord(
  pdfBytes: Uint8Array,
  opts: WordOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.docx",
): Promise<ToolResult<WordResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "\n",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  // Collect all paragraphs across pages, inserting a page break between pages.
  const paragraphs: string[] = [];
  for (let i = 0; i < textResult.output.pages.length; i++) {
    if (i > 0) {
      // Word page break: an empty paragraph with a page break run.
      paragraphs.push("__PAGE_BREAK__");
    }
    const pageText = textResult.output.pages[i]!.text;
    for (const line of pageText.split("\n")) {
      paragraphs.push(line);
    }
  }
  // Generate XML files
  const enc = new TextEncoder();
  const documentXml = generateDocumentXml(paragraphs, opts, false);
  const stylesXml = generateStylesXml(opts);
  const contentTypesXml = generateContentTypesXml();
  const rootRelsXml = generateRootRelsXml();
  const documentRelsXml = generateDocumentRelsXml();
  const coreXml = generateCoreXml(opts, new Date().toISOString());
  const appXml = generateAppXml();

  // Replace __PAGE_BREAK__ markers with actual page break XML
  const finalDocumentXml = documentXml.replace(
    /<w:p><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"\/><w:rPr>.*?<\/w:rPr><\/w:pPr><\/w:p>/g,
    (match) => {
      if (match.includes("__PAGE_BREAK__")) {
        return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      }
      return match;
    },
  );

  const files: ZipFile[] = [
    { name: "[Content_Types].xml", data: enc.encode(contentTypesXml) },
    { name: "_rels/.rels", data: enc.encode(rootRelsXml) },
    { name: "word/document.xml", data: enc.encode(finalDocumentXml) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(documentRelsXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
    { name: "docProps/core.xml", data: enc.encode(coreXml) },
    { name: "docProps/app.xml", data: enc.encode(appXml) },
  ];
  const blob = createZipBlob(files);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      pageCount: textResult.output.pageCount,
      wordCount: textResult.output.totalWordCount,
      charCount: textResult.output.totalCharCount,
      paragraphCount: paragraphs.filter((p) => p !== "__PAGE_BREAK__").length,
      docxBytes: blob.size,
    },
  };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-word-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  docxBytes: number;
  pageCount: number;
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

export function buildShareUrl(opts: WordOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("font", opts.fontFamily);
  params.set("fs", String(opts.fontSize));
  params.set("margin", String(opts.margin));
  if (opts.title && opts.title !== "Converted from PDF") params.set("title", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<WordOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("font")) return null;
  const font = (params.get("font") ?? "Calibri") as WordFont;
  const validFonts: WordFont[] = ["Calibri", "Times New Roman", "Courier New", "Arial"];
  const fs = parseInt(params.get("fs") ?? "22", 10);
  const margin = parseInt(params.get("margin") ?? "1440", 10);
  return {
    pageRange: params.get("pages") ?? "",
    fontFamily: validFonts.includes(font) ? font : "Calibri",
    fontSize: isNaN(fs) ? 22 : Math.max(16, Math.min(72, fs)),
    margin: isNaN(margin) ? 1440 : Math.max(720, Math.min(4320, margin)),
    title: params.get("title") ?? "",
  };
}
