import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMAT_MIME,
  FORMAT_PLAIN_MIME,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_ORDER,
  LOSSLESS_FORMATS,
  BITRATE_PRESETS,
  BITRATE_LABELS,
  SAMPLE_RATE_PRESETS,
  SAMPLE_RATE_LABELS,
  CHANNEL_LABELS,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  resolveSampleRate,
  resolveChannelCount,
  needsResample,
  needsChannelChange,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  downmixToMono,
  upmixToStereo,
  estimateWavSizeBytes,
  estimateLossySizeBytes,
  estimateOutputSizeBytes,
  computeQualityScore,
  qualityLabel,
  checkFormatCompatibility,
  stripExtension,
  detectFormatFromFilename,
  generateFilename,
  formatBytes,
  formatDuration,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  encodeWav,
  type AudioFormat,
  type BitratePreset,
  type SampleRatePreset,
  type ChannelPreset,
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
  // Default: MediaRecorder undefined (most test envs)
  (globalThis as Record<string, unknown>).MediaRecorder = undefined;
});

describe("audio-converter constants", () => {
  it("has 5 formats", () => {
    expect(FORMAT_ORDER).toHaveLength(5);
    expect(FORMAT_ORDER).toEqual(["wav", "mp3", "webm", "ogg", "m4a"]);
  });
  it("MIME table covers all formats", () => {
    for (const f of FORMAT_ORDER) {
      expect(FORMAT_MIME[f]).toBeTruthy();
      expect(FORMAT_PLAIN_MIME[f]).toBeTruthy();
      expect(FORMAT_EXTENSIONS[f]).toBeTruthy();
      expect(FORMAT_LABELS[f]).toBeTruthy();
    }
  });
  it("lists WAV as lossless only", () => {
    expect(LOSSLESS_FORMATS).toEqual(["wav"]);
  });
  it("has 4 bitrate presets", () => {
    expect(Object.keys(BITRATE_PRESETS)).toHaveLength(4);
    expect(BITRATE_PRESETS.low).toBe(64_000);
    expect(BITRATE_PRESETS.medium).toBe(128_000);
    expect(BITRATE_PRESETS.high).toBe(192_000);
    expect(BITRATE_PRESETS.lossless).toBe(320_000);
  });
  it("has 4 bitrate labels", () => {
    expect(Object.keys(BITRATE_LABELS)).toHaveLength(4);
  });
  it("has 7 sample-rate presets (6 + auto)", () => {
    expect(Object.keys(SAMPLE_RATE_PRESETS)).toHaveLength(7);
    expect(SAMPLE_RATE_PRESETS["8000"]).toBe(8_000);
    expect(SAMPLE_RATE_PRESETS["44100"]).toBe(44_100);
    expect(SAMPLE_RATE_PRESETS["96000"]).toBe(96_000);
    expect(SAMPLE_RATE_PRESETS.auto).toBe(0);
  });
  it("has 7 sample-rate labels", () => {
    expect(Object.keys(SAMPLE_RATE_LABELS)).toHaveLength(7);
  });
  it("has 3 channel labels", () => {
    expect(Object.keys(CHANNEL_LABELS)).toHaveLength(3);
  });
});

describe("audio-converter format support detection", () => {
  it("WAV is always encodable", () => {
    expect(isFormatEncodable("wav")).toBe(true);
  });
  it("non-WAV formats require MediaRecorder", () => {
    expect(isFormatEncodable("mp3")).toBe(false);
    expect(isFormatEncodable("webm")).toBe(false);
    expect(isFormatEncodable("ogg")).toBe(false);
    expect(isFormatEncodable("m4a")).toBe(false);
  });
  it("detectEncodableFormats returns at least WAV", () => {
    const fmts = detectEncodableFormats();
    expect(fmts).toContain("wav");
  });
  it("pickDefaultOutputFormat falls back to WAV", () => {
    expect(pickDefaultOutputFormat(["wav"])).toBe("wav");
  });
  it("pickDefaultOutputFormat prefers MP3 when available", () => {
    expect(pickDefaultOutputFormat(["wav", "mp3"])).toBe("mp3");
  });
  it("pickDefaultOutputFormat picks WebM when MP3 unavailable", () => {
    expect(pickDefaultOutputFormat(["wav", "webm"])).toBe("webm");
  });
  it("pickDefaultOutputFormat picks OGG when others unavailable", () => {
    expect(pickDefaultOutputFormat(["wav", "ogg"])).toBe("ogg");
  });
  it("pickDefaultOutputFormat picks M4A as last resort", () => {
    expect(pickDefaultOutputFormat(["wav", "m4a"])).toBe("m4a");
  });
});

