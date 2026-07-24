/**
 * Text Trimmer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { trimText, trimBatch, diffStatsToCsv } from "./logic";

describe("trimText — basic whitespace", () => {
  it("trims both leading and trailing", () => {
    const r = trimText("  hello  ", { trimBoth: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
  it("trims only leading", () => {
    const r = trimText("  hello  ", { trimLeading: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello  ");
  });
  it("trims only trailing", () => {
    const r = trimText("  hello  ", { trimTrailing: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("  hello");
  });
  it("trims each line in perLine mode", () => {
    const r = trimText("  a  \n  b  ", { trimBoth: true, perLine: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a\nb");
  });
  it("trims entire string in non-perLine mode", () => {
    const r = trimText("  a  \n  b  ", { trimBoth: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a  \n  b");
  });
});

describe("trimText — collapse internal whitespace", () => {
  it("collapses multiple spaces to one", () => {
    const r = trimText("a    b    c", { collapseInternalWhitespace: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a b c");
  });
  it("collapses tabs", () => {
    const r = trimText("a\t\tb", { collapseInternalWhitespace: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a b");
  });
});

describe("trimText — remove empty lines", () => {
  it("removes empty lines", () => {
    // "a\n\n\nb\n\n" splits as ["a", "", "", "b", "", ""] = 6 lines, 4 empty
    const r = trimText("a\n\n\nb\n\n", { removeEmptyLines: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a\nb");
    expect(r.linesRemoved).toBe(4);
  });
  it("removes only truly empty lines (whitespace-only lines preserved when removeEmptyLines=true)", () => {
    const r = trimText("a\n   \nb", { removeEmptyLines: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("a\n   \nb");
    expect(r.linesRemoved).toBe(0);
  });
});

describe("trimText — custom chars", () => {
  it("trims custom characters", () => {
    const r = trimText("xxxhelloxxx", { customChars: "x" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
  it("trims multiple custom characters", () => {
    const r = trimText("xyhelloxy", { customChars: "xy" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
});

describe("trimText — strip quotes", () => {
  it("strips double quotes", () => {
    const r = trimText('"hello"', { stripQuotes: "double" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
  it("strips single quotes", () => {
    const r = trimText("'hello'", { stripQuotes: "single" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
  it("strips all quotes", () => {
    // Layered: " ' ` hello ` ' "
    // Each while-loop strips one outer quote pair at a time
    const r = trimText("\"'`hello`'", { stripQuotes: "all" });
    if ("error" in r) throw new Error("Should not error");
    // Strips outer " first → "'`hello`'" wait no, starts with " and ends with '
    // Actually: " is at start, ' is at end → strip-double removes leading " → `'`hello`'
    // Then strip-single: starts with ', ends with ' → removes both → `hello` (after first while)
    // Wait, after double-strip we have `'`hello`'. Then single-strip removes both ' → `hello`
    // Then backtick-strip removes both ` → hello
    expect(r.output).toBe("hello");
  });
});

describe("trimText — strip markdown", () => {
  it("strips markdown syntax chars", () => {
    const r = trimText("**bold** _italic_ `code`", { stripMarkdownSyntax: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("bold italic code");
  });
});

describe("trimText — strip HTML tags", () => {
  it("strips HTML tags", () => {
    const r = trimText("<p>hello <b>world</b></p>", { stripHtmlTags: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello world");
  });
});

describe("trimText — strip zero-width chars", () => {
  it("strips zero-width spaces and BOM", () => {
    const r = trimText("hello\u200Bworld\uFEFF", { stripZeroWidthChars: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("helloworld");
  });
});

describe("trimText — strip BOM", () => {
  it("strips leading BOM only", () => {
    const r = trimText("\uFEFFhello", { stripBom: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("hello");
  });
});

describe("trimText — empty input", () => {
  it("returns empty output", () => {
    const r = trimText("", { trimBoth: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("");
    expect(r.inputLength).toBe(0);
  });
});

describe("trimText — diff stats", () => {
  it("computes charsRemoved", () => {
    const r = trimText("  hello  ", { trimBoth: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.charsRemoved).toBe(4);
    expect(r.inputLength).toBe(9);
    expect(r.outputLength).toBe(5);
  });
});

describe("trimBatch", () => {
  it("trims multiple inputs", () => {
    const r = trimBatch(["  a  ", "  b  "], { trimBoth: true });
    expect(r.length).toBe(2);
    expect(r[0]!.output).toBe("a");
    expect(r[1]!.output).toBe("b");
  });
});

describe("diffStatsToCsv", () => {
  it("generates CSV", () => {
    const r = trimBatch(["  a  "], { trimBoth: true });
    const csv = diffStatsToCsv(r, ["  a  "]);
    expect(csv.split("\n")[0]).toBe("Input,Output,InputLength,OutputLength,CharsRemoved");
    expect(csv).toContain("a");
  });
});
