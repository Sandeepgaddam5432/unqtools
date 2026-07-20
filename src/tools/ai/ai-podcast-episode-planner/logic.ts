/**
 * AI Podcast Episode Planner — pure logic.
 *
 * Plan podcast episodes: segment outlines with timestamps, talking points,
 * guest interview questions, ad-break placements, and show notes. Pure
 * functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type EpisodeFormat = "solo" | "interview" | "cohost" | "panel" | "story";

export type SegmentType =
  | "cold-open"
  | "intro"
  | "main"
  | "interview"
  | "discussion"
  | "narration"
  | "ad-break"
  | "listener-qa"
  | "recap"
  | "outro"
  | "teaser";

export interface SegmentTemplate {
  type: SegmentType;
  label: string;
  /** Weight of total runtime (0-1). All weights in a template sum to 1. */
  weight: number;
  /** Template for talking points (array of strings with {placeholders}). */
  talkingPoints: string[];
}

export interface Segment extends SegmentTemplate {
  startSec: number;
  endSec: number;
  startLabel: string; // MM:SS
  endLabel: string;   // MM:SS
}

export interface AdBreak {
  position: "pre-roll" | "mid-roll-1" | "mid-roll-2" | "post-roll";
  atSec: number;
  atLabel: string;
  durationSec: number;
}

export interface ChapterMarker {
  index: number;
  timeLabel: string;
  title: string;
}

export interface GuestQuestion {
  index: number;
  guest: string;
  question: string;
  intent: string; // e.g., "origin story", "hot take", "practical tip"
}

export interface SocialClip {
  index: number;
  segment: string;
  hook: string;
  suggestedPlatform: "youtube-shorts" | "reels" | "tiktok" | "twitter-x";
  durationSec: number;
}

export interface EpisodePlan {
  id: string;
  topic: string;
  format: EpisodeFormat;
  durationMin: number;
  guests: string[];
  keywords: string[];
  hook: string;
  segments: Segment[];
  adBreaks: AdBreak[];
  chapterMarkers: ChapterMarker[];
  guestQuestions: GuestQuestion[];
  titleOptions: string[];
  descriptionOptions: string[];
  showNotes: string[];
  socialClips: SocialClip[];
  createdAt: number;
}

