import { describe, it, expect, beforeEach } from "vitest";
import {
  DETERMINISTIC_WITNESSES,
  DETERMINISTIC_THRESHOLD,
  SMALL_PRIMES,
  PROBABILISTIC_ROUNDS,
  parseBigInt,
  formatBigInt,
  toHex,
  modPow,
  millerRabinWitness,
  isPrimeDetailed,
  isPrime,
  pollardRho,
  factorize,
  verifyFactorization,
  renderExponentForm,
  factorTree,
  divisorCount,
  divisorSum,
  eulerTotient,
  computeStats,
  sieveOfEratosthenes,
  nextPrime,
  previousPrime,
  primeGaps,
  twinPrimes,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Operation,
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

describe("prime-number-checker constants", () => {
  it("has 12 deterministic Miller–Rabin witnesses", () => {
    expect(DETERMINISTIC_WITNESSES).toHaveLength(12);
    expect(DETERMINISTIC_WITNESSES).toContain(2n);
    expect(DETERMINISTIC_WITNESSES).toContain(37n);
  });
  it("has a deterministic threshold around 3.3 × 10^24", () => {
    expect(DETERMINISTIC_THRESHOLD).toBeGreaterThan(10n ** 24n);
  });
  it("has 100+ small primes for trial division", () => {
    expect(SMALL_PRIMES.length).toBeGreaterThanOrEqual(100);
    expect(SMALL_PRIMES[0]).toBe(2n);
  });
  it("uses 20 probabilistic rounds", () => {
    expect(PROBABILISTIC_ROUNDS).toBe(20);
  });
});

describe("prime-number-checker parseBigInt & formatBigInt", () => {
  it("parses valid integers", () => {
    expect(parseBigInt("123")).toBe(123n);
    expect(parseBigInt("-456")).toBe(-456n);
    expect(parseBigInt("  789  ")).toBe(789n);
  });
  it("throws on invalid input", () => {
    expect(() => parseBigInt("")).toThrow();
    expect(() => parseBigInt("12.5")).toThrow();
    expect(() => parseBigInt("abc")).toThrow();
  });
  it("formats without grouping by default", () => {
    expect(formatBigInt(1234567n)).toBe("1234567");
  });
  it("formats with grouping when requested", () => {
    expect(formatBigInt(1234567n, true)).toBe("1,234,567");
    expect(formatBigInt(-1234567n, true)).toBe("-1,234,567");
  });
  it("toHex renders uppercase hex with padding", () => {
    expect(toHex(255n, 4)).toBe("00FF");
    expect(toHex(16n, 0)).toBe("10");
  });
});

describe("prime-number-checker modPow", () => {
  it("computes 2^10 mod 1000", () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n);
  });
  it("handles exp = 0", () => {
    expect(modPow(5n, 0n, 7n)).toBe(1n);
  });
  it("handles m = 1 (always 0)", () => {
    expect(modPow(5n, 100n, 1n)).toBe(0n);
  });
  it("throws on non-positive modulus", () => {
    expect(() => modPow(5n, 3n, 0n)).toThrow();
    expect(() => modPow(5n, 3n, -7n)).toThrow();
  });
});

describe("prime-number-checker Miller–Rabin witness", () => {
  it("detects 15 as composite (witness 2)", () => {
    expect(millerRabinWitness(15n, 2n)).toBe(true);
  });
  it("passes 13 as prime (no witness among small bases)", () => {
    expect(millerRabinWitness(13n, 2n)).toBe(false);
    expect(millerRabinWitness(13n, 5n)).toBe(false);
  });
  it("detects 561 (Carmichael number) as composite", () => {
    // 561 is the smallest Carmichael number; trial division alone misses it.
    expect(millerRabinWitness(561n, 2n)).toBe(true);
  });
});

