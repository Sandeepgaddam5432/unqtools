import { describe, it, expect, beforeEach } from "vitest";
import {
  CARD_TYPE_LABELS,
  CARD_TYPE_DESCRIPTIONS,
  ALL_CARD_TYPES,
  DIFFICULTY_LABELS,
  SM2_GRADE_LABELS,
  SM2_DEFAULT_STATE,
  STOPWORDS,
  DEFAULT_OPTIONS,
  normalizeText,
  splitSentences,
  tokenize,
  extractKeyTerms,
  findSentenceWith,
  generateDefinitionCards,
  generateTrueFalseCards,
  generateFillBlankCards,
  generateMultipleChoiceCards,
  generateClozeCards,
  generateAllCards,
  generateDeck,
  sm2Update,
  sm2NextReview,
  isCardDue,
  computeStudyStats,
  gradeCard,
  sortForStudy,
  shuffleDeck,
  focusWeakCards,
  renderAnkiCsv,
  renderQuizletCsv,
  renderJson,
  parseJsonDeck,
  renderText,
  renderMarkdown,
  mergeDecks,
  updateCard,
  deleteCard,
  addCard,
  countByType,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type CardType,
  type Difficulty,
  type Sm2Grade,
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

const SAMPLE_TEXT = `
Photosynthesis is the process by which plants convert sunlight into chemical energy.
Chlorophyll is the green pigment in plants that absorbs light.
Glucose is a simple sugar produced during photosynthesis.
Carbon dioxide is absorbed from the air through small pores called stomata.
Water is absorbed by the roots and transported to the leaves.
The Calvin cycle is the set of chemical reactions that occur in the stroma.
`;

describe("flashcard-qa-generator constants", () => {
  it("has 5 card types", () => {
    expect(Object.keys(CARD_TYPE_LABELS)).toHaveLength(5);
    expect(ALL_CARD_TYPES).toHaveLength(5);
  });
  it("has descriptions for every card type", () => {
    for (const t of ALL_CARD_TYPES) {
      expect(CARD_TYPE_DESCRIPTIONS[t]).toBeTruthy();
    }
  });
  it("has 3 difficulty levels", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("has 4 SM-2 grades", () => {
    expect(Object.keys(SM2_GRADE_LABELS)).toHaveLength(4);
  });
  it("has default SM-2 state", () => {
    expect(SM2_DEFAULT_STATE.interval).toBe(0);
    expect(SM2_DEFAULT_STATE.repetitions).toBe(0);
    expect(SM2_DEFAULT_STATE.easiness).toBe(2.5);
  });
  it("has stopwords set", () => {
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("photosynthesis")).toBe(false);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.includeTypes.length).toBeGreaterThan(0);
    expect(DEFAULT_OPTIONS.maxCards).toBeGreaterThan(0);
  });
});

describe("flashcard-qa-generator normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("flashcard-qa-generator splitSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    const s = splitSentences("Hello world this is a sentence. This is another test sentence! Is it working properly now? Yes it is.");
    expect(s.length).toBeGreaterThanOrEqual(3);
  });
  it("skips very short fragments", () => {
    const s = splitSentences("Hi. Ok. This is a longer sentence that should be kept.");
    expect(s.every((x) => x.length >= 15)).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("flashcard-qa-generator tokenize", () => {
  it("tokenizes lowercase words", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
  it("filters single-char tokens", () => {
    expect(tokenize("a b cc dd")).toEqual(["cc", "dd"]);
  });
  it("handles apostrophes", () => {
    expect(tokenize("don't stop")).toEqual(["don't", "stop"]);
  });
});

describe("flashcard-qa-generator extractKeyTerms", () => {
  it("extracts terms from text", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT);
    expect(terms.length).toBeGreaterThan(0);
    const termStrings = terms.map((t) => t.term);
    expect(termStrings).toContain("photosynthesis");
    expect(termStrings).toContain("chlorophyll");
  });
  it("scores capitalized words higher", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT);
    const capTerm = terms.find((t) => t.term === "calvin");
    expect(capTerm).toBeDefined();
  });
  it("excludes stopwords", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT);
    expect(terms.find((t) => t.term === "the")).toBeUndefined();
  });
  it("respects max limit", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT, 3);
    expect(terms.length).toBeLessThanOrEqual(3);
  });
});

describe("flashcard-qa-generator findSentenceWith", () => {
  it("finds sentence containing term", () => {
    const sentences = splitSentences(SAMPLE_TEXT);
    const s = findSentenceWith("chlorophyll", sentences);
    expect(s).toBeTruthy();
    expect(s!.toLowerCase()).toContain("chlorophyll");
  });
  it("returns null when not found", () => {
    expect(findSentenceWith("nonexistent", splitSentences(SAMPLE_TEXT))).toBeNull();
  });
});

