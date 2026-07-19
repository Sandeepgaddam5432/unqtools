import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_BULLETS_PER_SLIDE,
  MAX_TITLE_LENGTH,
  DEFAULT_SLIDES_PER_MINUTE,
  AUDIENCE_LEVELS,
  AUDIENCE_LABELS,
  AUDIENCE_STYLES,
  PRESENTATION_TYPE_PRESETS,
  parseTopicOutline,
  calculateSlideCount,
  distributeSections,
  generateBullets,
  generateSpeakerNotes,
  generateVisualSuggestion,
  validateBulletCount,
  validateTitleLength,
  buildSlides,
  validatePresentation,
  computeStats,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudienceLevel,
  type PresentationInput,
  type TopicSection,
} from "./logic";

const SAMPLE_OUTLINE = `Introduction|What is X; Why it matters
Core Concepts|Definition; Key principles; Examples
Advanced Topics|Edge cases; Best practices
Conclusion|Summary; Next steps`;

function makeInput(partial: Partial<PresentationInput> = {}): PresentationInput {
  return {
    presentationTitle: "Test Talk",
    presenterName: "Jane Doe",
    audienceLevel: "college",
    presentationDuration: 30,
    topicOutline: SAMPLE_OUTLINE,
    includeTitleSlide: true,
    includeAgendaSlide: true,
    includeQASlide: true,
    includeSummarySlide: true,
    slidesPerMinute: DEFAULT_SLIDES_PER_MINUTE,
    ...partial,
  };
}

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

describe("presentation-slide-outliner constants", () => {
  it("has 6 audience levels", () => {
    expect(AUDIENCE_LEVELS).toHaveLength(6);
    expect(AUDIENCE_LEVELS).toContain("elementary");
    expect(AUDIENCE_LEVELS).toContain("expert");
  });
  it("has 6 audience labels", () => {
    expect(Object.keys(AUDIENCE_LABELS)).toHaveLength(6);
  });
  it("has 6 audience styles", () => {
    expect(Object.keys(AUDIENCE_STYLES)).toHaveLength(6);
  });
  it("has 4 presentation type presets", () => {
    expect(PRESENTATION_TYPE_PRESETS).toHaveLength(4);
    expect(PRESENTATION_TYPE_PRESETS.map((p) => p.type)).toEqual([
      "lecture", "training", "sales-pitch", "conference-talk",
    ]);
  });
  it("MAX_BULLETS_PER_SLIDE is 6", () => {
    expect(MAX_BULLETS_PER_SLIDE).toBe(6);
  });
  it("MAX_TITLE_LENGTH is 50", () => {
    expect(MAX_TITLE_LENGTH).toBe(50);
  });
  it("DEFAULT_SLIDES_PER_MINUTE is 0.5", () => {
    expect(DEFAULT_SLIDES_PER_MINUTE).toBe(0.5);
  });
});

describe("presentation-slide-outliner audience styles", () => {
  it("elementary has fewer bullets (4)", () => {
    expect(AUDIENCE_STYLES.elementary.maxBullets).toBe(4);
  });
  it("expert allows 6 bullets", () => {
    expect(AUDIENCE_STYLES.expert.maxBullets).toBe(6);
  });
  it("each style has a bullet tone, note tone, visual preference", () => {
    for (const lvl of AUDIENCE_LEVELS) {
      const s = AUDIENCE_STYLES[lvl];
      expect(s.bulletTone.length).toBeGreaterThan(0);
      expect(s.noteTone.length).toBeGreaterThan(0);
      expect(s.visualPreference.length).toBeGreaterThan(0);
      expect(s.maxBullets).toBeGreaterThan(0);
    }
  });
});

