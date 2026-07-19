import { describe, it, expect, beforeEach } from "vitest";
import {
  COUNTRY_DB,
  TOPIC_LABELS,
  REGION_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  CONTINENT_LABELS,
  filterByRegion,
  filterByDifficulty,
  searchCountries,
  getCountryByCode,
  getCountryByName,
  mulberry32,
  shuffleWith,
  shuffle,
  getQuestionPrompt,
  getAnswer,
  generateDistractors,
  generateQuestion,
  generateQuiz,
  normalizeAnswer,
  validateAnswer,
  computeScore,
  computeSummaryStats,
  renderText,
  renderHtml,
  renderCsv,
  getFlagDescriptions,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Topic,
  type Region,
  type Difficulty,
  type QuestionType,
  type Continent,
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

describe("geography-quiz constants", () => {
  it("has 100+ countries in database", () => {
    expect(COUNTRY_DB.length).toBeGreaterThanOrEqual(100);
  });
  it("each country has all 6 attributes", () => {
    for (const c of COUNTRY_DB) {
      expect(c.code.length).toBeGreaterThanOrEqual(2);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.capital.length).toBeGreaterThan(0);
      expect(c.currency.length).toBeGreaterThan(0);
      expect(c.language.length).toBeGreaterThan(0);
      expect(c.continent.length).toBeGreaterThan(0);
      expect(typeof c.population).toBe("number");
      expect(c.flagDesc.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(c.fame);
    }
  });
  it("has unique country codes", () => {
    const codes = COUNTRY_DB.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("has 6 topics", () => {
    expect(Object.keys(TOPIC_LABELS)).toHaveLength(6);
  });
  it("has 8 regions", () => {
    expect(Object.keys(REGION_LABELS)).toHaveLength(8);
  });
  it("has 3 difficulty levels", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("has 2 question types", () => {
    expect(Object.keys(QUESTION_TYPE_LABELS)).toHaveLength(2);
  });
  it("has 7 continents in continent labels", () => {
    expect(Object.keys(CONTINENT_LABELS)).toHaveLength(7);
  });
  it("spans all 6 inhabited continents", () => {
    const continents = new Set(COUNTRY_DB.map((c) => c.continent));
    expect(continents.has("africa")).toBe(true);
    expect(continents.has("asia")).toBe(true);
    expect(continents.has("europe")).toBe(true);
    expect(continents.has("north-america")).toBe(true);
    expect(continents.has("south-america")).toBe(true);
    expect(continents.has("oceania")).toBe(true);
  });
  it("includes well-known countries (US, UK, Japan)", () => {
    expect(getCountryByCode("US")).toBeDefined();
    expect(getCountryByCode("GB")).toBeDefined();
    expect(getCountryByCode("JP")).toBeDefined();
  });
});

describe("geography-quiz filterByRegion", () => {
  it("returns all countries for world", () => {
    expect(filterByRegion(COUNTRY_DB, "world").length).toBe(COUNTRY_DB.length);
  });
  it("filters by continent", () => {
    const african = filterByRegion(COUNTRY_DB, "africa");
    expect(african.length).toBeGreaterThan(5);
    expect(african.every((c) => c.continent === "africa")).toBe(true);
  });
  it("returns empty for antarctica (no countries)", () => {
    expect(filterByRegion(COUNTRY_DB, "antarctica")).toEqual([]);
  });
});

describe("geography-quiz filterByDifficulty", () => {
  it("easy = only fame-1 countries", () => {
    const easy = filterByDifficulty(COUNTRY_DB, "easy");
    expect(easy.length).toBeGreaterThan(10);
    expect(easy.every((c) => c.fame === 1)).toBe(true);
  });
  it("medium = fame 1 or 2", () => {
    const med = filterByDifficulty(COUNTRY_DB, "medium");
    expect(med.every((c) => c.fame <= 2)).toBe(true);
    expect(med.length).toBeGreaterThan(easyCount());
  });
  it("hard = all countries", () => {
    const hard = filterByDifficulty(COUNTRY_DB, "hard");
    expect(hard.length).toBe(COUNTRY_DB.length);
  });
});

function easyCount(): number {
  return COUNTRY_DB.filter((c) => c.fame === 1).length;
}

describe("geography-quiz searchCountries", () => {
  it("matches country name", () => {
    expect(searchCountries(COUNTRY_DB, "United States")).toHaveLength(1);
  });
  it("matches capital", () => {
    const r = searchCountries(COUNTRY_DB, "Paris");
    expect(r.some((c) => c.name === "France")).toBe(true);
  });
  it("returns all for empty query", () => {
    expect(searchCountries(COUNTRY_DB, "").length).toBe(COUNTRY_DB.length);
  });
  it("case insensitive", () => {
    expect(searchCountries(COUNTRY_DB, "japan")).toHaveLength(1);
  });
});

describe("geography-quiz lookups", () => {
  it("getCountryByCode finds by code", () => {
    expect(getCountryByCode("us")?.name).toBe("United States");
    expect(getCountryByCode("US")?.name).toBe("United States");
  });
  it("getCountryByCode returns undefined for unknown", () => {
    expect(getCountryByCode("ZZ")).toBeUndefined();
  });
  it("getCountryByName finds by name", () => {
    expect(getCountryByName("Japan")?.code).toBe("JP");
  });
});

describe("geography-quiz shuffle / rng", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });
  it("shuffleWith preserves length and elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffleWith(arr, mulberry32(1));
    expect(out).toHaveLength(5);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("shuffle with same seed is deterministic", () => {
    const arr = [1, 2, 3, 4, 5];
    const a = shuffleWith(arr, mulberry32(7));
    const b = shuffleWith(arr, mulberry32(7));
    expect(a).toEqual(b);
  });
  it("shuffle (Math.random) returns same elements", () => {
    const arr = [1, 2, 3];
    const out = shuffle(arr);
    expect(out.sort()).toEqual([1, 2, 3]);
  });
});

describe("geography-quiz question prompt + answer", () => {
  const us = getCountryByCode("US")!;
  it("capitals prompt asks about capital", () => {
    expect(getQuestionPrompt(us, "capitals")).toContain("capital of United States");
    expect(getAnswer(us, "capitals")).toBe("Washington, D.C.");
  });
  it("currencies prompt asks about currency", () => {
    expect(getAnswer(us, "currencies")).toBe("USD");
  });
  it("languages prompt asks about language", () => {
    expect(getAnswer(us, "languages")).toBe("English");
  });
  it("continents answer is human-readable label", () => {
    expect(getAnswer(us, "continents")).toBe("North America");
  });
  it("populations answer is formatted with 'million'", () => {
    expect(getAnswer(us, "populations")).toBe("331 million");
  });
  it("flags-description prompt shows description and answer is country name", () => {
    const p = getQuestionPrompt(us, "flags-description");
    expect(p).toContain(us.flagDesc);
    expect(getAnswer(us, "flags-description")).toBe("United States");
  });
});

describe("geography-quiz generateDistractors", () => {
  it("returns 3 distractors for MC", () => {
    const us = getCountryByCode("US")!;
    const d = generateDistractors(us, COUNTRY_DB, 3, "capitals", mulberry32(1));
    expect(d).toHaveLength(3);
    expect(d).not.toContain("Washington, D.C.");
  });
  it("returns continent names for continents topic", () => {
    const us = getCountryByCode("US")!;
    const d = generateDistractors(us, COUNTRY_DB, 3, "continents", mulberry32(1));
    expect(d).toHaveLength(3);
    expect(d).not.toContain("North America");
  });
  it("dedupes distractors", () => {
    // For currencies, many countries share the same currency (e.g. EUR)
    const fr = getCountryByCode("FR")!;
    const d = generateDistractors(fr, COUNTRY_DB, 3, "currencies", mulberry32(1));
    expect(new Set(d).size).toBe(d.length);
  });
});

describe("geography-quiz generateQuestion", () => {
  it("MC question has 4 options with correct answer included", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain("Washington, D.C.");
    expect(q.options[q.correctIndex]).toBe("Washington, D.C.");
    expect(q.type).toBe("multiple-choice");
  });
  it("type-answer question has empty options", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "type-answer", mulberry32(1));
    expect(q.options).toEqual([]);
    expect(q.correctIndex).toBe(-1);
    expect(q.type).toBe("type-answer");
  });
  it("continents MC question has unique options", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "continents", COUNTRY_DB, "multiple-choice", mulberry32(1));
    expect(new Set(q.options).size).toBe(4);
  });
});

