/**
 * AI Business Pitch Deck Outline Generator — pure logic.
 *
 * Generate a structured, investor-ready pitch deck outline — the canonical
 * 10–12 slides (Problem, Solution, Market, Product, Traction, Business
 * Model, GTM, Competition, Team, Financials, Ask) with per-slide talking
 * points, "what investors look for" notes, and common pitfalls.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: this tool builds the *outline and narrative spine* of your
 * deck — it does NOT design slides, write financials, or verify your
 * traction numbers. Traction and financial numbers MUST be real. Design
 * comes after story. Use the output as a starting point to drop into
 * your slide tool of choice (Pitch, Gamma, Google Slides, Keynote,
 * PowerPoint), not as a finished deck.
 */

// ---------- Types ----------

export type Stage = "pre-seed" | "seed" | "series-a" | "sales";
export type SlideId =
  | "title"
  | "problem"
  | "solution"
  | "market"
  | "product"
  | "traction"
  | "business-model"
  | "gtm"
  | "competition"
  | "team"
  | "financials"
  | "pricing"
  | "ask"
  | "why-now"
  | "closing";

export interface PitchInputs {
  companyName: string;
  oneLiner: string; // 1-sentence description
  industry: string;
  stage: Stage;
  targetRaise: string; // e.g. "$1.5M" or "1500000"
  problem: string;
  solution: string;
  audience: string; // target customer
  whyNow: string;
  teamCredibility: string;
  traction: string;
}

export interface SlideOutline {
  id: SlideId;
  title: string;
  purpose: string;
  talkingPoints: string[];
  investorExpectations: string[];
  pitfalls: string[];
  speakerNotes: string;
}

export interface NarrativeCheck {
  ok: boolean;
  checks: Array<{
    name: "problem" | "solution" | "why-now" | "why-you";
    status: "ok" | "weak" | "missing";
    note: string;
  }>;
  summary: string;
}

export interface UseOfFundsItem {
  category: string;
  percentage: number;
  rationale: string;
}

export interface Milestone {
  timeframe: string;
  goal: string;
  metric: string;
}

export interface PitchOutput {
  slides: SlideOutline[];
  narrative: NarrativeCheck;
  useOfFunds: UseOfFundsItem[];
  milestones: Milestone[];
  warnings: string[];
  slideCount: number;
}

export interface HistoryEntry {
  ts: number;
  companyName: string;
  industry: string;
  stage: Stage;
  targetRaise: string;
  slideCount: number;
}

export interface ShareState {
  inputs: Partial<PitchInputs>;
}

