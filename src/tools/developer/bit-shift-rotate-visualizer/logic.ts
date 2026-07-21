/**
 * Bit Shift & Rotate Visualizer — pure logic.
 *
 * Visualize <<, >> (arithmetic), >>> (logical) plus ROL, ROR, RCL, RCR
 * operations on integers at 8 / 16 / 32 / 64-bit widths. Pure functions
 * only — no DOM, no network. BigInt-correct at every width including 64-bit.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type BitWidth = 8 | 16 | 32 | 64;

export type SignMode = "signed" | "unsigned";

export type ShiftOp = "<<" | ">>" | ">>>" | "ROL" | "ROR" | "RCL" | "RCR";

export interface OpInfo {
  id: ShiftOp;
  label: string;
  symbol: string;
  family: "shift" | "rotate" | "carry-rotate";
  description: string;
}

export const OPERATIONS: OpInfo[] = [
  { id: "<<",  label: "Left shift (logical)",        symbol: "<<",  family: "shift",         description: "Shift bits left by k. Low-order zeros fill in. Equivalent to ×2^k (mod 2^width). Bits shifted off the top are lost." },
  { id: ">>",  label: "Right shift (arithmetic)",    symbol: ">>",  family: "shift",         description: "Shift bits right by k. The sign bit is replicated into the vacated high-order positions (sign-fill). Equivalent to ÷2^k (rounding toward −∞) for signed values." },
  { id: ">>>", label: "Right shift (logical / unsigned)", symbol: ">>>", family: "shift",    description: "Shift bits right by k. Zeros fill the vacated high-order positions regardless of sign. Equivalent to ÷2^k on the unsigned value." },
  { id: "ROL", label: "Rotate left (circular)",      symbol: "ROL", family: "rotate",        description: "Rotate bits left by k. Bits shifted off the top wrap around to the bottom. No bits are lost." },
  { id: "ROR", label: "Rotate right (circular)",     symbol: "ROR", family: "rotate",        description: "Rotate bits right by k. Bits shifted off the bottom wrap around to the top. No bits are lost." },
  { id: "RCL", label: "Rotate left through carry",   symbol: "RCL", family: "carry-rotate",  description: "Rotate bits+carry left by k. The top bit goes into the carry flag, and the old carry rotates into the bottom. Width+1 effective positions." },
  { id: "RCR", label: "Rotate right through carry",  symbol: "RCR", family: "carry-rotate",  description: "Rotate bits+carry right by k. The bottom bit goes into the carry flag, and the old carry rotates into the top. Width+1 effective positions." },
];

export const OP_LABELS: Record<ShiftOp, string> = {
  "<<": "Left shift",
  ">>": "Arithmetic right shift",
  ">>>": "Logical right shift",
  "ROL": "Rotate left",
  "ROR": "Rotate right",
  "RCL": "Rotate left through carry",
  "RCR": "Rotate right through carry",
};

export const OP_SYMBOLS: Record<ShiftOp, string> = {
  "<<": "<<", ">>": ">>", ">>>": ">>>",
  "ROL": "ROL", "ROR": "ROR", "RCL": "RCL", "RCR": "RCR",
};

export const BIT_WIDTHS: BitWidth[] = [8, 16, 32, 64];

export const OP_IDS: ShiftOp[] = OPERATIONS.map((o) => o.id);

// ---------------------------------------------------------------------------
// Operand parsing
// ---------------------------------------------------------------------------

export interface Operand {
  value: bigint;
  base: number;
  raw: string;
}

function charDigitValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - "0".charCodeAt(0);
  if (ch >= "a" && ch <= "z") return ch.charCodeAt(0) - "a".charCodeAt(0) + 10;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - "A".charCodeAt(0) + 10;
  return -1;
}

function parseBigIntFromBase(digits: string, base: number): bigint {
  let result = 0n;
  const b = BigInt(base);
  for (const ch of digits) {
    if (ch === "_") continue;
    const d = charDigitValue(ch);
    if (d < 0) throw new Error(`Invalid digit '${ch}'`);
    result = result * b + BigInt(d);
  }
  return result;
}

export function parseOperand(input: string): Operand {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty operand");
  let negative = false;
  let rest = trimmed;
  if (rest.startsWith("-")) { negative = true; rest = rest.slice(1); }
  else if (rest.startsWith("+")) rest = rest.slice(1);
  let base = 10;
  const lower = rest.toLowerCase();
  if (lower.startsWith("0x")) { base = 16; rest = rest.slice(2); }
  else if (lower.startsWith("0b")) { base = 2; rest = rest.slice(2); }
  else if (lower.startsWith("0o")) { base = 8; rest = rest.slice(2); }
  if (!rest) throw new Error("No digits");
  for (const ch of rest) {
    if (ch === "_") continue;
    const d = charDigitValue(ch);
    if (d < 0 || d >= base) throw new Error(`Invalid digit '${ch}' for base ${base}`);
  }
  const value = parseBigIntFromBase(rest, base);
  return { value: negative ? -value : value, base, raw: input };
}

// ---------------------------------------------------------------------------
// Bit-width helpers
// ---------------------------------------------------------------------------

export function maskWidth(value: bigint, width: BitWidth): bigint {
  const mask = (1n << BigInt(width)) - 1n;
  return value & mask;
}

export function signExtend(value: bigint, width: BitWidth): bigint {
  const signBit = 1n << BigInt(width - 1);
  const masked = maskWidth(value, width);
  if (masked & signBit) {
    return masked - (1n << BigInt(width));
  }
  return masked;
}

export function toBinaryString(value: bigint, width: BitWidth): string {
  const masked = maskWidth(value, width);
  let s = "";
  for (let i = width - 1; i >= 0; i--) {
    s += masked & (1n << BigInt(i)) ? "1" : "0";
  }
  return s;
}

/** Split a binary string into nibbles (4-bit groups) separated by spaces. */
export function groupNibbles(bin: string): string {
  const cleaned = bin.replace(/[^01]/g, "");
  if (!cleaned) return "";
  const pad = (4 - (cleaned.length % 4)) % 4;
  const padded = "0".repeat(pad) + cleaned;
  const out: string[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    out.push(padded.slice(i, i + 4));
  }
  return out.join(" ");
}

