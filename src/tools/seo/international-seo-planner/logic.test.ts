import { describe, it, expect, beforeEach } from "vitest";
import {
  CCTLD_TABLE,
  COUNTRY_PRESETS,
  STRATEGY_COMPARISON,
  normalizeText,
  normalizeLower,
  parseCountries,
  parseLanguageMapping,
  isValidLanguageCode,
  isValidCountryCode,
  isValidHreflangFormat,
  lookupCctld,
  buildCountryUrl,
  buildHreflangValue,
  renderHreflangTag,
  renderXDefaultTag,
  buildPlans,
  pickXDefaultUrl,
  generateHreflangTags,
  validateHreflang,
  filterPlans,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type UrlStructure,
  type CountryTarget,
  type LocaleEntry,
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

describe("international-seo-planner constants", () => {
  it("has 20+ ccTLD entries", () => {
    expect(Object.keys(CCTLD_TABLE).length).toBeGreaterThanOrEqual(20);
  });
  it("has correct ccTLD mappings", () => {
    expect(CCTLD_TABLE.US).toBe("com");
    expect(CCTLD_TABLE.GB).toBe("co.uk");
    expect(CCTLD_TABLE.DE).toBe("de");
    expect(CCTLD_TABLE.JP).toBe("co.jp");
    expect(CCTLD_TABLE.BR).toBe("com.br");
  });
  it("has 20+ country presets", () => {
    expect(COUNTRY_PRESETS.length).toBeGreaterThanOrEqual(20);
  });
  it("has 3 strategy rows", () => {
    expect(STRATEGY_COMPARISON).toHaveLength(3);
    expect(STRATEGY_COMPARISON.map((s) => s.strategy)).toEqual(["cctld", "subdomain", "subdirectory"]);
  });
  it("each strategy row has pros and cons", () => {
    for (const s of STRATEGY_COMPARISON) {
      expect(s.pros.length).toBeGreaterThan(0);
      expect(s.cons.length).toBeGreaterThan(0);
      expect(s.seoImpact.length).toBeGreaterThan(10);
    }
  });
});

describe("international-seo-planner normalize", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("normalizeLower lowercases", () => {
    expect(normalizeLower("  Hello WORLD  ")).toBe("hello world");
  });
  it("handles empty inputs", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeLower("")).toBe("");
  });
});

describe("international-seo-planner parseCountries", () => {
  it("parses country:code lines", () => {
    const out = parseCountries("United States:US\nGermany:DE");
    expect(out).toEqual([
      { name: "United States", code: "US" },
      { name: "Germany", code: "DE" },
    ]);
  });
  it("uppercases country code", () => {
    const out = parseCountries("France:fr");
    expect(out[0].code).toBe("FR");
  });
  it("skips duplicate country codes", () => {
    const out = parseCountries("Germany:DE\nDeutschland:DE");
    expect(out).toHaveLength(1);
  });
  it("skips blank lines and lines without colon", () => {
    const out = parseCountries("\n\nGermany:DE\nNoColonLine\n");
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe("DE");
  });
  it("returns empty for empty input", () => {
    expect(parseCountries("")).toEqual([]);
  });
});

describe("international-seo-planner parseLanguageMapping", () => {
  it("parses CSV of CountryCode:LanguageCode", () => {
    const out = parseLanguageMapping("US:en, GB:en, DE:de, FR:fr");
    expect(out).toEqual([
      { countryCode: "US", languageCode: "en" },
      { countryCode: "GB", languageCode: "en" },
      { countryCode: "DE", languageCode: "de" },
      { countryCode: "FR", languageCode: "fr" },
    ]);
  });
  it("handles newline and semicolon separators", () => {
    const out = parseLanguageMapping("US:en\nGB:en;DE:de");
    expect(out).toHaveLength(3);
  });
  it("uppercases country code, lowercases language", () => {
    const out = parseLanguageMapping("us:EN");
    expect(out[0]).toEqual({ countryCode: "US", languageCode: "en" });
  });
  it("skips duplicates", () => {
    const out = parseLanguageMapping("US:en, US:es");
    expect(out).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseLanguageMapping("")).toEqual([]);
  });
});

