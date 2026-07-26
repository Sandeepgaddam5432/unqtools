"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateConcentration, validateInput, dilutionV1, dilutionC2,
  batchCalculate, batchToCsv, fmt, gramsToMoles, molesToGrams,
  convertVolume, convertMass, VOLUME_TO_L, MASS_TO_KG,
  type ConcentrationMode,
} from "./logic";

const MODES: { value: ConcentrationMode; label: string; description: string }[] = [
  { value: "molarity", label: "Molarity (M)", description: "mol / L" },
  { value: "molality", label: "Molality (m)", description: "mol / kg" },
  { value: "normality", label: "Normality (N)", description: "(mol × eq) / L" },
  { value: "massPercent", label: "Mass %", description: "(g solute / g solution) × 100" },
];

export default function ConcentrationCalc() {
  const [mode, setMode] = useState<ConcentrationMode>("molarity");
  const [moles, setMoles] = useState("1");
  const [volume, setVolume] = useState("1");
  const [mass, setMass] = useState("1");
  const [equivalents, setEquivalents] = useState("1");
  const [soluteMass, setSoluteMass] = useState("25");
  const [solutionMass, setSolutionMass] = useState("100");
  const [volUnit, setVolUnit] = useState("L");
  const [massUnit, setMassUnit] = useState("kg");
  const [molarMass, setMolarMass] = useState("58.44");
  const [batch, setBatch] = useState("2,1\n0.5,2\n1,1");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    queueMicrotask(() => setError(null));
    const volL = convertVolume(Number(volume), volUnit, "L");
    const massKg = convertMass(Number(mass), massUnit, "kg");
    if (typeof volL !== "number" || typeof massKg !== "number") {
      queueMicrotask(() => setError("Unit conversion error"));
      return null;
    }
    const input = {
      mode, moles: Number(moles), volume: volL, mass: massKg,
      equivalents: Number(equivalents),
      soluteMass: Number(soluteMass), solutionMass: Number(solutionMass),
      precision: 4,
    };
    const v = validateInput(input);
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    const r = calculateConcentration(input);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    return r;
  }, [mode, moles, volume, mass, equivalents, soluteMass, solutionMass, volUnit, massUnit]);

  const dil = useMemo(() => {
    const v1 = dilutionV1(10, 1, 100);
    const c2 = dilutionC2(10, 10, 100);
    return { v1, c2 };
  }, []);

  const batchResult = useMemo(() => {
    const rows = batch.split("\n").map((line) => line.trim()).filter(Boolean);
    const inputs = rows.map((line) => {
      const [mStr, vStr] = line.split(",");
      return {
        mode: "molarity" as const,
        moles: Number(mStr ?? 0), volume: Number(vStr ?? 0),
        mass: 0, equivalents: 1, soluteMass: 0, solutionMass: 0,
        precision: 4,
      };
    });
    return batchCalculate(inputs);
  }, [batch]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Mode,${result.mode}`,
      `Result,${result.result}`,
      `Unit,${result.unit}`,
      `Explanation,"${result.explanation.replace(/"/g, "'")}"`,
    ].join("\n");
  }, [result]);

  const gramsOut = useMemo(() => {
    const g = gramsToMoles(Number(soluteMass), Number(molarMass));
    const m = molesToGrams(Number(moles), Number(molarMass));
    return { g, m };
  }, [soluteMass, molarMass, moles]);

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
                <Label className="text-xs text-muted-foreground">Volume of solution</Label>
                <div className="flex gap-2">
                  <Input type="number" step="any" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} />
                  <select value={volUnit} onChange={(e) => setVolUnit(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                    {Object.keys(VOLUME_TO_L).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
            {mode === "molality" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mass of solvent</Label>
                <div className="flex gap-2">
                  <Input type="number" step="any" min="0" value={mass} onChange={(e) => setMass(e.target.value)} />
                  <select value={massUnit} onChange={(e) => setMassUnit(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                    {Object.keys(MASS_TO_KG).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
            {mode === "normality" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Equivalents per mole</Label>
                <Input type="number" step="any" min="1" value={equivalents} onChange={(e) => setEquivalents(e.target.value)} />
              </div>
            )}
            {mode === "massPercent" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Solute mass (g)</Label>
                  <Input type="number" step="any" min="0" value={soluteMass} onChange={(e) => setSoluteMass(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Solution mass (g)</Label>
                  <Input type="number" step="any" min="0" value={solutionMass} onChange={(e) => setSolutionMass(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setMoles("2"); setVolume("1"); setMass("1"); setEquivalents("2"); setSoluteMass("25"); setSolutionMass("100"); }}>Load sample</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => csv + "\n\n" + batchToCsv(batchResult)} filename="concentration.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Result ({result.unit})</CardTitle>
              <Badge variant="outline">{result.mode}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-bold text-primary">{result.result}</p>
            <p className="text-sm text-muted-foreground mt-1">{result.explanation}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Dilution helper (C1=10M, C2=1M, V2=100mL)</p>
          <p className="text-sm">V1 = <span className="font-mono">{typeof dil.v1 === "number" ? fmt(dil.v1) : "—"}</span> mL</p>
          <p className="text-sm">C2 from V1=10 → <span className="font-mono">{typeof dil.c2 === "number" ? fmt(dil.c2) : "—"}</span> M</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Molar mass helper (M = {molarMass} g/mol)</p>
          <div className="flex gap-2 items-center">
            <Input value={molarMass} onChange={(e) => setMolarMass(e.target.value)} className="h-8 w-24" />
            <p className="text-xs">{soluteMass} g → <span className="font-mono">{typeof gramsOut.g === "number" ? fmt(gramsOut.g, 4) : "—"}</span> mol</p>
          </div>
          <p className="text-xs">{moles} mol → <span className="font-mono">{typeof gramsOut.m === "number" ? fmt(gramsOut.m, 4) : "—"}</span> g</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Batch (moles,volume_L per line)</Label>
            {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
          </div>
          <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
          {batchResult.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {batchResult.map((r) => (
                <div key={r.i} className="rounded-md border p-2 text-xs">
                  <p className="text-muted-foreground">#{r.i + 1}</p>
                  <p className="font-mono">{"error" in r.result ? "err" : `${r.result.result} ${r.result.unit}`}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p>
      </CardContent></Card>
    </div>
  );
}
