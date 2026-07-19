/**
 * AI Logical Fallacy Detector — pure logic.
 *
 * Detect 23 informal fallacies via a transparent pattern layer:
 *   ad hominem, strawman, slippery slope, false dichotomy,
 *   appeal to authority / emotion / popularity / tradition / fear,
 *   red herring, tu quoque, no true scotsman, hasty generalization,
 *   post hoc, circular reasoning, anecdotal evidence, equivocation,
 *   genetic fallacy, burden of proof, middle ground, sunk cost,
 *   guilt by association, composition, bandwagon.
 *
 * Each detection reports: name, span [start,end), confidence,
 * plain-English explanation, steelman suggestion, and a
 * "false-positive risk" callout so the user can judge each flag.
 *
 * Capabilities:
 *   - Inline highlight segments for the UI.
 *   - Sensitivity slider (strict / balanced / lenient) controls threshold.
 *   - Per-fallacy encyclopedia entry with example.
 *   - Per-category stats, markdown report, history (last 20),
 *     shareable URL, optional BYO-key LLM prompt builder.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: fallacy detection is genuinely hard and context-sensitive.
 * The pattern layer is a reasoning aid, not an arbiter of truth —
 * valid arguments can *look* fallacious out of context.
 */

// ---------- Types ----------

export type FallacyId =
  | "ad-hominem"
  | "strawman"
  | "slippery-slope"
  | "false-dilemma"
  | "appeal-to-authority"
  | "appeal-to-emotion"
  | "appeal-to-popularity"
  | "appeal-to-tradition"
  | "appeal-to-fear"
  | "hasty-generalization"
  | "circular-reasoning"
  | "red-herring"
  | "tu-quoque"
  | "no-true-scotsman"
  | "post-hoc"
  | "composition"
  | "anecdotal"
  | "equivocation"
  | "genetic"
  | "burden-of-proof"
  | "middle-ground"
  | "sunk-cost"
  | "guilt-by-association";

export type FallacyCategory =
  | "relevance"
  | "causal"
  | "presumption"
  | "ambiguity"
  | "emotion";

export type Sensitivity = "strict" | "balanced" | "lenient";

export type LlmProvider = "openai" | "anthropic";

export interface FallacyPattern {
  /** Regex pattern (no global flag — re-applied per match in scan). */
  re: RegExp;
  /** Base confidence 0..1 awarded when this pattern matches. */
  confidence: number;
  /** Short trigger label for explanation. */
  trigger: string;
}

export interface FallacyInfo {
  id: FallacyId;
  name: string;
  category: FallacyCategory;
  description: string;
  example: string;
  why: string;
  /** A one-line explanation template — {snippet} is replaced. */
  explanationTemplate: string;
  /** Generic steelman suggestion for this fallacy. */
  steelmanHint: string;
  /** Patterns to look for. */
  patterns: FallacyPattern[];
}

export interface Detection {
  id: FallacyId;
  name: string;
  category: FallacyCategory;
  startIndex: number;
  endIndex: number;
  snippet: string;
  confidence: number;
  trigger: string;
  explanation: string;
  steelman: string;
  falsePositiveRisk: string;
}

export interface DetectionOptions {
  sensitivity: Sensitivity;
  /** Optional filter — only these fallacy ids will be considered. */
  onlyIds?: FallacyId[];
}

export interface DetectionStats {
  total: number;
  byCategory: Record<FallacyCategory, number>;
  byFallacy: Partial<Record<FallacyId, number>>;
}

export interface DetectionResult {
  detections: Detection[];
  stats: DetectionStats;
  sensitivity: Sensitivity;
}

export interface HighlightSegment {
  text: string;
  detection?: Detection;
}

export interface HistoryEntry {
  ts: number;
  textLength: number;
  sensitivity: Sensitivity;
  totalDetections: number;
  topFallacy: string | null;
}

