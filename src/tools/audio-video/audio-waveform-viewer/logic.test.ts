import { describe, it, expect, beforeEach } from "vitest";
import {
  CHANNEL_VIEWS,
  CHANNEL_VIEW_LABELS,
  ZOOM_PRESETS,
  ZOOM_TO_NUMBER,
  ZOOM_LABELS,
  SILENCE_THRESHOLD_PRESETS,
  SILENCE_THRESHOLD_TO_DB,
  SILENCE_THRESHOLD_LABELS,
  MIN_SILENCE_DURATION_PRESETS,
  MIN_SILENCE_DURATION_TO_MS,
  MIN_SILENCE_DURATION_LABELS,
  WAVEFORM_COLOR_PRESETS,
  WAVEFORM_COLOR_LABELS,
  monoMix,
  selectChannel,
  computeWindowSize,
  computePeakPerWindow,
  computeRmsPerWindow,
  dbToAmplitude,
  amplitudeToDb,
  detectSilenceRegions,
  findTopPeaks,
  getWaveformColor,
  computeWaveformStats,
  formatTimestamp,
  formatDb,
  renderText,
  renderCsv,
  renderSilenceCsv,
  _escapeCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChannelView,
  type ZoomPreset,
  type SilenceThresholdPreset,
  type MinSilenceDurationPreset,
  type WaveformColorPreset,
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

describe("waveform-viewer constants", () => {
  it("has 4 channel views", () => {
    expect(CHANNEL_VIEWS).toHaveLength(4);
    expect(CHANNEL_VIEWS).toContain("left");
    expect(CHANNEL_VIEWS).toContain("mono-mix");
  });
  it("has 4 channel labels", () => {
    expect(Object.keys(CHANNEL_VIEW_LABELS)).toHaveLength(4);
  });
  it("has 6 zoom presets", () => {
    expect(ZOOM_PRESETS).toHaveLength(6);
    expect(ZOOM_PRESETS).toEqual(["1", "2", "5", "10", "50", "100"]);
  });
  it("maps zoom presets to numbers", () => {
    expect(ZOOM_TO_NUMBER["1"]).toBe(1);
    expect(ZOOM_TO_NUMBER["100"]).toBe(100);
  });
  it("has 6 zoom labels", () => {
    expect(Object.keys(ZOOM_LABELS)).toHaveLength(6);
  });
  it("has 5 silence threshold presets", () => {
    expect(SILENCE_THRESHOLD_PRESETS).toHaveLength(5);
    expect(SILENCE_THRESHOLD_PRESETS).toEqual(["-30", "-40", "-50", "-60", "-80"]);
  });
  it("maps silence thresholds to dB values", () => {
    expect(SILENCE_THRESHOLD_TO_DB["-30"]).toBe(-30);
    expect(SILENCE_THRESHOLD_TO_DB["-80"]).toBe(-80);
  });
  it("has 5 silence threshold labels", () => {
    expect(Object.keys(SILENCE_THRESHOLD_LABELS)).toHaveLength(5);
  });
  it("has 5 min silence duration presets", () => {
    expect(MIN_SILENCE_DURATION_PRESETS).toHaveLength(5);
    expect(MIN_SILENCE_DURATION_PRESETS).toContain("500ms");
    expect(MIN_SILENCE_DURATION_PRESETS).toContain("2s");
  });
  it("maps min silence durations to ms values", () => {
    expect(MIN_SILENCE_DURATION_TO_MS["100ms"]).toBe(100);
    expect(MIN_SILENCE_DURATION_TO_MS["1s"]).toBe(1000);
    expect(MIN_SILENCE_DURATION_TO_MS["2s"]).toBe(2000);
  });
  it("has 5 min silence duration labels", () => {
    expect(Object.keys(MIN_SILENCE_DURATION_LABELS)).toHaveLength(5);
  });
  it("has 5 waveform color presets", () => {
    expect(WAVEFORM_COLOR_PRESETS).toHaveLength(5);
    expect(WAVEFORM_COLOR_PRESETS).toEqual(["blue", "green", "red", "purple", "mono"]);
  });
  it("has 5 waveform color labels", () => {
    expect(Object.keys(WAVEFORM_COLOR_LABELS)).toHaveLength(5);
  });
});

// ---- monoMix & selectChannel ----

describe("waveform-viewer monoMix", () => {
  it("averages two channels", () => {
    const left = new Float32Array([1, 2, 3]);
    const right = new Float32Array([3, 4, 5]);
    const mono = monoMix([left, right]);
    expect(Array.from(mono)).toEqual([2, 3, 4]);
  });
  it("returns copy for single channel", () => {
    const single = new Float32Array([1, 2, 3]);
    const mono = monoMix([single]);
    expect(Array.from(mono)).toEqual([1, 2, 3]);
    // Confirm it's a copy
    mono[0] = 99;
    expect(single[0]).toBe(1);
  });
  it("handles three channels", () => {
    const a = new Float32Array([3, 6, 9]);
    const b = new Float32Array([3, 6, 9]);
    const c = new Float32Array([3, 6, 9]);
    const mono = monoMix([a, b, c]);
    expect(Array.from(mono)).toEqual([3, 6, 9]);
  });
  it("returns empty for no channels", () => {
    expect(monoMix([])).toHaveLength(0);
  });
  it("handles mismatched lengths (uses shortest)", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([5, 6]);
    const mono = monoMix([a, b]);
    expect(mono).toHaveLength(2);
    expect(mono[0]).toBe(3);
    expect(mono[1]).toBe(4);
  });
});

