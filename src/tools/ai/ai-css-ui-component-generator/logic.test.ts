import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FAVES_KEY,
  TYPE_LABELS,
  TARGET_LABELS,
  VARIANT_LABELS,
  FONT_PRESETS,
  COMPONENT_PRESETS,
  KEYWORD_MAP,
  DEFAULT_THEME,
  normalizeDescription,
  tokenize,
  extractKeywords,
  matchComponentType,
  readableTextOn,
  shade,
  contrastOk,
  generateComponent,
  scoreComponent,
  parseRefinement,
  applyRefinement,
  cssToTailwind,
  toReactComponent,
  buildPreviewSrcDoc,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ComponentType,
  type Variant,
  type OutputTarget,
  type GeneratedComponent,
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

describe("ai-css-ui-comp constants", () => {
  it("has 15 component types", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(15);
  });
  it("has 3 output targets", () => {
    expect(Object.keys(TARGET_LABELS)).toHaveLength(3);
  });
  it("has 6 variants", () => {
    expect(Object.keys(VARIANT_LABELS)).toHaveLength(6);
  });
  it("has keyword map for each type", () => {
    for (const t of Object.keys(TYPE_LABELS) as ComponentType[]) {
      expect(KEYWORD_MAP[t]).toBeDefined();
      expect(KEYWORD_MAP[t].length).toBeGreaterThan(0);
    }
  });
  it("has font presets", () => {
    expect(FONT_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(FONT_PRESETS[0]).toContain("system-ui");
  });
  it("has component presets", () => {
    expect(COMPONENT_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("has default theme", () => {
    expect(DEFAULT_THEME.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(DEFAULT_THEME.radius).toBeGreaterThan(0);
  });
  it("history constants are set", () => {
    expect(HISTORY_KEY).toContain("ai-css-ui-comp");
    expect(HISTORY_MAX).toBe(20);
    expect(FAVES_KEY).toContain("ai-css-ui-comp");
  });
});

describe("ai-css-ui-comp normalizeDescription", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeDescription("  Pricing   CARD  ")).toBe("pricing card");
  });
  it("handles empty", () => {
    expect(normalizeDescription("")).toBe("");
  });
});

