import { describe, it, expect } from "vitest";
import { addPrefixSuffix, DEFAULT_OPTIONS, type PrefixSuffixOptions } from "./logic";

function opts(overrides: Partial<PrefixSuffixOptions>): PrefixSuffixOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

describe("addPrefixSuffix — basic", () => {
  it("adds prefix only", () => {
    const result = addPrefixSuffix("a\nb\nc", opts({ prefix: "> ", suffix: "" }));
    expect(result).toBe("> a\n> b\n> c");
  });

  it("adds suffix only", () => {
    const result = addPrefixSuffix("a\nb\nc", opts({ prefix: "", suffix: "," }));
    expect(result).toBe("a,\nb,\nc,");
  });

  it("adds both prefix and suffix", () => {
    const result = addPrefixSuffix("a\nb\nc", opts({ prefix: '"', suffix: '"' }));
    expect(result).toBe('"a"\n"b"\n"c"');
  });
});

describe("addPrefixSuffix — skip empty", () => {
  it("skips empty lines by default", () => {
    const result = addPrefixSuffix("a\n\nb", opts({ prefix: "> ", suffix: "", skipEmpty: true }));
    expect(result).toBe("> a\n\n> b");
  });

  it("wraps empty lines when skipEmpty is false", () => {
    const result = addPrefixSuffix("a\n\nb", opts({ prefix: "> ", suffix: "", skipEmpty: false }));
    expect(result).toBe("> a\n> \n> b");
  });
});

describe("addPrefixSuffix — counter token", () => {
  it("interpolates {n} with incrementing counter", () => {
    const result = addPrefixSuffix(
      "a\nb\nc",
      opts({
        prefix: "{n}. ",
        suffix: "",
        counterStart: 1,
        counterStep: 1,
      }),
    );
    expect(result).toBe("1. a\n2. b\n3. c");
  });

  it("respects counter start and step", () => {
    const result = addPrefixSuffix(
      "a\nb\nc",
      opts({
        prefix: "{n}. ",
        suffix: "",
        counterStart: 10,
        counterStep: 5,
      }),
    );
    expect(result).toBe("10. a\n15. b\n20. c");
  });

  it("pads counter to specified width", () => {
    const result = addPrefixSuffix(
      "a\nb",
      opts({
        prefix: "{n}. ",
        suffix: "",
        counterStart: 1,
        counterStep: 1,
        counterPadding: 3,
      }),
    );
    expect(result).toBe("001. a\n002. b");
  });

  it("interpolates {n} in suffix too", () => {
    const result = addPrefixSuffix(
      "a\nb",
      opts({
        prefix: "",
        suffix: " ({n})",
        counterStart: 1,
      }),
    );
    expect(result).toBe("a (1)\nb (2)");
  });
});

describe("addPrefixSuffix — trim", () => {
  it("trims each line before wrapping", () => {
    const result = addPrefixSuffix(
      "  a  \n  b  ",
      opts({
        prefix: '"',
        suffix: '"',
        trimLines: true,
      }),
    );
    expect(result).toBe('"a"\n"b"');
  });
});

describe("addPrefixSuffix — regex conditional", () => {
  it("only wraps lines matching the regex", () => {
    const result = addPrefixSuffix(
      "apple\nbanana\ncherry",
      opts({
        prefix: "> ",
        suffix: "",
        matchRegex: "^[ac]",
      }),
    );
    expect(result).toBe("> apple\nbanana\n> cherry");
  });
});

describe("addPrefixSuffix — escape modes", () => {
  it("escapes for HTML", () => {
    const result = addPrefixSuffix(
      "<script>",
      opts({
        prefix: "",
        suffix: "",
        escape: "html",
      }),
    );
    expect(result).toBe("&lt;script&gt;");
  });

  it("escapes for JSON", () => {
    const result = addPrefixSuffix(
      'hello "world"',
      opts({
        prefix: "",
        suffix: "",
        escape: "json",
      }),
    );
    expect(result).toBe('hello \\"world\\"');
  });

  it("escapes for SQL (doubles single quotes)", () => {
    const result = addPrefixSuffix(
      "O'Brien",
      opts({
        prefix: "'",
        suffix: "'",
        escape: "sql",
      }),
    );
    expect(result).toBe("'O''Brien'");
  });
});

describe("addPrefixSuffix — reverse mode", () => {
  it("strips prefix and suffix", () => {
    const result = addPrefixSuffix(
      '"a"\n"b"\n"c"',
      opts({
        prefix: '"',
        suffix: '"',
        reverse: true,
      }),
    );
    expect(result).toBe("a\nb\nc");
  });

  it("only strips if affixes present", () => {
    const result = addPrefixSuffix(
      '"a"\nb\n"c"',
      opts({
        prefix: '"',
        suffix: '"',
        reverse: true,
      }),
    );
    expect(result).toBe("a\nb\nc");
  });
});

describe("addPrefixSuffix — edge cases", () => {
  it("handles empty input", () => {
    expect(addPrefixSuffix("", opts({ prefix: ">", suffix: "<" }))).toBe("");
  });

  it("handles CRLF input", () => {
    const result = addPrefixSuffix("a\r\nb", opts({ prefix: ">", suffix: "" }));
    expect(result).toBe(">a\n>b");
  });

  it("handles Unicode/emoji", () => {
    const result = addPrefixSuffix("🎉\n🌟", opts({ prefix: "[", suffix: "]" }));
    expect(result).toBe("[🎉]\n[🌟]");
  });

  it("handles huge input (1 MB)", () => {
    const input = "line\n".repeat(200000);
    const result = addPrefixSuffix(input, opts({ prefix: ">", suffix: "" }));
    expect(result.length).toBeGreaterThan(900000);
  });

  it("handles trailing newline", () => {
    const result = addPrefixSuffix("a\nb\n", opts({ prefix: ">", suffix: "", skipEmpty: true }));
    expect(result).toBe(">a\n>b\n");
  });
});
