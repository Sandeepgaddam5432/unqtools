import { describe, it, expect, beforeEach } from "vitest";
import {
  QUESTION_TYPE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  QUESTION_TEMPLATES,
  SAMPLE_TOPICS,
  STOP_WORDS,
  normalizeTopic,
  normalizeContent,
  titleCase,
  extractKeywords,
  splitSentences,
  detectQuestionType,
  getTemplates,
  pickTemplates,
  fillTemplate,
  voiceStyle,
  scoreSentence,
  findBestSnippet,
  buildUngroundedAnswer,
  shapeAnswer,
  generateAnswer,
  generateFaq,
  groupByType,
  regenerateItem,
  computeStats,
  renderText,
  renderMarkdown,
  renderHtmlAccordion,
  renderJsonLd,
  validateJsonLd,
  renderJson,
  escapeHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  resetIdCounter,
  type QuestionType,
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
  resetIdCounter();
});

describe("ai-faq-generator constants", () => {
  it("has 8 question types", () => {
    expect(Object.keys(QUESTION_TYPE_LABELS)).toHaveLength(8);
    expect(QUESTION_TYPE_LABELS.what).toBe("What");
    expect(QUESTION_TYPE_LABELS.can).toBe("Can");
  });
  it("has 4 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(4);
  });
  it("has 3 length labels", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
  });
  it("has at least 3 templates per type (24+ total)", () => {
    for (const t of Object.keys(QUESTION_TEMPLATES) as QuestionType[]) {
      expect(QUESTION_TEMPLATES[t].length).toBeGreaterThanOrEqual(3);
    }
    const total = Object.values(QUESTION_TEMPLATES).reduce((a, b) => a + b.length, 0);
    expect(total).toBeGreaterThanOrEqual(24);
  });
  it("has sample topics", () => {
    expect(SAMPLE_TOPICS.length).toBeGreaterThanOrEqual(5);
  });
  it("has stop words including 'the' and 'is'", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("is")).toBe(true);
  });
});

describe("ai-faq-generator normalizeTopic", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTopic("  Acme   Cloud   Backup  ")).toBe("Acme Cloud Backup");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("ai-faq-generator normalizeContent", () => {
  it("collapses spaces and normalizes newlines", () => {
    expect(normalizeContent("hello   world\r\n\r\n\r\nfoo")).toBe("hello world\n\nfoo");
  });
  it("handles empty", () => {
    expect(normalizeContent("")).toBe("");
  });
});

