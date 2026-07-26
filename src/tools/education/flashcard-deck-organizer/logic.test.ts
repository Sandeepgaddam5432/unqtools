import { describe, it, expect } from "vitest";
import {
  createDeck,
  createCard,
  addCard,
  removeCard,
  updateCard,
  searchCards,
  getDueCards,
  reviewCard,
  deckStats,
  exportDeckAsCSV,
  exportDeckAsAnki,
  exportDeckAsJSON,
  importFromCSV,
  validateCard,
  sortByDue,
  resetProgress,
  tagFrequency,
  forecastReviewLoad,
  buildStudySession,
  type Deck,
  type Flashcard,
} from "./logic";

function buildDeck(): Deck {
  let d = createDeck("Spanish Vocab", "Common words");
  d = addCard(d, createCard("Hola", "Hello", ["greeting", "basic"]));
  d = addCard(d, createCard("Adiós", "Goodbye", ["greeting"]));
  d = addCard(d, createCard("Perro", "Dog", ["animal"]));
  return d;
}

describe("flashcard-deck-organizer createDeck", () => {
  it("creates a deck with name and no cards", () => {
    const d = createDeck("Test");
    expect(d.name).toBe("Test");
    expect(d.cards).toEqual([]);
  });
  it("defaults name when empty", () => {
    expect(createDeck("").name).toBe("Untitled deck");
  });
});

describe("flashcard-deck-organizer createCard", () => {
  it("creates a card with default ease 2.5", () => {
    const c = createCard("Q", "A");
    expect(c.ease).toBe(2.5);
    expect(c.repetitions).toBe(0);
  });
});

describe("flashcard-deck-organizer addCard", () => {
  it("adds a card without mutating original", () => {
    const d = buildDeck();
    const before = d.cards.length;
    const d2 = addCard(d, createCard("Gato", "Cat"));
    expect(d.cards.length).toBe(before);
    expect(d2.cards.length).toBe(before + 1);
  });
});

describe("flashcard-deck-organizer removeCard", () => {
  it("removes a card by id", () => {
    const d = buildDeck();
    const id = d.cards[0].id;
    const d2 = removeCard(d, id);
    expect(d2.cards.find((c) => c.id === id)).toBeUndefined();
  });
});

describe("flashcard-deck-organizer updateCard", () => {
  it("updates a card by id", () => {
    const d = buildDeck();
    const id = d.cards[0].id;
    const d2 = updateCard(d, id, { front: "Buenos días" });
    expect(d2.cards[0].front).toBe("Buenos días");
  });
});

describe("flashcard-deck-organizer searchCards", () => {
  it("finds by front text", () => {
    const d = buildDeck();
    expect(searchCards(d, "Hola").length).toBe(1);
  });
  it("finds by tag", () => {
    const d = buildDeck();
    expect(searchCards(d, "greeting").length).toBe(2);
  });
  it("returns all when query empty", () => {
    const d = buildDeck();
    expect(searchCards(d, "").length).toBe(3);
  });
});

describe("flashcard-deck-organizer getDueCards", () => {
  it("returns all cards when none reviewed", () => {
    const d = buildDeck();
    expect(getDueCards(d).length).toBe(3);
  });
  it("excludes cards due in future", () => {
    let d = buildDeck();
    const future = Date.now() + 7 * 24 * 60 * 60 * 1000;
    d = updateCard(d, d.cards[0].id, { dueAt: future });
    expect(getDueCards(d).length).toBe(2);
  });
});

