/**
 * Social Media Contest Planner — pure logic.
 *
 * Plan contests/giveaways: official rules, entry mechanics, prizes,
 * duration, eligibility, winner selection, hashtags, disclaimers,
 * promotion schedule, compliance. Pure functions only — no DOM, no network.
 */

export type Platform =
  | "instagram"
  | "twitter"
  | "facebook"
  | "tiktok"
  | "youtube";

export type ContestType =
  | "like-comment-follow"
  | "share-tag"
  | "user-generated-content"
  | "hashtag-contest"
  | "photo-contest"
  | "video-contest";

export type AgeRestriction = "13+" | "16+" | "18+" | "21+" | "none";

export type EntryMethod =
  | "follow"
  | "like"
  | "comment"
  | "share"
  | "tag-friends"
  | "post-with-hashtag"
  | "story-mention";

export interface ContestInput {
  contestName: string;
  platform: Platform;
  contestType: ContestType;
  prize: string;
  prizeValue: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  minFollowers: number;
  ageRestriction: AgeRestriction;
  geographicRestriction: string;
  entryMethods: EntryMethod[];
}

export interface DurationInfo {
  days: number;
  weeks: number;
  valid: boolean;
  error?: string;
}

export interface EntryMechanics {
  steps: string[];
  entriesPerAction: Record<EntryMethod, number>;
  maxEntries: number;
  bonusEntries: string[];
}

export interface PrizeDescription {
  title: string;
  valueFormatted: string;
  retailValue: number;
  description: string;
}

export interface EligibilityResult {
  passes: boolean;
  checks: Array<{ label: string; ok: boolean; detail: string }>;
}

export interface WinnerMethod {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
}

export interface HashtagResult {
  hashtag: string;
  variants: string[];
  length: number;
  valid: boolean;
}

export interface Disclaimer {
  platform: Platform;
  text: string;
}

export interface OfficialRules {
  title: string;
  sections: Array<{ heading: string; body: string }>;
  fullText: string;
}

export interface PromotionScheduleItem {
  day: number;
  date: string;
  title: string;
  description: string;
}

export interface ComplianceIssue {
  level: "warning" | "info";
  platform: Platform;
  message: string;
}

export interface SummaryStats {
  durationDays: number;
  prizeValue: number;
  entryMethodsCount: number;
  platformsCount: number;
  contestTypesCount: number;
  complianceIssues: number;
}

export interface GeneratedContest {
  input: ContestInput;
  duration: DurationInfo;
  hashtag: HashtagResult;
  prize: PrizeDescription;
  mechanics: EntryMechanics;
  eligibility: EligibilityResult;
  winnerMethods: WinnerMethod[];
  disclaimer: Disclaimer;
  rules: OfficialRules;
  schedule: PromotionScheduleItem[];
  compliance: ComplianceIssue[];
  summary: SummaryStats;
}

// ---- Constants / presets ----

export const PLATFORMS: Platform[] = [
  "instagram",
  "twitter",
  "facebook",
  "tiktok",
  "youtube",
];

export const CONTEST_TYPES: ContestType[] = [
  "like-comment-follow",
  "share-tag",
  "user-generated-content",
  "hashtag-contest",
  "photo-contest",
  "video-contest",
];

export const AGE_RESTRICTIONS: AgeRestriction[] = [
  "13+",
  "16+",
  "18+",
  "21+",
  "none",
];

