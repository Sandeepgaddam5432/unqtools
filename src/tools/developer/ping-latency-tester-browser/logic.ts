/**
 * Ping & Latency Tester (Browser) — pure logic.
 *
 * Generates ICMP `ping` commands for Windows / Linux / macOS, builds a
 * browser HTTP fetch-timing plan that uses the Performance API, and
 * computes latency statistics (min / max / avg / stddev / jitter /
 * packet-loss) from a list of RTT samples. Pure functions only — no
 * DOM, no network. The UI may run the fetch plan and feed the RTTs
 * back into the stats calculator.
 */

// ---- OS + options ----

export type OS = "windows" | "linux" | "macos";

export interface PingOptions {
  /** Number of echo requests to send. */
  count: number;
  /** Interval between requests, in milliseconds. */
  intervalMs: number;
  /** Per-request timeout, in milliseconds. */
  timeoutMs: number;
  /** Payload size in bytes. */
  payloadSize: number;
  /** Resolve addresses to hostnames (Windows -a). */
  resolveHostnames: boolean;
  /** Force IPv4. */
  ipv4: boolean;
  /** Force IPv6. */
  ipv6: boolean;
  /** Flood mode (Linux/macOS -f, root only). */
  flood: boolean;
  /** Quiet summary only (Linux/macOS -q). */
  quiet: boolean;
  /** Print timestamps (Linux/macOS -D). */
  timestamps: boolean;
}

export const DEFAULT_OPTIONS: PingOptions = {
  count: 4,
  intervalMs: 1000,
  timeoutMs: 3000,
  payloadSize: 56,
  resolveHostnames: false,
  ipv4: false,
  ipv6: false,
  flood: false,
  quiet: false,
  timestamps: false,
};

export const OS_LABELS: Record<OS, string> = {
  windows: "Windows (ping.exe)",
  linux: "Linux (iputils ping)",
  macos: "macOS (ping)",
};

// ---- Latency classification ----

export interface LatencyThresholds {
  /** Below this is "fast". */
  fast: number;
  /** Below this is "good". */
  good: number;
  /** Below this is "moderate". */
  moderate: number;
  /** Above moderate is "slow". */
  slow: number;
}

export const LATENCY_THRESHOLDS: LatencyThresholds = {
  fast: 50,
  good: 100,
  moderate: 200,
  slow: 500,
};

export type LatencyClass = "fast" | "good" | "moderate" | "slow";

export function classifyLatency(ms: number): LatencyClass {
  if (ms < LATENCY_THRESHOLDS.fast) return "fast";
  if (ms < LATENCY_THRESHOLDS.good) return "good";
  if (ms < LATENCY_THRESHOLDS.moderate) return "moderate";
  return "slow";
}

export const LATENCY_CLASS_LABELS: Record<LatencyClass, string> = {
  fast: "Fast (<50ms)",
  good: "Good (<100ms)",
  moderate: "Moderate (<200ms)",
  slow: "Slow (≥200ms)",
};

// ---- Host / target validation ----

export interface TargetEntry {
  id: string;
  label: string;
  url: string;
}

export const DEFAULT_TARGETS: TargetEntry[] = [
  { id: "google-dns", label: "Google DNS 8.8.8.8", url: "https://8.8.8.8" },
  { id: "cloudflare", label: "Cloudflare 1.1.1.1", url: "https://1.1.1.1" },
  { id: "aws", label: "AWS S3", url: "https://aws.amazon.com" },
  { id: "github", label: "GitHub", url: "https://github.com" },
];

export function normalizeTarget(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export interface TargetValidation {
  ok: boolean;
  error?: string;
  normalized?: string;
}

export function validateTarget(url: string): TargetValidation {
  const trimmed = (url || "").trim();
  if (!trimmed) return { ok: false, error: "Target is empty" };
  let normalized: string;
  // Detect an explicit scheme (e.g. "ftp://") — reject non-http(s).
  const schemeMatch = trimmed.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
  if (schemeMatch) {
    const scheme = schemeMatch[0].toLowerCase();
    if (scheme !== "http://" && scheme !== "https://") {
      return { ok: false, error: `Unsupported protocol: ${scheme.replace("://", "")}` };
    }
    normalized = trimmed;
  } else {
    normalized = `https://${trimmed}`;
  }
  try {
    // URL parsing — accepts http(s) and bare hosts (after normalize).
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: `Unsupported protocol: ${u.protocol}` };
    }
    if (!u.hostname) return { ok: false, error: "Missing hostname" };
    return { ok: true, normalized };
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
}

