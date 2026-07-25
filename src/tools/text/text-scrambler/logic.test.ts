import { describe, it, expect } from "vitest";
import { mulberry32, shuffle, scrambleWord, isWord, scrambleText } from "./logic";

describe("mulberry32", () => {
  it("produces deterministic sequence for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
  it("returns values in [0,1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("preserves multiset of elements", () => {
    const arr = ["a", "b", "c", "d"];
    const out = shuffle(arr, mulberry32(5));
    expect(out.sort()).toEqual(arr.sort());
  });
  it("is deterministic for same seed", () => {
    const a = shuffle(["a", "b", "c", "d"], mulberry32(5));
    const b = shuffle(["a", "b", "c", "d"], mulberry32(5));
    expect(a).toEqual(b);
  });
  it("returns new array (doesn't mutate input)", () => {
    const arr = ["a", "b", "c"];
    const out = shuffle(arr, mulberry32(5));
    expect(arr).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(arr);
  });
  it("handles single element", () => {
    expect(shuffle(["x"], mulberry32(5))).toEqual(["x"]);
  });
});

describe("scrambleWord", () => {
  it("keeps first and last letter", () => {
    const out = scrambleWord("hello", mulberry32(1));
    expect(out[0]).toBe("h");
    expect(out[out.length - 1]).toBe("o");
    expect(out.length).toBe(5);
  });
  it("returns short words unchanged", () => {
    expect(scrambleWord("hi", mulberry32(1))).toBe("hi");
    expect(scrambleWord("the", mulberry32(1))).toBe("the");
  });
  it("preserves middle letters as multiset", () => {
    const out = scrambleWord("worlds", mulberry32(7));
    expect(out.split("").sort().join("")).toBe("worlds".split("").sort().join(""));
  });
  it("is deterministic for same seed", () => {
    const a = scrambleWord("programming", mulberry32(99));
    const b = scrambleWord("programming", mulberry32(99));
    expect(a).toBe(b);
  });
});

describe("isWord", () => {
  it("true for alphabetic only", () => {
    expect(isWord("hello")).toBe(true);
  });
  it("false for punctuation", () => {
    expect(isWord("hello!")).toBe(false);
    expect(isWord(" ")).toBe(false);
    expect(isWord("")).toBe(false);
  });
});

describe("scrambleText", () => {
  it("preserves whitespace and punctuation", () => {
    const out = scrambleText("hello, world!", 1);
    expect(out).toMatch(/^[a-z]+, [a-z]+!$/);
    expect(out).toContain(",");
    expect(out).toContain("!");
  });
  it("returns empty for empty input", () => {
    expect(scrambleText("", 1)).toBe("");
  });
  it("is deterministic for same seed", () => {
    const a = scrambleText("the quick brown fox", 5);
    const b = scrambleText("the quick brown fox", 5);
    expect(a).toBe(b);
  });
  it("keeps first/last letter of each word", () => {
    const out = scrambleText("hello worlds", 1);
    const words = out.split(" ");
    expect(words[0]![0]).toBe("h");
    expect(words[0]![words[0]!.length - 1]).toBe("o");
    expect(words[1]![0]).toBe("w");
    expect(words[1]![words[1]!.length - 1]).toBe("s");
  });
});
