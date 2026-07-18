import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LCP_GOOD_MS,
  LCP_POOR_MS,
  FID_GOOD_MS,
  FID_POOR_MS,
  CLS_GOOD,
  CLS_POOR,
  INP_GOOD_MS,
  INP_POOR_MS,
  WEIGHTS,
  SIGNAL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  TARGET_PRESETS,
  validateInputs,
  normalizeInputs,
  scoreLcp,
  scoreFid,
  scoreCls,
  scoreInp,
  scoreBoolean,
  computeCwvScore,
  computePageExperienceScore,
  generateRecommendations,
  summarizeStats,
  scoreLabel,
  buildComparison,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PageExperienceInputs,
  type SignalKey,
  type SignalStatus,
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

const goodInputs: PageExperienceInputs = {
  url: "https://example.com/page",
  lcpMs: 2000,
  fidMs: 50,
  cls: 0.05,
  inpMs: 150,
  httpsEnabled: true,
  mobileFriendly: true,
  hasIntrusiveInterstitials: false,
  safeBrowsing: true,
};

describe("page-experience constants", () => {
  it("has correct LCP thresholds", () => {
    expect(LCP_GOOD_MS).toBe(2500);
    expect(LCP_POOR_MS).toBe(4000);
  });
  it("has correct FID thresholds", () => {
    expect(FID_GOOD_MS).toBe(100);
    expect(FID_POOR_MS).toBe(300);
  });
  it("has correct CLS thresholds", () => {
    expect(CLS_GOOD).toBe(0.1);
    expect(CLS_POOR).toBe(0.25);
  });
  it("has correct INP thresholds", () => {
    expect(INP_GOOD_MS).toBe(200);
    expect(INP_POOR_MS).toBe(500);
  });
  it("weights sum to 1", () => {
    const sum = WEIGHTS.cwv + WEIGHTS.https + WEIGHTS.mobileFriendly + WEIGHTS.interstitials + WEIGHTS.safeBrowsing;
    expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
  });
  it("has 8 signal labels", () => {
    expect(Object.keys(SIGNAL_LABELS)).toHaveLength(8);
  });
  it("has 3 status labels", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3);
  });
  it("has 3 status colors", () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(3);
  });
  it("has 3 target presets", () => {
    expect(TARGET_PRESETS).toHaveLength(3);
    expect(TARGET_PRESETS.map((p) => p.key)).toEqual(["good", "great", "perfect"]);
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("HISTORY_KEY is unique", () => {
    expect(HISTORY_KEY).toContain("page-experience-signal-checker");
  });
});

describe("page-experience validateInputs", () => {
  it("validates URL must start with http(s)", () => {
    const e = validateInputs({ url: "example.com" });
    expect(e.url).toBeDefined();
  });
  it("accepts https URL", () => {
    const e = validateInputs({ url: "https://example.com" });
    expect(e.url).toBeUndefined();
  });
  it("accepts empty URL (no validation)", () => {
    const e = validateInputs({ url: "" });
    expect(e.url).toBeUndefined();
  });
  it("rejects negative LCP", () => {
    const e = validateInputs({ lcpMs: -5 });
    expect(e.lcpMs).toBeDefined();
  });
  it("rejects huge LCP", () => {
    const e = validateInputs({ lcpMs: 70000 });
    expect(e.lcpMs).toBeDefined();
  });
  it("rejects negative CLS", () => {
    const e = validateInputs({ cls: -0.1 });
    expect(e.cls).toBeDefined();
  });
  it("accepts valid numbers", () => {
    const e = validateInputs({ lcpMs: 2500, fidMs: 100, cls: 0.1, inpMs: 200 });
    expect(Object.keys(e)).toHaveLength(0);
  });
});

describe("page-experience normalizeInputs", () => {
  it("trims URL", () => {
    expect(normalizeInputs({ url: "  https://x.com  " }).url).toBe("https://x.com");
  });
  it("defaults missing numbers to 0", () => {
    const n = normalizeInputs({});
    expect(n.lcpMs).toBe(0);
    expect(n.fidMs).toBe(0);
    expect(n.cls).toBe(0);
    expect(n.inpMs).toBe(0);
  });
  it("defaults booleans to false", () => {
    const n = normalizeInputs({});
    expect(n.httpsEnabled).toBe(false);
    expect(n.mobileFriendly).toBe(false);
    expect(n.hasIntrusiveInterstitials).toBe(false);
    expect(n.safeBrowsing).toBe(false);
  });
  it("preserves provided booleans", () => {
    const n = normalizeInputs({ httpsEnabled: true, mobileFriendly: true });
    expect(n.httpsEnabled).toBe(true);
    expect(n.mobileFriendly).toBe(true);
  });
});