export interface LlmEnhancement {
  refinedSlides: Array<{ id: string; title: string; refinedTalkingPoints: string[] }>;
  narrativeSuggestions: string[];
  openQuestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-business-pitch-deck-outline-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-business-pitch-deck-outline-generator:llm-key";

export const STAGE_LABELS: Record<Stage, string> = {
  "pre-seed": "Pre-seed",
  "seed": "Seed",
  "series-a": "Series A",
  "sales": "Sales deck",
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<keyof PitchInputs, { hint: string; sample: string }> = {
  companyName: { hint: "Your startup's name.", sample: "Ledgerloop" },
  oneLiner: { hint: "One sentence: what you do, for whom, why it matters.", sample: "Honest accounting software for indie creators." },
  industry: { hint: "Your industry or vertical (1–3 words).", sample: "fintech" },
  stage: { hint: "Funding stage or deck type. Shapes slide order and depth.", sample: "seed" },
  targetRaise: { hint: "How much you're raising. Use $ + number (e.g. $1.5M).", sample: "$1.5M" },
  problem: { hint: "The problem in 1–3 sentences. Be concrete — name the pain.", sample: "Indie creators spend 6+ hours/month on bookkeeping with tools built for SMBs." },
  solution: { hint: "Your solution in 1–3 sentences. Tie each part back to the problem.", sample: "Auto-categorize Stripe/PayPal income, auto-match receipts, file Schedule C in one click." },
  audience: { hint: "Who specifically has this problem. Role, segment, geography.", sample: "US-based indie creators earning $50k–$500k/yr" },
  whyNow: { hint: "Why this, now. What shift makes this possible or necessary today?", sample: "1099 worker growth + Stripe/PayPal API maturity + IRS e-file modernization." },
  teamCredibility: { hint: "Why YOU. Domain expertise, prior exits, relevant network.", sample: "Founder was CPA at a top-50 firm; CTO built tax engine at TurboTax." },
  traction: { hint: "Concrete traction: users, MRR, growth rate, logos. Be honest.", sample: "1,200 paid users, $18k MRR, 12% MoM growth, 4 case studies." },
};

// ---------- Slide templates per stage ----------

/**
 * Ordered slide list per stage. The canonical sequence is preserved for
 * fundraising decks; the sales deck reorders to lead with customer value
 * and swaps Financials → Pricing/Packages.
 */
export const SLIDE_SEQUENCE: Record<Stage, SlideId[]> = {
  "pre-seed": [
    "title", "problem", "solution", "why-now", "market", "product",
    "traction", "business-model", "team", "ask",
  ],
  "seed": [
    "title", "problem", "solution", "why-now", "market", "product",
    "traction", "business-model", "gtm", "team", "ask",
  ],
  "series-a": [
    "title", "problem", "solution", "why-now", "market", "product",
    "traction", "business-model", "gtm", "competition", "team", "ask",
  ],
  "sales": [
    "title", "problem", "solution", "product", "market", "pricing",
    "traction", "team", "competition", "closing",
  ],
};

/** Human-readable title for each slide id. */
export const SLIDE_TITLES: Record<SlideId, string> = {
  "title": "Title",
  "problem": "Problem",
  "solution": "Solution",
  "market": "Market",
  "product": "Product",
  "traction": "Traction",
  "business-model": "Business model",
  "gtm": "Go-to-market",
  "competition": "Competition",
  "team": "Team",
  "financials": "Financials",
  "pricing": "Pricing & packages",
  "ask": "The ask",
  "why-now": "Why now",
  "closing": "Closing / next steps",
};

// ---------- Validation ----------

/**
 * Validate pitch inputs and return human-readable warnings.
 */
export function validateInputs(inputs: PitchInputs): string[] {
  const warnings: string[] = [];
  const required: Array<[keyof PitchInputs, string]> = [
    ["companyName", "Company name"],
    ["oneLiner", "One-liner"],
    ["industry", "Industry"],
    ["problem", "Problem"],
    ["solution", "Solution"],
    ["audience", "Target audience"],
  ];
  for (const [key, label] of required) {
    if (!inputs[key] || !inputs[key].trim()) {
      warnings.push(`${label} is required to generate a complete outline.`);
    }
  }
  if (inputs.stage !== "sales" && (!inputs.targetRaise || !inputs.targetRaise.trim())) {
    warnings.push("Target raise is missing — the Ask slide and use-of-funds breakdown need a number.");
  }
  if (inputs.stage !== "sales" && (!inputs.whyNow || !inputs.whyNow.trim())) {
    warnings.push("'Why now' is missing — investors explicitly look for the timing shift.");
  }
  if (inputs.stage !== "sales" && (!inputs.teamCredibility || !inputs.teamCredibility.trim())) {
    warnings.push("Team credibility is missing — investors invest in teams, not just ideas.");
  }
  if (inputs.stage !== "sales" && (!inputs.traction || !inputs.traction.trim())) {
    warnings.push("Traction is missing — be honest about current progress (zero is OK if framed correctly).");
  }
  if (inputs.oneLiner && inputs.oneLiner.length > 200) {
    warnings.push("One-liner is over 200 chars — tighten it to one sentence.");
  }
  if (inputs.problem && inputs.problem.length < 20) {
    warnings.push("Problem is very short — name the pain concretely with a number.");
  }
  if (inputs.solution && inputs.solution.length < 20) {
    warnings.push("Solution is very short — describe what you do, not just the category.");
  }
  return warnings;
}

// ---------- Helpers ----------

/** Capitalize the first character. */
export function capitalize(s: string): string {
  return s && s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Lowercase the first character. */
export function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip leading $ and commas, return a number (NaN if invalid). */
export function parseRaise(raw: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[$,\s]/g, "").toLowerCase();
  // Handle suffixes: k, m, b.
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const suffix = m[2];
  if (suffix === "k") return num * 1_000;
  if (suffix === "m") return num * 1_000_000;
  if (suffix === "b") return num * 1_000_000_000;
  return num;
}

/** Format a number as a USD string with $ and K/M suffix. */
export function formatRaise(n: number): string {
  if (!isFinite(n)) return "";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ---------- Slide builders ----------

/**
 * Build a per-slide outline from inputs. Each slide has: title, purpose,
 * 3–5 talking points (some templated from inputs), investor expectations,
 * common pitfalls, and a 30–60 second speaker-notes draft.
 */
export function buildSlide(id: SlideId, inputs: PitchInputs): SlideOutline {
  const company = inputs.companyName || "[Company]";
  const oneLiner = inputs.oneLiner || "[one-liner]";
  const industry = inputs.industry || "[industry]";
  const problem = inputs.problem || "[problem]";
  const solution = inputs.solution || "[solution]";
  const audience = inputs.audience || "[audience]";
  const whyNow = inputs.whyNow || "[why now]";
  const team = inputs.teamCredibility || "[team credibility]";
  const traction = inputs.traction || "[traction]";
  const raise = inputs.targetRaise || "[target raise]";

  switch (id) {
    case "title":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Set the stage in 10 seconds — who you are and what you do.",
        talkingPoints: [
          `${company}: ${oneLiner}`,
          `Stage: ${STAGE_LABELS[inputs.stage]}${raise ? ` · Raising ${raise}` : ""}`,
          "Presenter name + role",
          "Date / context (e.g. 'Q3 2024 investor update')",
        ],
        investorExpectations: [
          "Clear single-sentence positioning in the first 10 seconds.",
          "A name + a logo — investors should instantly know what you sell.",
        ],
        pitfalls: [
          "Multiple taglines or 'we do X and Y and Z' positioning.",
          "Forgetting to say the round size — investors want to know the ask up front.",
        ],
        speakerNotes: `Open with: "${company}: ${oneLiner}." Don't read the slide. Make eye contact, then advance.`,
      };

    case "problem":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Make the pain concrete and quantified. Investors must feel it.",
        talkingPoints: [
          `${audience} struggle with ${lcFirst(problem)}`,
          "Quantify the pain (time, money, risk, opportunity cost)",
          "Show that the status quo is unacceptable — not just inconvenient",
          "Cite a real customer quote or screenshot if possible",
        ],
        investorExpectations: [
          "A hair-on-fire problem that affects a specific, reachable audience.",
          "Quantified pain — a number the investor can remember.",
          "Evidence the problem is widespread, not anecdotal.",
        ],
        pitfalls: [
          "Vague problem statements ('the market is inefficient').",
          "Solutions disguised as problems ('there is no good tool for X').",
          "Skipping the audience — investors must know WHO hurts.",
        ],
        speakerNotes: `Name the audience first ("${audience}"), then the pain. End with the number. Don't pitch the solution yet — let the pain land.`,
      };

    case "solution":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Show how you solve the problem. Each feature should map to a pain point.",
        talkingPoints: [
          `${company} ${lcFirst(solution)}`,
          "Map each solution element back to a specific pain point from the previous slide",
          "Show a screenshot or 5-second demo if possible",
          "Name what's NOT included (focus signal)",
        ],
        investorExpectations: [
          "A clear, simple articulation of what the product does.",
          "Mapping between problem and solution — no orphan features.",
          "A sense of how it works without going too deep technically.",
        ],
        pitfalls: [
          "Listing every feature — investors don't care yet.",
          "Diving into architecture before establishing value.",
          "Solving a different problem than the one on the previous slide.",
        ],
        speakerNotes: `Tie each line of the solution back to the problem. "You said X hurts. Here's how we fix it." Use a screenshot, not a list of bullets.`,
      };

    case "why-now":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Explain the timing — what shifted that makes this possible or necessary today?",
        talkingPoints: [
          whyNow,
          "Name 1–3 specific shifts: regulatory, technological, behavioral, distribution",
          "Show the inflection point on a chart if you have one",
          "Explain why this didn't work 3 years ago and won't be defensible in 3 years",
        ],
        investorExpectations: [
          "An explicit answer to 'why now, not 5 years ago or 5 years from now?'",
          "A real shift (regulatory, technological, behavioral), not a vibe.",
          "Window of opportunity — first-mover advantage or category creation.",
        ],
        pitfalls: [
          "Generic trends ('AI is big') — every investor has seen them.",
          "No timing argument at all — investors will assume bad timing.",
          "Conflating 'why us' with 'why now'.",
        ],
        speakerNotes: `"Why now" is the slide investors silently ask about on every other slide. Answer it directly here. Name the specific shift in one sentence: "${whyNow}"`,
      };

