/**
 * AI Presentation Outline Generator — pure logic.
 *
 * Generate slide-by-slide presentation outlines from a topic, audience, and
 * goal. Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type DeckType =
  | "sales"
  | "training"
  | "conference"
  | "pitch"
  | "report"
  | "keynote";

export type SlideCountPreset = "lightning" | "short" | "standard" | "long" | "deep";

export type Tone = "formal" | "conversational" | "energetic";

export type Framework =
  | "problem-solution"
  | "heros-journey"
  | "pitch-deck"
  | "lecture"
  | "report";

export type VisualKind =
  | "chart"
  | "diagram"
  | "photo"
  | "screenshot"
  | "quote"
  | "statistic"
  | "video"
  | "logo";

export type SlideType =
  | "title"
  | "agenda"
  | "problem"
  | "solution"
  | "demo"
  | "data"
  | "evidence"
  | "market"
  | "traction"
  | "business-model"
  | "team"
  | "competition"
  | "financials"
  | "ask"
  | "learning-objective"
  | "concept"
  | "example"
  | "practice"
  | "recap"
  | "executive-summary"
  | "methodology"
  | "findings"
  | "recommendations"
  | "q-and-a"
  | "closing";

export interface Visual {
  kind: VisualKind;
  text: string;
}

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  bulletPoints: string[];
  speakerNotes: string;
  visual: Visual;
  secondsEstimate: number;
}

export interface ThesisVariant {
  text: string;
  stance: "for" | "against" | "neutral";
}

export interface Presentation {
  topic: string;
  audience: string;
  goal: string;
  deckType: DeckType;
  framework: Framework;
  tone: Tone;
  slideCount: number;
  totalSeconds: number;
  thesisVariants: ThesisVariant[];
  chosenThesis: string;
  slides: Slide[];
  generatedAt: number;
}

export interface Stats {
  totalSlides: number;
  totalBullets: number;
  totalSeconds: number;
  visualKinds: Record<VisualKind, number>;
  deckTypeLabel: string;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  audience: string;
  deckType: DeckType;
  slideCount: number;
  totalSeconds: number;
  thesis: string;
}

export interface ShareState {
  topic: string;
  audience: string;
  goal: string;
  deckType: DeckType;
  tone: Tone;
  preset: SlideCountPreset;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-presentation-outline-generator:history";
export const HISTORY_MAX = 20;

export const DECK_TYPE_LABELS: Record<DeckType, string> = {
  sales: "Sales (problem → close)",
  training: "Training (teach a skill)",
  conference: "Conference talk",
  pitch: "Investor pitch deck",
  report: "Report / findings",
  keynote: "Keynote (hero's journey)",
};

export const SLIDE_COUNT_LABELS: Record<SlideCountPreset, string> = {
  lightning: "Lightning (5 slides, ~5 min)",
  short: "Short (10 slides, ~12 min)",
  standard: "Standard (15 slides, ~20 min)",
  long: "Long (20 slides, ~30 min)",
  deep: "Deep (30 slides, ~45 min)",
};

export const SLIDE_COUNT_VALUES: Record<SlideCountPreset, number> = {
  lightning: 5,
  short: 10,
  standard: 15,
  long: 20,
  deep: 30,
};

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal (board-room)",
  conversational: "Conversational",
  energetic: "Energetic (keynote)",
};

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  "problem-solution": "Problem → Solution",
  "heros-journey": "Hero's Journey",
  "pitch-deck": "10-slide pitch deck",
  lecture: "Lecture (concept → example → practice)",
  report: "Report (exec summary → findings → recs)",
};

export const VISUAL_LABELS: Record<VisualKind, string> = {
  chart: "Chart",
  diagram: "Diagram",
  photo: "Photo",
  screenshot: "Screenshot",
  quote: "Quote",
  statistic: "Statistic",
  video: "Video",
  logo: "Logo",
};

export const SAMPLE_TOPICS: string[] = [
  "How our SaaS cut churn 32% in two quarters",
  "Onboarding new engineers to our monorepo",
  "Why edge computing is the next platform shift",
  "Launching our open-source SDK for IoT",
  "Q3 marketing performance and Q4 plan",
  "The future of remote-first culture",
  "Designing accessible forms at scale",
  "How we migrated 4M users to a new billing system",
];

export const AUDIENCE_PRESETS: string[] = [
  "Executives / C-suite",
  "Engineering team",
  "Sales team",
  "Investors (seed)",
  "Investors (Series A)",
  "Customers / prospects",
  "General conference audience",
  "New hires",
  "Press / analysts",
  "Cross-functional stakeholders",
];

// ---------- Pure helpers ----------

/** Normalize text — collapse whitespace, trim. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Extract content keywords from text (stop-word filtered). */
export function extractKeywords(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "else", "when", "where", "why", "how",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
    "that", "this", "these", "those", "it", "its", "they", "them", "their",
    "we", "us", "our", "you", "your", "he", "she", "him", "her", "his",
    "should", "would", "could", "can", "may", "might", "must", "shall",
    "not", "no", "yes", "do", "does", "did", "have", "has", "had",
    "what", "which", "who", "whom", "whose", "will", "about", "our", "my",
  ]);
  const words = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Title-case text. */
