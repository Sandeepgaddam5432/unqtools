import { describe, it, expect, beforeEach } from "vitest";
import {
  computeStats, formatLineNumber, getSeparator, transformText,
  joinFiles, previewLines, formatBytes, detectTextType,
  loadHistory, saveToHistory, clearHistory, DEFAULT_OPTIONS,
  type JoinOptions,
} from "./logic";

const baseOptions: JoinOptions = { ...DEFAULT_OPTIONS, separator: "newline", addFilenameHeaders: false, customSeparator: "" };

describe("text-joiner computeStats", () => {
  it("counts lines, words, characters", () => {
    const stats = computeStats("test.txt", 100, "hello world\nfoo bar baz");
    expect(stats.lines).toBe(2);
    expect(stats.words).toBe(5);
    expect(stats.characters).toBe(23);
  });
  it("handles empty content", () => {
    const stats = computeStats("empty.txt", 0, "");
    expect(stats.lines).toBe(0);
    expect(stats.words).toBe(0);
  });
  it("counts characters without spaces", () => {
    const stats = computeStats("t.txt", 0, "a b c");
    expect(stats.charactersNoSpaces).toBe(3);
  });
});

describe("text-joiner formatLineNumber", () => {
  it("default format", () => {
    expect(formatLineNumber(5, "%d")).toBe("5");
  });
  it("zero-padded 3", () => {
    expect(formatLineNumber(5, "%03d")).toBe("005");
  });
  it("zero-padded 5", () => {
    expect(formatLineNumber(42, "%05d")).toBe("00042");
  });
});

describe("text-joiner getSeparator", () => {
  it("newline", () => {
    expect(getSeparator({ ...baseOptions, separator: "newline" })).toBe("\n");
  });
  it("double", () => {
    expect(getSeparator({ ...baseOptions, separator: "double" })).toBe("\n\n");
  });
  it("custom", () => {
    expect(getSeparator({ ...baseOptions, separator: "custom", customSeparator: "---" })).toBe("---");
  });
});

describe("text-joiner transformText", () => {
  it("trims whitespace", () => {
    const out = transformText("  hello  \n  world  ", { ...baseOptions, trimWhitespace: true });
    expect(out).toBe("hello\nworld");
  });
  it("removes empty lines", () => {
    const out = transformText("a\n\nb\n", { ...baseOptions, removeEmptyLines: true });
    expect(out).toBe("a\nb");
  });
  it("dedups lines", () => {
    const out = transformText("a\nb\na", { ...baseOptions, dedupLines: true });
    expect(out).toBe("a\nb");
  });
  it("sorts ascending", () => {
    const out = transformText("banana\napple\ncherry", { ...baseOptions, sortLines: true, sortDirection: "asc" });
    expect(out).toBe("apple\nbanana\ncherry");
  });
  it("sorts descending", () => {
    const out = transformText("apple\nbanana\ncherry", { ...baseOptions, sortLines: true, sortDirection: "desc" });
    expect(out).toBe("cherry\nbanana\napple");
  });
  it("adds line numbers", () => {
    const out = transformText("a\nb", { ...baseOptions, addLineNumbers: true, numberFormat: "%03d" });
    expect(out).toBe("001\ta\n002\tb");
  });
  it("combines transforms", () => {
    const out = transformText("b\n a \na\nb", { ...baseOptions, trimWhitespace: true, dedupLines: true, sortLines: true, sortDirection: "asc" });
    expect(out).toBe("a\nb");
  });
});

describe("text-joiner joinFiles", () => {
  it("joins two files with newline separator", () => {
    const result = joinFiles(
      [{ name: "a.txt", content: "hello" }, { name: "b.txt", content: "world" }],
      { ...baseOptions, separator: "newline" },
    );
    expect(result.text).toBe("hello\nworld");
    expect(result.fileCount).toBe(2);
  });
  it("joins with double newline", () => {
    const result = joinFiles(
      [{ name: "a.txt", content: "hello" }, { name: "b.txt", content: "world" }],
      { ...baseOptions, separator: "double" },
    );
    expect(result.text).toBe("hello\n\nworld");
  });
  it("adds filename headers", () => {
    const result = joinFiles(
      [{ name: "a.txt", content: "hello" }],
      { ...baseOptions, addFilenameHeaders: true, headerSuffix: "\n" },
    );
    expect(result.text).toBe("a.txt\nhello");
  });
  it("adds custom separator", () => {
    const result = joinFiles(
      [{ name: "a.txt", content: "hello" }, { name: "b.txt", content: "world" }],
      { ...baseOptions, separator: "custom", customSeparator: "\n===\n" },
    );
    expect(result.text).toBe("hello\n===\nworld");
  });
  it("normalizes CRLF", () => {
    const result = joinFiles([{ name: "a.txt", content: "a\r\nb" }], baseOptions);
    expect(result.text).toBe("a\nb");
  });
  it("counts total stats", () => {
    const result = joinFiles(
      [{ name: "a.txt", content: "hello world" }, { name: "b.txt", content: "foo" }],
      baseOptions,
    );
    expect(result.totalWords).toBe(3);
    expect(result.fileCount).toBe(2);
  });
});

describe("text-joiner previewLines", () => {
  it("returns full text if under limit", () => {
    const text = "a\nb\nc";
    expect(previewLines(text, 10)).toBe(text);
  });
  it("truncates long text", () => {
    const text = Array.from({ length: 250 }, (_, i) => `line${i}`).join("\n");
    const preview = previewLines(text, 200);
    expect(preview).toContain("more lines truncated");
    expect(preview.split("\n").length).toBeLessThan(252);
  });
});

describe("text-joiner formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("text-joiner detectTextType", () => {
  it("detects txt", () => { expect(detectTextType("readme.txt")).toBe("Plain Text"); });
  it("detects log", () => { expect(detectTextType("app.log")).toBe("Log File"); });
  it("detects md", () => { expect(detectTextType("README.md")).toBe("Markdown"); });
  it("detects json", () => { expect(detectTextType("data.json")).toBe("JSON Data"); });
  it("defaults to text file", () => { expect(detectTextType("unknown.xyz")).toBe("Text File"); });
});

describe("text-joiner history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileNames: ["a.txt", "b.txt"], separator: "newline", addHeaders: false, lineNumbers: false, mergedAt: "2026-01-01", totalCharacters: 100 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileNames: ["a.txt"], separator: "newline", addHeaders: false, lineNumbers: false, mergedAt: "2026-01-01", totalCharacters: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("text-joiner DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.separator).toBe("double");
    expect(DEFAULT_OPTIONS.addFilenameHeaders).toBe(true);
    expect(DEFAULT_OPTIONS.addLineNumbers).toBe(false);
  });
});
