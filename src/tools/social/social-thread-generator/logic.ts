/**
 * Social Thread Generator — pure logic.
 * Split text by sentences/chars, number threads, char limit per platform.
 */

export interface ThreadSpec {
  id: string;
  name: string;
  charLimit: number;
  recommendedCharLimit: number;
  maxThreadLength: number;
  notes: string;
}

export const THREAD_PLATFORMS: ThreadSpec[] = [
  { id: "twitter", name: "Twitter / X", charLimit: 280, recommendedCharLimit: 270, maxThreadLength: 25, notes: "Reserve 10 chars for thread numbering (1/N)." },
  { id: "threads", name: "Threads", charLimit: 500, recommendedCharLimit: 490, maxThreadLength: 50, notes: "Longer limit, but shorter reads better." },
  { id: "mastodon", name: "Mastodon", charLimit: 500, recommendedCharLimit: 490, maxThreadLength: 30, notes: "Instance-dependent; 500 is common default." },
  { id: "bluesky", name: "Bluesky", charLimit: 300, recommendedCharLimit: 290, maxThreadLength: 25, notes: "300 char limit per post." },
  { id: "linkedin", name: "LinkedIn", charLimit: 3000, recommendedCharLimit: 2900, maxThreadLength: 5, notes: "Long-form posts work better than threads here." },
];

export function getThreadPlatform(id: string): ThreadSpec | null {
  return THREAD_PLATFORMS.find((p) => p.id === id) ?? null;
}

export function getAllThreadPlatforms(): ThreadSpec[] {
  return [...THREAD_PLATFORMS];
}

/** Split text into sentences (very rough). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Greedy pack sentences into chunks of maxLen chars. */
export function packSentences(sentences: string[], maxLen: number): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const candidate = cur ? `${cur} ${s}` : s;
    if (candidate.length > maxLen && cur) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Hard-split a long sentence into chunks of maxLen chars (at word boundaries). */
export function hardSplit(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > maxLen) {
      // Word itself longer than maxLen — slice it.
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += maxLen) {
        chunks.push(w.slice(i, i + maxLen));
      }
    } else {
      const candidate = cur ? `${cur} ${w}` : w;
      if (candidate.length > maxLen) {
        chunks.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export interface ThreadPost {
  index: number; // 1-based
  total: number;
  text: string;
  charCount: number;
  isLast: boolean;
}

/** Generate a numbered thread from a long text. */
export function generateThread(text: string, platform: ThreadSpec, reserveForNumber = 6): ThreadPost[] {
  const limit = platform.recommendedCharLimit - reserveForNumber;
  const sentences = splitSentences(text);
  let chunks = packSentences(sentences, limit);
  // If any chunk still exceeds limit (a single sentence too long), hard-split.
  const expanded: string[] = [];
  for (const c of chunks) {
    if (c.length > limit) expanded.push(...hardSplit(c, limit));
    else expanded.push(c);
  }
  chunks = expanded;
  if (chunks.length > platform.maxThreadLength) {
    chunks = chunks.slice(0, platform.maxThreadLength);
  }
  const total = chunks.length;
  return chunks.map((c, i) => {
    const numbered = `${i + 1}/${total} ${c}`;
    return {
      index: i + 1,
      total,
      text: numbered,
      charCount: numbered.length,
      isLast: i === total - 1,
    };
  });
}

/** Count total chars across a thread. */
export function totalThreadChars(posts: ThreadPost[]): number {
  return posts.reduce((s, p) => s + p.charCount, 0);
}

/** Validate a thread against platform constraints. */
export function validateThread(posts: ThreadPost[], platform: ThreadSpec): string[] {
  const w: string[] = [];
  if (posts.length === 0) w.push("Thread is empty.");
  if (posts.length > platform.maxThreadLength) w.push(`Thread exceeds ${platform.name} max length of ${platform.maxThreadLength}.`);
  for (const p of posts) {
    if (p.charCount > platform.charLimit) w.push(`Post ${p.index} exceeds ${platform.charLimit} char limit (${p.charCount}).`);
  }
  return w;
}

/** Suggest hook (first-post opener) based on topic keyword. */
export function suggestHook(topic: string): string[] {
  const t = topic.trim() || "this topic";
  return [
    `Here's everything you need to know about ${t} 🧵`,
    `A short thread on ${t} 👇`,
    `I spent a week studying ${t}. Here's what I learned:`,
    `Unpopular opinion about ${t}:`,
    `${t} — the definitive thread 🧵`,
  ];
}

/** Build a single-string summary of the thread (paste-ready). */
export function exportThreadText(posts: ThreadPost[]): string {
  return posts.map((p) => `--- Post ${p.index}/${p.total} (${p.charCount} chars) ---\n${p.text}`).join("\n\n");
}

/** Build a JSON representation. */
export function exportThreadJSON(posts: ThreadPost[]): string {
  return JSON.stringify(posts, null, 2);
}

/** Build a CSV with one row per post. */
export function exportThreadCSV(posts: ThreadPost[]): string {
  const header = ["index", "total", "char_count", "text"];
  const rows = posts.map((p) => [p.index, p.total, p.charCount, `"${p.text.replace(/"/g, '""')}"`].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** Estimate reading time for the entire thread (200 wpm). */
export function readingTimeSec(posts: ThreadPost[]): number {
  const totalWords = posts.reduce((s, p) => s + p.text.split(/\s+/).filter(Boolean).length, 0);
  return Math.round((totalWords / 200) * 60);
}

/** Find the longest post (potential trim candidate). */
export function longestPost(posts: ThreadPost[]): ThreadPost | null {
  if (posts.length === 0) return null;
  return [...posts].sort((a, b) => b.charCount - a.charCount)[0];
}

/** Merge thread into a single blob (reverse of generation). */
export function mergeThread(posts: ThreadPost[]): string {
  return posts
    .map((p) => p.text.replace(/^\d+\/\d+\s*/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Optimize posts: trim trailing whitespace, collapse internal spaces. */
export function optimizePosts(posts: ThreadPost[]): ThreadPost[] {
  return posts.map((p) => ({
    ...p,
    text: p.text.replace(/\s+/g, " ").trim(),
    charCount: p.text.replace(/\s+/g, " ").trim().length,
  }));
}

/** Suggest a closing CTA. */
export function suggestCTA(): string[] {
  return [
    "If you found this helpful, retweet the first post 🙏",
    "Follow me for more threads like this.",
    "What would you add? Drop a reply 👇",
    "Bookmark this thread for later.",
    "Share with someone who needs to see this.",
  ];
}
