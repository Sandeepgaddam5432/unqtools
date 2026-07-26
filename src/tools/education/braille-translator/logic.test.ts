import { describe, it, expect } from "vitest";
import {
  dotPatternToChar, charToDotPattern, dotsToString, stringToDots, translateToGrade1,
  translateFromGrade1, translateToGrade2, translate, translateBatch, renderBatchCsv,
  renderReport, brailleToAsciiArt,
} from "./logic";

describe("braille-translator dotPatternToChar / charToDotPattern", () => {
  it("converts dots 0 to blank braille char", () => {
    expect(dotPatternToChar(0)).toBe("⠀");
  });
  it("round-trips a dot pattern", () => {
    const dots = 0b00000101;
    expect(charToDotPattern(dotPatternToChar(dots))).toBe(dots);
  });
  it("returns 0 for non-braille char", () => {
    expect(charToDotPattern("a")).toBe(0);
  });
});

describe("braille-translator dotsToString / stringToDots", () => {
  it("converts bitmask to dot string", () => {
    expect(dotsToString(0b00000101)).toBe("1-3");
  });
  it("round-trips dot string", () => {
    const dots = 0b00000111;
    expect(stringToDots(dotsToString(dots))).toBe(dots);
  });
  it("handles empty dots", () => {
    expect(dotsToString(0)).toBe("");
  });
});

describe("braille-translator translateToGrade1", () => {
  it("translates lowercase letters", () => {
    expect(translateToGrade1("a")).toBe(dotPatternToChar(0b00000001));
  });
  it("handles spaces", () => {
    // Standard Braille: a=dots1, b=dots1,2, space=dots0
    expect(translateToGrade1("a b")).toBe(dotPatternToChar(0b00000001) + "⠀" + dotPatternToChar(0b00000011));
  });
  it("adds number indicator before digits", () => {
    const result = translateToGrade1("1");
    // Should be: number indicator (dots 3-4-5-6) + dot 1
    expect(result.length).toBe(2);
  });
  it("adds capital indicator before uppercase letters", () => {
    const result = translateToGrade1("A");
    expect(result.length).toBe(2);
  });
  it("passes through unknown characters", () => {
    expect(translateToGrade1("@")).toBe("@");
  });
});

describe("braille-translator translateFromGrade1", () => {
  it("round-trips simple lowercase text", () => {
    const text = "hello";
    expect(translateFromGrade1(translateToGrade1(text))).toBe(text);
  });
  it("round-trips digits", () => {
    const text = "123";
    expect(translateFromGrade1(translateToGrade1(text))).toBe(text);
  });
  it("round-trips mixed case", () => {
    const text = "Hello";
    expect(translateFromGrade1(translateToGrade1(text))).toBe(text);
  });
});

describe("braille-translator translateToGrade2", () => {
  it("applies contractions", () => {
    const g1 = translateToGrade1("the cat");
    const g2 = translateToGrade2("the cat");
    // Grade 2 should be shorter due to contraction of "the"
    expect(g2.length).toBeLessThanOrEqual(g1.length);
  });
});

describe("braille-translator translate", () => {
  it("translates Grade 1", () => {
    const r = translate({ text: "hello", grade: "grade1" });
    expect(r.braille.length).toBe(5);
    expect(r.dotPatterns.length).toBe(5);
    expect(r.reverseTranslation).toBe("hello");
  });
  it("translates Grade 2 with contractions", () => {
    const r = translate({ text: "the cat", grade: "grade2" });
    expect(r.braille.length).toBeGreaterThan(0);
    expect(r.notes.some((n) => n.includes("Grade 2"))).toBe(true);
  });
  it("warns on empty input", () => {
    const r = translate({ text: "", grade: "grade1" });
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true);
  });
});

describe("braille-translator translateBatch / renderBatchCsv", () => {
  it("processes batch", () => {
    const rs = translateBatch([
      { text: "hello", grade: "grade1" },
      { text: "world", grade: "grade1" },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV with header", () => {
    const csv = renderBatchCsv(translateBatch([{ text: "hello", grade: "grade1" }]));
    expect(csv.split("\n")[0]).toContain("index,input,grade");
  });
});

describe("braille-translator renderReport", () => {
  it("renders report", () => {
    const r = renderReport(translate({ text: "hello", grade: "grade1" }));
    expect(r).toContain("Braille Translation Report");
    expect(r).toContain("Dot patterns");
    expect(r).toContain("Reverse translation");
  });
});

describe("braille-translator brailleToAsciiArt", () => {
  it("renders 3 lines of ASCII art", () => {
    const art = brailleToAsciiArt(translateToGrade1("ab"));
    expect(art.split("\n").length).toBe(3);
  });
  it("includes dot characters", () => {
    const art = brailleToAsciiArt(translateToGrade1("a"));
    expect(art).toMatch(/[●○]/);
  });
});