export interface BasesResult {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
}

export function formatInBases(value: bigint, width: BitWidth, signed: SignMode): BasesResult {
  const masked = maskWidth(value, width);
  const signedVal = signed === "signed" ? signExtend(masked, width) : masked;
  return {
    bin: toBinaryString(masked, width),
    oct: masked.toString(8),
    dec: signedVal.toString(10),
    hex: masked.toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0"),
  };
}

// ---------------------------------------------------------------------------
// Bit grid types
// ---------------------------------------------------------------------------

export interface BitCell {
  value: 0 | 1;
  /** Index in the original input (before any movement). Undefined if this is a fill bit. */
  originIndex?: number;
  /** "set" / "zero" / "fill-zero" / "fill-sign" / "shifted-out" / "carry-in" / "carry-out" */
  role: "set" | "zero" | "fill-zero" | "fill-sign" | "shifted-out" | "carry-in" | "carry-out";
}

export interface BitRow {
  label: string;
  bits: string;
  cells: BitCell[];
}

export interface ShiftResult {
  op: ShiftOp;
  width: BitWidth;
  signed: SignMode;
  input: bigint;
  inputMasked: bigint;
  output: bigint;
  shiftAmount: number;
  /** Bits that were shifted off the end (MSB-first as they would be read out). */
  shiftedOut: number[];
  /** Final carry flag value (0 or 1). For shifts this is the last bit shifted out. */
  carryOut: 0 | 1;
  /** Carry flag value before the operation (used for RCL/RCR). */
  carryIn: 0 | 1;
  /** Bit grid showing input row + output row + (for RCL/RCR) carry row. */
  bitGrid: BitRow[];
  /** Human-readable movement annotation. */
  annotation: string;
  /** Multi-step breakdown (one per shift unit). */
  steps: string[];
  /** Final bases. */
  bases: BasesResult;
  /** Non-fatal warning, e.g. shift >= width. */
  warning?: string;
  /** Fatal error, e.g. negative shift count. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Per-operation kernels
// ---------------------------------------------------------------------------

/**
 * Compute the rotated (circular) form of `value` at `width` bits by `k` positions.
 * Direction: +1 = left, -1 = right.
 */
export function rotateBits(value: bigint, width: BitWidth, k: number, direction: 1 | -1): bigint {
  const masked = maskWidth(value, width);
  const w = BigInt(width);
  const shift = ((k % width) + width) % width;
  if (shift === 0) return masked;
  const bigShift = BigInt(shift);
  if (direction === 1) {
    // ROL: (x << k) | (x >> (w - k))
    const left = (masked << bigShift) & ((1n << w) - 1n);
    const right = masked >> (w - bigShift);
    return (left | right) & ((1n << w) - 1n);
  } else {
    // ROR: (x >> k) | (x << (w - k))
    const right = masked >> bigShift;
    const left = (masked << (w - bigShift)) & ((1n << w) - 1n);
    return (right | left) & ((1n << w) - 1n);
  }
}

/**
 * Extract the bits that get shifted out for a left or right shift of `k`
 * at the given width. Returns an array of 0/1 in MSB-first order (i.e. the
 * first bit shifted out appears first).
 *
 * For left shift, the shifted-out bits are the top k bits of the input.
 * For right shift, the shifted-out bits are the bottom k bits of the input.
 */
export function extractShiftedOut(value: bigint, width: BitWidth, k: number, direction: "left" | "right"): number[] {
  const masked = maskWidth(value, width);
  const eff = Math.min(k, width);
  if (eff <= 0) return [];
  const out: number[] = [];
  if (direction === "left") {
    // Top `eff` bits of input (MSB-first).
    for (let i = width - 1; i >= width - eff; i--) {
      out.push(masked & (1n << BigInt(i)) ? 1 : 0);
    }
  } else {
    // Bottom `eff` bits of input, ordered by shift-out order (LSB first).
    for (let i = 0; i < eff; i++) {
      out.push(masked & (1n << BigInt(i)) ? 1 : 0);
    }
  }
  return out;
}

/**
 * Left shift (<<) — zeros fill the bottom, top bits fall off.
 */
export function leftShift(value: bigint, width: BitWidth, k: number): bigint {
  if (k < 0) throw new Error("Negative shift count");
  if (k === 0) return maskWidth(value, width);
  const masked = maskWidth(value, width);
  const w = BigInt(width);
  if (k >= width) return 0n;
  return (masked << BigInt(k)) & ((1n << w) - 1n);
}

/**
 * Arithmetic right shift (>>) — sign bit fills the top.
 * `signed` controls whether the input is sign-extended first.
 */
export function arithmeticRightShift(value: bigint, width: BitWidth, k: number, signed: SignMode): bigint {
  if (k < 0) throw new Error("Negative shift count");
  if (k === 0) return maskWidth(value, width);
  const w = BigInt(width);
  let working = maskWidth(value, width);
  if (signed === "signed") {
    working = signExtend(value, width);
  }
  if (k >= width) {
    // All bits become the sign bit (or 0 if unsigned / positive).
    if (signed === "signed" && working < 0n) {
      return ((1n << w) - 1n); // all ones
    }
    return 0n;
  }
  const shifted = working >> BigInt(k);
  return maskWidth(shifted, width);
}

/**
 * Logical / unsigned right shift (>>>) — zeros always fill the top.
 */
export function logicalRightShift(value: bigint, width: BitWidth, k: number): bigint {
  if (k < 0) throw new Error("Negative shift count");
  if (k === 0) return maskWidth(value, width);
  const masked = maskWidth(value, width);
  if (k >= width) return 0n;
  return masked >> BigInt(k);
}

/**
 * Rotate left through carry (RCL). Operates on (width+1) bits — the carry
 * is the MSB of the rotate group. Returns [new value, new carry].
 */
export function rotateLeftThroughCarry(value: bigint, carryIn: 0 | 1, width: BitWidth, k: number): { value: bigint; carry: 0 | 1 } {
  if (k < 0) throw new Error("Negative shift count");
  const masked = maskWidth(value, width);
  const w = BigInt(width);
  const totalBits = width + 1;
  const shift = ((k % totalBits) + totalBits) % totalBits;
  if (shift === 0) return { value: masked, carry: carryIn };
  // Build (width+1)-bit integer: carry is at position `width` (MSB).
  const extended = (BigInt(carryIn) << w) | masked;
  const bigShift = BigInt(shift);
  const totalMask = (1n << BigInt(totalBits)) - 1n;
  const rotated = ((extended << bigShift) | (extended >> BigInt(totalBits - shift))) & totalMask;
  const newCarry = (rotated & (1n << w)) ? 1 as const : 0 as const;
  const newValue = rotated & ((1n << w) - 1n);
  return { value: newValue, carry: newCarry };
}

/**
 * Rotate right through carry (RCR). Same as RCL but right.
 */
export function rotateRightThroughCarry(value: bigint, carryIn: 0 | 1, width: BitWidth, k: number): { value: bigint; carry: 0 | 1 } {
  if (k < 0) throw new Error("Negative shift count");
  const masked = maskWidth(value, width);
  const w = BigInt(width);
  const totalBits = width + 1;
  const shift = ((k % totalBits) + totalBits) % totalBits;
  if (shift === 0) return { value: masked, carry: carryIn };
  const extended = (BigInt(carryIn) << w) | masked;
  const bigShift = BigInt(shift);
  const totalMask = (1n << BigInt(totalBits)) - 1n;
  const rotated = ((extended >> bigShift) | (extended << BigInt(totalBits - shift))) & totalMask;
  const newCarry = (rotated & (1n << w)) ? 1 as const : 0 as const;
  const newValue = rotated & ((1n << w) - 1n);
  return { value: newValue, carry: newCarry };
}

// ---------------------------------------------------------------------------
// Top-level evaluation with visualization
// ---------------------------------------------------------------------------

function buildInputRow(value: bigint, width: BitWidth, label: string): BitRow {
  const masked = maskWidth(value, width);
  const cells: BitCell[] = [];
  for (let i = width - 1; i >= 0; i--) {
    const bit = masked & (1n << BigInt(i)) ? 1 : 0;
    cells.push({ value: bit as 0 | 1, originIndex: i, role: bit ? "set" : "zero" });
  }
  return { label, bits: toBinaryString(masked, width), cells };
}

function buildOutputRow(value: bigint, width: BitWidth, label: string, originMap: Array<number | undefined>, fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in">): BitRow {
  const masked = maskWidth(value, width);
  const cells: BitCell[] = [];
  for (let i = width - 1; i >= 0; i--) {
    const idx = width - 1 - i;
    const bit = masked & (1n << BigInt(i)) ? 1 : 0;
    const origin = originMap[idx];
    const role: BitCell["role"] = origin === undefined ? fillRoles[idx] : (bit ? "set" : "zero");
    cells.push({ value: bit as 0 | 1, originIndex: origin, role });
  }
  return { label, bits: toBinaryString(masked, width), cells };
}

function buildShiftedOutRow(shiftedOut: number[]): BitRow {
  const cells: BitCell[] = shiftedOut.map((b) => ({
    value: b as 0 | 1,
    role: "shifted-out" as const,
  }));
  return {
    label: "Shifted out",
    bits: shiftedOut.join("") || "—",
    cells,
  };
}

/**
 * Compute the per-bit origin map for a left shift of `k` positions.
 * Output position i (0 = LSB) comes from input position (i - k) if 0 <= i-k < width,
 * otherwise it's a fill-zero bit.
 */
function leftShiftOriginMap(width: BitWidth, k: number): Array<number | undefined> {
  const eff = Math.min(k, width);
  const map: Array<number | undefined> = [];
  for (let i = 0; i < width; i++) {
    if (i < eff) {
      map.push(undefined);
    } else {
      map.push(i - eff);
    }
  }
  return map;
}

function rightShiftOriginMap(width: BitWidth, k: number, fillSign: boolean): Array<number | undefined> {
  const eff = Math.min(k, width);
  const map: Array<number | undefined> = [];
  for (let i = 0; i < width; i++) {
    if (i >= width - eff) {
      // Top `eff` bits — fill.
      map.push(undefined);
    } else {
      // Bit at output position i (counting from LSB) comes from input position (i + eff).
      map.push(i + eff);
    }
  }
  return map;
}

function rotateOriginMap(width: BitWidth, k: number, direction: 1 | -1): Array<number | undefined> {
  // For ROL by k: output bit at position i comes from input bit at position (i - k) mod width.
  // For ROR by k: output bit at position i comes from input bit at position (i + k) mod width.
  const shift = ((k % width) + width) % width;
  const map: Array<number | undefined> = [];
  for (let i = 0; i < width; i++) {
    let src: number;
    if (direction === 1) {
      src = ((i - shift) % width + width) % width;
    } else {
      src = (i + shift) % width;
    }
    map.push(src);
  }
  return map;
}

function rclOriginMap(width: BitWidth, k: number, carryIn: 0 | 1): { origins: Array<number | undefined>; newCarry: 0 | 1; carryOrigin?: number } {
  // Treat positions 0..width as the (width+1) rotate group, where position `width` is the carry.
  // RCL by k: position i receives value from position (i - k) mod (width+1).
  const total = width + 1;
  const shift = ((k % total) + total) % total;
  const origins: Array<number | undefined> = [];
  let newCarry: 0 | 1 = carryIn;
  let carryOrigin: number | undefined = undefined;
  for (let i = 0; i < width; i++) {
    const src = ((i - shift) % total + total) % total;
    if (src < width) {
      origins.push(src);
    } else {
      // Source is the carry.
      origins.push(undefined);
      carryOrigin = i;
    }
  }
  // New carry is at position `width`; its source is position (width - shift) mod total.
  const carrySrc = ((width - shift) % total + total) % total;
  if (carrySrc < width) {
    newCarry = carryIn; // placeholder — actual value computed in rotateLeftThroughCarry
    carryOrigin = carrySrc;
  } else {
    newCarry = carryIn;
  }
  return { origins, newCarry, carryOrigin };
}

/**
 * Top-level visualization entry point. Returns a full ShiftResult with bit grid,
 * shifted-out bits, carry flag, annotation, and per-step breakdown.
 */
export function visualize(
  op: ShiftOp,
  input: bigint,
  width: BitWidth,
  shiftAmount: number,
  signed: SignMode,
  carryIn: 0 | 1 = 0,
): ShiftResult {
  const empty: ShiftResult = {
    op, width, signed, input, inputMasked: maskWidth(input, width),
    output: 0n, shiftAmount, shiftedOut: [], carryOut: 0, carryIn,
    bitGrid: [], annotation: "", steps: [], bases: formatInBases(0n, width, signed),
  };

  if (shiftAmount < 0) {
    return { ...empty, error: "Shift count cannot be negative" };
  }

  const inputMasked = maskWidth(input, width);
  const inputRow = buildInputRow(input, width, "Input");

  // Per-step breakdown — apply one position at a time.
  const steps: string[] = [];

  if (op === "<<") {
    const eff = Math.min(shiftAmount, width);
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "left");
    const output = leftShift(input, width, shiftAmount);
    const origins = leftShiftOriginMap(width, shiftAmount);
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map(() => "fill-zero");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    const shiftedRow = buildShiftedOutRow(shiftedOut);
    for (let s = 1; s <= shiftAmount; s++) {
      const partial = leftShift(input, width, s);
      steps.push(`<< ${s} → ${toBinaryString(partial, width)}  (= ${signExtend(partial, width).toString(10)} signed / ${maskWidth(partial, width).toString(10)} unsigned)`);
    }
    const kPow = 2 ** Math.min(shiftAmount, 62);
    const annotation = shiftAmount === 0
      ? "No shift applied (k=0)."
      : shiftAmount >= width
        ? `Shift count ≥ width — register fully cleared (×2^${shiftAmount} overflows to 0).`
        : `Equivalent to ×${kPow} (2^${shiftAmount}); ${eff} bit${eff === 1 ? "" : "s"} shifted off the top.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut: (shiftedOut[0] ?? 0) as 0 | 1,
      bitGrid: [inputRow, outputRow, shiftedRow],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
      warning: shiftAmount >= width ? `Shift count (${shiftAmount}) ≥ width (${width}) — every original bit is shifted out.` : undefined,
    };
  }

  if (op === ">>") {
    const eff = Math.min(shiftAmount, width);
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "right");
    const output = arithmeticRightShift(input, width, shiftAmount, signed);
    const origins = rightShiftOriginMap(width, shiftAmount, signed === "signed");
    const signBit = signExtend(input, width) < 0n && signed === "signed";
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map(() => signBit ? "fill-sign" : "fill-zero");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    const shiftedRow = buildShiftedOutRow(shiftedOut);
    for (let s = 1; s <= shiftAmount; s++) {
      const partial = arithmeticRightShift(input, width, s, signed);
      steps.push(`>> ${s} → ${toBinaryString(partial, width)}  (= ${signExtend(partial, width).toString(10)} signed / ${maskWidth(partial, width).toString(10)} unsigned)`);
    }
    const kPow = 2 ** Math.min(shiftAmount, 62);
    const annotation = shiftAmount === 0
      ? "No shift applied (k=0)."
      : shiftAmount >= width
        ? `Shift count ≥ width — register becomes ${signBit ? "all sign bits (−1)" : "0"}.`
        : `Equivalent to ÷${kPow} (2^${shiftAmount})${signed === "signed" ? " rounding toward −∞" : ""}; ${eff} bit${eff === 1 ? "" : "s"} shifted off the bottom.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut: (shiftedOut[0] ?? 0) as 0 | 1,
      bitGrid: [inputRow, outputRow, shiftedRow],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
      warning: shiftAmount >= width ? `Shift count (${shiftAmount}) ≥ width (${width}).` : undefined,
    };
  }

  if (op === ">>>") {
    const eff = Math.min(shiftAmount, width);
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "right");
    const output = logicalRightShift(input, width, shiftAmount);
    const origins = rightShiftOriginMap(width, shiftAmount, false);
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map(() => "fill-zero");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    const shiftedRow = buildShiftedOutRow(shiftedOut);
    for (let s = 1; s <= shiftAmount; s++) {
      const partial = logicalRightShift(input, width, s);
      steps.push(`>>> ${s} → ${toBinaryString(partial, width)}  (= ${maskWidth(partial, width).toString(10)} unsigned)`);
    }
    const kPow = 2 ** Math.min(shiftAmount, 62);
    const annotation = shiftAmount === 0
      ? "No shift applied (k=0)."
      : shiftAmount >= width
        ? `Shift count ≥ width — register fully cleared (÷2^${shiftAmount} of unsigned value = 0).`
        : `Equivalent to ÷${kPow} (2^${shiftAmount}) on the unsigned value; ${eff} bit${eff === 1 ? "" : "s"} shifted off the bottom.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut: (shiftedOut[0] ?? 0) as 0 | 1,
      bitGrid: [inputRow, outputRow, shiftedRow],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
      warning: shiftAmount >= width ? `Shift count (${shiftAmount}) ≥ width (${width}).` : undefined,
    };
  }

  if (op === "ROL") {
    const output = rotateBits(input, width, shiftAmount, 1);
    const origins = rotateOriginMap(width, shiftAmount, 1);
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map(() => "fill-zero");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    // Shifted-out bits = top k bits of input (which wrap to the bottom).
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "left");
    const carryOut: 0 | 1 = (shiftedOut[0] ?? 0) as 0 | 1;
    const eff = ((shiftAmount % width) + width) % width;
    for (let s = 1; s <= shiftAmount; s++) {
      const partial = rotateBits(input, width, s, 1);
      steps.push(`ROL ${s} → ${toBinaryString(partial, width)}`);
    }
    const annotation = shiftAmount === 0
      ? "No rotate applied (k=0)."
      : `Rotated left by ${eff} position${eff === 1 ? "" : "s"} (mod ${width}); top bits wrapped to the bottom; no bits lost.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut,
      bitGrid: [inputRow, outputRow, buildShiftedOutRow(shiftedOut)],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
    };
  }

  if (op === "ROR") {
    const output = rotateBits(input, width, shiftAmount, -1);
    const origins = rotateOriginMap(width, shiftAmount, -1);
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map(() => "fill-zero");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "right");
    const carryOut: 0 | 1 = (shiftedOut[0] ?? 0) as 0 | 1;
    const eff = ((shiftAmount % width) + width) % width;
    for (let s = 1; s <= shiftAmount; s++) {
      const partial = rotateBits(input, width, s, -1);
      steps.push(`ROR ${s} → ${toBinaryString(partial, width)}`);
    }
    const annotation = shiftAmount === 0
      ? "No rotate applied (k=0)."
      : `Rotated right by ${eff} position${eff === 1 ? "" : "s"} (mod ${width}); bottom bits wrapped to the top; no bits lost.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut,
      bitGrid: [inputRow, outputRow, buildShiftedOutRow(shiftedOut)],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
    };
  }

  if (op === "RCL") {
    const { value: output, carry: newCarry } = rotateLeftThroughCarry(input, carryIn, width, shiftAmount);
    const { origins } = rclOriginMap(width, shiftAmount, carryIn);
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map((o) => o === undefined ? "carry-in" : "set");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    // Shifted-out bits — top k bits of input (or carry if k >= width).
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "left");
    const totalBits = width + 1;
    const eff = ((shiftAmount % totalBits) + totalBits) % totalBits;
    for (let s = 1; s <= shiftAmount; s++) {
      const { value: partial, carry: pCarry } = rotateLeftThroughCarry(input, carryIn, width, s);
      steps.push(`RCL ${s} → ${toBinaryString(partial, width)} (carry=${pCarry})`);
    }
    const annotation = shiftAmount === 0
      ? "No rotate applied (k=0)."
      : `Rotated left through carry by ${eff} position${eff === 1 ? "" : "s"} (mod ${totalBits}); top bit → carry, carry → bottom.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut: newCarry,
      bitGrid: [inputRow, outputRow, buildShiftedOutRow(shiftedOut)],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
    };
  }

  if (op === "RCR") {
    const { value: output, carry: newCarry } = rotateRightThroughCarry(input, carryIn, width, shiftAmount);
    // For RCR by k: position i receives value from position (i + k) mod (width+1).
    const total = width + 1;
    const shift = ((shiftAmount % total) + total) % total;
    const origins: Array<number | undefined> = [];
    for (let i = 0; i < width; i++) {
      const src = (i + shift) % total;
      if (src < width) {
        origins.push(src);
      } else {
        origins.push(undefined);
      }
    }
    const fillRoles: Array<"fill-zero" | "fill-sign" | "carry-in"> = origins.map((o) => o === undefined ? "carry-in" : "set");
    const outputRow = buildOutputRow(output, width, "Output", origins, fillRoles);
    const shiftedOut = extractShiftedOut(input, width, shiftAmount, "right");
    for (let s = 1; s <= shiftAmount; s++) {
      const { value: partial, carry: pCarry } = rotateRightThroughCarry(input, carryIn, width, s);
      steps.push(`RCR ${s} → ${toBinaryString(partial, width)} (carry=${pCarry})`);
    }
    const annotation = shiftAmount === 0
      ? "No rotate applied (k=0)."
      : `Rotated right through carry by ${shift} position${shift === 1 ? "" : "s"} (mod ${total}); bottom bit → carry, carry → top.`;
    return {
      ...empty,
      inputMasked,
      output,
      shiftedOut,
      carryOut: newCarry,
      bitGrid: [inputRow, outputRow, buildShiftedOutRow(shiftedOut)],
      annotation,
      steps,
      bases: formatInBases(output, width, signed),
    };
  }

  return { ...empty, error: `Unknown operation: ${op}` };
}

