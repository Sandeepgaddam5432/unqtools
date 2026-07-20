/**
 * AI User Persona Creator — pure logic.
 *
 * Generate distinct, structured user personas from a product description and
 * audience notes. Produces demographics, goals, pains, behaviors, motivations,
 * frustrations, preferred channels, a quote, a day-in-the-life, an empathy
 * map, and JTBD framing. Pure functions only — no DOM, no network. The
 * optional BYO-key LLM enhancement lives in ui.tsx and goes directly to the
 * user's provider.
 *
 * Honesty: AI personas are hypotheses to validate with real user research,
 * not facts. Each persona is flagged with a 'confidence' level and an
 * 'assumptions' list so the team can decide what to verify first.
 */

// ---------- Types ----------

export type ProductType =
  | "b2b-saas"
  | "b2c-mobile"
  | "ecommerce"
  | "marketplace"
  | "content-media"
  | "education"
  | "fintech"
  | "healthtech";

export type TechSavviness = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export interface PersonaName {
  first: string;
  last: string;
}

export interface Demographics {
  ageRange: string;
  gender: string;
  occupation: string;
  industry: string;
  location: string;
  incomeRange: string;
  education: string;
  household: string;
}

export interface EmpathyMap {
  says: string[];
  thinks: string[];
  does: string[];
  feels: string[];
}

export interface JTBD {
  functional: string;
  emotional: string;
  social: string;
}

export interface Persona {
  id: string;
  name: PersonaName;
  fullName: string;
  role: string;
  tagline: string;
  demographics: Demographics;
  goals: string[];
  pains: string[];
  behaviors: string[];
  motivations: string[];
  frustrations: string[];
  preferredChannels: string[];
  techSavviness: TechSavviness;
  quote: string;
  dayInTheLife: string[];
  empathyMap: EmpathyMap;
  jobsToBeDone: JTBD[];
  scenario: string;
  confidence: Confidence;
  assumptions: string[];
  productType: ProductType;
}

export interface PersonaInput {
  productType: ProductType;
  productName: string;
  productDescription: string;
  audience: string;
  count: number;
}

export interface PersonaStats {
  total: number;
  byConfidence: Record<Confidence, number>;
  byTechSavviness: Record<TechSavviness, number>;
  avgGoals: number;
  avgPains: number;
  distinctRoles: number;
}

// ---------- Constants ----------

export const PRODUCT_TYPES: ProductType[] = [
  "b2b-saas", "b2c-mobile", "ecommerce", "marketplace",
  "content-media", "education", "fintech", "healthtech",
];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  "b2b-saas": "B2B SaaS",
  "b2c-mobile": "B2C Mobile App",
  "ecommerce": "E-commerce",
  "marketplace": "Marketplace",
  "content-media": "Content / Media",
  "education": "Education",
  "fintech": "Fintech",
  "healthtech": "Healthtech",
};

export const AUDIENCE_PRESETS: Array<{ id: string; label: string; description: string }> = [
  { id: "startup-founders", label: "Startup founders", description: "Early-stage founders scaling a SaaS from 0 → 10k users" },
  { id: "enterprise-pms", label: "Enterprise product managers", description: "PMs at 1000+ employee companies buying tools for their teams" },
  { id: "indie-shoppers", label: "Indie online shoppers", description: "25-40 year-old online shoppers who buy 2-4× per month" },
  { id: "students-k12", label: "K-12 students", description: "Students aged 13-18 using learning apps at home" },
  { id: "remote-workers", label: "Remote knowledge workers", description: "Fully-remote developers, designers, and writers" },
  { id: "freelancers", label: "Freelancers & solopreneurs", description: "Independent contractors managing 3-10 clients" },
  { id: "small-biz-owners", label: "Small business owners", description: "Owners of <50 employee local businesses" },
  { id: "fitness-enthusiasts", label: "Fitness enthusiasts", description: "Adults who exercise 4+ times per week" },
];

export const SAMPLE_INPUT: PersonaInput = {
  productType: "b2b-saas",
  productName: "FlowDesk",
  productDescription: "A project management SaaS for remote product teams — kanban, sprints, docs, and integrations in one workspace.",
  audience: "Remote product managers at 50-500 person tech companies, frustrated by tool sprawl across Jira, Notion, and Slack.",
  count: 3,
};

// ---------- Name banks ----------

