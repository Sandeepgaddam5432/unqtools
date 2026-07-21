/**
 * IEEE 754 Floating-Point Converter — pure logic.
 *
 * Convert between decimal (or hex-float) input and IEEE 754 binary
 * representations for binary16 (half), binary32 (single), binary64 (double),
 * and binary128 (quad) precision. Pure functions only — no DOM, no network.
 *
 * Implementation notes:
 *   - binary16 / 32 / 64 use typed-array bit-pattern extraction (DataView).
 *   - binary128 has no native JS type, so a BigInt-based round-to-nearest-even
 *     path is used for both encoding (decimal string → bits) and decoding
 *     (bits → exact decimal string).
 *   - The "exact stored decimal" is computed via BigInt math so it is correct
 *     to the last digit (not a re-printed JS number).
 */

export type Precision = "binary16" | "binary32" | "binary64" | "binary128";

export type ValueClass =
  | "normal"
  | "subnormal"
  | "zero"
  | "inf"
  | "qnan"
  | "snan";

export interface FormatInfo {
  precision: Precision;
  totalBits: number;
  expBits: number;
  mantBits: number;
  bias: number;
  eMax: number; // largest normal exponent (unbiased)
  eMin: number; // smallest normal exponent (unbiased) = 1 - bias
}

export const FORMAT_INFO: Record<Precision, FormatInfo> = {
  binary16:  { precision: "binary16",  totalBits: 16,  expBits: 5,  mantBits: 10,  bias: 15,    eMax: 16,    eMin: -14 },
  binary32:  { precision: "binary32",  totalBits: 32,  expBits: 8,  mantBits: 23,  bias: 127,   eMax: 128,   eMin: -126 },
  binary64:  { precision: "binary64",  totalBits: 64,  expBits: 11, mantBits: 52,  bias: 1023,  eMax: 1024,  eMin: -1022 },
  binary128: { precision: "binary128", totalBits: 128, expBits: 15, mantBits: 112, bias: 16383, eMax: 16384, eMin: -16382 },
};

export const PRECISION_ORDER: Precision[] = ["binary16", "binary32", "binary64", "binary128"];

export interface DecodedFields {
  sign: 0 | 1;
  exponent: number; // stored exponent bits as integer (0 .. 2^expBits - 1)
  mantissa: bigint; // mantissa bits as bigint (0 .. 2^mantBits - 1)
  unbiasedExp: number | null; // actual exponent (null if inf / nan)
  class: ValueClass;
}

export interface RoundingError {
  absolute: string; // |input - stored| as exact decimal string
  relative: string | null; // |input - stored| / |input|, or null if input is 0
}

export interface ConversionResult {
  precision: Precision;
  bits: bigint;
  hex: string; // uppercase, no 0x prefix
  binary: string; // totalBits long, MSB first
  fields: DecodedFields;
  storedValue: string; // exact decimal of stored value (or "±inf" / "NaN")
  jsValue: number; // JS number approximation (NaN/Infinity for binary128 overflow)
  inputParsed: string; // canonical decimal form of the input (for error calc)
  roundingError: RoundingError;
}

// ---- bit helpers ----

/** Mask of `n` low bits set. */
export function mask(n: number): bigint {
  return (1n << BigInt(n)) - 1n;
}

/** Get bit `i` (0 = LSB) of a bigint. */
export function getBit(value: bigint, i: number): 0 | 1 {
  return ((value >> BigInt(i)) & 1n) === 1n ? 1 : 0;
}

/** Toggle bit `i` (0 = LSB) of a bigint. */
export function toggleBit(value: bigint, i: number): bigint {
  return value ^ (1n << BigInt(i));
}

/** Convert a bigint to a fixed-width binary string (MSB first). */
export function toBinaryString(value: bigint, width: number): string {
  let s = "";
  let v = value & mask(width);
  for (let i = width - 1; i >= 0; i--) {
    s += getBit(v, i).toString();
  }
  return s;
}

/** Convert a bigint to an uppercase hex string of the right width. */
export function toHexString(value: bigint, width: number): string {
  const hexChars = Math.ceil(width / 4);
  const v = value & mask(width);
  return v.toString(16).toUpperCase().padStart(hexChars, "0");
}

/** Parse a hex / binary / decimal string into a bigint bit pattern. */
export function parseBits(input: string, width: number): bigint {
  const s = (input || "").trim().toLowerCase();
  if (!s) return 0n;
  let v: bigint;
  if (s.startsWith("0x")) v = BigInt(s);
  else if (s.startsWith("0b")) v = BigInt("0b" + s.slice(2));
  else if (/^[01]+$/.test(s) && s.length === width) v = BigInt("0b" + s);
  else if (/^-?\d+$/.test(s)) v = BigInt(s);
  else throw new Error(`Cannot parse bit string: ${input}`);
  return v & mask(width);
}

