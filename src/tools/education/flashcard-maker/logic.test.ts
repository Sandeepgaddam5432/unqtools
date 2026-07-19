import { describe, it, expect, beforeEach } from "vitest";
import {
  STUDY_MODES,
  STUDY_MODE_LABELS,
  DIFFICULTIES,
  DECK_PRESETS,
  SM2_DEFAULT_EASE,
  SM2_MIN_EASE,
  normalizeText,
  makeCardId,
  parseTags,
  isDifficulty,
  parseCards,
  parseJsonCards,
  makeCard,
  splitCsvRow,
  validateDeck,
  shuffleCards,
  nextIndex,
  prevIndex,
  sm2Update,
  markCard,
  computeSessionStats,
  computeSummaryStats,
  renderText,
  renderCsv,
  renderJson,
  renderSource,
  filterCards,
  reverseCards,
  addTag,
  removeTag,
  setDifficulty,
  getDeckPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Card,
  type Deck,
  type Difficulty,
  type StudyMode,
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

function makeSimpleDeck(): Deck {
  return {
    name: "Test",
    cards: parseCards("a|1\nb|2\nc|3"),
  };
}

describe("flashcard-maker constants", () => {
  it("has 3 study modes", () => {
    expect(STUDY_MODES).toHaveLength(3);
    expect(STUDY_MODES).toContain("sequential");
    expect(STUDY_MODES).toContain("shuffled");
    expect(STUDY_MODES).toContain("spaced-repetition-simplified");
  });
  it("has labels for all study modes", () => {
    for (const m of STUDY_MODES) expect(STUDY_MODE_LABELS[m]).toBeTruthy();
  });
  it("has 3 difficulties", () => {
    expect(DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
  });
  it("has 4 deck presets", () => {
    expect(DECK_PRESETS).toHaveLength(4);
    expect(DECK_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining(["spanish-vocab", "us-states", "multiplication-tables", "periodic-table"]),
    );
  });
  it("each preset has cards", () => {
    for (const p of DECK_PRESETS) {
      expect(p.cardsText.length).toBeGreaterThan(0);
      const cards = parseCards(p.cardsText);
      expect(cards.length).toBeGreaterThanOrEqual(5);
    }
  });
  it("SM-2 defaults are sane", () => {
    expect(SM2_DEFAULT_EASE).toBe(2.5);
    expect(SM2_MIN_EASE).toBe(1.3);
  });
});

describe("flashcard-maker normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null as unknown as string)).toBe("");
  });
});

describe("flashcard-maker makeCardId", () => {
  it("slugifies term + index", () => {
    expect(makeCardId("Hello World", 3)).toBe("hello-world-3");
  });
  it("falls back when term is empty", () => {
    expect(makeCardId("", 0)).toBe("card-0");
  });
});

describe("flashcard-maker parseTags", () => {
  it("parses comma-separated", () => {
    expect(parseTags("vocab, beginner, basic")).toEqual(["vocab", "beginner", "basic"]);
  });
  it("parses space-separated", () => {
    expect(parseTags("vocab beginner")).toEqual(["vocab", "beginner"]);
  });
  it("handles empty", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });
  it("lowercases", () => {
    expect(parseTags("Vocab, BASIC")).toEqual(["vocab", "basic"]);
  });
});

describe("flashcard-maker isDifficulty", () => {
  it("accepts valid", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("medium")).toBe(true);
    expect(isDifficulty("hard")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isDifficulty("Easy")).toBe(false);
    expect(isDifficulty("unknown")).toBe(false);
    expect(isDifficulty("")).toBe(false);
  });
});

