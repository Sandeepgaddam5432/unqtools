import { describe, it, expect, beforeEach } from "vitest";
import {
  TRANSLATIONS,
  SUPPORTED_LANGUAGES,
  SPELLING_VARIANTS,
  LOCALE_CURRENCY,
  GOOGLE_DOMAIN_BY_CC,
  LOCALE_PRESETS,
  normalizeText,
  normalizeWord,
  parseLocales,
  parseModifiers,
  isValidLocale,
  detectLanguage,
  detectCountry,
  lookupCurrency,
  lookupGoogleDomain,
  applySpellingVariant,
  translateWord,
  translateBaseKeyword,
  combineKeyword,
  buildGoogleUrl,
  generateForLocale,
  generateAllReports,
  flattenVariants,
  filterByLocale,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LocaleTarget,
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

describe("locale-keyword-researcher constants", () => {
  it("has 50+ base words", () => {
    expect(Object.keys(TRANSLATIONS).length).toBeGreaterThanOrEqual(50);
  });
  it("has translations for all 10 languages", () => {
    const keys = Object.keys(TRANSLATIONS);
    for (const lang of SUPPORTED_LANGUAGES) {
      const allHave = keys.every((k) => TRANSLATIONS[k][lang] !== undefined);
      expect(allHave).toBe(true);
    }
  });
  it("supports 10 languages", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(10);
    expect(SUPPORTED_LANGUAGES).toContain("en");
    expect(SUPPORTED_LANGUAGES).toContain("ru");
  });
  it("has spelling variants for en-US and en-GB", () => {
    expect(SPELLING_VARIANTS["en-US"]).toBeDefined();
    expect(SPELLING_VARIANTS["en-GB"]).toBeDefined();
    expect(SPELLING_VARIANTS["en-US"].colour).toBe("color");
    expect(SPELLING_VARIANTS["en-GB"].color).toBe("colour");
  });
  it("has 15+ locale currency mappings", () => {
    expect(Object.keys(LOCALE_CURRENCY).length).toBeGreaterThanOrEqual(15);
    expect(LOCALE_CURRENCY["en-US"]).toBe("USD");
    expect(LOCALE_CURRENCY["de-DE"]).toBe("EUR");
    expect(LOCALE_CURRENCY["ja-JP"]).toBe("JPY");
  });
  it("has 15+ Google domains", () => {
    expect(Object.keys(GOOGLE_DOMAIN_BY_CC).length).toBeGreaterThanOrEqual(15);
    expect(GOOGLE_DOMAIN_BY_CC.US).toBe("google.com");
    expect(GOOGLE_DOMAIN_BY_CC.DE).toBe("google.de");
    expect(GOOGLE_DOMAIN_BY_CC.JP).toBe("google.co.jp");
  });
  it("has 12 locale presets", () => {
    expect(LOCALE_PRESETS).toHaveLength(12);
    expect(LOCALE_PRESETS.some((p) => p.locale === "en-US")).toBe(true);
    expect(LOCALE_PRESETS.some((p) => p.locale === "hi-IN")).toBe(true);
  });
});

describe("locale-keyword-researcher normalize", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  buy   shoes  ")).toBe("buy shoes");
  });
  it("normalizeWord lowercases", () => {
    expect(normalizeWord("  BUY  ")).toBe("buy");
  });
  it("handles empty inputs", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeWord("")).toBe("");
  });
});

describe("locale-keyword-researcher parseLocales", () => {
  it("parses locale list", () => {
    const out = parseLocales("en-US\nde-DE\nfr-FR");
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ language: "en", country: "US", locale: "en-US" });
    expect(out[1]).toEqual({ language: "de", country: "DE", locale: "de-DE" });
  });
  it("handles comma and semicolon separators", () => {
    const out = parseLocales("en-US, de-DE; fr-FR");
    expect(out).toHaveLength(3);
  });
  it("skips duplicate locales", () => {
    const out = parseLocales("en-US\nen-US");
    expect(out).toHaveLength(1);
  });
  it("skips invalid formats", () => {
    const out = parseLocales("english-US\nen\nen-usa\nen-US");
    expect(out).toHaveLength(1);
    expect(out[0].locale).toBe("en-US");
  });
  it("returns empty for empty input", () => {
    expect(parseLocales("")).toEqual([]);
  });
});

