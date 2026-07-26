import { describe, it, expect } from "vitest";
import {
  normalizeWord,
  generateClue,
  generateClues,
  pickHintType,
  guessDefinition,
  buildClueText,
  buildHint,
  buildLetterPattern,
  shuffleWord,
  countVowels,
  validateEntry,
  exportCluesCSV,
  exportCluesText,
  filterByDifficulty,
  sortCluesAlpha,
  sortCluesByLength,
  solveDifficultyScore,
  groupByHintType,
  makeFillInBlank,
  type WordEntry,
  type Clue,
} from "./logic";

describe("crossword-clue-gen normalizeWord", () => {
  it("uppercases and strips non-letters", () => {
    expect(normalizeWord("  hello!  ")).toBe("HELLO");
  });
});

describe("crossword-clue-gen guessDefinition", () => {
  it("uses category when provided", () => {
    expect(guessDefinition("CAT", "Animal")).toContain("Animal");
  });
  it("mentions letter count when no category", () => {
    expect(guessDefinition("CAT")).toContain("3 letters");
  });
});

describe("crossword-clue-gen pickHintType", () => {
  it("returns easy types for easy difficulty", () => {
    const t = pickHintType("easy");
    expect(["definition", "fill-in-blank", "category"]).toContain(t);
  });
  it("returns hard types for hard difficulty", () => {
    const t = pickHintType("hard");
    expect(["letter-pattern", "anagram", "definition"]).toContain(t);
  });
});

describe("crossword-clue-gen buildClueText", () => {
  it("includes letter count for definition hint", () => {
    const txt = buildClueText("CAT", "Feline", "definition", "easy");
    expect(txt).toContain("3 letters");
  });
  it("includes underscores for fill-in-blank", () => {
    const txt = buildClueText("CAT", "Feline", "fill-in-blank", "easy");
    expect(txt).toContain("___");
  });
});

describe("crossword-clue-gen buildHint", () => {
  it("reveals first and last letter", () => {
    const h = buildHint("CAT", "definition");
    expect(h).toContain("C");
    expect(h).toContain("T");
  });
  it("anagram hint contains sorted letters", () => {
    const h = buildHint("CAT", "anagram");
    expect(h).toContain("ACT");
  });
});

describe("crossword-clue-gen buildLetterPattern", () => {
  it("reveals first and last letter", () => {
    expect(buildLetterPattern("HELLO")).toBe("H _ _ _ O");
  });
});

describe("crossword-clue-gen shuffleWord", () => {
  it("returns same letters in different order (or reversed if same)", () => {
    const orig = "HELLO";
    const shuf = shuffleWord(orig);
    expect(shuf.length).toBe(orig.length);
    expect(shuf.split("").sort().join("")).toBe(orig.split("").sort().join(""));
  });
});

describe("crossword-clue-gen countVowels", () => {
  it("counts vowels correctly", () => {
    expect(countVowels("HELLO")).toBe(2);
    expect(countVowels("QUEUE")).toBe(4);
  });
});

describe("crossword-clue-gen validateEntry", () => {
  it("warns on short word", () => {
    const w = validateEntry({ word: "A" });
    expect(w.some((x) => x.includes("2 letters"))).toBe(true);
  });
  it("warns on too-long word", () => {
    const w = validateEntry({ word: "A".repeat(25) });
    expect(w.some((x) => x.includes("20 letters"))).toBe(true);
  });
  it("passes for valid word", () => {
    expect(validateEntry({ word: "Elephant" })).toEqual([]);
  });
});

describe("crossword-clue-gen generateClue", () => {
  it("returns a clue object with word and length", () => {
    const c = generateClue({ word: "Cat", customDefinition: "Feline pet" }, "medium");
    expect(c.word).toBe("CAT");
    expect(c.length).toBe(3);
    expect(c.clue.length).toBeGreaterThan(0);
  });
});

describe("crossword-clue-gen generateClues", () => {
  it("generates one clue per entry", () => {
    const entries: WordEntry[] = [{ word: "Cat" }, { word: "Dog" }, { word: "Fish" }];
    const clues = generateClues(entries, "easy");
    expect(clues.length).toBe(3);
  });
});

describe("crossword-clue-gen exportCluesCSV", () => {
  it("has header + one row per clue", () => {
    const clues = generateClues([{ word: "Cat" }, { word: "Dog" }], "easy");
    const csv = exportCluesCSV(clues);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("word,clue,hint");
  });
});

describe("crossword-clue-gen exportCluesText", () => {
  it("numbers each clue", () => {
    const clues = generateClues([{ word: "Cat" }, { word: "Dog" }], "easy");
    const txt = exportCluesText(clues);
    expect(txt).toContain("1.");
    expect(txt).toContain("2.");
  });
});

describe("crossword-clue-gen filterByDifficulty", () => {
  it("filters by difficulty level", () => {
    const clues: Clue[] = [
      { word: "CAT", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 3 },
      { word: "DOG", clue: "x", hint: "y", difficulty: "hard", hintType: "anagram", length: 3 },
    ];
    expect(filterByDifficulty(clues, "easy").length).toBe(1);
  });
});

describe("crossword-clue-gen sortCluesAlpha", () => {
  it("sorts alphabetically", () => {
    const clues: Clue[] = [
      { word: "ZEBRA", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 5 },
      { word: "APPLE", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 5 },
    ];
    const sorted = sortCluesAlpha(clues);
    expect(sorted[0].word).toBe("APPLE");
  });
});

describe("crossword-clue-gen sortCluesByLength", () => {
  it("sorts by length ascending", () => {
    const clues: Clue[] = [
      { word: "ELEPHANT", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 8 },
      { word: "CAT", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 3 },
    ];
    const sorted = sortCluesByLength(clues);
    expect(sorted[0].length).toBe(3);
  });
});

describe("crossword-clue-gen solveDifficultyScore", () => {
  it("returns score 0-100", () => {
    const clues = generateClues([{ word: "Cat" }, { word: "Dog" }], "medium");
    const s = solveDifficultyScore(clues);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("crossword-clue-gen groupByHintType", () => {
  it("groups clues by hint type", () => {
    const clues: Clue[] = [
      { word: "A", clue: "x", hint: "y", difficulty: "easy", hintType: "definition", length: 1 },
      { word: "B", clue: "x", hint: "y", difficulty: "easy", hintType: "anagram", length: 1 },
    ];
    const g = groupByHintType(clues);
    expect(g.definition.length).toBe(1);
    expect(g.anagram.length).toBe(1);
  });
});

describe("crossword-clue-gen makeFillInBlank", () => {
  it("creates a fill-in-blank clue", () => {
    const c = makeFillInBlank("CAT", "Feline");
    expect(c.hintType).toBe("fill-in-blank");
    expect(c.clue).toContain("___");
  });
});
