/**
 * Merge PDF — pure logic (pdf-lib).
 *
 * Combines multiple PDFs into one, honoring an optional per-file page-range
 * spec (e.g. "1-3, 5"). Order of inputs = order of pages in the output.
 *
 * Advanced features (v7.1):
 * - Custom output filename
 * - Optional title/author metadata on the merged PDF
 * - Per-file selected-page-count preview (without doing the merge)
 * - Total output page count preview
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

export interface MergeOptions {
  /** Custom output filename (without extension). Falls back to "merged". */
  outputName?: string;
  /** Optional metadata to set on the merged PDF. */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
  };
  /**
   * Interleave (alternate) pages across all input files — page 1 of file A,
   * page 1 of file B, page 2 of A, page 2 of B… Files with fewer pages just
   * run out. Only meaningful with 2+ files.
   */
  interleave?: boolean;
}

export interface MergePreviewFile {
  /** 1-indexed position in the merge queue. */
  position: number;
  /** Original filename. */
  name: string;
  /** Total pages in the source PDF. */
  totalSourcePages: number;
  /** Pages that will be included (0-indexed). */
  selectedIndices: number[];
  /** Human-readable selected range, e.g. "All 5 pages" or "Pages 1-3, 5 (4 pages)". */
  selectedLabel: string;
}

export interface MergePreview {
  files: MergePreviewFile[];
  totalSelectedPages: number;
  /** Final output filename (without extension). */
  outputName: string;
}

/**
 * Compute a preview of the merge plan WITHOUT doing the actual merge.
 * Use this in the UI to show the user exactly what will happen before they
 * click "Merge".
 */
export async function previewMerge(
  inputs: MergeInput[],
  options: MergeOptions = {}
): Promise<ToolResult<MergePreview>> {
  if (inputs.length === 0) {
    return { ok: false, error: "Add at least one PDF file to merge." };
  }
  const files: MergePreviewFile[] = [];
  let totalSelectedPages = 0;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(input.bytes);
    } catch {
      return {
        ok: false,
        error: `Could not read "${input.name}" — the file may be corrupted or password-protected.`,
      };
    }
    const totalSourcePages = src.getPageCount();
    const spec = input.pages?.trim() ?? "";
    let selectedIndices: number[];
    if (spec) {
      const parsed = parsePageRanges(spec, totalSourcePages);
      if (!parsed.ok) {
        return { ok: false, error: `${input.name}: ${parsed.error}` };
      }
      selectedIndices = parsed.output;
    } else {
      selectedIndices = src.getPageIndices();
    }
    const selectedLabel = spec
      ? `Pages ${spec} (${selectedIndices.length} page${selectedIndices.length === 1 ? "" : "s"})`
      : `All ${totalSourcePages} page${totalSourcePages === 1 ? "" : "s"}`;
    files.push({
      position: i + 1,
      name: input.name,
      totalSourcePages,
      selectedIndices,
      selectedLabel,
    });
    totalSelectedPages += selectedIndices.length;
  }
  return {
    ok: true,
    output: {
      files,
      totalSelectedPages,
      outputName: (options.outputName?.trim() || "merged").replace(/\.pdf$/i, ""),
    },
  };
}

export async function mergePdfs(
  inputs: MergeInput[],
  options: MergeOptions = {}
): Promise<ToolResult<Uint8Array>> {
  if (inputs.length === 0) {
    return { ok: false, error: "Add at least one PDF file to merge." };
  }
  try {
    const out = await PDFDocument.create();
    if (options.metadata?.title) out.setTitle(options.metadata.title);
    if (options.metadata?.author) out.setAuthor(options.metadata.author);
    if (options.metadata?.subject) out.setSubject(options.metadata.subject);
    out.setProducer("UnQTools — Merge PDF");
    out.setCreator("UnQTools — Merge PDF");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());

    // Load every input once so we can build the page plan (incl. interleave).
    const loaded: { name: string; doc: PDFDocument; indices: number[] }[] = [];
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
      loaded.push({ name: input.name, doc: src, indices });
    }

    if (options.interleave && loaded.length > 1) {
      // Alternate pages: A1, B1, C1, A2, B2, C2, …
      const maxLen = Math.max(...loaded.map((l) => l.indices.length));
      for (let i = 0; i < maxLen; i++) {
        for (const l of loaded) {
          if (i < l.indices.length) {
            const [page] = await out.copyPages(l.doc, [l.indices[i]!]);
            out.addPage(page);
          }
        }
      }
    } else {
      for (const l of loaded) {
        const pages = await out.copyPages(l.doc, l.indices);
        for (const page of pages) out.addPage(page);
      }
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

/**
 * Compute the final output filename for a merge (without extension).
 * Exported so the UI can show the user what the download will be called.
 */
export function getMergeOutputName(options: MergeOptions): string {
  return (options.outputName?.trim() || "merged").replace(/\.pdf$/i, "");
}