// ---- field extraction ----

export function decodeFields(bits: bigint, precision: Precision): DecodedFields {
  const info = FORMAT_INFO[precision];
  const mantMask = mask(info.mantBits);
  const expMask = mask(info.expBits);
  const sign = ((bits >> BigInt(info.totalBits - 1)) & 1n) === 1n ? 1 : 0;
  const exponent = Number((bits >> BigInt(info.mantBits)) & expMask);
  const mantissa = bits & mantMask;
  const maxExp = (1 << info.expBits) - 1; // all-ones exponent
  let cls: ValueClass;
  let unbiasedExp: number | null;
  if (exponent === 0) {
    if (mantissa === 0n) {
      cls = "zero";
      unbiasedExp = null;
    } else {
      cls = "subnormal";
      unbiasedExp = info.eMin;
    }
  } else if (exponent === maxExp) {
    if (mantissa === 0n) {
      cls = "inf";
    } else {
      // MSB of mantissa set => qNaN, else sNaN
      const msb = (mantissa >> BigInt(info.mantBits - 1)) & 1n;
      cls = msb === 1n ? "qnan" : "snan";
    }
    unbiasedExp = null;
  } else {
    cls = "normal";
    unbiasedExp = exponent - info.bias;
  }
  return { sign, exponent, mantissa, unbiasedExp, class: cls };
}

// ---- exact decimal reconstruction via BigInt ----

/**
 * Compute the exact decimal representation of `m * 2^exp2`, where m is signed
 * BigInt and exp2 is a (possibly negative) BigInt. Returns the value as a
 * decimal string (no scientific notation), correct to the last digit.
 */
export function bigIntTimesPowerOfTwo(m: bigint, exp2: bigint): string {
  if (m === 0n) return "0";
  const sign = m < 0n;
  const mag = sign ? -m : m;
  let s: string;
  if (exp2 >= 0n) {
    s = (mag << exp2).toString(10);
  } else {
    const k = -exp2;
    // value = mag * 2^(-k) = mag * 5^k / 10^k
    let fivePow = 1n;
    for (let i = 0n; i < k; i++) fivePow *= 5n;
    const numerator = mag * fivePow;
    let str = numerator.toString(10).padStart(Number(k) + 1, "0");
    const cut = str.length - Number(k);
    const intPart = str.slice(0, cut);
    const fracPart = str.slice(cut).replace(/0+$/, "");
    s = fracPart ? `${intPart}.${fracPart}` : intPart;
  }
  return sign ? `-${s}` : s;
}

/** Exact decimal string of the value encoded by `bits` at the given precision. */
export function exactDecimalValue(bits: bigint, precision: Precision): string {
  const info = FORMAT_INFO[precision];
  const f = decodeFields(bits, precision);
  if (f.class === "zero") return f.sign === 1 ? "-0" : "0";
  if (f.class === "inf") return f.sign === 1 ? "-Infinity" : "Infinity";
  if (f.class === "qnan" || f.class === "snan") return "NaN";
  const signMul = f.sign === 1 ? -1n : 1n;
  if (f.class === "subnormal") {
    // value = sign * mantissa * 2^(1 - bias - mantBits)
    const exp2 = BigInt(1 - info.bias - info.mantBits);
    return bigIntTimesPowerOfTwo(signMul * f.mantissa, exp2);
  }
  // normal: value = sign * (2^mantBits + mantissa) * 2^(unbiasedExp - mantBits)
  const mantWithImplicit = (1n << BigInt(info.mantBits)) | f.mantissa;
  const exp2 = BigInt((f.unbiasedExp as number) - info.mantBits);
  return bigIntTimesPowerOfTwo(signMul * mantWithImplicit, exp2);
}

// ---- typed-array conversion for binary16 / 32 / 64 ----

function float32ToBits(value: number): bigint {
  const buf = new ArrayBuffer(4);
  new Float32Array(buf)[0] = value;
  return BigInt(new Uint32Array(buf)[0]);
}

function bitsToFloat32(bits: bigint): number {
  const buf = new ArrayBuffer(4);
  new Uint32Array(buf)[0] = Number(bits & 0xffffffffn);
  return new Float32Array(buf)[0];
}

function float64ToBits(value: number): bigint {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = value;
  const u32 = new Uint32Array(buf);
  // little-endian: u32[0] = low 32, u32[1] = high 32
  return (BigInt(u32[1]) << 32n) | BigInt(u32[0]);
}

