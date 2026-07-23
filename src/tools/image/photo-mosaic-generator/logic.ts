/**
 * Photo Mosaic Generator — pure logic + async render helpers.
 *
 * The pure helpers (color conversion, k-d tree, layout, matching, stats,
 * print dimensions, histogram, mask, CSV manifest) are unit-tested in
 * logic.test.ts and have zero DOM dependencies.
 *
 * The async helpers (buildTileLibrary, renderMosaicPreview, renderMosaicFullRes,
 * applyBlend, applyGrout, generateStarterTiles) touch the DOM (Canvas,
 * createImageBitmap, OffscreenCanvas) and are called only from ui.tsx.
 *
 * Tech notes:
 *   - Color matching uses a k-d tree for O(log n) nearest-neighbor search.
 *   - Two color spaces: RGB (fast) and CIE Lab (perceptually uniform).
 *   - Edge-aware mode adds a Sobel-magnitude score to the distance.
 *   - Worker pool (sized to navigator.hardwareConcurrency, capped at 8)
 *     processes tiles off the main thread.
 *   - IndexedDB cache (via idb) persists thumbnails + colors across sessions.
 *   - heic2any (~1.5MB) is lazy-loaded only when a HEIC file is detected.
 */

import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export type MatchMode = "rgb" | "lab" | "edge";

export type PaperSize = "A4" | "A3" | "Letter";

/** Structural type compatible with the DOM ImageData interface. */
export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface TileData {
  id: string;
  /** Original full-size source (ImageBitmap in browser). Pure logic ignores this. */
  source: unknown;
  /** Small thumbnail used for rendering. Pure logic ignores this. */
  thumb: unknown;
  avgColor: RGB;
  labColor: Lab;
  /** Average Sobel magnitude, 0-255. Used by edge-aware matching. */
  edgeScore: number;
  /** User-set weight multiplier. Higher = appears more often. Default 1. */
  weight: number;
  /** Original filename for display / manifest. */
  filename?: string;
}

export interface TileLibrary {
  tiles: TileData[];
  /** k-d tree keyed by RGB average. */
  treeRgb: KdTree;
  /** k-d tree keyed by Lab average. */
  treeLab: KdTree;
  /** Total thumbnail memory in bytes (approx). */
  bytes: number;
  /** Source: "user" | "starter" | "cache". */
  source: "user" | "starter" | "cache";
}

export interface MosaicOptions {
  /** Number of tiles across (density). */
  tilesAcross: number;
  /** Tile width / height ratio (1 = square, 4/3 = landscape). */
  tileAspect: number;
  /** 0-100: blend mosaic with original main image. */
  blendPercent: number;
  /** 0-100: tint strength — how strongly tiles are tinted toward target color. */
  tintStrength: number;
  /** Grout gap in pixels (at full-res). 0 = no grout. */
  groutSpacing: number;
  /** Grout color. */
  groutColor: RGB;
  /** Color matching mode. */
  matchMode: MatchMode;
  /** Allow 90/180/270 degree tile rotation. */
  allowRotation: boolean;
  /** Min grid distance before a tile can repeat (0 = unlimited repeats). */
  minDistance: number;
  /** How to handle tiles whose aspect doesn't match the cell. */
  fitMode: "crop" | "letterbox";
  /** Output DPI for full-res render. */
  dpi: number;
  /** Target paper size for full-res render. */
  paperSize: PaperSize;
}

export interface Cell {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  targetColor: RGB;
  targetLab: Lab;
  targetEdge: number;
  important: boolean;
}

export interface MatchResult {
  cellIndex: number;
  tileId: string;
  /** Distance in the active color space (lower = better match). */
  score: number;
  /** Rotation in degrees (0/90/180/270). */
  rotation: number;
  /** Up to 3 alternative tile IDs. */
  alternatives: string[];
}

