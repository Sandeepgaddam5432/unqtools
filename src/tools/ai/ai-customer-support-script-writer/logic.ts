/**
 * AI Customer Support Script Writer — pure logic.
 *
 * Generate staged, tone-tuned customer-support scripts from a scenario
 * template library. Empathetic openers, acknowledgment, resolution steps,
 * objection handling, and closing — driven by channel (chat/email/phone),
 * tone (empathetic/formal/friendly), brand-voice, and de-escalation
 * presets. Optional BYO-key LLM call lives in ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: scripts are drafts to adapt, not policy. Ensure compliance with
 * your company policy + local law. Legal/compliance-sensitive replies
 * should be flagged for human/legal review. The on-device template library
 * is less nuanced than a BYO-key LLM; nothing is uploaded by us.
 */

// ---------- Types ----------

export type Scenario =
  | "refund-request"
  | "complaint-escalation"
  | "technical-issue"
  | "cancellation"
  | "billing-dispute"
  | "outage-acknowledgment"
  | "upsell"
  | "onboarding"
  | "feature-request"
  | "shipping-delay"
  | "account-reactivation"
  | "password-reset";

export type Channel = "chat" | "email" | "phone";
export type Tone = "empathetic" | "formal" | "friendly";

export type Stage = "opener" | "acknowledgment" | "investigation" | "resolution" | "objection-handling" | "closing";

export interface ScriptVariables {
  customerName?: string;
  agentName?: string;
  orderId?: string;
  productName?: string;
  companyName?: string;
  issueSummary?: string;
  ticketId?: string;
}

export interface ScriptStageOutput {
  stage: Stage;
  label: string;
  text: string;
  /** Stage-specific tip the agent can keep in mind. */
  tip?: string;
}

export interface GeneratedScript {
  scenario: Scenario;
  channel: Channel;
  tone: Tone;
  stages: ScriptStageOutput[];
  variablesUsed: string[];
  variablesMissing: string[];
  warnings: string[];
  /** Flagged for human/legal review when scenario triggers compliance concerns. */
  complianceFlag: boolean;
}

export interface BrandVoice {
  name: string;
  /** e.g., "warm, expert, plain-spoken". */
  traits: string[];
  /** Phrases to avoid. */
  avoid: string[];
  /** Signature phrase appended to closings (e.g., "The Acme Team"). */
  signature: string;
}

export interface MacroEntry {
  id: string;
  name: string;
  scenario: Scenario;
  channel: Channel;
  tone: Tone;
  text: string;
  ts: number;
}

export interface HistoryEntry {
  ts: number;
  scenario: Scenario;
  channel: Channel;
  tone: Tone;
  issueSummary: string;
  preview: string;
}

export interface ShareState {
  scenario: Scenario;
  channel: Channel;
  tone: Tone;
  vars: Partial<ScriptVariables>;
}

export interface LlmEnhancement {
  opener: string;
  acknowledgment: string;
  resolution: string;
  objectionHandling: string;
  closing: string;
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-customer-support-script-writer:history";
export const HISTORY_MAX = 20;
export const MACRO_KEY = "unqtools:ai-customer-support-script-writer:macros";
export const MACRO_MAX = 50;
export const LLM_KEY_STORAGE = "unqtools:ai-customer-support-script-writer:llm-key";

export const SCENARIO_LABELS: Record<Scenario, string> = {
  "refund-request": "Refund Request",
  "complaint-escalation": "Complaint / Escalation",
  "technical-issue": "Technical Issue",
  "cancellation": "Cancellation / Retention",
  "billing-dispute": "Billing Dispute",
  "outage-acknowledgment": "Outage Acknowledgment",
  "upsell": "Upsell / Cross-sell",
  "onboarding": "Onboarding / Welcome",
  "feature-request": "Feature Request",
  "shipping-delay": "Shipping Delay",
  "account-reactivation": "Account Reactivation",
  "password-reset": "Password Reset",
};

export const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  "refund-request": "Customer asks for a refund — verify eligibility, communicate policy, issue or decline gracefully.",
  "complaint-escalation": "Customer is upset and asks to escalate — acknowledge, de-escalate, route to the right team.",
  "technical-issue": "Customer reports a bug or technical issue — reproduce, gather details, propose workaround or fix.",
  "cancellation": "Customer wants to cancel — acknowledge, understand why, offer retention options if appropriate, process cancellation.",
  "billing-dispute": "Customer disputes a charge — verify, explain, refund or escalate to billing.",
  "outage-acknowledgment": "Service is down — acknowledge, share status, set expectations.",
  "upsell": "Customer is happy — offer an upgrade or add-on relevant to their usage.",
  "onboarding": "New customer — welcome, set up, point to resources.",
  "feature-request": "Customer asks for a feature — log it, explain roadmap timing honestly.",
  "shipping-delay": "Order is delayed — apologize, give a new ETA, offer remedy if warranted.",
  "account-reactivation": "Customer wants to reactivate a closed account — verify identity, restore access.",
  "password-reset": "Customer can't log in — verify identity, send secure reset link.",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  chat: "Live Chat",
  email: "Email",
  phone: "Phone",
};

export const TONE_LABELS: Record<Tone, string> = {
  empathetic: "Empathetic",
  formal: "Formal",
  friendly: "Friendly",
};

export const STAGE_LABELS: Record<Stage, string> = {
  opener: "Opener",
  acknowledgment: "Acknowledgment",
  investigation: "Investigation",
  resolution: "Resolution",
  "objection-handling": "Objection Handling",
  closing: "Closing",
};

export const SCENARIO_LIST = Object.keys(SCENARIO_LABELS) as Scenario[];

export const VARIABLE_FIELDS: Array<{ key: keyof ScriptVariables; label: string; placeholder: string }> = [
  { key: "customerName", label: "Customer name", placeholder: "Jane" },
  { key: "agentName", label: "Agent name", placeholder: "Sam" },
  { key: "orderId", label: "Order ID", placeholder: "ORD-12345" },
  { key: "productName", label: "Product / Service", placeholder: "Acme Pro plan" },
  { key: "companyName", label: "Company name", placeholder: "Acme Inc." },
  { key: "issueSummary", label: "Issue summary", placeholder: "Order arrived damaged" },
  { key: "ticketId", label: "Ticket ID", placeholder: "TKT-789" },
];

