/**
 * Bitwise Operation Calculator — pure logic.
 *
 * Evaluate bitwise expressions — AND, OR, XOR, NOT, NAND, NOR, XNOR, plus
 * left shift, arithmetic right shift, and logical right shift — across two
 * or more operands in mixed bases (bin/oct/dec/hex) with an aligned
 * bit-column grid, a per-gate truth table, selectable width
 * (8/16/32/64-bit or BigInt), and a signed/unsigned toggle. Pure
 * functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

export type BitWidth = 8 | 16 | 32 | 64 | 0; // 0 = BigInt (unbounded)
export type SignMode = "signed" | "unsigned";

export type ChainOp =
  | "AND" | "OR" | "XOR" | "NOT" | "NAND" | "NOR" | "XNOR";

export type BinaryOp = "&" | "|" | "^" | "<<" | ">>" | ">>>";
export type UnaryOp = "~";

export interface OpInfo {
  id: ChainOp;
  label: string;
  symbol: string;
  arity: 1 | 2;
  description: string;
}

export const OPERATIONS: OpInfo[] = [
  { id: "AND", label: "AND", symbol: "&", arity: 2, description: "Bitwise AND — bit set if both operands have it." },
  { id: "OR", label: "OR", symbol: "|", arity: 2, description: "Bitwise OR — bit set if either operand has it." },
  { id: "XOR", label: "XOR", symbol: "^", arity: 2, description: "Bitwise XOR — bit set if operands differ." },
  { id: "NOT", label: "NOT", symbol: "~", arity: 1, description: "Bitwise complement — flip every bit at the chosen width." },
  { id: "NAND", label: "NAND", symbol: "⊼", arity: 2, description: "AND then NOT — ~(a & b)." },
  { id: "NOR", label: "NOR", symbol: "⊽", arity: 2, description: "OR then NOT — ~(a | b)." },
  { id: "XNOR", label: "XNOR", symbol: "≡", arity: 2, description: "XOR then NOT — ~(a ^ b); equality." },
];

export const OP_LABELS: Record<ChainOp, string> = {
  AND: "AND", OR: "OR", XOR: "XOR", NOT: "NOT",
  NAND: "NAND", NOR: "NOR", XNOR: "XNOR",
};

export const OP_SYMBOLS: Record<ChainOp, string> = {
  AND: "&", OR: "|", XOR: "^", NOT: "~",
  NAND: "⊼", NOR: "⊽", XNOR: "≡",
};

export const BIT_WIDTHS: BitWidth[] = [8, 16, 32, 64, 0];

export const PRECEDENCE: Record<string, number> = {
  "~": 5,
  "<<": 4,
  ">>": 4,
  ">>>": 4,
  "&": 3,
  "^": 2,
  "|": 1,
};

const RIGHT_ASSOC = new Set(["~"]);

export interface Operand {
  value: bigint;
  base: number;
  raw: string;
}

export interface BitRow {
  label: string;
  bits: string;
}

export interface BasesResult {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
}

export interface EvalResult {
  result: bigint;
  steps: string[];
  bitGrid: BitRow[];
  bases: BasesResult;
  error?: string;
}

export interface TruthRow {
  a: number;
  b: number;
  result: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Tokenizer & shunting-yard parser
// ---------------------------------------------------------------------------

type Token =
  | { kind: "num"; value: bigint }
  | { kind: "op"; op: BinaryOp | UnaryOp }
  | { kind: "lparen" }
  | { kind: "rparen" };

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if (ch === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (ch === "~") { tokens.push({ kind: "op", op: "~" }); i++; continue; }
    if (ch === "&") { tokens.push({ kind: "op", op: "&" }); i++; continue; }
    if (ch === "|") { tokens.push({ kind: "op", op: "|" }); i++; continue; }
    if (ch === "^") { tokens.push({ kind: "op", op: "^" }); i++; continue; }
    if (ch === "<" && expr[i + 1] === "<") {
      tokens.push({ kind: "op", op: "<<" });
      i += 2;
      continue;
    }
    if (ch === ">" && expr[i + 1] === ">" && expr[i + 2] === ">") {
      tokens.push({ kind: "op", op: ">>>" });
      i += 3;
      continue;
    }
    if (ch === ">" && expr[i + 1] === ">") {
      tokens.push({ kind: "op", op: ">>" });
      i += 2;
      continue;
    }
    // Negative number or operand literal
    if (ch === "-" || /[0-9a-zA-Z_]/.test(ch)) {
      let j = i;
      let numStr = "";
      if (ch === "-") { numStr += ch; j++; }
      while (j < expr.length && /[0-9a-zA-Z_]/.test(expr[j])) {
        numStr += expr[j];
        j++;
      }
      if (numStr === "-" || numStr === "") throw new Error(`Unexpected character: ${ch}`);
      const parsed = parseOperand(numStr);
      tokens.push({ kind: "num", value: parsed.value });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

export function shuntYard(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];
  let prev: Token | null = null;

  for (const t of tokens) {
    if (t.kind === "num") {
      output.push(t);
    } else if (t.kind === "op") {
      // Detect unary ~ (prefix position)
      const isUnary =
        t.op === "~" &&
        (prev === null || prev.kind === "op" || prev.kind === "lparen");
      if (isUnary) {
        opStack.push(t);
      } else {
        while (opStack.length > 0) {
          const top = opStack[opStack.length - 1];
          if (top.kind !== "op") break;
          const topPrec = PRECEDENCE[top.op] ?? 0;
          const curPrec = PRECEDENCE[t.op] ?? 0;
          if (topPrec > curPrec || (topPrec === curPrec && !RIGHT_ASSOC.has(t.op))) {
            output.push(opStack.pop()!);
          } else {
            break;
          }
        }
        opStack.push(t);
      }
    } else if (t.kind === "lparen") {
      opStack.push(t);
    } else if (t.kind === "rparen") {
      while (opStack.length > 0 && opStack[opStack.length - 1].kind !== "lparen") {
        output.push(opStack.pop()!);
      }
      if (opStack.length === 0) throw new Error("Mismatched parentheses");
      opStack.pop(); // pop lparen
    }
    prev = t;
  }

  while (opStack.length > 0) {
    const t = opStack.pop()!;
    if (t.kind === "lparen" || t.kind === "rparen") throw new Error("Mismatched parentheses");
    output.push(t);
  }

  return output;
}

// ---------------------------------------------------------------------------
// Operand parsing
// ---------------------------------------------------------------------------

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
  // Validate
  for (const ch of rest) {
    if (ch === "_") continue;
    const d = charDigitValue(ch);
    if (d < 0 || d >= base) throw new Error(`Invalid digit '${ch}' for base ${base}`);
  }
  const value = parseBigIntFromBase(rest, base);
  return { value: negative ? -value : value, base, raw: input };
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

// ---------------------------------------------------------------------------
// Bit-width helpers
// ---------------------------------------------------------------------------

export function maskWidth(value: bigint, width: BitWidth): bigint {
  if (width === 0) return value;
  const mask = (1n << BigInt(width)) - 1n;
  // BigInt & with a non-negative mask produces a non-negative result,
  // so this also handles negative inputs correctly (two's-complement view).
  return value & mask;
}

export function signExtend(value: bigint, width: BitWidth): bigint {
  if (width === 0) return value;
  const signBit = 1n << BigInt(width - 1);
  const masked = maskWidth(value, width);
  if (masked & signBit) {
    return masked - (1n << BigInt(width));
  }
  return masked;
}

export function toBinaryString(value: bigint, width: BitWidth): string {
  if (width === 0) {
    if (value < 0n) return "-" + toBinaryString(-value, 0);
    if (value === 0n) return "0";
    let s = "";
    let v = value;
    while (v > 0n) {
      s = (v & 1n ? "1" : "0") + s;
      v = v >> 1n;
    }
    return s;
  }
  const masked = maskWidth(value, width);
  let s = "";
  for (let i = width - 1; i >= 0; i--) {
    s += masked & (1n << BigInt(i)) ? "1" : "0";
  }
  return s;
}

export function formatInBases(value: bigint, width: BitWidth, signed: SignMode): BasesResult {
  const masked = maskWidth(value, width);
  const signedVal = signed === "signed" && width > 0 ? signExtend(masked, width) : masked;
  return {
    bin: toBinaryString(masked, width),
    oct: masked.toString(8),
    dec: signedVal.toString(10),
    hex: masked.toString(16).toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export function applyBinaryOp(
  op: BinaryOp,
  a: bigint,
  b: bigint,
  width: BitWidth,
  signed: SignMode,
): bigint {
  switch (op) {
    case "&":
      return maskWidth(a & b, width);
    case "|":
      return maskWidth(a | b, width);
    case "^":
      return maskWidth(a ^ b, width);
    case "<<": {
      const shift = Number(b);
      if (shift < 0) throw new Error("Negative shift count");
      return maskWidth(a << BigInt(shift), width);
    }
    case ">>": {
      // Arithmetic right shift — preserve sign bit in signed mode.
      const shift = Number(b);
      if (shift < 0) throw new Error("Negative shift count");
      let signedA = a;
      if (signed === "signed" && width > 0) {
        signedA = signExtend(a, width);
      } else if (width > 0) {
        signedA = maskWidth(a, width);
      }
      const result = signedA >> BigInt(shift);
      return maskWidth(result, width);
    }
    case ">>>": {
      // Logical right shift — fill with zeros.
      const shift = Number(b);
      if (shift < 0) throw new Error("Negative shift count");
      const unsigned = maskWidth(a, width);
      return maskWidth(unsigned >> BigInt(shift), width);
    }
    default:
      throw new Error(`Unknown binary op: ${op}`);
  }
}

export function applyUnaryOp(op: UnaryOp, a: bigint, width: BitWidth): bigint {
  if (op === "~") {
    return maskWidth(~a, width);
  }
  throw new Error(`Unknown unary op: ${op}`);
}

// ---------------------------------------------------------------------------
// Expression evaluation (RPN)
// ---------------------------------------------------------------------------

export function evalRPN(rpn: Token[], width: BitWidth, signed: SignMode): EvalResult {
  const stack: bigint[] = [];
  const steps: string[] = [];
  for (const t of rpn) {
    if (t.kind === "num") {
      stack.push(maskWidth(t.value, width));
    } else if (t.kind === "op") {
      if (t.op === "~") {
        const a = stack.pop();
        if (a === undefined) throw new Error("Stack underflow (NOT needs 1 operand)");
        const r = applyUnaryOp("~", a, width);
        const f = formatInBases(a, width, signed);
        const fr = formatInBases(r, width, signed);
        steps.push(`~${f.hex} = ${fr.hex}`);
        stack.push(r);
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error("Stack underflow (binary op needs 2 operands)");
        const r = applyBinaryOp(t.op, a, b, width, signed);
        const fa = formatInBases(a, width, signed);
        const fb = formatInBases(b, width, signed);
        const fr = formatInBases(r, width, signed);
        steps.push(`${fa.hex} ${t.op} ${fb.hex} = ${fr.hex}`);
        stack.push(r);
      }
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression (leftover operands)");
  const result = stack[0];
  const bases = formatInBases(result, width, signed);
  return { result, steps, bitGrid: [{ label: "result", bits: bases.bin }], bases };
}

export function evaluate(expr: string, width: BitWidth, signed: SignMode): EvalResult {
  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) {
      return { result: 0n, steps: [], bitGrid: [], bases: formatInBases(0n, width, signed), error: "Empty expression" };
    }
    const rpn = shuntYard(tokens);
    return evalRPN(rpn, width, signed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Evaluation error";
    return { result: 0n, steps: [], bitGrid: [], bases: formatInBases(0n, width, signed), error: msg };
  }
}

// ---------------------------------------------------------------------------
// Multi-input chain (gate mode)
// ---------------------------------------------------------------------------

export function computeChain(
  operands: bigint[],
  op: ChainOp,
  width: BitWidth,
  signed: SignMode,
): EvalResult {
  if (op === "NOT") {
    if (operands.length !== 1) {
      return { result: 0n, steps: [], bitGrid: [], bases: formatInBases(0n, width, signed), error: "NOT takes exactly 1 operand" };
    }
    const a = maskWidth(operands[0], width);
    const r = applyUnaryOp("~", a, width);
    const fa = formatInBases(a, width, signed);
    const fr = formatInBases(r, width, signed);
    return {
      result: r,
      steps: [`~${fa.hex} = ${fr.hex}`],
      bitGrid: [
        { label: "a", bits: toBinaryString(a, width) },
        { label: "result", bits: toBinaryString(r, width) },
      ],
      bases: fr,
    };
  }
  if (operands.length < 2) {
    return { result: 0n, steps: [], bitGrid: [], bases: formatInBases(0n, width, signed), error: `${op} needs at least 2 operands` };
  }
  const baseOp: BinaryOp =
    op === "AND" || op === "NAND" ? "&" :
    op === "OR" || op === "NOR" ? "|" :
    "^"; // XOR / XNOR
  let acc = maskWidth(operands[0], width);
  const steps: string[] = [];
  for (let i = 1; i < operands.length; i++) {
    const b = maskWidth(operands[i], width);
    const newAcc = applyBinaryOp(baseOp, acc, b, width, signed);
    const fa = formatInBases(acc, width, signed);
    const fb = formatInBases(b, width, signed);
    const fr = formatInBases(newAcc, width, signed);
    steps.push(`${fa.hex} ${baseOp} ${fb.hex} = ${fr.hex}`);
    acc = newAcc;
  }
  if (op === "NAND" || op === "NOR" || op === "XNOR") {
    const r = applyUnaryOp("~", acc, width);
    const fa = formatInBases(acc, width, signed);
    const fr = formatInBases(r, width, signed);
    steps.push(`~${fa.hex} = ${fr.hex}`);
    acc = r;
  }
  const bitGrid: BitRow[] = operands.map((o, i) => ({
    label: `op${i + 1}`,
    bits: toBinaryString(maskWidth(o, width), width),
  }));
  bitGrid.push({ label: "result", bits: toBinaryString(acc, width) });
  return {
    result: acc,
    steps,
    bitGrid,
    bases: formatInBases(acc, width, signed),
  };
}

// ---------------------------------------------------------------------------
// Truth table (1-bit per operand)
// ---------------------------------------------------------------------------

export function generateTruthTable(op: ChainOp): TruthRow[] {
  if (op === "NOT") {
    return [
      { a: 0, b: 0, result: 1, label: "~0 = 1" },
      { a: 1, b: 0, result: 0, label: "~1 = 0" },
    ];
  }
  const rows: TruthRow[] = [];
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      let r: number;
      switch (op) {
        case "AND": r = a & b; break;
        case "OR": r = a | b; break;
        case "XOR": r = a ^ b; break;
        case "NAND": r = ~(a & b) & 1; break;
        case "NOR": r = ~(a | b) & 1; break;
        case "XNOR": r = ~(a ^ b) & 1; break;
        default: r = 0;
      }
      const sym = OP_SYMBOLS[op] ?? op;
      rows.push({ a, b, result: r, label: `${a} ${sym} ${b} = ${r}` });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Parse multiple operands from a multi-line string
// ---------------------------------------------------------------------------

export function parseOperands(text: string): { operands: Operand[]; errors: string[] } {
  const lines = text.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const operands: Operand[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    try {
      operands.push(parseOperand(line));
    } catch (e) {
      errors.push(`${line}: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }
  return { operands, errors };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bitwise-operation-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  expression: string;
  width: BitWidth;
  signed: SignMode;
  result: string;
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
  expression: string;
  width: BitWidth;
  signed: SignMode;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.expression) params.set("expr", state.expression);
  params.set("w", String(state.width));
  params.set("s", state.signed);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { expression: "", width: 32, signed: "unsigned" };
  const params = new URLSearchParams(clean);
  const expression = params.get("expr") ?? "";
  const wRaw = params.get("w");
  let width: BitWidth = 32;
  if (wRaw !== null) {
    const w = parseInt(wRaw, 10);
    if (w === 8 || w === 16 || w === 32 || w === 64 || w === 0) width = w;
  }
  const sRaw = params.get("s");
  const signed: SignMode = sRaw === "signed" ? "signed" : "unsigned";
  return { expression, width, signed };
}
