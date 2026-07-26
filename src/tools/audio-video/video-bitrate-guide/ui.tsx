"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllCodecs,
  getAllResolutions,
  getCodecById,
  getResolutionById,
  computeBpp,
  recommendBitrate,
  estimateFileSizeMb,
  streamingBandwidth,
  rateQuality,
  compareCodecs,
  exportComparisonCSV,
  youtubeRecommended,
  recommendCRF,
  formatRecommendation,
  validateInputs,
} from "./logic";

export default function VideoBitrateGuide() {
  const codecs = useMemo(() => getAllCodecs(), []);
  const resolutions = useMemo(() => getAllResolutions(), []);

  const [resId, setResId] = useState<string>("1080p");
  const [codecId, setCodecId] = useState<string>("h264");
  const [fps, setFps] = useState<string>("30");
  const [duration, setDuration] = useState<string>("60");
  const [bitDepth, setBitDepth] = useState<string>("8");
  const [error, setError] = useState<string>("");

  const res = getResolutionById(resId);
  const codec = getCodecById(codecId);
  const fpsN = Number(fps);
  const durN = Number(duration);
  const depthN = Number(bitDepth);

  const validInputs = res && codec ? validateInputs(res.width, res.height, fpsN, 10) : [];

  if (!res || !codec) {
    return <ErrorBanner message="Missing resolution or codec." />;
  }

  const bitrate = recommendBitrate(res.width, res.height, fpsN, codec, depthN);
  const sizeMb = estimateFileSizeMb(durN, bitrate);
  const bw = streamingBandwidth(bitrate);
  const bpp = computeBpp(bitrate, res.width, res.height, fpsN);
  const q = rateQuality(bpp);
  const yt = youtubeRecommended(resId, fpsN);
  const crf = recommendCRF("standard");
  const comparison = compareCodecs(res.width, res.height, fpsN, durN);

  const summary = [
    { label: "Resolution", value: `${res.width}×${res.height}` },
    { label: "Frame rate", value: `${fpsN} fps` },
    { label: "Bit depth", value: `${depthN}-bit` },
    { label: "Codec", value: codec.name },
    { label: "Recommended bitrate", value: `${bitrate.toFixed(2)} Mbps` },
    { label: "Bits per pixel", value: bpp.toFixed(4) },
    { label: "Quality", value: q.label },
    { label: "File size (60s)", value: `${sizeMb.toFixed(1)} MB` },
    { label: "Stream bandwidth", value: `${bw.toFixed(2)} Mbps` },
  ];

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Resolution</Label>
              <select value={resId} onChange={(e) => setResId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {resolutions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Codec</Label>
              <select value={codecId} onChange={(e) => setCodecId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {codecs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">FPS</Label>
              <input type="number" value={fps} onChange={(e) => setFps(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bit depth</Label>
              <select value={bitDepth} onChange={(e) => setBitDepth(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="8">8-bit (SDR)</option>
                <option value="10">10-bit (HDR)</option>
                <option value="12">12-bit (Pro)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (sec)</Label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {validInputs.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {validInputs.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Recommendation</h3>
            <div className="flex gap-2">
              <CopyButton getText={() => formatRecommendation(res.width, res.height, fpsN, codec, bitrate)} label="Copy" />
              <DownloadButton getText={() => exportComparisonCSV(res.width, res.height, fpsN, durN)} filename="codec-comparison.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="space-y-1">
            {summary.map((r) => (
              <div key={r.label} className="grid grid-cols-[160px_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <code className="font-mono">{r.value}</code>
              </div>
            ))}
          </div>
          {yt && (
            <div className="text-xs space-y-1 pt-2">
              <Label className="text-xs text-muted-foreground">YouTube recommended</Label>
              <p>
                Standard: <span className="font-mono">{yt.standard.toFixed(1)} Mbps</span> · High: <span className="font-mono">{yt.high.toFixed(1)} Mbps</span>
              </p>
              <p className="text-muted-foreground">H.264 CRF ~{crf} for "{`standard`}" quality target.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Codec comparison at {res.width}×{res.height} @ {fpsN}fps</Label>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 text-[10px] uppercase text-muted-foreground pb-1 border-b border-border/40">
              <span>Codec</span>
              <span>Bitrate</span>
              <span>Size (60s)</span>
              <span>BPP</span>
            </div>
            {comparison.map((c) => (
              <div key={c.codec} className="grid grid-cols-[1fr_80px_80px_60px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center">
                <span>{c.codec}</span>
                <code className="font-mono">{c.bitrateMbps.toFixed(1)} Mb</code>
                <code className="font-mono">{c.sizeMb.toFixed(1)} MB</code>
                <code className="font-mono">{c.bpp.toFixed(3)}</code>
              </div>
            ))}
          </div>
          <Badge variant="outline" className="text-[10px] mt-1">
            Tip: AV1 / H.265 ≈ 50% smaller than H.264 at the same perceived quality.
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
