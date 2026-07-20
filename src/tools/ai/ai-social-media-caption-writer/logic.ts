/**
 * AI Social Media Caption Writer — pure logic.
 *
 * Generate per-platform social media captions (hook + body + CTA +
 * hashtags + emojis) from a built-in template library. Pure functions
 * only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx.
 */

// ---------- Types ----------

export type Platform =
  | "instagram"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "facebook";

export type Tone =
  | "bold"
  | "friendly"
  | "professional"
  | "playful"
  | "inspirational";

export type EmojiDensity = "none" | "low" | "medium" | "high";

export type Cta =
  | "link-in-bio"
  | "follow"
  | "share"
  | "comment"
  | "shop-now"
  | "learn-more"
  | "save-this"
  | "dm-me";

export interface CaptionVariant {
  id: string;
  platform: Platform;
  tone: Tone;
  cta: Cta;
  emojiDensity: EmojiDensity;
  hook: string;
  body: string;
  ctaLine: string;
  emojis: string[];
  hashtags: string[];
  text: string;
  charCount: number;
  charLimit: number;
  softTarget: number;
  exceedsLimit: boolean;
  exceedsSoftTarget: boolean;
  trimmed: boolean;
  warnings: string[];
  hookStyle: string;
}

export interface CaptionStats {
  platform: Platform;
  count: number;
  avgChars: number;
  overLimit: number;
  overSoftTarget: number;
}

export interface AbPair {
  id: string;
  control: CaptionVariant;
  challenger: CaptionVariant;
  hypothesis: string;
  whatToMeasure: string;
}

