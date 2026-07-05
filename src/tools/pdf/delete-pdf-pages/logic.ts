import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface DeleteResult {
  bytes: Uint8Array;
  keptCount: number;
  removedCount: number;
}

export async function deletePdfPages(
  bytes: Uint8Array,
  deleteSpec: string
): Promise<ToolResult<DeleteResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const parsed = parsePageRanges(deleteSpec, total);
  if (!parsed.ok) return parsed;
  const deleteSet = new Set(parsed.output);
  if (deleteSet.size === total) {
    return { ok: false, error: "This would delete all pages. Keep at least one page." };
  }
  const keptIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !deleteSet.has(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keptIndices);
  for (const page of pages) out.addPage(page);
  return {
    ok: true,
    output: { bytes: await out.save(), keptCount: keptIndices.length, removedCount: deleteSet.size },
  };
}
