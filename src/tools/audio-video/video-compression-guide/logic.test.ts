import { describe, it, expect } from "vitest";
import {
  getAllCodecs, getCodecById, getQualityPresets, getQualityPreset, getResolutions, getResolution,
  getFpsOptions, estimateBitrateKbps, planCompression, planBatch, renderBatchCsv, renderReport,
  recommendCodec, suggestResolution, formatBytes,
} from "./logic";

describe("video-compression-guide getAllCodecs", () => {
  it("returns 4 codecs (h264/h265/vp9/av1)", () => {
    expect(getAllCodecs().length).toBe(4);
    expect(getAllCodecs().map((c) => c.id)).toEqual(expect.arrayContaining(["h264", "h265", "vp9", "av1"]));
  });
});

describe("video-compression-guide getCodecById", () => {
  it("finds h264 by id", () => {
    expect(getCodecById("h264")?.encoder).toBe("libx264");
  });
  it("returns null for unknown id", () => {
    expect(getCodecById("x")).toBeNull();
  });
});

describe("video-compression-guide getQualityPresets", () => {
  it("returns 6 presets", () => {
    expect(getQualityPresets().length).toBe(6);
  });
  it("archive preset has CRF 18", () => {
    expect(getQualityPreset("archive")?.crf).toBe(18);
  });
});

describe("video-compression-guide getResolutions", () => {
  it("includes 1080p and 4k", () => {
    expect(getResolutions().some((r) => r.id === "1080p")).toBe(true);
    expect(getResolutions().some((r) => r.id === "4k")).toBe(true);
  });
  it("4k has correct dimensions", () => {
    expect(getResolution("4k")).toEqual(expect.objectContaining({ width: 3840, height: 2160 }));
  });
});

describe("video-compression-guide getFpsOptions", () => {
  it("includes 24, 30, 60", () => {
    const fps = getFpsOptions().map((f) => f.fps);
    expect(fps).toEqual(expect.arrayContaining([24, 30, 60]));
  });
});

describe("video-compression-guide estimateBitrateKbps", () => {
  it("returns 0 for unknown codec", () => {
    expect(estimateBitrateKbps("x", "1080p", 30, "balanced")).toBe(0);
  });
  it("AV1 produces lower bitrate than H.264 for same settings", () => {
    const h264 = estimateBitrateKbps("h264", "1080p", 30, "balanced");
    const av1 = estimateBitrateKbps("av1", "1080p", 30, "balanced");
    expect(av1).toBeLessThan(h264);
  });
  it("higher resolution yields higher bitrate", () => {
    const low = estimateBitrateKbps("h264", "480p", 30, "balanced");
    const high = estimateBitrateKbps("h264", "1080p", 30, "balanced");
    expect(high).toBeGreaterThan(low);
  });
  it("higher FPS yields higher bitrate", () => {
    const low = estimateBitrateKbps("h264", "1080p", 30, "balanced");
    const high = estimateBitrateKbps("h264", "1080p", 60, "balanced");
    expect(high).toBeGreaterThan(low);
  });
});

describe("video-compression-guide planCompression", () => {
  it("computes total bitrate including audio", () => {
    const r = planCompression({ codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 });
    expect(r.audioBitrateKbps).toBe(128);
    expect(r.totalBitrateKbps).toBe(r.videoBitrateKbps + 128);
    expect(r.estimatedSizeBytes).toBeGreaterThan(0);
  });
  it("includes ffmpeg command", () => {
    const r = planCompression({ codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 });
    expect(r.ffmpegCommand).toContain("ffmpeg");
    expect(r.ffmpegCommand).toContain("libx264");
    expect(r.ffmpegCommand).toContain("-crf 23");
  });
  it("warns when CRF out of codec range", () => {
    const r = planCompression({ codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "smallest", durationSeconds: 60, audioBitrateKbps: 128 });
    expect(r.warnings.some((w) => w.includes("above recommended range"))).toBe(true);
  });
  it("warns when FPS out of range", () => {
    const r = planCompression({ codec: "h264", resolution: "1080p", fps: 500, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 });
    expect(r.warnings.some((w) => w.includes("FPS"))).toBe(true);
  });
  it("adds AV1 slow preset note", () => {
    const r = planCompression({ codec: "av1", resolution: "1080p", fps: 30, qualityPreset: "archive", durationSeconds: 60, audioBitrateKbps: 128 });
    expect(r.notes.some((n) => n.includes("AV1"))).toBe(true);
  });
});

describe("video-compression-guide planBatch / renderBatchCsv", () => {
  it("plans multiple jobs", () => {
    const rs = planBatch([
      { codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 },
      { codec: "av1", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV with header", () => {
    const csv = renderBatchCsv(planBatch([
      { codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 },
    ]));
    expect(csv.split("\n")[0]).toContain("codec,resolution");
    expect(csv.split("\n")[1]).toContain("h264,1080p");
  });
});

describe("video-compression-guide renderReport", () => {
  it("renders multi-line report", () => {
    const r = renderReport(planCompression({ codec: "h264", resolution: "1080p", fps: 30, qualityPreset: "balanced", durationSeconds: 60, audioBitrateKbps: 128 }));
    expect(r).toContain("Video Compression Plan");
    expect(r).toContain("ffmpeg");
    expect(r).toContain("Estimated size");
  });
});

describe("video-compression-guide recommendCodec", () => {
  it("recommends H.264 for web", () => {
    expect(recommendCodec("web")?.id).toBe("h264");
  });
  it("recommends HEVC for archive", () => {
    expect(recommendCodec("archive")?.id).toBe("h265");
  });
  it("returns null for unknown use case", () => {
    // @ts-expect-error testing unknown case
    expect(recommendCodec("xyz")).toBeNull();
  });
});

describe("video-compression-guide suggestResolution", () => {
  it("suggests 1080p for 1920x1080", () => {
    expect(suggestResolution(1920, 1080)?.id).toBe("1080p");
  });
  it("suggests 4k for 3840x2160", () => {
    expect(suggestResolution(3840, 2160)?.id).toBe("4k");
  });
});

describe("video-compression-guide formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(0)).toBe("0 B");
  });
});
