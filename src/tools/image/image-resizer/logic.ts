/**
 * Image Resizer — pure logic. No DOM access.
 */
export interface ResizeInput {
  originalWidth: number;
  originalHeight: number;
  targetWidth?: number;
  targetHeight?: number;
  /** When true, the missing dimension is computed from the supplied one. */
  lockAspect: boolean;
  /** Optional percentage scale (e.g. 50 = 50%). Overrides explicit dims. */
  scalePercent?: number;
}

export interface ResizeResult {
  width: number;
  height: number;
  /** Effective scale factor applied. */
  scale: number;
}

const clampPos = (n: number) => Math.max(1, Math.round(n));

/** Compute resized dimensions honoring aspect-ratio lock or percent scale. */
export function calculateResize(input: ResizeInput): ResizeResult | { error: string } {
  const { originalWidth: ow, originalHeight: oh } = input;
  if (ow <= 0 || oh <= 0) return { error: "Original dimensions must be positive" };

  if (input.scalePercent !== undefined) {
    const pct = input.scalePercent;
    if (!Number.isFinite(pct) || pct <= 0) return { error: "Scale percent must be > 0" };
    const scale = pct / 100;
    return {
      width: clampPos(ow * scale),
      height: clampPos(oh * scale),
      scale,
    };
  }

  const tw = input.targetWidth;
  const th = input.targetHeight;

  if (tw === undefined && th === undefined) return { error: "Provide width, height, or scalePercent" };

  if (input.lockAspect) {
    if (tw !== undefined && th === undefined) {
      const scale = tw / ow;
      return { width: clampPos(tw), height: clampPos(oh * scale), scale };
    }
    if (th !== undefined && tw === undefined) {
      const scale = th / oh;
      return { width: clampPos(ow * scale), height: clampPos(th), scale };
    }
    if (tw !== undefined && th !== undefined) {
      // Both provided — choose the smaller scale to fit within.
      const scale = Math.min(tw / ow, th / oh);
      return { width: clampPos(ow * scale), height: clampPos(oh * scale), scale };
    }
  } else {
    if (tw === undefined || th === undefined) return { error: "Both width and height required when aspect unlocked" };
    if (tw <= 0 || th <= 0) return { error: "Width and height must be positive" };
    return { width: clampPos(tw), height: clampPos(th), scale: tw / ow };
  }

  return { error: "Invalid resize input" };
}

/** Default preset sizes for quick selection. */
export const RESIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "Thumbnail 128", width: 128, height: 128 },
  { label: "Square 256", width: 256, height: 256 },
  { label: "Square 512", width: 512, height: 512 },
  { label: "HD 1280", width: 1280, height: 720 },
  { label: "Full HD 1920", width: 1920, height: 1080 },
];
