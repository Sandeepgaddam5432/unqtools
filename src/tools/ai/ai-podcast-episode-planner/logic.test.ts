import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FORMAT_LABELS,
  DURATION_PRESETS,
  TOPIC_PRESETS,
  PLATFORM_LABELS,
  SEGMENT_TEMPLATES,
  normalizeTopic,
  parseGuests,
  extractKeywords,
  renderTemplate,
  formatTimestamp,
  computeTimestamps,
  generateAdBreaks,
  generateChapterMarkers,
  generateGuestQuestions,
  generateTitleOptions,
  generateDescriptionOptions,
  generateHook,
  generateShowNotes,
  generateSocialClips,
  validateInput,
  generateEpisode,
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
  type EpisodeFormat,
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

describe("ai-podcast-planner constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-podcast-planner:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 5 episode formats", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(5);
  });
  it("has segment templates for every format", () => {
    for (const f of Object.keys(SEGMENT_TEMPLATES) as EpisodeFormat[]) {
      expect(SEGMENT_TEMPLATES[f].length).toBeGreaterThanOrEqual(6);
    }
  });
  it("segment weights sum to ~1.0 per format", () => {
    for (const f of Object.keys(SEGMENT_TEMPLATES) as EpisodeFormat[]) {
      const sum = SEGMENT_TEMPLATES[f].reduce((a, s) => a + s.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
  it("has duration presets", () => {
    expect(DURATION_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(DURATION_PRESETS).toContain(30);
  });
  it("has topic presets", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("has platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(4);
  });
});

describe("ai-podcast-planner normalizeTopic", () => {
  it("collapses whitespace", () => {
    expect(normalizeTopic("  the   future   of  remote  work ")).toBe("the future of remote work");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("ai-podcast-planner parseGuests", () => {
  it("parses newline-separated", () => {
    expect(parseGuests("Jane Doe\nJohn Smith")).toEqual(["Jane Doe", "John Smith"]);
  });
  it("parses comma-separated", () => {
    expect(parseGuests("Jane Doe, John Smith; A. N. Other")).toEqual([
      "Jane Doe", "John Smith", "A. N. Other",
    ]);
  });
  it("skips blank entries", () => {
    expect(parseGuests("Jane Doe\n\n  \nJohn Smith")).toEqual(["Jane Doe", "John Smith"]);
  });
  it("returns empty for empty input", () => {
    expect(parseGuests("")).toEqual([]);
  });
});

describe("ai-podcast-planner extractKeywords", () => {
  it("extracts meaningful words, drops stopwords", () => {
    const kw = extractKeywords("The Future of Remote Work");
    expect(kw).toContain("future");
    expect(kw).toContain("remote");
    expect(kw).toContain("work");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("of");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("strips parenthetical content", () => {
    const kw = extractKeywords("DNS (Domain Name System) Explained");
    expect(kw).toContain("dns");
    expect(kw).not.toContain("domain");
  });
  it("deduplicates keywords", () => {
    const kw = extractKeywords("time management time");
    const freq = kw.filter((k) => k === "time").length;
    expect(freq).toBe(1);
  });
});

describe("ai-podcast-planner renderTemplate", () => {
  it("substitutes all placeholders", () => {
    const out = renderTemplate("{topic} with {guest} ({dur} min, kw={kw})", {
      topic: "AI", dur: "30", guests: "Alice", guest: "Alice", kw: "ai",
    });
    expect(out).toBe("AI with Alice (30 min, kw=ai)");
  });
});

describe("ai-podcast-planner formatTimestamp", () => {
  it("formats MM:SS under an hour", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65)).toBe("01:05");
    expect(formatTimestamp(595)).toBe("09:55");
  });
  it("formats H:MM:SS over an hour", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3665)).toBe("1:01:05");
  });
  it("clamps negative to 00:00", () => {
    expect(formatTimestamp(-10)).toBe("00:00");
  });
});

describe("ai-podcast-planner computeTimestamps", () => {
  it("computes start/end times based on weights", () => {
    const ts = computeTimestamps(SEGMENT_TEMPLATES.solo, 30 * 60);
    expect(ts[0].startSec).toBe(0);
    expect(ts[0].startLabel).toBe("00:00");
    expect(ts[ts.length - 1].endSec).toBe(30 * 60);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i].startSec).toBe(ts[i - 1].endSec);
    }
  });
  it("preserves labels and weights", () => {
    const ts = computeTimestamps(SEGMENT_TEMPLATES.interview, 60 * 60);
    expect(ts.length).toBe(SEGMENT_TEMPLATES.interview.length);
    for (let i = 0; i < ts.length; i++) {
      expect(ts[i].label).toBe(SEGMENT_TEMPLATES.interview[i].label);
      expect(ts[i].weight).toBe(SEGMENT_TEMPLATES.interview[i].weight);
    }
  });
});

