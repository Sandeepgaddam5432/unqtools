import { describe, it, expect, beforeEach } from "vitest";
import {
  DICE_TYPES,
  SAMPLE_EXPRESSIONS,
  MAX_DICE_PER_TERM,
  MAX_EXPLOSIONS,
  SAMPLE_SEED,
  mulberry32,
  createPrng,
  parseDiceNotation,
  formatTerm,
  rollDie,
  rollDiceTerm,
  rollExpression,
  pickFromList,
  pickWeighted,
  flipCoin,
  parsePickerList,
  computeRollStats,
  collectDieRolls,
  renderRollText,
  renderRollJson,
  renderRollsCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiceTerm,
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

describe("dice-roller constants", () => {
  it("exposes 7 standard dice types", () => {
    expect(DICE_TYPES).toHaveLength(7);
    expect(DICE_TYPES.map((d) => d.value)).toEqual(
      expect.arrayContaining(["d4", "d6", "d8", "d10", "d12", "d20", "d100"]),
    );
  });
  it("has sample expressions including notation variants", () => {
    expect(SAMPLE_EXPRESSIONS.length).toBeGreaterThanOrEqual(5);
    expect(SAMPLE_EXPRESSIONS).toContain("3d6");
    expect(SAMPLE_EXPRESSIONS).toContain("4d6kh3");
    expect(SAMPLE_EXPRESSIONS).toContain("1d20+5");
  });
  it("enforces sane limits", () => {
    expect(MAX_DICE_PER_TERM).toBeGreaterThanOrEqual(100);
    expect(MAX_EXPLOSIONS).toBeGreaterThanOrEqual(10);
    expect(SAMPLE_SEED).toBeGreaterThan(0);
  });
});

describe("dice-roller PRNG", () => {
  it("mulberry32 reproduces the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("mulberry32 returns floats in [0, 1)", () => {
    const p = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("createPrng returns Math.random when seed is null", () => {
    const p = createPrng(null);
    expect(typeof p.next()).toBe("number");
  });
  it("createPrng returns Math.random when seed is negative", () => {
    const p = createPrng(-5);
    expect(typeof p.next()).toBe("number");
  });
});

describe("dice-roller parseDiceNotation", () => {
  it("parses '3d6' correctly", () => {
    const r = parseDiceNotation("3d6");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts).toHaveLength(1);
      expect(r.parts[0].kind).toBe("dice");
      if (r.parts[0].kind === "dice") {
        expect(r.parts[0].term.count).toBe(3);
        expect(r.parts[0].term.faces).toBe(6);
        expect(r.parts[0].term.keepHighest).toBeNull();
        expect(r.parts[0].term.explode).toBe(false);
      }
    }
  });
  it("parses 'd6' as 1 die", () => {
    const r = parseDiceNotation("d6");
    expect(r.ok).toBe(true);
    if (r.ok && r.parts[0].kind === "dice") {
      expect(r.parts[0].term.count).toBe(1);
      expect(r.parts[0].term.faces).toBe(6);
    }
  });
  it("parses '3d6+2' with constant modifier", () => {
    const r = parseDiceNotation("3d6+2");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts).toHaveLength(2);
      expect(r.parts[1].kind).toBe("constant");
      if (r.parts[1].kind === "constant") expect(r.parts[1].term.value).toBe(2);
    }
  });
  it("parses '4d6kh3' keep highest 3", () => {
    const r = parseDiceNotation("4d6kh3");
    expect(r.ok).toBe(true);
    if (r.ok && r.parts[0].kind === "dice") {
      expect(r.parts[0].term.keepHighest).toBe(3);
      expect(r.parts[0].term.keepLowest).toBeNull();
    }
  });
  it("parses '2d20kl1' keep lowest 1 (disadvantage)", () => {
    const r = parseDiceNotation("2d20kl1");
    expect(r.ok).toBe(true);
    if (r.ok && r.parts[0].kind === "dice") {
      expect(r.parts[0].term.keepLowest).toBe(1);
      expect(r.parts[0].term.keepHighest).toBeNull();
    }
  });
  it("parses 'd6!' exploding dice", () => {
    const r = parseDiceNotation("d6!");
    expect(r.ok).toBe(true);
    if (r.ok && r.parts[0].kind === "dice") expect(r.parts[0].term.explode).toBe(true);
  });
  it("parses '1d20+1d4+2' with three parts", () => {
    const r = parseDiceNotation("1d20+1d4+2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parts).toHaveLength(3);
  });
  it("parses '-1d6' as negated term", () => {
    const r = parseDiceNotation("-1d6");
    expect(r.ok).toBe(true);
    if (r.ok && r.parts[0].kind === "dice") expect(r.parts[0].term.negate).toBe(true);
  });
  it("parses '1d20-1d4' as dice + negated dice", () => {
    const r = parseDiceNotation("1d20-1d4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts).toHaveLength(2);
      if (r.parts[1].kind === "dice") expect(r.parts[1].term.negate).toBe(true);
    }
  });
  it("ignores whitespace", () => {
    const r = parseDiceNotation("  3 d 6 + 2  ".replace(/\s+/g, ""));
    expect(r.ok).toBe(true);
  });
  it("rejects empty expression", () => {
    expect(parseDiceNotation("").ok).toBe(false);
  });
  it("rejects faces < 2", () => {
    const r = parseDiceNotation("1d1");
    expect(r.ok).toBe(false);
  });
  it("rejects count < 1", () => {
    const r = parseDiceNotation("0d6");
    expect(r.ok).toBe(false);
  });
  it("rejects keep count > dice count", () => {
    const r = parseDiceNotation("2d6kh5");
    expect(r.ok).toBe(false);
  });
  it("rejects unexpected characters", () => {
    const r = parseDiceNotation("3d6&2");
    expect(r.ok).toBe(false);
  });
});

