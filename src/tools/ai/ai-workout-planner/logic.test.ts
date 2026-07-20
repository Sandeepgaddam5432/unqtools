import { describe, it, expect, beforeEach } from "vitest";
import {
  EXERCISES,
  EXERCISE_MAP,
  GOAL_LABELS,
  LEVEL_LABELS,
  EQUIPMENT_LABELS,
  SPLIT_LABELS,
  MUSCLE_LABELS,
  SESSION_LENGTHS,
  DEFAULT_OPTIONS,
  HISTORY_KEY,
  LOG_KEY,
  HISTORY_MAX,
  isValidGoal,
  isValidLevel,
  isValidEquipment,
  isValidSplit,
  validateOptions,
  normalizeId,
  pickExercises,
  pickByMuscle,
  findSwap,
  repSchemeFor,
  planExercise,
  splitDayLabels,
  splitDayFocus,
  estimateSessionMin,
  fitToSession,
  generatePlan,
  buildWarmup,
  buildCooldown,
  buildProgressionScheme,
  computeStats,
  saveLog,
  loadLogs,
  clearLogs,
  computeProgressionForExercise,
  isDeloadWeek,
  applyDeload,
  renderMarkdown,
  renderText,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Goal,
  type Level,
  type Equipment,
  type Split,
  type MuscleGroup,
  type PlanOptions,
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

describe("ai-workout-planner constants", () => {
  it("has 40+ exercises", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
  });
  it("has all 6 goals", () => {
    expect(Object.keys(GOAL_LABELS)).toHaveLength(6);
  });
  it("has all 3 levels", () => {
    expect(Object.keys(LEVEL_LABELS)).toHaveLength(3);
  });
  it("has all 6 equipment options", () => {
    expect(Object.keys(EQUIPMENT_LABELS)).toHaveLength(6);
  });
  it("has all 3 splits", () => {
    expect(Object.keys(SPLIT_LABELS)).toHaveLength(3);
  });
  it("has 12 muscle groups", () => {
    expect(Object.keys(MUSCLE_LABELS)).toHaveLength(12);
  });
  it("has session length options", () => {
    expect(SESSION_LENGTHS).toContain(45);
    expect(SESSION_LENGTHS.length).toBeGreaterThanOrEqual(3);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.goal).toBeDefined();
    expect(DEFAULT_OPTIONS.daysPerWeek).toBeGreaterThanOrEqual(1);
  });
  it("exercise map matches exercises array", () => {
    expect(Object.keys(EXERCISE_MAP).length).toBe(EXERCISES.length);
  });
  it("every exercise has a valid muscle + at least one equipment + at least one goal", () => {
    for (const ex of EXERCISES) {
      expect(ex.muscle in MUSCLE_LABELS).toBe(true);
      expect(ex.equipment.length).toBeGreaterThan(0);
      expect(ex.goals.length).toBeGreaterThan(0);
      expect(ex.formCue.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-workout-planner validators", () => {
  it("isValidGoal", () => {
    expect(isValidGoal("strength")).toBe(true);
    expect(isValidGoal("nope")).toBe(false);
  });
  it("isValidLevel", () => {
    expect(isValidLevel("beginner")).toBe(true);
    expect(isValidLevel("nope")).toBe(false);
  });
  it("isValidEquipment", () => {
    expect(isValidEquipment("dumbbells")).toBe(true);
    expect(isValidEquipment("nope")).toBe(false);
  });
  it("isValidSplit", () => {
    expect(isValidSplit("ppl")).toBe(true);
    expect(isValidSplit("nope")).toBe(false);
  });
  it("validateOptions accepts default options", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toEqual([]);
  });
  it("validateOptions rejects bad goal", () => {
    const errs = validateOptions({ ...DEFAULT_OPTIONS, goal: "bad" as Goal });
    expect(errs.some((e) => e.includes("goal"))).toBe(true);
  });
  it("validateOptions rejects bad days", () => {
    const errs = validateOptions({ ...DEFAULT_OPTIONS, daysPerWeek: 8 });
    expect(errs.some((e) => e.includes("daysPerWeek"))).toBe(true);
  });
  it("validateOptions rejects bad session length", () => {
    const errs = validateOptions({ ...DEFAULT_OPTIONS, sessionLengthMin: 33 });
    expect(errs.some((e) => e.includes("sessionLengthMin"))).toBe(true);
  });
  it("validateOptions rejects bad deload", () => {
    const errs = validateOptions({ ...DEFAULT_OPTIONS, deloadEveryN: 50 });
    expect(errs.some((e) => e.includes("deloadEveryN"))).toBe(true);
  });
});

describe("ai-workout-planner normalizeId", () => {
  it("trims and lowercases and hyphenates", () => {
    expect(normalizeId("  Push Up  ")).toBe("push-up");
  });
});

describe("ai-workout-planner pickExercises", () => {
  it("returns exercises matching goal + equipment", () => {
    const list = pickExercises("strength", "barbell");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((e) => e.goals.includes("strength"))).toBe(true);
    expect(list.every((e) => e.equipment.includes("barbell"))).toBe(true);
  });
  it("returns empty for unknown goal/equipment combo", () => {
    // Cardio + barbell-only is mostly empty.
    const list = pickExercises("cardio", "barbell");
    // Should be empty (no cardio exercises use barbell)
    expect(list.length).toBe(0);
  });
});

describe("ai-workout-planner pickByMuscle", () => {
  it("filters by muscle group", () => {
    const list = pickByMuscle("muscle-gain", "dumbbells", "chest");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((e) => e.muscle === "chest")).toBe(true);
  });
});