describe("audio-converter resolveSampleRate", () => {
  it("returns source rate for auto preset", () => {
    expect(resolveSampleRate("auto", 48000)).toBe(48000);
  });
  it("returns explicit preset rate", () => {
    expect(resolveSampleRate("44100", 48000)).toBe(44_100);
  });
  it("falls back to 44100 when source is 0 and auto", () => {
    expect(resolveSampleRate("auto", 0)).toBe(44_100);
  });
});

describe("audio-converter resolveChannelCount", () => {
  it("returns source channels for auto preset", () => {
    expect(resolveChannelCount("auto", 2)).toBe(2);
  });
  it("returns 1 for mono preset", () => {
    expect(resolveChannelCount("mono", 2)).toBe(1);
  });
  it("returns 2 for stereo preset", () => {
    expect(resolveChannelCount("stereo", 1)).toBe(2);
  });
  it("falls back to 1 when source is 0 and auto", () => {
    expect(resolveChannelCount("auto", 0)).toBe(1);
  });
});

describe("audio-converter needsResample / needsChannelChange", () => {
  it("detects when resampling is needed", () => {
    expect(needsResample(44100, 48000)).toBe(true);
  });
  it("detects when resampling is not needed", () => {
    expect(needsResample(44100, 44100)).toBe(false);
  });
  it("detects when channel change is needed", () => {
    expect(needsChannelChange(1, 2)).toBe(true);
  });
  it("detects when channel change is not needed", () => {
    expect(needsChannelChange(2, 2)).toBe(false);
  });
});

describe("audio-converter buildWavHeader", () => {
  it("returns 44-byte header", () => {
    expect(buildWavHeader(1000, 44100, 2)).toHaveLength(44);
  });
  it("contains RIFF marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(0, 4))).toBe("RIFF");
  });
  it("contains WAVE marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(8, 12))).toBe("WAVE");
  });
  it("contains fmt chunk marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(12, 16))).toBe("fmt ");
  });
  it("contains data chunk marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(36, 40))).toBe("data");
  });
  it("encodes file size as 36 + dataLength (little-endian)", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(4, true)).toBe(1036);
  });
  it("encodes sample rate at offset 24", () => {
    const h = buildWavHeader(1000, 48000, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(24, true)).toBe(48000);
  });
  it("encodes channels at offset 22", () => {
    const h = buildWavHeader(1000, 44100, 1);
    const v = new DataView(h.buffer);
    expect(v.getUint16(22, true)).toBe(1);
  });
  it("encodes bits per sample as 16", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint16(34, true)).toBe(16);
  });
  it("computes byte rate = sampleRate × channels × bitsPerSample / 8", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(28, true)).toBe(44100 * 2 * 16 / 8);
  });
});

describe("audio-converter floatSamplesTo16BitPCM", () => {
  it("returns 2 bytes per sample", () => {
    expect(floatSamplesTo16BitPCM(new Float32Array([0, 1, -1]))).toHaveLength(6);
  });
  it("encodes 0 as 0", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([0])).buffer);
    expect(v.getInt16(0, true)).toBe(0);
  });
  it("encodes 1.0 as 32767", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([1])).buffer);
    expect(v.getInt16(0, true)).toBe(32767);
  });
  it("encodes -1.0 as -32767", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([-1])).buffer);
    expect(v.getInt16(0, true)).toBe(-32767);
  });
  it("clamps values above 1", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([2])).buffer);
    expect(v.getInt16(0, true)).toBe(32767);
  });
  it("encodes 0.5 as 16384 (rounded)", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([0.5])).buffer);
    expect(v.getInt16(0, true)).toBe(16384);
  });
});

