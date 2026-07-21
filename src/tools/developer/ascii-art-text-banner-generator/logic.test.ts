import { describe, it, expect, beforeEach } from "vitest";
import {
  FONTS,
  FONT_BY_ID,
  HISTORY_MAX,
  CHARSET_LABELS,
  CHARSET_OVERLAYS,
  PRESET_PHRASES,
  getFont,
  lookupGlyph,
  applyCharSet,
  transformLines,
  renderLine,
  wrapText,
  renderText,
  wrapAsMarkdown,
  wrapAsHtml,
  wrapAsComment,
  buildHtmlDocument,
  renderedWidth,
  renderedHeight,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AsciiFont,
  type CharSet,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("ascii-art fonts", () => {
  it("has at least 10 fonts", () => {
    expect(FONTS.length).toBeGreaterThanOrEqual(10);
  });
  it("each font has required metadata", () => {
    for (const f of FONTS) {
      expect(typeof f.id).toBe("string");
      expect(f.id.length).toBeGreaterThan(0);
      expect(typeof f.name).toBe("string");
      expect(typeof f.height).toBe("number");
      expect(f.height).toBeGreaterThan(0);
      expect(typeof f.width).toBe("number");
      expect(f.width).toBeGreaterThan(0);
      expect(typeof f.description).toBe("string");
    }
  });
  it("font ids are unique", () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each font has A-Z, 0-9, and space glyphs", () => {
    for (const f of FONTS) {
      for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ ") {
        expect(f.glyphs[ch]).toBeTruthy();
        expect(f.glyphs[ch].length).toBe(f.height);
      }
      for (const ch of "0123456789") {
        expect(f.glyphs[ch]).toBeTruthy();
        expect(f.glyphs[ch].length).toBe(f.height);
      }
    }
  });
  it("each glyph row has the font's width", () => {
    for (const f of FONTS) {
      for (const [ch, rows] of Object.entries(f.glyphs)) {
        for (const row of rows) {
          expect(row.length).toBe(f.width);
        }
      }
    }
  });
  it("FONT_BY_ID maps ids to fonts", () => {
    for (const f of FONTS) {
      expect(FONT_BY_ID[f.id]).toBe(f);
    }
  });
  it("getFont returns null for unknown id", () => {
    expect(getFont("nonexistent")).toBeNull();
  });
  it("exposes 6 character sets", () => {
    expect(Object.keys(CHARSET_LABELS)).toHaveLength(6);
    expect(Object.keys(CHARSET_OVERLAYS)).toHaveLength(5);
  });
  it("exposes preset phrases", () => {
    expect(PRESET_PHRASES.length).toBeGreaterThanOrEqual(5);
  });
  it("exposes history max of 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("ascii-art lookupGlyph", () => {
  const block = FONTS.find((f) => f.id === "block")!;
  it("looks up existing glyph", () => {
    const g = lookupGlyph(block, "A");
    expect(g.length).toBe(block.height);
    expect(g[0]).toContain("#");
  });
  it("case-insensitive — returns uppercase glyph for lowercase", () => {
    const upper = lookupGlyph(block, "A");
    const lower = lookupGlyph(block, "a");
    expect(lower).toEqual(upper);
  });
  it("falls back to space for unsupported char", () => {
    const g = lookupGlyph(block, "@");
    const space = lookupGlyph(block, " ");
    expect(g).toEqual(space);
  });
});

describe("ascii-art applyCharSet", () => {
  it("raw returns input unchanged", () => {
    const lines = ["###", " . "];
    expect(applyCharSet(lines, "raw")).toEqual(lines);
  });
  it("hash replaces non-space with #", () => {
    expect(applyCharSet(["A.B", " C "], "hash")).toEqual(["###", " # "]);
  });
  it("block replaces non-space with █", () => {
    expect(applyCharSet(["A.B", " C "], "block")).toEqual(["███", " █ "]);
  });
  it("dot replaces non-space with ·", () => {
    expect(applyCharSet(["A B"], "dot")).toEqual(["· ·"]);
  });
});

