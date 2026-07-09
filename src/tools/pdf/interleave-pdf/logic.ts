/**
 * Interleave PDF Pages — pure logic (pdf-lib).
 *
 * Merges two PDFs by alternating pages: A1, B1, A2, B2, A3, B3, ...
 * If one PDF is longer, remaining pages are appended at the end.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface InterleaveInput {
  /** First PDF (PDF A). */
  bytesA: Uint8Array;
  /** Name of PDF A — used in error messages. */
  nameA: string;
  /** Second PDF (PDF B). */
  bytesB: Uint8Array;
  /** Name of PDF B — used in error messages. */
  nameB: string;
}

export interface InterleaveResult {
  bytes: Uint8Array;
  pagesFromA: number;
  pagesFromB: number;
  totalPageCount: number;
}

export async function interleavePdf(input: InterleaveInput): Promise<ToolResult<InterleaveResult>> {
  let docA: PDFDocument;
  let docB: PDFDocument;
  try {
    docA = await PDFDocument.load(input.bytesA);
  } catch {
    return { ok: false, error: `Could not read "${input.nameA}" — it may be corrupted or password-protected.` };
  }
  try {
    docB = await PDFDocument.load(input.bytesB);
  } catch {
    return { ok: false, error: `Could not read "${input.nameB}" — it may be corrupted or password-protected.` };
  }

  const countA = docA.getPageCount();
  const countB = docB.getPageCount();

  if (countA === 0 && countB === 0) {
    return { ok: false, error: "Both PDFs are empty — nothing to interleave." };
  }

  try {
    const out = await PDFDocument.create();
    const maxPages = Math.max(countA, countB);

    for (let i = 0; i < maxPages; i++) {
      // Take page i from A if it exists
      if (i < countA) {
        const [page] = await out.copyPages(docA, [i]);
        out.addPage(page);
      }
      // Take page i from B if it exists
      if (i < countB) {
        const [page] = await out.copyPages(docB, [i]);
        out.addPage(page);
      }
    }

    out.setProducer("UnQTools — Interleave PDF");
    out.setCreator("UnQTools — Interleave PDF");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());

    return {
      ok: true,
      output: {
        bytes: await out.save(),
        pagesFromA: countA,
        pagesFromB: countB,
        totalPageCount: out.getPageCount(),
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while interleaving — please try again." };
  }
}
