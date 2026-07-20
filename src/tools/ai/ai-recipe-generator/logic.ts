/**
 * AI Recipe Generator — pure logic.
 *
 * Built-in 50+ recipe database with deterministic ingredient matching,
 * diet/allergy/cuisine/time filters, recipe variation generator, live portion
 * scaler, metric↔imperial unit converter, nutrition estimate, shopping-list
 * builder, history (localStorage), shareable URL.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Cuisine =
  | "italian"
  | "asian"
  | "mexican"
  | "indian"
  | "mediterranean"
  | "american"
  | "french"
  | "middle-eastern";

export type Diet =
  | "vegan"
  | "vegetarian"
  | "gluten-free"
  | "keto"
  | "halal"
  | "dairy-free"
  | "nut-free";

export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "eggs"
  | "soy"
  | "shellfish"
  | "fish";

export type Difficulty = "easy" | "medium" | "hard";

export type UnitSystem = "metric" | "imperial";

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;          // metric unit (g, ml, tsp, cup, qty)
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
  cuisine: Cuisine;
  diets: Diet[];
  allergens: Allergen[];
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: string[];
  nutritionPerServing: Nutrition;
}

export interface MatchedRecipe {
  recipe: Recipe;
  matched: string[];       // ingredients the user has
  missing: string[];       // ingredients the user is missing
  matchScore: number;      // 0-1 (matched / total)
}

export interface RecipeVariation {
  kind: "protein-swap" | "vegetable-swap" | "spice-swap";
  title: string;
  description: string;
  changes: string[];
  diets: Diet[];
  allergens: Allergen[];
}

export interface FilterOptions {
  diets: Diet[];              // recipes must include ALL these
  excludeAllergens: Allergen[]; // recipes must NOT include any of these
  cuisines: Cuisine[];
  maxCookTimeMin: number;     // 0 = no limit
  servings: number;           // 0 = no constraint
}

export interface HistoryEntry {
  ts: number;
  ingredientCount: number;
  matchCount: number;
  topRecipe: string;
  topScore: number;
}

export interface ShareState {
  ingredients: string;
  diets: Diet[];
  excludeAllergens: Allergen[];
  cuisines: Cuisine[];
  maxCookTimeMin: number;
  servings: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-recipe-generator:history";
export const HISTORY_MAX = 20;

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

export const DIET_LABELS: Record<Diet, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  "gluten-free": "Gluten-Free",
  keto: "Keto",
  halal: "Halal",
  "dairy-free": "Dairy-Free",
  "nut-free": "Nut-Free",
};

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Dairy",
  nuts: "Nuts",
  eggs: "Eggs",
  soy: "Soy",
  shellfish: "Shellfish",
  fish: "Fish",
};

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
  servings: 0,
};

// Substitution tables for variation generator
const PROTEIN_SWAPS: Record<string, string> = {
  chicken: "tofu",
  beef: "lentils",
  pork: "mushrooms",
  tofu: "chicken",
  shrimp: "chickpeas",
  salmon: "white beans",
  lentils: "ground beef",
  chickpeas: "shrimp",
};

const VEG_SWAPS: Record<string, string> = {
  broccoli: "green beans",
  spinach: "kale",
  carrot: "sweet potato",
  potato: "cauliflower",
  pepper: "zucchini",
  onion: "shallot",
  tomato: "sun-dried tomato",
  mushroom: "eggplant",
};

const SPICE_SWAPS: Record<string, string> = {
  "black pepper": "white pepper",
  cumin: "coriander",
  paprika: "smoked paprika",
  basil: "oregano",
  oregano: "thyme",
  cilantro: "parsley",
  ginger: "galangal",
  chili: "chili flakes",
};

// ---------- Recipe database (55 recipes) ----------

function r(
  id: string,
  title: string,
  cuisine: Cuisine,
  diets: Diet[],
  allergens: Allergen[],
  servings: number,
  prepTimeMin: number,
  cookTimeMin: number,
  difficulty: Difficulty,
  ingredients: [string, number, string][],
  steps: string[],
  nutrition: Nutrition,
): Recipe {
  return {
    id, title, cuisine, diets, allergens, servings, prepTimeMin, cookTimeMin, difficulty,
    ingredients: ingredients.map(([name, amount, unit]) => ({ name, amount, unit })),
    steps,
    nutritionPerServing: nutrition,
  };
}

export const RECIPES: Recipe[] = [
  // Italian (8)
  r("spaghetti-tomato", "Spaghetti with Tomato Sauce", "italian",
    ["vegetarian"], ["gluten"], 4, 10, 20, "easy",
    [["spaghetti", 400, "g"], ["tomato", 400, "g"], ["onion", 1, "qty"], ["garlic", 2, "qty"], ["olive oil", 2, "tbsp"], ["basil", 4, "qty"]],
    ["Boil pasta in salted water.", "Sauté onion and garlic in olive oil.", "Add tomatoes, simmer 15 min.", "Toss pasta with sauce, top with basil."],
    { calories: 480, proteinG: 14, carbsG: 78, fatG: 12 }),
  r("margherita-pizza", "Margherita Pizza", "italian",
    ["vegetarian"], ["gluten", "dairy"], 2, 20, 15, "medium",
    [["pizza dough", 250, "g"], ["tomato", 100, "g"], ["mozzarella", 125, "g"], ["basil", 6, "qty"], ["olive oil", 1, "tbsp"]],
    ["Stretch dough thin.", "Spread tomato, add mozzarella.", "Bake at 250°C for 10 min.", "Top with basil and olive oil."],
    { calories: 620, proteinG: 24, carbsG: 70, fatG: 26 }),
  r("pesto-pasta", "Pesto Pasta", "italian",
    ["vegetarian"], ["gluten", "dairy", "nuts"], 4, 5, 15, "easy",
    [["pasta", 400, "g"], ["basil", 50, "g"], ["pine nuts", 30, "g"], ["parmesan", 50, "g"], ["olive oil", 80, "ml"], ["garlic", 1, "qty"]],
    ["Boil pasta.", "Blend basil, nuts, garlic, parmesan, oil.", "Toss pasta with pesto."],
    { calories: 540, proteinG: 16, carbsG: 70, fatG: 22 }),
  r("risotto-mushroom", "Mushroom Risotto", "italian",
    ["vegetarian", "gluten-free"], ["dairy"], 4, 10, 30, "medium",
    [["rice", 320, "g"], ["mushroom", 300, "g"], ["onion", 1, "qty"], ["parmesan", 60, "g"], ["broth", 1, "l"], ["butter", 40, "g"]],
    ["Sauté onion and mushroom.", "Add rice, toast 2 min.", "Ladle broth gradually, stir 20 min.", "Finish with butter and parmesan."],
    { calories: 470, proteinG: 12, carbsG: 68, fatG: 16 }),
  r("caprese-salad", "Caprese Salad", "italian",
    ["vegetarian", "gluten-free", "keto", "nut-free"], ["dairy"], 2, 5, 0, "easy",
    [["tomato", 2, "qty"], ["mozzarella", 125, "g"], ["basil", 8, "qty"], ["olive oil", 2, "tbsp"]],
    ["Slice tomato and mozzarella.", "Alternate on plate with basil.", "Drizzle olive oil."],
    { calories: 280, proteinG: 16, carbsG: 8, fatG: 22 }),
  r("lasagna", "Classic Lasagna", "italian",
    ["vegetarian"], ["gluten", "dairy", "eggs"], 6, 25, 45, "hard",
    [["pasta", 300, "g"], ["beef", 400, "g"], ["tomato", 500, "g"], ["onion", 1, "qty"], ["parmesan", 80, "g"], ["bechamel", 500, "ml"]],
    ["Brown beef with onion.", "Add tomato, simmer 20 min.", "Layer pasta, sauce, bechamel, cheese.", "Bake 35 min at 180°C."],
    { calories: 610, proteinG: 32, carbsG: 52, fatG: 30 }),
  r("bruschetta", "Tomato Bruschetta", "italian",
    ["vegan"], ["gluten"], 4, 10, 5, "easy",
    [["bread", 4, "qty"], ["tomato", 4, "qty"], ["garlic", 1, "qty"], ["basil", 8, "qty"], ["olive oil", 2, "tbsp"]],
    ["Toast bread slices.", "Rub with garlic.", "Top with diced tomato, basil, oil."],
    { calories: 180, proteinG: 5, carbsG: 30, fatG: 5 }),
  r("fettuccine-alfredo", "Fettuccine Alfredo", "italian",
    ["vegetarian"], ["gluten", "dairy"], 4, 5, 20, "easy",
    [["pasta", 400, "g"], ["butter", 80, "g"], ["parmesan", 100, "g"], ["cream", 200, "ml"], ["black pepper", 1, "tsp"]],
    ["Boil pasta.", "Melt butter, add cream.", "Stir in parmesan until smooth.", "Toss pasta, top with pepper."],
    { calories: 620, proteinG: 20, carbsG: 70, fatG: 28 }),

  // Asian (8)
  r("fried-rice", "Veg Fried Rice", "asian",
    ["vegan", "dairy-free", "nut-free"], ["soy", "eggs"], 4, 10, 15, "easy",
    [["rice", 400, "g"], ["egg", 2, "qty"], ["carrot", 1, "qty"], ["onion", 1, "qty"], ["soy sauce", 3, "tbsp"], ["garlic", 2, "qty"]],
    ["Sauté garlic, onion, carrot.", "Push aside, scramble eggs.", "Add rice, soy sauce, toss."],
    { calories: 420, proteinG: 12, carbsG: 70, fatG: 10 }),
  r("pad-thai", "Pad Thai", "asian",
    ["dairy-free", "nut-free"], ["gluten", "eggs", "soy", "fish"], 2, 15, 20, "medium",
    [["rice noodles", 200, "g"], ["shrimp", 200, "g"], ["egg", 2, "qty"], ["bean sprouts", 100, "g"], ["peanut", 30, "g"], ["tamarind", 2, "tbsp"]],
    ["Soak noodles.", "Stir-fry shrimp, push aside, scramble egg.", "Add noodles, tamarind, sprouts.", "Top with peanuts."],
    { calories: 520, proteinG: 26, carbsG: 64, fatG: 18 }),
  r("miso-soup", "Miso Soup", "asian",
    ["vegan", "dairy-free", "nut-free"], ["soy"], 4, 5, 10, "easy",
    [["tofu", 200, "g"], ["seaweed", 10, "g"], ["miso paste", 3, "tbsp"], ["onion", 1, "qty"], ["water", 1, "l"]],
    ["Heat water, add seaweed and tofu.", "Dissolve miso paste off heat.", "Top with sliced onion."],
    { calories: 120, proteinG: 10, carbsG: 8, fatG: 5 }),
  r("chicken-stir-fry", "Chicken Stir-Fry", "asian",
    ["dairy-free", "nut-free"], ["soy"], 4, 15, 15, "easy",
    [["chicken", 400, "g"], ["broccoli", 300, "g"], ["pepper", 1, "qty"], ["soy sauce", 3, "tbsp"], ["garlic", 2, "qty"], ["ginger", 1, "tbsp"]],
    ["Slice chicken.", "Stir-fry chicken until golden.", "Add vegetables, garlic, ginger.", "Add soy sauce, toss."],
    { calories: 320, proteinG: 36, carbsG: 12, fatG: 14 }),
  r("veggie-dumplings", "Veggie Dumplings", "asian",
    ["vegan", "dairy-free", "nut-free"], ["gluten", "soy"], 4, 30, 10, "medium",
    [["dumpling wrapper", 30, "qty"], ["cabbage", 200, "g"], ["mushroom", 100, "g"], ["ginger", 1, "tbsp"], ["soy sauce", 2, "tbsp"]],
    ["Mix filling.", "Wrap dumplings.", "Steam or pan-fry 8 min."],
    { calories: 280, proteinG: 10, carbsG: 44, fatG: 6 }),
  r("beef-noodle-soup", "Beef Noodle Soup", "asian",
    ["dairy-free", "nut-free"], ["gluten", "soy"], 4, 20, 60, "hard",
    [["beef", 500, "g"], ["noodles", 300, "g"], ["ginger", 1, "tbsp"], ["soy sauce", 4, "tbsp"], ["onion", 1, "qty"], ["broth", 2, "l"]],
    ["Sear beef, add broth, ginger, onion.", "Simmer 60 min until tender.", "Cook noodles separately.", "Serve beef and broth over noodles."],
    { calories: 540, proteinG: 38, carbsG: 56, fatG: 16 }),
  r("spring-rolls", "Veg Spring Rolls", "asian",
    ["vegan", "dairy-free", "nut-free"], ["gluten", "soy"], 4, 20, 10, "medium",
    [["spring roll wrapper", 12, "qty"], ["cabbage", 200, "g"], ["carrot", 1, "qty"], ["mushroom", 100, "g"], ["soy sauce", 2, "tbsp"]],
    ["Mix filling.", "Roll in wrappers.", "Deep-fry until golden, 5 min."],
    { calories: 240, proteinG: 8, carbsG: 36, fatG: 8 }),
  r("tofu-curry", "Tofu Green Curry", "asian",
    ["vegan", "dairy-free", "nut-free"], ["soy"], 4, 15, 20, "medium",
    [["tofu", 300, "g"], ["coconut milk", 400, "ml"], ["green curry paste", 3, "tbsp"], ["eggplant", 200, "g"], ["basil", 10, "qty"]],
    ["Sauté curry paste in coconut milk.", "Add eggplant, simmer 10 min.", "Add tofu, simmer 5 min.", "Top with basil."],
    { calories: 380, proteinG: 16, carbsG: 14, fatG: 30 }),

  // Mexican (7)
  r("guacamole", "Guacamole", "mexican",
    ["vegan", "gluten-free", "dairy-free", "nut-free", "keto"], [], 4, 10, 0, "easy",
    [["avocado", 3, "qty"], ["onion", 1, "qty"], ["tomato", 1, "qty"], ["lime", 1, "qty"], ["cilantro", 5, "qty"]],
    ["Mash avocado.", "Mix in diced onion, tomato, lime, cilantro."],
    { calories: 220, proteinG: 4, carbsG: 12, fatG: 20 }),
  r("tacos-al-pastor", "Tacos al Pastor", "mexican",
    ["dairy-free", "nut-free"], ["gluten"], 4, 30, 30, "medium",
    [["pork", 500, "g"], ["tortilla", 12, "qty"], ["pineapple", 100, "g"], ["onion", 1, "qty"], ["cilantro", 10, "qty"], ["chili", 2, "qty"]],
    ["Marinate pork in chili and pineapple.", "Cook pork until charred.", "Serve on tortillas with onion, cilantro, pineapple."],
    { calories: 520, proteinG: 32, carbsG: 42, fatG: 22 }),
  r("bean-burrito", "Bean Burrito", "mexican",
    ["vegan", "dairy-free"], ["gluten"], 2, 10, 15, "easy",
    [["tortilla", 2, "qty"], ["beans", 200, "g"], ["rice", 150, "g"], ["avocado", 1, "qty"], ["salsa", 50, "g"]],
    ["Warm tortilla.", "Layer beans, rice, avocado, salsa.", "Roll and toast 2 min per side."],
    { calories: 580, proteinG: 18, carbsG: 88, fatG: 18 }),
  r("quesadilla", "Cheese Quesadilla", "mexican",
    ["vegetarian", "nut-free"], ["gluten", "dairy"], 2, 5, 10, "easy",
    [["tortilla", 2, "qty"], ["cheese", 150, "g"], ["onion", 1, "qty"], ["pepper", 1, "qty"]],
    ["Sprinkle cheese and veggies on tortilla.", "Fold, toast 3 min per side."],
    { calories: 420, proteinG: 20, carbsG: 38, fatG: 22 }),
  r("nachos", "Loaded Nachos", "mexican",
    ["vegetarian", "nut-free"], ["gluten", "dairy"], 4, 5, 10, "easy",
    [["tortilla chips", 200, "g"], ["cheese", 200, "g"], ["beans", 150, "g"], ["jalapeno", 30, "g"], ["salsa", 100, "g"]],
    ["Spread chips on tray.", "Top with cheese, beans, jalapenos.", "Bake 5 min at 180°C.", "Drizzle salsa."],
    { calories: 540, proteinG: 18, carbsG: 52, fatG: 30 }),
  r("ceviche", "Shrimp Ceviche", "mexican",
    ["gluten-free", "dairy-free", "nut-free", "keto"], ["shellfish"], 4, 20, 0, "medium",
    [["shrimp", 300, "g"], ["lime", 4, "qty"], ["onion", 1, "qty"], ["tomato", 1, "qty"], ["cilantro", 5, "qty"]],
    ["Cook shrimp, rinse cold.", "Marinate in lime juice 15 min.", "Mix with onion, tomato, cilantro."],
    { calories: 180, proteinG: 28, carbsG: 8, fatG: 4 }),
  r("fajitas", "Chicken Fajitas", "mexican",
    ["dairy-free", "nut-free"], ["gluten"], 4, 15, 20, "easy",
    [["chicken", 400, "g"], ["pepper", 3, "qty"], ["onion", 1, "qty"], ["tortilla", 8, "qty"], ["chili", 1, "tsp"]],
    ["Slice chicken, peppers, onions.", "Sear on high heat with chili.", "Serve with warm tortillas."],
    { calories: 480, proteinG: 34, carbsG: 48, fatG: 14 }),

  // Indian (7)
  r("chana-masala", "Chana Masala", "indian",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 10, 25, "easy",
    [["chickpeas", 400, "g"], ["tomato", 300, "g"], ["onion", 1, "qty"], ["garlic", 3, "qty"], ["ginger", 1, "tbsp"], ["cumin", 1, "tsp"]],
    ["Sauté onion, garlic, ginger.", "Add tomato, cumin, simmer 10 min.", "Add chickpeas, simmer 15 min."],
    { calories: 320, proteinG: 16, carbsG: 48, fatG: 6 }),
  r("dal", "Lentil Dal", "indian",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 5, 30, "easy",
    [["lentils", 250, "g"], ["onion", 1, "qty"], ["tomato", 1, "qty"], ["garlic", 3, "qty"], ["turmeric", 1, "tsp"], ["cumin", 1, "tsp"]],
    ["Boil lentils 25 min.", "Sauté onion, garlic, tomato with spices.", "Combine, simmer 5 min."],
    { calories: 280, proteinG: 18, carbsG: 44, fatG: 4 }),
  r("butter-chicken", "Butter Chicken", "indian",
    ["gluten-free", "nut-free", "halal"], ["dairy"], 4, 20, 30, "medium",
    [["chicken", 500, "g"], ["tomato", 400, "g"], ["cream", 100, "ml"], ["butter", 40, "g"], ["garlic", 3, "qty"], ["ginger", 1, "tbsp"], ["garam masala", 1, "tsp"]],
    ["Brown chicken.", "Simmer tomato, garlic, ginger, spices 10 min.", "Add cream and butter, simmer 10 min.", "Add chicken, cook through."],
    { calories: 520, proteinG: 36, carbsG: 12, fatG: 36 }),
  r("paneer-tikka", "Paneer Tikka", "indian",
    ["vegetarian", "gluten-free", "nut-free"], ["dairy"], 4, 30, 15, "medium",
    [["paneer", 300, "g"], ["pepper", 2, "qty"], ["onion", 1, "qty"], ["yogurt", 100, "g"], ["garam masala", 1, "tsp"], ["ginger", 1, "tbsp"]],
    ["Marinate paneer and veg in yogurt-spice mix 20 min.", "Skewer, grill 12 min, turning."],
    { calories: 380, proteinG: 20, carbsG: 12, fatG: 28 }),
  r("aloo-gobi", "Aloo Gobi", "indian",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 10, 25, "easy",
    [["potato", 400, "g"], ["cauliflower", 400, "g"], ["onion", 1, "qty"], ["turmeric", 1, "tsp"], ["cumin", 1, "tsp"], ["garlic", 2, "qty"]],
    ["Sauté onion, garlic, spices.", "Add potato, cook 10 min.", "Add cauliflower, cook 15 min."],
    { calories: 260, proteinG: 8, carbsG: 44, fatG: 6 }),
  r("samosas", "Potato Pea Samosas", "indian",
    ["vegan", "dairy-free", "nut-free"], ["gluten"], 6, 30, 20, "hard",
    [["pastry", 300, "g"], ["potato", 300, "g"], ["peas", 100, "g"], ["cumin", 1, "tsp"], ["chili", 1, "tsp"]],
    ["Boil and mash potato with peas and spices.", "Fold into pastry triangles.", "Deep-fry 6 min until golden."],
    { calories: 280, proteinG: 6, carbsG: 42, fatG: 10 }),
  r("biryani", "Chicken Biryani", "indian",
    ["halal", "nut-free"], ["gluten", "dairy"], 6, 30, 45, "hard",
    [["rice", 500, "g"], ["chicken", 500, "g"], ["onion", 2, "qty"], ["yogurt", 100, "g"], ["biryani spice", 3, "tbsp"], ["saffron", 1, "tsp"]],
    ["Marinate chicken in yogurt and spice 30 min.", "Layer rice and chicken.", "Steam 30 min on low heat."],
    { calories: 580, proteinG: 32, carbsG: 72, fatG: 16 }),

  // Mediterranean (7)
  r("greek-salad", "Greek Salad", "mediterranean",
    ["vegetarian", "gluten-free", "nut-free", "keto"], ["dairy"], 4, 15, 0, "easy",
    [["tomato", 3, "qty"], ["cucumber", 1, "qty"], ["feta", 150, "g"], ["olive", 80, "g"], ["onion", 1, "qty"], ["olive oil", 2, "tbsp"]],
    ["Chop vegetables.", "Top with feta and olives.", "Drizzle olive oil."],
    { calories: 280, proteinG: 11, carbsG: 14, fatG: 22 }),
  r("hummus", "Hummus", "mediterranean",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 10, 0, "easy",
    [["chickpeas", 400, "g"], ["tahini", 3, "tbsp"], ["lemon", 1, "qty"], ["garlic", 2, "qty"], ["olive oil", 3, "tbsp"]],
    ["Blend chickpeas, tahini, lemon, garlic.", "Stream in olive oil."],
    { calories: 280, proteinG: 12, carbsG: 30, fatG: 14 }),
  r("falafel", "Falafel", "middle-eastern",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 20, 15, "medium",
    [["chickpeas", 250, "g"], ["onion", 1, "qty"], ["garlic", 3, "qty"], ["cumin", 1, "tsp"], ["coriander", 1, "tsp"]],
    ["Soak chickpeas overnight.", "Blend with onion, garlic, spices.", "Form balls, deep-fry 6 min."],
    { calories: 320, proteinG: 14, carbsG: 42, fatG: 10 }),
  r("shakshuka", "Shakshuka", "mediterranean",
    ["vegetarian", "gluten-free", "dairy-free", "nut-free"], ["eggs"], 4, 10, 20, "easy",
    [["tomato", 500, "g"], ["egg", 4, "qty"], ["onion", 1, "qty"], ["pepper", 1, "qty"], ["garlic", 2, "qty"], ["cumin", 1, "tsp"]],
    ["Sauté onion, pepper, garlic.", "Add tomato and cumin, simmer 10 min.", "Crack eggs on top, cover 8 min."],
    { calories: 280, proteinG: 14, carbsG: 18, fatG: 16 }),
  r("tabbouleh", "Tabbouleh", "middle-eastern",
    ["vegan", "dairy-free", "nut-free"], ["gluten"], 4, 15, 0, "easy",
    [["bulgur", 100, "g"], ["parsley", 50, "g"], ["tomato", 2, "qty"], ["onion", 1, "qty"], ["lemon", 1, "qty"], ["olive oil", 2, "tbsp"]],
    ["Soak bulgur 20 min.", "Chop parsley, tomato, onion.", "Mix with bulgur, lemon, oil."],
    { calories: 180, proteinG: 5, carbsG: 30, fatG: 6 }),
  r("moussaka", "Moussaka", "mediterranean",
    ["vegetarian", "nut-free"], ["gluten", "dairy", "eggs"], 6, 30, 60, "hard",
    [["eggplant", 500, "g"], ["beef", 400, "g"], ["tomato", 400, "g"], ["onion", 1, "qty"], ["bechamel", 500, "ml"], ["cinnamon", 1, "tsp"]],
    ["Slice and roast eggplant.", "Cook beef with tomato, onion, cinnamon.", "Layer eggplant and beef, top with bechamel.", "Bake 40 min at 180°C."],
    { calories: 520, proteinG: 28, carbsG: 22, fatG: 36 }),
  r("tzatziki", "Tzatziki", "mediterranean",
    ["vegetarian", "gluten-free", "nut-free", "keto"], ["dairy"], 4, 10, 0, "easy",
    [["yogurt", 300, "g"], ["cucumber", 1, "qty"], ["garlic", 2, "qty"], ["lemon", 1, "qty"], ["olive oil", 1, "tbsp"]],
    ["Grate cucumber, squeeze dry.", "Mix with yogurt, garlic, lemon.", "Drizzle olive oil."],
    { calories: 120, proteinG: 8, carbsG: 8, fatG: 6 }),

  // American (7)
  r("burger", "Classic Beef Burger", "american",
    ["dairy-free", "nut-free"], ["gluten"], 4, 10, 15, "easy",
    [["beef", 500, "g"], ["bun", 4, "qty"], ["onion", 1, "qty"], ["tomato", 1, "qty"], ["lettuce", 4, "qty"]],
    ["Form beef into 4 patties.", "Grill 4 min per side.", "Toast buns, assemble with onion, tomato, lettuce."],
    { calories: 560, proteinG: 34, carbsG: 38, fatG: 28 }),
  r("mac-and-cheese", "Mac and Cheese", "american",
    ["vegetarian", "nut-free"], ["gluten", "dairy"], 4, 10, 20, "easy",
    [["pasta", 400, "g"], ["cheese", 200, "g"], ["milk", 400, "ml"], ["butter", 40, "g"], ["flour", 30, "g"]],
    ["Boil pasta.", "Make roux with butter and flour, add milk.", "Melt cheese into sauce.", "Toss with pasta."],
    { calories: 580, proteinG: 26, carbsG: 62, fatG: 24 }),
  r("pancakes", "Fluffy Pancakes", "american",
    ["vegetarian", "nut-free", "halal"], ["gluten", "dairy", "eggs"], 4, 10, 15, "easy",
    [["flour", 250, "g"], ["milk", 300, "ml"], ["egg", 2, "qty"], ["sugar", 30, "g"], ["baking powder", 2, "tsp"]],
    ["Whisk dry and wet separately.", "Combine, rest 5 min.", "Cook pancakes 2 min per side."],
    { calories: 320, proteinG: 11, carbsG: 56, fatG: 6 }),
  r("bbq-ribs", "BBQ Ribs", "american",
    ["dairy-free", "nut-free", "halal"], ["gluten"], 4, 10, 180, "medium",
    [["pork", 1, "kg"], ["bbq sauce", 200, "ml"], ["brown sugar", 50, "g"], ["paprika", 2, "tsp"], ["garlic", 3, "qty"]],
    ["Rub ribs with sugar, paprika, garlic.", "Smoke or bake 150°C for 2.5 hours.", "Brush with BBQ sauce, grill 5 min."],
    { calories: 620, proteinG: 38, carbsG: 28, fatG: 38 }),
  r("caesar-salad", "Caesar Salad", "american",
    ["vegetarian", "nut-free"], ["gluten", "dairy", "eggs", "fish"], 2, 15, 0, "easy",
    [["lettuce", 1, "qty"], ["parmesan", 60, "g"], ["bread", 100, "g"], ["anchovy", 30, "g"], ["egg", 1, "qty"], ["lemon", 1, "qty"]],
    ["Toast bread cubes.", "Whisk egg, lemon, anchovy for dressing.", "Toss lettuce with dressing, top with croutons, parmesan."],
    { calories: 320, proteinG: 14, carbsG: 26, fatG: 18 }),
  r("chili", "Beef Chili", "american",
    ["dairy-free", "nut-free", "gluten-free", "halal"], [], 6, 15, 60, "easy",
    [["beef", 500, "g"], ["beans", 400, "g"], ["tomato", 400, "g"], ["onion", 1, "qty"], ["chili", 2, "qty"], ["cumin", 1, "tbsp"]],
    ["Brown beef with onion.", "Add beans, tomato, chili, cumin.", "Simmer 45 min."],
    { calories: 420, proteinG: 32, carbsG: 32, fatG: 16 }),
  r("clam-chowder", "Clam Chowder", "american",
    ["dairy-free", "nut-free"], ["gluten", "dairy", "shellfish"], 4, 15, 30, "medium",
    [["clam", 300, "g"], ["potato", 300, "g"], ["onion", 1, "qty"], ["cream", 200, "ml"], ["flour", 30, "g"], ["butter", 40, "g"]],
    ["Sauté onion in butter.", "Add flour, then cream.", "Add potato, clam, simmer 25 min."],
    { calories: 380, proteinG: 18, carbsG: 32, fatG: 20 }),

  // French (6)
  r("crepes", "French Crêpes", "french",
    ["vegetarian", "nut-free", "halal"], ["gluten", "dairy", "eggs"], 4, 10, 15, "easy",
    [["flour", 200, "g"], ["milk", 400, "ml"], ["egg", 3, "qty"], ["butter", 30, "g"], ["sugar", 20, "g"]],
    ["Whisk flour, milk, eggs, sugar.", "Rest 15 min.", "Cook thin crêpes 1 min per side."],
    { calories: 260, proteinG: 10, carbsG: 40, fatG: 6 }),
  r("ratatouille", "Ratatouille", "french",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 6, 20, 60, "medium",
    [["eggplant", 1, "qty"], ["zucchini", 2, "qty"], ["pepper", 2, "qty"], ["tomato", 4, "qty"], ["onion", 1, "qty"], ["garlic", 3, "qty"]],
    ["Slice vegetables thin.", "Sauté onion and garlic.", "Layer vegetables in sauce.", "Bake 50 min at 180°C."],
    { calories: 180, proteinG: 5, carbsG: 32, fatG: 4 }),
  r("quiche-lorraine", "Quiche Lorraine", "french",
    ["vegetarian", "nut-free"], ["gluten", "dairy", "eggs"], 6, 20, 40, "medium",
    [["pastry", 250, "g"], ["bacon", 150, "g"], ["egg", 4, "qty"], ["cream", 200, "ml"], ["onion", 1, "qty"]],
    ["Line tart tin with pastry.", "Cook bacon and onion.", "Whisk eggs and cream, add bacon.", "Bake 35 min at 180°C."],
    { calories: 380, proteinG: 16, carbsG: 26, fatG: 24 }),
  r("french-onion", "French Onion Soup", "french",
    ["vegetarian", "nut-free"], ["gluten", "dairy"], 4, 10, 45, "medium",
    [["onion", 4, "qty"], ["broth", 1, "l"], ["bread", 4, "qty"], ["gruyere", 100, "g"], ["butter", 30, "g"]],
    ["Caramelize onion in butter 30 min.", "Add broth, simmer 10 min.", "Top with bread and gruyere, broil 3 min."],
    { calories: 280, proteinG: 12, carbsG: 28, fatG: 14 }),
  r("salad-nicoise", "Salade Niçoise", "french",
    ["gluten-free", "nut-free", "keto", "halal"], ["fish", "eggs"], 2, 20, 15, "easy",
    [["tuna", 200, "g"], ["green beans", 150, "g"], ["potato", 2, "qty"], ["egg", 2, "qty"], ["tomato", 2, "qty"], ["olive oil", 2, "tbsp"]],
    ["Boil potato, beans, egg separately.", "Arrange on plate with tuna and tomato.", "Drizzle olive oil."],
    { calories: 420, proteinG: 28, carbsG: 28, fatG: 22 }),
  r("creme-brulee", "Crème Brûlée", "french",
    ["vegetarian", "nut-free", "halal", "gluten-free"], ["dairy", "eggs"], 4, 15, 40, "medium",
    [["cream", 500, "ml"], ["egg", 5, "qty"], ["sugar", 100, "g"], ["vanilla", 1, "tsp"]],
    ["Heat cream with vanilla.", "Whisk egg yolks with sugar, temper with cream.", "Bake in water bath 35 min at 150°C.", "Chill, caramelize sugar on top."],
    { calories: 420, proteinG: 6, carbsG: 36, fatG: 28 }),

  // More / mixed (12) to push the total to 55
  r("veggie-omelette", "Veggie Omelette", "american",
    ["vegetarian", "gluten-free", "nut-free", "keto", "halal"], ["eggs", "dairy"], 1, 5, 10, "easy",
    [["egg", 3, "qty"], ["pepper", 1, "qty"], ["onion", 1, "qty"], ["cheese", 30, "g"], ["butter", 10, "g"]],
    ["Whisk eggs.", "Sauté pepper and onion.", "Add eggs, cook 3 min, add cheese, fold."],
    { calories: 380, proteinG: 26, carbsG: 8, fatG: 28 }),
  r("avocado-toast", "Avocado Toast", "american",
    ["vegan", "dairy-free", "nut-free", "vegetarian"], ["gluten"], 1, 5, 5, "easy",
    [["bread", 2, "qty"], ["avocado", 1, "qty"], ["lemon", 1, "qty"], ["chili", 1, "tsp"]],
    ["Toast bread.", "Mash avocado with lemon and chili.", "Spread on toast."],
    { calories: 320, proteinG: 8, carbsG: 36, fatG: 18 }),
  r("smoothie-bowl", "Berry Smoothie Bowl", "american",
    ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free"], [], 1, 5, 0, "easy",
    [["banana", 1, "qty"], ["berries", 150, "g"], ["oats", 30, "g"], ["chia", 10, "g"]],
    ["Blend banana and berries.", "Top with oats and chia."],
    { calories: 280, proteinG: 6, carbsG: 60, fatG: 4 }),
  r("greek-yogurt-parfait", "Greek Yogurt Parfait", "mediterranean",
    ["vegetarian", "gluten-free", "nut-free"], ["dairy"], 1, 5, 0, "easy",
    [["yogurt", 200, "g"], ["berries", 100, "g"], ["honey", 1, "tbsp"], ["oats", 30, "g"]],
    ["Layer yogurt, berries, oats.", "Drizzle honey."],
    { calories: 280, proteinG: 16, carbsG: 44, fatG: 4 }),
  r("veggie-pizza", "Veggie Pizza", "italian",
    ["vegetarian"], ["gluten", "dairy"], 4, 20, 15, "medium",
    [["pizza dough", 300, "g"], ["tomato", 100, "g"], ["pepper", 1, "qty"], ["mushroom", 100, "g"], ["onion", 1, "qty"], ["cheese", 150, "g"]],
    ["Stretch dough.", "Top with sauce, vegetables, cheese.", "Bake 12 min at 230°C."],
    { calories: 540, proteinG: 22, carbsG: 62, fatG: 22 }),
  r("lentil-soup", "Lentil Soup", "mediterranean",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 4, 10, 30, "easy",
    [["lentils", 200, "g"], ["carrot", 2, "qty"], ["onion", 1, "qty"], ["tomato", 1, "qty"], ["cumin", 1, "tsp"]],
    ["Sauté onion, carrot.", "Add lentils, tomato, water, cumin.", "Simmer 30 min."],
    { calories: 240, proteinG: 14, carbsG: 40, fatG: 2 }),
  r("pasta-carbonara", "Pasta Carbonara", "italian",
    ["nut-free", "halal"], ["gluten", "dairy", "eggs"], 4, 10, 20, "medium",
    [["pasta", 400, "g"], ["bacon", 200, "g"], ["egg", 4, "qty"], ["parmesan", 80, "g"], ["black pepper", 1, "tsp"]],
    ["Boil pasta.", "Fry bacon until crisp.", "Whisk eggs and parmesan.", "Toss pasta with bacon off heat, add egg mix, pepper."],
    { calories: 620, proteinG: 30, carbsG: 64, fatG: 26 }),
  r("egg-fried-rice", "Egg Fried Rice", "asian",
    ["vegetarian", "dairy-free", "nut-free"], ["gluten", "eggs", "soy"], 4, 5, 15, "easy",
    [["rice", 400, "g"], ["egg", 3, "qty"], ["onion", 1, "qty"], ["pea", 100, "g"], ["soy sauce", 3, "tbsp"]],
    ["Sauté onion and peas.", "Scramble eggs.", "Add rice, soy, toss."],
    { calories: 380, proteinG: 14, carbsG: 64, fatG: 8 }),
  r("shrimp-scampi", "Shrimp Scampi", "italian",
    ["nut-free", "halal"], ["gluten", "dairy", "shellfish"], 4, 5, 15, "easy",
    [["pasta", 400, "g"], ["shrimp", 300, "g"], ["garlic", 4, "qty"], ["butter", 40, "g"], ["lemon", 1, "qty"], ["parsley", 5, "qty"]],
    ["Boil pasta.", "Sauté garlic in butter.", "Add shrimp, cook 3 min.", "Toss pasta, lemon, parsley."],
    { calories: 480, proteinG: 28, carbsG: 60, fatG: 14 }),
  r("kale-salad", "Kale Salad", "american",
    ["vegan", "gluten-free", "dairy-free", "nut-free", "keto"], [], 2, 15, 0, "easy",
    [["kale", 200, "g"], ["avocado", 1, "qty"], ["lemon", 1, "qty"], ["olive oil", 2, "tbsp"], ["garlic", 1, "qty"]],
    ["Massage kale with lemon and oil.", "Top with diced avocado and garlic."],
    { calories: 220, proteinG: 6, carbsG: 18, fatG: 16 }),
  r("veggie-chili", "Veggie Chili", "american",
    ["vegan", "gluten-free", "dairy-free", "nut-free"], [], 6, 15, 45, "easy",
    [["beans", 400, "g"], ["tomato", 400, "g"], ["onion", 1, "qty"], ["pepper", 1, "qty"], ["chili", 2, "qty"], ["cumin", 1, "tbsp"]],
    ["Sauté onion, pepper.", "Add beans, tomato, chili, cumin.", "Simmer 40 min."],
    { calories: 280, proteinG: 14, carbsG: 48, fatG: 4 }),
  r("tofu-stir-fry", "Tofu Stir-Fry", "asian",
    ["vegan", "dairy-free", "nut-free"], ["soy"], 4, 15, 15, "easy",
    [["tofu", 300, "g"], ["broccoli", 300, "g"], ["pepper", 1, "qty"], ["soy sauce", 3, "tbsp"], ["garlic", 2, "qty"], ["ginger", 1, "tbsp"]],
    ["Press and cube tofu.", "Stir-fry tofu until golden.", "Add vegetables, garlic, ginger, soy."],
    { calories: 280, proteinG: 20, carbsG: 18, fatG: 14 }),
];

// ---------- Ingredient parsing ----------

/** Normalize an ingredient string (singularize basic plurals, lowercase). */
export function normalizeIngredient(s: string): string {
  let out = (s || "").toLowerCase().trim();
  out = out.replace(/\s+/g, " ");
  // very basic singularization
  if (out.endsWith("ies")) out = out.slice(0, -3) + "y";
  else if (out.endsWith("es") && out.length > 3) out = out.slice(0, -2);
  else if (out.endsWith("s") && !out.endsWith("ss") && out.length > 2) out = out.slice(0, -1);
  return out;
}

