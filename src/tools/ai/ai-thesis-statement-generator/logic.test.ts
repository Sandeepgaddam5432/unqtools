import { describe, it, expect, beforeEach } from "vitest";
import {
  ESSAY_TYPE_LABELS,
  STANCE_LABELS,
  ACADEMIC_LEVEL_LABELS,
  CITATION_STYLE_LABELS,
  SAMPLE_TOPICS,
  normalizeTopic,
  normalizeStance,
  tokenizeTopic,
  extractKeywords,
  titleCase,
  topicToPhrase,
  detectEssayType,
  suggestScopeNarrowing,
  analyzeClarity,
  scoreClarity,
  analyzeSpecificity,
  scoreSpecificity,
  analyzeArguability,
  scoreArguability,
  analyzeScope,
  scoreScope,
  scoreThesis,
  suggestImprovement,
  generateSupportingPoints,
  generateCounterArgument,
  generateTheses,
  computeStats,
  renderThesesText,
  renderThesesMarkdown,
  renderThesesJson,
  buildOutlineHandoffUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmTheses,
  type EssayType,
  type Stance,
  type AcademicLevel,
  type CitationStyle,
  type ThesisInput,
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

const baseInput: ThesisInput = {
  topic: "Should social media platforms be regulated as utilities?",
  stance: "for",
  essayType: "argumentative",
  academicLevel: "undergraduate",
  citationStyle: "apa",
};

describe("thesis-generator constants", () => {
  it("has 4 essay type labels", () => {
    expect(Object.keys(ESSAY_TYPE_LABELS)).toHaveLength(4);
  });
  it("has 3 stance labels", () => {
    expect(Object.keys(STANCE_LABELS)).toHaveLength(3);
  });
  it("has 3 academic level labels", () => {
    expect(Object.keys(ACADEMIC_LEVEL_LABELS)).toHaveLength(3);
  });
  it("has 4 citation style labels", () => {
    expect(Object.keys(CITATION_STYLE_LABELS)).toHaveLength(4);
  });
  it("has 12 sample topics", () => {
    expect(SAMPLE_TOPICS).toHaveLength(12);
    expect(SAMPLE_TOPICS[0].length).toBeGreaterThan(0);
  });
});

describe("thesis-generator normalizeTopic", () => {
  it("trims whitespace and caps length", () => {
    expect(normalizeTopic("  hello  ")).toBe("hello");
    expect(normalizeTopic("a".repeat(300))).toHaveLength(240);
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("thesis-generator normalizeStance", () => {
  it("maps for/pro/support/yes", () => {
    expect(normalizeStance("for")).toBe("for");
    expect(normalizeStance("Pro")).toBe("for");
    expect(normalizeStance("SUPPORT")).toBe("for");
    expect(normalizeStance("yes")).toBe("for");
  });
  it("maps against/con/oppose/no", () => {
    expect(normalizeStance("against")).toBe("against");
    expect(normalizeStance("con")).toBe("against");
    expect(normalizeStance("oppose")).toBe("against");
    expect(normalizeStance("no")).toBe("against");
  });
  it("defaults to neutral", () => {
    expect(normalizeStance("")).toBe("neutral");
    expect(normalizeStance("xyz")).toBe("neutral");
  });
});

describe("thesis-generator tokenizeTopic", () => {
  it("splits into lowercase words", () => {
    expect(tokenizeTopic("Should AI be Regulated?")).toEqual(["should", "ai", "be", "regulated"]);
  });
  it("preserves hyphens", () => {
    expect(tokenizeTopic("carbon-neutral cities")).toEqual(["carbon-neutral", "cities"]);
  });
  it("returns empty for empty", () => {
    expect(tokenizeTopic("")).toEqual([]);
  });
});

describe("thesis-generator extractKeywords", () => {
  it("extracts significant words, drops stop words", () => {
    const kw = extractKeywords("Should social media platforms be regulated as utilities?");
    expect(kw.length).toBeGreaterThan(0);
    expect(kw).not.toContain("should");
    expect(kw).not.toContain("be");
    expect(kw).toContain("social");
    expect(kw).toContain("media");
    expect(kw).toContain("regulated");
  });
  it("respects max", () => {
    const kw = extractKeywords("a b c d e f g h i j k l m n o p", 5);
    expect(kw.length).toBeLessThanOrEqual(5);
  });
  it("returns empty for empty topic", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("thesis-generator titleCase / topicToPhrase", () => {
  it("titleCase capitalizes words > 2 chars", () => {
    expect(titleCase("the carbon-neutral future")).toBe("The Carbon-neutral Future");
  });
  it("topicToPhrase lowercases", () => {
    expect(topicToPhrase("Social Media REGULATION")).toBe("social media regulation");
  });
});

describe("thesis-generator detectEssayType", () => {
  it("detects argumentative for should/must", () => {
    expect(detectEssayType("Should social media be regulated?")).toBe("argumentative");
    expect(detectEssayType("Why we must act on climate")).toBe("argumentative");
  });
  it("detects analytical for analyze/causes/effects", () => {
    expect(detectEssayType("Analyze the causes of inflation")).toBe("analytical");
    expect(detectEssayType("The effects of remote work")).toBe("analytical");
  });
  it("detects expository for explain/what is", () => {
    expect(detectEssayType("What is blockchain?")).toBe("expository");
    expect(detectEssayType("Explain quantum computing")).toBe("expository");
  });
  it("detects compare-contrast for vs/versus/compare", () => {
    expect(detectEssayType("React vs Vue: a comparison")).toBe("compare-contrast");
    expect(detectEssayType("Comparing two economic models")).toBe("compare-contrast");
  });
  it("returns null when ambiguous", () => {
    expect(detectEssayType("Cats")).toBe(null);
  });
  it("returns null for empty", () => {
    expect(detectEssayType("")).toBe(null);
  });
});

describe("thesis-generator suggestScopeNarrowing", () => {
  it("suggests narrowing for very short topic", () => {
    const s = suggestScopeNarrowing("AI");
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((x) => x.includes("Narrow") || x.includes("broad"))).toBe(true);
  });
  it("suggests focus for very long topic", () => {
    const long = "The impact of social media platforms on the political discourse and civic engagement of first-generation college students in the United States during the post-2020 period of accelerated digital transformation";
    const s = suggestScopeNarrowing(long);
    expect(s.some((x) => x.includes("broad"))).toBe(true);
  });
  it("suggests debatable angle for descriptive topic", () => {
    const s = suggestScopeNarrowing("Social media use");
    expect(s.some((x) => x.includes("descriptive") || x.includes("debatable"))).toBe(true);
  });
  it("always includes a quality check", () => {
    const s = suggestScopeNarrowing("Should AI be regulated?");
    expect(s.some((x) => x.includes("disagree"))).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(suggestScopeNarrowing("")).toEqual([]);
  });
});

describe("thesis-generator rubric: clarity", () => {
  it("penalizes hedges", () => {
    const clean = scoreClarity("Carbon taxes reduce emissions because they price externalities.");
    const hedgy = scoreClarity("Maybe carbon taxes perhaps reduce emissions, I think, because they possibly price externalities.");
    expect(clean).toBeGreaterThan(hedgy);
  });
  it("penalizes very long sentences", () => {
    const short = scoreClarity("Carbon taxes reduce emissions because they price externalities.");
    const longText = "Carbon taxes, which have been implemented in a number of jurisdictions around the world with varying degrees of success and political support, reduce emissions by pricing the negative externalities that arise from the combustion of fossil fuels in industrial and transportation contexts, and the consequences of this policy extend well beyond the immediate price signal.";
    const long = scoreClarity(longText);
    expect(short).toBeGreaterThan(long);
  });
  it("analyzeClarity returns signals", () => {
    const s = analyzeClarity("Maybe, perhaps, this is a hedge.");
    expect(s.hedgeCount).toBeGreaterThan(0);
    expect(s.commaCount).toBeGreaterThan(0);
  });
});

describe("thesis-generator rubric: specificity", () => {
  it("rewards keywords", () => {
    const kw = extractKeywords("social media regulation");
    const score = scoreSpecificity("Social media regulation is necessary for public safety.", kw);
    expect(score).toBeGreaterThan(50);
  });
  it("penalizes abstract nouns", () => {
    const kw = extractKeywords("topic");
    const abstract = scoreSpecificity("The issue is a problem of factors and aspects in the field.", kw);
    expect(abstract).toBeLessThan(70);
  });
  it("rewards numbers", () => {
    const withNum = scoreSpecificity("Carbon emissions fell 25% after the tax.", ["carbon", "emissions"]);
    const withoutNum = scoreSpecificity("Carbon emissions fell after the tax.", ["carbon", "emissions"]);
    expect(withNum).toBeGreaterThan(withoutNum);
  });
});

describe("thesis-generator rubric: arguability", () => {
  it("rewards debatable verbs for argumentative", () => {
    const debatable = scoreArguability("Carbon taxes should be implemented because they reduce emissions.", "argumentative", "for");
    const factual = scoreArguability("Carbon taxes are a type of policy.", "argumentative", "for");
    expect(debatable).toBeGreaterThan(factual);
  });
  it("rewards factual cues for expository", () => {
    const factual = scoreArguability("Carbon taxes are a policy instrument defined as a levy on emissions.", "expository", "neutral");
    expect(factual).toBeGreaterThan(50);
  });
  it("penalizes neutral stance on argumentative", () => {
    const neutral = scoreArguability("Carbon taxes have effects.", "argumentative", "neutral");
    const forStance = scoreArguability("Carbon taxes have effects.", "argumentative", "for");
    expect(neutral).toBeLessThan(forStance);
  });
  it("analyzeArguability counts debatable verbs", () => {
    const a = analyzeArguability("Taxes should be raised and must be enforced.");
    expect(a.debatableVerbCount).toBeGreaterThanOrEqual(2);
  });
});

describe("thesis-generator rubric: scope", () => {
  it("penalizes too many conjunctions", () => {
    const clean = scoreScope("A carbon tax reduces greenhouse gas emissions because it prices the negative externalities produced by fossil fuel combustion.");
    const conj = scoreScope("Carbon taxes and offsets and rebates and credits reduce emissions and incentivize alternatives and discourage pollution while encouraging innovation and supporting communities and balancing equity.");
    expect(clean).toBeGreaterThan(conj);
  });
  it("penalizes too short", () => {
    const s = scoreScope("Taxes.");
    expect(s).toBeLessThan(80);
  });
  it("analyzeScope returns wordCount and claimCount", () => {
    const s = analyzeScope("Carbon taxes reduce emissions because they price externalities.");
    expect(s.wordCount).toBeGreaterThan(0);
    expect(s.claimCount).toBeGreaterThanOrEqual(1);
  });
});

describe("thesis-generator scoreThesis", () => {
  it("returns scores in 0-100 range with composite", () => {
    const text = "Carbon taxes should be implemented because they reduce emissions and price externalities.";
    const kw = extractKeywords("carbon taxes emissions");
    const scores = scoreThesis(text, "argumentative", "for", kw);
    expect(scores.clarity).toBeGreaterThanOrEqual(0);
    expect(scores.clarity).toBeLessThanOrEqual(100);
    expect(scores.specificity).toBeGreaterThanOrEqual(0);
    expect(scores.arguability).toBeGreaterThanOrEqual(0);
    expect(scores.scope).toBeGreaterThanOrEqual(0);
    expect(scores.composite).toBeGreaterThanOrEqual(0);
    expect(scores.composite).toBeLessThanOrEqual(100);
  });
  it("argumentative weights arguability higher", () => {
    const kw = extractKeywords("carbon taxes");
    const arg = scoreThesis("Carbon taxes should be implemented because they reduce emissions.", "argumentative", "for", kw);
    const exp = scoreThesis("Carbon taxes are a policy instrument defined as a levy on emissions.", "expository", "neutral", kw);
    // For argumentative, the debatable verb should boost arguability
    expect(arg.arguability).toBeGreaterThan(exp.arguability);
  });
});

describe("thesis-generator suggestImprovement", () => {
  it("returns a tip string", () => {
    const kw = extractKeywords("carbon taxes");
    const scores = scoreThesis("Carbon taxes should be implemented because they reduce emissions.", "argumentative", "for", kw);
    const tip = suggestImprovement("Carbon taxes should be implemented because they reduce emissions.", scores, "argumentative");
    expect(tip.length).toBeGreaterThan(10);
  });
  it("returns strong message when all scores >= 80", () => {
    const scores = { clarity: 90, specificity: 90, arguability: 90, scope: 90, composite: 90 };
    const tip = suggestImprovement("Strong thesis.", scores, "argumentative");
    expect(tip).toContain("Strong");
  });
});

describe("thesis-generator supporting points", () => {
  it("generates 3 supporting points for argumentative", () => {
    const kw = extractKeywords("carbon taxes emissions");
    const pts = generateSupportingPoints("Carbon taxes should be implemented.", kw, "argumentative");
    expect(pts).toHaveLength(3);
    expect(pts.every((p) => p.template.includes("["))).toBe(true);
    expect(pts.every((p) => p.hint.length > 0)).toBe(true);
  });
  it("generates 3 supporting points for analytical", () => {
    const kw = extractKeywords("remote work productivity");
    const pts = generateSupportingPoints("Remote work changes productivity.", kw, "analytical");
    expect(pts).toHaveLength(3);
    expect(pts[0].template).toContain("[EVIDENCE");
  });
  it("generates 3 supporting points for expository", () => {
    const kw = extractKeywords("blockchain");
    const pts = generateSupportingPoints("Blockchain is a distributed ledger.", kw, "expository");
    expect(pts).toHaveLength(3);
  });
  it("generates 3 supporting points for compare-contrast", () => {
    const kw = extractKeywords("react vue");
    const pts = generateSupportingPoints("React and Vue differ.", kw, "compare-contrast");
    expect(pts).toHaveLength(3);
  });
});

describe("thesis-generator counter-argument", () => {
  it("generates a counter for argumentative", () => {
    const kw = extractKeywords("carbon taxes");
    const c = generateCounterArgument("Carbon taxes should be implemented.", kw, "argumentative", "for");
    expect(c.length).toBeGreaterThan(40);
    expect(c.toLowerCase()).toContain("critics");
  });
  it("generates a counter for analytical", () => {
    const kw = extractKeywords("remote work");
    const c = generateCounterArgument("Remote work changes productivity.", kw, "analytical", "neutral");
    expect(c.toLowerCase()).toContain("skeptic");
  });
  it("generates a counter for expository", () => {
    const kw = extractKeywords("blockchain");
    const c = generateCounterArgument("Blockchain is a distributed ledger.", kw, "expository", "neutral");
    expect(c.length).toBeGreaterThan(40);
  });
  it("generates a counter for compare-contrast", () => {
    const kw = extractKeywords("react vue");
    const c = generateCounterArgument("React and Vue differ.", kw, "compare-contrast", "neutral");
    expect(c.toLowerCase()).toContain("critic");
  });
});

describe("thesis-generator generateTheses", () => {
  it("generates 5+ theses for argumentative+for", () => {
    const r = generateTheses(baseInput);
    expect(r.theses.length).toBeGreaterThanOrEqual(5);
    expect(r.theses.every((t) => t.text.length > 10)).toBe(true);
  });
  it("generates 5+ theses for analytical+neutral", () => {
    const r = generateTheses({ ...baseInput, essayType: "analytical", stance: "neutral", topic: "The effects of remote work on productivity" });
    expect(r.theses.length).toBeGreaterThanOrEqual(5);
  });
  it("generates 5+ theses for expository+neutral", () => {
    const r = generateTheses({ ...baseInput, essayType: "expository", stance: "neutral", topic: "What is blockchain?" });
    expect(r.theses.length).toBeGreaterThanOrEqual(5);
  });
  it("generates 5+ theses for compare-contrast+neutral", () => {
    const r = generateTheses({ ...baseInput, essayType: "compare-contrast", stance: "neutral", topic: "React vs Vue: a comparison" });
    expect(r.theses.length).toBeGreaterThanOrEqual(5);
  });
  it("sorts by composite score descending", () => {
    const r = generateTheses(baseInput);
    for (let i = 1; i < r.theses.length; i++) {
      expect(r.theses[i - 1].scores.composite).toBeGreaterThanOrEqual(r.theses[i].scores.composite);
    }
  });
  it("includes topicKeywords and scopeNarrowing", () => {
    const r = generateTheses(baseInput);
    expect(r.topicKeywords.length).toBeGreaterThan(0);
    expect(Array.isArray(r.scopeNarrowing)).toBe(true);
  });
  it("each thesis has scores, supporting points, counter, tip", () => {
    const r = generateTheses(baseInput);
    for (const t of r.theses) {
      expect(t.scores.composite).toBeGreaterThanOrEqual(0);
      expect(t.supportingPoints.length).toBe(3);
      expect(t.counterArgument.length).toBeGreaterThan(40);
      expect(t.improvementTip.length).toBeGreaterThan(10);
    }
  });
  it("falls back to other stances when pool < 5", () => {
    // 'against' may have fewer templates; verify still produces 5
    const r = generateTheses({ ...baseInput, stance: "against" });
    expect(r.theses.length).toBeGreaterThanOrEqual(5);
  });
});

describe("thesis-generator computeStats", () => {
  it("computes thesisCount, topScore, avgScore, labels", () => {
    const r = generateTheses(baseInput);
    const s = computeStats(r);
    expect(s.thesisCount).toBeGreaterThanOrEqual(5);
    expect(s.topScore).toBeGreaterThanOrEqual(0);
    expect(s.avgScore).toBeGreaterThanOrEqual(0);
    expect(s.essayTypeLabel).toBe("Argumentative");
    expect(s.stanceLabel).toBe("For / Pro");
  });
});

describe("thesis-generator rendering", () => {
  it("renderThesesText includes topic and numbered list", () => {
    const r = generateTheses(baseInput);
    const t = renderThesesText(r);
    expect(t).toContain(baseInput.topic);
    expect(t).toContain("1.");
    expect(t).toContain("Score:");
  });
  it("renderThesesMarkdown uses # header", () => {
    const r = generateTheses(baseInput);
    const md = renderThesesMarkdown(r);
    expect(md).toContain("# Thesis Statements:");
    expect(md).toContain("**Scores:**");
    expect(md).toContain("### Supporting points");
  });
  it("renderThesesJson is valid JSON", () => {
    const r = generateTheses(baseInput);
    const j = renderThesesJson(r);
    expect(() => JSON.parse(j)).not.toThrow();
  });
});

describe("thesis-generator outline handoff", () => {
  it("buildOutlineHandoffUrl includes topic and top thesis", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const r = generateTheses(baseInput);
    const url = buildOutlineHandoffUrl(r);
    expect(url).toContain("ai-essay-outline-generator");
    expect(url).toContain("topic=");
    expect(url).toContain("type=argumentative");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty when no theses", () => {
    const r: ReturnType<typeof generateTheses> = {
      input: baseInput,
      theses: [],
      topicKeywords: [],
      scopeNarrowing: [],
      generatedAt: 0,
    };
    expect(buildOutlineHandoffUrl(r)).toBe("");
  });
});

describe("thesis-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      topic: "social media",
      stance: "for",
      essayType: "argumentative",
      thesisCount: 5,
      topScore: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        topic: "x",
        stance: "for",
        essayType: "argumentative",
        thesisCount: 5,
        topScore: i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x", stance: "for", essayType: "argumentative",
      thesisCount: 1, topScore: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("thesis-generator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "social media",
      stance: "for",
      essayType: "argumentative",
      academicLevel: "undergraduate",
      citationStyle: "apa",
    });
    expect(url).toContain("topic=social+media");
    expect(url).toContain("stance=for");
    expect(url).toContain("type=argumentative");
    expect(url).toContain("level=undergraduate");
    expect(url).toContain("cite=apa");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("topic=climate+policy&stance=against&type=analytical&level=graduate&cite=chicago");
    expect(p.topic).toBe("climate policy");
    expect(p.stance).toBe("against");
    expect(p.essayType).toBe("analytical");
    expect(p.academicLevel).toBe("graduate");
    expect(p.citationStyle).toBe("chicago");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.topic).toBe("");
    expect(p.stance).toBe("for");
    expect(p.essayType).toBe("argumentative");
    expect(p.academicLevel).toBe("undergraduate");
    expect(p.citationStyle).toBe("apa");
  });
  it("filters unknown values", () => {
    const p = parseShareUrl("topic=x&stance=banana&type=quantum&level=phd&cite=turabian");
    expect(p.stance).toBe("for");
    expect(p.essayType).toBe("argumentative");
    expect(p.academicLevel).toBe("undergraduate");
    expect(p.citationStyle).toBe("apa");
  });
});

describe("thesis-generator LLM (BYO key)", () => {
  it("buildLlmRequestBody includes essay type, stance, level, citation", () => {
    const body = buildLlmRequestBody(baseInput);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toContain("Argumentative");
    expect(body.messages[0].content).toContain("For / Pro");
    expect(body.messages[0].content).toContain("Undergraduate");
    expect(body.messages[0].content).toContain("APA");
    expect(body.messages[1].content).toBe(baseInput.topic);
  });
  it("extractLlmTheses parses numbered list", () => {
    const resp = {
      choices: [{ message: { content: "1. First thesis statement here.\n2. Second thesis statement here.\n3. Third thesis statement here.\nSure, here you go." } }],
    };
    const out = extractLlmTheses(resp);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out[0]).toBe("First thesis statement here.");
    expect(out[1]).toBe("Second thesis statement here.");
  });
  it("extractLlmTheses returns empty for bad shape", () => {
    expect(extractLlmTheses(null)).toEqual([]);
    expect(extractLlmTheses({})).toEqual([]);
    expect(extractLlmTheses({ choices: [] })).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = EssayType | Stance | AcademicLevel | CitationStyle | ThesisInput;
