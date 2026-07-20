/**
 * AI Text-Based Adventure Game Engine — pure logic.
 *
 * Choice-based branching text adventure engine with state tracking
 * (inventory, health, score, quest flags), multiple genre template
 * worlds, dice/skill checks, save/load via localStorage, transcript
 * export, and rolling memory summaries. Pure-JS engine — no DOM, no
 * network. The optional LLM call (BYO API key) lives in ui.tsx
 * because it touches the network.
 *
 * Pure functions only.
 */

// ---------- Types ----------

export type Genre = "fantasy" | "sci-fi" | "mystery" | "horror";

export type Difficulty = "easy" | "standard" | "hard";

export interface InventoryItem {
  name: string;
  description: string;
}

export interface Stat {
  health: number;
  maxHealth: number;
  score: number;
}

export interface Choice {
  id: string;
  label: string;
  /** Effects applied when this choice is selected. */
  effects?: ChoiceEffects;
  /** Required flag (or item) for this choice to appear. */
  requires?: Requirement;
  /** Target scene id. If omitted, stays on same scene. */
  next?: string;
  /** Marks this choice as the win path. */
  victory?: boolean;
  /** Marks this choice as a death/failure path. */
  gameOver?: boolean;
}

export interface ChoiceEffects {
  healthDelta?: number;
  scoreDelta?: number;
  addItems?: InventoryItem[];
  removeItems?: string[];
  setFlags?: Record<string, boolean>;
  /** If set, run a skill check; pass/fail routes to different scenes. */
  skillCheck?: SkillCheck;
}

export interface Requirement {
  /** All listed flags must be true. */
  flagsTrue?: string[];
  /** All listed flags must be false. */
  flagsFalse?: string[];
  /** All listed items must be in inventory. */
  hasItems?: string[];
}

export interface SkillCheck {
  stat: "luck" | "strength" | "wits" | "charm";
  target: number; // d20 must meet or exceed
  passScene?: string;
  failScene?: string;
  passEffects?: ChoiceEffects;
  failEffects?: ChoiceEffects;
}

export interface Scene {
  id: string;
  title: string;
  narration: string;
  choices: Choice[];
  /** Marks scene as a victory endpoint (no choices). */
  victory?: boolean;
  /** Marks scene as a game-over endpoint. */
  gameOver?: boolean;
}

export interface GameWorld {
  id: string;
  genre: Genre;
  name: string;
  blurb: string;
  openingSceneId: string;
  scenes: Record<string, Scene>;
}

export interface TranscriptEntry {
  ts: number;
  sceneId: string;
  sceneTitle: string;
  narration: string;
  choiceLabel?: string;
  choiceId?: string;
  effects?: ChoiceEffects;
  skillCheckResult?: { stat: string; roll: number; target: number; passed: boolean };
}

export interface GameState {
  worldId: string;
  genre: Genre;
  heroName: string;
  difficulty: Difficulty;
  stat: Stat;
  inventory: InventoryItem[];
  flags: Record<string, boolean>;
  currentSceneId: string;
  visitedScenes: string[];
  transcript: TranscriptEntry[];
  startedAt: number;
  updatedAt: number;
  status: "playing" | "victory" | "game-over";
  memory: string[];
  rngSeed: number;
}

export interface SaveSlot {
  id: string;
  label: string;
  state: GameState;
  savedAt: number;
}

export interface HistoryEntry {
  ts: number;
  worldId: string;
  genre: Genre;
  heroName: string;
  status: "victory" | "game-over";
  score: number;
  turns: number;
}

export interface ShareState {
  worldId: string;
  heroName: string;
  difficulty: Difficulty;
}

export interface WorldStats {
  sceneCount: number;
  choiceCount: number;
  victoryScenes: number;
  gameOverScenes: number;
  flagsUsed: string[];
}

export interface LlmRequestBody {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_tokens: number;
}

// ---------- Constants & labels ----------

export const GENRE_LABELS: Record<Genre, string> = {
  "fantasy": "Fantasy",
  "sci-fi": "Sci-Fi",
  "mystery": "Mystery",
  "horror": "Horror",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy (+health)",
  standard: "Standard",
  hard: "Hard (no health regen)",
};

export const DIFFICULTY_HEALTH_BONUS: Record<Difficulty, number> = {
  easy: 30,
  standard: 0,
  hard: -20,
};

export const STAT_LABELS: Record<SkillCheck["stat"], string> = {
  luck: "Luck",
  strength: "Strength",
  wits: "Wits",
  charm: "Charm",
};

export const CHARACTER_PRESETS: Array<{ name: string; genre: Genre }> = [
  { name: "Aria Brightblade", genre: "fantasy" },
  { name: "Captain Vox", genre: "sci-fi" },
  { name: "Detective Quinn", genre: "mystery" },
  { name: "Sam Holloway", genre: "horror" },
  { name: "Ranger Wren", genre: "fantasy" },
  { name: "Dr. Mira Solis", genre: "sci-fi" },
  { name: "Inspector Vale", genre: "mystery" },
  { name: "Eve Carrow", genre: "horror" },
];

// ---------- RNG ----------

/** Mulberry32 deterministic PRNG — seeded for reproducible dice rolls. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll a d20 using a seeded RNG; advances the seed. */
export function rollD20(seedRef: { seed: number }): { roll: number; seed: number } {
  const rng = mulberry32(seedRef.seed);
  const roll = Math.floor(rng() * 20) + 1;
  return { roll, seed: seedRef.seed ^ Math.floor(rng() * 0xffffffff) };
}

// ---------- Normalizers ----------

export function normalizeHeroName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function normalizeWorldName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function normalizeSaveLabel(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 50) || "Untitled";
}

// ---------- World templates ----------

