"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, bestFitUnit,
  formatEnergy, UNIT_LABELS, UNIT_TRIVIA, UNIT_CLASS, PRESETS, ALL_UNITS,
  ALL_CLASSES, unitsByClass, validateOptions, TO_J,
  type EnergyUnit, type EnergyClass,
} from "./logic";

export default function EnergyConverter() {
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState<EnergyUnit>("kWh");
  const [to, setTo] = useState<EnergyUnit>("J");
  const [batchText, setBatchText] = useState("");
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
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value as EnergyUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value as EnergyUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { const s = swap({ from, to }); setFrom(s.from); setTo(s.to); }}>Swap</Button>
            <Button size="sm" variant="ghost" onClick={() => setTo(bestFitUnit(value * 1))}>Best-fit target</Button>
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
                <p className="text-2xl font-bold font-mono">{formatEnergy(result.output, result.unit)}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{value} {from}</Badge>
                <Badge variant="secondary">{UNIT_CLASS[result.unit]}</Badge>
                <CopyButton getText={() => String(result.output)} />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <p className="text-xs text-muted-foreground">{UNIT_TRIVIA[result.unit]}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">All conversions ({all.length})</Badge>
            <DownloadButton getText={() => toCsv(all)} filename="energy-conversions.csv" mime="text/csv" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((r) => (
              <div key={r.unit} className="rounded-md border border-border/50 p-2">
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">{r.value}</p>
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
              <DownloadButton getText={() => batchToCsv(batchInputs, from, to, batchResults)} filename="energy-batch.csv" mime="text/csv" />
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
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Common presets</Badge>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {PRESETS.map((p) => (
              <div key={p.label} className="rounded-md border border-border/50 p-2">
                <p className="font-medium">{p.label}</p>
                <p className="font-mono text-muted-foreground">{formatEnergy(p.value * TO_J[p.unit], "J")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Units by class</Badge>
          {ALL_CLASSES.map((cls: EnergyClass) => (
            <div key={cls} className="text-xs">
              <span className="font-medium">{cls}:</span>{" "}
              <span className="text-muted-foreground">{unitsByClass(cls).join(", ")}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversions run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