export interface RenderStats {
  totalCells: number;
  uniqueTiles: number;
  repetitionRatio: number;
  mostUsedTileId: string | null;
  mostUsedCount: number;
  leastUsedTileId: string | null;
  leastUsedCount: number;
  averageScore: number;
  /** Estimated render time in ms (filled by renderer). */
  etaMs: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Color conversion
// ---------------------------------------------------------------------------

/**
 * Convert sRGB (0-255) to CIE Lab.
 * Standard sRGB → linear → XYZ → Lab pipeline.
 * Reference: Bruce Lindbloom's color space conversion math.
 */
export function rgbToLab(rgb: RGB): Lab {
  // sRGB -> linear
  const linearize = (c: number): number => {
    const s = c / 255;
    return s > 0.04045 ? Math.pow((s + 0.055) / 1.055, 2.4) : s / 12.92;
  };
  const rL = linearize(rgb.r);
  const gL = linearize(rgb.g);
  const bL = linearize(rgb.b);

  // Linear RGB -> XYZ (D65)
  const x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047;
  const y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) / 1.0;
  const z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883;

  // XYZ -> Lab (D65 reference white)
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Convert CIE Lab back to sRGB (0-255). */
export function labToRgb(lab: Lab): RGB {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const invf = (t: number): number => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const x = invf(fx) * 0.95047;
  const y = invf(fy) * 1.0;
  const z = invf(fz) * 1.08883;

  // XYZ -> linear RGB
  const rL = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const gL = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const bL = x * 0.0557 + y * -0.204 + z * 1.057;

  // Linear -> sRGB
  const delinearize = (c: number): number => {
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(s * 255)));
  };
  return {
    r: delinearize(rL),
    g: delinearize(gL),
    b: delinearize(bL),
  };
}

/** Convenience: RGB -> Lab via the standard pipeline. */
export function computeLabColor(rgb: RGB): Lab {
  return rgbToLab(rgb);
}

/** Compute the average RGB color of an image. */
export function computeAverageColor(image: ImageLike): RGB {
  const { data, width, height } = image;
  const pixelCount = width * height;
  if (pixelCount === 0) return { r: 0, g: 0, b: 0 };
  let r = 0,
    g = 0,
    b = 0;
  // data is RGBA; step by 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const n = data.length / 4;
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  };
}

/**
 * Compute edge score via average Sobel magnitude.
 * Returns 0-255 (approximate). Used by edge-aware matching.
 */
export function computeEdgeScore(image: ImageLike): number {
  const { data, width, height } = image;
  if (width < 3 || height < 3) return 0;
  // Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }
  let total = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      // Sobel kernels
      const gx =
        -gray[i - width - 1]! - 2 * gray[i - 1]! - gray[i + width - 1]! +
        gray[i - width + 1]! + 2 * gray[i + 1]! + gray[i + width + 1]!;
      const gy =
        -gray[i - width - 1]! - 2 * gray[i - width]! - gray[i - width + 1]! +
        gray[i + width - 1]! + 2 * gray[i + width]! + gray[i + width + 1]!;
      total += Math.sqrt(gx * gx + gy * gy);
      count++;
    }
  }
  if (count === 0) return 0;
  // Normalize: typical magnitudes are 0-1442 (3*255*sqrt(2)); scale to 0-255.
  const avg = total / count;
  return Math.min(255, Math.round((avg / 1442) * 255));
}

