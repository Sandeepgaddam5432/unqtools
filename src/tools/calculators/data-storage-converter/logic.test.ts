import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv } from "./logic";

describe("process — bytes and bits", () => {
  it("converts byte to bits", () => {
    const r = process(1, { from: "byte", to: "bit" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(8);
  });
  it("converts bits to bytes", () => {
    const r = process(16, { from: "bit", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(2);
  });
});

describe("process — decimal", () => {
  it("converts KB to bytes", () => {
    const r = process(1, { from: "kb", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts MB to KB", () => {
    const r = process(1, { from: "mb", to: "kb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts GB to MB", () => {
    const r = process(1, { from: "gb", to: "mb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
});

describe("process — binary", () => {
  it("converts KiB to bytes", () => {
    const r = process(1, { from: "kib", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
  it("converts GiB to MiB", () => {
    const r = process(1, { from: "gib", to: "mib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
});

describe("process — mixed", () => {
  it("converts KB to KiB (decimal to binary)", () => {
    const r = process(1, { from: "kb", to: "kib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(0.9766, 3);
  });
});

describe("process — edge", () => {
  it("warns on negative input", () => {
    const r = process(-1, { from: "byte", to: "bit" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    const r = process(NaN, { from: "byte", to: "bit" });
    expect("error" in r).toBe(true);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "byte");
    expect(all.length).toBeGreaterThanOrEqual(12);
    const bits = all.find((r) => r.unit === "bit")!;
    expect(bits.value).toBe(8);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(1, "byte"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("bit,8");
  });
});