describe("ai-podcast-planner generateAdBreaks", () => {
  it("pre-roll for any duration", () => {
    const breaks = generateAdBreaks(5 * 60);
    expect(breaks).toHaveLength(1);
    expect(breaks[0].position).toBe("pre-roll");
  });
  it("adds mid-roll 1 for episodes >= 20 min", () => {
    const breaks = generateAdBreaks(20 * 60);
    expect(breaks.some((b) => b.position === "mid-roll-1")).toBe(true);
  });
  it("adds mid-roll 2 for episodes >= 40 min", () => {
    const breaks = generateAdBreaks(40 * 60);
    expect(breaks.some((b) => b.position === "mid-roll-2")).toBe(true);
  });
  it("adds post-roll for episodes >= 10 min", () => {
    const breaks = generateAdBreaks(15 * 60);
    expect(breaks.some((b) => b.position === "post-roll")).toBe(true);
  });
  it("places mid-roll-1 at 25% of runtime", () => {
    const breaks = generateAdBreaks(60 * 60);
    const m1 = breaks.find((b) => b.position === "mid-roll-1");
    expect(m1).toBeDefined();
    expect(m1!.atSec).toBe(15 * 60);
  });
});

describe("ai-podcast-planner generateChapterMarkers", () => {
  it("creates one marker per non-ad segment", () => {
    const segs = computeTimestamps(SEGMENT_TEMPLATES.solo, 30 * 60);
    const markers = generateChapterMarkers(segs);
    expect(markers).toHaveLength(segs.length);
    expect(markers[0].index).toBe(1);
    expect(markers[0].timeLabel).toBe(segs[0].startLabel);
  });
  it("skips ad-break segments", () => {
    const segs = [
      ...computeTimestamps(SEGMENT_TEMPLATES.solo, 30 * 60),
      {
        ...SEGMENT_TEMPLATES.solo[0],
        type: "ad-break" as const,
        label: "Ad",
        weight: 0.02,
        startSec: 0, endSec: 0, startLabel: "00:00", endLabel: "00:00",
      },
    ];
    const markers = generateChapterMarkers(segs);
    expect(markers.every((m) => m.title !== "Ad")).toBe(true);
  });
});

describe("ai-podcast-planner generateGuestQuestions", () => {
  it("returns empty for no guests", () => {
    expect(generateGuestQuestions([], "AI", "interview")).toEqual([]);
  });
  it("generates 10+ questions for one interview guest", () => {
    const qs = generateGuestQuestions(["Jane"], "AI", "interview");
    expect(qs.length).toBeGreaterThanOrEqual(10);
    expect(qs.every((q) => q.guest === "Jane")).toBe(true);
  });
  it("limits to 4 per panelist for panel format", () => {
    const qs = generateGuestQuestions(["A", "B", "C"], "AI", "panel");
    expect(qs.length).toBe(12);
    expect(qs.filter((q) => q.guest === "A")).toHaveLength(4);
  });
  it("substitutes topic into question", () => {
    const qs = generateGuestQuestions(["Jane"], "Quantum Computing", "interview");
    expect(qs.some((q) => q.question.includes("Quantum Computing"))).toBe(true);
  });
  it("each question has an intent", () => {
    const qs = generateGuestQuestions(["Jane"], "AI", "interview");
    expect(qs.every((q) => q.intent.length > 0)).toBe(true);
  });
});

