"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateMolarity,
  solveForMoles,
  solveForVolume,
  massToMoles,
  molesToMass,
  calculateDilution,
  formatValue,
  historyToCsv,
  COMMON_MOLAR_MASSES,
  VOLUME_UNITS,
  AMOUNT_UNITS,
  type SolveMode,
  type VolumeUnit,
  type AmountUnit,
  type HistoryEntry,
} from "./logic";

export default function MolarityCalc() {
  const [mode, setMode] = useState<SolveMode>("molarity");
  const [moles, setMoles] = useState("1");
  const [volume, setVolume] = useState("1");
  const [molarity, setMolarity] = useState("1");
  const [mass, setMass] = useState("18");
  const [molarMass, setMolarMass] = useState("18.015");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("L");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("mol");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Dilution
  const [c1, setC1] = useState("10");
  const [v1, setV1] = useState("5");
  const [c2, setC2] = useState("2");
  const [v2, setV2] = useState("");
  const [dilutionResult, setDilutionResult] = useState<ReturnType<typeof calculateDilution> | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("molarity-history");
      if (s) setHistory(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    setError(null);
    let r: number | { error: string };
    let display = "";
    if (mode === "molarity") {
      const res = calculateMolarity({ moles: Number(moles), volume: Number(volume), volumeUnit, amountUnit });
      if ("error" in res) { setError(res.error); setResult(null); return; }
      display = `${res.molarity} ${res.unit}\n${res.explanation}`;
    } else if (mode === "moles") {
      r = solveForMoles(Number(molarity), Number(volume), volumeUnit, amountUnit);
      if (typeof r === "object") { setError(r.error); setResult(null); return; }
      display = `${r} ${amountUnit}\nMoles = M × V = ${molarity} M × ${volume} ${volumeUnit} = ${r} ${amountUnit}`;
    } else {
      r = solveForVolume(Number(molarity), Number(moles), amountUnit, volumeUnit);
      if (typeof r === "object") { setError(r.error); setResult(null); return; }
      display = `${r} ${volumeUnit}\nVolume = n / M = ${moles} ${amountUnit} / ${molarity} M = ${r} ${volumeUnit}`;
    }
    setResult(display);
    const next = [{ ts: Date.now(), mode, result: display }, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem("molarity-history", JSON.stringify(next)); } catch { /* ignore */ }
  }, [mode, moles, volume, molarity, volumeUnit, amountUnit, history]);

  const runMassToMoles = useCallback(() => {
    setError(null);
    const r = massToMoles(Number(mass), Number(molarMass));
    if (typeof r === "object") { setError(r.error); return; }
    setMoles(String(r));
  }, [mass, molarMass]);

  const runMolesToMass = useCallback(() => {
    setError(null);
    const r = molesToMass(Number(moles), Number(molarMass));
    if (typeof r === "object") { setError(r.error); return; }
    setMass(String(r));
  }, [moles, molarMass]);

  const runDilution = useCallback(() => {
    setError(null);
    const r = calculateDilution({
      c1: Number(c1),
      v1: Number(v1),
      c2: Number(c2),
      v2: v2 ? Number(v2) : undefined,
    });
    if ("error" in r) { setError(r.error); setDilutionResult(null); return; }
    setDilutionResult(r);
  }, [c1, v1, c2, v2]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "molarity" ? "default" : "outline"} onClick={() => setMode("molarity")}>Solve M</Button>
            <Button size="sm" variant={mode === "moles" ? "default" : "outline"} onClick={() => setMode("moles")}>Solve n</Button>
            <Button size="sm" variant={mode === "volume" ? "default" : "outline"} onClick={() => setMode("volume")}>Solve V</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mode !== "moles" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Amount (n)</Label>
                <Input type="number" step="any" min="0" value={moles} onChange={(e) => setMoles(e.target.value)} />
                <select className="h-8 rounded-md border px-2 text-xs" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value as AmountUnit)}>
                  {AMOUNT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            )}
            {mode !== "volume" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Volume (V)</Label>
                <Input type="number" step="any" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} />
                <select className="h-8 rounded-md border px-2 text-xs" value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}>
                  {VOLUME_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            )}
            {mode !== "molarity" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Molarity (M)</Label>
                <Input type="number" step="any" min="0" value={molarity} onChange={(e) => setMolarity(e.target.value)} />
                <Badge variant="outline" className="mt-1 justify-center">mol/L</Badge>
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
        <CardHeader className="pb-3"><CardTitle className="text-sm">Mass ↔ Moles helper</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Mass (g)</Label>
              <Input type="number" step="any" min="0" value={mass} onChange={(e) => setMass(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Molar mass (g/mol)</Label>
              <Input type="number" step="any" min="0" value={molarMass} onChange={(e) => setMolarMass(e.target.value)} list="molar-mass-list" />
              <datalist id="molar-mass-list">
                {Object.entries(COMMON_MOLAR_MASSES).map(([name, value]) => (
                  <option key={name} value={value}>{name}</option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={runMassToMoles}>→ Moles</Button>
            <Button size="sm" onClick={runMolesToMass}>→ Mass</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Dilution helper (C₁V₁ = C₂V₂)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">C₁ (M)</Label><Input type="number" value={c1} onChange={(e) => setC1(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">V₁</Label><Input type="number" value={v1} onChange={(e) => setV1(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">C₂ (M)</Label><Input type="number" value={c2} onChange={(e) => setC2(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">V₂ (optional)</Label><Input type="number" value={v2} onChange={(e) => setV2(e.target.value)} placeholder="auto" /></div>
          </div>
          <Button size="sm" onClick={runDilution}>Compute dilution</Button>
          {dilutionResult && !("error" in dilutionResult) && (
            <p className="text-sm font-mono">{dilutionResult.explanation}</p>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Result</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result} />
                <DownloadButton getText={() => result} filename="molarity-result.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-sm font-mono whitespace-pre-wrap">{result}</pre>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History ({history.length})</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="molarity-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("molarity-history"); } catch { /* ignore */ } }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.slice(0, 6).map((h, i) => (
                <li key={i} className="p-2 flex items-center gap-2">
                  <Badge variant="outline">{h.mode}</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="font-mono flex-1 truncate">{h.result.split("\n")[0]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser. History stored in localStorage only.</p>
        </CardContent>
      </Card>
    </div>
  );
}
