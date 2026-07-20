/**
 * AI SWOT Analysis Creator — pure logic.
 *
 * Generate a structured SWOT analysis (Strengths, Weaknesses,
 * Opportunities, Threats) plus TOWS-derived strategy actions
 * (SO/ST/WO/WT) from a business / product / project description
 * + industry.
 *
 * Pure-JS template engine: industry-keyed starter templates with
 * concrete, specific bullets per quadrant, refined by keywords
 * detected in the description. The output is a structured matrix
 * that can be rendered as Markdown, JSON, or a 2×2 grid.
 *
 * Includes:
 *   - 14 industry templates (saas, ecommerce, agency, restaurant,
 *     freelance, nonprofit, mobile-app, hardware, podcast, blog,
 *     consulting, retail, fintech, education)
 *   - keyword-based quadrant enrichment
 *   - TOWS strategy-action generator (SO, ST, WO, WT)
 *   - editable quadrants (regenerate single quadrant)
 *   - prioritization scoring (impact × feasibility)
 *   - Markdown + JSON + HTML matrix export
 *   - validator (each quadrant has ≥1 bullet)
 *   - BYO-key LLM hook stub (not invoked here)
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: AI SWOT is a starting framework, not validated strategy
 * or business advice; verify with real data. On-device templates
 * are less nuanced than a BYO-key LLM. Nothing is uploaded or
 * logged by us.
 */

// ---------- Types ----------

export type Quadrant = "strengths" | "weaknesses" | "opportunities" | "threats";

export interface SwotItem {
  text: string;
  /** Impact score 1-5; used for prioritization. */
  impact: number;
  /** Feasibility score 1-5 (only meaningful for action items, 0 otherwise). */
  feasibility: number;
}

export interface SwotMatrix {
  subject: string;
  industry: string;
  goal: string;
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
  tows: TowsAction[];
  warnings: string[];
  generatedAt: number;
}

export type TowsStrategy = "SO" | "ST" | "WO" | "WT";

export interface TowsAction {
  strategy: TowsStrategy;
  action: string;
  impact: number;
  feasibility: number;
  score: number; // impact × feasibility
}

export interface IndustryTemplate {
  id: string;
  label: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  subject: string;
  industry: string;
  itemCount: number;
}

