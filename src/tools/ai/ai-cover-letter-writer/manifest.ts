import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-cover-letter-writer",
  name: "AI Cover Letter Writer",
  description:
    "Draft a JD-tailored cover letter from your experience + the job description. Tone control (formal / warm / confident), length presets, requirement-to-evidence mapping, de-cliché pass, unsupported-claim flagging. 100% client-side — your resume and JD never leave the browser. Optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "cover letter", "cover letter generator", "cover letter writer",
    "ai cover letter", "job application", "tailored cover letter",
    "jd-tailored cover letter", "cover letter from job description",
    "private cover letter", "no sign up cover letter",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "AI Cover Letter Writer — JD-Tailored, Private / UnQ36o",
    faq: [
      {
        q: "How does the cover letter writer work?",
        a: "Paste your experience (or paste a resume blurb), paste the target job description, choose a tone (formal, warm, confident) and a length (short, standard, detailed). The tool extracts the job description's key requirements deterministically, maps each requirement to evidence in your experience when it can find a keyword match, and drafts an intro-body-close cover letter that addresses the matched requirements in your own words. Every requirement is shown as a checklist item that turns green when addressed.",
      },
      {
        q: "Does it fabricate credentials or experience?",
        a: "No. The tool only writes sentences that reference skills or experience you actually pasted. Requirements in the JD that have no matching evidence in your experience are flagged as 'unmatched' in the requirement checklist and the draft explicitly avoids claiming them — instead, the draft invites a conversation rather than inventing credentials. The honesty clause: this is a draft to personalize, not a submit-as-is letter.",
      },
      {
        q: "Can I run a 'de-cliché' pass on the draft?",
        a: "Yes. The de-cliché pass scans the draft for common cover-letter clichés and AI-tell phrases (e.g., 'I am writing to express my interest', 'passionate about', 'team player', 'think outside the box', 'perfect fit'). Each match is flagged with a suggested rewrite. Apply all suggestions with one click or pick and choose.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) JD keyword extraction (deterministic, runs offline). (2) Requirement-to-evidence mapping with checklist that turns green when addressed. (3) Three tones (formal / warm / confident) × three lengths (short / standard / detailed). (4) Intro / body / close structure with labeled sections. (5) De-cliché pass with ~30+ phrases flagged and rewrites suggested. (6) Unsupported-claim flagging — never invents credentials. (7) Hook variants for the opening line. (8) Inline editable draft. (9) Copy / Markdown / plain-text download. (10) History (localStorage, last 20). (11) Shareable URL with all inputs encoded. (12) Optional BYO-key LLM polish (OpenAI / Anthropic). (13) Tone-aware sentence templates per section.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All keyword extraction, requirement mapping, draft assembly, and the de-cliché pass run locally in your browser. Your experience, name, and the job description never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI or Anthropic, with the key stored only in this browser's localStorage.",
      },
    ],
  },
  status: "done",
};
