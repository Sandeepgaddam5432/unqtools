"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { calculateConcentration, validateInput, type ConcentrationMode } from "./logic";

export default function ConcentrationCalc() {
  const [mode, setMode] = useState<ConcentrationMode>("molarity");
  const [moles, setMoles] = useState("1");
  const [volume, setVolume] = useState("1");
  const [mass, setMass] = useState("1");
  const [equivalents, setEquivalents] = useState("1");
  const [result, setResult] = useState<ReturnType<typeof calculateConcentration> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input = {
      mode, moles: Number(moles), volume: Number(volume),
      mass: Number(mass), equivalents: Number(equivalents), precision: 4,
    };
    const v = validateInput(input);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    const r = calculateConcentration(input);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [mode, moles, volume, mass, equivalents]);

  const MODES: { value: ConcentrationMode; label: string; description: string }[] = [
    { value: "molarity", label: "Molarity (M)", description: "mol / L" },
    { value: "molality", label: "Molality (m)", description: "mol / kg" },
    { value: "normality", label: "Normality (N)", description: "(mol × eq) / L" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button key={m.value} size="sm" variant={mode === m.value ? "default" : "outline"} onClick={() => setMode(m.value)} title={m.description}>
                {m.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Moles of solute (mol)</Label>
              <Input type="number" step="any" min="0" value={moles} onChange={(e) => setMoles(e.target.value)} />
            </div>
            {(mode === "molarity" || mode === "normality") && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Volume of solution (L)</Label>
                <Input type="number" step="any" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} />
              </div>
            )}
            {mode === "molality" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mass of solvent (kg)</Label>
                <Input type="number" step="any" min="0" value={mass} onChange={(e) => setMass(e.target.value)} />
              </div>
            )}
            {mode === "normality" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Equivalents per mole</Label>
                <Input type="number" step="any" min="1" value={equivalents} onChange={(e) => setEquivalents(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMoles("1"); setVolume("1"); setMass("1"); setEquivalents("1"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Result ({result.unit})</CardTitle>
              <CopyButton getText={() => String(result.result)} label="Copy" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-bold text-primary">{result.result}</p>
            <p className="text-sm text-muted-foreground mt-1">{result.explanation}</p>
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
