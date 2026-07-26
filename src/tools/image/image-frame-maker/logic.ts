/**
 * Image Frame Maker — pure logic.
 * Computes frame geometry, presets, and validators for decorative frames
 * (classic, polaroid, film, rounded, vignette, shadow, gradient, double).
 * No canvas/DOM access — drawing is left to the UI layer.
 */

export type FrameType = "classic" | "polaroid" | "film" | "rounded" | "vignette" | "shadow" | "gradient" | "double";

export interface FrameOptions {
  type: FrameType;
  borderWidth: number; // pixels
  borderColor: string; // hex or rgba
  innerBorderColor?: string;
  matWidth?: number; // matting (inner border between image and frame)
  matColor?: string;
  radius?: number; // for rounded
  rotation?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  caption?: string;
  captionColor?: string;
  captionFont?: string;
  captionSize?: number;
  gradientFrom?: string;
  gradientTo?: string;
  filmHoleCount?: number; // for film type
}

/** Perforation hole geometry for film strips. */
export interface Hole {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computed geometry for rendering a frame. */
export interface FrameGeometry {
  outputWidth: number;
  outputHeight: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  matX?: number;
  matY?: number;
  matWidth?: number;
  matHeight?: number;
  holes?: Hole[];
}

/** Compute the output canvas dimensions needed to fit image + frame + matting. */
export function computeOutputSize(
  imageWidth: number,
  imageHeight: number,
  opts: FrameOptions,
): { width: number; height: number } {
  let extraX = opts.borderWidth * 2;
  let extraY = opts.borderWidth * 2;
  if (opts.matWidth) {
    extraX += opts.matWidth * 2;
    extraY += opts.matWidth * 2;
  }
  if (opts.type === "polaroid") {
    extraY += 60; // extra bottom for caption area
  }
  if (opts.type === "film") {
    extraY += 30; // perforation strips top + bottom
  }
  return {
    width: imageWidth + extraX,
    height: imageHeight + extraY,
  };
}

/** Compute inner image position (where to draw the original image). */
export function computeImagePosition(
  imageWidth: number,
  imageHeight: number,
  opts: FrameOptions,
): { x: number; y: number; width: number; height: number } {
  let x = opts.borderWidth;
  let y = opts.borderWidth;
  if (opts.matWidth) {
    x += opts.matWidth;
    y += opts.matWidth;
  }
  if (opts.type === "film") {
    y += 15;
  }
  return { x, y, width: imageWidth, height: imageHeight };
}

/** Compute perforation hole positions for film strip frames. */
export function computeFilmHoles(
  frameWidth: number,
  frameHeight: number,
  holeCount: number,
): { top: Hole[]; bottom: Hole[] } {
  const holeW = 16;
  const holeH = 10;
  const margin = 8;
  const usable = frameWidth - margin * 2 - holeW * holeCount;
  const spacing = holeCount > 1 ? usable / (holeCount - 1) : 0;
  const top: Hole[] = [];
  const bottom: Hole[] = [];
  for (let i = 0; i < holeCount; i++) {
    const hx = margin + i * (holeW + spacing);
    top.push({ x: hx, y: margin / 2, width: holeW, height: holeH });
    bottom.push({ x: hx, y: frameHeight - margin / 2 - holeH, width: holeW, height: holeH });
  }
  return { top, bottom };
}

/** Compute the full geometry for a frame. */
export function computeGeometry(
  imageWidth: number,
  imageHeight: number,
  opts: FrameOptions,
): FrameGeometry {
  const output = computeOutputSize(imageWidth, imageHeight, opts);
  const imgPos = computeImagePosition(imageWidth, imageHeight, opts);
  const geom: FrameGeometry = {
    outputWidth: output.width,
    outputHeight: output.height,
    imageX: imgPos.x,
    imageY: imgPos.y,
    imageWidth: imgPos.width,
    imageHeight: imgPos.height,
  };
  if (opts.matWidth && opts.matWidth > 0) {
    geom.matX = opts.borderWidth;
    geom.matY = opts.borderWidth;
    geom.matWidth = imageWidth + opts.matWidth * 2;
    geom.matHeight = imageHeight + opts.matWidth * 2;
  }
  if (opts.type === "film") {
    const holes = computeFilmHoles(output.width, output.height, opts.filmHoleCount ?? 12);
    geom.holes = [...holes.top, ...holes.bottom];
  }
  return geom;
}

/** Compute the rounded-rectangle path points for a rounded frame. */
export function computeRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): { x: number; y: number }[] {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    { x: x + r, y },
    { x: x + width - r, y },
    { x: x + width, y: y + r },
    { x: x + width, y: y + height - r },
    { x: x + width - r, y: y + height },
    { x: x + r, y: y + height },
    { x, y: y + height - r },
    { x, y: y + r },
  ];
}

