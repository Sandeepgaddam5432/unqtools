import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "emoji-picker-keyboard",
  name: "Emoji Picker & Keyboard",
  description:
    "Browse, search, and copy emojis from a 600+ built-in database. 9 categories (smileys, gestures, animals, food, activities, travel, objects, symbols, flags), keyword search, skin-tone selector (5 tones), recently used tracker (max 50), related emojis, ZWJ combination generator, top-100 presets, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "emoji", "emojis", "emoji picker", "emoji keyboard",
    "emoji search", "copy emoji", "smileys", "skin tone emoji",
    "emoji database", "emoji finder",
  ],
  icon: "smile",
  requiresNetwork: false,
  seo: {
    title: "Emoji Picker & Keyboard — Search + Copy 600+ Emojis | UnQTools",
    faq: [
      {
        q: "How does the emoji picker work?",
        a: "Browse 600+ emojis organized into 9 categories (smileys, gestures, animals, food, activities, travel, objects, symbols, flags). Click any emoji to copy it to your clipboard. Use the search bar to filter by name or keyword (e.g. 'happy', 'heart', 'cat'). Pick a skin tone to apply to all human emojis.",
      },
      {
        q: "How many emojis are included and how are they categorized?",
        a: "600+ emojis across 9 categories. Each emoji has a name, 1-3 keywords, a category, and a skin-tone-support flag. Human emojis (gestures, body parts) accept the 5 Fitzpatrick skin tone modifiers (light, medium-light, medium, medium-dark, dark).",
      },
      {
        q: "Can I find related emojis or generate ZWJ combinations?",
        a: "Yes. Click an emoji to see related emojis (sharing the same keyword). The combination generator recognizes common ZWJ sequences like ❤️ + 🔥 = ❤️‍🔥 (heart on fire), 🧑 + 🌾 = 🧑‍🌾 (farmer), and 🏳️ + 🌈 = 🏳️‍🌈 (rainbow flag).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 600+ built-in emoji database (name + keywords + category). (2) Keyword searcher (case-insensitive, name + keywords). (3) 9 category filters (smileys, gestures, animals, food, activities, travel, objects, symbols, flags). (4) Skin tone applier (5 tones for human emojis). (5) Recently used tracker (localStorage, max 50). (6) Emoji grouper (by category). (7) Related emoji finder (same keywords). (8) Emoji variation finder (skin tones, gender). (9) Text + CSV renderers. (10) Copy to clipboard helper. (11) History (localStorage, last 20 copied). (12) Shareable URL (encode query + category + skin tone). (13) Summary stats (total, by category). (14) Top-100 frequently used emoji presets. (15) ZWJ combination generator (15+ common compound emojis).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All emoji search and copy runs locally in your browser. Recently used and history are stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