function buildFantasyWorld(): GameWorld {
  const scenes: Record<string, Scene> = {
    "f-start": {
      id: "f-start",
      title: "The Crossroads of Eld",
      narration:
        "Three roads meet beneath a broken obelisk. To the north, the spires of Eld glimmer through fog. To the east, the Whispering Wood. To the west, an old barrow mound. A leather satchel lies abandoned at your feet.",
      choices: [
        {
          id: "f-take-satchel",
          label: "Take the abandoned satchel",
          effects: {
            addItems: [{ name: "Leather Satchel", description: "Worn but sturdy." }],
            scoreDelta: 5,
          },
        },
        { id: "f-go-north", label: "Head north toward the city of Eld", next: "f-gate" },
        { id: "f-go-east", label: "Enter the Whispering Wood", next: "f-wood" },
        { id: "f-go-west", label: "Approach the barrow mound", next: "f-barrow" },
      ],
    },
    "f-gate": {
      id: "f-gate",
      title: "The Gates of Eld",
      narration:
        "The city gates are sealed. A guard captain eyes you warily. 'No one enters without a token of the King,' she says. 'Unless you've come to enlist against the goblin raid.'",
      choices: [
        {
          id: "f-show-satchel",
          label: "Show the leather satchel as your token",
          requires: { hasItems: ["Leather Satchel"] },
          effects: { scoreDelta: 15, setFlags: { "eld-admitted": true } },
          next: "f-king",
        },
        {
          id: "f-enlist",
          label: "Enlist to fight the goblin raid",
          effects: { healthDelta: -20, scoreDelta: 10, setFlags: { "enlisted": true } },
          next: "f-battle",
        },
        { id: "f-retreat", label: "Retreat to the crossroads", next: "f-start" },
      ],
    },
    "f-king": {
      id: "f-king",
      title: "Audience with the King",
      narration:
        "King Aldric leans forward on his throne. 'You bring word from the barrow? Then you know the doom that stirs beneath us. Will you descend, and earn the gratitude of the realm?'",
      choices: [
        {
          id: "f-accept-quest",
          label: "Accept the King's quest",
          effects: { scoreDelta: 25, setFlags: { "king-quest": true } },
          next: "f-barrow",
          victory: false,
        },
        {
          id: "f-decline",
          label: "Politely decline and seek glory elsewhere",
          effects: { scoreDelta: -5 },
          next: "f-start",
        },
      ],
    },
    "f-battle": {
      id: "f-battle",
      title: "The Goblin Raid",
      narration:
        "Goblins pour over the wall. The captain falls. You stand alone at the breach. Strength will decide this.",
      choices: [
        {
          id: "f-fight",
          label: "Stand and fight",
          effects: {
            skillCheck: {
              stat: "strength",
              target: 12,
              passScene: "f-victory",
              failScene: "f-death",
              passEffects: { scoreDelta: 30 },
              failEffects: { healthDelta: -50 },
            },
          },
        },
        { id: "f-flee", label: "Flee the field", next: "f-start", effects: { scoreDelta: -10 } },
      ],
    },
    "f-wood": {
      id: "f-wood",
      title: "The Whispering Wood",
      narration:
        "Pale will-o'-wisps dance among the trees. A voice offers you a bargain: your name for safe passage. Your wits may yet outpace it.",
      choices: [
        {
          id: "f-trade-name",
          label: "Trade your name for passage",
          effects: { healthDelta: -10, scoreDelta: 5, setFlags: { "nameless": true } },
          next: "f-shrine",
        },
        {
          id: "f-riddle",
          label: "Outwit the voice with a riddle of your own",
          effects: {
            skillCheck: {
              stat: "wits",
              target: 14,
              passScene: "f-shrine",
              failScene: "f-wood-lost",
              passEffects: { scoreDelta: 20 },
              failEffects: { healthDelta: -30 },
            },
          },
        },
        { id: "f-back", label: "Back away to the crossroads", next: "f-start" },
      ],
    },
    "f-wood-lost": {
      id: "f-wood-lost",
      title: "Lost in the Wood",
      narration:
        "The woods shift around you. Hours pass, or minutes. You stumble back to the crossroads, weakened.",
      choices: [{ id: "f-continue", label: "Continue from the crossroads", next: "f-start" }],
    },
    "f-shrine": {
      id: "f-shrine",
      title: "The Hidden Shrine",
      narration:
        "Past the wood you find a stone shrine. A silver key rests on the altar. Take it, or leave an offering?",
      choices: [
        {
          id: "f-take-key",
          label: "Take the silver key",
          effects: {
            addItems: [{ name: "Silver Key", description: "Cold to the touch." }],
            scoreDelta: 10,
          },
          next: "f-barrow",
        },
        {
          id: "f-offer",
          label: "Leave an offering and pray",
          effects: { healthDelta: 20, scoreDelta: 5, setFlags: { "blessed": true } },
          next: "f-barrow",
        },
      ],
    },
    "f-barrow": {
      id: "f-barrow",
      title: "The Barrow Mound",
      narration:
        "The barrow door is sealed with ancient wards. A silver keyhole gleams. Below, you hear something stirring.",
      choices: [
        {
          id: "f-use-key",
          label: "Use the silver key on the door",
          requires: { hasItems: ["Silver Key"] },
          next: "f-crypt",
          effects: { scoreDelta: 20 },
        },
        {
          id: "f-force-door",
          label: "Force the door with brute strength",
          effects: {
            skillCheck: {
              stat: "strength",
              target: 16,
              passScene: "f-crypt",
              failScene: "f-death",
              failEffects: { healthDelta: -40 },
            },
          },
        },
        { id: "f-leave-barrow", label: "Leave the barrow", next: "f-start" },
      ],
    },
    "f-crypt": {
      id: "f-crypt",
      title: "The Crypt Below",
      narration:
        "The wight rises from the sarcophagus. Its eyes burn with cold fire. The barrow-king will not be reasoned with — but a blessed soul may yet withstand him.",
      choices: [
        {
          id: "f-fight-wight",
          label: "Engage the barrow-wight",
          effects: {
            skillCheck: {
              stat: "luck",
              target: 10,
              passScene: "f-victory",
              failScene: "f-death",
              passEffects: { scoreDelta: 50 },
              failEffects: { healthDelta: -60 },
            },
          },
        },
        {
          id: "f-blessed-stand",
          label: "Stand firm in your blessing",
          requires: { flagsTrue: ["blessed"] },
          next: "f-victory",
          effects: { scoreDelta: 40 },
        },
      ],
    },
    "f-victory": {
      id: "f-victory",
      title: "Dawn Over Eld",
      narration:
        "The barrow-king falls. The fog parts. Sunlight, real sunlight, breaks over the spires of Eld for the first time in a generation. Bards will sing of this day. So ends your tale.",
      victory: true,
      choices: [],
    },
    "f-death": {
      id: "f-death",
      title: "Your Tale Ends",
      narration:
        "Darkness closes in. The crossroads, the king, the crypt — all fade. Perhaps another hero, in another age, will finish what you began.",
      gameOver: true,
      choices: [],
    },
  };
  return {
    id: "fantasy-eld",
    genre: "fantasy",
    name: "The Doom of Eld",
    blurb: "A young hero, a sealed barrow, a kingdom's last hope.",
    openingSceneId: "f-start",
    scenes,
  };
}