function bitsToFloat64(bits: bigint): number {
  const buf = new ArrayBuffer(8);
  const u32 = new Uint32Array(buf);
  u32[0] = Number(bits & 0xffffffffn);
  u32[1] = Number((bits >> 32n) & 0xffffffffn);
  return new Float64Array(buf)[0];
}

/**
 * Convert a binary64 bit pattern to a binary16 bit pattern using
 * round-to-nearest-even. Algorithm is the classic float32→float16 reduction
 * adapted to start from float64 via float32 (which is exact for the in-range
 * subset and saturates correctly outside it).
 */
function float64BitsToHalfBits(bits64: bigint): bigint {
  // First reduce float64 -> float32 (round-to-nearest-even is the JS default).
  const f32 = bitsToFloat64(bits64);
  // NaN / Inf preservation
  if (Number.isNaN(f32)) return 0x7E00n; // qNaN
  if (f32 === Infinity) return f32 > 0 ? 0x7C00n : 0xFC00n;
  if (f32 === 0) return Object.is(f32, -0) ? 0x8000n : 0x0000n;
  const sign = f32 < 0 ? 1 : 0;
  const mag = Math.abs(f32);
  // binary16 subnormal threshold: 2^-24 (smallest subnormal)
  if (mag < Math.pow(2, -24)) {
    return BigInt(sign) << 15n;
  }
  // Use float32 bits for exact extraction.
  const bits32 = float32ToBits(f32);
  const exp32 = Number((bits32 >> 23n) & 0xFFn);
  const mant32 = bits32 & 0x7FFFFFn;
  const unbiasedExp = exp32 - 127;
  if (unbiasedExp > 15) {
    // overflow to infinity
    return (BigInt(sign) << 15n) | 0x7C00n;
  }
  if (unbiasedExp >= -14) {
    // normal-range binary16
    const mant16Raw = Number(mant32 >> 13n);
    const roundBit = Number((mant32 >> 12n) & 1n);
    const sticky = (mant32 & 0xFFFn) !== 0n ? 1 : 0;
    let mant16 = mant16Raw;
    if (roundBit === 1 && (sticky === 1 || (mant16Raw & 1) === 1)) {
      mant16 += 1;
    }
    if (mant16 === 0x400) {
      // overflow into next exponent
      const newStoredExp = unbiasedExp + 1 + 15;
      if (newStoredExp >= 31) return (BigInt(sign) << 15n) | 0x7C00n;
      return (BigInt(sign) << 15n) | (BigInt(newStoredExp) << 10n);
    }
    return (BigInt(sign) << 15n) | (BigInt(unbiasedExp + 15) << 10n) | BigInt(mant16);
  }
  // subnormal-range binary16
  const shift = 14 + unbiasedExp; // negative or zero
  // fullMant = 2^23 + mant32  (24-bit value with implicit leading 1)
  const fullMant = (1n << 23n) | mant32;
  const sh = -shift; // positive
  if (sh >= 24) {
    // way below subnormal range, flush to zero
    return BigInt(sign) << 15n;
  }
  const mant16Raw = Number(fullMant >> BigInt(sh));
  const roundBit = sh > 0 ? Number((fullMant >> BigInt(sh - 1)) & 1n) : 0;
  const stickyLow = sh > 1 ? (fullMant & ((1n << BigInt(sh - 1)) - 1n)) !== 0n : false;
  const sticky = stickyLow ? 1 : 0;
  let mant16 = mant16Raw;
  if (roundBit === 1 && (sticky === 1 || (mant16Raw & 1) === 1)) {
    mant16 += 1;
  }
  if (mant16 === 0x400) {
    // overflow into normal range (exp = 1, mantissa = 0)
    return (BigInt(sign) << 15n) | (1n << 10n);
  }
  return (BigInt(sign) << 15n) | BigInt(mant16);
}

function halfBitsToFloat64(bits16: bigint): number {
  const sign = Number((bits16 >> 15n) & 1n);
  const exp = Number((bits16 >> 10n) & 0x1Fn);
  const mant = Number(bits16 & 0x3FFn);
  const signMul = sign === 1 ? -1 : 1;
  if (exp === 0) {
    if (mant === 0) return sign === 1 ? -0 : 0;
    // subnormal: value = mant * 2^-24
    return signMul * mant * Math.pow(2, -24);
  }
  if (exp === 0x1F) {
    if (mant === 0) return sign === 1 ? -Infinity : Infinity;
    return NaN;
  }
  // normal: value = (1 + mant/2^10) * 2^(exp - 15)
  return signMul * (1 + mant / 1024) * Math.pow(2, exp - 15);
}

// ---- decimal-string parsing (exact rational) ----

