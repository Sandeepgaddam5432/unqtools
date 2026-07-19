/**
 * Social Media Poll Generator — pure logic.
 *
 * Generate optimized polls for Twitter, LinkedIn, Instagram, Facebook.
 * Per-platform constraints, question + option generators, engagement
 * optimizer, hashtags, captions, variations, best-time-to-post,
 * follow-up content. Pure functions only — no DOM, no network.
 */

export type Platform = "twitter" | "linkedin" | "instagram" | "facebook";

export type PollType =
  | "this-or-that"
  | "multiple-choice"
  | "rating-scale"
  | "opinion-scale"
  | "yes-no-maybe";

export type PollDuration = "1-hour" | "4-hours" | "24-hours" | "3-days" | "7-days";

export type Tone = "serious" | "casual" | "fun" | "controversial" | "educational";

export interface PlatformConstraint {
  minOptions: number;
  maxOptions: number;
  maxOptionChars: number;
  maxDurationHours: number;
  note: string;
}

export interface PollInput {
  topic: string;
  platform: Platform;
  pollType: PollType;
  optionCount: number;
  duration: PollDuration;
  tone: Tone;
}

export interface PollOption {
  text: string;
  charCount: number;
  overLimit: boolean;
}

export interface GeneratedPoll {
  question: string;
  caption: string;
  options: PollOption[];
  hashtags: string[];
  durationLabel: string;
  durationHours: number;
  bestTimeToPost: string;
  predictedEngagement: number;
  balanceScore: number;
  followUpSuggestions: string[];
  feasibility: FeasibilityResult;
}

export interface FeasibilityResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface SummaryStats {
  totalOptions: number;
  avgCharCount: number;
  maxCharCount: number;
  minCharCount: number;
  durationHours: number;
  durationLabel: string;
  predictedEngagement: number;
  balanceScore: number;
  overLimitCount: number;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  platform: Platform;
  pollType: PollType;
  predictedEngagement: number;
}

// ---- Constants & Presets ----