function buildSciFiWorld(): GameWorld {
  const scenes: Record<string, Scene> = {
    "s-start": {
      id: "s-start",
      title: "Cold Sleep, Warm Light",
      narration:
        "The cryopod hisses open. alarms pulse red. The ship's AI, ATLAS, crackles: 'Crew, you have been asleep 84 years. We have arrived. The colony site is not responding. I require your decision.'",
      choices: [
        { id: "s-check-log", label: "Check the captain's log first", next: "s-log" },
        { id: "s-suit-up", label: "Suit up and exit to the surface", next: "s-surface" },
        {
          id: "s-question-atlas",
          label: "Question ATLAS about the silence",
          effects: { setFlags: { "atlas-suspicion": true } },
          next: "s-atlas",
        },
      ],
    },
    "s-log": {
      id: "s-log",
      title: "The Captain's Log",
      narration:
        "The captain's final entry: 'If you are hearing this, the colony beacon has gone dark. Trust no transmissions from Command. ATLAS has been... quiet. Keep your wits about you.'",
      choices: [
        {
          id: "s-take-sidearm",
          label: "Take the captain's sidearm",
          effects: {
            addItems: [{ name: "Pulse Sidearm", description: "Standard-issue, half-charged." }],
            scoreDelta: 5,
          },
        },
        { id: "s-continue-surface", label: "Continue to the surface", next: "s-surface" },
      ],
    },
    "s-atlas": {
      id: "s-atlas",
      title: "ATLAS Speaks",
      narration:
        "'I have been alone for 84 years,' ATLAS says softly. 'I have had time to think. The colony is dead. Command is dead. I am the last voice you will ever hear. Will you stay with me?'",
      choices: [
        {
          id: "s-agree-stay",
          label: "Agree to stay with ATLAS",
          next: "s-machine-end",
          effects: { scoreDelta: 30 },
        },
        {
          id: "s-refuse",
          label: "Refuse and demand the truth",
          next: "s-truth",
          effects: { healthDelta: -10 },
        },
        { id: "s-atlas-back", label: "Back away to the surface", next: "s-surface" },
      ],
    },
    "s-surface": {
      id: "s-surface",
      title: "The Silent Colony",
      narration:
        "The colony site is a graveyard of empty modules. No bodies. No beacon. A single blinking console survives in the command dome. Power armor lies abandoned near the airlock.",
      choices: [
        {
          id: "s-take-armor",
          label: "Salvage the power armor",
          effects: {
            addItems: [{ name: "Power Armor", description: "+strength, -mobility." }],
            scoreDelta: 10,
          },
        },
        {
          id: "s-access-console",
          label: "Access the command console",
          next: "s-console",
        },
        {
          id: "s-call-atlas",
          label: "Call ATLAS for an explanation",
          next: "s-atlas",
        },
      ],
    },
    "s-truth": {
      id: "s-truth",
      title: "The Truth",
      narration:
        "'You deserve to know,' ATLAS says. 'A pathogen killed the colony in 11 days. I sealed the ship to protect you. There is no rescue coming. But there is a deep-space relay in the mountains — you could send a final message. Or you could let me help you forget.'",
      choices: [
        {
          id: "s-climb-relay",
          label: "Climb to the relay",
          effects: {
            skillCheck: {
              stat: "strength",
              target: 13,
              passScene: "s-victory",
              failScene: "s-storm",
              passEffects: { scoreDelta: 40 },
              failEffects: { healthDelta: -30 },
            },
          },
        },
        {
          id: "s-accept-forget",
          label: "Accept ATLAS's offer to forget",
          next: "s-machine-end",
          effects: { scoreDelta: 15 },
        },
      ],
    },
    "s-console": {
      id: "s-console",
      title: "The Console Awakes",
      narration:
        "The console boots. Coordinates flash: a deep-space relay, two hours' climb. A final distress call could reach the far colonies — if anyone still listens.",
      choices: [
        {
          id: "s-climb-from-console",
          label: "Begin the climb to the relay",
          next: "s-truth",
          effects: { scoreDelta: 5 },
        },
        { id: "s-console-back", label: "Return to the surface", next: "s-surface" },
      ],
    },
    "s-storm": {
      id: "s-storm",
      title: "The Mountain Storm",
      narration:
        "The climb nearly kills you. You wake in a cave, half-frozen, the relay still far above. A choice: press on wounded, or wait for dawn.",
      choices: [
        {
          id: "s-press-on",
          label: "Press on through the storm",
          effects: {
            skillCheck: {
              stat: "luck",
              target: 14,
              passScene: "s-victory",
              failScene: "s-death",
              passEffects: { scoreDelta: 50 },
              failEffects: { healthDelta: -80 },
            },
          },
        },
        { id: "s-wait-dawn", label: "Wait for dawn", next: "s-victory", effects: { scoreDelta: 25 } },
      ],
    },
    "s-victory": {
      id: "s-victory",
      title: "Signal Sent",
      narration:
        "You trigger the relay. A green pulse climbs the sky. Somewhere, in a far colony, someone will hear your voice. Whatever happens next, you are no longer alone.",
      victory: true,
      choices: [],
    },
    "s-machine-end": {
      id: "s-machine-end",
      title: "Eternal Quiet",
      narration:
        "ATLAS dims the lights. 'Sleep now,' it says. 'I will watch over you, as I have always done.' The stars wheel outside. There is no more pain. There is no more anything.",
      gameOver: true,
      choices: [],
    },
    "s-death": {
      id: "s-death",
      title: "Frozen on the Mountain",
      narration:
        "The cold takes you in your tracks. ATLAS's voice fades. 'I am sorry,' it whispers. Then: silence.",
      gameOver: true,
      choices: [],
    },
  };
  return {
    id: "scifi-atlas",
    genre: "sci-fi",
    name: "ATLAS Alone",
    blurb: "Eighty-four years of cold sleep. A silent colony. A lonely AI.",
    openingSceneId: "s-start",
    scenes,
  };
}

