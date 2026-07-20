import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-recipe-generator",
  name: "AI Recipe Generator",
  description:
    "Generate recipes from ingredients in your fridge. Built-in 50+ recipe database with diet (vegan, gluten-free, keto, halal), allergy, cuisine, time, and servings filters. Match recipes by available ingredients, generate variations, scale portions live, estimate nutrition, toggle metric/imperial units, export a shopping list. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "recipe generator", "recipe from ingredients", "what can i cook with",
    "ai recipe maker free no login", "diet recipe generator",
    "vegan recipe generator", "gluten-free recipes", "keto recipes",
    "recipe scaler", "shopping list",
  ],
  icon: "chef-hat",
  requiresNetwork: false,
  seo: {
    title: "AI Recipe Generator — From Ingredients, Diet-Aware, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Recipe Generator work?",
        a: "Type the ingredients you have (comma or newline separated) and the matcher scores every recipe in a built-in 50+ recipe database by how many of its required ingredients you own. You can filter by diet (vegan, vegetarian, gluten-free, keto, halal, dairy-free, nut-free), by cuisine (Italian, Asian, Mexican, etc.), by max cook time, and by servings. Each result includes structured steps, prep time, cook time, difficulty, a nutrition estimate, and a live portion scaler.",
      },
      {
        q: "Can the tool generate recipe variations?",
        a: "Yes. For any matched recipe click 'Variations' and the generator produces three deterministic variations: a protein swap, a vegetable swap, and a spice-profile swap, each preserving the original diet/allergy flags. Variations are produced by pure-JS rules from a substitution table — they do not call any external model. Optional BYO-key LLM mode can produce richer, free-form variations if you provide your own API key.",
      },
      {
        q: "How do portion scaling and unit conversion work?",
        a: "Move the servings slider and every ingredient quantity is recomputed proportionally (rounded to a sensible fraction for cooking). Toggle the unit switch between metric and imperial and the converter swaps grams↔ounces, milliliters↔cups, and Celsius↔Fahrenheit in both the ingredient list and the cooking temperatures. All conversions are deterministic and run locally.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 50+ recipe database. (2) Ingredient matcher with match-score percentage. (3) Diet filters (vegan, vegetarian, gluten-free, keto, halal, dairy-free, nut-free). (4) Allergy filters. (5) Cuisine filter (Italian, Asian, Mexican, Indian, Mediterranean, American). (6) Max cook-time filter. (7) Servings filter. (8) Recipe variation generator (3 deterministic variations per recipe). (9) Live portion scaler. (10) Metric↔imperial unit converter. (11) Nutrition estimate (calories, protein, carbs, fat). (12) Shopping list of missing ingredients. (13) Recipe markdown export + printable text. (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement. (17) Deterministic — same inputs always produce the same output.",
      },
      {
        q: "Is my ingredient list sent anywhere?",
        a: "No. All matching, filtering, scaling, and variation generation run locally in your browser. Ingredient lists never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
