/**
 * AI Instagram Bio Generator — pure logic.
 *
 * Generate Instagram bios within the 150-character limit using a built-in
 * template library for creator, business, personal, and brand accounts.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type AccountType = "creator" | "business" | "personal" | "brand";
export type Tone = "aesthetic" | "bold" | "minimal" | "playful" | "professional";
export type Cta = "link-in-bio" | "dm-me" | "shop-now" | "book-now" | "follow";

export interface BioVariant {
  id: string;
  text: string;
  accountType: AccountType;
  tone: Tone;
  cta: Cta;
  charCount: number;
  charLimit: number;
  exceedsLimit: boolean;
  lines: string[];
  hashtags: string[];
  trimmed: boolean;
}

export interface HandleIdea {
  handle: string;
  available: boolean | null; // null = unknown (no network check)
  note: string;
}

export interface BioStats {
  accountType: AccountType;
  count: number;
  avgChars: number;
  overLimit: number;
}

export interface AbPair {
  id: string;
  control: BioVariant;
  challenger: BioVariant;
  hypothesis: string;
  whatToMeasure: string;
}

// ---------- Constants ----------

export const CHAR_LIMIT = 150;
export const HISTORY_KEY = "unqtools:ai-ig-bio:history";
export const FAVES_KEY = "unqtools:ai-ig-bio:faves";
export const HISTORY_MAX = 20;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  creator: "Creator",
  business: "Business",
  personal: "Personal",
  brand: "Brand",
};

export const TONE_LABELS: Record<Tone, string> = {
  aesthetic: "Aesthetic",
  bold: "Bold",
  minimal: "Minimal",
  playful: "Playful",
  professional: "Professional",
};

export const CTA_LABELS: Record<Cta, string> = {
  "link-in-bio": "Link in bio",
  "dm-me": "DM me",
  "shop-now": "Shop now",
  "book-now": "Book now",
  follow: "Follow",
};

export const NICHE_PRESETS: string[] = [
  "fitness coach", "food blogger", "travel photographer",
  "indie musician", "personal finance", "software engineer",
  "beauty influencer", "small business owner", "yoga teacher",
  "tech reviewer", "mom blogger", "real estate agent",
];

// ---------- Tone emoji packs ----------

const TONE_EMOJIS: Record<Tone, string[]> = {
  aesthetic: ["✨", "🌸", "🤍", "☁️", "🌙"],
  bold: ["🔥", "⚡", "💪", "🚀", "💥"],
  minimal: ["▪️", "◯", "·", "—", ""],
  playful: ["🎉", "😄", "🌈", "🎈", "🦄"],
  professional: ["📊", "💼", "🎯", "📈", "✅"],
};

// ---------- CTA templates (with line break) ----------

const CTA_TEMPLATES: Record<Cta, string> = {
  "link-in-bio": "🔗 Link in bio",
  "dm-me": "📩 DM me",
  "shop-now": "🛍️ Shop now",
  "book-now": "📅 Book now",
  follow: "👇 Follow",
};

// ---------- Account-type template skeletons ----------
//
// Each template is a function returning an array of lines (no trailing
// newline). The generator then joins them with \n, appends a CTA line,
// and checks the 150-char limit.

interface TemplateContext {
  name: string;
  niche: string;
  tone: Tone;
  emoji: string;
}

type TemplateFn = (ctx: TemplateContext) => string[];

interface AccountTemplate {
  accountType: AccountType;
  tones: Tone[];   // tones this template suits
  build: TemplateFn;
}

const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  // ---- Creator templates ----
  {
    accountType: "creator",
    tones: ["aesthetic", "playful", "bold"],
    build: (c) => [
      `${c.emoji} ${c.name} | ${c.niche}`,
      `Sharing the journey ✨`,
      `New ${c.niche.toLowerCase()} content weekly`,
    ],
  },
  {
    accountType: "creator",
    tones: ["minimal", "professional"],
    build: (c) => [
      `${c.name}`,
      `${c.niche}`,
      `Creator · Storyteller`,
    ],
  },
  {
    accountType: "creator",
    tones: ["bold"],
    build: (c) => [
      `🔥 ${c.name}`,
      `${c.niche} · unfiltered`,
      `Building in public`,
    ],
  },
  // ---- Business templates ----
  {
    accountType: "business",
    tones: ["professional", "minimal"],
    build: (c) => [
      `${c.emoji} ${c.name}`,
      `${c.niche} · est. with care`,
      `Helping you ${ctaVerb(c.niche)}`,
    ],
  },
  {
    accountType: "business",
    tones: ["bold", "playful"],
    build: (c) => [
      `${c.emoji} ${c.name}`,
      `We make ${c.niche.toLowerCase()} simple`,
      `Trusted by 1,000+ happy clients`,
    ],
  },
  // ---- Personal templates ----
  {
    accountType: "personal",
    tones: ["aesthetic", "playful"],
    build: (c) => [
      `${c.emoji} ${c.name}`,
      `${c.niche} enthusiast`,
      `Living one day at a time 🌿`,
    ],
  },
  {
    accountType: "personal",
    tones: ["minimal"],
    build: (c) => [
      `${c.name}`,
      `${c.niche}`,
      `Just here for the vibes`,
    ],
  },
  {
    accountType: "personal",
    tones: ["professional"],
    build: (c) => [
      `${c.name}`,
      `${c.niche} | Personal`,
      `Thoughts on life & work`,
    ],
  },
  // ---- Brand templates ----
  {
    accountType: "brand",
    tones: ["professional", "minimal"],
    build: (c) => [
      `${c.emoji} ${c.name}`,
      `${c.niche}, reimagined`,
      `Quality you can feel`,
    ],
  },
  {
    accountType: "brand",
    tones: ["bold"],
    build: (c) => [
      `⚡ ${c.name}`,
      `The ${c.niche.toLowerCase()} brand to watch`,
      `Shipping new drops weekly`,
    ],
  },
  {
    accountType: "brand",
    tones: ["aesthetic", "playful"],
    build: (c) => [
      `${c.emoji} ${c.name}`,
      `${c.niche} with personality`,
      `Made with love, shipped with care`,
    ],
  },
];

// ---------- Helpers ----------

function ctaVerb(niche: string): string {
  // Best-effort verb derived from niche; fallback generic.
  const n = niche.toLowerCase();
  if (/fit|train|gym|yoga/.test(n)) return "move better";
  if (/food|cook|recipe|bake/.test(n)) return "cook smarter";
  if (/travel|trip|tour/.test(n)) return "travel further";
  if (/code|dev|software|engineer/.test(n)) return "ship faster";
  if (/finance|money|invest/.test(n)) return "save more";
  if (/beauty|skin|makeup/.test(n)) return "glow daily";
  return "live better";
}

/** Normalize a name/niche string. */
export function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Count characters using Instagram-style rules (emoji = 1 char). */
export function countChars(s: string): number {
  // Strip variation selectors and ZWJ for stable counting
  // eslint-disable-next-line no-misleading-character-class
  return Array.from(s.replace(/[\uFE0F\u200D]/g, "")).length;
}

