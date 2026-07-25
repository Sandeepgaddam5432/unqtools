/**
 * Periodic Table Lookup — unit tests.
 */
import { describe, it, expect } from "vitest";
import { ELEMENTS, search, getBySymbol, getByNumber, categories, toMarkdown } from "./logic";

describe("periodic ELEMENTS", () => {
  it("has 20 elements", () => {
    expect(ELEMENTS).toHaveLength(20);
  });
  it("every element has required fields", () => {
    for (const e of ELEMENTS) {
      expect(e.number).toBeGreaterThan(0);
      expect(e.symbol).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.atomicMass).toBeGreaterThan(0);
      expect(e.category).toBeTruthy();
    }
  });
  it("has no duplicate atomic numbers", () => {
    const nums = ELEMENTS.map((e) => e.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});

describe("periodic search", () => {
  it("returns all for empty query", () => {
    expect(search("")).toHaveLength(20);
  });
  it("finds by name (partial)", () => {
    const r = search("oxy");
    expect(r.some((e) => e.name === "Oxygen")).toBe(true);
  });
  it("finds by symbol (exact)", () => {
    const r = search("Au");
    expect(r.some((e) => e.symbol === "Au")).toBe(true);
  });
  it("finds by atomic number", () => {
    const r = search("26");
    expect(r.some((e) => e.number === 26)).toBe(true);
  });
  it("finds by category", () => {
    const r = search("noble gas");
    expect(r.every((e) => e.category === "noble gas")).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("periodic getBySymbol / getByNumber", () => {
  it("looks up by symbol", () => {
    expect(getBySymbol("Fe")?.name).toBe("Iron");
  });
  it("is case-insensitive for symbol", () => {
    expect(getBySymbol("au")?.name).toBe("Gold");
  });
  it("looks up by atomic number", () => {
    expect(getByNumber(6)?.symbol).toBe("C");
  });
  it("returns undefined for unknown", () => {
    expect(getBySymbol("Xx")).toBeUndefined();
    expect(getByNumber(999)).toBeUndefined();
  });
});

describe("periodic categories", () => {
  it("returns unique sorted categories", () => {
    const c = categories();
    expect(c.length).toBeGreaterThan(0);
    expect(new Set(c).size).toBe(c.length);
  });
});

describe("periodic toMarkdown", () => {
  it("produces markdown with element header", () => {
    const e = getBySymbol("Fe")!;
    const md = toMarkdown(e);
    expect(md).toContain("# Iron (Fe)");
    expect(md).toContain("Atomic number: 26");
  });
});
