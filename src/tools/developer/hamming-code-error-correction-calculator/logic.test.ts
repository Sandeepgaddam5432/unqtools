import { describe, it, expect, beforeEach } from "vitest";
import {
  VARIANTS,
  VARIANT_LABELS,
  computeParams,
  autoVariant,
  isParityPosition,
  getParityIndex,
  getCoveredPositions,
  getDataPositions,
  getParityPositions,
  computeParity,
  computeSyndromeBit,
  encode,
  encodeSecded,
  decode,
  decodeSecded,
  injectError,
  injectErrors,
  buildLayout,
  buildCoverage,
  extractData,
  describeParity,
  parseDataBits,
  parseCodeword,
  formatBits,
  formatSyndrome,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HammingVariant,
  type ParityMode,
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

// ---------------------------------------------------------------------------
// Constants & variant tables
// ---------------------------------------------------------------------------

describe("hamming-code constants", () => {
  it("has 3 variants with correct (n, k, p)", () => {
    expect(Object.keys(VARIANTS)).toHaveLength(3);
    expect(VARIANTS["hamming-7-4"]).toEqual({ n: 7, k: 4, p: 3 });
    expect(VARIANTS["hamming-15-11"]).toEqual({ n: 15, k: 11, p: 4 });
    expect(VARIANTS["hamming-31-26"]).toEqual({ n: 31, k: 26, p: 5 });
  });
  it("has labels for all variants", () => {
    expect(Object.keys(VARIANT_LABELS)).toHaveLength(3);
    expect(VARIANT_LABELS["hamming-7-4"]).toContain("Hamming(7,4)");
  });
});

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

describe("hamming-code position helpers", () => {
  it("isParityPosition detects powers of two", () => {
    expect(isParityPosition(1)).toBe(true);
    expect(isParityPosition(2)).toBe(true);
    expect(isParityPosition(4)).toBe(true);
    expect(isParityPosition(8)).toBe(true);
    expect(isParityPosition(3)).toBe(false);
    expect(isParityPosition(5)).toBe(false);
    expect(isParityPosition(6)).toBe(false);
    expect(isParityPosition(7)).toBe(false);
  });
  it("getParityIndex returns 1..p for powers of two, null otherwise", () => {
    expect(getParityIndex(1)).toBe(1);
    expect(getParityIndex(2)).toBe(2);
    expect(getParityIndex(4)).toBe(3);
    expect(getParityIndex(8)).toBe(4);
    expect(getParityIndex(3)).toBeNull();
    expect(getParityIndex(7)).toBeNull();
  });
  it("getCoveredPositions returns covered positions (excl. self)", () => {
    // P1 covers positions with bit 0 set: 3,5,7 (excl. 1)
    expect(getCoveredPositions(1, 7)).toEqual([3, 5, 7]);
    // P2 (pos 2) covers 3,6,7
    expect(getCoveredPositions(2, 7)).toEqual([3, 6, 7]);
    // P3 (pos 4) covers 5,6,7
    expect(getCoveredPositions(4, 7)).toEqual([5, 6, 7]);
  });
  it("getDataPositions and getParityPositions partition 1..n", () => {
    const data = getDataPositions(7);
    const parity = getParityPositions(7);
    expect(parity).toEqual([1, 2, 4]);
    expect(data).toEqual([3, 5, 6, 7]);
    expect(data.length + parity.length).toBe(7);
  });
});

describe("hamming-code computeParams & autoVariant", () => {
  it("computeParams returns Hamming params for arbitrary k", () => {
    expect(computeParams(4)).toEqual({ n: 7, k: 4, p: 3 });
    expect(computeParams(11)).toEqual({ n: 15, k: 11, p: 4 });
    expect(computeParams(26)).toEqual({ n: 31, k: 26, p: 5 });
  });
  it("autoVariant picks the smallest fitting standard variant", () => {
    expect(autoVariant(1)).toBe("hamming-7-4");
    expect(autoVariant(4)).toBe("hamming-7-4");
    expect(autoVariant(5)).toBe("hamming-15-11");
    expect(autoVariant(11)).toBe("hamming-15-11");
    expect(autoVariant(12)).toBe("hamming-31-26");
    expect(autoVariant(26)).toBe("hamming-31-26");
  });
  it("computeParams throws for k < 1", () => {
    expect(() => computeParams(0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

describe("hamming-code encode", () => {
  it("encodes Hamming(7,4) data 1011 to known codeword (even parity)", () => {
    // data 1011 at positions 3,5,6,7 → p1=0,p2=1,p3=0 → "0110011"
    const res = encode([1, 0, 1, 1], "hamming-7-4", "even");
    expect(res.params).toEqual({ n: 7, k: 4, p: 3 });
    expect(formatBits(res.codeword)).toBe("0110011");
  });
  it("places data at non-parity positions and parity at powers of two", () => {
    const res = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const parityCells = res.layout.filter((c) => c.type === "parity");
    const dataCells = res.layout.filter((c) => c.type === "data");
    expect(parityCells.map((c) => c.position)).toEqual([1, 2, 4]);
    expect(dataCells.map((c) => c.position)).toEqual([3, 5, 6, 7]);
    expect(dataCells.map((c) => c.value)).toEqual([1, 0, 1, 1]);
  });
  it("pads short data with zeros", () => {
    const res = encode([1, 0], "hamming-7-4", "even");
    expect(res.dataBits).toEqual([1, 0, 0, 0]);
    expect(res.codeword).toHaveLength(7);
  });
  it("throws when data exceeds k", () => {
    expect(() => encode([1, 0, 1, 1, 0], "hamming-7-4", "even")).toThrow();
  });
  it("coverage has one entry per parity bit", () => {
    const res = encode([1, 0, 1, 1], "hamming-7-4", "even");
    expect(res.coverage).toHaveLength(3);
    expect(res.coverage[0].parityPosition).toBe(1);
    expect(res.coverage[0].coveredPositions).toEqual([3, 5, 7]);
  });
  it("odd parity produces a different codeword than even", () => {
    const even = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const odd = encode([1, 0, 1, 1], "hamming-7-4", "odd");
    // Parity bits (positions 1,2,4) should be inverted; data bits same.
    expect(odd.codeword[2]).toBe(even.codeword[2]); // d1
    expect(odd.codeword[4]).toBe(even.codeword[4]); // d2
    expect(odd.codeword[0]).toBe(1 - even.codeword[0]); // p1 inverted
    expect(odd.codeword[1]).toBe(1 - even.codeword[1]); // p2 inverted
    expect(odd.codeword[3]).toBe(1 - even.codeword[3]); // p3 inverted
  });
});

// ---------------------------------------------------------------------------
// Decode & round-trip
// ---------------------------------------------------------------------------

describe("hamming-code decode (no error)", () => {
  it("syndrome is 0 for a clean codeword", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const dec = decode(enc.codeword, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(0);
    expect(dec.errorPosition).toBeNull();
    expect(dec.singleErrorCorrected).toBe(false);
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
});

describe("hamming-code decode (single-bit correction)", () => {
  it("corrects a single-bit error at a data position", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const corrupted = injectError(enc.codeword, 5).corrupted;
    const dec = decode(corrupted, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(5);
    expect(dec.errorPosition).toBe(5);
    expect(dec.singleErrorCorrected).toBe(true);
    expect(formatBits(dec.corrected)).toBe("0110011");
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
  it("corrects a single-bit error at a parity position", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const corrupted = injectError(enc.codeword, 2).corrupted;
    const dec = decode(corrupted, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(2);
    expect(dec.errorPosition).toBe(2);
    expect(formatBits(dec.corrected)).toBe("0110011");
  });
  it("round-trips for all single-bit positions on Hamming(7,4)", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    for (let pos = 1; pos <= 7; pos++) {
      const corrupted = injectError(enc.codeword, pos).corrupted;
      const dec = decode(corrupted, "hamming-7-4", "even");
      expect(dec.errorPosition).toBe(pos);
      expect(formatBits(dec.corrected)).toBe("0110011");
      expect(formatBits(dec.recoveredData)).toBe("1011");
    }
  });
  it("round-trips for Hamming(15,11) and Hamming(31,26)", () => {
    for (const variant of ["hamming-15-11", "hamming-31-26"] as HammingVariant[]) {
      const data = Array.from({ length: 11 }, (_, i) => (i % 2 === 0 ? 1 : 0) as 0 | 1);
      const enc = encode(data, variant, "even");
      const midPos = Math.floor(enc.params.n / 2);
      const corrupted = injectError(enc.codeword, midPos).corrupted;
      const dec = decode(corrupted, variant, "even");
      expect(dec.errorPosition).toBe(midPos);
      expect(formatBits(dec.recoveredData)).toBe(formatBits(enc.dataBits));
    }
  });
  it("round-trips with odd parity mode", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "odd");
    const corrupted = injectError(enc.codeword, 6).corrupted;
    const dec = decode(corrupted, "hamming-7-4", "odd");
    expect(dec.errorPosition).toBe(6);
    expect(formatBits(dec.corrected)).toBe(formatBits(enc.codeword));
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
});

// ---------------------------------------------------------------------------
// SECDED
// ---------------------------------------------------------------------------

describe("hamming-code SECDED encode", () => {
  it("appends an overall parity bit (length n+1)", () => {
    const res = encodeSecded([1, 0, 1, 1], "hamming-7-4", "even");
    expect(res.codewordWithParity).toHaveLength(8);
    // 0110011 has 4 ones (even), so overall parity = 0 for even mode.
    expect(res.overallParity).toBe(0);
    expect(formatBits(res.codewordWithParity)).toBe("01100110");
  });
  it("throws when called with too many data bits", () => {
    expect(() => encodeSecded([1, 0, 1, 1, 0], "hamming-7-4", "even")).toThrow();
  });
});

describe("hamming-code SECDED decode", () => {
  it("reports no error for a clean codeword", () => {
    const enc = encodeSecded([1, 0, 1, 1], "hamming-7-4", "even");
    const dec = decodeSecded(enc.codewordWithParity, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(0);
    expect(dec.overallParityOk).toBe(true);
    expect(dec.singleErrorCorrected).toBe(false);
    expect(dec.doubleErrorDetected).toBe(false);
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
  it("corrects a single-bit error in the inner codeword", () => {
    const enc = encodeSecded([1, 0, 1, 1], "hamming-7-4", "even");
    const corrupted = injectError(enc.codewordWithParity, 5).corrupted;
    const dec = decodeSecded(corrupted, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(5);
    expect(dec.overallParityOk).toBe(false);
    expect(dec.singleErrorCorrected).toBe(true);
    expect(dec.doubleErrorDetected).toBe(false);
    expect(dec.errorPosition).toBe(5);
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
  it("detects (does not correct) a double-bit error", () => {
    const enc = encodeSecded([1, 0, 1, 1], "hamming-7-4", "even");
    const corrupted = injectErrors(enc.codewordWithParity, [5, 6]).corrupted;
    const dec = decodeSecded(corrupted, "hamming-7-4", "even");
    expect(dec.doubleErrorDetected).toBe(true);
    expect(dec.singleErrorCorrected).toBe(false);
    // recovered data may be wrong — the point is it's flagged, not silently miscorrected.
  });
  it("corrects an error in the overall parity bit itself", () => {
    const enc = encodeSecded([1, 0, 1, 1], "hamming-7-4", "even");
    // Position 8 = overall parity bit.
    const corrupted = injectError(enc.codewordWithParity, 8).corrupted;
    const dec = decodeSecded(corrupted, "hamming-7-4", "even");
    expect(dec.syndrome).toBe(0);
    expect(dec.overallParityOk).toBe(false);
    expect(dec.errorPosition).toBe(8);
    expect(dec.singleErrorCorrected).toBe(true);
    expect(formatBits(dec.recoveredData)).toBe("1011");
  });
  it("plain decode miscorrects a double-bit error (contrast with SECDED)", () => {
    // Without SECDED, two flipped bits produce a nonzero syndrome that
    // points to a *third* position — the hallmark of miscorrection.
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const corrupted = injectErrors(enc.codeword, [5, 6]).corrupted;
    const dec = decode(corrupted, "hamming-7-4", "even");
    expect(dec.syndrome).not.toBe(0);
    expect(dec.singleErrorCorrected).toBe(true);
    // And the "corrected" codeword differs from the original.
    expect(formatBits(dec.corrected)).not.toBe("0110011");
  });
});

// ---------------------------------------------------------------------------
// Error injection
// ---------------------------------------------------------------------------

describe("hamming-code injectError / injectErrors", () => {
  it("flips a single bit", () => {
    const r = injectError([0, 1, 1, 0, 0, 1, 1] as (0 | 1)[], 5);
    expect(r.flippedPosition).toBe(5);
    expect(r.flippedPositions).toEqual([5]);
    expect(r.corrupted[4]).toBe(1); // was 0
    expect(r.corrupted[5]).toBe(1); // unchanged
  });
  it("flips multiple bits", () => {
    const r = injectErrors([0, 1, 1, 0, 0, 1, 1] as (0 | 1)[], [1, 7]);
    expect(r.flippedPositions).toEqual([1, 7]);
    expect(r.corrupted[0]).toBe(1); // was 0
    expect(r.corrupted[6]).toBe(0); // was 1
  });
  it("throws on out-of-range position", () => {
    expect(() => injectError([0, 1, 1], 0)).toThrow();
    expect(() => injectError([0, 1, 1], 4)).toThrow();
    expect(() => injectErrors([0, 1, 1], [1, 5])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Layout, coverage, helpers
// ---------------------------------------------------------------------------

describe("hamming-code layout & coverage", () => {
  it("buildLayout marks parity vs data cells", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    expect(enc.layout).toHaveLength(7);
    const p1 = enc.layout.find((c) => c.position === 1);
    expect(p1?.type).toBe("parity");
    expect(p1?.parityIndex).toBe(1);
    const d3 = enc.layout.find((c) => c.position === 3);
    expect(d3?.type).toBe("data");
    expect(d3?.parityIndex).toBeUndefined();
  });
  it("buildCoverage returns one entry per parity bit with computed value", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    expect(enc.coverage).toHaveLength(3);
    const c1 = enc.coverage[0];
    expect(c1.parityIndex).toBe(1);
    expect(c1.coveredValues).toEqual([1, 0, 1]); // positions 3,5,7
    expect(c1.computed).toBe(0); // XOR = 0, even → 0
  });
  it("extractData returns just the data bits", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    expect(formatBits(extractData(enc.codeword, 7))).toBe("1011");
  });
  it("describeParity returns a human-readable string", () => {
    const enc = encode([1, 0, 1, 1], "hamming-7-4", "even");
    const s = describeParity(enc.coverage[0]);
    expect(s).toContain("P1@pos1");
    expect(s).toContain("covers positions");
    expect(s).toContain("even");
  });
});

// ---------------------------------------------------------------------------
// Parsing & formatting
// ---------------------------------------------------------------------------

describe("hamming-code parse / format", () => {
  it("parseDataBits accepts 0/1 strings", () => {
    const r = parseDataBits("1011");
    expect(r.bits).toEqual([1, 0, 1, 1]);
    expect(r.error).toBeUndefined();
  });
  it("parseDataBits rejects non-binary input", () => {
    expect(parseDataBits("1021").error).toBeDefined();
    expect(parseDataBits("").error).toBeDefined();
    expect(parseDataBits("abc").error).toBeDefined();
  });
  it("parseCodeword enforces length", () => {
    const r = parseCodeword("0110011", 7);
    expect(r.bits).toHaveLength(7);
    expect(r.error).toBeUndefined();
    expect(parseCodeword("011", 7).error).toBeDefined();
    expect(parseCodeword("0110011", 8).error).toBeDefined();
  });
  it("formatBits round-trips", () => {
    expect(formatBits([1, 0, 1, 1])).toBe("1011");
    expect(formatBits([])).toBe("");
  });
  it("formatSyndrome renders MSB-first padded to p", () => {
    // syndromeBits[0] = parity 1 (LSB); 3 bits, syndrome = 5 = 101 binary
    const bits = [1, 0, 1] as (0 | 1)[]; // LSB-first → 101 MSB-first
    expect(formatSyndrome(bits, 3)).toBe("101");
    // 4 bits, syndrome = 3 = 0011 binary, LSB-first [1,1,0,0] → MSB-first "0011"
    expect(formatSyndrome([1, 1, 0, 0] as (0 | 1)[], 4)).toBe("0011");
  });
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

describe("hamming-code history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({
      ts: 1,
      variant: "hamming-7-4",
      mode: "even",
      isSecded: false,
      dataBits: "1011",
      codeword: "0110011",
      syndrome: 0,
      errorPosition: null,
      doubleErrorDetected: false,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].codeword).toBe("0110011");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        variant: "hamming-7-4",
        mode: "even",
        isSecded: false,
        dataBits: "1011",
        codeword: "0110011",
        syndrome: i,
        errorPosition: null,
        doubleErrorDetected: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // most-recent-first
    expect(loadHistory()[0].syndrome).toBe(24);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, variant: "hamming-7-4", mode: "even", isSecded: false,
      dataBits: "1", codeword: "1", syndrome: 0, errorPosition: null,
      doubleErrorDetected: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("hamming-code shareable URL", () => {
  it("builds a share URL when window is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("1011", "hamming-15-11", "odd", true, 3);
    expect(url).toContain("data=1011");
    expect(url).toContain("variant=hamming-15-11");
    expect(url).toContain("mode=odd");
    expect(url).toContain("secded=1");
    expect(url).toContain("flip=3");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips", () => {
    const p = parseShareUrl("data=1011&variant=hamming-31-26&mode=odd&secded=1&flip=7");
    expect(p.dataBits).toBe("1011");
    expect(p.variant).toBe("hamming-31-26");
    expect(p.mode).toBe("odd");
    expect(p.isSecded).toBe(true);
    expect(p.injectPos).toBe(7);
  });
  it("parseShareUrl returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.dataBits).toBe("");
    expect(p.variant).toBe("hamming-7-4");
    expect(p.mode).toBe("even");
    expect(p.isSecded).toBe(false);
    expect(p.injectPos).toBe(0);
  });
  it("parseShareUrl coerces unknown variant/mode to defaults", () => {
    const p = parseShareUrl("variant=bogus&mode=weird&secded=0");
    expect(p.variant).toBe("hamming-7-4");
    expect(p.mode).toBe("even");
    expect(p.isSecded).toBe(false);
  });
});

// Suppress unused-import lint for re-exported types.
export type _Unused = HammingVariant | ParityMode;
