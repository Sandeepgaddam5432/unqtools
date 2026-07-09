import { PDFDocument, PDFRawStream, PDFRef } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface BlankResult { bytes: Uint8Array; originalCount: number; removedCount: number; keptCount: number; removedPageNumbers: number[]; }

/**
 * Check if a page is blank by examining its content stream(s).
 * A page is considered blank if it has no content stream OR all content streams
 * are empty (0 bytes of raw data).
 *
 * Note: Content streams are typically FlateDecode-compressed in modern PDFs,
 * so we check for the PRESENCE of raw stream data (not the decompressed content).
 * A truly blank page has either no Contents entry or an empty stream.
 */
function isBlankPage(page: ReturnType<PDFDocument["getPages"]>[number], doc: PDFDocument): boolean {
  try {
    const node = page.node;
    const contents = node.Contents();
    if (!contents) return true;
    // contents is a PDFArray — use .array property to get the elements
    const arr = (contents as { array?: unknown[] }).array;
    if (!arr || arr.length === 0) return true;
    let totalRawBytes = 0;
    for (const elem of arr) {
      if (elem instanceof PDFRef) {
        const looked = doc.context.lookup(elem);
        if (looked instanceof PDFRawStream) {
          totalRawBytes += looked.contents.length;
        }
      } else if (elem instanceof PDFRawStream) {
        totalRawBytes += elem.contents.length;
      }
    }
    // A page with any content stream data is not blank
    return totalRawBytes === 0;
  } catch {
    return false; // if we can't analyze, keep the page (safer)
  }
}

export async function removeBlankPages(bytes: Uint8Array): Promise<ToolResult<BlankResult>> {
  let src: PDFDocument;
  try { src = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };
  const keepIndices: number[] = [];
  const removedPageNumbers: number[] = [];
  const pages = src.getPages();
  for (let i = 0; i < total; i++) {
    if (isBlankPage(pages[i], src)) { removedPageNumbers.push(i + 1); }
    else { keepIndices.push(i); }
  }
  if (keepIndices.length === 0) return { ok: false, error: "All pages are blank — nothing to keep." };
  try {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, keepIndices);
    for (const p of copied) out.addPage(p);
    out.setProducer("UnQTools — Remove Blank Pages"); out.setCreator("UnQTools — Remove Blank Pages");
    return { ok: true, output: { bytes: await out.save(), originalCount: total, removedCount: removedPageNumbers.length, keptCount: keepIndices.length, removedPageNumbers } };
  } catch { return { ok: false, error: "Something went wrong while removing blank pages." }; }
}
