import { describe, it, expect, beforeEach } from "vitest";
import {
  BANDS_10,
  BANDS_5,
  BANDS_3,
  BAND_SETS,
  BAND_SET_LABELS,
  BAND_LABELS_10,
  BAND_LABELS_5,
  BAND_LABELS_3,
  getBandLabels,
  getBandFrequencies,
  DEFAULT_BAND_SET,
  GAIN_PRESETS,
  GAIN_PRESET_VALUES,
  GAIN_PRESET_LABELS,
  MIN_GAIN_DB,
  MAX_GAIN_DB,
  validateGain,
  clampGain,
  DEFAULT_Q,
  validateQ,
  EQ_PRESETS,
  getPreset,
  presetToBandSet,
  buildFilterChain,
  activeFiltersOnly,
  estimateWavSizeBytes,
  formatBytes,
  formatDuration,
  formatHz,
  formatGainDb,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  encodeWav,
  computeSummaryStats,
  detectPreset,
  renderReport,
  renderCsv,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeGains,
  decodeGains,
  buildShareUrl,
  parseShareUrl,
  type BandSetId,
  type GainPreset,
  type EqPresetId,
  type HistoryEntry,
  type EqReport,
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

describe("audio-equalizer band sets", () => {
  it("10-band has the 10 ISO frequencies", () => {
    expect(BANDS_10).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
    expect(BANDS_10).toHaveLength(10);
  });
  it("5-band has 5 frequencies", () => {
    expect(BANDS_5).toEqual([60, 250, 1000, 4000, 12000]);
    expect(BANDS_5).toHaveLength(5);
  });
  it("3-band has 3 frequencies", () => {
    expect(BANDS_3).toEqual([250, 1000, 4000]);
    expect(BANDS_3).toHaveLength(3);
  });
  it("BAND_SETS maps all three", () => {
    expect(BAND_SETS["10-band"]).toBe(BANDS_10);
    expect(BAND_SETS["5-band"]).toBe(BANDS_5);
    expect(BAND_SETS["3-band"]).toBe(BANDS_3);
  });
  it("has labels for all three band sets", () => {
    expect(Object.keys(BAND_SET_LABELS)).toHaveLength(3);
    expect(BAND_SET_LABELS["10-band"]).toContain("ISO");
    expect(BAND_SET_LABELS["3-band"]).toContain("Bass");
  });
  it("has 10 band labels for the 10-band set", () => {
    expect(BAND_LABELS_10).toHaveLength(10);
    expect(BAND_LABELS_10[5]).toBe("1 kHz");
  });
  it("has 5 and 3 band labels", () => {
    expect(BAND_LABELS_5).toHaveLength(5);
    expect(BAND_LABELS_3).toHaveLength(3);
  });
  it("getBandLabels returns the right label array", () => {
    expect(getBandLabels("10-band")).toBe(BAND_LABELS_10);
    expect(getBandLabels("5-band")).toBe(BAND_LABELS_5);
    expect(getBandLabels("3-band")).toBe(BAND_LABELS_3);
  });
  it("getBandFrequencies returns the right array", () => {
    expect(getBandFrequencies("10-band")).toBe(BANDS_10);
    expect(getBandFrequencies("3-band")).toBe(BANDS_3);
  });
  it("default band set is 10-band", () => {
    expect(DEFAULT_BAND_SET).toBe("10-band");
  });
});

describe("audio-equalizer gain presets", () => {
  it("has 7 gain presets", () => {
    expect(GAIN_PRESETS).toHaveLength(7);
    expect(GAIN_PRESETS).toContain("-12");
    expect(GAIN_PRESETS).toContain("0");
    expect(GAIN_PRESETS).toContain("+12");
  });
  it("preset values map to dB numbers", () => {
    expect(GAIN_PRESET_VALUES["-12"]).toBe(-12);
    expect(GAIN_PRESET_VALUES["0"]).toBe(0);
    expect(GAIN_PRESET_VALUES["+3"]).toBe(3);
    expect(GAIN_PRESET_VALUES["+12"]).toBe(12);
  });
  it("has 7 labels", () => {
    expect(Object.keys(GAIN_PRESET_LABELS)).toHaveLength(7);
    expect(GAIN_PRESET_LABELS["-12"]).toContain("full cut");
    expect(GAIN_PRESET_LABELS["+12"]).toContain("full boost");
    expect(GAIN_PRESET_LABELS["0"]).toContain("flat");
  });
  it("MIN_GAIN_DB = -12, MAX_GAIN_DB = +12", () => {
    expect(MIN_GAIN_DB).toBe(-12);
    expect(MAX_GAIN_DB).toBe(12);
  });
});

describe("audio-equalizer gain validator", () => {
  it("accepts 0", () => {
    expect(validateGain(0).ok).toBe(true);
  });
  it("accepts -12 and +12 (boundaries)", () => {
    expect(validateGain(-12).ok).toBe(true);
    expect(validateGain(12).ok).toBe(true);
  });
  it("rejects below -12", () => {
    expect(validateGain(-13).ok).toBe(false);
    expect(validateGain(-13).error).toContain("≥");
  });
  it("rejects above +12", () => {
    expect(validateGain(13).ok).toBe(false);
    expect(validateGain(13).error).toContain("≤");
  });
  it("rejects NaN", () => {
    expect(validateGain(Number.NaN).ok).toBe(false);
  });
  it("rejects Infinity", () => {
    expect(validateGain(Number.POSITIVE_INFINITY).ok).toBe(false);
  });
  it("clampGain clamps to range", () => {
    expect(clampGain(-50)).toBe(-12);
    expect(clampGain(50)).toBe(12);
    expect(clampGain(0)).toBe(0);
    expect(clampGain(5)).toBe(5);
  });
  it("clampGain returns 0 for NaN", () => {
    expect(clampGain(Number.NaN)).toBe(0);
  });
});

describe("audio-equalizer Q factor", () => {
  it("default Q is 1.41", () => {
    expect(DEFAULT_Q).toBe(1.41);
  });
  it("validateQ accepts 1.41 and other positive values", () => {
    expect(validateQ(1.41).ok).toBe(true);
    expect(validateQ(0.7).ok).toBe(true);
    expect(validateQ(10).ok).toBe(true);
  });
  it("validateQ rejects non-positive", () => {
    expect(validateQ(0).ok).toBe(false);
    expect(validateQ(-1).ok).toBe(false);
  });
  it("validateQ rejects NaN", () => {
    expect(validateQ(Number.NaN).ok).toBe(false);
  });
  it("validateQ rejects very large Q (> 100)", () => {
    expect(validateQ(200).ok).toBe(false);
  });
});

describe("audio-equalizer preset library", () => {
  it("has at least 10 presets", () => {
    expect(EQ_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("includes all required preset ids", () => {
    const ids = EQ_PRESETS.map((p) => p.id);
    for (const id of [
      "flat", "bass-boost", "treble-boost", "vocal-boost",
      "loudness", "rock", "pop", "jazz", "classical", "podcast",
    ] as EqPresetId[]) {
      expect(ids).toContain(id);
    }
  });
  it("each preset has 10 gains", () => {
    for (const p of EQ_PRESETS) {
      expect(p.gains).toHaveLength(10);
    }
  });
  it("flat preset is all zeros", () => {
    const flat = getPreset("flat");
    expect(flat).toBeDefined();
    expect(flat!.gains.every((g) => g === 0)).toBe(true);
  });
  it("bass-boost boosts low frequencies", () => {
    const bb = getPreset("bass-boost")!;
    expect(bb.gains[0]).toBeGreaterThan(0);
    expect(bb.gains[9]).toBe(0);
  });
  it("treble-boost boosts high frequencies", () => {
    const tb = getPreset("treble-boost")!;
    expect(tb.gains[9]).toBeGreaterThan(0);
    expect(tb.gains[0]).toBe(0);
  });
  it("getPreset returns undefined for unknown id", () => {
    // Cast a non-existent id through `unknown` to bypass the literal-union check.
    expect(getPreset("does-not-exist" as unknown as EqPresetId)).toBeUndefined();
  });
  it("all gains are within [-12, +12]", () => {
    for (const p of EQ_PRESETS) {
      for (const g of p.gains) {
        expect(g).toBeGreaterThanOrEqual(-12);
        expect(g).toBeLessThanOrEqual(12);
      }
    }
  });
  it("presetToBandSet maps to 5-band by nearest frequency", () => {
    const bass = getPreset("bass-boost")!;
    const mapped = presetToBandSet(bass, "5-band");
    expect(mapped).toHaveLength(5);
    // 60 Hz is closest to 62 Hz in the 10-band set → gain should be 6
    expect(mapped[0]).toBe(6);
  });
  it("presetToBandSet maps to 3-band correctly", () => {
    const flat = getPreset("flat")!;
    const mapped = presetToBandSet(flat, "3-band");
    expect(mapped).toEqual([0, 0, 0]);
  });
});

describe("audio-equalizer filter chain builder", () => {
  it("builds a chain of correct length", () => {
    const chain = buildFilterChain(BANDS_10, new Array(10).fill(0));
    expect(chain).toHaveLength(10);
  });
  it("each FilterConfig has frequency, gain, q", () => {
    const chain = buildFilterChain(BANDS_5, [3, 0, -3, 0, 6]);
    expect(chain[0].frequency).toBe(60);
    expect(chain[0].gain).toBe(3);
    expect(chain[0].q).toBe(DEFAULT_Q);
    expect(chain[2].gain).toBe(-3);
    expect(chain[4].gain).toBe(6);
  });
  it("uses default Q when not specified", () => {
    const chain = buildFilterChain(BANDS_3, [0, 0, 0]);
    expect(chain[0].q).toBe(1.41);
  });
  it("accepts custom Q", () => {
    const chain = buildFilterChain(BANDS_3, [0, 0, 0], 2.0);
    expect(chain[0].q).toBe(2.0);
  });
  it("falls back to default Q for invalid Q", () => {
    const chain = buildFilterChain(BANDS_3, [0, 0, 0], -1);
    expect(chain[0].q).toBe(DEFAULT_Q);
  });
  it("clamps gains to [-12, +12]", () => {
    const chain = buildFilterChain([1000], [50]);
    expect(chain[0].gain).toBe(12);
    const chain2 = buildFilterChain([1000], [-50]);
    expect(chain2[0].gain).toBe(-12);
  });
  it("clamps frequencies to [20, 20000] Hz", () => {
    const chain = buildFilterChain([5, 50000], [0, 0]);
    expect(chain[0].frequency).toBe(20);
    expect(chain[1].frequency).toBe(20000);
  });
  it("activeFiltersOnly removes zero-gain bands", () => {
    const chain = buildFilterChain(BANDS_10, [3, 0, 0, -3, 0, 0, 0, 0, 0, 0]);
    const active = activeFiltersOnly(chain);
    expect(active).toHaveLength(2);
    expect(active[0].gain).toBe(3);
    expect(active[1].gain).toBe(-3);
  });
  it("activeFiltersOnly returns empty for all-zero gains", () => {
    const chain = buildFilterChain(BANDS_10, new Array(10).fill(0));
    expect(activeFiltersOnly(chain)).toHaveLength(0);
  });
});

describe("audio-equalizer file size estimator", () => {
  it("estimates size = 44 + samples × channels × 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 4000);
  });
  it("handles single channel", () => {
    expect(estimateWavSizeBytes(1000, 1)).toBe(44 + 2000);
  });
  it("handles zero samples", () => {
    expect(estimateWavSizeBytes(0, 2)).toBe(44);
  });
});

describe("audio-equalizer formatting", () => {
  it("formatBytes formats 0, KB, MB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formatDuration formats M:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(-5)).toBe("0:00");
  });
  it("formatHz formats Hz and kHz", () => {
    expect(formatHz(440)).toBe("440 Hz");
    expect(formatHz(1000)).toBe("1.00 kHz");
    expect(formatHz(16000)).toBe("16.00 kHz");
  });
  it("formatGainDb formats with sign", () => {
    expect(formatGainDb(3)).toBe("+3.00 dB");
    expect(formatGainDb(-3)).toBe("-3.00 dB");
    expect(formatGainDb(0)).toBe("+0.00 dB");
  });
});

describe("audio-equalizer WAV encoder", () => {
  it("buildWavHeader returns 44 bytes with RIFF marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(h).toHaveLength(44);
    expect(String.fromCharCode(...h.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...h.slice(8, 12))).toBe("WAVE");
  });
  it("floatSamplesTo16BitPCM encodes 0.0 as 0 and 1.0 as 32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0, 1]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
  });
  it("floatSamplesTo16BitPCM clamps above 1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([2]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
  });
  it("interleaveChannels interleaves 2 channels", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(Array.from(interleaveChannels([a, b]))).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("encodeWav produces valid WAV blob", () => {
    const samples = new Float32Array(100).fill(0.5);
    const wav = encodeWav([samples], 44100);
    expect(wav.length).toBe(44 + 200);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
  });
  it("encodeWav handles empty channel array", () => {
    expect(encodeWav([], 44100).length).toBe(44);
  });
});