export const ENTRY_METHODS: EntryMethod[] = [
  "follow",
  "like",
  "comment",
  "share",
  "tag-friends",
  "post-with-hashtag",
  "story-mention",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "Twitter / X",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const CONTEST_TYPE_LABELS: Record<ContestType, string> = {
  "like-comment-follow": "Like + Comment + Follow",
  "share-tag": "Share + Tag",
  "user-generated-content": "User-Generated Content",
  "hashtag-contest": "Hashtag Contest",
  "photo-contest": "Photo Contest",
  "video-contest": "Video Contest",
};

export const AGE_LABELS: Record<AgeRestriction, string> = {
  "13+": "13+",
  "16+": "16+",
  "18+": "18+",
  "21+": "21+",
  none: "No age restriction",
};

export const ENTRY_METHOD_LABELS: Record<EntryMethod, string> = {
  follow: "Follow account",
  like: "Like the post",
  comment: "Comment on the post",
  share: "Share the post",
  "tag-friends": "Tag friends",
  "post-with-hashtag": "Post with contest hashtag",
  "story-mention": "Mention in story",
};

// Per-platform presets (default entry methods suggested per platform).
export const PLATFORM_PRESETS: Record<Platform, EntryMethod[]> = {
  instagram: ["follow", "like", "comment", "tag-friends", "story-mention"],
  twitter: ["follow", "like", "share", "comment"],
  facebook: ["like", "comment", "share", "tag-friends"],
  tiktok: ["follow", "like", "comment", "share", "post-with-hashtag"],
  youtube: ["follow", "like", "comment", "share"],
};

// Per-type presets (default entry methods suggested per contest type).
export const CONTEST_TYPE_PRESETS: Record<ContestType, EntryMethod[]> = {
  "like-comment-follow": ["follow", "like", "comment"],
  "share-tag": ["share", "tag-friends"],
  "user-generated-content": ["post-with-hashtag", "follow"],
  "hashtag-contest": ["post-with-hashtag", "follow", "like"],
  "photo-contest": ["post-with-hashtag", "follow", "like"],
  "video-contest": ["post-with-hashtag", "follow", "like"],
};

// Entries-per-action table (per contest type).
export const ENTRIES_PER_ACTION: Record<ContestType, Partial<Record<EntryMethod, number>>> = {
  "like-comment-follow": { follow: 1, like: 1, comment: 2 },
  "share-tag": { share: 2, "tag-friends": 1 },
  "user-generated-content": { "post-with-hashtag": 5, follow: 1 },
  "hashtag-contest": { "post-with-hashtag": 5, follow: 1, like: 1 },
  "photo-contest": { "post-with-hashtag": 5, follow: 1, like: 1 },
  "video-contest": { "post-with-hashtag": 7, follow: 1, like: 1 },
};

// Compliance rules per platform.
export const COMPLIANCE_RULES: Array<{
  platform: Platform;
  level: "warning" | "info";
  message: string;
}> = [
  {
    platform: "instagram",
    level: "info",
    message:
      "Instagram promotion guidelines require a complete release of Instagram by each entrant and acknowledgment that the promotion is not sponsored by, endorsed by, or administered by Instagram.",
  },
  {
    platform: "instagram",
    level: "warning",
    message:
      "Do not encourage inaccurate tagging (e.g., tagging yourself in a photo you are not in). Use a unique contest hashtag instead.",
  },
  {
    platform: "twitter",
    level: "info",
    message:
      "Disclose the contest clearly and require participants to follow Twitter rules. Avoid asking users to spam identical tweets.",
  },
  {
    platform: "facebook",
    level: "warning",
    message:
      "Facebook Pages Policies: promotions must be administered within a Page tab or app, not on a personal timeline. Acknowledge that Facebook is not sponsoring the promotion.",
  },
  {
    platform: "facebook",
    level: "info",
    message:
      "Require entrants to like a Page (not a post) and use a third-party app to collect entries when running sweepstakes.",
  },
  {
    platform: "tiktok",
    level: "info",
    message:
      "Disclose sponsorships clearly (#ad where applicable). TikTok requires a complete release and acknowledgment that the platform does not sponsor the contest.",
  },
  {
    platform: "youtube",
    level: "info",
    message:
      "YouTube Community Guidelines: disclosures are required for paid promotions. Include a clear statement that YouTube is not a sponsor and release YouTube from liability.",
  },
  {
    platform: "youtube",
    level: "warning",
    message:
      "Avoid 'sub-for-sub' schemes and make clear that subscribing is not the only way to enter (offer a free, no-purchase entry path).",
  },
];

// ---- Helpers ----

export function normalizeString(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse a YYYY-MM-DD date string to a Date at local midnight. Returns null if invalid. */
export function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Format a Date back to YYYY-MM-DD. */
export function formatDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compute duration between two dates (inclusive of start day). */
export function computeDuration(start: string, end: string): DurationInfo {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s) return { days: 0, weeks: 0, valid: false, error: "Invalid start date (use YYYY-MM-DD)" };
  if (!e) return { days: 0, weeks: 0, valid: false, error: "Invalid end date (use YYYY-MM-DD)" };
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return { days: 0, weeks: 0, valid: false, error: "End date must be on or after start date" };
  const days = Math.round(ms / 86_400_000) + 1;
  return { days, weeks: days / 7, valid: true };
}

// ---- Hashtag generator ----

/** Generate a unique contest hashtag from the contest name. */
export function generateHashtag(name: string): HashtagResult {
  const cleaned = normalizeString(name);
  if (!cleaned) {
    return { hashtag: "", variants: [], length: 0, valid: false };
  }
  // Strip non-alphanumerics, camelCase by word
  const words = cleaned
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return { hashtag: "", variants: [], length: 0, valid: false };
  }
  const base = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  const main = `#${base}`;
  const variants = [
    main,
    `#${base}Giveaway`,
    `#${base}Contest`,
    `#${words.join("").toLowerCase()}2024`,
    `#${base}Winner`,
  ].slice(0, 5);
  return {
    hashtag: main,
    variants,
    length: main.length,
    valid: main.length <= 30 && main.length > 1,
  };
}

