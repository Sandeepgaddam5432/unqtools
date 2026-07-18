import { describe, it, expect, beforeEach } from "vitest";
import {
  CTA_KEYWORDS,
  STOPWORDS,
  DEFAULT_PHOTO_PLAN,
  COMMON_QUESTIONS,
  BUSINESS_PRESETS,
  normalizeText,
  normalizeLower,
  parseServices,
  extractCityName,
  countWords,
  hasCallToAction,
  hasCategoryKeyword,
  hasCityKeyword,
  hasServiceKeyword,
  scoreDescription,
  keywordDensity,
  generatePosts,
  suggestCategories,
  generatePhotoPlan,
  suggestQa,
  buildReport,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GbpInput,
  type BusinessTypePreset,
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

function makeInput(overrides: Partial<GbpInput> = {}): GbpInput {
  return {
    businessName: "Austin Plumbing Pros",
    primaryCategory: "Plumber",
    services: ["Drain cleaning", "Leak repair", "Water heater installation"],
    city: "Austin, TX",
    description:
      "Austin Plumbing Pros is a trusted plumber serving Austin, TX and surrounding areas. " +
      "We offer drain cleaning, leak repair, and water heater installation. " +
      "Licensed and insured. Call today to schedule your appointment!",
    hours: "Mon-Fri 8-6, Sat 9-2",
    website: "https://austinplumbingpros.example",
    ...overrides,
  };
}

describe("gbp-optimizer constants", () => {
  it("has CTA keywords", () => {
    expect(CTA_KEYWORDS.length).toBeGreaterThanOrEqual(10);
    expect(CTA_KEYWORDS).toContain("call");
    expect(CTA_KEYWORDS).toContain("book");
  });
  it("has stopwords set", () => {
    expect(STOPWORDS.size).toBeGreaterThan(20);
    expect(STOPWORDS.has("the")).toBe(true);
  });
  it("has 6+ photo types with at least 6 required", () => {
    expect(DEFAULT_PHOTO_PLAN.length).toBeGreaterThanOrEqual(6);
    expect(DEFAULT_PHOTO_PLAN.filter((p) => p.required).length).toBeGreaterThanOrEqual(6);
  });
  it("has 5+ common questions", () => {
    expect(COMMON_QUESTIONS.length).toBeGreaterThanOrEqual(5);
  });
  it("has 8 business presets", () => {
    expect(BUSINESS_PRESETS).toHaveLength(8);
  });
  it("presets have all required fields", () => {
    for (const p of BUSINESS_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.primaryCategory).toBeTruthy();
      expect(p.sampleServices.length).toBeGreaterThanOrEqual(3);
      expect(p.suggestedCategories.length).toBeGreaterThanOrEqual(3);
      expect(p.qaSuggestions.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("gbp-optimizer normalize", () => {
  it("normalizes text by trimming", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
  it("normalizes lower-case + trim", () => {
    expect(normalizeLower("  Hello WORLD  ")).toBe("hello world");
  });
  it("parses newline-separated services", () => {
    expect(parseServices("Drain cleaning\nLeak repair")).toEqual(["Drain cleaning", "Leak repair"]);
  });
  it("parses comma-separated services", () => {
    expect(parseServices("Drain cleaning, Leak repair")).toEqual(["Drain cleaning", "Leak repair"]);
  });
  it("skips empty services", () => {
    expect(parseServices("Drain\n\nLeak")).toEqual(["Drain", "Leak"]);
  });
  it("returns empty for empty input", () => {
    expect(parseServices("")).toEqual([]);
  });
  it("extracts city name from 'Austin, TX'", () => {
    expect(extractCityName("Austin, TX")).toBe("Austin");
  });
  it("returns full string when no comma", () => {
    expect(extractCityName("Austin")).toBe("Austin");
  });
  it("returns empty for empty city", () => {
    expect(extractCityName("")).toBe("");
  });
});

describe("gbp-optimizer countWords", () => {
  it("counts words in a sentence", () => {
    expect(countWords("hello world foo")).toBe(3);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("gbp-optimizer description detection", () => {
  it("hasCallToAction detects 'call'", () => {
    expect(hasCallToAction("Call us today!")).toBe(true);
  });
  it("hasCallToAction detects 'book'", () => {
    expect(hasCallToAction("Book an appointment.")).toBe(true);
  });
  it("hasCallToAction returns false when no CTA", () => {
    expect(hasCallToAction("We are a plumber.")).toBe(false);
  });
  it("hasCategoryKeyword matches", () => {
    expect(hasCategoryKeyword("We are a trusted plumber", "Plumber")).toBe(true);
  });
  it("hasCategoryKeyword returns false when missing", () => {
    expect(hasCategoryKeyword("We fix things", "Plumber")).toBe(false);
  });
  it("hasCityKeyword matches Austin", () => {
    expect(hasCityKeyword("Serving Austin and surrounding", "Austin, TX")).toBe(true);
  });
  it("hasCityKeyword returns false when missing", () => {
    expect(hasCityKeyword("Serving Dallas", "Austin, TX")).toBe(false);
  });
  it("hasServiceKeyword matches one service", () => {
    expect(hasServiceKeyword("We do drain cleaning and more", ["Drain cleaning", "Leak repair"])).toBe(true);
  });
  it("hasServiceKeyword returns false when none match", () => {
    expect(hasServiceKeyword("We do other things", ["Drain cleaning"])).toBe(false);
  });
});

describe("gbp-optimizer scoreDescription", () => {
  it("scores full-mark description", () => {
    const desc =
      "Austin Plumbing Pros is a trusted plumber serving Austin, TX and surrounding areas. " +
      "We offer drain cleaning and leak repair services for residential and commercial customers. " +
      "Licensed, insured, and available 24/7 for emergencies. Call today to schedule your appointment!";
    const score = scoreDescription(desc, "Plumber", "Austin, TX", ["Drain cleaning", "Leak repair"]);
    expect(score.total).toBe(100);
    expect(score.missing).toEqual([]);
    expect(score.components.lengthOk).toBe(true);
    expect(score.components.hasCategory).toBe(true);
    expect(score.components.hasCity).toBe(true);
    expect(score.components.hasService).toBe(true);
    expect(score.components.hasCta).toBe(true);
  });
  it("scores 0 for empty description", () => {
    const score = scoreDescription("", "Plumber", "Austin, TX", ["Drain cleaning"]);
    expect(score.total).toBe(0);
    expect(score.missing).toHaveLength(5);
  });
  it("length component requires 200-750 chars", () => {
    const short = "Short plumber description with city and CTA. Call today!";
    const score = scoreDescription(short, "plumber", "Austin", []);
    expect(score.components.lengthOk).toBe(false);
  });
  it("length too long > 750 fails", () => {
    const long = "Plumber in Austin. ".repeat(50); // ~1000 chars
    const score = scoreDescription(long, "plumber", "Austin", []);
    expect(score.components.lengthOk).toBe(false);
  });
  it("partial score when only some components pass", () => {
    // 200+ chars, has category, has city, no service, has CTA => 30+20+20+15 = 85
    const desc =
      "Austin Plumbing Pros is a trusted plumber serving Austin, TX. " +
      "We are licensed, insured, and ready to help with all your plumbing needs. " +
      "Our experienced team is standing by to deliver quality service. " +
      "Call today to schedule your appointment!";
    const score = scoreDescription(desc, "plumber", "Austin, TX", []);
    expect(score.components.lengthOk).toBe(true);
    expect(score.total).toBe(85);
    expect(score.missing).toEqual(["Service keyword"]);
  });
});

describe("gbp-optimizer keywordDensity", () => {
  it("returns top N keywords", () => {
    const text = "plumber plumber plumber austin austin service service call";
    const density = keywordDensity(text, 5);
    expect(density.length).toBeGreaterThan(0);
    expect(density[0].word).toBe("plumber");
    expect(density[0].count).toBe(3);
  });
  it("filters stopwords", () => {
    const text = "the the the plumber plumber";
    const density = keywordDensity(text, 5);
    expect(density.find((d) => d.word === "the")).toBeUndefined();
    expect(density[0].word).toBe("plumber");
  });
  it("filters words shorter than 3 chars", () => {
    const text = "go go plumber plumber";
    const density = keywordDensity(text, 5);
    expect(density.find((d) => d.word === "go")).toBeUndefined();
  });
  it("returns empty for empty text", () => {
    expect(keywordDensity("", 5)).toEqual([]);
  });
  it("respects topN limit", () => {
    const text = "alpha alpha beta beta gamma gamma delta delta epsilon epsilon zeta zeta";
    const density = keywordDensity(text, 3);
    expect(density.length).toBeLessThanOrEqual(3);
  });
});

describe("gbp-optimizer generatePosts", () => {
  it("generates 3 posts", () => {
    const posts = generatePosts(makeInput());
    expect(posts).toHaveLength(3);
    expect(posts.map((p) => p.type)).toEqual(["whats-new", "offer", "event"]);
  });
  it("posts have a CTA", () => {
    const posts = generatePosts(makeInput());
    for (const p of posts) {
      expect(p.cta.length).toBeGreaterThan(0);
    }
  });
  it("posts are at most 300 chars", () => {
    const posts = generatePosts(makeInput());
    for (const p of posts) {
      expect(p.body.length).toBeLessThanOrEqual(300);
    }
  });
  it("posts include business name", () => {
    const posts = generatePosts(makeInput());
    expect(posts[0].body).toContain("Austin Plumbing Pros");
  });
  it("posts include city", () => {
    const posts = generatePosts(makeInput());
    expect(posts[0].body).toContain("Austin");
  });
  it("handles missing business name", () => {
    const posts = generatePosts(makeInput({ businessName: "" }));
    expect(posts[0].body.length).toBeGreaterThan(0);
  });
});

describe("gbp-optimizer suggestCategories", () => {
  it("suggests for Plumber", () => {
    const cats = suggestCategories("Plumber");
    expect(cats.length).toBeGreaterThan(0);
    expect(cats).toContain("Plumbing contractor");
  });
  it("suggests for case-insensitive 'plumber'", () => {
    const cats = suggestCategories("plumber");
    expect(cats).toContain("Plumbing contractor");
  });
  it("suggests for Dentist", () => {
    const cats = suggestCategories("Dentist");
    expect(cats).toContain("Orthodontist");
  });
  it("returns empty for unknown category", () => {
    expect(suggestCategories("Aerospace Engineer")).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(suggestCategories("")).toEqual([]);
  });
});

describe("gbp-optimizer generatePhotoPlan", () => {
  it("returns at least 6 required photos", () => {
    const plan = generatePhotoPlan();
    expect(plan.length).toBeGreaterThanOrEqual(6);
    expect(plan.filter((p) => p.required).length).toBeGreaterThanOrEqual(6);
  });
  it("includes logo, exterior, interior, team, products", () => {
    const plan = generatePhotoPlan();
    const ids = plan.map((p) => p.id);
    expect(ids).toContain("logo");
    expect(ids).toContain("exterior");
    expect(ids).toContain("interior");
    expect(ids).toContain("team");
    expect(ids).toContain("products");
  });
});

describe("gbp-optimizer suggestQa", () => {
  it("returns at least 5 questions for plumber", () => {
    const qa = suggestQa("Plumber");
    expect(qa.length).toBeGreaterThanOrEqual(5);
    expect(qa).toContain("What are your hours?");
  });
  it("includes plumber-specific questions", () => {
    const qa = suggestQa("Plumber");
    expect(qa.some((q) => q.toLowerCase().includes("emergency"))).toBe(true);
  });
  it("returns common questions for unknown category", () => {
    const qa = suggestQa("Aerospace Engineer");
    expect(qa.length).toBeGreaterThanOrEqual(5);
  });
});

describe("gbp-optimizer buildReport", () => {
  it("builds a complete report", () => {
    const report = buildReport(makeInput());
    expect(report.score.total).toBeGreaterThan(0);
    expect(report.posts).toHaveLength(3);
    expect(report.categorySuggestions.length).toBeGreaterThan(0);
    expect(report.photoPlan.length).toBeGreaterThanOrEqual(6);
    expect(report.qaSuggestions.length).toBeGreaterThanOrEqual(5);
    expect(report.summary.descriptionScore).toBe(report.score.total);
    expect(report.summary.postCount).toBe(3);
  });
});

describe("gbp-optimizer renderText", () => {
  it("renders a report with all sections", () => {
    const report = buildReport(makeInput());
    const text = renderText(report);
    expect(text).toContain("GOOGLE BUSINESS PROFILE OPTIMIZATION REPORT");
    expect(text).toContain("DESCRIPTION SCORE");
    expect(text).toContain("GBP POST TEMPLATES");
    expect(text).toContain("CATEGORY SUGGESTIONS");
    expect(text).toContain("PHOTO PLAN");
    expect(text).toContain("Q&A SUGGESTIONS");
  });
  it("renders missing components when score incomplete", () => {
    const report = buildReport(makeInput({ description: "short" }));
    const text = renderText(report);
    expect(text).toContain("Missing:");
  });
});

describe("gbp-optimizer renderCsv", () => {
  it("renders header", () => {
    const report = buildReport(makeInput());
    const csv = renderCsv(report);
    expect(csv).toContain("field,value");
  });
  it("renders description score row", () => {
    const report = buildReport(makeInput());
    const csv = renderCsv(report);
    expect(csv).toContain("description_score");
  });
  it("escapes commas in values", () => {
    const report = buildReport(makeInput());
    const csv = renderCsv(report);
    expect(csv).toContain('"Austin, TX"');
  });
});

describe("gbp-optimizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, businessName: "Biz", primaryCategory: "Plumber", city: "Austin", descriptionScore: 85 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, businessName: `Biz${i}`, primaryCategory: "Plumber", city: "Austin", descriptionScore: 80 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, businessName: "Biz", primaryCategory: "Plumber", city: "Austin", descriptionScore: 80 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("gbp-optimizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeInput());
    expect(url).toContain("name=Austin");
    expect(url).toContain("cat=Plumber");
    expect(url).toContain("city=Austin");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("name", "Austin Plumbing Pros");
    params.set("cat", "Plumber");
    params.set("city", "Austin, TX");
    params.set("svc", "Drain cleaning\nLeak repair\nWater heater installation");
    params.set("desc", "A plumber serving Austin, TX. Call today!");
    params.set("hrs", "Mon-Fri 9-5");
    params.set("web", "https://example.com");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.businessName).toBe("Austin Plumbing Pros");
    expect(p.primaryCategory).toBe("Plumber");
    expect(p.city).toBe("Austin, TX");
    expect(p.services).toEqual(["Drain cleaning", "Leak repair", "Water heater installation"]);
    expect(p.description).toBe("A plumber serving Austin, TX. Call today!");
    expect(p.hours).toBe("Mon-Fri 9-5");
    expect(p.website).toBe("https://example.com");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles hash without leading #", () => {
    const p = parseShareUrl("name=Test&cat=Plumber");
    expect(p.businessName).toBe("Test");
    expect(p.primaryCategory).toBe("Plumber");
  });
});

// Suppress unused-import lint
export type _Unused = BusinessTypePreset;