/**
 * Parse a decimal string into a (numerator, denominator) BigInt pair. Accepts
 * optional leading sign, decimal point, and exponent (e.g. "1.5e-3").
 */
export function parseDecimalString(input: string): { num: bigint; den: bigint; isZero: boolean; sign: 0 | 1 } {
  const s = (input || "").trim();
  if (!s) throw new Error("Empty input");
  let sign: 0 | 1 = 0;
  let body = s;
  if (body.startsWith("-")) { sign = 1; body = body.slice(1); }
  else if (body.startsWith("+")) { body = body.slice(1); }
  // split exponent
  let expPart = 0;
  const eIdx = body.search(/[eE]/);
  if (eIdx >= 0) {
    expPart = parseInt(body.slice(eIdx + 1), 10);
    body = body.slice(0, eIdx);
  }
  if (!/^\d*(\.\d*)?$|^\d+\.$/.test(body) || body === "." || body === "") {
    throw new Error(`Invalid decimal: ${input}`);
  }
  const dotIdx = body.indexOf(".");
  let intPart: string;
  let fracPart: string;
  if (dotIdx < 0) { intPart = body; fracPart = ""; }
  else { intPart = body.slice(0, dotIdx); fracPart = body.slice(dotIdx + 1); }
  const digits = (intPart + fracPart).replace(/^0+/, "") || "0";
  const num = BigInt(digits);
  // denominator = 10^(fracPart.length) shifted by expPart
  const fracLen = fracPart.length;
  const effExp = expPart - fracLen;
  let den: bigint;
  if (effExp >= 0) {
    den = 1n;
    let n = num;
    for (let i = 0; i < effExp; i++) n *= 10n;
    return { num: n, den, isZero: num === 0n, sign };
  } else {
    den = 1n;
    for (let i = 0; i < -effExp; i++) den *= 10n;
    return { num, den, isZero: num === 0n, sign };
  }
}

// ---- hex-float parsing ----

/**
 * Parse a C99 / JS hex-float literal like `0x1.8p+3` (= 12.0) into a JS number.
 * Returns NaN if unparseable.
 */
export function parseHexFloat(input: string): number {
  const s = (input || "").trim().toLowerCase();
  if (!s.startsWith("0x")) return NaN;
  const pIdx = s.indexOf("p");
  let mantStr: string;
  let expStr: string;
  if (pIdx < 0) { mantStr = s.slice(2); expStr = "0"; }
  else { mantStr = s.slice(2, pIdx); expStr = s.slice(pIdx + 1); }
  const dotIdx = mantStr.indexOf(".");
  let intPart: string;
  let fracPart: string;
  if (dotIdx < 0) { intPart = mantStr; fracPart = ""; }
  else { intPart = mantStr.slice(0, dotIdx); fracPart = mantStr.slice(dotIdx + 1); }
  if (!/^[0-9a-f]*$/.test(intPart) || !/^[0-9a-f]*$/.test(fracPart)) return NaN;
  const intVal = intPart ? parseInt(intPart, 16) : 0;
  let fracVal = 0;
  for (let i = 0; i < fracPart.length; i++) {
    fracVal += parseInt(fracPart[i], 16) * Math.pow(16, -(i + 1));
  }
  const mantVal = intVal + fracVal;
  const exp = parseInt(expStr || "0", 10);
  return mantVal * Math.pow(2, exp);
}

/** Format a non-NaN JS number as a hex-float literal at the given precision. */
export function formatHexFloat(value: number, precision: Precision): string {
  if (!Number.isFinite(value)) return value > 0 ? "Infinity" : value < 0 ? "-Infinity" : "NaN";
  const sign = value < 0 ? "-" : "";
  const mag = Math.abs(value);
  if (mag === 0) return `${sign}0x0p+0`;
  const e = Math.floor(Math.log2(mag));
  const mant = mag / Math.pow(2, e);
  // mant is in [1, 2). Build the hex mantissa digit-by-digit.
  let intPart = "1";
  let fracPart = "";
  let rem = mant - 1;
  for (let i = 0; i < 12 && rem > 0; i++) {
    rem *= 16;
    const d = Math.floor(rem);
    fracPart += d.toString(16);
    rem -= d;
  }
  const mantStr = fracPart ? `${intPart}.${fracPart}` : intPart;
  const expSign = e >= 0 ? "+" : "-";
  const expAbs = Math.abs(e).toString();
  return `${sign}0x${mantStr}p${expSign}${expAbs}`;
}

// ---- binary128 BigInt encoding (round-to-nearest-even) ----

/**
 * Encode a decimal string into binary128 bits using round-to-nearest-even.
 * Returns the 128-bit pattern as a bigint.
 */
