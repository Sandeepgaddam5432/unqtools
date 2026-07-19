/**
 * AI Interview Question Generator — pure logic.
 *
 * Pull role-specific interview questions from a built-in library covering
 * 5 roles × 4 categories. Each question ships with a model answer,
 * follow-up probes, red-flag notes, and a 5-criteria scoring rubric.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type Role =
  | "developer"
  | "designer"
  | "pm"
  | "sales"
  | "marketing";

export type Category =
  | "behavioral"
  | "technical"
  | "situational"
  | "culture-fit";

export type Seniority = "junior" | "mid" | "senior" | "lead";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface RubricItem {
  criterion: string;       // e.g., "communication"
  weight: number;          // 0-1, all weights sum to 1
  level0: string;          // what 0 looks like
  level5: string;          // what 5 looks like
}

export interface Question {
  id: string;
  role: Role;
  category: Category;
  difficulty: Difficulty;
  text: string;
  tags: string[];
  modelAnswer: string;
  followUps: string[];
  redFlags: string[];
  rubric: RubricItem[];
  seniority: Seniority[];
}

export interface GradedAnswer {
  questionId: string;
  answer: string;
  score: number;            // 0-100
  wordCount: number;
  hasStar: boolean;         // detected STAR pattern
  keywordHits: string[];
  feedback: string[];
  rubricScores: Array<{ criterion: string; score: number; comment: string }>;
}

export interface QuestionStats {
  role: Role;
  byCategory: Record<Category, number>;
  total: number;
  avgDifficulty: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-interview:history";
export const BANKS_KEY = "unqtools:ai-interview:banks";
export const HISTORY_MAX = 20;

export const ROLE_LABELS: Record<Role, string> = {
  developer: "Software Developer",
  designer: "UX/UI Designer",
  pm: "Product Manager",
  sales: "Sales",
  marketing: "Marketing",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  situational: "Situational",
  "culture-fit": "Culture Fit",
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / Staff",
};

export const ROLE_PRESETS: string[] = [
  "frontend", "backend", "fullstack", "mobile",
  "ux-researcher", "visual-designer",
  "growth-pm", "platform-pm",
  "ae", "sdr", "account-exec",
  "content-marketer", "growth-marketer", "demand-gen",
];

// Default rubric (shared by most questions; can be overridden)
const DEFAULT_RUBRIC: RubricItem[] = [
  {
    criterion: "communication",
    weight: 0.2,
    level0: "Rambling, unclear, no structure.",
    level5: "Crisp, structured, easy to follow.",
  },
  {
    criterion: "depth",
    weight: 0.25,
    level0: "Surface-level; no trade-offs considered.",
    level5: "Deep; explores trade-offs, alternatives, and edge cases.",
  },
  {
    criterion: "structure",
    weight: 0.2,
    level0: "No clear beginning, middle, end.",
    level5: "STAR format (behavioral) or clear framework (technical).",
  },
  {
    criterion: "evidence",
    weight: 0.2,
    level0: "Generic claims with no examples.",
    level5: "Specific past examples with quantified outcomes.",
  },
  {
    criterion: "role-fit",
    weight: 0.15,
    level0: "No sign of the role's core skills.",
    level5: "Strong signal of the role's core skills and seniority.",
  },
];

// ---------- Question library ----------
//
// 5 roles × 4 categories × 3+ questions = 60+ questions. Each role has at
// least 12 questions (3 per category), guaranteeing "10+ per role".

function q(
  role: Role,
  category: Category,
  difficulty: Difficulty,
  seniority: Seniority[],
  text: string,
  tags: string[],
  modelAnswer: string,
  followUps: string[],
  redFlags: string[],
  rubric: RubricItem[] = DEFAULT_RUBRIC,
): Question {
  // Use a global counter so every question id is unique even when two
  // questions share the same 24-char text prefix.
  questionCounter += 1;
  const id = `${role}-${category}-q${questionCounter}`;
  return {
    id, role, category, difficulty, seniority,
    text, tags, modelAnswer, followUps, redFlags, rubric,
  };
}

let questionCounter = 0;

const LIBRARY: Question[] = [
  // ===================== DEVELOPER =====================
  q("developer", "behavioral", 2, ["junior", "mid", "senior"],
    "Tell me about a time you disagreed with a teammate on a technical approach.",
    ["conflict", "collaboration", "communication"],
    "I disagreed with a teammate about using GraphQL vs REST for a new API. I proposed we time-box a spike of both, write down the trade-offs (schema flexibility, tooling, learning curve), and present them together. We ended up choosing REST because the team's existing infra was set up for it. I learned that being right matters less than arriving at the decision together.",
    ["What would you have done if the spike didn't settle it?", "How did you make sure your teammate felt heard?", "What trade-offs did you weigh?"],
    ["Made it personal rather than about the work", "Couldn't articulate the trade-offs", "No follow-through on the decision"]),
  q("developer", "behavioral", 3, ["mid", "senior", "lead"],
    "Describe a production incident you were part of. What was your role and what did you change afterward?",
    ["incident", "post-mortem", "ownership"],
    "We had a payment outage caused by a missing index on a join after a migration. I was on-call, rolled back the migration, and added the index. The next day I wrote a post-mortem with the timeline, added a migration test that checks for missing indexes, and we adopted a checklist for schema changes. Three months later we caught a similar issue in CI.",
    ["What did the post-mortem blame — people or systems?", "How did you communicate with stakeholders during the outage?", "What would you do differently next time?"],
    ["Blamed a specific person", "No systemic fix proposed", "Took sole credit for the response"]),
  q("developer", "behavioral", 2, ["junior", "mid"],
    "Tell me about a project you're proud of and why.",
    ["motivation", "ownership", "craft"],
    "I built an internal CLI that automated a tedious report generation task. It saved the team ~4 hours per week, and I open-sourced a generic version. I'm proud because I noticed the pain point myself, validated with the team, and shipped something people actually use.",
    ["What did you learn from open-sourcing it?", "How did you decide what to generalize?", "What's the maintenance story?"],
    ["Chose a project with no measurable impact", "Took full credit when it was a team effort", "No reflection on what they learned"]),
  q("developer", "technical", 3, ["mid", "senior", "lead"],
    "Design a rate limiter for a public API. Walk me through your approach.",
    ["system-design", "rate-limiting", "scalability"],
    "I'd start by clarifying the limits (per-user vs global, RPS vs concurrent), then pick a strategy: token bucket for burst tolerance, sliding window for stricter limits. Storage: in-memory for single-instance, Redis for distributed with atomic Lua scripts. I'd return 429 with Retry-After, expose X-RateLimit headers, and add monitoring. Trade-off: fixed window is simpler but allows bursts at boundaries; token bucket handles bursts but needs state per key.",
    ["What if Redis is down?", "How do you handle hot keys?", "How would you test this at scale?"],
    ["Didn't ask clarifying questions", "Picked one strategy without trade-offs", "No mention of failure modes"]),
  q("developer", "technical", 2, ["junior", "mid"],
    "Explain how a hash map works and what happens during a resize.",
    ["data-structures", "hashing", "complexity"],
    "A hash map stores key-value pairs in an array, using a hash function to compute the index. Collisions are handled by chaining (linked list per bucket) or open addressing (probe for the next free slot). When the load factor crosses a threshold (often 0.75), the map resizes — typically doubles the array — and rehashes all entries. Resize is O(n) amortized but a single resize is expensive, which is why you size maps upfront when you know the count.",
    ["What's the worst-case time complexity and when does it happen?", "How would you implement a consistent hash?", "When would you avoid a hash map?"],
    ["Conflated hash function with hash map", "No mention of collisions", "Couldn't articulate resize cost"]),
  q("developer", "technical", 4, ["senior", "lead"],
    "How would you design a system to handle 1M concurrent WebSocket connections on a single server?",
    ["performance", "concurrency", "scaling"],
    "The main constraint is memory: 1M connections × ~50KB per connection = ~50GB just for buffers. Use io_uring (Linux) or epoll with non-blocking I/O, share a small thread pool, and use a per-CPU event loop. Switch to per-connection state machines instead of threads. Use SO_REUSEPORT for kernel-level load balancing across worker processes. Consider message framing and back-pressure. If true 1M isn't feasible, shard across multiple servers behind a sticky-session load balancer.",
    ["How would you handle back-pressure?", "What monitoring would you add?", "How does this change for mobile clients?"],
    ["Didn't address the memory math", "Suggested one thread per connection", "No mention of kernel primitives"]),
  q("developer", "situational", 2, ["junior", "mid", "senior"],
    "A junior engineer asks you to review a PR that introduces a clear anti-pattern. They're excited about it. How do you respond?",
    ["mentorship", "code-review", "empathy"],
    "I'd acknowledge what they did well first — they shipped something and asked for review. Then I'd ask questions rather than dictate: 'What problem were you solving here? Have you considered X?' I'd link to a resource explaining the anti-pattern, and offer to pair on the refactor. The goal is for them to learn the trade-off, not just revert. I'd also reflect on whether our docs/onboarding should have prevented it.",
    ["What if they push back?", "When would you block the PR vs approve-with-comments?", "How do you keep the team from repeating the pattern?"],
    ["Would humiliate them publicly", "Would just merge it to avoid conflict", "No mentorship instinct"]),
  q("developer", "situational", 3, ["mid", "senior", "lead"],
    "Product wants to ship a feature in two weeks; engineering estimates six. How do you handle it?",
    ["estimation", "negotiation", "stakeholders"],
    "I'd start by understanding the 'why' behind the deadline — is it a launch event, a customer commitment, a competitive move? Then I'd break the feature into MVP and follow-on slices. Often 80% of the value is in 30% of the work. I'd propose shipping the MVP in two weeks with explicit trade-offs documented, and sequence the rest. If even the MVP doesn't fit, I'd negotiate scope or resources with data — never just say 'no' or silently overpromise.",
    ["What if the deadline is non-negotiable?", "How do you avoid this happening again?", "What if your team disagrees on the estimate?"],
    ["Said they'd just work overtime", "Blamed product for being unreasonable", "No attempt to find middle ground"]),
  q("developer", "culture-fit", 1, ["junior", "mid", "senior", "lead"],
    "What does a healthy engineering culture look like to you?",
    ["culture", "values", "team"],
    "A healthy engineering culture has psychological safety (people can disagree, ask questions, and admit mistakes), high trust (reviews are about learning not policing), clear ownership (people know what they're responsible for), and a bias to ship (working software over perfect software). Documentation is valued. On-call is humane. Leaders model the behaviors they expect.",
    ["What's the opposite — what's an unhealthy culture?", "How do you contribute to culture as an IC?", "Have you ever changed a team's culture?"],
    ["Focused only on perks", "Blamed previous employers", "No concrete examples"]),
  q("developer", "culture-fit", 2, ["mid", "senior", "lead"],
    "How do you stay current with technology, and how do you decide what to adopt at work?",
    ["learning", "judgment", "trends"],
    "I read a few high-signal newsletters (e.g., Hacker News filter, a couple of curated lists), follow specific authors on areas I care about, and try small side projects. At work, I distinguish 'interesting' from 'worth adopting' by asking: does it solve a problem we actually have? What's the migration cost? Is there a community? I'd never push a new tool onto a team without a real pain point and a spike.",
    ["Tell me about a time you adopted something that didn't work out", "How do you avoid hype-driven development?", "How do you help teammates who don't have time to learn?"],
    ["Adopts every new framework", "Hasn't read anything recently", "Pushes personal preferences without team buy-in"]),
  q("developer", "behavioral", 3, ["mid", "senior"],
    "Tell me about a time you had to learn a new technology quickly to ship something.",
    ["learning", "adaptability", "ownership"],
    "We needed to integrate with a partner's gRPC API and I'd never used gRPC. I time-boxed two days to spike: read the docs, wrote a minimal client, hit our test endpoint, then proposed the integration design to the team. I documented the gotchas (proto version conflicts, retries) so the next person wouldn't repeat my learning curve.",
    ["How did you avoid rabbit holes?", "What did you do when you got stuck?", "How did you decide gRPC was the right call?"],
    ["Spent weeks in tutorial hell", "No documentation left behind", "Didn't validate the approach before implementing"]),
  q("developer", "technical", 2, ["junior", "mid"],
    "What's the difference between SQL and NoSQL, and when would you pick each?",
    ["databases", "trade-offs", "data-modeling"],
    "SQL databases enforce a schema, support transactions and joins, and shine for relational data with consistent structure. NoSQL trades schema flexibility and horizontal scaling for weaker consistency models — document stores for nested data, key-value for simple lookups, column-family for time-series, graph for relationships. I'd pick SQL by default for transactional systems with relational data, NoSQL when the data model fits one of its strengths and I don't need cross-document transactions.",
    ["What does 'eventually consistent' mean in practice?", "When would you use both?", "How do you migrate from one to the other?"],
    ["Said NoSQL is always faster", "Couldn't name NoSQL subtypes", "No awareness of CAP theorem implications"]),

  // ===================== DESIGNER =====================
  q("designer", "behavioral", 2, ["junior", "mid", "senior"],
    "Walk me through a project where the final design was very different from your initial concept.",
    ["iteration", "process", "humility"],
    "I started a dashboard redesign with a dense data-rich layout. After usability testing, users were overwhelmed. I iterated to a progressive-disclosure design: summary on top, drill-down on demand. The final shipped version was 40% less dense and task completion improved 25%. The lesson: my first instinct was about showing everything I'd learned; users needed the opposite.",
    ["How did you test early concepts?", "How did you decide what to cut?", "How do you avoid over-correcting?"],
    ["Defended the original concept", "No user testing mentioned", "Iteration was driven by stakeholder feedback only"]),
  q("designer", "behavioral", 3, ["mid", "senior", "lead"],
    "Tell me about a time you had to defend a design decision to a senior stakeholder who disagreed.",
    ["advocacy", "stakeholders", "evidence"],
    "A VP wanted a prominent upsell modal on the dashboard. I'd run a quick test showing it increased short-term clicks but damaged trust and reduced 30-day retention. I presented the data, framed the trade-off in business terms (LTV vs immediate revenue), and proposed an alternative placement that captured most of the upside with less risk. They agreed to A/B test both. The alternative won.",
    ["What if you didn't have data?", "How do you handle a stakeholder who overrides you anyway?", "How do you keep the relationship strong after a disagreement?"],
    ["Got defensive or personal", "Caved immediately", "No attempt to find a middle path"]),
  q("designer", "behavioral", 2, ["junior", "mid"],
    "Describe a time when user research surprised you.",
    ["research", "empathy", "discovery"],
    "We assumed power users wanted more keyboard shortcuts. Research showed they actually wanted fewer, more discoverable actions — they didn't mind the mouse, they minded hunting. We redesigned the toolbar with progressive disclosure and added a command palette. Power-user satisfaction went up, not down. The surprise was that 'power user' didn't mean 'keyboard junkie' — it meant 'wants to move fast without memorizing'.",
    ["How did you recruit participants?", "What would you have done without research?", "How do you avoid leading questions?"],
    ["Didn't actually talk to users", "Confirmation bias in interpretation", "No mention of methodology"]),
  q("designer", "technical", 3, ["mid", "senior"],
    "How do you approach designing for accessibility from the start of a project?",
    ["accessibility", "wcag", "inclusive-design"],
    "I start with semantic HTML — buttons for actions, links for navigation, proper heading hierarchy. I check color contrast at 4.5:1 for body text, design focus states explicitly (never rely on browser defaults), and ensure every interactive element is keyboard-reachable. I write alt text as I design, not as an afterthought. I test with a screen reader (VoiceOver/NVDA) before handoff. For complex components, I reference ARIA patterns from the APG.",
    ["How do you handle a design that's hard to make accessible?", "How do you convince stakeholders to invest in accessibility?", "What WCAG level do you target and why?"],
    ["Treats accessibility as a final QA step", "Doesn't know WCAG levels", "Only thinks about color blindness"]),
  q("designer", "technical", 2, ["junior", "mid"],
    "Walk me through your design handoff process to engineering.",
    ["handoff", "collaboration", "specifications"],
    "I do handoff in three parts. First, a walkthrough meeting where I demo the prototype and explain the intent, not just the pixels. Second, a spec doc with states (default, hover, focus, active, disabled, loading, empty, error), responsive breakpoints, and motion notes. Third, I stay available during implementation for questions and do a visual QA pass before launch. The handoff doc lives next to the code, not in a separate tool engineers never check.",
    ["How do you handle engineers pushing back on feasibility?", "What do you do when the shipped version differs from your design?", "How do you keep specs in sync as the design evolves?"],
    ["Throws Figma over the wall", "No mention of edge cases", "Doesn't engage during implementation"]),
  q("designer", "technical", 4, ["senior", "lead"],
    "How would you design a design system that scales across multiple product teams with different needs?",
    ["design-systems", "governance", "scaling"],
    "I'd separate foundations (tokens, primitives) from patterns (compositions) from templates (full screens). Foundations are owned centrally and rarely change. Patterns are co-owned: the central team provides defaults, product teams can fork with a documented reason. Templates are fully team-owned. Governance is a monthly review with representatives from each team. The system ships as code (not just Figma) so adoption is via npm, not copy-paste. The metric is 'time to ship a compliant screen', not 'number of components'.",
    ["How do you handle deprecations?", "What if a team's needs genuinely diverge?", "How do you measure success?"],
    ["Designs only for one team's needs", "No governance model", "Confuses a component library with a design system"]),
  q("designer", "situational", 2, ["junior", "mid", "senior"],
    "Engineering says your design is too expensive to build. What do you do?",
    ["collaboration", "trade-offs", "pragmatism"],
    "First, I ask which specific parts are expensive — usually it's a few things, not all of it. Then I propose cheaper alternatives for those parts and ask engineering to estimate. Often we find a 90%-as-good version at 30% of the effort. If the expensive part is core to the value, I make the case with user data. I never frame it as 'design vs engineering' — we're both trying to ship the best thing for users within constraints.",
    ["How do you avoid this happening late in the process?", "What if you genuinely think the cheaper version is worse for users?", "How do you build trust with engineering over time?"],
    ["Refuses to compromise", "Hands it back to engineering without engaging", "Doesn't ask what specifically is expensive"]),
  q("designer", "situational", 3, ["mid", "senior", "lead"],
    "You have two competing user research findings that point in opposite directions. How do you decide?",
    ["research", "synthesis", "judgment"],
    "First, I'd check the methodology — sample size, recruitment, whether the questions were leading. Often the conflict is illusory: different user segments, different contexts. I'd segment the findings and see if each applies to a different persona or scenario. If they genuinely conflict for the same user, I'd run a quick A/B test to break the tie. The goal isn't to pick the 'right' research — it's to understand why they differ and make a defensible decision.",
    ["What if you can't run an A/B test?", "How do you communicate uncertainty to stakeholders?", "Have you ever made the wrong call?"],
    ["Picks whichever confirms their prior", "Ignores one finding entirely", "No methodology check"]),
  q("designer", "culture-fit", 1, ["junior", "mid", "senior", "lead"],
    "What role does design play in a healthy product team?",
    ["culture", "collaboration", "values"],
    "Design is a partner in 'what to build', not just 'how it looks'. Designers should be in the room when problems are framed, not just when solutions need to be visualized. A healthy team treats design as a discipline with its own rigor (research, critique, iteration) the way engineering has its own (architecture, code review, testing). Designers advocate for users; engineers advocate for feasibility; PMs advocate for the business — and all three trust each other.",
    ["How do you handle teams that treat design as a service?", "How do you give and receive critique?", "What's a sign of an unhealthy design culture?"],
    ["Frames design as 'making things pretty'", "Doesn't mention users", "No collaboration model"]),
  q("designer", "culture-fit", 2, ["mid", "senior"],
    "How do you give critique that actually helps, rather than just opinion?",
    ["critique", "communication", "craft"],
    "I distinguish critique from feedback. Feedback is 'I like/don't like this' — useless. Critique is specific, references the design's goals, and offers alternatives. I start with what's working (so the designer doesn't get defensive), then ask questions about intent, then suggest alternatives with reasons. I never say 'this is wrong' — I say 'if the goal is X, this might not get us there because Y'. Critique is a skill both parties practice.",
    ["How do you handle a designer who gets defensive?", "How do you receive critique yourself?", "What's the difference between critique and review?"],
    ["Critique is vague ('make it pop')", "No reference to user goals", "Only points out problems, never offers alternatives"]),
  q("designer", "behavioral", 3, ["mid", "senior"],
    "Tell me about a design decision you made that you later regretted.",
    ["reflection", "growth", "humility"],
    "I redesigned an onboarding flow to be 'simpler' by removing a step where users set preferences. Six months later, retention was down — the preferences weren't just configuration, they were a moment of investment that increased commitment. I rolled back the step, but redesigned it to be optional. The lesson: 'simple' isn't always 'better'; sometimes friction creates value. I now map each step to a hypothesis before cutting.",
    ["How did you measure the impact?", "How did you communicate the rollback?", "How has this changed your process?"],
    ["Can't think of one (or pretends they've never been wrong)", "Blames stakeholders", "No reflection on what they learned"]),
  q("designer", "technical", 2, ["junior", "mid"],
    "How do you approach responsive design for a complex dashboard?",
    ["responsive", "data-density", "layout"],
    "I start with the smallest screen and design mobile-first — it forces prioritization. For a dashboard, I identify the top 3 things a user needs at a glance and surface those on mobile, with everything else a tap away. For tablet and desktop, I add columns and density progressively, using CSS grid for the layout. I avoid fixed pixel widths; everything is fluid. I test on real devices, not just resizing the browser. The biggest mistake is designing desktop-first and trying to cram it onto mobile.",
    ["How do you handle data tables on mobile?", "What breakpoints do you use?", "How do you test across devices?"],
    ["Designs desktop-first", "No mention of prioritization", "Uses fixed widths"]),

  // ===================== PM =====================
  q("pm", "behavioral", 2, ["mid", "senior", "lead"],
    "Tell me about a feature you shipped that didn't achieve its goals.",
    ["outcomes", "learning", "ownership"],
    "We launched a referral program expecting 20% of new signups to come from referrals. We got 4%. Post-launch analysis showed the referral incentive wasn't aligned with the referrer's motivation — they wanted to help friends, not earn credits. We pivoted to a 'give $10, get $10' model and hit 18%. The bigger lesson: I'd assumed the incentive mattered; I should have interviewed referrers before scaling.",
    ["What would you do differently next time?", "How did you communicate the miss to leadership?", "How do you decide when to iterate vs kill a feature?"],
    ["Blamed the market or execution", "No measurable goal stated upfront", "No reflection on the root cause"]),
  q("pm", "behavioral", 3, ["senior", "lead"],
    "Describe a time you had to make a decision without enough data.",
    ["judgment", "decision-making", "ambiguity"],
    "We had to choose between two feature bets for a quarter-end launch. Both had weak data. I framed it as a portfolio decision: one was a high-confidence, low-upside incremental improvement; the other was a lower-confidence, high-upside bet. We shipped the incremental one to free the team to also spike the bet. If the spike showed promise, we'd commit next quarter; if not, we hadn't lost much. The framing mattered more than the answer.",
    ["What would have changed your decision?", "How do you avoid analysis paralysis?", "When is it OK to defer the decision?"],
    ["Made a gut call with no framework", "Waited for data that never came", "Couldn't articulate the trade-off"]),
  q("pm", "behavioral", 2, ["mid", "senior"],
    "Tell me about a time you had to say 'no' to a stakeholder.",
    ["prioritization", "stakeholders", "communication"],
    "A sales-led prospect wanted a custom integration as a precondition for a large deal. Engineering estimated 6 weeks and significant ongoing maintenance. I said no to the custom integration, but yes to a more generic version that would serve this prospect and 3 others in pipeline. Sales closed the deal with the generic version, and we shipped 2 more deals off the same work. The 'no' was to the specific ask, not the underlying need.",
    ["How did sales react?", "When is the right time to say yes to a one-off?", "How do you build a culture where 'no' is acceptable?"],
    ["Said yes to everything", "Refused with no alternative", "No mention of underlying need"]),
  q("pm", "technical", 3, ["mid", "senior", "lead"],
    "How do you decide between building, buying, and integrating a third-party for a new capability?",
    ["build-vs-buy", "trade-offs", "strategy"],
    "I frame it around three questions: (1) Is this a strategic differentiator? If yes, build — you want control. If no, buy. (2) What's the TCO over 3 years, including maintenance and migration? (3) What's the switching cost if the vendor raises prices or shuts down? For non-strategic capabilities (auth, payments, analytics), I lean buy. For things that touch the core value prop, I lean build. The trap is to compare only upfront cost — ongoing cost and lock-in matter more.",
    ["When have you gotten this wrong?", "How do you evaluate vendor risk?", "How do you handle a build/buy split decision across the team?"],
    ["Always buys or always builds", "No mention of switching cost", "Doesn't consider strategic differentiation"]),
  q("pm", "technical", 2, ["junior", "mid"],
    "Walk me through how you'd write a spec for a new feature.",
    ["specifications", "communication", "process"],
    "A good spec has: problem statement (what user pain are we solving, with evidence), goals and non-goals (what's explicitly out of scope), success metrics (how we'll know it worked), user stories or scenarios, open questions, and a rollout plan. I write the problem and metrics first, share with the team for input, then fill in the design. The spec is a living document — it changes as we learn during implementation, with dated revisions. I avoid specs that read like solutions in search of problems.",
    ["How long should a spec be?", "How do you handle specs that change during implementation?", "What's in your spec template that others miss?"],
    ["Skips the problem statement", "No success metrics", "Spec is a feature list, not a problem framing"]),
  q("pm", "technical", 4, ["senior", "lead"],
    "How do you balance technical debt against new feature work?",
    ["technical-debt", "trade-offs", "long-term"],
    "I treat tech debt as a portfolio. Some debt is intentional and strategic (we shipped fast to learn); some is unintentional and accrues interest. I work with engineering to surface debt quarterly and tag it: 'ship-blocker' (must fix), 'velocity-drainer' (worth fixing), 'annoying-but-fine' (leave it). I reserve ~20% of capacity for debt by default, more if a ship-blocker is looming. The key is making debt visible — most teams underinvest because debt is invisible until something breaks.",
    ["How do you explain debt investment to leadership?", "When do you choose to take on new debt?", "How do you measure the cost of debt?"],
    ["Always prioritizes new features", "Treats all debt equally", "No framework for prioritization"]),
  q("pm", "situational", 2, ["mid", "senior", "lead"],
    "Engineering says a feature will take 8 weeks; you need it in 4. How do you handle it?",
    ["estimation", "negotiation", "scope"],
    "First, I'd understand the estimate breakdown — what specifically takes the time? Often 30% of the work delivers 70% of the value. I'd work with engineering and design to slice the feature into a 4-week MVP that ships the core user value, with the rest sequenced afterward. If even the MVP doesn't fit, I'd re-examine the deadline — what's driving it? If it's a real commitment (event, customer), I'd negotiate scope or add resources. I'd never just say 'do it faster'.",
    ["What if engineering is sandbagging?", "What if the deadline is arbitrary?", "How do you repair trust if you push too hard?"],
    ["Demands the team work overtime", "Cuts quality to hit the date", "No attempt to find middle ground"]),
  q("pm", "situational", 3, ["senior", "lead"],
    "Two of your biggest customers want contradictory features. How do you handle it?",
    ["customers", "prioritization", "strategy"],
    "I'd start by understanding the underlying needs — customers often ask for solutions, not needs. If the needs genuinely contradict (rare), I'd map each to a segment and check which segment aligns with our strategy. If both matter, I'd look for a configurable approach. If forced to choose, I'd pick the one that advances the product vision and have a direct conversation with the other customer — they may accept a workaround if they understand the reasoning. The trap is to try to please both and ship a compromised thing neither loves.",
    ["How do you have that conversation with the losing customer?", "When is configurability the wrong answer?", "How do you avoid being pulled around by a few loud customers?"],
    ["Tries to build both and compromise", "Picks whichever customer is louder", "No mention of underlying needs"]),
  q("pm", "culture-fit", 1, ["mid", "senior", "lead"],
    "What's the most important thing a PM does?",
    ["role", "values", "judgment"],
    "The most important thing a PM does is decide what not to build. Everything else — discovery, specs, stakeholder management — serves that. A PM who can't say no ends up shipping a bloated product that does nothing well. The second most important is to make sure the team understands why the work matters — context is what turns a list of tasks into a mission.",
    ["What's the second most important?", "How do you avoid becoming a project manager?", "What's a sign of a weak PM?"],
    ["Says 'communication' or 'stakeholder management'", "No mention of prioritization", "Frames PM as 'the ideas person'"]),
  q("pm", "culture-fit", 2, ["senior", "lead"],
    "How do you build trust with an engineering team that's skeptical of PMs?",
    ["trust", "collaboration", "credibility"],
    "Trust comes from competence and respect. Competence: I learn enough about the tech to have informed conversations (not to dictate solutions). Respect: I treat engineering estimates as data, not negotiation. I bring problems, not solutions, and ask for their input. I shield them from stakeholder churn. I celebrate their work publicly. Over time, I make small promises and keep them. Trust is built in increments and lost in chunks — consistency is everything.",
    ["What if they're skeptical because of past PMs?", "How do you handle an engineering team that pushes back on everything?", "What's a trust-killing behavior to avoid?"],
    ["Tries to win them over with perks", "Dictates solutions", "Doesn't engage with the tech"]),
  q("pm", "behavioral", 3, ["senior", "lead"],
    "Tell me about a time you had to kill a project you'd invested in.",
    ["cancellation", "humility", "outcomes"],
    "We'd spent a quarter building a B2B feature for a segment that wasn't growing. Mid-way through, the data showed the segment was shrinking. I recommended we kill the project, salvage what we could into a more general feature, and reallocate the team. It was hard — I'd personally championed it. But the alternative was sunk-cost fallacy. Leadership respected the call and the team appreciated not being asked to polish a dead end. I now build 'kill criteria' into every project charter upfront.",
    ["How did the team react?", "What would have made you kill it earlier?", "How do you avoid this happening again?"],
    ["Defended the investment despite evidence", "No kill criteria upfront", "Blamed leadership for the original call"]),
  q("pm", "technical", 2, ["mid", "senior"],
    "How do you measure the success of a feature post-launch?",
    ["metrics", "outcomes", "measurement"],
    "I define success metrics before we build, tied to the problem we're solving. I distinguish adoption metrics (did people use it?) from outcome metrics (did it move the underlying number?). I look at leading indicators (usage in first week) and lagging indicators (retention at 90 days). I instrument the feature with events, set up a dashboard before launch, and schedule a review 2 weeks post-launch. If the metrics don't move, that's information — I either iterate or kill, but I never declare victory on adoption alone.",
    ["What's a vanity metric you avoid?", "How do you handle metrics that lag?", "When do you A/B test vs just ship?"],
    ["Equates adoption with success", "No baseline measurement", "Doesn't schedule a post-launch review"]),

  // ===================== SALES =====================
  q("sales", "behavioral", 2, ["junior", "mid", "senior"],
    "Tell me about a deal you lost. What did you learn?",
    ["loss", "learning", "humility"],
    "I lost a 6-figure deal because I assumed the economic buyer was the same as the technical champion. The champion loved it; the CFO killed it on cost. I'd never engaged the CFO directly. The lesson: I now map the buying committee upfront and confirm who signs. I built a stakeholder map template I use on every deal. The next quarter I closed two deals specifically because I caught a hidden stakeholder early.",
    ["How do you map a buying committee?", "When do you ask about budget?", "How do you re-engage a lost deal later?"],
    ["Blames the prospect or competitor pricing", "No process change after the loss", "Doesn't admit they could have done anything differently"]),
  q("sales", "behavioral", 3, ["mid", "senior", "lead"],
    "Describe a time you turned around an unhappy customer.",
    ["retention", "empathy", "ownership"],
    "A customer was 30 days from churning after a botched onboarding. I took over the account, scheduled a call without an agenda beyond 'I want to understand what went wrong', and listened for an hour. They felt abandoned post-signature. I built a recovery plan with weekly check-ins, got their stuck integration unblocked within a week, and personally trained their team. They renewed and became a reference customer. The lesson: most 'churn risk' is actually 'relationship debt' that compound effort can repay.",
    ["How do you balance this with new business?", "When is a customer not worth saving?", "How do you prevent the situation in the first place?"],
    ["Took the call but did nothing different", "Blamed the implementation team", "No systemic fix proposed"]),
  q("sales", "behavioral", 2, ["junior", "mid"],
    "Walk me through your process for a discovery call.",
    ["discovery", "process", "qualification"],
    "I prepare by researching the company and the contact — recent news, LinkedIn, their tech stack if visible. I open by setting the agenda and confirming time. I spend the first 25 minutes asking open questions about their current state, pain, and what they've tried — not pitching. I use a framework like SPIN or MEDDIC mentally to qualify. I summarize what I heard, propose next steps based on their needs (not a generic demo), and confirm who else should be in the next conversation. I send a follow-up email within 24 hours recapping.",
    ["How do you handle a prospect who wants to see the product immediately?", "What's a deal-breaker you've learned to spot?", "How do you avoid leading questions?"],
    ["Pitches in the first 5 minutes", "No framework mentioned", "No follow-up process"]),
  q("sales", "technical", 3, ["mid", "senior"],
    "How do you handle technical objections from a prospect's engineering team?",
    ["objections", "technical", "credibility"],
    "I treat engineering objections as legitimate, not hurdles. I listen, ask clarifying questions to understand the concern (often it's a proxy for something else — security review process, past bad experience with similar tools). I never bluff — if I don't know, I say so and bring in our solutions engineer. I prepare a one-pager with common concerns (security, integration, scaling) and references from similar companies. The goal isn't to win the argument; it's to make engineering comfortable enough to be a champion, not a blocker.",
    ["What if the engineering team is fundamentally opposed?", "How do you prep your solutions engineer?", "When do you walk away from a technical mismatch?"],
    ["Promises features engineering can't deliver", "Dismisses the objection", "Brings in solutions engineer too late"]),
  q("sales", "technical", 2, ["junior", "mid"],
    "How do you stay current on your product and the competitive landscape?",
    ["knowledge", "preparation", "competitors"],
    "I block 2 hours weekly for product updates — release notes, internal demos, sandbox time. I keep a competitive battle card that I update monthly with input from lost-deal analysis and win interviews. I subscribe to competitors' changelogs and follow their customers on LinkedIn. When a competitor launches something, I think about how to position, not panic. The goal isn't to memorize feature lists — it's to know our differentiation cold and how it maps to common prospect pains.",
    ["How do you handle a competitor feature you don't have?", "What's your process for win/loss interviews?", "How do you avoid badmouthing competitors?"],
    ["Doesn't keep up with product changes", "Only knows surface-level competitor info", "Badmouths competitors in calls"]),
  q("sales", "technical", 4, ["senior", "lead"],
    "Walk me through how you'd price a new enterprise deal with a complex use case.",
    ["pricing", "negotiation", "strategy"],
    "I'd start with value, not cost: what's the prospect's pain worth — time saved, revenue gained, risk reduced? That anchors the ceiling. I'd then map to our pricing model (per-seat, usage, flat) and structure a deal that scales with their success — lower upfront, higher as they see value. I'd negotiate on terms (multi-year, payment schedule) before discounting price. I'd never discount without getting something in return (longer term, case study, reference). I'd loop in finance and legal early. The goal is a deal both sides feel good about — one-sided deals churn.",
    ["How do you handle 'we need a discount to sign this quarter'?", "When do you walk away?", "How do you avoid training customers to negotiate hard?"],
    ["Discounts immediately", "No value-based framing", "Doesn't involve finance/legal early"]),
  q("sales", "situational", 2, ["junior", "mid", "senior"],
    "A prospect says your price is too high. How do you respond?",
    ["objections", "value", "negotiation"],
    "I acknowledge it without defensiveness — 'I hear you, let's make sure we're comparing apples to apples'. Then I ask clarifying questions: too high compared to what? What's the budget they had in mind? What value are they expecting? Often 'too high' means 'I haven't internalized the value' or 'I have a cheaper alternative I'm considering'. I re-anchor on outcomes (ROI calculation), explore scope reductions (fewer seats, lighter package), and only discuss discounting if the value is clear and they're ready to move. Discounting before the value is set trains them to negotiate.",
    ["What if they truly can't afford it?", "How do you handle 'we need this by end of quarter or we walk'?", "When do you say no to a discount?"],
    ["Discounts immediately", "Gets defensive", "No value re-anchoring"]),
  q("sales", "situational", 3, ["mid", "senior", "lead"],
    "You inherit a territory with a pipeline that's 30% of target. What's your first 30 days?",
    ["territory", "planning", "strategy"],
    "Week 1: audit the existing pipeline — which deals are real, which are stale. Categorize: accelerate (close in 30 days), nurture (60-90 days), kill (no real intent). Week 2: analyze the territory — which segments and personas have the highest close rate? Where's the white space? Week 3: build a focused plan — top 20 accounts, top 50 prospects, with specific plays. Week 4: execute and measure leading indicators (meetings booked, multi-threaded deals), not just closed-won. I'd set realistic expectations with leadership — you can't manufacture 70% of pipeline in a month, but you can build the engine that delivers it in two quarters.",
    ["How do you avoid being a 'new broom' that disrupts what's working?", "What leading indicators do you track?", "How do you handle inherited deals that the previous rep mishandled?"],
    ["Panics and dials for volume", "Doesn't audit existing pipeline", "No segment analysis"]),
  q("sales", "culture-fit", 1, ["junior", "mid", "senior", "lead"],
    "What's the difference between a good salesperson and a great one?",
    ["values", "craft", "judgment"],
    "Good salespeople hit quota by being responsive and organized. Great salespeople create value before the sale — they teach the prospect something, reframe the problem, and become a trusted advisor. Good sellers close; great sellers get introduced. Good sellers pitch; great sellers diagnose. The biggest tell: a great salesperson will tell you when their product isn't the right fit — they're playing for the long game, not the single deal.",
    ["How do you avoid the 'trusted advisor' trap where you give away too much?", "How do you handle pressure to close at all costs?", "What's a behavior you see in mediocre salespeople?"],
    ["Frames sales as a numbers game", "No mention of relationships", "Equates 'great' with 'highest quota'"]),
  q("sales", "culture-fit", 2, ["mid", "senior"],
    "How do you work with customer success to ensure renewals?",
    ["collaboration", "retention", "handoff"],
    "I treat the close as the start of the relationship, not the end. I do a structured handoff to CS: context on why they bought, the success criteria they care about, the stakeholders, the risks I see. I stay involved for the first 90 days — joining QBRs, helping with the first expansion conversation. I never 'throw it over the wall'. When CS flags an account at risk, I help — I have the original relationship. Renewals are won in the first 90 days, not the last 30.",
    ["What's in your handoff document?", "How do you handle a CS team that's under-resourced?", "When do you step back?"],
    ["Disappears after close", "No structured handoff", "Sees CS as separate"]),
  q("sales", "behavioral", 3, ["mid", "senior"],
    "Tell me about your largest deal. What made it possible?",
    ["enterprise", "process", "complex"],
    "My largest deal was a 7-figure enterprise contract. It took 9 months and involved 11 stakeholders. What made it possible: I mapped the buying committee early and confirmed the economic buyer; I built a champion in operations who did internal selling; I ran a paid pilot to de-risk the technical evaluation; I involved our exec sponsor for the final negotiation. The deal didn't close because I was persuasive — it closed because the prospect's team was internally aligned before the final ask. My job was to make that alignment easy.",
    ["How did you handle the slow periods?", "What would you do differently?", "How do you keep a champion engaged for 9 months?"],
    ["Takes sole credit", "No mention of champion-building", "No process — just 'relationship'"]),
  q("sales", "technical", 2, ["junior", "mid"],
    "How do you qualify a lead? Walk me through your framework.",
    ["qualification", "process", "framework"],
    "I use a qualification framework — BANT (Budget, Authority, Need, Timeline) or MEDDIC (Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion). For each lead, I'm honest about which boxes are checked. I don't pad my pipeline with deals that lack a real pain or budget — they consume time and never close. I qualify out as fast as I qualify in. The framework isn't bureaucracy — it's a way to be honest with myself about where a deal actually stands.",
    ["How do you handle a champion who can't get you to the economic buyer?", "When do you qualify out?", "What's the most common disqualifier?"],
    ["Doesn't use any framework", "Pads pipeline to look busy", "Never qualifies out"]),

  // ===================== MARKETING =====================
  q("marketing", "behavioral", 2, ["junior", "mid", "senior"],
    "Tell me about a campaign that didn't perform. What did you change?",
    ["campaigns", "learning", "iteration"],
    "We ran a paid social campaign targeting a persona we'd defined by job title. CTR was fine, but conversion was 0.3% vs our 2% benchmark. We dug in and found the job-title audience was too broad — it included people whose problems we didn't actually solve. We re-targeted based on behavior (visited specific content, engaged with our community) and conversion jumped to 1.8%. The lesson: job-title targeting is a starting point, not a strategy; behavior tells you what people actually care about.",
    ["How did you measure the original mistake?", "How do you avoid persona drift?", "What would have made you kill it sooner?"],
    ["Blames the channel or the creative", "No measurable hypothesis upfront", "Doesn't iterate — kills or scales"]),
  q("marketing", "behavioral", 3, ["mid", "senior", "lead"],
    "Describe a time you had to align sales and marketing on a campaign.",
    ["alignment", "stakeholders", "process"],
    "We were launching a new product line and sales wanted leads 'now', marketing wanted to nurture. I organized a joint planning session: I brought the campaign plan and target personas; sales brought their pipeline gaps and the objections they were hearing. We agreed on a definition of 'qualified' (MQL + intent signal), a SLA for follow-up (24 hours), and a weekly sync to review lead quality. The launch delivered 40% more pipeline than forecast and the relationship improved — alignment is built in process, not just meetings.",
    ["How do you handle a sales team that ignores MQLs?", "What's in your SLA?", "How do you measure alignment?"],
    ["Frame it as marketing vs sales", "No SLA or shared definition", "Threw leads over the wall"]),
  q("marketing", "behavioral", 2, ["junior", "mid"],
    "Walk me through how you'd launch a new product feature from a marketing perspective.",
    ["launch", "process", "go-to-market"],
    "I'd start with positioning — what problem does this solve, for whom, and why now? Then messaging — key benefits, proof points, FAQs. Then channels — owned (blog, email, in-app), earned (PR, analyst briefings), paid (search, social) — chosen based on where the audience is. Then a launch timeline with a soft launch (test with a segment), a GA launch, and a 30/60/90-day amplification plan. I'd define success metrics upfront (signups, pipeline, activation) and instrument them before launch. The most common mistake is treating launch day as the finish line when it's the starting line.",
    ["How do you handle a launch that underperforms?", "How do you coordinate with sales?", "What's your post-launch amplification playbook?"],
    ["Skips positioning", "No measurable goals", "Treats launch day as the end"]),
  q("marketing", "technical", 3, ["mid", "senior"],
    "How do you measure the impact of brand marketing?",
    ["brand", "measurement", "attribution"],
    "Brand is hard to measure but not impossible. I look at leading indicators: branded search volume (grows if brand awareness is rising), direct traffic, share of voice in industry conversations, and NPS. I look at lagging indicators: CAC over time (strong brand lowers CAC), win rate (recognized brands win more), and sales cycle length. I avoid vanity metrics (impressions, follower count) unless they tie to a downstream metric. Brand measurement is about trend lines, not single numbers — if branded search is climbing quarter over quarter, brand is working.",
    ["How do you attribute pipeline to brand?", "What's a brand metric you've stopped using?", "How do you justify brand investment to a skeptical CFO?"],
    ["Says brand can't be measured", "Uses only vanity metrics", "No mention of CAC impact"]),
  q("marketing", "technical", 2, ["junior", "mid"],
    "Walk me through how you'd set up attribution for a multi-channel campaign.",
    ["attribution", "analytics", "measurement"],
    "I'd start with the question I'm trying to answer — 'which channels drive pipeline' needs different attribution than 'which channels introduce prospects'. For pipeline, I'd use a multi-touch model (linear or position-based) since first-click and last-click both distort. I'd instrument UTM parameters consistently, set up conversion tracking in our CRM, and use a tool like Bizible or HubSpot to tie touches to revenue. I'd be honest about attribution's limits — it's a model, not a truth. I'd report confidence intervals, not false precision.",
    ["How do you handle offline channels?", "When do you use first-click vs last-click?", "What's an attribution mistake you've made?"],
    ["Uses only last-click", "No consistent UTMs", "Treats attribution as ground truth"]),
  q("marketing", "technical", 4, ["senior", "lead"],
    "How would you build a content engine that produces 4 high-quality pieces per week?",
    ["content", "operations", "scaling"],
    "I'd build it around three pillars. (1) Editorial calendar: themed quarters, monthly themes, weekly topics — created with input from sales, customer success, and product. (2) Production pipeline: briefs (PMM or SME), drafts (writer), edit (editor), SEO review, design, publish — with SLAs at each stage. (3) Distribution: each piece atomized into 5-10 social posts, an email, a sales enablement snippet. I'd hire a managing editor to run the calendar and a writer-pool for capacity. The mistake is treating content as a one-off creative act — it's a system. Measure output quality and pipeline influence, not just volume.",
    ["How do you maintain quality at volume?", "How do you handle SMEs who don't have time?", "What's your editorial review process?"],
    ["Treats content as ad-hoc", "No distribution plan", "Hires writers without editorial oversight"]),
  q("marketing", "situational", 2, ["mid", "senior", "lead"],
    "Your CMO wants to cut SEO budget to fund paid. How do you respond?",
    ["advocacy", "trade-offs", "data"],
    "I'd bring data, not opinion. SEO is a lagging investment — cutting it shows up 6-12 months later. I'd show the pipeline trend from SEO over the past year, the cost-per-lead vs paid, and the projected impact of cutting it. I'd ask what problem paid is supposed to solve — if it's short-term pipeline, paid might be right; if it's long-term efficiency, cutting SEO is short-sighted. I'd propose a middle path: reallocate 30% to test paid, keep 70% on SEO, measure both for a quarter, and decide with data. I'd never just push back without an alternative.",
    ["What if the CMO overrides you?", "How do you avoid being the 'SEO person' defending their budget?", "When is cutting SEO the right call?"],
    ["Defends SEO without data", "Caves immediately", "No alternative proposal"]),
  q("marketing", "situational", 3, ["mid", "senior", "lead"],
    "A campaign goes viral for the wrong reason — negative sentiment is climbing. What do you do?",
    ["crisis", "communication", "judgment"],
    "First, assess: is this a real crisis or a loud minority? I'd look at sentiment volume, share of voice, and whether it's spreading beyond the initial community. If it's real, the response depends on whether we're wrong (apologize, fix, communicate the fix), misunderstood (clarify without being defensive), or attacked (respond factually, don't engage with bad-faith actors). I'd coordinate with PR and legal, draft a holding statement within an hour, and a fuller response within a day. I'd never delete criticism or go silent — both make it worse. Post-crisis, I'd document what we learned and what we'd do differently.",
    ["How do you decide whether to respond publicly?", "What's the difference between a crisis and a controversy?", "How do you rebuild trust after?"],
    ["Goes silent", "Gets defensive", "Deletes critical comments"]),
  q("marketing", "culture-fit", 1, ["junior", "mid", "senior", "lead"],
    "What's the most important metric for a marketing team?",
    ["metrics", "values", "judgment"],
    "Pipeline — qualified pipeline, to be precise. Everything else (MQLs, traffic, engagement) is a leading indicator of pipeline. A marketing team that optimizes for MQLs without checking if those MQLs turn into pipeline is gaming the system. Pipeline is the point at which marketing hands off to sales; revenue is the ultimate outcome but it's a shared metric. If a marketing team can't tie their work to pipeline, they're either under-instrumented or working on the wrong things.",
    ["What's the second most important metric?", "When is pipeline the wrong metric?", "How do you avoid gaming leading indicators?"],
    ["Says 'impressions' or 'engagement'", "No mention of revenue", "Equates MQLs with success"]),
  q("marketing", "culture-fit", 2, ["mid", "senior"],
    "How do you balance creativity with measurement?",
    ["creativity", "measurement", "tension"],
    "I think of it as 70/20/10: 70% of budget on proven plays (measure obsessively), 20% on adjacent experiments (measure loosely), 10% on creative bets (measure qualitatively). If everything is measured to the same standard, you never try anything new; if nothing is measured, you waste money. The creative bets are where the next 70% comes from — today's experiment is tomorrow's proven play. I document what we tried, what we learned, and what we'd do differently, even (especially) when the experiment 'failed'.",
    ["How do you decide what goes in the 10%?", "How do you avoid the creativity-killing effect of A/B testing everything?", "What's a creative bet that paid off?"],
    ["All measurement, no creativity", "All creativity, no measurement", "No framework for balancing"]),
  q("marketing", "behavioral", 3, ["mid", "senior"],
    "Tell me about a time you had to market a product you didn't personally believe in.",
    ["integrity", "alignment", "honesty"],
    "I'd reframe the question: if I didn't believe in it, I'd either work to understand it better (often my skepticism is based on incomplete information) or, if I genuinely believed it was harmful or didn't work, I'd raise that internally — marketing a product you don't believe in is corrosive to your craft and your team. In practice, I've had moments where I pushed back on messaging I thought was overhyped — I'd propose alternative messaging that I could stand behind, with the data to support it. Honesty in marketing is a competitive advantage, not a constraint.",
    ["Have you ever left a job over this?", "How do you push back without being seen as not a team player?", "When is 'puffery' OK and when isn't it?"],
    ["Says they'd market anything", "Has never had this experience (unlikely)", "No reflection on integrity"]),
  q("marketing", "technical", 2, ["junior", "mid"],
    "How do you do keyword research for a new content pillar?",
    ["seo", "content", "research"],
    "I'd start with the audience: what problems do they have that this pillar addresses? I'd brainstorm seed topics, then expand with tools — Ahrefs/SEMrush for search volume and difficulty, Answer the Public for question variants, Google's 'people also ask' for related queries. I'd cluster keywords by intent (informational, commercial, transactional) and map them to the funnel. I'd prioritize by opportunity (volume × relevance × low difficulty). The output is a content brief per cluster, not a list of keywords — keywords are the input, content is the output.",
    ["How do you handle zero-volume keywords?", "How do you balance SEO with editorial judgment?", "How do you measure content performance?"],
    ["Picks keywords without intent mapping", "No tooling mentioned", "Skips audience research"]),
];

// ---------- Library accessors ----------

export function getLibrary(): Question[] {
  return LIBRARY;
}

export function getQuestionsByRole(role: Role): Question[] {
  return LIBRARY.filter((q) => q.role === role);
}

export function getQuestionsByCategory(role: Role, category: Category): Question[] {
  return LIBRARY.filter((q) => q.role === role && q.category === category);
}

export function getQuestions(
  role: Role,
  categories?: Category[],
  seniority?: Seniority,
): Question[] {
  let out = LIBRARY.filter((q) => q.role === role);
  if (categories && categories.length > 0) {
    out = out.filter((q) => categories.includes(q.category));
  }
  if (seniority) {
    out = out.filter((q) => q.seniority.includes(seniority));
  }
  return out;
}

/** Compute stats for a list of questions. */
export function computeStats(questions: Question[]): QuestionStats {
  const byCategory: Record<Category, number> = {
    behavioral: 0,
    technical: 0,
    situational: 0,
    "culture-fit": 0,
  };
  let role: Role = questions[0]?.role ?? "developer";
  for (const q of questions) {
    role = q.role;
    byCategory[q.category] += 1;
  }
  const total = questions.length;
  const avgDifficulty = total > 0
    ? Math.round((questions.reduce((s, q) => s + q.difficulty, 0) / total) * 10) / 10
    : 0;
  return { role, byCategory, total, avgDifficulty };
}

