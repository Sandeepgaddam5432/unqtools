import { describe, it, expect } from "vitest";
import {
  getAllFormats,
  getFormatById,
  theoreticalFloor,
  calculateSNR,
  dbfsToLinear,
  linearToDbfs,
  dynamicRangeGain,
  classifySNR,
  findFormatsForSNR,
  analogNoiseToDbfs,
  recommendDither,
  exportFormatsAsCSV,
  formatCard,
  validateSNRInputs,
  recommendBitDepth,
  aWeightingDb,
  NOISE_FLOOR_FORMATS,
} from "./logic";

describe("audio-noise-floor-ref getAllFormats", () => {
  it("returns at least 6 formats", () => {
    expect(getAllFormats().length).toBeGreaterThanOrEqual(6);
  });
});

describe("audio-noise-floor-ref getFormatById", () => {
  it("finds 16bit by id", () => {
    const f = getFormatById("16bit");
    expect(f).not.toBeNull();
    expect(f!.bitDepth).toBe(16);
  });

  it("returns null for unknown", () => {
    expect(getFormatById("nope")).toBeNull();
  });
});

describe("audio-noise-floor-ref theoreticalFloor", () => {
  it("returns -96.32 for 16-bit", () => {
    expect(theoreticalFloor(16)).toBeCloseTo(-96.32, 1);
  });

  it("returns fallback for 0 (lossy)", () => {
    expect(theoreticalFloor(0)).toBe(-96);
  });
});

describe("audio-noise-floor-ref calculateSNR", () => {
  it("computes SNR difference", () => {
    expect(calculateSNR(-20, -80)).toBe(60);
  });

  it("handles negative SNR when signal is quieter than floor", () => {
    expect(calculateSNR(-90, -80)).toBe(-10);
  });
});

describe("audio-noise-floor-ref dbfsToLinear / linearToDbfs", () => {
  it("0 dBFS equals 1.0 linear", () => {
    expect(dbfsToLinear(0)).toBeCloseTo(1.0, 6);
  });

  it("-6 dBFS is roughly 0.5 linear", () => {
    expect(dbfsToLinear(-6)).toBeCloseTo(0.501, 2);
  });

  it("roundtrips linear <-> dBFS", () => {
    const v = 0.3;
    const db = linearToDbfs(v);
    expect(dbfsToLinear(db)).toBeCloseTo(v, 6);
  });

  it("linearToDbfs returns -Infinity for 0", () => {
    expect(linearToDbfs(0)).toBe(-Infinity);
  });
});

describe("audio-noise-floor-ref dynamicRangeGain", () => {
  it("16->24 bit gain is ~48 dB", () => {
    expect(dynamicRangeGain(16, 24)).toBeCloseTo(48.16, 1);
  });
});

describe("audio-noise-floor-ref classifySNR", () => {
  it("classifies 100 dB as studio-grade", () => {
    expect(classifySNR(100).rating).toBe("Studio-grade");
  });

  it("classifies 50 dB as acceptable", () => {
    expect(classifySNR(50).rating).toBe("Acceptable");
  });

  it("classifies 10 dB as poor", () => {
    expect(classifySNR(10).rating).toBe("Poor");
  });
});

describe("audio-noise-floor-ref findFormatsForSNR", () => {
  it("returns formats with dynamic range >= 96 for SNR 96", () => {
    const list = findFormatsForSNR(96);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((f) => f.dynamicRangeDb >= 96)).toBe(true);
  });
});

describe("audio-noise-floor-ref analogNoiseToDbfs", () => {
  it("returns 0 dBFS when noise equals reference", () => {
    expect(analogNoiseToDbfs(1000, 1000)).toBeCloseTo(0, 3);
  });

  it("returns -Infinity for zero noise", () => {
    expect(analogNoiseToDbfs(0, 1000)).toBe(-Infinity);
  });
});

describe("audio-noise-floor-ref recommendDither", () => {
  it("recommends no dither when bumping up", () => {
    expect(recommendDither(16, 24)).toContain("No dither");
  });

  it("recommends TPDF for 24->16", () => {
    expect(recommendDither(24, 16)).toContain("TPDF");
  });

  it("recommends noise-shaped dither for 16->8", () => {
    expect(recommendDither(16, 8)).toContain("noise-shaped");
  });
});

describe("audio-noise-floor-ref exportFormatsAsCSV", () => {
  it("has header plus all rows", () => {
    const csv = exportFormatsAsCSV();
    const lines = csv.split("\n");
    expect(lines.length).toBe(NOISE_FLOOR_FORMATS.length + 1);
    expect(lines[0]).toContain("bit_depth");
  });
});

describe("audio-noise-floor-ref formatCard", () => {
  it("includes name and key fields", () => {
    const card = formatCard(getFormatById("24bit")!);
    expect(card).toContain("24-bit PCM (Studio)");
    expect(card).toContain("Dynamic range");
  });
});

describe("audio-noise-floor-ref validateSNRInputs", () => {
  it("warns when signal above 0 dBFS", () => {
    const w = validateSNRInputs(3, -60);
    expect(w.some((x) => x.includes("clip"))).toBe(true);
  });

  it("warns when noise floor louder than signal", () => {
    const w = validateSNRInputs(-90, -80);
    expect(w.some((x) => x.includes("louder than"))).toBe(true);
  });

  it("no warnings for clean inputs", () => {
    expect(validateSNRInputs(-20, -90)).toEqual([]);
  });
});

describe("audio-noise-floor-ref recommendBitDepth", () => {
  it("recommends 24-bit for SNR 120", () => {
    const r = recommendBitDepth(120);
    expect(r.bitDepth).toBe(24);
  });

  it("recommends 16-bit for SNR 80", () => {
    const r = recommendBitDepth(80);
    expect(r.bitDepth).toBe(16);
  });
});

describe("audio-noise-floor-ref aWeightingDb", () => {
  it("is near 0 dB at 1 kHz", () => {
    expect(aWeightingDb(1000)).toBeCloseTo(0, 1);
  });

  it("attenuates low frequencies", () => {
    expect(aWeightingDb(100)).toBeLessThan(aWeightingDb(1000));
  });
});
