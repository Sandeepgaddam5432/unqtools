import { describe, it, expect } from "vitest";
import {
  vigenere,
  encrypt,
  decrypt,
  vigenereWithOptions,
  normalizeKeyword,
  buildKeyStream,
  validateKeyword,
  validateOptions,
  isIdentity,
  batchValidate,
  textStats,
  suggestKeyLengths,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  type VigenereOptions,
} from "./logic";

const OPTS: VigenereOptions = DEFAULT_OPTIONS;

describe("normalizeKeyword", () => {
  it("uppercases and strips non-letters", () => {
    expect(normalizeKeyword("Key 123!")).toBe("KEY");
  });
  it("returns empty for no letters", () => {
    expect(normalizeKeyword("12345")).toBe("");
  });
});

describe("buildKeyStream", () => {
  it("returns keyword shifts in repeat mode", () => {
    expect(buildKeyStream("LEMON", "", "encrypt", false)).toEqual([11, 4, 12, 14, 13]);
  });
  it("autokey mode appends plaintext shifts", () => {
    const s = buildKeyStream("KEY", "ABC", "encrypt", true);
    expect(s).toEqual([10, 4, 24, 0, 1, 2]);
  });
});

describe("vigenere — encrypt", () => {
  it("encrypts ATTACKATDAWN with LEMON", () => {
    expect(encrypt("ATTACKATDAWN", "LEMON")).toBe("LXFOPVEFRNHR");
  });
  it("preserves case", () => {
    expect(encrypt("attackatdawn", "lemon")).toBe("lxfopvefrnhr");
  });
  it("passes non-letters through without consuming key", () => {
    expect(encrypt("A!A", "B")).toBe("B!B");
  });
  it("returns text unchanged for empty keyword", () => {
    expect(encrypt("Hello", "")).toBe("Hello");
  });
});

describe("vigenere — decrypt", () => {
  it("decrypts LXFOPVEFRNHR back to ATTACKATDAWN", () => {
    expect(decrypt("LXFOPVEFRNHR", "LEMON")).toBe("ATTACKATDAWN");
  });
  it("encrypt + decrypt round-trips", () => {
    const text = "The Quick Brown Fox!";
    const key = "Secret";
    expect(decrypt(encrypt(text, key), key)).toBe(text);
  });
});

describe("vigenereWithOptions + autokey", () => {
  it("strips non-letters when preserveNonLetters=false", () => {
    const out = vigenereWithOptions("A!A", { ...OPTS, keyword: "B", preserveNonLetters: false });
    expect(out).toBe("BB");
  });
  it("autokey mode encrypt + decrypt round-trips", () => {
    const o: VigenereOptions = { keyword: "KEY", mode: "encrypt", autokey: true, preserveNonLetters: true };
    const enc = vigenereWithOptions("HELLO", o);
    const dec = vigenereWithOptions(enc, { ...o, mode: "decrypt" });
    expect(dec).toBe("HELLO");
  });
});

describe("validateKeyword + validateOptions", () => {
  it("accepts valid keyword", () => {
    expect(validateKeyword("Pass")).toBe("PASS");
  });
  it("rejects empty keyword", () => {
    expect("error" in validateKeyword("")).toBe(true);
  });
  it("rejects keyword with no letters", () => {
    expect("error" in validateKeyword("---")).toBe(true);
  });
  it("validateOptions accepts valid", () => {
    expect("error" in validateOptions(OPTS)).toBe(false);
  });
  it("validateOptions rejects bad mode", () => {
    expect("error" in validateOptions({ ...OPTS, mode: "bad" as never })).toBe(true);
  });
});

describe("helpers + presets", () => {
  it("isIdentity always false", () => {
    expect(isIdentity(OPTS)).toBe(false);
  });
  it("batchValidate validates each input", () => {
    const r = batchValidate([{ name: "a" }], OPTS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("textStats counts letters", () => {
    const s = textStats("Hi! 12");
    expect(s.letters).toBe(2);
    expect(s.total).toBe(6);
    expect(s.nonLetters).toBe(4);
  });
  it("suggestKeyLengths returns array of 3", () => {
    const r = suggestKeyLengths("LXFOPVEFRNHR");
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeGreaterThan(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("lemon")?.options.keyword).toBe("LEMON");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});