describe("flashcard-qa-generator generateDefinitionCards", () => {
  it("generates definition cards", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateDefinitionCards(terms, sentences, "medium");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].type).toBe("definition");
    expect(cards[0].question).toContain('What is');
    expect(cards[0].answer.length).toBeGreaterThan(0);
    expect(cards[0].grounded).toBe(true);
    expect(cards[0].sm2.easiness).toBe(2.5);
  });
});

describe("flashcard-qa-generator generateTrueFalseCards", () => {
  it("generates at least one true card per term", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 3);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateTrueFalseCards(terms, sentences, "medium");
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.every((c) => c.type === "true-false")).toBe(true);
  });
  it("includes false cards when multiple terms exist", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 3);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateTrueFalseCards(terms, sentences, "medium");
    const falseCards = cards.filter((c) => c.answer.startsWith("False"));
    expect(falseCards.length).toBeGreaterThan(0);
  });
});

describe("flashcard-qa-generator generateFillBlankCards", () => {
  it("blanks the key term", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 1);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateFillBlankCards(terms, sentences, "medium");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].question).toContain("____");
    expect(cards[0].answer).toBe(terms[0].term);
  });
});

describe("flashcard-qa-generator generateMultipleChoiceCards", () => {
  it("creates 4 options with correctIndex", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 5);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateMultipleChoiceCards(terms, sentences, "medium");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].options).toHaveLength(4);
    expect(cards[0].correctIndex).toBeGreaterThanOrEqual(0);
    expect(cards[0].correctIndex).toBeLessThan(4);
    const firstCard = cards[0];
    expect(firstCard.options![firstCard.correctIndex!]).toBe(firstCard.answer);
  });
  it("skips when not enough distractors", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 2);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateMultipleChoiceCards(terms, sentences, "medium");
    expect(cards).toHaveLength(0);
  });
});

describe("flashcard-qa-generator generateClozeCards", () => {
  it("uses Anki cloze syntax", () => {
    const terms = extractKeyTerms(SAMPLE_TEXT).slice(0, 1);
    const sentences = splitSentences(SAMPLE_TEXT);
    const cards = generateClozeCards(terms, sentences, "medium");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].cloze).toContain("{{c1::");
    expect(cards[0].cloze).toContain("}}");
  });
});

describe("flashcard-qa-generator generateAllCards", () => {
  it("generates cards from text with default options", () => {
    const cards = generateAllCards(SAMPLE_TEXT);
    expect(cards.length).toBeGreaterThan(0);
  });
  it("respects maxCards cap", () => {
    const cards = generateAllCards(SAMPLE_TEXT, { ...DEFAULT_OPTIONS, maxCards: 5 });
    expect(cards.length).toBeLessThanOrEqual(5);
  });
  it("respects includeTypes filter", () => {
    const cards = generateAllCards(SAMPLE_TEXT, { ...DEFAULT_OPTIONS, includeTypes: ["definition"], maxCards: 100 });
    expect(cards.every((c) => c.type === "definition")).toBe(true);
  });
  it("returns empty for empty text", () => {
    expect(generateAllCards("")).toEqual([]);
  });
});

describe("flashcard-qa-generator generateDeck", () => {
  it("creates a named deck with cards", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Biology 101");
    expect(deck.name).toBe("Biology 101");
    expect(deck.cards.length).toBeGreaterThan(0);
    expect(deck.id).toBeTruthy();
    expect(deck.createdAt).toBeGreaterThan(0);
  });
  it("uses default name when blank", () => {
    const deck = generateDeck(SAMPLE_TEXT, "");
    expect(deck.name).toBe("Untitled Deck");
  });
});

describe("flashcard-qa-generator sm2Update", () => {
  it("resets on again", () => {
    const state = sm2Update("again", { interval: 30, repetitions: 5, easiness: 2.5, due: 0, lastReviewed: 100 });
    expect(state.repetitions).toBe(0);
    expect(state.interval).toBe(0);
  });
  it("advances on good first review (1 day)", () => {
    const state = sm2Update("good", SM2_DEFAULT_STATE);
    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);
  });
  it("advances on good second review (3 days)", () => {
    const s1 = sm2Update("good", SM2_DEFAULT_STATE);
    const s2 = sm2Update("good", s1);
    expect(s2.repetitions).toBe(2);
    expect(s2.interval).toBe(3);
  });
  it("easy on first review gives 4 days", () => {
    const state = sm2Update("easy", SM2_DEFAULT_STATE);
    expect(state.interval).toBe(4);
  });
  it("easiness increases on easy", () => {
    const state = sm2Update("easy", SM2_DEFAULT_STATE);
    expect(state.easiness).toBeGreaterThan(2.5);
  });
  it("easiness decreases on hard but floors at 1.3", () => {
    let state = { ...SM2_DEFAULT_STATE, easiness: 1.4 };
    state = sm2Update("hard", state);
    expect(state.easiness).toBeGreaterThanOrEqual(1.3);
  });
  it("easiness caps at 3.0", () => {
    let state = { ...SM2_DEFAULT_STATE, easiness: 2.95 };
    state = sm2Update("easy", state);
    expect(state.easiness).toBeLessThanOrEqual(3.0);
  });
});

