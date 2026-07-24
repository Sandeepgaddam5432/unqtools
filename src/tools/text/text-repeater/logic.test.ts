/**
 * Text Repeater — unit tests.
 */
import { describe, it, expect } from "vitest";
import { repeatText, generateLoremIpsum, generateBarcodePattern, type NumberingMode } from "./logic";

describe("repeatText — basic", () => {
  it("repeats text N times with newline separator", () => {
    const r = repeatText("hello", { count: 3 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello\nhello\nhello");
    expect(r.actualCount).toBe(3);
  });
  it("handles count=1", () => {
    const r = repeatText("hello", { count: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
  it("errors on count=0", () => {
    expect("error" in repeatText("hello", { count: 0 })).toBe(true);
  });
  it("errors on negative count", () => {
    expect("error" in repeatText("hello", { count: -5 })).toBe(true);
  });
  it("errors on too-large count", () => {
    expect("error" in repeatText("hello", { count: 2_000_000 })).toBe(true);
  });
  it("returns empty output for empty input", () => {
    const r = repeatText("", { count: 3 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("");
  });
});

describe("repeatText — separator", () => {
  it("uses custom separator", () => {
    const r = repeatText("hello", { count: 3, separator: ", " });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello, hello, hello");
  });
  it("uses empty separator", () => {
    const r = repeatText("ab", { count: 3, separator: "" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("ababab");
  });
});

describe("repeatText — prefix/suffix", () => {
  it("applies prefix and suffix", () => {
    const r = repeatText("hello", { count: 2, prefix: "[", suffix: "]", separator: "" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("[hello][hello]");
  });
});

describe("repeatText — numbering", () => {
  it("numeric numbering", () => {
    const r = repeatText("item", { count: 3, numberingMode: "numeric", numberingStart: 1, separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("1. item");
    expect(r.output).toContain("2. item");
    expect(r.output).toContain("3. item");
  });
  it("zero-padded numbering", () => {
    const r = repeatText("x", { count: 3, numberingMode: "zero-padded", separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("001. x");
  });
  it("alpha-lower numbering", () => {
    const r = repeatText("x", { count: 3, numberingMode: "alpha-lower", separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("a. x");
    expect(r.output).toContain("b. x");
  });
  it("alpha-upper numbering", () => {
    const r = repeatText("x", { count: 3, numberingMode: "alpha-upper", separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("A. x");
  });
  it("roman numbering", () => {
    const r = repeatText("x", { count: 4, numberingMode: "roman", separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("I. x");
    expect(r.output).toContain("II. x");
    expect(r.output).toContain("III. x");
    expect(r.output).toContain("IV. x");
  });
  it("numberingStart + numberingStep", () => {
    const r = repeatText("x", { count: 3, numberingMode: "numeric", numberingStart: 10, numberingStep: 5, separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("10. x");
    expect(r.output).toContain("15. x");
    expect(r.output).toContain("20. x");
  });
});

describe("repeatText — pattern", () => {
  it("uses pattern with placeholders", () => {
    const r = repeatText("hello", { count: 2, pattern: "[{n}] {text}!", separator: "\n", numberingMode: "numeric" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("[1] hello!");
    expect(r.output).toContain("[2] hello!");
  });
  it("uses {i} for 0-based index", () => {
    const r = repeatText("x", { count: 3, pattern: "{i}-{text}", separator: "\n" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("0-x");
    expect(r.output).toContain("1-x");
    expect(r.output).toContain("2-x");
  });
});

describe("repeatText — reverse", () => {
  it("reverses each iteration", () => {
    const r = repeatText("abc", { count: 2, reverseEach: true, separator: "|" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("cba|cba");
  });
});

describe("repeatText — mirror", () => {
  it("mirrors output", () => {
    const r = repeatText("ab", { count: 2, mirror: true, separator: "|" });
    if ("error" in r) throw new Error("Should not error");
    // Output: "ab|ab" + separator + reversed "ba|ba"
    expect(r.output).toContain("ab|ab");
    expect(r.output).toContain("ba|ba");
  });
});

describe("repeatText — maxChars", () => {
  it("truncates at maxChars", () => {
    const r = repeatText("hello", { count: 100, maxChars: 20, separator: "|" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.truncated).toBe(true);
    expect(r.output.length).toBeLessThanOrEqual(20);
  });
});

describe("generateLoremIpsum", () => {
  it("generates N sentences", () => {
    const s = generateLoremIpsum(5);
    const sentenceCount = s.split(".").length - 1;
    expect(sentenceCount).toBeGreaterThanOrEqual(4);
  });
  it("starts with Lorem ipsum when startWithLorem=true", () => {
    const s = generateLoremIpsum(3, true);
    expect(s.startsWith("Lorem ipsum dolor sit amet")).toBe(true);
  });
  it("does not start with Lorem when startWithLorem=false", () => {
    const s = generateLoremIpsum(3, false);
    expect(s.startsWith("Lorem ipsum")).toBe(false);
  });
});

describe("generateBarcodePattern", () => {
  it("generates pattern from text", () => {
    const p = generateBarcodePattern("AB");
    expect(p).toContain("|");
    expect(p).toContain("||");
  });
  it("produces non-empty output for non-empty input", () => {
    expect(generateBarcodePattern("X").length).toBeGreaterThan(0);
  });
});
