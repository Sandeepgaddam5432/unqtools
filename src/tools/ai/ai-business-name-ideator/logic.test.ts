import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FAVORITES_KEY,
  FAVORITES_MAX,
  STYLE_LABELS,
  TECHNIQUE_LABELS,
  FIELD_HINTS,
  STYLE_POOLS,
  TLDS,
  GENERIC_KEYWORDS,
  validateInputs,
  capitalize,
  lcFirst,
  escapeRegex,
  slugify,
  parseKeywords,
  countSyllables,
  scoreLength,
  scoreSyllables,
  scorePronounceability,
  scoreUniqueness,
  scoreBrandability,
  buildCompound,
  buildPortmanteau,
  applyPrefix,
  applySuffix,
  buildInvented,
  buildAlliterative,
  buildCandidate,
  generate,
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
  type NameInputs,
  type Style,
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

const FULL_INPUTS: NameInputs = {
  keywords: ["ledger", "books", "honest"],
  industry: "accounting software",
  style: "modern",
  minLength: 4,
  maxLength: 12,
  maxSyllables: 4,
};

// ---------- Constants & hints ----------

describe("ai-business-name-ideator constants & hints", () => {
  it("has 4 styles and 6 techniques", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(4);
    expect(Object.keys(TECHNIQUE_LABELS)).toHaveLength(6);
  });
  it("has style pools for all 4 styles", () => {
    for (const s of Object.keys(STYLE_LABELS) as Style[]) {
      expect(STYLE_POOLS[s].prefixes.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].suffixes.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].realWords.length).toBeGreaterThan(0);
      expect(STYLE_POOLS[s].roots.length).toBeGreaterThan(0);
    }
  });
  it("has 6 TLDs configured", () => {
    expect(TLDS.length).toBe(6);
    expect(TLDS).toContain("com");
    expect(TLDS).toContain("io");
    expect(TLDS).toContain("ai");
  });
  it("has hints for all 6 input fields", () => {
    const keys = Object.keys(FIELD_HINTS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "keywords", "industry", "style",
        "minLength", "maxLength", "maxSyllables",
      ]),
    );
    expect(keys).toHaveLength(6);
    for (const k of keys) {
      expect(FIELD_HINTS[k as keyof NameInputs].hint.length).toBeGreaterThan(10);
      expect(FIELD_HINTS[k as keyof NameInputs].sample.length).toBeGreaterThan(0);
    }
  });
  it("respects standard history/favorites limits", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(FAVORITES_MAX).toBe(50);
  });
  it("has common generic keywords flagged", () => {
    expect(GENERIC_KEYWORDS.has("best")).toBe(true);
    expect(GENERIC_KEYWORDS.has("quality")).toBe(true);
    expect(GENERIC_KEYWORDS.has("modern")).toBe(true);
    expect(GENERIC_KEYWORDS.has("ledger")).toBe(false);
  });
});

// ---------- Helpers ----------