describe("page-experience scoreLcp", () => {
  it("scores 100 / good when <= 2500ms", () => {
    expect(scoreLcp(2000)).toEqual({ score: 100, status: "good" });
    expect(scoreLcp(2500)).toEqual({ score: 100, status: "good" });
  });
  it("scores 50 / needs-improvement when 2500 < ms <= 4000", () => {
    expect(scoreLcp(2501)).toEqual({ score: 50, status: "needs-improvement" });
    expect(scoreLcp(4000)).toEqual({ score: 50, status: "needs-improvement" });
  });
  it("scores 0 / poor when > 4000ms", () => {
    expect(scoreLcp(4001)).toEqual({ score: 0, status: "poor" });
    expect(scoreLcp(6000)).toEqual({ score: 0, status: "poor" });
  });
});

describe("page-experience scoreFid", () => {
  it("scores 100 / good when <= 100ms", () => {
    expect(scoreFid(50)).toEqual({ score: 100, status: "good" });
    expect(scoreFid(100)).toEqual({ score: 100, status: "good" });
  });
  it("scores 50 / needs-improvement when 100 < ms <= 300", () => {
    expect(scoreFid(150)).toEqual({ score: 50, status: "needs-improvement" });
    expect(scoreFid(300)).toEqual({ score: 50, status: "needs-improvement" });
  });
  it("scores 0 / poor when > 300ms", () => {
    expect(scoreFid(301)).toEqual({ score: 0, status: "poor" });
  });
});

describe("page-experience scoreCls", () => {
  it("scores 100 / good when <= 0.1", () => {
    expect(scoreCls(0.05)).toEqual({ score: 100, status: "good" });
    expect(scoreCls(0.1)).toEqual({ score: 100, status: "good" });
  });
  it("scores 50 / needs-improvement when 0.1 < cls <= 0.25", () => {
    expect(scoreCls(0.15)).toEqual({ score: 50, status: "needs-improvement" });
    expect(scoreCls(0.25)).toEqual({ score: 50, status: "needs-improvement" });
  });
  it("scores 0 / poor when > 0.25", () => {
    expect(scoreCls(0.3)).toEqual({ score: 0, status: "poor" });
  });
});

describe("page-experience scoreInp", () => {
  it("scores 100 / good when <= 200ms", () => {
    expect(scoreInp(150)).toEqual({ score: 100, status: "good" });
    expect(scoreInp(200)).toEqual({ score: 100, status: "good" });
  });
  it("scores 50 / needs-improvement when 200 < ms <= 500", () => {
    expect(scoreInp(250)).toEqual({ score: 50, status: "needs-improvement" });
    expect(scoreInp(500)).toEqual({ score: 50, status: "needs-improvement" });
  });
  it("scores 0 / poor when > 500ms", () => {
    expect(scoreInp(600)).toEqual({ score: 0, status: "poor" });
  });
});

describe("page-experience scoreBoolean", () => {
  it("scores pass as good/100", () => {
    expect(scoreBoolean(true)).toEqual({ score: 100, status: "good" });
  });
  it("scores fail as poor/0", () => {
    expect(scoreBoolean(false)).toEqual({ score: 0, status: "poor" });
  });
});

describe("page-experience computeCwvScore", () => {
  it("averages 4 CWV scores", () => {
    // All good → 100
    expect(computeCwvScore(2000, 50, 0.05, 150)).toBe(100);
  });
  it("averages when mixed", () => {
    // LCP poor (0), FID good (100), CLS good (100), INP good (100) → avg 75
    expect(computeCwvScore(5000, 50, 0.05, 150)).toBe(75);
  });
  it("averages when all poor → 0", () => {
    expect(computeCwvScore(5000, 400, 0.5, 800)).toBe(0);
  });
  it("averages when all needs-improvement → 50", () => {
    expect(computeCwvScore(3000, 200, 0.15, 300)).toBe(50);
  });
});

