/**
 * Influencer Rate Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { estimateRate, PLATFORM_LABELS, POST_TYPE_LABELS, type InfluencerInput } from "./logic";

const base: InfluencerInput = {
  followers: 50_000,
  engagementPct: 3,
  platform: "instagram",
  postType: "post",
};

describe("influencer estimateRate", () => {
  it("computes non-zero estimates", () => {
    const r = estimateRate(base);
    expect(r.lowEstimate).toBeGreaterThan(0);
    expect(r.midEstimate).toBeGreaterThan(r.lowEstimate);
    expect(r.highEstimate).toBeGreaterThan(r.midEstimate);
  });
  it("uses $10/1000 followers as the base", () => {
    const r = estimateRate({ ...base, followers: 1000, engagementPct: 1, postType: "post", platform: "instagram" });
    // base = 10, eng mult ~0.7, platform 1, type 1, mid = 7, low ~4.9, high ~9.1
    expect(r.baseRatePerPost).toBe(10);
    expect(r.midEstimate).toBeCloseTo(7, 1);
  });
  it("scales with follower count", () => {
    const small = estimateRate({ ...base, followers: 10_000 });
    const large = estimateRate({ ...base, followers: 100_000 });
    expect(large.midEstimate).toBeGreaterThan(small.midEstimate);
  });
  it("scales with engagement", () => {
    const low = estimateRate({ ...base, engagementPct: 0.5 });
    const high = estimateRate({ ...base, engagementPct: 10 });
    expect(high.midEstimate).toBeGreaterThan(low.midEstimate);
  });
  it("applies platform multiplier", () => {
    const ig = estimateRate({ ...base, platform: "instagram" });
    const yt = estimateRate({ ...base, platform: "youtube" });
    expect(yt.midEstimate).toBeGreaterThan(ig.midEstimate);
  });
  it("applies post-type multiplier", () => {
    const post = estimateRate({ ...base, postType: "post" });
    const story = estimateRate({ ...base, postType: "story" });
    expect(post.midEstimate).toBeGreaterThan(story.midEstimate);
  });
  it("includes notes for nano-influencer", () => {
    const r = estimateRate({ ...base, followers: 500 });
    expect(r.notes.some((n) => n.includes("Nano-influencer"))).toBe(true);
  });
  it("includes notes for celebrity-tier", () => {
    const r = estimateRate({ ...base, followers: 5_000_000 });
    expect(r.notes.some((n) => n.includes("Celebrity-tier"))).toBe(true);
  });
  it("flags very low engagement", () => {
    const r = estimateRate({ ...base, engagementPct: 0.5 });
    expect(r.notes.some((n) => n.includes("low audience"))).toBe(true);
  });
  it("flags very high engagement", () => {
    const r = estimateRate({ ...base, engagementPct: 12 });
    expect(r.notes.some((n) => n.includes("excellent"))).toBe(true);
  });
});

describe("influencer labels", () => {
  it("has labels for every platform", () => {
    expect(PLATFORM_LABELS.instagram).toBeTruthy();
    expect(PLATFORM_LABELS.youtube).toBeTruthy();
  });
  it("has labels for every post type", () => {
    expect(POST_TYPE_LABELS.post).toBeTruthy();
    expect(POST_TYPE_LABELS.reel).toBeTruthy();
  });
});
