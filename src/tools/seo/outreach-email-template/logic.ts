/**
 * Outreach Email Template Generator — pure logic.
 *
 * Generate personalized outreach emails for link building.
 * Templates: guest post, backlink request, broken link, collaboration, influencer outreach.
 *
 * Pure functions only — no DOM, no network.
 */

export type TemplateType =
  | "guest-post"
  | "backlink-request"
  | "broken-link"
  | "collaboration"
  | "influencer-outreach";

export type Tone = "formal" | "casual" | "friendly";

export interface OutreachInput {
  template: TemplateType;
  tone: Tone;
  recipientName: string;
  recipientSite: string;
  yourName: string;
  yourSite: string;
  yourEmail: string;
  topic: string;
  yourArticleTitle?: string;
  theirArticleUrl?: string;
  brokenLinkUrl?: string;
  replacementUrl?: string;
  customMessage?: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  wordCount: number;
  charCount: number;
  estimatedReadTime: number; // minutes
}

export interface TemplateInfo {
  type: TemplateType;
  label: string;
  description: string;
  requiredFields: string[];
}

export const TEMPLATE_INFO: TemplateInfo[] = [
  {
    type: "guest-post",
    label: "Guest post pitch",
    description: "Pitch a guest post idea to a relevant blog in your niche.",
    requiredFields: ["recipientName", "recipientSite", "yourName", "yourSite", "topic"],
  },
  {
    type: "backlink-request",
    label: "Backlink request",
    description: "Ask a site to link to your resource from existing content.",
    requiredFields: ["recipientName", "recipientSite", "yourName", "yourSite", "yourArticleTitle", "topic"],
  },
  {
    type: "broken-link",
    label: "Broken link building",
    description: "Notify a site about a broken link and suggest your replacement.",
    requiredFields: ["recipientName", "recipientSite", "yourName", "yourSite", "brokenLinkUrl", "replacementUrl"],
  },
  {
    type: "collaboration",
    label: "Collaboration pitch",
    description: "Propose a content or partnership collaboration.",
    requiredFields: ["recipientName", "recipientSite", "yourName", "yourSite", "topic"],
  },
  {
    type: "influencer-outreach",
    label: "Influencer outreach",
    description: "Reach out to an influencer about your product or content.",
    requiredFields: ["recipientName", "yourName", "yourSite", "topic"],
  },
];

export const TEMPLATE_LABEL_MAP: Record<TemplateType, string> = {
  "guest-post": "Guest post pitch",
  "backlink-request": "Backlink request",
  "broken-link": "Broken link building",
  collaboration: "Collaboration pitch",
  "influencer-outreach": "Influencer outreach",
};

/** Substitute {variables} in a string. Unknown variables are left as-is. */
export function substituteVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in vars && vars[key] !== undefined && vars[key] !== null) {
      return String(vars[key]);
    }
    return match;
  });
}

/** Greeting based on tone. */
export function greeting(recipientName: string, tone: Tone): string {
  const name = recipientName.trim() || "there";
  switch (tone) {
    case "formal":
      return `Dear ${name},`;
    case "casual":
      return `Hey ${name}!`;
    case "friendly":
      return `Hi ${name},`;
  }
}

/** Sign-off based on tone. */
export function signOff(yourName: string, tone: Tone): string {
  const name = yourName.trim() || "";
  switch (tone) {
    case "formal":
      return `Sincerely,\n${name}`;
    case "casual":
      return `Cheers,\n${name}`;
    case "friendly":
      return `Best,\n${name}`;
  }
}

/** Generate subject line based on template type and inputs. */
export function generateSubject(input: OutreachInput): string {
  const site = input.recipientSite.trim();
  const topic = input.topic.trim();
  switch (input.template) {
    case "guest-post":
      return topic
        ? `Guest post idea for ${site}: ${topic}`
        : `Guest post pitch for ${site}`;
    case "backlink-request":
      return input.yourArticleTitle
        ? `Resource suggestion for ${site}`
        : `Quick suggestion for ${site}`;
    case "broken-link":
      return `Found a broken link on ${site}`;
    case "collaboration":
      return topic
        ? `Collaboration idea: ${topic}`
        : `Collaboration opportunity`;
    case "influencer-outreach":
      return topic
        ? `${topic} — would love your thoughts`
        : `Quick question`;
  }
}

