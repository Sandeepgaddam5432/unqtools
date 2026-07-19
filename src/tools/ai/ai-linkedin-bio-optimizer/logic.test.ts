import { describe, it, expect, beforeEach } from "vitest";
import {
  HEADLINE_CHAR_LIMIT,
  ABOUT_CHAR_LIMIT,
  HISTORY_KEY,
  HISTORY_MAX,
  TONE_LABELS,
  CTA_LABELS,
  ROLE_PRESETS,
  INDUSTRY_PRESETS,
  COMMON_KEYWORDS,
  clean,
  countChars,
  tokenize,
  extractKeywords,
  suggestKeywords,
  keywordGap,
  scoreHeadline,
  scoreAbout,
  buildHeadline,
  trimHeadline,
  generateHeadlines,
  buildAbout,
  trimAbout,
  generateAbouts,
  scoreProfile,
  beforeAfterDiff,
  renderHeadlinesText,
  renderAboutsText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Tone,
  type Cta,
  type HeadlineVariant,
  type AboutVariant,
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

describe("linkedin-bio constants", () => {
  it("has 220-char headline limit", () => {
    expect(HEADLINE_CHAR_LIMIT).toBe(220);
  });
  it("has 2600-char About limit", () => {
    expect(ABOUT_CHAR_LIMIT).toBe(2600);
  });
  it("exposes 5 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
    expect(TONE_LABELS.leadership).toBe("Leadership");
  });
  it("exposes 5 CTAs", () => {
    expect(Object.keys(CTA_LABELS)).toHaveLength(5);
    expect(CTA_LABELS["open-to-work"]).toBe("Open to work");
  });
  it("has role and industry presets", () => {
    expect(ROLE_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(INDUSTRY_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("has keyword banks for known roles", () => {
    expect(Object.keys(COMMON_KEYWORDS).length).toBeGreaterThanOrEqual(8);
    expect(COMMON_KEYWORDS["Product Manager"]).toContain("roadmap");
  });
  it("uses HISTORY_MAX = 20 and a stable key", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(HISTORY_KEY).toBe("unqtools:ai-linkedin-bio-optimizer:history");
  });
});

describe("linkedin-bio clean + countChars + tokenize", () => {
  it("collapses whitespace", () => {
    expect(clean("  hello   world  ")).toBe("hello world");
  });
  it("counts characters", () => {
    expect(countChars("abc")).toBe(3);
    expect(countChars("")).toBe(0);
  });
  it("tokenizes words including # and + (lowercased)", () => {
    const t = tokenize("C++ and TypeScript #1");
    expect(t).toContain("c++");
    expect(t).toContain("typescript");
    expect(t).toContain("#1");
  });
});

describe("linkedin-bio extractKeywords", () => {
  it("extracts ngrams from resume text", () => {
    const text = "Senior Product Manager leading roadmap and discovery for SaaS products. Shipped 10+ features.";
    const kw = extractKeywords(text, 10);
    expect(kw.length).toBeGreaterThan(0);
    // Should pick up at least one of the meaningful terms
    expect(kw.some((k) => k.includes("product") || k.includes("manager") || k.includes("saas"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("linkedin-bio suggestKeywords", () => {
  it("returns known keywords for known role", () => {
    const kw = suggestKeywords("Product Manager", "SaaS");
    expect(kw.length).toBeGreaterThan(0);
    expect(kw.some((k) => k.includes("roadmap") || k.includes("product"))).toBe(true);
  });
  it("includes industry as a keyword", () => {
    const kw = suggestKeywords("Software Engineer", "Fintech");
    expect(kw.some((k) => k.includes("fintech"))).toBe(true);
  });
  it("dedupes", () => {
    const kw = suggestKeywords("Software Engineer", "SaaS");
    const set = new Set(kw.map((k) => k.toLowerCase()));
    expect(set.size).toBe(kw.length);
  });
});

describe("linkedin-bio keywordGap", () => {
  it("flags missing keywords", () => {
    const gaps = keywordGap("I am a software engineer", ["python", "kubernetes", "engineer"]);
    const missing = gaps.filter((g) => !g.present);
    expect(missing.length).toBe(2);
    expect(missing.some((g) => g.keyword === "python")).toBe(true);
  });
  it("marks present keywords", () => {
    const gaps = keywordGap("python and kubernetes", ["python", "kubernetes"]);
    expect(gaps.every((g) => g.present)).toBe(true);
  });
});

describe("linkedin-bio scoreHeadline", () => {
  it("scores higher with target keywords", () => {
    const kw = ["product", "saas", "roadmap"];
    const lowScore = scoreHeadline("Hello world", kw, "Product Manager");
    const highScore = scoreHeadline("Senior Product Manager | SaaS roadmap driver | Open to work", kw, "Product Manager");
    expect(highScore.overall).toBeGreaterThan(lowScore.overall);
  });
  it("rewards action verbs and metrics", () => {
    const kw = ["growth"];
    const s = scoreHeadline("Driving growth (30%) for SaaS | Open to work", kw, "Growth Lead");
    expect(s.impact).toBeGreaterThan(15);
    expect(s.strengths.length).toBeGreaterThan(0);
  });
  it("penalizes too many slashes", () => {
    const kw: string[] = [];
    const s = scoreHeadline("a / b / c / d / e / f / g / h", kw, "X");
    expect(s.improvements.some((i) => i.includes("/"))).toBe(true);
  });
});

describe("linkedin-bio scoreAbout", () => {
  it("rewards paragraphs and action verbs", () => {
    const kw = ["product"];
    const text = "I led product teams that shipped $10M+ in revenue.\n\nWe grew 3x.\n\nAlways shipping.";
    const s = scoreAbout(text, kw);
    expect(s.clarity).toBeGreaterThan(15);
    expect(s.impact).toBeGreaterThan(15);
  });
  it("penalizes long sentences", () => {
    const kw: string[] = [];
    const longSent = "This is a very long sentence with many words that just keeps going and going and going and going and going and going and going and going and going and going and going and going and going.";
    const s = scoreAbout(longSent, kw);
    expect(s.improvements.some((i) => i.includes("long"))).toBe(true);
  });
});

describe("linkedin-bio buildHeadline", () => {
  it("builds a headline with role and industry", () => {
    const h = buildHeadline("Software Engineer", "Fintech", "ic", "lets-connect", 0, 0);
    expect(h.text).toBeTruthy();
    expect(h.text.length).toBeGreaterThan(0);
    expect(h.charLimit).toBe(220);
  });
  it("includes tone and cta in metadata", () => {
    const h = buildHeadline("Product Manager", "SaaS", "leadership", "open-to-work", 0, 0);
    expect(h.tone).toBe("leadership");
    expect(h.cta).toBe("open-to-work");
  });
  it("always assigns keywords", () => {
    const h = buildHeadline("Data Scientist", "AI/ML", "technical", "hire-me", 0, 0);
    expect(h.keywords.length).toBeGreaterThan(0);
  });
});

describe("linkedin-bio trimHeadline", () => {
  it("trims over-limit headline", () => {
    const longText = "Software Engineer | " + "x".repeat(300);
    const h: HeadlineVariant = {
      id: "x", text: longText, tone: "ic", cta: "lets-connect",
      charCount: countChars(longText), charLimit: HEADLINE_CHAR_LIMIT,
      exceedsLimit: true, trimmed: false, keywords: [],
      score: { overall: 0, keywordDensity: 0, clarity: 0, impact: 0, strengths: [], improvements: [] },
    };
    const t = trimHeadline(h);
    expect(t.charCount).toBeLessThanOrEqual(HEADLINE_CHAR_LIMIT);
    expect(t.trimmed).toBe(true);
  });
  it("no-op for under-limit headline", () => {
    const h: HeadlineVariant = {
      id: "x", text: "short", tone: "ic", cta: "lets-connect",
      charCount: 5, charLimit: HEADLINE_CHAR_LIMIT, exceedsLimit: false, trimmed: false,
      keywords: [],
      score: { overall: 0, keywordDensity: 0, clarity: 0, impact: 0, strengths: [], improvements: [] },
    };
    const t = trimHeadline(h);
    expect(t.trimmed).toBe(false);
    expect(t.text).toBe("short");
  });
});

describe("linkedin-bio generateHeadlines", () => {
  it("generates at least 10 variants", () => {
    const list = generateHeadlines("Software Engineer", "Fintech", "lets-connect", 12);
    expect(list.length).toBeGreaterThanOrEqual(10);
  });
  it("returns variants within the 220-char limit", () => {
    const list = generateHeadlines("Software Engineer", "Fintech", "lets-connect");
    expect(list.every((h) => h.charCount <= HEADLINE_CHAR_LIMIT)).toBe(true);
  });
  it("sorts by score descending", () => {
    const list = generateHeadlines("Software Engineer", "Fintech", "lets-connect");
    for (let i = 1; i < list.length; i++) {
      expect(list[i]!.score.overall).toBeLessThanOrEqual(list[i - 1]!.score.overall);
    }
  });
});

describe("linkedin-bio buildAbout", () => {
  it("builds an About with 3 paragraphs", () => {
    const a = buildAbout("Product Manager", "SaaS", "leadership", "open-to-work", 0);
    expect(a.paragraphs).toHaveLength(3);
    expect(a.text).toContain("Product Manager");
    expect(a.text).toContain("SaaS");
  });
  it("respects the 2600-char limit when reasonable", () => {
    const a = buildAbout("Software Engineer", "Fintech", "ic", "lets-connect", 0);
    expect(a.charCount).toBeLessThanOrEqual(ABOUT_CHAR_LIMIT);
  });
});

describe("linkedin-bio trimAbout", () => {
  it("trims over-limit About", () => {
    const longText = "P1.\n\n" + "x".repeat(3000);
    const a: AboutVariant = {
      id: "x", text: longText, tone: "ic", cta: "lets-connect",
      charCount: countChars(longText), charLimit: ABOUT_CHAR_LIMIT, exceedsLimit: true,
      trimmed: false, paragraphs: longText.split("\n\n"), keywords: [],
      score: { overall: 0, keywordDensity: 0, clarity: 0, impact: 0, strengths: [], improvements: [] },
    };
    const t = trimAbout(a);
    expect(t.charCount).toBeLessThanOrEqual(ABOUT_CHAR_LIMIT);
    expect(t.trimmed).toBe(true);
  });
});

describe("linkedin-bio generateAbouts", () => {
  it("generates at least 3 About variants", () => {
    const list = generateAbouts("Product Manager", "SaaS", "open-to-work", 4);
    expect(list.length).toBeGreaterThanOrEqual(3);
  });
  it("returns variants within the 2600-char limit", () => {
    const list = generateAbouts("Software Engineer", "Fintech", "lets-connect");
    expect(list.every((a) => a.charCount <= ABOUT_CHAR_LIMIT)).toBe(true);
  });
});

describe("linkedin-bio scoreProfile", () => {
  it("averages headline and About scores", () => {
    const h = buildHeadline("Software Engineer", "Fintech", "ic", "lets-connect", 0, 0);
    const a = buildAbout("Software Engineer", "Fintech", "ic", "lets-connect", 0);
    const p = scoreProfile(h, a);
    expect(p.overall).toBe(Math.round((h.score.overall + a.score.overall) / 2));
    expect(p.headlineScore).toBe(h.score.overall);
    expect(p.aboutScore).toBe(a.score.overall);
  });
});

describe("linkedin-bio beforeAfterDiff", () => {
  it("detects added and removed sentences", () => {
    const before = "I am a developer. I work at Acme.";
    const after = "I am a developer. I work at Globex. I love coding.";
    const d = beforeAfterDiff(before, after);
    expect(d.added.length).toBeGreaterThan(0);
    // Unchanged sentences retain their trailing punctuation
    expect(d.unchanged.some((s) => s.startsWith("I am a developer"))).toBe(true);
  });
});

describe("linkedin-bio renderers", () => {
  const headlines = generateHeadlines("Software Engineer", "Fintech", "lets-connect", 3);
  const abouts = generateAbouts("Software Engineer", "Fintech", "lets-connect", 2);

  it("renderHeadlinesText includes text and score", () => {
    const t = renderHeadlinesText(headlines);
    expect(t).toContain("score");
    expect(t).toContain("---");
  });
  it("renderAboutsText includes text and score", () => {
    const t = renderAboutsText(abouts);
    expect(t).toContain("score");
  });
  it("renderMarkdown has H1 and H2", () => {
    const m = renderMarkdown(headlines, abouts);
    expect(m).toContain("# LinkedIn Optimization");
    expect(m).toContain("## Headlines");
    expect(m).toContain("## About sections");
  });
  it("renderCsv has header row", () => {
    const c = renderCsv(headlines, abouts);
    expect(c.startsWith("section,id,tone,cta")).toBe(true);
    expect(c).toContain("headline,");
    expect(c).toContain("about,");
  });
  it("renderJson is valid JSON", () => {
    const j = renderJson(headlines, abouts);
    const parsed = JSON.parse(j);
    expect(Array.isArray(parsed.headlines)).toBe(true);
    expect(Array.isArray(parsed.abouts)).toBe(true);
  });
});

describe("linkedin-bio history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, role: "Software Engineer", industry: "Fintech",
      tone: "ic", cta: "lets-connect",
      headlineCount: 12, aboutCount: 4, topHeadlineScore: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, role: `Role ${i}`, industry: "SaaS",
        tone: "ic", cta: "lets-connect",
        headlineCount: 10, aboutCount: 4, topHeadlineScore: 70,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, role: "X", industry: "X", tone: "ic", cta: "lets-connect",
      headlineCount: 1, aboutCount: 1, topHeadlineScore: 50,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("linkedin-bio shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ role: "Software Engineer", industry: "Fintech", tone: "ic", cta: "lets-connect" });
    expect(url).toContain("role=Software+Engineer");
    expect(url).toContain("ind=Fintech");
    expect(url).toContain("t=ic");
    expect(url).toContain("c=lets-connect");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("role=Software+Engineer&ind=Fintech&t=ic&c=lets-connect");
    expect(p.role).toBe("Software Engineer");
    expect(p.industry).toBe("Fintech");
    expect(p.tone).toBe("ic");
    expect(p.cta).toBe("lets-connect");
  });
  it("filters unknown tone/cta", () => {
    const p = parseShareUrl("role=X&t=unknown-tone&c=unknown-cta");
    expect(p.tone).toBeUndefined();
    expect(p.cta).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("linkedin-bio LLM prompt + result rendering", () => {
  it("builds a prompt referencing role and industry", () => {
    const prompt = buildLlmPrompt("I am a dev.", "Software Engineer", "Fintech", "ic", "lets-connect");
    expect(prompt).toContain("Software Engineer");
    expect(prompt).toContain("Fintech");
    expect(prompt.toLowerCase()).toContain("220");
    expect(prompt.toLowerCase()).toContain("2600");
  });
  it("parses a valid JSON response", () => {
    const response = JSON.stringify({
      headline: "Senior Software Engineer | Fintech | Open to work",
      about: "I build fintech systems.\n\nAlways shipping.",
      keywords: ["fintech", "software"],
      rationale: "Added keywords for recruiter search.",
    });
    const r = renderLlmResult(response);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.optimization.headline).toContain("Fintech");
      expect(r.optimization.keywords).toContain("fintech");
    }
  });
  it("parses response wrapped in markdown fences", () => {
    const response = "```json\n" + JSON.stringify({
      headline: "x", about: "y", keywords: [], rationale: "z",
    }) + "\n```";
    const r = renderLlmResult(response);
    expect(r.ok).toBe(true);
  });
  it("errors on empty response", () => {
    expect(renderLlmResult("").ok).toBe(false);
  });
  it("errors on invalid JSON", () => {
    expect(renderLlmResult("not json at all").ok).toBe(false);
  });
});

// Suppress unused-import lint for re-exported types
export type _Unused = Tone | Cta;