describe("waveform-viewer selectChannel", () => {
  const left = new Float32Array([1, 2, 3]);
  const right = new Float32Array([4, 5, 6]);

  it("selects left channel", () => {
    const out = selectChannel([left, right], "left");
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("selects right channel", () => {
    const out = selectChannel([left, right], "right");
    expect(Array.from(out)).toEqual([4, 5, 6]);
  });
  it("returns left for 'both'", () => {
    const out = selectChannel([left, right], "both");
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("returns mono mix for 'mono-mix'", () => {
    const out = selectChannel([left, right], "mono-mix");
    expect(Array.from(out)).toEqual([2.5, 3.5, 4.5]);
  });
  it("falls back to channel 0 for right when only 1 channel", () => {
    const out = selectChannel([left], "right");
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("returns empty for no channels", () => {
    expect(selectChannel([], "left")).toHaveLength(0);
  });
});

// ---- computeWindowSize ----

describe("waveform-viewer computeWindowSize", () => {
  it("computes samples-per-pixel at zoom 1 (whole file visible)", () => {
    // 44100 samples, 100 pixels, zoom 1 → 441 samples per pixel
    expect(computeWindowSize(44100, 100, 1)).toBe(441);
  });
  it("reduces samples-per-pixel at higher zoom", () => {
    const z1 = computeWindowSize(44100, 100, 1);
    const z10 = computeWindowSize(44100, 100, 10);
    expect(z10).toBeLessThan(z1);
    expect(z10).toBe(44); // 44100 / (100*10) = 44.1 → floor 44
  });
  it("returns at least 1 sample per pixel", () => {
    expect(computeWindowSize(10, 100, 1)).toBe(1);
  });
  it("handles 0 pixels (returns 1)", () => {
    expect(computeWindowSize(44100, 0, 1)).toBe(1);
  });
  it("handles 0 samples (returns 1)", () => {
    expect(computeWindowSize(0, 100, 1)).toBe(1);
  });
  it("handles 0 zoom (returns 1)", () => {
    expect(computeWindowSize(44100, 100, 0)).toBe(1);
  });
});

// ---- Peak / RMS ----

describe("waveform-viewer computePeakPerWindow", () => {
  it("computes max abs per window", () => {
    const samples = new Float32Array([0.1, -0.5, 0.3, -0.8, 0.2, 0.6]);
    const peaks = computePeakPerWindow(samples, 3);
    // Window 0: [0.1, -0.5, 0.3] → 0.5
    // Window 1: [-0.8, 0.2, 0.6] → 0.8
    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toBeCloseTo(0.5, 5);
    expect(peaks[1]).toBeCloseTo(0.8, 5);
  });
  it("handles uneven last window", () => {
    const samples = new Float32Array([1, 2, 3, 4]);
    const peaks = computePeakPerWindow(samples, 3);
    // Window 0: [1, 2, 3] → 3
    // Window 1: [4] → 4
    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toBe(3);
    expect(peaks[1]).toBe(4);
  });
  it("handles empty input", () => {
    expect(computePeakPerWindow(new Float32Array(0), 10)).toHaveLength(0);
  });
  it("treats windowSize < 1 as 1", () => {
    const samples = new Float32Array([0.5, -0.3, 0.7]);
    const peaks = computePeakPerWindow(samples, 0);
    expect(peaks).toHaveLength(3);
    expect(peaks[0]).toBeCloseTo(0.5, 5);
    expect(peaks[1]).toBeCloseTo(0.3, 5);
    expect(peaks[2]).toBeCloseTo(0.7, 5);
  });
});

describe("waveform-viewer computeRmsPerWindow", () => {
  it("computes RMS per window", () => {
    const samples = new Float32Array([3, 4, 0, 0]);
    const rms = computeRmsPerWindow(samples, 2);
    // Window 0: sqrt((9+16)/2) = sqrt(12.5) ≈ 3.536
    expect(rms).toHaveLength(2);
    expect(rms[0]).toBeCloseTo(Math.sqrt(12.5), 4);
    expect(rms[1]).toBeCloseTo(0, 5);
  });
  it("handles empty input", () => {
    expect(computeRmsPerWindow(new Float32Array(0), 10)).toHaveLength(0);
  });
  it("handles uneven last window", () => {
    const samples = new Float32Array([2, 2, 2]);
    const rms = computeRmsPerWindow(samples, 2);
    // Window 0: sqrt((4+4)/2) = 2
    // Window 1: sqrt(4/1) = 2
    expect(rms).toHaveLength(2);
    expect(rms[0]).toBeCloseTo(2, 5);
    expect(rms[1]).toBeCloseTo(2, 5);
  });
});

// ---- dBFS conversion ----

describe("waveform-viewer dB conversion", () => {
  it("dbToAmplitude(0) = 1", () => {
    expect(dbToAmplitude(0)).toBeCloseTo(1, 5);
  });
  it("dbToAmplitude(-6) ≈ 0.501", () => {
    expect(dbToAmplitude(-6)).toBeCloseTo(0.501, 2);
  });
  it("dbToAmplitude(-Infinity) = 0", () => {
    expect(dbToAmplitude(Number.NEGATIVE_INFINITY)).toBe(0);
  });
  it("amplitudeToDb(1) = 0", () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 5);
  });
  it("amplitudeToDb(0.5) ≈ -6.02", () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206, 3);
  });
  it("amplitudeToDb(0) = -Infinity", () => {
    expect(amplitudeToDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("amplitudeToDb(negative) = -Infinity", () => {
    expect(amplitudeToDb(-1)).toBe(Number.NEGATIVE_INFINITY);
  });
});

// ---- Silence detection ----

describe("waveform-viewer detectSilenceRegions", () => {
  const sampleRate = 8000;

  it("detects a single silence region", () => {
    // 1 second: loud 0.4s, silent 0.4s, loud 0.2s
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate * 0.4; i++) samples[i] = 0.5;
    // silence 0.4s
    for (let i = sampleRate * 0.4; i < sampleRate * 0.8; i++) samples[i] = 0.001;
    for (let i = sampleRate * 0.8; i < sampleRate; i++) samples[i] = 0.5;
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(1);
    expect(regions[0].startSeconds).toBeGreaterThanOrEqual(0.3);
    expect(regions[0].endSeconds).toBeLessThanOrEqual(0.85);
    expect(regions[0].durationSeconds).toBeGreaterThan(0.1);
  });

  it("skips regions shorter than minDuration", () => {
    // Loud, brief silence (50ms), loud — should be filtered out at 100ms threshold
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate * 0.4; i++) samples[i] = 0.5;
    for (let i = sampleRate * 0.4; i < sampleRate * 0.45; i++) samples[i] = 0.001;
    for (let i = sampleRate * 0.45; i < sampleRate; i++) samples[i] = 0.5;
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(0);
  });

  it("detects multiple silence regions", () => {
    // Loud, silent, loud, silent, loud
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate * 0.2; i++) samples[i] = 0.5;
    for (let i = sampleRate * 0.2; i < sampleRate * 0.4; i++) samples[i] = 0.001;
    for (let i = sampleRate * 0.4; i < sampleRate * 0.6; i++) samples[i] = 0.5;
    for (let i = sampleRate * 0.6; i < sampleRate * 0.8; i++) samples[i] = 0.001;
    for (let i = sampleRate * 0.8; i < sampleRate; i++) samples[i] = 0.5;
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(2);
  });

  it("returns empty for fully loud audio", () => {
    const samples = new Float32Array(sampleRate).fill(0.5);
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(0);
  });

  it("returns one region for fully silent audio", () => {
    const samples = new Float32Array(sampleRate).fill(0.001);
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(1);
    expect(regions[0].durationSeconds).toBeGreaterThan(0.9);
  });

  it("respects threshold amplitude", () => {
    // Audio at 0.05 amplitude — below threshold 0.1, above threshold 0.01
    const samples = new Float32Array(sampleRate).fill(0.05);
    const r1 = detectSilenceRegions(samples, sampleRate, 0.1, 100);
    expect(r1).toHaveLength(1);
    const r2 = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(r2).toHaveLength(0);
  });

  it("handles empty samples", () => {
    expect(detectSilenceRegions(new Float32Array(0), sampleRate, 0.01, 100)).toEqual([]);
  });

  it("handles zero sample rate", () => {
    const samples = new Float32Array(100).fill(0.001);
    expect(detectSilenceRegions(samples, 0, 0.01, 100)).toEqual([]);
  });

  it("captures trailing silence region", () => {
    // Loud 0.3s then silent 0.7s
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate * 0.3; i++) samples[i] = 0.5;
    for (let i = sampleRate * 0.3; i < sampleRate; i++) samples[i] = 0.001;
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(1);
    expect(regions[0].startSeconds).toBeLessThan(0.5);
    expect(regions[0].endSeconds).toBeGreaterThan(0.9);
  });

  it("records peak amplitude within region", () => {
    const samples = new Float32Array(sampleRate).fill(0.001);
    samples[1000] = 0.006; // bump inside the silent region (still below 0.01 threshold)
    const regions = detectSilenceRegions(samples, sampleRate, 0.01, 100);
    expect(regions).toHaveLength(1);
    expect(regions[0].peakAmplitude).toBeGreaterThan(0.005);
  });
});

// ---- findTopPeaks ----

describe("waveform-viewer findTopPeaks", () => {
  it("finds top-N peaks sorted by amplitude descending", () => {
    const peaks = new Float32Array([0.1, 0.5, 0.3, 0.9, 0.2, 0.7]);
    const top = findTopPeaks(peaks, 10, 44100, 3);
    expect(top).toHaveLength(3);
    expect(top[0].amplitude).toBeCloseTo(0.9, 5);
    expect(top[1].amplitude).toBeCloseTo(0.7, 5);
    expect(top[2].amplitude).toBeCloseTo(0.5, 5);
  });
  it("computes correct timestamp for window index", () => {
    const peaks = new Float32Array([0.5, 0.7, 0.9]);
    const top = findTopPeaks(peaks, 100, 44100, 3);
    expect(top[0].sampleIndex).toBe(200); // window 2 × windowSize 100
    expect(top[0].timestampSeconds).toBeCloseTo(200 / 44100, 6);
  });
  it("handles empty peaks array", () => {
    expect(findTopPeaks(new Float32Array(0), 100, 44100, 5)).toEqual([]);
  });
  it("handles topN=0", () => {
    const peaks = new Float32Array([0.5, 0.7]);
    expect(findTopPeaks(peaks, 100, 44100, 0)).toEqual([]);
  });
  it("limits to available peaks", () => {
    const peaks = new Float32Array([0.1, 0.2]);
    const top = findTopPeaks(peaks, 100, 44100, 10);
    expect(top).toHaveLength(2);
  });
  it("records amplitudeDb correctly", () => {
    const peaks = new Float32Array([1.0]);
    const top = findTopPeaks(peaks, 100, 44100, 1);
    expect(top[0].amplitudeDb).toBeCloseTo(0, 5);
  });
});

// ---- Color presets ----

describe("waveform-viewer getWaveformColor", () => {
  it("returns 4 color strings per preset", () => {
    for (const p of WAVEFORM_COLOR_PRESETS) {
      const colors = getWaveformColor(p);
      expect(typeof colors.peak).toBe("string");
      expect(typeof colors.rms).toBe("string");
      expect(typeof colors.silence).toBe("string");
      expect(typeof colors.background).toBe("string");
    }
  });
  it("blue preset returns blue peak color", () => {
    const colors = getWaveformColor("blue");
    expect(colors.peak).toContain("#");
  });
  it("mono preset returns white peak", () => {
    const colors = getWaveformColor("mono");
    expect(colors.peak.toLowerCase()).toBe("#ffffff");
  });
  it("all presets use the same dark background", () => {
    const bg = getWaveformColor("blue").background;
    for (const p of WAVEFORM_COLOR_PRESETS) {
      expect(getWaveformColor(p).background).toBe(bg);
    }
  });
});

// ---- computeWaveformStats ----

describe("waveform-viewer computeWaveformStats", () => {
  it("computes duration, peak, RMS", () => {
    const samples = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const stats = computeWaveformStats(samples, 44100, 1, [], []);
    expect(stats.durationSeconds).toBeCloseTo(4 / 44100, 6);
    expect(stats.peakAmplitude).toBeCloseTo(0.5, 5);
    expect(stats.rmsAmplitude).toBeCloseTo(0.5, 5);
    expect(stats.peakAmplitudeDb).toBeCloseTo(-6.0206, 3);
  });
  it("computes silence percentage", () => {
    const samples = new Float32Array(44100);
    const regions = [
      { startSeconds: 0.25, endSeconds: 0.75, durationSeconds: 0.5, startSample: 11025, endSample: 33075, peakAmplitude: 0.001 },
    ];
    const stats = computeWaveformStats(samples, 44100, 1, regions, []);
    expect(stats.silenceCount).toBe(1);
    expect(stats.silenceTotalSeconds).toBeCloseTo(0.5, 5);
    expect(stats.silencePct).toBeCloseTo(50, 1);
  });
  it("handles empty samples", () => {
    const stats = computeWaveformStats(new Float32Array(0), 44100, 1, [], []);
    expect(stats.durationSeconds).toBe(0);
    expect(stats.peakAmplitude).toBe(0);
    expect(stats.peakAmplitudeDb).toBe(Number.NEGATIVE_INFINITY);
    expect(stats.silencePct).toBe(0);
  });
  it("computes zero silencePct when no silence", () => {
    const samples = new Float32Array(100).fill(0.5);
    const stats = computeWaveformStats(samples, 44100, 1, [], []);
    expect(stats.silencePct).toBe(0);
    expect(stats.silenceCount).toBe(0);
  });
  it("records peak timestamp", () => {
    const samples = new Float32Array([0.1, 0.2, 0.9, 0.3]);
    const stats = computeWaveformStats(samples, 44100, 1, [], []);
    expect(stats.peakTimestampSeconds).toBeCloseTo(2 / 44100, 6);
  });
});

// ---- Formatters ----

describe("waveform-viewer formatters", () => {
  it("formatTimestamp formats 0 as 00:00.000", () => {
    expect(formatTimestamp(0)).toBe("00:00.000");
  });
  it("formatTimestamp formats 90.25 as 01:30.250", () => {
    expect(formatTimestamp(90.25)).toBe("01:30.250");
  });
  it("formatTimestamp handles negative as 0", () => {
    expect(formatTimestamp(-5)).toBe("00:00.000");
  });
  it("formatTimestamp handles NaN as 0", () => {
    expect(formatTimestamp(Number.NaN)).toBe("00:00.000");
  });
  it("formatDb formats finite", () => {
    expect(formatDb(-6.0206)).toBe("-6.02 dB");
  });
  it("formatDb formats -Infinity", () => {
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe("-∞ dB");
  });
});

// ---- Renderers ----

describe("waveform-viewer renderText", () => {
  const analysis = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    channelView: "mono-mix" as const,
    zoom: 1,
    silenceThresholdDb: -50,
    minSilenceDurationMs: 500,
    stats: {
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 2,
      totalSamples: 441000,
      peakAmplitude: 0.9,
      peakAmplitudeDb: 0.915,
      peakTimestampSeconds: 5.5,
      rmsAmplitude: 0.3,
      rmsAmplitudeDb: -10.46,
      silenceCount: 2,
      silenceTotalSeconds: 1.5,
      silencePct: 15,
      peakCount: 5,
    },
    silenceRegions: [
      { startSeconds: 1, endSeconds: 1.5, durationSeconds: 0.5, startSample: 44100, endSample: 66150, peakAmplitude: 0.005 },
    ],
    peaks: [
      { sampleIndex: 242550, timestampSeconds: 5.5, amplitude: 0.9, amplitudeDb: -0.915 },
    ],
  };

  it("renders header with file info", () => {
    const text = renderText(analysis);
    expect(text).toContain("Audio Waveform Analysis Report");
    expect(text).toContain("test.wav");
    expect(text).toContain("Sample rate: 44100 Hz");
  });
  it("renders summary section", () => {
    const text = renderText(analysis);
    expect(text).toContain("Summary");
    expect(text).toContain("Peak amplitude");
    expect(text).toContain("RMS amplitude");
    expect(text).toContain("Silence regions: 2");
  });
  it("renders silence regions", () => {
    const text = renderText(analysis);
    expect(text).toContain("Silence Regions");
    expect(text).toContain("00:01.000");
  });
  it("renders peaks section", () => {
    const text = renderText(analysis);
    expect(text).toContain("Top Amplitude Peaks");
  });
  it("renders no-silence message when empty", () => {
    const text = renderText({ ...analysis, silenceRegions: [] });
    expect(text).toContain("no silence regions detected");
  });
  it("renders no-peaks message when empty", () => {
    const text = renderText({ ...analysis, peaks: [] });
    expect(text).toContain("no peaks found");
  });
});

