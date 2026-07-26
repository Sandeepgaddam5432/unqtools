"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeStats, parseValues, statsToCsv, type StatsResult } from "./logic";

export default function StandardDeviationCalc() {
  const [text, setText] = useState("2, 4, 4, 4, 5, 5, 7, 9");
  const [zThreshold, setZThreshold] = useState("2.5");
  const [iqrMultiplier, setIqrMultiplier] = useState("1.5");
  const [result, setResult] = useState<StatsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const values = parseValues(text);
    if (values.length === 0) { setError("Enter at least one number."); setResult(null); return; }
    const r = computeStats({ values, zThreshold: Number(zThreshold), iqrMultiplier: Number(iqrMultiplier) });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text, zThreshold, iqrMultiplier]);

  const fmt = (n: number, d = 4): string => {
    if (!Number.isFinite(n)) return "NaN";
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(d);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Values (comma / space / newline separated)</Label>
            <textarea
              aria-label="Values input"
              className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Z-score threshold</Label>
              <Input type="number" step="0.1" value={zThreshold} onChange={(e) => setZThreshold(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">IQR multiplier</Label>
              <Input type="number" step="0.1" value={iqrMultiplier} onChange={(e) => setIqrMultiplier(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Compute</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText("2, 4, 4, 4, 5, 5, 7, 9"); setZThreshold("2.5"); setIqrMultiplier("1.5"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">N = {result.count}</Badge>
              <Badge variant="outline">Sum = {fmt(result.sum)}</Badge>
              <Badge variant="outline">Mean = {fmt(result.mean)}</Badge>
              <Badge variant="outline">Median = {fmt(result.median)}</Badge>
              {result.modes.length > 0 && <Badge variant="outline">Mode(s) = {result.modes.join(", ")}</Badge>}
              <CopyButton getText={() => statsToCsv(result)} label="Copy CSV" />
              <DownloadButton getText={() => statsToCsv(result)} filename="stats.csv" mime="text/csv" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Min</p><p className="font-bold">{fmt(result.min)}</p></div>
              <div><p className="text-xs text-muted-foreground">Max</p><p className="font-bold">{fmt(result.max)}</p></div>
              <div><p className="text-xs text-muted-foreground">Range</p><p className="font-bold">{fmt(result.range)}</p></div>
              <div><p className="text-xs text-muted-foreground">Std Dev (pop)</p><p className="font-bold text-primary">{fmt(result.stdDevPop)}</p></div>
              <div><p className="text-xs text-muted-foreground">Std Dev (sample)</p><p className="font-bold text-primary">{fmt(result.stdDevSample)}</p></div>
              <div><p className="text-xs text-muted-foreground">Variance (pop)</p><p className="font-bold">{fmt(result.variancePop)}</p></div>
              <div><p className="text-xs text-muted-foreground">Variance (sample)</p><p className="font-bold">{fmt(result.varianceSample)}</p></div>
              <div><p className="text-xs text-muted-foreground">Std error</p><p className="font-bold">{fmt(result.standardError)}</p></div>
            </div>

            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-2">Quartiles & IQR</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>Q1: <span className="font-mono">{fmt(result.q1)}</span></div>
                <div>Q2: <span className="font-mono">{fmt(result.q2)}</span></div>
                <div>Q3: <span className="font-mono">{fmt(result.q3)}</span></div>
                <div>IQR: <span className="font-mono">{fmt(result.iqr)}</span></div>
                <div>Lower fence: <span className="font-mono">{fmt(result.lowerFence)}</span></div>
                <div>Upper fence: <span className="font-mono">{fmt(result.upperFence)}</span></div>
              </div>
            </CardContent></Card>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Skewness</p><p className="font-bold">{fmt(result.skewness)}</p></div>
              <div><p className="text-xs text-muted-foreground">Excess kurtosis</p><p className="font-bold">{fmt(result.kurtosis)}</p></div>
              <div><p className="text-xs text-muted-foreground">CoV (%)</p><p className="font-bold">{fmt(result.coefficientOfVariation)}</p></div>
              <div><p className="text-xs text-muted-foreground">Trimmed mean 10%</p><p className="font-bold">{fmt(result.trimmedMean10)}</p></div>
              <div><p className="text-xs text-muted-foreground">Geometric mean</p><p className="font-bold">{fmt(result.geometricMean)}</p></div>
              <div><p className="text-xs text-muted-foreground">Harmonic mean</p><p className="font-bold">{fmt(result.harmonicMean)}</p></div>
              <div><p className="text-xs text-muted-foreground">95% CI</p><p className="font-bold text-xs">[{fmt(result.ci95Lower)}, {fmt(result.ci95Upper)}]</p></div>
              <div><p className="text-xs text-muted-foreground">Sum of squares</p><p className="font-bold">{fmt(result.sumOfSquares)}</p></div>
            </div>

            {result.outliersIqr.length > 0 && (
              <div className="text-xs p-2 rounded border border-yellow-500/30 bg-yellow-500/10">
                <strong>IQR outliers ({result.outliersIqr.length}):</strong> {result.outliersIqr.join(", ")}
              </div>
            )}
            {result.outliersZ.length > 0 && (
              <div className="text-xs p-2 rounded border border-yellow-500/30 bg-yellow-500/10">
                <strong>Z-score outliers (|z| &gt; {zThreshold}):</strong> {result.outliersZ.join(", ")}
              </div>
            )}
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Visual box plot (five-number summary)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          {result ? (
            <BoxPlot result={result} />
          ) : (
            <p className="text-xs text-muted-foreground">Compute stats to see the box plot.</p>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all statistics computed locally. Nothing uploaded.</p></CardContent></Card>
    </div>
  );
}

function BoxPlot({ result }: { result: StatsResult }) {
  const { min, q1, q2, q3, max, lowerFence, upperFence } = result;
  const lo = Math.min(min, lowerFence);
  const hi = Math.max(max, upperFence);
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;
  return (
    <div className="space-y-2">
      <div className="relative h-16 border-t border-b border-border">
        <div className="absolute top-2 bottom-2 border border-primary bg-primary/10 rounded-sm" style={{ left: `${pct(q1)}%`, right: `${100 - pct(q3)}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-foreground" style={{ left: `${pct(q2)}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 h-px bg-foreground" style={{ left: `${pct(min)}%`, width: `${pct(q1) - pct(min)}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 h-px bg-foreground" style={{ left: `${pct(q3)}%`, width: `${pct(max) - pct(q3)}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2 text-xs text-center text-muted-foreground">
        <div><div>Min</div><div className="font-mono text-foreground">{min.toFixed(2)}</div></div>
        <div><div>Q1</div><div className="font-mono text-foreground">{q1.toFixed(2)}</div></div>
        <div><div>Median</div><div className="font-mono text-foreground">{q2.toFixed(2)}</div></div>
        <div><div>Q3</div><div className="font-mono text-foreground">{q3.toFixed(2)}</div></div>
        <div><div>Max</div><div className="font-mono text-foreground">{max.toFixed(2)}</div></div>
      </div>
    </div>
  );
}
