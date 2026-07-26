/**
 * PDF Combine Pages (2-up) — pure logic.
 * Plan 2-up / 4-up combination: spacing, orientation, page order.
 */

export type NUpMode = "2-up" | "4-up" | "6-up" | "9-up";
export type Orientation = "portrait" | "landscape";
export type PageOrder = "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top";

export interface CombineJob {
  totalPageCount: number;
  pageRange: string;
  mode: NUpMode;
  orientation: Orientation;
  pageOrder: PageOrder;
  spacingPt: number;
  outerMarginPt: number;
  /** Output page size: A4 (595×842 pt) or Letter (612×792 pt). */
  outputPageSize: "a4" | "letter";
  /** Draw border around each sub-page. */
  drawBorder: boolean;
  /** Order within a sheet: row-major (default) or column-major. */
  withinSheetOrder: "row-major" | "column-major";
}

export interface SubPagePlacement {
  /** Original page index (0-based). */
  sourcePageIndex: number;
  /** Output sheet index (0-based). */
  sheetIndex: number;
  /** Position within sheet (0-based). */
  slotIndex: number;
  /** Position on the output sheet in pt. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CombineResult {
  job: CombineJob;
  sheets: SubPagePlacement[][];
  outputSheetCount: number;
  outputWidthPt: number;
  outputHeightPt: number;
  subPageWidthPt: number;
  subPageHeightPt: number;
  warnings: string[];
  notes: string[];
  pdfLibCode: string;
}

const PAGE_SIZES: Record<"a4" | "letter", { width: number; height: number }> = {
  a4: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
};

const MODE_GRID: Record<NUpMode, { cols: number; rows: number }> = {
  "2-up": { cols: 2, rows: 1 },
  "4-up": { cols: 2, rows: 2 },
  "6-up": { cols: 3, rows: 2 },
  "9-up": { cols: 3, rows: 3 },
};

export function getPageSizes() { return { ...PAGE_SIZES }; }
export function getModeGrid() { return { ...MODE_GRID }; }

/** Parse a page range string into sorted unique 0-based indices. */
export function parsePageRange(range: string, total: number): number[] {
  if (!range || !range.trim()) return Array.from({ length: total }, (_, i) => i);
  const out = new Set<number>();
  for (const part of range.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d+)-(\d+)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= total) out.add(i - 1);
      }
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n >= 1 && n <= total) out.add(n - 1);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** Map a slot index to grid (row, col) based on order settings. */
export function slotToGrid(slot: number, mode: NUpMode, order: PageOrder, withinSheet: "row-major" | "column-major"): { row: number; col: number } {
  const grid = MODE_GRID[mode];
  const cols = grid.cols;
  const rows = grid.rows;
  let row: number, col: number;
  if (withinSheet === "row-major") {
    row = Math.floor(slot / cols);
    col = slot % cols;
  } else {
    col = Math.floor(slot / rows);
    row = slot % rows;
  }
  // Apply page-order transformation
  if (order === "right-to-left") col = cols - 1 - col;
  if (order === "bottom-to-top") row = rows - 1 - row;
  return { row, col };
}

