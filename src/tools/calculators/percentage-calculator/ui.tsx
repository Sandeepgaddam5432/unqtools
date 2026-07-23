"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { calculatePercent, calculateCompoundPercent, fractionToPercent, historyToCsv, type PercentMode } from "./logic";

const MODES: { value: PercentMode; label: string; aLabel: string; bLabel: string }[] = [
  { value: "of", label: "X% of Y", aLabel: "Percent (X)", bLabel: "Value (Y)" },
  { value: "isWhatPercent", label: "X is what % of Y", aLabel: "Part (X)", bLabel: "Whole (Y)" },
  { value: "change", label: "% change A→B", aLabel: "Old (A)", bLabel: "New (B)" },
  { value: "ofTotal", label: "X is % of (X+Y)", aLabel: "Part (X)", bLabel: "Other (Y)" },
  { value: "reverse", label: "Reverse % (find original)", aLabel: "Final value", bLabel: "Percent change" },
  { value: "error", label: "Percent error", aLabel: "Measured", bLabel: "Accepted" },
];

interface HistoryEntry { mode: string; explanation: string; result: number; ts: number; }

export default function PercentageCalculator() {
  const [mode, setMode] = useState<PercentMode>("of");
  const [a, setA] = useState("20");
  const [b, setB] = useState("80");
  const [precision, setPrecision] = useState("2");
  const [result, setResult] = useState<ReturnType<typeof calculatePercent> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fracNum, setFracNum] = useState("1");
  const [fracDen, setFracDen] = useState("4");
  const [fracResult, setFracResult] = useState<number | null>(null);
  const [compoundInitial, setCompoundInitial] = useState("100");
  const [compoundChanges, setCompoundChanges] = useState("10, -5, 20");
  const [compoundResult, setCompoundResult] = useState<ReturnType<typeof calculateCompoundPercent> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("percent-calc-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    const r = calculatePercent({ mode, a: Number(a), b: Number(b), precision: Number(precision) });
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
      const entry: HistoryEntry = { mode, explanation: r.explanation, result: r.result, ts: Date.now() };
      const newHistory = [entry, ...history].slice(0, 10);
      setHistory(newHistory);
      try { localStorage.setItem("percent-calc-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
    }
  }, [mode, a, b, precision, history]);

  const runFraction = useCallback(() => {
    const r = fractionToPercent(Number(fracNum), Number(fracDen), Number(precision));
    if (typeof r === "number") {
      setFracResult(r);
      setError(null);
    } else {
      setError(r.error);
      setFracResult(null);
    }
  }, [fracNum, fracDen, precision]);

  const runCompound = useCallback(() => {
    const changes = compoundChanges.split(/[,\s]+/).filter(Boolean).map(Number);
    const r = calculateCompoundPercent({ initial: Number(compoundInitial), changes, precision: Number(precision) });
    if ("error" in r) {
      setError(r.error);
      setCompoundResult(null);
    } else {
      setCompoundResult(r);
      setError(null);
    }
  }, [compoundInitial, compoundChanges, precision]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem("percent-calc-history"); } catch { /* ignore */ }
  }, []);

  const currentMode = MODES.find((m) => m.value === mode)!;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button key={m.value} size="sm" variant={mode === m.value ? "default" : "outline"} onClick={() => setMode(m.value)}>
                {m.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{currentMode.aLabel}</Label>
              <Input type="number" aria-label={currentMode.aLabel} value={a} onChange={(e) => setA(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{currentMode.bLabel}</Label>
              <Input type="number" aria-label={currentMode.bLabel} value={b} onChange={(e) => setB(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Decimal precision (0-6)</Label>
              <Input type="number" min="0" max="6" aria-label="Precision" value={precision} onChange={(e) => setPrecision(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setA("20"); setB("80"); setMode("of"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Result</p>
              <p className="text-3xl font-bold text-primary">{result.result}</p>
              <p className="text-sm text-muted-foreground mt-1">{result.explanation}</p>
            </div>
            <CopyButton getText={() => String(result.result)} label="Copy result" />
          </CardContent>
        </Card>
      )}

      {/* Compound percent change */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Compound percent change (chained)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Initial value</Label>
              <Input type="number" value={compoundInitial} onChange={(e) => setCompoundInitial(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Changes (comma-separated %)</Label>
              <Input value={compoundChanges} onChange={(e) => setCompoundChanges(e.target.value)} placeholder="10, -5, 20" />
            </div>
          </div>
          <Button size="sm" onClick={runCompound}>Compute compound</Button>
          {compoundResult && !("error" in compoundResult) && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline">Final: {compoundResult.finalValue}</Badge>
                <Badge variant="outline">Total change: {compoundResult.totalChangePct}%</Badge>
                <Badge variant="outline">Multiplier: {compoundResult.multiplier}x</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80">
                    <tr><th className="p-2 text-left">#</th><th className="p-2 text-right">Change %</th><th className="p-2 text-right">Before</th><th className="p-2 text-right">After</th><th className="p-2 text-right">Cumulative</th></tr>
                  </thead>
                  <tbody>
                    {compoundResult.steps.map((s, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 text-right font-mono">{s.change}</td>
                        <td className="p-2 text-right font-mono">{s.valueBefore}</td>
                        <td className="p-2 text-right font-mono">{s.valueAfter}</td>
                        <td className="p-2 text-right font-mono">{s.cumulativeChange}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fraction to percent */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Fraction to percent</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Numerator</Label>
              <Input type="number" value={fracNum} onChange={(e) => setFracNum(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Denominator</Label>
              <Input type="number" value={fracDen} onChange={(e) => setFracDen(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={runFraction}>Convert</Button>
          {fracResult !== null && (
            <p className="text-sm"><strong>{fracNum}/{fracDen}</strong> = <strong className="text-primary">{fracResult}%</strong></p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="percent-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={clearHistory}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="flex-1">{h.explanation}</span>
                  <Badge variant="outline">{h.result}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. History is stored only in your browser (localStorage).</p>
        </CardContent>
      </Card>
    </div>
  );
}