const FIRST_NAMES_F = ["Aisha", "Mei", "Sofia", "Priya", "Fatima", "Yuki", "Ava", "Zara", "Lena", "Nadia", "Camila", "Ingrid"];
const FIRST_NAMES_M = ["Marcus", "Diego", "Kenji", "Omar", "Liam", "Andre", "Ravi", "Tariq", "Noah", "Yusuf", "Mateo", "Erik"];
const LAST_NAMES = ["Okafor", "Chen", "Rossi", "Patel", "Haddad", "Tanaka", "Müller", "Singh", "Costa", "Kim", "Andersson", "Reyes"];

const OCCUPATIONS: Record<ProductType, string[]> = {
  "b2b-saas": ["Product Manager", "Engineering Manager", "Operations Lead", "Customer Success Manager"],
  "b2c-mobile": ["Graduate Student", "Marketing Coordinator", "Barista", "Junior Designer"],
  "ecommerce": ["Office Worker", "Stay-at-home Parent", "Teacher", "Sales Rep"],
  "marketplace": ["Handmade Seller", "Freelance Designer", "Vintage Reseller", "Small-batch Maker"],
  "content-media": ["Blogger", "Podcast Producer", "Newsletter Writer", "Indie Journalist"],
  "education": ["High School Teacher", "Homeschool Parent", "EdTech Coach", "University Lecturer"],
  "fintech": ["Accountant", "Small Business Owner", "Financial Advisor", "Operations Manager"],
  "healthtech": ["Registered Nurse", "Clinic Manager", "Caregiver", "Wellness Coach"],
};

const INDUSTRIES: Record<ProductType, string[]> = {
  "b2b-saas": ["SaaS / Software", "Fintech", "Healthcare IT", "E-commerce"],
  "b2c-mobile": ["Consumer Tech", "Education", "Hospitality", "Retail"],
  "ecommerce": ["Retail", "Apparel", "Home Goods", "Beauty"],
  "marketplace": ["Crafts", "Services", "Second-hand Goods", "Digital Products"],
  "content-media": ["Publishing", "Independent Media", "Marketing Agencies", "Education"],
  "education": ["K-12", "Higher Education", "Professional Training", "Homeschooling"],
  "fintech": ["Accounting Firms", "Small Business", "Personal Finance", "Investment Advisory"],
  "healthtech": ["Hospitals", "Clinics", "Home Care", "Wellness & Fitness"],
};

const LOCATIONS = [
  "Austin, TX", "Berlin, Germany", "Toronto, Canada", "Bangalore, India",
  "Lagos, Nigeria", "Singapore", "Lisbon, Portugal", "Denver, CO",
  "Sydney, Australia", "Mexico City, Mexico", "Amsterdam, Netherlands", "Seoul, South Korea",
];

const AGE_RANGES = ["22-28", "26-32", "30-38", "35-44", "42-55"];

const INCOME_RANGES = ["$30k-$50k", "$50k-$80k", "$80k-$120k", "$120k-$180k", "$180k+"];

const EDUCATION = ["High school", "Bachelor's degree", "Master's degree", "Self-taught", "Trade school"];

const HOUSEHOLDS = ["Single, no kids", "Couple, no kids", "Couple, 1-2 kids", "Single parent", "Living with roommates"];

// ---------- Goal / pain / motivation banks ----------

const GOAL_BANK: Record<ProductType, string[]> = {
  "b2b-saas": [
    "Ship the next quarter's roadmap on time",
    "Keep the whole team aligned without endless standups",
    "Reduce time spent switching between tools",
    "Demonstrate product impact to leadership",
  ],
  "b2c-mobile": [
    "Build a daily habit without feeling nagged",
    "Save time on small repetitive tasks",
    "Stay motivated with gentle reminders",
    "Share progress with friends",
  ],
  "ecommerce": [
    "Find quality products quickly",
    "Get fast, free shipping",
    "Discover new brands aligned to taste",
    "Avoid buyer's remorse",
  ],
  "marketplace": [
    "Find steady demand for what I make",
    "Get paid reliably and quickly",
    "Spend less time on admin and listings",
    "Build a reputation that brings repeat buyers",
  ],
  "content-media": [
    "Grow an audience without burning out",
    "Monetize content beyond ads",
    "Repurpose one piece of content across channels",
    "Understand what resonates with readers",
  ],
  "education": [
    "Personalize learning for every student",
    "Reduce grading and admin overhead",
    "Keep students engaged outside class",
    "Demonstrate learning outcomes to parents/admin",
  ],
  "fintech": [
    "See where the money goes each month",
    "Pay vendors on time without manual chasing",
    "Plan cash flow 3-6 months ahead",
    "Avoid surprise fees and overdrafts",
  ],
  "healthtech": [
    "Reduce time on charting and admin",
    "Coordinate care across providers",
    "Engage patients between visits",
    "Demonstrate outcomes to administrators",
  ],
};

