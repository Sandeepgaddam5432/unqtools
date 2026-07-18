/**
 * Page Experience Signal Checker — pure logic.
 *
 * Score page experience signals: Core Web Vitals (LCP, FID, CLS, INP)
 * plus binary signals (HTTPS, mobile-friendly, no intrusive interstitials,
 * safe browsing). Weighted page experience score + recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type SignalStatus = "good" | "needs-improvement" | "poor";

export type SignalKey =
  | "lcp"
  | "fid"
  | "cls"
  | "inp"
  | "https"
  | "mobileFriendly"
  | "interstitials"
  | "safeBrowsing";

export interface PageExperienceInputs {
  url: string;
  lcpMs: number;
  fidMs: number;
  cls: number;
  inpMs: number;
  httpsEnabled: boolean;
  mobileFriendly: boolean;
  hasIntrusiveInterstitials: boolean;
  safeBrowsing: boolean;
}

export interface SignalScore {
  key: SignalKey;
  label: string;
  value: number | boolean;
  displayValue: string;
  score: number;
  status: SignalStatus;
  weight: number;
  recommendation?: string;
}

export interface PageExperienceResult {
  signals: SignalScore[];
  cwvScore: number;
  pageExperienceScore: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  failedCount: number;
}

export interface Recommendation {
  severity: "high" | "medium" | "low";
  signal: SignalKey;
  message: string;
}

export interface ComparisonRow {
  metric: string;
  current: string;
  target: string;
  delta: string;
}

export interface SummaryStats {
  totalSignals: number;
  goodPercent: number;
  failedPercent: number;
  cwvLabel: string;
  pageExperienceLabel: string;
  topPriority: string | null;
}

export interface HistoryEntry {
  ts: number;
  url: string;
  cwvScore: number;
  pageExperienceScore: number;
  goodCount: number;
  failedCount: number;
}

export interface InputErrors {
  url?: string;
  lcpMs?: string;
  fidMs?: string;
  cls?: string;
  inpMs?: string;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:page-experience-signal-checker:history";
export const HISTORY_MAX = 20;

/** CWV threshold constants — Google's published thresholds. */
export const LCP_GOOD_MS = 2500;
export const LCP_POOR_MS = 4000;
export const FID_GOOD_MS = 100;
export const FID_POOR_MS = 300;
export const CLS_GOOD = 0.1;
export const CLS_POOR = 0.25;
export const INP_GOOD_MS = 200;
export const INP_POOR_MS = 500;

/** Weights for page-experience score (must sum to 1). */
export const WEIGHTS = {
  cwv: 0.4,
  https: 0.15,
  mobileFriendly: 0.2,
  interstitials: 0.15,
  safeBrowsing: 0.1,
} as const;

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  lcp: "Largest Contentful Paint (LCP)",
  fid: "First Input Delay (FID)",
  cls: "Cumulative Layout Shift (CLS)",
  inp: "Interaction to Next Paint (INP)",
  https: "HTTPS",
  mobileFriendly: "Mobile-friendly",
  interstitials: "No intrusive interstitials",
  safeBrowsing: "Safe browsing",
};

export const STATUS_LABELS: Record<SignalStatus, string> = {
  "good": "Good",
  "needs-improvement": "Needs improvement",
  "poor": "Poor",
};

export const STATUS_COLORS: Record<SignalStatus, string> = {
  "good": "text-emerald-600 dark:text-emerald-400",
  "needs-improvement": "text-amber-600 dark:text-amber-400",
  "poor": "text-red-600 dark:text-red-400",
};

export const STATUS_BAR_COLORS: Record<SignalStatus, string> = {
  "good": "bg-emerald-500",
  "needs-improvement": "bg-amber-500",
  "poor": "bg-red-500",
};

export interface TargetPreset {
  key: "good" | "great" | "perfect";
  label: string;
  inputs: Partial<PageExperienceInputs>;
}