describe("geography-quiz generateQuiz", () => {
  it("generates requested number of questions", () => {
    const qs = generateQuiz({
      topic: "capitals",
      region: "world",
      count: 5,
      difficulty: "easy",
      type: "multiple-choice",
      seed: 42,
    });
    expect(qs).toHaveLength(5);
  });
  it("caps at available pool size", () => {
    const qs = generateQuiz({
      topic: "capitals",
      region: "oceania",
      count: 100,
      difficulty: "easy",
      type: "multiple-choice",
      seed: 1,
    });
    expect(qs.length).toBeLessThanOrEqual(100);
    expect(qs.length).toBeGreaterThanOrEqual(1);
  });
  it("returns empty for region with no countries (antarctica)", () => {
    const qs = generateQuiz({
      topic: "capitals",
      region: "antarctica",
      count: 5,
      difficulty: "hard",
      type: "multiple-choice",
      seed: 1,
    });
    expect(qs).toEqual([]);
  });
  it("is deterministic with same seed", () => {
    const a = generateQuiz({ topic: "capitals", region: "world", count: 5, difficulty: "easy", type: "multiple-choice", seed: 7 });
    const b = generateQuiz({ topic: "capitals", region: "world", count: 5, difficulty: "easy", type: "multiple-choice", seed: 7 });
    expect(a.map((q) => q.country.code)).toEqual(b.map((q) => q.country.code));
  });
});