export interface EpisodeStats {
  segmentCount: number;
  talkingPointCount: number;
  adBreakCount: number;
  guestQuestionCount: number;
  titleOptionCount: number;
  socialClipCount: number;
  totalRuntimeSec: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-podcast-planner:history";
export const HISTORY_MAX = 20;

export const FORMAT_LABELS: Record<EpisodeFormat, string> = {
  solo: "Solo monologue",
  interview: "Interview (one guest)",
  cohost: "Co-host banter",
  panel: "Panel (multiple guests)",
  story: "Narrative story",
};

export const DURATION_PRESETS: number[] = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export const TOPIC_PRESETS: string[] = [
  "The future of remote work",
  "Building habits that stick",
  "AI in everyday life",
  "Personal finance for beginners",
  "Mental health and creativity",
  "Side hustles that work",
  "Sustainable living at home",
  "Learning a new language fast",
];

export const PLATFORM_LABELS: Record<SocialClip["suggestedPlatform"], string> = {
  "youtube-shorts": "YouTube Shorts",
  "reels": "Instagram Reels",
  "tiktok": "TikTok",
  "twitter-x": "Twitter / X",
};

// ---------- Segment templates per format ----------
// Weights sum to 1.0 per format (ad breaks are extra slots, not part of weights).

export const SEGMENT_TEMPLATES: Record<EpisodeFormat, SegmentTemplate[]> = {
  solo: [
    {
      type: "cold-open",
      label: "Cold open — tease the big insight",
      weight: 0.05,
      talkingPoints: [
        "Open with a surprising stat or personal story about {topic}.",
        "Promise one concrete takeaway the listener will have by the end.",
        "Don't introduce yourself yet — drop the listener straight in.",
      ],
    },
    {
      type: "intro",
      label: "Intro — who you are, why this matters",
      weight: 0.05,
      talkingPoints: [
        "Quick name + show name + why you're the one to talk about {topic}.",
        "Frame the question this episode answers.",
        "Set expectations: 'In the next {dur} minutes, you'll learn…'",
      ],
    },
    {
      type: "main",
      label: "Main monologue — three big ideas about {topic}",
      weight: 0.70,
      talkingPoints: [
        "Idea 1 — the framing: why most people get {topic} wrong.",
        "Idea 2 — the mechanism: how {topic} actually works, step by step.",
        "Idea 3 — the application: what the listener should do this week.",
        "Insert a personal anecdote between idea 2 and 3 to keep it human.",
        "Reference one external resource (book, article, study) on {topic}.",
      ],
    },
    {
      type: "listener-qa",
      label: "Listener Q&A",
      weight: 0.10,
      talkingPoints: [
        "Read a listener question about {topic} from the inbox.",
        "Answer directly — don't punt to 'it depends'.",
        "Invite the listener to send follow-ups.",
      ],
    },
    {
      type: "recap",
      label: "Recap — three takeaways",
      weight: 0.05,
      talkingPoints: [
        "Recap the three ideas in one sentence each.",
        "State the one action listeners should take this week.",
      ],
    },
    {
      type: "outro",
      label: "Outro — CTA + next-episode tease",
      weight: 0.05,
      talkingPoints: [
        "Subscribe / rate / review ask.",
        "Tease next episode's topic.",
        "Thank the listener for the time.",
      ],
    },
  ],
  interview: [
    {
      type: "cold-open",
      label: "Cold open — guest's best line",
      weight: 0.04,
      talkingPoints: [
        "Pull a 15-second clip of the guest's most surprising answer.",
        "Lay it over intro music — no host narration.",
      ],
    },
    {
      type: "intro",
      label: "Intro — host + guest setup",
      weight: 0.06,
      talkingPoints: [
        "Host introduces self and the show in 20 seconds.",
        "Frame why {topic} matters this week.",
        "Introduce guest with one credibility line + one human line.",
      ],
    },
    {
      type: "interview",
      label: "Interview — origin story",
      weight: 0.15,
      talkingPoints: [
        "Ask how the guest got into {topic}.",
        "Find the moment they knew this was their path.",
        "Resist interrupting — let the story breathe.",
      ],
    },
    {
      type: "interview",
      label: "Interview — deep dive on {topic}",
      weight: 0.40,
      talkingPoints: [
        "Move from 'what' to 'how' to 'why'.",
        "Ask for a concrete example for each big claim.",
        "Push back gently once — the best moments come from a friendly challenge.",
        "Ask the guest to name one thing they changed their mind about.",
      ],
    },
    {
      type: "interview",
      label: "Interview — rapid fire + practical",
      weight: 0.15,
      talkingPoints: [
        "Three rapid-fire questions: best resource, common myth, one tip.",
        "Ask what the listener should do this week about {topic}.",
        "Ask the guest where people can find them.",
      ],
    },
    {
      type: "recap",
      label: "Recap — host synthesis",
      weight: 0.10,
      talkingPoints: [
        "Host names the one moment that surprised them most.",
        "Connect the guest's answer back to the listener's life.",
      ],
    },
    {
      type: "outro",
      label: "Outro — CTAs + tease",
      weight: 0.10,
      talkingPoints: [
        "Tell listeners where to find the guest (handle, site).",
        "Subscribe + review ask.",
        "Tease next episode.",
      ],
    },
  ],
  cohost: [
    {
      type: "cold-open",
      label: "Cold open — co-host banter",
      weight: 0.05,
      talkingPoints: [
        "Open mid-argument — start with a real disagreement about {topic}.",
        "Don't explain the show — let the dynamic do the work.",
      ],
    },
    {
      type: "intro",
      label: "Intro — set the table",
      weight: 0.05,
      talkingPoints: [
        "Quick co-host introductions.",
        "Today's debate: {topic}.",
        "Each co-host states their position in 30 seconds.",
      ],
    },
    {
      type: "discussion",
      label: "Discussion — both sides of {topic}",
      weight: 0.55,
      talkingPoints: [
        "Co-host A makes their case with one example.",
        "Co-host B responds — find the real point of disagreement.",
        "Identify what each side would accept as evidence they're wrong.",
        "Find one thing both co-hosts agree on, even if small.",
      ],
    },
    {
      type: "listener-qa",
      label: "Listener Q&A",
      weight: 0.15,
      talkingPoints: [
        "Read one listener question that takes a side.",
        "Each co-host answers in 60 seconds.",
        "Agree on the best listener answer.",
      ],
    },
    {
      type: "recap",
      label: "Recap — what we learned",
      weight: 0.10,
      talkingPoints: [
        "Each co-host names one thing they updated their view on.",
        "Name the unresolved thread for next time.",
      ],
    },
    {
      type: "outro",
      label: "Outro — CTAs",
      weight: 0.10,
      talkingPoints: [
        "Subscribe + review ask.",
        "Tell listeners to vote on next week's topic.",
        "Tease next episode.",
      ],
    },
  ],
  panel: [
    {
      type: "cold-open",
      label: "Cold open — montage of panel voices",
      weight: 0.04,
      talkingPoints: [
        "Splice one-line hot takes from each panelist about {topic}.",
        "No host intro yet — let the voices do it.",
      ],
    },
    {
      type: "intro",
      label: "Intro — host + panelist intros",
      weight: 0.06,
      talkingPoints: [
        "Host sets up the question of the day on {topic}.",
        "Quick intro of each panelist (15 seconds each).",
        "State the structure: opening statements, then discussion, then closing.",
      ],
    },
    {
      type: "discussion",
      label: "Opening statements — each panelist",
      weight: 0.20,
      talkingPoints: [
        "Each panelist gets 2 minutes to state their position on {topic}.",
        "Host keeps time — ring a bell at 2:00.",
        "No interruptions during opening statements.",
      ],
    },
    {
      type: "discussion",
      label: "Open discussion — {topic}",
      weight: 0.40,
      talkingPoints: [
        "Host poses 2-3 prepared questions to the panel.",
        "Invite panelists to respond to each other directly.",
        "Watch for two panelists talking past each other — name the disagreement.",
        "Make sure every panelist speaks at least once per question.",
      ],
    },
    {
      type: "listener-qa",
      label: "Listener Q&A",
      weight: 0.10,
      talkingPoints: [
        "Take 2 listener questions.",
        "Each panelist answers in 30 seconds.",
      ],
    },
    {
      type: "recap",
      label: "Closing statements",
      weight: 0.10,
      talkingPoints: [
        "Each panelist: 1 minute on what they'd say to someone just starting with {topic}.",
        "Host synthesizes: where the panel agreed, where it diverged.",
      ],
    },
    {
      type: "outro",
      label: "Outro — CTAs",
      weight: 0.10,
      talkingPoints: [
        "List where to find each panelist.",
        "Subscribe + review ask.",
        "Tease next episode's panel topic.",
      ],
    },
  ],
  story: [
    {
      type: "cold-open",
      label: "Cold open — drop into the story",
      weight: 0.05,
      talkingPoints: [
        "Open mid-scene — sensory detail, no context yet.",
        "A line of dialogue or a question that pulls the listener in.",
        "No 'in this episode' framing — pure narrative.",
      ],
    },
    {
      type: "intro",
      label: "Intro — frame the story",
      weight: 0.05,
      talkingPoints: [
        "Host narration: set time, place, and stakes.",
        "Introduce the protagonist(s) of the story.",
        "Name the central tension of {topic}.",
      ],
    },
    {
      type: "narration",
      label: "Act 1 — the inciting incident",
      weight: 0.20,
      talkingPoints: [
        "Show the moment something changes.",
        "Use specific sensory details — what did it sound, smell, look like?",
        "Let the protagonist speak in their own words (interview clip or reenactment).",
      ],
    },
    {
      type: "narration",
      label: "Act 2 — rising action + complication",
      weight: 0.30,
      talkingPoints: [
        "Raise the stakes — what does the protagonist stand to lose?",
        "Introduce one obstacle that makes the situation worse.",
        "Include a brief expert or context insert on {topic}.",
      ],
    },
    {
      type: "narration",
      label: "Act 3 — the climax + resolution",
      weight: 0.20,
      talkingPoints: [
        "The moment of decision or turning point.",
        "What the protagonist chose, and what it cost.",
        "The immediate aftermath.",
      ],
    },
    {
      type: "recap",
      label: "Reflection — what it means",
      weight: 0.10,
      talkingPoints: [
        "Host reflects on what the story reveals about {topic}.",
        "Connect it back to the listener's life.",
        "Name one universal lesson.",
      ],
    },
    {
      type: "outro",
      label: "Outro — credits + CTAs",
      weight: 0.10,
      talkingPoints: [
        "Credits: who spoke, music, archives used.",
        "Subscribe + review ask.",
        "Tease next episode's story.",
      ],
    },
  ],
};

// ---------- Helpers ----------

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse guest names (newline, comma, or semicolon separated). */
export function parseGuests(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
  "for", "with", "about", "as", "by", "from", "is", "are", "was", "were",
  "be", "been", "being", "this", "that", "these", "those", "it", "its",
  "your", "you", "we", "they", "them", "their", "our", "my", "i",
]);