    case "market":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Quantify the market opportunity with credible, bottom-up numbers.",
        talkingPoints: [
          `TAM for ${industry}: [TAM in $, with source]`,
          "SAM (your serviceable segment): [SAM, bottom-up]",
          "SOM (your beachhead in 3 years): [SOM, with assumptions]",
          "Show bottom-up math: # customers × ACV",
        ],
        investorExpectations: [
          "Bottom-up sizing, not 'if we capture 1% of a $100B market'.",
          "Credible sources (analyst reports, government data, primary research).",
          "A beachhead — the wedge segment you win first.",
        ],
        pitfalls: [
          "Top-down '1% of a huge market' — instant credibility killer.",
          "Inflated TAMs (counting adjacent markets you won't enter).",
          "No segmentation — 'the global fintech market' is not a market.",
        ],
        speakerNotes: `Lead with the bottom-up math. "X potential customers × $Y ACV = $Z SAM." Cite a source. Don't say 'if we capture 1%'.`,
      };

    case "product":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Show the product in action. A picture is worth a thousand bullets.",
        talkingPoints: [
          "Show a real screenshot or 15-second demo",
          "Highlight the 1–2 features that create the most value",
          "Mention the tech stack only if it's a moat (e.g. proprietary model)",
          "Show the user flow in 3–4 steps",
        ],
        investorExpectations: [
          "A real, working product — not a Figma mockup (unless pre-seed).",
          "Focus on the user, not the tech.",
          "Proof of usability — clearly usable by the target audience.",
        ],
        pitfalls: [
          "Architecture diagrams investors can't parse.",
          "Listing every feature again — pick the 1–2 that matter.",
          "Hiding the product because it's 'not ready'.",
        ],
        speakerNotes: `Show, don't tell. Demonstrate the aha moment in under 30 seconds. Then move on — don't get stuck here.`,
      };

    case "traction":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Prove people want this. Use real numbers and growth rate.",
        talkingPoints: [
          traction,
          "MRR / ARR (if applicable) + MoM growth rate",
          "Logos / case studies (3–5 recognizable names if possible)",
          "Engagement metrics (retention, NPS, usage) that predict retention",
          "Path to next milestone (e.g. 'from $18k to $100k MRR in 12 months')",
        ],
        investorExpectations: [
          "Honest, real numbers — not vanity metrics.",
          "Growth rate + trajectory, not just point-in-time.",
          "Retention metrics — investors care about users who stay.",
          "For pre-seed: design partners, LOIs, or waitlist signals.",
        ],
        pitfalls: [
          "Vanity metrics (downloads, signups) without retention.",
          "Cherry-picked time windows.",
          "Hiding bad numbers — investors will find them in due diligence.",
        ],
        speakerNotes: `Be honest. State the number, the growth rate, and the timeframe. "We're at $18k MRR, growing 12% MoM, 87% net revenue retention." Don't over-explain.`,
      };

    case "business-model":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Explain how you make money. Unit economics matter more than top-line.",
        talkingPoints: [
          `Pricing model for ${industry} (subscription, transaction, usage, hybrid)`,
          "ACV (annual contract value) and price points per tier",
          "Unit economics: CAC, LTV, payback period",
          "Gross margin (or expected margin at scale)",
        ],
        investorExpectations: [
          "Clear pricing model with rationale.",
          "Unit economics that work (LTV:CAC > 3, payback < 18 months for SaaS).",
          "Margin profile that matches the category.",
        ],
        pitfalls: [
          "Hand-waving unit economics ('we'll figure out pricing later').",
          "Pricing that doesn't match customer willingness to pay.",
          "Ignoring gross margin — services-heavy models get discounted.",
        ],
        speakerNotes: `State the model in one sentence, then unit economics in three numbers: CAC, LTV, payback. If you don't know them, say so — but commit to a date to know them.`,
      };

    case "gtm":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Show how you reach customers repeatably. Not a list of channels — a system.",
        talkingPoints: [
          "Primary acquisition channel (the one that already works)",
          "Secondary channels (in order of priority)",
          "Sales motion: PLG, inside sales, enterprise, or hybrid",
          "CAC by channel + how it scales",
          "Channel-market fit evidence (early wins per channel)",
        ],
        investorExpectations: [
          "One channel that's already working, not five you'll 'explore'.",
          "Honest CAC numbers — not aspirational.",
          "A repeatable system, not one-off wins.",
        ],
        pitfalls: [
          "Listing every possible channel.",
          "Assuming paid acquisition scales linearly.",
          "No CAC — investors will assume it's bad.",
        ],
        speakerNotes: `Name the ONE channel that works. Then the next two you're testing. Be specific about CAC and conversion. "Inbound SEO at $400 CAC, 8% trial-to-paid."`,
      };

    case "competition":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Acknowledge the landscape honestly. Position yourself clearly.",
        talkingPoints: [
          `Direct competitors in ${industry} (name 3–5)`,
          "Adjacent / incumbents who could enter",
          "2x2 matrix or feature comparison — pick axes that favor you",
          "Your durable differentiation (one sentence)",
        ],
        investorExpectations: [
          "Honest landscape — pretending no competitors is a red flag.",
          "A clear 2x2 or comparison chart that highlights your wedge.",
          "A defensible moat (network, data, brand, switching cost).",
        ],
        pitfalls: [
          "Pretending you have no competitors.",
          "A 2x2 where you're the only one in your quadrant (too convenient).",
          "Differentiation that's a feature, not a moat.",
        ],
        speakerNotes: `Acknowledge competitors by name. Then explain why you win in one sentence. Don't badmouth them — investors know founders. Be specific about the moat.`,
      };

    case "team":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Show why YOU are uniquely qualified to win this market.",
        talkingPoints: [
          team,
          "Founders' relevant domain experience (company, role, years)",
          "Prior exits, patents, or category-defining work",
          "Key hires you've made or need to make next",
          "Advisors / board members with relevant credibility",
        ],
        investorExpectations: [
          "Founders with unfair advantage (domain, network, prior wins).",
          "A team that's been together long enough to have shipped.",
          "Honesty about gaps — and a plan to fill them.",
        ],
        pitfalls: [
          "Listing every job you've ever had.",
          "Pretending you have no hiring gaps.",
          "Logo soup of advisors who aren't really involved.",
        ],
        speakerNotes: `Lead with the unfair advantage. "We're the only team that's built X for Y industry." Then briefly: who's on the team, what we've shipped. Acknowledge the gap and the hire we need.`,
      };

    case "financials":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Show 3-year projections with credible assumptions. Numbers must be real or clearly labeled as projections.",
        talkingPoints: [
          "3-year P&L projection (revenue, COGS, gross margin, OpEx, EBITDA)",
          "Key assumptions: growth rate, ACV, churn, headcount",
          "Path to default-alive (when does runway + revenue cover burn)",
          "Sensitivity analysis: what if growth is 50% of plan?",
        ],
        investorExpectations: [
          "Projections tied to bottoms-up assumptions, not top-down.",
          "Honest burn rate + runway math.",
          "Sensitivity — investors stress-test your model.",
        ],
        pitfalls: [
          "Hockey-stick projections with no assumptions.",
          "Hiding the burn rate or runway.",
          "Conflating bookings with revenue.",
        ],
        speakerNotes: `Show the chart. Walk through 3 assumptions: growth rate, ACV, churn. Then state when you hit default-alive. Don't read numbers — point to the inflection.`,
      };

    case "pricing":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Make pricing transparent. Investors and customers both hate hidden pricing.",
        talkingPoints: [
          "Tiered pricing (Free / Pro / Enterprise) with clear feature gates",
          "Price per seat / per usage / flat — and why",
          "Annual discount + contract terms",
          "Comparison to alternatives (price + value)",
        ],
        investorExpectations: [
          "Simple, transparent pricing a buyer can evaluate in 60 seconds.",
          "Pricing that aligns with value delivered, not with cost-plus.",
          "Expansion path (land-and-expand or usage-based upside).",
        ],
        pitfalls: [
          "Custom-only pricing — buyers walk away.",
          "Pricing that doesn't match willingness to pay (too high or too low).",
          "No expansion path — capped upside per account.",
        ],
        speakerNotes: `Show the three tiers. State the most popular one. Compare to the obvious alternative on price + value. Move on.`,
      };

    case "ask":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "Make the ask explicit. Round size, use of funds, milestones, timeline.",
        talkingPoints: [
          `Raising ${raise} (${STAGE_LABELS[inputs.stage]})`,
          "Use of funds breakdown (3–4 categories with %)",
          "Milestones this round funds (the next 18–24 months)",
          "Runway this provides + target next round",
          "Timeline: closing target + lead investor status",
        ],
        investorExpectations: [
          "A specific dollar amount and round structure.",
          "Use of funds tied to milestones, not vibes.",
          "Runway that gets you to a credible next round.",
        ],
        pitfalls: [
          "Vague ask ('raising a round').",
          "Use of funds that's all salary — investors want growth investment.",
          "No next-round math — investors price the next round in their head.",
        ],
        speakerNotes: `State the number first. Then what it buys. Then the milestone. Then the timeline. Close with: "We're looking for a lead — happy to walk through the model."`,
      };

    case "closing":
      return {
        id,
        title: SLIDE_TITLES[id],
        purpose: "End with a clear next step. Make it easy to say yes.",
        talkingPoints: [
          "Recap the one-sentence pitch",
          "State the ask in one line",
          "Next step: a follow-up meeting? A demo? A data-room send?",
          "Contact info + calendar link",
        ],
        investorExpectations: [
          "A clear, low-friction next step.",
          "Contact info that's easy to copy.",
          "A recap investors can reference in their partnership meeting.",
        ],
        pitfalls: [
          "Ending on a Q&A slide with no contact info.",
          "No clear next step — investors won't chase you.",
          "Recap that doesn't match the opening pitch.",
        ],
        speakerNotes: `Don't fade out. Recap the pitch in one sentence, state the ask in one line, propose a specific next step ("15-minute deep dive on the model?"), then stop talking.`,
      };

    default:
      return {
        id,
        title: SLIDE_TITLES[id] ?? id,
        purpose: "",
        talkingPoints: [],
        investorExpectations: [],
        pitfalls: [],
        speakerNotes: "",
      };
  }
}