describe("presentation-slide-outliner parseTopicOutline", () => {
  it("parses pipe + semicolon format", () => {
    const sections = parseTopicOutline(SAMPLE_OUTLINE);
    expect(sections).toHaveLength(4);
    expect(sections[0].title).toBe("Introduction");
    expect(sections[0].keyPoints).toEqual(["What is X", "Why it matters"]);
  });
  it("handles section without key points (no pipe)", () => {
    const sections = parseTopicOutline("Intro section");
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Intro section");
    expect(sections[0].keyPoints).toEqual([]);
  });
  it("skips blank lines", () => {
    const sections = parseTopicOutline("A|x\n\nB|y");
    expect(sections).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseTopicOutline("")).toEqual([]);
  });
  it("trims whitespace in title and points", () => {
    const sections = parseTopicOutline("  Title  |  point A  ;  point B  ");
    expect(sections[0].title).toBe("Title");
    expect(sections[0].keyPoints).toEqual(["point A", "point B"]);
  });
});

describe("presentation-slide-outliner calculateSlideCount", () => {
  it("calculates 15 for 30 min × 0.5 spm", () => {
    expect(calculateSlideCount(30, 0.5)).toBe(15);
  });
  it("calculates 6 for 20 min × 0.3 spm (rounds)", () => {
    expect(calculateSlideCount(20, 0.3)).toBe(6);
  });
  it("returns 0 for invalid duration", () => {
    expect(calculateSlideCount(0, 0.5)).toBe(0);
    expect(calculateSlideCount(-5, 0.5)).toBe(0);
    expect(calculateSlideCount(NaN, 0.5)).toBe(0);
  });
  it("returns 0 for invalid slidesPerMinute", () => {
    expect(calculateSlideCount(30, 0)).toBe(0);
    expect(calculateSlideCount(30, -1)).toBe(0);
  });
  it("returns at least 1 for valid small input", () => {
    expect(calculateSlideCount(1, 0.5)).toBe(1);
  });
});

describe("presentation-slide-outliner distributeSections", () => {
  it("distributes when sections ≤ slides", () => {
    const sections: TopicSection[] = [{ title: "A", keyPoints: [] }, { title: "B", keyPoints: [] }];
    const dist = distributeSections(sections, 5);
    expect(dist).toHaveLength(5);
    expect(dist[0]).toEqual([sections[0]]);
    expect(dist[1]).toEqual([sections[1]]);
    expect(dist[2]).toEqual([]);
  });
  it("distributes when sections > slides", () => {
    const sections: TopicSection[] = Array.from({ length: 6 }, (_, i) => ({
      title: `S${i}`, keyPoints: [],
    }));
    const dist = distributeSections(sections, 3);
    expect(dist).toHaveLength(3);
    expect(dist.flat()).toHaveLength(6);
  });
  it("returns empty for 0 slides", () => {
    expect(distributeSections([], 0)).toEqual([]);
  });
  it("returns empty slides when no sections", () => {
    const dist = distributeSections([], 3);
    expect(dist).toHaveLength(3);
    expect(dist.every((d) => d.length === 0)).toBe(true);
  });
});

describe("presentation-slide-outliner generateBullets", () => {
  it("generates bullets from sections with key points", () => {
    const sections: TopicSection[] = [
      { title: "Topic A", keyPoints: ["point 1", "point 2"] },
    ];
    const bullets = generateBullets(sections, "college");
    expect(bullets).toEqual(["Topic A: point 1", "Topic A: point 2"]);
  });
  it("uses section title alone when no key points", () => {
    const sections: TopicSection[] = [{ title: "Topic A", keyPoints: [] }];
    const bullets = generateBullets(sections, "college");
    expect(bullets).toEqual(["Topic A"]);
  });
  it("respects audience max bullets (elementary = 4)", () => {
    const sections: TopicSection[] = Array.from({ length: 10 }, (_, i) => ({
      title: `T${i}`, keyPoints: [`p${i}`],
    }));
    const bullets = generateBullets(sections, "elementary");
    expect(bullets.length).toBeLessThanOrEqual(4);
  });
  it("respects audience max bullets (expert = 6)", () => {
    const sections: TopicSection[] = Array.from({ length: 10 }, (_, i) => ({
      title: `T${i}`, keyPoints: [`p${i}`],
    }));
    const bullets = generateBullets(sections, "expert");
    expect(bullets.length).toBeLessThanOrEqual(6);
  });
});

