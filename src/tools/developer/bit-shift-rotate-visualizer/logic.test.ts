import { describe, it, expect, beforeEach } from "vitest";
import {
  OPERATIONS,
  OP_LABELS,
  OP_SYMBOLS,
  BIT_WIDTHS,
  OP_IDS,
  parseOperand,
  maskWidth,
  signExtend,
  toBinaryString,
  groupNibbles,
  formatInBases,
  rotateBits,
  extractShiftedOut,
  leftShift,
  arithmeticRightShift,
  logicalRightShift,
  rotateLeftThroughCarry,
  rotateRightThroughCarry,
  visualize,
  visualizeFromInput,
  chain,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BitWidth,
  type SignMode,
  type ShiftOp,
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

describe("bit-shift-rotate-visualizer constants", () => {
  it("has 7 operations covering shifts + rotates + carry-rotates", () => {
    expect(OPERATIONS).toHaveLength(7);
    const ids = OPERATIONS.map((o) => o.id);
    expect(ids).toEqual(["<<", ">>", ">>>", "ROL", "ROR", "RCL", "RCR"]);
  });
  it("exposes labels and symbols for every op", () => {
    expect(OP_LABELS["<<"]).toBe("Left shift");
    expect(OP_LABELS[">>>"]).toBe("Logical right shift");
    expect(OP_SYMBOLS.ROL).toBe("ROL");
    expect(OP_SYMBOLS.RCR).toBe("RCR");
  });
  it("exposes 4 bit widths (8/16/32/64)", () => {
    expect(BIT_WIDTHS).toEqual([8, 16, 32, 64]);
  });
  it("OP_IDS matches OPERATIONS ids", () => {
    expect(OP_IDS).toEqual(OPERATIONS.map((o) => o.id));
  });
});

describe("bit-shift-rotate-visualizer parseOperand", () => {
  it("parses decimal / hex / binary / octal", () => {
    expect(parseOperand("255").value).toBe(255n);
    expect(parseOperand("0xff").value).toBe(255n);
    expect(parseOperand("0b1010").value).toBe(10n);
    expect(parseOperand("0o17").value).toBe(15n);
  });
  it("handles negative literals and underscores", () => {
    expect(parseOperand("-1").value).toBe(-1n);
    expect(parseOperand("0xff_ff").value).toBe(65535n);
  });
  it("throws on invalid digits / empty", () => {
    expect(() => parseOperand("0xgg")).toThrow();
    expect(() => parseOperand("0b2")).toThrow();
    expect(() => parseOperand("")).toThrow();
  });
});

describe("bit-shift-rotate-visualizer width helpers", () => {
  it("maskWidth clips to width", () => {
    expect(maskWidth(0x1FFn, 8)).toBe(0xFFn);
    expect(maskWidth(-1n, 8)).toBe(0xFFn);
    expect(maskWidth(0n, 64)).toBe(0n);
  });
  it("signExtend reinterprets MSB as sign", () => {
    expect(signExtend(0xFFn, 8)).toBe(-1n);
    expect(signExtend(0x7Fn, 8)).toBe(0x7Fn);
    expect(signExtend(0x80n, 8)).toBe(-128n);
  });
  it("toBinaryString pads to width", () => {
    expect(toBinaryString(5n, 8)).toBe("00000101");
    expect(toBinaryString(0xFFn, 8)).toBe("11111111");
    expect(toBinaryString(0xDEADBEEFn, 32)).toBe("11011110101011011011111011101111");
  });
  it("groupNibbles groups in 4-bit chunks", () => {
    expect(groupNibbles("10101010")).toBe("1010 1010");
    expect(groupNibbles("11001100")).toBe("1100 1100");
    expect(groupNibbles("1")).toBe("0001");
  });
  it("formatInBases returns bin/oct/dec/hex with sign awareness", () => {
    const r = formatInBases(255n, 8, "unsigned");
    expect(r.bin).toBe("11111111");
    expect(r.dec).toBe("255");
    expect(r.hex).toBe("FF");
    const s = formatInBases(0xFFn, 8, "signed");
    expect(s.dec).toBe("-1");
    expect(s.hex).toBe("FF");
  });
});

describe("bit-shift-rotate-visualizer shift kernels", () => {
  it("leftShift multiplies by 2^k (8-bit)", () => {
    expect(leftShift(0x01n, 8, 4)).toBe(0x10n);
    expect(leftShift(0x03n, 8, 1)).toBe(0x06n);
    // Overflow wraps off the top.
    expect(leftShift(0x80n, 8, 1)).toBe(0x00n);
    expect(leftShift(0xFFn, 8, 8)).toBe(0x00n); // k >= width
    expect(leftShift(0x05n, 8, 0)).toBe(0x05n); // k=0 no-op
  });
  it("leftShift throws on negative k", () => {
    expect(() => leftShift(1n, 8, -1)).toThrow();
  });
  it("arithmeticRightShift sign-fills for signed negatives", () => {
    // 0xF8 (=-8) >> 1 = 0xFC (=-4) at 8-bit signed.
    expect(arithmeticRightShift(0xF8n, 8, 1, "signed")).toBe(0xFCn);
    // 0x80 (=-128) >> 4 = 0xF8 (=-8).
    expect(arithmeticRightShift(0x80n, 8, 4, "signed")).toBe(0xF8n);
    // 0x80 (=-128) >> 8 = 0xFF (=-1).
    expect(arithmeticRightShift(0x80n, 8, 8, "signed")).toBe(0xFFn);
  });
  it("arithmeticRightShift zero-fills in unsigned mode", () => {
    expect(arithmeticRightShift(0xF8n, 8, 1, "unsigned")).toBe(0x7Cn);
    expect(arithmeticRightShift(0x80n, 8, 4, "unsigned")).toBe(0x08n);
  });
  it("logicalRightShift always zero-fills", () => {
    expect(logicalRightShift(0xF8n, 8, 1)).toBe(0x7Cn);
    expect(logicalRightShift(0xFFn, 8, 4)).toBe(0x0Fn);
    expect(logicalRightShift(0xFFn, 8, 8)).toBe(0x00n);
  });
  it("extractShiftedOut returns the dropped bits", () => {
    // Left shift of 0b11001010 by 3 → top 3 bits = 1,1,0
    expect(extractShiftedOut(0xCAn, 8, 3, "left")).toEqual([1, 1, 0]);
    // Right shift of 0b11001010 by 3 → bottom 3 bits = 0,1,0 (LSB first)
    expect(extractShiftedOut(0xCAn, 8, 3, "right")).toEqual([0, 1, 0]);
    expect(extractShiftedOut(0xFFn, 8, 0, "left")).toEqual([]);
  });
});

describe("bit-shift-rotate-visualizer rotate kernels", () => {
  it("ROL wraps top bits to bottom", () => {
    // 0b10000001 ROL 1 = 0b00000011
    expect(rotateBits(0x81n, 8, 1, 1)).toBe(0x03n);
    // 0b10000001 ROL 8 = identity (mod width)
    expect(rotateBits(0x81n, 8, 8, 1)).toBe(0x81n);
    // 0b11110000 ROL 4 = 0b00001111
    expect(rotateBits(0xF0n, 8, 4, 1)).toBe(0x0Fn);
  });
  it("ROR wraps bottom bits to top", () => {
    // 0b00000011 ROR 1 = 0b10000001
    expect(rotateBits(0x03n, 8, 1, -1)).toBe(0x81n);
    // 0b11110000 ROR 4 = 0b00001111
    expect(rotateBits(0xF0n, 8, 4, -1)).toBe(0x0Fn);
  });
  it("rotateBits handles k > width via mod", () => {
    expect(rotateBits(0x81n, 8, 9, 1)).toBe(0x03n); // 9 mod 8 = 1
    // ROL by -1 ≡ ROR by 1, so 0x81 (1000_0001) → 0xC0 (1100_0000).
    expect(rotateBits(0x81n, 8, -1, 1)).toBe(0xC0n);
  });
  it("RCL shifts bit+carry through (carry-in=0)", () => {
    // input=0x80, carry_in=0, RCL 1 → top bit (1) → carry, carry (0) → bottom.
    // Result: 0x00, carry=1.
    const r = rotateLeftThroughCarry(0x80n, 0, 8, 1);
    expect(r.value).toBe(0x00n);
    expect(r.carry).toBe(1);
  });
  it("RCL with carry-in=1 pulls 1 into bottom", () => {
    // input=0x00, carry_in=1, RCL 1 → 0x01, carry=0.
    const r = rotateLeftThroughCarry(0x00n, 1, 8, 1);
    expect(r.value).toBe(0x01n);
    expect(r.carry).toBe(0);
  });
  it("RCL by width+1 is a no-op", () => {
    const r = rotateLeftThroughCarry(0xABn, 1, 8, 9);
    expect(r.value).toBe(0xABn);
    expect(r.carry).toBe(1);
  });
  it("RCR shifts bit+carry through (carry-in=0)", () => {
    // input=0x01, carry_in=0, RCR 1 → bottom bit (1) → carry, carry (0) → top.
    // Result: 0x00, carry=1.
    const r = rotateRightThroughCarry(0x01n, 0, 8, 1);
    expect(r.value).toBe(0x00n);
    expect(r.carry).toBe(1);
  });
  it("RCR with carry-in=1 pulls 1 into top", () => {
    const r = rotateRightThroughCarry(0x00n, 1, 8, 1);
    expect(r.value).toBe(0x80n);
    expect(r.carry).toBe(0);
  });
});

describe("bit-shift-rotate-visualizer visualize (top-level)", () => {
  it("visualizes << with bit grid + shifted-out + carry", () => {
    const r = visualize("<<", 0xCAn, 8, 3, "unsigned", 0);
    expect(r.error).toBeUndefined();
    expect(r.output).toBe(0x50n); // (0xCA << 3) & 0xFF = 0x650 & 0xFF = 0x50
    expect(r.shiftedOut).toEqual([1, 1, 0]);
    expect(r.carryOut).toBe(1);
    expect(r.bitGrid).toHaveLength(3);
    expect(r.bitGrid[0].label).toBe("Input");
    expect(r.bitGrid[1].label).toBe("Output");
    expect(r.bitGrid[2].label).toBe("Shifted out");
    expect(r.annotation).toContain("2^3");
    expect(r.steps).toHaveLength(3);
  });
  it("visualizes >> arithmetic with sign fill", () => {
    // -8 (0xF8) >> 1 (signed) = -4 (0xFC).
    const r = visualize(">>", 0xF8n, 8, 1, "signed", 0);
    expect(r.output).toBe(0xFCn);
    expect(r.shiftedOut).toEqual([0]);
    expect(r.annotation).toContain("÷2");
  });
  it("visualizes >>> logical with zero fill even in signed mode", () => {
    const r = visualize(">>>", 0xF8n, 8, 1, "signed", 0);
    expect(r.output).toBe(0x7Cn);
  });
  it("ROL visualizer returns correct output and grid", () => {
    const r = visualize("ROL", 0x81n, 8, 1, "unsigned", 0);
    expect(r.output).toBe(0x03n);
    expect(r.carryOut).toBe(1);
    expect(r.bitGrid).toHaveLength(3);
    expect(r.annotation).toContain("Rotated left");
  });
  it("ROR visualizer returns correct output", () => {
    const r = visualize("ROR", 0x03n, 8, 1, "unsigned", 0);
    expect(r.output).toBe(0x81n);
  });
  it("RCL visualizer tracks carry through", () => {
    const r = visualize("RCL", 0x80n, 8, 1, "unsigned", 0);
    expect(r.output).toBe(0x00n);
    expect(r.carryOut).toBe(1);
  });
  it("RCR visualizer tracks carry through", () => {
    const r = visualize("RCR", 0x01n, 8, 1, "unsigned", 0);
    expect(r.output).toBe(0x00n);
    expect(r.carryOut).toBe(1);
  });
  it("errors on negative shift count", () => {
    const r = visualize("<<", 0x01n, 8, -1, "unsigned", 0);
    expect(r.error).toBeDefined();
  });
  it("warns when shift >= width for <<", () => {
    const r = visualize("<<", 0x01n, 8, 8, "unsigned", 0);
    expect(r.warning).toBeDefined();
    expect(r.output).toBe(0x00n);
  });
  it("k=0 produces no-op with empty steps", () => {
    const r = visualize("ROL", 0xABn, 8, 0, "unsigned", 0);
    expect(r.output).toBe(0xABn);
    expect(r.steps).toHaveLength(0);
    expect(r.annotation).toContain("No rotate");
  });
  it("64-bit shift is BigInt-exact", () => {
    const r = visualize("<<", 0x1n, 64, 63, "unsigned", 0);
    expect(r.output).toBe(1n << 63n);
    expect(r.bases.hex).toBe("8000000000000000");
  });
  it("visualizeFromInput parses input string", () => {
    const r = visualizeFromInput("<<", "0b00000011", 8, 1, "unsigned", 0);
    expect(r.error).toBeUndefined();
    expect(r.output).toBe(0x06n);
  });
  it("visualizeFromInput reports parse errors", () => {
    const r = visualizeFromInput("<<", "0xZZ", 8, 1, "unsigned", 0);
    expect(r.error).toBeDefined();
  });
});

describe("bit-shift-rotate-visualizer chain", () => {
  it("chains << 1 three times (each step doubles, mod width)", () => {
    const r = chain("<<", 0x01n, 8, 1, 3, "unsigned");
    expect(r.error).toBeUndefined();
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0].result).toBe(0x02n);
    expect(r.steps[1].result).toBe(0x04n);
    expect(r.steps[2].result).toBe(0x08n);
    expect(r.final).toBe(0x08n);
  });
  it("chains RCL 1 three times with carry threading", () => {
    // Start: value=0x00, carry=1; RCL 1 → value=0x01, carry=0;
    // RCL 1 → value=0x02, carry=0; RCL 1 → value=0x04, carry=0.
    const r = chain("RCL", 0x00n, 8, 1, 3, "unsigned", 1);
    expect(r.steps[0].result).toBe(0x01n);
    expect(r.steps[0].carry).toBe(0);
    expect(r.steps[1].result).toBe(0x02n);
    expect(r.steps[2].result).toBe(0x04n);
    expect(r.finalCarry).toBe(0);
  });
  it("errors on negative count", () => {
    const r = chain("<<", 0x01n, 8, 1, -1, "unsigned");
    expect(r.error).toBeDefined();
  });
});