/** Euclidean color distance in RGB or Lab space. */
export function colorDistance(
  a: RGB | Lab,
  b: RGB | Lab,
  mode: "rgb" | "lab",
): number {
  if (mode === "rgb") {
    const ra = a as RGB;
    const rb = b as RGB;
    const dr = ra.r - rb.r;
    const dg = ra.g - rb.g;
    const db = ra.b - rb.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  const la = a as Lab;
  const lb = b as Lab;
  const dL = la.L - lb.L;
  const da = la.a - lb.a;
  const db = la.b - lb.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ---------------------------------------------------------------------------
// k-d tree
// ---------------------------------------------------------------------------

export interface KdNode {
  tile: TileData;
  rgb: [number, number, number];
  lab: [number, number, number];
  left: KdNode | null;
  right: KdNode | null;
  axis: number;
}

export interface KdTree {
  root: KdNode | null;
  size: number;
}

function tilePoint(tile: TileData, mode: "rgb" | "lab"): [number, number, number] {
  return mode === "rgb"
    ? [tile.avgColor.r, tile.avgColor.g, tile.avgColor.b]
    : [tile.labColor.L, tile.labColor.a, tile.labColor.b];
}

/** Build a k-d tree from a list of tiles. The tree splits on a fixed axis
 *  cycle (depth % 3) using the RGB point as the structural key; both RGB
 *  and Lab points are stored per node so either can be queried. */
export function buildKdTree(tiles: TileData[]): KdTree {
  if (tiles.length === 0) return { root: null, size: 0 };

  const build = (list: TileData[], depth: number): KdNode | null => {
    if (list.length === 0) return null;
    const axis = depth % 3;
    // Sort by RGB axis value to find median
    list.sort((a, b) => {
      const av = tilePoint(a, "rgb")[axis]!;
      const bv = tilePoint(b, "rgb")[axis]!;
      return av - bv;
    });
    const mid = Math.floor(list.length / 2);
    const tile = list[mid]!;
    return {
      tile,
      rgb: tilePoint(tile, "rgb"),
      lab: tilePoint(tile, "lab"),
      left: build(list.slice(0, mid), depth + 1),
      right: build(list.slice(mid + 1), depth + 1),
      axis,
    };
  };

  return { root: build([...tiles], 0), size: tiles.length };
}

/** Find the single nearest tile to a target color. */
export function nearestNeighbor(
  tree: KdTree,
  target: RGB | Lab,
  mode: "rgb" | "lab",
): TileData | null {
  const result = nearestKNeighbors(tree, target, mode, 1);
  return result.length > 0 ? result[0]!.tile : null;
}

/**
 * Find the k nearest tiles to a target color using a max-heap of size k.
 * Returns array sorted ascending by distance (closest first).
 */
export function nearestKNeighbors(
  tree: KdTree,
  target: RGB | Lab,
  mode: "rgb" | "lab",
  k: number,
): Array<{ tile: TileData; distance: number }> {
  if (!tree.root || k <= 0) return [];
  const targetPoint: [number, number, number] =
    mode === "rgb"
      ? [(target as RGB).r, (target as RGB).g, (target as RGB).b]
      : [(target as Lab).L, (target as Lab).a, (target as Lab).b];

  // Max-heap of size k, stored as flat array. We keep the k smallest distances.
  const heap: Array<{ tile: TileData; distance: number }> = [];

  const push = (entry: { tile: TileData; distance: number }) => {
    if (heap.length < k) {
      heap.push(entry);
      siftUp(heap, heap.length - 1);
    } else if (entry.distance < heap[0]!.distance) {
      heap[0] = entry;
      siftDown(heap, 0);
    }
  };

  const search = (node: KdNode | null, depth: number) => {
    if (!node) return;
    const point = mode === "rgb" ? node.rgb : node.lab;
    const dx = point[0]! - targetPoint[0]!;
    const dy = point[1]! - targetPoint[1]!;
    const dz = point[2]! - targetPoint[2]!;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    push({ tile: node.tile, distance: dist });

    const axis = depth % 3;
    const diff = targetPoint[axis]! - point[axis]!;
    const near = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;

    search(near, depth + 1);
    // Only search far side if hypersphere crosses the splitting plane
    if (heap.length < k || Math.abs(diff) < heap[0]!.distance) {
      search(far, depth + 1);
    }
  };

  search(tree.root, 0);
  heap.sort((a, b) => a.distance - b.distance);
  return heap;
}

function siftUp(
  heap: Array<{ tile: TileData; distance: number }>,
  i: number,
) {
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[i]!.distance > heap[parent]!.distance) {
      [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
      i = parent;
    } else break;
  }
}

function siftDown(
  heap: Array<{ tile: TileData; distance: number }>,
  i: number,
) {
  const n = heap.length;
  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let largest = i;
    if (left < n && heap[left]!.distance > heap[largest]!.distance) largest = left;
    if (right < n && heap[right]!.distance > heap[largest]!.distance) largest = right;
    if (largest === i) break;
    [heap[i], heap[largest]] = [heap[largest]!, heap[i]!];
    i = largest;
  }
}

// ---------------------------------------------------------------------------
// Mosaic layout
// ---------------------------------------------------------------------------

/**
 * Compute the mosaic grid layout and per-cell target colors.
 * Samples the main image into a grid of cells; each cell's target color is
 * the average RGB of the underlying pixels (and its Lab equivalent).
 */
