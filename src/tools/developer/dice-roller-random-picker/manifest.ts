/**
 * Dice Roller & Random Picker — Tool Manifest.
 * Tool #290 — Category 4 (Developer & Code).
 *
 * Full RPG dice-notation parser (3d6+2, 4d6kh3, 2d20kl1, d6! exploding),
 * standard dice d4–d100, custom faces, list picker (weighted/unweighted),
 * coin flip, seedable for reproducibility, history + stats. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dice-roller-random-picker",
  name: "Dice Roller & Random Picker",
  description:
    "Roll any dice (d4, d6, d8, d10, d12, d20, d100, custom faces) with full RPG dice-notation support: 3d6+2 modifiers, 4d6kh3 keep-highest, 2d20kl1 advantage/disadvantage, d6! exploding, and multi-term expressions. Plus a random list picker (weighted or unweighted), coin flip, seedable for reproducibility, and roll history + distribution stats. 100% client-side.",
  category: "developer",
  keywords: [
    "dice roller", "rpg dice", "dice notation",
    "d20", "d6", "advantage", "disadvantage",
    "exploding dice", "keep highest", "keep lowest",
    "random picker", "weighted picker", "coin flip",
    "tabletop dice", "seeded dice",
  ],
  icon: "dices",
  requiresNetwork: false,
  seo: {
    title: "Dice Roller & Random Picker — RPG Notation + Picker + Coin | UnQTools",
    faq: [
      {
        q: "What dice notation does this tool support?",
        a: "Standard RPG dice notation: '3d6' (roll 3 six-sided dice), '3d6+2' (add modifier), '4d6kh3' (roll 4 keep highest 3 — drop the lowest), '2d20kl1' (disadvantage — keep lowest 1), 'd6!' (exploding dice — reroll on max, capped at 100 rerolls to prevent infinite loops), and multi-term expressions like '1d20+1d4+2'. You can also subtract terms with '-1d6'.",
      },
      {
        q: "Which dice types can I roll?",
        a: "Standard polyhedral dice (d4, d6, d8, d10, d12, d20, d100) plus any custom face count (d2, d7, d30, d1000…). Quick-pick buttons for the common dice appear in the UI; for anything else, type the notation directly. Each die is uniformly random across its faces — fair by construction.",
      },
      {
        q: "How does the random picker work?",
        a: "Paste a list of items (one per line). In unweighted mode, each item has equal probability. Toggle weighted mode and append ' :: weight' to each line (e.g. 'Pizza :: 3') — heavier weights get proportionally higher probability. The picker uses a cumulative-distribution algorithm so it's exactly fair across the requested weights.",
      },
      {
        q: "Can rolls be reproduced?",
        a: "Yes — enter any 32-bit seed and the tool uses a mulberry32 PRNG. The same seed + same expression always produces the exact same rolls. Leave the seed field blank or click 'Random' for non-reproducible rolls. We never use Math.random() when a seed is set, so reproducibility is guaranteed.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Full RPG dice-notation parser with modifiers, keep-highest/lowest, and exploding dice. (2) Standard dice d4–d100 + custom faces. (3) Multi-term expressions (1d20+1d4+2). (4) Random list picker (weighted or unweighted). (5) Coin flip with streak tracking. (6) Seeded reproducibility (mulberry32). (7) Roll history (max 20) in localStorage. (8) Per-roll stats (sum, mean, min, max, distribution). (9) CSV/JSON/text export. (10) Shareable config URL (encoded in fragment). (11) Reduced-motion option. (12) Quick-pick dice buttons.",
      },
    ],
  },
  status: "done",
};
