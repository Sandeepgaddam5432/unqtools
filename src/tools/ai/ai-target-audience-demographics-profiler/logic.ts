/**
 * AI Target Audience Demographics Profiler — pure logic.
 *
 * Build structured audience profiles from a product description.
 * Pure functions only — no DOM, no network.
 */

export type Category =
  | "b2b-saas"
  | "consumer-app"
  | "e-commerce"
  | "marketplace"
  | "media-content"
  | "dev-tool"
  | "education"
  | "healthcare"
  | "finance-fintech"
  | "nonprofit-community"
  | "generic";

export type Tone = "formal" | "casual" | "data-driven";

export interface CategoryTemplate {
  category: Category;
  label: string;
  ageRange: string;
  incomeRange: string;
  location: string;
  education: string;
  topChannels: string[];
  topPains: string[];
  topGoals: string[];
  commonObjections: string[];
  buyingTriggers: string[];
  values: string[];
  interests: string[];
}

export interface Persona {
  name: string;
  role: string;
  age: number;
  gender: string;
  location: string;
  income: string;
  dayInTheLife: string[];
  quote: string;
}

export interface Segment {
  id: string;
  label: string;
  demographics: {
    ageRange: string;
    gender: string;
    incomeRange: string;
    location: string;
    education: string;
  };
  psychographics: {
    values: string[];
    interests: string[];
    lifestyle: string;
  };
  goals: string[];
  pains: string[];
  channels: string[];
  messagingAngles: string[];
  objections: string[];
  buyingTriggers: string[];
  persona: Persona;
  icpScore: number;
  icpBreakdown: { fit: number; urgency: number; budget: number; accessibility: number; expansion: number };
}

export interface ProfileResult {
  product: string;
  category: Category;
  tone: Tone;
  segments: Segment[];
  icp: {
    bestSegmentId: string;
    rationale: string;
    checklist: string[];
  };
  honestyNote: string;
}

