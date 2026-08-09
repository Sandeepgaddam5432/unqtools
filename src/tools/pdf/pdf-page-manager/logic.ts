/**
 * PDF Page Manager — unified, self-contained logic.
 *
 * All seven page operations (delete / extract / duplicate / insert / reorder /
 * rotate / reverse) live here as single-source-of-truth engines. The old
 * standalone page tools were merged into this file; their URLs 301-redirect
 * to /tools/pdf-page-manager (see public/_redirects). 100% client-side.
 */
import { PDFDocument, degrees } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type PageOperation =
  | "delete"
  | "extract"
  | "duplicate"
  | "insert"
  | "reorder"
  | "rotate"
  | "reverse";

export interface PageManagerInput {
  operation: PageOperation;
  /** The main PDF to operate on. */
  bytes: Uint8Array;
  /** Optional second PDF, only used by the "insert" operation. */
  source?: Uint8Array;
  /** Page-range spec (delete / extract / duplicate / insert source pages). */
  pages?: string;
  /** Duplicate count (duplicate). */
  count?: number;
  /** Rotation degrees (rotate). */
  rotation?: 90 | 180 | 270;
  /** Rotation target (rotate). */
  rotateTarget?: "all" | "odd" | "even" | "custom";
  /** Custom rotation pages (rotate, when target === "custom"). */
  rotatePages?: string;
  /** Reorder sequence (reorder). */
  sequence?: string;
  /** Reorder mode (reorder). */
  reorderMode?: "custom" | "reverse" | "duplicate";
  /** Insert position (insert): 1-indexed or "end". */
  insertPosition?: number | "end";
}

/* ------------------------------------------------------------------ */
/* Engine: delete pages                                                */
/* ------------------------------------------------------------------ */

export interface DeleteResult {
  bytes: Uint8Array;
  keptCount: number;
  removedCount: number;
}

export async function deletePdfPages(
  bytes: Uint8Array,
  deleteSpec: string
): Promise<ToolResult<DeleteResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const parsed = parsePageRanges(deleteSpec, total);
  if (!parsed.ok) return parsed;
  const deleteSet = new Set(parsed.output);
  if (deleteSet.size === total) {
    return { ok: false, error: "This would delete all pages. Keep at least one page." };
  }
  const keptIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !deleteSet.has(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keptIndices);
  for (const page of pages) out.addPage(page);
  return {
    ok: true,
    output: { bytes: await out.save(), keptCount: keptIndices.length, removedCount: deleteSet.size },
  };
}

/* ------------------------------------------------------------------ */
/* Engine: extract pages                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Engine: duplicate pages                                             */
/* ------------------------------------------------------------------ */