describe("flashcard-maker makeCard", () => {
  it("creates a card with default SM-2 state", () => {
    const c = makeCard("Hola", "Hello", ["greeting"], "easy", 0);
    expect(c.term).toBe("Hola");
    expect(c.definition).toBe("Hello");
    expect(c.tags).toEqual(["greeting"]);
    expect(c.difficulty).toBe("easy");
    expect(c.easeFactor).toBe(2.5);
    expect(c.interval).toBe(0);
    expect(c.repetitions).toBe(0);
    expect(c.seen).toBe(false);
    expect(c.known).toBe(null);
  });
});

describe("flashcard-maker parseCards multi-format", () => {
  it("parses pipe-separated", () => {
    const cards = parseCards("hola|hello\ngracias|thank you");
    expect(cards).toHaveLength(2);
    expect(cards[0].term).toBe("hola");
    expect(cards[0].definition).toBe("hello");
  });
  it("parses pipe with tags and difficulty", () => {
    const cards = parseCards("hola|hello|greeting,basic|easy");
    expect(cards).toHaveLength(1);
    expect(cards[0].tags).toEqual(["greeting", "basic"]);
    expect(cards[0].difficulty).toBe("easy");
  });
  it("parses pipe with only difficulty in 3rd field", () => {
    const cards = parseCards("hola|hello|hard");
    expect(cards[0].tags).toEqual([]);
    expect(cards[0].difficulty).toBe("hard");
  });
  it("parses pipe with tags in 3rd and difficulty in 4th", () => {
    const cards = parseCards("hola|hello|greeting|medium");
    expect(cards[0].tags).toEqual(["greeting"]);
    expect(cards[0].difficulty).toBe("medium");
  });
  it("parses tab-separated", () => {
    const cards = parseCards("hola\thello\ngracias\tthank you");
    expect(cards).toHaveLength(2);
    expect(cards[0].term).toBe("hola");
    expect(cards[0].definition).toBe("hello");
    expect(cards[0].tags).toEqual([]);
    expect(cards[0].difficulty).toBe("medium");
  });
  it("parses comma-separated", () => {
    const cards = parseCards("hola,hello\ngracias,thank you");
    expect(cards).toHaveLength(2);
    expect(cards[0].term).toBe("hola");
    expect(cards[0].definition).toBe("hello");
  });
  it("parses comma-separated with quoted commas", () => {
    const cards = parseCards('"hello, world","greeting"');
    expect(cards).toHaveLength(1);
    expect(cards[0].term).toBe("hello, world");
    expect(cards[0].definition).toBe("greeting");
  });
  it("parses JSON array", () => {
    const cards = parseCards(JSON.stringify([
      { term: "hola", definition: "hello", tags: ["greeting"], difficulty: "easy" },
      { term: "gracias", definition: "thanks" },
    ]));
    expect(cards).toHaveLength(2);
    expect(cards[0].term).toBe("hola");
    expect(cards[0].tags).toEqual(["greeting"]);
    expect(cards[0].difficulty).toBe("easy");
    expect(cards[1].difficulty).toBe("medium");
  });
  it("parses JSON single object", () => {
    const cards = parseCards(JSON.stringify({ term: "hola", definition: "hello" }));
    expect(cards).toHaveLength(1);
    expect(cards[0].term).toBe("hola");
  });
  it("skips empty lines", () => {
    const cards = parseCards("a|1\n\n\nb|2");
    expect(cards).toHaveLength(2);
  });
  it("skips comment lines (starting with #)", () => {
    const cards = parseCards("# comment\na|1\n# another\nb|2");
    expect(cards).toHaveLength(2);
  });
  it("skips lines without both term and definition", () => {
    const cards = parseCards("a|1\nb|\n|3\nc|2");
    expect(cards).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseCards("")).toEqual([]);
    expect(parseCards("   ")).toEqual([]);
  });
});

describe("flashcard-maker parseJsonCards", () => {
  it("returns null for non-JSON", () => {
    expect(parseJsonCards("hola|hello")).toBeNull();
    expect(parseJsonCards("")).toBeNull();
  });
  it("returns null for invalid JSON", () => {
    expect(parseJsonCards("[{term: 'hola'}]")).toBeNull();
  });
});

