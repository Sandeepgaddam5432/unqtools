"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { convertLength, convertToAll, parseChainedLength, metersToFeetInches, historyToCsv, LENGTH_UNITS } from "./logic";

interface HistoryEntry { ts: number; value: number; from: string; to: string; result: number; }

const SYSTEM_COLORS: Record<string, string> = {
  metric: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  imperial: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  nautical: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  astronomical: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  typographic: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

export default function UnitConverterLength() {
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [precision, setPrecision] = useState("6");
  const [scientificNotation, setScientificNotation] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof convertLength> | null>(null);
  const [allResult, setAllResult] = useState<ReturnType<typeof convertToAll> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Chained
  const [chainedInput, setChainedInput] = useState("5 km 300 m 50 cm");
  const [chainedResult, setChainedResult] = useState<ReturnType<typeof parseChainedLength> | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("length-conv-history"); if (s) setHistory(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const calculate = useCallback(() => {
    const r = convertLength({ value: Number(value), fromUnit, toUnit, precision: Number(precision), scientificNotation });
    if ("error" in r) { setError(r.error); setResult(null); } else {
      setResult(r); setError(null);
      const entry: HistoryEntry = { ts: Date.now(), value: Number(value), from: fromUnit, to: toUnit, result: r.toValue };
      const newHistory = [entry, ...history].slice(0, 10);
      setHistory(newHistory);
      try { localStorage.setItem("length-conv-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
    }
    if (showAll) {
      const ar = convertToAll(Number(value), fromUnit, Number(precision));
      if ("error" in ar) { setAllResult(null); } else { setAllResult(ar); }
    }
  }, [value, fromUnit, toUnit, precision, scientificNotation, showAll, history]);

  const runChained = useCallback(() => {
    const r = parseChainedLength(chainedInput);
    setChainedResult(r);
    if ("error" in r) setError(r.error); else setError(null);
  }, [chainedInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
                {LENGTH_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.system}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
                {LENGTH_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.system}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Precision (0-10)</Label>
              <Input type="number" min="0" max="10" value={precision} onChange={(e) => setPrecision(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={scientificNotation} onChange={(e) => setScientificNotation(e.target.checked)} />
              <span>Force scientific notation</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              <span>Show all-unit table</span>
            </label>
            <Button size="sm" variant="ghost" onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }}>⇄ Swap</Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setValue("1"); setFromUnit("km"); setToUnit("mi"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setAllResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Result</p>
            <p className="text-3xl font-bold text-primary">{result.formatted} {result.toUnit.symbol}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {result.fromValue} {result.fromUnit.symbol} = {result.formatted} {result.toUnit.symbol}
            </p>
            <div className="mt-2 flex gap-2">
              <CopyButton getText={() => `${result.formatted} ${result.toUnit.symbol}`} />
              {result.fromUnit.system === "metric" && result.toUnit.system === "imperial" && result.toUnit.id === "ft" && (() => {
                const meters = result.fromValue * result.fromUnit.factor;
                const fi = metersToFeetInches(meters);
                return <Badge variant="outline">{fi.display}</Badge>;
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {showAll && allResult && !("error" in allResult) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{allResult.fromValue} {allResult.fromUnit.symbol} in all units</CardTitle>
              <DownloadButton
                getText={() => ["Unit,Symbol,System,Value"].concat(allResult.rows.map(r => `${r.unit.name},${r.unit.symbol},${r.unit.system},${r.formatted}`)).join("\n")}
                filename="length-conversions.csv"
                mime="text/csv"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Symbol</th>
                    <th className="p-2 text-left">System</th>
                    <th className="p-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {allResult.rows.map((row) => (
                    <tr key={row.unit.id} className="border-t border-border/50">
                      <td className="p-2">{row.unit.name}</td>
                      <td className="p-2 font-mono">{row.unit.symbol}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${SYSTEM_COLORS[row.unit.system]}`}>{row.unit.system}</span></td>
                      <td className="p-2 text-right font-mono">{row.formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Chained length parser (e.g. "5 km 300 m 50 cm")</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex gap-2">
            <Input value={chainedInput} onChange={(e) => setChainedInput(e.target.value)} placeholder="5 km 300 m 50 cm" />
            <Button size="sm" onClick={runChained}>Parse</Button>
          </div>
          {chainedResult && !("error" in chainedResult) && (
            <div className="space-y-2">
              <p className="text-sm">Total: <strong className="text-primary text-lg">{chainedResult.totalMeters} m</strong></p>
              <div className="text-xs text-muted-foreground">
                {chainedResult.breakdown.map((b, i) => (
                  <span key={i}>{i > 0 && " + "}{b.value} {b.unit.symbol}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="length-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("length-conv-history"); } catch { /* ignore */ } }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="flex-1">{h.value} {h.from} → {h.to}</span>
                  <Badge variant="outline">{h.result}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversions run locally. History stored only in your browser.</p></CardContent></Card>
    </div>
  );
}
