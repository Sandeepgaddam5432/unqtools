import { describe, it, expect } from "vitest";
import {
  vigenere,
  encrypt,
  decrypt,
  normalizeKeyword,
  validateKeyword,
} from "./logic";

describe("normalizeKeyword", () => {
  it("uppercases and strips non-letters", () => {
    expect(normalizeKeyword("Key 123!")).toBe("KEY");
  });

  it("returns empty for no letters", () => {
    expect(normalizeKeyword("12345")).toBe("");
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

describe("validateKeyword", () => {
  it("accepts valid keyword", () => {
    expect(validateKeyword("Pass")).toBe("PASS");
  });

  it("rejects empty keyword", () => {
    expect("error" in validateKeyword("")).toBe(true);
  });

  it("rejects keyword with no letters", () => {
    expect("error" in validateKeyword("---")).toBe(true);
  });
});