const PAIN_BANK: Record<ProductType, string[]> = {
  "b2b-saas": [
    "Tool sprawl — Jira, Notion, Slack, Linear, Figma",
    "Status updates feel like a second job",
    "Roadmap items slip because no one owns them",
    "Onboarding new hires takes weeks",
  ],
  "b2c-mobile": [
    "Apps that demand an account just to try them",
    "Notification fatigue",
    "Inconsistent onboarding across devices",
    "Forgetting to use the app after the first week",
  ],
  "ecommerce": [
    "Shipping costs surprise at checkout",
    "Returns are a hassle",
    "Search returns irrelevant products",
    "Reviews feel fake or paid",
  ],
  "marketplace": [
    "Inconsistent buyer demand month to month",
    "Platform fees eat into margins",
    "Customer service disputes take days",
    "Listing tools are clunky on mobile",
  ],
  "content-media": [
    "Algorithm changes tank reach overnight",
    "Sponsorship deals are unpredictable",
    "Editing takes longer than creating",
    "Hard to know which platform is worth the effort",
  ],
  "education": [
    "Differentiated instruction is impossible at scale",
    "Grading eats evenings and weekends",
    "Students disengage when content is one-size-fits-all",
    "Admin asks for outcomes data teachers don't have time to collect",
  ],
  "fintech": [
    "Reconciling invoices against bank statements is manual",
    "Cash flow forecasts are guesses",
    "Multiple logins for banking, invoicing, payroll",
    "Tax season feels like a fire drill",
  ],
  "healthtech": [
    "EMR interfaces feel like they're from 2005",
    "Charting at home after clinic hours",
    "Patient messages pile up between visits",
    "Care coordination across specialists breaks down",
  ],
};

const BEHAVIOR_BANK: Record<ProductType, string[]> = {
  "b2b-saas": [
    "Runs standups in Slack because Zoom fatigue is real",
    "Keeps a personal Notion doc of 'the real roadmap'",
    "Tries a new tool every quarter and abandons half",
    "Bookmarks 30+ tabs of 'when I have time' reading",
  ],
  "b2c-mobile": [
    "Checks phone within 5 minutes of waking up",
    "Deletes apps that don't earn their spot weekly",
    "Reads reviews before installing",
    "Shares wins on Instagram Stories",
  ],
  "ecommerce": [
    "Adds to cart, abandons, waits for a discount code",
    "Reads 3-5 reviews before buying",
    "Shops on mobile, buys on desktop",
    "Joins loyalty programs but rarely redeems",
  ],
  "marketplace": [
    "Lists new products on Sunday evenings",
    "Refreshes dashboard 5+ times a day",
    "Replies to messages within an hour to keep ranking",
    "Cross-posts listings on 2-3 platforms",
  ],
  "content-media": [
    "Drafts in the Notes app at 11pm",
    "Schedules posts for 'peak engagement' windows",
    "Repurposes one podcast into 5 pieces of content",
    "Tracks open rates obsessively",
  ],
  "education": [
    "Lesson-plans on Sunday nights",
    "Stays late to grade, then grades more at home",
    "Joins 3-5 teacher Facebook groups for ideas",
    "Pays out-of-pocket for classroom tools",
  ],
  "fintech": [
    "Reviews bank balances every Monday morning",
    "Uses 3+ finance tools that don't talk to each other",
    "Spreadsheets the books at month-end",
    "Watches cash runway weekly during slow seasons",
  ],
  "healthtech": [
    "Charts between patients, finishes at home",
    "Calls specialists directly because the EMR inbox is overwhelming",
    "Patient-messages from the parking lot",
    "Reviews the day's schedule before brushing teeth",
  ],
};

