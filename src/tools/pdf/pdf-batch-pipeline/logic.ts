/**
 * PDF Batch Processor (Pipeline) — real engine.
 *
 * Applies one operation to MANY PDFs at once:
 *   - rotate (90/180/270° on all or selected pages)
 *   - compress (structural + optional metadata strip)
 *   - strip-metadata (wipe Info + XMP)
 *   - watermark (text, diagonal)
 * Each file is processed with the same options; per-file results are
 * returned so the UI can offer individual or ZIP downloads.
 */
import { PDFDocument, PDFName, degrees, StandardFonts, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { compressPdf } from "../compress-pdf/logic";

export type BatchOp = "rotate" | "compress" | "strip-metadata" | "watermark";

export interface BatchOptions {
  op: BatchOp;
  /** Rotation degrees (rotate). */
  rotation?: 90 | 180 | 270;
  /** Compress settings (compress). */
  compress?: { grayscale?: boolean; stripMetadata?: boolean; quality?: number };
  /** Watermark text (watermark). */
  watermarkText?: string;
}

export interface BatchFileInput {
  name: string;
  bytes: Uint8Array;
}

export interface BatchFileResult {
  name: string;
  ok: boolean;
  error?: string;
  bytes?: Uint8Array;
  pages?: number;
}

export async function runBatch(
  files: BatchFileInput[],
  options: BatchOptions
): Promise<ToolResult<BatchFileResult[]>> {
  if (files.length === 0) return { ok: false, error: "Add at least one PDF file." };
  if (!options.op) return { ok: false, error: "Choose a batch operation." };

  const results: BatchFileResult[] = [];
  for (const file of files) {
    try {
      let bytes = file.bytes;
      let pages = 0;
      if (options.op === "rotate") {
        const doc = await PDFDocument.load(bytes);
        pages = doc.getPageCount();
        const angle = options.rotation ?? 90;
        for (const page of doc.getPages()) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + angle) % 360));
        }
        bytes = await doc.save();
      } else if (options.op === "strip-metadata") {
        const doc = await PDFDocument.load(bytes);
        pages = doc.getPageCount();
        doc.setTitle("");
        doc.setAuthor("");
        doc.setSubject("");
        doc.setKeywords([]);
        doc.setCreator("");
        doc.setProducer("");
        const trailer = doc.context.trailerInfo as Record<string, unknown>;
        if (trailer["Info"]) delete trailer["Info"];
        if (doc.catalog.get(PDFName.of("Metadata"))) {
          doc.catalog.delete(PDFName.of("Metadata"));
        }
        bytes = await doc.save({ useObjectStreams: true });
      } else if (options.op === "compress") {
        const res = await compressPdf(bytes, {
          quality: options.compress?.quality ?? 0.82,
          grayscale: options.compress?.grayscale,
          stripMetadata: options.compress?.stripMetadata,
        });
        if (!res.ok) {
          results.push({ name: file.name, ok: false, error: res.error });
          continue;
        }
        bytes = res.output.bytes;
        pages = res.output.imagesRecompressed > 0 ? 0 : 0;
      } else if (options.op === "watermark") {
        const text = (options.watermarkText ?? "").trim();
        if (!text) {
          results.push({ name: file.name, ok: false, error: "Enter watermark text." });
          continue;
        }
        const doc = await PDFDocument.load(bytes);
        pages = doc.getPageCount();
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const fs = 48;
        const opacity = 0.25;
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const textW = font.widthOfTextAtSize(text, fs);
          page.drawText(text, {
            x: (width - textW) / 2,
            y: (height - fs) / 2,
            size: fs,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity,
            rotate: degrees(45),
          });
        }
        bytes = await doc.save();
      }
      results.push({ name: file.name, ok: true, bytes, pages });
    } catch {
      results.push({ name: file.name, ok: false, error: "Could not process this file." });
    }
  }
  return { ok: true, output: results };
}
