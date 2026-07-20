/**
 * AI Video Script Outliner — pure logic.
 *
 * Generate platform-specific video script outlines with hook variants,
 * scene-by-scene beats with timestamps, B-roll cues, on-screen text,
 * retention-curve tips, and CTAs. Pure functions only — no DOM, no
 * network. The optional LLM call (BYO API key) lives in ui.tsx because
 * it touches the network.
 */

// ---------- Types ----------

export type Platform =
  | "youtube-long"
  | "youtube-short"
  | "tiktok"
  | "reels"
  | "explainer";

export type Tone = "casual" | "professional" | "energetic" | "educational" | "dramatic";

export type LengthPreset = "short" | "medium" | "long";

export type HookStyle = "question" | "bold-claim" | "stat" | "story" | "pattern-interrupt";

export interface HookVariant {
  id: string;
  style: HookStyle;
  text: string;
  estimatedSeconds: number;
}

export interface Scene {
  id: string;
  label: string;            // e.g. "Hook", "Beat 1: Problem"
  startSeconds: number;
  endSeconds: number;
  talkingPoints: string[];
  onScreenText: string[];
  brollCues: string[];
  retentionTip?: string;
}

export interface VideoScript {
  id: string;
  topic: string;
  platform: Platform;
  tone: Tone;
  length: LengthPreset;
  targetSeconds: number;
  wpm: number;
  hookVariants: HookVariant[];
  chosenHookId: string;
  scenes: Scene[];
  cta: string;
  retentionTips: string[];
  wordEstimate: number;
  generatedAt: number;
}

export interface ScriptStats {
  totalScenes: number;
  totalTalkingPoints: number;
  totalOnScreenText: number;
  totalBrollCues: number;
  totalSeconds: number;
  wordEstimate: number;
  hookVariantCount: number;
}

export interface RepurposedShort {
  title: string;
  hook: string;
  beat: string;
  cta: string;
  targetSeconds: number;
}

export interface SeriesEpisode {
  episode: number;
  title: string;
  summary: string;
  hook: string;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  platform: Platform;
  tone: Tone;
  length: LengthPreset;
  targetSeconds: number;
  sceneCount: number;
}

