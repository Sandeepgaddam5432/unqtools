/**
 * PDF Imposition — pure logic.
 *
 * Impose PDF pages for print:
 *  - 2-up, 4-up, 8-up, 16-up grids (or custom rows × cols)
 *  - Sequential, snake-fold, or booklet page ordering
 *  - Cut marks, margins, paper size presets
 *
 * Pure functions only — no DOM, no network, no pdf-lib imports.
 */

// ---- Types ----

export type ImpositionType = "2-up" | "4-up" | "8-up" | "16-up" | "custom";

export type PageOrder = "sequential" | "snake-fold" | "booklet";

export type PaperSizeId = "a4" | "a3" | "letter" | "legal" | "tabloid";

export interface PaperSize {
  id: PaperSizeId;
  label: string;
  /** Width in points (1/72 inch). */
  width: number;
  /** Height in points. */
  height: number;
}

export interface ImpositionGrid {
  rows: number;
  cols: number;
}

export interface ImpositionSheet {
  /** 0-indexed sheet number. */
  sheetNum: number;
  /** Pages laid out row-by-row, left-to-right within each row. 0 = blank. */
  pages: number[];
}

export interface ImpositionLayout {
  type: ImpositionType;
  pageOrder: PageOrder;
  grid: ImpositionGrid;
  /** Source page count. */
  sourcePageCount: number;
  /** Padded page count (multiple of grid.cells). */
  paddedPageCount: number;
  /** Pages per sheet (rows × cols). */
  perSheet: number;
  /** Total sheets. */
  sheetCount: number;
  /** Sheets array. */
  sheets: ImpositionSheet[];
  /** Number of blank padding pages. */
  blankPages: number;
}

export interface ImpositionSummary {
  sourcePageCount: number;
  paddedPageCount: number;
  blankPages: number;
  sheetCount: number;
  perSheet: number;
  grid: ImpositionGrid;
  paperSizeLabel: string;
  pageOrder: PageOrder;
  includeCutMarks: boolean;
  margin: number;
  paperWastePercent: number;
  printTimeMinutes: number;
  estimatedCost: number;
  bleedAreaPt2: number;
}

// ---- Constants ----

// Paper dimensions in points. A4=595x842, A3=842x1191, Letter=612x792,
// Legal=612x1008, Tabloid=792x1224 (11x17in).
export const PAPER_SIZES: PaperSize[] = [
  { id: "a4", label: "A4 (210×297mm)", width: 595.28, height: 841.89 },
  { id: "a3", label: "A3 (297×420mm)", width: 841.89, height: 1190.55 },
  { id: "letter", label: "US Letter (8.5×11in)", width: 612, height: 792 },
  { id: "legal", label: "US Legal (8.5×14in)", width: 612, height: 1008 },
  { id: "tabloid", label: "US Tabloid (11×17in)", width: 792, height: 1224 },
];

export const PAPER_SIZE_LABELS: Record<PaperSizeId, string> = PAPER_SIZES.reduce(
  (acc, p) => {
    acc[p.id] = p.label;
    return acc;
  },
  {} as Record<PaperSizeId, string>,
);

export const IMPOSITION_TYPE_LABELS: Record<ImpositionType, string> = {
  "2-up": "2-up (1×2)",
  "4-up": "4-up (2×2)",
  "8-up": "8-up (4×2)",
  "16-up": "16-up (4×4)",
  "custom": "Custom (rows × cols)",
};

export const PAGE_ORDER_LABELS: Record<PageOrder, string> = {
  "sequential": "Sequential (left-to-right, top-to-bottom)",
  "snake-fold": "Snake-fold (alternating rows)",
  "booklet": "Booklet (saddle-stitch style)",
};

// Default margin between imposed pages (in points)
export const DEFAULT_MARGIN = 10;

// Estimated print time per sheet (seconds) — single-sided, simple est.
export const PRINT_TIME_PER_SHEET_SEC = 6;

