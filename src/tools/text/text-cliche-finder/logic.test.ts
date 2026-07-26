/**
 * Cliché Finder — unit tests.
 */
import { describe, it, expect } from "vitest";
import { findCliches, batchFind, toCsv } from "./logic";

describe("findCliches — basic", () => {
  it("errors on empty text", () => {
    expect("error" in findCliches({ text: "" })).toBe(true);
  });
  it("returns no matches for clean text", () => {
    const r = findCliches({ text: "The quantum field exhibits non-trivial topological invariants." });
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(0);
    expect(r.warnings.some((w) => w.includes("fresh"))).toBe(true);
  });
  it("detects a known cliché", () => {
    const r = findCliches({ text: "At the end of the day, we all need to rest." });
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(1);
    expect(r.matches[0]!.phrase).toBe("at the end of the day");
  });
});

describe("findCliches — case insensitive", () => {
  it("matches regardless of case", () => {
    const r = findCliches({ text: "AT THE END OF THE DAY we ship." });
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(1);
  });
});

describe("findCliches — position info", () => {
  it("computes offset", () => {
    const r = findCliches({ text: "Hello world. At the end of the day." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.position.offset).toBe(13);
  });
  it("computes line and column", () => {
    const r = findCliches({ text: "First line.\nSecond line. Piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.position.line).toBe(2);
    expect(r.matches[0]!.position.column).toBe(14);
  });
  it("provides context", () => {
    const r = findCliches({ text: "It was a piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.context).toContain("piece of cake");
  });
});

describe("findCliches — alternatives", () => {
  it("provides fresh alternatives", () => {
    const r = findCliches({ text: "It was a piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.alternatives.length).toBeGreaterThan(0);
  });
});

describe("findCliches — categories", () => {
  it("tags business clichés", () => {
    const r = findCliches({ text: "Let's think outside the box." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.category).toBe("business");
  });
  it("tags sports clichés", () => {
    const r = findCliches({ text: "The ball is in your court now." });
    if ("error" in r) throw new Error("err");
    expect(r.matches[0]!.category).toBe("sports");
  });
  it("counts by category", () => {
    const r = findCliches({ text: "Think outside the box. The ball is in your court." });
    if ("error" in r) throw new Error("err");
    expect(r.countsByCategory.business).toBe(1);
    expect(r.countsByCategory.sports).toBe(1);
  });
});

describe("findCliches — density & freshness", () => {
  it("computes density per 100 words", () => {
    const r = findCliches({ text: "At the end of the day, it was a piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.densityPer100Words).toBeGreaterThan(0);
  });
  it("freshness score 0-100", () => {
    const r = findCliches({ text: "At the end of the day, it was a piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.freshnessScore).toBeGreaterThanOrEqual(0);
    expect(r.freshnessScore).toBeLessThanOrEqual(100);
  });
  it("clean text has high freshness", () => {
    const r = findCliches({ text: "Quantum mechanics describes subatomic particle behavior precisely." });
    if ("error" in r) throw new Error("err");
    expect(r.freshnessScore).toBe(100);
  });
});

describe("findCliches — cleaned text", () => {
  it("replaces clichés with first alternative", () => {
    const r = findCliches({ text: "It was a piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.cleaned).not.toContain("piece of cake");
    expect(r.cleaned).toContain(r.matches[0]!.alternatives[0]);
  });
});

describe("findCliches — unique phrases", () => {
  it("dedupes repeated clichés", () => {
    const r = findCliches({ text: "Piece of cake. Piece of cake. Piece of cake." });
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(3);
    expect(r.uniquePhrases.length).toBe(1);
  });
});

describe("findCliches — custom clichés", () => {
  it("uses custom cliché list", () => {
    const r = findCliches({
      text: "This is a supercalifragilistic phrase.",
      customCliches: [{
        phrase: "supercalifragilistic phrase",
        category: "overused",
        alternatives: ["rare phrase"],
        severity: "medium",
      }],
    });
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(1);
    expect(r.matches[0]!.phrase).toBe("supercalifragilistic phrase");
  });
});

describe("findCliches — warnings", () => {
  it("warns on high density", () => {
    const r = findCliches({ text: "At the end of the day, it was a piece of cake, and we hit the nail on the head, with the ball in your court, thinking outside the box, going the extra mile, every cloud has a silver lining." });
    if ("error" in r) throw new Error("err");
    if (r.densityPer100Words > 5) expect(r.warnings.some((w) => w.includes("High cliché density"))).toBe(true);
  });
});

describe("batchFind", () => {
  it("processes multiple texts", () => {
    const results = batchFind(["piece of cake", "clean text"]);
    expect(results.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = findCliches({ text: "Piece of cake." });
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Phrase");
    expect(csv).toContain("Alternatives");
  });
});
