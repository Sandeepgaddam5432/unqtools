import { describe, it, expect } from "vitest";
import { process, countSyllables, statsToCsv } from "./logic";

describe("countSyllables", () => {
  it("counts simple words", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("world")).toBe(1);
  });
  it("handles silent e", () => {
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("code")).toBe(1);
  });
});

describe("process — basic counts", () => {
  it("counts characters", () => {
    const r = process("hello");
    expect(r.characters).toBe(5);
    expect(r.charactersNoSpaces).toBe(5);
  });
  it("counts words", () => {
    const r = process("hello world foo");
    expect(r.words).toBe(3);
  });
  it("counts sentences", () => {
    const r = process("Hello there. How are you? Fine!");
    expect(r.sentences).toBe(3);
  });
  it("counts paragraphs", () => {
    const r = process("Para one.\n\nPara two.\n\nPara three.");
    expect(r.paragraphs).toBe(3);
  });
  it("counts lines", () => {
    const r = process("a\nb\nc");
    expect(r.lines).toBe(3);
  });
});

describe("process — readability", () => {
  it("computes Flesch reading ease", () => {
    const r = process("The cat sat on the mat. The dog ran fast.");
    expect(typeof r.fleschReadingEase).toBe("number");
    expect(Number.isFinite(r.fleschReadingEase)).toBe(true);
    expect(Number.isFinite(r.fleschKincaidGrade)).toBe(true);
  });
  it("handles empty input", () => {
    const r = process("");
    expect(r.words).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("computes reading time", () => {
    const r = process("word ".repeat(400));
    expect(r.readingTimeMinutes).toBeCloseTo(2, 1);
  });
  it("finds longest word", () => {
    const r = process("a bb ccc dddd");
    expect(r.longestWord).toBe("dddd");
  });
  it("computes higher grade for complex sentence", () => {
    const r = process("Incomprehensibilities manifest phenomenologically throughout the convoluted sentence structure.");
    expect(r.fleschKincaidGrade).toBeGreaterThan(0);
  });
});

describe("statsToCsv", () => {
  it("generates CSV with header", () => {
    const csv = statsToCsv(process("hello world"));
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Words,2");
  });
});
