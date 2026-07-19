/**
 * Social Media Collab Finder — pure logic.
 *
 * Generate influencer search queries, outreach emails, brand partnership
 * compatibility scores, cross-promo partner suggestions, affiliate
 * structures, sponsored content briefs, giveaway plans, follow-up
 * sequences, and compensation estimates. Pure functions only — no DOM,
 * no network.
 */

export type CollabType =
  | "influencer-outreach"
  | "brand-partnership"
  | "cross-promotion"
  | "affiliate"
  | "sponsored-content"
  | "giveaway-collab";

export type TargetPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "blog";

export type AudienceTier =
  | "micro-1k-10k"
  | "mid-10k-100k"
  | "macro-100k-1M"
  | "mega-1M+";

export interface CollabInput {
  yourBrand: string;
  yourNiche: string;
  collabType: CollabType;
  targetPlatforms: TargetPlatform[];
  audienceSizeTarget: AudienceTier;
  budgetRange: string;
  yourValueProp: string;
}

export interface SearchQuery {
  platform: TargetPlatform;
  niche: string;
  query: string;
  googleUrl: string;
}

export interface OutreachEmail {
  subject: string;
  body: string;
}

export interface PartnershipMatch {
  score: number; // 0-100
  level: "low" | "medium" | "high";
  reasons: string[];
}

export interface CrossPromoPartner {
  niche: string;
  reason: string;
}

export interface AffiliateProgram {
  commissionPct: number;
  cookieDurationDays: number;
  payoutTerms: string;
  notes: string;
}

export interface SponsoredBrief {
  platform: TargetPlatform;
  deliverables: string[];
  timeline: string;
  keyMessages: string[];
  disclosure: string;
}

export interface GiveawayPlan {
  prizeSplit: string;
  mechanics: string[];
  promotionSchedule: string[];
  rules: string;
}

export interface FollowUpEmail {
  step: number;
  waitDays: number;
  subject: string;
  body: string;
}

export interface CompensationEstimate {
  low: number;
  mid: number;
  high: number;
  currency: string;
  notes: string;
}

export interface CollabSummary {
  totalOutreachTargets: number;
  platformsCount: number;
  collabTypesCount: number;
  audienceTiersCount: number;
  partnershipScore: number;
  estimatedCompLow: number;
  estimatedCompHigh: number;
}

export interface GeneratedCollab {
  input: CollabInput;
  searchQueries: SearchQuery[];
  outreachEmail: OutreachEmail;
  partnershipMatch: PartnershipMatch;
  crossPromoPartners: CrossPromoPartner[];
  affiliateProgram: AffiliateProgram;
  sponsoredBriefs: SponsoredBrief[];
  giveawayPlan: GiveawayPlan;
  valuePropFormatted: string;
  followUps: FollowUpEmail[];
  compensation: CompensationEstimate;
  summary: CollabSummary;
}

// ---- Constants / presets ----

export const COLLAB_TYPES: CollabType[] = [
  "influencer-outreach",
  "brand-partnership",
  "cross-promotion",
  "affiliate",
  "sponsored-content",
  "giveaway-collab",
];

export const TARGET_PLATFORMS: TargetPlatform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
  "blog",
];

export const AUDIENCE_TIERS: AudienceTier[] = [
  "micro-1k-10k",
  "mid-10k-100k",
  "macro-100k-1M",
  "mega-1M+",
];

export const COLLAB_TYPE_LABELS: Record<CollabType, string> = {
  "influencer-outreach": "Influencer Outreach",
  "brand-partnership": "Brand Partnership",
  "cross-promotion": "Cross-Promotion",
  "affiliate": "Affiliate Program",
  "sponsored-content": "Sponsored Content",
  "giveaway-collab": "Giveaway Collab",
};

export const PLATFORM_LABELS: Record<TargetPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  blog: "Blog",
};

export const AUDIENCE_LABELS: Record<AudienceTier, string> = {
  "micro-1k-10k": "Micro (1k–10k)",
  "mid-10k-100k": "Mid (10k–100k)",
  "macro-100k-1M": "Macro (100k–1M)",
  "mega-1M+": "Mega (1M+)",
};

