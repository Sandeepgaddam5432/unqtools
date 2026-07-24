import { describe, it, expect } from "vitest";
import { generate, generateBatch, validate, toCsv } from "./logic";

describe("generate — formats", () => {
  it("generates colon-separated MAC", () => {
    const r = generate({ format: "colon", case: "upper" });
    expect(r.mac).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/);
  });
  it("generates hyphen-separated MAC", () => {
    const r = generate({ format: "hyphen", case: "lower" });
    expect(r.mac).toMatch(/^[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}$/);
  });
  it("generates no-separator MAC", () => {
    const r = generate({ format: "none", case: "upper" });
    expect(r.mac).toMatch(/^[0-9A-F]{12}$/);
  });
  it("generates dots-formatted MAC", () => {
    const r = generate({ format: "dots", case: "upper" });
    expect(r.mac).toMatch(/^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/);
  });
});

describe("generate — OUI", () => {
  it("honors custom OUI prefix", () => {
    const r = generate({ format: "colon", case: "upper", oui: "AABBCC" });
    expect(r.mac.startsWith("AA:BB:CC")).toBe(true);
  });
  it("falls back to random on invalid OUI", () => {
    const r = generate({ format: "colon", case: "upper", oui: "XYZ" });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.mac).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/);
  });
  it("sets locally-administered bit", () => {
    const r = generate({ format: "none", case: "upper", locallyAdministered: true });
    const firstByte = parseInt(r.mac.slice(0, 2), 16);
    expect(firstByte & 0x02).toBe(2);
  });
  it("sets multicast bit", () => {
    const r = generate({ format: "none", case: "upper", multicast: true });
    const firstByte = parseInt(r.mac.slice(0, 2), 16);
    expect(firstByte & 0x01).toBe(1);
  });
});

describe("generateBatch", () => {
  it("generates the requested count", () => {
    const rows = generateBatch(5, { format: "colon", case: "upper" });
    expect(rows).toHaveLength(5);
  });
  it("returns empty array for 0", () => {
    expect(generateBatch(0, { format: "colon", case: "upper" })).toHaveLength(0);
  });
});

describe("validate", () => {
  it("validates a correct MAC", () => {
    const v = validate("01:23:45:67:89:AB");
    expect(v.valid).toBe(true);
    expect(v.oui).toBe("01:23:45");
  });
  it("rejects too-short MAC", () => {
    const v = validate("01:23:45");
    expect(v.valid).toBe(false);
  });
  it("rejects non-hex chars", () => {
    const v = validate("01:23:45:67:89:XY");
    expect(v.valid).toBe(false);
  });
  it("strips separators when normalizing", () => {
    const v = validate("01-23-45-67-89-AB");
    expect(v.normalized).toBe("01:23:45:67:89:AB");
  });
});

describe("toCsv", () => {
  it("generates CSV header", () => {
    const csv = toCsv(generateBatch(2, { format: "colon", case: "upper" }));
    expect(csv.split("\n")[0]).toBe("MAC,OUI");
    expect(csv.split("\n").length).toBe(3);
  });
});
