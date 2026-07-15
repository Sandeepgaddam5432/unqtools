/**
 * ODT to PDF Converter — pure-JS ODT parser + pdf-lib renderer.
 *
 * ODT (OpenDocument Text) is a ZIP containing XML files:
 *   - content.xml   — the actual text + structure
 *   - styles.xml    — style definitions (we don't apply inheritance)
 *   - meta.xml      — document metadata (title, author, etc.)
 *   - META-INF/manifest.xml — list of all entries
 *
 * We parse content.xml into a tree (reusing the minimal XML parser from
 * excel-to-csv-converter), walk it to extract blocks (heading / paragraph /
 * list item / preformatted), and render each block to a PDF page using
 * pdf-lib's Helvetica / Helvetica-Bold / Courier fonts.
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

export type BlockType = "heading" | "paragraph" | "list-item" | "preformatted";

export interface TextBlock {
  type: BlockType;
  text: string;
  /** Heading level (1–6 for h1–h6, 0 for non-headings). */
  level: number;
  /** Whether the block is a list item (and if so, whether the list is ordered). */
  isOrdered: boolean;
  /** Indent level for list items (0 for non-list). */
  indent: number;
  /** Whether the block should render in bold (headings, bold spans). */
  bold: boolean;
  /** Whether the block should render in monospace (preformatted). */
  monospace: boolean;
  /** Hyperlinks found in the block (text + URL). */
  links: Array<{ text: string; url: string }>;
}

export interface OdtMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  description: string;
  generator: string;
  creationDate: string;
  /** True if meta.xml was found and parsed. */
  metaFound: boolean;
}

export interface OdtStats {
  blockCount: number;
  paragraphCount: number;
  headingCount: number;
  listItemCount: number;
  preformattedCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pdfBytes: number;
}

export interface ConvertOptions {
  fontSize: number;
  pageSize: "a4" | "letter" | "legal";
  margin: number;
  title: string;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  fontSize: 12,
  pageSize: "a4",
  margin: 50,
  title: "",
};

// ===== ZIP / XML helpers =====

export interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  bytes: Uint8Array;
}

export async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array | null> {
  const entries = parseZipEntriesBase(bytes);
  const entry = entries.find((e) => e.name === name);
  if (!entry) return null;
  return decompressEntryBase(entry);
}

export function isOdtArchive(bytes: Uint8Array): boolean {
  // .odt is a ZIP — check for PK\x03\x04 magic
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4b &&
    bytes[2] === 0x03 && bytes[3] === 0x04
  );
}

// ===== ODT block extraction =====

/** Walk content.xml and extract TextBlocks. */
export function extractBlocks(contentXml: string): TextBlock[] {
  const root = parseXml(contentXml);
  const blocks: TextBlock[] = [];
  // Find office:body → office:text anywhere in the tree (robust against wrapper elements).
  const body = findDescendant(root, "office:body");
  if (!body) return blocks;
  const text = findDescendant(body, "office:text");
  if (!text) return blocks;

  let orderedStack: boolean[] = [];
  for (const child of text.children) {
    walkContent(child, blocks, orderedStack, 0);
  }
  return blocks;
}

function findDescendant(node: XmlNode, name: string): XmlNode | null {
  for (const c of node.children) {
    if (c.name === name) return c;
    const found = findDescendant(c, name);
    if (found) return found;
  }
  return null;
}

