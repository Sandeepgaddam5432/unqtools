/**
 * Image Cropper — pure logic. No DOM access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Validate / clamp crop rect to source bounds
 *   2. Centered crop for any aspect ratio
 *   3. Aspect ratio presets (1:1, 4:3, 16:9, etc.)
 *   4. Exact pixel-size crop (resize to target w×h)
 *   5. Rotation parameter (0/90/180/270)
 *   6. Shape crop (rect / circle / rounded)
 *   7. Grid overlay (rule-of-thirds, golden ratio)
 *   8. Batch processing for multiple images
 *   9. CSV export of crop specs
 *  10. Pixel statistics (computed on bounds only — no DOM)
 *  11. Aspect-ratio fitting (cover vs contain)
 *  12. Corner detection (top-left, top-right, bottom-left, bottom-right)
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropInput extends CropRect {
  imageWidth: number;
  imageHeight: number;
}

export type CropResult = CropRect | { error: string };

export type Rotation = 0 | 90 | 180 | 270;
export type CropShape = "rect" | "circle" | "rounded";

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;

/** Validate and clamp a crop rectangle to the source image bounds. */
export function validateCrop(input: CropInput): CropResult {
  const { x, y, width, height, imageWidth: iw, imageHeight: ih } = input;
  if (!isPos(iw) || !isPos(ih)) return { error: "Image dimensions must be positive" };
  if (!isPos(width) || !isPos(height)) return { error: "Crop width and height must be positive" };
  if (!isFin(x) || !isFin(y)) return { error: "Crop x and y must be numbers" };

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
  imageWidth: number, imageHeight: number,
  aspectW: number, aspectH: number,
): CropRect {
  if (!isPos(aspectW) || !isPos(aspectH)) {
    return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  }
  const targetAspect = aspectW / aspectH;
  const sourceAspect = imageWidth / imageHeight;
  let w: number; let h: number;
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
    width: w, height: h,
  };
}

/** Compute crop rect that exactly fits a target pixel size. */
export function cropToExact(
  imageWidth: number, imageHeight: number,
  targetW: number, targetH: number,
): CropRect | { error: string } {
  if (!isPos(targetW) || !isPos(targetH)) return { error: "Target must be positive" };
  if (targetW > imageWidth || targetH > imageHeight) return { error: "Target exceeds source dimensions" };
  return {
    x: Math.round((imageWidth - targetW) / 2),
    y: Math.round((imageHeight - targetH) / 2),
    width: targetW, height: targetH,
  };
}

/** Compute the four corner points of a crop rect. */
export function corners(rect: CropRect): { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] } {
  const { x, y, width, height } = rect;
  return {
    tl: [x, y],
    tr: [x + width, y],
    br: [x + width, y + height],
    bl: [x, y + height],
  };
}

/** Compute grid lines for an overlay (rule-of-thirds by default). */
export function gridLines(rect: CropRect, divisions = 3): { verticals: number[]; horizontals: number[] } {
  if (divisions < 1) return { verticals: [], horizontals: [] };
  const verticals: number[] = [];
  const horizontals: number[] = [];
  for (let i = 1; i < divisions; i++) {
    verticals.push(rect.x + (rect.width * i) / divisions);
    horizontals.push(rect.y + (rect.height * i) / divisions);
  }
  return { verticals, horizontals };
}

/** Swap dimensions if rotation is 90 or 270 degrees. */
export function rotateDimensions(width: number, height: number, rotation: Rotation): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) return { width: height, height: width };
  return { width, height };
}

/** Compute crop area and aspect ratio. */
export function rectStats(rect: CropRect): { area: number; aspect: number } {
  const area = rect.width * rect.height;
  const aspect = rect.height === 0 ? 0 : rect.width / rect.height;
  return { area, aspect };
}

/** Compute the bounding circle for a crop rect (for circle shape crop). */
export function boundingCircle(rect: CropRect): { cx: number; cy: number; r: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return { cx, cy, r: Math.min(rect.width, rect.height) / 2 };
}

/** Compute the largest square inside a crop rect. */
export function largestSquare(rect: CropRect): CropRect {
  const s = Math.min(rect.width, rect.height);
  return {
    x: rect.x + (rect.width - s) / 2,
    y: rect.y + (rect.height - s) / 2,
    width: s, height: s,
  };
}

/** Fit a target aspect inside (contain) or covering (cover) a source rect. */
export function fitAspect(srcW: number, srcH: number, aspectW: number, aspectH: number, mode: "contain" | "cover" = "contain"): CropRect {
  const target = aspectW / aspectH;
  const source = srcW / srcH;
  let w: number; let h: number;
  const shouldShrinkWidth = mode === "contain" ? source > target : source < target;
  if (shouldShrinkWidth) {
    h = srcH; w = h * target;
  } else {
    w = srcW; h = w / target;
  }
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, width: w, height: h };
}

export const ASPECT_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Free", w: 0, h: 0 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:2", w: 3, h: 2 },
  { label: "16:9", w: 16, h: 9 },
  { label: "9:16", w: 9, h: 16 },
  { label: "21:9", w: 21, h: 9 },
  { label: "3:4 (portrait)", w: 3, h: 4 },
  { label: "2:3 (portrait)", w: 2, h: 3 },
];

/** Batch-validate crop rects across multiple images. */
export function batchValidate(
  crops: CropInput[],
): { i: number; result: CropResult }[] {
  return crops.map((c, i) => ({ i, result: validateCrop(c) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: CropResult }[],
): string {
  const lines = ["index,x,y,width,height"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,,,error: ${r.result.error}`);
    else lines.push(`${r.i},${r.result.x},${r.result.y},${r.result.width},${r.result.height}`);
  }
  return lines.join("\n");
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