// Google search footprints per platform.
export const PLATFORM_FOOTPRINTS: Record<TargetPlatform, string[]> = {
  instagram: [
    'site:instagram.com "{niche}" "influencer"',
    'site:instagram.com "{niche}" "blogger"',
    '"{niche}" instagram "DM for collab"',
    '"{niche}" instagram "open for partnerships"',
  ],
  youtube: [
    'site:youtube.com "{niche}" "review"',
    'site:youtube.com "{niche}" "channel"',
    '"{niche}" youtuber "business inquiries"',
    '"{niche}" youtube "sponsored"',
  ],
  tiktok: [
    'site:tiktok.com "{niche}"',
    '"{niche}" tiktok "creator"',
    '"{niche}" tiktok "open for collabs"',
    '"{niche}" tiktok "business email"',
  ],
  twitter: [
    'site:twitter.com "{niche}" "DM for collab"',
    'site:x.com "{niche}" "influencer"',
    '"{niche}" twitter "open for partnerships"',
  ],
  blog: [
    '"{niche}" blog "write for us"',
    '"{niche}" blog "guest post"',
    '"{niche}" blogger "sponsored post"',
    '"{niche}" blog "advertise"',
    '"{niche}" "media kit" blog',
  ],
};

// Cross-promotion: complementary niches lookup.
export const COMPLEMENTARY_NICHES: Record<string, string[]> = {
  fitness: ["nutrition", "wellness", "activewear", "supplements", "meal-prep"],
  tech: ["productivity", "gadgets", "software", "ai", "gaming"],
  cooking: ["kitchenware", "grocery", "meal-prep", "wine", "health"],
  travel: ["photography", "luggage", "hotels", "insurance", "outdoor-gear"],
  beauty: ["skincare", "makeup", "fashion", "wellness", "haircare"],
  finance: ["investing", "personal-finance", "credit-cards", "crypto", "real-estate"],
  gaming: ["tech", "streaming", "pc-building", "esports", "peripherals"],
  parenting: ["kids-fashion", "toys", "education", "family-travel", "baby-gear"],
  pets: ["pet-food", "pet-toys", "veterinary", "training", "pet-accessories"],
  health: ["fitness", "nutrition", "supplements", "mental-health", "wellness"],
};

// Default commission/cookie per collab type / audience tier (rough market estimates).
export const AFFILIATE_PRESETS: Record<AudienceTier, { commissionPct: number; cookieDays: number }> = {
  "micro-1k-10k": { commissionPct: 15, cookieDays: 30 },
  "mid-10k-100k": { commissionPct: 12, cookieDays: 60 },
  "macro-100k-1M": { commissionPct: 10, cookieDays: 90 },
  "mega-1M+": { commissionPct: 8, cookieDays: 120 },
};

// Compensation estimates (USD per post/integration, low/mid/high).
export const COMPENSATION_TABLE: Record<CollabType, Record<AudienceTier, [number, number, number]>> = {
  "influencer-outreach": {
    "micro-1k-10k": [50, 150, 400],
    "mid-10k-100k": [300, 800, 2000],
    "macro-100k-1M": [1500, 5000, 12000],
    "mega-1M+": [10000, 30000, 75000],
  },
  "brand-partnership": {
    "micro-1k-10k": [100, 300, 700],
    "mid-10k-100k": [600, 1500, 4000],
    "macro-100k-1M": [3000, 9000, 25000],
    "mega-1M+": [20000, 60000, 150000],
  },
  "cross-promotion": {
    "micro-1k-10k": [0, 50, 200],
    "mid-10k-100k": [100, 400, 1200],
    "macro-100k-1M": [1000, 3000, 8000],
    "mega-1M+": [8000, 25000, 60000],
  },
  "affiliate": {
    "micro-1k-10k": [0, 0, 0],
    "mid-10k-100k": [0, 0, 0],
    "macro-100k-1M": [0, 0, 0],
    "mega-1M+": [0, 0, 0],
  },
  "sponsored-content": {
    "micro-1k-10k": [100, 250, 500],
    "mid-10k-100k": [500, 1200, 3000],
    "macro-100k-1M": [2500, 7000, 18000],
    "mega-1M+": [15000, 45000, 120000],
  },
  "giveaway-collab": {
    "micro-1k-10k": [50, 150, 350],
    "mid-10k-100k": [300, 700, 1800],
    "macro-100k-1M": [1500, 4000, 11000],
    "mega-1M+": [10000, 30000, 70000],
  },
};

