import { describe, it, expect } from "vitest";
import { leetChar, toLeet, fromLeet, validateLevel, LEET_BASIC, LEET_INTERMEDIATE, LEET_ADVANCED } from "./logic";

describe("Leet tables", () => {
  it("basic has 6 entries", () => {
    expect(Object.keys(LEET_BASIC).length).toBe(6);
  });
  it("intermediate extends basic", () => {
    expect(LEET_INTERMEDIATE.a).toBe("4");
    expect(LEET_INTERMEDIATE.b).toBe("8");
  });
  it("advanced has more entries than intermediate", () => {
    expect(Object.keys(LEET_ADVANCED).length).toBeGreaterThan(Object.keys(LEET_INTERMEDIATE).length);
  });
});

describe("leetChar", () => {
  it("converts a → 4 in basic", () => {
    expect(leetChar("a", "basic")).toBe("4");
  });
  it("preserves non-mapped chars", () => {
    expect(leetChar("x", "basic")).toBe("x");
  });
  it("handles empty string", () => {
    expect(leetChar("", "basic")).toBe("");
  });
});

describe("toLeet", () => {
  it("basic substitution", () => {
    expect(toLeet("leet", "basic")).toBe("l337");
  });
  it("preserves case of non-mapped chars", () => {
    expect(toLeet("LEET", "basic")).toBe("L337");
  });
  it("advanced uses @ for a", () => {
    expect(toLeet("a", "advanced")).toBe("@");
  });
  it("handles empty string", () => {
    expect(toLeet("", "basic")).toBe("");
  });
});

describe("fromLeet", () => {
  it("reverses basic leet", () => {
    expect(fromLeet("l337", "basic")).toBe("leet");
  });
  it("handles empty string", () => {
    expect(fromLeet("", "basic")).toBe("");
  });
  it("preserves non-mapped chars", () => {
    expect(fromLeet("x", "basic")).toBe("x");
  });
});

describe("validateLevel", () => {
  it("accepts basic", () => {
    expect(validateLevel("basic")).toEqual({ ok: true, level: "basic" });
  });
  it("rejects unknown", () => {
    expect(validateLevel("ultra")).toHaveProperty("error");
  });
});
