import { describe, it, expect, beforeEach } from "vitest";
import {
  STYLE_PRESETS,
  ASPECT_RATIOS,
  LIGHTING_PRESETS,
  MOOD_PRESETS,
  NEGATIVE_PRESETS,
  QUALITY_BOOSTERS,
  DEFAULT_OPTIONS,
  SAMPLE_PROMPTS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeDescription,
  clampDetail,
  clampStylize,
  estimateTokenCount,
  tokenizeForDiffusion,
  extractKeywords,
  buildNegativePrompt,
  buildDallEPrompt,
  buildStableDiffusionPrompt,
  buildMidjourneyPrompt,
  validatePrompt,
  generateAllPrompts,
  parsePromptToOptions,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildDallEImageRequest,
  extractImageUrlFromResponse,
  type BuildOptions,
  type StylePreset,
  type AspectRatio,
  type LightingPreset,
  type MoodPreset,
  type NegativePreset,
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

describe("t2i constants", () => {
  it("has 12 style presets", () => {
    expect(Object.keys(STYLE_PRESETS)).toHaveLength(12);
  });
  it("has 6 aspect ratios", () => {
    expect(Object.keys(ASPECT_RATIOS)).toHaveLength(6);
  });
  it("has 7 lighting presets", () => {
    expect(Object.keys(LIGHTING_PRESETS)).toHaveLength(7);
  });
  it("has 7 mood presets", () => {
    expect(Object.keys(MOOD_PRESETS)).toHaveLength(7);
  });
  it("has 7 negative presets", () => {
    expect(Object.keys(NEGATIVE_PRESETS)).toHaveLength(7);
  });
  it("has quality boosters", () => {
    expect(QUALITY_BOOSTERS.length).toBeGreaterThan(3);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.style).toBe("photorealistic");
    expect(DEFAULT_OPTIONS.aspectRatio).toBe("16:9");
  });
  it("has sample prompts", () => {
    expect(SAMPLE_PROMPTS.length).toBeGreaterThanOrEqual(3);
  });
  it("exports history key + max", () => {
    expect(HISTORY_KEY).toContain("ai-text-to-image-generator");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("t2i helpers", () => {
  it("normalizeDescription collapses whitespace", () => {
    expect(normalizeDescription("  a   b  ")).toBe("a b");
  });
  it("clampDetail clamps 1-5", () => {
    expect(clampDetail(0)).toBe(1);
    expect(clampDetail(3)).toBe(3);
    expect(clampDetail(10)).toBe(5);
    expect(clampDetail(NaN)).toBe(3);
  });
  it("clampStylize clamps 0-1000", () => {
    expect(clampStylize(-100)).toBe(0);
    expect(clampStylize(500)).toBe(500);
    expect(clampStylize(2000)).toBe(1000);
  });
  it("estimateTokenCount is positive for words", () => {
    expect(estimateTokenCount("hello world")).toBeGreaterThanOrEqual(1);
    expect(estimateTokenCount("")).toBe(0);
  });
});

describe("t2i tokenizeForDiffusion", () => {
  it("returns comma-separated chunks", () => {
    const out = tokenizeForDiffusion("a cat, a dog, and a bird");
    expect(out).toContain("a cat");
    expect(out).toContain("a dog");
    expect(out).toContain("a bird");
    expect(out).not.toContain("and");
  });
  it("wraps with weights when weight !== 1", () => {
    const out = tokenizeForDiffusion("red fox, autumn leaves", 1.3);
    expect(out).toContain("(red fox:1.3)");
    expect(out).toContain("(autumn leaves:1.3)");
  });
  it("returns empty for empty input", () => {
    expect(tokenizeForDiffusion("")).toBe("");
  });
});

describe("t2i extractKeywords", () => {
  it("removes stop words", () => {
    const kws = extractKeywords("the cat and a dog");
    expect(kws).toContain("cat");
    expect(kws).toContain("dog");
    expect(kws).not.toContain("the");
    expect(kws).not.toContain("and");
  });
  it("deduplicates", () => {
    const kws = extractKeywords("cat cat dog");
    expect(kws.filter((k) => k === "cat")).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("t2i buildNegativePrompt", () => {
  it("combines presets", () => {
    const out = buildNegativePrompt(["text", "blur"], "");
    expect(out).toContain("text");
    expect(out).toContain("blurry");
  });
  it("includes custom terms", () => {
    const out = buildNegativePrompt([], "ugly, bad");
    expect(out).toContain("ugly");
    expect(out).toContain("bad");
  });
  it("deduplicates", () => {
    const out = buildNegativePrompt(["text"], "text, watermark");
    const matches = out.split(", ").filter((x) => x === "text");
    expect(matches).toHaveLength(1);
  });
  it("returns empty for none + empty custom", () => {
    expect(buildNegativePrompt(["none"], "")).toBe("");
    expect(buildNegativePrompt([], "")).toBe("");
  });
});

describe("t2i buildDallEPrompt", () => {
  it("builds a natural-language prompt", () => {
    const p = buildDallEPrompt({ ...DEFAULT_OPTIONS, description: "a cat" });
    expect(p.model).toBe("dall-e-3");
    expect(p.prompt).toContain("photograph");
    expect(p.prompt).toContain("a cat");
    expect(p.tokens).toBeGreaterThan(0);
  });
  it("returns empty for empty description", () => {
    const p = buildDallEPrompt({ ...DEFAULT_OPTIONS, description: "" });
    expect(p.prompt).toBe("");
    expect(p.notes).toContain("Empty description");
  });
  it("includes size in notes", () => {
    const p = buildDallEPrompt({ ...DEFAULT_OPTIONS, description: "x", aspectRatio: "1:1" });
    expect(p.notes.some((n) => n.includes("1024x1024"))).toBe(true);
  });
  it("includes seed note when seed set", () => {
    const p = buildDallEPrompt({ ...DEFAULT_OPTIONS, description: "x", seed: 42 });
    expect(p.notes.some((n) => n.includes("seed 42"))).toBe(true);
  });
});

describe("t2i buildStableDiffusionPrompt", () => {
  it("builds a weighted-keyword prompt with negative", () => {
    const p = buildStableDiffusionPrompt({
      ...DEFAULT_OPTIONS,
      description: "a cat in a garden",
      negativePresets: ["low-quality"],
    });
    expect(p.model).toBe("stable-diffusion");
    expect(p.prompt).toContain("a cat in a garden");
    expect(p.prompt).toContain("photorealistic");
    expect(p.negativePrompt).toContain("low quality");
  });
  it("includes lighting keywords", () => {
    const p = buildStableDiffusionPrompt({
      ...DEFAULT_OPTIONS,
      description: "x",
      lighting: "neon",
    });
    expect(p.prompt).toContain("neon");
  });
  it("includes mood keywords", () => {
    const p = buildStableDiffusionPrompt({
      ...DEFAULT_OPTIONS,
      description: "x",
      mood: "epic",
    });
    expect(p.prompt).toContain("epic");
  });
});

describe("t2i buildMidjourneyPrompt", () => {
  it("builds prompt with --ar and --v parameters", () => {
    const p = buildMidjourneyPrompt({ ...DEFAULT_OPTIONS, description: "a cat" });
    expect(p.model).toBe("midjourney");
    expect(p.parameters).toContain("--ar 16:9");
    expect(p.parameters).toContain("--v 6");
    expect(p.prompt).toContain("--ar 16:9");
  });
  it("includes --seed when seed set", () => {
    const p = buildMidjourneyPrompt({ ...DEFAULT_OPTIONS, description: "x", seed: 12345 });
    expect(p.parameters).toContain("--seed 12345");
  });
  it("includes --fast for draft quality", () => {
    const p = buildMidjourneyPrompt({ ...DEFAULT_OPTIONS, description: "x", quality: "draft" });
    expect(p.parameters).toContain("--fast");
  });
  it("includes --quality 2 for high quality", () => {
    const p = buildMidjourneyPrompt({ ...DEFAULT_OPTIONS, description: "x", quality: "high" });
    expect(p.parameters).toContain("--quality 2");
  });
  it("includes --stylize when not 100", () => {
    const p = buildMidjourneyPrompt({ ...DEFAULT_OPTIONS, description: "x", stylize: 500 });
    expect(p.parameters).toContain("--stylize 500");
  });
});

describe("t2i validatePrompt", () => {
  it("flags empty description", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "" });
    expect(v.valid).toBe(false);
    expect(v.errors).toContain("Description is empty.");
  });
  it("warns on short description", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "hi" });
    expect(v.warnings.some((w) => w.includes("very short"))).toBe(true);
  });
  it("flags bad stylize", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "x", stylize: -1 });
    expect(v.valid).toBe(false);
  });
  it("flags bad detail", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "x", detail: 99 });
    expect(v.valid).toBe(false);
  });
  it("warns on safety words", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "a nude portrait" });
    expect(v.warnings.some((w) => w.includes("nude"))).toBe(true);
  });
  it("passes valid options", () => {
    const v = validatePrompt({ ...DEFAULT_OPTIONS, description: "a serene mountain lake at dawn" });
    expect(v.valid).toBe(true);
  });
});

