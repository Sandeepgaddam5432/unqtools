/**
 * AI Press Release Draft Builder — pure logic.
 *
 * Generate AP-style press release drafts from the 5 Ws + spokesperson +
 * boilerplate. Pure functions only — no DOM, no network. The optional LLM
 * call (BYO API key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type ReleaseType =
  | "product-launch"
  | "partnership"
  | "hiring"
  | "funding"
  | "event"
  | "award";

export type Tone = "formal" | "conversational" | "energetic";

export type Length = "short" | "standard" | "long";

export type Angle =
  | "benefit-led"
  | "fact-led"
  | "customer-led"
  | "trend-led"
  | "controversy-led";

export type NewsworthinessFactor =
  | "timeliness"
  | "proximity"
  | "impact"
  | "prominence"
  | "conflict"
  | "human-interest";

export interface ReleaseInputs {
  organization: string;
  what: string;          // the announcement
  when: string;          // date or "today"
  where: string;         // city, state
  why: string;           // significance
  who: string;           // spokesperson name + title (e.g. "Jane Doe, CEO")
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  boilerplate: string;   // about-the-company paragraph
}

export interface HeadlineVariant {
  angle: Angle;
  text: string;
  seoVariant: string;    // under 65 chars
}

export interface Quote {
  attribution: string;   // "[SPOKESPERSON NAME], [TITLE] of [ORGANIZATION]"
  text: string;          // the quote body — editable
  isPlaceholder: boolean;
}

export interface PressRelease {
  inputs: ReleaseInputs;
  releaseType: ReleaseType;
  tone: Tone;
  length: Length;
  headlineVariants: HeadlineVariant[];
  chosenHeadline: string;
  subhead: string;
  dateline: string;
  lede: string;          // opening paragraph (inverted pyramid top)
  bodyParagraphs: string[];
  quote: Quote;
  boilerplate: string;
  endMark: string;       // "###"
  wordCount: number;
  generatedAt: number;
}

export interface NewsworthinessFactorResult {
  factor: NewsworthinessFactor;
  score: 0 | 1 | 2;      // 0 = absent, 1 = weak, 2 = strong
  note: string;
}

export interface NewsworthinessResult {
  factors: NewsworthinessFactorResult[];
  totalScore: number;
  maxScore: number;
  verdict: "This is news" | "Borderline — strengthen the angle" | "Probably not news";
  suggestion: string;
}

export interface Stats {
  wordCount: number;
  targetWords: number;
  headlineChars: number;
  headlineSeoOk: boolean;  // <= 65 chars
  paragraphCount: number;
  releaseTypeLabel: string;
}

export interface HistoryEntry {
  ts: number;
  organization: string;
  what: string;
  releaseType: ReleaseType;
  tone: Tone;
  length: Length;
  headline: string;
  wordCount: number;
  newsworthiness: number;
}

export interface ShareState {
  organization: string;
  what: string;
  when: string;
  where: string;
  why: string;
  who: string;
  releaseType: ReleaseType;
  tone: Tone;
  length: Length;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-press-release-draft-builder:history";
export const HISTORY_MAX = 20;

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  "product-launch": "Product launch",
  "partnership": "Partnership",
  "hiring": "Hiring / appointment",
  "funding": "Funding round",
  "event": "Event",
  "award": "Award / recognition",
};

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal (wire-service standard)",
  conversational: "Conversational",
  energetic: "Energetic (launch-day)",
};

export const LENGTH_LABELS: Record<Length, string> = {
  short: "Short (~300 words, 2 body paragraphs)",
  standard: "Standard (~500 words, 3 body paragraphs)",
  long: "Long (~800 words, 4 body paragraphs)",
};

export const LENGTH_TARGETS: Record<Length, number> = {
  short: 300,
  standard: 500,
  long: 800,
};

export const LENGTH_BODY_PARAGRAPHS: Record<Length, number> = {
  short: 2,
  standard: 3,
  long: 4,
};

export const ANGLE_LABELS: Record<Angle, string> = {
  "benefit-led": "Benefit-led (what they gain)",
  "fact-led": "Fact-led (the news itself)",
  "customer-led": "Customer-led (who it's for)",
  "trend-led": "Trend-led (the bigger shift)",
  "controversy-led": "Controversy-led (the tension)",
};

export const NEWSWORTHINESS_LABELS: Record<NewsworthinessFactor, string> = {
  "timeliness": "Timeliness",
  "proximity": "Proximity",
  "impact": "Impact",
  "prominence": "Prominence",
  "conflict": "Conflict / tension",
  "human-interest": "Human interest",
};

export const SAMPLE_INPUTS: ReleaseInputs[] = [
  {
    organization: "Acme",
    what: "launches AI-powered inventory forecasting for mid-market retailers",
    when: "today",
    where: "San Francisco, CA",
    why: "mid-market retailers lose $120B annually to stockouts and overstocks; existing tools are built for enterprise budgets",
    who: "Jane Doe, CEO",
    contactName: "Alex Smith",
    contactEmail: "press@acme.com",
    contactPhone: "+1 415 555 0142",
    boilerplate: "Acme is the inventory intelligence platform for mid-market retailers. Founded in 2021, Acme serves over 400 brands across North America and is headquartered in San Francisco. Learn more at acme.com.",
  },
  {
    organization: "BetaCorp",
    what: "partners with GlobalBank to embed payments into B2B invoices",
    when: "October 14, 2025",
    where: "New York, NY",
    why: "B2B payments still take 30+ days to settle; embedding payments into invoices cuts that to same-day for 10M+ SMBs",
    who: "John Lee, VP of Partnerships at BetaCorp",
    contactName: "Priya Patel",
    contactEmail: "media@betacorp.com",
    contactPhone: "+1 212 555 0199",
    boilerplate: "BetaCorp builds accounts-receivable automation for mid-sized businesses. GlobalBank is a Fortune 100 financial services company serving 50M customers worldwide.",
  },
  {
    organization: "Gamma Labs",
    what: "appoints Dr. Maya Chen as Chief Technology Officer",
    when: "today",
    where: "Austin, TX",
    why: "Dr. Chen led AI research at a Fortune 50 tech company; her appointment signals Gamma's investment in applied ML",
    who: "Dr. Maya Chen, incoming CTO",
    contactName: "Sam Rivera",
    contactEmail: "press@gammalabs.com",
    contactPhone: "+1 512 555 0177",
    boilerplate: "Gamma Labs is an applied AI research company building developer tools for production ML. Gamma is headquartered in Austin, TX and is backed by tier-one venture investors.",
  },
];

// ---------- Pure helpers ----------

/** Normalize text — collapse whitespace, trim. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
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
    "what", "which", "who", "whom", "whose", "will", "today", "announces",
    "announced", "launches", "launched", "unveils", "unveiled",
  ]);
  const words = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Build an AP-style dateline: "CITY, State — Month Day, Year —". */