export const TARGET_PRESETS: TargetPreset[] = [
  {
    key: "good",
    label: "Good",
    inputs: {
      lcpMs: 2400,
      fidMs: 90,
      cls: 0.05,
      inpMs: 180,
      httpsEnabled: true,
      mobileFriendly: true,
      hasIntrusiveInterstitials: false,
      safeBrowsing: true,
    },
  },
  {
    key: "great",
    label: "Great",
    inputs: {
      lcpMs: 1800,
      fidMs: 50,
      cls: 0.02,
      inpMs: 100,
      httpsEnabled: true,
      mobileFriendly: true,
      hasIntrusiveInterstitials: false,
      safeBrowsing: true,
    },
  },
  {
    key: "perfect",
    label: "Perfect",
    inputs: {
      lcpMs: 1200,
      fidMs: 20,
      cls: 0,
      inpMs: 50,
      httpsEnabled: true,
      mobileFriendly: true,
      hasIntrusiveInterstitials: false,
      safeBrowsing: true,
    },
  },
];

// ---- Validation & normalization ----

/** Validate raw inputs (partial). Returns map of field → error message. */
export function validateInputs(inputs: Partial<PageExperienceInputs>): InputErrors {
  const errors: InputErrors = {};
  if (inputs.url !== undefined && inputs.url !== "" && !/^https?:\/\//i.test(inputs.url)) {
    errors.url = "URL must start with http:// or https://";
  }
  if (inputs.lcpMs !== undefined) {
    if (!Number.isFinite(inputs.lcpMs) || inputs.lcpMs < 0) errors.lcpMs = "LCP must be a non-negative number";
    else if (inputs.lcpMs > 60000) errors.lcpMs = "LCP must be under 60000ms";
  }
  if (inputs.fidMs !== undefined) {
    if (!Number.isFinite(inputs.fidMs) || inputs.fidMs < 0) errors.fidMs = "FID must be a non-negative number";
    else if (inputs.fidMs > 5000) errors.fidMs = "FID must be under 5000ms";
  }
  if (inputs.cls !== undefined) {
    if (!Number.isFinite(inputs.cls) || inputs.cls < 0) errors.cls = "CLS must be a non-negative number";
    else if (inputs.cls > 10) errors.cls = "CLS must be under 10";
  }
  if (inputs.inpMs !== undefined) {
    if (!Number.isFinite(inputs.inpMs) || inputs.inpMs < 0) errors.inpMs = "INP must be a non-negative number";
    else if (inputs.inpMs > 5000) errors.inpMs = "INP must be under 5000ms";
  }
  return errors;
}

/** Normalize inputs: trim url, coerce numbers, default booleans. */
export function normalizeInputs(inputs: Partial<PageExperienceInputs>): PageExperienceInputs {
  return {
    url: (inputs.url ?? "").trim(),
    lcpMs: Number.isFinite(inputs.lcpMs) ? Number(inputs.lcpMs) : 0,
    fidMs: Number.isFinite(inputs.fidMs) ? Number(inputs.fidMs) : 0,
    cls: Number.isFinite(inputs.cls) ? Number(inputs.cls) : 0,
    inpMs: Number.isFinite(inputs.inpMs) ? Number(inputs.inpMs) : 0,
    httpsEnabled: Boolean(inputs.httpsEnabled),
    mobileFriendly: Boolean(inputs.mobileFriendly),
    hasIntrusiveInterstitials: Boolean(inputs.hasIntrusiveInterstitials),
    safeBrowsing: Boolean(inputs.safeBrowsing),
  };
}

// ---- Scoring ----

/** Score LCP: ≤2500ms good, 2500-4000 needs improvement, >4000 poor. */
export function scoreLcp(ms: number): { score: number; status: SignalStatus } {
  if (ms <= LCP_GOOD_MS) return { score: 100, status: "good" };
  if (ms <= LCP_POOR_MS) return { score: 50, status: "needs-improvement" };
  return { score: 0, status: "poor" };
}

