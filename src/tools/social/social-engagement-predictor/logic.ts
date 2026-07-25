/**
 * Social Engagement Predictor — pure logic.
 * Predict engagement score using a weighted formula on input features.
 */

export interface EngagementInput {
  followerCount: number;
  postType: "image" | "video" | "carousel" | "text" | "story";
  hasHashtags: boolean;
  hashtagCount: number;
  hasMentions: boolean;
  hasEmoji: boolean;
  captionLength: number;
  bestTimePosting: boolean;
  hasCallToAction: boolean;
  accountNiche: "broad" | "niche" | "micro-niche";
}

export interface EngagementResult {
  predictedLikes: number;
  predictedComments: number;
  predictedShares: number;
  engagementRate: number; // percent
  totalEngagement: number;
  score: number; // 0-100
  tier: "low" | "medium" | "high" | "viral";
  factors: { label: string; weight: number; impact: number }[];
}

const POST_TYPE_MULTIPLIER: Record<EngagementInput["postType"], number> = {
  image: 1.0,
  video: 1.5,
  carousel: 1.3,
  text: 0.7,
  story: 0.9,
};

const NICHE_MULTIPLIER: Record<EngagementInput["accountNiche"], number> = {
  broad: 1.0,
  niche: 1.2,
  "micro-niche": 1.4,
};

/** Calculate base engagement rate from follower count (engagement drops with scale). */
export function baseEngagementRate(followerCount: number): number {
  if (followerCount <= 0) return 0;
  // Logan decay: small accounts get higher engagement
  const rate = 8 / Math.log10(followerCount + 10);
  return Math.min(rate, 12);
}

/** Predict engagement for an input. */
export function predictEngagement(input: EngagementInput): EngagementResult {
  const baseRate = baseEngagementRate(input.followerCount);
  const factors: { label: string; weight: number; impact: number }[] = [];

  const ptMult = POST_TYPE_MULTIPLIER[input.postType] ?? 1.0;
  factors.push({ label: `Post type: ${input.postType}`, weight: 1.5, impact: ptMult });

  const nicheMult = NICHE_MULTIPLIER[input.accountNiche] ?? 1.0;
  factors.push({ label: `Niche: ${input.accountNiche}`, weight: 1.2, impact: nicheMult });

  const hashtagImpact = input.hasHashtags
    ? Math.min(1 + input.hashtagCount * 0.05, 1.4)
    : 0.85;
  factors.push({ label: `Hashtags (${input.hashtagCount})`, weight: 1.0, impact: hashtagImpact });

  const mentionImpact = input.hasMentions ? 1.1 : 0.95;
  factors.push({ label: `Mentions`, weight: 0.8, impact: mentionImpact });

  const emojiImpact = input.hasEmoji ? 1.15 : 0.9;
  factors.push({ label: `Emoji`, weight: 0.6, impact: emojiImpact });

  // Caption length sweet spot: 70-300 chars
  let captionImpact = 0.9;
  if (input.captionLength >= 70 && input.captionLength <= 300) captionImpact = 1.2;
  else if (input.captionLength < 70) captionImpact = 0.85;
  factors.push({ label: `Caption length (${input.captionLength})`, weight: 0.9, impact: captionImpact });

  const timingImpact = input.bestTimePosting ? 1.25 : 0.85;
  factors.push({ label: `Best-time posting`, weight: 1.1, impact: timingImpact });

  const ctaImpact = input.hasCallToAction ? 1.2 : 0.9;
  factors.push({ label: `Call-to-action`, weight: 0.9, impact: ctaImpact });

  // Weighted product of impacts
  let weightedImpact = 1;
  let totalWeight = 0;
  for (const f of factors) {
    weightedImpact *= Math.pow(f.impact, f.weight);
    totalWeight += f.weight;
  }
  // Normalize
  const normalized = Math.pow(weightedImpact, 1 / totalWeight);

  const engagementRate = baseRate * normalized;
  const totalEngagement = Math.round((engagementRate / 100) * input.followerCount);

  // Distribution: likes 75%, comments 15%, shares 10%
  const predictedLikes = Math.round(totalEngagement * 0.75);
  const predictedComments = Math.round(totalEngagement * 0.15);
  const predictedShares = Math.round(totalEngagement * 0.10);

  // Score 0-100
  const score = Math.min(100, Math.round(engagementRate * 8));
  const tier: EngagementResult["tier"] =
    score >= 80 ? "viral" : score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  return {
    predictedLikes,
    predictedComments,
    predictedShares,
    engagementRate,
    totalEngagement,
    score,
    tier,
    factors,
  };
}

/** Validate inputs. */
export function validateInput(input: EngagementInput): string | null {
  if (input.followerCount < 0) return "Follower count cannot be negative.";
  if (input.hashtagCount < 0 || input.hashtagCount > 30) return "Hashtag count must be 0-30.";
  if (input.captionLength < 0) return "Caption length cannot be negative.";
  if (input.captionLength > 2200) return "Caption length should be ≤ 2200 (Instagram limit).";
  return null;
}

export function defaultInput(): EngagementInput {
  return {
    followerCount: 1000,
    postType: "image",
    hasHashtags: true,
    hashtagCount: 5,
    hasMentions: false,
    hasEmoji: true,
    captionLength: 150,
    bestTimePosting: true,
    hasCallToAction: true,
    accountNiche: "niche",
  };
}