describe("ascii-art transformLines", () => {
  it("flipH mirrors each row", () => {
    expect(transformLines(["abc", "def"], { flipH: true })).toEqual(["cba", "fed"]);
  });
  it("flipV reverses row order", () => {
    expect(transformLines(["abc", "def"], { flipV: true })).toEqual(["def", "abc"]);
  });
  it("flipH + flipV composes", () => {
    expect(transformLines(["ab", "cd"], { flipH: true, flipV: true })).toEqual(["dc", "ba"]);
  });
  it("no flags returns input", () => {
    expect(transformLines(["abc"], {})).toEqual(["abc"]);
  });
});

describe("ascii-art renderLine", () => {
  const block = FONTS.find((f) => f.id === "block")!;
  it("renders a single char", () => {
    const rows = renderLine("A", block);
    expect(rows.length).toBe(block.height);
    expect(rows[0]).toContain("###");
  });
  it("renders multiple chars with separator", () => {
    const rows = renderLine("AB", block);
    expect(rows.length).toBe(block.height);
    // Each glyph is 5 chars wide, plus 1-space separator = 11 chars
    expect(rows[0].length).toBe(5 + 1 + 5);
  });
  it("preserves letter spacing option", () => {
    const rows = renderLine("AB", block, { letterSpacing: 3 });
    expect(rows[0].length).toBe(5 + 3 + 5);
  });
  it("applies flipH", () => {
    const normal = renderLine("A", block);
    const flipped = renderLine("A", block, { flipH: true });
    expect(flipped[0]).toBe(normal[0].split("").reverse().join(""));
  });
  it("empty text returns blank rows", () => {
    const rows = renderLine("", block);
    expect(rows.length).toBe(block.height);
    expect(rows.every((r) => r.trim() === "")).toBe(true);
  });
});

