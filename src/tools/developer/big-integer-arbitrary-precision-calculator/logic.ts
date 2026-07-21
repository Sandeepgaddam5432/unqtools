/**
 * Big Integer Arbitrary-Precision Calculator — pure logic.
 *
 * Pure-JS BigInt-backed arithmetic (+, -, *, /, %, **, GCD, LCM, factorial,
 * Fibonacci), modular exponentiation, Miller-Rabin primality, base conversion
 * (binary / octal / decimal / hex / base-N up to 36), exact rational mode
 * (fractions kept as numerator/denominator), and a shunting-yard expression
 * parser with precedence and parentheses. 100% client-side, no libraries.
 *
 * No DOM, no network — pure functions only.
 */

// ---------- Types ----------

/** Supported numeric value: an exact integer or an exact rational. */
export type BigValue =
  | { kind: "int"; n: bigint }
  | { kind: "frac"; num: bigint; den: bigint };

/** Supported base for input / output. */
export type Base = 2 | 8 | 10 | 16;

/** Result of evaluating a full expression. */
export interface EvalResult {
  ok: boolean;
  value?: BigValue;
  error?: string;
  /** Decimal expansion (for fractions) or full integer string. */
  decimal?: string;
  /** Digit count of the absolute value (integer part for fractions). */
  digitCount?: number;
  /** Thousands-grouped display of the integer part. */
  grouped?: string;
  /** Scientific approximation, e.g. 1.234e+56. */
  scientific?: string;
  /** Same value rendered in binary. */
  binary?: string;
  /** Same value rendered in octal. */
  octal?: string;
  /** Same value rendered in hexadecimal. */
  hex?: string;
  /** Classification label. */
  label?: string;
}

/** History entry stored in localStorage. */
export interface HistoryEntry {
  ts: number;
  expression: string;
  decimal: string;
  digitCount: number;
}

// ---------- Constants ----------

export const SUPPORTED_BASES: Base[] = [2, 8, 10, 16];
export const MAX_BASE = 36;
export const FACTORIAL_INPUT_CAP = 50000; // safety bound
export const FIBONACCI_INPUT_CAP = 1_000_000; // safety bound
export const PRIME_TRIAL_PRIMES: bigint[] = (() => {
  // First 200 primes for trial division
  const primes: bigint[] = [];
  let n = 2n;
  while (primes.length < 200) {
    if (isPrimeSmall(n)) primes.push(n);
    n += 1n;
  }
  return primes;
})();

function isPrimeSmall(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n) return true;
  if (n % 2n === 0n) return false;
  let i = 3n;
  while (i * i <= n) {
    if (n % i === 0n) return false;
    i += 2n;
  }
  return true;
}

/** Preset expressions for quick testing. */
export const PRESETS: string[] = [
  "2^256",
  "10!",
  "fib(100)",
  "fib(500)",
  "100!",
  "gcd(123456789, 987654321)",
  "lcm(12, 18)",
  "modpow(2, 1000, 998244353)",
  "isprime(2^61 - 1)",
  "isprime(2^89 - 1)",
  "(2^127) - 1",
  "factorial(50)",
  "0x1FFFFFFFFFFFFFFF + 1",
  "0b11111111_11111111 in hex",
];

// ---------- Core bigint operations ----------

/** Add two BigValues. */
export function add(a: BigValue, b: BigValue): BigValue {
  const an = toFraction(a);
  const bn = toFraction(b);
  const num = an.num * bn.den + bn.num * an.den;
  const den = an.den * bn.den;
  return reduceFraction({ kind: "frac", num, den });
}

/** Subtract b from a. */
export function sub(a: BigValue, b: BigValue): BigValue {
  const an = toFraction(a);
  const bn = toFraction(b);
  const num = an.num * bn.den - bn.num * an.den;
  const den = an.den * bn.den;
  return reduceFraction({ kind: "frac", num, den });
}