describe("audio-equalizer summary stats", () => {
  it("computes bands modified and total gain change", () => {
    const gains = [3, 0, -3, 0, 6, 0, 0, 0, 0, 0];
    const stats = computeSummaryStats(gains, "Rock");
    expect(stats.bandCount).toBe(10);
    expect(stats.bandsModified).toBe(3);
    expect(stats.totalGainChange).toBe(12); // 3 + 3 + 6
    expect(stats.maxBoost).toBe(6);
    expect(stats.maxCut).toBe(-3);
    expect(stats.presetName).toBe("Rock");
  });
  it("handles all-zero gains (flat)", () => {
    const gains = new Array(10).fill(0);
    const stats = computeSummaryStats(gains, "Flat");
    expect(stats.bandsModified).toBe(0);
    expect(stats.totalGainChange).toBe(0);
    expect(stats.maxBoost).toBe(0);
    expect(stats.maxCut).toBe(0);
  });
  it("default Q is recorded", () => {
    const stats = computeSummaryStats([0], "X");
    expect(stats.q).toBe(DEFAULT_Q);
  });
  it("custom Q is recorded", () => {
    const stats = computeSummaryStats([0], "X", 2.0);
    expect(stats.q).toBe(2.0);
  });
});

describe("audio-equalizer detectPreset", () => {
  it("detects the flat preset", () => {
    const flat = getPreset("flat")!.gains;
    expect(detectPreset(flat)?.id).toBe("flat");
  });
  it("detects the bass-boost preset", () => {
    const bb = getPreset("bass-boost")!.gains;
    expect(detectPreset(bb)?.id).toBe("bass-boost");
  });
  it("returns null for custom gains", () => {
    expect(detectPreset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
  });
  it("returns null for non-10-band band sets", () => {
    expect(detectPreset([0, 0, 0], "3-band")).toBeNull();
  });
  it("returns null for wrong-length gains", () => {
    expect(detectPreset([0, 0, 0, 0, 0])).toBeNull();
  });
});

describe("audio-equalizer report renderers", () => {
  const makeReport = (): EqReport => ({
    fileName: "voice.mp3",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 1,
    bandSet: "10-band",
    presetName: "Bass Boost",
    q: 1.41,
    frequencies: BANDS_10,
    gains: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
    stats: {
      bandCount: 10,
      bandsModified: 4,
      totalGainChange: 20,
      maxBoost: 8,
      maxCut: 0,
      presetName: "Bass Boost",
      q: 1.41,
    },
    outputSizeBytes: 882044,
  });

  it("renderReport produces multi-line text report", () => {
    const txt = renderReport(makeReport());
    expect(txt).toContain("Audio Equalizer Report");
    expect(txt).toContain("voice.mp3");
    expect(txt).toContain("Bass Boost");
    expect(txt).toContain("Bands modified: 4");
    expect(txt).toContain("Total gain change: 20.00 dB");
  });
  it("renderReport lists per-band gains", () => {
    const txt = renderReport(makeReport());
    expect(txt).toContain("31 Hz");
    expect(txt).toContain("+8.00 dB");
    expect(txt).toContain("16 kHz");
  });
  it("renderCsv produces CSV header", () => {
    const csv = renderCsv(makeReport());
    const lines = csv.split("\n");
    expect(lines[0]).toBe("band,frequency_hz,gain_db");
    expect(lines.length).toBeGreaterThan(10);
  });
  it("renderCsv lists per-band rows", () => {
    const csv = renderCsv(makeReport());
    expect(csv).toContain("1,31,8.00");
    expect(csv).toContain("10,16000,0.00");
  });
  it("renderCsv includes summary rows", () => {
    const csv = renderCsv(makeReport());
    expect(csv).toContain("#preset,Bass Boost");
    expect(csv).toContain("#bands_modified,4");
    expect(csv).toContain("#total_gain_change_db,20.0000");
  });
  it("renderCsv escapes preset name with comma", () => {
    const r = makeReport();
    r.presetName = "Bass, Boost";
    const csv = renderCsv(r);
    expect(csv).toContain('"Bass, Boost"');
  });
});

describe("audio-equalizer filename generator", () => {
  it("generates equalized-YYYY-MM-DD-HHmmss.wav", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("equalized-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("equalized-2024-01-01-010203.wav");
  });
});

describe("audio-equalizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      durationSeconds: 10,
      bandSet: "10-band",
      presetName: "Bass Boost",
      q: 1.41,
      gains: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
      bandsModified: 4,
      totalGainChange: 20,
      outputSizeBytes: 882044,
      filename: "equalized-x.wav",
    };
    saveHistory(entry);
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual(entry);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        durationSeconds: 1,
        bandSet: "10-band",
        presetName: "Flat",
        q: 1.41,
        gains: new Array(10).fill(0),
        bandsModified: 0,
        totalGainChange: 0,
        outputSizeBytes: 1,
        filename: `x-${i}.wav`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", durationSeconds: 1, bandSet: "10-band",
      presetName: "Flat", q: 1.41, gains: [], bandsModified: 0,
      totalGainChange: 0, outputSizeBytes: 1, filename: "a.wav",
    });
    saveHistory({
      ts: 2, originalName: "b", durationSeconds: 1, bandSet: "10-band",
      presetName: "Flat", q: 1.41, gains: [], bandsModified: 0,
      totalGainChange: 0, outputSizeBytes: 1, filename: "b.wav",
    });
    const h = loadHistory();
    expect(h[0].ts).toBe(2);
    expect(h[1].ts).toBe(1);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", durationSeconds: 1, bandSet: "10-band",
      presetName: "Flat", q: 1.41, gains: [], bandsModified: 0,
      totalGainChange: 0, outputSizeBytes: 1, filename: "x.wav",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("audio-equalizer shareable URL", () => {
  it("encodeGains converts array to comma string", () => {
    expect(encodeGains([3, 0, -3])).toBe("3.0,0.0,-3.0");
  });
  it("decodeGains parses comma string back", () => {
    expect(decodeGains("3.0,0.0,-3.0")).toEqual([3, 0, -3]);
  });
  it("decodeGains filters out NaN", () => {
    expect(decodeGains("3.0,abc,-3.0")).toEqual([3, -3]);
  });
  it("decodeGains clamps to [-12, 12]", () => {
    expect(decodeGains("50,-50")).toEqual([12, -12]);
  });
  it("decodeGains handles empty string", () => {
    expect(decodeGains("")).toEqual([]);
  });
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      bandSet: "10-band",
      q: 1.41,
      preset: "bass-boost",
      gains: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
    });
    expect(url).toContain("bands=10-band");
    expect(url).toContain("q=1.41");
    expect(url).toContain("preset=bass-boost");
    expect(url).toContain("gains=8.0%2C6.0%2C4.0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("bands=5-band&q=2.00&preset=flat&gains=0.0,0.0,0.0,0.0,0.0");
    expect(p.bandSet).toBe("5-band");
    expect(p.q).toBe(2);
    expect(p.preset).toBe("flat");
    expect(p.gains).toEqual([0, 0, 0, 0, 0]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown band set", () => {
    const p = parseShareUrl("bands=invalid&q=1.41");
    expect(p.bandSet).toBeUndefined();
  });
  it("ignores invalid Q", () => {
    const p = parseShareUrl("bands=10-band&q=invalid");
    expect(p.q).toBeUndefined();
  });
  it("ignores unknown preset", () => {
    const p = parseShareUrl("bands=10-band&preset=does-not-exist");
    expect(p.preset).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#bands=3-band&q=1.41");
    expect(p.bandSet).toBe("3-band");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = BandSetId | GainPreset | EqPresetId;
