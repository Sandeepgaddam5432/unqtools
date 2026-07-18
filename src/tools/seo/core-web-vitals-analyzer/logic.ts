/**
 * Core Web Vitals Analyzer — pure logic.
 *
 * Parse PageSpeed Insights JSON, extract LCP/FID/CLS/INP/TTFB/FCP metrics,
 * score against thresholds, generate pass/warn/fail + recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

export type Rating = "good" | "needs-improvement" | "poor" | "missing";

export interface MetricResult {
  name: string;
  label: string;
  value: number;
  unit: string;
  displayValue: string;
  rating: Rating;
  threshold: { good: number; poor: number };
  description: string;
  recommendation: string;
}

export interface AnalysisResult {
  url: string;
  metrics: MetricResult[];
  score: number; // 0-100
  rating: Rating;
  passCount: number;
  warnCount: number;
  failCount: number;
  missingCount: number;
  recommendations: string[];
  fetchedAt: string | null;
  strategy: string | null;
}

/** Thresholds based on Google's official Core Web Vitals thresholds. */
export const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, unit: "ms", label: "Largest Contentful Paint", description: "Time until the largest visible element renders." },
  INP: { good: 200, poor: 500, unit: "ms", label: "Interaction to Next Paint", description: "Responsiveness to user input." },
  FID: { good: 100, poor: 300, unit: "ms", label: "First Input Delay", description: "Time from first user input to browser response. (Deprecated — use INP.)" },
  CLS: { good: 0.1, poor: 0.25, unit: "", label: "Cumulative Layout Shift", description: "Visual stability — how much the page shifts during load." },
  FCP: { good: 1800, poor: 3000, unit: "ms", label: "First Contentful Paint", description: "Time until the first text/image is painted." },
  TTFB: { good: 800, poor: 1800, unit: "ms", label: "Time to First Byte", description: "Time until the first byte of the response is received." },
  TBT: { good: 200, poor: 600, unit: "ms", label: "Total Blocking Time", description: "Sum of all long-task blocking times." },
  SI: { good: 3400, poor: 5800, unit: "ms", label: "Speed Index", description: "How quickly content is visually displayed." },
} as const;

export type MetricKey = keyof typeof THRESHOLDS;

const METRIC_AUDIT_NAMES: Record<MetricKey, string[]> = {
  LCP: ["largest-contentful-paint", "largest-contentful-paint-element"],
  INP: ["interaction-to-next-paint"],
  FID: ["first-input", "max-potential-fid"],
  CLS: ["cumulative-layout-shift", "layout-shift-elements", "cumulative-layout-shift-main-frame"],
  FCP: ["first-contentful-paint", "first-contentful-paint-3g"],
  TTFB: ["server-response-time", "time-to-first-byte"],
  TBT: ["total-blocking-time", "long-tasks", "main-thread-tasks"],
  SI: ["speed-index"],
};

