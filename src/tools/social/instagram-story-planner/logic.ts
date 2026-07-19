/**
 * Instagram Story Planner — pure logic.
 *
 * Plan story sequences with text overlays, stickers, polls, and
 * questions. Pure functions only — no DOM, no network.
 */

export type StoryType =
  | "announcement"
  | "tutorial"
  | "behind-the-scenes"
  | "q-and-a"
  | "poll"
  | "list"
  | "story-time";

export type Tone = "casual" | "professional" | "playful" | "urgent";

export type StickerType =
  | "poll"
  | "question"
  | "link"
  | "location"
  | "mention"
  | "hashtag";

export interface StoryInput {
  storyTopic: string;
  slideCount: number;
  storyType: StoryType;
  includePolls: boolean;
  includeQuestions: boolean;
  includeLinks: boolean;
  tone: Tone;
}

export interface Slide {
  num: number;
  type: string;
  textOverlay: string;
  stickers: StickerType[];
  durationSec: number;
  isHook: boolean;
  isCTA: boolean;
}

export interface StoryResult {
  topic: string;
  storyType: StoryType;
  tone: Tone;
  slides: Slide[];
  totalDurationSec: number;
  hasHook: boolean;
  hasCTA: boolean;
  flowOk: boolean;
  stickerCounts: Record<StickerType, number>;
  slideTypeCounts: Record<string, number>;
  musicSuggestion: string;
}

export interface SummaryStats {
  totalSlides: number;
  totalDurationSec: number;
  avgDurationSec: number;
  bySticker: Record<StickerType, number>;
  byType: Record<string, number>;
  hasHook: boolean;
  hasCTA: boolean;
  flowOk: boolean;
}

export const STORY_TYPES: StoryType[] = [
  "announcement",
  "tutorial",
  "behind-the-scenes",
  "q-and-a",
  "poll",
  "list",
  "story-time",
];

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  "announcement": "Announcement",
  "tutorial": "Tutorial",
  "behind-the-scenes": "Behind the Scenes",
  "q-and-a": "Q&A",
  "poll": "Poll",
  "list": "List",
  "story-time": "Story Time",
};

export const TONES: Tone[] = ["casual", "professional", "playful", "urgent"];

export const TONE_LABELS: Record<Tone, string> = {
  casual: "Casual",
  professional: "Professional",
  playful: "Playful",
  urgent: "Urgent",
};

export const STICKER_TYPES: StickerType[] = [
  "poll",
  "question",
  "link",
  "location",
  "mention",
  "hashtag",
];

export const STICKER_LABELS: Record<StickerType, string> = {
  poll: "Poll",
  question: "Question",
  link: "Link",
  location: "Location",
  mention: "Mention",
  hashtag: "Hashtag",
};

/** Per-story-type slide template sequence. */
export const STORY_TEMPLATES: Record<StoryType, string[]> = {
  "announcement": ["hook", "context", "details", "cta", "link"],
  "tutorial": ["intro", "step", "step", "step", "result", "recap", "cta"],
  "behind-the-scenes": ["hook", "context", "process", "outcome", "thanks"],
  "q-and-a": ["intro", "question", "answer", "question", "answer", "closing"],
  "poll": ["hook", "poll", "poll", "results", "context", "cta"],
  "list": ["intro", "item", "item", "item", "recap", "cta"],
  "story-time": ["hook", "context", "story", "resolution", "takeaway"],
};

/** Per-story-type music suggestion (mood → genre). */
export const MUSIC_SUGGESTIONS: Record<StoryType, string> = {
  "announcement": "Upbeat pop / instrumental build",
  "tutorial": "Lo-fi chillhop / soft instrumental",
  "behind-the-scenes": "Indie folk / acoustic warm",
  "q-and-a": "Ambient pad / soft electronic",
  "poll": "Trending TikTok audio / energetic pop",
  "list": "Upbeat indie pop / synthwave",
  "story-time": "Cinematic strings / emotional piano",
};

