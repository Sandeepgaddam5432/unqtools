/**
 * Image Collage Maker — pure logic. No DOM access.
 */
export interface CollageInput {
  /** Number of source images. */
  imageCount: number;
  /** Number of columns. */
  columns: number;
  /** Total canvas width. */
  canvasWidth: number;
  /** Total canvas height. */
  canvasHeight: number;
  /** Gap between cells in px. */
  gap: number;
}

export interface CollageCell {
  /** Zero-based cell index. */
  index: number;
  /** X position in pixels. */
  x: number;
  /** Y position in pixels. */
  y: number;
  /** Cell width in pixels. */
  width: number;
  /** Cell height in pixels. */
  height: number;
}

export interface CollageLayout {
  /** Number of rows in the grid. */
  rows: number;
  /** Number of columns in the grid. */
  columns: number;
  /** Computed cells. */
  cells: CollageCell[];
}

/** Compute the grid layout for a collage. */
export function computeCollageLayout(input: CollageInput): CollageLayout | { error: string } {
  const { imageCount, columns, canvasWidth, canvasHeight, gap } = input;
  if (imageCount <= 0) return { error: "Image count must be positive" };
  if (columns <= 0) return { error: "Columns must be positive" };
  if (canvasWidth <= 0 || canvasHeight <= 0) return { error: "Canvas dimensions must be positive" };
  if (gap < 0) return { error: "Gap must be non-negative" };

  const rows = Math.ceil(imageCount / columns);
  const cellWidth = Math.max(1, Math.floor((canvasWidth - gap * (columns + 1)) / columns));
  const cellHeight = Math.max(1, Math.floor((canvasHeight - gap * (rows + 1)) / rows));
  const cells: CollageCell[] = [];
  for (let i = 0; i < imageCount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    cells.push({
      index: i,
      x: gap + col * (cellWidth + gap),
      y: gap + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    });
  }
  return { rows, columns, cells };
}

/** Compute a fitting rectangle (object-fit: contain) for an image inside a cell. */
export function fitContain(imageWidth: number, imageHeight: number, cellWidth: number, cellHeight: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} | { error: string } {
  if (imageWidth <= 0 || imageHeight <= 0) return { error: "Image dimensions must be positive" };
  if (cellWidth <= 0 || cellHeight <= 0) return { error: "Cell dimensions must be positive" };
  const scale = Math.min(cellWidth / imageWidth, cellHeight / imageHeight);
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  return {
    x: (cellWidth - w) / 2,
    y: (cellHeight - h) / 2,
    width: w,
    height: h,
  };
}

/** Compute a cover rectangle (object-fit: cover) for an image inside a cell. */
export function fitCover(imageWidth: number, imageHeight: number, cellWidth: number, cellHeight: number): {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
} | { error: string } {
  if (imageWidth <= 0 || imageHeight <= 0) return { error: "Image dimensions must be positive" };
  if (cellWidth <= 0 || cellHeight <= 0) return { error: "Cell dimensions must be positive" };
  const scale = Math.max(cellWidth / imageWidth, cellHeight / imageHeight);
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  return {
    width: w,
    height: h,
    offsetX: (cellWidth - w) / 2,
    offsetY: (cellHeight - h) / 2,
  };
}

export const COLLAGE_PRESETS: { label: string; columns: number; width: number; height: number }[] = [
  { label: "2 cols (1200×800)", columns: 2, width: 1200, height: 800 },
  { label: "3 cols (1200×900)", columns: 3, width: 1200, height: 900 },
  { label: "4 cols (1600×800)", columns: 4, width: 1600, height: 800 },
  { label: "Square (1024×1024)", columns: 2, width: 1024, height: 1024 },
];