describe("international-seo-planner validators", () => {
  it("isValidLanguageCode accepts 2 lowercase letters", () => {
    expect(isValidLanguageCode("en")).toBe(true);
    expect(isValidLanguageCode("de")).toBe(true);
    expect(isValidLanguageCode("EN")).toBe(true); // normalized
  });
  it("isValidLanguageCode rejects bad inputs", () => {
    expect(isValidLanguageCode("")).toBe(false);
    expect(isValidLanguageCode("eng")).toBe(false);
    expect(isValidLanguageCode("e1")).toBe(false);
  });
  it("isValidCountryCode accepts 2 uppercase letters", () => {
    expect(isValidCountryCode("US")).toBe(true);
    expect(isValidCountryCode("DE")).toBe(true);
    expect(isValidCountryCode("us")).toBe(true); // normalized
  });
  it("isValidCountryCode rejects bad inputs", () => {
    expect(isValidCountryCode("")).toBe(false);
    expect(isValidCountryCode("USA")).toBe(false);
    expect(isValidCountryCode("U1")).toBe(false);
  });
  it("isValidHreflangFormat accepts xx-XX", () => {
    expect(isValidHreflangFormat("en-US")).toBe(true);
    expect(isValidHreflangFormat("de-DE")).toBe(true);
  });
  it("isValidHreflangFormat rejects bad formats", () => {
    expect(isValidHreflangFormat("en")).toBe(false);
    expect(isValidHreflangFormat("EN-us")).toBe(false);
    expect(isValidHreflangFormat("")).toBe(false);
  });
});

describe("international-seo-planner lookupCctld", () => {
  it("returns known ccTLDs", () => {
    expect(lookupCctld("US")).toBe("com");
    expect(lookupCctld("GB")).toBe("co.uk");
    expect(lookupCctld("DE")).toBe("de");
    expect(lookupCctld("JP")).toBe("co.jp");
    expect(lookupCctld("AU")).toBe("com.au");
  });
  it("falls back to .com for unknown countries", () => {
    expect(lookupCctld("ZZ")).toBe("com");
    expect(lookupCctld("")).toBe("com");
  });
});

describe("international-seo-planner buildCountryUrl", () => {
  const us: CountryTarget = { name: "United States", code: "US" };
  const de: CountryTarget = { name: "Germany", code: "DE" };
  const fr: CountryTarget = { name: "France", code: "FR" };

  it("ccTLD strategy returns example.<tld>/", () => {
    expect(buildCountryUrl("example.com", de, "de", "cctld")).toBe("https://example.de/");
    expect(buildCountryUrl("example.com", fr, "fr", "cctld")).toBe("https://example.fr/");
  });
  it("subdomain strategy returns <cc>.domain/", () => {
    expect(buildCountryUrl("example.com", de, "de", "subdomain")).toBe("https://de.example.com/");
  });
  it("subdirectory strategy returns domain/<lang>/", () => {
    expect(buildCountryUrl("example.com", de, "de", "subdirectory")).toBe("https://example.com/de/");
  });
  it("uses example.com when mainDomain empty", () => {
    expect(buildCountryUrl("", de, "de", "subdirectory")).toBe("https://example.com/de/");
  });
});

describe("international-seo-planner buildHreflangValue + renderHreflangTag", () => {
  it("builds hreflang value as xx-XX", () => {
    expect(buildHreflangValue("en", "US")).toBe("en-US");
    expect(buildHreflangValue("DE", "de")).toBe("de-DE"); // normalizes language case
  });
  it("renders hreflang link tag", () => {
    expect(renderHreflangTag("en-US", "https://example.com/us/")).toBe(
      '<link rel="alternate" hreflang="en-US" href="https://example.com/us/" />',
    );
  });
  it("renders x-default tag", () => {
    expect(renderXDefaultTag("https://example.com/")).toBe(
      '<link rel="alternate" hreflang="x-default" href="https://example.com/" />',
    );
  });
});

