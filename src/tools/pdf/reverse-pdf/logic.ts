/**
 * Reverse PDF — pure logic (pdf-lib).
 *
 * Reverses the order of pages in a PDF. Last page becomes first, first becomes last.
 * Page content is preserved exactly — only the order changes.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export async function reversePdf(bytes: Uint8Array): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  const total = src.getPageCount();
  if (total < 2) {
    return { ok: false, error: "The PDF has fewer than 2 pages — nothing to reverse." };
  }

  try {
    const out = await PDFDocument.create();
    // Copy pages in reverse order
    for (let i = total - 1; i >= 0; i--) {
      const [page] = await out.copyPages(src, [i]);
      out.addPage(page);
    }
    out.setProducer("UnQTools — Reverse PDF");
    out.setCreator("UnQTools — Reverse PDF");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return { ok: true, output: await out.save() };
  } catch {
    return { ok: false, error: "Something went wrong while reversing — please try again." };
  }
}
