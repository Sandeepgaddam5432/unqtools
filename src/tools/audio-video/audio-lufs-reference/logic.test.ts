import { describe, it, expect } from "vitest";
import {
  getAllStandards,
  getStandardById,
  getStandardsByPlatform,
  gainChange,
  applyGain,
  lufsToRmsDb,
  rmsDbToLufs,
  recommendedTruePeakMargin,
  compareLoudness,
  validateLufs,
  interpretLRA,
  formatStandardCard,
  exportStandardsCSV,
  spotifyTurnDown,
  suggestMasterTarget,
  dynamicsPreservationScore,
  crestFactor,
  LOUDNESS_STANDARDS,
} from "./logic";

describe("audio-lufs-reference getAllStandards", () => {
  it("returns at least 8 standards", () => {
    expect(getAllStandards().length).toBeGreaterThanOrEqual(8);
  });
});

describe("audio-lufs-reference getStandardById", () => {
  it("finds ebu-r128", () => {
    const s = getStandardById("ebu-r128");
    expect(s?.targetLufs).toBe(-23);
  });
  it("returns null for unknown", () => {
    expect(getStandardById("nope")).toBeNull();
  });
});

describe("audio-lufs-reference getStandardsByPlatform", () => {
  it("finds Spotify standard", () => {
    const r = getStandardsByPlatform("Spotify");
    expect(r.length).toBeGreaterThanOrEqual(1);
  });
});

describe("audio-lufs-reference gainChange", () => {
  it("returns positive gain when target louder than current", () => {
    expect(gainChange(-20, -14)).toBe(6);
  });
  it("returns negative gain when target quieter", () => {
    expect(gainChange(-10, -14)).toBe(-4);
  });
});

describe("audio-lufs-reference applyGain", () => {
  it("applies gain correctly", () => {
    expect(applyGain(-14, 2)).toBe(-12);
  });
});

describe("audio-lufs-reference lufsToRmsDb / rmsDbToLufs", () => {
  it("roundtrips LUFS <-> RMS dB", () => {
    const lufs = -14;
    const rms = lufsToRmsDb(lufs);
    expect(rmsDbToLufs(rms)).toBeCloseTo(lufs, 3);
  });
  it("adds 0.691 offset going to RMS", () => {
    expect(lufsToRmsDb(-14)).toBeCloseTo(-13.309, 2);
  });
});

describe("audio-lufs-reference recommendedTruePeakMargin", () => {
  it("returns tighter margin for loud targets", () => {
    expect(recommendedTruePeakMargin(-8)).toBe(-0.5);
  });
  it("returns looser margin for quiet targets", () => {
    expect(recommendedTruePeakMargin(-23)).toBe(-1.5);
  });
});

describe("audio-lufs-reference compareLoudness", () => {
  it("returns entry per standard with offset", () => {
    const arr = compareLoudness(-14);
    expect(arr.length).toBe(LOUDNESS_STANDARDS.length);
    expect(arr[0].offset).toBeDefined();
  });
});

describe("audio-lufs-reference validateLufs", () => {
  it("warns on positive LUFS", () => {
    expect(validateLufs(5).some((w) => w.includes("impossible"))).toBe(true);
  });
  it("warns on extremely loud master", () => {
    expect(validateLufs(-3).some((w) => w.includes("extremely loud"))).toBe(true);
  });
  it("warns on near-silence", () => {
    expect(validateLufs(-80).some((w) => w.includes("near-silence"))).toBe(true);
  });
  it("passes for normal values", () => {
    expect(validateLufs(-14)).toEqual([]);
  });
});

describe("audio-lufs-reference interpretLRA", () => {
  it("returns 'Very compressed' for low LRA", () => {
    expect(interpretLRA(3)).toContain("compressed");
  });
  it("returns 'Very wide dynamics' for high LRA", () => {
    expect(interpretLRA(25)).toContain("Very wide");
  });
});

describe("audio-lufs-reference formatStandardCard", () => {
  it("includes name and target LUFS", () => {
    const s = getStandardById("spotify")!;
    const card = formatStandardCard(s);
    expect(card).toContain("Spotify");
    expect(card).toContain("-14");
  });
});

describe("audio-lufs-reference exportStandardsCSV", () => {
  it("has header plus all rows", () => {
    const csv = exportStandardsCSV();
    const lines = csv.split("\n");
    expect(lines.length).toBe(LOUDNESS_STANDARDS.length + 1);
    expect(lines[0]).toContain("target_lufs");
  });
});

describe("audio-lufs-reference spotifyTurnDown", () => {
  it("flags turn-down when master louder than -14", () => {
    const r = spotifyTurnDown(-8);
    expect(r.willTurnDown).toBe(true);
    expect(r.amountDb).toBe(6);
  });
  it("no turn-down when master quieter than -14", () => {
    const r = spotifyTurnDown(-18);
    expect(r.willTurnDown).toBe(false);
    expect(r.amountDb).toBe(0);
  });
});

describe("audio-lufs-reference suggestMasterTarget", () => {
  it("returns -14 for streaming", () => {
    expect(suggestMasterTarget("streaming")).toBe(-14);
  });
  it("returns -23 for EU broadcast", () => {
    expect(suggestMasterTarget("broadcast-eu")).toBe(-23);
  });
  it("returns -8 for club", () => {
    expect(suggestMasterTarget("club")).toBe(-8);
  });
});

describe("audio-lufs-reference dynamicsPreservationScore", () => {
  it("returns 0 for zero LRA", () => {
    expect(dynamicsPreservationScore(0)).toBe(0);
  });
  it("returns 100 for LRA >= 20", () => {
    expect(dynamicsPreservationScore(25)).toBe(100);
  });
  it("scales linearly", () => {
    expect(dynamicsPreservationScore(10)).toBe(50);
  });
});

describe("audio-lufs-reference crestFactor", () => {
  it("computes peak - RMS", () => {
    expect(crestFactor(-1, -14)).toBe(13);
  });
});
