/**
 * Grayscale / Black & White PDF — real engine.
 *
 * Converts every embedded image to true grayscale in the browser (canvas +
 * luminance) and swaps the re-encoded images back into the PDF — ideal for
 * printing or smaller files from color scans. Pure pixel math is
 * unit-tested in Node.
 */
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { luminance, findEmbeddedImages, canProcessImages } from "../bw-scan-optimizer/logic";

export interface GrayscaleOptions {
  /** JPEG quality for re-encoded images (0.5–1). */
  quality?: number;
}

export interface GrayscaleResult {
  bytes: Uint8Array;
  imagesConverted: number;
  pixelsConverted: number;
}

/** Pure: convert RGBA to grayscale (luminance), keeping alpha. */
export function toGrayscale(rgba: Uint8Array): Uint8Array {
  const out = rgba.slice();
  for (let i = 0; i < out.length; i += 4) {
    const g = Math.round(luminance(out[i]!, out[i + 1]!, out[i + 2]!));
    out[i] = g;
    out[i + 1] = g;
    out[i + 2] = g;
  }
  return out;
}

export async function grayscalePdf(
  bytes: Uint8Array,
  options: GrayscaleOptions = {}
): Promise<ToolResult<GrayscaleResult>> {
  if (!canProcessImages()) {
    return { ok: false, error: "This tool requires a browser environment." };
  }
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const quality = Math.max(0.5, Math.min(1, options.quality ?? 0.9));

  try {
    const entries = findEmbeddedImages(src);
    let imagesConverted = 0;
    let pixelsConverted = 0;
    for (const entry of entries) {
      let bitmap: ImageBitmap | null = null;
      try {
        const blob = new Blob([entry.stream.contents.slice().buffer as ArrayBuffer], { type: "image/*" });
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
        const gray = toGrayscale(img.data);
        pixelsConverted += canvas.width * canvas.height;
        ctx.putImageData(new ImageData(gray, canvas.width, canvas.height), 0, 0);
        const blob2 = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
        if (!blob2) continue;
        const newBytes = new Uint8Array(await blob2.arrayBuffer());
        if (newBytes.length >= entry.stream.contents.length) continue;
        (entry.stream as unknown as { contents: Uint8Array }).contents = newBytes;
        entry.stream.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        entry.stream.dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceGray"));
        entry.stream.dict.delete(PDFName.of("SMask"));
        imagesConverted++;
      } catch {
        // skip
      } finally {
        if (bitmap) bitmap.close();
      }
    }
    if (imagesConverted === 0) {
      return { ok: false, error: "No embedded images were found to convert." };
    }
    return {
      ok: true,
      output: { bytes: await src.save({ useObjectStreams: true }), imagesConverted, pixelsConverted },
    };
  } catch {
    return { ok: false, error: "Something went wrong while converting to grayscale." };
  }
}