// ---------- Industry templates ----------

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: "saas",
    label: "SaaS / Software",
    strengths: [
      "Recurring revenue with predictable MRR/ARR",
      "Low marginal cost per new customer",
      "Scalable infrastructure with multi-tenant architecture",
      "Rich product analytics from in-app behavior",
    ],
    weaknesses: [
      "High customer acquisition cost (CAC) in crowded market",
      "Churn risk if onboarding fails to deliver first value fast",
      "Long sales cycles for enterprise tiers",
      "Heavy reliance on a small engineering team for shipping",
    ],
    opportunities: [
      "AI-native features that incumbents are slow to ship",
      "Vertical specialization in an underserved niche",
      "Partner ecosystem / marketplace for third-party integrations",
      "Usage-based pricing tier that unlocks mid-market accounts",
    ],
    threats: [
      "Well-funded incumbent bundling similar features for free",
      "Open-source alternative gaining developer mind-share",
      "Data-residency / compliance requirements expanding per region",
      "Platform risk from app-store or cloud-provider policy changes",
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce / DTC",
    strengths: [
      "Direct relationship with end customers (first-party data)",
      "Brand-controlled storefront and checkout experience",
      "Agile merchandising — new SKUs live in days",
      "Owned email/SMS list with high deliverability",
    ],
    weaknesses: [
      "Thin margins after ad spend and shipping",
      "Inventory and forecasting risk for seasonal peaks",
      "Returns and reverse logistics erode margin further",
      "Single-channel dependency (e.g. paid social) for acquisition",
    ],
    opportunities: [
      "Subscription / auto-replenish on consumable SKUs",
      "Retail or wholesale partnerships to reach new buyers",
      "International expansion with localized storefronts",
      "Loyalty program that lifts LTV beyond first purchase",
    ],
    threats: [
      "Rising CPMs and signal loss from privacy changes (iOS, cookies)",
      "Marketplace competitors undercutting on price",
      "Supply-chain disruption on key SKUs or components",
      "Tariff / currency shifts hitting landed cost",
    ],
  },
  {
    id: "agency",
    label: "Agency / Services",
    strengths: [
      "Deep bench of senior practitioners across disciplines",
      "Long-term retainer relationships with anchor clients",
      "Portfolio of case studies that compound credibility",
      "Flexible resourcing — can scale up or down per engagement",
    ],
    weaknesses: [
      "Revenue tightly tied to billable hours (capacity-bound)",
      "Key-person risk on a few flagship accounts",
      "Inconsistent new-business pipeline between quarters",
      "Talent retention pressure from in-house roles",
    ],
    opportunities: [
      "Productize a repeatable service into a fixed-price offering",
      "Niche vertical (e.g. health-tech, climate) positioning",
      "Strategic acquisition or partnership to add capability",
      "Recurring advisory / retainers replacing project work",
    ],
    threats: [
      "In-house teams insourcing work that was previously outsourced",
      "Race-to-the-bottom pricing from new market entrants",
      "Economic slowdown cutting client marketing budgets",
      "AI tools commoditizing junior execution work",
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant / Cafe",
    strengths: [
      "Signature dishes with a loyal local following",
      "Prime foot-traffic location with strong walk-in volume",
      "Experienced kitchen team with low turnover",
      "Strong reviews on Google / Yelp / TripAdvisor",
    ],
    weaknesses: [
      "Thin food-cost margins vulnerable to ingredient inflation",
      "Staffing gaps during peak hours / weekends",
      "Limited off-peak revenue (lunch-only or dinner-only)",
      "Dependency on a single supplier for key items",
    ],
    opportunities: [
      "Delivery / takeout channel expansion with own ordering page",
      "Catering and private events for predictable off-peak revenue",
      "Branded retail product (sauce, merch, cook-book)",
      "Loyalty program driving repeat visits",
    ],
    threats: [
      "Rising minimum wage and labor regulation",
      "New competitors opening within walking distance",
      "Food-cost inflation outpacing menu-price increases",
      "Negative online review going viral",
    ],
  },
  {
    id: "freelance",
    label: "Freelancer / Solo",
    strengths: [
      "Direct client relationships with fast decision-making",
      "Specialized expertise in a focused niche",
      "Low overhead — no team or office to support",
      "Flexible schedule and capacity to take or refuse work",
    ],
    weaknesses: [
      "Income capped by personal billable hours",
      "Feast-or-famine pipeline between projects",
      "No bench — sickness or vacation stops revenue",
      "Limited leverage for negotiation on larger deals",
    ],
    opportunities: [
      "Productize a fixed-scope offer to scale beyond hourly",
      "Hire a subcontractor to take on overflow work",
      "Build a course / community / template store for passive income",
      "Move upmarket to retainer-based advisory engagements",
    ],
    threats: [
      "Client consolidating vendors and dropping specialists",
      "AI tools commoditizing the entry-level of the craft",
      "Economic slowdown freezing discretionary project spend",
      "Platform dependency (Upwork, Fiverr) changing fee structure",
    ],
  },
  {
    id: "nonprofit",
    label: "Nonprofit / Charity",
    strengths: [
      "Mission-driven team with strong intrinsic motivation",
      "Trusted brand with engaged donor base",
      "Tax-exempt status enabling grant eligibility",
      "Volunteer network extending reach at low cost",
    ],
    weaknesses: [
      "Restricted funding limiting operational flexibility",
      "Underinvestment in technology and data infrastructure",
      "Heavy reliance on a few large donors or grants",
      "Slow governance cycles (board approval, audits)",
    ],
    opportunities: [
      "Corporate partnership program for recurring sponsorship",
      "Digital campaign expanding to younger donor segments",
      "Earned-revenue stream (training, consulting, paid events)",
      "Program expansion into adjacent issue areas",
    ],
    threats: [
      "Donor fatigue in a crowded cause landscape",
      "Reduction in government grant funding",
      "Negative media scrutiny on overhead ratios",
      "Economic recession depressing individual giving",
    ],
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    strengths: [
      "Tight, focused feature set with strong retention",
      "Native performance and offline capability",
      "Push-notification channel for re-engagement",
      "Strong app-store ratings and review velocity",
    ],
    weaknesses: [
      "30% platform fee on in-app subscriptions",
      "App-store review cycle slowing release cadence",
      "Acquisition cost per install rising in paid channels",
      "Limited attribution visibility post privacy changes",
    ],
    opportunities: [
      "Cross-platform expansion (web or other OS)",
      "Subscription tier unlocking premium features",
      "B2B / enterprise licensing of the app",
      "AI features that differentiate from incumbents",
    ],
    threats: [
      "Platform policy change (e.g.ATT, sideloading rules)",
      "Well-funded incumbent shipping a clone",
      "User churn from a poorly-received major update",
      "Regulatory pressure on data practices (GDPR, DMA)",
    ],
  },
  {
    id: "hardware",
    label: "Hardware / IoT",
    strengths: [
      "Differentiated industrial design and build quality",
      "Patented core technology with defensive moat",
      "Strong direct relationship with early-adopter customers",
      "Vertical integration reducing supplier risk",
    ],
    weaknesses: [
      "Long R&D and certification cycles before revenue",
      "High upfront tooling and inventory investment",
      "Cash-flow exposure to component-price volatility",
      "Limited software / firmware team velocity",
    ],
    opportunities: [
      "Subscription / consumable recurring revenue (razors-and-blades)",
      "Enterprise or B2B channel for the same hardware",
      "Accessories ecosystem extending the platform",
      "Second-generation product addressing a larger segment",
    ],
    threats: [
      "Component shortage or single-source supplier risk",
      "Cheaper clone from a low-cost manufacturer",
      "Regulatory change (safety, RF, environmental)",
      "Channel concentration through one retailer",
    ],
  },
  {
    id: "podcast",
    label: "Podcast / Media",
    strengths: [
      "Niche audience with high engagement and trust",
      "Strong host-to-listener parasocial relationship",
      "Owned distribution list and direct listener access",
      "Back-catalog of evergreen episodes still discovered",
    ],
    weaknesses: [
      "Sponsorship revenue concentrated in a few deals",
      "Production time per episode limits cadence",
      "Limited analytics from podcast platforms",
      "Host-dependent — hard to grow team or hand off",
    ],
    opportunities: [
      "Premium subscription tier with bonus content",
      "Live events or tours extending the brand offline",
      "Spin-off shows building a network effect",
      "Branded merchandise or book deal",
    ],
    threats: [
      "Platform consolidation changing discovery algorithms",
      "Advertiser budget cuts in a downturn",
      "Audience attention shifting to short-form video",
      "AI-generated content flooding the category",
    ],
  },
  {
    id: "blog",
    label: "Blog / Content Site",
    strengths: [
      "Strong organic-search traffic from evergreen content",
      "Low operating costs (writer + hosting)",
      "Diversified revenue (ads, affiliates, sponsored)",
      "Email list compounding as the most-owned channel",
    ],
    weaknesses: [
      "Algorithm-dependent traffic from Google updates",
      "Ad RPM volatility across quarters",
      "Slow growth without paid promotion",
      "Single-writer dependency limiting output",
    ],
    opportunities: [
      "Digital product (course, ebook, template) for first-party revenue",
      "Membership / paywall on premium content",
      "Sponsored newsletter takeover at higher CPM",
      "Topic expansion into adjacent high-intent niches",
    ],
    threats: [
      "Google core update slashing rankings overnight",
      "AI-generated competitor content saturating the SERP",
      "Privacy changes reducing ad-targeting revenue",
      "Affiliate program commission cuts",
    ],
  },
  {
    id: "consulting",
    label: "Consulting",
    strengths: [
      "Senior practitioners with recognized expertise",
      "Repeatable methodology and IP from past engagements",
      "Reference clients across multiple sectors",
      "Premium pricing supported by outcomes delivered",
    ],
    weaknesses: [
      "Capacity-bound by senior partner hours",
      "Long sales cycle on multi-year transformation deals",
      "Bench cost when pipeline slips between quarters",
      "Heavy travel demand on key personnel",
    ],
    opportunities: [
      "Productized diagnostic or assessment offering",
      "Strategic partnership with a tech vendor for implementation",
      "Geographic expansion into a new market",
      "Subscription advisory retainer (research, briefings)",
    ],
    threats: [
      "Big-4 incumbents underpricing on marquee accounts",
      "Client insourcing of strategy functions",
      "Economic slowdown delaying discretionary projects",
      "Reputational risk from a high-profile failed engagement",
    ],
  },
  {
    id: "retail",
    label: "Retail Store",
    strengths: [
      "Prime location with strong foot traffic",
      "Knowledgeable long-tenured staff",
      "Curated selection differentiated from big-box",
      "Strong community ties and local events",
    ],
    weaknesses: [
      "High fixed rent and labor cost",
      "Limited e-commerce capability vs. online-only competitors",
      "Inventory tied up in slow-moving SKUs",
      "Sales concentrated in Q4 holiday peak",
    ],
    opportunities: [
      "Local delivery or BOPIS for online orders",
      "Pop-up locations or partnerships with adjacent stores",
      "Private-label products with higher margin",
      "Loyalty app driving repeat visits",
    ],
    threats: [
      "Big-box or online competitor undercutting on price",
      "Rent escalation at lease renewal",
      "Minimum-wage increases and labor shortages",
      "Local economic downturn reducing discretionary spend",
    ],
  },
  {
    id: "fintech",
    label: "Fintech",
    strengths: [
      "Modern tech stack with API-first integrations",
      "Lower cost-to-serve than incumbent banks",
      "Strong UX reducing support load and churn",
      "Regulatory licenses enabling broader product set",
    ],
    weaknesses: [
      "Customer acquisition cost in a regulated category",
      "Compliance overhead scaling with product expansion",
      "Thin unit economics before reaching deposit/loan scale",
      "Reliance on third-party banking / payments partners",
    ],
    opportunities: [
      "Embedded finance partnerships with non-financial brands",
      "Geographic expansion into underserved markets",
      "Adjacent product (lending, savings, insurance) for existing users",
      "B2B / SMB tier with higher ARPU",
    ],
    threats: [
      "Regulatory change increasing capital requirements",
      "Incumbent bank launching a competing digital product",
      "Fraud event damaging customer trust",
      "Funding-market squeeze raising cost of capital",
    ],
  },
  {
    id: "education",
    label: "Education / Course",
    strengths: [
      "Outcome-focused curriculum with verifiable results",
      "Recognized instructor with industry credibility",
      "Community of alumni providing word-of-mouth",
      "Reusable content assets reducing per-cohort cost",
    ],
    weaknesses: [
      "Cohort-based revenue lumpiness between launches",
      "High-touch support limiting cohort size",
      "Completion rate sensitive to instructional design",
      "Single-instructor dependency limiting scale",
    ],
    opportunities: [
      "Self-paced tier with broader reach and lower price",
      "Corporate / B2B licensing to L&D departments",
      "Certification pathway aligned to industry credentials",
      "Alumni community subscription for ongoing revenue",
    ],
    threats: [
      "Free or low-cost MOOC competitor with similar content",
      "AI tutor commoditizing entry-level instruction",
      "Job-market shift reducing demand for the skill",
      "Platform dependency (Udemy, Coursera) changing terms",
    ],
  },
];