function walkContent(node: XmlNode, blocks: TextBlock[], orderedStack: boolean[], indent: number): void {
  const name = node.name;
  if (name === "text:h") {
    const level = parseInt(node.attributes["text:outline-level"] ?? "1", 10) || 1;
    const text = collectText(node);
    blocks.push({
      type: "heading",
      text,
      level: Math.max(1, Math.min(6, level)),
      isOrdered: false,
      indent: 0,
      bold: true,
      monospace: false,
      links: collectLinks(node),
    });
    return;
  }
  if (name === "text:p") {
    const text = collectText(node);
    if (text.trim() === "") return;
    const isPre = isPreformatted(node);
    blocks.push({
      type: isPre ? "preformatted" : "paragraph",
      text,
      level: 0,
      isOrdered: false,
      indent: 0,
      bold: false,
      monospace: isPre,
      links: collectLinks(node),
    });
    return;
  }
  if (name === "text:list") {
    const isOrdered = node.attributes["text:style-name"]?.toLowerCase().includes("num") ?? false;
    orderedStack.push(isOrdered);
    for (const item of node.children) {
      if (item.name === "text:list-item") {
        for (const child of item.children) {
          if (child.name === "text:p") {
            const t = collectText(child);
            if (t.trim() === "") continue;
            blocks.push({
              type: "list-item",
              text: t,
              level: 0,
              isOrdered,
              indent,
              bold: false,
              monospace: false,
              links: collectLinks(child),
            });
          } else if (child.name === "text:list") {
            // Nested list
            walkContent(child, blocks, orderedStack, indent + 1);
          }
        }
      }
    }
    orderedStack.pop();
    return;
  }
  if (name === "text:section") {
    for (const child of node.children) walkContent(child, blocks, orderedStack, indent);
    return;
  }
  if (name === "table:table") {
    // Render each row as a paragraph of " | " joined cells.
    for (const row of node.children) {
      if (row.name === "table:table-row") {
        const cells: string[] = [];
        for (const cell of row.children) {
          if (cell.name === "table:table-cell") {
            const cellText = collectText(cell).replace(/\s+/g, " ").trim();
            cells.push(cellText);
          }
        }
        if (cells.length > 0) {
          blocks.push({
            type: "paragraph",
            text: cells.join(" | "),
            level: 0,
            isOrdered: false,
            indent: 0,
            bold: false,
            monospace: false,
            links: [],
          });
        }
      }
    }
    return;
  }
}

function findChild(node: XmlNode, name: string): XmlNode | null {
  return node.children.find((c) => c.name === name) ?? null;
}

/** Collect all text content from a node (recursively, joining text:line-break as '\n' and text:tab as '\t'). */
function collectText(node: XmlNode): string {
  let out = "";
  // Include the node's own text content (which the parser concatenates from
  // all text fragments between child elements — order may be slightly off
  // when mixed with elements, but the text is preserved).
  if (node.text) out += node.text;
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
  return out.replace(/\s+$/, "");
}

function collectLinks(node: XmlNode): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  const walk = (n: XmlNode) => {
    if (n.name === "text:a") {
      const url = n.attributes["xlink:href"] ?? "";
      if (url) links.push({ text: collectText(n), url });
    }
    for (const c of n.children) walk(c);
  };
  walk(node);
  return links;
}

function isPreformatted(node: XmlNode): boolean {
  const style = node.attributes["text:style-name"] ?? "";
  return style.toLowerCase().includes("pre") || style.toLowerCase().includes("source");
}

// ===== Metadata extraction =====

export function parseMeta(metaXml: string): OdtMetadata {
  const result: OdtMetadata = {
    title: "", author: "", subject: "", keywords: "",
    description: "", generator: "", creationDate: "", metaFound: true,
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
      case "meta:keyword": result.keywords = text; break;
      case "dc:description": result.description = text; break;
      case "meta:generator": result.generator = text; break;
      case "meta:creation-date": result.creationDate = text; break;
    }
  }
  return result;
}

function findChildren(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

// ===== Stats =====

export function computeStats(blocks: TextBlock[], pageCount: number, pdfBytes: number): OdtStats {
  let paragraphCount = 0;
  let headingCount = 0;
  let listItemCount = 0;
  let preformattedCount = 0;
  let wordCount = 0;
  let charCount = 0;
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph": paragraphCount++; break;
      case "heading": headingCount++; break;
      case "list-item": listItemCount++; break;
      case "preformatted": preformattedCount++; break;
    }
    charCount += b.text.length;
    wordCount += b.text.split(/\s+/).filter((s) => s.length > 0).length;
  }
  return {
    blockCount: blocks.length,
    paragraphCount,
    headingCount,
    listItemCount,
    preformattedCount,
    wordCount,
    charCount,
    pageCount,
    pdfBytes,
  };
}

// ===== PDF rendering =====

