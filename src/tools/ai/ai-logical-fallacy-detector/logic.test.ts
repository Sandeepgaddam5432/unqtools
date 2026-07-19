import { describe, it, expect, beforeEach } from "vitest";
import {
  FALLACIES,
  FALLACY_IDS,
  FALLACY_MAP,
  SENSITIVITY_LABELS,
  SENSITIVITY_THRESHOLDS,
  CATEGORY_LABELS,
  SAMPLE_ARGUMENTS,
  DEFAULT_OPTIONS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeText,
  escapeHtml,
  countWords,
  getFallacyInfo,
  clampConfidence,
  adjustedConfidence,
  buildFalsePositiveRisk,
  detectFallacies,
  analyze,
  computeStats,
  buildHighlightSegments,
  renderHighlightedHtml,
  suggestSteelman,
  renderMarkdownReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type FallacyId,
  type DetectionOptions,
  type Sensitivity,
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

describe("ai-logical-fallacy-detector constants", () => {
  it("has at least 23 fallacies", () => {
    expect(FALLACIES.length).toBeGreaterThanOrEqual(23);
  });

  it("FALLACY_IDS matches FALLACIES ids", () => {
    expect(FALLACY_IDS).toEqual(FALLACIES.map((f) => f.id));
  });

  it("FALLACY_MAP has entry for every id", () => {
    for (const id of FALLACY_IDS) {
      expect(FALLACY_MAP[id]).toBeDefined();
      expect(FALLACY_MAP[id].id).toBe(id);
    }
  });

  it("has 3 sensitivities", () => {
    expect(Object.keys(SENSITIVITY_LABELS)).toHaveLength(3);
    expect(SENSITIVITY_LABELS.balanced).toContain("Balanced");
  });

  it("strict threshold > balanced > lenient", () => {
    expect(SENSITIVITY_THRESHOLDS.strict).toBeGreaterThan(SENSITIVITY_THRESHOLDS.balanced);
    expect(SENSITIVITY_THRESHOLDS.balanced).toBeGreaterThan(SENSITIVITY_THRESHOLDS.lenient);
  });

  it("has 5 fallacy categories with labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(5);
    expect(CATEGORY_LABELS.relevance).toBe("Relevance");
  });

  it("includes required fallacies", () => {
    expect(FALLACY_IDS).toContain("ad-hominem");
    expect(FALLACY_IDS).toContain("strawman");
    expect(FALLACY_IDS).toContain("slippery-slope");
    expect(FALLACY_IDS).toContain("false-dilemma");
    expect(FALLACY_IDS).toContain("no-true-scotsman");
    expect(FALLACY_IDS).toContain("sunk-cost");
  });

  it("has sample arguments", () => {
    expect(SAMPLE_ARGUMENTS.length).toBeGreaterThanOrEqual(3);
  });

  it("DEFAULT_OPTIONS is balanced", () => {
    expect(DEFAULT_OPTIONS.sensitivity).toBe("balanced");
  });

  it("every fallacy has at least one pattern with confidence in [0,1]", () => {
    for (const f of FALLACIES) {
      expect(f.patterns.length).toBeGreaterThan(0);
      for (const p of f.patterns) {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("ai-logical-fallacy-detector helpers", () => {
  it("normalizeText collapses whitespace and newlines", () => {
    expect(normalizeText("a   b\r\n\r\n\r\nc")).toBe("a b\n\nc");
  });
  it("escapeHtml escapes special characters", () => {
    expect(escapeHtml("<b>&\"'</b>")).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("hello world  foo")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("clampConfidence clamps to [0,1]", () => {
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(0.5)).toBe(0.5);
  });
  it("adjustedConfidence nudges by sensitivity", () => {
    expect(adjustedConfidence(0.5, "lenient")).toBeCloseTo(0.55);
    expect(adjustedConfidence(0.5, "strict")).toBeCloseTo(0.45);
    expect(adjustedConfidence(0.5, "balanced")).toBeCloseTo(0.5);
  });
  it("getFallacyInfo returns info for known id", () => {
    const info = getFallacyInfo("ad-hominem");
    expect(info?.name).toBe("Ad Hominem");
  });
  it("getFallacyInfo returns undefined for unknown id (cast)", () => {
    expect(getFallacyInfo("not-a-fallacy" as FallacyId)).toBeUndefined();
  });
  it("buildFalsePositiveRisk returns a non-empty string for every fallacy", () => {
    for (const id of FALLACY_IDS) {
      const r = buildFalsePositiveRisk(id);
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-logical-fallacy-detector detectFallacies", () => {
  it("returns empty for empty input", () => {
    expect(detectFallacies("")).toEqual([]);
    expect(detectFallacies("   ")).toEqual([]);
  });

  it("detects ad hominem", () => {
    const d = detectFallacies("You're an idiot and your argument is wrong.");
    expect(d.length).toBeGreaterThan(0);
    expect(d.some((x) => x.id === "ad-hominem")).toBe(true);
  });

  it("detects strawman", () => {
    const d = detectFallacies("So you're saying we should just give up?");
    expect(d.some((x) => x.id === "strawman")).toBe(true);
  });

  it("detects false dilemma", () => {
    const d = detectFallacies("You're either with us or against us.");
    expect(d.some((x) => x.id === "false-dilemma")).toBe(true);
  });

  it("detects no true scotsman", () => {
    const d = detectFallacies("No true fan would say that.");
    expect(d.some((x) => x.id === "no-true-scotsman")).toBe(true);
  });

  it("detects appeal to popularity", () => {
    const d = detectFallacies("Everyone knows that. Millions of people can't be wrong.");
    expect(d.some((x) => x.id === "appeal-to-popularity")).toBe(true);
  });

  it("detects sunk cost", () => {
    const d = detectFallacies("We've invested so much — we can't give up now.");
    expect(d.some((x) => x.id === "sunk-cost")).toBe(true);
  });

  it("detects hasty generalization", () => {
    const d = detectFallacies("I met one once and they were rude, and they always are.");
    expect(d.some((x) => x.id === "hasty-generalization")).toBe(true);
  });

  it("detects tu quoque", () => {
    const d = detectFallacies("But you do it too! What about when you did the same?");
    expect(d.some((x) => x.id === "tu-quoque")).toBe(true);
  });

  it("detects middle ground", () => {
    const d = detectFallacies("The truth is somewhere in the middle.");
    expect(d.some((x) => x.id === "middle-ground")).toBe(true);
  });

  it("detects no fallacy in a clean argument", () => {
    const clean = "Water boils at 100°C at sea level because the vapor pressure equals atmospheric pressure.";
    expect(detectFallacies(clean).length).toBe(0);
  });

  it("returns detections sorted by startIndex", () => {
    const text =
      "You're an idiot. So you're saying we should give up. " +
      "We've invested so much and can't give up now. No true fan would disagree.";
    const d = detectFallacies(text);
    for (let i = 1; i < d.length; i++) {
      expect(d[i].startIndex).toBeGreaterThanOrEqual(d[i - 1].startIndex);
    }
  });

  it("respects sensitivity: strict filters more than lenient", () => {
    const text = "It is what it is. I once knew someone and they always lie.";
    const strict = detectFallacies(text, { sensitivity: "strict" });
    const lenient = detectFallacies(text, { sensitivity: "lenient" });
    expect(lenient.length).toBeGreaterThanOrEqual(strict.length);
  });

  it("respects onlyIds filter", () => {
    const text = "You're an idiot. So you're saying we should give up.";
    const d = detectFallacies(text, { sensitivity: "lenient", onlyIds: ["ad-hominem"] });
    expect(d.every((x) => x.id === "ad-hominem")).toBe(true);
    expect(d.length).toBeGreaterThan(0);
  });

  it("includes confidence, explanation, steelman, falsePositiveRisk", () => {
    const d = detectFallacies("You're an idiot.", { sensitivity: "balanced" });
    expect(d.length).toBeGreaterThan(0);
    const first = d[0];
    expect(first.confidence).toBeGreaterThan(0);
    expect(first.confidence).toBeLessThanOrEqual(1);
    expect(first.explanation.length).toBeGreaterThan(0);
    expect(first.steelman.length).toBeGreaterThan(0);
    expect(first.falsePositiveRisk.length).toBeGreaterThan(0);
    expect(first.snippet.length).toBeGreaterThan(0);
    expect(first.endIndex).toBeGreaterThan(first.startIndex);
  });

  it("deduplicates overlapping detections of the same fallacy", () => {
    // The 'so you're saying' strawman pattern is the only one expected here.
    const text = "So you're saying we should give up.";
    const d = detectFallacies(text, { sensitivity: "lenient" });
    const strawman = d.filter((x) => x.id === "strawman");
    expect(strawman.length).toBeLessThanOrEqual(1);
  });
});

describe("ai-logical-fallacy-detector analyze + stats", () => {
  it("analyze returns DetectionResult with stats", () => {
    const result = analyze("You're an idiot. So you're saying we should give up.");
    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.stats.total).toBe(result.detections.length);
    expect(result.sensitivity).toBe("balanced");
  });

  it("computeStats computes byCategory and byFallacy", () => {
    const result = analyze(
      "You're an idiot. So you're saying we should give up. You're either with us or against us.",
    );
    expect(result.stats.total).toBeGreaterThan(0);
    expect(Object.values(result.stats.byCategory).reduce((a, b) => a + b, 0)).toBe(
      result.stats.total,
    );
    const fallacyCounts = Object.values(result.stats.byFallacy) as number[];
    expect(fallacyCounts.reduce((a, b) => a + b, 0)).toBe(result.stats.total);
  });

  it("computeStats returns zero totals for empty input", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.byCategory.relevance).toBe(0);
  });
});

describe("ai-logical-fallacy-detector highlight", () => {
  it("buildHighlightSegments splits text and tags detections", () => {
    const text = "Hello. You're an idiot. Goodbye.";
    const d = detectFallacies(text, { sensitivity: "balanced" });
    const segs = buildHighlightSegments(text, d);
    expect(segs.length).toBeGreaterThan(1);
    const tagged = segs.filter((s) => s.detection);
    expect(tagged.length).toBe(d.length);
  });

  it("buildHighlightSegments handles no detections", () => {
    const segs = buildHighlightSegments("plain text only", []);
    expect(segs).toEqual([{ text: "plain text only" }]);
  });

  it("renderHighlightedHtml wraps detections in <mark>", () => {
    const text = "You're an idiot.";
    const d = detectFallacies(text, { sensitivity: "balanced" });
    const html = renderHighlightedHtml(text, d);
    expect(html).toContain("<mark");
    expect(html).toContain("unq-fallacy");
    expect(html).toContain("</mark>");
  });

  it("renderHighlightedHtml escapes HTML in text", () => {
    const text = "<script>x</script> You're an idiot.";
    const d = detectFallacies(text, { sensitivity: "balanced" });
    const html = renderHighlightedHtml(text, d);
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("ai-logical-fallacy-detector steelman + report", () => {
  it("suggestSteelman returns text when no detections", () => {
    expect(suggestSteelman("clean argument", [])).toBe("clean argument");
  });

  it("suggestSteelman includes revision hints when detections exist", () => {
    const text = "You're an idiot. So you're saying we should give up.";
    const d = detectFallacies(text, { sensitivity: "balanced" });
    const steel = suggestSteelman(text, d);
    expect(steel).toContain("Steelman suggestion");
    expect(steel).toContain("Revisions to consider");
  });

  it("renderMarkdownReport includes header, stats, and flags", () => {
    const result = analyze(
      "You're an idiot. So you're saying we should give up.",
    );
    const md = renderMarkdownReport("You're an idiot. So you're saying we should give up.", result);
    expect(md).toContain("# Logical Fallacy Report");
    expect(md).toContain("Sensitivity");
    expect(md).toContain("By category");
  });

  it("renderMarkdownReport handles zero detections", () => {
    const text = "A clean, evidence-based argument.";
    const result = analyze(text);
    const md = renderMarkdownReport(text, result);
    expect(md).toContain("Total flags: **0**");
    expect(md).toContain("(none detected)");
  });
});

describe("ai-logical-fallacy-detector history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads an entry", () => {
    saveHistory({
      ts: 1,
      textLength: 100,
      sensitivity: "balanced",
      totalDetections: 3,
      topFallacy: "ad-hominem",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].topFallacy).toBe("ad-hominem");
  });

  it(`caps at ${HISTORY_MAX} entries`, () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        textLength: 10,
        sensitivity: "balanced",
        totalDetections: 1,
        topFallacy: "strawman",
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });

  it("clears history", () => {
    saveHistory({
      ts: 1,
      textLength: 10,
      sensitivity: "balanced",
      totalDetections: 1,
      topFallacy: "strawman",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("uses the correct storage key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-logical-fallacy-detector:history");
  });
});

describe("ai-logical-fallacy-detector shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      text: "hi there",
      sensitivity: "lenient",
      onlyIds: ["ad-hominem", "strawman"],
    });
    expect(url).toContain("text=hi+there");
    expect(url).toContain("s=lenient");
    expect(url).toContain("ids=ad-hominem%2Cstrawman");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const s = parseShareUrl("text=hi+there&s=strict&ids=ad-hominem%2Cstrawman");
    expect(s.text).toBe("hi there");
    expect(s.sensitivity).toBe("strict");
    expect(s.onlyIds).toEqual(["ad-hominem", "strawman"]);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ text: "", sensitivity: "balanced", onlyIds: [] });
  });

  it("defaults to balanced for invalid sensitivity", () => {
    const s = parseShareUrl("text=hi&s=invalid");
    expect(s.sensitivity).toBe("balanced");
  });

  it("filters unknown fallacy ids", () => {
    const s = parseShareUrl("text=hi&ids=ad-hominem%2Cfake-id");
    expect(s.onlyIds).toEqual(["ad-hominem"]);
  });
});

describe("ai-logical-fallacy-detector LLM prompt", () => {
  it("buildLlmPrompt produces system + user messages", () => {
    const p = buildLlmPrompt("You're an idiot.", "balanced");
    expect(p.system.length).toBeGreaterThan(0);
    expect(p.user).toContain("balanced");
    expect(p.user).toContain("You're an idiot.");
    expect(p.user).toContain("JSON");
  });

  it("renderLlmResult renders a valid JSON response", () => {
    const raw = JSON.stringify({
      detections: [
        {
          name: "Ad Hominem",
          quote: "You're an idiot.",
          explanation: "Attacks the person.",
          steelman: "Address the argument.",
        },
      ],
      notes: "Looks like a heated exchange.",
    });
    const out = renderLlmResult(raw);
    expect(out).toContain("# LLM Analysis");
    expect(out).toContain("Ad Hominem");
    expect(out).toContain("Attacks the person.");
    expect(out).toContain("Looks like a heated exchange.");
  });

  it("renderLlmResult returns raw text when JSON is malformed", () => {
    const raw = "this is not json at all";
    expect(renderLlmResult(raw)).toBe(raw);
  });

  it("renderLlmResult returns empty for empty input", () => {
    expect(renderLlmResult("")).toBe("");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = DetectionOptions | Sensitivity;