describe("ai-faq-generator titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("acme cloud backup")).toBe("Acme Cloud Backup");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-faq-generator extractKeywords", () => {
  it("extracts keywords and filters stop words", () => {
    const kw = extractKeywords("The Acme Cloud is a backup solution for teams");
    expect(kw).toContain("acme");
    expect(kw).toContain("cloud");
    expect(kw).toContain("backup");
    expect(kw).toContain("solution");
    expect(kw).toContain("teams");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("is");
    expect(kw).not.toContain("a");
    expect(kw).not.toContain("for");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("dedupes", () => {
    expect(extractKeywords("acme acme acme")).toEqual(["acme"]);
  });
  it("keeps 2-letter acronyms like 'ai'", () => {
    expect(extractKeywords("AI is great")).toContain("ai");
    expect(extractKeywords("AI is great")).not.toContain("is");
  });
});

describe("ai-faq-generator splitSentences", () => {
  it("splits on sentence terminators", () => {
    const s = splitSentences("Hello world. This is a test! Is it working? Yes.");
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s[0]).toContain("Hello world");
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("filters out very short fragments", () => {
    expect(splitSentences("Hi. Ok.")).toEqual([]);
  });
});

describe("ai-faq-generator detectQuestionType", () => {
  it("detects 'what' questions", () => {
    expect(detectQuestionType("What is Acme Cloud?")).toBe("what");
  });
  it("detects 'how' questions", () => {
    expect(detectQuestionType("How does it work?")).toBe("how");
  });
  it("detects 'why' questions", () => {
    expect(detectQuestionType("Why is it important?")).toBe("why");
  });
  it("detects 'where' questions", () => {
    expect(detectQuestionType("Where can I find docs?")).toBe("where");
  });
  it("detects 'who' questions (whom)", () => {
    expect(detectQuestionType("Whom is this for?")).toBe("who");
  });
  it("detects 'which' questions", () => {
    expect(detectQuestionType("Which plan fits me?")).toBe("which");
  });
  it("detects 'can' questions (do/does/is)", () => {
    expect(detectQuestionType("Does it support Linux?")).toBe("can");
    expect(detectQuestionType("Is it free?")).toBe("can");
    expect(detectQuestionType("Do you offer refunds?")).toBe("can");
  });
  it("defaults to 'what' for unknown", () => {
    expect(detectQuestionType("")).toBe("what");
    expect(detectQuestionType("Pancakes?")).toBe("what");
  });
});

describe("ai-faq-generator template helpers", () => {
  it("getTemplates returns at least 3 per type", () => {
    for (const t of Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]) {
      expect(getTemplates(t).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("pickTemplates returns at most count templates", () => {
    const picked = pickTemplates("what", 2);
    expect(picked.length).toBeLessThanOrEqual(2);
    expect(picked.length).toBeGreaterThan(0);
  });
  it("pickTemplates returns all when count exceeds available", () => {
    const all = getTemplates("what");
    const picked = pickTemplates("what", all.length + 5);
    expect(picked.length).toBe(all.length);
  });
  it("pickTemplates returns empty for count 0", () => {
    expect(pickTemplates("what", 0)).toEqual([]);
  });
  it("fillTemplate replaces {topic}", () => {
    expect(fillTemplate("What is {topic}?", "Acme Cloud")).toBe("What is Acme Cloud?");
  });
  it("fillTemplate handles empty topic", () => {
    expect(fillTemplate("What is {topic}?", "")).toBe("What is this topic?");
  });
});

describe("ai-faq-generator voiceStyle", () => {
  it("applies contractions", () => {
    expect(voiceStyle("What is Acme Cloud?")).toBe("What's Acme Cloud?");
    expect(voiceStyle("Where is the docs page?")).toBe("Where's the docs page?");
  });
  it("leaves other questions alone", () => {
    expect(voiceStyle("How does it work?")).toBe("How does it work?");
  });
});

describe("ai-faq-generator grounding (snippet finding)", () => {
  it("scoreSentence counts keyword matches", () => {
    expect(scoreSentence("Acme Cloud is a backup solution", ["acme", "cloud", "backup"])).toBe(3);
    expect(scoreSentence("Nothing relevant here", ["acme", "cloud"])).toBe(0);
  });
  it("scoreSentence returns 0 for empty inputs", () => {
    expect(scoreSentence("", ["a"])).toBe(0);
    expect(scoreSentence("hello", [])).toBe(0);
  });
  it("findBestSnippet returns the best matching sentence", () => {
    const content = "Acme Cloud is a backup solution. The pricing starts at $5/mo. It supports Windows and macOS.";
    const snippet = findBestSnippet(content, ["acme", "cloud", "backup"]);
    expect(snippet).toContain("Acme Cloud is a backup solution");
  });
  it("findBestSnippet returns null when no keyword matches", () => {
    const content = "The sky is blue. Birds fly.";
    expect(findBestSnippet(content, ["acme", "cloud"])).toBeNull();
  });
  it("findBestSnippet returns null for empty content", () => {
    expect(findBestSnippet("", ["acme"])).toBeNull();
  });
});

describe("ai-faq-generator buildUngroundedAnswer", () => {
  it("returns honest non-fabricated answer", () => {
    const ans = buildUngroundedAnswer("What is Acme Cloud?", "Acme Cloud", "neutral", "standard");
    expect(ans.length).toBeGreaterThan(20);
    expect(ans).toContain("Acme Cloud");
    expect(ans).toContain("verify");
  });
  it("applies tone prefix", () => {
    const friendly = buildUngroundedAnswer("What is X?", "X", "friendly", "short");
    expect(friendly.startsWith("Great question!")).toBe(true);
    const formal = buildUngroundedAnswer("What is X?", "X", "formal", "short");
    expect(formal.startsWith("In summary,")).toBe(true);
  });
  it("detailed length produces longer answer than short", () => {
    const short = buildUngroundedAnswer("What is X?", "X", "neutral", "short");
    const detailed = buildUngroundedAnswer("What is X?", "X", "neutral", "detailed");
    expect(detailed.length).toBeGreaterThanOrEqual(short.length);
  });
});

describe("ai-faq-generator shapeAnswer", () => {
  it("wraps snippets without sentence punctuation", () => {
    expect(shapeAnswer("no punctuation here", "neutral", "short", "X")).toContain("no punctuation here.");
  });
  it("applies tone prefix", () => {
    const out = shapeAnswer("This is a sentence.", "formal", "standard", "X");
    expect(out.startsWith("In summary,")).toBe(true);
  });
  it("respects length target (detailed > short)", () => {
    const content = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.";
    const short = shapeAnswer(content, "neutral", "short", "X");
    const detailed = shapeAnswer(content, "neutral", "detailed", "X");
    expect(detailed.split(".").length).toBeGreaterThanOrEqual(short.split(".").length);
  });
});

describe("ai-faq-generator generateAnswer", () => {
  it("returns grounded answer when content matches", () => {
    const content = "Acme Cloud is a backup solution for teams. It costs $5 per month.";
    const r = generateAnswer("What is Acme Cloud?", "Acme Cloud", content, "neutral", "standard");
    expect(r.grounded).toBe(true);
    expect(r.snippet).toContain("Acme Cloud");
    expect(r.answer.length).toBeGreaterThan(5);
  });
  it("returns ungrounded answer when content is empty", () => {
    const r = generateAnswer("What is X?", "X", "", "neutral", "standard");
    expect(r.grounded).toBe(false);
    expect(r.snippet).toBeNull();
  });
  it("returns ungrounded answer when no snippet matches", () => {
    const r = generateAnswer("What is Acme Cloud?", "Acme Cloud", "The sky is blue.", "neutral", "standard");
    expect(r.grounded).toBe(false);
  });
});

describe("ai-faq-generator generateFaq", () => {
  it("generates at least 10 questions by default", () => {
    const faq = generateFaq("Acme Cloud", "");
    expect(faq.items.length).toBeGreaterThanOrEqual(10);
  });
  it("respects custom count", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 16 });
    expect(faq.items.length).toBe(16);
  });
  it("covers all 8 question types by default", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 16 });
    const types = new Set(faq.items.map((i) => i.type));
    expect(types.size).toBe(8);
  });
  it("respects types filter", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 6, types: ["what", "how"] });
    const types = new Set(faq.items.map((i) => i.type));
    expect(types.size).toBe(2);
    expect(types.has("what")).toBe(true);
    expect(types.has("how")).toBe(true);
  });
  it("grounds answers when content matches", () => {
    const content = "Acme Cloud is a backup solution. It costs $5/mo. It works on Windows and macOS.";
    const faq = generateFaq("Acme Cloud", content, { count: 8 });
    expect(faq.items.some((i) => i.grounded)).toBe(true);
  });
  it("applies voice-search style", () => {
    const faq = generateFaq("Acme Cloud", "", { voiceSearch: true, count: 4, types: ["what"] });
    expect(faq.items.some((i) => i.question.includes("What's"))).toBe(true);
  });
  it("sets tone and length on document", () => {
    const faq = generateFaq("X", "", { tone: "friendly", length: "detailed" });
    expect(faq.tone).toBe("friendly");
    expect(faq.length).toBe("detailed");
  });
  it("every item has unique id, question, answer, type", () => {
    const faq = generateFaq("X", "", { count: 12 });
    const ids = new Set(faq.items.map((i) => i.id));
    expect(ids.size).toBe(faq.items.length);
    for (const i of faq.items) {
      expect(i.question.length).toBeGreaterThan(0);
      expect(i.answer.length).toBeGreaterThan(0);
      expect(i.type).toBeTruthy();
    }
  });
  it("handles empty topic gracefully", () => {
    const faq = generateFaq("", "", { count: 8 });
    expect(faq.items.length).toBe(8);
    expect(faq.topic).toBe("");
  });
});

