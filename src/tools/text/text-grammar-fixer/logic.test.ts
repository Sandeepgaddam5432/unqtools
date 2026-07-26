/**
 * Grammar Fixer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { fixGrammar, summarizeChanges } from "./logic";

describe("fixGrammar — spacing", () => {
  it("collapses double spaces", () => {
    const r = fixGrammar("hello  world");
    expect(r.output).toBe("hello world");
    expect(r.totalChanges).toBeGreaterThan(0);
  });
  it("removes space before punctuation", () => {
    const r = fixGrammar("hello , world !");
    expect(r.output).toBe("hello, world!");
  });
  it("adds space after punctuation when missing", () => {
    const r = fixGrammar("Hello,world.");
    expect(r.output).toBe("Hello, world.");
  });
  it("collapses repeated ! and ?", () => {
    const r = fixGrammar("Wow!!! Really??");
    expect(r.output).toBe("Wow! Really?");
  });
});

describe("fixGrammar — capitalisation", () => {
  it("capitalises standalone i", () => {
    const r = fixGrammar("i think i know");
    expect(r.output).toBe("I think I know");
  });
  it("capitalises first letter of each sentence", () => {
    const r = fixGrammar("hello. goodbye. nice to meet you.");
    expect(r.output).toBe("Hello. Goodbye. Nice to meet you.");
  });
});

describe("fixGrammar — a/an", () => {
  it("inserts an before vowel-sound word", () => {
    const r = fixGrammar("I have a apple and a orange.");
    expect(r.output).toContain("an apple");
    expect(r.output).toContain("an orange");
  });
  it("handles silent-h words", () => {
    const r = fixGrammar("I waited a hour.");
    expect(r.output).toContain("an hour");
  });
  it("handles consonant-sound vowel-letter words", () => {
    const r = fixGrammar("She is an university student.");
    expect(r.output).toContain("a university");
  });
  it("leaves correct a/an alone", () => {
    const r = fixGrammar("I have a dog and an elephant.");
    expect(r.output).toBe("I have a dog and an elephant.");
  });
});

describe("fixGrammar — confusables", () => {
  it("fixes could of / should of", () => {
    const r = fixGrammar("I could of gone. You should of come.");
    expect(r.output).toContain("could have");
    expect(r.output).toContain("should have");
  });
  it("fixes alot → a lot", () => {
    const r = fixGrammar("That is alot of money.");
    expect(r.output).toContain("a lot");
  });
  it("fixes loose → lose before common nouns", () => {
    const r = fixGrammar("I want to loose weight.");
    expect(r.output).toContain("lose weight");
  });
  it("fixes to → too for excess", () => {
    const r = fixGrammar("That is to much.");
    expect(r.output).toContain("too much");
  });
  it("fixes then → than in comparisons", () => {
    const r = fixGrammar("He is taller then me.");
    expect(r.output).toContain("taller than me");
  });
  it("fixes its vs it's possessive", () => {
    const r = fixGrammar("It's color is blue.");
    expect(r.output).toContain("Its color is blue");
  });
});

describe("fixGrammar — meta", () => {
  it("returns empty output for empty input", () => {
    const r = fixGrammar("");
    expect(r.output).toBe("");
    expect(r.totalChanges).toBe(0);
  });
  it("warns when no changes needed", () => {
    const r = fixGrammar("The dog barks loudly.");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("respects disabled options", () => {
    const r = fixGrammar("i am here", {
      fixCapitalization: false,
      fixCommonConfusables: false,
      fixAAn: false,
      fixSpacingPunctuation: false,
    });
    expect(r.output).toBe("i am here");
  });
});

describe("summarizeChanges", () => {
  it("renders markdown summary with rule rows", () => {
    const r = fixGrammar("hello  world alot");
    const summary = summarizeChanges(r);
    expect(summary).toContain("Rule");
    expect(summary).toContain("double-space");
    expect(summary).toContain("alot");
    expect(summary).toContain("Total");
  });
  it("returns 'No changes.' when nothing was fixed", () => {
    const r = fixGrammar("The dog barks loudly.");
    expect(summarizeChanges(r)).toBe("No changes.");
  });
});
