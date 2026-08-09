/**
 * Add Header & Footer to PDF — real engine.
 *
 * Draws header/footer text (with {page} and {pages} placeholders) at
 * left/center/right positions, font size, bold, color, and per-page ranges.
 * Optional top/bottom rule lines like a word processor. Pure pdf-lib.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type HfPosition = "left" | "center" | "right";

export interface HeaderFooterOptions {
  headerText?: string;
  footerText?: string;
  headerPosition?: HfPosition;
  footerPosition?: HfPosition;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  /** Draw a thin rule under the header / above the footer. */
  rules?: boolean;
  /** Page range to apply to (empty = all). */
  pages?: string;
  /** Extra vertical offset from the page edge (pt). */
  margin?: number;
}

export interface HeaderFooterResult {
  bytes: Uint8Array;
  pagesModified: number;
}

export function hexToRgb(hex: string): RGB {
  const clean = (hex || "#333333").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return rgb(0.2, 0.2, 0.2);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Resolve placeholders in a template. Pure. */
export function resolveTemplate(
  template: string,
  page: number,
  total: number
): string {
  return template
    .replace(/\{page\}/gi, String(page))
    .replace(/\{pages\}/gi, String(total))
    .replace(/\{date\}/gi, new Date().toLocaleDateString())
    .replace(/\{time\}/gi, new Date().toLocaleTimeString());
}

export async function addHeaderFooter(
  bytes: Uint8Array,
  options: HeaderFooterOptions = {}
): Promise<ToolResult<HeaderFooterResult>> {
  const hasHeader = Boolean(options.headerText?.trim());
  const hasFooter = Boolean(options.footerText?.trim());
  if (!hasHeader && !hasFooter) {
    return { ok: false, error: "Enter a header and/or footer text." };
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
    indices = [...new Set(p.output)];
  } else {
    indices = Array.from({ length: total }, (_, i) => i);
  }
  if (indices.length === 0) return { ok: false, error: "No pages matched." };

  const fs = Math.max(6, Math.min(Number(options.fontSize) || 9, 36));
  const margin = Math.max(6, Math.min(80, Number(options.margin) || 18));
  const color = hexToRgb(options.color ?? "#333333");
  const rules = options.rules ?? false;

  try {
    const font: PDFFont = options.bold
      ? await doc.embedFont(StandardFonts.HelveticaBold)
      : await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();

    const drawLine = (
      page: (typeof pages)[number],
      text: string,
      position: HfPosition,
      y: number
    ) => {
      const w = font.widthOfTextAtSize(text, fs);
      const { width } = page.getSize();
      const x =
        position === "left"
          ? margin
          : position === "right"
            ? width - margin - w
            : (width - w) / 2;
      page.drawText(text, { x, y, size: fs, font, color });
    };

    for (const i of indices) {
      const page = pages[i]!;
      const { width, height } = page.getSize();
      const pageNo = i + 1;

      if (hasHeader) {
        const text = resolveTemplate(options.headerText!, pageNo, total);
        const y = height - margin - fs;
        drawLine(page, text, options.headerPosition ?? "center", y);
        if (rules) {
          page.drawLine({ start: { x: margin, y: y - 3 }, end: { x: width - margin, y: y - 3 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
        }
      }
      if (hasFooter) {
        const text = resolveTemplate(options.footerText!, pageNo, total);
        const y = margin;
        drawLine(page, text, options.footerPosition ?? "center", y);
        if (rules) {
          page.drawLine({ start: { x: margin, y: y + fs + 3 }, end: { x: width - margin, y: y + fs + 3 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
        }
      }
    }

    return { ok: true, output: { bytes: await doc.save(), pagesModified: indices.length } };
  } catch {
    return { ok: false, error: "Something went wrong while adding the header/footer." };
  }
}
