/**
 * AI Email Draft Generator — pure logic.
 *
 * Draft professional emails from a short brief or pasted thread using
 * deterministic templates and tone presets. Nine purpose presets
 * (request, follow-up, thank you, apology, announcement, newsletter,
 * intro, decline, cold outreach), five tones (formal, friendly, casual,
 * urgent, persuasive), three lengths (short, medium, long). Compose +
 * Reply modes. Subject-line variants. Bullet-to-prose. Shorten /
 * lengthen. Signature. mailto: + .eml export.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: it's a *draft* — review before sending. No sending backend;
 * nothing is uploaded.
 */

// ---------- Types ----------

export type Mode = "compose" | "reply";
export type Purpose =
  | "request"
  | "follow-up"
  | "thank-you"
  | "apology"
  | "announcement"
  | "newsletter"
  | "intro"
  | "decline"
  | "cold-outreach";
export type Tone = "formal" | "friendly" | "casual" | "urgent" | "persuasive";
export type Length = "short" | "medium" | "long";

export interface Signature {
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface EmailInputs {
  mode: Mode;
  purpose: Purpose;
  tone: Tone;
  length: Length;
  recipientName: string;
  senderName: string;
  brief: string;          // compose mode — what to say
  thread: string;         // reply mode — incoming message(s)
  originalSubject: string; // reply mode — subject of thread being replied to
  signature: Signature;
}

export interface SubjectVariant {
  subject: string;
  style: string; // e.g. "direct", "question", "benefit"
}

export interface EmailDraft {
  subjectVariants: SubjectVariant[];
  primarySubject: string;
  body: string;
  paragraphs: string[];
  signature: string;
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  mode: Mode;
  purpose: Purpose;
  tone: Tone;
  length: Length;
  recipientName: string;
  primarySubject: string;
  bodyPreview: string;
}

export interface ShareState {
  inputs: Partial<EmailInputs>;
}

export interface LlmEnhancement {
  refinedSubject: string;
  refinedBody: string;
  notes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-email-draft-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-email-draft-generator:llm-key";

export const PURPOSE_LABELS: Record<Purpose, string> = {
  "request": "Request",
  "follow-up": "Follow-up",
  "thank-you": "Thank you",
  "apology": "Apology",
  "announcement": "Announcement",
  "newsletter": "Newsletter",
  "intro": "Intro / Outreach",
  "decline": "Decline",
  "cold-outreach": "Cold outreach",
};

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  friendly: "Friendly",
  casual: "Casual",
  urgent: "Urgent",
  persuasive: "Persuasive",
};

export const LENGTH_LABELS: Record<Length, string> = {
  short: "Short (1–2 paragraphs)",
  medium: "Medium (2–3 paragraphs)",
  long: "Long (3–5 paragraphs)",
};

export const LENGTH_PARAGRAPHS: Record<Length, number> = {
  short: 2,
  medium: 3,
  long: 5,
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<keyof EmailInputs, { hint: string; sample: string }> = {
  mode: {
    hint: "Compose = start from a brief. Reply = start from a pasted thread (the tool extracts each point and addresses them).",
    sample: "compose",
  },
  purpose: {
    hint: "Pick the closest preset — each one has its own subject + body templates.",
    sample: "request",
  },
  tone: {
    hint: "Formal (Mr./Ms., full sentences), Friendly (warm), Casual (Hey), Urgent (priority flag), Persuasive (benefit-led).",
    sample: "friendly",
  },
  length: {
    hint: "Short = 1–2 paragraphs. Medium = 2–3. Long = 3–5.",
    sample: "medium",
  },
  recipientName: {
    hint: "The person you're writing to. First name is fine for friendly/casual.",
    sample: "Jordan",
  },
  senderName: {
    hint: "Your name (used in the sign-off).",
    sample: "Alex",
  },
  brief: {
    hint: "Compose mode: 1–3 sentences describing what you want to say. The tool expands this into a full email.",
    sample: "Ask Jordan for feedback on the Q3 roadmap deck by Friday.",
  },
  thread: {
    hint: "Reply mode: paste the incoming email(s) here. The tool extracts each point and drafts a response addressing them.",
    sample: "Hi Alex, two questions: 1) Can we move the call to Thursday? 2) Do you have the latest sales numbers?",
  },
  originalSubject: {
    hint: "Reply mode: the subject of the email you're replying to (used for the 'Re:' subject line).",
    sample: "Q3 roadmap call",
  },
  signature: {
    hint: "Your signature — name, title, email, phone. Appended to the body.",
    sample: "Alex Rivera / Product Manager / alex@acme.com / +1-555-0100",
  },
};

// ---------- Validation ----------

export function validateInputs(inputs: EmailInputs): string[] {
  const notes: string[] = [];
  if (inputs.mode === "compose") {
    if (!inputs.brief || inputs.brief.trim().length < 5) {
      notes.push("Compose mode needs a brief — at least one sentence describing what you want to say.");
    }
    if (inputs.brief && inputs.brief.length > 2000) {
      notes.push("Brief is very long (over 2000 chars) — try to be more concise, the tool will expand it.");
    }
  } else {
    if (!inputs.thread || inputs.thread.trim().length < 5) {
      notes.push("Reply mode needs the incoming thread — paste the email you're replying to.");
    }
    if (!inputs.originalSubject && inputs.mode === "reply") {
      notes.push("Reply mode works best with the original subject — the 'Re:' line will be empty otherwise.");
    }
  }
  if (!inputs.recipientName || inputs.recipientName.trim().length === 0) {
    notes.push("Add a recipient name — even a generic 'team' or 'there' makes the draft more natural.");
  }
  if (!inputs.senderName || inputs.senderName.trim().length === 0) {
    notes.push("Add your name — it's used in the sign-off.");
  }
  return notes;
}

// ---------- Helpers ----------

export function capitalize(s: string): string {
  return s && s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Trim, collapse internal whitespace, strip leading bullets/markdown. */
export function normalizeText(s: string): string {
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip bullets/numbering from a list line. */
export function stripBullet(line: string): string {
  return line
    .replace(/^\s*([-*•]|\d+[.)])\s+/i, "")
    .trim();
}

/** Detect bullet or numbered list lines. */
export function isBulletLine(line: string): boolean {
  return /^\s*([-*•]|\d+[.)])\s+/i.test(line || "");
}

/** Split a brief or thread into clean bullet points / paragraphs. */
export function extractPoints(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  // If any line is a bullet, treat as a list and pull each bullet as a point.
  if (lines.some(isBulletLine)) {
    return lines
      .filter(isBulletLine)
      .map(stripBullet)
      .filter(Boolean);
  }
  // Otherwise split by blank-line-separated paragraphs.
  const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  if (paras.length > 1) return paras;
  // Single paragraph — split by sentence.
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.length > 5);
  return sentences.length > 1 ? sentences : [t];
}

/** Render an array of points as a bullet list. */
export function renderBulletList(points: string[]): string {
  return points.map((p) => `- ${p}`).join("\n");
}

/** Convert a bullet list to a prose paragraph. */
export function bulletsToProse(bullets: string[]): string {
  if (bullets.length === 0) return "";
  if (bullets.length === 1) return bullets[0] + ".";
  const last = bullets[bullets.length - 1];
  const rest = bullets.slice(0, -1);
  return `${rest.join(", ")}, and ${last}.`;
}

/** Wrap text to ~N chars per line (preserves paragraphs). */
export function wrapText(text: string, width = 72): string {
  const paras = text.split(/\n/);
  return paras.map((p) => {
    if (p.trim().length === 0) return "";
    const words = p.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > width) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = (cur + " " + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines.join("\n");
  }).join("\n");
}

// ---------- Tone primitives ----------

export function greeting(tone: Tone, recipientName: string): string {
  const name = recipientName && recipientName.trim() ? recipientName.trim() : "there";
  switch (tone) {
    case "formal":
      return `Dear ${capitalize(name)},`;
    case "friendly":
      return `Hi ${capitalize(name)},`;
    case "casual":
      return `Hey ${capitalize(name)},`;
    case "urgent":
      return `Hi ${capitalize(name)} —`;
    case "persuasive":
      return `Hi ${capitalize(name)},`;
    default:
      return `Hi ${capitalize(name)},`;
  }
}

export function opener(tone: Tone): string {
  switch (tone) {
    case "formal":
      return "I hope this message finds you well.";
    case "friendly":
      return "I hope you're having a good week.";
    case "casual":
      return "Hope you're doing well!";
    case "urgent":
      return "I need your help with something time-sensitive.";
    case "persuasive":
      return "I think you'll find this worthwhile.";
    default:
      return "I hope you're doing well.";
  }
}

export function closer(tone: Tone, senderName: string): string {
  const name = senderName && senderName.trim() ? senderName.trim() : "";
  switch (tone) {
    case "formal":
      return `Thank you for your consideration.\n\nBest regards,\n${capitalize(name)}`;
    case "friendly":
      return `Thanks so much!\n\nCheers,\n${capitalize(name)}`;
    case "casual":
      return `Thanks!\n\n— ${capitalize(name)}`;
    case "urgent":
      return `Thanks for the quick turnaround.\n\n${capitalize(name)}`;
    case "persuasive":
      return `I'd love to hear what you think.\n\nWarmly,\n${capitalize(name)}`;
    default:
      return `Thanks,\n${capitalize(name)}`;
  }
}

export function urgencyPrefix(tone: Tone): string {
  return tone === "urgent" ? "[URGENT] " : "";
}

export function persuasiveFlourish(tone: Tone): string {
  return tone === "persuasive"
    ? "Here's why this is worth your time: "
    : "";
}

// ---------- Subject generation ----------

/** Generate 3 subject-line variants for the email. */
export function generateSubjects(inputs: EmailInputs): SubjectVariant[] {
  const brief = normalizeText(inputs.brief);
  const purpose = inputs.purpose;
  const recipientName = inputs.recipientName || "there";
  const original = inputs.originalSubject || "";

  // Reply mode: Re: <original>
  if (inputs.mode === "reply" && original) {
    return [
      { subject: `Re: ${original}`, style: "standard reply" },
      { subject: `Re: ${original} — quick response`, style: "reply + status" },
      { subject: `Re: ${original} (answers inside)`, style: "reply + summary" },
    ];
  }

  // Try to extract a short topic from the brief (first 5–6 words).
  const topic = brief
    ? brief.split(/\s+/).slice(0, 6).join(" ").replace(/[.!?]+$/, "")
    : "";

  switch (purpose) {
    case "request":
      return [
        { subject: `${urgencyPrefix(inputs.tone)}${topic ? capitalize(topic) : "Quick request"}`, style: "direct" },
        { subject: `${urgencyPrefix(inputs.tone)}Could you help with ${topic || "this"}?`, style: "question" },
        { subject: `${urgencyPrefix(inputs.tone)}Request: ${topic || "your input"}`, style: "labelled" },
      ];
    case "follow-up":
      return [
        { subject: `${urgencyPrefix(inputs.tone)}Following up: ${topic || "our last conversation"}`, style: "direct" },
        { subject: `${urgencyPrefix(inputs.tone)}Quick check-in re: ${topic || "our last chat"}`, style: "soft" },
        { subject: `${urgencyPrefix(inputs.tone)}Any updates on ${topic || "this"}?`, style: "question" },
      ];
    case "thank-you":
      return [
        { subject: `Thank you${topic ? ` — ${topic}` : ""}`, style: "direct" },
        { subject: `Appreciate your help with ${topic || "this"}`, style: "soft" },
        { subject: `Thanks again${topic ? ` for ${topic}` : ""}`, style: "casual" },
      ];
    case "apology":
      return [
        { subject: `Apology${topic ? ` re: ${topic}` : ""}`, style: "direct" },
        { subject: `Sorry about ${topic || "the situation"}`, style: "soft" },
        { subject: `Following up — ${topic || "what happened"} (with an apology)`, style: "explanatory" },
      ];
    case "announcement":
      return [
        { subject: `Announcing ${topic || "our news"}`, style: "direct" },
        { subject: `News: ${topic || "an update from us"}`, style: "labelled" },
        { subject: `${topic ? capitalize(topic) : "Something new"} — now available`, style: "benefit" },
      ];
    case "newsletter":
      return [
        { subject: `Newsletter — ${topic || "this week's update"}`, style: "direct" },
        { subject: `This week: ${topic || "what's new"}`, style: "soft" },
        { subject: `${topic ? capitalize(topic) : "Updates"} + what to read next`, style: "curiosity" },
      ];
    case "intro":
      return [
        { subject: `Introduction${topic ? ` — ${topic}` : ""}`, style: "direct" },
        { subject: `Connecting you with ${topic || "the team"}`, style: "soft" },
        { subject: `Intro: ${recipientName} ↔ ${topic || "the team"}`, style: "labelled" },
      ];
    case "decline":
      return [
        { subject: `Re: ${topic || "your proposal"} — update`, style: "soft" },
        { subject: `Update on ${topic || "your request"}`, style: "neutral" },
        { subject: `Thank you for ${topic || "your note"}`, style: "polite" },
      ];
    case "cold-outreach":
      return [
        { subject: `${urgencyPrefix(inputs.tone)}${persuasiveFlourish(inputs.tone) ? "" : ""}${topic ? capitalize(topic) : "Quick question"}`, style: "direct" },
        { subject: `${topic ? capitalize(topic) : "Idea"} — worth 2 minutes?`, style: "question" },
        { subject: `For ${recipientName}: ${topic || "an idea"}`, style: "personal" },
      ];
    default:
      return [
        { subject: topic ? capitalize(topic) : "Email", style: "direct" },
        { subject: `Quick note: ${topic || "hello"}`, style: "soft" },
        { subject: `${topic ? capitalize(topic) : "Update"} — for your review`, style: "labelled" },
      ];
  }
}

// ---------- Body generation ----------

/**
 * Build the body paragraphs (excluding greeting, closer, signature).
 * Honors the length preset (1–2 / 2–3 / 3–5 paragraphs).
 */
export function generateBodyParagraphs(inputs: EmailInputs): string[] {
  const brief = normalizeText(inputs.brief);
  const tone = inputs.tone;
  const recipientName = inputs.recipientName || "there";
  const target = LENGTH_PARAGRAPHS[inputs.length];
  const paras: string[] = [];

  // Always start with the opener (1 paragraph used).
  paras.push(opener(tone));

  if (inputs.mode === "reply") {
    const points = extractPoints(inputs.thread);
    if (points.length > 0) {
      // Acknowledge the thread.
      paras.push(`Thanks for your note${inputs.originalSubject ? ` about "${inputs.originalSubject}"` : ""}. I want to address each point you raised.`);
      // Address each point — one paragraph per point up to target.
      const slots = Math.max(1, target - 2);
      const slice = points.slice(0, slots);
      for (let i = 0; i < slice.length; i++) {
        paras.push(`On your ${ordinal(i + 1)} point — ${stripBullet(slice[i]).replace(/[.!?]+$/, "")}. Here's my response: ${brief ? capitalize(brief) : "Acknowledged — I'll handle this and circle back shortly."}`);
      }
      if (points.length > slots) {
        paras.push(`On your remaining ${points.length - slots} point(s) — I'll address those in a follow-up shortly.`);
      }
      return paras.slice(0, target + 1);
    }
  }

  // Compose mode — expand the brief by purpose.
  const briefCap = brief ? capitalize(brief) : "";
  switch (inputs.purpose) {
    case "request": {
      paras.push(`${persuasiveFlourish(tone)}I'm writing to ask for your help with ${briefCap ? lcFirst(briefCap) : "something"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`Specifically, I'd love your input${brief ? ` on ${lcFirst(brief)}` : ""}. It would help me move forward, and your perspective is exactly what I need.`);
      }
      if (target >= 4) {
        paras.push(`Context: I'm working on a deadline and your sign-off would unblock the next steps. I'm happy to share more detail if useful.`);
      }
      if (target >= 5) {
        paras.push(`If it's easier, I can put 15 minutes on the calendar — let me know what works.`);
      }
      break;
    }
    case "follow-up": {
      paras.push(`I wanted to follow up on ${briefCap ? lcFirst(briefCap) : "our last conversation"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`No rush on your end — I just wanted to make sure this didn't slip through the cracks. Let me know if you need anything from me.`);
      }
      if (target >= 4) {
        paras.push(`For context, here's where things stand and what I need from you to keep moving.`);
      }
      if (target >= 5) {
        paras.push(`Happy to jump on a quick call if that's faster than email.`);
      }
      break;
    }
    case "thank-you": {
      paras.push(`I wanted to send a proper thank-you for ${briefCap ? lcFirst(briefCap) : "your help"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`It made a real difference, and I appreciate you making the time.`);
      }
      if (target >= 4) {
        paras.push(`If there's ever anything I can do to return the favor, please don't hesitate to ask.`);
      }
      if (target >= 5) {
        paras.push(`Looking forward to working together again soon.`);
      }
      break;
    }
    case "apology": {
      paras.push(`I want to apologize for ${briefCap ? lcFirst(briefCap) : "what happened"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`You were right to be frustrated, and I'm sorry for the impact this had on you.`);
      }
      if (target >= 4) {
        paras.push(`Here's what I'm doing to fix it and make sure it doesn't happen again.`);
      }
      if (target >= 5) {
        paras.push(`Please let me know what would make this right on your end.`);
      }
      break;
    }
    case "announcement": {
      paras.push(`${persuasiveFlourish(tone)}I'm excited to share ${briefCap ? lcFirst(briefCap) : "some news"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`Here's what's changing, what it means for you, and when it takes effect.`);
      }
      if (target >= 4) {
        paras.push(`We'll be rolling this out in phases, and I'll share more details as we go.`);
      }
      if (target >= 5) {
        paras.push(`If you have any questions in the meantime, just reply to this email.`);
      }
      break;
    }
    case "newsletter": {
      paras.push(`Here's this week's update — ${briefCap ? lcFirst(briefCap) : "what's new and what to read next"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`Top items this week: highlights, links worth your time, and one thing to try.`);
      }
      if (target >= 4) {
        paras.push(`If you only have 2 minutes, jump to the "Quick read" section below.`);
      }
      if (target >= 5) {
        paras.push(`Reply with feedback or suggestions for next week — I read every response.`);
      }
      break;
    }
    case "intro": {
      paras.push(`${persuasiveFlourish(tone)}I'd like to introduce you to ${briefCap ? lcFirst(briefCap) : "the team"}.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`Brief context on why I'm making the intro and what I think you'll both get out of it.`);
      }
      if (target >= 4) {
        paras.push(`I'll let you take it from here — feel free to reply-all and pick a time to chat.`);
      }
      if (target >= 5) {
        paras.push(`If either of you would rather not be introduced, just let me know and I'll back out.`);
      }
      break;
    }
    case "decline": {
      paras.push(`Thanks for sharing ${briefCap ? lcFirst(briefCap) : "this"} with me.`.replace(/\.$/, "") + " I've given it some thought.");
      if (target >= 3) {
        paras.push(`Unfortunately I'm not going to be able to move forward this time — I want to be upfront rather than leave you hanging.`);
      }
      if (target >= 4) {
        paras.push(`Here's the short version of why, in case it's useful for next time.`);
      }
      if (target >= 5) {
        paras.push(`I appreciate you thinking of me and hope we cross paths again.`);
      }
      break;
    }
    case "cold-outreach": {
      paras.push(`${persuasiveFlourish(tone)}I'll keep this short — I came across ${briefCap ? lcFirst(briefCap) : "your work"} and wanted to reach out.`.replace(/\.$/, "") + ".");
      if (target >= 3) {
        paras.push(`Here's why I'm emailing and what I think might be a fit. Happy to share more if it lands.`);
      }
      if (target >= 4) {
        paras.push(`If now isn't a good time, no worries — just reply and I'll follow up when it suits you.`);
      }
      if (target >= 5) {
        paras.push(`Either way, thanks for reading. I'll respect your inbox.`);
      }
      break;
    }
    default: {
      paras.push(briefCap || "I wanted to drop you a quick note.");
    }
  }

  // Always end with a "next step" paragraph (unless we're already at target).
  if (paras.length < target) {
    paras.push(`Let me know if you have any questions — happy to clarify or jump on a quick call.`);
  }

  return paras.slice(0, target + 1);
}

/** Lowercase the first character (helper for in-sentence brief insertion). */
export function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th"… */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Build the signature block from a Signature input. */
export function renderSignature(sig: Signature): string {
  const parts: string[] = [];
  if (sig.name) parts.push(capitalize(sig.name));
  if (sig.title) parts.push(sig.title);
  if (sig.email) parts.push(sig.email);
  if (sig.phone) parts.push(sig.phone);
  return parts.join(" / ");
}

// ---------- Main entry points ----------

/** Generate a complete email draft (subject variants + body + signature). */
export function generateEmail(inputs: EmailInputs): EmailDraft {
  const notes = validateInputs(inputs);
  const subjectVariants = generateSubjects(inputs);
  const primarySubject = subjectVariants[0].subject;
  const paragraphs = generateBodyParagraphs(inputs);
  const greet = greeting(inputs.tone, inputs.recipientName);
  const close = closer(inputs.tone, inputs.senderName);
  const sig = renderSignature(inputs.signature);

  // Assemble body: greeting + blank + paragraphs (joined by blank lines) + blank + closer + sig
  const bodyParts: string[] = [greet, ""];
  for (const p of paragraphs) {
    bodyParts.push(p);
    bodyParts.push("");
  }
  bodyParts.push(close);
  if (sig) bodyParts.push(sig);
  const body = bodyParts.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    subjectVariants,
    primarySubject,
    body,
    paragraphs,
    signature: sig,
    notes,
  };
}

