import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  CONTEST_TYPES,
  AGE_RESTRICTIONS,
  ENTRY_METHODS,
  PLATFORM_LABELS,
  CONTEST_TYPE_LABELS,
  AGE_LABELS,
  ENTRY_METHOD_LABELS,
  PLATFORM_PRESETS,
  CONTEST_TYPE_PRESETS,
  ENTRIES_PER_ACTION,
  COMPLIANCE_RULES,
  normalizeString,
  parseDate,
  formatDate,
  computeDuration,
  generateHashtag,
  formatPrize,
  generateEntryMechanics,
  checkEligibility,
  suggestWinnerMethods,
  generateDisclaimer,
  generateOfficialRules,
  generatePromotionSchedule,
  checkCompliance,
  computeSummary,
  buildContest,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type ContestType,
  type AgeRestriction,
  type EntryMethod,
  type ContestInput,
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

const baseInput: ContestInput = {
  contestName: "Summer Photo Contest",
  platform: "instagram",
  contestType: "photo-contest",
  prize: "$100 gift card",
  prizeValue: 100,
  startDate: "2024-07-01",
  endDate: "2024-07-15",
  minFollowers: 0,
  ageRestriction: "18+",
  geographicRestriction: "US only",
  entryMethods: ["follow", "like", "comment", "post-with-hashtag", "tag-friends"],
};

describe("contest-planner constants", () => {
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("instagram");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 6 contest types", () => {
    expect(CONTEST_TYPES).toHaveLength(6);
    expect(CONTEST_TYPES).toContain("like-comment-follow");
    expect(CONTEST_TYPES).toContain("video-contest");
  });
  it("has 5 age restrictions", () => {
    expect(AGE_RESTRICTIONS).toHaveLength(5);
    expect(AGE_RESTRICTIONS).toContain("none");
  });
  it("has 7 entry methods", () => {
    expect(ENTRY_METHODS).toHaveLength(7);
    expect(ENTRY_METHODS).toContain("story-mention");
  });
  it("has labels for all platforms", () => {
    for (const p of PLATFORMS) expect(PLATFORM_LABELS[p]).toBeTruthy();
  });
  it("has labels for all contest types", () => {
    for (const t of CONTEST_TYPES) expect(CONTEST_TYPE_LABELS[t]).toBeTruthy();
  });
  it("has labels for all age restrictions", () => {
    for (const a of AGE_RESTRICTIONS) expect(AGE_LABELS[a]).toBeTruthy();
  });
  it("has labels for all entry methods", () => {
    for (const m of ENTRY_METHODS) expect(ENTRY_METHOD_LABELS[m]).toBeTruthy();
  });
  it("has platform presets for all 5 platforms", () => {
    for (const p of PLATFORMS) expect(PLATFORM_PRESETS[p].length).toBeGreaterThan(0);
  });
  it("has contest type presets for all 6 types", () => {
    for (const t of CONTEST_TYPES) expect(CONTEST_TYPE_PRESETS[t].length).toBeGreaterThan(0);
  });
  it("has entries-per-action table for all 6 types", () => {
    for (const t of CONTEST_TYPES) expect(ENTRIES_PER_ACTION[t]).toBeTruthy();
  });
  it("has compliance rules covering each platform", () => {
    for (const p of PLATFORMS) {
      expect(COMPLIANCE_RULES.some((r) => r.platform === p)).toBe(true);
    }
  });
});

describe("contest-planner normalizeString", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeString("  Best   Contest  ")).toBe("Best Contest");
  });
  it("handles empty", () => {
    expect(normalizeString("")).toBe("");
  });
});

describe("contest-planner parseDate / formatDate", () => {
  it("parses YYYY-MM-DD", () => {
    const d = parseDate("2024-07-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(6); // July
    expect(d!.getDate()).toBe(15);
  });
  it("returns null for invalid date strings", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("2024-13-01")).toBeNull();
    expect(parseDate("2024-02-30")).toBeNull();
  });
  it("formatDate round-trips", () => {
    const d = parseDate("2024-07-15")!;
    expect(formatDate(d)).toBe("2024-07-15");
  });
});