describe("presentation-slide-outliner generateSpeakerNotes", () => {
  it("generates notes for title slide", () => {
    const notes = generateSpeakerNotes("title", "", [], "college", "My Talk");
    expect(notes).toContain("My Talk");
  });
  it("generates notes for content slide with bullets", () => {
    const notes = generateSpeakerNotes("content", "Topic", ["b1", "b2"], "elementary", "Talk");
    expect(notes).toContain("b1");
    expect(notes).toContain("b2");
  });
  it("generates notes for agenda slide", () => {
    const notes = generateSpeakerNotes("agenda", "Agenda", ["Intro", "Body"], "college", "Talk");
    expect(notes).toContain("Intro");
  });
  it("generates notes for qa slide", () => {
    const notes = generateSpeakerNotes("qa", "Q&A", [], "college", "Talk");
    expect(notes).toContain("questions");
  });
});

describe("presentation-slide-outliner generateVisualSuggestion", () => {
  it("includes audience visual preference for content", () => {
    const v = generateVisualSuggestion("content", "elementary", "Topic");
    expect(v).toContain("colorful images");
  });
  it("includes title in content visual", () => {
    const v = generateVisualSuggestion("content", "college", "My Topic");
    expect(v).toContain("My Topic");
  });
  it("generates qa visual", () => {
    const v = generateVisualSuggestion("qa", "college", "");
    expect(v).toContain("Questions");
  });
});

describe("presentation-slide-outliner validateBulletCount + validateTitleLength", () => {
  it("validateBulletCount returns true when ≤ 6", () => {
    expect(validateBulletCount(["a", "b", "c"])).toBe(true);
  });
  it("validateBulletCount returns false when > 6", () => {
    expect(validateBulletCount(["a", "b", "c", "d", "e", "f", "g"])).toBe(false);
  });
  it("validateTitleLength returns true for short titles", () => {
    expect(validateTitleLength("Short title")).toBe(true);
  });
  it("validateTitleLength returns false for long titles", () => {
    expect(validateTitleLength("x".repeat(51))).toBe(false);
  });
  it("validateTitleLength accepts 50 chars exactly", () => {
    expect(validateTitleLength("x".repeat(50))).toBe(true);
  });
});

describe("presentation-slide-outliner buildSlides", () => {
  it("builds slides with all 5 kinds", () => {
    const slides = buildSlides(makeInput());
    const kinds = new Set(slides.map((s) => s.kind));
    expect(kinds.has("title")).toBe(true);
    expect(kinds.has("agenda")).toBe(true);
    expect(kinds.has("content")).toBe(true);
    expect(kinds.has("summary")).toBe(true);
    expect(kinds.has("qa")).toBe(true);
  });
  it("indexes slides 1-based and consecutively", () => {
    const slides = buildSlides(makeInput());
    expect(slides[0].index).toBe(1);
    for (let i = 0; i < slides.length; i++) {
      expect(slides[i].index).toBe(i + 1);
    }
  });
  it("respects includeTitleSlide=false", () => {
    const slides = buildSlides(makeInput({ includeTitleSlide: false }));
    expect(slides.find((s) => s.kind === "title")).toBeUndefined();
  });
  it("respects includeAgendaSlide=false", () => {
    const slides = buildSlides(makeInput({ includeAgendaSlide: false }));
    expect(slides.find((s) => s.kind === "agenda")).toBeUndefined();
  });
  it("respects includeQASlide=false", () => {
    const slides = buildSlides(makeInput({ includeQASlide: false }));
    expect(slides.find((s) => s.kind === "qa")).toBeUndefined();
  });
  it("respects includeSummarySlide=false", () => {
    const slides = buildSlides(makeInput({ includeSummarySlide: false }));
    expect(slides.find((s) => s.kind === "summary")).toBeUndefined();
  });
  it("calculates content slides from duration × spm", () => {
    const slides = buildSlides(makeInput({ presentationDuration: 20, slidesPerMinute: 0.5 }));
    expect(slides.filter((s) => s.kind === "content")).toHaveLength(10);
  });
  it("allocates time per slide (total/slides)", () => {
    const slides = buildSlides(makeInput({ presentationDuration: 30 }));
    const expectedPerSlide = 30 / slides.length;
    expect(Math.abs(slides[0].timeMinutes - expectedPerSlide)).toBeLessThan(0.01);
  });
  it("returns empty for empty input", () => {
    const slides = buildSlides({
      presentationTitle: "",
      presenterName: "",
      audienceLevel: "college",
      presentationDuration: 0,
      topicOutline: "",
      includeTitleSlide: false,
      includeAgendaSlide: false,
      includeQASlide: false,
      includeSummarySlide: false,
      slidesPerMinute: 0.5,
    });
    expect(slides).toEqual([]);
  });
  it("content slides have section title from outline", () => {
    const slides = buildSlides(makeInput({ presentationDuration: 4, slidesPerMinute: 1 }));
    const contentSlides = slides.filter((s) => s.kind === "content");
    expect(contentSlides.length).toBeGreaterThan(0);
    expect(contentSlides[0].section).toBeTruthy();
  });
});