/** Score FID: ≤100ms good, 100-300 needs improvement, >300 poor. */
export function scoreFid(ms: number): { score: number; status: SignalStatus } {
  if (ms <= FID_GOOD_MS) return { score: 100, status: "good" };
  if (ms <= FID_POOR_MS) return { score: 50, status: "needs-improvement" };
  return { score: 0, status: "poor" };
}

/** Score CLS: ≤0.1 good, 0.1-0.25 needs improvement, >0.25 poor. */
export function scoreCls(cls: number): { score: number; status: SignalStatus } {
  if (cls <= CLS_GOOD) return { score: 100, status: "good" };
  if (cls <= CLS_POOR) return { score: 50, status: "needs-improvement" };
  return { score: 0, status: "poor" };
}

/** Score INP: ≤200ms good, 200-500 needs improvement, >500 poor. */
export function scoreInp(ms: number): { score: number; status: SignalStatus } {
  if (ms <= INP_GOOD_MS) return { score: 100, status: "good" };
  if (ms <= INP_POOR_MS) return { score: 50, status: "needs-improvement" };
  return { score: 0, status: "poor" };
}

/** Score a binary signal (true = good, false = poor). */
export function scoreBoolean(pass: boolean): { score: number; status: SignalStatus } {
  return pass
    ? { score: 100, status: "good" }
    : { score: 0, status: "poor" };
}

