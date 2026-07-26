"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  generateFibonacci, fastFib, fastFibMod, indexOfFibonacci, isFibonacci,
  pisanoPeriod, toCsv, toJson,
} from "./logic";

interface HistoryEntry { label: string; value: string; ts: number; }

export default function FibonacciGenerator() {
  const [count, setCount] = useState("20");
  const [f0, setF0] = useState("0");
  const [f1, setF1] = useState("1");
  const [variant, setVariant] = useState<"fibonacci" | "lucas" | "tribonacci">("fibonacci");
  const [mod, setMod] = useState("");
  const [result, setResult] = useState<ReturnType<typeof generateFibonacci> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Index lookup
  const [idx, setIdx] = useState("100");
  const [idxOut, setIdxOut] = useState<string | null>(null);

  // Pisano
  const [pisanoM, setPisanoM] = useState("10");
  const [pisanoOut, setPisanoOut] = useState<number | null>(null);

  // Reverse lookup
  const [checkNum, setCheckNum] = useState("55");
  const [checkOut, setCheckOut] = useState<{ isFib: boolean; index: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("fib-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const generate = useCallback(() => {
    const r = generateFibonacci({
      count: Number(count),
      f0: f0.trim() !== "" ? BigInt(f0) : undefined,
      f1: f1.trim() !== "" ? BigInt(f1) : undefined,
      variant,
      mod: mod.trim() !== "" ? BigInt(mod) : undefined,
    });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
    const label = `${r.variant}(${count})${mod ? " mod " + mod : ""}`;
    const value = r.terms[r.terms.length - 1]?.toString() ?? "";
    const newHistory = [{ label, value, ts: Date.now() }, ...history].slice(0, 20);
    setHistory(newHistory);
    try { localStorage.setItem("fib-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
  }, [count, f0, f1, variant, mod, history]);

  const lookupIndex = useCallback(() => {
    try {
      const v = fastFib(BigInt(idx));
      setIdxOut(v.toString());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setIdxOut(null);
    }
  }, [idx]);

  const lookupIndexMod = useCallback(() => {
    try {
      const v = fastFibMod(BigInt(idx), mod.trim() ? BigInt(mod) : 1000000007n);
      setIdxOut(v.toString());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setIdxOut(null);
    }
  }, [idx, mod]);

  const checkFib = useCallback(() => {
    try {
      const v = BigInt(checkNum);
      const index = indexOfFibonacci(v);
      setCheckOut({ isFib: index >= 0, index });
      setError(null);
    } catch {
      setError("Invalid number to check.");
      setCheckOut(null);
    }
  }, [checkNum]);

  const computePisano = useCallback(() => {
    try {
      const m = BigInt(pisanoM);
      setPisanoOut(pisanoPeriod(m));
      setError(null);
    } catch {
      setError("Invalid modulus.");
      setPisanoOut(null);
    }
  }, [pisanoM]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["fibonacci", "lucas", "tribonacci"] as const).map((v) => (
              <Button key={v} size="sm" variant={variant === v ? "default" : "outline"} onClick={() => setVariant(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Count (terms)</Label>
              <Input type="number" min={1} max={100000} value={count} onChange={(e) => setCount(e.target.value)} /></div>
            {variant === "fibonacci" && <>
              <div><Label className="text-xs text-muted-foreground">F0 (start)</Label>
                <Input value={f0} onChange={(e) => setF0(e.target.value)} className="font-mono" /></div>
              <div><Label className="text-xs text-muted-foreground">F1 (start)</Label>
                <Input value={f1} onChange={(e) => setF1(e.target.value)} className="font-mono" /></div>
            </>}
            <div><Label className="text-xs text-muted-foreground">Mod (optional)</Label>
              <Input value={mod} onChange={(e) => setMod(e.target.value)} placeholder="e.g. 1000000007" className="font-mono" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={generate}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCount("20"); setF0("0"); setF1("1"); setVariant("fibonacci"); setMod(""); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Terms</p><p className="font-bold">{result.count}</p></div>
              <div><p className="text-xs text-muted-foreground">Variant</p><p className="font-bold capitalize">{result.variant}</p></div>
              <div><p className="text-xs text-muted-foreground">Digit count (max)</p><p className="font-bold">{result.digitCount}</p></div>
              <div><p className="text-xs text-muted-foreground">Mod applied</p><p className="font-bold">{result.moduloApplied ? "Yes" : "No"}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Sum: {result.sum.toString()}</Badge>
              {result.goldenRatio && <Badge variant="outline">φ ≈ {result.goldenRatio}</Badge>}
              <Badge variant="outline">Cassini: {result.isCassiniValid ? "✓" : "n/a"}</Badge>
              <CopyButton getText={() => result.terms.map((t) => t.toString()).join(", ")} label="Copy sequence" />
              <DownloadButton getText={() => toCsv(result.terms)} filename={`${result.variant}-sequence.csv`} mime="text/csv" />
              <DownloadButton getText={() => toJson(result.terms, { variant: result.variant, sum: result.sum.toString() })} filename={`${result.variant}-sequence.json`} mime="application/json" />
            </div>
            <div className="rounded-md border border-border/50 bg-muted/30 p-3 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 text-xs font-mono">
                {result.terms.map((t, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">[{i}]</span>
                    <span className="break-all text-right">{t.toString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Index lookup — F(n)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">n (supports huge values via fast-doubling)</Label>
              <Input value={idx} onChange={(e) => setIdx(e.target.value)} className="font-mono" />
            </div>
            <Button size="sm" onClick={lookupIndex}>Compute</Button>
            <Button size="sm" variant="outline" onClick={lookupIndexMod} disabled={!mod.trim()}>Mod</Button>
          </div>
          {idxOut && <p className="text-sm font-mono break-all">F({idx}) = <span className="font-bold text-primary">{idxOut}</span></p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Is this a Fibonacci number?</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Number</Label>
                <Input value={checkNum} onChange={(e) => setCheckNum(e.target.value)} className="font-mono" />
              </div>
              <Button size="sm" onClick={checkFib}>Check</Button>
            </div>
            {checkOut && (
              <p className="text-sm">
                {checkOut.isFib
                  ? <>✓ Yes — F<sub>{checkOut.index}</sub></>
                  : "✗ Not a Fibonacci number"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Pisano period π(m)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Modulus m</Label>
                <Input value={pisanoM} onChange={(e) => setPisanoM(e.target.value)} className="font-mono" />
              </div>
              <Button size="sm" onClick={computePisano}>Compute</Button>
            </div>
            {pisanoOut !== null && <p className="text-sm">π({pisanoM}) = <span className="font-bold text-primary">{pisanoOut}</span></p>}
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 20)</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("fib-history"); } catch {} }}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="flex-1 font-mono">{h.label}</span>
                  <Badge variant="outline" className="font-mono">{h.value.slice(0, 30)}{h.value.length > 30 ? "…" : ""}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all Fibonacci math runs locally with BigInt. No precision loss.</p></CardContent></Card>
    </div>
  );
}
