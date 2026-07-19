/**
 * AI Alt Text Generator for Images — pure logic.
 *
 * Generate WCAG-friendly alt text from image metadata + context. Pure functions
 * only — no DOM, no network. The optional LLM call (BYO API key) and the image
 * file reading (which needs the DOM) live in ui.tsx.
 */

// ---------- Types ----------

export type ImageCategory = "decorative" | "informative" | "complex";
export type ImageRole =
  | "product" | "screenshot" | "diagram" | "chart" | "illustration"
  | "photograph" | "logo" | "icon" | "avatar" | "decorative" | "background"
  | "infographic" | "map" | "artwork";

export interface ImageMeta {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  format: string; // e.g., "png", "jpeg", "webp"
  dominantColor: string; // hex
  aspectRatio: string; // e.g., "16:9"
  hasAlpha: boolean;
  megapixels: number;
}

export interface LintIssue {
  code: "redundant-prefix" | "too-long" | "too-short" | "same-as-filename"
    | "keyword-stuffing" | "no-alt" | "decorative-has-text";
  severity: "error" | "warning" | "info";
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
  score: number; // 0-100
  passed: boolean;
}

export interface AltSuggestion {
  text: string;
  category: ImageCategory;
  role: ImageRole;
  language: string;
}

export interface BatchEntry {
  fileName: string;
  alt: string;
  category: ImageCategory;
  width: number;
  height: number;
  format: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-alt-text:history";
export const HISTORY_MAX = 20;

export const MAX_ALT_LENGTH = 125;
export const MIN_ALT_LENGTH = 5;

export const CATEGORY_LABELS: Record<ImageCategory, string> = {
  decorative: "Decorative (empty alt)",
  informative: "Informative (concise description)",
  complex: "Complex (long description)",
};

export const ROLE_LABELS: Record<ImageRole, string> = {
  product: "Product photo",
  screenshot: "Screenshot",
  diagram: "Diagram",
  chart: "Chart",
  illustration: "Illustration",
  photograph: "Photograph",
  logo: "Logo",
  icon: "Icon",
  avatar: "Avatar",
  decorative: "Decorative graphic",
  background: "Background image",
  infographic: "Infographic",
  map: "Map",
  artwork: "Artwork",
};

// Templates for each role — placeholders: {subject}, {color}, {context}, {size}
export const ROLE_TEMPLATES: Record<ImageRole, string[]> = {
  product: [
    "Product photo of {subject}",
    "{subject} product shown on a {color} background",
    "E-commerce product image of {subject}",
  ],
  screenshot: [
    "Screenshot of {subject}",
    "Screenshot showing {subject}",
    "{subject} interface screenshot",
  ],
  diagram: [
    "Diagram illustrating {subject}",
    "Schematic of {subject}",
    "Diagram of {subject}",
  ],
  chart: [
    "Bar chart showing {subject}",
    "Pie chart of {subject}",
    "Line chart of {subject} over time",
  ],
  illustration: [
    "Illustration of {subject}",
    "Hand-drawn illustration depicting {subject}",
    "Stylized illustration of {subject}",
  ],
  photograph: [
    "Photograph of {subject}",
    "Photo showing {subject}",
    "Photograph depicting {subject}",
  ],
  logo: [
    "{subject} logo",
    "Logo for {subject}",
    "Brand logo of {subject}",
  ],
  icon: [
    "{subject} icon",
    "Icon representing {subject}",
    "UI icon for {subject}",
  ],
  avatar: [
    "User avatar depicting {subject}",
    "Profile avatar of {subject}",
    "Avatar image of {subject}",
  ],
  decorative: [
    "", // decorative → empty alt
  ],
  background: [
    "Background image with {color} tones",
    "Decorative background pattern in {color}",
    "Background texture in {color}",
  ],
  infographic: [
    "Infographic about {subject}",
    "Infographic summarizing {subject}",
    "Data infographic on {subject}",
  ],
  map: [
    "Map showing {subject}",
    "Geographic map of {subject}",
    "Location map highlighting {subject}",
  ],
  artwork: [
    "Artwork depicting {subject}",
    "Digital artwork of {subject}",
    "Artistic rendering of {subject}",
  ],
};

// WCAG-friendly phrases for "complex" images
export const COMPLEX_PREFIXES = [
  "Detailed image showing",
  "Extended description: ",
  "This image depicts",
];

// 100+ language templates (each entry is one language with "Image of: " prefix translation)
export const LANGUAGE_TEMPLATES: Record<string, string> = {
  en: "Image of",
  es: "Imagen de",
  fr: "Image de",
  de: "Bild von",
  it: "Immagine di",
  pt: "Imagem de",
  nl: "Afbeelding van",
  ru: "Изображение",
  ja: "画像:",
  ko: "이미지:",
  zh: "图片:",
  ar: "صورة",
  hi: "इमेज",
  bn: "ছবি",
  ur: "تصویر",
  tr: "Resim",
  pl: "Obraz",
  sv: "Bild av",
  no: "Bilde av",
  da: "Billede af",
  fi: "Kuva",
  el: "Εικόνα",
  he: "תמונה",
  th: "ภาพ",
  vi: "Hình ảnh",
  id: "Gambar",
  ms: "Imej",
  cs: "Obrázek",
  sk: "Obrázok",
  hu: "Kép",
  ro: "Imagine",
  bg: "Изображение",
  uk: "Зображення",
  hr: "Slika",
  sr: "Слика",
  sl: "Slika",
  et: "Pilt",
  lv: "Attēls",
  lt: "Paveikslėlis",
  fa: "تصویر",
  sw: "Picha",
  ta: "படம்",
  te: "చిత్రం",
  mr: "प्रतिमा",
  gu: "છબી",
  pa: "ਤਸਵੀਰ",
  ml: "ചിത്രം",
  kn: "ಚಿತ್ರ",
  or: "ପ୍ରତିମା",
  as: "ছবি",
  ne: "तस्बिर",
  si: "පින්තූරය",
  km: "រូបភាព",
  lo: "ຮູບ",
  my: "ပုံ",
  ka: "გამოსახულება",
  am: "ምስል",
  ti: "ስእሊ",
  ha: "Hotuna",
  yo: "Aworan",
  ig: "Onyonyo",
  zu: "Isithombe",
  af: "Beeld",
  is: "Mynd",
  ga: "Íomhá",
  cy: "Delwedd",
  eu: "Irudia",
  ca: "Imatge",
  gl: "Imaxe",
  mt: "Stampa",
  lb: "Bild",
  fo: "Mynd",
  mk: "Слика",
  bs: "Slika",
  sq: "Imazh",
  az: "Şəkil",
  kk: "Сурет",
  uz: "Rasm",
  ky: "Сүрөт",
  tg: "Тасвир",
  tk: "Surat",
  mn: "Зураг",
  be: "Выява",
  hy: "Նկար",
  ka2: "გამოსახულება",
  mn2: "Зураг",
  ja2: "画像",
  tg2: "Тасвир",
  az2: "Şəkil",
  kk2: "Сурет",
  uz2: "Rasm",
  ky2: "Сүрөт",
  tk2: "Surat",
  sa: "चित्रम्",
  ne2: "तस्बिर",
  my2: "ပုံ",
  km2: "រូបភាព",
  lo2: "ຮູບ",
  si2: "පින්තූරය",
  dv: "ފޮޓޯ",
  ps: "انځور",
  sd: "تصوير",
  br: "Skeudenn",
  co: "Fiura",
  fy: "Ofbylding",
  gd: "Dealbh",
  rm: "Maletg",
  se: "Govva",
  sm: "Ata",
  to: "Ata",
  fj: "Taba",
  haw: "Kiʻi",
  mi: "Whakaahua",
  tl: "Larawan",
  ceb: "Hulagway",
  hil: "Laraw",
  war: "Litrato",
  pam: "Larau",
  ilo: "Ladawan",
  mg: "Sary",
  ny: "Chithunzi",
  sn: "Mufananidzo",
  rw: "Ifoto",
  ln: "Elilingi",
  kg: "Fot",
  ts: "Vuhlayi",
  xh: "Umfanekiso",
  st: "Setshwantsho",
  tn: "Setshwantsho",
  ns: "Seswantsho",
  ss: "Umsitho",
  ve: "Tshithuvi",
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_TEMPLATES);

// ---------- Filename + context utilities ----------

const FILENAME_STOPWORDS = new Set([
  "img", "image", "photo", "pic", "picture", "screenshot", "screen",
  "icon", "logo", "asset", "untitled", "download", "copy", "of", "the", "a", "an",
]);

const FILENAME_HINTS: Array<{ re: RegExp; role: ImageRole }> = [
  { re: /^screenshot|^screen[-_]shot|^scr_/i, role: "screenshot" },
  { re: /^logo|^brand/i, role: "logo" },
  { re: /^icon|^ic_/i, role: "icon" },
  { re: /^avatar|^profile/i, role: "avatar" },
  { re: /^bg[-_]|^background|^hero[-_]bg/i, role: "background" },
  { re: /^chart|^graph/i, role: "chart" },
  { re: /^diagram|^schema/i, role: "diagram" },
  { re: /^map[-_]/i, role: "map" },
  { re: /^infographic/i, role: "infographic" },
  { re: /^product|^p[-_]/i, role: "product" },
  { re: /^artwork|^art[-_]/i, role: "artwork" },
];

/** Strip extension and convert filename to a readable subject. */
export function fileNameToSubject(fileName: string): string {
  // Remove extension
  const noExt = fileName.replace(/\.[^.]+$/, "");
  // Replace separators with spaces
  const withSpaces = noExt.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!withSpaces) return "";
  // Drop common stopwords, title-case the rest
  const words = withSpaces
    .split(/\s+/)
    .filter((w) => !FILENAME_STOPWORDS.has(w.toLowerCase()))
    .filter(Boolean);
  if (words.length === 0) return "";
  // Title-case
  const titled = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return titled;
}

