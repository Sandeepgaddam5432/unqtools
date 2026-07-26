"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculate,
  resultToText,
  tableToCsv,
  FORCE_LABELS,
  MASS_LABELS,
  ACCEL_LABELS,
  type SolveFor,
  type ForceUnit,
  type MassUnit,
  type AccelUnit,
  type AccelForceResult,
} from "./logic";

const FORCE_UNITS: ForceUnit[] = ["N", "kN", "lbf", "dyn", "kgf"];
const MASS_UNITS: MassUnit[] = ["kg", "g", "lb", "slug"];
const ACCEL_UNITS: AccelUnit[] = ["mps2", "g"];

export default function AccelerationForceCalc() {
  const [solveFor, setSolveFor] = useState<SolveFor>("force");
  const [forceValue, setForceValue] = useState("10");
  const [forceUnit, setForceUnit] = useState<ForceUnit>("N");
  const [massValue, setMassValue] = useState("2");
  const [massUnit, setMassUnit] = useState<MassUnit>("kg");
  const [accelValue, setAccelValue] = useState("3");
  const [accelUnit, setAccelUnit] = useState<AccelUnit>("mps2");
  const [result, setResult] = useState<AccelForceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = calculate({
      solveFor,
      force: solveFor !== "force" ? { value: Number(forceValue), unit: forceUnit } : undefined,
      mass: solveFor !== "mass" ? { value: Number(massValue), unit: massUnit } : undefined,
      acceleration: solveFor !== "acceleration" ? { value: Number(accelValue), unit: accelUnit } : undefined,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [solveFor, forceValue, forceUnit, massValue, massUnit, accelValue, accelUnit]);

  const sample = useCallback(() => {
    setSolveFor("force");
    setMassValue("5"); setMassUnit("kg");
    setAccelValue("2"); setAccelUnit("mps2");
  }, []);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Label className="text-xs text-muted-foreground self-center mr-2">Solve for:</Label>
            {(["force", "mass", "acceleration"] as const).map((s) => (
              <Button key={s} size="sm" variant={solveFor === s ? "default" : "outline"} onClick={() => setSolveFor(s)}>{s}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`flex flex-col gap-1.5 ${solveFor === "force" ? "opacity-50 pointer-events-none" : ""}`}>
              <Label className="text-xs text-muted-foreground">Force</Label>
              <Input type="number" value={forceValue} onChange={(e) => setForceValue(e.target.value)} aria-label="Force value" disabled={solveFor === "force"} />
              <div className="flex flex-wrap gap-1">
                {FORCE_UNITS.map((u) => (
                  <Button key={u} size="sm" variant={forceUnit === u ? "default" : "outline"} onClick={() => setForceUnit(u)}>{u}</Button>
                ))}
              </div>
            </div>
            <div className={`flex flex-col gap-1.5 ${solveFor === "mass" ? "opacity-50 pointer-events-none" : ""}`}>
              <Label className="text-xs text-muted-foreground">Mass</Label>
              <Input type="number" value={massValue} onChange={(e) => setMassValue(e.target.value)} aria-label="Mass value" disabled={solveFor === "mass"} />
              <div className="flex flex-wrap gap-1">
                {MASS_UNITS.map((u) => (
                  <Button key={u} size="sm" variant={massUnit === u ? "default" : "outline"} onClick={() => setMassUnit(u)}>{u}</Button>
                ))}
              </div>
            </div>
            <div className={`flex flex-col gap-1.5 ${solveFor === "acceleration" ? "opacity-50 pointer-events-none" : ""}`}>
              <Label className="text-xs text-muted-foreground">Acceleration</Label>
              <Input type="number" value={accelValue} onChange={(e) => setAccelValue(e.target.value)} aria-label="Acceleration value" disabled={solveFor === "acceleration"} />
              <div className="flex flex-wrap gap-1">
                {ACCEL_UNITS.map((u) => (
                  <Button key={u} size="sm" variant={accelUnit === u ? "default" : "outline"} onClick={() => setAccelUnit(u)}>{u === "mps2" ? "m/s²" : u}</Button>
                ))}
              </div>
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
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Solved for: {result.solveFor}</p>
              <p className="text-3xl font-bold text-primary">{result.result.value} <span className="text-base text-muted-foreground">{result.result.unit}</span></p>
              <p className="text-xs text-muted-foreground mt-1">{result.result.label}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">All units</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result.table.map((t) => (
                <div key={t.unit} className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  <p className="text-base font-bold">{t.value.toLocaleString(undefined, { maximumFractionDigits: 6 })} {t.unit}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Canonical SI</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Force</p><p className="font-bold">{result.canonical.forceN} N</p></div>
              <div><p className="text-xs text-muted-foreground">Mass</p><p className="font-bold">{result.canonical.massKg} kg</p></div>
              <div><p className="text-xs text-muted-foreground">Acceleration</p><p className="font-bold">{result.canonical.accelMps2} m/s²</p></div>
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Newton's Laws of Motion</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 text-sm">
              {result.newtonsLawsRef.map((law) => (
                <div key={law.name}>
                  <p className="font-semibold">{law.name}</p>
                  <p className="text-muted-foreground">{law.statement}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export result &amp; table</p>
              <div className="flex gap-2">
                <CopyButton getText={() => resultToText(result)} label="Copy text" />
                <CopyButton getText={() => tableToCsv(result)} label="Copy CSV" />
                <DownloadButton getText={() => tableToCsv(result)} filename="accel-force.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
