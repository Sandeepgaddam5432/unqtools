"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getTransitions, getOutputCodecs, planMerge, planBatch, renderBatchCsv, renderReport,
  makeClip, suggestOutputResolution, formatDuration, type MergeJob, type VideoClipSpec,
} from "./logic";

export default function VideoMergerRef() {
  const transitions = useMemo(() => getTransitions(), []);
  const outCodecs = useMemo(() => getOutputCodecs(), []);

  const [clips, setClips] = useState<VideoClipSpec[]>([
    makeClip("a", 30, 1920, 1080, 30, "h264", "aac", 48000, true),
    makeClip("b", 30, 1920, 1080, 30, "h264", "aac", 48000, true),
  ]);
  const [transitionId, setTransitionId] = useState("fade");
  const [outputCodec, setOutputCodec] = useState("h264");
  const [audioSyncMode, setAudioSyncMode] = useState<MergeJob["audioSyncMode"]>("auto");
  const [error, setError] = useState<string | null>(null);

  const suggested = useMemo(() => suggestOutputResolution(clips), [clips]);

  const job: MergeJob = useMemo(() => ({
    clips, transitionId, outputWidth: suggested.width, outputHeight: suggested.height,
    outputFps: clips[0]?.fps ?? 30, outputCodec, audioSyncMode,
  }), [clips, transitionId, outputCodec, audioSyncMode, suggested]);

  const result = useMemo(() => planMerge(job), [job]);

  const addClip = () => {
    setError(null);
    const id = String.fromCharCode("a".charCodeAt(0) + clips.length);
    setClips([...clips, makeClip(id, 30, suggested.width, suggested.height, clips[0]?.fps ?? 30, "h264", "aac", 48000, true)]);
  };
  const removeClip = (i: number) => setClips(clips.filter((_, idx) => idx !== i));
  const updateClip = (i: number, patch: Partial<VideoClipSpec>) => setClips(clips.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const exportBatch = () => {
    setError(null);
    try {
      planBatch([job, { ...job, transitionId: "dissolve" }, { ...job, transitionId: "slideleft" }]);
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Clips ({clips.length})</Label>
            <button onClick={addClip} className="text-xs text-primary hover:underline cursor-pointer">+ Add clip</button>
          </div>
          <div className="space-y-2">
            {clips.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_60px_60px_24px] gap-2 items-center text-xs">
                <input value={c.id} onChange={(e) => updateClip(i, { id: e.target.value })} className="rounded border bg-background px-2 py-1 font-mono" />
                <input type="number" value={c.width} onChange={(e) => updateClip(i, { width: parseInt(e.target.value, 10) })} className="rounded border bg-background px-2 py-1 font-mono w-full" />
                <input type="number" value={c.height} onChange={(e) => updateClip(i, { height: parseInt(e.target.value, 10) })} className="rounded border bg-background px-2 py-1 font-mono w-full" />
                <input type="number" value={c.fps} onChange={(e) => updateClip(i, { fps: parseInt(e.target.value, 10) })} className="rounded border bg-background px-2 py-1 font-mono w-full" />
                <input type="number" value={c.durationSeconds} onChange={(e) => updateClip(i, { durationSeconds: parseInt(e.target.value, 10) })} className="rounded border bg-background px-2 py-1 font-mono w-full" />
                <button onClick={() => removeClip(i)} className="text-destructive hover:underline cursor-pointer text-xs">✕</button>
              </div>
            ))}
            {clips.length === 0 && <div className="text-xs text-muted-foreground">No clips yet. Click "+ Add clip".</div>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Field label="Transition">
              <select value={transitionId} onChange={(e) => setTransitionId(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {transitions.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.durationSeconds}s)</option>)}
              </select>
            </Field>
            <Field label="Output codec">
              <select value={outputCodec} onChange={(e) => setOutputCodec(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                {outCodecs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Audio sync mode">
              <select value={audioSyncMode} onChange={(e) => setAudioSyncMode(e.target.value as MergeJob["audioSyncMode"])} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">
                <option value="auto">Auto</option>
                <option value="resample">Resample</option>
                <option value="stretch">Stretch</option>
                <option value="trim">Trim</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="video-merge-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="video-merge-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 transitions)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Merge plan</Label>
          <Row label="Clips" value={String(result.job.clips.length)} />
          <Row label="Output resolution" value={`${result.job.outputWidth}×${result.job.outputHeight}`} />
          <Row label="Total duration" value={`${formatDuration(result.totalDurationSeconds)} (${result.totalDurationSeconds.toFixed(2)} s)`} />
          <Row label="Estimated size" value={result.estimatedSizeHuman} />
          <Row label="Resolution match" value={result.resolutionMatch.ok ? "OK" : `${result.resolutionMatch.mismatches.length} mismatch(es)`} />
          <Row label="Codec match" value={result.codecMatch.ok ? "OK" : `${result.codecMatch.mismatches.length} mismatch(es)`} />
          <Row label="FPS match" value={result.fpsMatch.ok ? "OK" : `${result.fpsMatch.mismatches.length} mismatch(es)`} />
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">ffmpeg command</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
              {result.ffmpegCommand || "—"}
            </pre>
          </div>
          {result.audioSyncWarnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.audioSyncWarnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
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
          <Label className="text-sm font-semibold">Transitions reference</Label>
          {transitions.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
              <div><span className="font-medium">{t.label}</span><span className="text-muted-foreground ml-2">{t.description}</span></div>
              <Badge variant="outline" className="text-[10px]">{t.durationSeconds}s</Badge>
            </div>
          ))}
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
