import { describe, it, expect, beforeEach } from "vitest";
import {
  SUPPORTED_BASES,
  MAX_BASE,
  PRESETS,
  add, sub, mul, div, mod, intDiv, pow, modpow,
  gcd, lcm, factorial, fibonacci,
  isPrime, parseBigInt, toBase, convertBase,
  groupDigits, toFraction, reduceFraction, asInt,
  toDecimalString, detectRepeat, toScientific, digitCount, classify,
  tokenize, toRpn, evalRpn, evaluateExpression, evalBinary,
  parseBigValue, formatBigValue, formatGrouped,
  loadHistory, saveHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type BigValue, type Base, type HistoryEntry,
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

const int = (n: bigint): BigValue => ({ kind: "int", n });
const frac = (num: bigint, den: bigint): BigValue => ({ kind: "frac", num, den });

describe("bigint-calc constants", () => {
  it("exposes the 4 supported bases", () => {
    expect(SUPPORTED_BASES).toEqual([2, 8, 10, 16]);
  });
  it("exposes max base 36", () => {
    expect(MAX_BASE).toBe(36);
  });
  it("exposes presets for quick testing", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(PRESETS).toContain("2^256");
  });
});

describe("bigint-calc basic arithmetic", () => {
  it("adds two ints", () => {
    expect(add(int(2n), int(3n))).toEqual(int(5n));
  });
  it("adds two fractions", () => {
    expect(add(frac(1n, 2n), frac(1n, 3n))).toEqual(frac(5n, 6n));
  });
  it("subtracts", () => {
    expect(sub(int(10n), int(7n))).toEqual(int(3n));
  });
  it("multiplies ints", () => {
    expect(mul(int(6n), int(7n))).toEqual(int(42n));
  });
  it("multiplies fractions and reduces", () => {
    expect(mul(frac(2n, 3n), frac(3n, 4n))).toEqual(frac(1n, 2n));
  });
  it("divides exactly to int", () => {
    expect(div(int(10n), int(2n))).toEqual(int(5n));
  });
  it("divides to a reduced fraction", () => {
    expect(div(int(1n), int(3n))).toEqual(frac(1n, 3n));
  });
  it("divides by zero throws", () => {
    expect(() => div(int(1n), int(0n))).toThrow();
  });
  it("mod returns non-negative remainder", () => {
    expect(mod(int(-7n), int(3n))).toBe(2n);
    expect(mod(int(7n), int(3n))).toBe(1n);
  });
  it("mod by zero throws", () => {
    expect(() => mod(int(7n), int(0n))).toThrow();
  });
  it("intDiv uses floor semantics", () => {
    expect(intDiv(int(-7n), int(3n))).toBe(-3n);
    expect(intDiv(int(7n), int(3n))).toBe(2n);
  });
  it("pow with non-negative exponent", () => {
    expect(pow(int(2n), int(10n))).toEqual(int(1024n));
  });
  it("pow with negative exponent yields a fraction", () => {
    expect(pow(int(2n), int(-3n))).toEqual(frac(1n, 8n));
  });
  it("evalBinary covers all operators", () => {
    expect(evalBinary(int(2n), "+", int(3n))).toEqual(int(5n));
    expect(evalBinary(int(5n), "-", int(2n))).toEqual(int(3n));
    expect(evalBinary(int(4n), "*", int(3n))).toEqual(int(12n));
    expect(evalBinary(int(7n), "/", int(2n))).toEqual(frac(7n, 2n));
    expect(evalBinary(int(7n), "%", int(3n))).toEqual(int(1n));
    expect(evalBinary(int(2n), "**", int(5n))).toEqual(int(32n));
  });
});

describe("bigint-calc modular and number theory", () => {
  it("modpow works for small values", () => {
    expect(modpow(2n, 10n, 1000n)).toBe(24n);
  });
  it("modpow with modulus 1 returns 0", () => {
    expect(modpow(2n, 100n, 1n)).toBe(0n);
  });
  it("modpow normalizes negative base", () => {
    expect(modpow(-2n, 3n, 5n)).toBe(2n); // (-2)^3 = -8 ≡ 2 (mod 5) after normalization
  });
  it("gcd of coprime is 1", () => {
    expect(gcd(7n, 13n)).toBe(1n);
  });
  it("gcd of multiples", () => {
    expect(gcd(12n, 18n)).toBe(6n);
  });
  it("gcd of negatives is positive", () => {
    expect(gcd(-12n, 18n)).toBe(6n);
  });
  it("lcm", () => {
    expect(lcm(4n, 6n)).toBe(12n);
  });
  it("lcm with zero is zero", () => {
    expect(lcm(0n, 5n)).toBe(0n);
  });
  it("factorial of 0 is 1", () => {
    expect(factorial(0n)).toBe(1n);
  });
  it("factorial of 10 is 3628800", () => {
    expect(factorial(10n)).toBe(3628800n);
  });
  it("factorial of negative throws", () => {
    expect(() => factorial(-1n)).toThrow();
  });
  it("fibonacci F(0)=0, F(1)=1, F(10)=55", () => {
    expect(fibonacci(0n)).toBe(0n);
    expect(fibonacci(1n)).toBe(1n);
    expect(fibonacci(10n)).toBe(55n);
  });
  it("fibonacci F(100) is the known value", () => {
    expect(fibonacci(100n)).toBe(354224848179261915075n);
  });
});