export interface ShareState {
  topic: string;
  platform: Platform;
  tone: Tone;
  length: LengthPreset;
  wpm: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-video-script-outliner:history";
export const HISTORY_MAX = 20;

export const DEFAULT_WPM = 150;
export const MIN_WPM = 120;
export const MAX_WPM = 180;
export const PADDING_FACTOR = 1.10; // +10% for pauses, B-roll, on-screen text

export const PLATFORM_LABELS: Record<Platform, string> = {
  "youtube-long": "YouTube long-form",
  "youtube-short": "YouTube Short",
  "tiktok": "TikTok",
  "reels": "Instagram Reels",
  "explainer": "Explainer video",
};

export const TONE_LABELS: Record<Tone, string> = {
  "casual": "Casual",
  "professional": "Professional",
  "energetic": "Energetic",
  "educational": "Educational",
  "dramatic": "Dramatic",
};

export const LENGTH_LABELS: Record<LengthPreset, string> = {
  "short": "Short",
  "medium": "Medium",
  "long": "Long",
};

/** Target durations in seconds per platform × length preset. */
export const PLATFORM_DURATIONS: Record<Platform, Record<LengthPreset, number>> = {
  "youtube-long":   { short: 480, medium: 720, long: 1200 }, // 8 / 12 / 20 min
  "youtube-short":  { short: 30,  medium: 45,  long: 60 },
  "tiktok":         { short: 15,  medium: 30,  long: 60 },
  "reels":          { short: 15,  medium: 30,  long: 90 },
  "explainer":      { short: 60,  medium: 90,  long: 180 },
};

export const HOOK_LABELS: Record<HookStyle, string> = {
  "question": "Question",
  "bold-claim": "Bold claim",
  "stat": "Statistic",
  "story": "Story",
  "pattern-interrupt": "Pattern interrupt",
};

export const SAMPLE_TOPICS: string[] = [
  "How to start a podcast in 2025 with under $100",
  "5 Excel shortcuts that will save you an hour every week",
  "Why your morning routine is sabotaging your focus",
  "The science of habit formation, explained simply",
  "Beginner's guide to investing in index funds",
  "I tried the 4-hour workweek for 30 days — here's what happened",
  "How to stop doomscrolling without willpower",
  "The history of the QWERTY keyboard in 60 seconds",
];

// ---------- Pure helpers ----------

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Lowercase + collapse whitespace (for keyword scanning). */
export function normalizeScan(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract content keywords from a topic (stop-word filtered). */
export function extractKeywords(topic: string): string[] {
  const t = normalizeScan(topic);
  if (!t) return [];
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "else", "when", "where", "why", "how",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
    "that", "this", "these", "those", "it", "its", "they", "them", "their",
    "we", "us", "our", "you", "your", "he", "she", "him", "her", "his",
    "should", "would", "could", "can", "may", "might", "must", "shall",
    "not", "no", "yes", "do", "does", "did", "have", "has", "had",
    "what", "which", "who", "whom", "whose", "will",
    "me", "so", "up", "out", "i", "my", "mine",
  ]);
  const words = t
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Title-case a topic. */
export function titleCase(s: string): string {
  const t = normalizeTopic(s);
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Detect the most likely platform from topic phrasing. */
export function detectPlatform(topic: string): Platform {
  const t = normalizeScan(topic);
  if (!t) return "youtube-long";
  if (/\b(tiktok|60 seconds?|in 60|under a minute)\b/.test(t)) return "tiktok";
  if (/\b(reels?|instagram|ig)\b/.test(t)) return "reels";
  if (/\b(short|shorts?)\b/.test(t)) return "youtube-short";
  if (/\b(explain|explainer|how does|what is|beginner'?s guide)\b/.test(t)) return "explainer";
  return "youtube-long";
}

/** Suggest a tone based on topic phrasing. */
export function suggestTone(topic: string): Tone {
  const t = normalizeScan(topic);
  if (!t) return "casual";
  if (/\b(science|research|study|explained)\b/.test(t)) return "educational";
  if (/\b(tried|i tested|day challenge|results)\b/.test(t)) return "energetic";
  if (/\b(history|documentary|true story|mystery)\b/.test(t)) return "dramatic";
  if (/\b(guide|tutorial|how to|step by step)\b/.test(t)) return "professional";
  return "casual";
}

/** Format seconds as mm:ss or h:mm:ss. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/** Convert word count to estimated spoken duration (seconds) with padding. */
export function wordsToSeconds(wordCount: number, wpm: number): number {
  if (wordCount <= 0 || wpm <= 0) return 0;
  return Math.round((wordCount / wpm) * 60 * PADDING_FACTOR);
}

/** Convert target duration (seconds) to max word count. */
export function secondsToWords(seconds: number, wpm: number): number {
  if (seconds <= 0 || wpm <= 0) return 0;
  return Math.floor((seconds / 60) * wpm / PADDING_FACTOR);
}

/** Compute the word estimate for a target duration. */
export function estimateWordCount(targetSeconds: number, wpm: number): number {
  return secondsToWords(targetSeconds, wpm);
}

// ---------- Hook generation ----------

/** Generate 3 hook variants for a topic × platform × tone. */
export function generateHookVariants(
  topic: string,
  platform: Platform,
  tone: Tone,
): HookVariant[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  const kw = extractKeywords(t);
  const main = kw[0] ? titleCase(kw[0]) : titleCase(t);
  const mainLower = kw[0] ?? t.toLowerCase();
  const isShort = platform === "youtube-short" || platform === "tiktok" || platform === "reels";
  const targetHookSeconds = isShort ? 3 : 8;

  const opener = tone === "energetic"
    ? "Stop scrolling — "
    : tone === "dramatic"
      ? "What I'm about to tell you "
      : tone === "professional"
        ? "In this video, "
        : tone === "educational"
          ? "Here's the thing nobody tells you about "
          : "";

  const variants: HookVariant[] = [
    {
      id: "hook-q",
      style: "question",
      text: `${opener}have you ever wondered why ${mainLower} works the way it does?`,
      estimatedSeconds: targetHookSeconds,
    },
    {
      id: "hook-claim",
      style: "bold-claim",
      text: `${opener}${main} is the one thing that's quietly running your day — and you've never noticed.`,
      estimatedSeconds: targetHookSeconds,
    },
    {
      id: "hook-stat",
      style: "stat",
      text: `${opener}studies suggest most people get ${mainLower} wrong on the first try — and it costs them more than they think.`,
      estimatedSeconds: targetHookSeconds,
    },
  ];

  // For non-short platforms, offer a story and pattern-interrupt variant too.
  if (!isShort) {
    variants.push({
      id: "hook-story",
      style: "story",
      text: `Last year I made every mistake in the book with ${mainLower} — here's what I'd do differently.`,
      estimatedSeconds: 10,
    });
    variants.push({
      id: "hook-interrupt",
      style: "pattern-interrupt",
      text: `Forget everything you've heard about ${mainLower}. Most of it is wrong, and I can prove it in the next ${isShort ? "30 seconds" : "few minutes"}.`,
      estimatedSeconds: 8,
    });
  }

  return variants;
}

// ---------- Scene templates ----------

interface SceneTemplate {
  id: string;
  label: (topic: string, idx: number) => string;
  weight: number; // proportion of total duration
  talkingPoints: (topic: string, kw: string[], tone: Tone) => string[];
  onScreenText: (topic: string, kw: string[]) => string[];
  brollCues: (topic: string, kw: string[]) => string[];
  retentionTip?: string;
}

const LONG_FORM_SCENES: SceneTemplate[] = [
  {
    id: "lf-hook",
    label: () => "Hook (0–8s)",
    weight: 0.05,
    talkingPoints: (_t, kw, tone) => [
      `Open on the boldest claim about ${kw[0] ?? "this topic"} you can defend.`,
      tone === "energetic" ? "High energy — direct camera address." : "Calm, confident delivery.",
      "Promise the payoff in 30 seconds or less.",
    ],
    onScreenText: (_t, kw) => [`${titleCase(kw[0] ?? "topic")} — explained`],
    brollCues: () => ["Your face, tight shot, direct to camera", "Subtle zoom-in over 2 seconds"],
    retentionTip: "The first 8 seconds decide everything — cut anything that isn't the hook.",
  },
  {
    id: "lf-intro",
    label: () => "Intro & promise",
    weight: 0.10,
    talkingPoints: (t) => [
      `State why ${t.toLowerCase()} matters to the viewer today.`,
      "Preview the 3 main beats so they know what they'll get.",
      "Quick channel identifier if you have one.",
    ],
    onScreenText: (_t, kw) => kw.slice(0, 3).map(titleCase),
    brollCues: () => ["B-roll: workspace or relevant establishing shot", "Lower-third graphic with your name"],
  },
  {
    id: "lf-beat-1",
    label: (_t, i) => `Beat ${i}: The Problem`,
    weight: 0.20,
    talkingPoints: (t, kw) => [
      `Name the most common mistake people make with ${kw[0] ?? t.toLowerCase()}.`,
      "Show why the mistake is costly (time, money, status).",
      "Tease that the next beat has the fix.",
    ],
    onScreenText: () => ["The Problem", "Most people do this wrong"],
    brollCues: () => ["Screen-recording of the mistake being made", "Cutaway to a frustrated face"],
    retentionTip: "Pattern interrupt at the 60-second mark — change shot, add a sound effect, or ask a question.",
  },
  {
    id: "lf-beat-2",
    label: (_t, i) => `Beat ${i}: The Method`,
    weight: 0.25,
    talkingPoints: (t, kw) => [
      `Walk through the step-by-step method for ${kw[0] ?? t.toLowerCase()}.`,
      "Use a concrete example the viewer can copy.",
      "Address the most likely objection before it forms.",
    ],
    onScreenText: () => ["Step 1", "Step 2", "Step 3"],
    brollCues: () => ["Over-the-shoulder screen recording", "Animated diagram of the method"],
    retentionTip: "Mid-video dip is real — insert a visual surprise (chart, photo, or prop) around 40% through.",
  },
  {
    id: "lf-beat-3",
    label: (_t, i) => `Beat ${i}: Proof`,
    weight: 0.20,
    talkingPoints: (t) => [
      `Show one concrete result of applying this to ${t.toLowerCase()}.`,
      "Use a number, a screenshot, or a before/after.",
      "Acknowledge what it doesn't do — honesty keeps viewers.",
    ],
    onScreenText: () => ["Before", "After"],
    brollCues: () => ["Screenshot of the result", "Before/after split screen"],
  },
  {
    id: "lf-recap",
    label: () => "Recap",
    weight: 0.10,
    talkingPoints: (t) => [
      `Restate the 3 main beats about ${t.toLowerCase()} in one sentence each.`,
      "Connect them into a single takeaway.",
    ],
    onScreenText: () => ["Recap"],
    brollCues: () => ["Quick montage of the 3 beats"],
  },
  {
    id: "lf-cta",
    label: () => "CTA & outro",
    weight: 0.10,
    talkingPoints: (t) => [
      `Tell viewers exactly what to do next about ${t.toLowerCase()}.`,
      "Ask one specific question for comments (drives engagement).",
      "Point to one related video, not three.",
    ],
    onScreenText: () => ["Subscribe", "Comment below"],
    brollCues: () => ["End-screen card with next video"],
  },
];

const SHORT_FORM_SCENES: SceneTemplate[] = [
  {
    id: "sf-hook",
    label: () => "Hook (0–3s)",
    weight: 0.10,
    talkingPoints: (_t, _kw, tone) => [
      tone === "energetic" ? "Direct camera, high energy, no warm-up." : "Direct camera, calm but confident.",
      "Visual change in the first second — motion, text, or cut.",
    ],
    onScreenText: (_t, kw) => [titleCase(kw[0] ?? "topic")],
    brollCues: () => ["Tight face shot", "Text overlay appears within 0.5s"],
    retentionTip: "If the hook doesn't land in 3 seconds, the algorithm buries the video. Test 3 variants.",
  },
  {
    id: "sf-beat-1",
    label: (_t, i) => `Beat ${i}: Setup`,
    weight: 0.30,
    talkingPoints: (t, kw) => [
      `State the problem with ${kw[0] ?? t.toLowerCase()} in one sentence.`,
      "Visual proof of the problem (screen, prop, or face reaction).",
    ],
    onScreenText: () => ["The problem"],
    brollCues: () => ["Quick cut every 1–2 seconds", "On-screen text mirrors the spoken word"],
  },
  {
    id: "sf-beat-2",
    label: (_t, i) => `Beat ${i}: The Fix`,
    weight: 0.30,
    talkingPoints: (t, kw) => [
      `Deliver the single most useful tip about ${kw[0] ?? t.toLowerCase()}.`,
      "Show it, don't just say it — screen-recording or demo.",
    ],
    onScreenText: () => ["The fix"],
    brollCues: () => ["Screen recording", "Zoom-in on the key action"],
    retentionTip: "Pattern interrupt at the 50% mark — change angle, add a sound, or reveal a twist.",
  },
  {
    id: "sf-twist",
    label: () => "Twist / surprise",
    weight: 0.15,
    talkingPoints: (t) => [
      `Add one counterintuitive fact about ${t.toLowerCase()} they didn't expect.`,
      "This is the moment most viewers decide to share.",
    ],
    onScreenText: () => ["But wait…"],
    brollCues: () => ["Reaction shot", "Quick zoom"],
  },
  {
    id: "sf-cta",
    label: () => "CTA",
    weight: 0.15,
    talkingPoints: () => [
      "Single clear CTA: follow, save, or comment one word.",
      "End on the punchline, not on 'thanks for watching'.",
    ],
    onScreenText: () => ["Follow for more"],
    brollCues: () => ["Quick loop point if possible"],
  },
];

const EXPLAINER_SCENES: SceneTemplate[] = [
  {
    id: "ex-hook",
    label: () => "Hook (0–5s)",
    weight: 0.08,
    talkingPoints: (t) => [
      `Open with the question ${t.toLowerCase()} answers.`,
      "Promise a clear answer in plain language.",
    ],
    onScreenText: (_t, kw) => [titleCase(kw[0] ?? "topic")],
    brollCues: () => ["Clean motion-graphic opener", "Logo bug"],
  },
  {
    id: "ex-problem",
    label: () => "Problem",
    weight: 0.20,
    talkingPoints: (t, kw) => [
      `Why is ${kw[0] ?? t.toLowerCase()} confusing or important?`,
      "Show the cost of not understanding it.",
    ],
    onScreenText: () => ["The problem"],
    brollCues: () => ["Animated diagram of the problem"],
  },
  {
    id: "ex-solution",
    label: () => "Solution",
    weight: 0.30,
    talkingPoints: (t, kw) => [
      `Explain ${kw[0] ?? t.toLowerCase()} in one sentence, then unpack it.`,
      "Use an analogy the viewer already knows.",
    ],
    onScreenText: () => ["The solution", "In plain English"],
    brollCues: () => ["Animated analogy", "Step-by-step motion graphic"],
    retentionTip: "Explainer viewers drop at the 40% mark — insert a 'let me show you' visual moment there.",
  },
  {
    id: "ex-demo",
    label: () => "Demo",
    weight: 0.25,
    talkingPoints: (t) => [
      `Show ${t.toLowerCase()} in action with a concrete example.`,
      "Highlight the key terms on screen as you say them.",
    ],
    onScreenText: () => ["Demo"],
    brollCues: () => ["Screen recording with cursor highlight"],
  },
  {
    id: "ex-proof",
    label: () => "Proof",
    weight: 0.10,
    talkingPoints: (t) => [
      `Show one piece of evidence that this works for ${t.toLowerCase()}.`,
      "Acknowledge what it doesn't solve.",
    ],
    onScreenText: () => ["Proof"],
    brollCues: () => ["Before/after split or stat card"],
  },
  {
    id: "ex-cta",
    label: () => "CTA",
    weight: 0.07,
    talkingPoints: () => [
      "Tell the viewer the one next step to take.",
      "End with a clean brand card.",
    ],
    onScreenText: () => ["Learn more"],
    brollCues: () => ["End card with URL"],
  },
];

function sceneTemplatesForPlatform(platform: Platform): SceneTemplate[] {
  switch (platform) {
    case "youtube-long": return LONG_FORM_SCENES;
    case "youtube-short":
    case "tiktok":
    case "reels":
      return SHORT_FORM_SCENES;
    case "explainer": return EXPLAINER_SCENES;
  }
}

// ---------- CTA generation ----------

/** Generate a platform-appropriate CTA. */
export function generateCta(topic: string, platform: Platform, tone: Tone): string {
  const t = normalizeTopic(topic);
  const isShort = platform === "youtube-short" || platform === "tiktok" || platform === "reels";
  if (isShort) {
    return tone === "energetic"
      ? `Follow for more on ${t.toLowerCase()} — and comment the word "${t.split(" ")[0] ?? "MORE"}" if you want the full guide.`
      : `Save this for next time you need ${t.toLowerCase()}, and follow for more like it.`;
  }
  if (platform === "explainer") {
    return `Want the deeper dive on ${t.toLowerCase()}? The link is in the description — and drop a question in the comments if anything was unclear.`;
  }
  // YouTube long-form
  return tone === "energetic"
    ? `If this changed how you think about ${t.toLowerCase()}, subscribe and ring the bell — next week I'm breaking down the most common follow-up question.`
    : `If you found this useful, subscribe — and let me know in the comments how you'll apply this to ${t.toLowerCase()}.`;
}

// ---------- Retention tips ----------

/** Generate overall retention-curve tips for the platform. */
export function generateRetentionTips(platform: Platform): string[] {
  if (platform === "youtube-long") {
    return [
      "Hook in the first 8 seconds — the algorithm weights it heavily.",
      "Pattern interrupt every 60–90 seconds (cut, zoom, sound, or visual).",
      "Expect a dip around 40% — that's where most viewers leave; insert a surprise there.",
      "End-screen CTA in the last 10–15 seconds, not 'thanks for watching'.",
    ];
  }
  if (platform === "explainer") {
    return [
      "Open with the question the viewer typed into search.",
      "Add on-screen text for every key term — explainer viewers rewatch.",
      "Keep cuts to 1.5–2.5 seconds; shorter feels rushed, longer feels slow.",
    ];
  }
  // Shorts / TikTok / Reels
  return [
    "Hook in the first 3 seconds — the algorithm decides immediately.",
    "Cut every 1–2 seconds; static shots die on short-form.",
    "Text overlay mirrors the spoken word — many viewers watch muted.",
    "End on the punchline, not on 'thanks for watching'.",
    "Loop the ending back to the hook if possible — drives replays.",
  ];
}

// ---------- Script generation ----------

/** Generate a full video script. */
export function generateScript(
  topic: string,
  platform: Platform,
  tone: Tone,
  length: LengthPreset,
  wpm: number = DEFAULT_WPM,
): VideoScript | null {
  const t = normalizeTopic(topic);
  if (!t) return null;
  const targetSeconds = PLATFORM_DURATIONS[platform][length];
  const kw = extractKeywords(t);
  const templates = sceneTemplatesForPlatform(platform);
  const hookVariants = generateHookVariants(t, platform, tone);
  const chosenHookId = hookVariants[0]?.id ?? "hook-1";

  let cursor = 0;
  let bodyIdx = 0;
  const scenes: Scene[] = templates.map((tpl) => {
    if (tpl.label(t, 0).includes("Beat")) bodyIdx += 1;
    const idx = tpl.label(t, 0).includes("Beat") ? bodyIdx : 0;
    const sceneSeconds = Math.round(tpl.weight * targetSeconds);
    const start = cursor;
    const end = cursor + sceneSeconds;
    cursor = end;
    return {
      id: tpl.id,
      label: tpl.label(t, idx),
      startSeconds: start,
      endSeconds: end,
      talkingPoints: tpl.talkingPoints(t, kw, tone),
      onScreenText: tpl.onScreenText(t, kw),
      brollCues: tpl.brollCues(t, kw),
      retentionTip: tpl.retentionTip,
    };
  });

  const cta = generateCta(t, platform, tone);
  const retentionTips = generateRetentionTips(platform);
  const wordEstimate = estimateWordCount(targetSeconds, wpm);

  return {
    id: "script-1",
    topic: t,
    platform,
    tone,
    length,
    targetSeconds,
    wpm,
    hookVariants,
    chosenHookId,
    scenes,
    cta,
    retentionTips,
    wordEstimate,
    generatedAt: Date.now(),
  };
}

/** Pick a different hook variant by id. */
export function chooseHook(script: VideoScript, hookId: string): VideoScript {
  if (!script.hookVariants.some((h) => h.id === hookId)) return script;
  return { ...script, chosenHookId: hookId };
}

/** Get the currently selected hook variant. */
export function getChosenHook(script: VideoScript): HookVariant | undefined {
  return script.hookVariants.find((h) => h.id === script.chosenHookId) ?? script.hookVariants[0];
}

// ---------- Repurposing ----------

/** Repurpose a long-form script into 3 short-form hooks. */
export function repurposeToShorts(script: VideoScript): RepurposedShort[] {
  if (script.scenes.length === 0) return [];
  const isLong = script.platform === "youtube-long" || script.platform === "explainer";
  if (!isLong) {
    // Already short — return a single repackaged version.
    return [{
      title: `${script.topic} — quick cut`,
      hook: getChosenHook(script)?.text ?? "",
      beat: script.scenes[1]?.talkingPoints[0] ?? "",
      cta: script.cta,
      targetSeconds: 30,
    }];
  }
  const shorts: RepurposedShort[] = [];
  // Use the three main beats as separate Shorts.
  const beats = script.scenes.filter((s) => s.label.includes("Beat"));
  const picks = beats.length >= 3 ? beats.slice(0, 3) : script.scenes.slice(0, 3);
  picks.forEach((scene, i) => {
    shorts.push({
      title: `${script.topic} — part ${i + 1}`,
      hook: `Most people get ${script.topic.toLowerCase()} wrong — here's part ${i + 1}.`,
      beat: scene.talkingPoints[0] ?? `In this short: ${scene.label}.`,
      cta: "Follow for the next part.",
      targetSeconds: 30,
    });
  });
  return shorts;
}

// ---------- Series planning ----------

/** Plan a 3-episode series around a topic. */
export function planSeries(topic: string, platform: Platform, tone: Tone): SeriesEpisode[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  return [
    {
      episode: 1,
      title: `${titleCase(t)} — The Problem`,
      summary: `Episode 1 sets up the problem with ${t.toLowerCase()} and why viewers should care.`,
      hook: `Most people struggle with ${t.toLowerCase()} — and they don't even know why.`,
    },
    {
      episode: 2,
      title: `${titleCase(t)} — The Method`,
      summary: `Episode 2 delivers the step-by-step method that solves the problem from episode 1.`,
      hook: `In episode 1 we saw why ${t.toLowerCase()} is hard — here's the fix.`,
    },
    {
      episode: 3,
      title: `${titleCase(t)} — The Proof`,
      summary: `Episode 3 shows results, addresses objections, and teases the next series.`,
      hook: `Does ${t.toLowerCase()} actually work? Here's the proof — and where it doesn't.`,
    },
  ];
}

// ---------- Stats ----------

/** Compute summary stats for a script. */
export function computeStats(script: VideoScript): ScriptStats {
  return {
    totalScenes: script.scenes.length,
    totalTalkingPoints: script.scenes.reduce((s, x) => s + x.talkingPoints.length, 0),
    totalOnScreenText: script.scenes.reduce((s, x) => s + x.onScreenText.length, 0),
    totalBrollCues: script.scenes.reduce((s, x) => s + x.brollCues.length, 0),
    totalSeconds: script.scenes.reduce((s, x) => s + (x.endSeconds - x.startSeconds), 0),
    wordEstimate: script.wordEstimate,
    hookVariantCount: script.hookVariants.length,
  };
}

// ---------- Rendering ----------

/** Render a script as Markdown. */
export function renderMarkdown(script: VideoScript): string {
  const lines: string[] = [];
  const hook = getChosenHook(script);
  lines.push(`# Video Script: ${titleCase(script.topic)}`);
  lines.push("");
  lines.push(`**Platform:** ${PLATFORM_LABELS[script.platform]}  `);
  lines.push(`**Tone:** ${TONE_LABELS[script.tone]}  `);
  lines.push(`**Length:** ${LENGTH_LABELS[script.length]}  `);
  lines.push(`**Target duration:** ${formatTimestamp(script.targetSeconds)}  `);
  lines.push(`**Word estimate:** ~${script.wordEstimate} words at ${script.wpm} WPM`);
  lines.push("");
  lines.push(`## Hook (${hook ? HOOK_LABELS[hook.style] : "—"})`);
  lines.push("");
  lines.push(`> ${hook?.text ?? ""}`);
  lines.push("");
  if (script.hookVariants.length > 1) {
    lines.push(`**Alternative hook variants:**`);
    script.hookVariants.filter((h) => h.id !== script.chosenHookId).forEach((h, i) => {
      lines.push(`${i + 2}. [${HOOK_LABELS[h.style]}] ${h.text}`);
    });
    lines.push("");
  }
  lines.push(`## Scenes`);
  lines.push("");
  for (const s of script.scenes) {
    lines.push(`### ${s.label}  (${formatTimestamp(s.startSeconds)}–${formatTimestamp(s.endSeconds)})`);
    lines.push("");
    lines.push(`**Talking points:**`);
    for (const tp of s.talkingPoints) lines.push(`- ${tp}`);
    if (s.onScreenText.length > 0) {
      lines.push("");
      lines.push(`**On-screen text:** ${s.onScreenText.map((x) => `\`${x}\``).join(", ")}`);
    }
    if (s.brollCues.length > 0) {
      lines.push("");
      lines.push(`**B-roll cues:**`);
      for (const b of s.brollCues) lines.push(`- ${b}`);
    }
    if (s.retentionTip) {
      lines.push("");
      lines.push(`> **Retention tip:** ${s.retentionTip}`);
    }
    lines.push("");
  }
  lines.push(`## CTA`);
  lines.push("");
  lines.push(`> ${script.cta}`);
  lines.push("");
  if (script.retentionTips.length > 0) {
    lines.push(`## Retention-curve tips`);
    lines.push("");
    for (const tip of script.retentionTips) lines.push(`- ${tip}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a script as a teleprompter-friendly plain text. */
export function renderTeleprompter(script: VideoScript): string {
  const lines: string[] = [];
  const hook = getChosenHook(script);
  lines.push(`=== ${titleCase(script.topic).toUpperCase()} ===`);
  lines.push(`Platform: ${PLATFORM_LABELS[script.platform]} · Target: ${formatTimestamp(script.targetSeconds)} · ~${script.wordEstimate} words`);
  lines.push("");
  lines.push(`[HOOK — ${formatTimestamp(0)}]`);
  lines.push(hook?.text ?? "");
  lines.push("");
  for (const s of script.scenes) {
    lines.push(`[${s.label.toUpperCase()} — ${formatTimestamp(s.startSeconds)}–${formatTimestamp(s.endSeconds)}]`);
    for (const tp of s.talkingPoints) lines.push(`  • ${tp}`);
    if (s.onScreenText.length > 0) lines.push(`  ON-SCREEN: ${s.onScreenText.join(" | ")}`);
    if (s.brollCues.length > 0) lines.push(`  B-ROLL: ${s.brollCues.join(" | ")}`);
    lines.push("");
  }
  lines.push(`[CTA — ${formatTimestamp(script.targetSeconds - 10)}]`);
  lines.push(script.cta);
  lines.push("");
  return lines.join("\n");
}

/** Render a script as plain text. */
export function renderText(script: VideoScript): string {
  const lines: string[] = [];
  const hook = getChosenHook(script);
  lines.push(`VIDEO SCRIPT — ${PLATFORM_LABELS[script.platform]} — ${titleCase(script.topic)}`);
  lines.push(`Tone: ${TONE_LABELS[script.tone]} · Length: ${LENGTH_LABELS[script.length]} · Target: ${formatTimestamp(script.targetSeconds)}`);
  lines.push("");
  lines.push(`HOOK: ${hook?.text ?? ""}`);
  lines.push("");
  for (const s of script.scenes) {
    lines.push(`## ${s.label}  (${formatTimestamp(s.startSeconds)}–${formatTimestamp(s.endSeconds)})`);
    for (const tp of s.talkingPoints) lines.push(`  - ${tp}`);
    if (s.onScreenText.length > 0) lines.push(`  ON-SCREEN: ${s.onScreenText.join(", ")}`);
    for (const b of s.brollCues) lines.push(`  B-ROLL: ${b}`);
    if (s.retentionTip) lines.push(`  TIP: ${s.retentionTip}`);
    lines.push("");
  }
  lines.push(`CTA: ${script.cta}`);
  return lines.join("\n");
}

/** Render a script as JSON. */
export function renderJson(script: VideoScript): string {
  return JSON.stringify(script, null, 2);
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.topic) params.set("topic", state.topic);
  if (state.platform) params.set("platform", state.platform);
  if (state.tone) params.set("tone", state.tone);
  if (state.length) params.set("length", state.length);
  if (state.wpm) params.set("wpm", String(state.wpm));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { topic: "", platform: "youtube-long", tone: "casual", length: "medium", wpm: DEFAULT_WPM };
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const platform = params.get("platform") as Platform | null;
  const tone = params.get("tone") as Tone | null;
  const length = params.get("length") as LengthPreset | null;
  const wpmRaw = params.get("wpm") ?? String(DEFAULT_WPM);
  const wpm = Number(wpmRaw);
  const validPlatforms: Platform[] = ["youtube-long", "youtube-short", "tiktok", "reels", "explainer"];
  const validTones: Tone[] = ["casual", "professional", "energetic", "educational", "dramatic"];
  const validLengths: LengthPreset[] = ["short", "medium", "long"];
  return {
    topic,
    platform: platform && validPlatforms.includes(platform) ? platform : "youtube-long",
    tone: tone && validTones.includes(tone) ? tone : "casual",
    length: length && validLengths.includes(length) ? length : "medium",
    wpm: Number.isFinite(wpm) && wpm >= MIN_WPM && wpm <= MAX_WPM ? wpm : DEFAULT_WPM,
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  topic: string,
  platform: Platform,
  tone: Tone,
  length: LengthPreset,
  wpm: number,
): LlmPrompt {
  const targetSeconds = PLATFORM_DURATIONS[platform][length];
  const system = `You are an expert short-form and long-form video scriptwriter. Produce a structured video script outline for the user's topic on ${PLATFORM_LABELS[platform]} in a ${TONE_LABELS[tone]} tone (tone key: "${tone}"), targeting ~${formatTimestamp(targetSeconds)} (~${estimateWordCount(targetSeconds, wpm)} spoken words at ${wpm} WPM). Return JSON with: topic, platform, tone, targetSeconds, hookVariants (array of {id, style in [question, bold-claim, stat, story, pattern-interrupt], text, estimatedSeconds}), scenes (array of {id, label, startSeconds, endSeconds, talkingPoints, onScreenText, brollCues, retentionTip}), cta (string), retentionTips (array of strings), wordEstimate (number). Hooks must grab attention in the first 3 (short-form) or 8 (long-form) seconds. Each scene must have on-screen text and B-roll cues. Do not fabricate real-person quotes or copyrighted lyrics.`;
  const user = `Topic: ${topic}`;
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