export function formatDateline(city: string, date: string): string {
  const c = normalizeText(city);
  const d = normalizeText(date) || "today";
  // If date is "today", use placeholder month/day/year
  if (/^today$/i.test(d)) {
    return `${c || "[CITY]"} — [Month] [Day], [Year] —`;
  }
  return `${c || "[CITY]"} — ${d} —`;
}

/** Format a date string for display (passthrough with light cleanup). */
export function formatDate(s: string): string {
  return normalizeText(s) || "[Date]";
}

/** Detect release type from the "what" text (heuristic). */
export function detectReleaseType(what: string): ReleaseType {
  const w = normalizeText(what).toLowerCase();
  if (!w) return "product-launch";
  if (/\b(partners?|partnership|collaboration|joint venture|teams? up with)\b/.test(w)) return "partnership";
  if (/\b(hires?|appoint|appoints?|joins? as|named|promotes? to|new (ceo|cto|cfo|coo|cmo|chief|vp|director))\b/.test(w)) return "hiring";
  if (/\b(raises?|raise|funding|series [a-z]|seed|round|investment|capital|venture|valuation)\b/.test(w)) return "funding";
  if (/\b(event|conference|summit|expo|webinar|meetup|hosts?|presents?)\b/.test(w)) return "event";
  if (/\b(award|wins?|won|honored|recogni|named (best|top)|list|ranking)\b/.test(w)) return "award";
  if (/\b(launch|launches|introduc|unveil|releases?|ships?|debuts?|new (product|app|platform|feature))\b/.test(w)) return "product-launch";
  return "product-launch";
}

/** Suggest the best tone for a release type. */
export function suggestTone(releaseType: ReleaseType): Tone {
  switch (releaseType) {
    case "product-launch": return "energetic";
    case "partnership": return "formal";
    case "hiring": return "formal";
    case "funding": return "formal";
    case "event": return "conversational";
    case "award": return "conversational";
  }
}

/** Count words in a string. */
export function countWords(s: string): number {
  const t = normalizeText(s);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Truncate a headline to <= maxChars, ending on a word boundary. */
export function truncateForSeo(headline: string, maxChars = 65): string {
  const t = normalizeText(headline);
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace <= 0) return slice + "…";
  return slice.slice(0, lastSpace) + "…";
}

// ---------- Headline generation ----------