export const INDUSTRY_BY_ID: Record<string, IndustryTemplate> = Object.fromEntries(
  INDUSTRY_TEMPLATES.map((t) => [t.id, t]),
);

export const INDUSTRY_IDS = INDUSTRY_TEMPLATES.map((t) => t.id);

// ---------- Keyword-based quadrant enrichment ----------

interface KeywordRule {
  match: RegExp;
  quadrant: Quadrant;
  items: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  { match: /\brecur(ring)?\b|subscription|MRR|ARR/i, quadrant: "strengths", items: ["Recurring revenue base providing predictable cash flow"] },
  { match: /\bpatent\b|proprietary|IP\b/i, quadrant: "strengths", items: ["Defensible IP / patents creating a competitive moat"] },
  { match: /\bbrand\b|loyal|community/i, quadrant: "strengths", items: ["Strong brand equity with an engaged community"] },
  { match: /\bbootstrap|self-fund|no funding/i, quadrant: "strengths", items: ["Profitable / capital-efficient without dilution pressure"] },

  { match: /\bsingle (founder|person)|solo\b/i, quadrant: "weaknesses", items: ["Single-founder dependency on key decisions and execution"] },
  { match: /\bchurn\b|cancel/i, quadrant: "weaknesses", items: ["Churn above industry benchmark dragging net revenue retention"] },
  { match: /\blegacy|outdated|technical debt/i, quadrant: "weaknesses", items: ["Legacy / technical-debt slowing feature velocity"] },
  { match: /\bthin margin|low margin/i, quadrant: "weaknesses", items: ["Thin gross margin limiting reinvestment capacity"] },

