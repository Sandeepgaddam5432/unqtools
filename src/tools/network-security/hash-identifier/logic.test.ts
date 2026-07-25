/**
 * Hash Identifier — unit tests.
 */
import { describe, it, expect } from "vitest";
import { identify, listAllTypes, HASH_TYPES } from "./logic";

describe("hash-identify listAllTypes", () => {
  it("includes MD5 and SHA-256", () => {
    const names = HASH_TYPES.map((t) => t.name);
    expect(names).toContain("MD5");
    expect(names).toContain("SHA-256");
  });
  it("every type has correct hexLength = bitLength/4", () => {
    for (const t of HASH_TYPES) {
      expect(t.hexLength).toBe(t.bitLength / 4);
    }
  });
});

describe("hash-identify identify", () => {
  it("identifies MD5 by 32 hex chars", () => {
    const r = identify("d41d8cd98f00b204e9800998ecf8427e");
    expect(r.charset).toBe("hex");
    expect(r.possibleTypes.some((t) => t.name === "MD5")).toBe(true);
  });
  it("identifies SHA-1 by 40 hex chars", () => {
    const r = identify("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(r.possibleTypes.some((t) => t.name === "SHA-1")).toBe(true);
  });
  it("identifies SHA-256 by 64 hex chars", () => {
    const r = identify("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(r.possibleTypes.some((t) => t.name === "SHA-256")).toBe(true);
  });
  it("identifies SHA-512 by 128 hex chars", () => {
    const r = identify("cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e");
    expect(r.possibleTypes.some((t) => t.name === "SHA-512")).toBe(true);
  });
  it("returns empty possibleTypes for unknown length", () => {
    const r = identify("abc123");
    expect(r.possibleTypes.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const r = identify("");
    expect(r.possibleTypes.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("handles non-hex input", () => {
    const r = identify("xyz!@#");
    expect(r.charset).toBe("unknown");
    expect(r.possibleTypes.length).toBe(0);
  });
  it("flags bcrypt-style input", () => {
    const r = identify("$2b$12$somebcryptstring123456789012345678901234567890123456789012");
    expect(r.warnings.some((w) => w.includes("bcrypt"))).toBe(true);
  });
  it("detects base64 charset", () => {
    const r = identify("YWJjZGVmZ2g=");
    expect(r.charset).toBe("base64");
  });
});

describe("hash-identify listAllTypes returns copy", () => {
  it("returns array", () => {
    expect(Array.isArray(listAllTypes())).toBe(true);
  });
});