// ---- Prize formatter ----

export function formatPrize(prize: string, value: number): PrizeDescription {
  const title = normalizeString(prize) || "Prize";
  const retail = Number.isFinite(value) && value > 0 ? value : 0;
  const valueFormatted = retail > 0 ? `$${retail.toLocaleString("en-US")} USD retail value` : "Retail value to be announced";
  const description = retail > 0
    ? `${title} (Approximate Retail Value: $${retail.toLocaleString("en-US")} USD). Prize is non-transferable and cannot be substituted for cash equivalent.`
    : `${title}. Prize is non-transferable. Retail value to be announced in official rules.`;
  return { title, valueFormatted, retailValue: retail, description };
}

// ---- Entry mechanics generator ----

export function generateEntryMechanics(
  type: ContestType,
  methods: EntryMethod[],
): EntryMechanics {
  const table = ENTRIES_PER_ACTION[type] || {};
  const steps: string[] = [];
  const entriesPerAction = {} as Record<EntryMethod, number>;
  for (const m of ENTRY_METHODS) entriesPerAction[m] = 0;

  for (const m of methods) {
    const v = table[m] ?? 1;
    entriesPerAction[m] = v;
    steps.push(`${ENTRY_METHOD_LABELS[m]} — ${v} ${v === 1 ? "entry" : "entries"}`);
  }
  if (methods.length === 0) {
    steps.push("No entry methods selected — please select at least one.");
  }
  const maxEntries = Object.values(entriesPerAction).reduce((a, b) => a + b, 0);

  const bonusEntries: string[] = [];
  if (methods.includes("tag-friends")) {
    bonusEntries.push("Tag 3 friends = +1 bonus entry each (max 5 bonus entries).");
  }
  if (methods.includes("share")) {
    bonusEntries.push("Share to your story and tag @yourbrand = +2 bonus entries (once per day).");
  }
  if (methods.includes("post-with-hashtag")) {
    bonusEntries.push("Post a high-quality entry using the contest hashtag = +5 bonus entries.");
  }
  if (bonusEntries.length === 0) {
    bonusEntries.push("No bonus entries configured.");
  }

  return { steps, entriesPerAction, maxEntries, bonusEntries };
}

// ---- Eligibility checker ----

export function checkEligibility(input: ContestInput): EligibilityResult {
  const checks: EligibilityResult["checks"] = [];

  // Followers
  const mf = Math.max(0, Math.floor(input.minFollowers || 0));
  checks.push({
    label: "Minimum followers",
    ok: mf >= 0,
    detail: mf > 0 ? `Entrants must have at least ${mf.toLocaleString("en-US")} followers.` : "No minimum follower requirement.",
  });

  // Age
  const age = input.ageRestriction;
  if (age === "none") {
    checks.push({ label: "Age restriction", ok: true, detail: "Open to all ages (per platform minimums)." });
  } else {
    const minAge = Number(age.replace("+", ""));
    checks.push({
      label: "Age restriction",
      ok: true,
      detail: `Entrants must be ${minAge} years or older.`,
    });
  }

  // Geography
  const geo = normalizeString(input.geographicRestriction);
  checks.push({
    label: "Geographic restriction",
    ok: true,
    detail: geo ? `Open to: ${geo}.` : "Open worldwide (subject to local laws).",
  });

  // Platform minimum age override
  const platformMin: Record<Platform, number> = {
    instagram: 13, twitter: 13, facebook: 13, tiktok: 13, youtube: 13,
  };
  if (age !== "none") {
    const minAge = Number(age.replace("+", ""));
    if (minAge < platformMin[input.platform]) {
      checks.push({
        label: "Platform minimum age",
        ok: false,
        detail: `${PLATFORM_LABELS[input.platform]} requires users to be at least ${platformMin[input.platform]} years old.`,
      });
    }
  }

  // Date validity
  const dur = computeDuration(input.startDate, input.endDate);
  checks.push({
    label: "Contest duration",
    ok: dur.valid && dur.days >= 1,
    detail: dur.valid ? `Contest runs for ${dur.days} day(s).` : (dur.error || "Invalid duration."),
  });

  const passes = checks.every((c) => c.ok);
  return { passes, checks };
}

