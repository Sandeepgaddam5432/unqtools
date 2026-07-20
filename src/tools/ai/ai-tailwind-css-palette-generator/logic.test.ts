import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FAVES_KEY,
  FAVES_MAX,
  LLM_KEY_STORAGE,
  SHADE_STEPS,
  SHADE_LIGHTNESS,
  HARMONY_LABELS,
  HARMONY_DESCRIPTIONS,
  COLOR_PRESETS,
  VIBE_PRESETS,
  DEFAULT_BASE,
  clamp,
  isValidHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hexToHsl,
  hslToHex,
  buildShade,
  generatePalette,
  closestStep,
  generateHarmony,
  harmonyColor,
  generateSystemPalette,
  relativeLuminance,
  contrastRatio,
  checkContrast,
  readableTextOn,
  contrastMatrix,
  computeStats,
  renderTailwindV3,
  renderTailwindV4,
  renderCssVars,
  renderJson,
  renderSystemJson,
  renderSystemTailwindV3,
  renderText,
  renderMarkdown,
  randomBaseHex,
  rerollBase,
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
  rgbToCss,
  hslToCss,
  hexToCssRgb,
  hexToCssHsl,
  buildPreviewHtml,
  type ShadeStep,
  type Harmony,
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

describe("ai-tailwind-palette constants", () => {
  it("has 11 shade steps", () => {
    expect(SHADE_STEPS).toHaveLength(11);
    expect(SHADE_STEPS[0]).toBe("50");
    expect(SHADE_STEPS[10]).toBe("950");
  });
  it("has lightness targets for each step", () => {
    for (const s of SHADE_STEPS) {
      expect(SHADE_LIGHTNESS[s]).toBeGreaterThanOrEqual(0);
      expect(SHADE_LIGHTNESS[s]).toBeLessThanOrEqual(100);
    }
  });
  it("lightness decreases monotonically", () => {
    for (let i = 1; i < SHADE_STEPS.length; i++) {
      expect(SHADE_LIGHTNESS[SHADE_STEPS[i]])
        .toBeLessThan(SHADE_LIGHTNESS[SHADE_STEPS[i - 1]]);
    }
  });
  it("has 4 harmonies with labels + descriptions", () => {
    expect(Object.keys(HARMONY_LABELS)).toHaveLength(4);
    for (const k of Object.keys(HARMONY_LABELS) as Harmony[]) {
      expect(HARMONY_DESCRIPTIONS[k].length).toBeGreaterThan(0);
    }
  });
  it("has color presets", () => {
    expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(COLOR_PRESETS[0].hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("has vibe presets", () => {
    expect(VIBE_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("default base is valid hex", () => {
    expect(isValidHex(DEFAULT_BASE)).toBe(true);
  });
  it("history + faves + llm constants are set", () => {
    expect(HISTORY_KEY).toContain("ai-tailwind-palette");
    expect(HISTORY_MAX).toBe(20);
    expect(FAVES_KEY).toContain("ai-tailwind-palette");
    expect(FAVES_MAX).toBe(50);
    expect(LLM_KEY_STORAGE).toContain("ai-tailwind-palette");
  });
});

describe("ai-tailwind-palette color utils", () => {
  it("clamps to range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
  it("validates hex", () => {
    expect(isValidHex("#4f46e5")).toBe(true);
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("4f46e5")).toBe(true);
    expect(isValidHex("#xyz123")).toBe(false);
    expect(isValidHex("")).toBe(false);
  });
  it("normalizes 3-digit hex to 6-digit", () => {
    expect(normalizeHex("#fff")).toBe("#ffffff");
    expect(normalizeHex("FFF")).toBe("#ffffff");
  });
  it("normalizes 6-digit hex", () => {
    expect(normalizeHex("#4F46E5")).toBe("#4f46e5");
  });
  it("returns empty for invalid hex", () => {
    expect(normalizeHex("not-a-color")).toBe("");
  });
  it("converts hex <-> rgb", () => {
    const rgb = hexToRgb("#4f46e5")!;
    expect(rgb.r).toBe(79);
    expect(rgb.g).toBe(70);
    expect(rgb.b).toBe(229);
    expect(rgbToHex(rgb)).toBe("#4f46e5");
  });
  it("converts rgb <-> hsl round-trip", () => {
    const rgb = hexToRgb("#dc2626")!;
    const hsl = rgbToHsl(rgb);
    const back = hslToRgb(hsl);
    expect(Math.round(back.r)).toBe(220);
    expect(Math.round(back.g)).toBe(38);
    expect(Math.round(back.b)).toBe(38);
  });
  it("converts hex -> hsl", () => {
    const hsl = hexToHsl("#dc2626")!;
    expect(Math.round(hsl.h)).toBe(0);
    expect(hsl.s).toBeGreaterThan(60);
  });
  it("converts hsl -> hex", () => {
    const hex = hslToHex({ h: 0, s: 75, l: 50 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("formats rgb as CSS string", () => {
    expect(rgbToCss({ r: 79, g: 70, b: 229 })).toBe("rgb(79, 70, 229)");
  });
  it("formats hsl as CSS string", () => {
    expect(hslToCss({ h: 244, s: 76, l: 59 })).toBe("hsl(244, 76%, 59%)");
  });
  it("converts hex to CSS rgb/hsl", () => {
    expect(hexToCssRgb("#4f46e5")).toBe("rgb(79, 70, 229)");
    expect(hexToCssHsl("#4f46e5")).toMatch(/^hsl/);
  });
});

describe("ai-tailwind-palette shade generation", () => {
  it("builds a single shade with target lightness", () => {
    const baseHsl = hexToHsl("#4f46e5")!;
    const s = buildShade(baseHsl, "500");
    expect(s.step).toBe("500");
    expect(s.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(Math.round(s.hsl.l)).toBe(SHADE_LIGHTNESS["500"]);
    expect(s.token).toBe("primary-500");
  });
  it("clamps extreme light steps", () => {
    const baseHsl = hexToHsl("#ff0000")!; // very saturated red
    const s = buildShade(baseHsl, "50");
    expect(s.hsl.s).toBeLessThanOrEqual(38);
  });
  it("clamps 950 saturation", () => {
    const baseHsl = hexToHsl("#ff0000")!;
    const s = buildShade(baseHsl, "950");
    expect(s.hsl.s).toBeLessThanOrEqual(55);
  });
  it("generates a full palette", () => {
    const p = generatePalette("#4f46e5")!;
    expect(p).not.toBeNull();
    expect(p.shades).toHaveLength(11);
    expect(p.baseHex).toBe("#4f46e5");
    expect(p.name).toBe("primary");
    expect(p.harmony).toBe("monochrome");
    expect(p.id).toMatch(/^pal-/);
  });
  it("returns null for invalid base", () => {
    expect(generatePalette("not-a-color")).toBeNull();
  });
  it("shades are monotonically darker", () => {
    const p = generatePalette("#2563eb")!;
    for (let i = 1; i < p.shades.length; i++) {
      expect(p.shades[i].hsl.l).toBeLessThan(p.shades[i - 1].hsl.l);
    }
  });
  it("preserves base hue across shades", () => {
    const p = generatePalette("#2563eb")!;
    const baseHue = Math.round(p.baseHsl.h);
    for (const s of p.shades) {
      expect(Math.abs(Math.round(s.hsl.h) - baseHue)).toBeLessThanOrEqual(1);
    }
  });
  it("finds closest step", () => {
    expect(closestStep("#4f46e5")).toBe("500");
    // Very light color → 50 or 100
    expect(["50", "100"]).toContain(closestStep("#ffffff"));
    // Very dark color → 950
    expect(closestStep("#000000")).toBe("950");
  });
});

describe("ai-tailwind-palette harmonies", () => {
  it("monochrome returns single palette", () => {
    const ps = generateHarmony("#4f46e5", "monochrome");
    expect(ps).toHaveLength(1);
  });
  it("complementary returns two palettes", () => {
    const ps = generateHarmony("#4f46e5", "complementary");
    expect(ps).toHaveLength(2);
    // Second palette's hue should be ~180° from the first
    const h1 = ps[0].baseHsl.h;
    const h2 = ps[1].baseHsl.h;
    const diff = Math.abs(h1 - h2);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThan(170);
  });
  it("analogous returns three palettes", () => {
    const ps = generateHarmony("#4f46e5", "analogous");
    expect(ps).toHaveLength(3);
  });
  it("triadic returns three palettes", () => {
    const ps = generateHarmony("#4f46e5", "triadic");
    expect(ps).toHaveLength(3);
    // Hues should be ~120° apart
    const h1 = ps[0].baseHsl.h;
    const h2 = ps[1].baseHsl.h;
    const diff = Math.abs(h1 - h2);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThan(100);
  });
  it("harmonyColor returns the second palette's base", () => {
    const c = harmonyColor("#4f46e5", "complementary");
    expect(c).not.toBeNull();
    expect(isValidHex(c!)).toBe(true);
  });
  it("harmonyColor returns null for monochrome", () => {
    expect(harmonyColor("#4f46e5", "monochrome")).toBeNull();
  });
});

describe("ai-tailwind-palette system palette", () => {
  it("generates brand + neutral + 4 status palettes", () => {
    const sys = generateSystemPalette("#4f46e5")!;
    expect(sys).not.toBeNull();
    expect(sys.brand.shades).toHaveLength(11);
    expect(sys.neutral.shades).toHaveLength(11);
    expect(sys.success.shades).toHaveLength(11);
    expect(sys.warning.shades).toHaveLength(11);
    expect(sys.danger.shades).toHaveLength(11);
    expect(sys.info.shades).toHaveLength(11);
  });
  it("neutral is desaturated relative to brand", () => {
    const sys = generateSystemPalette("#4f46e5")!;
    expect(sys.neutral.baseHsl.s).toBeLessThan(sys.brand.baseHsl.s);
  });
  it("returns null for invalid base", () => {
    expect(generateSystemPalette("not-a-color")).toBeNull();
  });
});

describe("ai-tailwind-palette contrast", () => {
  it("relative luminance of black is 0", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 2);
  });
  it("relative luminance of white is 1", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 2);
  });
  it("contrast ratio of same color is 1", () => {
    expect(contrastRatio("#4f46e5", "#4f46e5")).toBeCloseTo(1, 2);
  });
  it("contrast ratio of black/white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeGreaterThan(20);
  });
  it("checkContrast returns AA / AAA / AA-Large flags", () => {
    const c = checkContrast("#ffffff", "#000000");
    expect(c.aa).toBe(true);
    expect(c.aaa).toBe(true);
    expect(c.aaLarge).toBe(true);
  });
  it("readableTextOn picks white for dark backgrounds", () => {
    expect(readableTextOn("#000000")).toBe("#ffffff");
  });
  it("readableTextOn picks black for light backgrounds", () => {
    expect(readableTextOn("#ffffff")).toBe("#000000");
  });
  it("contrastMatrix returns 11 results per axis", () => {
    const p = generatePalette("#4f46e5")!;
    const m = contrastMatrix(p);
    expect(m.vsWhite).toHaveLength(11);
    expect(m.vsBlack).toHaveLength(11);
  });
  it("computeStats returns counts", () => {
    const p = generatePalette("#4f46e5")!;
    const s = computeStats(p);
    expect(s.totalShades).toBe(11);
    expect(s.passingAaVsWhite).toBeGreaterThanOrEqual(0);
    expect(s.passingAaVsBlack).toBeGreaterThanOrEqual(0);
    expect(s.harmonyCount).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-tailwind-palette exports", () => {
  it("renders Tailwind v3 config", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderTailwindV3(p);
    expect(out).toContain("module.exports");
    expect(out).toContain("colors:");
    expect(out).toContain("primary: {");
    expect(out).toContain('500: "#');
    expect(out).toContain("};");
  });
  it("renders Tailwind v3 with custom name", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderTailwindV3(p, "brand");
    expect(out).toContain("brand: {");
  });
  it("renders Tailwind v4 @theme block", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderTailwindV4(p);
    expect(out).toContain("@theme {");
    expect(out).toContain("--color-primary-500:");
  });
  it("renders CSS variables on :root", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderCssVars(p);
    expect(out).toContain(":root {");
    expect(out).toContain("--primary-500:");
  });
  it("renders JSON tokens", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderJson(p);
    const obj = JSON.parse(out);
    expect(obj.name).toBe("primary");
    expect(obj.shades).toHaveLength(11);
    expect(obj.shades[0].hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("renders system JSON tokens", () => {
    const sys = generateSystemPalette("#4f46e5")!;
    const out = renderSystemJson(sys);
    const obj = JSON.parse(out);
    expect(obj.brand).toBeDefined();
    expect(obj.neutral).toBeDefined();
    expect(obj.success).toBeDefined();
    expect(obj.danger).toBeDefined();
  });
  it("renders system Tailwind v3", () => {
    const sys = generateSystemPalette("#4f46e5")!;
    const out = renderSystemTailwindV3(sys);
    expect(out).toContain("primary:");
    expect(out).toContain("neutral:");
    expect(out).toContain("success:");
    expect(out).toContain("danger:");
  });
  it("renders plain text", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderText(p);
    expect(out).toContain("primary palette");
    expect(out).toContain("#4f46e5");
    expect(out).toContain("500");
  });
  it("renders markdown table", () => {
    const p = generatePalette("#4f46e5")!;
    const out = renderMarkdown(p);
    expect(out).toContain("## primary palette");
    expect(out).toContain("| Step |");
    expect(out).toContain("500");
  });
});

describe("ai-tailwind-palette random + lock", () => {
  it("randomBaseHex returns valid hex", () => {
    for (let i = 0; i < 10; i++) {
      const h = randomBaseHex();
      expect(isValidHex(h)).toBe(true);
    }
  });
  it("rerollBase with 'none' rerolls everything", () => {
    const orig = "#4f46e5";
    let anyDifferent = false;
    for (let i = 0; i < 10; i++) {
      const next = rerollBase(orig, "none");
      if (next !== orig) { anyDifferent = true; break; }
    }
    expect(anyDifferent).toBe(true);
  });
  it("rerollBase with 'light' keeps lightness (within 1)", () => {
    const orig = "#4f46e5";
    const origHsl = hexToHsl(orig)!;
    for (let i = 0; i < 10; i++) {
      const next = rerollBase(orig, "light");
      const nextHsl = hexToHsl(next)!;
      expect(Math.abs(Math.round(nextHsl.l) - Math.round(origHsl.l))).toBeLessThanOrEqual(1);
    }
  });
  it("rerollBase with 'sat' keeps saturation (within 1)", () => {
    const orig = "#4f46e5";
    const origHsl = hexToHsl(orig)!;
    for (let i = 0; i < 10; i++) {
      const next = rerollBase(orig, "sat");
      const nextHsl = hexToHsl(next)!;
      expect(Math.abs(Math.round(nextHsl.s) - Math.round(origHsl.s))).toBeLessThanOrEqual(1);
    }
  });
  it("rerollBase with 'hue' keeps hue (within 2)", () => {
    const orig = "#4f46e5";
    const origHsl = hexToHsl(orig)!;
    for (let i = 0; i < 10; i++) {
      const next = rerollBase(orig, "hue");
      const nextHsl = hexToHsl(next)!;
      const diff = Math.abs(Math.round(nextHsl.h) - Math.round(origHsl.h));
      expect(Math.min(diff, 360 - diff)).toBeLessThanOrEqual(2);
    }
  });
});

describe("ai-tailwind-palette history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-tailwind-palette favorites", () => {
  it("loads empty initially", () => {
    expect(loadFavorites()).toEqual([]);
  });
  it("saves and loads", () => {
    saveFavorite({ id: "p1", ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("dedupes by id", () => {
    saveFavorite({ id: "p1", ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    saveFavorite({ id: "p1", ts: 2, baseHex: "#2563eb", harmony: "monochrome", name: "primary" });
    expect(loadFavorites()).toHaveLength(1);
    expect(loadFavorites()[0].baseHex).toBe("#2563eb");
  });
  it("removes by id", () => {
    saveFavorite({ id: "p1", ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    saveFavorite({ id: "p2", ts: 2, baseHex: "#2563eb", harmony: "monochrome", name: "primary" });
    removeFavorite("p1");
    const faves = loadFavorites();
    expect(faves).toHaveLength(1);
    expect(faves[0].id).toBe("p2");
  });
  it("clears", () => {
    saveFavorite({ id: "p1", ts: 1, baseHex: "#4f46e5", harmony: "monochrome", name: "primary" });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

describe("ai-tailwind-palette shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ baseHex: "#4f46e5", harmony: "complementary", name: "primary" });
    expect(url).toContain("hex=%234f46e5");
    expect(url).toContain("h=complementary");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("hex=%234f46e5&h=complementary&n=brand");
    expect(p.baseHex).toBe("#4f46e5");
    expect(p.harmony).toBe("complementary");
    expect(p.name).toBe("brand");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.baseHex).toBe(DEFAULT_BASE);
    expect(p.harmony).toBe("monochrome");
    expect(p.name).toBe("primary");
  });
  it("filters unknown harmony", () => {
    const p = parseShareUrl("hex=%234f46e5&h=unknown");
    expect(p.harmony).toBe("monochrome");
  });
  it("falls back to default base for invalid hex", () => {
    const p = parseShareUrl("hex=notacolor");
    expect(p.baseHex).toBe(DEFAULT_BASE);
  });
});

describe("ai-tailwind-palette LLM prompt + render", () => {
  it("builds an LLM prompt with the vibe", () => {
    const prompt = buildLlmPrompt("calm fintech app");
    expect(prompt).toContain("calm fintech app");
    expect(prompt).toContain("hex");
    expect(prompt).toContain("JSON");
  });
  it("renders valid LLM JSON", () => {
    const raw = JSON.stringify({
      hex: "#2563eb",
      name: "trust blue",
      reason: "conveys stability",
    });
    const res = renderLlmResult(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.suggestion.hex).toBe("#2563eb");
      expect(res.suggestion.name).toBe("trust blue");
      expect(res.suggestion.reason).toBe("conveys stability");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      hex: "#2563eb",
      name: "trust blue",
      reason: "conveys stability",
    }) + "\n```";
    const res = renderLlmResult(raw);
    expect(res.ok).toBe(true);
  });
  it("fails on invalid JSON", () => {
    const res = renderLlmResult("not json");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("parse");
  });
  it("fails on missing hex", () => {
    const res = renderLlmResult(JSON.stringify({ name: "no hex" }));
    expect(res.ok).toBe(false);
  });
  it("normalizes a 3-digit hex from LLM", () => {
    const res = renderLlmResult(JSON.stringify({ hex: "#fff", name: "w", reason: "r" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.suggestion.hex).toBe("#ffffff");
  });
});

describe("ai-tailwind-palette preview HTML", () => {
  it("builds preview HTML with light mode", () => {
    const p = generatePalette("#4f46e5")!;
    const html = buildPreviewHtml(p, false);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Primary action");
    expect(html).toContain("Card title");
  });
  it("builds preview HTML with dark mode", () => {
    const p = generatePalette("#4f46e5")!;
    const html = buildPreviewHtml(p, true);
    expect(html).toContain("#1e1e26"); // dark card bg
  });
  it("preview references palette 500 shade", () => {
    const p = generatePalette("#4f46e5")!;
    const html = buildPreviewHtml(p, false);
    const c500 = p.shades.find((s) => s.step === "500")!.hex;
    expect(html).toContain(c500);
  });
});

// Suppress unused-import lint
export type _UnusedShadeStep = ShadeStep;
