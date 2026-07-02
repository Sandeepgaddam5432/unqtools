import { describe, it, expect } from "vitest";
import { encrypt, decrypt, rot13, bruteForce, bestGuess } from "./logic";

describe("caesar — encrypt/decrypt", () => {
  it("encrypts with shift 3", () => {
    expect(encrypt("Hello", 3)).toBe("Khoor");
  });
  it("decrypts with shift 3", () => {
    expect(decrypt("Khoor", 3)).toBe("Hello");
  });
  it("preserves case", () => {
    expect(encrypt("AbCd", 1)).toBe("BcDe");
  });
  it("preserves non-letters", () => {
    expect(encrypt("Hello, World! 123", 3)).toBe("Khoor, Zruog! 123");
  });
  it("wraps around the alphabet", () => {
    expect(encrypt("xyz", 3)).toBe("abc");
    expect(encrypt("XYZ", 3)).toBe("ABC");
  });
  it("handles shift 0 (no change)", () => {
    expect(encrypt("Hello", 0)).toBe("Hello");
  });
  it("handles negative shifts", () => {
    expect(encrypt("Hello", -3)).toBe("Ebiil");
  });
  it("round-trips encrypt then decrypt", () => {
    const text = "The quick brown fox";
    const shift = 7;
    expect(decrypt(encrypt(text, shift), shift)).toBe(text);
  });
});

describe("caesar — rot13", () => {
  it("applies ROT13", () => {
    expect(rot13("Hello")).toBe("Uryyb");
  });
  it("ROT13 is its own inverse", () => {
    expect(rot13(rot13("Hello World"))).toBe("Hello World");
  });
});

describe("caesar — bruteForce", () => {
  it("returns 25 candidate shifts", () => {
    const results = bruteForce("Khoor");
    expect(results.length).toBe(25);
  });
  it("sorts by chi-squared (best guess first)", () => {
    const results = bruteForce("Khoor");
    expect(results[0]!.chiSquared).toBeLessThanOrEqual(results[1]!.chiSquared);
  });
  it("finds the correct shift for English text", () => {
    const encrypted = encrypt("The quick brown fox jumps over the lazy dog", 7);
    const best = bestGuess(encrypted);
    expect(best).not.toBeNull();
    expect(best!.shift).toBe(7);
    expect(best!.plaintext).toBe("The quick brown fox jumps over the lazy dog");
  });
});

describe("caesar — edge cases", () => {
  it("handles empty input", () => {
    expect(encrypt("", 3)).toBe("");
    expect(bruteForce("").length).toBe(25);
  });
  it("handles huge input (100K chars)", () => {
    const input = "a".repeat(100000);
    const result = encrypt(input, 5);
    expect(result.length).toBe(100000);
  });
  it("handles Unicode (preserves non-ASCII)", () => {
    expect(encrypt("Hello 🎉 你好", 3)).toBe("Khoor 🎉 你好");
  });
});