describe("flashcard-maker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("flashcard-maker validateDeck", () => {
  it("validates a good deck", () => {
    const r = validateDeck(makeSimpleDeck());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.cardCount).toBe(3);
  });
  it("fails for empty deck", () => {
    const r = validateDeck({ name: "X", cards: [] });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("at least 1 card");
    expect(r.cardCount).toBe(0);
  });
  it("fails for empty name", () => {
    const r = validateDeck({ name: "  ", cards: parseCards("a|1") });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("Deck name is required");
  });
  it("reports empty term or definition", () => {
    const cards = [
      makeCard("", "def", [], "medium", 0),
      makeCard("term", "", [], "medium", 1),
    ];
    const r = validateDeck({ name: "X", cards });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Card 1: term"))).toBe(true);
    expect(r.errors.some((e) => e.includes("Card 2: definition"))).toBe(true);
  });
});

describe("flashcard-maker shuffleCards (Fisher-Yates)", () => {
  it("returns a new array (does not mutate)", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleCards(input);
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
  it("preserves the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleCards(input);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("is deterministic with a seeded rng", () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out1 = shuffleCards(input, rng);
    seed = 12345;
    const out2 = shuffleCards(input, rng);
    expect(out1).toEqual(out2);
  });
  it("handles empty and single-element arrays", () => {
    expect(shuffleCards([])).toEqual([]);
    expect(shuffleCards([1])).toEqual([1]);
  });
});

describe("flashcard-maker sequential iterator", () => {
  it("nextIndex wraps around", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it("prevIndex wraps around", () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(1, 3)).toBe(0);
  });
  it("handles zero total", () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });
});