/** Default brand voice (user can override). */
export const DEFAULT_BRAND_VOICE: BrandVoice = {
  name: "Default",
  traits: ["warm", "expert", "plain-spoken"],
  avoid: ["legalese", "robotic", "blaming"],
  signature: "— The Support Team",
};

/**
 * De-escalation preset phrases — replace charged language with calmer
 * alternatives. Used by the `deEscalate` and `positiveLanguageRewrite`
 * functions.
 */
export const DE_ESCALATION_PRESETS: Array<{ trigger: RegExp; replacement: string; why: string }> = [
  { trigger: /\bthat'?s our policy\b/i, replacement: "Here's how our policy applies here, and what I can do within it", why: "Cites policy without sounding dismissive." },
  { trigger: /\byou have to\b/i, replacement: "The next step is for you to", why: "Removes imperative tone." },
  { trigger: /\byou (?:should|must|need to) have\b/i, replacement: "It would help if", why: "Removes blame from the customer." },
  { trigger: /\bthat'?s not our fault\b/i, replacement: "Let's figure out what we can do from here", why: "Avoids defensiveness." },
  { trigger: /\bcalm down\b/i, replacement: "I hear you, and I want to help", why: "'Calm down' escalates." },
  { trigger: /\bas (?:I|we) (?:said|mentioned|explained)\b/i, replacement: "Just to recap", why: "Sounds patient instead of annoyed." },
  { trigger: /\bno,? you'?re wrong\b/i, replacement: "Let me check that with you — here's what I'm seeing", why: "Corrects without shaming." },
  { trigger: /\bI can'?t help you\b/i, replacement: "Here's what I'm able to do, and how to get more help", why: "Shows what's possible." },
  { trigger: /\banything else\??\s*$/i, replacement: "What else can I help you with today?", why: "Open question feels warmer than 'anything else?'." },
  { trigger: /\bunfortunately\b/i, replacement: "Here's the situation", why: "'Unfortunately' signals bad news; lead with the situation." },
  { trigger: /\bas per my last email\b/i, replacement: "Following up on my earlier note", why: "Less passive-aggressive." },
  { trigger: /\bplease advise\b/i, replacement: "Could you let me know how you'd like to proceed?", why: "Asks a clear question." },
  { trigger: /\bdo the needful\b/i, replacement: "Could you take the next step on this?", why: "Clearer than jargon." },
  { trigger: /\bnot our problem\b/i, replacement: "That part sits outside what we own, but here's who can help", why: "Routes without dismissing." },
  { trigger: /\bwrong\b/i, replacement: "doesn't match what I'm seeing", why: "Softer framing." },
  { trigger: /\bstupid\b/i, replacement: "tricky", why: "Removes insult." },
  { trigger: /\bdumb\b/i, replacement: "confusing", why: "Removes insult." },
  { trigger: /\bimpossible\b/i, replacement: "not something we can do today", why: "Softens absolute language." },
  { trigger: /\bnever\b/i, replacement: "rarely", why: "Avoids overstatement." },
  { trigger: /\balways\b/i, replacement: "usually", why: "Avoids overstatement." },
];

/** Honesty-linter: phrases that signal weak or weasel-y support copy. */
export const WEAK_PHRASES: Array<{ trigger: RegExp; suggestion: string }> = [
  { trigger: /\bworld[- ]class\b/i, suggestion: "Replace with a specific proof point (e.g., '24/7 live agents'). 'World-class' is meaningless." },
  { trigger: /\bbest (?:in|of) (?:the )?(?:class|world|breed)\b/i, suggestion: "Replace with a concrete comparison or metric." },
  { trigger: /\brevolutionary\b/i, suggestion: "Replace with a specific user outcome." },
  { trigger: /\bcutting[- ]edge\b/i, suggestion: "Replace with the actual capability or version." },
  { trigger: /\bgame[- ]changer\b/i, suggestion: "Replace with a measurable benefit." },
  { trigger: /\bseamless(?:ly)?\b/i, suggestion: "Show what's actually seamless — seconds saved, steps removed." },
  { trigger: /\brocket science\b/i, suggestion: "Drop; explain in plain terms." },
  { trigger: /\bhonestly,?\s+(?:I|we)\b/i, suggestion: "'Honestly' can imply the rest wasn't. State the fact directly." },
  { trigger: /\btrust me\b/i, suggestion: "Show the evidence instead." },
];

// ---------- Stage template library ----------
//
// Each scenario has 6 stages × 3 tones. Templates use {{var}} placeholders.
// Channel suffix is appended by `applyChannel`.

type StageTemplates = Record<Stage, Record<Tone, string>>;

const SCENARIO_TEMPLATES: Record<Scenario, StageTemplates> = {
  "refund-request": {
    opener: {
      empathetic: "Hi {{customerName}}, this is {{agentName}} from {{companyName}}. I'm really sorry the {{productName}} didn't work out — I'll help you with the refund today.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I'll be processing your refund request for order {{orderId}}.",
      friendly: "Hey {{customerName}}, {{agentName}} here from {{companyName}}! Sorry to hear the {{productName}} wasn't right — let's get your refund sorted.",
    },
    acknowledgment: {
      empathetic: "I completely understand wanting a refund when something doesn't meet expectations. Your frustration is valid.",
      formal: "Your refund request has been received and acknowledged. We take these requests seriously.",
      friendly: "Totally fair to ask for a refund here. Thanks for flagging it.",
    },
    investigation: {
      empathetic: "So I can move quickly, could you confirm the order ID {{orderId}} and share a sentence on what went wrong with the {{productName}}?",
      formal: "Please confirm the order number and a brief description of the issue so I can verify eligibility under our refund policy.",
      friendly: "Quick check — is the order ID {{orderId}} correct? And what specifically didn't work for you?",
    },
    resolution: {
      empathetic: "I've reviewed your account, and your order qualifies for a full refund. You'll see the funds back on your original payment method within 3–5 business days. I'll email a confirmation to you now.",
      formal: "Your order meets the criteria for a full refund. The refund has been initiated to your original payment method and will settle within 3–5 business days. A confirmation email will follow.",
      friendly: "Good news — your refund is approved! The money will be back on your card in 3–5 business days, and I'll send a confirmation email right now.",
    },
    "objection-handling": {
      empathetic: "If you'd prefer, I can offer store credit plus a 10% courtesy on top, or a replacement shipped overnight at no charge — whichever works best for you.",
      formal: "Alternatively, we can offer store credit with a 10% courtesy adjustment, or an expedited replacement. Please advise on your preference.",
      friendly: "Heads up — you also have options: store credit + 10% bonus, or a free overnight replacement. Your call!",
    },
    closing: {
      empathetic: "Again, I'm sorry for the hassle. Is there anything else I can help with today? You can reply to this thread any time.",
      formal: "Thank you for your patience. If you require further assistance, please reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks for your patience, {{customerName}}! Anything else I can help with? Just reply here anytime. {{signature}}",
    },
  },
  "complaint-escalation": {
    opener: {
      empathetic: "Hi {{customerName}}, this is {{agentName}}. I've read your message and I want you to know I'm taking this seriously. I'm here to help make it right.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. Your complaint has been escalated to me and I will be your point of contact.",
      friendly: "Hi {{customerName}}, {{agentName}} here. I've read your note and I want to help fix this. Let's work through it together.",
    },
    acknowledgment: {
      empathetic: "I hear how frustrating this has been, and I'm sorry you've had to chase this. That's not the experience we want for you.",
      formal: "Your frustration is acknowledged. The experience you described does not meet our standards and I will address it.",
      friendly: "That sounds really frustrating — I'm sorry it's been such a runaround.",
    },
    investigation: {
      empathetic: "So I can give you a clear answer, can you walk me through what happened in order, and share any order IDs or ticket numbers you have?",
      formal: "To investigate thoroughly, please provide the timeline of events and any associated order or ticket identifiers.",
      friendly: "Quick favor — can you walk me through what happened in order, with any order/ticket IDs you have?",
    },
    resolution: {
      empathetic: "Here's what I can do: I'm crediting your account {{creditAmount}} as a goodwill gesture, escalating the underlying issue to our engineering team with a 48-hour SLA, and following up personally when it's resolved.",
      formal: "Resolution: (1) Account credit of {{creditAmount}} issued as goodwill. (2) Root cause escalated to engineering with a 48-hour SLA. (3) Personal follow-up from me upon resolution.",
      friendly: "Here's the plan: I'm adding {{creditAmount}} to your account as a goodwill credit, our engineers are on the root cause with a 48-hour SLA, and I'll follow up with you personally when it's fixed.",
    },
    "objection-handling": {
      empathetic: "If the credit feels short, I understand. Tell me what would feel fair, and I'll see what I can do within our authority — or escalate to my manager.",
      formal: "If the proposed remedy is insufficient, please share what you consider fair. I will either accommodate within my authority or escalate to my manager.",
      friendly: "If the credit feels low, totally fair — tell me what feels right and I'll either match it or pull in my manager.",
    },
    closing: {
      empathetic: "Thank you for raising this, {{customerName}}. Your feedback helps us improve. I'll be in touch within 48 hours with an update. {{signature}}",
      formal: "Thank you for bringing this to our attention. I will provide an update within 48 hours. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks for raising this, {{customerName}} — it genuinely helps us improve. I'll update you within 48 hours. {{signature}}",
    },
  },
  "technical-issue": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. I'm sorry the {{productName}} isn't behaving as expected — let's get this sorted.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I'll be troubleshooting your technical issue with the {{productName}}.",
      friendly: "Hey {{customerName}}, {{agentName}} here. Sorry the {{productName}} is acting up — let's dig in.",
    },
    acknowledgment: {
      empathetic: "I know how disruptive this is, especially when you're relying on it to get work done.",
      formal: "Your report has been logged. We will work to restore functionality as quickly as possible.",
      friendly: "Bummer that it's not working — let's figure out why.",
    },
    investigation: {
      empathetic: "Could you share what you were doing when it happened, the exact error message (screenshot helps), your browser/app version, and roughly when it started?",
      formal: "Please provide: steps to reproduce, exact error message, client version, and approximate start time.",
      friendly: "Quick details that'll help: what you clicked, the exact error, your browser/app version, and when it started.",
    },
    resolution: {
      empathetic: "Here's a workaround while we fix the root cause: {{workaround}}. I've also filed ticket {{ticketId}} with engineering and will follow up by {{followUpTime}}.",
      formal: "Workaround: {{workaround}}. Ticket {{ticketId}} has been filed with engineering; follow-up by {{followUpTime}}.",
      friendly: "Try this in the meantime: {{workaround}}. I've filed ticket {{ticketId}} with engineering and will circle back by {{followUpTime}}.",
    },
    "objection-handling": {
      empathetic: "If the workaround doesn't fit your workflow, let me know — I can look for an alternate path or escalate the fix priority.",
      formal: "If the workaround is unsuitable, please advise and I will seek an alternative or escalate priority.",
      friendly: "If the workaround is a no-go for you, say the word — I'll find another path or bump up the fix priority.",
    },
    closing: {
      empathetic: "Thanks for your patience while we sort this out, {{customerName}}. Reply here any time if it acts up again. {{signature}}",
      formal: "Thank you for your patience. Please reply to this thread if the issue recurs. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks for hanging in there, {{customerName}}! Ping me here anytime if it acts up again. {{signature}}",
    },
  },
  "cancellation": {
    opener: {
      empathetic: "Hi {{customerName}}, this is {{agentName}}. I see you'd like to cancel your {{productName}} — I'll take care of that. No pressure, I promise.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I'll process your cancellation request for the {{productName}}.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Sorry to see you go — I'll get your cancellation sorted right away.",
    },
    acknowledgment: {
      empathetic: "Thank you for choosing us in the first place — that means a lot. I want to make sure cancellation is smooth, whatever you decide.",
      formal: "Your cancellation request has been received. We will process it per our policy.",
      friendly: "Thanks for giving us a try! Let's make the cancellation smooth.",
    },
    investigation: {
      empathetic: "If you're open to it, I'd love to know what's driving the cancellation — it genuinely helps us improve. No obligation to continue either way.",
      formal: "May I ask what is prompting the cancellation? Your feedback is recorded for product improvement.",
      friendly: "Quick favor — what's making you cancel? It really helps us improve. No pressure either way.",
    },
    resolution: {
      empathetic: "Your cancellation is processed effective immediately. If it's helpful, I can also pause your account for 60 days (no charge) so you can come back when it's a better fit — your call.",
      formal: "Cancellation is processed effective immediately. Alternatively, we can pause your account for 60 days at no charge.",
      friendly: "Done — your cancellation is processed. Want me to pause the account for 60 days free instead, in case it's a better fit later?",
    },
    "objection-handling": {
      empathetic: "If a 30% discount for the next 3 months would change your mind, I'm authorized to offer that. If not, no problem at all — I'll still cancel cleanly.",
      formal: "I am authorized to offer a 30% discount for the next 3 months should you wish to continue. If not, the cancellation stands.",
      friendly: "Heads up — I can offer 30% off for 3 months if you'd like to stay. If not, no worries at all, we'll cancel cleanly.",
    },
    closing: {
      empathetic: "Thanks for the chance, {{customerName}}. We'd love to welcome you back any time. Anything else I can do today? {{signature}}",
      formal: "Thank you for your time, {{customerName}}. You are welcome to return at any time. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks for the chance, {{customerName}}! Door's always open. Anything else I can help with? {{signature}}",
    },
  },
  "billing-dispute": {
    opener: {
      empathetic: "Hi {{customerName}}, this is {{agentName}}. I see you have a question about a charge — let's take a look together.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I'll review the disputed charge on your account.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Let's sort out that charge you're seeing.",
    },
    acknowledgment: {
      empathetic: "Unexpected charges are stressful — I'd want clarity too. Let's figure out what happened.",
      formal: "Your billing dispute has been received and is under review.",
      friendly: "Unexpected charges are the worst — let's get to the bottom of it.",
    },
    investigation: {
      empathetic: "Could you share the date and amount of the charge you're disputing, and the last 4 digits of the card? I'll pull up the invoice on my end.",
      formal: "Please provide the date, amount, and last 4 digits of the card for the disputed charge. I will retrieve the corresponding invoice.",
      friendly: "Quick details please: date and amount of the charge, plus the last 4 digits of the card. I'll pull the invoice.",
    },
    resolution: {
      empathetic: "I've reviewed the charge — it looks like {{chargeExplanation}}. If this was an error on our side, I'll refund it immediately; if it's valid, I'll walk you through the invoice line by line.",
      formal: "Review complete: {{chargeExplanation}}. If the charge is in error, a refund will be issued. If valid, I will walk you through the invoice.",
      friendly: "Here's what I found: {{chargeExplanation}}. If it's our mistake, I'll refund it on the spot. If it's valid, I'll walk you through the invoice.",
    },
    "objection-handling": {
      empathetic: "If you still disagree after seeing the breakdown, I can escalate to our billing lead for a second look — no questions asked.",
      formal: "If you disagree after reviewing the breakdown, I can escalate to our billing lead for further review.",
      friendly: "Still doesn't look right? I can escalate to our billing lead for a second look — no problem.",
    },
    closing: {
      empathetic: "Thanks for catching this, {{customerName}}. Receipt {{receiptId}} has been emailed. Anything else I can help with? {{signature}}",
      formal: "Thank you for raising this. Receipt {{receiptId}} has been emailed. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks for catching this, {{customerName}}! Receipt {{receiptId}} is in your inbox. Anything else? {{signature}}",
    },
  },
  "outage-acknowledgment": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. You're not alone — we're seeing the issue too and engineers are on it right now.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. We are aware of the service disruption and engineering is engaged.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Yep, we're seeing the issue too — engineers are on it.",
    },
    acknowledgment: {
      empathetic: "I know this disrupts your day, and I'm sorry. Thank you for your patience while we fix it.",
      formal: "We acknowledge the disruption and apologize for the impact to your workflow.",
      friendly: "Sorry for the hassle — thanks for hanging in there.",
    },
    investigation: {
      empathetic: "Current status: {{outageStatus}}. Estimated recovery: {{eta}}. I'll keep you posted as we learn more.",
      formal: "Status: {{outageStatus}}. Estimated recovery: {{eta}}. Updates will be provided as available.",
      friendly: "Status: {{outageStatus}}. ETA: {{eta}}. I'll keep you posted.",
    },
    resolution: {
      empathetic: "Service is restored as of {{restoredAt}}. We're crediting affected accounts {{creditAmount}} as a goodwill gesture — no action needed on your part.",
      formal: "Service was restored at {{restoredAt}}. Affected accounts will receive a goodwill credit of {{creditAmount}}.",
      friendly: "We're back up as of {{restoredAt}}! Affected accounts are getting a {{creditAmount}} goodwill credit — automatic, nothing for you to do.",
    },
    "objection-handling": {
      empathetic: "If the credit feels insufficient given your impact, tell me what you lost and I'll escalate for additional consideration.",
      formal: "If the credit is insufficient, please describe the impact and I will escalate for additional consideration.",
      friendly: "Credit not enough for the impact? Tell me what you lost and I'll escalate.",
    },
    closing: {
      empathetic: "Thank you for bearing with us, {{customerName}}. Post-mortem will be published on our status page within 5 business days. {{signature}}",
      formal: "Thank you for your patience. A post-mortem will be published on our status page within 5 business days. {{signature}}",
      friendly: "Thanks for bearing with us, {{customerName}}! Post-mortem will be on our status page within 5 business days. {{signature}}",
    },
  },
  "upsell": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. I noticed you've been getting great value from the {{productName}} — wanted to share something that might fit.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. Based on your usage, I'd like to suggest an upgrade.",
      friendly: "Hi {{customerName}}, {{agentName}} here! You've been rocking the {{productName}} — thought you might like a peek at what's next.",
    },
    acknowledgment: {
      empathetic: "I want this to be useful, not pushy. If it's not a fit, no problem at all.",
      formal: "Please consider this an informational offer; there is no obligation.",
      friendly: "No pressure at all — just thought it might be a fit.",
    },
    investigation: {
      empathetic: "Your usage shows you're hitting {{usagePattern}}. The {{upgradeName}} plan is designed for exactly that — here's what you'd get.",
      formal: "Your usage pattern indicates {{usagePattern}}. The {{upgradeName}} plan is appropriate for this profile. Features: {{upgradeFeatures}}.",
      friendly: "Your usage says you're hitting {{usagePattern}}. The {{upgradeName}} plan is built for that — here's what's in it.",
    },
    resolution: {
      empathetic: "If you'd like, I can switch you today with the first 30 days free and prorate the rest — you'd see {{monthlyDelta}} more per month after that.",
      formal: "I can migrate you today with 30 days free and prorated billing thereafter. The net increase is {{monthlyDelta}} per month.",
      friendly: "Want me to switch you today? First 30 days free, then {{monthlyDelta}} more per month, prorated.",
    },
    "objection-handling": {
      empathetic: "If now isn't right, I totally get it — want me to set a reminder to revisit in 3 months, or share a comparison sheet so you can think it over?",
      formal: "If now is not suitable, I can set a reminder to revisit in 3 months or send a comparison sheet for your review.",
      friendly: "Not the right moment? No sweat — want a reminder in 3 months, or a comparison sheet to think it over?",
    },
    closing: {
      empathetic: "Either way, thanks for being a customer, {{customerName}}. Let me know what you'd like to do. {{signature}}",
      formal: "Thank you for your continued business. Please let me know your preference. {{signature}}",
      friendly: "Either way, thanks for being with us, {{customerName}}! Let me know what you'd like to do. {{signature}}",
    },
  },
  "onboarding": {
    opener: {
      empathetic: "Welcome to {{companyName}}, {{customerName}}! I'm {{agentName}} — I'll be your guide as you get set up.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. Welcome aboard — I'll be assisting with your onboarding.",
      friendly: "Hey {{customerName}}, welcome to {{companyName}}! I'm {{agentName}} — here to get you up and running.",
    },
    acknowledgment: {
      empathetic: "Getting started with something new can feel like a lot — I'll keep it simple and answer anything along the way.",
      formal: "We are committed to a smooth onboarding experience. Please ask questions at any point.",
      friendly: "New tools can be a lot — I'll keep it simple. Ask me anything!",
    },
    investigation: {
      empathetic: "Quick question — what's the first thing you'd like to accomplish with the {{productName}}? I'll tailor the setup to that.",
      formal: "Please share your primary goal with the {{productName}} so I can tailor the setup.",
      friendly: "Quick one — what's the first thing you want to do with the {{productName}}? I'll set you up around that.",
    },
    resolution: {
      empathetic: "Here's the fastest path: {{onboardingStep1}}, then {{onboardingStep2}}, then {{onboardingStep3}}. I've emailed you a checklist with screenshots.",
      formal: "Recommended path: {{onboardingStep1}}, then {{onboardingStep2}}, then {{onboardingStep3}}. A checklist with screenshots has been emailed.",
      friendly: "Fastest path: {{onboardingStep1}}, then {{onboardingStep2}}, then {{onboardingStep3}}. I just emailed you a checklist with screenshots.",
    },
    "objection-handling": {
      empathetic: "If you get stuck, the in-app chat (bottom-right) is staffed 24/7, and you can book a 1:1 with me at {{bookingLink}} any time.",
      formal: "For assistance, in-app chat is available 24/7. You may also book a 1:1 at {{bookingLink}}.",
      friendly: "Stuck? In-app chat (bottom-right) is 24/7, and you can book a 1:1 with me at {{bookingLink}}.",
    },
    closing: {
      empathetic: "So glad to have you with us, {{customerName}}. Reach out any time — I'm here to help you succeed. {{signature}}",
      formal: "Welcome again. Please reach out any time. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Stoked to have you, {{customerName}}! Reach out any time. {{signature}}",
    },
  },
  "feature-request": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. Thanks for taking the time to share a feature idea — your input genuinely shapes the roadmap.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. Thank you for submitting a feature request.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Love that you took the time to send a feature idea — thank you!",
    },
    acknowledgment: {
      empathetic: "I've logged this in our product backlog with your account attached so we can circle back if we ship it.",
      formal: "Your request has been logged in our product backlog and tagged to your account for follow-up.",
      friendly: "Logged it in our backlog with your account tagged — we'll circle back if we ship it.",
    },
    investigation: {
      empathetic: "To make sure I capture it right, here's my understanding: {{featureSummary}}. Did I get that right, and what's the main outcome you're after?",
      formal: "To confirm: {{featureSummary}}. Is this accurate? What is the primary outcome you seek?",
      friendly: "Just to confirm I've got it: {{featureSummary}}. Right? And what's the main outcome you want?",
    },
    resolution: {
      empathetic: "Here's an honest read: this isn't on the near-term roadmap (next 90 days), but it's a strong fit for the quarter after. In the meantime, here's a workaround: {{workaround}}.",
      formal: "Honest assessment: not on the 90-day roadmap; strong candidate for the following quarter. Workaround in the meantime: {{workaround}}.",
      friendly: "Honest read: not in the next 90 days, but a strong fit for the quarter after. Workaround for now: {{workaround}}.",
    },
    "objection-handling": {
      empathetic: "If the workaround doesn't fit, I can tag your request as blocking and route it to product for a closer look — no promises, but it raises the visibility.",
      formal: "If the workaround is insufficient, I can tag your request as blocking and route to product for review.",
      friendly: "Workaround not cutting it? I can tag it as blocking and send to product — no promises, but it bumps the visibility.",
    },
    closing: {
      empathetic: "Thanks again for the idea, {{customerName}}. I'll update this thread when there's roadmap news. {{signature}}",
      formal: "Thank you for the input. I will update this thread when there is roadmap news. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Thanks again for the idea, {{customerName}}! I'll ping this thread when there's roadmap news. {{signature}}",
    },
  },
  "shipping-delay": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. I'm really sorry your order {{orderId}} hasn't arrived yet — let me find out what's going on.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I'm investigating the delay on order {{orderId}}.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Sorry your order {{orderId}} is taking longer than expected — let's find out why.",
    },
    acknowledgment: {
      empathetic: "Waiting on something you've already paid for is frustrating — I'd feel the same way.",
      formal: "The delay is acknowledged. We apologize for the inconvenience.",
      friendly: "Waiting on something you've paid for is the worst — totally get it.",
    },
    investigation: {
      empathetic: "I've pulled up the tracking — here's what I see: {{trackingStatus}}. Estimated delivery is now {{newEta}}.",
      formal: "Tracking shows: {{trackingStatus}}. Revised ETA: {{newEta}}.",
      friendly: "Tracking says: {{trackingStatus}}. New ETA: {{newEta}}.",
    },
    resolution: {
      empathetic: "Here's what I can do: I'll waive the shipping fee on this order, email you a tracking link with proactive updates, and add a {{creditAmount}} store credit for the hassle.",
      formal: "Resolution: shipping fee waived, proactive tracking updates emailed, and a {{creditAmount}} store credit issued as goodwill.",
      friendly: "Here's what I'll do: refund the shipping fee, email you proactive tracking updates, and add {{creditAmount}} in store credit for the hassle.",
    },
    "objection-handling": {
      empathetic: "If you'd rather cancel for a full refund instead, I can do that right now — your call.",
      formal: "If you prefer, I can cancel the order for a full refund now.",
      friendly: "Want to cancel for a full refund instead? I can do that right now — your call.",
    },
    closing: {
      empathetic: "Thanks for your patience, {{customerName}}. Reply here any time and I'll respond within an hour during business hours. {{signature}}",
      formal: "Thank you for your patience. Reply to this thread for a response within one business hour. {{signature}}",
      friendly: "Thanks for your patience, {{customerName}}! Reply here any time — I'll get back within an hour during business hours. {{signature}}",
    },
  },
  "account-reactivation": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. Welcome back — I'd be glad to help you reactivate your account.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I can assist with reactiv your account.",
      friendly: "Hi {{customerName}}, {{agentName}} here! Welcome back — let's get your account reactivated.",
    },
    acknowledgment: {
      empathetic: "Thanks for coming back — I want to make this smooth. First I need to verify it's really you, then we're good to go.",
      formal: "Thank you for returning. Identity verification is required before reactivation can proceed.",
      friendly: "Thanks for coming back! Quick identity check, then we're off to the races.",
    },
    investigation: {
      empathetic: "Can you confirm the email address on the account, and the approximate date you last logged in? I'll match it on my end.",
      formal: "Please confirm the account email address and approximate last-login date for verification.",
      friendly: "Quick check — confirm the email on the account and roughly when you last logged in?",
    },
    resolution: {
      empathetic: "Identity verified — your account is reactivated as of now. I've emailed a fresh sign-in link (valid for 24 hours) and reset your security questions for safety.",
      formal: "Identity verified. Account reactivated. A fresh sign-in link (valid 24 hours) has been emailed and security questions have been reset.",
      friendly: "Verified — your account is back on! I've emailed a fresh sign-in link (24-hour expiry) and reset your security questions.",
    },
    "objection-handling": {
      empathetic: "If you'd prefer to start fresh with a new account instead, I can do that and migrate your data over — just say the word.",
      formal: "Alternatively, I can create a new account and migrate your data. Please advise.",
      friendly: "Want to start fresh with a new account instead? I can do that and migrate your data over — just say.",
    },
    closing: {
      empathetic: "Welcome back, {{customerName}}! Anything else I can help with? Reply here any time. {{signature}}",
      formal: "Welcome back. If you need anything else, please reply here. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Welcome back, {{customerName}}! Anything else I can help with? Just reply here. {{signature}}",
    },
  },
  "password-reset": {
    opener: {
      empathetic: "Hi {{customerName}}, {{agentName}} here. Locked out is the worst — let's get you back in.",
      formal: "Good {{timeOfDay}}, {{customerName}}. This is {{agentName}} at {{companyName}}. I can assist with resetting your password.",
      friendly: "Hi {{customerName}}, {{agentName}} here. Locked out? Let's fix that.",
    },
    acknowledgment: {
      empathetic: "Thanks for verifying it's you — security first, then we'll get you in.",
      formal: "Identity verification is required before a password reset can be issued.",
      friendly: "Quick security check, then we'll get you back in.",
    },
    investigation: {
      empathetic: "Can you confirm the email on the account, and the last 4 digits of the billing card on file? I'll match on my end.",
      formal: "Please confirm the account email and last 4 digits of the billing card on file.",
      friendly: "Quick one: confirm the account email and the last 4 digits of the billing card on file?",
    },
    resolution: {
      empathetic: "Verified — I've just sent a secure password-reset link to your email. It's valid for 30 minutes. Once you reset, you'll be back in immediately.",
      formal: "Identity verified. A secure password-reset link has been emailed; valid for 30 minutes. Reset to regain access.",
      friendly: "Verified! Secure password-reset link sent to your email — valid 30 minutes. Once you reset, you're back in.",
    },
    "objection-handling": {
      empathetic: "If you don't see the email within 5 minutes, check spam, and if it's still not there, I can resend it or try an alternate email on file.",
      formal: "If the email does not arrive within 5 minutes, check spam. I can resend or send to an alternate email on file.",
      friendly: "Don't see the email in 5 minutes? Check spam. If still missing, I can resend or try an alternate email.",
    },
    closing: {
      empathetic: "Welcome back, {{customerName}}! I'd recommend turning on two-factor authentication to avoid this in future — want me to send setup steps? {{signature}}",
      formal: "Welcome back. We recommend enabling two-factor authentication. Reference ticket {{ticketId}}. {{signature}}",
      friendly: "Welcome back, {{customerName}}! Want me to send 2FA setup steps so this doesn't happen again? {{signature}}",
    },
  },
};