export function planCombine(job: CombineJob): CombineResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  if (job.totalPageCount <= 0) warnings.push("Total page count must be > 0.");
  if (job.spacingPt < 0 || job.spacingPt > 200) warnings.push("Spacing should be 0–200 pt.");
  if (job.outerMarginPt < 0 || job.outerMarginPt > 300) warnings.push("Outer margin should be 0–300 pt.");

  const pageIndices = parsePageRange(job.pageRange, job.totalPageCount);
  if (pageIndices.length === 0) warnings.push("No pages matched the range.");

  const grid = MODE_GRID[job.mode];
  const perSheet = grid.cols * grid.rows;
  const sheetCount = Math.ceil(pageIndices.length / perSheet);

  // Calculate output dimensions
  const basePage = PAGE_SIZES[job.outputPageSize];
  let outputWidth = basePage.width;
  let outputHeight = basePage.height;
  if (job.orientation === "landscape") {
    [outputWidth, outputHeight] = [outputHeight, outputWidth];
  }

  const innerW = outputWidth - 2 * job.outerMarginPt - (grid.cols - 1) * job.spacingPt;
  const innerH = outputHeight - 2 * job.outerMarginPt - (grid.rows - 1) * job.spacingPt;
  const subW = innerW / grid.cols;
  const subH = innerH / grid.rows;

  const sheets: SubPagePlacement[][] = [];
  for (let s = 0; s < sheetCount; s++) {
    const sheet: SubPagePlacement[] = [];
    for (let slot = 0; slot < perSheet; slot++) {
      const piIndex = s * perSheet + slot;
      if (piIndex >= pageIndices.length) break;
      const sourcePageIndex = pageIndices[piIndex];
      const { row, col } = slotToGrid(slot, job.mode, job.pageOrder, job.withinSheetOrder);
      const x = job.outerMarginPt + col * (subW + job.spacingPt);
      // PDF y-axis is bottom-up; row 0 = top in display, so y = top margin from top
      const y = outputHeight - job.outerMarginPt - (row + 1) * subH - row * job.spacingPt;
      sheet.push({ sourcePageIndex, sheetIndex: s, slotIndex: slot, x, y, width: subW, height: subH });
    }
    sheets.push(sheet);
  }

  if (sheetCount * perSheet > pageIndices.length) {
    notes.push(`${sheetCount * perSheet - pageIndices.length} empty slot(s) on the last sheet.`);
  }
  if (job.pageOrder === "right-to-left") notes.push("Right-to-left page order — useful for right-bound (e.g. manga, Arabic, Hebrew) layouts.");
  if (job.orientation === "landscape" && job.mode !== "2-up") notes.push("Landscape orientation with multi-row layout — verify readability.");

  const pdfLibCode = `import { PDFDocument } from 'pdf-lib';
const src = await PDFDocument.load(srcBytes);
const out = await PDFDocument.create();
const srcPages = src.getPages();
${sheets.map((sheet, i) => {
  const embeds = sheet.map((sp) => `[${sp.sourcePageIndex}]`).join(", ");
  return `// Sheet ${i + 1}: embed source pages ${embeds}`;
}).join("\n")}
// Use out.addPage() with the embedded pages positioned per plan.
const bytes = await out.save();`;

  return {
    job, sheets, outputSheetCount: sheetCount,
    outputWidthPt: outputWidth, outputHeightPt: outputHeight,
    subPageWidthPt: subW, subPageHeightPt: subH,
    warnings, notes, pdfLibCode,
  };
}

export function planBatch(jobs: CombineJob[]): CombineResult[] {
  return jobs.map(planCombine);
}

export function renderBatchCsv(results: CombineResult[]): string {
  const lines: string[] = ["job_index,sheets,sub_page_w_pt,sub_page_h_pt,page_count"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.outputSheetCount), r.subPageWidthPt.toFixed(1), r.subPageHeightPt.toFixed(1), String(r.sheets.reduce((s, x) => s + x.length, 0))].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: CombineResult): string {
  const lines: string[] = [];
  lines.push("PDF Combine (N-up) Plan");
  lines.push("========================");
  lines.push(`Total pages: ${r.job.totalPageCount}`);
  lines.push(`Mode: ${r.job.mode}`);
  lines.push(`Orientation: ${r.job.orientation}`);
  lines.push(`Page order: ${r.job.pageOrder}`);
  lines.push(`Within-sheet order: ${r.job.withinSheetOrder}`);
  lines.push(`Output page size: ${r.job.outputPageSize} (${r.outputWidthPt.toFixed(0)}×${r.outputHeightPt.toFixed(0)} pt)`);
  lines.push(`Spacing: ${r.job.spacingPt} pt`);
  lines.push(`Outer margin: ${r.job.outerMarginPt} pt`);
  lines.push(`Sub-page size: ${r.subPageWidthPt.toFixed(1)}×${r.subPageHeightPt.toFixed(1)} pt`);
  lines.push(`Output sheets: ${r.outputSheetCount}`);
  lines.push(`Draw border: ${r.job.drawBorder ? "yes" : "no"}`);
  lines.push("");
  lines.push("Per-sheet detail:");
  r.sheets.forEach((sheet, i) => {
    lines.push(`  Sheet ${i + 1}: ${sheet.length} sub-page(s)`);
    sheet.forEach((sp) => {
      lines.push(`    Slot ${sp.slotIndex + 1}: source page ${sp.sourcePageIndex + 1} → x=${sp.x.toFixed(1)}, y=${sp.y.toFixed(1)}, ${sp.width.toFixed(1)}×${sp.height.toFixed(1)} pt`);
    });
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export const COMBINE_PRESETS = [
  { id: "2-up-portrait", label: "2-up portrait (Letter)", mode: "2-up" as NUpMode, orientation: "portrait" as Orientation, outputPageSize: "letter" as const, spacingPt: 18, outerMarginPt: 36 },
  { id: "2-up-landscape", label: "2-up landscape (A4)", mode: "2-up" as NUpMode, orientation: "landscape" as Orientation, outputPageSize: "a4" as const, spacingPt: 18, outerMarginPt: 36 },
  { id: "4-up-portrait", label: "4-up portrait (A4)", mode: "4-up" as NUpMode, orientation: "portrait" as Orientation, outputPageSize: "a4" as const, spacingPt: 12, outerMarginPt: 24 },
  { id: "9-up-portrait", label: "9-up portrait (A3)", mode: "9-up" as NUpMode, orientation: "portrait" as Orientation, outputPageSize: "a4" as const, spacingPt: 8, outerMarginPt: 18 },
];

export function getCombinePresets() {
  return [...COMBINE_PRESETS];
}

/** Compute number of sheets needed for a page count given mode. */
export function computeSheetCount(pageCount: number, mode: NUpMode): number {
  const grid = MODE_GRID[mode];
  return Math.ceil(pageCount / (grid.cols * grid.rows));
}

/** Check whether two jobs produce equivalent layouts. */
export function layoutsEqual(a: CombineResult, b: CombineResult): boolean {
  if (a.outputSheetCount !== b.outputSheetCount) return false;
  if (a.subPageWidthPt !== b.subPageWidthPt) return false;
  if (a.subPageHeightPt !== b.subPageHeightPt) return false;
  return true;
}
