import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FORM_LABELS,
  RHYME_SCHEME_LABELS,
  MOOD_LABELS,
  MOOD_TONE_WORDS,
  THEME_PRESETS,
  RHYME_DICTIONARY,
  rhymeDictionarySize,
  normalizeTheme,
  extractThemeKeywords,
  countSyllables,
  countLineSyllables,
  getRhymeEnding,
  findRhymes,
  pickRhymePartner,
  buildLine,
  expandScheme,
  pickRhymeWordsForLabels,
  validateRhymeScheme,
  generateHaiku,
  generateSonnet,
  generateFreeVerse,
  generateLimerick,
  generateAcrostic,
  generateSongLyrics,
  validateForm,
  validatePoemInput,
  generatePoem,
  buildTitle,
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
  type PoemForm,
  type RhymeScheme,
  type Mood,
  type Poem,
  type SongLyrics,
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

describe("ai-poem-lyrics constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-poem-lyrics:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 6 poem forms", () => {
    expect(Object.keys(FORM_LABELS)).toHaveLength(6);
  });
  it("has 4 rhyme schemes", () => {
    expect(Object.keys(RHYME_SCHEME_LABELS)).toHaveLength(4);
  });
  it("has 6 moods", () => {
    expect(Object.keys(MOOD_LABELS)).toHaveLength(6);
  });
  it("has tone words for every mood", () => {
    for (const m of Object.keys(MOOD_TONE_WORDS) as Mood[]) {
      expect(MOOD_TONE_WORDS[m].length).toBeGreaterThanOrEqual(5);
    }
  });
  it("has theme presets", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("rhyme dictionary has 200+ words", () => {
    expect(rhymeDictionarySize()).toBeGreaterThanOrEqual(200);
  });
  it("rhyme dictionary has multiple endings", () => {
    expect(Object.keys(RHYME_DICTIONARY).length).toBeGreaterThanOrEqual(10);
  });
});

describe("ai-poem-lyrics normalizeTheme", () => {
  it("collapses whitespace", () => {
    expect(normalizeTheme("  the   sea  at  dawn ")).toBe("the sea at dawn");
  });
  it("handles empty", () => {
    expect(normalizeTheme("")).toBe("");
  });
});

describe("ai-poem-lyrics extractThemeKeywords", () => {
  it("extracts meaningful words, drops stopwords", () => {
    const kw = extractThemeKeywords("The sea at dawn");
    expect(kw).toContain("sea");
    expect(kw).toContain("dawn");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("at");
  });
  it("returns empty for empty input", () => {
    expect(extractThemeKeywords("")).toEqual([]);
  });
  it("deduplicates keywords", () => {
    const kw = extractThemeKeywords("autumn rain autumn");
    expect(kw.filter((k) => k === "autumn")).toHaveLength(1);
  });
});

describe("ai-poem-lyrics countSyllables", () => {
  it("counts single-syllable words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("dog")).toBe(1);
  });
  it("counts multi-syllable words", () => {
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
    expect(countSyllables("happiness")).toBeGreaterThanOrEqual(2);
  });
  it("handles silent -e", () => {
    // "time" should be 1 syllable
    expect(countSyllables("time")).toBe(1);
    // "made" should be 1 syllable
    expect(countSyllables("made")).toBe(1);
  });
  it("returns 0 for empty input", () => {
    expect(countSyllables("")).toBe(0);
    expect(countSyllables("...")).toBe(0);
  });
  it("returns at least 1 for non-empty input", () => {
    expect(countSyllables("a")).toBe(1);
    expect(countSyllables("I")).toBe(1);
  });
});

describe("ai-poem-lyrics countLineSyllables", () => {
  it("sums syllables across words", () => {
    expect(countLineSyllables("the cat sat")).toBe(3);
    expect(countLineSyllables("an apple a day")).toBe(5);
  });
  it("returns 0 for empty line", () => {
    expect(countLineSyllables("")).toBe(0);
    expect(countLineSyllables("   ")).toBe(0);
  });
});

describe("ai-poem-lyrics getRhymeEnding", () => {
  it("returns known dictionary ending", () => {
    expect(getRhymeEnding("light")).toBe("-ight");
    expect(getRhymeEnding("night")).toBe("-ight");
    expect(getRhymeEnding("make")).toBe("-ake");
  });
  it("returns heuristic ending for unknown words", () => {
    const ending = getRhymeEnding("zxcv");
    expect(ending.length).toBeGreaterThan(0);
    expect(ending.startsWith("-")).toBe(true);
  });
});