/**
 * Convenience wrapper: visualize a single operation from a typed input string.
 */
export function visualizeFromInput(
  op: ShiftOp,
  inputStr: string,
  width: BitWidth,
  shiftAmount: number,
  signed: SignMode,
  carryIn: 0 | 1 = 0,
): ShiftResult {
  try {
    const operand = parseOperand(inputStr);
    return visualize(op, operand.value, width, shiftAmount, signed, carryIn);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return {
      op, width, signed, input: 0n, inputMasked: 0n, output: 0n,
      shiftAmount, shiftedOut: [], carryOut: 0, carryIn,
      bitGrid: [], annotation: "", steps: [], bases: formatInBases(0n, width, signed),
      error: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// Multi-step chain (apply the same op N times, with carry chaining for RCL/RCR)
// ---------------------------------------------------------------------------

export interface ChainStep {
  step: number;
  result: bigint;
  carry: 0 | 1;
  bin: string;
}

export interface ChainResult {
  op: ShiftOp;
  width: BitWidth;
  signed: SignMode;
  input: bigint;
  steps: ChainStep[];
  final: bigint;
  finalCarry: 0 | 1;
  bases: BasesResult;
  error?: string;
}

export function chain(
  op: ShiftOp,
  input: bigint,
  width: BitWidth,
  perStepShift: number,
  count: number,
  signed: SignMode,
  initialCarry: 0 | 1 = 0,
): ChainResult {
  if (count < 0) {
    return { op, width, signed, input, steps: [], final: input, finalCarry: initialCarry, bases: formatInBases(input, width, signed), error: "Count cannot be negative" };
  }
  if (perStepShift < 0) {
    return { op, width, signed, input, steps: [], final: input, finalCarry: initialCarry, bases: formatInBases(input, width, signed), error: "Per-step shift cannot be negative" };
  }
  const steps: ChainStep[] = [];
  let current = maskWidth(input, width);
  let carry = initialCarry;
  for (let i = 1; i <= count; i++) {
    const r = visualize(op, current, width, perStepShift, signed, carry);
    if (r.error) {
      return { op, width, signed, input, steps, final: current, finalCarry: carry, bases: formatInBases(current, width, signed), error: r.error };
    }
    current = r.output;
    carry = r.carryOut;
    steps.push({ step: i, result: current, carry, bin: toBinaryString(current, width) });
  }
  return {
    op, width, signed, input,
    steps, final: current, finalCarry: carry,
    bases: formatInBases(current, width, signed),
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bit-shift-rotate-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: ShiftOp;
  input: string;
  width: BitWidth;
  shift: number;
  signed: SignMode;
  carryIn: 0 | 1;
  resultHex: string;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  op: ShiftOp;
  input: string;
  width: BitWidth;
  shift: number;
  signed: SignMode;
  carryIn: 0 | 1;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("op", state.op);
  if (state.input) params.set("v", state.input);
  params.set("w", String(state.width));
  params.set("k", String(state.shift));
  params.set("s", state.signed);
  params.set("c", String(state.carryIn));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { op: "<<", input: "", width: 32, shift: 1, signed: "unsigned", carryIn: 0 };
  const params = new URLSearchParams(clean);
  const opRaw = params.get("op") ?? "<<";
  const op: ShiftOp = (OP_IDS as string[]).includes(opRaw) ? (opRaw as ShiftOp) : "<<";
  const input = params.get("v") ?? "";
  const wRaw = params.get("w");
  let width: BitWidth = 32;
  if (wRaw !== null) {
    const w = parseInt(wRaw, 10);
    if (w === 8 || w === 16 || w === 32 || w === 64) width = w;
  }
  const kRaw = params.get("k");
  const shift = kRaw !== null ? Math.max(0, parseInt(kRaw, 10) || 0) : 1;
  const sRaw = params.get("s");
  const signed: SignMode = sRaw === "signed" ? "signed" : "unsigned";
  const cRaw = params.get("c");
  const carryIn: 0 | 1 = cRaw === "1" ? 1 : 0;
  return { op, input, width, shift, signed, carryIn };
}
