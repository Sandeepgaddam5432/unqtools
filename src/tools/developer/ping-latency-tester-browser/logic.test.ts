import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  OS_LABELS,
  LATENCY_THRESHOLDS,
  LATENCY_CLASS_LABELS,
  DEFAULT_TARGETS,
  classifyLatency,
  normalizeTarget,
  validateTarget,
  generatePingCommand,
  generatePingCommands,
  buildFetchUrl,
  buildFetchInit,
  buildFetchTimingPlan,
  parseFetchTiming,
  mean,
  computeStddev,
  computeJitter,
  computeStats,
  computeHistogram,
  formatLatency,
  renderStatsCsv,
  renderSamplesCsv,
  renderHistogramText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type OS,
  type PingOptions,
  type LatencySample,
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

function sample(seq: number, rttMs: number | null, ok = true, error?: string): LatencySample {
  return { seq, rttMs, ok, error, ts: seq * 1000 };
}

describe("ping-latency-tester constants", () => {
  it("has 3 OS labels", () => {
    expect(Object.keys(OS_LABELS)).toHaveLength(3);
    expect(OS_LABELS.windows).toContain("Windows");
    expect(OS_LABELS.linux).toContain("Linux");
    expect(OS_LABELS.macos).toContain("macOS");
  });
  it("has default options with sensible values", () => {
    expect(DEFAULT_OPTIONS.count).toBe(4);
    expect(DEFAULT_OPTIONS.intervalMs).toBe(1000);
    expect(DEFAULT_OPTIONS.timeoutMs).toBe(3000);
    expect(DEFAULT_OPTIONS.payloadSize).toBe(56);
  });
  it("has 4 latency thresholds in ascending order", () => {
    expect(LATENCY_THRESHOLDS.fast).toBeLessThan(LATENCY_THRESHOLDS.good);
    expect(LATENCY_THRESHOLDS.good).toBeLessThan(LATENCY_THRESHOLDS.moderate);
    expect(LATENCY_THRESHOLDS.moderate).toBeLessThan(LATENCY_THRESHOLDS.slow);
  });
  it("has 4 latency class labels", () => {
    expect(Object.keys(LATENCY_CLASS_LABELS)).toHaveLength(4);
  });
  it("has default targets", () => {
    expect(DEFAULT_TARGETS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_TARGETS.some((t) => t.url.includes("8.8.8.8"))).toBe(true);
  });
});

describe("ping-latency-tester classifyLatency", () => {
  it("classifies 10ms as fast", () => {
    expect(classifyLatency(10)).toBe("fast");
  });
  it("classifies 75ms as good", () => {
    expect(classifyLatency(75)).toBe("good");
  });
  it("classifies 150ms as moderate", () => {
    expect(classifyLatency(150)).toBe("moderate");
  });
  it("classifies 300ms as slow", () => {
    expect(classifyLatency(300)).toBe("slow");
  });
});

describe("ping-latency-tester normalizeTarget + validateTarget", () => {
  it("normalizes bare host to https", () => {
    expect(normalizeTarget("example.com")).toBe("https://example.com");
  });
  it("keeps http(s) prefix", () => {
    expect(normalizeTarget("http://example.com")).toBe("http://example.com");
    expect(normalizeTarget("https://example.com")).toBe("https://example.com");
  });
  it("returns empty for empty input", () => {
    expect(normalizeTarget("")).toBe("");
  });
  it("validates a good URL", () => {
    const v = validateTarget("https://example.com");
    expect(v.ok).toBe(true);
    expect(v.normalized).toBe("https://example.com");
  });
  it("rejects empty target", () => {
    expect(validateTarget("").ok).toBe(false);
  });
  it("rejects non-http protocols", () => {
    const v = validateTarget("ftp://example.com");
    expect(v.ok).toBe(false);
  });
});

describe("ping-latency-tester generatePingCommand", () => {
  it("generates a Windows ping with -n count", () => {
    const cmd = generatePingCommand("example.com", "windows");
    expect(cmd).toContain("ping example.com");
    expect(cmd).toContain("-n 4");
    expect(cmd).toContain("-w 3000");
    expect(cmd).toContain("-l 56");
  });
  it("generates a Linux ping with -c count and -W ms", () => {
    const cmd = generatePingCommand("example.com", "linux");
    expect(cmd.startsWith("ping ")).toBe(true);
    expect(cmd).toContain("-c 4");
    expect(cmd).toContain("-W 3000");
    expect(cmd).toContain("-s 56");
    expect(cmd).toContain("-n"); // no resolveHostnames → -n
  });
  it("generates a macOS ping with -W in seconds", () => {
    const cmd = generatePingCommand("example.com", "macos", { ...DEFAULT_OPTIONS, timeoutMs: 5000 });
    expect(cmd).toContain("-c 4");
    expect(cmd).toContain("-W 5"); // 5000ms → 5s
  });
  it("adds -4 / -6 flags", () => {
    const cmd4 = generatePingCommand("example.com", "linux", { ...DEFAULT_OPTIONS, ipv4: true });
    const cmd6 = generatePingCommand("example.com", "linux", { ...DEFAULT_OPTIONS, ipv6: true });
    expect(cmd4).toContain("-4");
    expect(cmd6).toContain("-6");
  });
  it("adds -f flood and -q quiet and -D timestamps on Linux", () => {
    const cmd = generatePingCommand("example.com", "linux", {
      ...DEFAULT_OPTIONS, flood: true, quiet: true, timestamps: true,
    });
    expect(cmd).toContain("-f");
    expect(cmd).toContain("-q");
    expect(cmd).toContain("-D");
  });
  it("adds -a resolve-hostnames on Windows", () => {
    const cmd = generatePingCommand("example.com", "windows", { ...DEFAULT_OPTIONS, resolveHostnames: true });
    expect(cmd).toContain("-a");
  });
  it("returns empty for empty host", () => {
    expect(generatePingCommand("", "linux")).toBe("");
  });
});

