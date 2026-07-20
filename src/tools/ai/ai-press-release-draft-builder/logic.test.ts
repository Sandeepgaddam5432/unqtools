import { describe, it, expect, beforeEach } from "vitest";
import {
  RELEASE_TYPE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  LENGTH_TARGETS,
  LENGTH_BODY_PARAGRAPHS,
  ANGLE_LABELS,
  NEWSWORTHINESS_LABELS,
  SAMPLE_INPUTS,
  normalizeText,
  titleCase,
  extractKeywords,
  formatDateline,
  formatDate,
  detectReleaseType,
  suggestTone,
  countWords,
  truncateForSeo,
  generateHeadlines,
  generateSubhead,
  generateLede,
  generateBodyParagraphs,
  generateQuote,
  checkNewsworthiness,
  generateRelease,
  chooseHeadline,
  chooseSeoHeadline,
  updateQuote,
  computeStats,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ReleaseType,
  type Tone,
  type Length,
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

const SAMPLE = SAMPLE_INPUTS[0];

describe("ai-press-release constants", () => {
  it("has 6 release type labels", () => {
    expect(Object.keys(RELEASE_TYPE_LABELS)).toHaveLength(6);
    expect(RELEASE_TYPE_LABELS["product-launch"]).toContain("Product");
  });
  it("has 3 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
  });
  it("has 3 length labels with ascending word targets", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
    expect(LENGTH_TARGETS.short).toBeLessThan(LENGTH_TARGETS.standard);
    expect(LENGTH_TARGETS.standard).toBeLessThan(LENGTH_TARGETS.long);
  });
  it("length body paragraphs match target tiers", () => {
    expect(LENGTH_BODY_PARAGRAPHS.short).toBe(2);
    expect(LENGTH_BODY_PARAGRAPHS.standard).toBe(3);
    expect(LENGTH_BODY_PARAGRAPHS.long).toBe(4);
  });
  it("has 5 angle labels", () => {
    expect(Object.keys(ANGLE_LABELS)).toHaveLength(5);
    expect(ANGLE_LABELS["benefit-led"]).toContain("Benefit");
  });
  it("has 6 newsworthiness labels", () => {
    expect(Object.keys(NEWSWORTHINESS_LABELS)).toHaveLength(6);
  });
  it("has sample inputs", () => {
    expect(SAMPLE_INPUTS.length).toBeGreaterThanOrEqual(2);
    expect(SAMPLE_INPUTS[0].organization.length).toBeGreaterThan(0);
  });
});

describe("ai-press-release normalizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("  Acme   launches   AI  ")).toBe("Acme launches AI");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("ai-press-release titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("acme corporation")).toBe("Acme Corporation");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-press-release extractKeywords", () => {
  it("extracts keywords and filters stop words", () => {
    const kw = extractKeywords("Acme launches AI-powered inventory forecasting");
    expect(kw).toContain("acme");
    expect(kw).toContain("ai-powered");
    expect(kw).toContain("inventory");
    expect(kw).toContain("forecasting");
    expect(kw).not.toContain("launches");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-press-release formatDateline", () => {
  it("formats a city + specific date", () => {
    expect(formatDateline("San Francisco, CA", "October 14, 2025")).toBe(
      "San Francisco, CA — October 14, 2025 —",
    );
  });
  it("handles 'today' as date placeholder", () => {
    expect(formatDateline("New York", "today")).toBe("New York — [Month] [Day], [Year] —");
  });
  it("uses [CITY] placeholder when city is missing", () => {
    expect(formatDateline("", "today")).toBe("[CITY] — [Month] [Day], [Year] —");
  });
});

describe("ai-press-release formatDate", () => {
  it("returns the date trimmed", () => {
    expect(formatDate("  October 14, 2025  ")).toBe("October 14, 2025");
  });
  it("returns [Date] for empty", () => {
    expect(formatDate("")).toBe("[Date]");
  });
});

