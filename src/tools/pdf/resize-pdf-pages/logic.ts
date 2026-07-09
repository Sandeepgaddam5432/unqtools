import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface ResizeOptions { preset: "a4" | "letter" | "legal" | "a3" | "custom"; customWidth?: number; customHeight?: number; orientation: "portrait" | "landscape"; pages?: string; }

const PRESETS: Record<Exclude<ResizeOptions["preset"], "custom">, [number, number]> = {
  a4: PageSizes.A4, letter: PageSizes.Letter, legal: PageSizes.Legal, a3: PageSizes.A3,
};

export async function resizePdfPages(bytes: Uint8Array, opts: ResizeOptions): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (opts.pages ?? "").trim();
  if (spec) { const p = parsePageRanges(spec, total); if (!p.ok) return p; indices = [...new Set(p.output)]; }
  else { indices = Array.from({ length: total }, (_, i) => i); }
  let baseW: number, baseH: number;
  if (opts.preset === "custom") {
    const cw = Number(opts.customWidth); const ch = Number(opts.customHeight);
    if (!Number.isFinite(cw) || cw < 1 || !Number.isFinite(ch) || ch < 1) return { ok: false, error: "Enter valid custom width and height (≥ 1 pt)." };
    baseW = Math.floor(cw); baseH = Math.floor(ch);
  }
  else { [baseW, baseH] = PRESETS[opts.preset]; }
  const isLandscape = opts.orientation === "landscape";
  const newW = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const newH = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
  try {
    for (const i of indices) { doc.getPages()[i].setMediaBox(0, 0, newW, newH); }
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while resizing." }; }
}