  { match: /\bAI\b|machine learning|LLM\b/i, quadrant: "opportunities", items: ["AI-native product features incumbents are slow to ship"] },
  { match: /\binternational|expansion|new market/i, quadrant: "opportunities", items: ["Geographic expansion into underserved markets"] },
  { match: /\bpartnership|integration|ecosystem/i, quadrant: "opportunities", items: ["Partner / integration ecosystem unlocking new distribution"] },
  { match: /\benterprise|B2B|upmarket/i, quadrant: "opportunities", items: ["Move upmarket into higher-ARPU enterprise tier"] },

  { match: /\bincumbent|big (tech|bank)|competitor/i, quadrant: "threats", items: ["Well-funded incumbent bundling a similar feature for free"] },
  { match: /\bregulation|compliance|GDPR|privacy/i, quadrant: "threats", items: ["Expanding regulatory / compliance burden per region"] },
  { match: /\brecession|downturn|inflation/i, quadrant: "threats", items: ["Macroeconomic slowdown cutting discretionary customer spend"] },
  { match: /\bopen[- ]source|commodit/i, quadrant: "threats", items: ["Open-source / commodity alternative undercutting price"] },
];

// ---------- Helpers ----------

export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Find the best-matching industry template from a free-text industry hint. */
export function detectIndustry(industryHint: string): string {
  const h = (industryHint || "").toLowerCase().trim();
  if (!h) return "saas";
  if (INDUSTRY_BY_ID[h]) return h;
  for (const t of INDUSTRY_TEMPLATES) {
    if (h.includes(t.id) || t.label.toLowerCase().includes(h)) return t.id;
  }
  // Keyword fallbacks
  const map: Record<string, string> = {
    software: "saas", app: "mobile-app", mobile: "mobile-app",
    shop: "ecommerce", store: "retail", cafe: "restaurant", food: "restaurant",
    freelance: "freelance", solo: "freelance", charity: "nonprofit",
    device: "hardware", iot: "hardware", hardware: "hardware",
    audio: "podcast", video: "podcast", course: "education", teaching: "education",
    bank: "fintech", finance: "fintech", payment: "fintech",
    consulting: "consulting", blog: "blog", content: "blog",
  };
  for (const k of Object.keys(map)) {
    if (h.includes(k)) return map[k];
  }
  return "saas";
}