// ---------- Practice mode (heuristic grading) ----------

export interface GradeInput {
  question: Question;
  answer: string;
}

const STAR_SIGNALS = ["situation", "task", "action", "result", "first", "then", "we decided", "outcome", "ended up", "because"];

/** Heuristic STAR-pattern detection. */
export function detectStarPattern(answer: string): boolean {
  const lower = answer.toLowerCase();
  let hits = 0;
  for (const s of STAR_SIGNALS) {
    if (lower.includes(s)) hits += 1;
  }
  return hits >= 3;
}

/** Extract keyword hits from the model answer that appear in the candidate answer. */
export function findKeywordHits(modelAnswer: string, answer: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "must", "shall",
    "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we",
    "they", "what", "which", "who", "when", "where", "why", "how", "all", "any",
    "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just", "as", "at",
    "by", "from", "about", "into", "through", "during", "before", "after", "above",
    "below", "up", "down", "out", "off", "over", "under", "again", "further",
  ]);
  const modelTokens = modelAnswer.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3 && !stop.has(t));
  const answerLower = answer.toLowerCase();
  const hits = new Set<string>();
  for (const t of modelTokens) {
    if (answerLower.includes(t)) hits.add(t);
  }
  return Array.from(hits).slice(0, 10);
}

/** Count words in an answer. */
export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Grade a candidate answer against a question's rubric.
 *
 * Heuristic — not a real interviewer. Uses length, STAR detection, keyword
 * coverage, and category-specific signals to produce a 0-100 score with
 * per-criterion breakdown.
 */