export interface ThreadTweet {
  index: number;
  text: string;
  charCount: number;
  charLimit: number;
  exceedsLimit: boolean;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-social-caption:history";
export const FAVES_KEY = "unqtools:ai-social-caption:faves";
export const HISTORY_MAX = 20;
export const FAVES_MAX = 50;

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export const TONE_LABELS: Record<Tone, string> = {
  bold: "Bold",
  friendly: "Friendly",
  professional: "Professional",
  playful: "Playful",
  inspirational: "Inspirational",
};

export const EMOJI_DENSITY_LABELS: Record<EmojiDensity, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const CTA_LABELS: Record<Cta, string> = {
  "link-in-bio": "Link in bio",
  follow: "Follow for more",
  share: "Share this",
  comment: "Comment below",
  "shop-now": "Shop now",
  "learn-more": "Learn more",
  "save-this": "Save this",
  "dm-me": "DM me",
};

export const NICHE_PRESETS: string[] = [
  "fitness", "food", "travel", "tech", "finance",
  "beauty", "fashion", "parenting", "marketing", "productivity",
  "music", "photography",
];

// Platform char limits (hard cap) and soft-target window upper bound.
export const PLATFORM_CHAR_LIMIT: Record<Platform, number> = {
  instagram: 2200,
  twitter: 280,
  linkedin: 3000,
  tiktok: 2200,
  facebook: 5000,
};

// Soft-target "sweet spot" upper bound (avoid truncation / "more" fold).
export const PLATFORM_SOFT_TARGET: Record<Platform, number> = {
  instagram: 220, // keep hook + first 1-2 lines visible before "more"
  twitter: 280,   // hard cap == soft target
  linkedin: 280,  // first 3 lines before "see more"
  tiktok: 150,    // first 2 lines before "more"
  facebook: 480,  // preview cutoff
};

// Hashtag-count guidance per platform (max recommended).
export const PLATFORM_HASHTAG_MAX: Record<Platform, number> = {
  instagram: 10,
  twitter: 2,
  linkedin: 5,
  tiktok: 5,
  facebook: 2,
};

// Platform-specific style hints surfaced in the UI.
export const PLATFORM_STYLE_HINTS: Record<Platform, string> = {
  instagram: "Hooks in the first 1-2 lines. 5-10 niche hashtags. Hashtags can go in the first comment.",
  twitter: "Hard cap 280 chars. 1-2 hashtags max. Threads work for long ideas.",
  linkedin: "Professional hook. 3-5 hashtags. No emojis in the headline.",
  tiktok: "Short, punchy. 3-5 trending + niche hashtags. Hashtags can go in caption.",
  facebook: "Conversational. 0-2 hashtags. Link previews dominate.",
};

// ---------- Emoji packs per tone ----------

const TONE_EMOJIS: Record<Tone, string[]> = {
  bold: ["🔥", "⚡", "💪", "🚀", "💥", "🦁", "🎯"],
  friendly: ["😊", "🙌", "✨", "💛", "🌿", "👋", "🤗"],
  professional: ["📊", "💼", "📈", "✅", "🤝", "🎯", "🧭"],
  playful: ["🎉", "😄", "🌈", "🎈", "🦄", "🍕", "😎"],
  inspirational: ["✨", "🌟", "💫", "🌱", "📖", "🕊️", "🌅"],
};

// Density → number of emojis to insert into the body.
const DENSITY_COUNT: Record<EmojiDensity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

// ---------- Hook library ----------
//
// Each entry is a template function taking a topic and returning a hook
// line. Categorised by tone for selection.

interface HookEntry {
  tone: Tone;
  style: string;
  build: (topic: string) => string;
}

const HOOK_LIBRARY: HookEntry[] = [
  // Bold
  { tone: "bold", style: "contrarian", build: (t) => `Everyone gets ${t} wrong. Here's the truth:` },
  { tone: "bold", style: "numbers", build: (t) => `${capitalize(t)}: 90% of people quit too early.` },
  { tone: "bold", style: "challenge", build: (t) => `Stop scrolling if you care about ${t}.` },
  { tone: "bold", style: "bold-claim", build: (t) => `${capitalize(t)} is the skill nobody talks about — but should.` },
  { tone: "bold", style: "alert", build: (t) => `Hot take: most ${t} advice is broken.` },
  // Friendly
  { tone: "friendly", style: "warm", build: (t) => `Hey friend, let's talk ${t} today.` },
  { tone: "friendly", style: "share", build: (t) => `Sharing what I wish I'd known about ${t} sooner.` },
  { tone: "friendly", style: "ask", build: (t) => `Can we chat about ${t} for a sec?` },
  { tone: "friendly", style: "celebrate", build: (t) => `Little win worth celebrating: ${t} is clicking.` },
  { tone: "friendly", style: "welcome", build: (t) => `New here? Start with ${t}.` },
  // Professional
  { tone: "professional", style: "insight", build: (t) => `A practical framework for ${t}:` },
  { tone: "professional", style: "data", build: (t) => `Three lessons from shipping ${t} at scale:` },
  { tone: "professional", style: "lesson", build: (t) => `What 12 months of ${t} taught me:` },
  { tone: "professional", style: "principle", build: (t) => `The core principle behind great ${t}:` },
  { tone: "professional", style: "case", build: (t) => `Case study: how we approached ${t}.` },
  // Playful
  { tone: "playful", style: "fun", build: (t) => `Plot twist: ${t} is actually fun.` },
  { tone: "playful", style: "mood", build: (t) => `Current mood: ${t} and thriving.` },
  { tone: "playful", style: "confession", build: (t) => `Confession: I'm obsessed with ${t}.` },
  { tone: "playful", style: "question", build: (t) => `Quick question: who else loves ${t}?` },
  { tone: "playful", style: "hype", build: (t) => `Okay but seriously, ${t} >>>` },
  // Inspirational
  { tone: "inspirational", style: "story", build: (t) => `One year ago I knew nothing about ${t}. Today:` },
  { tone: "inspirational", style: "growth", build: (t) => `${capitalize(t)} isn't a destination. It's a daily practice.` },
  { tone: "inspirational", style: "permission", build: (t) => `Permission to start ${t} badly today.` },
  { tone: "inspirational", style: "reminder", build: (t) => `Reminder: progress in ${t} compounds.` },
  { tone: "inspirational", style: "vision", build: (t) => `Imagine where ${t} could take you in 6 months.` },
];

// ---------- CTA templates ----------

const CTA_TEMPLATES: Record<Cta, string> = {
  "link-in-bio": "🔗 Link in bio",
  follow: "👉 Follow for more",
  share: "🔁 Share this with someone who needs it",
  comment: "💬 Comment your take below",
  "shop-now": "🛍️ Shop now",
  "learn-more": "📚 Learn more at the link",
  "save-this": "🔖 Save this for later",
  "dm-me": "📩 DM me to chat",
};

// ---------- Body templates ----------
//
// Each body is a template function taking a topic and emoji and
// returning 1-3 sentences.

interface BodyEntry {
  tone: Tone;
  build: (topic: string, emoji: string) => string;
}

const BODY_LIBRARY: BodyEntry[] = [
  {
    tone: "bold",
    build: (t, e) => `Most people overcomplicate ${t}. Strip it back to the fundamentals${e ? ` ${e}` : ""} and ship the boring reps. The boring reps are the difference.`,
  },
  {
    tone: "bold",
    build: (t, e) => `${capitalize(t)} rewards action, not planning${e ? ` ${e}` : ""}. Pick the smallest next step. Take it today. Repeat for 30 days.`,
  },
  {
    tone: "friendly",
    build: (t, e) => `If you're just starting with ${t}, take it slow${e ? ` ${e}` : ""}. Small wins stack up faster than you think. You've got this.`,
  },
  {
    tone: "friendly",
    build: (t, e) => `Here's the gentle reminder about ${t}: progress isn't linear${e ? ` ${e}` : ""}. Bad days are part of the curve.`,
  },
  {
    tone: "professional",
    build: (t, e) => `Effective ${t} comes down to three things: clear intent, consistent execution, and honest review${e ? ` ${e}` : ""}. Build all three into your routine.`,
  },
  {
    tone: "professional",
    build: (t, e) => `When tackling ${t}, start with the constraint, not the goal${e ? ` ${e}` : ""}. Constraints surface the highest-leverage moves first.`,
  },
  {
    tone: "playful",
    build: (t, e) => `Tell me I'm not the only one who geeks out over ${t}${e ? ` ${e}` : ""}. It's the small wins that make the whole week better.`,
  },
  {
    tone: "playful",
    build: (t, e) => `If ${t} were a vibe, it'd be this${e ? ` ${e}` : ""}. Cozy, focused, and a little bit magic.`,
  },
  {
    tone: "inspirational",
    build: (t, e) => `${capitalize(t)} is a slow burn${e ? ` ${e}` : ""}. Trust the work you can't see yet — it's making the visible wins possible.`,
  },
  {
    tone: "inspirational",
    build: (t, e) => `Every expert in ${t} started as a beginner who refused to quit${e ? ` ${e}` : ""}. Your only job today: show up.`,
  },
];

// ---------- Banned / shadowban-risk hashtag list (dated snapshot) ----------
//
// This is a bundled snapshot of tags that have at various times been
// shadowbanned, restricted, or blocked by Instagram/TikTok. The list
// is intentionally narrow and conservative — flag-only, never auto-block.

export const SHADOWBAN_RISK_TAGS: string[] = [
  "#anorexia", "#proana", "#thinspo", "#selfharm", "#depression",
  "#suicide", "#ana", "#meth", "#weed", "#boho", "#costhings",
  "#brain", "#eggplant", "#instasugar", "#sugarbaby", "#kitty",
  "#prettygirl", "#like4like", "#follow4follow", "#tagsforlikes",
];

// ---------- Helpers ----------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Clean a topic/name string. */
export function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Count chars (Array.from handles emoji + astral planes). */
export function countChars(s: string): number {
  // eslint-disable-next-line no-misleading-character-class
  return Array.from(s.replace(/[\uFE0F\u200D]/g, "")).length;
}

/** Stable id. */
function id(prefix: string, i: number): string {
  return `${prefix}-${i}-${Math.abs(hashCode(prefix + i)) % 100000}`;
}

/** Quick string hash for deterministic selection. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/** Pick N distinct emojis from a tone pack. */
function pickEmojis(tone: Tone, count: number, seed = 0): string[] {
  if (count <= 0) return [];
  const pack = TONE_EMOJIS[tone];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pack[(i + seed) % pack.length]);
  }
  return out;
}