describe("waveform-viewer renderCsv", () => {
  const analysis = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    channelView: "left" as const,
    zoom: 1,
    silenceThresholdDb: -50,
    minSilenceDurationMs: 500,
    stats: {
      durationSeconds: 10, sampleRate: 44100, channels: 2, totalSamples: 441000,
      peakAmplitude: 0.9, peakAmplitudeDb: 0.915, peakTimestampSeconds: 5.5,
      rmsAmplitude: 0.3, rmsAmplitudeDb: -10.46,
      silenceCount: 1, silenceTotalSeconds: 0.5, silencePct: 5, peakCount: 1,
    },
    silenceRegions: [
      { startSeconds: 1, endSeconds: 1.5, durationSeconds: 0.5, startSample: 44100, endSample: 66150, peakAmplitude: 0.005 },
    ],
    peaks: [
      { sampleIndex: 242550, timestampSeconds: 5.5, amplitude: 0.9, amplitudeDb: -0.915 },
    ],
  };

  it("renders header row", () => {
    const csv = renderCsv(analysis);
    expect(csv).toContain("timestamp,amplitude,amplitude_db,type,duration_seconds");
  });
  it("renders peak rows", () => {
    const csv = renderCsv(analysis);
    expect(csv).toContain("peak");
    expect(csv).toContain("5.5000");
  });
  it("renders silence start/end rows", () => {
    const csv = renderCsv(analysis);
    expect(csv).toContain("silence_start");
    expect(csv).toContain("silence_end");
    expect(csv).toContain("1.0000");
    expect(csv).toContain("1.5000");
  });
});

