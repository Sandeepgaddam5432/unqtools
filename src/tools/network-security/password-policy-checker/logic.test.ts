/**
 * Password Policy Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { checkPolicy, DEFAULT_POLICY } from "./logic";

describe("password-policy default policy", () => {
  it("rejects empty password", () => {
    const r = checkPolicy("", DEFAULT_POLICY);
    expect(r.passed).toBe(false);
    expect(r.score).toBeLessThan(50);
  });
  it("accepts a strong password", () => {
    const r = checkPolicy("K7!xQ9#zR4*pL2vW", DEFAULT_POLICY);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
  });
  it("rejects short password", () => {
    const r = checkPolicy("Aa1!", DEFAULT_POLICY);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "length")?.passed).toBe(false);
  });
  it("rejects password missing uppercase", () => {
    const r = checkPolicy("strongpass1!abc", DEFAULT_POLICY);
    expect(r.checks.find((c) => c.id === "upper")?.passed).toBe(false);
  });
  it("rejects common password", () => {
    const r = checkPolicy("password", DEFAULT_POLICY);
    expect(r.checks.find((c) => c.id === "common")?.passed).toBe(false);
  });
  it("detects sequential chars", () => {
    const r = checkPolicy("Abc123!@#xyz9K", DEFAULT_POLICY);
    expect(r.checks.find((c) => c.id === "sequential")?.passed).toBe(false);
  });
  it("detects repeating chars", () => {
    const r = checkPolicy("K7!xQ9#zR4*aaaaaaa", DEFAULT_POLICY);
    expect(r.checks.find((c) => c.id === "repeating")?.passed).toBe(false);
  });
});

describe("password-policy custom policy", () => {
  it("respects relaxed policy", () => {
    const r = checkPolicy("abc", {
      ...DEFAULT_POLICY,
      minLength: 3,
      requireUpper: false,
      requireDigit: false,
      requireSymbol: false,
      minUnique: 2,
      rejectSequential: false,
      rejectRepeating: false,
    });
    expect(r.passed).toBe(true);
  });
  it("rejects password in history", () => {
    const r = checkPolicy("oldpassword123!", {
      ...DEFAULT_POLICY,
      history: ["oldpassword123!"],
    });
    expect(r.checks.find((c) => c.id === "history")?.passed).toBe(false);
  });
});

describe("password-policy suggestions", () => {
  it("suggests uppercase when missing", () => {
    const r = checkPolicy("strongpass1!xyz", DEFAULT_POLICY);
    expect(r.suggestions.some((s) => s.includes("uppercase"))).toBe(true);
  });
  it("suggests symbol when missing", () => {
    const r = checkPolicy("Strongpass1xyz", DEFAULT_POLICY);
    expect(r.suggestions.some((s) => s.includes("symbols"))).toBe(true);
  });
});

describe("password-policy score", () => {
  it("scores 100 for fully compliant password", () => {
    const r = checkPolicy("K7!xQ9#zR4*pL2vW", DEFAULT_POLICY);
    expect(r.score).toBe(100);
  });
  it("scores less than 100 for non-compliant", () => {
    const r = checkPolicy("weak", DEFAULT_POLICY);
    expect(r.score).toBeLessThan(100);
  });
});
