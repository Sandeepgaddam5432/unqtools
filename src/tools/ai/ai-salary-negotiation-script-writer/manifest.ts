import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-salary-negotiation-script-writer",
  name: "AI Salary Negotiation Script Writer",
  description:
    "Generate tailored salary-negotiation scripts: a counter-offer email, in-person talking points, responses to common objections (budget fixed, what are your expectations, more experience needed), and non-salary levers (equity, PTO, remote, signing bonus). Three scenarios — initial ask, counter-offer, final offer — with confident or collaborative tone, anchor-range guidance, leverage framing, and a role-play practice mode. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "salary negotiation", "counter offer email", "salary script",
    "negotiation talking points", "raise negotiation", "offer negotiation",
    "salary counter offer", "negotiate salary", "objection response",
    "non-salary levers",
  ],
  icon: "handshake",
  requiresNetwork: false,
  seo: {
    title: "AI Salary Negotiation Script Writer — Counter-offer + Talking Points, Private | UnQTools",
    faq: [
      {
        q: "How does the Salary Negotiation Script Writer work?",
        a: "Enter your scenario (initial ask, counter-offer, or final offer), target salary, role, company, and any leverage points (competing offer, market data, impact, experience, scarce skills). The engine produces a tailored negotiation package: (1) a counter-offer email with subject line, (2) in-person talking-point cards, (3) responses to six common objections ('budget is fixed', 'what are your expectations?', 'you need more experience', 'wrong timing', 'we match competitive offers', 'wait for your promotion'), and (4) non-salary levers to fall back on (equity, PTO, remote, signing bonus, performance bonus, title, professional development, benefits). You also get an anchor range — the low, target, and stretch numbers to keep in your head during the conversation.",
      },
      {
        q: "What scenarios and tones are supported?",
        a: "Three scenarios: 'Initial ask' (first number on the table), 'Counter-offer' (responding to an existing offer), and 'Final offer' (closing round). Two tones: 'Confident' (firm, anchored, willingness to walk) and 'Collaborative' (partnership framing, problem-solving, shared outcomes). The tone you pick shapes the email opener, the talking-point phrasing, and the objection responses — pick the one that fits your relationship with the hiring manager and your appetite for risk.",
      },
      {
        q: "How is the anchor range calculated and what leverage framing is included?",
        a: "The anchor range is built from your target salary: low = target × 0.95 (your floor), mid = target (your ask), high = target × 1.10 (your stretch). Always ask for the high number first — it sets the anchor and gives you room to concede to your real target. Leverage framing lets you check one or more of: competing offer, market data, quantified impact, years of relevant experience, education/certifications, scarce/in-demand skills, or promotion-track case. Each checked lever adds a sentence to the talking points and email that frames your ask in terms the employer already values.",
      },
      {
        q: "What extra features does this tool have compared to other negotiation tools?",
        a: "(1) Three negotiation scenarios (initial ask / counter-offer / final offer). (2) Two tone modes (confident / collaborative) that change the email + talking points + objection responses. (3) Counter-offer email with subject + body. (4) Talking-point cards for in-person or phone. (5) Responses to 6 common objections (budget / expectations / experience / timing / competitive / promotion). (6) Eight non-salary levers with ready-to-use scripts (equity, PTO, remote, signing bonus, performance bonus, title, development, benefits). (7) Anchor-range guidance (low / target / stretch). (8) Seven leverage framings (competing offer, market data, impact, experience, education, scarce skills, promotion track). (9) Role-play practice mode (sample employer questions + suggested answers). (10) Benefits-comparison checklist. (11) Sample scenario presets. (12) Copy / download email + talking points + objection scripts. (13) Local history (localStorage, last 20). (14) Shareable URL. (15) Honesty disclaimer (scripts are guidance, not guarantees — outcomes depend on employer, market, and timing). (16) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my salary information sent anywhere?",
        a: "No. All script generation runs locally in your browser. Your salary numbers, role, and company details never leave this device. The only network call is if you paste your own LLM API key (OpenAI or Anthropic) and click 'Enhance with LLM' — that request goes directly from your browser to the provider you choose, never to UnQTools. History is stored in localStorage on this device only and can be cleared at any time. The on-device template engine is the default — you don't need an API key to use the tool.",
      },
    ],
  },
  status: "done",
};