describe("page-experience computePageExperienceScore", () => {
  it("returns 8 signals", () => {
    const r = computePageExperienceScore(goodInputs);
    expect(r.signals).toHaveLength(8);
  });
  it("perfect inputs → score 100", () => {
    const r = computePageExperienceScore(goodInputs);
    expect(r.pageExperienceScore).toBe(100);
    expect(r.cwvScore).toBe(100);
  });
  it("all-fail inputs → score 0", () => {
    const r = computePageExperienceScore({
      url: "",
      lcpMs: 5000,
      fidMs: 400,
      cls: 0.5,
      inpMs: 800,
      httpsEnabled: false,
      mobileFriendly: false,
      hasIntrusiveInterstitials: true,
      safeBrowsing: false,
    });
    expect(r.pageExperienceScore).toBe(0);
    expect(r.cwvScore).toBe(0);
  });
  it("HTTPS-disabled alone drops 15 points", () => {
    const r = computePageExperienceScore({ ...goodInputs, httpsEnabled: false });
    expect(r.pageExperienceScore).toBe(85);
  });
  it("not-mobile-friendly alone drops 20 points", () => {
    const r = computePageExperienceScore({ ...goodInputs, mobileFriendly: false });
    expect(r.pageExperienceScore).toBe(80);
  });
  it("intrusive interstitials alone drops 15 points", () => {
    const r = computePageExperienceScore({ ...goodInputs, hasIntrusiveInterstitials: true });
    expect(r.pageExperienceScore).toBe(85);
  });
  it("unsafe browsing alone drops 10 points", () => {
    const r = computePageExperienceScore({ ...goodInputs, safeBrowsing: false });
    expect(r.pageExperienceScore).toBe(90);
  });
  it("counts signals correctly", () => {
    const r = computePageExperienceScore(goodInputs);
    expect(r.goodCount).toBe(8);
    expect(r.failedCount).toBe(0);
    expect(r.poorCount).toBe(0);
    expect(r.needsImprovementCount).toBe(0);
  });
  it("attaches recommendation to failed signals", () => {
    const r = computePageExperienceScore({ ...goodInputs, lcpMs: 5000 });
    const lcpSignal = r.signals.find((s) => s.key === "lcp");
    expect(lcpSignal?.recommendation).toBeDefined();
    expect(lcpSignal?.recommendation).toContain("LCP");
  });
  it("uses weight cwv/4 for each CWV signal", () => {
    const r = computePageExperienceScore(goodInputs);
    const lcpSig = r.signals.find((s) => s.key === "lcp");
    expect(lcpSig?.weight).toBeCloseTo(WEIGHTS.cwv / 4, 5);
  });
  it("uses weight 0.15 for https", () => {
    const r = computePageExperienceScore(goodInputs);
    const httpsSig = r.signals.find((s) => s.key === "https");
    expect(httpsSig?.weight).toBeCloseTo(0.15, 5);
  });
  it("displays interstitials as Clean/Intrusive", () => {
    const r1 = computePageExperienceScore({ ...goodInputs, hasIntrusiveInterstitials: false });
    const r2 = computePageExperienceScore({ ...goodInputs, hasIntrusiveInterstitials: true });
    expect(r1.signals.find((s) => s.key === "interstitials")?.displayValue).toBe("Clean");
    expect(r2.signals.find((s) => s.key === "interstitials")?.displayValue).toBe("Intrusive");
  });
});

