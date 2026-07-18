import { describe, it, expect, beforeEach } from "vitest";
import {
  WIDTH,
  HEIGHT,
  isValidHex,
  normalizeHex,
  hexToRgb,
  isDarkColor,
  escapeXml,
  wrapText,
  anchorForAlign,
  buildTextElements,
  buildBackground,
  buildLogo,
  buildSvg,
  validate,
  generate,
  defaultInput,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";
import type { OgImageInput } from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("open-graph-image-generator constants", () => {
  it("WIDTH is 1200", () => {
    expect(WIDTH).toBe(1200);
  });
  it("HEIGHT is 630", () => {
    expect(HEIGHT).toBe(630);
  });
});

describe("open-graph-image-generator isValidHex", () => {
  it("accepts 6-digit hex", () => {
    expect(isValidHex("#1a2b3c")).toBe(true);
  });
  it("accepts 3-digit hex", () => {
    expect(isValidHex("#abc")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidHex("nope")).toBe(false);
    expect(isValidHex("#xyz")).toBe(false);
    expect(isValidHex("")).toBe(false);
  });
});

describe("open-graph-image-generator normalizeHex", () => {
  it("expands 3-digit to 6-digit", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });
  it("lowercases 6-digit", () => {
    expect(normalizeHex("#1A2B3C")).toBe("#1a2b3c");
  });
  it("returns black for invalid", () => {
    expect(normalizeHex("nope")).toBe("#000000");
  });
});

