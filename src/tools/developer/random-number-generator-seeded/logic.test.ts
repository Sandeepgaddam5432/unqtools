import { describe, it, expect, beforeEach } from "vitest";
import {
  PRNG_ALGORITHMS,
  DISTRIBUTIONS,
  DEFAULT_OPTIONS,
  MAX_COUNT,
  SAMPLE_SEED,
  mulberry32,
  lcg,
  xorshift32,
  mersenneTwister,
  createPrng,
  secureRandomUint32,
  isCsprngAvailable,
  createCsprng,
  nextIntInclusive,
  nextFloatIn,
  gaussian,
  exponential,
  poisson,
  generateUnique,
  generateInts,
  generateFloats,
  execute,
  weightedChoice,
  shuffle,
  computeHistogram,
  renderText,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GenerateOptions,
  type PrngAlgorithm,
  type Distribution,
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

describe("rng-seeded constants", () => {
  it("exposes 4 PRNG algorithms", () => {
    expect(PRNG_ALGORITHMS).toHaveLength(4);
    expect(PRNG_ALGORITHMS.map((a) => a.value)).toEqual(
      expect.arrayContaining(["mulberry32", "lcg", "xorshift", "mt"]),
    );
  });
  it("exposes 4 distributions", () => {
    expect(DISTRIBUTIONS).toHaveLength(4);
    expect(DISTRIBUTIONS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["uniform", "normal", "exponential", "poisson"]),
    );
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.algorithm).toBe("mulberry32");
    expect(DEFAULT_OPTIONS.count).toBeGreaterThan(0);
    expect(DEFAULT_OPTIONS.max).toBeGreaterThanOrEqual(DEFAULT_OPTIONS.min);
    expect(MAX_COUNT).toBeGreaterThanOrEqual(1000);
  });
  it("has a sample seed", () => {
    expect(SAMPLE_SEED).toBeGreaterThan(0);
  });
});