export interface DuplicateOptions {
  pages: string;
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
  if (count < 1) return { ok: false, error: "Duplicate count must be at least 1." };
  if (count > 100) {
    return { ok: false, error: "Duplicate count must be at most 100 (to prevent excessive output)." };
  }
  const indicesToDuplicate = [...new Set(parsed.output)];
  try {
    const out = await PDFDocument.create();
    const originalPages = await out.copyPages(src, src.getPageIndices());
    for (const page of originalPages) out.addPage(page);
    for (let round = 0; round < count; round++) {
      const copies = await out.copyPages(src, indicesToDuplicate);
      for (const page of copies) out.addPage(page);
    }
    out.setProducer("UnQTools — PDF Page Manager");
    out.setCreator("UnQTools — PDF Page Manager");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return {
      ok: true,
      output: {
        bytes: await out.save(),
        originalPageCount: total,
        newPageCount: out.getPageCount(),
        pagesDuplicated: indicesToDuplicate.length,
        duplicateCount: count,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while duplicating — please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* Engine: insert pages from another PDF                               */
/* ------------------------------------------------------------------ */

export interface InsertInput {
  target: Uint8Array;
  targetName: string;
  source: Uint8Array;
  sourceName: string;
  sourcePages?: string;
  position: number | "end";
}

export interface InsertResult {
  bytes: Uint8Array;
  originalPageCount: number;
  insertedPageCount: number;
  newPageCount: number;
}

export async function insertPdfPages(input: InsertInput): Promise<ToolResult<InsertResult>> {
  let target: PDFDocument;
  let source: PDFDocument;
  try {
    target = await PDFDocument.load(input.target);
  } catch {
    return { ok: false, error: `Could not read "${input.targetName}" — it may be corrupted or password-protected.` };
  }
  try {
    source = await PDFDocument.load(input.source);
  } catch {
    return { ok: false, error: `Could not read "${input.sourceName}" — it may be corrupted or password-protected.` };
  }
  const targetTotal = target.getPageCount();
  const sourceTotal = source.getPageCount();

  const spec = input.sourcePages?.trim() ?? "";
  let sourceIndices: number[];
  if (spec) {
    const parsed = parsePageRanges(spec, sourceTotal);
    if (!parsed.ok) return { ok: false, error: `${input.sourceName}: ${parsed.error}` };
    sourceIndices = parsed.output;
  } else {
    sourceIndices = source.getPageIndices();
  }
  if (sourceIndices.length === 0) {
    return { ok: false, error: "No pages selected from the source PDF." };
  }

  let insertAt: number;
  if (input.position === "end" || input.position === 0) {
    insertAt = targetTotal;
  } else {
    const pos = Math.floor(input.position);
    if (pos < 1 || pos > targetTotal + 1) {
      return {
        ok: false,
        error: `Insert position must be between 1 and ${targetTotal + 1} (the document has ${targetTotal} page${targetTotal === 1 ? "" : "s"}).`,
      };
    }
    insertAt = pos - 1;
  }

  try {
    const out = await PDFDocument.create();
    const allTargetIndices = target.getPageIndices();
    const beforeIndices = allTargetIndices.slice(0, insertAt);
    if (beforeIndices.length > 0) {
      const beforePages = await out.copyPages(target, beforeIndices);
      for (const p of beforePages) out.addPage(p);
    }
    const insertedPages = await out.copyPages(source, sourceIndices);
    for (const p of insertedPages) out.addPage(p);
    const afterIndices = allTargetIndices.slice(insertAt);
    if (afterIndices.length > 0) {
      const afterPages = await out.copyPages(target, afterIndices);
      for (const p of afterPages) out.addPage(p);
    }
    out.setProducer("UnQTools — PDF Page Manager");
    out.setCreator("UnQTools — PDF Page Manager");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return {
      ok: true,
      output: {
        bytes: await out.save(),
        originalPageCount: targetTotal,
        insertedPageCount: sourceIndices.length,
        newPageCount: out.getPageCount(),
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while inserting — please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* Engine: reorder pages                                               */
/* ------------------------------------------------------------------ */

export type ReorderMode = "custom" | "reverse" | "duplicate";

export interface ReorderOptions {
  mode: ReorderMode;
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
    const unique = new Set(indices);
    if (unique.size !== total) {
      return { ok: false, error: `Custom order must list every page exactly once (${total} pages).` };
    }
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  out.setProducer("UnQTools — PDF Page Manager");
  out.setCreator("UnQTools — PDF Page Manager");
  out.setCreationDate(new Date());
  out.setModificationDate(new Date());
  return { ok: true, output: await out.save() };
}

/* ------------------------------------------------------------------ */
/* Engine: rotate pages                                                */
/* ------------------------------------------------------------------ */

export type RotationDeg = 90 | 180 | 270;
export type RotateTarget = "all" | "odd" | "even" | "custom";

export interface RotateOptions {
  rotation: RotationDeg;
  target: RotateTarget;
  customPages?: string;
}

export async function rotatePdf(
  bytes: Uint8Array,
  options: RotateOptions
): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  let indices: number[];
  if (options.target === "all") {
    indices = Array.from({ length: total }, (_, i) => i);
  } else if (options.target === "odd") {
    indices = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 0);
  } else if (options.target === "even") {
    indices = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 1);
  } else {
    const spec = (options.customPages ?? "").trim();
    if (!spec) return { ok: false, error: "Enter page numbers or ranges to rotate, e.g. 1, 3-5." };
    const parsed = parsePageRanges(spec, total);
    if (!parsed.ok) return parsed;
    indices = [...new Set(parsed.output)];
  }
  if (indices.length === 0) {
    return { ok: false, error: "No pages matched — check your selection." };
  }
  const pagesAll = src.getPages();
  for (const i of indices) {
    const page = pagesAll[i];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + options.rotation) % 360));
  }
  return { ok: true, output: await src.save() };
}

/* ------------------------------------------------------------------ */
/* Engine: reverse pages                                               */
/* ------------------------------------------------------------------ */

export async function reversePdf(bytes: Uint8Array): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total < 2) {
    return { ok: false, error: "The PDF has fewer than 2 pages — nothing to reverse." };
  }
  try {
    const out = await PDFDocument.create();
    for (let i = total - 1; i >= 0; i--) {
      const [page] = await out.copyPages(src, [i]);
      out.addPage(page);
    }
    out.setProducer("UnQTools — PDF Page Manager");
    out.setCreator("UnQTools — PDF Page Manager");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return { ok: true, output: await out.save() };
  } catch {
    return { ok: false, error: "Something went wrong while reversing — please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* Dispatcher used by the tabbed UI                                    */
/* ------------------------------------------------------------------ */

export async function runPageOperation(
  input: PageManagerInput
): Promise<ToolResult<Uint8Array>> {
  const { bytes, operation } = input;

  switch (operation) {
    case "delete": {
      const res = await deletePdfPages(bytes, input.pages ?? "");
      return res.ok ? { ok: true, output: res.output.bytes } : res;
    }
    case "extract": {
      const res = await extractPdfPages(bytes, input.pages ?? "");
      return res.ok ? { ok: true, output: res.output.bytes } : res;
    }
    case "duplicate": {
      const res = await duplicatePdfPages(bytes, {
        pages: input.pages ?? "",
        count: input.count ?? 1,
      });
      return res.ok ? { ok: true, output: res.output.bytes } : res;
    }
    case "insert": {
      if (!input.source) {
        return { ok: false, error: "Choose a second PDF to insert pages from." };
      }
      const res = await insertPdfPages({
        target: bytes,
        targetName: "main.pdf",
        source: input.source,
        sourceName: "source.pdf",
        sourcePages: input.pages || undefined,
        position: input.insertPosition ?? "end",
      });
      return res.ok ? { ok: true, output: res.output.bytes } : res;
    }
    case "reorder": {
      const res = await reorderPdfPages(bytes, {
        mode: input.reorderMode ?? "custom",
        sequence: input.sequence,
      });
      return res;
    }
    case "rotate": {
      const res = await rotatePdf(bytes, {
        rotation: input.rotation ?? 90,
        target: input.rotateTarget ?? "all",
        customPages: input.rotatePages,
      });
      return res;
    }
    case "reverse":
      return reversePdf(bytes);
    default:
      return { ok: false, error: "Unknown operation." };
  }
}
