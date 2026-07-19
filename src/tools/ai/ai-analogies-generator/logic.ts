/**
 * AI Analogies Generator — pure logic.
 *
 * Explain concepts with tailored analogies across multiple domains. Pure
 * functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type AnalogyDomain =
  | "cooking"
  | "sports"
  | "nature"
  | "technology"
  | "music"
  | "business"
  | "science"
  | "everyday"
  | "kids"
  | "vehicles";

export type AnalogyStyle = "metaphor" | "simile" | "story";
export type Complexity = "simple" | "standard" | "advanced";
export type Audience = "kid" | "teen" | "expert" | "executive";

export interface AnalogyVariation {
  id: string;
  concept: string;
  domain: AnalogyDomain;
  style: AnalogyStyle;
  complexity: Complexity;
  audience: Audience;
  headline: string;       // one-line analogy (the metaphor/simile/story opener)
  body: string;           // 1-3 sentence elaboration
  breakdown: string;      // "where it breaks down" honesty note
  score: number;          // 0-100 quality score
  keywords: string[];     // extracted concept keywords used
}

export interface Explainer {
  concept: string;
  domain: AnalogyDomain;
  headline: string;
  fullText: string;       // multi-paragraph explainer
  readingTimeMin: number;
  wordCount: number;
}

export interface DomainStats {
  domain: AnalogyDomain;
  count: number;
  avgScore: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-analogies:history";
export const HISTORY_MAX = 20;

export const DOMAIN_LABELS: Record<AnalogyDomain, string> = {
  cooking: "Cooking & Recipes",
  sports: "Sports & Games",
  nature: "Nature & Outdoors",
  technology: "Technology & Gadgets",
  music: "Music & Rhythm",
  business: "Business & Work",
  science: "Science & Lab",
  everyday: "Everyday Life",
  kids: "Kids & Play",
  vehicles: "Vehicles & Travel",
};

export const STYLE_LABELS: Record<AnalogyStyle, string> = {
  metaphor: "Metaphor (X is Y)",
  simile: "Simile (X is like Y)",
  story: "Short story (Imagine…)",
};

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  simple: "Simple (kid-friendly)",
  standard: "Standard (general audience)",
  advanced: "Advanced (technical depth)",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  kid: "Kid (8-12)",
  teen: "Teen (13-17)",
  expert: "Expert / professional",
  executive: "Executive / non-technical",
};

export const CONCEPT_PRESETS: string[] = [
  "DNS (Domain Name System)",
  "Quantum computing",
  "Compound interest",
  "Recursion in programming",
  "Inflation",
  "API (Application Programming Interface)",
  "Machine learning",
  "Blockchain",
  "Diversification in investing",
  " HTTP caching",
];

// ---------- Domain libraries ----------
// Each domain has a set of analogies expressed as templates with placeholders:
//   {concept}  — the concept being explained
//   {kw}       — a primary concept keyword
//   {kwList}   — comma-joined keyword list (no oxford)
//
// Each entry has a `headline` (the core analogy opener), a `bodyTpl`
// (1-3 sentence elaboration), and a `breakdownTpl` (honesty note).

interface DomainEntry {
  headlineTpl: string;
  bodyTpl: string;
  breakdownTpl: string;
  goodForKeywords: string[]; // hints for matching concept keywords (lowercase)
}

export const DOMAIN_LIBRARY: Record<AnalogyDomain, DomainEntry[]> = {
  cooking: [
    {
      headlineTpl: "{concept} is like a recipe — follow the steps in order and you get a dish.",
      bodyTpl: "You gather ingredients (inputs), follow a series of steps (the process), and end up with a finished dish (the output). Skip a step and the result falls flat.",
      breakdownTpl: "Recipes are linear and deterministic; {concept} often has feedback loops or randomness that a recipe can't capture.",
      goodForKeywords: ["process", "algorithm", "workflow", "step", "system", "code", "program", "function", "method", "recipe", "pipeline"],
    },
    {
      headlineTpl: "{concept} is like seasoning — a little at the right moment changes everything.",
      bodyTpl: "Add salt early and it penetrates; add at the end and it sits on top. {concept} works the same way — timing and dosage matter more than amount.",
      breakdownTpl: "Seasoning is one-dimensional (salt/acid/heat); {concept} usually has many interacting variables that don't reduce to a single dial.",
      goodForKeywords: ["parameter", "tuning", "balance", "control", "optimization", "calibration", "weight", "hyperparameter"],
    },
    {
      headlineTpl: "{concept} is like sourdough starter — feed it regularly and it stays alive.",
      bodyTpl: "Ignore it for a week and it dies; feed it daily and it grows stronger. {concept} needs ongoing care, not a one-time setup.",
      breakdownTpl: "Sourdough is biological and forgiving; {concept} may be mechanical, financial, or social — neglect looks different in each.",
      goodForKeywords: ["maintenance", "lifecycle", "long-term", "growth", "compound", "habit", "practice", "system"],
    },
    {
      headlineTpl: "{concept} is like a pressure cooker — same ingredients, much faster result.",
      bodyTpl: "Sealed heat builds pressure and the dish cooks in minutes instead of hours. {concept} compresses time the same way when conditions are right.",
      breakdownTpl: "A pressure cooker has a hard upper limit (the valve); {concept} often has no clean ceiling and can blow up in ways food can't.",
      goodForKeywords: ["acceleration", "scale", "leverage", "momentum", "amplification", "boost", "performance"],
    },
  ],
  sports: [
    {
      headlineTpl: "{concept} is like a relay race — the baton handoff is where races are won or lost.",
      bodyTpl: "Runners can be fast individually, but a sloppy handoff loses seconds. {concept} lives at the interfaces between parts, not inside any one of them.",
      breakdownTpl: "Relay handoffs are physical and visible; the handoffs in {concept} are often invisible (data, contracts, context) and harder to drill.",
      goodForKeywords: ["handoff", "interface", "transfer", "communication", "integration", "boundary", "edge", "middleware", "api", "network"],
    },
    {
      headlineTpl: "{concept} is like defense in football — you only notice when it fails.",
      bodyTpl: "Great defense is invisible: it stops the play before it starts. {concept} is the same — when it works, nothing dramatic happens.",
      breakdownTpl: "Defense has a clear opponent; {concept} may not have one. Sometimes the 'opponent' is entropy, time, or your own team.",
      goodForKeywords: ["security", "prevention", "safety", "risk", "monitoring", "compliance", "audit", "control", "guardrail"],
    },
    {
      headlineTpl: "{concept} is like batting in cricket — you protect your wicket before you score.",
      bodyTpl: "First, don't get out. Then, score runs. {concept} rewards survival before it rewards flair — most failures come from swinging too early.",
      breakdownTpl: "Cricket has one wicket to protect; {concept} may have many (capital, reputation, runway) and you can lose any of them.",
      goodForKeywords: ["risk", "preservation", "startup", "investment", "strategy", "runway", "survival", "minimum", "viable"],
    },
    {
      headlineTpl: "{concept} is like a basketball fast break — speed only works with a plan at the end.",
      bodyTpl: "Sprint down the court with no finisher and you waste the break. {concept} needs both speed and a target; either alone fails.",
      breakdownTpl: "A fast break ends in 5 seconds; {concept} may play out over years, and 'speed' has a different cost at that timescale.",
      goodForKeywords: ["agile", "speed", "delivery", "execution", "velocity", "iteration", "sprint", "release", "deadline"],
    },
  ],
  nature: [
    {
      headlineTpl: "{concept} is like a river — it takes the path of least resistance.",
      bodyTpl: "Water doesn't argue with the rock; it goes around. {concept} finds the easy route through whatever system you build, so design for that, not against it.",
      breakdownTpl: "A river is physical and visible; the 'path' in {concept} may be economic, social, or informational and harder to see.",
      goodForKeywords: ["flow", "incentive", "behavior", "system", "optimization", "gradient", "energy", "minimum", "path", "resistance"],
    },
    {
      headlineTpl: "{concept} is like a forest — the canopy hides most of the life.",
      bodyTpl: "What you see above ground is a fraction of the system. The real action is in roots, fungi, microbes — invisible interdependence. {concept} works the same way.",
      breakdownTpl: "A forest is bounded and biological; {concept} may stretch across organizations or networks with no clean edge.",
      goodForKeywords: ["ecosystem", "platform", "community", "network", "interdependence", "hidden", "underlying", "infrastructure"],
    },
    {
      headlineTpl: "{concept} is like a beaver dam — small effort, big downstream effect.",
      bodyTpl: "One beaver re-routes a whole stream. {concept} shows how a small change upstream causes a large change downstream.",
      breakdownTpl: "Beavers intend their dams; in {concept}, the 'small change' is often accidental and the downstream effect unwanted.",
      goodForKeywords: ["leverage", "compounding", "knock-on", "cascading", "ripple", "upstream", "downstream", "butterfly", "feedback"],
    },
    {
      headlineTpl: "{concept} is like autumn leaves — signals you can read before winter arrives.",
      bodyTpl: "Leaves turn before the cold hits. {concept} sends early signals if you know what to look at — most people miss them and react in winter.",
      breakdownTpl: "Autumn is cyclical and predictable; the signals in {concept} are often one-off and easy to mistake for noise.",
      goodForKeywords: ["signal", "indicator", "forecast", "leading", "early", "warning", "trend", "leading-indicator", "predict"],
    },
  ],
  technology: [
    {
      headlineTpl: "{concept} is like a USB cable — orientation never matters in theory, always in practice.",
      bodyTpl: "Plug it in, it doesn't fit; flip it, still doesn't fit; flip again, fits. {concept} is a small thing that reveals how messy real-world interfaces are.",
      breakdownTpl: "A USB cable has only two states; {concept} can have hundreds, and the 'right' orientation may depend on context you can't see.",
      goodForKeywords: ["interface", "compatibility", "edge-case", "ergonomics", "ux", "friction", "standards", "plug", "port"],
    },
    {
      headlineTpl: "{concept} is like version control — most of the value is in the history, not the latest file.",
      bodyTpl: "Anyone can write code; the magic is being able to see who changed what, when, and why. {concept} rewards keeping the trail, not just the result.",
      breakdownTpl: "Git stores every change explicitly; {concept} may rely on memory, logs, or politics — much harder to reconstruct.",
      goodForKeywords: ["history", "audit", "trace", "version", "git", "log", "record", "provenance", "lineage", "blame"],
    },
    {
      headlineTpl: "{concept} is like airplane mode — it doesn't make the device faster, it makes it safer.",
      bodyTpl: "Turning off the radios removes interference. {concept} sometimes improves by subtraction: cut the chatter and the signal comes through.",
      breakdownTpl: "Airplane mode is binary; in {concept}, you can't always tell which radios to turn off, and some are required.",
      goodForKeywords: ["focus", "isolation", "subtraction", "simplify", "noise", "signal", "minimal", "reduction", "frugal"],
    },
    {
      headlineTpl: "{concept} is like cache invalidation — famously hard because the world keeps changing.",
      bodyTpl: "Two computers hold a copy of the same fact; one updates it; now they disagree. {concept} is the same dance between a stored truth and a live one.",
      breakdownTpl: "Cache invalidation is a known hard problem with protocols; {concept} may have no protocol at all, just human coordination.",
      goodForKeywords: ["cache", "state", "sync", "consistency", "distributed", "version", "stale", "fresh", "update", "invalidate"],
    },
  ],
  music: [
    {
      headlineTpl: "{concept} is like a bass line — you don't notice it until it's wrong.",
      bodyTpl: "When the bass holds the groove, the song feels effortless. When it drifts, everything feels off. {concept} is the under-layer that makes the surface work.",
      breakdownTpl: "A bass line is one instrument with a clear role; {concept} may have many under-layers, and 'wrong' is subjective.",
      goodForKeywords: ["foundation", "underlying", "support", "infrastructure", "base", "core", "rhythm", "cadence", "structure"],
    },
    {
      headlineTpl: "{concept} is like a key change — the same song, suddenly in a different mood.",
      bodyTpl: "Modulate up a step and the chorus lifts; nothing has changed except the frame. {concept} reframes a familiar thing and changes how it lands.",
      breakdownTpl: "A key change is a single discrete jump; {concept} may be continuous or hidden, and the 'mood shift' may not be shared by everyone.",
      goodForKeywords: ["reframe", "perspective", "context", "shift", "pivot", "tone", "framing", "mood", "atmosphere"],
    },
    {
      headlineTpl: "{concept} is like a metronome — its value is in being boring and constant.",
      bodyTpl: "The metronome doesn't make music; it makes music possible by holding time. {concept} often works best when it's predictable enough to be ignored.",
      breakdownTpl: "A metronome has one job at one tempo; {concept} may need to vary, and 'predictable' can become 'brittle'.",
      goodForKeywords: ["timing", "schedule", "cadence", "rhythm", "consistency", "discipline", "tempo", "habit", "ritual"],
    },
    {
      headlineTpl: "{concept} is like a remix — same source material, completely different effect.",
      bodyTpl: "Reorder the stems, drop the beat, and the song becomes new. {concept} is often about recombination, not invention.",
      breakdownTpl: "A remix has an original to point to; {concept} may have no clear source, and 'remix' implies a creator who chooses.",
      goodForKeywords: ["remix", "recombine", "reorder", "iterate", "mashup", "combinatorics", "innovation", "synthesis"],
    },
  ],
  business: [
    {
      headlineTpl: "{concept} is like inventory — you pay for it whether it sells or not.",
      bodyTpl: "Stock sits on shelves and racks up storage cost. {concept} carries a holding cost: money, attention, or risk that accrues until it's used.",
      breakdownTpl: "Inventory is physical and countable; the 'stock' in {concept} may be intangible (decisions, obligations, technical debt) and easy to ignore.",
      goodForKeywords: ["inventory", "holding-cost", "carry", "debt", "technical-debt", "backlog", "wip", "work-in-progress", "stock"],
    },
    {
      headlineTpl: "{concept} is like a pricing page — every choice signals who you're for.",
      bodyTpl: "Three tiers or seven? Annual or monthly? Each option says something about your customer. {concept} is full of choices that are really positioning decisions.",
      breakdownTpl: "A pricing page is a single visible artifact; the 'choices' in {concept} may be scattered across teams and never named as positioning.",
      goodForKeywords: ["positioning", "signal", "brand", "pricing", "segmentation", "market", "customer", "audience", "fit"],
    },
    {
      headlineTpl: "{concept} is like runway — it's a clock that runs whether you use it or not.",
      bodyTpl: "Twelve months of cash doesn't mean twelve months of time; it means a countdown starts today. {concept} is the same: a resource that decays if not converted.",
      breakdownTpl: "Runway is denominated in money; {concept} may be denominated in attention, trust, or momentum — none of which show on a balance sheet.",
      goodForKeywords: ["runway", "cash", "burn", "time", "deadline", "countdown", "momentum", "decay", "depreciation"],
    },
    {
      headlineTpl: "{concept} is like an org chart — it tells you who reports to whom, not who actually does the work.",
      bodyTpl: "The real network is invisible: who asks whom for help, who blocks whom. {concept} has an official map and a real one, and they rarely match.",
      breakdownTpl: "An org chart is a single document; the 'real map' in {concept} may be distributed across dozens of unstated norms.",
      goodForKeywords: ["organization", "structure", "informal", "network", "influence", "politics", "culture", "team", "reporting"],
    },
  ],
  science: [
    {
      headlineTpl: "{concept} is like a phase change — same molecules, very different behavior.",
      bodyTpl: "Water to steam isn't gradual; at 100°C it jumps. {concept} often has thresholds where the system behaves in a qualitatively new way.",
      breakdownTpl: "Phase changes are physical and reproducible; the 'threshold' in {concept} may be social or economic and not repeatable.",
      goodForKeywords: ["threshold", "tipping", "phase", "nonlinear", "emergence", "jump", "tipping-point", "critical", "catastrophe"],
    },
    {
      headlineTpl: "{concept} is like a control group — without it, you can't tell signal from noise.",
      bodyTpl: "Run the experiment twice; only the difference teaches you anything. {concept} needs a baseline or every result looks meaningful.",
      breakdownTpl: "A control group is a clean experimental design; {concept} may be observational, where the 'control' is messy or missing.",
      goodForKeywords: ["control", "baseline", "experiment", "compare", "measurement", "metric", "ab-test", "control-group", "counterfactual"],
    },
    {
      headlineTpl: "{concept} is like half-life — decay looks slow until it suddenly isn't.",
      bodyTpl: "Radioactivity halves every period; after 10 periods you're at a thousandth. {concept} compounds the same way — slow, then sudden.",
      breakdownTpl: "Half-life is a precise exponential; the 'decay' in {concept} may be logistic, episodic, or feedback-driven.",
      goodForKeywords: ["decay", "half-life", "exponential", "compound", "growth", "decline", "depreciation", "rate"],
    },
    {
      headlineTpl: "{concept} is like entropy — it gets harder, not easier, to keep things ordered.",
      bodyTpl: "Messed-up rooms don't tidy themselves; systems drift toward disorder unless energy is spent. {concept} is the same: maintenance is the default cost.",
      breakdownTpl: "Entropy is a physical law; the 'disorder' in {concept} may be reversible locally with surprisingly little effort — at first.",
      goodForKeywords: ["entropy", "disorder", "decay", "maintenance", "drift", "complexity", "chaos", "disorganization"],
    },
  ],
  everyday: [
    {
      headlineTpl: "{concept} is like doing the dishes — small, daily, and unavoidable.",
      bodyTpl: "Skip it once and the pile doubles. {concept} is one of those things where the cost of skipping compounds into a much bigger task later.",
      breakdownTpl: "Dishes are a clear, bounded chore; {concept} may be open-ended, with no 'done' state and no clean pile to count.",
      goodForKeywords: ["habit", "chore", "maintenance", "routine", "daily", "small", "incremental", "discipline"],
    },
    {
      headlineTpl: "{concept} is like a packed suitcase — what you leave out matters as much as what you take.",
      bodyTpl: "Travel light and you move freely; overpack and you're dragging weight. {concept} rewards subtraction: the things you cut define the experience.",
      breakdownTpl: "A suitcase has a hard size limit; {concept} may have a soft, fuzzy limit and you only find it when you exceed it.",
      goodForKeywords: ["packing", "subtraction", "minimal", "essential", "tradeoff", "choice", "constraint", "limit"],
    },
    {
      headlineTpl: "{concept} is like keys — you don't lose them when you need them, you lose them last week.",
      bodyTpl: "By the time you notice, the loss is already old. {concept} often fails invisibly and you only find out downstream.",
      breakdownTpl: "Keys are concrete and physical; the 'loss' in {concept} may be information, trust, or context — and may never be found.",
      goodForKeywords: ["loss", "missing", "hidden", "downstream", "delayed", "late", "discover", "invisibles"],
    },
    {
      headlineTpl: "{concept} is like a morning routine — the value is in the repetition, not any single day.",
      bodyTpl: "One good morning doesn't change your life; a thousand do. {concept} works through compounding repetition, not heroic one-offs.",
      breakdownTpl: "A morning routine is a personal habit; {concept} may need coordination across many people, where repetition is much harder.",
      goodForKeywords: ["routine", "habit", "repetition", "compounding", "consistency", "ritual", "cadence"],
    },
  ],
  kids: [
    {
      headlineTpl: "{concept} is like building with Lego — the bricks are simple, what you build isn't.",
      bodyTpl: "A handful of brick shapes can make a castle or a spaceship. {concept} uses a few simple pieces to make very different things.",
      breakdownTpl: "Lego bricks always fit together; the 'pieces' of {concept} don't always click, and some combinations don't work.",
      goodForKeywords: ["build", "compose", "pieces", "blocks", "simple", "modular", "construct", "assemble", "parts"],
    },
    {
      headlineTpl: "{concept} is like passing a secret in a game of telephone — it changes by the end.",
      bodyTpl: "You whisper to the next person, they whisper to the next, and by the end the message is different. {concept} changes as it moves through people or systems.",
      breakdownTpl: "Telephone is a game with clear rules; {concept} happens in real life where the 'players' don't know they're playing.",
      goodForKeywords: ["communication", "transmission", "chain", "relay", "message", "loss", "distortion", "gossip"],
    },
    {
      headlineTpl: "{concept} is like hide and seek — the seeker has to count, but the hiders have to be quiet forever.",
      bodyTpl: "Two roles, two very different costs. {concept} often has roles that look symmetric but aren't — one side waits while the other acts.",
      breakdownTpl: "Hide and seek ends when found; {concept} may have no clean end, and the 'hiders' may not know they're hiding.",
      goodForKeywords: ["asymmetric", "roles", "seeker", "hider", "imbalance", "attacker", "defender", "cat-and-mouse"],
    },
    {
      headlineTpl: "{concept} is like stacking blocks — the tower gets wobblier the taller it gets.",
      bodyTpl: "One more block and the whole thing tips. {concept} often looks fine right up to the moment it falls — height hides fragility.",
      breakdownTpl: "Blocks fall sideways and visibly; {concept} may collapse inward, on a delay, or so slowly you don't see it.",
      goodForKeywords: ["stack", "tall", "fragile", "tipping", "tall-tower", "risk", "height", "leverage", "fragility"],
    },
  ],
  vehicles: [
    {
      headlineTpl: "{concept} is like a clutch — smooth at the right speed, jerky when rushed.",
      bodyTpl: "Engage too fast and the car stalls; too slow and you burn the plate. {concept} rewards matching the pace of the system you're joining.",
      breakdownTpl: "A clutch is a single mechanical part; the 'engagement' in {concept} may be many things at once, each with its own ideal pace.",
      goodForKeywords: ["engage", "onboard", "pace", "transition", "shift", "gear", "smooth", "handoff", "joining"],
    },
    {
      headlineTpl: "{concept} is like a fuel gauge — empty isn't empty, it's 'start looking now'.",
      bodyTpl: "The light comes on with reserve left, by design. {concept} often has early warnings built in; treating them as final leads to running dry.",
      breakdownTpl: "A fuel gauge is a single calibrated sensor; {concept} may have many gauges, some of which lie, and no single 'empty'.",
      goodForKeywords: ["warning", "indicator", "early", "signal", "gauge", "reserve", "buffer", "low", "alert"],
    },
    {
      headlineTpl: "{concept} is like a roundabout — you never stop, but you always yield.",
      bodyTpl: "Traffic flows because each entry waits for a gap. {concept} can keep moving as long as every join point respects what's already flowing.",
      breakdownTpl: "A roundabout is one physical layout with right-of-way rules; {concept} may have dozens of join points and no shared rulebook.",
      goodForKeywords: ["flow", "yield", "merge", "merge-traffic", "round-robin", "queue", "stream", "concurrency"],
    },
    {
      headlineTpl: "{concept} is like cruise control — set the speed, but you still have to steer.",
      bodyTpl: "Cruise holds the throttle; it doesn't pick the lane or brake for traffic. {concept} automates one dimension so you can focus on the others.",
      breakdownTpl: "Cruise control has a clear off switch and a single job; {concept} may have many automated layers, some with no off switch.",
      goodForKeywords: ["automate", "delegate", "control", "speed", "set-point", "steady", "cruise", "autopilot", "feedback-loop"],
    },
  ],
};

// ---------- Concept keyword extraction ----------

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with", "and", "or",
  "is", "are", "be", "by", "as", "from", "that", "this", "it", "its", "into",
  "how", "what", "why", "when", "where", "which", "who", "do", "does", "did",
  "can", "could", "should", "would", "will", "may", "might", "must", "shall",
  "your", "you", "we", "they", "i", "me", "him", "her", "them", "us", "our",
  "their", "his", "hers",
]);

/** Normalize a concept string — preserve original case but collapse whitespace. */
export function normalizeConcept(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Strip trailing parenthetical like "DNS (Domain Name System)" — keep both forms. */
export function extractAcronym(s: string): { short: string; long: string } | null {
  const m = s.match(/^([A-Z]{2,})\s*\(([^)]+)\)$/);
  if (m) return { short: m[1], long: m[2] };
  const m2 = s.match(/^([A-Z]{2,})$/);
  if (m2) return { short: m2[1], long: "" };
  return null;
}

