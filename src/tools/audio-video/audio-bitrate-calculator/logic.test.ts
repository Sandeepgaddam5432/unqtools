import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_RATES,
  BIT_DEPTHS,
  CHANNEL_LAYOUTS,
  FORMATS,
  QUALITY_PRESETS,
  QUALITY_BITRATE_MAP,
  LOSSLESS_RATIOS,
  getBitDepth,
  getChannelLayout,
  getFormat,
  getQualityPreset,
  mapQualityToBitrate,
  computePcmBitrate,
  computeFileSizeBytes,
  estimateFileSize,
  computeEffectiveBitrate,
  estimateLosslessSize,
  computeStreamingRequirement,
  reverseCalculateBitrate,
  computeQualityScore,
  computeAll,
  compareFormats,
  formatBytes,
  formatBitrate,
  formatDuration,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudioFormatId,
  type BitDepthId,
  type ChannelLayoutId,
  type QualityPreset,
  type HistoryEntry,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---- Constants ----

describe("audio-bitrate-calculator constants", () => {
  it("has 7 sample rates", () => {
    expect(SAMPLE_RATES).toHaveLength(7);
    expect(SAMPLE_RATES.map((s) => s.hz)).toContain(44100);
    expect(SAMPLE_RATES.map((s) => s.hz)).toContain(192000);
  });

  it("has 5 bit depths", () => {
    expect(BIT_DEPTHS).toHaveLength(5);
    expect(BIT_DEPTHS.map((b) => b.id)).toEqual(["8", "16", "24", "32", "32-float"]);
  });

  it("has 4 channel layouts", () => {
    expect(CHANNEL_LAYOUTS).toHaveLength(4);
    expect(CHANNEL_LAYOUTS.map((c) => c.channels)).toEqual([1, 2, 6, 8]);
  });

  it("has 7 formats", () => {
    expect(FORMATS).toHaveLength(7);
    expect(FORMATS.map((f) => f.id)).toEqual(["pcm", "flac", "alac", "mp3", "aac", "ogg", "opus"]);
  });

  it("has 5 quality presets", () => {
    expect(QUALITY_PRESETS).toHaveLength(5);
    expect(QUALITY_PRESETS.map((q) => q.id)).toEqual(["low", "medium", "high", "voice", "music"]);
  });

  it("has quality bitrate map for lossy formats", () => {
    expect(QUALITY_BITRATE_MAP.mp3.high).toBe(192);
    expect(QUALITY_BITRATE_MAP.opus.voice).toBe(24);
    expect(QUALITY_BITRATE_MAP.aac.music).toBe(256);
  });

  it("lossless ratios are in 0..1 range", () => {
    expect(LOSSLESS_RATIOS.flac).toBeGreaterThan(0.4);
    expect(LOSSLESS_RATIOS.flac).toBeLessThan(0.7);
    expect(LOSSLESS_RATIOS.alac).toBeGreaterThan(LOSSLESS_RATIOS.flac);
  });
});

// ---- Lookups ----

describe("audio-bitrate-calculator lookups", () => {
  it("getBitDepth returns info by id", () => {
    expect(getBitDepth("16").bits).toBe(16);
    expect(getBitDepth("32-float").format).toBe("float");
  });

  it("getBitDepth falls back to 16-bit for unknown", () => {
    expect(getBitDepth("99" as BitDepthId).bits).toBe(16);
  });

  it("getChannelLayout returns info by id", () => {
    expect(getChannelLayout("stereo").channels).toBe(2);
    expect(getChannelLayout("5.1").channels).toBe(6);
  });

  it("getChannelLayout falls back to stereo", () => {
    expect(getChannelLayout("3.1" as ChannelLayoutId).channels).toBe(2);
  });

  it("getFormat returns info by id", () => {
    expect(getFormat("pcm").compression).toBe("lossless");
    expect(getFormat("mp3").compression).toBe("lossy");
    expect(getFormat("mp3").hasQualityPreset).toBe(true);
  });

  it("getFormat falls back to pcm", () => {
    expect(getFormat("xyz" as AudioFormatId).id).toBe("pcm");
  });

  it("getQualityPreset returns info by id", () => {
    expect(getQualityPreset("high").id).toBe("high");
  });

  it("getQualityPreset falls back to medium", () => {
    expect(getQualityPreset("invalid" as QualityPreset).id).toBe("medium");
  });
});

