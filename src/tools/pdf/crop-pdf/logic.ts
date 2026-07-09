import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface CropOptions {
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  pages?: string;
}

export async function cropPdf(bytes: Uint8Array, opts: CropOptions): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (opts.pages ?? "").trim();
  if (spec) { const p = parsePageRanges(spec, total); if (!p.ok) return p; indices = [...new Set(p.output)]; }
  else { indices = Array.from({ length: total }, (_, i) => i); }
  if (indices.length === 0) return { ok: false, error: "No pages matched." };
  const m = (v: number) => Math.max(0, Math.floor(v));
  const top = m(opts.marginTop), bottom = m(opts.marginBottom), left = m(opts.marginLeft), right = m(opts.marginRight);
  try {
    for (const i of indices) {
      const page = doc.getPages()[i];
      const { width, height } = page.getSize();
      const newW = width - left - right;
      const newH = height - top - bottom;
      if (newW < 1 || newH < 1) return { ok: false, error: "Margins are too large — the crop area would be empty on some pages." };
      page.setCropBox(left, bottom, newW, newH);
    }
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while cropping." }; }
}