describe("ai-podcast-planner generateTitleOptions", () => {
  it("returns 4 titles per format", () => {
    for (const f of Object.keys(FORMAT_LABELS) as EpisodeFormat[]) {
      expect(generateTitleOptions("AI in everyday life", f)).toHaveLength(4);
    }
  });
  it("includes the topic in at least one title", () => {
    const titles = generateTitleOptions("Compound interest", "solo");
    expect(titles.some((t) => t.includes("Compound interest"))).toBe(true);
  });
});

describe("ai-podcast-planner generateDescriptionOptions", () => {
  it("returns 3 descriptions", () => {
    expect(generateDescriptionOptions("AI", "solo", 30, [])).toHaveLength(3);
  });
  it("includes duration in description", () => {
    const ds = generateDescriptionOptions("AI", "solo", 45, []);
    expect(ds.every((d) => d.includes("45"))).toBe(true);
  });
  it("includes guest names when provided", () => {
    const ds = generateDescriptionOptions("AI", "interview", 30, ["Jane Doe"]);
    expect(ds.every((d) => d.includes("Jane Doe"))).toBe(true);
  });
});

describe("ai-podcast-planner generateHook", () => {
  it("returns a non-empty hook for every format", () => {
    for (const f of Object.keys(FORMAT_LABELS) as EpisodeFormat[]) {
      const h = generateHook("AI", f);
      expect(h.length).toBeGreaterThan(0);
      expect(h).toContain("AI");
    }
  });
});

describe("ai-podcast-planner generateShowNotes", () => {
  it("includes topic, format, chapters, talking points", () => {
    const segs = computeTimestamps(SEGMENT_TEMPLATES.solo, 30 * 60);
    const markers = generateChapterMarkers(segs);
    const notes = generateShowNotes("AI", "solo", [], segs, markers);
    const joined = notes.join("\n");
    expect(joined).toContain("Topic: AI");
    expect(joined).toContain("Format: Solo monologue");
    expect(joined).toContain("Chapters:");
    expect(joined).toContain("Key talking points:");
  });
});

describe("ai-podcast-planner generateSocialClips", () => {
  it("returns up to 4 clips", () => {
    const segs = computeTimestamps(SEGMENT_TEMPLATES.interview, 30 * 60);
    const clips = generateSocialClips(segs, "AI");
    expect(clips.length).toBeLessThanOrEqual(4);
    expect(clips.length).toBeGreaterThan(0);
  });
  it("each clip has a platform and duration", () => {
    const segs = computeTimestamps(SEGMENT_TEMPLATES.solo, 30 * 60);
    const clips = generateSocialClips(segs, "AI");
    for (const c of clips) {
      expect(PLATFORM_LABELS[c.suggestedPlatform]).toBeTruthy();
      expect(c.durationSec).toBeGreaterThan(0);
    }
  });
});

describe("ai-podcast-planner validateInput", () => {
  it("returns null for valid solo input", () => {
    expect(validateInput("AI", 30, "solo", [])).toBeNull();
  });
  it("returns null for valid interview input with one guest", () => {
    expect(validateInput("AI", 30, "interview", ["Jane"])).toBeNull();
  });
  it("errors on empty topic", () => {
    expect(validateInput("", 30, "solo", [])).toContain("topic");
  });
  it("errors on non-positive duration", () => {
    expect(validateInput("AI", 0, "solo", [])).toContain("Duration");
  });
  it("errors on too-long duration", () => {
    expect(validateInput("AI", 300, "solo", [])).toContain("240");
  });
  it("errors on interview without guests", () => {
    expect(validateInput("AI", 30, "interview", [])).toContain("guest");
  });
  it("errors on interview with multiple guests", () => {
    expect(validateInput("AI", 30, "interview", ["A", "B"])).toContain("Panel");
  });
  it("errors on panel without guests", () => {
    expect(validateInput("AI", 30, "panel", [])).toContain("guest");
  });
});