describe("international-seo-planner buildPlans", () => {
  const countries: CountryTarget[] = [
    { name: "United States", code: "US" },
    { name: "Germany", code: "DE" },
    { name: "France", code: "FR" },
  ];
  const langs: LocaleEntry[] = [
    { countryCode: "US", languageCode: "en" },
    { countryCode: "DE", languageCode: "de" },
    { countryCode: "FR", languageCode: "fr" },
  ];

  it("builds plans for subdirectory strategy", () => {
    const plans = buildPlans("example.com", countries, langs, "subdirectory");
    expect(plans).toHaveLength(3);
    expect(plans[0].url).toBe("https://example.com/en/");
    expect(plans[0].hreflang).toBe("en-US");
    expect(plans[0].hreflangTag).toContain('hreflang="en-US"');
    expect(plans[1].url).toBe("https://example.com/de/");
    expect(plans[1].hreflang).toBe("de-DE");
  });
  it("falls back to 'en' when language mapping missing", () => {
    const plans = buildPlans("example.com", [countries[0]], [], "subdirectory");
    expect(plans[0].languageCode).toBe("en");
    expect(plans[0].hreflang).toBe("en-US");
  });
  it("builds plans for subdomain strategy", () => {
    const plans = buildPlans("example.com", countries.slice(1), langs.slice(1), "subdomain");
    expect(plans[0].url).toBe("https://de.example.com/");
    expect(plans[1].url).toBe("https://fr.example.com/");
  });
  it("builds plans for ccTLD strategy", () => {
    const plans = buildPlans("example.com", countries.slice(1), langs.slice(1), "cctld");
    expect(plans[0].url).toBe("https://example.de/");
    expect(plans[1].url).toBe("https://example.fr/");
  });
});

describe("international-seo-planner pickXDefaultUrl", () => {
  it("returns first plan URL when plans exist", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "en" }],
      "subdirectory");
    expect(pickXDefaultUrl(plans, "example.com")).toBe("https://example.com/en/");
  });
  it("returns main domain URL when no plans", () => {
    expect(pickXDefaultUrl([], "example.com")).toBe("https://example.com/");
  });
  it("falls back to example.com when no plans and no domain", () => {
    expect(pickXDefaultUrl([], "")).toBe("https://example.com/");
  });
});

describe("international-seo-planner generateHreflangTags", () => {
  it("includes x-default at the end", () => {
    const plans = buildPlans("example.com",
      [
        { name: "US", code: "US" },
        { name: "DE", code: "DE" },
      ],
      [
        { countryCode: "US", languageCode: "en" },
        { countryCode: "DE", languageCode: "de" },
      ],
      "subdirectory");
    const tags = generateHreflangTags(plans, "example.com");
    expect(tags).toHaveLength(3);
    expect(tags[0].hreflang).toBe("en-US");
    expect(tags[1].hreflang).toBe("de-DE");
    expect(tags[2].hreflang).toBe("x-default");
    expect(tags[2].url).toBe("https://example.com/en/");
  });
  it("handles empty plans", () => {
    const tags = generateHreflangTags([], "example.com");
    expect(tags).toHaveLength(1);
    expect(tags[0].hreflang).toBe("x-default");
    expect(tags[0].url).toBe("https://example.com/");
  });
});

describe("international-seo-planner validateHreflang", () => {
  it("returns no issues for valid plans", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "en" }],
      "subdirectory");
    expect(validateHreflang(plans)).toEqual([]);
  });
  it("flags invalid language code", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "english" }],
      "subdirectory");
    const issues = validateHreflang(plans);
    expect(issues.some((i) => i.type === "invalid-language")).toBe(true);
  });
  it("flags invalid country code", () => {
    // Build a malformed plan manually
    const plans = [{
      country: { name: "Bad", code: "USA" },
      languageCode: "en",
      url: "https://example.com/en/",
      hreflang: "en-USA",
      hreflangTag: '<link rel="alternate" hreflang="en-USA" href="https://example.com/en/" />',
    }];
    const issues = validateHreflang(plans);
    expect(issues.some((i) => i.type === "invalid-region")).toBe(true);
    expect(issues.some((i) => i.type === "invalid-format")).toBe(true);
  });
});

describe("international-seo-planner filterPlans", () => {
  it("filters by country name", () => {
    const plans = buildPlans("example.com",
      [
        { name: "United States", code: "US" },
        { name: "Germany", code: "DE" },
      ],
      [
        { countryCode: "US", languageCode: "en" },
        { countryCode: "DE", languageCode: "de" },
      ],
      "subdirectory");
    expect(filterPlans(plans, "Germany")).toHaveLength(1);
    expect(filterPlans(plans, "Germany")[0].country.code).toBe("DE");
  });
  it("filters by country code", () => {
    const plans = buildPlans("example.com",
      [
        { name: "United States", code: "US" },
        { name: "Germany", code: "DE" },
      ],
      [
        { countryCode: "US", languageCode: "en" },
        { countryCode: "DE", languageCode: "de" },
      ],
      "subdirectory");
    expect(filterPlans(plans, "US")).toHaveLength(1);
  });
  it("returns all for empty query", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "en" }],
      "subdirectory");
    expect(filterPlans(plans, "")).toHaveLength(1);
  });
});

