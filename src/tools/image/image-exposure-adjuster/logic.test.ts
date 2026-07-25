import { describe, it, expect } from "vitest";
import { stopsToFactor, applyExposureChannel, applyExposure, validateExposureOptions, formatStops } from "./logic";

describe("stopsToFactor", () => {
  it("0 stops = factor 1", () => expect(stopsToFactor(0)).toBe(1));
  it("+1 stop = factor 2", () => expect(stopsToFactor(1)).toBe(2));
  it("-1 stop = factor 0.5", () => expect(stopsToFactor(-1)).toBe(0.5));
  it("+2 stops = factor 4", () => expect(stopsToFactor(2)).toBe(4));
});

describe("applyExposureChannel", () => {
  it("doubles value at +1 stop", () => {
    expect(applyExposureChannel(100, 1)).toBe(200);
  });
  it("halves value at -1 stop", () => {
    expect(applyExposureChannel(100, -1)).toBe(50);
  });
  it("clamps to 255", () => {
    expect(applyExposureChannel(200, 2)).toBe(255);
  });
  it("clamps to 0", () => {
    expect(applyExposureChannel(10, -5)).toBe(0);
  });
});

describe("applyExposure", () => {
  it("applies to all channels", () => {
    const out = applyExposure({ r: 50, g: 100, b: 150 }, 1);
    expect(out).toEqual({ r: 100, g: 200, b: 255 });
  });
});

describe("validateExposureOptions", () => {
  it("accepts valid stops", () => {
    expect(validateExposureOptions({ stops: 1.5 })).toEqual({ ok: true });
  });
  it("rejects out-of-range stops", () => {
    expect(validateExposureOptions({ stops: 10 })).toHaveProperty("error");
  });
});

describe("formatStops", () => {
  it("formats positive with sign", () => {
    expect(formatStops(1)).toBe("+1.00 EV");
  });
  it("formats negative without extra sign", () => {
    expect(formatStops(-0.5)).toBe("-0.50 EV");
  });
});
