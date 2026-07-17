/**
 * How-To Schema Generator — pure logic.
 *
 * Generate HowTo JSON-LD for step-by-step guides.
 * Pure functions only — no DOM, no network.
 */

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

export interface HowToInput {
  name: string;
  description?: string;
  totalTimeMinutes?: number;
  estimatedCost?: string;
  supplies?: string[];
  tools?: string[];
  steps: HowToStep[];
}

export const STEP_NAME_MAX = 100;
export const STEP_TEXT_MAX = 1000;
export const MIN_STEPS = 2;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Convert minutes to ISO 8601 duration: PT30M, PT1H30M, etc. */
export function minutesToIsoDuration(minutes: number): string {
  if (!minutes || minutes <= 0 || isNaN(minutes)) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `PT${h}H${m}M`;
  if (h > 0) return `PT${h}H`;
  return `PT${m}M`;
}

/** Parse ISO 8601 duration back to minutes. */
export function isoDurationToMinutes(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 60 + m + Math.round(s / 60);
}

/** Calculate total time from step durations (if provided as "PT15M" inside text metadata). */
export function calculateTotalTime(steps: HowToStep[]): number {
  let total = 0;
  for (const step of steps) {
    const match = (step.text || "").match(/\[time:PT(\d+)M\]/i);
    if (match) {
      total += parseInt(match[1], 10);
    }
  }
  return total;
}

/** Validate a single HowTo step. */
export function validateStep(step: HowToStep, index: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!step.name || !step.name.trim()) {
    errors.push(`Step #${index + 1}: name is empty`);
  } else if (step.name.length > STEP_NAME_MAX) {
    warnings.push(`Step #${index + 1}: name is long (${step.name.length} chars)`);
  }
  if (!step.text || !step.text.trim()) {
    errors.push(`Step #${index + 1}: text is empty`);
  } else if (step.text.length > STEP_TEXT_MAX) {
    warnings.push(`Step #${index + 1}: text is long (${step.text.length} chars)`);
  }
  if (step.image && !isValidUrl(step.image.trim())) {
    warnings.push(`Step #${index + 1}: image URL is invalid`);
  }
  return { errors, warnings };
}

