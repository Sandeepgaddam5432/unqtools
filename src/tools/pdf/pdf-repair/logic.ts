/**
 * Repair PDF — real engine.
 *
 * Attempts structural repair of damaged PDFs:
 *   1. Try loading with strict mode; if that fails, retry with
 *      ignoreEncryption + a permissive parse (pdf-lib tolerates many
 *      structural issues on load).
 *   2. Re-save with object streams and updated metadata.
 * Reports what was attempted and whether the file is now loadable.
 * Honest: byte-level corruption inside streams cannot be fixed client-side.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface RepairResult {
  bytes: Uint8Array;
  pageCount: number;
  repaired: boolean;
  notes: string[];
}

export async function repairPdf(bytes: Uint8Array): Promise<ToolResult<RepairResult>> {
  const notes: string[] = [];
  let doc: PDFDocument | null = null;

  // Pre-repair: trim trailing bytes after the last %%EOF (common damage).
  let candidate = bytes;
  const text = new TextDecoder("latin1").decode(bytes);
  const lastEof = text.lastIndexOf("%%EOF");
  if (lastEof !== -1 && lastEof + 5 < bytes.length) {
    candidate = new Uint8Array(bytes.slice(0, lastEof + 5));
    notes.push("Trimmed trailing garbage after the final %%EOF marker.");
  }

  // Attempt 1: strict load.
  try {
    doc = await PDFDocument.load(candidate, { ignoreEncryption: false });
    notes.push("Parsed with strict mode.");
  } catch {
    // Attempt 2: permissive load (ignore encryption, tolerate minor damage).
    try {
      doc = await PDFDocument.load(candidate, { ignoreEncryption: true });
      notes.push("Strict parse failed — recovered with permissive mode (possible encryption or minor damage).");
    } catch {
      return {
        ok: false,
        error: "The PDF is too damaged to open — the file header/trailer are unreadable.",
      };
    }
  }

  try {
    const pageCount = doc.getPageCount();
    const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    notes.push(`Re-saved with object streams (${pageCount} pages).`);
    return {
      ok: true,
      output: { bytes: out, pageCount, repaired: pageCount > 0, notes },
    };
  } catch {
    return { ok: false, error: "Could not re-save the PDF after parsing." };
  }
}
