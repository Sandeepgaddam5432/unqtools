"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getSupportedFormats, getFadePresets, formatTimestamp, parseTimestamp, planTrim, planBatch,
  renderBatchCsv, renderReport, type TrimJob, type FadeConfig,
} from "./logic";

export default function AudioTrimmerRef() {
  const formats = useMemo(() => getSupportedFormats(), []);
  const fadePresets = useMemo(() => getFadePresets(), []);

  const [sourceDuration, setSourceDuration] = useState(120);
  const [start, setStart] = useState("0:10");
  const [end, setEnd] = useState("0:30");
  const [fadeInPreset, setFadeInPreset] = useState("none");
  const [fadeOutPreset, setFadeOutPreset] = useState("none");
  const [format, setFormat] = useState("mp3");
  const [crossfade, setCrossfade] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const buildJob = (): TrimJob => {
    const startS = parseTimestamp(start) ?? 0;
    const endS = parseTimestamp(end) ?? sourceDuration;
    const fi = fadePresets.find((p) => p.id === fadeInPreset)!;
    const fo = fadePresets.find((p) => p.id === fadeOutPreset)!;
    const fadeIn: FadeConfig = { type: fi.type, durationSeconds: fi.durationSeconds };
    const fadeOut: FadeConfig = { type: fo.type, durationSeconds: fo.durationSeconds };
    return {
      sourceDurationSeconds: sourceDuration,
      segments: [{ startSeconds: startS, endSeconds: endS }],
      fadeIn, fadeOut, outputFormat: format, crossfadeSeconds: crossfade,
    };
  };

  const job = useMemo(() => buildJob(), [sourceDuration, start, end, fadeInPreset, fadeOutPreset, format, crossfade]);
  const result = useMemo(() => planTrim(job), [job]);

  const exportBatch = () => {
    setError(null);
    try {
      const jobs: TrimJob[] = [
        { ...job, segments: [{ startSeconds: 0, endSeconds: 30 }] },
        { ...job, segments: [{ startSeconds: 30, endSeconds: 60 }] },
        { ...job, segments: [{ startSeconds: 60, endSeconds: 90 }] },
      ];
      planBatch(jobs);
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Source duration (seconds): ${sourceDuration}`}>
              <input type="range" min={1} max={3600} value={sourceDuration} onChange={(e) => setSourceDuration(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
            </Field>
            <Field label="Output format">
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {formats.map((f) => <option key={f.id} value={f.id}>{f.label} ({f.bitrateKbps} kbps)</option>)}
              </select>
            </Field>
            <Field label="Segment start (M:SS or seconds)">
              <input value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" />
            </Field>
            <Field label="Segment end (M:SS or seconds)">
              <input value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" />
            </Field>
            <Field label="Fade-in preset">
              <select value={fadeInPreset} onChange={(e) => setFadeInPreset(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {fadePresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Fade-out preset">
              <select value={fadeOutPreset} onChange={(e) => setFadeOutPreset(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {fadePresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label={`Crossfade (seconds): ${crossfade}`}>
              <input type="range" min={0} max={5} step={0.1} value={crossfade} onChange={(e) => setCrossfade(parseFloat(e.target.value))} className="w-full cursor-pointer" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="audio-trim-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="audio-trim-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 segments)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Trim plan</Label>
          <Row label="Source duration" value={formatTimestamp(sourceDuration)} />
          <Row label="Output format" value={format} />
          <Row label="Segments" value={String(result.outputSegments.length)} />
          <Row label="Total output" value={`${formatTimestamp(result.totalOutputSeconds)} (${result.totalOutputSeconds.toFixed(2)} s)`} />
          <Row label="Estimated size" value={result.estimatedOutputHuman} />
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">ffmpeg commands</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
              {result.ffmpegCommands.join("\n\n") || "—"}
            </pre>
          </div>
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Fade presets reference</Label>
            {fadePresets.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div><span className="font-medium">{p.label}</span><span className="text-muted-foreground ml-2">{p.type}</span></div>
                <Badge variant="outline" className="text-[10px]">{p.durationSeconds}s</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Supported export formats</Label>
            {formats.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span className="font-medium">{f.label}</span>
                <Badge variant="outline" className="text-[10px]">{f.ext}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Silence detection guide</Label>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Detect silence using RMS amplitude below threshold (-30 dBFS typical for clean speech).</p>
            <p>• Filter out silences shorter than ~200ms to avoid cutting breath pauses in speech.</p>
            <p>• For music, use a higher threshold (-20 dBFS) and shorter minimum duration (100ms).</p>
            <p>• ffmpeg command: <code className="font-mono text-foreground">ffmpeg -i input.wav -af silencedetect=noise=-30dB:d=0.3 -f null -</code></p>
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