describe("rng-seeded PRNG reproducibility", () => {
  it("mulberry32 reproduces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
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
  it("mulberry32 nextUint32 returns 32-bit unsigned", () => {
    const p = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const v = p.nextUint32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it("lcg reproduces the same sequence", () => {
    const a = lcg(99);
    const b = lcg(99);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("xorshift reproduces the same sequence", () => {
    const a = xorshift32(7);
    const b = xorshift32(7);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("xorshift handles zero seed by treating it as 1", () => {
    const p = xorshift32(0);
    expect(() => p.nextUint32()).not.toThrow();
    expect(p.nextUint32()).toBeGreaterThanOrEqual(0);
  });
  it("mersenne-twister reproduces the same sequence", () => {
    const a = mersenneTwister(54321);
    const b = mersenneTwister(54321);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
  it("createPrng dispatches to the right algorithm", () => {
    expect(createPrng(42, "mulberry32").algorithm).toBe("mulberry32");
    expect(createPrng(42, "lcg").algorithm).toBe("lcg");
    expect(createPrng(42, "xorshift").algorithm).toBe("xorshift");
    expect(createPrng(42, "mt").algorithm).toBe("mt");
  });
});

describe("rng-seeded CSPRNG", () => {
  it("isCsprngAvailable returns a boolean", () => {
    expect(typeof isCsprngAvailable()).toBe("boolean");
  });
  it("secureRandomUint32 returns 32-bit unsigned", () => {
    const v = secureRandomUint32();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(v)).toBe(true);
  });
  it("createCsprng returns a Prng that produces values in [0,1)", () => {
    const c = createCsprng();
    for (let i = 0; i < 10; i++) {
      const v = c.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rng-seeded generation primitives", () => {
  it("nextIntInclusive returns values within range", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = nextIntInclusive(p, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("nextIntInclusive swaps min > max", () => {
    const p = mulberry32(7);
    const v = nextIntInclusive(p, 10, 5);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThanOrEqual(10);
  });
  it("nextFloatIn respects decimals", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = nextFloatIn(p, 0, 1, 2);
      const decimals = (String(v).split(".")[1] ?? "").length;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
  it("gaussian returns finite numbers", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = gaussian(p, 0, 1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });
  it("exponential returns non-negative values", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = exponential(p, 1);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
  it("exponential returns NaN for non-positive lambda", () => {
    const p = mulberry32(7);
    expect(exponential(p, 0)).toBeNaN();
    expect(exponential(p, -1)).toBeNaN();
  });
  it("poisson returns non-negative integers", () => {
    const p = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = poisson(p, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it("poisson returns 0 for non-positive lambda", () => {
    const p = mulberry32(7);
    expect(poisson(p, 0)).toBe(0);
    expect(poisson(p, -2)).toBe(0);
  });
});

describe("rng-seeded bulk generation", () => {
  it("generateInts returns count values in range", () => {
    const p = mulberry32(42);
    const vals = generateInts(p, 50, 1, 100);
    expect(vals).toHaveLength(50);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it("generateFloats returns count values with decimals", () => {
    const p = mulberry32(42);
    const vals = generateFloats(p, 30, 0, 10, 3);
    expect(vals).toHaveLength(30);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("generateUnique returns unique values", () => {
    const p = mulberry32(42);
    const vals = generateUnique(p, 10, 1, 100);
    expect(vals).toHaveLength(10);
    expect(new Set(vals).size).toBe(10);
  });
  it("generateUnique throws when count > range", () => {
    const p = mulberry32(42);
    expect(() => generateUnique(p, 15, 1, 10)).toThrow(/range of 10/);
  });
  it("generateUnique handles count = 0", () => {
    const p = mulberry32(42);
    expect(generateUnique(p, 0, 1, 10)).toEqual([]);
  });
});

describe("rng-seeded execute", () => {
  it("execute uniform integers in range", () => {
    const r = execute({ ...DEFAULT_OPTIONS, count: 50, min: 1, max: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values).toHaveLength(50);
      for (const v of r.values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
  it("execute is reproducible with same seed", () => {
    const a = execute({ ...DEFAULT_OPTIONS, algorithm: "mulberry32", seed: 99, count: 10 });
    const b = execute({ ...DEFAULT_OPTIONS, algorithm: "mulberry32", seed: 99, count: 10 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.values).toEqual(b.values);
  });
  it("execute uniform unique returns unique", () => {
    const r = execute({ ...DEFAULT_OPTIONS, count: 20, min: 1, max: 100, unique: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Set(r.values).size).toBe(20);
  });
  it("execute uniform unique fails on decimals", () => {
    const r = execute({ ...DEFAULT_OPTIONS, unique: true, decimals: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/integers/);
  });
  it("execute normal returns finite values", () => {
    const r = execute({ ...DEFAULT_OPTIONS, distribution: "normal", mean: 50, std: 10, count: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) for (const v of r.values) expect(Number.isFinite(v)).toBe(true);
  });
  it("execute exponential returns non-negative values", () => {
    const r = execute({ ...DEFAULT_OPTIONS, distribution: "exponential", lambda: 2, count: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) for (const v of r.values) expect(v).toBeGreaterThanOrEqual(0);
  });
  it("execute poisson returns non-negative integers", () => {
    const r = execute({ ...DEFAULT_OPTIONS, distribution: "poisson", lambda: 3, count: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) for (const v of r.values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it("execute csprng mode returns uniform integers", () => {
    const r = execute({ ...DEFAULT_OPTIONS, csprng: true, count: 20, min: 1, max: 6 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.algorithm).toBe("csprng");
      for (const v of r.values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    }
  });
  it("execute csprng rejects non-uniform distributions", () => {
    const r = execute({ ...DEFAULT_OPTIONS, csprng: true, distribution: "normal" });
    expect(r.ok).toBe(false);
  });
  it("execute rejects count > MAX_COUNT", () => {
    const r = execute({ ...DEFAULT_OPTIONS, count: MAX_COUNT + 1 });
    expect(r.ok).toBe(false);
  });
  it("execute rejects count <= 0", () => {
    const r = execute({ ...DEFAULT_OPTIONS, count: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("rng-seeded weighted choice + shuffle", () => {
  it("weightedChoice returns a valid item", () => {
    const p = mulberry32(42);
    const items = [
      { item: "a", weight: 1 },
      { item: "b", weight: 1 },
      { item: "c", weight: 1 },
    ];
    const picked = weightedChoice(p, items);
    expect(["a", "b", "c"]).toContain(picked);
  });
  it("weightedChoice favors heavier weights (distribution test)", () => {
    const p = mulberry32(42);
    const items = [
      { item: "rare", weight: 1 },
      { item: "common", weight: 99 },
    ];
    let common = 0;
    for (let i = 0; i < 200; i++) if (weightedChoice(p, items) === "common") common++;
    expect(common).toBeGreaterThan(150); // ~99% expected
  });
  it("weightedChoice throws on empty", () => {
    const p = mulberry32(42);
    expect(() => weightedChoice(p, [])).toThrow(/empty/);
  });
  it("weightedChoice throws on all-zero weights", () => {
    const p = mulberry32(42);
    expect(() => weightedChoice(p, [{ item: "x", weight: 0 }])).toThrow(/zero/);
  });
  it("shuffle preserves multiset", () => {
    const p = mulberry32(42);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(p, input);
    expect(out.sort()).toEqual(input.sort());
  });
  it("shuffle does not mutate input", () => {
    const p = mulberry32(42);
    const input = [1, 2, 3, 4, 5];
    const copy = input.slice();
    shuffle(p, input);
    expect(input).toEqual(copy);
  });
});

describe("rng-seeded histogram", () => {
  it("buckets values evenly", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const buckets = computeHistogram(values, 5);
    expect(buckets).toHaveLength(5);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(10);
  });
  it("returns single bucket when all values equal", () => {
    const buckets = computeHistogram([5, 5, 5, 5], 5);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(4);
  });
  it("returns empty for empty input", () => {
    expect(computeHistogram([], 5)).toEqual([]);
  });
});

describe("rng-seeded renderers", () => {
  const values = [1, 2, 3];
  it("renderText produces one-per-line", () => {
    expect(renderText(values)).toBe("1\n2\n3");
  });
  it("renderCsv has header and rows", () => {
    const csv = renderCsv(values);
    expect(csv.split("\n")[0]).toBe("index,value");
    expect(csv.split("\n")).toHaveLength(4);
  });
  it("renderJson produces valid JSON array", () => {
    expect(JSON.parse(renderJson(values))).toEqual([1, 2, 3]);
  });
});

describe("rng-seeded history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, algorithm: "mulberry32", seed: 42, distribution: "uniform",
      count: 10, min: 1, max: 100, preview: "1 2 3",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, algorithm: "mulberry32", seed: i, distribution: "uniform",
        count: 1, min: 1, max: 100, preview: String(i),
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, algorithm: "mulberry32", seed: 1, distribution: "uniform",
      count: 1, min: 1, max: 100, preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({
      ts: 1, algorithm: "mulberry32", seed: 1, distribution: "uniform",
      count: 1, min: 1, max: 100, preview: "first",
    });
    saveHistory({
      ts: 2, algorithm: "mulberry32", seed: 2, distribution: "uniform",
      count: 1, min: 1, max: 100, preview: "second",
    });
    const h = loadHistory();
    expect(h[0].preview).toBe("second");
    expect(h[1].preview).toBe("first");
  });
});

describe("rng-seeded shareable URL", () => {
  it("builds share URL with all options", () => {
    const opts: GenerateOptions = {
      ...DEFAULT_OPTIONS,
      algorithm: "xorshift",
      seed: 1234,
      count: 25,
      min: 5,
      max: 50,
      distribution: "normal",
      mean: 10,
      std: 2,
      lambda: 3,
      decimals: 1,
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("alg=xorshift");
    expect(url).toContain("seed=1234");
    expect(url).toContain("n=25");
    expect(url).toContain("dist=normal");
    expect(url).toContain("mu=10");
    expect(url).toContain("sd=2");
  });
  it("parses share URL back to options", () => {
    const opts: GenerateOptions = {
      ...DEFAULT_OPTIONS,
      algorithm: "lcg",
      seed: 999,
      count: 50,
      min: 10,
      max: 99,
      distribution: "poisson",
      lambda: 4,
      unique: true,
    };
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.algorithm).toBe("lcg");
    expect(parsed.seed).toBe(999);
    expect(parsed.count).toBe(50);
    expect(parsed.distribution).toBe("poisson");
    expect(parsed.unique).toBe(true);
  });
  it("returns defaults for empty hash", () => {
    expect(parseShareUrl("")).toEqual(DEFAULT_OPTIONS);
  });
  it("ignores unknown enum values", () => {
    const parsed = parseShareUrl("alg=unknown&dist=weird");
    expect(parsed.algorithm).toBe("mulberry32");
    expect(parsed.distribution).toBe("uniform");
  });
  it("round-trips CSPRNG flag", () => {
    const opts: GenerateOptions = { ...DEFAULT_OPTIONS, csprng: true };
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.csprng).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = PrngAlgorithm | Distribution;