describe("bigint-calc primality", () => {
  it("detects small primes", () => {
    expect(isPrime(2n)).toBe(true);
    expect(isPrime(17n)).toBe(true);
    expect(isPrime(1n)).toBe(false);
    expect(isPrime(4n)).toBe(false);
  });
  it("detects Mersenne prime 2^61 - 1", () => {
    expect(isPrime((2n ** 61n) - 1n)).toBe(true);
  });
  it("detects composites near Mersenne", () => {
    expect(isPrime((2n ** 60n) - 1n)).toBe(false);
  });
  it("detects Carmichael number 561 as composite", () => {
    expect(isPrime(561n)).toBe(false);
  });
});

describe("bigint-calc base conversion", () => {
  it("parseBigInt handles decimal", () => {
    expect(parseBigInt("123", 10)).toBe(123n);
  });
  it("parseBigInt handles hex with 0x prefix", () => {
    expect(parseBigInt("0xFF", 16)).toBe(255n);
  });
  it("parseBigInt handles binary with 0b prefix", () => {
    expect(parseBigInt("0b1010", 2)).toBe(10n);
  });
  it("parseBigInt handles octal with 0o prefix", () => {
    expect(parseBigInt("0o17", 8)).toBe(15n);
  });
  it("parseBigInt handles underscores for readability", () => {
    expect(parseBigInt("1_000_000", 10)).toBe(1000000n);
  });
  it("parseBigInt rejects invalid hex", () => {
    expect(() => parseBigInt("0xGHIJ", 16)).toThrow();
  });
  it("parseBigInt handles negative numbers", () => {
    expect(parseBigInt("-42", 10)).toBe(-42n);
  });
  it("toBase renders hex uppercase", () => {
    expect(toBase(255n, 16)).toBe("FF");
  });
  it("toBase renders binary", () => {
    expect(toBase(10n, 2)).toBe("1010");
  });
  it("toBase renders octal", () => {
    expect(toBase(8n, 8)).toBe("10");
  });
  it("toBase handles negative", () => {
    expect(toBase(-255n, 16)).toBe("-FF");
  });
  it("convertBase flips between bases", () => {
    expect(convertBase("255", 10, 16)).toBe("FF");
    expect(convertBase("FF", 16, 2)).toBe("11111111");
  });
  it("toBase supports base 36", () => {
    expect(toBase(35n, 36)).toBe("Z");
    expect(toBase(36n, 36)).toBe("10");
  });
});

describe("bigint-calc display helpers", () => {
  it("groupDigits groups every 3 digits", () => {
    expect(groupDigits("1000000")).toBe("1_000_000");
    expect(groupDigits("-1000000")).toBe("-1_000_000");
  });
  it("toFraction of int returns den=1", () => {
    expect(toFraction(int(5n))).toEqual({ num: 5n, den: 1n });
  });
  it("reduceFraction normalizes sign", () => {
    expect(reduceFraction(frac(-2n, -4n))).toEqual(frac(1n, 2n));
    expect(reduceFraction(frac(2n, -4n))).toEqual(frac(-1n, 2n));
  });
  it("reduceFraction collapses to int when den=1", () => {
    expect(reduceFraction(frac(10n, 2n))).toEqual(int(5n));
  });
  it("asInt throws on non-integer fraction", () => {
    expect(() => asInt(frac(1n, 2n))).toThrow();
    expect(asInt(frac(10n, 2n))).toBe(5n);
  });
  it("toDecimalString of fraction is exact decimal", () => {
    expect(toDecimalString(frac(1n, 2n))).toBe("0.5");
    expect(toDecimalString(frac(1n, 4n))).toBe("0.25");
  });
  it("toDecimalString of 1/3 truncates without repeating marker", () => {
    expect(toDecimalString(frac(1n, 3n), 5)).toBe("0.33333");
  });
  it("detectRepeat finds the cycle of 1/3", () => {
    const r = detectRepeat(frac(1n, 3n));
    expect(r).not.toBeNull();
    expect(r!.prefix).toBe("");
    expect(r!.repeat).toBe("3");
  });
  it("detectRepeat finds the cycle of 1/7", () => {
    const r = detectRepeat(frac(1n, 7n));
    expect(r).not.toBeNull();
    expect(r!.repeat).toBe("142857");
  });
  it("toScientific formats large integer", () => {
    const s = toScientific(int(123456789n));
    expect(s).toBe("1.23457e+8");
  });
  it("digitCount of int", () => {
    expect(digitCount(int(0n))).toBe(1);
    expect(digitCount(int(999n))).toBe(3);
    expect(digitCount(int(-999n))).toBe(3);
  });
  it("classify labels", () => {
    expect(classify(int(0n))).toBe("zero");
    expect(classify(int(5n))).toBe("positive integer");
    expect(classify(int(-5n))).toBe("negative integer");
    expect(classify(frac(1n, 2n))).toBe("positive fraction");
  });
});