describe("ai-poem-lyrics findRhymes", () => {
  it("finds rhymes for known words", () => {
    const rhymes = findRhymes("light");
    expect(rhymes.length).toBeGreaterThan(0);
    expect(rhymes).toContain("night");
    expect(rhymes).not.toContain("light");
  });
  it("returns empty array for empty input", () => {
    expect(findRhymes("")).toEqual([]);
  });
  it("returns empty array for words with no rhymes in dictionary", () => {
    const rhymes = findRhymes("zxcvq");
    expect(rhymes).toEqual([]);
  });
});

describe("ai-poem-lyrics pickRhymePartner", () => {
  it("returns a rhyme partner for known words", () => {
    const partner = pickRhymePartner("light", 0);
    expect(findRhymes("light")).toContain(partner);
  });
  it("returns the word itself if no rhymes exist", () => {
    const partner = pickRhymePartner("zxcvq", 0);
    expect(partner).toBe("zxcvq");
  });
  it("is deterministic by offset", () => {
    expect(pickRhymePartner("light", 3)).toBe(pickRhymePartner("light", 3));
  });
});

describe("ai-poem-lyrics buildLine", () => {
  it("builds a non-empty line", () => {
    const line = buildLine({
      theme: "Autumn rain", mood: "melancholy",
      keywords: ["autumn", "rain"], targetSyllables: 7,
    });
    expect(line.length).toBeGreaterThan(0);
  });
  it("incorporates theme keyword", () => {
    const line = buildLine({
      theme: "Autumn rain", mood: "joyful",
      keywords: ["autumn", "rain"],
    });
    // Should mention autumn or rain somewhere
    expect(line.toLowerCase()).toMatch(/autumn|rain/);
  });
  it("honors acrostic letter", () => {
    const line = buildLine({
      theme: "City lights", mood: "contemplative",
      keywords: ["city", "lights"],
      acrosticLetter: "Q",
    });
    expect(line.charAt(0).toUpperCase()).toBe("Q");
  });
  it("appends rhyme word when specified", () => {
    const line = buildLine({
      theme: "The sea at dawn", mood: "romantic",
      keywords: ["sea", "dawn"], rhymeWord: "night",
    });
    expect(line.toLowerCase()).toContain("night");
  });
});

describe("ai-poem-lyrics expandScheme", () => {
  it("expands AABB to [A,A,B,B]", () => {
    expect(expandScheme("AABB", 4)).toEqual(["A", "A", "B", "B"]);
  });
  it("expands ABAB to [A,B,A,B]", () => {
    expect(expandScheme("ABAB", 4)).toEqual(["A", "B", "A", "B"]);
  });
  it("expands ABBA to [A,B,B,A]", () => {
    expect(expandScheme("ABBA", 4)).toEqual(["A", "B", "B", "A"]);
  });
  it("Free scheme uses unique letters per line", () => {
    const labels = expandScheme("Free", 5);
    expect(new Set(labels).size).toBe(5);
  });
  it("AABB extends to longer line counts", () => {
    expect(expandScheme("AABB", 6)).toEqual(["A", "A", "B", "B", "C", "C"]);
  });
});

describe("ai-poem-lyrics pickRhymeWordsForLabels", () => {
  it("assigns a word to each unique label", () => {
    const words = pickRhymeWordsForLabels(["A", "B", "A", "B"], "theme", "joyful");
    expect(words["A"]).toBeTruthy();
    expect(words["B"]).toBeTruthy();
    expect(words["A"]).not.toBe(words["B"]);
  });
});

