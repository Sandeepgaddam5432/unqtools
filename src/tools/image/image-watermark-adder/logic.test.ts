import { describe, it, expect } from "vitest";
import { computePlacement, computeTilePlacements, validateOptions, POSITIONS } from "./logic";

describe("computePlacement", () => {
  it("places top-left correctly", () => {
    expect(computePlacement(100, 100, "top-left", 10)).toEqual({ x: 10, y: 10, align: "left" });
  });

  it("places middle-center correctly", () => {
    expect(computePlacement(100, 100, "middle-center", 10)).toEqual({ x: 50, y: 50, align: "center" });
  });

  it("places bottom-right correctly", () => {
    expect(computePlacement(100, 100, "bottom-right", 10)).toEqual({ x: 90, y: 90, align: "right" });
  });

  it("handles different paddings", () => {
    expect(computePlacement(200, 200, "top-left", 20).x).toBe(20);
  });
});

describe("computeTilePlacements", () => {
  it("returns empty list for spacing <= 0", () => {
    expect(computeTilePlacements(100, 100, 0)).toEqual([]);
  });

  it("generates a grid of placements", () => {
    const placements = computeTilePlacements(200, 200, 50);
    expect(placements.length).toBeGreaterThan(0);
    expect(placements[0]).toHaveProperty("x");
    expect(placements[0]).toHaveProperty("y");
  });

  it("respects spacing", () => {
    const placements = computeTilePlacements(300, 300, 100);
    const xs = new Set(placements.map((p) => p.x));
    expect(xs.has(100)).toBe(true);
    expect(xs.has(200)).toBe(true);
  });
});

describe("validateOptions", () => {
  const base = {
    text: "© 2024",
    position: "bottom-right" as const,
    opacity: 0.5,
    fontSize: 24,
    color: "#ffffff",
    rotation: 0,
    padding: 10,
    tile: false,
    tileSpacing: 100,
  };

  it("accepts valid options", () => {
    expect(validateOptions(base)).toEqual({ ok: true });
  });

  it("rejects empty text", () => {
    expect(validateOptions({ ...base, text: "   " })).toHaveProperty("error");
  });

  it("rejects invalid opacity", () => {
    expect(validateOptions({ ...base, opacity: 2 })).toHaveProperty("error");
  });

  it("rejects non-positive font size", () => {
    expect(validateOptions({ ...base, fontSize: 0 })).toHaveProperty("error");
  });

  it("provides 9 positions", () => {
    expect(POSITIONS.length).toBe(9);
  });
});
