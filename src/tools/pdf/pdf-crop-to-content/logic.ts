/**
 * PDF Crop to Content — pure logic.
 * Plan auto-trim of PDF page margins by detecting content boundaries.
 */

export interface CropPageResult {
  pageIndex: number;
  /** Original page dimensions in pt. */
  origWidth: number;
  origHeight: number;
  /** Detected content bounding box (left, bottom, right, top) in pt. */
  contentBox: { left: number; bottom: number; right: number; top: number };
  /** New page dimensions after crop. */
  newWidth: number;
  newHeight: number;
  /** Crop offsets applied to the page. */
  cropOffset: { left: number; bottom: number; right: number; top: number };
  /** Whether the page was actually cropped (content < 95% of page). */
  cropped: boolean;
  warnings: string[];
}

export interface CropJob {
  totalPageCount: number;
  pageRange: string;
  /** Margin threshold in pt — content within this distance of page edge is treated as bleed. */
  marginThresholdPt: number;
  /** Minimum crop reduction (in pt) to apply crop at all. */
  minCropPt: number;
  /** Keep a margin around content (added back to crop box). */
  keepMarginPt: number;
  /** Simulated content boxes (for testing) — keyed by 0-based page index. */
  simulatedContentBoxes?: { left: number; bottom: number; right: number; top: number }[];
}

export interface CropResult {
  job: CropJob;
  pages: CropPageResult[];
  pageIndices: number[];
  pagesCropped: number;
  pagesUnchanged: number;
  warnings: string[];
  notes: string[];
  pdfLibCode: string;
}

const DEFAULT_PAGE_SIZE = { width: 612, height: 792 }; // US Letter

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

/** Simulate content box detection (deterministic, for demo/testing). */
export function simulateContentBox(pageIndex: number, pageWidth: number, pageHeight: number): { left: number; bottom: number; right: number; top: number } {
  const rng = (s: number) => {
    const x = Math.sin(s * 7777) * 10000;
    return x - Math.floor(x);
  };
  const margin = 30 + rng(pageIndex) * 30;
  return {
    left: margin,
    bottom: margin,
    right: pageWidth - margin * (0.5 + rng(pageIndex + 1) * 0.5),
    top: pageHeight - margin * (0.5 + rng(pageIndex + 2) * 0.5),
  };
}