/** Convenience: reply-mode alias. */
export function generateReply(inputs: EmailInputs): EmailDraft {
  return generateEmail({ ...inputs, mode: "reply" });
}

// ---------- Shorten / lengthen ----------

/** Shorten the body by trimming low-value sentences and tightening. */
export function shortenBody(body: string): string {
  const paras = body.split(/\n\s*\n/);
  const trimmed = paras.map((p) => {
    const sentences = p.split(/(?<=[.!?])\s+(?=[A-Z])/);
    // Drop sentences that look like filler.
    const keep = sentences.filter((s) =>
      !/\b(just wanted to|happy to|feel free to|please let me know if|looking forward to working together again)\b/i.test(s)
    );
    return keep.length > 0 ? keep.join(" ") : p;
  });
  return trimmed.filter(Boolean).join("\n\n");
}

/** Lengthen the body by adding an extra clarifying paragraph. */
export function lengthenBody(body: string): string {
  const paras = body.split(/\n\s*\n/);
  // Insert an extra paragraph before the closer (last 2 paragraphs are closer + sig).
  const insertAt = Math.max(1, paras.length - 2);
  const extra = "A bit more context, in case it's useful: I'm happy to share additional detail or jump on a quick call if that would help. Just say the word and I'll make it happen.";
  const out = [...paras.slice(0, insertAt), extra, ...paras.slice(insertAt)];
  return out.filter(Boolean).join("\n\n");
}

