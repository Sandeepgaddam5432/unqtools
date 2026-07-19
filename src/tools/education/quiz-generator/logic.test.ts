import { describe, it, expect, beforeEach } from "vitest";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DEFAULT_PASSING_SCORE,
  QUIZ_PRESETS,
  normalizeText,
  isDifficulty,
  isTrueFalse,
  makeQuestionId,
  makeQuestion,
  convertTrueFalseToMC,
  parseJsonQuestions,
  parseQuestions,
  validateQuiz,
  shuffle,
  shuffleQuestions,
  shuffleOptions,
  shuffleAllOptions,
  calculateScore,
  determinePassFail,
  recordAnswer,
  tallyAnswers,
  generateFeedback,
  generateAllFeedback,
  initQuizState,
  answerQuestion,
  skipQuestion,
  goToQuestion,
  finishQuiz,
  isFinished,
  recordStart,
  recordEnd,
  computeDuration,
  formatDuration,
  computeSummary,
  renderText,
  renderHtml,
  renderCsv,
  renderSource,
  getQuizPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Question,
  type Quiz,
  type Difficulty,
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

function makeSimpleQuiz(): Quiz {
  return {
    title: "Test Quiz",
    passingScore: 70,
    questions: parseQuestions(
      "Capital of France?|Paris|London|Berlin|Madrid|easy\n2+2?|4|3|5|6|easy",
    ),
  };
}

describe("quiz-generator constants", () => {
  it("has 3 difficulties", () => {
    expect(DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
  });
  it("has labels for all difficulties", () => {
    for (const d of DIFFICULTIES) expect(DIFFICULTY_LABELS[d]).toBeTruthy();
  });
  it("default passing score is 70", () => {
    expect(DEFAULT_PASSING_SCORE).toBe(70);
  });
  it("has 4 quiz presets", () => {
    expect(QUIZ_PRESETS).toHaveLength(4);
    expect(QUIZ_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining(["general-knowledge", "math", "geography", "science"]),
    );
  });
  it("each preset has valid questions", () => {
    for (const p of QUIZ_PRESETS) {
      const qs = parseQuestions(p.questionsText);
      expect(qs.length).toBeGreaterThanOrEqual(5);
      expect(qs.every((q) => q.options.length >= 2 && q.correctIndex >= 0)).toBe(true);
    }
  });
});

describe("quiz-generator normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("quiz-generator isDifficulty / isTrueFalse", () => {
  it("isDifficulty accepts valid", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("medium")).toBe(true);
    expect(isDifficulty("hard")).toBe(true);
  });
  it("isDifficulty rejects invalid", () => {
    expect(isDifficulty("Easy")).toBe(false);
    expect(isDifficulty("unknown")).toBe(false);
  });
  it("isTrueFalse accepts true/false/t/f", () => {
    expect(isTrueFalse("true")).toBe(true);
    expect(isTrueFalse("FALSE")).toBe(true);
    expect(isTrueFalse("t")).toBe(true);
    expect(isTrueFalse("F")).toBe(true);
  });
  it("isTrueFalse rejects other", () => {
    expect(isTrueFalse("yes")).toBe(false);
    expect(isTrueFalse("")).toBe(false);
  });
});

describe("quiz-generator makeQuestionId / makeQuestion", () => {
  it("slugifies question text + index", () => {
    expect(makeQuestionId("What is 2+2?", 0)).toContain("what-is-2-2");
  });
  it("falls back when question is empty", () => {
    expect(makeQuestionId("", 0)).toBe("q-0");
  });
  it("makeQuestion builds a Question", () => {
    const q = makeQuestion("Q?", ["A", "B", "C"], 1, "medium", 0);
    expect(q.question).toBe("Q?");
    expect(q.options).toEqual(["A", "B", "C"]);
    expect(q.correctIndex).toBe(1);
    expect(q.difficulty).toBe("medium");
  });
  it("makeQuestion normalizes options", () => {
    const q = makeQuestion("Q?", ["  A  ", "B"], 0);
    expect(q.options[0]).toBe("A");
  });
});

describe("quiz-generator convertTrueFalseToMC", () => {
  it("creates a 2-option MC with True first when isTrue=true", () => {
    const q = convertTrueFalseToMC("The sky is blue.", true);
    expect(q.options).toEqual(["True", "False"]);
    expect(q.correctIndex).toBe(0);
  });
  it("creates a 2-option MC with False first when isTrue=false", () => {
    const q = convertTrueFalseToMC("The sky is green.", false);
    expect(q.options).toEqual(["True", "False"]);
    expect(q.correctIndex).toBe(1);
  });
});