describe("locale-keyword-researcher parseModifiers", () => {
  it("parses comma-separated", () => {
    expect(parseModifiers("online, near me, cheap, best")).toEqual(["online", "near me", "cheap", "best"]);
  });
  it("handles newlines", () => {
    expect(parseModifiers("online\nnear me")).toEqual(["online", "near me"]);
  });
  it("skips duplicates and blanks", () => {
    expect(parseModifiers("online, online, , best")).toEqual(["online", "best"]);
  });
  it("returns empty for empty input", () => {
    expect(parseModifiers("")).toEqual([]);
  });
});

describe("locale-keyword-researcher validators", () => {
  it("isValidLocale accepts valid", () => {
    expect(isValidLocale("en-US")).toBe(true);
    expect(isValidLocale("de-DE")).toBe(true);
  });
  it("isValidLocale rejects bad", () => {
    expect(isValidLocale("")).toBe(false);
    expect(isValidLocale("english-US")).toBe(false);
    expect(isValidLocale("en-us")).toBe(false);
  });
  it("detectLanguage extracts first 2 chars", () => {
    expect(detectLanguage("en-US")).toBe("en");
    expect(detectLanguage("DE-DE")).toBe("de");
  });
  it("detectCountry extracts last 2 chars", () => {
    expect(detectCountry("en-US")).toBe("US");
    expect(detectCountry("en-us")).toBe("US");
  });
});

describe("locale-keyword-researcher lookups", () => {
  it("lookupCurrency returns known currencies", () => {
    expect(lookupCurrency("en-US")).toBe("USD");
    expect(lookupCurrency("en-GB")).toBe("GBP");
    expect(lookupCurrency("de-DE")).toBe("EUR");
    expect(lookupCurrency("ja-JP")).toBe("JPY");
    expect(lookupCurrency("ru-RU")).toBe("RUB");
  });
  it("lookupCurrency defaults to USD", () => {
    expect(lookupCurrency("xx-XX")).toBe("USD");
  });
  it("lookupGoogleDomain returns known domains", () => {
    expect(lookupGoogleDomain("US")).toBe("google.com");
    expect(lookupGoogleDomain("DE")).toBe("google.de");
    expect(lookupGoogleDomain("JP")).toBe("google.co.jp");
    expect(lookupGoogleDomain("BR")).toBe("google.com.br");
  });
  it("lookupGoogleDomain defaults to google.com", () => {
    expect(lookupGoogleDomain("ZZ")).toBe("google.com");
  });
});

describe("locale-keyword-researcher applySpellingVariant", () => {
  it("converts colour → color for en-US", () => {
    expect(applySpellingVariant("colour", "en-US")).toBe("color");
  });
  it("converts color → colour for en-GB", () => {
    expect(applySpellingVariant("color", "en-GB")).toBe("colour");
  });
  it("returns word unchanged if no variant", () => {
    expect(applySpellingVariant("shoes", "en-US")).toBe("shoes");
    expect(applySpellingVariant("color", "de-DE")).toBe("color");
  });
});

describe("locale-keyword-researcher translateWord", () => {
  it("translates 'buy' to multiple languages", () => {
    expect(translateWord("buy", "en")).toBe("buy");
    expect(translateWord("buy", "de")).toBe("kaufen");
    expect(translateWord("buy", "fr")).toBe("acheter");
    expect(translateWord("buy", "es")).toBe("comprar");
    expect(translateWord("buy", "ja")).toBe("買う");
  });
  it("translates 'shoes' across languages", () => {
    expect(translateWord("shoes", "de")).toBe("schuhe");
    expect(translateWord("shoes", "fr")).toBe("chaussures");
    expect(translateWord("shoes", "es")).toBe("zapatos");
    expect(translateWord("shoes", "ru")).toBe("обувь");
  });
  it("translates multi-word phrase 'free shipping'", () => {
    expect(translateWord("free shipping", "de")).toBe("kostenloser versand");
    expect(translateWord("free shipping", "fr")).toBe("livraison gratuite");
  });
  it("translates 'near me'", () => {
    expect(translateWord("near me", "de")).toBe("in der nähe");
    expect(translateWord("near me", "ja")).toBe("近く");
  });
  it("returns null for untranslatable words", () => {
    expect(translateWord("xyzabc", "de")).toBeNull();
    expect(translateWord("", "en")).toBeNull();
  });
  it("normalizes case", () => {
    expect(translateWord("BUY", "de")).toBe("kaufen");
    expect(translateWord("Buy", "de")).toBe("kaufen");
  });
});

