import { describe, it, expect } from "vitest";
import {
  mirrorChar,
  mirrorHorizontal,
  mirrorVertical,
  mirrorBoth,
  applyMirror,
  applyMirrorBatch,
  computeStats,
  characterMap,
  listMirrorableChars,
  perCharBreakdown,
  breakdownToCsv,
  sampleText,
  type MirrorMode,
} from "./logic";

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

describe("applyMirror", () => {
  it("dispatches by mode", () => {
    expect(applyMirror("abc", "horizontal")).toBe("cba");
    expect(applyMirror("a", "vertical")).toBe("ɐ");
  });
});

describe("applyMirrorBatch", () => {
  it("processes multiple lines", () => {
    expect(applyMirrorBatch(["abc", "def"], "horizontal")).toEqual(["cba", "fed"]);
  });
});

describe("computeStats", () => {
  it("counts chars and lines", () => {
    const s = computeStats("hello\nworld", "horizontal");
    expect(s.chars).toBe(11);
    expect(s.lines).toBe(2);
  });
  it("counts mirrored chars in vertical mode", () => {
    const s = computeStats("abc", "vertical");
    expect(s.charsMirrored).toBe(3);
  });
  it("counts 0 mirrored in horizontal mode", () => {
    const s = computeStats("abc", "horizontal");
    expect(s.charsMirrored).toBe(0);
  });
});

describe("characterMap", () => {
  it("returns non-empty mapping", () => {
    const m = characterMap();
    expect(m.length).toBeGreaterThan(20);
    expect(m.some((e) => e.from === "a" && e.to === "ɐ")).toBe(true);
  });
});

describe("listMirrorableChars", () => {
  it("lists chars with mirror equivalents", () => {
    expect(listMirrorableChars("hello").sort()).toEqual(["e", "h", "l", "o"]);
  });
  it("returns empty for non-mirrorable text", () => {
    expect(listMirrorableChars("123 #")).toEqual(["1", "2", "3"]);
  });
});

describe("perCharBreakdown", () => {
  it("returns unique chars with mirrors", () => {
    const b = perCharBreakdown("hello");
    const l = b.find((e) => e.char === "l");
    expect(l?.mirrored).toBe("l");
  });
  it("deduplicates chars", () => {
    const b = perCharBreakdown("aaa");
    expect(b.length).toBe(1);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const csv = breakdownToCsv(perCharBreakdown("ab"));
    expect(csv.split("\n")[0]).toBe("Char,Mirrored");
    expect(csv).toContain("ɐ");
  });
});

describe("sampleText", () => {
  it("returns multi-line sample", () => {
    expect(sampleText()).toContain("\n");
  });
});
