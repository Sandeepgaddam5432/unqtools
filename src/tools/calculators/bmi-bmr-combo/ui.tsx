"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { compute, validateInput, ACTIVITY_MULTIPLIERS, type Sex, type ActivityLevel } from "./logic";

export default function BmiBmrCombo() {
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(175);
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<Sex>("male");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const input = { weightKg, heightCm, ageYears: age, sex, activity };
    const v = validateInput(input);
    if ("error" in v) { setError(v.error); return null; }
    setError(null);
    return compute(input);
  }, [weightKg, heightCm, age, sex, activity]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><Label className="text-xs text-muted-foreground">Weight (kg)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Height (cm)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Age</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={age} onChange={(e) => setAge(Number(e.target.value))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground">Sex</Label>
              <select className="w-full rounded-md border px-2 py-1 text-sm" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((a) => (
              <Button key={a} size="sm" variant={activity === a ? "default" : "outline"} onClick={() => setActivity(a)}>{a}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Results</p>
              <div className="flex gap-2">
                <CopyButton getText={() => JSON.stringify(result, null, 2)} />
                <DownloadButton getText={() => JSON.stringify(result, null, 2)} filename="bmi-bmr.json" />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">BMI</td><td className="py-1.5 text-right font-mono">{result.bmi.toFixed(2)} ({result.bmiCategory})</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">BMR (Mifflin-St Jeor)</td><td className="py-1.5 text-right font-mono">{result.bmr.toFixed(0)} kcal</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">TDEE</td><td className="py-1.5 text-right font-mono">{result.tdee.toFixed(0)} kcal</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Maintain weight</td><td className="py-1.5 text-right font-mono">{result.maintain.toFixed(0)} kcal/day</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Lose 0.5 kg/week</td><td className="py-1.5 text-right font-mono">{result.loseHalfKg.toFixed(0)} kcal/day</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Gain 0.5 kg/week</td><td className="py-1.5 text-right font-mono">{result.gainHalfKg.toFixed(0)} kcal/day</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