/** Generate a stable id. */
function id(prefix: string, i: number): string {
  return `${prefix}-${i}`;
}

/** Choose tone-appropriate emoji from the pack. */
function pickEmoji(tone: Tone, idx: number): string {
  const pack = TONE_EMOJIS[tone];
  return pack[idx % pack.length];
}

// ---------- Hashtag suggestions ----------

const HASHTAG_PREFIXES: string[] = [
  "daily", "insta", "life", "of", "community", "lover", "world", "gram",
];

/** Generate up to N hashtag suggestions for a niche. */
export function suggestHashtags(niche: string, max = 8): string[] {
  const n = clean(niche).toLowerCase();
  if (!n) return [];
  const base = n.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  if (!base) return [];
  const out = new Set<string>();
  out.add(`#${base}`);
  for (const p of HASHTAG_PREFIXES) {
    if (out.size >= max) break;
    out.add(`#${p}${base}`);
  }
  out.add(`#${base}life`);
  out.add(`#${base}community`);
  return Array.from(out).slice(0, max);
}

// ---------- Handle ideas ----------

/** Generate username/handle ideas from a name and niche. */
export function suggestHandles(name: string, niche: string, max = 8): HandleIdea[] {
  const nm = clean(name).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  const ni = clean(niche).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
  const out: HandleIdea[] = [];
  const seen = new Set<string>();
  const push = (handle: string, note: string) => {
    if (!handle || handle.length < 3 || handle.length > 30) return;
    if (seen.has(handle)) return;
    seen.add(handle);
    out.push({ handle: `@${handle}`, available: null, note });
  };
  if (nm) {
    push(nm, "Your name, plain");
    push(`${nm}.io`, "Tech-leaning");
    push(`the${nm}`, "The-style");
    push(`${nm}daily`, "Daily-content vibe");
    push(`iam${nm}`, "I-am style");
  }
  if (nm && ni) {
    push(`${nm}.${ni}`, "Name + niche");
    push(`${ni}.by.${nm}`, "Niche by name");
    push(`${nm}${ni}`, "Combined");
  }
  if (ni) {
    push(`${ni}lover`, "Lover style");
    push(`just${ni}`, "Just-style");
  }
  return out.slice(0, max);
}

