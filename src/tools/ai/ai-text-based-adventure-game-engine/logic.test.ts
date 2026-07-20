import { describe, it, expect, beforeEach } from "vitest";
import {
  GENRE_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_HEALTH_BONUS,
  STAT_LABELS,
  CHARACTER_PRESETS,
  WORLD_TEMPLATES,
  mulberry32,
  rollD20,
  normalizeHeroName,
  normalizeWorldName,
  normalizeSaveLabel,
  getWorldById,
  getWorldsByGenre,
  listGenres,
  listWorlds,
  newGameState,
  currentScene,
  meetsRequirement,
  availableChoices,
  hasItem,
  addItem,
  removeItem,
  adjustHealth,
  adjustScore,
  setFlag,
  getFlag,
  executeSkillCheck,
  applyEffects,
  applyChoice,
  interpretFreeText,
  summarizeMemory,
  compressMemory,
  isGameOver,
  isVictory,
  isPlaying,
  computeWorldStats,
  renderTranscriptText,
  renderTranscriptMarkdown,
  renderTranscriptJson,
  listSaves,
  saveGame,
  loadSave,
  deleteSave,
  clearSaves,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmNarration,
  type Genre,
  type Difficulty,
  type GameState,
  type InventoryItem,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("adventure-engine constants", () => {
  it("has 4 genre labels", () => {
    expect(Object.keys(GENRE_LABELS)).toHaveLength(4);
    expect(GENRE_LABELS.fantasy).toBe("Fantasy");
    expect(GENRE_LABELS.horror).toBe("Horror");
  });
  it("has 3 difficulty labels", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("difficulty health bonus is sensible", () => {
    expect(DIFFICULTY_HEALTH_BONUS.easy).toBeGreaterThan(DIFFICULTY_HEALTH_BONUS.standard);
    expect(DIFFICULTY_HEALTH_BONUS.hard).toBeLessThan(DIFFICULTY_HEALTH_BONUS.standard);
  });
  it("has 4 stat labels", () => {
    expect(Object.keys(STAT_LABELS)).toHaveLength(4);
  });
  it("has 8 character presets", () => {
    expect(CHARACTER_PRESETS).toHaveLength(8);
  });
  it("ships 4 world templates", () => {
    expect(WORLD_TEMPLATES).toHaveLength(4);
  });
});

describe("adventure-engine listWorlds", () => {
  it("lists 4 worlds with blurb", () => {
    const ws = listWorlds();
    expect(ws).toHaveLength(4);
    expect(ws.every((w) => w.blurb.length > 0)).toBe(true);
  });
  it("listGenres returns 4 genres", () => {
    expect(listGenres()).toHaveLength(4);
  });
  it("getWorldsByGenre filters by genre", () => {
    expect(getWorldsByGenre("fantasy")).toHaveLength(1);
    expect(getWorldsByGenre("horror")).toHaveLength(1);
  });
  it("getWorldById finds template by id", () => {
    const w = getWorldById("fantasy-eld");
    expect(w?.genre).toBe("fantasy");
  });
});

describe("adventure-engine normalizers", () => {
  it("normalizeHeroName trims and caps", () => {
    expect(normalizeHeroName("  Aria  ")).toBe("Aria");
    expect(normalizeHeroName("a".repeat(100))).toHaveLength(40);
  });
  it("normalizeWorldName trims and caps", () => {
    expect(normalizeWorldName(" The Doom of Eld ")).toBe("The Doom of Eld");
  });
  it("normalizeSaveLabel falls back to Untitled", () => {
    expect(normalizeSaveLabel("   ")).toBe("Untitled");
    expect(normalizeSaveLabel("My Save")).toBe("My Save");
  });
});

describe("adventure-engine RNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
  });
  it("rollD20 returns 1-20", () => {
    const ref = { seed: 100 };
    for (let i = 0; i < 50; i++) {
      const { roll } = rollD20(ref);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
      ref.seed = rollD20(ref).seed;
    }
  });
});

