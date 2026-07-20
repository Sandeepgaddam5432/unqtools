/**
 * AI Salary Negotiation Script Writer — pure logic.
 *
 * Generate tailored salary-negotiation scripts from current offer, target,
 * role, location, and leverage points: counter-offer email, talking points,
 * objection responses, and non-salary levers.
 *
 * Three scenarios (initial ask / counter-offer / final offer), two tones
 * (confident / collaborative), seven leverage framings, eight non-salary
 * levers, six objection responses, and an anchor-range suggestion.
 *
 * Pure template engine — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Scenario = "initial-ask" | "counter-offer" | "final-offer";
export type Tone = "confident" | "collaborative";

export type ObjectionKey =
  | "budget"
  | "expectations"
  | "experience"
  | "timing"
  | "competitive"
  | "promotion";

export type NonSalaryLeverKey =
  | "equity"
  | "pto"
  | "remote"
  | "signing-bonus"
  | "bonus"
  | "title"
  | "development"
  | "benefits";

export type LeverageKey =
  | "competing-offer"
  | "market-data"
  | "impact"
  | "experience"
  | "education"
  | "skills-scarcity"
  | "promotion-track";

export interface NegotiationInput {
  scenario: Scenario;
  tone: Tone;
  role: string;
  companyName: string;
  hiringManager: string;          // "" if unknown
  currentSalary: number | null;   // for raise scenarios
  offerSalary: number | null;     // existing offer to counter
  targetSalary: number;           // your ask
  location: string;               // "" if unknown
  leverage: LeverageKey[];        // checked leverage framings
  levers: NonSalaryLeverKey[];    // which non-salary levers to include
  customLeverageNote: string;     // free-form extra context
}

export interface ObjectionResponse {
  key: ObjectionKey;
  objection: string;              // what the employer says
  response: string;               // your scripted reply
}

export interface NonSalaryLever {
  key: NonSalaryLeverKey;
  label: string;
  script: string;
}

export interface AnchorRange {
  low: number;                    // target × 0.95 — your floor
  mid: number;                    // target — your ask
  high: number;                   // target × 1.10 — your stretch (open with this)
}

export interface NegotiationScript {
  scenario: Scenario;
  tone: Tone;
  email: { subject: string; body: string };
  talkingPoints: string[];
  objectionResponses: ObjectionResponse[];
  nonSalaryLevers: NonSalaryLever[];
  anchorRange: AnchorRange;
  leverageFraming: string[];
  rolePlayQa: { question: string; answer: string }[];
  benefitsChecklist: string[];
  summary: string;
  confidence: "low" | "medium" | "high";
}

export interface HistoryEntry {
  ts: number;
  scenario: Scenario;
  tone: Tone;
  role: string;
  targetSalary: number;
  offerSalary: number | null;
  anchorHigh: number;
  leverage: LeverageKey[];
  nonSalaryLeverCount: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-salary-negotiation-script-writer:history";
export const HISTORY_MAX = 20;

export const SCENARIO_LABELS: Record<Scenario, string> = {
  "initial-ask": "Initial ask",
  "counter-offer": "Counter-offer",
  "final-offer": "Final offer",
};

export const SCENARIO_HINTS: Record<Scenario, string> = {
  "initial-ask": "You're putting the first number on the table. Open with your stretch (high anchor) and frame it with your strongest leverage.",
  "counter-offer": "You've received an offer and want more. Acknowledge it graciously, anchor to your target, and back it with data.",
  "final-offer": "This is the closing round. State your bottom line, signal willingness to walk, and trade salary for non-salary levers.",
};

export const TONE_LABELS: Record<Tone, string> = {
  confident: "Confident",
  collaborative: "Collaborative",
};

export const TONE_HINTS: Record<Tone, string> = {
  confident: "Firm, anchored, willingness to walk. Use when you have strong leverage or a competing offer.",
  collaborative: "Partnership framing, problem-solving. Use when you want to preserve the relationship and find a shared outcome.",
};

export const OBJECTION_LABELS: Record<ObjectionKey, string> = {
  budget: "Budget is fixed",
  expectations: "What are your expectations?",
  experience: "You need more experience",
  timing: "Wrong timing",
  competitive: "We match competitive offers",
  promotion: "Wait for your promotion",
};

export const LEVERAGE_LABELS: Record<LeverageKey, string> = {
  "competing-offer": "Competing offer",
  "market-data": "Market-rate data",
  impact: "Quantified impact",
  experience: "Relevant experience",
  education: "Education / certifications",
  "skills-scarcity": "Scarce / in-demand skills",
  "promotion-track": "Promotion-track case",
};

export const NON_SALARY_LEVER_LABELS: Record<NonSalaryLeverKey, string> = {
  equity: "Equity / stock options",
  pto: "Additional PTO",
  remote: "Remote / hybrid flexibility",
  "signing-bonus": "Signing bonus",
  bonus: "Performance bonus",
  title: "Title adjustment",
  development: "Professional development budget",
  benefits: "Enhanced benefits",
};

export const ROLE_PLAY_PRESETS: { label: string; input: NegotiationInput }[] = [
  {
    label: "Senior SWE counter-offer",
    input: {
      scenario: "counter-offer",
      tone: "confident",
      role: "Senior Software Engineer",
      companyName: "Acme Corp",
      hiringManager: "Jordan Lee",
      currentSalary: 165000,
      offerSalary: 180000,
      targetSalary: 210000,
      location: "San Francisco, CA",
      leverage: ["competing-offer", "impact", "skills-scarcity"],
      levers: ["equity", "remote", "signing-bonus"],
      customLeverageNote: "",
    },
  },
  {
    label: "Marketing Manager raise",
    input: {
      scenario: "initial-ask",
      tone: "collaborative",
      role: "Marketing Manager",
      companyName: "Northwind",
      hiringManager: "Sam Patel",
      currentSalary: 95000,
      offerSalary: null,
      targetSalary: 115000,
      location: "Austin, TX",
      leverage: ["impact", "promotion-track", "market-data"],
      levers: ["bonus", "development", "title"],
      customLeverageNote: "Promoted scope, now leading 4-person team",
    },
  },
  {
    label: "Final offer — close",
    input: {
      scenario: "final-offer",
      tone: "confident",
      role: "Product Designer",
      companyName: "Brightside",
      hiringManager: "",
      currentSalary: null,
      offerSalary: 145000,
      targetSalary: 160000,
      location: "Remote (US)",
      leverage: ["competing-offer", "experience"],
      levers: ["pto", "remote", "equity"],
      customLeverageNote: "",
    },
  },
];

// ---------- Pure helpers ----------

/** Format a salary as a USD string (e.g. $210,000). */
export function formatSalary(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n) || n <= 0) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Normalize a free-text field: trim, collapse internal whitespace. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize the first character of a string. */
export function capitalize(s: string): string {
  s = s || "";
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Compute the anchor range from a target salary. */
export function computeAnchorRange(target: number): AnchorRange {
  const t = Math.max(0, target);
  return {
    low: Math.round(t * 0.95),
    mid: Math.round(t),
    high: Math.round(t * 1.1),
  };
}

/** Validate a NegotiationInput. Returns an array of human-readable errors. */
export function validateInput(input: NegotiationInput): string[] {
  const errors: string[] = [];
  if (!normalizeText(input.role)) errors.push("Role is required.");
  if (!normalizeText(input.companyName)) errors.push("Company name is required.");
  if (!input.targetSalary || input.targetSalary <= 0) {
    errors.push("Target salary must be a positive number.");
  }
  if (input.scenario === "counter-offer" && (!input.offerSalary || input.offerSalary <= 0)) {
    errors.push("Counter-offer scenario needs an existing offer salary.");
  }
  if (input.scenario === "initial-ask" && input.offerSalary && input.offerSalary > 0) {
    errors.push("Initial ask scenario should not have an existing offer.");
  }
  return errors;
}

/** Build a confidence level from the number of leverage points and levers. */
export function computeConfidence(leverage: LeverageKey[], levers: NonSalaryLeverKey[]): "low" | "medium" | "high" {
  const n = leverage.length + levers.length;
  if (n >= 4) return "high";
  if (n >= 2) return "medium";
  return "low";
}

// ---------- Greeting + sign-off ----------

export function buildGreeting(input: NegotiationInput): string {
  const name = normalizeText(input.hiringManager);
  if (name) return `Hi ${name.split(" ")[0]},`;
  return "Hi there,";
}

export function buildSignOff(input: NegotiationInput): string {
  return input.tone === "confident"
    ? "Looking forward to your response.\n\nBest regards,"
    : "I'd love to find a path that works for both of us — happy to talk it through.\n\nWarm regards,";
}

// ---------- Email subject ----------

export function buildEmailSubject(input: NegotiationInput): string {
  const role = normalizeText(input.role) || "the role";
  switch (input.scenario) {
    case "initial-ask":
      return `Compensation discussion — ${role} at ${input.companyName}`;
    case "counter-offer":
      return `Re: Offer for ${role} — compensation discussion`;
    case "final-offer":
      return `Final thoughts on ${role} offer`;
  }
}

// ---------- Leverage framing ----------

export const LEVERAGE_FRAMINGS: Record<LeverageKey, (input: NegotiationInput) => string> = {
  "competing-offer": (i) => {
    const offer = i.offerSalary ? `The current offer of ${formatSalary(i.offerSalary)}` : "The current offer";
    return `${offer} is below a competing offer I'm evaluating, and ${i.companyName} is my strong preference — I'd like to see if we can close the gap.`;
  },
  "market-data": (i) => {
    return `Based on public market data for ${normalizeText(i.role) || "this role"}${i.location ? ` in ${i.location}` : ""}, the market midpoint sits around ${formatSalary(i.targetSalary)}, which is what I'm targeting.`;
  },
  impact: (_i) => {
    return `In my most recent role, I delivered measurable impact — shipping projects that moved the team's core metrics and reduced incident load. I'm confident I can replicate that here within the first two quarters.`;
  },
  experience: (_i) => {
    return `I bring directly relevant experience — I've owned the exact scope this role covers, so my ramp-up time will be minimal and I can contribute from week one.`;
  },
  education: (_i) => {
    return `My formal training and certifications align with the technical requirements of this role, which shortens the path to full productivity.`;
  },
  "skills-scarcity": (_i) => {
    return `The specific skill set I bring is in short supply in the current market — finding candidates with this exact combination is genuinely difficult, which is reflected in current compensation bands.`;
  },
  "promotion-track": (_i) => {
    return `I'm being considered for an internal promotion at my current employer, which would bring my compensation close to my target — I'd prefer to make this move, but the math has to work.`;
  },
};

export function buildLeverageFraming(input: NegotiationInput): string[] {
  return input.leverage.map((k) => LEVERAGE_FRAMINGS[k](input));
}

// ---------- Email body ----------

export function buildEmailBody(input: NegotiationInput): string {
  const greeting = buildGreeting(input);
  const signOff = buildSignOff(input);
  const role = normalizeText(input.role) || "the role";
  const target = formatSalary(input.targetSalary);
  const offer = input.offerSalary ? formatSalary(input.offerSalary) : "";
  const current = input.currentSalary ? formatSalary(input.currentSalary) : "";
  const leverage = buildLeverageFraming(input);
  const custom = normalizeText(input.customLeverageNote);

  const opener = (() => {
    if (input.scenario === "initial-ask") {
      return input.tone === "confident"
        ? `Thank you for the offer conversation regarding ${role} at ${input.companyName}. After weighing the scope and the market, I'd like to propose ${target} as a base that reflects the responsibilities and the value I expect to deliver.`
        : `Thank you for the conversation about ${role} at ${input.companyName}. I'm genuinely excited about the team and the work, and I'd love to land on a compensation package that reflects the scope — I'm proposing ${target} as a starting point.`;
    }
    if (input.scenario === "counter-offer") {
      return input.tone === "confident"
        ? `Thank you for the offer of ${offer} for ${role}. After reviewing the full picture — scope, market data, and my trajectory — I'd like to propose ${target}.`
        : `Thank you for the offer of ${offer} for ${role}. I'm thrilled about the direction and the team. To make this work for both of us, I'd love to talk through a target of ${target}.`;
    }
    // final-offer
    return input.tone === "confident"
      ? `I've thought carefully about the offer for ${role}. ${target} is the number that makes this move make sense for me — I'm ready to sign at that level.`
      : `I've thought carefully about the offer for ${role}. ${target} is the number that lets me say a confident yes — and I'm hopeful we can land there together.`;
  })();

  const leverageBlock = leverage.length > 0
    ? `\n\nA few points that frame my ask:\n${leverage.map((l) => `• ${l}`).join("\n")}`
    : "";

  const currentBlock = current && input.scenario === "initial-ask"
    ? `\n\nFor context, my current base sits at ${current}; the move needs to represent a meaningful step.`
    : "";

  const customBlock = custom ? `\n\nAdditional context: ${custom}.` : "";

  const leverList = input.levers.length > 0
    ? input.levers.map((k) => `• ${NON_SALARY_LEVER_LABELS[k]}`).join("\n")
    : "";

  const leversBlock = leverList
    ? `\n\nIf base salary is harder to move, I'd be very open to discussing non-salary levers as part of the total package:\n${leverList}`
    : "";

  const closer = input.scenario === "final-offer"
    ? `\n\nI have a decision to make by end of week and want to be transparent about where I stand. I'd love to make this work with ${input.companyName}.`
    : `\n\nCould we set up a quick call this week to discuss?`;

  return [greeting, "", opener + leverageBlock + currentBlock + customBlock + leversBlock + closer, "", signOff].join("\n");
}

// ---------- Talking points ----------

export function buildTalkingPoints(input: NegotiationInput): string[] {
  const target = formatSalary(input.targetSalary);
  const offer = input.offerSalary ? formatSalary(input.offerSalary) : "";
  const anchor = computeAnchorRange(input.targetSalary);
  const points: string[] = [];

  points.push(
    input.scenario === "initial-ask"
      ? `Open with the stretch number: "${formatSalary(anchor.high)}." Anchor high — your real target (${target}) then looks like a concession, not an ask.`
      : input.scenario === "counter-offer"
        ? `Acknowledge the offer (${offer}) first, then counter at ${target}. The gap between their number and yours is the conversation; lead with leverage, not the number.`
        : `State your bottom line clearly: ${target}. Don't hedge — this is the close, not the opening.`,
  );

  points.push(
    input.tone === "confident"
      ? `Stay silent after stating your number. Let them respond first — the first person to fill the silence usually concedes.`
      : `Frame the ask as a shared problem: "How can we get this to a number that works for both of us?" Collaboration invites movement; ultimatums invite pushback.`,
  );

  for (const l of buildLeverageFraming(input)) {
    points.push(`Leverage — ${l}`);
  }

  if (input.levers.length > 0) {
    points.push(
      `If salary won't move, trade up on: ${input.levers.map((k) => NON_SALARY_LEVER_LABELS[k]).join(", ")}. Total comp matters more than base alone.`,
    );
  }

  points.push(
    `If asked "is this your best offer?" — counter-question: "Is there flexibility on base, or should we look at the total package?" Forces them to name the constraint.`,
  );

  points.push(
    `Walk-away line if needed: "I appreciate the offer. At this number I can't make the move — I'd love to stay in touch if the band changes." Polite, firm, leaves the door open.`,
  );

  return points;
}

// ---------- Objection responses ----------

export const OBJECTION_RESPONSES: Record<ObjectionKey, (input: NegotiationInput) => { objection: string; response: string }> = {
  budget: (i) => ({
    objection: `"The budget for this role is fixed — we can't go higher."`,
    response: i.tone === "confident"
      ? `"I understand budgets are set, but they're also revised for the right candidate. Based on the scope and the market for ${normalizeText(i.role) || "this role"}, ${formatSalary(i.targetSalary)} is the right number — is the budget for the role, or for the headcount? Sometimes those can be uncoupled with a signing bonus or a step-up at six months."`
      : `"I totally get that budgets are tight. Would it help if we looked at the total package — base plus equity, signing bonus, or a performance review at six months? That way the base stays in budget and we still land at the right total for the scope."`,
  }),
  expectations: (i) => ({
    objection: `"What are your salary expectations?"`,
    response: i.scenario === "initial-ask"
      ? `"Based on the scope and the market for ${normalizeText(i.role) || "this role"}${i.location ? ` in ${i.location}` : ""}, I'm targeting ${formatSalary(i.targetSalary)}. I'm flexible on the structure — base, equity, signing — but that's the ballpark I need to be in to make the move."`
      : `"I'm looking at ${formatSalary(i.targetSalary)} total comp, with flexibility on how that's structured. I'd love to understand the band for this role so we can find a fit."`,
  }),
  experience: (i) => ({
    objection: `"We'd need to see more experience to justify that number."`,
    response: i.tone === "confident"
      ? `"I hear that. Let me share the specific experience that maps to this scope — ${buildLeverageFraming(i)[0] ?? "I've owned this exact scope before"}. If after that you still see a gap, I'd love to hear specifically what experience would close it, so we can plan a path."`
      : `"That's fair — let me walk you through how my background maps to the scope. I'd also love to hear where you see the gaps; maybe we can structure a six-month review that ties a step-up to specific milestones."`,
  }),
  timing: (i) => ({
    objection: `"Now isn't a great time — let's revisit this in six months."`,
    response: i.tone === "confident"
      ? `"I appreciate the offer to revisit. To be transparent, I have other conversations moving and I'd need to make a decision on the current package. Could we tie a written six-month review with a defined step-up to ${formatSalary(i.targetSalary)} as part of the offer?"`
      : `"I'd love to plan for that — could we put a six-month review in writing with a specific milestone-based step-up to ${formatSalary(i.targetSalary)}? That way we both have clarity on the path and I can commit with confidence."`,
  }),
  competitive: (i) => ({
    objection: `"We match competitive offers — bring us a written offer and we'll match it."`,
    response: i.tone === "confident"
      ? `"I'd prefer not to leverage a competing offer to drive this conversation — I'd rather we land on the right number based on the scope and market. That said, I do have other offers in flight at ${formatSalary(i.targetSalary)}, and I'll need to make a decision by end of week."`
      : `"I'd love to keep this about the scope and the market rather than a bidding war. If it helps, I can share the range I'm seeing elsewhere — but I'd prefer we find the right number together based on the work."`,
  }),
  promotion: (i) => ({
    objection: `"Take this offer now and we'll fast-track your promotion next cycle."`,
    response: i.tone === "confident"
      ? `"I appreciate that, but verbal fast-track commitments rarely survive a reorg or a manager change. Could we write the promotion criteria into the offer letter — specific milestones, a defined timeline, and the target comp at promotion? That converts a promise into a plan."`
      : `"That sounds great in principle — could we make it concrete? If we write the promotion criteria and target comp into the offer letter, I'd feel much more comfortable signing at the current base knowing the path is locked in."`,
  }),
};

export function buildObjectionResponses(input: NegotiationInput): ObjectionResponse[] {
  return (Object.keys(OBJECTION_RESPONSES) as ObjectionKey[]).map((k) => {
    const r = OBJECTION_RESPONSES[k](input);
    return { key: k, objection: r.objection, response: r.response };
  });
}

// ---------- Non-salary levers ----------

export const NON_SALARY_LEVER_SCRIPTS: Record<NonSalaryLeverKey, (input: NegotiationInput) => string> = {
  equity: (i) => `Equity / stock options — "If base is tight, could we look at the equity grant? An additional ${formatSalary(Math.round(i.targetSalary * 0.1))} equivalent in equity vesting over four years would meaningfully close the gap for me."`,
  pto: (_i) => `Additional PTO — "One lever that costs the company nothing but matters a lot to me is PTO. Could we add a week of additional vacation? I'd value that at roughly 2% of comp."`,
  remote: (_i) => `Remote / hybrid flexibility — "If base won't move, full remote flexibility is a meaningful lever for me — it expands my talent market and saves relocation costs. Could we lock in remote-first in the offer letter?"`,
  "signing-bonus": (i) => `Signing bonus — "A one-time signing bonus of ${formatSalary(Math.round((i.targetSalary - (i.offerSalary ?? i.targetSalary * 0.85)) * 0.5 || i.targetSalary * 0.05))} would bridge the gap without touching the base band. That's often easier to get approved than a base lift."`,
  bonus: (_i) => `Performance bonus — "Could we structure a performance bonus of 15–20% tied to specific H1 milestones? That aligns my upside with the company's outcomes and gets my total comp to target if I deliver."`,
  title: (_i) => `Title adjustment — "A title bump — Senior to Staff, or Manager to Senior Manager — costs nothing but compounds over my career. Could we adjust the title to reflect the scope I'll be owning?"`,
  development: (_i) => `Professional development — "A $5,000 annual professional development budget — conferences, courses, certifications — is a low-cost lever that directly improves my value to the team. Could we add that to the offer?"`,
  benefits: (_i) => `Enhanced benefits — "Could we look at the benefits side — e.g., 401(k) match acceleration, an HSA contribution, or a dependent-care stipend? Those move total comp without touching base."`,
};

export function buildNonSalaryLevers(input: NegotiationInput): NonSalaryLever[] {
  return input.levers.map((k) => ({
    key: k,
    label: NON_SALARY_LEVER_LABELS[k],
    script: NON_SALARY_LEVER_SCRIPTS[k](input),
  }));
}

// ---------- Role-play Q&A ----------

export function buildRolePlayQa(input: NegotiationInput): { question: string; answer: string }[] {
  const objections = buildObjectionResponses(input);
  const target = formatSalary(input.targetSalary);
  return [
    {
      question: `"Why don't we come back to this after you've been here six months?"`,
      answer: objections.find((o) => o.key === "timing")?.response ?? `I'd prefer to land the right number now — could we write a six-month review with a defined step-up to ${target}?`,
    },
    {
      question: `"What's your current salary?"`,
      answer: `"I'd rather focus on the market rate for the scope of this role. Based on the responsibilities and my research, I'm targeting ${target} — I'm happy to share the data I'm looking at if it helps."`,
    },
    {
      question: `"Is this your best offer?"`,
      answer: `"I appreciate the question — is there flexibility on base, or should we look at the total package? I'd love to find a path to ${target}."`,
    },
    {
      question: `"We have other strong candidates in process."`,
      answer: `"I understand — and I'd encourage you to weigh the cost of a longer search against the gap we're discussing. I'm ready to sign today at ${target} and start delivering."`,
    },
  ];
}

// ---------- Benefits checklist ----------

export function buildBenefitsChecklist(_input: NegotiationInput): string[] {
  return [
    "Base salary (annual, in writing)",
    "Sign-on / signing bonus (amount + payment schedule)",
    "Equity / stock options (grant size, strike, vesting schedule, cliff)",
    "Annual performance bonus (target %, payout history, criteria)",
    "401(k) / pension match (employer %, vesting)",
    "Health / dental / vision (premium split, deductibles, HSA/FSA)",
    "PTO + sick leave + holidays (annual days, rollover policy)",
    "Parental leave (primary/secondary caregiver weeks)",
    "Remote / hybrid policy (days in office, location flexibility)",
    "Professional development budget (annual $, eligible uses)",
    "Relocation assistance (if applicable)",
    "Severance terms (if any)",
    "Start date + first review date",
  ];
}

// ---------- Summary ----------

export function buildSummary(input: NegotiationInput, anchor: AnchorRange, confidence: "low" | "medium" | "high"): string {
  const scenario = SCENARIO_LABELS[input.scenario].toLowerCase();
  const tone = input.tone;
  const target = formatSalary(input.targetSalary);
  const role = normalizeText(input.role) || "the role";
  const levCount = input.leverage.length;
  const leverCount = input.levers.length;

  return `${SCENARIO_LABELS[input.scenario]} (${tone} tone) for ${role} at ${input.companyName}. ` +
    `Target: ${target}. Anchor range: ${formatSalary(anchor.low)} (floor) → ${formatSalary(anchor.mid)} (ask) → ${formatSalary(anchor.high)} (stretch / opening). ` +
    `${levCount} leverage point${levCount === 1 ? "" : "s"} and ${leverCount} non-salary lever${leverCount === 1 ? "" : "s"} ready. ` +
    `Confidence: ${confidence}. ` +
    `This is a ${scenario} — read your scripts aloud once before the call, and remember: silence after your number is your friend.`;
}

// ---------- Main entry: generate the full script ----------

export function generateScript(input: NegotiationInput): NegotiationScript {
  const anchor = computeAnchorRange(input.targetSalary);
  const confidence = computeConfidence(input.leverage, input.levers);
  return {
    scenario: input.scenario,
    tone: input.tone,
    email: {
      subject: buildEmailSubject(input),
      body: buildEmailBody(input),
    },
    talkingPoints: buildTalkingPoints(input),
    objectionResponses: buildObjectionResponses(input),
    nonSalaryLevers: buildNonSalaryLevers(input),
    anchorRange: anchor,
    leverageFraming: buildLeverageFraming(input),
    rolePlayQa: buildRolePlayQa(input),
    benefitsChecklist: buildBenefitsChecklist(input),
    summary: buildSummary(input, anchor, confidence),
    confidence,
  };
}

// ---------- Rendering ----------

/** Render the full script as plain text for copy / download. */
export function renderScriptText(script: NegotiationScript): string {
  const lines: string[] = [];
  lines.push(`=== Salary Negotiation Script ===`);
  lines.push(`Scenario: ${SCENARIO_LABELS[script.scenario]}  |  Tone: ${TONE_LABELS[script.tone]}`);
  lines.push(`Confidence: ${script.confidence}`);
  lines.push("");
  lines.push(`--- Summary ---`);
  lines.push(script.summary);
  lines.push("");
  lines.push(`--- Anchor range ---`);
  lines.push(`Floor:   ${formatSalary(script.anchorRange.low)}`);
  lines.push(`Ask:     ${formatSalary(script.anchorRange.mid)}`);
  lines.push(`Stretch: ${formatSalary(script.anchorRange.high)} (open with this)`);
  lines.push("");
  lines.push(`--- Counter-offer email ---`);
  lines.push(`Subject: ${script.email.subject}`);
  lines.push("");
  lines.push(script.email.body);
  lines.push("");
  lines.push(`--- Talking points ---`);
  script.talkingPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("");
  lines.push(`--- Objection responses ---`);
  script.objectionResponses.forEach((o) => {
    lines.push(`Q: ${o.objection}`);
    lines.push(`A: ${o.response}`);
    lines.push("");
  });
  if (script.nonSalaryLevers.length > 0) {
    lines.push(`--- Non-salary levers ---`);
    script.nonSalaryLevers.forEach((l) => {
      lines.push(`• ${l.label}`);
      lines.push(`  ${l.script}`);
      lines.push("");
    });
  }
  lines.push(`--- Role-play Q&A ---`);
  script.rolePlayQa.forEach((q) => {
    lines.push(`Q: ${q.question}`);
    lines.push(`A: ${q.answer}`);
    lines.push("");
  });
  lines.push(`--- Benefits checklist ---`);
  script.benefitsChecklist.forEach((c) => lines.push(`☐ ${c}`));
  lines.push("");
  lines.push(`=== End ===`);
  return lines.join("\n");
}

/** Render the script as CSV (one row per objection + talking point). */
export function renderScriptCsv(script: NegotiationScript): string {
  const lines = ["section,item,detail"];
  lines.push(`summary,scenario,${SCENARIO_LABELS[script.scenario]}`);
  lines.push(`summary,tone,${TONE_LABELS[script.tone]}`);
  lines.push(`summary,target,${script.anchorRange.mid}`);
  lines.push(`summary,floor,${script.anchorRange.low}`);
  lines.push(`summary,stretch,${script.anchorRange.high}`);
  lines.push(`summary,confidence,${script.confidence}`);
  lines.push(escapeCsv("email", "subject", script.email.subject));
  lines.push(escapeCsv("email", "body", script.email.body));
  script.talkingPoints.forEach((p, i) => lines.push(escapeCsv("talking-point", String(i + 1), p)));
  script.objectionResponses.forEach((o) => {
    lines.push(escapeCsv("objection", o.key, `${o.objection} || ${o.response}`));
  });
  script.nonSalaryLevers.forEach((l) => {
    lines.push(escapeCsv("non-salary-lever", l.key, l.script));
  });
  return lines.join("\n");
}

function escapeCsv(...fields: string[]): string {
  return fields.map((f) => {
    const s = String(f ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(",");
}

/** Build an LLM prompt for optional BYO-key enhancement. */
export function buildLlmPrompt(input: NegotiationInput, script: NegotiationScript): string {
  return [
    `You are a senior career coach and salary negotiation expert.`,
    ``,
    `Scenario: ${SCENARIO_LABELS[input.scenario]}`,
    `Tone: ${TONE_LABELS[input.tone]}`,
    `Role: ${normalizeText(input.role) || "(unspecified)"}`,
    `Company: ${normalizeText(input.companyName) || "(unspecified)"}`,
    `Hiring manager: ${normalizeText(input.hiringManager) || "(unknown)"}`,
    `Location: ${normalizeText(input.location) || "(unspecified)"}`,
    `Current salary: ${formatSalary(input.currentSalary)}`,
    `Existing offer: ${formatSalary(input.offerSalary)}`,
    `Target salary: ${formatSalary(input.targetSalary)}`,
    `Leverage: ${input.leverage.map((l) => LEVERAGE_LABELS[l]).join(", ") || "(none)"}`,
    `Non-salary levers requested: ${input.levers.map((l) => NON_SALARY_LEVER_LABELS[l]).join(", ") || "(none)"}`,
    `Extra context: ${normalizeText(input.customLeverageNote) || "(none)"}`,
    ``,
    `Here is the generated script so far:`,
    `---`,
    `${renderScriptText(script)}`,
    `---`,
    ``,
    `Please refine the email body and talking points. Make the language more natural,`,
    `fix any awkward phrasing, add one piece of practical advice I'm missing, and`,
    `flag anything in my input that seems risky (unrealistic anchor, weak leverage,`,
    `tone mismatch with scenario). Keep your output under 400 words.`,
  ].join("\n");
}

/** Trim + normalize LLM output before display. */
export function renderLlmResult(s: string): string {
  return (s || "").trim();
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

export function buildShareUrl(input: NegotiationInput): string {
  const params = new URLSearchParams();
  params.set("scenario", input.scenario);
  params.set("tone", input.tone);
  if (input.role) params.set("role", input.role);
  if (input.companyName) params.set("company", input.companyName);
  if (input.hiringManager) params.set("mgr", input.hiringManager);
  if (input.currentSalary) params.set("current", String(input.currentSalary));
  if (input.offerSalary) params.set("offer", String(input.offerSalary));
  if (input.targetSalary) params.set("target", String(input.targetSalary));
  if (input.location) params.set("loc", input.location);
  if (input.leverage.length > 0) params.set("lev", input.leverage.join(","));
  if (input.levers.length > 0) params.set("nlev", input.levers.join(","));
  if (input.customLeverageNote) params.set("note", input.customLeverageNote);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<NegotiationInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<NegotiationInput> = {};

  const scenario = params.get("scenario");
  if (scenario === "initial-ask" || scenario === "counter-offer" || scenario === "final-offer") {
    out.scenario = scenario;
  }
  const tone = params.get("tone");
  if (tone === "confident" || tone === "collaborative") {
    out.tone = tone;
  }
  if (params.get("role")) out.role = params.get("role")!;
  if (params.get("company")) out.companyName = params.get("company")!;
  if (params.get("mgr")) out.hiringManager = params.get("mgr")!;
  if (params.get("current")) out.currentSalary = Number(params.get("current")) || null;
  if (params.get("offer")) out.offerSalary = Number(params.get("offer")) || null;
  if (params.get("target")) out.targetSalary = Number(params.get("target")) || 0;
  if (params.get("loc")) out.location = params.get("loc")!;

  const validLev = Object.keys(LEVERAGE_LABELS) as LeverageKey[];
  const levStr = params.get("lev");
  if (levStr) {
    out.leverage = levStr.split(",").filter((l) => validLev.includes(l as LeverageKey)) as LeverageKey[];
  }
  const validNlev = Object.keys(NON_SALARY_LEVER_LABELS) as NonSalaryLeverKey[];
  const nlevStr = params.get("nlev");
  if (nlevStr) {
    out.levers = nlevStr.split(",").filter((l) => validNlev.includes(l as NonSalaryLeverKey)) as NonSalaryLeverKey[];
  }
  if (params.get("note")) out.customLeverageNote = params.get("note")!;
  return out;
}
