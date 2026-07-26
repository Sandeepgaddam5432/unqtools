"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { convertSteps, stepsTable, targetSteps, type StepsResult, type Sex, type UnitSystem } from "./logic";

export default function StepsToMilesConverter() {
  const [unit, setUnit] = useState<UnitSystem>("metric");
  const [steps, setSteps] = useState("10000");
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("70");
  const [sex, setSex] = useState<Sex>("average");
  const [pace, setPace] = useState("3.0");
  const [target, setTarget] = useState("5");
  const [result, setResult] = useState<StepsResult | null>(null);
  const [targetStepsResult, setTargetStepsResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = convertSteps({
      steps: Number(steps),
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      sex,
      unitSystem: unit,
      paceMph: Number(pace) || 3.0,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
    const t = targetSteps(Number(target), {
      height: height ? Number(height) : undefined,
      sex,
      unitSystem: unit,
    });
    if (typeof t === "number") setTargetStepsResult(t);
  }, [steps, height, weight, sex, unit, pace, target]);

  const sample = useCallback(() => {
    setUnit("metric"); setSteps("10000"); setHeight("175"); setWeight("70"); setSex("male"); setPace("3.0"); setTarget("5");
  }, []);

  const clear = useCallback(() => { setResult(null); setTargetStepsResult(null); setError(null); }, []);

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
              <Label className="text-xs text-muted-foreground">Steps</Label>
              <Input type="number" value={steps} onChange={(e) => setSteps(e.target.value)} aria-label="Steps" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{heightLabel}</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{weightLabel}</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Weight" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pace (mph)</Label>
              <Input type="number" value={pace} onChange={(e) => setPace(e.target.value)} aria-label="Pace" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Label className="text-xs text-muted-foreground self-center mr-2">Sex:</Label>
            {(["male", "female", "average"] as const).map((s) => (
              <Button key={s} size="sm" variant={sex === s ? "default" : "outline"} onClick={() => setSex(s)}>{s}</Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Target distance (miles) — for reverse calculation</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target miles" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Convert</Button>
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
              <p className="text-xs text-muted-foreground">Distance (miles)</p>
              <p className="text-2xl font-bold text-primary">{result.distanceMiles}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Distance (km)</p>
              <p className="text-2xl font-bold">{result.distanceKm}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-2xl font-bold">{result.durationMinutes}<span className="text-sm"> min</span></p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Calories burned</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{result.caloriesBurned}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Stride &amp; auxiliary metrics</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Stride</p><p className="font-bold">{result.strideInches} in / {result.strideCm} cm</p></div>
              <div><p className="text-xs text-muted-foreground">Distance (m)</p><p className="font-bold">{result.distanceMeters.toLocaleString()} m</p></div>
              <div><p className="text-xs text-muted-foreground">Distance (ft)</p><p className="font-bold">{result.distanceFeet.toLocaleString()} ft</p></div>
              <div><p className="text-xs text-muted-foreground">Steps</p><p className="font-bold">{result.steps.toLocaleString()}</p></div>
            </CardContent>
          </Card>

          {targetStepsResult !== null && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Steps to walk {target} miles</p>
                  <p className="text-xl font-bold">{targetStepsResult.toLocaleString()} steps</p>
                </div>
                <Badge variant="secondary">Reverse calc</Badge>
              </CardContent>
            </Card>
          )}

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export step-distance table</p>
              <div className="flex gap-2">
                <CopyButton getText={() => stepsTable({ height: Number(height), weight: Number(weight), sex, unitSystem: unit, paceMph: Number(pace) || 3.0 })} />
                <DownloadButton getText={() => stepsTable({ height: Number(height), weight: Number(weight), sex, unitSystem: unit, paceMph: Number(pace) || 3.0 })} filename="steps-table.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
