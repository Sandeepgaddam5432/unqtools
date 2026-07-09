import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
export async function flattenPdf(bytes: Uint8Array): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try { src = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  try {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
    // Do NOT copy form fields — this is what "flattens" the PDF
    out.setProducer("UnQTools — Flatten PDF"); out.setCreator("UnQTools — Flatten PDF");
    out.setCreationDate(new Date()); out.setModificationDate(new Date());
    return { ok: true, output: await out.save() };
  } catch { return { ok: false, error: "Something went wrong while flattening." }; }
}
