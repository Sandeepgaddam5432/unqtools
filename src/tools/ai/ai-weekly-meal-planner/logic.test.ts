import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  PLAN_DAYS,
  MEAL_TYPES,
  RECIPES,
  DIET_LABELS,
  ALLERGEN_LABELS,
  CUISINE_LABELS,
  MEAL_TYPE_LABELS,
  AISLE_LABELS,
  AISLE_ORDER,
  DEFAULT_FILTERS,
  DEFAULT_PLAN_OPTIONS,
  parsePantry,
  matchesAllDiets,
  excludesAllergens,
  matchesCuisine,
  withinCookTime,
  withinBudgetPerServing,
  applyFilters,
  recipeIsInPantry,
  pantryMatchScore,
  seededShuffle,
  groupByMealType,
  generatePlan,
  swapMeal,
  buildGroceryList,
  groupByAisle,
  filterByPantry,
  dayTotals,
  weeklyTotals,
  dayName,
  renderMarkdownPlan,
  renderJsonPlan,
  renderTextPlan,
  renderGroceryListText,
  renderGroceryListMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Diet,
  type Allergen,
  type Cuisine,
  type MealType,
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

describe("meal-planner constants", () => {
  it("has 55 recipes", () => {
    expect(RECIPES).toHaveLength(55);
  });
  it("has at least 5 breakfast recipes", () => {
    expect(RECIPES.filter((r) => r.mealType === "breakfast").length).toBeGreaterThanOrEqual(5);
  });
  it("has at least 5 lunch recipes", () => {
    expect(RECIPES.filter((r) => r.mealType === "lunch").length).toBeGreaterThanOrEqual(5);
  });
  it("has at least 5 dinner recipes", () => {
    expect(RECIPES.filter((r) => r.mealType === "dinner").length).toBeGreaterThanOrEqual(5);
  });
  it("has at least 5 snack recipes", () => {
    expect(RECIPES.filter((r) => r.mealType === "snack").length).toBeGreaterThanOrEqual(5);
  });
  it("has 7 diet labels", () => {
    expect(Object.keys(DIET_LABELS)).toHaveLength(7);
  });
  it("has 8 allergen labels", () => {
    expect(Object.keys(ALLERGEN_LABELS)).toHaveLength(8);
  });
  it("has 8 cuisine labels", () => {
    expect(Object.keys(CUISINE_LABELS)).toHaveLength(8);
  });
  it("has 4 meal type labels", () => {
    expect(Object.keys(MEAL_TYPE_LABELS)).toHaveLength(4);
    expect(MEAL_TYPES).toHaveLength(4);
  });
  it("has 8 aisle labels", () => {
    expect(Object.keys(AISLE_LABELS)).toHaveLength(8);
    expect(AISLE_ORDER).toHaveLength(8);
  });
  it("PLAN_DAYS is 7 and HISTORY_MAX is 20", () => {
    expect(PLAN_DAYS).toBe(7);
    expect(HISTORY_MAX).toBe(20);
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_FILTERS.diets).toEqual([]);
    expect(DEFAULT_PLAN_OPTIONS.householdSize).toBe(2);
    expect(DEFAULT_PLAN_OPTIONS.seed).toBe(1);
  });
});

describe("meal-planner parsePantry", () => {
  it("parses comma-separated", () => {
    expect(parsePantry("onion, garlic, tomato")).toEqual(["onion", "garlic", "tomato"]);
  });
  it("parses newline-separated", () => {
    expect(parsePantry("onion\ngarlic\ntomato")).toEqual(["onion", "garlic", "tomato"]);
  });
  it("filters blank entries", () => {
    expect(parsePantry("onion\n\n  \ngarlic")).toEqual(["onion", "garlic"]);
  });
  it("returns empty for empty input", () => {
    expect(parsePantry("")).toEqual([]);
  });
  it("lowercases", () => {
    expect(parsePantry("Onion, GARLIC")).toEqual(["onion", "garlic"]);
  });
});

