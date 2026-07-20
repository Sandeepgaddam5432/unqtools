import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  REDDIT_HARD_CHAR_LIMIT,
  DEFAULT_CHAR_LIMIT,
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  ALL_ANGLES,
  RULE_RISK_LABELS,
  SUBREDDIT_PRESETS,
  SAMPLE_DRAFTS,
  normalizeInput,
  normalizeSubreddit,
  lookupSubreddit,
  extractTopic,
  countBullets,
  detectClickbaitRisk,
  detectRuleRisk,
  scoreAuthenticity,
  generateTitle,
  optimizeTitles,
  pickABPair,
  renderText,
  renderMarkdown,
  renderJson,
  renderTitlesOnly,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type Angle,
  type TitleOption,
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

describe("ai-reddit-post-title-optimizer constants", () => {
  it("exposes history key and cap of 20", () => {
    expect(HISTORY_KEY).toContain("ai-reddit-post-title-optimizer");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 5 angle labels and descriptions", () => {
    expect(Object.keys(ANGLE_LABELS)).toHaveLength(5);
    expect(Object.keys(ANGLE_DESCRIPTIONS)).toHaveLength(5);
    expect(ANGLE_LABELS.question).toBe("Question");
    expect(ANGLE_DESCRIPTIONS.ama).toContain("AMA");
  });
  it("has Reddit hard limit and default limit", () => {
    expect(REDDIT_HARD_CHAR_LIMIT).toBe(300);
    expect(DEFAULT_CHAR_LIMIT).toBe(120);
  });
  it("has 6 rule-risk labels", () => {
    expect(Object.keys(RULE_RISK_LABELS)).toHaveLength(6);
  });
  it("has subreddit presets", () => {
    expect(SUBREDDIT_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(SUBREDDIT_PRESETS.some((p) => p.name === "AskReddit")).toBe(true);
    expect(SUBREDDIT_PRESETS.some((p) => p.name === "todayilearned")).toBe(true);
  });
  it("has sample drafts", () => {
    expect(SAMPLE_DRAFTS.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_DRAFTS[0]).toHaveProperty("label");
    expect(SAMPLE_DRAFTS[0]).toHaveProperty("subreddit");
    expect(SAMPLE_DRAFTS[0]).toHaveProperty("draft");
  });
});

describe("ai-reddit-post-title-optimizer normalizeInput", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeInput("  hello   world  ")).toBe("hello world");
  });
  it("normalizes CRLF to LF", () => {
    expect(normalizeInput("a\r\nb")).toBe("a\nb");
  });
  it("handles empty", () => {
    expect(normalizeInput("")).toBe("");
  });
});

describe("ai-reddit-post-title-optimizer normalizeSubreddit", () => {
  it("strips r/ prefix", () => {
    expect(normalizeSubreddit("r/AskReddit")).toBe("askreddit");
  });
  it("lowercases", () => {
    expect(normalizeSubreddit("AskReddit")).toBe("askreddit");
  });
  it("strips non-alphanumeric", () => {
    expect(normalizeSubreddit("Ask-Reddit!")).toBe("askreddit");
  });
  it("handles empty", () => {
    expect(normalizeSubreddit("")).toBe("");
  });
});

describe("ai-reddit-post-title-optimizer lookupSubreddit", () => {
  it("finds AskReddit by alias", () => {
    const { preset, canonical } = lookupSubreddit("r/AskReddit");
    expect(preset?.name).toBe("AskReddit");
    expect(canonical).toBe("AskReddit");
  });
  it("finds IAmA by alias 'ama'", () => {
    const { preset } = lookupSubreddit("ama");
    expect(preset?.name).toBe("IAmA");
  });
  it("finds todayilearned by alias 'til'", () => {
    const { preset } = lookupSubreddit("til");
    expect(preset?.name).toBe("todayilearned");
  });
  it("returns null for unknown subreddit", () => {
    const { preset, canonical } = lookupSubreddit("some-niche-sub");
    expect(preset).toBeNull();
    expect(canonical).toBe("somenichesub");
  });
  it("handles empty", () => {
    const { preset, canonical } = lookupSubreddit("");
    expect(preset).toBeNull();
    expect(canonical).toBe("");
  });
});

describe("ai-reddit-post-title-optimizer extractTopic", () => {
  it("extracts a short topic from a draft", () => {
    const topic = extractTopic("I started lifting 6 months ago and my squat stalled at 225 lbs.");
    expect(topic.length).toBeGreaterThan(0);
    expect(topic.length).toBeLessThanOrEqual(200);
  });
  it("strips TIL prefix", () => {
    const topic = extractTopic("TIL that the Apollo computer had less RAM than a calculator.");
    expect(topic.toLowerCase()).not.toMatch(/^til\b/);
  });
  it("returns empty for empty input", () => {
    expect(extractTopic("")).toBe("");
  });
});