describe("audio-converter interleaveChannels", () => {
  it("interleaves 2 channels", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(Array.from(interleaveChannels([a, b]))).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("passes single channel through", () => {
    expect(Array.from(interleaveChannels([new Float32Array([1, 2, 3])]))).toEqual([1, 2, 3]);
  });
  it("returns empty for empty input", () => {
    expect(interleaveChannels([])).toHaveLength(0);
  });
});

describe("audio-converter downmixToMono", () => {
  it("averages stereo to mono", () => {
    const a = new Float32Array([0, 2, 4]);
    const b = new Float32Array([2, 4, 6]);
    const mono = downmixToMono([a, b]);
    expect(Array.from(mono)).toEqual([1, 3, 5]);
  });
  it("returns a copy for single-channel input", () => {
    const a = new Float32Array([1, 2, 3]);
    const mono = downmixToMono([a]);
    expect(Array.from(mono)).toEqual([1, 2, 3]);
    // Confirm it's a copy, not the same reference
    expect(mono).not.toBe(a);
  });
  it("returns empty for empty input", () => {
    expect(downmixToMono([])).toHaveLength(0);
  });
});

describe("audio-converter upmixToStereo", () => {
  it("duplicates mono into 2 channels", () => {
    const stereo = upmixToStereo(new Float32Array([1, 2, 3]));
    expect(stereo).toHaveLength(2);
    expect(Array.from(stereo[0])).toEqual([1, 2, 3]);
    expect(Array.from(stereo[1])).toEqual([1, 2, 3]);
  });
  it("returns distinct arrays for each channel", () => {
    const stereo = upmixToStereo(new Float32Array([1, 2]));
    expect(stereo[0]).not.toBe(stereo[1]);
  });
});

describe("audio-converter file size estimators", () => {
  it("estimateWavSizeBytes = 44 + samples × channels × 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 4000);
  });
  it("estimateWavSizeBytes handles zero samples", () => {
    expect(estimateWavSizeBytes(0, 2)).toBe(44);
  });
  it("estimateLossySizeBytes = bitrate × duration / 8", () => {
    expect(estimateLossySizeBytes(128_000, 10)).toBe(160_000);
  });
  it("estimateLossySizeBytes returns 0 for non-positive input", () => {
    expect(estimateLossySizeBytes(0, 10)).toBe(0);
    expect(estimateLossySizeBytes(128_000, 0)).toBe(0);
  });
  it("estimateOutputSizeBytes uses PCM math for WAV", () => {
    expect(estimateOutputSizeBytes("wav", 10, 44100, 2, 128_000))
      .toBe(44 + 44100 * 10 * 2 * 2);
  });
  it("estimateOutputSizeBytes uses bitrate math for lossy", () => {
    expect(estimateOutputSizeBytes("mp3", 10, 44100, 2, 128_000)).toBe(160_000);
  });
});

describe("audio-converter computeQualityScore", () => {
  it("WAV at CD quality scores 100", () => {
    expect(computeQualityScore("wav", 0, 44100, 2)).toBe(100);
  });
  it("WAV at 8k mono scores much lower", () => {
    const score = computeQualityScore("wav", 0, 8000, 1);
    expect(score).toBeLessThan(30);
  });
  it("MP3 at 320 kbps scores 100", () => {
    expect(computeQualityScore("mp3", 320_000, 44100, 2)).toBe(100);
  });
  it("MP3 at 64 kbps scores 20", () => {
    expect(computeQualityScore("mp3", 64_000, 44100, 2)).toBe(20);
  });
  it("MP3 at 128 kbps scores mid-range", () => {
    const score = computeQualityScore("mp3", 128_000, 44100, 2);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(100);
  });
  it("qualityLabel returns correct bucket", () => {
    expect(qualityLabel(95)).toBe("Excellent");
    expect(qualityLabel(75)).toBe("Good");
    expect(qualityLabel(55)).toBe("Fair");
    expect(qualityLabel(35)).toBe("Low");
    expect(qualityLabel(10)).toBe("Poor");
  });
});