// ---- Helpers ----

export function normalizeString(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function buildGoogleUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// ---- Influencer search query generator ----

export function generateInfluencerQueries(
  niche: string,
  platforms: TargetPlatform[],
): SearchQuery[] {
  const n = normalizeString(niche);
  if (!n || platforms.length === 0) return [];
  const out: SearchQuery[] = [];
  for (const p of platforms) {
    const footprints = PLATFORM_FOOTPRINTS[p] || [];
    for (const fp of footprints) {
      const query = fp.replace(/\{niche\}/g, n);
      out.push({ platform: p, niche: n, query, googleUrl: buildGoogleUrl(query) });
    }
  }
  return out;
}

// ---- Outreach email template generator ----

export function generateOutreachEmail(input: CollabInput): OutreachEmail {
  const brand = normalizeString(input.yourBrand) || "Your Brand";
  const niche = normalizeString(input.yourNiche) || "your niche";
  const budget = normalizeString(input.budgetRange) || "flexible";
  const valueProp = normalizeString(input.yourValueProp) || "we'd love to collaborate";
  const tierLabel = AUDIENCE_LABELS[input.audienceSizeTarget];

  const subjects: Record<CollabType, string> = {
    "influencer-outreach": `Collab opportunity with ${brand} — ${niche} creators`,
    "brand-partnership": `Partnership proposal: ${brand} × ${niche}`,
    "cross-promotion": `Cross-promo idea: ${brand} × ${niche} creators`,
    "affiliate": `Affiliate program invite: ${brand} (${niche})`,
    "sponsored-content": `Sponsored content inquiry from ${brand}`,
    "giveaway-collab": `Giveaway collab with ${brand} — interested?`,
  };

  const intros: Record<CollabType, string> = {
    "influencer-outreach": `Hi [Name],\n\nI'm reaching out from ${brand}. We've been following your ${niche} content and love what you share with your audience.`,
    "brand-partnership": `Hi [Name],\n\nI'm [Your Name] from ${brand}. We're building a long-term partnership program in ${niche} and would love to explore working with you.`,
    "cross-promotion": `Hi [Name],\n\nI'm [Your Name] from ${brand}. We're a complementary brand in ${niche} and would love to cross-promote with creators like you.`,
    "affiliate": `Hi [Name],\n\nI'm [Your Name] from ${brand}. We've just launched our affiliate program in ${niche} and would love to invite you to join as a founding partner.`,
    "sponsored-content": `Hi [Name],\n\nI'm [Your Name] from ${brand}. We have budget for ${niche} sponsored content this quarter and your audience looks like a great fit.`,
    "giveaway-collab": `Hi [Name],\n\nI'm [Your Name] from ${brand}. We'd love to co-host a giveaway with you in ${niche} — great for both our audiences.`,
  };

  const middles: Record<CollabType, string> = {
    "influencer-outreach": `What we're offering: ${valueProp}. Budget: ${budget}. Target audience size: ${tierLabel}.`,
    "brand-partnership": `What we're proposing: ${valueProp}. Budget: ${budget}. Looking for ${tierLabel} creators for an ongoing partnership.`,
    "cross-promotion": `Idea: ${valueProp}. We'd promote your content to our audience and vice versa. Budget for any paid amplification: ${budget}.`,
    "affiliate": `Commission structure: ${AFFILIATE_PRESETS[input.audienceSizeTarget].commissionPct}% per sale, ${AFFILIATE_PRESETS[input.audienceSizeTarget].cookieDays}-day cookie window. ${valueProp}.`,
    "sponsored-content": `What we'd love: ${valueProp}. Budget: ${budget}. Audience tier: ${tierLabel}.`,
    "giveaway-collab": `Prize split and rules: we'd co-fund the prize. ${valueProp}. Budget: ${budget}. Audience tier: ${tierLabel}.`,
  };

  const cta = `If this sounds interesting, would you be open to a quick 15-minute call next week? Happy to send more details first if you prefer.\n\nThanks for considering,\n[Your Name]\n${brand}`;

  const subject = subjects[input.collabType];
  const body = [intros[input.collabType], middles[input.collabType], cta].join("\n\n");
  return { subject, body };
}

// ---- Brand partnership matcher ----

export function matchBrandPartnership(
  brand: string,
  niche: string,
  audienceTier: AudienceTier,
): PartnershipMatch {
  const reasons: string[] = [];
  let score = 40; // baseline
  const n = normalizeString(niche).toLowerCase();

  if (n) {
    score += 15;
    reasons.push(`Niche is clearly defined ("${n}") — easier to find aligned partners.`);
  }
  if (normalizeString(brand)) {
    score += 10;
    reasons.push(`Brand identity provided ("${brand}") — improves cold-email response rates.`);
  }

  // Complementary niches available?
  const complement = COMPLEMENTARY_NICHES[n];
  if (complement && complement.length > 0) {
    score += 20;
    reasons.push(`${complement.length} complementary niches detected (${complement.slice(0, 3).join(", ")}…) — strong cross-promo potential.`);
  } else {
    reasons.push(`No complementary-niche mapping for "${n}" — cross-promo may require manual research.`);
  }

  // Audience tier affects scoring
  const tierBonus: Record<AudienceTier, number> = {
    "micro-1k-10k": 15,
    "mid-10k-100k": 12,
    "macro-100k-1M": 5,
    "mega-1M+": -5,
  };
  score += tierBonus[audienceTier];
  reasons.push(`${AUDIENCE_LABELS[audienceTier]} audience tier — ${tierBonus[audienceTier] >= 0 ? "high conversion / lower cost" : "high reach / higher cost & competition"}.`);

  score = Math.max(0, Math.min(100, score));
  const level: PartnershipMatch["level"] = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  return { score, level, reasons };
}

// ---- Cross-promotion partner finder ----

export function findCrossPromoPartners(niche: string): CrossPromoPartner[] {
  const n = normalizeString(niche).toLowerCase();
  if (!n) return [];
  const list = COMPLEMENTARY_NICHES[n];
  if (!list || list.length === 0) {
    return [{
      niche: "(general)",
      reason: `No built-in mapping for "${niche}". Consider brands that share your audience's lifecycle (e.g., a brand your customers buy before or after yours).`,
    }];
  }
  return list.map((m) => ({
    niche: m,
    reason: `Audiences for "${n}" often overlap with "${m}" — co-marketing typically converts well.`,
  }));
}

// ---- Affiliate program structure suggester ----

export function suggestAffiliateProgram(tier: AudienceTier, niche: string): AffiliateProgram {
  const preset = AFFILIATE_PRESETS[tier];
  const nicheLabel = normalizeString(niche) || "your niche";
  return {
    commissionPct: preset.commissionPct,
    cookieDurationDays: preset.cookieDays,
    payoutTerms: `Net-30 payout via PayPal or bank transfer once a $50 minimum threshold is reached. Affiliates in ${nicheLabel} receive a custom referral link and 30-day dashboard access.`,
    notes: `Suggested for ${AUDIENCE_LABELS[tier]} creators. Higher commissions and longer cookie windows for smaller creators typically drive stronger activation; consider bonuses for top performers.`,
  };
}

// ---- Sponsored content brief template (per platform) ----

export function generateSponsoredBriefs(
  platforms: TargetPlatform[],
  input: CollabInput,
): SponsoredBrief[] {
  const brand = normalizeString(input.yourBrand) || "Your Brand";
  const niche = normalizeString(input.yourNiche) || "your niche";
  const valueProp = normalizeString(input.yourValueProp) || "see brand brief";
  const tier = AUDIENCE_LABELS[input.audienceSizeTarget];
  const out: SponsoredBrief[] = [];

  const byPlatform: Record<TargetPlatform, Omit<SponsoredBrief, "platform">> = {
    instagram: {
      deliverables: ["1 in-feed post (1080×1350)", "1 Story sequence (4–6 frames) with link sticker", "1 Reel (15–30s) using brand audio"],
      timeline: "Brief within 5 business days · live within 14 days · 30-day paid amplification window",
      keyMessages: [valueProp, `Tag @${brand.toLowerCase().replace(/\s+/g, "")} and use #ad`, "Mention one specific benefit you experienced"],
      disclosure: "Use Instagram's Paid Partnership tag and include #ad in the caption (FTC requirement).",
    },
    youtube: {
      deliverables: ["1 dedicated integration (60–90s)", "1 pinned comment with link", "1 mention in description with affiliate link"],
      timeline: "Script approval within 5 days · publish within 21 days · evergreen (no takedown)",
      keyMessages: [valueProp, "Screen recording or product b-roll during integration", "Call-to-action: 'Check the link in the description'"],
      disclosure: "Verbal disclosure at start of integration + on-screen text 'Sponsored by [brand]' + description disclosure.",
    },
    tiktok: {
      deliverables: ["1 in-feed TikTok (15–60s)", "1 caption with hashtag challenge", "1 Branded Effect (optional, additional fee)"],
      timeline: "Brief within 3 days · publish within 10 days · keep live for 90 days",
      keyMessages: [valueProp, "Hook in first 2 seconds", "Use trending sound + branded hashtag"],
      disclosure: "Use TikTok Branded Content toggle + #ad in caption (FTC + TikTok policy).",
    },
    twitter: {
      deliverables: ["1 main tweet (280 chars)", "1 threaded reply (3–5 tweets)", "1 quote-tweet of brand announcement"],
      timeline: "Brief within 2 days · publish within 7 days · pin for 48 hours",
      keyMessages: [valueProp, "Include 1–2 hashtags only", "Link to landing page with UTM"],
      disclosure: "Begin tweet with '#ad:' or '#sponsored:' (FTC requirement).",
    },
    blog: {
      deliverables: ["1 dedicated blog post (800–1,500 words)", "2 do-follow links (where permitted)", "1 product image or screenshot"],
      timeline: "Outline within 5 days · draft within 14 days · publish within 21 days · keep live for 12 months",
      keyMessages: [valueProp, "Personal experience / case study angle", "Comparison to alternatives where relevant"],
      disclosure: "Add a clear 'Sponsored post by [brand]' disclosure at the top of the post (FTC + Google policy).",
    },
  };

  for (const p of platforms) {
    out.push({ platform: p, ...byPlatform[p] });
  }
  return out;
}

// ---- Giveaway collab planner ----

export function planGiveawayCollab(input: CollabInput): GiveawayPlan {
  const brand = normalizeString(input.yourBrand) || "Your Brand";
  const niche = normalizeString(input.yourNiche) || "your niche";
  const valueProp = normalizeString(input.yourValueProp) || "giveaway prize";
  const budget = normalizeString(input.budgetRange) || "to be confirmed";
  return {
    prizeSplit: `${brand} provides the prize (${valueProp}). Co-host creator receives either a flat fee (${budget}) or a guaranteed minimum number of new followers (track via unique hashtag + entry form).`,
    mechanics: [
      "Follow both @brand and @creator",
      "Like the giveaway post",
      "Tag 2 friends in the comments (1 entry per tag, max 5)",
      "Share to stories and tag both accounts for +5 bonus entries",
      `Submit entry via the linked form to verify eligibility (${niche})`,
    ],
    promotionSchedule: [
      "Day 0: Co-launch post on both accounts (cross-tag)",
      "Day 3: Creator reminder post + story sequence",
      "Day 6: Last-chance reminder + entry deadline countdown",
      "Day 7: Winner announced on both accounts; tag winner and DM prize-claim instructions",
    ],
    rules: `Open to ${AUDIENCE_LABELS[input.audienceSizeTarget]} audiences in ${niche}. Must be 18+ (or 13+ with guardian consent where permitted). Not sponsored, endorsed, or administered by any social media platform. Winner selected via random draw within 7 days of close. Void where prohibited.`,
  };
}

// ---- Value prop formatter ----

export function formatValueProp(valueProp: string): string {
  const v = normalizeString(valueProp);
  if (!v) return "We'd love to collaborate on a campaign that benefits both audiences.";
  // Compress to a single sentence if long
  if (v.length > 160) {
    const firstSentence = v.split(/[.!?\n]/)[0] ?? v;
    const trimmed = firstSentence.length > 160 ? firstSentence.slice(0, 157) + "…" : firstSentence;
    return trimmed.endsWith(".") ? trimmed : trimmed + ".";
  }
  return v.endsWith(".") ? v : v + ".";
}

// ---- Follow-up sequence generator ----

export function generateFollowUpSequence(input: CollabInput): FollowUpEmail[] {
  const brand = normalizeString(input.yourBrand) || "Your Brand";
  const niche = normalizeString(input.yourNiche) || "your niche";
  return [
    {
      step: 1,
      waitDays: 3,
      subject: `Re: ${brand} collab — quick bump`,
      body: `Hi [Name],\n\nJust bumping this in case it slipped through. Really enjoyed your recent ${niche} content and would love to chat about a collab. Happy to send a 1-pager if that's easier.\n\nThanks!\n[Your Name]`,
    },
    {
      step: 2,
      waitDays: 7,
      subject: `Re: ${brand} collab — last note`,
      body: `Hi [Name],\n\nLast note from me on this one. If timing isn't right, no worries — happy to circle back next quarter. If you are interested, here's a 15-min slot I can hold: [Calendar link].\n\nBest,\n[Your Name]`,
    },
    {
      step: 3,
      waitDays: 14,
      subject: `A different idea for ${brand} × you`,
      body: `Hi [Name],\n\nSince the original collab didn't land — would you be open to a smaller ask? We could start with a single Story or a 30-second Reel. Lower lift, same audience.\n\nLet me know if that's more interesting.\n[Your Name]`,
    },
  ];
}

// ---- Compensation calculator ----

export function computeCompensation(
  collabType: CollabType,
  tier: AudienceTier,
): CompensationEstimate {
  const [low, mid, high] = COMPENSATION_TABLE[collabType][tier];
  const notes = collabType === "affiliate"
    ? "Affiliate partnerships are commission-only — no fixed fee. Total compensation depends entirely on sales driven."
    : `Estimates are market-rate ranges for ${COLLAB_TYPE_LABELS[collabType]} with ${AUDIENCE_LABELS[tier]} creators. Always confirm actual rates per creator — engagement rate, niche, and exclusivity all affect pricing.`;
  return { low, mid, high, currency: "USD", notes };
}

// ---- Summary stats ----

export function computeSummary(
  input: CollabInput,
  ctx: {
    searchQueries: SearchQuery[];
    partnershipMatch: PartnershipMatch;
    compensation: CompensationEstimate;
  },
): CollabSummary {
  return {
    totalOutreachTargets: ctx.searchQueries.length,
    platformsCount: input.targetPlatforms.length,
    collabTypesCount: COLLAB_TYPES.length,
    audienceTiersCount: AUDIENCE_TIERS.length,
    partnershipScore: ctx.partnershipMatch.score,
    estimatedCompLow: ctx.compensation.low,
    estimatedCompHigh: ctx.compensation.high,
  };
}

// ---- Build collab plan (orchestration) ----

export function buildCollab(input: CollabInput): GeneratedCollab {
  const searchQueries = generateInfluencerQueries(input.yourNiche, input.targetPlatforms);
  const outreachEmail = generateOutreachEmail(input);
  const partnershipMatch = matchBrandPartnership(input.yourBrand, input.yourNiche, input.audienceSizeTarget);
  const crossPromoPartners = findCrossPromoPartners(input.yourNiche);
  const affiliateProgram = suggestAffiliateProgram(input.audienceSizeTarget, input.yourNiche);
  const sponsoredBriefs = generateSponsoredBriefs(input.targetPlatforms, input);
  const giveawayPlan = planGiveawayCollab(input);
  const valuePropFormatted = formatValueProp(input.yourValueProp);
  const followUps = generateFollowUpSequence(input);
  const compensation = computeCompensation(input.collabType, input.audienceSizeTarget);
  const summary = computeSummary(input, { searchQueries, partnershipMatch, compensation });
  return {
    input, searchQueries, outreachEmail, partnershipMatch, crossPromoPartners,
    affiliateProgram, sponsoredBriefs, giveawayPlan, valuePropFormatted,
    followUps, compensation, summary,
  };
}

// ---- Renderers ----

export function renderText(c: GeneratedCollab): string {
  const lines: string[] = [];
  lines.push(`COLLAB OUTREACH PLAN — ${c.input.yourBrand || "Your Brand"}`);
  lines.push(`Niche: ${c.input.yourNiche || "—"}`);
  lines.push(`Collab type: ${COLLAB_TYPE_LABELS[c.input.collabType]}`);
  lines.push(`Audience tier: ${AUDIENCE_LABELS[c.input.audienceSizeTarget]}`);
  lines.push(`Target platforms: ${c.input.targetPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ") || "—"}`);
  lines.push(`Budget: ${c.input.budgetRange || "—"}`);
  lines.push(`Value prop: ${c.valuePropFormatted}`);
  lines.push("");
  lines.push("PARTNERSHIP MATCH");
  lines.push(`Score: ${c.partnershipMatch.score}/100 (${c.partnershipMatch.level})`);
  lines.push(...c.partnershipMatch.reasons.map((r) => `- ${r}`));
  lines.push("");
  lines.push("INFLUENCER SEARCH QUERIES");
  if (c.searchQueries.length === 0) {
    lines.push("(none — provide a niche and at least one target platform)");
  } else {
    lines.push(...c.searchQueries.map((q) => `- [${PLATFORM_LABELS[q.platform]}] ${q.query}`));
  }
  lines.push("");
  lines.push("OUTREACH EMAIL");
  lines.push(`Subject: ${c.outreachEmail.subject}`);
  lines.push("");
  lines.push(c.outreachEmail.body);
  lines.push("");
  lines.push("CROSS-PROMO PARTNER NICHES");
  lines.push(...c.crossPromoPartners.map((p) => `- ${p.niche}: ${p.reason}`));
  lines.push("");
  if (c.input.collabType === "affiliate") {
    lines.push("AFFILIATE PROGRAM STRUCTURE");
    lines.push(`Commission: ${c.affiliateProgram.commissionPct}% per sale`);
    lines.push(`Cookie duration: ${c.affiliateProgram.cookieDurationDays} days`);
    lines.push(`Payout: ${c.affiliateProgram.payoutTerms}`);
    lines.push(`Notes: ${c.affiliateProgram.notes}`);
    lines.push("");
  }
  if (c.sponsoredBriefs.length > 0) {
    lines.push("SPONSORED CONTENT BRIEFS");
    for (const b of c.sponsoredBriefs) {
      lines.push(`-- ${PLATFORM_LABELS[b.platform]} --`);
      lines.push("Deliverables:");
      lines.push(...b.deliverables.map((d) => `  - ${d}`));
      lines.push(`Timeline: ${b.timeline}`);
      lines.push("Key messages:");
      lines.push(...b.keyMessages.map((m) => `  - ${m}`));
      lines.push(`Disclosure: ${b.disclosure}`);
      lines.push("");
    }
  }
  if (c.input.collabType === "giveaway-collab") {
    lines.push("GIVEAWAY PLAN");
    lines.push(`Prize split: ${c.giveawayPlan.prizeSplit}`);
    lines.push("Mechanics:");
    lines.push(...c.giveawayPlan.mechanics.map((m) => `- ${m}`));
    lines.push("Promotion schedule:");
    lines.push(...c.giveawayPlan.promotionSchedule.map((m) => `- ${m}`));
    lines.push(`Rules: ${c.giveawayPlan.rules}`);
    lines.push("");
  }
  lines.push("FOLLOW-UP SEQUENCE");
  for (const f of c.followUps) {
    lines.push(`Step ${f.step} (after ${f.waitDays} days):`);
    lines.push(`  Subject: ${f.subject}`);
    lines.push(`  ${f.body.replace(/\n/g, "\n  ")}`);
    lines.push("");
  }
  lines.push("COMPENSATION ESTIMATE");
  if (c.compensation.low === 0 && c.compensation.high === 0) {
    lines.push("Commission-only (no fixed fee).");
  } else {
    lines.push(`Estimated range: $${c.compensation.low} – $${c.compensation.high} ${c.compensation.currency} (mid: $${c.compensation.mid})`);
  }
  lines.push(c.compensation.notes);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`Outreach targets: ${c.summary.totalOutreachTargets}`);
  lines.push(`Platforms selected: ${c.summary.platformsCount}`);
  lines.push(`Available collab types: ${c.summary.collabTypesCount}`);
  lines.push(`Available audience tiers: ${c.summary.audienceTiersCount}`);
  lines.push(`Partnership score: ${c.summary.partnershipScore}/100`);
  if (c.summary.estimatedCompLow === 0 && c.summary.estimatedCompHigh === 0) {
    lines.push("Compensation: commission-only");
  } else {
    lines.push(`Compensation estimate: $${c.summary.estimatedCompLow} – $${c.summary.estimatedCompHigh}`);
  }
  return lines.join("\n");
}

