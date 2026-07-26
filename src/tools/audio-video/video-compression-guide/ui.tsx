"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllCodecs, getQualityPresets, getResolutions, getFpsOptions, planCompression, planBatch,
  renderBatchCsv, renderReport, recommendCodec, suggestResolution, type CompressionJob,
} from "./logic";

export default function VideoCompressionGuide() {
  const codecs = useMemo(() => getAllCodecs(), []);
  const presets = useMemo(() => getQualityPresets(), []);
  const resolutions = useMemo(() => getResolutions(), []);
  const fpsOptions = useMemo(() => getFpsOptions(), []);

  const [codec, setCodec] = useState("h264");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState("balanced");
  const [duration, setDuration] = useState(120);
  const [audioBitrate, setAudioBitrate] = useState(128);
  const [error, setError] = useState<string | null>(null);

  const job: CompressionJob = { codec, resolution, fps, qualityPreset: quality, durationSeconds: duration, audioBitrateKbps: audioBitrate };
  const result = useMemo(() => planCompression(job), [codec, resolution, fps, quality, duration, audioBitrate]);

  const quickPreset = (useCase: "web" | "archive" | "broadcast" | "mobile" | "gaming") => {
    const c = recommendCodec(useCase);
    if (c) setCodec(c.id);
    if (useCase === "archive") setQuality("high");
    if (useCase === "mobile") { setResolution("480p"); setQuality("mobile"); }
    if (useCase === "web") { setResolution("1080p"); setQuality("stream"); }
  };

  const exportBatch = () => {
    setError(null);
    try {
      const jobs: CompressionJob[] = [
        { codec, resolution, fps, qualityPreset: "stream", durationSeconds: duration, audioBitrateKbps: audioBitrate },
        { codec, resolution, fps, qualityPreset: "balanced", durationSeconds: duration, audioBitrateKbps: audioBitrate },
        { codec, resolution, fps, qualityPreset: "high", durationSeconds: duration, audioBitrateKbps: audioBitrate },
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
            <Field label="Codec">
              <Select value={codec} onChange={setCodec} options={codecs.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Resolution">
              <Select value={resolution} onChange={setResolution} options={resolutions.map((r) => ({ value: r.id, label: `${r.label} (${r.width}×${r.height})` }))} />
            </Field>
            <Field label="FPS">
              <Select value={String(fps)} onChange={(v) => setFps(parseInt(v, 10))} options={fpsOptions.map((f) => ({ value: String(f.fps), label: f.label }))} />
            </Field>
            <Field label="Quality preset">
              <Select value={quality} onChange={setQuality} options={presets.map((p) => ({ value: p.id, label: `${p.label} (CRF ${p.crf})` }))} />
            </Field>
            <Field label={`Duration (seconds): ${duration}`}>
              <input type="range" min={1} max={7200} value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
            </Field>
            <Field label={`Audio bitrate: ${audioBitrate} kbps`}>
              <input type="range" min={0} max={320} step={32} value={audioBitrate} onChange={(e) => setAudioBitrate(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="video-compression-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="video-compression-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Batch plan (3 qualities)</button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="text-xs text-muted-foreground">Quick presets:</span>
            {(["web", "archive", "mobile", "gaming", "broadcast"] as const).map((u) => (
              <button key={u} onClick={() => quickPreset(u)} className="text-xs text-primary hover:underline cursor-pointer">{u}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Compression plan</Label>
          <Row label="Codec" value={`${result.codec?.name ?? "—"} (${result.codec?.encoder ?? "—"})`} />
          <Row label="Resolution" value={`${result.resolution?.label ?? "—"} (${result.resolution?.width ?? "—"}×${result.resolution?.height ?? "—"})`} />
          <Row label="Quality" value={`${result.preset?.label ?? "—"} — CRF ${result.preset?.crf ?? "—"}, preset ${result.preset?.preset ?? "—"}`} />
          <Row label="Video bitrate" value={`${result.videoBitrateKbps} kbps`} />
          <Row label="Audio bitrate" value={`${result.audioBitrateKbps} kbps`} />
          <Row label="Total bitrate" value={`${result.totalBitrateKbps} kbps`} />
          <Row label="Estimated size" value={result.estimatedSizeHuman} />
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">ffmpeg command</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
              {result.ffmpegCommand || "—"}
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
            <Label className="text-sm font-semibold">Codec comparison</Label>
            {codecs.map((c) => (
              <div key={c.id} className="text-xs py-1.5 border-b border-border/40 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline" className="text-[10px]">{c.royaltyFree ? "royalty-free" : "licensed"}</Badge>
                </div>
                <div className="text-muted-foreground text-[10px] mt-0.5">CRF {c.crfRange[0]}–{c.crfRange[1]} (default {c.defaultCrf}) · encoder {c.encoder}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Quality presets</Label>
            {presets.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <div><span className="font-medium">{p.label}</span><span className="text-muted-foreground ml-2">{p.description}</span></div>
                <Badge variant="outline" className="text-[10px]">CRF {p.crf}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Resolution reference</Label>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead><tr className="text-muted-foreground"><th className="text-left p-1">Label</th><th className="text-left p-1">Dimensions</th><th className="text-left p-1">Megapixels</th><th className="text-left p-1">Use case</th></tr></thead>
              <tbody>
                {resolutions.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-1 font-medium">{r.label}</td>
                    <td className="p-1 font-mono">{r.width}×{r.height}</td>
                    <td className="p-1 font-mono">{r.mp}</td>
                    <td className="p-1 text-muted-foreground">{r.typicalUse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (<select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="grid grid-cols-[140px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all">{value}</span></div>);
}