describe("ai-podcast-planner generateEpisode", () => {
  it("generates a full plan for solo", () => {
    const plan = generateEpisode({
      topic: "The future of remote work",
      format: "solo",
      durationMin: 30,
      guests: [],
    });
    expect(plan.topic).toBe("The future of remote work");
    expect(plan.format).toBe("solo");
    expect(plan.durationMin).toBe(30);
    expect(plan.segments.length).toBeGreaterThanOrEqual(6);
    expect(plan.hook).toBeTruthy();
    expect(plan.chapterMarkers.length).toBe(plan.segments.length);
    expect(plan.titleOptions).toHaveLength(4);
    expect(plan.descriptionOptions).toHaveLength(3);
    expect(plan.socialClips.length).toBeGreaterThan(0);
    expect(plan.showNotes.length).toBeGreaterThan(0);
    expect(plan.keywords).toContain("remote");
    expect(plan.id).toMatch(/^ep-\d+-\d+$/);
  });
  it("generates interview plan with guest questions", () => {
    const plan = generateEpisode({
      topic: "AI in everyday life",
      format: "interview",
      durationMin: 45,
      guests: ["Jane Doe"],
    });
    expect(plan.guests).toEqual(["Jane Doe"]);
    expect(plan.guestQuestions.length).toBeGreaterThanOrEqual(10);
    expect(plan.guestQuestions.every((q) => q.guest === "Jane Doe")).toBe(true);
  });
  it("generates panel plan with multiple guests", () => {
    const plan = generateEpisode({
      topic: "Side hustles that work",
      format: "panel",
      durationMin: 60,
      guests: ["A", "B", "C"],
    });
    expect(plan.guestQuestions.length).toBe(12); // 4 per panelist
  });
  it("throws on invalid input", () => {
    expect(() => generateEpisode({ topic: "", format: "solo", durationMin: 30, guests: [] }))
      .toThrow(/topic/);
    expect(() => generateEpisode({ topic: "AI", format: "interview", durationMin: 30, guests: [] }))
      .toThrow(/guest/);
  });
});

describe("ai-podcast-planner computeStats", () => {
  it("computes summary stats for an episode", () => {
    const plan = generateEpisode({
      topic: "AI", format: "solo", durationMin: 30, guests: [],
    });
    const s = computeStats(plan);
    expect(s.segmentCount).toBe(plan.segments.length);
    expect(s.totalRuntimeSec).toBe(30 * 60);
    expect(s.talkingPointCount).toBeGreaterThan(0);
    expect(s.titleOptionCount).toBe(4);
  });
});

describe("ai-podcast-planner renderers", () => {
  const plan = generateEpisode({
    topic: "AI in everyday life",
    format: "interview",
    durationMin: 45,
    guests: ["Jane Doe"],
  });
  it("renderText includes topic, hook, segments, ad breaks, questions", () => {
    const t = renderText(plan);
    expect(t).toContain("PODCAST EPISODE PLAN");
    expect(t).toContain("Topic: AI in everyday life");
    expect(t).toContain("HOOK:");
    expect(t).toContain("SEGMENTS");
    expect(t).toContain("GUEST QUESTIONS:");
  });
  it("renderText returns empty for empty plan? (actually plan is non-empty)", () => {
    // Plans are always non-empty; just verify it's a string
    expect(typeof renderText(plan)).toBe("string");
  });
  it("renderMarkdown includes H1, hook as blockquote, segment headers", () => {
    const m = renderMarkdown(plan);
    expect(m).toContain(`# ${plan.titleOptions[0]}`);
    expect(m).toContain(`> ${plan.hook}`);
    expect(m).toContain("## Segments");
    expect(m).toContain("## Guest questions");
  });
  it("renderJson is valid JSON", () => {
    const j = renderJson(plan);
    const parsed = JSON.parse(j);
    expect(parsed.topic).toBe("AI in everyday life");
    expect(parsed.format).toBe("interview");
    expect(Array.isArray(parsed.segments)).toBe(true);
  });
});

