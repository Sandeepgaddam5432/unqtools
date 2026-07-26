import { describe, it, expect } from "vitest";
import {
  getGridPositions, getGridPosition, parsePageRange, formatBatesLabel, planBates, planBatch,
  renderBatchCsv, renderReport, getBatesPresets, nextStartNumber, detectRangeOverlap,
  type BatesJob,
} from "./logic";

describe("bates-numbering-tool getGridPositions", () => {
  it("returns 9 positions", () => {
    expect(getGridPositions().length).toBe(9);
  });
  it("finds bottom-right position", () => {
    expect(getGridPosition("bottom-right")?.xAlign).toBe(1);
    expect(getGridPosition("bottom-right")?.yAlign).toBe(0);
  });
});

describe("bates-numbering-tool parsePageRange", () => {
  it("returns all pages for empty range", () => {
    expect(parsePageRange("", 5).length).toBe(5);
  });
  it("parses single pages and ranges", () => {
    const r = parsePageRange("1-3, 5, 7-8", 10);
    expect(r).toEqual([0, 1, 2, 4, 6, 7]);
  });
  it("clamps to totalPageCount", () => {
    const r = parsePageRange("1-100", 5);
    expect(r).toEqual([0, 1, 2, 3, 4]);
  });
  it("ignores invalid entries", () => {
    const r = parsePageRange("abc, 2, xyz", 5);
    expect(r).toEqual([1]);
  });
});

describe("bates-numbering-tool formatBatesLabel", () => {
  it("formats with prefix, separator, and digits", () => {
    const label = formatBatesLabel({ prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" }, 42);
    expect(label).toBe("DEF-000042");
  });
  it("formats with suffix", () => {
    const label = formatBatesLabel({ prefix: "", startNumber: 1, digits: 6, suffix: "X", separator: "-" }, 7);
    expect(label).toBe("000007-X");
  });
  it("handles empty format", () => {
    const label = formatBatesLabel({ prefix: "", startNumber: 1, digits: 4, suffix: "", separator: "" }, 5);
    expect(label).toBe("0005");
  });
});

describe("bates-numbering-tool planBates", () => {
  const job: BatesJob = {
    format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" },
    position: "bottom-right", fontSizePt: 10, marginPt: 36,
    color: { r: 0, g: 0, b: 0 }, pageRange: "1-5", totalPageCount: 10,
  };
  it("produces 5 stamps for first 5 pages", () => {
    const r = planBates(job);
    expect(r.stamps.length).toBe(5);
    expect(r.stamps[0].label).toBe("DEF-000001");
    expect(r.stamps[4].label).toBe("DEF-000005");
  });
  it("includes pdf-lib code", () => {
    const r = planBates(job);
    expect(r.pdfLibCode).toContain("PDFDocument");
    expect(r.pdfLibCode).toContain("drawText");
  });
  it("warns on bad digits", () => {
    const r = planBates({ ...job, format: { ...job.format, digits: 0 } });
    expect(r.warnings.some((w) => w.includes("Digits"))).toBe(true);
  });
  it("warns on bad color", () => {
    const r = planBates({ ...job, color: { r: 5, g: 0, b: 0 } });
    expect(r.warnings.some((w) => w.includes("Red"))).toBe(true);
  });
  it("warns when no pages match range", () => {
    const r = planBates({ ...job, pageRange: "abc" });
    expect(r.warnings.some((w) => w.includes("No pages matched"))).toBe(true);
  });
  it("notes skipped pages", () => {
    const r = planBates({ ...job, pageRange: "1-3" });
    expect(r.notes.some((n) => n.includes("skipped"))).toBe(true);
  });
});

describe("bates-numbering-tool planBatch / renderBatchCsv", () => {
  it("plans multiple jobs", () => {
    const job: BatesJob = {
      format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-3", totalPageCount: 10,
    };
    const rs = planBatch([job, { ...job, pageRange: "4-6" }]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV with header", () => {
    const job: BatesJob = {
      format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-3", totalPageCount: 10,
    };
    const csv = renderBatchCsv(planBatch([job]));
    expect(csv.split("\n")[0]).toContain("job_index");
    expect(csv.split("\n")[1]).toContain("DEF-000001");
  });
});

describe("bates-numbering-tool renderReport", () => {
  it("renders report with stamps", () => {
    const r = renderReport(planBates({
      format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-3", totalPageCount: 10,
    }));
    expect(r).toContain("Bates Numbering Plan");
    expect(r).toContain("DEF-000001");
    expect(r).toContain("pdf-lib");
  });
});

describe("bates-numbering-tool getBatesPresets", () => {
  it("returns 4 presets", () => {
    expect(getBatesPresets().length).toBe(4);
  });
});

describe("bates-numbering-tool nextStartNumber", () => {
  it("computes next start number after batch", () => {
    const job: BatesJob = {
      format: { prefix: "DEF", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-5", totalPageCount: 10,
    };
    expect(nextStartNumber(job)).toBe(6);
  });
});

describe("bates-numbering-tool detectRangeOverlap", () => {
  it("detects overlapping pages", () => {
    const a: BatesJob = {
      format: { prefix: "A", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-5", totalPageCount: 10,
    };
    const b: BatesJob = { ...a, pageRange: "3-7" };
    const overlap = detectRangeOverlap(a, b);
    expect(overlap).toEqual([2, 3, 4]);
  });
  it("returns empty for non-overlapping", () => {
    const a: BatesJob = {
      format: { prefix: "A", startNumber: 1, digits: 6, suffix: "", separator: "-" },
      position: "bottom-right", fontSizePt: 10, marginPt: 36, color: { r: 0, g: 0, b: 0 },
      pageRange: "1-3", totalPageCount: 10,
    };
    const b: BatesJob = { ...a, pageRange: "5-7" };
    expect(detectRangeOverlap(a, b)).toEqual([]);
  });
});
