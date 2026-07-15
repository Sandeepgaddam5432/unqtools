/**
 * ODP to PDF Converter — pure-JS ODP parser + pdf-lib renderer.
 *
 * ODP (OpenDocument Presentation) is a ZIP containing XML files:
 *   - content.xml — slides (draw:page) with text boxes and lists
 *   - styles.xml  — style definitions (we don't apply inheritance)
 *   - meta.xml    — document metadata
 *
 * We parse content.xml, walk it to extract slides, then render each slide
 * to a PDF page using pdf-lib. Slides are rendered as: title at top,
 * bullet list below, with configurable page size (4:3 / 16:9).
 */

import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import {
  parseZipEntries as parseZipEntriesBase,
  decompressEntry as decompressEntryBase,
  parseXml,
  type ZipEntry as BaseZipEntry,
  type XmlNode,
} from "../excel-to-csv-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface OdpSlide {
  /** Slide name from draw:name attribute. */
  name: string;
  /** Title text (first text box's first paragraph, or empty). */
  title: string;
  /** Body content as a list of text blocks (paragraphs / list items). */
  body: string[];
  /** Raw text content of the slide (all text joined with newlines). */
  fullText: string;
}

export interface OdpMetadata {
  title: string;
  author: string;
  subject: string;
  generator: string;
  creationDate: string;
  metaFound: boolean;
}

export interface OdpStats {
  slideCount: number;
  titleCount: number;
  bodyItemCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pdfBytes: number;
}

export type PageSize = "4:3" | "16:9" | "letter";

export interface ConvertOptions {
  pageSize: PageSize;
  fontSize: number;
  titleFontSize: number;
  margin: number;
  /** Page background color (white or dark). */
  background: "white" | "dark";
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageSize: "16:9",
  fontSize: 14,
  titleFontSize: 24,
  margin: 40,
  background: "white",
};

// ===== ZIP / XML helpers =====

export async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array | null> {
  const entries = parseZipEntriesBase(bytes);
  const entry = entries.find((e) => e.name === name);
  if (!entry) return null;
  return decompressEntryBase(entry);
}

export function isOdpArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4b &&
    bytes[2] === 0x03 && bytes[3] === 0x04
  );
}

// ===== Slide extraction =====

export function extractSlides(contentXml: string): OdpSlide[] {
  const root = parseXml(contentXml);
  const body = findDescendant(root, "office:body");
  if (!body) return [];
  const presentation = findDescendant(body, "office:presentation");
  if (!presentation) return [];
  const slides: OdpSlide[] = [];
  for (const child of presentation.children) {
    if (child.name === "draw:page") {
      slides.push(parseSlide(child));
    }
  }
  return slides;
}

function parseSlide(pageNode: XmlNode): OdpSlide {
  const name = pageNode.attributes["draw:name"] ?? "Slide";
  const textBoxes: XmlNode[] = [];
  findTextBoxes(pageNode, textBoxes);
  let title = "";
  const body: string[] = [];
  let fullText = "";
  for (let i = 0; i < textBoxes.length; i++) {
    const tb = textBoxes[i]!;
    const texts = collectTextBoxTexts(tb);
    if (i === 0 && texts.length > 0) {
      title = texts[0]!;
      fullText += title + "\n";
      for (let j = 1; j < texts.length; j++) {
        body.push(texts[j]!);
        fullText += texts[j]! + "\n";
      }
    } else {
      for (const t of texts) {
        body.push(t);
        fullText += t + "\n";
      }
    }
  }
  return { name, title, body, fullText: fullText.trim() };
}

function findTextBoxes(node: XmlNode, out: XmlNode[]): void {
  for (const c of node.children) {
    if (c.name === "draw:text-box") out.push(c);
    findTextBoxes(c, out);
  }
}