describe("ai-press-release detectReleaseType", () => {
  it("detects product-launch from 'launches'", () => {
    expect(detectReleaseType("Acme launches new AI platform")).toBe("product-launch");
  });
  it("detects partnership from 'partners with'", () => {
    expect(detectReleaseType("Acme partners with GlobalBank on payments")).toBe("partnership");
  });
  it("detects hiring from 'appoints'", () => {
    expect(detectReleaseType("Acme appoints Jane Doe as CTO")).toBe("hiring");
  });
  it("detects funding from 'raises'", () => {
    expect(detectReleaseType("Acme raises $20M Series A")).toBe("funding");
  });
  it("detects event from 'hosts'", () => {
    expect(detectReleaseType("Acme hosts annual user conference")).toBe("event");
  });
  it("detects award from 'wins'", () => {
    expect(detectReleaseType("Acme wins Best AI Startup 2025")).toBe("award");
  });
  it("defaults to product-launch", () => {
    expect(detectReleaseType("Acme does a thing")).toBe("product-launch");
  });
});

describe("ai-press-release suggestTone", () => {
  it("suggests energetic for product-launch", () => {
    expect(suggestTone("product-launch")).toBe("energetic");
  });
  it("suggests formal for funding", () => {
    expect(suggestTone("funding")).toBe("formal");
  });
  it("suggests conversational for event", () => {
    expect(suggestTone("event")).toBe("conversational");
  });
});

describe("ai-press-release countWords", () => {
  it("counts words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });
  it("handles empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("collapses whitespace", () => {
    expect(countWords("  one   two  ")).toBe(2);
  });
});

describe("ai-press-release truncateForSeo", () => {
  it("returns the original if under 65 chars", () => {
    const h = "Acme launches AI";
    expect(truncateForSeo(h)).toBe(h);
  });
  it("truncates to <= 65 chars on word boundary", () => {
    const long = "Acme launches a brand new AI-powered inventory forecasting platform for mid-market retailers everywhere";
    const out = truncateForSeo(long);
    expect(out.length).toBeLessThanOrEqual(65);
    expect(out).toMatch(/…$/);
  });
});

describe("ai-press-release generateHeadlines", () => {
  it("generates 5 headline variants across all angles", () => {
    const headlines = generateHeadlines(SAMPLE, "product-launch", "energetic");
    expect(headlines).toHaveLength(5);
    const angles = headlines.map((h) => h.angle);
    expect(angles).toContain("benefit-led");
    expect(angles).toContain("fact-led");
    expect(angles).toContain("customer-led");
    expect(angles).toContain("trend-led");
    expect(angles).toContain("controversy-led");
  });
  it("every headline has a non-empty text and SEO variant under 65 chars", () => {
    const headlines = generateHeadlines(SAMPLE, "product-launch", "energetic");
    for (const h of headlines) {
      expect(h.text.length).toBeGreaterThan(10);
      expect(h.seoVariant.length).toBeLessThanOrEqual(65);
    }
  });
});

describe("ai-press-release generateSubhead", () => {
  it("generates a non-empty subhead per release type", () => {
    for (const rt of Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[]) {
      const sh = generateSubhead(SAMPLE, rt, "formal");
      expect(sh.length).toBeGreaterThan(10);
    }
  });
});

describe("ai-press-release generateLede", () => {
  it("generates a lede with the organization name", () => {
    const lede = generateLede(SAMPLE, "product-launch");
    expect(lede).toContain(SAMPLE.organization);
    expect(lede.length).toBeGreaterThan(50);
  });
  it("generates a lede per release type", () => {
    for (const rt of Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[]) {
      const lede = generateLede(SAMPLE, rt);
      expect(lede.length).toBeGreaterThan(30);
    }
  });
});

describe("ai-press-release generateBodyParagraphs", () => {
  it("generates 2 paragraphs for short length", () => {
    const paras = generateBodyParagraphs(SAMPLE, "product-launch", "short");
    expect(paras).toHaveLength(2);
    for (const p of paras) expect(p.length).toBeGreaterThan(20);
  });
  it("generates 3 paragraphs for standard length", () => {
    const paras = generateBodyParagraphs(SAMPLE, "product-launch", "standard");
    expect(paras).toHaveLength(3);
  });
  it("generates 4 paragraphs for long length", () => {
    const paras = generateBodyParagraphs(SAMPLE, "product-launch", "long");
    expect(paras).toHaveLength(4);
  });
});

describe("ai-press-release generateQuote", () => {
  it("generates a quote with attribution", () => {
    const q = generateQuote(SAMPLE, "product-launch");
    expect(q.attribution).toContain("Jane Doe");
    expect(q.attribution).toContain("CEO");
    expect(q.text.length).toBeGreaterThan(20);
    expect(q.isPlaceholder).toBe(true);
  });
  it("generates a quote per release type", () => {
    for (const rt of Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[]) {
      const q = generateQuote(SAMPLE, rt);
      expect(q.text.length).toBeGreaterThan(20);
    }
  });
});

