import { describe, it, expect } from "vitest";
import { parseCsv, exportAnki, exportQuizlet, exportCsv, exportJson, validateDeck } from "./logic";

describe("flashcard-importer parseCsv", () => {
  it("parses simple CSV without header", () => {
    const r = parseCsv("hello,world\nfoo,bar", false);
    expect(r.count).toBe(2);
    expect(r.cards[0].front).toBe("hello");
    expect(r.cards[0].back).toBe("world");
  });

  it("parses CSV with header", () => {
    const r = parseCsv("front,back,tags\nhello,world,greeting");
    expect(r.count).toBe(1);
    expect(r.cards[0].tags).toEqual(["greeting"]);
  });

  it("handles quoted fields with commas", () => {
    const r = parseCsv('"hello, there",world', false);
    expect(r.count).toBe(1);
    expect(r.cards[0].front).toBe("hello, there");
  });

  it("handles escaped quotes", () => {
    const r = parseCsv('"say ""hi""",world', false);
    expect(r.cards[0].front).toBe('say "hi"');
  });

  it("skips malformed lines", () => {
    const r = parseCsv("only-one-col\nfoo,bar", false);
    expect(r.errors.length).toBe(1);
    expect(r.count).toBe(1);
  });

  it("returns empty for empty input", () => {
    const r = parseCsv("");
    expect(r.count).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("flashcard-importer exportAnki", () => {
  it("exports TSV with tags", () => {
    const cards = [{ front: "hi", back: "hello", tags: ["greeting", "basic"] }];
    const out = exportAnki(cards);
    expect(out).toBe("hi\thello\tgreeting basic");
  });

  it("escapes tabs and newlines", () => {
    const cards = [{ front: "a\tb", back: "x\ny", tags: [] }];
    const out = exportAnki(cards);
    expect(out).not.toContain("\t");
  });
});

describe("flashcard-importer exportQuizlet", () => {
  it("exports TSV without tags", () => {
    const cards = [{ front: "hi", back: "hello", tags: ["ignored"] }];
    expect(exportQuizlet(cards)).toBe("hi\thello");
  });

  it("exports multiple cards separated by newlines", () => {
    const cards = [
      { front: "a", back: "1", tags: [] },
      { front: "b", back: "2", tags: [] },
    ];
    expect(exportQuizlet(cards).split("\n").length).toBe(2);
  });
});

describe("flashcard-importer exportCsv", () => {
  it("exports CSV with header", () => {
    const cards = [{ front: "hi", back: "hello", tags: ["greeting"] }];
    const out = exportCsv(cards);
    expect(out.split("\n")[0]).toBe("front,back,tags");
    expect(out).toContain('"greeting"');
  });

  it("quotes fields containing commas", () => {
    const cards = [{ front: "a,b", back: "c", tags: [] }];
    const out = exportCsv(cards);
    expect(out).toContain('"a,b"');
  });
});

describe("flashcard-importer exportJson", () => {
  it("exports valid JSON", () => {
    const cards = [{ front: "hi", back: "hello", tags: ["g"] }];
    const out = exportJson(cards);
    const parsed = JSON.parse(out);
    expect(parsed[0].front).toBe("hi");
  });
});

describe("flashcard-importer validateDeck", () => {
  it("flags empty deck", () => {
    const issues = validateDeck({ cards: [], errors: ["Empty"], count: 0 });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("returns no issues for clean deck", () => {
    const issues = validateDeck({ cards: [{ front: "a", back: "b", tags: [] }], errors: [], count: 1 });
    expect(issues).toEqual([]);
  });
});