// ---- Winner selection method suggester ----

export function suggestWinnerMethods(type: ContestType): WinnerMethod[] {
  const base: WinnerMethod[] = [
    {
      id: "random",
      label: "Random draw",
      description: "Use a random winner picker (e.g., random.org, CommentPicker) to select one or more winners from all eligible entries.",
      recommended: true,
    },
    {
      id: "judges-pick",
      label: "Judge's pick",
      description: "A panel of judges scores entries on creativity, originality, and adherence to theme. Highest cumulative score wins.",
      recommended: false,
    },
    {
      id: "most-engagement",
      label: "Most engagement",
      description: "Winner is the entry with the most likes/comments/shares at contest close. Disclose this clearly in rules.",
      recommended: false,
    },
  ];

  // Recommend a particular method per contest type
  const recommendedMap: Record<ContestType, string> = {
    "like-comment-follow": "random",
    "share-tag": "random",
    "user-generated-content": "judges-pick",
    "hashtag-contest": "judges-pick",
    "photo-contest": "judges-pick",
    "video-contest": "judges-pick",
  };

  const recommendedId = recommendedMap[type];
  return base.map((m) => ({ ...m, recommended: m.id === recommendedId }));
}

// ---- Disclaimer generator ----

export function generateDisclaimer(platform: Platform): Disclaimer {
  const name = PLATFORM_LABELS[platform];
  const text = `This promotion is not sponsored, endorsed, administered by, or associated with ${name}. Each entrant completely releases ${name}. By entering, you acknowledge that the promotion is administered by the brand running this contest and that any questions, comments, or complaints must be directed to the brand, not to ${name}.`;
  return { platform, text };
}

// ---- Official rules generator ----

export function generateOfficialRules(input: ContestInput, ctx: {
  duration: DurationInfo;
  hashtag: HashtagResult;
  prize: PrizeDescription;
  mechanics: EntryMechanics;
  eligibility: EligibilityResult;
  winnerMethods: WinnerMethod[];
  disclaimer: Disclaimer;
}): OfficialRules {
  const heading = `OFFICIAL RULES — ${normalizeString(input.contestName) || "Untitled Contest"}`;
  const dates = ctx.duration.valid
    ? `${input.startDate} through ${input.endDate} (${ctx.duration.days} day(s))`
    : "Dates to be confirmed";

  const sections: OfficialRules["sections"] = [
    {
      heading: "1. Sponsor",
      body: `This contest is sponsored by the brand running "${normalizeString(input.contestName)}". Contact the brand for any questions regarding this promotion.`,
    },
    {
      heading: "2. Eligibility",
      body: ctx.eligibility.checks
        .map((c) => `• ${c.label}: ${c.detail}`)
        .join("\n"),
    },
    {
      heading: "3. Contest Period",
      body: `The contest begins on ${dates}. All entries must be received by 11:59 PM in the sponsor's local time on the final day.`,
    },
    {
      heading: "4. How to Enter",
      body: [
        "To enter, complete the following actions on " + PLATFORM_LABELS[input.platform] + ":",
        ...ctx.mechanics.steps.map((s) => `• ${s}`),
        "",
        "Bonus entries:",
        ...ctx.mechanics.bonusEntries.map((b) => `• ${b}`),
        "",
        `Use the official contest hashtag: ${ctx.hashtag.hashtag}`,
        `Maximum entries per person: ${ctx.mechanics.maxEntries}.`,
      ].join("\n"),
    },
    {
      heading: "5. Prize",
      body: ctx.prize.description,
    },
    {
      heading: "6. Winner Selection",
      body: ctx.winnerMethods
        .map((m) => `• ${m.label}${m.recommended ? " (recommended)" : ""}: ${m.description}`)
        .join("\n"),
    },
    {
      heading: "7. Winner Notification",
      body: "Winner(s) will be notified within 7 days of the contest close via direct message or comment from the official brand account. Winner(s) must respond within 48 hours or an alternate winner will be selected.",
    },
    {
      heading: "8. Release & Disclaimer",
      body: ctx.disclaimer.text,
    },
    {
      heading: "9. Privacy",
      body: "By entering, you grant the sponsor permission to use your entry (excluding UGC, see below) for promotional purposes. Personal information collected (e.g., DM contact) is used solely to administer this contest.",
    },
    {
      heading: "10. General Conditions",
      body: "Sponsor reserves the right to cancel, suspend, or modify the contest if any fraud, technical failures, or any other factor beyond the sponsor's reasonable control impairs the integrity of the contest. Void where prohibited.",
    },
  ];

  const fullText = [
    heading,
    "",
    ...sections.flatMap((s) => [s.heading, s.body, ""]),
  ].join("\n").trim();

  return { title: heading, sections, fullText };
}

