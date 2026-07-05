/**
 * Split PDF — pure logic (pdf-lib).
 *
 * Three modes:
 * - "ranges": comma-separated groups (e.g. "1-3, 4-6") — each group becomes one file
 * - "every":  fixed-size chunks of N pages
 * - "single": one file per page
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
}

export interface SplitOutputFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export async function splitPdf(
  bytes: Uint8Array,
  options: SplitOptions
): Promise<ToolResult<SplitOutputFile[]>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const base = stripPdfExtension(options.baseName) || "split";

  const groups: { label: string; indices: number[] }[] = [];
  if (options.mode === "single") {
    for (let i = 0; i < total; i++) {
      groups.push({ label: `page-${i + 1}`, indices: [i] });
    }
  } else if (options.mode === "every") {
    const size = Math.floor(options.every ?? 0);
    if (size < 1) {
      return { ok: false, error: "Pages per file must be at least 1." };
    }
    let part = 1;
    for (let start = 0; start < total; start += size) {
      const indices: number[] = [];
      for (let i = start; i < Math.min(start + size, total); i++) indices.push(i);
      groups.push({ label: `part-${part}`, indices });
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
      groups.push({ label: `pages-${part}`, indices: parsed.output });
    }
    if (groups.length === 0) {
      return { ok: false, error: "Enter page ranges, e.g. 1-3, 4-6 — each group becomes its own file." };
    }
  }

  try {
    const outputs: SplitOutputFile[] = [];
    for (const group of groups) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, group.indices);
      for (const page of pages) doc.addPage(page);
      outputs.push({
        name: `${base}-${group.label}.pdf`,
        bytes: await doc.save(),
        pageCount: group.indices.length,
      });
    }
    return { ok: true, output: outputs };
  } catch {
    return { ok: false, error: "Something went wrong while splitting — please try again." };
  }
}
