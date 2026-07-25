import { describe, it, expect } from "vitest";
import { addAccentToChar, addAccents, addCyclingAccents, validateAccentType, ACCENT_MAP } from "./logic";

describe("ACCENT_MAP", () => {
  it("has all accent types", () => {
    expect(Object.keys(ACCENT_MAP).length).toBe(5);
  });
});

describe("addAccentToChar", () => {
  it("adds acute to a", () => {
    expect(addAccentToChar("a", "acute")).toBe("á");
  });
  it("adds umlaut to u", () => {
    expect(addAccentToChar("u", "umlaut")).toBe("ü");
  });
  it("preserves non-vowel", () => {
    expect(addAccentToChar("b", "acute")).toBe("b");
  });
  it("preserves case", () => {
    expect(addAccentToChar("E", "acute")).toBe("É");
  });
});

describe("addAccents", () => {
  it("adds acute to all vowels", () => {
    expect(addAccents("aeiou", "acute")).toBe("áéíóú");
  });
  it("handles empty string", () => {
    expect(addAccents("", "acute")).toBe("");
  });
  it("preserves consonants", () => {
    expect(addAccents("hello", "acute")).toBe("hélló");
  });
  it("adds tilde to a/o/n", () => {
    expect(addAccents("ano", "tilde")).toBe("ãñõ");
  });
});

describe("addCyclingAccents", () => {
  it("cycles through accents", () => {
    const out = addCyclingAccents("aaaa");
    expect(out[0]).toBe("á");
    expect(out[1]).toBe("à");
    expect(out[2]).toBe("â");
    expect(out[3]).toBe("ä");
  });
  it("preserves non-vowels", () => {
    expect(addCyclingAccents("bbb")).toBe("bbb");
  });
});

describe("validateAccentType", () => {
  it("accepts valid type", () => {
    expect(validateAccentType("acute")).toEqual({ ok: true, type: "acute" });
  });
  it("rejects invalid type", () => {
    expect(validateAccentType("weird")).toHaveProperty("error");
  });
});
