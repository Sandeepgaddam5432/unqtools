import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_CATEGORIES,
  THUMBNAIL_STYLES,
  TEXT_LENGTHS,
  CATEGORY_LABELS,
  STYLE_LABELS,
  LENGTH_LABELS,
  LENGTH_BOUNDS,
  CATEGORY_TEMPLATES,
  POSITIONS,
  COLOR_COMBOS,
  FONTS,
  normalizeText,
  capitalize,
  toThumbnailCase,
  extractNumbers,
  extractKeywords,
  shortenText,
  generateThumbnailText,
  pickEmoji,
  recommendPosition,
  calculateFontSize,
  recommendColor,
  recommendFont,
  getCategoryTemplate,
  predictCtrScore,
  generateVariation,
  generateVariations,
  suggestAbTest,
  computeStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoCategory,
  type ThumbnailStyle,
  type TextLength,
  type OverlayInput,
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

describe("youtube-thumbnail constants", () => {
  it("has 8 video categories", () => {
    expect(VIDEO_CATEGORIES).toHaveLength(8);
    expect(VIDEO_CATEGORIES).toContain("tech");
    expect(VIDEO_CATEGORIES).toContain("gaming");
    expect(VIDEO_CATEGORIES).toContain("comedy");
  });
  it("has 4 thumbnail styles", () => {
    expect(THUMBNAIL_STYLES).toHaveLength(4);
    expect(THUMBNAIL_STYLES).toContain("face-cam");
    expect(THUMBNAIL_STYLES).toContain("text-only");
  });
  it("has 3 text lengths", () => {
    expect(TEXT_LENGTHS).toHaveLength(3);
    expect(TEXT_LENGTHS).toContain("short");
    expect(TEXT_LENGTHS).toContain("medium");
    expect(TEXT_LENGTHS).toContain("long");
  });
  it("has 8 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(8);
  });
  it("has 4 style labels", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(4);
  });
  it("has 3 length labels", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
  });
  it("has length bounds", () => {
    expect(LENGTH_BOUNDS.short.max).toBe(3);
    expect(LENGTH_BOUNDS.medium.max).toBe(7);
    expect(LENGTH_BOUNDS.long.max).toBe(12);
  });
  it("has category templates for all 8 categories", () => {
    expect(Object.keys(CATEGORY_TEMPLATES)).toHaveLength(8);
    expect(CATEGORY_TEMPLATES.gaming).toContain("INSANE");
    expect(CATEGORY_TEMPLATES.tech).toContain("NEW");
    expect(CATEGORY_TEMPLATES.education).toContain("GUIDE");
  });
  it("has 5 positions", () => {
    expect(POSITIONS).toHaveLength(5);
    expect(POSITIONS.some((p) => p.id === "bottom-center")).toBe(true);
  });
  it("has 10+ color combos", () => {
    expect(COLOR_COMBOS.length).toBeGreaterThanOrEqual(10);
    expect(COLOR_COMBOS.some((c) => c.id === "yellow-black")).toBe(true);
  });
  it("has 5 fonts", () => {
    expect(FONTS).toHaveLength(5);
    expect(FONTS.some((f) => f.id === "impact")).toBe(true);
    expect(FONTS.some((f) => f.id === "bebas-neue")).toBe(true);
  });
});

describe("youtube-thumbnail normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("youtube-thumbnail capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
});

describe("youtube-thumbnail toThumbnailCase", () => {
  it("uppercases", () => {
    expect(toThumbnailCase("hello world")).toBe("HELLO WORLD");
  });
});

describe("youtube-thumbnail extractNumbers", () => {
  it("extracts dollar amounts", () => {
    const nums = extractNumbers("How I built a $1M app");
    expect(nums).toContain("$1M");
  });
  it("extracts days count", () => {
    const nums = extractNumbers("Built in 30 days");
    expect(nums.some((n) => n.includes("30"))).toBe(true);
  });
  it("extracts multiple numbers", () => {
    const nums = extractNumbers("$1M in 30 days and 50K users");
    expect(nums.length).toBeGreaterThanOrEqual(3);
  });
  it("returns empty for empty input", () => {
    expect(extractNumbers("")).toEqual([]);
  });
  it("returns empty when no numbers", () => {
    expect(extractNumbers("Hello world")).toEqual([]);
  });
});