/** Apply keyword rules to enrich a quadrant with description-specific items. */
export function enrichFromDescription(
  description: string,
  base: Record<Quadrant, SwotItem[]>,
): Record<Quadrant, SwotItem[]> {
  const out: Record<Quadrant, SwotItem[]> = {
    strengths: [...base.strengths],
    weaknesses: [...base.weaknesses],
    opportunities: [...base.opportunities],
    threats: [...base.threats],
  };
  if (!description) return out;
  const seen = new Set<string>();
  for (const q of ["strengths", "weaknesses", "opportunities", "threats"] as Quadrant[]) {
    for (const it of out[q]) seen.add(it.text.toLowerCase());
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(description)) {
      for (const item of rule.items) {
        if (!seen.has(item.toLowerCase())) {
          out[rule.quadrant].push({ text: item, impact: 3, feasibility: 0 });
          seen.add(item.toLowerCase());
        }
      }
    }
  }
  return out;
}

/** Cap each quadrant to a maximum number of items, keeping the highest-impact ones. */
export function capQuadrants(
  matrix: Record<Quadrant, SwotItem[]>,
  maxPerQuadrant: number,
): Record<Quadrant, SwotItem[]> {
  const out: Record<Quadrant, SwotItem[]> = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  };
  for (const q of ["strengths", "weaknesses", "opportunities", "threats"] as Quadrant[]) {
    out[q] = [...matrix[q]]
      .sort((a, b) => b.impact - a.impact)
      .slice(0, Math.max(1, maxPerQuadrant));
  }
  return out;
}

