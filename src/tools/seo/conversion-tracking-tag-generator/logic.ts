/**
 * Conversion Tracking Tag Generator — pure logic.
 *
 * Generate conversion tracking tags for major platforms:
 *   - Google Ads (gtag.js conversion tracking)
 *   - Facebook Pixel (Meta Pixel)
 *   - LinkedIn Insight Tag
 *   - Twitter (X) Pixel
 *
 * Pure functions only — no DOM, no network.
 */

export type Platform = "google-ads" | "facebook-pixel" | "linkedin-insight" | "twitter-pixel";

export interface PlatformInfo {
  id: Platform;
  label: string;
  description: string;
  requiredFields: string[];
  docsUrl: string;
}

export const PLATFORM_INFO: PlatformInfo[] = [
  {
    id: "google-ads",
    label: "Google Ads",
    description: "Google Ads conversion tracking tag. Fires on conversion events (form submit, purchase, etc.).",
    requiredFields: ["conversionId", "conversionLabel"],
    docsUrl: "https://support.google.com/google-ads/answer/6095821",
  },
  {
    id: "facebook-pixel",
    label: "Facebook Pixel (Meta Pixel)",
    description: "Meta Pixel for Facebook/Instagram ad attribution. Base code + event tracking.",
    requiredFields: ["pixelId"],
    docsUrl: "https://www.facebook.com/business/help/952192354843755",
  },
  {
    id: "linkedin-insight",
    label: "LinkedIn Insight Tag",
    description: "LinkedIn Insight Tag for ad attribution and retargeting on LinkedIn.",
    requiredFields: ["partnerId"],
    docsUrl: "https://www.linkedin.com/help/lms/answer/a1419092",
  },
  {
    id: "twitter-pixel",
    label: "Twitter (X) Pixel",
    description: "Twitter/X conversion tracking pixel for ad attribution.",
    requiredFields: ["pixelId"],
    docsUrl: "https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites",
  },
];

