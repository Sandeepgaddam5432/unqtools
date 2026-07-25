import { describe, it, expect } from "vitest";
import { removeAccents, removeAccentsBatch, hasAccents, countAccentsRemoved } from "./logic";

describe("removeAccents", () => {
  it("strips accents from é → e", () => {
    expect(removeAccents("café")).toBe("cafe");
  });
  it("strips accents from ñ → n", () => {
    expect(removeAccents("niño")).toBe("nino");
  });
  it("strips accents from ü → u", () => {
    expect(removeAccents("über")).toBe("uber");
  });
  it("handles empty string", () => {
    expect(removeAccents("")).toBe("");
  });
  it("preserves text without accents", () => {
    expect(removeAccents("hello world")).toBe("hello world");
  });
});

describe("removeAccentsBatch", () => {
  it("processes multiple lines", () => {
    expect(removeAccentsBatch(["café", "niño"])).toEqual(["cafe", "nino"]);
  });
});

describe("hasAccents", () => {
  it("returns true for accented text", () => {
    expect(hasAccents("café")).toBe(true);
  });
  it("returns false for plain text", () => {
    expect(hasAccents("hello")).toBe(false);
  });
  it("returns false for empty", () => {
    expect(hasAccents("")).toBe(false);
  });
});

describe("countAccentsRemoved", () => {
  it("counts single accent", () => {
    expect(countAccentsRemoved("café")).toBe(1);
  });
  it("counts multiple accents", () => {
    expect(countAccentsRemoved("résumé")).toBe(2);
  });
  it("returns 0 for plain text", () => {
    expect(countAccentsRemoved("hello")).toBe(0);
  });
});