describe("quiz-generator parseQuestions multi-format", () => {
  it("parses standard pipe-separated with 4 options + difficulty", () => {
    const qs = parseQuestions("Capital of France?|Paris|London|Berlin|Madrid|easy");
    expect(qs).toHaveLength(1);
    expect(qs[0].options).toEqual(["Paris", "London", "Berlin", "Madrid"]);
    expect(qs[0].correctIndex).toBe(0);
    expect(qs[0].difficulty).toBe("easy");
  });
  it("parses pipe-separated with 3 options (no difficulty)", () => {
    const qs = parseQuestions("Q?|correct|wrong");
    expect(qs[0].options).toEqual(["correct", "wrong"]);
    expect(qs[0].correctIndex).toBe(0);
    expect(qs[0].difficulty).toBe("medium");
  });
  it("parses pipe-separated with difficulty in last field", () => {
    const qs = parseQuestions("Q?|correct|w1|w2|w3|hard");
    expect(qs[0].difficulty).toBe("hard");
    expect(qs[0].options).toHaveLength(4);
  });
  it("auto-converts true/false single-field", () => {
    const qs = parseQuestions("The sky is blue.|true");
    expect(qs).toHaveLength(1);
    expect(qs[0].options).toEqual(["True", "False"]);
    expect(qs[0].correctIndex).toBe(0);
  });
  it("auto-converts true/false dual-field", () => {
    const qs = parseQuestions("The sky is green.|false|true");
    expect(qs).toHaveLength(1);
    expect(qs[0].correctIndex).toBe(1); // false is correct
  });
  it("parses JSON array", () => {
    const qs = parseQuestions(JSON.stringify([
      { question: "Q1?", options: ["A", "B", "C"], correctIndex: 1, difficulty: "hard" },
      { question: "Q2?", options: ["X", "Y"], correctIndex: 0 },
    ]));
    expect(qs).toHaveLength(2);
    expect(qs[0].correctIndex).toBe(1);
    expect(qs[0].difficulty).toBe("hard");
    expect(qs[1].difficulty).toBe("medium");
  });
  it("parses JSON single object", () => {
    const qs = parseQuestions(JSON.stringify({ question: "Q?", options: ["A", "B"], correctIndex: 0 }));
    expect(qs).toHaveLength(1);
  });
  it("parses JSON with correct=string", () => {
    const qs = parseQuestions(JSON.stringify({ question: "Q?", options: ["A", "B"], correct: "B" }));
    expect(qs[0].correctIndex).toBe(1);
  });
  it("skips empty lines and comments", () => {
    const qs = parseQuestions("# comment\nQ?|a|b\n\n# another\nQ2?|c|d");
    expect(qs).toHaveLength(2);
  });
  it("skips invalid lines (only question, no options)", () => {
    const qs = parseQuestions("Q?|only-correct-without-true-false\nQ2?|a|b");
    expect(qs).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseQuestions("")).toEqual([]);
    expect(parseQuestions("   ")).toEqual([]);
  });
  it("skips JSON entries with invalid correctIndex", () => {
    const qs = parseQuestions(JSON.stringify([
      { question: "Q?", options: ["A", "B"], correctIndex: 5 },
      { question: "Q2?", options: ["X", "Y"], correctIndex: 0 },
    ]));
    expect(qs).toHaveLength(1);
  });
});

describe("quiz-generator parseJsonQuestions", () => {
  it("returns null for non-JSON", () => {
    expect(parseJsonQuestions("Q?|a|b")).toBeNull();
    expect(parseJsonQuestions("")).toBeNull();
  });
  it("returns null for invalid JSON", () => {
    expect(parseJsonQuestions("[{question: 'Q?'}]")).toBeNull();
  });
});