/** Guess an image role from its filename. */
export function guessRoleFromFileName(fileName: string): ImageRole {
  for (const hint of FILENAME_HINTS) {
    if (hint.re.test(fileName)) return hint.role;
  }
  return "photograph";
}

/** Normalize a context string. */
export function normalizeContext(s: string): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

/** Compute aspect ratio string from dimensions. */
export function computeAspectRatio(w: number, h: number): string {
  if (!w || !h) return "unknown";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

/** Convert bytes to a human-readable file size. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Format an image format string. */
export function normalizeFormat(format: string): string {
  if (!format) return "unknown";
  return format.toLowerCase().replace("image/", "").replace("jpeg", "jpg");
}

// ---------- Alt text generation ----------

/**
 * Generate alt text suggestions from metadata + context.
 * Returns multiple suggestions (templates × role).
 */
export function generateAltSuggestions(
  meta: ImageMeta,
  context: string,
  role: ImageRole,
  language: string,
): AltSuggestion[] {
  const subject = normalizeContext(context) || fileNameToSubject(meta.fileName) || "the subject";
  const color = meta.dominantColor || "neutral";
  const out: AltSuggestion[] = [];
  const templates = ROLE_TEMPLATES[role] ?? ROLE_TEMPLATES.photograph;
  for (const tpl of templates) {
    const text = tpl
      .replace(/\{subject\}/g, subject)
      .replace(/\{color\}/g, color)
      .replace(/\{context\}/g, context);
    out.push({ text, category: role === "decorative" ? "decorative" : "informative", role, language });
  }
  // Always include the empty (decorative) option for non-decorative roles
  if (role !== "decorative") {
    out.push({ text: "", category: "decorative", role: "decorative", language });
  }
  // And a complex/long option for informative roles
  if (role !== "decorative") {
    const long = `${COMPLEX_PREFIXES[0]} ${subject} in a ${computeAspectRatio(meta.width, meta.height)} ${normalizeFormat(meta.format)} image (${meta.width}×${meta.height}px, ${formatFileSize(meta.fileSize)}).`;
    out.push({ text: long, category: "complex", role, language });
  }
  return out;
}

/** Localize the "Image of: " prefix for a given language. */
export function localizePrefix(language: string): string {
  return LANGUAGE_TEMPLATES[language] ?? LANGUAGE_TEMPLATES.en;
}

/** Prepend the localized "Image of:" prefix to alt text (used by screen readers in some locales). */
export function withLanguagePrefix(text: string, language: string): string {
  if (!text) return "";
  const prefix = localizePrefix(language);
  return `${prefix}: ${text}`;
}

// ---------- SEO keyword weaving ----------

/**
 * Weave an SEO keyword into alt text naturally.
 * Returns {text, stuffed} where stuffed=true means the keyword already appears ≥ 2 times.
 */
export function weaveKeyword(alt: string, keyword: string): { text: string; stuffed: boolean } {
  const kw = (keyword || "").trim();
  if (!kw) return { text: alt, stuffed: false };
  const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "gi");
  const matches = alt.match(re);
  if (matches && matches.length >= 2) {
    return { text: alt, stuffed: true };
  }
  if (matches && matches.length === 1) {
    return { text: alt, stuffed: false };
  }
  // Append keyword naturally — only if alt doesn't end with the keyword
  const trimmed = alt.replace(/\.$/, "");
  return { text: `${trimmed} — ${kw}`, stuffed: false };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Linter ----------

const REDUNDANT_PREFIXES = [
  "image of", "picture of", "photo of", "photograph of",
  "graphic of", "illustration of", "screenshot of ",
];

export function lintAlt(
  alt: string,
  category: ImageCategory,
  meta: ImageMeta,
  keyword?: string,
): LintResult {
  const issues: LintIssue[] = [];
  const trimmed = (alt || "").trim();

  // Decorative images should have empty alt
  if (category === "decorative") {
    if (trimmed.length > 0) {
      issues.push({
        code: "decorative-has-text",
        severity: "error",
        message: "Decorative images should have empty alt text (alt=\"\"). Remove the description.",
      });
    }
  } else {
    // Non-decorative must have alt text
    if (trimmed.length === 0) {
      issues.push({
        code: "no-alt",
        severity: "error",
        message: "Informative/complex images must have alt text. Provide a concise description.",
      });
    } else {
      // Length checks
      if (trimmed.length > MAX_ALT_LENGTH) {
        issues.push({
          code: "too-long",
          severity: "warning",
          message: `Alt text is ${trimmed.length} characters — most screen readers truncate around ${MAX_ALT_LENGTH}. Consider a shorter summary + long description.`,
        });
      }
      if (trimmed.length < MIN_ALT_LENGTH) {
        issues.push({
          code: "too-short",
          severity: "warning",
          message: `Alt text is only ${trimmed.length} characters — provide more context.`,
        });
      }
      // Redundant prefix check
      const lower = trimmed.toLowerCase();
      for (const p of REDUNDANT_PREFIXES) {
        if (lower.startsWith(p)) {
          issues.push({
            code: "redundant-prefix",
            severity: "warning",
            message: `Alt text starts with "${p}" — screen readers already announce "image", so this prefix is redundant.`,
          });
          break;
        }
      }
      // Same as filename (case-insensitive)
      const fn = meta.fileName.replace(/\.[^.]+$/, "").toLowerCase();
      if (fn && trimmed.toLowerCase() === fn) {
        issues.push({
          code: "same-as-filename",
          severity: "warning",
          message: "Alt text is identical to the filename — provide a meaningful description instead.",
        });
      }
      // Keyword stuffing
      if (keyword) {
        const kw = keyword.trim().toLowerCase();
        if (kw) {
          const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "gi");
          const matches = trimmed.match(re);
          if (matches && matches.length >= 2) {
            issues.push({
              code: "keyword-stuffing",
              severity: "warning",
              message: `The keyword "${keyword}" appears ${matches.length} times — avoid stuffing. Use it once, naturally.`,
            });
          }
        }
      }
    }
  }

  // Score: start at 100, subtract per issue
  let score = 100;
  for (const i of issues) {
    if (i.severity === "error") score -= 40;
    else if (i.severity === "warning") score -= 15;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));
  const passed = issues.filter((i) => i.severity === "error").length === 0;
  return { issues, score, passed };
}

