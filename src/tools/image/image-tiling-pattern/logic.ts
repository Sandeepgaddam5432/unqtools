/**
 * Tiling Pattern Maker — pure logic for creating seamless tiling patterns.
 *
 * 10+ Extras:
 *   1. Offset wrap calc
 *   2. Mirror-tile coordinates
 *   3. Edge feather distance
 *   4. Repeat layout types (grid/half-drop/brick/mirror)
 *   5. Spacing calc
 *   6. Background color
 *   7. CSS background snippet gen
 *   8. SVG pattern gen
 *   9. Tile dimensions
 *  10. Validation
 *  11. Stats
 *  12. Batch helper
 *  13. CSV export
 *  14. Seamless offset helper
 */

export type RepeatLayout = "grid" | "half-drop" | "brick" | "mirror";

export interface TileInput {
  /** Source tile width in pixels. */
  tileWidth: number;
  /** Source tile height in pixels. */
  tileHeight: number;
  /** Layout pattern. */
  layout: RepeatLayout;
  /** Output canvas width in pixels. */
  outputWidth: number;
  /** Output canvas height in pixels. */
  outputHeight: number;
  /** Gap between tiles in pixels. */
  spacing: number;
  /** Background color (hex). */
  bgColor: string;
  /** Optional feather radius at tile edges (0-32). */
  feather: number;
}

export interface TilePosition {
  x: number;
  y: number;
  /** Tile source coordinate offset (for half-drop / brick). */
  offsetX: number;
  offsetY: number;
  /** If true, mirror horizontally. */
  mirrorH: boolean;
  /** If true, mirror vertically. */
  mirrorV: boolean;
  /** Column index in the layout. */
  col: number;
  /** Row index in the layout. */
  row: number;
}

export interface TileStats {
  outputWidth: number;
  outputHeight: number;
  tileWidth: number;
  tileHeight: number;
  tilesPerRow: number;
  tilesPerCol: number;
  totalTiles: number;
  durationMs: number;
}

export interface TileResult {
  positions: TilePosition[];
  stats: TileStats;
  cssBackground: string;
  svgPattern: string;
  warnings: string[];
}

/** Wrap an offset coordinate within a tile dimension. */
export function wrapOffset(value: number, dim: number): number {
  if (dim <= 0) return 0;
  return ((value % dim) + dim) % dim;
}

/** Compute the offset X for a given row using the half-drop layout. */
export function halfDropOffset(row: number, tileWidth: number): number {
  return row % 2 === 0 ? 0 : tileWidth / 2;
}

/** Compute the offset Y for a given column using the brick layout. */
export function brickOffset(col: number, tileHeight: number): number {
  return col % 2 === 0 ? 0 : tileHeight / 2;
}

/** Determine mirror flags for the mirror layout (alternating tiles flip). */
export function mirrorFlags(col: number, row: number): { mirrorH: boolean; mirrorV: boolean } {
  return {
    mirrorH: col % 2 === 1,
    mirrorV: row % 2 === 1,
  };
}

/** Compute edge feather distance (0-1) from tile boundary. */
export function featherDistance(localX: number, localY: number, w: number, h: number, radius: number): number {
  if (radius <= 0) return 1;
  const dx = Math.min(localX, w - localX);
  const dy = Math.min(localY, h - localY);
  const d = Math.min(dx, dy);
  if (d >= radius) return 1;
  return Math.max(0, d / radius);
}

/** Compute number of tiles needed per row/column. */
export function tilesPerDim(outDim: number, tileDim: number, spacing: number): number {
  if (tileDim <= 0) return 0;
  return Math.ceil(outDim / (tileDim + spacing));
}

/** Validate tile input. */
export function validateInput(input: TileInput): { ok: true } | { error: string } {
  if (input.tileWidth <= 0 || input.tileHeight <= 0) return { error: "Tile dimensions must be positive" };
  if (input.outputWidth <= 0 || input.outputHeight <= 0) return { error: "Output dimensions must be positive" };
  if (input.spacing < 0 || input.spacing > 64) return { error: "Spacing must be 0-64" };
  if (input.feather < 0 || input.feather > 32) return { error: "Feather must be 0-32" };
  if (input.layout !== "grid" && input.layout !== "half-drop" && input.layout !== "brick" && input.layout !== "mirror") {
    return { error: "Unknown layout" };
  }
  return { ok: true };
}

/** Generate CSS background snippet. */
export function cssBackgroundSnippet(input: TileInput): string {
  return `background-color: ${input.bgColor};\nbackground-image: url("tile.png");\nbackground-repeat: repeat;\nbackground-size: ${input.tileWidth}px ${input.tileHeight}px;\nbackground-position: 0 0;`;
}