export const CATEGORY_TEMPLATES: Record<Category, CategoryTemplate> = {
  "b2b-saas": {
    category: "b2b-saas",
    label: "B2B SaaS",
    ageRange: "28-45",
    incomeRange: "$80k-$180k",
    location: "Urban tech hubs (SF, NYC, Austin, London, Berlin)",
    education: "Bachelor's or higher",
    topChannels: ["LinkedIn", "Industry Slack", "Product Hunt", "Email", "Tech blogs"],
    topPains: ["Manual workflows", "Tool fragmentation", "Scaling operations", "Reporting overhead"],
    topGoals: ["Improve team productivity", "Reduce costs", "Demonstrate ROI", "Scale without hiring"],
    commonObjections: ["Switching cost", "Security review", "Need IT buy-in", "Already using a competitor"],
    buyingTriggers: ["New funding round", "Team growth", "Audit/security review", "Competitor failure"],
    values: ["Efficiency", "Data-driven decisions", "Career growth"],
    interests: ["Product management", "SaaS metrics", "Industry trends", "Networking"],
  },
  "consumer-app": {
    category: "consumer-app",
    label: "Consumer App",
    ageRange: "18-35",
    incomeRange: "$30k-$90k",
    location: "Urban and suburban",
    education: "Some college or higher",
    topChannels: ["TikTok", "Instagram", "YouTube", "Reddit", "Friends/family"],
    topPains: ["Boredom", "FOMO", "Time waste", "Cost of subscriptions"],
    topGoals: ["Be entertained", "Save time", "Stay connected", "Look good socially"],
    commonObjections: ["Privacy concerns", "Too many apps already", "Free alternative exists"],
    buyingTriggers: ["Viral trend", "Friend recommendation", "Free trial", "Limited-time offer"],
    values: ["Authenticity", "Convenience", "Self-expression"],
    interests: ["Pop culture", "Social media", "Gaming", "Music"],
  },
  "e-commerce": {
    category: "e-commerce",
    label: "E-commerce",
    ageRange: "25-55",
    incomeRange: "$40k-$120k",
    location: "Suburban and urban",
    education: "Varies",
    topChannels: ["Instagram", "Facebook", "Google Search", "Email", "YouTube reviews"],
    topPains: ["Shipping costs", "Returns hassle", "Quality uncertainty", "Decision fatigue"],
    topGoals: ["Find good value", "Save time", "Get quality products", "Discover new brands"],
    commonObjections: ["Price", "Shipping time", "Trust in new brand", "Returns policy"],
    buyingTriggers: ["Discount code", "Free shipping", "Reviews", "Limited stock"],
    values: ["Value for money", "Convenience", "Quality"],
    interests: ["Shopping", "Home decor", "Fashion", "Deals"],
  },
  marketplace: {
    category: "marketplace",
    label: "Marketplace",
    ageRange: "22-50",
    incomeRange: "$30k-$150k",
    location: "Urban and suburban",
    education: "Varies",
    topChannels: ["Google Search", "Reddit", "YouTube", "Word of mouth", "Affiliate blogs"],
    topPains: ["Trust in sellers", "Quality consistency", "Payment safety", "Comparison fatigue"],
    topGoals: ["Find best deal", "Discover niche products", "Earn income (seller side)", "Compare options"],
    commonObjections: ["Trust", "Shipping cost", "Quality risk", "Payment security"],
    buyingTriggers: ["Reviews", "Money-back guarantee", "Seller reputation", "Discount"],
    values: ["Transparency", "Choice", "Fair pricing"],
    interests: ["Comparison shopping", "Niche hobbies", "Side hustles"],
  },
  "media-content": {
    category: "media-content",
    label: "Media / Content",
    ageRange: "20-45",
    incomeRange: "$30k-$100k",
    location: "Urban",
    education: "Bachelor's common",
    topChannels: ["YouTube", "Podcasts", "Twitter/X", "Newsletter", "TikTok"],
    topPains: ["Information overload", "Clickbait", "Paywalls", "Time scarcity"],
    topGoals: ["Stay informed", "Be entertained", "Learn new things", "Share with friends"],
    commonObjections: ["Subscription fatigue", "Ads", "Bias concerns", "Time commitment"],
    buyingTriggers: ["Free preview", "Trusted referral", "Exclusive content", "Trial offer"],
    values: ["Quality", "Credibility", "Entertainment"],
    interests: ["News", "Culture", "Technology", "Politics"],
  },
  "dev-tool": {
    category: "dev-tool",
    label: "Dev Tool",
    ageRange: "24-40",
    incomeRange: "$70k-$200k",
    location: "Remote / urban tech hubs",
    education: "CS degree or self-taught",
    topChannels: ["GitHub", "Hacker News", "Dev.to", "Twitter/X", "Discord"],
    topPains: ["Slow builds", "Tool sprawl", "Bad docs", "Vendor lock-in"],
    topGoals: ["Ship faster", "Write cleaner code", "Reduce ops burden", "Learn new stack"],
    commonObjections: ["Open-source alternative", "Lock-in", "Price", "Setup complexity"],
    buyingTriggers: ["Open source credibility", "Peer endorsement", "Free tier", "Docs quality"],
    values: ["Openness", "Developer experience", "Performance"],
    interests: ["Programming", "Open source", "New frameworks", "Side projects"],
  },
  education: {
    category: "education",
    label: "Education",
    ageRange: "18-45",
    incomeRange: "$20k-$90k",
    location: "Urban and suburban",
    education: "High school to graduate",
    topChannels: ["YouTube", "Reddit", "TikTok", "School/email", "Discord"],
    topPains: ["Cost of education", "Time pressure", "Motivation", "Unclear curriculum"],
    topGoals: ["Learn new skill", "Get a job", "Pass exams", "Save money vs traditional"],
    commonObjections: ["Quality concerns", "Cost", "Time commitment", "Self-discipline"],
    buyingTriggers: ["Scholarship", "Free trial", "Job guarantee", "Certificate"],
    values: ["Affordability", "Accessibility", "Practical outcomes"],
    interests: ["Self-improvement", "Career growth", "Hobbies"],
  },
  healthcare: {
    category: "healthcare",
    label: "Healthcare",
    ageRange: "30-65",
    incomeRange: "$40k-$150k",
    location: "Urban and rural",
    education: "Varies",
    topChannels: ["Doctor referral", "WebMD/Healthline", "Facebook", "Insurance portal", "Email"],
    topPains: ["Cost of care", "Appointment wait times", "Insurance complexity", "Trust in providers"],
    topGoals: ["Stay healthy", "Manage chronic condition", "Affordable care", "Find trusted provider"],
    commonObjections: ["Cost", "Insurance coverage", "Trust", "Privacy of health data"],
    buyingTriggers: ["Insurance coverage", "Doctor recommendation", "Symptom flare-up", "Family event"],
    values: ["Trust", "Privacy", "Affordability", "Quality of care"],
    interests: ["Wellness", "Fitness", "Nutrition", "Family health"],
  },
  "finance-fintech": {
    category: "finance-fintech",
    label: "Finance / Fintech",
    ageRange: "25-55",
    incomeRange: "$50k-$200k",
    location: "Urban",
    education: "Bachelor's common",
    topChannels: ["Reddit r/personalfinance", "YouTube", "Twitter/X", "Podcasts", "Email"],
    topPains: ["Complexity of finance", "Hidden fees", "Trust in platforms", "Saving enough"],
    topGoals: ["Save for retirement", "Invest wisely", "Avoid debt", "Build wealth"],
    commonObjections: ["Security concerns", "Fees", "Trust", "Already using bank/broker"],
    buyingTriggers: ["High-yield offer", "Security breach at competitor", "Friend referral", "Bonus"],
    values: ["Security", "Transparency", "Growth"],
    interests: ["Investing", "Personal finance", "Real estate", "Side income"],
  },
  "nonprofit-community": {
    category: "nonprofit-community",
    label: "Non-profit / Community",
    ageRange: "25-60",
    incomeRange: "$30k-$100k",
    location: "Urban and rural",
    education: "Varies",
    topChannels: ["Facebook", "Email", "Local events", "Word of mouth", "Instagram"],
    topPains: ["Limited resources", "Volunteer burnout", "Awareness", "Donor retention"],
    topGoals: ["Make impact", "Build community", "Raise funds", "Recruit volunteers"],
    commonObjections: ["Already donate elsewhere", "Trust in org", "Time commitment", "Visible impact"],
    buyingTriggers: ["Matching campaign", "Personal story", "Friend invitation", "Tax deadline"],
    values: ["Impact", "Community", "Transparency"],
    interests: ["Volunteering", "Cause area", "Community events"],
  },
  generic: {
    category: "generic",
    label: "Generic",
    ageRange: "25-55",
    incomeRange: "$40k-$120k",
    location: "Urban and suburban",
    education: "Varies",
    topChannels: ["Google Search", "Social media", "Email", "Word of mouth", "YouTube"],
    topPains: ["Cost", "Time", "Quality", "Trust"],
    topGoals: ["Save money", "Save time", "Improve quality of life", "Make informed decision"],
    commonObjections: ["Price", "Switching cost", "Trust", "Time to learn"],
    buyingTriggers: ["Discount", "Recommendation", "Free trial", "Urgency"],
    values: ["Value", "Trust", "Convenience"],
    interests: ["General", "Lifestyle", "Productivity"],
  },
};

