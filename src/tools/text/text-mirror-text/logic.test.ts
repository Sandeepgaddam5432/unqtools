import { describe, it, expect } from "vitest";
import { mirrorChar, mirrorHorizontal, mirrorVertical, mirrorBoth } from "./logic";

describe("mirrorChar", () => {
  it("maps lowercase letters", () => {
    expect(mirrorChar("a")).toBe("ɐ");
    expect(mirrorChar("p")).toBe("d");
  });
  it("maps uppercase letters", () => {
    expect(mirrorChar("A")).toBe("∀");
    expect(mirrorChar("M")).toBe("W");
  });
  it("maps digits", () => {
    expect(mirrorChar("6")).toBe("9");
    expect(mirrorChar("9")).toBe("6");
  });
  it("maps punctuation", () => {
    expect(mirrorChar("?")).toBe("¿");
    expect(mirrorChar("!")).toBe("¡");
  });
  it("passes through unknown chars", () => {
    expect(mirrorChar("#")).toBe("#");
    expect(mirrorChar(" ")).toBe(" ");
  });
});

describe("mirrorHorizontal", () => {
  it("reverses character sequence", () => {
    expect(mirrorHorizontal("hello")).toBe("olleh");
  });
  it("handles multi-byte chars (code-point safe)", () => {
    expect(mirrorHorizontal("a😀b")).toBe("b😀a");
  });
  it("returns empty for empty input", () => {
    expect(mirrorHorizontal("")).toBe("");
  });
  it("preserves spaces", () => {
    expect(mirrorHorizontal("hi there")).toBe("ereht ih");
  });
});

describe("mirrorVertical", () => {
  it("reverses line order AND chars", () => {
    const out = mirrorVertical("hi\nbye");
    expect(out).toBe("ǝʎq\nᴉɥ");
  });
  it("single line still gets upside-down", () => {
    expect(mirrorVertical("hello")).toBe("ollǝɥ");
  });
  it("returns empty for empty input", () => {
    expect(mirrorVertical("")).toBe("");
  });
  it("preserves blank lines", () => {
    expect(mirrorVertical("a\n\nb")).toBe("q\n\nɐ");
  });
});

describe("mirrorBoth", () => {
  it("equals vertical(horizontal(x))", () => {
    const s = "hello world";
    expect(mirrorBoth(s)).toBe(mirrorVertical(mirrorHorizontal(s)));
  });
  it("returns empty for empty input", () => {
    expect(mirrorBoth("")).toBe("");
  });
  it("preserves content length (per line)", () => {
    const out = mirrorBoth("hello");
    expect(Array.from(out).length).toBe(5);
  });
});
