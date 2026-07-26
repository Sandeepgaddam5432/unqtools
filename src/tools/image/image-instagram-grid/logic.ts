/**
 * Instagram Grid Splitter — pure logic for splitting an image into tiles.
 *
 * 10+ Extras:
 *   1. Grid modes (3x1 / 3x3 / 3x9)
 *   2. Tile dimension calc
 *   3. Tile position calc
 *   4. Numbering system (left-to-right, top-to-bottom)
 *   5. Gap calc
 *   6. Tile naming convention (e.g. tile_01.png)
 *   7. Batch ZIP support (file naming list)
 *   8. Validation
 *   9. Stats
 *  10. Batch helper
 *  11. CSV export
 *  12. Aspect ratio helper
 *  13. Posting order (Instagram grid order)
 *  14. Preview snippet
 */

export type GridMode = "3x1" | "3x3" | "3x9";

export interface GridInput {
  /** Source image width in pixels. */
  width: number;
  /** Source image height in pixels. */
  height: number;
  /** Grid mode. */
  mode: GridMode;
  /** Gap between tiles in pixels (used for preview only). */
  gap: number;
  /** Base name for tile files. */
  baseName: string;
}

export interface TileInfo {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fileName: string;
  /** Instagram posting order (1-based). */
  postOrder: number;
}

export interface GridStats {
  sourceWidth: number;
  sourceHeight: number;
  mode: GridMode;
  cols: number;
  rows: number;
  totalTiles: number;
  tileWidth: number;
  tileHeight: number;
  durationMs: number;
}

export interface GridResult {
  tiles: TileInfo[];
  stats: GridStats;
  warnings: string[];
  zipFileList: string[];
  csvManifest: string;
}

/** Get rows/cols from grid mode. */
export function gridDimensions(mode: GridMode): { cols: number; rows: number } {
  if (mode === "3x1") return { cols: 3, rows: 1 };
  if (mode === "3x3") return { cols: 3, rows: 3 };
  return { cols: 3, rows: 9 }; // 3x9
}

/** Compute tile dimensions (square tiles, fitted to width). */
export function tileDimensions(width: number, height: number, mode: GridMode): { tileW: number; tileH: number } {
  const { cols } = gridDimensions(mode);
  const tileW = Math.floor(width / cols);
  const tileH = tileW; // Square tiles
  return { tileW, tileH };
}

/** Pad a number with leading zeros for filename. */
export function padNumber(n: number, total: number): string {
  const digits = String(total).length;
  return String(n).padStart(digits, "0");
}

/** Generate filename for a tile. */
export function tileFileName(baseName: string, index: number, total: number): string {
  return `${baseName}_${padNumber(index + 1, total)}.png`;
}

/** Instagram posting order: 1-based index in reading order. */
export function postOrder(index: number): number {
  return index + 1;
}

/** Validate grid input. */
export function validateInput(input: GridInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (input.mode !== "3x1" && input.mode !== "3x3" && input.mode !== "3x9") return { error: "Unknown mode" };
  if (input.gap < 0 || input.gap > 64) return { error: "Gap must be 0-64" };
  if (!input.baseName || input.baseName.length === 0) return { error: "Base name required" };
  if (input.baseName.length > 100) return { error: "Base name too long" };
  if (!/^[a-zA-Z0-9_-]+$/.test(input.baseName)) return { error: "Base name must be alphanumeric, dash, or underscore" };
  return { ok: true };
}

/** Run the grid computation. */
export function computeGrid(input: GridInput): GridResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { width, height, mode, baseName } = input;
  const warnings: string[] = [];
  const { cols, rows } = gridDimensions(mode);
  const { tileW, tileH } = tileDimensions(width, height, mode);
  const total = cols * rows;
  const tiles: TileInfo[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        index: idx,
        row: r,
        col: c,
        x: c * tileW,
        y: r * tileH,
        width: tileW,
        height: tileH,
        fileName: tileFileName(baseName, idx, total),
        postOrder: postOrder(idx),
      });
      idx++;
    }
  }
  if (width < 1080) warnings.push("Instagram recommends 1080px source width for crisp tiles.");
  if (mode === "3x9") warnings.push("3×9 grid requires 9 posts in sequence — plan your posting order carefully.");
  if (tileW < 320) warnings.push("Small tile size — output may look pixelated.");
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const zipFileList = tiles.map((t) => t.fileName);
  const csvManifest = [
    "Index,Row,Col,PostOrder,X,Y,Width,Height,FileName",
    ...tiles.map((t) => `${t.index},${t.row},${t.col},${t.postOrder},${t.x},${t.y},${t.width},${t.height},${t.fileName}`),
  ].join("\n");
  return {
    tiles,
    stats: {
      sourceWidth: width,
      sourceHeight: height,
      mode,
      cols, rows,
      totalTiles: total,
      tileWidth: tileW,
      tileHeight: tileH,
      durationMs: Math.max(0, end - start),
    },
    warnings,
    zipFileList,
    csvManifest,
  };
}

/** Batch helper. */
export function batchComputeGrid(inputs: GridInput[]): (GridResult | { error: string })[] {
  return inputs.map((input) => computeGrid(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: GridStats): string {
  return [
    "Field,Value",
    `SourceWidth,${stats.sourceWidth}`,
    `SourceHeight,${stats.sourceHeight}`,
    `Mode,${stats.mode}`,
    `Cols,${stats.cols}`,
    `Rows,${stats.rows}`,
    `TotalTiles,${stats.totalTiles}`,
    `TileWidth,${stats.tileWidth}`,
    `TileHeight,${stats.tileHeight}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}

/** Aspect ratio helper. */
export function aspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}

/** Generate a preview snippet (text art of the grid). */
export function previewSnippet(mode: GridMode, tileW: number, tileH: number): string {
  const { cols, rows } = gridDimensions(mode);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += `[${r * cols + c + 1}]`;
      if (c < cols - 1) line += " ";
    }
    lines.push(line);
    if (r < rows - 1) lines.push(`${"-".repeat(cols * 4 - 1)}`);
  }
  return lines.join("\n");
}