describe("page-experience generateRecommendations", () => {
  it("returns empty for all-good inputs", () => {
    expect(generateRecommendations(goodInputs)).toEqual([]);
  });
  it("generates LCP recommendation when LCP > 2500", () => {
    const recs = generateRecommendations({ ...goodInputs, lcpMs: 3000 });
    expect(recs.some((r) => r.signal === "lcp")).toBe(true);
  });
  it("marks LCP > 4000 as high severity", () => {
    const recs = generateRecommendations({ ...goodInputs, lcpMs: 5000 });
    expect(recs.find((r) => r.signal === "lcp")?.severity).toBe("high");
  });
  it("marks LCP 2501-4000 as medium severity", () => {
    const recs = generateRecommendations({ ...goodInputs, lcpMs: 3000 });
    expect(recs.find((r) => r.signal === "lcp")?.severity).toBe("medium");
  });
  it("generates HTTPS recommendation when https disabled", () => {
    const recs = generateRecommendations({ ...goodInputs, httpsEnabled: false });
    expect(recs.some((r) => r.signal === "https")).toBe(true);
  });
  it("generates mobileFriendly recommendation when not mobile-friendly", () => {
    const recs = generateRecommendations({ ...goodInputs, mobileFriendly: false });
    expect(recs.some((r) => r.signal === "mobileFriendly")).toBe(true);
  });
  it("generates interstitials recommendation when intrusive", () => {
    const recs = generateRecommendations({ ...goodInputs, hasIntrusiveInterstitials: true });
    expect(recs.some((r) => r.signal === "interstitials")).toBe(true);
  });
  it("generates safeBrowsing recommendation when unsafe", () => {
    const recs = generateRecommendations({ ...goodInputs, safeBrowsing: false });
    expect(recs.some((r) => r.signal === "safeBrowsing")).toBe(true);
  });
  it("sorts high severity first", () => {
    const recs = generateRecommendations({
      url: "",
      lcpMs: 5000,
      fidMs: 50,
      cls: 0.05,
      inpMs: 150,
      httpsEnabled: true,
      mobileFriendly: false,
      hasIntrusiveInterstitials: true,
      safeBrowsing: true,
    });
    expect(recs[0].severity).toBe("high");
  });
});

describe("page-experience scoreLabel", () => {
  it("returns Excellent for >= 90", () => {
    expect(scoreLabel(95)).toBe("Excellent");
    expect(scoreLabel(90)).toBe("Excellent");
  });
  it("returns Good for 75-89", () => {
    expect(scoreLabel(80)).toBe("Good");
    expect(scoreLabel(75)).toBe("Good");
  });
  it("returns Needs work for 50-74", () => {
    expect(scoreLabel(60)).toBe("Needs work");
    expect(scoreLabel(50)).toBe("Needs work");
  });
  it("returns Poor for 25-49", () => {
    expect(scoreLabel(30)).toBe("Poor");
    expect(scoreLabel(25)).toBe("Poor");
  });
  it("returns Critical for < 25", () => {
    expect(scoreLabel(10)).toBe("Critical");
    expect(scoreLabel(0)).toBe("Critical");
  });
});

describe("page-experience summarizeStats", () => {
  it("computes good percent", () => {
    const r = computePageExperienceScore(goodInputs);
    const s = summarizeStats(r);
    expect(s.goodPercent).toBe(100);
    expect(s.failedPercent).toBe(0);
  });
  it("computes failed percent when some fail", () => {
    const r = computePageExperienceScore({ ...goodInputs, httpsEnabled: false });
    const s = summarizeStats(r);
    expect(s.goodPercent).toBe(87.5);
    expect(s.failedPercent).toBe(12.5);
  });
  it("returns null topPriority when all good", () => {
    const r = computePageExperienceScore(goodInputs);
    const s = summarizeStats(r);
    expect(s.topPriority).toBeNull();
  });
  it("returns topPriority when something fails", () => {
    const r = computePageExperienceScore({ ...goodInputs, httpsEnabled: false });
    const s = summarizeStats(r);
    expect(s.topPriority).toContain("HTTPS");
  });
});

describe("page-experience buildComparison", () => {
  it("builds 8 comparison rows", () => {
    const rows = buildComparison(goodInputs, goodInputs);
    expect(rows).toHaveLength(8);
  });
  it("shows dash delta when identical", () => {
    const rows = buildComparison(goodInputs, goodInputs);
    expect(rows.every((r) => r.delta === "—")).toBe(true);
  });
  it("shows positive delta when target is better", () => {
    const bad: PageExperienceInputs = {
      ...goodInputs,
      lcpMs: 5000,
      httpsEnabled: false,
    };
    const rows = buildComparison(bad, goodInputs);
    const cwvRow = rows.find((r) => r.metric === "CWV score");
    expect(cwvRow?.delta).toContain("✓");
  });
  it("includes LCP/FID/CLS/INP rows", () => {
    const rows = buildComparison(goodInputs, goodInputs);
    expect(rows.some((r) => r.metric === "LCP (ms)")).toBe(true);
    expect(rows.some((r) => r.metric === "FID (ms)")).toBe(true);
    expect(rows.some((r) => r.metric === "CLS")).toBe(true);
    expect(rows.some((r) => r.metric === "INP (ms)")).toBe(true);
  });
});

