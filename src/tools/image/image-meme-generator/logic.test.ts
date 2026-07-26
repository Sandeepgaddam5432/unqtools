/**
 * Meme Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  fitFontSize, estimateTextWidth, wrapMemeText,
  topTextPosition, bottomTextPosition, formatMemeText,
  validateOptions, computeMemeLayout, optimalOutlineWidth,
  parseHex, contrastFor, serialize, deserialize,
  suggestFontSize, autoSplit, TEMPLATES, MEME_PRESETS,
} from "./logic";

const VALID_OPTS = {
  topText: "HELLO", bottomText: "WORLD", fontSize: 48, fontFamily: "Impact",
  color: "#ffffff", outlineColor: "#000000", outlineWidth: 3, uppercase: true,
};

describe("fitFontSize", () => {
  it("returns base size when text fits", () => {
    expect(fitFontSize("HI", 800, 48)).toBe(48);
  });
  it("reduces size when text is too wide", () => {
    expect(fitFontSize("THIS IS A VERY LONG TEXT", 100, 48)).toBeLessThan(48);
  });
  it("respects minimum size", () => {
    expect(fitFontSize("VERYLONGTEXT", 50, 48, 20)).toBeGreaterThanOrEqual(20);
  });
});

describe("estimateTextWidth", () => {
  it("returns positive width for non-empty text", () => {
    expect(estimateTextWidth("HELLO", 48)).toBeGreaterThan(0);
  });
  it("returns 0 for empty text", () => {
    expect(estimateTextWidth("", 48)).toBe(0);
  });
});

describe("wrapMemeText", () => {
  it("wraps long text into multiple lines", () => {
    const lines = wrapMemeText("THIS IS A VERY LONG MEME TEXT THAT SHOULD WRAP", 200, 48);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("returns single line for short text", () => {
    expect(wrapMemeText("HI", 800, 48)).toEqual(["HI"]);
  });
});

describe("formatMemeText", () => {
  it("uppercases text", () => {
    expect(formatMemeText("hello world", true)).toBe("HELLO WORLD");
  });
  it("preserves case when uppercase=false", () => {
    expect(formatMemeText("Hello", false)).toBe("Hello");
  });
});

describe("topTextPosition", () => {
  it("returns Y positions for lines", () => {
    const positions = topTextPosition(["HELLO"], 48, 800);
    expect(positions[0].y).toBeGreaterThan(0);
    expect(positions[0].y).toBeLessThan(200);
  });
});

describe("bottomTextPosition", () => {
  it("returns Y positions near bottom", () => {
    const positions = bottomTextPosition(["WORLD"], 48, 800, 600);
    expect(positions[0].y).toBeGreaterThan(400);
  });
});

describe("validateOptions", () => {
  it("returns empty array for valid options", () => {
    expect(validateOptions(VALID_OPTS).length).toBe(0);
  });
  it("warns on small font", () => {
    expect(validateOptions({ ...VALID_OPTS, fontSize: 4 }).length).toBeGreaterThan(0);
  });
});

describe("computeMemeLayout", () => {
  it("computes layout for valid input", () => {
    const r = computeMemeLayout(800, 600, VALID_OPTS);
    expect(r.topLines.length).toBeGreaterThan(0);
    expect(r.bottomLines.length).toBeGreaterThan(0);
  });
});

describe("TEMPLATES", () => {
  it("has at least 5 templates", () => {
    expect(Object.keys(TEMPLATES).length).toBeGreaterThanOrEqual(5);
  });
});

describe("MEME_PRESETS", () => {
  it("has at least 3 presets", () => {
    expect(MEME_PRESETS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("optimalOutlineWidth", () => {
  it("returns positive width", () => {
    expect(optimalOutlineWidth(48)).toBeGreaterThan(0);
  });
});

describe("parseHex", () => {
  it("parses valid hex", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("parses short hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("returns null for invalid length", () => {
    expect(parseHex("#ff")).toBeNull();
  });
});

describe("contrastFor", () => {
  it("returns white for dark background", () => {
    expect(contrastFor("#000000")).toBe("#ffffff");
  });
  it("returns black for light background", () => {
    expect(contrastFor("#ffffff")).toBe("#000000");
  });
});

describe("serialize / deserialize", () => {
  it("round-trips options", () => {
    const json = serialize(VALID_OPTS);
    const back = deserialize(json);
    expect(back.topText).toBe("HELLO");
  });
});

describe("autoSplit", () => {
  it("splits text into top and bottom", () => {
    const { top, bottom } = autoSplit("ONE TWO THREE FOUR");
    expect(top).toBeTruthy();
    expect(bottom).toBeTruthy();
  });
});

describe("suggestFontSize", () => {
  it("suggests size based on width", () => {
    expect(suggestFontSize("HELLO", 800)).toBeGreaterThan(0);
  });
});
