import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, validateParams, sourceFrames, outputFrames, outputDuration,
  outputFps, interpolatedFrames, recommendInterpolation, recommendTargetFps,
  estimateOutputBytes, buildPlan, generateFfmpegCommand, formatDuration,
  formatBytes, PRESETS,
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
    expect(validateParams({ ...DEFAULT_PARAMS, sourceFps: 500 }).ok).toBe(false);
  });
  it("rejects extreme speed factor", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, speedFactor: 0.01 }).ok).toBe(false);
    expect(validateParams({ ...DEFAULT_PARAMS, speedFactor: 10 }).ok).toBe(false);
  });
  it("rejects bad target FPS", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, targetFps: 500 }).ok).toBe(false);
  });
});

describe("sourceFrames & outputFrames", () => {
  it("computes source frames", () => {
    expect(sourceFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30 })).toBe(300);
  });
  it("computes output frames (slower = more)", () => {
    expect(outputFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30, speedFactor: 0.5 })).toBe(600);
  });
  it("computes output frames (faster = fewer)", () => {
    expect(outputFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30, speedFactor: 2 })).toBe(150);
  });
});

describe("outputDuration & outputFps", () => {
  it("half speed doubles duration", () => {
    expect(outputDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 10, speedFactor: 0.5 })).toBe(20);
  });
  it("uses source fps by default", () => {
    expect(outputFps({ ...DEFAULT_PARAMS, sourceFps: 30 })).toBe(30);
  });
  it("uses override", () => {
    expect(outputFps({ ...DEFAULT_PARAMS, targetFps: 60 })).toBe(60);
  });
});

describe("interpolatedFrames", () => {
  it("counts inserted frames", () => {
    const v = interpolatedFrames({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30, speedFactor: 0.5 });
    expect(v).toBe(300); // 600 - 300
  });
  it("0 for speed-up", () => {
    expect(interpolatedFrames({ ...DEFAULT_PARAMS, speedFactor: 2 })).toBe(0);
  });
});

describe("recommendInterpolation", () => {
  it("returns none for fast", () => {
    expect(recommendInterpolation(0.8)).toBe("none");
  });
  it("returns dup for moderate slow", () => {
    expect(recommendInterpolation(0.6)).toBe("dup");
  });
  it("returns blend for slow", () => {
    expect(recommendInterpolation(0.4)).toBe("blend");
  });
  it("returns mci for very slow", () => {
    expect(recommendInterpolation(0.1)).toBe("mci");
  });
});

describe("recommendTargetFps", () => {
  it("scales fps inversely with speed", () => {
    expect(recommendTargetFps(0.5, 30)).toBe(60);
  });
  it("clamps to 240", () => {
    expect(recommendTargetFps(0.05, 60)).toBe(240);
  });
});

describe("estimateOutputBytes", () => {
  it("scales with duration", () => {
    expect(estimateOutputBytes(10, 4)).toBe(5_000_000);
  });
});

describe("buildPlan", () => {
  it("builds full plan", () => {
    const plan = buildPlan({ ...DEFAULT_PARAMS, sourceDurationSec: 10, sourceFps: 30, speedFactor: 0.5 });
    expect(plan.sourceFrames).toBe(300);
    expect(plan.outputFrames).toBe(600);
    expect(plan.outputDurationSec).toBe(20);
    expect(plan.interpolatedFrames).toBe(300);
    expect(plan.realTimeRatio).toBe(2);
  });
  it("adds warnings for extreme slow", () => {
    const plan = buildPlan({ ...DEFAULT_PARAMS, speedFactor: 0.1, interpolation: "blend" });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
  it("includes description", () => {
    const plan = buildPlan(DEFAULT_PARAMS);
    expect(plan.description).toContain("blend");
  });
});

describe("generateFfmpegCommand", () => {
  it("uses minterpolate for mci", () => {
    const cmd = generateFfmpegCommand({ ...DEFAULT_PARAMS, interpolation: "mci" });
    expect(cmd).toContain("minterpolate");
  });
  it("uses tmix for blend", () => {
    const cmd = generateFfmpegCommand({ ...DEFAULT_PARAMS, interpolation: "blend" });
    expect(cmd).toContain("tmix");
  });
  it("uses setpts with PTS factor", () => {
    const cmd = generateFfmpegCommand({ ...DEFAULT_PARAMS, speedFactor: 0.5 });
    expect(cmd).toContain("setpts=2.000*PTS");
  });
});

describe("formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("500ms");
  });
  it("formatBytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("PRESETS", () => {
  it("has at least 4 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
  });
  it("each preset has speedFactor < 1", () => {
    for (const p of PRESETS) expect(p.speedFactor).toBeLessThanOrEqual(1);
  });
});
