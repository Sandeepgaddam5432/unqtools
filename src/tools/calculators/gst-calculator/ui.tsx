"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { calculateGst, calculateGstBatch, batchToCsv, COUNTRY_PRESETS, formatMoney, type Mode, type GstResult } from "./logic";

interface HistoryEntry { ts: number; amount: number; rate: number; mode: Mode; total: number; }

export default function GstCalculator() {
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("1000");
  const [ratePct, setRatePct] = useState("18");
  const [country, setCountry] = useState("IN");
  const [splitCgstSgst, setSplitCgstSgst] = useState(true);
  const [igst, setIgst] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [result, setResult] = useState<GstResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<GstResult[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem("gst-history"); if (s) setHistory(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    setError(null);
    try {
      const r = calculateGst({ amount: Number(amount), ratePct: Number(ratePct), mode, splitCgstSgst, igst });
      if ("error" in r) { setError(r.error); setResult(null); }
      else {
        setResult(r);
        const entry: HistoryEntry = { ts: Date.now(), amount: Number(amount), rate: Number(ratePct), mode, total: r.totalAmount };
        const newHistory = [entry, ...history].slice(0, 10);
        setHistory(newHistory);
        try { localStorage.setItem("gst-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [amount, ratePct, mode, splitCgstSgst, igst, history]);

  const runBatch = useCallback(() => {
    setError(null);
    try {
      const amounts = batchInput.split(/[\n,\s]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      if (amounts.length === 0) { setError("No valid amounts found."); return; }
      const r = calculateGstBatch(amounts, Number(ratePct), mode);
      setBatchResults(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [batchInput, ratePct, mode]);

  const fmt = (n: number) => formatMoney(n, currency);
  const preset = COUNTRY_PRESETS.find((c) => c.code === country);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}>Add GST (exclusive → inclusive)</Button>
            <Button size="sm" variant={mode === "remove" ? "default" : "outline"} onClick={() => setMode("remove")}>Remove GST (inclusive → exclusive)</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">GST/VAT rate (%)</Label><Input type="number" step="0.5" value={ratePct} onChange={(e) => setRatePct(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Country preset</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRY_PRESETS.map((c) => <option key={c.code} value={c.code}>{c.country}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD","EUR","GBP","INR","JPY","AUD","CAD","CNY","SGD","AED"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {preset && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">{preset.country} rates:</span>
              {preset.rates.map((r) => (
                <Button key={r.rate} size="sm" variant="outline" onClick={() => setRatePct(String(r.rate))} title={r.label}>
                  {r.rate}%
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={splitCgstSgst} onChange={(e) => setSplitCgstSgst(e.target.checked)} /><span>Split GST into CGST + SGST (India intra-state)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={igst} onChange={(e) => setIgst(e.target.checked)} /><span>Use IGST (India inter-state)</span></label>
          </div>

          <Button size="sm" onClick={calculate}>Calculate</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{mode === "add" ? "Base amount" : "GST-exclusive amount"}</p><p className="text-xl font-bold">{fmt(result.baseAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">GST ({result.ratePct}%)</p><p className="text-xl font-bold text-emerald-500">{fmt(result.gstAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{mode === "add" ? "Total (GST-inclusive)" : "Total paid"}</p><p className="text-xl font-bold text-primary">{fmt(result.totalAmount)}</p></CardContent></Card>
          </div>

          {(result.cgst !== undefined || result.igst !== undefined) && (
            <Card><CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {result.cgst !== undefined && <div><p className="text-xs text-muted-foreground">CGST (half)</p><p className="font-bold">{fmt(result.cgst)}</p></div>}
              {result.sgst !== undefined && <div><p className="text-xs text-muted-foreground">SGST (half)</p><p className="font-bold">{fmt(result.sgst)}</p></div>}
              {result.igst !== undefined && <div><p className="text-xs text-muted-foreground">IGST (full)</p><p className="font-bold">{fmt(result.igst)}</p></div>}
            </CardContent></Card>
          )}

          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Effective tax rate on total: <strong>{result.effectiveRate}%</strong></p>
          </CardContent></Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one amount per line or comma-separated)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder={"1000\n2000\n5000"} />
          <Button size="sm" onClick={runBatch}>Calculate batch</Button>
          {batchResults && !error && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{batchResults.length} results</p>
                <DownloadButton getText={() => batchToCsv(batchResults, batchInput.split(/[\n,\s]+/).filter(Boolean).map(Number))} filename="gst-batch.csv" mime="text/csv" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Base</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {batchResults.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 text-right font-mono">{fmt(Number(batchInput.split(/[\n,\s]+/).filter(Boolean)[i]))}</td>
                        <td className="p-2 text-right font-mono">{fmt(r.baseAmount)}</td>
                        <td className="p-2 text-right font-mono text-emerald-500">{fmt(r.gstAmount)}</td>
                        <td className="p-2 text-right font-mono font-bold">{fmt(r.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("gst-history"); } catch { /* ignore */ } }}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1 text-right">{fmt(h.amount)} @ {h.rate}% ({h.mode}) → <strong>{fmt(h.total)}</strong></span>
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
