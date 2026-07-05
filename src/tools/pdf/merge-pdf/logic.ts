/**
 * Merge PDF — pure logic (pdf-lib).
 *
 * Combines multiple PDFs into one, honoring an optional per-file page-range
 * spec (e.g. "1-3, 5"). Order of inputs = order of pages in the output.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface MergeInput {
  /** Original filename — used in error messages. */
  name: string;
  /** Raw PDF bytes. */
  bytes: Uint8Array;
  /** Optional page-range spec like "1-3, 5". Empty or missing = all pages. */
  pages?: string;
}

export async function mergePdfs(inputs: MergeInput[]): Promise<ToolResult<Uint8Array>> {
  if (inputs.length === 0) {
    return { ok: false, error: "Add at least one PDF file to merge." };
  }
  try {
    const out = await PDFDocument.create();
    for (const input of inputs) {
      let src: PDFDocument;
      try {
        src = await PDFDocument.load(input.bytes);
      } catch {
        return {
          ok: false,
          error: `Could not read "${input.name}" — the file may be corrupted or password-protected.`,
        };
      }
      let indices: number[];
      const spec = input.pages?.trim() ?? "";
      if (spec) {
        const parsed = parsePageRanges(spec, src.getPageCount());
        if (!parsed.ok) {
          return { ok: false, error: `${input.name}: ${parsed.error}` };
        }
        indices = parsed.output;
      } else {
        indices = src.getPageIndices();
      }
      const pages = await out.copyPages(src, indices);
      for (const page of pages) out.addPage(page);
    }
    if (out.getPageCount() === 0) {
      return { ok: false, error: "No pages selected — check your page ranges." };
    }
    const bytes = await out.save();
    return { ok: true, output: bytes };
  } catch {
    return {
      ok: false,
      error: "Something went wrong while merging — please check your files and try again.",
    };
  }
}