/** Generate recommendation for a metric. */
export function metricRecommendation(name: MetricKey, rating: Rating): string {
  if (rating === "good") return `Good — keep monitoring. No action needed.`;
  if (rating === "missing") return `Metric not reported by PageSpeed Insights.`;
  const t = THRESHOLDS[name];
  if (rating === "needs-improvement") {
    switch (name) {
      case "LCP": return `LCP needs work. Optimize images (compress, lazy-load below-the-fold), preload hero images, reduce server response time, and remove render-blocking resources.`;
      case "INP": return `INP needs work. Break up long tasks, defer non-critical JavaScript, use requestIdleCallback for low-priority work.`;
      case "FID": return `FID needs work. Reduce JavaScript execution time, split long tasks, use web workers.`;
      case "CLS": return `CLS needs work. Always set width/height on images and videos, reserve space for ads/embeds, avoid inserting content above existing content.`;
      case "FCP": return `FCP needs work. Eliminate render-blocking resources, inline critical CSS, minify CSS/JS.`;
      case "TTFB": return `TTFB needs work. Use a CDN, optimize server response, upgrade hosting, use cache headers.`;
      case "TBT": return `TBT needs work. Reduce JavaScript execution, defer scripts, remove unused code.`;
      case "SI": return `Speed Index needs work. Optimize image loading, prioritize above-the-fold content, defer non-critical work.`;
    }
  }
  // poor
  switch (name) {
    case "LCP": return `LCP is poor. Critical: optimize the largest element on the page. Compress/preload hero image, reduce server response, remove render-blocking JS/CSS.`;
    case "INP": return `INP is poor. Critical: break long tasks, defer JavaScript, use web workers, optimize event handlers.`;
    case "FID": return `FID is poor. Critical: reduce JS execution time, split long tasks, use code-splitting.`;
    case "CLS": return `CLS is poor. Critical: set dimensions on all images/videos, reserve ad slots, avoid DOM changes after load.`;
    case "FCP": return `FCP is poor. Critical: inline critical CSS, eliminate render-blocking resources, use a CDN.`;
    case "TTFB": return `TTFB is poor. Critical: use a CDN, upgrade hosting, enable caching, optimize backend.`;
    case "TBT": return `TBT is poor. Critical: minimize JavaScript, code-split, defer non-critical scripts.`;
    case "SI": return `Speed Index is poor. Critical: optimize above-the-fold content, lazy-load images, inline critical CSS.`;
  }
}

/** Score a metric against thresholds. */
export function scoreMetric(name: MetricKey, value: number): MetricResult {
  const t = THRESHOLDS[name];
  let rating: Rating;
  if (value <= t.good) rating = "good";
  else if (value <= t.poor) rating = "needs-improvement";
  else rating = "poor";
  const displayValue = t.unit === "ms" ? `${(value / 1000).toFixed(2)} s` : value.toFixed(value < 1 ? 3 : 0);
  return {
    name,
    label: t.label,
    value,
    unit: t.unit,
    displayValue,
    rating,
    threshold: { good: t.good, poor: t.poor },
    description: t.description,
    recommendation: metricRecommendation(name, rating),
  };
}

/** Try to extract a numeric value from a PageSpeed audit item. */
function extractAuditValue(audit: Record<string, unknown> | undefined): number | null {
  if (!audit || typeof audit !== "object") return null;
  const numericValue = (audit as { numericValue?: unknown }).numericValue;
  if (typeof numericValue === "number" && Number.isFinite(numericValue)) return numericValue;
  return null;
}

/** Parse PageSpeed Insights JSON response. */
export function parsePageSpeedJson(json: string): {
  audits: Record<string, Record<string, unknown>>;
  url: string | null;
  fetchedAt: string | null;
  strategy: string | null;
  errors: string[];
} {
  if (!json || !json.trim()) return { audits: {}, url: null, fetchedAt: null, strategy: null, errors: ["Empty input"] };
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const lighthouse = (parsed.lighthouseResult ?? parsed) as Record<string, unknown>;
    const audits = (lighthouse.audits ?? {}) as Record<string, Record<string, unknown>>;
    const url = (typeof lighthouse.finalUrl === "string" ? lighthouse.finalUrl : null) ??
      (typeof parsed.id === "string" ? (parsed.id as string) : null);
    const fetchedAt = typeof lighthouse.fetchTime === "string" ? lighthouse.fetchTime : null;
    const strategy = typeof lighthouse.configSettings?.formFactor === "string"
      ? (lighthouse.configSettings as Record<string, string>).formFactor
      : null;
    return { audits, url, fetchedAt, strategy, errors: [] };
  } catch (e) {
    return { audits: {}, url: null, fetchedAt: null, strategy: null, errors: [e instanceof Error ? e.message : "Invalid JSON"] };
  }
}