describe("locale-keyword-researcher translateBaseKeyword", () => {
  it("translates 'buy shoes' to German", () => {
    const r = translateBaseKeyword("buy shoes", "de", "de-DE");
    expect(r.translated).toBe("kaufen schuhe");
    expect(r.untranslatable).toEqual([]);
  });
  it("flags untranslatable words", () => {
    const r = translateBaseKeyword("buy widget", "de", "de-DE");
    expect(r.translated).toBe("kaufen widget");
    expect(r.untranslatable).toEqual(["widget"]);
  });
  it("applies spelling variants", () => {
    const r = translateBaseKeyword("color shoes", "en", "en-GB");
    expect(r.translated).toBe("colour shoes");
  });
  it("handles empty keyword", () => {
    const r = translateBaseKeyword("", "de", "de-DE");
    expect(r.translated).toBe("");
    expect(r.untranslatable).toEqual([]);
  });
});

describe("locale-keyword-researcher combineKeyword", () => {
  it("combines base and modifier", () => {
    expect(combineKeyword("buy shoes", "online")).toBe("buy shoes online");
  });
  it("returns base if modifier empty", () => {
    expect(combineKeyword("buy shoes", "")).toBe("buy shoes");
  });
  it("returns modifier if base empty", () => {
    expect(combineKeyword("", "online")).toBe("online");
  });
});

describe("locale-keyword-researcher buildGoogleUrl", () => {
  it("builds US Google URL", () => {
    expect(buildGoogleUrl("buy shoes", "US")).toBe("https://www.google.com/search?q=buy%20shoes");
  });
  it("builds DE Google URL", () => {
    expect(buildGoogleUrl("kaufen schuhe", "DE")).toContain("google.de");
  });
  it("falls back to google.com for unknown country", () => {
    expect(buildGoogleUrl("test", "ZZ")).toContain("google.com");
  });
});

describe("locale-keyword-researcher generateForLocale", () => {
  const locale: LocaleTarget = { language: "de", country: "DE", locale: "de-DE" };
  it("generates variants for each modifier", () => {
    const report = generateForLocale("buy shoes", locale, ["online", "cheap"]);
    expect(report.locale.locale).toBe("de-DE");
    expect(report.translatedBase).toBe("kaufen schuhe");
    expect(report.currency).toBe("EUR");
    expect(report.variants).toHaveLength(2);
    expect(report.variants[0].combinedKeyword).toBe("kaufen schuhe online");
    expect(report.variants[1].combinedKeyword).toBe("kaufen schuhe günstig");
    expect(report.variants[0].googleUrl).toContain("google.de");
  });
  it("produces base-only variant when no modifiers", () => {
    const report = generateForLocale("buy shoes", locale, []);
    expect(report.variants).toHaveLength(1);
    expect(report.variants[0].combinedKeyword).toBe("kaufen schuhe");
  });
  it("translates modifiers", () => {
    const report = generateForLocale("shoes", locale, ["cheap", "best"]);
    expect(report.variants[0].translatedModifier).toBe("günstig");
    expect(report.variants[1].translatedModifier).toBe("beste");
  });
  it("collects untranslatable words", () => {
    const report = generateForLocale("buy widget", locale, ["online"]);
    expect(report.untranslatableWords).toContain("widget");
  });
});

describe("locale-keyword-researcher generateAllReports", () => {
  it("generates reports for multiple locales", () => {
    const locales = [
      { language: "en", country: "US", locale: "en-US" },
      { language: "de", country: "DE", locale: "de-DE" },
      { language: "ja", country: "JP", locale: "ja-JP" },
    ];
    const reports = generateAllReports("buy shoes", locales, ["online"]);
    expect(reports).toHaveLength(3);
    expect(reports[0].translatedBase).toBe("buy shoes");
    expect(reports[1].translatedBase).toBe("kaufen schuhe");
    expect(reports[2].translatedBase).toBe("買う 靴");
    expect(reports[2].currency).toBe("JPY");
  });
  it("handles empty locale list", () => {
    expect(generateAllReports("buy shoes", [], ["online"])).toEqual([]);
  });
});