export interface TrackingConfig {
  platform: Platform;
  // Google Ads
  conversionId?: string;
  conversionLabel?: string;
  conversionValue?: number;
  currency?: string;
  transactionId?: string;
  // Facebook / Twitter
  pixelId?: string;
  // LinkedIn
  partnerId?: string;
  // Custom event
  eventName?: string;
  eventValue?: number;
  eventCurrency?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validate the config for the chosen platform. */
export function validateConfig(config: TrackingConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info = PLATFORM_INFO.find((p) => p.id === config.platform);
  if (!info) {
    errors.push("Unknown platform");
    return { ok: false, errors, warnings };
  }
  for (const field of info.requiredFields) {
    const v = (config as Record<string, unknown>)[field];
    if (!v || (typeof v === "string" && !v.trim())) {
      errors.push(`${field} is required for ${info.label}`);
    }
  }
  // Platform-specific validation
  if (config.platform === "google-ads" && config.conversionId) {
    if (!/^[A-Z]{2}-\d{7,}-\d+$/.test(config.conversionId) && !/^\d+$/.test(config.conversionId)) {
      warnings.push("Google Ads conversion ID typically looks like 'AW-123456789' (or numeric ID)");
    }
  }
  if (config.platform === "facebook-pixel" && config.pixelId) {
    if (!/^\d{10,20}$/.test(config.pixelId)) {
      warnings.push("Facebook Pixel ID is typically 15-16 digits");
    }
  }
  if (config.platform === "linkedin-insight" && config.partnerId) {
    if (!/^\d{6,}$/.test(config.partnerId)) {
      warnings.push("LinkedIn Partner ID is typically 7+ digits");
    }
  }
  if (config.platform === "twitter-pixel" && config.pixelId) {
    if (!/^[a-z0-9]{5,}$/i.test(config.pixelId)) {
      warnings.push("Twitter Pixel ID is typically alphanumeric");
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** HTML-escape a string for safe attribute / script content. */
export function escapeHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Generate Google Ads conversion tracking tag (base snippet). */
export function generateGoogleAdsBaseTag(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const id = config.conversionId!;
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(id)}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${escapeHtml(id)}');
</script>`;
}

/** Generate Google Ads conversion event snippet. */
export function generateGoogleAdsEventTag(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const id = config.conversionId!;
  const label = config.conversionLabel!;
  const value = config.conversionValue;
  const currency = config.currency || "USD";
  const transactionId = config.transactionId;
  const params: string[] = [
    "'send_to': '" + `${id}/${label}` + "'",
  ];
  if (value !== undefined && !Number.isNaN(value)) {
    params.push(`'value': ${value}`);
    params.push(`'currency': '${escapeHtml(currency)}'`);
  }
  if (transactionId) {
    params.push(`'transaction_id': '${escapeHtml(transactionId)}'`);
  }
  const paramsStr = params.join(",\n    ");
  return `<!-- Google Ads conversion event -->
<script>
  gtag('event', 'conversion', {
    ${paramsStr}
  });
</script>`;
}

/** Generate Facebook Pixel base code. */
export function generateFacebookPixelBase(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const pixelId = config.pixelId!;
  return `<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${escapeHtml(pixelId)}');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${escapeHtml(pixelId)}&ev=PageView&noscript=1"/>
</noscript>`;
}

/** Generate Facebook Pixel event code. */
export function generateFacebookPixelEvent(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const eventName = config.eventName || "Lead";
  const value = config.eventValue;
  const currency = config.eventCurrency || "USD";
  const params: string[] = [];
  if (value !== undefined && !Number.isNaN(value)) {
    params.push(`value: ${value}`);
    params.push(`currency: '${escapeHtml(currency)}'`);
  }
  const paramsStr = params.length > 0 ? `, { ${params.join(", ")} }` : "";
  return `<!-- Meta Pixel event -->
<script>
  fbq('track', '${escapeHtml(eventName)}'${paramsStr});
</script>`;
}

/** Generate LinkedIn Insight Tag. */
export function generateLinkedInInsightTag(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const partnerId = config.partnerId!;
  return `<!-- LinkedIn Insight Tag -->
<script type="text/javascript">
  _linkedin_partner_id = "${escapeHtml(partnerId)}";
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);
</script>
<script type="text/javascript">
  (function() {
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript";
    b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);
  })();
</script>
<noscript>
  <img height="1" width="1" style="display:none;" alt=""
    src="https://px.ads.linkedin.com/collect/?pid=${escapeHtml(partnerId)}&fmt=gif" />
</noscript>`;
}

/** Generate LinkedIn Insight event conversion tag. */
export function generateLinkedInEventTag(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const partnerId = config.partnerId!;
  const eventName = config.eventName || "conversion";
  return `<!-- LinkedIn Insight event -->
<script type="text/javascript">
  if (window.lintrk) {
    window.lintrk('track', { conversion_id: ${escapeHtml(eventName)} });
  }
</script>`;
}

/** Generate Twitter Pixel base code. */
export function generateTwitterPixelBase(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const pixelId = config.pixelId!;
  return `<!-- Twitter (X) Pixel Code -->
<script>
  !function(e,t,n,s,u,a){
    e.twq||(s=e.twq=function(){
      s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
    },s.version='1.1',s.queue=[],
    u=t.createElement(n),u.async=!0,u.src='//static.ads-twitter.com/uwt.js',
    a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))
  }(window,document,'script');
  twq('init','${escapeHtml(pixelId)}');
  twq('track','PageView');
</script>`;
}

/** Generate Twitter Pixel event code. */
export function generateTwitterPixelEvent(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const eventName = config.eventName || "Purchase";
  const value = config.eventValue;
  const currency = config.eventCurrency || "USD";
  const params: string[] = [];
  if (value !== undefined && !Number.isNaN(value)) {
    params.push(`value: '${value}'`);
    params.push(`currency: '${escapeHtml(currency)}'`);
  }
  const paramsStr = params.length > 0 ? `, { ${params.join(", ")} }` : "";
  return `<!-- Twitter Pixel event -->
<script>
  twq('track', '${escapeHtml(eventName)}'${paramsStr});
</script>`;
}

/** Generate the full HTML snippet combining base + event for a platform. */
export function generateFullSnippet(config: TrackingConfig): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const parts: string[] = [];
  switch (config.platform) {
    case "google-ads":
      parts.push(generateGoogleAdsBaseTag(config));
      parts.push(generateGoogleAdsEventTag(config));
      break;
    case "facebook-pixel":
      parts.push(generateFacebookPixelBase(config));
      parts.push(generateFacebookPixelEvent(config));
      break;
    case "linkedin-insight":
      parts.push(generateLinkedInInsightTag(config));
      break;
    case "twitter-pixel":
      parts.push(generateTwitterPixelBase(config));
      parts.push(generateTwitterPixelEvent(config));
      break;
  }
  return parts.join("\n\n");
}

/** Get the platform-specific snippet for a section ("base" or "event"). */
export function getSnippet(config: TrackingConfig, section: "base" | "event"): string {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  switch (config.platform) {
    case "google-ads":
      return section === "base"
        ? generateGoogleAdsBaseTag(config)
        : generateGoogleAdsEventTag(config);
    case "facebook-pixel":
      return section === "base"
        ? generateFacebookPixelBase(config)
        : generateFacebookPixelEvent(config);
    case "linkedin-insight":
      return section === "base"
        ? generateLinkedInInsightTag(config)
        : generateLinkedInEventTag(config);
    case "twitter-pixel":
      return section === "base"
        ? generateTwitterPixelBase(config)
        : generateTwitterPixelEvent(config);
  }
}

// ---- History ----

const HISTORY_KEY = "unqtools:conversion-tracking-tag-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  platform: Platform;
  snippetLength: number;
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
  config: TrackingConfig;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  const c = state.config;
  params.set("platform", c.platform);
  if (c.conversionId) params.set("conversionId", c.conversionId);
  if (c.conversionLabel) params.set("conversionLabel", c.conversionLabel);
  if (c.conversionValue !== undefined) params.set("conversionValue", String(c.conversionValue));
  if (c.currency) params.set("currency", c.currency);
  if (c.transactionId) params.set("transactionId", c.transactionId);
  if (c.pixelId) params.set("pixelId", c.pixelId);
  if (c.partnerId) params.set("partnerId", c.partnerId);
  if (c.eventName) params.set("eventName", c.eventName);
  if (c.eventValue !== undefined) params.set("eventValue", String(c.eventValue));
  if (c.eventCurrency) params.set("eventCurrency", c.eventCurrency);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TrackingConfig> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string | number> = {};
  for (const [k, v] of params.entries()) {
    if (k === "conversionValue" || k === "eventValue") {
      const n = Number(v);
      out[k] = Number.isNaN(n) ? v : n;
    } else {
      out[k] = v;
    }
  }
  return out as Partial<TrackingConfig>;
}
