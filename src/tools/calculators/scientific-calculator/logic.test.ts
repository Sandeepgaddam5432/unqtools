import { describe, it, expect } from "vitest";
import { process } from "./logic";

describe("process — basic arithmetic", () => {
  it("adds two numbers", () => {
    const r = process("2 + 3");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(5);
  });
  it("respects operator precedence", () => {
    const r = process("2 + 3 * 4");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(14);
  });
  it("handles parentheses", () => {
    const r = process("(2 + 3) * 4");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(20);
  });
});

describe("process — unary and power", () => {
  it("handles unary minus", () => {
    const r = process("-5 + 3");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(-2);
  });
  it("handles exponentiation", () => {
    const r = process("2 ^ 10");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(1024);
  });
  it("right-associates exponentiation", () => {
    const r = process("2 ^ 3 ^ 2");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(512);
  });
});

describe("process — functions", () => {
  it("computes sqrt", () => {
    const r = process("sqrt(16)");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(4);
  });
  it("computes factorial", () => {
    const r = process("5!");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBe(120);
  });
  it("uses radians by default for sin", () => {
    const r = process("sin(0)");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBeCloseTo(0, 5);
  });
  it("uses degrees when angleMode=deg", () => {
    const r = process("sin(90)", { angleMode: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.result).toBeCloseTo(1, 5);
  });
});

describe("process — constants", () => {
  it("uses pi", () => {
    const r = process("pi");
    if ("error" in r) throw new Error("err");
    expect(r.result).toBeCloseTo(Math.PI, 5);
  });
});

describe("process — errors", () => {
  it("errors on empty input", () => {
    const r = process("");
    expect("error" in r).toBe(true);
  });
  it("errors on mismatched parens", () => {
    const r = process("(2 + 3");
    expect("error" in r).toBe(true);
  });
  it("warns on division by zero", () => {
    const r = process("1 / 0");
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