describe("prime-number-checker isPrimeDetailed", () => {
  it("handles edge cases (0, 1, 2)", () => {
    expect(isPrimeDetailed(0n).label).toBe("non-positive");
    expect(isPrimeDetailed(1n).label).toBe("unit");
    expect(isPrimeDetailed(2n).isPrime).toBe(true);
  });
  it("identifies small primes", () => {
    for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 97n, 101n, 997n]) {
      expect(isPrimeDetailed(p).isPrime).toBe(true);
      expect(isPrimeDetailed(p).certainty).toBe("deterministic");
    }
  });
  it("identifies small composites with a witness", () => {
    const r = isPrimeDetailed(15n);
    expect(r.isPrime).toBe(false);
    expect(r.witness).toBeDefined();
    expect(r.certainty).toBe("deterministic");
  });
  it("detects Carmichael number 561 as composite", () => {
    expect(isPrimeDetailed(561n).isPrime).toBe(false);
  });
  it("handles large prime (Mersenne prime 2^31 − 1 = 2147483647)", () => {
    const r = isPrimeDetailed(2147483647n);
    expect(r.isPrime).toBe(true);
    expect(r.certainty).toBe("deterministic");
  });
  it("detects a large composite (2147483647 × 2147483647 + 2)", () => {
    // 2147483647^2 + 2 is even — trivially composite but a sanity check.
    const n = 2147483647n * 2147483647n + 2n;
    expect(isPrimeDetailed(n).isPrime).toBe(false);
  });
  it("isPrime boolean wrapper agrees with detailed", () => {
    expect(isPrime(13n)).toBe(true);
    expect(isPrime(15n)).toBe(false);
  });
});

describe("prime-number-checker pollardRho", () => {
  it("finds a factor of a small composite", () => {
    const d = pollardRho(15n);
    expect(d).toBe(3n); // 15 = 3 × 5; trial-division-style return
  });
  it("finds a factor of a semiprime", () => {
    const n = 101n * 103n; // 10403
    const d = pollardRho(n);
    expect(d).not.toBeNull();
    expect(n % d!).toBe(0n);
  });
  it("returns 2 for even input", () => {
    expect(pollardRho(100n)).toBe(2n);
  });
});

describe("prime-number-checker factorize", () => {
  it("returns empty factors for 0 and 1", () => {
    expect(factorize(0n).factors).toEqual([]);
    expect(factorize(1n).factors).toEqual([]);
  });
  it("returns a single prime for a prime input", () => {
    const r = factorize(13n);
    expect(r.factors).toEqual([{ prime: 13n, exponent: 1 }]);
    expect(r.isPrime).toBe(true);
    expect(r.verified).toBe(true);
  });
  it("factorizes 360 = 2^3 × 3^2 × 5", () => {
    const r = factorize(360n);
    expect(r.factors).toEqual([
      { prime: 2n, exponent: 3 },
      { prime: 3n, exponent: 2 },
      { prime: 5n, exponent: 1 },
    ]);
    expect(r.verified).toBe(true);
    expect(r.exponentForm).toBe("360 = 2^3 × 3^2 × 5");
  });
  it("factorizes a perfect power 1024 = 2^10", () => {
    const r = factorize(1024n);
    expect(r.factors).toEqual([{ prime: 2n, exponent: 10 }]);
  });
  it("factorizes a larger semiprime", () => {
    const p = 1000003n;
    const q = 1000033n;
    const n = p * q;
    const r = factorize(n);
    expect(r.verified).toBe(true);
    expect(r.factors).toHaveLength(2);
    expect(r.factors.map((f) => f.prime).sort()).toEqual([p, q].sort((a, b) => (a < b ? -1 : 1)));
  });
  it("handles negatives by factoring the absolute value", () => {
    const r = factorize(-360n);
    expect(r.factors.map((f) => f.prime)).toEqual([2n, 3n, 5n]);
    expect(r.n).toBe(-360n);
    expect(r.verified).toBe(true);
  });
});

