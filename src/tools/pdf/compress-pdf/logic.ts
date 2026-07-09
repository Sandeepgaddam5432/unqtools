/**
 * Compress PDF — pure logic (pdf-lib).
 *
 * Reduces PDF file size by:
 * 1. Re-saving with object streams (structural optimization, lossless)
 * 2. Optionally stripping metadata (Title, Author, Subject, Keywords, Creator, Producer)
 *
 * Does NOT re-encode or downsample images — visual quality is preserved exactly.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface CompressOptions {
  /** Strip Title/Author/Subject/Keywords/Creator/Producer from the PDF. */
  stripMetadata?: boolean;
}

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  /** Percentage reduction, e.g. 25.3 means 25.3% smaller. */
  reductionPercent: number;
  /** Whether metadata was stripped. */
  metadataStripped: boolean;
}

export async function compressPdf(
  bytes: Uint8Array,
  options: CompressOptions = {}
): Promise<ToolResult<CompressResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  const originalSize = bytes.length;

  if (options.stripMetadata) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setCreator("");
    doc.setProducer("");
  }

  try {
    const compressedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    const compressedSize = compressedBytes.length;
    const reductionPercent =
      originalSize > 0
        ? Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10
        : 0;
    return {
      ok: true,
      output: {
        bytes: compressedBytes,
        originalSize,
        compressedSize,
        reductionPercent,
        metadataStripped: !!options.stripMetadata,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while compressing — please try again." };
  }
}