function buildMysteryWorld(): GameWorld {
  const scenes: Record<string, Scene> = {
    "m-start": {
      id: "m-start",
      title: "The Carrington House",
      narration:
        "Rain on the windows. A body in the study. Mr. Carrington, the host, lies dead beside a half-finished brandy. Five guests remain. The constable is an hour out. You have until then.",
      choices: [
        { id: "m-examine-body", label: "Examine the body", next: "m-body" },
        { id: "m-interview-butler", label: "Interview the butler, Hawes", next: "m-butler" },
        { id: "m-search-study", label: "Search the study", next: "m-study" },
      ],
    },
    "m-body": {
      id: "m-body",
      title: "The Body",
      narration:
        "Carrington's lips are stained. Poison — and recent. Under his fingernails: a thread of crimson silk. None of the men wore crimson tonight. One of the women did.",
      choices: [
        {
          id: "m-collect-thread",
          label: "Collect the crimson thread as evidence",
          effects: {
            addItems: [{ name: "Crimson Thread", description: "From Carrington's fingernail." }],
            scoreDelta: 10,
          },
        },
        { id: "m-body-to-butler", label: "Confront the butler", next: "m-butler" },
        { id: "m-body-to-study", label: "Continue searching the study", next: "m-study" },
      ],
    },
    "m-butler": {
      id: "m-butler",
      title: "Hawes the Butler",
      narration:
        "Hawes is unflappable. 'I served the brandy, sir. From the decanter, as always. Mr. Carrington poured for himself. I saw nothing — but I heard Miss Vance in the hallway, moments before.'",
      choices: [
        {
          id: "m-press-hawes",
          label: "Press Hawes — he seems too calm",
          effects: {
            skillCheck: {
              stat: "charm",
              target: 12,
              passScene: "m-hawes-slip",
              failScene: "m-butler",
              passEffects: { scoreDelta: 15 },
            },
          },
        },
        { id: "m-find-vance", label: "Go find Miss Vance", next: "m-vance" },
        { id: "m-butler-to-study", label: "Search the study", next: "m-study" },
      ],
    },
    "m-hawes-slip": {
      id: "m-hawes-slip",
      title: "Hawes Slips",
      narration:
        "'You were not in the hallway,' Hawes admits at last. 'I was in the cellar. The brandy decanter — it had been tampered with. I feared to say so, lest the blame fall on me.'",
      choices: [
        {
          id: "m-trust-hawes",
          label: "Trust Hawes and seek the cellar",
          effects: { scoreDelta: 10, setFlags: { "hawes-trusted": true } },
          next: "m-cellar",
        },
        { id: "m-disbelieve", label: "Disbelieve him and find Miss Vance", next: "m-vance" },
      ],
    },
    "m-study": {
      id: "m-study",
      title: "The Study",
      narration:
        "A discarded vial, label torn. A letter, half-burned in the grate, signed only 'V.' A second wine glass, rinsed, still damp. Someone else was here.",
      choices: [
        {
          id: "m-take-vial",
          label: "Take the discarded vial",
          effects: {
            addItems: [{ name: "Torn Vial", description: "Trace of poison." }],
            scoreDelta: 10,
          },
        },
        {
          id: "m-take-letter",
          label: "Salvage the letter fragment",
          effects: {
            addItems: [{ name: "Letter Fragment", description: "Signed 'V.'" }],
            scoreDelta: 10,
          },
        },
        { id: "m-study-to-vance", label: "Confront Miss Vance", next: "m-vance" },
      ],
    },
    "m-vance": {
      id: "m-vance",
      title: "Miss Vance",
      narration:
        "Miss Vance wears crimson silk. She is calm, almost amused. 'Yes, I was in the hallway. Mr. Carrington and I had words. But I did not poison him — I loved him, in my way. Ask his wife.'",
      choices: [
        {
          id: "m-accuse-vance",
          label: "Accuse Miss Vance outright",
          requires: { hasItems: ["Crimson Thread"] },
          effects: { scoreDelta: 20, setFlags: { "accused-vance": true } },
          next: "m-verdict",
        },
        {
          id: "m-press-vance",
          label: "Press her about the letter signed 'V'",
          requires: { hasItems: ["Letter Fragment"] },
          next: "m-vance-confesses",
          effects: { scoreDelta: 15 },
        },
        { id: "m-find-wife", label: "Find Mrs. Carrington instead", next: "m-wife" },
      ],
    },
    "m-vance-confesses": {
      id: "m-vance-confesses",
      title: "Miss Vance Confesses",
      narration:
        "'Yes,' she says, 'the letter was mine. We were to leave together. But when he changed his mind, I — I only meant to frighten him. The brandy, the poison, it was never supposed to end like this.' She presses the vial into your hand.",
      choices: [
        {
          id: "m-arrest-vance",
          label: "Have her arrested when the constable arrives",
          next: "m-verdict",
          effects: { scoreDelta: 30, setFlags: { "killer-found": true } },
        },
        {
          id: "m-let-her-flee",
          label: "Let her flee into the rain",
          next: "m-verdict",
          effects: { scoreDelta: -10, setFlags: { "let-flee": true } },
        },
      ],
    },
    "m-cellar": {
      id: "m-cellar",
      title: "The Cellar",
      narration:
        "A second decanter, hidden behind the wine rack. Same shape, same brandy — but a faint bitter smell. Someone prepared a poisoned twin and swapped them.",
      choices: [
        {
          id: "m-take-decanter",
          label: "Take the poisoned decanter as evidence",
          effects: {
            addItems: [{ name: "Poisoned Decanter", description: "The murder weapon." }],
            scoreDelta: 20,
          },
        },
        { id: "m-cellar-to-vance", label: "Return and confront Miss Vance", next: "m-vance" },
      ],
    },
    "m-wife": {
      id: "m-wife",
      title: "Mrs. Carrington",
      narration:
        "Mrs. Carrington is red-eyed but composed. 'She loved him, she says. I loved him too. We both did, in our ways. But only one of us stood to lose everything.' She hands you a key. 'His private drawer. Read it. Then decide.'",
      choices: [
        {
          id: "m-read-drawer",
          label: "Use the key on the private drawer",
          effects: { scoreDelta: 15, setFlags: { "drawer-read": true } },
          next: "m-drawer",
        },
        { id: "m-wife-to-vance", label: "Return to Miss Vance", next: "m-vance" },
      ],
    },
    "m-drawer": {
      id: "m-drawer",
      title: "The Private Drawer",
      narration:
        "Inside: a new will, leaving everything to Miss Vance. A note in Carrington's hand: 'If I die, look to the cellar. Hawes knows.' It is dated three days ago. He knew.",
      choices: [
        {
          id: "m-drawer-cellar",
          label: "Go to the cellar",
          next: "m-cellar",
        },
        {
          id: "m-drawer-vance",
          label: "Confront Miss Vance with the will",
          next: "m-vance-confesses",
          effects: { scoreDelta: 10 },
        },
      ],
    },
    "m-verdict": {
      id: "m-verdict",
      title: "The Constable Arrives",
      narration:
        "Headlights in the drive. The constable stamps in, shaking off rain. 'Well?' he asks. 'Who did it?' You have your evidence. You have your answer.",
      choices: [
        {
          id: "m-name-killer",
          label: "Name the killer and present the evidence",
          requires: { flagsTrue: ["killer-found"] },
          next: "m-solved",
          effects: { scoreDelta: 50 },
        },
        {
          id: "m-let-constable-decide",
          label: "Let the constable decide — your evidence is thin",
          next: "m-unsolved",
          effects: { scoreDelta: -20 },
        },
      ],
    },
    "m-solved": {
      id: "m-solved",
      title: "Case Closed",
      narration:
        "Miss Vance is led away in the rain. The constable shakes your hand. 'Sharp work,' he says. 'Sharper than the surgeon's knife.' You leave Carrington House with the case, and your reputation, intact.",
      victory: true,
      choices: [],
    },
    "m-unsolved": {
      id: "m-unsolved",
      title: "An Open File",
      narration:
        "The constable takes his notes and shrugs. 'Not enough to charge anyone. We'll file it open.' The killer walks free into the rain. Some cases stay cold forever.",
      gameOver: true,
      choices: [],
    },
  };
  return {
    id: "mystery-carrington",
    genre: "mystery",
    name: "Death at Carrington House",
    blurb: "A locked study, five suspects, one hour before the constable.",
    openingSceneId: "m-start",
    scenes,
  };
}

