"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process,
  convertAll,
  toCsv,
  batchConvert,
  batchToCsv,
  formatWeight,
  historyToCsv,
  parseBatchInput,
  unitGroups,
  UNIT_LABELS,
  type WeightUnit,
  type HistoryEntry,
} from "./logic";

const GROUPS = unitGroups();
const ALL_UNITS = GROUPS.flatMap((g) => g.units);

export default function WeightUnitConverter() {
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState<WeightUnit>("kg");
  const [to, setTo] = useState<WeightUnit>("lb");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem("weight-converter-history"); if (s) setHistory(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const result = useMemo(() => process(value, { from, to }), [value, from, to]);
  const all = useMemo(() => convertAll(value, from), [value, from]);

  useEffect(() => {
    setError("error" in result ? result.error : null);
  }, [result]);

  const saveHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    try { localStorage.setItem("weight-converter-history", JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const run = useCallback(() => {
    if ("error" in result) return;
    const entry: HistoryEntry = { ts: Date.now(), input: value, from, to, output: result.output };
    saveHistory([entry, ...history].slice(0, 10));
  }, [result, value, from, to, history, saveHistory]);

  const batch = useMemo(() => {
    const parsed = parseBatchInput(batchText);
    return { parsed, results: batchConvert(parsed.values, from, to) };
  }, [batchText, from, to]);

  const renderUnitOptions = () =>
    GROUPS.map((g) => (
      <optgroup key={g.label} label={g.label}>
        {g.units.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
      </optgroup>
    ));

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
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value as WeightUnit)}>
                {renderUnitOptions()}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value as WeightUnit)}>
                {renderUnitOptions()}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Convert & Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setValue(2.5); setFrom("kg"); setTo("lb"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setValue(1); setFrom("kg"); setTo("g"); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">{formatWeight(result.output, result.unit)}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{formatWeight(value, from)}</Badge>
                <CopyButton getText={() => String(result.output)} />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">All conversions ({all.length})</CardTitle>
            <DownloadButton getText={() => toCsv(all)} filename="weight-conversions.csv" mime="text/csv" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((r) => (
              <div key={r.unit} className="rounded-md border border-border/50 p-2">
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">{formatWeight(r.value, r.unit)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one value per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
            placeholder={"1\n2.5\n100"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batch.results.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">{batch.results.length} values</Badge>
                {batch.parsed.skipped > 0 && <Badge variant="destructive">{batch.parsed.skipped} skipped</Badge>}
              </div>
              <DownloadButton getText={() => batchToCsv(batch.results.map((r, i) => ({ input: batch.parsed.values[i]!, output: r.output, warnings: r.warnings })), from, to)} filename="weight-batch.csv" mime="text/csv" />
            </div>
          )}
          {batch.results.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono">
              {batch.results.map((r, i) => `${batch.parsed.values[i]} ${from} → ${r.output} ${to}`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="weight-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => saveHistory([])}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1 font-mono text-right">{h.input} {h.from} → {h.output} {h.to}</span>
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
