import { describe, it, expect } from "vitest";
import { toBubble, decodeBubble, getStyleA11y, type BubbleStyle } from "./logic";

describe("toBubble — circled", () => {
  it("converts uppercase to circled", () => {
    expect(toBubble("ABC", "circled")).toBe("ⒶⒷⒸ");
  });
  it("converts lowercase to circled", () => {
    expect(toBubble("abc", "circled")).toBe("ⓐⓑⓒ");
  });
  it("converts digits to circled", () => {
    expect(toBubble("012", "circled")).toBe("⓪①②");
  });
  it("preserves unmapped characters", () => {
    expect(toBubble("Hello! 🎉", "circled")).toContain("Ⓗ"); // uppercase H
    expect(toBubble("Hello! 🎉", "circled")).toContain("!");
    expect(toBubble("Hello! 🎉", "circled")).toContain("🎉");
  });
});

describe("toBubble — circled-negative", () => {
  it("converts uppercase to negative circled", () => {
    expect(toBubble("AB", "circled-negative")).toBe("🅐🅑");
  });
  it("falls back to circled for lowercase (no negative lowercase in Unicode)", () => {
    expect(toBubble("ab", "circled-negative")).toBe("ⓐⓑ");
  });
});

describe("toBubble — squared", () => {
  it("converts uppercase to squared", () => {
    expect(toBubble("AB", "squared")).toBe("🄰🄱");
  });
  it("falls back to original for lowercase (no lowercase squared)", () => {
    expect(toBubble("ab", "squared")).toBe("ab");
  });
});

describe("toBubble — squared-negative", () => {
  it("converts uppercase to negative squared", () => {
    expect(toBubble("AB", "squared-negative")).toBe("🅰🅱");
  });
});

describe("decodeBubble", () => {
  it("decodes circled back to normal", () => {
    expect(decodeBubble("ⒶⓑⒸ")).toBe("AbC");
  });
  it("decodes negative circled", () => {
    expect(decodeBubble("🅐🅑")).toBe("AB");
  });
  it("preserves unmapped", () => {
    expect(decodeBubble("Hello ⓦⓞⓡⓛⓓ")).toBe("Hello world");
  });
});

describe("toBubble — edge cases", () => {
  it("handles empty input", () => {
    expect(toBubble("", "circled")).toBe("");
  });
  it("preserves emoji", () => {
    expect(toBubble("🎉", "circled")).toBe("🎉");
  });
  it("handles newlines", () => {
    expect(toBubble("a\nb", "circled")).toBe("ⓐ\nⓑ");
  });
  it("handles huge input (10K)", () => {
    const input = "a".repeat(10000);
    expect(toBubble(input, "circled").length).toBe(10000);
  });
});

describe("getStyleA11y", () => {
  it("returns note for each style", () => {
    const styles: BubbleStyle[] = ["circled", "circled-negative", "squared", "squared-negative"];
    for (const s of styles) expect(getStyleA11y(s).length).toBeGreaterThan(3);
  });
});