/** Generate five headline variants across the five angles. */
export function generateHeadlines(
  inputs: ReleaseInputs,
  releaseType: ReleaseType,
  tone: Tone,
): HeadlineVariant[] {
  const org = titleCase(inputs.organization) || "[ORGANIZATION]";
  const what = normalizeText(inputs.what) || "[ANNOUNCEMENT]";
  const why = normalizeText(inputs.why) || "[SIGNIFICANCE]";
  const kw = extractKeywords(`${inputs.organization} ${inputs.what}`);
  const mainKw = kw[0] ? titleCase(kw[0]) : org;

  const tonePrefix: Record<Tone, string> = {
    formal: "",
    conversational: "",
    energetic: "",
  };
  const _ = tonePrefix[tone]; // placeholder for future tone-based variation

  const variants: HeadlineVariant[] = [];

  // 1. Benefit-led
  const benefit = `New ${mainKw} ${verbForRelease(releaseType)} by ${org} ${benefitPhrase(why)}`.replace(/\s+/g, " ").trim();
  variants.push({
    angle: "benefit-led",
    text: benefit,
    seoVariant: truncateForSeo(benefit),
  });

  // 2. Fact-led
  const fact = `${org} ${verbForRelease(releaseType)} ${whatClause(what, releaseType)}`;
  variants.push({
    angle: "fact-led",
    text: fact,
    seoVariant: truncateForSeo(fact),
  });

  // 3. Customer-led
  const customer = `For ${customerForRelease(releaseType)}: ${org} ${verbForRelease(releaseType)} ${whatClause(what, releaseType)}`;
  variants.push({
    angle: "customer-led",
    text: customer,
    seoVariant: truncateForSeo(customer),
  });

  // 4. Trend-led
  const trend = `${capitalize(trendPhrase(why, releaseType))}, ${org} ${verbForRelease(releaseType)} ${whatClause(what, releaseType)}`;
  variants.push({
    angle: "trend-led",
    text: trend,
    seoVariant: truncateForSeo(trend),
  });

  // 5. Controversy-led
  const controversy = `${org} ${verbForRelease(releaseType)} ${whatClause(what, releaseType)} — ${controversyPhrase(why, releaseType)}`;
  variants.push({
    angle: "controversy-led",
    text: controversy,
    seoVariant: truncateForSeo(controversy),
  });

  return variants;
}

function verbForRelease(releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch": return "launches";
    case "partnership": return "partners";
    case "hiring": return "appoints";
    case "funding": return "raises";
    case "event": return "hosts";
    case "award": return "wins";
  }
}

function benefitPhrase(why: string): string {
  if (!why) return "to [BENEFIT]";
  const kw = extractKeywords(why);
  if (kw.length === 0) return "to [BENEFIT]";
  return `to ${kw.slice(0, 4).join(" ")}`;
}

function whatClause(what: string, releaseType: ReleaseType): string {
  const w = normalizeText(what);
  if (!w) return "[ANNOUNCEMENT]";
  // Strip a leading verb if it duplicates verbForRelease
  const verbs = ["launches", "launch", "announces", "announce", "unveils", "unveil",
                 "partners", "partner", "appoints", "appoint", "raises", "raise",
                 "hosts", "host", "wins", "win"];
  const re = new RegExp(`^(${verbs.join("|")})\\s+`, "i");
  const stripped = w.replace(re, "");
  // For funding, prepend "Series A" if not already present
  if (releaseType === "funding" && !/series|seed|round/i.test(stripped)) {
    return `a funding round ${stripped}`;
  }
  return stripped;
}

function customerForRelease(releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch": return "teams shipping faster";
    case "partnership": return "customers waiting for this";
    case "hiring": return "the team building what's next";
    case "funding": return "investors backing the next chapter";
    case "event": return "attendees who need to be in the room";
    case "award": return "customers who nominated us";
  }
}

function trendPhrase(why: string, releaseType: ReleaseType): string {
  const kw = extractKeywords(why);
  const baseTrend: Record<ReleaseType, string> = {
    "product-launch": "as teams demand faster, simpler tooling",
    "partnership": "as the industry consolidates around integrated stacks",
    "hiring": "as the talent war reshapes the industry",
    "funding": "as investors refocus on capital-efficient growth",
    "event": "as the community gathers to compare notes",
    "award": "as the industry raises its standards",
  };
  if (kw.length === 0) return baseTrend[releaseType];
  return `as ${kw.slice(0, 3).join(" ")} reshapes the industry`;
}

