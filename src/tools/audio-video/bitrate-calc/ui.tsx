"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  calculateVideoBitrate,
  calculateAudioBitrate,
  estimateFileSizeMB,
  suggestCompressionFactor,
  formatBitrate,
  validateVideoInput,
  validateAudioInput,
  type VideoBitrateInput,
  type AudioBitrateInput,
} from "./logic";

type Mode = "video" | "audio";

export default function BitrateCalc() {
  const [mode, setMode] = useState<Mode>("video");

  const [video, setVideo] = useState<VideoBitrateInput>({
    width: 1920,
    height: 1080,
    fps: 30,
    colorDepth: 8,
    chromaSubsampling: "4:2:0",
  });
  const [audio, setAudio] = useState<AudioBitrateInput>({
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
  });
  const [duration, setDuration] = useState(60);
  const [compression, setCompression] = useState(0.02);

  const error = useMemo(() => {
    if (mode === "video") return validateVideoInput(video);
    return validateAudioInput(audio);
  }, [mode, video, audio]);

  const result = useMemo(() => {
    if (error) return null;
    return mode === "video" ? calculateVideoBitrate(video, compression) : calculateAudioBitrate(audio, compression);
  }, [mode, video, audio, compression, error]);

  const fileSizeMB = useMemo(() => {
    if (!result) return 0;
    return estimateFileSizeMB(result.compressedBitrateKbps, duration);
  }, [result, duration]);

  const rows = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Raw bitrate", value: formatBitrate(result.rawBitrateKbps) },
      { label: "Raw bitrate (Mbps)", value: `${result.rawBitrateMbps.toFixed(2)} Mbps` },
      { label: "Compressed bitrate", value: formatBitrate(result.compressedBitrateKbps) },
      { label: "Compressed bitrate (Mbps)", value: `${result.compressedBitrateMbps.toFixed(2)} Mbps` },
      { label: `File size (${duration}s)`, value: `${fileSizeMB.toFixed(2)} MB` },
    ];
  }, [result, duration, fileSizeMB]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {(["video", "audio"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setCompression(suggestCompressionFactor(m === "video" ? "h264" : "aac"));
                }}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer ${
                  mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {m === "video" ? "Video" : "Audio"}
              </button>
            ))}
          </div>

          {mode === "video" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Width" value={video.width} onChange={(v) => setVideo((s) => ({ ...s, width: v }))} />
              <Field label="Height" value={video.height} onChange={(v) => setVideo((s) => ({ ...s, height: v }))} />
              <Field label="FPS" value={video.fps} onChange={(v) => setVideo((s) => ({ ...s, fps: v }))} />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Color depth (bits)</Label>
                <select
                  value={video.colorDepth}
                  onChange={(e) => setVideo((s) => ({ ...s, colorDepth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {[8, 10, 12, 16].map((d) => <option key={d} value={d}>{d}-bit</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Chroma</Label>
                <select
                  value={video.chromaSubsampling}
                  onChange={(e) => setVideo((s) => ({ ...s, chromaSubsampling: e.target.value as VideoBitrateInput["chromaSubsampling"] }))}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {["4:4:4", "4:2:2", "4:2:0"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Sample rate (Hz)" value={audio.sampleRate} onChange={(v) => setAudio((s) => ({ ...s, sampleRate: v }))} />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bit depth</Label>
                <select
                  value={audio.bitDepth}
                  onChange={(e) => setAudio((s) => ({ ...s, bitDepth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {[8, 16, 24, 32].map((d) => <option key={d} value={d}>{d}-bit</option>)}
                </select>
              </div>
              <Field label="Channels" value={audio.channels} onChange={(v) => setAudio((s) => ({ ...s, channels: v }))} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Duration (seconds)" value={duration} onChange={setDuration} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Compression factor ({compression.toFixed(3)})</Label>
              <input
                type="range"
                min={0.001}
                max={0.5}
                step={0.001}
                value={compression}
                onChange={(e) => setCompression(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="text-primary hover:underline cursor-pointer" onClick={() => setCompression(suggestCompressionFactor(mode === "video" ? "h264" : "aac"))}>H.264 / AAC</button>
            <button className="text-primary hover:underline cursor-pointer" onClick={() => setCompression(suggestCompressionFactor(mode === "video" ? "h265" : "opus"))}>H.265 / Opus</button>
            <button className="text-primary hover:underline cursor-pointer" onClick={() => setCompression(suggestCompressionFactor(mode === "video" ? "av1" : "flac"))}>AV1 / FLAC</button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Results</Label>
              <Badge variant="outline" className="text-xs">{mode}</Badge>
            </div>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[160px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <code className="font-mono">{r.value}</code>
                  <CopyButton getText={() => r.value} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result && !error && (
        <EmptyState title="Enter parameters to calculate bitrate" hint="Pick video or audio, set parameters, and see raw vs compressed bitrates." />
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="font-mono text-sm"
      />
    </div>
  );
}