describe("ai-press-release checkNewsworthiness", () => {
  it("returns 6 factor scores and a verdict", () => {
    const r = checkNewsworthiness(SAMPLE, "product-launch");
    expect(r.factors).toHaveLength(6);
    expect(r.maxScore).toBe(12);
    expect(r.totalScore).toBeGreaterThanOrEqual(0);
    expect(r.totalScore).toBeLessThanOrEqual(12);
    expect(["This is news", "Borderline — strengthen the angle", "Probably not news"]).toContain(r.verdict);
  });
  it("scores higher when inputs have date + location + numbers", () => {
    const strong = checkNewsworthiness(SAMPLE, "product-launch");
    const weak = checkNewsworthiness(
      { organization: "", what: "", when: "", where: "", why: "",
        who: "", contactName: "", contactEmail: "", contactPhone: "", boilerplate: "" },
      "product-launch",
    );
    expect(strong.totalScore).toBeGreaterThan(weak.totalScore);
  });
  it("includes a non-empty suggestion", () => {
    const r = checkNewsworthiness(SAMPLE, "product-launch");
    expect(r.suggestion.length).toBeGreaterThan(10);
  });
});

describe("ai-press-release generateRelease", () => {
  it("generates a complete release with all standard parts", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    expect(r.releaseType).toBe("product-launch");
    expect(r.tone).toBe("energetic");
    expect(r.length).toBe("standard");
    expect(r.headlineVariants).toHaveLength(5);
    expect(r.chosenHeadline.length).toBeGreaterThan(10);
    expect(r.subhead.length).toBeGreaterThan(10);
    expect(r.dateline.length).toBeGreaterThan(10);
    expect(r.lede.length).toBeGreaterThan(30);
    expect(r.bodyParagraphs).toHaveLength(3);
    expect(r.quote.text.length).toBeGreaterThan(20);
    expect(r.quote.isPlaceholder).toBe(true);
    expect(r.boilerplate.length).toBeGreaterThan(10);
    expect(r.endMark).toBe("###");
    expect(r.wordCount).toBeGreaterThan(100);
  });
  it("different release types produce different ledes", () => {
    const product = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const funding = generateRelease(SAMPLE, "funding", "formal", "standard");
    expect(product.lede).not.toBe(funding.lede);
  });
  it("longer length produces more body paragraphs and more words", () => {
    const short = generateRelease(SAMPLE, "product-launch", "energetic", "short");
    const long = generateRelease(SAMPLE, "product-launch", "energetic", "long");
    expect(long.bodyParagraphs.length).toBeGreaterThan(short.bodyParagraphs.length);
    expect(long.wordCount).toBeGreaterThan(short.wordCount);
  });
  it("handles empty inputs gracefully with placeholders", () => {
    const empty = {
      organization: "", what: "", when: "", where: "", why: "",
      who: "", contactName: "", contactEmail: "", contactPhone: "", boilerplate: "",
    };
    const r = generateRelease(empty, "product-launch", "formal", "standard");
    expect(r.chosenHeadline).toContain("[ORGANIZATION]");
    expect(r.boilerplate).toContain("[BOILERPLATE");
  });
});

describe("ai-press-release chooseHeadline / chooseSeoHeadline", () => {
  it("chooseHeadline switches to a different variant", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const next = chooseHeadline(r, 2);
    expect(next.chosenHeadline).toBe(r.headlineVariants[2].text);
  });
  it("chooseHeadline returns release unchanged for out-of-range index", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const next = chooseHeadline(r, 999);
    expect(next.chosenHeadline).toBe(r.chosenHeadline);
  });
  it("chooseSeoHeadline uses the SEO variant (under 65 chars)", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const next = chooseSeoHeadline(r, 0);
    expect(next.chosenHeadline.length).toBeLessThanOrEqual(65);
  });
});

describe("ai-press-release updateQuote", () => {
  it("updates quote text and marks isPlaceholder=false", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const updated = updateQuote(r, "This is the real, approved quote.");
    expect(updated.quote.text).toBe("This is the real, approved quote.");
    expect(updated.quote.isPlaceholder).toBe(false);
  });
});

