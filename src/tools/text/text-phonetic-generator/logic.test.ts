import { describe, it, expect } from "vitest";
import { phoneticFor, toPhonetic, toPhoneticDetailed, validateScheme, NATO } from "./logic";

describe("NATO table", () => {
  it("has 26 letters + 10 digits", () => {
    expect(Object.keys(NATO).length).toBeGreaterThanOrEqual(36);
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

describe("validateScheme", () => {
  it("accepts nato", () => {
    expect(validateScheme("nato")).toEqual({ ok: true, scheme: "nato" });
  });
  it("rejects unknown", () => {
    expect(validateScheme("xyz")).toHaveProperty("error");
  });
});
