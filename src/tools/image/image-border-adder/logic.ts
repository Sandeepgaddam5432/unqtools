/**
 * Image Border Adder — pure border dimension math. No DOM/canvas access.
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface BorderOptions {
  top: number;
  right: number;
  bottom: number;
  left: number;
  color: RgbColor;
}

/** Compute output dimensions after adding a border. */
export function computeOutputSize(
  inputWidth: number,
  inputHeight: number,
  opts: BorderOptions,
): { width: number; height: number } {
  return {
    width: inputWidth + opts.left + opts.right,
    height: inputHeight + opts.top + opts.bottom,
  };
}

/** Map an output pixel coordinate back to input coordinate, or null if outside. */
export function mapToInput(
  outX: number,
  outY: number,
  opts: BorderOptions,
): { x: number; y: number } | null {
  const inX = outX - opts.left;
  const inY = outY - opts.top;
  if (inX < 0 || inY < 0) return null;
  return { x: inX, y: inY };
}

/** Determine if an output pixel is on the border (i.e. should be filled with color). */
export function isBorderPixel(
  outX: number,
  outY: number,
  inputWidth: number,
  inputHeight: number,
  opts: BorderOptions,
): boolean {
  const inX = outX - opts.left;
  const inY = outY - opts.top;
  return inX < 0 || inY < 0 || inX >= inputWidth || inY >= inputHeight;
}

/** Parse #rgb / #rrggbb hex strings. */
export function parseHex(hex: string): RgbColor | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function validateBorderOptions(opts: BorderOptions): { ok: true } | { error: string } {
  for (const [k, v] of Object.entries({ top: opts.top, right: opts.right, bottom: opts.bottom, left: opts.left })) {
    if (!Number.isFinite(v) || v < 0 || v > 1000) return { error: `${k} must be 0-1000` };
  }
  return { ok: true };
}