function collectTextBoxTexts(textBox: XmlNode): string[] {
  const texts: string[] = [];
  for (const child of textBox.children) {
    collectTextItems(child, texts);
  }
  return texts.filter((t) => t.trim() !== "");
}

function collectTextItems(node: XmlNode, out: string[]): void {
  if (node.name === "text:p") {
    const text = collectText(node).trim();
    if (text) out.push(text);
    return;
  }
  if (node.name === "text:h") {
    const text = collectText(node).trim();
    if (text) out.push(text);
    return;
  }
  if (node.name === "text:list") {
    for (const item of node.children) {
      if (item.name === "text:list-item") {
        for (const child of item.children) {
          collectTextItems(child, out);
        }
      }
    }
    return;
  }
  for (const child of node.children) {
    collectTextItems(child, out);
  }
}

function collectText(node: XmlNode): string {
  let out = node.text || "";
  for (const child of node.children) {
    if (child.name === "text:line-break") out += "\n";
    else if (child.name === "text:tab") out += "\t";
    else if (child.name === "text:s") {
      const count = parseInt(child.attributes["text:c"] ?? "1", 10) || 1;
      out += " ".repeat(count);
    } else {
      out += collectText(child);
    }
  }
  return out;
}

function findDescendant(node: XmlNode, name: string): XmlNode | null {
  for (const c of node.children) {
    if (c.name === name) return c;
    const found = findDescendant(c, name);
    if (found) return found;
  }
  return null;
}

// ===== Metadata =====

export function parseMeta(metaXml: string): OdpMetadata {
  const result: OdpMetadata = {
    title: "", author: "", subject: "", generator: "",
    creationDate: "", metaFound: true,
  };
  const root = parseXml(metaXml);
  const meta = findDescendant(root, "office:meta");
  if (!meta) return result;
  for (const child of meta.children) {
    const text = collectText(child);
    switch (child.name) {
      case "dc:title": result.title = text; break;
      case "dc:creator": result.author = text; break;
      case "dc:subject": result.subject = text; break;
      case "meta:generator": result.generator = text; break;
      case "meta:creation-date": result.creationDate = text; break;
    }
  }
  return result;
}

// ===== Stats =====

export function computeStats(slides: OdpSlide[], pageCount: number, pdfBytes: number): OdpStats {
  let titleCount = 0;
  let bodyItemCount = 0;
  let wordCount = 0;
  let charCount = 0;
  for (const s of slides) {
    if (s.title) titleCount++;
    bodyItemCount += s.body.length;
    charCount += s.fullText.length;
    wordCount += s.fullText.split(/\s+/).filter((w) => w.length > 0).length;
  }
  return {
    slideCount: slides.length,
    titleCount,
    bodyItemCount,
    wordCount,
    charCount,
    pageCount,
    pdfBytes,
  };
}

// ===== PDF rendering =====

function getPageSize(size: PageSize): [number, number] {
  if (size === "4:3") return [612, 459]; // 8.5 × 6.375 in
  if (size === "16:9") return [612, 344.25]; // 8.5 × 4.78 in (16:9)
  // Letter portrait
  return PageSizes.Letter;
}