// ---------- Variable helpers ----------

/** Extract {{var}} placeholders from a template string. */
export function extractVariables(template: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) out.add(m[1]);
  return Array.from(out);
}

/** Replace {{var}} placeholders with values; missing ones left as {{var}}. */
export function applyVariables(template: string, vars: ScriptVariables): string {
  let out = template;
  const present = extractVariables(template);
  for (const name of present) {
    const value = (vars as Record<string, string | undefined>)[name];
    const re = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g");
    out = out.replace(re, value && value.trim() ? value.trim() : `{{${name}}}`);
  }
  // Special: {{timeOfDay}} auto-derives from the current hour.
  out = out.replace(/\{\{\s*timeOfDay\s*\}\}/g, getTimeOfDay());
  return out;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** Return variable names used in a template that are missing from `vars`. */
export function detectMissingVariables(template: string, vars: ScriptVariables): string[] {
  const used = extractVariables(template);
  return used.filter((name) => {
    if (name === "timeOfDay") return false; // auto-derived
    const v = (vars as Record<string, string | undefined>)[name];
    return !v || !v.trim();
  });
}

/** Return variable names used across all stages of a generated script. */
export function variablesUsed(stages: { text: string }[]): string[] {
  const all = new Set<string>();
  for (const s of stages) {
    for (const v of extractVariables(s.text)) {
      if (v !== "timeOfDay") all.add(v);
    }
  }
  return Array.from(all).sort();
}

// ---------- Channel adaptation ----------

/** Append a channel-appropriate suffix (e.g., signature line for email). */
export function applyChannel(text: string, channel: Channel, signature: string): string {
  if (channel === "email") {
    return text.endsWith("\n") ? `${text}${signature}` : `${text}\n\n${signature}`;
  }
  if (channel === "phone") {
    return text;
  }
  // chat — strip trailing signature lines that were inlined.
  return text.replace(/\n+\s*—\s.*$/, "");
}

// ---------- Generation ----------

/** Build a full staged script. */
export function generateScript(
  scenario: Scenario,
  channel: Channel,
  tone: Tone,
  vars: ScriptVariables,
  brandVoice: BrandVoice = DEFAULT_BRAND_VOICE,
): GeneratedScript {
  const templates = SCENARIO_TEMPLATES[scenario];
  // Capture variable usage from the ORIGINAL templates (before substitution)
  // so we can report which variables the script references.
  const usedSet = new Set<string>();
  for (const stage of Object.keys(STAGE_LABELS) as Stage[]) {
    for (const v of extractVariables(templates[stage][tone])) {
      if (v !== "timeOfDay") usedSet.add(v);
    }
  }

  const stages: ScriptStageOutput[] = (Object.keys(STAGE_LABELS) as Stage[]).map((stage) => {
    const tpl = templates[stage][tone];
    const withVars = applyVariables(tpl, vars);
    const withChannel = applyChannel(withVars, channel, brandVoice.signature);
    return {
      stage,
      label: STAGE_LABELS[stage],
      text: withChannel,
      tip: STAGE_TIPS[stage],
    };
  });

  const missing = new Set<string>();
  for (const stage of Object.keys(STAGE_LABELS) as Stage[]) {
    for (const v of detectMissingVariables(templates[stage][tone], vars)) missing.add(v);
  }

  const warnings: string[] = [];
  if (missing.size > 0) {
    warnings.push(`Missing variables: ${Array.from(missing).join(", ")}. Fill them in or the script will show {{placeholder}} tokens.`);
  }
  // Honesty-linter weak-phrase check (check post-substitution text).
  for (const s of stages) {
    for (const wp of WEAK_PHRASES) {
      if (wp.trigger.test(s.text)) {
        warnings.push(`Stage '${s.label}' contains weak phrasing. ${wp.suggestion}`);
        break;
      }
    }
  }
  // Brand-voice avoid check.
  for (const term of brandVoice.avoid) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    for (const s of stages) {
      if (re.test(s.text)) {
        warnings.push(`Brand voice avoid-list hit: '${term}' in stage '${s.label}'.`);
      }
    }
  }

  const complianceFlag = COMPLIANCE_SCENARIOS.has(scenario);

  return {
    scenario,
    channel,
    tone,
    stages,
    variablesUsed: Array.from(usedSet).sort(),
    variablesMissing: Array.from(missing).sort(),
    warnings,
    complianceFlag,
  };
}