/** Multiply two BigValues. */
export function mul(a: BigValue, b: BigValue): BigValue {
  const an = toFraction(a);
  const bn = toFraction(b);
  const num = an.num * bn.num;
  const den = an.den * bn.den;
  return reduceFraction({ kind: "frac", num, den });
}

/** Divide a by b. */
export function div(a: BigValue, b: BigValue): BigValue {
  const an = toFraction(a);
  const bn = toFraction(b);
  if (bn.num === 0n) throw new Error("division by zero");
  const num = an.num * bn.den;
  const den = an.den * bn.num;
  return reduceFraction({ kind: "frac", num, den });
}

/** Integer modulo (a mod b). Throws for non-integer inputs. */
export function mod(a: BigValue, b: BigValue): bigint {
  const an = asInt(a);
  const bn = asInt(b);
  if (bn === 0n) throw new Error("modulo by zero");
  // JS BigInt % can return negative for negative dividend; normalize to [0, |b|)
  const r = an % bn;
  if (r === 0n) return 0n;
  if ((r < 0n) !== (bn < 0n)) return r + bn;
  return r;
}

/** Integer division (a // b) — floored division matching Python semantics. */
export function intDiv(a: BigValue, b: BigValue): bigint {
  const an = asInt(a);
  const bn = asInt(b);
  if (bn === 0n) throw new Error("division by zero");
  // floor division
  if ((an < 0n) !== (bn < 0n) && an % bn !== 0n) {
    return an / bn - 1n;
  }
  return an / bn;
}

/** Exponentiation. Negative exponent yields a fraction (1 / base^|exp|). */
export function pow(a: BigValue, b: BigValue): BigValue {
  const an = asInt(a);
  const bn = asInt(b);
  if (bn < 0n) {
    if (an === 0n) throw new Error("0 raised to a negative power");
    return reduceFraction({ kind: "frac", num: 1n, den: an ** (-bn) });
  }
  return { kind: "int", n: an ** bn };
}

/** Modular exponentiation: a^b mod m. */
export function modpow(a: bigint, b: bigint, m: bigint): bigint {
  if (m === 0n) throw new Error("modpow with modulus 0");
  if (m === 1n) return 0n;
  if (m < 0n) throw new Error("modpow modulus must be non-negative");
  // Normalize a to [0, m)
  let base = ((a % m) + m) % m;
  let exp = b;
  let result = 1n;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m;
    exp >>= 1n;
    base = (base * base) % m;
  }
  return result;
}

/** Greatest common divisor (non-negative). */
export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y > 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Least common multiple. */
export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const g = gcd(a, b);
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  return (absA / g) * absB;
}

/** Factorial: n! for non-negative integer n. */
export function factorial(n: bigint): bigint {
  if (n < 0n) throw new Error("factorial of negative integer");
  if (n > BigInt(FACTORIAL_INPUT_CAP)) {
    throw new Error(`factorial input exceeds safety cap of ${FACTORIAL_INPUT_CAP}`);
  }
  let result = 1n;
  let i = 2n;
  while (i <= n) {
    result *= i;
    i += 1n;
  }
  return result;
}

/** Alias for factorial, used by `factorial(n)` in expression parser. */
export const factorialFn = factorial;

/** Fibonacci: F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2) for n>=2. Fast doubling. */
export function fibonacci(n: bigint): bigint {
  if (n < 0n) {
    // F(-n) = (-1)^(n+1) * F(n)
    const f = fibonacci(-n);
    return n % 2n === 0n ? -f : f;
  }
  if (n > BigInt(FIBONACCI_INPUT_CAP)) {
    throw new Error(`fibonacci input exceeds safety cap of ${FIBONACCI_INPUT_CAP}`);
  }
  // Fast doubling
  // F(2k) = F(k) * (2*F(k+1) - F(k))
  // F(2k+1) = F(k+1)^2 + F(k)^2
  function fib(k: bigint): [bigint, bigint] {
    if (k === 0n) return [0n, 1n];
    const [a, b] = fib(k >> 1n);
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (k & 1n) return [d, c + d];
    return [c, d];
  }
  return fib(n)[0];
}

