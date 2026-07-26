import { describe, it, expect } from "vitest";
import {
  estimate, estimateTimeMs, securityScore, scoreToTier, tuneForTime,
  memoryTradeoff, compareParams, toCliCommand, toOptionsObject,
  batchEstimate, batchStats, renderBatchCsv, renderReport,
  presetComparisonTable, getPresetLevels, OWASP_PRESET,
  type Argon2Params,
} from "./logic";

const base: Argon2Params = { memoryKb: 19 * 1024, iterations: 2, parallelism: 1, variant: "argon2id", hashLength: 32 };

describe("argon2-param-calculator estimateTimeMs", () => {
  it("estimates a positive time", () => {
    expect(estimateTimeMs(base)).toBeGreaterThan(0);
  });
  it("scales linearly with iterations", () => {
    const a = estimateTimeMs({ ...base, iterations: 1 });
    const b = estimateTimeMs({ ...base, iterations: 4 });
    expect(b).toBeCloseTo(a * 4, 0);
  });
  it("reduces time with parallelism", () => {
    const a = estimateTimeMs({ ...base, parallelism: 1 });
    const b = estimateTimeMs({ ...base, parallelism: 4 });
    expect(b).toBeLessThan(a);
  });
});

describe("argon2-param-calculator securityScore", () => {
  it("scores higher for stronger params", () => {
    const low = securityScore({ memoryKb: 1024, iterations: 1, parallelism: 1, variant: "argon2id", hashLength: 16 });
    const high = securityScore({ memoryKb: 64 * 1024, iterations: 3, parallelism: 4, variant: "argon2id", hashLength: 32 });
    expect(high).toBeGreaterThan(low);
  });
  it("returns a value in 0..100", () => {
    const s = securityScore(base);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("argon2-param-calculator scoreToTier", () => {
  it("maps scores to tiers", () => {
    expect(scoreToTier(10)).toBe("low");
    expect(scoreToTier(45)).toBe("moderate");
    expect(scoreToTier(65)).toBe("strong");
    expect(scoreToTier(85)).toBe("maximum");
  });
});

describe("argon2-param-calculator estimate", () => {
  it("produces a full estimate", () => {
    const e = estimate(base);
    expect(e.estimatedMs).toBeGreaterThan(0);
    expect(e.memoryMb).toBeCloseTo(19, 0);
    expect(e.tier).toMatch(/^(low|moderate|strong|maximum)$/);
  });
  it("warns on low memory", () => {
    const e = estimate({ memoryKb: 64, iterations: 1, parallelism: 1, variant: "argon2id", hashLength: 8 });
    expect(e.warnings.length).toBeGreaterThan(0);
  });
  it("includes notes for non-id variants", () => {
    const e = estimate({ ...base, variant: "argon2i" });
    expect(e.notes.some((n) => n.includes("argon2i"))).toBe(true);
  });
});

describe("argon2-param-calculator tuneForTime", () => {
  it("tunes parameters to reach target time", () => {
    const p = tuneForTime(500, 2, 8 * 1024);
    const est = estimateTimeMs(p);
    expect(est).toBeGreaterThanOrEqual(500);
  });
  it("never returns zero iterations", () => {
    const p = tuneForTime(10, 1, 1024);
    expect(p.iterations).toBeGreaterThanOrEqual(1);
  });
});

describe("argon2-param-calculator memoryTradeoff", () => {
  it("produces points across multipliers", () => {
    const points = memoryTradeoff(base);
    expect(points.length).toBe(5);
    expect(points[0].memoryKb).toBeLessThan(points[4].memoryKb);
  });
});

describe("argon2-param-calculator compareParams", () => {
  it("compares two parameter sets", () => {
    const a = base;
    const b = { ...base, iterations: 4 };
    const cmp = compareParams(a, b);
    expect(cmp.timeRatio).toBeGreaterThan(1);
    expect(cmp.scoreDelta).toBeGreaterThanOrEqual(0);
  });
});

describe("argon2-param-calculator toCliCommand / toOptionsObject", () => {
  it("builds a CLI command", () => {
    const cmd = toCliCommand(base);
    expect(cmd).toContain("argon2");
    expect(cmd).toContain("-t 2");
    expect(cmd).toContain("-p 1");
  });
  it("builds an options object", () => {
    const opts = toOptionsObject(base);
    const parsed = JSON.parse(opts);
    expect(parsed.timeCost).toBe(2);
    expect(parsed.memoryCost).toBe(base.memoryKb);
  });
});

describe("argon2-param-calculator batchEstimate / batchStats", () => {
  it("estimates a batch", () => {
    const items = [
      { label: "low", params: { memoryKb: 1024, iterations: 1, parallelism: 1, variant: "argon2id" as const, hashLength: 16 } },
      { label: "high", params: { memoryKb: 64 * 1024, iterations: 3, parallelism: 4, variant: "argon2id" as const, hashLength: 32 } },
    ];
    const results = batchEstimate(items);
    expect(results.length).toBe(2);
    const stats = batchStats(results);
    expect(stats.count).toBe(2);
    expect(stats.maxScore).toBeGreaterThan(stats.minScore);
  });
  it("batchStats handles empty input", () => {
    const s = batchStats([]);
    expect(s.count).toBe(0);
  });
});

describe("argon2-param-calculator renderBatchCsv / renderReport", () => {
  it("renders CSV with header", () => {
    const csv = renderBatchCsv([]);
    expect(csv.split("\n")[0]).toContain("label,variant");
  });
  it("renders a report", () => {
    const e = estimate(base);
    const r = renderReport(e);
    expect(r).toContain("Argon2 Parameter Report");
    expect(r).toContain("Variant:");
  });
});

describe("argon2-param-calculator presetComparisonTable", () => {
  it("renders comparison CSV for presets", () => {
    const csv = presetComparisonTable();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Preset,Memory");
    expect(lines.length).toBeGreaterThan(2);
  });
});

describe("argon2-param-calculator getPresetLevels / OWASP_PRESET", () => {
  it("returns the OWASP preset", () => {
    expect(OWASP_PRESET.memoryKb).toBe(19 * 1024);
    expect(OWASP_PRESET.iterations).toBe(2);
  });
  it("getPresetLevels returns 6 levels", () => {
    expect(getPresetLevels().length).toBe(6);
  });
});
