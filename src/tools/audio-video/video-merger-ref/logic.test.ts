import { describe, it, expect } from "vitest";
import {
  getTransitions, getTransition, getOutputCodecs, getOutputCodec, formatBytes, formatDuration,
  planMerge, planBatch, renderBatchCsv, renderReport, makeClip, suggestOutputResolution,
  computeAudioBitrateKbps, validateTransitionForClips,
} from "./logic";

describe("video-merger-ref getTransitions", () => {
  it("returns 8 transitions", () => {
    expect(getTransitions().length).toBe(8);
  });
  it("finds fade transition", () => {
    expect(getTransition("fade")?.durationSeconds).toBe(1);
  });
  it("returns null for unknown", () => {
    expect(getTransition("x")).toBeNull();
  });
});

describe("video-merger-ref getOutputCodecs", () => {
  it("includes h264 and av1", () => {
    expect(getOutputCodec("h264")).not.toBeNull();
    expect(getOutputCodec("av1")).not.toBeNull();
  });
  it("returns null for unknown", () => {
    expect(getOutputCodec("x")).toBeNull();
  });
});

describe("video-merger-ref formatBytes / formatDuration", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
  });
  it("formats duration", () => {
    expect(formatDuration(83)).toBe("1:23");
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
  });
});

describe("video-merger-ref planMerge", () => {
  it("plans simple concat of two matching clips", () => {
    const r = planMerge({
      clips: [makeClip("a", 30), makeClip("b", 30)],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.totalDurationSeconds).toBe(60);
    expect(r.resolutionMatch.ok).toBe(true);
    expect(r.codecMatch.ok).toBe(true);
    expect(r.ffmpegCommand).toContain("ffmpeg");
    expect(r.estimatedSizeBytes).toBeGreaterThan(0);
  });
  it("applies cross-fade reduction", () => {
    const r = planMerge({
      clips: [makeClip("a", 30), makeClip("b", 30)],
      transitionId: "fade", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.totalDurationSeconds).toBe(59);
    expect(r.ffmpegCommand).toContain("xfade");
  });
  it("flags resolution mismatches", () => {
    const r = planMerge({
      clips: [makeClip("a", 30, 1920, 1080), makeClip("b", 30, 1280, 720)],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.resolutionMatch.ok).toBe(false);
    expect(r.resolutionMatch.mismatches.length).toBeGreaterThan(0);
  });
  it("flags codec mismatches", () => {
    const r = planMerge({
      clips: [makeClip("a", 30, 1920, 1080, 30, "h264"), makeClip("b", 30, 1920, 1080, 30, "h265")],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.codecMatch.ok).toBe(false);
  });
  it("flags fps mismatches", () => {
    const r = planMerge({
      clips: [makeClip("a", 30, 1920, 1080, 30), makeClip("b", 30, 1920, 1080, 60)],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.fpsMatch.ok).toBe(false);
  });
  it("warns when audio sample rates differ", () => {
    const r = planMerge({
      clips: [makeClip("a", 30, 1920, 1080, 30, "h264", "aac", 48000), makeClip("b", 30, 1920, 1080, 30, "h264", "aac", 44100)],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.audioSyncWarnings.some((w) => w.includes("sample rate"))).toBe(true);
  });
  it("warns when only one clip has audio", () => {
    const r = planMerge({
      clips: [makeClip("a", 30, 1920, 1080, 30, "h264", "aac", 48000, true), makeClip("b", 30, 1920, 1080, 30, "h264", "aac", 48000, false)],
      transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.audioSyncWarnings.some((w) => w.includes("silent track"))).toBe(true);
  });
  it("warns when no clips provided", () => {
    const r = planMerge({
      clips: [], transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    });
    expect(r.warnings.some((w) => w.includes("No clips"))).toBe(true);
  });
});

describe("video-merger-ref planBatch / renderBatchCsv", () => {
  it("plans multiple merge jobs", () => {
    const rs = planBatch([
      { clips: [makeClip("a", 30), makeClip("b", 30)], transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto" },
      { clips: [makeClip("c", 20), makeClip("d", 20)], transitionId: "fade", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "av1", audioSyncMode: "auto" },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([
      { clips: [makeClip("a", 30), makeClip("b", 30)], transitionId: "none", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto" },
    ]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("video-merger-ref renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planMerge({
      clips: [makeClip("a", 30), makeClip("b", 30)],
      transitionId: "fade", outputWidth: 1920, outputHeight: 1080, outputFps: 30, outputCodec: "h264", audioSyncMode: "auto",
    }));
    expect(r).toContain("Video Merge Plan");
    expect(r).toContain("ffmpeg");
  });
});

describe("video-merger-ref makeClip", () => {
  it("creates a clip with defaults", () => {
    const c = makeClip("x", 60);
    expect(c.width).toBe(1920);
    expect(c.hasAudio).toBe(true);
  });
});

describe("video-merger-ref suggestOutputResolution", () => {
  it("picks the largest clip resolution", () => {
    const r = suggestOutputResolution([makeClip("a", 10, 1280, 720), makeClip("b", 10, 1920, 1080)]);
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });
  it("returns default when no clips", () => {
    const r = suggestOutputResolution([]);
    expect(r.width).toBe(1920);
  });
});

describe("video-merger-ref computeAudioBitrateKbps", () => {
  it("computes bitrate for 2 channels standard", () => {
    expect(computeAudioBitrateKbps(2, "standard")).toBe(128);
  });
  it("clamps to minimum 64 kbps", () => {
    expect(computeAudioBitrateKbps(0)).toBeGreaterThanOrEqual(64);
  });
});

describe("video-merger-ref validateTransitionForClips", () => {
  it("rejects transitions for fewer than 2 clips", () => {
    expect(validateTransitionForClips(getTransition("fade")!, 1).ok).toBe(false);
  });
  it("accepts transitions for 2+ clips", () => {
    expect(validateTransitionForClips(getTransition("fade")!, 3).ok).toBe(true);
  });
});