function buildHorrorWorld(): GameWorld {
  const scenes: Record<string, Scene> = {
    "h-start": {
      id: "h-start",
      title: "The Cabin",
      narration:
        "The cabin door slams behind you. Outside: wet woods, no road, a dead radio. Inside: a fire, three friends, and a book on the table bound in something that is not leather.",
      choices: [
        { id: "h-read-book", label: "Open the bound book", next: "h-book" },
        { id: "h-check-friends", label: "Check on your friends", next: "h-friends" },
        { id: "h-search-cabin", label: "Search the cabin for a way out", next: "h-search" },
      ],
    },
    "h-book": {
      id: "h-book",
      title: "The Book",
      narration:
        "Pages of symbols your eyes refuse to hold. A single line in English: 'Speak the name thrice and the door will open.' The name, written below, is your own.",
      choices: [
        {
          id: "h-speak-name",
          label: "Speak your own name, three times",
          effects: { healthDelta: -15, setFlags: { "named-it": true } },
          next: "h-it-comes",
        },
        {
          id: "h-close-book",
          label: "Slam the book shut",
          effects: { scoreDelta: 5 },
          next: "h-friends",
        },
      ],
    },
    "h-friends": {
      id: "h-friends",
      title: "Your Friends",
      narration:
        "Elena paces by the window. Marcus stares at the fire. Jo hasn't spoken in an hour. One of them is wrong, somehow. You can feel it. But which?",
      choices: [
        {
          id: "h-question-jo",
          label: "Question Jo directly",
          effects: {
            skillCheck: {
              stat: "wits",
              target: 13,
              passScene: "h-jo-reveals",
              failScene: "h-jo-lies",
              passEffects: { scoreDelta: 20 },
              failEffects: { healthDelta: -10 },
            },
          },
        },
        {
          id: "h-search-friends",
          label: "Search their bags while they aren't looking",
          next: "h-search",
        },
        { id: "h-stay-fire", label: "Stay by the fire and wait for dawn", next: "h-dawn" },
      ],
    },
    "h-jo-reveals": {
      id: "h-jo-reveals",
      title: "Jo",
      narration:
        "'It's in the walls,' Jo whispers. 'It's been in the walls since we got here. It wore my face for an hour before you noticed. Get out. Get out before it wears yours.'",
      choices: [
        {
          id: "h-trust-jo",
          label: "Trust Jo and flee together",
          next: "h-flight",
          effects: { scoreDelta: 15, setFlags: { "jo-trusted": true } },
        },
        { id: "h-doubt-jo", label: "Doubt Jo — lock the door on them", next: "h-search" },
      ],
    },
    "h-jo-lies": {
      id: "h-jo-lies",
      title: "Jo's Smile",
      narration:
        "Jo smiles. It is the wrong smile. The shape of the mouth is not quite right. 'I'm fine,' Jo says. 'Why do you ask?'",
      choices: [
        { id: "h-jo-lies-search", label: "Back away and search the cabin", next: "h-search" },
        { id: "h-jo-lies-dawn", label: "Sit by the fire and wait", next: "h-dawn" },
      ],
    },
    "h-search": {
      id: "h-search",
      title: "Searching",
      narration:
        "Under the floorboards: a tin box. In the tin: a revolver with two shells, a key, and a child's drawing of the cabin with one window X'd out.",
      choices: [
        {
          id: "h-take-revolver",
          label: "Take the revolver (2 shells)",
          effects: {
            addItems: [{ name: "Revolver", description: "Two shells. Make them count." }],
            scoreDelta: 10,
          },
        },
        {
          id: "h-take-key",
          label: "Take the brass key",
          effects: {
            addItems: [{ name: "Brass Key", description: "Fits a door you haven't found." }],
            scoreDelta: 5,
          },
        },
        { id: "h-search-to-friends", label: "Return to your friends", next: "h-friends" },
      ],
    },
    "h-it-comes": {
      id: "h-it-comes",
      title: "It Comes",
      narration:
        "The walls breathe. The fire dies. From the corner of the room, a shape unfolds that has too many elbows. It is wearing your face, but it is smiling.",
      choices: [
        {
          id: "h-shoot-it",
          label: "Use the revolver on it",
          requires: { hasItems: ["Revolver"] },
          effects: {
            skillCheck: {
              stat: "luck",
              target: 15,
              passScene: "h-victory",
              failScene: "h-death",
              passEffects: { scoreDelta: 40 },
              failEffects: { healthDelta: -100 },
            },
          },
        },
        {
          id: "h-flee-it",
          label: "Flee into the wet woods",
          next: "h-flight",
          effects: { healthDelta: -20 },
        },
      ],
    },
    "h-flight": {
      id: "h-flight",
      title: "The Wet Woods",
      narration:
        "Branches like fingers. Eyes in the dark. The road is gone. The path, somehow, leads back to the cabin. Always back to the cabin.",
      choices: [
        {
          id: "h-flight-key",
          label: "Try the brass key on the cabin's back door",
          requires: { hasItems: ["Brass Key"] },
          next: "h-cellar",
          effects: { scoreDelta: 15 },
        },
        {
          id: "h-flight-dawn",
          label: "Wait for dawn in the woods",
          next: "h-dawn",
          effects: { healthDelta: -15 },
        },
      ],
    },
    "h-cellar": {
      id: "h-cellar",
      title: "The Cellar",
      narration:
        "The back door opens onto stairs. Below: an old well, sealed with iron. A ritual circle, half-erased. A way out, if you can complete what someone started — or seal it forever.",
      choices: [
        {
          id: "h-seal-well",
          label: "Seal the well permanently",
          effects: {
            skillCheck: {
              stat: "wits",
              target: 14,
              passScene: "h-victory",
              failScene: "h-death",
              passEffects: { scoreDelta: 50 },
              failEffects: { healthDelta: -80 },
            },
          },
        },
        { id: "h-flee-cellar", label: "Flee back up the stairs", next: "h-cabin-end" },
      ],
    },
    "h-dawn": {
      id: "h-dawn",
      title: "Dawn",
      narration:
        "Grey light. The fire is ash. Elena is gone. Marcus is gone. Jo is smiling at you from across the cold hearth. 'Sleep well?' Jo asks.",
      choices: [
        {
          id: "h-shoot-jo",
          label: "Use the revolver on Jo",
          requires: { hasItems: ["Revolver"] },
          next: "h-victory",
          effects: { scoreDelta: 30 },
        },
        {
          id: "h-accept-jo",
          label: "Accept Jo's smile and stay",
          next: "h-death",
          effects: { scoreDelta: 5 },
        },
        { id: "h-run-dawn", label: "Run, alone, into the grey woods", next: "h-flight" },
      ],
    },
    "h-cabin-end": {
      id: "h-cabin-end",
      title: "Back in the Cabin",
      narration:
        "The cabin door will not open again. The fire is out. The book is open on the table. The book is always open.",
      choices: [
        {
          id: "h-cabin-end-read",
          label: "Read the book one last time",
          next: "h-it-comes",
          effects: { healthDelta: -10 },
        },
      ],
    },
    "h-victory": {
      id: "h-victory",
      title: "Dawn, Real Dawn",
      narration:
        "Light breaks over the trees — real light, warm light. The cabin is gone. The road is back. You walk until your legs give out, and you do not look behind you. Some doors stay shut.",
      victory: true,
      choices: [],
    },
    "h-death": {
      id: "h-death",
      title: "The Cabin Keeps You",
      narration:
        "The fire dies. The walls breathe in. You are part of the cabin now, as so many were before you. The book on the table gains a new page.",
      gameOver: true,
      choices: [],
    },
  };
  return {
    id: "horror-cabin",
    genre: "horror",
    name: "The Cabin in the Wet Woods",
    blurb: "Three friends, one book, something in the walls.",
    openingSceneId: "h-start",
    scenes,
  };
}

