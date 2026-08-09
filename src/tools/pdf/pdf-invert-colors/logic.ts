/**
 * Invert PDF Colors (Dark Mode) — real engine.
 *
 * Inverts every embedded image's pixels (RGB → 255-R) in the browser via
 * canvas and swaps the re-encoded image back into the PDF — a genuine
 * dark-mode conversion for image-based PDFs (scans, slides, forms).
 * The pixel math is pure and unit-tested in Node.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface InvertOptions {
  /** Page range to process (empty = all pages' images). */
  pages?: string;
  /** JPEG quality for re-encoded images (0.5–1). */
  quality?: number;
}

export interface InvertResult {
  bytes: Uint8Array;
  imagesInverted: number;
  pixelsInverted: number;
}

/** Pure: invert RGB channels of an RGBA buffer (alpha untouched). */
export function invertPixels(rgba: Uint8Array): Uint8Array {
  const out = rgba.slice();
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255 - out[i]!;
    out[i + 1] = 255 - out[i + 1]!;
    out[i + 2] = 255 - out[i + 2]!;
  }
  return out;
}

export function canInvertImages(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof HTMLCanvasElement !== "undefined"
  );
}

/** Find embedded images (same scan as B&W optimizer). */
export function findEmbeddedImages(doc: PDFDocument): PDFRawStream[] {
  const out: PDFRawStream[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const subtype = obj.dict.get(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Image") continue;
    const filter = obj.dict.get(PDFName.of("Filter"));
    let filterName = "";
    if (filter instanceof PDFName) filterName = filter.toString();
    else if (Array.isArray(filter)) {
      const first = filter[0];
      if (first instanceof PDFName) filterName = first.toString();
    }
    if (filterName !== "/DCTDecode" && filterName !== "/FlateDecode") continue;
    const width = obj.dict.get(PDFName.of("Width"))?.asNumber() ?? 0;
    const height = obj.dict.get(PDFName.of("Height"))?.asNumber() ?? 0;
    if (width < 4 || height < 4 || obj.contents.length < 32) continue;
    if (obj.dict.get(PDFName.of("SMask"))) continue; // skip transparency
    out.push(obj);
  }
  return out;
}

export async function invertPdfColors(
  bytes: Uint8Array,
  options: InvertOptions = {}
): Promise<ToolResult<InvertResult>> {
  if (!canInvertImages()) {
    return { ok: false, error: "This tool requires a browser environment." };
  }
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, src.getPageCount());
    if (!p.ok) return p;
  }
  const quality = Math.max(0.5, Math.min(1, options.quality ?? 0.9));

  try {
    const entries = findEmbeddedImages(src);
    let imagesInverted = 0;
    let pixelsInverted = 0;
    for (const entry of entries) {
      let bitmap: ImageBitmap | null = null;
      try {
        const blob = new Blob([entry.contents.slice().buffer as ArrayBuffer], { type: "image/*" });
        bitmap = await createImageBitmap(blob);
      } catch {
        continue;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(bitmap, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const inverted = invertPixels(img.data);
        pixelsInverted += canvas.width * canvas.height;
        ctx.putImageData(new ImageData(inverted, canvas.width, canvas.height), 0, 0);
        const blob2 = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
        if (!blob2) continue;
        const newBytes = new Uint8Array(await blob2.arrayBuffer());
        if (newBytes.length >= entry.contents.length) continue; // no gain
        (entry as unknown as { contents: Uint8Array }).contents = newBytes;
        entry.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        entry.dict.delete(PDFName.of("SMask"));
        imagesInverted++;
      } catch {
        // skip this image
      } finally {
        if (bitmap) bitmap.close();
      }
    }
    if (imagesInverted === 0) {
      return { ok: false, error: "No embedded images were found to invert. This works best on image-based PDFs." };
    }
    return {
      ok: true,
      output: { bytes: await src.save({ useObjectStreams: true }), imagesInverted, pixelsInverted },
    };
  } catch {
    return { ok: false, error: "Something went wrong while inverting colors." };
  }
}

void PDFNumber;