describe("locale-keyword-researcher flattenVariants", () => {
  it("flattens reports into variant list", () => {
    const reports = generateAllReports("buy shoes",
      [{ language: "en", country: "US", locale: "en-US" }],
      ["online", "cheap"]);
    const flat = flattenVariants(reports);
    expect(flat).toHaveLength(2);
  });
});

describe("locale-keyword-researcher filterByLocale", () => {
  it("filters by locale substring", () => {
    const reports = generateAllReports("buy shoes",
      [
        { language: "en", country: "US", locale: "en-US" },
        { language: "de", country: "DE", locale: "de-DE" },
      ],
      ["online"]);
    const flat = flattenVariants(reports);
    expect(filterByLocale(flat, "de")).toHaveLength(1);
    expect(filterByLocale(flat, "de")[0].locale).toBe("de-DE");
  });
  it("returns all for empty query", () => {
    const reports = generateAllReports("buy shoes",
      [{ language: "en", country: "US", locale: "en-US" }],
      ["online"]);
    expect(filterByLocale(flattenVariants(reports), "")).toHaveLength(1);
  });
});

describe("locale-keyword-researcher computeStats", () => {
  it("computes summary stats", () => {
    const reports = generateAllReports("buy shoes",
      [
        { language: "en", country: "US", locale: "en-US" },
        { language: "de", country: "DE", locale: "de-DE" },
      ],
      ["online", "cheap"]);
    const stats = computeStats(reports);
    expect(stats.totalLocales).toBe(2);
    expect(stats.totalVariants).toBe(4);
    expect(stats.currencies).toContain("USD");
    expect(stats.currencies).toContain("EUR");
    expect(stats.totalUntranslatable).toBe(0);
  });
  it("counts untranslatable words", () => {
    const reports = generateAllReports("buy widget",
      [{ language: "de", country: "DE", locale: "de-DE" }],
      ["online"]);
    const stats = computeStats(reports);
    expect(stats.totalUntranslatable).toBe(1);
  });
});

describe("locale-keyword-researcher renderText", () => {
  it("renders text report", () => {
    const reports = generateAllReports("buy shoes",
      [{ language: "de", country: "DE", locale: "de-DE" }],
      ["online"]);
    const text = renderText("buy shoes", reports);
    expect(text).toContain("Locale Keyword Research");
    expect(text).toContain("Base keyword: buy shoes");
    expect(text).toContain("[de-DE]");
    expect(text).toContain("kaufen schuhe");
    expect(text).toContain("kaufen schuhe online");
    expect(text).toContain("google.de");
  });
  it("renders untranslatable warnings", () => {
    const reports = generateAllReports("buy widget",
      [{ language: "de", country: "DE", locale: "de-DE" }],
      ["online"]);
    const text = renderText("buy widget", reports);
    expect(text).toContain("Untranslatable: widget");
  });
});

describe("locale-keyword-researcher renderCsv", () => {
  it("renders CSV header", () => {
    expect(renderCsv([])).toBe("locale,base,modifier,translated_keyword,google_url,currency");
  });
  it("renders variant rows", () => {
    const reports = generateAllReports("buy shoes",
      [{ language: "de", country: "DE", locale: "de-DE" }],
      ["online"]);
    const csv = renderCsv(reports);
    expect(csv).toContain("de-DE");
    expect(csv).toContain("buy shoes");
    expect(csv).toContain("kaufen schuhe online");
    expect(csv).toContain("google.de");
    expect(csv).toContain("EUR");
  });
});

describe("locale-keyword-researcher history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, baseKeyword: "buy shoes", locales: ["en-US"], totalVariants: 4 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, baseKeyword: "x", locales: ["en-US"], totalVariants: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, baseKeyword: "x", locales: ["en-US"], totalVariants: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("locale-keyword-researcher shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("buy shoes", "en-US\nde-DE", "online, cheap");
    expect(url).toContain("kw=buy+shoes");
    expect(url).toContain("locales=en-US");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("kw=buy+shoes&locales=en-US&mods=online");
    expect(p.baseKeyword).toBe("buy shoes");
    expect(p.localesText).toBe("en-US");
    expect(p.modifiersText).toBe("online");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ baseKeyword: "", localesText: "", modifiersText: "" });
  });
});