describe("waveform-viewer renderSilenceCsv", () => {
  const analysis = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    channelView: "left" as const,
    zoom: 1,
    silenceThresholdDb: -50,
    minSilenceDurationMs: 500,
    stats: {
      durationSeconds: 10, sampleRate: 44100, channels: 2, totalSamples: 441000,
      peakAmplitude: 0.9, peakAmplitudeDb: 0.915, peakTimestampSeconds: 5.5,
      rmsAmplitude: 0.3, rmsAmplitudeDb: -10.46,
      silenceCount: 1, silenceTotalSeconds: 0.5, silencePct: 5, peakCount: 1,
    },
    silenceRegions: [
      { startSeconds: 1, endSeconds: 1.5, durationSeconds: 0.5, startSample: 44100, endSample: 66150, peakAmplitude: 0.005 },
    ],
    peaks: [],
  };

  it("renders header", () => {
    const csv = renderSilenceCsv(analysis);
    expect(csv).toContain("start_seconds,end_seconds,duration_seconds,peak_amplitude,peak_db");
  });
  it("renders silence rows", () => {
    const csv = renderSilenceCsv(analysis);
    expect(csv).toContain("1.0000,1.5000,0.5000");
  });
  it("renders -Infinity for 0 amplitude", () => {
    const r2 = {
      ...analysis,
      silenceRegions: [
        { startSeconds: 0, endSeconds: 1, durationSeconds: 1, startSample: 0, endSample: 44100, peakAmplitude: 0 },
      ],
    };
    const csv = renderSilenceCsv(r2);
    expect(csv).toContain("-Infinity");
  });
});