describe("ascii-art wrapText", () => {
  const block = FONTS.find((f) => f.id === "block")!;
  it("wraps to a single line when text fits", () => {
    const lines = wrapText("HELLO", block, 200, 1);
    expect(lines).toEqual(["HELLO"]);
  });
  it("wraps to multiple lines when text exceeds width", () => {
    const lines = wrapText("HELLO WORLD FOO BAR", block, 30, 1);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("handles a single very long word", () => {
    const longWord = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lines = wrapText(longWord, block, 50, 1);
    expect(lines).toContain(longWord);
  });
  it("returns empty for empty input", () => {
    expect(wrapText("", block, 80, 1)).toEqual([]);
  });
  it("returns empty for whitespace-only input", () => {
    expect(wrapText("   \n  \t ", block, 80, 1)).toEqual([]);
  });
});

describe("ascii-art renderText", () => {
  const block = FONTS.find((f) => f.id === "block")!;
  it("renders a single word", () => {
    const art = renderText("HELLO", block);
    expect(art.length).toBeGreaterThan(0);
    expect(art).toContain("#");
    const lines = art.split("\n");
    expect(lines.length).toBe(block.height);
  });
  it("renders multiple words with a blank line between", () => {
    const art = renderText("FOO BAR", block, { maxWidth: 30 });
    const lines = art.split("\n");
    // 5 rows for FOO + 1 blank + 5 rows for BAR = 11
    expect(lines.length).toBe(block.height * 2 + 1);
  });
  it("applies charSet overlay", () => {
    const art = renderText("A", block, { charSet: "hash" });
    // Should only contain # and spaces
    expect(art).toMatch(/^[#\s]+$/);
  });
  it("applies flipH", () => {
    // Use 'L' which is asymmetric (bottom-heavy left)
    const normal = renderText("L", block);
    const flipped = renderText("L", block, { flipH: true });
    expect(flipped).not.toBe(normal);
    // Flipped 'L' should look like a mirrored shape
    const normalLines = normal.split("\n");
    const flippedLines = flipped.split("\n");
    expect(flippedLines.length).toBe(normalLines.length);
    for (let i = 0; i < normalLines.length; i++) {
      expect(flippedLines[i]).toBe(normalLines[i].split("").reverse().join(""));
    }
  });
  it("empty text returns empty string", () => {
    expect(renderText("", block)).toBe("");
  });
  it("renders the same regardless of input case (lookup is case-insensitive)", () => {
    const lower = renderText("hello", block);
    const upper = renderText("HELLO", block);
    expect(lower).toBe(upper);
  });
  it("supports all 12 fonts without throwing", () => {
    for (const f of FONTS) {
      expect(() => renderText("HELLO WORLD", f, { maxWidth: 80 })).not.toThrow();
    }
  });
});

describe("ascii-art wrappers", () => {
  const art = "###\n# #\n###";
  it("wrapAsMarkdown wraps in fenced code block", () => {
    expect(wrapAsMarkdown(art)).toBe("```\n###\n# #\n###\n```");
  });
  it("wrapAsMarkdown supports language", () => {
    expect(wrapAsMarkdown(art, "text")).toBe("```text\n###\n# #\n###\n```");
  });
  it("wrapAsHtml wraps in <pre>", () => {
    const html = wrapAsHtml(art);
    expect(html).toContain("<pre");
    expect(html).toContain("###");
    expect(html).toContain("</pre>");
  });
  it("wrapAsHtml escapes HTML", () => {
    const html = wrapAsHtml("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
  it("wrapAsComment c-style", () => {
    const c = wrapAsComment("hi", "c");
    expect(c).toContain("/**");
    expect(c).toContain(" * hi");
    expect(c).toContain(" */");
  });
  it("wrapAsComment shell-style", () => {
    const sh = wrapAsComment("hi", "shell");
    expect(sh).toBe("# hi");
  });
  it("wrapAsComment hash-style", () => {
    const h = wrapAsComment("hi", "hash");
    expect(h).toBe("// hi");
  });
  it("buildHtmlDocument produces valid HTML", () => {
    const doc = buildHtmlDocument(art, "Test");
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<title>Test</title>");
    expect(doc).toContain("<pre>");
  });
});

describe("ascii-art dimensions", () => {
  it("renderedWidth returns widest line", () => {
    expect(renderedWidth("###\n#")).toBe(3);
    expect(renderedWidth("#\n##\n###")).toBe(3);
  });
  it("renderedHeight returns line count", () => {
    expect(renderedHeight("###\n# #\n###")).toBe(3);
    expect(renderedHeight("")).toBe(1);
  });
});

describe("ascii-art history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, text: "HELLO", fontId: "block", charSet: "raw", width: 80 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe("HELLO");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, text: `T${i}`, fontId: "block", charSet: "raw", width: 80 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, text: "X", fontId: "block", charSet: "raw", width: 80 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ascii-art shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("HELLO", "block", "hash", 100, true, false);
    expect(url).toContain("text=HELLO");
    expect(url).toContain("font=block");
    expect(url).toContain("cs=hash");
    expect(url).toContain("w=100");
    expect(url).toContain("fh=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits default values", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("HELLO", "block", "raw", 80, false, false);
    expect(url).not.toContain("cs=");
    expect(url).not.toContain("w=");
    expect(url).not.toContain("fh=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const state = parseShareUrl("text=HELLO&font=block&cs=hash&w=100&fh=1&fv=1");
    expect(state.text).toBe("HELLO");
    expect(state.fontId).toBe("block");
    expect(state.charSet).toBe("hash");
    expect(state.width).toBe(100);
    expect(state.flipH).toBe(true);
    expect(state.flipV).toBe(true);
  });
  it("returns defaults for empty hash", () => {
    const state = parseShareUrl("");
    expect(state.text).toBe("");
    expect(state.fontId).toBe("block");
    expect(state.charSet).toBe("raw");
    expect(state.width).toBe(80);
    expect(state.flipH).toBe(false);
    expect(state.flipV).toBe(false);
  });
  it("filters invalid char sets", () => {
    const state = parseShareUrl("text=HI&cs=invalid");
    expect(state.charSet).toBe("raw");
  });
  it("clamps width to valid range", () => {
    const state1 = parseShareUrl("w=5");
    expect(state1.width).toBe(20);
    const state2 = parseShareUrl("w=99999");
    expect(state2.width).toBe(500);
  });
});

// Suppress unused-import lint
export type _Unused = AsciiFont | CharSet;
