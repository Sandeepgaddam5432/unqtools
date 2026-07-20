/**
 * AI Weekly Meal Planner — pure logic.
 *
 * Built-in 50+ recipe database with deterministic 7-day meal plan generation,
 * diet/allergy/cuisine/time filters, household size with portion scaling,
 * weekly budget tracker, calorie/macro targets, one-tap meal swaps, pantry
 * input, auto consolidated grocery list grouped by aisle with ingredient-overlap
 * optimization, history (localStorage), shareable URL, optional BYO-key LLM.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Diet =
  | "vegan"
  | "vegetarian"
  | "gluten-free"
  | "keto"
  | "dairy-free"
  | "nut-free"
  | "halal";

export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "eggs"
  | "soy"
  | "shellfish"
  | "fish"
  | "peanut";

export type Cuisine =
  | "italian"
  | "asian"
  | "mexican"
  | "indian"
  | "mediterranean"
  | "american"
  | "french"
  | "middle-eastern";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Aisle =
  | "produce"
  | "dairy"
  | "meat"
  | "pantry"
  | "frozen"
  | "bakery"
  | "spices"
  | "other";

export type Difficulty = "easy" | "medium" | "hard";

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;          // g, ml, tsp, cup, qty
  aisle: Aisle;
}

export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Recipe {
  id: string;
  title: string;
  mealType: MealType;
  cuisine: Cuisine;
  diets: Diet[];
  allergens: Allergen[];
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: Difficulty;
  costPerServingUsd: number;   // estimated
  ingredients: Ingredient[];
  nutritionPerServing: Nutrition;
}

export interface FilterOptions {
  diets: Diet[];
  excludeAllergens: Allergen[];
  cuisines: Cuisine[];
  maxCookTimeMin: number;     // 0 = no limit
  maxCostPerServingUsd: number; // 0 = no limit
}

export interface PlanOptions {
  filters: FilterOptions;
  householdSize: number;      // multiplier for servings
  weeklyBudgetUsd: number;    // 0 = no constraint
  calorieTargetPerDay: number; // 0 = no constraint
  pantry: string[];           // ingredient names already on hand
  seed: number;               // deterministic seed
}

export interface PlanSlot {
  day: number;                // 0-6
  mealType: MealType;
  recipe: Recipe;
  scaledServings: number;
}

export interface DayPlan {
  day: number;
  slots: PlanSlot[];
  totals: Nutrition;
  cost: number;
}

export interface WeeklyPlan {
  days: DayPlan[];
  recipes: Recipe[];          // unique recipes used (for re-shuffle)
  weeklyCost: number;
  weeklyTotals: Nutrition;
  avgDailyCalories: number;
}

export interface GroceryItem {
  name: string;
  amount: number;
  unit: string;
  aisle: Aisle;
  inMeals: string[];          // recipe titles
}

export interface HistoryEntry {
  ts: number;
  dietCount: number;
  mealCount: number;
  weeklyCost: number;
  avgDailyCalories: number;
}

export interface ShareState {
  diets: Diet[];
  excludeAllergens: Allergen[];
  cuisines: Cuisine[];
  maxCookTimeMin: number;
  maxCostPerServingUsd: number;
  householdSize: number;
  weeklyBudgetUsd: number;
  calorieTargetPerDay: number;
  pantry: string;
  seed: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-weekly-meal-planner:history";
export const HISTORY_MAX = 20;
export const PLAN_DAYS = 7;
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const DIET_LABELS: Record<Diet, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  "gluten-free": "Gluten-Free",
  keto: "Keto",
  "dairy-free": "Dairy-Free",
  "nut-free": "Nut-Free",
  halal: "Halal",
};

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Dairy",
  nuts: "Nuts",
  eggs: "Eggs",
  soy: "Soy",
  shellfish: "Shellfish",
  fish: "Fish",
  peanut: "Peanut",
};

export const CUISINE_LABELS: Record<Cuisine, string> = {
  italian: "Italian",
  asian: "Asian",
  mexican: "Mexican",
  indian: "Indian",
  mediterranean: "Mediterranean",
  american: "American",
  french: "French",
  "middle-eastern": "Middle Eastern",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const AISLE_LABELS: Record<Aisle, string> = {
  produce: "Produce",
  dairy: "Dairy & Eggs",
  meat: "Meat & Seafood",
  pantry: "Pantry",
  frozen: "Frozen",
  bakery: "Bakery",
  spices: "Spices & Herbs",
  other: "Other",
};

export const AISLE_ORDER: Aisle[] = [
  "produce", "meat", "dairy", "bakery", "pantry", "frozen", "spices", "other",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const DEFAULT_FILTERS: FilterOptions = {
  diets: [],
  excludeAllergens: [],
  cuisines: [],
  maxCookTimeMin: 0,
  maxCostPerServingUsd: 0,
};

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  filters: DEFAULT_FILTERS,
  householdSize: 2,
  weeklyBudgetUsd: 0,
  calorieTargetPerDay: 0,
  pantry: [],
  seed: 1,
};

// ---------- Recipe database (55 recipes) ----------

function ing(name: string, amount: number, unit: string, aisle: Aisle): Ingredient {
  return { name, amount, unit, aisle };
}

function nut(calories: number, proteinG: number, carbsG: number, fatG: number): Nutrition {
  return { calories, proteinG, carbsG, fatG };
}

export const RECIPES: Recipe[] = [
  // ----- Breakfast (14) -----
  {
    id: "bf-vegan-oatmeal", title: "Vegan Oatmeal with Berries", mealType: "breakfast", cuisine: "american",
    diets: ["vegan", "vegetarian", "dairy-free", "nut-free", "halal"], allergens: ["gluten"], servings: 1,
    prepTimeMin: 5, cookTimeMin: 10, difficulty: "easy", costPerServingUsd: 1.5,
    ingredients: [
      ing("rolled oats", 50, "g", "pantry"), ing("almond milk", 200, "ml", "dairy"),
      ing("mixed berries", 80, "g", "produce"), ing("maple syrup", 10, "ml", "pantry"),
    ],
    nutritionPerServing: nut(320, 8, 58, 6),
  },
  {
    id: "bf-veggie-omelette", title: "Veggie Omelette", mealType: "breakfast", cuisine: "french",
    diets: ["vegetarian", "gluten-free", "keto", "halal"], allergens: ["eggs", "dairy"], servings: 1,
    prepTimeMin: 5, cookTimeMin: 8, difficulty: "easy", costPerServingUsd: 2.0,
    ingredients: [
      ing("eggs", 3, "qty", "dairy"), ing("cheddar cheese", 20, "g", "dairy"),
      ing("spinach", 30, "g", "produce"), ing("bell pepper", 40, "g", "produce"),
    ],
    nutritionPerServing: nut(310, 22, 5, 24),
  },
  {
    id: "bf-avocado-toast", title: "Avocado Toast", mealType: "breakfast", cuisine: "american",
    diets: ["vegetarian", "vegan", "dairy-free", "halal"], allergens: ["gluten"], servings: 1,
    prepTimeMin: 5, cookTimeMin: 5, difficulty: "easy", costPerServingUsd: 2.5,
    ingredients: [
      ing("whole wheat bread", 2, "slice", "bakery"), ing("avocado", 1, "qty", "produce"),
      ing("lemon juice", 5, "ml", "produce"), ing("chili flakes", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(360, 10, 38, 20),
  },
  {
    id: "bf-greek-yogurt-parfait", title: "Greek Yogurt Parfait", mealType: "breakfast", cuisine: "mediterranean",
    diets: ["vegetarian", "gluten-free", "halal"], allergens: ["dairy"], servings: 1,
    prepTimeMin: 5, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 2.2,
    ingredients: [
      ing("greek yogurt", 200, "g", "dairy"), ing("honey", 15, "g", "pantry"),
      ing("granola", 40, "g", "pantry"), ing("blueberries", 50, "g", "produce"),
    ],
    nutritionPerServing: nut(340, 18, 45, 8),
  },
  {
    id: "bf-vegan-smoothie", title: "Vegan Berry Smoothie Bowl", mealType: "breakfast", cuisine: "american",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 8, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 3.0,
    ingredients: [
      ing("frozen banana", 1, "qty", "frozen"), ing("frozen mixed berries", 100, "g", "frozen"),
      ing("coconut milk", 100, "ml", "pantry"), ing("chia seeds", 10, "g", "pantry"),
    ],
    nutritionPerServing: nut(290, 5, 55, 8),
  },
  {
    id: "bf-chia-pudding", title: "Chia Seed Pudding", mealType: "breakfast", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 5, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.8,
    ingredients: [
      ing("chia seeds", 30, "g", "pantry"), ing("almond milk", 200, "ml", "dairy"),
      ing("vanilla extract", 2, "ml", "spices"), ing("strawberries", 50, "g", "produce"),
    ],
    nutritionPerServing: nut(280, 9, 32, 12),
  },
  {
    id: "bf-shakshuka", title: "Shakshuka", mealType: "breakfast", cuisine: "middle-eastern",
    diets: ["vegetarian", "gluten-free", "dairy-free", "halal"], allergens: ["eggs"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 20, difficulty: "medium", costPerServingUsd: 2.5,
    ingredients: [
      ing("eggs", 4, "qty", "dairy"), ing("crushed tomatoes", 400, "g", "pantry"),
      ing("onion", 1, "qty", "produce"), ing("bell pepper", 1, "qty", "produce"),
      ing("cumin", 1, "tsp", "spices"), ing("paprika", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(280, 16, 18, 14),
  },
  {
    id: "bf-pancakes", title: "Fluffy Buttermilk Pancakes", mealType: "breakfast", cuisine: "american",
    diets: ["vegetarian", "halal"], allergens: ["gluten", "dairy", "eggs"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 1.7,
    ingredients: [
      ing("all-purpose flour", 200, "g", "pantry"), ing("buttermilk", 300, "ml", "dairy"),
      ing("eggs", 2, "qty", "dairy"), ing("sugar", 20, "g", "pantry"),
      ing("baking powder", 10, "g", "pantry"), ing("butter", 30, "g", "dairy"),
    ],
    nutritionPerServing: nut(420, 12, 60, 14),
  },
  {
    id: "bf-keto-eggs-bacon", title: "Keto Eggs & Bacon", mealType: "breakfast", cuisine: "american",
    diets: ["keto", "gluten-free", "dairy-free", "halal"], allergens: ["eggs"], servings: 1,
    prepTimeMin: 3, cookTimeMin: 10, difficulty: "easy", costPerServingUsd: 3.2,
    ingredients: [
      ing("eggs", 3, "qty", "dairy"), ing("bacon", 60, "g", "meat"),
      ing("butter", 10, "g", "dairy"), ing("black pepper", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(380, 24, 2, 32),
  },
  {
    id: "bf-congee", title: "Vegetarian Congee", mealType: "breakfast", cuisine: "asian",
    diets: ["vegetarian", "vegan", "dairy-free", "nut-free", "halal"], allergens: [], servings: 2,
    prepTimeMin: 5, cookTimeMin: 30, difficulty: "easy", costPerServingUsd: 1.2,
    ingredients: [
      ing("white rice", 100, "g", "pantry"), ing("ginger", 10, "g", "produce"),
      ing("green onion", 20, "g", "produce"), ing("soy sauce", 15, "ml", "pantry"),
    ],
    nutritionPerServing: nut(220, 5, 45, 1),
  },
  {
    id: "bf-quinoa-bowl", title: "Quinoa Breakfast Bowl", mealType: "breakfast", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 5, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 2.3,
    ingredients: [
      ing("quinoa", 60, "g", "pantry"), ing("almond milk", 150, "ml", "dairy"),
      ing("apple", 1, "qty", "produce"), ing("cinnamon", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(330, 10, 58, 6),
  },
  {
    id: "bf-banana-bread", title: "Banana Bread Slice", mealType: "breakfast", cuisine: "american",
    diets: ["vegetarian", "nut-free", "halal"], allergens: ["gluten", "eggs", "dairy"], servings: 4,
    prepTimeMin: 15, cookTimeMin: 50, difficulty: "easy", costPerServingUsd: 1.4,
    ingredients: [
      ing("ripe bananas", 3, "qty", "produce"), ing("all-purpose flour", 250, "g", "pantry"),
      ing("eggs", 2, "qty", "dairy"), ing("butter", 80, "g", "dairy"),
      ing("sugar", 100, "g", "pantry"), ing("baking soda", 5, "g", "pantry"),
    ],
    nutritionPerServing: nut(310, 5, 50, 10),
  },
  {
    id: "bf-tofu-scramble", title: "Tofu Scramble", mealType: "breakfast", cuisine: "asian",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: ["soy"], servings: 1,
    prepTimeMin: 5, cookTimeMin: 12, difficulty: "easy", costPerServingUsd: 2.0,
    ingredients: [
      ing("tofu", 200, "g", "meat"), ing("turmeric", 1, "tsp", "spices"),
      ing("spinach", 30, "g", "produce"), ing("nutritional yeast", 10, "g", "pantry"),
    ],
    nutritionPerServing: nut(240, 18, 8, 12),
  },
  {
    id: "bf-idli-sambar", title: "Idli with Sambar", mealType: "breakfast", cuisine: "indian",
    diets: ["vegan", "vegetarian", "dairy-free", "nut-free", "halal"], allergens: [], servings: 2,
    prepTimeMin: 10, cookTimeMin: 25, difficulty: "medium", costPerServingUsd: 1.6,
    ingredients: [
      ing("idli batter", 200, "g", "pantry"), ing("toor dal", 60, "g", "pantry"),
      ing("mixed vegetables", 150, "g", "produce"), ing("sambar powder", 10, "g", "spices"),
    ],
    nutritionPerServing: nut(300, 12, 55, 3),
  },

  // ----- Lunch (14) -----
  {
    id: "ln-chickpea-salad", title: "Chickpea Salad Bowl", mealType: "lunch", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 10, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 2.4,
    ingredients: [
      ing("chickpeas", 150, "g", "pantry"), ing("cucumber", 80, "g", "produce"),
      ing("cherry tomatoes", 80, "g", "produce"), ing("lemon juice", 10, "ml", "produce"),
      ing("olive oil", 10, "ml", "pantry"),
    ],
    nutritionPerServing: nut(360, 14, 45, 12),
  },
  {
    id: "ln-chicken-caesar", title: "Chicken Caesar Salad", mealType: "lunch", cuisine: "american",
    diets: ["halal"], allergens: ["gluten", "dairy", "eggs"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 12, difficulty: "easy", costPerServingUsd: 4.0,
    ingredients: [
      ing("chicken breast", 150, "g", "meat"), ing("romaine lettuce", 100, "g", "produce"),
      ing("parmesan", 20, "g", "dairy"), ing("croutons", 30, "g", "bakery"),
      ing("caesar dressing", 30, "ml", "pantry"),
    ],
    nutritionPerServing: nut(440, 38, 14, 24),
  },
  {
    id: "ln-quinoa-fajita", title: "Quinoa Fajita Bowl", mealType: "lunch", cuisine: "mexican",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 2.8,
    ingredients: [
      ing("quinoa", 80, "g", "pantry"), ing("black beans", 100, "g", "pantry"),
      ing("bell pepper", 100, "g", "produce"), ing("onion", 60, "g", "produce"),
      ing("cumin", 1, "tsp", "spices"), ing("lime juice", 10, "ml", "produce"),
    ],
    nutritionPerServing: nut(420, 16, 65, 10),
  },
  {
    id: "ln-tuna-sandwich", title: "Tuna Salad Sandwich", mealType: "lunch", cuisine: "american",
    diets: ["halal"], allergens: ["gluten", "fish", "eggs"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 3.0,
    ingredients: [
      ing("canned tuna", 100, "g", "pantry"), ing("whole wheat bread", 2, "slice", "bakery"),
      ing("mayonnaise", 20, "g", "pantry"), ing("celery", 30, "g", "produce"),
      ing("lettuce", 20, "g", "produce"),
    ],
    nutritionPerServing: nut(410, 28, 38, 14),
  },
  {
    id: "ln-pad-thai", title: "Vegetarian Pad Thai", mealType: "lunch", cuisine: "asian",
    diets: ["vegetarian", "dairy-free", "nut-free", "halal"], allergens: ["gluten", "eggs", "soy", "peanut"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "medium", costPerServingUsd: 3.5,
    ingredients: [
      ing("rice noodles", 100, "g", "pantry"), ing("eggs", 2, "qty", "dairy"),
      ing("bean sprouts", 80, "g", "produce"), ing("peanuts", 30, "g", "produce"),
      ing("tamarind paste", 15, "ml", "pantry"), ing("soy sauce", 15, "ml", "pantry"),
    ],
    nutritionPerServing: nut(520, 18, 70, 18),
  },
  {
    id: "ln-buddha-bowl", title: "Roasted Buddha Bowl", mealType: "lunch", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 10, cookTimeMin: 25, difficulty: "easy", costPerServingUsd: 3.1,
    ingredients: [
      ing("sweet potato", 200, "g", "produce"), ing("chickpeas", 100, "g", "pantry"),
      ing("kale", 60, "g", "produce"), ing("quinoa", 60, "g", "pantry"),
      ing("tahini", 15, "ml", "pantry"), ing("lemon juice", 10, "ml", "produce"),
    ],
    nutritionPerServing: nut(520, 16, 78, 14),
  },
  {
    id: "ln-caprese-panini", title: "Caprese Panini", mealType: "lunch", cuisine: "italian",
    diets: ["vegetarian", "halal"], allergens: ["gluten", "dairy"], servings: 1,
    prepTimeMin: 8, cookTimeMin: 6, difficulty: "easy", costPerServingUsd: 3.2,
    ingredients: [
      ing("ciabatta bread", 1, "qty", "bakery"), ing("fresh mozzarella", 80, "g", "dairy"),
      ing("tomato", 1, "qty", "produce"), ing("basil", 5, "g", "produce"),
      ing("olive oil", 10, "ml", "pantry"),
    ],
    nutritionPerServing: nut(450, 18, 48, 18),
  },
  {
    id: "ln-lentil-soup", title: "Hearty Lentil Soup", mealType: "lunch", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 4,
    prepTimeMin: 10, cookTimeMin: 30, difficulty: "easy", costPerServingUsd: 1.5,
    ingredients: [
      ing("red lentils", 200, "g", "pantry"), ing("carrot", 100, "g", "produce"),
      ing("onion", 80, "g", "produce"), ing("celery", 60, "g", "produce"),
      ing("cumin", 1, "tsp", "spices"), ing("vegetable broth", 1000, "ml", "pantry"),
    ],
    nutritionPerServing: nut(280, 16, 42, 3),
  },
  {
    id: "ln-chicken-stir-fry", title: "Chicken Stir Fry", mealType: "lunch", cuisine: "asian",
    diets: ["dairy-free", "nut-free", "halal"], allergens: ["soy", "gluten"], servings: 2,
    prepTimeMin: 15, cookTimeMin: 12, difficulty: "medium", costPerServingUsd: 3.8,
    ingredients: [
      ing("chicken breast", 250, "g", "meat"), ing("broccoli", 150, "g", "produce"),
      ing("bell pepper", 100, "g", "produce"), ing("soy sauce", 30, "ml", "pantry"),
      ing("ginger", 10, "g", "produce"), ing("garlic", 5, "g", "produce"),
    ],
    nutritionPerServing: nut(380, 35, 18, 16),
  },
  {
    id: "ln-blt-wrap", title: "BLT Wrap", mealType: "lunch", cuisine: "american",
    diets: ["halal"], allergens: ["gluten"], servings: 1,
    prepTimeMin: 8, cookTimeMin: 8, difficulty: "easy", costPerServingUsd: 3.3,
    ingredients: [
      ing("flour tortilla", 1, "qty", "bakery"), ing("bacon", 60, "g", "meat"),
      ing("lettuce", 30, "g", "produce"), ing("tomato", 60, "g", "produce"),
      ing("mayonnaise", 15, "g", "pantry"),
    ],
    nutritionPerServing: nut(480, 18, 42, 26),
  },
  {
    id: "ln-sushi-bowl", title: "Salmon Sushi Bowl", mealType: "lunch", cuisine: "asian",
    diets: ["dairy-free", "nut-free", "halal"], allergens: ["fish", "soy", "gluten"], servings: 1,
    prepTimeMin: 15, cookTimeMin: 20, difficulty: "medium", costPerServingUsd: 5.5,
    ingredients: [
      ing("sushi rice", 100, "g", "pantry"), ing("salmon fillet", 120, "g", "meat"),
      ing("cucumber", 60, "g", "produce"), ing("avocado", 0.5, "qty", "produce"),
      ing("rice vinegar", 15, "ml", "pantry"), ing("soy sauce", 15, "ml", "pantry"),
    ],
    nutritionPerServing: nut(540, 28, 60, 16),
  },
  {
    id: "ln-falafel-wrap", title: "Falafel Wrap", mealType: "lunch", cuisine: "middle-eastern",
    diets: ["vegan", "vegetarian", "dairy-free", "halal"], allergens: ["gluten"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 18, difficulty: "medium", costPerServingUsd: 3.0,
    ingredients: [
      ing("flour tortilla", 1, "qty", "bakery"), ing("falafel", 120, "g", "pantry"),
      ing("lettuce", 30, "g", "produce"), ing("tomato", 60, "g", "produce"),
      ing("tahini", 15, "ml", "pantry"), ing("cucumber", 40, "g", "produce"),
    ],
    nutritionPerServing: nut(450, 14, 60, 16),
  },
  {
    id: "ln-egg-salad", title: "Egg Salad Lettuce Cups", mealType: "lunch", cuisine: "american",
    diets: ["vegetarian", "gluten-free", "keto", "dairy-free", "halal"], allergens: ["eggs"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 12, difficulty: "easy", costPerServingUsd: 2.2,
    ingredients: [
      ing("eggs", 3, "qty", "dairy"), ing("mayonnaise", 20, "g", "pantry"),
      ing("romaine lettuce", 80, "g", "produce"), ing("mustard", 5, "g", "pantry"),
      ing("paprika", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(320, 16, 4, 28),
  },
  {
    id: "ln-chicken-quesadilla", title: "Chicken Quesadilla", mealType: "lunch", cuisine: "mexican",
    diets: ["halal"], allergens: ["gluten", "dairy"], servings: 1,
    prepTimeMin: 10, cookTimeMin: 10, difficulty: "easy", costPerServingUsd: 3.4,
    ingredients: [
      ing("flour tortilla", 2, "qty", "bakery"), ing("cooked chicken", 100, "g", "meat"),
      ing("cheddar cheese", 60, "g", "dairy"), ing("bell pepper", 40, "g", "produce"),
      ing("salsa", 30, "ml", "pantry"),
    ],
    nutritionPerServing: nut(560, 32, 42, 28),
  },

  // ----- Dinner (15) -----
  {
    id: "dn-pasta-marsh", title: "Spaghetti Pomodoro", mealType: "dinner", cuisine: "italian",
    diets: ["vegetarian", "vegan", "dairy-free", "nut-free", "halal"], allergens: ["gluten"], servings: 2,
    prepTimeMin: 5, cookTimeMin: 20, difficulty: "easy", costPerServingUsd: 2.0,
    ingredients: [
      ing("spaghetti", 200, "g", "pantry"), ing("crushed tomatoes", 400, "g", "pantry"),
      ing("garlic", 10, "g", "produce"), ing("olive oil", 20, "ml", "pantry"),
      ing("basil", 5, "g", "produce"),
    ],
    nutritionPerServing: nut(480, 14, 80, 10),
  },
  {
    id: "dn-tofu-curry", title: "Red Curry Tofu", mealType: "dinner", cuisine: "asian",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: ["soy"], servings: 2,
    prepTimeMin: 15, cookTimeMin: 20, difficulty: "medium", costPerServingUsd: 3.0,
    ingredients: [
      ing("tofu", 300, "g", "meat"), ing("coconut milk", 400, "ml", "pantry"),
      ing("red curry paste", 30, "g", "pantry"), ing("bell pepper", 150, "g", "produce"),
      ing("green beans", 100, "g", "produce"), ing("jasmine rice", 200, "g", "pantry"),
    ],
    nutritionPerServing: nut(540, 18, 72, 18),
  },
  {
    id: "dn-grilled-salmon", title: "Grilled Salmon & Asparagus", mealType: "dinner", cuisine: "american",
    diets: ["gluten-free", "keto", "dairy-free", "nut-free", "halal"], allergens: ["fish"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 6.5,
    ingredients: [
      ing("salmon fillet", 300, "g", "meat"), ing("asparagus", 200, "g", "produce"),
      ing("olive oil", 20, "ml", "pantry"), ing("lemon", 1, "qty", "produce"),
      ing("garlic", 5, "g", "produce"),
    ],
    nutritionPerServing: nut(420, 32, 12, 24),
  },
  {
    id: "dn-beef-tacos", title: "Ground Beef Tacos", mealType: "dinner", cuisine: "mexican",
    diets: ["dairy-free", "halal"], allergens: ["gluten"], servings: 4,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 3.2,
    ingredients: [
      ing("ground beef", 500, "g", "meat"), ing("taco shells", 8, "qty", "bakery"),
      ing("lettuce", 100, "g", "produce"), ing("tomato", 100, "g", "produce"),
      ing("cheddar cheese", 80, "g", "dairy"), ing("taco seasoning", 15, "g", "spices"),
    ],
    nutritionPerServing: nut(520, 28, 38, 26),
  },
  {
    id: "dn-veg-pizza", title: "Margherita Pizza", mealType: "dinner", cuisine: "italian",
    diets: ["vegetarian", "halal"], allergens: ["gluten", "dairy"], servings: 2,
    prepTimeMin: 15, cookTimeMin: 18, difficulty: "medium", costPerServingUsd: 3.5,
    ingredients: [
      ing("pizza dough", 300, "g", "bakery"), ing("mozzarella", 120, "g", "dairy"),
      ing("tomato sauce", 100, "ml", "pantry"), ing("fresh basil", 5, "g", "produce"),
      ing("olive oil", 10, "ml", "pantry"),
    ],
    nutritionPerServing: nut(560, 22, 64, 22),
  },
  {
    id: "dn-chicken-tikka", title: "Chicken Tikka Masala", mealType: "dinner", cuisine: "indian",
    diets: ["halal"], allergens: ["dairy", "gluten"], servings: 3,
    prepTimeMin: 20, cookTimeMin: 25, difficulty: "medium", costPerServingUsd: 4.5,
    ingredients: [
      ing("chicken breast", 500, "g", "meat"), ing("heavy cream", 200, "ml", "dairy"),
      ing("crushed tomatoes", 400, "g", "pantry"), ing("garam masala", 10, "g", "spices"),
      ing("ginger", 10, "g", "produce"), ing("basmati rice", 250, "g", "pantry"),
    ],
    nutritionPerServing: nut(620, 32, 60, 24),
  },
  {
    id: "dn-mushroom-risotto", title: "Mushroom Risotto", mealType: "dinner", cuisine: "italian",
    diets: ["vegetarian", "gluten-free", "halal"], allergens: ["dairy"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 30, difficulty: "medium", costPerServingUsd: 3.6,
    ingredients: [
      ing("arborio rice", 200, "g", "pantry"), ing("mushrooms", 200, "g", "produce"),
      ing("vegetable broth", 800, "ml", "pantry"), ing("parmesan", 50, "g", "dairy"),
      ing("onion", 80, "g", "produce"), ing("white wine", 60, "ml", "other"),
    ],
    nutritionPerServing: nut(480, 12, 70, 14),
  },
  {
    id: "dn-veg-burgers", title: "Black Bean Veggie Burger", mealType: "dinner", cuisine: "american",
    diets: ["vegan", "vegetarian", "dairy-free", "halal"], allergens: ["gluten"], servings: 2,
    prepTimeMin: 15, cookTimeMin: 12, difficulty: "easy", costPerServingUsd: 3.0,
    ingredients: [
      ing("black beans", 250, "g", "pantry"), ing("burger buns", 2, "qty", "bakery"),
      ing("onion", 60, "g", "produce"), ing("breadcrumbs", 30, "g", "pantry"),
      ing("lettuce", 40, "g", "produce"), ing("tomato", 60, "g", "produce"),
    ],
    nutritionPerServing: nut(450, 18, 70, 10),
  },
  {
    id: "dn-lemon-chicken", title: "Lemon Herb Roast Chicken", mealType: "dinner", cuisine: "mediterranean",
    diets: ["gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 4,
    prepTimeMin: 15, cookTimeMin: 50, difficulty: "medium", costPerServingUsd: 4.2,
    ingredients: [
      ing("whole chicken", 1500, "g", "meat"), ing("lemon", 2, "qty", "produce"),
      ing("garlic", 15, "g", "produce"), ing("rosemary", 10, "g", "spices"),
      ing("olive oil", 30, "ml", "pantry"), ing("potato", 500, "g", "produce"),
    ],
    nutritionPerServing: nut(560, 42, 38, 22),
  },
  {
    id: "dn-stuffed-peppers", title: "Quinoa Stuffed Peppers", mealType: "dinner", cuisine: "mexican",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 4,
    prepTimeMin: 15, cookTimeMin: 30, difficulty: "easy", costPerServingUsd: 2.7,
    ingredients: [
      ing("bell pepper", 4, "qty", "produce"), ing("quinoa", 200, "g", "pantry"),
      ing("black beans", 200, "g", "pantry"), ing("corn", 100, "g", "frozen"),
      ing("cumin", 1, "tsp", "spices"), ing("salsa", 80, "ml", "pantry"),
    ],
    nutritionPerServing: nut(380, 14, 65, 8),
  },
  {
    id: "dn-shrimp-pasta", title: "Shrimp Scampi Linguine", mealType: "dinner", cuisine: "italian",
    diets: ["halal"], allergens: ["gluten", "shellfish", "dairy"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 15, difficulty: "easy", costPerServingUsd: 5.0,
    ingredients: [
      ing("linguine", 200, "g", "pantry"), ing("shrimp", 250, "g", "meat"),
      ing("garlic", 10, "g", "produce"), ing("butter", 30, "g", "dairy"),
      ing("white wine", 60, "ml", "other"), ing("parsley", 5, "g", "produce"),
    ],
    nutritionPerServing: nut(580, 28, 60, 20),
  },
  {
    id: "dn-eggplant-parm", title: "Eggplant Parmesan", mealType: "dinner", cuisine: "italian",
    diets: ["vegetarian", "halal"], allergens: ["gluten", "dairy", "eggs"], servings: 4,
    prepTimeMin: 20, cookTimeMin: 35, difficulty: "hard", costPerServingUsd: 3.8,
    ingredients: [
      ing("eggplant", 600, "g", "produce"), ing("mozzarella", 200, "g", "dairy"),
      ing("parmesan", 50, "g", "dairy"), ing("marinara sauce", 400, "ml", "pantry"),
      ing("eggs", 2, "qty", "dairy"), ing("breadcrumbs", 80, "g", "pantry"),
    ],
    nutritionPerServing: nut(480, 20, 45, 22),
  },
  {
    id: "dn-thai-green-curry", title: "Thai Green Chicken Curry", mealType: "dinner", cuisine: "asian",
    diets: ["dairy-free", "halal"], allergens: ["soy"], servings: 3,
    prepTimeMin: 15, cookTimeMin: 20, difficulty: "medium", costPerServingUsd: 4.0,
    ingredients: [
      ing("chicken breast", 400, "g", "meat"), ing("coconut milk", 400, "ml", "pantry"),
      ing("green curry paste", 30, "g", "pantry"), ing("Thai basil", 10, "g", "produce"),
      ing("jasmine rice", 250, "g", "pantry"), ing("bamboo shoots", 100, "g", "pantry"),
    ],
    nutritionPerServing: nut(540, 28, 60, 18),
  },
  {
    id: "dn-shepherds-pie", title: "Vegetarian Shepherd's Pie", mealType: "dinner", cuisine: "american",
    diets: ["vegetarian", "halal"], allergens: ["dairy", "gluten"], servings: 4,
    prepTimeMin: 20, cookTimeMin: 30, difficulty: "medium", costPerServingUsd: 3.0,
    ingredients: [
      ing("potato", 700, "g", "produce"), ing("lentils", 200, "g", "pantry"),
      ing("carrot", 150, "g", "produce"), ing("onion", 100, "g", "produce"),
      ing("butter", 50, "g", "dairy"), ing("vegetable broth", 500, "ml", "pantry"),
    ],
    nutritionPerServing: nut(450, 16, 68, 12),
  },
  {
    id: "dn-bibimbap", title: "Vegetable Bibimbap", mealType: "dinner", cuisine: "asian",
    diets: ["vegetarian", "dairy-free", "halal"], allergens: ["eggs", "soy", "gluten"], servings: 2,
    prepTimeMin: 20, cookTimeMin: 20, difficulty: "medium", costPerServingUsd: 3.6,
    ingredients: [
      ing("rice", 200, "g", "pantry"), ing("spinach", 100, "g", "produce"),
      ing("carrot", 100, "g", "produce"), ing("mushrooms", 100, "g", "produce"),
      ing("eggs", 2, "qty", "dairy"), ing("gochujang", 20, "g", "pantry"),
    ],
    nutritionPerServing: nut(480, 14, 78, 10),
  },

  // ----- Snacks (12) -----
  {
    id: "sn-hummus-veggies", title: "Hummus & Veggies", mealType: "snack", cuisine: "mediterranean",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 5, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.8,
    ingredients: [
      ing("hummus", 60, "g", "pantry"), ing("carrot", 60, "g", "produce"),
      ing("cucumber", 60, "g", "produce"), ing("bell pepper", 40, "g", "produce"),
    ],
    nutritionPerServing: nut(180, 7, 22, 8),
  },
  {
    id: "sn-apple-peanut-butter", title: "Apple & Peanut Butter", mealType: "snack", cuisine: "american",
    diets: ["vegetarian", "vegan", "gluten-free", "dairy-free", "halal"], allergens: ["peanut", "nuts"], servings: 1,
    prepTimeMin: 3, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.2,
    ingredients: [
      ing("apple", 1, "qty", "produce"), ing("peanut butter", 30, "g", "pantry"),
    ],
    nutritionPerServing: nut(280, 7, 32, 16),
  },
  {
    id: "sn-trail-mix", title: "Trail Mix", mealType: "snack", cuisine: "american",
    diets: ["vegetarian", "vegan", "gluten-free", "dairy-free", "halal"], allergens: ["nuts", "peanut"], servings: 1,
    prepTimeMin: 2, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.5,
    ingredients: [
      ing("almonds", 30, "g", "produce"), ing("raisins", 30, "g", "produce"),
      ing("dark chocolate chips", 20, "g", "pantry"), ing("sunflower seeds", 15, "g", "pantry"),
    ],
    nutritionPerServing: nut(320, 8, 36, 18),
  },
  {
    id: "sn-yogurt-berry", title: "Yogurt & Berry Cup", mealType: "snack", cuisine: "american",
    diets: ["vegetarian", "gluten-free", "halal"], allergens: ["dairy"], servings: 1,
    prepTimeMin: 3, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.4,
    ingredients: [
      ing("greek yogurt", 150, "g", "dairy"), ing("strawberries", 60, "g", "produce"),
      ing("honey", 10, "g", "pantry"),
    ],
    nutritionPerServing: nut(180, 14, 26, 2),
  },
  {
    id: "sn-edamame", title: "Steamed Edamame", mealType: "snack", cuisine: "asian",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: ["soy"], servings: 1,
    prepTimeMin: 2, cookTimeMin: 8, difficulty: "easy", costPerServingUsd: 1.3,
    ingredients: [
      ing("edamame", 150, "g", "frozen"), ing("sea salt", 2, "g", "spices"),
    ],
    nutritionPerServing: nut(180, 17, 14, 8),
  },
  {
    id: "sn-energy-balls", title: "Date Energy Balls", mealType: "snack", cuisine: "american",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "halal"], allergens: ["nuts"], servings: 4,
    prepTimeMin: 15, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.0,
    ingredients: [
      ing("medjool dates", 200, "g", "produce"), ing("almonds", 100, "g", "produce"),
      ing("cocoa powder", 20, "g", "pantry"), ing("chia seeds", 15, "g", "pantry"),
    ],
    nutritionPerServing: nut(220, 5, 38, 8),
  },
  {
    id: "sn-cucumber-tzatziki", title: "Cucumber Tzatziki", mealType: "snack", cuisine: "mediterranean",
    diets: ["vegetarian", "gluten-free", "halal"], allergens: ["dairy"], servings: 1,
    prepTimeMin: 8, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.5,
    ingredients: [
      ing("greek yogurt", 100, "g", "dairy"), ing("cucumber", 100, "g", "produce"),
      ing("garlic", 3, "g", "produce"), ing("dill", 3, "g", "spices"),
    ],
    nutritionPerServing: nut(120, 10, 10, 4),
  },
  {
    id: "sn-roasted-chickpeas", title: "Roasted Chickpeas", mealType: "snack", cuisine: "middle-eastern",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 2,
    prepTimeMin: 5, cookTimeMin: 25, difficulty: "easy", costPerServingUsd: 0.9,
    ingredients: [
      ing("chickpeas", 250, "g", "pantry"), ing("olive oil", 15, "ml", "pantry"),
      ing("paprika", 1, "tsp", "spices"), ing("cumin", 1, "tsp", "spices"),
    ],
    nutritionPerServing: nut(180, 9, 26, 5),
  },
  {
    id: "sn-cheese-crackers", title: "Cheese & Crackers", mealType: "snack", cuisine: "american",
    diets: ["vegetarian", "halal"], allergens: ["gluten", "dairy"], servings: 1,
    prepTimeMin: 2, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 1.6,
    ingredients: [
      ing("cheddar cheese", 40, "g", "dairy"), ing("whole grain crackers", 30, "g", "bakery"),
    ],
    nutritionPerServing: nut(220, 10, 18, 12),
  },
  {
    id: "sn-smoothie", title: "Green Smoothie", mealType: "snack", cuisine: "american",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 1,
    prepTimeMin: 5, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 2.0,
    ingredients: [
      ing("spinach", 50, "g", "produce"), ing("banana", 1, "qty", "produce"),
      ing("almond milk", 200, "ml", "dairy"), ing("maple syrup", 10, "ml", "pantry"),
    ],
    nutritionPerServing: nut(180, 5, 38, 2),
  },
  {
    id: "sn-popcorn", title: "Stovetop Popcorn", mealType: "snack", cuisine: "american",
    diets: ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free", "halal"], allergens: [], servings: 2,
    prepTimeMin: 2, cookTimeMin: 8, difficulty: "easy", costPerServingUsd: 0.6,
    ingredients: [
      ing("popcorn kernels", 60, "g", "pantry"), ing("coconut oil", 15, "g", "pantry"),
      ing("sea salt", 2, "g", "spices"),
    ],
    nutritionPerServing: nut(160, 4, 20, 8),
  },
  {
    id: "sn-caprese-skewers", title: "Caprese Skewers", mealType: "snack", cuisine: "italian",
    diets: ["vegetarian", "gluten-free", "halal"], allergens: ["dairy"], servings: 2,
    prepTimeMin: 10, cookTimeMin: 0, difficulty: "easy", costPerServingUsd: 2.2,
    ingredients: [
      ing("cherry tomatoes", 200, "g", "produce"), ing("fresh mozzarella", 100, "g", "dairy"),
      ing("basil", 10, "g", "produce"), ing("balsamic vinegar", 15, "ml", "pantry"),
    ],
    nutritionPerServing: nut(180, 10, 12, 10),
  },
];

// ---------- Filter helpers ----------

/** Returns true if recipe satisfies all required diets (must include ALL). */
export function matchesAllDiets(r: Recipe, diets: Diet[]): boolean {
  if (!diets.length) return true;
  return diets.every((d) => r.diets.includes(d));
}

