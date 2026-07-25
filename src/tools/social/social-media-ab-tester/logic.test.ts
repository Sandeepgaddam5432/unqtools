/**
 * Social Media A/B Tester — unit tests.
 */
import { describe, it, expect } from "vitest";
import { computeAB, pValueFromZ, CONFIDENCE_LABELS, type ABInput } from "./logic";

describe("ab computeAB basics", () => {
  it("computes conversion rates", () => {
    const r = computeAB({ aVisitors: 1000, aConversions: 100, bVisitors: 1000, bConversions: 120, confidenceLevel: 0.95 });
    expect(r.aRate).toBe(0.1);
    expect(r.bRate).toBe(0.12);
  });
  it("computes absolute difference and relative lift", () => {
    const r = computeAB({ aVisitors: 1000, aConversions: 100, bVisitors: 1000, bConversions: 120, confidenceLevel: 0.95 });
    expect(r.absoluteDifference).toBe(0.02);
    expect(r.relativeLift).toBe(0.2);
  });
  it("computes a z-score", () => {
    const r = computeAB({ aVisitors: 1000, aConversions: 100, bVisitors: 1000, bConversions: 150, confidenceLevel: 0.95 });
    expect(r.zScore).toBeGreaterThan(0);
  });
});

describe("ab significance", () => {
  it("flags significant difference when B clearly wins", () => {
    const r = computeAB({ aVisitors: 5000, aConversions: 500, bVisitors: 5000, bConversions: 700, confidenceLevel: 0.95 });
    expect(r.isSignificant).toBe(true);
    expect(r.winner).toBe("B");
  });
  it("flags no winner for identical rates", () => {
    const r = computeAB({ aVisitors: 1000, aConversions: 100, bVisitors: 1000, bConversions: 100, confidenceLevel: 0.95 });
    expect(r.isSignificant).toBe(false);
    expect(r.winner).toBe("none");
    expect(r.zScore).toBe(0);
  });
  it("flags A as winner when B is worse", () => {
    const r = computeAB({ aVisitors: 5000, aConversions: 500, bVisitors: 5000, bConversions: 300, confidenceLevel: 0.95 });
    expect(r.isSignificant).toBe(true);
    expect(r.winner).toBe("A");
  });
  it("respects confidence level (99% stricter)", () => {
    const input: ABInput = { aVisitors: 2000, aConversions: 100, bVisitors: 2000, bConversions: 130, confidenceLevel: 0.95 };
    const r95 = computeAB(input);
    const r99 = computeAB({ ...input, confidenceLevel: 0.99 });
    expect(r99.criticalZ).toBeGreaterThan(r95.criticalZ);
  });
});

describe("ab sample size warnings", () => {
  it("warns for tiny samples", () => {
    const r = computeAB({ aVisitors: 10, aConversions: 1, bVisitors: 10, bConversions: 2, confidenceLevel: 0.95 });
    expect(r.sampleSizeWarning).toBeTruthy();
  });
  it("does not warn for adequate samples", () => {
    const r = computeAB({ aVisitors: 10000, aConversions: 500, bVisitors: 10000, bConversions: 600, confidenceLevel: 0.95 });
    expect(r.sampleSizeWarning).toBeNull();
  });
});

describe("ab pValueFromZ", () => {
  it("returns 1 for z=0", () => {
    expect(pValueFromZ(0)).toBeCloseTo(1, 2);
  });
  it("returns small p for large z", () => {
    expect(pValueFromZ(3)).toBeLessThan(0.01);
  });
  it("is symmetric for ±z", () => {
    expect(pValueFromZ(2)).toBeCloseTo(pValueFromZ(-2), 5);
  });
});

describe("ab CONFIDENCE_LABELS", () => {
  it("has labels for 90/95/99", () => {
    expect(CONFIDENCE_LABELS[0.9]).toBe("90%");
    expect(CONFIDENCE_LABELS[0.95]).toBe("95%");
    expect(CONFIDENCE_LABELS[0.99]).toBe("99%");
  });
});