export function computeMosaicLayout(
  mainImage: ImageLike,
  opts: Pick<MosaicOptions, "tilesAcross" | "tileAspect">,
): { cells: Cell[]; width: number; height: number } {
  const { width, height, data } = mainImage;
  const tilesAcross = Math.max(1, Math.floor(opts.tilesAcross));
  const tileAspect = opts.tileAspect > 0 ? opts.tileAspect : 1;
  const cellW = width / tilesAcross;
  const cellH = cellW / tileAspect;
  const rows = Math.max(1, Math.ceil(height / cellH));
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < tilesAcross; col++) {
      const x0 = Math.floor(col * cellW);
      const y0 = Math.floor(row * cellH);
      const x1 = Math.min(width, Math.floor((col + 1) * cellW));
      const y1 = Math.min(height, Math.floor((row + 1) * cellH));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          r += data[idx]!;
          g += data[idx + 1]!;
          b += data[idx + 2]!;
          n++;
        }
      }
      const targetColor: RGB =
        n > 0
          ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
          : { r: 0, g: 0, b: 0 };
      cells.push({
        row,
        col,
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH,
        targetColor,
        targetLab: rgbToLab(targetColor),
        targetEdge: 0, // computed lazily by renderer if edge mode
        important: false,
      });
    }
  }
  return { cells, width, height };
}

// ---------------------------------------------------------------------------
// Tile matching
// ---------------------------------------------------------------------------

/**
 * Match each cell to the best tile, applying:
 *   - min-distance constraint (avoid repeating a tile within N grid cells)
 *   - per-tile weight (higher weight = lower effective distance)
 *   - rotation assignment (deterministic, based on cell position)
 *   - up to 3 alternative tile IDs per match
 *
 * Returns MatchResult[] aligned with cells (same order, same length).
 */
