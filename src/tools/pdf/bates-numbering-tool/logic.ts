/**
 * Bates Numbering Tool — pure logic.
 * Plan Bates stamping for PDFs: custom format, prefix/suffix, position (9-grid),
 * font size, starting number, page range, batch.
 */

export type GridPosition =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface GridPositionInfo {
  id: GridPosition;
  label: string;
  /** X alignment 0–1 (0 = left, 0.5 = center, 1 = right). */
  xAlign: number;
  /** Y alignment 0–1 (0 = bottom, 0.5 = middle, 1 = top). */
  yAlign: number;
}

export const GRID_POSITIONS: GridPositionInfo[] = [
  { id: "top-left", label: "Top-Left", xAlign: 0, yAlign: 1 },
  { id: "top-center", label: "Top-Center", xAlign: 0.5, yAlign: 1 },
  { id: "top-right", label: "Top-Right", xAlign: 1, yAlign: 1 },
  { id: "middle-left", label: "Middle-Left", xAlign: 0, yAlign: 0.5 },
  { id: "middle-center", label: "Middle-Center", xAlign: 0.5, yAlign: 0.5 },
  { id: "middle-right", label: "Middle-Right", xAlign: 1, yAlign: 0.5 },
  { id: "bottom-left", label: "Bottom-Left", xAlign: 0, yAlign: 0 },
  { id: "bottom-center", label: "Bottom-Center", xAlign: 0.5, yAlign: 0 },
  { id: "bottom-right", label: "Bottom-Right", xAlign: 1, yAlign: 0 },
];

export function getGridPositions(): GridPositionInfo[] {
  return [...GRID_POSITIONS];
}

export function getGridPosition(id: GridPosition): GridPositionInfo | null {
  return GRID_POSITIONS.find((p) => p.id === id) ?? null;
}

export interface BatesFormat {
  prefix: string;
  startNumber: number;
  digits: number;
  suffix: string;
  separator: string;
}

export interface BatesJob {
  format: BatesFormat;
  position: GridPosition;
  fontSizePt: number;
  marginPt: number;
  color: { r: number; g: number; b: number };
  pageRange: string; // e.g. "1-10, 15, 20-25"
  totalPageCount: number;
}

export interface BatesStamp {
  pageIndex: number;
  stampNumber: number;
  label: string;
  x: number;
  y: number;
}

export interface BatesResult {
  job: BatesJob;
  stamps: BatesStamp[];
  pageIndices: number[];
  warnings: string[];
  notes: string[];
  pdfLibCode: string;
}

/** Parse a page range string like "1-5, 8, 10-12" into a sorted unique list of 0-based indices. */
export function parsePageRange(range: string, totalPageCount: number): number[] {
  if (!range || !range.trim()) {
    return Array.from({ length: totalPageCount }, (_, i) => i);
  }
  const out = new Set<number>();
  for (const part of range.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d+)-(\d+)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPageCount) out.add(i - 1);
      }
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n >= 1 && n <= totalPageCount) out.add(n - 1);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** Format a Bates stamp label given a format and stamp number. */
export function formatBatesLabel(format: BatesFormat, stampNumber: number): string {
  const padded = String(stampNumber).padStart(format.digits, "0");
  const sep = format.separator || "";
  return `${format.prefix}${sep}${padded}${sep}${format.suffix}`.replace(/^[-_]+|[-_]+$/g, "").trim() || padded;
}

