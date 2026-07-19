import { describe, it, expect, beforeEach } from "vitest";
import {
  COLLAB_TYPES,
  TARGET_PLATFORMS,
  AUDIENCE_TIERS,
  COLLAB_TYPE_LABELS,
  PLATFORM_LABELS,
  AUDIENCE_LABELS,
  PLATFORM_FOOTPRINTS,
  COMPLEMENTARY_NICHES,
  AFFILIATE_PRESETS,
  COMPENSATION_TABLE,
  normalizeString,
  buildGoogleUrl,
  generateInfluencerQueries,
  generateOutreachEmail,
  matchBrandPartnership,
  findCrossPromoPartners,
  suggestAffiliateProgram,
  generateSponsoredBriefs,
  planGiveawayCollab,
  formatValueProp,
  generateFollowUpSequence,
  computeCompensation,
  computeSummary,
  buildCollab,
  renderText,
  renderCsv,
  renderTrackerCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CollabType,
  type TargetPlatform,
  type AudienceTier,
  type CollabInput,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

const baseInput: CollabInput = {
  yourBrand: "Acme Fitness",
  yourNiche: "fitness",
  collabType: "influencer-outreach",
  targetPlatforms: ["instagram", "youtube", "tiktok"],
  audienceSizeTarget: "mid-10k-100k",
  budgetRange: "$500-$2000",
  yourValueProp: "We'd love to send you our new smart jump rope in exchange for an honest review.",
};

describe("collab-finder constants", () => {
  it("has 6 collab types", () => {
    expect(COLLAB_TYPES).toHaveLength(6);
    expect(COLLAB_TYPES).toContain("influencer-outreach");
    expect(COLLAB_TYPES).toContain("giveaway-collab");
  });
  it("has 5 target platforms", () => {
    expect(TARGET_PLATFORMS).toHaveLength(5);
    expect(TARGET_PLATFORMS).toContain("blog");
  });
  it("has 4 audience tiers", () => {
    expect(AUDIENCE_TIERS).toHaveLength(4);
    expect(AUDIENCE_TIERS).toContain("mega-1M+");
  });
  it("has labels for all collab types", () => {
    for (const t of COLLAB_TYPES) expect(COLLAB_TYPE_LABELS[t]).toBeTruthy();
  });
  it("has labels for all platforms", () => {
    for (const p of TARGET_PLATFORMS) expect(PLATFORM_LABELS[p]).toBeTruthy();
  });
  it("has labels for all audience tiers", () => {
    for (const t of AUDIENCE_TIERS) expect(AUDIENCE_LABELS[t]).toBeTruthy();
  });
  it("has footprints for every platform (≥3 each)", () => {
    for (const p of TARGET_PLATFORMS) {
      expect(PLATFORM_FOOTPRINTS[p].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has complementary niches for fitness, tech, etc.", () => {
    expect(COMPLEMENTARY_NICHES.fitness.length).toBeGreaterThan(0);
    expect(COMPLEMENTARY_NICHES.tech.length).toBeGreaterThan(0);
  });
  it("has affiliate presets for every audience tier", () => {
    for (const t of AUDIENCE_TIERS) {
      expect(AFFILIATE_PRESETS[t].commissionPct).toBeGreaterThan(0);
      expect(AFFILIATE_PRESETS[t].cookieDays).toBeGreaterThan(0);
    }
  });
  it("has compensation table for every collab type × audience tier", () => {
    for (const c of COLLAB_TYPES) {
      for (const t of AUDIENCE_TIERS) {
        expect(COMPENSATION_TABLE[c][t]).toBeTruthy();
        expect(COMPENSATION_TABLE[c][t].length).toBe(3);
      }
    }
  });
});

describe("collab-finder normalizeString", () => {
  it("collapses whitespace", () => {
    expect(normalizeString("  Best   Brand  ")).toBe("Best Brand");
  });
  it("handles empty", () => {
    expect(normalizeString("")).toBe("");
  });
});

describe("collab-finder buildGoogleUrl", () => {
  it("encodes query", () => {
    const url = buildGoogleUrl('fitness "influencer"');
    expect(url).toContain("https://www.google.com/search?q=");
    expect(url).toContain(encodeURIComponent('fitness "influencer"'));
  });
});

describe("collab-finder generateInfluencerQueries", () => {
  it("generates queries per platform", () => {
    const qs = generateInfluencerQueries("fitness", ["instagram", "youtube"]);
    expect(qs.length).toBe(PLATFORM_FOOTPRINTS.instagram.length + PLATFORM_FOOTPRINTS.youtube.length);
    expect(qs.every((q) => q.googleUrl.startsWith("https://www.google.com/search?q="))).toBe(true);
  });
  it("substitutes niche placeholder", () => {
    const qs = generateInfluencerQueries("fitness", ["blog"]);
    expect(qs.every((q) => !q.query.includes("{niche}"))).toBe(true);
    expect(qs.some((q) => q.query.includes("fitness"))).toBe(true);
  });
  it("returns empty for empty niche", () => {
    expect(generateInfluencerQueries("", ["instagram"])).toEqual([]);
  });
  it("returns empty for empty platforms", () => {
    expect(generateInfluencerQueries("fitness", [])).toEqual([]);
  });
});

describe("collab-finder generateOutreachEmail", () => {
  it("generates subject and body per collab type", () => {
    for (const t of COLLAB_TYPES) {
      const e = generateOutreachEmail({ ...baseInput, collabType: t });
      expect(e.subject.length).toBeGreaterThan(0);
      expect(e.body.length).toBeGreaterThan(50);
      expect(e.body).toContain("[Name]");
    }
  });
  it("includes brand name in subject", () => {
    const e = generateOutreachEmail(baseInput);
    expect(e.subject).toContain("Acme Fitness");
  });
  it("includes audience tier label in body", () => {
    const e = generateOutreachEmail(baseInput);
    expect(e.body).toContain(AUDIENCE_LABELS[baseInput.audienceSizeTarget]);
  });
  it("falls back to defaults for empty brand/niche", () => {
    const e = generateOutreachEmail({
      ...baseInput,
      yourBrand: "",
      yourNiche: "",
      yourValueProp: "",
      budgetRange: "",
    });
    expect(e.subject.length).toBeGreaterThan(0);
    expect(e.body.length).toBeGreaterThan(50);
  });
  it("includes affiliate commission when collab type is affiliate", () => {
    const e = generateOutreachEmail({ ...baseInput, collabType: "affiliate" });
    const preset = AFFILIATE_PRESETS[baseInput.audienceSizeTarget];
    expect(e.body).toContain(`${preset.commissionPct}%`);
    expect(e.body).toContain(`${preset.cookieDays}-day`);
  });
});

describe("collab-finder matchBrandPartnership", () => {
  it("returns score 0-100 with level and reasons", () => {
    const m = matchBrandPartnership("Acme", "fitness", "mid-10k-100k");
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(m.level);
    expect(m.reasons.length).toBeGreaterThan(0);
  });
  it("gives higher score for known complementary niche than unknown", () => {
    const known = matchBrandPartnership("Acme", "fitness", "mid-10k-100k");
    const unknown = matchBrandPartnership("Acme", "quantum-baking", "mid-10k-100k");
    expect(known.score).toBeGreaterThan(unknown.score);
  });
  it("rewards micro tier over mega tier", () => {
    const micro = matchBrandPartnership("Acme", "fitness", "micro-1k-10k");
    const mega = matchBrandPartnership("Acme", "fitness", "mega-1M+");
    expect(micro.score).toBeGreaterThan(mega.score);
  });
  it("includes brand and niche in reasons when provided", () => {
    const m = matchBrandPartnership("Acme", "fitness", "mid-10k-100k");
    expect(m.reasons.some((r) => r.includes("Acme"))).toBe(true);
    expect(m.reasons.some((r) => r.includes("fitness"))).toBe(true);
  });
});

describe("collab-finder findCrossPromoPartners", () => {
  it("returns partners for known niche", () => {
    const partners = findCrossPromoPartners("fitness");
    expect(partners.length).toBeGreaterThan(0);
    expect(partners.some((p) => p.niche === "nutrition")).toBe(true);
  });
  it("returns fallback for unknown niche", () => {
    const partners = findCrossPromoPartners("quantum-baking");
    expect(partners.length).toBe(1);
    expect(partners[0].reason).toContain("No built-in mapping");
  });
  it("returns empty for empty niche", () => {
    expect(findCrossPromoPartners("")).toEqual([]);
  });
});

describe("collab-finder suggestAffiliateProgram", () => {
  it("returns commission, cookie, payout, notes", () => {
    const a = suggestAffiliateProgram("mid-10k-100k", "fitness");
    expect(a.commissionPct).toBe(AFFILIATE_PRESETS["mid-10k-100k"].commissionPct);
    expect(a.cookieDurationDays).toBe(AFFILIATE_PRESETS["mid-10k-100k"].cookieDays);
    expect(a.payoutTerms.length).toBeGreaterThan(0);
    expect(a.notes.length).toBeGreaterThan(0);
  });
  it("decreases commission as audience tier grows", () => {
    const micro = suggestAffiliateProgram("micro-1k-10k", "fitness");
    const mega = suggestAffiliateProgram("mega-1M+", "fitness");
    expect(micro.commissionPct).toBeGreaterThan(mega.commissionPct);
  });
});

describe("collab-finder generateSponsoredBriefs", () => {
  it("produces a brief per platform", () => {
    const briefs = generateSponsoredBriefs(["instagram", "youtube"], baseInput);
    expect(briefs).toHaveLength(2);
    expect(briefs[0].deliverables.length).toBeGreaterThan(0);
    expect(briefs[0].timeline.length).toBeGreaterThan(0);
    expect(briefs[0].keyMessages.length).toBeGreaterThan(0);
    expect(briefs[0].disclosure).toContain("FTC");
  });
  it("returns empty for empty platforms", () => {
    expect(generateSponsoredBriefs([], baseInput)).toEqual([]);
  });
  it("each platform brief has a disclosure", () => {
    const briefs = generateSponsoredBriefs(TARGET_PLATFORMS, baseInput);
    expect(briefs.every((b) => b.disclosure.length > 0)).toBe(true);
  });
});

describe("collab-finder planGiveawayCollab", () => {
  it("produces prize split, mechanics, schedule, rules", () => {
    const plan = planGiveawayCollab(baseInput);
    expect(plan.prizeSplit.length).toBeGreaterThan(0);
    expect(plan.mechanics.length).toBeGreaterThanOrEqual(3);
    expect(plan.promotionSchedule.length).toBeGreaterThan(0);
    expect(plan.rules).toContain("Not sponsored");
  });
  it("rules include audience tier label", () => {
    const plan = planGiveawayCollab(baseInput);
    expect(plan.rules).toContain(AUDIENCE_LABELS[baseInput.audienceSizeTarget]);
  });
});

describe("collab-finder formatValueProp", () => {
  it("adds trailing period if missing", () => {
    expect(formatValueProp("We offer a free trial")).toBe("We offer a free trial.");
  });
  it("truncates long value props", () => {
    const long = "A".repeat(200);
    const f = formatValueProp(long);
    expect(f.length).toBeLessThanOrEqual(160);
    expect(f.endsWith("…") || f.endsWith(".")).toBe(true);
  });
  it("returns fallback for empty", () => {
    const f = formatValueProp("");
    expect(f.length).toBeGreaterThan(0);
  });
});

describe("collab-finder generateFollowUpSequence", () => {
  it("returns exactly 3 follow-ups with increasing wait days", () => {
    const seq = generateFollowUpSequence(baseInput);
    expect(seq).toHaveLength(3);
    expect(seq[0].waitDays).toBeLessThan(seq[1].waitDays);
    expect(seq[1].waitDays).toBeLessThan(seq[2].waitDays);
  });
  it("each follow-up has subject and body", () => {
    const seq = generateFollowUpSequence(baseInput);
    for (const f of seq) {
      expect(f.subject.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(20);
    }
  });
});

describe("collab-finder computeCompensation", () => {
  it("returns low <= mid <= high", () => {
    const c = computeCompensation("influencer-outreach", "mid-10k-100k");
    expect(c.low).toBeLessThanOrEqual(c.mid);
    expect(c.mid).toBeLessThanOrEqual(c.high);
  });
  it("returns 0/0/0 for affiliate", () => {
    const c = computeCompensation("affiliate", "mid-10k-100k");
    expect(c.low).toBe(0);
    expect(c.high).toBe(0);
    expect(c.notes).toContain("commission-only");
  });
  it("compensation grows with audience tier", () => {
    const micro = computeCompensation("sponsored-content", "micro-1k-10k");
    const mega = computeCompensation("sponsored-content", "mega-1M+");
    expect(micro.high).toBeLessThan(mega.high);
  });
});

describe("collab-finder computeSummary", () => {
  it("computes summary stats", () => {
    const c = buildCollab(baseInput);
    expect(c.summary.totalOutreachTargets).toBe(c.searchQueries.length);
    expect(c.summary.platformsCount).toBe(3);
    expect(c.summary.collabTypesCount).toBe(6);
    expect(c.summary.audienceTiersCount).toBe(4);
    expect(c.summary.partnershipScore).toBe(c.partnershipMatch.score);
    expect(c.summary.estimatedCompLow).toBe(c.compensation.low);
    expect(c.summary.estimatedCompHigh).toBe(c.compensation.high);
  });
});

describe("collab-finder buildCollab (orchestration)", () => {
  it("returns full collab object", () => {
    const c = buildCollab(baseInput);
    expect(c.input).toEqual(baseInput);
    expect(c.searchQueries.length).toBeGreaterThan(0);
    expect(c.outreachEmail.body.length).toBeGreaterThan(0);
    expect(c.partnershipMatch.score).toBeGreaterThan(0);
    expect(c.crossPromoPartners.length).toBeGreaterThan(0);
    expect(c.affiliateProgram.commissionPct).toBeGreaterThan(0);
    expect(c.sponsoredBriefs.length).toBe(3);
    expect(c.giveawayPlan.mechanics.length).toBeGreaterThan(0);
    expect(c.valuePropFormatted.length).toBeGreaterThan(0);
    expect(c.followUps).toHaveLength(3);
    expect(c.compensation.currency).toBe("USD");
    expect(c.summary.totalOutreachTargets).toBeGreaterThan(0);
  });
});

describe("collab-finder renderers", () => {
  const c = buildCollab(baseInput);
  it("renderText includes headings", () => {
    const t = renderText(c);
    expect(t).toContain("COLLAB OUTREACH PLAN");
    expect(t).toContain("PARTNERSHIP MATCH");
    expect(t).toContain("OUTREACH EMAIL");
    expect(t).toContain("FOLLOW-UP SEQUENCE");
    expect(t).toContain("COMPENSATION ESTIMATE");
  });
  it("renderCsv has component,value header and rows", () => {
    const csv = renderCsv(c);
    expect(csv.startsWith("component,value")).toBe(true);
    expect(csv).toContain("your_brand");
    expect(csv).toContain("collab_type,influencer-outreach");
    expect(csv).toContain("partnership_score");
  });
  it("renderTrackerCsv produces a CSV template", () => {
    const t = renderTrackerCsv();
    expect(t.startsWith("contact_name,handle,platform")).toBe(true);
    expect(t.split("\n").length).toBeGreaterThanOrEqual(2);
  });
});

describe("collab-finder splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("collab-finder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      yourBrand: "X",
      yourNiche: "fitness",
      collabType: "influencer-outreach",
      audienceSizeTarget: "mid-10k-100k",
      budgetRange: "$100",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        yourBrand: `B${i}`,
        yourNiche: "fitness",
        collabType: "affiliate",
        audienceSizeTarget: "micro-1k-10k",
        budgetRange: "$1",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, yourBrand: "x", yourNiche: "fitness", collabType: "affiliate",
      audienceSizeTarget: "micro-1k-10k", budgetRange: "$1",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("collab-finder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(baseInput);
    expect(url).toContain("brand=Acme");
    expect(url).toContain("type=influencer-outreach");
    expect(url).toContain("tier=mid-10k-100k");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(baseInput);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.yourBrand).toBe("Acme Fitness");
    expect(p.yourNiche).toBe("fitness");
    expect(p.collabType).toBe("influencer-outreach");
    expect(p.targetPlatforms).toEqual(["instagram", "youtube", "tiktok"]);
    expect(p.audienceSizeTarget).toBe("mid-10k-100k");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown types/platforms/tiers", () => {
    const p = parseShareUrl("brand=X&type=unknown&platforms=myspace,vine&tier=huge");
    expect(p.collabType).toBeUndefined();
    expect(p.targetPlatforms).toBeUndefined();
    expect(p.audienceSizeTarget).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused =
  | CollabType | TargetPlatform | AudienceTier;