export async function convertOdpToPdf(
  odpBytes: Uint8Array,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<{ bytes: Uint8Array; stats: OdpStats; metadata: OdpMetadata }>> {
  if (!isOdpArchive(odpBytes)) {
    return { ok: false, error: "Not an ODP file — missing ZIP signature." };
  }
  try {
    const contentBytes = await readZipEntry(odpBytes, "content.xml");
    if (!contentBytes) {
      return { ok: false, error: "ODP is missing content.xml — the file may be corrupted." };
    }
    const contentXml = new TextDecoder("utf-8").decode(contentBytes);
    const slides = extractSlides(contentXml);
    if (slides.length === 0) {
      return { ok: false, error: "No slides found in the ODP file." };
    }

    let metadata: OdpMetadata = {
      title: "", author: "", subject: "", generator: "",
      creationDate: "", metaFound: false,
    };
    try {
      const metaBytes = await readZipEntry(odpBytes, "meta.xml");
      if (metaBytes) {
        const metaXml = new TextDecoder("utf-8").decode(metaBytes);
        metadata = parseMeta(metaXml);
      }
    } catch {
      /* optional */
    }

    const doc = await PDFDocument.create();
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    const [pageW, pageH] = getPageSize(opts.pageSize);
    const margin = Math.max(20, Math.min(80, opts.margin));
    const fs = Math.max(8, Math.min(24, opts.fontSize));
    const titleFs = Math.max(12, Math.min(36, opts.titleFontSize));
    const textColor = opts.background === "dark" ? rgb(1, 1, 1) : rgb(0, 0, 0);
    const bgColor = opts.background === "dark" ? rgb(0.1, 0.1, 0.15) : rgb(1, 1, 1);

    for (const slide of slides) {
      const page = doc.addPage([pageW, pageH]);
      page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
      let y = pageH - margin;

      // Title
      if (slide.title) {
        const titleLines = wrapText(slide.title, boldFont, titleFs, pageW - margin * 2);
        for (const line of titleLines) {
          page.drawText(line, { x: margin, y: y - titleFs, size: titleFs, font: boldFont, color: textColor });
          y -= titleFs * 1.3;
        }
        y -= titleFs * 0.4;
      }

      // Body
      for (const item of slide.body) {
        const lines = wrapText("• " + item, regularFont, fs, pageW - margin * 2);
        for (const line of lines) {
          if (y - fs < margin) break;
          page.drawText(line, { x: margin, y: y - fs, size: fs, font: regularFont, color: textColor });
          y -= fs * 1.5;
        }
      }
    }

    doc.setTitle(metadata.title || "Converted from ODP");
    if (metadata.author) doc.setAuthor(metadata.author);
    doc.setProducer("UnQTools — ODP to PDF");
    doc.setCreator("UnQTools — ODP to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());

    const pageCount = doc.getPageCount();
    const pdfBytes = await doc.save();
    const stats = computeStats(slides, pageCount, pdfBytes.length);
    return { ok: true, output: { bytes: pdfBytes, stats, metadata } };
  } catch (e) {
    return { ok: false, error: `ODP to PDF conversion failed: ${(e as Error).message}` };
  }
}

function wrapText(text: string, font: { widthOfTextAtSize: (s: string, n: number) => number }, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para === "") {
      result.push("");
      continue;
    }
    const line = para.replace(/\t/g, "    ");
    const words = line.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxWidth && current) {
        result.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History =====

const HISTORY_KEY = "unqtools-odp-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  odpBytes: number;
  pdfBytes: number;
  slideCount: number;
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

export function buildShareUrl(opts: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("page", opts.pageSize);
  params.set("fs", String(opts.fontSize));
  params.set("tfs", String(opts.titleFontSize));
  params.set("margin", String(opts.margin));
  params.set("bg", opts.background);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConvertOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("page") && !params.has("fs")) return null;
  const page = (params.get("page") ?? "16:9") as PageSize;
  const fs = parseInt(params.get("fs") ?? "14", 10);
  const tfs = parseInt(params.get("tfs") ?? "24", 10);
  const margin = parseInt(params.get("margin") ?? "40", 10);
  const bg = (params.get("bg") ?? "white") as ConvertOptions["background"];
  const validPages: PageSize[] = ["4:3", "16:9", "letter"];
  return {
    pageSize: validPages.includes(page) ? page : "16:9",
    fontSize: isNaN(fs) ? 14 : Math.max(8, Math.min(24, fs)),
    titleFontSize: isNaN(tfs) ? 24 : Math.max(12, Math.min(36, tfs)),
    margin: isNaN(margin) ? 40 : Math.max(20, Math.min(80, margin)),
    background: bg === "dark" ? "dark" : "white",
  };
}