// ---------- Primality (Miller-Rabin) ----------

/** Deterministic Miller-Rabin primality test for n < 3.3e24; probabilistic above. */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  // Trial division by first 200 primes
  for (const p of PRIME_TRIAL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  // Write n-1 = 2^r * d with d odd
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d >>= 1n;
    r += 1n;
  }
  // Deterministic witnesses for n < 3.317e24
  const det = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  // Above the deterministic bound, use probabilistic with 40 rounds
  const isOver = n > 3320n ** 5n; // > ~3.3e24 roughly
  const witnesses = isOver
    ? pickRandomWitnesses(n, 40)
    : det;
  for (const a of witnesses) {
    if (a % n === 0n) continue;
    if (!millerRabinRound(n, d, r, a)) return false;
  }
  return true;
}

function millerRabinRound(n: bigint, d: bigint, r: bigint, a: bigint): boolean {
  let x = modpow(a, d, n);
  if (x === 1n || x === n - 1n) return true;
  let i = 0n;
  while (i < r - 1n) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
    i += 1n;
  }
  return false;
}

function pickRandomWitnesses(n: bigint, k: number): bigint[] {
  // Deterministic pseudo-random witnesses using a simple LCG seeded from n.
  // Pure functions only — no Math.random (so tests are deterministic).
  const out: bigint[] = [];
  let seed = (n ^ 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  for (let i = 0; i < k; i++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
    const a = 2n + (seed % (n - 2n > 0n ? n - 2n : 2n));
    out.push(a);
  }
  return out;
}

// ---------- Base conversion ----------

/** Parse a string in the given base into a BigInt. */
export function parseBigInt(s: string, base: Base = 10): bigint {
  const cleaned = s.replace(/[_\s]/g, "");
  if (!cleaned) throw new Error("empty number");
  let sign = 1n;
  let body = cleaned;
  if (body.startsWith("-")) { sign = -1n; body = body.slice(1); }
  else if (body.startsWith("+")) { body = body.slice(1); }
  // Strip 0x / 0b / 0o prefixes if present and base matches
  if (base === 16 && /^0x/i.test(body)) body = body.slice(2);
  else if (base === 2 && /^0b/i.test(body)) body = body.slice(2);
  else if (base === 8 && /^0o/i.test(body)) body = body.slice(2);
  if (!body) throw new Error("empty number after prefix");
  if (base === 16) {
    if (!/^[0-9a-fA-F]+$/.test(body)) throw new Error(`invalid hex digit in "${s}"`);
    return sign * BigInt(`0x${body}`);
  }
  if (base === 2) {
    if (!/^[01]+$/.test(body)) throw new Error(`invalid binary digit in "${s}"`);
    return sign * BigInt(`0b${body}`);
  }
  if (base === 8) {
    if (!/^[0-7]+$/.test(body)) throw new Error(`invalid octal digit in "${s}"`);
    return sign * BigInt(`0o${body}`);
  }
  if (!/^[0-9]+$/.test(body)) throw new Error(`invalid decimal digit in "${s}"`);
  return sign * BigInt(body);
}

/** Render a BigInt in the given base. */
export function toBase(n: bigint, base: Base | number): string {
  if (base === 10) return n.toString(10);
  if (base === 16) {
    if (n < 0n) return "-" + (-n).toString(16).toUpperCase();
    return n.toString(16).toUpperCase();
  }
  if (base === 2) {
    if (n < 0n) return "-" + (-n).toString(2);
    return n.toString(2);
  }
  if (base === 8) {
    if (n < 0n) return "-" + (-n).toString(8);
    return n.toString(8);
  }
  // Custom base up to 36
  if (n < 0n) return "-" + toBase(-n, base);
  if (n === 0n) return "0";
  const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  let x = n;
  const b = BigInt(base);
  while (x > 0n) {
    out = digits[Number(x % b)] + out;
    x /= b;
  }
  return out;
}

/** Convert a string from one base to another. */
export function convertBase(s: string, fromBase: Base, toBaseArg: Base): string {
  const n = parseBigInt(s, fromBase);
  return toBase(n, toBaseArg);
}

// ---------- Display helpers ----------

/** Group integer string with `_` separators every 3 digits. */
export function groupDigits(s: string): string {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, "_");
  return neg ? `-${grouped}` : grouped;
}