/** Tone prefix applied to hook slides. */
export const HOOK_PREFIXES: Record<Tone, string[]> = {
  casual: ["psa:", "ok so —", "real talk:"],
  professional: ["Announcement:", "Important update:", "Quick note:"],
  playful: ["guess what?!", "ok hear me out ✨", "big news! 🎉"],
  urgent: ["Last chance:", "Act fast:", "Time-sensitive:"],
};

/** CTA templates per tone. */
export const CTA_TEMPLATES: Record<Tone, string[]> = {
  casual: ["reply if u relate", "share if this hit", "dm me for more"],
  professional: ["DM for details", "Link in bio for more", "Reach out to learn more"],
  playful: ["tap that heart if u agree 💖", "swipe up for chaos ✨", "share with a friend who needs this 🫶"],
  urgent: ["Act now — link in bio", "Limited time — DM 'YES'", "Don't miss out — share now"],
};

/** Normalize whitespace. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Default slide count per story type (when input omitted). */
export function defaultSlideCount(storyType: StoryType): number {
  return STORY_TEMPLATES[storyType].length;
}

/** Build the template sequence, expanded/truncated to the target slide count. */
export function buildTemplateSequence(storyType: StoryType, target: number): string[] {
  const base = STORY_TEMPLATES[storyType];
  if (target <= base.length) return base.slice(0, target);
  // Expand by repeating middle slot types based on story type
  const out = [...base];
  const repeatSlot: Record<StoryType, string> = {
    "tutorial": "step",
    "list": "item",
    "q-and-a": "question",
    "poll": "poll",
    "announcement": "details",
    "behind-the-scenes": "process",
    "story-time": "story",
  };
  const slot = repeatSlot[storyType];
  // Insert repeats before the final 1-2 slots (cta/recap/closing)
  const tailLen = storyType === "tutorial" ? 3 : storyType === "list" ? 2 : 2;
  while (out.length < target) {
    out.splice(out.length - tailLen, 0, slot);
  }
  return out;
}

/** Pick a hook prefix for the given tone (deterministic by index). */
export function pickHookPrefix(tone: Tone, index = 0): string {
  const arr = HOOK_PREFIXES[tone];
  return arr[index % arr.length];
}

/** Pick a CTA template for the given tone (deterministic by index). */
export function pickCTA(tone: Tone, index = 0): string {
  const arr = CTA_TEMPLATES[tone];
  return arr[index % arr.length];
}

/** Generate a concise text overlay for a slide type + topic + tone. */
export function generateSlideText(
  slideType: string,
  topic: string,
  tone: Tone,
  index: number,
): string {
  const t = normalizeTopic(topic) || "your story";
  const num = index + 1;
  switch (slideType) {
    case "hook":
      return `${pickHookPrefix(tone, 0)} ${t}`.trim();
    case "intro":
      return tone === "professional"
        ? `Today: ${t}.`
        : `Let's talk ${t}.`;
    case "context":
      return `Here's why ${t} matters.`;
    case "details":
      return `Key details on ${t} — slide ${num}.`;
    case "process":
      return `How we did ${t}.`;
    case "outcome":
      return `The result for ${t}.`;
    case "thanks":
      return `Thanks for following along — ${t} continues.`;
    case "step":
      return `Step ${num}: ${t} in action.`;
    case "result":
      return `Here's the result — ${t}!`;
    case "recap":
      return `Quick recap of ${t}.`;
    case "question":
      return tone === "playful"
        ? `Question for u: ${t}?`
        : `Question: ${t}?`;
    case "answer":
      return `Answer: ${t} — here's the take.`;
    case "closing":
      return `That's a wrap on ${t}.`;
    case "poll":
      return `Poll: which side of ${t} are you on?`;
    case "results":
      return `Results are in for ${t} 👀`;
    case "item":
      return `Item ${num}: ${t}.`;
    case "story":
      return `The story behind ${t} — part ${num}.`;
    case "resolution":
      return `How ${t} resolved.`;
    case "takeaway":
      return `Takeaway from ${t}: it's never just one thing.`;
    case "cta":
      return pickCTA(tone, 0);
    case "link":
      return `Tap the link sticker for ${t}.`;
    default:
      return `${t}`;
  }
}

