import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, validateParams, effectiveDuration, totalDuration, loopStartTimes,
  detectSeamlessLoop, estimateOutputBytes, recommendCrossfade, recommendLoopCount,
  buildLoopPlan, formatDuration, formatBytes, generateFfmpegCommand, loopFactor,
} from "./logic";

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects non-positive duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, sourceDurationSec: 0 }).ok).toBe(false);
  });
  it("rejects loop count out of range", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, loopCount: 0 }).ok).toBe(false);
    expect(validateParams({ ...DEFAULT_PARAMS, loopCount: 200 }).ok).toBe(false);
  });
  it("rejects crossfade > 5", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, crossfadeSec: 10 }).ok).toBe(false);
  });
  it("rejects trim > duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, trimStartSec: 20, sourceDurationSec: 10 }).ok).toBe(false);
  });
});

describe("effectiveDuration", () => {
  it("subtracts trims", () => {
    expect(effectiveDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 10, trimStartSec: 2, trimEndSec: 3 })).toBe(5);
  });
  it("clamps to 0", () => {
    expect(effectiveDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 1, trimStartSec: 5 })).toBe(0);
  });
});

describe("totalDuration", () => {
  it("multiplies by loop count", () => {
    expect(totalDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 10, loopCount: 3, crossfadeSec: 0 })).toBe(30);
  });
  it("subtracts crossfade overlap", () => {
    const t = totalDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 10, loopCount: 3, crossfadeSec: 1 });
    expect(t).toBe(28); // 30 - 2 * 1
  });
  it("returns 0 for zero effective", () => {
    expect(totalDuration({ ...DEFAULT_PARAMS, sourceDurationSec: 0 })).toBe(0);
  });
});

describe("loopStartTimes", () => {
  it("starts at 0", () => {
    expect(loopStartTimes(DEFAULT_PARAMS)[0]).toBe(0);
  });
  it("generates N times", () => {
    expect(loopStartTimes({ ...DEFAULT_PARAMS, loopCount: 4 }).length).toBe(4);
  });
  it("scales by effective duration minus crossfade", () => {
    const times = loopStartTimes({ ...DEFAULT_PARAMS, sourceDurationSec: 10, loopCount: 3, crossfadeSec: 1 });
    expect(times[1]).toBe(9); // 10 - 1
    expect(times[2]).toBe(18);
  });
});

describe("detectSeamlessLoop", () => {
  it("false when no crossfade", () => {
    expect(detectSeamlessLoop({ ...DEFAULT_PARAMS, crossfadeSec: 0 })).toBe(false);
  });
  it("true with reasonable crossfade", () => {
    expect(detectSeamlessLoop({ ...DEFAULT_PARAMS, sourceDurationSec: 10, crossfadeSec: 0.5 })).toBe(true);
  });
});

describe("estimateOutputBytes", () => {
  it("scales with duration and bitrate", () => {
    expect(estimateOutputBytes(10, 4)).toBe(5_000_000);
    expect(estimateOutputBytes(20, 4)).toBe(10_000_000);
  });
});

describe("recommendCrossfade", () => {
  it("0 for very short", () => {
    expect(recommendCrossfade(1)).toBe(0);
  });
  it("0.2 for short", () => {
    expect(recommendCrossfade(3)).toBe(0.2);
  });
  it("1 for long", () => {
    expect(recommendCrossfade(20)).toBe(1);
  });
});

describe("recommendLoopCount", () => {
  it("rounds to nearest integer", () => {
    expect(recommendLoopCount(5, 15)).toBe(3);
  });
  it("minimum 1", () => {
    expect(recommendLoopCount(10, 5)).toBe(1);
  });
});

describe("buildLoopPlan", () => {
  it("builds full plan", () => {
    const plan = buildLoopPlan({ ...DEFAULT_PARAMS, sourceDurationSec: 10, loopCount: 3, crossfadeSec: 0.5 });
    expect(plan.loopCount).toBe(3);
    expect(plan.totalDurationSec).toBe(29);
    expect(plan.seamlessPossible).toBe(true);
    expect(plan.loopPoints.length).toBe(3);
  });
  it("adds recommendations when needed", () => {
    const plan = buildLoopPlan({ ...DEFAULT_PARAMS, sourceDurationSec: 0.5, loopCount: 2, crossfadeSec: 0 });
    expect(plan.recommendations.length).toBeGreaterThan(0);
  });
});

describe("formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("500ms");
    expect(formatDuration(65)).toContain("m");
  });
  it("formatBytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("generateFfmpegCommand", () => {
  it("uses stream_loop for no crossfade", () => {
    const cmd = generateFfmpegCommand({ ...DEFAULT_PARAMS, crossfadeSec: 0, loopCount: 3, sourceDurationSec: 10 });
    expect(cmd).toContain("stream_loop");
    expect(cmd).toContain("input.mp4");
  });
  it("uses xfade for crossfade", () => {
    const cmd = generateFfmpegCommand({ ...DEFAULT_PARAMS, crossfadeSec: 0.5, loopCount: 2, sourceDurationSec: 10 });
    expect(cmd).toContain("xfade");
  });
});

describe("loopFactor", () => {
  it("computes ratio", () => {
    expect(loopFactor({ ...DEFAULT_PARAMS, sourceDurationSec: 10, loopCount: 3, crossfadeSec: 0 })).toBe(3);
  });
  it("1 for zero source", () => {
    expect(loopFactor({ ...DEFAULT_PARAMS, sourceDurationSec: 0 })).toBe(1);
  });
});
