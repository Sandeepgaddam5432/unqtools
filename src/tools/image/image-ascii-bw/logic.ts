/**
 * Image ASCII (B&W) — pure logic. No DOM / canvas access.
 *
 * Maps pixel luminance to ASCII characters of varying density.
 */
export interface AsciiOptions {
  /** Output width in characters (height auto-derived from aspect). */
  width: number;
  /** Character ramp from dark → light. */
  ramp: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Default 10-character ramp from dark to light. */
export const DEFAULT_RAMP = " .:-=+*#%@";

/** Validate options. */
export function validateAscii(opts: AsciiOptions): AsciiOptions | { error: string } {
  if (!Number.isFinite(opts.width) || opts.width < 1 || opts.width > 400) return { error: "Width must be 1..400" };
  if (!opts.ramp || opts.ramp.length < 2) return { error: "Ramp must be at least 2 characters" };
  return { width: Math.round(opts.width), ramp: opts.ramp };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Map a luminance (0..255) to a character from the ramp. */
export function lumaToChar(y: number, ramp: string): string {
  const idx = Math.floor((clamp(y, 0, 255) / 255) * (ramp.length - 1) + 0.5);
  return ramp[clamp(idx, 0, ramp.length - 1)]!;
}

/** Compute output height (in chars) given aspect ratio. */
export function computeHeight(widthChars: number, imgW: number, imgH: number): number {
  if (imgW <= 0 || imgH <= 0) return 0;
  // Each char is ~2x taller than wide; halve the aspect to compensate.
  return Math.max(1, Math.round(widthChars * (imgH / imgW) * 0.5));
}

/** Convert a flat RGBA pixel array to ASCII lines. */
export function toAscii(
  pixels: Uint8ClampedArray | number[],
  imgW: number,
  imgH: number,
  opts: AsciiOptions,
): string {
  const v = validateAscii(opts);
  if ("error" in v) throw new Error(v.error);
  const outW = v.width;
  const outH = computeHeight(outW, imgW, imgH);
  const lines: string[] = [];
  for (let oy = 0; oy < outH; oy++) {
    let line = "";
    for (let ox = 0; ox < outW; ox++) {
      const sx = Math.floor((ox / outW) * imgW);
      const sy = Math.floor((oy / outH) * imgH);
      const i = (sy * imgW + sx) * 4;
      const y = luma(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      line += lumaToChar(y, v.ramp);
    }
    lines.push(line);
  }
  return lines.join("\n");
}