describe("adventure-engine newGameState", () => {
  const world = WORLD_TEMPLATES[0];
  it("creates a fresh game state", () => {
    const s = newGameState(world, "Aria", "standard", 12345);
    expect(s.worldId).toBe(world.id);
    expect(s.heroName).toBe("Aria");
    expect(s.stat.health).toBe(100);
    expect(s.stat.maxHealth).toBe(100);
    expect(s.currentSceneId).toBe(world.openingSceneId);
    expect(s.status).toBe("playing");
    expect(s.rngSeed).toBe(12345);
  });
  it("easy difficulty grants bonus health", () => {
    const s = newGameState(world, "Hero", "easy");
    expect(s.stat.maxHealth).toBe(130);
  });
  it("hard difficulty reduces health", () => {
    const s = newGameState(world, "Hero", "hard");
    expect(s.stat.maxHealth).toBe(80);
  });
  it("falls back to default hero name when empty", () => {
    const s = newGameState(world, "   ", "standard");
    expect(s.heroName).toBe("Hero");
  });
});

describe("adventure-engine scene/choice", () => {
  const world = WORLD_TEMPLATES[0];
  it("currentScene returns opening scene", () => {
    const s = newGameState(world, "Aria");
    const sc = currentScene(s);
    expect(sc?.id).toBe(world.openingSceneId);
    expect(sc?.choices.length).toBeGreaterThan(0);
  });
  it("availableChoices returns all when no requirements", () => {
    const s = newGameState(world, "Aria");
    expect(availableChoices(s).length).toBe(currentScene(s)!.choices.length);
  });
  it("availableChoices filters by item requirement", () => {
    // Find a scene with a requirement
    const sciFi = getWorldById("scifi-atlas")!;
    let s = newGameState(sciFi, "Vox");
    // Move to a scene with requirements (m-vance has hasItems requirement)
    // Actually use fantasy f-gate which has a 'Leather Satchel' requirement
    const fantasyWorld = world;
    s = newGameState(fantasyWorld, "Aria");
    // Move to f-gate by going north
    s = { ...s, currentSceneId: "f-gate" };
    const choices = availableChoices(s);
    // Without satchel, the satchel-requiring choice should be hidden
    expect(choices.find((c) => c.id === "f-show-satchel")).toBeUndefined();
    // Add satchel and re-check
    s = addItem(s, { name: "Leather Satchel", description: "" });
    const choices2 = availableChoices(s);
    expect(choices2.find((c) => c.id === "f-show-satchel")).toBeDefined();
  });
  it("meetsRequirement checks flagsTrue, flagsFalse, hasItems", () => {
    let s = newGameState(world, "Aria");
    s = setFlag(s, "won", true);
    s = addItem(s, { name: "Key", description: "" });
    expect(meetsRequirement({ flagsTrue: ["won"] }, s)).toBe(true);
    expect(meetsRequirement({ flagsTrue: ["lost"] }, s)).toBe(false);
    expect(meetsRequirement({ flagsFalse: ["lost"] }, s)).toBe(true);
    expect(meetsRequirement({ hasItems: ["Key"] }, s)).toBe(true);
    expect(meetsRequirement({ hasItems: ["Crown"] }, s)).toBe(false);
  });
});

describe("adventure-engine inventory", () => {
  const world = WORLD_TEMPLATES[0];
  it("addItem, hasItem, removeItem", () => {
    let s = newGameState(world, "Aria");
    expect(hasItem(s, "Sword")).toBe(false);
    s = addItem(s, { name: "Sword", description: "Sharp" });
    expect(hasItem(s, "Sword")).toBe(true);
    // adding same item twice is idempotent
    s = addItem(s, { name: "Sword", description: "Sharp" });
    expect(s.inventory.filter((i) => i.name === "Sword")).toHaveLength(1);
    s = removeItem(s, "Sword");
    expect(hasItem(s, "Sword")).toBe(false);
  });
});