// ---------- Bio generation ----------

/**
 * Build a single bio variant.
 *
 * @param accountType  Account type
 * @param tone         Tone preset
 * @param cta          CTA preset
 * @param name         Display name (e.g., "Alex Rivera")
 * @param niche        Niche (e.g., "fitness coach")
 * @param templateIdx  Optional index into matching templates (for determinism)
 * @param variantIdx   Variant index, used for emoji + id
 */
export function buildBio(
  accountType: AccountType,
  tone: Tone,
  cta: Cta,
  name: string,
  niche: string,
  templateIdx = 0,
  variantIdx = 0,
): BioVariant {
  const nm = clean(name) || "Your Name";
  const ni = clean(niche) || "your niche";
  const matching = ACCOUNT_TEMPLATES.filter(
    (t) => t.accountType === accountType && t.tones.includes(tone),
  );
  const pool = matching.length > 0
    ? matching
    : ACCOUNT_TEMPLATES.filter((t) => t.accountType === accountType);
  const template = pool[templateIdx % pool.length] ?? ACCOUNT_TEMPLATES[0];
  const emoji = pickEmoji(tone, variantIdx);
  const lines = template.build({ name: nm, niche: ni, tone, emoji });
  lines.push(CTA_TEMPLATES[cta]);
  const text = lines.join("\n");
  const charCount = countChars(text);
  const exceedsLimit = charCount > CHAR_LIMIT;
  const hashtags = suggestHashtags(ni, 5);
  const trimmed = exceedsLimit;
  return {
    id: id("bio", variantIdx),
    text,
    accountType,
    tone,
    cta,
    charCount,
    charLimit: CHAR_LIMIT,
    exceedsLimit,
    lines,
    hashtags,
    trimmed: false, // will be set by trimBio if used
  };
}

/** Auto-trim a bio to the 150-char limit on word boundaries. */
export function trimBio(bio: BioVariant): BioVariant {
  if (!bio.exceedsLimit) return { ...bio, trimmed: false };
  // Drop trailing lines until we fit, then word-trim the last line
  let lines = [...bio.lines];
  while (lines.length > 1 && countChars(lines.join("\n")) > CHAR_LIMIT) {
    lines = lines.slice(0, -1);
  }
  let text = lines.join("\n");
  while (countChars(text) > CHAR_LIMIT && lines.length > 0) {
    // Word-trim the last line
    const last = lines[lines.length - 1];
    const words = last.split(" ");
    while (words.length > 1 && countChars(lines.join("\n")) > CHAR_LIMIT) {
      words.pop();
    }
    lines[lines.length - 1] = words.join(" ").replace(/[·,\s]+$/, "");
    text = lines.join("\n");
    if (countChars(text) <= CHAR_LIMIT) break;
    lines = lines.slice(0, -1);
    if (lines.length === 0) break;
  }
  return {
    ...bio,
    text,
    lines,
    charCount: countChars(text),
    exceedsLimit: countChars(text) > CHAR_LIMIT,
    trimmed: true,
  };
}

