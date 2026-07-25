"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { calculateMolarity, solveForMoles, solveForVolume, massToMoles } from "./logic";

type SolveMode = "molarity" | "moles" | "volume";

export default function MolarityCalc() {
  const [mode, setMode] = useState<SolveMode>("molarity");
  const [moles, setMoles] = useState("1");
  const [volume, setVolume] = useState("1");
  const [molarity, setMolarity] = useState("1");
  const [mass, setMass] = useState("18");
  const [molarMass, setMolarMass] = useState("18.015");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);
    let r: number | { error: string };
    if (mode === "molarity") {
      r = calculateMolarity({ moles: Number(moles), volume: Number(volume) });
      if ("error" in r) { setError(r.error); setResult(null); return; }
      setResult(`${r.molarity} ${r.unit}\n${r.explanation}`);
    } else if (mode === "moles") {
      r = solveForMoles(Number(molarity), Number(volume));
      if (typeof r === "object") { setError(r.error); setResult(null); return; }
      setResult(`${r} mol\nMoles = M × V = ${molarity} M × ${volume} L = ${r} mol`);
    } else {
      r = solveForVolume(Number(molarity), Number(moles));
      if (typeof r === "object") { setError(r.error); setResult(null); return; }
      setResult(`${r} L\nVolume = n / M = ${moles} mol / ${molarity} M = ${r} L`);
    }
  }, [mode, moles, volume, molarity]);

  const calcMolesFromMass = useCallback(() => {
    setError(null);
    const r = massToMoles(Number(mass), Number(molarMass));
    if (typeof r === "object") { setError(r.error); return; }
    setMoles(String(r));
  }, [mass, molarMass]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "molarity" ? "default" : "outline"} onClick={() => setMode("molarity")}>Solve M</Button>
            <Button size="sm" variant={mode === "moles" ? "default" : "outline"} onClick={() => setMode("moles")}>Solve n</Button>
            <Button size="sm" variant={mode === "volume" ? "default" : "outline"} onClick={() => setMode("volume")}>Solve V</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode !== "moles" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Moles (mol)</Label>
                <Input type="number" step="any" min="0" value={moles} onChange={(e) => setMoles(e.target.value)} />
              </div>
            )}
            {mode !== "volume" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Volume (L)</Label>
                <Input type="number" step="any" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} />
              </div>
            )}
            {mode !== "molarity" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Molarity (M)</Label>
                <Input type="number" step="any" min="0" value={molarity} onChange={(e) => setMolarity(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMoles("1"); setVolume("1"); setMolarity("1"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Mass → Moles helper</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Mass (g)</Label>
              <Input type="number" step="any" min="0" value={mass} onChange={(e) => setMass(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Molar mass (g/mol)</Label>
              <Input type="number" step="any" min="0" value={molarMass} onChange={(e) => setMolarMass(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={calcMolesFromMass}>Compute moles</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Result</CardTitle>
              <CopyButton getText={() => result} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-sm font-mono whitespace-pre-wrap">{result}</pre>
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
