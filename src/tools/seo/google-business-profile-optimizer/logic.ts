/**
 * Google Business Profile Optimizer — pure logic.
 *
 * Score GBP description, generate post templates, suggest categories,
 * plan photos, list Q&A. Pure functions only — no DOM, no network.
 */

export interface GbpInput {
  businessName: string;
  primaryCategory: string;
  services: string[];
  city: string;
  description: string;
  hours: string;
  website: string;
}

export type PostType = "whats-new" | "offer" | "event";

export interface GbpPost {
  type: PostType;
  title: string;
  body: string;
  cta: string;
}

export interface PhotoType {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

export interface DescriptionScore {
  total: number; // 0-100
  length: number; // chars
  wordCount: number;
  components: {
    lengthOk: boolean;       // +30
    hasCategory: boolean;    // +20
    hasCity: boolean;        // +20
    hasService: boolean;     // +15
    hasCta: boolean;         // +15
  };
  missing: string[];
}

export interface KeywordDensity {
  word: string;
  count: number;
  density: number; // 0-1
}

export interface SummaryStats {
  descriptionScore: number;
  charCount: number;
  wordCount: number;
  missingComponents: string[];
  postCount: number;
  categorySuggestionsCount: number;
  photoPlanCount: number;
  qaCount: number;
}

export interface OptimizationReport {
  input: GbpInput;
  score: DescriptionScore;
  keywordDensity: KeywordDensity[];
  posts: GbpPost[];
  categorySuggestions: string[];
  photoPlan: PhotoType[];
  qaSuggestions: string[];
  summary: SummaryStats;
}

// ---- Constants ----

export const CTA_KEYWORDS: string[] = [
  "call", "visit", "book", "order", "schedule", "contact",
  "get a quote", "reserve", "shop", "learn more", "sign up",
  "today", "now", "free", "estimate", "consultation",
];

export const STOPWORDS: Set<string> = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else",
  "for", "of", "to", "in", "on", "at", "by", "with", "from",
  "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "we", "you",
  "your", "our", "their", "his", "her", "they", "them", "us",
  "i", "me", "my", "have", "has", "had", "do", "does", "did",
  "will", "would", "can", "could", "should", "may", "might",
  "not", "no", "so", "than", "too", "very", "just", "about",
  "up", "out", "off", "down", "over", "under", "into", "all",
  "any", "some", "more", "most", "other", "such", "only", "own",
  "same", "new", "now", "also", "well", "here", "there", "what",
  "which", "who", "whom", "where", "when", "why", "how",
]);

export const DEFAULT_PHOTO_PLAN: PhotoType[] = [
  { id: "logo", label: "Logo", description: "Business logo on a clean background (recommended 720x720)", required: true },
  { id: "cover", label: "Cover photo", description: "Wide hero image — storefront, team, or signature work", required: true },
  { id: "exterior", label: "Exterior", description: "Storefront from the street showing signage", required: true },
  { id: "interior", label: "Interior", description: "Inside view of your business", required: true },
  { id: "team", label: "Team", description: "Photo of staff and owners", required: true },
  { id: "products", label: "Products / Services", description: "Photos of products or service work in action", required: true },
  { id: "before-after", label: "Before / After", description: "Project results (service businesses)", required: false },
];

export const COMMON_QUESTIONS: string[] = [
  "What are your hours?",
  "Where are you located?",
  "Do you offer free estimates?",
  "What payment methods do you accept?",
  "Are you licensed and insured?",
  "Do you offer appointments online?",
];