export function validateInput(input: HowToInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.name || !input.name.trim()) {
    errors.push("How-to title is required");
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.push("At least one step is required");
  } else {
    if (input.steps.length < MIN_STEPS) {
      warnings.push(`Fewer than ${MIN_STEPS} steps — usually more are needed for a useful how-to`);
    }
    for (let i = 0; i < input.steps.length; i++) {
      const r = validateStep(input.steps[i], i);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
  }
  if (input.totalTimeMinutes !== undefined && input.totalTimeMinutes < 0) {
    errors.push("Total time cannot be negative");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Parse a bulk paste of steps, one per line: "Name | Text" or "Name: Text" or just "Step text". */
export function parseBulkSteps(text: string): HowToStep[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const steps: HowToStep[] = [];
  for (const line of lines) {
    // Try "Name | Text"
    if (line.includes("|")) {
      const [name, ...rest] = line.split("|").map((s) => s.trim());
      if (name) steps.push({ name, text: rest.join(" | ").trim() });
      continue;
    }
    // Try "Name: Text"
    const colonMatch = line.match(/^([^:]{2,80}):\s+(.+)$/);
    if (colonMatch) {
      steps.push({ name: colonMatch[1].trim(), text: colonMatch[2].trim() });
      continue;
    }
    // Use first ~50 chars as name
    const name = line.length > 50 ? line.slice(0, 50) + "…" : line;
    steps.push({ name, text: line });
  }
  return steps;
}

/** Parse a comma- or newline-separated list of supplies/tools. */
export function parseList(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build the HowTo JSON-LD object. */
export function buildJsonLd(input: HowToInput): Record<string, unknown> {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name.trim(),
  };
  if (input.description && input.description.trim()) {
    obj.description = input.description.trim();
  }
  if (input.totalTimeMinutes && input.totalTimeMinutes > 0) {
    obj.totalTime = minutesToIsoDuration(input.totalTimeMinutes);
  }
  if (input.estimatedCost && input.estimatedCost.trim()) {
    // Try to parse "$10" or "10 USD"
    const costMatch = input.estimatedCost.match(/(\d+(?:\.\d+)?)/);
    const currencyMatch = input.estimatedCost.match(/([A-Z]{3})/);
    if (costMatch) {
      obj.estimatedCost = {
        "@type": "MonetaryAmount",
        currency: currencyMatch ? currencyMatch[1] : "USD",
        value: parseFloat(costMatch[1]),
      };
    } else {
      obj.estimatedCost = input.estimatedCost.trim();
    }
  }
  if (input.supplies && input.supplies.length > 0) {
    obj.supply = input.supplies.map((s) => ({ "@type": "HowToSupply", name: s }));
  }
  if (input.tools && input.tools.length > 0) {
    obj.tool = input.tools.map((t) => ({ "@type": "HowToTool", name: t }));
  }
  obj.step = input.steps.map((step, i) => {
    const s: Record<string, unknown> = {
      "@type": "HowToStep",
      position: i + 1,
      name: step.name.trim(),
      text: step.text.trim(),
    };
    if (step.image && isValidUrl(step.image.trim())) {
      s.image = step.image.trim();
    }
    return s;
  });
  return obj;
}

export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

export function generateHowToSchema(input: HowToInput): string {
  return buildScriptTag(buildJsonLd(input));
}

export function buildGoogleRichResultsLink(url: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url || "https://example.com")}`;
}

export function buildSchemaDocsLink(): string {
  return "https://schema.org/HowTo";
}

/** Reorder steps — pure array operations. */
export function moveStep(steps: HowToStep[], from: number, to: number): HowToStep[] {
  if (from < 0 || from >= steps.length) return steps;
  if (to < 0 || to >= steps.length) return steps;
  if (from === to) return steps;
  const next = steps.slice();
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  return next;
}

export function moveStepUp(steps: HowToStep[], index: number): HowToStep[] {
  return moveStep(steps, index, index - 1);
}

export function moveStepDown(steps: HowToStep[], index: number): HowToStep[] {
  return moveStep(steps, index, index + 1);
}

// ---- History ----

const HISTORY_KEY = "unqtools:how-to-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  stepCount: number;
  snippet: string;
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

export function buildShareUrl(input: HowToInput): string {
  const params = new URLSearchParams();
  params.set("name", input.name);
  if (input.description) params.set("description", input.description);
  if (input.totalTimeMinutes) params.set("totalTime", String(input.totalTimeMinutes));
  if (input.estimatedCost) params.set("cost", input.estimatedCost);
  if (input.supplies && input.supplies.length) params.set("supplies", input.supplies.join(","));
  if (input.tools && input.tools.length) params.set("tools", input.tools.join(","));
  params.set("steps", JSON.stringify(input.steps));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<HowToInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<HowToInput> = {};
  const name = params.get("name");
  if (name) out.name = name;
  const description = params.get("description");
  if (description) out.description = description;
  const tt = params.get("totalTime");
  if (tt) {
    const n = parseInt(tt, 10);
    if (!isNaN(n)) out.totalTimeMinutes = n;
  }
  const cost = params.get("cost");
  if (cost) out.estimatedCost = cost;
  const supplies = params.get("supplies");
  if (supplies) out.supplies = supplies.split(",").map((s) => s.trim()).filter(Boolean);
  const tools = params.get("tools");
  if (tools) out.tools = tools.split(",").map((s) => s.trim()).filter(Boolean);
  const steps = params.get("steps");
  if (steps) {
    try {
      const parsed = JSON.parse(steps);
      if (Array.isArray(parsed)) out.steps = parsed as HowToStep[];
    } catch {
      // ignore
    }
  }
  return out;
}