export async function convertOdtToPdf(
  odtBytes: Uint8Array,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<{ bytes: Uint8Array; stats: OdtStats; metadata: OdtMetadata }>> {
  if (!isOdtArchive(odtBytes)) {
    return { ok: false, error: "Not an ODT file — missing ZIP signature." };
  }
  try {
    const contentBytes = await readZipEntry(odtBytes, "content.xml");
    if (!contentBytes) {
      return { ok: false, error: "ODT is missing content.xml — the file may be corrupted." };
    }
    const contentXml = new TextDecoder("utf-8").decode(contentBytes);
    const blocks = extractBlocks(contentXml);
    if (blocks.length === 0) {
      return { ok: false, error: "No text content found in the ODT file." };
    }

    let metadata: OdtMetadata = {
      title: "", author: "", subject: "", keywords: "",
      description: "", generator: "", creationDate: "", metaFound: false,
    };
    try {
      const metaBytes = await readZipEntry(odtBytes, "meta.xml");
      if (metaBytes) {
        const metaXml = new TextDecoder("utf-8").decode(metaBytes);
        metadata = parseMeta(metaXml);
      }
    } catch {
      // Meta parsing is optional.
    }

    const doc = await PDFDocument.create();
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
    const monoFont = await doc.embedFont(StandardFonts.Courier);

    const base = opts.pageSize === "a4" ? PageSizes.A4
      : opts.pageSize === "legal" ? PageSizes.Legal
      : PageSizes.Letter;
    const pageW = base[0];
    const pageH = base[1];
    const margin = Math.max(20, Math.min(120, opts.margin));
    const availW = pageW - margin * 2;
    const fs = Math.max(8, Math.min(24, opts.fontSize));

    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const ensureSpace = (lineHeight: number) => {
      if (y - lineHeight < margin) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
    };

    let pageCount = 1;

    for (const block of blocks) {
      let blockFs = fs;
      let blockFont = regularFont;
      let lineHeight = blockFs * 1.4;
      let prefix = "";
      if (block.type === "heading") {
        blockFs = Math.max(fs, 18 - (block.level - 1) * 2);
        blockFont = boldFont;
        lineHeight = blockFs * 1.5;
        ensureSpace(lineHeight * 2);
        ensureSpace(lineHeight);
        if (y < pageH - margin) y -= blockFs * 0.4;
      } else if (block.type === "list-item") {
        blockFont = regularFont;
        prefix = block.isOrdered ? "• " : "• ";
        // Indent
        const indentPx = block.indent * 18;
        ensureSpace(lineHeight);
        const lines = wrapText(prefix + block.text, blockFont, blockFs, availW - indentPx);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(lineHeight);
          page.drawText(lines[i]!, { x: margin + indentPx, y: y - blockFs, size: blockFs, font: blockFont, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
        continue;
      } else if (block.monospace) {
        blockFont = monoFont;
      }
      const indentPx = 0;
      const lines = wrapText(block.text, blockFont, blockFs, availW - indentPx);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(lineHeight);
        page.drawText(lines[i]!, { x: margin + indentPx, y: y - blockFs, size: blockFs, font: blockFont, color: rgb(0, 0, 0) });
        y -= lineHeight;
        if (y < margin) {
          pageCount++;
        }
      }
      if (block.type === "heading") {
        y -= blockFs * 0.3;
      }
    }

    // Apply title
    const title = opts.title || metadata.title || "Converted from ODT";
    doc.setTitle(title);
    if (metadata.author) doc.setAuthor(metadata.author);
    if (metadata.subject) doc.setSubject(metadata.subject);
    if (metadata.keywords) doc.setKeywords(metadata.keywords.split(/[,\s]+/).filter((s) => s.length > 0));
    doc.setProducer("UnQTools — ODT to PDF");
    doc.setCreator("UnQTools — ODT to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());

    pageCount = doc.getPageCount();
    const pdfBytes = await doc.save();
    const stats = computeStats(blocks, pageCount, pdfBytes.length);
    void italicFont;
    return { ok: true, output: { bytes: pdfBytes, stats, metadata } };
  } catch (e) {
    return { ok: false, error: `ODT to PDF conversion failed: ${(e as Error).message}` };
  }
}

/** Word-wrap text to a given available width using the font's widthOfTextAtSize. */
function wrapText(text: string, font: { widthOfTextAtSize: (s: string, n: number) => number }, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para === "") {
      result.push("");
      continue;
    }
    // Replace tabs with 4 spaces
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

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-odt-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  odtBytes: number;
  pdfBytes: number;
  blockCount: number;
  pageCount: number;
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
  params.set("fs", String(opts.fontSize));
  params.set("page", opts.pageSize);
  params.set("margin", String(opts.margin));
  if (opts.title) params.set("title", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConvertOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("fs") && !params.has("page")) return null;
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const page = (params.get("page") ?? "a4") as ConvertOptions["pageSize"];
  const margin = parseInt(params.get("margin") ?? "50", 10);
  const title = params.get("title") ?? "";
  const validPages: ConvertOptions["pageSize"][] = ["a4", "letter", "legal"];
  return {
    fontSize: isNaN(fs) ? 12 : Math.max(8, Math.min(24, fs)),
    pageSize: validPages.includes(page) ? page : "a4",
    margin: isNaN(margin) ? 50 : Math.max(20, Math.min(120, margin)),
    title,
  };
}
