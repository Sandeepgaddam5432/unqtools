/**
 * Social Media Post Scheduler — unit tests.
 */
import { describe, it, expect } from "vitest";
import { planWeek, planMulti, bestSlot, toCsv, OPTIMAL_TIMES, PLATFORM_LABELS, type Platform } from "./logic";

describe("scheduler OPTIMAL_TIMES", () => {
  it("has slots for every platform", () => {
    for (const p of Object.keys(OPTIMAL_TIMES) as Platform[]) {
      expect(OPTIMAL_TIMES[p].length).toBeGreaterThan(0);
    }
  });
});

describe("scheduler planWeek", () => {
  it("returns up to 5 posts for Instagram", () => {
    const r = planWeek("instagram");
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(5);
  });
  it("respects maxPosts limit", () => {
    const r = planWeek("twitter", 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });
  it("every post has the platform set", () => {
    const r = planWeek("linkedin");
    expect(r.every((p) => p.platform === "linkedin")).toBe(true);
  });
  it("every post has day, time, reason", () => {
    const r = planWeek("tiktok");
    for (const p of r) {
      expect(p.day).toBeTruthy();
      expect(p.time).toMatch(/^\d{2}:\d{2}$/);
      expect(p.reason).toBeTruthy();
    }
  });
});

describe("scheduler planMulti", () => {
  it("aggregates across platforms", () => {
    const r = planMulti(["instagram", "twitter"]);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((p) => p.platform === "instagram")).toBe(true);
    expect(r.some((p) => p.platform === "twitter")).toBe(true);
  });
});

describe("scheduler bestSlot", () => {
  it("returns the first slot for a platform", () => {
    const s = bestSlot("facebook");
    expect(s).not.toBeNull();
    expect(s!.platform).toBe("facebook");
  });
});

describe("scheduler toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(planWeek("instagram"));
    expect(csv.split("\n")[0]).toBe("platform,day,time,reason");
    expect(csv).toContain("instagram");
  });
});

describe("scheduler PLATFORM_LABELS", () => {
  it("has a label for each platform", () => {
    for (const p of Object.keys(PLATFORM_LABELS) as Platform[]) {
      expect(PLATFORM_LABELS[p]).toBeTruthy();
    }
  });
});
