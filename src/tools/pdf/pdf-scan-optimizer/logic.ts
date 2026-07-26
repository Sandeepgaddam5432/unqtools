/**
 * PDF B&W Scan Optimizer — pure logic.
 * Plan optimisation for scanned PDFs: binarize, deskew, remove blank pages, compress, threshold.
 */

export interface ScanPageResult {
  pageIndex: number;
  /** Binarization threshold (0–255). */
  threshold: number;
  /** Detected skew angle in degrees. */
  detectedSkewDeg: number;
  /** Whether the page is blank. */
  isBlank: boolean;
  /** Mean pixel intensity (0–255, lower = darker). */
  meanIntensity: number;
  /** Estimated ink coverage (0–1). */
  inkCoverage: number;
  /** Estimated compressed size in bytes (1-bit CCITT G4). */
  estimatedSizeBytes: number;
  warnings: string[];
}

export interface ScanJob {
  totalPageCount: number;
  pageRange: string;
  /** Binarization algorithm. */
  binarization: "fixed" | "otsu" | "adaptive" | "sauvola";
  /** Fixed threshold (0–255) — only used when binarization is "fixed". */
  fixedThreshold: number;
  /** Deskew enabled. */
  deskew: boolean;
  /** Max deskew angle (degrees). */
  maxDeskewDeg: number;
  /** Remove blank pages. */
  removeBlank: boolean;
  /** Ink coverage threshold for blank detection (0–1). */
  blankInkThreshold: number;
  /** Compression algorithm. */
  compression: "ccitt-g4" | "ccitt-g3" | "rle" | "lzw" | "none";
  /** Simulated per-page stats (for testing). */
  simulatedStats?: { meanIntensity: number; inkCoverage: number; skewDeg: number }[];
}

export interface ScanResult {
  job: ScanJob;
  pages: ScanPageResult[];
  pageIndices: number[];
  pagesKept: number;
  pagesRemoved: number;
  totalEstimatedBytes: number;
  warnings: string[];
  notes: string[];
  pdfLibCode: string;
}

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

/** Compute Otsu's threshold from a 256-bin histogram. */
export function otsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((s, x) => s + x, 0);
  if (total === 0) return 128;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; threshold = t; }
  }
  return threshold;
}

/** Simulate per-page stats deterministically. */
export function simulatePageStats(pageIndex: number): { meanIntensity: number; inkCoverage: number; skewDeg: number } {
  const rng = (s: number) => {
    const x = Math.sin(s * 4242) * 10000;
    return x - Math.floor(x);
  };
  // Some pages blank (low ink coverage), some content
  const blankish = rng(pageIndex) < 0.2;
  return {
    meanIntensity: blankish ? 240 + rng(pageIndex + 1) * 15 : 180 + rng(pageIndex + 1) * 50,
    inkCoverage: blankish ? rng(pageIndex + 2) * 0.02 : 0.05 + rng(pageIndex + 2) * 0.25,
    skewDeg: (rng(pageIndex + 3) - 0.5) * 6,
  };
}

