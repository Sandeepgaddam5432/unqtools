/**
 * Image Tile Maker — pure logic. No DOM/canvas access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Compute grid tile dimensions for splitting an image
 *   2. Per-tile offset (x, y) computation
 *   3. Auto-suggest grid layout for a target tile count
 *   4. Custom tile size (compute cols/rows from target tile px)
 *   5. Overlap between adjacent tiles
 *   6. Filename generation with zero-padding
 *   7. Batch tile spec generation
 *   8. CSV export of tile specs
 *   9. Edge tile detection (boundary tiles)
 *  10. Total tile count and area stats
 *  11. Validation with detailed error messages
 *  12. Naming convention (prefix + index / row-col / xy)
 */
export interface TileGrid {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  total: number;
}

export interface TileSpec {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  isEdge: boolean;
}

export type NamingConvention = "index" | "row-col" | "xy";

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;
const isPosInt = (n: number) => Number.isInteger(n) && n >= 1;
const isNonNeg = (n: number) => isFin(n) && n >= 0;

/** Compute the tile grid for a given source size and grid counts. */
export function computeGrid(
  width: number, height: number, cols: number, rows: number,
): TileGrid | { error: string } {
  if (!isPos(width) || !isPos(height)) return { error: "Image dimensions must be positive" };
  if (!isPosInt(cols)) return { error: "Columns must be a positive integer" };
  if (!isPosInt(rows)) return { error: "Rows must be a positive integer" };
  const tileWidth = Math.floor(width / cols);
  const tileHeight = Math.floor(height / rows);
  if (tileWidth < 1 || tileHeight < 1) return { error: "Too many tiles for this image size" };
  return { cols, rows, tileWidth, tileHeight, total: cols * rows };
}

/** Compute the offset (x, y) for a tile at a given grid index. */
export function tileOffset(
  index: number, cols: number, tileWidth: number, tileHeight: number,
): { x: number; y: number } | { error: string } {
  if (index < 0) return { error: "Index must be non-negative" };
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: col * tileWidth, y: row * tileHeight };
}

/** Suggest a grid layout for a given target tile count. */
export function suggestGrid(
  width: number, height: number, targetTiles: number,
): { cols: number; rows: number } | { error: string } {
  if (targetTiles < 1) return { error: "Target must be at least 1" };
  if (!isPos(width) || !isPos(height)) return { error: "Invalid dimensions" };
  const aspect = width / height;
  let bestCols = 1; let bestRows = targetTiles; let bestDiff = Infinity;
  for (let cols = 1; cols <= targetTiles; cols++) {
    const rows = Math.ceil(targetTiles / cols);
    const tileAspect = (width / cols) / (height / rows);
    const diff = Math.abs(Math.log(tileAspect / aspect));
    if (diff < bestDiff) { bestDiff = diff; bestCols = cols; bestRows = rows; }
  }
  return { cols: bestCols, rows: bestRows };
}

/** Compute grid from a target tile size in pixels. */
export function gridFromTileSize(
  width: number, height: number, tileW: number, tileH: number,
): TileGrid | { error: string } {
  if (!isPos(width) || !isPos(height)) return { error: "Image dimensions must be positive" };
  if (!isPos(tileW) || !isPos(tileH)) return { error: "Tile dimensions must be positive" };
  const cols = Math.max(1, Math.floor(width / tileW));
  const rows = Math.max(1, Math.floor(height / tileH));
  return { cols, rows, tileWidth: tileW, tileHeight: tileH, total: cols * rows };
}

/** Build a filename for a tile index. */
export function tileName(
  prefix: string, index: number, total: number, ext = "png",
  convention: NamingConvention = "index",
  row?: number, col?: number, x?: number, y?: number,
): string {
  const pad = String(total).length;
  const n = String(index + 1).padStart(pad, "0");
  const safeExt = ext.replace(/^\./, "");
  switch (convention) {
    case "row-col":
      return `${prefix}-r${row ?? 0}-c${col ?? 0}.${safeExt}`;
    case "xy":
      return `${prefix}-x${x ?? 0}-y${y ?? 0}.${safeExt}`;
    case "index":
    default:
      return `${prefix}-tile-${n}.${safeExt}`;
  }
}

/** Generate full tile specs for a grid. */
export function generateTiles(
  width: number, height: number, cols: number, rows: number,
  prefix = "img", ext = "png", overlap = 0,
  convention: NamingConvention = "index",
): TileSpec[] | { error: string } {
  const grid = computeGrid(width, height, cols, rows);
  if ("error" in grid) return grid;
  if (!isNonNeg(overlap)) return { error: "Overlap must be ≥ 0" };
  const tiles: TileSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      const x = c * (grid.tileWidth - overlap);
      const y = r * (grid.tileHeight - overlap);
      const w = Math.min(grid.tileWidth + overlap, width - x);
      const h = Math.min(grid.tileHeight + overlap, height - y);
      tiles.push({
        index, row: r, col: c, x, y, width: w, height: h,
        name: tileName(prefix, index, grid.total, ext, convention, r, c, x, y),
        isEdge: r === 0 || r === rows - 1 || c === 0 || c === cols - 1,
      });
    }
  }
  return tiles;
}

/** Render tile specs as CSV. */
export function tilesToCsv(tiles: TileSpec[]): string {
  const lines = ["index,row,col,x,y,width,height,name,isEdge"];
  for (const t of tiles) {
    lines.push(`${t.index},${t.row},${t.col},${t.x},${t.y},${t.width},${t.height},${t.name},${t.isEdge}`);
  }
  return lines.join("\n");
}

/** Count edge tiles in a list. */
export function countEdgeTiles(tiles: TileSpec[]): number {
  return tiles.filter((t) => t.isEdge).length;
}

/** Compute total area of all tiles (with overlap). */
export function totalTileArea(tiles: TileSpec[]): number {
  return tiles.reduce((sum, t) => sum + t.width * t.height, 0);
}

/** Validate grid params. */
export function validateGrid(width: number, height: number, cols: number, rows: number): { ok: true } | { error: string } {
  const r = computeGrid(width, height, cols, rows);
  if ("error" in r) return { error: r.error };
  return { ok: true };
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
