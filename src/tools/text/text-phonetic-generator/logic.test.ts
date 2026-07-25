import { describe, it, expect } from "vitest";
import {
  phoneticFor,
  toPhonetic,
  toPhoneticDetailed,
  toPhoneticWithPronunciation,
  toPhoneticBatch,
  validateScheme,
  computeStats,
  perCharBreakdown,
  listAlphabet,
  breakdownToCsv,
  NATO,
  FAA,
  INTERNATIONAL,
  getTable,
} from "./logic";

describe("tables", () => {
  it("NATO has 26 letters + 10 digits", () => {
    expect(Object.keys(NATO).length).toBeGreaterThanOrEqual(36);
  });
  it("FAA uses Alpha for A", () => {
    expect(FAA["A"]).toBe("Alpha");
  });
  it("INTERNATIONAL equals NATO", () => {
    expect(INTERNATIONAL["A"]).toBe(NATO["A"]);
  });
});

describe("getTable", () => {
  it("returns NATO by default", () => {
    expect(getTable()["A"]).toBe("Alfa");
  });
  it("returns FAA when requested", () => {
    expect(getTable("faa")["A"]).toBe("Alpha");
  });
});

describe("phoneticFor", () => {
  it("returns NATO for A", () => {
    expect(phoneticFor("A")).toBe("Alfa");
  });
  it("returns NATO for a (lowercase)", () => {
    expect(phoneticFor("a")).toBe("Alfa");
  });
  it("returns Niner for 9", () => {
    expect(phoneticFor("9")).toBe("Niner");
  });
  it("handles space", () => {
    expect(phoneticFor(" ")).toBe("(space)");
  });
  it("handles newline", () => {
    expect(phoneticFor("\n")).toBe("(newline)");
  });
  it("returns uppercase for unknown symbol", () => {
    expect(phoneticFor("@")).toBe("@");
  });
});

describe("toPhonetic", () => {
  it("spells HELLO", () => {
    expect(toPhonetic("HELLO")).toBe("Hotel Echo Lima Lima Oscar");
  });
  it("handles empty string", () => {
    expect(toPhonetic("")).toBe("");
  });
  it("preserves spaces as (space)", () => {
    expect(toPhonetic("A B")).toBe("Alfa (space) Bravo");
  });
});

describe("toPhoneticDetailed", () => {
  it("shows arrow format", () => {
    const out = toPhoneticDetailed("AB");
    expect(out).toContain("A → Alfa");
    expect(out).toContain("B → Bravo");
  });
  it("handles empty string", () => {
    expect(toPhoneticDetailed("")).toBe("");
  });
});

describe("toPhoneticWithPronunciation", () => {
  it("includes pronunciation in parens", () => {
    const out = toPhoneticWithPronunciation("A");
    expect(out).toContain("Alfa");
    expect(out).toContain("AL-fah");
  });
});

describe("toPhoneticBatch", () => {
  it("processes multiple lines", () => {
    expect(toPhoneticBatch(["AB", "CD"])).toEqual(["Alfa Bravo", "Charlie Delta"]);
  });
});

describe("validateScheme", () => {
  it("accepts nato", () => {
    expect(validateScheme("nato")).toEqual({ ok: true, scheme: "nato" });
  });
  it("rejects unknown", () => {
    expect(validateScheme("xyz")).toHaveProperty("error");
  });
});

describe("computeStats", () => {
  it("counts letter vs digit vs space", () => {
    const s = computeStats("A1 B");
    expect(s.chars).toBe(4);
    expect(s.letters).toBe(2);
    expect(s.digits).toBe(1);
    expect(s.spaces).toBe(1);
  });
});

describe("perCharBreakdown", () => {
  it("returns aggregated entries", () => {
    const b = perCharBreakdown("AAB");
    const a = b.find((e) => e.char === "A");
    expect(a?.count).toBe(2);
    expect(a?.word).toBe("Alfa");
  });
  it("includes pronunciation when available", () => {
    const b = perCharBreakdown("A");
    expect(b[0].pronunciation).toBe("AL-fah");
  });
});

describe("listAlphabet", () => {
  it("returns 36 entries (26 + 10)", () => {
    expect(listAlphabet().length).toBe(36);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const csv = breakdownToCsv(perCharBreakdown("A B"));
    expect(csv.split("\n")[0]).toBe("Char,Word,Pronunciation,Count");
    expect(csv).toContain("Alfa");
  });
});
