"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  compute, validateInput, ACTIVITY_MULTIPLIERS, ACTIVITY_DESCRIPTIONS,
  lbToKg, kgToLb, ftInToCm, fmt,
  type Sex, type ActivityLevel, type UnitSystem,
} from "./logic";

export default function BmiBmrCombo() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [weightDisplay, setWeightDisplay] = useState("70");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("9");
  const [heightCm, setHeightCm] = useState("175");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState<Sex>("male");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [proteinPct, setProteinPct] = useState("30");
  const [carbPct, setCarbPct] = useState("40");
  const [fatPct, setFatPct] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const weightKg = useMemo(() => {
    const v = Number(weightDisplay);
    return unitSystem === "imperial" ? lbToKg(v) : v;
  }, [weightDisplay, unitSystem]);

  const heightCmVal = useMemo(() => {
    if (unitSystem === "imperial") return ftInToCm(Number(heightFt), Number(heightIn));
    return Number(heightCm);
  }, [unitSystem, heightFt, heightIn, heightCm]);

  const result = useMemo(() => {
    const input = { weightKg, heightCm: heightCmVal, ageYears: Number(age), sex, activity };
    const v = validateInput(input);
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    queueMicrotask(() => setError(null));
    try {
      const r = compute(input);
      // Recompute macros with custom percentages
      const total = r.tdee;
      const p = Number(proteinPct) / 100;
      const c = Number(carbPct) / 100;
      const f = Number(fatPct) / 100;
      if (Math.abs(p + c + f - 1) > 0.01) {
        return r;
      }
      return { ...r, macros: { protein: { grams: (total * p) / 4, kcal: total * p }, carbs: { grams: (total * c) / 4, kcal: total * c }, fat: { grams: (total * f) / 9, kcal: total * f } } };
    } catch (e) {
      queueMicrotask(() => setError((e as Error).message));
      return null;
    }
  }, [weightKg, heightCmVal, age, sex, activity, proteinPct, carbPct, fatPct]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `BMI,${fmt(result.bmi, 2)}`,
      `BMI category,${result.bmiCategory}`,
      `BMR (Mifflin),${fmt(result.bmr, 0)}`,
      `BMR (Harris),${fmt(result.bmrHarris, 0)}`,
      `TDEE,${fmt(result.tdee, 0)}`,
      `Maintain,${fmt(result.maintain, 0)}`,
      `Lose 0.5kg/wk,${fmt(result.loseHalfKg, 0)}`,
      `Gain 0.5kg/wk,${fmt(result.gainHalfKg, 0)}`,
      `Ideal weight,${fmt(result.idealWeightKg, 1)} kg`,
      `Protein,${fmt(result.macros.protein.grams, 0)} g`,
      `Carbs,${fmt(result.macros.carbs.grams, 0)} g`,
      `Fat,${fmt(result.macros.fat.grams, 0)} g`,
    ].join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={unitSystem === "metric" ? "default" : "outline"} onClick={() => setUnitSystem("metric")}>Metric</Button>
            <Button size="sm" variant={unitSystem === "imperial" ? "default" : "outline"} onClick={() => setUnitSystem("imperial")}>Imperial</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Weight ({unitSystem === "imperial" ? "lb" : "kg"})</Label>
              <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={weightDisplay} onChange={(e) => setWeightDisplay(e.target.value)} />
            </div>
            {unitSystem === "metric" ? (
              <div>
                <Label className="text-xs text-muted-foreground">Height (cm)</Label>
                <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Height (ft)</Label>
                  <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Height (in)</Label>
                  <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Age</Label>
              <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sex</Label>
              <select className="w-full rounded-md border px-2 py-1 text-sm" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Activity level</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((a) => (
                <Button key={a} size="sm" variant={activity === a ? "default" : "outline"} onClick={() => setActivity(a)} title={ACTIVITY_DESCRIPTIONS[a]}>
                  {a} (×{ACTIVITY_MULTIPLIERS[a]})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Results</p>
              <div className="flex gap-2">
                <CopyButton getText={() => csv} />
                <DownloadButton getText={() => csv} filename="bmi-bmr.csv" mime="text/csv" />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">BMI</td><td className="py-1.5 text-right font-mono">{fmt(result.bmi, 2)} <Badge variant="outline">{result.bmiCategory}</Badge></td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">BMR (Mifflin-St Jeor)</td><td className="py-1.5 text-right font-mono">{fmt(result.bmr, 0)} kcal</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">BMR (Harris-Benedict)</td><td className="py-1.5 text-right font-mono">{fmt(result.bmrHarris, 0)} kcal</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">TDEE ({ACTIVITY_DESCRIPTIONS[activity]})</td><td className="py-1.5 text-right font-mono">{fmt(result.tdee, 0)} kcal</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Maintain weight</td><td className="py-1.5 text-right font-mono">{fmt(result.maintain, 0)} kcal/day</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Lose 0.5 kg/week</td><td className="py-1.5 text-right font-mono">{fmt(result.loseHalfKg, 0)} kcal/day</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Gain 0.5 kg/week</td><td className="py-1.5 text-right font-mono">{fmt(result.gainHalfKg, 0)} kcal/day</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Ideal weight (Devine)</td><td className="py-1.5 text-right font-mono">{fmt(result.idealWeightKg, 1)} kg ({fmt(kgToLb(result.idealWeightKg), 0)} lb)</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Macro split (% must sum to 100)</Label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><Label>Protein %</Label><input value={proteinPct} onChange={(e) => setProteinPct(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
              <div><Label>Carbs %</Label><input value={carbPct} onChange={(e) => setCarbPct(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
              <div><Label>Fat %</Label><input value={fatPct} onChange={(e) => setFatPct(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline">Protein: {fmt(result.macros.protein.grams, 0)} g</Badge>
              <Badge variant="outline">Carbs: {fmt(result.macros.carbs.grams, 0)} g</Badge>
              <Badge variant="outline">Fat: {fmt(result.macros.fat.grams, 0)} g</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