export function titleCase(s: string): string {
  const t = normalizeText(s);
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Detect deck type from goal phrasing (heuristic). */
export function detectDeckType(goal: string): DeckType {
  const g = normalizeText(goal).toLowerCase();
  if (!g) return "conference";
  if (/\b(sell|close|deal|quota|pipeline|prospect)\b/.test(g)) return "sales";
  if (/\b(train|teach|onboard|learn|educat|workshop)\b/.test(g)) return "training";
  if (/\b(invest|raise|seed|series a|pitch|funding|vc|capital)\b/.test(g)) return "pitch";
  if (/\b(report|quarterly|q1|q2|q3|q4|findings|results|audit)\b/.test(g)) return "report";
  if (/\b(keynote|inspire|vision|story|narrative)\b/.test(g)) return "keynote";
  return "conference";
}

/** Suggest the best framework for a deck type. */
export function suggestFramework(deckType: DeckType): Framework {
  switch (deckType) {
    case "sales": return "problem-solution";
    case "training": return "lecture";
    case "conference": return "problem-solution";
    case "pitch": return "pitch-deck";
    case "report": return "report";
    case "keynote": return "heros-journey";
  }
}

/** Suggest the best tone for a deck type. */
export function suggestTone(deckType: DeckType): Tone {
  switch (deckType) {
    case "sales": return "conversational";
    case "training": return "conversational";
    case "conference": return "energetic";
    case "pitch": return "formal";
    case "report": return "formal";
    case "keynote": return "energetic";
  }
}

/** Suggest angles for a vague topic. */
export function suggestAngles(topic: string): string[] {
  const t = normalizeText(topic);
  if (!t) return [];
  const kw = extractKeywords(t);
  const main = kw[0] ?? t;
  return [
    `${titleCase(main)}: a 12-month roadmap`,
    `The hidden cost of ignoring ${main.toLowerCase()}`,
    `How ${main.toLowerCase()} changed for our team`,
    `${titleCase(main)} for beginners`,
    `The case for ${main.toLowerCase()} now`,
  ];
}

/** Format seconds as Mm or Mm Ss. */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// ---------- Thesis generation ----------

/** Generate 1–3 thesis variants for a deck type. */
export function generateThesisVariants(topic: string, deckType: DeckType, audience: string): ThesisVariant[] {
  const t = titleCase(topic);
  const kw = extractKeywords(topic);
  const main = kw[0] ? titleCase(kw[0]) : t;
  const aud = audience || "the audience";
  switch (deckType) {
    case "sales":
      return [
        { text: `${t} solves a problem ${aud} already pays for — and today I'll show you why the math finally works.`, stance: "for" },
        { text: `By the end of this deck, ${aud} will see that ${main.toLowerCase()} is no longer a nice-to-have — it is the cheapest path to the outcome you are already buying.`, stance: "for" },
      ];
    case "training":
      return [
        { text: `After this session, ${aud} will be able to apply ${main.toLowerCase()} on their own — confidently and correctly.`, stance: "neutral" },
        { text: `${titleCase(main)} is a skill, not a mystery; this training turns it into a repeatable process.`, stance: "neutral" },
      ];
    case "conference":
      return [
        { text: `The big idea: ${t} is changing faster than the conventional wisdom admits — and ${aud} needs a new mental model.`, stance: "neutral" },
        { text: `In this talk I argue that ${main.toLowerCase()} is the missing piece in a puzzle ${aud} has been trying to solve for years.`, stance: "for" },
      ];
    case "pitch":
      return [
        { text: `${titleCase(main)} is a ${"$"}10M+ opportunity hiding in plain sight, and we are the team to capture it.`, stance: "for" },
        { text: `We are building the ${main.toLowerCase()} that ${aud} will use every day — and the traction proves we are right.`, stance: "for" },
      ];
    case "report":
      return [
        { text: `The data shows that ${t} is on track — with two caveats ${aud} must act on this quarter.`, stance: "neutral" },
        { text: `${titleCase(main)} performed as planned, but the headline number hides a story ${aud} needs to hear.`, stance: "neutral" },
      ];
    case "keynote":
      return [
        { text: `This is the story of how ${t} became personal — and what it asks of ${aud} next.`, stance: "neutral" },
        { text: `Every one of us, ${aud} included, is being invited into the story of ${main.toLowerCase()} — the question is what role we will play.`, stance: "neutral" },
      ];
  }
}

// ---------- Slide templates ----------

interface SlideTemplate {
  id: string;
  type: SlideType;
  weight: number; // proportion of total time
  title: (topic: string, kw: string[], audience: string, idx: number) => string;
  bulletPoints: (topic: string, kw: string[], audience: string, idx: number, tone: Tone) => string[];
  speakerNotes: (topic: string, kw: string[], audience: string, idx: number, tone: Tone) => string;
  visual: (topic: string, kw: string[], idx: number) => Visual;
}

function visual(kind: VisualKind, text: string): Visual {
  return { kind, text };
}

// ---------------- Sales deck ----------------

const SALES_TEMPLATES: SlideTemplate[] = [
  {
    id: "sales-title",
    type: "title",
    weight: 0.05,
    title: (t) => `${titleCase(t)}`,
    bulletPoints: (t, _kw, aud) => [
      `For: ${aud || "your team"}`,
      "Today's date and presenter name",
      "One-line value promise",
    ],
    speakerNotes: (_t, _kw, aud) =>
      `Welcome the room. State the promise in one sentence so ${aud || "the audience"} knows what they will walk away with. Resist the urge to dive into features — earn the right to be heard first.`,
    visual: () => visual("logo", "Your logo + customer logo side-by-side"),
  },
  {
    id: "sales-problem",
    type: "problem",
    weight: 0.15,
    title: () => "The problem you're paying for",
    bulletPoints: (t, kw) => [
      `Name the pain in ${kw[0] ?? t.toLowerCase()} today — in the customer's words.`,
      "Quantify the cost: hours, dollars, missed revenue.",
      "Show why existing workarounds fail.",
    ],
    speakerNotes: (t, kw) =>
      `Make the customer nod before you say a word about your product. The goal of this slide is recognition: yes, that is exactly our problem with ${kw[0] ?? t.toLowerCase()}. If they don't nod here, the rest of the deck is uphill.`,
    visual: (t) => visual("statistic", `Big-number callout: the cost of the ${t.toLowerCase()} problem`),
  },
  {
    id: "sales-solution",
    type: "solution",
    weight: 0.18,
    title: () => "Our solution, in one sentence",
    bulletPoints: (t, kw) => [
      `The one-sentence pitch for ${titleCase(kw[0] ?? t)}.`,
      "Three capabilities that map to the three pains.",
      "Why this only became possible now.",
    ],
    speakerNotes: (t, kw) =>
      `State the solution in a single sentence — no jargon, no acronyms. Then map each of the three pains from the previous slide to a specific capability of ${titleCase(kw[0] ?? t)}. End with 'why now': the shift that makes this possible today.`,
    visual: () => visual("diagram", "Three-column diagram: pain → capability → outcome"),
  },
  {
    id: "sales-demo",
    type: "demo",
    weight: 0.18,
    title: () => "See it work",
    bulletPoints: () => [
      "Live or recorded demo of the single most important workflow.",
      "Call out the 'before vs after' moment.",
      "Pause for questions before pricing.",
    ],
    speakerNotes: () =>
      `Demo the workflow, not the feature list. Pick the one workflow the customer just told you they hate, and show it completed in three clicks. Stop talking during the 'wow' moment — let it land.`,
    visual: () => visual("screenshot", "Screenshot of the product at the 'wow' moment"),
  },
  {
    id: "sales-data",
    type: "data",
    weight: 0.14,
    title: () => "Proof it works",
    bulletPoints: (t) => [
      `Customer story: who used ${t.toLowerCase()} and what happened.`,
      "Before vs after metrics (revenue, time, error rate).",
      "Quote from the customer, in their words.",
    ],
    speakerNotes: (t) =>
      `Numbers without a story don't sell. Lead with the customer's name and industry, then the metric that moved, then a one-line quote. The audience is checking whether someone like them got a result like the one they want from ${t.toLowerCase()}.`,
    visual: () => visual("chart", "Bar chart: before vs after on the key metric"),
  },
  {
    id: "sales-pricing",
    type: "business-model",
    weight: 0.12,
    title: () => "Pricing and ROI",
    bulletPoints: (t) => [
      `Price ${t.toLowerCase()} against the cost of the problem, not against competitors.`,
      "Three tiers (good / better / best).",
      "Payback period in months, not years.",
    ],
    speakerNotes: (t) =>
      `Anchor on value, not cost. Show the payback period in months — if ${t.toLowerCase()} pays for itself before the next budget cycle, the decision becomes obvious. Offer three tiers but make the middle one the obvious choice.`,
    visual: () => visual("chart", "ROI bar: cost of problem vs price of solution"),
  },
  {
    id: "sales-close",
    type: "closing",
    weight: 0.18,
    title: () => "Next steps",
    bulletPoints: () => [
      "The single decision you're asking for today.",
      "Pilot scope and timeline (2 weeks, 1 team).",
      "The one email you'll send after this meeting.",
    ],
    speakerNotes: () =>
      `Don't end on 'any questions?' — end on a decision. Name the exact ask (sign the pilot, schedule the technical review, introduce the buyer). Confirm the next step out loud and send the follow-up email within 24 hours.`,
    visual: () => visual("diagram", "Timeline: pilot → rollout → outcomes"),
  },
];

// ---------------- Training deck ----------------

const TRAINING_TEMPLATES: SlideTemplate[] = [
  {
    id: "train-title",
    type: "title",
    weight: 0.05,
    title: (t) => `${titleCase(t)}: a hands-on training`,
    bulletPoints: (t, _kw, aud) => [
      `What you'll be able to do with ${t.toLowerCase()}`,
      `For: ${aud || "the team"}`,
      "Duration and format",
    ],
    speakerNotes: () =>
      `Set the contract for the session: what we will cover, what you will be able to do at the end, and how we will know. Keep it short — the audience is here to learn, not to be welcomed at length.`,
    visual: () => visual("diagram", "Roadmap of the session's four modules"),
  },
  {
    id: "train-objectives",
    type: "learning-objective",
    weight: 0.1,
    title: () => "Learning objectives",
    bulletPoints: (t, kw) => [
      `By the end you can: explain ${kw[0] ?? t.toLowerCase()} in plain language.`,
      `Apply ${t.toLowerCase()} to a real problem.`,
      "Troubleshoot the three most common failure modes.",
    ],
    speakerNotes: (t, kw) =>
      `Learning objectives are promises — make them concrete and observable. 'Understand ${kw[0] ?? t.toLowerCase()}' is not a learning objective; 'be able to explain it to a teammate' is. Read each objective aloud so learners can self-assess at the end.`,
    visual: () => visual("diagram", "Three boxes: explain / apply / troubleshoot"),
  },
  {
    id: "train-concept",
    type: "concept",
    weight: 0.2,
    title: () => "The core concept",
    bulletPoints: (t, kw) => [
      `Define ${kw[0] ?? t.toLowerCase()} in one sentence.`,
      "Why it exists — the problem it solves.",
      "The mental model that makes it click.",
    ],
    speakerNotes: (t, kw) =>
      `Teach the concept twice: first with a definition, then with an analogy learners already understand. The analogy is what they'll remember in a week. Pause after the analogy and ask one learner to restate it in their own words before moving on.`,
    visual: () => visual("diagram", "Analogy diagram comparing the concept to something familiar"),
  },
  {
    id: "train-example",
    type: "example",
    weight: 0.2,
    title: () => "Worked example",
    bulletPoints: (t) => [
      `Walk through ${t.toLowerCase()} end-to-end on a real input.`,
      "Narrate each decision: why this, not that.",
      "Highlight the one step everyone gets wrong.",
    ],
    speakerNotes: (t) =>
      `Worked examples are where learning actually happens. Slow down. Narrate your thinking at each step — learners copy the reasoning, not just the keystrokes. Stop at the common mistake and let the room diagnose it before you fix it.`,
    visual: (t) => visual("screenshot", `Screenshot of the worked example for ${t.toLowerCase()}`),
  },
  {
    id: "train-practice",
    type: "practice",
    weight: 0.2,
    title: () => "Your turn: practice",
    bulletPoints: (t) => [
      `Hands-on exercise: apply ${t.toLowerCase()} to a new input.`,
      "Pair up — one driver, one observer.",
      "We'll review two solutions together.",
    ],
    speakerNotes: (t) =>
      `Practice is the whole point. Set a timer, walk the room, and resist the urge to lecture. When you find a stuck pair, ask a question instead of giving the answer. Plan to review two contrasting solutions — one that worked, one that didn't — so learners see the difference.`,
    visual: () => visual("diagram", "Exercise brief: input → task → expected output"),
  },
  {
    id: "train-pitfalls",
    type: "evidence",
    weight: 0.1,
    title: () => "Common pitfalls and how to avoid them",
    bulletPoints: (t) => [
      `Pitfall 1: skipping the planning step in ${t.toLowerCase()}.`,
      "Pitfall 2: over-tuning for one example.",
      "Pitfall 3: ignoring the failure modes.",
    ],
    speakerNotes: () =>
      `Pitfalls are the bridge from 'I did it once' to 'I can do it reliably'. For each pitfall, show the symptom (what goes wrong) and the fix (what to do instead). Learners who hit these later will remember the fix if you connected it to a concrete symptom here.`,
    visual: () => visual("diagram", "Three pitfalls: symptom → fix"),
  },
  {
    id: "train-recap",
    type: "recap",
    weight: 0.15,
    title: () => "Recap and next steps",
    bulletPoints: (t) => [
      "Re-read each learning objective — did we hit it?",
      `Where to learn more about ${t.toLowerCase()}.`,
      "Your homework: one real task by Friday.",
    ],
    speakerNotes: (t) =>
      `Recap against the learning objectives you set on slide 2 — same words, same order. If you missed one, say so and point to where learners can fill the gap. End with one concrete homework task: a real input they should apply ${t.toLowerCase()} to by Friday.`,
    visual: () => visual("diagram", "Checklist: objectives → check / gap"),
  },
];

// ---------------- Conference talk ----------------

const CONFERENCE_TEMPLATES: SlideTemplate[] = [
  {
    id: "conf-title",
    type: "title",
    weight: 0.05,
    title: (t) => titleCase(t),
    bulletPoints: (t, _kw, aud) => [
      t,
      `Presenter name + ${aud || "audience"}`,
      "Conference / date",
    ],
    speakerNotes: () =>
      `Open with a sentence the audience cannot predict. Skip the bio — the conference already introduced you. The job of the first 20 seconds is to make the audience lean in, not settle in.`,
    visual: () => visual("photo", "Full-bleed image that sets the emotional tone"),
  },
  {
    id: "conf-hook",
    type: "problem",
    weight: 0.12,
    title: () => "The hook",
    bulletPoints: (t, kw) => [
      `A story or statistic that reframes ${kw[0] ?? t.toLowerCase()}.`,
      "The question the audience didn't know they had.",
      "Why this talk, and why now.",
    ],
    speakerNotes: (t, kw) =>
      `The hook is not the abstract — it is the moment that earns the next 18 minutes. Pick a story or a number that surprises the audience about ${kw[0] ?? t.toLowerCase()}, then state the question that surprise raises. The rest of the talk answers that question.`,
    visual: () => visual("statistic", "One surprising number, full screen"),
  },
  {
    id: "conf-context",
    type: "evidence",
    weight: 0.13,
    title: () => "Context: how we got here",
    bulletPoints: (t, kw) => [
      `The history that matters for ${kw[0] ?? t.toLowerCase()} — in 60 seconds.`,
      "The conventional wisdom, and where it stops working.",
      "What changed in the last 12 months.",
    ],
    speakerNotes: (t, kw) =>
      `Give the minimum history the audience needs — then stop. The temptation is to teach; resist it. The job here is to make the next slide land, so include only the context that explains why ${kw[0] ?? t.toLowerCase()} is suddenly urgent.`,
    visual: () => visual("diagram", "Timeline: 3 inflection points leading to today"),
  },
  {
    id: "conf-argument",
    type: "solution",
    weight: 0.2,
    title: () => "The argument",
    bulletPoints: (t, kw) => [
      `The one claim: ${kw[0] ?? t.toLowerCase()} is not what you think.`,
      "Three reasons that, together, force the conclusion.",
      "The strongest objection — and why it fails.",
    ],
    speakerNotes: (t, kw) =>
      `State the claim in one sentence. Then give three reasons, in order of increasing strength — not in the order you thought of them. End by steelmanning the strongest objection and explaining why it ultimately fails. This is the spine of the talk; everything else is scaffolding.`,
    visual: () => visual("diagram", "Three-pillar diagram supporting the claim"),
  },
  {
    id: "conf-evidence",
    type: "evidence",
    weight: 0.2,
    title: () => "Evidence",
    bulletPoints: (t) => [
      `One concrete example that proves the claim about ${t.toLowerCase()}.`,
      "A second example from a different domain (transfer).",
      "The counter-example that tests the limits.",
    ],
    speakerNotes: (t) =>
      `Examples are how the audience will retell your talk to a colleague next week. Pick one example that proves the claim about ${t.toLowerCase()}, one from a different domain that shows it generalizes, and one that fails — to show you've thought about the boundary.`,
    visual: () => visual("chart", "Comparison chart: claim vs counter-example"),
  },
  {
    id: "conf-takeaway",
    type: "closing",
    weight: 0.2,
    title: () => "The takeaway",
    bulletPoints: (t) => [
      `The one sentence the audience should remember about ${t.toLowerCase()}.`,
      "What to do differently on Monday.",
      "The open question this talk leaves behind.",
    ],
    speakerNotes: (t) =>
      `End with the one sentence you want the audience to repeat in the elevator. Make it concrete — a verb, a noun, a deadline. Then point to the open question you couldn't answer, because that is where the audience's own work begins.`,
    visual: () => visual("quote", "The takeaway sentence, full screen, as a pull quote"),
  },
  {
    id: "conf-qa",
    type: "q-and-a",
    weight: 0.1,
    title: () => "Questions",
    bulletPoints: () => [
      "Where to find the slides and references.",
      "How to reach you (email / handle).",
      "The question you hope someone asks.",
    ],
    speakerNotes: () =>
      `Don't end on Q&A — end on the takeaway, then open Q&A. Have one question ready in case the room is quiet: 'A question I get a lot is…' primes the pump and surfaces the most useful discussion.`,
    visual: () => visual("diagram", "QR code → slides and references"),
  },
];

// ---------------- Pitch deck ----------------

const PITCH_TEMPLATES: SlideTemplate[] = [
  {
    id: "pitch-title",
    type: "title",
    weight: 0.04,
    title: (t) => `${titleCase(t)}`,
    bulletPoints: (t) => [
      t,
      "One-line tagline",
      "Presenter + date",
    ],
    speakerNotes: () =>
      `Investors see 1000 decks a year — your first slide must answer 'why am I looking at this?' in under 10 seconds. Lead with the company name and a tagline that hints at the size of the opportunity.`,
    visual: () => visual("logo", "Company logo, large, on a clean background"),
  },
  {
    id: "pitch-problem",
    type: "problem",
    weight: 0.12,
    title: () => "The problem",
    bulletPoints: (t, kw) => [
      `Who has the problem with ${kw[0] ?? t.toLowerCase()}? Be specific.`,
      "How are they solving it today?",
      "Why now? What changed?",
    ],
    speakerNotes: (t, kw) =>
      `The problem slide is where most pitches die. Don't describe a generic pain — describe a specific person, in a specific industry, losing a specific amount of money to ${kw[0] ?? t.toLowerCase()}. If the investor can't picture the customer, the rest of the deck is abstract.`,
    visual: () => visual("photo", "Photo of the customer at the moment of pain"),
  },
  {
    id: "pitch-solution",
    type: "solution",
    weight: 0.12,
    title: () => "The solution",
    bulletPoints: (t, kw) => [
      `What ${titleCase(kw[0] ?? t)} does — in one sentence.`,
      "The 'aha' demo moment.",
      "Why this is hard for competitors to copy.",
    ],
    speakerNotes: (t, kw) =>
      `The solution slide must answer the problem slide in one sentence. Then show the demo moment that makes the investor smile. End with the moat — the thing that is hard to copy. If you can't articulate the moat in one sentence, the investor will assume there isn't one.`,
    visual: () => visual("screenshot", "Product screenshot at the 'aha' moment"),
  },
  {
    id: "pitch-market",
    type: "market",
    weight: 0.1,
    title: () => "Market size",
    bulletPoints: (t, kw) => [
      `TAM / SAM / SOM for ${kw[0] ?? t.toLowerCase()}.`,
      "How you sized it (bottom-up, not top-down).",
      "Why this market is growing, not just large.",
    ],
    speakerNotes: (t, kw) =>
      `Investors have learned to discount top-down market sizing ('if we capture 1% of a $100B market…'). Show the bottom-up math: number of customers × ACV. Then explain why ${kw[0] ?? t.toLowerCase()} is a growing market, not a stagnant one — growth is what makes venture math work.`,
    visual: () => visual("chart", "TAM/SAM/SOM concentric circles"),
  },
  {
    id: "pitch-product",
    type: "demo",
    weight: 0.1,
    title: () => "Product",
    bulletPoints: (t) => [
      `The three capabilities that matter most for ${t.toLowerCase()}.`,
      "Architecture diagram (one slide, not five).",
      "What's shipped vs what's on the roadmap.",
    ],
    speakerNotes: (t) =>
      `Investors care less about features than about whether you can ship. Show the three capabilities that matter, a simple architecture diagram, and what's shipped vs roadmap. The roadmap should look ambitious but plausible — too modest and you sound small, too aggressive and you sound naive.`,
    visual: () => visual("diagram", "Simple architecture diagram"),
  },
  {
    id: "pitch-traction",
    type: "traction",
    weight: 0.12,
    title: () => "Traction",
    bulletPoints: (t) => [
      `MRR / ARR for ${t.toLowerCase()} — and the growth rate.`,
      "Logo count + 2 reference customers.",
      "The metric you optimize every week.",
    ],
    speakerNotes: (t) =>
      `Traction is the slide investors will spend the most time on. Lead with the headline number (ARR, MRR, or another primary metric) and the growth rate — both matter. Name two reference customers investors can call. End with the one metric you optimize every week; it tells investors what you actually care about.`,
    visual: () => visual("chart", "Hockey-stick growth chart, last 12 months"),
  },
  {
    id: "pitch-business-model",
    type: "business-model",
    weight: 0.08,
    title: () => "Business model",
    bulletPoints: (t) => [
      `How ${t.toLowerCase()} makes money (pricing, ACV, gross margin).`,
      "Sales motion: PLG vs sales-led.",
      "Unit economics: CAC, LTV, payback.",
    ],
    speakerNotes: (t) =>
      `Be explicit about pricing, ACV, and gross margin — investors will ask. State the sales motion (product-led or sales-led) because it determines burn. Show CAC, LTV, and payback period; if these aren't healthy yet, say what will make them healthy and when.`,
    visual: () => visual("chart", "Unit economics: CAC vs LTV bar chart"),
  },
  {
    id: "pitch-team",
    type: "team",
    weight: 0.08,
    title: () => "Team",
    bulletPoints: () => [
      "Founders: names, roles, one-line relevant bio each.",
      "Why this team, for this problem, now.",
      "Key hires in the next 12 months.",
    ],
    speakerNotes: () =>
      `Investors invest in teams before they invest in products. Show founders with one-line bios that establish relevant credibility (not bragging). State why this team — specifically — is the right one for this problem. End with the key hires you'll make with the raise; it shows you're thinking ahead.`,
    visual: () => visual("photo", "Founder headshots + company logo"),
  },
  {
    id: "pitch-competition",
    type: "competition",
    weight: 0.08,
    title: () => "Competition",
    bulletPoints: (t) => [
      `The 2x2: ${t.toLowerCase()} vs competitors on the two axes that matter.`,
      "Why incumbents won't move fast enough.",
      "Why other startups are behind.",
    ],
    speakerNotes: (t) =>
      `The 2x2 matrix is cliché but it works — use it. Put ${t.toLowerCase()} in the top-right and be honest about who else is close. Then explain the dynamic: why incumbents won't move (incentives) and why other startups are behind (distribution, talent, or data).`,
    visual: () => visual("chart", "2x2 competitive matrix"),
  },
  {
    id: "pitch-financials",
    type: "financials",
    weight: 0.08,
    title: () => "Financials",
    bulletPoints: () => [
      "3-year revenue projection (best case / base case).",
      "Gross margin trajectory.",
      "The two assumptions that drive the model.",
    ],
    speakerNotes: () =>
      `Three-year projections are guesses — investors know this. The point is to show your model is internally consistent and that you've identified the two assumptions that drive everything else. State those assumptions explicitly so investors can pressure-test them.`,
    visual: () => visual("chart", "3-year revenue projection, base case"),
  },
  {
    id: "pitch-ask",
    type: "ask",
    weight: 0.08,
    title: () => "The ask",
    bulletPoints: () => [
      "Raising $X over Y months.",
      "Use of funds: 3 buckets with percentages.",
      "The milestone this round buys (the next raise's story).",
    ],
    speakerNotes: () =>
      `State the ask clearly: how much, on what instrument, over what period. Show the use of funds in three buckets (usually product, sales, hiring) with percentages. End with the milestone — what true-up makes this round look like a great investment and unlocks the next one.`,
    visual: () => visual("chart", "Use of funds pie chart"),
  },
];

// ---------------- Report deck ----------------

const REPORT_TEMPLATES: SlideTemplate[] = [
  {
    id: "report-title",
    type: "title",
    weight: 0.05,
    title: (t) => `${titleCase(t)} — report`,
    bulletPoints: (t, _kw, aud) => [
      `Topic: ${t}`,
      `For: ${aud || "stakeholders"}`,
      "Period covered and date",
    ],
    speakerNotes: () =>
      `Open with the period covered and the question the report answers. The audience already knows why they're here — get to the answer fast.`,
    visual: () => visual("logo", "Company or team logo"),
  },
  {
    id: "report-summary",
    type: "executive-summary",
    weight: 0.2,
    title: () => "Executive summary",
    bulletPoints: (t) => [
      `The headline finding on ${t.toLowerCase()} — in one sentence.`,
      "Three supporting numbers.",
      "The single recommendation that follows.",
    ],
    speakerNotes: (t) =>
      `The executive summary is the only slide some of the audience will read. Lead with the headline finding on ${t.toLowerCase()}, give three supporting numbers (not five), and end with the single recommendation. Everything else in the deck is evidence for this slide.`,
    visual: (t) => visual("statistic", `Headline number on ${t.toLowerCase()}, full screen`),
  },
  {
    id: "report-methodology",
    type: "methodology",
    weight: 0.1,
    title: () => "Methodology",
    bulletPoints: (t) => [
      `How we measured ${t.toLowerCase()}.`,
      "Data sources and time window.",
      "Known limitations and how we handled them.",
    ],
    speakerNotes: (t) =>
      `State how you measured ${t.toLowerCase()}, what data you used, and the time window. Be explicit about limitations — investors and execs trust a methodology slide that admits its gaps more than one that pretends there are none.`,
    visual: () => visual("diagram", "Data flow: sources → processing → output"),
  },
  {
    id: "report-findings-1",
    type: "findings",
    weight: 0.18,
    title: () => "Findings: what the data shows",
    bulletPoints: (t, kw) => [
      `Finding 1: ${kw[0] ?? t.toLowerCase()} is trending up/down/sideways.`,
      "Finding 2: the segment that's driving the trend.",
      "Finding 3: the anomaly worth investigating.",
    ],
    speakerNotes: (t, kw) =>
      `Lead with the trend, then the segment, then the anomaly. Each finding should be one sentence with a number. Resist the urge to interpret here — interpretation belongs on the next slide. The audience needs the facts first.`,
    visual: (t) => visual("chart", `Line chart: ${t.toLowerCase()} over time, by segment`),
  },
  {
    id: "report-findings-2",
    type: "findings",
    weight: 0.15,
    title: () => "Findings: the why behind the numbers",
    bulletPoints: (t) => [
      `The most likely explanation for the ${t.toLowerCase()} trend.`,
      "Alternative explanations we ruled out (and why).",
      "What we still don't know.",
    ],
    speakerNotes: (t) =>
      `This is the interpretation slide. State the most likely explanation for the ${t.toLowerCase()} trend, then walk through the alternatives you ruled out and why. End with what you don't know — it builds credibility and surfaces the next round of analysis.`,
    visual: () => visual("diagram", "Driver tree: trend → root causes"),
  },
  {
    id: "report-recommendations",
    type: "recommendations",
    weight: 0.22,
    title: () => "Recommendations",
    bulletPoints: (t) => [
      `Recommendation 1: do X about ${t.toLowerCase()} — by when, by whom.`,
      "Recommendation 2: stop doing Y.",
      "Recommendation 3: investigate Z before the next report.",
    ],
    speakerNotes: (t) =>
      `Recommendations must be specific and owned. 'Improve ${t.toLowerCase()}' is not a recommendation — 'Pause campaign X by Friday and reallocate to channel Y' is. Each recommendation gets an owner and a deadline; otherwise nothing happens.`,
    visual: () => visual("diagram", "Recommendation table: action / owner / deadline"),
  },
  {
    id: "report-appendix",
    type: "evidence",
    weight: 0.1,
    title: () => "Appendix and references",
    bulletPoints: () => [
      "Detailed charts and breakdowns.",
      "Source links and data dictionaries.",
      "Contact for follow-up questions.",
    ],
    speakerNotes: () =>
      `The appendix is for the 10% of the audience who wants to go deep. Don't present it — point to it. Include the source links and data dictionaries so a skeptic can verify your work.`,
    visual: () => visual("diagram", "Index of appendix slides"),
  },
];

// ---------------- Keynote deck (hero's journey) ----------------

const KEYNOTE_TEMPLATES: SlideTemplate[] = [
  {
    id: "key-title",
    type: "title",
    weight: 0.05,
    title: (t) => titleCase(t),
    bulletPoints: (t, _kw, aud) => [
      t,
      `For: ${aud || "everyone in the room"}`,
      "Speaker + venue",
    ],
    speakerNotes: () =>
      `A keynote opens not with a fact but with a feeling. Walk on, pause, look at the audience, then deliver your first line. The first slide is a backdrop, not a content slide — let it set the tone and get out of the way.`,
    visual: () => visual("photo", "Cinematic full-bleed image"),
  },
  {
    id: "key-ordinary",
    type: "problem",
    weight: 0.15,
    title: () => "The ordinary world",
    bulletPoints: (t, kw) => [
      `Where ${kw[0] ?? t.toLowerCase()} lives today — the status quo.`,
      "The unspoken assumption everyone accepts.",
      "The quiet cost of leaving things as they are.",
    ],
    speakerNotes: (t, kw) =>
      `Describe the world as it is — not the problem, but the ordinary. Make the audience recognize their own world in your description of ${kw[0] ?? t.toLowerCase()}. The cost should be quiet, not loud; loud comes later.`,
    visual: () => visual("photo", "Photo of the 'before' world"),
  },
  {
    id: "key-call",
    type: "solution",
    weight: 0.15,
    title: () => "The call",
    bulletPoints: (t) => [
      `The moment ${t.toLowerCase()} stopped being hypothetical.`,
      "The choice that couldn't be unmade.",
      "Why you said yes (even though you shouldn't have).",
    ],
    speakerNotes: (t) =>
      `The call is the inciting incident — the moment ${t.toLowerCase()} became real. Make it specific: a date, a place, a person, a sentence someone said. The audience needs to see the moment you saw.`,
    visual: () => visual("photo", "Photo of the moment of the call"),
  },
  {
    id: "key-trials",
    type: "evidence",
    weight: 0.2,
    title: () => "The trials",
    bulletPoints: (t, kw) => [
      `The first failure with ${kw[0] ?? t.toLowerCase()} — and what it taught.`,
      "The moment you wanted to quit.",
      "The mentor or ally who changed the trajectory.",
    ],
    speakerNotes: (t, kw) =>
      `The trials are where the audience leans in. Failures are more compelling than successes — describe the first failure with ${kw[0] ?? t.toLowerCase()} in detail. The mentor is the turning point; introduce them as a person, not an archetype.`,
    visual: () => visual("photo", "Photo from the hardest moment"),
  },
  {
    id: "key-revelation",
    type: "evidence",
    weight: 0.2,
    title: () => "The revelation",
    bulletPoints: (t) => [
      `The insight about ${t.toLowerCase()} that changed everything.`,
      "Why you couldn't have learned it without the trials.",
      "The moment the audience should feel it land.",
    ],
    speakerNotes: (t) =>
      `The revelation is the point of the keynote — the insight about ${t.toLowerCase()} that the trials earned. State it in one sentence, then pause. Let the audience feel it land. Don't rush past the silence; the silence is the talk working.`,
    visual: () => visual("quote", "The revelation as a single sentence, full screen"),
  },
  {
    id: "key-return",
    type: "closing",
    weight: 0.2,
    title: () => "The return",
    bulletPoints: (t) => [
      `What ${t.toLowerCase()} looks like now, after the journey.`,
      "The gift you brought back — for the audience.",
      "The invitation: what role will they play?",
    ],
    speakerNotes: (t) =>
      `The return closes the loop: ${t.toLowerCase()} as it is now, the gift the journey produced, and the invitation to the audience. The invitation is what makes a keynote different from a story — it asks the audience to step into the next chapter.`,
    visual: () => visual("photo", "Photo of the 'after' world"),
  },
  {
    id: "key-thanks",
    type: "q-and-a",
    weight: 0.05,
    title: () => "Thank you",
    bulletPoints: () => [
      "One sentence of gratitude, sincerely.",
      "Where to continue the conversation.",
      "The line you want them to remember.",
    ],
    speakerNotes: () =>
      `End with one sentence of gratitude — not a list of thank-yous. Point to where the conversation continues (a site, a handle, a hallway). Then deliver the one line you want them to repeat tomorrow, and walk off. The last line is the talk.`,
    visual: () => visual("quote", "The closing line, full screen"),
  },
];

function templatesForDeckType(deckType: DeckType): SlideTemplate[] {
  switch (deckType) {
    case "sales": return SALES_TEMPLATES;
    case "training": return TRAINING_TEMPLATES;
    case "conference": return CONFERENCE_TEMPLATES;
    case "pitch": return PITCH_TEMPLATES;
    case "report": return REPORT_TEMPLATES;
    case "keynote": return KEYNOTE_TEMPLATES;
  }
}

// ---------- Presentation generation ----------

/** Estimate seconds for a slide based on its weight and total time. */
export function estimateSlideSeconds(weight: number, totalSeconds: number): number {
  return Math.max(20, Math.round(weight * totalSeconds));
}

/** Compute total talk seconds for a slide count and deck type. */
export function computeTotalSeconds(deckType: DeckType, slideCount: number): number {
  // Base seconds per slide varies by deck type
  const basePerSlide: Record<DeckType, number> = {
    sales: 90,
    training: 150,
    conference: 110,
    pitch: 50,
    report: 90,
    keynote: 100,
  };
  return Math.round(basePerSlide[deckType] * slideCount);
}

/** Build a slide from a template. */
function buildSlide(
  tpl: SlideTemplate,
  topic: string,
  kw: string[],
  audience: string,
  idx: number,
  tone: Tone,
  totalSeconds: number,
): Slide {
  return {
    id: tpl.id,
    type: tpl.type,
    title: tpl.title(topic, kw, audience, idx),
    bulletPoints: tpl.bulletPoints(topic, kw, audience, idx, tone),
    speakerNotes: tpl.speakerNotes(topic, kw, audience, idx, tone),
    visual: tpl.visual(topic, kw, idx),
    secondsEstimate: estimateSlideSeconds(tpl.weight, totalSeconds),
  };
}

/** Generate extra 'content' slides when the requested count exceeds the base template. */
function makeExtraSlide(
  deckType: DeckType,
  topic: string,
  kw: string[],
  audience: string,
  idx: number,
  tone: Tone,
  totalSeconds: number,
): Slide {
  const extras: Record<DeckType, { title: string; type: SlideType; visual: Visual }> = {
    sales: { title: "Customer story", type: "data", visual: visual("chart", "Chart: customer outcome metric") },
    training: { title: "Additional example", type: "example", visual: visual("screenshot", "Screenshot of additional example") },
    conference: { title: "Additional evidence", type: "evidence", visual: visual("chart", "Chart supporting the argument") },
    pitch: { title: "Additional traction", type: "traction", visual: visual("chart", "Chart: additional growth metric") },
    report: { title: "Additional findings", type: "findings", visual: visual("chart", "Chart: additional finding") },
    keynote: { title: "Another trial", type: "evidence", visual: visual("photo", "Photo from another trial") },
  };
  const extra = extras[deckType];
  return {
    id: `${deckType}-extra-${idx}`,
    type: extra.type,
    title: `${extra.title} ${idx}: ${titleCase(kw[0] ?? topic)}`,
    bulletPoints: [
      `Specific example relevant to ${kw[0] ?? topic.toLowerCase()}.`,
      `Why this matters for ${audience || "the audience"}.`,
      "The takeaway in one sentence.",
    ],
    speakerNotes: `An additional ${extra.title.toLowerCase()} slide to deepen the talk on ${kw[0] ?? topic.toLowerCase()}. Keep the same structure as the earlier slides of this type — concrete example, audience relevance, one-sentence takeaway. Trim if running long.`,
    visual: extra.visual,
    secondsEstimate: Math.max(20, Math.round(0.1 * totalSeconds)),
  };
}

/** Generate a full presentation. */
export function generatePresentation(
  topic: string,
  audience: string,
  goal: string,
  deckType: DeckType,
  tone: Tone,
  slideCount: number,
): Presentation {
  const t = normalizeText(topic);
  const aud = normalizeText(audience);
  const kw = extractKeywords(t);
  const totalSeconds = computeTotalSeconds(deckType, slideCount);
  const templates = templatesForDeckType(deckType);
  const thesisVariants = generateThesisVariants(t, deckType, aud);
  const chosenThesis = thesisVariants[0]?.text ?? "";
  const framework = suggestFramework(deckType);

  const slides: Slide[] = [];
  const baseCount = templates.length;

  if (slideCount <= baseCount) {
    // Truncate (but always keep title + closing)
    for (let i = 0; i < slideCount; i++) {
      slides.push(buildSlide(templates[i], t, kw, aud, i, tone, totalSeconds));
    }
    // Ensure the closing slide is always present
    const lastType = slides[slides.length - 1].type;
    if (lastType !== "closing" && lastType !== "q-and-a") {
      const closing = templates[templates.length - 1];
      slides[slides.length - 1] = buildSlide(closing, t, kw, aud, 0, tone, totalSeconds);
    }
  } else {
    // Use all base templates, then insert extra content slides BEFORE the closing
    const closingTpl = templates[templates.length - 1];
    const bodyTemplates = templates.slice(0, -1);
    for (let i = 0; i < bodyTemplates.length; i++) {
      slides.push(buildSlide(bodyTemplates[i], t, kw, aud, i, tone, totalSeconds));
    }
    let extraIdx = 1;
    while (slides.length < slideCount - 1) {
      slides.push(makeExtraSlide(deckType, t, kw, aud, extraIdx, tone, totalSeconds));
      extraIdx++;
    }
    slides.push(buildSlide(closingTpl, t, kw, aud, 0, tone, totalSeconds));
  }

  return {
    topic: t,
    audience: aud,
    goal,
    deckType,
    framework,
    tone,
    slideCount: slides.length,
    totalSeconds: slides.reduce((s, x) => s + x.secondsEstimate, 0),
    thesisVariants,
    chosenThesis,
    slides,
    generatedAt: Date.now(),
  };
}

// ---------- Slide operations ----------

/** Reorder slides by id list. */
export function reorderSlides(p: Presentation, orderedIds: string[]): Presentation {
  const map = new Map(p.slides.map((s) => [s.id, s]));
  const next: Slide[] = [];
  for (const id of orderedIds) {
    const s = map.get(id);
    if (s) {
      next.push(s);
      map.delete(id);
    }
  }
  for (const s of map.values()) next.push(s);
  return { ...p, slides: next };
}

/** Expand a slide — add deeper sub-points and more speaker notes. */
export function expandSlide(p: Presentation, slideId: string): Presentation {
  const slides = p.slides.map((s) => {
    if (s.id !== slideId) return s;
    return {
      ...s,
      bulletPoints: [
        ...s.bulletPoints,
        `Sub-point: a concrete example that tests this slide's claim.`,
        `Sub-point: a transition cue linking to the next slide.`,
      ],
      secondsEstimate: Math.round(s.secondsEstimate * 1.2),
    };
  });
  const totalSeconds = slides.reduce((sum, s) => sum + s.secondsEstimate, 0);
  return { ...p, slides, totalSeconds };
}

/** Regenerate a single slide by re-running its template with a new index seed. */
export function regenerateSlide(p: Presentation, slideId: string): Presentation {
  const slides = p.slides.map((s) => {
    if (s.id !== slideId) return s;
    const kw = extractKeywords(p.topic);
    const templates = templatesForDeckType(p.deckType);
    const tpl = templates.find((t) => t.id === s.id);
    if (!tpl) return s;
    // Re-run template with a fresh seed
    const seed = Date.now() % 7;
    return {
      ...s,
      title: tpl.title(p.topic, kw, p.audience, seed),
      bulletPoints: tpl.bulletPoints(p.topic, kw, p.audience, seed, p.tone),
      speakerNotes: tpl.speakerNotes(p.topic, kw, p.audience, seed, p.tone),
    };
  });
  return { ...p, slides };
}

/** Pick a different thesis variant by index. */
export function chooseThesis(p: Presentation, idx: number): Presentation {
  const variant = p.thesisVariants[idx];
  if (!variant) return p;
  return { ...p, chosenThesis: variant.text };
}

// ---------- Stats ----------

export function computeStats(p: Presentation): Stats {
  const visualKinds: Record<VisualKind, number> = {
    chart: 0, diagram: 0, photo: 0, screenshot: 0,
    quote: 0, statistic: 0, video: 0, logo: 0,
  };
  for (const s of p.slides) visualKinds[s.visual.kind] += 1;
  return {
    totalSlides: p.slides.length,
    totalBullets: p.slides.reduce((s, x) => s + x.bulletPoints.length, 0),
    totalSeconds: p.totalSeconds,
    visualKinds,
    deckTypeLabel: DECK_TYPE_LABELS[p.deckType],
  };
}

// ---------- Rendering ----------

export function renderText(p: Presentation): string {
  const lines: string[] = [];
  lines.push(`PRESENTATION OUTLINE — ${DECK_TYPE_LABELS[p.deckType]}`);
  lines.push(`Topic: ${p.topic}`);
  lines.push(`Audience: ${p.audience || "(unspecified)"}`);
  lines.push(`Goal: ${p.goal || "(unspecified)"}`);
  lines.push(`Tone: ${TONE_LABELS[p.tone]}`);
  lines.push(`Slides: ${p.slideCount} | Estimated time: ${formatTime(p.totalSeconds)}`);
  lines.push("");
  lines.push(`THESIS: ${p.chosenThesis}`);
  lines.push("");
  p.slides.forEach((s, i) => {
    lines.push(`## Slide ${i + 1}: ${s.title}  (${s.type}, ~${formatTime(s.secondsEstimate)})`);
    lines.push(`Visual: ${VISUAL_LABELS[s.visual.kind]} — ${s.visual.text}`);
    lines.push("");
    for (const b of s.bulletPoints) lines.push(`  - ${b}`);
    lines.push("");
    lines.push(`  Speaker notes: ${s.speakerNotes}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function renderMarkdown(p: Presentation): string {
  const lines: string[] = [];
  lines.push(`# ${p.topic}`);
  lines.push("");
  lines.push(`**Type:** ${DECK_TYPE_LABELS[p.deckType]}  `);
  lines.push(`**Audience:** ${p.audience || "(unspecified)"}  `);
  lines.push(`**Tone:** ${TONE_LABELS[p.tone]}  `);
  lines.push(`**Slides:** ${p.slideCount}  `);
  lines.push(`**Estimated time:** ${formatTime(p.totalSeconds)}  `);
  lines.push("");
  lines.push(`## Thesis`);
  lines.push("");
  lines.push(`> ${p.chosenThesis}`);
  lines.push("");
  if (p.thesisVariants.length > 1) {
    lines.push(`**Alternative thesis variants:**`);
    p.thesisVariants.slice(1).forEach((v, i) => {
      lines.push(`${i + 2}. ${v.text}  *(${v.stance})*`);
    });
    lines.push("");
  }
  p.slides.forEach((s, i) => {
    lines.push(`## Slide ${i + 1}: ${s.title}`);
    lines.push(`*${s.type} · ~${formatTime(s.secondsEstimate)}*`);
    lines.push("");
    lines.push(`**Visual:** ${VISUAL_LABELS[s.visual.kind]} — ${s.visual.text}`);
    lines.push("");
    lines.push(`**Bullets:**`);
    for (const b of s.bulletPoints) lines.push(`- ${b}`);
    lines.push("");
    lines.push(`**Speaker notes:**`);
    lines.push("");
    lines.push(`> ${s.speakerNotes}`);
    lines.push("");
  });
  return lines.join("\n");
}

/** Render a JSON export that is PPTX-ready (slides as objects). */
export function renderJson(p: Presentation): string {
  const exportObj = {
    topic: p.topic,
    audience: p.audience,
    goal: p.goal,
    deckType: p.deckType,
    framework: p.framework,
    tone: p.tone,
    slideCount: p.slideCount,
    totalSeconds: p.totalSeconds,
    thesis: p.chosenThesis,
    slides: p.slides.map((s, i) => ({
      index: i + 1,
      id: s.id,
      type: s.type,
      title: s.title,
      bullets: s.bulletPoints,
      speakerNotes: s.speakerNotes,
      visual: { kind: s.visual.kind, text: s.visual.text },
      secondsEstimate: s.secondsEstimate,
    })),
  };
  return JSON.stringify(exportObj, null, 2);
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
  if (state.audience) params.set("aud", state.audience);
  if (state.goal) params.set("goal", state.goal);
  if (state.deckType) params.set("type", state.deckType);
  if (state.tone) params.set("tone", state.tone);
  if (state.preset) params.set("preset", state.preset);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { topic: "", audience: "", goal: "", deckType: "conference", tone: "conversational", preset: "standard" };
  const params = new URLSearchParams(clean);
  const validTypes: DeckType[] = ["sales", "training", "conference", "pitch", "report", "keynote"];
  const validTones: Tone[] = ["formal", "conversational", "energetic"];
  const validPresets: SlideCountPreset[] = ["lightning", "short", "standard", "long", "deep"];
  const deckType = params.get("type") as DeckType | null;
  const tone = params.get("tone") as Tone | null;
  const preset = params.get("preset") as SlideCountPreset | null;
  return {
    topic: params.get("topic") ?? "",
    audience: params.get("aud") ?? "",
    goal: params.get("goal") ?? "",
    deckType: deckType && validTypes.includes(deckType) ? deckType : "conference",
    tone: tone && validTones.includes(tone) ? tone : "conversational",
    preset: preset && validPresets.includes(preset) ? preset : "standard",
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  topic: string,
  audience: string,
  goal: string,
  deckType: DeckType,
  tone: Tone,
  slideCount: number,
): LlmPrompt {
  const system = `You are an expert presentation-outline generator. Produce a ${deckType} deck outline on the user's topic, for the stated audience and goal, with ${slideCount} slides and a ${tone} tone. Return a hierarchical outline: thesis (1 sentence), then ${slideCount} slides each with a title, 3-5 bullets, a paragraph of speaker notes, and a visual suggestion (chart / diagram / photo / screenshot / quote / statistic / video / logo). Make speaker notes concrete and stage-direction-like. Visuals are suggestions only — do not generate images. Mark any placeholders explicitly with [BRACKET] syntax. Do not fabricate statistics or quotes; mark them as placeholders for the presenter to fill.`;
  const user = `Topic: ${topic}\nAudience: ${audience || "(unspecified)"}\nGoal: ${goal || "(unspecified)"}`;
  return { system, user };
}

export function renderLlmResult(raw: string): { ok: boolean; result?: string; error?: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: false, error: "LLM returned empty response" };
  return { ok: true, result: trimmed };
}
