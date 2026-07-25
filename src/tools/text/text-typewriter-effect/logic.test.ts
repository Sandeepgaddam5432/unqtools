import { describe, it, expect } from "vitest";
import {
  DEFAULT_OPTIONS,
  validateOptions,
  delayForChar,
  cumulativeStart,
  totalDuration,
  escapeHtml,
  typewriterHtml,
  typewriterCss,
} from "./logic";

describe("validateOptions", () => {
  it("fills defaults", () => {
    expect(validateOptions({})).toEqual(DEFAULT_OPTIONS);
  });
  it("clamps cps", () => {
    expect(validateOptions({ cps: 0 }).cps).toBe(1);
    expect(validateOptions({ cps: 1000 }).cps).toBe(100);
  });
  it("clamps pauses >= 0", () => {
    expect(validateOptions({ sentencePause: -5 }).sentencePause).toBe(0);
    expect(validateOptions({ commaPause: -5 }).commaPause).toBe(0);
  });
  it("defaults loop to true", () => {
    expect(validateOptions({}).loop).toBe(true);
  });
});

describe("delayForChar", () => {
  it("returns 0 for first char", () => {
    expect(delayForChar("hi", 0, DEFAULT_OPTIONS)).toBe(0);
  });
  it("returns base delay for normal char", () => {
    expect(delayForChar("hi", 1, DEFAULT_OPTIONS)).toBeCloseTo(1000 / 12);
  });
  it("multiplies after sentence punctuation", () => {
    const d1 = delayForChar("h.i", 2, DEFAULT_OPTIONS);
    expect(d1).toBeCloseTo((1000 / 12) * DEFAULT_OPTIONS.sentencePause);
  });
  it("multiplies after comma", () => {
    const d1 = delayForChar("h,i", 2, DEFAULT_OPTIONS);
    expect(d1).toBeCloseTo((1000 / 12) * DEFAULT_OPTIONS.commaPause);
  });
});

describe("cumulativeStart", () => {
  it("starts at 0", () => {
    expect(cumulativeStart("hello", DEFAULT_OPTIONS)[0]).toBe(0);
  });
  it("is monotonically non-decreasing", () => {
    const starts = cumulativeStart("hello, world.", DEFAULT_OPTIONS);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]!).toBeGreaterThanOrEqual(starts[i - 1]!);
    }
  });
  it("has length === text.length", () => {
    expect(cumulativeStart("abc", DEFAULT_OPTIONS).length).toBe(3);
  });
});

describe("totalDuration", () => {
  it("is 0 for empty input", () => {
    expect(totalDuration("", DEFAULT_OPTIONS)).toBe(0);
  });
  it("is positive for non-empty input", () => {
    expect(totalDuration("hello", DEFAULT_OPTIONS)).toBeGreaterThan(0);
  });
  it("increases with longer text", () => {
    expect(totalDuration("hello world", DEFAULT_OPTIONS)).toBeGreaterThan(totalDuration("hi", DEFAULT_OPTIONS));
  });
});

describe("escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml("<b>&")).toBe("&lt;b&gt;&amp;");
  });
  it("preserves normal text", () => {
    expect(escapeHtml("hello")).toBe("hello");
  });
});

describe("typewriterHtml", () => {
  it("returns empty for empty input", () => {
    expect(typewriterHtml("", DEFAULT_OPTIONS)).toBe("");
  });
  it("wraps each char in a span with animation", () => {
    const html = typewriterHtml("ab", DEFAULT_OPTIONS);
    expect(html).toContain("<span");
    expect(html).toContain("animation:tw");
  });
  it("handles newlines as <br/>", () => {
    expect(typewriterHtml("a\nb", DEFAULT_OPTIONS)).toContain("<br/>");
  });
  it("escapes HTML in input", () => {
    const html = typewriterHtml("<b>", DEFAULT_OPTIONS);
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("typewriterCss", () => {
  it("contains keyframes", () => {
    const css = typewriterCss();
    expect(css).toContain("@keyframes tw");
    expect(css).toContain("opacity:1");
  });
});