describe("youtube-thumbnail extractKeywords", () => {
  it("extracts keywords excluding stopwords", () => {
    const k = extractKeywords("How I built a $1M app in 30 days");
    expect(k).toContain("built");
    expect(k).toContain("app");
    expect(k).not.toContain("how");
    expect(k).not.toContain("in");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("youtube-thumbnail shortenText", () => {
  it("shortens to max words", () => {
    expect(shortenText("one two three four five", 3)).toBe("one two three");
  });
  it("returns original if within limit", () => {
    expect(shortenText("one two", 5)).toBe("one two");
  });
  it("handles empty", () => {
    expect(shortenText("", 5)).toBe("");
  });
});

describe("youtube-thumbnail pickEmoji", () => {
  it("picks emoji per category", () => {
    expect(pickEmoji("gaming")).toBe("🎮");
    expect(pickEmoji("tech")).toBe("🚀");
    expect(pickEmoji("comedy")).toBe("😂");
  });
});

describe("youtube-thumbnail generateThumbnailText", () => {
  const input: OverlayInput = {
    videoTitle: "How I Built a $1M App in 30 Days",
    videoCategory: "tech",
    thumbnailStyle: "face-cam",
    textLength: "short",
    includeNumbers: true,
    includeEmoji: false,
  };
  it("generates text for variation 1 with numbers", () => {
    const text = generateThumbnailText(input, 1);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(text.toUpperCase()); // thumbnail case
  });
  it("uses category template for variation 2", () => {
    const text = generateThumbnailText(input, 2);
    expect(text).toContain("NEW"); // tech template
  });
  it("uses shortened title for variation 3", () => {
    const text = generateThumbnailText(input, 3);
    expect(text.length).toBeGreaterThan(0);
  });
  it("respects includeNumbers=false", () => {
    const text = generateThumbnailText({ ...input, includeNumbers: false }, 1);
    // Without numbers, text shouldn't contain $1M
    expect(text).not.toContain("$1M");
  });
  it("appends emoji when includeEmoji=true", () => {
    const text = generateThumbnailText({ ...input, includeEmoji: true }, 1);
    expect(text).toContain("🚀");
  });
  it("respects short length (max 3 words)", () => {
    const text = generateThumbnailText(input, 3);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(3);
  });
  it("respects medium length (max 7 words)", () => {
    const text = generateThumbnailText({ ...input, textLength: "medium" }, 3);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(7);
  });
  it("returns empty for empty title", () => {
    expect(generateThumbnailText({ ...input, videoTitle: "" }, 1)).toBe("");
  });
});

describe("youtube-thumbnail recommendPosition", () => {
  it("recommends top-left for face-cam style (variation 1)", () => {
    const pos = recommendPosition("face-cam", 1);
    expect(pos.id).toBe("top-left");
  });
  it("recommends center for text-only style (variation 1)", () => {
    const pos = recommendPosition("text-only", 1);
    expect(pos.id).toBe("center");
  });
  it("recommends left-center for screenshot style (variation 1)", () => {
    const pos = recommendPosition("screenshot", 1);
    expect(pos.id).toBe("left-center");
  });
  it("recommends bottom-center for illustration style (variation 1)", () => {
    const pos = recommendPosition("illustration", 1);
    expect(pos.id).toBe("bottom-center");
  });
});

describe("youtube-thumbnail calculateFontSize", () => {
  it("returns base size for short text", () => {
    const pos = POSITIONS.find((p) => p.id === "bottom-center")!;
    const size = calculateFontSize("HELLO", pos);
    expect(size).toBeGreaterThanOrEqual(60);
  });
  it("reduces size for longer text", () => {
    const pos = POSITIONS.find((p) => p.id === "bottom-center")!;
    const short = calculateFontSize("HI", pos);
    const long = calculateFontSize("THIS IS A REALLY LONG THUMBNAIL TEXT", pos);
    expect(long).toBeLessThan(short);
  });
  it("clamps to minimum 36", () => {
    const pos = POSITIONS.find((p) => p.id === "top-left")!;
    const size = calculateFontSize("THIS IS A REALLY REALLY REALLY LONG TEXT THAT EXCEEDS LIMITS", pos);
    expect(size).toBeGreaterThanOrEqual(36);
  });
  it("clamps to maximum 120", () => {
    const pos = POSITIONS.find((p) => p.id === "center")!;
    const size = calculateFontSize("HI", pos);
    expect(size).toBeLessThanOrEqual(120);
  });
});

describe("youtube-thumbnail recommendColor", () => {
  it("returns a color combo", () => {
    const c = recommendColor("tech", 1);
    expect(c).toBeDefined();
    expect(c.hex.text).toMatch(/^#/);
    expect(c.hex.bg).toMatch(/^#/);
  });
  it("returns different combos for different variations", () => {
    const c1 = recommendColor("gaming", 1);
    const c2 = recommendColor("gaming", 2);
    expect(c1.id).not.toBe(c2.id);
  });
});

describe("youtube-thumbnail recommendFont", () => {
  it("returns a font", () => {
    const f = recommendFont("tech", 1);
    expect(f).toBeDefined();
    expect(f.name.length).toBeGreaterThan(0);
  });
  it("returns Impact for tech variation 1", () => {
    const f = recommendFont("tech", 1);
    expect(f.id).toBe("impact");
  });
});

describe("youtube-thumbnail getCategoryTemplate", () => {
  it("returns template for category", () => {
    expect(getCategoryTemplate("gaming", 1)).toBe("INSANE");
    expect(getCategoryTemplate("tech", 1)).toBe("NEW");
    expect(getCategoryTemplate("education", 1)).toBe("GUIDE");
  });
  it("rotates through templates per variation", () => {
    const t1 = getCategoryTemplate("gaming", 1);
    const t2 = getCategoryTemplate("gaming", 2);
    expect(t1).not.toBe(t2);
  });
});

describe("youtube-thumbnail predictCtrScore", () => {
  it("scores higher with numbers", () => {
    const color = COLOR_COMBOS[0];
    const without = predictCtrScore("HELLO WORLD", false, false, "tech", color);
    const withNums = predictCtrScore("$1M APP", true, false, "tech", color);
    expect(withNums).toBeGreaterThan(without);
  });
  it("scores higher for short text", () => {
    const color = COLOR_COMBOS[0];
    const short = predictCtrScore("HI", false, false, "tech", color);
    const long = predictCtrScore("THIS IS A REALLY LONG TEXT FOR A THUMBNAIL", false, false, "tech", color);
    expect(short).toBeGreaterThan(long);
  });
  it("scores higher with high-contrast color", () => {
    const high = COLOR_COMBOS.find((c) => c.contrast === "high")!;
    const medium = COLOR_COMBOS.find((c) => c.contrast === "medium")!;
    const highScore = predictCtrScore("HELLO", false, false, "tech", high);
    const mediumScore = predictCtrScore("HELLO", false, false, "tech", medium);
    expect(highScore).toBeGreaterThanOrEqual(mediumScore);
  });
  it("returns 0 for empty text", () => {
    expect(predictCtrScore("", false, false, "tech", COLOR_COMBOS[0])).toBe(0);
  });
  it("caps at 100", () => {
    const color = COLOR_COMBOS[0];
    const score = predictCtrScore("$1M INSANE NEW GUIDE", true, true, "comedy", color);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("youtube-thumbnail generateVariation", () => {
  const input: OverlayInput = {
    videoTitle: "How I Built a $1M App in 30 Days",
    videoCategory: "tech",
    thumbnailStyle: "face-cam",
    textLength: "short",
    includeNumbers: true,
    includeEmoji: true,
  };
  it("generates a complete variation", () => {
    const v = generateVariation(input, 1);
    expect(v.text.length).toBeGreaterThan(0);
    expect(v.position).toBeDefined();
    expect(v.fontSize).toBeGreaterThan(0);
    expect(v.color).toBeDefined();
    expect(v.font).toBeDefined();
    expect(v.ctrScore).toBeGreaterThanOrEqual(0);
    expect(v.wordCount).toBeGreaterThan(0);
  });
});

describe("youtube-thumbnail generateVariations", () => {
  it("generates 3 variations", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    expect(v).toHaveLength(3);
  });
  it("returns empty for empty title", () => {
    const v = generateVariations({
      videoTitle: "",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    expect(v).toEqual([]);
  });
  it("produces different text across variations", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "medium",
      includeNumbers: true,
      includeEmoji: false,
    });
    const texts = new Set(v.map((x) => x.text));
    expect(texts.size).toBeGreaterThan(1);
  });
});

describe("youtube-thumbnail suggestAbTest", () => {
  it("returns top 2 variations by CTR", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    const ab = suggestAbTest(v);
    expect(ab).not.toBeNull();
    expect(ab!.length).toBe(2);
    expect(ab![0]).not.toBe(ab![1]);
  });
  it("returns null for fewer than 2 variations", () => {
    expect(suggestAbTest([])).toBeNull();
    expect(suggestAbTest([generateVariation({
      videoTitle: "test",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    }, 1)])).toBeNull();
  });
});

describe("youtube-thumbnail computeStats", () => {
  it("computes stats across variations", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    const stats = computeStats(v);
    expect(stats.totalVariations).toBe(3);
    expect(stats.avgTextLength).toBeGreaterThan(0);
    expect(stats.avgFontSize).toBeGreaterThan(0);
    expect(stats.avgCtrScore).toBeGreaterThan(0);
    expect(stats.positionsUsed.length).toBeGreaterThan(0);
    expect(stats.colorCombosUsed.length).toBeGreaterThan(0);
    expect(stats.abTestPair).not.toBeNull();
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats([]);
    expect(stats.totalVariations).toBe(0);
    expect(stats.avgTextLength).toBe(0);
    expect(stats.abTestPair).toBeNull();
  });
});

describe("youtube-thumbnail renderText", () => {
  it("renders a text report", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    const text = renderText(v);
    expect(text).toContain("Variation 1");
    expect(text).toContain("Text:");
    expect(text).toContain("Position:");
    expect(text).toContain("Font size:");
    expect(text).toContain("Color:");
    expect(text).toContain("CTR prediction:");
    expect(text).toContain("A/B Test Suggestion");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("youtube-thumbnail renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("variation,text,position,font_size");
    expect(csv).toContain("color_combo");
    expect(csv).toContain("ctr_score");
  });
  it("renders rows per variation", () => {
    const v = generateVariations({
      videoTitle: "How I Built a $1M App in 30 Days",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    const csv = renderCsv(v);
    expect(csv).toContain("1,");
    expect(csv).toContain("2,");
    expect(csv).toContain("3,");
  });
});

describe("youtube-thumbnail splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("youtube-thumbnail history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      videoTitle: "Test",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      variationCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        videoTitle: "Test",
        videoCategory: "tech",
        thumbnailStyle: "face-cam",
        textLength: "short",
        variationCount: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      videoTitle: "Test",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      variationCount: 3,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("youtube-thumbnail shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      videoTitle: "How I Built a $1M App",
      videoCategory: "tech",
      thumbnailStyle: "face-cam",
      textLength: "short",
      includeNumbers: true,
      includeEmoji: false,
    });
    expect(url).toContain("title=How+I+Built+a+%241M+App");
    expect(url).toContain("cat=tech");
    expect(url).toContain("style=face-cam");
    expect(url).toContain("len=short");
    expect(url).toContain("nums=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Test+Title&cat=gaming&style=text-only&len=medium&nums=1&emoji=1");
    expect(p.videoTitle).toBe("Test Title");
    expect(p.videoCategory).toBe("gaming");
    expect(p.thumbnailStyle).toBe("text-only");
    expect(p.textLength).toBe("medium");
    expect(p.includeNumbers).toBe(true);
    expect(p.includeEmoji).toBe(true);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.videoTitle).toBe("");
    expect(p.videoCategory).toBe("tech");
    expect(p.thumbnailStyle).toBe("face-cam");
    expect(p.textLength).toBe("short");
    expect(p.includeNumbers).toBe(true);
    expect(p.includeEmoji).toBe(false);
  });
  it("filters unknown categories, styles, lengths", () => {
    const p = parseShareUrl("title=x&cat=unknown&style=unknown&len=unknown");
    expect(p.videoCategory).toBe("tech");
    expect(p.thumbnailStyle).toBe("face-cam");
    expect(p.textLength).toBe("short");
  });
});

// Suppress unused-import lint
export type _Unused = VideoCategory | ThumbnailStyle | TextLength | OverlayInput;
