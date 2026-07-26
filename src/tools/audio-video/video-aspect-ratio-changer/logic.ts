/**
 * Video Aspect Ratio Changer — pure logic.
 * Computes crop/pad/blur transformations for changing a video from one aspect
 * ratio to another. Provides target dimensions, crop rectangles, padding, and
 * canvas layouts without any video encoding.
 */

export type AspectMode = "crop" | "pad" | "blur" | "stretch";

export type AspectRatio = "16:9" | "4:3" | "1:1" | "9:16" | "21:9" | "3:2" | "5:4";

export interface AspectParams {
  sourceWidth: number;
  sourceHeight: number;
  targetRatio: AspectRatio;
  mode: AspectMode;
  padColor?: string; // hex for pad/blur background
  blurStrength?: number; // 0..50 for blur mode
}

export interface AspectResult {
  targetWidth: number;
  targetHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  padX: number;
  padY: number;
  padWidth: number;
  padHeight: number;
  mode: AspectMode;
  description: string;
}

/** Parse aspect ratio string into numeric ratio. */
export function parseRatio(r: AspectRatio): { w: number; h: number } {
  const map: Record<AspectRatio, { w: number; h: number }> = {
    "16:9": { w: 16, h: 9 },
    "4:3": { w: 4, h: 3 },
    "1:1": { w: 1, h: 1 },
    "9:16": { w: 9, h: 16 },
    "21:9": { w: 21, h: 9 },
    "3:2": { w: 3, h: 2 },
    "5:4": { w: 5, h: 4 },
  };
  return map[r];
}

/** Compute target dimensions that match source area and target aspect ratio. */
export function computeTargetDimensions(sourceW: number, sourceH: number, target: AspectRatio): { width: number; height: number } {
  const r = parseRatio(target);
  const targetRatio = r.w / r.h;
  const sourceRatio = sourceW / sourceH;
  // Keep the larger dimension; round to even for video encoding
  let width: number, height: number;
  if (sourceRatio > targetRatio) {
    // Source is wider — height fixed
    height = sourceH;
    width = Math.round(sourceH * targetRatio);
  } else {
    width = sourceW;
    height = Math.round(sourceW / targetRatio);
  }
  return { width: roundEven(width), height: roundEven(height) };
}

/** Round to nearest even number (video encoding requirement). */
export function roundEven(n: number): number {
  return Math.round(n / 2) * 2;
}

/** Compute center-crop rectangle within source dimensions. */
export function centerCrop(sourceW: number, sourceH: number, cropW: number, cropH: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.round((sourceW - cropW) / 2)),
    y: Math.max(0, Math.round((sourceH - cropH) / 2)),
  };
}

/** Compute the full aspect-ratio transformation. */
export function computeAspect(params: AspectParams): AspectResult {
  const { sourceWidth: sw, sourceHeight: sh, targetRatio, mode } = params;
  const target = computeTargetDimensions(sw, sh, targetRatio);
  let result: AspectResult;
  if (mode === "crop") {
    // Source area larger than target; crop center
    const cropW = Math.min(sw, target.width);
    const cropH = Math.min(sh, target.height);
    const { x, y } = centerCrop(sw, sh, cropW, cropH);
    result = {
      targetWidth: target.width,
      targetHeight: target.height,
      cropX: x,
      cropY: y,
      cropWidth: cropW,
      cropHeight: cropH,
      padX: 0, padY: 0, padWidth: target.width, padHeight: target.height,
      mode,
      description: `Crop ${cropW}×${cropH} from center, scale to ${target.width}×${target.height}.`,
    };
  } else if (mode === "pad") {
    // Fit entire source inside target; add letterbox/pillarbox
    const r = parseRatio(targetRatio);
    const targetRatioVal = r.w / r.h;
    const sourceRatio = sw / sh;
    let padW: number, padH: number;
    if (sourceRatio > targetRatioVal) {
      padW = target.width;
      padH = roundEven(target.width / sourceRatio);
    } else {
      padH = target.height;
      padW = roundEven(target.height * sourceRatio);
    }
    const padX = Math.round((target.width - padW) / 2);
    const padY = Math.round((target.height - padH) / 2);
    result = {
      targetWidth: target.width,
      targetHeight: target.height,
      cropX: 0, cropY: 0, cropWidth: sw, cropHeight: sh,
      padX, padY, padWidth: padW, padHeight: padH,
      mode,
      description: `Letterbox source into ${target.width}×${target.height} with ${params.padColor ?? "#000"} bars.`,
    };
  } else if (mode === "blur") {
    // Scale source to cover target, blur as background, then center source
    result = {
      targetWidth: target.width,
      targetHeight: target.height,
      cropX: 0, cropY: 0, cropWidth: sw, cropHeight: sh,
      padX: 0, padY: 0, padWidth: target.width, padHeight: target.height,
      mode,
      description: `Blurred backdrop (strength ${params.blurStrength ?? 20}) with source centered at cover fit.`,
    };
  } else {
    // stretch — just resize
    result = {
      targetWidth: target.width,
      targetHeight: target.height,
      cropX: 0, cropY: 0, cropWidth: sw, cropHeight: sh,
      padX: 0, padY: 0, padWidth: target.width, padHeight: target.height,
      mode: "stretch",
      description: `Stretch source to ${target.width}×${target.height} (may distort).`,
    };
  }
  return result;
}

