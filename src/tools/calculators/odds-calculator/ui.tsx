"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { fromProbability, fromDecimal, americanToProb, formatFractional, formatAmerican, type OddsResult } from "./logic";

type Mode = "probability" | "decimal" | "american";

export default function OddsCalculator() {
  const [mode, setMode] = useState<Mode>("probability");
  const [value, setValue] = useState("0.25");
  const [error, setError] = useState<string | null>(null);

  const result: OddsResult | null = useMemo(() => {
    setError(null);
    const v = Number(value);
    if (!Number.isFinite(v)) { setError("Please enter a valid number"); return null; }
    if (mode === "probability") {
      const r = fromProbability(v);
      if ("error" in r) { setError(r.error); return null; }
      return r;
    }
    if (mode === "decimal") {
      const r = fromDecimal(v);
      if ("error" in r) { setError(r.error); return null; }
      return r;
    }
    // american
    const p = americanToProb(v);
    if (typeof p === "object" && p !== null) { setError(p.error); return null; }
    const r = fromProbability(p);
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [mode, value]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Format,Value",
      `Probability,${result.probability.toFixed(4)}`,
      `Decimal,${result.decimal.toFixed(2)}`,
      `Fractional,${formatFractional(result.fractional)}`,
      `American,${formatAmerican(result.american)}`,
    ].join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-sm font-medium">Input format</Label>
          <div className="flex flex-wrap gap-2">
            {(["probability", "decimal", "american"] as Mode[]).map((m) => (
              <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" onClick={() => { setMode(m); setValue(m === "probability" ? "0.25" : m === "decimal" ? "4" : "300"); }}>
                {m === "probability" ? "Probability" : m === "decimal" ? "Decimal odds" : "American odds"}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {mode === "probability" ? "Probability (0..1)" : mode === "decimal" ? "Decimal odds (>1)" : "American odds (non-zero)"}
            </Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => csv} filename="odds.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Probability</p><p className="text-xl font-bold">{(result.probability * 100).toFixed(2)}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Decimal</p><p className="text-xl font-bold">{result.decimal.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Fractional</p><p className="text-xl font-bold">{formatFractional(result.fractional)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">American</p><p className="text-xl font-bold">{formatAmerican(result.american)}</p></CardContent></Card>
        </div>
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