describe("ping-latency-tester generatePingCommands", () => {
  it("generates commands for all three OSes", () => {
    const cmds = generatePingCommands("example.com");
    expect(Object.keys(cmds).sort()).toEqual(["linux", "macos", "windows"]);
    expect(cmds.windows).toContain("ping example.com");
    expect(cmds.linux).toContain("-c 4");
    expect(cmds.macos).toContain("-c 4");
  });
});

describe("ping-latency-tester fetch-timing plan", () => {
  it("builds a cache-busted URL", () => {
    const u = buildFetchUrl("https://example.com", true);
    expect(u).toMatch(/^https:\/\/example\.com\?_=\d+$/);
  });
  it("returns clean URL when cacheBust=false", () => {
    expect(buildFetchUrl("https://example.com", false)).toBe("https://example.com");
  });
  it("preserves existing query string when cache-busting", () => {
    const u = buildFetchUrl("https://example.com/?foo=bar", true);
    expect(u).toContain("foo=bar");
    expect(u).toContain("_=");
  });
  it("builds no-cors no-store fetch init", () => {
    const init = buildFetchInit("HEAD");
    expect(init.method).toBe("HEAD");
    expect(init.mode).toBe("no-cors");
    expect(init.cache).toBe("no-store");
  });
  it("builds a complete fetch-timing plan", () => {
    const plan = buildFetchTimingPlan("https://example.com");
    expect(plan.url).toContain("_=");
    expect(plan.init.method).toBe("HEAD");
    expect(plan.count).toBe(DEFAULT_OPTIONS.count);
    expect(plan.discardWarmup).toBe(true);
    expect(plan.timeoutMs).toBe(DEFAULT_OPTIONS.timeoutMs);
  });
});

describe("ping-latency-tester parseFetchTiming", () => {
  it("parses a PerformanceResourceTiming-like entry", () => {
    const entry = {
      fetchStart: 100,
      domainLookupStart: 100,
      domainLookupEnd: 105,
      connectStart: 105,
      connectEnd: 120,
      secureConnectionStart: 110,
      responseStart: 150,
      responseEnd: 160,
    } as PerformanceResourceTiming;
    const t = parseFetchTiming(entry);
    expect(t.dnsMs).toBe(5);
    expect(t.tcpMs).toBe(15);
    expect(t.tlsMs).toBe(10);
    expect(t.ttfbMs).toBe(50);
    expect(t.transferMs).toBe(10);
    expect(t.rttMs).toBe(60);
  });
  it("handles zero values gracefully", () => {
    const entry = {
      fetchStart: 0, domainLookupStart: 0, domainLookupEnd: 0,
      connectStart: 0, connectEnd: 0, secureConnectionStart: 0,
      responseStart: 0, responseEnd: 0,
    } as PerformanceResourceTiming;
    const t = parseFetchTiming(entry);
    expect(t.rttMs).toBe(0);
    expect(t.tlsMs).toBe(0);
  });
});