export function planCrop(job: CropJob): CropResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (job.totalPageCount <= 0) warnings.push("Total page count must be > 0.");
  if (job.marginThresholdPt < 0 || job.marginThresholdPt > 200) warnings.push("Margin threshold out of range (0–200 pt).");
  if (job.minCropPt < 0 || job.minCropPt > 200) warnings.push("Min crop out of range (0–200 pt).");
  if (job.keepMarginPt < 0 || job.keepMarginPt > 200) warnings.push("Keep margin out of range (0–200 pt).");

  const pageIndices = parsePageRange(job.pageRange, job.totalPageCount);
  if (pageIndices.length === 0) warnings.push("No pages matched the range.");

  const pages: CropPageResult[] = pageIndices.map((pi) => {
    const pageWidth = DEFAULT_PAGE_SIZE.width;
    const pageHeight = DEFAULT_PAGE_SIZE.height;
    const contentBox = job.simulatedContentBoxes?.[pi] ?? simulateContentBox(pi, pageWidth, pageHeight);
    const pageWarnings: string[] = [];

    // Apply keep margin
    const left = Math.max(0, contentBox.left - job.keepMarginPt);
    const bottom = Math.max(0, contentBox.bottom - job.keepMarginPt);
    const right = Math.min(pageWidth, contentBox.right + job.keepMarginPt);
    const top = Math.min(pageHeight, contentBox.top + job.keepMarginPt);

    const cropLeft = left;
    const cropBottom = bottom;
    const cropRight = pageWidth - right;
    const cropTop = pageHeight - top;

    const totalCrop = cropLeft + cropBottom + cropRight + cropTop;
    const cropped = totalCrop >= job.minCropPt;

    if (cropped && totalCrop < 4) pageWarnings.push("Crop is negligible (< 4 pt total).");

    return {
      pageIndex: pi,
      origWidth: pageWidth,
      origHeight: pageHeight,
      contentBox,
      newWidth: right - left,
      newHeight: top - bottom,
      cropOffset: { left: cropLeft, bottom: cropBottom, right: cropRight, top: cropTop },
      cropped,
      warnings: pageWarnings,
    };
  });

  const pagesCropped = pages.filter((p) => p.cropped).length;
  const pagesUnchanged = pages.length - pagesCropped;

  if (pagesCropped === 0 && pages.length > 0) notes.push("No pages were cropped — content may fill the entire page.");
  if (job.keepMarginPt > 0) notes.push(`${job.keepMarginPt} pt safety margin added around content.`);

  const pdfLibCode = `import { PDFDocument } from 'pdf-lib';
const doc = await PDFDocument.load(pdfBytes);
const pages = doc.getPages();
${pages.filter((p) => p.cropped).map((p) => {
  const mb = `left: ${p.cropOffset.left.toFixed(1)}, bottom: ${p.cropOffset.bottom.toFixed(1)}, right: ${p.cropOffset.right.toFixed(1)}, top: ${p.cropOffset.top.toFixed(1)}`;
  return `pages[${p.pageIndex}].setCropBox(0, 0, ${p.newWidth.toFixed(1)}, ${p.newHeight.toFixed(1)});\n// mediaBox offset: ${mb}`;
}).join("\n")}
const out = await doc.save();`;

  return { job, pages, pageIndices, pagesCropped, pagesUnchanged, warnings, notes, pdfLibCode };
}

export function planBatch(jobs: CropJob[]): CropResult[] {
  return jobs.map(planCrop);
}

export function renderBatchCsv(results: CropResult[]): string {
  const lines: string[] = ["job_index,pages_cropped,pages_unchanged,total_pages"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.pagesCropped), String(r.pagesUnchanged), String(r.pages.length)].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: CropResult): string {
  const lines: string[] = [];
  lines.push("PDF Crop to Content Plan");
  lines.push("=========================");
  lines.push(`Total pages: ${r.job.totalPageCount}`);
  lines.push(`Pages in range: ${r.pages.length}`);
  lines.push(`Margin threshold: ${r.job.marginThresholdPt} pt`);
  lines.push(`Min crop: ${r.job.minCropPt} pt`);
  lines.push(`Keep margin: ${r.job.keepMarginPt} pt`);
  lines.push(`Pages cropped: ${r.pagesCropped}`);
  lines.push(`Pages unchanged: ${r.pagesUnchanged}`);
  lines.push("");
  lines.push("Per-page detail:");
  r.pages.forEach((p) => {
    lines.push(`  Page ${p.pageIndex + 1}: ${p.cropped ? "CROPPED" : "unchanged"} — content box (${p.contentBox.left.toFixed(0)}, ${p.contentBox.bottom.toFixed(0)}, ${p.contentBox.right.toFixed(0)}, ${p.contentBox.top.toFixed(0)}), new size ${p.newWidth.toFixed(0)}×${p.newHeight.toFixed(0)} pt`);
    p.warnings.forEach((w) => lines.push(`    ! ${w}`));
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  lines.push("");
  lines.push("pdf-lib code:");
  lines.push(r.pdfLibCode);
  return lines.join("\n");
}

export const CROP_PRESETS = [
  { id: "tight", label: "Tight crop (0pt margin)", marginThresholdPt: 5, minCropPt: 4, keepMarginPt: 0 },
  { id: "balanced", label: "Balanced (10pt margin)", marginThresholdPt: 10, minCropPt: 10, keepMarginPt: 10 },
  { id: "loose", label: "Loose (24pt margin)", marginThresholdPt: 20, minCropPt: 20, keepMarginPt: 24 },
  { id: "scan-cleanup", label: "Scan cleanup (36pt margin)", marginThresholdPt: 36, minCropPt: 30, keepMarginPt: 18 },
];

export function getCropPresets() {
  return [...CROP_PRESETS];
}

/** Compute total area reduction percentage from a crop result. */
export function computeReductionPercent(r: CropResult): number {
  if (r.pages.length === 0) return 0;
  let totalOrig = 0;
  let totalNew = 0;
  for (const p of r.pages) {
    totalOrig += p.origWidth * p.origHeight;
    totalNew += p.newWidth * p.newHeight;
  }
  if (totalOrig === 0) return 0;
  return Math.max(0, (1 - totalNew / totalOrig) * 100);
}

/** Detect "blank-ish" pages where content box is essentially zero. */
export function detectBlankPages(r: CropResult): number[] {
  return r.pages.filter((p) => {
    const w = p.contentBox.right - p.contentBox.left;
    const h = p.contentBox.top - p.contentBox.bottom;
    return w < 5 || h < 5;
  }).map((p) => p.pageIndex);
}