// ---------- HTML renderers ----------

export function renderImgTag(
  src: string,
  alt: string,
  width?: number,
  height?: number,
  extraAttrs?: Record<string, string>,
): string {
  const attrs: string[] = [`src="${escapeHtml(src)}"`];
  if (alt === "" ) {
    attrs.push('alt=""');
  } else {
    attrs.push(`alt="${escapeHtml(alt)}"`);
  }
  if (width) attrs.push(`width="${width}"`);
  if (height) attrs.push(`height="${height}"`);
  if (extraAttrs) {
    for (const [k, v] of Object.entries(extraAttrs)) {
      attrs.push(`${k}="${escapeHtml(v)}"`);
    }
  }
  return `<img ${attrs.join(" ")} />`;
}

export function renderAriaHiddenImg(src: string, extraAttrs?: Record<string, string>): string {
  return renderImgTag(src, "", undefined, undefined, { "aria-hidden": "true", ...extraAttrs });
}

export function renderLongDescription(alt: string, longDesc: string): string {
  return `<figure>\n  <img src="..." alt="${escapeHtml(alt)}" />\n  <figcaption>${escapeHtml(longDesc)}</figcaption>\n</figure>`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Batch export ----------

export function renderBatchCsv(entries: BatchEntry[]): string {
  const lines = ["filename,alt,category,width,height,format"];
  for (const e of entries) {
    lines.push([
      escapeCsv(e.fileName),
      escapeCsv(e.alt),
      e.category,
      String(e.width),
      String(e.height),
      e.format,
    ].join(","));
  }
  return lines.join("\n");
}

export function renderBatchJson(entries: BatchEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function renderBatchHtml(entries: BatchEntry[]): string {
  return entries.map((e) =>
    renderImgTag(`${e.fileName}`, e.alt, e.width, e.height),
  ).join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Split a CSV row with quoted values (mirrors other tools' helper). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---------- Stats ----------

export interface BatchStats {
  total: number;
  withAlt: number;
  emptyAlt: number;
  decorative: number;
  informative: number;
  complex: number;
  avgLength: number;
}

export function computeBatchStats(entries: BatchEntry[]): BatchStats {
  const out: BatchStats = {
    total: entries.length,
    withAlt: 0,
    emptyAlt: 0,
    decorative: 0,
    informative: 0,
    complex: 0,
    avgLength: 0,
  };
  let totalLen = 0;
  for (const e of entries) {
    if (e.alt.trim()) { out.withAlt += 1; totalLen += e.alt.trim().length; }
    else out.emptyAlt += 1;
    if (e.category === "decorative") out.decorative += 1;
    else if (e.category === "informative") out.informative += 1;
    else if (e.category === "complex") out.complex += 1;
  }
  out.avgLength = out.withAlt > 0 ? Math.round(totalLen / out.withAlt) : 0;
  return out;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  fileName: string;
  role: ImageRole;
  category: ImageCategory;
  altPreview: string;
  language: string;
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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  context: string;
  role: ImageRole;
  category: ImageCategory;
  language: string;
  keyword: string;
  alt: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.context) params.set("ctx", state.context);
  if (state.role) params.set("role", state.role);
  if (state.category) params.set("cat", state.category);
  if (state.language) params.set("lang", state.language);
  if (state.keyword) params.set("kw", state.keyword);
  if (state.alt) params.set("alt", state.alt);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  if (params.get("ctx")) out.context = params.get("ctx")!;
  const role = params.get("role") as ImageRole | null;
  if (role && role in ROLE_LABELS) out.role = role;
  const cat = params.get("cat") as ImageCategory | null;
  if (cat && cat in CATEGORY_LABELS) out.category = cat;
  if (params.get("lang")) out.language = params.get("lang")!;
  if (params.get("kw")) out.keyword = params.get("kw")!;
  if (params.get("alt")) out.alt = params.get("alt")!;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  context: string,
  role: ImageRole,
  category: ImageCategory,
  language: string,
  keyword?: string,
): string {
  const roleLabel = ROLE_LABELS[role];
  const catLabel = CATEGORY_LABELS[category];
  const kwLine = keyword ? `Weave the SEO keyword "${keyword}" in naturally (at most once).\n` : "";
  return [
    "You are an accessibility expert. Generate WCAG 2.1-compliant alt text for the attached image.",
    `Image role: ${roleLabel}.`,
    `Image category: ${catLabel}.`,
    `Context provided by user: ${context || "(none)"}.`,
    kwLine,
    "Rules:",
    `- Do NOT start with "image of", "picture of", or "photo of" — screen readers already announce "image".`,
    `- Keep it concise (under 125 characters) unless the image is complex.`,
    `- For decorative images, return an empty string.`,
    `- For complex images, return a longer description (up to 250 characters).`,
    `- Output language: ${language}.`,
    `- Output ONLY the alt text — no quotes, no explanation, no markdown.`,
  ].join("\n");
}

export function renderLlmResult(rawText: string): string {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:[a-z]+)?\s*/, "").replace(/\s*```$/, "");
  }
  // Strip surrounding quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

// ---------- Color utilities (for dominant-color summary) ----------

/** Convert a hex color to a friendly name. */
export function describeColor(hex: string): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "neutral";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / 2;
  // Saturation
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = lum > 127 ? d / (510 - max - min) : d / (max + min);
  }
  // Hue
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) * 60;
  else if (max === g) hue = ((b - r) / (max - min) + 2) * 60;
  else hue = ((r - g) / (max - min) + 4) * 60;
  if (hue < 0) hue += 360;
  if (sat < 0.1) {
    if (lum < 50) return "dark";
    if (lum > 200) return "light";
    return "gray";
  }
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 200) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 305) return "purple";
  if (hue < 345) return "pink";
  return "colorful";
}