// ---- mapQualityToBitrate ----

describe("audio-bitrate-calculator mapQualityToBitrate", () => {
  it("returns mapped bitrate for lossy formats", () => {
    expect(mapQualityToBitrate("mp3", "high")).toBe(192);
    expect(mapQualityToBitrate("opus", "voice")).toBe(24);
  });

  it("returns 0 for lossless formats", () => {
    expect(mapQualityToBitrate("pcm", "high")).toBe(0);
    expect(mapQualityToBitrate("flac", "medium")).toBe(0);
  });
});

// ---- computePcmBitrate ----

describe("audio-bitrate-calculator computePcmBitrate", () => {
  it("computes CD quality bitrate", () => {
    // 44100 × 16 × 2 = 1,411,200 bps
    expect(computePcmBitrate(44100, "16", "stereo")).toBe(1_411_200);
  });

  it("computes mono 8-bit bitrate", () => {
    // 8000 × 8 × 1 = 64,000 bps
    expect(computePcmBitrate(8000, "8", "mono")).toBe(64_000);
  });

  it("computes 24-bit hi-res surround", () => {
    // 96000 × 24 × 6 = 13,824,000 bps
    expect(computePcmBitrate(96000, "24", "5.1")).toBe(13_824_000);
  });

  it("handles 32-bit float", () => {
    // 48000 × 32 × 2 = 3,072,000 bps
    expect(computePcmBitrate(48000, "32-float", "stereo")).toBe(3_072_000);
  });
});

// ---- computeFileSizeBytes ----

describe("audio-bitrate-calculator computeFileSizeBytes", () => {
  it("computes size = bitrate × duration / 8", () => {
    // 1,411,200 bps × 60 s / 8 = 10,584,000 bytes (1 min CD audio ≈ 10.1 MB)
    expect(computeFileSizeBytes(1_411_200, 60)).toBe(10_584_000);
  });

  it("returns 0 for negative inputs", () => {
    expect(computeFileSizeBytes(-100, 60)).toBe(0);
    expect(computeFileSizeBytes(1000, -5)).toBe(0);
  });

  it("returns 0 for zero duration", () => {
    expect(computeFileSizeBytes(1411200, 0)).toBe(0);
  });
});

// ---- estimateFileSize ----

describe("audio-bitrate-calculator estimateFileSize", () => {
  it("estimates PCM size (no compression)", () => {
    const size = estimateFileSize("pcm", 60, 44100, "16", "stereo", "high");
    expect(size).toBe(10_584_000);
  });

  it("estimates FLAC size (≈55% of PCM)", () => {
    const pcmSize = estimateFileSize("pcm", 60, 44100, "16", "stereo", "high");
    const flacSize = estimateFileSize("flac", 60, 44100, "16", "stereo", "high");
    expect(flacSize).toBeCloseTo(pcmSize * 0.55, -2);
  });

  it("estimates ALAC size (≈60% of PCM)", () => {
    const pcmSize = estimateFileSize("pcm", 60, 44100, "16", "stereo", "high");
    const alacSize = estimateFileSize("alac", 60, 44100, "16", "stereo", "high");
    expect(alacSize).toBeCloseTo(pcmSize * 0.60, -2);
  });

  it("estimates MP3 size from quality preset", () => {
    // MP3 high = 192 kbps × 60 s / 8 = 1,440,000 bytes
    const size = estimateFileSize("mp3", 60, 44100, "16", "stereo", "high");
    expect(size).toBe(1_440_000);
  });

  it("estimates Opus voice size", () => {
    // Opus voice = 24 kbps × 60 s / 8 = 180,000 bytes
    const size = estimateFileSize("opus", 60, 48000, "16", "mono", "voice");
    expect(size).toBe(180_000);
  });

  it("returns 0 for zero duration", () => {
    expect(estimateFileSize("mp3", 0, 44100, "16", "stereo", "high")).toBe(0);
  });
});