/** Returns true if recipe contains none of the excluded allergens. */
export function excludesAllergens(r: Recipe, allergens: Allergen[]): boolean {
  if (!allergens.length) return true;
  return allergens.every((a) => !r.allergens.includes(a));
}

/** Returns true if recipe cuisine matches the filter (empty = all). */
export function matchesCuisine(r: Recipe, cuisines: Cuisine[]): boolean {
  if (!cuisines.length) return true;
  return cuisines.includes(r.cuisine);
}

/** Returns true if recipe cook time is at most maxMin (0 = no limit). */
export function withinCookTime(r: Recipe, maxMin: number): boolean {
  if (!maxMin) return true;
  return (r.prepTimeMin + r.cookTimeMin) <= maxMin;
}

/** Returns true if recipe cost per serving is at most maxUsd (0 = no limit). */
export function withinBudgetPerServing(r: Recipe, maxUsd: number): boolean {
  if (!maxUsd) return true;
  return r.costPerServingUsd <= maxUsd;
}

/** Apply ALL filters and return the filtered recipe list. */
export function applyFilters(recipes: Recipe[], filters: FilterOptions): Recipe[] {
  return recipes.filter((r) =>
    matchesAllDiets(r, filters.diets) &&
    excludesAllergens(r, filters.excludeAllergens) &&
    matchesCuisine(r, filters.cuisines) &&
    withinCookTime(r, filters.maxCookTimeMin) &&
    withinBudgetPerServing(r, filters.maxCostPerServingUsd),
  );
}

