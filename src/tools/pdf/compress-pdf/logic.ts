/**
 * Compress PDF — advanced, 100x-grade logic.
 *
 * Beyond structural re-saving, this engine performs REAL image recompression
 * entirely in the browser:
 *   - decodes every embedded JPEG (DCTDecode) image via createImageBitmap
 *   - downscales it (scaleFactor), optionally converts to grayscale,
 *     and re-encodes it as JPEG at the requested quality via canvas
 *   - swaps the new bytes straight back into the PDF's image stream and
 *     updates the /Width /Height dictionary entries
 *   - optional EXACT TARGET SIZE mode: iteratively tries lower quality /
 *     scale levels until the output fits (e.g. "make it ≤ 200 KB")
 *   - optional metadata stripping + lossless structural cleanup
 *
 * Falls back gracefully to lossless structural compression when the runtime
 * has no canvas (e.g. unit tests in Node) — output is always valid PDF.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type QualityPreset = "very-high" | "high" | "normal" | "compact" | "maximum";

export interface CompressOptions {
  /** JPEG quality 0.1–1 (default 0.82). Ignored when targetSizeKB is set. */
  quality?: number;
  /** Downscale factor for embedded images (default 1 = original size). */
  scaleFactor?: number;
  /** Convert images to grayscale (dramatically smaller for scans/docs). */
  grayscale?: boolean;
  /** Strip Title/Author/Subject/Keywords/Creator/Producer. */
  stripMetadata?: boolean;
  /** Exact target: keep lowering quality until ≤ this many KB (min 20). */
  targetSizeKB?: number;
}

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  /** Percentage reduction, e.g. 25.3 = 25.3% smaller. */
  reductionPercent: number;
  metadataStripped: boolean;
  /** JPEG quality actually used (null when no images re-encoded). */
  qualityUsed: number | null;
  /** True when targetSizeKB was requested and achieved. */
  targetReached: boolean;
  /** Number of images re-encoded. */
  imagesRecompressed: number;
}

export interface BatchItemResult {
  name: string;
  ok: boolean;
  error?: string;
  result?: CompressResult;
}

/* ------------------------------------------------------------------ */
/* Presets & pure helpers (unit-testable)                             */
/* ------------------------------------------------------------------ */

export const QUALITY_PRESETS: Record<QualityPreset, { quality: number; scale: number; label: string }> = {
  "very-high": { quality: 0.95, scale: 1, label: "Very high — minimal visual change" },
  high: { quality: 0.85, scale: 1, label: "High — great balance, looks identical" },
  normal: { quality: 0.75, scale: 0.9, label: "Normal — good quality, smaller file" },
  compact: { quality: 0.6, scale: 0.75, label: "Compact — smaller file, fine for screens" },
  maximum: { quality: 0.45, scale: 0.5, label: "Maximum — smallest file, for email/web" },
};

/** Quality ladder used by target-size mode (most conservative → most aggressive). */
export const TARGET_LADDER: { quality: number; scale: number }[] = [
  { quality: 0.85, scale: 1 },
  { quality: 0.75, scale: 0.9 },
  { quality: 0.65, scale: 0.8 },
  { quality: 0.55, scale: 0.7 },
  { quality: 0.45, scale: 0.6 },
  { quality: 0.35, scale: 0.5 },
  { quality: 0.25, scale: 0.4 },
];

export interface TargetPlan {
  maxAttempts: number;
  startIndex: number;
}

export function planTargetCompression(targetSizeKB: number): TargetPlan {
  const clamped = Math.max(20, Math.floor(targetSizeKB));
  const startIndex = clamped <= 50 ? 1 : 0;
  return { maxAttempts: TARGET_LADDER.length - startIndex, startIndex };
}

export function presetFor(preset: QualityPreset): { quality: number; scale: number } {
  return QUALITY_PRESETS[preset];
}

/* ------------------------------------------------------------------ */
/* Browser image re-encoding helpers                                  */
/* ------------------------------------------------------------------ */

/** True when the runtime can re-encode images (browser with canvas). */
export function canReencodeImages(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof HTMLCanvasElement !== "undefined"
  );
}

interface JpegStream {
  stream: PDFRawStream;
}

/** Find embedded JPEG (DCTDecode) image streams in the document. */
export function findJpegStreams(doc: PDFDocument): JpegStream[] {
  const out: JpegStream[] = [];
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
    if (filterName !== "/DCTDecode") continue;
    const width = obj.dict.get(PDFName.of("Width"))?.asNumber() ?? 0;
    const height = obj.dict.get(PDFName.of("Height"))?.asNumber() ?? 0;
    if (width < 2 || height < 2 || obj.contents.length < 20) continue;
    out.push({ stream: obj });
  }
  return out;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Re-encode a single JPEG stream at the given quality/scale/grayscale.
 * Replaces stream contents in place and updates /Width /Height.
 * Returns true when the new encoding is actually smaller.
 */
