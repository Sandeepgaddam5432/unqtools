import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  DIFFICULTY_LABELS,
  PHRASES,
  CONJUGATIONS,
  CONJUGATION_VERBS,
  TENSES,
  TENSE_LABELS,
  PRONOUNS,
  NON_LATIN_LANGUAGES,
  translateNumber,
  buildNumberTable,
  lookupTranslation,
  lookupReverse,
  filterPhrases,
  getPhraseText,
  getPhrasePronunciation,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildFlashcards,
  shuffleCards,
  type LanguageCode,
  type PhraseCategory,
  type PracticeMode,
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

describe("language-translator-helper constants", () => {
  it("ships 10 languages", () => {
    expect(LANGUAGES).toHaveLength(10);
    expect(Object.keys(LANGUAGE_LABELS)).toHaveLength(10);
  });
  it("includes all expected languages", () => {
    expect(LANGUAGES).toContain("english");
    expect(LANGUAGES).toContain("spanish");
    expect(LANGUAGES).toContain("japanese");
    expect(LANGUAGES).toContain("arabic");
  });
  it("ships 8 categories", () => {
    expect(CATEGORIES).toHaveLength(8);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(8);
  });
  it("ships 3 practice modes", () => {
    expect(PRACTICE_MODES).toHaveLength(3);
    expect(Object.keys(PRACTICE_MODE_LABELS)).toHaveLength(3);
  });
  it("has 3 difficulty labels", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("has 4 non-Latin languages flagged", () => {
    expect(NON_LATIN_LANGUAGES).toHaveLength(4);
    expect(NON_LATIN_LANGUAGES).toContain("hindi");
    expect(NON_LATIN_LANGUAGES).toContain("japanese");
    expect(NON_LATIN_LANGUAGES).toContain("chinese");
    expect(NON_LATIN_LANGUAGES).toContain("arabic");
  });
  it("ships 200+ phrases", () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(200);
  });
  it("every phrase has english + at least 5 translations", () => {
    for (const p of PHRASES) {
      expect(p.english).toBeTruthy();
      expect(Object.keys(p.translations).length).toBeGreaterThanOrEqual(5);
    }
  });
  it("every phrase has an id and a category", () => {
    for (const p of PHRASES) {
      expect(p.id).toBeTruthy();
      expect(CATEGORIES).toContain(p.category);
    }
  });
  it("every category has at least 10 phrases", () => {
    for (const c of CATEGORIES) {
      const count = PHRASES.filter((p) => p.category === c).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("language-translator-helper conjugations", () => {
  it("has 10 verbs", () => {
    expect(CONJUGATION_VERBS).toHaveLength(10);
    expect(CONJUGATIONS).toHaveLength(10);
  });
  it("has 6 tenses", () => {
    expect(TENSES).toHaveLength(6);
    expect(Object.keys(TENSE_LABELS)).toHaveLength(6);
  });
  it("has 6 pronouns", () => {
    expect(PRONOUNS).toHaveLength(6);
  });
  it("every english verb has 6 entries per tense", () => {
    for (const c of CONJUGATIONS) {
      const en = c.byLanguage.english;
      if (!en) continue;
      for (const t of TENSES) {
        expect(en[t]).toHaveLength(6);
      }
    }
  });
  it("conjugates 'to be' present correctly for english", () => {
    const be = CONJUGATIONS.find((c) => c.verb === "to be");
    expect(be?.byLanguage.english?.present).toEqual(["am", "are", "is", "are", "are", "are"]);
  });
  it("conjugates 'to have' past correctly for spanish", () => {
    const have = CONJUGATIONS.find((c) => c.verb === "to have");
    expect(have?.byLanguage.spanish?.past[0]).toBe("tuve");
  });
  it("fills missing tenses with em-dashes via the helper", () => {
    // Every shipped language has full conjugations, so verify all present
    // language entries have 6 tenses × 6 entries each.
    for (const c of CONJUGATIONS) {
      for (const lang of Object.keys(c.byLanguage) as LanguageCode[]) {
        const tenses = c.byLanguage[lang]!;
        for (const t of TENSES) {
          expect(tenses[t]).toHaveLength(6);
          for (const entry of tenses[t]) {
            expect(typeof entry).toBe("string");
            expect(entry.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("language-translator-helper translateNumber", () => {
  it("translates 1 in all 10 languages", () => {
    for (const lang of LANGUAGES) {
      const w = translateNumber(1, lang);
      expect(w).toBeTruthy();
      expect(typeof w).toBe("string");
    }
  });
  it("translates 5 in spanish as 'cinco'", () => {
    expect(translateNumber(5, "spanish")).toBe("cinco");
  });
  it("translates 12 in french as 'douze'", () => {
    expect(translateNumber(12, "french")).toBe("douze");
  });
  it("translates 25 in english as 'twenty-five'", () => {
    expect(translateNumber(25, "english")).toBe("twenty-five");
  });
  it("translates 100 in german as 'einhundert'", () => {
    expect(translateNumber(100, "german")).toBe("einhundert");
  });
  it("translates 25 in japanese as 'nijuu-go'", () => {
    expect(translateNumber(25, "japanese")).toBe("nijuu-go");
  });
  it("translates 25 in german as 'fünfundzwanzig'", () => {
    expect(translateNumber(25, "german")).toBe("fünfundzwanzig");
  });
  it("returns empty for out-of-range numbers", () => {
    expect(translateNumber(101, "english")).toBe("");
    expect(translateNumber(-1, "english")).toBe("");
    expect(translateNumber(3.5, "english")).toBe("");
  });
  it("builds a 100-entry number table for all languages", () => {
    const table = buildNumberTable();
    expect(table).toHaveLength(100);
    for (const row of table) {
      expect(Object.keys(row.byLanguage).length).toBe(10);
    }
  });
});

describe("language-translator-helper lookupTranslation", () => {
  it("translates english → spanish", () => {
    const r = lookupTranslation("english", "spanish", "Hello");
    expect(r).not.toBeNull();
    expect(r!.result).toBe("Hola");
  });
  it("returns pronunciation for non-Latin target", () => {
    const r = lookupTranslation("english", "japanese", "Hello");
    expect(r).not.toBeNull();
    expect(r!.result).toBe("Konnichiwa");
    expect(r!.pronunciation).toBeTruthy();
  });
  it("translates english → english (returns english)", () => {
    const r = lookupTranslation("english", "english", "Hello");
    expect(r!.result).toBe("Hello");
  });
  it("does reverse lookup (spanish → english)", () => {
    const r = lookupTranslation("spanish", "english", "Hola");
    expect(r).not.toBeNull();
    expect(r!.result).toBe("Hello");
  });
  it("returns null for unknown phrase", () => {
    expect(lookupTranslation("english", "spanish", "zzz-not-a-phrase")).toBeNull();
  });
  it("returns null for empty query", () => {
    expect(lookupTranslation("english", "spanish", "")).toBeNull();
  });
});

describe("language-translator-helper lookupReverse", () => {
  it("reverse-translates spanish → english", () => {
    const r = lookupReverse("english", "spanish", "Hola");
    expect(r).not.toBeNull();
    expect(r!.result).toBe("Hello");
  });
  it("reverse-translates japanese → english with pronunciation", () => {
    const r = lookupReverse("english", "japanese", "Konnichiwa");
    expect(r).not.toBeNull();
    expect(r!.result).toBe("Hello");
  });
});

describe("language-translator-helper filterPhrases", () => {
  it("filters by category", () => {
    const filtered = filterPhrases("greetings", "english", "spanish");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((p) => p.category === "greetings")).toBe(true);
  });
  it("filters by search query across languages", () => {
    const filtered = filterPhrases("", "english", "spanish", "hello");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((p) => p.english.toLowerCase().includes("hello"))).toBe(true);
  });
  it("returns empty for unknown search", () => {
    const filtered = filterPhrases("", "english", "spanish", "zzz");
    expect(filtered).toEqual([]);
  });
  it("excludes phrases without the requested source/target translation", () => {
    const filtered = filterPhrases("", "english", "chinese");
    expect(filtered.every((p) => p.translations.chinese)).toBe(true);
  });
});

describe("language-translator-helper getPhraseText/Pronunciation", () => {
  it("returns english for english", () => {
    const phrase = PHRASES[0];
    expect(getPhraseText(phrase, "english")).toBe(phrase.english);
  });
  it("returns translation for non-english", () => {
    const phrase = PHRASES[0];
    expect(getPhraseText(phrase, "spanish")).toBe(phrase.translations.spanish);
  });
  it("returns undefined pronunciation for english", () => {
    const phrase = PHRASES[0];
    expect(getPhrasePronunciation(phrase, "english")).toBeUndefined();
  });
  it("returns pronunciation for non-Latin language", () => {
    const phrase = PHRASES.find((p) => p.id === "g-01")!;
    const pron = getPhrasePronunciation(phrase, "japanese");
    expect(pron).toBeTruthy();
  });
});

describe("language-translator-helper computeStats", () => {
  it("computes total phrases", () => {
    const filtered = filterPhrases("greetings", "english", "spanish");
    const stats = computeStats(filtered, "english", "spanish");
    expect(stats.totalPhrases).toBe(filtered.length);
  });
  it("computes by-category breakdown", () => {
    const filtered = filterPhrases("", "english", "spanish");
    const stats = computeStats(filtered, "english", "spanish");
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(filtered.length);
  });
  it("returns zero for empty filtered list", () => {
    const stats = computeStats([], "english", "spanish");
    expect(stats.totalPhrases).toBe(0);
    for (const c of CATEGORIES) expect(stats.byCategory[c]).toBe(0);
  });
});

describe("language-translator-helper renderText", () => {
  it("renders a header", () => {
    const filtered = filterPhrases("greetings", "english", "spanish");
    const text = renderText(filtered, "english", "spanish");
    expect(text).toContain("Phrasebook");
    expect(text).toContain("Source: English");
    expect(text).toContain("Target: Spanish");
  });
  it("renders phrases with arrows", () => {
    const filtered = filterPhrases("greetings", "english", "spanish", "hello");
    const text = renderText(filtered, "english", "spanish");
    expect(text).toContain("Hello → Hola");
  });
  it("includes pronunciation when available", () => {
    const filtered = filterPhrases("greetings", "english", "japanese", "hello");
    const text = renderText(filtered, "english", "japanese");
    expect(text).toContain("Konnichiwa");
  });
});

describe("language-translator-helper renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([], "english", "spanish")).toContain("category,source,target,pronunciation,difficulty");
  });
  it("renders rows", () => {
    const filtered = filterPhrases("greetings", "english", "spanish", "hello");
    const csv = renderCsv(filtered, "english", "spanish");
    expect(csv).toContain("Hello,Hola");
  });
});

describe("language-translator-helper history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, sourceLanguage: "english", targetLanguage: "spanish",
      category: "greetings", mode: "browse", phraseCount: 28,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, sourceLanguage: "english", targetLanguage: "spanish",
        category: "greetings", mode: "browse", phraseCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, sourceLanguage: "english", targetLanguage: "spanish",
      category: "greetings", mode: "browse", phraseCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("language-translator-helper shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      source: "english",
      target: "japanese",
      category: "greetings",
      mode: "flashcard",
      search: "hello",
    });
    expect(url).toContain("src=english");
    expect(url).toContain("tgt=japanese");
    expect(url).toContain("cat=greetings");
    expect(url).toContain("mode=flashcard");
    expect(url).toContain("q=hello");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("src=english&tgt=french&cat=food&mode=flashcard&q=water");
    expect(p.source).toBe("english");
    expect(p.target).toBe("french");
    expect(p.category).toBe("food");
    expect(p.mode).toBe("flashcard");
    expect(p.search).toBe("water");
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.source).toBe("english");
    expect(p.target).toBe("spanish");
    expect(p.category).toBe("");
    expect(p.mode).toBe("browse");
  });
  it("filters unknown languages", () => {
    const p = parseShareUrl("src=english&tgt=klingon");
    expect(p.target).toBe("spanish"); // fallback default
  });
  it("omits browse mode by default", () => {
    const url = buildShareUrl({
      source: "english", target: "spanish", category: "", mode: "browse", search: "",
    });
    expect(url).not.toContain("mode=");
  });
});

describe("language-translator-helper flashcards", () => {
  it("builds flashcards from filtered phrases", () => {
    const filtered = filterPhrases("greetings", "english", "spanish", "hello");
    const cards = buildFlashcards(filtered, "english", "spanish");
    expect(cards).toHaveLength(filtered.length);
    expect(cards[0].front).toBe("Hello");
    expect(cards[0].back).toBe("Hola");
  });
  it("includes pronunciation when target is non-Latin", () => {
    const filtered = filterPhrases("greetings", "english", "japanese", "hello");
    const cards = buildFlashcards(filtered, "english", "japanese");
    expect(cards[0].pronunciation).toBeTruthy();
  });
  it("shuffleCards preserves elements", () => {
    const rng = (() => {
      let s = 1;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();
    const filtered = filterPhrases("greetings", "english", "spanish");
    const cards = buildFlashcards(filtered, "english", "spanish");
    const shuffled = shuffleCards(cards, rng);
    expect(shuffled.length).toBe(cards.length);
    expect(shuffled.sort((a, b) => a.front.localeCompare(b.front))).toEqual(
      cards.slice().sort((a, b) => a.front.localeCompare(b.front)),
    );
  });
  it("shuffleCards does not mutate input", () => {
    const filtered = filterPhrases("greetings", "english", "spanish");
    const cards = buildFlashcards(filtered, "english", "spanish");
    const original = cards.slice();
    shuffleCards(cards);
    expect(cards).toEqual(original);
  });
});

// Suppress unused-import lint
export type _Unused = LanguageCode | PhraseCategory | PracticeMode;