/** Convert a BigValue to its fraction form (always num/den, den > 0). */
export function toFraction(v: BigValue): { num: bigint; den: bigint } {
  if (v.kind === "int") return { num: v.n, den: 1n };
  if (v.den < 0n) return { num: -v.num, den: -v.den };
  return { num: v.num, den: v.den };
}

/** Reduce a fraction to lowest terms with positive denominator. */
export function reduceFraction(v: BigValue): BigValue {
  if (v.kind !== "frac") return v;
  let { num, den } = v;
  if (den < 0n) { num = -num; den = -den; }
  if (num === 0n) return { kind: "int", n: 0n };
  const g = gcd(num < 0n ? -num : num, den);
  const rNum = num / g;
  const rDen = den / g;
  if (rDen === 1n) return { kind: "int", n: rNum };
  return { kind: "frac", num: rNum, den: rDen };
}

/** Coerce a BigValue to a bigint, throwing if it is a non-integer fraction. */
export function asInt(v: BigValue): bigint {
  if (v.kind === "int") return v.n;
  const r = reduceFraction(v);
  if (r.kind === "int") return r.n;
  throw new Error(`expected integer, got fraction ${r.num}/${r.den}`);
}

/** Compute the decimal expansion of a BigValue (exact for integers; truncated for fractions). */
export function toDecimalString(v: BigValue, maxFracDigits = 100): string {
  if (v.kind === "int") return v.n.toString(10);
  const { num, den } = toFraction(v);
  if (num < 0n) return "-" + toDecimalString({ kind: "frac", num: -num, den }, maxFracDigits);
  const wholePart = num / den;
  let rem = num % den;
  if (rem === 0n) return wholePart.toString(10);
  let frac = "";
  let i = 0;
  while (rem !== 0n && i < maxFracDigits) {
    rem *= 10n;
    frac += (rem / den).toString(10);
    rem = rem % den;
    i += 1;
  }
  // Detect repeating tail: simple heuristic — if rem loops back we should mark repeat.
  // For now, return truncated decimal; full repeat detection would be added later.
  return `${wholePart.toString(10)}.${frac}`;
}

/** Detect the repeating cycle of a fraction's decimal expansion. */
export function detectRepeat(v: BigValue, maxDigits = 1000): { prefix: string; repeat: string } | null {
  if (v.kind !== "frac") return null;
  let { num, den } = toFraction(v);
  if (num < 0n) num = -num;
  const wholePart = num / den;
  let rem = num % den;
  if (rem === 0n) return null;
  const seen = new Map<bigint, number>();
  const digits: string[] = [];
  let pos = 0;
  while (rem !== 0n && pos < maxDigits) {
    if (seen.has(rem)) {
      const start = seen.get(rem)!;
      return {
        prefix: digits.slice(0, start).join(""),
        repeat: digits.slice(start).join(""),
      };
    }
    seen.set(rem, pos);
    rem *= 10n;
    digits.push((rem / den).toString(10));
    rem = rem % den;
    pos += 1;
  }
  return null;
}