// ---------- Narrative arc check ----------

/**
 * Check the narrative arc across four canonical investor questions:
 * problem → solution → why-now → why-you. Returns ok/weak/missing per check.
 */
export function checkNarrativeArc(inputs: PitchInputs): NarrativeCheck {
  const checks: NarrativeCheck["checks"] = [];
  // Problem: concrete + quantified?
  const hasProblem = inputs.problem && inputs.problem.trim().length >= 20;
  const problemQuantified = hasProblem && /\d/.test(inputs.problem);
  checks.push({
    name: "problem",
    status: !hasProblem ? "missing" : problemQuantified ? "ok" : "weak",
    note: problemQuantified
      ? "Problem is concrete and quantified."
      : hasProblem
        ? "Problem is stated but lacks a number — quantify the pain."
        : "Problem is missing — investors must feel the pain first.",
  });
  // Solution: present + maps to problem?
  const hasSolution = inputs.solution && inputs.solution.trim().length >= 20;
  checks.push({
    name: "solution",
    status: !hasSolution ? "missing" : "ok",
    note: hasSolution
      ? "Solution is articulated. Make sure each element maps to a specific pain point on the previous slide."
      : "Solution is missing — name what you do, not just the category.",
  });
  // Why now: present + names a shift?
  const hasWhyNow = inputs.whyNow && inputs.whyNow.trim().length >= 10;
  const whyNowShifts = hasWhyNow && /(shift|change|new|now|recent|since|release|regulation|law|api|model|adoption|growth)/i.test(inputs.whyNow);
  checks.push({
    name: "why-now",
    status: !hasWhyNow ? "missing" : whyNowShifts ? "ok" : "weak",
    note: whyNowShifts
      ? "Timing shift is articulated."
      : hasWhyNow
        ? "'Why now' is generic — name a specific shift (regulatory, technological, behavioral)."
        : "'Why now' is missing — investors silently ask this on every slide.",
  });
  // Why you: present + names credibility?
  const hasTeam = inputs.teamCredibility && inputs.teamCredibility.trim().length >= 10;
  const teamSpecific = hasTeam && /(built|founded|led|engineer|cto|ceo|phd|exit|patent|years?|prior)/i.test(inputs.teamCredibility);
  checks.push({
    name: "why-you",
    status: !hasTeam ? "missing" : teamSpecific ? "ok" : "weak",
    note: teamSpecific
      ? "Team credibility is specific (names prior work, roles, or outcomes)."
      : hasTeam
        ? "Team credibility is generic — name prior companies, roles, or wins."
        : "Team credibility is missing — investors invest in teams, not just ideas.",
  });
  const allOk = checks.every((c) => c.status === "ok");
  const missingCount = checks.filter((c) => c.status === "missing").length;
  const weakCount = checks.filter((c) => c.status === "weak").length;
  const summary = allOk
    ? "Narrative arc is solid — all four investor questions are answered."
    : missingCount > 0
      ? `${missingCount} narrative element${missingCount === 1 ? "" : "s"} missing — fix before pitching.`
      : `${weakCount} element${weakCount === 1 ? "" : "s"} weak — tighten before pitching.`;
  return { ok: allOk, checks, summary };
}

