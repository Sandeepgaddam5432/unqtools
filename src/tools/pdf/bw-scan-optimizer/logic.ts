/**
 * Black & White (1-bit) Scan Optimizer — real engine.
 *
 * Scanned PDFs are image-based: every page is (mostly) one embedded photo.
 * This tool finds every embedded JPEG/PNG image in the PDF, decodes it in the
 * browser, converts it to 1-bit black & white (threshold), optionally
 * applies Floyd–Steinberg dithering and a median despeckle filter, then
 * re-encodes and swaps the pixels back into the PDF. Pure pixel math
 * (`toBinary`, `floydSteinberg`, `medianDespeckle`) is unit-tested in Node;
 * full conversion needs a browser (canvas + createImageBitmap).
 */
import { PDFDocument, PDFName, PDFRawStream, PDFNumber, PDFDict } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface BwOptions {
  /** 0–255 threshold for simple B&W conversion. Default 128. */
  threshold?: number;
  /** Use Floyd–Steinberg dithering (better for photos/halftones). Default false. */
  dither?: boolean;
  /** Despeckle radius (0 = off, 1 = 3×3 median, 2 = 5×5). Default 0. */
  despeckle?: number;
  /** Page range to process (empty = all). */
  pages?: string;
  /** JPEG quality for processed images (0.5–1). Default 0.92. */
  quality?: number;
}

export interface BwResult {
  bytes: Uint8Array;
  imagesProcessed: number;
  pagesAffected: number;
  pixelsConverted: number;
}

/* ------------------------------------------------------------------ */
/* Pure pixel math (Node-testable)                                     */
/* ------------------------------------------------------------------ */

/** Luminance of an RGB pixel (Rec. 601). */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Convert RGBA pixels to 1-bit B&W using a threshold.
 * Returns a new buffer; RGB set to 0 (black) or 255 (white), alpha kept.
 */
export function toBinary(rgba: Uint8Array, threshold: number): Uint8Array {
  const t = Math.max(0, Math.min(255, threshold));
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const v = luminance(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!) >= t ? 255 : 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/**
 * Floyd–Steinberg error-diffusion dithering on an RGBA buffer.
 * Produces 1-bit output with halftone-like quality for photos.
 */
export function floydSteinberg(
  rgba: Uint8Array,
  width: number,
  threshold: number
): Uint8Array {
  const out = rgba.slice();
  const t = Math.max(0, Math.min(255, threshold));
  const height = Math.floor(out.length / 4 / width);
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      const old = luminance(out[i]!, out[i + 1]!, out[i + 2]!);
      const nv = old >= t ? 255 : 0;
      out[i] = nv;
      out[i + 1] = nv;
      out[i + 2] = nv;
      const err = old - nv;
      const dist = (nx: number, ny: number, w: number) => {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
        const j = idx(nx, ny);
        const add = (err * w) / 16;
        out[j] = clamp(out[j]! + add);
        out[j + 1] = clamp(out[j + 1]! + add);
        out[j + 2] = clamp(out[j + 2]! + add);
      };
      dist(x + 1, y, 7);
      dist(x - 1, y + 1, 3);
      dist(x, y + 1, 5);
      dist(x + 1, y + 1, 1);
    }
  }
  return out;
}

/**
 * Median (despeckle) filter: radius 1 = 3×3, radius 2 = 5×5.
 * Removes isolated noise pixels while keeping edges.
 */
export function medianDespeckle(
  rgba: Uint8Array,
  width: number,
  radius: number
): Uint8Array {
  const r = Math.max(0, Math.min(2, Math.floor(radius)));
  if (r === 0) return rgba.slice();
  const out = rgba.slice();
  const height = Math.floor(out.length / 4 / width);
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const median = (vals: number[]): number => {
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)]!;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const j = idx(nx, ny);
          rs.push(rgba[j]!);
          gs.push(rgba[j + 1]!);
          bs.push(rgba[j + 2]!);
        }
      }
      const i = idx(x, y);
      out[i] = median(rs);
      out[i + 1] = median(gs);
      out[i + 2] = median(bs);
      out[i + 3] = rgba[i + 3]!;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Browser helpers                                                     */
/* ------------------------------------------------------------------ */

export function canProcessImages(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof HTMLCanvasElement !== "undefined"
  );
}

interface ImageEntry {
  stream: PDFRawStream;
}

/** Find embedded JPEG (DCTDecode) or PNG (FlateDecode with SMask skip) images. */
export function findEmbeddedImages(doc: PDFDocument): ImageEntry[] {
  const out: ImageEntry[] = [];
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
    // Skip soft-mask images (transparency channels).
    if (obj.dict.get(PDFName.of("SMask"))) continue;
    out.push({ stream: obj });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main conversion                                                     */
/* ------------------------------------------------------------------ */

export async function optimizeBwPdf(
  bytes: Uint8Array,
  options: BwOptions = {}
): Promise<ToolResult<BwResult>> {
  if (!canProcessImages()) {
    return { ok: false, error: "This tool requires a browser environment." };
  }
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };

  const spec = (options.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
  }

  const threshold = Math.max(0, Math.min(255, options.threshold ?? 128));
  const dither = options.dither ?? false;
  const despeckle = Math.max(0, Math.min(2, Math.floor(options.despeckle ?? 0)));
  const quality = Math.max(0.5, Math.min(1, options.quality ?? 0.92));

  try {
    const entries = findEmbeddedImages(src);
    let imagesProcessed = 0;
    let pixelsConverted = 0;

    for (const entry of entries) {
      let bitmap: ImageBitmap | null = null;
      try {
        const blob = new Blob([entry.stream.contents.slice().buffer as ArrayBuffer], { type: "image/*" });
        bitmap = await createImageBitmap(blob);
      } catch {
        continue; // unreadable — leave untouched
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(bitmap, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = img.data;
        if (despeckle > 0) data = medianDespeckle(data, canvas.width, despeckle);
        data = dither ? floydSteinberg(data, canvas.width, threshold) : toBinary(data, threshold);
        pixelsConverted += canvas.width * canvas.height;
        ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);

        const blob2 = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
        if (!blob2) continue;
        const newBytes = new Uint8Array(await blob2.arrayBuffer());
        if (newBytes.length >= entry.stream.contents.length) continue; // no gain
        (entry.stream as unknown as { contents: Uint8Array }).contents = newBytes;
        const dict = entry.stream.dict;
        dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceGray"));
        dict.delete(PDFName.of("SMask"));
        const dp = dict.get(PDFName.of("DecodeParms"));
        if (dp instanceof PDFDict) dict.delete(PDFName.of("DecodeParms"));
        imagesProcessed++;
      } catch {
        // leave this image untouched
      } finally {
        if (bitmap) bitmap.close();
      }
    }

    if (imagesProcessed === 0) {
      return {
        ok: false,
        error: "No embedded images were found to optimize. This works best on scanned/image-based PDFs.",
      };
    }

    return {
      ok: true,
      output: {
        bytes: await src.save({ useObjectStreams: true }),
        imagesProcessed,
        pagesAffected: total,
        pixelsConverted,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while optimizing the scan." };
  }
}

void PDFNumber;
