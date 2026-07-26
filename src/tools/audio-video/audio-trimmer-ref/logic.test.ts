import { describe, it, expect } from "vitest";
import {
  getSupportedFormats, getFormatById, formatTimestamp, parseTimestamp, formatBytes,
  validateSegment, invertSilenceRegions, filterShortSilences, planTrim, planBatch,
  renderBatchCsv, renderReport, getFadePresets, generateSilenceDemo, detectSilenceFromAmplitude,
} from "./logic";

describe("audio-trimmer-ref getSupportedFormats", () => {
  it("returns 6 formats", () => { expect(getSupportedFormats().length).toBe(6); });
  it("includes mp3 and wav", () => {
    expect(getFormatById("mp3")).not.toBeNull();
    expect(getFormatById("wav")).not.toBeNull();
  });
  it("returns null for unknown format", () => { expect(getFormatById("x")).toBeNull(); });
});

describe("audio-trimmer-ref formatTimestamp", () => {
  it("formats 0 as 0:00.000", () => { expect(formatTimestamp(0)).toBe("0:00.000"); });
  it("formats 83.456 as 1:23.456", () => { expect(formatTimestamp(83.456)).toBe("1:23.456"); });
  it("clamps negative", () => { expect(formatTimestamp(-5)).toBe("0:00.000"); });
  it("handles NaN", () => { expect(formatTimestamp(NaN)).toBe("0:00.000"); });
});

describe("audio-trimmer-ref parseTimestamp", () => {
  it("parses plain seconds", () => { expect(parseTimestamp("42")).toBe(42); });
  it("parses decimal seconds", () => { expect(parseTimestamp("42.5")).toBe(42.5); });
  it("parses M:SS", () => { expect(parseTimestamp("1:30")).toBe(90); });
  it("parses M:SS.mmm", () => { expect(parseTimestamp("1:23.456")).toBeCloseTo(83.456, 3); });
  it("returns null for invalid", () => { expect(parseTimestamp("abc")).toBeNull(); });
  it("returns null for empty", () => { expect(parseTimestamp("")).toBeNull(); });
});

describe("audio-trimmer-ref formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
  });
});

describe("audio-trimmer-ref validateSegment", () => {
  it("accepts valid segment", () => {
    expect(validateSegment({ startSeconds: 10, endSeconds: 20 }, 60).ok).toBe(true);
  });
  it("rejects negative start", () => {
    expect(validateSegment({ startSeconds: -1, endSeconds: 10 }, 60).ok).toBe(false);
  });
  it("rejects end beyond source", () => {
    expect(validateSegment({ startSeconds: 50, endSeconds: 70 }, 60).ok).toBe(false);
  });
  it("rejects start >= end", () => {
    expect(validateSegment({ startSeconds: 20, endSeconds: 20 }, 60).ok).toBe(false);
  });
});

describe("audio-trimmer-ref invertSilenceRegions", () => {
  it("returns full clip when no silences", () => {
    const out = invertSilenceRegions([], 60);
    expect(out.length).toBe(1);
    expect(out[0].endSeconds).toBe(60);
  });
  it("splits clip around silences", () => {
    const out = invertSilenceRegions([{ startSeconds: 10, endSeconds: 20, durationSeconds: 10 }], 60);
    expect(out.length).toBe(2);
    expect(out[0].startSeconds).toBe(0);
    expect(out[0].endSeconds).toBe(10);
    expect(out[1].startSeconds).toBe(20);
    expect(out[1].endSeconds).toBe(60);
  });
});

describe("audio-trimmer-ref filterShortSilences", () => {
  it("filters silences shorter than minDuration", () => {
    const silences = [
      { startSeconds: 0, endSeconds: 1, durationSeconds: 1 },
      { startSeconds: 10, endSeconds: 15, durationSeconds: 5 },
    ];
    expect(filterShortSilences(silences, 2).length).toBe(1);
  });
});

