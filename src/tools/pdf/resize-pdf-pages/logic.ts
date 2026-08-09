/**
 * Resize PDF Pages — advanced.
 *
 * Change page size to a preset (A3/A4/A5/Letter/Legal/Tabloid/Executive) or
 * custom dimensions in pt/mm/in, portrait or landscape, with an optional
 * "fit content" mode that scales the page content to the new size
 * (contain = preserve aspect, stretch = fill exactly). Per-page ranges.
 */
import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type ResizePreset = "a3" | "a4" | "a5" | "letter" | "legal" | "tabloid" | "executive" | "custom";
export type ResizeUnit = "pt" | "mm" | "in";
export type FitMode = "none" | "contain" | "stretch";

export interface ResizeOptions {
  preset?: ResizePreset;
  /** Custom width in the given unit (when preset === "custom"). */
  customWidth?: number;
  customHeight?: number;
  unit?: ResizeUnit;
  orientation?: "portrait" | "landscape";
  /** Scale page content to fit the new size ("none" leaves content as-is). */
  fit?: FitMode;
  pages?: string;
}

const PRESETS: Record<Exclude<ResizePreset, "custom">, [number, number]> = {
  a3: PageSizes.A3,
  a4: PageSizes.A4,
  a5: PageSizes.A5,
  letter: PageSizes.Letter,
  legal: PageSizes.Legal,
  tabloid: PageSizes.Tabloid,
  executive: PageSizes.Executive,
};

export function unitToPt(value: number, unit: ResizeUnit): number {
  const v = Math.max(1, Number(value) || 1);
  switch (unit) {
    case "mm":
      return (v * 72) / 25.4;
    case "in":
      return v * 72;
    default:
      return v;
  }
}

export async function resizePdfPages(
  bytes: Uint8Array,
  opts: ResizeOptions = {}
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

  let baseW: number;
  let baseH: number;
  if (opts.preset === "custom" || !opts.preset) {
    if (opts.customWidth == null || opts.customHeight == null) {
      return { ok: false, error: "Enter custom width and height (or pick a preset)." };
    }
    const unit = opts.unit ?? "pt";
    baseW = unitToPt(opts.customWidth, unit);
    baseH = unitToPt(opts.customHeight, unit);
  } else {
    [baseW, baseH] = PRESETS[opts.preset];
  }
  const isLandscape = opts.orientation === "landscape";
  const newW = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const newH = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
  const fit = opts.fit ?? "none";

  try {
    for (const i of indices) {
      const page = doc.getPages()[i]!;
      const { width, height } = page.getSize();
      if (fit === "contain" || fit === "stretch") {
        const scale = fit === "stretch" ? Math.max(newW / width, newH / height) : Math.min(newW / width, newH / height);
        page.scaleContent(scale, scale);
      }
      page.setMediaBox(0, 0, newW, newH);
    }
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong while resizing." };
  }
}