export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  Object.entries(CATEGORY_TEMPLATES).map(([k, v]) => [k, v.label]),
) as Record<Category, string>;

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  casual: "Casual",
  "data-driven": "Data-driven",
};

export const PRODUCT_PRESETS: { label: string; product: string; category: Category }[] = [
  { label: "Project management SaaS", product: "A project management tool for remote engineering teams.", category: "b2b-saas" },
  { label: "Meditation app", product: "A meditation app for busy professionals.", category: "consumer-app" },
  { label: "Sustainable clothing store", product: "An online store for sustainable, ethically-made clothing.", category: "e-commerce" },
  { label: "Freelance designer marketplace", product: "A marketplace connecting startups with freelance designers.", category: "marketplace" },
  { label: "Indie tech newsletter", product: "A weekly newsletter covering indie tech startups.", category: "media-content" },
  { label: "Open-source observability tool", product: "An open-source observability platform for Kubernetes.", category: "dev-tool" },
  { label: "Online coding bootcamp", product: "A 12-week online coding bootcamp for career changers.", category: "education" },
  { label: "Telehealth platform", product: "A telehealth platform for chronic disease management.", category: "healthcare" },
  { label: "Robo-advisor app", product: "A robo-advisor app for millennial investors.", category: "finance-fintech" },
  { label: "Local food bank nonprofit", product: "A nonprofit coordinating food donations to local shelters.", category: "nonprofit-community" },
];