function controversyPhrase(why: string, releaseType: ReleaseType): string {
  const kw = extractKeywords(why);
  if (kw.length === 0) {
    return "and the conventional wisdom was wrong";
  }
  return `despite widespread skepticism about ${kw.slice(0, 2).join(" and ")}`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

// ---------- Subhead generation ----------

/** Generate a one-line subhead / deck that complements the headline. */
export function generateSubhead(inputs: ReleaseInputs, releaseType: ReleaseType, tone: Tone): string {
  const org = titleCase(inputs.organization) || "[ORGANIZATION]";
  const what = normalizeText(inputs.what) || "[ANNOUNCEMENT]";
  const why = normalizeText(inputs.why) || "[SIGNIFICANCE]";

  const toneLead: Record<Tone, string> = {
    formal: "",
    conversational: "",
    energetic: "",
  };

  switch (releaseType) {
    case "product-launch":
      return `${toneLead[tone]}${org}'s new release targets ${whyClause(why)}, available starting ${inputs.when || "[DATE]"}.`;
    case "partnership":
      return `${toneLead[tone]}The ${whatClause(what, releaseType)} brings ${whyClause(why)} to customers of both organizations.`;
    case "hiring":
      return `${toneLead[tone]}${inputs.who || "[SPOKESPERSON]"} joins ${org} ${whenClause(inputs.when)} to lead ${whyClause(why)}.`;
    case "funding":
      return `${toneLead[tone]}The round will accelerate ${org}'s ${whyClause(why)}, with ${inputs.who || "[INVESTOR]"} participating.`;
    case "event":
      return `${toneLead[tone]}${org} ${whenClause(inputs.when)} ${whereClause(inputs.where)} ${whyClause(why)}.`;
    case "award":
      return `${toneLead[tone]}${org} ${whenClause(inputs.when)} ${whyClause(why)}, selected from a field of finalists.`;
  }
}

function whyClause(why: string): string {
  const w = normalizeText(why);
  if (!w) return "[SIGNIFICANCE]";
  return w.replace(/\.$/, "").toLowerCase();
}

function whenClause(when: string): string {
  const w = normalizeText(when);
  if (!w || /^today$/i.test(w)) return "today";
  return `on ${w}`;
}

function whereClause(where: string): string {
  const w = normalizeText(where);
  if (!w) return "in [CITY]";
  return `in ${w}`;
}

// ---------- Lede generation ----------

/** Generate the opening (lede) paragraph — inverted-pyramid top. */
export function generateLede(inputs: ReleaseInputs, releaseType: ReleaseType): string {
  const org = titleCase(inputs.organization) || "[ORGANIZATION]";
  const what = normalizeText(inputs.what) || "[ANNOUNCES SOMETHING]";
  const when = normalizeText(inputs.when) || "today";
  const where = normalizeText(inputs.where) || "[CITY]";
  const why = normalizeText(inputs.why) || "[SIGNIFICANCE]";

  switch (releaseType) {
    case "product-launch":
      return `${org} ${when === "today" ? "today" : `on ${when}`} ${verbForRelease("product-launch")} ${whatClause(what, "product-launch")}, a new offering designed to ${whyClause(why)}. The announcement was made from ${where}.`;
    case "partnership":
      return `${org} ${when === "today" ? "today" : `on ${when}`} announced a partnership with ${partnerNameFromWhat(what)} to ${whyClause(why)}. The collaboration is effective immediately and available to customers in ${where}.`;
    case "hiring":
      return `${org} ${when === "today" ? "today" : `on ${when}`} announced the appointment of ${inputs.who || "[SPOKESPERSON]"} as ${titleFromWho(inputs.who)}. ${inputs.who ? inputs.who.split(",")[0] : "[SPOKESPERSON]"} will be based in ${where} and will lead ${whyClause(why)}.`;
    case "funding":
      return `${org} ${when === "today" ? "today" : `on ${when}`} announced ${whatClause(what, "funding")}. The round will be used to ${whyClause(why)}, the company said from ${where}.`;
    case "event":
      return `${org} ${when === "today" ? "today" : `on ${when}`} announced ${whatClause(what, "event")}, to be held ${whenClause(when)} ${whereClause(where)}. The event will ${whyClause(why)}.`;
    case "award":
      return `${org} ${when === "today" ? "today" : `on ${when}`} ${verbForRelease("award")} ${whatClause(what, "award")}. The award recognizes ${whyClause(why)}, the organization announced from ${where}.`;
  }
}

function partnerNameFromWhat(what: string): string {
  // Try to extract a partner name from phrases like "partners with GlobalBank to..."
  const m = what.match(/with\s+([A-Z][A-Za-z0-9&.\s]+?)(?:\s+to|\s+for|,|$)/);
  if (m && m[1]) return m[1].trim();
  return "[PARTNER]";
}

function titleFromWho(who: string): string {
  // Try to extract a title from "Jane Doe, CEO" or "John Lee, VP of X"
  const parts = who.split(",");
  if (parts.length >= 2) {
    return parts.slice(1).join(",").trim();
  }
  return "[TITLE]";
}

// ---------- Body paragraph generation ----------

/** Generate the body paragraphs that follow the lede. */
export function generateBodyParagraphs(
  inputs: ReleaseInputs,
  releaseType: ReleaseType,
  length: Length,
): string[] {
  const org = titleCase(inputs.organization) || "[ORGANIZATION]";
  const what = normalizeText(inputs.what) || "[ANNOUNCEMENT]";
  const why = normalizeText(inputs.why) || "[SIGNIFICANCE]";
  const count = LENGTH_BODY_PARAGRAPHS[length];

  const paragraphs: string[] = [];

  // Paragraph 1: Context / why now
  paragraphs.push(
    `${contextSentence(org, what, releaseType)} ${whySentence(why, releaseType)} ${availabilitySentence(inputs.when, releaseType)}`,
  );

  // Paragraph 2: Details / features / terms
  if (count >= 2) {
    paragraphs.push(
      `${detailsSentence(org, what, releaseType)} ${quoteSetupSentence(inputs.who, releaseType)} ${detailSupportSentence(why, releaseType)}`,
    );
  }

  // Paragraph 3: Market context / quote attribution context
  if (count >= 3) {
    paragraphs.push(
      `${marketSentence(org, releaseType)} ${historySentence(org, inputs.where)}`,
    );
  }

  // Paragraph 4: Looking ahead / call to action
  if (count >= 4) {
    paragraphs.push(
      `${forwardSentence(org, releaseType, inputs.when)} ${ctaSentence(releaseType)}`,
    );
  }

  return paragraphs;
}

function contextSentence(org: string, what: string, releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch":
      return `The launch comes as ${org} expands its focus on ${whatClause(what, releaseType)}.`;
    case "partnership":
      return `Under the partnership, ${org} will integrate its offering with the partner's platform.`;
    case "hiring":
      return `The appointment reflects ${org}'s investment in senior leadership.`;
    case "funding":
      return `The round brings ${org}'s total funding to date to [TOTAL FUNDING].`;
    case "event":
      return `The event will bring together [ATTENDEE COUNT] attendees from across the industry.`;
    case "award":
      return `The award was presented at [EVENT NAME] and was selected by a panel of [JUDGE COUNT] judges.`;
  }
}

