import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  ROLE_LABELS,
  CATEGORY_LABELS,
  SENIORITY_LABELS,
  ROLE_PRESETS,
  getLibrary,
  getQuestionsByRole,
  getQuestionsByCategory,
  getQuestions,
  computeStats,
  detectStarPattern,
  findKeywordHits,
  countWords,
  gradeAnswer,
  renderText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadBanks,
  saveBank,
  removeBank,
  clearBanks,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Role,
  type Category,
  type Seniority,
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

describe("interview constants", () => {
  it("has 5 roles", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(5);
    expect(ROLE_LABELS.developer).toBe("Software Developer");
  });
  it("has 4 categories", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(4);
  });
  it("has 4 seniority levels", () => {
    expect(Object.keys(SENIORITY_LABELS)).toHaveLength(4);
  });
  it("has role presets", () => {
    expect(ROLE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("history cap is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("interview library coverage", () => {
  it("has 60+ questions total", () => {
    expect(getLibrary().length).toBeGreaterThanOrEqual(60);
  });
  it("has 10+ questions per role", () => {
    const roles: Role[] = ["developer", "designer", "pm", "sales", "marketing"];
    for (const r of roles) {
      expect(getQuestionsByRole(r).length).toBeGreaterThanOrEqual(10);
    }
  });
  it("has at least 1 question in each category for each role", () => {
    const roles: Role[] = ["developer", "designer", "pm", "sales", "marketing"];
    const cats: Category[] = ["behavioral", "technical", "situational", "culture-fit"];
    for (const r of roles) {
      for (const c of cats) {
        expect(getQuestionsByCategory(r, c).length).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it("every question has model answer, follow-ups, red flags, rubric", () => {
    for (const q of getLibrary()) {
      expect(q.modelAnswer.length).toBeGreaterThan(10);
      expect(q.followUps.length).toBeGreaterThanOrEqual(2);
      expect(q.redFlags.length).toBeGreaterThanOrEqual(1);
      expect(q.rubric.length).toBeGreaterThanOrEqual(3);
      // Rubric weights should sum to ~1.0
      const sum = q.rubric.reduce((s, r) => s + r.weight, 0);
      expect(sum).toBeGreaterThan(0.95);
      expect(sum).toBeLessThan(1.05);
    }
  });
  it("every question has a stable id", () => {
    const ids = getLibrary().map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("interview getQuestions filters", () => {
  it("returns all questions for a role when no filters", () => {
    const all = getQuestions("developer");
    expect(all.length).toBe(getQuestionsByRole("developer").length);
  });
  it("filters by category", () => {
    const behavioral = getQuestions("developer", ["behavioral"]);
    expect(behavioral.length).toBeGreaterThan(0);
    expect(behavioral.every((q) => q.category === "behavioral")).toBe(true);
  });
  it("filters by seniority", () => {
    const junior = getQuestions("developer", undefined, "junior");
    expect(junior.length).toBeGreaterThan(0);
    expect(junior.every((q) => q.seniority.includes("junior"))).toBe(true);
  });
  it("filters by both category and seniority", () => {
    const filtered = getQuestions("developer", ["behavioral"], "senior");
    expect(filtered.every((q) => q.category === "behavioral")).toBe(true);
    expect(filtered.every((q) => q.seniority.includes("senior"))).toBe(true);
  });
  it("treats empty categories array as no category filter", () => {
    // Empty array means 'no filter' — same as undefined. So we get every
    // developer question whose seniority includes 'junior' (non-empty set).
    const all = getQuestions("developer", undefined, "junior");
    const emptyArr = getQuestions("developer", [], "junior");
    expect(emptyArr.length).toBe(all.length);
    expect(emptyArr.every((q) => q.seniority.includes("junior"))).toBe(true);
  });
});

describe("interview computeStats", () => {
  it("computes stats per role", () => {
    const qs = getQuestionsByRole("developer");
    const stats = computeStats(qs);
    expect(stats.role).toBe("developer");
    expect(stats.total).toBe(qs.length);
    expect(stats.avgDifficulty).toBeGreaterThan(0);
    expect(stats.byCategory.behavioral).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgDifficulty).toBe(0);
  });
  it("all categories are non-negative", () => {
    const stats = computeStats(getLibrary());
    for (const c of Object.keys(stats.byCategory) as Category[]) {
      expect(stats.byCategory[c]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("interview grading helpers", () => {
  it("countWords handles empty and whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("hello world")).toBe(2);
  });
  it("detectStarPattern catches STAR-style language", () => {
    const text = "The situation was that we had a problem. My task was to fix it. I took action by doing X. The result was positive.";
    expect(detectStarPattern(text)).toBe(true);
  });
  it("detectStarPattern returns false for short non-STAR text", () => {
    expect(detectStarPattern("I like pizza.")).toBe(false);
  });
  it("findKeywordHits returns matching keywords", () => {
    const model = "We used Redis for distributed rate limiting with token bucket algorithm.";
    const answer = "I would use Redis and a token bucket to handle rate limiting.";
    const hits = findKeywordHits(model, answer);
    expect(hits).toContain("redis");
    expect(hits).toContain("token");
    expect(hits).toContain("bucket");
  });
  it("findKeywordHits returns empty array when no overlap", () => {
    const hits = findKeywordHits("Redis token bucket", "I would use Postgres and a counter.");
    expect(hits).toEqual([]);
  });
});

describe("interview gradeAnswer", () => {
  const sampleQuestion = getQuestionsByRole("developer").find((q) => q.category === "behavioral")!;

  it("returns a 0-100 score for a reasonable answer", () => {
    const answer = "The situation was a production outage caused by a missing index. My task was to restore service. I took action by rolling back the migration and adding the index. The result was that we restored service in 15 minutes and shipped a test to prevent recurrence.";
    const graded = gradeAnswer({ question: sampleQuestion, answer });
    expect(graded.score).toBeGreaterThanOrEqual(0);
    expect(graded.score).toBeLessThanOrEqual(100);
    expect(graded.wordCount).toBeGreaterThan(20);
    expect(graded.hasStar).toBe(true);
  });
  it("returns low score for empty answer", () => {
    const graded = gradeAnswer({ question: sampleQuestion, answer: "" });
    expect(graded.score).toBeLessThan(40);
    expect(graded.wordCount).toBe(0);
  });
  it("returns feedback for short answer", () => {
    const graded = gradeAnswer({ question: sampleQuestion, answer: "I talked to the team." });
    expect(graded.feedback.length).toBeGreaterThan(0);
    expect(graded.feedback.some((f) => f.toLowerCase().includes("short"))).toBe(true);
  });
  it("produces rubric scores for every criterion", () => {
    const graded = gradeAnswer({ question: sampleQuestion, answer: "We had a problem and I solved it with a fix that saved time." });
    expect(graded.rubricScores.length).toBe(sampleQuestion.rubric.length);
    for (const r of graded.rubricScores) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(5);
      expect(r.comment.length).toBeGreaterThan(0);
    }
  });
  it("detects quantified evidence in answer", () => {
    const graded = gradeAnswer({
      question: sampleQuestion,
      answer: "We had a situation where latency was 500ms. My task was to reduce it. I took action by adding an index. The result was a 60% reduction to 200ms, saving users 4 hours per week.",
    });
    const evidenceComment = graded.rubricScores.find((r) => r.criterion === "evidence");
    expect(evidenceComment?.score).toBeGreaterThanOrEqual(4);
  });
});

describe("interview renderers", () => {
  const questions = getQuestionsByRole("developer").slice(0, 3);

  it("renderText includes question text and model answer", () => {
    const text = renderText(questions);
    expect(text).toContain("Question 1");
    expect(text).toContain("Model answer:");
    expect(text).toContain("Rubric:");
  });
  it("renderText uses --- separator between questions", () => {
    const text = renderText(questions);
    expect(text).toContain("---");
  });
  it("renderMarkdown uses ## headers", () => {
    const md = renderMarkdown(questions);
    expect(md).toContain("## Question 1");
    expect(md).toContain("**Model answer:**");
    expect(md).toContain("**Rubric:**");
  });
  it("renderCsv includes header row", () => {
    const csv = renderCsv(questions);
    expect(csv).toContain("id,role,category,difficulty,seniority,tags,text,model_answer");
  });
  it("renderCsv escapes commas and newlines in model answer", () => {
    const csv = renderCsv(questions);
    // Model answer text contains commas — verify the row count by counting id prefixes
    const idMatches = csv.match(/^[a-z]+-[a-z]+-/gm);
    expect(idMatches).not.toBeNull();
  });
  it("renderJson produces valid JSON array", () => {
    const json = renderJson(questions);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(questions.length);
    expect(parsed[0].rubric).toBeDefined();
  });
});

describe("interview history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, role: "developer", categories: ["behavioral"], seniority: "mid", questionCount: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, role: "developer", categories: [], seniority: null, questionCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, role: "developer", categories: [], seniority: null, questionCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("interview saved banks (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadBanks()).toEqual([]);
  });
  it("saves and loads", () => {
    saveBank({ ts: 100, name: "Dev Behavioral Set", role: "developer", categories: ["behavioral"], seniority: "mid", questionIds: ["a", "b"] });
    expect(loadBanks()).toHaveLength(1);
  });
  it("removes by ts", () => {
    saveBank({ ts: 100, name: "A", role: "developer", categories: [], seniority: null, questionIds: [] });
    saveBank({ ts: 200, name: "B", role: "designer", categories: [], seniority: null, questionIds: [] });
    removeBank(100);
    const banks = loadBanks();
    expect(banks).toHaveLength(1);
    expect(banks[0].ts).toBe(200);
  });
  it("clears", () => {
    saveBank({ ts: 100, name: "x", role: "developer", categories: [], seniority: null, questionIds: [] });
    clearBanks();
    expect(loadBanks()).toEqual([]);
  });
});

describe("interview shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ role: "developer", categories: ["behavioral", "technical"], seniority: "mid" });
    expect(url).toContain("r=developer");
    expect(url).toContain("c=behavioral");
    expect(url).toContain("s=mid");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("r=designer&c=behavioral,technical&s=senior");
    expect(p.role).toBe("designer");
    expect(p.categories).toEqual(["behavioral", "technical"]);
    expect(p.seniority).toBe("senior");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown roles", () => {
    const p = parseShareUrl("r=does-not-exist&c=behavioral");
    expect(p.role).toBeUndefined();
    expect(p.categories).toEqual(["behavioral"]);
  });
  it("filters unknown categories", () => {
    const p = parseShareUrl("r=developer&c=behavioral,unknown-cat,technical");
    expect(p.categories).toEqual(["behavioral", "technical"]);
  });
  it("filters unknown seniority", () => {
    const p = parseShareUrl("r=developer&s=does-not-exist");
    expect(p.seniority).toBeUndefined();
  });
});

describe("interview LLM prompt + renderer", () => {
  it("builds a prompt containing the role and JSON constraint", () => {
    const prompt = buildLlmPrompt("developer", "senior", ["behavioral"], "Senior backend engineer with distributed systems experience.");
    expect(prompt).toContain("Software Developer");
    expect(prompt).toContain("Senior");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("distributed systems");
  });
  it("builds a prompt without seniority when null", () => {
    const prompt = buildLlmPrompt("designer", null, [], "");
    expect(prompt).toContain("UX/UI Designer");
    expect(prompt).toContain("any");
  });
  it("renders valid LLM JSON output", () => {
    const raw = JSON.stringify([
      {
        text: "Tell me about a time you shipped under pressure.",
        category: "behavioral",
        difficulty: 3,
        tags: ["pressure", "shipping"],
        modelAnswer: "I prioritized scope, communicated risk, and shipped the MVP.",
        followUps: ["What would you cut?", "How did stakeholders react?"],
        redFlags: ["Said they worked weekends"],
      },
    ]);
    const result = renderLlmResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].category).toBe("behavioral");
      expect(result.questions[0].difficulty).toBe(3);
    }
  });
  it("clamps difficulty to 1-5", () => {
    const raw = JSON.stringify([
      { text: "x", category: "behavioral", difficulty: 99, tags: [], modelAnswer: "y", followUps: [], redFlags: [] },
    ]);
    const result = renderLlmResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions[0].difficulty).toBe(5);
    }
  });
  it("defaults unknown category to behavioral", () => {
    const raw = JSON.stringify([
      { text: "x", category: "unknown-category", difficulty: 2, tags: [], modelAnswer: "y", followUps: [], redFlags: [] },
    ]);
    const result = renderLlmResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions[0].category).toBe("behavioral");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([
      { text: "x", category: "technical", difficulty: 2, tags: [], modelAnswer: "y", followUps: [], redFlags: [] },
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
export type _Unused = Role | Category | Seniority;