// ---------- Render: mailto / .eml / markdown / json ----------

/** Build a mailto: URL with subject + body. RFC 2368 compliant. */
export function renderMailto(draft: EmailDraft, to?: string): string {
  const params = new URLSearchParams();
  params.set("subject", draft.primarySubject);
  params.set("body", draft.body);
  const toStr = to ? `${encodeURIComponent(to)}?` : "?";
  return `mailto:${toStr}${params.toString().replace(/\+/g, "%20")}`;
}

/** Build an RFC 5322 .eml file body. */
export function renderEml(draft: EmailDraft, opts: {
  from?: string;
  to?: string;
  date?: Date;
  messageId?: string;
}): string {
  const date = opts.date ?? new Date();
  const dateStr = date.toUTCString();
  const from = opts.from || "you@example.com";
  const to = opts.to || "recipient@example.com";
  const messageId = opts.messageId || `<${Date.now()}.${Math.random().toString(36).slice(2)}@unqtools.local>`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${escapeEmlHeader(draft.primarySubject)}`,
    `Date: ${dateStr}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
  ];
  return `${headers.join("\r\n")}\r\n\r\n${draft.body.replace(/\r?\n/g, "\r\n")}`;
}

/** Escape a header value per RFC 5322 (very simplified — fold long lines, quote if needed). */
export function escapeEmlHeader(s: string): string {
  const trimmed = (s || "").replace(/[\r\n]/g, " ").trim();
  if (/[()<>@,;:\\".\[\]]/.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '\\"')}"`;
  }
  return trimmed;
}

/** Render draft as plain text (subject + blank + body). */
export function renderText(draft: EmailDraft): string {
  return `Subject: ${draft.primarySubject}\n\n${draft.body}`;
}

/** Render draft as Markdown. */
export function renderMarkdown(draft: EmailDraft, inputs: EmailInputs): string {
  const lines: string[] = [];
  lines.push(`# ${draft.primarySubject}`);
  lines.push("");
  lines.push(`_Drafted by UnQTools AI Email Draft Generator — ${PURPOSE_LABELS[inputs.purpose]} · ${TONE_LABELS[inputs.tone]} · ${LENGTH_LABELS[inputs.length]}._`);
  lines.push("");
  lines.push("## Subject variants");
  lines.push("");
  for (const v of draft.subjectVariants) {
    lines.push(`- **${v.subject}** _(${v.style})_`);
  }
  lines.push("");
  lines.push("## Body");
  lines.push("");
  for (const p of draft.paragraphs) {
    lines.push(p);
    lines.push("");
  }
  if (draft.signature) {
    lines.push("---");
    lines.push("");
    lines.push(draft.signature);
    lines.push("");
  }
  if (draft.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const n of draft.notes) lines.push(`- ${n}`);
    lines.push("");
  }
  lines.push("## Honesty");
  lines.push("");
  lines.push("This is a draft — review before sending. No sending backend; nothing was uploaded.");
  return lines.join("\n");
}