describe("contest-planner computeDuration", () => {
  it("computes days inclusive of start", () => {
    const d = computeDuration("2024-07-01", "2024-07-15");
    expect(d.valid).toBe(true);
    expect(d.days).toBe(15);
  });
  it("same day = 1 day", () => {
    const d = computeDuration("2024-07-01", "2024-07-01");
    expect(d.valid).toBe(true);
    expect(d.days).toBe(1);
  });
  it("invalid when end < start", () => {
    const d = computeDuration("2024-07-15", "2024-07-01");
    expect(d.valid).toBe(false);
    expect(d.error).toBeTruthy();
  });
  it("invalid for bad date strings", () => {
    expect(computeDuration("bad", "2024-07-01").valid).toBe(false);
    expect(computeDuration("2024-07-01", "bad").valid).toBe(false);
  });
});

describe("contest-planner generateHashtag", () => {
  it("camelCases name with # prefix", () => {
    const h = generateHashtag("Summer Photo Contest");
    expect(h.hashtag).toBe("#SummerPhotoContest");
    expect(h.valid).toBe(true);
    expect(h.variants.length).toBeGreaterThan(0);
  });
  it("strips non-alphanumerics", () => {
    const h = generateHashtag("Summer 2024!! Photo");
    expect(h.hashtag).toBe("#Summer2024Photo");
  });
  it("returns invalid for empty name", () => {
    const h = generateHashtag("");
    expect(h.hashtag).toBe("");
    expect(h.valid).toBe(false);
  });
  it("flags long hashtags as invalid (>30 chars)", () => {
    const h = generateHashtag("This Is A Very Long Contest Name That Exceeds Thirty Characters");
    expect(h.length).toBeGreaterThan(30);
    expect(h.valid).toBe(false);
  });
});

describe("contest-planner formatPrize", () => {
  it("includes formatted value", () => {
    const p = formatPrize("$100 gift card", 100);
    expect(p.title).toBe("$100 gift card");
    expect(p.valueFormatted).toContain("$100");
    expect(p.retailValue).toBe(100);
    expect(p.description).toContain("Approximate Retail Value");
  });
  it("handles zero value", () => {
    const p = formatPrize("Mystery prize", 0);
    expect(p.retailValue).toBe(0);
    expect(p.valueFormatted).toContain("to be announced");
  });
  it("handles negative as zero", () => {
    const p = formatPrize("Bad", -50);
    expect(p.retailValue).toBe(0);
  });
  it("formats thousands with commas", () => {
    const p = formatPrize("Car", 25000);
    expect(p.valueFormatted).toContain("$25,000");
  });
});

describe("contest-planner generateEntryMechanics", () => {
  it("produces steps with entries per action", () => {
    const m = generateEntryMechanics("photo-contest", ["follow", "like", "post-with-hashtag"]);
    expect(m.steps.length).toBe(3);
    expect(m.maxEntries).toBe(7); // 1 + 1 + 5
    expect(m.entriesPerAction["post-with-hashtag"]).toBe(5);
  });
  it("bonus entries include tag-friends rule when selected", () => {
    const m = generateEntryMechanics("share-tag", ["share", "tag-friends"]);
    expect(m.bonusEntries.some((b) => b.includes("Tag 3 friends"))).toBe(true);
  });
  it("no-methods case yields placeholder step", () => {
    const m = generateEntryMechanics("like-comment-follow", []);
    expect(m.maxEntries).toBe(0);
    expect(m.steps.some((s) => s.includes("No entry methods"))).toBe(true);
  });
  it("defaults unknown action to 1 entry", () => {
    const m = generateEntryMechanics("hashtag-contest", ["story-mention"]);
    expect(m.entriesPerAction["story-mention"]).toBe(1);
  });
});