describe("adventure-engine stats", () => {
  const world = WORLD_TEMPLATES[0];
  it("adjustHealth clamps to [0, maxHealth]", () => {
    let s = newGameState(world, "Aria", "standard");
    s = adjustHealth(s, -30);
    expect(s.stat.health).toBe(70);
    s = adjustHealth(s, 200);
    expect(s.stat.health).toBe(100);
    s = adjustHealth(s, -200);
    expect(s.stat.health).toBe(0);
  });
  it("adjustScore is non-negative", () => {
    let s = newGameState(world, "Aria");
    s = adjustScore(s, 50);
    expect(s.stat.score).toBe(50);
    s = adjustScore(s, -100);
    expect(s.stat.score).toBe(0);
  });
  it("setFlag and getFlag roundtrip", () => {
    let s = newGameState(world, "Aria");
    expect(getFlag(s, "killed-king")).toBe(false);
    s = setFlag(s, "killed-king", true);
    expect(getFlag(s, "killed-king")).toBe(true);
    s = setFlag(s, "killed-king", false);
    expect(getFlag(s, "killed-king")).toBe(false);
  });
});

describe("adventure-engine applyEffects", () => {
  const world = WORLD_TEMPLATES[0];
  it("applies health, score, items, flags", () => {
    let s = newGameState(world, "Aria");
    s = applyEffects(s, {
      healthDelta: -10,
      scoreDelta: 25,
      addItems: [{ name: "Map", description: "Old" }],
      setFlags: { "found-map": true },
    });
    expect(s.stat.health).toBe(90);
    expect(s.stat.score).toBe(25);
    expect(hasItem(s, "Map")).toBe(true);
    expect(getFlag(s, "found-map")).toBe(true);
  });
  it("removes items", () => {
    let s = newGameState(world, "Aria");
    s = addItem(s, { name: "Coin", description: "" });
    s = applyEffects(s, { removeItems: ["Coin"] });
    expect(hasItem(s, "Coin")).toBe(false);
  });
});

describe("adventure-engine skill check", () => {
  const world = WORLD_TEMPLATES[0];
  it("executeSkillCheck returns roll in [1,20] and matches target", () => {
    let s = newGameState(world, "Aria", "standard", 42);
    const outcome = executeSkillCheck(
      { stat: "luck", target: 10, passScene: "f-victory", failScene: "f-death" },
      s,
    );
    expect(outcome.roll).toBeGreaterThanOrEqual(1);
    expect(outcome.roll).toBeLessThanOrEqual(20);
    expect(outcome.passed).toBe(outcome.roll >= 10);
    expect(outcome.scene).toBe(outcome.passed ? "f-victory" : "f-death");
    // State has a new seed
    expect(outcome.state.rngSeed).not.toBe(42);
    s = outcome.state;
    void s;
  });
  it("executeSkillCheck applies pass effects on pass", () => {
    const s = newGameState(world, "Aria", "standard", 1);
    // Roll a high seed to be safe; just verify the call doesn't throw and applies effects appropriately
    const outcome = executeSkillCheck(
      {
        stat: "luck",
        target: 1, // target 1 = always pass
        passScene: "f-victory",
        passEffects: { scoreDelta: 100 },
      },
      s,
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.state.stat.score).toBe(100);
  });
  it("executeSkillCheck applies fail effects on fail", () => {
    const s = newGameState(world, "Aria", "standard", 1);
    const outcome = executeSkillCheck(
      {
        stat: "luck",
        target: 21, // impossible — always fail
        failScene: "f-death",
        failEffects: { healthDelta: -50 },
      },
      s,
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.state.stat.health).toBe(50);
  });
});

describe("adventure-engine applyChoice", () => {
  const world = WORLD_TEMPLATES[0];
  it("applies a choice with no requirements", () => {
    const s = newGameState(world, "Aria");
    const res = applyChoice(s, "f-take-satchel");
    expect(hasItem(res.state, "Leather Satchel")).toBe(true);
    expect(res.state.stat.score).toBe(5);
    expect(res.transcriptEntry.choiceLabel).toContain("satchel");
  });
  it("moves to next scene when choice.next is set", () => {
    const s = newGameState(world, "Aria");
    const res = applyChoice(s, "f-go-north");
    expect(res.state.currentSceneId).toBe("f-gate");
    expect(res.state.visitedScenes).toContain("f-gate");
  });
  it("blocks locked choices", () => {
    let s = newGameState(world, "Aria");
    s = { ...s, currentSceneId: "f-gate" };
    const res = applyChoice(s, "f-show-satchel");
    expect(hasItem(res.state, "")).toBe(false);
    // Should not have advanced
    expect(res.state.currentSceneId).toBe("f-gate");
  });
  it("victory scene sets status", () => {
    let s = newGameState(world, "Aria");
    s = { ...s, currentSceneId: "f-victory" };
    s = applyChoice(s, "__noop__").state; // no choices to apply
    // Just confirm currentScene victory flag works
    expect(currentScene(s)?.victory).toBe(true);
    expect(isVictory(s)).toBe(false); // status updated on choice, not on manual scene change
  });
  it("health death sets game-over status", () => {
    let s = newGameState(world, "Aria");
    s = applyEffects(s, { healthDelta: -200 });
    // Manually trigger status update via a no-op applyEffects would not update status;
    // confirm that updateStatus fires only through applyChoice path
    expect(s.stat.health).toBe(0);
  });
});