// Default cost per sheet in USD
export const DEFAULT_COST_PER_SHEET = 0.10;

// Default bleed area in points (1/8 inch)
export const DEFAULT_BLEED_PT = 9;

// ---- Math helpers ----

/** Round n up to the next multiple of m. */
export function padToMultiple(n: number, m: number): number {
  if (n <= 0) return 0;
  if (m <= 0) return n;
  return Math.ceil(n / m) * m;
}

function toBlank(p: number, pageCount: number): number {
  if (p < 1 || p > pageCount) return 0;
  return p;
}

// ---- Paper sizes ----

export function getPaperSize(id: PaperSizeId): PaperSize {
  const p = PAPER_SIZES.find((s) => s.id === id);
  if (!p) throw new Error(`Unknown paper size: ${id}`);
  return p;
}

export function isPaperSizeId(s: string): s is PaperSizeId {
  return PAPER_SIZES.some((p) => p.id === s);
}

// ---- Imposition grid ----

export function gridFor(
  type: ImpositionType,
  customRows: number = 2,
  customCols: number = 2,
): ImpositionGrid {
  switch (type) {
    case "2-up":
      return { rows: 1, cols: 2 };
    case "4-up":
      return { rows: 2, cols: 2 };
    case "8-up":
      return { rows: 2, cols: 4 };
    case "16-up":
      return { rows: 4, cols: 4 };
    case "custom":
      return {
        rows: Math.max(1, Math.floor(customRows)),
        cols: Math.max(1, Math.floor(customCols)),
      };
  }
}

export function pagesPerSheet(grid: ImpositionGrid): number {
  return grid.rows * grid.cols;
}

export function sheetCount(sourcePageCount: number, perSheet: number): number {
  if (sourcePageCount <= 0 || perSheet <= 0) return 0;
  return Math.ceil(sourcePageCount / perSheet);
}

// ---- Page order generators ----

/** Sequential order: pages 1..N laid out row-by-row, left-to-right within rows. */
export function sequentialOrder(
  sourcePageCount: number,
  grid: ImpositionGrid,
  sheetCount: number,
): ImpositionSheet[] {
  const perSheet = pagesPerSheet(grid);
  const out: ImpositionSheet[] = [];
  for (let s = 0; s < sheetCount; s++) {
    const pages: number[] = [];
    for (let i = 0; i < perSheet; i++) {
      const idx = s * perSheet + i + 1;
      pages.push(toBlank(idx, sourcePageCount));
    }
    out.push({ sheetNum: s, pages });
  }
  return out;
}

/**
 * Snake-fold order: odd rows go left-to-right, even rows go right-to-left.
 * Useful for accordion-fold binding.
 */
export function snakeFoldOrder(
  sourcePageCount: number,
  grid: ImpositionGrid,
  sheetCount: number,
): ImpositionSheet[] {
  const perSheet = pagesPerSheet(grid);
  const out: ImpositionSheet[] = [];
  for (let s = 0; s < sheetCount; s++) {
    const pages: number[] = new Array(perSheet).fill(0);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const localIdx = r * grid.cols + c; // sequential slot
        const globalIdx = s * perSheet + localIdx + 1;
        const page = toBlank(globalIdx, sourcePageCount);
        const posInRow = r % 2 === 0 ? c : grid.cols - 1 - c;
        const storeIdx = r * grid.cols + posInRow;
        pages[storeIdx] = page;
      }
    }
    out.push({ sheetNum: s, pages });
  }
  return out;
}

/**
 * Booklet order: each sheet is its own mini saddle-stitched booklet of
 * `perSheet` pages. The pattern alternates between "next from end" and
 * "next from start" of the local page range.
 *
 * For perSheet=4, sheet s (local pages 1..4):
 *   slots = [4, 1, 2, 3]
 * For perSheet=8, sheet s (local pages 1..8):
 *   slots = [8, 1, 2, 7, 6, 3, 4, 5]
 *
 * For multi-sheet docs, each sheet handles perSheet consecutive source pages.
 */
