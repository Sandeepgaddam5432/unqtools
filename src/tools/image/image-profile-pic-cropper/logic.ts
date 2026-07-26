/**
 * Profile Picture Cropper — pure logic. No DOM/canvas access.
 *
 * Extras (10+):
 *   1. Platform presets (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok)
 *   2. Crop shape: square or circle
 *   3. Zoom factor (1-3x) for crop rect scaling
 *   4. Position offset (x/y) to recenter crop
 *   5. Aspect ratio enforcement
 *   6. Multiple export sizes (single source → many sizes)
 *   7. Crop rect clamping to source bounds
 *   8. Subject framing guide (rule-of-thirds intersections)
 *   9. Face-safe minimum size warning
 *  10. Quality score for source resolution
 *  11. Circle bounding box computation
 *  12. CSV export of crop specs per platform
 */
export type CropShape = "square" | "circle";

export interface PlatformPreset {
  code: string;
  name: string;
  size: number;
  shape: CropShape;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { code: "instagram", name: "Instagram", size: 320, shape: "circle" },
  { code: "facebook", name: "Facebook", size: 170, shape: "circle" },
  { code: "twitter", name: "Twitter / X", size: 400, shape: "circle" },
  { code: "linkedin", name: "LinkedIn", size: 400, shape: "circle" },
  { code: "youtube", name: "YouTube", size: 800, shape: "circle" },
  { code: "tiktok", name: "TikTok", size: 200, shape: "circle" },
];

export function getPlatform(code: string): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find((p) => p.code === code);
}

export interface CropInput {
  srcWidth: number;
  srcHeight: number;
  platformCode: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface CropResult {
  x: number;
  y: number;
  width: number;
  height: number;
  outputSize: number;
  shape: CropShape;
  warnings: string[];
}

const isFin = (n: number) => Number.isFinite(n);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function validateInput(input: CropInput): { ok: true } | { error: string } {
  if (!isFin(input.srcWidth) || input.srcWidth <= 0) return { error: "Source width must be positive" };
  if (!isFin(input.srcHeight) || input.srcHeight <= 0) return { error: "Source height must be positive" };
  if (!isFin(input.zoom) || input.zoom <= 0) return { error: "Zoom must be positive" };
  if (!isFin(input.offsetX) || !isFin(input.offsetY)) return { error: "Offsets must be finite numbers" };
  if (!getPlatform(input.platformCode)) return { error: `Unknown platform: ${input.platformCode}` };
  return { ok: true };
}

/** Compute the centered crop rect before applying zoom & offset. */
export function baseCropRect(srcWidth: number, srcHeight: number): { x: number; y: number; width: number; height: number } {
  const s = Math.min(srcWidth, srcHeight);
  return { x: (srcWidth - s) / 2, y: (srcHeight - s) / 2, width: s, height: s };
}

/** Apply zoom (crop smaller) and offset (recenter). Clamps to source bounds. */
export function applyZoomAndOffset(
  srcWidth: number,
  srcHeight: number,
  base: { x: number; y: number; width: number; height: number },
  zoom: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number; width: number; height: number } {
  const z = clamp(zoom, 0.1, 10);
  const w = base.width / z;
  const h = base.height / z;
  const cx = base.x + base.width / 2 + offsetX;
  const cy = base.y + base.height / 2 + offsetY;
  let x = cx - w / 2;
  let y = cy - h / 2;
  // Clamp to source
  x = clamp(x, 0, srcWidth - w);
  y = clamp(y, 0, srcHeight - h);
  return { x, y, width: w, height: h };
}

/** Main crop calculation. */
export function calculateCrop(input: CropInput): CropResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return v;
  const platform = getPlatform(input.platformCode)!;
  const warnings: string[] = [];

  const base = baseCropRect(input.srcWidth, input.srcHeight);
  const crop = applyZoomAndOffset(input.srcWidth, input.srcHeight, base, input.zoom, input.offsetX, input.offsetY);

  if (crop.width < platform.size * 0.5) {
    warnings.push(`Crop region ${Math.round(crop.width)}px is much smaller than output ${platform.size}px — image may look blurry`);
  }
  if (input.zoom > 3) {
    warnings.push("High zoom may cause pixelation");
  }
  if (crop.width < 100) {
    warnings.push("Crop region is very small — face may not be visible");
  }

  return {
    x: Math.round(crop.x),
    y: Math.round(crop.y),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
    outputSize: platform.size,
    shape: platform.shape,
    warnings,
  };
}

/** Generate crop specs for all platforms from one source image. */
export function multiPlatformCrops(
  srcWidth: number,
  srcHeight: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): (CropResult & { code: string; name: string })[] {
  return PLATFORM_PRESETS.map((p) => {
    const r = calculateCrop({
      srcWidth, srcHeight, platformCode: p.code, zoom, offsetX, offsetY,
    });
    if ("error" in r) throw new Error(r.error);
    return { ...r, code: p.code, name: p.name };
  });
}

/** Rule-of-thirds intersection points for subject framing guide. */
export function ruleOfThirdsPoints(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number }[] {
  const { x, y, width, height } = rect;
  return [
    { x: x + width / 3, y: y + height / 3 },
    { x: x + (2 * width) / 3, y: y + height / 3 },
    { x: x + width / 3, y: y + (2 * height) / 3 },
    { x: x + (2 * width) / 3, y: y + (2 * height) / 3 },
  ];
}

/** Bounding box of the inscribed circle for a square crop rect. */
export function circleBounds(rect: { x: number; y: number; width: number; height: number }): { cx: number; cy: number; r: number } {
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    r: Math.min(rect.width, rect.height) / 2,
  };
}

/** Quality score 0-100 for source resolution vs platform size. */
export function sourceQuality(srcWidth: number, srcHeight: number, outputSize: number): number {
  const s = Math.min(srcWidth, srcHeight);
  const ratio = s / outputSize;
  if (ratio >= 2) return 100;
  if (ratio >= 1) return 80;
  if (ratio >= 0.5) return 50;
  return 20;
}

/** Build a download filename for the cropped profile pic. */
export function buildFilename(platformCode: string, shape: CropShape): string {
  const p = getPlatform(platformCode);
  return `profile-${platformCode}-${shape}-${p?.size ?? 400}.png`;
}

/** CSV export of all platform crop specs. */
export function cropsToCsv(crops: (CropResult & { code: string; name: string })[]): string {
  const lines = ["platform,name,x,y,width,height,outputSize,shape"];
  for (const c of crops) {
    lines.push(`${c.code},${c.name},${c.x},${c.y},${c.width},${c.height},${c.outputSize},${c.shape}`);
  }
  return lines.join("\n");
}