export function decimalToBinary128Bits(input: string): bigint {
  const parsed = parseDecimalString(input);
  if (parsed.isZero) {
    return BigInt(parsed.sign) << 127n;
  }
  const info = FORMAT_INFO.binary128;
  const signBit = BigInt(parsed.sign) << 127n;
  const numAbs = parsed.num;
  const denAbs = parsed.den;
  // value = numAbs / denAbs, find exponent e such that 1 <= value/2^e < 2
  // i.e. 2^e <= numAbs/denAbs < 2^(e+1)
  // <=> 2^e * denAbs <= numAbs < 2^(e+1) * denAbs
  // Use bit_length to estimate.
  const numBits = numAbs.toString(2).length;
  const denBits = denAbs.toString(2).length;
  // value ~= 2^(numBits - denBits), so start e near there
  let e = numBits - denBits;
  // helper to test bound
  const le = (a: bigint, b: bigint) => a <= b;
  const lt = (a: bigint, b: bigint) => a < b;
  // Find e such that 2^e <= value < 2^(e+1), i.e.
  //   2^e * denAbs <= numAbs < 2^(e+1) * denAbs
  // For e >= 0 both sides scale linearly; for e < 0 we multiply numAbs by 2^(-e).
  let safety = 0;
  while (safety < 5000) {
    safety++;
    if (e < info.eMin) break; // subnormal range — no need to pin e precisely
    if (e > info.eMax + 1) break; // overflow — handled below
    let lowerOk: boolean;
    let upperOk: boolean;
    if (e >= 0) {
      const lhs = (1n << BigInt(e)) * denAbs;
      lowerOk = le(lhs, numAbs);
      const lhs2 = (1n << BigInt(e + 1)) * denAbs;
      upperOk = lt(numAbs, lhs2);
    } else {
      const sh = BigInt(-e);
      lowerOk = le(denAbs, numAbs << sh);
      // upperOk: numAbs < 2^(e+1) * denAbs
      //   if e+1 >= 0: numAbs < (1 << (e+1)) * denAbs
      //   if e+1 < 0 (i.e. e <= -2): numAbs * 2^(-(e+1)) < denAbs
      if (e + 1 >= 0) {
        upperOk = lt(numAbs, (1n << BigInt(e + 1)) * denAbs);
      } else {
        const sh2 = BigInt(-(e + 1));
        upperOk = lt(numAbs << sh2, denAbs);
      }
    }
    if (lowerOk && upperOk) break;
    if (!lowerOk) e -= 1; else e += 1;
  }
  // Now value = (numAbs/denAbs) = (1 + frac) * 2^e, where 0 <= frac < 1
  // mantissa = frac * 2^112 (with round-to-nearest-even)
  // frac = numAbs / (denAbs * 2^e) - 1 = (numAbs - denAbs * 2^e) / (denAbs * 2^e)
  // mantissa (scaled) = (numAbs - denAbs * 2^e) * 2^112 / (denAbs * 2^e)
  //                  = (numAbs - denAbs * 2^e) * 2^(112 - e) / denAbs
  // For e <= 112: numerator = (numAbs - denAbs * 2^e) * 2^(112 - e), divide by denAbs
  // For e > 112: numerator = (numAbs - denAbs * 2^e), divide by (denAbs * 2^(e - 112))
  // Check overflow first
  if (e > info.eMax) {
    // overflow to infinity: all-ones exponent, zero mantissa
    return signBit | (mask(info.expBits) << BigInt(info.mantBits));
  }
  // Compute the mantissa numerator/denominator.
  // For normal range: mantissa = (numAbs - denAbs * 2^e) * 2^(112 - e) / denAbs
  // For e < 0 we substitute 2^e = 1/2^(-e) and rearrange to keep integer math:
  //   mantissa = (numAbs * 2^(-e) - denAbs) * 2^112 / denAbs
  let numerator: bigint;
  let denominator: bigint;
  if (e >= info.eMin) {
    // normal range
    if (e >= 0) {
      const implicitTerm = (1n << BigInt(e)) * denAbs; // denAbs * 2^e
      const fracNum = numAbs - implicitTerm; // numAbs - denAbs * 2^e (>= 0)
      if (e <= 112) {
        numerator = fracNum * (1n << BigInt(112 - e));
        denominator = denAbs;
      } else {
        numerator = fracNum;
        denominator = denAbs * (1n << BigInt(e - 112));
      }
    } else {
      // e < 0: substitute 2^e = 1/2^(-e)
      const k = BigInt(-e);
      const numAbsShifted = numAbs << k; // numAbs * 2^(-e)
      const fracNum = numAbsShifted - denAbs; // numAbs * 2^(-e) - denAbs
      numerator = fracNum * (1n << BigInt(112));
      denominator = denAbs;
    }
  } else {
    // subnormal range: value = (mantissa / 2^112) * 2^eMin
    // mantissa = value * 2^112 / 2^eMin = numAbs * 2^112 / (denAbs * 2^eMin)
    //         = numAbs * 2^(112 - eMin) / denAbs   (since eMin < 0, 112 - eMin > 112)
    const k = 112 - info.eMin; // 112 + 16382 = 16494
    numerator = numAbs * (1n << BigInt(k));
    denominator = denAbs;
    e = info.eMin; // for storedExp calc below
  }
  // Round numerator / denominator to nearest, ties to even
  const q = numerator / denominator;
  const r = numerator - q * denominator;
  const twiceR = r * 2n;
  let mantissa = q;
  if (twiceR > denominator) {
    mantissa = q + 1n;
  } else if (twiceR === denominator) {
    // tie: round to even
    if (q % 2n === 1n) mantissa = q + 1n;
  }
  // Handle overflow of mantissa
  const mantMax = 1n << BigInt(info.mantBits); // 2^112
  if (e >= info.eMin) {
    // normal: mantissa should be < 2^112
    if (mantissa >= mantMax) {
      // carry: increment exponent
      mantissa = 0n;
      e += 1;
      if (e > info.eMax) {
        return signBit | (mask(info.expBits) << BigInt(info.mantBits));
      }
    }
    const storedExp = BigInt(e + info.bias);
    return signBit | (storedExp << BigInt(info.mantBits)) | mantissa;
  } else {
    // subnormal: mantissa should be <= 2^112 - 1
    if (mantissa >= mantMax) {
      // overflow into smallest normal
      return signBit | (1n << 112n);
    }
    if (mantissa === 0n) {
      // flushed to zero
      return signBit;
    }
    return signBit | mantissa;
  }
}

