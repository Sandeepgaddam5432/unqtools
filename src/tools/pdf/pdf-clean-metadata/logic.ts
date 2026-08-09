/**
 * PDF Metadata Cleaner — real engine.
 *
 * Strips document metadata (Title/Author/Subject/Keywords/Creator/Producer,
 * plus the Info dictionary and XMP metadata stream) from a PDF. Reports what
 * was removed and how much space was saved. Pure pdf-lib.
 */
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface CleanMetaResult {
  bytes: Uint8Array;
  originalSize: number;
  cleanedSize: number;
  fieldsRemoved: string[];
  infoPresent: boolean;
  xmpRemoved: boolean;
}

/** Which standard metadata fields to clear. */
export const META_FIELDS = ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"] as const;

/** Inspect which metadata exists. Pure-ish (needs a loaded doc). */
export function inspectMetadata(doc: PDFDocument): { fields: string[]; infoPresent: boolean; xmp: boolean } {
  const fields: string[] = [];
  for (const f of META_FIELDS) {
    const v = doc.getTitle ?? null;
    void v;
    try {
      const getters: Record<string, () => string | undefined> = {
        Title: () => doc.getTitle(),
        Author: () => doc.getAuthor(),
        Subject: () => doc.getSubject(),
        Keywords: () => doc.getKeywords().join(", "),
        Creator: () => doc.getCreator(),
        Producer: () => doc.getProducer(),
      };
      const value = getters[f]?.();
      if (value) fields.push(f);
    } catch {
      /* ignore */
    }
  }
  const infoEntry = (doc.context.trailerInfo as Record<string, unknown>)["Info"];
  const info = infoEntry instanceof PDFName ? null : (doc.context.lookup(infoEntry as never) as Record<string, unknown> | null);
  const infoPresent = Boolean(info && typeof info === "object" && Object.keys(info).length > 0);
  const xmp = Boolean(doc.catalog.get(PDFName.of("Metadata")));
  return { fields, infoPresent, xmp };
}

export async function cleanMetadata(bytes: Uint8Array): Promise<ToolResult<CleanMetaResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const originalSize = bytes.length;
  try {
    const before = inspectMetadata(doc);
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setCreator("");
    doc.setProducer("");
    // Remove the Info dictionary entirely (it lives in the trailer).
    const trailer = doc.context.trailerInfo as Record<string, unknown>;
    if (trailer["Info"]) delete trailer["Info"];
    // Remove the XMP metadata stream.
    if (doc.catalog.get(PDFName.of("Metadata"))) {
      doc.catalog.delete(PDFName.of("Metadata"));
    }
    const cleaned = await doc.save({ useObjectStreams: true });
    return {
      ok: true,
      output: {
        bytes: cleaned,
        originalSize,
        cleanedSize: cleaned.length,
        fieldsRemoved: before.fields,
        infoPresent: before.infoPresent,
        xmpRemoved: before.xmp,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while cleaning metadata." };
  }
}
