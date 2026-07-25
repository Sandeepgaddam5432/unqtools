"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateEnzymeActivity, specificActivity, turnoverNumber,
  michaelisMenten, lineweaverBurk, unitsToKatal, umlToUl,
  batchCalculate, batchToCsv, fmt,
} from "./logic";

export default function EnzymeActivityCalc() {
  const [deltaA, setDeltaA] = useState("0.1");
  const [deltaTime, setDeltaTime] = useState("1");
  const [totalVolume, setTotalVolume] = useState("1");
  const [extinction, setExtinction] = useState("6220");
  const [pathLength, setPathLength] = useState("1");
  const [sampleVolume, setSampleVolume] = useState("0.1");
  const [concentration, setConcentration] = useState("1");
  const [vmax, setVmax] = useState("100");
  const [km, setKm] = useState("10");
  const [substrate, setSubstrate] = useState("10");
  const [enzymeMolar, setEnzymeMolar] = useState("1e-6");
  const [batch, setBatch] = useState("0.1,1,1,6220,1,0.1\n0.2,1,1,6220,1,0.1");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const r = calculateEnzymeActivity({
      deltaA: Number(deltaA), deltaTime: Number(deltaTime),
      totalVolume: Number(totalVolume), extinction: Number(extinction),
      pathLength: Number(pathLength), sampleVolume: Number(sampleVolume),
    });
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [deltaA, deltaTime, totalVolume, extinction, pathLength, sampleVolume]);

  const specific = useMemo(() => {
    if (!result) return null;
    const sa = specificActivity(result.activityUml, Number(concentration));
    return typeof sa === "number" ? sa : null;
  }, [result, concentration]);

  const kcat = useMemo(() => {
    const k = turnoverNumber(Number(vmax), Number(enzymeMolar));
    return typeof k === "number" ? k : null;
  }, [vmax, enzymeMolar]);

  const mmRate = useMemo(() => {
    const v = michaelisMenten(Number(vmax), Number(km), Number(substrate));
    return typeof v === "number" ? v : null;
  }, [vmax, km, substrate]);

  const lb = useMemo(() => {
    const pts = lineweaverBurk(Number(vmax), Number(km), [2, 5, 10, 20, 50]);
    return Array.isArray(pts) ? pts : [];
  }, [vmax, km]);

  const batchResult = useMemo(() => {
    const rows = batch.split("\n").map((l) => l.trim()).filter(Boolean);
    const inputs = rows.map((line) => {
      const [da, dt, tv, ex, pl, sv] = line.split(",").map((x) => Number(x));
      return {
        deltaA: da ?? 0, deltaTime: dt ?? 0, totalVolume: tv ?? 0,
        extinction: ex ?? 0, pathLength: pl ?? 0, sampleVolume: sv ?? 0,
        precision: 4,
      };
    });
    return batchCalculate(inputs);
  }, [batch]);

  const csv = useMemo(() => {
    if (!result) return "";
    const lines = [
      "Field,Value",
      `U/mL,${result.activityUml}`,
      `U/L,${result.activityUL}`,
      `Katal,${unitsToKatal(result.activityUml).toExponential(4)}`,
    ];
    if (specific !== null) lines.push(`Specific activity (U/mg),${specific}`);
    if (kcat !== null) lines.push(`kcat (s⁻¹),${kcat}`);
    if (mmRate !== null) lines.push(`MM rate,${mmRate}`);
    return lines.join("\n");
  }, [result, specific, kcat, mmRate]);

  const fullCsv = csv + "\n\n" + batchToCsv(batchResult);

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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDeltaA("0.1"); setDeltaTime("1"); setTotalVolume("1"); setExtinction("6220"); setPathLength("1"); setSampleVolume("0.1"); setConcentration("1"); }}>Load sample</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => fullCsv} filename="enzyme-activity.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Activity result</CardTitle>
              <Badge variant="outline">U/mL</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <p className="text-2xl font-bold text-primary">{result.activityUml} U/mL</p>
            <p className="text-sm">{result.activityUL} U/L · katal: {unitsToKatal(result.activityUml).toExponential(3)}</p>
            {specific !== null && <p className="text-sm">Specific activity: <span className="font-mono">{specific}</span> U/mg</p>}
            <p className="text-xs text-muted-foreground mt-2">{result.explanation}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Turnover number kcat</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>Vmax (U/mL)<Input value={vmax} onChange={(e) => setVmax(e.target.value)} className="h-8" /></label>
            <label>[E] (M)<Input value={enzymeMolar} onChange={(e) => setEnzymeMolar(e.target.value)} className="h-8" /></label>
          </div>
          <p className="text-sm font-mono">kcat = {kcat !== null ? fmt(kcat) : "—"} s⁻¹</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Michaelis-Menten</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label>Vmax<Input value={vmax} onChange={(e) => setVmax(e.target.value)} className="h-8" /></label>
            <label>Km<Input value={km} onChange={(e) => setKm(e.target.value)} className="h-8" /></label>
            <label>[S]<Input value={substrate} onChange={(e) => setSubstrate(e.target.value)} className="h-8" /></label>
          </div>
          <p className="text-sm font-mono">v = {mmRate !== null ? fmt(mmRate) : "—"}</p>
        </CardContent></Card>
      </div>

      {lb.length > 0 && (
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Lineweaver-Burk (1/[S] vs 1/v)</p>
          <pre className="text-xs font-mono bg-muted/40 p-2 rounded-md">{lb.map((p) => `1/[S]=${p.invS}  1/v=${p.invV}`).join("\n")}</pre>
        </CardContent></Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Batch (ΔA,Δt,V,ε,l,v per line)</Label>
            {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
          </div>
          <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
          {batchResult.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {batchResult.map((r) => (
                <div key={r.i} className="rounded-md border p-2 text-xs">
                  <p className="text-muted-foreground">#{r.i + 1}</p>
                  <p className="font-mono">{"error" in r.result ? "err" : `${r.result.activityUml} U/mL`}</p>
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
