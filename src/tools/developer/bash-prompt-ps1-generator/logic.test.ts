import { describe, it, expect, beforeEach } from "vitest";
import {
  ESC,
  STANDARD_16_COLORS,
  SGR_STYLE_DEFS,
  NERDFONT_GLYPHS,
  PROMPT_ELEMENT_TYPES,
  SEPARATORS,
  PRESETS,
  DEFAULT_OPTIONS,
  DEFAULT_MOCK_DATA,
  hexToRgb,
  rgbToHex,
  x256ToRgb,
  colorSpecToRgb,
  buildBashColorSeq,
  buildZshColorSeq,
  bashReset,
  zshReset,
  getElementType,
  getElementBashEscape,
  getElementZshEscape,
  renderBashElement,
  renderZshElement,
  renderBashPrompt,
  renderZshPrompt,
  renderZshRprompt,
  renderPreview,
  generateGitHelper,
  generateBashrcSnippet,
  generateZshrcSnippet,
  generatePs2,
  generatePs3,
  generatePs4,
  validatePrompt,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeNewElement,
  type PromptElement,
  type PromptOptions,
  type Shell,
  type HistoryEntry,
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

describe("bash-prompt constants", () => {
  it("has 16 standard colors", () => {
    expect(STANDARD_16_COLORS).toHaveLength(16);
  });
  it("has 8 SGR styles", () => {
    expect(SGR_STYLE_DEFS).toHaveLength(8);
  });
  it("has 17 element types", () => {
    expect(PROMPT_ELEMENT_TYPES).toHaveLength(17);
  });
  it("has 8+ nerd font glyphs", () => {
    expect(NERDFONT_GLYPHS.length).toBeGreaterThanOrEqual(8);
  });
  it("has separators", () => {
    expect(SEPARATORS.length).toBeGreaterThan(0);
    expect(SEPARATORS).toContain(": ");
  });
  it("has 5 presets", () => {
    expect(PRESETS).toHaveLength(5);
  });
  it("default options are bash with reset", () => {
    expect(DEFAULT_OPTIONS.shell).toBe("bash");
    expect(DEFAULT_OPTIONS.resetAtEnd).toBe(true);
  });
  it("default mock data has user alice", () => {
    expect(DEFAULT_MOCK_DATA.user).toBe("alice");
  });
  it("ESC is the escape byte 0x1b", () => {
    expect(ESC).toBe("\x1b");
  });
});

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

describe("bash-prompt hexToRgb", () => {
  it("parses #abc shorthand", () => {
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });
  it("parses #aabbcc", () => {
    expect(hexToRgb("#aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
  });
  it("returns null for invalid hex", () => {
    expect(hexToRgb("#xyz")).toBeNull();
    expect(hexToRgb("not-a-color")).toBeNull();
  });
  it("handles missing #", () => {
    expect(hexToRgb("aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
  });
});

describe("bash-prompt rgbToHex", () => {
  it("produces #rrggbb", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });
  it("clamps out-of-range values", () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
  });
});

describe("bash-prompt x256ToRgb", () => {
  it("returns rgb for standard 16 indices", () => {
    const rgb = x256ToRgb(1);
    expect(rgb.r).toBe(170);
    expect(rgb.g).toBe(0);
  });
  it("computes cube indices 16-231", () => {
    const rgb = x256ToRgb(196); // r=5, g=0, b=4 → 255, 0, 196ish
    expect(rgb.r).toBeGreaterThan(200);
  });
  it("computes grayscale 232-255", () => {
    const rgb = x256ToRgb(255);
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });
});

describe("bash-prompt colorSpecToRgb", () => {
  it("returns null for none mode", () => {
    expect(colorSpecToRgb({ mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } })).toBeNull();
  });
  it("returns rgb for truecolor", () => {
    expect(colorSpecToRgb({ mode: "truecolor", index: 0, rgb: { r: 10, g: 20, b: 30 } })).toEqual({ r: 10, g: 20, b: 30 });
  });
  it("returns rgb for x256", () => {
    const rgb = colorSpecToRgb({ mode: "x256", index: 1, rgb: { r: 0, g: 0, b: 0 } });
    expect(rgb).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Color sequence builders
// ---------------------------------------------------------------------------

describe("bash-prompt buildBashColorSeq", () => {
  it("returns empty string when no styles/colors", () => {
    expect(buildBashColorSeq(
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    )).toBe("");
  });
  it("wraps with \\[ \\]", () => {
    const seq = buildBashColorSeq(
      { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq.startsWith("\\[")).toBe(true);
    expect(seq.endsWith("\\]")).toBe(true);
    expect(seq).toContain("31");
  });
  it("includes bold code 1", () => {
    const seq = buildBashColorSeq(
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      ["bold"],
    );
    expect(seq).toContain("1");
  });
  it("emits 256 color codes for x256", () => {
    const seq = buildBashColorSeq(
      { mode: "x256", index: 208, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("38;5;208");
  });
  it("emits truecolor codes", () => {
    const seq = buildBashColorSeq(
      { mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("38;2;255;128;0");
  });
  it("emits background codes", () => {
    const seq = buildBashColorSeq(
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("40");
  });
});

describe("bash-prompt buildZshColorSeq", () => {
  it("emits %F{} for foreground", () => {
    const seq = buildZshColorSeq(
      { mode: "standard16", index: 1, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("%F{red}");
  });
  it("emits %K{} for background", () => {
    const seq = buildZshColorSeq(
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("%K{black}");
  });
  it("emits %F{#rrggbb} for truecolor", () => {
    const seq = buildZshColorSeq(
      { mode: "truecolor", index: 0, rgb: { r: 255, g: 0, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    expect(seq).toContain("%F{#ff0000}");
  });
});

describe("bash-prompt reset sequences", () => {
  it("bashReset is wrapped \\\\033[0m", () => {
    expect(bashReset()).toBe("\\[\\033[0m\\]");
  });
  it("zshReset has %f%k%b%u%s", () => {
    expect(zshReset()).toContain("%f");
    expect(zshReset()).toContain("%k");
  });
});

// ---------------------------------------------------------------------------
// Element rendering
// ---------------------------------------------------------------------------

describe("bash-prompt getElementType", () => {
  it("finds username", () => {
    const t = getElementType("username");
    expect(t).toBeDefined();
    expect(t?.bashEscape).toBe("\\u");
    expect(t?.zshEscape).toBe("%n");
  });
  it("returns undefined for unknown", () => {
    expect(getElementType("nonexistent" as never)).toBeUndefined();
  });
});

describe("bash-prompt getElementBashEscape / ZshEscape", () => {
  it("returns \\u for username", () => {
    expect(getElementBashEscape("username")).toBe("\\u");
  });
  it("returns %n for username (zsh)", () => {
    expect(getElementZshEscape("username")).toBe("%n");
  });
  it("returns \\$? for exit-status", () => {
    expect(getElementBashEscape("exit-status")).toBe("\\$?");
  });
  it("returns $? for exit-status (zsh)", () => {
    expect(getElementZshEscape("exit-status")).toBe("%?");
  });
});

describe("bash-prompt renderBashElement", () => {
  it("renders plain element with no color", () => {
    const el: PromptElement = {
      id: "x", type: "username",
      fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    expect(renderBashElement(el)).toBe("\\u");
  });
  it("renders colored element with reset", () => {
    const el: PromptElement = {
      id: "x", type: "username",
      fg: { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
    };
    const out = renderBashElement(el);
    expect(out).toContain("\\[");
    expect(out).toContain("\\u");
    expect(out).toContain(bashReset());
  });
  it("renders custom-text", () => {
    const el: PromptElement = {
      id: "x", type: "custom-text", text: "hello",
      fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    expect(renderBashElement(el)).toBe("hello");
  });
  it("renders separator", () => {
    const el: PromptElement = {
      id: "x", type: "separator", separator: "@",
      fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    expect(renderBashElement(el)).toBe("@");
  });
  it("renders exit-aware prompt symbol with backtick if", () => {
    const el: PromptElement = {
      id: "x", type: "prompt-symbol", exitAwareColor: true, separator: "$ ",
      fg: { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    const out = renderBashElement(el);
    expect(out).toContain("if [");
    expect(out).toContain("$? -eq 0");
  });
});

describe("bash-prompt renderZshElement", () => {
  it("renders plain zsh element", () => {
    const el: PromptElement = {
      id: "x", type: "username",
      fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    expect(renderZshElement(el)).toBe("%n");
  });
  it("escapes % in custom text", () => {
    const el: PromptElement = {
      id: "x", type: "custom-text", text: "100%",
      fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
    };
    expect(renderZshElement(el)).toBe("100%%");
  });
});

// ---------------------------------------------------------------------------
// Full prompt
// ---------------------------------------------------------------------------

describe("bash-prompt renderBashPrompt", () => {
  it("concatenates elements", () => {
    const elements: PromptElement[] = [
      makeNewElement("username"),
      makeNewElement("separator"),
      makeNewElement("hostname-short"),
    ];
    const out = renderBashPrompt(elements, { ...DEFAULT_OPTIONS, resetAtEnd: false });
    expect(out).toContain("\\u");
    expect(out).toContain("\\h");
  });
  it("adds title bar escape when titleBar=true", () => {
    const elements: PromptElement[] = [makeNewElement("username")];
    const out = renderBashPrompt(elements, { ...DEFAULT_OPTIONS, titleBar: true, resetAtEnd: false });
    expect(out.startsWith("\\[\\e]0;\\u@\\h\\a\\]")).toBe(true);
  });
  it("appends reset when resetAtEnd=true", () => {
    const elements: PromptElement[] = [makeNewElement("username")];
    const out = renderBashPrompt(elements, { ...DEFAULT_OPTIONS, resetAtEnd: true });
    expect(out.endsWith(bashReset())).toBe(true);
  });
});

describe("bash-prompt renderZshPrompt", () => {
  it("renders zsh escapes", () => {
    const elements: PromptElement[] = [
      makeNewElement("username"),
      makeNewElement("cwd-full"),
    ];
    const out = renderZshPrompt(elements, { ...DEFAULT_OPTIONS, shell: "zsh" });
    expect(out).toContain("%n");
    expect(out).toContain("%~");
  });
});

describe("bash-prompt renderZshRprompt", () => {
  it("renders rprompt elements", () => {
    const elements: PromptElement[] = [makeNewElement("time-24")];
    const out = renderZshRprompt(elements);
    expect(out).toContain("%D{");
  });
});

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

describe("bash-prompt renderPreview", () => {
  it("returns segments with text", () => {
    const elements: PromptElement[] = [
      makeNewElement("username"),
      makeNewElement("separator"),
      makeNewElement("prompt-symbol"),
    ];
    const p = renderPreview(elements, DEFAULT_OPTIONS, DEFAULT_MOCK_DATA);
    expect(p.text).toContain("alice");
    expect(p.text.length).toBeGreaterThan(0);
    expect(p.segments.length).toBeGreaterThan(0);
  });
  it("substitutes mock data", () => {
    const elements: PromptElement[] = [makeNewElement("username")];
    const p = renderPreview(elements, DEFAULT_OPTIONS, { ...DEFAULT_MOCK_DATA, user: "bob" });
    expect(p.text).toContain("bob");
  });
  it("renders git branch from mock", () => {
    const elements: PromptElement[] = [makeNewElement("git-branch")];
    const p = renderPreview(elements, DEFAULT_OPTIONS, DEFAULT_MOCK_DATA);
    expect(p.text).toContain("main");
  });
});

// ---------------------------------------------------------------------------
// Git helper & rc snippets
// ---------------------------------------------------------------------------

describe("bash-prompt generateGitHelper", () => {
  it("generates bash function parse_git_branch", () => {
    const s = generateGitHelper("bash");
    expect(s).toContain("parse_git_branch()");
    expect(s).toContain("git symbolic-ref");
  });
  it("generates zsh function git_branch_zsh", () => {
    const s = generateGitHelper("zsh");
    expect(s).toContain("git_branch_zsh()");
    expect(s).toContain("git symbolic-ref");
  });
});

describe("bash-prompt generateBashrcSnippet", () => {
  it("includes PS1= assignment", () => {
    const s = generateBashrcSnippet("\\u@\\h", DEFAULT_OPTIONS);
    expect(s).toContain("PS1=");
  });
  it("includes git helper", () => {
    const s = generateBashrcSnippet("\\u", DEFAULT_OPTIONS);
    expect(s).toContain("parse_git_branch");
  });
});

describe("bash-prompt generateZshrcSnippet", () => {
  it("includes PROMPT=", () => {
    const s = generateZshrcSnippet("%n@%m", null, { ...DEFAULT_OPTIONS, shell: "zsh" });
    expect(s).toContain("PROMPT=");
  });
  it("includes RPROMPT when useRprompt and elements given", () => {
    const rprompt: PromptElement[] = [makeNewElement("time-24")];
    const s = generateZshrcSnippet("%n", rprompt, { ...DEFAULT_OPTIONS, shell: "zsh", useRprompt: true });
    expect(s).toContain("RPROMPT=");
  });
});

// ---------------------------------------------------------------------------
// Secondary prompts
// ---------------------------------------------------------------------------

describe("bash-prompt secondary prompts", () => {
  it("PS2 has > symbol (bash)", () => {
    expect(generatePs2({ ...DEFAULT_OPTIONS, shell: "bash" })).toContain(">");
  });
  it("PS3 has # symbol (bash)", () => {
    expect(generatePs3({ ...DEFAULT_OPTIONS, shell: "bash" })).toContain("#");
  });
  it("PS4 has + symbol (bash)", () => {
    expect(generatePs4({ ...DEFAULT_OPTIONS, shell: "bash" })).toContain("+");
  });
  it("PS2 has %F for zsh", () => {
    expect(generatePs2({ ...DEFAULT_OPTIONS, shell: "zsh" })).toContain("%F");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("bash-prompt validatePrompt", () => {
  it("warns about empty elements", () => {
    const issues = validatePrompt([], DEFAULT_OPTIONS);
    expect(issues.some((i) => i.message.includes("no elements"))).toBe(true);
  });
  it("warns when twoLine on but no newline", () => {
    const elements: PromptElement[] = [makeNewElement("username")];
    const issues = validatePrompt(elements, { ...DEFAULT_OPTIONS, twoLine: true });
    expect(issues.some((i) => i.message.includes("Two-line"))).toBe(true);
  });
  it("passes for valid prompt", () => {
    const elements: PromptElement[] = [
      makeNewElement("username"),
      makeNewElement("prompt-symbol"),
    ];
    const issues = validatePrompt(elements, DEFAULT_OPTIONS);
    expect(issues.some((i) => i.level === "warning")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("bash-prompt history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = { ts: 1, shell: "bash", elementCount: 3, preview: "alice@host" };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].preview).toBe("alice@host");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, shell: "bash", elementCount: 1, preview: `p${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, shell: "bash", elementCount: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("bash-prompt shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const elements: PromptElement[] = [makeNewElement("username")];
    const url = buildShareUrl(elements, DEFAULT_OPTIONS);
    expect(url).toContain("shell=bash");
    expect(url).toContain("titleBar=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const elements: PromptElement[] = [makeNewElement("username")];
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(elements, DEFAULT_OPTIONS);
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.split("#")[1] ?? url.slice(1);
    const parsed = parseShareUrl(hash);
    expect(parsed.options.shell).toBe("bash");
    expect(parsed.elements.length).toBe(1);
    expect(parsed.elements[0].type).toBe("username");
  });
  it("parses zsh shell flag", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl([], { ...DEFAULT_OPTIONS, shell: "zsh" });
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.split("#")[1] ?? url.slice(1);
    const parsed = parseShareUrl(hash);
    expect(parsed.options.shell).toBe("zsh");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.elements).toEqual([]);
    expect(p.options.shell).toBe("bash");
  });
});

// ---------------------------------------------------------------------------
// makeNewElement
// ---------------------------------------------------------------------------

describe("bash-prompt makeNewElement", () => {
  it("creates username element with \\u default", () => {
    const el = makeNewElement("username");
    expect(el.type).toBe("username");
    expect(el.fg.mode).toBe("none");
  });
  it("creates custom-text with default text", () => {
    const el = makeNewElement("custom-text");
    expect(el.text).toBe("text");
  });
  it("creates separator with default", () => {
    const el = makeNewElement("separator");
    expect(el.separator).toBe(": ");
  });
  it("creates nerdfont-glyph with default glyph", () => {
    const el = makeNewElement("nerdfont-glyph");
    expect(el.glyph).toBeDefined();
    expect(el.glyph?.length).toBeGreaterThan(0);
  });
  it("creates unique IDs", () => {
    const a = makeNewElement("username");
    const b = makeNewElement("username");
    expect(a.id).not.toBe(b.id);
  });
});

// Suppress unused-import lint
export type _Unused = Shell;
