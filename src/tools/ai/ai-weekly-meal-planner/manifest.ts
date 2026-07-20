import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-weekly-meal-planner",
  name: "AI Weekly Meal Planner",
  description:
    "Plan a full week of meals (breakfast, lunch, dinner, snack per day) from a built-in 50+ recipe database. Diet filters (vegan, vegetarian, keto, gluten-free, dairy-free, nut-free, halal), allergy exclusions, cuisine variety, max cook time, household size, budget, and calorie/macro targets. Auto-builds a consolidated grocery list grouped by aisle with smart ingredient-overlap to cut waste, plus one-tap meal swaps and pantry-aware planning. Pure-JS engine — optional BYO-key LLM. 100% client-side, no subscription, no upload.",
  category: "ai",
  keywords: [
    "weekly meal planner", "meal plan with grocery list", "free meal planner",
    "ai meal plan", "vegan meal planner", "vegetarian meal planner",
    "keto meal plan", "gluten-free meal plan", "diet meal planner",
    "no subscription meal planner", "private meal planner",
    "7 day meal plan", "grocery list generator",
  ],
  icon: "calendar-days",
  requiresNetwork: false,
  seo: {
    title: "AI Weekly Meal Planner — 7-Day Plan + Grocery List, Diet-Aware, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Weekly Meal Planner work?",
        a: "Set your diet (vegan, vegetarian, keto, gluten-free, dairy-free, nut-free, halal), exclude allergens, pick cuisines, set max cook time, household size, and an optional weekly budget. The planner draws from a built-in 50+ recipe database, filters by your constraints, then deterministically assigns one breakfast, one lunch, one dinner, and one snack to each of 7 days — maximizing cuisine variety and ingredient overlap (so you buy fewer unique groceries). Each meal includes prep time, cook time, servings scaled to your household, and a nutrition estimate.",
      },
      {
        q: "How does the auto grocery list work?",
        a: "Every ingredient from every meal in the 7-day plan is consolidated into a single shopping list, with quantities summed across servings. Items are grouped by grocery aisle (produce, dairy, meat, pantry, frozen, bakery, spices, other) and ingredient overlap is maximized — for example, if two meals use onion, you buy onion once with the combined quantity. Pantry items you already have can be excluded so the list only shows what you need to buy.",
      },
      {
        q: "Can I swap a meal I don't like?",
        a: "Yes. Each meal slot has a swap button. The swap function picks the next-best matching recipe from the filtered pool that hasn't already been used in the current plan, preserving your diet/allergen/cuisine/time constraints. Swaps are deterministic — same plan and same slot always produce the same swap.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 50+ recipe database. (2) Diet filters (vegan, vegetarian, gluten-free, keto, dairy-free, nut-free, halal). (3) Allergy exclusions. (4) Cuisine variety control. (5) Max cook-time filter. (6) Household size with portion scaling. (7) Weekly budget tracker with cost estimate per recipe. (8) Calorie/macro targets per day. (9) 7-day plan generator (28 slots). (10) One-tap meal swap. (11) Pantry input (use what you have). (12) Auto consolidated grocery list grouped by aisle. (13) Ingredient-overlap optimization. (14) Daily + weekly nutrition totals. (15) Export Markdown / JSON / TXT / printable. (16) History (localStorage, last 20). (17) Shareable URL. (18) Optional BYO-key LLM enhancement. (19) Deterministic — same inputs always produce the same plan.",
      },
      {
        q: "Is my meal plan or pantry data sent anywhere?",
        a: "No. All filtering, planning, grocery consolidation, scaling, and nutrition estimation run locally in your browser. Pantry and preference data never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