// ---------- Hashtag suggestions ----------

const HASHTAG_PREFIXES: string[] = [
  "daily", "life", "community", "lover", "world",
  "gram", "vibes", "insta", "oftheday", "tips",
];

const HASHTAG_SUFFIXES: string[] = [
  "life", "tips", "community", "love", "daily",
  "goals", "wins", "101", "hacks", "inspo",
];

/** Generate up to N niche hashtag suggestions. */
export function suggestHashtags(niche: string, max = 30): string[] {
  const n = clean(niche).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  if (!n) return [];
  const out = new Set<string>();
  out.add(`#${n}`);
  for (const p of HASHTAG_PREFIXES) {
    if (out.size >= max) break;
    out.add(`#${p}${n}`);
  }
  for (const s of HASHTAG_SUFFIXES) {
    if (out.size >= max) break;
    out.add(`#${n}${s}`);
  }
  // Multi-word niche: add spaceless version too (handled by `n` already)
  return Array.from(out).slice(0, max);
}

/** Generate branded hashtag ideas from account name. */
export function suggestBrandedHashtags(accountName: string, niche: string, max = 5): string[] {
  const nm = clean(accountName).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  if (!nm) return [];
  const ni = clean(niche).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  const out = new Set<string>();
  out.add(`#${nm}`);
  out.add(`#${nm}community`);
  if (ni) {
    out.add(`#${nm}${ni}`);
    out.add(`#${nm}x${ni}`);
  }
  out.add(`#${nm}fam`);
  return Array.from(out).slice(0, max);
}