// ---- computeEffectiveBitrate ----

describe("audio-bitrate-calculator computeEffectiveBitrate", () => {
  it("returns PCM bitrate for pcm format", () => {
    expect(computeEffectiveBitrate("pcm", 44100, "16", "stereo", "high")).toBe(1_411_200);
  });

  it("returns compressed bitrate for FLAC", () => {
    // PCM = 1,411,200 × 0.55 = 776,160
    expect(computeEffectiveBitrate("flac", 44100, "16", "stereo", "high")).toBe(776_160);
  });

  it("returns preset bitrate for lossy formats", () => {
    expect(computeEffectiveBitrate("mp3", 44100, "16", "stereo", "high")).toBe(192_000);
    expect(computeEffectiveBitrate("opus", 48000, "16", "mono", "voice")).toBe(24_000);
  });
});

// ---- estimateLosslessSize ----

describe("audio-bitrate-calculator estimateLosslessSize", () => {
  it("multiplies PCM size by ratio", () => {
    expect(estimateLosslessSize(1_000_000, 0.55)).toBe(550_000);
  });

  it("clamps ratio to 0..1", () => {
    expect(estimateLosslessSize(1_000, -1)).toBe(0);
    expect(estimateLosslessSize(1_000, 1.5)).toBe(1_000);
  });
});

// ---- computeStreamingRequirement ----

describe("audio-bitrate-calculator computeStreamingRequirement", () => {
  it("returns the bitrate as the streaming requirement", () => {
    expect(computeStreamingRequirement(192_000)).toBe(192_000);
  });

  it("returns 0 for negative input", () => {
    expect(computeStreamingRequirement(-100)).toBe(0);
  });
});

// ---- reverseCalculateBitrate ----

describe("audio-bitrate-calculator reverseCalculateBitrate", () => {
  it("computes required bitrate from target size and duration", () => {
    // 5 MB, 60 seconds → 5×1024×1024×8 / 60 / 1000 = 699.05 kbps
    const kbps = reverseCalculateBitrate(5, 60);
    expect(kbps).toBeCloseTo(699.05, 1);
  });

  it("returns 0 for zero duration", () => {
    expect(reverseCalculateBitrate(5, 0)).toBe(0);
  });

  it("returns 0 for zero size", () => {
    expect(reverseCalculateBitrate(0, 60)).toBe(0);
  });
});

// ---- computeQualityScore ----

describe("audio-bitrate-calculator computeQualityScore", () => {
  it("scores CD-quality lossless at 80", () => {
    // 16-bit + 44.1 kHz: depth>=16 → 80, sampleRate is not >= 48000 so no bonus
    expect(computeQualityScore("pcm", 1411, 44100, "16")).toBe(80);
  });

  it("scores 48 kHz lossless with bonus", () => {
    // 16-bit + 48 kHz: depth>=16 → 80, sampleRate >= 48000 → +4 = 84
    expect(computeQualityScore("pcm", 1536, 48000, "16")).toBe(84);
  });

  it("scores hi-res 24-bit at 90+", () => {
    expect(computeQualityScore("flac", 4608, 96000, "24")).toBeGreaterThanOrEqual(95);
  });

  it("scores MP3 transparent at 320 kbps", () => {
    expect(computeQualityScore("mp3", 320)).toBe(100);
  });

  it("scores MP3 high (192 kbps) at 90", () => {
    expect(computeQualityScore("mp3", 192)).toBe(90);
  });

  it("scores MP3 medium (128 kbps) at 75", () => {
    expect(computeQualityScore("mp3", 128)).toBe(75);
  });

  it("scores Opus voice (24 kbps) at 40", () => {
    expect(computeQualityScore("opus", 24)).toBe(40);
  });

  it("scores very low bitrate at 20", () => {
    expect(computeQualityScore("mp3", 8)).toBe(20);
  });

  it("scores zero bitrate as 0", () => {
    expect(computeQualityScore("mp3", 0)).toBe(0);
  });

  it("scores low sample rate lossless lower", () => {
    expect(computeQualityScore("pcm", 64, 8000, "8")).toBeLessThan(60);
  });
});