describe("ai-workout-planner findSwap", () => {
  it("finds bodyweight swap for barbell bench press", () => {
    const swap = findSwap("bench-press", "bodyweight");
    expect(swap).not.toBeNull();
    expect(swap!.equipment).toContain("bodyweight");
  });
  it("finds dumbbell swap for barbell squat", () => {
    const swap = findSwap("squat", "dumbbells");
    expect(swap).not.toBeNull();
    expect(swap!.equipment).toContain("dumbbells");
  });
  it("returns null for unknown exercise id", () => {
    expect(findSwap("nonexistent-id", "bodyweight")).toBeNull();
  });
});

describe("ai-workout-planner repSchemeFor", () => {
  it("returns low-rep scheme for strength compound", () => {
    const s = repSchemeFor("strength", "intermediate", "compound");
    expect(s.reps).toBe("5");
    expect(s.sets).toBe(4);
    expect(s.rir).toBe(2);
  });
  it("returns moderate reps for muscle-gain compound", () => {
    const s = repSchemeFor("muscle-gain", "beginner", "compound");
    expect(s.reps).toBe("8-12");
    expect(s.sets).toBe(3);
  });
  it("returns higher reps for fat-loss accessory", () => {
    const s = repSchemeFor("fat-loss", "beginner", "accessory");
    expect(s.reps).toBe("15-20");
  });
  it("cardio reps are time-based", () => {
    const s = repSchemeFor("cardio", "beginner", "cardio");
    expect(s.rir).toBe(-1);
    expect(s.reps).toContain("min");
  });
  it("flexibility mobility is hold-based", () => {
    const s = repSchemeFor("flexibility", "beginner", "mobility");
    expect(s.reps).toContain("hold");
  });
});

describe("ai-workout-planner planExercise", () => {
  it("builds planned exercise with correct number of sets", () => {
    const ex = EXERCISE_MAP["bench-press"];
    const planned = planExercise(ex, "strength", "intermediate");
    expect(planned.exerciseId).toBe("bench-press");
    expect(planned.sets.length).toBe(4);
    expect(planned.sets[0].setNumber).toBe(1);
    expect(planned.sets[0].reps).toBe("5");
    expect(planned.formCue).toBe(ex.formCue);
  });
});

describe("ai-workout-planner splitDayLabels", () => {
  it("full-body labels for 3 days", () => {
    const labels = splitDayLabels("full-body", 3);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("Full Body");
  });
  it("ppl labels cycle push/pull/legs", () => {
    const labels = splitDayLabels("ppl", 6);
    expect(labels).toHaveLength(6);
    expect(labels[0]).toContain("Push");
    expect(labels[1]).toContain("Pull");
    expect(labels[2]).toContain("Legs");
    expect(labels[3]).toContain("Push");
  });
  it("upper-lower alternates", () => {
    const labels = splitDayLabels("upper-lower", 4);
    expect(labels[0]).toContain("Upper");
    expect(labels[1]).toContain("Lower");
    expect(labels[2]).toContain("Upper");
  });
});

