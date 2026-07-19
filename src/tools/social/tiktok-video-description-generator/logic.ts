/**
 * TikTok Video Description Generator — pure logic.
 *
 * Generate TikTok video descriptions optimized for the For You page.
 * Pure functions only — no DOM, no network.
 */

export type VideoStyle =
  | "dance"
  | "comedy"
  | "tutorial"
  | "story-time"
  | "day-in-life"
  | "transition"
  | "challenge"
  | "trend";

export type TargetAudience =
  | "gen-z"
  | "gen-alpha"
  | "millennials"
  | "gen-x"
  | "all-ages";

export interface TikTokInput {
  videoTopic: string;
  videoStyle: VideoStyle;
  targetAudience: TargetAudience;
  includeTrendingSounds: boolean;
  includeHashtags: boolean;
  includeCTA: boolean;
}

export interface TikTokComponent {
  key: string;
  value: string;
}

export interface GeneratedDescription {
  variation: number;
  hook: string;
  opener: string;
  body: string;
  cta: string;
  emojis: string;
  hashtags: string[];
  trendingSounds: string[];
  fullDescription: string;
  charCount: number;
  wordCount: number;
  emojiCount: number;
  hashtagCount: number;
  soundCount: number;
  withinOptimal: boolean;
  withinLimit: boolean;
}

export interface SummaryStats {
  totalVariations: number;
  avgChars: number;
  avgWords: number;
  avgHashtags: number;
  avgEmojis: number;
  avgSounds: number;
  withinOptimalCount: number;
  withinLimitCount: number;
  viralScore: number;
}

export const VIDEO_STYLES: VideoStyle[] = [
  "dance",
  "comedy",
  "tutorial",
  "story-time",
  "day-in-life",
  "transition",
  "challenge",
  "trend",
];

export const TARGET_AUDIENCES: TargetAudience[] = [
  "gen-z",
  "gen-alpha",
  "millennials",
  "gen-x",
  "all-ages",
];

export const STYLE_LABELS: Record<VideoStyle, string> = {
  "dance": "Dance",
  "comedy": "Comedy",
  "tutorial": "Tutorial",
  "story-time": "Story Time",
  "day-in-life": "Day in the Life",
  "transition": "Transition",
  "challenge": "Challenge",
  "trend": "Trend",
};

export const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  "gen-z": "Gen Z",
  "gen-alpha": "Gen Alpha",
  "millennials": "Millennials",
  "gen-x": "Gen X",
  "all-ages": "All Ages",
};

// Char limits
export const MAX_CHARS = 2200;
export const OPTIMAL_MIN = 150;
export const OPTIMAL_MAX = 300;

// Style-specific openers (3-4 each)
export const STYLE_OPENERS: Record<VideoStyle, string[]> = {
  "dance": [
    "Watch this! 💃",
    "Wait for it 🎵",
    "POV: the beat drops 🎶",
    "Try this routine 🔥",
  ],
  "comedy": [
    "Nobody:\nMe: 😂",
    "POV: when it hits you 😅",
    "Tell me I'm not the only one 🤣",
    "I can't stop laughing 😭",
  ],
  "tutorial": [
    "POV: you learned something new 💡",
    "How to do this in 30 seconds ⏱️",
    "Save this before it's gone 📌",
    "Tutorial time 🎓",
  ],
  "story-time": [
    "Story time 📖",
    "So this happened... 😳",
    "Let me tell you a story 👀",
    "You won't believe what happened 🫢",
  ],
  "day-in-life": [
    "Day in my life ☀️",
    "Come with me 🚶",
    "5am productive day ⏰",
    "Realistic day in my life 🌿",
  ],
  "transition": [
    "Wait for the transition ✨",
    "Before & after 👀",
    "POV: the glow up 💫",
    "Transition check 🔁",
  ],
  "challenge": [
    "New challenge dropped 🚨",
    "Tag 3 friends to try this 🏆",
    "Can you do this? 💪",
    "Challenge accepted ✅",
  ],
  "trend": [
    "Trend alert 🚨",
    "Jumping on this trend 🌊",
    "Late to the trend but here we go 😅",
    "Had to try this trend ✨",
  ],
};

