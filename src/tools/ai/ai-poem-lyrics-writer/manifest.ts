import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-poem-lyrics-writer",
  name: "AI Poem & Lyrics Writer",
  description:
    "Write form-aware poems and song lyrics with rhyme, meter, mood, and theme control — haiku, sonnet, free verse, limerick, acrostic, plus verse/chorus/bridge song structure. Built-in 200+ word rhyme dictionary, syllable counter, rhyme-scheme validator (AABB/ABAB/ABBA/Free), acrostic from any word, song structure scaffolding, optional BYO-key LLM enhancement. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "poem generator", "lyrics generator", "poem writer",
    "rhyme scheme poem", "haiku generator", "sonnet generator",
    "limerick generator", "acrostic poem", "song lyric writer",
    "free verse poem", "no login poem",
  ],
  icon: "feather",
  requiresNetwork: false,
  seo: {
    title: "AI Poem & Lyrics Writer — Rhyme, Meter, Forms, Private | UnQTools",
    faq: [
      {
        q: "How does the poem & lyrics writer work?",
        a: "Enter a theme, pick a form (haiku, sonnet, free verse, limerick, acrostic, or song lyrics), choose a rhyme scheme (AABB, ABAB, ABBA, or Free) and a mood, and the tool generates an original poem using built-in form templates, a 200+ word rhyme dictionary, and a syllable counter. Each poem includes per-line syllable counts and a form-validation report so you know exactly how strictly it follows the rules.",
      },
      {
        q: "What poem forms are supported?",
        a: "Five poem forms: haiku (5-7-5 syllables, 3 lines), sonnet (14 lines, ABAB CDCD EFEF GG), free verse (no rules, 6-12 lines), limerick (AABBA with specific meter), and acrostic (the first letter of each line spells a word you choose). For songs: verse/chorus/bridge structure with syllable guidance per section.",
      },
      {
        q: "How does the rhyme dictionary work?",
        a: "The tool ships with a 200+ word rhyme dictionary grouped by rhyme ending (e.g., '-ight': light, night, sight, bright, fight). When you pick a rhyme scheme, the generator picks rhyming line-enders from the dictionary so the scheme holds. The rhyme helper sidebar shows rhymes for any word you type — useful when editing or writing your own lines.",
      },
      {
        q: "Can I use my own LLM API key for richer poems?",
        a: "Yes. The tool builds an optimal prompt (theme + form + rhyme scheme + mood + syllable target) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. If no key is provided, the on-device template engine produces solid baseline poems fully offline. The honesty clause: small local models can miss strict meter; the analyzer flags misses either way.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 poem forms (haiku, sonnet, free verse, limerick, acrostic). (2) 4 rhyme schemes (AABB, ABAB, ABBA, Free). (3) 200+ word rhyme dictionary with helper sidebar. (4) Syllable counter per line. (5) Form-validation report (flags rule violations). (6) Acrostic from any word. (7) Song structure (verse/chorus/bridge) scaffolding. (8) Mood presets (joyful, melancholy, defiant, contemplative, romantic, playful). (9) Theme keyword extractor. (10) Multiple stanza variants. (11) Copy + Download (text/Markdown/JSON). (12) Optional BYO-key LLM enhancement. (13) History (localStorage, last 20). (14) Shareable URL. (15) Theme presets for quick starts.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All poem generation, syllable counting, and rhyme lookups run locally in your browser. Themes never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Output is original; do not copy real copyrighted lyrics. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
