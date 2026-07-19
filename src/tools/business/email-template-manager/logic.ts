/**
 * Email Template Manager — pure logic.
 *
 * Generate, customize, and store business email templates. Pure functions
 * only — no DOM, no network.
 */

// ---- Types ----

export type EmailType =
  | "welcome"
  | "follow-up"
  | "meeting-request"
  | "proposal"
  | "thank-you"
  | "reminder"
  | "apology"
  | "newsletter"
  | "out-of-office"
  | "sales-outreach";

export type EmailTone = "formal" | "professional" | "casual" | "friendly" | "urgent";

export interface EmailInput {
  templateType: EmailType;
  recipientName: string;
  senderName: string;
  senderCompany: string;
  subject: string;
  customFields: string; // `key,value` per line
  tone: EmailTone;
}

export interface RenderedEmail {
  subject: string;
  body: string;
  wordCount: number;
  readTimeSeconds: number;
  placeholders: string[];
  hasPlaceholders: boolean;
}

export interface EmailStats {
  type: EmailType;
  typeLabel: string;
  tone: EmailTone;
  toneLabel: string;
  wordCount: number;
  readTimeSeconds: number;
  readTimeLabel: string;
  subjectLength: number;
  subjectTooLong: boolean;
  hasPlaceholders: boolean;
  placeholders: string[];
}

export interface EmailHistoryEntry {
  ts: number;
  templateType: EmailType;
  tone: EmailTone;
  recipientName: string;
  subject: string;
  wordCount: number;
}

// ---- Constants / Presets ----

export const EMAIL_TYPES: EmailType[] = [
  "welcome",
  "follow-up",
  "meeting-request",
  "proposal",
  "thank-you",
  "reminder",
  "apology",
  "newsletter",
  "out-of-office",
  "sales-outreach",
];

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  "welcome": "Welcome",
  "follow-up": "Follow-up",
  "meeting-request": "Meeting Request",
  "proposal": "Proposal",
  "thank-you": "Thank You",
  "reminder": "Reminder",
  "apology": "Apology",
  "newsletter": "Newsletter",
  "out-of-office": "Out of Office",
  "sales-outreach": "Sales Outreach",
};

export const EMAIL_TONES: EmailTone[] = [
  "formal",
  "professional",
  "casual",
  "friendly",
  "urgent",
];

export const EMAIL_TONE_LABELS: Record<EmailTone, string> = {
  "formal": "Formal",
  "professional": "Professional",
  "casual": "Casual",
  "friendly": "Friendly",
  "urgent": "Urgent",
};

// ---- Tone modifiers ----

export interface ToneModifier {
  greeting: (recipientName: string) => string;
  closing: (senderName: string) => string;
  subjectPrefix: string;
}

export const TONE_MODIFIERS: Record<EmailTone, ToneModifier> = {
  formal: {
    greeting: (n) => `Dear ${n || "[Recipient Name]"},`,
    closing: (n) => `Respectfully,\n${n || "[Your Name]"}`,
    subjectPrefix: "",
  },
  professional: {
    greeting: (n) => `Hi ${n || "[Recipient Name]"},`,
    closing: (n) => `Best regards,\n${n || "[Your Name]"}`,
    subjectPrefix: "",
  },
  casual: {
    greeting: (n) => `Hey ${n || "[Recipient Name]"},`,
    closing: (n) => `Cheers,\n${n || "[Your Name]"}`,
    subjectPrefix: "",
  },
  friendly: {
    greeting: (n) => `Hi ${n || "[Recipient Name]"}!`,
    closing: (n) => `Warmly,\n${n || "[Your Name]"}`,
    subjectPrefix: "",
  },
  urgent: {
    greeting: (n) => `Hi ${n || "[Recipient Name]"},`,
    closing: (n) => `Thanks,\n${n || "[Your Name]"}`,
    subjectPrefix: "[URGENT] ",
  },
};

// ---- Custom fields parser ----

/** Parse `key,value` lines into a Record. */
export function parseCustomFields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text) return out;
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const idx = line.indexOf(",");
    if (idx === -1) {
      // No comma — treat whole line as key with empty value.
      const k = line.replace(/\s+/g, "_").trim();
      if (k) out[k] = "";
      return;
    }
    const k = line.slice(0, idx).trim().replace(/\s+/g, "_");
    const v = line.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