describe("presentation-slide-outliner validatePresentation", () => {
  it("returns no issues for a valid presentation", () => {
    const slides = buildSlides(makeInput());
    const issues = validatePresentation(slides);
    expect(issues).toHaveLength(0);
  });
  it("flags title too long", () => {
    const slides = buildSlides({
      ...makeInput(),
      presentationTitle: "x".repeat(60),
    });
    const issues = validatePresentation(slides);
    expect(issues.some((i) => i.reason === "title-too-long")).toBe(true);
  });
});

describe("presentation-slide-outliner computeStats", () => {
  it("computes stats for the sample", () => {
    const slides = buildSlides(makeInput());
    const stats = computeStats(slides, 30);
    expect(stats.totalSlides).toBe(slides.length);
    expect(stats.byKind.title).toBe(1);
    expect(stats.byKind.agenda).toBe(1);
    expect(stats.byKind.qa).toBe(1);
    expect(stats.byKind.summary).toBe(1);
    expect(stats.byKind.content).toBeGreaterThan(0);
    expect(stats.totalTimeMinutes).toBe(30);
    expect(stats.avgTimePerSlide).toBeCloseTo(30 / slides.length, 2);
  });
  it("counts unique sections", () => {
    const slides = buildSlides(makeInput({ presentationDuration: 10, slidesPerMinute: 1 }));
    const stats = computeStats(slides, 10);
    // SAMPLE_OUTLINE has 4 sections, but content slides = 10, so sections dedupe to 4
    expect(stats.totalSections).toBe(4);
  });
  it("returns zero for empty slides", () => {
    const stats = computeStats([], 0);
    expect(stats.totalSlides).toBe(0);
    expect(stats.avgTimePerSlide).toBe(0);
  });
});

describe("presentation-slide-outliner renderText", () => {
  it("renders text outline", () => {
    const input = makeInput();
    const slides = buildSlides(input);
    const text = renderText(slides, input);
    expect(text).toContain("Presentation: Test Talk");
    expect(text).toContain("Presenter: Jane Doe");
    expect(text).toContain("Audience: College / University");
    expect(text).toContain("--- Slide 1:");
  });
  it("returns empty for empty slides", () => {
    expect(renderText([], makeInput())).toBe("");
  });
});

describe("presentation-slide-outliner renderHtml", () => {
  it("renders HTML with slides", () => {
    const input = makeInput();
    const slides = buildSlides(input);
    const html = renderHtml(slides, input);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<section class=\"slide\">");
    expect(html).toContain("Test Talk");
    expect(html).toContain("Speaker notes");
  });
  it("renders empty state", () => {
    expect(renderHtml([], makeInput())).toContain("No slides.");
  });
});

describe("presentation-slide-outliner renderMarkdown", () => {
  it("renders Marp-compatible markdown", () => {
    const input = makeInput();
    const slides = buildSlides(input);
    const md = renderMarkdown(slides, input);
    expect(md).toContain("marp: true");
    expect(md).toContain("title: Test Talk");
    expect(md).toContain("# ");
    expect(md).toContain("<!-- ");
  });
  it("returns empty for empty slides", () => {
    expect(renderMarkdown([], makeInput())).toBe("");
  });
});

