/**
 * Social Media Caption Generator — pure logic.
 *
 * Generate engaging captions for Instagram, TikTok, Facebook, Pinterest.
 * Pure functions only — no DOM, no network.
 */

export type Mood =
  | "happy"
  | "excited"
  | "thoughtful"
  | "nostalgic"
  | "motivational"
  | "funny"
  | "cozy"
  | "adventurous";

export type CaptionLength = "short" | "medium" | "long";

export type Platform = "instagram" | "tiktok" | "facebook" | "pinterest";

export interface CaptionInput {
  imageDescription: string;
  mood: Mood;
  captionLength: CaptionLength;
  includeEmojis: boolean;
  includeCTA: boolean;
  includeHashtags: boolean;
  platform: Platform;
}

export interface CaptionComponent {
  key: string;
  value: string;
}

export interface GeneratedCaption {
  variation: number;
  hook: string;
  body: string;
  cta: string;
  emojis: string;
  hashtags: string[];
  fullCaption: string;
  charCount: number;
  wordCount: number;
  emojiCount: number;
  hashtagCount: number;
  withinLimit: boolean;
}

export interface SummaryStats {
  totalVariations: number;
  avgChars: number;
  avgWords: number;
  avgHashtags: number;
  avgEmojis: number;
  withinLimitCount: number;
}

export const MOODS: Mood[] = [
  "happy",
  "excited",
  "thoughtful",
  "nostalgic",
  "motivational",
  "funny",
  "cozy",
  "adventurous",
];

export const CAPTION_LENGTHS: CaptionLength[] = ["short", "medium", "long"];

export const PLATFORMS: Platform[] = [
  "instagram",
  "tiktok",
  "facebook",
  "pinterest",
];

export const MOOD_LABELS: Record<Mood, string> = {
  happy: "Happy",
  excited: "Excited",
  thoughtful: "Thoughtful",
  nostalgic: "Nostalgic",
  motivational: "Motivational",
  funny: "Funny",
  cozy: "Cozy",
  adventurous: "Adventurous",
};

export const CAPTION_LENGTH_LABELS: Record<CaptionLength, string> = {
  short: "Short (1-2 sentences)",
  medium: "Medium (3-5 sentences)",
  long: "Long (5+ sentences)",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  pinterest: "Pinterest",
};

export interface PlatformConfig {
  id: Platform;
  label: string;
  maxChars: number;
  optimalChars: number;
  hashtagCount: number;
  cta: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxChars: 2200,
    optimalChars: 125,
    hashtagCount: 15,
    cta: "Link in bio 🔗",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    maxChars: 2200,
    optimalChars: 150,
    hashtagCount: 5,
    cta: "Follow for more!",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    maxChars: 63206,
    optimalChars: 477,
    hashtagCount: 3,
    cta: "Comment below 👇",
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    maxChars: 500,
    optimalChars: 300,
    hashtagCount: 4,
    cta: "Tap to save this pin 📌",
  },
};

// Mood-aware emoji sets
export const MOOD_EMOJIS: Record<Mood, string[]> = {
  happy: ["😊", "🎉", "☀️", "💛", "🙌"],
  excited: ["🤩", "✨", "🔥", "💥", "⚡"],
  thoughtful: ["🤔", "💭", "🌙", "🌿", "✍️"],
  nostalgic: ["🍂", "📷", "📼", "🕰️", "💌"],
  motivational: ["🚀", "💪", "🎯", "⭐", "🏆"],
  funny: ["😂", "🤣", "😜", "😎", "🙃"],
  cozy: ["☕", "🧶", "🕯️", "📖", "🛋️"],
  adventurous: ["🏔️", "🌍", "🧭", "🎒", "🌄"],
};