/** Extract meaningful keywords from a concept (lowercase). */
export function extractKeywords(concept: string): string[] {
  const n = normalizeConcept(concept);
  if (!n) return [];
  // Strip parenthetical content for keyword extraction
  const noParen = n.replace(/\s*\([^)]*\)/g, "").trim();
  const source = noParen || n;
  const words = source
    .toLowerCase()
    .split(/[^a-z0-9+-]+/i)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  // Deduplicate, preserve order
  const out: string[] = [];
  for (const w of words) {
    if (!out.includes(w)) out.push(w);
  }
  // Add hyphenated variants too (e.g., "leading-indicator")
  const phrase = out.join(" ");
  if (phrase.length > 0) out.push(phrase);
  return out;
}

// ---------- Analogy generation ----------

/** Build a deterministic id from analogy attributes. */
function makeId(concept: string, domain: AnalogyDomain, style: AnalogyStyle, idx: number): string {
  const h = simpleHash(`${concept}|${domain}|${style}|${idx}`);
  return `a-${h.toString(36)}`;
}

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** Render a template by substituting placeholders. */
export function renderTemplate(
  tpl: string,
  ctx: { concept: string; kw: string; kwList: string },
): string {
  return tpl
    .replace(/\{concept\}/g, ctx.concept)
    .replace(/\{kw\}/g, ctx.kw)
    .replace(/\{kwList\}/g, ctx.kwList);
}

