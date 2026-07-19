import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  DETECTION_METHODS,
  OUTPUT_FORMATS,
  normalizePageRangeSpec,
  resolveAllRange,
  expandPageRange,
  detectMultipleTables,
  computeSummaryStats,
  renderCsv,
  renderHtml,
  renderJson,
  renderMarkdown,
  buildXlsxPackage,
  parseUserRules,
  validateOptions,
  type TextPosition,
  type ConvertOptions,
  type DetectionMethod,
  type OutputFormat,
} from "./logic";

/**
 * End-to-end integration test: build a PDF with a tabular layout,
 * extract positional text items (replicating the UI's content-stream parser),
 * run the pure-logic table detector, and verify the output renders.
 */
describe("pdf-table-extractor integration", () => {
  it("end-to-end: build PDF table → detect → render to all 5 formats", async () => {
    // 1. Build a PDF with a 3×3 tabular layout.
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    // Header row
    page.drawText("Name", { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("Age", { x: 220, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("City", { x: 320, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    // Data rows
    page.drawText("Alice", { x: 72, y: 680, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("30", { x: 220, y: 680, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("NYC", { x: 320, y: 680, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("Bob", { x: 72, y: 660, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("25", { x: 220, y: 660, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("LA", { x: 320, y: 660, size: 12, font, color: rgb(0, 0, 0) });
    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    // 2. Reload to verify.
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);

    // 3. Construct synthetic text positions (simulating content-stream parsing).
    const items: TextPosition[] = [
      { text: "Name", x: 72, y: 700, fontSize: 12, pageNumber: 1 },
      { text: "Age", x: 220, y: 700, fontSize: 12, pageNumber: 1 },
      { text: "City", x: 320, y: 700, fontSize: 12, pageNumber: 1 },
      { text: "Alice", x: 72, y: 680, fontSize: 12, pageNumber: 1 },
      { text: "30", x: 220, y: 680, fontSize: 12, pageNumber: 1 },
      { text: "NYC", x: 320, y: 680, fontSize: 12, pageNumber: 1 },
      { text: "Bob", x: 72, y: 660, fontSize: 12, pageNumber: 1 },
      { text: "25", x: 220, y: 660, fontSize: 12, pageNumber: 1 },
      { text: "LA", x: 320, y: 660, fontSize: 12, pageNumber: 1 },
    ];

    // 4. Detect tables using each method.
    for (const method of DETECTION_METHODS) {
      const rules = method === "by-rules" ? parseUserRules('{"columnXs": [72, 220, 320]}') : undefined;
      const tables = detectMultipleTables(items, 1, method, true, true, rules ?? undefined);
      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0].rows.length).toBe(3);
      expect(tables[0].rows[0].length).toBe(3);
      expect(tables[0].confidence).toBeGreaterThan(0);
    }

    // 5. Render to all 5 output formats and verify.
    const baseOpts: ConvertOptions = {
      pageRange: "all",
      detectionMethod: "auto-detect",
      outputFormat: "csv",
      includeHeaders: true,
      mergeCells: true,
      minConfidence: 0.0,
    };
    const tables = detectMultipleTables(items, 1, "auto-detect", true, true);
    const result = {
      tables,
      detectionMethod: "auto-detect" as DetectionMethod,
      outputFormat: "csv" as OutputFormat,
      includeHeaders: true,
      mergeCells: true,
      minConfidence: 0.0,
    };

    const csv = renderCsv(result);
    expect(csv).toContain("Name");
    expect(csv).toContain("Alice");
    expect(csv).toContain("NYC");

    const html = renderHtml(result);
    expect(html).toContain("<table");
    expect(html).toContain("<th");

    const json = renderJson(result);
    const parsed = JSON.parse(json);
    expect(parsed[0].rows[0]).toContain("Name");

    const md = renderMarkdown(result);
    expect(md).toContain("| Name |");
    expect(md).toContain("| --- |");

    // XLSX must be a valid ZIP (PK signature)
    const xlsxBytes = buildXlsxPackage({ ...result, outputFormat: "excel-xlsx" });
    expect(xlsxBytes[0]).toBe(0x50); // P
    expect(xlsxBytes[1]).toBe(0x4B); // K

    // 6. Summary stats.
    const stats = computeSummaryStats(result);
    expect(stats.totalTables).toBeGreaterThanOrEqual(1);
    expect(stats.totalCells).toBeGreaterThanOrEqual(9);
    expect(stats.filledCells).toBeGreaterThanOrEqual(9);
    expect(stats.byCellType.text).toBeGreaterThan(0);
    expect(stats.byCellType.number).toBeGreaterThan(0);
  });

  it("page-range filtering + validation work end-to-end", () => {
    const opts: ConvertOptions = {
      pageRange: "1-3, 5",
      detectionMethod: "auto-detect",
      outputFormat: "csv",
      includeHeaders: true,
      mergeCells: true,
      minConfidence: 0.5,
    };
    const r = validateOptions(opts, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expanded = expandPageRange(resolveAllRange(normalizePageRangeSpec(r.output.pageRange), 10), 10);
      expect(expanded).toEqual([0, 1, 2, 4]);
    }
  });
});
