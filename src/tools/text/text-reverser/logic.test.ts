/**
 * Text Reverser — unit tests.
 */
import { describe, it, expect } from "vitest";
import { reverseText, reverseBatch, batchToCsv, type ReverseMode } from "./logic";

describe("reverseText — chars mode", () => {
  it("reverses simple string", () => {
    const r = reverseText("Hello", { mode: "chars" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("olleH");
  });
  it("handles empty input", () => {
    const r = reverseText("", { mode: "chars" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("");
  });
  it("preserves spaces", () => {
    const r = reverseText("ab cd", { mode: "chars" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("dc ba");
  });
  it("handles unicode surrogate pairs", () => {
    const r = reverseText("a🎉b", { mode: "chars" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("b🎉a");
  });
  it("skipPunctuation keeps punctuation in place", () => {
    const r = reverseText("Hello!", { mode: "chars", skipPunctuation: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("olleH!");
  });
});

describe("reverseText — words mode", () => {
  it("reverses words", () => {
    const r = reverseText("Hello World", { mode: "words" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("World Hello");
  });
  it("preserves line breaks", () => {
    const r = reverseText("a b\nc d", { mode: "words" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("b a\nd c");
  });
  it("handles multiple spaces", () => {
    const r = reverseText("a  b", { mode: "words" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("b  a");
  });
});

describe("reverseText — lines mode", () => {
  it("reverses lines", () => {
    const r = reverseText("line1\nline2\nline3", { mode: "lines" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("line3\nline2\nline1");
  });
});

describe("reverseText — sentences mode", () => {
  it("reverses sentences", () => {
    const r = reverseText("Hello world. How are you? I am fine!", { mode: "sentences" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("I am fine!");
    expect(r.output).toContain("Hello world.");
  });
});

describe("reverseText — preserve-punctuation mode", () => {
  it("reverses words but keeps punctuation position", () => {
    const r = reverseText("Hello, World!", { mode: "preserve-punctuation" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("olleH, dlroW!");
  });
});

describe("reverseText — digits-only mode", () => {
  it("reverses only digits", () => {
    const r = reverseText("a1b2c3", { mode: "digits-only" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a3b2c1");
  });
});

describe("reverseText — letters-only mode", () => {
  it("reverses only letters", () => {
    const r = reverseText("a1b2c3", { mode: "letters-only" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("c1b2a3");
  });
});

describe("reverseText — preserveCasePosition", () => {
  it("preserves case pattern of input", () => {
    const r = reverseText("Hello", { mode: "chars", preserveCasePosition: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("Olleh");
  });
});

describe("reverseBatch", () => {
  it("processes multiple inputs", () => {
    const r = reverseBatch(["abc", "xyz"], { mode: "chars" });
    expect(r.length).toBe(2);
    expect(r[0]!.output).toBe("cba");
    expect(r[1]!.output).toBe("zyx");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = reverseBatch(["abc"], { mode: "chars" });
    const csv = batchToCsv(r, ["abc"]);
    expect(csv.split("\n")[0]).toBe("Input,Output,Mode");
    expect(csv).toContain("abc");
    expect(csv).toContain("cba");
  });
  it("escapes quotes in input", () => {
    const r = reverseBatch(['has "quote"'], { mode: "chars" });
    const csv = batchToCsv(r, ['has "quote"']);
    expect(csv).toContain('""quote""');
  });
});
