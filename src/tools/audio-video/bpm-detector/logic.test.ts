import { describe, it, expect } from "vitest";
import {
  averageInterval, rejectOutliers, msToBpm, bpmToMs, mean, median, stdDev,
  detectBpm, buildTempoMap, predictNextBeat, predictFutureBeats, noteDurations,
  tempoName, normalizeBpm, pruneStaleTaps, formatBpm,
} from "./logic";

describe("averageInterval", () => {
  it("returns 0 for less than 2 taps", () => {
    expect(averageInterval([100])).toBe(0);
  });
  it("computes average", () => {
    expect(averageInterval([0, 500, 1000, 1500])).toBe(500);
  });
});

describe("rejectOutliers", () => {
  it("keeps all taps when consistent", () => {
    const taps = [0, 500, 1000, 1500];
    expect(rejectOutliers(taps).length).toBe(4);
  });
  it("removes outliers", () => {
    const taps = [0, 500, 5000, 1000, 1500];
    const cleaned = rejectOutliers(taps);
    expect(cleaned.length).toBeLessThan(taps.length);
  });
  it("returns short lists as-is", () => {
    expect(rejectOutliers([100, 200])).toEqual([100, 200]);
  });
});

describe("msToBpm & bpmToMs", () => {
  it("500ms = 120 BPM", () => {
    expect(msToBpm(500)).toBe(120);
  });
  it("120 BPM = 500ms", () => {
    expect(bpmToMs(120)).toBe(500);
  });
  it("0 returns 0", () => {
    expect(msToBpm(0)).toBe(0);
    expect(bpmToMs(0)).toBe(0);
  });
});

describe("mean, median, stdDev", () => {
  it("mean", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
  it("median odd", () => {
    expect(median([1, 3, 2])).toBe(2);
  });
  it("median even", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("stdDev", () => {
    expect(stdDev([2, 2, 2])).toBe(0);
    expect(stdDev([1, 3])).toBeCloseTo(1, 5);
  });
});

describe("detectBpm", () => {
  it("returns 0 for empty", () => {
    expect(detectBpm([]).bpm).toBe(0);
  });
  it("returns 0 for single tap", () => {
    expect(detectBpm([100]).bpm).toBe(0);
  });
  it("detects 120 BPM", () => {
    const r = detectBpm([0, 500, 1000, 1500]);
    expect(r.bpm).toBe(120);
    expect(r.confidence).toBeGreaterThan(0.8);
  });
  it("confidence decreases with jitter", () => {
    const stable = detectBpm([0, 500, 1000, 1500]);
    const jittery = detectBpm([0, 600, 900, 1700]);
    expect(stable.confidence).toBeGreaterThanOrEqual(jittery.confidence);
  });
});

describe("buildTempoMap", () => {
  it("computes intervals and bpms", () => {
    const m = buildTempoMap([0, 500, 1000, 1500]);
    expect(m.intervals.length).toBe(3);
    expect(m.bpms.length).toBe(3);
    expect(m.meanBpm).toBe(120);
    expect(m.stability).toBeGreaterThan(0.5);
  });
});

describe("predictNextBeat & predictFutureBeats", () => {
  it("predicts next beat", () => {
    const next = predictNextBeat([0, 500, 1000]);
    expect(next).toBe(1500);
  });
  it("returns 0 for too few taps", () => {
    expect(predictNextBeat([100], 200)).toBe(0);
  });
  it("predicts multiple beats", () => {
    const beats = predictFutureBeats([0, 500, 1000], 3);
    expect(beats.length).toBe(3);
    expect(beats[0]).toBe(1500);
    expect(beats[1]).toBe(2000);
  });
});

describe("noteDurations", () => {
  it("120 BPM quarter = 0.5s", () => {
    const d = noteDurations(120);
    expect(d.quarter).toBe(0.5);
    expect(d.whole).toBe(2);
    expect(d.eighth).toBe(0.25);
  });
});

describe("tempoName", () => {
  it("classifies", () => {
    expect(tempoName(50)).toBe("Largo");
    expect(tempoName(120)).toBe("Allegro");
  });
});

describe("normalizeBpm", () => {
  it("doubles if too low", () => {
    expect(normalizeBpm(40)).toBe(80);
  });
  it("halves if too high", () => {
    expect(normalizeBpm(300)).toBe(150);
  });
  it("keeps in range", () => {
    expect(normalizeBpm(120)).toBe(120);
  });
});

describe("pruneStaleTaps", () => {
  it("removes old taps", () => {
    const taps = [0, 1000, 2000, 10000];
    expect(pruneStaleTaps(taps, 11000, 3000).length).toBe(2);
  });
});

describe("formatBpm", () => {
  it("returns prompt for 0", () => {
    expect(formatBpm({ bpm: 0, intervalMs: 0, confidence: 0, tapCount: 0 })).toContain("Tap");
  });
  it("formats with confidence", () => {
    const s = formatBpm({ bpm: 120, intervalMs: 500, confidence: 0.9, tapCount: 4 });
    expect(s).toContain("120 BPM");
    expect(s).toContain("90%");
  });
});
