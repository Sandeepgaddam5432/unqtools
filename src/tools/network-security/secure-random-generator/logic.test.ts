import { describe, it, expect } from "vitest";
import { process, toCsv } from "./logic";

describe("process — int", () => {
  it("generates ints in range", () => {
    const r = process({ kind: "int", count: 10, min: 1, max: 6 });
    if ("error" in r) throw new Error("err");
    expect(r.values).toHaveLength(10);
    for (const v of r.values!) expect(v).toBeGreaterThanOrEqual(1);
    for (const v of r.values!) expect(v).toBeLessThanOrEqual(6);
  });
  it("respects count", () => {
    const r = process({ kind: "int", count: 5, min: 0, max: 100 });
    if ("error" in r) throw new Error("err");
    expect(r.values).toHaveLength(5);
  });
  it("errors on invalid count", () => {
    const r = process({ kind: "int", count: 0, min: 0, max: 100 });
    expect("error" in r).toBe(true);
  });
});

describe("process — float", () => {
  it("generates floats in [0,1)", () => {
    const r = process({ kind: "float", count: 5 });
    if ("error" in r) throw new Error("err");
    expect(r.values).toHaveLength(5);
    for (const v of r.values!) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of r.values!) expect(v).toBeLessThan(1);
  });
});

describe("process — bytes", () => {
  it("generates the requested byte count", () => {
    const r = process({ kind: "bytes", count: 16 });
    if ("error" in r) throw new Error("err");
    // Output: "[b1, b2, ..., b16]"
    expect(r.output.split(",").length).toBe(16);
  });
});

describe("process — hex", () => {
  it("generates hex of correct length", () => {
    const r = process({ kind: "hex", count: 32 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toHaveLength(32);
    expect(r.output).toMatch(/^[0-9a-f]+$/);
  });
});

describe("process — password", () => {
  it("generates password of correct length", () => {
    const r = process({ kind: "password", count: 20, charsets: ["lower", "upper", "digits"] });
    if ("error" in r) throw new Error("err");
    expect(r.output).toHaveLength(20);
  });
  it("avoids ambiguous chars when requested", () => {
    const r = process({ kind: "password", count: 50, charsets: ["lower", "upper", "digits"], avoidAmbiguous: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toMatch(/[Il1O0o]/);
  });
  it("errors on too-short password", () => {
    const r = process({ kind: "password", count: 2 });
    expect("error" in r).toBe(true);
  });
});

describe("toCsv", () => {
  it("generates CSV with index column", () => {
    const csv = toCsv([1, 2, 3]);
    expect(csv.split("\n")[0]).toBe("Index,Value");
    expect(csv).toContain("0,1");
  });
});
