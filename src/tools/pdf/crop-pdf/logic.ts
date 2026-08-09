/**
 * Crop PDF Pages — advanced.
 * Margin presets, custom margins, units (mm / in / pt), per-page ranges,
 * live dimension preview, and a "reset to full page" option.
 * Cropping is done by setting the page CropBox (non-destructive — original
 * content is preserved and can be restored by resetting the crop).
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type CropUnit = "mm" | "in" | "pt";

export interface CropOptions {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  unit?: CropUnit;
  pages?: string;
  /** When true, removes any existing CropBox (restores full page). */
  reset?: boolean;
}

export interface PageSizeInfo {
  page: number; // 1-indexed
  width: number;
  height: number;
}

export interface CropPreview {
  before: PageSizeInfo[];
  after: PageSizeInfo[];
}

/** Convert a margin value in the given unit to PDF points (1 pt = 1/72 inch). */
export function toPoints(value: number, unit: CropUnit): number {
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  switch (unit) {
    case "mm":
      return (v * 72) / 25.4;
    case "in":
      return v * 72;
    case "pt":
    default:
      return v;
  }
}

/** Common margin presets (in millimetres, all sides). */
export const CROP_PRESETS: { id: string; label: string; mm: number }[] = [
  { id: "trim-5", label: "Trim 5 mm", mm: 5 },
  { id: "trim-10", label: "Trim 10 mm", mm: 10 },
  { id: "trim-15", label: "Trim 15 mm", mm: 15 },
  { id: "cut-25", label: "Cut 25 mm (book margin)", mm: 25 },
];

export async function cropPdf(
  bytes: Uint8Array,
  opts: CropOptions
): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (opts.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
    indices = [...new Set(p.output)];
  } else {
    indices = Array.from({ length: total }, (_, i) => i);
  }
  if (indices.length === 0) return { ok: false, error: "No pages matched." };

  const unit = opts.unit ?? "pt";
  const top = toPoints(opts.marginTop, unit);
  const bottom = toPoints(opts.marginBottom, unit);
  const left = toPoints(opts.marginLeft, unit);
  const right = toPoints(opts.marginRight, unit);

  try {
    for (const i of indices) {
      const page = doc.getPages()[i]!;
      const { width, height } = page.getSize();
      if (opts.reset) {
        // Reset CropBox to the full media box.
        page.setCropBox(0, 0, width, height);
        continue;
      }
      const newW = width - left - right;
      const newH = height - top - bottom;
      if (newW < 1 || newH < 1) {
        return {
          ok: false,
          error: "Margins are too large — the crop area would be empty on some pages.",
        };
      }
      page.setCropBox(left, bottom, newW, newH);
    }
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong while cropping — please try again." };
  }
}

/** Compute before/after page dimensions without saving (for the UI preview). */
export async function previewCrop(
  bytes: Uint8Array,
  opts: CropOptions
): Promise<ToolResult<CropPreview>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = doc.getPageCount();
  let selected: Set<number>;
  const spec = (opts.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
    selected = new Set([...new Set(p.output)]);
  } else {
    selected = new Set(Array.from({ length: total }, (_, i) => i));
  }
  const unit = opts.unit ?? "pt";
  const top = toPoints(opts.marginTop, unit);
  const bottom = toPoints(opts.marginBottom, unit);
  const left = toPoints(opts.marginLeft, unit);
  const right = toPoints(opts.marginRight, unit);

  const before: PageSizeInfo[] = [];
  const after: PageSizeInfo[] = [];
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const { width, height } = pages[i]!.getSize();
    before.push({ page: i + 1, width: Math.round(width), height: Math.round(height) });
    if (opts.reset || !selected.has(i)) {
      after.push({ page: i + 1, width: Math.round(width), height: Math.round(height) });
    } else {
      after.push({
        page: i + 1,
        width: Math.max(1, Math.round(width - left - right)),
        height: Math.max(1, Math.round(height - top - bottom)),
      });
    }
  }
  return { ok: true, output: { before, after } };
}
