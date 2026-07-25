"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { calculatePercentageChange, formatPct, resultToCsv, type PctChangeResult } from "./logic";

export default function PercentageChangeCalc() {
  const [oldValue, setOldValue] = useState("100");
  const [newValue, setNewValue] = useState("150");
  const [result, setResult] = useState<PctChangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const r = calculatePercentageChange({ oldValue: Number(oldValue), newValue: Number(newValue) });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [oldValue, newValue]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Old value</Label>
              <Input type="number" value={oldValue} onChange={(e) => setOldValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">New value</Label>
              <Input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setOldValue("100"); setNewValue("150"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Absolute diff</p><p className="text-xl font-bold">{result.absoluteDifference}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">% change</p><p className={`text-xl font-bold ${result.direction === "increase" ? "text-emerald-500" : result.direction === "decrease" ? "text-red-500" : ""}`}>{formatPct(result.percentChange)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Direction</p><p className="text-xl font-bold capitalize">{result.direction}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Multiplier</p><p className="text-xl font-bold">{result.multiplier}×</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{oldValue}</strong> → <strong className="text-foreground">{newValue}</strong> = <strong className="text-primary">{formatPct(result.percentChange)}</strong>
              </p>
              <div className="flex gap-2">
                <CopyButton getText={() => formatPct(result.percentChange)} />
                <DownloadButton getText={() => resultToCsv(result)} filename="percentage-change.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
