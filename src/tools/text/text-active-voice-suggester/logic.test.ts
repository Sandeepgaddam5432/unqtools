import { describe, it, expect } from "vitest";
import {
  participleToBase, tokenize, splitSentences, looksLikePastParticiple,
  findByAgent, findPassivesInSentence, escapeRegex, generateSuggestions,
  capitalize, analyzeText, rewriteSentence, matchesToCsv,
} from "./logic";

describe("participleToBase", () => {
  it("converts regular -ed", () => {
    expect(participleToBase("baked")).toBe("bake");
    expect(participleToBase("stopped")).toBe("stop");
  });
  it("converts -ied", () => {
    expect(participleToBase("carried")).toBe("carry");
  });
  it("converts irregular", () => {
    expect(participleToBase("written")).toBe("write");
    expect(participleToBase("eaten")).toBe("eat");
    expect(participleToBase("done")).toBe("do");
  });
  it("handles unknown", () => {
    expect(participleToBase("jumping")).toBe("jumping");
  });
});

describe("tokenize", () => {
  it("splits words", () => {
    expect(tokenize("The dog ran fast.")).toEqual(["The", "dog", "ran", "fast"]);
  });
  it("handles empty", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("splits on . ! ?", () => {
    expect(splitSentences("Hello world. Goodbye now!")).toHaveLength(2);
  });
  it("handles single sentence", () => {
    expect(splitSentences("Just one.")).toHaveLength(1);
  });
  it("filters empty", () => {
    expect(splitSentences("")).toHaveLength(0);
  });
});

describe("looksLikePastParticiple", () => {
  it("detects -ed", () => {
    expect(looksLikePastParticiple("baked")).toBe(true);
    expect(looksLikePastParticiple("played")).toBe(true);
  });
  it("detects irregular", () => {
    expect(looksLikePastParticiple("written")).toBe(true);
    expect(looksLikePastParticiple("eaten")).toBe(true);
  });
  it("rejects non-participles", () => {
    expect(looksLikePastParticiple("red")).toBe(false);
    expect(looksLikePastParticiple("bed")).toBe(false);
    expect(looksLikePastParticiple("running")).toBe(false);
  });
});

describe("findByAgent", () => {
  it("finds by-agent", () => {
    const r = findByAgent("The cake was eaten by John yesterday.", 15);
    expect(r).not.toBeNull();
    expect(r!.agent).toBe("John");
  });
  it("returns null when no by-agent", () => {
    expect(findByAgent("The cake was eaten.", 15)).toBeNull();
  });
});

describe("findPassivesInSentence", () => {
  it("finds simple passive", () => {
    const m = findPassivesInSentence("The cake was eaten by John.");
    expect(m.length).toBe(1);
    expect(m[0].beVerb).toBe("was");
    expect(m[0].pastParticiple).toBe("eaten");
    expect(m[0].byAgent).toBe("John");
  });
  it("finds passive without by-agent", () => {
    const m = findPassivesInSentence("Mistakes were made.");
    expect(m.length).toBe(1);
    expect(m[0].byAgent).toBeUndefined();
  });
  it("returns empty for active sentence", () => {
    expect(findPassivesInSentence("John ate the cake.")).toHaveLength(0);
  });
  it("handles multiple passives", () => {
    const m = findPassivesInSentence("The book was written by Alice and was published by Bob.");
    expect(m.length).toBe(2);
  });
});

describe("escapeRegex & capitalize", () => {
  it("escapes special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
});

describe("generateSuggestions", () => {
  it("produces suggestion with agent", () => {
    const tokens = ["The", "cake", "was", "eaten", "by", "John"];
    const s = generateSuggestions("The cake was eaten by John.", "was", "eaten", "John", 2, 3);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].toLowerCase()).toContain("john");
    expect(s[0].toLowerCase()).toContain("eat");
  });
});

describe("analyzeText", () => {
  it("computes statistics", () => {
    const r = analyzeText("The cake was eaten. John ran fast. The book was written by Alice.");
    expect(r.totalSentences).toBe(3);
    expect(r.passiveCount).toBe(2);
    expect(r.passivePercentage).toBeGreaterThan(0);
  });
  it("handles empty text", () => {
    const r = analyzeText("");
    expect(r.totalSentences).toBe(0);
    expect(r.passiveCount).toBe(0);
  });
  it("adds warnings for many passives", () => {
    const r = analyzeText("It was eaten. It was drunk. It was thrown away.");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("rewriteSentence", () => {
  it("rewrites passive", () => {
    const rewritten = rewriteSentence("The cake was eaten by John.");
    expect(rewritten.toLowerCase()).toContain("john");
  });
  it("keeps active sentence", () => {
    expect(rewriteSentence("John ate the cake.")).toBe("John ate the cake.");
  });
});

describe("matchesToCsv", () => {
  it("generates CSV with header", () => {
    const r = analyzeText("The cake was eaten by John.");
    const csv = matchesToCsv(r.matches);
    expect(csv.startsWith("sentence,passive_phrase")).toBe(true);
    expect(csv).toContain("was eaten");
  });
});
