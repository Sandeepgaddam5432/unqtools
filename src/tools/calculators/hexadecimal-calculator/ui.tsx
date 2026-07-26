"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateHex, batchEvaluate, historyToCsv, swapEndian, reverseBits,
  type HexOp,
} from "./logic";

const OPS: { value: HexOp; label: string }[] = [
  { value: "add", label: "+" }, { value: "sub", label: "−" },
  { value: "mul", label: "×" }, { value: "div", label: "÷" },
  { value: "mod", label: "%" }, { value: "and", label: "AND" },
  { value: "or", label: "OR" }, { value: "xor", label: "XOR" },
  { value: "nand", label: "NAND" }, { value: "nor", label: "NOR" },
  { value: "xnor", label: "XNOR" }, { value: "shl", label: "<<" },
  { value: "shr", label: ">>" },
];

interface HistoryEntry { expr: string; hex: string; decimal: number; binary: string; ts: number; }

export default function HexadecimalCalculator() {
  const [a, setA] = useState("FF");
  const [b, setB] = useState("01");
  const [op, setOp] = useState<HexOp>("add");
  const [bitWidth, setBitWidth] = useState("0");
  const [signed, setSigned] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateHex> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [batchText, setBatchText] = useState("FF+01\n10&0F\n100<<02");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchEvaluate> | null>(null);
  const [endIn, setEndIn] = useState("12345678");
  const [endBytes, setEndBytes] = useState("4");
  const [endOut, setEndOut] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hex-calc-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const calc = useCallback(() => {
    const r = calculateHex({ a, b, op, bitWidth: Number(bitWidth), signed });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
    const entry: HistoryEntry = { expr: `${a} ${op} ${b}`, hex: r.hex, decimal: r.decimal, binary: r.binary, ts: Date.now() };
    const newHistory = [entry, ...history].slice(0, 20);
    setHistory(newHistory);
    try { localStorage.setItem("hex-calc-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
  }, [a, b, op, bitWidth, signed, history]);

  const runBatch = useCallback(() => {
    setBatchOut(batchEvaluate(batchText));
    setError(null);
  }, [batchText]);

  const runEndian = useCallback(() => {
    const v = parseInt(endIn, 16);
    if (!Number.isFinite(v) || v < 0) { setError("Invalid hex for endian swap."); setEndOut(null); return; }
    setError(null);
    setEndOut(swapEndian(v, Number(endBytes)));
  }, [endIn, endBytes]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Hex A</Label>
              <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="FF" className="font-mono" /></div>
            <div><Label className="text-xs text-muted-foreground">Hex B</Label>
              <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="01" className="font-mono" /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OPS.map((o) => (
              <Button key={o.value} size="sm" variant={op === o.value ? "default" : "outline"} onClick={() => setOp(o.value)}>{o.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">Bit width (0=none)</Label>
              <Input type="number" min={0} max={64} value={bitWidth} onChange={(e) => setBitWidth(e.target.value)} /></div>
            <div className="flex items-end gap-2 pb-1">
              <input type="checkbox" id="hsigned" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
              <Label htmlFor="hsigned" className="text-xs cursor-pointer">Signed (two's complement)</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calc}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setA("FF"); setB("01"); setOp("add"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Hex</p><p className="text-lg font-mono font-bold text-primary break-all">{result.hex}</p></div>
              <div><p className="text-xs text-muted-foreground">Decimal</p><p className="text-lg font-bold">{result.decimal}</p></div>
              <div><p className="text-xs text-muted-foreground">Binary</p><p className="text-sm font-mono break-all">{result.binary}</p></div>
              <div><p className="text-xs text-muted-foreground">Octal</p><p className="text-lg font-mono font-bold">{result.octal}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Badge variant="outline">Bits: {result.bits}</Badge>
              <Badge variant="outline">Popcount: {result.popcount}</Badge>
              <Badge variant="outline">Parity: {result.parity}</Badge>
              {result.ascii && <Badge variant="outline">ASCII: &quot;{result.ascii}&quot;</Badge>}
              <CopyButton getText={() => result.hex} label="Copy hex" />
              <CopyButton getText={() => String(result.decimal)} label="Copy dec" />
              <CopyButton getText={() => result.binary} label="Copy bin" />
            </div>
            {result.rgb && (
              <div className="flex items-center gap-2 text-xs">
                <div className="h-6 w-6 rounded border" style={{ backgroundColor: `rgb(${result.rgb.r}, ${result.rgb.g}, ${result.rgb.b})` }} />
                <span className="font-mono">RGB({result.rgb.r}, {result.rgb.g}, {result.rgb.b})</span>
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}
            <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-xs font-mono space-y-1">
              {result.steps.map((s, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{s.description}</span>
                  <span className="break-all text-right">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Endianness swap (big ↔ little)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Hex value</Label>
              <Input value={endIn} onChange={(e) => setEndIn(e.target.value)} className="font-mono" /></div>
            <div><Label className="text-xs text-muted-foreground">Byte count (1-8)</Label>
              <Input type="number" min={1} max={8} value={endBytes} onChange={(e) => setEndBytes(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={runEndian}>Swap</Button>
          {endOut !== null && (
            <p className="text-sm">Swapped: <span className="font-mono font-bold text-primary">{endOut.toString(16).toUpperCase().padStart(Number(endBytes) * 2, "0")}</span></p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-xs font-mono"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch}>Run batch</Button>
            {batchOut && (
              <DownloadButton
                getText={() => {
                  const lines = ["#,Hex,Decimal,Binary"];
                  batchOut.results.forEach((r, i) => lines.push(`${i + 1},${r.hex},${r.decimal},${r.binary}`));
                  return lines.join("\n");
                }}
                filename="hex-batch.csv"
                mime="text/csv"
              />
            )}
          </div>
          {batchOut && (
            <div className="space-y-2">
              {batchOut.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-0.5">
                  {batchOut.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Hex</th><th className="p-2 text-right">Dec</th><th className="p-2 text-left">Binary</th></tr></thead>
                  <tbody>
                    {batchOut.results.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono">{r.hex}</td>
                        <td className="p-2 text-right font-mono">{r.decimal}</td>
                        <td className="p-2 font-mono break-all">{r.binary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 20)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="hex-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("hex-calc-history"); } catch {} }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="flex-1 font-mono">{h.expr}</span>
                  <Badge variant="outline" className="font-mono">0x{h.hex}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all hex math runs locally. History in localStorage only.</p></CardContent></Card>
    </div>
  );
}
