import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  TM_KEY,
  GLOSSARY_KEY,
  LANGUAGES,
  LANGUAGE_LABELS,
  RTL_LANGUAGES,
  SAMPLE_PHRASES,
  HONESTY_NOTES,
  PHRASEBOOK,
  getPhraseCount,
  getCategories,
  detectLanguage,
  loadTranslationMemory,
  addToTranslationMemory,
  clearTranslationMemory,
  lookupTranslationMemory,
  loadGlossary,
  saveGlossary,
  clearGlossary,
  findPhraseHits,
  translateText,
  swapLanguages,
  translateBatch,
  splitLines,
  transliterate,
  isRtl,
  countChars,
  countWords,
  renderMarkdownTable,
  renderPlainText,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LanguageCode,
  type TranslationMemoryEntry,
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

// ---------- Constants ----------

describe("translator constants", () => {
  it("has 10 languages", () => {
    expect(LANGUAGES).toHaveLength(10);
  });
  it("has language labels for all 10", () => {
    expect(Object.keys(LANGUAGE_LABELS)).toHaveLength(10);
  });
  it("marks Arabic as RTL", () => {
    expect(RTL_LANGUAGES).toContain("ar");
    expect(RTL_LANGUAGES).not.toContain("en");
  });
  it("has sample phrases for all 10 languages", () => {
    expect(SAMPLE_PHRASES).toHaveLength(10);
  });
  it("exposes HISTORY_KEY, TM_KEY, GLOSSARY_KEY, HISTORY_MAX", () => {
    expect(HISTORY_KEY).toContain("ai-multi-language-translator");
    expect(TM_KEY).toContain("memory");
    expect(GLOSSARY_KEY).toContain("glossary");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 100+ phrasebook entries", () => {
    expect(PHRASEBOOK.length).toBeGreaterThanOrEqual(100);
  });
  it("every phrase has all 10 translations", () => {
    for (const entry of PHRASEBOOK) {
      const langs = Object.keys(entry.translations);
      expect(langs).toHaveLength(10);
      for (const l of ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ar"] as LanguageCode[]) {
        expect(entry.translations[l]).toBeTruthy();
      }
    }
  });
  it("getPhraseCount returns phrasebook length", () => {
    expect(getPhraseCount()).toBe(PHRASEBOOK.length);
  });
  it("getCategories returns unique categories", () => {
    const cats = getCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(new Set(cats).size).toBe(cats.length);
  });
  it("has honesty notes", () => {
    expect(HONESTY_NOTES.length).toBeGreaterThanOrEqual(3);
  });
  it("every language has a sample phrase", () => {
    const sampleLangs = SAMPLE_PHRASES.map((s) => s.lang);
    for (const l of LANGUAGES) {
      expect(sampleLangs).toContain(l.code);
    }
  });
});

// ---------- Language detection ----------

describe("translator detectLanguage", () => {
  it("detects Arabic script", () => {
    const d = detectLanguage("مرحبا كيف حالك");
    expect(d.lang).toBe("ar");
    expect(d.confidence).toBeGreaterThan(0.5);
  });
  it("detects Cyrillic as Russian", () => {
    const d = detectLanguage("Привет как дела");
    expect(d.lang).toBe("ru");
  });
  it("detects Hiragana/Katakana as Japanese", () => {
    const d = detectLanguage("こんにちは");
    expect(d.lang).toBe("ja");
  });
  it("detects Han as Chinese (when no kana)", () => {
    const d = detectLanguage("你好吗");
    expect(d.lang).toBe("zh");
  });
  it("defaults to English for empty input", () => {
    const d = detectLanguage("");
    expect(d.lang).toBe("en");
    expect(d.confidence).toBe(0);
  });
  it("detects Latin script (returns some language)", () => {
    const d = detectLanguage("Hola, cómo estás");
    expect(d.lang).toBe("es");
  });
});

// ---------- Translation memory ----------