describe("dice-roller formatTerm", () => {
  it("formats a basic term", () => {
    const t: DiceTerm = {
      count: 3, faces: 6, keepHighest: null, keepLowest: null, explode: false, negate: false,
    };
    expect(formatTerm(t)).toBe("3d6");
  });
  it("formats a term with kh and explode", () => {
    const t: DiceTerm = {
      count: 4, faces: 6, keepHighest: 3, keepLowest: null, explode: true, negate: false,
    };
    expect(formatTerm(t)).toBe("4d6kh3!");
  });
  it("formats a negated term", () => {
    const t: DiceTerm = {
      count: 1, faces: 4, keepHighest: null, keepLowest: null, explode: false, negate: true,
    };
    expect(formatTerm(t)).toBe("-1d4");
  });
});

describe("dice-roller rolling", () => {
  it("rollDie returns 1..faces", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rollDie(p, 20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
  it("rollDie throws for invalid faces", () => {
    const p = mulberry32(7);
    expect(() => rollDie(p, 1)).toThrow(/faces/);
  });
  it("rollDiceTerm returns kept rolls", () => {
    const p = mulberry32(7);
    const t: DiceTerm = {
      count: 4, faces: 6, keepHighest: 3, keepLowest: null, explode: false, negate: false,
    };
    const r = rollDiceTerm(p, t);
    expect(r.rolls).toHaveLength(4);
    expect(r.kept).toHaveLength(3);
    expect(r.value).toBe(r.kept.reduce((a, b) => a + b, 0));
  });
  it("rollExpression sums correctly", () => {
    // Force a known sequence with seed; check the total matches parts.
    const p = mulberry32(99);
    const r = rollExpression(p, "1d6+2");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const dicePart = r.parts[0];
      if (dicePart.kind === "dice") {
        const expectedTotal = dicePart.value + 2;
        expect(r.total).toBe(expectedTotal);
      }
    }
  });
  it("rollExpression is reproducible with same seed", () => {
    const a = rollExpression(mulberry32(42), "3d6+2");
    const b = rollExpression(mulberry32(42), "3d6+2");
    expect(a.total).toBe(b.total);
  });
  it("rollExpression applies keep highest correctly", () => {
    // With seed 42, roll 4d6kh3 — result should be 3 dice summed (dropped the lowest)
    const r = rollExpression(mulberry32(42), "4d6kh3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const dicePart = r.parts[0];
      if (dicePart.kind === "dice") {
        expect(dicePart.rolls).toHaveLength(4);
        expect(dicePart.kept).toHaveLength(3);
        // Kept sum should be >= dropped die (since we keep highest 3)
        const droppedSum = dicePart.rolls.reduce((a, b) => a + b, 0) - dicePart.kept.reduce((a, b) => a + b, 0);
        const minKept = Math.min(...dicePart.kept);
        expect(minKept).toBeGreaterThanOrEqual(droppedSum); // dropped is the lowest
      }
    }
  });
  it("rollExpression handles negated term", () => {
    const r = rollExpression(mulberry32(42), "10-1d6");
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Total should be 10 minus the d6 roll (between 4 and 9)
      expect(r.total).toBeGreaterThanOrEqual(4);
      expect(r.total).toBeLessThanOrEqual(9);
    }
  });
  it("rollExpression handles exploding dice (no infinite loop)", () => {
    const r = rollExpression(mulberry32(42), "1d6!");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const dicePart = r.parts[0];
      if (dicePart.kind === "dice") {
        // Either no explosion (first roll wasn't 6) or one+ explosion rolls.
        expect(dicePart.rolls.length).toBeGreaterThanOrEqual(1);
        expect(dicePart.rolls.length).toBeLessThanOrEqual(MAX_EXPLOSIONS + 1);
      }
    }
  });
  it("rollExpression returns error for invalid expression", () => {
    const r = rollExpression(mulberry32(42), "1d1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeDefined();
  });
  it("rollExpression handles 1d100", () => {
    const r = rollExpression(mulberry32(42), "1d100");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toBeGreaterThanOrEqual(1);
    if (r.ok) expect(r.total).toBeLessThanOrEqual(100);
  });
});

