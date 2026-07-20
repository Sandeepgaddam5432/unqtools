import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-text-based-adventure-game-engine",
  name: "AI Text-Based Adventure Game Engine",
  description:
    "Play or build a choose-your-own-adventure text RPG. Four genre templates (fantasy, sci-fi, mystery, horror) with branching scenes, inventory, health, score, quest flags, save/load (localStorage), transcript export, dice/skill checks, and free-text actions. Pure-JS engine — optional BYO-key LLM for richer narration. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "text adventure", "interactive fiction", "choose your own adventure",
    "cyoa", "ai dungeon alternative", "text rpg",
    "branching fiction", "adventure engine", "no login text adventure",
    "private ai game",
  ],
  icon: "gamepad-2",
  requiresNetwork: false,
  seo: {
    title: "AI Text-Based Adventure Game Engine — Branching Fiction, Private | UnQTools",
    faq: [
      {
        q: "How does the text adventure engine work?",
        a: "Pick a genre (fantasy, sci-fi, mystery, or horror), name your hero, and click Start. The engine narrates an opening scene and offers 2–4 numbered choices. Click a choice (or type a free-text action) and the engine advances the scene, updates your inventory, health, score, and quest flags, and tells the next beat. Four hand-authored template worlds ship built-in; scenes branch and converge, with dice/skill checks where the genre calls for them.",
      },
      {
        q: "What state does the engine track?",
        a: "Inventory (named items + descriptions), health (0–100, with optional death/victory thresholds), score (accumulating points), quest flags (boolean switches that unlock branches), current scene id, and a rolling memory summary for long playthroughs. All state lives in localStorage — close the tab and your game persists across sessions.",
      },
      {
        q: "Can I save and load multiple playthroughs?",
        a: "Yes. The engine supports multiple named save slots, each storing the full game state plus a transcript of every scene + choice so far. List saves, load any one, delete old ones, and export a playthrough transcript as plain text or Markdown. History (your last 20 game-overs or victories) is tracked separately so you can回顾 past runs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four genre template worlds (fantasy, sci-fi, mystery, horror). (2) Branching scene graphs with 2–4 choices each. (3) Free-text action input with rule-based interpretation. (4) Inventory add/remove/has checks. (5) Health, score, and quest-flag tracking. (6) Dice/skill checks (deterministic seedable RNG). (7) Multiple named save slots. (8) Rolling memory summary for long games. (9) Transcript export (text/markdown/JSON). (10) Victory + game-over detection. (11) History (localStorage, last 20). (12) Shareable URL (resumes game state). (13) 8 character presets. (14) Optional BYO-key LLM narration enhancement. (15) Restart/branch from any scene. (16) Difficulty presets.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All scene narration, branching, state tracking, dice rolls, save/load, and transcript export run locally in your browser. Your playthrough stays on this device. The only network call is if you paste your own LLM API key and click 'Enhance narration' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