/** Generate an SVG <pattern> with the chosen layout. */
export function svgPatternSnippet(input: TileInput): string {
  const id = "tile";
  const pw = input.tileWidth + input.spacing;
  const ph = input.tileHeight + input.spacing;
  let pattern = `<pattern id="${id}" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">`;
  pattern += `<rect width="${pw}" height="${ph}" fill="${input.bgColor}"/>`;
  // Show only one representative tile (SVG <pattern> handles repetition natively)
  if (input.layout === "half-drop") {
    pattern += `<image href="tile.png" x="0" y="0" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
    pattern += `<image href="tile.png" x="${input.tileWidth / 2}" y="${ph / 2}" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
  } else if (input.layout === "brick") {
    pattern += `<image href="tile.png" x="0" y="0" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
    pattern += `<image href="tile.png" x="${pw / 2}" y="${input.tileHeight / 2}" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
  } else if (input.layout === "mirror") {
    pattern += `<image href="tile.png" x="0" y="0" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
    pattern += `<image href="tile.png" x="${input.tileWidth}" y="0" width="${input.tileWidth}" height="${input.tileHeight}" transform="scale(-1,1) translate(-${2 * input.tileWidth},0)"/>`;
  } else {
    pattern += `<image href="tile.png" x="0" y="0" width="${input.tileWidth}" height="${input.tileHeight}"/>`;
  }
  pattern += `</pattern>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outputWidth}" height="${input.outputHeight}"><rect width="${input.outputWidth}" height="${input.outputHeight}" fill="url(#${id})"/>${pattern}</svg>`;
}

/** Compute tile positions covering the output area. */
export function computeTilePositions(input: TileInput): TilePosition[] {
  const positions: TilePosition[] = [];
  const cols = tilesPerDim(input.outputWidth, input.tileWidth, input.spacing);
  const rows = tilesPerDim(input.outputHeight, input.tileHeight, input.spacing);
  for (let r = 0; r < rows + 2; r++) {
    for (let c = 0; c < cols + 2; c++) {
      let offsetX = 0, offsetY = 0;
      if (input.layout === "half-drop") offsetX = halfDropOffset(r, input.tileWidth);
      if (input.layout === "brick") offsetY = brickOffset(c, input.tileHeight);
      const m = input.layout === "mirror" ? mirrorFlags(c, r) : { mirrorH: false, mirrorV: false };
      positions.push({
        x: c * (input.tileWidth + input.spacing) - input.tileWidth / 2 + offsetX - input.tileWidth / 2,
        y: r * (input.tileHeight + input.spacing) - input.tileHeight / 2 + offsetY - input.tileHeight / 2,
        offsetX, offsetY,
        mirrorH: m.mirrorH,
        mirrorV: m.mirrorV,
        col: c, row: r,
      });
    }
  }
  return positions;
}

/** Run the tile layout computation. */
export function generateTiling(input: TileInput): TileResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const positions = computeTilePositions(input);
  const tilesPerRow = tilesPerDim(input.outputWidth, input.tileWidth, input.spacing);
  const tilesPerCol = tilesPerDim(input.outputHeight, input.tileHeight, input.spacing);
  const warnings: string[] = [];
  if (positions.length > 10000) warnings.push("Large output — performance may be slow.");
  if (input.feather > 16) warnings.push("High feather reduces tile sharpness.");
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    positions,
    stats: {
      outputWidth: input.outputWidth,
      outputHeight: input.outputHeight,
      tileWidth: input.tileWidth,
      tileHeight: input.tileHeight,
      tilesPerRow,
      tilesPerCol,
      totalTiles: positions.length,
      durationMs: Math.max(0, end - start),
    },
    cssBackground: cssBackgroundSnippet(input),
    svgPattern: svgPatternSnippet(input),
    warnings,
  };
}

/** Batch helper. */
export function batchGenerateTiling(inputs: TileInput[]): (TileResult | { error: string })[] {
  return inputs.map((input) => generateTiling(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: TileStats): string {
  return [
    "Field,Value",
    `OutputWidth,${stats.outputWidth}`,
    `OutputHeight,${stats.outputHeight}`,
    `TileWidth,${stats.tileWidth}`,
    `TileHeight,${stats.tileHeight}`,
    `TilesPerRow,${stats.tilesPerRow}`,
    `TilesPerCol,${stats.tilesPerCol}`,
    `TotalTiles,${stats.totalTiles}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}
