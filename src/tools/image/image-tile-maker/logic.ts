/**
 * Image Tile Maker — pure logic. No DOM/canvas access.
 * Compute grid tile dimensions for splitting an image into a grid.
 */

export interface TileGrid {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  total: number;
}

/** Compute the tile grid for a given source size and grid counts. */
export function computeGrid(
  width: number,
  height: number,
  cols: number,
  rows: number,
): TileGrid | { error: string } {
  if (width <= 0 || height <= 0) return { error: "Image dimensions must be positive" };
  if (!Number.isInteger(cols) || cols < 1) return { error: "Columns must be a positive integer" };
  if (!Number.isInteger(rows) || rows < 1) return { error: "Rows must be a positive integer" };
  const tileWidth = Math.floor(width / cols);
  const tileHeight = Math.floor(height / rows);
  if (tileWidth < 1 || tileHeight < 1) {
    return { error: "Too many tiles for this image size" };
  }
  return { cols, rows, tileWidth, tileHeight, total: cols * rows };
}

/** Compute the offset (x, y) for a tile at a given grid index. */
export function tileOffset(
  index: number,
  cols: number,
  tileWidth: number,
  tileHeight: number,
): { x: number; y: number } | { error: string } {
  if (index < 0) return { error: "Index must be non-negative" };
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: col * tileWidth, y: row * tileHeight };
}

/** Suggest a grid layout for a given target tile count. */
export function suggestGrid(
  width: number,
  height: number,
  targetTiles: number,
): { cols: number; rows: number } | { error: string } {
  if (targetTiles < 1) return { error: "Target must be at least 1" };
  if (width <= 0 || height <= 0) return { error: "Invalid dimensions" };
  const aspect = width / height;
  let bestCols = 1;
  let bestRows = targetTiles;
  let bestDiff = Infinity;
  for (let cols = 1; cols <= targetTiles; cols++) {
    const rows = Math.ceil(targetTiles / cols);
    const tileAspect = (width / cols) / (height / rows);
    const diff = Math.abs(Math.log(tileAspect / aspect));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestCols = cols;
      bestRows = rows;
    }
  }
  return { cols: bestCols, rows: bestRows };
}

/** Build a filename for a tile index. */
export function tileName(prefix: string, index: number, total: number, ext = "png"): string {
  const pad = String(total).length;
  const n = String(index + 1).padStart(pad, "0");
  return `${prefix}-tile-${n}.${ext}`;
}
