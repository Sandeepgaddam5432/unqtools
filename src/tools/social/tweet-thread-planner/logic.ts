/**
 * Tweet Thread Planner — pure logic.
 *
 * Break long content into numbered tweet-sized chunks with hooks,
 * CTAs, transitions, and tone modifiers. Pure functions only —
 * no DOM, no network.
 */

export type Tone =
  | "informational"
  | "controversial"
  | "storytelling"
  | "listicle"
  | "thread-bois";

export interface ThreadInput {
  mainTopic: string;
  longContent: string;
  tweetsPerThread: number;
  includeNumbering: boolean;
  includeHook: boolean;
  includeCTA: boolean;
  tone: Tone;
}

export interface Tweet {
  num: number;
  content: string;
  charCount: number;
  isHook: boolean;
  isCTA: boolean;
  withinLimit: boolean;
  transition?: string;
}

export interface ThreadResult {
  topic: string;
  tone: Tone;
  tweets: Tweet[];
  totalChars: number;
  avgChars: number;
  hookStrength: number;
  engagementScore: number;
  flowOk: boolean;
  charLimitWarnings: number;
}

export interface SummaryStats {
  totalTweets: number;
  totalChars: number;
  avgCharsPerTweet: number;
  hookStrength: number;
  engagementScore: number;
  withinLimit: number;
  overLimit: number;
  hasHook: boolean;
  hasCTA: boolean;
}

export const TWEET_MAX_CHARS = 280;
export const TWEET_TARGET_CHARS = 240;

export const TONES: Tone[] = [
  "informational",
  "controversial",
  "storytelling",
  "listicle",
  "thread-bois",
];

export const TONE_LABELS: Record<Tone, string> = {
  informational: "Informational",
  controversial: "Controversial",
  storytelling: "Storytelling",
  listicle: "Listicle",
  "thread-bois": "Thread Bois",
};

export const TRANSITIONS: string[] = [
  "But here's the thing:",
  "And that's not all.",
  "So what does this mean?",
  "Here's why it matters:",
  "Plus:",
];

/** Hook prefixes per tone. */
export const HOOK_PREFIXES: Record<Tone, string[]> = {
  informational: [
    "Quick breakdown:",
    "Here's what you need to know:",
    "A clear explanation:",
  ],
  controversial: [
    "Hot take:",
    "Unpopular opinion:",
    "Most people get this wrong:",
  ],
  storytelling: [
    "Story time.",
    "Let me tell you what happened.",
    "A few years ago,",
  ],
  listicle: [
    "X things I learned:",
    "A short list:",
    "Here are the highlights:",
  ],
  "thread-bois": [
    "ok so:",
    "hear me out:",
    "the boys were right:",
  ],
};

/** CTA templates per tone. */
export const CTA_TEMPLATES: Record<Tone, string[]> = {
  informational: [
    "If this was helpful, retweet the first tweet and follow for more.",
    "Found this useful? Reply with your thoughts and follow for more breakdowns.",
  ],
  controversial: [
    "Disagree? Quote-tweet with your take. Follow for more honest opinions.",
    "If this resonated, retweet to start a debate. Follow for more.",
  ],
  storytelling: [
    "If you enjoyed this story, retweet the first tweet and follow for more.",
    "Reply with your own story. Retweet to share. Follow for more.",
  ],
  listicle: [
    "Which one surprised you? Reply with the number. Retweet to share. Follow for more.",
    "Save this thread for later. Retweet to share. Follow for more lists.",
  ],
  "thread-bois": [
    "if u made it this far u have to rt the first tweet and follow. it's the law.",
    "rt the first tweet or ur a coward. follow for more cursed threads.",
  ],
};