describe("ai-workout-planner splitDayFocus", () => {
  it("full-body returns compound muscle groups", () => {
    const f = splitDayFocus("full-body", 0);
    expect(f).toContain("chest");
    expect(f).toContain("back");
    expect(f).toContain("quads");
  });
  it("ppl day 0 is push", () => {
    const f = splitDayFocus("ppl", 0);
    expect(f).toContain("chest");
    expect(f).toContain("triceps");
  });
  it("upper-lower day 1 is lower", () => {
    const f = splitDayFocus("upper-lower", 1);
    expect(f).toContain("quads");
    expect(f).toContain("hamstrings");
  });
});

describe("ai-workout-planner estimateSessionMin", () => {
  it("estimates session length from exercises", () => {
    const ex = planExercise(EXERCISE_MAP["bench-press"], "strength", "intermediate");
    const min = estimateSessionMin([ex], 5, 5);
    expect(min).toBeGreaterThan(10);
  });
  it("empty exercises returns warmup + cooldown only", () => {
    const min = estimateSessionMin([], 5, 5);
    expect(min).toBe(10);
  });
});

describe("ai-workout-planner fitToSession", () => {
  it("returns exercises unchanged if under target", () => {
    const ex = planExercise(EXERCISE_MAP["plank"], "general-fitness", "beginner");
    const result = fitToSession([ex], 60, 5, 5);
    expect(result).toHaveLength(1);
  });
  it("trims sets when over target", () => {
    const ex1 = planExercise(EXERCISE_MAP["squat"], "strength", "advanced");
    const ex2 = planExercise(EXERCISE_MAP["bench-press"], "strength", "advanced");
    const ex3 = planExercise(EXERCISE_MAP["deadlift"], "strength", "advanced");
    // Tiny target forces trimming
    const result = fitToSession([ex1, ex2, ex3], 5, 1, 1);
    // All exercises should have at most 2 sets
    for (const r of result) expect(r.sets.length).toBeLessThanOrEqual(2);
  });
});

describe("ai-workout-planner generatePlan", () => {
  it("generates a valid plan for default options", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    expect(plan.sessions).toHaveLength(DEFAULT_OPTIONS.daysPerWeek);
    expect(plan.totalExercises).toBeGreaterThan(0);
    expect(plan.totalSets).toBeGreaterThan(0);
    expect(plan.warnings).toEqual([]);
  });
  it("generates PPL plan with 6 days", () => {
    const plan = generatePlan({
      ...DEFAULT_OPTIONS,
      goal: "muscle-gain",
      equipment: "full-gym",
      daysPerWeek: 6,
      split: "ppl",
    });
    expect(plan.sessions).toHaveLength(6);
    expect(plan.sessions[0].label).toContain("Push");
    expect(plan.sessions[1].label).toContain("Pull");
    expect(plan.sessions[2].label).toContain("Legs");
  });
  it("warns about strength + bodyweight", () => {
    const plan = generatePlan({
      ...DEFAULT_OPTIONS,
      goal: "strength",
      equipment: "bodyweight",
    });
    expect(plan.warnings.some((w) => w.includes("bodyweight"))).toBe(true);
  });
  it("warns about PPL with <3 days", () => {
    const plan = generatePlan({
      ...DEFAULT_OPTIONS,
      split: "ppl",
      daysPerWeek: 2,
    });
    expect(plan.warnings.some((w) => w.includes("PPL"))).toBe(true);
  });
  it("includes warm-up and cool-down", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    expect(plan.sessions[0].warmup.length).toBeGreaterThan(20);
    expect(plan.sessions[0].cooldown.length).toBeGreaterThan(20);
  });
  it("includes progression scheme", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    expect(plan.progression.name).toBeTruthy();
    expect(plan.progression.weeklyIncrement).toBeTruthy();
  });
  it("returns empty plan for invalid options", () => {
    const plan = generatePlan({ ...DEFAULT_OPTIONS, goal: "invalid" as Goal });
    expect(plan.sessions).toEqual([]);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
  it("handles flexibility goal", () => {
    const plan = generatePlan({ ...DEFAULT_OPTIONS, goal: "flexibility" });
    expect(plan.sessions.length).toBeGreaterThan(0);
    // Should have at least one mobility exercise somewhere
    const hasMobility = plan.sessions.some((s) =>
      s.exercises.some((e) => e.category === "mobility"),
    );
    expect(hasMobility).toBe(true);
  });
});

describe("ai-workout-planner buildWarmup / buildCooldown", () => {
  it("warmup differs by goal", () => {
    expect(buildWarmup("cardio", "beginner")).toContain("conversational");
    expect(buildWarmup("flexibility", "beginner")).toContain("Cat-cow");
    expect(buildWarmup("strength", "beginner")).toContain("warm-up sets");
  });
  it("cooldown has content", () => {
    expect(buildCooldown("fat-loss").length).toBeGreaterThan(10);
    expect(buildCooldown("cardio").length).toBeGreaterThan(10);
  });
});