describe("quiz-generator validateQuiz", () => {
  it("validates a good quiz", () => {
    const r = validateQuiz(makeSimpleQuiz());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.questionCount).toBe(2);
  });
  it("fails for empty title", () => {
    const r = validateQuiz({ ...makeSimpleQuiz(), title: "  " });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("Quiz title is required");
  });
  it("fails for empty questions", () => {
    const r = validateQuiz({ title: "X", questions: [], passingScore: 70 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("at least 1 question");
  });
  it("fails for passing score out of range", () => {
    const r = validateQuiz({ ...makeSimpleQuiz(), passingScore: 150 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Passing score"))).toBe(true);
  });
  it("fails for question with empty options", () => {
    const q = makeQuestion("Q?", ["A", ""], 0);
    const r = validateQuiz({ title: "X", questions: [q], passingScore: 70 });
    expect(r.ok).toBe(false);
  });
  it("fails for invalid correctIndex", () => {
    const q: Question = { ...makeQuestion("Q?", ["A", "B"], 0), correctIndex: 5 };
    const r = validateQuiz({ title: "X", questions: [q], passingScore: 70 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("correctIndex out of range"))).toBe(true);
  });
});

describe("quiz-generator shufflers", () => {
  it("shuffle returns new array with same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("shuffle is deterministic with seeded rng", () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out1 = shuffle(input, rng);
    seed = 12345;
    const out2 = shuffle(input, rng);
    expect(out1).toEqual(out2);
  });
  it("shuffleQuestions returns new array", () => {
    const qs = parseQuestions("Q1?|a|b\nQ2?|c|d\nQ3?|e|f");
    const out = shuffleQuestions(qs);
    expect(out).not.toBe(qs);
    expect(out.length).toBe(qs.length);
  });
  it("shuffleOptions keeps correct answer correct", () => {
    const q = makeQuestion("Q?", ["correct", "wrong1", "wrong2", "wrong3"], 0);
    const shuffled = shuffleOptions(q);
    expect(shuffled.options).toHaveLength(4);
    expect(shuffled.options[shuffled.correctIndex]).toBe("correct");
  });
  it("shuffleAllOptions preserves correctness for all", () => {
    const qs = parseQuestions("Q1?|correct|w1|w2\nQ2?|c2|w3|w4");
    const out = shuffleAllOptions(qs);
    out.forEach((q, i) => {
      expect(q.options[q.correctIndex]).toBe(qs[i].options[qs[i].correctIndex]);
    });
  });
  it("shuffle handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });
});

describe("quiz-generator calculateScore / determinePassFail", () => {
  it("calculates percentage", () => {
    expect(calculateScore(7, 10)).toBe(70);
    expect(calculateScore(1, 3)).toBe(33.3);
    expect(calculateScore(0, 5)).toBe(0);
  });
  it("handles zero total", () => {
    expect(calculateScore(0, 0)).toBe(0);
  });
  it("determines pass when score >= passing", () => {
    expect(determinePassFail(70, 70)).toBe(true);
    expect(determinePassFail(75, 70)).toBe(true);
  });
  it("determines fail when score < passing", () => {
    expect(determinePassFail(69, 70)).toBe(false);
    expect(determinePassFail(0, 70)).toBe(false);
  });
});

describe("quiz-generator answer tracking", () => {
  it("records a correct answer", () => {
    const r = recordAnswer("q1", 0, 0);
    expect(r.correct).toBe(true);
    expect(r.selectedIndex).toBe(0);
  });
  it("records an incorrect answer", () => {
    const r = recordAnswer("q1", 1, 0);
    expect(r.correct).toBe(false);
  });
  it("records a skipped answer (null)", () => {
    const r = recordAnswer("q1", null, 0);
    expect(r.correct).toBe(false);
    expect(r.selectedIndex).toBe(null);
  });
  it("tallyAnswers counts correct/incorrect/skipped", () => {
    const answers = [
      recordAnswer("q1", 0, 0),
      recordAnswer("q2", 1, 0),
      recordAnswer("q3", null, 0),
    ];
    const tally = tallyAnswers(answers);
    expect(tally.correct).toBe(1);
    expect(tally.incorrect).toBe(1);
    expect(tally.skipped).toBe(1);
    expect(tally.answered).toBe(2);
  });
});

describe("quiz-generator feedback generator", () => {
  it("generates correct feedback", () => {
    const q = makeQuestion("Q?", ["A", "B", "C"], 0);
    const a = recordAnswer(q.id, 0, 0);
    const f = generateFeedback(q, a);
    expect(f.correct).toBe(true);
    expect(f.message).toContain("Correct!");
    expect(f.correctAnswer).toBe("A");
  });
  it("generates incorrect feedback", () => {
    const q = makeQuestion("Q?", ["A", "B", "C"], 0);
    const a = recordAnswer(q.id, 1, 0);
    const f = generateFeedback(q, a);
    expect(f.correct).toBe(false);
    expect(f.message).toContain("Incorrect");
    expect(f.selectedAnswer).toBe("B");
  });
  it("generates skipped feedback", () => {
    const q = makeQuestion("Q?", ["A", "B"], 0);
    const a = recordAnswer(q.id, null, 0);
    const f = generateFeedback(q, a);
    expect(f.selectedAnswer).toBe(null);
    expect(f.message).toContain("Skipped");
  });
  it("generateAllFeedback for full quiz", () => {
    const quiz = makeSimpleQuiz();
    const answers = quiz.questions.map((q, i) => recordAnswer(q.id, i % 2 === 0 ? q.correctIndex : -1, q.correctIndex));
    const feedback = generateAllFeedback(quiz.questions, answers);
    expect(feedback).toHaveLength(2);
  });
});

describe("quiz-generator state machine", () => {
  it("initQuizState starts at 0 with empty answers", () => {
    const s = initQuizState(3, 1000);
    expect(s.currentIndex).toBe(0);
    expect(s.answers).toHaveLength(3);
    expect(s.answers.every((a) => a === null)).toBe(true);
    expect(s.finished).toBe(false);
    expect(s.startedAt).toBe(1000);
  });
  it("answerQuestion records and advances", () => {
    const q = makeQuestion("Q?", ["A", "B"], 0);
    const s = initQuizState(2, 1000);
    const s2 = answerQuestion(s, 0, 0, q, true, 2);
    expect(s2.answers[0]).not.toBeNull();
    expect(s2.answers[0].correct).toBe(true);
    expect(s2.currentIndex).toBe(1);
  });
  it("answerQuestion does not advance when advance=false", () => {
    const q = makeQuestion("Q?", ["A", "B"], 0);
    const s = initQuizState(2, 1000);
    const s2 = answerQuestion(s, 0, 0, q, false, 2);
    expect(s2.currentIndex).toBe(0);
  });
  it("skipQuestion records null selected index", () => {
    const q = makeQuestion("Q?", ["A", "B"], 0);
    const s = initQuizState(2, 1000);
    const s2 = skipQuestion(s, 0, q, true, 2);
    expect(s2.answers[0]).not.toBeNull();
    expect(s2.answers[0].selectedIndex).toBe(null);
    expect(s2.currentIndex).toBe(1);
  });
  it("goToQuestion moves to a valid index", () => {
    const s = initQuizState(3, 1000);
    const s2 = goToQuestion(s, 2, 3);
    expect(s2.currentIndex).toBe(2);
  });
  it("goToQuestion ignores invalid index", () => {
    const s = initQuizState(3, 1000);
    const s2 = goToQuestion(s, 10, 3);
    expect(s2.currentIndex).toBe(0);
  });
  it("finishQuiz marks finished and sets endedAt", () => {
    const s = initQuizState(2, 1000);
    const s2 = finishQuiz(s, 5000);
    expect(s2.finished).toBe(true);
    expect(s2.endedAt).toBe(5000);
    expect(isFinished(s2)).toBe(true);
  });
});

describe("quiz-generator time tracker", () => {
  it("recordStart/recordEnd return timestamps", () => {
    expect(recordStart(1000)).toBe(1000);
    expect(recordEnd(2000)).toBe(2000);
  });
  it("computeDuration returns end - start", () => {
    expect(computeDuration(1000, 3000)).toBe(2000);
  });
  it("computeDuration handles null", () => {
    expect(computeDuration(null, 1000)).toBe(0);
    expect(computeDuration(1000, null)).toBe(0);
  });
  it("computeDuration handles end < start", () => {
    expect(computeDuration(3000, 1000)).toBe(0);
  });
  it("formatDuration renders mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(125000)).toBe("2:05");
  });
});

describe("quiz-generator computeSummary", () => {
  it("computes full summary", () => {
    const quiz = makeSimpleQuiz();
    const answers = [
      recordAnswer(quiz.questions[0].id, quiz.questions[0].correctIndex, quiz.questions[0].correctIndex),
      recordAnswer(quiz.questions[1].id, (quiz.questions[1].correctIndex + 1) % quiz.questions[1].options.length, quiz.questions[1].correctIndex),
    ];
    const summary = computeSummary(quiz.questions, answers, 70, 60000);
    expect(summary.total).toBe(2);
    expect(summary.correct).toBe(1);
    expect(summary.incorrect).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.score).toBe(50);
    expect(summary.passed).toBe(false);
    expect(summary.durationMs).toBe(60000);
  });
  it("computes pass when score >= passing", () => {
    const quiz = makeSimpleQuiz();
    const answers = quiz.questions.map((q) => recordAnswer(q.id, q.correctIndex, q.correctIndex));
    const summary = computeSummary(quiz.questions, answers, 70, 30000);
    expect(summary.score).toBe(100);
    expect(summary.passed).toBe(true);
  });
  it("byDifficulty breakdown is correct", () => {
    const quiz = makeSimpleQuiz(); // both questions are easy
    const answers = quiz.questions.map((q) => recordAnswer(q.id, q.correctIndex, q.correctIndex));
    const summary = computeSummary(quiz.questions, answers, 70, 10000);
    expect(summary.byDifficulty.easy.total).toBe(2);
    expect(summary.byDifficulty.easy.correct).toBe(2);
    expect(summary.byDifficulty.medium.total).toBe(0);
  });
});

describe("quiz-generator renderers", () => {
  it("renderText produces numbered questions", () => {
    const quiz = makeSimpleQuiz();
    const txt = renderText(quiz, false);
    expect(txt).toContain("Test Quiz");
    expect(txt).toContain("1. Capital of France?");
    expect(txt).toContain("A) Paris");
  });
  it("renderText with answers marks correct", () => {
    const quiz = makeSimpleQuiz();
    const txt = renderText(quiz, true);
    expect(txt).toContain("✓");
  });
  it("renderHtml produces a complete HTML document", () => {
    const quiz = makeSimpleQuiz();
    const html = renderHtml(quiz, false);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Test Quiz</title>");
    expect(html).toContain("Capital of France?");
  });
  it("renderHtml escapes HTML in questions", () => {
    const q = makeQuestion("<script>alert(1)</script>", ["A", "B"], 0);
    const quiz: Quiz = { title: "X", questions: [q], passingScore: 70 };
    const html = renderHtml(quiz, false);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
  it("renderCsv has header", () => {
    expect(renderCsv({ title: "X", questions: [], passingScore: 70 })).toContain(
      "question,correct_answer,option_b,option_c,option_d,difficulty",
    );
  });
  it("renderCsv outputs rows", () => {
    const quiz = makeSimpleQuiz();
    const csv = renderCsv(quiz);
    expect(csv.split("\n")).toHaveLength(3); // header + 2 rows
  });
  it("renderSource round-trips", () => {
    const quiz = makeSimpleQuiz();
    const src = renderSource(quiz);
    const reparsed = parseQuestions(src);
    expect(reparsed.length).toBe(quiz.questions.length);
    expect(reparsed[0].question).toBe(quiz.questions[0].question);
    expect(reparsed[0].correctIndex).toBe(quiz.questions[0].correctIndex);
  });
});

describe("quiz-generator presets", () => {
  it("getQuizPreset finds by id", () => {
    const p = getQuizPreset("math");
    expect(p).toBeDefined();
    expect(p!.name).toBe("Math Basics");
  });
  it("getQuizPreset returns undefined for unknown id", () => {
    expect(getQuizPreset("does-not-exist")).toBeUndefined();
  });
});

describe("quiz-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "Test", questionCount: 5, score: 80, passed: true, durationMs: 60000 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("Test");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `Q${i}`, questionCount: 1, score: 50, passed: false, durationMs: 1000 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "X", questionCount: 1, score: 50, passed: false, durationMs: 1000 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("quiz-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("My Quiz", "Q?|a|b|c|d|easy", 80, true, false);
    expect(url).toContain("title=My+Quiz");
    expect(url).toContain("pass=80");
    expect(url).toContain("sq=1");
    expect(url).not.toContain("so=1");
    expect(url).toContain("d=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const questionsText = "Q1?|a|b|c|d|easy\nQ2?|x|y|z|w|hard";
    const url = buildShareUrl("My Quiz", questionsText, 85, false, true);
    const sepIdx = Math.min(
      url.indexOf("#") === -1 ? Infinity : url.indexOf("#"),
      url.indexOf("?") === -1 ? Infinity : url.indexOf("?"),
    );
    const hash = sepIdx === Infinity ? url : url.slice(sepIdx + 1);
    const p = parseShareUrl(hash);
    expect(p.title).toBe("My Quiz");
    expect(p.passingScore).toBe(85);
    expect(p.shuffleQuestions).toBe(false);
    expect(p.shuffleOptions).toBe(true);
    expect(p.questionsText).toBe(questionsText);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.title).toBe("");
    expect(p.questionsText).toBe("");
    expect(p.passingScore).toBe(DEFAULT_PASSING_SCORE);
    expect(p.shuffleQuestions).toBe(false);
    expect(p.shuffleOptions).toBe(false);
  });
  it("clamps passing score to 0-100", () => {
    const p = parseShareUrl("pass=150");
    expect(p.passingScore).toBe(100);
    const p2 = parseShareUrl("pass=-10");
    expect(p2.passingScore).toBe(0);
  });
  it("falls back to default passing score for non-numeric", () => {
    const p = parseShareUrl("pass=abc");
    expect(p.passingScore).toBe(DEFAULT_PASSING_SCORE);
  });
});

// Suppress unused-import lint for type-only exports
export type _Unused = Question | Quiz | Difficulty | HistoryEntry;
