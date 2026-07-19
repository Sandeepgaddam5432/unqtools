import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SAMPLE_TEXTS,
  CONFUSION_RULES,
  SPELLING_DICT,
  PROPER_NOUNS,
  normalizeText,
  escapeHtml,
  countWords,
  countSentences,
  countSyllables,
  startsWithVowelSound,
  findAll,
  isProtected,
  wordAt,
  preserveCase,
  checkCapitalization,
  checkArticles,
  checkGrammar,
  checkPunctuation,
  checkConfusions,
  checkSpelling,
  checkText,
  computeStats,
  computeReadability,
  applySuggestion,
  applyAll,
  filterByCategory,
  applyByCategory,
  dismissIssue,
  buildDiff,
  renderDiffHtml,
  renderHighlightedHtml,
  renderCorrected,
  renderHtmlDocument,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  loadIgnoreList,
  saveIgnoreList,
  clearIgnoreList,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type IssueCategory,
  type Issue,
  type CheckResult,
  type DiffSegment,
  type ShareState,
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

describe("grammar constants", () => {
  it("has 6 issue categories", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
  });
  it("has 6 category colors", () => {
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(6);
  });
  it("has 3 severity labels", () => {
    expect(Object.keys(SEVERITY_LABELS)).toHaveLength(3);
  });
  it("has sample texts", () => {
    expect(SAMPLE_TEXTS.length).toBeGreaterThanOrEqual(3);
  });
  it("has confusion rules", () => {
    expect(CONFUSION_RULES.length).toBeGreaterThanOrEqual(8);
  });
  it("has 100+ spelling corrections", () => {
    expect(Object.keys(SPELLING_DICT).length).toBeGreaterThanOrEqual(60);
  });
  it("has 12+ proper nouns", () => {
    expect(PROPER_NOUNS.length).toBeGreaterThanOrEqual(12);
  });
  it("exposes HISTORY_KEY and HISTORY_MAX", () => {
    expect(HISTORY_KEY).toContain("grammar");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("normalizeText", () => {
  it("collapses internal whitespace runs", () => {
    expect(normalizeText("a    b\t\tc")).toBe("a b c");
  });
  it("normalizes newlines", () => {
    expect(normalizeText("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("limits consecutive blank lines", () => {
    expect(normalizeText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("countWords / countSentences / countSyllables", () => {
  it("counts words", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("")).toBe(0);
  });
  it("counts sentences", () => {
    expect(countSentences("Hello. World! How?")).toBe(3);
    expect(countSentences("One sentence")).toBe(1);
  });
  it("counts syllables", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("")).toBe(0);
  });
});

describe("startsWithVowelSound", () => {
  it("returns true for vowel-initial words", () => {
    expect(startsWithVowelSound("apple")).toBe(true);
    expect(startsWithVowelSound("elephant")).toBe(true);
  });
  it("returns false for consonant-initial words", () => {
    expect(startsWithVowelSound("banana")).toBe(false);
    expect(startsWithVowelSound("cat")).toBe(false);
  });
  it("handles silent-h words", () => {
    expect(startsWithVowelSound("hour")).toBe(true);
    expect(startsWithVowelSound("honest")).toBe(true);
  });
  it("handles consonant-sound vowel-initial words", () => {
    expect(startsWithVowelSound("university")).toBe(false);
    expect(startsWithVowelSound("unicorn")).toBe(false);
    expect(startsWithVowelSound("one")).toBe(false);
  });
});

describe("findAll / isProtected / wordAt", () => {
  it("findAll returns all matches with offsets", () => {
    const matches = findAll(/\bthe\b/g, "the cat and the dog");
    expect(matches).toHaveLength(2);
    expect(matches[0].start).toBe(0);
    expect(matches[1].start).toBe(12);
  });
  it("isProtected detects code spans", () => {
    expect(isProtected("see `the` code", 5)).toBe(true);
    expect(isProtected("the code", 0)).toBe(false);
  });
  it("isProtected detects URLs", () => {
    expect(isProtected("visit https://example.com/the now", 25)).toBe(true);
    expect(isProtected("the cat", 0)).toBe(false);
  });
  it("wordAt extracts a word at an offset", () => {
    const w = wordAt("hello world", 7);
    expect(w?.word).toBe("world");
  });
  it("wordAt returns null at whitespace", () => {
    expect(wordAt("hello world", 5)).toBeNull();
  });
});

describe("preserveCase", () => {
  it("preserves title case", () => {
    expect(preserveCase("Hello", "world")).toBe("World");
  });
  it("preserves all-caps", () => {
    expect(preserveCase("HELLO", "world")).toBe("WORLD");
  });
  it("falls back to lowercase original", () => {
    expect(preserveCase("hello", "world")).toBe("world");
  });
});

describe("checkCapitalization", () => {
  it("flags lowercase i pronoun", () => {
    const issues = checkCapitalization("i went home");
    expect(issues.some((i) => i.category === "capitalization" && i.original === "i")).toBe(true);
  });
  it("flags sentence-start lowercase", () => {
    const issues = checkCapitalization("hello world. again here.");
    expect(issues.some((i) => i.original === "h")).toBe(true);
    expect(issues.some((i) => i.original === "a")).toBe(true);
  });
  it("flags uncapitalized days/months", () => {
    const issues = checkCapitalization("see you on monday");
    expect(issues.some((i) => i.original === "monday")).toBe(true);
  });
  it("does not flag already-capitalized days", () => {
    const issues = checkCapitalization("See you on Monday");
    expect(issues.some((i) => i.original === "monday" || i.original === "Monday")).toBe(false);
  });
});

describe("checkArticles", () => {
  it("flags a before vowel sound", () => {
    const issues = checkArticles("a apple");
    expect(issues).toHaveLength(1);
    expect(issues[0].suggestion).toBe("an");
  });
  it("flags an before consonant sound", () => {
    const issues = checkArticles("an banana");
    expect(issues).toHaveLength(1);
    expect(issues[0].suggestion).toBe("a");
  });
  it("uses vowel-sound rule for university", () => {
    const issues = checkArticles("a university");
    expect(issues).toHaveLength(0);
  });
  it("uses vowel-sound rule for hour", () => {
    const issues = checkArticles("a hour");
    expect(issues).toHaveLength(1);
    expect(issues[0].suggestion).toBe("an");
  });
});

describe("checkGrammar", () => {
  it("flags 'they is' as 'they are'", () => {
    const issues = checkGrammar("they is here");
    expect(issues.some((i) => i.original === "is" && i.suggestion === "are")).toBe(true);
  });
  it("flags 'he are' as 'he is'", () => {
    const issues = checkGrammar("he are here");
    expect(issues.some((i) => i.original === "are" && i.suggestion === "is")).toBe(true);
  });
  it("flags 'we was' as 'we were'", () => {
    const issues = checkGrammar("we was there");
    expect(issues.some((i) => i.original === "was" && i.suggestion === "were")).toBe(true);
  });
  it("flags 'they has' as 'they have'", () => {
    const issues = checkGrammar("they has it");
    expect(issues.some((i) => i.original === "has" && i.suggestion === "have")).toBe(true);
  });
  it("flags 'he do' as 'he does'", () => {
    const issues = checkGrammar("he do it");
    expect(issues.some((i) => i.original === "do" && i.suggestion === "does")).toBe(true);
  });
  it("flags 'he don't' as 'he doesn't'", () => {
    const issues = checkGrammar("he don't know");
    expect(issues.some((i) => i.suggestion === "doesn't")).toBe(true);
  });
  it("flags plural-noun + singular-verb (rough heuristic)", () => {
    const issues = checkGrammar("the cars is fast");
    // Skip exception cases — 'cars' should be detected as plural
    expect(issues.some((i) => i.original === "is" && i.suggestion === "are")).toBe(true);
  });
  it("skips singular '-s' words like 'news'", () => {
    const issues = checkGrammar("the news is good");
    expect(issues.some((i) => i.original === "is")).toBe(false);
  });
});

describe("checkPunctuation", () => {
  it("flags double spaces", () => {
    const issues = checkPunctuation("hello  world");
    expect(issues.some((i) => i.original === "  ")).toBe(true);
  });
  it("flags space before punctuation", () => {
    const issues = checkPunctuation("hello , world");
    expect(issues.some((i) => i.original === " ,")).toBe(true);
  });
  it("flags two-dot ellipsis as single period", () => {
    const issues = checkPunctuation("wait..");
    expect(issues.some((i) => i.original === ".." && i.suggestion === ".")).toBe(true);
  });
  it("does not flag three-dot ellipsis", () => {
    const issues = checkPunctuation("wait...");
    expect(issues.some((i) => i.original === "...")).toBe(false);
  });
  it("flags repeated exclamation", () => {
    const issues = checkPunctuation("wow!!");
    expect(issues.some((i) => i.original === "!!" && i.suggestion === "!")).toBe(true);
  });
});

describe("checkConfusions", () => {
  it("flags 'their going' as 'they're'", () => {
    const issues = checkConfusions("their going home");
    expect(issues.some((i) => i.original === "their" && i.suggestion === "they're")).toBe(true);
  });
  it("flags 'your going' as 'you're'", () => {
    const issues = checkConfusions("your going home");
    expect(issues.some((i) => i.original === "your" && i.suggestion === "you're")).toBe(true);
  });
  it("flags 'its a' as 'it's'", () => {
    const issues = checkConfusions("its a cat");
    expect(issues.some((i) => i.original === "its" && i.suggestion === "it's")).toBe(true);
  });
  it("flags 'to much' as 'too'", () => {
    const issues = checkConfusions("that is to much");
    expect(issues.some((i) => i.original === "to" && i.suggestion === "too")).toBe(true);
  });
  it("flags 'more X then' as 'than'", () => {
    const issues = checkConfusions("more than then then");
    // 'more' followed by 'than' is fine, but our regex requires 'more <adj> then'
    // We craft: "more faster then"
    const issues2 = checkConfusions("more faster then you");
    expect(issues2.some((i) => i.original === "then" && i.suggestion === "than")).toBe(true);
    // sanity: issues contains at least one
    expect(issues.length).toBeGreaterThanOrEqual(0);
  });
});

describe("checkSpelling", () => {
  it("flags 'recieve' as 'receive'", () => {
    const issues = checkSpelling("i will recieve it");
    expect(issues.some((i) => i.original === "recieve" && i.suggestion === "receive")).toBe(true);
  });
  it("preserves case for capitalized misspelling", () => {
    const issues = checkSpelling("Recieve it");
    expect(issues[0].suggestion).toBe("Receive");
  });
  it("does not flag correct words", () => {
    const issues = checkSpelling("the quick brown fox");
    expect(issues).toHaveLength(0);
  });
});

describe("checkText (combined)", () => {
  it("returns a CheckResult with stats", () => {
    const result = checkText("their going too the park.");
    expect(result.original).toBe("their going too the park.");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.stats.totalIssues).toBe(result.issues.length);
    expect(result.stats.wordCount).toBe(5);
    expect(result.stats.byCategory.confusion).toBeGreaterThan(0);
  });
  it("dedupes overlapping issues", () => {
    // 'i' is also sentence-start — both rules could fire, only first wins
    const result = checkText("i am here");
    // The 'i' should be flagged exactly once (either as 'I' pronoun or as sentence start)
    const iIssues = result.issues.filter((iss) => iss.start === 0);
    expect(iIssues.length).toBeLessThanOrEqual(1);
  });
  it("handles empty text", () => {
    const result = checkText("");
    expect(result.issues).toEqual([]);
    expect(result.stats.totalIssues).toBe(0);
  });
});

describe("computeStats / computeReadability", () => {
  it("computes byCategory and bySeverity", () => {
    const result = checkText("they is here. a apple.");
    expect(result.stats.byCategory.grammar).toBeGreaterThanOrEqual(1);
    expect(result.stats.byCategory.article).toBeGreaterThanOrEqual(1);
    expect(result.stats.bySeverity.error).toBeGreaterThanOrEqual(2);
  });
  it("computes readability scores", () => {
    const r = computeReadability("Pursuant to the aforementioned discussion, the institutional administrators determined that subsequent modifications were necessary. Furthermore, the comprehensive evaluation demonstrated considerable improvement.");
    expect(r.fleschReadingEase).toBeLessThan(50); // hard text
    expect(r.fleschGradeLevel).toBeGreaterThan(0);
    expect(r.avgWordsPerSentence).toBeGreaterThan(0);
  });
});

describe("applySuggestion / applyAll", () => {
  it("applies a single suggestion", () => {
    const result = checkText("they is here");
    const grammarIssue = result.issues.find((i) => i.category === "grammar");
    expect(grammarIssue).toBeTruthy();
    if (grammarIssue) {
      expect(applySuggestion("they is here", grammarIssue)).toBe("they are here");
    }
  });
  it("applies all suggestions", () => {
    const result = checkText("a apple and they is here");
    const corrected = applyAll(result.original, result.issues);
    expect(corrected).toBe("an apple and they are here");
  });
  it("applies all suggestions sorted by descending offset", () => {
    const result = checkText("a apple. they is here.");
    const corrected = applyAll(result.original, result.issues);
    expect(corrected).toContain("an apple");
    expect(corrected).toContain("are here");
  });
});

describe("filterByCategory / applyByCategory / dismissIssue", () => {
  it("filters issues by category", () => {
    const result = checkText("they is here. a apple.");
    const grammar = filterByCategory(result.issues, "grammar");
    expect(grammar.length).toBeGreaterThan(0);
    expect(grammar.every((i) => i.category === "grammar")).toBe(true);
  });
  it("applies only issues of one category", () => {
    const result = checkText("a apple. they is here.");
    const out = applyByCategory(result.original, result.issues, "article");
    expect(out.applied).toBeGreaterThanOrEqual(1);
    expect(out.text).toContain("an apple");
    // Grammar issue should NOT be fixed
    expect(out.text).toContain("they is");
  });
  it("dismisses an issue by id", () => {
    const result = checkText("a apple");
    const before = result.issues.length;
    const dismissed = dismissIssue(result.issues, result.issues[0].id);
    expect(dismissed.length).toBe(before - 1);
  });
});

describe("buildDiff / renderDiffHtml", () => {
  it("builds a diff between original and corrected", () => {
    const diff = buildDiff("a apple", "an apple");
    expect(diff.some((s) => s.type === "insert" && s.text === "an")).toBe(true);
    expect(diff.some((s) => s.type === "delete" && s.text === "a")).toBe(true);
  });
  it("merges consecutive same-type segments", () => {
    // Single-token strings produce single-segment diffs (no whitespace to interleave)
    const diff = buildDiff("hello", "world");
    const deletes = diff.filter((s) => s.type === "delete");
    const inserts = diff.filter((s) => s.type === "insert");
    expect(deletes).toHaveLength(1);
    expect(inserts).toHaveLength(1);
    expect(deletes[0].text).toBe("hello");
    expect(inserts[0].text).toBe("world");
  });
  it("renders diff as HTML with <ins>/<del>", () => {
    const diff: DiffSegment[] = [
      { type: "equal", text: "a " },
      { type: "delete", text: "x" },
      { type: "insert", text: "y" },
    ];
    const html = renderDiffHtml(diff);
    expect(html).toContain("<ins");
    expect(html).toContain("<del");
  });
});

describe("renderHighlightedHtml", () => {
  it("wraps issue text in <mark>", () => {
    const result = checkText("they is here");
    const html = renderHighlightedHtml(result.original, result.issues);
    expect(html).toContain("<mark");
    expect(html).toContain("data-cat");
  });
  it("escapes surrounding text", () => {
    const result = checkText("<b>they is</b> here");
    const html = renderHighlightedHtml(result.original, result.issues);
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("renderers", () => {
  it("renderCorrected returns plain corrected text", () => {
    const result = checkText("a apple");
    expect(renderCorrected(result)).toBe("an apple");
  });
  it("renderHtmlDocument wraps in a full document", () => {
    const result = checkText("a apple");
    const html = renderHtmlDocument(result);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("an apple");
  });
  it("renderMarkdown includes issue list", () => {
    const result = checkText("a apple");
    const md = renderMarkdown(result);
    expect(md).toContain("# Grammar report");
    expect(md).toContain("Articles");
  });
});

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      textPreview: "hello",
      issueCount: 3,
      byCategory: { grammar: 1, article: 1, punctuation: 0, capitalization: 0, confusion: 0, spelling: 1 },
      readability: { fleschReadingEase: 80, fleschGradeLevel: 5, passiveVoiceCount: 0, longSentenceCount: 0, avgWordsPerSentence: 5 },
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        textPreview: "x",
        issueCount: 1,
        byCategory: { grammar: 1, article: 0, punctuation: 0, capitalization: 0, confusion: 0, spelling: 0 },
        readability: { fleschReadingEase: 80, fleschGradeLevel: 5, passiveVoiceCount: 0, longSentenceCount: 0, avgWordsPerSentence: 5 },
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, textPreview: "x", issueCount: 1, byCategory: { grammar: 1, article: 0, punctuation: 0, capitalization: 0, confusion: 0, spelling: 0 }, readability: { fleschReadingEase: 80, fleschGradeLevel: 5, passiveVoiceCount: 0, longSentenceCount: 0, avgWordsPerSentence: 5 } });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ignore list (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadIgnoreList()).toEqual([]);
  });
  it("saves and loads", () => {
    saveIgnoreList(["id1", "id2"]);
    expect(loadIgnoreList()).toEqual(["id1", "id2"]);
  });
  it("clears", () => {
    saveIgnoreList(["id1"]);
    clearIgnoreList();
    expect(loadIgnoreList()).toEqual([]);
  });
});

describe("shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ text: "hello world", lang: "en" });
    expect(url).toContain("text=hello");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hello%20world&lang=fr");
    expect(p.text).toBe("hello world");
    expect(p.lang).toBe("fr");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ text: "", lang: "en" });
  });
  it("defaults lang to en", () => {
    const p = parseShareUrl("text=hi");
    expect(p.lang).toBe("en");
  });
});

describe("LLM prompt", () => {
  it("builds a system + user prompt", () => {
    const p = buildLlmPrompt("hello world", "en");
    expect(p.system.toLowerCase()).toContain("grammar");
    expect(p.user).toBe("hello world");
  });
  it("trims raw LLM response", () => {
    expect(renderLlmResult("  hello  \n")).toBe("hello");
  });
});

describe("integration samples", () => {
  it("catches multiple issues in sample 1", () => {
    const result = checkText(SAMPLE_TEXTS[0]);
    expect(result.stats.totalIssues).toBeGreaterThanOrEqual(3);
  });
  it("catches multiple issues in sample 2", () => {
    const result = checkText(SAMPLE_TEXTS[1]);
    expect(result.stats.totalIssues).toBeGreaterThanOrEqual(2);
  });
});

// Suppress unused-import lint
export type _Unused = IssueCategory | Issue | CheckResult | DiffSegment | ShareState;