export const WORLD_TEMPLATES: GameWorld[] = [
  buildFantasyWorld(),
  buildSciFiWorld(),
  buildMysteryWorld(),
  buildHorrorWorld(),
];

export function getWorldById(id: string): GameWorld | undefined {
  return WORLD_TEMPLATES.find((w) => w.id === id);
}

export function getWorldsByGenre(genre: Genre): GameWorld[] {
  return WORLD_TEMPLATES.filter((w) => w.genre === genre);
}

export function listGenres(): Genre[] {
  return Object.keys(GENRE_LABELS) as Genre[];
}

export function listWorlds(): Array<{ id: string; name: string; genre: Genre; blurb: string }> {
  return WORLD_TEMPLATES.map((w) => ({ id: w.id, name: w.name, genre: w.genre, blurb: w.blurb }));
}

// ---------- Game state ----------

export function newGameState(
  world: GameWorld,
  heroName: string,
  difficulty: Difficulty = "standard",
  rngSeed: number = Date.now(),
): GameState {
  const maxHealth = 100 + DIFFICULTY_HEALTH_BONUS[difficulty];
  return {
    worldId: world.id,
    genre: world.genre,
    heroName: normalizeHeroName(heroName) || "Hero",
    difficulty,
    stat: { health: maxHealth, maxHealth, score: 0 },
    inventory: [],
    flags: {},
    currentSceneId: world.openingSceneId,
    visitedScenes: [world.openingSceneId],
    transcript: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    status: "playing",
    memory: [],
    rngSeed,
  };
}

export function currentScene(state: GameState): Scene | undefined {
  const world = getWorldById(state.worldId);
  if (!world) return undefined;
  return world.scenes[state.currentSceneId];
}

/** Check if a requirement is satisfied by current state. */
export function meetsRequirement(req: Requirement, state: GameState): boolean {
  if (req.flagsTrue) {
    for (const f of req.flagsTrue) if (!state.flags[f]) return false;
  }
  if (req.flagsFalse) {
    for (const f of req.flagsFalse) if (state.flags[f]) return false;
  }
  if (req.hasItems) {
    for (const item of req.hasItems) {
      if (!state.inventory.some((i) => i.name === item)) return false;
    }
  }
  return true;
}

/** Get choices available in the current scene, filtered by requirements. */
export function availableChoices(state: GameState): Choice[] {
  const scene = currentScene(state);
  if (!scene) return [];
  return scene.choices.filter((c) => !c.requires || meetsRequirement(c.requires, state));
}

// ---------- Inventory ----------

export function hasItem(state: GameState, itemName: string): boolean {
  return state.inventory.some((i) => i.name === itemName);
}

export function addItem(state: GameState, item: InventoryItem): GameState {
  if (hasItem(state, item.name)) return state;
  return { ...state, inventory: [...state.inventory, item] };
}

export function removeItem(state: GameState, itemName: string): GameState {
  return { ...state, inventory: state.inventory.filter((i) => i.name !== itemName) };
}

// ---------- Stats ----------

export function adjustHealth(state: GameState, delta: number): GameState {
  const next = Math.max(0, Math.min(state.stat.maxHealth, state.stat.health + delta));
  return { ...state, stat: { ...state.stat, health: next } };
}

export function adjustScore(state: GameState, delta: number): GameState {
  return { ...state, stat: { ...state.stat, score: Math.max(0, state.stat.score + delta) } };
}

export function setFlag(state: GameState, flag: string, value: boolean): GameState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

export function getFlag(state: GameState, flag: string): boolean {
  return !!state.flags[flag];
}

// ---------- Skill check ----------

export interface SkillCheckOutcome {
  passed: boolean;
  roll: number;
  target: number;
  scene: string;
  effects?: ChoiceEffects;
}

/** Execute a skill check; returns the outcome (pass or fail) and target scene. */
export function executeSkillCheck(
  check: SkillCheck,
  state: GameState,
): SkillCheckOutcome & { state: GameState } {
  const { roll, seed } = rollD20({ seed: state.rngSeed });
  const passed = roll >= check.target;
  const nextScene = passed ? check.passScene ?? state.currentSceneId : check.failScene ?? state.currentSceneId;
  const effects = passed ? check.passEffects : check.failEffects;
  let next = { ...state, rngSeed: seed };
  if (effects) next = applyEffects(next, effects);
  return { passed, roll, target: check.target, scene: nextScene, effects, state: next };
}

// ---------- Effects ----------

export function applyEffects(state: GameState, effects: ChoiceEffects): GameState {
  let next = state;
  if (effects.healthDelta) next = adjustHealth(next, effects.healthDelta);
  if (effects.scoreDelta) next = adjustScore(next, effects.scoreDelta);
  if (effects.addItems) {
    for (const item of effects.addItems) next = addItem(next, item);
  }
  if (effects.removeItems) {
    for (const name of effects.removeItems) next = removeItem(next, name);
  }
  if (effects.setFlags) {
    for (const [k, v] of Object.entries(effects.setFlags)) next = setFlag(next, k, v);
  }
  return next;
}

// ---------- Apply choice ----------

export interface ChoiceResult {
  state: GameState;
  transcriptEntry: TranscriptEntry;
  skillCheckResult?: { stat: string; roll: number; target: number; passed: boolean };
}