// Caption templates: 8 moods × 3 lengths × 3 templates = 72 templates (>50)
export const CAPTION_TEMPLATES: Record<Mood, Record<CaptionLength, string[]>> = {
  happy: {
    short: [
      "Pure happiness in one frame: {topic}.",
      "Nothing beats this: {topic}.",
      "Moments like {topic} make life golden.",
    ],
    medium: [
      "Today's joy is brought to you by {topic}.\nCouldn't stop smiling.\nThis is what happy looks like.",
      "Found my happy place: {topic}.\nSometimes the simplest things bring the biggest smiles.\nGrateful for this moment.",
      "When {topic} happens, you just smile.\nLife is good, friends.\nHold on to moments like these.",
    ],
    long: [
      "Today's joy is brought to you by {topic}.\nCouldn't stop smiling.\nThis is what happy looks like.\nSometimes life gives you exactly what you need.\nHold on to moments like these — they pass fast.\nThankful for every single one of them.",
      "Found my happy place: {topic}.\nSometimes the simplest things bring the biggest smiles.\nGrateful for this moment, this feeling, this life.\nIf you're seeing this, I hope you find a moment like this today too.\nJoy is contagious — pass it on.\nSmiling from ear to ear right now.",
      "When {topic} happens, you just smile.\nLife is good, friends.\nHold on to moments like these.\nThey don't come every day.\nBut when they do, you soak them up.\nAnd you remember them forever.",
    ],
  },
  excited: {
    short: [
      "FINALLY! {topic} is happening! 🎉",
      "Can't believe {topic} is real!",
      "Screaming — {topic} is here!",
    ],
    medium: [
      "OMG OMG OMG — {topic}! 🎉\nI've been waiting for this forever.\nLet's gooo!",
      "So excited to share {topic} with you all! ✨\nThis is just the beginning.\nBuckle up, big things coming.",
      "Pinch me — {topic} is actually happening! 💥\nDreams do come true, friends.\nStay tuned for more.",
    ],
    long: [
      "OMG OMG OMG — {topic}! 🎉\nI've been waiting for this forever.\nLet's gooo!\nThis is the moment I've been working towards.\nI can barely keep it together right now.\nThank you to everyone who believed in me.\nHere we go.",
      "So excited to share {topic} with you all! ✨\nThis is just the beginning.\nBuckle up, big things coming.\nI've been planning this in secret for weeks.\nAnd now I can finally shout it from the rooftops.\nGet ready — this is going to be epic.\nLet's make some magic happen.",
      "Pinch me — {topic} is actually happening! 💥\nDreams do come true, friends.\nStay tuned for more.\nI'm literally shaking as I type this.\nIf you've been following along, you know how long this has been a dream.\nAnd now? It's real.\nThank you for being on this journey with me.",
    ],
  },
  thoughtful: {
    short: [
      "Spending time with {topic} today.",
      "Reflecting on {topic}.",
      "Thinking deeply about {topic}.",
    ],
    medium: [
      "Reflecting on {topic} today.\nSome things need more thought than we give them.\nHere's what's on my mind.",
      "{topic} has a way of putting things in perspective.\nWe move so fast, sometimes we forget to pause.\nToday, I'm pausing.",
      "Considering the bigger picture around {topic}.\nNot every answer comes quickly.\nBut every question is worth sitting with.",
    ],
    long: [
      "Reflecting on {topic} today.\nSome things need more thought than we give them.\nHere's what's on my mind.\nWe live in a world that rewards speed.\nBut some truths only reveal themselves slowly.\nI'm learning to make space for them.\nMaybe the question matters more than the answer.\nWhat are you sitting with lately?",
      "{topic} has a way of putting things in perspective.\nWe move so fast, sometimes we forget to pause.\nToday, I'm pausing.\nI'm noticing things I usually overlook.\nThe slow stuff. The quiet stuff.\nThe stuff that doesn't shout for attention but matters most.\nMaybe this is what presence feels like.\nI think I want more of it.",
      "Considering the bigger picture around {topic}.\nNot every answer comes quickly.\nBut every question is worth sitting with.\nI used to want quick fixes.\nNow I'm learning the value of patient reflection.\nOf letting thoughts breathe.\nOf trusting that clarity comes in its own time.\nSo here I am, sitting with it.\nNo rush. No pressure. Just thought.",
    ],
  },
  nostalgic: {
    short: [
      "Takes me back to {topic}.",
      "Remember when {topic}?",
      "Old memories of {topic} flooding in.",
    ],
    medium: [
      "Takes me right back to {topic}.\nSome memories never really fade.\nThey just wait for the right moment to return.",
      "Throwback to {topic}.\nFunny how a single moment can hold so much.\nWishing I could go back, just for a day.",
      "Old photos of {topic} hit different.\nWe were so young, so sure, so unaware.\nAnd somehow, so happy.",
    ],
    long: [
      "Takes me right back to {topic}.\nSome memories never really fade.\nThey just wait for the right moment to return.\nI can still remember how the air felt that day.\nWho I was. Who we were.\nThe future felt so far away.\nNow it's the past, and I'd give anything to relive it.\nCherish the moments, friends. They go faster than you think.",
      "Throwback to {topic}.\nFunny how a single moment can hold so much.\nWishing I could go back, just for a day.\nWe didn't know then what we know now.\nMaybe that's what made it special.\nThe innocence. The belief. The not-yet-knowing.\nNow I carry those days with me, quietly.\nAnd on days like today, I let them speak.",
      "Old photos of {topic} hit different.\nWe were so young, so sure, so unaware.\nAnd somehow, so happy.\nTime does that — it softens the edges.\nThe stuff that felt heavy then feels lighter now.\nAnd the stuff that felt small feels enormous.\nIf I could send a message back, I'd say: pay attention.\nYou're living the good old days right now.",
    ],
  },
  motivational: {
    short: [
      "Stop waiting. Start {topic}.",
      "Your only limit is you.",
      "{topic} starts today.",
    ],
    medium: [
      "Stop waiting for the perfect moment. {topic} starts today.\nThe only thing standing between you and your goal is the decision to try.\nGo.",
      "Reminder: {topic} is built one day at a time.\nShow up, even when you don't feel like it.\nThat's how winners are made.",
      "Discipline > motivation. Especially with {topic}.\nNobody is coming to save you.\nIt's on you. And that's the good news.",
    ],
    long: [
      "Stop waiting for the perfect moment. {topic} starts today.\nThe only thing standing between you and your goal is the decision to try.\nGo.\nIt won't be easy. It won't be fast.\nBut it will be worth it.\nYour future self is begging you to start.\nSo close this app and go do the thing.\nOne day, you'll look back and thank today's you.",
      "Reminder: {topic} is built one day at a time.\nShow up, even when you don't feel like it.\nThat's how winners are made.\nMotivation is a spark.\nDiscipline is the fire.\nYou won't always feel inspired.\nBut you can always choose to act.\nAnd that choice, repeated daily, is everything.\nKeep going.",
      "Discipline > motivation. Especially with {topic}.\nNobody is coming to save you.\nIt's on you. And that's the good news.\nBecause it means the power is in your hands.\nYou can start today. Right now. With what you have.\nYou don't need permission. You don't need approval.\nYou just need to begin.\nAnd then begin again tomorrow.\nThat's the whole secret.",
    ],
  },
  funny: {
    short: [
      "Me: I'll be quick. Also me: {topic}.",
      "POV: {topic} went sideways.",
      "This is your sign to {topic}. Or not. Whatever.",
    ],
    medium: [
      "Me: I'll be quick. Also me: {topic}.\nSend help.\nAnd snacks.",
      "POV: {topic} went sideways.\nBut we move. We always move.\nCrisis? What crisis?",
      "Plot twist: nobody told me {topic} would be like this.\nBut here we are.\nLiving our best confused life.",
    ],
    long: [
      "Me: I'll be quick. Also me: {topic}.\nSend help.\nAnd snacks.\nAnd emotional support.\nAnd maybe a time machine.\nLook, I'm not saying I have it all figured out.\nI'm saying I have none of it figured out.\nAnd honestly? That's a vibe.\nWe're all just out here winging it.\nSolidarity, friends.",
      "POV: {topic} went sideways.\nBut we move. We always move.\nCrisis? What crisis?\nI'd panic, but I've already used my daily panic budget.\nSo instead I'm choosing chaos.\nIt's working, kind of.\nI mean, the situation is still a disaster.\nBut my hair looks great.\nAnd sometimes that's enough.\nWe ride at dawn. Or whenever. I'm flexible.",
      "Plot twist: nobody told me {topic} would be like this.\nBut here we are.\nLiving our best confused life.\nI had a plan. A whole plan.\nAnd then reality walked in and said 'lol nope'.\nRespect, honestly. Reality has range.\nSo I'm pivoting. As one does.\nNew plan: embrace the mess.\nMake it aesthetic.\nPretend this was intentional all along.\nNobody will know. Probably.",
    ],
  },
  cozy: {
    short: [
      "Slow mornings with {topic}.",
      "Cozy + {topic} = perfect.",
      "Quiet moments with {topic}.",
    ],
    medium: [
      "Slow mornings with {topic}.\nWarm drink in hand, nowhere to be.\nThis is the good stuff.",
      "Nothing fancy, just {topic} and a quiet afternoon.\nSometimes simple is the whole point.\nBe right here, soaking it in.",
      "Rainy day, soft blanket, and {topic}.\nSelf-care looks different for everyone.\nThis is mine.",
    ],
    long: [
      "Slow mornings with {topic}.\nWarm drink in hand, nowhere to be.\nThis is the good stuff.\nNo notifications. No rush. No to-do list nagging.\nJust sunlight through the window and time moving slowly.\nI used to think productivity meant motion.\nNow I think it sometimes means stillness.\nThis counts. This counts a lot.\nHold on to your slow mornings, friends.",
      "Nothing fancy, just {topic} and a quiet afternoon.\nSometimes simple is the whole point.\nBe right here, soaking it in.\nNo big plans. No big feelings. Just ease.\nThe world is loud enough already.\nToday, I'm choosing quiet.\nA book. A blanket. A cup of something warm.\nThat's the whole itinerary.\nAnd it's more than enough.",
      "Rainy day, soft blanket, and {topic}.\nSelf-care looks different for everyone.\nThis is mine.\nNo apology needed for resting.\nNo guilt for not producing.\nThe body knows what it needs.\nAnd today, it needs this.\nThe sound of rain. The warmth of tea. The comfort of stillness.\nTomorrow I'll be back to the rush.\nBut today, today is for being.",
    ],
  },
  adventurous: {
    short: [
      "Chasing {topic} and sunsets.",
      "Off the grid for {topic}.",
      "Found {topic} off the beaten path.",
    ],
    medium: [
      "Chasing {topic} and sunsets.\nNo map, no plan, just curiosity.\nThis is living.",
      "Took the road less traveled for {topic}.\nBest decision I've made all year.\nOnward.",
      "Somewhere between here and {topic}, I found myself.\nFunny how that works.\nThe wild does that to you.",
    ],
    long: [
      "Chasing {topic} and sunsets.\nNo map, no plan, just curiosity.\nThis is living.\nThe best moments happen when you stop trying to script them.\nWhen you say yes to the unknown.\nWhen you trade comfort for experience.\nI'll take dirt roads over highways any day.\nAnd strangers who become friends over crowds.\nThe world is so much bigger than our routines.\nGo see it.",
      "Took the road less traveled for {topic}.\nBest decision I've made all year.\nOnward.\nThe familiar is safe, sure.\nBut the unfamiliar is where you grow.\nWhere you meet the version of yourself you didn't know existed.\nI packed light. I left space for serendipity.\nIt delivered.\nIf you've been waiting for a sign to go — this is it.\nPack the bag. Take the trip. Worry about the rest later.",
      "Somewhere between here and {topic}, I found myself.\nFunny how that works.\nThe wild does that to you.\nStrips away the noise. The titles. The masks.\nLeaves only what's true.\nI came here chasing views. I leave with perspective.\nThe mountains don't care about your follower count.\nThe rivers don't care about your deadlines.\nAnd that's the gift.\nAdventures don't change the world. They change you.\nAnd then you go change the world.",
    ],
  },
};