/** Scientific approximation: returns e.g. "1.234e+56". Rounds half-up. */
export function toScientific(v: BigValue, sigFigs = 6): string {
  if (sigFigs < 1) sigFigs = 1;
  const dec = toDecimalString(v, sigFigs + 4);
  const neg = dec.startsWith("-");
  const body = neg ? dec.slice(1) : dec;
  const dot = body.indexOf(".");
  const intDigits = dot === -1 ? body.length : dot;
  if (intDigits === 1 && body[0] === "0" && body.length > 1 && body[1] === ".") {
    // 0.xxx — find first non-zero
    let i = 2;
    while (i < body.length && body[i] === "0") i += 1;
    if (i >= body.length) return "0";
    const exp = -(i - 1);
    const sigStr = body.slice(i).replace(".", "");
    const rounded = roundSigFigs(sigStr, sigFigs);
    // Rounding may have changed the digit count (e.g. 9999 → 10000)
    let first = rounded[0];
    let rest = rounded.slice(1, sigFigs).padEnd(sigFigs - 1, "0");
    let expAdj = 0;
    if (rounded.length > sigFigs) {
      // carry made it longer — shift exponent
      first = rounded[0];
      rest = rounded.slice(1, sigFigs).padEnd(sigFigs - 1, "0");
      expAdj = 1;
    }
    return `${neg ? "-" : ""}${first}.${rest}e${exp + expAdj}`;
  }
  const exp = intDigits - 1;
  // All significant digits (no decimal point)
  const sigStr = (body.slice(0, intDigits) + (dot !== -1 ? body.slice(intDigits + 1) : "")).slice(0, sigFigs + 4);
  const rounded = roundSigFigs(sigStr, sigFigs);
  let firstDigit = rounded[0];
  let rest = rounded.slice(1, sigFigs).padEnd(sigFigs - 1, "0");
  let expAdj = 0;
  if (rounded.length > sigFigs) {
    // carry increased digit count — shift exponent up by 1
    firstDigit = rounded[0];
    rest = rounded.slice(1, sigFigs).padEnd(sigFigs - 1, "0");
    expAdj = 1;
  }
  if (exp + expAdj === 0) {
    return `${neg ? "-" : ""}${firstDigit}.${rest}e0`;
  }
  return `${neg ? "-" : ""}${firstDigit}.${rest}e${exp + expAdj >= 0 ? "+" : ""}${exp + expAdj}`;
}

/** Round a digit string to `n` significant digits, half-up. Returns string of length <= n+1. */
function roundSigFigs(digits: string, n: number): string {
  if (digits.length <= n) return digits.padEnd(n, "0");
  const truncated = digits.slice(0, n);
  const next = parseInt(digits[n], 10);
  if (next < 5) return truncated;
  // Round up — increment with carry
  const arr = truncated.split("").map((c) => parseInt(c, 10));
  let carry = 1;
  for (let i = arr.length - 1; i >= 0 && carry; i--) {
    arr[i] += 1;
    if (arr[i] >= 10) { arr[i] = 0; carry = 1; }
    else carry = 0;
  }
  const prefix = carry ? "1" : "";
  return prefix + arr.join("");
}

/** Digit count of the absolute value of an integer (or integer part of a fraction). */
export function digitCount(v: BigValue): number {
  const n = v.kind === "int" ? v.n : (v.num / v.den);
  const abs = n < 0n ? -n : n;
  if (abs === 0n) return 1;
  return abs.toString(10).length;
}

/** Classify a BigValue. */
export function classify(v: BigValue): string {
  if (v.kind === "int") {
    if (v.n === 0n) return "zero";
    if (v.n === 1n) return "one";
    if (v.n === -1n) return "minus one";
    if (v.n > 0n) return "positive integer";
    return "negative integer";
  }
  const { num, den } = v;
  if (num === 0n) return "zero";
  if (den === 1n) return num > 0n ? "positive integer" : "negative integer";
  return num > 0n ? "positive fraction" : "negative fraction";
}

// ---------- Expression parser (shunting-yard) ----------

/** Token types. */
type Tok =
  | { t: "num"; v: BigValue; raw: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "comma" }
  | { t: "ident"; v: string };

const PRECEDENCE: Record<string, number> = {
  "+": 2, "-": 2,
  "*": 3, "/": 3, "%": 3,
  "**": 4, "^": 4,
  u_neg: 6, u_pos: 6,
  "!": 7,
};

const RIGHT_ASSOC = new Set(["**", "^"]);

