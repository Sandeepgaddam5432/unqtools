import { describe, it, expect } from "vitest";
import {
  detectList,
  addOxfordComma,
  removeOxfordComma,
  fixStyle,
  fixAP,
  countOxfordCommas,
  stats,
  validateOptions,
  batchFix,
  explainChange,
  STYLE_INFO,
  type Style,
} from "./logic";

describe("detectList", () => {
  it("detects a list of 3+ items", () => {
    const r = detectList("apples, oranges and bananas");
    expect(r.isList).toBe(true);
    expect(r.conjunction).toBe("and");
  });
  it("returns false for 2-item list", () => {
    expect(detectList("apples and oranges").isList).toBe(false);
  });
  it("detects 'or' conjunction", () => {
    const r = detectList("tea, coffee or milk");
    expect(r.isList).toBe(true);
    expect(r.conjunction).toBe("or");
  });
  it("handles 'as well as'", () => {
    const r = detectList("pizza, pasta as well as salad");
    expect(r.isList).toBe(true);
  });
});

describe("addOxfordComma", () => {
  it("adds comma before 'and' in 3+ list", () => {
    expect(addOxfordComma("apples, oranges and bananas")).toBe("apples, oranges, and bananas");
  });
  it("does not duplicate existing Oxford comma", () => {
    expect(addOxfordComma("apples, oranges, and bananas")).toBe("apples, oranges, and bananas");
  });
  it("leaves 2-item list alone", () => {
    expect(addOxfordComma("apples and oranges")).toBe("apples and oranges");
  });
  it("handles 'or'", () => {
    expect(addOxfordComma("tea, coffee or milk")).toBe("tea, coffee, or milk");
  });
  it("leaves non-list sentence alone", () => {
    expect(addOxfordComma("Hello world.")).toBe("Hello world.");
  });
});

describe("removeOxfordComma", () => {
  it("removes the Oxford comma", () => {
    expect(removeOxfordComma("apples, oranges, and bananas")).toBe("apples, oranges and bananas");
  });
  it("leaves non-Oxford comma lists alone", () => {
    expect(removeOxfordComma("apples, oranges and bananas")).toBe("apples, oranges and bananas");
  });
});

describe("fixStyle", () => {
  it("APA adds Oxford comma", () => {
    expect(fixStyle("apples, oranges and bananas", { style: "apa" })).toBe("apples, oranges, and bananas");
  });
  it("Chicago adds Oxford comma", () => {
    expect(fixStyle("apples, oranges and bananas", { style: "chicago" })).toBe("apples, oranges, and bananas");
  });
  it("'none' removes Oxford comma", () => {
    expect(fixStyle("apples, oranges, and bananas", { style: "none" })).toBe("apples, oranges and bananas");
  });
});

describe("fixAP", () => {
  it("removes Oxford comma in simple list", () => {
    expect(fixAP("apples, oranges, and bananas")).toBe("apples, oranges and bananas");
  });
  it("keeps Oxford comma when item contains conjunction", () => {
    // "mac and cheese" contains "and" — ambiguous, keep the comma
    const out = fixAP("burgers, mac and cheese, and fries");
    expect(out).toMatch(/cheese, and fries/);
  });
});

describe("countOxfordCommas", () => {
  it("counts Oxford commas", () => {
    expect(countOxfordCommas("apples, oranges, and bananas. Tea, coffee, and milk.")).toBe(2);
  });
  it("returns 0 for no Oxford commas", () => {
    expect(countOxfordCommas("apples, oranges and bananas")).toBe(0);
  });
});

describe("stats", () => {
  it("counts lists and commas", () => {
    const s = stats("Apples, oranges, and bananas. Tea, coffee or milk.");
    expect(s.listCount).toBeGreaterThanOrEqual(1);
    expect(s.oxfordCommas).toBeGreaterThanOrEqual(1);
  });
});

describe("validateOptions", () => {
  it("flags invalid style", () => {
    expect(validateOptions({ style: "madeup" as Style })).toContain("Invalid style");
  });
  it("flags minItems < 2", () => {
    expect(validateOptions({ style: "apa", minItems: 1 })).toContain("minItems must be ≥ 2");
  });
  it("passes valid options", () => {
    expect(validateOptions({ style: "apa" })).toHaveLength(0);
  });
});

describe("batchFix", () => {
  it("fixes each line independently", () => {
    const out = batchFix("apples, oranges and bananas\ntea, coffee or milk", { style: "apa" });
    expect(out).toContain("oranges, and bananas");
    expect(out).toContain("coffee, or milk");
  });
});

describe("explainChange", () => {
  it("explains addition", () => {
    const orig = "apples, oranges and bananas";
    const fixed = "apples, oranges, and bananas";
    const expl = explainChange(orig, fixed, { style: "apa" });
    expect(expl).toMatch(/Added Oxford comma/);
  });
  it("explains removal", () => {
    const orig = "apples, oranges, and bananas";
    const fixed = "apples, oranges and bananas";
    const expl = explainChange(orig, fixed, { style: "none" });
    expect(expl).toMatch(/Removed Oxford comma/);
  });
  it("explains no change", () => {
    const orig = "Hello world.";
    expect(explainChange(orig, orig, { style: "apa" })).toMatch(/No list detected/);
  });
});

describe("STYLE_INFO", () => {
  it("has entries for all styles", () => {
    expect(STYLE_INFO.apa.name).toBe("APA");
    expect(STYLE_INFO.chicago.name).toBe("Chicago");
    expect(STYLE_INFO.ap.name).toBe("AP");
    expect(STYLE_INFO.none.name).toBe("No Oxford");
    expect(STYLE_INFO.oxford.name).toBe("Oxford");
  });
});
