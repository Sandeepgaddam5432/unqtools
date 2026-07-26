import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, validateParams, sourceFrames, effectiveInterval,
  selectedFrames, outputDuration, speedupFactor, droppedFrames,
  recommendInterval, recommendOutputFps, estimateOutputBytes, buildPlan,
  generateFfmpegCommand, formatDuration, formatBytes, PRESETS,
} from "./logic";

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects zero source duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, sourceDurationSec: 0 }).ok).toBe(false);
  });
  it("rejects bad FPS", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, sourceFps: 0 }).ok).toBe(false);
    expect(validateParams({ ...DEFAULT_PARAMS, outputFps: 500 }).ok).toBe(false);
  });
  it("rejects zero interval", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, frameIntervalSec: 0 }).ok).toBe(false);
  });
});

describe("sourceFrames", () => {
  it("computes total source frames", () => {
    expect(sourceFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30 })).toBe(300);
  });
});

describe("effectiveInterval", () => {
  it("uses frameInterval by default", () => {
    expect(effectiveInterval(DEFAULT_PARAMS)).toBe(5);
  });
  it("derives from output duration when set", () => {
    const p = { ...DEFAULT_PARAMS, sourceDurationSec: 100, outputFps: 30, outputDurationSec: 10 };
    // target frames = 300 → interval = 100 / 300 ≈ 0.333
    expect(effectiveInterval(p)).toBeCloseTo(0.333, 1);
  });
});

describe("selectedFrames & droppedFrames", () => {
  it("selects one per interval", () => {
    expect(selectedFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 60, frameIntervalSec: 6 })).toBe(10);
  });
  it("minimum 1 frame", () => {
    expect(selectedFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 1, frameIntervalSec: 100 })).toBe(1);
  });
  it("dropped = source - selected", () => {
    const sf = sourceFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 60, sourceFps: 30, frameIntervalSec: 6 });
    const sel = selectedFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 60, frameIntervalSec: 6 });
    const dropped = droppedFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 60, sourceFps: 30, frameIntervalSec: 6 });
    expect(dropped).toBe(sf - sel);
  });
});

describe("outputDuration & speedupFactor", () => {
  it("output = selected / outputFps", () => {
    expect(outputDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 60, frameIntervalSec: 6, outputFps: 30 })).toBeCloseTo(10 / 30, 3);
  });
  it("speedup = source / output", () => {
    const p = { ...DEFAULT_PARAMS, sourceDurationSec: 60, frameIntervalSec: 6, outputFps: 30 };
    const s = speedupFactor(p);
    expect(s).toBeGreaterThan(1);
  });
  it("speedup 0 for zero output", () => {
    expect(speedupFactor({ ...DEFAULT_PARAMS, outputFps: 0 })).toBe(0);
  });
});

describe("recommendInterval & recommendOutputFps", () => {
  it("derives interval from target", () => {
    expect(recommendInterval(100, 10, 30)).toBeCloseTo(100 / 300, 2);
  });
  it("recommends FPS in range", () => {
    expect(recommendOutputFps(300, 10)).toBe(30);
    expect(recommendOutputFps(100, 10)).toBeGreaterThanOrEqual(15);
    expect(recommendOutputFps(100, 10)).toBeLessThanOrEqual(60);
  });
});

describe("estimateOutputBytes", () => {
  it("scales with duration", () => {
    expect(estimateOutputBytes(10, 4)).toBe(5_000_000);
  });
});

describe("buildPlan", () => {
  it("builds full plan", () => {
    const plan = buildPlan({ ...DEFAULT_PARAMS, sourceDurationSec: 60, frameIntervalSec: 6, outputFps: 30 });
    expect(plan.selectedFrames).toBe(10);
    expect(plan.outputFrames).toBe(10);
    expect(plan.sourceFrames).toBe(1800);
    expect(plan.speedupFactor).toBeGreaterThan(1);
  });
  it("adds recommendations for very few frames", () => {
    const plan = buildPlan({ ...DEFAULT_PARAMS, sourceDurationSec: 5, frameIntervalSec: 1 });
    expect(plan.recommendations.length).toBeGreaterThan(0);
  });
  it("includes description", () => {
    const plan = buildPlan(DEFAULT_PARAMS);
    expect(plan.description).toContain("every");
  });
});

describe("generateFfmpegCommand", () => {
  it("uses select filter", () => {
    const cmd = generateFfmpegCommand(DEFAULT_PARAMS);
    expect(cmd).toContain("select=");
    expect(cmd).toContain("setpts");
  });
});

describe("formatters", () => {
  it("formatDuration handles various ranges", () => {
    expect(formatDuration(0.5)).toBe("500ms");
    expect(formatDuration(30)).toBe("30.00s");
    expect(formatDuration(90)).toBe("1m 30.0s");
    expect(formatDuration(3700)).toBe("1h 1m");
  });
  it("formatBytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("PRESETS", () => {
  it("has at least 4 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
  });
  it("each preset has positive values", () => {
    for (const p of PRESETS) {
      expect(p.sourceDurationSec).toBeGreaterThan(0);
      expect(p.frameIntervalSec).toBeGreaterThan(0);
    }
  });
});