// ---- Promotion schedule ----

export function generatePromotionSchedule(start: string, end: string): PromotionScheduleItem[] {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return [];
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return [];
  const totalDays = Math.round(ms / 86_400_000) + 1;
  const out: PromotionScheduleItem[] = [];
  // Adds an item at the given day offset; offsets past the end date are allowed
  // only when explicitly marked (used for the winner-announcement post).
  const addDay = (offset: number, title: string, description: string, allowPastEnd = false) => {
    const dt = new Date(s.getTime() + offset * 86_400_000);
    if (!allowPastEnd && dt > e) return;
    out.push({ day: offset, date: formatDate(dt), title, description });
  };

  addDay(0, "Launch announcement", "Publish the kickoff post with all rules, prize reveal, and official hashtag. Pin the post and share to stories.");
  if (totalDays > 3) addDay(1, "Day-1 reminder", "Re-share top entries and remind followers how to enter via stories.");
  const mid = Math.floor(totalDays / 2);
  if (mid > 1 && mid < totalDays - 1) {
    addDay(mid, "Mid-contest boost", "Publish a fresh post highlighting entries so far. Consider a bonus entry mechanic.");
  }
  if (totalDays > 4) {
    const lastThird = Math.floor(totalDays * 0.75);
    if (lastThird > mid && lastThird < totalDays - 1) {
      addDay(lastThird, "Final stretch reminder", "Post a countdown reminder. Cross-promote on other platforms.");
    }
  }
  addDay(Math.max(0, totalDays - 1), "Last day reminder", "Post a 'last chance' reminder with countdown. Share top entries.");
  // Winner announcement happens the day after the contest closes.
  addDay(totalDays, "Winner announcement", "Announce the winner publicly. Tag the winner and DM them to claim the prize.", true);

  return out;
}

// ---- Compliance checker ----

export function checkCompliance(input: ContestInput): ComplianceIssue[] {
  const rules = COMPLIANCE_RULES.filter((r) => r.platform === input.platform);
  const issues: ComplianceIssue[] = rules.map((r) => ({
    level: r.level,
    platform: r.platform,
    message: r.message,
  }));

  // Cross-cutting: if no free-entry path offered, warn
  const hasFreePath = input.entryMethods.some((m) =>
    ["like", "comment", "follow", "share", "tag-friends"].includes(m),
  );
  if (!hasFreePath && input.entryMethods.length > 0) {
    issues.push({
      level: "warning",
      platform: input.platform,
      message: "No free, no-purchase entry path detected. Many jurisdictions require a free alternative method of entry (AMOE).",
    });
  }

  // Hashtag length
  const tag = generateHashtag(input.contestName);
  if (tag.hashtag && tag.length > 30) {
    issues.push({
      level: "warning",
      platform: input.platform,
      message: `Contest hashtag ${tag.hashtag} is ${tag.length} characters. Consider a shorter hashtag for better discoverability.`,
    });
  }

  // Age restriction cross-check
  if (input.ageRestriction !== "none") {
    const minAge = Number(input.ageRestriction.replace("+", ""));
    if (input.platform === "tiktok" && minAge < 18) {
      issues.push({
        level: "info",
        platform: input.platform,
        message: "TikTok requires account holders to be 13+, but brand-sponsored contests often require entrants to be 18+ for legal reasons. Consider raising the age restriction.",
      });
    }
  }

  return issues;
}

// ---- Summary stats ----

export function computeSummary(input: ContestInput, ctx: {
  duration: DurationInfo;
  compliance: ComplianceIssue[];
}): SummaryStats {
  return {
    durationDays: ctx.duration.valid ? ctx.duration.days : 0,
    prizeValue: Number.isFinite(input.prizeValue) && input.prizeValue > 0 ? input.prizeValue : 0,
    entryMethodsCount: input.entryMethods.length,
    platformsCount: PLATFORMS.length,
    contestTypesCount: CONTEST_TYPES.length,
    complianceIssues: ctx.compliance.length,
  };
}

// ---- Build the contest (orchestration) ----

