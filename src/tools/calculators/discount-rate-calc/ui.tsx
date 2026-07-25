"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { calculateDiscountRate, formatCurrency, formatPct, resultToCsv, type DiscountResult } from "./logic";

export default function DiscountRateCalc() {
  const [originalPrice, setOriginalPrice] = useState("100");
  const [salePrice, setSalePrice] = useState("80");
  const [result, setResult] = useState<DiscountResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const r = calculateDiscountRate({ originalPrice: Number(originalPrice), salePrice: Number(salePrice) });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [originalPrice, salePrice]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Original price</Label>
              <Input type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sale price</Label>
              <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setOriginalPrice("100"); setSalePrice("80"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Original</p><p className="text-xl font-bold">{formatCurrency(result.originalPrice)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Sale price</p><p className="text-xl font-bold text-primary">{formatCurrency(result.salePrice)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Savings</p><p className="text-xl font-bold text-emerald-500">{formatCurrency(result.savings)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Discount rate</p><p className="text-xl font-bold text-primary">{formatPct(result.discountRate)}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                You save <strong className="text-emerald-500">{formatCurrency(result.savings)}</strong> ({formatPct(result.discountRate)} off). Sale price is <strong className="text-foreground">{formatPct(result.salePercent)}</strong> of original.
              </p>
              <div className="flex gap-2">
                <CopyButton getText={() => formatPct(result.discountRate)} />
                <DownloadButton getText={() => resultToCsv(result)} filename="discount-rate.csv" mime="text/csv" />
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
