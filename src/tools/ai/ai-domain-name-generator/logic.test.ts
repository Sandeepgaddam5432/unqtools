import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FAVORITES_KEY,
  STYLE_LABELS,
  TECHNIQUE_LABELS,
  FIELD_HINTS,
  TLDS,
  STYLE_POOLS,
  validateInputs,
  capitalize,
  lcFirst,
  escapeRegex,
  slugify,
  parseKeywords,
  countSyllables,
  scorePronounceability,
  scoreMemorability,
  scoreUniqueness,
  scoreLength,
  scoreSyllables,
  scoreBrandability,
  buildCompound,
  buildPortmanteau,
  applyPrefix,
  applySuffix,
  buildInvented,
  buildAlliterative,
  generate,
  buildCandidate,
  suggestDomains,
  suggestSocialHandles,
  suggestTagline,
  trademarkCaution,
  trademarkSearchUrls,
  renderCsv,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  toggleFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Style,
  type Technique,
  type NameInputs,
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

const BASE_INPUTS: NameInputs = {
  keywords: ["ledger", "books"],
  style: "modern",
  minLength: 4,
  maxLength: 12,
  maxSyllables: 4,
  noHyphen: false,
  noNumber: false,
};

describe("ai-domain-name-generator constants", () => {
  it("has 4 styles", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(4);
  });
  it("has 6 techniques", () => {
    expect(Object.keys(TECHNIQUE_LABELS)).toHaveLength(6);
  });
  it("has 8 TLDs", () => {
    expect(TLDS).toHaveLength(8);
    expect(TLDS.map((t) => t.tld)).toEqual(
      expect.arrayContaining(["com", "io", "ai", "co", "app", "so", "dev", "xyz"]),
    );
  });
  it("has style pools with non-empty word lists", () => {
    for (const s of Object.keys(STYLE_POOLS) as Style[]) {
      expect(STYLE_POOLS[s].prefixes.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].suffixes.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].realWords.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].roots.length).toBeGreaterThan(0);
    }
  });
  it("has field hints for every input", () => {
    expect(Object.keys(FIELD_HINTS)).toHaveLength(7);
  });
  it("uses 20 for history max", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("exposes history + favorites keys", () => {
    expect(HISTORY_KEY).toContain("ai-domain-name-generator");
    expect(FAVORITES_KEY).toContain("ai-domain-name-generator");
  });
});

describe("ai-domain-name-generator validateInputs", () => {
  it("warns when no keywords", () => {
    const w = validateInputs({ ...BASE_INPUTS, keywords: [] });
    expect(w.some((x) => x.includes("at least one keyword"))).toBe(true);
  });
  it("warns when too many keywords", () => {
    const w = validateInputs({ ...BASE_INPUTS, keywords: ["a", "b", "c", "d", "e", "f"] });
    expect(w.some((x) => x.includes("More than 5"))).toBe(true);
  });
  it("warns when min below 3", () => {
    const w = validateInputs({ ...BASE_INPUTS, minLength: 2 });
    expect(w.some((x) => x.includes("below 3"))).toBe(true);
  });
  it("warns when max below min", () => {
    const w = validateInputs({ ...BASE_INPUTS, minLength: 10, maxLength: 5 });
    expect(w.some((x) => x.includes("Max length is smaller"))).toBe(true);
  });
  it("warns when generic keyword used", () => {
    const w = validateInputs({ ...BASE_INPUTS, keywords: ["best", "quality"] });
    expect(w.some((x) => x.includes("generic"))).toBe(true);
  });
  it("passes for clean inputs", () => {
    expect(validateInputs(BASE_INPUTS)).toEqual([]);
  });
});