// ---- top-level conversion ----

export interface ParsedInput {
  kind: "decimal" | "hexfloat" | "inf" | "nan" | "empty";
  sign: 0 | 1;
  canonicalDecimal: string; // for error computation; "inf" / "nan" for special
  jsValue: number; // JS approximation
}

/** Parse a raw input string into a structured input. */
export function parseInput(input: string): ParsedInput {
  const s = (input || "").trim();
  if (!s) return { kind: "empty", sign: 0, canonicalDecimal: "0", jsValue: 0 };
  const lower = s.toLowerCase();
  if (lower === "inf" || lower === "+inf" || lower === "infinity") {
    return { kind: "inf", sign: 0, canonicalDecimal: "Infinity", jsValue: Infinity };
  }
  if (lower === "-inf" || lower === "-infinity") {
    return { kind: "inf", sign: 1, canonicalDecimal: "-Infinity", jsValue: -Infinity };
  }
  if (lower === "nan" || lower === "+nan") {
    return { kind: "nan", sign: 0, canonicalDecimal: "NaN", jsValue: NaN };
  }
  if (lower === "-nan") {
    return { kind: "nan", sign: 1, canonicalDecimal: "NaN", jsValue: NaN };
  }
  if (lower.startsWith("0x")) {
    const v = parseHexFloat(s);
    if (Number.isNaN(v)) throw new Error(`Invalid hex float: ${input}`);
    return {
      kind: "hexfloat",
      sign: v < 0 || (v === 0 && s.startsWith("-")) ? 1 : 0,
      canonicalDecimal: v.toString(),
      jsValue: v,
    };
  }
  // decimal
  const parsed = parseDecimalString(s);
  // canonical form: just use original string with leading sign normalized
  const canonical = (parsed.sign === 1 ? "-" : "") + (s.replace(/^\+/, "").replace(/^-/, "").replace(/^0+/, "") || "0");
  const jsVal = parseFloat(s);
  return {
    kind: "decimal",
    sign: parsed.sign,
    canonicalDecimal: canonical === "-0" ? "0" : canonical,
    jsValue: jsVal,
  };
}

/** Encode a parsed input into bits at the given precision. */
export function encodeBits(parsed: ParsedInput, precision: Precision): bigint {
  const info = FORMAT_INFO[precision];
  const signBit = BigInt(parsed.sign) << BigInt(info.totalBits - 1);
  if (parsed.kind === "inf") {
    // all-ones exponent, zero mantissa
    const exp = mask(info.expBits) << BigInt(info.mantBits);
    return signBit | exp;
  }
  if (parsed.kind === "nan") {
    // qNaN: all-ones exponent, MSB of mantissa set
    const exp = mask(info.expBits) << BigInt(info.mantBits);
    const qnanBit = 1n << BigInt(info.mantBits - 1);
    return signBit | exp | qnanBit;
  }
  if (precision === "binary128") {
    return decimalToBinary128Bits(parsed.canonicalDecimal === "Infinity" || parsed.canonicalDecimal === "NaN"
      ? "0"
      : (parsed.sign === 1 ? "-" : "") + parsed.canonicalDecimal);
  }
  if (precision === "binary64") {
    return float64ToBits(parsed.jsValue);
  }
  if (precision === "binary32") {
    return float32ToBits(parsed.jsValue);
  }
  // binary16
  const bits64 = float64ToBits(parsed.jsValue);
  return float64BitsToHalfBits(bits64);
}

