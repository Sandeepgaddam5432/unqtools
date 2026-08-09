/**
 * Split PDF by Bookmarks — real engine.
 *
 * Reads the PDF outline tree and splits the document at bookmark
 * boundaries: each bookmark becomes the first page of its own output part
 * (the last part runs to the end of the document). Pure pdf-lib + outline
 * reading.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { readOutlines } from "../pdf-bookmarks/logic";

export interface BookmarkSplitPart {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  startPage: number;
  endPage: number;
  title: string;
}

export interface BookmarkSplitResult {
  parts: BookmarkSplitPart[];
  totalPages: number;
  bookmarksUsed: number;
}

export async function splitByBookmarks(
  bytes: Uint8Array,
  baseName = "part"
): Promise<ToolResult<BookmarkSplitResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };

  const outlines = readOutlines(src);
  // Keep bookmarks that map to a real page and are ordered.
  const valid = outlines
    .filter((b) => b.page >= 1 && b.page <= total)
    .sort((a, b) => a.page - b.page);

  if (valid.length < 2) {
    return {
      ok: false,
      error: "Need at least 2 bookmarks to split by (or the bookmarks have no page destinations).",
    };
  }

  const boundaries = valid.map((b) => b.page);
  // Build page ranges: [boundary[i], boundary[i+1]-1], last runs to end.
  const ranges: { start: number; end: number; title: string }[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!;
    const end = i + 1 < boundaries.length ? boundaries[i + 1]! - 1 : total;
    if (end < start) continue;
    ranges.push({ start, end, title: valid[i]!.title });
  }

  try {
    const parts: BookmarkSplitPart[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]!;
      const out = await PDFDocument.create();
      const indices = Array.from({ length: r.end - r.start + 1 }, (_, k) => r.start - 1 + k);
      const pages = await out.copyPages(src, indices);
      for (const p of pages) out.addPage(p);
      const title = r.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || `part-${i + 1}`;
      parts.push({
        name: `${baseName}-${i + 1}-${title.slice(0, 40)}.pdf`,
        bytes: await out.save(),
        pageCount: indices.length,
        startPage: r.start,
        endPage: r.end,
        title: r.title,
      });
    }
    return { ok: true, output: { parts, totalPages: total, bookmarksUsed: ranges.length } };
  } catch {
    return { ok: false, error: "Something went wrong while splitting by bookmarks." };
  }
}
