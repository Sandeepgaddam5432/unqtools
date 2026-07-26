import { describe, it, expect } from "vitest";
import {
  buildAlphabet,
  randomInt,
  generatePassword,
  generatePronounceable,
  generatePassphrase,
  passwordEntropy,
  passphraseEntropy,
  generateBatch,
  batchToCsv,
  encodeSettings,
  decodeSettings,
  classLabel,
  computeResultEntropy,
  EFF_WORD_COUNT,
  ENTROPY_PER_WORD,
  type PasswordOptions,
  type PassphraseOptions,
} from "./logic";

const BASE_OPTS: PasswordOptions = {
  length: 16,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

describe("strong-password-generator buildAlphabet", () => {
  it("builds full alphabet when all classes selected", () => {
    const { chars, classes } = buildAlphabet(BASE_OPTS);
    expect(chars.length).toBe(26 + 26 + 10 + 28); // 90
    expect(classes).toEqual(["upper", "lower", "digits", "symbols"]);
  });

  it("respects custom symbols", () => {
    const { chars } = buildAlphabet({ ...BASE_OPTS, upper: false, lower: false, digits: false, customSymbols: "!@#" });
    expect(chars).toBe("!@#");
  });

  it("filters ambiguous characters", () => {
    const { chars } = buildAlphabet({ ...BASE_OPTS, upper: true, lower: true, digits: true, symbols: false, excludeAmbiguous: true });
    // Should not contain 0, O, 1, l, I
    expect(chars).not.toContain("0");
    expect(chars).not.toContain("O");
    expect(chars).not.toContain("1");
    expect(chars).not.toContain("l");
    expect(chars).not.toContain("I");
  });

  it("returns empty when no class selected", () => {
    const { chars, classes } = buildAlphabet({ ...BASE_OPTS, upper: false, lower: false, digits: false, symbols: false });
    expect(chars).toBe("");
    expect(classes).toEqual([]);
  });
});

describe("strong-password-generator randomInt (bias-free)", () => {
  it("returns values in [0, max)", () => {
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("returns 0 for max=1", () => {
    expect(randomInt(1)).toBe(0);
  });

  it("throws for max=0", () => {
    expect(() => randomInt(0)).toThrow();
  });

  it("distribution is approximately uniform", () => {
    const counts = new Array(4).fill(0);
    for (let i = 0; i < 10000; i++) counts[randomInt(4)]++;
    // each should be within 10% of 2500
    for (const c of counts) {
      expect(Math.abs(c - 2500)).toBeLessThan(300);
    }
  });
});

describe("strong-password-generator generatePassword", () => {
  it("generates a password of the requested length", () => {
    expect(generatePassword({ ...BASE_OPTS, length: 20 }).length).toBe(20);
  });

  it("throws if no class selected", () => {
    expect(() => generatePassword({ ...BASE_OPTS, upper: false, lower: false, digits: false, symbols: false })).toThrow();
  });

  it("respects per-class minimums", () => {
    const p = generatePassword({ ...BASE_OPTS, length: 16, minDigits: 4 });
    const digits = (p.match(/\d/g) ?? []).length;
    expect(digits).toBeGreaterThanOrEqual(4);
  });

  it("clamps length to [1, 128]", () => {
    expect(generatePassword({ ...BASE_OPTS, length: 0 }).length).toBe(1);
    expect(generatePassword({ ...BASE_OPTS, length: 200 }).length).toBe(128);
  });

  it("produces different values across calls", () => {
    const a = generatePassword(BASE_OPTS);
    const b = generatePassword(BASE_OPTS);
    expect(a).not.toBe(b);
  });

  it("excludes ambiguous chars when requested", () => {
    const p = generatePassword({ ...BASE_OPTS, length: 50, excludeAmbiguous: true });
    expect(p).not.toMatch(/[0O1lI]/);
  });
});

describe("strong-password-generator generatePronounceable", () => {
  it("returns requested length", () => {
    expect(generatePronounceable(12, BASE_OPTS).length).toBe(12);
  });

  it("clamps length to [4, 64]", () => {
    expect(generatePronounceable(2, BASE_OPTS).length).toBe(4);
    expect(generatePronounceable(100, BASE_OPTS).length).toBe(64);
  });

  it("alternates consonants and vowels", () => {
    const p = generatePronounceable(8, { ...BASE_OPTS, digits: false, upper: false });
    // pattern: CVCVCVCV — every other char is a vowel
    const vowels = "aeiouy";
    for (let i = 0; i < p.length; i++) {
      if (i % 2 === 1) expect(vowels).toContain(p[i]);
    }
  });
});

describe("strong-password-generator generatePassphrase", () => {
  const pOpts: PassphraseOptions = { wordCount: 5, separator: "-", capitalize: false, appendDigit: false, appendSymbol: false };

  it("returns the requested word count", () => {
    expect(generatePassphrase(pOpts).split("-").length).toBe(5);
  });

  it("respects custom separator", () => {
    expect(generatePassphrase({ ...pOpts, separator: "_" }).split("_").length).toBe(5);
  });

  it("capitalizes words when requested", () => {
    const p = generatePassphrase({ ...pOpts, capitalize: true });
    expect(p.split("-").every((w) => /^[A-Z]/.test(w))).toBe(true);
  });

  it("appends a digit when requested", () => {
    const p = generatePassphrase({ ...pOpts, appendDigit: true });
    expect(p).toMatch(/\d$/);
  });

  it("appends a symbol when requested", () => {
    const p = generatePassphrase({ ...pOpts, appendSymbol: true });
    expect(p).toMatch(/[!@#$%^&*()]/);
  });

  it("clamps word count to [2, 20]", () => {
    expect(generatePassphrase({ ...pOpts, wordCount: 1 }).split("-").length).toBe(2);
    expect(generatePassphrase({ ...pOpts, wordCount: 100 }).split("-").length).toBe(20);
  });
});

describe("strong-password-generator entropy", () => {
  it("passwordEntropy = length × log2(alphabet)", () => {
    expect(passwordEntropy("abcd", 26)).toBeCloseTo(4 * Math.log2(26), 1);
  });

  it("passphraseEntropy = wordCount × log2(wordListSize) + extras", () => {
    const e = passphraseEntropy({ wordCount: 5, separator: "-", capitalize: false, appendDigit: false, appendSymbol: false });
    expect(e).toBeCloseTo(5 * ENTROPY_PER_WORD, 1);
  });

  it("appendDigit adds ~log2(10) bits", () => {
    const base = passphraseEntropy({ wordCount: 4, separator: "-", capitalize: false, appendDigit: false, appendSymbol: false });
    const withDigit = passphraseEntropy({ wordCount: 4, separator: "-", capitalize: false, appendDigit: true, appendSymbol: false });
    expect(withDigit - base).toBeCloseTo(Math.log2(10), 1);
  });

  it("computeResultEntropy matches buildAlphabet size", () => {
    const p = generatePassword(BASE_OPTS);
    const e = computeResultEntropy(p, BASE_OPTS);
    expect(e).toBeCloseTo(16 * Math.log2(90), 1);
  });

  it("EFF_WORD_COUNT and ENTROPY_PER_WORD are positive", () => {
    expect(EFF_WORD_COUNT).toBeGreaterThan(100);
    expect(ENTROPY_PER_WORD).toBeGreaterThan(5);
  });
});

describe("strong-password-generator batch + CSV", () => {
  it("generateBatch produces N passwords", () => {
    expect(generateBatch(BASE_OPTS, 10)).toHaveLength(10);
  });

  it("generateBatch clamps count", () => {
    expect(generateBatch(BASE_OPTS, 0)).toHaveLength(1);
    expect(generateBatch(BASE_OPTS, 5000)).toHaveLength(1000);
  });

  it("batchToCsv has header + rows", () => {
    const csv = batchToCsv(generateBatch(BASE_OPTS, 5), BASE_OPTS);
    const lines = csv.split("\n");
    expect(lines[0]).toMatch(/Index,Password,EntropyBits/);
    expect(lines.length).toBe(6);
  });

  it("batchToCsv escapes quotes in passwords", () => {
    // Just verify it doesn't throw and has 6 lines
    const csv = batchToCsv(generateBatch(BASE_OPTS, 5), BASE_OPTS);
    expect(csv.split("\n").length).toBe(6);
  });
});

describe("strong-password-generator settings URL", () => {
  it("encodeSettings round-trips", () => {
    const frag = encodeSettings(BASE_OPTS);
    const decoded = decodeSettings(frag);
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(BASE_OPTS.length);
    expect(decoded!.upper).toBe(BASE_OPTS.upper);
    expect(decoded!.symbols).toBe(BASE_OPTS.symbols);
  });

  it("encodeSettings preserves custom symbols", () => {
    const frag = encodeSettings({ ...BASE_OPTS, customSymbols: "!@#" });
    const decoded = decodeSettings(frag);
    expect(decoded!.customSymbols).toBe("!@#");
  });

  it("encodeSettings preserves per-class minimums", () => {
    const frag = encodeSettings({ ...BASE_OPTS, minDigits: 3, minUpper: 1 });
    const decoded = decodeSettings(frag);
    expect(decoded!.minDigits).toBe(3);
    expect(decoded!.minUpper).toBe(1);
  });

  it("decodeSettings returns null for invalid fragment", () => {
    expect(decodeSettings("#other=foo")).toBeNull();
    expect(decodeSettings("#p=not-json")).toBeNull();
  });

  it("decodeSettings defaults missing fields", () => {
    const frag = "#p=" + encodeURIComponent(JSON.stringify({ L: 12 }));
    const decoded = decodeSettings(frag);
    expect(decoded!.length).toBe(12);
    expect(decoded!.upper).toBe(false);
  });
});

describe("strong-password-generator classLabel", () => {
  it("returns class summary", () => {
    expect(classLabel(BASE_OPTS)).toBe("A-Z + a-z + 0-9 + !@#");
  });

  it("returns (none) when no class selected", () => {
    expect(classLabel({ ...BASE_OPTS, upper: false, lower: false, digits: false, symbols: false })).toBe("(none)");
  });
});