const MOTIVATION_BANK: Record<ProductType, string[]> = {
  "b2b-saas": [
    "Looking good in front of leadership",
    "Protecting the team from burnout",
    "Proving impact with data, not vibes",
    "Shipping something users actually love",
  ],
  "b2c-mobile": [
    "Feeling productive without being stressed",
    "Belonging to a community",
    "Saving money or time",
    "Looking good to peers",
  ],
  "ecommerce": [
    "Getting a deal",
    "Finding something unique",
    "Convenience over effort",
    "Feeling like a smart shopper",
  ],
  "marketplace": [
    "Creative independence",
    "Predictable income",
    "Recognition from buyers",
    "Building something of their own",
  ],
  "content-media": [
    "Creative freedom",
    "Audience connection",
    "Financial sustainability",
    "Industry recognition",
  ],
  "education": [
    "Student outcomes",
    "Recognition from peers and admin",
    "Work-life balance",
    "Mastery of their craft",
  ],
  "fintech": [
    "Financial security",
    "Peace of mind",
    "Saving time on admin",
    "Confidence in decisions",
  ],
  "healthtech": [
    "Patient outcomes",
    "Work-life balance",
    "Professional recognition",
    "Reducing administrative burden",
  ],
};

const FRUSTRATION_BANK: Record<ProductType, string[]> = {
  "b2b-saas": [
    "Vendors that over-promise and under-deliver",
    "Lock-in contracts that outlast the relationship",
    "Salespeople who don't understand the actual workflow",
    "Tools that look great in demo but break at scale",
  ],
  "b2c-mobile": [
    "Apps that demand a credit card for a free trial",
    "Onboarding that takes more than 60 seconds",
    "Dark patterns in cancellation flows",
    "Push notifications about things that don't matter",
  ],
  "ecommerce": [
    "Hidden fees at checkout",
    "Slow shipping with no communication",
    "Returns that cost more than the item",
    "Fake-looking reviews",
  ],
  "marketplace": [
    "Algorithm changes that tank visibility overnight",
    "Buyers who ghost after winning a bid",
    "Disputes resolved in the buyer's favor automatically",
    "Listing tools that crash on mobile",
  ],
  "content-media": [
    "Algorithm changes that destroy reach overnight",
    "Platforms that demonetize without explanation",
    "Sponsor deals that demand 17 rounds of revisions",
    "Analytics that contradict each other",
  ],
  "education": [
    "Tools that require IT tickets to set up",
    "Student data locked in silos",
    "PD sessions that don't match classroom reality",
    "Admin mandates with no time to implement",
  ],
  "fintech": [
    "Banks that won't share data via API",
    "Hidden fees that surface only at month-end",
    "Tools that require a finance degree to use",
    "Support that sends you in circles",
  ],
  "healthtech": [
    "EMRs that log out mid-chart",
    "Copy-forward features that propagate errors",
    "Patient portals that no one explains",
    "Compliance training that wastes clinical hours",
  ],
};

const CHANNEL_BANK: Record<ProductType, string[]> = {
  "b2b-saas": ["LinkedIn", "Slack communities", "Product Hunt", "Industry newsletters", "Word of mouth"],
  "b2c-mobile": ["TikTok", "Instagram", "App Store search", "Friend recommendations", "YouTube"],
  "ecommerce": ["Instagram", "Pinterest", "Google Shopping", "Email newsletters", "Word of mouth"],
  "marketplace": ["Etsy", "Instagram", "Reddit communities", "Pinterest", "Discord"],
  "content-media": ["Twitter / X", "Substack", "YouTube", "LinkedIn", "Podcast directories"],
  "education": ["Pinterest", "Teacher Facebook groups", "EdSurge newsletter", "Twitter / X", "Conference word of mouth"],
  "fintech": ["LinkedIn", "Industry podcasts", "Reddit r/smallbusiness", "QuickBooks community", "CPA newsletters"],
  "healthtech": ["LinkedIn", "MedTwitter", "Conference word of mouth", "Specialist Slack groups", "Practice manager listservs"],
};

const TAGLINES: Record<ProductType, string[]> = {
  "b2b-saas": ["'Ship it.' is the only mantra", "Roadmap realist, meeting skeptic", "Tools come and go; the team remains"],
  "b2c-mobile": ["Five minutes a day is enough", "Don't tell me, show me", "If it's not on my phone, it doesn't exist"],
  "ecommerce": ["Free shipping or I'm out", "I read every review", "If I save it to my wishlist, I'll buy it next month"],
  "marketplace": ["Every order is a relationship", "I make, therefore I am", "Treat my shop like my brand"],
  "content-media": ["Distribution is the new content", "One idea, five formats", "Readers first, algorithms second"],
  "education": ["Every kid deserves a different lesson", "Engagement beats compliance", "Plan once, differentiate forever"],
  "fintech": ["Cash flow is oxygen", "Numbers don't lie, but reports often do", "Forecast early, sleep well"],
  "healthtech": ["Patients first, charts second", "Document once, trust it forever", "Care doesn't fit in a checkbox"],
};

