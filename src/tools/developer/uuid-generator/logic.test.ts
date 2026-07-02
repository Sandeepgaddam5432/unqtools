import { describe, it, expect } from "vitest";
import { generateUuid, generateUuids, formatUuid, isValidUuid, getUuidVersion } from "./logic";

describe("generateUuid", () => {
  it("generates a valid v4 UUID", () => {
    const uuid = generateUuid();
    expect(isValidUuid(uuid)).toBe(true);
    expect(getUuidVersion(uuid)).toBe(4);
  });

  it("generates 36-character string with hyphens", () => {
    const uuid = generateUuid();
    expect(uuid.length).toBe(36);
    expect(uuid.split("-").length).toBe(5);
  });

  it("has correct segment lengths (8-4-4-4-12)", () => {
    const uuid = generateUuid();
    const segments = uuid.split("-");
    expect(segments[0]!.length).toBe(8);
    expect(segments[1]!.length).toBe(4);
    expect(segments[2]!.length).toBe(4);
    expect(segments[3]!.length).toBe(4);
    expect(segments[4]!.length).toBe(12);
  });

  it("is unique across many calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateUuid());
    expect(set.size).toBe(1000);
  });
});

describe("generateUuids", () => {
  it("generates the requested count", () => {
    const arr = generateUuids(10);
    expect(arr.length).toBe(10);
    for (const uuid of arr) expect(isValidUuid(uuid)).toBe(true);
  });

  it("all UUIDs in a batch are unique", () => {
    const arr = generateUuids(100);
    expect(new Set(arr).size).toBe(100);
  });

  it("respects hyphens=false option", () => {
    const arr = generateUuids(1, { hyphens: false });
    expect(arr[0]!.length).toBe(32);
    expect(arr[0]).not.toContain("-");
  });

  it("respects uppercase option", () => {
    const arr = generateUuids(1, { uppercase: true });
    expect(arr[0]).toMatch(/^[0-9A-F-]+$/);
  });

  it("respects prefix option", () => {
    const arr = generateUuids(1, { prefix: "id-" });
    expect(arr[0]!.startsWith("id-")).toBe(true);
  });

  it("respects suffix option", () => {
    const arr = generateUuids(1, { suffix: "-end" });
    expect(arr[0]!.endsWith("-end")).toBe(true);
  });

  it("respects braces option", () => {
    const arr = generateUuids(1, { braces: true });
    expect(arr[0]!.startsWith("{")).toBe(true);
    expect(arr[0]!.endsWith("}")).toBe(true);
  });

  it("handles zero count", () => {
    expect(generateUuids(0)).toEqual([]);
  });
});

describe("formatUuid", () => {
  const sample = "550e8400-e29b-41d4-a716-446655440000";

  it("passes through by default", () => {
    expect(formatUuid(sample, {})).toBe(sample);
  });

  it("strips hyphens", () => {
    expect(formatUuid(sample, { hyphens: false })).toBe("550e8400e29b41d4a716446655440000");
  });

  it("uppercases", () => {
    expect(formatUuid(sample, { uppercase: true })).toBe("550E8400-E29B-41D4-A716-446655440000");
  });

  it("wraps in braces", () => {
    const f = formatUuid(sample, { braces: true });
    expect(f.startsWith("{")).toBe(true);
    expect(f.endsWith("}")).toBe(true);
  });

  it("combines options", () => {
    const f = formatUuid(sample, { hyphens: false, uppercase: true, prefix: "0x" });
    expect(f).toBe("0x550E8400E29B41D4A716446655440000");
  });
});

describe("isValidUuid", () => {
  it("accepts valid v4 UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid(generateUuid())).toBe(true);
  });

  it("accepts uppercase UUIDs", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects too-short strings", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-44665544gggg")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUuid("")).toBe(false);
  });

  it("rejects random text", () => {
    expect(isValidUuid("not a uuid")).toBe(false);
  });

  it("trims whitespace before validating", () => {
    expect(isValidUuid("  550e8400-e29b-41d4-a716-446655440000  ")).toBe(true);
  });
});

describe("getUuidVersion", () => {
  it("returns 4 for v4 UUIDs", () => {
    expect(getUuidVersion("550e8400-e29b-41d4-a716-446655440000")).toBe(4);
    expect(getUuidVersion(generateUuid())).toBe(4);
  });

  it("returns null for invalid UUIDs", () => {
    expect(getUuidVersion("not-a-uuid")).toBeNull();
  });
});
