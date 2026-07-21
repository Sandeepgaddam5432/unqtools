import { describe, it, expect, beforeEach } from "vitest";
import {
  STANDARD_MAX,
  VINCULUM_MAX,
  COMBINING_OVERLINE,
  CONVERSION_MODES,
  VALIDATION_MODES,
  ROMAN_VALUES,
  ROMAN_SYMBOLS,
  ROMAN_PRESETS,
  HISTORY_FACTS,
  normalizeRoman,
  hasVinculum,
  stripOverline,
  applyOverline,
  tokenizeRoman,
  validateRoman,
  arabicToStandardRoman,
  arabicToRoman,
  yearToRoman,
  computeTokenValue,
  romanToArabic,
  decomposeArabic,
  decomposeRoman,
  parseBatch,
  renderBatchText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  isInRange,
  type ConversionMode,
  type ValidationMode,
  type RomanToken,
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

describe("roman constants", () => {
  it("defines STANDARD_MAX = 3999", () => {
    expect(STANDARD_MAX).toBe(3999);
  });
  it("defines VINCULUM_MAX = 3,999,999", () => {
    expect(VINCULUM_MAX).toBe(3999999);
  });
  it("exposes conversion & validation modes", () => {
    expect(CONVERSION_MODES).toEqual(["standard", "vinculum"]);
    expect(VALIDATION_MODES).toEqual(["strict", "lenient"]);
  });
  it("has 7 base Roman symbols", () => {
    expect(Object.keys(ROMAN_VALUES)).toHaveLength(7);
    expect(ROMAN_VALUES.M).toBe(1000);
  });
  it("has 13 greedy decomposition symbols (incl. subtractives)", () => {
    expect(ROMAN_SYMBOLS).toHaveLength(13);
  });
  it("has at least 10 presets", () => {
    expect(ROMAN_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("has at least 8 history facts", () => {
    expect(HISTORY_FACTS.length).toBeGreaterThanOrEqual(8);
  });
});

describe("roman normalize & overline helpers", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeRoman("  mcm xc ")).toBe("MCMXC");
  });
  it("detects vinculum (combining overline)", () => {
    expect(hasVinculum(`V${COMBINING_OVERLINE}`)).toBe(true);
    expect(hasVinculum("V")).toBe(false);
  });
  it("strips overlines", () => {
    expect(stripOverline(`V${COMBINING_OVERLINE}I${COMBINING_OVERLINE}`)).toBe("VI");
  });
  it("applies overline to every char", () => {
    expect(applyOverline("IV")).toBe(`I${COMBINING_OVERLINE}V${COMBINING_OVERLINE}`);
  });
});

describe("roman tokenizeRoman", () => {
  it("tokenizes a plain Roman string", () => {
    const r = tokenizeRoman("MCMXCIV");
    expect(r.ok).toBe(true);
    expect(r.tokens).toHaveLength(7);
    expect(r.tokens![0]).toEqual({ ch: "M", over: false, value: 1000 });
  });
  it("tokenizes vinculum (overlined) chars", () => {
    const r = tokenizeRoman(`V${COMBINING_OVERLINE}`);
    expect(r.ok).toBe(true);
    expect(r.tokens).toHaveLength(1);
    expect(r.tokens![0]).toEqual({ ch: "V", over: true, value: 5000 });
  });
  it("rejects invalid characters", () => {
    const r = tokenizeRoman("ABC");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Invalid Roman character");
  });
  it("rejects stray overlines", () => {
    const r = tokenizeRoman(COMBINING_OVERLINE);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Stray combining overline");
  });
});

describe("roman arabicToStandardRoman", () => {
  it("converts 1 → I", () => {
    expect(arabicToStandardRoman(1)).toBe("I");
  });
  it("converts 4 → IV (not IIII)", () => {
    expect(arabicToStandardRoman(4)).toBe("IV");
  });
  it("converts 9 → IX", () => {
    expect(arabicToStandardRoman(9)).toBe("IX");
  });
  it("converts 49 → XLIX", () => {
    expect(arabicToStandardRoman(49)).toBe("XLIX");
  });
  it("converts 1994 → MCMXCIV", () => {
    expect(arabicToStandardRoman(1994)).toBe("MCMXCIV");
  });
  it("converts 3999 → MMMCMXCIX", () => {
    expect(arabicToStandardRoman(3999)).toBe("MMMCMXCIX");
  });
});