describe("audio-trimmer-ref planTrim", () => {
  it("plans a single segment trim", () => {
    const r = planTrim({
      sourceDurationSeconds: 60, segments: [{ startSeconds: 10, endSeconds: 30 }],
      fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 },
      outputFormat: "mp3", crossfadeSeconds: 0,
    });
    expect(r.outputSegments.length).toBe(1);
    expect(r.totalOutputSeconds).toBe(20);
    expect(r.estimatedOutputBytes).toBeGreaterThan(0);
    expect(r.ffmpegCommands.length).toBe(1);
    expect(r.ffmpegCommands[0]).toContain("ffmpeg");
    expect(r.ffmpegCommands[0]).toContain("libmp3lame");
  });
  it("warns when fade exceeds segment", () => {
    const r = planTrim({
      sourceDurationSeconds: 60, segments: [{ startSeconds: 10, endSeconds: 11 }],
      fadeIn: { type: "linear", durationSeconds: 1 }, fadeOut: { type: "linear", durationSeconds: 1 },
      outputFormat: "mp3", crossfadeSeconds: 0,
    });
    expect(r.warnings.some((w) => w.includes("Fade total"))).toBe(true);
  });
  it("computes crossfade reduction", () => {
    const r = planTrim({
      sourceDurationSeconds: 60,
      segments: [{ startSeconds: 0, endSeconds: 20 }, { startSeconds: 30, endSeconds: 50 }],
      fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 },
      outputFormat: "mp3", crossfadeSeconds: 2,
    });
    // Total 40s minus 1 crossfade of 2s = 38s
    expect(r.totalOutputSeconds).toBe(38);
  });
  it("warns for empty segments", () => {
    const r = planTrim({
      sourceDurationSeconds: 60, segments: [],
      fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 },
      outputFormat: "mp3", crossfadeSeconds: 0,
    });
    expect(r.warnings.some((w) => w.includes("No valid segments"))).toBe(true);
  });
});

describe("audio-trimmer-ref planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch([
      { sourceDurationSeconds: 60, segments: [{ startSeconds: 0, endSeconds: 30 }], fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 }, outputFormat: "mp3", crossfadeSeconds: 0 },
      { sourceDurationSeconds: 120, segments: [{ startSeconds: 30, endSeconds: 90 }], fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 }, outputFormat: "wav", crossfadeSeconds: 0 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([
      { sourceDurationSeconds: 60, segments: [{ startSeconds: 0, endSeconds: 30 }], fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 }, outputFormat: "mp3", crossfadeSeconds: 0 },
    ]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("audio-trimmer-ref renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planTrim({
      sourceDurationSeconds: 60, segments: [{ startSeconds: 10, endSeconds: 30 }],
      fadeIn: { type: "none", durationSeconds: 0 }, fadeOut: { type: "none", durationSeconds: 0 },
      outputFormat: "mp3", crossfadeSeconds: 0,
    }));
    expect(r).toContain("Audio Trim Plan");
    expect(r).toContain("ffmpeg");
  });
});

describe("audio-trimmer-ref getFadePresets", () => {
  it("returns fade presets including none and long-linear", () => {
    const p = getFadePresets();
    expect(p.some((x) => x.id === "none")).toBe(true);
    expect(p.some((x) => x.id === "long-linear")).toBe(true);
  });
});

describe("audio-trimmer-ref generateSilenceDemo", () => {
  it("generates silences at regular intervals", () => {
    const s = generateSilenceDemo(120, 30, 2);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].durationSeconds).toBe(2);
  });
});

describe("audio-trimmer-ref detectSilenceFromAmplitude", () => {
  it("detects silence regions from amplitude samples", () => {
    // 1 second of silence + 1 second of signal at 10 Hz sample rate
    const samples = new Array(20).fill(0).map((_, i) => (i < 10 ? 0.01 : 0.5));
    const out = detectSilenceFromAmplitude(samples, 0.1, 0.5, 10);
    expect(out.length).toBe(1);
    expect(out[0].durationSeconds).toBeGreaterThanOrEqual(0.5);
  });
});
