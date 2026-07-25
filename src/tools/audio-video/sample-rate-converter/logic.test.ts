import { describe, it, expect } from "vitest";
import {
  getAllRates,
  getRateByHz,
  getRateByKhz,
  searchRates,
  filterByQuality,
  planConversion,
  computeDataRate,
} from "./logic";

describe("sample-rate-converter getAllRates", () => {
  it("returns at least 7 rates", () => {
    expect(getAllRates().length).toBeGreaterThanOrEqual(7);
  });

  it("includes 44.1 kHz and 48 kHz", () => {
    const hz = getAllRates().map((r) => r.hz);
    expect(hz).toContain(44100);
    expect(hz).toContain(48000);
  });
});

describe("sample-rate-converter getRateByHz", () => {
  it("finds 44100 Hz", () => {
    const r = getRateByHz(44100);
    expect(r).not.toBeNull();
    expect(r!.label).toBe("CD Quality");
  });

  it("returns null for unknown rate", () => {
    expect(getRateByHz(12345)).toBeNull();
  });
});

describe("sample-rate-converter getRateByKhz", () => {
  it("finds by kHz", () => {
    expect(getRateByKhz(48)?.hz).toBe(48000);
    expect(getRateByKhz(96)?.hz).toBe(96000);
  });

  it("returns null for unknown kHz", () => {
    expect(getRateByKhz(11)).toBeNull();
  });
});

describe("sample-rate-converter searchRates", () => {
  it("returns all for empty query", () => {
    expect(searchRates("").length).toBeGreaterThanOrEqual(7);
  });

  it("matches by label", () => {
    const matches = searchRates("studio");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((r) => r.hz === 96000)).toBe(true);
  });

  it("matches by exact hz string", () => {
    expect(searchRates("48000").length).toBeGreaterThan(0);
  });

  it("matches by use case", () => {
    const matches = searchRates("phone");
    expect(matches.some((r) => r.hz === 8000)).toBe(true);
  });
});

describe("sample-rate-converter filterByQuality", () => {
  it("filters by studio quality", () => {
    const s = filterByQuality("studio");
    expect(s.every((r) => r.quality === "studio")).toBe(true);
    expect(s.length).toBeGreaterThan(0);
  });

  it("filters by low quality", () => {
    const l = filterByQuality("low");
    expect(l.every((r) => r.quality === "low")).toBe(true);
  });
});

describe("sample-rate-converter planConversion", () => {
  it("detects downsampling", () => {
    const c = planConversion(96000, 44100);
    expect(c.resampleQuality).toBe("downsample");
    expect(c.ratio).toBeCloseTo(44100 / 96000);
    expect(c.qualityNote).toMatch(/Nyquist/);
  });

  it("detects upsampling", () => {
    const c = planConversion(44100, 96000);
    expect(c.resampleQuality).toBe("upsample");
    expect(c.qualityNote).toMatch(/Upsampling/);
  });

  it("detects no-change", () => {
    const c = planConversion(48000, 48000);
    expect(c.resampleQuality).toBe("no-change");
  });

  it("rejects invalid input", () => {
    const c = planConversion(0, 48000);
    expect(c.ratio).toBe(0);
    expect(c.qualityNote).toMatch(/Invalid/);
  });
});

describe("sample-rate-converter computeDataRate", () => {
  it("computes bytes per second", () => {
    // 44100 * 16 * 2 / 8 = 176400 bytes/s
    expect(computeDataRate(44100, 16, 2)).toBe(176400);
  });

  it("returns 0 for invalid input", () => {
    expect(computeDataRate(0, 16, 2)).toBe(0);
  });
});