describe("ai-workout-planner buildProgressionScheme", () => {
  it("returns a scheme per goal", () => {
    const goals: Goal[] = ["strength", "muscle-gain", "fat-loss", "cardio", "flexibility", "general-fitness"];
    for (const g of goals) {
      const s = buildProgressionScheme(g);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.weeklyIncrement.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-workout-planner computeStats", () => {
  it("computes stats for a plan", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    const stats = computeStats(plan);
    expect(stats.days).toBe(DEFAULT_OPTIONS.daysPerWeek);
    expect(stats.totalExercises).toBe(plan.totalExercises);
    expect(stats.totalSets).toBe(plan.totalSets);
    expect(stats.avgExercisesPerDay).toBeGreaterThan(0);
    expect(stats.estimatedWeeklyMin).toBeGreaterThan(0);
  });
  it("byMuscle has all 12 keys", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    const stats = computeStats(plan);
    expect(Object.keys(stats.byMuscle).length).toBe(12);
  });
});

describe("ai-workout-planner logs (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadLogs()).toEqual([]);
  });
  it("saves and loads logs", () => {
    saveLog({
      ts: 1, day: 1,
      exercises: [{ exerciseId: "bench-press", sets: [{ setNumber: 1, reps: 5, weightKg: 60 }] }],
    });
    expect(loadLogs()).toHaveLength(1);
  });
  it("caps at 200 logs", () => {
    for (let i = 0; i < 210; i++) {
      saveLog({ ts: i, day: 1, exercises: [] });
    }
    expect(loadLogs()).toHaveLength(200);
  });
  it("clears logs", () => {
    saveLog({ ts: 1, day: 1, exercises: [] });
    clearLogs();
    expect(loadLogs()).toEqual([]);
  });
});

describe("ai-workout-planner computeProgressionForExercise", () => {
  it("returns null for no logs", () => {
    expect(computeProgressionForExercise("bench-press", [])).toBeNull();
  });
  it("returns increase when all reps hit", () => {
    const logs: import("./logic").WorkoutLog[] = [{
      ts: 1, day: 1,
      exercises: [{
        exerciseId: "bench-press",
        sets: [
          { setNumber: 1, reps: 5 },
          { setNumber: 2, reps: 5 },
          { setNumber: 3, reps: 5 },
        ],
      }],
    }];
    const r = computeProgressionForExercise("bench-press", logs);
    expect(r?.action).toBe("increase");
  });
  it("returns deload when reps missed badly", () => {
    const logs: import("./logic").WorkoutLog[] = [{
      ts: 1, day: 1,
      exercises: [{
        exerciseId: "bench-press",
        sets: [
          { setNumber: 1, reps: 2 },
          { setNumber: 2, reps: 2 },
        ],
      }],
    }];
    const r = computeProgressionForExercise("bench-press", logs);
    expect(r?.action).toBe("deload");
  });
  it("returns hold when close to target", () => {
    const logs: import("./logic").WorkoutLog[] = [{
      ts: 1, day: 1,
      exercises: [{
        exerciseId: "bench-press",
        sets: [{ setNumber: 1, reps: 4 }],
      }],
    }];
    const r = computeProgressionForExercise("bench-press", logs);
    expect(r?.action).toBe("hold");
  });
});

describe("ai-workout-planner deload", () => {
  it("isDeloadWeek correctly identifies deload weeks", () => {
    expect(isDeloadWeek(4, 4)).toBe(true);
    expect(isDeloadWeek(3, 4)).toBe(false);
    expect(isDeloadWeek(8, 4)).toBe(true);
    expect(isDeloadWeek(0, 4)).toBe(false);
    expect(isDeloadWeek(5, 0)).toBe(false);
  });
  it("applyDeload reduces sets and labels sessions", () => {
    const plan = generatePlan({
      ...DEFAULT_OPTIONS,
      equipment: "full-gym",
      daysPerWeek: 3,
    });
    const originalSets = plan.sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
    const deloaded = applyDeload(plan);
    const newSets = deloaded.sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
    expect(newSets).toBeLessThanOrEqual(originalSets);
    expect(deloaded.sessions[0].label).toContain("Deload");
  });
});