/** Compute CWV score: average of LCP, FID, CLS, INP scores (0-100). */
export function computeCwvScore(
  lcpMs: number,
  fidMs: number,
  cls: number,
  inpMs: number,
): number {
  const scores = [
    scoreLcp(lcpMs).score,
    scoreFid(fidMs).score,
    scoreCls(cls).score,
    scoreInp(inpMs).score,
  ];
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Compute overall page-experience score with weighted formula. */
export function computePageExperienceScore(inputs: PageExperienceInputs): PageExperienceResult {
  const signals: SignalScore[] = [];

  // LCP
  const lcp = scoreLcp(inputs.lcpMs);
  signals.push({
    key: "lcp",
    label: SIGNAL_LABELS.lcp,
    value: inputs.lcpMs,
    displayValue: `${inputs.lcpMs} ms`,
    score: lcp.score,
    status: lcp.status,
    weight: WEIGHTS.cwv / 4,
  });

  // FID
  const fid = scoreFid(inputs.fidMs);
  signals.push({
    key: "fid",
    label: SIGNAL_LABELS.fid,
    value: inputs.fidMs,
    displayValue: `${inputs.fidMs} ms`,
    score: fid.score,
    status: fid.status,
    weight: WEIGHTS.cwv / 4,
  });

  // CLS
  const cls = scoreCls(inputs.cls);
  signals.push({
    key: "cls",
    label: SIGNAL_LABELS.cls,
    value: inputs.cls,
    displayValue: inputs.cls.toFixed(3),
    score: cls.score,
    status: cls.status,
    weight: WEIGHTS.cwv / 4,
  });

  // INP
  const inp = scoreInp(inputs.inpMs);
  signals.push({
    key: "inp",
    label: SIGNAL_LABELS.inp,
    value: inputs.inpMs,
    displayValue: `${inputs.inpMs} ms`,
    score: inp.score,
    status: inp.status,
    weight: WEIGHTS.cwv / 4,
  });

  // HTTPS
  const https = scoreBoolean(inputs.httpsEnabled);
  signals.push({
    key: "https",
    label: SIGNAL_LABELS.https,
    value: inputs.httpsEnabled,
    displayValue: inputs.httpsEnabled ? "Yes" : "No",
    score: https.score,
    status: https.status,
    weight: WEIGHTS.https,
  });

  // Mobile-friendly
  const mf = scoreBoolean(inputs.mobileFriendly);
  signals.push({
    key: "mobileFriendly",
    label: SIGNAL_LABELS.mobileFriendly,
    value: inputs.mobileFriendly,
    displayValue: inputs.mobileFriendly ? "Yes" : "No",
    score: mf.score,
    status: mf.status,
    weight: WEIGHTS.mobileFriendly,
  });

  // Interstitials — pass when NOT intrusive
  const inter = scoreBoolean(!inputs.hasIntrusiveInterstitials);
  signals.push({
    key: "interstitials",
    label: SIGNAL_LABELS.interstitials,
    value: !inputs.hasIntrusiveInterstitials,
    displayValue: inputs.hasIntrusiveInterstitials ? "Intrusive" : "Clean",
    score: inter.score,
    status: inter.status,
    weight: WEIGHTS.interstitials,
  });

  // Safe browsing
  const sb = scoreBoolean(inputs.safeBrowsing);
  signals.push({
    key: "safeBrowsing",
    label: SIGNAL_LABELS.safeBrowsing,
    value: inputs.safeBrowsing,
    displayValue: inputs.safeBrowsing ? "Yes" : "No",
    score: sb.score,
    status: sb.status,
    weight: WEIGHTS.safeBrowsing,
  });

  const cwvScore = computeCwvScore(inputs.lcpMs, inputs.fidMs, inputs.cls, inputs.inpMs);
  // Weighted page-experience score
  const raw =
    cwvScore * WEIGHTS.cwv +
    https.score * WEIGHTS.https +
    mf.score * WEIGHTS.mobileFriendly +
    inter.score * WEIGHTS.interstitials +
    sb.score * WEIGHTS.safeBrowsing;
  const pageExperienceScore = Math.round(raw);

  let goodCount = 0, needsImprovementCount = 0, poorCount = 0, failedCount = 0;
  for (const s of signals) {
    if (s.status === "good") goodCount++;
    else if (s.status === "needs-improvement") needsImprovementCount++;
    else poorCount++;
    if (s.score < 100) failedCount++;
  }

  // Attach recommendations to failed signals
  const recs = generateRecommendations(inputs);
  for (const s of signals) {
    const r = recs.find((rr) => rr.signal === s.key);
    if (r) s.recommendation = r.message;
  }

  return {
    signals,
    cwvScore,
    pageExperienceScore,
    goodCount,
    needsImprovementCount,
    poorCount,
    failedCount,
  };
}

// ---- Recommendations ----

/** Generate prioritized recommendations for failed signals. */
export function generateRecommendations(inputs: PageExperienceInputs): Recommendation[] {
  const recs: Recommendation[] = [];
  // LCP
  if (inputs.lcpMs > LCP_GOOD_MS) {
    recs.push({
      severity: inputs.lcpMs > LCP_POOR_MS ? "high" : "medium",
      signal: "lcp",
      message: "Optimize LCP — preload hero image, reduce server response time, eliminate render-blocking resources.",
    });
  }
  // FID
  if (inputs.fidMs > FID_GOOD_MS) {
    recs.push({
      severity: inputs.fidMs > FID_POOR_MS ? "high" : "medium",
      signal: "fid",
      message: "Reduce JavaScript execution time, break up long tasks, use code splitting.",
    });
  }
  // CLS
  if (inputs.cls > CLS_GOOD) {
    recs.push({
      severity: inputs.cls > CLS_POOR ? "high" : "medium",
      signal: "cls",
      message: "Set dimensions on images/ads, avoid injecting content above existing, reserve space for embeds.",
    });
  }
  // INP
  if (inputs.inpMs > INP_GOOD_MS) {
    recs.push({
      severity: inputs.inpMs > INP_POOR_MS ? "high" : "medium",
      signal: "inp",
      message: "Optimize event handlers, use requestIdleCallback, break up long tasks on input.",
    });
  }
  // HTTPS
  if (!inputs.httpsEnabled) {
    recs.push({
      severity: "high",
      signal: "https",
      message: "Migrate to HTTPS — required for page experience and all modern browser features.",
    });
  }
  // Mobile-friendly
  if (!inputs.mobileFriendly) {
    recs.push({
      severity: "high",
      signal: "mobileFriendly",
      message: "Make site responsive — viewport meta tag, sized tap targets, readable font sizes.",
    });
  }
  // Interstitials
  if (inputs.hasIntrusiveInterstitials) {
    recs.push({
      severity: "medium",
      signal: "interstitials",
      message: "Remove intrusive interstitials — use banners or dismissible headers instead.",
    });
  }
  // Safe browsing
  if (!inputs.safeBrowsing) {
    recs.push({
      severity: "high",
      signal: "safeBrowsing",
      message: "Resolve safe browsing issues in Search Console — site flagged as deceptive or harmful.",
    });
  }
  // Severity sort: high → medium → low
  const order: Record<Recommendation["severity"], number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.severity] - order[b.severity]);
  return recs;
}

