"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  process, convertAll, toCsv, toMarkdown, batchConvert, batchToCsv,
  UNIT_LABELS, ALL_UNITS, REFERENCE_FORCES, fmt, type ForceUnit,
} from "./logic";

export default function ForceConverter() {
  const [raw, setRaw] = useState("1");
  const [from, setFrom] = useState<ForceUnit>("N");
  const [to, setTo] = useState<ForceUnit>("lbf");
  const [batch, setBatch] = useState("1\n10\n100");
  const [error, setError] = useState<string | null>(null);

  const value = Number(raw);
  const result = useMemo(() => {
    queueMicrotask(() => setError(null));
    if (!Number.isFinite(value)) { queueMicrotask(() => setError("Input must be a finite number")); return null; }
    const r = process(value, { from, to });
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    return r;
  }, [value, from, to]);

  const all = useMemo(() => convertAll(value, from), [value, from]);

  const batchResult = useMemo(() => {
    const values = batch.split(/\n|,/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    return batchConvert(values, from, to);
  }, [batch, from, to]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Input,${value} ${from}`,
      `Output,${result.output} ${result.unit}`,
      `Warnings,"${result.warnings.join("; ")}"`,
    ].join("\n");
  }, [result, value, from]);

  const fullCsv = csv + "\n\n" + toCsv(all) + "\n\n" + batchToCsv(batchResult);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input value={raw} onChange={(e) => setRaw(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value as ForceUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value as ForceUnit)}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setRaw("9.80665"); setFrom("N"); setTo("kgf"); }}>Load sample</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => fullCsv} filename="force-conversions.csv" mime="text/csv" disabled={!result} />
            <CopyButton getText={() => toMarkdown(all)} label="Copy Markdown" />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">{fmt(result.output)} {result.unit}</p>
              </div>
              <Badge variant="outline">{fmt(value)} {from}</Badge>
            </div>
            {result.warnings.length > 0 && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">All conversions ({all.length})</Badge>
            <CopyButton getText={() => toCsv(all)} label="Copy CSV" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {all.map((r) => (
              <div key={r.unit} className={`rounded-md border p-2 ${r.unit === to ? "border-primary" : "border-border/50"}`}>
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">{fmt(r.value, 4)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-medium">Batch (one value per line)</Label>
          <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
          {batchResult.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {batchResult.map((r, i) => (
                <div key={i} className="rounded-md border p-2 text-xs">
                  <p className="text-muted-foreground">{fmt(r.input)}</p>
                  <p className="font-mono">{"error" in r.result ? "err" : `${fmt(r.result.output, 3)} ${r.result.unit}`}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Reference forces (tap to load)</p>
        <div className="flex flex-wrap gap-1.5">
          {REFERENCE_FORCES.map((ref) => (
            <Button key={ref.label} size="sm" variant="outline" onClick={() => { setRaw(String(ref.n)); setFrom("N"); }}>
              {ref.label}
            </Button>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversions run locally in your browser.</p>
      </CardContent></Card>
    </div>
  );
}