export function renderCsv(c: GeneratedCollab): string {
  const rows: Array<[string, string]> = [
    ["your_brand", c.input.yourBrand],
    ["your_niche", c.input.yourNiche],
    ["collab_type", c.input.collabType],
    ["target_platforms", c.input.targetPlatforms.join("|")],
    ["audience_tier", c.input.audienceSizeTarget],
    ["budget_range", c.input.budgetRange],
    ["value_prop_formatted", c.valuePropFormatted],
    ["partnership_score", String(c.partnershipMatch.score)],
    ["partnership_level", c.partnershipMatch.level],
    ["search_query_count", String(c.searchQueries.length)],
    ["cross_promo_partners", c.crossPromoPartners.map((p) => p.niche).join("|")],
    ["affiliate_commission_pct", String(c.affiliateProgram.commissionPct)],
    ["affiliate_cookie_days", String(c.affiliateProgram.cookieDurationDays)],
    ["sponsored_brief_platforms", c.sponsoredBriefs.map((b) => b.platform).join("|")],
    ["followup_steps", String(c.followUps.length)],
    ["compensation_low_usd", String(c.compensation.low)],
    ["compensation_mid_usd", String(c.compensation.mid)],
    ["compensation_high_usd", String(c.compensation.high)],
    ["outreach_email_subject", c.outreachEmail.subject],
    ["outreach_email_body", c.outreachEmail.body],
  ];
  const lines = ["component,value"];
  for (const [k, v] of rows) lines.push(`${k},${escapeCsv(v)}`);
  return lines.join("\n");
}