describe("roman arabicToRoman (mode-aware)", () => {
  it("standard mode rejects 4000+", () => {
    const r = arabicToRoman(4000, "standard");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exceeds");
  });
  it("standard mode converts 3999", () => {
    const r = arabicToRoman(3999, "standard");
    expect(r.ok).toBe(true);
    expect(r.roman).toBe("MMMCMXCIX");
  });
  it("vinculum mode converts 4000 → I̅V̅", () => {
    const r = arabicToRoman(4000, "vinculum");
    expect(r.ok).toBe(true);
    expect(r.roman).toBe(`I${COMBINING_OVERLINE}V${COMBINING_OVERLINE}`);
  });
  it("vinculum mode converts 5000 → V̅", () => {
    const r = arabicToRoman(5000, "vinculum");
    expect(r.ok).toBe(true);
    expect(r.roman).toBe(`V${COMBINING_OVERLINE}`);
  });
  it("vinculum mode converts 3,999,999 (max)", () => {
    const r = arabicToRoman(3999999, "vinculum");
    expect(r.ok).toBe(true);
    expect(r.roman).toBeTruthy();
    expect(r.roman!.length).toBeGreaterThan(0);
  });
  it("vinculum mode rejects > max", () => {
    const r = arabicToRoman(4000000, "vinculum");
    expect(r.ok).toBe(false);
  });
  it("rejects zero and negative", () => {
    expect(arabicToRoman(0, "standard").ok).toBe(false);
    expect(arabicToRoman(-5, "standard").ok).toBe(false);
  });
  it("rejects non-integer", () => {
    expect(arabicToRoman(1.5, "standard").ok).toBe(false);
  });
  it("yearToRoman uses vinculum mode", () => {
    const r = yearToRoman(5000);
    expect(r.ok).toBe(true);
    expect(r.roman).toBe(`V${COMBINING_OVERLINE}`);
  });
});

describe("roman validateRoman", () => {
  it("strict accepts MCMXCIV", () => {
    expect(validateRoman("MCMXCIV", "strict").valid).toBe(true);
  });
  it("strict rejects IIII (clock style)", () => {
    expect(validateRoman("IIII", "strict").valid).toBe(false);
  });
  it("strict rejects IC (invalid subtractive)", () => {
    expect(validateRoman("IC", "strict").valid).toBe(false);
  });
  it("strict rejects VV (no repeat of V)", () => {
    expect(validateRoman("VV", "strict").valid).toBe(false);
  });
  it("strict accepts vinculum I̅V̅", () => {
    expect(validateRoman(`I${COMBINING_OVERLINE}V${COMBINING_OVERLINE}`, "strict").valid).toBe(true);
  });
  it("strict rejects overlined-after-plain", () => {
    const r = validateRoman(`M V${COMBINING_OVERLINE}`, "strict");
    expect(r.valid).toBe(false);
  });
  it("lenient accepts IIII", () => {
    expect(validateRoman("IIII", "lenient").valid).toBe(true);
  });
  it("lenient accepts VV", () => {
    expect(validateRoman("VV", "lenient").valid).toBe(true);
  });
  it("lenient rejects invalid characters", () => {
    expect(validateRoman("ABC", "lenient").valid).toBe(false);
  });
  it("rejects empty input", () => {
    expect(validateRoman("", "strict").valid).toBe(false);
  });
});

describe("roman romanToArabic", () => {
  it("converts I → 1", () => {
    expect(romanToArabic("I", "strict").value).toBe(1);
  });
  it("converts IV → 4", () => {
    expect(romanToArabic("IV", "strict").value).toBe(4);
  });
  it("converts MCMXCIV → 1994", () => {
    expect(romanToArabic("MCMXCIV", "strict").value).toBe(1994);
  });
  it("converts MMMCMXCIX → 3999", () => {
    expect(romanToArabic("MMMCMXCIX", "strict").value).toBe(3999);
  });
  it("converts vinculum V̅ → 5000", () => {
    expect(romanToArabic(`V${COMBINING_OVERLINE}`, "strict").value).toBe(5000);
  });
  it("converts vinculum I̅V̅ → 4000", () => {
    expect(romanToArabic(`I${COMBINING_OVERLINE}V${COMBINING_OVERLINE}`, "strict").value).toBe(4000);
  });
  it("strict rejects IIII", () => {
    expect(romanToArabic("IIII", "strict").ok).toBe(false);
  });
  it("lenient accepts IIII → 4", () => {
    expect(romanToArabic("IIII", "lenient").value).toBe(4);
  });
  it("lenient accepts IC → 99 (lenient subtractive)", () => {
    expect(romanToArabic("IC", "lenient").value).toBe(99);
  });
  it("round-trips arabic→roman→arabic for 1994", () => {
    const r = arabicToRoman(1994, "standard");
    expect(r.ok).toBe(true);
    expect(romanToArabic(r.roman!, "strict").value).toBe(1994);
  });
  it("round-trips for 5000 (vinculum)", () => {
    const r = arabicToRoman(5000, "vinculum");
    expect(r.ok).toBe(true);
    expect(romanToArabic(r.roman!, "strict").value).toBe(5000);
  });
  it("reports usedVinculum flag", () => {
    expect(romanToArabic(`V${COMBINING_OVERLINE}`, "strict").usedVinculum).toBe(true);
    expect(romanToArabic("V", "strict").usedVinculum).toBe(false);
  });
});

