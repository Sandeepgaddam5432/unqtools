"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { calculateMarkupMargin, formatCurrency, formatPct, resultToCsv, type MarkupMarginResult } from "./logic";

export default function MarkupMarginCalc() {
  const [cost, setCost] = useState("100");
  const [price, setPrice] = useState("150");
  const [result, setResult] = useState<MarkupMarginResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const r = calculateMarkupMargin({ cost: Number(cost), price: Number(price) });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [cost, price]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Cost</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Selling price</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCost("100"); setPrice("150"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Cost</p><p className="text-xl font-bold">{formatCurrency(result.cost)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Price</p><p className="text-xl font-bold">{formatCurrency(result.price)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Profit</p><p className={`text-xl font-bold ${result.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>{formatCurrency(result.profit)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Multiplier</p><p className="text-xl font-bold">{result.markupMultiplier}×</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Markup %</p>
              <p className="text-2xl font-bold text-primary">{formatPct(result.markupPercent)}</p>
              <p className="text-xs text-muted-foreground mt-1">Profit relative to cost</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Margin %</p>
              <p className="text-2xl font-bold text-primary">{formatPct(result.marginPercent)}</p>
              <p className="text-xs text-muted-foreground mt-1">Profit relative to price</p>
            </CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Buy at <strong className="text-foreground">{formatCurrency(result.cost)}</strong>, sell at <strong className="text-foreground">{formatCurrency(result.price)}</strong>: profit <strong className="text-emerald-500">{formatCurrency(result.profit)}</strong>.
              </p>
              <div className="flex gap-2">
                <CopyButton getText={() => `${formatPct(result.markupPercent)} markup / ${formatPct(result.marginPercent)} margin`} />
                <DownloadButton getText={() => resultToCsv(result)} filename="markup-margin.csv" mime="text/csv" />
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
