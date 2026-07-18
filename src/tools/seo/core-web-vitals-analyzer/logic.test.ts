import { describe, it, expect, beforeEach } from "vitest";
import {
  THRESHOLDS,
  metricRecommendation,
  scoreMetric,
  parsePageSpeedJson,
  analyze,
  renderReport,
  renderCsv,
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

describe("core-web-vitals-analyzer THRESHOLDS", () => {
  it("has LCP threshold", () => {
    expect(THRESHOLDS.LCP.good).toBe(2500);
    expect(THRESHOLDS.LCP.poor).toBe(4000);
  });
  it("has INP threshold", () => {
    expect(THRESHOLDS.INP.good).toBe(200);
    expect(THRESHOLDS.INP.poor).toBe(500);
  });
  it("has CLS threshold", () => {
    expect(THRESHOLDS.CLS.good).toBe(0.1);
    expect(THRESHOLDS.CLS.poor).toBe(0.25);
  });
  it("has FID threshold (deprecated)", () => {
    expect(THRESHOLDS.FID.good).toBe(100);
  });
});

describe("core-web-vitals-analyzer metricRecommendation", () => {
  it("returns positive message for good", () => {
    expect(metricRecommendation("LCP", "good")).toContain("Good");
  });
  it("returns missing message for missing", () => {
    expect(metricRecommendation("LCP", "missing")).toContain("not reported");
  });
  it("returns needs-improvement advice", () => {
    const r = metricRecommendation("LCP", "needs-improvement");
    expect(r).toContain("needs work");
  });
  it("returns poor advice with critical language", () => {
    const r = metricRecommendation("CLS", "poor");
    expect(r.toLowerCase()).toContain("critical");
  });
});

describe("core-web-vitals-analyzer scoreMetric", () => {
  it("scores LCP good when ≤2500", () => {
    const m = scoreMetric("LCP", 2000);
    expect(m.rating).toBe("good");
    expect(m.displayValue).toContain("s");
  });
  it("scores LCP needs-improvement when 2501-4000", () => {
    const m = scoreMetric("LCP", 3000);
    expect(m.rating).toBe("needs-improvement");
  });
  it("scores LCP poor when >4000", () => {
    const m = scoreMetric("LCP", 5000);
    expect(m.rating).toBe("poor");
  });
  it("scores CLS good when ≤0.1", () => {
    const m = scoreMetric("CLS", 0.05);
    expect(m.rating).toBe("good");
  });
  it("scores CLS poor when >0.25", () => {
    const m = scoreMetric("CLS", 0.3);
    expect(m.rating).toBe("poor");
  });
  it("scores INP good when ≤200", () => {
    const m = scoreMetric("INP", 150);
    expect(m.rating).toBe("good");
  });
});

describe("core-web-vitals-analyzer parsePageSpeedJson", () => {
  it("parses a valid lighthouseResult JSON", () => {
    const json = JSON.stringify({
      lighthouseResult: {
        finalUrl: "https://example.com",
        fetchTime: "2025-01-01T00:00:00.000Z",
        configSettings: { formFactor: "mobile" },
        audits: {
          "largest-contentful-paint": { numericValue: 2000 },
          "cumulative-layout-shift": { numericValue: 0.05 },
        },
      },
    });
    const { audits, url, fetchedAt, strategy, errors } = parsePageSpeedJson(json);
    expect(errors).toHaveLength(0);
    expect(url).toBe("https://example.com");
    expect(fetchedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(strategy).toBe("mobile");
    expect(audits["largest-contentful-paint"].numericValue).toBe(2000);
  });
  it("handles flat structure (no lighthouseResult wrapper)", () => {
    const json = JSON.stringify({
      audits: { "first-contentful-paint": { numericValue: 1500 } },
    });
    const { audits, errors } = parsePageSpeedJson(json);
    expect(errors).toHaveLength(0);
    expect(audits["first-contentful-paint"].numericValue).toBe(1500);
  });
  it("returns error for invalid JSON", () => {
    const { errors } = parsePageSpeedJson("not json");
    expect(errors.length).toBeGreaterThan(0);
  });
  it("returns error for empty input", () => {
    const { errors } = parsePageSpeedJson("");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("core-web-vitals-analyzer analyze", () => {
  it("returns null result on errors", () => {
    const { result, errors } = analyze("");
    expect(result).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
  it("analyzes a valid PageSpeed JSON", () => {
    const json = JSON.stringify({
      lighthouseResult: {
        finalUrl: "https://example.com",
        audits: {
          "largest-contentful-paint": { numericValue: 2000 },
          "interaction-to-next-paint": { numericValue: 150 },
          "cumulative-layout-shift": { numericValue: 0.05 },
          "first-contentful-paint": { numericValue: 1500 },
          "server-response-time": { numericValue: 500 },
        },
      },
    });
    const { result, errors } = analyze(json);
    expect(errors).toHaveLength(0);
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://example.com");
    expect(result!.passCount).toBeGreaterThan(0);
    expect(result!.missingCount).toBeGreaterThanOrEqual(0);
  });
  it("marks missing metrics as missing", () => {
    const json = JSON.stringify({
      audits: { "largest-contentful-paint": { numericValue: 2000 } },
    });
    const { result } = analyze(json);
    expect(result).not.toBeNull();
    const cls = result!.metrics.find((m) => m.name === "CLS");
    expect(cls?.rating).toBe("missing");
  });
  it("computes overall score", () => {
    const json = JSON.stringify({
      audits: {
        "largest-contentful-paint": { numericValue: 2000 }, // good
        "interaction-to-next-paint": { numericValue: 150 }, // good
        "cumulative-layout-shift": { numericValue: 0.05 }, // good
      },
    });
    const { result } = analyze(json);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(50);
  });
  it("generates recommendations for poor metrics", () => {
    const json = JSON.stringify({
      audits: {
        "largest-contentful-paint": { numericValue: 5000 }, // poor
        "cumulative-layout-shift": { numericValue: 0.3 }, // poor
      },
    });
    const { result } = analyze(json);
    expect(result).not.toBeNull();
    expect(result!.recommendations.length).toBeGreaterThan(0);
  });
});

describe("core-web-vitals-analyzer renderReport", () => {
  it("produces human-readable report", () => {
    const json = JSON.stringify({
      audits: { "largest-contentful-paint": { numericValue: 2000 } },
    });
    const { result } = analyze(json);
    const report = renderReport(result!);
    expect(report).toContain("Core Web Vitals Report");
    expect(report).toContain("Largest Contentful Paint");
  });
});

describe("core-web-vitals-analyzer renderCsv", () => {
  it("produces CSV with metric rows", () => {
    const json = JSON.stringify({
      audits: { "largest-contentful-paint": { numericValue: 2000 } },
    });
    const { result } = analyze(json);
    const csv = renderCsv(result!);
    expect(csv).toContain("LCP");
    expect(csv).toContain("good");
  });
});

describe("core-web-vitals-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, url: "https://example.com", score: 85, rating: "good", passCount: 3, warnCount: 1, failCount: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, url: "x", score: 50, rating: "needs-improvement", passCount: 1, warnCount: 1, failCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, url: "x", score: 50, rating: "good", passCount: 1, warnCount: 0, failCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("core-web-vitals-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl('{"audits":{}}');
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=%7B%7D");
    expect(parsed.data).toBe("{}");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});
