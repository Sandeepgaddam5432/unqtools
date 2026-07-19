import { describe, it, expect, beforeEach } from "vitest";
import {
  TYPE_LABELS,
  LENGTH_LABELS,
  LENGTH_TARGETS,
  COMPARE_STRUCTURE_LABELS,
  HOOK_LABELS,
  SAMPLE_TOPICS,
  normalizeTopic,
  extractKeywords,
  titleCase,
  detectEssayType,
  suggestAngles,
  generateThesisVariants,
  generateHook,
  suggestHookStyle,
  estimateSectionWords,
  generateOutline,
  generateClosingThought,
  reorderSections,
  expandSection,
  chooseThesis,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type EssayType,
  type EssayLength,
  type CompareStructure,
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

describe("ai-essay-outline constants", () => {
  it("has 5 type labels", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(5);
    expect(TYPE_LABELS.argumentative).toContain("Argumentative");
  });
  it("has 4 length labels", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(4);
  });
  it("has length targets in ascending order", () => {
    expect(LENGTH_TARGETS.short).toBeLessThan(LENGTH_TARGETS.standard);
    expect(LENGTH_TARGETS.standard).toBeLessThan(LENGTH_TARGETS.long);
    expect(LENGTH_TARGETS.long).toBeLessThan(LENGTH_TARGETS.extended);
  });
  it("has 2 compare structure labels", () => {
    expect(Object.keys(COMPARE_STRUCTURE_LABELS)).toHaveLength(2);
  });
  it("has 5 hook labels", () => {
    expect(Object.keys(HOOK_LABELS)).toHaveLength(5);
  });
  it("has sample topics", () => {
    expect(SAMPLE_TOPICS.length).toBeGreaterThanOrEqual(5);
    expect(SAMPLE_TOPICS.some((t) => t.toLowerCase().includes("social media"))).toBe(true);
  });
});