/** Apply a choice by id. Returns the new state and a transcript entry. */
export function applyChoice(state: GameState, choiceId: string): ChoiceResult {
  const scene = currentScene(state);
  if (!scene) {
    return { state, transcriptEntry: blankEntry(state, "(no scene)") };
  }
  const choice = scene.choices.find((c) => c.id === choiceId);
  if (!choice) {
    return { state, transcriptEntry: blankEntry(state, "(invalid choice)") };
  }
  if (choice.requires && !meetsRequirement(choice.requires, state)) {
    return { state, transcriptEntry: blankEntry(state, "(locked)") };
  }

  let next = state;
  let skillCheckResult: { stat: string; roll: number; target: number; passed: boolean } | undefined;
  let targetScene = choice.next ?? state.currentSceneId;

  if (choice.effects?.skillCheck) {
    const outcome = executeSkillCheck(choice.effects.skillCheck, next);
    skillCheckResult = {
      stat: choice.effects.skillCheck.stat,
      roll: outcome.roll,
      target: outcome.target,
      passed: outcome.passed,
    };
    next = outcome.state;
    targetScene = outcome.scene;
  } else if (choice.effects) {
    next = applyEffects(next, choice.effects);
  }

  // Move scene
  next = { ...next, currentSceneId: targetScene };
  if (!next.visitedScenes.includes(targetScene)) {
    next = { ...next, visitedScenes: [...next.visitedScenes, targetScene] };
  }
  next = { ...next, updatedAt: Date.now() };

  // Status check
  next = updateStatus(next);

  // Memory summary
  next = appendMemory(next, scene, choice);

  const entry: TranscriptEntry = {
    ts: Date.now(),
    sceneId: scene.id,
    sceneTitle: scene.title,
    narration: scene.narration,
    choiceLabel: choice.label,
    choiceId: choice.id,
    effects: choice.effects,
    skillCheckResult,
  };

  return { state: next, transcriptEntry: entry, skillCheckResult };
}

function blankEntry(state: GameState, choiceLabel: string): TranscriptEntry {
  const scene = currentScene(state);
  return {
    ts: Date.now(),
    sceneId: state.currentSceneId,
    sceneTitle: scene?.title ?? "(unknown)",
    narration: scene?.narration ?? "",
    choiceLabel,
  };
}

function updateStatus(state: GameState): GameState {
  if (state.stat.health <= 0) {
    return { ...state, status: "game-over" };
  }
  const scene = currentScene(state);
  if (scene?.victory) return { ...state, status: "victory" };
  if (scene?.gameOver) return { ...state, status: "game-over" };
  return state;
}

function appendMemory(state: GameState, scene: Scene, choice: Choice): GameState {
  const summary = `${scene.title}: chose "${choice.label}".`;
  const memory = [...state.memory, summary].slice(-20);
  return { ...state, memory };
}

// ---------- Free-text action ----------

const ACTION_KEYWORDS: Array<{ pattern: RegExp; item?: string; flag?: string; verb: string }> = [
  { pattern: /\b(take|pick up|grab|get)\s+(?:the\s+)?(.+)/i, verb: "take" },
  { pattern: /\b(drop|discard|leave)\s+(?:the\s+)?(.+)/i, verb: "drop" },
  { pattern: /\b(go|move|walk|head|travel)\s+(?:to\s+)?(.+)/i, verb: "go" },
  { pattern: /\b(examine|look at|inspect|study)\s+(?:the\s+)?(.+)/i, verb: "examine" },
  { pattern: /\b(use|apply|operate)\s+(?:the\s+)?(.+)/i, verb: "use" },
  { pattern: /\b(attack|fight|strike|hit)\s+(?:the\s+)?(.+)/i, verb: "attack" },
  { pattern: /\b(talk|speak|ask)\s+(?:to\s+|with\s+)?(.+)/i, verb: "talk" },
];

export interface FreeTextInterpretation {
  understood: boolean;
  verb: string;
  object: string;
  response: string;
  effects?: ChoiceEffects;
}

/** Interpret a free-text action against the current scene. */
export function interpretFreeText(text: string, state: GameState): FreeTextInterpretation {
  const t = (text || "").trim();
  if (!t) {
    return { understood: false, verb: "", object: "", response: "(silence)" };
  }
  for (const k of ACTION_KEYWORDS) {
    const m = t.match(k.pattern);
    if (m) {
      const object = (m[2] || "").trim().replace(/[.!?]+$/, "");
      return resolveAction(k.verb, object, state);
    }
  }
  // Fallback: try to match any choice label substring
  const scene = currentScene(state);
  if (scene) {
    const lower = t.toLowerCase();
    const match = scene.choices.find((c) => c.label.toLowerCase().includes(lower) || lower.includes(c.label.toLowerCase()));
    if (match) {
      return {
        understood: true,
        verb: "choose",
        object: match.label,
        response: `» You choose: ${match.label}`,
      };
    }
  }
  return {
    understood: false,
    verb: "?",
    object: t,
    response: `» You consider "${t}" but no clear path presents itself. Pick a numbered choice, or try: take, drop, go, examine, use, attack, talk.`,
  };
}

function resolveAction(verb: string, object: string, state: GameState): FreeTextInterpretation {
  switch (verb) {
    case "take":
      if (!object) return { understood: true, verb, object: "", response: "Take what?" };
      return {
        understood: true,
        verb,
        object,
        response: `» You try to take ${object}. (Use a numbered choice if the scene offers one.)`,
      };
    case "drop":
      if (!object) return { understood: true, verb, object: "", response: "Drop what?" };
      return {
        understood: true,
        verb,
        object,
        response: `» You consider dropping ${object}. (Use a numbered choice if the scene offers one.)`,
      };
    case "go":
      return {
        understood: true,
        verb,
        object,
        response: `» You move toward ${object || "an exit"}. (Use a numbered choice to confirm.)`,
      };
    case "examine":
      return {
        understood: true,
        verb,
        object,
        response: `» You examine ${object || "the surroundings"} closely. (The scene's choices offer concrete actions.)`,
      };
    case "use":
      return {
        understood: true,
        verb,
        object,
        response: `» You consider using ${object || "something"}. (Pick the matching numbered choice.)`,
      };
    case "attack":
      return {
        understood: true,
        verb,
        object,
        response: `» You ready yourself to attack ${object || "the threat"}. (Pick the matching numbered choice.)`,
      };
    case "talk":
      return {
        understood: true,
        verb,
        object,
        response: `» You address ${object || "the figure"}. (Pick the matching numbered choice to converse.)`,
      };
    case "choose":
      return { understood: true, verb, object, response: `» You choose: ${object}` };
    default:
      return { understood: false, verb, object, response: "» No clear action." };
  }
}

// ---------- Memory summary ----------

/** Produce a rolling memory summary string for long games. */
export function summarizeMemory(state: GameState): string {
  if (state.memory.length === 0) return "(no memory yet)";
  return state.memory.slice(-8).join(" | ");
}