function whySentence(why: string, releaseType: ReleaseType): string {
  if (!why) return `[WHY THIS MATTERS NOW].`;
  switch (releaseType) {
    case "product-launch":
      return `The offering addresses the fact that ${why}.`;
    case "partnership":
      return `Together, the companies aim to ${why}.`;
    case "hiring":
      return `The new leader will be responsible for ${why}.`;
    case "funding":
      return `The capital will be used to ${why}.`;
    case "event":
      return `The event is designed to ${why}.`;
    case "award":
      return `The recognition reflects ${why}.`;
  }
}

function availabilitySentence(when: string, releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch":
      return `The product is available ${when === "today" ? "starting today" : `starting ${when}`} at [URL].`;
    case "partnership":
      return `The integration is available to customers ${when === "today" ? "immediately" : `beginning ${when}`}.`;
    case "hiring":
      return `${when === "today" ? "The appointment is effective immediately" : `The appointment is effective ${when}`}.`;
    case "funding":
      return `The round closed ${when === "today" ? "recently" : `on ${when}`}.`;
    case "event":
      return `Registration is open at [URL].`;
    case "award":
      return `A full list of winners is available at [URL].`;
  }
}

function detailsSentence(org: string, what: string, releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch":
      return `Key capabilities of the new offering include [FEATURE 1], [FEATURE 2], and [FEATURE 3].`;
    case "partnership":
      return `Under the terms of the agreement, ${org} and its partner will jointly go to market with [JOINT OFFERING].`;
    case "hiring":
      return `In this role, the appointee will oversee [TEAM / FUNCTION] and report to [REPORTING LINE].`;
    case "funding":
      return `The round was led by [LEAD INVESTOR], with participation from [PARTICIPATING INVESTORS].`;
    case "event":
      return `The event will feature [KEYNOTE SPEAKER], [PANEL TOPICS], and hands-on workshops.`;
    case "award":
      return `Judges evaluated entries on [CRITERIA 1], [CRITERIA 2], and [CRITERIA 3].`;
  }
}

function quoteSetupSentence(who: string, releaseType: ReleaseType): string {
  const name = who ? who.split(",")[0].trim() : "[SPOKESPERSON]";
  switch (releaseType) {
    case "product-launch":
      return `"This is the product our customers have been asking for," said ${who || "[SPOKESPERSON]"}.`;
    default:
      return `"This is a significant moment for us," said ${who || "[SPOKESPERSON]"}.`;
  }
}

function detailSupportSentence(why: string, releaseType: ReleaseType): string {
  if (!why) return "";
  switch (releaseType) {
    case "product-launch":
      return `Early customers report [CUSTOMER OUTCOME].`;
    case "partnership":
      return `Customers of both companies will benefit from [BENEFIT].`;
    case "hiring":
      return `The appointee previously served at [PREVIOUS COMPANY].`;
    case "funding":
      return `The round values ${"[ORGANIZATION]"} at [VALUATION].`;
    case "event":
      return `Past attendees have called the event [PAST ATTENDEE QUOTE].`;
    case "award":
      return `Previous winners include [PAST WINNERS].`;
  }
}

function marketSentence(org: string, releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch":
      return `The market for [CATEGORY] is projected to reach [MARKET SIZE] by [YEAR], according to [RESEARCH FIRM].`;
    case "partnership":
      return `The partnership reflects a broader trend toward [INDUSTRY TREND].`;
    case "hiring":
      return `The appointment comes amid a wave of leadership changes across the [INDUSTRY] sector.`;
    case "funding":
      return `The funding round is one of the largest in the [CATEGORY] space this year.`;
    case "event":
      return `The event is one of the largest gatherings of [AUDIENCE] in [REGION].`;
    case "award":
      return `The award is one of the most prestigious in the [INDUSTRY] industry.`;
  }
}

function historySentence(org: string, where: string): string {
  return `${org} was founded in [YEAR] and is headquartered in ${where || "[CITY]"}.`;
}