describe("ai-essay-outline normalizeTopic", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTopic("  Should   AI   be   regulated?  ")).toBe("Should AI be regulated?");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("ai-essay-outline extractKeywords", () => {
  it("extracts keywords and filters stop words", () => {
    const kw = extractKeywords("The impact of remote work on urban economies");
    expect(kw).toContain("impact");
    expect(kw).toContain("remote");
    expect(kw).toContain("work");
    expect(kw).toContain("urban");
    expect(kw).toContain("economies");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("of");
    expect(kw).not.toContain("on");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("dedupes", () => {
    const kw = extractKeywords("AI AI AI");
    expect(kw).toEqual(["ai"]);
  });
});

describe("ai-essay-outline titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("the impact of remote work")).toBe("The Impact Of Remote Work");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-essay-outline detectEssayType", () => {
  it("detects argumentative from 'should'", () => {
    expect(detectEssayType("Should social media be regulated?")).toBe("argumentative");
  });
  it("detects compare-contrast from 'vs'", () => {
    expect(detectEssayType("Renewable vs nuclear energy")).toBe("compare-contrast");
  });
  it("detects expository from 'impact of'", () => {
    expect(detectEssayType("The impact of remote work on cities")).toBe("expository");
  });
  it("defaults to expository", () => {
    expect(detectEssayType("pizza")).toBe("expository");
  });
});

describe("ai-essay-outline suggestAngles", () => {
  it("returns angles for a topic", () => {
    const angles = suggestAngles("remote work");
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles.some((a) => a.toLowerCase().includes("remote"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(suggestAngles("")).toEqual([]);
  });
});

describe("ai-essay-outline generateThesisVariants", () => {
  it("produces 1-3 variants per type", () => {
    for (const type of Object.keys(TYPE_LABELS) as EssayType[]) {
      const variants = generateThesisVariants("climate change", type);
      expect(variants.length).toBeGreaterThanOrEqual(1);
      expect(variants.length).toBeLessThanOrEqual(3);
      for (const v of variants) {
        expect(v.text.length).toBeGreaterThan(10);
        expect(["for", "against", "neutral"]).toContain(v.stance);
      }
    }
  });
  it("argumentative includes both for and against", () => {
    const variants = generateThesisVariants("AI in criminal justice", "argumentative");
    expect(variants.some((v) => v.stance === "for")).toBe(true);
    expect(variants.some((v) => v.stance === "against")).toBe(true);
  });
});

describe("ai-essay-outline generateHook", () => {
  it("generates a hook for each style", () => {
    for (const style of Object.keys(HOOK_LABELS) as Array<keyof typeof HOOK_LABELS>) {
      const h = generateHook("climate change", "argumentative", style);
      expect(h.style).toBe(style);
      expect(h.text.length).toBeGreaterThan(10);
    }
  });
});

describe("ai-essay-outline suggestHookStyle", () => {
  it("suggests a different style per type", () => {
    const styles = new Set<string>();
    for (const type of Object.keys(TYPE_LABELS) as EssayType[]) {
      styles.add(suggestHookStyle(type));
    }
    // At least 3 distinct styles across 5 types
    expect(styles.size).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-essay-outline estimateSectionWords", () => {
  it("scales weight by total words", () => {
    expect(estimateSectionWords(0.2, 1000)).toBe(200);
  });
  it("enforces a minimum of 50", () => {
    expect(estimateSectionWords(0.001, 1000)).toBe(50);
  });
});

describe("ai-essay-outline generateOutline", () => {
  it("generates a complete argumentative outline", () => {
    const outline = generateOutline("Should social media be regulated?", "argumentative", "standard");
    expect(outline.topic).toBe("Should social media be regulated?");
    expect(outline.type).toBe("argumentative");
    expect(outline.thesisVariants.length).toBeGreaterThanOrEqual(1);
    expect(outline.chosenThesis.length).toBeGreaterThan(20);
    expect(outline.hook.text.length).toBeGreaterThan(10);
    expect(outline.sections.length).toBeGreaterThanOrEqual(4);
    expect(outline.closingThought.length).toBeGreaterThan(20);
  });
  it("argumentative includes counterargument + rebuttal sections", () => {
    const outline = generateOutline("Should AI be regulated?", "argumentative", "standard");
    const types = outline.sections.map((s) => s.type);
    expect(types).toContain("counterargument");
    expect(types).toContain("rebuttal");
  });
  it("expository has no counterargument", () => {
    const outline = generateOutline("How photosynthesis works", "expository", "standard");
    const types = outline.sections.map((s) => s.type);
    expect(types).not.toContain("counterargument");
  });
  it("narrative has a story arc", () => {
    const outline = generateOutline("The day I learned to swim", "narrative", "standard");
    const headings = outline.sections.map((s) => s.heading);
    expect(headings.some((h) => /inciting/i.test(h))).toBe(true);
    expect(headings.some((h) => /climax/i.test(h))).toBe(true);
    expect(headings.some((h) => /resolution/i.test(h))).toBe(true);
  });
  it("compare-contrast supports point-by-point", () => {
    const outline = generateOutline("Online vs classroom learning", "compare-contrast", "standard", "point-by-point");
    expect(outline.compareStructure).toBe("point-by-point");
    expect(outline.sections.length).toBeGreaterThanOrEqual(4);
  });
  it("compare-contrast supports block", () => {
    const outline = generateOutline("Online vs classroom learning", "compare-contrast", "standard", "block");
    expect(outline.compareStructure).toBe("block");
    const headings = outline.sections.map((s) => s.heading);
    expect(headings.some((h) => /Subject A/i.test(h))).toBe(true);
    expect(headings.some((h) => /Subject B/i.test(h))).toBe(true);
  });
  it("persuasive ends with call to action", () => {
    const outline = generateOutline("We must act on climate change", "persuasive", "standard");
    const last = outline.sections[outline.sections.length - 1];
    expect(last.type).toBe("conclusion");
    expect(last.heading.toLowerCase()).toContain("call to action");
  });
  it("every section has a topic sentence and word estimate > 0", () => {
    const outline = generateOutline("The history of jazz", "expository", "long");
    for (const s of outline.sections) {
      expect(s.topicSentence.length).toBeGreaterThan(10);
      expect(s.wordEstimate).toBeGreaterThan(0);
      expect(s.bulletPoints.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("body sections include evidence or cite slots", () => {
    const outline = generateOutline("Renewable vs nuclear energy", "argumentative", "standard");
    const bodies = outline.sections.filter((s) => s.type === "body");
    expect(bodies.length).toBeGreaterThan(0);
    // At least one body should have at least one slot
    expect(bodies.some((s) => s.slots.length > 0)).toBe(true);
  });
  it("longer length produces more total words than shorter", () => {
    const short = generateOutline("Cats", "expository", "short");
    const long = generateOutline("Cats", "expository", "long");
    expect(long.wordCount).toBeGreaterThan(short.wordCount);
  });
  it("returns empty topic gracefully", () => {
    const outline = generateOutline("", "expository", "standard");
    expect(outline.topic).toBe("");
    expect(outline.sections.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ai-essay-outline generateClosingThought", () => {
  it("returns a non-empty thought per type", () => {
    for (const type of Object.keys(TYPE_LABELS) as EssayType[]) {
      const ct = generateClosingThought("the topic", type);
      expect(ct.length).toBeGreaterThan(20);
    }
  });
});

describe("ai-essay-outline reorderSections", () => {
  it("reorders sections by id list", () => {
    const outline = generateOutline("Topic X", "expository", "standard");
    const ids = outline.sections.map((s) => s.id);
    const reversed = [...ids].reverse();
    const reordered = reorderSections(outline, reversed);
    expect(reordered.sections.map((s) => s.id)).toEqual(reversed);
  });
  it("preserves sections not in id list (appends them)", () => {
    const outline = generateOutline("Topic X", "expository", "standard");
    const reordered = reorderSections(outline, []);
    // All sections should still be there
    expect(reordered.sections.length).toBe(outline.sections.length);
  });
});

describe("ai-essay-outline expandSection", () => {
  it("adds sub-points and increases word estimate", () => {
    const outline = generateOutline("Topic X", "expository", "standard");
    const firstId = outline.sections[0].id;
    const before = outline.sections.find((s) => s.id === firstId)!;
    const expanded = expandSection(outline, firstId);
    const after = expanded.sections.find((s) => s.id === firstId)!;
    expect(after.bulletPoints.length).toBeGreaterThan(before.bulletPoints.length);
    expect(after.wordEstimate).toBeGreaterThanOrEqual(before.wordEstimate);
  });
  it("updates total wordCount", () => {
    const outline = generateOutline("Topic X", "expository", "standard");
    const firstId = outline.sections[0].id;
    const expanded = expandSection(outline, firstId);
    expect(expanded.wordCount).not.toBe(outline.wordCount);
  });
});

describe("ai-essay-outline chooseThesis", () => {
  it("switches to a different thesis variant", () => {
    const outline = generateOutline("Topic X", "argumentative", "standard");
    expect(outline.thesisVariants.length).toBeGreaterThanOrEqual(2);
    const next = chooseThesis(outline, 1);
    expect(next.chosenThesis).toBe(outline.thesisVariants[1].text);
  });
  it("returns outline unchanged for out-of-range index", () => {
    const outline = generateOutline("Topic X", "expository", "standard");
    const next = chooseThesis(outline, 999);
    expect(next.chosenThesis).toBe(outline.chosenThesis);
  });
});

describe("ai-essay-outline computeStats", () => {
  it("computes correct stats", () => {
    const outline = generateOutline("Topic X", "argumentative", "standard");
    const s = computeStats(outline);
    expect(s.totalSections).toBe(outline.sections.length);
    expect(s.totalBullets).toBe(outline.sections.reduce((a, b) => a + b.bulletPoints.length, 0));
    expect(s.totalSlots).toBe(outline.sections.reduce((a, b) => a + b.slots.length, 0));
    expect(s.totalWords).toBe(outline.wordCount);
    expect(s.typeLabel).toContain("Argumentative");
  });
});

describe("ai-essay-outline render functions", () => {
  it("renderText contains topic and thesis", () => {
    const outline = generateOutline("Topic X", "argumentative", "standard");
    const txt = renderText(outline);
    expect(txt).toContain("Topic X");
    expect(txt).toContain("THESIS:");
    expect(txt).toContain("CLOSING THOUGHT:");
  });
  it("renderMarkdown contains headers and placeholders", () => {
    const outline = generateOutline("Topic X", "argumentative", "standard");
    const md = renderMarkdown(outline);
    expect(md).toContain("# Essay Outline");
    expect(md).toContain("## Thesis");
    expect(md).toContain("[EVIDENCE");
    expect(md).toContain("[CITE");
  });
  it("renderJson produces valid JSON", () => {
    const outline = generateOutline("Topic X", "argumentative", "standard");
    const j = renderJson(outline);
    const parsed = JSON.parse(j);
    expect(parsed.topic).toBe("Topic X");
    expect(parsed.type).toBe("argumentative");
    expect(Array.isArray(parsed.sections)).toBe(true);
  });
});

describe("ai-essay-outline history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      topic: "X",
      type: "argumentative",
      length: "standard",
      thesis: "...",
      sectionCount: 5,
      wordCount: 1000,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        topic: "X",
        type: "argumentative",
        length: "standard",
        thesis: "...",
        sectionCount: 5,
        wordCount: 1000,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      topic: "X",
      type: "argumentative",
      length: "standard",
      thesis: "...",
      sectionCount: 5,
      wordCount: 1000,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-essay-outline share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ topic: "climate change", type: "argumentative", length: "long" });
    expect(url).toContain("topic=climate+change");
    expect(url).toContain("type=argumentative");
    expect(url).toContain("length=long");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("topic=climate+change&type=compare-contrast&length=long&cmp=block");
    expect(s.topic).toBe("climate change");
    expect(s.type).toBe("compare-contrast");
    expect(s.length).toBe("long");
    expect(s.compareStructure).toBe("block");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.topic).toBe("");
    expect(s.type).toBe("argumentative");
    expect(s.length).toBe("standard");
    expect(s.compareStructure).toBeUndefined();
  });
  it("filters unknown values to defaults", () => {
    const s = parseShareUrl("topic=hi&type=bogus&length=bad&cmp=evil");
    expect(s.type).toBe("argumentative");
    expect(s.length).toBe("standard");
    expect(s.compareStructure).toBeUndefined();
  });
});

describe("ai-essay-outline LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const p = buildLlmPrompt("climate change", "argumentative", "long");
    expect(p.system).toContain("argumentative");
    expect(p.system).toContain("essay-outline");
    expect(p.user).toContain("climate change");
  });
  it("includes compare structure for compare-contrast", () => {
    const p = buildLlmPrompt("A vs B", "compare-contrast", "standard", "block");
    expect(p.system).toContain("block");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// Suppress unused-import lint
export type _Unused = EssayType | EssayLength | CompareStructure;