/**
 * Generate N bio variants across the matched template pool for a given
 * account type and tone. Always returns at least 4 variants.
 */
export function generateBios(
  accountType: AccountType,
  tone: Tone,
  cta: Cta,
  name: string,
  niche: string,
  count = 6,
): BioVariant[] {
  const out: BioVariant[] = [];
  const n = Math.max(4, count);
  for (let i = 0; i < n; i++) {
    out.push(buildBio(accountType, tone, cta, name, niche, i, i));
  }
  return out;
}

/** Generate an A/B pair (control + challenger) for testing. */
export function generateAbPair(
  accountType: AccountType,
  name: string,
  niche: string,
): AbPair {
  const tones: Tone[] = ["aesthetic", "bold", "minimal", "playful", "professional"];
  const controlTone = tones[0];
  // Challenger is a different tone
  const challengerTone = tones[1 + (Math.abs(hashCode(niche)) % (tones.length - 1))];
  const cta: Cta = "link-in-bio";
  const control = buildBio(accountType, controlTone, cta, name, niche, 0, 0);
  const challenger = buildBio(accountType, challengerTone, cta, name, niche, 1, 1);
  return {
    id: `abpair-${Date.now()}`,
    control,
    challenger,
    hypothesis:
      `Tests ${TONE_LABELS[challengerTone].toLowerCase()} framing vs ${TONE_LABELS[controlTone].toLowerCase()} baseline. ` +
      `Hypothesis: the ${TONE_LABELS[challengerTone].toLowerCase()} tone drives more profile-link clicks for ${clean(niche) || "this niche"}.`,
    whatToMeasure:
      "Profile link clicks (via link-in-bio tool) and follower growth over a 2-week window. Keep audience, posting cadence, and content mix constant.",
  };
}

/** Compute stats across a list of variants. */
export function computeStats(bios: BioVariant[]): BioStats[] {
  const byType = new Map<AccountType, BioVariant[]>();
  for (const b of bios) {
    if (!byType.has(b.accountType)) byType.set(b.accountType, []);
    byType.get(b.accountType)!.push(b);
  }
  const out: BioStats[] = [];
  for (const [accountType, list] of byType) {
    const avg = list.length > 0
      ? Math.round(list.reduce((s, b) => s + b.charCount, 0) / list.length)
      : 0;
    out.push({
      accountType,
      count: list.length,
      avgChars: avg,
      overLimit: list.filter((b) => b.exceedsLimit).length,
    });
  }
  out.sort((a, b) => a.accountType.localeCompare(b.accountType));
  return out;
}

// ---------- Rendering ----------

/** Render bios as plain text (header + text + hashtags, separated by ---). */
export function renderText(bios: BioVariant[]): string {
  return bios.map((b) => {
    const parts = [
      `[${ACCOUNT_TYPE_LABELS[b.accountType]} · ${TONE_LABELS[b.tone]} · ${CTA_LABELS[b.cta]}]`,
      b.text,
      `Chars: ${b.charCount}/${b.charLimit}${b.exceedsLimit ? " (over limit!)" : ""}`,
    ];
    if (b.hashtags.length > 0) parts.push(b.hashtags.join(" "));
    return parts.join("\n");
  }).join("\n---\n");
}

/** Render bios as Markdown. */
export function renderMarkdown(bios: BioVariant[]): string {
  return bios.map((b, i) => {
    const lines = [
      `## Bio ${i + 1} — ${ACCOUNT_TYPE_LABELS[b.accountType]} / ${TONE_LABELS[b.tone]}`,
      "```",
      b.text,
      "```",
      `*Characters: ${b.charCount}/${b.charLimit}${b.exceedsLimit ? " — over limit" : ""}*`,
    ];
    if (b.hashtags.length > 0) lines.push(`**Hashtags:** ${b.hashtags.join(" ")}`);
    return lines.join("\n");
  }).join("\n\n");
}

