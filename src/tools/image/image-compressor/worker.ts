/**
 * Image Compressor — Web Worker.
 *
 * Uses OffscreenCanvas to compress images off the main thread.
 * Falls back to main-thread processing if OffscreenCanvas is unavailable
 * (handled in ui.tsx).
 *
 * Message protocol:
 *   in:  { id: number; bitmap: ImageBitmap; options: CompressOptions; filename: string }
 *   out: { ok: true; blob: Blob; width: number; height: number; quality: number; filename: string }
 *      | { ok: false; error: string; filename: string }
 */
import { computeResizedDimensions, type CompressOptions } from "./logic";

export interface WorkerRequest {
  id: number;
  bitmap: ImageBitmap;
  options: CompressOptions;
  filename: string;
}

export interface WorkerResponse {
  ok: boolean;
  filename: string;
  blob?: Blob;
  width?: number;
  height?: number;
  quality?: number;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { bitmap, options, filename } = e.data;
  try {
    const result = await compressBitmap(bitmap, options);
    const response: WorkerResponse = {
      ok: true,
      filename,
      blob: result.blob,
      width: result.width,
      height: result.height,
      quality: result.quality,
    };
    (self as unknown as Worker).postMessage(response, [result.blob]);
  } catch (err) {
    const response: WorkerResponse = {
      ok: false,
      filename,
      error: (err as Error).message,
    };
    (self as unknown as Worker).postMessage(response);
  }
};

async function compressBitmap(
  bitmap: ImageBitmap,
  options: CompressOptions,
): Promise<{ blob: Blob; width: number; height: number; quality: number }> {
  const { width, height } = computeResizedDimensions(
    bitmap.width,
    bitmap.height,
    options.maxDimension,
  );

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  // For JPEG output, fill white background (JPEG doesn't support alpha)
  if (options.format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: options.format,
    quality: options.format === "image/png" ? undefined : options.quality,
  });

  return { blob, width, height, quality: options.quality };
}
