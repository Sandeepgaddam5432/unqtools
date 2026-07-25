/**
 * Image Rotator — pure logic. No DOM access.
 */
export interface RotateInput {
  originalWidth: number;
  originalHeight: number;
  /** Rotation in degrees, clockwise. */
  degrees: number;
}

export interface RotateResult {
  /** Output canvas width. */
  width: number;
  /** Output canvas height. */
  height: number;
  /** Normalized angle in degrees [0, 360). */
  angle: number;
  /** True for 90/270 multiples (swap dims). */
  swapsDimensions: boolean;
}

/** Compute the output dimensions for rotating an image by a given angle. */
export function calculateRotation(input: RotateInput): RotateResult | { error: string } {
  const { originalWidth: ow, originalHeight: oh, degrees } = input;
  if (ow <= 0 || oh <= 0) return { error: "Original dimensions must be positive" };
  if (!Number.isFinite(degrees)) return { error: "Degrees must be a finite number" };

  const angle = ((degrees % 360) + 360) % 360;
  const isRightAngle = angle % 90 === 0;
  const swaps = isRightAngle && angle % 180 !== 0;

  if (isRightAngle) {
    return {
      width: swaps ? oh : ow,
      height: swaps ? ow : oh,
      angle,
      swapsDimensions: swaps,
    };
  }

  const rad = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const width = Math.round(ow * cos + oh * sin);
  const height = Math.round(ow * sin + oh * cos);
  return { width, height, angle, swapsDimensions: false };
}

/** Convert degrees to radians (helper). */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