describe("flashcard-deck-organizer reviewCard", () => {
  it("resets on quality < 3", () => {
    const c = createCard("Q", "A");
    const reviewed = reviewCard(c, 1);
    expect(reviewed.repetitions).toBe(0);
    expect(reviewed.intervalDays).toBe(1);
  });
  it("advances interval on quality 4", () => {
    let c = createCard("Q", "A");
    c = reviewCard(c, 4);
    expect(c.repetitions).toBe(1);
    expect(c.intervalDays).toBe(1);
    c = reviewCard(c, 4);
    expect(c.intervalDays).toBe(6);
  });
  it("ease never goes below 1.3", () => {
    let c = createCard("Q", "A");
    for (let i = 0; i < 10; i++) c = reviewCard(c, 0);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe("flashcard-deck-organizer deckStats", () => {
  it("returns total and avgEase", () => {
    const d = buildDeck();
    const s = deckStats(d);
    expect(s.total).toBe(3);
    expect(s.avgEase).toBeCloseTo(2.5, 2);
  });
  it("returns unique tags", () => {
    const d = buildDeck();
    const s = deckStats(d);
    expect(s.tags).toContain("greeting");
    expect(s.tags).toContain("animal");
  });
});

describe("flashcard-deck-organizer exportDeckAsCSV", () => {
  it("has header plus one row per card", () => {
    const d = buildDeck();
    const csv = exportDeckAsCSV(d);
    const lines = csv.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("id,front,back");
  });
});

describe("flashcard-deck-organizer exportDeckAsAnki", () => {
  it("outputs tab-separated front\\tback\\ttags", () => {
    const d = buildDeck();
    const tsv = exportDeckAsAnki(d);
    const first = tsv.split("\n")[0];
    expect(first.split("\t").length).toBe(3);
  });
});

describe("flashcard-deck-organizer exportDeckAsJSON", () => {
  it("outputs valid JSON", () => {
    const d = buildDeck();
    const json = exportDeckAsJSON(d);
    const parsed = JSON.parse(json);
    expect(parsed.cards.length).toBe(3);
  });
});

describe("flashcard-deck-organizer importFromCSV", () => {
  it("imports cards from CSV body", () => {
    const csv = "front,back,tags\nHola,Hello,greeting\nPerro,Dog,animal";
    const cards = importFromCSV(csv);
    expect(cards.length).toBe(2);
    expect(cards[0].front).toBe("Hola");
  });
  it("returns empty for header-only CSV", () => {
    expect(importFromCSV("front,back,tags")).toEqual([]);
  });
});

describe("flashcard-deck-organizer validateCard", () => {
  it("warns on empty front", () => {
    expect(validateCard("", "A").some((w) => w.includes("Front"))).toBe(true);
  });
  it("warns on very long back", () => {
    expect(validateCard("Q", "x".repeat(1100)).some((w) => w.includes("long"))).toBe(true);
  });
});

describe("flashcard-deck-organizer sortByDue", () => {
  it("sorts ascending by dueAt", () => {
    const d = buildDeck();
    const sorted = sortByDue(d);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].dueAt).toBeGreaterThanOrEqual(sorted[i - 1].dueAt);
    }
  });
});

describe("flashcard-deck-organizer resetProgress", () => {
  it("resets ease to 2.5", () => {
    let d = buildDeck();
    d = updateCard(d, d.cards[0].id, { ease: 1.5, repetitions: 5 });
    const r = resetProgress(d);
    expect(r.cards[0].ease).toBe(2.5);
    expect(r.cards[0].repetitions).toBe(0);
  });
});

describe("flashcard-deck-organizer tagFrequency", () => {
  it("counts tag occurrences", () => {
    const d = buildDeck();
    const freq = tagFrequency(d);
    expect(freq["greeting"]).toBe(2);
    expect(freq["animal"]).toBe(1);
  });
});

describe("flashcard-deck-organizer forecastReviewLoad", () => {
  it("returns array of N days", () => {
    const d = buildDeck();
    const f = forecastReviewLoad(d, 7);
    expect(f.length).toBe(7);
  });
});

describe("flashcard-deck-organizer buildStudySession", () => {
  it("returns up to maxCards due cards", () => {
    const d = buildDeck();
    const session = buildStudySession(d, 2);
    expect(session.length).toBe(2);
  });
});
