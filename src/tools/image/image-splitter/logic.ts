/**
 * Image Splitter — pure logic. No DOM/canvas access.
 * Compute split dimensions for dividing an image into a rows×cols grid.
 */

export interface SplitConfig {
  sourceWidth: number;
  sourceHeight: number;
  rows: number;
  cols: number;
}

export interface SplitTile {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitResult {
  tiles: SplitTile[];
  tileWidth: number;
  tileHeight: number;
  total: number;
}

/** Validate split config and compute tile rects. */
export function splitImage(config: SplitConfig): SplitResult | { error: string } {
  const { sourceWidth: sw, sourceHeight: sh, rows, cols } = config;
  if (sw <= 0 || sh <= 0) return { error: "Source dimensions must be positive" };
  if (!Number.isInteger(rows) || rows < 1) return { error: "Rows must be a positive integer" };
  if (!Number.isInteger(cols) || cols < 1) return { error: "Cols must be a positive integer" };
  const tileWidth = Math.floor(sw / cols);
  const tileHeight = Math.floor(sh / rows);
  if (tileWidth < 1 || tileHeight < 1) {
    return { error: "Grid too fine for the source image" };
  }
  const tiles: SplitTile[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        index,
        row: r,
        col: c,
        x: c * tileWidth,
        y: r * tileHeight,
        width: tileWidth,
        height: tileHeight,
      });
      index++;
    }
  }
  return { tiles, tileWidth, tileHeight, total: tiles.length };
}

/** Pick the tile that contains a given source-space pixel. */
export function tileAt(
  result: SplitResult,
  x: number,
  y: number,
): SplitTile | null {
  if (result.tileWidth <= 0 || result.tileHeight <= 0) return null;
  const col = Math.floor(x / result.tileWidth);
  const row = Math.floor(y / result.tileHeight);
  return result.tiles.find((t) => t.row === row && t.col === col) ?? null;
}

/** Build a friendly filename for a tile. */
export function tileFileName(
  prefix: string,
  row: number,
  col: number,
  ext = "png",
): string {
  return `${prefix}_r${row + 1}_c${col + 1}.${ext}`;
}