export function bookletOrder(
  sourcePageCount: number,
  grid: ImpositionGrid,
  sheetCount: number,
): ImpositionSheet[] {
  const perSheet = pagesPerSheet(grid);
  const out: ImpositionSheet[] = [];
  for (let s = 0; s < sheetCount; s++) {
    const pages: number[] = new Array(perSheet).fill(0);
    const sheetStart = s * perSheet; // 0-indexed start of this sheet's local range
    for (let i = 0; i < perSheet; i++) {
      const pair = Math.floor(i / 2);
      const isFirstOfPair = i % 2 === 0;
      let localPage: number;
      if (pair % 2 === 0) {
        // Even pair: [from-end, from-start]
        localPage = isFirstOfPair ? perSheet - pair : pair + 1;
      } else {
        // Odd pair: [from-start, from-end]
        localPage = isFirstOfPair ? pair + 1 : perSheet - pair;
      }
      const globalPage = sheetStart + localPage;
      pages[i] = toBlank(globalPage, sourcePageCount);
    }
    out.push({ sheetNum: s, pages });
  }
  return out;
}

// ---- Layout assembly ----

export interface ImpositionOptions {
  type: ImpositionType;
  pageOrder: PageOrder;
  customRows?: number;
  customCols?: number;
}

export function computeLayout(
  sourcePageCount: number,
  options: ImpositionOptions,
): ImpositionLayout {
  const { type, pageOrder, customRows = 2, customCols = 2 } = options;
  const grid = gridFor(type, customRows, customCols);
  const perSheet = pagesPerSheet(grid);
  if (sourcePageCount <= 0) {
    return {
      type,
      pageOrder,
      grid,
      sourcePageCount: 0,
      paddedPageCount: 0,
      perSheet,
      sheetCount: 0,
      sheets: [],
      blankPages: 0,
    };
  }
  const padded = padToMultiple(sourcePageCount, perSheet);
  const sheets = sheetCount(sourcePageCount, perSheet);
  let sheetList: ImpositionSheet[] = [];
  if (pageOrder === "sequential") {
    sheetList = sequentialOrder(sourcePageCount, grid, sheets);
  } else if (pageOrder === "snake-fold") {
    sheetList = snakeFoldOrder(sourcePageCount, grid, sheets);
  } else {
    sheetList = bookletOrder(sourcePageCount, grid, sheets);
  }
  return {
    type,
    pageOrder,
    grid,
    sourcePageCount,
    paddedPageCount: padded,
    perSheet,
    sheetCount: sheets,
    sheets: sheetList,
    blankPages: padded - sourcePageCount,
  };
}

// ---- Page position calculator ----

export interface PageSlotPosition {
  /** Slot index 0..perSheet-1. */
  index: number;
  /** Row 0..rows-1 (top-to-bottom). */
  row: number;
  /** Col 0..cols-1 (left-to-right). */
  col: number;
  /** X (left edge) in points. */
  x: number;
  /** Y (bottom edge) in points. */
  y: number;
  /** Slot width in points. */
  width: number;
  /** Slot height in points. */
  height: number;
}

/**
 * Calculate position of each page slot on a sheet.
 * Layout: grid.rows × grid.cols, with margin around and between cells.
 */
export function pagePositions(
  paperSize: PaperSize,
  grid: ImpositionGrid,
  margin: number = DEFAULT_MARGIN,
): PageSlotPosition[] {
  const { width, height } = paperSize;
  const cellW = (width - margin * (grid.cols + 1)) / grid.cols;
  const cellH = (height - margin * (grid.rows + 1)) / grid.rows;
  const positions: PageSlotPosition[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const index = r * grid.cols + c;
      // PDF coords: origin = bottom-left. Row 0 (top) has highest Y.
      const x = margin + c * (cellW + margin);
      const y = height - margin - (r + 1) * cellH - r * margin;
      positions.push({ index, row: r, col: c, x, y, width: cellW, height: cellH });
    }
  }
  return positions;
}