/** Render the draft + inputs as JSON. */
export function renderJson(draft: EmailDraft, inputs: EmailInputs): string {
  return JSON.stringify({ inputs, draft, generatedAt: new Date().toISOString() }, null, 2);
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

// ---------- Shareable URL ----------

export function buildShareUrl(inputs: EmailInputs): string {
  const params = new URLSearchParams();
  if (inputs.mode !== "compose") params.set("mode", inputs.mode);
  if (inputs.purpose !== "request") params.set("purpose", inputs.purpose);
  if (inputs.tone !== "friendly") params.set("tone", inputs.tone);
  if (inputs.length !== "medium") params.set("length", inputs.length);
  if (inputs.recipientName) params.set("to", inputs.recipientName);
  if (inputs.senderName) params.set("from", inputs.senderName);
  if (inputs.brief) params.set("brief", inputs.brief);
  if (inputs.thread) params.set("thread", inputs.thread);
  if (inputs.originalSubject) params.set("subj", inputs.originalSubject);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<EmailInputs> = {};
  const mode = params.get("mode");
  if (mode === "compose" || mode === "reply") inputs.mode = mode;
  const purpose = params.get("purpose");
  if (purpose && purpose in PURPOSE_LABELS) inputs.purpose = purpose as Purpose;
  const tone = params.get("tone");
  if (tone && tone in TONE_LABELS) inputs.tone = tone as Tone;
  const length = params.get("length");
  if (length && length in LENGTH_LABELS) inputs.length = length as Length;
  const to = params.get("to");
  if (to) inputs.recipientName = to;
  const from = params.get("from");
  if (from) inputs.senderName = from;
  const brief = params.get("brief");
  if (brief) inputs.brief = brief;
  const thread = params.get("thread");
  if (thread) inputs.thread = thread;
  const subj = params.get("subj");
  if (subj) inputs.originalSubject = subj;
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: EmailInputs, draft: EmailDraft): string {
  const modeLabel = inputs.mode === "reply" ? "Reply" : "Compose";
  return [
    "You are an expert email writer. Refine the draft email below so it's clearer, more natural, and better tuned to the requested tone and length. Keep it as a draft — do not invent facts.",
    "",
    "Inputs:",
    `- Mode: ${modeLabel}`,
    `- Purpose: ${PURPOSE_LABELS[inputs.purpose]}`,
    `- Tone: ${TONE_LABELS[inputs.tone]}`,
    `- Length: ${LENGTH_LABELS[inputs.length]}`,
    `- Recipient: ${inputs.recipientName || "(unspecified)"}`,
    `- Sender: ${inputs.senderName || "(unspecified)"}`,
    `- Brief: ${inputs.brief || "(none)"}`,
    inputs.mode === "reply" ? `- Original subject: ${inputs.originalSubject || "(none)"}` : "",
    inputs.mode === "reply" ? `- Thread:\n${inputs.thread || "(none)"}` : "",
    "",
    "Current draft:",
    `Subject: ${draft.primarySubject}`,
    "",
    draft.body,
    "",
    "Output a JSON object with:",
    '- "refinedSubject": string (a single, polished subject line)',
    '- "refinedBody": string (the full refined email body, including greeting and sign-off)',
    '- "notes": array of strings (specific changes you made and why)',
    "",
    "Be concise. Do not add new facts not implied by the brief/thread. If the brief is empty or vague, say so in notes and refine conservatively.",
  ].filter(Boolean).join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedSubject = typeof o.refinedSubject === "string" ? o.refinedSubject : "";
  const refinedBody = typeof o.refinedBody === "string" ? o.refinedBody : "";
  if (!refinedSubject && !refinedBody) {
    return { ok: false, error: "LLM output had no refinedSubject or refinedBody." };
  }
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return {
    ok: true,
    result: { refinedSubject, refinedBody, notes },
  };
}