// ---------- TOWS strategy actions ----------

export function generateTows(matrix: {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
}): TowsAction[] {
  const actions: TowsAction[] = [];
  // SO: use strengths to capture opportunities
  for (const s of matrix.strengths.slice(0, 3)) {
    for (const o of matrix.opportunities.slice(0, 2)) {
      const impact = clamp(Math.round((s.impact + o.impact) / 2), 1, 5);
      const feasibility = clamp(Math.round((s.impact + 5) / 2), 1, 5);
      actions.push({
        strategy: "SO",
        action: `Leverage "${truncate(s.text)}" to capture "${truncate(o.text)}".`,
        impact,
        feasibility,
        score: impact * feasibility,
      });
    }
  }
  // ST: use strengths to defend against threats
  for (const s of matrix.strengths.slice(0, 2)) {
    for (const t of matrix.threats.slice(0, 2)) {
      const impact = clamp(Math.round((s.impact + t.impact) / 2), 1, 5);
      const feasibility = clamp(Math.round((s.impact + 4) / 2), 1, 5);
      actions.push({
        strategy: "ST",
        action: `Use "${truncate(s.text)}" to defend against "${truncate(t.text)}".`,
        impact,
        feasibility,
        score: impact * feasibility,
      });
    }
  }
  // WO: improve weaknesses to capture opportunities
  for (const w of matrix.weaknesses.slice(0, 2)) {
    for (const o of matrix.opportunities.slice(0, 2)) {
      const impact = clamp(Math.round((w.impact + o.impact) / 2), 1, 5);
      const feasibility = clamp(Math.round((6 - w.impact + o.impact) / 2), 1, 5);
      actions.push({
        strategy: "WO",
        action: `Fix "${truncate(w.text)}" to unlock "${truncate(o.text)}".`,
        impact,
        feasibility,
        score: impact * feasibility,
      });
    }
  }
  // WT: mitigate weaknesses to reduce threats
  for (const w of matrix.weaknesses.slice(0, 2)) {
    for (const t of matrix.threats.slice(0, 2)) {
      const impact = clamp(Math.round((w.impact + t.impact) / 2), 1, 5);
      const feasibility = clamp(Math.round((6 - w.impact + 5) / 2), 1, 5);
      actions.push({
        strategy: "WT",
        action: `Mitigate "${truncate(w.text)}" to reduce exposure to "${truncate(t.text)}".`,
        impact,
        feasibility,
        score: impact * feasibility,
      });
    }
  }
  return actions.sort((a, b) => b.score - a.score);
}

function truncate(s: string, n = 80): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

// ---------- Top-level generate ----------

export interface GenerateOptions {
  subject: string;
  industry: string;
  goal?: string;
  description?: string;
  maxPerQuadrant?: number;
  defaultImpact?: number;
}

