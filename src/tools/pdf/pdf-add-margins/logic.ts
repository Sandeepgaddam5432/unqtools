/**
 * Add Margins to PDF — real engine.
 *
 * Grows the page size and shifts the visible crop so a uniform margin of
 * whitespace surrounds the existing content on each selected page. The
 * content itself is never re-rasterized — it stays exactly where it was.
 *
 * Implementation: new MediaBox = old + 2×margin, CropBox = old size offset
 * by margin → viewers show content + whitespace margin around it.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type MarginUnit = "mm" | "in" | "pt";

export interface MarginOptions {
  top: number;
  bottom: number;
  left: number;
  right: number;
  unit?: MarginUnit;
  /** Page range to apply to (empty = all). */
  pages?: string;
}

export interface MarginResult {
  bytes: Uint8Array;
  pagesModified: number;
  /** The page size change reported per page (pt). */
  addedWidth: number;
  addedHeight: number;
}

/** Convert a margin value to points. Pure + testable. */
export function toPoints(value: number, unit: MarginUnit): number {
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  switch (unit) {
    case "mm":
      return (v * 72) / 25.4;
    case "in":
      return v * 72;
    default:
      return v;
  }
}

export async function addMargins(
  bytes: Uint8Array,
  options: MarginOptions
): Promise<ToolResult<MarginResult>> {
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

  const unit = options.unit ?? "mm";
  const top = toPoints(options.top, unit);
  const bottom = toPoints(options.bottom, unit);
  const left = toPoints(options.left, unit);
  const right = toPoints(options.right, unit);
  const addedWidth = left + right;
  const addedHeight = top + bottom;

  try {
    const pages = doc.getPages();
    for (const i of indices) {
      const page = pages[i]!;
      const { width, height } = page.getSize();
      // Grow the media box on all four sides.
      page.setMediaBox(-left, -bottom, width + addedWidth, height + addedHeight);
      // CropBox stays at the old size but shifted by the margin, so the
      // visible area = content + margin whitespace.
      page.setCropBox(0, 0, width, height);
    }
    return {
      ok: true,
      output: { bytes: await doc.save(), pagesModified: indices.length, addedWidth, addedHeight },
    };
  } catch {
    return { ok: false, error: "Something went wrong while adding margins." };
  }
}