/** Best time-to-post suggestion (hour → engagement multiplier). */
export const ENGAGEMENT_BY_HOUR: { hour: number; label: string; multiplier: number }[] = [
  { hour: 0, label: "12am", multiplier: 0.4 },
  { hour: 1, label: "1am", multiplier: 0.3 },
  { hour: 2, label: "2am", multiplier: 0.2 },
  { hour: 3, label: "3am", multiplier: 0.2 },
  { hour: 4, label: "4am", multiplier: 0.2 },
  { hour: 5, label: "5am", multiplier: 0.3 },
  { hour: 6, label: "6am", multiplier: 0.5 },
  { hour: 7, label: "7am", multiplier: 0.7 },
  { hour: 8, label: "8am", multiplier: 1.0 },
  { hour: 9, label: "9am", multiplier: 1.2 },
  { hour: 10, label: "10am", multiplier: 1.3 },
  { hour: 11, label: "11am", multiplier: 1.2 },
  { hour: 12, label: "12pm", multiplier: 1.1 },
  { hour: 13, label: "1pm", multiplier: 1.0 },
  { hour: 14, label: "2pm", multiplier: 0.9 },
  { hour: 15, label: "3pm", multiplier: 1.0 },
  { hour: 16, label: "4pm", multiplier: 1.1 },
  { hour: 17, label: "5pm", multiplier: 1.2 },
  { hour: 18, label: "6pm", multiplier: 1.3 },
  { hour: 19, label: "7pm", multiplier: 1.4 },
  { hour: 20, label: "8pm", multiplier: 1.4 },
  { hour: 21, label: "9pm", multiplier: 1.3 },
  { hour: 22, label: "10pm", multiplier: 1.0 },
  { hour: 23, label: "11pm", multiplier: 0.6 },
];

/** Normalize whitespace. */
export function normalizeContent(s: string): string {
  return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

/** Split content into sentences, preserving terminators. */
export function splitSentences(text: string): string[] {
  const t = normalizeContent(text);
  if (!t) return [];
  // Match sequences ending with ., !, ?, or end of line (paragraph).
  const matches = t.match(/[^.!?\n]+[.!?]*\s*/g);
  if (!matches) return [t];
  return matches
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Estimate the number of tweets needed (based on 240 chars per tweet). */
export function estimateTweetCount(content: string): number {
  const c = normalizeContent(content);
  if (!c) return 0;
  return Math.max(1, Math.ceil(c.length / TWEET_TARGET_CHARS));
}

/** Chunk a long string into pieces ≤ maxChars, preferring sentence boundaries. */
export function chunkByCharLimit(text: string, maxChars: number): string[] {
  const t = normalizeContent(text);
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const sentences = splitSentences(t);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      // sentence itself is too long — hard-wrap by words
      if (cur) { out.push(cur.trim()); cur = ""; }
      const words = s.split(/\s+/);
      let buf = "";
      for (const w of words) {
        if ((buf + " " + w).trim().length > maxChars) {
          if (buf) out.push(buf.trim());
          buf = w;
        } else {
          buf = buf ? `${buf} ${w}` : w;
        }
      }
      if (buf) out.push(buf.trim());
      continue;
    }
    const candidate = cur ? `${cur} ${s}` : s;
    if (candidate.length > maxChars) {
      if (cur) out.push(cur.trim());
      cur = s;
    } else {
      cur = candidate;
    }
  }
  if (cur) out.push(cur.trim());
  return out;
}

/** Score a sentence's "hook strength" (0-100). */
export function scoreHookStrength(sentence: string): number {
  if (!sentence) return 0;
  let score = 30;
  const s = sentence.toLowerCase();
  // Numbers/questions/lists are strong
  if (/\d/.test(sentence)) score += 15;
  if (sentence.includes("?")) score += 15;
  if (/^(why|how|what|when|who|where|which)\b/i.test(sentence)) score += 10;
  if (/\b(secret|truth|mistake|never|always|nobody|everyone)\b/i.test(s)) score += 15;
  if (/\b(stop|warning|breaking|hot take|unpopular)\b/i.test(s)) score += 10;
  // Long enough but not too long
  if (sentence.length >= 40 && sentence.length <= 200) score += 10;
  if (sentence.length > 200) score -= 5;
  return Math.max(0, Math.min(100, score));
}

