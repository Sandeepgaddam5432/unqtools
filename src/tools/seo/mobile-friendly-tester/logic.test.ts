import { describe, it, expect, beforeEach } from "vitest";
import {
  extractViewport,
  checkViewport,
  extractFontSizes,
  checkFontSizes,
  countTapTargets,
  checkTapTargets,
  checkResponsiveImages,
  checkContentWidth,
  analyze,
  renderReport,
  DEVICE_DIMENSIONS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("mobile-friendly-tester DEVICE_DIMENSIONS", () => {
  it("includes common devices", () => {
    const names = DEVICE_DIMENSIONS.map((d) => d.name);
    expect(names.some((n) => /iPhone/.test(n))).toBe(true);
    expect(names.some((n) => /Samsung/.test(n))).toBe(true);
    expect(names.some((n) => /iPad/.test(n))).toBe(true);
  });
});

describe("mobile-friendly-tester extractViewport", () => {
  it("extracts content from viewport meta", () => {
    const html = `<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>`;
    const { content } = extractViewport(html);
    expect(content).toBe("width=device-width, initial-scale=1");
  });
  it("handles single quotes", () => {
    const html = `<meta name='viewport' content='width=device-width'>`;
    const { content } = extractViewport(html);
    expect(content).toBe("width=device-width");
  });
  it("returns null when missing", () => {
    const html = `<meta name="description" content="hello">`;
    expect(extractViewport(html).content).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(extractViewport("").content).toBeNull();
  });
});

describe("mobile-friendly-tester checkViewport", () => {
  it("passes for width=device-width, initial-scale=1", () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1">`;
    const c = checkViewport(html);
    expect(c.rating).toBe("pass");
  });
  it("warns for incomplete viewport", () => {
    const html = `<meta name="viewport" content="width=device-width">`;
    const c = checkViewport(html);
    expect(c.rating).toBe("warn");
  });
  it("fails for missing viewport", () => {
    const c = checkViewport("<html></html>");
    expect(c.rating).toBe("fail");
  });
  it("fails for non-standard viewport", () => {
    const html = `<meta name="viewport" content="width=320">`;
    const c = checkViewport(html);
    expect(c.rating).toBe("fail");
  });
});

describe("mobile-friendly-tester extractFontSizes", () => {
  it("extracts inline font-size declarations", () => {
    const html = `<div style="font-size: 14px">x</div><span style="font-size:18px">y</span>`;
    const sizes = extractFontSizes(html);
    expect(sizes).toContain(14);
    expect(sizes).toContain(18);
  });
  it("returns empty when no font-sizes", () => {
    expect(extractFontSizes("<div>x</div>")).toEqual([]);
  });
});

describe("mobile-friendly-tester checkFontSizes", () => {
  it("passes when all sizes ≥16px", () => {
    const html = `<div style="font-size: 16px">x</div><span style="font-size:18px">y</span>`;
    const c = checkFontSizes(html);
    expect(c.rating).toBe("pass");
  });
  it("fails when sizes below 12px", () => {
    const html = `<div style="font-size: 10px">x</div>`;
    const c = checkFontSizes(html);
    expect(c.rating).toBe("fail");
  });
  it("warns when most sizes are 12-16px", () => {
    const html = `<div style="font-size: 14px">x</div><span style="font-size:14px">y</span>`;
    const c = checkFontSizes(html);
    expect(c.rating).toBe("warn");
  });
  it("warns when no font-sizes found", () => {
    const c = checkFontSizes("<div>x</div>");
    expect(c.rating).toBe("warn");
  });
});

describe("mobile-friendly-tester countTapTargets", () => {
  it("counts <a> and <button>", () => {
    const html = `<a href="#">x</a><button>y</button><a href="#">z</a>`;
    expect(countTapTargets(html)).toBe(3);
  });
  it("returns 0 for empty input", () => {
    expect(countTapTargets("")).toBe(0);
  });
});

