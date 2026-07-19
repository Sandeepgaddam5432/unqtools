import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-character-name-generator",
  name: "AI Character Name Generator",
  description:
    "Generate culture-aware character names across genres (fantasy, sci-fi, modern, historical, cyberpunk, mythic) and cultures (English, Spanish, Japanese, Arabic, Indian, Nordic, Slavic, African, Celtic, Chinese). Each name comes with pronunciation guide, stylistic meaning, 3–5 variants, matching epithet/title, place name, and faction name for worldbuilding coherence. Phonetic-feel controls (soft/flowing vs harsh/guttural), gender-neutral option, era filter, name-clash checker against your existing cast, culture-mix warnings, seeded reproducibility, favorites (localStorage), history (last 20), shareable URL, CSV/Markdown/JSON export, optional BYO-key LLM polish. 100% client-side — generation never leaves the browser.",
  category: "ai",
  keywords: [
    "character name generator", "fantasy name generator", "rpg name generator",
    "npc name generator", "fiction name generator", "culture aware names",
    "name meaning", "name pronunciation", "sci fi names", "medieval names",
    "japanese names", "nordic names", "elven names", "worldbuilding names",
    "dnd name generator", "writer name tool",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "AI Character Name Generator — Culture + Genre Aware, Private | UnQTools",
    faq: [
      {
        q: "How does the character name generator work?",
        a: "Pick a genre (fantasy, sci-fi, modern, historical, cyberpunk, mythic), a culture (English, Spanish, Japanese, Arabic, Indian, Nordic, Slavic, African, Celtic, Chinese), a gender (or gender-neutral), an era, and a phonetic feel (soft/flowing vs harsh/guttural). The tool combines curated culture-feel name banks with syllable/affix templates to produce first names, last names, and full names. Each name shows a stylistic meaning, a pronunciation guide, 3–5 variant spellings, a matching epithet/title, a place name, and a faction name for worldbuilding coherence.",
      },
      {
        q: "Are the meanings real etymologies?",
        a: "No — and we label them clearly as 'stylistic' rather than 'etymological'. For real-world cultures we draw from attested name banks so the phonetics stay coherent and respectful. For invented names (fantasy/sci-fi roots), the 'meaning' is generated from a curated bank of evocative glosses that match the chosen phonetic feel. This avoids the common AI failure of inventing fake etymologies that look authoritative. If you need real etymology for a real-world name, consult an academic name dictionary.",
      },
      {
        q: "What about stereotypes when mixing cultures?",
        a: "The tool defaults to respectful, coherent phonetics within a single culture. If you explicitly combine cultures (e.g., 'Japanese × Norse'), we surface a warning that real-culture mixing can veer into stereotype, and we keep the phonetic blend internally consistent rather than mashing random markers. You can dismiss the warning, but you'll see it every time so the choice is conscious.",
      },
      {
        q: "What extra features does this tool have compared to other name generators?",
        a: "(1) 6 genres × 10 cultures × 4 gender options × era filter. (2) Phonetic-feel controls (soft/flowing, harsh/guttural, mixed). (3) Pronunciation guide per name. (4) Stylistic meaning (clearly labeled, not fake etymology). (5) 3–5 variant spellings per name. (6) Matching epithet/title per character. (7) Matching place name for worldbuilding. (8) Matching faction name for worldbuilding. (9) Name-clash checker against your existing cast. (10) Culture-mix warning system. (11) Fit-score per name (how well it matches the chosen setting). (12) Seeded reproducibility (same seed = same names). (13) Gender-neutral option. (14) Favorites list (localStorage). (15) History (last 20, localStorage). (16) Shareable URL with all inputs encoded. (17) CSV/Markdown/JSON export. (18) Bulk generation (1–20 names per run). (19) Optional BYO-key LLM polish (OpenAI/Anthropic). (20) Honesty disclaimer about invented meanings.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All name generation, scoring, favorites, history, and export run locally in your browser. Your character descriptions never leave this device. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly to the LLM provider you choose and never touches UnQTools servers.",
      },
    ],
  },
  status: "done",
};