/** Extract meaningful keywords from the topic for template substitution. */
export function extractKeywords(topic: string): string[] {
  const clean = normalizeTopic(topic).toLowerCase();
  if (!clean) return [];
  // Strip parenthetical content
  const noParen = clean.replace(/\([^)]*\)/g, " ").trim();
  const words = noParen
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const unique: string[] = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
  }
  // Also include the full lowercased topic as a phrase keyword
  return unique;
}

/** Render a template string by substituting {placeholders}. */
export function renderTemplate(
  tpl: string,
  vars: { topic: string; dur: string; guests: string; guest: string; kw: string },
): string {
  return tpl
    .replace(/\{topic\}/g, vars.topic)
    .replace(/\{dur\}/g, vars.dur)
    .replace(/\{guests\}/g, vars.guests)
    .replace(/\{guest\}/g, vars.guest)
    .replace(/\{kw\}/g, vars.kw);
}

/** Format seconds as MM:SS (or H:MM:SS for >= 1h). */
export function formatTimestamp(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Compute per-segment start/end times based on weights and total duration. */
export function computeTimestamps(
  templates: SegmentTemplate[],
  totalSec: number,
): Segment[] {
  let cursor = 0;
  return templates.map((t) => {
    const dur = Math.round(t.weight * totalSec);
    const startSec = cursor;
    const endSec = cursor + dur;
    cursor = endSec;
    return {
      ...t,
      startSec,
      endSec,
      startLabel: formatTimestamp(startSec),
      endLabel: formatTimestamp(endSec),
    };
  });
}

/** Place ad breaks based on episode duration. */
export function generateAdBreaks(totalSec: number): AdBreak[] {
  const breaks: AdBreak[] = [];
  // Pre-roll always (10 sec)
  breaks.push({
    position: "pre-roll",
    atSec: 0,
    atLabel: formatTimestamp(0),
    durationSec: 10,
  });
  // Mid-rolls for episodes over 20 min
  if (totalSec >= 20 * 60) {
    breaks.push({
      position: "mid-roll-1",
      atSec: Math.round(totalSec * 0.25),
      atLabel: formatTimestamp(Math.round(totalSec * 0.25)),
      durationSec: 30,
    });
  }
  // Second mid-roll for episodes over 40 min
  if (totalSec >= 40 * 60) {
    breaks.push({
      position: "mid-roll-2",
      atSec: Math.round(totalSec * 0.75),
      atLabel: formatTimestamp(Math.round(totalSec * 0.75)),
      durationSec: 30,
    });
  }
  // Post-roll for episodes over 10 min
  if (totalSec >= 10 * 60) {
    breaks.push({
      position: "post-roll",
      atSec: Math.max(0, totalSec - 60),
      atLabel: formatTimestamp(Math.max(0, totalSec - 60)),
      durationSec: 15,
    });
  }
  return breaks;
}

/** Build chapter markers from segments (skip ad breaks). */
export function generateChapterMarkers(segments: Segment[]): ChapterMarker[] {
  const out: ChapterMarker[] = [];
  let idx = 1;
  for (const s of segments) {
    if (s.type === "ad-break") continue;
    out.push({
      index: idx,
      timeLabel: s.startLabel,
      title: s.label,
    });
    idx += 1;
  }
  return out;
}

/** Generate interview questions for each guest. */
export function generateGuestQuestions(
  guests: string[],
  topic: string,
  format: EpisodeFormat,
): GuestQuestion[] {
  const out: GuestQuestion[] = [];
  if (guests.length === 0) return out;

  const questionBank: Array<{ q: string; intent: string }> = [
    { q: "How did you first get into {topic}?", intent: "origin story" },
    { q: "What's the one thing about {topic} most people get wrong?", intent: "hot take" },
    { q: "Walk us through a recent project on {topic} — start to finish.", intent: "deep dive" },
    { q: "What's the best decision you made early in {topic}?", intent: "practical tip" },
    { q: "What's a decision you regret in {topic}?", intent: "vulnerability" },
    { q: "If someone is just starting with {topic}, what should they do first?", intent: "beginner advice" },
    { q: "What's one resource (book, podcast, article) on {topic} you'd recommend?", intent: "resource" },
    { q: "What's changed your mind about {topic} in the last year?", intent: "intellectual honesty" },
    { q: "What's the hardest part of {topic} that nobody talks about?", intent: "behind the scenes" },
    { q: "Where do you see {topic} going in the next 5 years?", intent: "forecast" },
    { q: "Who else should we interview about {topic}?", intent: "recommendation" },
    { q: "What's the question you wish interviewers asked you about {topic}?", intent: "meta" },
  ];

  // For panel format, give each guest a subset; for interview, give the one guest all
  const perGuest = format === "panel" ? 4 : questionBank.length;
  let i = 1;
  for (const g of guests) {
    const shuffled = [...questionBank];
    // Deterministic rotation: start each guest at a different offset
    const offset = (i - 1) * 2;
    const picked: Array<{ q: string; intent: string }> = [];
    for (let k = 0; k < perGuest; k++) {
      picked.push(shuffled[(offset + k) % shuffled.length]);
    }
    for (const item of picked) {
      out.push({
        index: i,
        guest: g,
        question: renderTemplate(item.q, {
          topic, dur: "", guests: g, guest: g, kw: "",
        }),
        intent: item.intent,
      });
      i += 1;
    }
  }
  return out;
}

/** Generate 3-5 title options for the episode. */
export function generateTitleOptions(topic: string, format: EpisodeFormat): string[] {
  const kw = extractKeywords(topic);
  const primary = kw[0] ? kw[0].charAt(0).toUpperCase() + kw[0].slice(1) : topic;
  const base: Record<EpisodeFormat, string[]> = {
    solo: [
      `${primary}: What Nobody Tells You`,
      `The Truth About ${topic}`,
      `${topic}, Explained in Plain English`,
      `Why ${topic} Matters More Than You Think`,
    ],
    interview: [
      `${primary}: A Conversation`,
      `Inside ${topic} — An Interview`,
      `What ${primary} Taught Me About ${topic}`,
      `${topic}, From the Inside`,
    ],
    cohost: [
      `We Disagree About ${topic}`,
      `${primary}: Two Takes`,
      `Is ${topic} Overrated?`,
      `${topic} — A Friendly Argument`,
    ],
    panel: [
      `${primary}: A Panel Discussion`,
      `Four Experts on ${topic}`,
      `${topic}: Where the Experts Disagree`,
      `The ${primary} Roundtable`,
    ],
    story: [
      `${primary}: A Story`,
      `The ${topic} Story`,
      `What ${topic} Cost Me`,
      `${topic} — A Narrative`,
    ],
  };
  return base[format];
}

/** Generate 2-3 description options for the episode. */
export function generateDescriptionOptions(
  topic: string,
  format: EpisodeFormat,
  durationMin: number,
  guests: string[],
): string[] {
  const guestsStr = guests.length > 0 ? ` with ${guests.join(", ")}` : "";
  const opts: string[] = [];
  const fmtLabel = FORMAT_LABELS[format];
  opts.push(
    `In this ${fmtLabel.toLowerCase()} episode, we dive into ${topic}${guestsStr}. Duration: ${durationMin} min. We cover the framing, the mechanism, and what to actually do this week.`,
  );
  opts.push(
    `What is ${topic}, really? This ${durationMin}-minute ${fmtLabel.toLowerCase()} episode${guestsStr} breaks it down — no jargon, no fluff, just the parts that matter and what to do next.`,
  );
  opts.push(
    `${topic}${guestsStr}. ${durationMin} minutes. One big question, three answers, one thing you can do today. Press play.`,
  );
  return opts;
}

/** Generate a cold-open hook line. */
export function generateHook(topic: string, format: EpisodeFormat): string {
  const hooks: Record<EpisodeFormat, string> = {
    solo: `Most people think they understand ${topic}. They don't. Here's what's actually going on.`,
    interview: `When I asked our guest about ${topic}, they said something I didn't expect. Stick around.`,
    cohost: `We disagree about ${topic}. Strongly. And we're going to work it out, right now.`,
    panel: `Four experts. One question about ${topic}. They don't all agree — and that's the point.`,
    story: `It started with ${topic}. It ended somewhere none of us expected.`,
  };
  return hooks[format];
}

/** Generate show notes lines for the episode. */
export function generateShowNotes(
  topic: string,
  format: EpisodeFormat,
  guests: string[],
  segments: Segment[],
  chapterMarkers: ChapterMarker[],
): string[] {
  const notes: string[] = [];
  notes.push(`Topic: ${topic}`);
  notes.push(`Format: ${FORMAT_LABELS[format]}`);
  if (guests.length > 0) {
    notes.push(`Guests: ${guests.join(", ")}`);
  }
  notes.push("");
  notes.push("Chapters:");
  for (const c of chapterMarkers) {
    notes.push(`${c.timeLabel} — ${c.title}`);
  }
  notes.push("");
  notes.push("Key talking points:");
  for (const s of segments) {
    if (s.type === "ad-break") continue;
    notes.push(`• ${s.label}`);
  }
  notes.push("");
  notes.push("Mentioned in this episode:");
  notes.push("• (Add links as you record — leave space for them now.)");
  return notes;
}

/** Generate social clip suggestions for repurposing. */
export function generateSocialClips(
  segments: Segment[],
  topic: string,
): SocialClip[] {
  const out: SocialClip[] = [];
  // Pick 3 candidate segments: cold-open, a main/interview segment, and recap
  const candidates = segments.filter((s) =>
    s.type === "cold-open" || s.type === "main" || s.type === "interview" || s.type === "recap",
  );
  const platforms: SocialClip["suggestedPlatform"][] = [
    "tiktok", "reels", "youtube-shorts",
  ];
  let i = 0;
  for (const s of candidates.slice(0, 4)) {
    out.push({
      index: i + 1,
      segment: s.label,
      hook: i === 0
        ? `Cold open: ${topic} — promise a single takeaway.`
        : `Pull the most surprising line about ${topic} from this segment.`,
      suggestedPlatform: platforms[i % platforms.length],
      durationSec: 30 + (i % 3) * 15, // 30/45/60
    });
    i += 1;
  }
  return out;
}

/** Validate plan input. Returns null on success, error message otherwise. */
export function validateInput(
  topic: string,
  durationMin: number,
  format: EpisodeFormat,
  guests: string[],
): string | null {
  if (!normalizeTopic(topic)) return "Please enter a topic.";
  if (!Number.isFinite(durationMin) || durationMin < 1) return "Duration must be at least 1 minute.";
  if (durationMin > 240) return "Duration must be 240 minutes or less.";
  if (!FORMAT_LABELS[format]) return "Unknown episode format.";
  if ((format === "interview" || format === "panel") && guests.length === 0) {
    return `${format === "interview" ? "Interview" : "Panel"} format requires at least one guest.`;
  }
  if (format === "interview" && guests.length > 1) {
    return "Interview format supports one guest. Use 'Panel' for multiple.";
  }
  return null;
}

/** Main entry: generate a full episode plan. */
export function generateEpisode(input: {
  topic: string;
  format: EpisodeFormat;
  durationMin: number;
  guests: string[];
}): EpisodePlan {
  const { topic, format, durationMin, guests } = input;
  const err = validateInput(topic, durationMin, format, guests);
  if (err) throw new Error(err);

  const tNorm = normalizeTopic(topic);
  const totalSec = Math.round(durationMin * 60);
  const templates = SEGMENT_TEMPLATES[format];
  const segments = computeTimestamps(templates, totalSec);
  const adBreaks = generateAdBreaks(totalSec);
  const chapterMarkers = generateChapterMarkers(segments);
  const guestQuestions = generateGuestQuestions(guests, tNorm, format);
  const titleOptions = generateTitleOptions(tNorm, format);
  const descriptionOptions = generateDescriptionOptions(tNorm, format, durationMin, guests);
  const showNotes = generateShowNotes(tNorm, format, guests, segments, chapterMarkers);
  const socialClips = generateSocialClips(segments, tNorm);
  const keywords = extractKeywords(tNorm);
  const hook = generateHook(tNorm, format);

  return {
    id: `ep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    topic: tNorm,
    format,
    durationMin,
    guests,
    keywords,
    hook,
    segments,
    adBreaks,
    chapterMarkers,
    guestQuestions,
    titleOptions,
    descriptionOptions,
    showNotes,
    socialClips,
    createdAt: Date.now(),
  };
}

/** Compute summary stats for an episode plan. */
export function computeStats(plan: EpisodePlan): EpisodeStats {
  return {
    segmentCount: plan.segments.length,
    talkingPointCount: plan.segments.reduce((acc, s) => acc + s.talkingPoints.length, 0),
    adBreakCount: plan.adBreaks.length,
    guestQuestionCount: plan.guestQuestions.length,
    titleOptionCount: plan.titleOptions.length,
    socialClipCount: plan.socialClips.length,
    totalRuntimeSec: plan.durationMin * 60,
  };
}

// ---------- Renderers ----------

export function renderText(plan: EpisodePlan): string {
  const lines: string[] = [];
  lines.push(`PODCAST EPISODE PLAN`);
  lines.push(`Topic: ${plan.topic}`);
  lines.push(`Format: ${FORMAT_LABELS[plan.format]}`);
  lines.push(`Duration: ${plan.durationMin} min`);
  if (plan.guests.length > 0) lines.push(`Guests: ${plan.guests.join(", ")}`);
  lines.push("");
  lines.push(`HOOK: ${plan.hook}`);
  lines.push("");
  lines.push("SEGMENTS (with timestamps):");
  for (const s of plan.segments) {
    lines.push(`  ${s.startLabel} - ${s.endLabel}  ${s.label}`);
    for (const tp of s.talkingPoints) {
      lines.push(`    • ${tp}`);
    }
  }
  if (plan.adBreaks.length > 0) {
    lines.push("");
    lines.push("AD BREAKS:");
    for (const a of plan.adBreaks) {
      lines.push(`  ${a.atLabel}  ${a.position} (${a.durationSec}s)`);
    }
  }
  if (plan.guestQuestions.length > 0) {
    lines.push("");
    lines.push("GUEST QUESTIONS:");
    for (const q of plan.guestQuestions) {
      lines.push(`  [${q.guest}] ${q.question}  (intent: ${q.intent})`);
    }
  }
  if (plan.chapterMarkers.length > 0) {
    lines.push("");
    lines.push("CHAPTER MARKERS:");
    for (const c of plan.chapterMarkers) {
      lines.push(`  ${c.timeLabel}  Ch.${c.index} — ${c.title}`);
    }
  }
  if (plan.titleOptions.length > 0) {
    lines.push("");
    lines.push("TITLE OPTIONS:");
    plan.titleOptions.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  }
  if (plan.descriptionOptions.length > 0) {
    lines.push("");
    lines.push("DESCRIPTION OPTIONS:");
    plan.descriptionOptions.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
  }
  if (plan.socialClips.length > 0) {
    lines.push("");
    lines.push("SOCIAL CLIPS:");
    for (const c of plan.socialClips) {
      lines.push(`  ${c.index}. [${PLATFORM_LABELS[c.suggestedPlatform]}] ${c.durationSec}s — from "${c.segment}"`);
      lines.push(`     hook: ${c.hook}`);
    }
  }
  lines.push("");
  lines.push("SHOW NOTES:");
  for (const n of plan.showNotes) lines.push(`  ${n}`);
  return lines.join("\n");
}

export function renderMarkdown(plan: EpisodePlan): string {
  const lines: string[] = [];
  lines.push(`# ${plan.titleOptions[0] ?? plan.topic}`);
  lines.push("");
  lines.push(`**Format:** ${FORMAT_LABELS[plan.format]} · **Duration:** ${plan.durationMin} min`);
  if (plan.guests.length > 0) {
    lines.push(`**Guests:** ${plan.guests.join(", ")}`);
  }
  lines.push("");
  lines.push(`> ${plan.hook}`);
  lines.push("");
  lines.push("## Segments");
  for (const s of plan.segments) {
    lines.push(`### \`${s.startLabel} - ${s.endLabel}\` — ${s.label}`);
    for (const tp of s.talkingPoints) {
      lines.push(`- ${tp}`);
    }
    lines.push("");
  }
  if (plan.adBreaks.length > 0) {
    lines.push("## Ad breaks");
    for (const a of plan.adBreaks) {
      lines.push(`- \`${a.atLabel}\` — ${a.position} (${a.durationSec}s)`);
    }
    lines.push("");
  }
  if (plan.guestQuestions.length > 0) {
    lines.push("## Guest questions");
    for (const q of plan.guestQuestions) {
      lines.push(`- **[${q.guest}]** ${q.question}  _(${q.intent})_`);
    }
    lines.push("");
  }
  if (plan.chapterMarkers.length > 0) {
    lines.push("## Chapter markers");
    for (const c of plan.chapterMarkers) {
      lines.push(`- ${c.timeLabel} — Ch.${c.index}: ${c.title}`);
    }
    lines.push("");
  }
  if (plan.titleOptions.length > 0) {
    lines.push("## Title options");
    plan.titleOptions.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }
  if (plan.descriptionOptions.length > 0) {
    lines.push("## Description options");
    plan.descriptionOptions.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
    lines.push("");
  }
  if (plan.socialClips.length > 0) {
    lines.push("## Social clips");
    for (const c of plan.socialClips) {
      lines.push(`- **${c.index}. ${PLATFORM_LABELS[c.suggestedPlatform]}** (${c.durationSec}s) — from _${c.segment}_`);
      lines.push(`  - Hook: ${c.hook}`);
    }
    lines.push("");
  }
  lines.push("## Show notes");
  lines.push("```");
  for (const n of plan.showNotes) lines.push(n);
  lines.push("```");
  return lines.join("\n");
}

export function renderJson(plan: EpisodePlan): string {
  return JSON.stringify(plan, null, 2);
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  topic: string;
  format: EpisodeFormat;
  durationMin: number;
  guestCount: number;
  segmentCount: number;
  guestQuestionCount: number;
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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  topic: string;
  format: EpisodeFormat;
  durationMin: number;
  guests: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.topic) params.set("t", state.topic);
  if (state.format) params.set("f", state.format);
  if (state.durationMin) params.set("d", String(state.durationMin));
  if (state.guests) params.set("g", state.guests);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const t = params.get("t");
  if (t) out.topic = t;
  const f = params.get("f") as EpisodeFormat | null;
  if (f && f in FORMAT_LABELS) out.format = f;
  const d = params.get("d");
  if (d) {
    const n = parseInt(d, 10);
    if (Number.isFinite(n) && n > 0) out.durationMin = n;
  }
  const g = params.get("g");
  if (g) out.guests = g;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  topic: string,
  format: EpisodeFormat,
  durationMin: number,
  guests: string[],
): string {
  const fmt = FORMAT_LABELS[format];
  const guestStr = guests.length > 0 ? `Guests: ${guests.join(", ")}.` : "No guests (solo/co-host).";
  return [
    "You are a senior podcast producer who plans episodes that hold a listener's attention.",
    `Topic: ${topic}.`,
    `Format: ${fmt}.`,
    `Duration: ${durationMin} minutes.`,
    guestStr,
    "",
    "Generate a JSON object with these fields:",
    '- "hook": a 1-2 sentence cold open that teases the most surprising insight.',
    '- "segmentSuggestions": an array of 5-8 objects, each with {label, talkingPoints (array of 2-4 strings)}.',
    '- "guestQuestions": if there are guests, an array of 5-8 strings (else empty array).',
    '- "titleOptions": an array of 3-5 episode title options.',
    '- "showNotes": an array of 5-10 bullet points for show notes.',
    "",
    "Rules:",
    "- Be specific to the topic. Generic plans are not useful.",
    "- Each talking point must be a single actionable idea, not a category.",
    "- Avoid clichés and jargon.",
    "- Output ONLY the JSON object — no markdown fences, no commentary.",
  ].join("\n");
}

export function renderLlmResult(
  rawText: string,
):
  | {
      ok: true;
      result: {
        hook: string;
        segmentSuggestions: Array<{ label: string; talkingPoints: string[] }>;
        guestQuestions: string[];
        titleOptions: string[];
        showNotes: string[];
      };
    }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  if (Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const hook = typeof o.hook === "string" ? o.hook : "";
  const segmentSuggestionsRaw = Array.isArray(o.segmentSuggestions) ? o.segmentSuggestions : [];
  const segmentSuggestions: Array<{ label: string; talkingPoints: string[] }> = [];
  for (const item of segmentSuggestionsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as Record<string, unknown>;
    const label = typeof it.label === "string" ? it.label : "";
    const tp = Array.isArray(it.talkingPoints)
      ? it.talkingPoints.filter((x): x is string => typeof x === "string")
      : [];
    if (label) segmentSuggestions.push({ label, talkingPoints: tp });
  }
  const guestQuestions = Array.isArray(o.guestQuestions)
    ? o.guestQuestions.filter((x): x is string => typeof x === "string")
    : [];
  const titleOptions = Array.isArray(o.titleOptions)
    ? o.titleOptions.filter((x): x is string => typeof x === "string")
    : [];
  const showNotes = Array.isArray(o.showNotes)
    ? o.showNotes.filter((x): x is string => typeof x === "string")
    : [];
  if (!hook && segmentSuggestions.length === 0 && titleOptions.length === 0) {
    return { ok: false, error: "LLM output contained no useful content." };
  }
  return {
    ok: true,
    result: { hook, segmentSuggestions, guestQuestions, titleOptions, showNotes },
  };
}