export const BUSINESS_PRESETS: BusinessTypePreset[] = [
  {
    id: "plumber",
    label: "Plumber",
    primaryCategory: "Plumber",
    sampleServices: ["Drain cleaning", "Leak repair", "Water heater installation", "Emergency plumbing"],
    suggestedCategories: ["Plumbing contractor", "Emergency plumber", "Drainage service", "Bathroom remodeler", "Gas engineer"],
    qaSuggestions: ["Do you offer 24/7 emergency service?", "Do you warranty your work?", "What areas do you serve?"],
  },
  {
    id: "electrician",
    label: "Electrician",
    primaryCategory: "Electrician",
    sampleServices: ["Wiring repair", "Panel upgrade", "Lighting installation", "Electrical inspection"],
    suggestedCategories: ["Electrical engineer", "Lighting contractor", "Emergency electrician", "Solar energy company"],
    qaSuggestions: ["Are you licensed?", "Do you handle commercial work?", "Do you offer emergency service?"],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    primaryCategory: "Restaurant",
    sampleServices: ["Dine-in", "Takeout", "Catering", "Delivery"],
    suggestedCategories: ["Family restaurant", "Takeout restaurant", "Fine dining restaurant", "Cafe", "Bar"],
    qaSuggestions: ["Do you take reservations?", "Do you have vegetarian options?", "Do you offer catering?"],
  },
  {
    id: "dentist",
    label: "Dentist",
    primaryCategory: "Dentist",
    sampleServices: ["Teeth cleaning", "Cavity fillings", "Root canal", "Teeth whitening", "Orthodontics"],
    suggestedCategories: ["Cosmetic dentist", "Orthodontist", "Pediatric dentist", "Emergency dental service", "Dental clinic"],
    qaSuggestions: ["Do you accept my insurance?", "Do you see children?", "Do you offer payment plans?"],
  },
  {
    id: "lawyer",
    label: "Lawyer",
    primaryCategory: "Lawyer",
    sampleServices: ["Consultation", "Representation", "Contract review", "Estate planning"],
    suggestedCategories: ["Law firm", "Criminal justice attorney", "Family law attorney", "Personal injury attorney", "Estate planning attorney"],
    qaSuggestions: ["Do you offer free consultations?", "What are your fees?", "What areas of law do you practice?"],
  },
  {
    id: "realtor",
    label: "Realtor",
    primaryCategory: "Real estate agent",
    sampleServices: ["Home buying", "Home selling", "Property valuation", "Relocation assistance"],
    suggestedCategories: ["Real estate agent", "Real estate agency", "Property management company", "Commercial real estate agency"],
    qaSuggestions: ["What areas do you specialize in?", "What are your fees?", "Can you help with first-time buyers?"],
  },
  {
    id: "salon",
    label: "Salon",
    primaryCategory: "Hair salon",
    sampleServices: ["Haircut", "Coloring", "Styling", "Manicure", "Facials"],
    suggestedCategories: ["Hair salon", "Beauty salon", "Nail salon", "Spa", "Barber shop"],
    qaSuggestions: ["Do you take walk-ins?", "What products do you use?", "Do you offer gift cards?"],
  },
  {
    id: "gym",
    label: "Gym",
    primaryCategory: "Gym",
    sampleServices: ["Membership", "Personal training", "Group classes", "Nutrition coaching"],
    suggestedCategories: ["Fitness center", "Gym", "Personal trainer", "Yoga studio", "Pilates studio"],
    qaSuggestions: ["What are your membership rates?", "Do you offer free trials?", "What classes do you offer?"],
  },
];

export interface BusinessTypePreset {
  id: string;
  label: string;
  primaryCategory: string;
  sampleServices: string[];
  suggestedCategories: string[];
  qaSuggestions: string[];
}

// ---- Normalizers ----

export function normalizeText(s: string): string {
  return (s || "").trim();
}

export function normalizeLower(s: string): string {
  return (s || "").toLowerCase().trim();
}