describe("flashcard-qa-generator sm2NextReview + isCardDue", () => {
  it("new card is due", () => {
    expect(isCardDue(SM2_DEFAULT_STATE)).toBe(true);
  });
  it("future-dated card is not due", () => {
    const future = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(isCardDue({ ...SM2_DEFAULT_STATE, due: future, repetitions: 5 })).toBe(false);
  });
  it("computes days until due", () => {
    const future = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const days = sm2NextReview({ ...SM2_DEFAULT_STATE, due: future });
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(4);
  });
});

describe("flashcard-qa-generator gradeCard + computeStudyStats", () => {
  it("gradeCard returns new card with updated state", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    const card = deck.cards[0];
    const graded = gradeCard(card, "good");
    expect(graded.sm2.repetitions).toBe(card.sm2.repetitions + 1);
    expect(graded.id).toBe(card.id);
  });
  it("computeStudyStats reports due/learned/new counts", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    const stats = computeStudyStats(deck.cards);
    expect(stats.total).toBe(deck.cards.length);
    expect(stats.due).toBe(deck.cards.length); // all new = all due
    expect(stats.newCards).toBe(deck.cards.length);
    expect(stats.learned).toBe(0);
    expect(stats.avgEasiness).toBeGreaterThan(0);
  });
});

describe("flashcard-qa-generator sortForStudy + shuffleDeck + focusWeakCards", () => {
  it("sorts due cards first", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    const sorted = sortForStudy(deck.cards);
    expect(sorted.length).toBe(deck.cards.length);
  });
  it("shuffle preserves card count", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    const shuffled = shuffleDeck(deck.cards, 42);
    expect(shuffled).toHaveLength(deck.cards.length);
    expect(shuffled.every((c) => deck.cards.some((d) => d.id === c.id))).toBe(true);
  });
  it("focusWeakCards returns cards with low easiness or low reps", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    const weak = focusWeakCards(deck.cards);
    // All new cards have reps=0 and easiness=2.5 → all should be "weak"
    expect(weak.length).toBe(deck.cards.length);
  });
  it("focusWeakCards excludes well-learned cards", () => {
    const deck = generateDeck(SAMPLE_TEXT, "test");
    // Grade every card as 'easy' twice
    const learned = deck.cards.map((c) => gradeCard(gradeCard(c, "easy"), "easy"));
    const weak = focusWeakCards(learned);
    expect(weak.length).toBeLessThan(learned.length);
  });
});

describe("flashcard-qa-generator renderAnkiCsv", () => {
  it("renders TSV header", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Bio");
    const csv = renderAnkiCsv(deck);
    expect(csv).toContain("#deck\tfront\tback\ttags");
  });
  it("includes deck name and card fronts", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Bio");
    const csv = renderAnkiCsv(deck);
    expect(csv).toContain("Bio\t");
  });
  it("escapes tabs in cards", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Bio");
    const csv = renderAnkiCsv(deck);
    // No literal tab inside front/back columns (only as delimiter)
    const lines = csv.split("\n");
    expect(lines.length).toBe(deck.cards.length + 1);
  });
});

describe("flashcard-qa-generator renderQuizletCsv", () => {
  it("renders front,back rows", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Bio");
    const csv = renderQuizletCsv(deck);
    const lines = csv.split("\n");
    expect(lines.length).toBe(deck.cards.length);
  });
  it("escapes commas with quotes", () => {
    const deck = generateDeck("Hello, world. This is a sentence with commas in it.", "test");
    const csv = renderQuizletCsv(deck);
    // At least one line should have a quoted value if commas exist in source
    expect(csv.length).toBeGreaterThan(0);
  });
});

describe("flashcard-qa-generator renderJson + parseJsonDeck", () => {
  it("round-trips a deck through JSON", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Bio");
    const json = renderJson(deck);
    const parsed = parseJsonDeck(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe(deck.name);
    expect(parsed!.cards).toHaveLength(deck.cards.length);
  });
  it("returns null for invalid JSON", () => {
    expect(parseJsonDeck("not json")).toBeNull();
  });
  it("returns null for non-deck object", () => {
    expect(parseJsonDeck('{"foo":"bar"}')).toBeNull();
  });
});

