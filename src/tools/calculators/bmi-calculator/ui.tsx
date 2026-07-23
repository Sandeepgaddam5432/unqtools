"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateBmi, weightScenariosCsv, type BmiInput, type UnitSystem } from "./logic";

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  red: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export default function BmiCalculator() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [height, setHeight] = useState("170");
  const [weight, setWeight] = useState("70");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [waistCm, setWaistCm] = useState("");
  const [result, setResult] = useState<ReturnType<typeof calculateBmi> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: BmiInput = {
      height: Number(height),
      weight: Number(weight),
      unitSystem,
      age: age ? Number(age) : undefined,
      sex: sex || undefined,
      waistCm: waistCm ? Number(waistCm) : undefined,
    };
    const r = calculateBmi(input);
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [height, weight, unitSystem, age, sex, waistCm]);

  const loadSample = useCallback(() => {
    setUnitSystem("metric");
    setHeight("175");
    setWeight("80");
    setAge("30");
    setSex("male");
    setWaistCm("88");
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const heightLabel = unitSystem === "metric" ? "Height (cm)" : "Height (inches)";
  const weightLabel = unitSystem === "metric" ? "Weight (kg)" : "Weight (lb)";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={unitSystem === "metric" ? "default" : "outline"}
              onClick={() => setUnitSystem("metric")}
            >
              Metric (cm/kg)
            </Button>
            <Button
              size="sm"
              variant={unitSystem === "imperial" ? "default" : "outline"}
              onClick={() => setUnitSystem("imperial")}
            >
              Imperial (in/lb)
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{heightLabel}</Label>
              <Input type="number" aria-label="Height" value={height} onChange={(e) => setHeight(e.target.value)} placeholder={unitSystem === "metric" ? "170" : "67"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{weightLabel}</Label>
              <Input type="number" aria-label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={unitSystem === "metric" ? "70" : "154"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Age (optional)</Label>
              <Input type="number" aria-label="Age" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sex (optional)</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={sex === "male" ? "default" : "outline"} onClick={() => setSex("male")}>Male</Button>
                <Button size="sm" variant={sex === "female" ? "default" : "outline"} onClick={() => setSex("female")}>Female</Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Waist cm (optional)</Label>
              <Input type="number" aria-label="Waist circumference in cm" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} placeholder="85" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={loadSample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Your BMI</p>
                <p className="text-3xl font-bold text-primary">{result.bmi}</p>
                <Badge className={`mt-2 ${COLOR_CLASSES[result.category.color]}`} variant="outline">
                  {result.category.label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Healthy weight</p>
                <p className="text-lg font-bold">
                  {result.healthyWeightRange.min}-{result.healthyWeightRange.max} {result.unitLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-1">BMI 18.5-24.9</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">BMI Prime</p>
                <p className="text-lg font-bold">{result.bmiPrime}</p>
                <p className="text-xs text-muted-foreground mt-1">Ratio to upper normal (25)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Ponderal Index</p>
                <p className="text-lg font-bold">{result.ponderalIndex}</p>
                <p className="text-xs text-muted-foreground mt-1">Corpulence index</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Health risk:</strong> {result.category.risk}
              </p>
              {result.weightDeltaToHealthy && (
                <p className="text-sm text-muted-foreground mt-2">
                  <strong className="text-foreground">To reach healthy range:</strong>{" "}
                  {result.weightDeltaToHealthy.toMin > 0
                    ? `Gain ${Math.abs(result.weightDeltaToHealthy.toMin)} ${result.unitLabel} to reach minimum healthy BMI`
                    : `Lose ${Math.abs(result.weightDeltaToHealthy.toMin)} ${result.unitLabel} to reach maximum healthy BMI`}
                  .
                </p>
              )}
            </CardContent>
          </Card>

          {result.bmr && result.dailyCalories && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Metabolic profile (Mifflin-St Jeor)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">BMR</p>
                    <p className="text-sm font-bold">{result.bmr} kcal</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sedentary</p>
                    <p className="text-sm font-bold">{result.dailyCalories.sedentary}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Light</p>
                    <p className="text-sm font-bold">{result.dailyCalories.light}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Moderate</p>
                    <p className="text-sm font-bold">{result.dailyCalories.moderate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-sm font-bold">{result.dailyCalories.active}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Very Active</p>
                    <p className="text-sm font-bold">{result.dailyCalories.veryActive}</p>
                  </div>
                </div>
                {result.macros && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Maintenance macros (50/30/20): {result.macros.carbs}g carbs, {result.macros.protein}g protein, {result.macros.fat}g fat
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.zScore !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Pediatric BMI z-score (approx)</p>
                  <p className="text-lg font-bold">{result.zScore}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.zScore < -2 ? "Underweight" : result.zScore > 2 ? "Obese" : result.zScore > 1 ? "Overweight" : "Normal"}
                  </p>
                </CardContent>
              </Card>
            )}
            {result.waistToHeight !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Waist-to-height ratio</p>
                  <p className="text-lg font-bold">{result.waistToHeight}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.waistToHeight > 0.5 ? "Above 0.5 — increased cardiometabolic risk" : "Below 0.5 — low risk"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                Body Surface Area: <strong>{result.bodySurfaceArea} m²</strong>
              </p>
              <DownloadButton
                getText={() => weightScenariosCsv({ height: Number(height), weight: Number(weight), unitSystem })}
                filename="bmi-weight-scenarios.csv"
                mime="text/csv"
              />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
            BMI is a screening tool, not a diagnostic of body fat or health — consult a doctor for individual assessment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