export function buildContest(input: ContestInput): GeneratedContest {
  const duration = computeDuration(input.startDate, input.endDate);
  const hashtag = generateHashtag(input.contestName);
  const prize = formatPrize(input.prize, input.prizeValue);
  const mechanics = generateEntryMechanics(input.contestType, input.entryMethods);
  const eligibility = checkEligibility(input);
  const winnerMethods = suggestWinnerMethods(input.contestType);
  const disclaimer = generateDisclaimer(input.platform);
  const rules = generateOfficialRules(input, {
    duration, hashtag, prize, mechanics, eligibility, winnerMethods, disclaimer,
  });
  const schedule = generatePromotionSchedule(input.startDate, input.endDate);
  const compliance = checkCompliance(input);
  const summary = computeSummary(input, { duration, compliance });
  return {
    input, duration, hashtag, prize, mechanics, eligibility,
    winnerMethods, disclaimer, rules, schedule, compliance, summary,
  };
}

// ---- Renderers ----

export function renderText(contest: GeneratedContest): string {
  const lines: string[] = [];
  lines.push(`CONTEST BRIEF: ${contest.input.contestName || "Untitled Contest"}`);
  lines.push(`Platform: ${PLATFORM_LABELS[contest.input.platform]}`);
  lines.push(`Type: ${CONTEST_TYPE_LABELS[contest.input.contestType]}`);
  lines.push(`Dates: ${contest.input.startDate} → ${contest.input.endDate} (${contest.duration.days} day(s))`);
  lines.push("");
  lines.push("PRIZE");
  lines.push(contest.prize.description);
  lines.push("");
  lines.push("HASHTAG");
  lines.push(contest.hashtag.hashtag);
  lines.push("Variants: " + contest.hashtag.variants.join(", "));
  lines.push("");
  lines.push("ENTRY MECHANICS");
  lines.push(...contest.mechanics.steps.map((s) => `- ${s}`));
  lines.push("Max entries: " + contest.mechanics.maxEntries);
  lines.push("Bonus:");
  lines.push(...contest.mechanics.bonusEntries.map((b) => `- ${b}`));
  lines.push("");
  lines.push("ELIGIBILITY");
  lines.push(...contest.eligibility.checks.map((c) => `- [${c.ok ? "✓" : "✗"}] ${c.label}: ${c.detail}`));
  lines.push("");
  lines.push("WINNER SELECTION METHODS");
  lines.push(...contest.winnerMethods.map((m) => `- ${m.label}${m.recommended ? " (recommended)" : ""}: ${m.description}`));
  lines.push("");
  lines.push("DISCLAIMER");
  lines.push(contest.disclaimer.text);
  lines.push("");
  lines.push("PROMOTION SCHEDULE");
  lines.push(...contest.schedule.map((s) => `- Day ${s.day} (${s.date}): ${s.title} — ${s.description}`));
  lines.push("");
  lines.push("COMPLIANCE");
  if (contest.compliance.length === 0) {
    lines.push("No compliance issues detected.");
  } else {
    lines.push(...contest.compliance.map((c) => `- [${c.level}] ${c.message}`));
  }
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`Duration: ${contest.summary.durationDays} day(s)`);
  lines.push(`Prize value: $${contest.summary.prizeValue}`);
  lines.push(`Entry methods: ${contest.summary.entryMethodsCount}`);
  lines.push(`Compliance issues: ${contest.summary.complianceIssues}`);
  lines.push("");
  lines.push("--- OFFICIAL RULES ---");
  lines.push(contest.rules.fullText);
  return lines.join("\n");
}

