"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateBinary, batchEvaluate, historyToCsv,
  popcount, bitLength, toGrayCode, fromGrayCode, reverseBits, onesComplement,
  toBinary, toHex, toOctal,
  type BinaryOp,
} from "./logic";

const OPS: { value: BinaryOp; label: string }[] = [
  { value: "add", label: "+" }, { value: "sub", label: "−" },
  { value: "mul", label: "×" }, { value: "div", label: "÷" },
  { value: "and", label: "AND" }, { value: "or", label: "OR" },
  { value: "xor", label: "XOR" }, { value: "nand", label: "NAND" },
  { value: "nor", label: "NOR" }, { value: "xnor", label: "XNOR" },
  { value: "shl", label: "<<" }, { value: "shr", label: ">>" },
];

interface HistoryEntry { expr: string; binary: string; decimal: number; hex: string; ts: number; }

export default function BinaryCalculator() {
  const [a, setA] = useState("1010");
  const [b, setB] = useState("0101");
  const [op, setOp] = useState<BinaryOp>("add");
  const [bitWidth, setBitWidth] = useState("0");
  const [signed, setSigned] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateBinary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [batchText, setBatchText] = useState("1010+0101\n1100&1010\n1111<<0010");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchEvaluate> | null>(null);
  const [singleDec, setSingleDec] = useState("42");
  const [singleOut, setSingleOut] = useState<{ binary: string; hex: string; octal: string; gray: number; rev: number; ones: number; pop: number; bits: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("binary-calc-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const calc = useCallback(() => {
    const r = calculateBinary({ a, b, op, bitWidth: Number(bitWidth), signed });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
    const entry: HistoryEntry = { expr: `${a} ${op} ${b}`, binary: r.binary, decimal: r.decimal, hex: r.hex, ts: Date.now() };
    const newHistory = [entry, ...history].slice(0, 20);
    setHistory(newHistory);
    try { localStorage.setItem("binary-calc-history", JSON.stringify(newHistory)); } catch { /* ignore */ }
  }, [a, b, op, bitWidth, signed, history]);

  const runBatch = useCallback(() => {
    setBatchOut(batchEvaluate(batchText));
    setError(null);
  }, [batchText]);

  const convertSingle = useCallback(() => {
    const n = Number(singleDec);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setError("Enter a non-negative integer for single conversion.");
      setSingleOut(null);
      return;
    }
    setError(null);
    const bw = bitLength(n) || 8;
    setSingleOut({
      binary: toBinary(n, Math.max(8, bw)),
      hex: toHex(n),
      octal: toOctal(n),
      gray: toGrayCode(n),
      rev: reverseBits(n, bw),
      ones: onesComplement(n, bw),
      pop: popcount(n),
      bits: bw,
    });
  }, [singleDec]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Binary A</Label>
              <Input aria-label="Binary A" value={a} onChange={(e) => setA(e.target.value)} placeholder="1010" className="font-mono" /></div>
            <div><Label className="text-xs text-muted-foreground">Binary B</Label>
              <Input aria-label="Binary B" value={b} onChange={(e) => setB(e.target.value)} placeholder="0101" className="font-mono" /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OPS.map((o) => (
              <Button key={o.value} size="sm" variant={op === o.value ? "default" : "outline"} onClick={() => setOp(o.value)}>{o.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">Bit width (0=no clamp)</Label>
              <Input type="number" min={0} max={64} value={bitWidth} onChange={(e) => setBitWidth(e.target.value)} /></div>
            <div className="flex items-end gap-2 pb-1">
              <input type="checkbox" id="signed" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
              <Label htmlFor="signed" className="text-xs cursor-pointer">Signed (two's complement)</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calc}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setA("1010"); setB("0101"); setOp("add"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Binary</p><p className="text-lg font-mono font-bold text-primary break-all">{result.binary}</p></div>
              <div><p className="text-xs text-muted-foreground">Decimal</p><p className="text-lg font-bold">{result.decimal}</p></div>
              <div><p className="text-xs text-muted-foreground">Hex</p><p className="text-lg font-mono font-bold">{result.hex}</p></div>
              <div><p className="text-xs text-muted-foreground">Octal</p><p className="text-lg font-mono font-bold">{result.octal}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">Bits: {result.bits}</Badge>
              <Badge variant="outline">Popcount: {result.popcount}</Badge>
              <Badge variant="outline">Parity: {result.parity}</Badge>
              <CopyButton getText={() => result.binary} label="Copy binary" />
              <CopyButton getText={() => String(result.decimal)} label="Copy decimal" />
              <CopyButton getText={() => result.hex} label="Copy hex" />
            </div>
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
        <CardHeader className="pb-3"><CardTitle className="text-sm">Single-number converter (dec → bin/hex/oct/gray)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Decimal (non-negative integer)</Label>
              <Input value={singleDec} onChange={(e) => setSingleDec(e.target.value)} />
            </div>
            <Button size="sm" onClick={convertSingle}>Convert</Button>
          </div>
          {singleOut && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><p className="text-muted-foreground">Binary</p><p className="font-mono break-all">{singleOut.binary}</p></div>
              <div><p className="text-muted-foreground">Hex</p><p className="font-mono">{singleOut.hex}</p></div>
              <div><p className="text-muted-foreground">Octal</p><p className="font-mono">{singleOut.octal}</p></div>
              <div><p className="text-muted-foreground">Gray code (dec)</p><p className="font-mono">{singleOut.gray}</p></div>
              <div><p className="text-muted-foreground">Reversed (dec)</p><p className="font-mono">{singleOut.rev}</p></div>
              <div><p className="text-muted-foreground">Ones' comp (dec)</p><p className="font-mono">{singleOut.ones}</p></div>
              <div><p className="text-muted-foreground">Popcount</p><p className="font-mono">{singleOut.pop}</p></div>
              <div><p className="text-muted-foreground">Bit length</p><p className="font-mono">{singleOut.bits}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one expression per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            aria-label="Batch input"
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-xs font-mono"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch}>Run batch</Button>
            {batchOut && (
              <DownloadButton
                getText={() => {
                  const lines = ["Expression,Binary,Decimal,Hex"];
                  batchOut.results.forEach((r, i) => {
                    lines.push(`"Expr ${i + 1}",${r.binary},${r.decimal},${r.hex}`);
                  });
                  return lines.join("\n");
                }}
                filename="binary-batch.csv"
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
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Binary</th><th className="p-2 text-right">Decimal</th><th className="p-2 text-left">Hex</th></tr></thead>
                  <tbody>
                    {batchOut.results.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono break-all">{r.binary}</td>
                        <td className="p-2 text-right font-mono">{r.decimal}</td>
                        <td className="p-2 font-mono">{r.hex}</td>
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
                <DownloadButton getText={() => historyToCsv(history)} filename="binary-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("binary-calc-history"); } catch {} }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="flex-1 font-mono">{h.expr}</span>
                  <Badge variant="outline" className="font-mono">{h.binary}</Badge>
                  <Badge variant="outline" className="font-mono">0x{h.hex}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all binary math runs locally. History is stored only in your browser (localStorage).</p></CardContent></Card>
    </div>
  );
}
