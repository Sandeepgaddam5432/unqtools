import { describe, it, expect, beforeEach } from "vitest";
import {
  GENRE_LABELS,
  TONE_LABELS,
  POV_LABELS,
  LENGTH_LABELS,
  LENGTH_TARGETS,
  PLOT_STAGES,
  STAGE_LABELS,
  SAMPLE_PREMISES,
  GENRE_TEMPLATES,
  normalizePremise,
  normalizeSetting,
  parseCharacters,
  renderCharacters,
  extractKeywords,
  detectGenre,
  pickNoun,
  pickAdjective,
  titleCase,
  generateTitle,
  getProtagonistName,
  getSecondaryName,
  fillTemplate,
  pick,
  applyTone,
  applyPov,
  splitSentences,
  countWords,
  estimateStageWords,
  generateStageParagraph,
  generateSection,
  generateStory,
  generateStoryBible,
  continueStory,
  regenerateSection,
  expandSection,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  renderBibleMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  resetIdCounter,
  type Genre,
  type Tone,
  type POV,
  type Length,
  type PlotStage,
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

describe("ai-fiction-story constants", () => {
  it("has 5 genre labels", () => {
    expect(Object.keys(GENRE_LABELS)).toHaveLength(5);
    expect(GENRE_LABELS.fantasy).toBe("Fantasy");
    expect(GENRE_LABELS["sci-fi"]).toBe("Science Fiction");
  });
  it("has 5 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 4 POV labels", () => {
    expect(Object.keys(POV_LABELS)).toHaveLength(4);
  });
  it("has 4 length labels", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(4);
  });
  it("has length targets in ascending order", () => {
    expect(LENGTH_TARGETS.flash).toBeLessThan(LENGTH_TARGETS.short);
    expect(LENGTH_TARGETS.short).toBeLessThan(LENGTH_TARGETS.novelette);
    expect(LENGTH_TARGETS.novelette).toBeLessThan(LENGTH_TARGETS.novella);
  });
  it("has 6 plot stages", () => {
    expect(PLOT_STAGES).toHaveLength(6);
    const stages = PLOT_STAGES.map((p) => p.stage);
    expect(stages).toEqual(["setup", "inciting", "rising", "climax", "falling", "resolution"]);
  });
  it("plot stage weights sum to 1.0", () => {
    const sum = PLOT_STAGES.reduce((a, b) => a + b.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
  it("has 6 stage labels", () => {
    expect(Object.keys(STAGE_LABELS)).toHaveLength(6);
  });
  it("has sample premises for each genre", () => {
    for (const g of Object.keys(SAMPLE_PREMISES) as Genre[]) {
      expect(SAMPLE_PREMISES[g].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("genre templates have all stages for each genre", () => {
    for (const g of Object.keys(GENRE_TEMPLATES) as Genre[]) {
      const t = GENRE_TEMPLATES[g];
      expect(t.setupOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.incitingOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.risingOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.climaxOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.fallingOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.resolutionOpeners.length).toBeGreaterThanOrEqual(1);
      expect(t.settings.length).toBeGreaterThanOrEqual(1);
      expect(t.themes.length).toBeGreaterThanOrEqual(1);
      expect(t.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(t.titleHints.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("ai-fiction-story normalizePremise", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizePremise("  A dragon   wakes   in   the well.  ")).toBe("A dragon wakes in the well.");
  });
  it("handles empty", () => {
    expect(normalizePremise("")).toBe("");
  });
});

describe("ai-fiction-story normalizeSetting", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSetting("  the kingdom   of   Aerith  ")).toBe("the kingdom of Aerith");
  });
});

describe("ai-fiction-story parseCharacters", () => {
  it("parses 'Name | role | description' format", () => {
    const chars = parseCharacters("Eira | protagonist | a hedge-witch\nBran | ally | a disgraced knight");
    expect(chars).toHaveLength(2);
    expect(chars[0]).toEqual({ name: "Eira", role: "protagonist", description: "a hedge-witch" });
    expect(chars[1]).toEqual({ name: "Bran", role: "ally", description: "a disgraced knight" });
  });
  it("defaults role to protagonist for first entry", () => {
    const chars = parseCharacters("Eira");
    expect(chars[0]?.role).toBe("protagonist");
  });
  it("defaults role to supporting for subsequent entries", () => {
    const chars = parseCharacters("Eira\nBran");
    expect(chars[1]?.role).toBe("supporting");
  });
  it("handles empty input", () => {
    expect(parseCharacters("")).toEqual([]);
  });
  it("handles name only with no description", () => {
    const chars = parseCharacters("Eira | protagonist");
    expect(chars[0]).toEqual({ name: "Eira", role: "protagonist", description: "" });
  });
});

describe("ai-fiction-story renderCharacters", () => {
  it("renders back to 'Name | role | description'", () => {
    const chars = parseCharacters("Eira | protagonist | a hedge-witch");
    expect(renderCharacters(chars)).toContain("Eira | protagonist | a hedge-witch");
  });
  it("round-trips through parse then render", () => {
    const input = "Eira | protagonist | a hedge-witch\nBran | ally | a knight";
    expect(renderCharacters(parseCharacters(input))).toBe(input);
  });
});

describe("ai-fiction-story extractKeywords", () => {
  it("extracts keywords and filters stop words", () => {
    const kw = extractKeywords("A dragon wakes in the well of the kingdom");
    expect(kw).toContain("dragon");
    expect(kw).toContain("wakes");
    expect(kw).toContain("well");
    expect(kw).toContain("kingdom");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("of");
    expect(kw).not.toContain("a");
    expect(kw).not.toContain("in");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("dedupes", () => {
    expect(extractKeywords("dragon dragon dragon")).toEqual(["dragon"]);
  });
});

describe("ai-fiction-story detectGenre", () => {
  it("detects fantasy from 'dragon'", () => {
    expect(detectGenre("A dragon wakes in an ancient well.")).toBe("fantasy");
  });
  it("detects sci-fi from 'space station'", () => {
    expect(detectGenre("A maintenance drone on a space station wakes alone.")).toBe("sci-fi");
  });
  it("detects mystery from 'detective murder'", () => {
    expect(detectGenre("A detective investigates a locked-room murder.")).toBe("mystery");
  });
  it("detects romance from 'love'", () => {
    expect(detectGenre("Two rivals fall in love over a charity bake-off.")).toBe("romance");
  });
  it("detects horror from 'haunted'", () => {
    expect(detectGenre("A family moves into a haunted house with strange mirrors.")).toBe("horror");
  });
  it("defaults to fantasy for empty / unknown", () => {
    expect(detectGenre("")).toBe("fantasy");
    expect(detectGenre("pancakes")).toBe("fantasy");
  });
});

describe("ai-fiction-story pickNoun / pickAdjective", () => {
  it("pickNoun returns the longest keyword", () => {
    expect(pickNoun("dragon kingdom well")).toBe("kingdom");
  });
  it("pickNoun returns 'Story' for empty input", () => {
    expect(pickNoun("")).toBe("Story");
  });
  it("pickAdjective returns a word with adjective suffix when present", () => {
    const adj = pickAdjective("ancient mysterious dragon");
    expect(["ancient", "mysterious"]).toContain(adj);
  });
  it("pickAdjective falls back to first keyword", () => {
    expect(pickAdjective("dragon")).toBe("dragon");
  });
});

describe("ai-fiction-story titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("the last dragon")).toBe("The Last Dragon");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-fiction-story generateTitle", () => {
  it("produces a non-empty title for each genre", () => {
    for (const g of Object.keys(GENRE_LABELS) as Genre[]) {
      const title = generateTitle("A dragon wakes in the well", "Aerith", g);
      expect(title.length).toBeGreaterThan(0);
    }
  });
  it("substitutes placeholders", () => {
    const title = generateTitle("A dragon wakes", "Aerith", "fantasy");
    // Should not contain raw placeholders
    expect(title).not.toContain("{");
    expect(title).not.toContain("}");
  });
});

describe("ai-fiction-story character name helpers", () => {
  it("getProtagonistName returns the protagonist", () => {
    const chars = parseCharacters("Eira | protagonist | witch\nBran | ally | knight");
    expect(getProtagonistName(chars)).toBe("Eira");
  });
  it("getProtagonistName falls back to first character", () => {
    const chars = parseCharacters("Eira | supporting | witch");
    expect(getProtagonistName(chars)).toBe("Eira");
  });
  it("getProtagonistName returns 'the protagonist' for empty", () => {
    expect(getProtagonistName([])).toBe("the protagonist");
  });
  it("getSecondaryName prefers love interest for romance", () => {
    const chars = parseCharacters("Eira | protagonist\nBran | love interest");
    expect(getSecondaryName(chars, "romance")).toBe("Bran");
  });
  it("getSecondaryName prefers antagonist for non-romance", () => {
    const chars = parseCharacters("Eira | protagonist\nVex | antagonist");
    expect(getSecondaryName(chars, "fantasy")).toBe("Vex");
  });
  it("getSecondaryName falls back to second character", () => {
    const chars = parseCharacters("Eira\nBran");
    expect(getSecondaryName(chars, "fantasy")).toBe("Bran");
  });
  it("getSecondaryName falls back to 'the stranger' for empty", () => {
    expect(getSecondaryName([], "fantasy")).toBe("the stranger");
  });
});

describe("ai-fiction-story fillTemplate", () => {
  it("replaces all placeholders", () => {
    const out = fillTemplate(
      "{protagonist} met {love_interest} at {setting}.",
      { protagonist: "Eira", loveInterest: "Bran", setting: "Aerith" },
    );
    expect(out).toBe("Eira met Bran at Aerith.");
  });
});

describe("ai-fiction-story pick", () => {
  it("returns an element from the array", () => {
    const arr = [1, 2, 3];
    const v = pick(arr);
    expect(arr).toContain(v);
  });
  it("is deterministic with a seed", () => {
    expect(pick([1, 2, 3], 0)).toBe(1);
    expect(pick([1, 2, 3], 1)).toBe(2);
    expect(pick([1, 2, 3], 2)).toBe(3);
  });
  it("throws on empty array", () => {
    expect(() => pick([])).toThrow();
  });
});

describe("ai-fiction-story applyTone", () => {
  it("returns the text unchanged for neutral tone", () => {
    expect(applyTone("Hello world.", "neutral")).toBe("Hello world.");
  });
  it("eventually adds a comedic aside (try multiple times)", () => {
    let added = false;
    for (let i = 0; i < 50; i++) {
      if (applyTone("Hello world.", "comedic").length > "Hello world.".length) {
        added = true;
        break;
      }
    }
    expect(added).toBe(true);
  });
  it("eventually adds a dark suffix", () => {
    let added = false;
    for (let i = 0; i < 50; i++) {
      if (applyTone("Hello world.", "dark").length > "Hello world.".length) {
        added = true;
        break;
      }
    }
    expect(added).toBe(true);
  });
});

describe("ai-fiction-story applyPov", () => {
  it("rewrites protagonist to 'I' for first person", () => {
    const out = applyPov("Eira walked to the well. They were afraid.", "first", "Eira");
    expect(out).toContain("I walked");
    expect(out).toContain("I was afraid");
  });
  it("rewrites protagonist to 'you' for second person", () => {
    const out = applyPov("Eira walked to the well.", "second", "Eira");
    expect(out).toContain("you walked");
  });
  it("leaves text unchanged for third-limited", () => {
    const text = "Eira walked to the well.";
    expect(applyPov(text, "third-limited", "Eira")).toBe(text);
  });
  it("leaves text unchanged for third-omniscient", () => {
    const text = "Eira walked to the well.";
    expect(applyPov(text, "third-omniscient", "Eira")).toBe(text);
  });
});

describe("ai-fiction-story sentence/word helpers", () => {
  it("splitSentences splits on terminators", () => {
    const s = splitSentences("Hello. World. Test.");
    expect(s.length).toBeGreaterThanOrEqual(3);
  });
  it("splitSentences returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("countWords counts words", () => {
    expect(countWords("hello world foo bar")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("ai-fiction-story estimateStageWords", () => {
  it("scales weight by total words", () => {
    expect(estimateStageWords(0.2, 1000)).toBe(200);
  });
  it("enforces a minimum of 30", () => {
    expect(estimateStageWords(0.001, 100)).toBe(30);
  });
});

describe("ai-fiction-story generateStageParagraph", () => {
  it("returns a non-empty paragraph with substituted placeholders", () => {
    const para = generateStageParagraph(
      "setup",
      "fantasy",
      { protagonist: "Eira", loveInterest: "Bran", setting: "Aerith" },
      "neutral",
      "third-limited",
    );
    expect(para.length).toBeGreaterThan(20);
    expect(para).not.toContain("{");
    expect(para).not.toContain("}");
    // The protagonist name or setting should appear in the setup
    expect(para.includes("Eira") || para.includes("Aerith")).toBe(true);
  });
  it("works for every genre and stage", () => {
    const stages: PlotStage[] = ["setup", "inciting", "rising", "climax", "falling", "resolution"];
    for (const g of Object.keys(GENRE_LABELS) as Genre[]) {
      for (const s of stages) {
        const para = generateStageParagraph(s, g, { protagonist: "X", loveInterest: "Y", setting: "Z" }, "neutral", "third-limited");
        expect(para.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("ai-fiction-story generateSection", () => {
  it("produces a section with at least one paragraph", () => {
    const sec = generateSection("setup", "fantasy", { protagonist: "Eira", loveInterest: "Bran", setting: "Aerith" }, "neutral", "third-limited", "short");
    expect(sec.stage).toBe("setup");
    expect(sec.heading).toBe("Setup");
    expect(sec.paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(sec.wordEstimate).toBeGreaterThan(0);
    expect(sec.id).toBeTruthy();
  });
  it("longer length produces more paragraphs (novella > flash)", () => {
    const flash = generateSection("rising", "fantasy", { protagonist: "Eira", loveInterest: "Bran", setting: "Aerith" }, "neutral", "third-limited", "flash");
    const novella = generateSection("rising", "fantasy", { protagonist: "Eira", loveInterest: "Bran", setting: "Aerith" }, "neutral", "third-limited", "novella");
    expect(novella.paragraphs.length).toBeGreaterThanOrEqual(flash.paragraphs.length);
  });
});

describe("ai-fiction-story generateStory", () => {
  it("generates a complete story with 6 sections", () => {
    const story = generateStory("A dragon wakes in the well.", "fantasy", {
      characters: parseCharacters("Eira | protagonist | a hedge-witch"),
    });
    expect(story.title.length).toBeGreaterThan(0);
    expect(story.genre).toBe("fantasy");
    expect(story.tone).toBe("neutral");
    expect(story.pov).toBe("third-limited");
    expect(story.length).toBe("short");
    expect(story.sections).toHaveLength(6);
    expect(story.wordCount).toBeGreaterThan(0);
    expect(story.characters).toHaveLength(1);
  });
  it("sections follow canonical plot arc order", () => {
    const story = generateStory("X", "fantasy");
    const stages = story.sections.map((s) => s.stage);
    expect(stages).toEqual(["setup", "inciting", "rising", "climax", "falling", "resolution"]);
  });
  it("every paragraph has no unfilled placeholders", () => {
    const story = generateStory("A dragon wakes", "fantasy", {
      characters: parseCharacters("Eira | protagonist"),
    });
    for (const s of story.sections) {
      for (const p of s.paragraphs) {
        expect(p).not.toContain("{");
        expect(p).not.toContain("}");
      }
    }
  });
  it("uses provided setting when given", () => {
    const story = generateStory("X", "fantasy", { setting: "My Custom Realm" });
    expect(story.setting).toBe("My Custom Realm");
  });
  it("auto-picks a setting when none provided", () => {
    const story = generateStory("X", "fantasy");
    expect(story.setting.length).toBeGreaterThan(0);
  });
  it("respects tone, pov, length options", () => {
    const story = generateStory("X", "mystery", { tone: "dark", pov: "first", length: "novelette" });
    expect(story.tone).toBe("dark");
    expect(story.pov).toBe("first");
    expect(story.length).toBe("novelette");
  });
  it("first-person POV rewrites protagonist to 'I'", () => {
    const story = generateStory("A dragon wakes", "fantasy", {
      characters: parseCharacters("Eira | protagonist"),
      pov: "first",
    });
    // At least one paragraph across the story should mention "I"
    const allText = story.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(allText).toContain("I");
    expect(allText).not.toContain("Eira");
  });
  it("longer length yields more total words than shorter", () => {
    const flash = generateStory("X", "fantasy", { length: "flash" });
    const novella = generateStory("X", "fantasy", { length: "novella" });
    expect(novella.wordCount).toBeGreaterThan(flash.wordCount);
  });
  it("handles empty premise gracefully", () => {
    const story = generateStory("", "fantasy");
    expect(story.premise).toBe("");
    expect(story.sections).toHaveLength(6);
  });
  it("uses provided title", () => {
    const story = generateStory("X", "fantasy", { title: "My Custom Title" });
    expect(story.title).toBe("My Custom Title");
  });
});

describe("ai-fiction-story generateStoryBible", () => {
  it("produces a bible with characters, setting, themes, conflicts, plot points", () => {
    const story = generateStory("A dragon wakes", "fantasy", {
      characters: parseCharacters("Eira | protagonist"),
    });
    const bible = generateStoryBible(story);
    expect(bible.characters).toHaveLength(1);
    expect(bible.setting).toBeTruthy();
    expect(bible.themes.length).toBeGreaterThan(0);
    expect(bible.conflicts.length).toBeGreaterThan(0);
    expect(bible.plotPoints.length).toBe(6);
  });
});

describe("ai-fiction-story continueStory / expandSection / regenerateSection", () => {
  it("continueStory adds a paragraph to the targeted section", () => {
    const story = generateStory("X", "fantasy");
    const first = story.sections[0]!;
    const continued = continueStory(story, first.id);
    const after = continued.sections[0]!;
    expect(after.paragraphs.length).toBe(first.paragraphs.length + 1);
  });
  it("expandSection is an alias for continueStory", () => {
    const story = generateStory("X", "fantasy");
    const first = story.sections[0]!;
    const expanded = expandSection(story, first.id);
    expect(expanded.sections[0]!.paragraphs.length).toBe(first.paragraphs.length + 1);
  });
  it("continueStory returns unchanged for unknown id", () => {
    const story = generateStory("X", "fantasy");
    const same = continueStory(story, "unknown-id");
    expect(same).toBe(story);
  });
  it("continueStory updates wordCount", () => {
    const story = generateStory("X", "fantasy");
    const first = story.sections[0]!;
    const continued = continueStory(story, first.id);
    expect(continued.wordCount).toBeGreaterThan(story.wordCount);
  });
  it("regenerateSection preserves the section id", () => {
    const story = generateStory("X", "fantasy");
    const first = story.sections[0]!;
    const regen = regenerateSection(story, first.id);
    expect(regen.sections[0]!.id).toBe(first.id);
    expect(regen.sections[0]!.stage).toBe(first.stage);
  });
  it("regenerateSection returns unchanged for unknown id", () => {
    const story = generateStory("X", "fantasy");
    expect(regenerateSection(story, "unknown-id")).toBe(story);
  });
});

describe("ai-fiction-story computeStats", () => {
  it("computes correct stats", () => {
    const story = generateStory("X", "fantasy", {
      characters: parseCharacters("Eira | protagonist\nBran | ally"),
    });
    const stats = computeStats(story);
    expect(stats.totalSections).toBe(6);
    expect(stats.totalParagraphs).toBeGreaterThan(0);
    expect(stats.totalWords).toBe(story.wordCount);
    expect(stats.totalCharacters).toBe(2);
    expect(stats.byStage.setup).toBeGreaterThan(0);
    expect(stats.genreLabel).toBe("Fantasy");
    expect(stats.toneLabel).toBe("Neutral");
    expect(stats.povLabel).toContain("Third");
  });
});

describe("ai-fiction-story render functions", () => {
  it("renderText contains title and stage headings", () => {
    const story = generateStory("A dragon wakes", "fantasy");
    const txt = renderText(story);
    expect(txt).toContain(story.title);
    expect(txt).toContain("## Setup");
    expect(txt).toContain("## Resolution");
    expect(txt).toContain("Word count:");
  });
  it("renderMarkdown contains title as H1 and stages as H2", () => {
    const story = generateStory("X", "mystery");
    const md = renderMarkdown(story);
    expect(md).toContain(`# ${story.title}`);
    expect(md).toContain("## Setup");
    expect(md).toContain("## Climax");
  });
  it("renderJson produces valid JSON", () => {
    const story = generateStory("X", "fantasy");
    const json = renderJson(story);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe(story.title);
    expect(parsed.genre).toBe("fantasy");
    expect(Array.isArray(parsed.sections)).toBe(true);
  });
  it("renderBibleMarkdown contains the story-bible sections", () => {
    const story = generateStory("X", "fantasy", { characters: parseCharacters("Eira | protagonist") });
    const bible = generateStoryBible(story);
    const md = renderBibleMarkdown(bible);
    expect(md).toContain("# Story Bible");
    expect(md).toContain("## Setting");
    expect(md).toContain("## Characters");
    expect(md).toContain("## Themes");
    expect(md).toContain("## Conflicts");
    expect(md).toContain("## Plot Points");
    expect(md).toContain("Eira");
  });
});

describe("ai-fiction-story history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, title: "T", premise: "P", genre: "fantasy",
      tone: "neutral", pov: "third-limited", length: "short",
      wordCount: 100, sectionCount: 6,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, title: "T", premise: "P", genre: "fantasy",
        tone: "neutral", pov: "third-limited", length: "short",
        wordCount: 100, sectionCount: 6,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "T", premise: "P", genre: "fantasy",
      tone: "neutral", pov: "third-limited", length: "short",
      wordCount: 100, sectionCount: 6,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-fiction-story shareable URL", () => {
  it("builds share URL with defaults when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      premise: "A dragon wakes",
      genre: "fantasy",
      tone: "neutral",
      pov: "third-limited",
      length: "short",
      setting: "",
      charactersText: "",
    });
    expect(url).toContain("premise=A+dragon+wakes");
    expect(url).toContain("genre=fantasy");
    // Defaults should be omitted
    expect(url).not.toContain("tone=");
    expect(url).not.toContain("pov=");
    expect(url).not.toContain("length=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with all options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      premise: "X",
      genre: "sci-fi",
      tone: "dark",
      pov: "first",
      length: "novella",
      setting: "Theta-7",
      charactersText: "Eira | protagonist",
    });
    expect(url).toContain("genre=sci-fi");
    expect(url).toContain("tone=dark");
    expect(url).toContain("pov=first");
    expect(url).toContain("length=novella");
    expect(url).toContain("setting=Theta-7");
    expect(url).toContain("chars=Eira");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("premise=A+dragon+wakes&genre=mystery&tone=dark&pov=first&length=novelette&setting=Greer+Lane&chars=Eira+%7C+protagonist");
    expect(s.premise).toBe("A dragon wakes");
    expect(s.genre).toBe("mystery");
    expect(s.tone).toBe("dark");
    expect(s.pov).toBe("first");
    expect(s.length).toBe("novelette");
    expect(s.setting).toBe("Greer Lane");
    expect(s.charactersText).toContain("Eira");
  });
  it("handles empty hash with defaults", () => {
    expect(parseShareUrl("")).toEqual({
      premise: "",
      genre: "fantasy",
      tone: "neutral",
      pov: "third-limited",
      length: "short",
      setting: "",
      charactersText: "",
    });
  });
  it("filters unknown values to defaults", () => {
    const s = parseShareUrl("premise=hi&genre=bogus&tone=bad&pov=evil&length=wrong");
    expect(s.genre).toBe("fantasy");
    expect(s.tone).toBe("neutral");
    expect(s.pov).toBe("third-limited");
    expect(s.length).toBe("short");
  });
});

describe("ai-fiction-story LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const story = generateStory("A dragon wakes", "fantasy", {
      characters: parseCharacters("Eira | protagonist"),
    });
    const bible = generateStoryBible(story);
    const p = buildLlmPrompt("A dragon wakes", "fantasy", "dark", "first", "novella", bible);
    expect(p.system).toContain("fiction writer");
    expect(p.system).toContain("Fantasy");
    expect(p.system).toContain("Dark");
    expect(p.system).toContain("First person");
    expect(p.system).toContain("3000");
    expect(p.user).toContain("A dragon wakes");
    expect(p.user).toContain("Story bible:");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// Suppress unused-import lint
export type _Unused = Genre | Tone | POV | Length | PlotStage;
