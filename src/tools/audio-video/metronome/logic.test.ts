import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, BPM_MIN, BPM_MAX, validateParams, beatPeriod,
  subdivisionPeriod, barDuration, tempoMarking, buildBarSchedule, buildSchedule,
  totalDuration, tapTempo, roundBpm, adjustBpm, timeSignature, clickSample,
  formatDuration, describeParams,
} from "./logic";

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects BPM too low", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, bpm: 10 }).ok).toBe(false);
  });
  it("rejects BPM too high", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, bpm: 500 }).ok).toBe(false);
  });
  it("rejects bad beat unit", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, beatUnit: 3 }).ok).toBe(false);
  });
  it("rejects mismatched accent pattern", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, beatsPerBar: 3, accentPattern: [true, false] }).ok).toBe(false);
  });
});

describe("beatPeriod & subdivisionPeriod", () => {
  it("120bpm quarter = 0.5s", () => {
    expect(beatPeriod(120, 4)).toBeCloseTo(0.5, 5);
  });
  it("120bpm eighth = 0.25s", () => {
    expect(beatPeriod(120, 8)).toBeCloseTo(0.25, 5);
  });
  it("subdivides correctly", () => {
    expect(subdivisionPeriod(120, 4, 4)).toBeCloseTo(0.125, 5);
  });
});

describe("barDuration", () => {
  it("4/4 at 120bpm = 2s", () => {
    expect(barDuration(DEFAULT_PARAMS)).toBeCloseTo(2, 5);
  });
  it("3/4 at 60bpm = 3s", () => {
    expect(barDuration({ ...DEFAULT_PARAMS, bpm: 60, beatsPerBar: 3, accentPattern: [true, false, false] })).toBeCloseTo(3, 5);
  });
});

describe("tempoMarking", () => {
  it("classifies correctly", () => {
    expect(tempoMarking(50)).toBe("Largo");
    expect(tempoMarking(70)).toBe("Adagio");
    expect(tempoMarking(100)).toBe("Andante");
    expect(tempoMarking(110)).toBe("Moderato");
    expect(tempoMarking(140)).toBe("Allegro");
    expect(tempoMarking(170)).toBe("Vivace");
    expect(tempoMarking(220)).toBe("Presto");
  });
});

describe("buildBarSchedule", () => {
  it("produces beatsPerBar * subdivisions events", () => {
    const events = buildBarSchedule({ ...DEFAULT_PARAMS, subdivisions: 4 });
    expect(events.length).toBe(16);
  });
  it("first event has accent", () => {
    const events = buildBarSchedule(DEFAULT_PARAMS);
    expect(events[0].accent).toBe(true);
  });
  it("subdivision events have lower volume", () => {
    const events = buildBarSchedule({ ...DEFAULT_PARAMS, subdivisions: 2 });
    expect(events[1].volume).toBeLessThan(events[0].volume);
  });
});

describe("buildSchedule", () => {
  it("produces N bars worth of events", () => {
    const events = buildSchedule(DEFAULT_PARAMS, 3);
    expect(events.length).toBe(4 * 3);
  });
  it("events span the total duration", () => {
    const events = buildSchedule(DEFAULT_PARAMS, 2);
    const last = events[events.length - 1];
    expect(last.time).toBeGreaterThan(0);
  });
});

describe("totalDuration", () => {
  it("returns bars * barDuration", () => {
    expect(totalDuration(DEFAULT_PARAMS, 2)).toBeCloseTo(4, 5);
  });
});

describe("tapTempo", () => {
  it("computes average BPM", () => {
    // 4 taps at 500ms intervals = 120 BPM
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  });
  it("returns 0 for less than 2 taps", () => {
    expect(tapTempo([100])).toBe(0);
  });
  it("handles irregular intervals", () => {
    expect(tapTempo([0, 600, 1100, 1700])).toBeGreaterThan(100);
  });
});

describe("roundBpm & adjustBpm", () => {
  it("rounds to integer", () => {
    expect(roundBpm(120.7)).toBe(121);
  });
  it("clamps to min", () => {
    expect(roundBpm(5)).toBe(BPM_MIN);
  });
  it("clamps to max", () => {
    expect(roundBpm(500)).toBe(BPM_MAX);
  });
  it("adjusts BPM with clamping", () => {
    expect(adjustBpm(120, 10)).toBe(130);
    expect(adjustBpm(40, -10)).toBe(BPM_MIN);
    expect(adjustBpm(280, 10)).toBe(BPM_MAX);
  });
});

describe("timeSignature", () => {
  it("formats as N/M", () => {
    expect(timeSignature(4, 4)).toBe("4/4");
    expect(timeSignature(6, 8)).toBe("6/8");
  });
});

describe("clickSample", () => {
  it("produces expected length", () => {
    const s = clickSample(0.5, 8000, 1000, 30);
    expect(s.length).toBe(Math.floor((30 / 1000) * 8000));
  });
  it("has decaying envelope", () => {
    const s = clickSample(0.5, 8000, 1000, 30);
    expect(Math.abs(s[0])).toBeGreaterThan(Math.abs(s[s.length - 1]));
  });
});

describe("formatDuration & describeParams", () => {
  it("formats", () => {
    expect(formatDuration(0.5)).toBe("500ms");
  });
  it("describes params", () => {
    const d = describeParams(DEFAULT_PARAMS);
    expect(d).toContain("BPM: 120");
    expect(d).toContain("Time signature: 4/4");
  });
});
