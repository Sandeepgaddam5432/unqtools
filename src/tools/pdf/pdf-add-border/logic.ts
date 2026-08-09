/**
 * Add Page Border to PDF — real engine.
 *
 * Draws a border frame on pages: width, color, solid/dashed/double style,
 * optional inset margin, and per-page ranges. Drawn as a vector overlay so
 * the PDF stays crisp and selectable.
 */
import { PDFDocument, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type BorderStyle = "solid" | "dashed" | "double";

export interface BorderOptions {
  /** Border width in pt (0.25–24). Default 2. */
  width?: number;
  /** Hex color. Default "#000000". */
  color?: string;
  /** Style. Default "solid". */
  style?: BorderStyle;
  /** Inset from page edge in pt (0–100). Default 12. */
  inset?: number;
  /** Page range to apply to (empty = all). */
  pages?: string;
}

export interface BorderResult {
  bytes: Uint8Array;
  pagesBordered: number;
}

export interface RgbParts {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbParts {
  const clean = (hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/**
 * Pure: compute the four border rectangles for a page of w×h with inset and
 * width. Returns [{x,y,width,height}] — top, bottom, left, right.
 */
export function borderRects(
  w: number,
  h: number,
  inset: number,
  width: number
): { x: number; y: number; width: number; height: number }[] {
  const i = Math.max(0, Math.min(w / 2 - 1, h / 2 - 1, inset));
  const bw = Math.max(0.25, Math.min(24, width));
  return [
    { x: i, y: h - i - bw, width: w - 2 * i, height: bw }, // top
    { x: i, y: i, width: w - 2 * i, height: bw }, // bottom
    { x: i, y: i + bw, width: bw, height: h - 2 * i - 2 * bw }, // left
    { x: w - i - bw, y: i + bw, width: bw, height: h - 2 * i - 2 * bw }, // right
  ];
}

export async function addPageBorder(
  bytes: Uint8Array,
  options: BorderOptions = {}
): Promise<ToolResult<BorderResult>> {
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

  const width = Math.max(0.25, Math.min(24, Number(options.width) || 2));
  const inset = Math.max(0, Math.min(100, Number(options.inset) || 12));
  const style = options.style ?? "solid";
  const c = hexToRgb(options.color ?? "#000000");
  const color = rgb(c.r, c.g, c.b);

  try {
    const pages = doc.getPages();
    for (const i of indices) {
      const page = pages[i]!;
      const { width: pw, height: ph } = page.getSize();
      const rects = borderRects(pw, ph, inset, width);
      const drawRect = (r: { x: number; y: number; width: number; height: number }) => {
        if (style === "dashed") {
          page.drawRectangle({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            borderColor: color,
            borderWidth: Math.min(width, r.height),
            borderDashArray: [4, 3],
            color: undefined,
          });
        } else if (style === "double") {
          // Outer + inner thin lines.
          const half = Math.max(0.5, width / 2);
          page.drawRectangle({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            borderColor: color,
            borderWidth: half,
            color: undefined,
          });
          page.drawRectangle({
            x: r.x + 2,
            y: r.y + 2,
            width: Math.max(1, r.width - 4),
            height: Math.max(1, r.height - 4),
            borderColor: color,
            borderWidth: half,
            color: undefined,
          });
        } else {
          page.drawRectangle({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            borderColor: color,
            borderWidth: Math.min(width, r.height),
            color: undefined,
          });
        }
      };
      for (const r of rects) drawRect(r);
    }
    return { ok: true, output: { bytes: await doc.save(), pagesBordered: indices.length } };
  } catch {
    return { ok: false, error: "Something went wrong while adding the border." };
  }
}