// ---- ping command generator ----

/**
 * Generate a ping command for the given OS.
 * Returns the raw shell string (no escaping of host required for typical
 * hostnames/IPv4; IPv6 hosts should be URL-bracketed by the caller — but
 * ping CLI does not use brackets, so we pass through as-is).
 */
export function generatePingCommand(
  host: string,
  os: OS,
  options: PingOptions = DEFAULT_OPTIONS,
): string {
  const h = (host || "").trim();
  if (!h) return "";
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (os === "windows") {
    const parts: string[] = ["ping", h];
    parts.push("-n", String(Math.max(1, Math.floor(o.count))));
    parts.push("-w", String(Math.max(1, Math.floor(o.timeoutMs))));
    parts.push("-l", String(Math.max(0, Math.floor(o.payloadSize))));
    if (o.resolveHostnames) parts.push("-a");
    if (o.ipv4) parts.push("-4");
    if (o.ipv6) parts.push("-6");
    // Windows has no -f flood; -t means ping forever.
    return parts.join(" ");
  }
  // Linux + macOS share the same flag set with one difference: timeout
  // units (Linux -W is ms since iputils 20121221; macOS -W is seconds).
  const parts: string[] = ["ping"];
  parts.push("-c", String(Math.max(1, Math.floor(o.count))));
  // Linux interval is in seconds; convert ms → s with one decimal max.
  const intervalS = Math.max(0.1, o.intervalMs / 1000);
  parts.push("-i", Number.isInteger(intervalS) ? String(intervalS) : intervalS.toFixed(1));
  if (os === "linux") {
    parts.push("-W", String(Math.max(1, Math.floor(o.timeoutMs))));
  } else {
    // macOS: -W is seconds, rounded up.
    parts.push("-W", String(Math.max(1, Math.ceil(o.timeoutMs / 1000))));
  }
  parts.push("-s", String(Math.max(0, Math.floor(o.payloadSize))));
  if (o.flood) parts.push("-f");
  if (!o.resolveHostnames) parts.push("-n");
  if (o.quiet) parts.push("-q");
  if (o.timestamps) parts.push("-D");
  if (o.ipv4) parts.push("-4");
  if (o.ipv6) parts.push("-6");
  parts.push(h);
  return parts.join(" ");
}

/** Generate ping commands for all three OSes. */
export function generatePingCommands(
  host: string,
  options: PingOptions = DEFAULT_OPTIONS,
): Record<OS, string> {
  return {
    windows: generatePingCommand(host, "windows", options),
    linux: generatePingCommand(host, "linux", options),
    macos: generatePingCommand(host, "macos", options),
  };
}

// ---- Browser fetch-timing plan ----

export interface FetchTimingPlan {
  /** Final URL with cache-bust param appended. */
  url: string;
  /** Fetch init object (serializable). */
  init: {
    method: string;
    mode: string;
    cache: string;
    redirect: string;
    headers: Record<string, string>;
  };
  /** Suggested delay between requests, in ms. */
  intervalMs: number;
  /** Suggested request count. */
  count: number;
  /** Whether to discard the first (warm-up) sample. */
  discardWarmup: boolean;
  /** Suggested per-request timeout, in ms. */
  timeoutMs: number;
}

/** Build a cache-busted URL by appending _=<ts>. */
export function buildFetchUrl(baseUrl: string, cacheBust = true): string {
  const norm = normalizeTarget(baseUrl);
  if (!norm) return "";
  if (!cacheBust) return norm;
  const sep = norm.includes("?") ? "&" : "?";
  return `${norm}${sep}_=${Date.now()}`;
}

/** Build a fetch init object suitable for no-cors latency timing. */
export function buildFetchInit(
  method: "HEAD" | "GET" = "HEAD",
): FetchTimingPlan["init"] {
  return {
    method,
    mode: "no-cors",
    cache: "no-store",
    redirect: "follow",
    headers: { Accept: "*/*" },
  };
}

/** Build a complete fetch-timing plan from a target URL + options. */
export function buildFetchTimingPlan(
  baseUrl: string,
  options: PingOptions = DEFAULT_OPTIONS,
  discardWarmup = true,
): FetchTimingPlan {
  const o = { ...DEFAULT_OPTIONS, ...options };
  return {
    url: buildFetchUrl(baseUrl, true),
    init: buildFetchInit("HEAD"),
    intervalMs: o.intervalMs,
    count: o.count,
    discardWarmup,
    timeoutMs: o.timeoutMs,
  };
}