describe("ai-podcast-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, topic: "AI", format: "solo", durationMin: 30,
      guestCount: 0, segmentCount: 6, guestQuestionCount: 0,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].topic).toBe("AI");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, topic: "x", format: "solo", durationMin: 10,
        guestCount: 0, segmentCount: 6, guestQuestionCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x", format: "solo", durationMin: 10,
      guestCount: 0, segmentCount: 6, guestQuestionCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-podcast-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "AI in everyday life",
      format: "interview",
      durationMin: 45,
      guests: "Jane Doe",
    });
    expect(url).toContain("t=AI+in+everyday+life");
    expect(url).toContain("f=interview");
    expect(url).toContain("d=45");
    expect(url).toContain("g=Jane+Doe");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=AI&f=interview&d=45&g=Jane%20Doe");
    expect(p.topic).toBe("AI");
    expect(p.format).toBe("interview");
    expect(p.durationMin).toBe(45);
    expect(p.guests).toBe("Jane Doe");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown format", () => {
    const p = parseShareUrl("t=AI&f=unknown-format");
    expect(p.format).toBeUndefined();
  });
  it("filters invalid duration", () => {
    const p = parseShareUrl("t=AI&d=not-a-number");
    expect(p.durationMin).toBeUndefined();
  });
});

describe("ai-podcast-planner LLM prompt builder", () => {
  it("includes topic, format, duration, guests", () => {
    const p = buildLlmPrompt("AI in everyday life", "interview", 45, ["Jane Doe"]);
    expect(p).toContain("AI in everyday life");
    expect(p).toContain("Interview");
    expect(p).toContain("45");
    expect(p).toContain("Jane Doe");
  });
  it("notes solo when no guests", () => {
    const p = buildLlmPrompt("AI", "solo", 30, []);
    expect(p).toContain("No guests");
  });
  it("asks for JSON object", () => {
    const p = buildLlmPrompt("AI", "solo", 30, []);
    expect(p).toContain("JSON object");
  });
});

describe("ai-podcast-planner renderLlmResult", () => {
  it("parses valid JSON object", () => {
    const raw = JSON.stringify({
      hook: "Tease the big insight.",
      segmentSuggestions: [
        { label: "Cold open", talkingPoints: ["A", "B"] },
        { label: "Main", talkingPoints: ["C"] },
      ],
      guestQuestions: ["Q1", "Q2"],
      titleOptions: ["T1", "T2"],
      showNotes: ["N1", "N2"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.hook).toBe("Tease the big insight.");
      expect(r.result.segmentSuggestions).toHaveLength(2);
      expect(r.result.guestQuestions).toEqual(["Q1", "Q2"]);
      expect(r.result.titleOptions).toEqual(["T1", "T2"]);
      expect(r.result.showNotes).toEqual(["N1", "N2"]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      hook: "H", segmentSuggestions: [], guestQuestions: [],
      titleOptions: ["T1"], showNotes: [],
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("errors on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Could not parse");
  });
  it("errors on non-object JSON", () => {
    const r = renderLlmResult(JSON.stringify([1, 2, 3]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not a JSON object");
  });
  it("errors when no useful content", () => {
    const r = renderLlmResult(JSON.stringify({
      hook: "", segmentSuggestions: [], titleOptions: [],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no useful content");
  });
  it("filters non-string entries in arrays", () => {
    const raw = JSON.stringify({
      hook: "H",
      segmentSuggestions: [{ label: "L", talkingPoints: ["ok", 42, null] }],
      guestQuestions: ["ok", 42],
      titleOptions: ["ok", null, 99],
      showNotes: [42, "ok"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.guestQuestions).toEqual(["ok"]);
      expect(r.result.titleOptions).toEqual(["ok"]);
      expect(r.result.showNotes).toEqual(["ok"]);
      expect(r.result.segmentSuggestions[0].talkingPoints).toEqual(["ok"]);
    }
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = EpisodeFormat | HistoryEntry;