/** Choose the best-matching domain entry by concept keyword overlap. */
export function pickBestEntry(
  domain: AnalogyDomain,
  keywords: string[],
): DomainEntry {
  const entries = DOMAIN_LIBRARY[domain];
  if (entries.length === 0) {
    // Should never happen, but satisfy TS
    return {
      headlineTpl: "{concept} is like a {kw}.",
      bodyTpl: "It's a comparison that helps explain {concept}.",
      breakdownTpl: "This analogy simplifies {concept} and may not capture every nuance.",
      goodForKeywords: [],
    };
  }
  if (keywords.length === 0) return entries[0];
  let best = entries[0];
  let bestScore = -1;
  for (const e of entries) {
    let s = 0;
    for (const g of e.goodForKeywords) {
      for (const k of keywords) {
        if (g === k) s += 3;
        else if (g.includes(k) || k.includes(g)) s += 1;
      }
    }
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best;
}

/**
 * Generate analogy variations for a concept.
 * Returns one variation per (entry × style) combination, capped by `max`.
 */
export function generateAnalogies(opts: {
  concept: string;
  domains: AnalogyDomain[];
  styles: AnalogyStyle[];
  complexity: Complexity;
  audience: Audience;
  max?: number;
}): AnalogyVariation[] {
  const concept = normalizeConcept(opts.concept);
  if (!concept || opts.domains.length === 0 || opts.styles.length === 0) return [];
  const keywords = extractKeywords(concept);
  const kw = keywords[0] ?? concept.toLowerCase();
  const kwList = keywords.slice(0, 3).join(", ");
  const max = opts.max ?? 10;
  const out: AnalogyVariation[] = [];
  let idx = 0;
  outer: for (const domain of opts.domains) {
    const entry = pickBestEntry(domain, keywords);
    for (const style of opts.styles) {
      const headline = renderTemplate(
        applyStyleToHeadline(entry.headlineTpl, style),
        { concept, kw, kwList },
      );
      const body = applyStyleToBody(entry.bodyTpl, style, { concept, kw, kwList });
      const breakdown = renderTemplate(entry.breakdownTpl, { concept, kw, kwList });
      out.push({
        id: makeId(concept, domain, style, idx),
        concept,
        domain,
        style,
        complexity: opts.complexity,
        audience: opts.audience,
        headline,
        body,
        breakdown,
        score: scoreAnalogy({ headline, body, breakdown, keywords, domain, style }),
        keywords,
      });
      idx++;
      if (out.length >= max) break outer;
    }
  }
  return out;
}

/** Apply style transformation to a headline template. */
function applyStyleToHeadline(tpl: string, style: AnalogyStyle): string {
  // The templates are written as metaphors ("X is like Y" is the canonical form).
  // For pure metaphor style: replace "is like" with "is".
  // For simile style: keep "is like".
  // For story style: prefix with "Imagine — ".
  if (style === "metaphor") {
    return tpl.replace(/\bis like\b/g, "is");
  }
  if (style === "simile") {
    return tpl; // already "is like"
  }
  // story
  return tpl.replace(/^([^—]+)\bis like\b/, "Imagine — $1is").replace(/^([^—]+)\bis\b/, "Imagine — $1is");
}

/** Apply style transformation to a body template. */
function applyStyleToBody(
  tpl: string,
  style: AnalogyStyle,
  ctx: { concept: string; kw: string; kwList: string },
): string {
  const rendered = renderTemplate(tpl, ctx);
  if (style === "story") {
    // Story style wraps the body in a narrative frame.
    return `Picture this: ${rendered.charAt(0).toLowerCase()}${rendered.slice(1)} That's what ${ctx.concept.toLowerCase()} feels like in practice.`;
  }
  return rendered;
}

/** Score an analogy 0-100 based on coverage, length, and domain fit. */
export function scoreAnalogy(opts: {
  headline: string;
  body: string;
  breakdown: string;
  keywords: string[];
  domain: AnalogyDomain;
  style: AnalogyStyle;
}): number {
  let s = 50;
  // Headline length sweet spot: 40-120 chars
  const hLen = opts.headline.length;
  if (hLen >= 40 && hLen <= 120) s += 10;
  else if (hLen < 20) s -= 10;
  // Body length sweet spot: 80-300 chars
  const bLen = opts.body.length;
  if (bLen >= 80 && bLen <= 300) s += 10;
  // Breakdown must be present and substantive (>40 chars)
  if (opts.breakdown.length > 40) s += 10;
  // Keyword coverage: every keyword used adds a little
  const combined = `${opts.headline} ${opts.body} ${opts.breakdown}`.toLowerCase();
  let used = 0;
  for (const k of opts.keywords) {
    if (combined.includes(k.toLowerCase())) used++;
  }
  if (opts.keywords.length > 0) {
    s += Math.round((used / opts.keywords.length) * 15);
  }
  // Story style gets a small bonus for being more memorable
  if (opts.style === "story") s += 3;
  // Cap
  return Math.max(0, Math.min(100, s));
}

// ---------- Explainer expansion ----------

/** Expand a chosen analogy into a multi-paragraph explainer. */
export function expandExplainer(
  variation: AnalogyVariation,
): Explainer {
  const paragraphs: string[] = [];
  paragraphs.push(
    `**${variation.headline}**\n\n${variation.body}`,
  );
  paragraphs.push(
    `**Why this works:** the analogy maps cleanly onto the parts of ${variation.concept} you care about most. The domain "${DOMAIN_LABELS[variation.domain]}" is familiar to most audiences, so the comparison lands without setup.`,
  );
  paragraphs.push(
    `**Where the analogy breaks:** ${variation.breakdown} Use the analogy to introduce ${variation.concept}, then refine as the audience gets comfortable.`,
  );
  paragraphs.push(
    `**How to deliver it:** say the headline first, pause, then give the body. If the audience pushes back, surface the breakdown honestly — admitting the limit builds trust faster than papering over it.`,
  );
  if (variation.complexity === "advanced") {
    paragraphs.push(
      `**Advanced note:** for expert audiences, pair this analogy with a second one from a different domain to triangulate. No single analogy captures ${variation.concept} completely; the intersection of two often does.`,
    );
  }
  if (variation.audience === "kid") {
    paragraphs.push(
      `**For kids:** keep it short. Say the headline, ask "does that make sense?", and only continue if they say yes. Resist the urge to add detail — the analogy is the lesson.`,
    );
  }
  const fullText = paragraphs.join("\n\n");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200));
  return {
    concept: variation.concept,
    domain: variation.domain,
    headline: variation.headline,
    fullText,
    readingTimeMin,
    wordCount,
  };
}