/** Parse comma / newline separated ingredients. */
export function parseIngredients(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => normalizeIngredient(s))
    .filter(Boolean);
}

// ---------- Filters ----------

export function filterByDiet(recipes: Recipe[], diets: Diet[]): Recipe[] {
  if (diets.length === 0) return recipes.slice();
  return recipes.filter((rc) => diets.every((d) => rc.diets.includes(d)));
}

export function filterByAllergies(recipes: Recipe[], exclude: Allergen[]): Recipe[] {
  if (exclude.length === 0) return recipes.slice();
  return recipes.filter((rc) => !exclude.some((a) => rc.allergens.includes(a)));
}

export function filterByCuisine(recipes: Recipe[], cuisines: Cuisine[]): Recipe[] {
  if (cuisines.length === 0) return recipes.slice();
  return recipes.filter((rc) => cuisines.includes(rc.cuisine));
}

export function filterByTime(recipes: Recipe[], maxCookTimeMin: number): Recipe[] {
  if (!maxCookTimeMin || maxCookTimeMin <= 0) return recipes.slice();
  return recipes.filter((rc) => rc.cookTimeMin <= maxCookTimeMin);
}

export function filterByServings(recipes: Recipe[], servings: number): Recipe[] {
  if (!servings || servings <= 0) return recipes.slice();
  return recipes.filter((rc) => rc.servings >= servings);
}

