import { describe, it, expect } from "vitest";
import {
  caesarDecrypt,
  caesarEncrypt,
  bruteForce,
  scoreEnglish,
  bestGuess,
  formatResults,
} from "./logic";

describe("caesarDecrypt / caesarEncrypt", () => {
  it("decrypts ROT3 of A back to X", () => {
    expect(caesarDecrypt("D", 3)).toBe("A");
  });

  it("encrypts A with shift 3 to D", () => {
    expect(caesarEncrypt("A", 3)).toBe("D");
  });

  it("round-trips encrypt/decrypt", () => {
    const s = "Hello, World!";
    expect(caesarDecrypt(caesarEncrypt(s, 7), 7)).toBe(s);
  });

  it("preserves non-letters", () => {
    expect(caesarEncrypt("Hi! 42", 1)).toBe("Ij! 42");
  });
});

describe("bruteForce", () => {
  it("returns 25 candidates", () => {
    expect(bruteForce("xyz").length).toBe(25);
  });

  it("shifts run 1..25", () => {
    const all = bruteForce("A");
    expect(all[0].shift).toBe(1);
    expect(all[24].shift).toBe(25);
  });

  it("includes a shift that recovers the plaintext", () => {
    const cipher = caesarEncrypt("HELLO", 3);
    const all = bruteForce(cipher);
    expect(all.find((r) => r.shift === 3)?.plaintext).toBe("HELLO");
  });
});

describe("scoreEnglish", () => {
  it("returns Infinity for no letters", () => {
    expect(scoreEnglish("12345!")).toBe(Infinity);
  });

  it("scores English text lower than random shifts", () => {
    const eng = scoreEnglish("the quick brown fox jumps over the lazy dog");
    const gib = scoreEnglish(caesarEncrypt("the quick brown fox jumps over the lazy dog", 17));
    expect(eng).toBeLessThan(gib);
  });
});

describe("bestGuess", () => {
  it("recovers the original shift for English text", () => {
    const cipher = caesarEncrypt("This is a long English sentence with many words.", 7);
    const guess = bestGuess(cipher);
    expect(guess).not.toBeNull();
    expect(guess!.shift).toBe(7);
  });
});

describe("formatResults", () => {
  it("formats all shifts", () => {
    const f = formatResults(bruteForce("A"));
    expect(f).toContain("Shift 1:");
    expect(f).toContain("Shift 25:");
    expect(f.split("\n").length).toBe(25);
  });
});
