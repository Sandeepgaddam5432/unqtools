import { describe, it, expect } from "vitest";
import {
  predictEngagement,
  baseEngagementRate,
  validateInput,
  defaultInput,
} from "./logic";

describe("social-engagement-predictor baseEngagementRate", () => {
  it("returns 0 for 0 followers", () => {
    expect(baseEngagementRate(0)).toBe(0);
  });

  it("decreases as follower count grows", () => {
    const small = baseEngagementRate(100);
    const large = baseEngagementRate(1000000);
    expect(small).toBeGreaterThan(large);
  });

  it("caps at 12", () => {
    expect(baseEngagementRate(1)).toBeLessThanOrEqual(12);
  });
});

describe("social-engagement-predictor predictEngagement", () => {
  it("returns positive numbers for valid input", () => {
    const r = predictEngagement(defaultInput());
    expect(r.predictedLikes).toBeGreaterThanOrEqual(0);
    expect(r.totalEngagement).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("video outperforms text", () => {
    const video = predictEngagement({ ...defaultInput(), postType: "video" });
    const text = predictEngagement({ ...defaultInput(), postType: "text" });
    expect(video.totalEngagement).toBeGreaterThan(text.totalEngagement);
  });

  it("micro-niche outperforms broad", () => {
    const micro = predictEngagement({ ...defaultInput(), accountNiche: "micro-niche" });
    const broad = predictEngagement({ ...defaultInput(), accountNiche: "broad" });
    expect(micro.totalEngagement).toBeGreaterThan(broad.totalEngagement);
  });

  it("best-time posting boosts engagement", () => {
    const good = predictEngagement({ ...defaultInput(), bestTimePosting: true });
    const bad = predictEngagement({ ...defaultInput(), bestTimePosting: false });
    expect(good.totalEngagement).toBeGreaterThan(bad.totalEngagement);
  });

  it("caption sweet spot (70-300) boosts engagement", () => {
    const sweet = predictEngagement({ ...defaultInput(), captionLength: 150 });
    const tooShort = predictEngagement({ ...defaultInput(), captionLength: 20 });
    expect(sweet.totalEngagement).toBeGreaterThan(tooShort.totalEngagement);
  });

  it("reports factor breakdown", () => {
    const r = predictEngagement(defaultInput());
    expect(r.factors.length).toBeGreaterThan(5);
  });

  it("assigns a tier", () => {
    const r = predictEngagement(defaultInput());
    expect(["low", "medium", "high", "viral"]).toContain(r.tier);
  });

  it("distribution sums roughly to total engagement", () => {
    const r = predictEngagement(defaultInput());
    expect(r.predictedLikes + r.predictedComments + r.predictedShares).toBeLessThanOrEqual(r.totalEngagement + 3);
  });
});

describe("social-engagement-predictor validateInput", () => {
  it("rejects negative followers", () => {
    expect(validateInput({ ...defaultInput(), followerCount: -1 })).not.toBeNull();
  });

  it("rejects too many hashtags", () => {
    expect(validateInput({ ...defaultInput(), hashtagCount: 40 })).not.toBeNull();
  });

  it("rejects caption too long", () => {
    expect(validateInput({ ...defaultInput(), captionLength: 3000 })).not.toBeNull();
  });

  it("accepts valid input", () => {
    expect(validateInput(defaultInput())).toBeNull();
  });
});