// Hook templates — first-sentence grabbers, 3 variations
export const HOOK_TEMPLATES: Array<{ variation: number; hook: string }> = [
  { variation: 1, hook: "question" },
  { variation: 2, hook: "statement" },
  { variation: 3, hook: "story" },
];

/** Normalize a text string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse image description — extract the topic/keywords. */
export function parseImageDescription(s: string): string {
  return normalizeText(s);
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Extract keywords from text for hashtag generation. */
export function extractKeywords(text: string): string[] {
  const t = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as",
    "this", "that", "these", "those", "it", "its", "i", "me", "my",
    "we", "us", "our", "you", "your", "he", "him", "his", "she", "her",
    "they", "them", "their", "what", "which", "who", "whom", "where",
    "when", "why", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "really", "about", "into",
    "over", "under", "between", "through", "during", "before", "after",
    "above", "below", "up", "down", "out", "off", "then", "here", "there",
  ]);
  const words = t.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  // Deduplicate preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/** Generate hashtags based on image description keywords. Returns `count` tags. */
export function generateHashtags(imageDescription: string, count: number): string[] {
  if (count <= 0) return [];
  const keywords = extractKeywords(imageDescription);
  const tags = new Set<string>();
  // 1. Joined topic
  const joined = keywords.join("");
  if (joined) tags.add(`#${joined}`);
  // 2. Per-keyword
  for (const k of keywords) tags.add(`#${k}`);
  // 3. Suffix variations
  const suffixes = [
    "love", "life", "vibes", "daily", "gram", "insta", "tiktok",
    "tik", "explore", "fyp", "foryou", "trending", "2026", "community",
    "loveit", "mood", "moment", "inspo", "goals", "aesthetic",
  ];
  for (const suffix of suffixes) {
    if (tags.size >= count) break;
    if (joined) tags.add(`#${joined}${suffix}`);
  }
  for (const k of keywords) {
    if (tags.size >= count) break;
    tags.add(`#${k}love`);
  }
  for (const k of keywords) {
    if (tags.size >= count) break;
    tags.add(`#${k}life`);
  }
  for (const k of keywords) {
    if (tags.size >= count) break;
    tags.add(`#${k}gram`);
  }
  for (const k of keywords) {
    if (tags.size >= count) break;
    tags.add(`#${k}daily`);
  }
  // 4. Generic social hashtags as filler
  const generic = [
    "#photooftheday", "#instagood", "#love", "#happy", "#picoftheday",
    "#follow", "#followme", "#like4like", "#instadaily", "#beautiful",
    "#explore", "#explorepage", "#viral", "#trending", "#mood",
    "#vibes", "#aesthetic", "#inspo", "#goals", "#daily",
    "#content", "#creator", "#community", "#smallcreator", "#newpost",
    "#fyp", "#foryou", "#tiktok", "#instagram", "#reels",
  ];
  for (const g of generic) {
    if (tags.size >= count) break;
    tags.add(g);
  }
  return Array.from(tags).slice(0, count);
}

