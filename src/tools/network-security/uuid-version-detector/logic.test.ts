import { describe, it, expect } from "vitest";
import { parse, generateV4, toCsv } from "./logic";

describe("parse — valid UUIDs", () => {
  it("detects v4 UUID", () => {
    const r = parse("f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(r.valid).toBe(true);
    expect(r.version).toBe(4);
    expect(r.variant).toBe("rfc4122");
  });
  it("detects v1 UUID", () => {
    const r = parse("6ec0bd1a-0b92-11ec-9a03-0242ac130003");
    expect(r.valid).toBe(true);
    expect(r.version).toBe(1);
    expect(r.timestamp).toBeDefined();
  });
  it("detects v5 UUID", () => {
    const r = parse("886313e1-3b8a-5372-9b90-0c9aee199e5d");
    expect(r.valid).toBe(true);
    expect(r.version).toBe(5);
  });
  it("detects nil UUID", () => {
    const r = parse("00000000-0000-0000-0000-000000000000");
    expect(r.valid).toBe(true);
    expect(r.version).toBe("nil");
  });
});

describe("parse — invalid", () => {
  it("rejects bad format", () => {
    const r = parse("not-a-uuid");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("rejects wrong length", () => {
    const r = parse("f47ac10b-58cc-4372-a567");
    expect(r.valid).toBe(false);
  });
  it("reports unknown version for v6+", () => {
    const r = parse("f47ac10b-58cc-6372-a567-0e02b2c3d479");
    expect(r.valid).toBe(true);
    expect(r.version).toBe("unknown");
  });
});

describe("parse — variants", () => {
  it("detects RFC4122 variant", () => {
    const r = parse("f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(r.variant).toBe("rfc4122");
  });
});

describe("generateV4", () => {
  it("generates a valid v4 UUID", () => {
    const u = generateV4();
    const r = parse(u);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(4);
  });
  it("sets RFC4122 variant", () => {
    const u = generateV4();
    expect(parse(u).variant).toBe("rfc4122");
  });
});

describe("toCsv", () => {
  it("generates CSV header", () => {
    const csv = toCsv([parse(generateV4())]);
    expect(csv.split("\n")[0]).toBe("UUID,Valid,Version,Variant,Timestamp");
  });
});