/** Compute the percentage of source pixels retained (crop efficiency). */
export function cropEfficiency(sourceW: number, sourceH: number, cropW: number, cropH: number): number {
  const sourceArea = sourceW * sourceH;
  const cropArea = cropW * cropH;
  if (sourceArea === 0) return 0;
  return Math.round((cropArea / sourceArea) * 100);
}

/** Compute the percentage of target that's "wasted" on padding (pad mode). */
export function padWaste(targetW: number, targetH: number, padW: number, padH: number): number {
  const targetArea = targetW * targetH;
  const padArea = padW * padH;
  if (targetArea === 0) return 0;
  return Math.round(((targetArea - padArea) / targetArea) * 100);
}

/** List of common aspect ratios with labels. */
export const ASPECT_RATIOS: Array<{ value: AspectRatio; label: string; common: string }> = [
  { value: "16:9", label: "16:9", common: "YouTube, HD" },
  { value: "9:16", label: "9:16", common: "TikTok, Reels" },
  { value: "1:1", label: "1:1", common: "Instagram" },
  { value: "4:3", label: "4:3", common: "Classic TV" },
  { value: "21:9", label: "21:9", common: "Cinematic" },
  { value: "3:2", label: "3:2", common: "Photo" },
  { value: "5:4", label: "5:4", common: "Medium format" },
];

/** Detect the closest aspect ratio for given dimensions. */
export function detectClosestRatio(width: number, height: number): AspectRatio {
  if (width <= 0 || height <= 0) return "16:9";
  const r = width / height;
  const ratios = ASPECT_RATIOS.map((a) => ({ ...a, ratio: parseRatio(a.value) }));
  let best: AspectRatio = "16:9";
  let bestDiff = Infinity;
  for (const a of ratios) {
    const diff = Math.abs(Math.log(r / (a.ratio.w / a.ratio.h)));
    if (diff < bestDiff) { bestDiff = diff; best = a.value; }
  }
  return best;
}

/** Format dimensions as W×H. */
export function formatDimensions(w: number, h: number): string {
  return `${w}×${h}`;
}

/** Compute resulting file size estimate based on pixel count. */
export function estimateRelativeSize(sourceW: number, sourceH: number, targetW: number, targetH: number): number {
  const sourceArea = sourceW * sourceH;
  const targetArea = targetW * targetH;
  if (sourceArea === 0) return 1;
  return Math.round((targetArea / sourceArea) * 100) / 100;
}

/** Build a CSS representation of the transformation for preview. */
export function toCssPreview(result: AspectResult): string {
  return [
    `width: ${result.targetWidth}px;`,
    `height: ${result.targetHeight}px;`,
    result.mode === "pad" ? `background: #000;` : "",
    result.mode === "blur" ? `backdrop-filter: blur(${result.padWidth > 0 ? 20 : 0}px);` : "",
  ].filter(Boolean).join(" ");
}