describe("contest-planner checkEligibility", () => {
  it("passes for valid input", () => {
    const r = checkEligibility(baseInput);
    expect(r.passes).toBe(true);
    expect(r.checks.length).toBeGreaterThan(0);
  });
  it("flags invalid dates", () => {
    const r = checkEligibility({ ...baseInput, startDate: "2024-07-15", endDate: "2024-07-01" });
    expect(r.passes).toBe(false);
    expect(r.checks.some((c) => c.label === "Contest duration" && !c.ok)).toBe(true);
  });
  it("does not flag platform minimum age when age is 13+ or higher", () => {
    const r = checkEligibility({ ...baseInput, ageRestriction: "13+" });
    // All platforms require 13+; 13+ is the floor, so no extra "platform minimum age" check is added.
    expect(r.checks.some((c) => c.label === "Platform minimum age" && !c.ok)).toBe(false);
  });
  it("includes geographic restriction detail", () => {
    const r = checkEligibility(baseInput);
    expect(r.checks.some((c) => c.detail.includes("US only"))).toBe(true);
  });
});

describe("contest-planner suggestWinnerMethods", () => {
  it("returns 3 methods", () => {
    const ms = suggestWinnerMethods("photo-contest");
    expect(ms).toHaveLength(3);
    expect(ms.map((m) => m.id)).toContain("random");
    expect(ms.map((m) => m.id)).toContain("judges-pick");
    expect(ms.map((m) => m.id)).toContain("most-engagement");
  });
  it("recommends judges-pick for UGC", () => {
    const ms = suggestWinnerMethods("user-generated-content");
    expect(ms.find((m) => m.recommended)!.id).toBe("judges-pick");
  });
  it("recommends random for like-comment-follow", () => {
    const ms = suggestWinnerMethods("like-comment-follow");
    expect(ms.find((m) => m.recommended)!.id).toBe("random");
  });
  it("exactly one recommended", () => {
    for (const t of CONTEST_TYPES) {
      const ms = suggestWinnerMethods(t);
      expect(ms.filter((m) => m.recommended)).toHaveLength(1);
    }
  });
});

describe("contest-planner generateDisclaimer", () => {
  it("mentions the platform name", () => {
    const d = generateDisclaimer("instagram");
    expect(d.platform).toBe("instagram");
    expect(d.text).toContain("Instagram");
    expect(d.text).toContain("not sponsored");
  });
  it("works for every platform", () => {
    for (const p of PLATFORMS) {
      const d = generateDisclaimer(p);
      expect(d.text).toContain(PLATFORM_LABELS[p]);
    }
  });
});

describe("contest-planner generateOfficialRules", () => {
  it("produces title and sections", () => {
    const contest = buildContest(baseInput);
    expect(contest.rules.title).toContain("Summer Photo Contest");
    expect(contest.rules.sections.length).toBeGreaterThanOrEqual(8);
    expect(contest.rules.fullText).toContain("Sponsor");
    expect(contest.rules.fullText).toContain("Eligibility");
    expect(contest.rules.fullText).toContain("Disclaimer");
  });
  it("includes hashtag in rules", () => {
    const contest = buildContest(baseInput);
    expect(contest.rules.fullText).toContain(contest.hashtag.hashtag);
  });
});

describe("contest-planner generatePromotionSchedule", () => {
  it("produces a multi-item schedule for 15 days", () => {
    const sched = generatePromotionSchedule("2024-07-01", "2024-07-15");
    expect(sched.length).toBeGreaterThanOrEqual(4);
    expect(sched[0].title).toBe("Launch announcement");
    expect(sched[sched.length - 1].title).toBe("Winner announcement");
  });
  it("returns empty for invalid dates", () => {
    expect(generatePromotionSchedule("bad", "2024-07-15")).toEqual([]);
  });
  it("returns empty when end < start", () => {
    expect(generatePromotionSchedule("2024-07-15", "2024-07-01")).toEqual([]);
  });
});

describe("contest-planner checkCompliance", () => {
  it("returns issues for the selected platform", () => {
    const issues = checkCompliance(baseInput);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.platform === "instagram")).toBe(true);
  });
  it("warns when no free entry path", () => {
    const issues = checkCompliance({ ...baseInput, entryMethods: ["post-with-hashtag"] });
    expect(issues.some((i) => i.message.includes("free") && i.level === "warning")).toBe(true);
  });
  it("warns when hashtag too long", () => {
    const issues = checkCompliance({ ...baseInput, contestName: "This Is A Very Long Contest Name That Exceeds Thirty Characters" });
    expect(issues.some((i) => i.message.includes("shorter hashtag"))).toBe(true);
  });
});

