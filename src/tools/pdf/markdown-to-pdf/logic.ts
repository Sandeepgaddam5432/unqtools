/**
 * Markdown to PDF — advanced.
 *
 * Renders Markdown (headings, bold/italic/inline code, ordered/unordered
 * lists, blockquotes, code blocks, horizontal rules, GFM tables) as
 * selectable text PDF pages with page size/orientation/margin options and
 * optional page numbers. `parseMarkdown` is exported pure for tests.
 */
import { PDFDocument, StandardFonts, PageSizes, rgb, type PDFFont } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface MdToPdfOptions {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: number;
  /** Draw "Page N" at the bottom. Default false. */
  pageNumbers?: boolean;
  /** Base font size for body text. Default 12. */
  bodySize?: number;
}

export interface RenderLine {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  indent: number;
  bullet?: boolean;
  mono?: boolean;
  /** GFM table rows: array of cells. */
  table?: string[];
  isHeader?: boolean;
}

/** Split a GFM table line into cells. Pure. */
export function splitTableRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith("|") && !t.endsWith("|")) return null;
  const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  return cells;
}

/** True when the line is a GFM table separator like |---|---|. */
export function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim()) && line.includes("---");
}

/** Parse markdown into render lines (pure, testable). */
export function parseMarkdown(md: string): RenderLine[] {
  const lines: RenderLine[] = [];
  const rawLines = md.split("\n");
  let inCodeBlock = false;
  let tableAcc: string[] | null = null;

  const flushTable = () => {
    if (tableAcc && tableAcc.length > 0) {
      // First row = header.
      for (let r = 0; r < tableAcc.length; r++) {
        const cells = splitTableRow(tableAcc[r]!) ?? [tableAcc[r]!.trim()];
        lines.push({ text: cells.join(" | "), fontSize: 10, bold: r === 0, italic: false, indent: 0, table: cells, isHeader: r === 0 });
      }
      lines.push({ text: "", fontSize: 8, bold: false, italic: false, indent: 0 });
      tableAcc = null;
    }
  };

  for (const raw of rawLines) {
    const line = raw;
    if (line.trim().startsWith("```")) {
      if (tableAcc) flushTable();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      lines.push({ text: line, fontSize: 9, bold: false, italic: false, indent: 1, mono: true });
      continue;
    }
    // GFM table detection
    if (line.trim().startsWith("|") && tableAcc === null) {
      tableAcc = [line];
      continue;
    }
    if (tableAcc !== null) {
      if (isTableSeparator(line)) continue;
      if (line.trim().startsWith("|")) {
        tableAcc.push(line);
        continue;
      }
      flushTable();
    }
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1]!.length;
      const size = level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 15 : 13;
      lines.push({ text: stripMarkdown(hMatch[2]!), fontSize: size, bold: true, italic: false, indent: 0 });
      continue;
    }
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      lines.push({ text: "--------------------------------------------------", fontSize: 10, bold: false, italic: false, indent: 0 });
      continue;
    }
    if (line.startsWith("> ")) {
      lines.push({ text: stripMarkdown(line.slice(2)), fontSize: 11, bold: false, italic: true, indent: 1 });
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      lines.push({ text: stripMarkdown(line.replace(/^[-*+]\s+/, "")), fontSize: 12, bold: false, italic: false, indent: 1, bullet: true });
      continue;
    }
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      lines.push({ text: `${olMatch[1]}. ${stripMarkdown(olMatch[2]!)}`, fontSize: 12, bold: false, italic: false, indent: 1 });
      continue;
    }
    if (line.trim() === "") {
      lines.push({ text: "", fontSize: 12, bold: false, italic: false, indent: 0 });
      continue;
    }
    lines.push({ text: stripMarkdown(line), fontSize: 12, bold: false, italic: false, indent: 0 });
  }
  if (tableAcc) flushTable();
  return lines;
}

/** Strip inline markdown formatting for plain rendering. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[(.+?)\]\(.+?\)/g, "$1");
}

export async function markdownToPdf(md: string, opts: MdToPdfOptions = {}): Promise<ToolResult<Uint8Array>> {
  if (!md.trim()) return { ok: false, error: "Enter some Markdown to convert." };
  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const fontMono = await doc.embedFont(StandardFonts.Courier);
    const base = opts.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
    const isLandscape = opts.orientation === "landscape";
    const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    const margin = Math.max(20, Number(opts.margin) || 48);
    const availW = pageW - margin * 2;
    const bodySize = Math.max(8, Math.min(Number(opts.bodySize) || 12, 24));
    const pageNumbers = opts.pageNumbers ?? false;

    const renderLines = parseMarkdown(md);
    // Scale heading sizes relative to body.
    const sizeOf = (l: RenderLine): number => (l.fontSize === 12 ? bodySize : Math.max(9, Math.round((l.fontSize / 12) * bodySize)));

    let y = pageH - margin;
    let page = doc.addPage([pageW, pageH]);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.45, 0.45, 0.45);
    let pageNo = 1;
    const totalPages = 1; // computed after first pass below (approximate)
    void totalPages;

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      pageNo++;
      y = pageH - margin;
    };

    for (const line of renderLines) {
      const f: PDFFont = line.mono ? fontMono : line.bold ? fontBold : line.italic ? fontItalic : font;
      const fs = line.mono ? Math.max(8, bodySize - 2) : sizeOf(line);
      const lineHeight = fs * (line.table ? 1.4 : 1.5);
      const indent = line.indent * 18;
      const text = line.bullet ? "• " + line.text : line.text;

      // GFM table — draw cells with a light border.
      if (line.table && line.table.length > 0) {
        const cols = line.table.length;
        const colW = (availW - indent) / cols;
        for (let c = 0; c < cols; c++) {
          if (y < margin + fs) newPage();
          const cellText = line.table[c] ?? "";
          page.drawRectangle({
            x: margin + indent + c * colW,
            y: y - fs - 2,
            width: colW,
            height: fs + 4,
            borderColor: line.isHeader ? rgb(0.7, 0.7, 0.7) : rgb(0.85, 0.85, 0.85),
            borderWidth: 0.4,
            color: line.isHeader ? rgb(0.95, 0.95, 0.95) : undefined,
          });
          if (cellText) {
            page.drawText(cellText, {
              x: margin + indent + c * colW + 3,
              y: y - fs + 2,
              size: fs - 1,
              font: line.isHeader ? fontBold : font,
              color: black,
            });
          }
        }
        y -= lineHeight + 3;
        continue;
      }

      const words = text.split(" ");
      let current = "";
      const wrapped: string[] = [];
      for (const word of words) {
        const test = current ? current + " " + word : word;
        if (f.widthOfTextAtSize(test, fs) > availW - indent && current) {
          wrapped.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) wrapped.push(current);

      for (const w of wrapped) {
        if (y < margin) newPage();
        if (w) page.drawText(w, { x: margin + indent, y: y - fs, size: fs, font: f, color: black });
        y -= lineHeight;
      }
    }

    // Draw page numbers on every page.
    if (pageNumbers) {
      const pages = doc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const label = `Page ${i + 1} of ${pages.length}`;
        const w = font.widthOfTextAtSize(label, 8);
        pages[i]!.drawText(label, { x: pageW - margin - w, y: margin / 2, size: 8, font, color: gray });
      }
    }

    doc.setProducer("UnQTools — Markdown to PDF");
    doc.setCreator("UnQTools — Markdown to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong during conversion." };
  }
}
