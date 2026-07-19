import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-emoji-translator",
  name: "Social Media Emoji Translator",
  description:
    "Translate text to emojis and back with a 1000+ word-to-emoji dictionary, 50+ phrase mappings, and 10+ emoji-art templates. Four modes (text-to-emoji, emoji-to-text, emoji-art, mixed), four density levels (sparse/medium/dense/ultra-dense), original text preservation, alternative-emoji suggester, tone detector, ZWJ combination generator, coverage report, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "emoji translator", "text to emoji", "emoji to text",
    "emoji art", "emoji sentences", "emoji meanings",
    "emoji dictionary", "emoji converter", "social media emoji",
    "emoji picker", "emoji generator",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "Social Media Emoji Translator — Text ↔ Emoji + Art | UnQTools",
    faq: [
      {
        q: "How does the emoji translator work?",
        a: "Enter your text and pick a mode: text-to-emoji (translates each word/phrase using a built-in dictionary), emoji-to-text (reverse lookup — emojis become their most common word), emoji-art (renders multi-line emoji pictures like hearts, Christmas trees, cats), or mixed (interleave text + emojis). Phrases are matched first, then remaining words. Density controls how often emojis are inserted (sparse = 1 per sentence, medium = 1 per phrase, dense = 1 per word, ultra-dense = multiple per word).",
      },
      {
        q: "How many words and phrases are in the dictionary?",
        a: "The built-in word-to-emoji dictionary has 1000+ common words across 9 emoji categories (smileys, gestures, animals, food, activities, travel, objects, symbols). The phrase dictionary has 50+ multi-word mappings like 'good morning' → ☀️🌅, 'happy birthday' → 🎉🎂, 'thank you' → 🙏.",
      },
      {
        q: "Can I generate emoji art and ZWJ combinations?",
        a: "Yes. Emoji-art mode renders 10+ pre-built multi-line templates (heart, christmas tree, cat, dog, rose, sword, house, tree, star, smile). The ZWJ combination generator recognizes common compound sequences like ❤️ + 🔥 = ❤️‍🔥 (heart on fire), 🧑 + 🌾 = 🧑‍🌾 (farmer), 🏳️ + 🌈 = 🏳️‍🌈 (rainbow flag).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 1000+ word-to-emoji dictionary. (2) 50+ phrase-to-emoji mappings. (3) Text-to-emoji translator (phrase priority). (4) Emoji-to-text translator (reverse lookup). (5) Emoji art generator (10+ templates). (6) Mixed mode (interleave text + emojis). (7) 4 density levels (sparse/medium/dense/ultra-dense). (8) Original text preserver. (9) Emoji suggestion engine (similar emojis for unmapped words). (10) Text-render output. (11) CSV-render output. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, max 20). (14) Shareable URL. (15) Summary stats (words, emojis, coverage %, avg per word). (16) Emoji count per category. (17) Word coverage report (covered vs uncovered). (18) Alternative emoji suggester (multiple emojis per word). (19) Tone detector (happy/sad/excited/angry/love/neutral). (20) ZWJ combination generator.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All translation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