describe("bigint-calc expression parser", () => {
  it("tokenizes numbers and operators", () => {
    const toks = tokenize("2 + 3");
    expect(toks).toHaveLength(3);
    expect(toks[0]).toMatchObject({ t: "num" });
    expect(toks[1]).toMatchObject({ t: "op", v: "+" });
  });
  it("tokenizes 0x hex", () => {
    const toks = tokenize("0xFF + 1");
    expect((toks[0] as { v: BigValue }).v).toEqual(int(255n));
  });
  it("tokenizes identifiers", () => {
    const toks = tokenize("gcd(12, 18)");
    expect(toks[0]).toMatchObject({ t: "ident", v: "gcd" });
  });
  it("evaluates simple addition", () => {
    expect(evaluateExpression("2 + 3").value).toEqual(int(5n));
  });
  it("respects operator precedence", () => {
    expect(evaluateExpression("2 + 3 * 4").value).toEqual(int(14n));
  });
  it("respects parentheses", () => {
    expect(evaluateExpression("(2 + 3) * 4").value).toEqual(int(20n));
  });
  it("evaluates exponentiation right-associative", () => {
    expect(evaluateExpression("2 ** 3 ** 2").value).toEqual(int(512n));
  });
  it("evaluates unary minus", () => {
    expect(evaluateExpression("-5 + 2").value).toEqual(int(-3n));
  });
  it("evaluates gcd function", () => {
    expect(evaluateExpression("gcd(12, 18)").value).toEqual(int(6n));
  });
  it("evaluates factorial function", () => {
    expect(evaluateExpression("factorial(5)").value).toEqual(int(120n));
  });
  it("evaluates fib function", () => {
    expect(evaluateExpression("fib(10)").value).toEqual(int(55n));
  });
  it("evaluates modpow function", () => {
    expect(evaluateExpression("modpow(2, 10, 1000)").value).toEqual(int(24n));
  });
  it("evaluates isprime function", () => {
    expect(evaluateExpression("isprime(17)").value).toEqual(int(1n));
    expect(evaluateExpression("isprime(15)").value).toEqual(int(0n));
  });
  it("produces exact fraction for 1/3", () => {
    expect(evaluateExpression("1 / 3").value).toEqual(frac(1n, 3n));
  });
  it("chains fraction arithmetic exactly", () => {
    expect(evaluateExpression("(1/3) + (1/6)").value).toEqual(frac(1n, 2n));
  });
  it("evaluates 2^256 correctly", () => {
    const r = evaluateExpression("2^256");
    expect(r.ok).toBe(true);
    expect(r.value).toEqual(int(115792089237316195423570985008687907853269984665640564039457584007913129639936n));
    expect(r.digitCount).toBe(78);
    expect(r.hex).toBe("10000000000000000000000000000000000000000000000000000000000000000");
  });
  it("produces error for empty expression", () => {
    expect(evaluateExpression("").ok).toBe(false);
  });
  it("produces error for unknown function", () => {
    expect(evaluateExpression("foo(1)").ok).toBe(false);
  });
  it("produces error for unbalanced parens", () => {
    expect(evaluateExpression("(2 + 3").ok).toBe(false);
  });
  it("produces error for division by zero", () => {
    expect(evaluateExpression("1 / 0").ok).toBe(false);
  });
  it("returns scientific and grouped display", () => {
    const r = evaluateExpression("10!");
    expect(r.ok).toBe(true);
    expect(r.scientific).toContain("e+");
    expect(r.grouped).toContain("_");
  });
});

describe("bigint-calc parseBigValue / formatBigValue", () => {
  it("parses int", () => {
    expect(parseBigValue("42")).toEqual(int(42n));
  });
  it("parses fraction and reduces", () => {
    expect(parseBigValue("2/4")).toEqual(frac(1n, 2n));
  });
  it("rejects zero denominator", () => {
    expect(() => parseBigValue("1/0")).toThrow();
  });
  it("formats int", () => {
    expect(formatBigValue(int(42n))).toBe("42");
  });
  it("formats fraction", () => {
    expect(formatBigValue(frac(1n, 2n))).toBe("1/2");
  });
  it("formatGrouped adds separators", () => {
    expect(formatGrouped(1000000n)).toBe("1_000_000");
  });
});

describe("bigint-calc history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, expression: "2+2", decimal: "4", digitCount: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, expression: `${i}+1`, decimal: `${i + 1}`, digitCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, expression: "x", decimal: "1", digitCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bigint-calc shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("2^256");
    expect(url).toContain("expr=2%5E256");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("expr=2%5E256");
    expect(p.expression).toBe("2^256");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ expression: "" });
  });
});

// Suppress unused-import lint
export type _Unused = Base | HistoryEntry;
