"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { calculateDilution, dilutionFactor, serialDilution, validateInput, type DilutionSolveFor } from "./logic";

export default function DilutionCalc() {
  const [solveFor, setSolveFor] = useState<DilutionSolveFor>("V1");
  const [C1, setC1] = useState("2");
  const [V1, setV1] = useState("0");
  const [C2, setC2] = useState("1");
  const [V2, setV2] = useState("2");
  const [result, setResult] = useState<ReturnType<typeof calculateDilution> | null>(null);
  const [factor, setFactor] = useState("10");
  const [steps, setSteps] = useState("3");
  const [initialConc, setInitialConc] = useState("100");
  const [serial, setSerial] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input = { solveFor, C1: Number(C1), V1: Number(V1), C2: Number(C2), V2: Number(V2) };
    const v = validateInput(input);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    const r = calculateDilution(input);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [solveFor, C1, V1, C2, V2]);

  const computeSerial = useCallback(() => {
    setError(null);
    const r = serialDilution(Number(initialConc), Number(factor), Number(steps));
    if ("error" in r) { setError(r.error); setSerial(null); return; }
    setSerial(r);
  }, [initialConc, factor, steps]);

  const VARS: { value: DilutionSolveFor; label: string }[] = [
    { value: "C1", label: "Solve C1" },
    { value: "V1", label: "Solve V1" },
    { value: "C2", label: "Solve C2" },
    { value: "V2", label: "Solve V2" },
  ];

  const factorResult = (() => {
    const r = dilutionFactor(Number(V1), Number(V2));
    return typeof r === "number" ? r : null;
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {VARS.map((v) => (
              <Button key={v.value} size="sm" variant={solveFor === v.value ? "default" : "outline"} onClick={() => setSolveFor(v.value)}>{v.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">C1 (initial)</Label>
              <Input type="number" step="any" min="0" value={C1} onChange={(e) => setC1(e.target.value)} disabled={solveFor === "C1"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">V1 (initial)</Label>
              <Input type="number" step="any" min="0" value={V1} onChange={(e) => setV1(e.target.value)} disabled={solveFor === "V1"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">C2 (final)</Label>
              <Input type="number" step="any" min="0" value={C2} onChange={(e) => setC2(e.target.value)} disabled={solveFor === "C2"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">V2 (final)</Label>
              <Input type="number" step="any" min="0" value={V2} onChange={(e) => setV2(e.target.value)} disabled={solveFor === "V2"} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setC1("2"); setV1("0"); setC2("1"); setV2("2"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
          {factorResult !== null && <p className="text-xs text-muted-foreground">Dilution factor: {factorResult}×</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Serial dilution</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Initial conc</Label>
              <Input type="number" step="any" min="0" value={initialConc} onChange={(e) => setInitialConc(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Factor</Label>
              <Input type="number" step="any" min="1" value={factor} onChange={(e) => setFactor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Steps</Label>
              <Input type="number" step="1" min="0" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={computeSerial}>Compute</Button>
          {serial && (
            <div className="flex flex-wrap gap-2">
              {serial.map((v, i) => (<span key={i} className="text-xs px-2 py-1 rounded bg-muted font-mono">{v}</span>))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{result.variable} = {result.value}</CardTitle>
              <CopyButton getText={() => String(result.value)} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">{result.explanation}</p>
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
