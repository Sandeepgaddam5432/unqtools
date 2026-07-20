import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-passive-active-voice-converter",
  name: "AI Passive→Active Voice Converter",
  description:
    "Convert passive voice to active voice (and back) with inline clause highlighting, hidden-agent identification, per-sentence rewrites, and grammar explanations. Detects 'is written', 'was done', 'has been completed' and similar passive constructions, identifies the agent (or flags agentless passives), and preserves legitimate passives (unknown/irrelevant agent) instead of blindly rewriting. Sentence-level transformations with a passive-voice percentage meter, accept/reject per suggestion, and style-guide presets. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "passive to active voice", "active voice converter", "fix passive voice",
    "passive voice detector", "active voice rewriter", "passive voice checker",
    "voice converter", "grammar rewriter", "active to passive", "writing tool",
  ],
  icon: "arrow-left-right",
  requiresNetwork: false,
  seo: {
    title: "AI Passive→Active Voice Converter — Stronger Sentences, Private | UnQTools",
    faq: [
      {
        q: "How does the Passive→Active Voice Converter work?",
        a: "Paste your text and the engine scans sentence-by-sentence for passive-voice constructions: forms of 'to be' (is/are/was/were/been/being) + a past participle, optionally followed by a 'by [agent]' phrase. For each passive clause it (1) highlights the clause inline, (2) identifies the hidden agent (from the 'by' phrase, or context, or marks it as agentless), (3) proposes an active rewrite that promotes the agent to subject + active verb + original subject as object, and (4) writes a short grammar explanation. A passive-voice percentage meter shows the document-level ratio. You can convert the other direction too (active → passive) for the same sentences.",
      },
      {
        q: "How does the engine detect passive voice without a cloud parser?",
        a: "It uses a hand-built pipeline: (1) split the text into sentences on terminal punctuation; (2) tokenize each sentence into words; (3) scan for the canonical passive pattern [be-verb] + [past-participle verb], accounting for auxiliaries (has/have/had been, is being, will be, modals + be); (4) look for a following 'by [agent]' phrase to identify the agent; (5) consult an irregular-verb table (~180 English irregulars) to map past participles back to base form for the active rewrite. The pipeline is intentionally conservative — it flags only high-confidence passive constructions to avoid false positives on adjectives like 'is tired' or stative verbs like 'is interested in'.",
      },
      {
        q: "When does the tool keep the passive voice instead of rewriting?",
        a: "Three cases: (1) Agentless passives in scientific or process writing ('The mixture was heated to 80°C') where the agent is unknown or irrelevant — the tool flags these as 'passive is fine here' and explains why; (2) Passives where the agent is genuinely less important than the action ('The package was delivered yesterday'); (3) When you've selected the 'academic' style preset, which allows more passive constructions. The tool never blindly rewrites — it always offers the rewrite as a suggestion you can accept or reject per sentence.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Sentence-by-sentence passive detection with clause-level highlighting. (2) Hidden-agent identification (from 'by' phrases, or marked agentless). (3) Active rewrite per passive clause. (4) Active→passive conversion (bidirectional). (5) 'Passive is fine here' flag with reasoning for legitimate passives. (6) Per-sentence grammar explanation ('was written → wrote, with agent as new subject'). (7) Document-level passive-voice percentage meter. (8) Accept/reject each suggestion individually. (9) Style-guide presets (general/academic/journalism). (10) Irregular-verb lookup table (~180 English irregulars). (11) Sentence count + word count + passive count stats. (12) Copy/download converted text + suggestions CSV. (13) Local history (localStorage, last 20). (14) Shareable URL. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All sentence splitting, passive detection, agent identification, and rewriting runs locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key (OpenAI or Anthropic) and click 'Enhance with LLM' — that request goes directly from your browser to the provider you choose. History is stored in localStorage on this device only and can be cleared at any time.",
      },
    ],
  },
  status: "done",
};