export interface ShareState {
  text: string;
  sensitivity: Sensitivity;
  onlyIds: FallacyId[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-logical-fallacy-detector:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-logical-fallacy-detector:llm-key";

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  strict: "Strict (high precision)",
  balanced: "Balanced (default)",
  lenient: "Lenient (high recall)",
};

export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, number> = {
  strict: 0.55,
  balanced: 0.45,
  lenient: 0.3,
};

export const CATEGORY_LABELS: Record<FallacyCategory, string> = {
  relevance: "Relevance",
  causal: "Causal",
  presumption: "Presumption",
  ambiguity: "Ambiguity",
  emotion: "Emotion",
};

export const DEFAULT_OPTIONS: DetectionOptions = {
  sensitivity: "balanced",
};

// ---------- Fallacy encyclopedia ----------

export const FALLACIES: FallacyInfo[] = [
  {
    id: "ad-hominem",
    name: "Ad Hominem",
    category: "relevance",
    description:
      "Attacking the person making the argument rather than the argument itself.",
    example: "You can't trust John's tax plan — he's a known liar.",
    why: "Even if the person is flawed, their argument could still be correct. Character attacks don't address the merits.",
    explanationTemplate:
      "Attacks the person ('{snippet}') instead of engaging with their argument. A claim's truth doesn't depend on who says it.",
    steelmanHint:
      "Restate the argument's content and address that — or cite a specific reason the source is unreliable on this topic.",
    patterns: [
      { re: /\b(you'?re|they'?re|he'?s|she'?s|you are|they are)\s+(an?\s+)?(idiot|fool|moron|stupid|ignorant|liar|hypocrite|racist|fascist|communist|nazi)\b/gi, confidence: 0.85, trigger: "name-calling" },
      { re: /\b(you'?re|they'?re)\s+just\s+(an?\s+)?\w+/gi, confidence: 0.6, trigger: "dismissal by identity" },
      { re: /\btypical\s+\w+ist\b/gi, confidence: 0.65, trigger: "stereotype dismissal" },
      { re: /\b(of course you'?d say that|what else would you expect from)\b/gi, confidence: 0.7, trigger: "motive dismissal" },
    ],
  },
  {
    id: "strawman",
    name: "Strawman",
    category: "relevance",
    description:
      "Misrepresenting an opponent's argument to make it easier to attack.",
    example: "So you're saying we should just let criminals run free?",
    why: "Refuting a distorted version of the argument doesn't refute the real one.",
    explanationTemplate:
      "Refashions the opponent's view into a weaker form ('{snippet}') that's easier to knock down. Engage with what they actually said.",
    steelmanHint:
      "Quote the opponent's actual claim and respond to that — avoid 'so you're saying' paraphrases that change the meaning.",
    patterns: [
      { re: /\bso you'?re saying\b/gi, confidence: 0.7, trigger: "'so you're saying'" },
      { re: /\byou (just )?want\b/gi, confidence: 0.6, trigger: "'you want' paraphrase" },
      { re: /\bwhat you'?re really saying is\b/gi, confidence: 0.75, trigger: "'what you're really saying'" },
      { re: /\bso your argument is basically\b/gi, confidence: 0.7, trigger: "'so your argument is basically'" },
      { re: /\bin other words,? you think\b/gi, confidence: 0.6, trigger: "'in other words, you think'" },
    ],
  },
  {
    id: "slippery-slope",
    name: "Slippery Slope",
    category: "causal",
    description:
      "Asserting that one small step will inevitably lead to a chain of extreme consequences.",
    example: "If we allow this, next thing you know they'll ban everything.",
    why: "Each step in the chain needs its own justification; the slope isn't automatically slippery.",
    explanationTemplate:
      "Predicts an extreme chain reaction ('{snippet}') without showing each step is necessary or likely.",
    steelmanHint:
      "Show the specific causal mechanism at each step, or argue for the most likely outcome rather than the worst one.",
    patterns: [
      { re: /\bnext thing you know\b/gi, confidence: 0.75, trigger: "'next thing you know'" },
      { re: /\bit'?ll (only )?lead to\b/gi, confidence: 0.65, trigger: "'it'll lead to'" },
      { re: /\b(where does it end|where will it end)\b/gi, confidence: 0.7, trigger: "'where does it end'" },
      { re: /\bfirst they\b.{0,40}\bthen they'?ll\b/gi, confidence: 0.8, trigger: "'first they… then they'll'" },
      { re: /\bonce (we|they|you) (allow|start|let)\b/gi, confidence: 0.55, trigger: "'once we allow'" },
    ],
  },
  {
    id: "false-dilemma",
    name: "False Dilemma (False Dichotomy)",
    category: "presumption",
    description:
      "Presenting only two options when more exist; forcing a black-or-white choice.",
    example: "You're either with us or against us.",
    why: "Real situations often have more than two options or a continuum between them.",
    explanationTemplate:
      "Forces an either/or ('{snippet}') when middle options or additional alternatives exist.",
    steelmanHint:
      "Acknowledge at least one intermediate or third option and explain why the binary still captures the choice.",
    patterns: [
      { re: /\b(you'?re|they'?re) (either )?with us or (against us|the enemy)\b/gi, confidence: 0.85, trigger: "'with us or against us'" },
      { re: /\bit'?s (either|all) .{1,30}\bor\b/gi, confidence: 0.65, trigger: "'it's either… or'" },
      { re: /\bus or them\b/gi, confidence: 0.75, trigger: "'us or them'" },
      { re: /\bonly two (options|choices)\b/gi, confidence: 0.7, trigger: "'only two options'" },
      { re: /\bblack or white\b/gi, confidence: 0.65, trigger: "'black or white'" },
    ],
  },
  {
    id: "appeal-to-authority",
    name: "Appeal to Authority",
    category: "relevance",
    description:
      "Citing an authority as proof, especially outside their domain or without supporting evidence.",
    example: "Einstein believed in God, so God must exist.",
    why: "Authority alone isn't evidence; experts can be wrong, especially outside their field.",
    explanationTemplate:
      "Treats a name or credential ('{snippet}') as proof. Authority is a hint, not a substitute for evidence.",
    steelmanHint:
      "Cite the specific study, dataset, or argument the authority relies on — or note their relevant expertise explicitly.",
    patterns: [
      { re: /\baccording to (dr\.?|professor|einstein|hawking|newton|darwin|musk|jobs)\b/gi, confidence: 0.55, trigger: "named authority" },
      { re: /\b(experts say|scientists agree|studies show)\b/gi, confidence: 0.6, trigger: "vague authority" },
      { re: /\bas (dr\.?|professor|einstein|hawking|newton) said\b/gi, confidence: 0.6, trigger: "'as [authority] said'" },
      { re: /\btrust (me|the experts),?\s+(it'?s|they'?re)\b/gi, confidence: 0.55, trigger: "trust-me authority" },
    ],
  },
  {
    id: "appeal-to-emotion",
    name: "Appeal to Emotion",
    category: "emotion",
    description:
      "Manipulating emotions (pity, anger, hope) instead of presenting a logical case.",
    example: "Think of the children! How can you be so heartless?",
    why: "Strong feelings don't make a claim true or false.",
    explanationTemplate:
      "Leans on emotion ('{snippet}') to sway judgment rather than giving reasons. Feeling ≠ evidence.",
    steelmanHint:
      "State the emotional stake plainly, then provide a concrete reason, cost, or evidence for the conclusion.",
    patterns: [
      { re: /\bthink of the children\b/gi, confidence: 0.75, trigger: "'think of the children'" },
      { re: /\bimagine if it was your\b/gi, confidence: 0.7, trigger: "'imagine if it was your'" },
      { re: /\bhow can you be so (heartless|cruel|cold)\b/gi, confidence: 0.7, trigger: "moral-emotional charge" },
      { re: /\b(don'?t you care|do you not care)\b/gi, confidence: 0.6, trigger: "guilt appeal" },
    ],
  },
  {
    id: "appeal-to-popularity",
    name: "Appeal to Popularity (Bandwagon)",
    category: "relevance",
    description:
      "Claiming something is true or good because many people believe or do it.",
    example: "Millions of people use this product — it must be good.",
    why: "Popularity is independent of truth; the majority has been wrong many times.",
    explanationTemplate:
      "Argues that popularity ('{snippet}') proves the point. Crowds can be wrong.",
    steelmanHint:
      "Provide independent evidence for the claim; treat popularity as weak corroboration, not proof.",
    patterns: [
      { re: /\beveryone knows\b/gi, confidence: 0.7, trigger: "'everyone knows'" },
      { re: /\b(most|the majority of|all) people (agree|believe|think)\b/gi, confidence: 0.65, trigger: "'most people agree'" },
      { re: /\beverybody'?s doing it\b/gi, confidence: 0.75, trigger: "'everybody's doing it'" },
      { re: /\bmillions of (people|users|customers)\b/gi, confidence: 0.55, trigger: "'millions of'" },
      { re: /\b(it must be true|it must be good) because\b.{0,40}\b(many|most|everyone|everybody)\b/gi, confidence: 0.75, trigger: "popularity = truth" },
    ],
  },
  {
    id: "appeal-to-tradition",
    name: "Appeal to Tradition",
    category: "relevance",
    description:
      "Claiming something is right or better simply because it's old or traditional.",
    example: "We've always done it this way, so we shouldn't change.",
    why: "Age alone doesn't make a practice correct; traditions can outlive their usefulness.",
    explanationTemplate:
      "Defends the claim by its age or tradition ('{snippet}'). Longstanding ≠ correct.",
    steelmanHint:
      "Show why the tradition still serves its purpose today, or what would be lost by changing it.",
    patterns: [
      { re: /\bwe'?ve always done it (this way|like this)\b/gi, confidence: 0.8, trigger: "'we've always done it this way'" },
      { re: /\bfor (centuries|generations|thousands of years)\b/gi, confidence: 0.55, trigger: "'for centuries'" },
      { re: /\bit'?s traditional\b/gi, confidence: 0.6, trigger: "'it's traditional'" },
      { re: /\bour ancestors (did|believed)\b/gi, confidence: 0.55, trigger: "'our ancestors'" },
      { re: /\bif it ain'?t broke,? don'?t fix it\b/gi, confidence: 0.7, trigger: "'if it ain't broke'" },
    ],
  },
  {
    id: "appeal-to-fear",
    name: "Appeal to Fear (Scaremongering)",
    category: "emotion",
    description:
      "Exaggerating danger to coerce agreement rather than providing reasons.",
    example: "If we don't act now, catastrophe is certain!",
    why: "Fear-painting isn't an argument; the actual risk needs to be quantified.",
    explanationTemplate:
      "Uses fear of catastrophe ('{snippet}') to push a conclusion without showing the risk is real or likely.",
    steelmanHint:
      "Quantify the probability and severity of the feared outcome; show the causal link to the proposed action.",
    patterns: [
      { re: /\b(be very afraid|we should be terrified|we should be afraid)\b/gi, confidence: 0.7, trigger: "fear appeal" },
      { re: /\b(catastrophe|disaster|doom|apocalypse) is (certain|imminent|coming|guaranteed)\b/gi, confidence: 0.75, trigger: "impending catastrophe" },
      { re: /\bif we don'?t act now\b/gi, confidence: 0.55, trigger: "'if we don't act now'" },
      { re: /\b(the sky is falling|end of (the world|civilization))\b/gi, confidence: 0.7, trigger: "apocalyptic language" },
    ],
  },
  {
    id: "hasty-generalization",
    name: "Hasty Generalization",
    category: "presumption",
    description:
      "Drawing a broad conclusion from a small or unrepresentative sample.",
    example: "I met two rude people from there — everyone there is rude.",
    why: "A small sample can mislead; the broader the claim, the broader the evidence needed.",
    explanationTemplate:
      "Generalizes from a tiny sample ('{snippet}'). Anecdotes can't carry a universal claim.",
    steelmanHint:
      "Either widen the evidence base or soften the claim to what your sample actually supports.",
    patterns: [
      { re: /\ball \w+s are\b/gi, confidence: 0.55, trigger: "'all Xs are'" },
      { re: /\bevery single (one|person|time)\b/gi, confidence: 0.6, trigger: "'every single'" },
      { re: /\bI (met|saw|knew) (one|two|a few)\b.{0,40}\band they\b/gi, confidence: 0.7, trigger: "'I met one… and they'" },
      { re: /\bfrom my (own )?experience,?\s+(all|every|most)\b/gi, confidence: 0.65, trigger: "experience-based universal" },
    ],
  },
  {
    id: "circular-reasoning",
    name: "Circular Reasoning (Begging the Question)",
    category: "presumption",
    description:
      "Using the conclusion as a premise; assuming what you're trying to prove.",
    example: "It's true because I said so, and I said so because it's true.",
    why: "Restating the conclusion doesn't give a separate reason to believe it.",
    explanationTemplate:
      "Assumes its own conclusion ('{snippet}'). The premise and the conclusion are the same claim in disguise.",
    steelmanHint:
      "Identify a premise that is independently plausible and that supports the conclusion without restating it.",
    patterns: [
      { re: /\bit'?s true because I said so\b/gi, confidence: 0.75, trigger: "'because I said so'" },
      { re: /\bbecause (it'?s|that'?s) (just )?the way it is\b/gi, confidence: 0.6, trigger: "'because that's the way it is'" },
      { re: /\b(it is|that is) what it is\b/gi, confidence: 0.4, trigger: "'it is what it is'" },
      { re: /\bthe bible is true because the bible says so\b/gi, confidence: 0.85, trigger: "self-reference" },
    ],
  },
  {
    id: "red-herring",
    name: "Red Herring",
    category: "relevance",
    description:
      "Distracting from the original issue by introducing an unrelated topic.",
    example: "Sure, taxes are high — but have you seen the crime rate lately?",
    why: "Changing the subject doesn't address the original argument.",
    explanationTemplate:
      "Shifts to an unrelated topic ('{snippet}') rather than addressing the original issue.",
    steelmanHint:
      "Either address the original point first, or explicitly flag that you're changing topics and explain why.",
    patterns: [
      { re: /\bbut what about\b/gi, confidence: 0.6, trigger: "'but what about'" },
      { re: /\bthat'?s not the real issue\b/gi, confidence: 0.65, trigger: "'that's not the real issue'" },
      { re: /\bspeaking of which,?\b/gi, confidence: 0.4, trigger: "'speaking of which'" },
      { re: /\b(let'?s talk about|let me tell you about) (something else|the real)\b/gi, confidence: 0.55, trigger: "topic shift" },
    ],
  },
  {
    id: "tu-quoque",
    name: "Tu Quoque (Whataboutism)",
    category: "relevance",
    description:
      "Deflecting criticism by accusing the accuser of the same thing.",
    example: "You say I'm lazy — but you're lazy too!",
    why: "Hypocrisy in the accuser doesn't make the original criticism false.",
    explanationTemplate:
      "Deflects with 'you too' ('{snippet}') instead of addressing the charge. Hypocrisy ≠ falsity.",
    steelmanHint:
      "Address the original criticism directly; if the accuser is hypocritical, note it as a separate observation.",
    patterns: [
      { re: /\bbut you (also|do it too|did the same)\b/gi, confidence: 0.7, trigger: "'but you also'" },
      { re: /\bwhat about when you\b/gi, confidence: 0.7, trigger: "'what about when you'" },
      { re: /\byou'?re one to talk\b/gi, confidence: 0.75, trigger: "'you're one to talk'" },
      { re: /\b(you|they) do (the same|it too|exactly that)\b/gi, confidence: 0.55, trigger: "you-too" },
    ],
  },
  {
    id: "no-true-scotsman",
    name: "No True Scotsman",
    category: "presumption",
    description:
      "Redefining a category to exclude inconvenient counter-examples.",
    example: "No true fan would dislike this album — anyone who does wasn't a real fan.",
    why: "Ad hoc redefinition protects the claim from any disproof, making it empty.",
    explanationTemplate:
      "Redefines the group to exclude counter-examples ('{snippet}'). The definition is moved to fit the conclusion.",
    steelmanHint:
      "State the definition of the group upfront and test the claim against it — accept counter-examples as evidence against the claim.",
    patterns: [
      { re: /\bno true \w+\b/gi, confidence: 0.85, trigger: "'no true X'" },
      { re: /\b(real|true) \w+s (don'?t|wouldn'?t|never)\b/gi, confidence: 0.7, trigger: "'real Xs don't'" },
      { re: /\bif they were really\b/gi, confidence: 0.55, trigger: "'if they were really'" },
    ],
  },
  {
    id: "post-hoc",
    name: "Post Hoc (False Cause)",
    category: "causal",
    description:
      "Assuming that because B came after A, A caused B.",
    example: "I wore my lucky socks and we won — the socks caused it.",
    why: "Correlation and sequence aren't causation; confounders are everywhere.",
    explanationTemplate:
      "Infers causation from sequence ('{snippet}'). 'After' ≠ 'because of'.",
    steelmanHint:
      "Show the mechanism, control for confounders, or cite repeated controlled observations.",
    patterns: [
      { re: /\bever since .{1,40}\b(then|it caused)\b/gi, confidence: 0.55, trigger: "'ever since'" },
      { re: /\bafter .{1,40}\bso it (must have|obviously) caused\b/gi, confidence: 0.7, trigger: "'after… so it caused'" },
      { re: /\bI wore\b.{0,40}\b(and then|and we)\b.{0,40}\b(won|passed|succeeded)\b/gi, confidence: 0.6, trigger: "lucky-charm causation" },
      { re: /\bcorrelation (means|proves|implies) causation\b/gi, confidence: 0.85, trigger: "correlation = causation" },
    ],
  },
  {
    id: "composition",
    name: "Composition / Division",
    category: "ambiguity",
    description:
      "Assuming what's true of the parts must be true of the whole (or vice versa).",
    example: "Each player is great, so the team will be great.",
    why: "Parts and wholes can have different properties — interactions matter.",
    explanationTemplate:
      "Projects a property from parts to whole ('{snippet}') without showing the property survives aggregation.",
    steelmanHint:
      "Show that the part-level property actually composes (or decomposes) at the whole level, or cite whole-level evidence.",
    patterns: [
      { re: /\b(each|every) (player|member|part) is\b.{0,40}\bso the (team|group|whole)\b/gi, confidence: 0.75, trigger: "part-to-whole" },
      { re: /\bif one can,?\s+all can\b/gi, confidence: 0.7, trigger: "'if one can, all can'" },
      { re: /\bthe (team|group|company) is just the sum of\b/gi, confidence: 0.5, trigger: "sum-of-parts" },
    ],
  },
  {
    id: "anecdotal",
    name: "Anecdotal Evidence",
    category: "presumption",
    description:
      "Using a personal story in place of systematic evidence.",
    example: "My uncle smoked till 90 — so smoking can't be that bad.",
    why: "A single anecdote can be an outlier; statistical patterns need statistical evidence.",
    explanationTemplate:
      "Substitutes a personal story ('{snippet}') for systematic evidence. Anecdotes are not data.",
    steelmanHint:
      "Pair the anecdote with statistics or a representative sample; treat the story as illustration, not proof.",
    patterns: [
      { re: /\bmy (uncle|friend|mom|dad|grandma|grandpa|cousin) (smoked|drank|ate|tried)\b.{0,60}\bso\b/gi, confidence: 0.75, trigger: "uncle anecdote" },
      { re: /\bI once\b.{0,40}\band (now|therefore)\b/gi, confidence: 0.55, trigger: "'I once'" },
      { re: /\bin my (own )?experience\b/gi, confidence: 0.4, trigger: "'in my experience'" },
      { re: /\bthis one time,?\b/gi, confidence: 0.35, trigger: "'this one time'" },
    ],
  },
  {
    id: "equivocation",
    name: "Equivocation",
    category: "ambiguity",
    description:
      "Using a word with two different meanings in the same argument.",
    example: "The sign said 'fine for parking here,' so I thought it was fine to park.",
    why: "Switching meanings mid-argument breaks the logical connection.",
    explanationTemplate:
      "Plays on a word's double meaning ('{snippet}'). The argument only seems valid because the meaning shifted.",
    steelmanHint:
      "Pin down a single definition of each key term up front and use it consistently.",
    patterns: [
      { re: /\b(banks|leaves|right|bark|fall|match) (of|are|is)\b.{0,60}\b(so|therefore|thus)\b/gi, confidence: 0.4, trigger: "ambiguous-keyword hint" },
      { re: /\bthe sign said\b/gi, confidence: 0.3, trigger: "sign-joke hint" },
    ],
  },
  {
    id: "genetic",
    name: "Genetic Fallacy",
    category: "relevance",
    description:
      "Judging an argument solely by its origin rather than its content.",
    example: "That idea came from a politician, so it must be wrong.",
    why: "Where a claim comes from doesn't determine whether it's true.",
    explanationTemplate:
      "Dismisses the claim based on its origin ('{snippet}'). Origin is not evidence.",
    steelmanHint:
      "Address the claim's content directly; if the source is biased, show what specifically is wrong.",
    patterns: [
      { re: /\bthey would (say|think) that\b/gi, confidence: 0.65, trigger: "'they would say that'" },
      { re: /\b(comes from|originated from) (a|the) (bad|terrible|corrupt)\b/gi, confidence: 0.6, trigger: "guilty-source" },
      { re: /\bdon'?t listen to (them|him|her),?\s+(they'?re|he'?s|she'?s)\b/gi, confidence: 0.5, trigger: "source dismissal" },
    ],
  },
  {
    id: "burden-of-proof",
    name: "Burden of Proof Reversal",
    category: "presumption",
    description:
      "Shifting the obligation to prove a claim onto the side that doubts it.",
    example: "You can't disprove ghosts, so they must exist.",
    why: "The one making the positive claim normally bears the burden of proof.",
    explanationTemplate:
      "Asks the doubter to disprove the claim ('{snippet}'). The proponent should provide evidence.",
    steelmanHint:
      "Provide positive evidence for your claim; treat the absence of disproof as weak, not as proof.",
    patterns: [
      { re: /\bprove me wrong\b/gi, confidence: 0.7, trigger: "'prove me wrong'" },
      { re: /\byou can'?t disprove\b/gi, confidence: 0.75, trigger: "'you can't disprove'" },
      { re: /\b(until you prove|until you can show) (me )?otherwise\b/gi, confidence: 0.65, trigger: "'until you prove otherwise'" },
      { re: /\b(absence of evidence|no one has disproved) (means|proves|so)\b/gi, confidence: 0.7, trigger: "absence-as-proof" },
    ],
  },
  {
    id: "middle-ground",
    name: "Argument to Moderation (Middle Ground)",
    category: "presumption",
    description:
      "Assuming the truth must lie between two extremes.",
    example: "Some say the earth is round, some say flat — so it must be oval.",
    why: "Compromise isn't automatically true; one side can simply be wrong.",
    explanationTemplate:
      "Treats the middle as automatically true ('{snippet}'). Truth isn't a compromise by default.",
    steelmanHint:
      "Show why each extreme is partly wrong and what the middle specifically gets right — don't just split the difference.",
    patterns: [
      { re: /\bthe (truth|answer) is (somewhere )?in the middle\b/gi, confidence: 0.8, trigger: "'truth in the middle'" },
      { re: /\bboth sides are (right|wrong)\b/gi, confidence: 0.55, trigger: "'both sides are right/wrong'" },
      { re: /\blet'?s just split the difference\b/gi, confidence: 0.7, trigger: "'split the difference'" },
    ],
  },
  {
    id: "sunk-cost",
    name: "Sunk Cost Fallacy",
    category: "causal",
    description:
      "Continuing a failing effort because of past investment.",
    example: "We've spent millions on this — we can't stop now.",
    why: "Past costs can't be recovered; only future costs and benefits should guide decisions.",
    explanationTemplate:
      "Defends continuation by past investment ('{snippet}'). Sunk costs shouldn't change future decisions.",
    steelmanHint:
      "Compare only future costs and benefits; if stopping is better going forward, stop.",
    patterns: [
      { re: /\bwe'?ve (invested|spent|poured) so much\b/gi, confidence: 0.8, trigger: "'we've invested so much'" },
      { re: /\bafter all this time\b.{0,40}\b(we can'?t|we shouldn'?t)\b/gi, confidence: 0.7, trigger: "'after all this time'" },
      { re: /\bwe can'?t (just )?(give up|quit|stop) now\b/gi, confidence: 0.65, trigger: "'can't give up now'" },
      { re: /\btoo (far|much) (invested|in) to stop\b/gi, confidence: 0.7, trigger: "'too far in'" },
    ],
  },
  {
    id: "guilt-by-association",
    name: "Guilt by Association",
    category: "relevance",
    description:
      "Discrediting a claim or person by associating them with someone unsavory.",
    example: "Hitler was a vegetarian — so vegetarianism is suspect.",
    why: "An idea's value is independent of who else held it.",
    explanationTemplate:
      "Smears by association ('{snippet}'). Bad people can hold good ideas.",
    steelmanHint:
      "Evaluate the idea on its own merits; if you find the association troubling, show why it actually matters here.",
    patterns: [
      { re: /\b(hitler|nazis|stalin|mussolini) (was|were|also) (a|an)?\b/gi, confidence: 0.8, trigger: "Hitler analogy" },
      { re: /\beven (hitler|the nazis|terrorists) (agreed|believed|did)\b/gi, confidence: 0.75, trigger: "'even Hitler'" },
      { re: /\bassociated with (a|the|known)\b/gi, confidence: 0.4, trigger: "'associated with'" },
    ],
  },
];

// Quick lookup by id.
export const FALLACY_IDS: FallacyId[] = FALLACIES.map((f) => f.id);

export const FALLACY_MAP: Record<FallacyId, FallacyInfo> = FALLACIES.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<FallacyId, FallacyInfo>,
);

// ---------- Sample arguments ----------

export const SAMPLE_ARGUMENTS: { label: string; text: string }[] = [
  {
    label: "Politician ad (mixed fallacies)",
    text:
      "My opponent wants to reform the tax code. So you're saying we should just let criminals run free! " +
      "Everyone knows he can't be trusted — and after all the time we've spent fighting him, we can't give up now. " +
      "If we elect him, next thing you know they'll ban apple pie. You're either with us or against us.",
  },
  {
    label: "Product debate",
    text:
      "Millions of people use this product, so it must be good. My uncle tried it and was fine, so the safety warnings are overblown. " +
      "Besides, no true fan would criticize it — anyone who does wasn't a real fan anyway. " +
      "And you can't disprove that it works, so it must work.",
  },
  {
    label: "Diet debate",
    text:
      "Hitler was a vegetarian, so vegetarianism is suspect. My friend went vegan and felt great, so everyone should. " +
      "We've always eaten meat, so we shouldn't change. Think of the children — if we don't act now, catastrophe is certain!",
  },
];

// ---------- Helpers ----------

/** Normalize newlines and whitespace; preserve case. */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Count words in text (whitespace-separated). */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Get a fallacy info record by id; returns undefined if missing. */
export function getFallacyInfo(id: FallacyId): FallacyInfo | undefined {
  return FALLACY_MAP[id];
}

/** Clamp a confidence value to [0,1]. */
export function clampConfidence(c: number): number {
  if (!Number.isFinite(c)) return 0;
  if (c < 0) return 0;
  if (c > 1) return 1;
  return c;
}

/**
 * Compute a single per-pattern confidence after sensitivity adjustment.
 * Higher sensitivity (lenient) nudges confidence up slightly; lower (strict)
 * nudges it down. The threshold filter still applies.
 */
export function adjustedConfidence(base: number, sensitivity: Sensitivity): number {
  const adj = sensitivity === "lenient" ? 0.05 : sensitivity === "strict" ? -0.05 : 0;
  return clampConfidence(base + adj);
}

/** Build a Detection object from a regex match. */
function buildDetection(
  info: FallacyInfo,
  match: RegExpExecArray,
  sensitivity: Sensitivity,
): Detection {
  const start = match.index;
  const end = start + match[0].length;
  const snippet = match[0];
  const confidence = adjustedConfidence(
    // Find the pattern in info.patterns whose regex source matches the
    // one that produced this match. Fall back to highest base confidence.
    info.patterns.reduce((max, p) => Math.max(max, p.confidence), 0),
    sensitivity,
  );
  const trigger =
    info.patterns.find((p) => {
      try {
        const re = new RegExp(p.re.source, p.re.flags);
        return re.test(snippet);
      } catch {
        return false;
      }
    })?.trigger ?? "keyword";
  const explanation = info.explanationTemplate.replace("{snippet}", snippet);
  return {
    id: info.id,
    name: info.name,
    category: info.category,
    startIndex: start,
    endIndex: end,
    snippet,
    confidence,
    trigger,
    explanation,
    steelman: info.steelmanHint,
    falsePositiveRisk: buildFalsePositiveRisk(info.id),
  };
}

/** Return a short "why this might be a false positive" callout per fallacy. */
export function buildFalsePositiveRisk(id: FallacyId): string {
  switch (id) {
    case "ad-hominem":
      return "Direct quotes that report someone's insult aren't attacks — context matters.";
    case "strawman":
      return "'So you're saying' can be a fair summary in some contexts.";
    case "slippery-slope":
      return "Predictions aren't fallacies if each step is independently justified.";
    case "false-dilemma":
      return "Some choices really are binary — verify the alternatives first.";
    case "appeal-to-authority":
      return "Relevant expert consensus can be legitimate evidence when cited properly.";
    case "appeal-to-emotion":
      return "Emotion alongside reasons isn't fallacious — emotion alone is.";
    case "appeal-to-popularity":
      return "Popularity can be relevant for taste or convention claims, not for truth.";
    case "appeal-to-tradition":
      return "Tradition may carry weight for cultural, not factual, claims.";
    case "appeal-to-fear":
      return "Real, quantified risks aren't fear-mongering.";
    case "hasty-generalization":
      return "Universal language in poetry or metaphor isn't a factual claim.";
    case "circular-reasoning":
      return "Tautologies can be definitional rather than argumentative.";
    case "red-herring":
      return "Related context isn't always a distraction.";
    case "tu-quoque":
      return "Hypocrisy can be relevant to credibility in some contexts.";
    case "no-true-scotsman":
      return "Definitional precision is sometimes legitimate, not ad hoc.";
    case "post-hoc":
      return "Strong temporal+mechanism evidence can support causation.";
    case "composition":
      return "Some properties (mass) compose by definition; others (sharpness) don't.";
    case "anecdotal":
      return "Anecdotes are valid as illustrations, not as proof.";
    case "equivocation":
      return "Wordplay in jokes or poetry isn't an argument.";
    case "genetic":
      return "Source bias is relevant to evidence quality, not to truth.";
    case "burden-of-proof":
      return "Default-presumptive claims (innocence) legitimately shift the burden.";
    case "middle-ground":
      return "Negotiated settlements can be right for political, not factual, reasons.";
    case "sunk-cost":
      return "Continuing can be right if future benefits still exceed future costs.";
    case "guilt-by-association":
      return "Associations can be evidentiary when directly causal.";
    default:
      return "Context can change the reading.";
  }
}

/** Detect fallacies in text. Returns sorted (by startIndex) detections. */
export function detectFallacies(
  text: string,
  options: DetectionOptions = DEFAULT_OPTIONS,
): Detection[] {
  if (!text || !text.trim()) return [];
  const normalized = normalizeText(text);
  const threshold = SENSITIVITY_THRESHOLDS[options.sensitivity];
  const onlyIds = options.onlyIds && options.onlyIds.length > 0 ? new Set(options.onlyIds) : null;
  const detections: Detection[] = [];
  for (const info of FALLACIES) {
    if (onlyIds && !onlyIds.has(info.id)) continue;
    for (const pat of info.patterns) {
      const re = new RegExp(pat.re.source, pat.re.flags.includes("g") ? pat.re.flags : pat.re.flags + "g");
      let m: RegExpExecArray | null;
      let guard = 0;
      while ((m = re.exec(normalized)) !== null) {
        guard++;
        if (guard > 1000) break; // safety against catastrophic regex
        const det = buildDetection(info, m, options.sensitivity);
        if (det.confidence >= threshold) detections.push(det);
        if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-length loops
      }
    }
  }
  // Deduplicate overlapping detections of the same fallacy — keep highest confidence.
  detections.sort((a, b) => a.startIndex - b.startIndex || b.confidence - a.confidence);
  const deduped: Detection[] = [];
  for (const d of detections) {
    const overlap = deduped.find(
      (e) =>
        e.id === d.id &&
        !(d.endIndex <= e.startIndex || d.startIndex >= e.endIndex),
    );
    if (overlap) {
      if (d.confidence > overlap.confidence) {
        const idx = deduped.indexOf(overlap);
        deduped[idx] = d;
      }
      continue;
    }
    deduped.push(d);
  }
  return deduped.sort((a, b) => a.startIndex - b.startIndex);
}

/** Run detection + compute stats. */
export function analyze(text: string, options: DetectionOptions = DEFAULT_OPTIONS): DetectionResult {
  const detections = detectFallacies(text, options);
  return {
    detections,
    stats: computeStats(detections),
    sensitivity: options.sensitivity,
  };
}

/** Compute stats from a list of detections. */
export function computeStats(detections: Detection[]): DetectionStats {
  const byCategory: Record<FallacyCategory, number> = {
    relevance: 0,
    causal: 0,
    presumption: 0,
    ambiguity: 0,
    emotion: 0,
  };
  const byFallacy: Partial<Record<FallacyId, number>> = {};
  for (const d of detections) {
    byCategory[d.category] += 1;
    byFallacy[d.id] = (byFallacy[d.id] ?? 0) + 1;
  }
  return { total: detections.length, byCategory, byFallacy };
}

/**
 * Build inline-highlight segments for the UI: each detection's span becomes
 * its own segment with the Detection attached; text in between is plain.
 */
export function buildHighlightSegments(text: string, detections: Detection[]): HighlightSegment[] {
  if (!text) return [];
  if (detections.length === 0) return [{ text }];
  const sorted = [...detections].sort((a, b) => a.startIndex - b.startIndex);
  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const d of sorted) {
    if (d.startIndex > cursor) out.push({ text: text.slice(cursor, d.startIndex) });
    out.push({ text: text.slice(d.startIndex, d.endIndex), detection: d });
    cursor = d.endIndex;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

/** Render highlights as inline-styled HTML (each detection wrapped in <mark>). */
export function renderHighlightedHtml(text: string, detections: Detection[]): string {
  const segments = buildHighlightSegments(text, detections);
  return segments
    .map((seg) => {
      if (!seg.detection) return escapeHtml(seg.text);
      const d = seg.detection;
      const title = `${d.name} (${(d.confidence * 100).toFixed(0)}%) — ${escapeHtml(d.explanation)}`;
      return `<mark class="unq-fallacy" data-id="${d.id}" title="${title}">${escapeHtml(seg.text)}</mark>`;
    })
    .join("");
}

/** Suggest a steelman rewrite — neutralizes the strongest detected fallacies. */
export function suggestSteelman(text: string, detections: Detection[]): string {
  if (!text) return "";
  if (detections.length === 0) return text;
  const top = [...detections]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const lines = [
    "// Steelman suggestion:",
    "// Strip fallacy cues, keep the core claim, add support.",
    "",
    text.trim(),
    "",
    "// Revisions to consider:",
  ];
  for (const d of top) {
    lines.push(`// - Replace "${d.snippet}" — ${d.steelman}`);
  }
  return lines.join("\n");
}

/** Render a markdown report of the analysis. */
export function renderMarkdownReport(text: string, result: DetectionResult): string {
  const lines: string[] = [];
  lines.push("# Logical Fallacy Report");
  lines.push("");
  lines.push(`- Sensitivity: **${SENSITIVITY_LABELS[result.sensitivity]}**`);
  lines.push(`- Total flags: **${result.stats.total}**`);
  lines.push(`- Words analyzed: **${countWords(text)}**`);
  lines.push("");
  lines.push("## By category");
  lines.push("");
  for (const cat of Object.keys(CATEGORY_LABELS) as FallacyCategory[]) {
    const n = result.stats.byCategory[cat];
    if (n > 0) lines.push(`- ${CATEGORY_LABELS[cat]}: ${n}`);
  }
  if (result.stats.total === 0) lines.push("- (none detected)");
  lines.push("");
  if (result.detections.length > 0) {
    lines.push("## Flags");
    lines.push("");
    for (let i = 0; i < result.detections.length; i++) {
      const d = result.detections[i];
      lines.push(`### ${i + 1}. ${d.name} — confidence ${(d.confidence * 100).toFixed(0)}%`);
      lines.push("");
      lines.push(`> ${d.snippet}`);
      lines.push("");
      lines.push(`- **Category:** ${CATEGORY_LABELS[d.category]}`);
      lines.push(`- **Trigger:** ${d.trigger}`);
      lines.push(`- **Why flagged:** ${d.explanation}`);
      lines.push(`- **Steelman:** ${d.steelman}`);
      lines.push(`- **False-positive risk:** ${d.falsePositiveRisk}`);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  lines.push("_Fallacy detection is context-sensitive and probabilistic. Treat this as a reasoning aid, not an arbiter of truth._");
  return lines.join("\n");
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
  if (state.text) params.set("text", state.text);
  if (state.sensitivity) params.set("s", state.sensitivity);
  if (state.onlyIds.length > 0) params.set("ids", state.onlyIds.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", sensitivity: "balanced", onlyIds: [] };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const s = params.get("s") ?? "balanced";
  const validSensitivities: Sensitivity[] = ["strict", "balanced", "lenient"];
  const sensitivity: Sensitivity = validSensitivities.includes(s as Sensitivity)
    ? (s as Sensitivity)
    : "balanced";
  const idsStr = params.get("ids") ?? "";
  const validIds = new Set<FallacyId>(FALLACY_IDS);
  const onlyIds: FallacyId[] = idsStr
    ? (idsStr.split(",").filter((id) => validIds.has(id as FallacyId)) as FallacyId[])
    : [];
  return { text, sensitivity, onlyIds };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(text: string, sensitivity: Sensitivity): LlmPrompt {
  const system =
    "You are a critical-thinking assistant. Identify informal logical fallacies in the user's argument. " +
    "For each fallacy, output: name, the exact quoted span, a one-sentence explanation of the flaw, and a steelman rewrite suggestion. " +
    "If you're unsure, say so explicitly — do not invent fallacies. Frame the response as a reasoning aid, not an arbiter of truth.";
  const user =
    `Sensitivity: ${sensitivity} (strict = high precision, lenient = high recall).\n\n` +
    `Argument:\n"""\n${text}\n"""\n\n` +
    `Output a JSON object: {"detections":[{"name","quote","explanation","steelman"}],"notes":""}`;
  return { system, user };
}

/** Render an LLM JSON-ish response into a markdown-style report. */
export function renderLlmResult(raw: string): string {
  if (!raw) return "";
  // Try to extract a JSON object from the response.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw.trim();
  const jsonStr = raw.slice(start, end + 1);
  let parsed: { detections?: unknown; notes?: unknown } = {};
  try {
    parsed = JSON.parse(jsonStr) as { detections?: unknown; notes?: unknown };
  } catch {
    return raw.trim();
  }
  const lines: string[] = ["# LLM Analysis", ""];
  if (Array.isArray(parsed.detections)) {
    for (let i = 0; i < parsed.detections.length; i++) {
      const d = parsed.detections[i] as Record<string, unknown>;
      lines.push(`### ${i + 1}. ${String(d.name ?? "Fallacy")}`);
      if (typeof d.quote === "string") lines.push(`> ${d.quote}`);
      if (typeof d.explanation === "string") lines.push(`- ${d.explanation}`);
      if (typeof d.steelman === "string") lines.push(`- Steelman: ${d.steelman}`);
      lines.push("");
    }
  }
  if (typeof parsed.notes === "string") {
    lines.push("## Notes");
    lines.push(parsed.notes);
  }
  return lines.join("\n");
}
