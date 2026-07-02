import { describe, it, expect } from "vitest";
import {
  addLineBreaks,
  graphemeWidth,
  segmentGraphemes,
  DEFAULT_OPTIONS,
  type AddLineBreaksOptions,
} from "./logic";

function opts(overrides: Partial<AddLineBreaksOptions>): AddLineBreaksOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

describe("addLineBreaks — wrap strategy", () => {
  it("wraps at column width, word-safe", () => {
    const input = "The quick brown fox jumps over the lazy dog";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 20, hardBreak: false }));
    const lines = result.split("\n");
    // Every line except possibly the last should be <= 20 chars
    for (const line of lines.slice(0, -1)) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
    expect(lines.join(" ")).toContain("quick");
  });

  it("does not split words when hardBreak is false", () => {
    const input = "supercalifragilisticexpialidocious is a long word";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 10, hardBreak: false }));
    expect(result).toContain("supercalifragilisticexpialidocious");
    expect(result).not.toContain("supercalifrag\n");
  });

  it("splits words when hardBreak is true", () => {
    const input = "supercalifragilisticexpialidocious";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 10, hardBreak: true }));
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
  });

  it("preserves existing line breaks by default", () => {
    const input = "Line one\nLine two\nLine three";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 80 }));
    expect(result).toContain("Line one");
    expect(result).toContain("Line two");
    expect(result).toContain("Line three");
  });

  it("collapses existing breaks when preserveExistingBreaks is false", () => {
    const input = "Line one\nLine two\nLine three";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 80,
        preserveExistingBreaks: false,
      }),
    );
    expect(result).toBe("Line one Line two Line three");
  });
});

describe("addLineBreaks — delimiter strategy", () => {
  it("inserts break after delimiter", () => {
    const input = "a, b, c, d";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "delimiter",
        delimiter: ", ",
        delimiterPosition: "after",
      }),
    );
    expect(result).toBe("a,\nb,\nc,\nd");
  });

  it("inserts break before delimiter", () => {
    const input = "a, b, c, d";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "delimiter",
        delimiter: ", ",
        delimiterPosition: "before",
      }),
    );
    expect(result).toBe("a\n, b\n, c\n, d");
  });

  it("handles special regex characters in delimiter", () => {
    const input = "a.b.c";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "delimiter",
        delimiter: ".",
        delimiterPosition: "after",
      }),
    );
    expect(result).toBe("a.\nb.\nc");
  });
});

describe("addLineBreaks — chars strategy", () => {
  it("breaks every N characters", () => {
    const input = "abcdefghij";
    const result = addLineBreaks(input, opts({ strategy: "chars", n: 3 }));
    expect(result).toBe("abc\ndef\nghi\nj");
  });

  it("handles Unicode emoji correctly (grapheme-aware)", () => {
    const input = "a🎉b🎊c";
    const result = addLineBreaks(input, opts({ strategy: "chars", n: 2 }));
    const lines = result.split("\n");
    // Each emoji is one grapheme, so: "a🎉", "b🎊", "c"
    expect(lines[0]).toBe("a🎉");
    expect(lines[1]).toBe("b🎊");
    expect(lines[2]).toBe("c");
  });
});

describe("addLineBreaks — words strategy", () => {
  it("breaks every N words", () => {
    const input = "one two three four five six seven";
    const result = addLineBreaks(input, opts({ strategy: "words", n: 3 }));
    expect(result).toBe("one two three\nfour five six\nseven");
  });
});

describe("addLineBreaks — sentences strategy", () => {
  it("breaks after each sentence", () => {
    const input = "Hello world. How are you? I am fine!";
    const result = addLineBreaks(input, opts({ strategy: "sentences" }));
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("Hello world");
    expect(lines[1]).toContain("How are you");
    expect(lines[2]).toContain("I am fine");
  });
});

describe("addLineBreaks — post-processing", () => {
  it("trims trailing spaces", () => {
    const input = "hello   \nworld   ";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 80,
        trimTrailing: true,
      }),
    );
    expect(result).not.toContain("   \n");
    expect(result).not.toMatch(/  +$/);
  });

  it("collapses blank lines", () => {
    const input = "a\n\n\n\nb";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 80,
        collapseBlanks: true,
      }),
    );
    expect(result).toBe("a\n\nb");
  });

  it("outputs CRLF when selected", () => {
    const input = "hello world";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 5,
        lineEnding: "crlf",
      }),
    );
    expect(result).toContain("\r\n");
    expect(result).not.toMatch(/[^\r]\n/);
  });

  it("applies indent", () => {
    const input = "hello\nworld";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 80,
        indent: "  ",
      }),
    );
    expect(result).toBe("  hello\n  world");
  });

  it("applies hanging indent (first line no hang)", () => {
    const input = "hello\nworld";
    const result = addLineBreaks(
      input,
      opts({
        strategy: "wrap",
        width: 80,
        indent: "  ",
        hangingIndent: "  ",
      }),
    );
    expect(result).toBe("  hello\n    world");
  });
});

describe("addLineBreaks — edge cases", () => {
  it("handles empty input", () => {
    expect(addLineBreaks("", opts({ strategy: "wrap", width: 80 }))).toBe("");
  });

  it("handles CRLF input", () => {
    const input = "line one\r\nline two";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 80 }));
    expect(result).toContain("line one");
    expect(result).toContain("line two");
    expect(result).not.toContain("\r");
  });

  it("handles CJK characters with double-width", () => {
    const input = "你好 世界 你好 世界 你好 世界";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 10, hardBreak: false }));
    const lines = result.split("\n");
    // Each CJK char is width 2; with spaces breaking words, lines should be ≤ 10 display width
    for (const line of lines) {
      const w = segmentGraphemes(line).reduce((s, g) => s + graphemeWidth(g), 0);
      expect(w).toBeLessThanOrEqual(10);
    }
  });

  it("handles huge input (1 MB) without crashing", () => {
    const input = "word ".repeat(200000); // ~1 MB
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 80 }));
    expect(result.length).toBeGreaterThan(900000);
  });

  it("handles mixed line endings in input", () => {
    const input = "line one\rline two\nline three\r\nline four";
    const result = addLineBreaks(input, opts({ strategy: "wrap", width: 80 }));
    expect(result).toContain("line one");
    expect(result).toContain("line four");
    expect(result).not.toContain("\r");
  });
});

describe("graphemeWidth", () => {
  it("returns 2 for CJK characters", () => {
    expect(graphemeWidth("你")).toBe(2);
    expect(graphemeWidth("好")).toBe(2);
    expect(graphemeWidth("世")).toBe(2);
  });

  it("returns 2 for emoji", () => {
    expect(graphemeWidth("🎉")).toBe(2);
    expect(graphemeWidth("🌍")).toBe(2);
  });

  it("returns 1 for ASCII", () => {
    expect(graphemeWidth("a")).toBe(1);
    expect(graphemeWidth("Z")).toBe(1);
    expect(graphemeWidth(" ")).toBe(1);
  });
});