describe("ai-faq-generator groupByType", () => {
  it("groups items by type in canonical order", () => {
    const faq = generateFaq("X", "", { count: 16 });
    const groups = groupByType(faq.items);
    expect(groups.length).toBeGreaterThan(0);
    // Canonical order: what, how, why, when, where, who, which, can
    const expectedOrder: QuestionType[] = ["what", "how", "why", "when", "where", "who", "which", "can"];
    const actualOrder = groups.map((g) => g.type);
    const expectedSlice = expectedOrder.filter((t) => actualOrder.includes(t));
    expect(actualOrder).toEqual(expectedSlice);
  });
  it("returns empty for empty items", () => {
    expect(groupByType([])).toEqual([]);
  });
});

describe("ai-faq-generator regenerateItem", () => {
  it("replaces the answer for the targeted id", () => {
    const faq = generateFaq("X", "", { count: 8 });
    const first = faq.items[0];
    const regenerated = regenerateItem(faq, first.id);
    const newFirst = regenerated.items.find((i) => i.id === first.id)!;
    expect(newFirst.id).toBe(first.id);
    expect(newFirst.type).toBe(first.type);
    // Question may or may not differ if only one template is available, but
    // the regenerated doc should still have the same item count.
    expect(regenerated.items.length).toBe(faq.items.length);
  });
  it("returns unchanged for unknown id", () => {
    const faq = generateFaq("X", "", { count: 4 });
    const same = regenerateItem(faq, "does-not-exist");
    expect(same).toBe(faq);
  });
});