/** Frame presets. */
export const FRAME_PRESETS: { name: string; options: FrameOptions }[] = [
  { name: "Classic Black", options: { type: "classic", borderWidth: 20, borderColor: "#000000" } },
  { name: "Classic White", options: { type: "classic", borderWidth: 20, borderColor: "#ffffff" } },
  { name: "Polaroid", options: { type: "polaroid", borderWidth: 15, borderColor: "#ffffff", caption: "Memory", captionSize: 16 } },
  { name: "Film Strip", options: { type: "film", borderWidth: 10, borderColor: "#1a1a1a", filmHoleCount: 12 } },
  { name: "Rounded Soft", options: { type: "rounded", borderWidth: 15, borderColor: "#e5e5e5", radius: 30 } },
  { name: "Vintage Vignette", options: { type: "vignette", borderWidth: 0, borderColor: "rgba(0,0,0,0.7)" } },
  { name: "Sunset Gradient", options: { type: "gradient", borderWidth: 25, borderColor: "#000000", gradientFrom: "#ff6b6b", gradientTo: "#feca57" } },
  { name: "Double Gold", options: { type: "double", borderWidth: 20, borderColor: "#d4af37", innerBorderColor: "#ffffff" } },
  { name: "Shadow Box", options: { type: "shadow", borderWidth: 15, borderColor: "#ffffff", shadowBlur: 30 } },
  { name: "Matted Black", options: { type: "classic", borderWidth: 8, borderColor: "#000000", matWidth: 30, matColor: "#f5f0e8" } },
];

/** Color presets for borders. */
export const BORDER_COLORS = [
  "#000000", "#ffffff", "#d4af37", "#8b4513", "#cd853f",
  "#2f4f4f", "#191970", "#800000", "#006400", "#4b0082",
];

/** Validate frame options. */
export function validateOptions(opts: FrameOptions): string[] {
  const errs: string[] = [];
  if (opts.borderWidth < 0) errs.push("Border width cannot be negative");
  if (opts.matWidth && opts.matWidth < 0) errs.push("Mat width cannot be negative");
  if (opts.radius && opts.radius < 0) errs.push("Radius cannot be negative");
  if (!/^#[0-9a-f]{3,8}$/i.test(opts.borderColor) && !opts.borderColor.startsWith("rgba")) {
    errs.push("Border color must be a valid hex or rgba");
  }
  return errs;
}

/** Generate a CSS box-shadow string for use in HTML preview. */
export function toCssShadow(opts: FrameOptions): string {
  if (opts.type !== "shadow") return "none";
  return `${opts.shadowOffsetX ?? 4}px ${opts.shadowOffsetY ?? 4}px ${opts.shadowBlur ?? 20}px ${opts.shadowColor ?? "rgba(0,0,0,0.5)"}`;
}

/** Estimate file size impact of frame (rough estimate in bytes). */
export function estimateSizeImpact(imageWidth: number, imageHeight: number, opts: FrameOptions): number {
  const out = computeOutputSize(imageWidth, imageHeight, opts);
  return out.width * out.height * 4;
}

/** Serialize frame options to JSON. */
export function serialize(opts: FrameOptions): string {
  return JSON.stringify(opts, null, 2);
}

/** Parse JSON back to frame options. */
export function deserialize(json: string): FrameOptions {
  return JSON.parse(json);
}

/** Compare two frame options objects for equality. */
export function optionsEqual(a: FrameOptions, b: FrameOptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compute the aspect ratio of the framed image. */
export function framedAspectRatio(imageWidth: number, imageHeight: number, opts: FrameOptions): number {
  const out = computeOutputSize(imageWidth, imageHeight, opts);
  return out.width / out.height;
}

/** Compute the gradient stops for a linear gradient. */
export function gradientStops(opts: FrameOptions): { offset: number; color: string }[] {
  return [
    { offset: 0, color: opts.gradientFrom ?? "#ff6b6b" },
    { offset: 1, color: opts.gradientTo ?? "#4ecdc4" },
  ];
}

/** Compute the caption position for polaroid frame. */
export function captionPosition(
  imageWidth: number,
  imageHeight: number,
  opts: FrameOptions,
): { x: number; y: number; maxWidth: number } {
  const out = computeOutputSize(imageWidth, imageHeight, opts);
  return {
    x: out.width / 2,
    y: out.height - 20,
    maxWidth: out.width - 40,
  };
}

/** Convert a hex color to rgba string with alpha. */
export function hexToRgba(hex: string, alpha = 1): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Calculate the total border thickness (border + mat). */
export function totalBorderThickness(opts: FrameOptions): number {
  return opts.borderWidth + (opts.matWidth ?? 0);
}

/** Determine if the frame type requires a caption area. */
export function hasCaptionArea(type: FrameType): boolean {
  return type === "polaroid";
}

/** Get a description for a frame type. */
export const FRAME_DESCRIPTIONS: Record<FrameType, string> = {
  classic: "Solid color border around the image",
  polaroid: "White border with extra space at the bottom for a caption",
  film: "Black border with perforations along top and bottom (like 35mm film)",
  rounded: "Border with rounded corners",
  vignette: "Soft dark gradient applied to edges of the image",
  shadow: "Solid border with a drop shadow",
  gradient: "Border filled with a linear gradient between two colors",
  double: "Outer solid border with an inner contrasting line",
};

/** Estimate the visual weight of a frame (1-10 scale). */
export function frameWeight(opts: FrameOptions): number {
  let weight = Math.min(10, opts.borderWidth / 5);
  if (opts.matWidth) weight += Math.min(3, opts.matWidth / 20);
  if (opts.type === "shadow") weight += 1;
  if (opts.type === "double") weight += 1;
  return Math.min(10, Math.round(weight));
}
