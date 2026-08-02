/**
 * Bulk Image Renamer + Optimizer — Web Worker.
 *
 * Uses OffscreenCanvas to process images off the main thread so the UI
 * stays responsive when handling hundreds of files. Falls back to
 * main-thread processing in ui.tsx when OffscreenCanvas is unavailable
 * (older browsers / Safari < 16.4).
 *
 * Message protocol:
 *   in:  { id: number; bitmap: ImageBitmap; options: OptimizeOptions }
 *   out: { ok: true; id: number; blob: Blob; width: number; height: number; hash: string }
 *      | { ok: false; id: number; error: string }
 *
 * The worker computes the post-resize dimensions, re-encodes to the
 * requested format/quality, draws the optional watermark, and computes a
 * perceptual hash of the resized bitmap — all in one pass.
 */
import {
  computeResizedDimensions,
  computePerceptualHash,
  type OptimizeOptions,
} from "./logic";

export interface WorkerRequest {
  id: number;
  bitmap: ImageBitmap;
  options: OptimizeOptions;
}

export interface WorkerResponse {
  ok: boolean;
  id: number;
  blob?: Blob;
  width?: number;
  height?: number;
  hash?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, bitmap, options } = e.data;
  try {
    const result = await processBitmap(bitmap, options);
    const response: WorkerResponse = {
      ok: true,
      id,
      blob: result.blob,
      width: result.width,
      height: result.height,
      hash: result.hash,
    };
    // Transfer the underlying buffer to avoid an extra copy.
    (self as unknown as Worker).postMessage(response, [result.blob]);
  } catch (err) {
    const response: WorkerResponse = {
      ok: false,
      id,
      error: (err as Error).message,
    };
    (self as unknown as Worker).postMessage(response);
  }
};

async function processBitmap(
  bitmap: ImageBitmap,
  options: OptimizeOptions,
): Promise<{ blob: Blob; width: number; height: number; hash: string }> {
  const { width, height } = computeResizedDimensions(
    bitmap.width,
    bitmap.height,
    options.maxDimension,
  );

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  // JPEG has no alpha — fill white first.
  if (options.format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Perceptual hash (16x16 grayscale sample).
  let hash = "0000000000000000";
  try {
    const sampleSize = 16;
    const sampleCanvas = new OffscreenCanvas(sampleSize, sampleSize);
    const sCtx = sampleCanvas.getContext("2d");
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
      const { data } = sCtx.getImageData(0, 0, sampleSize, sampleSize);
      const gray = new Uint8Array(sampleSize * sampleSize);
      for (let i = 0; i < sampleSize * sampleSize; i++) {
        gray[i] = Math.round(
          0.299 * data[i * 4]! +
            0.587 * data[i * 4 + 1]! +
            0.114 * data[i * 4 + 2]!,
        );
      }
      hash = computePerceptualHash(gray, sampleSize, sampleSize);
    }
  } catch {
    // hash failure is non-fatal
  }

  // Watermark
  if (options.watermark.enabled && options.watermark.text) {
    drawWatermark(ctx, width, height, options.watermark);
  }

  const blob = await canvas.convertToBlob({
    type: options.format,
    quality: options.format === "image/png" ? undefined : options.quality,
  });

  return { blob, width, height, hash };
}

function drawWatermark(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  wm: OptimizeOptions["watermark"],
): void {
  const scale = width / 1000;
  const fontSize = Math.max(8, wm.fontSize * scale);
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.fillStyle = wm.color;
  ctx.font = `${fontSize}px sans-serif`;
  const padding = Math.max(8, fontSize * 0.6);
  const metrics = ctx.measureText(wm.text);
  const textWidth = metrics.width;
  let x = padding;
  let y = padding + fontSize;
  switch (wm.position) {
    case "top-left":
      x = padding;
      y = padding + fontSize;
      break;
    case "top-right":
      x = width - textWidth - padding;
      y = padding + fontSize;
      break;
    case "bottom-left":
      x = padding;
      y = height - padding;
      break;
    case "bottom-right":
      x = width - textWidth - padding;
      y = height - padding;
      break;
    case "center":
      x = (width - textWidth) / 2;
      y = (height + fontSize) / 2;
      break;
  }
  ctx.fillText(wm.text, x, y);
  ctx.restore();
}
