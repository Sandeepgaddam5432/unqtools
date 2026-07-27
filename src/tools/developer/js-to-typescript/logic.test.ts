import { describe, it, expect } from "vitest";
import { convertJsToTs, inferType, generateInterface } from "./logic";

describe("JS to TypeScript Converter", () => {
  it("converts var to let", () => {
    const result = convertJsToTs("var x = 1;");
    expect(result.output).toContain("let x");
    expect(result.conversions).toBeGreaterThan(0);
  });
  it("adds any types to function params", () => {
    const result = convertJsToTs("function add(a, b) { return a + b; }");
    expect(result.output).toContain("a: any");
    expect(result.output).toContain("b: any");
  });
  it("infers types", () => {
    expect(inferType(42)).toBe("number");
    expect(inferType("hello")).toBe("string");
    expect(inferType(true)).toBe("boolean");
    expect(inferType([1, 2])).toBe("number[]");
  });
  it("generates interface", () => {
    const iface = generateInterface({ name: "test", age: 30 });
    expect(iface).toContain("interface");
    expect(iface).toContain("name: string");
    expect(iface).toContain("age: number");
  });
});
