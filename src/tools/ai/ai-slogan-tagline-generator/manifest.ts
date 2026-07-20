import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-slogan-tagline-generator",
  name: "AI Slogan & Tagline Generator",
  description:
    "Generate catchy slogans and taglines from brand + keywords across styles (benefit, emotional, witty, rhyming, minimalist, imperative). 100+ power words, alliteration/rhyme detection, cliché filter, length control, and a deterministic scorer (memorability, length, impact). A/B pairs, style chips, favorites, history (localStorage), shareable URL, optional BYO-key LLM. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "slogan generator", "tagline generator", "slogan maker",
    "tagline maker", "catchy slogan", "brand tagline",
    "slogan ideas", "tagline ideas", "ad copy",
    "slogan generator free", "tagline generator free",
    "sloganizer alternative", "Shopify slogan maker alternative",
  ],
  icon: "sparkles",
  requiresNetwork: false,
  seo: {
    title: "AI Slogan & Tagline Generator — Scored & Varied, Private | UnQTools",
    faq: [
      {
        q: "How does the slogan & tagline generator work?",
        a: "Enter your brand name, 1–5 keywords, and pick a tone (e.g., playful, bold, premium, friendly). The tool deterministically assembles many taglines across six style families — benefit-led, emotional, witty, rhyming, minimalist, and imperative — using 100+ bundled power words, then scores each one on length, memorability (syllable + phonetic-device check), and impact (power-word density). Everything runs locally in your browser; nothing is uploaded.",
      },
      {
        q: "What scoring does the tool use?",
        a: "Three sub-scores are combined into a 0–100 overall score. Length: rewards 3–6 word taglines (the brand-landscape sweet spot), penalises ones that are too short or too long. Memorability: rewards alliteration, end-rhyme, and 2–4 syllable rhythm; penalises tongue-twisters (>5 syllables/word). Impact: rewards power words (e.g., 'unleash', 'effortless', 'bold', 'forever') and penalises clichés from the bundled list (e.g., 'just do it', 'think different', 'got milk?').",
      },
      {
        q: "Can I generate A/B pairs for testing?",
        a: "Yes. The A/B pairs feature produces 5–10 paired taglines from different style families so you can paste them into a subject-line A/B test or an ad creative test. Each pair has its overall score displayed alongside so you can compare like-for-like.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 6 style families (benefit, emotional, witty, rhyming, minimalist, imperative). (2) 100+ bundled power words. (3) Deterministic length / memorability / impact scorer. (4) Alliteration + end-rhyme detection. (5) Bundled cliché filter (40+ known slogans). (6) A/B pair generator. (7) Tone selector (5 tones). (8) Length control (min/max words). (9) Brand-fit filter (must contain brand or a keyword). (10) Favorites (localStorage). (11) Local history (last 20). (12) Shareable URL with brand + keywords + tone encoded. (13) Copy each / export list as .txt. (14) Optional BYO-key LLM polish (OpenAI/Anthropic). (15) Honesty disclaimers (scores are heuristics; no legal trademark clearance).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All slogan generation, scoring, alliteration/rhyme detection, cliché filtering, and A/B pairing run locally in your browser. Your brand name and keywords never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