describe("t2i generateAllPrompts", () => {
  it("generates all 3 model prompts", () => {
    const r = generateAllPrompts({ ...DEFAULT_OPTIONS, description: "a cat on a couch" });
    expect(r.prompts).toHaveLength(3);
    expect(r.prompts.map((p) => p.model)).toEqual(["dall-e-3", "stable-diffusion", "midjourney"]);
  });
  it("computes total tokens", () => {
    const r = generateAllPrompts({ ...DEFAULT_OPTIONS, description: "a cat on a couch" });
    expect(r.stats.totalTokens).toBeGreaterThan(0);
    expect(r.stats.byModel["dall-e-3"]).toBeGreaterThan(0);
  });
  it("passes through warnings", () => {
    const r = generateAllPrompts({ ...DEFAULT_OPTIONS, description: "hi" });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("t2i parsePromptToOptions", () => {
  it("detects anime style", () => {
    const o = parsePromptToOptions("anime-style girl with neon lights, 16:9");
    expect(o.style).toBe("anime");
    expect(o.aspectRatio).toBe("16:9");
    expect(o.lighting).toBe("neon");
  });
  it("detects watercolor + calm", () => {
    const o = parsePromptToOptions("a calm watercolor of a lake");
    expect(o.style).toBe("watercolor");
    expect(o.mood).toBe("calm");
  });
  it("detects pixel-art and 9:16", () => {
    const o = parsePromptToOptions("16-bit pixel art portrait, 9:16");
    expect(o.style).toBe("pixel-art");
    expect(o.aspectRatio).toBe("9:16");
  });
  it("returns empty for unknown text", () => {
    const o = parsePromptToOptions("hello world");
    expect(Object.keys(o)).toHaveLength(0);
  });
});

describe("t2i renderText / renderJson", () => {
  it("renders text with all three models", () => {
    const r = generateAllPrompts({ ...DEFAULT_OPTIONS, description: "a cat" });
    const text = renderText(r);
    expect(text).toContain("DALL-E-3");
    expect(text).toContain("STABLE-DIFFUSION");
    expect(text).toContain("MIDJOURNEY");
  });
  it("renders JSON with options and prompts", () => {
    const r = generateAllPrompts({ ...DEFAULT_OPTIONS, description: "a cat" });
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.prompts).toHaveLength(3);
    expect(parsed.options.description).toBe("a cat");
  });
});

describe("t2i history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      description: "x",
      style: "photorealistic",
      aspectRatio: "16:9",
      seed: null,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        description: "x",
        style: "photorealistic",
        aspectRatio: "16:9",
        seed: null,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      description: "x",
      style: "photorealistic",
      aspectRatio: "16:9",
      seed: null,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("t2i shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      description: "a cat",
      style: "anime",
      aspectRatio: "1:1",
      lighting: "neon",
      mood: "epic",
      seed: 42,
      quality: "high",
      stylize: 500,
      version: 6,
      detail: 4,
    });
    expect(url).toContain("d=a+cat");
    expect(url).toContain("style=anime");
    expect(url).toContain("ar=1%3A1");
    expect(url).toContain("seed=42");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=a+cat&style=anime&ar=1%3A1&light=neon&mood=epic&seed=42&q=high&stylize=500&v=6&detail=4");
    expect(p.description).toBe("a cat");
    expect(p.style).toBe("anime");
    expect(p.aspectRatio).toBe("1:1");
    expect(p.lighting).toBe("neon");
    expect(p.mood).toBe("epic");
    expect(p.seed).toBe(42);
    expect(p.quality).toBe("high");
    expect(p.stylize).toBe(500);
    expect(p.version).toBe(6);
    expect(p.detail).toBe(4);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown style", () => {
    const p = parseShareUrl("d=x&style=unknown-style");
    expect(p.style).toBeUndefined();
  });
});