/** Recommend stickers for a slide based on its type + input flags. */
export function recommendStickers(
  slideType: string,
  input: StoryInput,
  slideIndex: number,
): StickerType[] {
  const out: StickerType[] = [];
  switch (slideType) {
    case "hook":
      out.push("hashtag");
      break;
    case "intro":
      out.push("mention");
      break;
    case "context":
      out.push("location");
      break;
    case "process":
      out.push("mention");
      break;
    case "poll":
      if (input.includePolls) out.push("poll");
      break;
    case "question":
      if (input.includeQuestions) out.push("question");
      break;
    case "link":
      if (input.includeLinks) out.push("link");
      break;
    case "cta":
      if (input.includeLinks) out.push("link");
      out.push("mention");
      break;
    case "results":
      out.push("hashtag");
      break;
    case "recap":
    case "closing":
      out.push("hashtag");
      break;
    default:
      break;
  }
  // Mention sticker on every 4th slide if it's not already there
  if (slideIndex > 0 && slideIndex % 4 === 0 && !out.includes("mention")) {
    out.push("mention");
  }
  return out;
}

/** Compute slide duration (3-15 seconds) based on text length + slide type. */
export function computeSlideDuration(slideType: string, textOverlay: string): number {
  const len = textOverlay.length;
  // Base by type
  let base = 5;
  if (slideType === "hook") base = 8;
  else if (slideType === "cta") base = 7;
  else if (slideType === "poll" || slideType === "question") base = 12;
  else if (slideType === "intro" || slideType === "context") base = 6;
  else if (slideType === "result" || slideType === "takeaway") base = 7;
  // Add 1s per 30 chars above 30, capped
  if (len > 30) base += Math.min(5, Math.floor((len - 30) / 30));
  return Math.max(3, Math.min(15, base));
}

/** Build the full story sequence. */
export function buildStory(input: StoryInput): StoryResult {
  const topic = normalizeTopic(input.storyTopic);
  const storyType = input.storyType;
  const tone = input.tone;
  if (!topic) {
    return {
      topic: "",
      storyType,
      tone,
      slides: [],
      totalDurationSec: 0,
      hasHook: false,
      hasCTA: false,
      flowOk: false,
      stickerCounts: emptyStickerCounts(),
      slideTypeCounts: {},
      musicSuggestion: MUSIC_SUGGESTIONS[storyType],
    };
  }
  const target = Math.max(3, Math.min(15, input.slideCount));
  const seq = buildTemplateSequence(storyType, target);
  const slides: Slide[] = seq.map((st, i) => {
    const text = generateSlideText(st, topic, tone, i);
    const stickers = recommendStickers(st, input, i);
    const duration = computeSlideDuration(st, text);
    return {
      num: i + 1,
      type: st,
      textOverlay: text,
      stickers,
      durationSec: duration,
      isHook: st === "hook" || (i === 0 && (st === "intro" || st === "announcement")),
      isCTA: st === "cta" || (i === seq.length - 1 && (st === "closing" || st === "takeaway" || st === "thanks" || st === "link")),
    };
  });
  // Ensure first slide is marked hook (templates may start with "intro" instead)
  if (slides.length > 0 && !slides.some((s) => s.isHook)) {
    slides[0].isHook = true;
  }
  // Ensure last slide is marked CTA if no cta/closing/thanks present
  if (slides.length > 0 && !slides.some((s) => s.isCTA)) {
    slides[slides.length - 1].isCTA = true;
  }

  const totalDurationSec = slides.reduce((s, x) => s + x.durationSec, 0);
  const hasHook = slides.some((s) => s.isHook);
  const hasCTA = slides.some((s) => s.isCTA);
  const flowOk = validateFlow(slides, storyType);
  const stickerCounts = countStickers(slides);
  const slideTypeCounts = countSlideTypes(slides);

  return {
    topic,
    storyType,
    tone,
    slides,
    totalDurationSec,
    hasHook,
    hasCTA,
    flowOk,
    stickerCounts,
    slideTypeCounts,
    musicSuggestion: MUSIC_SUGGESTIONS[storyType],
  };
}

