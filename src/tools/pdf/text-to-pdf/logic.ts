/**
 * Text to PDF — advanced.
 *
 * Font choice (Helvetica / Times / Courier), size, line spacing, alignment,
 * margins, page size/orientation, optional page numbers and a header/footer
 * line. Long lines wrap to the content width; multi-page output. Selectable
 * text (no rasterization). `wrapText` is exported pure for tests.
 */
import { PDFDocument, StandardFonts, PageSizes, rgb, type PDFFont } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type TextFont = "helvetica" | "times" | "courier";
export type TextAlign = "left" | "center" | "right" | "justify";

export interface TextToPdfOptions {
  fontSize?: number;
  lineSpacing?: number;
  align?: TextAlign;
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: number;
  font?: TextFont;
  pageNumbers?: boolean;
  header?: string;
  footer?: string;
}

export const FONT_MAP: Record<TextFont, StandardFonts> = {
  helvetica: StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
};

/** Wrap text into lines that fit the given width (pure, testable). */
export function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") {
      out.push("");
      continue;
    }
    const words = raw.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export async function textToPdf(text: string, opts: TextToPdfOptions = {}): Promise<ToolResult<Uint8Array>> {
  if (!text.trim()) return { ok: false, error: "Enter some text to convert." };
  try {
    const doc = await PDFDocument.create();
    const fontName = FONT_MAP[opts.font ?? "helvetica"];
    const font = await doc.embedFont(fontName);
    const fs = Math.max(8, Math.min(Number(opts.fontSize) || 12, 36));
    const lineSpacing = Math.max(1, Math.min(Number(opts.lineSpacing) || 1.4, 3));
    const lineHeight = fs * lineSpacing;
    const margin = Math.max(20, Number(opts.margin) || 48);
    const align = opts.align ?? "left";
    const base = opts.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
    const isLandscape = opts.orientation === "landscape";
    const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    const availW = pageW - margin * 2;
    const headerH = opts.header ? fs + 12 : 0;
    const footerH = opts.footer || opts.pageNumbers ? fs + 10 : 0;
    const topY = pageH - margin - headerH;
    const bottomY = margin + footerH;

    const wrapped = wrapText(text, availW, font, fs);

    let page = doc.addPage([pageW, pageH]);
    let y = topY;

    function drawHeaderFooter(p: typeof page, pageNo: number, total: number) {
      const gray = rgb(0.45, 0.45, 0.45);
      if (opts.header) {
        p.drawText(opts.header, { x: margin, y: pageH - margin - fs + 2, size: fs - 2, font, color: gray });
      }
      if (opts.footer) {
        p.drawText(opts.footer, { x: margin, y: margin + 2, size: fs - 2, font, color: gray });
      }
      if (opts.pageNumbers) {
        const label = `Page ${pageNo} of ${total}`;
        const w = font.widthOfTextAtSize(label, fs - 2);
        p.drawText(label, { x: pageW - margin - w, y: margin + 2, size: fs - 2, font, color: gray });
      }
    }

    const totalPages = Math.max(1, Math.ceil(wrapped.length / Math.max(1, Math.floor((topY - bottomY) / lineHeight))));
    let pageNo = 1;

    for (const line of wrapped) {
      if (y < bottomY) {
        drawHeaderFooter(page, pageNo, totalPages);
        page = doc.addPage([pageW, pageH]);
        pageNo++;
        y = topY;
      }
      if (line) {
        const w = font.widthOfTextAtSize(line, fs);
        let x = margin;
        if (align === "center") x = margin + (availW - w) / 2;
        else if (align === "right") x = pageW - margin - w;
        else if (align === "justify") x = margin;
        page.drawText(line, { x, y: y - fs, size: fs, font, color: rgb(0, 0, 0) });
      }
      y -= lineHeight;
    }
    drawHeaderFooter(page, pageNo, totalPages);

    doc.setProducer("UnQTools — Text to PDF");
    doc.setCreator("UnQTools — Text to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong during conversion." };
  }
}
