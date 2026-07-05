import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type ReorderMode = "custom" | "reverse" | "duplicate";

export interface ReorderOptions {
  mode: ReorderMode;
  /** For mode "custom": comma-separated page sequence, e.g. "3,1,2" */
  sequence?: string;
}

export async function reorderPdfPages(
  bytes: Uint8Array,
  options: ReorderOptions
): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  let indices: number[];
  if (options.mode === "reverse") {
    indices = Array.from({ length: total }, (_, i) => total - 1 - i);
  } else if (options.mode === "duplicate") {
    indices = Array.from({ length: total }, (_, i) => i).flatMap((i) => [i, i]);
  } else {
    const spec = (options.sequence ?? "").trim();
    if (!spec) return { ok: false, error: "Enter the page order, e.g. 3,1,2." };
    const parsed = parsePageRanges(spec, total);
    if (!parsed.ok) return parsed;
    indices = parsed.output;
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  return { ok: true, output: await out.save() };
}
