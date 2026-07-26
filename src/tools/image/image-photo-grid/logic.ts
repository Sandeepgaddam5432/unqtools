/**
 * Photo Grid — pure logic.
 * Computes layout for an arbitrary number of images in a rows × cols grid
 * with spacing, border, background color, and target aspect ratio.
 */

export type AspectRatio = "free" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16" | "3:4";

export interface GridImage {
  id: string;
  width: number;
  height: number;
  name: string;
  bytes: number;
}

export interface GridLayoutParams {
  rows: number;
  cols: number;
  spacing: number; // px between cells
  border: number; // px border around each cell
  background: string; // hex color
  borderColor: string; // hex color
  targetAspect: AspectRatio;
  cellWidth: number; // desired cell size
}

export const DEFAULT_PARAMS: GridLayoutParams = {
  rows: 3,
  cols: 3,
  spacing: 8,
  border: 0,
  background: "#ffffff",
  borderColor: "#000000",
  targetAspect: "1:1",
  cellWidth: 200,
};

export interface CellLayout {
  index: number;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}

export interface GridLayout {
  rows: number;
  cols: number;
  canvasWidth: number;
  canvasHeight: number;
  cells: CellLayout[];
  background: string;
  borderColor: string;
}

/** Parse aspect ratio string into a numeric ratio. */
export function aspectToRatio(ar: AspectRatio): { w: number; h: number } | null {
  switch (ar) {
    case "1:1": return { w: 1, h: 1 };
    case "4:3": return { w: 4, h: 3 };
    case "3:2": return { w: 3, h: 2 };
    case "16:9": return { w: 16, h: 9 };
    case "9:16": return { w: 9, h: 16 };
    case "3:4": return { w: 3, h: 4 };
    case "free": return null;
  }
}

/** Fit a source image into a target box preserving aspect ratio (contain). */
export function fitContain(srcW: number, srcH: number, boxW: number, boxH: number): { w: number; h: number } {
  if (srcW <= 0 || srcH <= 0) return { w: boxW, h: boxH };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

/** Fit a source image into a target box covering it (cover crop). */
export function fitCover(srcW: number, srcH: number, boxW: number, boxH: number): { w: number; h: number; srcX: number; srcY: number; srcW: number; srcH: number } {
  if (srcW <= 0 || srcH <= 0) return { w: boxW, h: boxH, srcX: 0, srcY: 0, srcW, srcH };
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  // Source crop region
  const cropW = boxW / scale;
  const cropH = boxH / scale;
  const srcX = (srcW - cropW) / 2;
  const srcY = (srcH - cropH) / 2;
  return { w: boxW, h: boxH, srcX, srcY, srcW: cropW, srcH: cropH };
}

/** Compute the grid layout. */
export function computeLayout(images: GridImage[], params: GridLayoutParams): GridLayout {
  const totalCells = params.rows * params.cols;
  const cells: CellLayout[] = [];
  const ratio = aspectToRatio(params.targetAspect);
  const cellH = ratio ? Math.round(params.cellWidth * (ratio.h / ratio.w)) : params.cellWidth;
  const cellW = params.cellWidth;
  const canvasWidth = params.cols * cellW + (params.cols + 1) * params.spacing + params.cols * params.border * 2;
  const canvasHeight = params.rows * cellH + (params.rows + 1) * params.spacing + params.rows * params.border * 2;

  for (let i = 0; i < Math.min(totalCells, images.length); i++) {
    const row = Math.floor(i / params.cols);
    const col = i % params.cols;
    const x = params.spacing + col * (cellW + params.spacing) + col * params.border * 2;
    const y = params.spacing + row * (cellH + params.spacing) + row * params.border * 2;
    const img = images[i];
    const fit = fitContain(img.width, img.height, cellW, cellH);
    cells.push({
      index: i,
      imageId: img.id,
      x,
      y,
      width: cellW,
      height: cellH,
      drawX: x + (cellW - fit.w) / 2,
      drawY: y + (cellH - fit.h) / 2,
      drawWidth: fit.w,
      drawHeight: fit.h,
    });
  }

  return {
    rows: params.rows,
    cols: params.cols,
    canvasWidth: Math.round(canvasWidth),
    canvasHeight: Math.round(canvasHeight),
    cells,
    background: params.background,
    borderColor: params.borderColor,
  };
}

/** Determine optimal rows/cols for N images. */
export function autoLayout(n: number, targetAspect: AspectRatio = "16:9"): { rows: number; cols: number } {
  if (n <= 0) return { rows: 0, cols: 0 };
  if (n === 1) return { rows: 1, cols: 1 };
  const ratio = aspectToRatio(targetAspect);
  const targetRatio = ratio ? ratio.w / ratio.h : 1;
  // Try columns from 1..n and pick the closest aspect
  let best = { rows: 1, cols: n, diff: Infinity };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const ratio_ = cols / rows;
    const diff = Math.abs(Math.log(ratio_ / targetRatio));
    if (diff < best.diff) best = { rows, cols, diff };
  }
  return best;
}

/** Compute the total number of cells that would be empty. */
export function emptyCellCount(images: GridImage[], params: GridLayoutParams): number {
  const total = params.rows * params.cols;
  return Math.max(0, total - images.length);
}

/** Validate that a list of images is non-empty and well-formed. */
export function validateImages(images: GridImage[]): { ok: boolean; reason?: string } {
  if (images.length === 0) return { ok: false, reason: "No images provided." };
  for (const img of images) {
    if (img.width <= 0 || img.height <= 0) return { ok: false, reason: `Image ${img.name} has invalid dimensions.` };
  }
  return { ok: true };
}

/** Estimate output PNG file size (photographic content). */
export function estimatePngBytes(width: number, height: number): number {
  const raw = width * height * 4;
  return Math.round(64 + raw / 2.5);
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Build a summary of the grid layout. */
export function summarizeLayout(layout: GridLayout, images: GridImage[]): string {
  return [
    `Grid: ${layout.rows}×${layout.cols}`,
    `Canvas: ${layout.canvasWidth}×${layout.canvasHeight}px`,
    `Images: ${layout.cells.length} placed, ${images.length - layout.cells.length} overflow`,
    `Background: ${layout.background}`,
    `Estimated PNG: ${formatBytes(estimatePngBytes(layout.canvasWidth, layout.canvasHeight))}`,
  ].join("\n");
}

/** Build a CSS grid template for preview. */
export function toCssGrid(layout: GridLayout): string {
  return `grid-template-columns: repeat(${layout.cols}, 1fr); grid-template-rows: repeat(${layout.rows}, 1fr);`;
}
