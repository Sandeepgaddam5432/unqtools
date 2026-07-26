/**
 * PDF Deskew Tool — pure logic.
 * Plan deskew for scanned PDFs: angle detection, auto-straighten, manual angle, page range.
 */

export interface DeskewPageResult {
  pageIndex: number;
  /** Detected skew angle in degrees (-45 to +45). Negative = counter-clockwise. */
  detectedAngle: number;
  /** Final applied angle after combining detection + manual override. */
  appliedAngle: number;
  /** Confidence score 0-1. */
  confidence: number;
  /** Whether the deskew operation was actually applied (not skipped). */
  applied: boolean;
  warnings: string[];
}

export interface DeskewJob {
  totalPageCount: number;
  pageRange: string;
  /** "auto" uses detected angle; "manual" uses manualAngleDeg. */
  mode: "auto" | "manual" | "auto-with-manual-fallback";
  /** Manual angle in degrees to apply (only used when mode involves manual). */
  manualAngleDeg: number;
  /** Maximum allowed auto-detected angle (in degrees); larger = skip. */
  maxAutoAngleDeg: number;
  /** Confidence threshold for accepting auto detection. */
  confidenceThreshold: number;
  /** Simulated detected angles per page (for demo / testing). */
  detectedAngles?: number[];
  /** Simulated confidences per page (for demo / testing). */
  detectedConfidences?: number[];
}

export interface DeskewResult {
  job: DeskewJob;
  pages: DeskewPageResult[];
  pageIndices: number[];
  pagesStraightened: number;
  pagesSkipped: number;
  warnings: string[];
  notes: string[];
  pdfLibCode: string;
}

/** Parse a page range string like "1-5, 8, 10-12" into sorted unique 0-based indices. */
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

/** Normalize an angle to the range [-45, 45]. */
export function normalizeAngle(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  if (d > 45) d -= 90;
  if (d < -45) d += 90;
  return d;
}

/** Simulate skew detection on a page using the Hough transform approach (mock). */
export function simulateAngleDetection(seed: number): { angle: number; confidence: number } {
  // Deterministic pseudo-random based on seed.
  const rng = (s: number) => {
    const x = Math.sin(s * 9999) * 10000;
    return x - Math.floor(x);
  };
  const angle = (rng(seed) - 0.5) * 20; // -10 to +10 degrees typical
  const confidence = 0.5 + rng(seed + 1) * 0.5; // 0.5 to 1.0
  return { angle, confidence };
}

export function planDeskew(job: DeskewJob): DeskewResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (job.totalPageCount <= 0) warnings.push("Total page count must be > 0.");
  if (Math.abs(job.manualAngleDeg) > 45) warnings.push("Manual angle should be in [-45, 45] degrees.");
  if (job.maxAutoAngleDeg <= 0 || job.maxAutoAngleDeg > 45) warnings.push("Max auto angle should be in (0, 45].");
  if (job.confidenceThreshold < 0 || job.confidenceThreshold > 1) warnings.push("Confidence threshold should be in [0, 1].");

  const pageIndices = parsePageRange(job.pageRange, job.totalPageCount);
  if (pageIndices.length === 0) warnings.push("No pages matched the range.");

  const pages: DeskewPageResult[] = pageIndices.map((pi) => {
    const detected = job.detectedAngles?.[pi] !== undefined
      ? { angle: job.detectedAngles[pi], confidence: job.detectedConfidences?.[pi] ?? 0.9 }
      : simulateAngleDetection(pi + 1);
    const pageWarnings: string[] = [];
    let appliedAngle = 0;
    let applied = false;
    const normalized = normalizeAngle(detected.angle);

    if (job.mode === "manual") {
      appliedAngle = -job.manualAngleDeg; // counter-rotate
      applied = true;
      pageWarnings.push("Manual angle applied (auto detection bypassed).");
    } else if (job.mode === "auto") {
      if (detected.confidence < job.confidenceThreshold) {
        pageWarnings.push(`Low confidence (${detected.confidence.toFixed(2)}) — skipping auto-deskew.`);
      } else if (Math.abs(normalized) > job.maxAutoAngleDeg) {
        pageWarnings.push(`Detected angle ${normalized.toFixed(2)}° exceeds max (${job.maxAutoAngleDeg}°) — skipping.`);
      } else {
        appliedAngle = -normalized;
        applied = true;
      }
    } else if (job.mode === "auto-with-manual-fallback") {
      if (detected.confidence >= job.confidenceThreshold && Math.abs(normalized) <= job.maxAutoAngleDeg) {
        appliedAngle = -normalized;
        applied = true;
      } else {
        appliedAngle = -job.manualAngleDeg;
        applied = true;
        pageWarnings.push("Auto detection rejected — using manual fallback.");
      }
    }
    return { pageIndex: pi, detectedAngle: detected.angle, appliedAngle, confidence: detected.confidence, applied, warnings: pageWarnings };
  });

  const pagesStraightened = pages.filter((p) => p.applied).length;
  const pagesSkipped = pages.length - pagesStraightened;

  if (pagesStraightened === 0 && pages.length > 0) notes.push("No pages were straightened — check confidence threshold or use manual mode.");
  if (job.mode === "auto" && pages.some((p) => p.warnings.some((w) => w.includes("Low confidence")))) {
    notes.push("Consider lowering confidence threshold or using manual mode for low-confidence pages.");
  }

  const pdfLibCode = `import { PDFDocument, degrees } from 'pdf-lib';
const doc = await PDFDocument.load(pdfBytes);
const pages = doc.getPages();
${pages.filter((p) => Math.abs(p.appliedAngle) > 0.01).map((p) => `pages[${p.pageIndex}].setRotation(degrees(${p.appliedAngle.toFixed(2)}));`).join("\n")}
const out = await doc.save();`;

  return { job, pages, pageIndices, pagesStraightened, pagesSkipped, warnings, notes, pdfLibCode };
}