describe("presentation-slide-outliner renderCsv", () => {
  it("renders CSV header + rows", () => {
    const input = makeInput();
    const slides = buildSlides(input);
    const csv = renderCsv(slides);
    expect(csv).toContain("slide_num,kind,title,bullets,speaker_notes,visual,time_minutes");
    expect(csv).toContain("1,title");
  });
});

describe("presentation-slide-outliner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      presentationTitle: "Talk",
      audienceLevel: "college",
      slideCount: 15,
      durationMinutes: 30,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        presentationTitle: `Talk ${i}`,
        audienceLevel: "college",
        slideCount: i,
        durationMinutes: 30,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      presentationTitle: "Talk",
      audienceLevel: "college",
      slideCount: 15,
      durationMinutes: 30,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("presentation-slide-outliner shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeInput());
    expect(url).toContain("title=Test+Talk");
    expect(url).toContain("presenter=Jane+Doe");
    expect(url).toContain("audience=college");
    expect(url).toContain("duration=30");
    expect(url).toContain("spm=0.5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input = makeInput();
    const url = buildShareUrl(input);
    const hash = url.substring(url.indexOf("#") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.presentationTitle).toBe("Test Talk");
    expect(parsed.presenterName).toBe("Jane Doe");
    expect(parsed.audienceLevel).toBe("college");
    expect(parsed.presentationDuration).toBe(30);
    expect(parsed.topicOutline).toBe(SAMPLE_OUTLINE);
    expect(parsed.includeTitleSlide).toBe(true);
    expect(parsed.slidesPerMinute).toBe(0.5);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid audience level", () => {
    const parsed = parseShareUrl("audience=invalid-level");
    expect(parsed.audienceLevel).toBeUndefined();
  });
  it("handles false boolean params", () => {
    const parsed = parseShareUrl("title_slide=false&qa_slide=false");
    expect(parsed.includeTitleSlide).toBe(false);
    expect(parsed.includeQASlide).toBe(false);
  });
});

describe("presentation-slide-outliner presentation type presets", () => {
  it("each preset has a label and description", () => {
    for (const p of PRESENTATION_TYPE_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
  it("lecture preset defaults to college audience", () => {
    const lecture = PRESENTATION_TYPE_PRESETS.find((p) => p.type === "lecture");
    expect(lecture?.defaults.audienceLevel).toBe("college");
  });
  it("sales-pitch preset skips agenda slide", () => {
    const sales = PRESENTATION_TYPE_PRESETS.find((p) => p.type === "sales-pitch");
    expect(sales?.defaults.includeAgendaSlide).toBe(false);
  });
  it("conference-talk preset uses expert audience", () => {
    const conf = PRESENTATION_TYPE_PRESETS.find((p) => p.type === "conference-talk");
    expect(conf?.defaults.audienceLevel).toBe("expert");
  });
  it("training preset has slower pace (lower spm)", () => {
    const training = PRESENTATION_TYPE_PRESETS.find((p) => p.type === "training");
    expect(training?.defaults.slidesPerMinute).toBeLessThan(0.5);
  });
});

describe("presentation-slide-outliner extra features integration", () => {
  it("end-to-end: build → stats → render text", () => {
    const input = makeInput({ presentationDuration: 20, slidesPerMinute: 0.5 });
    const slides = buildSlides(input);
    const stats = computeStats(slides, 20);
    expect(stats.totalContentSlides).toBe(10);
    // 1 title + 1 agenda + 10 content + 1 summary + 1 qa = 14 total slides
    expect(stats.totalSlides).toBe(14);
    const text = renderText(slides, input);
    expect(text).toContain("Slide 1");
    expect(text).toContain("Slide 14");
  });
  it("end-to-end: college vs elementary differ in speaker notes", () => {
    const collegeNotes = generateSpeakerNotes("content", "T", ["b"], "college", "Talk");
    const elemNotes = generateSpeakerNotes("content", "T", ["b"], "elementary", "Talk");
    expect(collegeNotes).not.toEqual(elemNotes);
  });
});

// Suppress unused-import lint
export type _Unused = AudienceLevel;