describe("ai-reddit-post-title-optimizer countBullets", () => {
  it("counts markdown bullets", () => {
    expect(countBullets("- a\n- b\n- c")).toBe(3);
  });
  it("counts numbered items", () => {
    expect(countBullets("1. one\n2. two\n3. three")).toBe(3);
  });
  it("falls back to default of 3", () => {
    expect(countBullets("just plain prose about a topic")).toBe(3);
  });
  it("uses comma count when >= 2", () => {
    expect(countBullets("a, b, c, d")).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-reddit-post-title-optimizer detectClickbaitRisk", () => {
  it("flags clickbait phrases", () => {
    const { score, cues } = detectClickbaitRisk("You won't believe what happened next!");
    expect(score).toBeGreaterThan(0);
    expect(cues.length).toBeGreaterThan(0);
  });
  it("flags excessive punctuation", () => {
    const { score, cues } = detectClickbaitRisk("Is this normal??!?");
    expect(score).toBeGreaterThan(0);
    expect(cues).toContain("excessive punctuation");
  });
  it("flags all-caps words", () => {
    const { cues } = detectClickbaitRisk("SHOCKING TRUTH about React");
    expect(cues.some((c) => c.includes("all-caps"))).toBe(true);
  });
  it("returns 0 for clean titles", () => {
    const { score, cues } = detectClickbaitRisk("How I broke through a squat plateau after six months");
    expect(score).toBe(0);
    expect(cues).toHaveLength(0);
  });
});

describe("ai-reddit-post-title-optimizer detectRuleRisk", () => {
  it("flags self-promo", () => {
    const risks = detectRuleRisk("Check out my YouTube channel for more");
    expect(risks).toContain("self-promo");
  });
  it("flags editorializing", () => {
    const risks = detectRuleRisk("This is the shocking truth about credit cards");
    expect(risks).toContain("editorializing");
  });
  it("flags low-effort", () => {
    const risks = detectRuleRisk("Thoughts?");
    expect(risks).toContain("low-effort");
  });
  it("returns empty for clean titles", () => {
    expect(detectRuleRisk("How I broke through a squat plateau")).toEqual([]);
  });
});

describe("ai-reddit-post-title-optimizer scoreAuthenticity", () => {
  it("scores a clean first-person title highly", () => {
    const score = scoreAuthenticity("How I broke through a squat plateau after six months of lifting");
    expect(score).toBeGreaterThanOrEqual(70);
  });
  it("penalizes clickbait", () => {
    const score = scoreAuthenticity("You won't believe this shocking truth!!");
    expect(score).toBeLessThan(60);
  });
  it("penalizes self-promo", () => {
    const score = scoreAuthenticity("Subscribe to my channel for daily fitness tips");
    expect(score).toBeLessThan(60);
  });
  it("returns 0 for empty", () => {
    expect(scoreAuthenticity("")).toBe(0);
  });
});

describe("ai-reddit-post-title-optimizer generateTitle", () => {
  const draft = "I switched from Redux to Zustand and cut my boilerplate by 60%. Sharing migration patterns.";
  it("generates a question title", () => {
    const t = generateTitle(draft, "question", null);
    expect(t.angle).toBe("question");
    expect(t.text.length).toBeGreaterThan(0);
    expect(t.charCount).toBe(t.text.length);
  });
  it("generates a list title with a number", () => {
    const t = generateTitle(draft, "list", null);
    expect(t.angle).toBe("list");
    expect(/\d+/.test(t.text)).toBe(true);
  });
  it("respects subreddit char limit", () => {
    const preset = SUBREDDIT_PRESETS.find((p) => p.name === "explainlikeimfive")!;
    const t = generateTitle(draft, "question", preset);
    expect(t.charLimit).toBe(preset.charLimit);
  });
  it("prefixes TIL on todayilearned", () => {
    const preset = SUBREDDIT_PRESETS.find((p) => p.name === "todayilearned")!;
    const t = generateTitle("Apollo computer had less RAM than a calculator", "story", preset);
    expect(/^TIL\b/.test(t.text)).toBe(true);
  });
  it("prefixes ELI5 on explainlikeimfive", () => {
    const preset = SUBREDDIT_PRESETS.find((p) => p.name === "explainlikeimfive")!;
    const t = generateTitle("how do credit card chips work", "question", preset);
    expect(/^ELI5/.test(t.text)).toBe(true);
  });
  it("produces a whyItFits note", () => {
    const t = generateTitle(draft, "ama", null);
    expect(t.whyItFits.length).toBeGreaterThan(10);
  });
});

describe("ai-reddit-post-title-optimizer optimizeTitles", () => {
  it("generates 5 title options", () => {
    const r = optimizeTitles("My squat stalled after 6 months, what helped you?", "fitness");
    expect(r.titles).toHaveLength(5);
    expect(r.known).toBe(true);
    expect(r.canonicalSubreddit).toBe("fitness");
  });
  it("marks unknown subreddits", () => {
    const r = optimizeTitles("Some draft here about a thing", "totally-niche-sub");
    expect(r.known).toBe(false);
  });
  it("extracts topic", () => {
    const r = optimizeTitles("I switched from Redux to Zustand and saved time.", "programming");
    expect(r.topic.length).toBeGreaterThan(0);
  });
  it("sorts titles by score desc", () => {
    const r = optimizeTitles("How do I break a plateau", "fitness");
    for (let i = 1; i < r.titles.length; i++) {
      expect(r.titles[i - 1].score).toBeGreaterThanOrEqual(r.titles[i].score);
    }
  });
  it("returns rule reminders", () => {
    const r = optimizeTitles("Draft", "AskReddit");
    expect(r.rulesReminder.length).toBeGreaterThan(0);
  });
  it("returns rule reminders for unknown subreddits too", () => {
    const r = optimizeTitles("Draft", "unknown-sub-xyz");
    expect(r.rulesReminder.length).toBeGreaterThan(0);
  });
  it("all titles have a valid angle", () => {
    const r = optimizeTitles("Draft text here", "technology");
    for (const t of r.titles) expect(ALL_ANGLES).toContain(t.angle);
  });
});

describe("ai-reddit-post-title-optimizer pickABPair", () => {
  it("picks two titles with different angles", () => {
    const r = optimizeTitles("My squat stalled", "fitness");
    const pair = pickABPair(r.titles);
    expect(pair).not.toBeNull();
    if (pair) {
      expect(pair[0].angle).not.toBe(pair[1].angle);
    }
  });
  it("returns null when fewer than 2 titles", () => {
    const single: TitleOption[] = [
      { angle: "question", text: "x", charCount: 1, charLimit: 100, overLimit: false, authenticity: 80, clickbaitRisk: 0, ruleRisks: [], whyItFits: "n", score: 80 },
    ];
    expect(pickABPair(single)).toBeNull();
  });
  it("optimizeTitles returns an A/B pair when titles exist", () => {
    const r = optimizeTitles("Some draft", "fitness");
    expect(r.abPair).not.toBeNull();
  });
});

describe("ai-reddit-post-title-optimizer renderers", () => {
  const r = optimizeTitles("My squat stalled after six months", "fitness");
  it("renderText contains angle labels and scores", () => {
    const text = renderText(r);
    expect(text).toContain("Question");
    expect(text).toContain("/100");
    expect(text).toContain("Topic:");
  });
  it("renderMarkdown contains a table", () => {
    const md = renderMarkdown(r);
    expect(md).toContain("| # | Angle | Score");
    expect(md).toContain("A/B pair");
    expect(md).toContain("Rule reminders");
  });
  it("renderJson is valid JSON", () => {
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.titles).toHaveLength(5);
    expect(parsed.canonicalSubreddit).toBe("fitness");
  });
  it("renderTitlesOnly is one per line", () => {
    const text = renderTitlesOnly(r);
    expect(text.split("\n").length).toBe(5);
  });
});

describe("ai-reddit-post-title-optimizer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, subreddit: "fitness", topic: "squat", titleCount: 5, topScore: 80, topTitle: "x" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, subreddit: "x", topic: "x", titleCount: 5, topScore: 70, topTitle: "t" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, subreddit: "x", topic: "x", titleCount: 5, topScore: 70, topTitle: "t" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-reddit-post-title-optimizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("my draft", "AskReddit");
    expect(url).toContain("d=my+draft");
    expect(url).toContain("r=AskReddit");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=my+draft&r=AskReddit");
    expect(p.draft).toBe("my draft");
    expect(p.subreddit).toBe("AskReddit");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ draft: "", subreddit: "" });
  });
});

describe("ai-reddit-post-title-optimizer LLM helpers", () => {
  it("buildLlmPrompt includes subreddit and rules", () => {
    const prompt = buildLlmPrompt("my draft text", "AskReddit");
    expect(prompt).toContain("r/AskReddit");
    expect(prompt).toContain("USER DRAFT");
    expect(prompt).toContain("my draft text");
  });
  it("buildLlmPrompt handles unknown subreddit gracefully", () => {
    const prompt = buildLlmPrompt("draft", "unknown-niche");
    expect(prompt).toContain("r/unknown-niche");
  });
  it("parseLlmResult parses a JSON array", () => {
    const out = parseLlmResult('[{"angle":"question","title":"Has anyone tried X?"}]');
    expect(out).toHaveLength(1);
    expect(out[0].angle).toBe("question");
    expect(out[0].title).toContain("Has anyone");
  });
  it("parseLlmResult returns empty for invalid JSON", () => {
    expect(parseLlmResult("not json")).toEqual([]);
  });
  it("parseLlmResult filters out empty titles", () => {
    const out = parseLlmResult('[{"angle":"question","title":""}]');
    expect(out).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = Angle;