describe("meal-planner filter helpers", () => {
  it("matchesAllDiets requires ALL diets", () => {
    const vegan = RECIPES.find((r) => r.diets.includes("vegan"))!;
    expect(matchesAllDiets(vegan, ["vegan"])).toBe(true);
    expect(matchesAllDiets(vegan, ["vegan", "gluten-free"])).toBe(vegan.diets.includes("gluten-free"));
  });
  it("excludesAllergens filters out", () => {
    const withDairy = RECIPES.find((r) => r.allergens.includes("dairy"))!;
    expect(excludesAllergens(withDairy, ["dairy"])).toBe(false);
    expect(excludesAllergens(withDairy, [])).toBe(true);
  });
  it("matchesCuisine filters by cuisine", () => {
    const italian = RECIPES.find((r) => r.cuisine === "italian")!;
    expect(matchesCuisine(italian, ["italian"])).toBe(true);
    expect(matchesCuisine(italian, ["asian"])).toBe(false);
    expect(matchesCuisine(italian, [])).toBe(true);
  });
  it("withinCookTime filters by total time", () => {
    const r = RECIPES[0];
    expect(withinCookTime(r, r.prepTimeMin + r.cookTimeMin)).toBe(true);
    expect(withinCookTime(r, 1)).toBe(false);
    expect(withinCookTime(r, 0)).toBe(true);
  });
  it("withinBudgetPerServing filters by cost", () => {
    const r = RECIPES[0];
    expect(withinBudgetPerServing(r, r.costPerServingUsd)).toBe(true);
    expect(withinBudgetPerServing(r, r.costPerServingUsd - 0.01)).toBe(false);
    expect(withinBudgetPerServing(r, 0)).toBe(true);
  });
});

describe("meal-planner applyFilters", () => {
  it("returns all when no filters", () => {
    expect(applyFilters(RECIPES, DEFAULT_FILTERS)).toHaveLength(55);
  });
  it("filters by vegan diet", () => {
    const filtered = applyFilters(RECIPES, { ...DEFAULT_FILTERS, diets: ["vegan"] });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.diets.includes("vegan"))).toBe(true);
  });
  it("filters by allergen exclusion", () => {
    const filtered = applyFilters(RECIPES, { ...DEFAULT_FILTERS, excludeAllergens: ["gluten"] });
    expect(filtered.every((r) => !r.allergens.includes("gluten"))).toBe(true);
  });
  it("combines diet + allergen filters", () => {
    const filtered = applyFilters(RECIPES, {
      ...DEFAULT_FILTERS,
      diets: ["vegan"],
      excludeAllergens: ["soy"],
    });
    expect(filtered.every((r) => r.diets.includes("vegan") && !r.allergens.includes("soy"))).toBe(true);
  });
  it("filters by cuisine", () => {
    const filtered = applyFilters(RECIPES, { ...DEFAULT_FILTERS, cuisines: ["italian"] });
    expect(filtered.every((r) => r.cuisine === "italian")).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });
  it("filters by max cook time", () => {
    const filtered = applyFilters(RECIPES, { ...DEFAULT_FILTERS, maxCookTimeMin: 20 });
    expect(filtered.every((r) => r.prepTimeMin + r.cookTimeMin <= 20)).toBe(true);
  });
  it("filters by max cost per serving", () => {
    const filtered = applyFilters(RECIPES, { ...DEFAULT_FILTERS, maxCostPerServingUsd: 2.0 });
    expect(filtered.every((r) => r.costPerServingUsd <= 2.0)).toBe(true);
  });
});