describe("ai-css-ui-comp tokenize", () => {
  it("splits into tokens", () => {
    expect(tokenize("pricing card with toggle")).toEqual(["pricing", "card", "toggle"]);
  });
  it("filters stopwords and short words", () => {
    expect(tokenize("a card of the brand")).toEqual(["card", "brand"]);
  });
  it("handles empty", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("ai-css-ui-comp extractKeywords", () => {
  it("returns single words and 2-grams", () => {
    const kws = extractKeywords("pricing card with toggle");
    expect(kws).toContain("pricing");
    expect(kws).toContain("card");
    expect(kws).toContain("pricing card");
    expect(kws).toContain("card toggle");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-css-ui-comp matchComponentType", () => {
  it("matches pricing card to card type", () => {
    const m = matchComponentType("pricing card with toggle");
    expect(m.type).toBe("card");
    expect(m.confidence).toBeGreaterThan(50);
    expect(m.matched).toContain("card");
  });
  it("matches navbar with search", () => {
    const m = matchComponentType("navbar with search and dark mode");
    expect(m.type).toBe("navbar");
    expect(m.matched).toContain("navbar");
  });
  it("matches login form", () => {
    const m = matchComponentType("login form with email and password");
    expect(m.type).toBe("form");
  });
  it("matches progress bar", () => {
    const m = matchComponentType("progress bar at 60 percent");
    expect(m.type).toBe("progress");
  });
  it("returns default for empty", () => {
    const m = matchComponentType("");
    expect(m.confidence).toBe(0);
  });
  it("returns some confidence for unknown", () => {
    const m = matchComponentType("something weird");
    expect(m.confidence).toBeGreaterThanOrEqual(25);
  });
});

describe("ai-css-ui-comp readableTextOn", () => {
  it("returns white on dark", () => {
    expect(readableTextOn("#000000")).toBe("#ffffff");
  });
  it("returns black on light", () => {
    expect(readableTextOn("#ffffff")).toBe("#111827");
  });
  it("returns white for invalid", () => {
    expect(readableTextOn("nope")).toBe("#ffffff");
  });
});

describe("ai-css-ui-comp shade", () => {
  it("darkens a color", () => {
    expect(shade("#ffffff", -50)).toBe("#808080");
  });
  it("lightens a color", () => {
    expect(shade("#000000", 50)).toBe("#808080");
  });
  it("returns input for invalid", () => {
    expect(shade("nope", 50)).toBe("nope");
  });
});

describe("ai-css-ui-comp contrastOk", () => {
  it("black on white passes", () => {
    expect(contrastOk("#000000", "#ffffff")).toBe(true);
  });
  it("yellow on white fails", () => {
    expect(contrastOk("#ffff00", "#ffffff")).toBe(false);
  });
  it("returns false for invalid colors", () => {
    expect(contrastOk("nope", "nope")).toBe(false);
  });
});

describe("ai-css-ui-comp generateComponent", () => {
  it("generates a card component", () => {
    const c = generateComponent({ description: "pricing card with toggle" });
    expect(c).not.toBeNull();
    expect(c!.type).toBe("card");
    expect(c!.html).toContain("uq-card");
    expect(c!.css).toContain("uq-card");
    expect(c!.confidence).toBeGreaterThan(50);
  });
  it("generates vanilla target with css", () => {
    const c = generateComponent({ description: "gradient button", target: "vanilla" });
    expect(c!.target).toBe("vanilla");
    expect(c!.css.length).toBeGreaterThan(0);
  });
  it("generates tailwind target with classes", () => {
    const c = generateComponent({ description: "outline button", target: "tailwind" });
    expect(c!.target).toBe("tailwind");
    expect(c!.html).toContain("class=");
    expect(c!.tailwind.length).toBeGreaterThan(0);
  });
  it("uses variant when provided and valid", () => {
    const c = generateComponent({ description: "destructive alert", variant: "destructive", target: "vanilla" });
    expect(c!.variant).toBe("destructive");
  });
  it("falls back to first variant when invalid variant given", () => {
    const c = generateComponent({ description: "alert banner", variant: "gradient", target: "vanilla" });
    expect(c!.variant).toBe("primary"); // alert's first variant is "primary"
  });
  it("respects theme override", () => {
    const c = generateComponent({
      description: "primary button",
      theme: { primary: "#ff0000", radius: 16 },
    });
    expect(c!.html).toContain("uq-btn");
    expect(c!.css).toContain("#ff0000");
    expect(c!.css).toContain("16px");
  });
  it("extracts text from quotes", () => {
    const c = generateComponent({ description: 'button labeled "Sign up now"' });
    expect(c!.html).toContain("Sign up now");
  });
  it("extracts progress percentage", () => {
    const c = generateComponent({ description: "progress bar at 75 percent" });
    expect(c!.html).toContain("75%");
  });
  it("returns null for empty description", () => {
    expect(generateComponent({ description: "" })).toBeNull();
  });
  it("generates navbar component", () => {
    const c = generateComponent({ description: "navbar with search" });
    expect(c!.type).toBe("navbar");
    expect(c!.html).toContain("<nav");
  });
  it("generates accordion component", () => {
    const c = generateComponent({ description: "accordion with FAQ items" });
    expect(c!.type).toBe("accordion");
    expect(c!.html).toContain("<details");
  });
  it("includes a11y report", () => {
    const c = generateComponent({ description: "alert banner" });
    expect(c!.a11y).toBeDefined();
    expect(Array.isArray(c!.a11y.issues)).toBe(true);
  });
  it("includes score 0-100", () => {
    const c = generateComponent({ description: "primary button" });
    expect(c!.score).toBeGreaterThanOrEqual(0);
    expect(c!.score).toBeLessThanOrEqual(100);
  });
});

describe("ai-css-ui-comp scoreComponent", () => {
  it("rewards semantic html + a11y + confidence", () => {
    const s = scoreComponent({
      a11y: { hasAriaLabel: true, hasSemanticHtml: true, hasAltText: true, contrastOk: true, issues: [] },
      html: '<button class="btn">x</button>',
      css: ".btn { color: red; padding: 8px; }",
      confidence: 80,
      target: "vanilla",
    });
    expect(s).toBeGreaterThan(50);
  });
  it("penalizes a11y issues", () => {
    const s = scoreComponent({
      a11y: { hasAriaLabel: false, hasSemanticHtml: false, hasAltText: false, contrastOk: false, issues: ["bad"] },
      html: "<div>x</div>",
      css: "",
      confidence: 0,
      target: "vanilla",
    });
    expect(s).toBeLessThan(60);
  });
});

describe("ai-css-ui-comp parseRefinement", () => {
  it("parses dark + shadow", () => {
    const r = parseRefinement("make it dark and add shadow");
    expect(r.makeDark).toBe(true);
    expect(r.addShadow).toBe(true);
  });
  it("parses rounded", () => {
    const r = parseRefinement("more rounded");
    expect(r.rounded).toBe(true);
  });
  it("parses larger", () => {
    const r = parseRefinement("make it larger");
    expect(r.larger).toBe(true);
  });
  it("parses light mode", () => {
    const r = parseRefinement("switch to light mode");
    expect(r.makeLight).toBe(true);
  });
});

describe("ai-css-ui-comp applyRefinement", () => {
  it("applies dark mode", () => {
    const t = applyRefinement(DEFAULT_THEME, parseRefinement("dark"));
    expect(t.dark).toBe(true);
  });
  it("increases radius when rounded", () => {
    const t = applyRefinement({ ...DEFAULT_THEME, radius: 8 }, parseRefinement("rounded"));
    expect(t.radius).toBe(16);
  });
  it("decreases radius when smaller", () => {
    const t = applyRefinement({ ...DEFAULT_THEME, radius: 12 }, parseRefinement("smaller"));
    expect(t.radius).toBe(8);
  });
});

describe("ai-css-ui-comp cssToTailwind", () => {
  it("converts flex display", () => {
    expect(cssToTailwind("display: flex; justify-content: center;")).toContain("flex");
    expect(cssToTailwind("display: flex; justify-content: center;")).toContain("justify-center");
  });
  it("converts padding", () => {
    const out = cssToTailwind("padding: 16px;");
    expect(out.some((c) => c.includes("p-[16px]"))).toBe(true);
  });
  it("converts font-size", () => {
    const out = cssToTailwind("font-size: 14px;");
    expect(out.some((c) => c.includes("text-[14px]"))).toBe(true);
  });
  it("handles empty css", () => {
    expect(cssToTailwind("")).toEqual([]);
  });
});

describe("ai-css-ui-comp toReactComponent", () => {
  it("converts class to className", () => {
    const jsx = toReactComponent('<button class="btn">Hi</button>');
    expect(jsx).toContain("className=");
    expect(jsx).not.toContain('class="');
    expect(jsx).toContain("export function");
  });
  it("converts for to htmlFor", () => {
    const jsx = toReactComponent('<label for="x">L</label>');
    expect(jsx).toContain("htmlFor=");
  });
});

describe("ai-css-ui-comp buildPreviewSrcDoc", () => {
  it("builds a full HTML doc for vanilla", () => {
    const c = generateComponent({ description: "primary button" })!;
    const doc = buildPreviewSrcDoc(c, DEFAULT_THEME);
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<style>");
    expect(doc).toContain(c.html);
  });
  it("includes Tailwind CDN for tailwind target", () => {
    const c = generateComponent({ description: "primary button", target: "tailwind" })!;
    const doc = buildPreviewSrcDoc(c, DEFAULT_THEME);
    expect(doc).toContain("cdn.tailwindcss.com");
  });
});

describe("ai-css-ui-comp computeStats", () => {
  it("computes per-type stats", () => {
    const c1 = generateComponent({ description: "primary button" })!;
    const c2 = generateComponent({ description: "alert banner" })!;
    const stats = computeStats([c1, c2]);
    expect(stats).toHaveLength(2);
    expect(stats.some((s) => s.type === "button")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
});

describe("ai-css-ui-comp renderText/renderMarkdown/renderJson", () => {
  it("renders text with HTML and CSS", () => {
    const c = generateComponent({ description: "primary button" })!;
    const text = renderText([c]);
    expect(text).toContain("HTML:");
    expect(text).toContain("CSS:");
    expect(text).toContain("Button");
  });
  it("renders markdown with code fences", () => {
    const c = generateComponent({ description: "primary button" })!;
    const md = renderMarkdown([c]);
    expect(md).toContain("```html");
    expect(md).toContain("```css");
  });
  it("renders JSON valid", () => {
    const c = generateComponent({ description: "primary button" })!;
    const json = renderJson([c]);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("ai-css-ui-comp history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, description: "primary button",
      type: "button", variant: "primary", target: "vanilla", score: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, description: `x${i}`,
        type: "button", variant: "primary", target: "vanilla", score: 80,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, description: "x",
      type: "button", variant: "primary", target: "vanilla", score: 80,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-css-ui-comp favorites (localStorage)", () => {
  it("loads empty initially", () => { expect(loadFavorites()).toEqual([]); });
  it("saves and loads", () => {
    saveFavorite({
      id: "x1", ts: 1, description: "btn",
      type: "button", variant: "primary", target: "vanilla",
      html: "<button>x</button>", css: "", tailwind: "", score: 80,
    });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("removes by id", () => {
    saveFavorite({
      id: "x1", ts: 1, description: "btn",
      type: "button", variant: "primary", target: "vanilla",
      html: "<button>x</button>", css: "", tailwind: "", score: 80,
    });
    removeFavorite("x1");
    expect(loadFavorites()).toEqual([]);
  });
  it("dedupes by id", () => {
    saveFavorite({
      id: "x1", ts: 1, description: "btn",
      type: "button", variant: "primary", target: "vanilla",
      html: "<button>x</button>", css: "", tailwind: "", score: 80,
    });
    saveFavorite({
      id: "x1", ts: 2, description: "updated",
      type: "button", variant: "primary", target: "vanilla",
      html: "<button>y</button>", css: "", tailwind: "", score: 90,
    });
    const favs = loadFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].description).toBe("updated");
  });
  it("clears", () => {
    saveFavorite({
      id: "x1", ts: 1, description: "btn",
      type: "button", variant: "primary", target: "vanilla",
      html: "<button>x</button>", css: "", tailwind: "", score: 80,
    });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

describe("ai-css-ui-comp shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      description: "primary button",
      variant: "primary",
      target: "vanilla",
      theme: { ...DEFAULT_THEME },
      text: "",
    });
    expect(url).toContain("d=primary");
    expect(url).toContain("v=primary");
    expect(url).toContain("t=vanilla");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = "d=primary%20button&v=primary&t=vanilla&p=%23ff0000&r=12&dk=1";
    const p = parseShareUrl(url);
    expect(p.description).toBe("primary button");
    expect(p.variant).toBe("primary");
    expect(p.target).toBe("vanilla");
    expect(p.theme?.primary).toBe("#ff0000");
    expect(p.theme?.radius).toBe(12);
    expect(p.theme?.dark).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown variant", () => {
    const p = parseShareUrl("d=x&v=unknownvariant");
    expect(p.variant).toBeUndefined();
  });
});

describe("ai-css-ui-comp LLM helpers", () => {
  it("builds prompt with description and type", () => {
    const prompt = buildLlmPrompt("gradient button", "button", "gradient", "vanilla", DEFAULT_THEME);
    expect(prompt).toContain("gradient button");
    expect(prompt).toContain("Button");
    expect(prompt).toContain("JSON");
  });
  it("parses valid LLM JSON output", () => {
    const raw = JSON.stringify({
      html: '<button class="x">Hi</button>',
      css: ".x { color: red; }",
      tailwind: '<button class="text-red-500">Hi</button>',
      notes: "accessible",
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("<button");
      expect(r.notes).toBe("accessible");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({ html: "<b>x</b>" }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("rejects non-JSON output", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("parse");
  });
  it("rejects JSON without html", () => {
    const r = renderLlmResult(JSON.stringify({ css: ".x { }" }));
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = Variant | OutputTarget | GeneratedComponent;