const PERSONA_NAMES = [
  "Alex Rivera", "Maya Chen", "Jordan Patel", "Sam Okafor", "Riley Kim",
  "Casey Nguyen", "Morgan Silva", "Jamie Lopez", "Drew Anderson", "Taylor Brooks",
];

const PERSONA_ROLES: Record<Category, string[]> = {
  "b2b-saas": ["VP of Engineering", "Head of Operations", "Product Manager", "CTO"],
  "consumer-app": ["Marketing Coordinator", "Graduate Student", "Freelance Designer", "Barista"],
  "e-commerce": ["Working Parent", "Small Business Owner", "College Student", "Remote Worker"],
  marketplace: ["Side Hustler", "Hobbyist Collector", "Small Retailer", "Bargain Hunter"],
  "media-content": ["Knowledge Worker", "Substack Writer", "Podcast Listener", "News Junkie"],
  "dev-tool": ["Senior Backend Engineer", "DevOps Lead", "Indie Hacker", "Engineering Manager"],
  education: ["Career Changer", "Bootcamp Student", "Working Parent Upskilling", "High Schooler"],
  healthcare: ["Chronic Patient", "Caregiver", "New Parent", "Aging Adult"],
  "finance-fintech": ["Millennial Saver", "First-time Investor", "Debt Payoff Planner", "High Earner"],
  "nonprofit-community": ["Community Organizer", "Volunteer Coordinator", "Cause Advocate", "Donor"],
  generic: ["Decision Maker", "Busy Professional", "Cost-conscious Consumer", "Quality Seeker"],
};

const DAY_IN_LIFE_TEMPLATES: Record<Category, string[]> = {
  "b2b-saas": [
    "Starts the day with a standup at 9am.",
    "Spends 4 hours in meetings and 3 in deep work.",
    "Juggles 5+ SaaS tools to keep the team aligned.",
    "Ends the day reviewing metrics dashboards.",
  ],
  "consumer-app": [
    "Wakes up, scrolls phone for 20 minutes.",
    "Commutes while listening to a podcast.",
    "Checks social apps 12+ times during the day.",
    "Winds down with a streaming show before bed.",
  ],
  "e-commerce": [
    "Browses products during lunch break.",
    "Compares prices across 3 sites before buying.",
    "Reads at least 5 reviews before purchase.",
    "Tracks shipment daily until it arrives.",
  ],
  marketplace: [
    "Lists items for sale on weekends.",
    "Compares seller reputations carefully.",
    "Negotiates prices via in-app chat.",
    "Leaves detailed reviews after each transaction.",
  ],
  "media-content": [
    "Skims 3 newsletters over morning coffee.",
    "Listens to a podcast during commute.",
    "Saves longreads to read later (rarely does).",
    "Shares favorite articles to social media.",
  ],
  "dev-tool": [
    "Opens IDE before email.",
    "Spends 30% of day in code reviews.",
    "Argues about tooling in team Slack.",
    "Hacks on side projects after hours.",
  ],
  education: [
    "Studies 1-2 hours after work.",
    "Watches tutorial videos at 1.5x speed.",
    "Joins Discord study groups.",
    "Tracks progress in a spreadsheet.",
  ],
  healthcare: [
    "Manages medications each morning.",
    "Books appointments weeks in advance.",
    "Researches symptoms before doctor visits.",
    "Tracks health metrics in an app.",
  ],
  "finance-fintech": [
    "Checks portfolio each morning.",
    "Reads personal finance blogs at lunch.",
    "Automates savings transfers on payday.",
    "Reviews monthly budget on Sundays.",
  ],
  "nonprofit-community": [
    "Volunteers 5+ hours per week.",
    "Coordinates with team via group chat.",
    "Recruits friends for events.",
    "Donates to causes during year-end campaigns.",
  ],
  generic: [
    "Checks phone within 5 minutes of waking.",
    "Researches purchases for 20+ minutes before buying.",
    "Asks friends for recommendations.",
    "Reads reviews before committing.",
  ],
};