export function planScanOptimize(job: ScanJob): ScanResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (job.totalPageCount <= 0) warnings.push("Total page count must be > 0.");
  if (job.fixedThreshold < 0 || job.fixedThreshold > 255) warnings.push("Fixed threshold must be 0–255.");
  if (job.maxDeskewDeg <= 0 || job.maxDeskewDeg > 45) warnings.push("Max deskew should be in (0, 45].");
  if (job.blankInkThreshold < 0 || job.blankInkThreshold > 1) warnings.push("Blank ink threshold must be 0–1.");

  const pageIndices = parsePageRange(job.pageRange, job.totalPageCount);
  if (pageIndices.length === 0) warnings.push("No pages matched the range.");

  const pages: ScanPageResult[] = pageIndices.map((pi) => {
    const stats = job.simulatedStats?.[pi] ?? simulatePageStats(pi);
    const pageWarnings: string[] = [];
    const isBlank = stats.inkCoverage < job.blankInkThreshold;

    let threshold = job.fixedThreshold;
    if (job.binarization === "otsu") {
      // Simulate Otsu: choose threshold based on mean intensity
      threshold = Math.round(stats.meanIntensity - 30);
    } else if (job.binarization === "adaptive") {
      threshold = Math.round(stats.meanIntensity - 20);
    } else if (job.binarization === "sauvola") {
      threshold = Math.round(stats.meanIntensity * 0.7);
    }

    if (threshold < 0 || threshold > 255) pageWarnings.push(`Computed threshold ${threshold} out of range — clamping.`);
    threshold = Math.max(0, Math.min(255, threshold));

    if (job.deskew && Math.abs(stats.skewDeg) > job.maxDeskewDeg) {
      pageWarnings.push(`Skew ${stats.skewDeg.toFixed(2)}° exceeds max (${job.maxDeskewDeg}°) — skipping deskew.`);
    }

    // Estimate size: 1-bit at 200 dpi for a Letter page (1700×2200 px = 3.74M px)
    // CCITT G4 typically achieves 0.05 bits/px for text → ~23 KB per page
    const PIXELS = 3_740_000;
    const baseBitsPerPixel = job.compression === "ccitt-g4" ? 0.05 : job.compression === "ccitt-g3" ? 0.08 : job.compression === "rle" ? 0.2 : job.compression === "lzw" ? 0.15 : 1.0;
    const inkMultiplier = 0.5 + stats.inkCoverage * 2;
    const estimatedSizeBytes = Math.round(PIXELS * baseBitsPerPixel * inkMultiplier / 8);

    return {
      pageIndex: pi,
      threshold,
      detectedSkewDeg: stats.skewDeg,
      isBlank,
      meanIntensity: stats.meanIntensity,
      inkCoverage: stats.inkCoverage,
      estimatedSizeBytes,
      warnings: pageWarnings,
    };
  });

  const pagesKept = job.removeBlank ? pages.filter((p) => !p.isBlank).length : pages.length;
  const pagesRemoved = job.removeBlank ? pages.filter((p) => p.isBlank).length : 0;
  const totalEstimatedBytes = (job.removeBlank ? pages.filter((p) => !p.isBlank) : pages).reduce((s, p) => s + p.estimatedSizeBytes, 0);

  if (pagesRemoved > 0) notes.push(`${pagesRemoved} blank page(s) removed.`);
  if (job.binarization === "otsu") notes.push("Otsu auto-threshold applied per page.");
  if (job.compression === "ccitt-g4") notes.push("CCITT Group 4 compression — best for text scans.");

  const pdfLibCode = `import { PDFDocument } from 'pdf-lib';
const doc = await PDFDocument.load(pdfBytes);
const pages = doc.getPages();
${pages.filter((p) => !p.isBlank || !job.removeBlank).map((p) => {
  return `// Page ${p.pageIndex + 1}: threshold=${p.threshold}, deskew=${job.deskew ? p.detectedSkewDeg.toFixed(2) + "°" : "off"}`;
}).join("\n")}
// In production: rasterize each page, binarize with chosen algorithm, deskew, then re-embed as 1-bit CCITT G4.
const out = await doc.save();`;

  return { job, pages, pageIndices, pagesKept, pagesRemoved, totalEstimatedBytes, warnings, notes, pdfLibCode };
}

export function planBatch(jobs: ScanJob[]): ScanResult[] {
  return jobs.map(planScanOptimize);
}

export function renderBatchCsv(results: ScanResult[]): string {
  const lines: string[] = ["job_index,pages_kept,pages_removed,total_bytes,compression"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.pagesKept), String(r.pagesRemoved), String(r.totalEstimatedBytes), r.job.compression].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: ScanResult): string {
  const lines: string[] = [];
  lines.push("PDF Scan Optimizer Plan");
  lines.push("========================");
  lines.push(`Total pages: ${r.job.totalPageCount}`);
  lines.push(`Pages in range: ${r.pages.length}`);
  lines.push(`Binarization: ${r.job.binarization}`);
  lines.push(`Fixed threshold: ${r.job.fixedThreshold}`);
  lines.push(`Deskew: ${r.job.deskew ? "yes (max " + r.job.maxDeskewDeg + "°)" : "no"}`);
  lines.push(`Remove blank: ${r.job.removeBlank ? "yes (threshold " + r.job.blankInkThreshold + ")" : "no"}`);
  lines.push(`Compression: ${r.job.compression}`);
  lines.push(`Pages kept: ${r.pagesKept}`);
  lines.push(`Pages removed: ${r.pagesRemoved}`);
  lines.push(`Total estimated size: ${r.totalEstimatedBytes} bytes (~${(r.totalEstimatedBytes / 1024).toFixed(1)} KB)`);
  lines.push("");
  lines.push("Per-page detail:");
  r.pages.forEach((p) => {
    lines.push(`  Page ${p.pageIndex + 1}: ${p.isBlank ? "BLANK" : "content"} — mean ${p.meanIntensity.toFixed(0)}, ink ${(p.inkCoverage * 100).toFixed(1)}%, threshold ${p.threshold}, size ${p.estimatedSizeBytes} B${p.warnings.length ? " — " + p.warnings.join("; ") : ""}`);
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  lines.push("");
  lines.push("pdf-lib code:");
  lines.push(r.pdfLibCode);
  return lines.join("\n");
}

export const SCAN_PRESETS = [
  { id: "text-doc", label: "Text document (CCITT G4)", binarization: "otsu" as const, fixedThreshold: 128, deskew: true, maxDeskewDeg: 10, removeBlank: true, blankInkThreshold: 0.02, compression: "ccitt-g4" as const },
  { id: "form", label: "Form / receipt (Otsu)", binarization: "otsu" as const, fixedThreshold: 128, deskew: true, maxDeskewDeg: 15, removeBlank: false, blankInkThreshold: 0.01, compression: "ccitt-g4" as const },
  { id: "photo-mixed", label: "Mixed photo+text (adaptive)", binarization: "adaptive" as const, fixedThreshold: 128, deskew: false, maxDeskewDeg: 5, removeBlank: false, blankInkThreshold: 0.01, compression: "lzw" as const },
  { id: "fixed-128", label: "Fixed threshold 128", binarization: "fixed" as const, fixedThreshold: 128, deskew: true, maxDeskewDeg: 10, removeBlank: true, blankInkThreshold: 0.02, compression: "ccitt-g4" as const },
];

export function getScanPresets() {
  return [...SCAN_PRESETS];
}

/** Compute aggregate ink coverage across all pages. */
export function aggregateInkCoverage(r: ScanResult): number {
  if (r.pages.length === 0) return 0;
  return r.pages.reduce((s, p) => s + p.inkCoverage, 0) / r.pages.length;
}

/** Estimate total size reduction vs. uncompressed 8-bit grayscale. */
export function computeCompressionRatio(r: ScanResult): number {
  const uncompressed = r.pages.length * 3_740_000; // 8-bit grayscale
  if (r.totalEstimatedBytes === 0 || uncompressed === 0) return 1;
  return uncompressed / r.totalEstimatedBytes;
}