export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraint> = {
  twitter: {
    minOptions: 2,
    maxOptions: 4,
    maxOptionChars: 25,
    maxDurationHours: 168,
    note: "Twitter/X polls: 2-4 options, 25 chars each, max 7 days.",
  },
  linkedin: {
    minOptions: 4,
    maxOptions: 4,
    maxOptionChars: 30,
    maxDurationHours: 336,
    note: "LinkedIn polls: exactly 4 options, 30 chars each, max 14 days.",
  },
  instagram: {
    minOptions: 2,
    maxOptions: 4,
    maxOptionChars: 25,
    maxDurationHours: 24,
    note: "Instagram story polls: 2-4 options, 25 chars, max 24 hours.",
  },
  facebook: {
    minOptions: 2,
    maxOptions: 7,
    maxOptionChars: 80,
    maxDurationHours: 168,
    note: "Facebook group polls: 2-7 options, 80 chars each, max 7 days.",
  },
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const POLL_TYPE_LABELS: Record<PollType, string> = {
  "this-or-that": "This or That",
  "multiple-choice": "Multiple Choice",
  "rating-scale": "Rating Scale (1-5)",
  "opinion-scale": "Opinion Scale (Likert)",
  "yes-no-maybe": "Yes / No / Maybe",
};

export const DURATION_LABELS: Record<PollDuration, string> = {
  "1-hour": "1 Hour",
  "4-hours": "4 Hours",
  "24-hours": "24 Hours",
  "3-days": "3 Days",
  "7-days": "7 Days",
};

export const DURATION_HOURS: Record<PollDuration, number> = {
  "1-hour": 1,
  "4-hours": 4,
  "24-hours": 24,
  "3-days": 72,
  "7-days": 168,
};

export const TONE_LABELS: Record<Tone, string> = {
  serious: "Serious",
  casual: "Casual",
  fun: "Fun",
  controversial: "Controversial",
  educational: "Educational",
};

export const TONE_DESCRIPTIONS: Record<Tone, string> = {
  serious: "Formal, neutral, professional wording.",
  casual: "Conversational, everyday language.",
  fun: "Playful, with emojis and exclamation.",
  controversial: "Provocative, designed to spark debate.",
  educational: "Learning-oriented, invites sharing experience.",
};

export const BEST_TIME_TO_POST: Record<Platform, string> = {
  twitter: "Weekdays 9 AM - 4 PM (peak 12 PM)",
  linkedin: "Tue-Thu 8 AM - 11 AM",
  instagram: "Mon-Fri 11 AM - 1 PM",
  facebook: "Wed-Thu 9 AM - 3 PM",
};

// Question templates per tone (first used by default; rest used for variations)
export const TONE_QUESTION_TEMPLATES: Record<Tone, string[]> = {
  serious: [
    "What is your perspective on {topic}?",
    "Where do you stand on {topic}?",
    "How do you view {topic}?",
  ],
  casual: [
    "What do you think about {topic}?",
    "Thoughts on {topic}?",
    "Hot take on {topic}?",
  ],
  fun: [
    "Quick! {topic} — what's your take?",
    "Spill the tea on {topic} 🍵",
    "Okay but really: {topic}?",
  ],
  controversial: [
    "Hot take: {topic}. Where do you stand?",
    "Unpopular opinion: {topic}. Agree?",
    "Controversial: {topic}. Your verdict?",
  ],
  educational: [
    "How familiar are you with {topic}?",
    "Let's learn about {topic}. What's your experience?",
    "What's your level with {topic}?",
  ],
};

// Option templates per tone + pollType
export const TONE_OPTION_TEMPLATES: Record<Tone, Record<PollType, string[]>> = {
  serious: {
    "this-or-that": ["Supports {topic}", "Opposes {topic}"],
    "multiple-choice": ["Strongly agree", "Agree", "Disagree", "Strongly disagree"],
    "rating-scale": ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"],
    "opinion-scale": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
    "yes-no-maybe": ["Yes", "No", "Maybe"],
  },
  casual: {
    "this-or-that": ["All for it", "Not my thing"],
    "multiple-choice": ["All in", "Mostly yes", "Mostly no", "Not at all"],
    "rating-scale": ["1 - Meh", "2 - OK", "3 - Good", "4 - Great", "5 - Awesome"],
    "opinion-scale": ["No way", "Not really", "Kinda", "Yeah sure", "Definitely"],
    "yes-no-maybe": ["Yeah", "Nah", "Maybe"],
  },
  fun: {
    "this-or-that": ["100% yes", "Hard pass"],
    "multiple-choice": ["Absolutely!", "Sure why not", "Meh", "Nope"],
    "rating-scale": ["1 - Yikes", "2 - Meh", "3 - OK", "4 - Nice!", "5 - Love it!"],
    "opinion-scale": ["Strongly nope", "No thanks", "Whatever", "Sure thing", "Heck yes!"],
    "yes-no-maybe": ["Yasss", "Nope", "Hmm maybe"],
  },
  controversial: {
    "this-or-that": ["{topic} is essential", "{topic} is overrated"],
    "multiple-choice": ["Strongly for", "Leaning for", "Leaning against", "Strongly against"],
    "rating-scale": ["1 - Terrible", "2 - Bad", "3 - Average", "4 - Good", "5 - Excellent"],
    "opinion-scale": ["Strongly oppose", "Oppose", "Neutral", "Support", "Strongly support"],
    "yes-no-maybe": ["Definitely yes", "Definitely no", "Depends"],
  },
  educational: {
    "this-or-that": ["Already practicing {topic}", "Want to learn {topic}"],
    "multiple-choice": ["Beginner", "Intermediate", "Advanced", "Expert"],
    "rating-scale": ["1 - Novice", "2 - Beginner", "3 - Intermediate", "4 - Advanced", "5 - Expert"],
    "opinion-scale": ["Never tried", "Tried briefly", "Some experience", "Regular practice", "Expert level"],
    "yes-no-maybe": ["Yes, I do", "No, I don't", "Considering it"],
  },
};

// Caption templates per tone (first used by default)
export const TONE_CAPTION_TEMPLATES: Record<Tone, string[]> = {
  serious: [
    "We'd love your input on {topic}. Please vote below.",
    "Help us understand perspectives on {topic}.",
  ],
  casual: [
    "Hey friends — quick question about {topic}. Vote away!",
    "Curious what everyone thinks about {topic}. Drop a vote!",
  ],
  fun: [
    "Alright internet, settle this: {topic}! 🎉 Vote below 👇",
    "Time for a hot poll on {topic}! Cast your vote! 🗳️",
  ],
  controversial: [
    "This might ruffle feathers, but: {topic}. Where do you land?",
    "Ready for some debate? Today's topic: {topic}.",
  ],
  educational: [
    "Let's explore {topic} together. What's your experience?",
    "Learning about {topic} today. Share your level below!",
  ],
};

export const HASHTAG_SUFFIXES: string[] = [
  "poll", "discussion", "community", "thoughts", "vote",
];

// ---- Normalize / Parse ----

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse a topic into lowercase words for hashtag generation. */
export function parseTopicWords(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

// ---- Validators ----

/** Validate poll duration against platform's max. */
export function validateDuration(
  platform: Platform,
  duration: PollDuration,
): FeasibilityResult {
  const c = PLATFORM_CONSTRAINTS[platform];
  const hours = DURATION_HOURS[duration];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (hours > c.maxDurationHours) {
    errors.push(
      `${PLATFORM_LABELS[platform]} polls max out at ${c.maxDurationHours}h (you selected ${hours}h).`,
    );
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Validate option count against platform's min/max. */
export function validateOptionCount(
  platform: Platform,
  count: number,
): FeasibilityResult {
  const c = PLATFORM_CONSTRAINTS[platform];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(count) || count < 1) {
    errors.push("Option count must be a positive number.");
    return { ok: false, errors, warnings };
  }
  if (count < c.minOptions) {
    errors.push(
      `${PLATFORM_LABELS[platform]} requires at least ${c.minOptions} option(s).`,
    );
  }
  if (count > c.maxOptions) {
    errors.push(
      `${PLATFORM_LABELS[platform]} allows at most ${c.maxOptions} options.`,
    );
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Validate option text length against platform's max chars. */
export function validateOptionChars(
  platform: Platform,
  options: string[],
): FeasibilityResult {
  const c = PLATFORM_CONSTRAINTS[platform];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const len = options[i].length;
    if (len > c.maxOptionChars) {
      warnings.push(
        `Option ${i + 1} (${len} chars) exceeds ${PLATFORM_LABELS[platform]}'s ${c.maxOptionChars}-char limit.`,
      );
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ---- Generators ----

/** Substitute {topic} into a template; if topic empty, strip the placeholder gracefully. */
export function substituteTopic(template: string, topic: string): string {
  const t = normalizeTopic(topic);
  if (t) return template.replace(/\{topic\}/g, t);
  // No topic — strip " {topic}" or "{topic} " or "{topic}" cleanly
  return template
    .replace(/\s*\{topic\}\s*\?/g, "?")
    .replace(/\s*\{topic\}\s*\.?/g, "")
    .replace(/\{topic\}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Generate the poll question for a topic + tone (uses first template). */
export function generateQuestion(topic: string, tone: Tone): string {
  const templates = TONE_QUESTION_TEMPLATES[tone];
  return substituteTopic(templates[0], topic);
}

/** Generate poll options based on type, tone, topic, and requested count. */
export function generateOptions(
  pollType: PollType,
  topic: string,
  tone: Tone,
  count: number,
): string[] {
  const templates = TONE_OPTION_TEMPLATES[tone][pollType];
  const t = normalizeTopic(topic);
  const out: string[] = [];

  if (pollType === "this-or-that") {
    // Always 2 opposing options
    for (let i = 0; i < 2; i++) out.push(substituteTopic(templates[i % templates.length], t));
    return out;
  }
  if (pollType === "yes-no-maybe") {
    return templates.slice(0, 3).map((tmpl) => substituteTopic(tmpl, t));
  }
  if (pollType === "rating-scale" || pollType === "opinion-scale") {
    // Always 5 options for scales
    return templates.slice(0, 5).map((tmpl) => substituteTopic(tmpl, t));
  }
  // multiple-choice: respect count
  const extraOptions = ["Other", "Not sure", "It depends"];
  const desired = Math.max(2, Math.min(7, count || 4));
  for (let i = 0; i < desired; i++) {
    if (i < templates.length) out.push(substituteTopic(templates[i], t));
    else out.push(extraOptions[(i - templates.length) % extraOptions.length]);
  }
  return out;
}

/** Build PollOption[] with charCount + overLimit flag for a platform. */
export function buildPollOptions(
  options: string[],
  platform: Platform,
): PollOption[] {
  const max = PLATFORM_CONSTRAINTS[platform].maxOptionChars;
  return options.map((text) => ({
    text,
    charCount: text.length,
    overLimit: text.length > max,
  }));
}

// ---- Engagement / Balance ----

/**
 * Compute a 0-100 balance score for a set of options.
 * Higher = more balanced (similar char lengths) → more engagement.
 * Formula: 100 - clamp((maxLen - minLen) * 2, 0, 100).
 */
export function computeOptionBalanceScore(options: PollOption[]): number {
  if (options.length === 0) return 0;
  if (options.length === 1) return 50;
  const lens = options.map((o) => o.charCount);
  const max = Math.max(...lens);
  const min = Math.min(...lens);
  const diff = max - min;
  return Math.max(0, 100 - diff * 2);
}

/**
 * Predict engagement 0-100 based on platform, poll type, balance score,
 * option count, and duration.
 */
export function computePredictedEngagement(
  platform: Platform,
  pollType: PollType,
  balanceScore: number,
  optionCount: number,
  duration: PollDuration,
): number {
  // Platform base engagement weights (Twitter highest, LinkedIn professional B2B)
  const platformBase: Record<Platform, number> = {
    twitter: 70,
    linkedin: 60,
    instagram: 75,
    facebook: 55,
  };
  // Poll type engagement weights (controversial types score higher)
  const typeWeight: Record<PollType, number> = {
    "this-or-that": 15,
    "multiple-choice": 8,
    "rating-scale": 5,
    "opinion-scale": 6,
    "yes-no-maybe": 10,
  };
  // Duration sweet spot — 24h or 3 days get a bonus
  const durationBonus: Record<PollDuration, number> = {
    "1-hour": -5,
    "4-hours": 0,
    "24-hours": 8,
    "3-days": 5,
    "7-days": -2,
  };
  // Option count sweet spot — 3-4 ideal
  let countBonus = 0;
  if (optionCount >= 3 && optionCount <= 4) countBonus = 5;
  else if (optionCount === 2) countBonus = 3;
  else if (optionCount >= 5) countBonus = -3;

  const base = platformBase[platform];
  const score =
    base +
    typeWeight[pollType] +
    (balanceScore - 70) * 0.4 +
    durationBonus[duration] +
    countBonus;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Engagement optimizer: returns options with similar character counts.
 * Truncates any option exceeding the platform's max chars (no ellipsis).
 * Pads shorter options with a small neutral suffix if there's a big gap.
 */
export function optimizeEngagement(
  options: PollOption[],
  platform: Platform,
): PollOption[] {
  const max = PLATFORM_CONSTRAINTS[platform].maxOptionChars;
  if (options.length === 0) return [];
  const truncated = options.map((o) => ({
    text: o.text.length > max ? o.text.slice(0, max) : o.text,
    charCount: 0,
    overLimit: false,
  }));
  // Recompute charCount + overLimit
  for (const o of truncated) {
    o.charCount = o.text.length;
    o.overLimit = o.charCount > max;
  }
  // If max - min gap is large (>10), try to pad shorter options with a neutral word
  const lens = truncated.map((o) => o.charCount);
  const maxLen = Math.max(...lens);
  const minLen = Math.min(...lens);
  if (maxLen - minLen > 10) {
    const target = Math.min(maxLen, max);
    for (const o of truncated) {
      if (o.charCount < target - 3 && o.charCount + 4 <= max) {
        const padded = `${o.text} —`;
        if (padded.length <= max) {
          o.text = padded;
          o.charCount = o.text.length;
        }
      }
    }
  }
  return truncated;
}

// ---- Caption + Hashtags ----

/** Generate a poll caption (intro text before the poll). */
export function generateCaption(topic: string, tone: Tone): string {
  return substituteTopic(TONE_CAPTION_TEMPLATES[tone][0], topic);
}

/**
 * Generate 3-5 hashtags relevant to the poll topic.
 * Deterministic: combines topic words with engagement suffixes.
 */
export function generateHashtags(topic: string): string[] {
  const words = parseTopicWords(topic);
  const out = new Set<string>();
  if (words.length === 0) {
    // Fallback generic hashtags
    out.add("#poll");
    out.add("#discussion");
    out.add("#community");
    return Array.from(out);
  }
  // Primary: joined topic words
  out.add("#" + words.join(""));
  // Per-word hashtags (up to 2)
  for (const w of words.slice(0, 2)) out.add("#" + w);
  // Topic + suffix combos
  const topicJoined = words.join("");
  out.add("#" + topicJoined + HASHTAG_SUFFIXES[0]);
  if (words.length === 1) {
    out.add("#" + topicJoined + HASHTAG_SUFFIXES[2]);
    out.add("#" + topicJoined + HASHTAG_SUFFIXES[3]);
  } else {
    out.add("#" + HASHTAG_SUFFIXES[1]);
    out.add("#" + HASHTAG_SUFFIXES[4]);
  }
  return Array.from(out).slice(0, 5);
}

// ---- Best time to post ----

export function suggestBestTimeToPost(platform: Platform): string {
  return BEST_TIME_TO_POST[platform];
}

// ---- Follow-up content ----

const FOLLOW_UP_CONTENT: Record<PollType, string[]> = {
  "this-or-that": [
    "Share the results in a follow-up post with a chart.",
    "Write a deeper-dive post on the winning side.",
    "Run a sequel poll on the nuance behind the winning option.",
  ],
  "multiple-choice": [
    "Publish an analysis of why the top choice won.",
    "Interview 3 respondents about their pick.",
    "Create a follow-up infographic summarizing the spread.",
  ],
  "rating-scale": [
    "Share the average rating with a takeaway insight.",
    "Discuss what would push the rating higher next time.",
    "Compare the rating to a previous poll or benchmark.",
  ],
  "opinion-scale": [
    "Write a post addressing the concerns of disagree voters.",
    "Highlight positive testimonials from agree voters.",
    "Host a live Q&A to dig into the split.",
  ],
  "yes-no-maybe": [
    "Convert 'Maybe' responders with a clarifying follow-up post.",
    "Address the concerns of 'No' voters in a follow-up thread.",
    "Celebrate and amplify 'Yes' voters' stories.",
  ],
};

export function suggestFollowUpContent(pollType: PollType): string[] {
  return [...FOLLOW_UP_CONTENT[pollType]];
}

// ---- Poll feasibility ----

/** Run all feasibility checks against a PollInput. */
export function checkFeasibility(input: PollInput): FeasibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dur = validateDuration(input.platform, input.duration);
  errors.push(...dur.errors);
  warnings.push(...dur.warnings);

  const cnt = validateOptionCount(input.platform, input.optionCount);
  errors.push(...cnt.errors);
  warnings.push(...cnt.warnings);

  // Poll type × platform sanity
  if (
    input.platform === "instagram" &&
    input.pollType === "multiple-choice" &&
    input.optionCount > 4
  ) {
    errors.push("Instagram story polls allow at most 4 options.");
  }
  if (input.platform === "linkedin" && input.optionCount !== 4) {
    warnings.push("LinkedIn polls work best with exactly 4 options.");
  }
  if (!normalizeTopic(input.topic)) {
    warnings.push("Topic is empty — question and options will be generic.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---- Full poll generation ----

/** Generate a full poll from a PollInput. */
export function generatePoll(input: PollInput): GeneratedPoll {
  const question = generateQuestion(input.topic, input.tone);
  const rawOptions = generateOptions(
    input.pollType,
    input.topic,
    input.tone,
    input.optionCount,
  );
  const built = buildPollOptions(rawOptions, input.platform);
  const optimized = optimizeEngagement(built, input.platform);
  const balanceScore = computeOptionBalanceScore(optimized);
  const predictedEngagement = computePredictedEngagement(
    input.platform,
    input.pollType,
    balanceScore,
    optimized.length,
    input.duration,
  );
  const caption = generateCaption(input.topic, input.tone);
  const hashtags = generateHashtags(input.topic);
  const followUps = suggestFollowUpContent(input.pollType);
  const feasibility = checkFeasibility(input);

  return {
    question,
    caption,
    options: optimized,
    hashtags,
    durationLabel: DURATION_LABELS[input.duration],
    durationHours: DURATION_HOURS[input.duration],
    bestTimeToPost: suggestBestTimeToPost(input.platform),
    predictedEngagement,
    balanceScore,
    followUpSuggestions: followUps,
    feasibility,
  };
}

// ---- Variations ----

/**
 * Generate 3 poll variations with different angles (different tones).
 * Variation 1: same tone, different question template.
 * Variation 2: more controversial angle.
 * Variation 3: more educational angle.
 */
export function generatePollVariations(input: PollInput): GeneratedPoll[] {
  const variations: GeneratedPoll[] = [];

  // V1: same tone, second question template
  const v1Templates = TONE_QUESTION_TEMPLATES[input.tone];
  if (v1Templates.length > 1) {
    const v1Input = { ...input };
    const v1Poll = generatePoll(v1Input);
    const altQuestion = substituteTopic(v1Templates[1], input.topic);
    variations.push({ ...v1Poll, question: altQuestion });
  } else {
    variations.push(generatePoll(input));
  }

  // V2: controversial angle
  const v2Input: PollInput = { ...input, tone: "controversial" };
  variations.push(generatePoll(v2Input));

  // V3: educational angle
  const v3Input: PollInput = { ...input, tone: "educational" };
  variations.push(generatePoll(v3Input));

  return variations;
}

// ---- Summary stats ----

export function computeSummaryStats(poll: GeneratedPoll): SummaryStats {
  const opts = poll.options;
  const total = opts.length;
  const lens = opts.map((o) => o.charCount);
  const avg = total > 0 ? Math.round(lens.reduce((a, b) => a + b, 0) / total) : 0;
  const max = total > 0 ? Math.max(...lens) : 0;
  const min = total > 0 ? Math.min(...lens) : 0;
  const overLimitCount = opts.filter((o) => o.overLimit).length;
  return {
    totalOptions: total,
    avgCharCount: avg,
    maxCharCount: max,
    minCharCount: min,
    durationHours: poll.durationHours,
    durationLabel: poll.durationLabel,
    predictedEngagement: poll.predictedEngagement,
    balanceScore: poll.balanceScore,
    overLimitCount,
  };
}

// ---- Renderers ----

/** Render a poll as formatted text (question + caption + options + hashtags). */
export function renderText(poll: GeneratedPoll): string {
  const lines: string[] = [];
  if (poll.caption) lines.push(poll.caption);
  lines.push("");
  lines.push(`Q: ${poll.question}`);
  lines.push("");
  for (let i = 0; i < poll.options.length; i++) {
    const o = poll.options[i];
    const marker = String.fromCharCode(65 + i); // A, B, C, ...
    lines.push(`${marker}) ${o.text}  (${o.charCount} chars${o.overLimit ? " — OVER LIMIT" : ""})`);
  }
  lines.push("");
  lines.push(`Duration: ${poll.durationLabel}`);
  lines.push(`Best time to post: ${poll.bestTimeToPost}`);
  lines.push(`Predicted engagement: ${poll.predictedEngagement}/100`);
  lines.push(`Balance score: ${poll.balanceScore}/100`);
  if (poll.hashtags.length > 0) {
    lines.push("");
    lines.push(poll.hashtags.join(" "));
  }
  if (poll.followUpSuggestions.length > 0) {
    lines.push("");
    lines.push("Follow-up content ideas:");
    for (const s of poll.followUpSuggestions) lines.push(`- ${s}`);
  }
  if (poll.feasibility.warnings.length > 0 || poll.feasibility.errors.length > 0) {
    lines.push("");
    lines.push("Feasibility:");
    for (const e of poll.feasibility.errors) lines.push(`! ${e}`);
    for (const w of poll.feasibility.warnings) lines.push(`~ ${w}`);
  }
  return lines.join("\n");
}

/** Render a poll as CSV (component, value). */
export function renderCsv(poll: GeneratedPoll): string {
  const lines = ["component,value"];
  lines.push(`${escapeCsv("question")},${escapeCsv(poll.question)}`);
  lines.push(`${escapeCsv("caption")},${escapeCsv(poll.caption)}`);
  lines.push(`${escapeCsv("duration")},${escapeCsv(poll.durationLabel)}`);
  lines.push(`${escapeCsv("duration_hours")},${String(poll.durationHours)}`);
  lines.push(`${escapeCsv("best_time_to_post")},${escapeCsv(poll.bestTimeToPost)}`);
  lines.push(`${escapeCsv("predicted_engagement")},${String(poll.predictedEngagement)}`);
  lines.push(`${escapeCsv("balance_score")},${String(poll.balanceScore)}`);
  for (let i = 0; i < poll.options.length; i++) {
    const o = poll.options[i];
    lines.push(`${escapeCsv(`option_${i + 1}`)},${escapeCsv(o.text)}`);
    lines.push(`${escapeCsv(`option_${i + 1}_chars`)},${String(o.charCount)}`);
  }
  lines.push(`${escapeCsv("hashtags")},${escapeCsv(poll.hashtags.join(" "))}`);
  for (let i = 0; i < poll.followUpSuggestions.length; i++) {
    lines.push(`${escapeCsv(`followup_${i + 1}`)},${escapeCsv(poll.followUpSuggestions[i])}`);
  }
  return lines.join("\n");
}

/** Split CSV row with quoted values. */
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

const HISTORY_KEY = "unqtools:social-media-poll-generator:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(input: PollInput): string {
  const params = new URLSearchParams();
  if (input.topic) params.set("topic", input.topic);
  params.set("platform", input.platform);
  params.set("type", input.pollType);
  params.set("count", String(input.optionCount));
  params.set("duration", input.duration);
  params.set("tone", input.tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { input: Partial<PollInput>; hasAny: boolean } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: {}, hasAny: false };
  const params = new URLSearchParams(clean);
  const input: Partial<PollInput> = {};
  const topic = params.get("topic");
  if (topic) input.topic = topic;
  const platform = params.get("platform");
  if (platform && platform in PLATFORM_LABELS) input.platform = platform as Platform;
  const type = params.get("type");
  if (type && type in POLL_TYPE_LABELS) input.pollType = type as PollType;
  const countStr = params.get("count");
  if (countStr) {
    const n = parseInt(countStr, 10);
    if (Number.isFinite(n) && n > 0) input.optionCount = n;
  }
  const duration = params.get("duration");
  if (duration && duration in DURATION_LABELS) input.duration = duration as PollDuration;
  const tone = params.get("tone");
  if (tone && tone in TONE_LABELS) input.tone = tone as Tone;
  return { input, hasAny: Object.keys(input).length > 0 };
}
