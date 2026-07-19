import { describe, it, expect, beforeEach } from "vitest";
import {
  CHAR_LIMIT,
  HISTORY_MAX,
  ACCOUNT_TYPE_LABELS,
  TONE_LABELS,
  CTA_LABELS,
  NICHE_PRESETS,
  clean,
  countChars,
  suggestHashtags,
  suggestHandles,
  buildBio,
  trimBio,
  generateBios,
  generateAbPair,
  computeStats,
  renderText,
  renderMarkdown,
  renderCsv,
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
  type AccountType,
  type Tone,
  type Cta,
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

describe("ig-bio constants", () => {
  it("has 150-char limit", () => {
    expect(CHAR_LIMIT).toBe(150);
  });
  it("has 4 account types", () => {
    expect(Object.keys(ACCOUNT_TYPE_LABELS)).toHaveLength(4);
    expect(ACCOUNT_TYPE_LABELS.creator).toBe("Creator");
  });
  it("has 5 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 5 CTAs", () => {
    expect(Object.keys(CTA_LABELS)).toHaveLength(5);
  });
  it("has 10+ niche presets", () => {
    expect(NICHE_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("history cap is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("ig-bio clean + countChars", () => {
  it("collapses whitespace", () => {
    expect(clean("  Alex   Rivera  ")).toBe("Alex Rivera");
  });
  it("handles empty input", () => {
    expect(clean("")).toBe("");
  });
  it("counts ASCII text", () => {
    expect(countChars("hello")).toBe(5);
  });
  it("counts emojis as 1 char", () => {
    expect(countChars("🔥")).toBe(1);
  });
  it("counts mixed text and emojis", () => {
    // "a" + "🔥" + "b" = 3 chars
    expect(countChars("a🔥b")).toBe(3);
  });
  it("strips variation selectors and ZWJ", () => {
    // Family emoji with ZWJ should collapse
    expect(countChars("👨‍👩‍👧")).toBe(3); // 3 emoji code points, ZWJ stripped
  });
});

describe("ig-bio suggestHashtags", () => {
  it("generates hashtags for a niche", () => {
    const tags = suggestHashtags("fitness coach");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toBe("#fitnesscoach");
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
  });
  it("respects max parameter", () => {
    expect(suggestHashtags("yoga", 4).length).toBeLessThanOrEqual(4);
  });
  it("returns empty for empty input", () => {
    expect(suggestHashtags("")).toEqual([]);
  });
  it("strips non-alphanumeric characters", () => {
    const tags = suggestHashtags("food & drink!!!");
    expect(tags[0]).toBe("#fooddrink");
  });
});

describe("ig-bio suggestHandles", () => {
  it("generates handles from name", () => {
    const handles = suggestHandles("Alex Rivera", "fitness coach");
    expect(handles.length).toBeGreaterThan(0);
    expect(handles[0].handle.startsWith("@")).toBe(true);
  });
  it("includes name + niche combos", () => {
    const handles = suggestHandles("Alex Rivera", "fitness coach");
    const joined = handles.map((h) => h.handle).join(" ");
    expect(joined).toContain("alex");
  });
  it("returns empty when both name and niche are empty", () => {
    expect(suggestHandles("", "")).toEqual([]);
  });
  it("respects max parameter", () => {
    expect(suggestHandles("alex", "yoga", 3).length).toBeLessThanOrEqual(3);
  });
  it("includes 'the' prefix variant", () => {
    const handles = suggestHandles("alex", "yoga");
    expect(handles.some((h) => h.handle === "@thealex")).toBe(true);
  });
});

describe("ig-bio buildBio", () => {
  it("builds a creator bio", () => {
    const bio = buildBio("creator", "aesthetic", "link-in-bio", "Alex Rivera", "fitness coach");
    expect(bio.accountType).toBe("creator");
    expect(bio.tone).toBe("aesthetic");
    expect(bio.text).toContain("Alex Rivera");
    expect(bio.text).toContain("fitness coach");
    expect(bio.lines.length).toBeGreaterThanOrEqual(2);
    expect(bio.charCount).toBeGreaterThan(0);
  });
  it("always includes the CTA on the last line", () => {
    const bio = buildBio("business", "professional", "shop-now", "Acme", "shoes");
    expect(bio.lines[bio.lines.length - 1]).toContain("Shop now");
  });
  it("falls back to any account-type template if tone has no match", () => {
    // Personal has no bold-tone template — exercises the fallback path.
    const bio = buildBio("personal", "bold", "follow", "Alex", "yoga");
    expect(bio.text).toContain("Alex");
  });
  it("populates hashtags", () => {
    const bio = buildBio("brand", "bold", "shop-now", "Acme", "shoes");
    expect(bio.hashtags.length).toBeGreaterThan(0);
    expect(bio.hashtags[0]).toContain("shoes");
  });
  it("uses default name when empty", () => {
    const bio = buildBio("personal", "aesthetic", "dm-me", "", "yoga");
    expect(bio.text).toContain("Your Name");
  });
});

describe("ig-bio 150-char limit", () => {
  it("generated bios fit within 150 chars", () => {
    const bios = generateBios("creator", "minimal", "link-in-bio", "Alex", "yoga");
    for (const b of bios) {
      expect(b.charCount).toBeLessThanOrEqual(CHAR_LIMIT);
    }
  });
  it("business bios fit within 150 chars", () => {
    const bios = generateBios("business", "professional", "book-now", "Acme Consulting", "marketing strategy");
    for (const b of bios) {
      expect(b.charCount).toBeLessThanOrEqual(CHAR_LIMIT);
    }
  });
  it("brand bios fit within 150 chars", () => {
    const bios = generateBios("brand", "bold", "shop-now", "Acme", "running shoes");
    for (const b of bios) {
      expect(b.charCount).toBeLessThanOrEqual(CHAR_LIMIT);
    }
  });
});

describe("ig-bio trimBio", () => {
  it("returns unchanged when within limit", () => {
    const bio = buildBio("creator", "minimal", "link-in-bio", "Alex", "yoga");
    const trimmed = trimBio(bio);
    expect(trimmed.text).toBe(bio.text);
    expect(trimmed.trimmed).toBe(false);
  });
  it("trims an over-limit bio to fit", () => {
    const bio = buildBio("creator", "aesthetic", "link-in-bio", "Alex Rivera", "fitness coach and lifestyle content creator");
    if (bio.exceedsLimit) {
      const trimmed = trimBio(bio);
      expect(trimmed.charCount).toBeLessThanOrEqual(CHAR_LIMIT);
      expect(trimmed.trimmed).toBe(true);
    }
  });
});

describe("ig-bio generateBios", () => {
  it("generates at least 4 variants", () => {
    const bios = generateBios("creator", "aesthetic", "link-in-bio", "Alex", "yoga");
    expect(bios.length).toBeGreaterThanOrEqual(4);
  });
  it("generates the requested count when higher", () => {
    const bios = generateBios("brand", "bold", "shop-now", "Acme", "shoes", 8);
    expect(bios.length).toBe(8);
  });
  it("produces unique ids", () => {
    const bios = generateBios("personal", "playful", "dm-me", "Sam", "food");
    const ids = new Set(bios.map((b) => b.id));
    expect(ids.size).toBe(bios.length);
  });
});

describe("ig-bio generateAbPair", () => {
  it("produces a control and a challenger with different tones", () => {
    const pair = generateAbPair("creator", "Alex", "yoga");
    expect(pair.control.accountType).toBe(pair.challenger.accountType);
    expect(pair.control.tone).not.toBe(pair.challenger.tone);
  });
  it("includes a hypothesis and what-to-measure", () => {
    const pair = generateAbPair("brand", "Acme", "shoes");
    expect(pair.hypothesis.length).toBeGreaterThan(10);
    expect(pair.whatToMeasure.length).toBeGreaterThan(10);
  });
  it("produces an id", () => {
    const pair = generateAbPair("personal", "Sam", "food");
    expect(pair.id.startsWith("abpair-")).toBe(true);
  });
});

describe("ig-bio computeStats", () => {
  it("groups by account type", () => {
    const bios = [
      ...generateBios("creator", "aesthetic", "link-in-bio", "Alex", "yoga"),
      ...generateBios("brand", "bold", "shop-now", "Acme", "shoes"),
    ];
    const stats = computeStats(bios);
    expect(stats.length).toBe(2);
    expect(stats.some((s) => s.accountType === "creator")).toBe(true);
    expect(stats.some((s) => s.accountType === "brand")).toBe(true);
  });
  it("computes average chars", () => {
    const bios = generateBios("creator", "minimal", "follow", "Alex", "yoga");
    const stats = computeStats(bios);
    const s = stats.find((x) => x.accountType === "creator")!;
    expect(s.avgChars).toBeGreaterThan(0);
    expect(s.avgChars).toBeLessThanOrEqual(CHAR_LIMIT);
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
});

describe("ig-bio renderers", () => {
  const bios = generateBios("creator", "aesthetic", "link-in-bio", "Alex", "yoga");

  it("renderText includes the bio text and char count", () => {
    const text = renderText(bios);
    expect(text).toContain("Alex");
    expect(text).toContain("Chars:");
  });
  it("renderText uses --- separator between bios", () => {
    const text = renderText(bios);
    expect(text).toContain("---");
  });
  it("renderMarkdown uses ## headers and code fences", () => {
    const md = renderMarkdown(bios);
    expect(md).toContain("## Bio 1");
    expect(md).toContain("```");
  });
  it("renderCsv includes a header row", () => {
    const csv = renderCsv(bios);
    expect(csv).toContain("id,account_type,tone,cta,char_count,char_limit,exceeds_limit,trimmed,text");
  });
  it("renderCsv escapes commas and newlines in bio text", () => {
    const csv = renderCsv(bios);
    // Bio text contains embedded \n line breaks; the escapeCsv helper wraps
    // such fields in double quotes (RFC 4180). We verify each bio appears as
    // its own record by counting id prefixes — one per bio.
    const idMatches = csv.match(/^bio-\d+/gm);
    expect(idMatches).not.toBeNull();
    expect(idMatches!.length).toBe(bios.length);
  });
  it("renderJson produces valid JSON", () => {
    const json = renderJson(bios);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(bios.length);
  });
});

describe("ig-bio history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, accountType: "creator", tone: "aesthetic", cta: "link-in-bio", name: "Alex", niche: "yoga", variantCount: 6 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, accountType: "creator", tone: "aesthetic", cta: "link-in-bio", name: "Alex", niche: "yoga", variantCount: 6 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, accountType: "creator", tone: "aesthetic", cta: "link-in-bio", name: "Alex", niche: "yoga", variantCount: 6 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ig-bio favorites (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadFavorites()).toEqual([]);
  });
  it("saves and loads", () => {
    saveFavorite({ ts: 100, text: "🔥 Alex | yoga", accountType: "creator", tone: "aesthetic", cta: "link-in-bio" });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("removes by ts", () => {
    saveFavorite({ ts: 100, text: "🔥 Alex", accountType: "creator", tone: "aesthetic", cta: "link-in-bio" });
    saveFavorite({ ts: 200, text: "✨ Sam", accountType: "personal", tone: "minimal", cta: "dm-me" });
    removeFavorite(100);
    const faves = loadFavorites();
    expect(faves).toHaveLength(1);
    expect(faves[0].ts).toBe(200);
  });
  it("clears", () => {
    saveFavorite({ ts: 100, text: "x", accountType: "creator", tone: "aesthetic", cta: "link-in-bio" });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

describe("ig-bio shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ accountType: "creator", tone: "aesthetic", cta: "link-in-bio", name: "Alex Rivera", niche: "yoga" });
    expect(url).toContain("at=creator");
    expect(url).toContain("t=aesthetic");
    expect(url).toContain("n=Alex+Rivera");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("at=brand&t=bold&c=shop-now&n=Acme&ni=shoes");
    expect(p.accountType).toBe("brand");
    expect(p.tone).toBe("bold");
    expect(p.cta).toBe("shop-now");
    expect(p.name).toBe("Acme");
    expect(p.niche).toBe("shoes");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown account types", () => {
    const p = parseShareUrl("at=unknown&t=aesthetic");
    expect(p.accountType).toBeUndefined();
    expect(p.tone).toBe("aesthetic");
  });
  it("filters unknown tones", () => {
    const p = parseShareUrl("at=creator&t=does-not-exist");
    expect(p.accountType).toBe("creator");
    expect(p.tone).toBeUndefined();
  });
});

describe("ig-bio LLM prompt + renderer", () => {
  it("builds a prompt containing the niche and constraint", () => {
    const prompt = buildLlmPrompt("creator", "aesthetic", "link-in-bio", "Alex Rivera", "yoga");
    expect(prompt).toContain("yoga");
    expect(prompt).toContain("150");
    expect(prompt).toContain("JSON");
  });
  it("renders valid LLM JSON output", () => {
    const raw = JSON.stringify([
      { text: "🔥 Alex | yoga\nDaily flows", hashtags: ["#yoga", "#flow"], rationale: "Bold opener" },
    ]);
    const result = renderLlmResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].text).toContain("Alex");
      expect(result.variants[0].hashtags).toContain("#yoga");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([
      { text: "test bio", hashtags: [], rationale: "x" },
    ]) + "\n```";
    const result = renderLlmResult(raw);
    expect(result.ok).toBe(true);
  });
  it("returns error on invalid JSON", () => {
    const result = renderLlmResult("not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("parse");
  });
  it("returns error when output is not an array", () => {
    const result = renderLlmResult(JSON.stringify({ text: "x" }));
    expect(result.ok).toBe(false);
  });
  it("returns error when no valid items", () => {
    const result = renderLlmResult(JSON.stringify([{ noText: true }]));
    expect(result.ok).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = AccountType | Tone | Cta;