/** Generate the hook (first sentence grabber) for a variation. */
export function generateHook(
  mood: Mood,
  imageDescription: string,
  variation: number,
): string {
  const tpl = HOOK_TEMPLATES.find((h) => h.variation === variation) ?? HOOK_TEMPLATES[0];
  const topic = parseImageDescription(imageDescription) || "this moment";
  const cap = capitalize(topic);
  if (tpl.hook === "question") {
    return `Ever just stop and take in ${topic}?`;
  }
  if (tpl.hook === "statement") {
    return `${cap} — that's all I needed today.`;
  }
  return `This started with ${topic} and turned into something more.`;
}

/** Generate the body — picks a template for the mood+length and fills {topic}. */
export function generateBody(
  mood: Mood,
  captionLength: CaptionLength,
  imageDescription: string,
  variation: number,
): string {
  const templates = CAPTION_TEMPLATES[mood][captionLength];
  const topic = parseImageDescription(imageDescription) || "this moment";
  // Pick template by variation (cycle if >3 variations requested)
  const tpl = templates[(variation - 1) % templates.length];
  return tpl.replace(/\{topic\}/g, topic).replace(/\{Topic\}/g, capitalize(topic));
}

/** Generate the CTA for a platform. */
export function generateCTA(platform: Platform, includeCTA: boolean): string {
  if (!includeCTA) return "";
  return PLATFORM_CONFIGS[platform].cta;
}