/** Render the outreach-tracker CSV template (extra feature #18). */
export function renderTrackerCsv(): string {
  const header = "contact_name,handle,platform,niche,audience_size,collab_type,first_contact_date,status,response_date,notes";
  const sample = [
    "Jane Doe,@janedoe,instagram,fitness,25000,influencer-outreach,2024-07-01,sent,,awaiting reply",
    "Acme Co,acme@example.com,blog,tech,80000,brand-partnership,2024-07-02,replied,2024-07-05,interested — sent brief",
  ];
  return [header, ...sample].join("\n");
}

export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-collab-finder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  yourBrand: string;
  yourNiche: string;
  collabType: CollabType;
  audienceSizeTarget: AudienceTier;
  budgetRange: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: CollabInput): string {
  const params = new URLSearchParams();
  if (input.yourBrand) params.set("brand", input.yourBrand);
  if (input.yourNiche) params.set("niche", input.yourNiche);
  params.set("type", input.collabType);
  if (input.targetPlatforms.length > 0) params.set("platforms", input.targetPlatforms.join(","));
  params.set("tier", input.audienceSizeTarget);
  if (input.budgetRange) params.set("budget", input.budgetRange);
  if (input.yourValueProp) params.set("vp", input.yourValueProp);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CollabInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<CollabInput> = {};
  const brand = params.get("brand");
  if (brand) out.yourBrand = brand;
  const niche = params.get("niche");
  if (niche) out.yourNiche = niche;
  const type = params.get("type");
  if (type && COLLAB_TYPES.includes(type as CollabType)) out.collabType = type as CollabType;
  const platformsStr = params.get("platforms");
  if (platformsStr) {
    const platforms = platformsStr
      .split(",")
      .filter((p) => TARGET_PLATFORMS.includes(p as TargetPlatform)) as TargetPlatform[];
    if (platforms.length > 0) out.targetPlatforms = platforms;
  }
  const tier = params.get("tier");
  if (tier && AUDIENCE_TIERS.includes(tier as AudienceTier)) out.audienceSizeTarget = tier as AudienceTier;
  const budget = params.get("budget");
  if (budget) out.budgetRange = budget;
  const vp = params.get("vp");
  if (vp) out.yourValueProp = vp;
  return out;
}
