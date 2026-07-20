import { describe, it, expect, beforeEach } from "vitest";
import {
  BRAND_SPECS,
  BRAND_LIST,
  MODE_SPECS,
  MODE_LIST,
  CANONICAL_VALID_NUMBERS,
  CANONICAL_INVALID_NUMBERS,
  normalizeNumber,
  maskCard,
  luhnCheckDigit,
  luhnValidate,
  explainLuhn,
  correctCheckDigit,
  transpositionHint,
  detectBrand,
  extractBin,
  formatCard,
  validateSingle,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CardBrand,
  type InputMode,
  type CardFormat,
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

describe("luhn-credit-card-validator constants", () => {
  it("exposes 8 brands", () => {
    expect(BRAND_LIST).toHaveLength(8);
  });
  it("exposes 4 input modes", () => {
    expect(MODE_LIST).toHaveLength(4);
  });
  it("has 8 brand specs", () => {
    expect(Object.keys(BRAND_SPECS)).toHaveLength(8);
  });
  it("has 4 mode specs", () => {
    expect(Object.keys(MODE_SPECS)).toHaveLength(4);
  });
  it("ships canonical valid test vectors", () => {
    expect(CANONICAL_VALID_NUMBERS.length).toBeGreaterThanOrEqual(10);
  });
  it("ships canonical invalid test vectors", () => {
    expect(CANONICAL_INVALID_NUMBERS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("luhn-credit-card-validator normalizeNumber", () => {
  it("strips non-digits", () => {
    expect(normalizeNumber("4242 4242 4242 4242")).toBe("4242424242424242");
  });
  it("strips dashes", () => {
    expect(normalizeNumber("4242-4242-4242-4242")).toBe("4242424242424242");
  });
  it("handles empty", () => {
    expect(normalizeNumber("")).toBe("");
  });
  it("handles pure non-digit input", () => {
    expect(normalizeNumber("abc-!@#")).toBe("");
  });
});

describe("luhn-credit-card-validator maskCard", () => {
  it("masks all but last 4 by default", () => {
    expect(maskCard("4242424242424242")).toBe("••••••••••••4242");
  });
  it("respects custom keep count", () => {
    expect(maskCard("4242424242424242", 6)).toBe("••••••••••424242");
  });
  it("returns as-is when length ≤ keep", () => {
    expect(maskCard("1234")).toBe("1234");
  });
});

describe("luhn-credit-card-validator luhnCheckDigit", () => {
  it("computes Wikipedia canonical check digit (3)", () => {
    // Wikipedia example: 7992739871 + check = 79927398713
    expect(luhnCheckDigit("7992739871")).toBe(3);
  });
  it("computes Stripe Visa check digit (2)", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2);
  });
  it("handles all-zero input", () => {
    expect(luhnCheckDigit("000000000000000")).toBe(0);
  });
});

describe("luhn-credit-card-validator luhnValidate", () => {
  it("accepts Wikipedia canonical 79927398713", () => {
    expect(luhnValidate("79927398713")).toBe(true);
  });
  it("rejects Wikipedia canonical with wrong check digit", () => {
    expect(luhnValidate("79927398710")).toBe(false);
  });
  it("accepts all canonical valid numbers", () => {
    for (const v of CANONICAL_VALID_NUMBERS) {
      expect(luhnValidate(v.number)).toBe(true);
    }
  });
  it("rejects all canonical invalid numbers", () => {
    for (const v of CANONICAL_INVALID_NUMBERS) {
      expect(luhnValidate(v.number)).toBe(false);
    }
  });
  it("strips spaces before validating", () => {
    expect(luhnValidate("4242 4242 4242 4242")).toBe(true);
  });
  it("strips dashes before validating", () => {
    expect(luhnValidate("4242-4242-4242-4242")).toBe(true);
  });
  it("rejects single-digit input", () => {
    expect(luhnValidate("5")).toBe(false);
  });
  it("rejects non-digit input", () => {
    expect(luhnValidate("4242424242424242abc")).toBe(true); // non-digits stripped, still valid
  });
  it("rejects empty", () => {
    expect(luhnValidate("")).toBe(false);
  });
});

describe("luhn-credit-card-validator explainLuhn", () => {
  it("returns valid explanation for canonical number", () => {
    const e = explainLuhn("79927398713");
    expect(e.valid).toBe(true);
    expect(e.mod10).toBe(0);
    expect(e.providedCheck).toBe(3);
    expect(e.expectedCheck).toBe(3);
    expect(e.steps).toHaveLength(11);
  });
  it("marks the rightmost digit as not doubled (check digit)", () => {
    const e = explainLuhn("79927398713");
    const last = e.steps[e.steps.length - 1]!;
    expect(last.positionFromRight).toBe(1);
    expect(last.doubled).toBe(false);
  });
  it("doubles every second digit from the right (excluding check)", () => {
    const e = explainLuhn("79927398713");
    // Position 2, 4, 6, 8, 10 should be doubled
    const doubledPositions = e.steps.filter((s) => s.doubled).map((s) => s.positionFromRight);
    expect(doubledPositions.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
  });
  it("subtracts 9 when doubled value > 9", () => {
    // For 79927398713, digit 9 at position 10 doubles to 18 → 9
    const e = explainLuhn("79927398713");
    const step9pos10 = e.steps.find((s) => s.digit === 9 && s.positionFromRight === 10);
    expect(step9pos10).toBeDefined();
    expect(step9pos10!.value).toBe(9); // 9*2=18, 18-9=9
    // And digit 8 at position 4 doubles to 16 → 7
    const step8pos4 = e.steps.find((s) => s.digit === 8 && s.positionFromRight === 4);
    expect(step8pos4).toBeDefined();
    expect(step8pos4!.value).toBe(7); // 8*2=16, 16-9=7
  });
  it("returns empty explanation for invalid input", () => {
    const e = explainLuhn("abc");
    expect(e.steps).toEqual([]);
    expect(e.valid).toBe(false);
  });
});

describe("luhn-credit-card-validator correctCheckDigit", () => {
  it("returns the corrected number for Wikipedia example", () => {
    expect(correctCheckDigit("79927398710")).toBe("79927398713");
  });
  it("returns null for empty input", () => {
    expect(correctCheckDigit("")).toBeNull();
  });
  it("preserves the rest of the number", () => {
    const corrected = correctCheckDigit("4242424242424241");
    expect(corrected).toBe("4242424242424242");
  });
});

describe("luhn-credit-card-validator transpositionHint", () => {
  it("finds an adjacent transposition fix that is Luhn-valid", () => {
    // 79927398713 → swap last two → 79927398731 (invalid).
    // Multiple swaps may fix it — we only require the returned value be Luhn-valid.
    const hint = transpositionHint("79927398731");
    expect(hint).not.toBeNull();
    expect(luhnValidate(hint!)).toBe(true);
  });
  it("returns null when no adjacent swap fixes it", () => {
    // 79927398710 has the wrong check digit — no swap will fix it
    expect(transpositionHint("79927398710")).toBeNull();
  });
  it("returns null for input shorter than 3", () => {
    expect(transpositionHint("12")).toBeNull();
  });
  it("does not suggest identical-swap pairs", () => {
    // 11 with check digit 1 — won't be valid; swapping identical digits is skipped
    expect(transpositionHint("111")).toBeNull();
  });
});

describe("luhn-credit-card-validator detectBrand", () => {
  it("detects Visa", () => {
    expect(detectBrand("4242424242424242")).toBe("visa");
  });
  it("detects Mastercard 5-series", () => {
    expect(detectBrand("5555555555554444")).toBe("mastercard");
  });
  it("detects Mastercard 2-series", () => {
    expect(detectBrand("2223003122003222")).toBe("mastercard");
  });
  it("detects Amex", () => {
    expect(detectBrand("378282246310005")).toBe("amex");
  });
  it("detects Discover (622126 beats UnionPay 62)", () => {
    expect(detectBrand("6221260000000000")).toBe("discover");
  });
  it("detects JCB", () => {
    expect(detectBrand("3530111333300000")).toBe("jcb");
  });
  it("detects Diners Club", () => {
    expect(detectBrand("3056930009020004")).toBe("diners");
  });
  it("detects UnionPay", () => {
    expect(detectBrand("6200000000000005")).toBe("unionpay");
  });
  it("detects Maestro", () => {
    expect(detectBrand("6759411100000008")).toBe("maestro");
  });
  it("returns null for unknown prefix", () => {
    expect(detectBrand("9999999999999999")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(detectBrand("")).toBeNull();
  });
});

describe("luhn-credit-card-validator extractBin", () => {
  it("extracts first 6 digits by default", () => {
    expect(extractBin("4242424242424242")).toBe("424242");
  });
  it("respects custom bin length", () => {
    expect(extractBin("4242424242424242", 4)).toBe("4242");
  });
  it("handles shorter-than-bin input", () => {
    expect(extractBin("42")).toBe("42");
  });
});

describe("luhn-credit-card-validator formatCard", () => {
  it("formats plain", () => {
    expect(formatCard("4242424242424242", "plain")).toBe("4242424242424242");
  });
  it("formats spaced", () => {
    expect(formatCard("4242424242424242", "spaced")).toBe("4242 4242 4242 4242");
  });
  it("formats dashed", () => {
    expect(formatCard("4242424242424242", "dashed")).toBe("4242-4242-4242-4242");
  });
  it("formats Amex grouped 4-6-5", () => {
    expect(formatCard("378282246310005", "grouped")).toBe("3782 822463 10005");
  });
  it("formats Visa grouped 4-4-4-4", () => {
    expect(formatCard("4242424242424242", "grouped")).toBe("4242 4242 4242 4242");
  });
  it("preserves extra digits beyond grouping", () => {
    expect(formatCard("4242424242424242424", "grouped")).toBe("4242 4242 4242 4242 424");
  });
});

describe("luhn-credit-card-validator validateSingle", () => {
  it("returns full detail for a valid Visa", () => {
    const r = validateSingle("4242424242424242", "credit");
    expect(r.valid).toBe(true);
    expect(r.brand).toBe("visa");
    expect(r.brandLabel).toBe("Visa");
    expect(r.length).toBe(16);
    expect(r.modeLengthOk).toBe(true);
    expect(r.providedCheck).toBe(2);
    expect(r.expectedCheck).toBe(2);
    expect(r.corrected).toBeNull();
    expect(r.bin).toBe("424242");
    expect(r.masked).toContain("4242");
    expect(r.formatted).toContain("4242 4242 4242 4242");
  });
  it("returns correction + transposition hint for an invalid number", () => {
    const r = validateSingle("4242424242424241", "credit");
    expect(r.valid).toBe(false);
    expect(r.corrected).toBe("4242424242424242");
  });
  it("flags mode-length mismatch", () => {
    // 11-digit number is fine for Luhn but wrong for credit-card mode
    const r = validateSingle("79927398713", "credit");
    expect(r.valid).toBe(true); // Luhn-valid
    expect(r.modeLengthOk).toBe(false); // but wrong length for credit
  });
  it("accepts IMEI-length 15-digit in IMEI mode", () => {
    // Amex card number is 15 digits — works as IMEI
    const r = validateSingle("378282246310005", "imei");
    expect(r.valid).toBe(true);
    expect(r.modeLengthOk).toBe(true);
    expect(r.brand).toBeNull(); // IMEI mode disables brand detection
  });
  it("accepts any length ≥2 in any mode", () => {
    const r = validateSingle("79927398713", "any");
    expect(r.valid).toBe(true);
    expect(r.modeLengthOk).toBe(true);
  });
});

describe("luhn-credit-card-validator batch parsing", () => {
  it("parses newline-separated", () => {
    expect(parseBatchInput("4242424242424242\n5555555555554444"))
      .toEqual(["4242424242424242", "5555555555554444"]);
  });
  it("parses comma-separated", () => {
    expect(parseBatchInput("4242424242424242, 5555555555554444"))
      .toEqual(["4242424242424242", "5555555555554444"]);
  });
  it("skips blank lines", () => {
    expect(parseBatchInput("4242424242424242\n\n\n5555555555554444"))
      .toEqual(["4242424242424242", "5555555555554444"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBatchInput("")).toEqual([]);
  });
});

describe("luhn-credit-card-validator validateBatch", () => {
  it("validates a mix of valid and invalid", () => {
    const rows = validateBatch(
      ["4242424242424242", "5555555555554444", "4242424242424241"],
      "credit",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]!.valid).toBe(true);
    expect(rows[1]!.valid).toBe(true);
    expect(rows[2]!.valid).toBe(false);
    expect(rows[2]!.hint).toContain("mod-10");
  });
  it("flags wrong-length rows in credit mode", () => {
    const rows = validateBatch(["79927398713"], "credit");
    expect(rows[0]!.valid).toBe(false);
    expect(rows[0]!.hint).toContain("Wrong length");
  });
  it("marks empty rows with a hint", () => {
    const rows = validateBatch([""], "credit");
    // Empty string is filtered by parseBatchInput, but if passed directly:
    expect(rows[0]!.hint).toBe("Empty line");
    expect(rows[0]!.valid).toBe(false);
  });
  it("detects brands in batch", () => {
    const rows = validateBatch(
      ["4242424242424242", "378282246310005"],
      "credit",
    );
    expect(rows[0]!.brand).toBe("visa");
    expect(rows[1]!.brand).toBe("amex");
  });
});

describe("luhn-credit-card-validator summarizeBatch", () => {
  it("computes summary stats", () => {
    const rows = validateBatch(
      ["4242424242424242", "5555555555554444", "79927398710"],
      "credit",
    );
    const s = summarizeBatch(rows);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(1);
    expect(s.byBrand["Visa"]).toBe(1);
    expect(s.byBrand["Mastercard"]).toBe(1);
  });
  it("returns zeros for empty input", () => {
    const s = summarizeBatch([]);
    expect(s.total).toBe(0);
    expect(s.valid).toBe(0);
    expect(s.invalid).toBe(0);
  });
});

describe("luhn-credit-card-validator renderBatchCsv", () => {
  it("renders header row", () => {
    const csv = renderBatchCsv([]);
    expect(csv).toContain("index,raw,normalized,valid,brand,length,mode_length_ok,hint");
  });
  it("renders data rows", () => {
    const rows = validateBatch(["4242424242424242"], "credit");
    const csv = renderBatchCsv(rows);
    expect(csv).toContain("0,4242424242424242,4242424242424242,valid,Visa,16,ok,");
  });
  it("escapes commas in raw input", () => {
    const rows = validateBatch(["4242,4242,4242,4242"], "credit");
    const csv = renderBatchCsv(rows);
    // Commas in raw input are escaped with quotes
    expect(csv).toContain('"4242,4242,4242,4242"');
  });
});

describe("luhn-credit-card-validator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      mode: "credit",
      format: "grouped",
      singleCount: 5,
      batchTotal: 10,
      batchValid: 8,
      batchInvalid: 2,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "credit",
        format: "grouped",
        singleCount: 1,
        batchTotal: 1,
        batchValid: 1,
        batchInvalid: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      mode: "credit",
      format: "grouped",
      singleCount: 1,
      batchTotal: 1,
      batchValid: 1,
      batchInvalid: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("luhn-credit-card-validator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("imei", "dashed");
    expect(url).toContain("mode=imei");
    expect(url).toContain("fmt=dashed");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=imei&fmt=dashed");
    expect(p.mode).toBe("imei");
    expect(p.format).toBe("dashed");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ mode: "credit", format: "grouped" });
  });
  it("filters unknown modes", () => {
    const p = parseShareUrl("mode=unknown&fmt=plain");
    expect(p.mode).toBe("credit");
    expect(p.format).toBe("plain");
  });
});

// Suppress unused-import lint
export type _Unused = CardBrand | InputMode | CardFormat;