/** Tokenize an expression. Supports 0x, 0b, 0o prefixes, decimal ints, fractions, ops, parens, idents. */
export function tokenize(expr: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = expr;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "_") {
      i += 1;
      continue;
    }
    if (ch === "(") { out.push({ t: "lparen" }); i += 1; continue; }
    if (ch === ")") { out.push({ t: "rparen" }); i += 1; continue; }
    if (ch === ",") { out.push({ t: "comma" }); i += 1; continue; }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") {
      // Detect "**" or "^"-style exponent
      if (ch === "*" && s[i + 1] === "*") {
        out.push({ t: "op", v: "**" });
        i += 2;
        continue;
      }
      out.push({ t: "op", v: ch });
      i += 1;
      continue;
    }
    if (ch === "^") {
      out.push({ t: "op", v: "**" });
      i += 1;
      continue;
    }
    if (ch === "!") {
      // Postfix factorial operator
      out.push({ t: "op", v: "!" });
      i += 1;
      continue;
    }
    // Identifier (function name) — letters, digits, underscore; starts with letter
    if (/[a-zA-Z]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j += 1;
      const id = s.slice(i, j).toLowerCase();
      out.push({ t: "ident", v: id });
      i = j;
      continue;
    }
    // Number — possibly with prefix; allow embedded underscores for readability
    if (/[0-9]/.test(ch)) {
      let j = i;
      // Check for prefix
      if (ch === "0" && (s[j + 1] === "x" || s[j + 1] === "X")) {
        j += 2;
        while (j < s.length && /[0-9a-fA-F_]/.test(s[j])) j += 1;
        const raw = s.slice(i, j).replace(/_/g, "");
        const n = parseBigInt(raw, 16);
        out.push({ t: "num", v: { kind: "int", n }, raw });
        i = j;
        continue;
      }
      if (ch === "0" && (s[j + 1] === "b" || s[j + 1] === "B")) {
        j += 2;
        while (j < s.length && /[01_]/.test(s[j])) j += 1;
        const raw = s.slice(i, j).replace(/_/g, "");
        const n = parseBigInt(raw, 2);
        out.push({ t: "num", v: { kind: "int", n }, raw });
        i = j;
        continue;
      }
      if (ch === "0" && (s[j + 1] === "o" || s[j + 1] === "O")) {
        j += 2;
        while (j < s.length && /[0-7_]/.test(s[j])) j += 1;
        const raw = s.slice(i, j).replace(/_/g, "");
        const n = parseBigInt(raw, 8);
        out.push({ t: "num", v: { kind: "int", n }, raw });
        i = j;
        continue;
      }
      // Plain decimal, possibly fractional (1/2 etc. handled by parser via "/")
      while (j < s.length && /[0-9_]/.test(s[j])) j += 1;
      const raw = s.slice(i, j).replace(/_/g, "");
      const n = parseBigInt(raw, 10);
      out.push({ t: "num", v: { kind: "int", n }, raw });
      i = j;
      continue;
    }
    throw new Error(`unexpected character '${ch}' at position ${i}`);
  }
  return out;
}