describe("translator translation memory (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadTranslationMemory()).toEqual([]);
  });
  it("adds and loads", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Good morning", targetText: "Buenos días" });
    const mem = loadTranslationMemory();
    expect(mem).toHaveLength(1);
    expect(mem[0].sourceText).toBe("Good morning");
    expect(mem[0].targetText).toBe("Buenos días");
  });
  it("replaces duplicate entries", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola" });
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola!" });
    const mem = loadTranslationMemory();
    expect(mem).toHaveLength(1);
    expect(mem[0].targetText).toBe("Hola!");
  });
  it("keeps different pairs separate", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola" });
    addToTranslationMemory({ source: "en", target: "fr", sourceText: "Hello", targetText: "Bonjour" });
    expect(loadTranslationMemory()).toHaveLength(2);
  });
  it("clears", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola" });
    clearTranslationMemory();
    expect(loadTranslationMemory()).toEqual([]);
  });
  it("lookupTranslationMemory finds entry", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola" });
    const found = lookupTranslationMemory("en", "es", "Hello");
    expect(found?.targetText).toBe("Hola");
  });
  it("lookupTranslationMemory returns null for missing", () => {
    expect(lookupTranslationMemory("en", "es", "Goodbye")).toBeNull();
  });
  it("lookupTranslationMemory is case-insensitive", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola" });
    expect(lookupTranslationMemory("en", "es", "HELLO")?.targetText).toBe("Hola");
  });
});

// ---------- Glossary ----------

describe("translator glossary (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadGlossary()).toEqual([]);
  });
  it("saves and loads", () => {
    saveGlossary(["Acme", "Brand"]);
    expect(loadGlossary()).toEqual(["Acme", "Brand"]);
  });
  it("clears", () => {
    saveGlossary(["Acme"]);
    clearGlossary();
    expect(loadGlossary()).toEqual([]);
  });
});

// ---------- Phrase hits ----------

describe("translator findPhraseHits", () => {
  it("finds known phrases in English", () => {
    const hits = findPhraseHits("Hello. Goodbye.", "en");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const keys = hits.map((h) => h.entry.key);
    expect(keys).toContain("hello");
    expect(keys).toContain("goodbye");
  });
  it("finds known phrases in Spanish", () => {
    const hits = findPhraseHits("Hola. Gracias.", "es");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const keys = hits.map((h) => h.entry.key);
    expect(keys).toContain("hello");
    expect(keys).toContain("thank you");
  });
  it("returns empty for empty text", () => {
    expect(findPhraseHits("", "en")).toEqual([]);
  });
  it("sorts hits by start position", () => {
    const hits = findPhraseHits("Hello. Goodbye.", "en");
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].start).toBeGreaterThanOrEqual(hits[i - 1].start);
    }
  });
  it("does not overlap matches", () => {
    const hits = findPhraseHits("Hello. Goodbye. Thank you.", "en");
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].start).toBeGreaterThanOrEqual(hits[i - 1].end);
    }
  });
});

// ---------- Translation engine ----------

