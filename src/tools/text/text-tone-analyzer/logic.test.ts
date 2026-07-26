/**
 * Tone Analyzer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { analyzeTone, toneReport } from "./logic";

describe("analyzeTone — basic", () => {
  it("returns unknown for empty text", () => {
    const r = analyzeTone("");
    expect(r.dominantTone).toBe("Unknown");
    expect(r.metrics.wordCount).toBe(0);
  });
  it("counts words and sentences", () => {
    const r = analyzeTone("This is a sentence. Here is another one!");
    expect(r.metrics.wordCount).toBeGreaterThan(5);
    expect(r.metrics.sentenceCount).toBe(2);
  });
});

describe("analyzeTone — sentiment", () => {
  it("scores positive text positively", () => {
    const r = analyzeTone("I absolutely love this wonderful product. It is fantastic and amazing.");
    expect(r.sentiment).toBeGreaterThan(20);
    expect(r.labels.sentiment).toBe("Positive");
  });
  it("scores negative text negatively", () => {
    const r = analyzeTone("This is terrible and awful. I hate it. The worst experience ever.");
    expect(r.sentiment).toBeLessThan(-20);
    expect(r.labels.sentiment).toBe("Negative");
  });
  it("neutral text stays near zero", () => {
    const r = analyzeTone("The report is on the table. The chair is next to the desk.");
    expect(Math.abs(r.sentiment)).toBeLessThan(20);
  });
  it("tracks matched positive words", () => {
    const r = analyzeTone("What a great and awesome day!");
    expect(r.matchedWords.positive).toContain("great");
    expect(r.matchedWords.positive).toContain("awesome");
  });
  it("tracks matched negative words", () => {
    const r = analyzeTone("The service was bad and the food was terrible.");
    expect(r.matchedWords.negative).toContain("bad");
    expect(r.matchedWords.negative).toContain("terrible");
  });
});

describe("analyzeTone — formality", () => {
  it("contractions make text more casual", () => {
    const r = analyzeTone("I'm gonna go. You're gonna love it. Don't worry.");
    expect(r.formality).toBeLessThan(0);
    expect(r.metrics.contractionCount).toBeGreaterThanOrEqual(3);
  });
  it("emojis pull formality down", () => {
    const r = analyzeTone("Hey everyone 👋🎉🚀");
    expect(r.formality).toBeLessThan(0);
    expect(r.metrics.emojiCount).toBeGreaterThanOrEqual(1);
  });
  it("slang words make text casual", () => {
    const r = analyzeTone("lol omg that was tbh so cool dude");
    expect(r.formality).toBeLessThan(0);
    expect(r.metrics.slangCount).toBeGreaterThanOrEqual(3);
  });
  it("long formal sentences score formal", () => {
    const r = analyzeTone(
      "The committee reviewed the proposed amendments and concluded that further deliberation was necessary before any recommendation could be made to the executive board.",
    );
    expect(r.formality).toBeGreaterThan(0);
    expect(r.labels.formality).toBe("Formal");
  });
});

describe("analyzeTone — confidence", () => {
  it("hedge words make text tentative", () => {
    const r = analyzeTone("I think maybe we could possibly try, perhaps it might work.");
    expect(r.confidence).toBeLessThan(0);
  });
  it("confident markers boost score", () => {
    const r = analyzeTone("This will definitely work. We must absolutely proceed. It is clearly the right choice.");
    expect(r.confidence).toBeGreaterThan(0);
  });
  it("many questions lower confidence", () => {
    const r = analyzeTone("Where are we going? What should we do? Why is this happening? How do we fix it?");
    expect(r.confidence).toBeLessThan(0);
    expect(r.metrics.questionCount).toBe(4);
  });
});

describe("analyzeTone — meta", () => {
  it("warns on very short text", () => {
    const r = analyzeTone("ok.");
    expect(r.warnings.some((w) => w.includes("short"))).toBe(true);
  });
  it("exclamation count is tracked", () => {
    const r = analyzeTone("Wow! Great! Awesome!");
    expect(r.metrics.exclamationCount).toBe(3);
  });
});

describe("toneReport", () => {
  it("renders a readable plain-text report", () => {
    const r = analyzeTone("I absolutely love this fantastic product!");
    const report = toneReport(r);
    expect(report).toContain("Dominant tone");
    expect(report).toContain("Formality");
    expect(report).toContain("Sentiment");
    expect(report).toContain("Confidence");
    expect(report).toContain("Words:");
  });
});