describe("ai-poem-lyrics validateRhymeScheme", () => {
  it("returns ok when same-label lines rhyme", () => {
    const lines = [
      { index: 0, text: "The light shines bright", syllables: 5, rhymeLabel: "A" },
      { index: 1, text: "The dark of night", syllables: 5, rhymeLabel: "A" },
    ];
    const r = validateRhymeScheme(lines);
    expect(r.ok).toBe(true);
  });
  it("returns mismatch when same-label lines do not rhyme", () => {
    const lines = [
      { index: 0, text: "The cat in the hat", syllables: 5, rhymeLabel: "A" },
      { index: 1, text: "An apple a day", syllables: 5, rhymeLabel: "A" },
    ];
    const r = validateRhymeScheme(lines);
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBeGreaterThan(0);
  });
  it("ignores singletons (one line per label)", () => {
    const lines = [
      { index: 0, text: "line one", syllables: 2, rhymeLabel: "A" },
      { index: 1, text: "line two", syllables: 2, rhymeLabel: "B" },
    ];
    const r = validateRhymeScheme(lines);
    expect(r.ok).toBe(true);
  });
});

describe("ai-poem-lyrics generateHaiku", () => {
  it("produces 3 lines", () => {
    const lines = generateHaiku("Autumn rain", "melancholy");
    expect(lines).toHaveLength(3);
  });
  it("each line has syllable count and label", () => {
    const lines = generateHaiku("The sea at dawn", "contemplative");
    for (const l of lines) {
      expect(typeof l.syllables).toBe("number");
      expect(l.syllables).toBeGreaterThan(0);
      expect(l.rhymeLabel).toMatch(/^[A-Z]$/);
    }
  });
  it("uses 3 distinct rhyme labels (no rhyme in haiku)", () => {
    const lines = generateHaiku("City lights", "joyful");
    const labels = new Set(lines.map((l) => l.rhymeLabel));
    expect(labels.size).toBe(3);
  });
});

describe("ai-poem-lyrics generateSonnet", () => {
  it("produces 14 lines", () => {
    const lines = generateSonnet("Lost love", "melancholy");
    expect(lines).toHaveLength(14);
  });
  it("follows ABAB CDCD EFEF GG rhyme pattern", () => {
    const lines = generateSonnet("Lost love", "romantic");
    const expected = ["A", "B", "A", "B", "C", "D", "C", "D", "E", "F", "E", "F", "G", "G"];
    expect(lines.map((l) => l.rhymeLabel)).toEqual(expected);
  });
  it("repeated labels use rhyme partners", () => {
    const lines = generateSonnet("Lost love", "romantic");
    // Lines 0 and 2 are both "A"; their last words should rhyme
    const w0 = lines[0].text.split(/\s+/).pop() ?? "";
    const w2 = lines[2].text.split(/\s+/).pop() ?? "";
    expect(getRhymeEnding(w0)).toBe(getRhymeEnding(w2));
  });
});

describe("ai-poem-lyrics generateFreeVerse", () => {
  it("produces 8 lines with no repeated rhyme labels", () => {
    const lines = generateFreeVerse("A long journey home", "contemplative");
    expect(lines).toHaveLength(8);
    const labels = new Set(lines.map((l) => l.rhymeLabel));
    expect(labels.size).toBe(8);
  });
});

describe("ai-poem-lyrics generateLimerick", () => {
  it("produces 5 lines", () => {
    const lines = generateLimerick("A childhood memory", "playful");
    expect(lines).toHaveLength(5);
  });
  it("follows AABBA rhyme pattern", () => {
    const lines = generateLimerick("A childhood memory", "playful");
    expect(lines.map((l) => l.rhymeLabel)).toEqual(["A", "A", "B", "B", "A"]);
  });
  it("A-label lines rhyme with each other", () => {
    const lines = generateLimerick("A childhood memory", "playful");
    const aLines = lines.filter((l) => l.rhymeLabel === "A");
    const endings = new Set(aLines.map((l) => {
      const w = l.text.split(/\s+/).pop() ?? "";
      return getRhymeEnding(w);
    }));
    expect(endings.size).toBe(1);
  });
});

describe("ai-poem-lyrics generateAcrostic", () => {
  it("produces one line per letter", () => {
    const lines = generateAcrostic("An old photograph", "contemplative", "MEMORY");
    expect(lines).toHaveLength(6);
  });
  it("first letters spell the word", () => {
    const word = "RAIN";
    const lines = generateAcrostic("The first snow", "melancholy", word);
    const spelled = lines.map((l) => l.text.charAt(0).toUpperCase()).join("");
    expect(spelled).toBe(word);
  });
  it("each line has acrostic letter set", () => {
    const lines = generateAcrostic("City lights", "joyful", "STAR");
    expect(lines.every((l) => l.acrosticLetter !== undefined)).toBe(true);
  });
  it("strips non-letters from the word", () => {
    const lines = generateAcrostic("City lights", "joyful", "S-T!A@R");
    expect(lines).toHaveLength(4);
  });
});