/** Flag hashtags from a list that match the shadowban-risk snapshot. */
export function flagShadowban(hashtags: string[]): string[] {
  const lower = SHADOWBAN_RISK_TAGS.map((t) => t.toLowerCase());
  return hashtags.filter((t) => lower.includes(t.toLowerCase()));
}

/** Filter out shadowban-risk hashtags. */
export function filterSafe(hashtags: string[]): string[] {
  const flagged = new Set(flagShadowban(hashtags).map((t) => t.toLowerCase()));
  return hashtags.filter((t) => !flagged.has(t.toLowerCase()));
}

// ---------- Caption generation ----------

interface BuildArgs {
  platform: Platform;
  tone: Tone;
  cta: Cta;
  emojiDensity: EmojiDensity;
  topic: string;
  accountName?: string;
  hookIdx?: number;
  bodyIdx?: number;
  variantIdx?: number;
}

/** Build a single caption variant. */
export function buildCaption(args: BuildArgs): CaptionVariant {
  const topic = clean(args.topic) || "your topic";
  const accountName = clean(args.accountName ?? "");
  const platform = args.platform;
  const tone = args.tone;
  const cta = args.cta;
  const emojiDensity = args.emojiDensity;
  const vIdx = args.variantIdx ?? 0;

  // Hook selection — deterministic per tone + index.
  const toneHooks = HOOK_LIBRARY.filter((h) => h.tone === tone);
  const hookPool = toneHooks.length > 0 ? toneHooks : HOOK_LIBRARY;
  const hookEntry = hookPool[(args.hookIdx ?? vIdx) % hookPool.length];
  const hook = hookEntry.build(topic);

  // Body selection — deterministic per tone + index.
  const toneBodies = BODY_LIBRARY.filter((b) => b.tone === tone);
  const bodyPool = toneBodies.length > 0 ? toneBodies : BODY_LIBRARY;
  const bodyEntry = bodyPool[(args.bodyIdx ?? vIdx) % bodyPool.length];
  const emojis = pickEmojis(tone, DENSITY_COUNT[emojiDensity], vIdx);
  const body = bodyEntry.build(topic, emojis[0] ?? "");

  // CTA line.
  const ctaLine = CTA_TEMPLATES[cta];

  // Hashtags — niche + branded, capped at platform max. Reserve 2 slots
  // for branded tags so they're not pushed out by niche tags.
  const hashMax = PLATFORM_HASHTAG_MAX[platform];
  const brandedTags = accountName
    ? suggestBrandedHashtags(accountName, topic, Math.min(2, hashMax))
    : [];
  const nicheBudget = Math.max(0, hashMax - brandedTags.length);
  const nicheTags = suggestHashtags(topic, nicheBudget);
  const merged = Array.from(new Set([...nicheTags, ...brandedTags])).slice(0, hashMax);
  const safeHashtags = filterSafe(merged);
  const flagged = flagShadowban(merged);

  // Compose text — different structures per platform. (Emojis are
  // already embedded into body/CTA by the body template; we pass the
  // emoji array here for future per-platform emoji placement rules.)
  const text = composeText(platform, hook, body, ctaLine, safeHashtags, emojis);

  const charLimit = PLATFORM_CHAR_LIMIT[platform];
  const softTarget = PLATFORM_SOFT_TARGET[platform];
  let charCount = countChars(text);
  let exceedsLimit = charCount > charLimit;
  let trimmed = false;
  let finalText = text;

  // Auto-trim on hard-limit overflow (Twitter/X is the usual case).
  if (exceedsLimit) {
    const trimmedText = trimToCharLimit(text, charLimit);
    if (trimmedText !== text) {
      finalText = trimmedText;
      charCount = countChars(finalText);
      exceedsLimit = charCount > charLimit;
      trimmed = true;
    }
  }

  const exceedsSoftTarget = charCount > softTarget;

  // Warnings
  const warnings: string[] = [];
  if (exceedsLimit) {
    warnings.push(`Exceeds ${PLATFORM_LABELS[platform]} hard char limit of ${charLimit}.`);
  }
  if (exceedsSoftTarget && !exceedsLimit) {
    warnings.push(
      `Exceeds ${PLATFORM_LABELS[platform]} soft-target of ${softTarget} chars — preview may truncate.`,
    );
  }
  if (flagged.length > 0) {
    warnings.push(
      `Hashtag(s) ${flagged.join(", ")} match a shadowban-risk snapshot and were filtered out.`,
    );
  }
  if (safeHashtags.length > hashMax) {
    warnings.push(`Too many hashtags — capped at ${hashMax} for ${PLATFORM_LABELS[platform]}.`);
  }
  if (platform === "twitter" && safeHashtags.length > 2) {
    warnings.push("X/Twitter: 1-2 hashtags max for engagement.");
  }
  if (platform === "facebook" && safeHashtags.length > 2) {
    warnings.push("Facebook: 0-2 hashtags recommended.");
  }

  return {
    id: id("cap", vIdx),
    platform,
    tone,
    cta,
    emojiDensity,
    hook,
    body,
    ctaLine,
    emojis,
    hashtags: safeHashtags,
    text: finalText,
    charCount,
    charLimit,
    softTarget,
    exceedsLimit,
    exceedsSoftTarget,
    trimmed,
    warnings,
    hookStyle: hookEntry.style,
  };
}

