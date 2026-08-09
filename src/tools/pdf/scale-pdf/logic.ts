/**
 * Scale PDF Content — advanced.
 *
 * Scales page CONTENT (not just the page box) by 10–1000%, around a chosen
 * anchor (center or one of the corners), with an option to keep the page
 * size fixed (content scales inside the same sheet). Per-page ranges.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type ScaleAnchor = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface ScaleOptions {
  /** Scale factor: 0.1–10 (10%–1000%). */
  scale: number;
  /** Which point the content scales around. Default "center". */
  anchor?: ScaleAnchor;
  /** Keep the page size fixed (content scales within the sheet). Default false. */
  keepPageSize?: boolean;
  /** Comma-separated page spec. Empty = all pages. */
  pages?: string;
}

export function scaleAnchorOffsets(
  anchor: ScaleAnchor,
  width: number,
  height: number,
  scale: number
): { x: number; y: number } {
  const dw = width * (scale - 1);
  const dh = height * (scale - 1);
  switch (anchor) {
    case "top-left":
      return { x: 0, y: -dh };
    case "top-right":
      return { x: -dw, y: -dh };
    case "bottom-left":
      return { x: 0, y: 0 };
    case "bottom-right":
      return { x: -dw, y: 0 };
    case "center":
    default:
      return { x: -dw / 2, y: -dh / 2 };
  }
}

export async function scalePdf(bytes: Uint8Array, opts: ScaleOptions): Promise<ToolResult<Uint8Array>> {
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
  const scale = Number(opts.scale);
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 10) {
    return { ok: false, error: "Scale must be between 10% and 1000%." };
  }
  const keepPageSize = opts.keepPageSize ?? false;
  const anchor = opts.anchor ?? "center";

  try {
    for (const i of indices) {
      const page = doc.getPages()[i]!;
      const { width, height } = page.getSize();
      page.scaleContent(scale, scale);
      if (!keepPageSize) {
        page.setMediaBox(0, 0, width * scale, height * scale);
        continue;
      }
      // Keep the sheet size — recenter content so it doesn't spill off-page.
      const { x, y } = scaleAnchorOffsets(anchor, width, height, scale);
      // pdf-lib scales content around origin; translate back by the anchor offset.
      const w2 = width * scale;
      const h2 = height * scale;
      const tx = keepPageSize && anchor === "center" ? (width - w2) / 2 : x;
      const ty = keepPageSize && anchor === "center" ? (height - h2) / 2 : y;
      if (Math.abs(tx) > 0.1 || Math.abs(ty) > 0.1) {
        page.scaleContent(1, 1); // no-op guard
      }
      // Recenter via MediaBox translation so content stays visible.
      const origMedia = page.getMediaBox();
      page.setMediaBox(origMedia.x + tx, origMedia.y + ty, width, height);
    }
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong while scaling." };
  }
}