/** Convert infix tokens to RPN via shunting-yard. */
export function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const opStack: Tok[] = [];
  let prev: Tok | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.t === "num") {
      out.push(tok);
    } else if (tok.t === "ident") {
      // Function call — push to op stack
      opStack.push(tok);
    } else if (tok.t === "comma") {
      while (opStack.length > 0 && opStack[opStack.length - 1].t !== "lparen") {
        out.push(opStack.pop()!);
      }
      if (opStack.length === 0) throw new Error("misplaced comma or unbalanced parens");
    } else if (tok.t === "op") {
      // Postfix factorial — goes directly to output (binds to the previous operand)
      if (tok.v === "!") {
        out.push(tok);
        prev = tok;
        continue;
      }
      // Handle unary minus / plus
      const isUnary = (tok.v === "-" || tok.v === "+") &&
        (prev === null || prev.t === "op" || prev.t === "lparen" || prev.t === "comma");
      if (isUnary) {
        const uTok: Tok = { t: "op", v: tok.v === "-" ? "u_neg" : "u_pos" };
        // Pop higher-or-equal precedence ops from the stack (left-assoc rule)
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].t === "op" &&
          PRECEDENCE[opStack[opStack.length - 1].v] >= PRECEDENCE[uTok.v]
        ) {
          out.push(opStack.pop()!);
        }
        opStack.push(uTok);
      } else {
        const curPrec = PRECEDENCE[tok.v];
        const isRight = RIGHT_ASSOC.has(tok.v);
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].t === "op" &&
          (
            isRight
              ? PRECEDENCE[opStack[opStack.length - 1].v] > curPrec
              : PRECEDENCE[opStack[opStack.length - 1].v] >= curPrec
          )
        ) {
          out.push(opStack.pop()!);
        }
        opStack.push(tok);
      }
    } else if (tok.t === "lparen") {
      opStack.push(tok);
    } else if (tok.t === "rparen") {
      while (opStack.length > 0 && opStack[opStack.length - 1].t !== "lparen") {
        out.push(opStack.pop()!);
      }
      if (opStack.length === 0) throw new Error("unbalanced parentheses");
      opStack.pop(); // discard lparen
      // If function on top of stack, pop it to output
      if (opStack.length > 0 && opStack[opStack.length - 1].t === "ident") {
        out.push(opStack.pop()!);
      }
    }
    prev = tok;
  }
  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top.t === "lparen" || top.t === "rparen") throw new Error("unbalanced parentheses");
    out.push(top);
  }
  return out;
}

/** Evaluate an RPN token stream. */
export function evalRpn(rpn: Tok[]): BigValue {
  const stack: BigValue[] = [];
  for (const tok of rpn) {
    if (tok.t === "num") {
      stack.push(tok.v);
    } else if (tok.t === "op") {
      if (tok.v === "!") {
        const a = stackPopRequired(stack, "!");
        const an = asInt(a);
        stack.push({ kind: "int", n: factorial(an) });
        continue;
      }
      if (tok.v === "u_neg") {
        const a = stackPopRequired(stack, "u_neg");
        stack.push(sub({ kind: "int", n: 0n }, a));
        continue;
      }
      if (tok.v === "u_pos") {
        continue; // no-op
      }
      const b = stackPopRequired(stack, tok.v);
      const a = stackPopRequired(stack, tok.v);
      let r: BigValue;
      if (tok.v === "+") r = add(a, b);
      else if (tok.v === "-") r = sub(a, b);
      else if (tok.v === "*") r = mul(a, b);
      else if (tok.v === "/") r = div(a, b);
      else if (tok.v === "%") {
        r = { kind: "int", n: mod(a, b) };
      } else if (tok.v === "**" || tok.v === "^") r = pow(a, b);
      else throw new Error(`unknown operator '${tok.v}'`);
      stack.push(r);
    } else if (tok.t === "ident") {
      // Function call: pop args
      const name = tok.v;
      if (name === "gcd") {
        const b = asInt(stackPopRequired(stack, "gcd"));
        const a = asInt(stackPopRequired(stack, "gcd"));
        stack.push({ kind: "int", n: gcd(a, b) });
      } else if (name === "lcm") {
        const b = asInt(stackPopRequired(stack, "lcm"));
        const a = asInt(stackPopRequired(stack, "lcm"));
        stack.push({ kind: "int", n: lcm(a, b) });
      } else if (name === "factorial" || name === "fact") {
        const a = asInt(stackPopRequired(stack, "factorial"));
        stack.push({ kind: "int", n: factorial(a) });
      } else if (name === "fib" || name === "fibonacci") {
        const a = asInt(stackPopRequired(stack, "fib"));
        stack.push({ kind: "int", n: fibonacci(a) });
      } else if (name === "isprime") {
        const a = asInt(stackPopRequired(stack, "isprime"));
        stack.push({ kind: "int", n: isPrime(a) ? 1n : 0n });
      } else if (name === "modpow") {
        const m = asInt(stackPopRequired(stack, "modpow"));
        const b = asInt(stackPopRequired(stack, "modpow"));
        const a = asInt(stackPopRequired(stack, "modpow"));
        stack.push({ kind: "int", n: modpow(a, b, m) });
      } else if (name === "abs") {
        const a = stackPopRequired(stack, "abs");
        const an = asInt(a);
        stack.push({ kind: "int", n: an < 0n ? -an : an });
      } else if (name === "min") {
        const b = stackPopRequired(stack, "min");
        const a = stackPopRequired(stack, "min");
        const an = asInt(a);
        const bn = asInt(b);
        stack.push({ kind: "int", n: an < bn ? an : bn });
      } else if (name === "max") {
        const b = stackPopRequired(stack, "max");
        const a = stackPopRequired(stack, "max");
        const an = asInt(a);
        const bn = asInt(b);
        stack.push({ kind: "int", n: an > bn ? an : bn });
      } else {
        throw new Error(`unknown function '${name}'`);
      }
    } else {
      throw new Error(`unexpected token in RPN: ${JSON.stringify(tok)}`);
    }
  }
  if (stack.length !== 1) throw new Error(`invalid expression — stack has ${stack.length} items`);
  return stack[0];
}