describe("roman computeTokenValue", () => {
  it("adds simple tokens", () => {
    const tokens: RomanToken[] = [
      { ch: "M", over: false, value: 1000 },
      { ch: "C", over: false, value: 100 },
      { ch: "M", over: false, value: 1000 },
    ];
    expect(computeTokenValue(tokens)).toBe(1900); // M + (M - C)
  });
});

describe("roman decomposeArabic & decomposeRoman", () => {
  it("decomposes 1994 into steps", () => {
    const r = decomposeArabic(1994, "standard");
    expect(r.ok).toBe(true);
    expect(r.total).toBe(1994);
    expect(r.steps!.length).toBeGreaterThan(0);
  });
  it("decomposition text ends with total", () => {
    const r = decomposeArabic(1994, "standard");
    expect(r.text).toContain("= 1994");
  });
  it("decomposeRoman handles subtractive pairs", () => {
    const r = decomposeRoman("IV");
    expect(r.ok).toBe(true);
    expect(r.total).toBe(4);
    expect(r.steps![0].formula).toBe("5 - 1");
  });
  it("decomposeRoman handles vinculum", () => {
    const r = decomposeRoman(`V${COMBINING_OVERLINE}`);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(5000);
  });
  it("decomposeRoman errors on invalid input", () => {
    const r = decomposeRoman("ABC");
    expect(r.ok).toBe(false);
  });
});

describe("roman parseBatch & renderBatchText", () => {
  it("auto-detects Arabic and Roman directions", () => {
    const r = parseBatch("1994\nMMXXIV\n4000");
    expect(r.entries).toHaveLength(3);
    expect(r.entries[0].ok).toBe(true);
    expect(r.entries[0].output).toBe("MCMXCIV");
    expect(r.entries[1].ok).toBe(true);
    expect(r.entries[1].output).toBe("2024");
    expect(r.entries[2].output).toContain(COMBINING_OVERLINE); // 4000 needs vinculum
  });
  it("handles commas and semicolons", () => {
    const r = parseBatch("4, 9; 40");
    expect(r.entries).toHaveLength(3);
  });
  it("skips empty lines", () => {
    const r = parseBatch("\n4\n\n9\n");
    expect(r.entries).toHaveLength(2);
  });
  it("records errors for invalid Roman", () => {
    const r = parseBatch("ABC");
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].ok).toBe(false);
  });
  it("renderBatchText produces lines", () => {
    const r = parseBatch("4\n9");
    const txt = renderBatchText(r);
    expect(txt).toContain("IV");
    expect(txt).toContain("IX");
  });
});

describe("roman isInRange", () => {
  it("true within standard range", () => {
    expect(isInRange(100, "standard")).toBe(true);
  });
  it("false beyond standard max", () => {
    expect(isInRange(4000, "standard")).toBe(false);
  });
  it("true within vinculum range", () => {
    expect(isInRange(4000, "vinculum")).toBe(true);
  });
  it("false for zero/negative", () => {
    expect(isInRange(0, "standard")).toBe(false);
    expect(isInRange(-5, "standard")).toBe(false);
  });
});

describe("roman history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, direction: "to-roman", input: "1994", output: "MCMXCIV", vinculum: false });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, direction: "to-roman", input: String(i), output: "X", vinculum: false });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, direction: "to-roman", input: "1", output: "I", vinculum: false });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("roman shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("to-roman", "1994");
    expect(url).toContain("d=to-roman");
    expect(url).toContain("v=1994");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=to-arabic&v=MCMXCIV");
    expect(p.direction).toBe("to-arabic");
    expect(p.input).toBe("MCMXCIV");
  });
  it("uses defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.direction).toBe("to-roman");
    expect(p.input).toBe("");
  });
  it("falls back to to-roman for unknown direction", () => {
    const p = parseShareUrl("d=bogus&v=1");
    expect(p.direction).toBe("to-roman");
  });
});

// Suppress unused-import lint
export type _Unused = ConversionMode | ValidationMode | RomanToken;
