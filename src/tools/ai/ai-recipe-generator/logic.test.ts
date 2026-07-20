import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  CUISINE_LABELS,
  DIET_LABELS,
  ALLERGEN_LABELS,
  DIFFICULTY_LABELS,
  DEFAULT_FILTERS,
  RECIPES,
  normalizeIngredient,
  parseIngredients,
  filterByDiet,
  filterByAllergies,
  filterByCuisine,
  filterByTime,
  filterByServings,
  applyFilters,
  matchRecipes,
  matchRecipesWithAny,
  totalNutrition,
  scalePortions,
  convertIngredient,
  convertIngredients,
  convertTemperature,
  generateVariations,
  buildShoppingList,
  renderMarkdown,
  renderJson,
  renderShoppingListText,
  renderMatchSummary,
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

describe("ai-recipe-generator constants", () => {
  it("exposes history key and cap of 20", () => {
    expect(HISTORY_KEY).toContain("ai-recipe-generator");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 8 cuisines", () => {
    expect(Object.keys(CUISINE_LABELS)).toHaveLength(8);
    expect(CUISINE_LABELS.italian).toBe("Italian");
  });
  it("has 7 diets", () => {
    expect(Object.keys(DIET_LABELS)).toHaveLength(7);
    expect(DIET_LABELS.vegan).toBe("Vegan");
  });
  it("has 7 allergens", () => {
    expect(Object.keys(ALLERGEN_LABELS)).toHaveLength(7);
  });
  it("has 3 difficulties", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("has default filters", () => {
    expect(DEFAULT_FILTERS.diets).toEqual([]);
    expect(DEFAULT_FILTERS.maxCookTimeMin).toBe(0);
  });
});

describe("ai-recipe-generator recipe database", () => {
  it("has at least 50 recipes", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(50);
  });
  it("every recipe has a unique id", () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every recipe has at least 3 ingredients", () => {
    for (const r of RECIPES) {
      expect(r.ingredients.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("every recipe has at least 2 steps", () => {
    for (const r of RECIPES) {
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("every recipe has positive nutrition", () => {
    for (const r of RECIPES) {
      expect(r.nutritionPerServing.calories).toBeGreaterThan(0);
    }
  });
  it("includes vegan, gluten-free, and keto options", () => {
    expect(RECIPES.some((r) => r.diets.includes("vegan"))).toBe(true);
    expect(RECIPES.some((r) => r.diets.includes("gluten-free"))).toBe(true);
    expect(RECIPES.some((r) => r.diets.includes("keto"))).toBe(true);
  });
  it("spans at least 6 cuisines", () => {
    const cuisines = new Set(RECIPES.map((r) => r.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(6);
  });
});

describe("ai-recipe-generator normalizeIngredient", () => {
  it("lowercases and trims", () => {
    expect(normalizeIngredient("  Tomato  ")).toBe("tomato");
  });
  it("singularizes basic plurals", () => {
    expect(normalizeIngredient("tomatoes")).toBe("tomato");
    expect(normalizeIngredient("berries")).toBe("berry");
  });
  it("handles empty", () => {
    expect(normalizeIngredient("")).toBe("");
  });
});

describe("ai-recipe-generator parseIngredients", () => {
  it("parses comma-separated", () => {
    expect(parseIngredients("tomato, onion, garlic")).toEqual(["tomato", "onion", "garlic"]);
  });
  it("parses newline-separated", () => {
    expect(parseIngredients("tomato\nonion\ngarlic")).toEqual(["tomato", "onion", "garlic"]);
  });
  it("normalizes plurals", () => {
    expect(parseIngredients("tomatoes, onions")).toEqual(["tomato", "onion"]);
  });
  it("skips blanks", () => {
    expect(parseIngredients("tomato\n\nonion")).toEqual(["tomato", "onion"]);
  });
  it("returns empty for empty", () => {
    expect(parseIngredients("")).toEqual([]);
  });
});

describe("ai-recipe-generator filters", () => {
  it("filterByDiet returns only matching recipes", () => {
    const out = filterByDiet(RECIPES, ["vegan"]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.diets.includes("vegan"))).toBe(true);
  });
  it("filterByDiet returns all when no diets specified", () => {
    expect(filterByDiet(RECIPES, [])).toHaveLength(RECIPES.length);
  });
  it("filterByAllergies excludes recipes with the allergen", () => {
    const out = filterByAllergies(RECIPES, ["gluten"]);
    expect(out.every((r) => !r.allergens.includes("gluten"))).toBe(true);
  });
  it("filterByCuisine returns only matching cuisine", () => {
    const out = filterByCuisine(RECIPES, ["italian"]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.cuisine === "italian")).toBe(true);
  });
  it("filterByTime filters by max cook time", () => {
    const out = filterByTime(RECIPES, 20);
    expect(out.every((r) => r.cookTimeMin <= 20)).toBe(true);
  });
  it("filterByTime returns all when 0", () => {
    expect(filterByTime(RECIPES, 0)).toHaveLength(RECIPES.length);
  });
  it("filterByServings filters by min servings", () => {
    const out = filterByServings(RECIPES, 6);
    expect(out.every((r) => r.servings >= 6)).toBe(true);
  });
  it("applyFilters combines all filters", () => {
    const out = applyFilters(RECIPES, {
      diets: ["vegan"],
      excludeAllergens: ["gluten"],
      cuisines: ["asian"],
      maxCookTimeMin: 30,
      servings: 0,
    });
    expect(out.every((r) => r.diets.includes("vegan"))).toBe(true);
    expect(out.every((r) => !r.allergens.includes("gluten"))).toBe(true);
    expect(out.every((r) => r.cuisine === "asian")).toBe(true);
    expect(out.every((r) => r.cookTimeMin <= 30)).toBe(true);
  });
});

describe("ai-recipe-generator matchRecipes", () => {
  it("scores 1.0 when all ingredients are owned", () => {
    const recipe = RECIPES[0];
    const have = recipe.ingredients.map((i) => i.name);
    const out = matchRecipes([recipe], have);
    expect(out[0].matchScore).toBe(1);
    expect(out[0].missing).toEqual([]);
  });
  it("scores 0 when no ingredients are owned", () => {
    const out = matchRecipes([RECIPES[0]], ["nothing-matching"]);
    expect(out[0].matchScore).toBe(0);
    expect(out[0].missing.length).toBeGreaterThan(0);
  });
  it("sorts by match score descending", () => {
    const r1 = RECIPES[0];
    const r2 = RECIPES[1];
    const have = r1.ingredients.map((i) => i.name);
    const out = matchRecipes([r1, r2], have);
    expect(out[0].matchScore).toBeGreaterThanOrEqual(out[1].matchScore);
  });
  it("matchRecipesWithAny filters out zero matches", () => {
    const out = matchRecipesWithAny(RECIPES, ["nothing-matching"]);
    expect(out.length).toBe(0);
  });
  it("matchRecipesWithAny returns scored matches", () => {
    const have = RECIPES[0].ingredients.slice(0, 2).map((i) => i.name);
    const out = matchRecipesWithAny(RECIPES, have);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((m) => m.matchScore > 0)).toBe(true);
  });
});

describe("ai-recipe-generator totalNutrition", () => {
  it("scales nutrition by serving factor", () => {
    const r = RECIPES[0];
    const n = totalNutrition(r, r.servings * 2);
    expect(n.calories).toBeCloseTo(r.nutritionPerServing.calories * 2, -1);
  });
  it("returns base nutrition at original servings", () => {
    const r = RECIPES[0];
    const n = totalNutrition(r, r.servings);
    expect(n.calories).toBe(r.nutritionPerServing.calories);
  });
});

describe("ai-recipe-generator scalePortions", () => {
  it("scales ingredient amounts proportionally", () => {
    const r = RECIPES[0];
    const scaled = scalePortions(r, r.servings * 2);
    expect(scaled[0].amount).toBeCloseTo(r.ingredients[0].amount * 2, 0);
  });
  it("returns original amounts at original servings", () => {
    const r = RECIPES[0];
    const scaled = scalePortions(r, r.servings);
    expect(scaled[0].amount).toBe(r.ingredients[0].amount);
  });
  it("returns original at zero servings (no-op)", () => {
    const r = RECIPES[0];
    const scaled = scalePortions(r, 0);
    expect(scaled).toHaveLength(r.ingredients.length);
  });
});

describe("ai-recipe-generator convertIngredient", () => {
  it("converts grams to ounces in imperial", () => {
    const out = convertIngredient({ name: "flour", amount: 100, unit: "g" }, "imperial");
    expect(out.unit).toBe("oz");
    expect(out.amount).toBeCloseTo(3.53, 1);
  });
  it("converts ml to cups in imperial", () => {
    const out = convertIngredient({ name: "milk", amount: 250, unit: "ml" }, "imperial");
    expect(out.unit).toBe("cup");
  });
  it("converts back to metric", () => {
    const out = convertIngredient({ name: "flour", amount: 4, unit: "oz" }, "metric");
    expect(out.unit).toBe("g");
  });
  it("leaves non-convertible units unchanged", () => {
    const out = convertIngredient({ name: "egg", amount: 2, unit: "qty" }, "imperial");
    expect(out.unit).toBe("qty");
  });
  it("convertIngredients converts a list", () => {
    const out = convertIngredients([{ name: "x", amount: 100, unit: "g" }, { name: "y", amount: 2, unit: "qty" }], "imperial");
    expect(out[0].unit).toBe("oz");
    expect(out[1].unit).toBe("qty");
  });
});

describe("ai-recipe-generator convertTemperature", () => {
  it("returns Celsius in metric", () => {
    const out = convertTemperature(180, "metric");
    expect(out.value).toBe(180);
    expect(out.unit).toBe("°C");
  });
  it("returns Fahrenheit in imperial", () => {
    const out = convertTemperature(180, "imperial");
    expect(out.value).toBe(356);
    expect(out.unit).toBe("°F");
  });
});

describe("ai-recipe-generator generateVariations", () => {
  it("produces at least one variation", () => {
    const out = generateVariations(RECIPES[0]);
    expect(out.length).toBeGreaterThan(0);
  });
  it("produces up to three variations", () => {
    for (const r of RECIPES.slice(0, 10)) {
      const out = generateVariations(r);
      expect(out.length).toBeLessThanOrEqual(3);
      expect(out.length).toBeGreaterThanOrEqual(1);
    }
  });
  it("each variation has a title and description", () => {
    for (const v of generateVariations(RECIPES[0])) {
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.changes.length).toBeGreaterThan(0);
    }
  });
  it("protein swap to tofu adds vegetarian diet", () => {
    // Find a chicken recipe
    const chicken = RECIPES.find((r) => r.ingredients.some((i) => i.name === "chicken"));
    expect(chicken).toBeDefined();
    const variations = generateVariations(chicken!);
    const proteinSwap = variations.find((v) => v.kind === "protein-swap");
    if (proteinSwap) {
      expect(proteinSwap.diets).toContain("vegetarian");
    }
  });
});

describe("ai-recipe-generator buildShoppingList", () => {
  it("builds a list of missing ingredients", () => {
    const have = RECIPES[0].ingredients.slice(0, 1).map((i) => i.name);
    const matched = matchRecipesWithAny([RECIPES[0]], have);
    const list = buildShoppingList(matched);
    expect(list.length).toBeGreaterThan(0);
  });
  it("returns empty list when nothing missing", () => {
    const have = RECIPES[0].ingredients.map((i) => i.name);
    const matched = matchRecipes([RECIPES[0]], have);
    const list = buildShoppingList(matched);
    expect(list).toEqual([]);
  });
  it("tracks which recipes each item is for", () => {
    const have = RECIPES[0].ingredients.slice(0, 1).map((i) => i.name);
    const matched = matchRecipesWithAny([RECIPES[0]], have);
    const list = buildShoppingList(matched);
    for (const item of list) {
      expect(item.inRecipes).toContain(RECIPES[0].title);
    }
  });
});

describe("ai-recipe-generator renderers", () => {
  it("renderMarkdown contains title, ingredients, steps", () => {
    const md = renderMarkdown(RECIPES[0], 4, "metric");
    expect(md).toContain(`# ${RECIPES[0].title}`);
    expect(md).toContain("## Ingredients");
    expect(md).toContain("## Steps");
    expect(md).toContain("## Nutrition");
  });
  it("renderJson produces valid JSON with servings", () => {
    const json = renderJson(RECIPES[0], 4, "metric");
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe(RECIPES[0].title);
    expect(parsed.servings).toBe(4);
  });
  it("renderShoppingListText lists items", () => {
    const txt = renderShoppingListText([{ name: "onion", inRecipes: ["A", "B"] }]);
    expect(txt).toContain("Shopping list:");
    expect(txt).toContain("onion");
  });
  it("renderShoppingListText handles empty list", () => {
    const txt = renderShoppingListText([]);
    expect(txt).toContain("empty");
  });
  it("renderMatchSummary lists matched recipes", () => {
    const matched = matchRecipesWithAny(RECIPES.slice(0, 3), RECIPES[0].ingredients.map((i) => i.name));
    const txt = renderMatchSummary(matched);
    expect(txt).toContain("Matched recipes");
  });
});

describe("ai-recipe-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      ingredientCount: 5,
      matchCount: 10,
      topRecipe: "Pizza",
      topScore: 0.8,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        ingredientCount: 1,
        matchCount: 1,
        topRecipe: "x",
        topScore: 0.5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, ingredientCount: 1, matchCount: 1, topRecipe: "x", topScore: 0.5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-recipe-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ingredients: "tomato, onion",
      diets: ["vegan"],
      excludeAllergens: ["nuts"],
      cuisines: ["italian"],
      maxCookTimeMin: 30,
      servings: 4,
    });
    expect(url).toContain("i=tomato%2C+onion");
    expect(url).toContain("d=vegan");
    expect(url).toContain("a=nuts");
    expect(url).toContain("c=italian");
    expect(url).toContain("t=30");
    expect(url).toContain("s=4");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("i=tomato%2C+onion&d=vegan&c=italian&t=30&s=4");
    expect(p.ingredients).toBe("tomato, onion");
    expect(p.diets).toEqual(["vegan"]);
    expect(p.cuisines).toEqual(["italian"]);
    expect(p.maxCookTimeMin).toBe(30);
    expect(p.servings).toBe(4);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.ingredients).toBe("");
    expect(p.diets).toEqual([]);
    expect(p.maxCookTimeMin).toBe(0);
    expect(p.servings).toBe(0);
  });
  it("filters unknown diets", () => {
    const p = parseShareUrl("d=vegan,unknown");
    expect(p.diets).toEqual(["vegan"]);
  });
  it("filters unknown cuisines", () => {
    const p = parseShareUrl("c=italian,bogus");
    expect(p.cuisines).toEqual(["italian"]);
  });
  it("filters unknown allergens", () => {
    const p = parseShareUrl("a=gluten,fake");
    expect(p.excludeAllergens).toEqual(["gluten"]);
  });
});

describe("ai-recipe-generator LLM helpers", () => {
  it("buildLlmPrompt includes ingredients and diets", () => {
    const p = buildLlmPrompt(["tomato", "onion"], ["vegan"], 4);
    expect(p).toContain("tomato");
    expect(p).toContain("onion");
    expect(p).toContain("vegan");
    expect(p).toContain("4");
  });
  it("renderLlmResult parses valid JSON", () => {
    const json = JSON.stringify({
      title: "Test",
      ingredients: [{ name: "x", amount: 1, unit: "qty" }],
      steps: ["step 1"],
    });
    const out = renderLlmResult(json);
    expect(out.title).toBe("Test");
    expect(out.ingredients).toHaveLength(1);
    expect(out.steps).toEqual(["step 1"]);
  });
  it("renderLlmResult handles invalid JSON gracefully", () => {
    const out = renderLlmResult("not json");
    expect(out.title).toBe("LLM recipe");
    expect(out.ingredients).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = Diet | Allergen | Cuisine;
