/**
 * AI Text-to-Image Prompt Builder — pure logic.
 *
 * Builds optimized prompts for three image-generation models from a
 * single free-text description:
 *   - DALL·E 3       → natural-language descriptive prompt
 *   - Stable Diffusion → weighted-comma keyword prompt + negative prompt
 *   - Midjourney     → keyword prompt + CLI parameters (--ar, --v, ...)
 *
 * Pure-JS, no DOM, no network. The optional BYO-key OpenAI image call
 * lives in ui.tsx because it touches the network.
 *
 * Includes:
 *   - Style presets (12), aspect ratios (6), lighting (6), mood (6)
 *   - Weighted-keyword tokenizer for Stable Diffusion
 *   - Midjourney parameter generator
 *   - Negative-prompt builder (6 presets + custom)
 *   - Token-count estimator
 *   - Prompt validator (length, key elements, safety hints)
 *   - Prompt-to-options heuristic parser
 *   - Per-model stats
 *   - Seed reproducibility (encoded in share URL)
 *   - History (localStorage, last 20) + shareable URL
 */

// ---------- Types ----------

export type ImageModel = "dall-e-3" | "stable-diffusion" | "midjourney";

export type StylePreset =
  | "photorealistic"
  | "anime"
  | "oil-painting"
  | "watercolor"
  | "3d-render"
  | "cyberpunk"
  | "fantasy"
  | "minimalist"
  | "pixel-art"
  | "line-art"
  | "isometric"
  | "low-poly";

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:2" | "21:9";

export type LightingPreset =
  | "none"
  | "golden-hour"
  | "neon"
  | "studio"
  | "soft"
  | "dramatic"
  | "natural";

export type MoodPreset =
  | "none"
  | "calm"
  | "epic"
  | "mysterious"
  | "joyful"
  | "dark"
  | "dreamy";

export type NegativePreset =
  | "none"
  | "people"
  | "text"
  | "blur"
  | "low-quality"
  | "extra-limbs"
  | "watermark";

export interface BuildOptions {
  description: string;
  style: StylePreset;
  aspectRatio: AspectRatio;
  lighting: LightingPreset;
  mood: MoodPreset;
  negativePresets: NegativePreset[];
  customNegative: string;
  seed: number | null;
  quality: "draft" | "standard" | "high";
  stylize: number;        // Midjourney --stylize (0-1000)
  version: number;        // Midjourney --v (5, 6, etc.)
  detail: number;         // 1-5 how much quality booster text to add
}

export interface ModelPrompt {
  model: ImageModel;
  prompt: string;
  negativePrompt?: string;
  parameters?: string;
  tokens: number;
  characters: number;
  notes: string[];
}

export interface BuildResult {
  options: BuildOptions;
  prompts: ModelPrompt[];
  stats: {
    totalTokens: number;
    byModel: Record<ImageModel, number>;
  };
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  description: string;
  style: StylePreset;
  aspectRatio: AspectRatio;
  seed: number | null;
}