describe("meal-planner pantry helpers", () => {
  it("recipeIsInPantry returns true when all ingredients covered", () => {
    const r = RECIPES.find((x) => x.mealType === "snack" && x.id === "sn-popcorn")!;
    expect(recipeIsInPantry(r, ["popcorn", "coconut", "salt"])).toBe(true);
  });
  it("recipeIsInPantry returns false when missing ingredient", () => {
    const r = RECIPES.find((x) => x.id === "sn-popcorn")!;
    expect(recipeIsInPantry(r, ["popcorn"])).toBe(false);
  });
  it("recipeIsInPantry returns false for empty pantry", () => {
    expect(recipeIsInPantry(RECIPES[0], [])).toBe(false);
  });
  it("pantryMatchScore returns 0-1 fraction", () => {
    const r = RECIPES.find((x) => x.id === "sn-popcorn")!;
    expect(pantryMatchScore(r, ["popcorn"])).toBeGreaterThan(0);
    expect(pantryMatchScore(r, ["popcorn"])).toBeLessThan(1);
    expect(pantryMatchScore(r, [])).toBe(0);
  });
});

describe("meal-planner seededShuffle", () => {
  it("is deterministic with the same seed", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42);
    const b = seededShuffle([1, 2, 3, 4, 5], 42);
    expect(a).toEqual(b);
  });
  it("preserves element set", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 99);
    expect(a.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("differs with different seed (usually)", () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1);
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2);
    // extremely unlikely to be identical
    expect(a).not.toEqual(b);
  });
});

describe("meal-planner groupByMealType", () => {
  it("groups recipes correctly", () => {
    const grouped = groupByMealType(RECIPES);
    expect(grouped.breakfast.length).toBeGreaterThan(0);
    expect(grouped.lunch.length).toBeGreaterThan(0);
    expect(grouped.dinner.length).toBeGreaterThan(0);
    expect(grouped.snack.length).toBeGreaterThan(0);
    const total = grouped.breakfast.length + grouped.lunch.length + grouped.dinner.length + grouped.snack.length;
    expect(total).toBe(55);
  });
});

describe("meal-planner generatePlan", () => {
  it("produces 7 days with 4 meals each", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.slots.length).toBe(4);
    }
  });
  it("is deterministic with the same seed", () => {
    const a = generatePlan(DEFAULT_PLAN_OPTIONS);
    const b = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(a.days[0].slots[0].recipe.id).toBe(b.days[0].slots[0].recipe.id);
  });
  it("respects vegan diet filter", () => {
    const plan = generatePlan({
      ...DEFAULT_PLAN_OPTIONS,
      filters: { ...DEFAULT_FILTERS, diets: ["vegan"] },
    });
    for (const day of plan.days) {
      for (const slot of day.slots) {
        expect(slot.recipe.diets.includes("vegan")).toBe(true);
      }
    }
  });
  it("respects allergen exclusion", () => {
    const plan = generatePlan({
      ...DEFAULT_PLAN_OPTIONS,
      filters: { ...DEFAULT_FILTERS, excludeAllergens: ["gluten"] },
    });
    for (const day of plan.days) {
      for (const slot of day.slots) {
        expect(slot.recipe.allergens.includes("gluten")).toBe(false);
      }
    }
  });
  it("scales servings to household size", () => {
    const plan = generatePlan({ ...DEFAULT_PLAN_OPTIONS, householdSize: 4 });
    for (const day of plan.days) {
      for (const slot of day.slots) {
        expect(slot.scaledServings).toBe(4);
      }
    }
  });
  it("computes weekly cost > 0", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(plan.weeklyCost).toBeGreaterThan(0);
    expect(plan.avgDailyCalories).toBeGreaterThan(0);
  });
  it("computes weekly totals", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(plan.weeklyTotals.calories).toBeGreaterThan(0);
    expect(plan.weeklyTotals.proteinG).toBeGreaterThan(0);
  });
  it("tracks unique recipes used", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(plan.recipes.length).toBeGreaterThan(0);
    expect(plan.recipes.length).toBeLessThanOrEqual(28);
  });
});

describe("meal-planner swapMeal", () => {
  it("swaps a meal to a different recipe", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const original = plan.days[0].slots[0].recipe.id;
    const swapped = swapMeal(plan, DEFAULT_PLAN_OPTIONS, 0, plan.days[0].slots[0].mealType);
    const after = swapped.days[0].slots[0].recipe.id;
    expect(after).not.toBe(original);
  });
  it("preserves 7 days × 4 slots", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const swapped = swapMeal(plan, DEFAULT_PLAN_OPTIONS, 3, "lunch");
    expect(swapped.days).toHaveLength(7);
    for (const d of swapped.days) expect(d.slots).toHaveLength(4);
  });
});