export function gradeAnswer(input: GradeInput): GradedAnswer {
  const { question, answer } = input;
  const wordCount = countWords(answer);
  const hasStar = detectStarPattern(answer);
  const keywordHits = findKeywordHits(question.modelAnswer, answer);

  const feedback: string[] = [];
  const rubricScores: Array<{ criterion: string; score: number; comment: string }> = [];

  // Length score (0-5): too short or too long is penalized
  let lengthScore = 0;
  if (wordCount === 0) lengthScore = 0;
  else if (wordCount < 30) lengthScore = 1;
  else if (wordCount < 80) lengthScore = 3;
  else if (wordCount <= 600) lengthScore = 5;
  else if (wordCount <= 900) lengthScore = 4;
  else lengthScore = 2;

  if (wordCount === 0) feedback.push("Your answer is empty.");
  else if (wordCount < 30) feedback.push("Your answer is very short — aim for at least 50 words with concrete detail.");
  else if (wordCount > 900) feedback.push("Your answer is quite long — tighten it to keep the interviewer's attention.");

  // Keyword coverage score (0-5)
  const coverage = question.modelAnswer.length > 0
    ? keywordHits.length / Math.max(1, Math.min(8, question.modelAnswer.split(/\s+/).filter((w) => w.length > 3).length))
    : 0;
  const keywordScore = Math.min(5, Math.round(coverage * 5));
  if (keywordHits.length === 0) {
    feedback.push("Your answer doesn't overlap with the sample answer's key concepts — make sure you're addressing the same problem.");
  }

  // STAR score (0-5) — only meaningful for behavioral
  let starScore = 0;
  if (question.category === "behavioral" || question.category === "situational") {
    starScore = hasStar ? 5 : 2;
    if (!hasStar) feedback.push("Use the STAR format (Situation, Task, Action, Result) for behavioral questions — your answer is missing concrete structure.");
  } else {
    starScore = lengthScore >= 3 ? 4 : 2; // for technical, structure is about clarity
  }

  // Per-criterion scores
  for (const item of question.rubric) {
    let raw = 0;
    let comment = "";
    if (item.criterion === "communication") {
      raw = lengthScore;
      comment = lengthScore >= 4 ? "Length and detail are appropriate." : "Could be clearer or more concise.";
    } else if (item.criterion === "depth") {
      raw = keywordScore;
      comment = keywordScore >= 4 ? "Covers the key concepts from the sample answer." : "Surface-level — add trade-offs, alternatives, or edge cases.";
    } else if (item.criterion === "structure") {
      raw = starScore;
      comment = starScore >= 4 ? "Well-structured answer." : "Add structure — STAR for behavioral, clear framework for technical.";
    } else if (item.criterion === "evidence") {
      const hasEvidence = /\b(\d+|percent|%|x\s|times|years?|months?|weeks?|days?|hours?|doubled|tripled|halved|saved|reduced|increased|grew|cut)\b/i.test(answer);
      raw = hasEvidence ? 5 : 2;
      comment = hasEvidence ? "Includes specific evidence or numbers." : "Add quantified outcomes — concrete numbers make claims credible.";
    } else if (item.criterion === "role-fit") {
      raw = keywordScore >= 3 && lengthScore >= 3 ? 5 : 3;
      comment = raw >= 4 ? "Demonstrates role-relevant thinking." : "Connect your answer more explicitly to the role's core skills.";
    }
    rubricScores.push({ criterion: item.criterion, score: raw, comment });
  }

  // Weighted total → 0-100
  let weighted = 0;
  for (let i = 0; i < question.rubric.length; i++) {
    weighted += rubricScores[i].score * question.rubric[i].weight;
  }
  const score = Math.round((weighted / 5) * 100);

  if (feedback.length === 0) {
    feedback.push("Solid answer — review the sample answer for additional angles you might have missed.");
  }

  return {
    questionId: question.id,
    answer,
    score,
    wordCount,
    hasStar,
    keywordHits,
    feedback,
    rubricScores,
  };
}