/** Compose the final caption text per platform conventions. */
function composeText(
  platform: Platform,
  hook: string,
  body: string,
  ctaLine: string,
  hashtags: string[],
  emojis: string[],
): string {
  const hashStr = hashtags.length > 0 ? `\n\n${hashtags.join(" ")}` : "";
  switch (platform) {
    case "twitter": {
      // X: hook + body in one tight paragraph, optional CTA, 1-2 hashtags inline.
      const tail = hashtags.length > 0 ? ` ${hashtags.slice(0, 2).join(" ")}` : "";
      return `${hook} ${body}${tail}`;
    }
    case "linkedin": {
      // LinkedIn: hook on its own line, blank, body, blank, CTA, blank, hashtags.
      return [hook, "", body, "", ctaLine, "", hashtags.join(" ")].filter((s) => s !== undefined).join("\n").trim();
    }
    case "instagram": {
      // IG: hook + body + CTA + hashtags block (or move hashtags to first comment via tip).
      return [hook, body, "", ctaLine, hashStr.trim()].join("\n").trim();
    }
    case "tiktok": {
      // TikTok: short, hashtags inline.
      return `${hook} ${body}${hashtags.length > 0 ? `\n${hashtags.join(" ")}` : ""}`;
    }
    case "facebook": {
      // FB: conversational, CTA optional, 0-2 hashtags.
      const fbHash = hashtags.length > 0 ? `\n\n${hashtags.slice(0, 2).join(" ")}` : "";
      return `${hook}\n\n${body}\n\n${ctaLine}${fbHash}`;
    }
    default: {
      // Future-proof: reference emojis to avoid unused-param warnings
      // if a new platform case is added without using it.
      const emojiSuffix = emojis.length > 0 ? ` ${emojis.join("")}` : "";
      return `${hook} ${body} ${ctaLine}${hashStr}${emojiSuffix}`;
    }
  }
}

/** Trim a caption to a char limit on word boundaries. */
export function trimToCharLimit(text: string, limit: number): string {
  if (countChars(text) <= limit) return text;
  // Try to cut at the last whitespace before the limit.
  const chars = Array.from(text);
  if (chars.length <= limit) return chars.join("");
  let cut = chars.slice(0, limit).join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > limit * 0.6) {
    cut = cut.slice(0, lastSpace);
  }
  return `${cut}…`;
}

/** Generate N caption variants for a platform + tone. */
export function generateCaptions(
  platform: Platform,
  tone: Tone,
  cta: Cta,
  emojiDensity: EmojiDensity,
  topic: string,
  accountName?: string,
  count = 5,
): CaptionVariant[] {
  const n = Math.max(5, count);
  const out: CaptionVariant[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      buildCaption({
        platform, tone, cta, emojiDensity, topic, accountName,
        hookIdx: i, bodyIdx: i, variantIdx: i,
      }),
    );
  }
  return out;
}