function stackPopRequired(stack: BigValue[], ctx: string): BigValue {
  const v = stack.pop();
  if (v === undefined) throw new Error(`stack underflow in ${ctx}`);
  return v;
}

/** Evaluate a full expression string. */
export function evaluateExpression(expr: string): EvalResult {
  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) {
      return { ok: false, error: "empty expression" };
    }
    const rpn = toRpn(tokens);
    const v = evalRpn(rpn);
    const dec = toDecimalString(v);
    const repeat = detectRepeat(v);
    const dc = digitCount(v);
    return {
      ok: true,
      value: v,
      decimal: repeat
        ? `${dec}... (repeat: ${repeat.prefix}(${repeat.repeat}))`
        : dec,
      digitCount: dc,
      grouped: v.kind === "int" ? groupDigits(v.n.toString(10)) : groupDigits(dec),
      scientific: toScientific(v),
      binary: v.kind === "int" ? toBase(v.n, 2) : "(fraction)",
      octal: v.kind === "int" ? toBase(v.n, 8) : "(fraction)",
      hex: v.kind === "int" ? toBase(v.n, 16) : "(fraction)",
      label: classify(v),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Evaluate a single two-operand arithmetic operation. */
export function evalBinary(
  a: BigValue, op: "+" | "-" | "*" | "/" | "%" | "**", b: BigValue,
): BigValue {
  switch (op) {
    case "+": return add(a, b);
    case "-": return sub(a, b);
    case "*": return mul(a, b);
    case "/": return div(a, b);
    case "%": return { kind: "int", n: mod(a, b) };
    case "**": return pow(a, b);
  }
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:bigint-calc:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(expression: string): string {
  const params = new URLSearchParams();
  if (expression) params.set("expr", expression);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { expression: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { expression: "" };
  const params = new URLSearchParams(clean);
  return { expression: params.get("expr") ?? "" };
}

// ---------- Parsing helpers for the UI ----------

/** Parse user input as a BigValue (int or fraction). */
export function parseBigValue(s: string): BigValue {
  const trimmed = s.trim();
  if (!trimmed) throw new Error("empty input");
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length !== 2) throw new Error("invalid fraction");
    const num = parseBigInt(parts[0].trim(), 10);
    const den = parseBigInt(parts[1].trim(), 10);
    if (den === 0n) throw new Error("fraction denominator is zero");
    return reduceFraction({ kind: "frac", num, den });
  }
  return { kind: "int", n: parseBigInt(trimmed, 10) };
}

/** Format a BigValue for display. */
export function formatBigValue(v: BigValue): string {
  if (v.kind === "int") return v.n.toString(10);
  return `${v.num}/${v.den}`;
}

/** Format a BigInt with thousand separators. */
export function formatGrouped(n: bigint): string {
  return groupDigits(n.toString(10));
}