// ---- computeAll ----

describe("audio-bitrate-calculator computeAll", () => {
  it("computes all stats for PCM CD quality 60s", () => {
    const stats = computeAll({
      format: "pcm", durationSeconds: 60,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo",
      quality: "high",
    });
    expect(stats.format).toBe("pcm");
    expect(stats.bitrateBps).toBe(1_411_200);
    expect(stats.bitrateKbps).toBeCloseTo(1411.2, 1);
    expect(stats.fileSizeBytes).toBe(10_584_000);
    expect(stats.streamingBps).toBe(1_411_200);
    expect(stats.qualityScore).toBeGreaterThan(70);
  });

  it("computes all stats for MP3 high 3min", () => {
    const stats = computeAll({
      format: "mp3", durationSeconds: 180,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo",
      quality: "high",
    });
    expect(stats.bitrateBps).toBe(192_000);
    expect(stats.bitrateKbps).toBe(192);
    // 192 kbps × 180 s / 8 = 4,320,000 bytes
    expect(stats.fileSizeBytes).toBe(4_320_000);
    expect(stats.qualityScore).toBe(90);
  });

  it("computes all stats for FLAC 24-bit hi-res", () => {
    const stats = computeAll({
      format: "flac", durationSeconds: 300,
      sampleRateHz: 96000, bitDepth: "24", channels: "stereo",
      quality: "high",
    });
    expect(stats.bitrateBps).toBeGreaterThan(0);
    expect(stats.qualityScore).toBeGreaterThanOrEqual(95);
  });
});

// ---- compareFormats ----