describe("ai-business-name-ideator helpers", () => {
  it("capitalizes first char only", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("Hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
  it("lowercases first char only", () => {
    expect(lcFirst("Hello")).toBe("hello");
    expect(lcFirst("hello")).toBe("hello");
    expect(lcFirst("")).toBe("");
  });
  it("escapes regex special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("(test)")).toBe("\\(test\\)");
  });
  it("slugifies strings", () => {
    expect(slugify("Ledger Books!")).toBe("ledgerbooks");
    expect(slugify("  Hello World  ")).toBe("helloworld");
    expect(slugify("123abc")).toBe("123abc"); // digits preserved
    expect(slugify("")).toBe("");
  });
  it("parses keywords from comma or space separated input", () => {
    expect(parseKeywords("ledger, books, honest")).toEqual(["ledger", "books", "honest"]);
    expect(parseKeywords("ledger books honest")).toEqual(["ledger", "books", "honest"]);
    expect(parseKeywords("Ledger, Books! 123")).toEqual(["ledger", "books"]);
    expect(parseKeywords("")).toEqual([]);
  });
  it("dedupes and caps keywords at 5", () => {
    const out = parseKeywords("a b c d e f g");
    expect(out.length).toBeLessThanOrEqual(5);
    const deduped = parseKeywords("ledger ledger ledger");
    expect(deduped).toEqual(["ledger"]);
  });
});

// ---------- Validation ----------

describe("ai-business-name-ideator validation", () => {
  it("flags missing keywords", () => {
    const w = validateInputs({ ...FULL_INPUTS, keywords: [] });
    expect(w.some((x) => x.includes("Add at least one keyword"))).toBe(true);
  });
  it("flags too many keywords", () => {
    const w = validateInputs({ ...FULL_INPUTS, keywords: ["a", "b", "c", "d", "e", "f"] });
    expect(w.some((x) => x.includes("More than 5 keywords"))).toBe(true);
  });
  it("flags generic keywords", () => {
    const w = validateInputs({ ...FULL_INPUTS, keywords: ["best", "quality"] });
    expect(w.some((x) => x.includes("generic"))).toBe(true);
  });
  it("flags missing industry", () => {
    const w = validateInputs({ ...FULL_INPUTS, industry: "" });
    expect(w.some((x) => x.includes("Add an industry"))).toBe(true);
  });
  it("flags minLength below 3", () => {
    const w = validateInputs({ ...FULL_INPUTS, minLength: 1 });
    expect(w.some((x) => x.includes("Minimum length below 3"))).toBe(true);
  });
  it("flags max < min", () => {
    const w = validateInputs({ ...FULL_INPUTS, minLength: 8, maxLength: 5 });
    expect(w.some((x) => x.includes("Max length is smaller than min length"))).toBe(true);
  });
  it("flags maxLength over 20", () => {
    const w = validateInputs({ ...FULL_INPUTS, maxLength: 25 });
    expect(w.some((x) => x.includes("Max length over 20"))).toBe(true);
  });
  it("flags maxSyllables below 2", () => {
    const w = validateInputs({ ...FULL_INPUTS, maxSyllables: 1 });
    expect(w.some((x) => x.includes("Max syllables below 2"))).toBe(true);
  });
  it("passes clean inputs with no warnings", () => {
    const w = validateInputs(FULL_INPUTS);
    expect(w).toEqual([]);
  });
});

// ---------- Scoring ----------

describe("ai-business-name-ideator syllable counting", () => {
  it("counts 2 syllables for 'apple'", () => {
    expect(countSyllables("apple")).toBe(2);
  });
  it("counts 2 syllables for 'ledger'", () => {
    expect(countSyllables("ledger")).toBe(2);
  });
  it("counts 2 syllables for 'water'", () => {
    expect(countSyllables("water")).toBe(2);
  });
  it("counts 1 syllable for 'house' (silent e)", () => {
    expect(countSyllables("house")).toBe(1);
  });
  it("counts 1 syllable for 'books'", () => {
    expect(countSyllables("books")).toBe(1);
  });
  it("returns 0 for empty", () => {
    expect(countSyllables("")).toBe(0);
  });
});

describe("ai-business-name-ideator length scoring", () => {
  it("awards full marks in the 5–9 sweet spot", () => {
    expect(scoreLength("apple")).toBe(25);
    expect(scoreLength("ledger")).toBe(25);
    expect(scoreLength("banana")).toBe(25);
  });
  it("deducts for short names", () => {
    expect(scoreLength("ab")).toBe(0);
    expect(scoreLength("abc")).toBe(18);
    expect(scoreLength("abcd")).toBe(22);
  });
  it("deducts for long names", () => {
    expect(scoreLength("abcdefghijklm")).toBe(10); // 13 chars
    expect(scoreLength("abcdefghijklmn")).toBe(5); // 14+ chars
  });
});

describe("ai-business-name-ideator syllable scoring", () => {
  it("awards full marks for 2–3 syllables", () => {
    expect(scoreSyllables("apple")).toBe(25); // 2 syl
    expect(scoreSyllables("banana")).toBe(25); // 3 syl
  });
  it("deducts for 4 syllables", () => {
    expect(scoreSyllables("watermelon")).toBe(17); // 4 syl
  });
});

describe("ai-business-name-ideator pronounceability scoring", () => {
  it("scores a pronounceable word near max", () => {
    expect(scorePronounceability("ledger")).toBeGreaterThan(15);
  });
  it("penalizes awkward consonant clusters", () => {
    expect(scorePronounceability("vbxzq")).toBeLessThan(scorePronounceability("velo"));
  });
  it("returns 0 for empty", () => {
    expect(scorePronounceability("")).toBe(0);
  });
});

describe("ai-business-name-ideator uniqueness scoring", () => {
  it("scores a common word very low", () => {
    expect(scoreUniqueness("apple")).toBeLessThan(10);
  });
  it("scores an invented word high", () => {
    expect(scoreUniqueness("velosia")).toBeGreaterThan(15);
  });
});

describe("ai-business-name-ideator brandability", () => {
  it("returns an object with all 4 components summing to total", () => {
    const s = scoreBrandability("ledger");
    expect(s).toHaveProperty("total");
    expect(s).toHaveProperty("lengthScore");
    expect(s).toHaveProperty("syllableScore");
    expect(s).toHaveProperty("pronounceabilityScore");
    expect(s).toHaveProperty("uniquenessScore");
    expect(s.lengthScore + s.syllableScore + s.pronounceabilityScore + s.uniquenessScore).toBe(s.total);
  });
  it("total is between 0 and 100", () => {
    expect(scoreBrandability("ledger").total).toBeGreaterThanOrEqual(0);
    expect(scoreBrandability("ledger").total).toBeLessThanOrEqual(100);
  });
  it("includes notes for low-scoring names", () => {
    const s = scoreBrandability("ab");
    expect(s.notes.length).toBeGreaterThan(0);
  });
});

// ---------- Techniques ----------

describe("ai-business-name-ideator techniques", () => {
  it("builds compounds by capitalizing the second word", () => {
    expect(buildCompound("ledger", "books")).toBe("ledgerBooks");
  });
  it("builds portmanteaus by blending", () => {
    expect(buildPortmanteau("ledger", "books")).toBe("ledoks");
  });
  it("applies prefixes", () => {
    expect(applyPrefix("no", "ledger")).toBe("noledger");
  });
  it("applies suffixes", () => {
    expect(applySuffix("ledger", "ify")).toBe("ledgerify");
  });
  it("builds invented names from root + suffix", () => {
    expect(buildInvented("nov", "ly")).toBe("novly");
  });
  it("builds alliterative names only when first letters match", () => {
    expect(buildAlliterative("ledger", "loop")).toBe("ledgerloop");
    expect(buildAlliterative("ledger", "books")).toBe("");
  });
  it("buildCandidate produces a full candidate with all fields", () => {
    const c = buildCandidate("Ledger", "compound", "modern");
    expect(c.name).toBe("Ledger");
    expect(c.technique).toBe("compound");
    expect(c.style).toBe("modern");
    expect(c.score.total).toBeGreaterThan(0);
    expect(c.domainSuggestions.length).toBeGreaterThan(0);
    expect(c.socialHandles.length).toBeGreaterThan(0);
    expect(c.tagline).toContain("Ledger");
  });
});

// ---------- Generate ----------

describe("ai-business-name-ideator generate", () => {
  it("produces at least 30 candidates from full inputs", () => {
    const out = generate(FULL_INPUTS);
    expect(out.candidates.length).toBeGreaterThanOrEqual(30);
  });
  it("produces zero candidates when keywords is empty", () => {
    const out = generate({ ...FULL_INPUTS, keywords: [] });
    expect(out.candidates.length).toBe(0);
    expect(out.count).toBe(0);
    expect(out.uniqueCount).toBe(0);
  });
  it("respects max length", () => {
    const out = generate({ ...FULL_INPUTS, maxLength: 8 });
    for (const c of out.candidates) {
      expect(c.name.length).toBeLessThanOrEqual(8);
    }
  });
  it("respects min length", () => {
    const out = generate({ ...FULL_INPUTS, minLength: 6 });
    for (const c of out.candidates) {
      expect(c.name.length).toBeGreaterThanOrEqual(6);
    }
  });
  it("respects max syllables", () => {
    const out = generate({ ...FULL_INPUTS, maxSyllables: 3 });
    for (const c of out.candidates) {
      expect(countSyllables(c.name)).toBeLessThanOrEqual(3);
    }
  });
  it("dedupes case-insensitively", () => {
    const out = generate(FULL_INPUTS);
    const lowerNames = out.candidates.map((c) => c.name.toLowerCase());
    expect(new Set(lowerNames).size).toBe(lowerNames.length);
  });
  it("sorts by score desc then name asc", () => {
    const out = generate(FULL_INPUTS);
    for (let i = 1; i < out.candidates.length; i++) {
      const prev = out.candidates[i - 1];
      const cur = out.candidates[i];
      if (prev.score.total === cur.score.total) {
        expect(prev.name.localeCompare(cur.name)).toBeLessThanOrEqual(0);
      } else {
        expect(prev.score.total).toBeGreaterThanOrEqual(cur.score.total);
      }
    }
  });
  it("caps candidates at 80", () => {
    const out = generate(FULL_INPUTS);
    expect(out.candidates.length).toBeLessThanOrEqual(80);
  });
  it("uniqueCount is at least candidates length", () => {
    const out = generate(FULL_INPUTS);
    expect(out.uniqueCount).toBeGreaterThanOrEqual(out.candidates.length);
  });
  it("produces candidates across multiple techniques", () => {
    const out = generate(FULL_INPUTS);
    const techniques = new Set(out.candidates.map((c) => c.technique));
    expect(techniques.size).toBeGreaterThanOrEqual(3);
  });
  it("includes warnings in output", () => {
    const out = generate({ ...FULL_INPUTS, keywords: ["best"] });
    expect(out.warnings.some((x) => x.includes("generic"))).toBe(true);
  });
});

// ---------- Domain / social / tagline suggestions ----------

describe("ai-business-name-ideator domain & social suggestions", () => {
  it("suggests domains for each TLD plus a get-prefixed .com", () => {
    const ds = suggestDomains("ledger");
    expect(ds.length).toBe(TLDS.length + 1);
    expect(ds.some((d) => d.domain === "ledger.com")).toBe(true);
    expect(ds.some((d) => d.domain === "ledger.io")).toBe(true);
    expect(ds.some((d) => d.domain === "getledger.com")).toBe(true);
  });
  it("builds a registrar search URL for each domain", () => {
    const ds = suggestDomains("ledger");
    for (const d of ds) {
      expect(d.registrarSearchUrl).toContain("namecheap.com");
      expect(d.registrarSearchUrl).toContain(encodeURIComponent(d.domain));
    }
  });
  it("returns empty array for empty slug", () => {
    expect(suggestDomains("")).toEqual([]);
  });
  it("suggests 5 social-handle patterns", () => {
    const h = suggestSocialHandles("ledger");
    expect(h.length).toBe(5);
    expect(h[0]).toBe("@ledger");
    expect(h.some((x) => x === "@getledger")).toBe(true);
  });
  it("suggests a tagline per technique", () => {
    expect(suggestTagline("Ledger", "compound")).toContain("Ledger");
    expect(suggestTagline("Ledger", "portmanteau")).toContain("Ledger");
    expect(suggestTagline("Ledger", "invented")).toContain("Ledger");
    expect(suggestTagline("Ledger", "prefix")).toContain("Ledger");
    expect(suggestTagline("Ledger", "suffix")).toContain("Ledger");
    expect(suggestTagline("Ledger", "alliterative")).toContain("Ledger");
  });
});

// ---------- Trademark caution ----------

describe("ai-business-name-ideator trademark caution", () => {
  it("returns a non-empty caution string mentioning USPTO and WIPO", () => {
    const c = trademarkCaution();
    expect(c.length).toBeGreaterThan(50);
    expect(c).toContain("USPTO");
    expect(c).toContain("WIPO");
  });
  it("builds search URLs for USPTO, WIPO, and Google", () => {
    const urls = trademarkSearchUrls("Ledger");
    expect(urls.length).toBe(3);
    expect(urls.some((u) => u.label === "USPTO TESS")).toBe(true);
    expect(urls.some((u) => u.label === "WIPO Global Brand Database")).toBe(true);
    expect(urls.some((u) => u.label === "Google (general)")).toBe(true);
    for (const u of urls) {
      expect(u.url).toContain("ledger");
    }
  });
});

// ---------- Render ----------

describe("ai-business-name-ideator render", () => {
  const out = generate(FULL_INPUTS);
  it("renders CSV with a header row", () => {
    const csv = renderCsv(out);
    expect(csv.split("\n")[0]).toContain("name,technique,style,score");
    expect(csv.split("\n").length).toBe(out.candidates.length + 1);
  });
  it("renders Markdown with title and inputs", () => {
    const md = renderMarkdown(out, FULL_INPUTS);
    expect(md).toContain("# Business name ideas");
    expect(md).toContain("accounting software");
    expect(md).toContain("## Top candidates");
    expect(md).toContain("Trademark caution");
  });
  it("renders JSON that round-trips", () => {
    const json = renderJson(out, FULL_INPUTS);
    const parsed = JSON.parse(json);
    expect(parsed.inputs).toEqual(FULL_INPUTS);
    expect(parsed.output.candidates.length).toBe(out.candidates.length);
    expect(parsed.generatedAt).toBeTruthy();
  });
});

// ---------- History & favorites ----------

describe("ai-business-name-ideator history & favorites", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
    expect(loadFavorites()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    const entry: HistoryEntry = {
      ts: Date.now(),
      keywords: ["ledger"],
      industry: "accounting",
      style: "modern",
      topName: "Ledgerloop",
      topScore: 88,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].topName).toBe("Ledgerloop");
  });
  it("caps history at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i,
        keywords: ["k"],
        industry: "x",
        style: "modern",
        topName: `name${i}`,
        topScore: i,
      });
    }
    expect(loadHistory().length).toBe(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, keywords: [], industry: "", style: "modern", topName: "x", topScore: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("toggles favorites on and off", () => {
    expect(loadFavorites()).toEqual([]);
    toggleFavorite("Ledger");
    expect(loadFavorites()).toEqual(["ledger"]);
    toggleFavorite("Ledger");
    expect(loadFavorites()).toEqual([]);
  });
  it("toggles multiple favorites", () => {
    toggleFavorite("Ledger");
    toggleFavorite("Books");
    toggleFavorite("Honest");
    expect(loadFavorites().length).toBe(3);
  });
  it("clears favorites", () => {
    toggleFavorite("Ledger");
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
  it("does not throw when localStorage is unavailable", () => {
    (globalThis as Record<string, unknown>).localStorage = undefined;
    expect(() => loadHistory()).not.toThrow();
    expect(() => loadFavorites()).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
    expect(() => clearFavorites()).not.toThrow();
  });
});

// ---------- Share URL ----------

describe("ai-business-name-ideator share URL", () => {
  it("builds a URL with encoded inputs", () => {
    const url = buildShareUrl(FULL_INPUTS);
    expect(url).toContain("kw=ledger");
    expect(url).toContain("ind=accounting");
  });
  it("omits default values from the URL", () => {
    const url = buildShareUrl({ ...FULL_INPUTS, style: "modern", minLength: 4, maxLength: 12, maxSyllables: 4 });
    // style modern is default — should not be in URL
    expect(url).not.toContain("style=");
    expect(url).not.toContain("min=");
    expect(url).not.toContain("max=");
    expect(url).not.toContain("syl=");
  });
  it("parses a share URL back into inputs", () => {
    const url = buildShareUrl({ ...FULL_INPUTS, style: "playful" });
    const state = parseShareUrl(url);
    expect(state.inputs.keywords).toEqual(["ledger", "books", "honest"]);
    expect(state.inputs.industry).toBe("accounting software");
    expect(state.inputs.style).toBe("playful");
  });
  it("returns empty state for empty hash", () => {
    const state = parseShareUrl("");
    expect(state.inputs).toEqual({});
  });
});

// ---------- LLM ----------

describe("ai-business-name-ideator LLM", () => {
  it("builds a prompt mentioning inputs", () => {
    const sample = ["Ledger", "Ledgerloop", "Novio"];
    const prompt = buildLlmPrompt(FULL_INPUTS, sample);
    expect(prompt).toContain("Inputs:");
    expect(prompt).toContain("Keywords:");
    expect(prompt).toContain("accounting software");
    expect(prompt).toContain("Ledgerloop");
    expect(prompt).toContain("JSON");
  });
  it("parses a valid LLM JSON response", () => {
    const raw = JSON.stringify({
      refinedNames: [
        { name: "Ledgify", rationale: "Short, brandable, evokes 'ledger'." },
      ],
      taglineSuggestions: ["Ledgify: accounting, simplified."],
      notes: ["Consider testing 'Ledgify' against existing brands."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedNames).toHaveLength(1);
      expect(r.result.refinedNames[0].name).toBe("Ledgify");
      expect(r.result.taglineSuggestions).toHaveLength(1);
      expect(r.result.notes).toHaveLength(1);
    }
  });
  it("rejects invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("rejects non-object JSON", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({ refinedNames: [], taglineSuggestions: [], notes: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("tolerates missing fields", () => {
    const r = renderLlmResult(JSON.stringify({}));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedNames).toEqual([]);
      expect(r.result.taglineSuggestions).toEqual([]);
      expect(r.result.notes).toEqual([]);
    }
  });
});