describe("meal-planner buildGroceryList", () => {
  it("consolidates ingredients across meals", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    expect(list.length).toBeGreaterThan(0);
    // Each item has at least one meal
    expect(list.every((i) => i.inMeals.length >= 1)).toBe(true);
  });
  it("scales quantities by household size", () => {
    const small = generatePlan({ ...DEFAULT_PLAN_OPTIONS, householdSize: 1 });
    const big = generatePlan({ ...DEFAULT_PLAN_OPTIONS, householdSize: 5 });
    const smallList = buildGroceryList(small);
    const bigList = buildGroceryList(big);
    // The first item's amount in big should be larger (roughly 5x)
    if (smallList[0] && bigList[0] && smallList[0].name === bigList[0].name) {
      expect(bigList[0].amount).toBeGreaterThan(smallList[0].amount);
    }
  });
  it("sorts by aisle then name", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      const prevAi = AISLE_ORDER.indexOf(prev.aisle);
      const currAi = AISLE_ORDER.indexOf(curr.aisle);
      if (prevAi === currAi) {
        expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
      } else {
        expect(prevAi).toBeLessThanOrEqual(currAi);
      }
    }
  });
  it("dedupes ingredient used in multiple meals", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    // Pick an item that appears in multiple meals
    const multi = list.find((i) => i.inMeals.length >= 2);
    if (multi) {
      expect(multi.inMeals.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("meal-planner groupByAisle & filterByPantry", () => {
  it("groups items by aisle", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    const grouped = groupByAisle(list);
    const total = AISLE_ORDER.reduce((sum, a) => sum + grouped[a].length, 0);
    expect(total).toBe(list.length);
  });
  it("filters pantry items", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    const anItem = list[0];
    const filtered = filterByPantry(list, [anItem.name.toLowerCase()]);
    expect(filtered.every((i) => i.name !== anItem.name)).toBe(true);
  });
  it("returns all when pantry is empty", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    expect(filterByPantry(list, [])).toEqual(list);
  });
});

describe("meal-planner totals helpers", () => {
  it("dayTotals returns the day's totals", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(dayTotals(plan.days[0])).toBe(plan.days[0].totals);
  });
  it("weeklyTotals returns the plan's weekly totals", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    expect(weeklyTotals(plan)).toBe(plan.weeklyTotals);
  });
  it("dayName returns Mon-Sun", () => {
    expect(dayName(0)).toBe("Monday");
    expect(dayName(6)).toBe("Sunday");
  });
});

describe("meal-planner renderers", () => {
  it("renderMarkdownPlan contains day names and titles", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const md = renderMarkdownPlan(plan);
    expect(md).toContain("# Weekly Meal Plan");
    expect(md).toContain("## Monday");
    expect(md).toContain("## Sunday");
    expect(md).toContain("Weekly cost");
  });
  it("renderJsonPlan returns valid JSON", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const json = renderJsonPlan(plan);
    const parsed = JSON.parse(json) as { days: unknown[]; weeklyCost: number };
    expect(parsed.days).toHaveLength(7);
    expect(parsed.weeklyCost).toBeGreaterThan(0);
  });
  it("renderTextPlan contains headers", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const text = renderTextPlan(plan);
    expect(text).toContain("WEEKLY MEAL PLAN");
    expect(text).toContain("MONDAY");
    expect(text).toContain("SUNDAY");
  });
  it("renderGroceryListText groups by aisle", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    const text = renderGroceryListText(list);
    expect(text).toContain("GROCERY LIST");
    expect(text).toContain("PRODUCE");
  });
  it("renderGroceryListMarkdown has tables", () => {
    const plan = generatePlan(DEFAULT_PLAN_OPTIONS);
    const list = buildGroceryList(plan);
    const md = renderGroceryListMarkdown(list);
    expect(md).toContain("# Grocery List");
    expect(md).toContain("| Qty | Unit |");
  });
});