describe("international-seo-planner computeStats", () => {
  it("computes summary stats", () => {
    const plans = buildPlans("example.com",
      [
        { name: "US", code: "US" },
        { name: "DE", code: "DE" },
      ],
      [
        { countryCode: "US", languageCode: "en" },
        { countryCode: "DE", languageCode: "de" },
      ],
      "subdirectory");
    const tags = generateHreflangTags(plans, "example.com");
    const issues = validateHreflang(plans);
    const stats = computeStats(plans, tags, issues);
    expect(stats.totalCountries).toBe(2);
    expect(stats.totalHreflangTags).toBe(3);
    expect(stats.validationIssues).toBe(0);
    expect(stats.invalidLanguages).toBe(0);
    expect(stats.invalidRegions).toBe(0);
  });
});

describe("international-seo-planner renderText", () => {
  it("renders full text report", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "en" }],
      "subdirectory");
    const tags = generateHreflangTags(plans, "example.com");
    const issues = validateHreflang(plans);
    const text = renderText(plans, tags, issues, "example.com", "subdirectory");
    expect(text).toContain("International SEO Plan");
    expect(text).toContain("Main domain: example.com");
    expect(text).toContain("Strategy: subdirectory");
    expect(text).toContain("https://example.com/en/");
    expect(text).toContain("en-US");
    expect(text).toContain("x-default");
    expect(text).toContain("Validation: OK");
  });
  it("renders validation issues when present", () => {
    const plans = buildPlans("example.com",
      [{ name: "US", code: "US" }],
      [{ countryCode: "US", languageCode: "english" }],
      "subdirectory");
    const issues = validateHreflang(plans);
    const text = renderText(plans, generateHreflangTags(plans, "example.com"), issues, "example.com", "subdirectory");
    expect(text).toContain(`Validation issues (${issues.length})`);
    expect(text).toContain("invalid-language");
  });
});

describe("international-seo-planner renderCsv", () => {
  it("renders CSV header", () => {
    expect(renderCsv([])).toBe("country_name,country_code,language,url,hreflang,hreflang_tag");
  });
  it("renders plan rows", () => {
    const plans = buildPlans("example.com",
      [{ name: "United States", code: "US" }],
      [{ countryCode: "US", languageCode: "en" }],
      "subdirectory");
    const csv = renderCsv(plans);
    expect(csv).toContain("United States,US,en,https://example.com/en/,en-US");
    expect(csv).toContain('hreflang');
  });
});

describe("international-seo-planner history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mainDomain: "example.com", strategy: "subdirectory", totalCountries: 3, totalTags: 4, issues: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mainDomain: "example.com", strategy: "cctld", totalCountries: 1, totalTags: 2, issues: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mainDomain: "x", strategy: "cctld", totalCountries: 1, totalTags: 1, issues: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("international-seo-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("example.com", "United States:US", "subdirectory", "US:en");
    expect(url).toContain("domain=example.com");
    expect(url).toContain("strategy=subdirectory");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("domain=example.com&countries=United+States%3AUS&strategy=subdirectory&langs=US%3Aen");
    expect(p.mainDomain).toBe("example.com");
    expect(p.countriesText).toBe("United States:US");
    expect(p.strategy).toBe("subdirectory");
    expect(p.languagesText).toBe("US:en");
  });
  it("defaults strategy to subdirectory on empty hash", () => {
    expect(parseShareUrl("")).toEqual({ mainDomain: "", countriesText: "", strategy: "subdirectory", languagesText: "" });
  });
  it("falls back to subdirectory on unknown strategy", () => {
    const p = parseShareUrl("strategy=unknown");
    expect(p.strategy).toBe("subdirectory");
  });
});

// Suppress unused-import lint
export type _Unused = UrlStructure;
