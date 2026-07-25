/**
 * Image Stitcher — pure logic. No DOM/canvas access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Horizontal / vertical stitch direction
 *   2. Alignment options (start/center/end)
 *   3. Configurable gap between images
 *   4. Background colour (hex)
 *   5. Per-image position computation
 *   6. Layout summary string
 *   7. Batch validation of image sizes
 *   8. CSV export of layout positions
 *   9. Aspect-ratio preservation helpers
 *  10. Grid layout (rows × cols) for many images
 *  11. Background padding (outer border)
 *  12. Validation with detailed error messages
 */
export type StitchDirection = "horizontal" | "vertical";

export interface ImageSize {
  width: number;
  height: number;
}

export interface StitchResult {
  width: number;
  height: number;
  positions: { x: number; y: number; width: number; height: number }[];
}

export type AlignOption = "start" | "center" | "end";

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;
const isNonNeg = (n: number) => isFin(n) && n >= 0;

/** Compute the canvas size and per-image positions for a stitch. */
export function computeLayout(
  images: ImageSize[], direction: StitchDirection, gap = 0,
): StitchResult | { error: string } {
  if (!images.length) return { error: "Need at least one image" };
  if (images.some((i) => !isPos(i.width) || !isPos(i.height))) {
    return { error: "All images must have positive dimensions" };
  }
  if (!isNonNeg(gap)) return { error: "Gap must be ≥ 0" };
  const positions: { x: number; y: number; width: number; height: number }[] = [];
  if (direction === "horizontal") {
    const height = Math.max(...images.map((i) => i.height));
    let x = 0;
    for (let i = 0; i < images.length; i++) {
      const img = images[i]!;
      positions.push({ x, y: 0, width: img.width, height: img.height });
      x += img.width + (i < images.length - 1 ? gap : 0);
    }
    return { width: x, height, positions };
  }
  const width = Math.max(...images.map((i) => i.width));
  let y = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    positions.push({ x: 0, y, width: img.width, height: img.height });
    y += img.height + (i < images.length - 1 ? gap : 0);
  }
  return { width, height: y, positions };
}

/** Align an image's position with an alignment option. */
export function applyAlignment(
  layout: StitchResult, direction: StitchDirection, align: AlignOption,
): StitchResult {
  const positions = layout.positions.map((pos) => {
    if (direction === "horizontal") {
      const delta = layout.height - pos.height;
      const y = align === "start" ? 0 : align === "center" ? Math.round(delta / 2) : delta;
      return { ...pos, y };
    }
    const delta = layout.width - pos.width;
    const x = align === "start" ? 0 : align === "center" ? Math.round(delta / 2) : delta;
    return { ...pos, x };
  });
  return { ...layout, positions };
}

/** Apply outer padding around the stitched canvas. */
export function applyPadding(layout: StitchResult, padding: number): StitchResult | { error: string } {
  if (!isNonNeg(padding)) return { error: "Padding must be ≥ 0" };
  return {
    width: layout.width + padding * 2,
    height: layout.height + padding * 2,
    positions: layout.positions.map((p) => ({ ...p, x: p.x + padding, y: p.y + padding })),
  };
}

/** Estimate the resulting size summary. */
export function summarize(images: ImageSize[], direction: StitchDirection, gap = 0): string {
  const layout = computeLayout(images, direction, gap);
  if ("error" in layout) return layout.error;
  return `${layout.width}×${layout.height}px from ${images.length} images`;
}

/** Validate a hex colour string (#RGB or #RRGGBB). */
export function validateHexColor(hex: string): { ok: true; r: number; g: number; b: number } | { error: string } {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return { error: "Invalid hex colour" };
  const v = m[1]!.length === 3
    ? m[1]!.split("").map((c) => c + c).join("")
    : m[1]!;
  return {
    ok: true,
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/** Compute a grid layout (rows × cols) for many images. */
export function gridLayout(
  images: ImageSize[], cols: number, gap = 0,
): StitchResult | { error: string } {
  if (!images.length) return { error: "Need at least one image" };
  if (!isPos(cols)) return { error: "Cols must be positive" };
  const rows = Math.ceil(images.length / cols);
  const cellW = Math.max(...images.map((i) => i.width));
  const cellH = Math.max(...images.map((i) => i.height));
  const positions: { x: number; y: number; width: number; height: number }[] = [];
  for (let i = 0; i < images.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const img = images[i]!;
    positions.push({
      x: c * (cellW + gap),
      y: r * (cellH + gap),
      width: img.width,
      height: img.height,
    });
  }
  const width = cols * cellW + (cols - 1) * gap;
  const height = rows * cellH + (rows - 1) * gap;
  return { width, height, positions };
}

/** Batch-validate image sizes. */
export function batchValidate(images: ImageSize[]): { i: number; ok: boolean; error?: string }[] {
  return images.map((img, i) => {
    if (!isPos(img.width) || !isPos(img.height)) return { i, ok: false, error: "Invalid dimensions" };
    return { i, ok: true };
  });
}

/** Render layout positions as CSV. */
export function layoutToCsv(layout: StitchResult): string {
  const lines = ["index,x,y,width,height"];
  layout.positions.forEach((p, i) => {
    lines.push(`${i},${p.x},${p.y},${p.width},${p.height}`);
  });
  return lines.join("\n");
}

/** Compute total area of the stitched canvas. */
export function totalArea(layout: StitchResult): number {
  return layout.width * layout.height;
}

/** Compute total area of source images (for efficiency stats). */
export function sourceArea(images: ImageSize[]): number {
  return images.reduce((sum, i) => sum + i.width * i.height, 0);
}

/** Compute scale to fit a layout within a max dimension. */
export function scaleToFit(layout: StitchResult, maxW: number, maxH: number): number {
  if (maxW <= 0 || maxH <= 0) return 1;
  const sX = maxW / layout.width;
  const sY = maxH / layout.height;
  return Math.min(sX, sY, 1);
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