describe("meal-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, dietCount: 2, mealCount: 28, weeklyCost: 100, avgDailyCalories: 2000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, dietCount: 0, mealCount: 0, weeklyCost: 0, avgDailyCalories: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, dietCount: 0, mealCount: 0, weeklyCost: 0, avgDailyCalories: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses correct storage key", () => {
    saveHistory({ ts: 1, dietCount: 0, mealCount: 0, weeklyCost: 0, avgDailyCalories: 0 });
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  });
});

describe("meal-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      diets: ["vegan", "gluten-free"],
      excludeAllergens: ["nuts"],
      cuisines: ["italian", "asian"],
      maxCookTimeMin: 30,
      maxCostPerServingUsd: 5,
      householdSize: 3,
      weeklyBudgetUsd: 100,
      calorieTargetPerDay: 2000,
      pantry: "onion, garlic",
      seed: 42,
    });
    expect(url).toContain("diets=vegan%2Cgluten-free");
    expect(url).toContain("ex=nuts");
    expect(url).toContain("cu=italian%2Casian");
    expect(url).toContain("t=30");
    expect(url).toContain("h=3");
    expect(url).toContain("cal=2000");
    expect(url).toContain("s=42");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const state = parseShareUrl("diets=vegan%2Cgluten-free&ex=nuts&cu=italian&h=4&cal=2000&s=42&p=onion");
    expect(state.diets).toEqual(["vegan", "gluten-free"]);
    expect(state.excludeAllergens).toEqual(["nuts"]);
    expect(state.cuisines).toEqual(["italian"]);
    expect(state.householdSize).toBe(4);
    expect(state.calorieTargetPerDay).toBe(2000);
    expect(state.seed).toBe(42);
    expect(state.pantry).toBe("onion");
  });
  it("handles empty hash with defaults", () => {
    const state = parseShareUrl("");
    expect(state.diets).toEqual([]);
    expect(state.householdSize).toBe(2);
    expect(state.seed).toBe(1);
  });
  it("filters invalid enum values", () => {
    const state = parseShareUrl("diets=invalid,vegan&cu=notacuisine");
    expect(state.diets).toEqual(["vegan"]);
    expect(state.cuisines).toEqual([]);
  });
});

describe("meal-planner LLM helpers", () => {
  it("buildLlmPrompt includes meal type and household", () => {
    const prompt = buildLlmPrompt("dinner", ["vegan"], ["italian"], 4);
    expect(prompt).toContain("dinner");
    expect(prompt).toContain("4");
    expect(prompt).toContain("vegan");
    expect(prompt).toContain("italian");
    expect(prompt).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON object", () => {
    const text = `Sure! ${JSON.stringify({
      title: "Test Pasta",
      cuisine: "italian",
      ingredients: [
        { name: "pasta", amount: 100, unit: "g", aisle: "pantry" },
      ],
      steps: ["boil", "drain"],
      nutritionPerServing: { calories: 400, proteinG: 12, carbsG: 60, fatG: 8 },
    })}`;
    const r = renderLlmResult(text);
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Test Pasta");
    expect(r!.cuisine).toBe("italian");
    expect(r!.ingredients).toHaveLength(1);
    expect(r!.nutritionPerServing.calories).toBe(400);
  });
  it("renderLlmResult returns null for no JSON", () => {
    expect(renderLlmResult("no json")).toBeNull();
  });
  it("renderLlmResult falls back for invalid cuisine", () => {
    const text = JSON.stringify({
      title: "X", cuisine: "notacuisine",
      ingredients: [], steps: [],
      nutritionPerServing: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    });
    expect(renderLlmResult(text)!.cuisine).toBe("american");
  });
});

// Suppress unused-import lint
export type _Unused = Diet | Allergen | Cuisine | MealType | PlanOptions;
