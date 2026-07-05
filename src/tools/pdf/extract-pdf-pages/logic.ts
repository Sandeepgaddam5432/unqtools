import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface ExtractResult {
  bytes: Uint8Array;
  pageCount: number;
}

export async function extractPdfPages(
  bytes: Uint8Array,
  spec: string
): Promise<ToolResult<ExtractResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const parsed = parsePageRanges(spec, total);
  if (!parsed.ok) return parsed;
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, parsed.output);
  for (const page of pages) out.addPage(page);
  const outBytes = await out.save();
  return { ok: true, output: { bytes: outBytes, pageCount: parsed.output.length } };
}
