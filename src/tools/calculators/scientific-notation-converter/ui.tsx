"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  convertNotation, compareNotation, batchConvert, toCsv,
  type RoundingMode,
} from "./logic";

export default function ScientificNotationConverter() {
  const [value, setValue] = useState("1500");
  const [sigFigs, setSigFigs] = useState("3");
  const [rounding, setRounding] = useState<RoundingMode>("round");
  const [result, setResult] = useState<ReturnType<typeof convertNotation> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cmpA, setCmpA] = useState("1e3");
  const [cmpB, setCmpB] = useState("1000");
  const [cmpOut, setCmpOut] = useState<string | null>(null);

  const [batchText, setBatchText] = useState("1500\n0.00042\n6.022e23");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchConvert> | null>(null);

  const run = useCallback(() => {
    const r = convertNotation({ value, sigFigs: Number(sigFigs), rounding });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [value, sigFigs, rounding]);

  const runCompare = useCallback(() => {
    const r = compareNotation(cmpA, cmpB);
    if (typeof r === "object") { setError(r.error); setCmpOut(null); return; }
    setError(null);
    const label = r < 0 ? `${cmpA} < ${cmpB}` : r > 0 ? `${cmpA} > ${cmpB}` : `${cmpA} = ${cmpB}`;
    setCmpOut(label);
  }, [cmpA, cmpB]);

  const runBatch = useCallback(() => {
    setBatchOut(batchConvert(batchText, Number(sigFigs)));
    setError(null);
  }, [batchText, sigFigs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Value (decimal, 1.5e3, 1.5×10^3, 1.5×10³ accepted)</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Significant figures (0=full)</Label>
              <Input type="number" min={0} max={20} value={sigFigs} onChange={(e) => setSigFigs(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-xs text-muted-foreground">Rounding:</Label>
            {(["round", "floor", "ceil", "trunc"] as RoundingMode[]).map((m) => (
              <Button key={m} size="sm" variant={rounding === m ? "default" : "outline"} onClick={() => setRounding(m)}>{m}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setValue("6.022e23"); setSigFigs("4"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">Decimal</p>
                <p className="font-mono break-all">{result.decimal}</p>
              </div>
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">Scientific</p>
                <p className="font-mono break-all text-primary">{result.scientific}</p>
              </div>
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">Engineering</p>
                <p className="font-mono break-all">{result.engineering}</p>
              </div>
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">E-notation</p>
                <p className="font-mono break-all">{result.eNotation}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">Mantissa: {result.mantissa.toPrecision(6)}</Badge>
              <Badge variant="outline">Exponent: {result.exponent}</Badge>
              <Badge variant="outline">Order of mag: {result.orderOfMagnitude}</Badge>
              {result.siPrefix !== null && <Badge variant="outline">SI: {result.siPrefixedValue}</Badge>}
              {result.wordForm && <Badge variant="outline">Word: {result.wordForm}</Badge>}
              <CopyButton getText={() => result.scientificAscii} label="Copy scientific" />
              <CopyButton getText={() => result.eNotation} label="Copy E" />
              <CopyButton getText={() => result.decimal} label="Copy decimal" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Float64 hex</p><p className="font-mono break-all">{result.ieee754Float64Hex}</p></div>
              <div><p className="text-muted-foreground">Float32 hex</p><p className="font-mono">{result.ieee754Float32Hex ?? "n/a"}</p></div>
              <div><p className="text-muted-foreground">Binary sci</p><p className="font-mono break-all">{result.binaryScientific}</p></div>
              <div><p className="text-muted-foreground">Digit count</p><p className="font-mono">{result.digitCount}</p></div>
              <div><p className="text-muted-foreground">Leading zeros</p><p className="font-mono">{result.leadingZeros}</p></div>
              <div><p className="text-muted-foreground">Sig figs used</p><p className="font-mono">{result.sigFigsUsed}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Compare two values</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input value={cmpA} onChange={(e) => setCmpA(e.target.value)} className="font-mono" />
            <Input value={cmpB} onChange={(e) => setCmpB(e.target.value)} className="font-mono" />
          </div>
          <Button size="sm" onClick={runCompare}>Compare</Button>
          {cmpOut && <p className="text-sm font-mono">{cmpOut}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch convert (one per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-xs font-mono"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch}>Run batch</Button>
            {batchOut && batchOut.results.length > 0 && (
              <DownloadButton getText={() => toCsv(batchOut.results)} filename="notation-batch.csv" mime="text/csv" />
            )}
          </div>
          {batchOut && (
            <div className="overflow-x-auto">
              {batchOut.errors.length > 0 && (
                <div className="text-xs text-destructive mb-2">{batchOut.errors.join("; ")}</div>
              )}
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Decimal</th><th className="p-2 text-left">Scientific</th><th className="p-2 text-left">Engineering</th><th className="p-2 text-left">E-notation</th></tr></thead>
                <tbody>
                  {batchOut.results.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono break-all">{r.decimal}</td>
                      <td className="p-2 font-mono">{r.scientificAscii}</td>
                      <td className="p-2 font-mono">{r.engineering}</td>
                      <td className="p-2 font-mono">{r.eNotation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No upload, no telemetry.</p></CardContent></Card>
    </div>
  );
}