describe("ai-press-release computeStats", () => {
  it("computes correct stats", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const s = computeStats(r);
    expect(s.wordCount).toBe(r.wordCount);
    expect(s.targetWords).toBe(LENGTH_TARGETS.standard);
    expect(s.paragraphCount).toBe(r.bodyParagraphs.length + 1);
    expect(s.releaseTypeLabel).toContain("Product");
    expect(typeof s.headlineSeoOk).toBe("boolean");
  });
});

describe("ai-press-release render functions", () => {
  it("renderText contains all standard PR parts", () => {
    const r = generateRelease(SAMPLE, "product-launch", "energetic", "standard");
    const txt = renderText(r);
    expect(txt).toContain("FOR IMMEDIATE RELEASE");
    expect(txt).toContain(r.chosenHeadline);
    expect(txt).toContain(r.dateline);
    expect(txt).toContain(r.lede);
    expect(txt).toContain(r.quote.text);
    expect(txt).toContain(`— ${r.quote.attribution}`);
    expect(txt).toContain("Contact:");
    expect(txt).toContain("###");
  });
  it("renderMarkdown contains AP-style structure", () => {
    const r = generateRelease(SAMPLE, "funding", "formal", "standard");
    const md = renderMarkdown(r);
    expect(md).toContain("**FOR IMMEDIATE RELEASE**");
    expect(md).toContain(`# ${r.chosenHeadline}`);
    expect(md).toContain(`**${r.dateline}**`);
    expect(md).toContain("> ");
    expect(md).toContain(`### ${r.endMark}`);
  });
});

describe("ai-press-release history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      organization: "Acme",
      what: "launches X",
      releaseType: "product-launch",
      tone: "energetic",
      length: "standard",
      headline: "Acme launches X",
      wordCount: 500,
      newsworthiness: 8,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        organization: "Acme",
        what: "X",
        releaseType: "product-launch",
        tone: "energetic",
        length: "standard",
        headline: "...",
        wordCount: 500,
        newsworthiness: 8,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      organization: "Acme",
      what: "X",
      releaseType: "product-launch",
      tone: "energetic",
      length: "standard",
      headline: "...",
      wordCount: 500,
      newsworthiness: 8,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-press-release share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      organization: "Acme",
      what: "launches X",
      when: "today",
      where: "San Francisco",
      why: "reasons",
      who: "Jane Doe, CEO",
      releaseType: "product-launch",
      tone: "energetic",
      length: "standard",
    });
    expect(url).toContain("org=Acme");
    expect(url).toContain("what=launches+X");
    expect(url).toContain("type=product-launch");
    expect(url).toContain("tone=energetic");
    expect(url).toContain("len=standard");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl(
      "org=Acme&what=launches+X&when=today&where=SF&why=reasons&who=Jane+Doe,+CEO&type=funding&tone=formal&len=long",
    );
    expect(s.organization).toBe("Acme");
    expect(s.what).toBe("launches X");
    expect(s.when).toBe("today");
    expect(s.where).toBe("SF");
    expect(s.who).toBe("Jane Doe, CEO");
    expect(s.releaseType).toBe("funding");
    expect(s.tone).toBe("formal");
    expect(s.length).toBe("long");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.organization).toBe("");
    expect(s.releaseType).toBe("product-launch");
    expect(s.tone).toBe("formal");
    expect(s.length).toBe("standard");
  });
  it("filters unknown values to defaults", () => {
    const s = parseShareUrl("org=hi&type=bogus&tone=evil&len=wrong");
    expect(s.releaseType).toBe("product-launch");
    expect(s.tone).toBe("formal");
    expect(s.length).toBe("standard");
  });
});

describe("ai-press-release LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const p = buildLlmPrompt(SAMPLE, "product-launch", "energetic", "standard");
    expect(p.system).toContain("product-launch");
    expect(p.system).toContain("AP-style");
    expect(p.system).toContain("energetic");
    expect(p.user).toContain(SAMPLE.organization);
    expect(p.user).toContain(SAMPLE.what);
  });
  it("renderLlmResult returns ok=true for non-empty", () => {
    const r = renderLlmResult("  some press release  ");
    expect(r.ok).toBe(true);
    expect(r.result).toBe("some press release");
  });
  it("renderLlmResult returns ok=false for empty", () => {
    const r = renderLlmResult("   ");
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});

// Suppress unused-import lint
export type _Unused = ReleaseType | Tone | Length;