describe("mobile-friendly-tester checkTapTargets", () => {
  it("warns when no tap targets", () => {
    const c = checkTapTargets("<div>x</div>");
    expect(c.rating).toBe("warn");
  });
  it("warns when small explicit sizes", () => {
    const html = `<a href="#" width="20" height="20">x</a>`;
    const c = checkTapTargets(html);
    expect(c.rating).toBe("warn");
  });
  it("passes when no small explicit sizes", () => {
    const html = `<a href="#" width="48" height="48">x</a>`;
    const c = checkTapTargets(html);
    expect(c.rating).toBe("pass");
  });
});

describe("mobile-friendly-tester checkResponsiveImages", () => {
  it("passes when all images have srcset + sizes", () => {
    const html = `<img src="x.jpg" srcset="x.jpg 1x, x@2x.jpg 2x" sizes="100vw">`;
    const c = checkResponsiveImages(html);
    expect(c.rating).toBe("pass");
  });
  it("warns when some images have srcset", () => {
    const html = `<img src="x.jpg" srcset="x.jpg 1x"><img src="y.jpg">`;
    const c = checkResponsiveImages(html);
    expect(c.rating).toBe("warn");
  });
  it("fails when no images have srcset/sizes/picture", () => {
    const html = `<img src="x.jpg"><img src="y.jpg">`;
    const c = checkResponsiveImages(html);
    expect(c.rating).toBe("fail");
  });
  it("warns when no images at all", () => {
    const c = checkResponsiveImages("<div>text</div>");
    expect(c.rating).toBe("warn");
  });
});

describe("mobile-friendly-tester checkContentWidth", () => {
  it("fails when fixed width >980px", () => {
    const html = `<div style="width: 1200px">x</div>`;
    const c = checkContentWidth(html);
    expect(c.rating).toBe("fail");
  });
  it("passes when all widths ≤980px", () => {
    const html = `<div style="width: 800px">x</div>`;
    const c = checkContentWidth(html);
    expect(c.rating).toBe("pass");
  });
  it("passes when no widths", () => {
    const c = checkContentWidth("<div>x</div>");
    expect(c.rating).toBe("pass");
  });
});

describe("mobile-friendly-tester analyze", () => {
  it("returns a result with all 5 checks", () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1"><div style="font-size:16px"><a href="#" width="48" height="48">x</a></div>`;
    const r = analyze(html);
    expect(r.checks).toHaveLength(5);
    expect(r.score).toBeGreaterThan(0);
    expect(r.passCount + r.warnCount + r.failCount).toBe(5);
  });
  it("fails overall when viewport missing", () => {
    const r = analyze("<html></html>");
    expect(r.failCount).toBeGreaterThan(0);
  });
  it("passes overall when fully mobile-friendly", () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1">
      <div style="font-size:16px">
        <a href="#" width="48" height="48">x</a>
        <img src="x.jpg" srcset="x.jpg 1x, x@2x.jpg 2x" sizes="100vw">
      </div>`;
    const r = analyze(html);
    expect(r.rating).toBe("pass");
  });
  it("generates recommendations for non-pass checks", () => {
    const r = analyze("<html></html>");
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it("extracts viewport content", () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1">`;
    const r = analyze(html);
    expect(r.hasViewport).toBe(true);
    expect(r.viewportContent).toContain("width=device-width");
  });
});

describe("mobile-friendly-tester renderReport", () => {
  it("produces human-readable report", () => {
    const r = analyze("<html></html>");
    const report = renderReport(r);
    expect(report).toContain("Mobile-Friendly Test Report");
    expect(report).toContain("Score:");
  });
});

describe("mobile-friendly-tester history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, score: 85, rating: "pass", passCount: 4, warnCount: 1, failCount: 0, hasViewport: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, score: 50, rating: "warn", passCount: 1, warnCount: 2, failCount: 1, hasViewport: false });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, score: 50, rating: "warn", passCount: 1, warnCount: 1, failCount: 1, hasViewport: false });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mobile-friendly-tester shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<html></html>");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=%3Chtml%3E");
    expect(parsed.data).toBe("<html>");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});