/** A single timing sample produced by the in-browser fetch runner. */
export interface LatencySample {
  /** Sequence number, 1-indexed. */
  seq: number;
  /** Round-trip time in milliseconds, or null on failure. */
  rttMs: number | null;
  /** Whether the fetch resolved (CORS errors still resolve timing). */
  ok: boolean;
  /** Error message on failure. */
  error?: string;
  /** Timestamp the sample was taken. */
  ts: number;
}

/**
 * Parse a PerformanceResourceTiming entry into a latency breakdown.
 * Returns the fields most relevant to network RTT. The "rtt" here is
 * `responseEnd - fetchStart` (total browser-measured round trip).
 */
export interface FetchTimingBreakdown {
  /** Total round trip (responseEnd − fetchStart), ms. */
  rttMs: number;
  /** DNS lookup duration, ms (0 if cached). */
  dnsMs: number;
  /** TCP connect duration, ms (0 if reused). */
  tcpMs: number;
  /** TLS handshake duration, ms (0 if plain HTTP or reused). */
  tlsMs: number;
  /** Time to first byte, ms. */
  ttfbMs: number;
  /** Response transfer duration, ms. */
  transferMs: number;
}

export function parseFetchTiming(entry: PerformanceResourceTiming): FetchTimingBreakdown {
  const dnsMs = Math.max(0, (entry.domainLookupEnd || 0) - (entry.domainLookupStart || 0));
  const tcpMs = Math.max(0, (entry.connectEnd || 0) - (entry.connectStart || 0));
  const tlsMs = entry.secureConnectionStart > 0
    ? Math.max(0, (entry.connectEnd || 0) - entry.secureConnectionStart)
    : 0;
  const ttfbMs = Math.max(0, (entry.responseStart || 0) - (entry.fetchStart || 0));
  const transferMs = Math.max(0, (entry.responseEnd || 0) - (entry.responseStart || 0));
  const rttMs = Math.max(0, (entry.responseEnd || 0) - (entry.fetchStart || 0));
  return { rttMs, dnsMs, tcpMs, tlsMs, ttfbMs, transferMs };
}

// ---- Statistics ----

export interface LatencyStats {
  /** Total samples received (ok + failed). */
  count: number;
  /** Successful samples (rttMs not null). */
  success: number;
  /** Failed samples. */
  failed: number;
  /** Packet-loss percentage, 0–100. */
  lossPct: number;
  /** Minimum RTT in ms (null if no successful samples). */
  minMs: number | null;
  /** Maximum RTT in ms (null if no successful samples). */
  maxMs: number | null;
  /** Average (mean) RTT in ms (null if no successful samples). */
  avgMs: number | null;
  /** Population standard deviation in ms (null if <2 samples). */
  stddevMs: number | null;
  /** Mean packet-delay variation (jitter) in ms (null if <2 samples). */
  jitterMs: number | null;
}

/** Compute mean of an array of numbers. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Population standard deviation. */
export function computeStddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sqDiff = 0;
  for (const v of values) sqDiff += (v - m) * (v - m);
  return Math.sqrt(sqDiff / values.length);
}

/**
 * Jitter: mean of absolute differences between consecutive samples.
 * This is the RFC 3550 mean packet-delay variation.
 */
export function computeJitter(values: number[]): number {
  if (values.length < 2) return 0;
  let sumAbsDiff = 0;
  for (let i = 1; i < values.length; i++) {
    sumAbsDiff += Math.abs(values[i] - values[i - 1]);
  }
  return sumAbsDiff / (values.length - 1);
}

/** Compute latency statistics from a list of samples. */
export function computeStats(samples: LatencySample[]): LatencyStats {
  const count = samples.length;
  const successful = samples.filter((s) => s.ok && s.rttMs !== null && s.rttMs >= 0);
  const success = successful.length;
  const failed = count - success;
  const lossPct = count === 0 ? 0 : (failed / count) * 100;
  if (success === 0) {
    return {
      count, success, failed, lossPct,
      minMs: null, maxMs: null, avgMs: null, stddevMs: null, jitterMs: null,
    };
  }
  const rtts = successful.map((s) => s.rttMs as number);
  let min = rtts[0];
  let max = rtts[0];
  let sum = 0;
  for (const v of rtts) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const avg = sum / success;
  return {
    count,
    success,
    failed,
    lossPct,
    minMs: min,
    maxMs: max,
    avgMs: avg,
    stddevMs: success >= 2 ? computeStddev(rtts) : null,
    jitterMs: success >= 2 ? computeJitter(rtts) : null,
  };
}

// ---- Histogram ----