export function planBatch(jobs: DeskewJob[]): DeskewResult[] {
  return jobs.map(planDeskew);
}

export function renderBatchCsv(results: DeskewResult[]): string {
  const lines: string[] = ["job_index,pages_straightened,pages_skipped,total_pages"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.pagesStraightened), String(r.pagesSkipped), String(r.pages.length)].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: DeskewResult): string {
  const lines: string[] = [];
  lines.push("PDF Deskew Plan");
  lines.push("===============");
  lines.push(`Total pages: ${r.job.totalPageCount}`);
  lines.push(`Pages in range: ${r.pages.length}`);
  lines.push(`Mode: ${r.job.mode}`);
  lines.push(`Manual angle: ${r.job.manualAngleDeg}°`);
  lines.push(`Max auto angle: ${r.job.maxAutoAngleDeg}°`);
  lines.push(`Confidence threshold: ${r.job.confidenceThreshold}`);
  lines.push(`Pages straightened: ${r.pagesStraightened}`);
  lines.push(`Pages skipped: ${r.pagesSkipped}`);
  lines.push("");
  lines.push("Per-page detail:");
  r.pages.forEach((p) => {
    lines.push(`  Page ${p.pageIndex + 1}: detected ${p.detectedAngle.toFixed(2)}° (conf ${p.confidence.toFixed(2)}), applied ${p.appliedAngle.toFixed(2)}°`);
    p.warnings.forEach((w) => lines.push(`    ! ${w}`));
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  lines.push("");
  lines.push("pdf-lib code:");
  lines.push(r.pdfLibCode);
  return lines.join("\n");
}

/** Common deskew presets for different scan qualities. */
export const DESKEW_PRESETS = [
  { id: "high-quality", label: "High quality scans", mode: "auto" as const, manualAngleDeg: 0, maxAutoAngleDeg: 10, confidenceThreshold: 0.85 },
  { id: "medium-quality", label: "Medium quality scans", mode: "auto" as const, manualAngleDeg: 0, maxAutoAngleDeg: 15, confidenceThreshold: 0.7 },
  { id: "low-quality", label: "Low quality scans", mode: "auto-with-manual-fallback" as const, manualAngleDeg: 2, maxAutoAngleDeg: 20, confidenceThreshold: 0.5 },
  { id: "manual-only", label: "Manual only (uniform offset)", mode: "manual" as const, manualAngleDeg: 3, maxAutoAngleDeg: 45, confidenceThreshold: 0.5 },
];

export function getDeskewPresets() {
  return [...DESKEW_PRESETS];
}

/** Estimate the rotation matrix elements for a given angle (for reference). */
export function rotationMatrix(angleDeg: number): { cos: number; sin: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { cos: Math.cos(rad), sin: Math.sin(rad) };
}

/** Compute the new bounding box dimensions after rotation (for fit calculations). */
export function rotatedBoundingBox(width: number, height: number, angleDeg: number): { width: number; height: number } {
  const { cos, sin } = rotationMatrix(angleDeg);
  const absSin = Math.abs(sin);
  const absCos = Math.abs(cos);
  const newW = width * absCos + height * absSin;
  const newH = width * absSin + height * absCos;
  return { width: newW, height: newH };
}