describe("page-experience renderTextReport", () => {
  it("includes URL when provided", () => {
    const r = computePageExperienceScore(goodInputs);
    const recs = generateRecommendations(goodInputs);
    const text = renderTextReport(goodInputs, r, recs);
    expect(text).toContain("URL: https://example.com/page");
  });
  it("includes CWV score and page experience score", () => {
    const r = computePageExperienceScore(goodInputs);
    const text = renderTextReport(goodInputs, r, []);
    expect(text).toContain("CWV score: 100/100");
    expect(text).toContain("Page experience score: 100/100");
  });
  it("includes signal status table", () => {
    const r = computePageExperienceScore(goodInputs);
    const text = renderTextReport(goodInputs, r, []);
    expect(text).toContain("--- Signal status table ---");
    expect(text).toContain("Largest Contentful Paint (LCP)");
  });
  it("shows 'All signals good' message when no recommendations", () => {
    const r = computePageExperienceScore(goodInputs);
    const text = renderTextReport(goodInputs, r, []);
    expect(text).toContain("All page experience signals are good");
  });
  it("lists recommendations when present", () => {
    const bad: PageExperienceInputs = { ...goodInputs, lcpMs: 5000, httpsEnabled: false };
    const r = computePageExperienceScore(bad);
    const recs = generateRecommendations(bad);
    const text = renderTextReport(bad, r, recs);
    expect(text).toContain("[HIGH]");
    expect(text).toContain("LCP");
  });
});

describe("page-experience renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(computePageExperienceScore(goodInputs));
    expect(csv).toContain("signal,value,score,status,weight");
  });
  it("renders 8 signal rows", () => {
    const csv = renderCsv(computePageExperienceScore(goodInputs));
    const lines = csv.split("\n");
    expect(lines).toHaveLength(9); // 1 header + 8 signals
  });
  it("includes label text in CSV", () => {
    const csv = renderCsv(computePageExperienceScore(goodInputs));
    expect(csv).toContain("Largest Contentful Paint (LCP)");
  });
  it("escapes fields containing commas", () => {
    // Build a fake result with a label that has a comma to verify escaping
    const fakeResult = {
      signals: [{
        key: "lcp" as SignalKey,
        label: "LCP, Largest Contentful Paint",
        value: 2000,
        displayValue: "2000 ms",
        score: 100,
        status: "good" as SignalStatus,
        weight: 0.1,
      }],
      cwvScore: 100,
      pageExperienceScore: 100,
      goodCount: 1,
      needsImprovementCount: 0,
      poorCount: 0,
      failedCount: 0,
    };
    const csv = renderCsv(fakeResult);
    expect(csv).toContain('"LCP, Largest Contentful Paint"');
  });
});

describe("page-experience history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      url: "https://example.com",
      cwvScore: 80,
      pageExperienceScore: 75,
      goodCount: 6,
      failedCount: 2,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].url).toBe("https://example.com");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        url: `https://example.com/${i}`,
        cwvScore: 80,
        pageExperienceScore: 75,
        goodCount: 6,
        failedCount: 2,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      url: "x",
      cwvScore: 50,
      pageExperienceScore: 50,
      goodCount: 4,
      failedCount: 4,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("page-experience shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(goodInputs);
    expect(url).toContain("lcp=2000");
    expect(url).toContain("cls=0.05");
    expect(url).toContain("https=1");
    expect(url).toContain("inter=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(goodInputs);
    // Extract the hash portion (after #)
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.lcpMs).toBe(2000);
    expect(parsed.cls).toBe(0.05);
    expect(parsed.httpsEnabled).toBe(true);
    expect(parsed.hasIntrusiveInterstitials).toBe(false);
    expect(parsed.safeBrowsing).toBe(true);
    expect(parsed.url).toBe("https://example.com/page");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles hash without #", () => {
    const parsed = parseShareUrl("lcp=3000&https=0");
    expect(parsed.lcpMs).toBe(3000);
    expect(parsed.httpsEnabled).toBe(false);
  });
  it("encodes intrusive interstitials as 1", () => {
    const url = buildShareUrl({ ...goodInputs, hasIntrusiveInterstitials: true });
    expect(url).toContain("inter=1");
  });
});

// Suppress unused-import lint
export type _Unused = SignalKey | SignalStatus;