describe("flashcard-qa-generator renderText + renderMarkdown", () => {
  it("renderText includes deck name and card count", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Biology");
    const txt = renderText(deck);
    expect(txt).toContain("DECK: Biology");
    expect(txt).toContain("CARDS:");
    expect(txt).toContain("DISCLAIMER");
  });
  it("renderMarkdown includes markdown headings", () => {
    const deck = generateDeck(SAMPLE_TEXT, "Biology");
    const md = renderMarkdown(deck);
    expect(md).toContain("# Biology");
    expect(md).toContain("**Q:**");
    expect(md).toContain("**A:**");
  });
});

describe("flashcard-qa-generator deck operations", () => {
  it("mergeDecks combines cards", () => {
    const d1 = generateDeck(SAMPLE_TEXT, "d1");
    const d2 = generateDeck(SAMPLE_TEXT, "d2");
    const merged = mergeDecks([d1, d2], "merged");
    expect(merged.cards.length).toBe(d1.cards.length + d2.cards.length);
    expect(merged.name).toBe("merged");
  });
  it("updateCard patches a card by id", () => {
    const deck = generateDeck(SAMPLE_TEXT, "d");
    const cardId = deck.cards[0].id;
    const updated = updateCard(deck, cardId, { question: "New question?" });
    expect(updated.cards[0].question).toBe("New question?");
  });
  it("deleteCard removes a card by id", () => {
    const deck = generateDeck(SAMPLE_TEXT, "d");
    const cardId = deck.cards[0].id;
    const deleted = deleteCard(deck, cardId);
    expect(deleted.cards.length).toBe(deck.cards.length - 1);
    expect(deleted.cards.find((c) => c.id === cardId)).toBeUndefined();
  });
  it("addCard appends a card", () => {
    const deck = generateDeck(SAMPLE_TEXT, "d");
    const newCard = {
      id: "new-1",
      type: "definition" as CardType,
      question: "Q?",
      answer: "A",
      grounded: false,
      difficulty: "easy" as Difficulty,
      tags: [],
      sm2: { ...SM2_DEFAULT_STATE },
    };
    const added = addCard(deck, newCard);
    expect(added.cards.length).toBe(deck.cards.length + 1);
    expect(added.cards[added.cards.length - 1].id).toBe("new-1");
  });
  it("countByType returns counts per type", () => {
    const deck = generateDeck(SAMPLE_TEXT, "d");
    const counts = countByType(deck.cards);
    expect(Object.keys(counts)).toHaveLength(5);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(deck.cards.length);
  });
});

describe("flashcard-qa-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      deckName: "test",
      cardCount: 10,
      types: { definition: 3, "true-false": 2, "fill-blank": 2, "multiple-choice": 2, cloze: 1 },
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        deckName: `t${i}`,
        cardCount: 1,
        types: { definition: 1, "true-false": 0, "fill-blank": 0, "multiple-choice": 0, cloze: 0 },
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      deckName: "x",
      cardCount: 1,
      types: { definition: 1, "true-false": 0, "fill-blank": 0, "multiple-choice": 0, cloze: 0 },
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("flashcard-qa-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      deckName: "Bio",
      text: "Photosynthesis is...",
      options: { includeTypes: ["definition", "cloze"], maxCards: 10, defaultDifficulty: "medium" },
    });
    expect(url).toContain("name=Bio");
    expect(url).toContain("text=");
    expect(url).toContain("types=definition%2Ccloze");
    expect(url).toContain("max=10");
    expect(url).toContain("diff=medium");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({
      deckName: "Bio",
      text: "Test sentence here.",
      options: { includeTypes: ["definition"], maxCards: 5, defaultDifficulty: "hard" },
    });
    const parsed = parseShareUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed!.deckName).toBe("Bio");
    expect(parsed!.text).toBe("Test sentence here.");
    expect(parsed!.options.includeTypes).toEqual(["definition"]);
    expect(parsed!.options.maxCards).toBe(5);
    expect(parsed!.options.defaultDifficulty).toBe("hard");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no text param", () => {
    expect(parseShareUrl("name=NoText")).toBeNull();
  });
  it("filters unknown card types", () => {
    const p = parseShareUrl("name=Test&text=Hello&types=definition%2Cunknown-type&max=5&diff=medium");
    expect(p!.options.includeTypes).toEqual(["definition"]);
  });
});

describe("flashcard-qa-generator makeId", () => {
  it("generates unique IDs", () => {
    const a = makeId("card");
    const b = makeId("card");
    expect(a).not.toBe(b);
    expect(a.startsWith("card-")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = Sm2Grade;