function forwardSentence(org: string, releaseType: ReleaseType, when: string): string {
  switch (releaseType) {
    case "product-launch":
      return `Looking ahead, ${org} plans to [ROADMAP ITEM] in the coming quarters.`;
    case "partnership":
      return `The companies plan to expand the partnership to [GEOGRAPHY / PRODUCT] in [FUTURE DATE].`;
    case "hiring":
      return `${org} plans to hire an additional [HEADCOUNT] employees over the next [TIME PERIOD].`;
    case "funding":
      return `${org} plans to use the capital to hire across [FUNCTION] and expand into [MARKET].`;
    case "event":
      return `The next ${org} event is planned for [NEXT EVENT DATE].`;
    case "award":
      return `Nominations for next year's award open [NOMINATION DATE].`;
  }
  return "";
}

function ctaSentence(releaseType: ReleaseType): string {
  switch (releaseType) {
    case "product-launch":
      return `To learn more or request a demo, visit [URL].`;
    case "partnership":
      return `For partnership inquiries, contact [CONTACT EMAIL].`;
    case "hiring":
      return `Open roles are listed at [CAREERS URL].`;
    case "funding":
      return `For investor inquiries, contact [INVESTOR CONTACT].`;
    case "event":
      return `To register, visit [EVENT URL].`;
    case "award":
      return `For the full list of winners, visit [AWARD URL].`;
  }
}

// ---------- Quote generation ----------

/** Generate an editable quote scaffold with attribution placeholders. */
export function generateQuote(inputs: ReleaseInputs, releaseType: ReleaseType): Quote {
  const org = titleCase(inputs.organization) || "[ORGANIZATION]";
  const what = normalizeText(inputs.what) || "[ANNOUNCEMENT]";
  const why = normalizeText(inputs.why) || "[SIGNIFICANCE]";
  const name = inputs.who ? inputs.who.split(",")[0].trim() : "[SPOKESPERSON NAME]";
  const title = inputs.who ? inputs.who.split(",").slice(1).join(",").trim() : "[TITLE]";

  const attribution = `${name}, ${title} of ${org}`;

  let text = "";
  switch (releaseType) {
    case "product-launch":
      text = `"We built this because our customers told us they were losing time and money on ${why}. With ${whatClause(what, releaseType)}, they can finally ${benefitClause(why)} — and this is just the beginning."`;
      break;
    case "partnership":
      text = `"This partnership lets us deliver ${whyClause(why)} in a way neither company could alone. Customers have been asking for this, and we're proud to ship it together."`;
      break;
    case "hiring":
      text = `"I'm joining ${org} because the team is building something that genuinely matters for ${whyClause(why)}. The next 18 months will be defining."`;
      break;
    case "funding":
      text = `"This round lets us accelerate the work our customers are already counting on us for — ${whyClause(why)}. We're hiring across the board and moving fast."`;
      break;
    case "event":
      text = `"We built this event for the people doing the work — not the people writing about it. If you're in ${whyClause(why)}, you need to be in the room."`;
      break;
    case "award":
      text = `"To be recognized by this panel — especially alongside the other finalists — is validation that our approach to ${whyClause(why)} is resonating."`;
      break;
  }

  return {
    attribution,
    text,
    isPlaceholder: true,
  };
}

function benefitClause(why: string): string {
  if (!why) return "[BENEFIT]";
  const kw = extractKeywords(why);
  if (kw.length === 0) return "[BENEFIT]";
  return `${kw.slice(0, 3).join(" ")}`;
}

// ---------- Newsworthiness check ----------

