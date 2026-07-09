import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";
export interface ScaleOptions { scale: number; pages?: string; }
export async function scalePdf(bytes: Uint8Array, opts: ScaleOptions): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (opts.pages ?? "").trim();
  if (spec) { const p = parsePageRanges(spec, total); if (!p.ok) return p; indices = [...new Set(p.output)]; }
  else { indices = Array.from({ length: total }, (_, i) => i); }
  const scale = opts.scale;
  if (scale < 0.25 || scale > 4) return { ok: false, error: "Scale must be between 25% and 400%." };
  try {
    for (const i of indices) {
      const page = doc.getPages()[i];
      const { width, height } = page.getSize();
      // scaleContent scales the content; then we resize the media box to match
      page.scaleContent(scale, scale);
      page.setMediaBox(0, 0, width * scale, height * scale);
    }
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while scaling." }; }
}