/** Decode bits into a JS number (best-effort for binary128, exact for others). */
export function bitsToJsNumber(bits: bigint, precision: Precision): number {
  if (precision === "binary64") return bitsToFloat64(bits);
  if (precision === "binary32") return bitsToFloat32(bits);
  if (precision === "binary16") return halfBitsToFloat64(bits);
  // binary128 — use exact decimal then parseFloat
  const exact = exactDecimalValue(bits, precision);
  if (exact === "Infinity") return Infinity;
  if (exact === "-Infinity") return -Infinity;
  if (exact === "NaN") return NaN;
  return parseFloat(exact);
}

/**
 * Compute the rounding error between an input string and the stored value at
 * the given precision. Returns absolute and relative errors as exact decimal
 * strings (or null for special values).
 */
export function computeRoundingError(
  input: string,
  bits: bigint,
  precision: Precision,
): RoundingError {
  const parsed = parseInput(input);
  if (parsed.kind === "inf" || parsed.kind === "nan" || parsed.kind === "empty") {
    return { absolute: "0", relative: null };
  }
  const stored = exactDecimalValue(bits, precision);
  if (stored === "Infinity" || stored === "-Infinity" || stored === "NaN") {
    return { absolute: "Infinity", relative: null };
  }
  // |input - stored| as exact decimal
  const diff = subtractDecimalStrings(parsed.canonicalDecimal, stored);
  const absDiff = diff.startsWith("-") ? diff.slice(1) : diff;
  // relative = |diff| / |input|
  let relative: string | null = null;
  if (parsed.canonicalDecimal !== "0" && parsed.canonicalDecimal !== "-0") {
    const inp = parsed.canonicalDecimal.startsWith("-") ? parsed.canonicalDecimal.slice(1) : parsed.canonicalDecimal;
    relative = divideDecimalStrings(absDiff, inp);
  }
  return { absolute: absDiff, relative };
}

/** Convert an input string to a full ConversionResult at the given precision. */
export function convert(input: string, precision: Precision): ConversionResult {
  const parsed = parseInput(input);
  const bits = encodeBits(parsed, precision);
  const info = FORMAT_INFO[precision];
  const fields = decodeFields(bits, precision);
  const storedValue = exactDecimalValue(bits, precision);
  const jsValue = bitsToJsNumber(bits, precision);
  const roundingError = computeRoundingError(input, bits, precision);
  return {
    precision,
    bits,
    hex: toHexString(bits, info.totalBits),
    binary: toBinaryString(bits, info.totalBits),
    fields,
    storedValue,
    jsValue,
    inputParsed: parsed.canonicalDecimal,
    roundingError,
  };
}

/** Convert the same input at all four precisions side-by-side. */
export function convertAllPrecisions(input: string): Record<Precision, ConversionResult> {
  return {
    binary16: convert(input, "binary16"),
    binary32: convert(input, "binary32"),
    binary64: convert(input, "binary64"),
    binary128: convert(input, "binary128"),
  };
}

// ---- ULP stepping ----

/** Get the next representable value (bits + 1 ULP) at the given precision. */
export function nextUlp(bits: bigint, precision: Precision): bigint {
  const info = FORMAT_INFO[precision];
  const max = (1n << BigInt(info.totalBits)) - 1n;
  const next = bits + 1n;
  return next > max ? max : next;
}

/** Get the previous representable value (bits - 1 ULP) at the given precision. */
export function prevUlp(bits: bigint, precision: Precision): bigint {
  if (bits <= 0n) return 0n;
  return bits - 1n;
}

// ---- decimal-string arithmetic (for rounding-error computation) ----

function decimalToFraction(s: string): { num: bigint; den: bigint; sign: 0 | 1 } {
  const parsed = parseDecimalString(s);
  return { num: parsed.num, den: parsed.den, sign: parsed.sign };
}