describe("ai-domain-name-generator helpers", () => {
  it("capitalize", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
  it("lcFirst", () => {
    expect(lcFirst("Hello")).toBe("hello");
    expect(lcFirst("")).toBe("");
  });
  it("escapeRegex", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("slugify strips non-alphanumerics", () => {
    expect(slugify("Hello, World!")).toBe("helloworld");
    expect(slugify("  get books.io ")).toBe("getbooksio");
  });
  it("parseKeywords dedupes and caps", () => {
    const out = parseKeywords("Ledger, ledger, BOOKS, books, money, time, year, work");
    expect(out).toContain("ledger");
    expect(out).toContain("books");
    expect(out.length).toBeLessThanOrEqual(5);
  });
  it("parseKeywords skips invalid tokens", () => {
    // "123abc" starts with a digit so is rejected; "_x" is stripped to "x" (valid).
    expect(parseKeywords("123abc _x")).toEqual(["x"]);
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("ai-domain-name-generator pronounceability", () => {
  it("countSyllables handles basic words", () => {
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("a")).toBe(1);
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("")).toBe(0);
  });
  it("scorePronounceability returns 0–20", () => {
    const s = scorePronounceability("novova");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(20);
  });
  it("scorePronounceability penalizes awkward clusters", () => {
    const good = scorePronounceability("novova");
    const bad = scorePronounceability("bcdfgh");
    expect(bad).toBeLessThan(good);
  });
});

describe("ai-domain-name-generator memorability", () => {
  it("rewards double letters", () => {
    const s1 = scoreMemorability("apple");
    const s2 = scoreMemorability("novab");
    expect(s1).toBeGreaterThan(s2);
  });
  it("returns 0–20", () => {
    const s = scoreMemorability("xyz");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(20);
  });
});

describe("ai-domain-name-generator uniqueness", () => {
  it("scores common words low", () => {
    expect(scoreUniqueness("apple")).toBeLessThan(10);
  });
  it("scores invented words higher", () => {
    expect(scoreUniqueness("novova")).toBeGreaterThan(scoreUniqueness("apple"));
  });
});

describe("ai-domain-name-generator length + syllable scoring", () => {
  it("sweet spot 5–9 gets max length score", () => {
    expect(scoreLength("novova")).toBe(20);
  });
  it("short and long get reduced length score", () => {
    expect(scoreLength("abc")).toBeLessThan(20);
    expect(scoreLength("abcdefghijkm")).toBeLessThan(20);
  });
  it("sweet spot 2–3 syllables gets max syllable score", () => {
    expect(scoreSyllables("apple")).toBe(20);
  });
});

describe("ai-domain-name-generator scoreBrandability", () => {
  it("returns total 0–100 and 5 components", () => {
    const s = scoreBrandability("Novova");
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s).toHaveProperty("lengthScore");
    expect(s).toHaveProperty("syllableScore");
    expect(s).toHaveProperty("pronounceabilityScore");
    expect(s).toHaveProperty("memorabilityScore");
    expect(s).toHaveProperty("uniquenessScore");
    expect(Array.isArray(s.notes)).toBe(true);
  });
  it("notes surface sweet-spot concerns", () => {
    const s = scoreBrandability("xq");
    expect(s.notes.length).toBeGreaterThan(0);
  });
});

describe("ai-domain-name-generator build techniques", () => {
  it("buildCompound", () => {
    expect(buildCompound("led", "ger")).toBe("ledGer");
    expect(buildCompound("", "x")).toBe("");
  });
  it("buildPortmanteau blends halves", () => {
    expect(buildPortmanteau("ledger", "books")).toMatch(/^[a-z]+$/);
    expect(buildPortmanteau("ab", "cd")).toBe(""); // too short
  });
  it("applyPrefix / applySuffix", () => {
    expect(applyPrefix("no", "va")).toBe("nova");
    expect(applySuffix("no", "va")).toBe("nova");
    expect(applyPrefix("", "x")).toBe("");
  });
  it("buildInvented", () => {
    expect(buildInvented("nov", "ova")).toBe("novova");
    expect(buildInvented("", "ova")).toBe("");
  });
  it("buildAlliterative requires same first letter", () => {
    expect(buildAlliterative("book", "byte")).toBe("bookbyte");
    expect(buildAlliterative("book", "apple")).toBe("");
  });
});

describe("ai-domain-name-generator generate", () => {
  it("returns candidates with scores and domain suggestions", () => {
    const out = generate(BASE_INPUTS);
    expect(out.candidates.length).toBeGreaterThan(0);
    const c = out.candidates[0];
    expect(c.name).toBeTruthy();
    expect(c.slug).toBeTruthy();
    expect(c.technique).toBeTruthy();
    expect(c.style).toBe("modern");
    expect(c.score.total).toBeGreaterThanOrEqual(0);
    expect(c.domainSuggestions.length).toBe(9); // 8 TLDs + get prefix variant
    expect(c.socialHandles.length).toBe(5);
    expect(c.tagline).toBeTruthy();
  });
  it("dedupes case-insensitively", () => {
    const out = generate(BASE_INPUTS);
    const slugs = out.candidates.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("caps candidates at 80", () => {
    const out = generate(BASE_INPUTS);
    expect(out.candidates.length).toBeLessThanOrEqual(80);
  });
  it("returns empty when no keywords", () => {
    const out = generate({ ...BASE_INPUTS, keywords: [] });
    expect(out.candidates).toEqual([]);
    expect(out.count).toBe(0);
  });
  it("respects noHyphen filter", () => {
    // Build an input with a hyphen-containing keyword and confirm no
    // candidates contain hyphens (because we strip them in slug).
    const out = generate({ ...BASE_INPUTS, noHyphen: true });
    expect(out.candidates.every((c) => !/-/.test(c.slug))).toBe(true);
  });
  it("respects noNumber filter", () => {
    const out = generate({ ...BASE_INPUTS, noNumber: true });
    expect(out.candidates.every((c) => !/[0-9]/.test(c.slug))).toBe(true);
  });
  it("respects max length", () => {
    const out = generate({ ...BASE_INPUTS, maxLength: 8 });
    expect(out.candidates.every((c) => c.slug.length <= 8)).toBe(true);
  });
  it("respects max syllables", () => {
    const out = generate({ ...BASE_INPUTS, maxSyllables: 2 });
    expect(out.candidates.every((c) => countSyllables(c.slug) <= 2)).toBe(true);
  });
  it("sorts by score descending", () => {
    const out = generate(BASE_INPUTS);
    for (let i = 1; i < out.candidates.length; i++) {
      expect(out.candidates[i].score.total).toBeLessThanOrEqual(out.candidates[i - 1].score.total);
    }
  });
  it("uniqueCount <= count", () => {
    const out = generate(BASE_INPUTS);
    expect(out.uniqueCount).toBeLessThanOrEqual(out.count + out.candidates.length);
  });
});

describe("ai-domain-name-generator buildCandidate", () => {
  it("builds a complete candidate", () => {
    const c = buildCandidate("Nova", "invented", "modern");
    expect(c.name).toBe("Nova");
    expect(c.slug).toBe("nova");
    expect(c.technique).toBe("invented");
    expect(c.style).toBe("modern");
    expect(c.domainSuggestions.length).toBe(9);
    expect(c.socialHandles).toContain("@nova");
  });
});

describe("ai-domain-name-generator suggestDomains", () => {
  it("returns one per TLD plus the get-variant", () => {
    const out = suggestDomains("nova");
    expect(out.length).toBe(TLDS.length + 1);
    expect(out[0].domain).toBe("nova.com");
    expect(out[1].domain).toBe("nova.io");
    expect(out.some((d) => d.domain === "getnova.com")).toBe(true);
  });
  it("each suggestion has registrar-neutral URLs", () => {
    const out = suggestDomains("nova");
    for (const d of out) {
      expect(d.namecheapUrl).toContain("namecheap.com");
      expect(d.googleUrl).toContain("domains.google.com");
      expect(d.namecheapUrl).toContain(encodeURIComponent(d.domain));
    }
  });
  it("empty slug → empty list", () => {
    expect(suggestDomains("")).toEqual([]);
  });
});

describe("ai-domain-name-generator suggestSocialHandles", () => {
  it("returns handle patterns", () => {
    expect(suggestSocialHandles("nova")).toEqual([
      "@nova", "@getnova", "@novaapp", "@trynova", "@novahq",
    ]);
  });
  it("empty slug → empty list", () => {
    expect(suggestSocialHandles("")).toEqual([]);
  });
});

describe("ai-domain-name-generator suggestTagline", () => {
  it("returns a tagline per technique", () => {
    const techniques: Technique[] = [
      "compound", "portmanteau", "invented", "prefix", "suffix", "alliterative",
    ];
    for (const t of techniques) {
      const tag = suggestTagline("Nova", t);
      expect(tag).toContain("Nova");
    }
  });
});

describe("ai-domain-name-generator trademarkCaution + urls", () => {
  it("caution mentions USPTO and WIPO", () => {
    const t = trademarkCaution();
    expect(t).toContain("USPTO");
    expect(t).toContain("WIPO");
    expect(t).toContain("verify at checkout");
  });
  it("urls include USPTO, WIPO, Google", () => {
    const urls = trademarkSearchUrls("Nova");
    expect(urls).toHaveLength(3);
    expect(urls.some((u) => u.label === "USPTO TESS")).toBe(true);
    expect(urls.some((u) => u.label === "WIPO Global Brand Database")).toBe(true);
    expect(urls.some((u) => u.label === "Google (general)")).toBe(true);
    expect(urls.every((u) => u.url.startsWith("https://"))).toBe(true);
  });
});

describe("ai-domain-name-generator renderCsv", () => {
  it("renders header + rows", () => {
    const out = generate(BASE_INPUTS);
    const csv = renderCsv(out);
    expect(csv.split("\n")[0]).toContain("name,technique,style,score");
    expect(csv.split("\n")[0]).toContain("memorability");
    expect(csv.split("\n").length).toBe(out.candidates.length + 1);
  });
  it("empty output still has header", () => {
    const csv = renderCsv({ candidates: [], warnings: [], count: 0, uniqueCount: 0 });
    expect(csv).toContain("name,technique,style");
  });
});

describe("ai-domain-name-generator renderMarkdown", () => {
  it("contains inputs + caution", () => {
    const out = generate(BASE_INPUTS);
    const md = renderMarkdown(out, BASE_INPUTS);
    expect(md).toContain("# Domain name ideas");
    expect(md).toContain("Inputs");
    expect(md).toContain("Keywords:");
    expect(md).toContain("Trademark + availability caution");
  });
});

describe("ai-domain-name-generator renderJson", () => {
  it("produces valid JSON with inputs and output", () => {
    const out = generate(BASE_INPUTS);
    const json = renderJson(out, BASE_INPUTS);
    const parsed = JSON.parse(json);
    expect(parsed.inputs).toBeDefined();
    expect(parsed.output).toBeDefined();
    expect(parsed.generatedAt).toBeDefined();
  });
});

describe("ai-domain-name-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      keywords: ["nova"],
      style: "modern",
      topName: "Nova",
      topScore: 80,
      topDomain: "nova.com",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].topName).toBe("Nova");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        keywords: ["x"],
        style: "modern",
        topName: `N${i}`,
        topScore: i,
        topDomain: `n${i}.com`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, keywords: ["x"], style: "modern",
      topName: "X", topScore: 1, topDomain: "x.com",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-domain-name-generator favorites (localStorage)", () => {
  it("toggles on and off", () => {
    expect(loadFavorites()).toEqual([]);
    toggleFavorite("Nova");
    expect(loadFavorites()).toContain("nova");
    toggleFavorite("Nova");
    expect(loadFavorites()).toEqual([]);
  });
  it("clears", () => {
    toggleFavorite("Nova");
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

describe("ai-domain-name-generator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(BASE_INPUTS);
    expect(url).toContain("kw=ledger%2Cbooks");
    expect(url.startsWith("?")).toBe(true);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({
      ...BASE_INPUTS,
      noHyphen: true,
      noNumber: true,
    });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.slice(url.indexOf("?") + 1)}`;
    const p = parseShareUrl(hash);
    expect(p.inputs.keywords).toEqual(["ledger", "books"]);
    // style defaults to "modern" so it's omitted from the URL and undefined
    // in the parsed state — the UI fills in the default separately.
    expect(p.inputs.noHyphen).toBe(true);
    expect(p.inputs.noNumber).toBe(true);
  });
  it("parses non-default style", () => {
    const url = buildShareUrl({ ...BASE_INPUTS, style: "techy" });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.slice(url.indexOf("?") + 1)}`;
    const p = parseShareUrl(hash);
    expect(p.inputs.style).toBe("techy");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ inputs: {} });
  });
  it("filters unknown style", () => {
    const p = parseShareUrl("kw=nova&style=unknown");
    expect(p.inputs.style).toBeUndefined();
  });
});

describe("ai-domain-name-generator LLM prompt + parse", () => {
  it("buildLlmPrompt contains keywords + style + length range", () => {
    const prompt = buildLlmPrompt(BASE_INPUTS, ["Nova", "Ledgerio"]);
    expect(prompt).toContain("ledger");
    expect(prompt).toContain("books");
    expect(prompt).toContain("Modern");
    expect(prompt).toContain("4–12");
    expect(prompt).toContain("refinedNames");
    expect(prompt).toContain("Nova");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      refinedNames: [
        { name: "Novabooks", rationale: "compound of new + books" },
      ],
      taglineSuggestions: ["Books, reimagined."],
      notes: ["Try shorter roots."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedNames).toHaveLength(1);
      expect(r.result.refinedNames[0].name).toBe("Novabooks");
      expect(r.result.taglineSuggestions).toHaveLength(1);
      expect(r.result.notes).toHaveLength(1);
    }
  });
  it("renderLlmResult strips code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      refinedNames: [{ name: "X", rationale: "y" }],
      taglineSuggestions: [],
      notes: [],
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult errors on bad JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("parse");
  });
  it("renderLlmResult errors on non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = Style | Technique | NameInputs;