// ---- Summary stats & comparison ----

export function summarizeStats(result: PageExperienceResult): SummaryStats {
  const total = result.signals.length;
  const goodPercent = total > 0 ? Math.round((result.goodCount / total) * 1000) / 10 : 0;
  const failedPercent = total > 0 ? Math.round((result.failedCount / total) * 1000) / 10 : 0;
  const cwvLabel = scoreLabel(result.cwvScore);
  const pageExperienceLabel = scoreLabel(result.pageExperienceScore);
  // Top priority: first failed signal in priority order
  const priorityOrder: SignalKey[] = [
    "https", "safeBrowsing", "mobileFriendly", "lcp", "inp", "cls", "fid", "interstitials",
  ];
  let topPriority: string | null = null;
  for (const key of priorityOrder) {
    const sig = result.signals.find((s) => s.key === key);
    if (sig && sig.score < 100) {
      topPriority = sig.recommendation ?? `${sig.label} needs attention`;
      break;
    }
  }
  return { totalSignals: total, goodPercent, failedPercent, cwvLabel, pageExperienceLabel, topPriority };
}

/** Map a 0-100 score to a qualitative label. */
export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  if (score >= 25) return "Poor";
  return "Critical";
}

/** Build a side-by-side comparison of current vs target inputs. */
export function buildComparison(
  current: PageExperienceInputs,
  target: PageExperienceInputs,
): ComparisonRow[] {
  const cur = computePageExperienceScore(current);
  const tgt = computePageExperienceScore(target);
  const rows: ComparisonRow[] = [
    { metric: "CWV score", current: `${cur.cwvScore}`, target: `${tgt.cwvScore}`, delta: deltaStr(cur.cwvScore, tgt.cwvScore) },
    { metric: "Page experience", current: `${cur.pageExperienceScore}`, target: `${tgt.pageExperienceScore}`, delta: deltaStr(cur.pageExperienceScore, tgt.pageExperienceScore) },
    { metric: "Good signals", current: `${cur.goodCount}/8`, target: `${tgt.goodCount}/8`, delta: deltaStr(cur.goodCount, tgt.goodCount) },
    { metric: "Failed signals", current: `${cur.failedCount}/8`, target: `${tgt.failedCount}/8`, delta: deltaStr(cur.failedCount, tgt.failedCount, true) },
    { metric: "LCP (ms)", current: `${current.lcpMs}`, target: `${target.lcpMs}`, delta: deltaStr(current.lcpMs, target.lcpMs, true) },
    { metric: "FID (ms)", current: `${current.fidMs}`, target: `${target.fidMs}`, delta: deltaStr(current.fidMs, target.fidMs, true) },
    { metric: "CLS", current: `${current.cls.toFixed(3)}`, target: `${target.cls.toFixed(3)}`, delta: deltaStr(current.cls, target.cls, true) },
    { metric: "INP (ms)", current: `${current.inpMs}`, target: `${target.inpMs}`, delta: deltaStr(current.inpMs, target.inpMs, true) },
  ];
  return rows;
}

