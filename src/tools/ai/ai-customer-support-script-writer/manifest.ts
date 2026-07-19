import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-customer-support-script-writer",
  name: "AI Customer Support Script Writer",
  description:
    "Generate staged, tone-tuned customer-support scripts for 12 scenarios (refund, complaint, technical issue, cancellation, billing, outage, upsell, onboarding, feature request, shipping delay, account reactivation, password reset). Empathetic openers, acknowledgment, investigation, resolution, objection handling, and closing — driven by channel (chat/email/phone), tone (empathetic/formal/friendly), variables, brand-voice profile, de-escalation presets, and a reusable macro library. History (localStorage), shareable URL, optional BYO-key LLM polish. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "customer support script", "support reply template", "canned response",
    "de-escalation script", "support script generator", "empathy script",
    "refund response", "complaint response", "retention script",
    "customer service script", "support macros",
  ],
  icon: "headset",
  requiresNetwork: false,
  seo: {
    title: "AI Customer Support Script Writer — Scenario Scripts, Tone-Tuned | UnQTools",
    faq: [
      {
        q: "How does the support script writer work?",
        a: "Pick a scenario (refund, complaint, technical issue, cancellation, billing, outage, upsell, onboarding, feature request, shipping delay, account reactivation, password reset), a channel (chat/email/phone), and a tone (empathetic/formal/friendly). The tool assembles a 6-stage script — opener, acknowledgment, investigation, resolution, objection handling, closing — from a built-in template library, fills in your variables (customer name, order ID, product, etc.), and applies your brand-voice profile.",
      },
      {
        q: "What scenarios are supported?",
        a: "12 scenarios covering the most common support cases: refund request, complaint/escalation, technical issue, cancellation/retention, billing dispute, outage acknowledgment, upsell/cross-sell, onboarding, feature request, shipping delay, account reactivation, and password reset. Each scenario has 6 staged templates × 3 tones = 18 ready-to-use variants per channel.",
      },
      {
        q: "What is the de-escalation feature?",
        a: "The de-escalation engine scans your script for ~20 charged phrases ('unfortunately', 'that's our policy', 'calm down', 'you have to', 'as per my last email', etc.) and replaces each one with a calmer alternative, plus an explanation of why the original phrase can escalate. There's also a positive-language rewriter that flags weak/hype phrases ('world-class', 'revolutionary', 'seamless') so you can rewrite them with concrete proof points.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 12 scenario templates × 6 stages × 3 tones = 216 ready-to-use script variants. (2) 3 channels (chat/email/phone) with channel-specific formatting. (3) 7 merge-field variables (customer name, agent name, order ID, product, company, issue summary, ticket ID). (4) De-escalation engine with 20+ presets. (5) Positive-language weak-phrase linter (9+ phrases). (6) Brand-voice profile (traits, avoid-list, signature) saved in localStorage. (7) Compliance flag for sensitive scenarios (refund, complaint, billing, cancellation). (8) Reusable macro library (save up to 50 scripts). (9) Live preview as you type. (10) Per-stage copy button. (11) Markdown/JSON/text export. (12) History (last 20). (13) Shareable URL with all inputs encoded. (14) Stage-specific tips. (15) Optional BYO-key LLM polish (OpenAI/Anthropic) for context-aware rewriting.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All template assembly, variable substitution, de-escalation, weak-phrase linting, and Markdown/JSON export run locally in your browser. Your scenario inputs and customer details never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic). Scripts are drafts to adapt, not policy — always verify against your company policy and local law.",
      },
    ],
  },
  status: "done",
};
