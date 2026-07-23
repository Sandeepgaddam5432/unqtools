"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateTip, suggestTipPercent, compareTips, formatMoney, historyToCsv, type TipInput } from "./logic";

const PRESETS = [10, 15, 18, 20, 25];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "CHF", "CNY", "SGD", "AED", "ZAR"];

interface HistoryEntry { ts: number; subtotal: number; tipPercent: number; tip: number; total: number; split: number; }

export default function TipCalculator() {
  const [subtotal, setSubtotal] = useState("50");
  const [tipPercent, setTipPercent] = useState("18");
  const [taxPercent, setTaxPercent] = useState("0");
  const [splitCount, setSplitCount] = useState("1");
  const [tipOnTax, setTipOnTax] = useState(false);
  const [rounding, setRounding] = useState<TipInput["rounding"]>("none");
  const [roundingIncrement, setRoundingIncrement] = useState("1");
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState<ReturnType<typeof calculateTip> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [comparison, setComparison] = useState<{ percent: number; tip: number; total: number }[] | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tip-calc-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    const input: TipInput = {
      subtotal: Number(subtotal),
      tipPercent: Number(tipPercent),
      taxPercent: Number(taxPercent) || undefined,
      splitCount: Number(splitCount) || 1,
      tipOnTax,
      rounding,
      roundingIncrement: Number(roundingIncrement) || 1,
    };
    const r = calculateTip(input);
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      const withCurrency = { ...r, currency };
      setResult(withCurrency);
      setError(null);
      const entry: HistoryEntry = {
        ts: Date.now(),
        subtotal: Number(subtotal),
        tipPercent: Number(tipPercent),
        tip: r.tipAmount,
        total: r.grandTotal,
        split: Number(splitCount) || 1,
      };
      const newHistory = [entry, ...history].slice(0, 10);
      setHistory(newHistory);
      try { localStorage.setItem("tip-calc-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
    }
  }, [subtotal, tipPercent, taxPercent, splitCount, tipOnTax, rounding, roundingIncrement, currency, history]);

  const runComparison = useCallback(() => {
    setComparison(compareTips(Number(subtotal), [15, 18, 20]));
  }, [subtotal]);

  const applyQuality = (q: "poor" | "ok" | "good" | "excellent") => {
    setTipPercent(String(suggestTipPercent(q).percent));
  };

  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bill subtotal</Label>
              <Input type="number" aria-label="Subtotal" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tip %</Label>
              <Input type="number" aria-label="Tip percent" value={tipPercent} onChange={(e) => setTipPercent(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tax %</Label>
              <Input type="number" aria-label="Tax percent" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Split between (people)</Label>
              <Input type="number" min="1" aria-label="Split count" value={splitCount} onChange={(e) => setSplitCount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Rounding</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={rounding} onChange={(e) => setRounding(e.target.value as TipInput["rounding"])}>
                <option value="none">No rounding</option>
                <option value="up">Round up</option>
                <option value="down">Round down</option>
                <option value="nearest">Round to nearest</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Rounding increment</Label>
              <Input type="number" step="0.25" aria-label="Rounding increment" value={roundingIncrement} onChange={(e) => setRoundingIncrement(e.target.value)} disabled={rounding === "none"} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Quick presets:</span>
            {PRESETS.map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => setTipPercent(String(p))}>{p}%</Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Service quality:</span>
            <Button size="sm" variant="ghost" onClick={() => applyQuality("poor")}>Poor (10%)</Button>
            <Button size="sm" variant="ghost" onClick={() => applyQuality("ok")}>OK (15%)</Button>
            <Button size="sm" variant="ghost" onClick={() => applyQuality("good")}>Good (18%)</Button>
            <Button size="sm" variant="ghost" onClick={() => applyQuality("excellent")}>Excellent (22%)</Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tipOnTax} onChange={(e) => setTipOnTax(e.target.checked)} />
            <span>Tip on tax (calculate tip on subtotal + tax)</span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setSubtotal("75"); setTipPercent("20"); setTaxPercent("8.5"); setSplitCount("3"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); setComparison(null); }}>Clear</Button>
            <Button size="sm" variant="outline" onClick={runComparison}>Compare 15/18/20%</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Tip amount</p><p className="text-xl font-bold text-primary">{fmt(result.tipAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Tax amount</p><p className="text-xl font-bold">{fmt(result.taxAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Grand total</p><p className="text-xl font-bold">{fmt(result.grandTotal)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Per person ({splitCount})</p><p className="text-xl font-bold text-emerald-500">{fmt(result.perPerson.total)}</p></CardContent></Card>
          </div>

          {result.roundingDelta !== 0 && (
            <Card><CardContent className="p-4">
              <p className="text-sm">Rounding {result.roundingDelta > 0 ? "added" : "removed"}: <strong>{fmt(Math.abs(result.roundingDelta))}</strong></p>
              <p className="text-xs text-muted-foreground mt-1">Effective tip percent after rounding: {result.effectiveTipPercent}%</p>
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Per-person breakdown</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Subtotal</p><p className="text-sm font-bold">{fmt(result.perPerson.subtotal)}</p></div>
              <div><p className="text-xs text-muted-foreground">Tip</p><p className="text-sm font-bold">{fmt(result.perPerson.tip)}</p></div>
              <div><p className="text-xs text-muted-foreground">Tax</p><p className="text-sm font-bold">{fmt(result.perPerson.tax)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-bold">{fmt(result.perPerson.total)}</p></div>
            </CardContent>
          </Card>
        </>
      )}

      {comparison && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Compare tip levels (on subtotal only)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {comparison.map((c) => (
              <div key={c.percent} className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">{c.percent}% tip</p>
                <p className="text-lg font-bold">{fmt(c.tip)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: <strong className="text-foreground">{fmt(c.total)}</strong></p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="tip-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("tip-calc-history"); } catch { /* ignore */ } }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1">Subtotal {h.subtotal} · {h.tipPercent}% tip · {h.split} people</span>
                  <Badge variant="outline">{h.total}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. History is stored only in your browser.</p></CardContent></Card>
    </div>
  );
}