/** Validate that the sequence has hook + CTA and follows a logical progression. */
export function validateFlow(slides: Slide[], storyType: StoryType): boolean {
  if (slides.length === 0) return false;
  if (slides.length < 3) return false;
  const hasHook = slides.some((s) => s.isHook);
  const hasCTA = slides.some((s) => s.isCTA);
  if (!hasHook || !hasCTA) return false;
  // Story-type-specific flow checks
  const types = slides.map((s) => s.type);
  switch (storyType) {
    case "tutorial": {
      const hasStep = types.includes("step");
      const hasResult = types.includes("result");
      return hasStep && hasResult;
    }
    case "list": {
      const itemCount = types.filter((t) => t === "item").length;
      return itemCount >= 2;
    }
    case "q-and-a": {
      const qCount = types.filter((t) => t === "question").length;
      const aCount = types.filter((t) => t === "answer").length;
      return qCount >= 1 && aCount >= 1;
    }
    case "poll": {
      const pollCount = types.filter((t) => t === "poll").length;
      return pollCount >= 1;
    }
    case "story-time": {
      return types.includes("story") && types.includes("resolution");
    }
    case "announcement": {
      return types.includes("context") || types.includes("details");
    }
    case "behind-the-scenes": {
      return types.includes("process") || types.includes("outcome");
    }
    default:
      return true;
  }
}

function emptyStickerCounts(): Record<StickerType, number> {
  return {
    poll: 0, question: 0, link: 0, location: 0, mention: 0, hashtag: 0,
  };
}

/** Count stickers across all slides. */
export function countStickers(slides: Slide[]): Record<StickerType, number> {
  const out = emptyStickerCounts();
  for (const s of slides) {
    for (const st of s.stickers) {
      out[st] += 1;
    }
  }
  return out;
}

/** Count slide types across all slides. */
export function countSlideTypes(slides: Slide[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of slides) {
    out[s.type] = (out[s.type] ?? 0) + 1;
  }
  return out;
}

/** Build a poll slide (question + 2 options). */
export function buildPollSlide(topic: string, question: string, optionA: string, optionB: string): Slide {
  return {
    num: 0, // assigned by sequence builder
    type: "poll",
    textOverlay: question || `Which side of ${topic || "this"} are you on?`,
    stickers: ["poll"],
    durationSec: 12,
    isHook: false,
    isCTA: false,
  };
}

/** Build a question sticker slide. */
export function buildQuestionSlide(prompt: string): Slide {
  return {
    num: 0,
    type: "question",
    textOverlay: prompt || "Ask me anything 👇",
    stickers: ["question"],
    durationSec: 12,
    isHook: false,
    isCTA: false,
  };
}

/** Build a link sticker slide (with URL). */
export function buildLinkSlide(url: string, topic: string): Slide {
  const safe = (url || "").trim();
  return {
    num: 0,
    type: "link",
    textOverlay: safe ? `Tap the link sticker → ${safe}` : `Tap the link sticker for ${topic || "more"}.`,
    stickers: ["link"],
    durationSec: 8,
    isHook: false,
    isCTA: false,
  };
}

/** Generate 2 alt-variations of the story (different tones + slide counts). */
export function buildAltVariations(input: StoryInput): StoryResult[] {
  const tonesPool: Tone[] = TONES.filter((t) => t !== input.tone);
  const pool = tonesPool.length >= 2 ? tonesPool : TONES;
  const v1Tone = pool[0];
  const v2Tone = pool[1 % pool.length];
  return [
    buildStory({ ...input, tone: v1Tone, slideCount: Math.max(3, input.slideCount - 1) }),
    buildStory({ ...input, tone: v2Tone, slideCount: Math.min(15, input.slideCount + 1) }),
  ];
}