export interface LatencyBucket {
  /** Inclusive lower bound, ms. */
  rangeMin: number;
  /** Exclusive upper bound, ms (Infinity for the last bucket). */
  rangeMax: number;
  /** Number of samples in this bucket. */
  count: number;
}

/**
 * Bin RTTs into N buckets. If all values are equal, the buckets collapse
 * into a single zero-width bucket around that value. Empty input returns
 * an empty array.
 */
export function computeHistogram(rtts: number[], bucketCount = 10): LatencyBucket[] {
  if (rtts.length === 0) return [];
  const n = Math.max(1, Math.floor(bucketCount));
  let min = rtts[0];
  let max = rtts[0];
  for (const v of rtts) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    return [{ rangeMin: min, rangeMax: min + 1, count: rtts.length }];
  }
  const width = (max - min) / n;
  const buckets: LatencyBucket[] = [];
  for (let i = 0; i < n; i++) {
    buckets.push({
      rangeMin: min + i * width,
      rangeMax: i === n - 1 ? max : min + (i + 1) * width,
      count: 0,
    });
  }
  for (const v of rtts) {
    let idx = Math.floor((v - min) / width);
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }
  return buckets;
}

// ---- Rendering / export ----

export function formatLatency(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}

export function renderStatsCsv(stats: LatencyStats): string {
  const header = "count,success,failed,loss_pct,min_ms,max_ms,avg_ms,stddev_ms,jitter_ms";
  const row = [
    stats.count,
    stats.success,
    stats.failed,
    stats.lossPct.toFixed(2),
    stats.minMs ?? "",
    stats.maxMs ?? "",
    stats.avgMs?.toFixed(3) ?? "",
    stats.stddevMs?.toFixed(3) ?? "",
    stats.jitterMs?.toFixed(3) ?? "",
  ].join(",");
  return `${header}\n${row}`;
}

export function renderSamplesCsv(samples: LatencySample[]): string {
  const lines = ["seq,rtt_ms,ok,error,ts"];
  for (const s of samples) {
    lines.push([
      s.seq,
      s.rttMs ?? "",
      s.ok ? "1" : "0",
      s.error ? `"${s.error.replace(/"/g, '""')}"` : "",
      s.ts,
    ].join(","));
  }
  return lines.join("\n");
}

export function renderHistogramText(buckets: LatencyBucket[]): string {
  if (buckets.length === 0) return "";
  const maxCount = Math.max(...buckets.map((b) => b.count));
  const lines: string[] = [];
  for (const b of buckets) {
    const bar = maxCount > 0 ? "█".repeat(Math.round((b.count / maxCount) * 30)) : "";
    const range = b.rangeMax === Infinity
      ? `[${b.rangeMin.toFixed(1)}, ∞)`
      : `[${b.rangeMin.toFixed(1)}, ${b.rangeMax.toFixed(1)})`;
    lines.push(`${range.padEnd(22)} ${String(b.count).padStart(4)} ${bar}`);
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:ping-latency-tester-browser:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  target: string;
  count: number;
  avgMs: number | null;
  jitterMs: number | null;
  lossPct: number;
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

export interface ShareConfig {
  target: string;
  count: number;
  intervalMs: number;
  timeoutMs: number;
  payloadSize: number;
}

export function buildShareUrl(cfg: ShareConfig): string {
  const params = new URLSearchParams();
  if (cfg.target) params.set("target", cfg.target);
  params.set("count", String(cfg.count));
  params.set("interval", String(cfg.intervalMs));
  params.set("timeout", String(cfg.timeoutMs));
  params.set("size", String(cfg.payloadSize));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...ShareConfigDefaults };
  const params = new URLSearchParams(clean);
  return {
    target: params.get("target") ?? "",
    count: clampInt(params.get("count"), 1, 1000, DEFAULT_OPTIONS.count),
    intervalMs: clampInt(params.get("interval"), 10, 60000, DEFAULT_OPTIONS.intervalMs),
    timeoutMs: clampInt(params.get("timeout"), 100, 60000, DEFAULT_OPTIONS.timeoutMs),
    payloadSize: clampInt(params.get("size"), 0, 65500, DEFAULT_OPTIONS.payloadSize),
  };
}

export const ShareConfigDefaults: ShareConfig = {
  target: "",
  count: DEFAULT_OPTIONS.count,
  intervalMs: DEFAULT_OPTIONS.intervalMs,
  timeoutMs: DEFAULT_OPTIONS.timeoutMs,
  payloadSize: DEFAULT_OPTIONS.payloadSize,
};

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Make a stable id for new target entries. */
export function makeId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