export function generateSwot(opts: GenerateOptions): SwotMatrix {
  const warnings: string[] = [];
  const subject = normalizeText(opts.subject) || "Untitled subject";
  const industry = detectIndustry(opts.industry);
  const goal = normalizeText(opts.goal || "");
  const description = opts.description || "";
  const maxPer = clamp(opts.maxPerQuadrant ?? 6, 1, 12);
  const defaultImpact = clamp(opts.defaultImpact ?? 3, 1, 5);

  if (!opts.subject || !opts.subject.trim()) {
    warnings.push("Subject was empty — using a placeholder.");
  }
  if (!opts.industry || !opts.industry.trim()) {
    warnings.push("Industry hint was empty — defaulting to SaaS template.");
  }
  if (description.length < 20) {
    warnings.push("Description is short — bullets will lean on industry templates.");
  }

  const template = INDUSTRY_BY_ID[industry] ?? INDUSTRY_TEMPLATES[0];

  const base: Record<Quadrant, SwotItem[]> = {
    strengths: template.strengths.map((t) => ({ text: t, impact: defaultImpact + 1, feasibility: 0 })),
    weaknesses: template.weaknesses.map((t) => ({ text: t, impact: defaultImpact, feasibility: 0 })),
    opportunities: template.opportunities.map((t) => ({ text: t, impact: defaultImpact + 1, feasibility: 0 })),
    threats: template.threats.map((t) => ({ text: t, impact: defaultImpact, feasibility: 0 })),
  };

  const enriched = enrichFromDescription(description, base);
  const capped = capQuadrants(enriched, maxPer);
  const tows = generateTows(capped);

  return {
    subject,
    industry,
    goal,
    strengths: capped.strengths,
    weaknesses: capped.weaknesses,
    opportunities: capped.opportunities,
    threats: capped.threats,
    tows,
    warnings,
    generatedAt: Date.now(),
  };
}

/** Regenerate a single quadrant (preserves the rest of the matrix). */
export function regenerateQuadrant(
  matrix: SwotMatrix,
  quadrant: Quadrant,
  newItems: SwotItem[],
): SwotMatrix {
  const next: SwotMatrix = {
    ...matrix,
    [quadrant]: newItems,
  };
  next.tows = generateTows({
    strengths: next.strengths,
    weaknesses: next.weaknesses,
    opportunities: next.opportunities,
    threats: next.threats,
  });
  return next;
}

// ---------- Validator ----------

