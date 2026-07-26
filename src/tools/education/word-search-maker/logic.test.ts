import { describe, it, expect } from "vitest";
import {
  normalizeWord,
  validateWords,
  generatePuzzle,
  puzzleAsText,
  puzzleAsHTML,
  solutionKey,
  exportPuzzleCSV,
  letterFrequency,
  rateDifficulty,
  validateSize,
  buildAnswerMask,
  wordListString,
  findWord,
  fillPercentage,
  DIRECTIONS,
} from "./logic";

// Deterministic RNG for tests
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("word-search-maker normalizeWord", () => {
  it("uppercases and strips non-letters", () => {
    expect(normalizeWord("  hola!  ")).toBe("HOLA");
  });
  it("removes spaces in compound words", () => {
    expect(normalizeWord("New York")).toBe("NEWYORK");
  });
});

describe("word-search-maker validateWords", () => {
  it("rejects single-letter words", () => {
    const r = validateWords(["A", "BAT"], 10);
    expect(r.invalid.length).toBe(1);
    expect(r.valid).toEqual(["BAT"]);
  });
  it("rejects words longer than size", () => {
    const r = validateWords(["ABCDEFGHIJ"], 5);
    expect(r.invalid.length).toBe(1);
  });
});

describe("word-search-maker generatePuzzle", () => {
  it("places all words when size is sufficient", () => {
    const puzzle = generatePuzzle(["CAT", "DOG", "FISH"], 10, true, true, makeRng(42));
    expect(puzzle.placed.length).toBe(3);
    expect(puzzle.unplaced.length).toBe(0);
  });
  it("fills blanks by default", () => {
    const puzzle = generatePuzzle(["CAT"], 8, true, true, makeRng(7));
    const empty = puzzle.grid.flat().filter((c) => c === "");
    expect(empty.length).toBe(0);
  });
  it("leaves blanks when fillBlanks=false", () => {
    const puzzle = generatePuzzle(["CAT"], 8, true, false, makeRng(7));
    const empty = puzzle.grid.flat().filter((c) => c === "");
    expect(empty.length).toBeGreaterThan(0);
  });
  it("can place same word on a board", () => {
    const puzzle = generatePuzzle(["HELLO", "WORLD"], 12, true, true, makeRng(1));
    expect(puzzle.placed.length).toBe(2);
  });
});

describe("word-search-maker puzzleAsText", () => {
  it("returns rows separated by newline", () => {
    const puzzle = generatePuzzle(["CAT"], 5, true, true, makeRng(99));
    const txt = puzzleAsText(puzzle);
    expect(txt.split("\n").length).toBe(5);
  });
});

describe("word-search-maker puzzleAsHTML", () => {
  it("wraps in table tag", () => {
    const puzzle = generatePuzzle(["CAT"], 5, true, true, makeRng(2));
    const html = puzzleAsHTML(puzzle);
    expect(html).toContain("<table");
    expect(html).toContain("</table>");
  });
});

describe("word-search-maker solutionKey", () => {
  it("lists each word with row/col/direction", () => {
    const puzzle = generatePuzzle(["CAT", "DOG"], 8, true, true, makeRng(3));
    const key = solutionKey(puzzle);
    expect(key).toContain("CAT:");
    expect(key).toContain("DOG:");
  });
});

describe("word-search-maker exportPuzzleCSV", () => {
  it("has header plus one row per puzzle row", () => {
    const puzzle = generatePuzzle(["CAT"], 6, true, true, makeRng(4));
    const csv = exportPuzzleCSV(puzzle);
    const lines = csv.split("\n");
    expect(lines.length).toBe(7);
  });
});

describe("word-search-maker letterFrequency", () => {
  it("counts letters", () => {
    const puzzle = generatePuzzle(["CAT"], 5, true, true, makeRng(5));
    const freq = letterFrequency(puzzle);
    const total = Object.values(freq).reduce((s, n) => s + n, 0);
    expect(total).toBe(25);
  });
});

describe("word-search-maker rateDifficulty", () => {
  it("returns a difficulty label", () => {
    const puzzle = generatePuzzle(["CAT", "DOG", "FISH"], 8, true, true, makeRng(6));
    const label = rateDifficulty(puzzle, true);
    expect(["Easy", "Medium", "Hard", "Expert"]).toContain(label);
  });
});

describe("word-search-maker validateSize", () => {
  it("warns on size below 5", () => {
    expect(validateSize(3).some((w) => w.includes("5"))).toBe(true);
  });
  it("warns on size above 30", () => {
    expect(validateSize(50).some((w) => w.includes("30"))).toBe(true);
  });
  it("passes for 12", () => {
    expect(validateSize(12)).toEqual([]);
  });
});

describe("word-search-maker buildAnswerMask", () => {
  it("keeps only placed-word cells", () => {
    const puzzle = generatePuzzle(["CAT"], 6, true, true, makeRng(8));
    const mask = buildAnswerMask(puzzle);
    const total = mask.flat().filter((c) => c !== "_").length;
    expect(total).toBe(3);
  });
});

describe("word-search-maker wordListString", () => {
  it("normalizes and joins words", () => {
    expect(wordListString(["cat!", "dog"])).toBe("CAT, DOG");
  });
});

describe("word-search-maker findWord", () => {
  it("finds placed word by text", () => {
    const puzzle = generatePuzzle(["CAT", "DOG"], 8, true, true, makeRng(10));
    const f = findWord(puzzle, "cat");
    expect(f).not.toBeNull();
    expect(f!.word).toBe("CAT");
  });
  it("returns null for unplaced word", () => {
    const puzzle = generatePuzzle(["CAT"], 8, true, true, makeRng(10));
    expect(findWord(puzzle, "ELEPHANT")).toBeNull();
  });
});

describe("word-search-maker fillPercentage", () => {
  it("returns value between 0 and 100", () => {
    const puzzle = generatePuzzle(["CAT", "DOG", "FISH"], 8, true, true, makeRng(11));
    const pct = fillPercentage(puzzle);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

describe("word-search-maker DIRECTIONS", () => {
  it("has 8 directions", () => {
    expect(DIRECTIONS.length).toBe(8);
  });
});