/** Run the newsworthiness check across 6 factors. */
export function checkNewsworthiness(inputs: ReleaseInputs, releaseType: ReleaseType): NewsworthinessResult {
  const factors: NewsworthinessFactorResult[] = [];

  // Timeliness — does the release have a date / "today"?
  const when = normalizeText(inputs.when);
  const timelinessScore: 0 | 1 | 2 = when ? 2 : 0;
  factors.push({
    factor: "timeliness",
    score: timelinessScore,
    note: when
      ? `Dated: "${when}". Good — releases need a date.`
      : "No date. Add when this is happening (today, or a specific date).",
  });

  // Proximity — is there a location?
  const where = normalizeText(inputs.where);
  const proximityScore: 0 | 1 | 2 = where ? 2 : 0;
  factors.push({
    factor: "proximity",
    score: proximityScore,
    note: where
      ? `Located: "${where}". Local outlets will care more.`
      : "No location. Add a city for local-angle pickup.",
  });

  // Impact — does the "why" mention a number, scope, or audience?
  const why = normalizeText(inputs.why);
  const hasNumber = /\d/.test(why);
  const hasAudience = /\b(million|billion|customers?|users?|teams?|smb|enterprise|mid-market|people|industry|market)\b/i.test(why);
  const impactScore: 0 | 1 | 2 = hasNumber && hasAudience ? 2 : hasNumber || hasAudience ? 1 : 0;
  factors.push({
    factor: "impact",
    score: impactScore,
    note: impactScore === 2
      ? "Quantified impact with audience scope."
      : impactScore === 1
        ? "Partial impact — add a number AND an audience to strengthen."
        : "No measurable impact. Add a number and an audience (who, how many, how much).",
  });

  // Prominence — does the org or spokesperson ring familiar?
  const org = normalizeText(inputs.organization);
  const who = normalizeText(inputs.who);
  const prominenceScore: 0 | 1 | 2 = org && who ? 1 : org || who ? 0 : 0;
  factors.push({
    factor: "prominence",
    score: prominenceScore,
    note: prominenceScore === 1
      ? `Organization and spokesperson named (${org}, ${who}). Add a credential or past affiliation to boost.`
      : "Add an organization name AND a named spokesperson with title.",
  });

  // Conflict / tension — does the "why" signal a tension or contrarian angle?
  const conflictWords = /\b(despite|against|contrary|however|but|while|unlike|rather than|instead of|skeptic|challenge|risk|problem|fail|loss|threat)\b/i.test(why);
  const conflictScore: 0 | 1 | 2 = conflictWords ? 2 : 0;
  factors.push({
    factor: "conflict",
    score: conflictScore,
    note: conflictScore
      ? "Tension or contrarian angle detected — journalists love conflict."
      : "No conflict or tension. Frame the 'why' against an obstacle or skeptic for a stronger angle.",
  });

  // Human interest — does the why mention a person, story, or quote?
  const humanWords = /\b(people|person|founder|customer|story|journey|first|only|after|when|because)\b/i.test(why);
  const humanScore: 0 | 1 | 2 = humanWords ? 2 : 0;
  factors.push({
    factor: "human-interest",
    score: humanScore,
    note: humanScore
      ? "Human-interest angle detected."
      : "No human-interest angle. Tie the news to a person, customer, or story.",
  });

  const totalScore = factors.reduce((s, f) => s + f.score, 0);
  const maxScore = factors.length * 2;
  const pct = totalScore / maxScore;

  let verdict: NewsworthinessResult["verdict"];
  let suggestion: string;
  if (pct >= 0.66) {
    verdict = "This is news";
    suggestion = "Strong newsworthiness. Send it.";
  } else if (pct >= 0.4) {
    verdict = "Borderline — strengthen the angle";
    suggestion = "Address the weak factors above before sending. Specifically, add what's missing in the lowest-scoring factor.";
  } else {
    verdict = "Probably not news";
    suggestion = "Reframe the announcement around impact, conflict, or human interest. As written, a journalist will likely pass.";
  }

  return { factors, totalScore, maxScore, verdict, suggestion };
}

// ---------- Release generation ----------

/** Generate a complete press release. */
export function generateRelease(
  inputs: ReleaseInputs,
  releaseType: ReleaseType,
  tone: Tone,
  length: Length,
): PressRelease {
  const headlineVariants = generateHeadlines(inputs, releaseType, tone);
  const chosenHeadline = headlineVariants[0]?.text ?? "[HEADLINE]";
  const subhead = generateSubhead(inputs, releaseType, tone);
  const dateline = formatDateline(inputs.where, inputs.when);
  const lede = generateLede(inputs, releaseType);
  const bodyParagraphs = generateBodyParagraphs(inputs, releaseType, length);
  const quote = generateQuote(inputs, releaseType);
  const boilerplate = normalizeText(inputs.boilerplate) || "[BOILERPLATE: A short paragraph about your organization — what you do, who you serve, where you're based, and where to learn more.]";

  const wordCount =
    countWords(chosenHeadline) +
    countWords(subhead) +
    countWords(lede) +
    bodyParagraphs.reduce((s, p) => s + countWords(p), 0) +
    countWords(quote.text) +
    countWords(boilerplate);

  return {
    inputs,
    releaseType,
    tone,
    length,
    headlineVariants,
    chosenHeadline,
    subhead,
    dateline,
    lede,
    bodyParagraphs,
    quote,
    boilerplate,
    endMark: "###",
    wordCount,
    generatedAt: Date.now(),
  };
}

/** Pick a different headline variant by index. */
export function chooseHeadline(release: PressRelease, idx: number): PressRelease {
  const variant = release.headlineVariants[idx];
  if (!variant) return release;
  return { ...release, chosenHeadline: variant.text };
}

/** Pick the SEO-tight variant of a headline. */
export function chooseSeoHeadline(release: PressRelease, idx: number): PressRelease {
  const variant = release.headlineVariants[idx];
  if (!variant) return release;
  return { ...release, chosenHeadline: variant.seoVariant };
}

/** Update the quote text (mark as no longer placeholder). */
export function updateQuote(release: PressRelease, text: string): PressRelease {
  return {
    ...release,
    quote: {
      ...release.quote,
      text,
      isPlaceholder: false,
    },
  };
}

// ---------- Stats ----------

export function computeStats(release: PressRelease): Stats {
  return {
    wordCount: release.wordCount,
    targetWords: LENGTH_TARGETS[release.length],
    headlineChars: release.chosenHeadline.length,
    headlineSeoOk: release.chosenHeadline.length <= 65,
    paragraphCount: release.bodyParagraphs.length + 1, // +1 for lede
    releaseTypeLabel: RELEASE_TYPE_LABELS[release.releaseType],
  };
}

// ---------- Rendering ----------