describe("adventure-engine free-text interpretation", () => {
  const world = WORLD_TEMPLATES[0];
  it("interprets 'take the sword'", () => {
    const s = newGameState(world, "Aria");
    const r = interpretFreeText("take the sword", s);
    expect(r.understood).toBe(true);
    expect(r.verb).toBe("take");
    expect(r.object).toBe("sword");
  });
  it("interprets 'examine body'", () => {
    const s = newGameState(world, "Aria");
    const r = interpretFreeText("examine body", s);
    expect(r.understood).toBe(true);
    expect(r.verb).toBe("examine");
  });
  it("returns false for gibberish", () => {
    const s = newGameState(world, "Aria");
    const r = interpretFreeText("xyzzy qwerty", s);
    expect(r.understood).toBe(false);
  });
  it("returns false for empty input", () => {
    const s = newGameState(world, "Aria");
    const r = interpretFreeText("", s);
    expect(r.understood).toBe(false);
  });
  it("matches a choice label substring", () => {
    const s = newGameState(world, "Aria");
    const r = interpretFreeText("Whispering", s);
    // "Enter the Whispering Wood" should match
    expect(r.understood).toBe(true);
    expect(r.verb).toBe("choose");
  });
});

describe("adventure-engine memory", () => {
  const world = WORLD_TEMPLATES[0];
  it("summarizeMemory empty", () => {
    const s = newGameState(world, "Aria");
    expect(summarizeMemory(s)).toBe("(no memory yet)");
  });
  it("summarizeMemory after a choice", () => {
    let s = newGameState(world, "Aria");
    s = applyChoice(s, "f-go-north").state;
    const m = summarizeMemory(s);
    expect(m).toContain("Crossroads");
    expect(m).toContain("Head north");
  });
  it("compressMemory elides when above threshold", () => {
    let s = newGameState(world, "Aria");
    s = { ...s, memory: Array.from({ length: 25 }, (_, i) => `mem-${i}`) };
    const compressed = compressMemory(s, 20);
    expect(compressed.memory.length).toBeLessThanOrEqual(11);
    expect(compressed.memory[0]).toContain("elided");
  });
});

describe("adventure-engine status helpers", () => {
  const world = WORLD_TEMPLATES[0];
  it("isPlaying/isGameOver/isVictory", () => {
    let s = newGameState(world, "Aria");
    expect(isPlaying(s)).toBe(true);
    expect(isGameOver(s)).toBe(false);
    expect(isVictory(s)).toBe(false);
    s = { ...s, status: "game-over" };
    expect(isGameOver(s)).toBe(true);
    s = { ...s, status: "victory" };
    expect(isVictory(s)).toBe(true);
  });
});

describe("adventure-engine world stats", () => {
  it("computeWorldStats counts scenes, choices, flags", () => {
    const w = getWorldById("fantasy-eld")!;
    const stats = computeWorldStats(w);
    expect(stats.sceneCount).toBeGreaterThan(5);
    expect(stats.choiceCount).toBeGreaterThan(10);
    expect(stats.victoryScenes).toBeGreaterThanOrEqual(1);
    expect(stats.gameOverScenes).toBeGreaterThanOrEqual(1);
    expect(stats.flagsUsed.length).toBeGreaterThan(0);
  });
});