describe("audio-bitrate-calculator compareFormats", () => {
  it("produces comparison rows", () => {
    const a = computeAll({ format: "pcm", durationSeconds: 60, sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high" });
    const b = computeAll({ format: "mp3", durationSeconds: 60, sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high" });
    const rows = compareFormats(a, b);
    expect(rows.length).toBeGreaterThan(0);
    const bitrateRow = rows.find((r) => r.property === "Bitrate (kbps)");
    expect(bitrateRow).toBeTruthy();
    expect(bitrateRow!.formatA).toContain("1411");
    expect(bitrateRow!.formatB).toContain("192");
  });

  it("shows size difference", () => {
    const a = computeAll({ format: "pcm", durationSeconds: 60, sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high" });
    const b = computeAll({ format: "mp3", durationSeconds: 60, sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high" });
    const rows = compareFormats(a, b);
    const diffRow = rows.find((r) => r.property === "Size difference");
    expect(diffRow).toBeTruthy();
    // MP3 is much smaller, so size difference is negative
    expect(diffRow!.formatB).toContain("-");
  });
});

// ---- Formatters ----

describe("audio-bitrate-calculator formatters", () => {
  it("formatBytes returns 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formatBytes returns KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });

  it("formatBytes returns MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });

  it("formatBitrate returns bps for small values", () => {
    expect(formatBitrate(500)).toBe("500 bps");
  });

  it("formatBitrate returns kbps", () => {
    expect(formatBitrate(192_000)).toBe("192.0 kbps");
  });

  it("formatBitrate returns Mbps", () => {
    expect(formatBitrate(1_411_200)).toBe("1.41 Mbps");
  });

  it("formatDuration returns MM:SS for short durations", () => {
    expect(formatDuration(90)).toBe("01:30");
  });

  it("formatDuration returns HH:MM:SS for long durations", () => {
    expect(formatDuration(3723)).toBe("01:02:03");
  });

  it("formatDuration handles 0", () => {
    expect(formatDuration(0)).toBe("00:00");
  });
});

// ---- Renderers ----

describe("audio-bitrate-calculator renderTextReport", () => {
  it("includes format, bitrate, file size", () => {
    const stats = computeAll({
      format: "mp3", durationSeconds: 180,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high",
    });
    const text = renderTextReport(stats);
    expect(text).toContain("MP3");
    expect(text).toContain("192.0 kbps");
    expect(text).toContain("Quality score");
    expect(text).toContain("90/100");
  });

  it("includes streaming requirement", () => {
    const stats = computeAll({
      format: "pcm", durationSeconds: 60,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high",
    });
    const text = renderTextReport(stats);
    expect(text).toContain("Streaming req");
    expect(text).toContain("must be");
  });
});

describe("audio-bitrate-calculator renderCsvReport", () => {
  it("renders header row", () => {
    const stats = computeAll({
      format: "pcm", durationSeconds: 60,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high",
    });
    const csv = renderCsvReport(stats);
    expect(csv.startsWith("property,value")).toBe(true);
  });

  it("renders key=value rows", () => {
    const stats = computeAll({
      format: "mp3", durationSeconds: 60,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high",
    });
    const csv = renderCsvReport(stats);
    expect(csv).toContain("format_id,mp3");
    expect(csv).toContain("bitrate_kbps,192.00");
  });

  it("escapes commas in values", () => {
    const stats = computeAll({
      format: "pcm", durationSeconds: 60,
      sampleRateHz: 44100, bitDepth: "16", channels: "stereo", quality: "high",
    });
    const csv = renderCsvReport(stats);
    // The format label "PCM / WAV (uncompressed)" contains no comma but contains spaces — should be unescaped
    expect(csv).toContain("PCM / WAV (uncompressed)");
  });
});

// ---- History ----

describe("audio-bitrate-calculator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, format: "mp3", durationSeconds: 180,
      bitrateKbps: 192, fileSizeBytes: 4_320_000, qualityScore: 90,
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0]).toEqual(entry);
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, format: "pcm", durationSeconds: 60,
        bitrateKbps: 1411, fileSizeBytes: 10_000_000, qualityScore: 84,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, format: "pcm", durationSeconds: 60,
      bitrateKbps: 1411, fileSizeBytes: 10_000_000, qualityScore: 84,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("orders most-recent first", () => {
    saveHistory({ ts: 1, format: "mp3", durationSeconds: 1, bitrateKbps: 1, fileSizeBytes: 1, qualityScore: 1 });
    saveHistory({ ts: 2, format: "mp3", durationSeconds: 1, bitrateKbps: 1, fileSizeBytes: 1, qualityScore: 1 });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

// ---- Shareable URL ----

describe("audio-bitrate-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      format: "mp3",
      duration: "180",
      sampleRate: "44100",
      bitDepth: "16",
      channels: "stereo",
      quality: "high",
    });
    expect(url).toContain("format=mp3");
    expect(url).toContain("duration=180");
    expect(url).toContain("samplerate=44100");
    expect(url).toContain("bitdepth=16");
    expect(url).toContain("channels=stereo");
    expect(url).toContain("quality=high");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("format=mp3&duration=180&samplerate=44100&bitdepth=16&channels=stereo&quality=high");
    expect(p.format).toBe("mp3");
    expect(p.duration).toBe("180");
    expect(p.sampleRate).toBe("44100");
    expect(p.bitDepth).toBe("16");
    expect(p.channels).toBe("stereo");
    expect(p.quality).toBe("high");
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters unknown values", () => {
    const p = parseShareUrl("format=xyz&bitdepth=99&channels=foo&quality=invalid");
    expect(p.format).toBeUndefined();
    expect(p.bitDepth).toBeUndefined();
    expect(p.channels).toBeUndefined();
    expect(p.quality).toBeUndefined();
  });

  it("strips leading #", () => {
    const p = parseShareUrl("#format=opus&quality=voice");
    expect(p.format).toBe("opus");
    expect(p.quality).toBe("voice");
  });
});

// Suppress unused-import lint
export type _Unused = AudioFormatId | BitDepthId | ChannelLayoutId | QualityPreset;