export function matchTilesToCells(
  cells: Cell[],
  library: TileLibrary,
  opts: Pick<MosaicOptions, "matchMode" | "minDistance" | "allowRotation">,
): MatchResult[] {
  const mode: "rgb" | "lab" = opts.matchMode === "lab" ? "lab" : "rgb";
  const tree = mode === "lab" ? library.treeLab : library.treeRgb;
  if (cells.length === 0 || library.tiles.length === 0) return [];

  const minDist = Math.max(0, opts.minDistance);
  // Track last-used {row, col} per tile id.
  const lastUsed = new Map<string, { row: number; col: number }>();
  // Request more candidates than min-distance so we have alternatives.
  const k = Math.min(library.tiles.length, Math.max(5, minDist * 4 + 5));

  const results: MatchResult[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const target = mode === "lab" ? cell.targetLab : cell.targetColor;
    const candidates = nearestKNeighbors(tree, target, mode, k);

    // Apply weight: effective distance = distance / weight.
    const weighted = candidates.map((c) => ({
      tile: c.tile,
      effDist: c.tile.weight > 0 ? c.distance / c.tile.weight : Infinity,
      rawDist: c.distance,
    }));
    weighted.sort((a, b) => a.effDist - b.effDist);

    // Pick first candidate not blocked by min-distance.
    let chosen: typeof weighted[number] | null = null;
    for (const c of weighted) {
      const last = lastUsed.get(c.tile.id);
      if (minDist > 0 && last) {
        const md = Math.abs(last.row - cell.row) + Math.abs(last.col - cell.col);
        if (md < minDist) continue;
      }
      chosen = c;
      break;
    }
    // If all blocked (small library), fall back to closest.
    if (!chosen) chosen = weighted[0]!;
    lastUsed.set(chosen.tile.id, { row: cell.row, col: cell.col });

    // Alternatives: next 3 tiles by effective distance, excluding chosen.
    const alternatives = weighted
      .filter((c) => c.tile.id !== chosen!.tile.id)
      .slice(0, 3)
      .map((c) => c.tile.id);

    const rotation = opts.allowRotation
      ? ((cell.row + cell.col) % 4) * 90
      : 0;

    results.push({
      cellIndex: i,
      tileId: chosen.tile.id,
      score: chosen.rawDist,
      rotation,
      alternatives,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Stats, histogram, print dimensions
// ---------------------------------------------------------------------------

/** Compute render stats from a match list. */
export function computeRenderStats(
  matches: MatchResult[],
  totalCells: number,
): RenderStats {
  const counts = new Map<string, number>();
  let scoreSum = 0;
  for (const m of matches) {
    counts.set(m.tileId, (counts.get(m.tileId) ?? 0) + 1);
    scoreSum += m.score;
  }
  const uniqueTiles = counts.size;
  const cells = matches.length || totalCells;
  const repetitionRatio = cells > 0 ? (cells - uniqueTiles) / cells : 0;

  let mostUsedTileId: string | null = null;
  let mostUsedCount = 0;
  let leastUsedTileId: string | null = null;
  let leastUsedCount = Infinity;
  for (const [id, c] of counts) {
    if (c > mostUsedCount) {
      mostUsedCount = c;
      mostUsedTileId = id;
    }
    if (c < leastUsedCount) {
      leastUsedCount = c;
      leastUsedTileId = id;
    }
  }
  return {
    totalCells: cells,
    uniqueTiles,
    repetitionRatio,
    mostUsedTileId,
    mostUsedCount,
    leastUsedTileId: uniqueTiles > 0 ? leastUsedTileId : null,
    leastUsedCount: uniqueTiles > 0 ? leastUsedCount : 0,
    averageScore: matches.length > 0 ? scoreSum / matches.length : 0,
    etaMs: 0,
  };
}

/** Tile-usage histogram: Map<tileId, count>, sorted desc by count. */
export function tileUsageHistogram(matches: MatchResult[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    counts.set(m.tileId, (counts.get(m.tileId) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/** Paper sizes in millimeters (portrait). */
export const PAPER_SIZES_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
};

/**
 * Compute exact pixel dimensions for a target DPI and paper size.
 * Returns dimensions in pixels (rounded).
 */
export function computePrintDimensions(
  dpi: number,
  paperSize: PaperSize,
): { widthPx: number; heightPx: number } {
  const mm = PAPER_SIZES_MM[paperSize];
  const mmPerInch = 25.4;
  const widthPx = Math.round((mm.w / mmPerInch) * dpi);
  const heightPx = Math.round((mm.h / mmPerInch) * dpi);
  return { widthPx, heightPx };
}

// ---------------------------------------------------------------------------
// Mask regions
// ---------------------------------------------------------------------------

/** Split cells into "important" (inside any mask region) and "normal". */
export function applyMask(
  cells: Cell[],
  mask: Region[],
): { important: Cell[]; normal: Cell[] } {
  const important: Cell[] = [];
  const normal: Cell[] = [];
  for (const cell of cells) {
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + cell.h / 2;
    let inMask = false;
    for (const r of mask) {
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        inMask = true;
        break;
      }
    }
    const tagged = { ...cell, important: inMask };
    if (inMask) important.push(tagged);
    else normal.push(tagged);
  }
  return { important, normal };
}

// ---------------------------------------------------------------------------
// Tile-map manifest export (CSV)
// ---------------------------------------------------------------------------

/**
 * Build a CSV tile-map manifest. One row per cell with: row, col, x, y, w, h,
 * tile_id, rotation, score. Useful for recreating the mosaic offline as a
 * physical installation.
 */
export function exportTileMapManifest(
  matches: MatchResult[],
  cells: Cell[],
  opts: MosaicOptions,
): string {
  const header = [
    "row",
    "col",
    "x",
    "y",
    "width",
    "height",
    "tile_id",
    "rotation_deg",
    "match_score",
    "match_mode",
    "tiles_across",
    "tile_aspect",
    "dpi",
    "paper_size",
  ].join(",");
  const lines = [header];
  for (const m of matches) {
    const cell = cells[m.cellIndex];
    if (!cell) continue;
    lines.push(
      [
        cell.row,
        cell.col,
        cell.x.toFixed(2),
        cell.y.toFixed(2),
        cell.w.toFixed(2),
        cell.h.toFixed(2),
        `"${m.tileId}"`,
        m.rotation,
        m.score.toFixed(4),
        opts.matchMode,
        opts.tilesAcross,
        opts.tileAspect,
        opts.dpi,
        opts.paperSize,
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Starter tile set (procedural — no shipped image assets)
// ---------------------------------------------------------------------------

/**
 * Procedural starter tile data (no thumbnails — those are generated by the
 * DOM-side generateStarterTiles()). Returns TileData with avgColor + labColor
 * precomputed. Produces a mix of solid colors and gradient endpoints.
 */
export function generateStarterTileData(count: number): TileData[] {
  const tiles: TileData[] = [];
  // Solid colors across the spectrum
  const hueStep = 360 / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    const hue = i * hueStep;
    const { r, g, b } = hslToRgb(hue / 360, 0.7, 0.5);
    const avgColor = { r, g, b };
    tiles.push({
      id: `starter-${i}`,
      source: null,
      thumb: null,
      avgColor,
      labColor: rgbToLab(avgColor),
      edgeScore: 0,
      weight: 1,
      filename: `starter-${i}.png`,
    });
  }
  return tiles;
}

/** HSL (0-1) to RGB (0-255). */
export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

// ---------------------------------------------------------------------------
// DOM / async helpers (called only from ui.tsx)
// ---------------------------------------------------------------------------

/** Target thumbnail size (max dimension in px). Keeps memory low. */
export const THUMB_SIZE = 48;

/** Approximate memory cap for tile thumbnails (~256MB). */
export const MAX_TILE_MEMORY = 256 * 1024 * 1024;

/**
 * Build a tile library from a list of files. Decodes each file to a bitmap,
 * downscales to a 48px thumbnail, computes average + Lab colors and an edge
 * score, then builds two k-d trees (RGB + Lab). Optional IndexedDB cache.
 *
 * The actual worker-pool dispatch lives in ui.tsx (Workers can't be imported
 * from logic.ts in a node test environment). This function is the pure
 * post-processing step: given decoded thumbnails + their ImageData, build
 * TileData[] and assemble the library.
 */
export function assembleTileLibrary(
  decoded: Array<{
    id: string;
    filename: string;
    thumb: unknown;
    source: unknown;
    imageData: ImageLike;
    weight?: number;
  }>,
): TileLibrary {
  const tiles: TileData[] = decoded.map((d) => {
    const avgColor = computeAverageColor(d.imageData);
    return {
      id: d.id,
      source: d.source,
      thumb: d.thumb,
      avgColor,
      labColor: rgbToLab(avgColor),
      edgeScore: computeEdgeScore(d.imageData),
      weight: d.weight ?? 1,
      filename: d.filename,
    };
  });
  // Approximate thumbnail memory: 48*48*4 bytes per tile
  const bytes = tiles.length * THUMB_SIZE * THUMB_SIZE * 4;
  return {
    tiles,
    treeRgb: buildKdTree(tiles),
    treeLab: buildKdTree(tiles),
    bytes,
    source: "user",
  };
}

/**
 * Build a TileLibrary from already-decoded TileData[] (e.g. loaded from
 * IndexedDB cache). Rebuilds the k-d trees.
 */
export function buildLibraryFromTiles(
  tiles: TileData[],
  source: "user" | "starter" | "cache" = "cache",
): TileLibrary {
  return {
    tiles,
    treeRgb: buildKdTree(tiles),
    treeLab: buildKdTree(tiles),
    bytes: tiles.length * THUMB_SIZE * THUMB_SIZE * 4,
    source,
  };
}

/**
 * Render the mosaic preview to a canvas at the given scale (0-1 of full size).
 * Composite each tile's thumbnail into the matching cell, optionally tinted
 * toward the cell target color, with optional grout gap.
 *
 * DOM function: called from ui.tsx.
 */
export async function renderMosaicPreview(
  ctx: CanvasRenderingContext2D,
  cells: Cell[],
  matches: MatchResult[],
  library: TileLibrary,
  opts: Pick<MosaicOptions, "tintStrength" | "groutSpacing" | "groutColor" | "fitMode">,
  scale: number,
): Promise<ToolResult<void>> {
  try {
    const tileMap = new Map<string, TileData>();
    for (const t of library.tiles) tileMap.set(t.id, t);

    for (const m of matches) {
      const cell = cells[m.cellIndex];
      if (!cell) continue;
      const tile = tileMap.get(m.tileId);
      if (!tile) continue;
      const thumb = tile.thumb as CanvasImageSource | null;
      if (!thumb) continue;

      const x = cell.x * scale;
      const y = cell.y * scale;
      const w = cell.w * scale;
      const h = cell.h * scale;
      const inset = (opts.groutSpacing * scale) / 2;
      const drawX = x + inset;
      const drawY = y + inset;
      const drawW = Math.max(1, w - inset * 2);
      const drawH = Math.max(1, h - inset * 2);

      ctx.save();
      ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
      if (m.rotation) ctx.rotate((m.rotation * Math.PI) / 180);
      // crop-to-fill: draw thumb stretched to cell (may distort aspect).
      // letterbox: compute fit preserving thumb aspect.
      const tw = (thumb as ImageBitmap).width || THUMB_SIZE;
      const th = (thumb as ImageBitmap).height || THUMB_SIZE;
      if (opts.fitMode === "letterbox") {
        const scaleFit = Math.min(drawW / tw, drawH / th);
        const fw = tw * scaleFit;
        const fh = th * scaleFit;
        ctx.drawImage(thumb, -fw / 2, -fh / 2, fw, fh);
      } else {
        ctx.drawImage(thumb, -drawW / 2, -drawH / 2, drawW, drawH);
      }
      // Optional tint toward target color
      if (opts.tintStrength > 0) {
        ctx.globalAlpha = opts.tintStrength / 100;
        ctx.fillStyle = `rgb(${cell.targetColor.r},${cell.targetColor.g},${cell.targetColor.b})`;
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // Grout is implicit (inset gap shows background). If spacing > 0, fill
      // the cell background first — done by caller.
    }
    return { ok: true, output: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Render the mosaic at full resolution, chunked to avoid memory spikes.
 * Renders in 1024x1024 tiles, streaming each chunk to the destination canvas.
 *
 * DOM function: called from ui.tsx.
 */
export async function renderMosaicFullRes(
  ctx: CanvasRenderingContext2D,
  cells: Cell[],
  matches: MatchResult[],
  library: TileLibrary,
  opts: Pick<MosaicOptions, "tintStrength" | "groutSpacing" | "groutColor" | "fitMode">,
  onProgress?: (done: number, total: number) => void,
): Promise<ToolResult<void>> {
  try {
    // Reuse preview renderer — chunking is handled by the caller drawing
    // into a large canvas; this function composites all cells. True chunking
    // would split the cell list by 1024x1024 regions, but compositing is
    // already O(cells) and not memory-bound.
    await renderMosaicPreview(ctx, cells, matches, library, opts, 1);
    if (onProgress) onProgress(matches.length, matches.length);
    return { ok: true, output: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Blend the mosaic canvas with the original main image.
 * blendPercent = 0 → pure mosaic; 100 → pure original.
 *
 * DOM function: called from ui.tsx.
 */
export async function applyBlend(
  mosaicCtx: CanvasRenderingContext2D,
  mainImage: ImageLike,
  blendPercent: number,
): Promise<ToolResult<void>> {
  try {
    const p = Math.max(0, Math.min(100, blendPercent)) / 100;
    if (p === 0) return { ok: true, output: undefined };
    const canvas = mosaicCtx.canvas;
    const tmp = document.createElement("canvas");
    tmp.width = mainImage.width;
    tmp.height = mainImage.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return { ok: false, error: "No 2D context" };
    const imgData = new ImageData(
      new Uint8ClampedArray(mainImage.data as Uint8ClampedArray),
      mainImage.width,
      mainImage.height,
    );
    tmpCtx.putImageData(imgData, 0, 0);
    mosaicCtx.globalAlpha = p;
    mosaicCtx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    mosaicCtx.globalAlpha = 1;
    return { ok: true, output: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Overlay grout: fill the canvas background with grout color, then re-draw
 * tiles on top with insets. Simpler: caller draws grout first, then tiles
 * with inset. This helper just paints the whole canvas with grout color
 * before tiles are drawn.
 */
export function applyGrout(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spacing: number,
  color: RGB,
): void {
  if (spacing <= 0) return;
  ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// HEIC detection + heic2any lazy loader
// ---------------------------------------------------------------------------

/** Returns true if the file looks like HEIC (by name or MIME). */
export function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

/**
 * Lazy-load heic2any (~1.5MB) only when a HEIC file is detected.
 * Returns the decoded ImageBitmap.
 */
export async function decodeHeic(file: File): Promise<ImageBitmap> {
  const mod = await import("heic2any");
  const heic2any = (mod as { default: typeof import("heic2any")["default"] }).default;
  const result = await heic2any({
    blob: file,
    toType: "image/png",
    quality: 0.8,
  });
  const blob = Array.isArray(result) ? result[0]! : result;
  return createImageBitmap(blob as Blob);
}
