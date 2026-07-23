"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateDiscount, calculateBogo, applyThresholdCoupon, markupMarkdown, formatMoney, historyToCsv, type DiscountStep } from "./logic";

interface HistoryEntry { ts: number; original: number; final: number; savings: number; discounts: string; }

export default function DiscountCalculator() {
  const [originalPrice, setOriginalPrice] = useState("100");
  const [discounts, setDiscounts] = useState<DiscountStep[]>([{ type: "percent", value: 20 }]);
  const [taxPercent, setTaxPercent] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState<ReturnType<typeof calculateDiscount> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // BOGO
  const [bogoUnitPrice, setBogoUnitPrice] = useState("10");
  const [bogoQty, setBogoQty] = useState("3");
  const [bogoBuy, setBogoBuy] = useState("2");
  const [bogoFree, setBogoFree] = useState("1");
  const [bogoResult, setBogoResult] = useState<ReturnType<typeof calculateBogo> | null>(null);

  // Threshold coupon
  const [thresholdSubtotal, setThresholdSubtotal] = useState("60");
  const [thresholdCoupon, setThresholdCoupon] = useState("10");
  const [threshold, setThreshold] = useState("50");
  const [thresholdResult, setThresholdResult] = useState<ReturnType<typeof applyThresholdCoupon> | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("discount-calc-history"); if (s) setHistory(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    const r = calculateDiscount({ originalPrice: Number(originalPrice), discounts, taxPercent: Number(taxPercent) });
    if ("error" in r) {
      setError(r.error); setResult(null);
    } else {
      setResult(r); setError(null);
      const entry: HistoryEntry = {
        ts: Date.now(),
        original: r.originalPrice,
        final: r.finalPrice,
        savings: r.totalSavings,
        discounts: discounts.map(d => d.type === "percent" ? `${d.value}%` : `$${d.value}`).join(" + "),
      };
      const newHistory = [entry, ...history].slice(0, 10);
      setHistory(newHistory);
      try { localStorage.setItem("discount-calc-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
    }
  }, [originalPrice, discounts, taxPercent, history]);

  const runBogo = useCallback(() => {
    const r = calculateBogo({ unitPrice: Number(bogoUnitPrice), quantity: Number(bogoQty), buyCount: Number(bogoBuy), freeCount: Number(bogoFree) });
    if ("error" in r) { setError(r.error); setBogoResult(null); } else { setBogoResult(r); setError(null); }
  }, [bogoUnitPrice, bogoQty, bogoBuy, bogoFree]);

  const runThreshold = useCallback(() => {
    const r = applyThresholdCoupon(Number(thresholdSubtotal), Number(thresholdCoupon), Number(threshold));
    if ("error" in r) { setError(r.error); setThresholdResult(null); } else { setThresholdResult(r); setError(null); }
  }, [thresholdSubtotal, thresholdCoupon, threshold]);

  const fmt = (n: number) => formatMoney(n, currency);

  const updateDiscount = (i: number, patch: Partial<DiscountStep>) => {
    setDiscounts(discounts.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  };

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
              <Label className="text-xs text-muted-foreground">Tax %</Label>
              <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD","EUR","GBP","INR","JPY","AUD","CAD"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Discounts (stack up to 5)</Label>
              <Button size="sm" variant="ghost" onClick={() => discounts.length < 5 && setDiscounts([...discounts, { type: "percent", value: 0 }])}>+ Add</Button>
            </div>
            {discounts.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={d.type} onChange={(e) => updateDiscount(i, { type: e.target.value as DiscountType })}>
                  <option value="percent">% off</option>
                  <option value="fixed">$ off</option>
                </select>
                <Input type="number" value={d.value} onChange={(e) => updateDiscount(i, { value: Number(e.target.value) })} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setDiscounts(discounts.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setOriginalPrice("100"); setDiscounts([{ type: "percent", value: 20 }]); setTaxPercent("0"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Original</p><p className="text-xl font-bold">{fmt(result.originalPrice)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total savings</p><p className="text-xl font-bold text-emerald-500">{fmt(result.totalSavings)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Final price</p><p className="text-xl font-bold text-primary">{fmt(result.finalPrice)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Grand total (with tax)</p><p className="text-xl font-bold">{fmt(result.grandTotal)}</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-4"><p className="text-sm">Effective discount: <strong className="text-primary">{result.effectiveDiscountPct}%</strong></p></CardContent></Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Step-by-step</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="text-xs divide-y divide-border/50">
                {result.steps.map((s, i) => (
                  <li key={i} className="p-2 flex items-center justify-between gap-2">
                    <span>{s.description}</span>
                    <span className="text-emerald-500">-{fmt(s.saved)}</span>
                    <span className="font-mono">{fmt(s.priceAfter)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {/* BOGO */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">BOGO (buy-one-get-one)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Unit price</Label><Input type="number" value={bogoUnitPrice} onChange={(e) => setBogoUnitPrice(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Quantity</Label><Input type="number" value={bogoQty} onChange={(e) => setBogoQty(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Buy</Label><Input type="number" value={bogoBuy} onChange={(e) => setBogoBuy(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Get free</Label><Input type="number" value={bogoFree} onChange={(e) => setBogoFree(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={runBogo}>Calculate BOGO</Button>
          {bogoResult && !("error" in bogoResult) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Paid units</p><p className="text-sm font-bold">{bogoResult.paidUnits}</p></div>
              <div><p className="text-xs text-muted-foreground">Free units</p><p className="text-sm font-bold text-emerald-500">{bogoResult.freeUnits}</p></div>
              <div><p className="text-xs text-muted-foreground">You pay</p><p className="text-sm font-bold">{fmt(bogoResult.totalPaid)}</p></div>
              <div><p className="text-xs text-muted-foreground">You save</p><p className="text-sm font-bold text-emerald-500">{fmt(bogoResult.totalSaved)} ({bogoResult.effectiveDiscountPct}%)</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threshold coupon */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Threshold coupon ($X off $Y+)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">Subtotal</Label><Input type="number" value={thresholdSubtotal} onChange={(e) => setThresholdSubtotal(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Coupon $</Label><Input type="number" value={thresholdCoupon} onChange={(e) => setThresholdCoupon(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Threshold $</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={runThreshold}>Check coupon</Button>
          {thresholdResult && !("error" in thresholdResult) && (
            <p className="text-sm">
              {thresholdResult.couponApplied ? (
                <>✅ Coupon applied! You save <strong className="text-emerald-500">{fmt(thresholdResult.savings)}</strong>. Final: <strong>{fmt(thresholdResult.discounted)}</strong></>
              ) : (
                <>❌ Coupon NOT applied. Spend <strong>{fmt(Number(threshold) - Number(thresholdSubtotal))}</strong> more to qualify.</>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="discount-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("discount-calc-history"); } catch { /* ignore */ } }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1">{h.discounts}</span>
                  <Badge variant="outline">Saved {fmt(h.savings)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. History stored only in your browser.</p></CardContent></Card>
    </div>
  );
}
