import { describe, it, expect } from "vitest";
import {
  stripHtml,
  stripMarkdown,
  stripWhitespace,
  stripPunctuation,
  stripNumbers,
  stripNonAscii,
  collapseExtraSpaces,
  stripLineBreaks,
  stripText,
  availableModes,
} from "./logic";

describe("stripHtml", () => {
  it("strips simple tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });
  it("strips nested tags", () => {
    expect(stripHtml("<div><b>Hi</b> there</div>")).toBe("Hi there");
  });
  it("decodes entities", () => {
    expect(stripHtml("&lt;a&gt; &amp; &quot;b&quot;")).toBe('<a> & "b"');
  });
  it("strips comments", () => {
    expect(stripHtml("<!-- comment -->text")).toBe("text");
  });
});

describe("stripMarkdown", () => {
  it("strips headers", () => {
    expect(stripMarkdown("# Hello")).toBe("Hello");
  });
  it("strips bold and italic", () => {
    expect(stripMarkdown("**bold** and *italic*")).toBe("bold and italic");
  });
  it("strips links keeping text", () => {
    expect(stripMarkdown("[click](http://x)")).toBe("click");
  });
  it("strips images", () => {
    expect(stripMarkdown("![alt](http://x.png)")).toBe("");
  });
  it("strips list markers", () => {
    expect(stripMarkdown("- item\n- item2")).toBe("item\nitem2");
  });
});

describe("stripWhitespace", () => {
  it("removes all whitespace", () => {
    expect(stripWhitespace("a b\nc\td", false)).toBe("abcd");
  });
  it("collapses to single spaces when collapseSpaces=true", () => {
    expect(stripWhitespace("a   b\n\nc", true)).toBe("a b c");
  });
});

describe("stripPunctuation", () => {
  it("removes punctuation but keeps words", () => {
    expect(stripPunctuation("Hello, world! How's it?")).toBe("Hello world How's it");
  });
  it("keeps apostrophes inside words", () => {
    expect(stripPunctuation("don't stop")).toBe("don't stop");
  });
});

describe("stripNumbers", () => {
  it("removes digits", () => {
    expect(stripNumbers("abc123def456")).toBe("abcdef");
  });
});

describe("stripNonAscii", () => {
  it("removes non-ASCII", () => {
    expect(stripNonAscii("café résumé")).toBe("caf rsum");
  });
  it("keeps ASCII untouched", () => {
    expect(stripNonAscii("Hello World 123!")).toBe("Hello World 123!");
  });
});

describe("collapseExtraSpaces", () => {
  it("collapses multiple spaces", () => {
    expect(collapseExtraSpaces("a    b     c")).toBe("a b c");
  });
  it("collapses multiple line breaks", () => {
    expect(collapseExtraSpaces("a\n\n\n\nb")).toBe("a\n\nb");
  });
  it("trims leading/trailing", () => {
    expect(collapseExtraSpaces("   hello   ")).toBe("hello");
  });
});

describe("stripLineBreaks", () => {
  it("replaces line breaks with spaces", () => {
    expect(stripLineBreaks("line1\nline2\nline3")).toBe("line1 line2 line3");
  });
  it("collapses extra whitespace", () => {
    expect(stripLineBreaks("a   b\n\nc")).toBe("a b c");
  });
});

describe("stripText", () => {
  it("dispatches to correct mode", () => {
    expect(stripText("<b>x</b>", { mode: "html", collapseSpaces: false })).toBe("x");
  });
  it("availableModes lists all 8 modes", () => {
    expect(availableModes().length).toBe(8);
  });
});
