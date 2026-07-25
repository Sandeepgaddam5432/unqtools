import { describe, it, expect } from "vitest";
import {
  removeAccents,
  removeAccentsBatch,
  hasAccents,
  countAccentsRemoved,
  removeAccentsPreserveCase,
  computeStats,
  perCharBreakdown,
  listAccentedChars,
  breakdownToCsv,
} from "./logic";

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
  it("preserves common marks in keep-common mode (ñ)", () => {
    expect(removeAccents("niño", { mode: "keep-common" })).toBe("niño");
  });
  it("strips uncommon marks in keep-common mode (é)", () => {
    expect(removeAccents("café", { mode: "keep-common" })).toBe("cafe");
  });
  it("normalizes whitespace when option set", () => {
    expect(removeAccents("hello   world\n\nfoo", { normalizeWhitespace: true })).toBe("hello world foo");
  });
});

describe("removeAccentsBatch", () => {
  it("processes multiple lines", () => {
    expect(removeAccentsBatch(["café", "niño"])).toEqual(["cafe", "nino"]);
  });
  it("respects mode option", () => {
    expect(removeAccentsBatch(["niño", "café"], { mode: "keep-common" })).toEqual(["niño", "cafe"]);
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
  it("respects keep-common mode", () => {
    expect(countAccentsRemoved("niño", { mode: "keep-common" })).toBe(0);
    expect(countAccentsRemoved("café", { mode: "keep-common" })).toBe(1);
  });
});

describe("removeAccentsPreserveCase", () => {
  it("preserves uppercase letters", () => {
    expect(removeAccentsPreserveCase("Café")).toBe("Cafe");
    expect(removeAccentsPreserveCase("ÉLAN")).toBe("ELAN");
  });
});

describe("computeStats", () => {
  it("counts removed accents", () => {
    const s = computeStats("café résumé");
    expect(s.chars).toBe(11);
    expect(s.accentsRemoved).toBe(3);
    expect(s.mode).toBe("all");
  });
  it("reports mode", () => {
    const s = computeStats("café", { mode: "keep-common" });
    expect(s.mode).toBe("keep-common");
  });
});

describe("perCharBreakdown", () => {
  it("returns entries for accented chars", () => {
    const b = perCharBreakdown("café");
    expect(b.length).toBe(1);
    expect(b[0].original).toBe("é");
    expect(b[0].base).toBe("e");
    expect(b[0].count).toBe(1);
  });
  it("aggregates by character", () => {
    const b = perCharBreakdown("résumé");
    const e = b.find((e) => e.original === "é");
    expect(e?.count).toBe(2);
  });
  it("returns empty for plain text", () => {
    expect(perCharBreakdown("hello")).toEqual([]);
  });
});

describe("listAccentedChars", () => {
  it("lists distinct accented chars", () => {
    expect(listAccentedChars("café résumé").sort()).toEqual(["é"]);
  });
  it("returns empty for plain text", () => {
    expect(listAccentedChars("hello")).toEqual([]);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const csv = breakdownToCsv(perCharBreakdown("café"));
    expect(csv.split("\n")[0]).toBe("Original,Base,Marks,Count");
    expect(csv).toContain("é");
    expect(csv).toContain("e");
  });
});