// Style-specific emojis
export const STYLE_EMOJIS: Record<VideoStyle, string> = {
  "dance": "💃🕺🎵🎶🔥✨",
  "comedy": "😂🤣😅😭🫠💀",
  "tutorial": "💡🎓📌✏️🧠⏱️",
  "story-time": "📖👀😳🫢🍿✨",
  "day-in-life": "☀️🌿☕️🚶🌸⏰",
  "transition": "✨💫👀🔁💫💅",
  "challenge": "🏆💪🚨✅🔥🎯",
  "trend": "🚨🌊✨🔥👀💫",
};

// Style-specific CTAs
export const STYLE_CTA: Record<VideoStyle, string[]> = {
  "dance": [
    "Duet this if you can keep up 💃",
    "Follow for more dance routines ✨",
    "Comment your favorite move 👇",
    "Stitch this with your version 🪡",
  ],
  "comedy": [
    "Follow for daily laughs 😂",
    "Tag someone who needs to see this 👇",
    "Comment 'same' if you relate 😭",
    "Duet this with your reaction 🤣",
  ],
  "tutorial": [
    "Save this for later 📌",
    "Follow for more tips 💡",
    "Comment your questions below 👇",
    "Stitch this with your results 🪡",
  ],
  "story-time": [
    "Follow for part 2 📖",
    "Comment your thoughts 👇",
    "Duet with your story 🪡",
    "Share if this happened to you 🔁",
  ],
  "day-in-life": [
    "Follow along my journey 🌿",
    "Comment what you want to see next 👇",
    "Save for inspo 📌",
    "Duet your own day 🪡",
  ],
  "transition": [
    "Duet this with your transition 🪡",
    "Follow for more transitions ✨",
    "Comment 'wow' if you gasped 👀",
    "Stitch your before/after 🪢",
  ],
  "challenge": [
    "Duet this and accept the challenge 💪",
    "Tag 3 friends to do this 🏆",
    "Follow for weekly challenges 🎯",
    "Comment 'done' when you complete it ✅",
  ],
  "trend": [
    "Follow for daily trends 🌊",
    "Duet this trend before it dies 🪡",
    "Comment 'late' if you're just seeing this 😅",
    "Stitch your version of this trend 🪢",
  ],
};

// Style-specific hooks (first 3 seconds)
export const STYLE_HOOKS: Record<VideoStyle, string[]> = {
  "dance": [
    "When the beat hits different 🔥",
    "POV: you finally nailed the routine",
    "Wait for the drop at 0:03",
    "Don't blink or you'll miss it",
  ],
  "comedy": [
    "Nobody asked but here's",
    "POV: it's 2am and you remember",
    "Tell me this isn't just you",
    "When your brain says",
  ],
  "tutorial": [
    "Stop scrolling if you struggle with",
    "Here's what nobody tells you about",
    "Save this — you'll need it when",
    "30 seconds to learn",
  ],
  "story-time": [
    "So this actually happened to me",
    "Story time — buckle up because",
    "You won't believe what went down",
    "Pull up a chair because",
  ],
  "day-in-life": [
    "Come with me for the day as a",
    "Realistic 5am to 11pm as a",
    "POV: you're following me through",
    "Honest day in my life as",
  ],
  "transition": [
    "Wait for the transition at 0:02",
    "POV: the before & after shocks you",
    "Don't scroll past the glow up",
    "Here's the moment everything changed",
  ],
  "challenge": [
    "New challenge just dropped — can you",
    "Try this in 10 seconds or less",
    "Tag 3 people who would fail",
    "Day 1 of attempting",
  ],
  "trend": [
    "Jumping on this trend before it dies",
    "Late to the party but",
    "Had to try this trend because",
    "First time doing this trend —",
  ],
};

