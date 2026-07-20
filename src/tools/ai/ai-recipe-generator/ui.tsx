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
  ChefHat, History, Clock, Users, Flame, Key, Sparkles, ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import {
  CUISINE_LABELS,
  DIET_LABELS,
  ALLERGEN_LABELS,
  DIFFICULTY_LABELS,
  RECIPES,
  parseIngredients,
  applyFilters,
  matchRecipesWithAny,
  matchRecipes,
  totalNutrition,
  scalePortions,
  convertIngredients,
  generateVariations,
  buildShoppingList,
  renderMarkdown,
  renderJson,
  renderShoppingListText,
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
  type UnitSystem,
  type MatchedRecipe,
  type RecipeVariation,
  type HistoryEntry,
} from "./logic";

const ALL_DIETS = Object.keys(DIET_LABELS) as Diet[];
const ALL_ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];
const ALL_CUISINES = Object.keys(CUISINE_LABELS) as Cuisine[];

export default function AIRecipeGenerator() {
  const [ingredientsText, setIngredientsText] = useState("");
  const [selectedDiets, setSelectedDiets] = useState<Diet[]>([]);
  const [excludeAllergens, setExcludeAllergens] = useState<Allergen[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<Cuisine[]>([]);
  const [maxCookTime, setMaxCookTime] = useState(0);
  const [servingsFilter, setServingsFilter] = useState(0);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeServings, setRecipeServings] = useState(4);
  const [variations, setVariations] = useState<RecipeVariation[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.ingredients) setIngredientsText(p.ingredients);
      setSelectedDiets(p.diets);
      setExcludeAllergens(p.excludeAllergens);
      setSelectedCuisines(p.cuisines);
      setMaxCookTime(p.maxCookTimeMin);
      setServingsFilter(p.servings);
      if (p.ingredients || p.diets.length) toast.info("Loaded from share link");
    }
  }, []);

  const ingredients = useMemo(() => parseIngredients(ingredientsText), [ingredientsText]);
  const filteredRecipes = useMemo(
    () => applyFilters(RECIPES, {
      diets: selectedDiets,
      excludeAllergens,
      cuisines: selectedCuisines,
      maxCookTimeMin: maxCookTime,
      servings: servingsFilter,
    }),
    [selectedDiets, excludeAllergens, selectedCuisines, maxCookTime, servingsFilter],
  );
  const matched = useMemo(
    () => ingredients.length > 0
      ? matchRecipesWithAny(filteredRecipes, ingredients)
      : matchRecipes(filteredRecipes, ingredients).slice(0, 20),
    [filteredRecipes, ingredients],
  );

  const shoppingList = useMemo(() => buildShoppingList(matched.slice(0, 5)), [matched]);

  const selectedMatch = useMemo(
    () => matched.find((m) => m.recipe.id === selectedRecipeId) ?? null,
    [matched, selectedRecipeId],
  );

  const handleRun = useCallback(() => {
    if (ingredients.length === 0) {
      toast.error("Enter at least one ingredient");
      return;
    }
    if (matched.length === 0) {
      toast.info("No recipes match your filters — try loosening them");
      return;
    }
    const top = matched[0];
    saveHistory({
      ts: Date.now(),
      ingredientCount: ingredients.length,
      matchCount: matched.length,
      topRecipe: top.recipe.title,
      topScore: top.matchScore,
    });
    setHistory(loadHistory());
    setSelectedRecipeId(top.recipe.id);
    setRecipeServings(top.recipe.servings);
    setVariations(null);
    toast.success(`${matched.length} recipes matched — top: ${Math.round(top.matchScore * 100)}%`);
  }, [ingredients, matched]);

  const handleClear = useCallback(() => {
    setIngredientsText("");
    setSelectedDiets([]);
    setExcludeAllergens([]);
    setSelectedCuisines([]);
    setMaxCookTime(0);
    setServingsFilter(0);
    setSelectedRecipeId(null);
    setVariations(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleDiet = (d: Diet) => setSelectedDiets((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  const toggleAllergen = (a: Allergen) => setExcludeAllergens((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a]);
  const toggleCuisine = (c: Cuisine) => setSelectedCuisines((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);

  const handleGenerateVariations = useCallback(() => {
    if (!selectedMatch) return;
    setVariations(generateVariations(selectedMatch.recipe));
    toast.success("Generated variations");
  }, [selectedMatch]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(ingredients, selectedDiets, recipeServings);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert chef. Return only JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const out = renderLlmResult(text);
      toast.success(`LLM recipe: ${out.title} (${out.ingredients.length} ingredients)`);
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, ingredients, selectedDiets, recipeServings]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="arg-ingredients">Ingredients you have (one per line or comma-separated)</Label>
            <Textarea
              id="arg-ingredients"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder={"tomato\nonion\ngarlic"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="text-[11px] text-muted-foreground">
              {ingredients.length} ingredient(s) parsed
            </div>
          </div>

          <div>
            <Label className="text-xs">Diet filters</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_DIETS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDiet(d)}
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
                  onClick={() => toggleAllergen(a)}
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
            <Label className="text-xs">Cuisine filters</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCuisine(c)}
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Max cook (min)</Label>
              <Input
                type="number"
                min={0}
                value={maxCookTime || ""}
                onChange={(e) => setMaxCookTime(Math.max(0, Number(e.target.value) || 0))}
                placeholder="any"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Min servings</Label>
              <Input
                type="number"
                min={0}
                value={servingsFilter || ""}
                onChange={(e) => setServingsFilter(Math.max(0, Number(e.target.value) || 0))}
                placeholder="any"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Units</Label>
              <select
                value={unitSystem}
                onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
                className="mt-1 h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="metric">Metric (g, ml)</option>
                <option value="imperial">Imperial (oz, cup)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRun} className="h-8 gap-1.5 text-xs w-full">
                <ChefHat className="h-3.5 w-3.5" /> Match recipes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" /> {matched.length} recipe(s) matched
            </h3>
            <div className="flex gap-2">
              <ShareButton getUrl={() => buildShareUrl({
                ingredients: ingredientsText,
                diets: selectedDiets,
                excludeAllergens,
                cuisines: selectedCuisines,
                maxCookTimeMin: maxCookTime,
                servings: servingsFilter,
              })} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          {matched.length > 0 ? (
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {matched.slice(0, 30).map((m) => (
                <button
                  key={m.recipe.id}
                  onClick={() => {
                    setSelectedRecipeId(m.recipe.id);
                    setRecipeServings(m.recipe.servings);
                    setVariations(null);
                  }}
                  className={`w-full text-left rounded border bg-background px-3 py-2 text-xs transition-colors ${
                    selectedRecipeId === m.recipe.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{m.recipe.title}</span>
                    <Badge variant={m.matchScore >= 0.7 ? "default" : "secondary"} className="text-[10px]">
                      {Math.round(m.matchScore * 100)}%
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{CUISINE_LABELS[m.recipe.cuisine]}</Badge>
                    <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />{m.recipe.cookTimeMin}m</Badge>
                    <Badge variant="outline" className="text-[10px]"><Users className="h-2.5 w-2.5 mr-0.5" />{m.recipe.servings}</Badge>
                    <Badge variant="outline" className="text-[10px]">{DIFFICULTY_LABELS[m.recipe.difficulty]}</Badge>
                    {m.recipe.diets.slice(0, 2).map((d) => (
                      <Badge key={d} variant="outline" className="text-[10px]">{DIET_LABELS[d]}</Badge>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    matched: <span className="text-emerald-600 dark:text-emerald-400">{m.matched.join(", ") || "none"}</span>
                    {m.missing.length > 0 && (
                      <> · missing: <span className="text-amber-600 dark:text-amber-400">{m.missing.join(", ")}</span></>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recipes match your filters"
              hint="Try loosening diet/cuisine filters or adding more ingredients."
              icon={<ChefHat className="h-8 w-8" />}
            />
          )}
        </CardContent>
      </Card>

      {selectedMatch && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{selectedMatch.recipe.title}</h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> Servings:
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={recipeServings}
                  onChange={(e) => setRecipeServings(Math.max(1, Number(e.target.value) || 1))}
                  className="h-7 w-16 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">{CUISINE_LABELS[selectedMatch.recipe.cuisine]}</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />Prep {selectedMatch.recipe.prepTimeMin}m</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />Cook {selectedMatch.recipe.cookTimeMin}m</Badge>
              <Badge variant="outline" className="text-[10px]">{DIFFICULTY_LABELS[selectedMatch.recipe.difficulty]}</Badge>
              {selectedMatch.recipe.diets.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px]">{DIET_LABELS[d]}</Badge>
              ))}
              {selectedMatch.recipe.allergens.map((a) => (
                <Badge key={a} variant="outline" className="text-[10px] text-red-600 dark:text-red-400 border-red-300">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{ALLERGEN_LABELS[a]}
                </Badge>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-foreground mb-1">Ingredients ({recipeServings} servings, {unitSystem})</h4>
              <ul className="space-y-0.5 text-xs">
                {convertIngredients(scalePortions(selectedMatch.recipe, recipeServings), unitSystem).map((ing, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedMatch.matched.includes(ing.name) ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-mono text-foreground">{ing.amount} {ing.unit}</span>
                    <span className="text-muted-foreground">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-foreground mb-1">Steps</h4>
              <ol className="space-y-0.5 text-xs list-decimal list-inside text-muted-foreground">
                {selectedMatch.recipe.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(() => {
                const n = totalNutrition(selectedMatch.recipe, recipeServings);
                return (
                  <>
                    <NutriBadge label="Calories" value={`${n.calories}`} icon={<Flame className="h-3 w-3" />} />
                    <NutriBadge label="Protein" value={`${n.proteinG}g`} />
                    <NutriBadge label="Carbs" value={`${n.carbsG}g`} />
                    <NutriBadge label="Fat" value={`${n.fatG}g`} />
                  </>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerateVariations} variant="outline" size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Generate variations
              </Button>
              <CopyButton
                getText={() => renderMarkdown(selectedMatch.recipe, recipeServings, unitSystem)}
                label="Copy as Markdown"
              />
              <DownloadButton
                getText={() => renderMarkdown(selectedMatch.recipe, recipeServings, unitSystem)}
                filename={`${selectedMatch.recipe.id}.md`}
                mime="text/markdown"
                label="Download .md"
              />
              <DownloadButton
                getText={() => renderJson(selectedMatch.recipe, recipeServings, unitSystem)}
                filename={`${selectedMatch.recipe.id}.json`}
                mime="application/json"
                label="Download JSON"
              />
            </div>

            {variations && (
              <div className="space-y-1.5 pt-2 border-t">
                <h4 className="text-xs font-semibold text-foreground">Variations ({variations.length})</h4>
                {variations.map((v, i) => (
                  <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{v.kind}</Badge>
                      <span className="font-medium text-foreground">{v.title}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{v.description}</p>
                    <ul className="mt-0.5 list-disc list-inside text-[10px] text-muted-foreground">
                      {v.changes.map((c, j) => (<li key={j}>{c}</li>))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {shoppingList.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" /> Shopping list ({shoppingList.length})
            </h3>
            <div className="space-y-0.5 text-xs">
              {shoppingList.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="font-mono text-foreground">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">for: {item.inRecipes.join(", ")}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <CopyButton getText={() => renderShoppingListText(shoppingList)} label="Copy list" />
              <DownloadButton
                getText={() => renderShoppingListText(shoppingList)}
                filename="shopping-list.txt"
                label="Download .txt"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for a custom recipe using your ingredients. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : "Ask LLM for recipe"}
              </Button>
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
                  <Badge variant="outline" className="mr-2">{Math.round(h.topScore * 100)}%</Badge>
                  <Badge variant="outline" className="mr-2">{h.ingredientCount} ings</Badge>
                  <Badge variant="outline" className="mr-2">{h.matchCount} matches</Badge>
                  <span className="text-foreground">{h.topRecipe}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All matching, filtering, scaling, and variation generation run locally in your browser. Ingredient lists never leave this device. The only network call is if you paste your own LLM API key.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <strong>Allergy note:</strong> Filters reduce but cannot guarantee safety — always verify labels. Nutrition is an estimate only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NutriBadge({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
