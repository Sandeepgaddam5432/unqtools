/**
 * GA4 Event Builder — pure logic.
 *
 * Generate Google Analytics 4 event tracking code: gtag.js event call,
 * GTM dataLayer push, and Measurement Protocol payload.
 *
 * Pure functions only — no DOM, no network.
 */

export interface Ga4Event {
  name: string;
  params: Record<string, string | number | boolean | undefined>;
}

export interface EventPreset {
  name: string;
  description: string;
  recommendedParams: string[];
  example: Ga4Event;
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    name: "page_view",
    description: "Sent automatically by gtag.js. Manually send for virtual pageviews (SPA route changes).",
    recommendedParams: ["page_location", "page_referrer", "page_title"],
    example: { name: "page_view", params: { page_location: "https://example.com/page", page_title: "Example Page" } },
  },
  {
    name: "scroll",
    description: "Sent automatically when 90% of page is scrolled. Manually send for custom thresholds.",
    recommendedParams: ["percent_scrolled"],
    example: { name: "scroll", params: { percent_scrolled: 50 } },
  },
  {
    name: "click",
    description: "Sent automatically on outbound clicks. Use custom events for in-page interactions.",
    recommendedParams: ["link_id", "link_url", "link_domain"],
    example: { name: "click", params: { link_id: "cta-signup", link_url: "https://example.com/signup" } },
  },
  {
    name: "form_start",
    description: "First interaction with a form (focus on first field).",
    recommendedParams: ["form_id", "form_name", "form_destination"],
    example: { name: "form_start", params: { form_id: "contact", form_name: "Contact Form" } },
  },
  {
    name: "form_submit",
    description: "Form submission.",
    recommendedParams: ["form_id", "form_name", "form_destination"],
    example: { name: "form_submit", params: { form_id: "contact", form_name: "Contact Form" } },
  },
  {
    name: "purchase",
    description: "Ecommerce purchase. Send with transaction_id and value at minimum.",
    recommendedParams: ["transaction_id", "value", "currency", "items"],
    example: {
      name: "purchase",
      params: {
        transaction_id: "T-12345",
        value: 99.99,
        currency: "USD",
        items: "[{\"item_id\":\"sku_1\",\"item_name\":\"Widget\",\"price\":99.99,\"quantity\":1}]",
      },
    },
  },
];

/** Validate event name. GA4 event names: letters, numbers, underscores, max 40 chars. */
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

/** Validate a parameter name. Letters, numbers, underscores, max 40 chars. */
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
export function validateEvent(event: Ga4Event): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nameCheck = validateEventName(event.name);
  if (!nameCheck.valid) errors.push(nameCheck.error!);

  let paramCount = 0;
  for (const [key, value] of Object.entries(event.params)) {
    if (value === undefined || value === null || value === "") continue;
    paramCount++;
    const paramCheck = validateParamName(key);
    if (!paramCheck.valid) errors.push(`Param "${key}": ${paramCheck.error}`);
  }
  if (paramCount > 25) {
    warnings.push(`GA4 events support up to 25 parameters. You have ${paramCount}.`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Format a parameter value as JavaScript literal. */
export function formatParamValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "undefined";
  if (typeof value === "string") {
    // If string looks like JSON, keep as-is
    if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"))) {
      return value;
    }
    // If string is a number, treat as string literal
    return JSON.stringify(value);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Generate gtag.js event code. */
export function generateGtagCode(event: Ga4Event): string {
  const v = validateEvent(event);
  if (!v.valid) throw new Error(v.errors.join("; "));
  const params = Object.entries(event.params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (params.length === 0) {
    return `gtag('event', '${event.name}');`;
  }
  const paramsStr = params
    .map(([k, value]) => `  ${k}: ${formatParamValue(value)}`)
    .join(",\n");
  return `gtag('event', '${event.name}', {\n${paramsStr}\n});`;
}

/** Generate GTM dataLayer push code. */
export function generateDataLayerCode(event: Ga4Event): string {
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

/** Generate GA4 Measurement Protocol payload (JSON). */
export function generateMeasurementProtocolPayload(
  event: Ga4Event,
  options: { clientId: string; apiSecret: string; timestampMicros?: number },
): string {
  const v = validateEvent(event);
  if (!v.valid) throw new Error(v.errors.join("; "));
  const params: Record<string, unknown> = {};
  for (const [k, value] of Object.entries(event.params)) {
    if (value === undefined || value === null || value === "") continue;
    // Try to parse JSON-looking strings
    if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
      try {
        params[k] = JSON.parse(value);
      } catch {
        params[k] = value;
      }
    } else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
      params[k] = Number(value);
    } else {
      params[k] = value;
    }
  }
  const payload = {
    client_id: options.clientId,
    events: [
      {
        name: event.name,
        params: {
          ...params,
          ...(options.timestampMicros ? { timestamp_micros: options.timestampMicros } : {}),
        },
      },
    ],
  };
  return JSON.stringify(payload, null, 2);
}

/** Build the Measurement Protocol endpoint URL. */
export function buildMeasurementProtocolUrl(apiSecret: string, measurementId: string): string {
  return `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
}

/** Find a preset by event name. */
export function findPreset(name: string): EventPreset | undefined {
  return EVENT_PRESETS.find((p) => p.name === name);
}

/** Count non-empty params. */
export function countParams(event: Ga4Event): number {
  return Object.values(event.params).filter(
    (v) => v !== undefined && v !== null && v !== "",
  ).length;
}

export const GA4_EVENT_DOCS_URL = "https://developers.google.com/analytics/devguides/collection/ga4/events";
export const GA4_MEASUREMENT_PROTOCOL_DOCS_URL = "https://developers.google.com/analytics/devguides/collection/protocol/ga4";

// ---- History ----

const HISTORY_KEY = "unqtools:google-analytics-4-event-builder:history";
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
  clientId: string;
  apiSecret: string;
  measurementId: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("event", state.eventName);
  params.set("params", state.paramsJson);
  if (state.clientId) params.set("clientId", state.clientId);
  if (state.apiSecret) params.set("apiSecret", state.apiSecret);
  if (state.measurementId) params.set("measurementId", state.measurementId);
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
  const clientId = params.get("clientId");
  if (clientId !== null) out.clientId = clientId;
  const apiSecret = params.get("apiSecret");
  if (apiSecret !== null) out.apiSecret = apiSecret;
  const measurementId = params.get("measurementId");
  if (measurementId !== null) out.measurementId = measurementId;
  return out;
}
