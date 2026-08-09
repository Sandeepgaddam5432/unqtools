/**
 * Split PDF by File Size — real engine.
 *
 * Splits a PDF into multiple parts so that each part stays at or under a
 * target size (KB/MB). Pages are accumulated greedily; when adding the next
 * page would exceed the target, a new part starts. Pure pdf-lib.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface SplitBySizeOptions {
  /** Target size in KB per part (min 10). */
  targetKB: number;
  /** Filename base (without extension). */
  baseName: string;
}

export interface SplitPart {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  size: number;
  startPage: number;
  endPage: number;
}

export interface SplitBySizeResult {
  parts: SplitPart[];
  totalPages: number;
}

export async function splitBySize(
  bytes: Uint8Array,
  options: SplitBySizeOptions
): Promise<ToolResult<SplitBySizeResult>> {
  const targetKB = Math.max(10, Math.floor(options.targetKB || 100));
  const targetBytes = targetKB * 1024;
  const base = (options.baseName || "part").replace(/\.pdf$/i, "");

  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };

  try {
    const parts: SplitPart[] = [];
    let partStart = 0;
    let partDoc = await PDFDocument.create();
    const pageCounts: number[] = [];

    const commit = async (endIndex: number, name: string) => {
      const outBytes = await partDoc.save();
      parts.push({
        name,
        bytes: outBytes,
        pageCount: pageCounts.length,
        size: outBytes.length,
        startPage: partStart + 1,
        endPage: endIndex,
      });
    };

    for (let i = 0; i < total; i++) {
      const [page] = await partDoc.copyPages(src, [i]);
      partDoc.addPage(page);
      pageCounts.push(i + 1);
      const size = (await partDoc.save()).length;
      // If we exceed the target and there's at least one page in this part,
      // cut before adding the NEXT page (i.e. at i+1).
      if (size > targetBytes && pageCounts.length > 1) {
        // Rebuild part without the last page.
        const trimmed = await PDFDocument.create();
        const keep = pageCounts.slice(0, -1);
        const copied = await trimmed.copyPages(src, keep.map((p) => p - 1));
        for (const p of copied) trimmed.addPage(p);
        const outBytes = await trimmed.save();
        parts.push({
          name: `${base}-${parts.length + 1}.pdf`,
          bytes: outBytes,
          pageCount: keep.length,
          size: outBytes.length,
          startPage: partStart + 1,
          endPage: keep[keep.length - 1]!,
        });
        partStart = keep[keep.length - 1]!;
        partDoc = await PDFDocument.create();
        pageCounts.length = 0;
        // Re-add the current page to the new part.
        const [p2] = await partDoc.copyPages(src, [i]);
        partDoc.addPage(p2);
        pageCounts.push(i + 1);
      }
    }
    if (pageCounts.length > 0) {
      const outBytes = await partDoc.save();
      parts.push({
        name: `${base}-${parts.length + 1}.pdf`,
        bytes: outBytes,
        pageCount: pageCounts.length,
        size: outBytes.length,
        startPage: partStart + 1,
        endPage: pageCounts[pageCounts.length - 1]!,
      });
    }

    if (parts.length === 0) {
      return { ok: false, error: "The PDF could not be split." };
    }
    return { ok: true, output: { parts, totalPages: total } };
  } catch {
    return { ok: false, error: "Something went wrong while splitting." };
  }
}