export function renderText(release: PressRelease): string {
  const lines: string[] = [];
  lines.push("FOR IMMEDIATE RELEASE");
  lines.push("");
  lines.push(release.chosenHeadline);
  lines.push("");
  lines.push(release.subhead);
  lines.push("");
  lines.push(release.dateline);
  lines.push(`${release.lede}`);
  lines.push("");
  for (const p of release.bodyParagraphs) {
    lines.push(p);
    lines.push("");
  }
  lines.push(`${release.quote.text}`);
  lines.push(`— ${release.quote.attribution}`);
  lines.push("");
  lines.push(`About ${titleCase(release.inputs.organization) || "[ORGANIZATION]"}`);
  lines.push(release.boilerplate);
  lines.push("");
  lines.push("Contact:");
  const contact = [
    release.inputs.contactName || "[CONTACT NAME]",
    release.inputs.contactEmail || "[CONTACT EMAIL]",
    release.inputs.contactPhone || "[CONTACT PHONE]",
  ].join(" · ");
  lines.push(contact);
  lines.push("");
  lines.push(release.endMark);
  return lines.join("\n");
}

export function renderMarkdown(release: PressRelease): string {
  const lines: string[] = [];
  lines.push(`**FOR IMMEDIATE RELEASE**`);
  lines.push("");
  lines.push(`# ${release.chosenHeadline}`);
  lines.push("");
  lines.push(`*${release.subhead}*`);
  lines.push("");
  lines.push(`**${release.dateline}** ${release.lede}`);
  lines.push("");
  for (const p of release.bodyParagraphs) {
    lines.push(p);
    lines.push("");
  }
  lines.push(`> ${release.quote.text}`);
  lines.push(`> — *${release.quote.attribution}*`);
  lines.push("");
  lines.push(`## About ${titleCase(release.inputs.organization) || "[ORGANIZATION]"}`);
  lines.push("");
  lines.push(release.boilerplate);
  lines.push("");
  lines.push(`**Contact:**`);
  lines.push("");
  lines.push(`- ${release.inputs.contactName || "[CONTACT NAME]"}`);
  lines.push(`- ${release.inputs.contactEmail || "[CONTACT EMAIL]"}`);
  lines.push(`- ${release.inputs.contactPhone || "[CONTACT PHONE]"}`);
  lines.push("");
  lines.push(`### ${release.endMark}`);
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
  if (state.organization) params.set("org", state.organization);
  if (state.what) params.set("what", state.what);
  if (state.when) params.set("when", state.when);
  if (state.where) params.set("where", state.where);
  if (state.why) params.set("why", state.why);
  if (state.who) params.set("who", state.who);
  if (state.releaseType) params.set("type", state.releaseType);
  if (state.tone) params.set("tone", state.tone);
  if (state.length) params.set("len", state.length);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      organization: "", what: "", when: "", where: "", why: "",
      who: "", releaseType: "product-launch", tone: "formal", length: "standard",
    };
  }
  const params = new URLSearchParams(clean);
  const validTypes: ReleaseType[] = ["product-launch", "partnership", "hiring", "funding", "event", "award"];
  const validTones: Tone[] = ["formal", "conversational", "energetic"];
  const validLengths: Length[] = ["short", "standard", "long"];
  const releaseType = params.get("type") as ReleaseType | null;
  const tone = params.get("tone") as Tone | null;
  const length = params.get("len") as Length | null;
  return {
    organization: params.get("org") ?? "",
    what: params.get("what") ?? "",
    when: params.get("when") ?? "",
    where: params.get("where") ?? "",
    why: params.get("why") ?? "",
    who: params.get("who") ?? "",
    releaseType: releaseType && validTypes.includes(releaseType) ? releaseType : "product-launch",
    tone: tone && validTones.includes(tone) ? tone : "formal",
    length: length && validLengths.includes(length) ? length : "standard",
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  inputs: ReleaseInputs,
  releaseType: ReleaseType,
  tone: Tone,
  length: Length,
): LlmPrompt {
  const system = `You are an expert PR writer who drafts AP-style press releases. Produce a ${releaseType} press release with a ${tone} tone, targeting ~${LENGTH_TARGETS[length]} words. Follow strict AP structure: FOR IMMEDIATE RELEASE, headline (under 65 chars), subhead, dateline (CITY, State — Month Day, Year —), inverted-pyramid lede, 2-4 body paragraphs, an editable quote with attribution placeholders marked [SPOKESPERSON NAME] [TITLE], a boilerplate paragraph, contact info, and the ### end mark. Do NOT fabricate quotes, statistics, or partner names — mark any unsupported claim with [BRACKETED PLACEHOLDER] for the user to fill. The release must read like wire copy, not marketing copy.`;
  const user = `Organization: ${inputs.organization}\nWhat: ${inputs.what}\nWhen: ${inputs.when}\nWhere: ${inputs.where}\nWhy: ${inputs.why}\nSpokesperson: ${inputs.who}\nContact: ${inputs.contactName} / ${inputs.contactEmail} / ${inputs.contactPhone}\nBoilerplate: ${inputs.boilerplate}`;
  return { system, user };
}

export function renderLlmResult(raw: string): { ok: boolean; result?: string; error?: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: false, error: "LLM returned empty response" };
  return { ok: true, result: trimmed };
}