// ---------- Rendering ----------

export function renderText(questions: Question[]): string {
  return questions.map((q, i) => {
    const lines = [
      `Question ${i + 1} [${CATEGORY_LABELS[q.category]} · ${ROLE_LABELS[q.role]} · difficulty ${q.difficulty}]`,
      q.text,
      `Tags: ${q.tags.join(", ")}`,
      `Seniority: ${q.seniority.map((s) => SENIORITY_LABELS[s]).join(", ")}`,
      "",
      "Model answer:",
      q.modelAnswer,
      "",
      "Follow-up probes:",
      ...q.followUps.map((f, j) => `  ${j + 1}. ${f}`),
      "",
      "Red flags:",
      ...q.redFlags.map((f, j) => `  ${j + 1}. ${f}`),
      "",
      "Rubric:",
      ...q.rubric.map((r) => `  ${r.criterion} (weight ${r.weight}) — 0: ${r.level0} | 5: ${r.level5}`),
    ];
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

export function renderMarkdown(questions: Question[]): string {
  return questions.map((q, i) => {
    const lines = [
      `## Question ${i + 1} — ${CATEGORY_LABELS[q.category]} (${ROLE_LABELS[q.role]})`,
      `**Difficulty:** ${q.difficulty}/5  |  **Seniority:** ${q.seniority.map((s) => SENIORITY_LABELS[s]).join(", ")}  |  **Tags:** ${q.tags.join(", ")}`,
      "",
      `### ${q.text}`,
      "",
      "**Model answer:**",
      "",
      q.modelAnswer,
      "",
      "**Follow-up probes:**",
      ...q.followUps.map((f) => `- ${f}`),
      "",
      "**Red flags (watch for):**",
      ...q.redFlags.map((f) => `- ${f}`),
      "",
      "**Rubric:**",
      ...q.rubric.map((r) => `- **${r.criterion}** (weight ${r.weight}) — *0:* ${r.level0} · *5:* ${r.level5}`),
      "",
    ];
    return lines.join("\n");
  }).join("\n---\n\n");
}

export function renderCsv(questions: Question[]): string {
  const lines = ["id,role,category,difficulty,seniority,tags,text,model_answer"];
  for (const q of questions) {
    lines.push([
      escapeCsv(q.id),
      q.role,
      q.category,
      q.difficulty,
      q.seniority.join("|"),
      escapeCsv(q.tags.join("|")),
      escapeCsv(q.text),
      escapeCsv(q.modelAnswer),
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJson(questions: Question[]): string {
  return JSON.stringify(questions.map((q) => ({
    id: q.id,
    role: q.role,
    category: q.category,
    difficulty: q.difficulty,
    seniority: q.seniority,
    text: q.text,
    tags: q.tags,
    modelAnswer: q.modelAnswer,
    followUps: q.followUps,
    redFlags: q.redFlags,
    rubric: q.rubric,
  })), null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  role: Role;
  categories: Category[];
  seniority: Seniority | null;
  questionCount: number;
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

// ---------- Saved question banks (localStorage) ----------

export interface SavedBank {
  ts: number;
  name: string;
  role: Role;
  categories: Category[];
  seniority: Seniority | null;
  questionIds: string[];
}

export function loadBanks(): SavedBank[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BANKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedBank[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveBank(entry: SavedBank): SavedBank[] {
  const next = [entry, ...loadBanks()].slice(0, 50);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(BANKS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeBank(ts: number): SavedBank[] {
  const next = loadBanks().filter((b) => b.ts !== ts);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(BANKS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearBanks(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(BANKS_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  role: Role;
  categories: Category[];
  seniority: Seniority | null;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.role) params.set("r", state.role);
  if (state.categories.length > 0) params.set("c", state.categories.join(","));
  if (state.seniority) params.set("s", state.seniority);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const r = params.get("r") as Role | null;
  if (r && r in ROLE_LABELS) out.role = r;
  const c = params.get("c");
  if (c) {
    const validCats = Object.keys(CATEGORY_LABELS) as Category[];
    out.categories = c.split(",").filter((x) => validCats.includes(x as Category)) as Category[];
  }
  const s = params.get("s") as Seniority | null;
  if (s && s in SENIORITY_LABELS) out.seniority = s;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  role: Role,
  seniority: Seniority | null,
  categories: Category[],
  jobDescription: string,
): string {
  return [
    "You are an expert interviewer and hiring manager who designs role-specific interview questions.",
    `Role: ${ROLE_LABELS[role]}.`,
    seniority ? `Seniority: ${SENIORITY_LABELS[seniority]}.` : "Seniority: any.",
    `Categories: ${categories.length > 0 ? categories.map((c) => CATEGORY_LABELS[c]).join(", ") : "all categories"}.`,
    jobDescription ? `Job description:\n${jobDescription}` : "",
    "",
    "Generate 5 interview questions for this role and seniority.",
    "For each question, output a JSON object with:",
    '- "text": the question (one sentence)',
    '- "category": one of behavioral | technical | situational | culture-fit',
    '- "difficulty": 1-5',
    '- "tags": array of 2-4 short tag strings',
    '- "modelAnswer": 2-4 sentence sample strong answer',
    '- "followUps": array of 2-3 follow-up probe strings',
    '- "redFlags": array of 1-3 things to watch for in weak answers',
    "",
    "Rules:",
    "- Match the difficulty to the seniority (junior: 1-2, mid: 2-3, senior: 3-4, lead: 4-5).",
    "- Vary the categories across the 5 questions.",
    "- Make the model answer specific and actionable, not generic.",
    "- Output ONLY a JSON array — no markdown fences, no commentary.",
  ].filter(Boolean).join("\n");
}

export interface LlmQuestion {
  text: string;
  category: Category;
  difficulty: Difficulty;
  tags: string[];
  modelAnswer: string;
  followUps: string[];
  redFlags: string[];
}

export function renderLlmResult(rawText: string):
  | { ok: true; questions: LlmQuestion[] }
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
  const validCats = new Set(Object.keys(CATEGORY_LABELS));
  const out: LlmQuestion[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) continue;
    const category = (typeof o.category === "string" && validCats.has(o.category))
      ? o.category as Category
      : "behavioral";
    const difficultyRaw = typeof o.difficulty === "number" ? o.difficulty : 3;
    const difficulty = Math.max(1, Math.min(5, Math.round(difficultyRaw))) as Difficulty;
    const tags = Array.isArray(o.tags)
      ? (o.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 6)
      : [];
    const modelAnswer = typeof o.modelAnswer === "string" ? o.modelAnswer : "";
    const followUps = Array.isArray(o.followUps)
      ? (o.followUps as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 5)
      : [];
    const redFlags = Array.isArray(o.redFlags)
      ? (o.redFlags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 5)
      : [];
    out.push({ text, category, difficulty, tags, modelAnswer, followUps, redFlags });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid question objects." };
  }
  return { ok: true, questions: out };
}