describe("ai-poem-lyrics generateSongLyrics", () => {
  it("produces verse/chorus/bridge structure", () => {
    const sections = generateSongLyrics("Lost love", "romantic");
    expect(sections.length).toBeGreaterThanOrEqual(5);
    expect(sections.some((s) => s.kind === "verse")).toBe(true);
    expect(sections.some((s) => s.kind === "chorus")).toBe(true);
    expect(sections.some((s) => s.kind === "bridge")).toBe(true);
  });
  it("each section has at least 2 lines", () => {
    const sections = generateSongLyrics("Lost love", "romantic");
    for (const s of sections) {
      expect(s.lines.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("includes section labels", () => {
    const sections = generateSongLyrics("Lost love", "romantic");
    expect(sections.every((s) => s.label.length > 0)).toBe(true);
  });
});

describe("ai-poem-lyrics validateForm", () => {
  it("validates a haiku with correct line count", () => {
    const poem: Poem = {
      id: "x", theme: "test", form: "haiku", rhymeScheme: "Free", mood: "joyful",
      lines: generateHaiku("test", "joyful"),
      title: "Test", validation: { formOk: true, rhymeSchemeOk: true, syllableOk: true, notes: [] },
      createdAt: 0,
    };
    const v = validateForm(poem);
    expect(v.formOk).toBe(true);
  });
  it("flags a haiku with wrong line count", () => {
    const poem: Poem = {
      id: "x", theme: "test", form: "haiku", rhymeScheme: "Free", mood: "joyful",
      lines: generateHaiku("test", "joyful").slice(0, 2),
      title: "Test", validation: { formOk: true, rhymeSchemeOk: true, syllableOk: true, notes: [] },
      createdAt: 0,
    };
    const v = validateForm(poem);
    expect(v.formOk).toBe(false);
    expect(v.notes.some((n) => /3 lines/.test(n))).toBe(true);
  });
  it("validates a limerick's AABBA pattern", () => {
    const poem: Poem = {
      id: "x", theme: "test", form: "limerick", rhymeScheme: "AABB", mood: "playful",
      lines: generateLimerick("test", "playful"),
      title: "Test", validation: { formOk: true, rhymeSchemeOk: true, syllableOk: true, notes: [] },
      createdAt: 0,
    };
    const v = validateForm(poem);
    expect(v.formOk).toBe(true);
  });
});

describe("ai-poem-lyrics validatePoemInput", () => {
  it("returns null for valid haiku input", () => {
    expect(validatePoemInput({
      theme: "Autumn rain", form: "haiku", rhymeScheme: "Free", mood: "melancholy",
    })).toBeNull();
  });
  it("returns null for valid acrostic input with word", () => {
    expect(validatePoemInput({
      theme: "City lights", form: "acrostic", rhymeScheme: "Free",
      mood: "joyful", acrosticWord: "STAR",
    })).toBeNull();
  });
  it("errors on empty theme", () => {
    expect(validatePoemInput({
      theme: "", form: "haiku", rhymeScheme: "Free", mood: "joyful",
    })).toContain("theme");
  });
  it("errors on unknown form", () => {
    expect(validatePoemInput({
      theme: "x", form: "broken" as PoemForm, rhymeScheme: "Free", mood: "joyful",
    })).toContain("form");
  });
  it("errors on acrostic without word", () => {
    expect(validatePoemInput({
      theme: "x", form: "acrostic", rhymeScheme: "Free", mood: "joyful",
    })).toContain("word");
  });
  it("errors on acrostic with too-short word", () => {
    expect(validatePoemInput({
      theme: "x", form: "acrostic", rhymeScheme: "Free", mood: "joyful",
      acrosticWord: "A",
    })).toContain("2 letters");
  });
  it("errors on acrostic with too-long word", () => {
    expect(validatePoemInput({
      theme: "x", form: "acrostic", rhymeScheme: "Free", mood: "joyful",
      acrosticWord: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    })).toContain("16");
  });
});

describe("ai-poem-lyrics generatePoem", () => {
  it("generates a haiku poem", () => {
    const work = generatePoem({
      theme: "Autumn rain", form: "haiku", rhymeScheme: "Free", mood: "melancholy",
    }) as Poem;
    expect(work.form).toBe("haiku");
    expect(work.lines).toHaveLength(3);
    expect(work.title).toBeTruthy();
    expect(work.id).toMatch(/^poem-\d+-\d+$/);
  });
  it("generates a sonnet with 14 lines", () => {
    const work = generatePoem({
      theme: "Lost love", form: "sonnet", rhymeScheme: "ABAB", mood: "romantic",
    }) as Poem;
    expect(work.lines).toHaveLength(14);
  });
  it("generates a limerick", () => {
    const work = generatePoem({
      theme: "A childhood memory", form: "limerick", rhymeScheme: "AABB", mood: "playful",
    }) as Poem;
    expect(work.lines).toHaveLength(5);
  });
  it("generates an acrostic", () => {
    const work = generatePoem({
      theme: "City lights", form: "acrostic", rhymeScheme: "Free",
      mood: "joyful", acrosticWord: "STAR",
    }) as Poem;
    expect(work.lines).toHaveLength(4);
    expect(work.acrosticWord).toBe("STAR");
    const spelled = work.lines.map((l) => l.text.charAt(0).toUpperCase()).join("");
    expect(spelled).toBe("STAR");
  });
  it("generates song lyrics with sections", () => {
    const work = generatePoem({
      theme: "Lost love", form: "song", rhymeScheme: "AABB", mood: "romantic",
    }) as SongLyrics;
    expect("sections" in work).toBe(true);
    expect(work.sections.length).toBeGreaterThanOrEqual(5);
    expect(work.id).toMatch(/^song-\d+-\d+$/);
  });
  it("throws on invalid input", () => {
    expect(() => generatePoem({
      theme: "", form: "haiku", rhymeScheme: "Free", mood: "joyful",
    })).toThrow(/theme/);
  });
});

describe("ai-poem-lyrics buildTitle", () => {
  it("returns a non-empty title for each mood", () => {
    for (const m of Object.keys(MOOD_LABELS) as Mood[]) {
      const t = buildTitle("Autumn rain", m);
      expect(t.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-poem-lyrics computeStats", () => {
  it("computes stats for a poem", () => {
    const work = generatePoem({
      theme: "Autumn rain", form: "haiku", rhymeScheme: "Free", mood: "melancholy",
    }) as Poem;
    const s = computeStats(work);
    expect(s.lineCount).toBe(3);
    expect(s.syllableTotal).toBeGreaterThan(0);
    expect(s.avgSyllablesPerLine).toBeGreaterThan(0);
  });
  it("computes stats for song lyrics", () => {
    const work = generatePoem({
      theme: "Lost love", form: "song", rhymeScheme: "AABB", mood: "romantic",
    }) as SongLyrics;
    const s = computeStats(work);
    expect(s.lineCount).toBeGreaterThan(0);
    expect(s.rhymeGroups).toBeGreaterThan(0);
  });
});

describe("ai-poem-lyrics renderers", () => {
  const poem = generatePoem({
    theme: "Autumn rain", form: "haiku", rhymeScheme: "Free", mood: "melancholy",
  }) as Poem;
  const song = generatePoem({
    theme: "Lost love", form: "song", rhymeScheme: "AABB", mood: "romantic",
  }) as SongLyrics;

  it("renderText includes title and syllable annotations for poem", () => {
    const t = renderText(poem);
    expect(t).toContain(poem.title);
    expect(t).toContain("syl");
  });
  it("renderText includes section labels for song", () => {
    const t = renderText(song);
    expect(t).toContain("[Verse 1]");
    expect(t).toContain("[Chorus]");
    expect(t).toContain("[Bridge]");
  });
  it("renderMarkdown includes H1 title", () => {
    const m = renderMarkdown(poem);
    expect(m).toContain(`# ${poem.title}`);
    expect(m).toContain("Theme:");
    expect(m).toContain("Form:");
  });
  it("renderMarkdown includes section headers for song", () => {
    const m = renderMarkdown(song);
    expect(m).toContain("## Verse 1");
    expect(m).toContain("## Chorus");
  });
  it("renderJson is valid JSON for poem", () => {
    const j = renderJson(poem);
    const parsed = JSON.parse(j);
    expect(parsed.form).toBe("haiku");
    expect(Array.isArray(parsed.lines)).toBe(true);
  });
  it("renderJson is valid JSON for song", () => {
    const j = renderJson(song);
    const parsed = JSON.parse(j);
    expect(Array.isArray(parsed.sections)).toBe(true);
  });
});

describe("ai-poem-lyrics history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, theme: "Autumn rain", form: "haiku", rhymeScheme: "Free",
      mood: "melancholy", lineCount: 3, isSong: false,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].theme).toBe("Autumn rain");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, theme: "x", form: "haiku", rhymeScheme: "Free",
        mood: "joyful", lineCount: 3, isSong: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, theme: "x", form: "haiku", rhymeScheme: "Free",
      mood: "joyful", lineCount: 3, isSong: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-poem-lyrics shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      theme: "Autumn rain",
      form: "haiku",
      rhymeScheme: "Free",
      mood: "melancholy",
      acrosticWord: "",
    });
    expect(url).toContain("t=Autumn+rain");
    expect(url).toContain("f=haiku");
    expect(url).toContain("r=Free");
    expect(url).toContain("m=melancholy");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=Autumn+rain&f=haiku&r=Free&m=melancholy&a=STAR");
    expect(p.theme).toBe("Autumn rain");
    expect(p.form).toBe("haiku");
    expect(p.rhymeScheme).toBe("Free");
    expect(p.mood).toBe("melancholy");
    expect(p.acrosticWord).toBe("STAR");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown form", () => {
    const p = parseShareUrl("t=x&f=broken");
    expect(p.form).toBeUndefined();
  });
  it("filters unknown rhyme scheme", () => {
    const p = parseShareUrl("t=x&r=XYZ");
    expect(p.rhymeScheme).toBeUndefined();
  });
  it("filters unknown mood", () => {
    const p = parseShareUrl("t=x&m=angry");
    expect(p.mood).toBeUndefined();
  });
});

describe("ai-poem-lyrics LLM prompt builder", () => {
  it("includes theme, form, rhyme scheme, mood", () => {
    const p = buildLlmPrompt("Autumn rain", "haiku", "Free", "melancholy", "");
    expect(p).toContain("Autumn rain");
    expect(p).toContain("Haiku");
    expect(p).toContain("Free");
    expect(p).toContain("Melancholy");
  });
  it("includes acrostic constraint when acrostic word given", () => {
    const p = buildLlmPrompt("City lights", "acrostic", "Free", "joyful", "STAR");
    expect(p).toContain("STAR");
    expect(p).toContain("spell");
  });
  it("asks for JSON object", () => {
    const p = buildLlmPrompt("x", "haiku", "Free", "joyful", "");
    expect(p).toContain("JSON object");
  });
});

describe("ai-poem-lyrics renderLlmResult", () => {
  it("parses valid JSON object", () => {
    const raw = JSON.stringify({
      title: "Test Poem",
      lines: ["Line one", "Line two"],
      syllablesPerLine: [3, 3],
      rhymeLabels: ["A", "A"],
      validationNotes: ["Follows form."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.title).toBe("Test Poem");
      expect(r.result.lines).toEqual(["Line one", "Line two"]);
      expect(r.result.syllablesPerLine).toEqual([3, 3]);
      expect(r.result.rhymeLabels).toEqual(["A", "A"]);
      expect(r.result.validationNotes).toEqual(["Follows form."]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      title: "T", lines: ["L1"], syllablesPerLine: [2],
      rhymeLabels: ["A"], validationNotes: [],
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
    const r = renderLlmResult(JSON.stringify({ title: "", lines: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no useful content");
  });
  it("filters non-string/non-number entries", () => {
    const raw = JSON.stringify({
      title: "T",
      lines: ["ok", 42, null, "ok2"],
      syllablesPerLine: [1, "x", 2],
      rhymeLabels: ["A", 5, "B"],
      validationNotes: ["ok", null, 9],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.lines).toEqual(["ok", "ok2"]);
      expect(r.result.syllablesPerLine).toEqual([1, 2]);
      expect(r.result.rhymeLabels).toEqual(["A", "B"]);
      expect(r.result.validationNotes).toEqual(["ok"]);
    }
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused =
  | PoemForm
  | RhymeScheme
  | Mood
  | Poem
  | SongLyrics
  | HistoryEntry;