/** Generate an A/B pair (control + challenger with different hook + tone). */
export function generateAbPair(
  platform: Platform,
  tone: Tone,
  cta: Cta,
  emojiDensity: EmojiDensity,
  topic: string,
  accountName?: string,
): AbPair {
  const tones: Tone[] = ["bold", "friendly", "professional", "playful", "inspirational"];
  const challengerTone = tones[(tones.indexOf(tone) + 1) % tones.length];
  const control = buildCaption({
    platform, tone, cta, emojiDensity, topic, accountName,
    hookIdx: 0, bodyIdx: 0, variantIdx: 0,
  });
  const challenger = buildCaption({
    platform, tone: challengerTone, cta, emojiDensity, topic, accountName,
    hookIdx: 1, bodyIdx: 1, variantIdx: 1,
  });
  return {
    id: `abpair-${Date.now()}`,
    control,
    challenger,
    hypothesis: `Tests ${TONE_LABELS[challengerTone].toLowerCase()} hook vs ${TONE_LABELS[tone].toLowerCase()} baseline. Hypothesis: ${TONE_LABELS[challengerTone].toLowerCase()} tone drives more saves/comments for ${clean(topic) || "this topic"}.`,
    whatToMeasure: "Saves, comments, and link clicks over a 7-day window. Keep posting cadence, time-of-day, and content mix constant.",
  };
}

/** Generate a numbered X/Twitter thread from a longer idea. */
export function generateThread(
  topic: string,
  tone: Tone,
  cta: Cta,
  emojiDensity: EmojiDensity,
  tweetCount = 5,
): ThreadTweet[] {
  const limit = PLATFORM_CHAR_LIMIT.twitter;
  const t = clean(topic) || "this topic";
  const out: ThreadTweet[] = [];
  const toneHooks = HOOK_LIBRARY.filter((h) => h.tone === tone);
  const toneBodies = BODY_LIBRARY.filter((b) => b.tone === tone);
  const hookPool = toneHooks.length > 0 ? toneHooks : HOOK_LIBRARY;
  const bodyPool = toneBodies.length > 0 ? toneBodies : BODY_LIBRARY;

  // Tweet 1: hook
  const hook = hookPool[0].build(t);
  const intro = `${hook}\n🧵 Thread`;
  out.push({
    index: 1,
    text: intro,
    charCount: countChars(intro),
    charLimit: limit,
    exceedsLimit: countChars(intro) > limit,
  });

  // Tweets 2..N-1: body points
  for (let i = 1; i < tweetCount - 1; i++) {
    const body = bodyPool[i % bodyPool.length].build(t, pickEmojis(tone, DENSITY_COUNT[emojiDensity], i)[0] ?? "");
    const point = `${i + 1}/${tweetCount - 1} ${body}`;
    const trimmed = trimToCharLimit(point, limit);
    out.push({
      index: i + 1,
      text: trimmed,
      charCount: countChars(trimmed),
      charLimit: limit,
      exceedsLimit: countChars(trimmed) > limit,
    });
  }

  // Last tweet: CTA
  const ctaLine = CTA_TEMPLATES[cta];
  const tail = trimToCharLimit(`${tweetCount}/${tweetCount - 1} ${ctaLine}`, limit);
  out.push({
    index: tweetCount,
    text: tail,
    charCount: countChars(tail),
    charLimit: limit,
    exceedsLimit: countChars(tail) > limit,
  });
  return out;
}

/** Generate carousel slide captions (5-10 slides). */
export function generateCarousel(
  topic: string,
  tone: Tone,
  cta: Cta,
  emojiDensity: EmojiDensity,
  slideCount = 6,
): string[] {
  const t = clean(topic) || "this topic";
  const n = Math.min(10, Math.max(5, slideCount));
  const out: string[] = [];
  const toneHooks = HOOK_LIBRARY.filter((h) => h.tone === tone);
  const hookPool = toneHooks.length > 0 ? toneHooks : HOOK_LIBRARY;
  // Slide 1: cover hook
  out.push(hookPool[0].build(t));
  // Slides 2..n-1: short point lines
  const points = [
    `Why ${t} matters`,
    `Common mistake with ${t}`,
    `The simple framework`,
    `Tools that help`,
    `Habit to start today`,
    `Mistake to avoid`,
    `Quick win this week`,
    `Long-game reminder`,
  ];
  for (let i = 1; i < n - 1; i++) {
    out.push(points[(i - 1) % points.length]);
  }
  // Last slide: CTA
  out.push(CTA_TEMPLATES[cta]);
  return out.slice(0, n);
}

