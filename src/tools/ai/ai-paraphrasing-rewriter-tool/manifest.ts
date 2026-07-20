import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-paraphrasing-rewriter-tool",
  name: "AI Paraphrasing & Rewriter Tool",
  description:
    "Rewrite text across six modes — Standard, Fluent, Formal, Casual, Concise, Expand — using on-device synonym substitution, sentence restructuring, and active↔passive voice change. Adjustable strength, per-sentence alternatives, preserve-terms list, side-by-side diff, readability delta, and multiple variations. 100% client-side — nothing uploaded. Optional BYO-key LLM hook for GPT-class quality.",
  category: "ai",
  keywords: [
    "paraphrasing tool", "sentence rewriter", "text rewriter",
    "ai rewriter", "paraphrase", "rewrite",
    "free paraphraser", "quillbot alternative", "no sign up rewriter",
    "private rewriter", "synonym rewriter", "tone changer",
  ],
  icon: "refresh-cw",
  requiresNetwork: false,
  seo: {
    title: "AI Paraphrasing & Rewriter — On-Device, No Limits, Private | UnQTools",
    faq: [
      {
        q: "How does the paraphrasing tool work?",
        a: "Pick a mode (Standard, Fluent, Formal, Casual, Concise, or Expand) and a strength slider (1–5). The tool splits your text into sentences, then for each sentence it: (1) substitutes synonyms from a built-in dictionary, (2) optionally restructures the sentence, (3) applies tone transformations (e.g. contractions for casual, expanded forms for formal), and (4) optionally changes voice (active↔passive). The strength slider controls how aggressively synonyms are applied. All processing runs locally — your text never leaves this device.",
      },
      {
        q: "What modes are available and what do they do?",
        a: "Six modes: Standard (balanced synonym substitution), Fluent (lighter substitution + readability smoothing), Formal (removes contractions, elevates vocabulary, avoids slang), Casual (adds contractions, simpler vocabulary, conversational tone), Concise (removes filler words and redundant phrases), Expand (adds elaboration phrases like 'in other words' and 'to clarify'). You can also toggle active↔passive voice change and add a preserve-terms list (words that should never be substituted).",
      },
      {
        q: "Can I see a diff and readability change?",
        a: "Yes. The tool shows a side-by-side diff highlighting insertions, deletions, and replacements between your original and rewritten text. It also computes a Flesch Reading Ease score for both versions and reports the readability delta. Multiple variations (3 by default) are generated for each input so you can pick the one that fits best.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six rewrite modes (Standard/Fluent/Formal/Casual/Concise/Expand). (2) Strength slider (1–5) controlling synonym aggressiveness. (3) Active↔passive voice change. (4) Built-in synonym dictionary (~500+ entries). (5) Preserve-terms list (do-not-substitute). (6) Per-sentence alternatives panel. (7) Multiple variations (3 by default). (8) Side-by-side diff (LCS-based). (9) Readability delta (Flesch Reading Ease). (10) Copy + .txt + .md download. (11) Shareable URL with input + settings encoded. (12) Local history (max 20). (13) Sample text button. (14) Honesty disclaimer (we don't claim to beat AI detectors — don't use to disguise plagiarism). (15) Optional BYO-key LLM hook for GPT-class quality.",
      },
      {
        q: "Is my text sent anywhere? Does this beat AI detectors?",
        a: "No text is uploaded — all rewriting runs locally in your browser. History is stored in localStorage on this device only. The optional BYO-key LLM path (if you supply an API key) sends text directly from your browser to the provider you choose. We do NOT claim this tool beats AI detectors, and we discourage using paraphrasing to disguise plagiarism — always cite your sources and write originally where it matters.",
      },
    ],
  },
  status: "done",
};