describe("ai-faq-generator computeStats", () => {
  it("computes correct counts", () => {
    const content = "Acme Cloud is a backup solution. It costs $5/mo.";
    const faq = generateFaq("Acme Cloud", content, { count: 8 });
    const stats = computeStats(faq);
    expect(stats.totalQuestions).toBe(8);
    expect(stats.groundedCount + stats.notGroundedCount).toBe(8);
    expect(stats.wordCount).toBeGreaterThan(0);
    expect(stats.characterCount).toBeGreaterThan(0);
    const totalByType = Object.values(stats.byType).reduce((a, b) => a + b, 0);
    expect(totalByType).toBe(8);
  });
});

describe("ai-faq-generator render functions", () => {
  it("renderText contains Q/A markers", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 4 });
    const txt = renderText(faq);
    expect(txt).toContain("FAQ: Acme Cloud");
    expect(txt).toContain("Q:");
    expect(txt).toContain("A:");
  });
  it("renderMarkdown contains type headings", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 16 });
    const md = renderMarkdown(faq);
    expect(md).toContain("# FAQ: Acme Cloud");
    expect(md).toContain("## What");
  });
  it("renderHtmlAccordion uses details/summary", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 4 });
    const html = renderHtmlAccordion(faq);
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>");
    expect(html).toContain("</section>");
  });
  it("renderJsonLd produces valid FAQPage schema", () => {
    const faq = generateFaq("Acme Cloud", "", { count: 4 });
    const json = renderJsonLd(faq);
    expect(validateJsonLd(json)).toBeNull();
    const parsed = JSON.parse(json);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(Array.isArray(parsed.mainEntity)).toBe(true);
    expect(parsed.mainEntity.length).toBe(4);
    expect(parsed.mainEntity[0]["@type"]).toBe("Question");
    expect(parsed.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });
  it("renderJson produces valid JSON", () => {
    const faq = generateFaq("X", "", { count: 4 });
    const json = renderJson(faq);
    const parsed = JSON.parse(json);
    expect(parsed.topic).toBe("X");
    expect(Array.isArray(parsed.items)).toBe(true);
  });
  it("escapeHtml escapes special characters", () => {
    expect(escapeHtml("<b>\"x\" & 'y'</b>")).toBe("&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
  });
  it("ungrounded items render with a warning in Markdown", () => {
    const faq = generateFaq("X", "", { count: 4 });
    const md = renderMarkdown(faq);
    expect(md).toContain("Not grounded");
  });
});

