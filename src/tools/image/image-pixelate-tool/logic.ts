/**
 * Image Pixelate Tool — pure block math. No DOM/canvas access.
 */
export interface PixelateOptions {
  /** Block size in pixels (e.g. 8 means 8x8 blocks). */
  blockSize: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Clamp block size to valid range. */
export function clampBlockSize(blockSize: number, width: number, height: number): number {
  const max = Math.max(width, height);
  return clamp(Math.floor(blockSize), 1, max);
}

/** Compute number of blocks across width/height. */
export function computeBlockCount(
  width: number,
  height: number,
  blockSize: number,
): { cols: number; rows: number } {
  const cols = Math.ceil(width / blockSize);
  const rows = Math.ceil(height / blockSize);
  return { cols, rows };
}

/** Find the bounds of a block, clamped to image dimensions. */
export function blockBounds(
  col: number,
  row: number,
  blockSize: number,
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: col * blockSize,
    y0: row * blockSize,
    x1: Math.min((col + 1) * blockSize, width),
    y1: Math.min((row + 1) * blockSize, height),
  };
}

/** Average a block of pixels from interleaved RGBA bytes. Returns {r,g,b,a}. */
export function averageBlock(
  rgba: Uint8ClampedArray,
  width: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
): { r: number; g: number; b: number; a: number } {
  let r = 0, g = 0, b = 0, a = 0, count = 0;
  for (let y = bounds.y0; y < bounds.y1; y++) {
    for (let x = bounds.x0; x < bounds.x1; x++) {
      const i = (y * width + x) * 4;
      r += rgba[i]!;
      g += rgba[i + 1]!;
      b += rgba[i + 2]!;
      a += rgba[i + 3]!;
      count++;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count), a: Math.round(a / count) };
}

export function validatePixelateOptions(opts: PixelateOptions, width: number, height: number): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.blockSize) || opts.blockSize < 1) return { error: "Block size must be at least 1" };
  if (opts.blockSize > Math.max(width, height)) return { error: "Block size larger than image" };
  return { ok: true };
}