/** Generate mood-aware emojis. */
export function generateEmojis(mood: Mood, includeEmojis: boolean): string {
  if (!includeEmojis) return "";
  const set = MOOD_EMOJIS[mood] ?? [];
  return set.slice(0, 2).join(" ");
}

/** Validate caption length per platform. Returns true if within limit. */
export function validateCaptionLength(platform: Platform, text: string): boolean {
  return text.length <= PLATFORM_CONFIGS[platform].maxChars;
}

/** Truncate caption to platform max chars (preserving word boundary when possible). */
export function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

/** Compose the full caption from components. */
export function composeCaption(
  hook: string,
  body: string,
  cta: string,
  emojis: string,
  hashtags: string[],
  includeHashtags: boolean,
): string {
  const parts: string[] = [];
  if (emojis) parts.push(emojis);
  if (hook) parts.push(hook);
  if (body) parts.push(body);
  if (cta) parts.push(cta);
  if (includeHashtags && hashtags.length > 0) parts.push(hashtags.join(" "));
  return parts.filter((p) => p && p.trim().length > 0).join("\n\n");
}

/** Count emojis in a string. */
export function countEmojis(text: string): number {
  if (!text) return 0;
  // Match common emoji ranges — surrogate pairs and symbols
  const matches = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu);
  return matches ? matches.length : 0;
}

