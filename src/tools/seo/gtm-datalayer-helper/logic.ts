/**
 * GTM & dataLayer Helper — pure logic.
 *
 * Generate Google Tag Manager dataLayer code snippets:
 *   - dataLayer.push code
 *   - Custom event trigger
 *   - GTM variable declarations
 *   - Event presets (page_view, scroll, click, form_submit, purchase)
 *
 * Pure functions only — no DOM, no network.
 */

export interface DataLayerEvent {
  name: string;
  params: Record<string, string | number | boolean | undefined>;
}

export interface EventPreset {
  name: string;
  description: string;
  recommendedParams: string[];
  example: DataLayerEvent;
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    name: "page_view",
    description: "Virtual pageview (SPA route change). GTM's built-in Page View trigger fires on this.",
    recommendedParams: ["page_location", "page_referrer", "page_title"],
    example: { name: "page_view", params: { page_location: "https://example.com/page", page_title: "Example Page" } },
  },
  {
    name: "scroll",
    description: "Custom scroll-depth event (e.g. 25%, 50%, 75%, 90%).",
    recommendedParams: ["percent_scrolled"],
    example: { name: "scroll", params: { percent_scrolled: 50 } },
  },
  {
    name: "click",
    description: "Custom click event for outbound links or in-page CTAs.",
    recommendedParams: ["link_id", "link_url", "link_domain", "link_classes"],
    example: { name: "click", params: { link_id: "cta-signup", link_url: "https://example.com/signup" } },
  },
  {
    name: "form_submit",
    description: "Form submission event. Pair with a form_id or form_name variable.",
    recommendedParams: ["form_id", "form_name", "form_destination"],
    example: { name: "form_submit", params: { form_id: "contact", form_name: "Contact Form" } },
  },
  {
    name: "purchase",
    description: "Ecommerce purchase event. Send with transaction_id, value, currency, items.",
    recommendedParams: ["transaction_id", "value", "currency", "items"],
    example: {
      name: "purchase",
      params: {
        transaction_id: "T-12345",
        value: 99.99,
        currency: "USD",
        items: '[{"item_id":"sku_1","item_name":"Widget","price":99.99,"quantity":1}]',
      },
    },
  },
];

export interface VariableDecl {
  type: "dataLayer" | "constant" | "customJavaScript" | "lookupTable";
  name: string;
  value: string;
  notes?: string;
}

/** Validate an event name. */
export function validateEventName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) return { valid: false, error: "Event name is required" };
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: "Event name must start with a letter and contain only letters, numbers, and underscores" };
  }
  if (name.length > 40) {
    return { valid: false, error: "Event name must be 40 characters or less" };
  }
  return { valid: true };
}

/** Validate a parameter name. */
export function validateParamName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) return { valid: false, error: "Parameter name is required" };
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: "Parameter name must start with a letter and contain only letters, numbers, and underscores" };
  }
  if (name.length > 40) {
    return { valid: false, error: "Parameter name must be 40 characters or less" };
  }
  return { valid: true };
}

/** Validate a complete event. */
export function validateEvent(event: DataLayerEvent): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nameCheck = validateEventName(event.name);
  if (!nameCheck.valid) errors.push(nameCheck.error!);
  let count = 0;
  for (const [k, v] of Object.entries(event.params)) {
    if (v === undefined || v === null || v === "") continue;
    count++;
    const pc = validateParamName(k);
    if (!pc.valid) errors.push(`Param "${k}": ${pc.error}`);
  }
  if (count > 25) warnings.push(`dataLayer events support up to 25 parameters. You have ${count}.`);
  return { valid: errors.length === 0, errors, warnings };
}