// Trending sounds — 60+ organized by style
export const TRENDING_SOUNDS: Record<VideoStyle, string[]> = {
  "dance": [
    "Espresso - Sabrina Carpenter",
    "Houdini - Dua Lipa",
    "Texas Hold 'Em - Beyoncé",
    "Yes, And? - Ariana Grande",
    "Training Season - Dua Lipa",
    "Von Dutch - Charli XCX",
    "greedy - Tate McRae",
    "Cruel Summer - Taylor Swift",
  ],
  "comedy": [
    "Boots and a Sack - Original Audio",
    "Moaning Myrtle Trend Audio",
    "I'm Just A Kid - Simple Plan",
    "Ooh Wow - Original Trend",
    "POV: You're Laughing Audio",
    "Man in Finance Trend",
    "Very Demure Very Mindful",
    "Banana Phone Remix",
  ],
  "tutorial": [
    "Aesthetic - Tollan Kim",
    "Lofi Study Beat - chillhop",
    "Sparkle Sound Effect",
    "Whoosh Transition Audio",
    "Calm Tutorial Background",
    "Coffee Shop Ambience",
    "Typing ASMR Sound",
    "Page Flip Sound Effect",
  ],
  "story-time": [
    "Idea 10 - gabriel rio",
    "Snowfall - Øneheart",
    "Night Drive - A L E X",
    "Slow Burn - acoustic",
    "Comfortable - Henry Young",
    "Soft Piano Story Beat",
    "Late Night Talk Audio",
    "Sunset Drive - soulprosper",
  ],
  "day-in-life": [
    "Espresso (slowed) - Sabrina Carpenter",
    "Pink + White - Frank Ocean",
    "Heart to Heart - Mac DeMarco",
    "Lavender - BadBadNotGood",
    "Sunshine - hannah fade",
    "Coffee - beabadoobee",
    "Sunday Morning - Maroon 5",
    "Pinegrove - Size of the Moon",
  ],
  "transition": [
    "Oh My Oh My - original transition",
    "Sliding Doors Sound Effect",
    "Snap Beat Transition",
    "Beat Drop - clean edit",
    "Witchy Transition Audio",
    "Glitch Sound Effect",
    "Whoosh + Bass Drop",
    "Fairy Tale Transition",
  ],
  "challenge": [
    "Buss It Challenge Audio",
    "Run It Up - challenge beat",
    "Footwork Challenge Beat",
    "Silhouette Challenge Remix",
    "Bounce Challenge Original",
    "Push Up Challenge Beat",
    "Plank Challenge Audio",
    "Get Up Challenge Sound",
  ],
  "trend": [
    "Very Demure Very Mindful",
    "Hawk Tuah Trend Audio",
    "Man in Finance Trend",
    "Looking Ass Trend",
    "Mob Wife Aesthetic Audio",
    "Coconut Tree Trend",
    "Roman Empire Trend",
    "Of Course Trend Audio",
    "Girlhood Trend Sound",
    "Brat Summer Audio",
    "Baby Mama Dance Trend",
    "Stitch This Trend Audio",
  ],
};

// Hashtag pool — trending + niche + branded per style
export const TRENDING_HASHTAGS: string[] = [
  "fyp", "foryou", "foryoupage", "viral", "trending",
  "tiktokviral", "fypシ", "tiktok", "explore", "go_viral",
];

export const NICHE_HASHTAGS: Record<VideoStyle, string[]> = {
  "dance": ["dance", "dancetiktok", "dancechallenge", "choreography", "dancer"],
  "comedy": ["comedy", "funny", "lol", "memes", "humor"],
  "tutorial": ["tutorial", "howto", "learnontiktok", "diy", "tips"],
  "story-time": ["storytime", "story", "pov", "realstory", "truestory"],
  "day-in-life": ["dayinmylife", "vlog", "dailyvlog", "routine", "lifestyle"],
  "transition": ["transition", "glowup", "beforeandafter", "edit", "fyptransition"],
  "challenge": ["challenge", "tiktokchallenge", "trendingchallenge", "duet", "tagchallenge"],
  "trend": ["trend", "tiktoktrend", "trendingnow", "trendalert", "foryou"],
};

export const BRANDED_HASHTAGS: string[] = [
  "unqtools", "creator", "contentcreator", "tiktokmademebuyit",
];

// Audience modifier for hashtag selection
export const AUDIENCE_HASHTAG_TAG: Record<TargetAudience, string> = {
  "gen-z": "genz",
  "gen-alpha": "genalpha",
  "millennials": "millennials",
  "gen-x": "genx",
  "all-ages": "everyone",
};

// Best time to post (TikTok engagement data — hour, score 0-100)
export const BEST_POST_TIMES: { hour: number; label: string; score: number }[] = [
  { hour: 6, label: "6:00 AM", score: 55 },
  { hour: 9, label: "9:00 AM", score: 65 },
  { hour: 12, label: "12:00 PM", score: 80 },
  { hour: 13, label: "1:00 PM", score: 78 },
  { hour: 15, label: "3:00 PM", score: 85 },
  { hour: 17, label: "5:00 PM", score: 90 },
  { hour: 19, label: "7:00 PM", score: 100 },
  { hour: 21, label: "9:00 PM", score: 95 },
  { hour: 22, label: "10:00 PM", score: 88 },
];