export function validateSwot(matrix: SwotMatrix): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!matrix.subject) errors.push("Subject is empty.");
  for (const q of ["strengths", "weaknesses", "opportunities", "threats"] as Quadrant[]) {
    if (!matrix[q] || matrix[q].length === 0) {
      errors.push(`Quadrant "${q}" has no items.`);
    }
  }
  if (matrix.tows.length === 0) {
    warnings.push("No TOWS actions generated.");
  }
  for (const q of ["strengths", "weaknesses", "opportunities", "threats"] as Quadrant[]) {
    for (const it of matrix[q]) {
      if (it.impact < 1 || it.impact > 5) {
        warnings.push(`Item "${truncate(it.text)}" has out-of-range impact (${it.impact}).`);
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------- Renderers ----------

export function renderMarkdown(matrix: SwotMatrix): string {
  const lines: string[] = [];
  lines.push(`# SWOT Analysis: ${matrix.subject}`);
  lines.push("");
  if (matrix.goal) lines.push(`**Goal:** ${matrix.goal}`);
  lines.push(`**Industry:** ${matrix.industry}`);
  lines.push(`**Generated:** ${new Date(matrix.generatedAt).toISOString()}`);
  lines.push("");
  lines.push("## Strengths");
  for (const s of matrix.strengths) lines.push(`- ${s.text} _(impact: ${s.impact})_`);
  lines.push("");
  lines.push("## Weaknesses");
  for (const w of matrix.weaknesses) lines.push(`- ${w.text} _(impact: ${w.impact})_`);
  lines.push("");
  lines.push("## Opportunities");
  for (const o of matrix.opportunities) lines.push(`- ${o.text} _(impact: ${o.impact})_`);
  lines.push("");
  lines.push("## Threats");
  for (const t of matrix.threats) lines.push(`- ${t.text} _(impact: ${t.impact})_`);
  lines.push("");
  lines.push("## TOWS Strategy Actions");
  for (const a of matrix.tows) {
    lines.push(`- **[${a.strategy}]** ${a.action} _(impact×feasibility: ${a.score})_`);
  }
  if (matrix.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    for (const w of matrix.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function renderJson(matrix: SwotMatrix): string {
  return JSON.stringify(matrix, null, 2);
}

export function renderHtmlMatrix(matrix: SwotMatrix): string {
  const cell = (title: string, cls: string, items: SwotItem[]) => `
    <div class="swot-cell swot-${cls}">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((i) => `<li>${escapeHtml(i.text)} <span class="impact">(${i.impact})</span></li>`).join("")}</ul>
    </div>`.trim();
  return `<div class="swot-matrix">
  <div class="swot-row">
    ${cell("Strengths", "strengths", matrix.strengths)}
    ${cell("Weaknesses", "weaknesses", matrix.weaknesses)}
  </div>
  <div class="swot-row">
    ${cell("Opportunities", "opportunities", matrix.opportunities)}
    ${cell("Threats", "threats", matrix.threats)}
  </div>
</div>`;
}

export function renderTowsTable(matrix: SwotMatrix): string {
  const rows = matrix.tows.map((a) =>
    `    <tr><td>${a.strategy}</td><td>${escapeHtml(a.action)}</td><td>${a.impact}</td><td>${a.feasibility}</td><td>${a.score}</td></tr>`,
  ).join("\n");
  return `<table class="tows-table">
  <thead><tr><th>Strategy</th><th>Action</th><th>Impact</th><th>Feasibility</th><th>Score</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Prioritization ----------

/** Sort TOWS actions by score (impact × feasibility), descending. */
export function prioritizeTows(actions: TowsAction[]): TowsAction[] {
  return [...actions].sort((a, b) => b.score - a.score);
}

/** Return the top-N highest-impact items in a quadrant. */
export function topByImpact(items: SwotItem[], n: number): SwotItem[] {
  return [...items].sort((a, b) => b.impact - a.impact).slice(0, Math.max(0, n));
}

// ---------- BYO-key LLM hook (stubbed — not invoked) ----------

export interface LlmEnhanceRequest {
  apiKey: string;
  subject: string;
  industry: string;
  description: string;
  goal: string;
}

/**
 * Build the request body for a BYO-key LLM SWOT enhancement call.
 * Pure: returns the body string. The actual fetch is performed in the
 * UI layer only when the user supplies an API key.
 */
export function buildLlmRequestBody(req: LlmEnhanceRequest): string {
  const sys = "You are a strategy consultant. Return ONLY a JSON object with keys strengths, weaknesses, opportunities, threats. Each value is an array of {text, impact} where impact is 1-5. Be specific and concrete; avoid generic filler. Do not include markdown or commentary.";
  const user = `Subject: ${req.subject}\nIndustry: ${req.industry}\nGoal: ${req.goal}\nDescription: ${req.description}`;
  return JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });
}

/** Parse an LLM JSON response into a partial SwotMatrix (no TOWS). */
export function parseLlmSwotResponse(text: string, base: SwotMatrix): SwotMatrix | null {
  if (!text) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text);
  } catch {
    // Try to extract a JSON object from surrounding text
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      j = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const toItems = (v: unknown): SwotItem[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((x): SwotItem | null => {
        if (typeof x === "string") return { text: x, impact: 3, feasibility: 0 };
        if (x && typeof x === "object" && "text" in x) {
          const impactRaw = (x as { impact?: unknown }).impact;
          const impact = typeof impactRaw === "number" ? clamp(Math.round(impactRaw), 1, 5) : 3;
          return { text: String((x as { text: unknown }).text), impact, feasibility: 0 };
        }
        return null;
      })
      .filter((x): x is SwotItem => x !== null);
  };
  const next: SwotMatrix = {
    ...base,
    strengths: toItems(j.strengths),
    weaknesses: toItems(j.weaknesses),
    opportunities: toItems(j.opportunities),
    threats: toItems(j.threats),
  };
  next.tows = generateTows({
    strengths: next.strengths,
    weaknesses: next.weaknesses,
    opportunities: next.opportunities,
    threats: next.threats,
  });
  return next;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-swot-analysis-creator:history";
const HISTORY_MAX = 20;

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

export interface ShareParams {
  subject: string;
  industry: string;
  goal: string;
  description: string;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  if (p.subject) params.set("subject", p.subject);
  if (p.industry) params.set("industry", p.industry);
  if (p.goal) params.set("goal", p.goal);
  if (p.description) params.set("desc", p.description);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareParams> = {};
  const subject = params.get("subject");
  if (subject) out.subject = subject;
  const industry = params.get("industry");
  if (industry) out.industry = industry;
  const goal = params.get("goal");
  if (goal) out.goal = goal;
  const desc = params.get("desc");
  if (desc) out.description = desc;
  return out;
}