describe("flashcard-maker sm2Update (SM-2)", () => {
  it("first known answer: interval=1, repetitions=1", () => {
    const card = makeCard("a", "1", [], "medium", 0);
    const updated = sm2Update(card, true);
    expect(updated.repetitions).toBe(1);
    expect(updated.interval).toBe(1);
    expect(updated.seen).toBe(true);
    expect(updated.known).toBe(true);
  });
  it("second known answer: interval=6", () => {
    const card: Card = { ...makeCard("a", "1"), repetitions: 1, interval: 1 };
    const updated = sm2Update(card, true);
    expect(updated.repetitions).toBe(2);
    expect(updated.interval).toBe(6);
  });
  it("third known answer: interval = round(prev * ease)", () => {
    const card: Card = { ...makeCard("a", "1"), repetitions: 2, interval: 6, easeFactor: 2.5 };
    const updated = sm2Update(card, true);
    expect(updated.repetitions).toBe(3);
    expect(updated.interval).toBe(15); // round(6 * 2.5) = 15
  });
  it("unknown answer resets repetitions and interval", () => {
    const card: Card = { ...makeCard("a", "1"), repetitions: 3, interval: 15 };
    const updated = sm2Update(card, false);
    expect(updated.repetitions).toBe(0);
    expect(updated.interval).toBe(1);
    expect(updated.known).toBe(false);
  });
  it("ease factor decreases on unknown answer but never below 1.3", () => {
    const card: Card = { ...makeCard("a", "1"), easeFactor: 2.5 };
    const updated = sm2Update(card, false);
    expect(updated.easeFactor).toBeLessThan(2.5);
    // many wrong answers → still >= 1.3
    let c = card;
    for (let i = 0; i < 20; i++) c = sm2Update(c, false);
    expect(c.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it("does not mutate the original card", () => {
    const card = makeCard("a", "1");
    sm2Update(card, true);
    expect(card.repetitions).toBe(0);
    expect(card.seen).toBe(false);
  });
});

describe("flashcard-maker markCard", () => {
  it("marks known via sm2Update", () => {
    const card = makeCard("a", "1");
    const updated = markCard(card, true);
    expect(updated.known).toBe(true);
    expect(updated.repetitions).toBe(1);
  });
});

describe("flashcard-maker computeSessionStats", () => {
  it("computes stats from a fresh deck", () => {
    const deck = makeSimpleDeck();
    const stats = computeSessionStats(deck.cards);
    expect(stats.totalCards).toBe(3);
    expect(stats.seenCards).toBe(0);
    expect(stats.knownCount).toBe(0);
    expect(stats.unknownCount).toBe(0);
    expect(stats.unansweredCount).toBe(3);
    expect(stats.accuracy).toBe(0);
  });
  it("computes stats after answering", () => {
    const deck = makeSimpleDeck();
    const cards = [
      markCard(deck.cards[0], true),
      markCard(deck.cards[1], false),
      deck.cards[2],
    ];
    const stats = computeSessionStats(cards);
    expect(stats.seenCards).toBe(2);
    expect(stats.knownCount).toBe(1);
    expect(stats.unknownCount).toBe(1);
    expect(stats.unansweredCount).toBe(1);
    expect(stats.accuracy).toBe(50);
  });
});

describe("flashcard-maker computeSummaryStats", () => {
  it("computes summary including tags and difficulty", () => {
    const cards = parseCards("a|1|vocab|easy\nb|2|vocab,beginner|medium\nc|3|hard");
    const s = computeSummaryStats(cards);
    expect(s.totalCards).toBe(3);
    expect(s.byDifficulty.easy).toBe(1);
    expect(s.byDifficulty.medium).toBe(1);
    expect(s.byDifficulty.hard).toBe(1);
    expect(s.tagsCount).toBe(3);
    expect(s.uniqueTags).toBe(2); // vocab, beginner
  });
  it("accuracy is 0 when nothing answered", () => {
    const s = computeSummaryStats(parseCards("a|1"));
    expect(s.accuracy).toBe(0);
    expect(s.knownCount).toBe(0);
  });
});

describe("flashcard-maker renderers", () => {
  it("renderText uses em-dash separator", () => {
    const cards = parseCards("hola|hello\ngracias|thanks");
    expect(renderText(cards)).toBe("hola — hello\ngracias — thanks");
  });
  it("renderText empty", () => {
    expect(renderText([])).toBe("");
  });
  it("renderCsv has header", () => {
    expect(renderCsv([])).toBe("term,definition,tags,difficulty");
  });
  it("renderCsv outputs rows", () => {
    const csv = renderCsv(parseCards("hola|hello|greeting|easy"));
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("hola,hello,greeting,easy");
  });
  it("renderCsv escapes commas", () => {
    const csv = renderCsv([{ ...makeCard("hello, world", "greeting") }]);
    expect(csv).toContain('"hello, world"');
  });
  it("renderJson outputs valid JSON", () => {
    const deck = { name: "Test", cards: parseCards("hola|hello") };
    const json = renderJson(deck);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Test");
    expect(parsed.cards[0].term).toBe("hola");
  });
  it("renderSource round-trips through parseCards", () => {
    const cards = parseCards("hola|hello|greeting|easy\ngracias|thanks");
    const src = renderSource(cards);
    const reparsed = parseCards(src);
    expect(reparsed[0].term).toBe("hola");
    expect(reparsed[0].tags).toEqual(["greeting"]);
    expect(reparsed[0].difficulty).toBe("easy");
    expect(reparsed[1].term).toBe("gracias");
  });
});

describe("flashcard-maker filterCards", () => {
  it("returns all for empty query", () => {
    const cards = parseCards("a|1\nb|2");
    expect(filterCards(cards, "")).toHaveLength(2);
  });
  it("matches term or definition", () => {
    const cards = parseCards("apple|fruit\nbanana|yellow fruit");
    expect(filterCards(cards, "apple")).toHaveLength(1);
    expect(filterCards(cards, "fruit")).toHaveLength(2);
  });
  it("is case-insensitive", () => {
    const cards = parseCards("Apple|fruit");
    expect(filterCards(cards, "APPLE")).toHaveLength(1);
  });
  it("returns new array (does not mutate)", () => {
    const cards = parseCards("a|1");
    const filtered = filterCards(cards, "");
    expect(filtered).not.toBe(cards);
  });
});

describe("flashcard-maker reverseCards", () => {
  it("swaps term and definition", () => {
    const cards = parseCards("hola|hello");
    const reversed = reverseCards(cards);
    expect(reversed[0].term).toBe("hello");
    expect(reversed[0].definition).toBe("hola");
  });
  it("does not mutate original", () => {
    const cards = parseCards("hola|hello");
    reverseCards(cards);
    expect(cards[0].term).toBe("hola");
  });
});

describe("flashcard-maker tag/difficulty helpers", () => {
  it("addTag adds a tag", () => {
    const card = makeCard("a", "1");
    const withTag = addTag(card, "vocab");
    expect(withTag.tags).toEqual(["vocab"]);
  });
  it("addTag is idempotent", () => {
    const card = addTag(makeCard("a", "1"), "vocab");
    const again = addTag(card, "Vocab");
    expect(again.tags).toEqual(["vocab"]);
  });
  it("removeTag removes a tag", () => {
    const card = makeCard("a", "1", ["vocab", "basic"]);
    const out = removeTag(card, "vocab");
    expect(out.tags).toEqual(["basic"]);
  });
  it("setDifficulty changes difficulty", () => {
    const card = setDifficulty(makeCard("a", "1"), "hard");
    expect(card.difficulty).toBe("hard");
  });
});

describe("flashcard-maker getDeckPreset", () => {
  it("finds by id", () => {
    const p = getDeckPreset("spanish-vocab");
    expect(p).toBeDefined();
    expect(p!.name).toBe("Spanish Vocabulary");
  });
  it("returns undefined for unknown id", () => {
    expect(getDeckPreset("does-not-exist")).toBeUndefined();
  });
});

describe("flashcard-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, deckName: "Test", cardCount: 5, studyMode: "shuffled", accuracy: 80 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].deckName).toBe("Test");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, deckName: `Deck${i}`, cardCount: 1, studyMode: "sequential", accuracy: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, deckName: "X", cardCount: 1, studyMode: "sequential", accuracy: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("flashcard-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Spanish Vocab", "hola|hello", "shuffled");
    expect(url).toContain("name=Spanish+Vocab");
    expect(url).toContain("mode=shuffled");
    expect(url).toContain("d=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const cardsText = "hola|hello|greeting|easy\ngracias|thanks";
    const url = buildShareUrl("My Deck", cardsText, "spaced-repetition-simplified");
    // When window is undefined, buildShareUrl returns "?..."; parseShareUrl
    // accepts either '#' prefix, '?' prefix (URLSearchParams strips it), or
    // bare params. Extract the query portion after the first '?' or '#'.
    const sepIdx = Math.min(
      url.indexOf("#") === -1 ? Infinity : url.indexOf("#"),
      url.indexOf("?") === -1 ? Infinity : url.indexOf("?"),
    );
    const hash = sepIdx === Infinity ? url : url.slice(sepIdx + 1);
    const p = parseShareUrl(hash);
    expect(p.deckName).toBe("My Deck");
    expect(p.studyMode).toBe("spaced-repetition-simplified");
    expect(p.cardsText).toBe(cardsText);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.deckName).toBe("");
    expect(p.cardsText).toBe("");
    expect(p.studyMode).toBe("sequential");
  });
  it("defaults unknown mode to sequential", () => {
    const p = parseShareUrl("name=X&mode=unknown-mode&d=aA");
    expect(p.studyMode).toBe("sequential");
  });
});

// Suppress unused-import lint for type-only exports
export type _Unused = Card | Deck | Difficulty | StudyMode;
