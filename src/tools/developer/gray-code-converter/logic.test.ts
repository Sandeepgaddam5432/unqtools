import { describe, it, expect, beforeEach } from "vitest";
import {
  padBinary,
  formatBinary,
  popcount,
  changedBitPosition,
  binaryToGray,
  grayToBinary,
  decimalToGray,
  grayToDecimal,
  binaryToGrayBig,
  grayToBinaryBig,
  binaryToGraySteps,
  grayToBinarySteps,
  parseInputValue,
  generateSequence,
  verifySingleBitChange,
  generateNaryGray,
  generateBalancedGray,
  computeToggleCounts,
  buildTruthTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  MAX_SEQUENCE_BITS,
  type InputBase,
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

describe("gray-code format helpers", () => {
  it("padBinary pads to width", () => {
    expect(padBinary("101", 8)).toBe("00000101");
    expect(padBinary("11111111", 4)).toBe("1111");
  });
  it("formatBinary formats a number", () => {
    expect(formatBinary(5, 8)).toBe("00000101");
    expect(formatBinary(0, 4)).toBe("0000");
  });
  it("popcount counts bits", () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(7)).toBe(3);
    expect(popcount(0xFF)).toBe(8);
  });
  it("changedBitPosition finds the differing bit", () => {
    expect(changedBitPosition(0b0000, 0b0001)).toBe(0);
    expect(changedBitPosition(0b0000, 0b1000)).toBe(3);
    expect(changedBitPosition(0b0101, 0b0101)).toBe(-1);
  });
});

describe("gray-code binary ↔ gray", () => {
  it("binaryToGray matches known values", () => {
    // Standard BRGC table for 3 bits:
    // 0→0, 1→1, 2→3, 3→2, 4→6, 5→7, 6→5, 7→4
    expect(binaryToGray(0)).toBe(0);
    expect(binaryToGray(1)).toBe(1);
    expect(binaryToGray(2)).toBe(3);
    expect(binaryToGray(3)).toBe(2);
    expect(binaryToGray(4)).toBe(6);
    expect(binaryToGray(5)).toBe(7);
    expect(binaryToGray(6)).toBe(5);
    expect(binaryToGray(7)).toBe(4);
  });
  it("grayToBinary is the inverse of binaryToGray", () => {
    for (let i = 0; i < 256; i++) {
      expect(grayToBinary(binaryToGray(i))).toBe(i);
    }
  });
  it("decimalToGray and grayToDecimal roundtrip at width", () => {
    for (let i = 0; i < 16; i++) {
      const g = decimalToGray(i, 4);
      expect(grayToDecimal(g, 4)).toBe(i);
    }
  });
  it("decimalToGray masks to width", () => {
    expect(decimalToGray(0x1FF, 4)).toBe(binaryToGray(0xF));
  });
  it("returns 0 for negative input", () => {
    expect(binaryToGray(-1)).toBe(0);
    expect(grayToBinary(-1)).toBe(0);
  });
});

describe("gray-code BigInt variants", () => {
  it("binaryToGrayBig works for large values", () => {
    // 2^60 in binary → gray = b ^ (b >> 1)
    const v = BigInt(1) << BigInt(60);
    const expected = v ^ (v >> BigInt(1));
    expect(binaryToGrayBig(v)).toBe(expected);
  });
  it("grayToBinaryBig is the inverse", () => {
    const v = (BigInt(1) << BigInt(60)) + BigInt(12345);
    expect(grayToBinaryBig(binaryToGrayBig(v))).toBe(v);
  });
  it("handles very wide values up to 2^128", () => {
    const v = (BigInt(1) << BigInt(100)) | BigInt(0xDEADBEEF);
    expect(grayToBinaryBig(binaryToGrayBig(v))).toBe(v);
  });
});