/** Pick the most engaging sentence as the hook. */
export function pickHookSentence(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  let best = sentences[0];
  let bestScore = -1;
  for (const s of sentences) {
    const sc = scoreHookStrength(s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best;
}

/** Build a hook tweet from content + tone. */
export function buildHookTweet(topic: string, content: string, tone: Tone): string {
  const prefixes = HOOK_PREFIXES[tone];
  const prefix = prefixes[0];
  const hook = pickHookSentence(content);
  if (!hook) return `${prefix} ${topic}`.trim();
  let out = `${prefix} ${hook}`.trim();
  if (out.length > TWEET_MAX_CHARS) {
    out = out.slice(0, TWEET_MAX_CHARS - 1).trim() + "…";
  }
  return out;
}

/** Build a CTA tweet for the given tone. */
export function buildCTATweet(tone: Tone): string {
  return CTA_TEMPLATES[tone][0];
}

/** Apply a tone modifier to a tweet (prefix or rephrase for tone). */
export function applyToneModifier(content: string, tone: Tone, index: number): string {
  const t = normalizeContent(content);
  if (!t) return "";
  switch (tone) {
    case "thread-bois": {
      // Lowercase first letter for the casual voice, occasional "ngl"
      if (index > 0 && index % 3 === 0) {
        return `ngl, ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
      }
      return `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    }
    case "controversial": {
      // Occasionally prepend a contrarian marker
      if (index > 0 && index % 4 === 0) return `Contrarian view: ${t}`;
      return t;
    }
    case "listicle": {
      // If the content looks like an item, ensure it's scannable
      if (/^\d+\./.test(t)) return t;
      return t;
    }
    case "storytelling": {
      if (index > 0 && index % 5 === 0) return `And then — ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
      return t;
    }
    case "informational":
    default:
      return t;
  }
}

/** Insert a transition word before a tweet (rotates through TRANSITIONS). */
export function pickTransition(index: number): string {
  if (index <= 0) return "";
  return TRANSITIONS[(index - 1) % TRANSITIONS.length];
}

/** Apply numbering prefix (1/, 2/, 3/ ...). */
export function applyNumbering(content: string, num: number, total: number, enabled: boolean): string {
  if (!enabled) return content;
  return `${num}/${total} ${content}`.trim();
}

/** Validate thread flow: each tweet should connect (non-empty, no duplicate repetition). */
export function validateFlow(tweets: Tweet[]): boolean {
  if (tweets.length === 0) return false;
  if (tweets.length === 1) return true;
  const seen = new Set<string>();
  for (const t of tweets) {
    const key = t.content.toLowerCase().trim();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** Count char-limit warnings (tweets exceeding the limit). */
export function countCharLimitWarnings(tweets: Tweet[]): number {
  return tweets.filter((t) => !t.withinLimit).length;
}

/** Compute hook strength for the thread (uses first hook tweet, or first tweet). */
export function computeHookStrength(tweets: Tweet[]): number {
  if (tweets.length === 0) return 0;
  const hook = tweets.find((t) => t.isHook) ?? tweets[0];
  return scoreHookStrength(hook.content);
}

/** Estimate engagement score (0-100). */
export function computeEngagementScore(
  tweets: Tweet[],
  hasHook: boolean,
  hasCTA: boolean,
): number {
  if (tweets.length === 0) return 0;
  let score = 40;
  // Thread length sweet spot is 4-10
  const n = tweets.length;
  if (n >= 4 && n <= 10) score += 15;
  else if (n >= 3 && n <= 12) score += 8;
  else if (n > 15) score -= 5;
  // Hook present
  if (hasHook) score += 15;
  // CTA present
  if (hasCTA) score += 15;
  // Hook strength
  const hs = computeHookStrength(tweets);
  score += Math.round(hs * 0.1);
  // Char-limit adherence
  const over = countCharLimitWarnings(tweets);
  if (over === 0) score += 10;
  else score -= over * 3;
  // Average length per tweet (sweet spot ~180-240)
  const avg = tweets.reduce((s, t) => s + t.charCount, 0) / n;
  if (avg >= 150 && avg <= 250) score += 5;
  return Math.max(0, Math.min(100, score));
}

/** Build the full thread from input. */
export function buildThread(input: ThreadInput): ThreadResult {
  const topic = normalizeContent(input.mainTopic);
  const content = normalizeContent(input.longContent);
  if (!content) {
    return {
      topic,
      tone: input.tone,
      tweets: [],
      totalChars: 0,
      avgChars: 0,
      hookStrength: 0,
      engagementScore: 0,
      flowOk: false,
      charLimitWarnings: 0,
    };
  }
  // 1. Build hook + CTA, then split the rest.
  const hookTweet = input.includeHook ? buildHookTweet(topic, content, input.tone) : "";
  const ctaTweet = input.includeCTA ? buildCTATweet(input.tone) : "";

  // 2. Remove the hook sentence from content if used.
  let bodyContent = content;
  if (input.includeHook) {
    const hookSentence = pickHookSentence(content);
    if (hookSentence) {
      // Remove first occurrence (case-insensitive)
      const idx = bodyContent.toLowerCase().indexOf(hookSentence.toLowerCase());
      if (idx >= 0) {
        bodyContent = (bodyContent.slice(0, idx) + bodyContent.slice(idx + hookSentence.length)).trim();
      }
    }
  }

  // 3. Split body into chunks (account for numbering overhead: ~5-8 chars).
  const numberingOverhead = input.includeNumbering ? 8 : 0;
  const chunkMax = TWEET_MAX_CHARS - numberingOverhead;
  let bodyChunks = chunkByCharLimit(bodyContent, chunkMax);

  // 4. Cap to tweetsPerThread (subtract hook + cta slots).
  const reservedSlots = (input.includeHook ? 1 : 0) + (input.includeCTA ? 1 : 0);
  const bodySlots = Math.max(1, input.tweetsPerThread - reservedSlots);
  if (bodyChunks.length > bodySlots) {
    // Merge tail to fit. Keep first bodySlots-1 chunks, merge the rest into the last.
    const head = bodyChunks.slice(0, bodySlots - 1);
    const tail = bodyChunks.slice(bodySlots - 1).join(" ");
    // If the merged tail is too long, just truncate with ellipsis.
    const tailTrimmed = tail.length > chunkMax
      ? tail.slice(0, chunkMax - 1).trim() + "…"
      : tail;
    bodyChunks = [...head, tailTrimmed];
  }

  // 5. Assemble raw tweet contents (pre-numbering) with tone modifiers + transitions.
  const rawTweets: { content: string; isHook: boolean; isCTA: boolean; transition?: string }[] = [];
  let bodyIdx = 0;
  if (input.includeHook) {
    rawTweets.push({ content: hookTweet, isHook: true, isCTA: false });
  }
  for (const chunk of bodyChunks) {
    const transition = pickTransition(rawTweets.length);
    const toned = applyToneModifier(chunk, input.tone, bodyIdx);
    rawTweets.push({ content: toned, isHook: false, isCTA: false, transition });
    bodyIdx += 1;
  }
  if (input.includeCTA) {
    rawTweets.push({ content: ctaTweet, isHook: false, isCTA: true });
  }

  // 6. Apply numbering + char-limit validation.
  const total = rawTweets.length;
  const tweets: Tweet[] = rawTweets.map((r, i) => {
    const withNumber = applyNumbering(r.content, i + 1, total, input.includeNumbering);
    const charCount = withNumber.length;
    return {
      num: i + 1,
      content: withNumber,
      charCount,
      isHook: r.isHook,
      isCTA: r.isCTA,
      withinLimit: charCount <= TWEET_MAX_CHARS,
      transition: r.transition,
    };
  });

  const totalChars = tweets.reduce((s, t) => s + t.charCount, 0);
  const avgChars = tweets.length > 0 ? Math.round(totalChars / tweets.length) : 0;
  const hookStrength = computeHookStrength(tweets);
  const engagementScore = computeEngagementScore(tweets, input.includeHook, input.includeCTA);
  const flowOk = validateFlow(tweets);
  const charLimitWarnings = countCharLimitWarnings(tweets);

  return {
    topic,
    tone: input.tone,
    tweets,
    totalChars,
    avgChars,
    hookStrength,
    engagementScore,
    flowOk,
    charLimitWarnings,
  };
}

/** Generate 2 alt-variations of the thread (different hooks). */
export function buildAltVariations(input: ThreadInput): ThreadResult[] {
  const tonesPool: Tone[] = TONES.filter((t) => t !== input.tone);
  // Pick 2 distinct tones (cycle if pool is small)
  const variations: ThreadResult[] = [];
  const pool = tonesPool.length >= 2 ? tonesPool : TONES;
  const v1Tone = pool[0];
  const v2Tone = pool[1 % pool.length];
  variations.push(buildThread({ ...input, tone: v1Tone, tweetsPerThread: Math.max(4, input.tweetsPerThread - 1) }));
  variations.push(buildThread({ ...input, tone: v2Tone, tweetsPerThread: Math.min(15, input.tweetsPerThread + 1) }));
  return variations;
}

/** Compute summary stats over a thread result. */
export function computeSummaryStats(result: ThreadResult): SummaryStats {
  const { tweets } = result;
  const totalTweets = tweets.length;
  const totalChars = tweets.reduce((s, t) => s + t.charCount, 0);
  const avgCharsPerTweet = totalTweets > 0 ? Math.round(totalChars / totalTweets) : 0;
  const withinLimit = tweets.filter((t) => t.withinLimit).length;
  const overLimit = totalTweets - withinLimit;
  return {
    totalTweets,
    totalChars,
    avgCharsPerTweet,
    hookStrength: result.hookStrength,
    engagementScore: result.engagementScore,
    withinLimit,
    overLimit,
    hasHook: tweets.some((t) => t.isHook),
    hasCTA: tweets.some((t) => t.isCTA),
  };
}

/** Render a thread as plain text. */
export function renderText(result: ThreadResult): string {
  if (result.tweets.length === 0) return "";
  return result.tweets.map((t) => t.content).join("\n\n");
}

/** Render a thread as CSV. */
export function renderCsv(result: ThreadResult): string {
  const lines = ["tweet_num,content,char_count,is_hook,is_cta"];
  for (const t of result.tweets) {
    lines.push([
      String(t.num),
      escapeCsv(t.content),
      String(t.charCount),
      t.isHook ? "true" : "false",
      t.isCTA ? "true" : "false",
    ].join(","));
  }
  return lines.join("\n");
}

/** Split a CSV row that may contain quoted commas. */
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

/** Find the best time-of-day to post (returns the top 3 hours). */
export function bestTimeToPost(): { hour: number; label: string; multiplier: number }[] {
  return [...ENGAGEMENT_BY_HOUR]
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 3);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:tweet-thread-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: string;
  tone: Tone;
  tweetCount: number;
  engagementScore: number;
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

export function buildShareUrl(input: ThreadInput): string {
  const params = new URLSearchParams();
  if (input.mainTopic) params.set("topic", input.mainTopic);
  if (input.longContent) params.set("content", input.longContent);
  params.set("n", String(input.tweetsPerThread));
  params.set("num", input.includeNumbering ? "1" : "0");
  params.set("hook", input.includeHook ? "1" : "0");
  params.set("cta", input.includeCTA ? "1" : "0");
  params.set("tone", input.tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ThreadInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      mainTopic: "",
      longContent: "",
      tweetsPerThread: 7,
      includeNumbering: true,
      includeHook: true,
      includeCTA: true,
      tone: "informational",
    };
  }
  const params = new URLSearchParams(clean);
  const n = parseInt(params.get("n") ?? "7", 10);
  return {
    mainTopic: params.get("topic") ?? "",
    longContent: params.get("content") ?? "",
    tweetsPerThread: Number.isFinite(n) && n > 0 ? n : 7,
    includeNumbering: params.get("num") !== "0",
    includeHook: params.get("hook") !== "0",
    includeCTA: params.get("cta") !== "0",
    tone: (TONES.includes(params.get("tone") as Tone) ? params.get("tone") : "informational") as Tone,
  };
}