// ---- Cut marks generator ----

export interface CutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate cut marks at the corners of a rectangular cell.
 * Each corner gets a small horizontal + vertical line just outside.
 */
export function cutMarks(
  x: number,
  y: number,
  w: number,
  h: number,
  length: number = 8,
  offset: number = 3,
): CutLine[] {
  const lines: CutLine[] = [];
  // Top-left
  lines.push({ x1: x - offset - length, y1: y + h, x2: x - offset, y2: y + h });
  lines.push({ x1: x, y1: y + h + offset, x2: x, y2: y + h + offset + length });
  // Top-right
  lines.push({ x1: x + w + offset, y1: y + h, x2: x + w + offset + length, y2: y + h });
  lines.push({ x1: x + w, y1: y + h + offset, x2: x + w, y2: y + h + offset + length });
  // Bottom-left
  lines.push({ x1: x - offset - length, y1: y, x2: x - offset, y2: y });
  lines.push({ x1: x, y1: y - offset - length, x2: x, y2: y - offset });
  // Bottom-right
  lines.push({ x1: x + w + offset, y1: y, x2: x + w + offset + length, y2: y });
  lines.push({ x1: x + w, y1: y - offset - length, x2: x + w, y2: y - offset });
  return lines;
}

/** Generate all cut marks for an entire sheet's grid. */
export function cutMarksForSheet(positions: PageSlotPosition[], length: number = 8, offset: number = 3): CutLine[] {
  const out: CutLine[] = [];
  for (const p of positions) {
    out.push(...cutMarks(p.x, p.y, p.width, p.height, length, offset));
  }
  return out;
}

// ---- Margin calculator ----

export function marginCalculator(
  paperSize: PaperSize,
  grid: ImpositionGrid,
  margin: number = DEFAULT_MARGIN,
): {
  totalMarginArea: number;
  printableArea: number;
  marginPercent: number;
} {
  const { width, height } = paperSize;
  const totalArea = width * height;
  const cellW = (width - margin * (grid.cols + 1)) / grid.cols;
  const cellH = (height - margin * (grid.rows + 1)) / grid.rows;
  const printableArea = cellW * cellH * pagesPerSheet(grid);
  const totalMarginArea = totalArea - printableArea;
  const marginPercent = totalArea > 0 ? Math.round((totalMarginArea / totalArea) * 1000) / 10 : 0;
  return { totalMarginArea, printableArea, marginPercent };
}

// ---- Page scaler ----

export interface ScaleResult {
  scale: number;
  width: number;
  height: number;
}

/**
 * Scale a source page to fit within a target cell while preserving aspect ratio.
 */
export function scalePage(srcW: number, srcH: number, cellW: number, cellH: number): ScaleResult {
  if (srcW <= 0 || srcH <= 0) return { scale: 0, width: 0, height: 0 };
  const scale = Math.min(cellW / srcW, cellH / srcH);
  return {
    scale: Math.round(scale * 1000) / 1000,
    width: srcW * scale,
    height: srcH * scale,
  };
}

// ---- Blank page padder ----

export function blankPadderCount(sourcePageCount: number, perSheet: number): number {
  if (sourcePageCount <= 0) return 0;
  return padToMultiple(sourcePageCount, perSheet) - sourcePageCount;
}

// ---- Imposition validator ----

export function validateImposition(
  type: ImpositionType,
  grid: ImpositionGrid,
): { valid: boolean; expected?: ImpositionGrid; reason?: string } {
  if (type === "custom") return { valid: true };
  const expected = gridFor(type);
  if (grid.rows !== expected.rows || grid.cols !== expected.cols) {
    return { valid: false, expected, reason: `Type "${type}" expects ${expected.rows}×${expected.cols}` };
  }
  return { valid: true };
}