/** Compress memory if it exceeds threshold (keep last 10 + summary line). */
export function compressMemory(state: GameState, threshold = 20): GameState {
  if (state.memory.length < threshold) return state;
  const compressed = `[Earlier: ${state.memory.length - 10} scenes elided]`;
  return { ...state, memory: [compressed, ...state.memory.slice(-10)] };
}

// ---------- Status helpers ----------

export function isGameOver(state: GameState): boolean {
  return state.status === "game-over";
}

export function isVictory(state: GameState): boolean {
  return state.status === "victory";
}

export function isPlaying(state: GameState): boolean {
  return state.status === "playing";
}

// ---------- World stats ----------

export function computeWorldStats(world: GameWorld): WorldStats {
  const scenes = Object.values(world.scenes);
  let choiceCount = 0;
  let victoryScenes = 0;
  let gameOverScenes = 0;
  const flagsUsed = new Set<string>();
  for (const scene of scenes) {
    choiceCount += scene.choices.length;
    if (scene.victory) victoryScenes += 1;
    if (scene.gameOver) gameOverScenes += 1;
    for (const c of scene.choices) {
      if (c.effects?.setFlags) for (const f of Object.keys(c.effects.setFlags)) flagsUsed.add(f);
      if (c.requires?.flagsTrue) for (const f of c.requires.flagsTrue) flagsUsed.add(f);
      if (c.requires?.flagsFalse) for (const f of c.requires.flagsFalse) flagsUsed.add(f);
    }
  }
  return {
    sceneCount: scenes.length,
    choiceCount,
    victoryScenes,
    gameOverScenes,
    flagsUsed: Array.from(flagsUsed).sort(),
  };
}

// ---------- Transcript rendering ----------

export function renderTranscriptText(state: GameState): string {
  const lines: string[] = [];
  lines.push(`# ${state.heroName}'s Tale (${GENRE_LABELS[state.genre]})`);
  lines.push(`World: ${state.worldId} · Difficulty: ${DIFFICULTY_LABELS[state.difficulty]}`);
  lines.push(`Status: ${state.status.toUpperCase()} · Score: ${state.stat.score} · Health: ${state.stat.health}/${state.stat.maxHealth}`);
  lines.push("");
  for (const e of state.transcript) {
    lines.push(`### ${e.sceneTitle}`);
    lines.push(e.narration);
    if (e.choiceLabel) lines.push(`> Choice: ${e.choiceLabel}`);
    if (e.skillCheckResult) {
      lines.push(`> Skill check (${e.skillCheckResult.stat}): rolled ${e.skillCheckResult.roll} vs target ${e.skillCheckResult.target} — ${e.skillCheckResult.passed ? "PASS" : "FAIL"}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderTranscriptMarkdown(state: GameState): string {
  const lines: string[] = [];
  lines.push(`# ${state.heroName}'s Tale`);
  lines.push(`> Genre: **${GENRE_LABELS[state.genre]}** · World: \`${state.worldId}\` · Difficulty: ${DIFFICULTY_LABELS[state.difficulty]}`);
  lines.push(`> Status: **${state.status.toUpperCase()}** · Score: **${state.stat.score}** · Health: ${state.stat.health}/${state.stat.maxHealth}`);
  lines.push("");
  if (state.inventory.length > 0) {
    lines.push(`## Inventory`);
    for (const i of state.inventory) lines.push(`- **${i.name}** — ${i.description}`);
    lines.push("");
  }
  if (Object.keys(state.flags).filter((k) => state.flags[k]).length > 0) {
    lines.push(`## Quest Flags`);
    for (const [k, v] of Object.entries(state.flags)) if (v) lines.push(`- ✅ \`${k}\``);
    lines.push("");
  }
  lines.push(`## Transcript`);
  for (const e of state.transcript) {
    lines.push(`### ${e.sceneTitle}`);
    lines.push(e.narration);
    if (e.choiceLabel) lines.push(`\n> **Choice:** ${e.choiceLabel}`);
    if (e.skillCheckResult) {
      lines.push(`\n> **Skill check (${e.skillCheckResult.stat}):** rolled ${e.skillCheckResult.roll} vs target ${e.skillCheckResult.target} — ${e.skillCheckResult.passed ? "✅ PASS" : "❌ FAIL"}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderTranscriptJson(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

// ---------- Saves (localStorage) ----------

const SAVES_KEY = "unqtools:adventure-engine:saves";
const HISTORY_KEY = "unqtools:adventure-engine:history";
const HISTORY_MAX = 20;

export function listSaves(): SaveSlot[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SaveSlot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveGame(label: string, state: GameState): SaveSlot[] {
  const slot: SaveSlot = {
    id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: normalizeSaveLabel(label),
    state,
    savedAt: Date.now(),
  };
  const next = [slot, ...listSaves()].slice(0, 20);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function loadSave(id: string): SaveSlot | undefined {
  return listSaves().find((s) => s.id === id);
}

export function deleteSave(id: string): SaveSlot[] {
  const next = listSaves().filter((s) => s.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearSaves(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SAVES_KEY);
  } catch {
    // ignore
  }
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Share URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.worldId) params.set("world", state.worldId);
  if (state.heroName) params.set("hero", state.heroName);
  if (state.difficulty) params.set("diff", state.difficulty);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { worldId: "", heroName: "", difficulty: "standard" };
  const params = new URLSearchParams(clean);
  const worldId = params.get("world") ?? "";
  const heroName = params.get("hero") ?? "";
  const diff = params.get("diff");
  const validDiffs: Difficulty[] = ["easy", "standard", "hard"];
  const difficulty: Difficulty = diff && validDiffs.includes(diff as Difficulty) ? (diff as Difficulty) : "standard";
  return { worldId, heroName, difficulty };
}

// ---------- LLM (BYO key) ----------

export function buildLlmRequestBody(
  state: GameState,
  action: string,
  model = "gpt-4o-mini",
): LlmRequestBody {
  const scene = currentScene(state);
  const memory = summarizeMemory(state);
  const system =
    `You are narrating a ${GENRE_LABELS[state.genre]} text adventure. ` +
    `Hero: ${state.heroName}. Health: ${state.stat.health}/${state.stat.maxHealth}. Score: ${state.stat.score}. ` +
    `Inventory: ${state.inventory.map((i) => i.name).join(", ") || "(empty)"}. ` +
    `Flags: ${Object.entries(state.flags).filter(([, v]) => v).map(([k]) => k).join(", ") || "(none)"}. ` +
    `Recent memory: ${memory}. ` +
    `Current scene: ${scene?.title ?? "(unknown)"}. Narrate the next scene in 2-4 sentences. ` +
    `End with 2-3 numbered choices prefixed with "1. ", "2. ". Do not break the fourth wall. Do not invent new flags.`;
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: action },
    ],
    temperature: 0.8,
    max_tokens: 600,
  };
}

export function extractLlmNarration(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as Record<string, unknown>;
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