/** Format a parameter value as JavaScript literal. */
export function formatParamValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "undefined";
  if (typeof value === "string") {
    if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"))) {
      return value;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Generate dataLayer.push() code. */
export function generatePushCode(event: DataLayerEvent): string {
  const v = validateEvent(event);
  if (!v.valid) throw new Error(v.errors.join("; "));
  const params = Object.entries(event.params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (params.length === 0) {
    return `dataLayer.push({ event: '${event.name}' });`;
  }
  const paramsStr = params
    .map(([k, value]) => `  ${k}: ${formatParamValue(value)}`)
    .join(",\n");
  return `dataLayer.push({\n  event: '${event.name}',\n${paramsStr}\n});`;
}

/** Generate the dataLayer initialization snippet (place before GTM container). */
export function generateInitCode(): string {
  return `<script>
  window.dataLayer = window.dataLayer || [];
  (function(w,d,s,l,i){
    w[l]=w[l]||[];
    w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
    var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),
        dl=l!='dataLayer'?'&l='+l:'';
    j.async=true;
    j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
    f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-XXXXXXX');
</script>`;
}

/** Generate GTM custom event trigger documentation (JSON-formatted description). */
export function generateCustomEventTrigger(event: DataLayerEvent): string {
  const v = validateEvent(event);
  if (!v.valid) throw new Error(v.errors.join("; "));
  const trigger = {
    triggerName: `${event.name} Trigger`,
    type: "CUSTOM_EVENT",
    eventName: event.name,
    triggerCondition: `Event equals ${event.name}`,
    firingFilters: Object.keys(event.params)
      .filter((k) => event.params[k] !== undefined && event.params[k] !== null && event.params[k] !== "")
      .map((k) => ({
        variable: k,
        condition: "equals",
        value: String(event.params[k]),
      })),
    notes: "Create this trigger in GTM → Triggers → New → Custom Event. Set the event name to match exactly.",
  };
  return JSON.stringify(trigger, null, 2);
}

/** Generate GTM variable declarations (dataLayer variable references). */
export function generateVariableDeclarations(event: DataLayerEvent): string {
  const v = validateEvent(event);
  if (!v.valid) throw new Error(v.errors.join("; "));
  const decls: VariableDecl[] = [];
  for (const [k, value] of Object.entries(event.params)) {
    if (value === undefined || value === null || value === "") continue;
    decls.push({
      type: "dataLayer",
      name: k,
      value: k,
      notes: `Reads dataLayer variable "${k}". In GTM: Variables → New → Data Layer Variable → Data Layer Variable Name = ${k}`,
    });
  }
  if (decls.length === 0) return "// No parameters — no variables needed";
  return decls
    .map((d) => `// ${d.notes}\n// Variable type: ${d.type}\n// Variable name: ${d.name}\n// Data Layer Variable Name: ${d.value}`)
    .join("\n\n");
}

/** Generate the full HTML snippet combining init + push. */
export function generateFullSnippet(event: DataLayerEvent): string {
  const init = `<script>\n  window.dataLayer = window.dataLayer || [];\n</script>`;
  const push = generatePushCode(event);
  return `${init}\n\n<!-- Push event -->\n<script>\n${push}\n</script>`;
}

/** Find a preset by name. */
export function findPreset(name: string): EventPreset | undefined {
  return EVENT_PRESETS.find((p) => p.name === name);
}

/** Count non-empty params. */
export function countParams(event: DataLayerEvent): number {
  return Object.values(event.params).filter(
    (v) => v !== undefined && v !== null && v !== "",
  ).length;
}

/** Generate JSON preview of the event. */
export function generateJsonPreview(event: DataLayerEvent): string {
  const obj: Record<string, unknown> = { event: event.name };
  for (const [k, v] of Object.entries(event.params)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
      try { obj[k] = JSON.parse(v); } catch { obj[k] = v; }
    } else {
      obj[k] = v;
    }
  }
  return JSON.stringify(obj, null, 2);
}

export const GTM_DOCS_URL = "https://support.google.com/tagmanager/answer/6102821";
export const DATALAYER_DOCS_URL = "https://developers.google.com/tag-platform/tag-manager/datalayer";

// ---- History ----

const HISTORY_KEY = "unqtools:gtm-datalayer-helper:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  eventName: string;
  paramCount: number;
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

export interface ShareState {
  eventName: string;
  paramsJson: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("event", state.eventName);
  params.set("params", state.paramsJson);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const event = params.get("event");
  if (event !== null) out.eventName = event;
  const paramsJson = params.get("params");
  if (paramsJson !== null) out.paramsJson = paramsJson;
  return out;
}