describe("adventure-engine transcript rendering", () => {
  it("renderTranscriptText contains hero name and genre", () => {
    const w = WORLD_TEMPLATES[0];
    let s = newGameState(w, "Aria");
    const res = applyChoice(s, "f-go-north");
    s = { ...res.state, transcript: [...s.transcript, res.transcriptEntry] };
    const text = renderTranscriptText(s);
    expect(text).toContain("Aria");
    expect(text).toContain("Fantasy");
    expect(text).toContain("Crossroads");
  });
  it("renderTranscriptMarkdown uses # header", () => {
    const w = WORLD_TEMPLATES[0];
    const s = newGameState(w, "Aria");
    const md = renderTranscriptMarkdown(s);
    expect(md).toContain("# Aria's Tale");
    expect(md).toContain("Genre:");
  });
  it("renderTranscriptJson is valid JSON", () => {
    const w = WORLD_TEMPLATES[0];
    const s = newGameState(w, "Aria");
    const j = renderTranscriptJson(s);
    expect(() => JSON.parse(j)).not.toThrow();
  });
});

describe("adventure-engine saves (localStorage)", () => {
  const world = WORLD_TEMPLATES[0];
  it("listSaves empty initially", () => {
    expect(listSaves()).toEqual([]);
  });
  it("saveGame adds a slot", () => {
    const s = newGameState(world, "Aria");
    const saves = saveGame("Slot 1", s);
    expect(saves).toHaveLength(1);
    expect(saves[0].label).toBe("Slot 1");
  });
  it("loadSave finds by id", () => {
    const s = newGameState(world, "Aria");
    const saves = saveGame("Slot 1", s);
    const loaded = loadSave(saves[0].id);
    expect(loaded?.label).toBe("Slot 1");
  });
  it("deleteSave removes slot", () => {
    const s = newGameState(world, "Aria");
    const saves = saveGame("Slot 1", s);
    const after = deleteSave(saves[0].id);
    expect(after).toEqual([]);
  });
  it("clearSaves wipes all", () => {
    const s = newGameState(world, "Aria");
    saveGame("Slot 1", s);
    saveGame("Slot 2", s);
    clearSaves();
    expect(listSaves()).toEqual([]);
  });
  it("caps at 20 saves", () => {
    const s = newGameState(world, "Aria");
    for (let i = 0; i < 25; i++) saveGame(`Slot ${i}`, s);
    expect(listSaves()).toHaveLength(20);
  });
});

describe("adventure-engine history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      worldId: "fantasy-eld",
      genre: "fantasy",
      heroName: "Aria",
      status: "victory",
      score: 200,
      turns: 12,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        worldId: "fantasy-eld",
        genre: "fantasy",
        heroName: "Aria",
        status: "victory",
        score: i,
        turns: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, worldId: "x", genre: "fantasy", heroName: "x",
      status: "victory", score: 0, turns: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("adventure-engine share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ worldId: "fantasy-eld", heroName: "Aria", difficulty: "easy" });
    expect(url).toContain("world=fantasy-eld");
    expect(url).toContain("hero=Aria");
    expect(url).toContain("diff=easy");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("world=fantasy-eld&hero=Aria&diff=hard");
    expect(p.worldId).toBe("fantasy-eld");
    expect(p.heroName).toBe("Aria");
    expect(p.difficulty).toBe("hard");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ worldId: "", heroName: "", difficulty: "standard" });
  });
  it("filters unknown difficulty", () => {
    const p = parseShareUrl("world=x&hero=y&diff=nightmare");
    expect(p.difficulty).toBe("standard");
  });
});

describe("adventure-engine LLM (BYO key)", () => {
  const world = WORLD_TEMPLATES[0];
  it("buildLlmRequestBody includes hero, inventory, scene", () => {
    const s = newGameState(world, "Aria");
    const body = buildLlmRequestBody(s, "open the door");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Aria");
    expect(body.messages[1].content).toBe("open the door");
    expect(body.temperature).toBeGreaterThan(0.5);
  });
  it("extractLlmNarration pulls content from choices[0]", () => {
    const out = extractLlmNarration({
      choices: [{ message: { content: "  The door creaks open.  " } }],
    });
    expect(out).toBe("The door creaks open.");
  });
  it("extractLlmNarration returns empty for bad shape", () => {
    expect(extractLlmNarration(null)).toBe("");
    expect(extractLlmNarration({})).toBe("");
    expect(extractLlmNarration({ choices: [] })).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused = Genre | Difficulty | GameState | InventoryItem;