/** Analyze the parsed PageSpeed JSON. */
export function analyze(input: string): { result: AnalysisResult | null; errors: string[] } {
  const { audits, url, fetchedAt, strategy, errors } = parsePageSpeedJson(input);
  if (errors.length > 0 || Object.keys(audits).length === 0) {
    return { result: null, errors: errors.length > 0 ? errors : ["No audits found in JSON"] };
  }
  const metrics: MetricResult[] = [];
  const allKeys: MetricKey[] = ["LCP", "INP", "FID", "CLS", "FCP", "TTFB", "TBT", "SI"];
  for (const key of allKeys) {
    const names = METRIC_AUDIT_NAMES[key];
    let value: number | null = null;
    for (const n of names) {
      value = extractAuditValue(audits[n]);
      if (value !== null) break;
    }
    if (value === null) {
      const t = THRESHOLDS[key];
      metrics.push({
        name: key,
        label: t.label,
        value: 0,
        unit: t.unit,
        displayValue: "—",
        rating: "missing",
        threshold: { good: t.good, poor: t.poor },
        description: t.description,
        recommendation: metricRecommendation(key, "missing"),
      });
    } else {
      metrics.push(scoreMetric(key, value));
    }
  }
  // Compute overall score: 100 if all good, deduct for warn/fail
  const passCount = metrics.filter((m) => m.rating === "good").length;
  const warnCount = metrics.filter((m) => m.rating === "needs-improvement").length;
  const failCount = metrics.filter((m) => m.rating === "poor").length;
  const missingCount = metrics.filter((m) => m.rating === "missing").length;
  const totalReported = passCount + warnCount + failCount;
  let score = 100;
  if (totalReported > 0) {
    // Weighted: fail counts double
    const penalty = (warnCount + failCount * 2) / (totalReported * 2);
    score = Math.round(100 * (1 - penalty));
  }
  let rating: Rating;
  if (score >= 90) rating = "good";
  else if (score >= 50) rating = "needs-improvement";
  else rating = "poor";
  // Prioritize recommendations from core vitals
  const coreVitals: MetricKey[] = ["LCP", "INP", "CLS"];
  const recommendations: string[] = [];
  for (const k of coreVitals) {
    const m = metrics.find((x) => x.name === k);
    if (m && (m.rating === "poor" || m.rating === "needs-improvement")) {
      recommendations.push(`[${m.label}] ${m.recommendation}`);
    }
  }
  // Add secondary metrics
  for (const m of metrics) {
    if (coreVitals.includes(m.name as MetricKey)) continue;
    if (m.rating === "poor" || m.rating === "needs-improvement") {
      recommendations.push(`[${m.label}] ${m.recommendation}`);
    }
  }
  return {
    result: {
      url: url ?? "",
      metrics,
      score,
      rating,
      passCount,
      warnCount,
      failCount,
      missingCount,
      recommendations,
      fetchedAt,
      strategy,
    },
    errors: [],
  };
}

/** Render a plain-text report. */
export function renderReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("Core Web Vitals Report");
  lines.push("======================");
  if (result.url) lines.push(`URL: ${result.url}`);
  if (result.fetchedAt) lines.push(`Fetched at: ${result.fetchedAt}`);
  if (result.strategy) lines.push(`Strategy: ${result.strategy}`);
  lines.push(`Overall score: ${result.score}/100 (${result.rating})`);
  lines.push(`Pass: ${result.passCount} · Warn: ${result.warnCount} · Fail: ${result.failCount} · Missing: ${result.missingCount}`);
  lines.push("");
  lines.push("Metrics:");
  for (const m of result.metrics) {
    lines.push(`  ${m.label}: ${m.displayValue} [${m.rating}]`);
  }
  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of result.recommendations) {
      lines.push(`  - ${r}`);
    }
  }
  return lines.join("\n");
}

/** Render CSV export. */
export function renderCsv(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("metric,value,unit,rating,good_threshold,poor_threshold");
  for (const m of result.metrics) {
    lines.push([m.name, m.value, m.unit, m.rating, m.threshold.good, m.threshold.poor].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:core-web-vitals-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  url: string;
  score: number;
  rating: string;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(payload: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