describe("translator translateText", () => {
  it("translates 'Hello' from en to es", () => {
    const r = translateText("Hello", "en", "es");
    expect(r.translated).toContain("Hola");
    expect(r.dictionaryHits).toBeGreaterThan(0);
    expect(r.source).toBe("en");
    expect(r.target).toBe("es");
  });
  it("auto-detects source language", () => {
    const r = translateText("Hola", "auto", "en");
    expect(r.detected).toBe("es");
    expect(r.translated.toLowerCase()).toContain("hello");
  });
  it("returns passthrough when source equals target", () => {
    const r = translateText("Hello", "en", "en");
    expect(r.translated).toBe("Hello");
    expect(r.passthroughCount).toBe(1);
  });
  it("translates multiple phrases in one text", () => {
    const r = translateText("Hello. Thank you. Goodbye.", "en", "es");
    expect(r.translated).toContain("Hola");
    expect(r.translated).toContain("Gracias");
    expect(r.translated).toContain("Adiós");
    expect(r.dictionaryHits).toBeGreaterThanOrEqual(3);
  });
  it("passes through unknown text", () => {
    const r = translateText("xyzzy qwerty", "en", "es");
    expect(r.translated).toBe("xyzzy qwerty");
    expect(r.passthroughCount).toBeGreaterThan(0);
  });
  it("uses translation memory when available", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Hello", targetText: "Hola custom!" });
    const r = translateText("Hello", "en", "es");
    expect(r.translated).toContain("Hola custom!");
    expect(r.memoryHits).toBe(1);
  });
  it("respects glossary (do-not-translate)", () => {
    const r = translateText("Hello", "en", "es", ["Hello"]);
    expect(r.translated).toBe("Hello");
    expect(r.passthroughCount).toBe(1);
  });
  it("returns empty for empty text", () => {
    const r = translateText("", "en", "es");
    expect(r.translated).toBe("");
    expect(r.matches).toEqual([]);
  });
  it("marks RTL for Arabic target", () => {
    const r = translateText("Hello", "en", "ar");
    expect(r.rtl).toBe(true);
  });
  it("marks non-RTL for English target", () => {
    const r = translateText("Hola", "es", "en");
    expect(r.rtl).toBe(false);
  });
  it("uses TM for whole text when no dictionary hits", () => {
    addToTranslationMemory({ source: "en", target: "es", sourceText: "Brand slogan here", targetText: "Lema de marca aquí" });
    const r = translateText("Brand slogan here", "en", "es");
    expect(r.translated).toBe("Lema de marca aquí");
    expect(r.memoryHits).toBe(1);
  });
});

// ---------- Swap ----------

describe("translator swapLanguages", () => {
  it("swaps known source and target", () => {
    const s = swapLanguages("en", "es");
    expect(s.source).toBe("es");
    expect(s.target).toBe("en");
  });
  it("handles auto source by making target the source and English the target", () => {
    const s = swapLanguages("auto", "es");
    expect(s.source).toBe("es");
    expect(s.target).toBe("en");
  });
});

// ---------- Batch ----------

