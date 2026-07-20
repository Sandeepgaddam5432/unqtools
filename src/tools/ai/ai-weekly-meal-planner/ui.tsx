"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  CalendarDays, History, Key, Sparkles, ShoppingCart, RefreshCw,
  Flame, DollarSign, Users, Clock, AlertTriangle, Leaf,
} from "lucide-react";
import {
  DIET_LABELS,
  ALLERGEN_LABELS,
  CUISINE_LABELS,
  MEAL_TYPE_LABELS,
  AISLE_LABELS,
  AISLE_ORDER,
  DEFAULT_FILTERS,
  DEFAULT_PLAN_OPTIONS,
  RECIPES,
  parsePantry,
  applyFilters,
  generatePlan,
  swapMeal,
  buildGroceryList,
  groupByAisle,
  filterByPantry,
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
  type WeeklyPlan,
  type FilterOptions,
  type PlanOptions,
  type ShareState,
  type HistoryEntry,
} from "./logic";

const ALL_DIETS = Object.keys(DIET_LABELS) as Diet[];
const ALL_ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];
const ALL_CUISINES = Object.keys(CUISINE_LABELS) as Cuisine[];

type Tab = "plan" | "grocery" | "json" | "markdown" | "text";

export default function AIWeeklyMealPlanner() {
  const [selectedDiets, setSelectedDiets] = useState<Diet[]>([]);
  const [excludeAllergens, setExcludeAllergens] = useState<Allergen[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<Cuisine[]>([]);
  const [maxCookTime, setMaxCookTime] = useState(0);
  const [maxCostPerServing, setMaxCostPerServing] = useState(0);
  const [householdSize, setHouseholdSize] = useState(2);
  const [weeklyBudget, setWeeklyBudget] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(0);
  const [pantryText, setPantryText] = useState("");
  const [seed, setSeed] = useState(1);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
  const [llmRecipe, setLlmRecipe] = useState<{ title: string; calories: number } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setSelectedDiets(p.diets);
      setExcludeAllergens(p.excludeAllergens);
      setSelectedCuisines(p.cuisines);
      setMaxCookTime(p.maxCookTimeMin);
      setMaxCostPerServing(p.maxCostPerServingUsd);
      setHouseholdSize(p.householdSize);
      setWeeklyBudget(p.weeklyBudgetUsd);
      setCalorieTarget(p.calorieTargetPerDay);
      setPantryText(p.pantry);
      setSeed(p.seed);
      if (p.diets.length || p.excludeAllergens.length || p.cuisines.length || p.pantry) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const pantry = useMemo(() => parsePantry(pantryText), [pantryText]);

  const filters: FilterOptions = useMemo(() => ({
    diets: selectedDiets,
    excludeAllergens,
    cuisines: selectedCuisines,
    maxCookTimeMin: maxCookTime,
    maxCostPerServingUsd: maxCostPerServing,
  }), [selectedDiets, excludeAllergens, selectedCuisines, maxCookTime, maxCostPerServing]);

  const options: PlanOptions = useMemo(() => ({
    filters,
    householdSize,
    weeklyBudgetUsd: weeklyBudget,
    calorieTargetPerDay: calorieTarget,
    pantry,
    seed,
  }), [filters, householdSize, weeklyBudget, calorieTarget, pantry, seed]);

  const filteredCount = useMemo(() => applyFilters(RECIPES, filters).length, [filters]);

  const groceryList = useMemo(() => {
    if (!plan) return [];
    const full = buildGroceryList(plan);
    return filterByPantry(full, pantry);
  }, [plan, pantry]);

  const groceryGrouped = useMemo(() => groupByAisle(groceryList), [groceryList]);

  const handleGenerate = useCallback(() => {
    if (filteredCount === 0) {
      toast.error("No recipes match your filters — try loosening them");
      return;
    }
    // Check each meal type has at least one recipe
    const pool = applyFilters(RECIPES, filters);
    const byMeal = new Set(pool.map((r) => r.mealType));
    if (!byMeal.has("breakfast") || !byMeal.has("lunch") || !byMeal.has("dinner")) {
      toast.warning("Some meal types have no matches — those slots will be skipped");
    }
    const newPlan = generatePlan(options);
    setPlan(newPlan);
    saveHistory({
      ts: Date.now(),
      dietCount: selectedDiets.length,
      mealCount: newPlan.days.reduce((s, d) => s + d.slots.length, 0),
      weeklyCost: newPlan.weeklyCost,
      avgDailyCalories: newPlan.avgDailyCalories,
    });
    setHistory(loadHistory());
    toast.success(`Plan ready: 7 days · $${newPlan.weeklyCost.toFixed(2)} weekly`);
  }, [filteredCount, filters, options, selectedDiets.length]);

  const handleSwap = useCallback((day: number, mealType: MealType) => {
    if (!plan) return;
    const swapped = swapMeal(plan, options, day, mealType);
    setPlan(swapped);
    toast.success(`Swapped ${MEAL_TYPE_LABELS[mealType]} on ${dayName(day)}`);
  }, [plan, options]);

  const handleClear = useCallback(() => {
    setSelectedDiets([]);
    setExcludeAllergens([]);
    setSelectedCuisines([]);
    setMaxCookTime(0);
    setMaxCostPerServing(0);
    setHouseholdSize(2);
    setWeeklyBudget(0);
    setCalorieTarget(0);
    setPantryText("");
    setSeed(1);
    setPlan(null);
    setLlmRecipe(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareState: ShareState = useMemo(() => ({
    diets: selectedDiets,
    excludeAllergens,
    cuisines: selectedCuisines,
    maxCookTimeMin: maxCookTime,
    maxCostPerServingUsd: maxCostPerServing,
    householdSize,
    weeklyBudgetUsd: weeklyBudget,
    calorieTargetPerDay: calorieTarget,
    pantry: pantryText,
    seed,
  }), [selectedDiets, excludeAllergens, selectedCuisines, maxCookTime, maxCostPerServing, householdSize, weeklyBudget, calorieTarget, pantryText, seed]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt("dinner", selectedDiets, selectedCuisines, householdSize);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a chef. Return only JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const r = renderLlmResult(text);
      if (r) {
        setLlmRecipe({ title: r.title, calories: r.nutritionPerServing.calories });
        toast.success(`LLM suggested: ${r.title}`);
      } else {
        toast.error("Could not parse LLM response");
      }
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, selectedDiets, selectedCuisines, householdSize]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Diet filters (must include ALL)</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_DIETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDiets((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d])}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    selectedDiets.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {DIET_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Exclude allergens</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_ALLERGENS.map((a) => (
                <button
                  key={a}
                  onClick={() => setExcludeAllergens((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    excludeAllergens.includes(a)
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {ALLERGEN_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Cuisine variety (pick 2-3 for best variety)</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCuisines((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    selectedCuisines.includes(c)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {CUISINE_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Max cook (min)</Label>
              <Input
                type="number" min={0}
                value={maxCookTime || ""}
                onChange={(e) => setMaxCookTime(Math.max(0, Number(e.target.value) || 0))}
                placeholder="any"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" /> Max $/serving</Label>
              <Input
                type="number" min={0} step={0.5}
                value={maxCostPerServing || ""}
                onChange={(e) => setMaxCostPerServing(Math.max(0, Number(e.target.value) || 0))}
                placeholder="any"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Household</Label>
              <Input
                type="number" min={1}
                value={householdSize}
                onChange={(e) => setHouseholdSize(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Flame className="h-3 w-3" /> Cal/day target</Label>
              <Input
                type="number" min={0} step={50}
                value={calorieTarget || ""}
                onChange={(e) => setCalorieTarget(Math.max(0, Number(e.target.value) || 0))}
                placeholder="any"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Seed</Label>
              <Input
                type="number" min={1}
                value={seed}
                onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-pantry" className="text-xs">
              Pantry items (already on hand — these are excluded from the grocery list)
            </Label>
            <Textarea
              id="mp-pantry"
              value={pantryText}
              onChange={(e) => setPantryText(e.target.value)}
              placeholder={"onion, garlic, olive oil\nsalt, pepper"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <div className="text-[11px] text-muted-foreground">{pantry.length} pantry item(s)</div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{filteredCount}</strong> / {RECIPES.length} recipes match filters
            </div>
            <div className="flex gap-2">
              <ShareButton getUrl={() => buildShareUrl(shareState)} />
              <ClearButton onClick={handleClear} />
              <Button onClick={handleGenerate} className="h-8 gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" /> Generate 7-day plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> 7-day plan · {plan.recipes.length} unique recipes
                </h3>
                <div className="flex flex-wrap gap-2">
                  <TabBtn active={activeTab === "plan"} onClick={() => setActiveTab("plan")} label="Plan" />
                  <TabBtn active={activeTab === "grocery"} onClick={() => setActiveTab("grocery")} label="Grocery" />
                  <TabBtn active={activeTab === "json"} onClick={() => setActiveTab("json")} label="JSON" />
                  <TabBtn active={activeTab === "markdown"} onClick={() => setActiveTab("markdown")} label="Markdown" />
                  <TabBtn active={activeTab === "text"} onClick={() => setActiveTab("text")} label="Text" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Weekly cost" value={`$${plan.weeklyCost.toFixed(2)}`} highlight={weeklyBudget > 0 && plan.weeklyCost > weeklyBudget ? "bad" : undefined} />
                <Stat label="Avg/day cal" value={plan.avgDailyCalories} highlight={calorieTarget > 0 ? (Math.abs(plan.avgDailyCalories - calorieTarget) < calorieTarget * 0.1 ? "good" : "bad") : undefined} />
                <Stat label="Weekly cal" value={plan.weeklyTotals.calories} />
                <Stat label="Protein (g/wk)" value={plan.weeklyTotals.proteinG} />
              </div>
              {weeklyBudget > 0 && plan.weeklyCost > weeklyBudget && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Over budget by ${(plan.weeklyCost - weeklyBudget).toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>

          {activeTab === "plan" && (
            <div className="space-y-3">
              {plan.days.map((day) => (
                <Card key={day.day}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">{dayName(day.day)}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{day.totals.calories} cal</Badge>
                        <Badge variant="outline" className="text-[10px]">${day.cost.toFixed(2)}</Badge>
                        <Badge variant="outline" className="text-[10px]">{day.totals.proteinG}g protein</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {day.slots.map((slot) => (
                        <div key={slot.mealType} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-[10px]">{MEAL_TYPE_LABELS[slot.mealType]}</Badge>
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => handleSwap(day.day, slot.mealType)}
                            >
                              <RefreshCw className="h-3 w-3" /> Swap
                            </Button>
                          </div>
                          <div className="font-medium text-foreground">{slot.recipe.title}</div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">{CUISINE_LABELS[slot.recipe.cuisine]}</Badge>
                            <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />{slot.recipe.prepTimeMin + slot.recipe.cookTimeMin}m</Badge>
                            <Badge variant="outline" className="text-[10px]"><Users className="h-2.5 w-2.5 mr-0.5" />{slot.scaledServings}</Badge>
                            <Badge variant="outline" className="text-[10px]"><DollarSign className="h-2.5 w-2.5 mr-0.5" />{(slot.recipe.costPerServingUsd * slot.scaledServings).toFixed(2)}</Badge>
                            <Badge variant="outline" className="text-[10px]"><Flame className="h-2.5 w-2.5 mr-0.5" />{slot.recipe.nutritionPerServing.calories * slot.scaledServings}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {slot.recipe.diets.slice(0, 3).map((d) => (
                              <Badge key={d} variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-300">
                                <Leaf className="h-2.5 w-2.5 mr-0.5" />{DIET_LABELS[d]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "grocery" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" /> Grocery list ({groceryList.length} items)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => renderGroceryListText(groceryList)} label="Copy list" />
                    <DownloadButton
                      getText={() => renderGroceryListText(groceryList)}
                      filename="grocery-list.txt"
                      mime="text/plain"
                      label="Download .txt"
                    />
                    <DownloadButton
                      getText={() => renderGroceryListMarkdown(groceryList)}
                      filename="grocery-list.md"
                      mime="text/markdown"
                      label="Download .md"
                    />
                  </div>
                </div>
                {pantry.length > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    {pantry.length} pantry item(s) excluded from list
                  </div>
                )}
                <div className="space-y-3">
                  {AISLE_ORDER.map((aisle) => {
                    const items = groceryGrouped[aisle];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={aisle} className="space-y-1">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          {AISLE_LABELS[aisle]} <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                        </h4>
                        <div className="space-y-0.5">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs rounded border bg-background px-2 py-1">
                              <span className="font-mono text-foreground w-20">{item.amount} {item.unit}</span>
                              <span className="flex-1 text-foreground">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground">{item.inMeals.length} meal{item.inMeals.length === 1 ? "" : "s"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab !== "plan" && activeTab !== "grocery" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="max-h-[600px] overflow-auto rounded border bg-muted/30 p-3">
                  <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-all">
                    {activeTab === "json" && renderJsonPlan(plan)}
                    {activeTab === "markdown" && renderMarkdownPlan(plan)}
                    {activeTab === "text" && renderTextPlan(plan)}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => activeTab === "json" ? renderJsonPlan(plan) : activeTab === "markdown" ? renderMarkdownPlan(plan) : renderTextPlan(plan)}
                    label="Copy current"
                  />
                  <DownloadButton
                    getText={() => renderJsonPlan(plan)}
                    filename="meal-plan.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <DownloadButton
                    getText={() => renderMarkdownPlan(plan)}
                    filename="meal-plan.md"
                    mime="text/markdown"
                    label="Download .md"
                  />
                  <DownloadButton
                    getText={() => renderTextPlan(plan)}
                    filename="meal-plan.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!plan && (
        <EmptyState
          title="Set your preferences and generate a 7-day meal plan"
          hint="Pick diets, exclude allergens, choose cuisines, set household size, and add pantry items. The planner uses a 55-recipe database and a deterministic seed — same inputs always produce the same plan."
          icon={<CalendarDays className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: suggest a custom recipe with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for a custom dinner recipe matching your filters. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : "Suggest a recipe with LLM"}
              </Button>
              {llmRecipe && (
                <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-3 w-3" /> {llmRecipe.title}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{llmRecipe.calories} cal/serving</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.dietCount} diets</Badge>
                  <Badge variant="outline" className="mr-2">{h.mealCount} meals</Badge>
                  <Badge variant="outline" className="mr-2">${h.weeklyCost.toFixed(2)}</Badge>
                  <Badge variant="outline" className="mr-2">{h.avgDailyCalories} cal/day</Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All filtering, planning, grocery consolidation, scaling, and nutrition estimation run locally in your browser. Pantry and preference data never leave this device. The only network call is if you paste your own LLM API key.
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <strong>Allergy note:</strong> Filters reduce but cannot guarantee safety — always verify labels. Nutrition and cost are estimates only, not medical or dietary advice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] rounded border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground font-semibold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
