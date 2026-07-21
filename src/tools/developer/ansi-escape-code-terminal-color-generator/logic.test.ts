import { describe, it, expect, beforeEach } from "vitest";
import {
  ESCAPE_PREFIXES,
  STYLE_DEFS,
  STANDARD_16_COLORS,
  TERMINAL_SUPPORT_NOTES,
  DEFAULT_CONFIG,
  PRESETS,
  hexToRgb,
  rgbToHex,
  x256ToRgb,
  nearestX256,
  hexToX256,
  hexToTruecolor,
  x256Grid,
  colorToSgrParams,
  generateSgrParams,
  renderSgr,
  renderReset,
  generateEscape,
  generateSequence,
  generateLanguageSnippets,
  decodeAnsi,
  describeSgrParams,
  stripAnsi,
  buildPreviewSegments,
  colorToCss,
  validateConfig,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AnsiConfig,
  type ColorSpec,
  type EscapeFormat,
  type SgrStyle,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("ansi constants", () => {
  it("has 5 escape formats", () => {
    expect(Object.keys(ESCAPE_PREFIXES)).toHaveLength(5);
    expect(ESCAPE_PREFIXES.x1b).toBe("\\x1b");
    expect(ESCAPE_PREFIXES.octal).toBe("\\033");
    expect(ESCAPE_PREFIXES.e).toBe("\\e");
    expect(ESCAPE_PREFIXES.u001b).toBe("\\u001b");
  });
  it("has 8 SGR styles", () => {
    expect(STYLE_DEFS).toHaveLength(8);
    expect(STYLE_DEFS.map((s) => s.id)).toContain("bold");
    expect(STYLE_DEFS.map((s) => s.id)).toContain("strikethrough");
  });
  it("has 16 standard colors", () => {
    expect(STANDARD_16_COLORS).toHaveLength(16);
    expect(STANDARD_16_COLORS[0].name).toBe("Black");
    expect(STANDARD_16_COLORS[1].name).toBe("Red");
    expect(STANDARD_16_COLORS[1].fg).toBe(31);
    expect(STANDARD_16_COLORS[8].bright).toBe(true);
  });
  it("has terminal support notes", () => {
    expect(TERMINAL_SUPPORT_NOTES.length).toBeGreaterThanOrEqual(5);
    expect(TERMINAL_SUPPORT_NOTES.some((n) => n.id === "truecolor")).toBe(true);
  });
  it("has presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(PRESETS[0].config).toBeDefined();
  });
  it("has default config", () => {
    expect(DEFAULT_CONFIG.text).toBeTruthy();
    expect(DEFAULT_CONFIG.styles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

describe("ansi hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("parses 3-digit hex", () => {
    expect(hexToRgb("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses without # prefix", () => {
    expect(hexToRgb("ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("returns null for bad input", () => {
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });
});

describe("ansi rgbToHex", () => {
  it("formats rgb to hex", () => {
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe("#ff8000");
  });
  it("clamps out-of-range values", () => {
    expect(rgbToHex({ r: -5, g: 300, b: 128 })).toBe("#00ff80");
  });
  it("pads single digits", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 1, g: 1, b: 1 })).toBe("#010101");
  });
});

describe("ansi x256ToRgb", () => {
  it("maps 0–15 to standard 16 colors", () => {
    expect(x256ToRgb(0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(x256ToRgb(1)).toEqual({ r: 170, g: 0, b: 0 });
  });
  it("maps 16 + 36r + 6g + b cube correctly", () => {
    // 16 + 36*5 + 6*5 + 5 = 16 + 180 + 30 + 5 = 231 (white corner)
    expect(x256ToRgb(231)).toEqual({ r: 255, g: 255, b: 255 });
    // 16 itself should be cube origin (black)
    expect(x256ToRgb(16)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("maps 232–255 grayscale ramp", () => {
    expect(x256ToRgb(232).r).toBe(8);
    expect(x256ToRgb(255).r).toBe(238);
    expect(x256ToRgb(244).r).toBe(128);
  });
  it("clamps to 0–255", () => {
    expect(x256ToRgb(-5)).toEqual({ r: 0, g: 0, b: 0 });
    expect(x256ToRgb(9999).r).toBe(238);
  });
});

describe("ansi nearestX256", () => {
  it("finds exact black", () => {
    // Index 0 (standard black) and 16 (cube black) both have distance 0;
    // implementation picks the first (index 0).
    expect(nearestX256({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("finds exact white", () => {
    // Index 15 (standard white) and 231 (cube white) both have distance 0;
    // implementation picks the first (index 15).
    expect(nearestX256({ r: 255, g: 255, b: 255 })).toBe(15);
  });
  it("snaps near-pure red to a red index", () => {
    // pure red {255, 0, 0} — nearest cube entry
    const idx = nearestX256({ r: 255, g: 0, b: 0 });
    const rgb = x256ToRgb(idx);
    // Should be in the ballpark of red
    expect(rgb.r).toBeGreaterThan(rgb.g);
    expect(rgb.r).toBeGreaterThan(rgb.b);
  });
});

describe("ansi hexToX256 and hexToTruecolor", () => {
  it("converts hex to nearest 256 index", () => {
    expect(hexToX256("#000000")).toBe(0);
    expect(hexToX256("#ffffff")).toBe(15);
  });
  it("returns 0 for bad hex", () => {
    expect(hexToX256("nope")).toBe(0);
  });
  it("converts hex to truecolor triplet string", () => {
    expect(hexToTruecolor("#ff8000")).toBe("255;128;0");
  });
  it("returns null for bad hex", () => {
    expect(hexToTruecolor("nope")).toBeNull();
  });
});

describe("ansi x256Grid", () => {
  it("has 256 entries", () => {
    const grid = x256Grid();
    expect(grid).toHaveLength(256);
    expect(grid[0].id).toBe(0);
    expect(grid[255].id).toBe(255);
  });
  it("each entry has hex color", () => {
    const grid = x256Grid();
    expect(grid[0].hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(grid[231].hex).toBe("#ffffff");
  });
});

// ---------------------------------------------------------------------------
// SGR parameter construction
// ---------------------------------------------------------------------------

describe("ansi colorToSgrParams", () => {
  it("returns empty for none", () => {
    expect(colorToSgrParams({ mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, false)).toEqual([]);
  });
  it("emits standard16 fg code", () => {
    const spec: ColorSpec = { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } };
    expect(colorToSgrParams(spec, false)).toEqual(["31"]);
  });
  it("emits standard16 bg code", () => {
    const spec: ColorSpec = { mode: "standard16", index: 2, rgb: { r: 0, g: 0, b: 0 } };
    expect(colorToSgrParams(spec, true)).toEqual(["42"]);
  });
  it("emits bright16 fg code", () => {
    const spec: ColorSpec = { mode: "bright16", index: 1, rgb: { r: 0, g: 0, b: 0 } };
    // index 1 → red+8 = bright red = 91
    expect(colorToSgrParams(spec, false)).toEqual(["91"]);
  });
  it("emits x256 fg as 38;5;N", () => {
    const spec: ColorSpec = { mode: "x256", index: 208, rgb: { r: 0, g: 0, b: 0 } };
    expect(colorToSgrParams(spec, false)).toEqual(["38", "5", "208"]);
  });
  it("emits x256 bg as 48;5;N", () => {
    const spec: ColorSpec = { mode: "x256", index: 21, rgb: { r: 0, g: 0, b: 0 } };
    expect(colorToSgrParams(spec, true)).toEqual(["48", "5", "21"]);
  });
  it("emits truecolor fg as 38;2;r;g;b", () => {
    const spec: ColorSpec = { mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } };
    expect(colorToSgrParams(spec, false)).toEqual(["38", "2", "255", "128", "0"]);
  });
  it("clamps truecolor RGB values", () => {
    const spec: ColorSpec = { mode: "truecolor", index: 0, rgb: { r: -5, g: 999, b: 50 } };
    expect(colorToSgrParams(spec, false)).toEqual(["38", "2", "0", "255", "50"]);
  });
});

describe("ansi generateSgrParams", () => {
  it("combines styles + fg + bg", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "X",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold", "underline"],
    };
    expect(generateSgrParams(config)).toEqual(["1", "4", "31", "40"]);
  });
  it("handles no styles", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      styles: [],
      fg: { mode: "standard16", index: 2, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
    };
    expect(generateSgrParams(config)).toEqual(["32"]);
  });
});

// ---------------------------------------------------------------------------
// Escape rendering
// ---------------------------------------------------------------------------

describe("ansi renderSgr and renderReset", () => {
  it("renders x1b format", () => {
    expect(renderSgr(["1", "31"], "x1b", false)).toBe("\\x1b[1;31m");
  });
  it("renders octal format", () => {
    expect(renderSgr(["1"], "octal", false)).toBe("\\033[1m");
  });
  it("renders visible-escape marker", () => {
    expect(renderSgr(["1"], "x1b", true)).toBe("^[[1m");
  });
  it("renders reset for each format", () => {
    expect(renderReset("x1b", false)).toBe("\\x1b[0m");
    expect(renderReset("octal", false)).toBe("\\033[0m");
    expect(renderReset("e", false)).toBe("\\e[0m");
    expect(renderReset("u001b", false)).toBe("\\u001b[0m");
  });
  it("renders empty params as 0", () => {
    expect(renderSgr([], "x1b", false)).toBe("\\x1b[0m");
  });
});

describe("ansi generateEscape", () => {
  it("generates x1b sequence with reset", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    };
    expect(generateEscape(config)).toBe("\\x1b[1;31mHi\\x1b[0m");
  });
  it("omits reset when appendReset is false", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "x1b",
      appendReset: false,
      wrapBash: false,
      showVisibleEsc: false,
    };
    expect(generateEscape(config)).toBe("\\x1b[31mHi");
  });
  it("wraps in bash \\[ \\] when enabled", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: true,
      showVisibleEsc: false,
    };
    expect(generateEscape(config)).toBe("\\[\\x1b[31m\\]Hi\\[\\x1b[0m\\]");
  });
  it("shows visible ^[ when enabled", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: true,
    };
    expect(generateEscape(config)).toBe("^[[31mHi^[[0m");
  });
  it("generateSequence alias matches generateEscape", () => {
    expect(generateSequence(DEFAULT_CONFIG)).toBe(generateEscape(DEFAULT_CONFIG));
  });
  it("emits 256-color escape", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "X",
      fg: { mode: "x256", index: 208, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "octal",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    };
    expect(generateEscape(config)).toBe("\\033[38;5;208mX\\033[0m");
  });
  it("emits truecolor escape", () => {
    const config: AnsiConfig = {
      ...DEFAULT_CONFIG,
      text: "X",
      fg: { mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    };
    expect(generateEscape(config)).toBe("\\x1b[38;2;255;128;0mX\\x1b[0m");
  });
});

// ---------------------------------------------------------------------------
// Language snippets
// ---------------------------------------------------------------------------

describe("ansi generateLanguageSnippets", () => {
  it("returns 7 language snippets", () => {
    const snippets = generateLanguageSnippets(DEFAULT_CONFIG);
    expect(snippets).toHaveLength(7);
    const ids = snippets.map((s) => s.id);
    expect(ids).toContain("bash-printf");
    expect(ids).toContain("python");
    expect(ids).toContain("nodejs");
    expect(ids).toContain("go");
    expect(ids).toContain("rust");
    expect(ids).toContain("c");
  });
  it("bash printf includes escape and text", () => {
    const snippets = generateLanguageSnippets({
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
    });
    const bash = snippets.find((s) => s.id === "bash-printf")!;
    expect(bash.code).toContain("printf");
    expect(bash.code).toContain("\\033[1;31m");
    expect(bash.code).toContain("Hi");
    expect(bash.code).toContain("\\033[0m");
  });
  it("python snippet uses \\033", () => {
    const snippets = generateLanguageSnippets({
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 2, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    });
    const py = snippets.find((s) => s.id === "python")!;
    expect(py.code).toContain("print(");
    expect(py.code).toContain("\\033[32m");
  });
  it("nodejs snippet uses \\x1b", () => {
    const snippets = generateLanguageSnippets({
      ...DEFAULT_CONFIG,
      text: "Hi",
      fg: { mode: "standard16", index: 3, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    });
    const node = snippets.find((s) => s.id === "nodejs")!;
    expect(node.code).toContain("process.stdout.write");
    expect(node.code).toContain("\\x1b[33m");
  });
});

// ---------------------------------------------------------------------------
// Reverse decoder
// ---------------------------------------------------------------------------

describe("ansi decodeAnsi", () => {
  it("decodes a literal \\x1b sequence", () => {
    const r = decodeAnsi("\\x1b[1;31mHello\\x1b[0m");
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.strippedText).toBe("Hello");
    expect(r.segments.length).toBeGreaterThan(0);
    expect(r.segments.some((s) => s.description.includes("Bold"))).toBe(true);
    expect(r.segments.some((s) => s.description.includes("Foreground") && s.description.includes("Red"))).toBe(true);
  });
  it("decodes a real ESC sequence", () => {
    const r = decodeAnsi("\x1b[38;5;208mX\x1b[0m");
    expect(r.ok).toBe(true);
    expect(r.strippedText).toBe("X");
    expect(r.segments.some((s) => s.description.includes("256-color index 208"))).toBe(true);
  });
  it("decodes truecolor sequences", () => {
    const r = decodeAnsi("\x1b[38;2;255;128;0mX\x1b[0m");
    expect(r.ok).toBe(true);
    expect(r.segments.some((s) => s.description.includes("truecolor RGB(255, 128, 0)"))).toBe(true);
  });
  it("decodes a visible ^[ sequence", () => {
    const r = decodeAnsi("^[[1mHi^[[0m");
    expect(r.ok).toBe(true);
    expect(r.strippedText).toBe("Hi");
    expect(r.segments.some((s) => s.description.includes("Bold"))).toBe(true);
  });
  it("handles empty input", () => {
    const r = decodeAnsi("");
    expect(r.segments).toEqual([]);
    expect(r.strippedText).toBe("");
  });
  it("detects malformed lone ESC", () => {
    const r = decodeAnsi("plain \x1b text");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("records non-SGR CSI sequences", () => {
    const r = decodeAnsi("\x1b[2Jclear");
    expect(r.segments.some((s) => s.description.includes("Non-SGR CSI"))).toBe(true);
    expect(r.strippedText).toBe("clear");
  });
});

describe("ansi describeSgrParams", () => {
  it("describes reset", () => {
    expect(describeSgrParams(["0"])).toContain("Reset all attributes.");
  });
  it("describes bright bg code 104", () => {
    const out = describeSgrParams(["104"]);
    expect(out.some((d) => d.includes("Background") && d.includes("Bright Blue"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stripAnsi
// ---------------------------------------------------------------------------

describe("ansi stripAnsi", () => {
  it("removes raw CSI sequences", () => {
    expect(stripAnsi("\x1b[1;31mHello\x1b[0m")).toBe("Hello");
  });
  it("removes OSC sequences", () => {
    expect(stripAnsi("\x1b]0;title\x07text")).toBe("text");
  });
  it("handles empty input", () => {
    expect(stripAnsi("")).toBe("");
  });
  it("leaves plain text alone", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });
});

// ---------------------------------------------------------------------------
// Preview & validation
// ---------------------------------------------------------------------------

describe("ansi buildPreviewSegments and colorToCss", () => {
  it("builds preview segment from config", () => {
    const segs = buildPreviewSegments(DEFAULT_CONFIG);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe(DEFAULT_CONFIG.text);
  });
  it("colorToCss returns null for none", () => {
    expect(colorToCss({ mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } })).toBeNull();
  });
  it("colorToCss returns hex for standard16", () => {
    expect(colorToCss({ mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } })).toBe("#aa0000");
  });
  it("colorToCss returns hex for x256", () => {
    expect(colorToCss({ mode: "x256", index: 231, rgb: { r: 0, g: 0, b: 0 } })).toBe("#ffffff");
  });
  it("colorToCss returns hex for truecolor", () => {
    expect(colorToCss({ mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } })).toBe("#ff8000");
  });
});

describe("ansi validateConfig", () => {
  it("errors on out-of-range RGB", () => {
    const r = validateConfig({
      ...DEFAULT_CONFIG,
      fg: { mode: "truecolor", index: 0, rgb: { r: 999, g: 0, b: 0 } },
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("warns on blink", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, styles: ["blink"] });
    expect(r.warnings.some((w) => w.includes("Blink"))).toBe(true);
  });
  it("warns when reset is not appended", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, appendReset: false });
    expect(r.warnings.some((w) => w.includes("Reset not appended"))).toBe(true);
  });
});

describe("ansi computeStats", () => {
  it("computes style + color counts", () => {
    const stats = computeStats({
      ...DEFAULT_CONFIG,
      fg: { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold", "underline"],
    });
    expect(stats.styleCount).toBe(2);
    expect(stats.hasFg).toBe(true);
    expect(stats.hasBg).toBe(true);
    expect(stats.totalSgrParams).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("ansi history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, text: "Hi",
      fgMode: "standard16", bgMode: "none",
      styleCount: 1, escapeFormat: "x1b",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, text: `t${i}`,
        fgMode: "standard16", bgMode: "none",
        styleCount: 0, escapeFormat: "x1b",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, text: "x",
      fgMode: "standard16", bgMode: "none",
      styleCount: 0, escapeFormat: "x1b",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("ansi shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const config: AnsiConfig = {
      text: "Hello",
      fg: { mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } },
      bg: { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold", "italic"],
      escapeFormat: "octal",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: true,
    };
    const url = buildShareUrl(config);
    expect(url).toContain("t=Hello");
    expect(url).toContain("fgm=truecolor");
    expect(url).toContain("fgrgb=255%2C128%2C0");
    expect(url).toContain("bgm=standard16");
    expect(url).toContain("bgi=0");
    expect(url).toContain("s=bold%2Citalic");
    expect(url).toContain("fmt=octal");
    expect(url).toContain("vis=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const config = parseShareUrl("t=Hi&fgm=standard16&fgi=1&bgm=none&s=bold&fmt=x1b&reset=1&wrap=0&vis=0");
    expect(config).not.toBeNull();
    expect(config!.text).toBe("Hi");
    expect(config!.fg.mode).toBe("standard16");
    expect(config!.fg.index).toBe(1);
    expect(config!.bg.mode).toBe("none");
    expect(config!.styles).toEqual(["bold"]);
    expect(config!.escapeFormat).toBe("x1b");
    expect(config!.appendReset).toBe(true);
  });
  it("parses truecolor rgb", () => {
    const config = parseShareUrl("t=X&fgm=truecolor&fgrgb=255%2C128%2C0&bgm=none&fmt=x1b&reset=1&wrap=0&vis=0");
    expect(config!.fg.mode).toBe("truecolor");
    expect(config!.fg.rgb).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters unknown styles", () => {
    const config = parseShareUrl("s=bold,not-a-style");
    expect(config!.styles).toEqual(["bold"]);
  });
});

// Suppress unused-import lint
export type _Unused = EscapeFormat | SgrStyle;
