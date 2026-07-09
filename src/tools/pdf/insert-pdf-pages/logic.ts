/**
 * Insert PDF Pages — pure logic (pdf-lib).
 *
 * Inserts pages from a source PDF into a target PDF at a specified position.
 * Position is 1-indexed: position 1 = before page 1 (at the very start).
 * Position N = before page N. Position "end" = append at the very end.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface InsertInput {
  /** Target PDF (the main document). */
  target: Uint8Array;
  /** Target filename — used in error messages. */
  targetName: string;
  /** Source PDF (pages will be taken from here). */
  source: Uint8Array;
  /** Source filename — used in error messages. */
  sourceName: string;
  /** Optional page-range spec for the source, e.g. "1-3, 5". Empty = all pages. */
  sourcePages?: string;
  /**
   * Position to insert at (1-indexed in the target).
   * Position 1 = before page 1 (at the start).
   * Position N = before page N.
   * Position 0 or "end" = append at the very end.
   */
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

  // Determine which source pages to insert
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

  // Determine insert position (0-indexed in the new document)
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
    insertAt = pos - 1; // convert 1-indexed to 0-indexed
  }

  try {
    // Copy the source pages into the target
    const copiedPages = await target.copyPages(source, sourceIndices);

    // Insert pages at the correct position
    // pdf-lib doesn't have a direct "insert at index" for pages,
    // so we rebuild: take pages before insertAt, add new pages, then pages after
    const out = await PDFDocument.create();
    const allTargetIndices = target.getPageIndices();

    // Pages before insert position
    const beforeIndices = allTargetIndices.slice(0, insertAt);
    if (beforeIndices.length > 0) {
      const beforePages = await out.copyPages(target, beforeIndices);
      for (const p of beforePages) out.addPage(p);
    }

    // Inserted pages
    const insertedPages = await out.copyPages(source, sourceIndices);
    for (const p of insertedPages) out.addPage(p);

    // Pages after insert position
    const afterIndices = allTargetIndices.slice(insertAt);
    if (afterIndices.length > 0) {
      const afterPages = await out.copyPages(target, afterIndices);
      for (const p of afterPages) out.addPage(p);
    }

    out.setProducer("UnQTools — Insert PDF Pages");
    out.setCreator("UnQTools — Insert PDF Pages");
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