describe("gray-code step-by-step working", () => {
  it("binaryToGraySteps shows XOR steps", () => {
    const w = binaryToGraySteps(0b1011, 4);
    expect(w.inputBinary).toBe("1011");
    expect(w.outputBinary).toBe("1110");
    expect(w.steps).toHaveLength(4);
    expect(w.steps[0].explanation).toContain("MSB copied");
    expect(w.steps[1].explanation).toContain("⊕");
  });
  it("grayToBinarySteps shows prefix-XOR steps", () => {
    const w = grayToBinarySteps(0b1110, 4);
    expect(w.inputBinary).toBe("1110");
    expect(w.outputBinary).toBe("1011");
    expect(w.steps).toHaveLength(4);
    expect(w.steps[0].explanation).toContain("MSB copied");
    expect(w.steps[1].explanation).toContain("⊕");
  });
  it("MSB of binary and gray match", () => {
    for (let v = 0; v < 16; v++) {
      const w = binaryToGraySteps(v, 4);
      expect(w.steps[0].binBit).toBe(w.steps[0].grayBit);
    }
  });
});

describe("gray-code parseInputValue", () => {
  it("parses decimal", () => {
    expect(parseInputValue("42", "decimal", 8).value).toBe(42);
  });
  it("parses binary", () => {
    expect(parseInputValue("101010", "binary", 8).value).toBe(42);
  });
  it("rejects invalid decimal", () => {
    expect(parseInputValue("abc", "decimal", 8).error).toBeTruthy();
  });
  it("rejects invalid binary", () => {
    expect(parseInputValue("10201", "binary", 8).error).toBeTruthy();
  });
  it("rejects empty input", () => {
    expect(parseInputValue("", "decimal", 8).error).toBeTruthy();
  });
  it("warns when value exceeds width", () => {
    expect(parseInputValue("256", "decimal", 8).error).toBeTruthy();
  });
  it("rejects negative", () => {
    expect(parseInputValue("-5", "decimal", 8).error).toBeTruthy();
  });
  it("truncates long binary to width", () => {
    expect(parseInputValue("111111111", "binary", 8).value).toBe(0xFF);
  });
});

describe("gray-code sequence generation", () => {
  it("generates 2^n entries", () => {
    const seq = generateSequence(3);
    expect(seq.count).toBe(8);
    expect(seq.entries).toHaveLength(8);
  });
  it("first entry is 0, no changedBit", () => {
    const seq = generateSequence(3);
    expect(seq.entries[0].decimal).toBe(0);
    expect(seq.entries[0].changedBit).toBeNull();
  });
  it("every transition is single-bit change", () => {
    const seq = generateSequence(5);
    expect(seq.singleBitChange).toBe(true);
    for (let i = 1; i < seq.entries.length; i++) {
      expect(seq.entries[i].changedBit).not.toBeNull();
      const diff = seq.entries[i].grayDecimal ^ seq.entries[i - 1].grayDecimal;
      expect(popcount(diff)).toBe(1);
    }
  });
  it("wrap-around is single-bit change", () => {
    const seq = generateSequence(4);
    expect(seq.wrapSingleBitChange).toBe(true);
  });
  it("reports toggle counts", () => {
    const seq = generateSequence(3);
    expect(seq.toggleCounts).toHaveLength(3);
    // Standard BRGC for n=3, with wrap toggle included, has toggle counts
    // (4, 2, 2) — bit 0 toggles 4x, bits 1 and 2 toggle 2x each (total 8).
    expect(seq.toggleCounts[0]).toBe(4);
    expect(seq.toggleCounts[2]).toBe(2);
  });
  it("rejects n > MAX_SEQUENCE_BITS", () => {
    expect(() => generateSequence(MAX_SEQUENCE_BITS + 1)).toThrow();
  });
  it("empty sequence for n=0", () => {
    const seq = generateSequence(0);
    expect(seq.entries).toHaveLength(0);
  });
});

describe("gray-code verifySingleBitChange", () => {
  it("returns valid=true for a proper Gray sequence", () => {
    const seq = generateSequence(4);
    const v = verifySingleBitChange(seq.entries);
    expect(v.valid).toBe(true);
    expect(v.wrapValid).toBe(true);
  });
});