/** Apply all filters in one pass. */
export function applyFilters(recipes: Recipe[], opts: FilterOptions): Recipe[] {
  let out = recipes.slice();
  out = filterByDiet(out, opts.diets);
  out = filterByAllergies(out, opts.excludeAllergens);
  out = filterByCuisine(out, opts.cuisines);
  out = filterByTime(out, opts.maxCookTimeMin);
  out = filterByServings(out, opts.servings);
  return out;
}

// ---------- Matching ----------

/** Match recipes against available ingredients. */
export function matchRecipes(recipes: Recipe[], have: string[]): MatchedRecipe[] {
  const haveSet = new Set(have.map((h) => normalizeIngredient(h)));
  const out: MatchedRecipe[] = [];
  for (const rc of recipes) {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const ing of rc.ingredients) {
      const n = normalizeIngredient(ing.name);
      if (haveSet.has(n)) matched.push(ing.name);
      else missing.push(ing.name);
    }
    const total = rc.ingredients.length || 1;
    const matchScore = matched.length / total;
    out.push({ recipe: rc, matched, missing, matchScore });
  }
  // Sort by matchScore desc, then title
  out.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.recipe.title.localeCompare(b.recipe.title);
  });
  return out;
}

/** Filter to recipes with at least one matched ingredient, sorted by score. */
export function matchRecipesWithAny(recipes: Recipe[], have: string[], minScore = 0): MatchedRecipe[] {
  return matchRecipes(recipes, have).filter((m) => m.matchScore > minScore);
}

