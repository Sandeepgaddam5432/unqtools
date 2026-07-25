/**
 * Meeting Room Booker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateUtilization, formatDuration } from "./logic";

describe("meeting-room calculateUtilization", () => {
  it("returns 0% for empty bookings", () => {
    const r = calculateUtilization({ openTime: "09:00", closeTime: "17:00", bookings: [] });
    expect(r.bookedMinutes).toBe(0);
    expect(r.utilizationPct).toBe(0);
    expect(r.freeSlots).toHaveLength(1);
    expect(r.freeSlots[0]).toEqual({ start: "09:00", end: "17:00" });
  });
  it("calculates 50% utilization for 4h of 8h", () => {
    const r = calculateUtilization({
      openTime: "09:00", closeTime: "17:00",
      bookings: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "16:00" }],
    });
    expect(r.totalMinutes).toBe(480);
    expect(r.bookedMinutes).toBe(240);
    expect(r.utilizationPct).toBe(50);
  });
  it("detects overlaps", () => {
    const r = calculateUtilization({
      openTime: "09:00", closeTime: "17:00",
      bookings: [{ start: "10:00", end: "12:00" }, { start: "11:30", end: "13:00" }],
    });
    expect(r.overlaps.length).toBe(1);
  });
  it("clamps bookings to open/close hours", () => {
    const r = calculateUtilization({
      openTime: "09:00", closeTime: "17:00",
      bookings: [{ start: "08:00", end: "18:00" }],
    });
    expect(r.bookedMinutes).toBe(480);
    expect(r.utilizationPct).toBe(100);
  });
  it("computes correct free slots", () => {
    const r = calculateUtilization({
      openTime: "09:00", closeTime: "17:00",
      bookings: [{ start: "10:00", end: "12:00" }],
    });
    expect(r.freeSlots).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "12:00", end: "17:00" },
    ]);
  });
  it("merges adjacent bookings", () => {
    const r = calculateUtilization({
      openTime: "09:00", closeTime: "17:00",
      bookings: [{ start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" }],
    });
    expect(r.freeSlots).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "12:00", end: "17:00" },
    ]);
  });
  it("reports errors for invalid times", () => {
    const r = calculateUtilization({ openTime: "bad", closeTime: "17:00", bookings: [] });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("reports error when close <= open", () => {
    const r = calculateUtilization({ openTime: "17:00", closeTime: "09:00", bookings: [] });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("meeting-room formatDuration", () => {
  it("formats minutes-only", () => {
    expect(formatDuration(45)).toBe("45m");
  });
  it("formats hours-only", () => {
    expect(formatDuration(120)).toBe("2h");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });
});