describe("geography-quiz validateAnswer", () => {
  it("normalizes case", () => {
    expect(normalizeAnswer("Washington, D.C.")).toBe("washington dc");
    expect(normalizeAnswer("Tokyo")).toBe("tokyo");
  });
  it("expands 'st.' to 'saint'", () => {
    expect(normalizeAnswer("St. Louis")).toBe("saint louis");
  });
  it("converts & to and", () => {
    expect(normalizeAnswer("Trinidad & Tobago")).toBe("trinidad and tobago");
  });
  it("validates exact match case-insensitive", () => {
    expect(validateAnswer("tokyo", "Tokyo")).toBe(true);
  });
  it("validates with punctuation removed", () => {
    expect(validateAnswer("washington dc", "Washington, D.C.")).toBe(true);
  });
  it("rejects wrong answer", () => {
    expect(validateAnswer("Osaka", "Tokyo")).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateAnswer("", "Tokyo")).toBe(false);
  });
});

describe("geography-quiz computeScore", () => {
  it("computes MC score", () => {
    const us = getCountryByCode("US")!;
    const q1 = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const q2 = generateQuestion(getCountryByCode("JP")!, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(2));
    const result = computeScore([q1, q2], [q1.correctIndex, -1]);
    expect(result.total).toBe(2);
    expect(result.correct).toBe(1);
    expect(result.percentage).toBe(50);
  });
  it("computes type-answer score with fuzzy match", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "type-answer", mulberry32(1));
    const result = computeScore([q], ["washington dc"]);
    expect(result.correct).toBe(1);
  });
  it("breaks down by region", () => {
    const us = getCountryByCode("US")!;
    const fr = getCountryByCode("FR")!;
    const q1 = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const q2 = generateQuestion(fr, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(2));
    const result = computeScore([q1, q2], [q1.correctIndex, q2.correctIndex]);
    expect(Object.keys(result.byRegion)).toHaveLength(2);
    expect(result.byRegion["north-america"].correct).toBe(1);
    expect(result.byRegion["europe"].correct).toBe(1);
  });
  it("returns zero for empty questions", () => {
    const r = computeScore([], []);
    expect(r.total).toBe(0);
    expect(r.percentage).toBe(0);
  });
});

describe("geography-quiz computeSummaryStats", () => {
  it("computes accuracy and hardest region", () => {
    const us = getCountryByCode("US")!;
    const fr = getCountryByCode("FR")!;
    const q1 = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const q2 = generateQuestion(fr, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(2));
    const result = computeScore([q1, q2], [q1.correctIndex, -1]);
    const stats = computeSummaryStats(result);
    expect(stats.total).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.accuracy).toBe(50);
    expect(stats.hardestRegion).toBe("europe");
    expect(stats.hardestAccuracy).toBe(0);
  });
  it("returns null hardest for empty result", () => {
    const stats = computeSummaryStats({ correct: 0, total: 0, percentage: 0, byRegion: {} });
    expect(stats.hardestRegion).toBeNull();
    expect(stats.hardestAccuracy).toBeNull();
  });
});