// ---- Renderers ----

function pageLabel(p: number): string {
  return p === 0 ? "—" : `${p}`;
}

/** Render the imposition layout as a text diagram. */
export function renderText(layout: ImpositionLayout): string {
  const lines: string[] = [];
  lines.push(`Imposition Layout — ${IMPOSITION_TYPE_LABELS[layout.type]} (${layout.pageOrder})`);
  lines.push(`Grid: ${layout.grid.rows}×${layout.grid.cols} = ${layout.perSheet} pages/sheet`);
  lines.push(`Source pages: ${layout.sourcePageCount}  Padded: ${layout.paddedPageCount}  Blanks: ${layout.blankPages}`);
  lines.push(`Total sheets: ${layout.sheetCount}`);
  lines.push("");
  for (const sheet of layout.sheets) {
    lines.push(`── Sheet ${sheet.sheetNum + 1} ──`);
    for (let r = 0; r < layout.grid.rows; r++) {
      const rowPages: string[] = [];
      for (let c = 0; c < layout.grid.cols; c++) {
        const idx = r * layout.grid.cols + c;
        rowPages.push(pageLabel(sheet.pages[idx] ?? 0).padStart(4, " "));
      }
      lines.push(`  ${rowPages.join("  ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the imposition layout as CSV. */
export function renderCsv(layout: ImpositionLayout): string {
  const lines: string[] = ["sheet_num,position,row,col,page_num"];
  for (const sheet of layout.sheets) {
    sheet.pages.forEach((p, idx) => {
      const row = Math.floor(idx / layout.grid.cols);
      const col = idx % layout.grid.cols;
      lines.push(`${sheet.sheetNum + 1},${idx + 1},${row},${col},${p === 0 ? "BLANK" : p}`);
    });
  }
  return lines.join("\n");
}

/** Render the imposition layout as an HTML preview. */
export function renderHtml(layout: ImpositionLayout): string {
  const sheetsHtml = layout.sheets
    .map((sheet) => {
      const cells = sheet.pages
        .map((p, idx) => {
          const isNewRow = idx > 0 && idx % layout.grid.cols === 0;
          return `${isNewRow ? "</tr><tr>" : ""}<td class="slot ${p === 0 ? "blank" : ""}">${pageLabel(p)}</td>`;
        })
        .join("");
      return `<div class="sheet"><h4>Sheet ${sheet.sheetNum + 1}</h4><table><tbody><tr>${cells}</tr></tbody></table></div>`;
    })
    .join("");
  return `<div class="imposition-layout"><h3>${IMPOSITION_TYPE_LABELS[layout.type]} — ${layout.pageOrder}</h3>${sheetsHtml}</div>`;
}

// ---- Estimators ----

/** Calculate paper waste percentage (blank padding pages). */
export function paperWastePercent(sourcePageCount: number, perSheet: number): number {
  if (sourcePageCount <= 0 || perSheet <= 0) return 0;
  const padded = padToMultiple(sourcePageCount, perSheet);
  const blanks = padded - sourcePageCount;
  return padded > 0 ? Math.round((blanks / padded) * 1000) / 10 : 0;
}

/** Estimate print time in minutes. */
export function printTimeEstimator(sheetCount: number, secondsPerSheet: number = PRINT_TIME_PER_SHEET_SEC): number {
  if (sheetCount <= 0) return 0;
  return Math.round((sheetCount * secondsPerSheet / 60) * 10) / 10;
}

/** Estimate cost in USD. */
export function costEstimator(
  sheetCount: number,
  costPerSheet: number = DEFAULT_COST_PER_SHEET,
): number {
  if (sheetCount <= 0) return 0;
  return Math.round(sheetCount * costPerSheet * 100) / 100;
}

/** Calculate bleed area for a sheet (perimeter × bleed, in pt²). */
export function bleedArea(
  paperSize: PaperSize,
  bleed: number = DEFAULT_BLEED_PT,
): number {
  return 2 * (paperSize.width + paperSize.height) * bleed + 4 * bleed * bleed;
}

// ---- Summary stats ----

export function computeSummary(
  layout: ImpositionLayout,
  paperSizeId: PaperSizeId,
  margin: number,
  includeCutMarks: boolean,
  costPerSheet: number = DEFAULT_COST_PER_SHEET,
): ImpositionSummary {
  const paperSize = getPaperSize(paperSizeId);
  const wastePercent = paperWastePercent(layout.sourcePageCount, layout.perSheet);
  const printTime = printTimeEstimator(layout.sheetCount);
  const cost = costEstimator(layout.sheetCount, costPerSheet);
  const bleed = bleedArea(paperSize);
  return {
    sourcePageCount: layout.sourcePageCount,
    paddedPageCount: layout.paddedPageCount,
    blankPages: layout.blankPages,
    sheetCount: layout.sheetCount,
    perSheet: layout.perSheet,
    grid: layout.grid,
    paperSizeLabel: PAPER_SIZE_LABELS[paperSizeId],
    pageOrder: layout.pageOrder,
    includeCutMarks,
    margin,
    paperWastePercent: wastePercent,
    printTimeMinutes: printTime,
    estimatedCost: cost,
    bleedAreaPt2: bleed,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:pdf-imposition:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  impositionType: ImpositionType;
  pageOrder: PageOrder;
  sourcePageCount: number;
  sheetCount: number;
  perSheet: number;
  paperSize: PaperSizeId;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(
  impositionType: ImpositionType,
  pageOrder: PageOrder,
  paperSize: PaperSizeId,
  customRows: number,
  customCols: number,
  margin: number,
  includeCutMarks: boolean,
): string {
  const params = new URLSearchParams();
  params.set("type", impositionType);
  params.set("order", pageOrder);
  params.set("paper", paperSize);
  if (impositionType === "custom") {
    params.set("rows", String(customRows));
    params.set("cols", String(customCols));
  }
  params.set("margin", String(margin));
  params.set("cuts", String(includeCutMarks));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShare {
  impositionType: ImpositionType;
  pageOrder: PageOrder;
  paperSize: PaperSizeId;
  customRows: number;
  customCols: number;
  margin: number;
  includeCutMarks: boolean;
}

export function parseShareUrl(hash: string): ParsedShare | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const typeStr = params.get("type");
  const orderStr = params.get("order");
  const paperStr = params.get("paper");
  if (!typeStr || !orderStr || !paperStr) return null;
  const validTypes: ImpositionType[] = ["2-up", "4-up", "8-up", "16-up", "custom"];
  const validOrders: PageOrder[] = ["sequential", "snake-fold", "booklet"];
  if (!validTypes.includes(typeStr as ImpositionType)) return null;
  if (!validOrders.includes(orderStr as PageOrder)) return null;
  if (!isPaperSizeId(paperStr)) return null;
  const rows = params.get("rows") ? parseInt(params.get("rows")!, 10) : 2;
  const cols = params.get("cols") ? parseInt(params.get("cols")!, 10) : 2;
  const marginStr = params.get("margin");
  const margin = marginStr ? parseFloat(marginStr) : DEFAULT_MARGIN;
  if (Number.isNaN(rows) || Number.isNaN(cols) || Number.isNaN(margin)) return null;
  return {
    impositionType: typeStr as ImpositionType,
    pageOrder: orderStr as PageOrder,
    paperSize: paperStr as PaperSizeId,
    customRows: Math.max(1, rows),
    customCols: Math.max(1, cols),
    margin: Math.max(0, margin),
    includeCutMarks: params.get("cuts") === "true",
  };
}