const STAGE_TIPS: Record<Stage, string> = {
  opener: "Acknowledge the human first, the issue second.",
  acknowledgment: "Validate the feeling without admitting fault.",
  investigation: "Ask one question at a time; never interrogate.",
  resolution: "Lead with what you can do, not what you can't.",
  "objection-handling": "Offer a specific alternative — vague options sound evasive.",
  closing: "End on warmth and an open door.",
};

const COMPLIANCE_SCENARIOS: Set<Scenario> = new Set<Scenario>([
  "complaint-escalation",
  "billing-dispute",
  "cancellation",
  "refund-request",
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- De-escalation / positive language ----------

/** Apply de-escalation presets to a block of text. Returns rewritten text + hits. */
export function deEscalate(text: string): { text: string; hits: Array<{ trigger: string; replacement: string; why: string }> } {
  let out = text;
  const hits: Array<{ trigger: string; replacement: string; why: string }> = [];
  for (const preset of DE_ESCALATION_PRESETS) {
    if (preset.trigger.test(out)) {
      const triggerStr = preset.trigger.source;
      out = out.replace(preset.trigger, preset.replacement);
      hits.push({ trigger: triggerStr, replacement: preset.replacement, why: preset.why });
    }
  }
  return { text: out, hits };
}

/** Rewrite a block of text with positive-language presets (alias for deEscalate that also catches weak phrases). */
export function positiveLanguageRewrite(text: string): { text: string; hits: string[] } {
  const de = deEscalate(text);
  const hits = de.hits.map((h) => `Replaced: "${h.trigger}" → "${h.replacement}" (${h.why})`);
  // Also flag weak phrases (but don't auto-rewrite — that needs judgment).
  for (const wp of WEAK_PHRASES) {
    if (wp.trigger.test(de.text)) {
      hits.push(`Weak phrase: ${wp.suggestion}`);
    }
  }
  return { text: de.text, hits };
}

// ---------- Rendering ----------

/** Render a script as Markdown. */
export function renderMarkdown(script: GeneratedScript): string {
  const lines: string[] = [];
  lines.push(`# ${SCENARIO_LABELS[script.scenario]} — ${CHANNEL_LABELS[script.channel]} — ${TONE_LABELS[script.tone]}`);
  lines.push("");
  if (script.complianceFlag) {
    lines.push("> ⚠️ **Compliance flag**: this scenario may involve legal/policy concerns. Review with your compliance team before sending.");
    lines.push("");
  }
  if (script.warnings.length > 0) {
    lines.push("## Warnings");
    for (const w of script.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  for (const s of script.stages) {
    lines.push(`## ${s.label}`);
    if (s.tip) lines.push(`> Tip: ${s.tip}`);
    lines.push("");
    lines.push(s.text);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a script as JSON. */
export function renderJson(script: GeneratedScript): string {
  return JSON.stringify(script, null, 2);
}

/** Render a script as a flat plain-text transcript (good for chat). */
export function renderText(script: GeneratedScript): string {
  const lines: string[] = [];
  for (const s of script.stages) {
    lines.push(`[${s.label}]`);
    lines.push(s.text);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

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

// ---------- Macro library (localStorage) ----------

export function loadMacros(): MacroEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MACRO_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MacroEntry[];
    return Array.isArray(arr) ? arr.slice(0, MACRO_MAX) : [];
  } catch {
    return [];
  }
}

export function saveMacro(macro: MacroEntry): MacroEntry[] {
  const next = [macro, ...loadMacros().filter((m) => m.id !== macro.id)].slice(0, MACRO_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(MACRO_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function deleteMacro(id: string): MacroEntry[] {
  const next = loadMacros().filter((m) => m.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(MACRO_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearMacros(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(MACRO_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("scenario", state.scenario);
  params.set("channel", state.channel);
  params.set("tone", state.tone);
  if (state.vars) {
    const nonEmpty = Object.fromEntries(
      Object.entries(state.vars).filter(([, v]) => v && v.trim()),
    );
    if (Object.keys(nonEmpty).length > 0) {
      params.set("vars", JSON.stringify(nonEmpty));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { scenario: "refund-request", channel: "chat", tone: "empathetic", vars: {} };
  const params = new URLSearchParams(clean);
  const scenario = (params.get("scenario") as Scenario) ?? "refund-request";
  const channel = (params.get("channel") as Channel) ?? "chat";
  const tone = (params.get("tone") as Tone) ?? "empathetic";
  let vars: Partial<ScriptVariables> = {};
  const varsRaw = params.get("vars");
  if (varsRaw) {
    try {
      vars = JSON.parse(varsRaw) as Partial<ScriptVariables>;
    } catch {
      vars = {};
    }
  }
  return {
    scenario: SCENARIO_LIST.includes(scenario) ? scenario : "refund-request",
    channel: channel === "email" || channel === "phone" ? channel : "chat",
    tone: tone === "formal" || tone === "friendly" ? tone : "empathetic",
    vars,
  };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(
  scenario: Scenario,
  channel: Channel,
  tone: Tone,
  vars: ScriptVariables,
  issueSummary: string,
): string {
  return [
    "You are an expert customer-support coach. Generate a tone-tuned,",
    "staged support script for the scenario below, using the provided",
    "variables. Return JSON with this exact shape:",
    "",
    "{",
    '  "opener": "string",',
    '  "acknowledgment": "string",',
    '  "resolution": "string",',
    '  "objectionHandling": "string",',
    '  "closing": "string",',
    '  "suggestions": ["improvement tip", ...]',
    "}",
    "",
    "Rules:",
    "- Use the provided variables verbatim where they fit.",
    "- Match the requested tone and channel (chat is short; email is fuller; phone is conversational).",
    "- Empathy first, never blame the customer.",
    "- Be honest about policy limits — do not promise things you cannot keep.",
    "- Flag compliance-sensitive content in suggestions if relevant.",
    "- Do not include markdown fences. Return raw JSON only.",
    "",
    `Scenario: ${scenario}`,
    `Channel: ${channel}`,
    `Tone: ${tone}`,
    `Issue summary: ${issueSummary}`,
    `Variables: ${JSON.stringify(vars)}`,
  ].join("\n");
}

export function renderLlmResult(raw: string): LlmEnhancement {
  const fallback: LlmEnhancement = {
    opener: "",
    acknowledgment: "",
    resolution: "",
    objectionHandling: "",
    closing: "",
    suggestions: [],
  };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<LlmEnhancement>;
    return {
      opener: obj.opener ?? "",
      acknowledgment: obj.acknowledgment ?? "",
      resolution: obj.resolution ?? "",
      objectionHandling: obj.objectionHandling ?? "",
      closing: obj.closing ?? "",
      suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
    };
  } catch {
    return fallback;
  }
}

// ---------- Brand voice storage ----------

export const BRAND_VOICE_KEY = "unqtools:ai-customer-support-script-writer:brand-voice";

export function loadBrandVoice(): BrandVoice {
  if (typeof localStorage === "undefined") return DEFAULT_BRAND_VOICE;
  try {
    const raw = localStorage.getItem(BRAND_VOICE_KEY);
    if (!raw) return DEFAULT_BRAND_VOICE;
    const obj = JSON.parse(raw) as Partial<BrandVoice>;
    return {
      name: obj.name ?? DEFAULT_BRAND_VOICE.name,
      traits: Array.isArray(obj.traits) ? obj.traits : DEFAULT_BRAND_VOICE.traits,
      avoid: Array.isArray(obj.avoid) ? obj.avoid : DEFAULT_BRAND_VOICE.avoid,
      signature: obj.signature ?? DEFAULT_BRAND_VOICE.signature,
    };
  } catch {
    return DEFAULT_BRAND_VOICE;
  }
}

export function saveBrandVoice(voice: BrandVoice): BrandVoice {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(BRAND_VOICE_KEY, JSON.stringify(voice));
    } catch {
      // ignore
    }
  }
  return voice;
}