describe("ai-faq-generator validateJsonLd", () => {
  it("returns null for valid FAQPage JSON-LD", () => {
    const valid = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{
        "@type": "Question",
        name: "Q?",
        acceptedAnswer: { "@type": "Answer", text: "A." },
      }],
    });
    expect(validateJsonLd(valid)).toBeNull();
  });
  it("returns error for invalid JSON", () => {
    expect(validateJsonLd("{not json")).toContain("Invalid JSON");
  });
  it("returns error for wrong @type", () => {
    const bad = JSON.stringify({ "@type": "Article", mainEntity: [] });
    expect(validateJsonLd(bad)).toContain("FAQPage");
  });
  it("returns error for missing mainEntity array", () => {
    const bad = JSON.stringify({ "@type": "FAQPage", mainEntity: "oops" });
    expect(validateJsonLd(bad)).toContain("mainEntity");
  });
  it("returns error for empty answer text", () => {
    const bad = JSON.stringify({
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "" } }],
    });
    expect(validateJsonLd(bad)).toContain("text");
  });
  it("returns error for empty input", () => {
    expect(validateJsonLd("")).toContain("Empty");
  });
});

describe("ai-faq-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, topic: "X", tone: "neutral", length: "standard", questionCount: 12, groundedCount: 5, sourceChars: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, topic: "X", tone: "neutral", length: "standard", questionCount: 12, groundedCount: 5, sourceChars: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, topic: "X", tone: "neutral", length: "standard", questionCount: 12, groundedCount: 5, sourceChars: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-faq-generator shareable URL", () => {
  it("builds share URL with defaults when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ topic: "Acme Cloud", tone: "neutral", length: "standard", voiceSearch: false, count: 12 });
    expect(url).toContain("topic=Acme+Cloud");
    // Defaults should be omitted
    expect(url).not.toContain("tone=");
    expect(url).not.toContain("length=");
    expect(url).not.toContain("voice=");
    expect(url).not.toContain("count=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with all options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ topic: "X", tone: "formal", length: "detailed", voiceSearch: true, count: 16 });
    expect(url).toContain("tone=formal");
    expect(url).toContain("length=detailed");
    expect(url).toContain("voice=1");
    expect(url).toContain("count=16");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("topic=Acme+Cloud&tone=formal&length=detailed&voice=1&count=16");
    expect(p.topic).toBe("Acme Cloud");
    expect(p.tone).toBe("formal");
    expect(p.length).toBe("detailed");
    expect(p.voiceSearch).toBe(true);
    expect(p.count).toBe(16);
  });
  it("handles empty hash with defaults", () => {
    expect(parseShareUrl("")).toEqual({ topic: "", tone: "neutral", length: "standard", voiceSearch: false, count: 12 });
  });
  it("filters unknown values to defaults", () => {
    const p = parseShareUrl("topic=hi&tone=bogus&length=bad&voice=0&count=999");
    expect(p.tone).toBe("neutral");
    expect(p.length).toBe("standard");
    expect(p.voiceSearch).toBe(false);
    expect(p.count).toBe(12);
  });
  it("rejects out-of-range count", () => {
    expect(parseShareUrl("count=2").count).toBe(12); // too small
    expect(parseShareUrl("count=100").count).toBe(12); // too large
    expect(parseShareUrl("count=abc").count).toBe(12); // not a number
  });
});

describe("ai-faq-generator LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const p = buildLlmPrompt("Acme Cloud", "Acme Cloud is a backup solution.", "formal", "detailed");
    expect(p.system).toContain("FAQ generator");
    expect(p.system).toContain("formal");
    expect(p.system).toContain("detailed");
    expect(p.user).toContain("Acme Cloud");
    expect(p.user).toContain("Source content");
  });
  it("handles missing content in prompt", () => {
    const p = buildLlmPrompt("Acme Cloud", "", "neutral", "standard");
    expect(p.user).toContain("no source content");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// Suppress unused-import lint
export type _Unused = QuestionType | Tone | Length;
