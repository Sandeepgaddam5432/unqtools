"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { calculateEnzymeActivity, specificActivity } from "./logic";

export default function EnzymeActivityCalc() {
  const [deltaA, setDeltaA] = useState("0.1");
  const [deltaTime, setDeltaTime] = useState("1");
  const [totalVolume, setTotalVolume] = useState("1");
  const [extinction, setExtinction] = useState("6220");
  const [pathLength, setPathLength] = useState("1");
  const [sampleVolume, setSampleVolume] = useState("0.1");
  const [concentration, setConcentration] = useState("1");
  const [result, setResult] = useState<ReturnType<typeof calculateEnzymeActivity> | null>(null);
  const [specific, setSpecific] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);
    const input = {
      deltaA: Number(deltaA), deltaTime: Number(deltaTime), totalVolume: Number(totalVolume),
      extinction: Number(extinction), pathLength: Number(pathLength), sampleVolume: Number(sampleVolume),
    };
    const r = calculateEnzymeActivity(input);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setResult(r);
    const sa = specificActivity(r.activityUml, Number(concentration));
    setSpecific(typeof sa === "number" ? sa : null);
  }, [deltaA, deltaTime, totalVolume, extinction, pathLength, sampleVolume, concentration]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">ΔA (absorbance change)</Label>
              <Input type="number" step="any" value={deltaA} onChange={(e) => setDeltaA(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Δt (min)</Label>
              <Input type="number" step="any" min="0" value={deltaTime} onChange={(e) => setDeltaTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Total assay volume (mL)</Label>
              <Input type="number" step="any" min="0" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Extinction coefficient ε (M⁻¹·cm⁻¹)</Label>
              <Input type="number" step="any" min="0" value={extinction} onChange={(e) => setExtinction(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Path length l (cm)</Label>
              <Input type="number" step="any" min="0" value={pathLength} onChange={(e) => setPathLength(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sample volume v (mL)</Label>
              <Input type="number" step="any" min="0" value={sampleVolume} onChange={(e) => setSampleVolume(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Enzyme concentration (mg/mL)</Label>
              <Input type="number" step="any" min="0" value={concentration} onChange={(e) => setConcentration(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDeltaA("0.1"); setDeltaTime("1"); setTotalVolume("1"); setExtinction("6220"); setPathLength("1"); setSampleVolume("0.1"); setConcentration("1"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); setSpecific(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Result</CardTitle>
              <CopyButton getText={() => String(result.activityUml)} label="Copy U/mL" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <p className="text-2xl font-bold text-primary">{result.activityUml} U/mL</p>
            <p className="text-sm">{result.activityUL} U/L</p>
            {specific !== null && <p className="text-sm">Specific activity: {specific} U/mg</p>}
            <p className="text-xs text-muted-foreground mt-2">{result.explanation}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p>
        </CardContent>
      </Card>
    </div>
  );
}