describe("audio-converter checkFormatCompatibility", () => {
  it("same format is lossless", () => {
    const r = checkFormatCompatibility("mp3", "mp3");
    expect(r.lossless).toBe(true);
    expect(r.reason).toContain("Same format");
  });
  it("lossy → lossy is lossy", () => {
    const r = checkFormatCompatibility("mp3", "webm");
    expect(r.lossless).toBe(false);
    expect(r.reason).toContain("lossy");
  });
  it("lossless → lossy is lossy", () => {
    const r = checkFormatCompatibility("wav", "mp3");
    expect(r.lossless).toBe(false);
    expect(r.reason).toContain("lossy compression");
  });
  it("lossy → lossless is lossless (no further loss)", () => {
    const r = checkFormatCompatibility("mp3", "wav");
    expect(r.lossless).toBe(true);
    expect(r.reason).toContain("no additional generation loss");
  });
  it("WAV → WAV is lossless", () => {
    const r = checkFormatCompatibility("wav", "wav");
    expect(r.lossless).toBe(true);
  });
  it("unknown source to WAV is lossless", () => {
    const r = checkFormatCompatibility("unknown", "wav");
    expect(r.lossless).toBe(true);
  });
  it("unknown source to lossy is lossy", () => {
    const r = checkFormatCompatibility("unknown", "mp3");
    expect(r.lossless).toBe(false);
  });
});

describe("audio-converter filename helpers", () => {
  it("stripExtension removes last extension", () => {
    expect(stripExtension("voice.mp3")).toBe("voice");
  });
  it("stripExtension handles no extension", () => {
    expect(stripExtension("voice")).toBe("voice");
  });
  it("stripExtension handles multiple dots", () => {
    expect(stripExtension("my.voice.file.mp3")).toBe("my.voice.file");
  });
  it("detectFormatFromFilename recognizes wav", () => {
    expect(detectFormatFromFilename("song.WAV")).toBe("wav");
  });
  it("detectFormatFromFilename recognizes mp3", () => {
    expect(detectFormatFromFilename("song.mp3")).toBe("mp3");
  });
  it("detectFormatFromFilename recognizes m4a", () => {
    expect(detectFormatFromFilename("song.m4a")).toBe("m4a");
  });
  it("detectFormatFromFilename recognizes mp4 as m4a", () => {
    expect(detectFormatFromFilename("song.mp4")).toBe("m4a");
  });
  it("detectFormatFromFilename returns unknown for non-audio", () => {
    expect(detectFormatFromFilename("song.xyz")).toBe("unknown");
  });
  it("generateFilename produces timestamped name", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename("voice.mp3", "wav", date))
      .toBe("voice-converted-2024-01-05-142307.wav");
  });
  it("generateFilename pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename("voice.mp3", "mp3", date))
      .toBe("voice-converted-2024-01-01-010203.mp3");
  });
  it("generateFilename handles empty base", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    expect(generateFilename("", "webm", date))
      .toBe("audio-converted-2024-01-01-000000.webm");
  });
});