// ---- Normalize / parse ----

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Pick element at index (deterministic — for variations). */
export function pickAt<T>(arr: T[], idx: number): T {
  if (arr.length === 0) throw new Error("empty array");
  return arr[((idx % arr.length) + arr.length) % arr.length];
}

// ---- Generators ----

/** Generate a style-specific opener for variation idx. */
export function generateOpener(style: VideoStyle, idx: number): string {
  return pickAt(STYLE_OPENERS[style], idx);
}

/** Generate a hook for variation idx (first 3 seconds). */
export function generateHook(style: VideoStyle, topic: string, idx: number): string {
  const template = pickAt(STYLE_HOOKS[style], idx);
  const t = normalizeTopic(topic);
  if (!t) return template;
  // Append the topic context
  return `${template} ${t.toLowerCase()}`;
}

/** Generate 3-5 hashtags mixing trending + niche + branded. */
export function generateHashtags(
  style: VideoStyle,
  audience: TargetAudience,
  topic: string,
  idx: number,
): string[] {
  const t = normalizeTopic(topic);
  const out: string[] = [];
  // Niche hashtags from style
  const niche = NICHE_HASHTAGS[style];
  out.push(pickAt(niche, idx));
  out.push(pickAt(niche, idx + 1));
  // Topic-derived hashtag if multiword or single word
  if (t) {
    const slug = t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "");
    if (slug && !out.includes(slug)) out.push(slug);
  }
  // Audience hashtag
  const audTag = AUDIENCE_HASHTAG_TAG[audience];
  if (!out.includes(audTag)) out.push(audTag);
  // Trending hashtag
  out.push(pickAt(TRENDING_HASHTAGS, idx));
  // Branded hashtag
  out.push(pickAt(BRANDED_HASHTAGS, idx));
  // Dedupe while preserving order, cap at 5
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const h of out) {
    if (!seen.has(h)) { seen.add(h); unique.push(h); }
  }
  return unique.slice(0, 5);
}

/** Suggest 3 trending sounds for a style. */
export function suggestTrendingSounds(style: VideoStyle, idx: number): string[] {
  const sounds = TRENDING_SOUNDS[style];
  return [
    pickAt(sounds, idx),
    pickAt(sounds, idx + 1),
    pickAt(sounds, idx + 2),
  ];
}

/** Generate a style-aware CTA. */
export function generateCTA(style: VideoStyle, idx: number): string {
  return pickAt(STYLE_CTA[style], idx);
}

/** Append style-aware emojis (2-3). */
export function appendEmojis(style: VideoStyle, idx: number): string {
  const pool = STYLE_EMOJIS[style];
  const chars = Array.from(pool);
  return `${pickAt(chars, idx)}${pickAt(chars, idx + 1)}`;
}

/** Generate the body sentence using topic + style context. */
export function generateBody(topic: string, style: VideoStyle, audience: TargetAudience): string {
  const t = normalizeTopic(topic);
  if (!t) return `Hope you enjoy this ${STYLE_LABELS[style].toLowerCase()} video for ${AUDIENCE_LABELS[audience]}!`;
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  return `Here's my take on ${lower} — built for the ${AUDIENCE_LABELS[audience]} crowd. Drop a comment if you felt this one.`;
}

/** Assemble a full description. */
export function generateDescription(
  input: TikTokInput,
  variation: number,
): GeneratedDescription {
  const { videoTopic, videoStyle, targetAudience, includeTrendingSounds, includeHashtags, includeCTA } = input;
  const idx = variation - 1; // variations are 1-indexed
  const hook = generateHook(videoStyle, videoTopic, idx);
  const opener = generateOpener(videoStyle, idx);
  const body = generateBody(videoTopic, videoStyle, targetAudience);
  const cta = includeCTA ? generateCTA(videoStyle, idx) : "";
  const emojis = appendEmojis(videoStyle, idx);
  const hashtags = includeHashtags ? generateHashtags(videoStyle, targetAudience, videoTopic, idx) : [];
  const trendingSounds = includeTrendingSounds ? suggestTrendingSounds(videoStyle, idx) : [];

  // Compose: opener + hook + body + cta + emojis + hashtags
  const parts: string[] = [];
  parts.push(opener);
  parts.push(hook);
  parts.push(body);
  if (cta) parts.push(cta);
  parts.push(emojis);
  if (hashtags.length > 0) {
    parts.push(hashtags.map((h) => `#${h}`).join(" "));
  }
  const fullDescription = parts.join(" ");
  const charCount = Array.from(fullDescription).length;
  const wordCount = fullDescription.split(/\s+/).filter(Boolean).length;

  return {
    variation,
    hook,
    opener,
    body,
    cta,
    emojis,
    hashtags,
    trendingSounds,
    fullDescription,
    charCount,
    wordCount,
    emojiCount: Array.from(emojis).filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code > 0x2000;
    }).length,
    hashtagCount: hashtags.length,
    soundCount: trendingSounds.length,
    withinOptimal: charCount >= OPTIMAL_MIN && charCount <= OPTIMAL_MAX,
    withinLimit: charCount <= MAX_CHARS,
  };
}

