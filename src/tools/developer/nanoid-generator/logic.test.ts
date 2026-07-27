import { describe, it, expect } from "vitest";
import { generateNanoId, generateBulk, validateNanoId, getAlphabets, calculateCollisionProbability } from "./logic";

describe("NanoID Generator", () => {
  it("generates ID with default size", () => {
    const id = generateNanoId();
    expect(id).toHaveLength(21);
  });
  it("generates ID with custom size", () => {
    expect(generateNanoId(10)).toHaveLength(10);
  });
  it("generates unique IDs", () => {
    expect(generateNanoId()).not.toBe(generateNanoId());
  });
  it("generates bulk IDs", () => {
    const ids = generateBulk(5);
    expect(ids).toHaveLength(5);
  });
  it("validates NanoID", () => {
    expect(validateNanoId(generateNanoId())).toBe(true);
  });
  it("lists alphabets", () => {
    expect(getAlphabets().length).toBeGreaterThan(3);
  });
  it("calculates collision probability", () => {
    const prob = calculateCollisionProbability(21, 64, 1000);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThan(1);
  });
});
