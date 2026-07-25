/**
 * Image Color Overlay — pure logic. No DOM/canvas access.
 * Blend mode formulas for combining a solid color with the source image.
 */

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light";

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/** Blend two normalized channel values [0..1] using the selected mode. */
export function blendChannel(
  base: number,
  top: number,
  mode: BlendMode,
): number {
  switch (mode) {
    case "normal":
      return top;
    case "multiply":
      return base * top;
    case "screen":
      return base + top - base * top;
    case "overlay":
      return base < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
    case "soft-light": {
      // Pegtop's soft-light approximation.
      const d = top - 0.5;
      return base + 2 * d * (base - base * base);
    }
    default:
      return top;
  }
}

/** Blend a source pixel with an overlay color, respecting alpha. */
export function blendPixel(
  base: ColorRGB,
  overlay: ColorRGB,
  opacity: number,
  mode: BlendMode,
): ColorRGB {
  const op = Math.max(0, Math.min(1, opacity));
  const b = { r: base.r / 255, g: base.g / 255, b: base.b / 255 };
  const o = { r: overlay.r / 255, g: overlay.g / 255, b: overlay.b / 255 };
  const out: ColorRGB = {
    r: blendChannel(b.r, o.r, mode),
    g: blendChannel(b.g, o.g, mode),
    b: blendChannel(b.b, o.b, mode),
  };
  // Mix with original based on opacity.
  return {
    r: Math.round((out.r * op + b.r * (1 - op)) * 255),
    g: Math.round((out.g * op + b.g * (1 - op)) * 255),
    b: Math.round((out.b * op + b.b * (1 - op)) * 255),
  };
}

/** Parse a hex color string (#rgb or #rrggbb) into RGB. */
export function parseHex(hex: string): ColorRGB | { error: string } {
  const m = hex.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(m)) {
    return { error: "Invalid hex color (use #rgb or #rrggbb)" };
  }
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "soft-light", label: "Soft Light" },
];