/** Generate 3 variations. */
export function generateVariations(input: TikTokInput): GeneratedDescription[] {
  if (!normalizeTopic(input.videoTopic)) return [];
  return [1, 2, 3].map((v) => generateDescription(input, v));
}

// ---- Validators & scorers ----

/** Validate a description's char count. Returns 'optimal' | 'over-optimal' | 'too-long' | 'too-short'. */
export function validateCharCount(charCount: number): "optimal" | "over-optimal" | "too-long" | "too-short" {
  if (charCount > MAX_CHARS) return "too-long";
  if (charCount < OPTIMAL_MIN) return "too-short";
  if (charCount > OPTIMAL_MAX) return "over-optimal";
  return "optimal";
}

/** Score viral potential (0-100) based on style, hashtags, sounds, and audience fit. */
export function scoreViralPotential(desc: GeneratedDescription): number {
  let score = 40; // base
  // Hashtag coverage
  if (desc.hashtagCount >= 3) score += 10;
  if (desc.hashtagCount >= 5) score += 5;
  // Trending sound
  if (desc.soundCount > 0) score += 15;
  if (desc.soundCount >= 3) score += 5;
  // CTA present (encourages engagement)
  if (desc.cta) score += 10;
  // Emoji present
  if (desc.emojiCount > 0) score += 5;
  // Within optimal length
  if (desc.withinOptimal) score += 10;
  else if (desc.withinLimit) score += 5;
  // Cap at 100
  return Math.min(100, score);
}

