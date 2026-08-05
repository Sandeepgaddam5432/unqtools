"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllBands, getPresets, getQPresets, planEqConfig, renderCsv, renderReport, planBatch,
  renderBatchCsv, formatHz, formatGainDb, type EqPreset,
} from "./logic";

export default function AudioEqualizerRef() {
  const bands = useMemo(() => getAllBands(), []);
  const presets = useMemo(() => getPresets(), []);
  const qPresets = useMemo(() => getQPresets(), []);

  const [presetId, setPresetId] = useState("rock");
  const [q, setQ] = useState(1.41);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => planEqConfig({ presetId, q }), [presetId, q]);

  const exportBatch = () => {
    setError(null);
    try {
      planBatch(presets.slice(0, 6).map((p) => ({ presetId: p.id, q })));
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preset">
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {presets.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.category})</option>)}
              </select>
            </Field>
            <Field label={`Q factor: ${q}`}>
              <input type="range" min={0.1} max={10} step={0.01} value={q} onChange={(e) => setQ(parseFloat(e.target.value))} className="w-full cursor-pointer" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="eq-reference-report.txt" label="Download report" />
            <DownloadButton getText={() => renderCsv(result)} filename="eq-gains.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Batch plan (6 presets)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">EQ configuration</Label>
          <Row label="Preset" value={result.preset?.label ?? "Custom"} />
          <Row label="Description" value={result.preset?.description ?? "—"} />
          <Row label="Q factor" value={`${result.q}${result.qInfo ? ` — bandwidth ≈ ${result.qInfo.bandwidthOctaves.toFixed(2)} octaves` : ""}`} />
          <Row label="Q use case" value={result.qInfo?.useCase ?? "—"} />
          <Row label="Bands modified" value={`${result.bandsModified} / ${result.gains.length}`} />
          <Row label="Total gain change" value={`${result.totalGainChange.toFixed(2)} dB`} />
          <Row label="Max boost" value={formatGainDb(result.maxBoost)} />
          <Row label="Max cut" value={formatGainDb(result.maxCut)} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Per-band gains</Label>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead><tr className="text-muted-foreground"><th className="text-left p-1">Freq</th><th className="text-left p-1">Band</th><th className="text-left p-1">Description</th><th className="text-right p-1">Gain</th></tr></thead>
              <tbody>
                {bands.map((b, i) => {
                  const g = result.gains[i] ?? 0;
                  const isBoost = g > 0.001;
                  const isCut = g < -0.001;
                  return (
                    <tr key={b.hz} className="border-t border-border/40">
                      <td className="p-1 font-mono">{formatHz(b.hz)}</td>
                      <td className="p-1">{b.bandName}</td>
                      <td className="p-1 text-muted-foreground">{b.description}</td>
                      <td className={`p-1 text-right font-mono ${isBoost ? "text-emerald-600 dark:text-emerald-400" : isCut ? "text-destructive" : ""}`}>{formatGainDb(g)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">EQ presets</Label>
            {presets.map((p: EqPreset) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div><span className="font-medium">{p.label}</span><span className="text-muted-foreground ml-2">{p.description}</span></div>
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Q factor reference</Label>
            {qPresets.map((qp) => (
              <div key={qp.value} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div><span className="font-medium">Q = {qp.value}</span><span className="text-muted-foreground ml-2">{qp.useCase}</span></div>
                <Badge variant="outline" className="text-[10px]">{qp.bandwidthOctaves.toFixed(2)} oct</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Frequency band reference</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { name: "Sub-bass", range: "20–60 Hz", use: "Felt more than heard; kick drum, pipe organ." },
              { name: "Bass", range: "60–250 Hz", use: "Bass guitar, low piano; warmth and mud." },
              { name: "Low-mid", range: "250–500 Hz", use: "Vocal chest; boxy if excessive." },
              { name: "Mid", range: "500 Hz–2 kHz", use: "Vocal presence; telephone-like if excessive." },
              { name: "High-mid", range: "2–4 kHz", use: "Vocal clarity; attack of percussive instruments." },
              { name: "Presence", range: "4–6 kHz", use: "Intelligibility; harshness if excessive." },
              { name: "Brilliance", range: "6–20 kHz", use: "Cymbals, air, breathiness." },
            ].map((b) => (
              <div key={b.name} className="rounded-md border p-2">
                <div className="font-medium">{b.name} <span className="text-muted-foreground">({b.range})</span></div>
                <div className="text-muted-foreground mt-1">{b.use}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="grid grid-cols-[160px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all">{value}</span></div>);
}