describe("translator translateBatch + splitLines", () => {
  it("translates multiple lines", () => {
    const results = translateBatch(["Hello", "Goodbye", "Thank you"], "en", "es");
    expect(results).toHaveLength(3);
    expect(results[0].translated).toContain("Hola");
    expect(results[1].translated).toContain("Adiós");
    expect(results[2].translated).toContain("Gracias");
  });
  it("returns empty for empty input", () => {
    expect(translateBatch([], "en", "es")).toEqual([]);
  });
  it("splitLines splits on newline", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("splitLines handles CRLF", () => {
    expect(splitLines("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });
  it("splitLines returns empty for empty input", () => {
    expect(splitLines("")).toEqual([]);
  });
});

// ---------- Transliteration ----------

describe("translator transliterate", () => {
  it("transliterates Cyrillic to Latin", () => {
    const t = transliterate("Привет", "ru");
    expect(t).toBe("Privet");
  });
  it("transliterates Arabic to Latin (basic)", () => {
    const t = transliterate("مرحبا", "ar");
    // Each Arabic char maps to a Latin letter; we just verify it produces output.
    expect(t.length).toBeGreaterThan(0);
    expect(t).not.toContain("م");
    expect(t).not.toContain("ر");
  });
  it("passes through Latin text unchanged", () => {
    expect(transliterate("Hello", "en")).toBe("Hello");
  });
  it("preserves non-Cyrillic chars in Russian text", () => {
    const t = transliterate("Привет, World!", "ru");
    expect(t).toContain("Privet");
    expect(t).toContain("World");
  });
  it("returns empty for empty input", () => {
    expect(transliterate("", "ru")).toBe("");
  });
});

// ---------- isRtl ----------

describe("translator isRtl", () => {
  it("returns true for Arabic", () => {
    expect(isRtl("ar")).toBe(true);
  });
  it("returns false for English", () => {
    expect(isRtl("en")).toBe(false);
  });
});

// ---------- Counting ----------

describe("translator countChars + countWords", () => {
  it("countChars returns length", () => {
    expect(countChars("Hello")).toBe(5);
    expect(countChars("")).toBe(0);
  });
  it("countWords splits on whitespace", () => {
    expect(countWords("Hello world foo")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("countWords handles CJK by counting characters as words", () => {
    expect(countWords("你好世界")).toBe(4);
  });
});

// ---------- Rendering ----------

describe("translator renderMarkdownTable + renderPlainText", () => {
  it("renders markdown table with header", () => {
    const results = translateBatch(["Hello"], "en", "es");
    const md = renderMarkdownTable(results);
    expect(md).toContain("| Source | Target | Method |");
    expect(md).toContain("Hola");
  });
  it("renders plain text (target only)", () => {
    const results = translateBatch(["Hello", "Goodbye"], "en", "es");
    const text = renderPlainText(results);
    expect(text).toContain("Hola");
    expect(text).toContain("Adiós");
    expect(text).not.toContain("|");
  });
});

// ---------- LLM helpers ----------

describe("translator buildLlmPrompt", () => {
  it("includes source and target languages", () => {
    const p = buildLlmPrompt("Hello", "en", "es");
    expect(p).toContain("English");
    expect(p).toContain("Spanish");
    expect(p).toContain("Hello");
  });
  it("handles auto source", () => {
    const p = buildLlmPrompt("Hola", "auto", "en");
    expect(p).toContain("auto-detect");
  });
});

describe("translator renderLlmResult", () => {
  it("trims whitespace", () => {
    expect(renderLlmResult("  Hola  ")).toBe("Hola");
  });
  it("returns empty for empty input", () => {
    expect(renderLlmResult("")).toBe("");
  });
});

// ---------- History ----------

describe("translator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, source: "en", target: "es",
      sourceText: "Hello", targetText: "Hola", method: "dictionary",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].sourceText).toBe("Hello");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, source: "en", target: "es",
        sourceText: `T${i}`, targetText: `U${i}`, method: "dictionary",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, source: "en", target: "es",
      sourceText: "Hi", targetText: "Hola", method: "dictionary",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("prepends new entry", () => {
    saveHistory({ ts: 1, source: "en", target: "es", sourceText: "A", targetText: "X", method: "dictionary" });
    saveHistory({ ts: 2, source: "en", target: "es", sourceText: "B", targetText: "Y", method: "dictionary" });
    expect(loadHistory()[0].sourceText).toBe("B");
  });
});

// ---------- Shareable URL ----------

describe("translator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ source: "en", target: "es", text: "Hello" });
    expect(url).toContain("src=en");
    expect(url).toContain("tgt=es");
    expect(url).toContain("text=Hello");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ source: "en", target: "es", text: "Hello World" });
    const hash = url.slice(url.indexOf("?") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.source).toBe("en");
    expect(parsed.target).toBe("es");
    expect(parsed.text).toBe("Hello World");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses auto source", () => {
    const p = parseShareUrl("src=auto&tgt=fr&text=Bonjour");
    expect(p.source).toBe("auto");
    expect(p.target).toBe("fr");
    expect(p.text).toBe("Bonjour");
  });
  it("parses empty hash to defaults", () => {
    const p = parseShareUrl("");
    expect(p.source).toBe("auto");
    expect(p.target).toBe("en");
    expect(p.text).toBe("");
  });
  it("filters unknown language codes", () => {
    const p = parseShareUrl("src=invalid&tgt=alsoinvalid&text=Hi");
    expect(p.source).toBe("auto");
    expect(p.target).toBe("en");
  });
});

// Suppress unused-import lint
export type _Unused = TranslationMemoryEntry;
