import { describe, it, expect } from "vitest";
import {
  getAllFormats, getFormatById, getFormatByExtension, getQualityPresets, getQualityPreset,
  getSampleRates, getChannelConfigs, filterLossless, getCompatibilityMatrix, getCompatForFormat,
  estimateFileSize, estimateWavSize, formatBytes, planConversion, planBatch, renderBatchCsv,
  renderReport, searchFormats,
} from "./logic";

describe("audio-converter-ref getAllFormats", () => {
  it("returns all 6 supported formats", () => {
    expect(getAllFormats().length).toBe(6);
  });
  it("includes mp3, wav, aac, ogg, flac, opus", () => {
    const ids = getAllFormats().map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["mp3", "wav", "aac", "ogg", "flac", "opus"]));
  });
});

describe("audio-converter-ref getFormatById", () => {
  it("finds flac by id", () => {
    const f = getFormatById("flac");
    expect(f).not.toBeNull();
    expect(f!.lossless).toBe(true);
  });
  it("returns null for unknown id", () => {
    expect(getFormatById("nope")).toBeNull();
  });
});

describe("audio-converter-ref getFormatByExtension", () => {
  it("finds by .mp3", () => {
    expect(getFormatByExtension(".mp3")?.id).toBe("mp3");
  });
  it("finds by mp3 without dot, case-insensitive", () => {
    expect(getFormatByExtension("MP3")?.id).toBe("mp3");
  });
  it("returns null for unknown extension", () => {
    expect(getFormatByExtension(".xyz")).toBeNull();
  });
});

describe("audio-converter-ref getQualityPresets", () => {
  it("returns 6 presets", () => {
    expect(getQualityPresets().length).toBe(6);
  });
  it("finds the lossless preset by id", () => {
    expect(getQualityPreset("lossless")?.qualityScore).toBe(100);
  });
  it("returns null for unknown preset", () => {
    expect(getQualityPreset("ultra")).toBeNull();
  });
});

describe("audio-converter-ref getSampleRates / getChannelConfigs", () => {
  it("returns sample rates including 44100 and 48000", () => {
    const rates = getSampleRates();
    expect(rates.some((r) => r.hz === 44100)).toBe(true);
    expect(rates.some((r) => r.hz === 48000)).toBe(true);
  });
  it("channel configs include mono and stereo", () => {
    const configs = getChannelConfigs();
    expect(configs.some((c) => c.id === "mono")).toBe(true);
    expect(configs.some((c) => c.id === "stereo")).toBe(true);
  });
});

describe("audio-converter-ref filterLossless", () => {
  it("lossy formats list excludes FLAC/WAV", () => {
    const lossy = filterLossless(false);
    expect(lossy.every((f) => !f.lossless)).toBe(true);
    expect(lossy.some((f) => f.id === "flac")).toBe(false);
  });
  it("lossless formats list includes FLAC and WAV", () => {
    const ll = filterLossless(true);
    expect(ll.some((f) => f.id === "flac")).toBe(true);
    expect(ll.some((f) => f.id === "wav")).toBe(true);
  });
});

describe("audio-converter-ref compatibility matrix", () => {
  it("returns a cell for every format × browser", () => {
    const m = getCompatibilityMatrix();
    expect(m.length).toBeGreaterThanOrEqual(6 * 5);
  });
  it("MP3 is supported everywhere", () => {
    const cells = getCompatForFormat("mp3");
    expect(cells.every((c) => c.supported === "yes")).toBe(true);
  });
  it("OGG is not supported in Safari", () => {
    const cells = getCompatForFormat("ogg");
    const safari = cells.find((c) => c.browser === "Safari");
    expect(safari?.supported).toBe("no");
  });
});

describe("audio-converter-ref estimateFileSize / estimateWavSize", () => {
  it("computes file size from bitrate and duration", () => {
    expect(estimateFileSize(128, 60)).toBe(960000);
  });
  it("returns 0 for negative inputs", () => {
    expect(estimateFileSize(-1, 10)).toBe(0);
    expect(estimateFileSize(128, -5)).toBe(0);
  });
  it("computes WAV size including 44-byte header", () => {
    expect(estimateWavSize(44100, 2, 16, 1)).toBe(44 + 44100 * 2 * 2 * 1);
  });
});

describe("audio-converter-ref formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });
  it("returns 0 B for negative or NaN", () => {
    expect(formatBytes(-100)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
  });
});

describe("audio-converter-ref planConversion", () => {
  it("produces a result with size estimate and encoder args", () => {
    const r = planConversion({
      sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "standard",
      channelConfig: "stereo", durationSeconds: 60,
    });
    expect(r.source?.id).toBe("wav");
    expect(r.target?.id).toBe("mp3");
    expect(r.estimatedSizeBytes).toBeGreaterThan(0);
    expect(r.recommendedEncoderArgs).toContain("ffmpeg");
    expect(r.recommendedEncoderArgs).toContain("mp3");
  });
  it("warns when downmixing channels beyond target max", () => {
    const r = planConversion({
      sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "standard",
      channelConfig: "7.1", durationSeconds: 10,
    });
    expect(r.warnings.some((w) => w.includes("down-mixing"))).toBe(true);
  });
  it("warns when lossless preset picked with lossy target", () => {
    const r = planConversion({
      sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "lossless",
      channelConfig: "stereo", durationSeconds: 10,
    });
    expect(r.warnings.some((w) => w.includes("Lossless preset"))).toBe(true);
  });
  it("notes quality loss warning when converting lossy → lossless", () => {
    const r = planConversion({
      sourceFormat: "mp3", targetFormat: "flac", qualityPreset: "lossless",
      channelConfig: "stereo", durationSeconds: 10,
    });
    expect(r.notes.some((n) => n.includes("will NOT restore"))).toBe(true);
  });
  it("returns empty args for unknown formats", () => {
    const r = planConversion({
      sourceFormat: "x", targetFormat: "y", qualityPreset: "z",
      channelConfig: "stereo", durationSeconds: 5,
    });
    expect(r.recommendedEncoderArgs).toBe("");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("audio-converter-ref planBatch / renderBatchCsv", () => {
  it("plans batch of multiple jobs", () => {
    const rs = planBatch([
      { sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "standard", channelConfig: "stereo", durationSeconds: 60 },
      { sourceFormat: "wav", targetFormat: "flac", qualityPreset: "lossless", channelConfig: "stereo", durationSeconds: 60 },
    ]);
    expect(rs.length).toBe(2);
    expect(rs[0].target?.id).toBe("mp3");
    expect(rs[1].target?.id).toBe("flac");
  });
  it("renders CSV with header row", () => {
    const csv = renderBatchCsv(planBatch([
      { sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "standard", channelConfig: "stereo", durationSeconds: 30 },
    ]));
    expect(csv.split("\n")[0]).toContain("source,target");
    expect(csv.split("\n")[1]).toContain("wav,mp3");
  });
});

describe("audio-converter-ref renderReport", () => {
  it("renders a multi-line report", () => {
    const r = renderReport(planConversion({
      sourceFormat: "wav", targetFormat: "mp3", qualityPreset: "standard",
      channelConfig: "stereo", durationSeconds: 60,
    }));
    expect(r).toContain("Audio Conversion Plan");
    expect(r).toContain("ffmpeg");
    expect(r).toContain("Estimated size");
  });
});

describe("audio-converter-ref searchFormats", () => {
  it("returns all when query is empty", () => {
    expect(searchFormats("").length).toBe(6);
  });
  it("finds by use case keyword", () => {
    const r = searchFormats("podcast");
    expect(r.some((f) => f.id === "mp3")).toBe(true);
  });
});