// ---------- Use of funds ----------

/**
 * Derive a use-of-funds breakdown from the target raise and stage.
 * Percentages are heuristics per stage. Returns 4 categories summing to 100%.
 */
export function deriveUseOfFunds(inputs: PitchInputs): UseOfFundsItem[] {
  const stage = inputs.stage;
  if (stage === "sales") return [];
  // Stage-tuned allocations.
  const presets: Record<Exclude<Stage, "sales">, UseOfFundsItem[]> = {
    "pre-seed": [
      { category: "Engineering / product", percentage: 55, rationale: "Pre-seed is about proving the product works. Bias heavily toward building." },
      { category: "Founding team salary", percentage: 25, rationale: "Modest founder salaries to extend runway — keep burn low." },
      { category: "Go-to-market (early)", percentage: 10, rationale: "Small experiments to find your first repeatable channel." },
      { category: "Operations / legal / infra", percentage: 10, rationale: "Incorporation, accounting, basic tooling, cloud." },
    ],
    "seed": [
      { category: "Engineering / product", percentage: 45, rationale: "Ship the v1 product and reach product-market fit signals." },
      { category: "Go-to-market", percentage: 30, rationale: "Find your first repeatable acquisition channel." },
      { category: "Team (key hires)", percentage: 15, rationale: "2–3 key hires (e.g. growth lead, senior engineer)." },
      { category: "Operations / legal / infra", percentage: 10, rationale: "Compliance, accounting, cloud, tooling." },
    ],
    "series-a": [
      { category: "Go-to-market", percentage: 45, rationale: "Series A is about scaling a working channel — invest in sales + marketing." },
      { category: "Engineering / product", percentage: 30, rationale: "Scale the product, harden infrastructure, build moats." },
      { category: "Team (scaling)", percentage: 20, rationale: "Hire managers and senior ICs across functions." },
      { category: "Operations / legal / infra", percentage: 5, rationale: "Mature ops, compliance, security, infrastructure." },
    ],
  };
  return presets[stage as Exclude<Stage, "sales">] || presets.seed;
}