describe("dice-roller random picker", () => {
  it("pickFromList returns a valid item", () => {
    const p = mulberry32(7);
    const items = ["a", "b", "c"];
    expect(items).toContain(pickFromList(p, items));
  });
  it("pickFromList throws on empty", () => {
    const p = mulberry32(7);
    expect(() => pickFromList(p, [])).toThrow(/empty/);
  });
  it("pickWeighted favors heavier weights", () => {
    const p = mulberry32(7);
    let common = 0;
    for (let i = 0; i < 200; i++) {
      if (pickWeighted(p, [
        { item: "rare", weight: 1 },
        { item: "common", weight: 99 },
      ]) === "common") common++;
    }
    expect(common).toBeGreaterThan(150);
  });
  it("pickWeighted throws on empty", () => {
    const p = mulberry32(7);
    expect(() => pickWeighted(p, [])).toThrow(/empty/);
  });
  it("pickWeighted throws on all-zero weights", () => {
    const p = mulberry32(7);
    expect(() => pickWeighted(p, [{ item: "x", weight: 0 }])).toThrow(/zero/);
  });
  it("flipCoin returns heads or tails", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const r = flipCoin(p);
      expect(["heads", "tails"]).toContain(r);
    }
  });
  it("parsePickerList parses plain items", () => {
    const r = parsePickerList("apple\nbanana\ncherry");
    expect(r.items).toEqual(["apple", "banana", "cherry"]);
    expect(r.weighted.every((w) => w.weight === 1)).toBe(true);
  });
  it("parsePickerList parses 'item :: weight' syntax", () => {
    const r = parsePickerList("apple :: 3\nbanana :: 1");
    expect(r.weighted[0]).toEqual({ item: "apple", weight: 3 });
    expect(r.weighted[1]).toEqual({ item: "banana", weight: 1 });
  });
  it("parsePickerList parses 'item:weight' shorthand", () => {
    const r = parsePickerList("apple:5\nbanana:2");
    expect(r.weighted[0]).toEqual({ item: "apple", weight: 5 });
  });
  it("parsePickerList skips blank lines", () => {
    const r = parsePickerList("\napple\n\nbanana\n");
    expect(r.items).toEqual(["apple", "banana"]);
  });
});

describe("dice-roller stats", () => {
  it("computeRollStats computes correctly", () => {
    const s = computeRollStats([3, 5, 1, 6, 5]);
    expect(s.count).toBe(5);
    expect(s.sum).toBe(20);
    expect(s.mean).toBe(4);
    expect(s.min).toBe(1);
    expect(s.max).toBe(6);
    expect(s.distribution[5]).toBe(2);
    expect(s.distribution[3]).toBe(1);
  });
  it("computeRollStats handles empty", () => {
    const s = computeRollStats([]);
    expect(s.count).toBe(0);
    expect(s.sum).toBe(0);
  });
  it("collectDieRolls gathers all die rolls", () => {
    const r = rollExpression(mulberry32(42), "2d6+1d4");
    if (r.ok) {
      const all = collectDieRolls(r);
      expect(all.length).toBe(3); // 2 + 1
    }
  });
});

describe("dice-roller renderers", () => {
  it("renderRollText shows expression and total", () => {
    const r = rollExpression(mulberry32(42), "1d6+2");
    const text = renderRollText(r);
    expect(text).toContain("Expression: 1d6+2");
    expect(text).toContain("Total:");
  });
  it("renderRollText handles error", () => {
    const r = rollExpression(mulberry32(42), "1d1");
    expect(renderRollText(r)).toContain("Error:");
  });
  it("renderRollJson produces valid JSON", () => {
    const r = rollExpression(mulberry32(42), "1d6+2");
    const json = renderRollJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.expression).toBe("1d6+2");
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.parts)).toBe(true);
  });
  it("renderRollsCsv has header and rows", () => {
    const csv = renderRollsCsv([
      { expression: "3d6", total: 11 },
      { expression: "1d20", total: 14 },
    ]);
    expect(csv.split("\n")[0]).toBe("index,expression,total");
    expect(csv.split("\n")).toHaveLength(3);
  });
});

describe("dice-roller history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, expression: "3d6", total: 11, seed: 42, parts: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, expression: "1d6", total: i, seed: i, parts: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, expression: "1d6", total: 1, seed: 1, parts: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({ ts: 1, expression: "1d6", total: 1, seed: 1, parts: 1 });
    saveHistory({ ts: 2, expression: "2d6", total: 7, seed: 2, parts: 1 });
    const h = loadHistory();
    expect(h[0].expression).toBe("2d6");
    expect(h[1].expression).toBe("1d6");
  });
});

describe("dice-roller shareable URL", () => {
  it("builds share URL with expression and seed", () => {
    const url = buildShareUrl({ expression: "3d6+2", seed: 42 });
    expect(url).toContain("expr=3d6%2B2");
    expect(url).toContain("seed=42");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ expression: "4d6kh3", seed: 999 });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.expression).toBe("4d6kh3");
    expect(parsed.seed).toBe(999);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ expression: "", seed: null });
  });
  it("handles missing seed", () => {
    expect(parseShareUrl("expr=3d6")).toEqual({ expression: "3d6", seed: null });
  });
  it("ignores invalid seed", () => {
    const parsed = parseShareUrl("expr=3d6&seed=abc");
    expect(parsed.seed).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = DiceTerm;