describe("t2i BYO-key DALL·E image request", () => {
  it("builds DALL·E image request body", () => {
    const req = buildDallEImageRequest({
      ...DEFAULT_OPTIONS,
      description: "a cat",
      aspectRatio: "1:1",
      quality: "high",
    });
    expect(req.model).toBe("dall-e-3");
    expect(req.n).toBe(1);
    expect(req.size).toBe("1024x1024");
    expect(req.quality).toBe("hd");
    expect(req.prompt).toContain("a cat");
  });
  it("uses standard quality for non-high", () => {
    const req = buildDallEImageRequest({
      ...DEFAULT_OPTIONS,
      description: "x",
      quality: "standard",
    });
    expect(req.quality).toBe("standard");
  });
  it("extracts image URL from response", () => {
    const resp = { data: [{ url: "https://example.com/img.png" }] };
    expect(extractImageUrlFromResponse(resp)).toBe("https://example.com/img.png");
  });
  it("extracts base64 data URL when no url", () => {
    const resp = { data: [{ b64_json: "abc123" }] };
    expect(extractImageUrlFromResponse(resp)).toBe("data:image/png;base64,abc123");
  });
  it("returns empty for malformed response", () => {
    expect(extractImageUrlFromResponse(null)).toBe("");
    expect(extractImageUrlFromResponse({})).toBe("");
    expect(extractImageUrlFromResponse({ data: [] })).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused =
  | BuildOptions
  | StylePreset
  | AspectRatio
  | LightingPreset
  | MoodPreset
  | NegativePreset;