// ---------- Seeded RNG (deterministic) ----------

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  nextInt(max: number): number;
  pick<T>(arr: readonly T[]): T;
  pickN<T>(arr: readonly T[], n: number): T[];
}

export function makeRng(seed: string): Rng {
  let state = hashSeed(seed) || 1;
  const next = (): number => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
  const nextInt = (max: number): number => {
    if (max <= 0) return 0;
    return Math.floor(next() * max);
  };
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick from empty array");
    return arr[nextInt(arr.length)];
  };
  const pickN = <T,>(arr: readonly T[], n: number): T[] => {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = nextInt(copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };
  return { next, nextInt, pick, pickN };
}

// ---------- Generators ----------

export function generatePersonaName(seed: string): PersonaName {
  const rng = makeRng(seed + ":name");
  const bank = rng.next() < 0.5 ? FIRST_NAMES_F : FIRST_NAMES_M;
  return {
    first: rng.pick(bank),
    last: rng.pick(LAST_NAMES),
  };
}

export function generateDemographics(productType: ProductType, audience: string, seed: string): Demographics {
  const rng = makeRng(seed + ":demo");
  const gender = rng.next() < 0.5 ? "Female" : rng.next() < 0.5 ? "Male" : "Non-binary";
  return {
    ageRange: pickByAudience(audience, rng, AGE_RANGES),
    gender,
    occupation: rng.pick(OCCUPATIONS[productType]),
    industry: rng.pick(INDUSTRIES[productType]),
    location: rng.pick(LOCATIONS),
    incomeRange: rng.pick(INCOME_RANGES),
    education: rng.pick(EDUCATION),
    household: rng.pick(HOUSEHOLDS),
  };
}

function pickByAudience(audience: string, rng: Rng, fallback: readonly string[]): string {
  void audience;
  return rng.pick(fallback);
}

export function generateGoals(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":goals");
  return rng.pickN(GOAL_BANK[productType], Math.min(n, GOAL_BANK[productType].length));
}

export function generatePains(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":pains");
  return rng.pickN(PAIN_BANK[productType], Math.min(n, PAIN_BANK[productType].length));
}

export function generateBehaviors(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":behaviors");
  return rng.pickN(BEHAVIOR_BANK[productType], Math.min(n, BEHAVIOR_BANK[productType].length));
}

export function generateMotivations(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":motivations");
  return rng.pickN(MOTIVATION_BANK[productType], Math.min(n, MOTIVATION_BANK[productType].length));
}

export function generateFrustrations(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":frustrations");
  return rng.pickN(FRUSTRATION_BANK[productType], Math.min(n, FRUSTRATION_BANK[productType].length));
}

export function generateChannels(productType: ProductType, seed: string, n = 3): string[] {
  const rng = makeRng(seed + ":channels");
  return rng.pickN(CHANNEL_BANK[productType], Math.min(n, CHANNEL_BANK[productType].length));
}

export function generateTechSavviness(productType: ProductType, seed: string): TechSavviness {
  const rng = makeRng(seed + ":tech");
  const pool: TechSavviness[] = productType === "b2b-saas" || productType === "fintech"
    ? ["high", "high", "medium"]
    : productType === "healthtech" || productType === "education"
      ? ["medium", "low", "medium"]
      : ["medium", "high", "low"];
  return rng.pick(pool);
}

export function generateQuote(persona: { demographics: Demographics; goals: string[]; pains: string[] }, productType: ProductType, seed: string): string {
  const rng = makeRng(seed + ":quote");
  const templates: string[] = [
    `"I just want to ${persona.goals[0]?.toLowerCase() || "get my work done"} without spending half my day in tools."`,
    `"${persona.pains[0] || "The friction is real"} — that's why I'm always looking for a better way."`,
    `"If a tool can't save me time in week one, it's gone."`,
    `"My team is tired of ${persona.pains[0]?.toLowerCase() || "context-switching"}. We need one source of truth."`,
  ];
  void productType;
  return rng.pick(templates);
}