/** Render bios as CSV. */
export function renderCsv(bios: BioVariant[]): string {
  const lines = ["id,account_type,tone,cta,char_count,char_limit,exceeds_limit,trimmed,text"];
  for (const b of bios) {
    lines.push([
      b.id,
      b.accountType,
      b.tone,
      b.cta,
      b.charCount,
      b.charLimit,
      b.exceedsLimit ? "yes" : "no",
      b.trimmed ? "yes" : "no",
      escapeCsv(b.text),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render bios as JSON. */
export function renderJson(bios: BioVariant[]): string {
  return JSON.stringify(bios.map((b) => ({
    id: b.id,
    accountType: b.accountType,
    tone: b.tone,
    cta: b.cta,
    text: b.text,
    charCount: b.charCount,
    charLimit: b.charLimit,
    exceedsLimit: b.exceedsLimit,
    trimmed: b.trimmed,
    hashtags: b.hashtags,
  })), null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Quick stable string hash for deterministic selection. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  accountType: AccountType;
  tone: Tone;
  cta: Cta;
  name: string;
  niche: string;
  variantCount: number;
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

// ---------- Favorites (localStorage) ----------

export interface FavoriteEntry {
  ts: number;
  text: string;
  accountType: AccountType;
  tone: Tone;
  cta: Cta;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const next = [entry, ...loadFavorites()].slice(0, 50);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeFavorite(ts: number): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.ts !== ts);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  accountType: AccountType;
  tone: Tone;
  cta: Cta;
  name: string;
  niche: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.accountType) params.set("at", state.accountType);
  if (state.tone) params.set("t", state.tone);
  if (state.cta) params.set("c", state.cta);
  if (state.name) params.set("n", state.name);
  if (state.niche) params.set("ni", state.niche);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const at = params.get("at") as AccountType | null;
  if (at && at in ACCOUNT_TYPE_LABELS) out.accountType = at;
  const t = params.get("t") as Tone | null;
  if (t && t in TONE_LABELS) out.tone = t;
  const c = params.get("c") as Cta | null;
  if (c && c in CTA_LABELS) out.cta = c;
  const n = params.get("n");
  if (n) out.name = n;
  const ni = params.get("ni");
  if (ni) out.niche = ni;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  accountType: AccountType,
  tone: Tone,
  cta: Cta,
  name: string,
  niche: string,
): string {
  return [
    "You are an expert social media copywriter who writes scroll-stopping Instagram bios.",
    `Account type: ${ACCOUNT_TYPE_LABELS[accountType]}.`,
    `Display name: ${name}.`,
    `Niche: ${niche}.`,
    `Tone: ${TONE_LABELS[tone]}.`,
    `Call-to-action: ${CTA_LABELS[cta]}.`,
    "",
    "Hard constraint: every bio MUST fit Instagram's 150-character limit (counting emojis as 1 character and line breaks as 1 character).",
    "Use 2-4 short lines separated by line breaks, with tasteful emojis.",
    "Generate 5 bio variations.",
    "",
    "For each variation, output a JSON object with:",
    '- "text": the bio text (with \\n line breaks)',
    '- "hashtags": an array of 3-5 relevant hashtag strings (e.g., "#fitness")',
    '- "rationale": one sentence explaining why this bio works',
    "",
    "Rules:",
    "- Vary line structure and emoji placement across variations.",
    "- Always include the CTA on the last line.",
    "- Output ONLY a JSON array — no markdown fences, no commentary.",
  ].join("\n");
}

export interface LlmBioVariant {
  text: string;
  hashtags: string[];
  rationale: string;
}

export function renderLlmResult(rawText: string):
  | { ok: true; variants: LlmBioVariant[] }
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
  const out: LlmBioVariant[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) continue;
    const hashtags = Array.isArray(o.hashtags)
      ? (o.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 8)
      : [];
    const rationale = typeof o.rationale === "string" ? o.rationale : "";
    out.push({ text, hashtags, rationale });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid bio objects." };
  }
  return { ok: true, variants: out };
}
