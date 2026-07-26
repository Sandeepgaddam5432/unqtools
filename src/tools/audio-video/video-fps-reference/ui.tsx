"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllFps,
  getFpsById,
  getFpsByType,
  convertFrameCount,
  slowMoRatio,
  estimateFileSize,
  motionBlurMs,
  ntscDriftMs,
  detectPulldown,
  cinematicShutterSpeed,
  formatFpsCard,
  exportFpsAsCSV,
  validateFps,
  type FpsInfo,
} from "./logic";

const TYPES: FpsInfo["type"][] = ["cinema", "tv", "broadcast", "high-framerate", "ultra"];

export default function VideoFpsReference() {
  const fpsList = useMemo(() => getAllFps(), []);
  const [selectedId, setSelectedId] = useState<string>("24");
  const [runtimeSec, setRuntimeSec] = useState<string>("60");
  const [fromFps, setFromFps] = useState<string>("120");
  const [toFps, setToFps] = useState<string>("24");
  const [bitrate, setBitrate] = useState<string>("8");
  const [error, setError] = useState<string>("");

  const current = useMemo(() => getFpsById(selectedId), [selectedId]);

  const rt = Number(runtimeSec);
  const ff = Number(fromFps);
  const tf = Number(toFps);
  const br = Number(bitrate);
  const convDuration = !Number.isNaN(rt) && !Number.isNaN(ff) && !Number.isNaN(tf) ? convertFrameCount(rt, ff, tf) : null;
  const slo = !Number.isNaN(ff) && !Number.isNaN(tf) && tf > 0 ? slowMoRatio(ff, tf) : null;
  const size = !Number.isNaN(rt) && !Number.isNaN(br) ? estimateFileSize(rt, br) : null;
  const drift = !Number.isNaN(rt) ? ntscDriftMs(rt) : null;
  const pulldown = !Number.isNaN(ff) && !Number.isNaN(tf) ? detectPulldown(ff, tf) : "";
  const blur = current ? motionBlurMs(current.fps, 180) : 0;
  const shutter = current ? cinematicShutterSpeed(current.fps) : "";

  if (!current) {
    return <ErrorBanner message="Selected FPS entry not found." />;
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Filter by type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const first = getFpsByType(t)[0];
                  if (first) setSelectedId(first.id);
                }}
                className="px-3 py-1 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted capitalize cursor-pointer"
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {fpsList.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  selectedId === f.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {f.id} fps
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">{current.name}</h3>
              <p className="text-xs text-muted-foreground">{current.notes}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton getText={() => formatFpsCard(current)} label="Copy card" />
              <DownloadButton getText={() => exportFpsAsCSV()} filename="fps-reference.csv" mime="text/csv" label="CSV" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <Label className="text-xs text-emerald-700 dark:text-emerald-400">Pros</Label>
              <ul className="text-xs space-y-0.5">
                {current.pros.map((p, i) => (
                  <li key={i}>+ {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <Label className="text-xs text-red-700 dark:text-red-400">Cons</Label>
              <ul className="text-xs space-y-0.5">
                {current.cons.map((c, i) => (
                  <li key={i}>– {c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground">Use cases</Label>
            <div className="flex flex-wrap gap-1">
              {current.useCases.map((u) => (
                <Badge key={u} variant="outline" className="text-[10px] border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  {u}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">180° shutter blur</div>
              <code className="font-mono">{blur.toFixed(2)} ms</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Cinematic shutter</div>
              <code className="font-mono text-[11px]">{shutter}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">NTSC drift over {runtimeSec}s</div>
              <code className="font-mono">{drift?.toFixed(1)} ms</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Conversion &amp; slow-motion calculator</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Runtime (sec)</Label>
              <input type="number" value={runtimeSec} onChange={(e) => setRuntimeSec(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From fps</Label>
              <input type="number" value={fromFps} onChange={(e) => setFromFps(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To fps</Label>
              <input type="number" value={toFps} onChange={(e) => setToFps(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {convDuration !== null && slo !== null && (
            <div className="text-xs space-y-1">
              <p>
                Conformed runtime: <span className="font-mono">{convDuration.toFixed(2)}s</span>
              </p>
              <p>
                Slow-mo ratio: <span className="font-mono">{slo.toFixed(2)}x</span>
              </p>
              <p className="text-muted-foreground">Pulldown: {pulldown}</p>
              {validateFps(ff).map((w, i) => (
                <p key={i} className="text-amber-700 dark:text-amber-400">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">File size estimator</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Runtime (sec)</Label>
              <input type="number" value={runtimeSec} onChange={(e) => setRuntimeSec(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitrate (Mbps)</Label>
              <input type="number" value={bitrate} onChange={(e) => setBitrate(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {size !== null && (
            <p className="text-xs">
              Estimated file size: <span className="font-mono">{size.toFixed(1)} MB</span> ({(size / 1024).toFixed(2)} GB)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