describe("contest-planner computeSummary", () => {
  it("computes summary stats", () => {
    const contest = buildContest(baseInput);
    expect(contest.summary.durationDays).toBe(15);
    expect(contest.summary.prizeValue).toBe(100);
    expect(contest.summary.entryMethodsCount).toBe(5);
    expect(contest.summary.platformsCount).toBe(5);
    expect(contest.summary.contestTypesCount).toBe(6);
    expect(contest.summary.complianceIssues).toBeGreaterThan(0);
  });
});

describe("contest-planner buildContest (orchestration)", () => {
  it("returns a full contest object", () => {
    const contest = buildContest(baseInput);
    expect(contest.input).toEqual(baseInput);
    expect(contest.duration.days).toBe(15);
    expect(contest.hashtag.hashtag).toBe("#SummerPhotoContest");
    expect(contest.mechanics.maxEntries).toBeGreaterThan(0);
    expect(contest.eligibility.checks.length).toBeGreaterThan(0);
    expect(contest.winnerMethods.length).toBe(3);
    expect(contest.rules.fullText).toContain("OFFICIAL RULES");
    expect(contest.schedule.length).toBeGreaterThan(0);
    expect(contest.compliance.length).toBeGreaterThan(0);
  });
});

describe("contest-planner renderers", () => {
  const contest = buildContest(baseInput);
  it("renderText includes headings", () => {
    const t = renderText(contest);
    expect(t).toContain("CONTEST BRIEF");
    expect(t).toContain("OFFICIAL RULES");
    expect(t).toContain(contest.hashtag.hashtag);
  });
  it("renderHtml produces a complete HTML document", () => {
    const h = renderHtml(contest);
    expect(h).toContain("<!DOCTYPE html>");
    expect(h).toContain("</html>");
    expect(h).toContain(contest.input.contestName);
  });
  it("renderMarkdown uses markdown headings", () => {
    const m = renderMarkdown(contest);
    expect(m).toContain("# Summer Photo Contest");
    expect(m).toContain("## Prize");
    expect(m).toContain("## Official Rules");
  });
  it("renderCsv has component,value header and rows", () => {
    const c = renderCsv(contest);
    expect(c.startsWith("component,value")).toBe(true);
    expect(c).toContain("contest_name");
    expect(c).toContain("platform,instagram");
    expect(c).toContain("duration_days,15");
  });
});

describe("contest-planner splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("contest-planner history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      contestName: "X",
      platform: "instagram",
      contestType: "photo-contest",
      prize: "P",
      prizeValue: 50,
      startDate: "2024-01-01",
      endDate: "2024-01-10",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        contestName: `C${i}`,
        platform: "twitter",
        contestType: "hashtag-contest",
        prize: "p",
        prizeValue: 1,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, contestName: "x", platform: "instagram", contestType: "photo-contest",
      prize: "p", prizeValue: 1, startDate: "2024-01-01", endDate: "2024-01-02",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("contest-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(baseInput);
    expect(url).toContain("name=Summer");
    expect(url).toContain("platform=instagram");
    expect(url).toContain("type=photo-contest");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(baseInput);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.contestName).toBe("Summer Photo Contest");
    expect(p.platform).toBe("instagram");
    expect(p.contestType).toBe("photo-contest");
    expect(p.prizeValue).toBe(100);
    expect(p.entryMethods).toEqual(baseInput.entryMethods);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown platforms/types/methods", () => {
    const p = parseShareUrl("name=X&platform=myspace&type=unknown&methods=follow,invalid");
    expect(p.platform).toBeUndefined();
    expect(p.contestType).toBeUndefined();
    expect(p.entryMethods).toEqual(["follow"]);
  });
});

// Suppress unused-import lint
export type _Unused =
  | Platform | ContestType | AgeRestriction | EntryMethod;
