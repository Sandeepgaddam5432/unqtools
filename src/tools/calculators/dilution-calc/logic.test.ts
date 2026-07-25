import { describe, it, expect } from "vitest";
import { calculateDilution, dilutionFactor, serialDilution, validateInput } from "./logic";

describe("calculateDilution — solve C1", () => {
  it("computes C1 from C2, V2, V1", () => {
    const r = calculateDilution({ solveFor: "C1", C1: 0, V1: 1, C2: 1, V2: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.value).toBe(2);
  });
  it("rejects zero V1", () => {
    expect("error" in calculateDilution({ solveFor: "C1", C1: 0, V1: 0, C2: 1, V2: 2 })).toBe(true);
  });
});

describe("calculateDilution — solve V1", () => {
  it("computes V1 from C1, C2, V2", () => {
    const r = calculateDilution({ solveFor: "V1", C1: 2, V1: 0, C2: 1, V2: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.value).toBe(1);
  });
});

describe("calculateDilution — solve C2", () => {
  it("computes C2 from C1, V1, V2", () => {
    const r = calculateDilution({ solveFor: "C2", C1: 2, V1: 1, C2: 0, V2: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.value).toBe(1);
  });
});

describe("calculateDilution — solve V2", () => {
  it("computes V2 from C1, V1, C2", () => {
    const r = calculateDilution({ solveFor: "V2", C1: 2, V1: 1, C2: 1, V2: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.value).toBe(2);
  });
  it("rejects zero C2", () => {
    expect("error" in calculateDilution({ solveFor: "V2", C1: 2, V1: 1, C2: 0, V2: 0 })).toBe(true);
  });
});

describe("dilutionFactor", () => {
  it("computes V2 / V1", () => {
    expect(dilutionFactor(1, 10)).toBe(10);
  });
  it("rejects V2 < V1", () => {
    expect("error" in dilutionFactor(2, 1)).toBe(true);
  });
});

describe("serialDilution", () => {
  it("produces N+1 concentrations", () => {
    const r = serialDilution(100, 10, 3);
    expect(r).toEqual([100, 10, 1, 0.1]);
  });
  it("rejects invalid steps", () => {
    expect("error" in serialDilution(100, 10, -1)).toBe(true);
  });
  it("rejects invalid factor", () => {
    expect("error" in serialDilution(100, 1, 3)).toBe(true);
  });
});

describe("validateInput", () => {
  it("accepts valid solveFor", () => {
    expect(validateInput({ solveFor: "C1", C1: 0, V1: 1, C2: 1, V2: 2 })).toEqual({ ok: true });
  });
  it("rejects invalid solveFor", () => {
    expect(validateInput({ solveFor: "X" as never, C1: 0, V1: 1, C2: 1, V2: 2 })).toHaveProperty("error");
  });
});