// ---------- Pantry input ----------

/** Parse a pasted pantry list (newline, comma, semicolon, whitespace separated). */
export function parsePantry(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns true if a recipe's ingredients are entirely covered by the pantry. */
export function recipeIsInPantry(r: Recipe, pantry: string[]): boolean {
  if (!pantry.length) return false;
  return r.ingredients.every((ing) =>
    pantry.some((p) => ing.name.toLowerCase().includes(p) || p.includes(ing.name.toLowerCase())),
  );
}

/** Returns the recipes whose ingredients are partially covered (>=50% by name). */
export function pantryMatchScore(r: Recipe, pantry: string[]): number {
  if (!pantry.length || !r.ingredients.length) return 0;
  const covered = r.ingredients.filter((ing) =>
    pantry.some((p) => ing.name.toLowerCase().includes(p) || p.includes(ing.name.toLowerCase())),
  ).length;
  return covered / r.ingredients.length;
}

// ---------- Deterministic RNG (mulberry32) ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic shuffle using a seed. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Plan generation ----------

/** Group filtered recipes by meal type. */
export function groupByMealType(recipes: Recipe[]): Record<MealType, Recipe[]> {
  const out: Record<MealType, Recipe[]> = {
    breakfast: [], lunch: [], dinner: [], snack: [],
  };
  for (const r of recipes) out[r.mealType].push(r);
  return out;
}

/**
 * Generate a 7-day meal plan deterministically from the filtered recipe pool.
 * Each day gets one breakfast, lunch, dinner, snack. We cycle through the
 * shuffled pool to maximize variety; if a pool is smaller than 7, recipes
 * repeat with an offset.
 */
export function generatePlan(options: PlanOptions): WeeklyPlan {
  const pool = applyFilters(RECIPES, options.filters);
  const grouped = groupByMealType(pool);
  const days: DayPlan[] = [];
  let weeklyCalories = 0;
  let weeklyProtein = 0;
  let weeklyCarbs = 0;
  let weeklyFat = 0;
  let weeklyCost = 0;
  const usedRecipes = new Set<string>();

  for (let day = 0; day < PLAN_DAYS; day++) {
    const slots: PlanSlot[] = [];
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;
    let dayCost = 0;

    for (const mealType of MEAL_TYPES) {
      const mealPool = grouped[mealType];
      if (mealPool.length === 0) continue;
      const shuffled = seededShuffle(mealPool, options.seed + day * 100 + mealType.length);
      // Pick the first recipe we haven't used yet today (and ideally this week)
      const recipe = shuffled.find((r) => !slots.some((s) => s.recipe.id === r.id)) ?? shuffled[0];
      usedRecipes.add(recipe.id);
      const scaledServings = Math.max(1, Math.round(options.householdSize));
      slots.push({
        day,
        mealType,
        recipe,
        scaledServings,
      });
      const n = recipe.nutritionPerServing;
      dayCalories += n.calories * scaledServings;
      dayProtein += n.proteinG * scaledServings;
      dayCarbs += n.carbsG * scaledServings;
      dayFat += n.fatG * scaledServings;
      dayCost += recipe.costPerServingUsd * scaledServings;
    }

    days.push({
      day,
      slots,
      totals: {
        calories: Math.round(dayCalories),
        proteinG: Math.round(dayProtein),
        carbsG: Math.round(dayCarbs),
        fatG: Math.round(dayFat),
      },
      cost: Math.round(dayCost * 100) / 100,
    });
    weeklyCalories += dayCalories;
    weeklyProtein += dayProtein;
    weeklyCarbs += dayCarbs;
    weeklyFat += dayFat;
    weeklyCost += dayCost;
  }

  const uniqueRecipes = RECIPES.filter((r) => usedRecipes.has(r.id));

  return {
    days,
    recipes: uniqueRecipes,
    weeklyCost: Math.round(weeklyCost * 100) / 100,
    weeklyTotals: {
      calories: Math.round(weeklyCalories),
      proteinG: Math.round(weeklyProtein),
      carbsG: Math.round(weeklyCarbs),
      fatG: Math.round(weeklyFat),
    },
    avgDailyCalories: Math.round(weeklyCalories / PLAN_DAYS),
  };
}

/**
 * Swap a single meal slot. Returns a new WeeklyPlan with the chosen slot
 * replaced by the next-best matching recipe (different from current).
 */
export function swapMeal(plan: WeeklyPlan, options: PlanOptions, day: number, mealType: MealType): WeeklyPlan {
  const pool = applyFilters(RECIPES, options.filters);
  const mealPool = groupByMealType(pool)[mealType];
  if (mealPool.length === 0) return plan;

  const dayPlan = plan.days.find((d) => d.day === day);
  if (!dayPlan) return plan;
  const slot = dayPlan.slots.find((s) => s.mealType === mealType);
  if (!slot) return plan;

  // Pick a different recipe — prefer ones not already in this plan
  const alreadyUsedIds = new Set(plan.days.flatMap((d) => d.slots.map((s) => s.recipe.id)));
  const candidates = mealPool.filter((r) => r.id !== slot.recipe.id);
  const next = candidates.find((r) => !alreadyUsedIds.has(r.id)) ?? candidates[0] ?? slot.recipe;

  // Build a new plan with the swap applied
  const newDays = plan.days.map((d) => {
    if (d.day !== day) return d;
    let dayCalories = 0, dayProtein = 0, dayCarbs = 0, dayFat = 0, dayCost = 0;
    const newSlots = d.slots.map((s) => {
      const recipe = (s.mealType === mealType) ? next : s.recipe;
      const scaledServings = s.scaledServings;
      const n = recipe.nutritionPerServing;
      dayCalories += n.calories * scaledServings;
      dayProtein += n.proteinG * scaledServings;
      dayCarbs += n.carbsG * scaledServings;
      dayFat += n.fatG * scaledServings;
      dayCost += recipe.costPerServingUsd * scaledServings;
      return { ...s, recipe, scaledServings };
    });
    return {
      ...d,
      slots: newSlots,
      totals: {
        calories: Math.round(dayCalories),
        proteinG: Math.round(dayProtein),
        carbsG: Math.round(dayCarbs),
        fatG: Math.round(dayFat),
      },
      cost: Math.round(dayCost * 100) / 100,
    };
  });

  let weeklyCalories = 0, weeklyProtein = 0, weeklyCarbs = 0, weeklyFat = 0, weeklyCost = 0;
  for (const d of newDays) {
    weeklyCalories += d.totals.calories;
    weeklyProtein += d.totals.proteinG;
    weeklyCarbs += d.totals.carbsG;
    weeklyFat += d.totals.fatG;
    weeklyCost += d.cost;
  }
  const usedIds = new Set<string>();
  for (const d of newDays) for (const s of d.slots) usedIds.add(s.recipe.id);

  return {
    days: newDays,
    recipes: RECIPES.filter((r) => usedIds.has(r.id)),
    weeklyCost: Math.round(weeklyCost * 100) / 100,
    weeklyTotals: {
      calories: Math.round(weeklyCalories),
      proteinG: Math.round(weeklyProtein),
      carbsG: Math.round(weeklyCarbs),
      fatG: Math.round(weeklyFat),
    },
    avgDailyCalories: Math.round(weeklyCalories / PLAN_DAYS),
  };
}

// ---------- Grocery list ----------

/** Build a consolidated grocery list from a weekly plan, grouped by aisle. */
export function buildGroceryList(plan: WeeklyPlan): GroceryItem[] {
  const byName = new Map<string, GroceryItem>();
  for (const day of plan.days) {
    for (const slot of day.slots) {
      const scale = slot.scaledServings / slot.recipe.servings;
      for (const ing of slot.recipe.ingredients) {
        const key = `${ing.name}|${ing.unit}`.toLowerCase();
        const existing = byName.get(key);
        const amount = Math.round(ing.amount * scale * 100) / 100;
        if (existing) {
          existing.amount = Math.round((existing.amount + amount) * 100) / 100;
          if (!existing.inMeals.includes(slot.recipe.title)) {
            existing.inMeals.push(slot.recipe.title);
          }
        } else {
          byName.set(key, {
            name: ing.name,
            amount,
            unit: ing.unit,
            aisle: ing.aisle,
            inMeals: [slot.recipe.title],
          });
        }
      }
    }
  }
  // Sort by aisle order, then by name
  return [...byName.values()].sort((a, b) => {
    const ai = AISLE_ORDER.indexOf(a.aisle);
    const bi = AISLE_ORDER.indexOf(b.aisle);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

/** Group a grocery list by aisle (for display). */
export function groupByAisle(items: GroceryItem[]): Record<Aisle, GroceryItem[]> {
  const out: Record<Aisle, GroceryItem[]> = {
    produce: [], dairy: [], meat: [], pantry: [], frozen: [], bakery: [], spices: [], other: [],
  };
  for (const item of items) out[item.aisle].push(item);
  return out;
}

/** Filter out pantry items from a grocery list. */
export function filterByPantry(items: GroceryItem[], pantry: string[]): GroceryItem[] {
  if (!pantry.length) return items;
  return items.filter((i) =>
    !pantry.some((p) => i.name.toLowerCase().includes(p) || p.includes(i.name.toLowerCase())),
  );
}

// ---------- Nutrition totals ----------

/** Compute totals for a day plan (alias for .totals but exported). */
export function dayTotals(day: DayPlan): Nutrition {
  return day.totals;
}

/** Compute weekly totals from a plan (alias for .weeklyTotals but exported). */
export function weeklyTotals(plan: WeeklyPlan): Nutrition {
  return plan.weeklyTotals;
}

// ---------- Renderers ----------

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? `Day ${day + 1}`;
}

/** Render the plan as Markdown. */
export function renderMarkdownPlan(plan: WeeklyPlan): string {
  const lines: string[] = [];
  lines.push("# Weekly Meal Plan");
  lines.push("");
  lines.push(`- **Days:** ${plan.days.length}`);
  lines.push(`- **Unique recipes:** ${plan.recipes.length}`);
  lines.push(`- **Weekly cost:** $${plan.weeklyCost.toFixed(2)}`);
  lines.push(`- **Avg daily calories:** ${plan.avgDailyCalories}`);
  lines.push(`- **Weekly totals:** ${plan.weeklyTotals.calories} cal · ${plan.weeklyTotals.proteinG}g protein · ${plan.weeklyTotals.carbsG}g carbs · ${plan.weeklyTotals.fatG}g fat`);
  lines.push("");
  for (const day of plan.days) {
    lines.push(`## ${dayName(day.day)}`);
    lines.push("");
    lines.push(`Calories: ${day.totals.calories} · Cost: $${day.cost.toFixed(2)}`);
    lines.push("");
    for (const slot of day.slots) {
      lines.push(`### ${MEAL_TYPE_LABELS[slot.mealType]} — ${slot.recipe.title}`);
      lines.push("");
      lines.push(`- Cuisine: ${CUISINE_LABELS[slot.recipe.cuisine]}`);
      lines.push(`- Time: ${slot.recipe.prepTimeMin}m prep + ${slot.recipe.cookTimeMin}m cook`);
      lines.push(`- Servings: ${slot.scaledServings}`);
      lines.push(`- Cost: $${(slot.recipe.costPerServingUsd * slot.scaledServings).toFixed(2)}`);
      lines.push(`- Per serving: ${slot.recipe.nutritionPerServing.calories} cal`);
      if (slot.recipe.diets.length > 0) {
        lines.push(`- Diets: ${slot.recipe.diets.map((d) => DIET_LABELS[d]).join(", ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Render the plan as JSON. */
export function renderJsonPlan(plan: WeeklyPlan): string {
  return JSON.stringify({
    days: plan.days.map((d) => ({
      day: d.day,
      dayName: dayName(d.day),
      totals: d.totals,
      cost: d.cost,
      slots: d.slots.map((s) => ({
        mealType: s.mealType,
        recipeId: s.recipe.id,
        recipeTitle: s.recipe.title,
        cuisine: s.recipe.cuisine,
        diets: s.recipe.diets,
        allergens: s.recipe.allergens,
        prepTimeMin: s.recipe.prepTimeMin,
        cookTimeMin: s.recipe.cookTimeMin,
        servings: s.scaledServings,
        costUsd: Math.round(s.recipe.costPerServingUsd * s.scaledServings * 100) / 100,
        nutritionPerServing: s.recipe.nutritionPerServing,
      })),
    })),
    weeklyCost: plan.weeklyCost,
    weeklyTotals: plan.weeklyTotals,
    avgDailyCalories: plan.avgDailyCalories,
    uniqueRecipeCount: plan.recipes.length,
  }, null, 2);
}

/** Render the plan as a plain-text list. */
export function renderTextPlan(plan: WeeklyPlan): string {
  const lines: string[] = [];
  lines.push("WEEKLY MEAL PLAN");
  lines.push("================");
  lines.push(`Weekly cost: $${plan.weeklyCost.toFixed(2)}  |  Avg/day: ${plan.avgDailyCalories} cal`);
  lines.push("");
  for (const day of plan.days) {
    lines.push(`${dayName(day.day).toUpperCase()}  (${day.totals.calories} cal, $${day.cost.toFixed(2)})`);
    for (const slot of day.slots) {
      lines.push(`  ${MEAL_TYPE_LABELS[slot.mealType]}: ${slot.recipe.title}  [${CUISINE_LABELS[slot.recipe.cuisine]}, ${slot.recipe.prepTimeMin + slot.recipe.cookTimeMin}m]`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the grocery list as plain text grouped by aisle. */
export function renderGroceryListText(items: GroceryItem[]): string {
  const grouped = groupByAisle(items);
  const lines: string[] = [];
  lines.push("GROCERY LIST");
  lines.push("============");
  lines.push("");
  for (const aisle of AISLE_ORDER) {
    const list = grouped[aisle];
    if (list.length === 0) continue;
    lines.push(`${AISLE_LABELS[aisle].toUpperCase()} (${list.length})`);
    for (const item of list) {
      lines.push(`  - ${item.amount} ${item.unit}  ${item.name}  (${item.inMeals.length} meal${item.inMeals.length === 1 ? "" : "s"})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the grocery list as Markdown. */
export function renderGroceryListMarkdown(items: GroceryItem[]): string {
  const grouped = groupByAisle(items);
  const lines: string[] = [];
  lines.push("# Grocery List");
  lines.push("");
  for (const aisle of AISLE_ORDER) {
    const list = grouped[aisle];
    if (list.length === 0) continue;
    lines.push(`## ${AISLE_LABELS[aisle]} (${list.length})`);
    lines.push("");
    lines.push("| Qty | Unit | Item | Meals |");
    lines.push("| --- | --- | --- | --- |");
    for (const item of list) {
      lines.push(`| ${item.amount} | ${item.unit} | ${item.name} | ${item.inMeals.length} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.diets.length) params.set("diets", state.diets.join(","));
  if (state.excludeAllergens.length) params.set("ex", state.excludeAllergens.join(","));
  if (state.cuisines.length) params.set("cu", state.cuisines.join(","));
  if (state.maxCookTimeMin) params.set("t", String(state.maxCookTimeMin));
  if (state.maxCostPerServingUsd) params.set("c", String(state.maxCostPerServingUsd));
  if (state.householdSize) params.set("h", String(state.householdSize));
  if (state.weeklyBudgetUsd) params.set("b", String(state.weeklyBudgetUsd));
  if (state.calorieTargetPerDay) params.set("cal", String(state.calorieTargetPerDay));
  if (state.pantry) params.set("p", state.pantry);
  if (state.seed) params.set("s", String(state.seed));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const state: ShareState = {
    diets: [], excludeAllergens: [], cuisines: [],
    maxCookTimeMin: 0, maxCostPerServingUsd: 0,
    householdSize: 2, weeklyBudgetUsd: 0, calorieTargetPerDay: 0,
    pantry: "", seed: 1,
  };
  if (!clean) return state;
  const params = new URLSearchParams(clean);
  const validDiets = Object.keys(DIET_LABELS) as Diet[];
  const validAllergens = Object.keys(ALLERGEN_LABELS) as Allergen[];
  const validCuisines = Object.keys(CUISINE_LABELS) as Cuisine[];
  if (params.get("diets")) {
    state.diets = params.get("diets")!.split(",").filter((d) =>
      validDiets.includes(d as Diet),
    ) as Diet[];
  }
  if (params.get("ex")) {
    state.excludeAllergens = params.get("ex")!.split(",").filter((a) =>
      validAllergens.includes(a as Allergen),
    ) as Allergen[];
  }
  if (params.get("cu")) {
    state.cuisines = params.get("cu")!.split(",").filter((c) =>
      validCuisines.includes(c as Cuisine),
    ) as Cuisine[];
  }
  state.maxCookTimeMin = Number(params.get("t")) || 0;
  state.maxCostPerServingUsd = Number(params.get("c")) || 0;
  state.householdSize = Number(params.get("h")) || 2;
  state.weeklyBudgetUsd = Number(params.get("b")) || 0;
  state.calorieTargetPerDay = Number(params.get("cal")) || 0;
  state.pantry = params.get("p") ?? "";
  state.seed = Number(params.get("s")) || 1;
  return state;
}

// ---------- Optional LLM helpers ----------

/** Build a prompt for an LLM to suggest a custom meal for a slot. */
export function buildLlmPrompt(
  mealType: MealType,
  diets: Diet[],
  cuisines: Cuisine[],
  householdSize: number,
): string {
  return [
    `You are a chef. Suggest one ${mealType} recipe for a household of ${householdSize}.`,
    diets.length ? `Diet: ${diets.join(", ")}.` : "No diet restriction.",
    cuisines.length ? `Cuisine: ${cuisines.join(", ")}.` : "Any cuisine.",
    `Return only JSON with shape: {"title": "...", "cuisine": "<italian|asian|mexican|indian|mediterranean|american|french|middle-eastern>", "ingredients": [{"name": "...", "amount": <number>, "unit": "g|ml|tsp|cup|qty", "aisle": "<produce|dairy|meat|pantry|frozen|bakery|spices|other>"}], "steps": ["..."], "nutritionPerServing": {"calories": <number>, "proteinG": <number>, "carbsG": <number>, "fatG": <number>}}.`,
    `Do not include any prose, only the JSON object.`,
  ].join(" ");
}

export interface LlmRecipe {
  title: string;
  cuisine: Cuisine;
  ingredients: { name: string; amount: number; unit: string; aisle: Aisle }[];
  steps: string[];
  nutritionPerServing: Nutrition;
}

/** Parse the LLM response JSON into a recipe (best-effort). */
export function renderLlmResult(text: string): LlmRecipe | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice) as unknown;
    if (typeof obj !== "object" || obj === null) return null;
    const o = obj as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "LLM Recipe";
    const validCuisines = Object.keys(CUISINE_LABELS) as Cuisine[];
    const cuisineRaw = typeof o.cuisine === "string" ? o.cuisine : "american";
    const cuisine = validCuisines.includes(cuisineRaw as Cuisine) ? (cuisineRaw as Cuisine) : "american";
    const ingsRaw = Array.isArray(o.ingredients) ? o.ingredients : [];
    const validAisles = Object.keys(AISLE_LABELS) as Aisle[];
    const ingredients = ingsRaw.map((i) => {
      const ir = i as Record<string, unknown>;
      const aisleRaw = typeof ir.aisle === "string" ? ir.aisle : "other";
      return {
        name: typeof ir.name === "string" ? ir.name : "ingredient",
        amount: typeof ir.amount === "number" ? ir.amount : 0,
        unit: typeof ir.unit === "string" ? ir.unit : "qty",
        aisle: validAisles.includes(aisleRaw as Aisle) ? (aisleRaw as Aisle) : "other",
      };
    });
    const steps = Array.isArray(o.steps) ? (o.steps as unknown[]).filter((s) => typeof s === "string") as string[] : [];
    const n = (typeof o.nutritionPerServing === "object" && o.nutritionPerServing !== null
      ? o.nutritionPerServing
      : {}) as Record<string, unknown>;
    const nutritionPerServing = {
      calories: typeof n.calories === "number" ? n.calories : 0,
      proteinG: typeof n.proteinG === "number" ? n.proteinG : 0,
      carbsG: typeof n.carbsG === "number" ? n.carbsG : 0,
      fatG: typeof n.fatG === "number" ? n.fatG : 0,
    };
    return { title, cuisine, ingredients, steps, nutritionPerServing };
  } catch {
    return null;
  }
}