// ---- Variable substitution ----

/** Build the variable map from EmailInput + custom fields. */
export function buildVariables(input: EmailInput): Record<string, string> {
  return {
    recipientName: input.recipientName,
    senderName: input.senderName,
    senderCompany: input.senderCompany,
    ...parseCustomFields(input.customFields),
  };
}

/** Replace {{key}} placeholders in a string. */
export function substituteVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? "";
    }
    return match; // leave unknown placeholders intact for validator
  });
}

/** Find all unsubstituted {{placeholder}} patterns in a string. */
export function findPlaceholders(text: string): string[] {
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

// ---- Subject auto-generator ----

/** Auto-generate a subject line based on type and tone. */
export function generateSubject(input: EmailInput): string {
  const r = input.recipientName || "[Recipient Name]";
  const s = input.senderName || "[Your Name]";
  const c = input.senderCompany || "[Your Company]";
  const prefix = TONE_MODIFIERS[input.tone].subjectPrefix;
  const vars = buildVariables(input);

  let base: string;
  switch (input.templateType) {
    case "welcome":
      base = `Welcome to ${c}, ${r}!`;
      break;
    case "follow-up":
      base = `Following up on our conversation`;
      break;
    case "meeting-request":
      base = `Meeting request — ${c}`;
      break;
    case "proposal":
      base = `Proposal from ${c}`;
      break;
    case "thank-you":
      base = `Thank you, ${r}`;
      break;
    case "reminder":
      base = `Reminder: action needed`;
      break;
    case "apology":
      base = `Our apologies — ${c}`;
      break;
    case "newsletter":
      base = `${c} Newsletter — ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}`;
      break;
    case "out-of-office":
      base = `Out of office: ${s}`;
      break;
    case "sales-outreach":
      base = `Helping ${c} grow`;
      break;
    default:
      base = `Message from ${c}`;
  }
  return substituteVariables(`${prefix}${base}`, vars);
}

/** Resolve the subject: use the user-provided subject, or auto-generate. */
export function resolveSubject(input: EmailInput): string {
  if (input.subject?.trim()) {
    return substituteVariables(input.subject.trim(), buildVariables(input));
  }
  return generateSubject(input);
}

// ---- Template body library ----

/** Return the body template (with placeholders) for a given email type. */
export function getBodyTemplate(type: EmailType): string {
  switch (type) {
    case "welcome":
      return [
        `Thank you for joining {{senderCompany}}. We're excited to have you on board.`,
        ``,
        `Here's what you can do next:`,
        `1. Complete your profile.`,
        `2. Explore the dashboard.`,
        `3. Reach out to our team if you have any questions.`,
        ``,
        `If you need anything, just reply to this email and we'll be happy to help.`,
      ].join("\n");
    case "follow-up":
      return [
        `It was great connecting with you. I wanted to follow up on our recent conversation and see if you had any additional questions.`,
        ``,
        `As discussed, I've attached the relevant materials for your review. Please let me know if anything is unclear or if you'd like to schedule another call.`,
        ``,
        `Looking forward to hearing your thoughts.`,
      ].join("\n");
    case "meeting-request":
      return [
        `I hope this note finds you well. I'd like to schedule a meeting to discuss how {{senderCompany}} can support your goals.`,
        ``,
        `Proposed time: {{meeting_date}} at {{meeting_time}}.`,
        `Duration: approximately 30 minutes.`,
        `Agenda: introduction, current challenges, and potential next steps.`,
        ``,
        `If this time doesn't work, please suggest two or three alternative slots and I'll do my best to accommodate.`,
      ].join("\n");
    case "proposal":
      return [
        `Thank you for the opportunity to submit a proposal. Based on our discussions, I've prepared the following outline for your review.`,
        ``,
        `Scope of work: {{scope}}`,
        `Timeline: {{timeline}}`,
        `Investment: {{investment}}`,
        ``,
        `The attached document contains the full proposal with detailed deliverables, milestones, and terms. I'm happy to walk through it on a call at your convenience.`,
        ``,
        `Please let me know if you have any questions or would like any adjustments.`,
      ].join("\n");
    case "thank-you":
      return [
        `I wanted to take a moment to say thank you. Your {{reason}} meant a lot to me and to the team at {{senderCompany}}.`,
        ``,
        `We truly value our relationship and look forward to continuing to work together.`,
      ].join("\n");
    case "reminder":
      return [
        `This is a friendly reminder regarding {{topic}}. The deadline is approaching on {{due_date}}.`,
        ``,
        `Please let me know if you have any questions or need an extension. I'm happy to help in any way I can.`,
      ].join("\n");
    case "apology":
      return [
        `I'm writing to sincerely apologize for {{issue}}. We understand the inconvenience this may have caused and take full responsibility.`,
        ``,
        `Here's what we're doing to fix it:`,
        `1. {{action1}}`,
        `2. {{action2}}`,
        ``,
        `We've also taken steps to prevent this from happening again. If you have any further concerns, please don't hesitate to reach out directly.`,
      ].join("\n");
    case "newsletter":
      return [
        `Welcome to this month's newsletter from {{senderCompany}}. Here's a quick roundup of what we've been up to.`,
        ``,
        `Highlights:`,
        `- {{highlight1}}`,
        `- {{highlight2}}`,
        `- {{highlight3}}`,
        ``,
        `Read the full stories on our blog. Thanks for being part of our community!`,
      ].join("\n");
    case "out-of-office":
      return [
        `Thank you for your email. I'm currently out of the office from {{ooo_start}} through {{ooo_end}} and will have limited access to email during this time.`,
        ``,
        `For urgent matters, please contact {{backup_contact}}. Otherwise, I'll respond to your message as soon as possible upon my return.`,
        ``,
        `Best regards,`,
        `{{senderName}}`,
      ].join("\n");
    case "sales-outreach":
      return [
        `I hope you're doing well. I'm reaching out because I noticed {{senderCompany}} has been growing, and I believe we might be able to help you scale even faster.`,
        ``,
        `We work with companies like yours to {{value_prop}}. Our typical clients see {{benefit}} within the first 90 days.`,
        ``,
        `Would you be open to a brief 15-minute call next week to explore whether there's a fit? I'm happy to work around your schedule.`,
      ].join("\n");
    default:
      return "";
  }
}

// ---- Length / read-time ----

/** Count words in a string. */
export function countWords(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/** Estimate read time in seconds at 200 wpm. */
export function estimateReadTime(text: string): number {
  const wpm = 200;
  const words = countWords(text);
  return Math.max(1, Math.round((words / wpm) * 60));
}

/** Format read time as a human-readable label. */
export function formatReadTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ---- Renderers ----

const EMAIL_TYPE_DESCRIPTIONS: Record<EmailType, string> = {
  "welcome": "Welcome new customers or users",
  "follow-up": "Follow up after a meeting or conversation",
  "meeting-request": "Request a meeting with prospects or partners",
  "proposal": "Share a proposal with a client",
  "thank-you": "Express gratitude to customers or partners",
  "reminder": "Send a friendly reminder",
  "apology": "Apologize for an issue or mistake",
  "newsletter": "Monthly newsletter introduction",
  "out-of-office": "Auto-reply when you're away",
  "sales-outreach": "Cold outreach to prospects",
};

/** Render an email as plain text. */
export function renderText(input: EmailInput): RenderedEmail {
  const vars = buildVariables(input);
  const subject = resolveSubject(input);
  const bodyTemplate = getBodyTemplate(input.templateType);
  const mod = TONE_MODIFIERS[input.tone];

  const greeting = mod.greeting(input.recipientName);
  const bodySubbed = substituteVariables(bodyTemplate, vars);
  const closing = mod.closing(input.senderName);

  const body = [greeting, "", bodySubbed, "", closing].join("\n");
  const fullText = `${subject}\n\n${body}`;
  const wordCount = countWords(`${subject} ${body}`);
  const readTimeSeconds = estimateReadTime(`${subject} ${body}`);
  const placeholders = findPlaceholders(fullText);

  return {
    subject,
    body,
    wordCount,
    readTimeSeconds,
    placeholders,
    hasPlaceholders: placeholders.length > 0,
  };
}

/** Render an email as markdown. */
export function renderMarkdown(input: EmailInput): string {
  const r = renderText(input);
  const L: string[] = [];
  L.push(`**Subject:** ${r.subject}`);
  L.push("");
  L.push("---");
  L.push("");
  L.push(r.body);
  return L.join("\n");
}

/** Render an email as HTML (inline CSS, email-client friendly). */
export function renderHtml(input: EmailInput): string {
  const r = renderText(input);
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;max-width:600px;width:100%">
<tr><td style="padding:24px 24px 0 24px;border-bottom:1px solid #eee">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888">Subject</div>
<div style="font-size:16px;font-weight:bold;color:#1a1a1a;margin-top:4px">${esc(r.subject)}</div>
</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#333">
${esc(r.body)}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eee;background:#fafafa;border-radius:0 0 8px 8px">
<div style="font-size:11px;color:#888">Sent by ${esc(input.senderName || "[Your Name]")}${input.senderCompany ? ` · ${esc(input.senderCompany)}` : ""}</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ---- Summary stats ----

/** Compute summary stats for an email. */
export function computeStats(input: EmailInput): EmailStats {
  const r = renderText(input);
  return {
    type: input.templateType,
    typeLabel: EMAIL_TYPE_LABELS[input.templateType],
    tone: input.tone,
    toneLabel: EMAIL_TONE_LABELS[input.tone],
    wordCount: r.wordCount,
    readTimeSeconds: r.readTimeSeconds,
    readTimeLabel: formatReadTime(r.readTimeSeconds),
    subjectLength: r.subject.length,
    subjectTooLong: r.subject.length > 60,
    hasPlaceholders: r.hasPlaceholders,
    placeholders: r.placeholders,
  };
}

// ---- Subject character counter ----

/** Check if a subject exceeds the email-client truncation threshold. */
export function isSubjectTooLong(subject: string, threshold = 60): boolean {
  return subject.length > threshold;
}

// ---- Placeholder validator ----

/** Find unsubstituted placeholders in a rendered email. */
export function validatePlaceholders(rendered: RenderedEmail): string[] {
  return rendered.placeholders;
}

// ---- Multi-template batch generator ----

/** Generate the same variables across multiple template types. */
export function generateBatch(
  input: EmailInput,
  types: EmailType[],
): Record<EmailType, RenderedEmail> {
  const out = {} as Record<EmailType, RenderedEmail>;
  for (const t of types) {
    out[t] = renderText({ ...input, templateType: t });
  }
  return out;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:email-template-manager:history";
const HISTORY_MAX = 20;

export function loadHistory(): EmailHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as EmailHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: EmailHistoryEntry): EmailHistoryEntry[] {
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

export function buildShareUrl(input: Partial<EmailInput>): string {
  const params = new URLSearchParams();
  if (input.templateType) params.set("type", input.templateType);
  if (input.tone) params.set("tone", input.tone);
  if (input.recipientName) params.set("rn", input.recipientName);
  if (input.senderName) params.set("sn", input.senderName);
  if (input.senderCompany) params.set("sc", input.senderCompany);
  if (input.subject) params.set("subj", input.subject);
  if (input.customFields) params.set("cf", input.customFields);
  if (typeof window === "undefined") return `#${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<EmailInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<EmailInput> = {};
  const type = params.get("type") as EmailType | null;
  if (type && EMAIL_TYPES.includes(type)) out.templateType = type;
  const tone = params.get("tone") as EmailTone | null;
  if (tone && EMAIL_TONES.includes(tone)) out.tone = tone;
  if (params.get("rn")) out.recipientName = params.get("rn")!;
  if (params.get("sn")) out.senderName = params.get("sn")!;
  if (params.get("sc")) out.senderCompany = params.get("sc")!;
  if (params.get("subj")) out.subject = params.get("subj")!;
  if (params.get("cf")) out.customFields = params.get("cf")!;
  return out;
}

// ---- Re-exported constant for UI ----

export const TYPE_DESCRIPTIONS = EMAIL_TYPE_DESCRIPTIONS;