describe("audio-converter formatBytes & formatDuration", () => {
  it("formatBytes 0 → '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formatBytes formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formatBytes formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formatDuration formats 0 as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
  it("formatDuration formats 90 as 1:30", () => {
    expect(formatDuration(90)).toBe("1:30");
  });
  it("formatDuration clamps negative to 0:00", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("audio-converter computeSummaryStats", () => {
  it("computes size diff and pct", () => {
    const s = computeSummaryStats(1_000_000, 250_000, 60, 128_000, 44100, 2);
    expect(s.sizeDiffBytes).toBe(-750_000);
    expect(s.sizeDiffPct).toBe(-75);
    expect(s.durationSeconds).toBe(60);
  });
  it("handles zero original size without NaN", () => {
    const s = computeSummaryStats(0, 1000, 1, 64_000, 8000, 1);
    expect(s.sizeDiffPct).toBe(0);
    expect(s.sizeDiffBytes).toBe(1000);
  });
  it("handles larger output (positive diff)", () => {
    const s = computeSummaryStats(250_000, 1_000_000, 60, 320_000, 44100, 2);
    expect(s.sizeDiffBytes).toBe(750_000);
    expect(s.sizeDiffPct).toBe(300);
  });
});

describe("audio-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      originalFormat: "mp3",
      outputFormat: "wav",
      originalSizeBytes: 100_000,
      outputSizeBytes: 500_000,
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 1,
      bitrate: 128_000,
      filename: "voice-converted.wav",
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        originalFormat: "mp3",
        outputFormat: "wav",
        originalSizeBytes: 1,
        outputSizeBytes: 1,
        durationSeconds: 1,
        sampleRate: 44100,
        channels: 1,
        bitrate: 64_000,
        filename: `f-${i}.wav`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", originalFormat: "unknown", outputFormat: "wav",
      originalSizeBytes: 1, outputSizeBytes: 1, durationSeconds: 1,
      sampleRate: 44100, channels: 1, bitrate: 64_000, filename: "x.wav",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", originalFormat: "mp3", outputFormat: "wav",
      originalSizeBytes: 1, outputSizeBytes: 1, durationSeconds: 1,
      sampleRate: 44100, channels: 1, bitrate: 64_000, filename: "a.wav",
    });
    saveHistory({
      ts: 2, originalName: "b", originalFormat: "mp3", outputFormat: "wav",
      originalSizeBytes: 1, outputSizeBytes: 1, durationSeconds: 1,
      sampleRate: 44100, channels: 1, bitrate: 64_000, filename: "b.wav",
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("audio-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      format: "mp3",
      bitrate: "high",
      sampleRate: "44100",
      channels: "stereo",
    });
    expect(url).toContain("format=mp3");
    expect(url).toContain("bitrate=high");
    expect(url).toContain("samplerate=44100");
    expect(url).toContain("channels=stereo");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("format=mp3&bitrate=high&samplerate=44100&channels=stereo");
    expect(p.format).toBe("mp3");
    expect(p.bitrate).toBe("high");
    expect(p.sampleRate).toBe("44100");
    expect(p.channels).toBe("stereo");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown format", () => {
    const p = parseShareUrl("format=xyz");
    expect(p.format).toBeUndefined();
  });
  it("ignores unknown bitrate", () => {
    const p = parseShareUrl("bitrate=ultra");
    expect(p.bitrate).toBeUndefined();
  });
  it("ignores unknown sample rate", () => {
    const p = parseShareUrl("samplerate=99999");
    expect(p.sampleRate).toBeUndefined();
  });
  it("ignores unknown channel", () => {
    const p = parseShareUrl("channels=quad");
    expect(p.channels).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#format=wav");
    expect(p.format).toBe("wav");
  });
});

describe("audio-converter encodeWav (integration)", () => {
  it("encodes single-channel samples to a valid WAV blob", () => {
    const samples = new Float32Array(44100); // 1 second at 44.1kHz
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.5;
    }
    const wav = encodeWav([samples], 44100);
    // header (44) + samples × 2 bytes
    expect(wav.length).toBe(44 + 44100 * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    const v = new DataView(wav.buffer);
    expect(v.getUint32(40, true)).toBe(44100 * 2);
  });
  it("encodes 2 channels with correct byte count", () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100);
    const wav = encodeWav([a, b], 44100);
    // header (44) + 100 samples × 2 channels × 2 bytes
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("handles empty channel array", () => {
    const wav = encodeWav([], 44100);
    expect(wav.length).toBe(44);
  });
  it("encodes channel count correctly in header", () => {
    const wav = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    const v = new DataView(wav.buffer);
    expect(v.getUint16(22, true)).toBe(2);
  });
});

// Suppress unused-import lint
export type _Unused = AudioFormat | BitratePreset | SampleRatePreset | ChannelPreset | HistoryEntry;