describe("prime-number-checker verifyFactorization & renderExponentForm", () => {
  it("verifies a correct factorization", () => {
    expect(verifyFactorization(360n, [
      { prime: 2n, exponent: 3 },
      { prime: 3n, exponent: 2 },
      { prime: 5n, exponent: 1 },
    ])).toBe(true);
  });
  it("rejects an incorrect factorization", () => {
    expect(verifyFactorization(360n, [{ prime: 2n, exponent: 1 }])).toBe(false);
  });
  it("renders exponent form for n < 2", () => {
    expect(renderExponentForm(0n, [])).toBe("0");
    expect(renderExponentForm(1n, [])).toBe("1");
  });
  it("renders single prime", () => {
    expect(renderExponentForm(13n, [{ prime: 13n, exponent: 1 }])).toBe("13 = 13");
  });
});

describe("prime-number-checker factorTree", () => {
  it("returns a prime leaf for prime inputs", () => {
    const t = factorTree(13n);
    expect(t.value).toBe(13n);
    expect(t.isPrime).toBe(true);
    expect(t.factor).toBeUndefined();
  });
  it("splits 12 into 2 and 6, then 6 into 2 and 3", () => {
    const t = factorTree(12n);
    expect(t.value).toBe(12n);
    expect(t.isPrime).toBe(false);
    expect(t.factor).toBe(2n);
    expect(t.quotient).toBe(6n);
    expect(t.factorChild?.value).toBe(2n);
    expect(t.factorChild?.isPrime).toBe(true);
    expect(t.quotientChild?.value).toBe(6n);
    expect(t.quotientChild?.isPrime).toBe(false);
    expect(t.quotientChild?.factor).toBe(2n);
    expect(t.quotientChild?.quotient).toBe(3n);
    expect(t.quotientChild?.quotientChild?.isPrime).toBe(true);
  });
});

describe("prime-number-checker divisorCount", () => {
  it("τ(1) = 1", () => { expect(divisorCount(1n)).toBe(1n); });
  it("τ(12) = 6 (1,2,3,4,6,12)", () => { expect(divisorCount(12n)).toBe(6n); });
  it("τ(360) = (3+1)(2+1)(1+1) = 24", () => { expect(divisorCount(360n)).toBe(24n); });
  it("τ(prime) = 2", () => { expect(divisorCount(13n)).toBe(2n); });
});

describe("prime-number-checker divisorSum", () => {
  it("σ(1) = 1", () => { expect(divisorSum(1n)).toBe(1n); });
  it("σ(6) = 12 (perfect number: 1+2+3+6)", () => { expect(divisorSum(6n)).toBe(12n); });
  it("σ(12) = 28 (1+2+3+4+6+12)", () => { expect(divisorSum(12n)).toBe(28n); });
  it("σ(28) = 56 (perfect)", () => { expect(divisorSum(28n)).toBe(56n); });
  it("σ(prime p) = p + 1", () => { expect(divisorSum(13n)).toBe(14n); });
});

describe("prime-number-checker eulerTotient", () => {
  it("φ(1) = 1", () => { expect(eulerTotient(1n)).toBe(1n); });
  it("φ(prime) = prime − 1", () => {
    expect(eulerTotient(13n)).toBe(12n);
    expect(eulerTotient(7n)).toBe(6n);
  });
  it("φ(9) = 6 (1,2,4,5,7,8 coprime to 9)", () => { expect(eulerTotient(9n)).toBe(6n); });
  it("φ(360) = 96", () => { expect(eulerTotient(360n)).toBe(96n); });
});

describe("prime-number-checker computeStats", () => {
  it("combines all three stats", () => {
    const s = computeStats(360n);
    expect(s.divisorCount).toBe(24n);
    expect(s.divisorSum).toBe(1170n); // 1+2+3+4+5+6+8+9+10+12+15+18+20+24+30+36+40+45+60+72+90+120+180+360
    expect(s.eulerTotient).toBe(96n);
  });
});