describe("gray-code n-ary", () => {
  it("generates r^n entries", () => {
    const r = generateNaryGray(3, 2);
    expect(r.count).toBe(9);
    expect(r.entries).toHaveLength(9);
  });
  it("every transition changes exactly one digit by ±1", () => {
    const r = generateNaryGray(3, 2);
    expect(r.singleDigitChange).toBe(true);
    for (let i = 1; i < r.entries.length; i++) {
      const prev = r.entries[i - 1].digits;
      const cur = r.entries[i].digits;
      const diffs = cur.map((d, j) => Math.abs(d - prev[j]));
      const nonzero = diffs.filter((x) => x > 0);
      expect(nonzero).toHaveLength(1);
      expect(nonzero[0]).toBe(1);
    }
  });
  it("binary is the special case r=2", () => {
    const r = generateNaryGray(2, 3);
    expect(r.count).toBe(8);
  });
  it("rejects r < 2", () => {
    expect(() => generateNaryGray(1, 2)).toThrow();
  });
});

describe("gray-code balanced", () => {
  it("n=3 falls back to standard BRGC (no balanced cycle exists)", () => {
    const b = generateBalancedGray(3);
    expect(b.entries).toHaveLength(8);
    // Parity constraint blocks perfect balance for n=3: only (4, 2, 2)
    // achievable, max-min = 2 > 1.
    expect(b.balanced).toBe(false);
    // But it's still a valid Gray code (single-bit change).
    expect(b.singleBitChange).toBe(true);
  });
  it("n=4 finds a perfectly balanced Gray code (4 toggles per bit)", () => {
    const b = generateBalancedGray(4);
    expect(b.entries).toHaveLength(16);
    expect(b.balanced).toBe(true);
    expect(b.maxToggle).toBe(b.minToggle);
    expect(b.maxToggle).toBe(4);
  });
  it("preserves single-bit change property", () => {
    const b = generateBalancedGray(4);
    expect(b.singleBitChange).toBe(true);
    expect(b.wrapSingleBitChange).toBe(true);
  });
  it("n=5 falls back to standard (parity blocks perfect balance)", () => {
    const b = generateBalancedGray(5);
    expect(b.entries).toHaveLength(32);
    // For n=5, avg = 32/5 = 6.4 (non-integer), so perfect balance is
    // impossible. The function falls back to standard BRGC.
    expect(b.singleBitChange).toBe(true);
  });
});

describe("gray-code computeToggleCounts", () => {
  it("matches sequence.toggleCounts", () => {
    const seq = generateSequence(4);
    const recomputed = computeToggleCounts(seq.entries, 4);
    expect(recomputed).toEqual(seq.toggleCounts);
  });
});

describe("gray-code truth table", () => {
  it("builds a truth table of correct size", () => {
    const t = buildTruthTable(3);
    expect(t.width).toBe(3);
    expect(t.count).toBe(8);
    expect(t.rows).toHaveLength(8);
  });
  it("includes index, binary, gray columns", () => {
    const t = buildTruthTable(3);
    expect(t.rows[0].index).toBe(0);
    expect(t.rows[0].binary).toBe("000");
    expect(t.rows[0].gray).toBe("000");
  });
  it("supports balanced variant", () => {
    const t = buildTruthTable(4, true);
    expect(t.count).toBe(16);
  });
});

describe("gray-code history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "5", base: "decimal", width: 4, result: "7" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: String(i), base: "decimal", width: 4, result: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "x", base: "decimal", width: 4, result: "y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("gray-code shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("42", "decimal", 8);
    expect(url).toContain("input=42");
    expect(url).toContain("base=decimal");
    expect(url).toContain("width=8");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("input=42&base=binary&width=16");
    expect(p.input).toBe("42");
    expect(p.base).toBe("binary");
    expect(p.width).toBe(16);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", base: "decimal", width: 8 });
  });
  it("defaults invalid width to 8", () => {
    expect(parseShareUrl("input=x&width=999").width).toBe(8);
  });
});

// Suppress unused-import lint
export type _Unused = InputBase;
