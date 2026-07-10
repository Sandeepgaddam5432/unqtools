import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface MdToPdfOptions { pageSize: "a4" | "letter"; orientation: "portrait" | "landscape"; margin: number; }

interface RenderLine { text: string; fontSize: number; bold: boolean; italic: boolean; indent: number; bullet?: boolean; }

/**
 * Parse markdown into render lines (simplified parser).
 * Handles: headings, bold, italic, inline code, lists, blockquotes, hr.
 */
function parseMarkdown(md: string): RenderLine[] {
  const lines: RenderLine[] = [];
  const rawLines = md.split("\n");
  let inCodeBlock = false;
  for (const raw of rawLines) {
    const line = raw;
    // Code block toggle
    if (line.trim().startsWith("```")) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) { lines.push({ text: line, fontSize: 10, bold: false, italic: false, indent: 1 }); continue; }
    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const size = level === 1 ? 24 : level === 2 ? 20 : level === 3 ? 16 : 14;
      lines.push({ text: stripMarkdown(hMatch[2]), fontSize: size, bold: true, italic: false, indent: 0 });
      continue;
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) { lines.push({ text: "-------------------------", fontSize: 10, bold: false, italic: false, indent: 0 }); continue; }
    // Blockquote
    if (line.startsWith("> ")) { lines.push({ text: stripMarkdown(line.slice(2)), fontSize: 12, bold: false, italic: true, indent: 1 }); continue; }
    // Unordered list
    if (/^[-*+]\s+/.test(line)) { lines.push({ text: stripMarkdown(line.replace(/^[-*+]\s+/, "")), fontSize: 12, bold: false, italic: false, indent: 1, bullet: true }); continue; }
    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) { lines.push({ text: `${olMatch[1]}. ${stripMarkdown(olMatch[2])}`, fontSize: 12, bold: false, italic: false, indent: 1 }); continue; }
    // Empty line
    if (line.trim() === "") { lines.push({ text: "", fontSize: 12, bold: false, italic: false, indent: 0 }); continue; }
    // Normal text
    lines.push({ text: stripMarkdown(line), fontSize: 12, bold: false, italic: false, indent: 0 });
  }
  return lines;
}

/** Strip inline markdown formatting (bold, italic, code) for plain text rendering. */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

export async function markdownToPdf(md: string, opts: MdToPdfOptions): Promise<ToolResult<Uint8Array>> {
  if (!md.trim()) return { ok: false, error: "Enter some Markdown to convert." };
  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const base = opts.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
    const isLandscape = opts.orientation === "landscape";
    const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    const margin = Math.max(20, opts.margin);
    const availW = pageW - margin * 2;

    const renderLines = parseMarkdown(md);
    let y = pageH - margin;
    let page = doc.addPage([pageW, pageH]);
    const black = rgb(0, 0, 0);

    for (const line of renderLines) {
      const f = line.bold ? fontBold : line.italic ? fontItalic : font;
      const lineHeight = line.fontSize * 1.5;
      const indent = line.indent * 20;
      const text = line.bullet ? "• " + line.text : line.text;
      // Simple wrapping
      const words = text.split(" ");
      let current = "";
      const wrapped: string[] = [];
      for (const word of words) {
        const test = current ? current + " " + word : word;
        if (f.widthOfTextAtSize(test, line.fontSize) > availW - indent && current) { wrapped.push(current); current = word; }
        else { current = test; }
      }
      if (current) wrapped.push(current);
      for (const w of wrapped) {
        if (y < margin) { page = doc.addPage([pageW, pageH]); y = pageH - margin; }
        if (w) page.drawText(w, { x: margin + indent, y: y - line.fontSize, size: line.fontSize, font: f, color: black });
        y -= lineHeight;
      }
    }
    doc.setProducer("UnQTools — Markdown to PDF"); doc.setCreator("UnQTools — Markdown to PDF");
    doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong during conversion." }; }
}