/** Compute stats across a list of variants. */
export function computeStats(captions: CaptionVariant[]): CaptionStats[] {
  const byPlatform = new Map<Platform, CaptionVariant[]>();
  for (const c of captions) {
    if (!byPlatform.has(c.platform)) byPlatform.set(c.platform, []);
    byPlatform.get(c.platform)!.push(c);
  }
  const out: CaptionStats[] = [];
  for (const [platform, list] of byPlatform) {
    const avg = list.length > 0
      ? Math.round(list.reduce((s, c) => s + c.charCount, 0) / list.length)
      : 0;
    out.push({
      platform,
      count: list.length,
      avgChars: avg,
      overLimit: list.filter((c) => c.exceedsLimit).length,
      overSoftTarget: list.filter((c) => c.exceedsSoftTarget).length,
    });
  }
  out.sort((a, b) => a.platform.localeCompare(b.platform));
  return out;
}

// ---------- Rendering ----------

/** Render captions as plain text (one per block, separated by ---). */
export function renderText(captions: CaptionVariant[]): string {
  return captions.map((c) => {
    const parts = [
      `[${PLATFORM_LABELS[c.platform]} · ${TONE_LABELS[c.tone]} · ${CTA_LABELS[c.cta]} · ${EMOJI_DENSITY_LABELS[c.emojiDensity]} emoji]`,
      c.text,
      `Chars: ${c.charCount}/${c.charLimit}` +
        (c.exceedsSoftTarget ? ` (over soft target ${c.softTarget})` : "") +
        (c.exceedsLimit ? " — OVER LIMIT!" : ""),
    ];
    if (c.warnings.length > 0) parts.push(`Warnings: ${c.warnings.join("; ")}`);
    return parts.join("\n");
  }).join("\n---\n");
}

/** Render captions as Markdown. */
export function renderMarkdown(captions: CaptionVariant[]): string {
  return captions.map((c, i) => {
    const lines = [
      `## Caption ${i + 1} — ${PLATFORM_LABELS[c.platform]} / ${TONE_LABELS[c.tone]}`,
      "```",
      c.text,
      "```",
      `*Characters: ${c.charCount}/${c.charLimit}` +
        (c.exceedsSoftTarget ? ` — over soft target ${c.softTarget}` : "") +
        (c.exceedsLimit ? " — OVER LIMIT" : "") + "*",
    ];
    if (c.warnings.length > 0) lines.push(`**Warnings:** ${c.warnings.join("; ")}`);
    if (c.hashtags.length > 0) lines.push(`**Hashtags:** ${c.hashtags.join(" ")}`);
    return lines.join("\n");
  }).join("\n\n");
}

