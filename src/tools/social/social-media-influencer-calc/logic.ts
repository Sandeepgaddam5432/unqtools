/**
 * Influencer Rate Calculator — pure logic.
 * Estimate sponsored-post rate based on followers, engagement, platform.
 */

export type Platform = "instagram" | "youtube" | "tiktok" | "twitter" | "blog";

export interface InfluencerInput {
  followers: number;
  engagementPct: number; // 0-100
  platform: Platform;
  postType: "post" | "story" | "video" | "reel";
}

export interface RateEstimate {
  baseRatePerPost: number;
  engagementMultiplier: number;
  platformMultiplier: number;
  postTypeMultiplier: number;
  lowEstimate: number;
  midEstimate: number;
  highEstimate: number;
  notes: string[];
}

const PLATFORM_MULTIPLIER: Record<Platform, number> = {
  instagram: 1.0,
  youtube: 2.5,
  tiktok: 0.7,
  twitter: 0.4,
  blog: 1.5,
};

const POST_TYPE_MULTIPLIER: Record<InfluencerInput["postType"], number> = {
  post: 1.0,
  story: 0.4,
  video: 1.8,
  reel: 1.3,
};

/** Rule-of-thumb: $10 per 1,000 followers for Instagram base. */
export function estimateRate(input: InfluencerInput): RateEstimate {
  const notes: string[] = [];
  const baseRatePerPost = (input.followers / 1000) * 10;

  // Engagement multiplier: 1% = 0.7x, 3% = 1.0x, 6%+ = 1.4x (clamped)
  const eng = Math.max(0, Math.min(15, input.engagementPct));
  const engagementMultiplier = Math.max(0.5, Math.min(1.6, 0.7 + (eng - 1) * 0.14));
  const platformMultiplier = PLATFORM_MULTIPLIER[input.platform];
  const postTypeMultiplier = POST_TYPE_MULTIPLIER[input.postType];

  const mid = baseRatePerPost * engagementMultiplier * platformMultiplier * postTypeMultiplier;
  const low = mid * 0.7;
  const high = mid * 1.3;

  if (input.followers < 1000) notes.push("Nano-influencer: rates are typically $50-$200/post.");
  else if (input.followers < 10_000) notes.push("Micro-influencer: high engagement usually commands a premium.");
  else if (input.followers < 100_000) notes.push("Mid-tier influencer: rates scale with reach + engagement.");
  else if (input.followers < 1_000_000) notes.push("Macro-influencer: rates are negotiated, often with agencies.");
  else notes.push("Celebrity-tier: rates are highly variable and custom-negotiated.");

  if (input.engagementPct < 1) notes.push("Engagement below 1% suggests low audience interaction.");
  if (input.engagementPct > 10) notes.push("Engagement above 10% is excellent — likely a tight community.");

  return {
    baseRatePerPost: round2(baseRatePerPost),
    engagementMultiplier: round2(engagementMultiplier),
    platformMultiplier,
    postTypeMultiplier,
    lowEstimate: round2(low),
    midEstimate: round2(mid),
    highEstimate: round2(high),
    notes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  blog: "Blog",
};

export const POST_TYPE_LABELS: Record<InfluencerInput["postType"], string> = {
  post: "Feed Post",
  story: "Story",
  video: "Video",
  reel: "Reel",
};
