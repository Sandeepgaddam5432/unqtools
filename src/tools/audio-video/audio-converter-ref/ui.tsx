"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllFormats, getQualityPresets, getChannelConfigs, getSampleRates,
  getCompatibilityMatrix, planConversion, planBatch, renderBatchCsv, renderReport,
  type ConversionJob,
} from "./logic";

export default function AudioConverterRef() {
  const formats = useMemo(() => getAllFormats(), []);
  const presets = useMemo(() => getQualityPresets(), []);
  const channels = useMemo(() => getChannelConfigs(), []);
  const rates = useMemo(() => getSampleRates(), []);
  const matrix = useMemo(() => getCompatibilityMatrix(), []);
  const browsers = useMemo(() => Array.from(new Set(matrix.map((c) => c.browser))), [matrix]);

  const [source, setSource] = useState("wav");
  const [target, setTarget] = useState("mp3");
  const [quality, setQuality] = useState("standard");
  const [channel, setChannel] = useState("stereo");
  const [duration, setDuration] = useState(180);
  const [error, setError] = useState<string | null>(null);

  const job: ConversionJob = { sourceFormat: source, targetFormat: target, qualityPreset: quality, channelConfig: channel, durationSeconds: duration };
  const result = useMemo(() => planConversion(job), [source, target, quality, channel, duration]);

  const addBatch = () => {
    setError(null);
    const jobs: ConversionJob[] = [
      { sourceFormat: source, targetFormat: "mp3", qualityPreset: "standard", channelConfig: "stereo", durationSeconds: duration },
      { sourceFormat: source, targetFormat: "aac", qualityPreset: "high", channelConfig: "stereo", durationSeconds: duration },
      { sourceFormat: source, targetFormat: "flac", qualityPreset: "lossless", channelConfig: "stereo", durationSeconds: duration },
    ];
    try { planBatch(jobs); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Source format">
              <Select value={source} onChange={setSource} options={formats.map((f) => ({ value: f.id, label: `${f.name} (${f.extension})` }))} />
            </Field>
            <Field label="Target format">
              <Select value={target} onChange={setTarget} options={formats.map((f) => ({ value: f.id, label: `${f.name} (${f.extension})` }))} />
            </Field>
            <Field label="Quality preset">
              <Select value={quality} onChange={setQuality} options={presets.map((p) => ({ value: p.id, label: `${p.label} (${p.bitrateKbps} kbps)` }))} />
            </Field>
            <Field label="Channels">
              <Select value={channel} onChange={setChannel} options={channels.map((c) => ({ value: c.id, label: c.label }))} />
            </Field>
            <Field label={`Duration (seconds): ${duration}`}>
              <input type="range" min={1} max={3600} value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="audio-conversion-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="audio-conversion-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={addBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 formats)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Conversion plan</Label>
          <Row label="Source" value={`${result.source?.name ?? "—"} (${result.source?.extension ?? "—"})`} />
          <Row label="Target" value={`${result.target?.name ?? "—"} (${result.target?.extension ?? "—"})`} />
          <Row label="Quality" value={`${result.preset?.label ?? "—"} — ${result.preset?.bitrateKbps ?? "—"} kbps, ${result.preset?.sampleRate ?? "—"} Hz`} />
          <Row label="Channels" value={result.channels?.label ?? "—"} />
          <Row label="Estimated size" value={result.estimatedSizeHuman} />
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">Recommended encoder command</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
              {result.recommendedEncoderArgs || "—"}
            </pre>
          </div>
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">
              {result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}
            </div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">
              {result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Browser compatibility matrix</Label>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left p-1">Format</th>
                  {browsers.map((b) => <th key={b} className="p-1 text-center">{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {formats.map((f) => (
                  <tr key={f.id} className="border-t border-border/40">
                    <td className="p-1 font-medium">{f.extension}</td>
                    {browsers.map((b) => {
                      const cell = matrix.find((c) => c.formatId === f.id && c.browser === b);
                      const cls = cell?.supported === "yes" ? "text-emerald-600 dark:text-emerald-400" :
                        cell?.supported === "partial" ? "text-amber-600 dark:text-amber-400" : "text-destructive";
                      return <td key={b} className={`p-1 text-center ${cls}`}>{cell?.supported === "yes" ? "✓" : cell?.supported === "partial" ? "~" : "✕"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Sample rate reference</Label>
            {rates.map((r) => (
              <div key={r.hz} className="grid grid-cols-[100px_1fr] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                <span className="font-mono">{r.label}</span>
                <span className="text-muted-foreground">{r.useCase}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Quality presets</Label>
            {presets.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground ml-2">{p.description}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.bitrateKbps} kbps</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono break-all">{value}</span>
    </div>
  );
}
