import { describe, expect, it } from "vitest";
import {
  htmlToPdf,
  resolvePageSize,
  mmToPt,
  planSlices,
  HTML_PAGE_SIZES,
} from "./logic";

describe("resolvePageSize", () => {
  it("returns portrait A4 by default", () => {
    const { width, height } = resolvePageSize("a4", "portrait");
    expect(width).toBeLessThan(height);
    expect(width).toBe(HTML_PAGE_SIZES.a4[0]);
    expect(height).toBe(HTML_PAGE_SIZES.a4[1]);
  });

  it("flips for landscape", () => {
    const { width, height } = resolvePageSize("a4", "landscape");
    expect(width).toBeGreaterThan(height);
  });

  it("supports letter and a5", () => {
    expect(resolvePageSize("letter", "portrait").height).toBe(HTML_PAGE_SIZES.letter[1]);
    expect(resolvePageSize("a5", "portrait").width).toBe(HTML_PAGE_SIZES.a5[0]);
  });
});

describe("mmToPt", () => {
  it("converts millimetres to points", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 1);
    expect(mmToPt(0)).toBe(0);
  });

  it("clamps to sane bounds", () => {
    expect(mmToPt(200)).toBeCloseTo((40 * 72) / 25.4, 1);
    expect(mmToPt(-5)).toBe(0);
  });
});

describe("planSlices", () => {
  it("computes page count for tall content", () => {
    // content 1000px wide; A4 content height ≈ 770pt, so a 3000px-tall render
    // scales to ~ (770/1000)*3000 = 2310pt → 3 pages.
    const plan = planSlices(3000, 1000, { pageSize: "a4", orientation: "portrait", marginMm: 15 });
    expect(plan.pages).toBeGreaterThanOrEqual(3);
    expect(plan.pageW).toBe(HTML_PAGE_SIZES.a4[0]);
    expect(plan.contentW).toBeLessThan(plan.pageW);
    expect(plan.margin).toBeGreaterThan(0);
  });

  it("single page for short content", () => {
    const plan = planSlices(400, 800, {});
    expect(plan.pages).toBe(1);
  });

  it("respects larger margins → smaller content area per page", () => {
    const tight = planSlices(3000, 1000, { marginMm: 10 });
    const loose = planSlices(3000, 1000, { marginMm: 30 });
    expect(loose.contentW).toBeLessThan(tight.contentW);
    expect(loose.contentH).toBeLessThan(tight.contentH);
    expect(loose.margin).toBeGreaterThan(tight.margin);
  });
});

describe("htmlToPdf validation", () => {
  it("rejects empty HTML", async () => {
    const r = await htmlToPdf("   ", {});
    expect(r.ok).toBe(false);
  });

  it("returns browser-required error in Node", async () => {
    const r = await htmlToPdf("<p>hi</p>", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/browser/i);
  });
});