function deltaStr(cur: number, tgt: number, lowerIsBetter = false): string {
  const diff = tgt - cur;
  if (Math.abs(diff) < 0.0001) return "—";
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatDelta(diff)}${better ? " ✓" : " ✗"}`;
}

function formatDelta(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

// ---- Rendering ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a text report of the page experience analysis. */
export function renderTextReport(
  inputs: PageExperienceInputs,
  result: PageExperienceResult,
  recommendations: Recommendation[],
): string {
  const lines: string[] = [];
  lines.push("=== Page Experience Signal Report ===");
  lines.push("");
  if (inputs.url) lines.push(`URL: ${inputs.url}`);
  lines.push(`CWV score: ${result.cwvScore}/100 (${scoreLabel(result.cwvScore)})`);
  lines.push(`Page experience score: ${result.pageExperienceScore}/100 (${scoreLabel(result.pageExperienceScore)})`);
  lines.push(`Signals good: ${result.goodCount}/8 | needs improvement: ${result.needsImprovementCount} | poor: ${result.poorCount}`);
  lines.push("");
  lines.push("--- Signal status table ---");
  for (const s of result.signals) {
    const status = STATUS_LABELS[s.status].toUpperCase().padEnd(18);
    lines.push(`[${status}] ${s.label.padEnd(36)} value=${s.displayValue.padEnd(12)} score=${s.score}/100`);
  }
  if (recommendations.length > 0) {
    lines.push("");
    lines.push("--- Recommendations ---");
    for (const r of recommendations) {
      lines.push(`[${r.severity.toUpperCase()}] ${SIGNAL_LABELS[r.signal]}: ${r.message}`);
    }
  } else {
    lines.push("");
    lines.push("--- Recommendations ---");
    lines.push("All page experience signals are good. Keep monitoring.");
  }
  return lines.join("\n");
}

/** Render the signal table as CSV: signal, value, score, status. */
export function renderCsv(result: PageExperienceResult): string {
  const lines = ["signal,value,score,status,weight"];
  for (const s of result.signals) {
    lines.push([
      escapeCsv(s.label),
      escapeCsv(s.displayValue),
      s.score,
      s.status,
      s.weight,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

/** Encode inputs in a URL hash for sharing. */
export function buildShareUrl(inputs: PageExperienceInputs): string {
  const params = new URLSearchParams();
  if (inputs.url) params.set("url", inputs.url);
  params.set("lcp", String(inputs.lcpMs));
  params.set("fid", String(inputs.fidMs));
  params.set("cls", String(inputs.cls));
  params.set("inp", String(inputs.inpMs));
  params.set("https", inputs.httpsEnabled ? "1" : "0");
  params.set("mf", inputs.mobileFriendly ? "1" : "0");
  params.set("inter", inputs.hasIntrusiveInterstitials ? "1" : "0");
  params.set("sb", inputs.safeBrowsing ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a share URL hash back into inputs. */
export function parseShareUrl(hash: string): Partial<PageExperienceInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<PageExperienceInputs> = {};
  if (params.has("url")) out.url = params.get("url") ?? "";
  if (params.has("lcp")) out.lcpMs = Number(params.get("lcp")) || 0;
  if (params.has("fid")) out.fidMs = Number(params.get("fid")) || 0;
  if (params.has("cls")) out.cls = Number(params.get("cls")) || 0;
  if (params.has("inp")) out.inpMs = Number(params.get("inp")) || 0;
  if (params.has("https")) out.httpsEnabled = params.get("https") === "1";
  if (params.has("mf")) out.mobileFriendly = params.get("mf") === "1";
  if (params.has("inter")) out.hasIntrusiveInterstitials = params.get("inter") === "1";
  if (params.has("sb")) out.safeBrowsing = params.get("sb") === "1";
  return out;
}
