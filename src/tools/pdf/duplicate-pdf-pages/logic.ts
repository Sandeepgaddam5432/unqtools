/**
 * Duplicate PDF Pages — pure logic (pdf-lib).
 *
 * Clones selected pages N times and appends them to the end of the document.
 * Original pages remain in their original positions.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface DuplicateOptions {
  /** Page-range spec, e.g. "3" or "1-3, 5". */
  pages: string;
  /** Number of times to duplicate each selected page. Must be >= 1. */
  count: number;
}

export interface DuplicateResult {
  bytes: Uint8Array;
  originalPageCount: number;
  newPageCount: number;
  pagesDuplicated: number;
  duplicateCount: number;
}

export async function duplicatePdfPages(
  bytes: Uint8Array,
  options: DuplicateOptions
): Promise<ToolResult<DuplicateResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  const total = src.getPageCount();
  const parsed = parsePageRanges(options.pages, total);
  if (!parsed.ok) return parsed;

  const count = Math.floor(options.count);
  if (count < 1) {
    return { ok: false, error: "Duplicate count must be at least 1." };
  }
  if (count > 100) {
    return { ok: false, error: "Duplicate count must be at most 100 (to prevent excessive output)." };
  }

  const indicesToDuplicate = [...new Set(parsed.output)]; // dedupe

  try {
    const out = await PDFDocument.create();
    // First, copy all original pages in order
    const allOriginalIndices = src.getPageIndices();
    const originalPages = await out.copyPages(src, allOriginalIndices);
    for (const page of originalPages) out.addPage(page);

    // Then, for each duplicate round, copy the selected pages
    for (let round = 0; round < count; round++) {
      const copies = await out.copyPages(src, indicesToDuplicate);
      for (const page of copies) out.addPage(page);
    }

    out.setProducer("UnQTools — Duplicate PDF Pages");
    out.setCreator("UnQTools — Duplicate PDF Pages");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());

    const newPageCount = out.getPageCount();
    return {
      ok: true,
      output: {
        bytes: await out.save(),
        originalPageCount: total,
        newPageCount,
        pagesDuplicated: indicesToDuplicate.length,
        duplicateCount: count,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while duplicating — please try again." };
  }
}
