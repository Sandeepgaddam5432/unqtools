"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculateCalories,
  calorieTableCsv,
  activityLabel,
  mealPlan,
  ACTIVITY_LABELS,
  type ActivityLevel,
  type CalorieResult,
  type UnitSystem,
} from "./logic";

const LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "veryActive"];

export default function CalorieCalculator() {
  const [unit, setUnit] = useState<UnitSystem>("metric");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("80");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetWeeks, setTargetWeeks] = useState("");
  const [level, setLevel] = useState<ActivityLevel>("moderate");
  const [result, setResult] = useState<CalorieResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = calculateCalories(
      {
        age: Number(age),
        sex,
        height: Number(height),
        weight: Number(weight),
        unitSystem: unit,
        targetWeight: targetWeight ? Number(targetWeight) : undefined,
        targetWeeks: targetWeeks ? Number(targetWeeks) : undefined,
      },
      level,
    );
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [age, sex, height, weight, unit, targetWeight, targetWeeks, level]);

  const sample = useCallback(() => {
    setUnit("metric");
    setAge("30"); setSex("male"); setHeight("175"); setWeight("80");
    setTargetWeight("75"); setTargetWeeks("12"); setLevel("moderate");
  }, []);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  const heightLabel = unit === "metric" ? "Height (cm)" : "Height (inches)";
  const weightLabel = unit === "metric" ? "Weight (kg)" : "Weight (lb)";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={unit === "metric" ? "default" : "outline"} onClick={() => setUnit("metric")}>Metric</Button>
            <Button size="sm" variant={unit === "imperial" ? "default" : "outline"} onClick={() => setUnit("imperial")}>Imperial</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Age" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sex</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={sex === "male" ? "default" : "outline"} onClick={() => setSex("male")}>Male</Button>
                <Button size="sm" variant={sex === "female" ? "default" : "outline"} onClick={() => setSex("female")}>Female</Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{heightLabel}</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{weightLabel}</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Weight" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Activity level</Label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Button key={l} size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)}>{activityLabel(l).split(" ")[0]}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target weight (optional, {unit === "metric" ? "kg" : "lb"})</Label>
              <Input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} aria-label="Target weight" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target weeks (optional)</Label>
              <Input type="number" value={targetWeeks} onChange={(e) => setTargetWeeks(e.target.value)} aria-label="Target weeks" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BMR</p>
              <p className="text-2xl font-bold text-primary">{result.bmr}</p>
              <p className="text-xs text-muted-foreground">kcal/day</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <p className="text-2xl font-bold text-primary">{result.maintenanceCalories}</p>
              <p className="text-xs text-muted-foreground">{ACTIVITY_LABELS[result.selectedLevel].split(" ")[0]}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BMI</p>
              <p className="text-2xl font-bold">{result.bmi}</p>
              <Badge variant="outline" className="mt-1">{result.bmiCategory}</Badge>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Goal kcal</p>
              <p className="text-2xl font-bold">{result.goalCalories}</p>
              <p className="text-xs text-muted-foreground">{result.dailyDelta >= 0 ? "surplus" : "deficit"} {Math.abs(result.dailyDelta)}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">TDEE by activity level</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {LEVELS.map((l) => (
                <div key={l} className="rounded-md border border-border p-2 text-center">
                  <p className="text-xs text-muted-foreground">{activityLabel(l).split(" ")[0]}</p>
                  <p className="text-lg font-bold">{result.tdee[l]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["cut", "maintain", "bulk"] as const).map((k) => (
              <Card key={k}>
                <CardHeader className="pb-3"><CardTitle className="text-sm capitalize">{k} ({result.macros[k].calories} kcal)</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 text-sm space-y-1">
                  <p>Carbs: <strong>{result.macros[k].carbs} g</strong> ({result.macros[k].ratio.carbs}%)</p>
                  <p>Protein: <strong>{result.macros[k].protein} g</strong> ({result.macros[k].ratio.protein}%)</p>
                  <p>Fat: <strong>{result.macros[k].fat} g</strong> ({result.macros[k].ratio.fat}%)</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Sample meal plan (maintenance)</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {mealPlan(result.maintenanceCalories).map((m) => (
                <div key={m.meal} className="rounded-md border border-border p-2 text-center">
                  <p className="text-xs text-muted-foreground">{m.meal}</p>
                  <p className="text-base font-bold">{m.kcal}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export calorie table CSV</p>
              <div className="flex gap-2">
                <CopyButton getText={() => calorieTableCsv({ age: Number(age), sex, height: Number(height), weight: Number(weight), unitSystem: unit })} />
                <DownloadButton getText={() => calorieTableCsv({ age: Number(age), sex, height: Number(height), weight: Number(weight), unitSystem: unit })} filename="calorie-table.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