// ---------- Milestones ----------

/**
 * Derive milestones for the raise period based on stage and target raise.
 */
export function deriveMilestones(inputs: PitchInputs): Milestone[] {
  const stage = inputs.stage;
  const raise = parseRaise(inputs.targetRaise);
  if (stage === "sales") return [];
  const runway = (() => {
    if (!isFinite(raise)) return "18 months";
    if (raise < 750_000) return "12 months";
    if (raise < 3_000_000) return "18 months";
    if (raise < 10_000_000) return "24 months";
    return "30 months";
  })();
  if (stage === "pre-seed") {
    return [
      { timeframe: `Months 1–6 of ${runway}`, goal: "Ship public v1 and recruit 10 design partners", metric: "10 signed design partners, 50 weekly active users" },
      { timeframe: `Months 7–12 of ${runway}`, goal: "Find first repeatable acquisition signal", metric: "$5k MRR or 100 paying customers" },
      { timeframe: `Months 13–18 of ${runway}`, goal: "Reach seed-round metrics", metric: "$15k MRR + 15% MoM growth" },
    ];
  }
  if (stage === "seed") {
    return [
      { timeframe: `Months 1–9 of ${runway}`, goal: "Reach product-market fit signals", metric: "NPS > 40, net revenue retention > 110%" },
      { timeframe: `Months 10–18 of ${runway}`, goal: "Find and scale one repeatable acquisition channel", metric: "$100k MRR, CAC payback < 18 months" },
      { timeframe: `Months 19–24 of ${runway}`, goal: "Reach Series A metrics", metric: "$1M–$2M ARR, 100% YoY growth" },
    ];
  }
  // Series A
  return [
    { timeframe: `Months 1–9 of ${runway}`, goal: "Scale the working channel", metric: "3x revenue, CAC stable or improving" },
    { timeframe: `Months 10–18 of ${runway}`, goal: "Add a second GTM motion (enterprise or PLG)", metric: "30% of new revenue from second motion" },
    { timeframe: `Months 19–30 of ${runway}`, goal: "Reach Series B metrics", metric: "$10M ARR, 80%+ net revenue retention, clear path to profitability" },
  ];
}