/** Render captions as CSV. */
export function renderCsv(captions: CaptionVariant[]): string {
  const lines = ["id,platform,tone,cta,emoji_density,char_count,char_limit,exceeds_limit,trimmed,hook,text"];
  for (const c of captions) {
    lines.push([
      c.id,
      c.platform,
      c.tone,
      c.cta,
      c.emojiDensity,
      c.charCount,
      c.charLimit,
      c.exceedsLimit ? "yes" : "no",
      c.trimmed ? "yes" : "no",
      escapeCsv(c.hook),
      escapeCsv(c.text),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render captions as JSON. */
export function renderJson(captions: CaptionVariant[]): string {
  return JSON.stringify(captions.map((c) => ({
    id: c.id,
    platform: c.platform,
    tone: c.tone,
    cta: c.cta,
    emojiDensity: c.emojiDensity,
    hook: c.hook,
    body: c.body,
    ctaLine: c.ctaLine,
    emojis: c.emojis,
    hashtags: c.hashtags,
    text: c.text,
    charCount: c.charCount,
    charLimit: c.charLimit,
    softTarget: c.softTarget,
    exceedsLimit: c.exceedsLimit,
    exceedsSoftTarget: c.exceedsSoftTarget,
    trimmed: c.trimmed,
    warnings: c.warnings,
    hookStyle: c.hookStyle,
  })), null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  platform: Platform;
  tone: Tone;
  cta: Cta;
  emojiDensity: EmojiDensity;
  topic: string;
  accountName: string;
  variantCount: number;
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

// ---------- Favorites (localStorage) ----------

export interface FavoriteEntry {
  ts: number;
  platform: Platform;
  tone: Tone;
  cta: Cta;
  emojiDensity: EmojiDensity;
  text: string;
  topic: string;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const next = [entry, ...loadFavorites()].slice(0, FAVES_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeFavorite(ts: number): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.ts !== ts);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  platform: Platform;
  tone: Tone;
  cta: Cta;
  emojiDensity: EmojiDensity;
  topic: string;
  accountName: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.platform) params.set("p", state.platform);
  if (state.tone) params.set("t", state.tone);
  if (state.cta) params.set("c", state.cta);
  if (state.emojiDensity) params.set("e", state.emojiDensity);
  if (state.topic) params.set("to", state.topic);
  if (state.accountName) params.set("a", state.accountName);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!cleanHash) return {};
  const params = new URLSearchParams(cleanHash);
  const out: Partial<ShareState> = {};
  const p = params.get("p") as Platform | null;
  if (p && p in PLATFORM_LABELS) out.platform = p;
  const t = params.get("t") as Tone | null;
  if (t && t in TONE_LABELS) out.tone = t;
  const c = params.get("c") as Cta | null;
  if (c && c in CTA_LABELS) out.cta = c;
  const e = params.get("e") as EmojiDensity | null;
  if (e && e in EMOJI_DENSITY_LABELS) out.emojiDensity = e;
  const to = params.get("to");
  if (to) out.topic = to;
  const a = params.get("a");
  if (a) out.accountName = a;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  platform: Platform,
  tone: Tone,
  cta: Cta,
  emojiDensity: EmojiDensity,
  topic: string,
  accountName: string,
): string {
  return [
    "You are an expert social media copywriter who writes per-platform captions.",
    `Platform: ${PLATFORM_LABELS[platform]}.`,
    `Topic: ${topic}.`,
    `Tone: ${TONE_LABELS[tone]}.`,
    `Call-to-action: ${CTA_LABELS[cta]}.`,
    `Emoji density: ${EMOJI_DENSITY_LABELS[emojiDensity]}.`,
    `Account name: ${accountName || "(not provided)"}.`,
    `Hard character limit: ${PLATFORM_CHAR_LIMIT[platform]}.`,
    `Soft-target character window upper bound: ${PLATFORM_SOFT_TARGET[platform]}.`,
    `Recommended hashtag count: ${PLATFORM_HASHTAG_MAX[platform]}.`,
    "",
    "Rules:",
    "- Generate 5 caption variations.",
    "- Each caption MUST have a hook (first line), a body (1-3 sentences), and a CTA line.",
    `- Use ${PLATFORM_HASHTAG_MAX[platform]} or fewer relevant hashtags from the niche.`,
    `- Apply ${EMOJI_DENSITY_LABELS[emojiDensity]} emoji density (none=0, low=1, medium=2, high=3+ emojis).`,
    "- Vary the hook style across variations.",
    "- Each caption MUST be under the hard character limit.",
    "",
    "For each variation, output a JSON object with:",
    '- "text": the full caption text (with \\n line breaks)',
    '- "hook": the hook line alone',
    '- "hashtags": an array of hashtag strings (e.g., "#fitness")',
    '- "rationale": one sentence explaining why this caption works for this platform',
    "",
    "Output ONLY a JSON array — no markdown fences, no commentary.",
  ].join("\n");
}

export interface LlmCaptionVariant {
  text: string;
  hook: string;
  hashtags: string[];
  rationale: string;
}

export function renderLlmResult(
  rawText: string,
): | { ok: true; variants: LlmCaptionVariant[] }
   | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let arr: unknown;
  try {
    arr = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: "LLM output was not a JSON array." };
  }
  const out: LlmCaptionVariant[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) continue;
    const hook = typeof o.hook === "string" ? o.hook : "";
    const hashtags = Array.isArray(o.hashtags)
      ? (o.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 30)
      : [];
    const rationale = typeof o.rationale === "string" ? o.rationale : "";
    out.push({ text, hook, hashtags, rationale });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid caption objects." };
  }
  return { ok: true, variants: out };
}
