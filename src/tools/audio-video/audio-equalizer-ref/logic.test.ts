import { describe, it, expect } from "vitest";
import {
  getAllBands, getBandByHz, getBandsByRange, findNearestBand, getPresets, getPreset,
  getPresetsByCategory, qToBandwidth, bandwidthToQ, getQPresets, validateGain, clampGain,
  validateQ, planEqConfig, renderCsv, renderReport, planBatch, renderBatchCsv, formatHz,
  formatGainDb, MIN_GAIN_DB, MAX_GAIN_DB,
} from "./logic";

describe("audio-equalizer-ref getAllBands", () => {
  it("returns 12 bands", () => {
    expect(getAllBands().length).toBe(12);
  });
  it("includes 20 Hz and 20 kHz", () => {
    expect(getAllBands().some((b) => b.hz === 20)).toBe(true);
    expect(getAllBands().some((b) => b.hz === 20000)).toBe(true);
  });
});

describe("audio-equalizer-ref getBandByHz", () => {
  it("finds a band by frequency", () => {
    expect(getBandByHz(1000)?.label).toBe("1 kHz");
  });
  it("returns null for unknown frequency", () => {
    expect(getBandByHz(9999)).toBeNull();
  });
});

describe("audio-equalizer-ref getBandsByRange", () => {
  it("returns bands within range", () => {
    const r = getBandsByRange(100, 1000);
    expect(r.every((b) => b.hz >= 100 && b.hz <= 1000)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("audio-equalizer-ref findNearestBand", () => {
  it("finds nearest to 950 Hz (1000)", () => {
    expect(findNearestBand(950)?.hz).toBe(1000);
  });
  it("finds nearest to 17500 Hz (16000)", () => {
    expect(findNearestBand(17500)?.hz).toBe(16000);
  });
});

describe("audio-equalizer-ref getPresets", () => {
  it("returns 12 presets", () => {
    expect(getPresets().length).toBe(12);
  });
  it("finds preset by id", () => {
    expect(getPreset("rock")?.category).toBe("music");
  });
  it("returns null for unknown", () => {
    expect(getPreset("x")).toBeNull();
  });
});

describe("audio-equalizer-ref getPresetsByCategory", () => {
  it("filters by category", () => {
    const speech = getPresetsByCategory("speech");
    expect(speech.every((p) => p.category === "speech")).toBe(true);
    expect(speech.length).toBeGreaterThan(0);
  });
});

describe("audio-equalizer-ref qToBandwidth / bandwidthToQ", () => {
  it("computes bandwidth from Q", () => {
    expect(qToBandwidth(1.41)).toBeCloseTo(1.0, 1);
  });
  it("round-trips Q → BW → Q", () => {
    const bw = qToBandwidth(2.0);
    const q = bandwidthToQ(bw);
    expect(q).toBeCloseTo(2.0, 2);
  });
  it("returns 0 for non-positive Q", () => {
    expect(qToBandwidth(0)).toBe(0);
    expect(qToBandwidth(-1)).toBe(0);
  });
});

describe("audio-equalizer-ref getQPresets", () => {
  it("includes Q=1.41 (1 octave)", () => {
    expect(getQPresets().some((q) => q.value === 1.41)).toBe(true);
  });
});

describe("audio-equalizer-ref validateGain / clampGain", () => {
  it("accepts valid gain", () => {
    expect(validateGain(0).ok).toBe(true);
    expect(validateGain(6).ok).toBe(true);
  });
  it("rejects out-of-range gain", () => {
    expect(validateGain(MIN_GAIN_DB - 1).ok).toBe(false);
    expect(validateGain(MAX_GAIN_DB + 1).ok).toBe(false);
  });
  it("rejects non-finite", () => {
    expect(validateGain(NaN).ok).toBe(false);
  });
  it("clamps gain to range", () => {
    expect(clampGain(100)).toBe(MAX_GAIN_DB);
    expect(clampGain(-100)).toBe(MIN_GAIN_DB);
    expect(clampGain(NaN)).toBe(0);
  });
});

describe("audio-equalizer-ref validateQ", () => {
  it("accepts valid Q", () => { expect(validateQ(1.41).ok).toBe(true); });
  it("rejects non-positive Q", () => { expect(validateQ(0).ok).toBe(false); expect(validateQ(-1).ok).toBe(false); });
  it("rejects Q > 100", () => { expect(validateQ(101).ok).toBe(false); });
});

describe("audio-equalizer-ref planEqConfig", () => {
  it("applies a preset", () => {
    const r = planEqConfig({ presetId: "bass-boost", q: 1.41 });
    expect(r.preset?.id).toBe("bass-boost");
    expect(r.gains.length).toBe(12);
    expect(r.maxBoost).toBeGreaterThan(0);
  });
  it("applies custom gains", () => {
    const custom = Array(12).fill(0).map((_, i) => (i < 4 ? 6 : 0));
    const r = planEqConfig({ presetId: "x", q: 1.0, customGains: custom });
    expect(r.preset).toBeNull();
    expect(r.gains[0]).toBe(6);
  });
  it("warns for unknown preset and no custom", () => {
    const r = planEqConfig({ presetId: "x", q: 1.0 });
    expect(r.warnings.some((w) => w.includes("Unknown preset"))).toBe(true);
    expect(r.gains.every((g) => g === 0)).toBe(true);
  });
  it("warns for invalid Q", () => {
    const r = planEqConfig({ presetId: "flat", q: -1 });
    expect(r.warnings.some((w) => w.includes("Q"))).toBe(true);
    expect(r.q).toBe(1.41); // falls back to default
  });
  it("warns for boost above 12 dB", () => {
    const custom = Array(12).fill(0).map((_, i) => (i === 0 ? 15 : 0));
    const r = planEqConfig({ presetId: "x", q: 1.0, customGains: custom });
    expect(r.warnings.some((w) => w.includes("clipping"))).toBe(true);
  });
});

describe("audio-equalizer-ref renderCsv / renderReport", () => {
  it("renders CSV with header", () => {
    const r = planEqConfig({ presetId: "flat", q: 1.41 });
    const csv = renderCsv(r);
    expect(csv.split("\n")[0]).toBe("band,hz,gain_db");
  });
  it("renders report with title", () => {
    const r = planEqConfig({ presetId: "rock", q: 1.41 });
    const report = renderReport(r);
    expect(report).toContain("Audio Equalizer Reference Report");
    expect(report).toContain("Preset: Rock");
  });
});

describe("audio-equalizer-ref planBatch / renderBatchCsv", () => {
  it("plans batch of configs", () => {
    const rs = planBatch([
      { presetId: "flat", q: 1.41 },
      { presetId: "rock", q: 2.0 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders batch CSV", () => {
    const csv = renderBatchCsv(planBatch([{ presetId: "flat", q: 1.41 }]));
    expect(csv.split("\n")[0]).toContain("index,preset");
  });
});

describe("audio-equalizer-ref formatHz / formatGainDb", () => {
  it("formats Hz correctly", () => {
    expect(formatHz(20)).toBe("20 Hz");
    expect(formatHz(1000)).toBe("1.00 kHz");
    expect(formatHz(NaN)).toBe("—");
  });
  it("formats gain with sign", () => {
    expect(formatGainDb(3)).toBe("+3.00 dB");
    expect(formatGainDb(-3)).toBe("-3.00 dB");
    expect(formatGainDb(NaN)).toBe("—");
  });
});