describe("ai-workout-planner renderers", () => {
  it("renderMarkdown includes goal and sessions", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    const md = renderMarkdown(plan);
    expect(md).toContain("# Workout Plan");
    expect(md).toContain(GOAL_LABELS[DEFAULT_OPTIONS.goal]);
    expect(md).toContain("Warm-up");
  });
  it("renderMarkdown handles empty plan", () => {
    const md = renderMarkdown({
      options: DEFAULT_OPTIONS,
      sessions: [],
      progression: { name: "—", description: "—", weeklyIncrement: "—" },
      deloadWeekEveryN: 0,
      warnings: ["bad"],
      totalExercises: 0,
      totalSets: 0,
    });
    expect(md).toContain("No plan generated");
  });
  it("renderText equals renderMarkdown", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    expect(renderText(plan)).toBe(renderMarkdown(plan));
  });
  it("renderJson produces valid JSON", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    const json = renderJson(plan);
    const parsed = JSON.parse(json);
    expect(parsed.options.goal).toBe(DEFAULT_OPTIONS.goal);
  });
  it("renderCsv has header and rows", () => {
    const plan = generatePlan(DEFAULT_OPTIONS);
    const csv = renderCsv(plan);
    expect(csv).toContain("day,label,focus,exercise_order,exercise,muscle,sets,reps,rir,rest_sec");
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("ai-workout-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, goal: "strength", level: "beginner", equipment: "dumbbells",
      daysPerWeek: 3, sessionLengthMin: 45, split: "full-body",
      totalExercises: 15, totalSets: 40,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i, goal: "strength", level: "beginner", equipment: "dumbbells",
        daysPerWeek: 3, sessionLengthMin: 45, split: "full-body",
        totalExercises: 1, totalSets: 1,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, goal: "strength", level: "beginner", equipment: "dumbbells",
      daysPerWeek: 3, sessionLengthMin: 45, split: "full-body",
      totalExercises: 1, totalSets: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses correct history key", () => {
    expect(HISTORY_KEY).toContain("ai-workout-planner");
  });
  it("uses correct log key", () => {
    expect(LOG_KEY).toContain("ai-workout-planner");
  });
});

describe("ai-workout-planner shareable URL", () => {
  it("builds share URL with all options when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toContain("goal=general-fitness");
    expect(url).toContain("level=beginner");
    expect(url).toContain("equip=bodyweight");
    expect(url).toContain("days=3");
    expect(url).toContain("len=45");
    expect(url).toContain("split=full-body");
    expect(url).toContain("mob=1");
    expect(url).toContain("deload=4");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to options", () => {
    const hash = "goal=strength&level=intermediate&equip=barbell&days=4&len=60&split=upper-lower&mob=0&deload=6";
    const p = parseShareUrl(hash);
    expect(p.options.goal).toBe("strength");
    expect(p.options.level).toBe("intermediate");
    expect(p.options.equipment).toBe("barbell");
    expect(p.options.daysPerWeek).toBe(4);
    expect(p.options.sessionLengthMin).toBe(60);
    expect(p.options.split).toBe("upper-lower");
    expect(p.options.includeMobility).toBe(false);
    expect(p.options.deloadEveryN).toBe(6);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ options: {} });
  });
  it("filters unknown values", () => {
    const hash = "goal=badgoal&level=badlevel&days=99&len=33";
    const p = parseShareUrl(hash);
    expect(p.options.goal).toBeUndefined();
    expect(p.options.level).toBeUndefined();
    expect(p.options.daysPerWeek).toBeUndefined();
    expect(p.options.sessionLengthMin).toBeUndefined();
  });
});

describe("ai-workout-planner LLM prompt", () => {
  it("builds prompt with system + user", () => {
    const prompt = buildLlmPrompt(DEFAULT_OPTIONS);
    expect(prompt.system.length).toBeGreaterThan(20);
    expect(prompt.user).toContain(GOAL_LABELS[DEFAULT_OPTIONS.goal]);
    expect(prompt.user).toContain(LEVEL_LABELS[DEFAULT_OPTIONS.level]);
    expect(prompt.user).toContain(EQUIPMENT_LABELS[DEFAULT_OPTIONS.equipment]);
    expect(prompt.user).toContain(String(DEFAULT_OPTIONS.daysPerWeek));
  });
  it("renderLlmResult trims", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
    expect(renderLlmResult("")).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused =
  | Goal | Level | Equipment | Split | MuscleGroup | PlanOptions;