export async function recompressJpeg(
  entry: JpegStream,
  quality: number,
  scaleFactor: number,
  grayscale: boolean
): Promise<boolean> {
  let bitmap: ImageBitmap | null = null;
  try {
    const blob = new Blob([entry.stream.contents.slice().buffer as ArrayBuffer], { type: "image/jpeg" });
    bitmap = await createImageBitmap(blob);
  } catch {
    return false; // corrupt/odd JPEG — leave untouched
  }
  try {
    const w = Math.max(1, Math.round(bitmap.width * scaleFactor));
    const h = Math.max(1, Math.round(bitmap.height * scaleFactor));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (grayscale) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    const q = Math.min(1, Math.max(0.1, quality));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
    if (!blob) return false;
    const newBytes = await blobToBytes(blob);
    if (newBytes.length >= entry.stream.contents.length) return false; // no gain
    (entry.stream as unknown as { contents: Uint8Array }).contents = newBytes;
    const dict = entry.stream.dict;
    dict.set(PDFName.of("Width"), PDFNumber.of(w));
    dict.set(PDFName.of("Height"), PDFNumber.of(h));
    const decodeParms = dict.get(PDFName.of("DecodeParms"));
    if (decodeParms) dict.delete(PDFName.of("DecodeParms"));
    const decode = dict.get(PDFName.of("Decode"));
    if (decode) dict.delete(PDFName.of("Decode"));
    return true;
  } catch {
    return false;
  } finally {
    if (bitmap) bitmap.close();
  }
}

/* ------------------------------------------------------------------ */
/* Main compress engine                                               */
/* ------------------------------------------------------------------ */

async function structuralSave(doc: PDFDocument, stripMetadata: boolean): Promise<Uint8Array> {
  if (stripMetadata) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setCreator("");
    doc.setProducer("");
  }
  return doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 100 });
}

/**
 * Compress a single PDF. Pure, environment-aware.
 * - With canvas: real JPEG recompression (+ optional target-size loop).
 * - Without canvas (Node tests): structural re-save only.
 */
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
  const hasCanvas = canReencodeImages();
  let imagesRecompressed = 0;
  let qualityUsed: number | null = null;
  let targetReached = false;
  let finalBytes: Uint8Array;

  try {
    if (options.targetSizeKB && options.targetSizeKB > 0 && hasCanvas) {
      // ---- Exact target-size mode: ladder loop ----
      const plan = planTargetCompression(options.targetSizeKB);
      const targetBytes = options.targetSizeKB * 1024;
      let best: Uint8Array | null = null;
      let bestQ: number | null = null;
      for (let i = plan.startIndex; i < TARGET_LADDER.length; i++) {
        const step = TARGET_LADDER[i]!;
        const entries = findJpegStreams(doc);
        let recompressed = 0;
        for (const entry of entries) {
          if (await recompressJpeg(entry, step.quality, step.scale, !!options.grayscale)) {
            recompressed++;
          }
        }
        const candidate = await structuralSave(doc, !!options.stripMetadata);
        if (best === null || candidate.length < best.length) {
          best = candidate;
          bestQ = step.quality;
          imagesRecompressed = recompressed;
        }
        if (candidate.length <= targetBytes) {
          finalBytes = candidate;
          qualityUsed = step.quality;
          targetReached = true;
          imagesRecompressed = recompressed;
          return {
            ok: true,
            output: makeResult(finalBytes, originalSize, options, qualityUsed, targetReached, imagesRecompressed),
          };
        }
        // Reload the best-so-far so the next attempt starts from clean state.
        if (best) doc = await PDFDocument.load(best);
      }
      finalBytes = best ?? (await structuralSave(doc, !!options.stripMetadata));
      qualityUsed = bestQ;
    } else {
      // ---- Manual quality mode ----
      const quality = options.quality ?? 0.82;
      const scale = options.scaleFactor ?? 1;
      if (hasCanvas) {
        for (const entry of findJpegStreams(doc)) {
          if (await recompressJpeg(entry, quality, scale, !!options.grayscale)) {
            imagesRecompressed++;
          }
        }
        qualityUsed = findJpegStreams(doc).length > 0 ? quality : null;
      }
      finalBytes = await structuralSave(doc, !!options.stripMetadata);
    }
  } catch {
    return { ok: false, error: "Something went wrong while compressing — please try again." };
  }

  return {
    ok: true,
    output: makeResult(finalBytes, originalSize, options, qualityUsed, targetReached, imagesRecompressed),
  };
}

function makeResult(
  finalBytes: Uint8Array,
  originalSize: number,
  options: CompressOptions,
  qualityUsed: number | null,
  targetReached: boolean,
  imagesRecompressed: number
): CompressResult {
  const compressedSize = finalBytes.length;
  const reductionPercent =
    originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10 : 0;
  return {
    bytes: finalBytes,
    originalSize,
    compressedSize,
    reductionPercent,
    metadataStripped: !!options.stripMetadata,
    qualityUsed,
    targetReached,
    imagesRecompressed,
  };
}

/* ------------------------------------------------------------------ */
/* Batch helper                                                       */
/* ------------------------------------------------------------------ */

export interface BatchInput {
  name: string;
  bytes: Uint8Array;
}

/** Compress many PDFs with the same options. Never throws — per-file errors. */
export async function compressPdfs(
  files: BatchInput[],
  options: CompressOptions = {}
): Promise<BatchItemResult[]> {
  const out: BatchItemResult[] = [];
  for (const f of files) {
    try {
      const res = await compressPdf(f.bytes, options);
      if (res.ok) out.push({ name: f.name, ok: true, result: res.output });
      else out.push({ name: f.name, ok: false, error: res.error });
    } catch {
      out.push({ name: f.name, ok: false, error: "Unexpected error while compressing." });
    }
  }
  return out;
}