export function renderHtml(contest: GeneratedContest): string {
  const esc = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const parts: string[] = [];
  parts.push("<!DOCTYPE html>");
  parts.push("<html lang=\"en\">");
  parts.push("<head>");
  parts.push("<meta charset=\"utf-8\">");
  parts.push(`<title>${esc(contest.rules.title)}</title>`);
  parts.push("<style>");
  parts.push("body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#222;line-height:1.55;}");
  parts.push("h1{font-size:22px;margin-bottom:4px;}");
  parts.push("h2{font-size:16px;margin-top:24px;border-bottom:1px solid #eee;padding-bottom:4px;}");
  parts.push(".meta{color:#666;font-size:13px;margin-bottom:16px;}");
  parts.push(".badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#eef;font-size:12px;margin-right:6px;}");
  parts.push(".warn{color:#9a6700;background:#fff8e1;padding:8px 12px;border-radius:4px;margin:6px 0;}");
  parts.push(".info{color:#036;background:#eef5ff;padding:8px 12px;border-radius:4px;margin:6px 0;}");
  parts.push("ol,ul{padding-left:22px;}");
  parts.push("</style>");
  parts.push("</head>");
  parts.push("<body>");
  parts.push(`<h1>${esc(contest.input.contestName || "Untitled Contest")}</h1>`);
  parts.push(`<div class="meta"><span class="badge">${esc(PLATFORM_LABELS[contest.input.platform])}</span><span class="badge">${esc(CONTEST_TYPE_LABELS[contest.input.contestType])}</span><span class="badge">${contest.input.startDate} → ${contest.input.endDate}</span><span class="badge">${contest.duration.days} day(s)</span></div>`);
  parts.push(`<h2>Prize</h2><p>${esc(contest.prize.description)}</p>`);
  parts.push(`<h2>Hashtag</h2><p><strong>${esc(contest.hashtag.hashtag)}</strong><br>Variants: ${esc(contest.hashtag.variants.join(", "))}</p>`);
  parts.push("<h2>Entry Mechanics</h2><ul>");
  for (const s of contest.mechanics.steps) parts.push(`<li>${esc(s)}</li>`);
  parts.push("</ul>");
  parts.push(`<p><em>Max entries per person: ${contest.mechanics.maxEntries}</em></p>`);
  parts.push("<p><strong>Bonus:</strong></p><ul>");
  for (const b of contest.mechanics.bonusEntries) parts.push(`<li>${esc(b)}</li>`);
  parts.push("</ul>");
  parts.push("<h2>Eligibility</h2><ul>");
  for (const c of contest.eligibility.checks) {
    parts.push(`<li>${c.ok ? "✓" : "✗"} <strong>${esc(c.label)}:</strong> ${esc(c.detail)}</li>`);
  }
  parts.push("</ul>");
  parts.push("<h2>Winner Selection</h2><ul>");
  for (const m of contest.winnerMethods) {
    parts.push(`<li>${m.recommended ? "★ " : ""}<strong>${esc(m.label)}${m.recommended ? " (recommended)" : ""}:</strong> ${esc(m.description)}</li>`);
  }
  parts.push("</ul>");
  parts.push(`<h2>Disclaimer</h2><p>${esc(contest.disclaimer.text)}</p>`);
  parts.push("<h2>Promotion Schedule</h2><ol>");
  for (const s of contest.schedule) {
    parts.push(`<li><strong>${esc(s.date)} (Day ${s.day}):</strong> ${esc(s.title)} — ${esc(s.description)}</li>`);
  }
  parts.push("</ol>");
  parts.push("<h2>Compliance</h2>");
  if (contest.compliance.length === 0) {
    parts.push("<p>No compliance issues detected.</p>");
  } else {
    for (const c of contest.compliance) {
      parts.push(`<div class="${c.level}"><strong>${c.level.toUpperCase()}:</strong> ${esc(c.message)}</div>`);
    }
  }
  parts.push("<h1>Official Rules</h1>");
  for (const sec of contest.rules.sections) {
    parts.push(`<h2>${esc(sec.heading)}</h2>`);
    parts.push(`<p>${esc(sec.body).replace(/\n/g, "<br>")}</p>`);
  }
  parts.push("</body></html>");
  return parts.join("\n");
}

