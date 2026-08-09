/**
 * Merge PDFs with Bookmarks — real engine.
 *
 * Merges multiple PDFs into one and REBUILDS the outline tree: each input
 * file becomes a top-level bookmark pointing at its first page, and any
 * bookmarks already inside each file are re-anchored to their new page
 * numbers (offset by the pages already merged). Pure pdf-lib + outline
 * read/write reuse.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { readOutlines, writeOutlines } from "../pdf-bookmarks/logic";

export interface MergeBookmarkInput {
  name: string;
  bytes: Uint8Array;
}

export interface MergeBookmarkResult {
  bytes: Uint8Array;
  totalPages: number;
  files: number;
  bookmarks: number;
}

export async function mergePdfsWithBookmarks(
  inputs: MergeBookmarkInput[]
): Promise<ToolResult<MergeBookmarkResult>> {
  if (inputs.length === 0) return { ok: false, error: "Add at least one PDF file." };

  try {
    const out = await PDFDocument.create();
    const items: { title: string; page: number }[] = [];
    let offset = 0;
    let files = 0;

    for (const input of inputs) {
      let src: PDFDocument;
      try {
        src = await PDFDocument.load(input.bytes);
      } catch {
        return { ok: false, error: `Could not read "${input.name}" — it may be corrupted or password-protected.` };
      }
      const count = src.getPageCount();
      if (count === 0) continue;

      // Merge the pages.
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const p of pages) out.addPage(p);

      // File-level bookmark.
      const baseName = input.name.replace(/\.pdf$/i, "") || `file-${files + 1}`;
      items.push({ title: baseName, page: offset + 1 });

      // Re-anchor internal bookmarks.
      for (const bm of readOutlines(src)) {
        if (bm.page >= 1 && bm.page <= count) {
          items.push({ title: `${baseName} / ${bm.title}`, page: offset + bm.page });
        }
      }
      offset += count;
      files++;
    }

    if (out.getPageCount() === 0) {
      return { ok: false, error: "No pages could be merged." };
    }

    // Dedupe + clamp bookmark pages.
    const seen = new Set<string>();
    const unique = items.filter((it) => {
      const k = `${it.title}@${it.page}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    writeOutlines(out, unique);

    out.setProducer("UnQTools — Merge PDF with Bookmarks");
    out.setCreator("UnQTools — Merge PDF with Bookmarks");
    out.setCreationDate(new Date());
    return {
      ok: true,
      output: { bytes: await out.save(), totalPages: offset, files, bookmarks: unique.length },
    };
  } catch {
    return { ok: false, error: "Something went wrong while merging." };
  }
}