// ---------- Stats ----------

export function computeStats(variations: AnalogyVariation[]): DomainStats[] {
  const byDomain = new Map<AnalogyDomain, AnalogyVariation[]>();
  for (const v of variations) {
    if (!byDomain.has(v.domain)) byDomain.set(v.domain, []);
    byDomain.get(v.domain)!.push(v);
  }
  const out: DomainStats[] = [];
  for (const [domain, list] of byDomain) {
    const avg = list.length > 0
      ? Math.round(list.reduce((a, b) => a + b.score, 0) / list.length)
      : 0;
    out.push({ domain, count: list.length, avgScore: avg });
  }
  out.sort((a, b) => b.avgScore - a.avgScore);
  return out;
}

// ---------- Renderers ----------

export function renderText(variations: AnalogyVariation[]): string {
  return variations.map((v) => {
    const lines = [
      `${DOMAIN_LABELS[v.domain]} — ${STYLE_LABELS[v.style]}`,
      v.headline,
      v.body,
      `Limitation: ${v.breakdown}`,
      `Score: ${v.score}/100`,
      "",
    ];
    return lines.join("\n");
  }).join("\n");
}

export function renderMarkdown(variations: AnalogyVariation[]): string {
  return variations.map((v) => {
    const lines = [
      `### ${DOMAIN_LABELS[v.domain]} · ${STYLE_LABELS[v.style]} · score ${v.score}/100`,
      "",
      `**${v.headline}**`,
      "",
      v.body,
      "",
      `> **Where it breaks:** ${v.breakdown}`,
      "",
    ];
    return lines.join("\n");
  }).join("\n---\n\n");
}