export interface ShareState {
  description: string;
  style: StylePreset;
  aspectRatio: AspectRatio;
  lighting: LightingPreset;
  mood: MoodPreset;
  seed: number | null;
  quality: "draft" | "standard" | "high";
  stylize: number;
  version: number;
  detail: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-text-to-image-generator:history";
export const HISTORY_MAX = 20;

export const STYLE_PRESETS: Record<StylePreset, { label: string; sdKeywords: string; mjKeywords: string; dalleHint: string }> = {
  "photorealistic": {
    label: "Photorealistic",
    sdKeywords: "photorealistic, ultra-detailed, 8k, sharp focus, professional photography, dslr, high resolution",
    mjKeywords: "photorealistic, ultra-detailed, 8k",
    dalleHint: "a hyper-realistic photograph",
  },
  "anime": {
    label: "Anime",
    sdKeywords: "anime style, studio ghibli, cel shading, vibrant colors, detailed anime eyes",
    mjKeywords: "anime style, studio ghibli",
    dalleHint: "an anime-style illustration",
  },
  "oil-painting": {
    label: "Oil painting",
    sdKeywords: "oil painting, thick brush strokes, canvas texture, classical art, baroque lighting",
    mjKeywords: "oil painting, baroque",
    dalleHint: "an oil painting",
  },
  "watercolor": {
    label: "Watercolor",
    sdKeywords: "watercolor, soft washes, paper texture, pastel colors, wet on wet technique",
    mjKeywords: "watercolor, pastel",
    dalleHint: "a watercolor painting",
  },
  "3d-render": {
    label: "3D render",
    sdKeywords: "3d render, octane render, cinema4d, blender, subsurface scattering, ray tracing",
    mjKeywords: "3d render, octane",
    dalleHint: "a 3D render",
  },
  "cyberpunk": {
    label: "Cyberpunk",
    sdKeywords: "cyberpunk, neon lights, futuristic, blade runner aesthetic, rain-soaked streets, holographic",
    mjKeywords: "cyberpunk, neon",
    dalleHint: "a cyberpunk scene",
  },
  "fantasy": {
    label: "Fantasy",
    sdKeywords: "fantasy art, magical, ethereal, dramatic, epic composition, digital painting",
    mjKeywords: "fantasy art, epic",
    dalleHint: "a fantasy illustration",
  },
  "minimalist": {
    label: "Minimalist",
    sdKeywords: "minimalist, clean lines, simple shapes, negative space, flat design",
    mjKeywords: "minimalist, clean",
    dalleHint: "a minimalist illustration",
  },
  "pixel-art": {
    label: "Pixel art",
    sdKeywords: "pixel art, 16-bit, retro game, sprite, limited palette, dithering",
    mjKeywords: "pixel art, 16-bit",
    dalleHint: "a pixel-art sprite",
  },
  "line-art": {
    label: "Line art",
    sdKeywords: "line art, ink drawing, monochrome, cross-hatching, clean outlines",
    mjKeywords: "line art, ink",
    dalleHint: "a line-art drawing",
  },
  "isometric": {
    label: "Isometric",
    sdKeywords: "isometric, isometric projection, clean vector, flat colors, 45-degree angle",
    mjKeywords: "isometric, vector",
    dalleHint: "an isometric illustration",
  },
  "low-poly": {
    label: "Low-poly",
    sdKeywords: "low poly, geometric, triangulated mesh, flat shading, minimal polygons",
    mjKeywords: "low poly, geometric",
    dalleHint: "a low-poly 3D model",
  },
};

export const ASPECT_RATIOS: Record<AspectRatio, { label: string; mj: string; dalleSize: string; sd: string }> = {
  "1:1":  { label: "1:1 (square)",   mj: "1:1",  dalleSize: "1024x1024", sd: "512x512" },
  "16:9": { label: "16:9 (wide)",    mj: "16:9", dalleSize: "1792x1024", sd: "912x512" },
  "9:16": { label: "9:16 (tall)",    mj: "9:16", dalleSize: "1024x1792", sd: "512x912" },
  "4:3":  { label: "4:3 (classic)",  mj: "4:3",  dalleSize: "1024x1024", sd: "640x480" },
  "3:2":  { label: "3:2 (photo)",    mj: "3:2",  dalleSize: "1024x1024", sd: "768x512" },
  "21:9": { label: "21:9 (cinema)",  mj: "21:9", dalleSize: "1792x1024", sd: "1344x576" },
};

export const LIGHTING_PRESETS: Record<LightingPreset, { label: string; keywords: string }> = {
  "none":         { label: "None",         keywords: "" },
  "golden-hour":  { label: "Golden hour",  keywords: "golden hour lighting, warm sunlight, long shadows" },
  "neon":         { label: "Neon",         keywords: "neon lighting, glowing signs, magenta and cyan glow" },
  "studio":       { label: "Studio",       keywords: "studio lighting, softbox, three-point lighting" },
  "soft":         { label: "Soft",         keywords: "soft diffused lighting, even exposure" },
  "dramatic":     { label: "Dramatic",     keywords: "dramatic lighting, high contrast, chiaroscuro" },
  "natural":      { label: "Natural",      keywords: "natural daylight, soft window light" },
};

export const MOOD_PRESETS: Record<MoodPreset, { label: string; keywords: string }> = {
  "none":        { label: "None",       keywords: "" },
  "calm":        { label: "Calm",       keywords: "calm, peaceful, serene" },
  "epic":        { label: "Epic",       keywords: "epic, grand, majestic" },
  "mysterious":  { label: "Mysterious", keywords: "mysterious, enigmatic, moody" },
  "joyful":      { label: "Joyful",     keywords: "joyful, vibrant, lively" },
  "dark":        { label: "Dark",       keywords: "dark, ominous, brooding" },
  "dreamy":      { label: "Dreamy",     keywords: "dreamy, ethereal, surreal" },
};

export const NEGATIVE_PRESETS: Record<NegativePreset, { label: string; keywords: string }> = {
  "none":          { label: "None",            keywords: "" },
  "people":        { label: "No people",       keywords: "people, faces, humans, characters, portrait" },
  "text":          { label: "No text",         keywords: "text, watermark, signature, logo, caption" },
  "blur":          { label: "No blur",         keywords: "blurry, out of focus, motion blur, depth of field" },
  "low-quality":   { label: "No low quality",  keywords: "low quality, jpeg artifacts, pixelated, blurry, noisy" },
  "extra-limbs":   { label: "No extra limbs",  keywords: "extra limbs, deformed hands, mutated, bad anatomy, missing fingers" },
  "watermark":     { label: "No watermark",    keywords: "watermark, signature, logo, brand" },
};

export const QUALITY_BOOSTERS: string[] = [
  "highly detailed",
  "intricate",
  "sharp focus",
  "professional",
  "masterpiece",
  "trending on artstation",
];

export const DEFAULT_OPTIONS: BuildOptions = {
  description: "",
  style: "photorealistic",
  aspectRatio: "16:9",
  lighting: "none",
  mood: "none",
  negativePresets: ["low-quality"],
  customNegative: "",
  seed: null,
  quality: "standard",
  stylize: 250,
  version: 6,
  detail: 3,
};

export const SAMPLE_PROMPTS: { label: string; text: string }[] = [
  { label: "Mountain landscape", text: "A serene mountain lake at dawn with mist rising from the water, snow-capped peaks in the background, a small wooden dock extending into the water" },
  { label: "City skyline",       text: "A futuristic city skyline at night with flying cars, towering skyscrapers with holographic advertisements, rain-soaked streets reflecting neon lights" },
  { label: "Portrait of a fox",  text: "A close-up portrait of a red fox sitting in autumn leaves, looking directly at the camera, golden fur with detailed texture" },
  { label: "Fantasy castle",     text: "A floating castle above the clouds with cascading waterfalls, ancient stone architecture, dragons circling in the distance" },
];

// ---------- String helpers ----------

export function normalizeDescription(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function clampDetail(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 3;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

export function clampStylize(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 250;
  return Math.max(0, Math.min(1000, Math.floor(n)));
}

// ---------- Token estimation ----------

/** Rough token estimate for diffusion prompts (≈ 1 token per 0.75 word). */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const words = text.split(/[\s,]+/).filter(Boolean);
  return Math.ceil(words.length * 0.75);
}

// ---------- Weighted-keyword tokenizer (SD) ----------

/** Tokenize a description into weighted keyword chunks for SD. */
export function tokenizeForDiffusion(description: string, weight = 1): string {
  const d = normalizeDescription(description);
  if (!d) return "";
  // Split on commas and "and"
  const chunks = d
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (weight === 1) return chunks.join(", ");
  return chunks.map((c) => `(${c}:${weight.toFixed(1)})`).join(", ");
}

/** Extract subject-like keywords (capitalized words and nouns of length > 4). */
export function extractKeywords(description: string): string[] {
  const d = normalizeDescription(description);
  if (!d) return [];
  const stop = new Set(["the", "a", "an", "and", "or", "with", "of", "in", "on", "at", "to", "for", "by", "is", "are", "was", "were"]);
  const words = d.split(/[\s,.;:!?]+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (stop.has(lower)) continue;
    if (w.length < 3) continue;
    out.push(lower);
  }
  // Deduplicate preserving order
  return Array.from(new Set(out));
}

// ---------- Negative prompt ----------

export function buildNegativePrompt(
  presets: NegativePreset[],
  custom: string,
): string {
  const parts: string[] = [];
  for (const p of presets) {
    if (p === "none") continue;
    const kws = NEGATIVE_PRESETS[p].keywords;
    if (kws) parts.push(...kws.split(",").map((s) => s.trim()));
  }
  if (custom) {
    parts.push(...custom.split(/[,\n]/).map((s) => s.trim()).filter(Boolean));
  }
  // Deduplicate preserving order
  return Array.from(new Set(parts)).join(", ");
}

// ---------- DALL·E 3 prompt ----------

export function buildDallEPrompt(opts: BuildOptions): ModelPrompt {
  const desc = normalizeDescription(opts.description);
  const notes: string[] = [];
  if (!desc) {
    return {
      model: "dall-e-3",
      prompt: "",
      tokens: 0,
      characters: 0,
      notes: ["Empty description"],
    };
  }
  const stylePreset = STYLE_PRESETS[opts.style];
  const lighting = LIGHTING_PRESETS[opts.lighting];
  const mood = MOOD_PRESETS[opts.mood];
  const parts: string[] = [];
  // DALL·E 3 prefers natural language
  parts.push(`${stylePreset.dalleHint} of ${desc}`);
  if (lighting.keywords) {
    parts.push(`with ${lighting.keywords}`);
  }
  if (mood.keywords) {
    parts.push(`evoking a ${mood.keywords.split(",")[0]} mood`);
  }
  if (opts.detail >= 4) {
    parts.push(QUALITY_BOOSTERS.slice(0, opts.detail - 2).join(", "));
  }
  const prompt = parts.join(", ").replace(/, with/g, ", with");
  const tokens = estimateTokenCount(prompt);
  if (prompt.length > 4000) {
    notes.push("Prompt exceeds 4000 chars — DALL·E 3 may truncate.");
  }
  if (opts.seed !== null) {
    notes.push(`Reproducible with seed ${opts.seed} via the API call (DALL·E 3 does not expose seed in the chat API).`);
  }
  notes.push(`Size: ${ASPECT_RATIOS[opts.aspectRatio].dalleSize}`);
  return {
    model: "dall-e-3",
    prompt,
    tokens,
    characters: prompt.length,
    notes,
  };
}

// ---------- Stable Diffusion prompt ----------

export function buildStableDiffusionPrompt(opts: BuildOptions): ModelPrompt {
  const desc = normalizeDescription(opts.description);
  if (!desc) {
    return {
      model: "stable-diffusion",
      prompt: "",
      negativePrompt: "",
      tokens: 0,
      characters: 0,
      notes: ["Empty description"],
    };
  }
  const stylePreset = STYLE_PRESETS[opts.style];
  const lighting = LIGHTING_PRESETS[opts.lighting];
  const mood = MOOD_PRESETS[opts.mood];
  const chunks: string[] = [];
  // Subject first (weighted higher)
  chunks.push(tokenizeForDiffusion(desc, 1.2));
  chunks.push(stylePreset.sdKeywords);
  if (lighting.keywords) chunks.push(lighting.keywords);
  if (mood.keywords) chunks.push(mood.keywords);
  if (opts.detail >= 3) {
    chunks.push(QUALITY_BOOSTERS.slice(0, opts.detail - 1).join(", "));
  }
  if (opts.seed !== null) {
    chunks.push(`seed:${opts.seed}`);
  }
  const prompt = chunks.filter(Boolean).join(", ");
  const negative = buildNegativePrompt(opts.negativePresets, opts.customNegative);
  const tokens = estimateTokenCount(prompt);
  const notes: string[] = [
    `Negative prompt: ${negative.length} chars`,
    `Resolution: ${ASPECT_RATIOS[opts.aspectRatio].sd}`,
  ];
  if (tokens > 75) notes.push("Token count exceeds 75 — SD will chunk into multiple sub-prompts.");
  return {
    model: "stable-diffusion",
    prompt,
    negativePrompt: negative,
    tokens,
    characters: prompt.length,
    notes,
  };
}

// ---------- Midjourney prompt ----------

export function buildMidjourneyPrompt(opts: BuildOptions): ModelPrompt {
  const desc = normalizeDescription(opts.description);
  if (!desc) {
    return {
      model: "midjourney",
      prompt: "",
      parameters: "",
      tokens: 0,
      characters: 0,
      notes: ["Empty description"],
    };
  }
  const stylePreset = STYLE_PRESETS[opts.style];
  const lighting = LIGHTING_PRESETS[opts.lighting];
  const mood = MOOD_PRESETS[opts.mood];
  const chunks: string[] = [desc];
  chunks.push(stylePreset.mjKeywords);
  if (lighting.keywords) chunks.push(lighting.keywords.split(",")[0]);
  if (mood.keywords) chunks.push(mood.keywords.split(",")[0]);
  if (opts.detail >= 3) {
    chunks.push(QUALITY_BOOSTERS.slice(0, opts.detail - 2).join(", "));
  }
  const promptText = chunks.filter(Boolean).join(", ");
  // Parameters
  const params: string[] = [];
  params.push(`--ar ${ASPECT_RATIOS[opts.aspectRatio].mj}`);
  params.push(`--v ${opts.version}`);
  if (opts.stylize !== 100) params.push(`--stylize ${clampStylize(opts.stylize)}`);
  if (opts.seed !== null) params.push(`--seed ${opts.seed}`);
  if (opts.quality === "draft") params.push("--fast");
  if (opts.quality === "high") params.push("--quality 2");
  const parameters = params.join(" ");
  const prompt = `${promptText} ${parameters}`.trim();
  const tokens = estimateTokenCount(prompt);
  const notes: string[] = [`Parameters: ${parameters}`];
  return {
    model: "midjourney",
    prompt,
    parameters,
    tokens,
    characters: prompt.length,
    notes,
  };
}

// ---------- Validator ----------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePrompt(opts: BuildOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const desc = normalizeDescription(opts.description);
  if (!desc) {
    errors.push("Description is empty.");
  } else {
    if (desc.length < 10) warnings.push("Description is very short — add more detail for better results.");
    if (desc.length > 1000) warnings.push("Description is very long — consider trimming to focus on key subjects.");
    const wordCount = desc.split(/\s+/).length;
    if (wordCount < 5) warnings.push("Description has fewer than 5 words — results may be generic.");
  }
  if (opts.stylize < 0 || opts.stylize > 1000) {
    errors.push("Stylize must be 0-1000.");
  }
  if (opts.version < 1 || opts.version > 10) {
    warnings.push("Midjourney version should typically be 4, 5, or 6.");
  }
  if (opts.detail < 1 || opts.detail > 5) {
    errors.push("Detail must be 1-5.");
  }
  // Safety hints
  const lower = desc.toLowerCase();
  const safety = ["nude", "nsfw", "gore", "violence", "weapon"];
  for (const s of safety) {
    if (lower.includes(s)) warnings.push(`Description contains "${s}" — most APIs will refuse to generate this.`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------- Main builder ----------

export function generateAllPrompts(opts: BuildOptions): BuildResult {
  const validation = validatePrompt(opts);
  const prompts: ModelPrompt[] = [
    buildDallEPrompt(opts),
    buildStableDiffusionPrompt(opts),
    buildMidjourneyPrompt(opts),
  ];
  const byModel: Record<ImageModel, number> = {
    "dall-e-3": prompts[0].tokens,
    "stable-diffusion": prompts[1].tokens,
    "midjourney": prompts[2].tokens,
  };
  return {
    options: opts,
    prompts,
    stats: {
      totalTokens: prompts.reduce((sum, p) => sum + p.tokens, 0),
      byModel,
    },
    warnings: validation.warnings,
  };
}

// ---------- Prompt-to-options heuristic parser ----------

export function parsePromptToOptions(text: string): Partial<BuildOptions> {
  const t = (text || "").toLowerCase();
  const out: Partial<BuildOptions> = {};
  // Style
  if (/\b(anime|ghibli|cel[ -]?shad)\b/.test(t)) out.style = "anime";
  else if (/\b(oil painting|baroque|classical)\b/.test(t)) out.style = "oil-painting";
  else if (/\b(watercolor|watercolour)\b/.test(t)) out.style = "watercolor";
  else if (/\b(3d render|octane|blender|cinema4d)\b/.test(t)) out.style = "3d-render";
  else if (/\b(cyberpunk|neon)\b/.test(t)) out.style = "cyberpunk";
  else if (/\b(fantasy|magical|epic)\b/.test(t)) out.style = "fantasy";
  else if (/\b(minimalist|minimal)\b/.test(t)) out.style = "minimalist";
  else if (/\b(pixel art|16-?bit|8-?bit)\b/.test(t)) out.style = "pixel-art";
  else if (/\b(line art|ink drawing)\b/.test(t)) out.style = "line-art";
  else if (/\b(isometric)\b/.test(t)) out.style = "isometric";
  else if (/\b(low poly|low-poly)\b/.test(t)) out.style = "low-poly";
  else if (/\b(photorealistic|photo|realistic|photograph)\b/.test(t)) out.style = "photorealistic";
  // Aspect ratio
  if (/\b16:9|wide|cinematic|landscape\b/.test(t)) out.aspectRatio = "16:9";
  else if (/\b9:16|portrait|tall\b/.test(t)) out.aspectRatio = "9:16";
  else if (/\b1:1|square\b/.test(t)) out.aspectRatio = "1:1";
  else if (/\b21:9|ultra[ -]?wide\b/.test(t)) out.aspectRatio = "21:9";
  // Lighting
  if (/\bgolden hour|sunset\b/.test(t)) out.lighting = "golden-hour";
  else if (/\bneon\b/.test(t)) out.lighting = "neon";
  else if (/\bstudio\b/.test(t)) out.lighting = "studio";
  else if (/\bsoft light|diffused\b/.test(t)) out.lighting = "soft";
  else if (/\bdramatic|chiaroscuro\b/.test(t)) out.lighting = "dramatic";
  // Mood
  if (/\bcalm|peaceful\b/.test(t)) out.mood = "calm";
  else if (/\bepic|grand\b/.test(t)) out.mood = "epic";
  else if (/\bmysterious|enigmatic\b/.test(t)) out.mood = "mysterious";
  else if (/\bjoyful|happy|vibrant\b/.test(t)) out.mood = "joyful";
  else if (/\bdark|ominous\b/.test(t)) out.mood = "dark";
  else if (/\bdreamy|ethereal\b/.test(t)) out.mood = "dreamy";
  return out;
}

// ---------- Rendering ----------

export function renderText(result: BuildResult): string {
  const lines: string[] = [];
  for (const p of result.prompts) {
    lines.push(`=== ${p.model.toUpperCase()} ===`);
    lines.push(`Prompt: ${p.prompt}`);
    if (p.negativePrompt) lines.push(`Negative: ${p.negativePrompt}`);
    if (p.parameters) lines.push(`Parameters: ${p.parameters}`);
    lines.push(`Tokens: ${p.tokens} | Characters: ${p.characters}`);
    if (p.notes.length > 0) {
      lines.push(`Notes:`);
      for (const n of p.notes) lines.push(`  - ${n}`);
    }
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("=== WARNINGS ===");
    for (const w of result.warnings) lines.push(`  - ${w}`);
  }
  return lines.join("\n");
}

export function renderJson(result: BuildResult): string {
  return JSON.stringify({
    options: result.options,
    prompts: result.prompts,
    stats: result.stats,
    warnings: result.warnings,
  }, null, 2);
}

// ---------- History ----------

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
  if (state.description) params.set("d", state.description);
  if (state.style) params.set("style", state.style);
  if (state.aspectRatio) params.set("ar", state.aspectRatio);
  if (state.lighting) params.set("light", state.lighting);
  if (state.mood) params.set("mood", state.mood);
  if (state.seed !== null) params.set("seed", String(state.seed));
  if (state.quality) params.set("q", state.quality);
  if (state.stylize !== undefined) params.set("stylize", String(state.stylize));
  if (state.version !== undefined) params.set("v", String(state.version));
  if (state.detail !== undefined) params.set("detail", String(state.detail));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const validStyles: StylePreset[] = Object.keys(STYLE_PRESETS) as StylePreset[];
  const validArs: AspectRatio[] = Object.keys(ASPECT_RATIOS) as AspectRatio[];
  const validLight: LightingPreset[] = Object.keys(LIGHTING_PRESETS) as LightingPreset[];
  const validMood: MoodPreset[] = Object.keys(MOOD_PRESETS) as MoodPreset[];
  const validQ: ("draft" | "standard" | "high")[] = ["draft", "standard", "high"];
  const out: Partial<ShareState> = {};
  const d = params.get("d");
  if (d) out.description = d;
  const style = params.get("style") as StylePreset | null;
  if (style && validStyles.includes(style)) out.style = style;
  const ar = params.get("ar") as AspectRatio | null;
  if (ar && validArs.includes(ar)) out.aspectRatio = ar;
  const light = params.get("light") as LightingPreset | null;
  if (light && validLight.includes(light)) out.lighting = light;
  const mood = params.get("mood") as MoodPreset | null;
  if (mood && validMood.includes(mood)) out.mood = mood;
  const seedStr = params.get("seed");
  if (seedStr) {
    const n = parseInt(seedStr, 10);
    if (!isNaN(n)) out.seed = n;
  }
  const q = params.get("q") as "draft" | "standard" | "high" | null;
  if (q && validQ.includes(q)) out.quality = q;
  const st = params.get("stylize");
  if (st) {
    const n = parseInt(st, 10);
    if (!isNaN(n)) out.stylize = n;
  }
  const v = params.get("v");
  if (v) {
    const n = parseInt(v, 10);
    if (!isNaN(n)) out.version = n;
  }
  const dt = params.get("detail");
  if (dt) {
    const n = parseInt(dt, 10);
    if (!isNaN(n)) out.detail = clampDetail(n);
  }
  return out;
}

// ---------- BYO-key OpenAI image request ----------

export interface DallEImageRequest {
  model: string;
  prompt: string;
  n: number;
  size: string;
  quality: string;
}

export function buildDallEImageRequest(opts: BuildOptions): DallEImageRequest {
  const dalle = buildDallEPrompt(opts);
  return {
    model: "dall-e-3",
    prompt: dalle.prompt,
    n: 1,
    size: ASPECT_RATIOS[opts.aspectRatio].dalleSize,
    quality: opts.quality === "high" ? "hd" : "standard",
  };
}

export function extractImageUrlFromResponse(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as Record<string, unknown>;
  const data = r.data as Array<{ url?: string; b64_json?: string }> | undefined;
  if (!Array.isArray(data) || data.length === 0) return "";
  if (data[0].url) return data[0].url;
  if (data[0].b64_json) return `data:image/png;base64,${data[0].b64_json}`;
  return "";
}