const PERSONA_QUOTES = [
  "I don't have time for tools that don't save me time.",
  "Show me the proof, then I'll buy.",
  "If my friend recommends it, I'll try it.",
  "I'll pay more for quality I can trust.",
  "Make it simple or I'll bounce.",
  "Free first. Then we'll see.",
  "I need to see ROI before I commit.",
  "Privacy first. Always.",
];

function pick<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  let s = seed;
  while (out.length < n && used.size < arr.length) {
    s = (s * 9301 + 49297) % 233280;
    const idx = Math.floor((s / 233280) * arr.length);
    if (!used.has(idx)) {
      used.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

function buildPersona(category: Category, segmentIdx: number, seed: number): Persona {
  const roles = PERSONA_ROLES[category];
  const name = PERSONA_NAMES[(seed + segmentIdx) % PERSONA_NAMES.length];
  const role = roles[(seed + segmentIdx) % roles.length];
  const ageRange = CATEGORY_TEMPLATES[category].ageRange;
  const [minAge] = ageRange.split("-").map(Number);
  const age = minAge + ((seed + segmentIdx * 7) % 15);
  const genders = ["Female", "Male", "Non-binary"];
  const gender = genders[(seed + segmentIdx) % genders.length];
  const location = CATEGORY_TEMPLATES[category].location;
  const income = CATEGORY_TEMPLATES[category].incomeRange;
  const dayTemplates = DAY_IN_LIFE_TEMPLATES[category];
  const dayInTheLife = pick(dayTemplates, Math.min(4, dayTemplates.length), seed + segmentIdx);
  const quote = PERSONA_QUOTES[(seed + segmentIdx) % PERSONA_QUOTES.length];
  return { name, role, age, gender, location, income, dayInTheLife, quote };
}

function buildSegment(category: Category, label: string, idx: number, seed: number): Segment {
  const tpl = CATEGORY_TEMPLATES[category];
  const goals = pick(tpl.topGoals, Math.min(3, tpl.topGoals.length), seed + idx);
  const pains = pick(tpl.topPains, Math.min(3, tpl.topPains.length), seed + idx + 1);
  const channels = pick(tpl.topChannels, Math.min(4, tpl.topChannels.length), seed + idx + 2);
  const objections = pick(tpl.commonObjections, Math.min(3, tpl.commonObjections.length), seed + idx + 3);
  const triggers = pick(tpl.buyingTriggers, Math.min(3, tpl.buyingTriggers.length), seed + idx + 4);
  const values = pick(tpl.values, Math.min(3, tpl.values.length), seed + idx + 5);
  const interests = pick(tpl.interests, Math.min(3, tpl.interests.length), seed + idx + 6);

  const messagingAngles = goals.slice(0, 2).map((g) => `How ${tpl.label.toLowerCase()} helps you ${g.toLowerCase()}`);

  const icpBreakdown = {
    fit: 60 + ((seed + idx) % 35),
    urgency: 50 + ((seed + idx * 3) % 45),
    budget: 55 + ((seed + idx * 5) % 40),
    accessibility: 60 + ((seed + idx * 7) % 35),
    expansion: 50 + ((seed + idx * 11) % 45),
  };
  const icpScore = Math.round(
    (icpBreakdown.fit + icpBreakdown.urgency + icpBreakdown.budget + icpBreakdown.accessibility + icpBreakdown.expansion) / 5,
  );

  return {
    id: `segment-${idx + 1}`,
    label,
    demographics: {
      ageRange: tpl.ageRange,
      gender: "All (skews varied)",
      incomeRange: tpl.incomeRange,
      location: tpl.location,
      education: tpl.education,
    },
    psychographics: {
      values,
      interests,
      lifestyle: `Active in ${interests[0]?.toLowerCase() ?? "their field"}, values ${values[0]?.toLowerCase() ?? "quality"}.`,
    },
    goals,
    pains,
    channels,
    messagingAngles,
    objections,
    buyingTriggers: triggers,
    persona: buildPersona(category, idx, seed),
    icpScore,
    icpBreakdown,
  };
}

export function profileAudience(input: {
  product: string;
  category: Category;
  tone: Tone;
  segmentCount: 1 | 2 | 3;
  seed?: number;
}): ProfileResult {
  const seed = input.seed ?? Math.floor(Math.random() * 100000);
  const segmentLabels = ["Primary", "Secondary", "Tertiary"];
  const segments: Segment[] = [];
  for (let i = 0; i < input.segmentCount; i++) {
    segments.push(buildSegment(input.category, segmentLabels[i], i, seed));
  }

  // ICP = highest-scoring segment
  const best = segments.reduce((a, b) => (b.icpScore > a.icpScore ? b : a), segments[0]);
  const checklist = [
    `Best-fit segment: ${best.label} (score ${best.icpScore}/100)`,
    `Top channel to reach them: ${best.channels[0] ?? "n/a"}`,
    `Primary pain to solve: ${best.pains[0] ?? "n/a"}`,
    `Primary goal to deliver: ${best.goals[0] ?? "n/a"}`,
    `Top objection to overcome: ${best.objections[0] ?? "n/a"}`,
    `Top buying trigger: ${best.buyingTriggers[0] ?? "n/a"}`,
    `Validate with 5-10 customer interviews in this segment before scaling.`,
  ];
  const rationale = `The ${best.label} segment scores highest on ICP criteria (fit ${best.icpBreakdown.fit}, urgency ${best.icpBreakdown.urgency}, budget ${best.icpBreakdown.budget}, accessibility ${best.icpBreakdown.accessibility}, expansion ${best.icpBreakdown.expansion}). Validate this hypothesis with real customer interviews.`;

  const honestyNote =
    "This profile is an inferred hypothesis based on category templates, not validated market data. Use it as a starting point and validate with real customer interviews, surveys, and analytics before scaling marketing spend. Avoid stereotyping: demographics do not determine individual behavior.";

  return {
    product: input.product,
    category: input.category,
    tone: input.tone,
    segments,
    icp: {
      bestSegmentId: best.id,
      rationale,
      checklist,
    },
    honestyNote,
  };
}

export function renderMarkdown(result: ProfileResult): string {
  const lines: string[] = [];
  lines.push(`# Target Audience Profile`);
  lines.push("");
  lines.push(`**Product:** ${result.product}`);
  lines.push(`**Category:** ${CATEGORY_LABELS[result.category]}`);
  lines.push(`**Tone:** ${TONE_LABELS[result.tone]}`);
  lines.push("");
  lines.push(`> ⚠️ ${result.honestyNote}`);
  lines.push("");
  for (const seg of result.segments) {
    lines.push(`## ${seg.label} Segment (ICP score: ${seg.icpScore}/100)`);
    lines.push("");
    lines.push(`### Persona: ${seg.persona.name}, ${seg.persona.role}`);
    lines.push(`- Age: ${seg.persona.age}`);
    lines.push(`- Gender: ${seg.persona.gender}`);
    lines.push(`- Location: ${seg.persona.location}`);
    lines.push(`- Income: ${seg.persona.income}`);
    lines.push(`- Quote: "${seg.persona.quote}"`);
    lines.push("");
    lines.push(`**Day in the life:**`);
    for (const item of seg.persona.dayInTheLife) lines.push(`- ${item}`);
    lines.push("");
    lines.push(`### Demographics`);
    lines.push(`- Age range: ${seg.demographics.ageRange}`);
    lines.push(`- Income: ${seg.demographics.incomeRange}`);
    lines.push(`- Location: ${seg.demographics.location}`);
    lines.push(`- Education: ${seg.demographics.education}`);
    lines.push("");
    lines.push(`### Psychographics`);
    lines.push(`- Values: ${seg.psychographics.values.join(", ")}`);
    lines.push(`- Interests: ${seg.psychographics.interests.join(", ")}`);
    lines.push(`- Lifestyle: ${seg.psychographics.lifestyle}`);
    lines.push("");
    lines.push(`### Goals`);
    for (const g of seg.goals) lines.push(`- ${g}`);
    lines.push("");
    lines.push(`### Pains`);
    for (const p of seg.pains) lines.push(`- ${p}`);
    lines.push("");
    lines.push(`### Channels`);
    lines.push(`- ${seg.channels.join(", ")}`);
    lines.push("");
    lines.push(`### Messaging angles`);
    for (const m of seg.messagingAngles) lines.push(`- ${m}`);
    lines.push("");
    lines.push(`### Objections`);
    for (const o of seg.objections) lines.push(`- ${o}`);
    lines.push("");
    lines.push(`### Buying triggers`);
    for (const t of seg.buyingTriggers) lines.push(`- ${t}`);
    lines.push("");
    lines.push(`### ICP breakdown`);
    lines.push(`- Fit: ${seg.icpBreakdown.fit}/100`);
    lines.push(`- Urgency: ${seg.icpBreakdown.urgency}/100`);
    lines.push(`- Budget: ${seg.icpBreakdown.budget}/100`);
    lines.push(`- Accessibility: ${seg.icpBreakdown.accessibility}/100`);
    lines.push(`- Expansion: ${seg.icpBreakdown.expansion}/100`);
    lines.push("");
  }
  lines.push(`## Ideal Customer Profile (ICP)`);
  lines.push("");
  lines.push(`**Best segment:** ${result.segments.find((s) => s.id === result.icp.bestSegmentId)?.label ?? "n/a"}`);
  lines.push("");
  lines.push(`**Rationale:** ${result.icp.rationale}`);
  lines.push("");
  lines.push(`**ICP checklist:**`);
  for (const c of result.icp.checklist) lines.push(`- [ ] ${c}`);
  lines.push("");
  return lines.join("\n");
}

export function renderJson(result: ProfileResult): string {
  return JSON.stringify(result, null, 2);
}

// ---- History (localStorage) ----
const HISTORY_KEY = "unqtools:ai-target-audience-demographics-profiler:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  product: string;
  category: Category;
  segmentCount: number;
  topScore: number;
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
export function buildShareUrl(product: string, category: Category, tone: Tone, segmentCount: number): string {
  const params = new URLSearchParams();
  if (product) params.set("product", product);
  params.set("category", category);
  params.set("tone", tone);
  params.set("segments", String(segmentCount));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  product: string;
  category: Category;
  tone: Tone;
  segmentCount: 1 | 2 | 3;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const product = params.get("product") ?? "";
  const cat = params.get("category") as Category | null;
  const tone = params.get("tone") as Tone | null;
  const segRaw = Number(params.get("segments") ?? "1");
  const segmentCount = (segRaw === 2 || segRaw === 3 ? segRaw : 1) as 1 | 2 | 3;
  const validCats = Object.keys(CATEGORY_TEMPLATES) as Category[];
  const validTones = Object.keys(TONE_LABELS) as Tone[];
  return {
    product,
    category: cat && validCats.includes(cat) ? cat : "generic",
    tone: tone && validTones.includes(tone) ? tone : "formal",
    segmentCount,
  };
}

// ---- LLM prompt builder ----
export function buildLlmPrompt(input: {
  product: string;
  category: Category;
  tone: Tone;
  segmentCount: number;
}): string {
  return `You are a senior product marketing researcher. Given the product below, expand the target audience profile with richer detail. Return JSON only.\n\nProduct: ${input.product}\nCategory: ${CATEGORY_LABELS[input.category]}\nTone: ${TONE_LABELS[input.tone]}\nSegments: ${input.segmentCount}\n\nReturn JSON with this shape:\n{\n  "segments": [\n    {\n      "label": "Primary",\n      "demographics": { "ageRange": "...", "incomeRange": "...", "location": "...", "education": "..." },\n      "psychographics": { "values": [...], "interests": [...], "lifestyle": "..." },\n      "goals": [...], "pains": [...], "channels": [...],\n      "messagingAngles": [...], "objections": [...], "buyingTriggers": [...],\n      "persona": { "name": "...", "role": "...", "dayInTheLife": [...], "quote": "..." }\n    }\n  ],\n  "rationale": "..."\n}`;
}