export function generateDayInTheLife(persona: { demographics: Demographics; goals: string[]; behaviors: string[] }, productType: ProductType, seed: string): string[] {
  const rng = makeRng(seed + ":day");
  const morning = rng.pick([
    `6:45 AM — Wakes up, checks ${productType === "b2b-saas" ? "Slack" : "the phone"} before getting out of bed.`,
    `7:15 AM — Coffee, scans ${rng.pick(["email", "the news", "social feeds"])}, mentally triages the day.`,
    `7:30 AM — Quick standup prep — what did I commit to yesterday?`,
  ]);
  const midday = rng.pick([
    `11:00 AM — Back-to-back calls; squeezes in ${persona.behaviors[0]?.toLowerCase() || "real work"} between them.`,
    `12:30 PM — Lunch at the desk, catches up on ${rng.pick(["industry news", "messages", "the backlog"])}.`,
    `1:00 PM — Deep-work block; ${persona.goals[0]?.toLowerCase() || "ships one meaningful thing"}.`,
  ]);
  const afternoon = rng.pick([
    `3:30 PM — Reviews ${rng.pick(["metrics", "the dashboard", "team updates"])} and reshuffles tomorrow's plan.`,
    `4:00 PM — Handles ${persona.behaviors[1]?.toLowerCase() || "the inevitable fire"} that popped up at 2 PM.`,
    `4:30 PM — Syncs with a teammate about ${persona.goals[1]?.toLowerCase() || "the next milestone"}.`,
  ]);
  const evening = rng.pick([
    `6:30 PM — Logs off (mostly), makes dinner, resists the urge to check notifications.`,
    `7:00 PM — Family / downtime; the phone stays in the other room.`,
    `9:00 PM — Inevitably checks work one more time; closes the laptop for real at 10.`,
  ]);
  return [morning, midday, afternoon, evening];
}

export function generateEmpathyMap(persona: { goals: string[]; pains: string[]; motivations: string[]; frustrations: string[] }, seed: string): EmpathyMap {
  const rng = makeRng(seed + ":empathy");
  return {
    says: [persona.goals[0] || "I need to hit my targets", persona.frustrations[0] || "This tool is slow"].map((s) => `"${s}"`),
    thinks: [persona.motivations[0] || "I want to do my best work", persona.pains[0] || "There has to be a better way"],
    does: [persona.goals[0] ? `Acts on: ${persona.goals[0].toLowerCase()}` : "Tries new tools", persona.pains[0] ? `Works around: ${persona.pains[0].toLowerCase()}` : "Manually patches gaps"],
    feels: [
      rng.pick(["Overwhelmed", "Curious", "Determined", "Skeptical"]),
      rng.pick(["Hopeful about new tools", "Tired of context-switching", "Proud of small wins", "Anxious about falling behind"]),
    ],
  };
}

export function generateJTBD(persona: { goals: string[]; motivations: string[]; demographics: Demographics }, productType: ProductType, seed: string): JTBD {
  void productType;
  void persona;
  const rng = makeRng(seed + ":jtbd");
  return {
    functional: `Help me ${rng.pick(["ship my work on time", "coordinate with my team", "stay on top of my day", "demonstrate my impact"])}.`,
    emotional: `Make me feel ${rng.pick(["in control", "competent", "calm", "ahead of the game"])}.`,
    social: `Help me look good to ${rng.pick(["my team", "leadership", "my customers", "my peers"])}.`,
  };
}

export function generateScenario(persona: { fullName: string; goals: string[]; pains: string[]; behaviors: string[]; demographics: Demographics }, productType: ProductType, productName: string, seed: string): string {
  const rng = makeRng(seed + ":scenario");
  void rng;
  return `${persona.fullName} (${persona.demographics.occupation}, ${persona.demographics.location}) opens ${productName} ${rng.pick(["first thing Monday morning", "after the 9 AM standup", "right after lunch", "during the afternoon focus block"])}. ` +
    `The goal: ${persona.goals[0]?.toLowerCase() || "make progress on the week's priority"}. ` +
    `But ${persona.pains[0]?.toLowerCase() || "the usual friction"} threatens to derail the session. ` +
    `With ${productName}, ${persona.fullName} can ${persona.behaviors[0]?.toLowerCase() || "ship the work"} in one place — without the usual context-switching.`;
}