export function planBates(job: BatesJob): BatesResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (job.totalPageCount <= 0) warnings.push("Total page count must be > 0.");
  if (job.format.startNumber < 0) warnings.push("Start number must be ≥ 0.");
  if (job.format.digits < 1 || job.format.digits > 12) warnings.push("Digits should be 1–12.");
  if (job.fontSizePt < 4 || job.fontSizePt > 72) warnings.push("Font size out of typical range (4–72 pt).");
  if (job.marginPt < 0 || job.marginPt > 200) warnings.push("Margin out of typical range (0–200 pt).");
  if (job.color.r < 0 || job.color.r > 1) warnings.push("Red channel must be 0–1.");
  if (job.color.g < 0 || job.color.g > 1) warnings.push("Green channel must be 0–1.");
  if (job.color.b < 0 || job.color.b > 1) warnings.push("Blue channel must be 0–1.");

  const pageIndices = parsePageRange(job.pageRange, job.totalPageCount);
  if (pageIndices.length === 0) warnings.push("No pages matched the range — output will be empty.");

  // Compute stamp positions on a US Letter page (612×792 pt) for reference.
  const PAGE_W = 612;
  const PAGE_H = 792;
  const pos = getGridPosition(job.position);
  if (!pos) warnings.push("Unknown grid position.");

  const stamps: BatesStamp[] = pageIndices.map((pi, i) => {
    const stampNumber = job.format.startNumber + i;
    const label = formatBatesLabel(job.format, stampNumber);
    const x = pos ? pos.xAlign * (PAGE_W - 2 * job.marginPt) + job.marginPt : job.marginPt;
    const y = pos ? pos.yAlign * (PAGE_H - 2 * job.marginPt) + job.marginPt : job.marginPt;
    return { pageIndex: pi, stampNumber, label, x, y };
  });

  // pdf-lib snippet for reference
  const pdfLibCode = `import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
const doc = await PDFDocument.load(pdfBytes);
const font = await doc.embedFont(StandardFonts.Helvetica);
const pages = doc.getPages();
const color = rgb(${job.color.r}, ${job.color.g}, ${job.color.b});
${stamps.map((s) => `pages[${s.pageIndex}].drawText('${s.label}', { x: ${s.x.toFixed(1)}, y: ${s.y.toFixed(1)}, size: ${job.fontSizePt}, font, color });`).join("\n")}
const out = await doc.save();`;

  if (job.format.prefix && job.format.suffix) notes.push("Both prefix and suffix will appear on every stamp.");
  if (pageIndices.length < job.totalPageCount) notes.push(`${job.totalPageCount - pageIndices.length} page(s) will be skipped (not in range).`);

  return { job, stamps, pageIndices, warnings, notes, pdfLibCode };
}

export function planBatch(jobs: BatesJob[]): BatesResult[] {
  return jobs.map(planBates);
}

export function renderBatchCsv(results: BatesResult[]): string {
  const lines: string[] = ["job_index,page_count,first_label,last_label"];
  results.forEach((r, i) => {
    const first = r.stamps[0]?.label ?? "";
    const last = r.stamps[r.stamps.length - 1]?.label ?? "";
    lines.push([String(i + 1), String(r.stamps.length), first, last].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BatesResult): string {
  const lines: string[] = [];
  lines.push("Bates Numbering Plan");
  lines.push("====================");
  lines.push(`Total pages: ${r.job.totalPageCount}`);
  lines.push(`Pages stamped: ${r.stamps.length}`);
  lines.push(`Prefix: "${r.job.format.prefix}"`);
  lines.push(`Start number: ${r.job.format.startNumber}`);
  lines.push(`Digits: ${r.job.format.digits}`);
  lines.push(`Suffix: "${r.job.format.suffix}"`);
  lines.push(`Separator: "${r.job.format.separator}"`);
  lines.push(`Position: ${r.job.position}`);
  lines.push(`Font size: ${r.job.fontSizePt} pt`);
  lines.push(`Margin: ${r.job.marginPt} pt`);
  lines.push(`Color: rgb(${r.job.color.r}, ${r.job.color.g}, ${r.job.color.b})`);
  if (r.stamps.length > 0) {
    lines.push(`First stamp: ${r.stamps[0].label} (page ${r.stamps[0].pageIndex + 1})`);
    lines.push(`Last stamp: ${r.stamps[r.stamps.length - 1].label} (page ${r.stamps[r.stamps.length - 1].pageIndex + 1})`);
  }
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  lines.push("");
  lines.push("pdf-lib code:");
  lines.push(r.pdfLibCode);
  return lines.join("\n");
}

export const BATES_PRESETS = [
  { id: "legal-standard", label: "Legal standard (DEF-000001)", format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" } },
  { id: "plain-numeric", label: "Plain numeric (000001)", format: { prefix: "", startNumber: 1, digits: 6, suffix: "", separator: "" } },
  { id: "case-prefixed", label: "Case-prefixed (CASE-001)", format: { prefix: "CASE", startNumber: 1, digits: 3, suffix: "", separator: "-" } },
  { id: "with-suffix", label: "With suffix (000001-X)", format: { prefix: "", startNumber: 1, digits: 6, suffix: "X", separator: "-" } },
];

export function getBatesPresets() {
  return [...BATES_PRESETS];
}

/** Compute the next start number to use after a batch has been stamped. */
export function nextStartNumber(job: BatesJob): number {
  const pages = parsePageRange(job.pageRange, job.totalPageCount);
  return job.format.startNumber + pages.length;
}

/** Validate that two Bates jobs do not overlap on a per-page basis. */
export function detectRangeOverlap(a: BatesJob, b: BatesJob): number[] {
  const aPages = new Set(parsePageRange(a.pageRange, a.totalPageCount));
  const bPages = parsePageRange(b.pageRange, b.totalPageCount);
  return bPages.filter((p) => aPages.has(p));
}