export function renderJson(variations: AnalogyVariation[]): string {
  return JSON.stringify(variations, null, 2);
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  concept: string;
  domainCount: number;
  styleCount: number;
  variationCount: number;
  avgScore: number;
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
  concept: string;
  domains: AnalogyDomain[];
  styles: AnalogyStyle[];
  complexity: Complexity;
  audience: Audience;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.concept) params.set("c", state.concept);
  if (state.domains.length > 0) params.set("d", state.domains.join(","));
  if (state.styles.length > 0) params.set("s", state.styles.join(","));
  if (state.complexity) params.set("cx", state.complexity);
  if (state.audience) params.set("a", state.audience);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const c = params.get("c");
  if (c) out.concept = c;
  const d = params.get("d");
  if (d) {
    const valid = Object.keys(DOMAIN_LABELS) as AnalogyDomain[];
    out.domains = d.split(",").filter((x) => valid.includes(x as AnalogyDomain)) as AnalogyDomain[];
  }
  const s = params.get("s");
  if (s) {
    const valid = Object.keys(STYLE_LABELS) as AnalogyStyle[];
    out.styles = s.split(",").filter((x) => valid.includes(x as AnalogyStyle)) as AnalogyStyle[];
  }
  const cx = params.get("cx") as Complexity | null;
  if (cx && cx in COMPLEXITY_LABELS) out.complexity = cx;
  const a = params.get("a") as Audience | null;
  if (a && a in AUDIENCE_LABELS) out.audience = a;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  concept: string,
  domains: AnalogyDomain[],
  styles: AnalogyStyle[],
  complexity: Complexity,
  audience: Audience,
): string {
  const domainList = domains.map((d) => DOMAIN_LABELS[d]).join(", ") || "(any)";
  const styleList = styles.map((s) => STYLE_LABELS[s]).join(", ") || "(any)";
  return [
    "You are a master teacher who explains complex concepts using tailored analogies.",
    `Concept to explain: ${concept}.`,
    `Target domains: ${domainList}.`,
    `Preferred styles: ${styleList}.`,
    `Complexity: ${COMPLEXITY_LABELS[complexity]}.`,
    `Audience: ${AUDIENCE_LABELS[audience]}.`,
    "",
    "Generate 5-10 distinct analogies. For each, output a JSON object with:",
    '- "headline": one-sentence analogy opener',
    '- "body": 1-3 sentence elaboration',
    '- "breakdown": an honesty note explaining where the analogy breaks down',
    "",
    "Rules:",
    "- Avoid clichés. Prefer concrete, specific comparisons over generic ones.",
    "- Each breakdown must name at least one specific way the analogy misleads.",
    "- Output ONLY a JSON array of objects — no markdown fences, no commentary.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; variations: Array<{ headline: string; body: string; breakdown: string }> }
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
  const out: Array<{ headline: string; body: string; breakdown: string }> = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const headline = typeof o.headline === "string" ? o.headline : "";
    const body = typeof o.body === "string" ? o.body : "";
    const breakdown = typeof o.breakdown === "string" ? o.breakdown : "";
    if (!headline && !body) continue;
    out.push({ headline, body, breakdown });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid analogy objects." };
  }
  return { ok: true, variations: out };
}

// ---------- Domain randomizer ----------

/** Pick N random domains from the full list (for serendipity mode). */
export function randomDomains(n: number, seed?: number): AnalogyDomain[] {
  const all = Object.keys(DOMAIN_LIBRARY) as AnalogyDomain[];
  const rng = mulberry32(seed ?? Date.now());
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(1, Math.min(n, all.length)));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