/** Compute total nutrition for a recipe at a given serving count. */
export function totalNutrition(recipe: Recipe, servings: number): Nutrition {
  const factor = servings > 0 ? servings / recipe.servings : 1;
  const n = recipe.nutritionPerServing;
  return {
    calories: Math.round(n.calories * factor),
    proteinG: Math.round(n.proteinG * factor * 10) / 10,
    carbsG: Math.round(n.carbsG * factor * 10) / 10,
    fatG: Math.round(n.fatG * factor * 10) / 10,
  };
}

// ---------- Portion scaling ----------

/** Scale ingredient amounts to a new serving count. */
export function scalePortions(recipe: Recipe, newServings: number): Ingredient[] {
  if (newServings <= 0) return recipe.ingredients.slice();
  const factor = newServings / recipe.servings;
  return recipe.ingredients.map((ing) => ({
    name: ing.name,
    amount: roundAmount(ing.amount * factor),
    unit: ing.unit,
  }));
}

function roundAmount(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

// ---------- Unit conversion ----------

const METRIC_TO_IMPERIAL: Record<string, { unit: string; factor: number }> = {
  g: { unit: "oz", factor: 0.035274 },
  ml: { unit: "cup", factor: 0.00422675 },
  l: { unit: "cup", factor: 4.22675 },
};

const IMPERIAL_TO_METRIC: Record<string, { unit: string; factor: number }> = {
  oz: { unit: "g", factor: 28.3495 },
  cup: { unit: "ml", factor: 236.588 },
};

/** Convert a single ingredient to the target unit system. */
export function convertIngredient(ing: Ingredient, system: UnitSystem): Ingredient {
  if (system === "metric") {
    if (ing.unit in IMPERIAL_TO_METRIC) {
      const m = IMPERIAL_TO_METRIC[ing.unit];
      return { name: ing.name, amount: roundAmount(ing.amount * m.factor), unit: m.unit };
    }
    return ing;
  }
  // imperial
  if (ing.unit in METRIC_TO_IMPERIAL) {
    const m = METRIC_TO_IMPERIAL[ing.unit];
    return { name: ing.name, amount: roundAmount(ing.amount * m.factor), unit: m.unit };
  }
  return ing;
}

/** Convert all ingredients for a recipe. */
export function convertIngredients(ings: Ingredient[], system: UnitSystem): Ingredient[] {
  return ings.map((ing) => convertIngredient(ing, system));
}

/** Convert a Celsius temperature to Fahrenheit (or pass through). */
export function convertTemperature(tempC: number, system: UnitSystem): { value: number; unit: string } {
  if (system === "imperial") {
    return { value: Math.round(tempC * 9 / 5 + 32), unit: "°F" };
  }
  return { value: tempC, unit: "°C" };
}

// ---------- Variation generator ----------

function swapFirst(ings: Ingredient[], table: Record<string, string>): { name: string; replacement: string } | null {
  for (const ing of ings) {
    const n = normalizeIngredient(ing.name);
    if (n in table) return { name: ing.name, replacement: table[n] };
  }
  return null;
}

/** Generate three deterministic variations for a recipe. */
export function generateVariations(recipe: Recipe): RecipeVariation[] {
  const out: RecipeVariation[] = [];
  const protein = swapFirst(recipe.ingredients, PROTEIN_SWAPS);
  const veg = swapFirst(recipe.ingredients, VEG_SWAPS);
  const spice = swapFirst(recipe.ingredients, SPICE_SWAPS);

  if (protein) {
    const newDiets = swapDietsForProtein(recipe.diets, protein.replacement);
    out.push({
      kind: "protein-swap",
      title: `${recipe.title} — with ${protein.replacement}`,
      description: `Swap ${protein.name} for ${protein.replacement}.`,
      changes: [`Replace ${protein.name} with an equivalent amount of ${protein.replacement}.`],
      diets: newDiets,
      allergens: recipe.allergens,
    });
  }
  if (veg) {
    out.push({
      kind: "vegetable-swap",
      title: `${recipe.title} — with ${veg.replacement}`,
      description: `Swap ${veg.name} for ${veg.replacement}.`,
      changes: [`Replace ${veg.name} with an equivalent amount of ${veg.replacement}.`],
      diets: recipe.diets,
      allergens: recipe.allergens,
    });
  }
  if (spice) {
    out.push({
      kind: "spice-swap",
      title: `${recipe.title} — with ${spice.replacement}`,
      description: `Swap ${spice.name} for ${spice.replacement}.`,
      changes: [`Replace ${spice.name} with ${spice.replacement} to taste.`],
      diets: recipe.diets,
      allergens: recipe.allergens,
    });
  }
  // If recipe had no swappable items, offer generic variations
  if (out.length === 0) {
    out.push({
      kind: "spice-swap",
      title: `${recipe.title} — extra spicy`,
      description: "Add chili flakes for heat.",
      changes: ["Add 1 tsp chili flakes at the end."],
      diets: recipe.diets,
      allergens: recipe.allergens,
    });
  }
  return out;
}

function swapDietsForProtein(diets: Diet[], replacement: string): Diet[] {
  // If we swapped to a plant-based protein, recipe becomes vegetarian/vegan-friendly
  const plant = ["tofu", "lentils", "chickpeas", "white beans", "mushrooms"].includes(replacement);
  if (plant) {
    const out = new Set(diets);
    out.add("vegetarian");
    return Array.from(out);
  }
  return diets;
}

// ---------- Shopping list ----------

/** Build a shopping list of missing ingredients across multiple matched recipes. */
export function buildShoppingList(matched: MatchedRecipe[]): { name: string; inRecipes: string[] }[] {
  const map = new Map<string, string[]>();
  for (const m of matched) {
    for (const ing of m.missing) {
      if (!map.has(ing)) map.set(ing, []);
      map.get(ing)!.push(m.recipe.title);
    }
  }
  const out = Array.from(map.entries()).map(([name, inRecipes]) => ({ name, inRecipes }));
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---------- Renderers ----------

/** Render a recipe (with scaled ingredients) as Markdown. */
export function renderMarkdown(recipe: Recipe, servings: number, system: UnitSystem): string {
  const ings = convertIngredients(scalePortions(recipe, servings), system);
  const n = totalNutrition(recipe, servings);
  const lines: string[] = [];
  lines.push(`# ${recipe.title}`);
  lines.push("");
  lines.push(`**Cuisine:** ${CUISINE_LABELS[recipe.cuisine]} · **Difficulty:** ${DIFFICULTY_LABELS[recipe.difficulty]}`);
  lines.push(`**Prep:** ${recipe.prepTimeMin} min · **Cook:** ${recipe.cookTimeMin} min · **Servings:** ${servings || recipe.servings}`);
  lines.push(`**Diets:** ${recipe.diets.length ? recipe.diets.map((d) => DIET_LABELS[d]).join(", ") : "none"}`);
  if (recipe.allergens.length) {
    lines.push(`**Allergens:** ${recipe.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}`);
  }
  lines.push("");
  lines.push("## Ingredients");
  for (const ing of ings) {
    lines.push(`- ${ing.amount} ${ing.unit} ${ing.name}`);
  }
  lines.push("");
  lines.push("## Steps");
  recipe.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push("");
  lines.push("## Nutrition (total)");
  lines.push(`Calories: ${n.calories} · Protein: ${n.proteinG} g · Carbs: ${n.carbsG} g · Fat: ${n.fatG} g`);
  return lines.join("\n");
}

/** Render a recipe as JSON. */
export function renderJson(recipe: Recipe, servings: number, system: UnitSystem): string {
  const ings = convertIngredients(scalePortions(recipe, servings), system);
  const n = totalNutrition(recipe, servings);
  return JSON.stringify({
    id: recipe.id,
    title: recipe.title,
    cuisine: recipe.cuisine,
    diets: recipe.diets,
    allergens: recipe.allergens,
    servings: servings || recipe.servings,
    prepTimeMin: recipe.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin,
    difficulty: recipe.difficulty,
    ingredients: ings,
    steps: recipe.steps,
    nutrition: n,
    unitSystem: system,
  }, null, 2);
}

/** Render a shopping list as plain text. */
export function renderShoppingListText(list: { name: string; inRecipes: string[] }[]): string {
  if (list.length === 0) return "Shopping list is empty — you have everything!";
  const lines = ["Shopping list:"];
  for (const item of list) {
    lines.push(`- ${item.name} (for: ${item.inRecipes.join(", ")})`);
  }
  return lines.join("\n");
}

/** Render matched recipes as a summary text. */
export function renderMatchSummary(matched: MatchedRecipe[]): string {
  if (matched.length === 0) return "No matching recipes found.";
  const lines = ["Matched recipes:"];
  for (const m of matched.slice(0, 10)) {
    const pct = Math.round(m.matchScore * 100);
    lines.push(`- [${pct}%] ${m.recipe.title} — matched: ${m.matched.join(", ") || "none"}; missing: ${m.missing.join(", ") || "none"}`);
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
  if (state.ingredients) params.set("i", state.ingredients);
  if (state.diets.length) params.set("d", state.diets.join(","));
  if (state.excludeAllergens.length) params.set("a", state.excludeAllergens.join(","));
  if (state.cuisines.length) params.set("c", state.cuisines.join(","));
  if (state.maxCookTimeMin) params.set("t", String(state.maxCookTimeMin));
  if (state.servings) params.set("s", String(state.servings));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const empty: ShareState = {
    ingredients: "",
    diets: [],
    excludeAllergens: [],
    cuisines: [],
    maxCookTimeMin: 0,
    servings: 0,
  };
  if (!clean) return empty;
  const params = new URLSearchParams(clean);
  const validDiets = Object.keys(DIET_LABELS) as Diet[];
  const validAllergens = Object.keys(ALLERGEN_LABELS) as Allergen[];
  const validCuisines = Object.keys(CUISINE_LABELS) as Cuisine[];
  const diets = (params.get("d") ?? "").split(",").filter((d) => validDiets.includes(d as Diet)) as Diet[];
  const allergens = (params.get("a") ?? "").split(",").filter((a) => validAllergens.includes(a as Allergen)) as Allergen[];
  const cuisines = (params.get("c") ?? "").split(",").filter((c) => validCuisines.includes(c as Cuisine)) as Cuisine[];
  return {
    ingredients: params.get("i") ?? "",
    diets,
    excludeAllergens: allergens,
    cuisines,
    maxCookTimeMin: Number(params.get("t") ?? "0") || 0,
    servings: Number(params.get("s") ?? "0") || 0,
  };
}

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build a prompt to send to an LLM for richer recipe generation (BYO key). */
export function buildLlmPrompt(ingredients: string[], diets: Diet[], servings: number): string {
  return [
    "You are an expert chef.",
    "Generate one recipe using the following ingredients.",
    `Available ingredients: ${ingredients.join(", ") || "(none specified)"}.`,
    `Dietary requirements: ${diets.length ? diets.join(", ") : "none"}.`,
    `Servings: ${servings || 4}.`,
    "Return the recipe as JSON with fields: title, cuisine, servings, prepTimeMin, cookTimeMin, ingredients (array of {name, amount, unit}), steps (array of strings).",
    "Do not include any commentary. Output JSON only.",
  ].join("\n");
}

/** Parse an LLM JSON response into a partial Recipe-like object. */
export function renderLlmResult(json: string): {
  title: string;
  ingredients: Ingredient[];
  steps: string[];
} {
  try {
    const obj = JSON.parse(json) as {
      title?: string;
      ingredients?: { name?: string; amount?: number; unit?: string }[];
      steps?: string[];
    };
    return {
      title: obj.title ?? "LLM recipe",
      ingredients: (obj.ingredients ?? []).map((i) => ({
        name: String(i.name ?? ""),
        amount: Number(i.amount ?? 0) || 0,
        unit: String(i.unit ?? "qty"),
      })),
      steps: Array.isArray(obj.steps) ? obj.steps.map(String) : [],
    };
  } catch {
    return { title: "LLM recipe", ingredients: [], steps: [] };
  }
}