/** Count hashtags in a string. */
export function countHashtags(text: string): number {
  if (!text) return 0;
  const matches = text.match(/#[\w]+/g);
  return matches ? matches.length : 0;
}

/** Count words in a string. */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Generate a single caption variation. */
export function generateCaption(input: CaptionInput, variation: number): GeneratedCaption {
  const cfg = PLATFORM_CONFIGS[input.platform];
  const hook = generateHook(input.mood, input.imageDescription, variation);
  const body = generateBody(input.mood, input.captionLength, input.imageDescription, variation);
  const cta = generateCTA(input.platform, input.includeCTA);
  const emojis = generateEmojis(input.mood, input.includeEmojis);
  const hashtags = input.includeHashtags
    ? generateHashtags(input.imageDescription, cfg.hashtagCount)
    : [];
  const full = composeCaption(hook, body, cta, emojis, hashtags, input.includeHashtags);
  const withinLimit = validateCaptionLength(input.platform, full);
  const text = truncateToLimit(full, cfg.maxChars);
  return {
    variation,
    hook,
    body,
    cta,
    emojis,
    hashtags,
    fullCaption: text,
    charCount: text.length,
    wordCount: countWords(text),
    emojiCount: countEmojis(text),
    hashtagCount: hashtags.length,
    withinLimit,
  };
}

/** Generate 3 variations for the given input. */
export function generateVariations(input: CaptionInput): GeneratedCaption[] {
  return HOOK_TEMPLATES.map((h) => generateCaption(input, h.variation));
}

/** Compute summary stats across a list of captions. */
export function computeSummaryStats(captions: GeneratedCaption[]): SummaryStats {
  if (captions.length === 0) {
    return {
      totalVariations: 0,
      avgChars: 0,
      avgWords: 0,
      avgHashtags: 0,
      avgEmojis: 0,
      withinLimitCount: 0,
    };
  }
  const totalChars = captions.reduce((s, c) => s + c.charCount, 0);
  const totalWords = captions.reduce((s, c) => s + c.wordCount, 0);
  const totalHashtags = captions.reduce((s, c) => s + c.hashtagCount, 0);
  const totalEmojis = captions.reduce((s, c) => s + c.emojiCount, 0);
  const withinLimitCount = captions.filter((c) => c.withinLimit).length;
  return {
    totalVariations: captions.length,
    avgChars: Math.round(totalChars / captions.length),
    avgWords: Math.round(totalWords / captions.length),
    avgHashtags: Math.round(totalHashtags / captions.length),
    avgEmojis: Math.round(totalEmojis / captions.length),
    withinLimitCount,
  };
}

/** Split a caption into the visible caption and the first-comment hashtag block. */
export function splitFirstComment(caption: GeneratedCaption): {
  visibleCaption: string;
  firstComment: string;
} {
  if (caption.hashtags.length === 0) {
    return { visibleCaption: caption.fullCaption, firstComment: "" };
  }
  const hashtagBlock = caption.hashtags.join(" ");
  // Strip trailing hashtag block from the caption if present
  const visible = caption.fullCaption.replace(/\n*#[\w\s#]+\s*$/u, "").trim();
  return {
    visibleCaption: visible || caption.fullCaption,
    firstComment: hashtagBlock,
  };
}

/** Render caption as a list of components (for CSV-style inspection). */
export function renderComponents(caption: GeneratedCaption): CaptionComponent[] {
  return [
    { key: "variation", value: String(caption.variation) },
    { key: "hook", value: caption.hook },
    { key: "body", value: caption.body },
    { key: "cta", value: caption.cta },
    { key: "emojis", value: caption.emojis },
    { key: "hashtags", value: caption.hashtags.join(" ") },
    { key: "full_caption", value: caption.fullCaption },
    { key: "char_count", value: String(caption.charCount) },
    { key: "word_count", value: String(caption.wordCount) },
    { key: "emoji_count", value: String(caption.emojiCount) },
    { key: "hashtag_count", value: String(caption.hashtagCount) },
    { key: "within_limit", value: caption.withinLimit ? "yes" : "no" },
  ];
}

/** Render captions as plain text (variations separated). */
export function renderText(captions: GeneratedCaption[]): string {
  if (captions.length === 0) return "";
  const blocks: string[] = [];
  for (const c of captions) {
    blocks.push(`=== Variation ${c.variation} ===`);
    blocks.push(`Chars: ${c.charCount} | Words: ${c.wordCount} | Emojis: ${c.emojiCount} | Hashtags: ${c.hashtagCount}${c.withinLimit ? "" : " [OVER LIMIT]"}`);
    blocks.push("");
    blocks.push(c.fullCaption);
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render captions as CSV (component, value per row). */
export function renderCsv(captions: GeneratedCaption[]): string {
  if (captions.length === 0) return "variation,component,value\n";
  const lines = ["variation,component,value"];
  for (const c of captions) {
    for (const comp of renderComponents(c)) {
      lines.push([String(c.variation), comp.key, escapeCsv(comp.value)].join(","));
    }
  }
  return lines.join("\n");
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

const HISTORY_KEY = "unqtools:caption-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  imageDescription: string;
  mood: Mood;
  captionLength: CaptionLength;
  platform: Platform;
  variationCount: number;
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

export function buildShareUrl(input: CaptionInput): string {
  const params = new URLSearchParams();
  if (input.imageDescription) params.set("img", input.imageDescription);
  if (input.mood) params.set("mood", input.mood);
  if (input.captionLength) params.set("len", input.captionLength);
  if (input.platform) params.set("plat", input.platform);
  if (!input.includeEmojis) params.set("emoji", "0");
  if (!input.includeCTA) params.set("cta", "0");
  if (!input.includeHashtags) params.set("htags", "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): CaptionInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: CaptionInput = {
    imageDescription: "",
    mood: "happy",
    captionLength: "medium",
    includeEmojis: true,
    includeCTA: true,
    includeHashtags: true,
    platform: "instagram",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  return {
    imageDescription: params.get("img") ?? "",
    mood: (MOODS.includes(params.get("mood") as Mood) ? params.get("mood") as Mood : "happy"),
    captionLength: (CAPTION_LENGTHS.includes(params.get("len") as CaptionLength)
      ? params.get("len") as CaptionLength
      : "medium"),
    platform: (PLATFORMS.includes(params.get("plat") as Platform) ? params.get("plat") as Platform : "instagram"),
    includeEmojis: params.get("emoji") !== "0",
    includeCTA: params.get("cta") !== "0",
    includeHashtags: params.get("htags") !== "0",
  };
}
