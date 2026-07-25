import { describe, it, expect } from "vitest";
import {
  buildAlphabet,
  validateOptions,
  generatePassword,
  generateMany,
  estimateEntropy,
  classifyStrength,
  defaultOptions,
  WPA2_MIN_LENGTH,
  WPA3_MIN_LENGTH,
  type RandomSource,
} from "./logic";

function deterministicSource(seed: number): RandomSource {
  let s = seed >>> 0;
  return (max: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % max;
  };
}

describe("wifi-password-gen buildAlphabet", () => {
  it("combines selected charsets", () => {
    const a = buildAlphabet({ length: 10, charsets: ["lowercase", "numbers"], excludeAmbiguous: false });
    expect(a).toMatch(/^[a-z0-9]+$/);
  });

  it("excludes ambiguous characters when requested", () => {
    const a = buildAlphabet({ length: 10, charsets: ["lowercase", "uppercase", "numbers"], excludeAmbiguous: true });
    expect(a).not.toContain("l");
    expect(a).not.toContain("1");
    expect(a).not.toContain("O");
    expect(a).not.toContain("0");
  });

  it("returns empty when no charsets selected", () => {
    expect(buildAlphabet({ length: 10, charsets: [], excludeAmbiguous: false })).toBe("");
  });
});

describe("wifi-password-gen validateOptions", () => {
  it("rejects short length for WPA2", () => {
    expect(validateOptions({ length: 4, charsets: ["lowercase"], excludeAmbiguous: false }, "wpa2")).not.toBeNull();
  });

  it("rejects short length for WPA3 (min 12)", () => {
    expect(validateOptions({ length: 8, charsets: ["lowercase"], excludeAmbiguous: false }, "wpa3")).not.toBeNull();
  });

  it("accepts valid options", () => {
    expect(validateOptions(defaultOptions(), "wpa2")).toBeNull();
  });

  it("rejects empty charsets", () => {
    expect(validateOptions({ length: 16, charsets: [], excludeAmbiguous: false }, "wpa2")).not.toBeNull();
  });

  it("WPA3 min length is 12", () => {
    expect(WPA3_MIN_LENGTH).toBe(12);
    expect(WPA2_MIN_LENGTH).toBe(8);
  });
});

describe("wifi-password-gen generatePassword", () => {
  it("returns a string of the requested length", () => {
    const pwd = generatePassword(defaultOptions(), deterministicSource(42));
    expect(pwd.length).toBe(16);
  });

  it("only contains characters from the alphabet", () => {
    const opts = { length: 32, charsets: ["numbers"] as const, excludeAmbiguous: false };
    const pwd = generatePassword(opts, deterministicSource(7));
    expect(pwd).toMatch(/^[0-9]+$/);
  });

  it("is deterministic with the same seed", () => {
    const a = generatePassword(defaultOptions(), deterministicSource(100));
    const b = generatePassword(defaultOptions(), deterministicSource(100));
    expect(a).toBe(b);
  });
});

describe("wifi-password-gen generateMany", () => {
  it("returns the requested count", () => {
    const list = generateMany(defaultOptions(), 5, deterministicSource(1));
    expect(list.length).toBe(5);
  });

  it("each entry has the correct length", () => {
    const list = generateMany(defaultOptions(), 3, deterministicSource(2));
    for (const p of list) expect(p.length).toBe(16);
  });
});

describe("wifi-password-gen entropy / strength", () => {
  it("estimates entropy > 0", () => {
    expect(estimateEntropy(defaultOptions())).toBeGreaterThan(0);
  });

  it("entropy grows with length", () => {
    const e1 = estimateEntropy({ length: 8, charsets: ["lowercase"], excludeAmbiguous: false });
    const e2 = estimateEntropy({ length: 32, charsets: ["lowercase"], excludeAmbiguous: false });
    expect(e2).toBeGreaterThan(e1);
  });

  it("classifies strength buckets", () => {
    expect(classifyStrength(20)).toBe("weak");
    expect(classifyStrength(60)).toBe("fair");
    expect(classifyStrength(100)).toBe("strong");
    expect(classifyStrength(150)).toBe("very-strong");
  });
});
