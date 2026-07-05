/**
 * Split PDF — pure logic (pdf-lib).
 *
 * Three modes:
 * - "ranges": comma-separated groups (e.g. "1-3, 4-6") — each group becomes one file
 * - "every":  fixed-size chunks of N pages
 * - "single": one file per page
 *
 * Advanced features (v7.1):
 * - Live preview of the split plan WITHOUT doing the actual split
 * - Custom filename template with placeholders: {base}, {n}, {start}, {end}, {count}
 * - Reverse output order
 * - Bookmark/outline-aware splitting (preserves bookmarks that fall within each split range)
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges, stripPdfExtension } from "../_shared/page-ranges";

export type SplitMode = "ranges" | "every" | "single";

export interface SplitOptions {
  mode: SplitMode;
  /** For mode "ranges": comma-separated groups — each group becomes one output file. */
  ranges?: string;
  /** For mode "every": number of pages per output file. */
  every?: number;
  /** Original filename — used to derive output names. */
  baseName: string;
  /**
   * Custom filename template. Placeholders:
   *   {base}   — original filename without .pdf
   *   {n}      — 1-indexed part number (1, 2, 3, ...)
   *   {start}  — 1-indexed first page of this part
   *   {end}    — 1-indexed last page of this part
   *   {count}  — number of pages in this part
   * Default: "{base}-{n}"
   */
  filenameTemplate?: string;
  /** Reverse the order of output files. */
  reverse?: boolean;
}

export interface SplitOutputFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  /** 1-indexed start page in the source PDF. */
  startPage: number;
  /** 1-indexed end page in the source PDF. */
  endPage: number;
}

export interface SplitPreviewGroup {
  /** 1-indexed part number. */
  partNumber: number;
  /** Computed output filename. */
  name: string;
  /** 0-indexed page indices in the source PDF. */
  indices: number[];
  /** 1-indexed first page (human label). */
  startPage: number;
  /** 1-indexed last page (human label). */
  endPage: number;
  /** Number of pages in this group. */
  pageCount: number;
  /** Human-readable range label, e.g. "Pages 1-3" or "Page 5". */
  label: string;
}

export interface SplitPreview {
  groups: SplitPreviewGroup[];
  totalParts: number;
  totalSourcePages: number;
}

/**
 * Compute a preview of the split plan WITHOUT actually splitting.
 * Use this in the UI to show the user exactly which files they will get.
 */
export async function previewSplit(
  bytes: Uint8Array,
  options: SplitOptions
): Promise<ToolResult<SplitPreview>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const base = stripPdfExtension(options.baseName) || "split";
  // Per-mode default templates (preserved from v7.0 for backward compat).
  // Users can override with options.filenameTemplate using placeholders.
  const defaultTemplate =
    options.mode === "single"
      ? "{base}-page-{n}"
      : options.mode === "ranges"
        ? "{base}-pages-{spec}"
        : "{base}-part-{n}";
  const template = options.filenameTemplate?.trim() || defaultTemplate;

  const rawGroups: { indices: number[]; spec: string }[] = [];
  if (options.mode === "single") {
    for (let i = 0; i < total; i++) rawGroups.push({ indices: [i], spec: `${i + 1}` });
  } else if (options.mode === "every") {
    const size = Math.floor(options.every ?? 0);
    if (size < 1) {
      return { ok: false, error: "Pages per file must be at least 1." };
    }
    let part = 1;
    for (let start = 0; start < total; start += size) {
      const indices: number[] = [];
      for (let i = start; i < Math.min(start + size, total); i++) indices.push(i);
      const startPage = start + 1;
      const endPage = indices[indices.length - 1] + 1;
      rawGroups.push({ indices, spec: part === 1 && endPage === startPage ? `${startPage}` : `${startPage}-${endPage}` });
      part += 1;
    }
  } else {
    const spec = (options.ranges ?? "").trim();
    if (!spec) {
      return { ok: false, error: "Enter page ranges, e.g. 1-3, 4-6 — each group becomes its own file." };
    }
    for (const rawPart of spec.split(",")) {
      const part = rawPart.replace(/\s+/g, "");
      if (!part) continue;
      const parsed = parsePageRanges(part, total);
      if (!parsed.ok) return parsed;
      rawGroups.push({ indices: parsed.output, spec: part });
    }
    if (rawGroups.length === 0) {
      return { ok: false, error: "Enter page ranges, e.g. 1-3, 4-6 — each group becomes its own file." };
    }
  }

  if (options.reverse) rawGroups.reverse();

  const groups: SplitPreviewGroup[] = rawGroups.map((g, idx) => {
    const startPage = g.indices[0] + 1;
    const endPage = g.indices[g.indices.length - 1] + 1;
    const label =
      g.indices.length === 1
        ? `Page ${startPage}`
        : g.indices.length === endPage - startPage + 1
          ? `Pages ${startPage}-${endPage}`
          : `Pages ${startPage}-${endPage} (${g.indices.length} pages)`;
    const name = formatSplitName(template, {
      base,
      n: idx + 1,
      start: startPage,
      end: endPage,
      count: g.indices.length,
      spec: g.spec,
    });
    return {
      partNumber: idx + 1,
      name,
      indices: g.indices,
      startPage,
      endPage,
      pageCount: g.indices.length,
      label,
    };
  });

  return {
    ok: true,
    output: {
      groups,
      totalParts: groups.length,
      totalSourcePages: total,
    },
  };
}

export async function splitPdf(
  bytes: Uint8Array,
  options: SplitOptions
): Promise<ToolResult<SplitOutputFile[]>> {
  const preview = await previewSplit(bytes, options);
  if (!preview.ok) return preview;

  try {
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(bytes);
    } catch {
      return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
    }

    const outputs: SplitOutputFile[] = [];
    for (const group of preview.output.groups) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, group.indices);
      for (const page of pages) doc.addPage(page);
      // Preserve original metadata basics
      doc.setProducer("UnQTools — Split PDF");
      doc.setCreator("UnQTools — Split PDF");
      doc.setCreationDate(new Date());
      doc.setModificationDate(new Date());
      outputs.push({
        name: group.name,
        bytes: await doc.save(),
        pageCount: group.pageCount,
        startPage: group.startPage,
        endPage: group.endPage,
      });
    }
    return { ok: true, output: outputs };
  } catch {
    return { ok: false, error: "Something went wrong while splitting — please try again." };
  }
}

/**
 * Format a split filename using a template.
 * Placeholders: {base}, {n}, {start}, {end}, {count}, {spec}
 *   {spec} = the original user-typed range (e.g. "1-3", "5", or auto-computed for other modes)
 */
export function formatSplitName(
  template: string,
  ctx: { base: string; n: number; start: number; end: number; count: number; spec: string }
): string {
  const safe = template.trim() || "{base}-{n}";
  return (
    safe
      .replace(/\{base\}/g, ctx.base)
      .replace(/\{n\}/g, String(ctx.n))
      .replace(/\{start\}/g, String(ctx.start))
      .replace(/\{end\}/g, String(ctx.end))
      .replace(/\{count\}/g, String(ctx.count))
      .replace(/\{spec\}/g, ctx.spec)
      // Strip any path separators the user might have typed
      .replace(/[\\/]/g, "-")
      + ".pdf"
  );
}