/** a - b as an exact decimal string (a, b are decimal strings). */
export function subtractDecimalStrings(a: string, b: string): string {
  const fa = decimalToFraction(a);
  const fb = decimalToFraction(b);
  const aVal = fa.sign === 1 ? -fa.num : fa.num;
  const bVal = fb.sign === 1 ? -fb.num : fb.num;
  // common denominator
  const num = aVal * fb.den - bVal * fa.den;
  const den = fa.den * fb.den;
  return fractionToDecimalString(num, den);
}

/** a / b as a decimal string (rounded to ~40 significant digits). */
export function divideDecimalStrings(a: string, b: string): string {
  const fa = decimalToFraction(a);
  const fb = decimalToFraction(b);
  if (fb.num === 0n) return "Infinity";
  const signMul = (fa.sign !== fb.sign) ? -1n : 1n;
  // a/b = (fa.num / fa.den) / (fb.num / fb.den) = (fa.num * fb.den) / (fa.den * fb.num)
  const num = fa.num * fb.den;
  const den = fa.den * fb.num;
  return fractionToDecimalString(signMul * num, den);
}

/** Convert a BigInt fraction to a decimal string (100 significant digits). */
export function fractionToDecimalString(num: bigint, den: bigint): string {
  if (den === 0n) return num === 0n ? "0" : "Infinity";
  if (num === 0n) return "0";
  const sign = num < 0n;
  const nAbs = sign ? -num : num;
  const dAbs = den < 0n ? -den : den;
  const intPart = nAbs / dAbs;
  let rem = nAbs - intPart * dAbs;
  let fracStr = "";
  const MAX_FRAC_DIGITS = 100;
  for (let i = 0; i < MAX_FRAC_DIGITS && rem > 0n; i++) {
    rem *= 10n;
    const d = rem / dAbs;
    fracStr += d.toString();
    rem -= d * dAbs;
  }
  fracStr = fracStr.replace(/0+$/, "");
  const intStr = intPart.toString();
  const result = fracStr ? `${intStr}.${fracStr}` : intStr;
  return sign ? `-${result}` : result;
}

// ---- field-bit rendering ----

export interface FieldBits {
  sign: string; // 1 bit
  exponent: string; // expBits
  mantissa: string; // mantBits
}

/** Render the bit pattern split into sign / exponent / mantissa substrings. */
export function splitFieldBits(bits: bigint, precision: Precision): FieldBits {
  const info = FORMAT_INFO[precision];
  const sign = getBit(bits, info.totalBits - 1);
  const exp = (bits >> BigInt(info.mantBits)) & mask(info.expBits);
  const mant = bits & mask(info.mantBits);
  return {
    sign: sign.toString(),
    exponent: toBinaryString(exp, info.expBits),
    mantissa: toBinaryString(mant, info.mantBits),
  };
}

/** Per-bit field label (for tooltip / accessibility). */
export function bitFieldLabel(bitIndex: number, precision: Precision): "sign" | "exponent" | "mantissa" {
  const info = FORMAT_INFO[precision];
  if (bitIndex === info.totalBits - 1) return "sign";
  if (bitIndex >= info.mantBits) return "exponent";
  return "mantissa";
}

// ---- history (localStorage) ----

const HISTORY_KEY = "unqtools:ieee-754-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  precision: Precision;
  hex: string;
  class: ValueClass;
}

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

// ---- shareable URL ----

export function buildShareUrl(input: string, precision: Precision): string {
  const params = new URLSearchParams();
  if (input) params.set("v", input);
  params.set("p", precision);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; precision: Precision } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", precision: "binary32" };
  const params = new URLSearchParams(clean);
  const input = params.get("v") ?? "";
  const p = (params.get("p") ?? "binary32") as Precision;
  const validPrecisions: Precision[] = ["binary16", "binary32", "binary64", "binary128"];
  const precision = validPrecisions.includes(p) ? p : "binary32";
  return { input, precision };
}

// ---- presets ----

export interface PresetEntry {
  label: string;
  value: string;
  description: string;
}

export const PRESETS: PresetEntry[] = [
  { label: "1.0", value: "1.0", description: "Unity" },
  { label: "0.1", value: "0.1", description: "Classic not-exactly-representable" },
  { label: "π (pi)", value: "3.141592653589793", description: "Pi to double precision" },
  { label: "-1.5", value: "-1.5", description: "Negative finite" },
  { label: "Smallest normal (binary64)", value: "2.2250738585072014e-308", description: "DBL_MIN" },
  { label: "Largest normal (binary64)", value: "1.7976931348623157e+308", description: "DBL_MAX" },
  { label: "inf", value: "inf", description: "Positive infinity" },
  { label: "nan", value: "nan", description: "Not-a-number (quiet)" },
  { label: "0x1.8p+3", value: "0x1.8p+3", description: "Hex float = 12.0" },
  { label: "-0", value: "-0", description: "Negative zero" },
];