describe("prime-number-checker sieveOfEratosthenes", () => {
  it("returns [] for limit < 2", () => {
    expect(sieveOfEratosthenes(1)).toEqual([]);
  });
  it("returns [2] for limit = 2", () => {
    expect(sieveOfEratosthenes(2)).toEqual([2n]);
  });
  it("returns primes up to 30", () => {
    expect(sieveOfEratosthenes(30)).toEqual([2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n]);
  });
  it("returns 25 primes below 100", () => {
    expect(sieveOfEratosthenes(100)).toHaveLength(25);
  });
});

describe("prime-number-checker nextPrime & previousPrime", () => {
  it("nextPrime(10) = 11", () => { expect(nextPrime(10n)).toBe(11n); });
  it("nextPrime(13) = 17 (strictly greater)", () => { expect(nextPrime(13n)).toBe(17n); });
  it("nextPrime(0) = 2", () => { expect(nextPrime(0n)).toBe(2n); });
  it("previousPrime(13) = 11 (strictly less)", () => { expect(previousPrime(13n)).toBe(11n); });
  it("previousPrime(2) = null", () => { expect(previousPrime(2n)).toBeNull(); });
  it("previousPrime(3) = 2", () => { expect(previousPrime(3n)).toBe(2n); });
});

describe("prime-number-checker primeGaps", () => {
  it("finds prime gaps in [2, 30]", () => {
    const gaps = primeGaps(2n, 30n, 2n);
    // Gaps between consecutive primes: 2→3 (1), 3→5 (2), 5→7 (2), 7→11 (4), 11→13 (2), 13→17 (4), 17→19 (2), 19→23 (4), 23→29 (6)
    const allGaps = primeGaps(2n, 30n, 1n);
    expect(allGaps.length).toBe(9); // 9 transitions between 10 primes ≤ 29
    expect(allGaps.find((g) => g.lower === 23n && g.upper === 29n)?.gap).toBe(6n);
  });
  it("respects minGap filter", () => {
    const gaps = primeGaps(2n, 30n, 4n);
    expect(gaps.every((g) => g.gap >= 4n)).toBe(true);
    expect(gaps.length).toBeGreaterThan(0);
  });
  it("respects maxResults cap", () => {
    const gaps = primeGaps(2n, 1000n, 2n, 3);
    expect(gaps.length).toBeLessThanOrEqual(3);
  });
});

describe("prime-number-checker twinPrimes", () => {
  it("finds (3,5), (5,7), (11,13) etc. in [2, 30]", () => {
    const pairs = twinPrimes(2n, 30n);
    expect(pairs).toContainEqual({ lower: 3n, upper: 5n });
    expect(pairs).toContainEqual({ lower: 5n, upper: 7n });
    expect(pairs).toContainEqual({ lower: 11n, upper: 13n });
    expect(pairs).toContainEqual({ lower: 17n, upper: 19n });
  });
  it("finds (29, 31) when range includes 31", () => {
    const pairs = twinPrimes(2n, 31n);
    expect(pairs).toContainEqual({ lower: 29n, upper: 31n });
  });
  it("respects maxResults cap", () => {
    const pairs = twinPrimes(2n, 1000n, 2);
    expect(pairs.length).toBeLessThanOrEqual(2);
  });
  it("returns empty for range with no twin primes", () => {
    const pairs = twinPrimes(24n, 28n);
    expect(pairs).toEqual([]);
  });
});

describe("prime-number-checker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, operation: "is-prime", input: "13", result: "prime" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, operation: "factorize", input: `${i}`, result: "ok" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, operation: "is-prime", input: "13", result: "prime" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("prime-number-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ operation: "factorize", input: "360" });
    expect(url).toContain("op=factorize");
    expect(url).toContain("n=360");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("op=factorize&n=360");
    expect(p.operation).toBe("factorize");
    expect(p.input).toBe("360");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ operation: "is-prime", input: "" });
  });
  it("filters unknown operations", () => {
    const p = parseShareUrl("op=bogus&n=42");
    expect(p.operation).toBe("is-prime");
  });
});

// Suppress unused-import lint
export type _Unused = Operation;
