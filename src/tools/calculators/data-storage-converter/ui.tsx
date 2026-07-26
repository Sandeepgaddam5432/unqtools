"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, formatSize,
  transferTime, formatDuration, validateOptions, UNIT_LABELS, UNIT_SYSTEM,
  PRESETS, ALL_UNITS, TO_BITS, type StorageUnit,
} from "./logic";

function formatValue(v: number): string {
  if (v >= 1e12 || (v <= 1e-4 && v > 0)) return v.toExponential(4);
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toFixed(6);
}

export default function DataStorageConverter() {
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState<StorageUnit>("gb");
  const [to, setTo] = useState<StorageUnit>("mib");
  const [batchText, setBatchText] = useState("");
  const [bandwidth, setBandwidth] = useState(1000); // bits/sec
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const v = validateOptions({ from, to });
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    const r = process(value, { from, to });
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [value, from, to]);

  const all = useMemo(() => convertAll(value, from), [value, from]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0), [batchText]);
  const batchInputs = useMemo(() => batchLines.map((l) => Number(l)).filter((n) => Number.isFinite(n)), [batchLines]);
  const batchResults = useMemo(() => convertBatch(batchInputs, from, to), [batchInputs, from, to]);

  const totalBits = value * TO_BITS[from];
  const ttime = useMemo(() => transferTime(totalBits, bandwidth), [totalBits, bandwidth]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input type="number" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value as StorageUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value as StorageUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { const s = swap({ from, to }); setFrom(s.from); setTo(s.to); }}>Swap</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">{formatValue(result.output)} {result.unit}</p>
                <p className="text-xs text-muted-foreground mt-1">Human-readable: {formatSize(value * TO_BITS[from])}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{value} {from}</Badge>
                <Badge variant="secondary">{result.system}</Badge>
                <CopyButton getText={() => String(result.output)} />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">All conversions ({all.length})</Badge>
            <DownloadButton getText={() => toCsv(all)} filename="storage-conversions.csv" mime="text/csv" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((r) => (
              <div key={r.unit} className="rounded-md border border-border/50 p-2">
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">{formatValue(r.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one value per line, in {from})</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"1\n2\n3"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchResults.length} rows</Badge>
              <DownloadButton getText={() => batchToCsv(batchInputs, from, to, batchResults)} filename="storage-batch.csv" mime="text/csv" />
            </div>
          )}
          {batchResults.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono max-h-[200px] overflow-y-auto">
              {batchResults.map((r, i) => "error" in r ? `${i + 1}\t${batchInputs[i]}\tERROR: ${r.error}` : `${i + 1}\t${batchInputs[i]} ${from}\t→ ${r.output} ${r.unit}`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Badge variant="secondary">Transfer-time estimator</Badge>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bandwidth (bits/sec)</Label>
              <Input type="number" value={bandwidth} onChange={(e) => setBandwidth(Number(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Estimated time</Label>
              <p className="text-sm font-mono font-bold mt-1">{typeof ttime === "number" ? formatDuration(ttime) : "n/a"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Common presets</Badge>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {PRESETS.map((p) => (
              <div key={p.label} className="rounded-md border border-border/50 p-2">
                <p className="font-medium">{p.label}</p>
                <p className="font-mono text-muted-foreground">{formatSize(p.value * TO_BITS[p.unit])}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversions run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