describe("ping-latency-tester statistics helpers", () => {
  it("mean of [10,20,30] is 20", () => {
    expect(mean([10, 20, 30])).toBe(20);
  });
  it("mean of empty is 0", () => {
    expect(mean([])).toBe(0);
  });
  it("computeStddev of identical values is 0", () => {
    expect(computeStddev([5, 5, 5])).toBe(0);
  });
  it("computeStddev of [2,4,4,4,5,5,7,9] is 2", () => {
    expect(computeStddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });
  it("computeStddev of single value is 0", () => {
    expect(computeStddev([42])).toBe(0);
  });
  it("computeJitter of [10,12,11,13] is mean of [2,1,2]=5/3", () => {
    expect(computeJitter([10, 12, 11, 13])).toBeCloseTo(5 / 3, 5);
  });
  it("computeJitter of single value is 0", () => {
    expect(computeJitter([42])).toBe(0);
  });
});

describe("ping-latency-tester computeStats", () => {
  it("computes stats for 4 successful samples", () => {
    const samples = [
      sample(1, 10), sample(2, 20), sample(3, 30), sample(4, 40),
    ];
    const stats = computeStats(samples);
    expect(stats.count).toBe(4);
    expect(stats.success).toBe(4);
    expect(stats.failed).toBe(0);
    expect(stats.lossPct).toBe(0);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(40);
    expect(stats.avgMs).toBe(25);
    expect(stats.stddevMs).toBeCloseTo(Math.sqrt(125), 5);
    expect(stats.jitterMs).toBeCloseTo(10, 5);
  });
  it("computes packet loss for mixed samples", () => {
    const samples = [
      sample(1, 10), sample(2, null, false, "timeout"),
      sample(3, 20), sample(4, null, false, "timeout"),
    ];
    const stats = computeStats(samples);
    expect(stats.count).toBe(4);
    expect(stats.success).toBe(2);
    expect(stats.failed).toBe(2);
    expect(stats.lossPct).toBe(50);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(20);
    expect(stats.avgMs).toBe(15);
  });
  it("returns nulls for all-failed samples", () => {
    const stats = computeStats([sample(1, null, false, "err"), sample(2, null, false, "err")]);
    expect(stats.success).toBe(0);
    expect(stats.minMs).toBeNull();
    expect(stats.avgMs).toBeNull();
    expect(stats.stddevMs).toBeNull();
  });
  it("returns nulls for empty input", () => {
    const stats = computeStats([]);
    expect(stats.count).toBe(0);
    expect(stats.minMs).toBeNull();
  });
  it("single successful sample has null stddev and jitter", () => {
    const stats = computeStats([sample(1, 50)]);
    expect(stats.avgMs).toBe(50);
    expect(stats.stddevMs).toBeNull();
    expect(stats.jitterMs).toBeNull();
  });
});

describe("ping-latency-tester computeHistogram", () => {
  it("returns empty for empty input", () => {
    expect(computeHistogram([])).toEqual([]);
  });
  it("collapses to a single bucket when all values are equal", () => {
    const buckets = computeHistogram([5, 5, 5], 5);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(3);
  });
  it("bins into N buckets", () => {
    const buckets = computeHistogram([0, 10, 20, 30, 40], 5);
    expect(buckets).toHaveLength(5);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(5);
  });
  it("puts all samples in the right bucket for [0,10] with 2 buckets", () => {
    const buckets = computeHistogram([0, 10], 2);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].count).toBe(1);
    expect(buckets[1].count).toBe(1);
  });
});

describe("ping-latency-tester formatLatency + render", () => {
  it("formatLatency formats null as dash", () => {
    expect(formatLatency(null)).toBe("—");
  });
  it("formatLatency formats sub-1ms with 2 decimals", () => {
    expect(formatLatency(0.5)).toBe("0.50ms");
  });
  it("formatLatency formats 100+ ms as integer", () => {
    expect(formatLatency(123.7)).toBe("124ms");
  });
  it("renderStatsCsv has header + 1 row", () => {
    const csv = renderStatsCsv(computeStats([sample(1, 10), sample(2, 20)]));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("count,success,failed,loss_pct");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("10");
  });
  it("renderSamplesCsv has header + N rows", () => {
    const csv = renderSamplesCsv([sample(1, 10), sample(2, 20)]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("seq,rtt_ms,ok,error,ts");
    expect(lines).toHaveLength(3);
  });
  it("renderSamplesCsv escapes error quotes", () => {
    const csv = renderSamplesCsv([sample(1, null, false, 'bad "timeout"')]);
    expect(csv).toContain('bad ""timeout""');
  });
  it("renderHistogramText returns string with bars", () => {
    const txt = renderHistogramText(computeHistogram([10, 20, 30], 3));
    expect(txt).toContain("█");
    expect(txt.split("\n")).toHaveLength(3);
  });
  it("renderHistogramText returns empty for empty input", () => {
    expect(renderHistogramText([])).toBe("");
  });
});

describe("ping-latency-tester history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, target: "https://example.com", count: 4, avgMs: 25, jitterMs: 5, lossPct: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, target: `https://h${i}.com`, count: 4, avgMs: i, jitterMs: 1, lossPct: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, target: "x", count: 1, avgMs: 1, jitterMs: 1, lossPct: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ping-latency-tester shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ target: "example.com", count: 10, intervalMs: 500, timeoutMs: 2000, payloadSize: 64 });
    expect(url).toContain("target=example.com");
    expect(url).toContain("count=10");
    expect(url).toContain("interval=500");
    expect(url).toContain("timeout=2000");
    expect(url).toContain("size=64");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("target=example.com&count=10&interval=500&timeout=2000&size=64");
    expect(p.target).toBe("example.com");
    expect(p.count).toBe(10);
    expect(p.intervalMs).toBe(500);
    expect(p.timeoutMs).toBe(2000);
    expect(p.payloadSize).toBe(64);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.target).toBe("");
    expect(p.count).toBe(DEFAULT_OPTIONS.count);
  });
  it("clamps invalid count to fallback", () => {
    const p = parseShareUrl("count=abc");
    expect(p.count).toBe(DEFAULT_OPTIONS.count);
  });
});

describe("ping-latency-tester makeId", () => {
  it("produces unique ids", () => {
    const a = makeId();
    const b = makeId();
    expect(a).not.toBe(b);
    expect(a.startsWith("t-")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = OS | PingOptions;
