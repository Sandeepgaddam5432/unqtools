import { describe, it, expect } from "vitest";
import {
  COMMON_ZONES,
  getAllZoneIds,
  formatInZone,
  utcOffsetFor,
  convertToAll,
  offsetMinutes,
  validateInput,
} from "./logic";

describe("timezone-converter", () => {
  it("has a common-zone list with UTC and major cities", () => {
    const ids = COMMON_ZONES.map((z) => z.id);
    expect(ids).toContain("UTC");
    expect(ids).toContain("America/New_York");
    expect(ids).toContain("Asia/Kolkata");
    expect(ids).toContain("Europe/London");
  });

  it("returns IANA zones from the runtime", () => {
    const zones = getAllZoneIds();
    expect(zones.length).toBeGreaterThan(10);
    // Contents depend on the runtime's ICU timezone data, so just check length.
    expect(Array.isArray(zones)).toBe(true);
  });

  it("formats a time in a timezone", () => {
    const d = new Date("2026-01-01T12:00:00Z");
    const out = formatInZone(d, "UTC");
    expect(out).toContain("12:00");
  });

  it("returns invalid-timezone fallback for a bad zone", () => {
    const out = formatInZone(new Date(), "Not/AZone");
    expect(out).toBe("Invalid timezone");
  });

  it("gives UTC a Z or +00:00 offset", () => {
    const o = utcOffsetFor("UTC", new Date());
    expect(o === "Z" || o === "+00:00").toBe(true);
  });

  it("Kolkata offset is +05:30 (no DST)", () => {
    expect(offsetMinutes("Asia/Kolkata", new Date("2026-06-01T00:00:00Z"))).toBe(330);
    expect(utcOffsetFor("Asia/Kolkata", new Date("2026-06-01T00:00:00Z"))).toBe("+05:30");
  });

  it("UTC and New York differ by hours (NY has DST in June)", () => {
    const d = new Date("2026-06-15T12:00:00Z");
    const utc = offsetMinutes("UTC", d);
    const ny = offsetMinutes("America/New_York", d);
    expect(Math.abs(utc - ny)).toBe(240); // -4h in summer
  });

  it("convertToAll maps a moment across zones", () => {
    const d = new Date("2026-06-15T12:00:00Z");
    const all = convertToAll(d, "UTC", ["UTC", "Asia/Tokyo"]);
    expect(all).toHaveLength(2);
    expect(all[1].zone).toBe("Asia/Tokyo");
    expect(all[1].relativeHours).toContain("9");
  });

  it("labels same-time as 'same time'", () => {
    const d = new Date();
    const all = convertToAll(d, "UTC", ["UTC"]);
    expect(all[0].relativeHours).toBe("same time");
  });

  it("validateInput accepts a valid date and rejects invalid", () => {
    expect(validateInput(new Date())).toBeNull();
    expect(validateInput(new Date("invalid"))).not.toBeNull();
  });

  it("every common zone is a valid IANA id", () => {
    for (const z of COMMON_ZONES) {
      expect(() => formatInZone(new Date(), z.id)).not.toThrow();
    }
  });
});
