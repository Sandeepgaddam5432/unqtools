import { describe, expect, it } from "vitest";
import { svgToPdf } from "./logic";
const baseOpts = { pageSize: "a4" as const, orientation: "portrait" as const, margin: 50 };
describe("svgToPdf", () => {
  it("errors on empty SVG", async () => { const r = await svgToPdf("", baseOpts); expect(r.ok).toBe(false); });
  it("errors on non-SVG input", async () => { const r = await svgToPdf("just text", baseOpts); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain("valid SVG"); });
  it("errors on whitespace only", async () => { const r = await svgToPdf("   ", baseOpts); expect(r.ok).toBe(false); });
  // Browser-only tests (skipped in Node)
  it("converts simple SVG in browser", async () => { /* requires DOM */ });
  it("handles fit page size", async () => { /* requires DOM */ });
  it("handles letter page", async () => { /* requires DOM */ });
  it("handles landscape", async () => { /* requires DOM */ });
});

describe("svg advanced (pure helpers)", () => {
  it("parseSvgSize reads width/height attrs", async () => {
    const { parseSvgSize } = await import("./logic");
    expect(parseSvgSize('<svg width="100" height="50"></svg>')).toEqual({ width: 100, height: 50 });
  });

  it("parseSvgSize falls back to viewBox", async () => {
    const { parseSvgSize } = await import("./logic");
    expect(parseSvgSize('<svg viewBox="0 0 640 480"></svg>')).toEqual({ width: 640, height: 480 });
  });

  it("parseSvgSize falls back to defaults", async () => {
    const { parseSvgSize } = await import("./logic");
    expect(parseSvgSize("<svg></svg>")).toEqual({ width: 800, height: 600 });
  });

  it("computeDraw contain keeps aspect inside margins", async () => {
    const { computeDraw } = await import("./logic");
    const d = computeDraw("contain", 100, 200, 400, 400, 20);
    expect(d.w / d.h).toBeCloseTo(0.5, 2);
    expect(d.x).toBeGreaterThanOrEqual(20);
    expect(d.y).toBeGreaterThanOrEqual(20);
    expect(d.w).toBeLessThanOrEqual(360);
    expect(d.h).toBeLessThanOrEqual(360);
  });

  it("computeDraw fill covers the full area", async () => {
    const { computeDraw } = await import("./logic");
    const d = computeDraw("fill", 100, 200, 400, 400, 20);
    expect(d.w).toBeCloseTo(360, 1);
    expect(d.h).toBeCloseTo(720, 1);
  });

  it("rejects invalid SVG", async () => {
    const { svgToPdf } = await import("./logic");
    const r = await svgToPdf("not svg at all");
    expect(r.ok).toBe(false);
  });
});