/** Generate the email body for the given template + tone. */
export function generateEmailBody(input: OutreachInput): string {
  const vars: Record<string, string> = {
    name: input.recipientName.trim() || "there",
    site: input.recipientSite.trim(),
    yourName: input.yourName.trim(),
    yourSite: input.yourSite.trim(),
    yourEmail: input.yourEmail.trim(),
    topic: input.topic.trim(),
    yourArticleTitle: input.yourArticleTitle?.trim() || "",
    theirArticleUrl: input.theirArticleUrl?.trim() || "",
    brokenLinkUrl: input.brokenLinkUrl?.trim() || "",
    replacementUrl: input.replacementUrl?.trim() || "",
    customMessage: input.customMessage?.trim() || "",
  };

  const greet = greeting(input.recipientName, input.tone);
  const sign = signOff(input.yourName, input.tone);

  let body: string;
  switch (input.template) {
    case "guest-post":
      body = [
        greet,
        "",
        `I've been a big fan of ${vars.site} for a while — your recent content on ${vars.topic || "the industry"} really resonated with me.`,
        "",
        `I'd love to contribute a guest post for your readers. I was thinking of a piece titled "${vars.yourArticleTitle || vars.topic || "an in-depth guide"}" — actionable, original, and tailored to your audience.`,
        "",
        `A bit about me: I write at ${vars.yourSite} and have published on similar topics. I'd be happy to share writing samples and a more detailed outline if you're interested.`,
        "",
        vars.customMessage ? vars.customMessage : "Would a guest post on this topic be a fit for your editorial calendar?",
        "",
        `Looking forward to hearing your thoughts.`,
        "",
        sign,
        vars.yourSite ? `\n${vars.yourSite}` : "",
      ].filter(Boolean).join("\n");
      break;

    case "backlink-request":
      body = [
        greet,
        "",
        `I was reading your article${vars.theirArticleUrl ? ` at ${vars.theirArticleUrl}` : ""} on ${vars.site} — really useful stuff.`,
        "",
        `I recently published "${vars.yourArticleTitle || vars.topic}" on ${vars.yourSite}. It's a comprehensive resource that I think would add real value to your readers if you linked to it from your article.`,
        "",
        `Specifically, the section about ${vars.topic || "the topic"} would benefit from a reference. The URL is: ${vars.yourSite}`,
        "",
        vars.customMessage ? vars.customMessage : "If you think it's a good fit, I'd be grateful for the link. Either way, thanks for the great content!",
        "",
        sign,
        vars.yourSite ? `\n${vars.yourSite}` : "",
      ].filter(Boolean).join("\n");
      break;

    case "broken-link":
      body = [
        greet,
        "",
        `I was reading your great content on ${vars.site} and noticed a broken link: ${vars.brokenLinkUrl}`,
        "",
        `I've actually published a resource that could be a good replacement: ${vars.replacementUrl}`,
        "",
        vars.customMessage ? vars.customMessage : "Hope this helps — figured you'd want to know. Thanks for the great work on the site.",
        "",
        sign,
        vars.yourSite ? `\n${vars.yourSite}` : "",
      ].filter(Boolean).join("\n");
      break;

    case "collaboration":
      body = [
        greet,
        "",
        `I've been following ${vars.site} for a while — your approach to ${vars.topic || "your work"} is genuinely impressive.`,
        "",
        `I run ${vars.yourSite} and I think there's a great opportunity for us to collaborate. I'm imagining something like a co-authored piece, a joint webinar, or a content swap that benefits both our audiences.`,
        "",
        vars.customMessage ? vars.customMessage : "Would you be open to a quick 15-minute call to explore ideas?",
        "",
        sign,
        vars.yourSite ? `\n${vars.yourSite}` : "",
      ].filter(Boolean).join("\n");
      break;

    case "influencer-outreach":
      body = [
        greet,
        "",
        `I've been following your work${vars.site ? ` on ${vars.site}` : ""} — your perspective on ${vars.topic || "the space"} has been super valuable to me.`,
        "",
        `I'm reaching out because I've built something I think you'd genuinely find interesting: ${vars.yourSite}. It's focused on ${vars.topic || "solving a real problem in this space"}.`,
        "",
        vars.customMessage ? vars.customMessage : "I'd love to send you free access in exchange for your honest feedback — no obligation to share. Would that be of interest?",
        "",
        sign,
        vars.yourSite ? `\n${vars.yourSite}` : "",
      ].filter(Boolean).join("\n");
      break;
  }

  return body;
}

/** Generate the full email (subject + body + stats). */
export function generateEmail(input: OutreachInput): GeneratedEmail {
  const subject = generateSubject(input);
  const body = generateEmailBody(input);
  const wordCount = countWords(body);
  const charCount = body.length;
  const estimatedReadTime = Math.max(1, Math.round(wordCount / 200));
  return { subject, body, wordCount, charCount, estimatedReadTime };
}

/** Count words in a string. */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validate inputs for the chosen template. */
export function validateInput(input: OutreachInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info = TEMPLATE_INFO.find((t) => t.type === input.template);
  if (!info) {
    errors.push("Unknown template type");
    return { ok: false, errors, warnings };
  }
  for (const field of info.requiredFields) {
    const v = (input as Record<string, unknown>)[field];
    if (!v || (typeof v === "string" && !v.trim())) {
      errors.push(`${field} is required for ${info.label}`);
    }
  }
  if (input.recipientSite && !/^https?:\/\//i.test(input.recipientSite) && !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(input.recipientSite)) {
    warnings.push("Recipient site doesn't look like a URL or domain");
  }
  if (input.yourSite && !/^https?:\/\//i.test(input.yourSite) && !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(input.yourSite)) {
    warnings.push("Your site doesn't look like a URL or domain");
  }
  if (input.brokenLinkUrl && !/^https?:\/\//i.test(input.brokenLinkUrl)) {
    warnings.push("Broken link URL should start with http(s)://");
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ---- History ----

const HISTORY_KEY = "unqtools:outreach-email-template:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  template: TemplateType;
  tone: Tone;
  recipient: string;
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

export interface ShareState {
  input: OutreachInput;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state.input)) {
    if (v !== undefined && v !== null && v !== "") {
      params.set(k, String(v));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OutreachInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out as Partial<OutreachInput>;
}