// ---------- Generate ----------

/**
 * Generate the full pitch deck outline:
 * - Per-stage slide sequence
 * - Per-slide content (talking points, investor expectations, pitfalls, speaker notes)
 * - Narrative arc check
 * - Use-of-funds breakdown
 * - Milestones for the raise period
 * - Validation warnings
 */
export function generate(inputs: PitchInputs): PitchOutput {
  const warnings = validateInputs(inputs);
  const sequence = SLIDE_SEQUENCE[inputs.stage] || SLIDE_SEQUENCE.seed;
  const slides = sequence.map((id) => buildSlide(id, inputs));
  const narrative = checkNarrativeArc(inputs);
  const useOfFunds = deriveUseOfFunds(inputs);
  const milestones = deriveMilestones(inputs);
  return {
    slides,
    narrative,
    useOfFunds,
    milestones,
    warnings,
    slideCount: slides.length,
  };
}

// ---------- Render ----------

/** Render the pitch outline as a Markdown report. */
export function renderMarkdown(output: PitchOutput, inputs: PitchInputs): string {
  const lines: string[] = [];
  lines.push(`# ${inputs.companyName || "[Company]"} — ${STAGE_LABELS[inputs.stage]} pitch deck outline`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Pitch Deck Outline Generator. ${output.slideCount} slides._`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Company:** ${inputs.companyName || "—"}`);
  lines.push(`- **One-liner:** ${inputs.oneLiner || "—"}`);
  lines.push(`- **Industry:** ${inputs.industry || "—"}`);
  lines.push(`- **Stage:** ${STAGE_LABELS[inputs.stage]}`);
  if (inputs.stage !== "sales") {
    lines.push(`- **Target raise:** ${inputs.targetRaise || "—"}`);
  }
  lines.push("");
  if (output.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push(`## Narrative arc — ${output.narrative.ok ? "✅ solid" : "⚠️ needs work"}`);
  lines.push("");
  lines.push(output.narrative.summary);
  lines.push("");
  for (const c of output.narrative.checks) {
    const icon = c.status === "ok" ? "✅" : c.status === "weak" ? "⚠️" : "❌";
    lines.push(`- ${icon} **${c.name}** (${c.status}): ${c.note}`);
  }
  lines.push("");
  lines.push("## Slide-by-slide outline");
  lines.push("");
  for (const s of output.slides) {
    lines.push(`### Slide ${output.slides.indexOf(s) + 1}: ${s.title}`);
    lines.push("");
    lines.push(`**Purpose:** ${s.purpose}`);
    lines.push("");
    lines.push("**Talking points:**");
    for (const t of s.talkingPoints) lines.push(`- ${t}`);
    lines.push("");
    lines.push("**What investors look for:**");
    for (const e of s.investorExpectations) lines.push(`- ${e}`);
    lines.push("");
    lines.push("**Common pitfalls:**");
    for (const p of s.pitfalls) lines.push(`- ${p}`);
    lines.push("");
    lines.push("**Speaker notes (30–60s):**");
    lines.push(`> ${s.speakerNotes}`);
    lines.push("");
  }
  if (output.useOfFunds.length > 0) {
    lines.push("## Use of funds");
    lines.push("");
    for (const u of output.useOfFunds) {
      lines.push(`- **${u.category}** — ${u.percentage}%: ${u.rationale}`);
    }
    lines.push("");
  }
  if (output.milestones.length > 0) {
    lines.push("## Milestones for this raise");
    lines.push("");
    for (const m of output.milestones) {
      lines.push(`- **${m.timeframe}:** ${m.goal} — _metric: ${m.metric}_`);
    }
    lines.push("");
  }
  lines.push("## Honesty");
  lines.push("");
  lines.push("This tool builds the outline and narrative spine — it does NOT design slides, write financials, or verify your traction numbers. Traction and financial numbers MUST be real. Design comes after story.");
  return lines.join("\n");
}

/** Render speaker-notes-only version (the talk track). */
export function renderSpeakerNotes(output: PitchOutput): string {
  const lines: string[] = [];
  lines.push("# Speaker notes — talk track");
  lines.push("");
  for (const s of output.slides) {
    lines.push(`## Slide ${output.slides.indexOf(s) + 1}: ${s.title}`);
    lines.push("");
    lines.push(s.speakerNotes);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the output as JSON (full inputs + output). */
export function renderJson(output: PitchOutput, inputs: PitchInputs): string {
  return JSON.stringify({ inputs, output, generatedAt: new Date().toISOString() }, null, 2);
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

export function buildShareUrl(inputs: PitchInputs): string {
  const params = new URLSearchParams();
  if (inputs.companyName) params.set("co", inputs.companyName);
  if (inputs.oneLiner) params.set("ol", inputs.oneLiner);
  if (inputs.industry) params.set("ind", inputs.industry);
  if (inputs.stage !== "seed") params.set("stage", inputs.stage);
  if (inputs.targetRaise) params.set("raise", inputs.targetRaise);
  if (inputs.problem) params.set("prob", inputs.problem);
  if (inputs.solution) params.set("sol", inputs.solution);
  if (inputs.audience) params.set("aud", inputs.audience);
  if (inputs.whyNow) params.set("wn", inputs.whyNow);
  if (inputs.teamCredibility) params.set("team", inputs.teamCredibility);
  if (inputs.traction) params.set("trac", inputs.traction);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<PitchInputs> = {};
  if (params.get("co")) inputs.companyName = params.get("co")!;
  if (params.get("ol")) inputs.oneLiner = params.get("ol")!;
  if (params.get("ind")) inputs.industry = params.get("ind")!;
  const stage = params.get("stage");
  if (stage === "pre-seed" || stage === "seed" || stage === "series-a" || stage === "sales") {
    inputs.stage = stage;
  }
  if (params.get("raise")) inputs.targetRaise = params.get("raise")!;
  if (params.get("prob")) inputs.problem = params.get("prob")!;
  if (params.get("sol")) inputs.solution = params.get("sol")!;
  if (params.get("aud")) inputs.audience = params.get("aud")!;
  if (params.get("wn")) inputs.whyNow = params.get("wn")!;
  if (params.get("team")) inputs.teamCredibility = params.get("team")!;
  if (params.get("trac")) inputs.traction = params.get("trac")!;
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: PitchInputs, slideTitles: string[]): string {
  return [
    "You are an expert startup pitch coach. Review the pitch deck outline below and propose per-slide refinements + narrative suggestions.",
    "",
    "Inputs:",
    `- Company: ${inputs.companyName || "(empty)"}`,
    `- One-liner: ${inputs.oneLiner || "(empty)"}`,
    `- Industry: ${inputs.industry || "(empty)"}`,
    `- Stage: ${STAGE_LABELS[inputs.stage]}`,
    `- Target raise: ${inputs.targetRaise || "(empty)"}`,
    `- Problem: ${inputs.problem || "(empty)"}`,
    `- Solution: ${inputs.solution || "(empty)"}`,
    `- Audience: ${inputs.audience || "(empty)"}`,
    `- Why now: ${inputs.whyNow || "(empty)"}`,
    `- Team credibility: ${inputs.teamCredibility || "(empty)"}`,
    `- Traction: ${inputs.traction || "(empty)"}`,
    "",
    `Slide sequence (${slideTitles.length} slides):`,
    ...slideTitles.map((s, i) => `  ${i + 1}. ${s}`),
    "",
    "Output a JSON object with:",
    '- "refinedSlides": array of { "id": string (slide title), "title": string, "refinedTalkingPoints": array of 3–5 strings (concrete, specific to the inputs above) }',
    '- "narrativeSuggestions": array of strings (specific suggestions to tighten the problem→solution→why-now→why-you arc)',
    '- "openQuestions": array of strings (questions the founder should be able to answer but the inputs don\'t yet cover)',
    "",
    "Be honest. If the problem is vague, say so. If traction is missing, ask for it. Do not invent numbers.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedSlides = Array.isArray(o.refinedSlides)
    ? (o.refinedSlides as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            id: typeof r.id === "string" ? r.id : "",
            title: typeof r.title === "string" ? r.title : "",
            refinedTalkingPoints: Array.isArray(r.refinedTalkingPoints)
              ? (r.refinedTalkingPoints as unknown[]).filter((t) => typeof t === "string") as string[]
              : [],
          };
        })
        .filter((x) => x.title.length > 0 || x.id.length > 0)
    : [];
  const narrativeSuggestions = Array.isArray(o.narrativeSuggestions)
    ? (o.narrativeSuggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const openQuestions = Array.isArray(o.openQuestions)
    ? (o.openQuestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return {
    ok: true,
    result: { refinedSlides, narrativeSuggestions, openQuestions },
  };
}