/** Compute summary stats. */
export function computeSummaryStats(result: StoryResult): SummaryStats {
  const { slides } = result;
  const totalSlides = slides.length;
  const totalDurationSec = slides.reduce((s, x) => s + x.durationSec, 0);
  const avgDurationSec = totalSlides > 0 ? Math.round((totalDurationSec / totalSlides) * 10) / 10 : 0;
  return {
    totalSlides,
    totalDurationSec,
    avgDurationSec,
    bySticker: result.stickerCounts,
    byType: result.slideTypeCounts,
    hasHook: result.hasHook,
    hasCTA: result.hasCTA,
    flowOk: result.flowOk,
  };
}

/** Render the storyboard as plain text. */
export function renderText(result: StoryResult): string {
  if (result.slides.length === 0) return "";
  const lines: string[] = [
    `Story: ${result.topic}`,
    `Type: ${STORY_TYPE_LABELS[result.storyType]}  ·  Tone: ${TONE_LABELS[result.tone]}`,
    `Music: ${result.musicSuggestion}`,
    `Total: ${result.slides.length} slides · ${result.totalDurationSec}s`,
    "",
  ];
  for (const s of result.slides) {
    const tags = [s.isHook ? "HOOK" : null, s.isCTA ? "CTA" : null].filter(Boolean).join(" ");
    lines.push(`[${s.num}] ${s.type.toUpperCase()}${tags ? ` (${tags})` : ""} — ${s.durationSec}s`);
    lines.push(`  ${s.textOverlay}`);
    if (s.stickers.length > 0) {
      lines.push(`  stickers: ${s.stickers.map((st) => STICKER_LABELS[st]).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Render the storyboard as CSV. */
export function renderCsv(result: StoryResult): string {
  const lines = ["slide_num,type,text_overlay,stickers,duration_sec,is_hook,is_cta"];
  for (const s of result.slides) {
    lines.push([
      String(s.num),
      s.type,
      escapeCsv(s.textOverlay),
      escapeCsv(s.stickers.join("|")),
      String(s.durationSec),
      s.isHook ? "true" : "false",
      s.isCTA ? "true" : "false",
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
  if (/[",\n|]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:instagram-story-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: string;
  storyType: StoryType;
  tone: Tone;
  slideCount: number;
  totalDurationSec: number;
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

export function buildShareUrl(input: StoryInput): string {
  const params = new URLSearchParams();
  if (input.storyTopic) params.set("topic", input.storyTopic);
  params.set("n", String(input.slideCount));
  params.set("type", input.storyType);
  params.set("tone", input.tone);
  params.set("polls", input.includePolls ? "1" : "0");
  params.set("questions", input.includeQuestions ? "1" : "0");
  params.set("links", input.includeLinks ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): StoryInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      storyTopic: "",
      slideCount: 7,
      storyType: "announcement",
      includePolls: true,
      includeQuestions: false,
      includeLinks: false,
      tone: "casual",
    };
  }
  const params = new URLSearchParams(clean);
  const n = parseInt(params.get("n") ?? "7", 10);
  const typeParam = params.get("type");
  const toneParam = params.get("tone");
  return {
    storyTopic: params.get("topic") ?? "",
    slideCount: Number.isFinite(n) && n > 0 ? n : 7,
    storyType: STORY_TYPES.includes(typeParam as StoryType) ? (typeParam as StoryType) : "announcement",
    includePolls: params.get("polls") !== "0",
    includeQuestions: params.get("questions") === "1",
    includeLinks: params.get("links") === "1",
    tone: TONES.includes(toneParam as Tone) ? (toneParam as Tone) : "casual",
  };
}