/** Suggest best post time (top 3 by score). */
export function suggestBestPostTime(): { hour: number; label: string; score: number }[] {
  return [...BEST_POST_TIMES].sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---- Stats ----

/** Compute summary stats across variations. */
export function computeSummaryStats(variations: GeneratedDescription[]): SummaryStats {
  if (variations.length === 0) {
    return {
      totalVariations: 0,
      avgChars: 0,
      avgWords: 0,
      avgHashtags: 0,
      avgEmojis: 0,
      avgSounds: 0,
      withinOptimalCount: 0,
      withinLimitCount: 0,
      viralScore: 0,
    };
  }
  const sum = variations.reduce(
    (acc, v) => ({
      chars: acc.chars + v.charCount,
      words: acc.words + v.wordCount,
      hashtags: acc.hashtags + v.hashtagCount,
      emojis: acc.emojis + v.emojiCount,
      sounds: acc.sounds + v.soundCount,
      viral: acc.viral + scoreViralPotential(v),
    }),
    { chars: 0, words: 0, hashtags: 0, emojis: 0, sounds: 0, viral: 0 },
  );
  const n = variations.length;
  return {
    totalVariations: n,
    avgChars: Math.round(sum.chars / n),
    avgWords: Math.round(sum.words / n),
    avgHashtags: Math.round(sum.hashtags / n),
    avgEmojis: Math.round(sum.emojis / n),
    avgSounds: Math.round(sum.sounds / n),
    withinOptimalCount: variations.filter((v) => v.withinOptimal).length,
    withinLimitCount: variations.filter((v) => v.withinLimit).length,
    viralScore: Math.round(sum.viral / n),
  };
}

// ---- Renderers ----

/** Render a single description as plain text. */
export function renderText(desc: GeneratedDescription): string {
  const lines = [
    `Variation ${desc.variation}`,
    `Hook: ${desc.hook}`,
    `Opener: ${desc.opener}`,
    `Body: ${desc.body}`,
  ];
  if (desc.cta) lines.push(`CTA: ${desc.cta}`);
  lines.push(`Emojis: ${desc.emojis}`);
  if (desc.hashtags.length > 0) lines.push(`Hashtags: ${desc.hashtags.map((h) => `#${h}`).join(" ")}`);
  if (desc.trendingSounds.length > 0) lines.push(`Trending Sounds:\n${desc.trendingSounds.map((s) => `  - ${s}`).join("\n")}`);
  lines.push("");
  lines.push("Full Description:");
  lines.push(desc.fullDescription);
  lines.push(`(chars: ${desc.charCount}, words: ${desc.wordCount}, hashtags: ${desc.hashtagCount}, sounds: ${desc.soundCount})`);
  return lines.join("\n");
}

/** Render multiple variations as plain text. */
export function renderTextAll(variations: GeneratedDescription[]): string {
  return variations.map(renderText).join("\n\n---\n\n");
}

/** Render a single description as CSV (component, value). */
export function renderCsv(desc: GeneratedDescription): string {
  const lines = ["component,value"];
  lines.push(`variation,${desc.variation}`);
  lines.push(`hook,${escapeCsv(desc.hook)}`);
  lines.push(`opener,${escapeCsv(desc.opener)}`);
  lines.push(`body,${escapeCsv(desc.body)}`);
  lines.push(`cta,${escapeCsv(desc.cta)}`);
  lines.push(`emojis,${escapeCsv(desc.emojis)}`);
  lines.push(`hashtags,${escapeCsv(desc.hashtags.map((h) => `#${h}`).join(" "))}`);
  lines.push(`trending_sounds,${escapeCsv(desc.trendingSounds.join("; "))}`);
  lines.push(`full_description,${escapeCsv(desc.fullDescription)}`);
  lines.push(`char_count,${desc.charCount}`);
  lines.push(`word_count,${desc.wordCount}`);
  lines.push(`hashtag_count,${desc.hashtagCount}`);
  lines.push(`emoji_count,${desc.emojiCount}`);
  lines.push(`sound_count,${desc.soundCount}`);
  lines.push(`within_optimal,${desc.withinOptimal}`);
  lines.push(`within_limit,${desc.withinLimit}`);
  return lines.join("\n");
}

/** Render multiple variations as CSV. */
export function renderCsvAll(variations: GeneratedDescription[]): string {
  if (variations.length === 0) return "component,value\n";
  return variations.map((v, i) => {
    const csv = renderCsv(v);
    return i === 0 ? csv : csv.split("\n").slice(1).join("\n");
  }).join("\n");
}

/** Split a CSV row with quoted values. */
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

const HISTORY_KEY = "unqtools:tiktok-video-description-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  videoTopic: string;
  videoStyle: VideoStyle;
  targetAudience: TargetAudience;
  variationCount: number;
  viralScore: number;
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

export function buildShareUrl(input: TikTokInput): string {
  const params = new URLSearchParams();
  if (input.videoTopic) params.set("topic", input.videoTopic);
  params.set("style", input.videoStyle);
  params.set("audience", input.targetAudience);
  params.set("sounds", String(input.includeTrendingSounds));
  params.set("hashtags", String(input.includeHashtags));
  params.set("cta", String(input.includeCTA));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): TikTokInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: TikTokInput = {
    videoTopic: "",
    videoStyle: "tutorial",
    targetAudience: "gen-z",
    includeTrendingSounds: true,
    includeHashtags: true,
    includeCTA: true,
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const validStyles = VIDEO_STYLES;
  const validAudiences = TARGET_AUDIENCES;
  const style = params.get("style");
  const audience = params.get("audience");
  return {
    videoTopic: params.get("topic") ?? "",
    videoStyle: style && validStyles.includes(style as VideoStyle) ? (style as VideoStyle) : defaults.videoStyle,
    targetAudience: audience && validAudiences.includes(audience as TargetAudience)
      ? (audience as TargetAudience)
      : defaults.targetAudience,
    includeTrendingSounds: parseBool(params.get("sounds"), defaults.includeTrendingSounds),
    includeHashtags: parseBool(params.get("hashtags"), defaults.includeHashtags),
    includeCTA: parseBool(params.get("cta"), defaults.includeCTA),
  };
}

function parseBool(s: string | null, def: boolean): boolean {
  if (s === null) return def;
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return def;
}
