import { describe, it, expect } from "vitest";
import {
  getAllCodecs,
  getCodecById,
  getAllResolutions,
  getResolutionById,
  computeBpp,
  recommendBitrate,
  estimateFileSizeMb,
  streamingBandwidth,
  rateQuality,
  compareCodecs,
  exportComparisonCSV,
  suggestCodec,
  validateInputs,
  youtubeRecommended,
  recommendCRF,
  formatRecommendation,
  CODECS,
  RESOLUTIONS,
} from "./logic";

describe("video-bitrate-guide getAllCodecs", () => {
  it("returns at least 5 codecs", () => {
    expect(getAllCodecs().length).toBeGreaterThanOrEqual(5);
  });
});

describe("video-bitrate-guide getCodecById", () => {
  it("finds h264", () => {
    expect(getCodecById("h264")?.name).toContain("H.264");
  });
  it("returns null for unknown", () => {
    expect(getCodecById("nope")).toBeNull();
  });
});

describe("video-bitrate-guide getAllResolutions / getResolutionById", () => {
  it("returns at least 5 resolutions", () => {
    expect(getAllResolutions().length).toBeGreaterThanOrEqual(5);
  });
  it("finds 4k", () => {
    const r = getResolutionById("4k");
    expect(r?.width).toBe(3840);
  });
});

describe("video-bitrate-guide computeBpp", () => {
  it("computes bpp correctly", () => {
    // 8 Mbps at 1920×1080 @ 30fps: 8e6 / (1920*1080*30) ≈ 0.129
    const v = computeBpp(8, 1920, 1080, 30);
    expect(v).toBeCloseTo(0.129, 2);
  });
  it("returns 0 for invalid inputs", () => {
    expect(computeBpp(8, 0, 0, 30)).toBe(0);
  });
});

describe("video-bitrate-guide recommendBitrate", () => {
  it("returns positive bitrate for valid inputs", () => {
    const c = getCodecById("h264")!;
    const v = recommendBitrate(1920, 1080, 30, c);
    expect(v).toBeGreaterThan(0);
  });

  it("H.265 should be smaller than H.264 for same inputs", () => {
    const h264 = recommendBitrate(1920, 1080, 30, getCodecById("h264")!);
    const h265 = recommendBitrate(1920, 1080, 30, getCodecById("h265")!);
    expect(h265).toBeLessThan(h264);
  });

  it("increases with higher bit depth", () => {
    const c = getCodecById("h264")!;
    const b8 = recommendBitrate(1920, 1080, 30, c, 8);
    const b10 = recommendBitrate(1920, 1080, 30, c, 10);
    expect(b10).toBeGreaterThan(b8);
  });
});

describe("video-bitrate-guide estimateFileSizeMb", () => {
  it("60 sec at 8 Mbps = 60 MB", () => {
    expect(estimateFileSizeMb(60, 8)).toBe(60);
  });
  it("returns 0 for zero duration", () => {
    expect(estimateFileSizeMb(0, 8)).toBe(0);
  });
});

describe("video-bitrate-guide streamingBandwidth", () => {
  it("adds 20% overhead", () => {
    expect(streamingBandwidth(10)).toBe(12);
  });
});

describe("video-bitrate-guide rateQuality", () => {
  it("rates high bpp as excellent", () => {
    expect(rateQuality(0.3).label).toContain("Excellent");
  });
  it("rates low bpp as poor", () => {
    expect(rateQuality(0.01).label).toContain("Poor");
  });
});

describe("video-bitrate-guide compareCodecs", () => {
  it("returns one entry per codec", () => {
    const arr = compareCodecs(1920, 1080, 30, 60);
    expect(arr.length).toBe(CODECS.length);
  });
  it("includes size in MB", () => {
    const arr = compareCodecs(1920, 1080, 30, 60);
    expect(arr[0].sizeMb).toBeGreaterThan(0);
  });
});

describe("video-bitrate-guide exportComparisonCSV", () => {
  it("has header + row per codec", () => {
    const csv = exportComparisonCSV(1920, 1080, 30, 60);
    const lines = csv.split("\n");
    expect(lines.length).toBe(CODECS.length + 1);
    expect(lines[0]).toContain("codec,bitrate_mbps");
  });
});

describe("video-bitrate-guide suggestCodec", () => {
  it("suggests ProRes for editing", () => {
    expect(suggestCodec({ qualityPriority: false, editing: true, bandwidthLimited: false }).id).toBe("prores");
  });
  it("suggests AV1 for bandwidth-limited", () => {
    expect(suggestCodec({ qualityPriority: false, editing: false, bandwidthLimited: true }).id).toBe("av1");
  });
  it("suggests H.265 for quality priority", () => {
    expect(suggestCodec({ qualityPriority: true, editing: false, bandwidthLimited: false }).id).toBe("h265");
  });
});

describe("video-bitrate-guide validateInputs", () => {
  it("warns on zero width", () => {
    expect(validateInputs(0, 1080, 30, 8).some((w) => w.includes("Resolution"))).toBe(true);
  });
  it("warns on absurdly high bitrate", () => {
    expect(validateInputs(1920, 1080, 30, 5000).some((w) => w.includes("1000 Mbps"))).toBe(true);
  });
  it("passes for valid inputs", () => {
    expect(validateInputs(1920, 1080, 30, 8)).toEqual([]);
  });
});

describe("video-bitrate-guide youtubeRecommended", () => {
  it("returns standard and high bitrates for 1080p", () => {
    const r = youtubeRecommended("1080p", 30);
    expect(r).not.toBeNull();
    expect(r!.standard).toBeGreaterThan(0);
    expect(r!.high).toBeGreaterThan(r!.standard);
  });
  it("scales up for high framerate", () => {
    const r30 = youtubeRecommended("1080p", 30)!;
    const r60 = youtubeRecommended("1080p", 60)!;
    expect(r60.standard).toBeGreaterThan(r30.standard);
  });
  it("returns null for unknown resolution", () => {
    expect(youtubeRecommended("999p", 30)).toBeNull();
  });
});

describe("video-bitrate-guide recommendCRF", () => {
  it("archive CRF lower than draft", () => {
    expect(recommendCRF("archive")).toBeLessThan(recommendCRF("draft"));
  });
});

describe("video-bitrate-guide formatRecommendation", () => {
  it("includes resolution and codec name", () => {
    const c = getCodecById("h264")!;
    const txt = formatRecommendation(1920, 1080, 30, c, 8);
    expect(txt).toContain("1920×1080");
    expect(txt).toContain("H.264");
  });
});

describe("video-bitrate-guide RESOLUTIONS sanity", () => {
  it("all resolutions have positive width/height", () => {
    expect(RESOLUTIONS.every((r) => r.width > 0 && r.height > 0)).toBe(true);
  });
});