describe("waveform-viewer _escapeCsv", () => {
  it("escapes commas", () => {
    expect(_escapeCsv("a,b")).toBe('"a,b"');
  });
  it("escapes quotes by doubling", () => {
    expect(_escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });
  it("leaves plain text alone", () => {
    expect(_escapeCsv("hello")).toBe("hello");
  });
});

// ---- History ----

describe("waveform-viewer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      fileName: "test.wav",
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 2,
      channelView: "mono-mix",
      zoom: 1,
      silenceThresholdDb: -50,
      minSilenceDurationMs: 500,
      silenceCount: 2,
      silencePct: 15,
      peakCount: 5,
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f-${i}.wav`, durationSeconds: 1, sampleRate: 44100,
        channels: 1, channelView: "left", zoom: 1, silenceThresholdDb: -50,
        minSilenceDurationMs: 500, silenceCount: 0, silencePct: 0, peakCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, fileName: "x", durationSeconds: 1, sampleRate: 44100,
      channels: 1, channelView: "left", zoom: 1, silenceThresholdDb: -50,
      minSilenceDurationMs: 500, silenceCount: 0, silencePct: 0, peakCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, fileName: "a", durationSeconds: 1, sampleRate: 44100,
      channels: 1, channelView: "left", zoom: 1, silenceThresholdDb: -50,
      minSilenceDurationMs: 500, silenceCount: 0, silencePct: 0, peakCount: 0,
    });
    saveHistory({
      ts: 2, fileName: "b", durationSeconds: 1, sampleRate: 44100,
      channels: 1, channelView: "left", zoom: 1, silenceThresholdDb: -50,
      minSilenceDurationMs: 500, silenceCount: 0, silencePct: 0, peakCount: 0,
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

// ---- Shareable URL ----

describe("waveform-viewer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      channelView: "mono-mix",
      zoom: "5",
      color: "blue",
      silenceThreshold: "-50",
      minSilenceDuration: "500ms",
      topPeaks: 10,
    });
    expect(url).toContain("ch=mono-mix");
    expect(url).toContain("zoom=5");
    expect(url).toContain("color=blue");
    expect(url).toContain("sth=-50");
    expect(url).toContain("msd=500ms");
    expect(url).toContain("peaks=10");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("ch=both&zoom=10&color=purple&sth=-60&msd=1s&peaks=20");
    expect(p.channelView).toBe("both");
    expect(p.zoom).toBe("10");
    expect(p.color).toBe("purple");
    expect(p.silenceThreshold).toBe("-60");
    expect(p.minSilenceDuration).toBe("1s");
    expect(p.topPeaks).toBe(20);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#ch=left&zoom=2");
    expect(p.channelView).toBe("left");
    expect(p.zoom).toBe("2");
  });
  it("filters unknown channel view", () => {
    const p = parseShareUrl("ch=bogus&zoom=1");
    expect(p.channelView).toBeUndefined();
  });
  it("filters unknown zoom preset", () => {
    const p = parseShareUrl("zoom=999");
    expect(p.zoom).toBeUndefined();
  });
  it("filters unknown color", () => {
    const p = parseShareUrl("color=orange");
    expect(p.color).toBeUndefined();
  });
  it("filters unknown silence threshold", () => {
    const p = parseShareUrl("sth=-100");
    expect(p.silenceThreshold).toBeUndefined();
  });
  it("filters unknown min silence duration", () => {
    const p = parseShareUrl("msd=3s");
    expect(p.minSilenceDuration).toBeUndefined();
  });
  it("filters out-of-range topPeaks", () => {
    const p = parseShareUrl("peaks=999");
    expect(p.topPeaks).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = ChannelView | ZoomPreset | SilenceThresholdPreset | MinSilenceDurationPreset | WaveformColorPreset;