describe("bit-shift-rotate-visualizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, op: "<<", input: "0x01", width: 8, shift: 1, signed: "unsigned", carryIn: 0, resultHex: "02" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].op).toBe("<<");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, op: "<<", input: String(i), width: 8, shift: 1, signed: "unsigned", carryIn: 0, resultHex: "00" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, op: "<<", input: "1", width: 8, shift: 1, signed: "unsigned", carryIn: 0, resultHex: "02" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bit-shift-rotate-visualizer shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ op: "ROL", input: "0x81", width: 8, shift: 1, signed: "unsigned", carryIn: 0 });
    expect(url).toContain("op=ROL");
    expect(url).toContain("v=0x81");
    expect(url).toContain("w=8");
    expect(url).toContain("k=1");
    expect(url).toContain("s=unsigned");
    expect(url).toContain("c=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("op=ROR&v=0x03&w=8&k=1&s=signed&c=1");
    expect(s.op).toBe("ROR");
    expect(s.input).toBe("0x03");
    expect(s.width).toBe(8);
    expect(s.shift).toBe(1);
    expect(s.signed).toBe("signed");
    expect(s.carryIn).toBe(1);
  });
  it("defaults to <<, 32-bit, shift 1, unsigned, carry 0 on empty hash", () => {
    const s = parseShareUrl("");
    expect(s.op).toBe("<<");
    expect(s.width).toBe(32);
    expect(s.shift).toBe(1);
    expect(s.signed).toBe("unsigned");
    expect(s.carryIn).toBe(0);
  });
  it("sanitizes invalid width / op / negative shift", () => {
    const s = parseShareUrl("op=BOGUS&v=1&w=7&k=-5&s=signed&c=2");
    expect(s.op).toBe("<<"); // falls back to default
    expect(s.width).toBe(32);
    expect(s.shift).toBe(0); // negative clamped to 0
    expect(s.carryIn).toBe(0); // anything non-"1" becomes 0
  });
  it("accepts all 4 widths", () => {
    for (const w of [8, 16, 32, 64] as BitWidth[]) {
      expect(parseShareUrl(`op=%3C%3C&v=1&w=${w}&k=1&s=unsigned&c=0`).width).toBe(w);
    }
  });
});

// Suppress unused-import lint
export type _Unused = BitWidth | SignMode | ShiftOp;
