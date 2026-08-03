import { describe, it, expect } from "vitest";
import { formatBytes, getPageSpec } from "./logic";

describe("PLACEHOLDER_NAME", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("resolves page spec: all", () => {
    expect(getPageSpec("all", 5)).toEqual([0, 1, 2, 3, 4]);
  });
  it("resolves page spec: first", () => {
    expect(getPageSpec("first", 5)).toEqual([0]);
  });
  it("resolves page spec: last", () => {
    expect(getPageSpec("last", 5)).toEqual([4]);
  });
  it("resolves page spec: odd", () => {
    expect(getPageSpec("odd", 6)).toEqual([0, 2, 4]);
  });
  it("resolves page spec: even", () => {
    expect(getPageSpec("even", 6)).toEqual([1, 3, 5]);
  });
});