describe("geography-quiz renderText", () => {
  it("renders text quiz with prompts and answers", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const text = renderText([q]);
    expect(text).toContain("Q1.");
    expect(text).toContain("capital of United States");
    expect(text).toContain("Washington, D.C.");
    expect(text).toContain("A)");
  });
  it("type-answer question has no options", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "type-answer", mulberry32(1));
    const text = renderText([q]);
    expect(text).toContain("Answer:");
    expect(text).not.toContain("A)");
  });
  it("handles empty", () => {
    expect(renderText([])).toBe("(no questions)");
  });
});

describe("geography-quiz renderHtml", () => {
  it("renders valid HTML document", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const html = renderHtml([q], "My Quiz");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>My Quiz</title>");
    expect(html).toContain("capital of United States");
    expect(html).toContain("Washington, D.C.");
  });
  it("escapes HTML in content", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "flags-description", COUNTRY_DB, "type-answer", mulberry32(1));
    const html = renderHtml([q]);
    // Flag desc contains commas and quotes which should be escaped
    expect(html).toContain("&quot;");
  });
});

describe("geography-quiz renderCsv", () => {
  it("renders CSV header", () => {
    expect(renderCsv([])).toContain("question,correct_answer,option_a,option_b,option_c,option_d,type,continent");
  });
  it("renders question rows", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const csv = renderCsv([q]);
    expect(csv).toContain("Washington, D.C.");
    expect(csv).toContain("multiple-choice");
    expect(csv).toContain("north-america");
  });
  it("escapes commas in fields", () => {
    const us = getCountryByCode("US")!;
    const q = generateQuestion(us, "capitals", COUNTRY_DB, "multiple-choice", mulberry32(1));
    const csv = renderCsv([q]);
    // "What is the capital of United States?" has no commas, but "Washington, D.C." does
    expect(csv).toContain('"Washington, D.C."');
  });
});

describe("geography-quiz getFlagDescriptions", () => {
  it("returns flag descriptions for countries", () => {
    const list = getFlagDescriptions(COUNTRY_DB.slice(0, 5));
    expect(list).toHaveLength(5);
    expect(list[0].name.length).toBeGreaterThan(0);
    expect(list[0].flagDesc.length).toBeGreaterThan(0);
    expect(list[0].continent).toBeDefined();
  });
});

describe("geography-quiz history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      topic: "capitals",
      region: "world",
      difficulty: "easy",
      type: "multiple-choice",
      total: 10,
      correct: 8,
      percentage: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        topic: "capitals",
        region: "world",
        difficulty: "easy",
        type: "multiple-choice",
        total: 10,
        correct: 8,
        percentage: 80,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "capitals", region: "world", difficulty: "easy", type: "multiple-choice",
      total: 1, correct: 1, percentage: 100,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("geography-quiz shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "capitals",
      region: "africa",
      count: 15,
      difficulty: "hard",
      type: "type-answer",
    });
    expect(url).toContain("topic=capitals");
    expect(url).toContain("region=africa");
    expect(url).toContain("count=15");
    expect(url).toContain("difficulty=hard");
    expect(url).toContain("type=type-answer");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("topic=capitals&region=africa&count=15&difficulty=hard&type=type-answer");
    expect(p.topic).toBe("capitals");
    expect(p.region).toBe("africa");
    expect(p.count).toBe(15);
    expect(p.difficulty).toBe("hard");
    expect(p.type).toBe("type-answer");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid topic", () => {
    const p = parseShareUrl("topic=invalid");
    expect(p.topic).toBeUndefined();
  });
  it("filters invalid region", () => {
    const p = parseShareUrl("region=mars");
    expect(p.region).toBeUndefined();
  });
  it("filters invalid difficulty", () => {
    const p = parseShareUrl("difficulty=extreme");
    expect(p.difficulty).toBeUndefined();
  });
  it("filters invalid count (zero or NaN)", () => {
    const p1 = parseShareUrl("count=0");
    expect(p1.count).toBeUndefined();
    const p2 = parseShareUrl("count=abc");
    expect(p2.count).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = Topic | Region | Difficulty | QuestionType | Continent;