/** Parse services (one per line or comma-separated). */
export function parseServices(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Extract the city name from "Austin, TX" -> "Austin". */
export function extractCityName(city: string): string {
  const c = normalizeText(city);
  if (!c) return "";
  const idx = c.indexOf(",");
  return idx === -1 ? c : c.slice(0, idx).trim();
}

// ---- Description scoring ----

/** Word count (whitespace separated). */
export function countWords(text: string): number {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Check if description has a call-to-action keyword. */
export function hasCallToAction(text: string): boolean {
  const lower = normalizeLower(text);
  return CTA_KEYWORDS.some((k) => lower.includes(k));
}

/** Check if description includes the primary category keyword. */
export function hasCategoryKeyword(text: string, primaryCategory: string): boolean {
  const cat = normalizeLower(primaryCategory);
  if (!cat) return false;
  return normalizeLower(text).includes(cat);
}

/** Check if description includes the city name. */
export function hasCityKeyword(text: string, city: string): boolean {
  const cityName = normalizeLower(extractCityName(city));
  if (!cityName) return false;
  return normalizeLower(text).includes(cityName);
}

/** Check if description includes any service keyword. */
export function hasServiceKeyword(text: string, services: string[]): boolean {
  const lower = normalizeLower(text);
  return services.some((s) => {
    const sv = normalizeLower(s);
    return sv && lower.includes(sv);
  });
}

/** Score the description on 5 components (max 100). */
export function scoreDescription(
  description: string,
  primaryCategory: string,
  city: string,
  services: string[],
): DescriptionScore {
  const length = description.length;
  const wordCount = countWords(description);
  const lengthOk = length >= 200 && length <= 750;
  const catOk = hasCategoryKeyword(description, primaryCategory);
  const cityOk = hasCityKeyword(description, city);
  const svcOk = hasServiceKeyword(description, services);
  const ctaOk = hasCallToAction(description);

  let total = 0;
  if (lengthOk) total += 30;
  if (catOk) total += 20;
  if (cityOk) total += 20;
  if (svcOk) total += 15;
  if (ctaOk) total += 15;

  const missing: string[] = [];
  if (!lengthOk) missing.push("Length 200-750 chars");
  if (!catOk) missing.push("Primary category keyword");
  if (!cityOk) missing.push("City name");
  if (!svcOk) missing.push("Service keyword");
  if (!ctaOk) missing.push("Call-to-action");

  return {
    total,
    length,
    wordCount,
    components: {
      lengthOk,
      hasCategory: catOk,
      hasCity: cityOk,
      hasService: svcOk,
      hasCta: ctaOk,
    },
    missing,
  };
}

// ---- Keyword density ----

/** Compute keyword density (top N). */
export function keywordDensity(text: string, topN: number = 5): KeywordDensity[] {
  const t = normalizeLower(text);
  if (!t) return [];
  const words = t
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const total = words.length;
  if (total === 0) return [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const arr: KeywordDensity[] = [];
  for (const [word, count] of counts) {
    arr.push({ word, count, density: count / total });
  }
  arr.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return arr.slice(0, topN);
}

// ---- GBP post templates ----

/** Truncate to a max length, on word boundary. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace === -1 ? slice : slice.slice(0, lastSpace)) + "…";
}

/** Generate the 3 GBP post templates. */
export function generatePosts(input: GbpInput): GbpPost[] {
  const name = normalizeText(input.businessName) || "Your business";
  const category = normalizeText(input.primaryCategory) || "our services";
  const city = extractCityName(input.city) || "your area";
  const firstService = input.services[0] || category;
  const phoneCta = input.website
    ? `Visit ${input.website} to learn more.`
    : `Call ${name} today to schedule.`;

  const whatsNew = `New from ${name}: We just completed a ${firstService.toLowerCase()} project in ${city}. Our team of ${category.toLowerCase()} experts is ready to help with your next job. ${phoneCta}`;
  const offer = `Special offer from ${name}! Get a discount on ${firstService.toLowerCase()} this month. Mention this post when you call. Offer ends soon — book your appointment in ${city} today. ${phoneCta}`;
  const event = `Join ${name} for an upcoming event in ${city}. We're hosting a ${category.toLowerCase()} open house with demos and Q&A. RSVP to reserve your spot. ${phoneCta}`;

  return [
    { type: "whats-new", title: "What's New", body: truncate(whatsNew, 300), cta: "Learn more" },
    { type: "offer", title: "Offer", body: truncate(offer, 300), cta: "Claim offer" },
    { type: "event", title: "Event", body: truncate(event, 300), cta: "RSVP" },
  ];
}

// ---- Category suggestions ----

/** Lookup additional GBP categories based on primary category. */
export function suggestCategories(primaryCategory: string): string[] {
  const cat = normalizeLower(primaryCategory);
  if (!cat) return [];
  // Try exact preset match first
  for (const preset of BUSINESS_PRESETS) {
    if (normalizeLower(preset.primaryCategory) === cat) {
      return preset.suggestedCategories;
    }
  }
  // Try partial match (preset id or label contains category)
  for (const preset of BUSINESS_PRESETS) {
    if (
      cat.includes(preset.id) ||
      preset.id.includes(cat) ||
      normalizeLower(preset.label).includes(cat) ||
      cat.includes(normalizeLower(preset.label))
    ) {
      return preset.suggestedCategories;
    }
  }
  return [];
}

// ---- Photo plan ----

/** Generate a photo plan. Always returns 6+ required + 1 optional. */
export function generatePhotoPlan(): PhotoType[] {
  return DEFAULT_PHOTO_PLAN.map((p) => ({ ...p }));
}

// ---- Q&A suggestions ----

/** Suggest common Q&A for the business type. */
export function suggestQa(primaryCategory: string): string[] {
  const cat = normalizeLower(primaryCategory);
  const specific: string[] = [];
  for (const preset of BUSINESS_PRESETS) {
    if (
      cat === preset.id ||
      cat === normalizeLower(preset.primaryCategory) ||
      cat === normalizeLower(preset.label) ||
      cat.includes(preset.id) ||
      preset.id.includes(cat)
    ) {
      specific.push(...preset.qaSuggestions);
      break;
    }
  }
  // Dedupe and merge (common first, then specific)
  const merged: string[] = [...COMMON_QUESTIONS];
  for (const q of specific) {
    if (!merged.includes(q)) merged.push(q);
  }
  return merged;
}

// ---- Full optimization report ----

/** Build the full optimization report. */
export function buildReport(input: GbpInput): OptimizationReport {
  const services = input.services;
  const score = scoreDescription(input.description, input.primaryCategory, input.city, services);
  const density = keywordDensity(input.description, 5);
  const posts = generatePosts(input);
  const categorySuggestions = suggestCategories(input.primaryCategory);
  const photoPlan = generatePhotoPlan();
  const qaSuggestions = suggestQa(input.primaryCategory);
  const summary: SummaryStats = {
    descriptionScore: score.total,
    charCount: score.length,
    wordCount: score.wordCount,
    missingComponents: score.missing,
    postCount: posts.length,
    categorySuggestionsCount: categorySuggestions.length,
    photoPlanCount: photoPlan.length,
    qaCount: qaSuggestions.length,
  };
  return {
    input,
    score,
    keywordDensity: density,
    posts,
    categorySuggestions,
    photoPlan,
    qaSuggestions,
    summary,
  };
}

// ---- Rendering ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the report as a human-readable text report. */
export function renderText(report: OptimizationReport): string {
  const lines: string[] = [];
  lines.push("GOOGLE BUSINESS PROFILE OPTIMIZATION REPORT");
  lines.push("=".repeat(60));
  lines.push(`Business: ${report.input.businessName || "(not set)"}`);
  lines.push(`Primary category: ${report.input.primaryCategory || "(not set)"}`);
  lines.push(`City: ${report.input.city || "(not set)"}`);
  lines.push(`Hours: ${report.input.hours || "(not set)"}`);
  lines.push(`Website: ${report.input.website || "(not set)"}`);
  lines.push(`Services: ${report.input.services.join(", ") || "(none)"}`);
  lines.push("");
  lines.push("DESCRIPTION SCORE");
  lines.push("-".repeat(60));
  lines.push(`Score: ${report.score.total}/100`);
  lines.push(`Length: ${report.score.length} chars, ${report.score.wordCount} words`);
  lines.push(`Length OK (200-750): ${report.score.components.lengthOk ? "YES" : "NO"} (+30)`);
  lines.push(`Has category keyword: ${report.score.components.hasCategory ? "YES" : "NO"} (+20)`);
  lines.push(`Has city keyword: ${report.score.components.hasCity ? "YES" : "NO"} (+20)`);
  lines.push(`Has service keyword: ${report.score.components.hasService ? "YES" : "NO"} (+15)`);
  lines.push(`Has call-to-action: ${report.score.components.hasCta ? "YES" : "NO"} (+15)`);
  if (report.score.missing.length > 0) {
    lines.push(`Missing: ${report.score.missing.join(", ")}`);
  }
  if (report.keywordDensity.length > 0) {
    lines.push("");
    lines.push("KEYWORD DENSITY (top 5)");
    lines.push("-".repeat(60));
    for (const k of report.keywordDensity) {
      lines.push(`${k.word}: ${k.count} (${(k.density * 100).toFixed(1)}%)`);
    }
  }
  lines.push("");
  lines.push("GBP POST TEMPLATES");
  lines.push("-".repeat(60));
  for (const p of report.posts) {
    lines.push(`[${p.title.toUpperCase()}] CTA: ${p.cta}`);
    lines.push(`  ${p.body}`);
    lines.push(`  (${p.body.length} chars)`);
  }
  lines.push("");
  lines.push("CATEGORY SUGGESTIONS");
  lines.push("-".repeat(60));
  if (report.categorySuggestions.length === 0) {
    lines.push("(no suggestions — set primary category)");
  } else {
    for (const c of report.categorySuggestions) lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push("PHOTO PLAN");
  lines.push("-".repeat(60));
  for (const p of report.photoPlan) {
    lines.push(`[${p.required ? "REQUIRED" : "OPTIONAL"}] ${p.label} — ${p.description}`);
  }
  lines.push("");
  lines.push("Q&A SUGGESTIONS");
  lines.push("-".repeat(60));
  for (const q of report.qaSuggestions) lines.push(`- ${q}`);
  return lines.join("\n");
}

/** Render the report as CSV (field, value rows). */
export function renderCsv(report: OptimizationReport): string {
  const lines: string[] = ["field,value"];
  const rows: [string, string][] = [
    ["business_name", report.input.businessName],
    ["primary_category", report.input.primaryCategory],
    ["city", report.input.city],
    ["hours", report.input.hours],
    ["website", report.input.website],
    ["services", report.input.services.join("; ")],
    ["description_char_count", String(report.score.length)],
    ["description_word_count", String(report.score.wordCount)],
    ["description_score", String(report.score.total)],
    ["component_length_ok", String(report.score.components.lengthOk)],
    ["component_has_category", String(report.score.components.hasCategory)],
    ["component_has_city", String(report.score.components.hasCity)],
    ["component_has_service", String(report.score.components.hasService)],
    ["component_has_cta", String(report.score.components.hasCta)],
    ["missing_components", report.score.missing.join("; ")],
    ["keyword_density_top", report.keywordDensity.map((k) => `${k.word}:${k.count}`).join("; ")],
    ["post_whats_new", report.posts[0]?.body ?? ""],
    ["post_offer", report.posts[1]?.body ?? ""],
    ["post_event", report.posts[2]?.body ?? ""],
    ["category_suggestions", report.categorySuggestions.join("; ")],
    ["photo_plan_required", report.photoPlan.filter((p) => p.required).map((p) => p.label).join("; ")],
    ["photo_plan_optional", report.photoPlan.filter((p) => !p.required).map((p) => p.label).join("; ")],
    ["qa_suggestions", report.qaSuggestions.join("; ")],
  ];
  for (const [k, v] of rows) {
    lines.push(`${k},${escapeCsv(v)}`);
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:gbp-optimizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  businessName: string;
  primaryCategory: string;
  city: string;
  descriptionScore: number;
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

export function buildShareUrl(input: GbpInput): string {
  const params = new URLSearchParams();
  if (input.businessName) params.set("name", input.businessName);
  if (input.primaryCategory) params.set("cat", input.primaryCategory);
  if (input.services.length > 0) params.set("svc", input.services.join("\n"));
  if (input.city) params.set("city", input.city);
  if (input.description) params.set("desc", input.description);
  if (input.hours) params.set("hrs", input.hours);
  if (input.website) params.set("web", input.website);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<GbpInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<GbpInput> = {};
  const name = params.get("name");
  if (name !== null) out.businessName = name;
  const cat = params.get("cat");
  if (cat !== null) out.primaryCategory = cat;
  const svc = params.get("svc");
  if (svc !== null) out.services = parseServices(svc);
  const city = params.get("city");
  if (city !== null) out.city = city;
  const desc = params.get("desc");
  if (desc !== null) out.description = desc;
  const hrs = params.get("hrs");
  if (hrs !== null) out.hours = hrs;
  const web = params.get("web");
  if (web !== null) out.website = web;
  return out;
}