describe("open-graph-image-generator hexToRgb", () => {
  it("converts correctly", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
  });
  it("expands 3-digit", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("open-graph-image-generator isDarkColor", () => {
  it("black is dark", () => {
    expect(isDarkColor("#000000")).toBe(true);
  });
  it("white is not dark", () => {
    expect(isDarkColor("#ffffff")).toBe(false);
  });
  it("navy is dark", () => {
    expect(isDarkColor("#1a1a2e")).toBe(true);
  });
  it("yellow is not dark", () => {
    expect(isDarkColor("#ffff00")).toBe(false);
  });
});

describe("open-graph-image-generator escapeXml", () => {
  it("escapes special chars", () => {
    expect(escapeXml("a < b & c > d \"e\" 'f'")).toBe("a &lt; b &amp; c &gt; d &quot;e&quot; &apos;f&apos;");
  });
  it("handles empty", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("open-graph-image-generator wrapText", () => {
  it("returns empty for empty", () => {
    expect(wrapText("", 10)).toEqual([]);
  });
  it("wraps at word boundaries", () => {
    const lines = wrapText("the quick brown fox jumps", 15);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 15 || !l.includes(" "))).toBe(true);
  });
  it("returns single line for short text", () => {
    expect(wrapText("hello", 50)).toEqual(["hello"]);
  });
  it("handles very long single word", () => {
    const lines = wrapText("supercalifragilisticexpialidocious", 10);
    expect(lines).toEqual(["supercalifragilisticexpialidocious"]);
  });
});

describe("open-graph-image-generator anchorForAlign", () => {
  it("left aligns start at padding", () => {
    const { x, anchor } = anchorForAlign("left", 80);
    expect(x).toBe(80);
    expect(anchor).toBe("start");
  });
  it("center aligns at WIDTH/2", () => {
    const { x, anchor } = anchorForAlign("center", 80);
    expect(x).toBe(WIDTH / 2);
    expect(anchor).toBe("middle");
  });
  it("right aligns at WIDTH - padding", () => {
    const { x, anchor } = anchorForAlign("right", 80);
    expect(x).toBe(WIDTH - 80);
    expect(anchor).toBe("end");
  });
});

describe("open-graph-image-generator buildTextElements", () => {
  it("produces <text> elements", () => {
    const out = buildTextElements({ ...defaultInput(), title: "Hello" });
    expect(out).toContain("<text");
    expect(out).toContain("Hello");
  });
  it("uses textColor in fill", () => {
    const out = buildTextElements({ ...defaultInput(), title: "Hi", textColor: "#ff0000" });
    expect(out).toContain('fill="#ff0000"');
  });
  it("uses fontSize", () => {
    const out = buildTextElements({ ...defaultInput(), title: "Hi", fontSize: 80 });
    expect(out).toContain('font-size="80"');
  });
  it("includes subtitle when provided", () => {
    const out = buildTextElements({ ...defaultInput(), title: "Hi", subtitle: "World" });
    expect(out).toContain("World");
  });
  it("escapes XML in title", () => {
    const out = buildTextElements({ ...defaultInput(), title: "a < b" });
    expect(out).toContain("&lt;");
  });
});

describe("open-graph-image-generator buildBackground", () => {
  it("solid template uses rect with bgColor", () => {
    const out = buildBackground({ ...defaultInput(), template: "solid", bgColor: "#ff0000" });
    expect(out).toContain('fill="#ff0000"');
    expect(out).not.toContain("<linearGradient");
  });
  it("gradient template includes linearGradient", () => {
    const out = buildBackground({ ...defaultInput(), template: "gradient", bgColor: "#ff0000", bgColor2: "#0000ff" });
    expect(out).toContain("<linearGradient");
    expect(out).toContain("#ff0000");
    expect(out).toContain("#0000ff");
  });
  it("pattern template includes pattern def", () => {
    const out = buildBackground({ ...defaultInput(), template: "pattern", bgColor: "#1a1a2e" });
    expect(out).toContain("<pattern");
  });
});

describe("open-graph-image-generator buildLogo", () => {
  it("returns empty when no logoUrl", () => {
    expect(buildLogo({ ...defaultInput(), logoUrl: "" })).toBe("");
  });
  it("includes image element when logoUrl set", () => {
    const out = buildLogo({ ...defaultInput(), logoUrl: "https://example.com/logo.png" });
    expect(out).toContain("<image");
    expect(out).toContain("https://example.com/logo.png");
  });
});

describe("open-graph-image-generator buildSvg", () => {
  it("returns full SVG with correct dimensions", () => {
    const svg = buildSvg({ ...defaultInput(), title: "Test" });
    expect(svg).toContain("<svg");
    expect(svg).toContain(`width="${WIDTH}"`);
    expect(svg).toContain(`height="${HEIGHT}"`);
    expect(svg).toContain("</svg>");
  });
  it("includes viewBox", () => {
    const svg = buildSvg({ ...defaultInput(), title: "Test" });
    expect(svg).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
  });
});

describe("open-graph-image-generator validate", () => {
  it("passes for valid input", () => {
    const v = validate({ ...defaultInput(), title: "Hello World" });
    expect(v.ok).toBe(true);
  });
  it("fails for empty title", () => {
    const v = validate({ ...defaultInput(), title: "" });
    expect(v.ok).toBe(false);
  });
  it("fails for invalid bg color", () => {
    const v = validate({ ...defaultInput(), bgColor: "nope" });
    expect(v.ok).toBe(false);
  });
  it("fails for invalid text color", () => {
    const v = validate({ ...defaultInput(), textColor: "nope" });
    expect(v.ok).toBe(false);
  });
  it("fails for font size out of range", () => {
    const v = validate({ ...defaultInput(), fontSize: 10 });
    expect(v.ok).toBe(false);
  });
  it("fails for invalid gradient second color", () => {
    const v = validate({ ...defaultInput(), template: "gradient", bgColor2: "nope" });
    expect(v.ok).toBe(false);
  });
});

describe("open-graph-image-generator generate", () => {
  it("throws on invalid input", () => {
    expect(() => generate({ ...defaultInput(), title: "" })).toThrow();
  });
  it("returns SVG string for valid input", () => {
    const out = generate({ ...defaultInput(), title: "Hello" });
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).toContain("Hello");
  });
});

describe("open-graph-image-generator defaultInput", () => {
  it("returns valid default input", () => {
    const d = defaultInput();
    expect(d.title).toBe("");
    expect(d.bgColor).toBeTruthy();
    expect(d.fontSize).toBeGreaterThan(0);
  });
});

describe("open-graph-image-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "Hello", template: "gradient", bgColor: "#1a1a2e" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: "X", template: "solid", bgColor: "#000000" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "X", template: "solid", bgColor: "#000000" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("open-graph-image-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...defaultInput(), title: "Hello" });
    expect(url).toContain("title=Hello");
    expect(url).toContain("fs=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Hello&bg=%23ff0000&fs=72&t=gradient&align=center");
    expect(p.title).toBe("Hello");
    expect(p.bgColor).toBe("#ff0000");
    expect(p.fontSize).toBe(72);
    expect(p.template).toBe("gradient");
    expect(p.textAlign).toBe("center");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty title", () => {
    const url = buildShareUrl({ ...defaultInput(), title: "" });
    expect(url).not.toContain("title=");
  });
});