export function generateTagline(productType: ProductType, seed: string): string {
  const rng = makeRng(seed + ":tagline");
  return rng.pick(TAGLINES[productType]);
}

export function generateConfidence(input: PersonaInput, seed: string): { confidence: Confidence; assumptions: string[] } {
  const assumptions: string[] = [];
  if (!input.audience || input.audience.trim().length < 20) {
    assumptions.push("Audience description is short — demographics are inferred from product type, not grounded in real research.");
  }
  if (!input.productDescription || input.productDescription.trim().length < 20) {
    assumptions.push("Product description is short — goals and pains are templated, not tailored to your actual value prop.");
  }
  if (assumptions.length === 0) {
    assumptions.push("Personas are templated hypotheses; validate with 5-8 real user interviews before relying on them.");
  }
  const confidence: Confidence = assumptions.length >= 2 ? "low" : assumptions.length === 1 ? "medium" : "high";
  return { confidence, assumptions };
}

// ---------- Persona builder ----------

export function buildPersona(input: PersonaInput, index: number): Persona {
  const seed = `${input.productType}|${input.productName}|${input.audience}|${index}`;
  const name = generatePersonaName(seed);
  const fullName = `${name.first} ${name.last}`;
  const demographics = generateDemographics(input.productType, input.audience, seed);
  const goals = generateGoals(input.productType, seed, 3);
  const pains = generatePains(input.productType, seed, 3);
  const behaviors = generateBehaviors(input.productType, seed, 3);
  const motivations = generateMotivations(input.productType, seed, 3);
  const frustrations = generateFrustrations(input.productType, seed, 3);
  const preferredChannels = generateChannels(input.productType, seed, 3);
  const techSavviness = generateTechSavviness(input.productType, seed);
  const partial = { fullName, demographics, goals, pains, behaviors, motivations, frustrations };
  const quote = generateQuote(partial, input.productType, seed);
  const dayInTheLife = generateDayInTheLife(partial, input.productType, seed);
  const empathyMap = generateEmpathyMap(partial, seed);
  const jobsToBeDone = [generateJTBD(partial, input.productType, seed)];
  const scenario = generateScenario(partial, input.productType, input.productName || "the product", seed);
  const tagline = generateTagline(input.productType, seed);
  const { confidence, assumptions } = generateConfidence(input, seed);
  return {
    id: `persona-${index + 1}`,
    name, fullName,
    role: demographics.occupation,
    tagline,
    demographics, goals, pains, behaviors, motivations, frustrations,
    preferredChannels, techSavviness, quote, dayInTheLife,
    empathyMap, jobsToBeDone, scenario, confidence, assumptions,
    productType: input.productType,
  };
}

export function buildMultiplePersonas(input: PersonaInput): Persona[] {
  const count = Math.max(1, Math.min(4, input.count || 1));
  const out: Persona[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    const p = buildPersona(input, attempts);
    if (!seen.has(p.fullName)) {
      seen.add(p.fullName);
      out.push(p);
    }
    attempts++;
  }
  return out;
}

// ---------- Rendering ----------

