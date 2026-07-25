/**
 * Image Cropper — pure logic. No DOM access.
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropInput extends CropRect {
  /** Source image bounds. */
  imageWidth: number;
  imageHeight: number;
}

export type CropResult = CropRect | { error: string };

/** Validate and clamp a crop rectangle to the source image bounds. */
export function validateCrop(input: CropInput): CropResult {
  const { x, y, width, height, imageWidth: iw, imageHeight: ih } = input;
  if (iw <= 0 || ih <= 0) return { error: "Image dimensions must be positive" };
  if (width <= 0 || height <= 0) return { error: "Crop width and height must be positive" };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Crop x and y must be numbers" };

  // Reject when the crop is fully outside the image (no overlap at all).
  if (x >= iw || y >= ih || x + width <= 0 || y + height <= 0) {
    return { error: "Crop region is outside the image" };
  }

  const cx = Math.max(0, Math.min(x, iw - 1));
  const cy = Math.max(0, Math.min(y, ih - 1));
  const cw = Math.min(width, iw - cx);
  const ch = Math.min(height, ih - cy);
  if (cw <= 0 || ch <= 0) return { error: "Crop region is outside the image" };
  return { x: Math.round(cx), y: Math.round(cy), width: Math.round(cw), height: Math.round(ch) };
}

/** Compute a centered crop rect for a given aspect ratio. */
export function centerCropForAspect(
  imageWidth: number,
  imageHeight: number,
  aspectW: number,
  aspectH: number,
): CropRect {
  if (aspectW <= 0 || aspectH <= 0) {
    return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  }
  const targetAspect = aspectW / aspectH;
  const sourceAspect = imageWidth / imageHeight;
  let w: number;
  let h: number;
  if (sourceAspect > targetAspect) {
    h = imageHeight;
    w = Math.round(h * targetAspect);
  } else {
    w = imageWidth;
    h = Math.round(w / targetAspect);
  }
  return {
    x: Math.round((imageWidth - w) / 2),
    y: Math.round((imageHeight - h) / 2),
    width: w,
    height: h,
  };
}

export const ASPECT_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Free", w: 0, h: 0 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:2", w: 3, h: 2 },
  { label: "16:9", w: 16, h: 9 },
  { label: "9:16", w: 9, h: 16 },
];
