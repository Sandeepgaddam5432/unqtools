import { describe, it, expect, beforeEach } from "vitest";
import {
  OPERATIONS,
  OP_LABELS,
  OP_SYMBOLS,
  BIT_WIDTHS,
  PRECEDENCE,
  parseOperand,
  maskWidth,
  signExtend,
  toBinaryString,
  formatInBases,
  applyBinaryOp,
  applyUnaryOp,
  tokenize,
  shuntYard,
  evalRPN,
  evaluate,
  computeChain,
  generateTruthTable,
  parseOperands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BitWidth,
  type SignMode,
  type ChainOp,
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

describe("bitwise-operation-calculator constants", () => {
  it("has 7 operations", () => {
    expect(OPERATIONS).toHaveLength(7);
    const ids = OPERATIONS.map((o) => o.id);
    expect(ids).toEqual(["AND", "OR", "XOR", "NOT", "NAND", "NOR", "XNOR"]);
  });
  it("has labels and symbols for all ops", () => {
    expect(OP_LABELS.AND).toBe("AND");
    expect(OP_SYMBOLS.AND).toBe("&");
    expect(OP_SYMBOLS.NOT).toBe("~");
    expect(OP_LABELS.XNOR).toBe("XNOR");
  });
  it("exposes 5 bit widths including BigInt", () => {
    expect(BIT_WIDTHS).toEqual([8, 16, 32, 64, 0]);
  });
  it("precedence: NOT > shift > AND > XOR > OR", () => {
    expect(PRECEDENCE["~"]).toBeGreaterThan(PRECEDENCE["<<"]);
    expect(PRECEDENCE["<<"]).toBeGreaterThan(PRECEDENCE["&"]);
    expect(PRECEDENCE["&"]).toBeGreaterThan(PRECEDENCE["^"]);
    expect(PRECEDENCE["^"]).toBeGreaterThan(PRECEDENCE["|"]);
  });
});

describe("bitwise-operation-calculator parseOperand", () => {
  it("parses decimal", () => {
    expect(parseOperand("255").value).toBe(255n);
    expect(parseOperand("255").base).toBe(10);
  });
  it("parses hex with 0x prefix", () => {
    expect(parseOperand("0xff").value).toBe(255n);
    expect(parseOperand("0xff").base).toBe(16);
  });
  it("parses binary with 0b prefix", () => {
    expect(parseOperand("0b1010").value).toBe(10n);
    expect(parseOperand("0b1010").base).toBe(2);
  });
  it("parses octal with 0o prefix", () => {
    expect(parseOperand("0o17").value).toBe(15n);
    expect(parseOperand("0o17").base).toBe(8);
  });
  it("handles negative literals", () => {
    expect(parseOperand("-1").value).toBe(-1n);
    expect(parseOperand("-0xff").value).toBe(-255n);
  });
  it("allows underscores as digit separators", () => {
    expect(parseOperand("0xff_ff").value).toBe(65535n);
    expect(parseOperand("1_000_000").value).toBe(1000000n);
  });
  it("throws on invalid digit", () => {
    expect(() => parseOperand("8")).not.toThrow(); // base 10 OK
    expect(() => parseOperand("0xgg")).toThrow();
    expect(() => parseOperand("0b2")).toThrow();
  });
  it("throws on empty", () => {
    expect(() => parseOperand("")).toThrow();
    expect(() => parseOperand("   ")).toThrow();
  });
  it("preserves raw input", () => {
    expect(parseOperand("0xFF").raw).toBe("0xFF");
  });
});

describe("bitwise-operation-calculator maskWidth", () => {
  it("masks to 8-bit", () => {
    expect(maskWidth(0x1FFn, 8)).toBe(0xFFn);
    expect(maskWidth(256n, 8)).toBe(0n);
  });
  it("handles negative inputs as two's-complement", () => {
    expect(maskWidth(-1n, 8)).toBe(0xFFn);
    expect(maskWidth(-16n, 8)).toBe(0xF0n);
  });
  it("passes through in BigInt mode (width 0)", () => {
    expect(maskWidth(-1n, 0)).toBe(-1n);
    expect(maskWidth(2n ** 80n, 0)).toBe(2n ** 80n);
  });
});

describe("bitwise-operation-calculator signExtend", () => {
  it("reinterprets 0xFF as -1 at 8-bit", () => {
    expect(signExtend(0xFFn, 8)).toBe(-1n);
  });
  it("leaves positive values alone", () => {
    expect(signExtend(0x7Fn, 8)).toBe(0x7Fn);
  });
  it("no-ops in BigInt mode", () => {
    expect(signExtend(-5n, 0)).toBe(-5n);
  });
});

describe("bitwise-operation-calculator toBinaryString", () => {
  it("pads to 8-bit width", () => {
    expect(toBinaryString(5n, 8)).toBe("00000101");
    expect(toBinaryString(0xFFn, 8)).toBe("11111111");
  });
  it("masks before padding", () => {
    expect(toBinaryString(0x1FFn, 8)).toBe("11111111");
  });
  it("handles BigInt (no padding)", () => {
    expect(toBinaryString(0n, 0)).toBe("0");
    expect(toBinaryString(10n, 0)).toBe("1010");
    expect(toBinaryString(-10n, 0)).toBe("-1010");
  });
});

describe("bitwise-operation-calculator formatInBases", () => {
  it("returns bin/oct/dec/hex", () => {
    const r = formatInBases(255n, 8, "unsigned");
    expect(r.bin).toBe("11111111");
    expect(r.oct).toBe("377");
    expect(r.dec).toBe("255");
    expect(r.hex).toBe("FF");
  });
  it("uses signed decimal in signed mode", () => {
    const r = formatInBases(0xFFn, 8, "signed");
    expect(r.dec).toBe("-1");
    expect(r.hex).toBe("FF");
  });
});

describe("bitwise-operation-calculator applyBinaryOp", () => {
  it("AND", () => {
    expect(applyBinaryOp("&", 0xF0n, 0x0Fn, 8, "unsigned")).toBe(0x00n);
    expect(applyBinaryOp("&", 0xFFn, 0xF0n, 8, "unsigned")).toBe(0xF0n);
  });
  it("OR", () => {
    expect(applyBinaryOp("|", 0xF0n, 0x0Fn, 8, "unsigned")).toBe(0xFFn);
  });
  it("XOR", () => {
    expect(applyBinaryOp("^", 0xFFn, 0x0Fn, 8, "unsigned")).toBe(0xF0n);
  });
  it("SHL masks to width", () => {
    expect(applyBinaryOp("<<", 0x01n, 4n, 8, "unsigned")).toBe(0x10n);
    expect(applyBinaryOp("<<", 0x80n, 1n, 8, "unsigned")).toBe(0x00n); // overflow
  });
  it("arithmetic SHR preserves sign in signed mode", () => {
    // 0x80 at 8-bit signed = -128; >> 4 = -8 = 0xF8
    expect(applyBinaryOp(">>", 0x80n, 4n, 8, "signed")).toBe(0xF8n);
  });
  it("arithmetic SHR unsigned mode fills with 0", () => {
    // 0x80 >> 4 unsigned = 0x08
    expect(applyBinaryOp(">>", 0x80n, 4n, 8, "unsigned")).toBe(0x08n);
  });
  it("logical SHR always fills with 0", () => {
    expect(applyBinaryOp(">>>", 0x80n, 4n, 8, "signed")).toBe(0x08n);
    expect(applyBinaryOp(">>>", 0xFFn, 4n, 8, "unsigned")).toBe(0x0Fn);
  });
  it("throws on negative shift count", () => {
    expect(() => applyBinaryOp("<<", 1n, -1n, 8, "unsigned")).toThrow();
  });
});

describe("bitwise-operation-calculator applyUnaryOp", () => {
  it("NOT flips bits at width", () => {
    expect(applyUnaryOp("~", 0x00n, 8)).toBe(0xFFn);
    expect(applyUnaryOp("~", 0xFFn, 8)).toBe(0x00n);
    expect(applyUnaryOp("~", 0xF0n, 8)).toBe(0x0Fn);
  });
  it("NOT at 16-bit width", () => {
    expect(applyUnaryOp("~", 0x0000n, 16)).toBe(0xFFFFn);
  });
});

describe("bitwise-operation-calculator tokenize", () => {
  it("tokenizes numbers and operators", () => {
    const t = tokenize("1 & 2");
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({ kind: "num", value: 1n });
    expect(t[1]).toEqual({ kind: "op", op: "&" });
    expect(t[2]).toEqual({ kind: "num", value: 2n });
  });
  it("tokenizes multi-char operators", () => {
    expect(tokenize("1 << 2")[1]).toEqual({ kind: "op", op: "<<" });
    expect(tokenize("1 >> 2")[1]).toEqual({ kind: "op", op: ">>" });
    expect(tokenize("1 >>> 2")[1]).toEqual({ kind: "op", op: ">>>" });
  });
  it("tokenizes hex and binary literals", () => {
    expect(tokenize("0xff")[0]).toEqual({ kind: "num", value: 255n });
    expect(tokenize("0b1010")[0]).toEqual({ kind: "num", value: 10n });
  });
  it("tokenizes parentheses and unary ~", () => {
    const t = tokenize("~(1 & 2)");
    expect(t[0]).toEqual({ kind: "op", op: "~" });
    expect(t[1]).toEqual({ kind: "lparen" });
    expect(t[t.length - 1]).toEqual({ kind: "rparen" });
  });
  it("throws on unexpected char", () => {
    expect(() => tokenize("1 @ 2")).toThrow();
  });
});

describe("bitwise-operation-calculator shuntYard", () => {
  it("produces RPN for a & b | c", () => {
    const rpn = shuntYard(tokenize("1 & 2 | 3"));
    const kinds = rpn.map((t) => (t.kind === "num" ? "N" : t.kind === "op" ? t.op : t.kind));
    // Expected: 1 2 & 3 |
    expect(kinds).toEqual(["N", "N", "&", "N", "|"]);
  });
  it("respects parentheses", () => {
    const rpn = shuntYard(tokenize("(1 | 2) & 3"));
    const kinds = rpn.map((t) => (t.kind === "num" ? "N" : t.kind === "op" ? t.op : t.kind));
    expect(kinds).toEqual(["N", "N", "|", "N", "&"]);
  });
  it("throws on mismatched parens", () => {
    expect(() => shuntYard(tokenize("(1 & 2"))).toThrow();
    expect(() => shuntYard(tokenize("1 & 2)"))).toThrow();
  });
});

describe("bitwise-operation-calculator evaluate", () => {
  it("evaluates a simple AND", () => {
    const r = evaluate("0xF0 & 0x0F", 8, "unsigned");
    expect(r.error).toBeUndefined();
    expect(r.result).toBe(0x00n);
  });
  it("evaluates with precedence (& binds tighter than |)", () => {
    // 1 | 2 & 0 = 1 | 0 = 1
    const r = evaluate("1 | 2 & 0", 8, "unsigned");
    expect(r.result).toBe(1n);
  });
  it("evaluates parentheses", () => {
    // (1 | 2) & 0 = 3 & 0 = 0
    const r = evaluate("(1 | 2) & 0", 8, "unsigned");
    expect(r.result).toBe(0n);
  });
  it("evaluates unary NOT", () => {
    const r = evaluate("~0", 8, "unsigned");
    expect(r.result).toBe(0xFFn);
  });
  it("evaluates shifts", () => {
    expect(evaluate("1 << 4", 8, "unsigned").result).toBe(0x10n);
    expect(evaluate("0xF0 >> 4", 8, "unsigned").result).toBe(0x0Fn);
    expect(evaluate("0xF0 >>> 4", 8, "unsigned").result).toBe(0x0Fn);
  });
  it("evaluates a chained expression with mixed bases", () => {
    // 0xF0 & ~0b1010 ^ 12 → 0xF0 & 0xF5 ^ 0x0C → 0xF0 ^ 0x0C = 0xFC
    const r = evaluate("0xF0 & ~0b1010 ^ 12", 8, "unsigned");
    expect(r.error).toBeUndefined();
    // Steps should be present
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("returns error on empty", () => {
    const r = evaluate("", 8, "unsigned");
    expect(r.error).toBeDefined();
  });
  it("returns error on invalid expression", () => {
    const r = evaluate("1 &", 8, "unsigned");
    expect(r.error).toBeDefined();
  });
  it("populates bases", () => {
    const r = evaluate("255", 8, "unsigned");
    expect(r.bases.hex).toBe("FF");
    expect(r.bases.dec).toBe("255");
  });
});

describe("bitwise-operation-calculator computeChain", () => {
  it("ANDs two operands", () => {
    const r = computeChain([0xF0n, 0x3Cn], "AND", 8, "unsigned");
    expect(r.result).toBe(0x30n);
    expect(r.bitGrid.length).toBe(3); // 2 operands + result
  });
  it("ANDs three operands (chained)", () => {
    const r = computeChain([0xFFn, 0xF0n, 0x0Fn], "AND", 8, "unsigned");
    expect(r.result).toBe(0x00n);
  });
  it("NOT takes 1 operand", () => {
    const r = computeChain([0xF0n], "NOT", 8, "unsigned");
    expect(r.result).toBe(0x0Fn);
  });
  it("NAND = ~(a & b)", () => {
    const r = computeChain([0xFFn, 0xFFn], "NAND", 8, "unsigned");
    expect(r.result).toBe(0x00n);
    const r2 = computeChain([0xFFn, 0x0Fn], "NAND", 8, "unsigned");
    expect(r2.result).toBe(0xF0n);
  });
  it("NOR = ~(a | b)", () => {
    const r = computeChain([0x00n, 0x00n], "NOR", 8, "unsigned");
    expect(r.result).toBe(0xFFn);
  });
  it("XNOR = ~(a ^ b)", () => {
    const r = computeChain([0xFFn, 0xFFn], "XNOR", 8, "unsigned");
    expect(r.result).toBe(0xFFn); // equal → 1s
  });
  it("errors on NOT with wrong operand count", () => {
    const r = computeChain([1n, 2n], "NOT", 8, "unsigned");
    expect(r.error).toBeDefined();
  });
  it("errors on AND with 1 operand", () => {
    const r = computeChain([1n], "AND", 8, "unsigned");
    expect(r.error).toBeDefined();
  });
});

describe("bitwise-operation-calculator generateTruthTable", () => {
  it("AND truth table", () => {
    const rows = generateTruthTable("AND");
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.a === 1 && r.b === 1)?.result).toBe(1);
    expect(rows.find((r) => r.a === 1 && r.b === 0)?.result).toBe(0);
  });
  it("NOT truth table has 2 rows", () => {
    const rows = generateTruthTable("NOT");
    expect(rows).toHaveLength(2);
    expect(rows[0].result).toBe(1); // ~0 = 1
    expect(rows[1].result).toBe(0); // ~1 = 0
  });
  it("NAND truth table", () => {
    const rows = generateTruthTable("NAND");
    expect(rows.find((r) => r.a === 1 && r.b === 1)?.result).toBe(0);
    expect(rows.find((r) => r.a === 0 && r.b === 0)?.result).toBe(1);
  });
  it("XNOR truth table (equality)", () => {
    const rows = generateTruthTable("XNOR");
    expect(rows.find((r) => r.a === 1 && r.b === 1)?.result).toBe(1);
    expect(rows.find((r) => r.a === 1 && r.b === 0)?.result).toBe(0);
  });
});

describe("bitwise-operation-calculator parseOperands", () => {
  it("parses multiple operands separated by spaces", () => {
    const { operands, errors } = parseOperands("0xff 0b1010 10");
    expect(errors).toHaveLength(0);
    expect(operands).toHaveLength(3);
    expect(operands[0].value).toBe(255n);
    expect(operands[1].value).toBe(10n);
    expect(operands[2].value).toBe(10n);
  });
  it("parses newline-separated operands", () => {
    const { operands } = parseOperands("0xff\n0b1010\n10");
    expect(operands).toHaveLength(3);
  });
  it("reports errors for invalid operands", () => {
    const { operands, errors } = parseOperands("0xff 0xgg 10");
    expect(operands).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0xgg");
  });
});

describe("bitwise-operation-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, expression: "1 & 2", width: 8, signed: "unsigned", result: "0" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].expression).toBe("1 & 2");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, expression: String(i), width: 8, signed: "unsigned", result: "0" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, expression: "1", width: 8, signed: "unsigned", result: "1" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bitwise-operation-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ expression: "1 & 2", width: 8, signed: "unsigned" });
    expect(url).toContain("expr=1");
    expect(url).toContain("w=8");
    expect(url).toContain("s=unsigned");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("expr=1%20%26%202&w=8&s=unsigned");
    expect(s.expression).toBe("1 & 2");
    expect(s.width).toBe(8);
    expect(s.signed).toBe("unsigned");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.expression).toBe("");
    expect(s.width).toBe(32);
    expect(s.signed).toBe("unsigned");
  });
  it("sanitizes invalid width", () => {
    const s = parseShareUrl("expr=1&w=7&s=unsigned");
    expect(s.width).toBe(32);
  });
  it("accepts BigInt width (0)", () => {
    const s = parseShareUrl("expr=1&w=0&s=signed");
    expect(s.width).toBe(0);
    expect(s.signed).toBe("signed");
  });
});

// Suppress unused-import lint
export type _Unused = BitWidth | SignMode | ChainOp;