export function renderMarkdown(contest: GeneratedContest): string {
  const lines: string[] = [];
  lines.push(`# ${contest.input.contestName || "Untitled Contest"}`);
  lines.push("");
  lines.push(`> ${CONTEST_TYPE_LABELS[contest.input.contestType]} on ${PLATFORM_LABELS[contest.input.platform]} · ${contest.input.startDate} → ${contest.input.endDate} (${contest.duration.days} day(s))`);
  lines.push("");
  lines.push("## Prize");
  lines.push(contest.prize.description);
  lines.push("");
  lines.push("## Hashtag");
  lines.push(`**${contest.hashtag.hashtag}**  `);
  lines.push(`Variants: ${contest.hashtag.variants.join(", ")}`);
  lines.push("");
  lines.push("## How to Enter");
  for (const s of contest.mechanics.steps) lines.push(`- ${s}`);
  lines.push("");
  lines.push(`**Max entries per person:** ${contest.mechanics.maxEntries}`);
  lines.push("");
  lines.push("**Bonus entries:**");
  for (const b of contest.mechanics.bonusEntries) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Eligibility");
  for (const c of contest.eligibility.checks) {
    lines.push(`- ${c.ok ? "✓" : "✗"} **${c.label}:** ${c.detail}`);
  }
  lines.push("");
  lines.push("## Winner Selection");
  for (const m of contest.winnerMethods) {
    lines.push(`- ${m.recommended ? "★ " : ""}**${m.label}${m.recommended ? " (recommended)" : ""}:** ${m.description}`);
  }
  lines.push("");
  lines.push("## Disclaimer");
  lines.push(contest.disclaimer.text);
  lines.push("");
  lines.push("## Promotion Schedule");
  for (const s of contest.schedule) {
    lines.push(`- **Day ${s.day} (${s.date}):** ${s.title} — ${s.description}`);
  }
  lines.push("");
  lines.push("## Compliance");
  if (contest.compliance.length === 0) {
    lines.push("No compliance issues detected.");
  } else {
    for (const c of contest.compliance) {
      lines.push(`- **${c.level.toUpperCase()}:** ${c.message}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Official Rules");
  lines.push("");
  for (const sec of contest.rules.sections) {
    lines.push(`### ${sec.heading}`);
    lines.push("");
    lines.push(sec.body);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCsv(contest: GeneratedContest): string {
  const rows: Array<[string, string]> = [
    ["contest_name", contest.input.contestName],
    ["platform", contest.input.platform],
    ["contest_type", contest.input.contestType],
    ["prize", contest.input.prize],
    ["prize_value_usd", String(contest.prize.retailValue)],
    ["start_date", contest.input.startDate],
    ["end_date", contest.input.endDate],
    ["duration_days", String(contest.duration.days)],
    ["min_followers", String(Math.max(0, Math.floor(contest.input.minFollowers || 0)))],
    ["age_restriction", contest.input.ageRestriction],
    ["geographic_restriction", contest.input.geographicRestriction],
    ["entry_methods", contest.input.entryMethods.join("|")],
    ["hashtag", contest.hashtag.hashtag],
    ["hashtag_variants", contest.hashtag.variants.join("|")],
    ["max_entries", String(contest.mechanics.maxEntries)],
    ["eligibility_passes", String(contest.eligibility.passes)],
    ["winner_methods", contest.winnerMethods.map((m) => m.id).join("|")],
    ["recommended_winner_method", contest.winnerMethods.find((m) => m.recommended)?.id || ""],
    ["disclaimer", contest.disclaimer.text],
    ["compliance_issues", String(contest.compliance.length)],
    ["schedule_items", String(contest.schedule.length)],
    ["official_rules_full_text", contest.rules.fullText],
  ];
  const lines = ["component,value"];
  for (const [k, v] of rows) lines.push(`${k},${escapeCsv(v)}`);
  return lines.join("\n");
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

const HISTORY_KEY = "unqtools:social-media-contest-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  contestName: string;
  platform: Platform;
  contestType: ContestType;
  prize: string;
  prizeValue: number;
  startDate: string;
  endDate: string;
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

export function buildShareUrl(input: ContestInput): string {
  const params = new URLSearchParams();
  if (input.contestName) params.set("name", input.contestName);
  params.set("platform", input.platform);
  params.set("type", input.contestType);
  if (input.prize) params.set("prize", input.prize);
  if (input.prizeValue) params.set("value", String(input.prizeValue));
  if (input.startDate) params.set("start", input.startDate);
  if (input.endDate) params.set("end", input.endDate);
  if (input.minFollowers) params.set("minF", String(input.minFollowers));
  if (input.ageRestriction) params.set("age", input.ageRestriction);
  if (input.geographicRestriction) params.set("geo", input.geographicRestriction);
  if (input.entryMethods.length > 0) params.set("methods", input.entryMethods.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ContestInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ContestInput> = {};
  const name = params.get("name");
  if (name) out.contestName = name;
  const platform = params.get("platform");
  if (platform && PLATFORMS.includes(platform as Platform)) out.platform = platform as Platform;
  const type = params.get("type");
  if (type && CONTEST_TYPES.includes(type as ContestType)) out.contestType = type as ContestType;
  const prize = params.get("prize");
  if (prize) out.prize = prize;
  const value = params.get("value");
  if (value !== null) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) out.prizeValue = n;
  }
  const start = params.get("start");
  if (start) out.startDate = start;
  const end = params.get("end");
  if (end) out.endDate = end;
  const minF = params.get("minF");
  if (minF !== null) {
    const n = Number(minF);
    if (Number.isFinite(n) && n >= 0) out.minFollowers = Math.floor(n);
  }
  const age = params.get("age");
  if (age && AGE_RESTRICTIONS.includes(age as AgeRestriction)) out.ageRestriction = age as AgeRestriction;
  const geo = params.get("geo");
  if (geo) out.geographicRestriction = geo;
  const methodsStr = params.get("methods");
  if (methodsStr) {
    const methods = methodsStr
      .split(",")
      .filter((m) => ENTRY_METHODS.includes(m as EntryMethod)) as EntryMethod[];
    if (methods.length > 0) out.entryMethods = methods;
  }
  return out;
}