export function renderPersonaMarkdown(p: Persona, input: PersonaInput): string {
  const lines: string[] = [];
  lines.push(`# ${p.fullName} — ${p.role}`);
  lines.push("");
  lines.push(`> ${p.tagline}`);
  lines.push("");
  lines.push(`**Quote:** ${p.quote}`);
  lines.push("");
  lines.push("## Demographics");
  lines.push(`- **Age:** ${p.demographics.ageRange}`);
  lines.push(`- **Gender:** ${p.demographics.gender}`);
  lines.push(`- **Occupation:** ${p.demographics.occupation}`);
  lines.push(`- **Industry:** ${p.demographics.industry}`);
  lines.push(`- **Location:** ${p.demographics.location}`);
  lines.push(`- **Income:** ${p.demographics.incomeRange}`);
  lines.push(`- **Education:** ${p.demographics.education}`);
  lines.push(`- **Household:** ${p.demographics.household}`);
  lines.push(`- **Tech savviness:** ${p.techSavviness}`);
  lines.push("");
  lines.push("## Goals");
  for (const g of p.goals) lines.push(`- ${g}`);
  lines.push("");
  lines.push("## Pains");
  for (const x of p.pains) lines.push(`- ${x}`);
  lines.push("");
  lines.push("## Behaviors");
  for (const b of p.behaviors) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Motivations");
  for (const m of p.motivations) lines.push(`- ${m}`);
  lines.push("");
  lines.push("## Frustrations");
  for (const f of p.frustrations) lines.push(`- ${f}`);
  lines.push("");
  lines.push("## Preferred channels");
  for (const c of p.preferredChannels) lines.push(`- ${c}`);
  lines.push("");
  lines.push("## Day in the life");
  for (const d of p.dayInTheLife) lines.push(`- ${d}`);
  lines.push("");
  lines.push("## Empathy map");
  lines.push("**Says:** " + p.empathyMap.says.join("; "));
  lines.push("**Thinks:** " + p.empathyMap.thinks.join("; "));
  lines.push("**Does:** " + p.empathyMap.does.join("; "));
  lines.push("**Feels:** " + p.empathyMap.feels.join("; "));
  lines.push("");
  lines.push("## Jobs to be done");
  for (const j of p.jobsToBeDone) {
    lines.push(`- **Functional:** ${j.functional}`);
    lines.push(`- **Emotional:** ${j.emotional}`);
    lines.push(`- **Social:** ${j.social}`);
  }
  lines.push("");
  lines.push("## Scenario");
  lines.push(p.scenario);
  lines.push("");
  lines.push("## Honesty");
  lines.push(`- **Confidence:** ${p.confidence}`);
  for (const a of p.assumptions) lines.push(`- ${a}`);
  if (input.productName) {
    lines.push("");
    lines.push(`---`);
    lines.push(`_Generated for **${input.productName}** (${PRODUCT_TYPE_LABELS[input.productType]}) by UnQTools AI User Persona Creator._`);
  }
  return lines.join("\n");
}

export function renderPersonasMarkdown(personas: Persona[], input: PersonaInput): string {
  return personas.map((p) => renderPersonaMarkdown(p, input)).join("\n\n---\n\n");
}

// ---------- Stats ----------

export function computeStats(personas: Persona[]): PersonaStats {
  const byConfidence: Record<Confidence, number> = { low: 0, medium: 0, high: 0 };
  const byTechSavviness: Record<TechSavviness, number> = { low: 0, medium: 0, high: 0 };
  let totalGoals = 0;
  let totalPains = 0;
  const roles = new Set<string>();
  for (const p of personas) {
    byConfidence[p.confidence] += 1;
    byTechSavviness[p.techSavviness] += 1;
    totalGoals += p.goals.length;
    totalPains += p.pains.length;
    roles.add(p.role);
  }
  return {
    total: personas.length,
    byConfidence,
    byTechSavviness,
    avgGoals: personas.length ? totalGoals / personas.length : 0,
    avgPains: personas.length ? totalPains / personas.length : 0,
    distinctRoles: roles.size,
  };
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-user-persona-creator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  productType: ProductType;
  productName: string;
  count: number;
  personaNames: string[];
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

// ---------- Shareable URL ----------

export function buildShareUrl(input: PersonaInput): string {
  const params = new URLSearchParams();
  params.set("pt", input.productType);
  if (input.productName) params.set("pn", input.productName.slice(0, 200));
  if (input.productDescription) params.set("pd", input.productDescription.slice(0, 2000));
  if (input.audience) params.set("au", input.audience.slice(0, 2000));
  params.set("n", String(input.count));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: Partial<PersonaInput> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: {} };
  const params = new URLSearchParams(clean);
  const ptRaw = params.get("pt");
  const productType = ptRaw && PRODUCT_TYPES.includes(ptRaw as ProductType) ? (ptRaw as ProductType) : undefined;
  const nRaw = params.get("n");
  const count = nRaw ? Math.max(1, Math.min(4, parseInt(nRaw, 10) || 1)) : undefined;
  return {
    input: {
      productType,
      productName: params.get("pn") ?? undefined,
      productDescription: params.get("pd") ?? undefined,
      audience: params.get("au") ?? undefined,
      count,
    },
  };
}

// Re-export internals for tests / consumers
export const EXPORTED_FOR_TESTS = {
  FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES,
  GOAL_BANK, PAIN_BANK, BEHAVIOR_BANK,
  MOTIVATION_BANK, FRUSTRATION_BANK, CHANNEL_BANK,
  TAGLINES, OCCUPATIONS, INDUSTRIES,
};
